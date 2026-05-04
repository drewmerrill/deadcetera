#!/usr/bin/env python3
"""
Generate photorealistic stage-plot instrument icons via OpenAI gpt-image-1.

Uses /v1/images/generations with background=transparent so each PNG drops
in cleanly over GrooveLinx's dark UI. Resumable — skips icons already on
disk. Run with `python3 generate.py`. API key read from ~/.openai_key.

Output: js/assets/stageplot/icons/{slug}.png at 1024x1024.
Cost: ~$0.07/image at quality=medium → ~$1.75 for the full 25.
"""

import base64
import json
import os
import re
import sys
import time
import urllib.request
from pathlib import Path

KEY_PATH = Path.home() / ".openai_key"
OUTPUT_DIR = Path(__file__).resolve().parent.parent.parent / "js" / "assets" / "stageplot" / "icons"
ENDPOINT = "https://api.openai.com/v1/images/generations"
MODEL = "gpt-image-1"
SIZE = "1024x1024"
QUALITY = "medium"

STYLE_FRAME = (
    "Photorealistic 3D product render of {subject}, "
    "centered composition, transparent background, "
    "isometric view from upper-front-left at roughly 30 degrees, "
    "soft studio lighting from above-left, sharp focus, "
    "no text or visible logos on the equipment, "
    "clean modern catalog aesthetic, "
    "square framing with the equipment filling about 80 percent of the frame"
)

# Instrument library: slug → subject prompt fragment.
# Phrasing avoids brand names (DALL-E garbles logos anyway) but keeps
# silhouette-defining descriptors so each result is recognizable.
INSTRUMENTS = [
    ("drum-kit",        "a 5-piece drum kit with maple shells, two rack toms, a floor tom, a snare, a bass kick drum facing forward, hi-hat and crash cymbals on chrome boom stands"),
    ("electric-guitar", "a vintage solid-body electric guitar with double-cutaway body, chrome hardware, three single-coil pickups, white pickguard, sunburst finish"),
    ("bass-guitar",     "a vintage 4-string electric bass guitar with offset solid body, chrome hardware, single split-coil pickup, tortoise pickguard, sunburst finish"),
    ("acoustic-guitar", "a dreadnought acoustic guitar with spruce top, mahogany back and sides, rosette around the soundhole, simple wood inlay headstock"),
    ("mandolin",        "an F-style mandolin with carved spruce top, scroll body shape, F-holes, rosewood fretboard, vintage sunburst finish"),
    ("banjo",           "a 5-string bluegrass banjo with chrome flange, white drum head, walnut resonator, fifth peg on the neck"),
    ("dobro",           "a square-neck resonator guitar with metal cover plate over the resonator cone, dark wood body, raised string action"),
    ("fiddle",          "a violin with maple body, ebony fingerboard, four strings, traditional varnish finish, F-holes, scroll headstock"),
    ("pedal-steel",     "a 10-string pedal steel guitar on chrome legs with multiple foot pedals and knee levers, vintage maple top, raised body angle"),
    ("accordion",       "a piano-key accordion with black bellows, mother-of-pearl button trim, black and white keys on the right side, button board on the left"),
    ("standup-bass",    "an upright double bass with maple body, ebony fingerboard, four strings, endpin extended, scroll headstock"),
    ("keyboard-88",     "an 88-key digital stage piano with black housing, simple control surface, on a chrome X-frame keyboard stand"),
    ("hammond-leslie",  "a vintage tonewheel organ with two manuals on a wooden cabinet alongside a tall rotating speaker cabinet with wooden grille slats"),
    ("vocal-mic",       "a handheld dynamic vocal microphone on a black round-base microphone stand with boom arm, classic spherical mesh grille"),
    ("boom-mic",        "a large-diaphragm condenser microphone in a shock mount on a black boom arm with weighted base"),
    ("di-box",          "a passive direct injection box, small black metal enclosure with input and output jacks and a ground-lift switch"),
    ("monitor-wedge",   "a floor wedge stage monitor speaker, black plastic housing, angled face with metal speaker grille, tilted at 45 degrees facing up and forward"),
    ("side-fill",       "a tall vertical PA stage speaker on a black tripod stand, black housing, large 15-inch driver and horn tweeter visible through grille"),
    ("iem-rack",        "a black 4-rack-unit road case containing wireless in-ear monitor transmitter receivers, antennas visible, blue and red LEDs"),
    ("iem-pack",        "a wireless belt pack receiver with antenna and a pair of in-ear monitor earphones with translucent custom-molded tips and braided cable"),
    ("amp-cabinet",     "a vintage black 4x12 guitar cabinet stack with white piping, black grille cloth showing four 12-inch speakers, classic British rock amp"),
    ("amp-combo",       "a vintage black tube guitar combo amplifier, two 12-inch speakers visible through silver grille cloth, simple top control panel with chrome knobs"),
    ("pedalboard",      "a pedalboard with eight guitar effects pedals of various colors arranged in two rows, patch cables visible, on a black metal board"),
    ("subwoofer",       "a large black PA subwoofer cabinet on the ground, single 18-inch driver visible through a metal grille, simple rectangular box"),
    ("drum-throne",     "a black padded round drum throne stool on a tripod base with height-adjustment pole"),
]

def _read_key():
    if not KEY_PATH.exists():
        sys.exit(f"Missing {KEY_PATH}. Create with: echo 'sk-...' > {KEY_PATH} && chmod 600 {KEY_PATH}")
    return KEY_PATH.read_text().strip()

def _generate_one(api_key, slug, subject):
    prompt = STYLE_FRAME.format(subject=subject)
    body = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": SIZE,
        "quality": QUALITY,
        "background": "transparent",
        "output_format": "png",
    }
    req = urllib.request.Request(
        ENDPOINT,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        data=json.dumps(body).encode("utf-8"),
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    b64 = payload["data"][0]["b64_json"]
    return base64.b64decode(b64)

def main():
    api_key = _read_key()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    total = len(INSTRUMENTS)
    skipped = 0
    generated = 0
    failed = []
    for idx, (slug, subject) in enumerate(INSTRUMENTS, 1):
        out_path = OUTPUT_DIR / f"{slug}.png"
        if out_path.exists() and out_path.stat().st_size > 0:
            print(f"[{idx}/{total}] {slug}: skip (already exists, {out_path.stat().st_size} bytes)")
            skipped += 1
            continue
        try:
            t0 = time.time()
            print(f"[{idx}/{total}] {slug}: generating...")
            png_bytes = _generate_one(api_key, slug, subject)
            out_path.write_bytes(png_bytes)
            print(f"[{idx}/{total}] {slug}: ok ({len(png_bytes)} bytes, {time.time()-t0:.1f}s)")
            generated += 1
        except Exception as e:
            print(f"[{idx}/{total}] {slug}: FAILED — {e}")
            failed.append(slug)
            # keep going; one bad icon shouldn't kill the batch
            time.sleep(2)
    print()
    print(f"Done. generated={generated} skipped={skipped} failed={len(failed)}")
    if failed:
        print(f"Failed slugs (re-run to retry): {', '.join(failed)}")

if __name__ == "__main__":
    main()
