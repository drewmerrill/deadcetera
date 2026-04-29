"""
Phase 0 bake-off pipeline runner.

Takes a source URL (YouTube/Spotify-rip/etc) + song_id and runs the
full Modal pipeline: Demucs → MelBand-Roformer Karaoke → SepACap.
Prints R2 URLs for every stem produced so they can be pasted into
the bake-off run sheet.

Usage:
    python services/stem-separation/bakeoff_run.py \\
        --url "https://www.youtube.com/watch?v=XXX" \\
        --song-id bakeoff-because

Or run all 5 corpus songs from a YAML manifest:
    python services/stem-separation/bakeoff_run.py --manifest songs.yaml

Requires: `pip install modal` and `modal token set` already done
(the existing groovelinx-stem-separator deploy auth covers this).

Skips SepACap if --no-sepacap is passed (e.g. while debugging
the upstream MelBand stage).
"""

from __future__ import annotations

import argparse
import json
import sys
import time

import modal

APP_NAME = "groovelinx-stem-separator"


def _lookup(fn_name: str):
    return modal.Function.from_name(APP_NAME, fn_name)


def run_song(source_url: str, song_id: str, *, do_sepacap: bool = True) -> dict:
    """Run a single song through the full bake-off pipeline."""
    print(f"\n{'=' * 70}")
    print(f"  Song: {song_id}")
    print(f"  Source: {source_url[:80]}")
    print(f"{'=' * 70}\n")

    result = {"song_id": song_id, "source_url": source_url}

    # Stage 1: Demucs
    print("[1/3] Running Demucs (separate_stems)...")
    t0 = time.time()
    separate_stems = _lookup("separate_stems")
    demucs = separate_stems.remote(source_url, song_id, "htdemucs_6s")
    if not demucs.get("success"):
        print(f"  FAIL: {demucs}")
        result["demucs"] = demucs
        return result
    elapsed = time.time() - t0
    print(f"  ✓ Demucs done in {elapsed:.1f}s (Modal: {demucs['elapsed_sec']:.1f}s)")
    print(f"  Stems: {list(demucs['stems'].keys())}")
    for stem, url in demucs["stems"].items():
        print(f"    {stem:12s} → {url}")
    result["demucs"] = demucs

    # Stage 2: MelBand-Roformer Karaoke (full mix → instrumental + vocals).
    # Path A pivot: this checkpoint is a vocals/instrumental separator
    # (its actual training target), not lead/backing as plan §4.2 once
    # assumed. We feed it the FULL MIX, not the Demucs vocals stem, and
    # use its `other` output (= vocals) for the downstream SepACap eval.
    print("\n[2/3] Running MelBand-Roformer Karaoke (split_vocals)...")
    t0 = time.time()
    split_vocals = _lookup("split_vocals")
    melband = split_vocals.remote(source_url, song_id)
    if not melband.get("success"):
        print(f"  FAIL: {melband}")
        result["melband"] = melband
        return result
    elapsed = time.time() - t0
    print(f"  ✓ MelBand done in {elapsed:.1f}s (Modal: {melband['elapsed_sec']:.1f}s)")
    for stem, url in melband["stems"].items():
        print(f"    {stem:12s} → {url}")
    result["melband"] = melband

    if not do_sepacap:
        print("\n[3/3] Skipping SepACap (--no-sepacap)")
        return result

    # Stage 3: SepACap on MelBand's vocals output (the `other` stem).
    # SepACap is a pure-vocal multi-singer separator; feed it the
    # cleanest vocals we have. Falls back to Demucs vocals if MelBand
    # didn't produce an `other` stem for some reason.
    sepacap_input = melband["stems"].get("other") or demucs["stems"].get("vocals")
    if not sepacap_input:
        print("\n  WARN: no usable vocal stem for SepACap, skipping")
        return result

    print(f"\n[3/3] Running SepACap on vocals stem ({sepacap_input[:60]}...)")
    t0 = time.time()
    sepacap = _lookup("sepacap_split")
    sa = sepacap.remote(sepacap_input, song_id)
    if not sa.get("success"):
        print(f"  FAIL: {sa}")
        result["sepacap"] = sa
        return result
    elapsed = time.time() - t0
    print(f"  ✓ SepACap done in {elapsed:.1f}s (Modal: {sa['elapsed_sec']:.1f}s)")
    for voice, url in sa["stems"].items():
        print(f"    {voice:18s} → {url}")
    result["sepacap"] = sa

    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", help="Source URL for a single song")
    parser.add_argument("--song-id", help="Song ID for R2 namespace")
    parser.add_argument("--manifest", help="YAML manifest of {song_id: url} entries")
    parser.add_argument("--no-sepacap", action="store_true",
                        help="Skip SepACap stage")
    parser.add_argument("--out", default="bakeoff_results.json",
                        help="Where to dump aggregated JSON results")
    args = parser.parse_args()

    if args.manifest:
        import yaml
        with open(args.manifest) as f:
            manifest = yaml.safe_load(f)
        results = []
        for song_id, url in manifest.items():
            r = run_song(url, song_id, do_sepacap=not args.no_sepacap)
            results.append(r)
        with open(args.out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nWrote {len(results)} results to {args.out}")
    elif args.url and args.song_id:
        r = run_song(args.url, args.song_id, do_sepacap=not args.no_sepacap)
        print("\n" + "=" * 70)
        print(json.dumps(r, indent=2))
    else:
        parser.error("provide either --url + --song-id, or --manifest")


if __name__ == "__main__":
    main()
