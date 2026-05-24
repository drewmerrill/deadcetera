# Multitrack Browser Playback Audit — 17 Stems × 3-Hour Rehearsal

**Date:** 2026-05-24
**Build under test:** `20260524-160224` (last commit `50a36ec3`)
**Status:** Analysis only — no code change in this pass.
**Author:** Claude (multitrack audit, follow-up to Bug #17 close-out)

---

## 1. TL;DR

- **The current architecture can't be patched to meet the requirements.** Three browser-only attempts in one session already failed in three different ways.
- **The dominant failure mode is network-induced**, not codec or clock related: Chromium caps **6 simultaneous connections per origin**, the player opens **17**. On a far seek, range requests serialize into ~3 waves of buffer fills, and the late waves get audibly out-of-phase with the early ones.
- **HTML5 `<audio>` clocks drift independently** because each element has its own buffer pipeline. MediaElementAudioSourceNode does not solve this — it inherits the element's clock.
- **The source files are sample-aligned**; this is not a file-integrity bug. (Verify via a one-time `ffprobe` script — script proposed below.)
- **Recommended path is the existing render-pipeline proposal** (`specs/rehearsal_render_pipeline.md`), shipped to single-stream playback. Option G in §6.
- **The interim safe improvements** are: a UX-only "Drift expected on long sessions" hint, a hard limit on how many seeks can be in flight at once, and an `ffprobe` audit script. No more sync-loop iteration in the browser.

---

## 2. Current architecture inventory

### 2.1 Pipeline (end-to-end)

```
X32 → X-LIVE multiplexed WAV (sample-locked at source)
  → REAPER "Entire project" render (FLAC 24-bit/48 kHz, one file per channel)
  → Drop on /multitrack/upload-url (worker.js:1852) → presigned PUT → R2
  → R2 public URL via STEMS_R2_PUBLIC_BASE
  → 17 × <audio preload="metadata" crossorigin="anonymous" src="…flac">
  → MediaElementAudioSourceNode → trackGain → masterDry → destination
                                            → reverbSend → convolver → reverbWet
```

### 2.2 Source files (per `specs/multitrack_reaper_export_checklist.md`)

- **Format:** FLAC, 24-bit, 48 kHz, mono per channel (stereo pair only for keys L/R).
- **Count:** 17 active channels for Deadcetera (vocals × 4, guitars × 2, bass, percussion × 7, OH × 2, keys × 2). Track 08 reserved (muted in REAPER export).
- **Duration:** identical across all channels because REAPER "Entire project" bounds preserve sample-alignment of the X-LIVE multiplex source. (Assumption — verify with ffprobe; see §4.)
- **Codec delay:** FLAC has **no encoder/decoder delay** (unlike MP3's ~26 ms or AAC's ~21 ms). No leading-silence padding.
- **Typical sizes:** mono FLAC 24/48 ≈ 700–1100 kbps. A 3-hour file is **~1.0–1.5 GB per stem, ~17–25 GB per session**.

### 2.3 Browser code surface

**Module:** `js/features/multitrack-rehearsal.js` (~3,123 LOC).

| Concern | Function | Notes |
|---|---|---|
| Audio element creation | inline at `:1101` | one `<audio preload="metadata" crossorigin="anonymous">` per track inside the player overlay |
| Web Audio graph init | `_mtInitWebAudio` `:1419` | created lazily on first ▶ click (autoplay-policy). One `MediaElementAudioSourceNode` per element |
| Mute/solo | `_mtApplyMuteSolo` `:1397` | uses `audio.muted` (pre-graph), so the GainNode sees the same signal but the speakers don't |
| Volume | `_mtSetTrackVolume` (via `:1508`) | `setTargetAtTime` ramp on the per-track GainNode |
| Master reverb | `_mtSetReverbWet` (around `:1755`) | wet GainNode + synthesized impulse response |
| Play all | `_mtTogglePlayAll` `:1323` | snap all to `audios[0].currentTime`, then `.play()` on each |
| **Seek** | `_mtSeekMaster` `:2176` | THIS is where the bug lives — see §3 |
| Skip ±N s | `_mtSkipBy` `:2363` | computes ref off `_mtCurrentPlayheadSec`, writes to all 17 |
| Manual re-sync | `_mtResyncAll` `:2494` | median playhead, writes to all 17 + resets playbackRate=1.0 |
| Median playhead | `_mtCurrentPlayheadSec` `:2535` | tolerates one stuck/un-ready track |
| Drift watchdog | `_mtStartSyncWatchdog` `:2428` | **intentional no-op** — both prior strategies (hard-snap + soft rate adjust) produced audible glitches and were removed |
| Close | `_mtClosePlayer` `:1302` | pauses all, blanks `audio.src`, closes `AudioContext` |

### 2.4 Storage / delivery (per `worker.js`)

- R2 bucket: `groovelinx-stems`, prefix `multitrack/{bandSlug}/{sessionId}/`.
- Public URL via `STEMS_R2_PUBLIC_BASE` — single origin for all 17 stems.
- R2 serves HTTP `Range:` requests natively. No CloudFront, no edge cache in front of it currently as far as the worker shows.
- The worker does **not** front-proxy stem downloads — the browser fetches the public URL directly.

### 2.5 What the user gets today (working surfaces — preserve in any rewrite)

- ⭐ **Keeper** flag (`:1116`) — flags session for forever-retention.
- 📦 **Stems** download (`:1119`) — kicks the existing `/multitrack/zip` pipeline.
- 🧹 **Clear all** mix reset (`:1145` / `_mtClearAllMix` `:2437`) — works.
- 🔄 **Re-sync** (`:1147` / `_mtResyncAll` `:2494`) — manual escape hatch. Works.
- 2-row transport bar with full-width seek (`:1126`) — works.
- Per-track 💧 reverb send, master 💧 wet knob, mix presets, comment system, segment markers — all unrelated to the sync bug and all work.

---

## 3. Drift diagnosis — what causes audible drift

Of the candidate causes listed in the audit scope, here is which apply and which don't.

### 3.1 Operative causes (the real ones)

**1. Browser connection-pool limit (DOMINANT)**

Chromium / Edge cap 6 simultaneous TCP/HTTP connections per origin. Firefox caps 6 as well. Safari caps at 6 per origin for HTTP/1.1 (more permissive on HTTP/2 if R2 negotiates h2 — verify). With 17 stems on the same origin, **at most 6 range requests are flying at once; the other 11 wait**. On a far seek this serializes into ~3 waves of buffer-fill, each wave is ~5–10 s on a multi-GB FLAC. Tail-of-wave-3 lands ~20–30 s after the seek. This matches Drew's empirical reports exactly ("30 seconds to start at 98:50").

**HTTP/2 / HTTP/3 would NOT save this** unless R2 also serves all stems multiplexed on one connection. R2 may or may not negotiate h2 — worth verifying via curl, but even if it does, the per-stream window-size negotiation often causes head-of-line blocking on FLAC frame fetches. h2 isn't a magic bullet here.

**2. Independent HTMLAudioElement clocks**

Each `<audio>` element has its own buffer queue + decode pipeline. They all output to the same hardware clock (the system audio device), but their `currentTime` advances based on *what they've already played back*, which depends on *how full their buffer is*. If even one element stalls briefly to refill (range request stuck behind the 6-connection cap), its `currentTime` pauses while the others advance. The element auto-resumes when its buffer fills — and it resumes **at its own `currentTime`, not the master's**. By the time external catch-up handlers fire `canplay`, the element has already started playing the wrong samples.

`MediaElementAudioSourceNode` does **not** rescue this. It pipes whatever the element decodes into the Web Audio graph as a passthrough; it can't reach into the element's clock.

**3. `canplay` fires prematurely on streaming FLAC**

Chrome fires `canplay` (readyState >= 3 = HAVE_FUTURE_DATA) when the buffer has *some* data — not necessarily enough at the seek target. On a far seek, this means the catch-up handler can fire, the latecomer plays for ~200 ms, then re-stalls to fetch more. The re-stall fires another range request → behind the connection cap again → more drift.

**4. Concurrent-seek races**

The current `_seekToken` guard in `_mtSeekMaster` prevents stale handlers from firing, but it does NOT throttle the user. If Drew scrubs three times in 2 seconds while the first seek is still buffering, all three seek epochs are racing — only the most recent's catch-up handlers will run, but the prior two have already issued 17 range requests each. The R2 connection queue is backed up with 34 obsolete range requests fighting the 17 the user actually wants.

### 3.2 Non-causes (ruled out)

- **Different file durations** — REAPER "Entire project" bounds guarantees identical sample-counts across stems. (Verify in §4.)
- **Sample-rate mismatch** — REAPER preset locks 48 kHz across all stems. (Verify in §4.)
- **Channel-count mismatch** — mostly mono, with stereo only on declared L/R pairs. Web Audio handles mixed channel counts cleanly.
- **Encoder padding / leading silence** — FLAC has none. (Unlike MP3/AAC.)
- **VBR duration estimation** — FLAC stores exact sample count in STREAMINFO header. Duration is known immediately on metadata load.
- **CORS / range-request blocking** — works correctly per `crossorigin="anonymous"` + R2 CORS policy. If CORS were broken, Web Audio would output silence (per spec); audio plays, so CORS is fine.
- **Browser `currentTime` precision** — reported at ~10–250 ms granularity, which is jitter, not drift. (Note: this is why the soft-rate-correction watchdog failed — it was acting on phantom drift.)
- **Manual watchdog snapping** — disabled. Not a current cause.

### 3.3 Why this is structural

You have:
- N=17 independent decoders
- 1 shared connection pool of size 6
- 1 user who wants to seek across a 3-hour timeline
- 17 multi-GB files

The math doesn't work even if every code path is perfect. Sample-accurate cross-stream sync requires either **one source-of-truth clock** (Web Audio's `AudioContext.currentTime`, driving all decoded samples) **or** **one stream** (where there's no cross-stream sync problem to solve). The current architecture has neither.

---

## 4. File-integrity audit — proposed script

The audit needs to confirm that the 17 stems are actually sample-aligned at source. Code says they should be (REAPER "Entire project" bounds × FLAC's zero codec delay), but we have no empirical confirmation.

**Proposed check** (proposal only — don't run without Drew's OK):

```bash
# Run against a downloaded session ZIP (📦 Stems button output)
unzip session.zip -d /tmp/mt-audit
cd /tmp/mt-audit

# 1. All same duration? (sample-counted via ffprobe; FLAC stores exact count)
for f in *.flac; do
  printf '%-30s  ' "$f"
  ffprobe -v error -select_streams a:0 \
    -show_entries stream=duration,sample_rate,channels,bits_per_raw_sample,nb_samples \
    -of default=noprint_wrappers=1 "$f"
  echo
done | tee /tmp/mt-audit/probe.txt

# 2. Any padding/encoder delay? (FLAC: should be 0)
for f in *.flac; do
  metaflac --show-vendor-tag --show-md5sum --show-total-samples "$f" | \
    awk -v fn="$f" '{print fn ":", $0}'
done

# 3. Cross-correlate to detect sub-sample offsets between two stems
# (only run if step 1 shows duration parity but drift is suspected at the file level)
# Requires sox.
sox 01_vocal-drew.flac -t raw -r 48000 -c 1 -e signed-integer -b 16 - | head -c $((48000*60*2)) > /tmp/drew_first_minute.raw
sox 10_kick-jay.flac   -t raw -r 48000 -c 1 -e signed-integer -b 16 - | head -c $((48000*60*2)) > /tmp/kick_first_minute.raw
# Then cross-correlate in Python:
# import numpy as np; from scipy.signal import correlate
# ... peak of correlation tells you the sub-sample offset between the two stems
```

**Expected result:** identical `duration`, `nb_samples`, `sample_rate=48000`, `bits_per_raw_sample=24`; cross-correlation peak at offset 0.

If any of those fail, the upstream REAPER export is producing misaligned stems and the fix is in REAPER, not in the player. **Until this script runs, the file-integrity assumption is theoretical, not empirical.**

Drew's call: do we add this to the multitrack-zip Modal service as a `verify_alignment` endpoint that runs once per upload? Cost is trivial (~1 min CPU); value is high (would catch a REAPER misconfiguration before it becomes a multi-week mystery later).

---

## 5. Seek performance audit (deep dive)

**Scenario:** user is at 0:00, scrubs slider to 140:00.

**What happens, step by step:**

1. `onchange` fires `_mtSeekMaster` (oninput is preview only — no audio writes — correct).
2. `_mtSeekMaster` pauses all 17 elements, writes `audio.currentTime = 8400` to all 17.
3. Each element issues a fresh `Range: bytes=…-…` request to R2 for the bytes near sample 8400 × 48000 = 403,200,000 samples in.
4. **FLAC seek is NOT byte-O(1).** A FLAC stream without a SEEKTABLE block (REAPER default) requires the decoder to binary-search frames to find the target sample. Chrome does this internally, but each step of the binary search is **another range request**. For a 1.5 GB file, that's ~30 random small range fetches before the decoder lands on the target frame.
5. **17 streams × ~30 small range fetches = ~500 HTTP requests**, all queued behind a 6-connection-per-origin gate.
6. The first 6 progress; the other 11 wait. Once the first 6 land their target frame, they request the next ~1 MB of frames ahead (preroll), which makes them `readyState >= 3` (`canplay`). They fire `canplay` and the catch-up handler runs.
7. Meanwhile the 11 still-waiting stems are mid-binary-search. They will fire `canplay` over the next ~20–30 s in staggered order.
8. The 20s fallback in `_mtSeekMaster` (`:2338`) fires "no track buffered in 20s — starting anyway", at which point any element still waiting joins the playback group with whatever data it has — usually too little — and the auto-resume semantics put it at the wrong position.

**Conclusion:** the seek path is doing the worst-case behavior. Caching helps subsequent seeks back to the same region, but does not help the first seek to any new region.

### 5.1 Mitigations that wouldn't actually save it

- **Adding a SEEKTABLE to each FLAC** would reduce step 4 from ~30 range fetches to ~2. Net: maybe 5–10 s saved on a 30 s seek. Doesn't fix the architecture. (Mention only as a one-line REAPER post-export step worth doing anyway — `metaflac --add-seekpoint=…`.)
- **Pre-emptive `audio.load()`** doesn't help; that re-fetches metadata, not media data.
- **Different audio container (Opus/Ogg)** would have better seek granularity but doesn't fix the 17-streams-on-6-connections problem.

### 5.2 Mitigations that would actually save it

- **Single stream** (option B/G in §6) — one Range request, no head-of-line blocking, sub-second seek.
- **HTTP/3 with stream multiplexing across all 17** if R2 supports it AND the browser opens a single multiplexed connection. (Worth measuring but not betting on.)
- **A CDN range-request edge cache** in front of R2 with R2 itself promoted to a multiplexed origin — adds complexity, partial improvement.

---

## 6. Architecture options matrix

Evaluated against the actual requirement set: 17 stems, 3 hours, browser, no audible drift, no glitches, fast seek, stable for review/annotation, practical path to mix/export.

| Option | Sync quality | Seek speed | Browser memory | Engineering complexity | UX | Recommended? |
|---|---|---|---|---|---|---|
| **A. Current 17-stream HTMLAudio + soft drift correction** | Bad on long sessions / far seeks. Best case: ~50–100 ms drift over a song. Worst case (Drew, 2026-05-24): permanent drift + 30 s seek tail | 5–30 s on far seeks. Permanent issue on multi-GB FLAC | Low (~50–200 MB streaming) | Already built; further iteration has hit diminishing returns (3 failed patches in one session) | Bad for review past the first song | **No** |
| **B. Single stereo proxy mix for review; stem controls disabled** | Sample-accurate (single stream) | <1 s | Low (~20 MB) | Trivial — already proven via the existing zipper Modal service | Loses per-track mute/solo/volume. Pure "listen back" only | **Partial yes — as default mode** |
| **C. Pre-rendered submixes (drums grouped, vocals grouped, etc → 4–6 streams)** | Inter-submix drift still possible but with 4–6 streams the 6-connection cap is no longer the choke | 2–5 s | Low | Adds a render step on ingest, plus submix recipe config. ~1 day of work | Some isolation lost (can mute "drums" but not "kick alone") | No — worse than G with no real upside |
| **D. Chunked aligned audio segments (HLS/DASH-style)** | Same per-stem drift inside a chunk + chunk-boundary clicks risk. Sample-accurate only with MSE+manual frame appending | 1–3 s (chunk-aligned seek) | Medium | High — chunk pre-generation pipeline + MSE plumbing. ~2 weeks min | Reasonable, but engineering cost is heavy | No |
| **E. Web Audio AudioBufferSourceNode (full decode)** | Sample-accurate (one AudioContext clock) | <100 ms | **Infeasible** — 3h × 17 × 24-bit/48 kHz = ~22 GB decoded. Browser tab cap is ~4 GB | n/a | Sample-accurate but only on segments | **No — but viable for short windowed playback (see Hybrid)** |
| **F. AudioWorklet + MediaSource + manual FLAC decoding** | Sample-accurate possible | 1–2 s with smart prefetch | Medium with careful windowing | **Very high — this is building a browser DAW engine.** ~3+ weeks. Violates Drew's "no browser DAW" rule (`feedback_workbench_no_new_destinations`) | Best technical sync, but wrong product fit | **No — explicitly forbidden by product direction** |
| **G. Server-side rendered mix + browser plays the single rendered stream** | Sample-accurate (single stream) | <1 s | Low | Low — the infrastructure exists. Modal already has `groovelinx-stems` secret + boto3 + R2 read/write (see `services/multitrack-zip/zipper.py`). New Modal function + worker route + UI button. **~5 hours per `specs/rehearsal_render_pipeline.md` R1–R3.** | Loses live per-track mute/solo (must re-render). User keeps the rendered file forever (good) | **Yes — this is the recommended path** |
| **H. WaveSurfer / waveform-only timeline** | n/a (visualization only) | n/a | Low | Low if dropped onto G/B | Great for seek scrubbing UX — useful **complement** to G, not a replacement | Yes as a UI complement |

---

## 7. Recommended architecture

**Primary path: G (server-side render) + B (single-stream playback as default) + A (preserved as an "Isolate stems" power-user mode).**

The proposal at `02_GrooveLinx/specs/rehearsal_render_pipeline.md` already lays out R1/R2/R3. Re-reading that against the audit findings: **it's the right call.** This audit confirms the proposal's premise.

### 7.1 The user experience after this change

| Mode | What it is | When the user uses it |
|---|---|---|
| **Review mode (default)** | One pre-rendered stereo mix streams from R2. Plays through one `<audio>` element. Sample-accurate, fast seek, no drift possible | The 99% case — listen back, comment, annotate, share |
| **Isolate stems (opt-in)** | Today's 17-stream player, behind a "🎚 Isolate stems" toggle. Comes with an honest banner: "Browser per-track playback drifts on long sessions and is slow to seek across hours. Use for short A/B comparisons; switch to Review for full-session playback" | Short A/B: "is this the kick? listen to just kick + snare for 30 seconds" |
| **Export Mix** | Mix recipe → server render → WAV/MP3/FLAC download | Saving a finished mix, sending to bandmates, archiving |

### 7.2 What changes in the code

The Bug #17 next-session restart prompt has it right:

- **R1 (Modal `render_mix`)** — clone `services/multitrack-zip/zipper.py` patterns. Same `groovelinx-stems` secret. Pull each stem from R2 via boto3, mix with `sox` or `ffmpeg`, write back to R2. ~3–4 hours.
- **R2 (worker route `/multitrack/render`)** — clone the `/multitrack/zip/start` + `/check` async pattern (`worker.js:2097`+). ~30 min.
- **R3 (player "📤 Export Rehearsal Mix" button)** — recipe builder + POST + poll. ~1 hour.

Once R1–R3 exist, the player has two playback modes:
- **Default:** if a `mix_default` render exists for the session, play it from one `<audio>` element.
- **Isolate stems toggle:** the current 17-stream UI, with the honest banner.

**The first time a user opens a session that has no render yet, auto-trigger the render in the background** (~30–60 s for a 3-hour session per the proposal). Show a "Preparing review mix…" state. As soon as the render lands, the player switches to single-stream playback automatically. The 17-stream mode remains the fallback during the render wait — but the user doesn't need to be in that fallback to do useful work; commenting, annotation, segment marker placement all work regardless.

### 7.3 What about the per-track mix the user dials in?

Today the user dials in volume + mute + solo + reverb sends per track. Under G, those become the **mix recipe** — when they hit Save, the recipe is the input to a fresh render. After the render lands (~30 s), playback switches to it.

This loses the "live tweak while playing" capability for the 17-stream → render workflow. **That tradeoff is correct** for >99% of the use case: most users dial in a mix once, then listen. Power users who want to tweak interactively can flip into Isolate-stems mode for the tweak phase, then export the final.

### 7.4 What we are NOT building

- No in-browser mastering chain.
- No live "render preview" streaming back from Modal as it renders.
- No multi-segment mixing (mix-A for first 30 min, mix-B for next 30 min) in v1.
- No automatic Master / EQ / limiter.
- No "browser DAW" — confirmed forbidden by `feedback_workbench_no_new_destinations`.

---

## 8. Immediate safe next-fix (separate from the strategic path)

Even with R1–R3 weeks away, there are three small interim improvements that don't risk regression and don't masquerade as the final architecture:

### 8.1 ✋ Set expectations (UX-only — no code-flow change)

In the player header, when the duration is over 30 min, render a one-line dim banner:

> ℹ️ Long-session playback may drift after far seeks. Use 🔄 Re-sync if tracks slip. Export Rehearsal Mix (coming soon) will fix this.

Total cost: ~5 LOC. Removes the surprise factor and points the user at the existing escape hatch.

### 8.2 🔒 Throttle concurrent seeks

`_mtSeekMaster` already has a `_seekToken` guard, but the user can still issue rapid scrubs. Add: if a seek is in progress and another `_mtSeekMaster` call arrives within 750 ms, ignore it (debounce on the leading edge — apply the latest pending value when the active seek completes).

This is ~15 LOC, contained to `_mtSeekMaster`, and would have helped Drew's "scrubbed during slow buffer" case. Low risk because we already have `_seekToken` infrastructure.

### 8.3 🔬 Run the ffprobe audit once

Per §4. Run it once against a known-good session's `📦 Stems` ZIP. Confirms the file-integrity assumption is true today. If it's false, that's a separate, unrelated bug to file in `bug_queue.md`. **Don't ship a `verify_alignment` Modal endpoint yet** — first prove it's needed by running the script manually.

### 8.4 What NOT to do in the interim

- ❌ Re-introduce a drift watchdog. Both versions (hard-snap + soft-rate) failed audibly. Don't re-add without architectural change.
- ❌ Pre-decode FLACs to memory. ~22 GB exceeds tab memory.
- ❌ Add a SEEKTABLE to every FLAC. Modest win, doesn't fix the architecture, ages out as soon as we move to G.
- ❌ Switch to MP3/Opus container. Lossy + doesn't fix architecture.

---

## 9. What this audit changes about the existing proposal

`specs/rehearsal_render_pipeline.md` was written **before** the empirical confirmation that the 17-stream architecture fails. This audit upgrades the proposal's status:

| Before audit | After audit |
|---|---|
| Proposal status: "Drafted, deferred until storage growth demands it" | Status: **Recommended next architectural work item**. The audit finds no other viable path. |
| Phase R1–R5 framed as future enhancement | R1–R3 framed as the next-session deliverable; R4 follows when there are enough renders to warrant a list panel |
| 17-stream player framed as the primary playback path | 17-stream player demoted to "Isolate stems" power-user toggle; rendered mix becomes the default |
| Open question 1: "Should renders auto-trigger on save of a mix preset?" | **Stronger recommendation: auto-trigger on session open** when no render exists yet. Eliminates the per-session "prepare mix" friction |

No conflict with the proposal — this audit just promotes it from "deferred" to "next."

---

## 10. Verification plan (when R1–R3 ship)

When the next session ships R1–R3, the way to know it actually works:

1. Open a 3-hour session that has never been rendered. Expect ~30–60 s "Preparing review mix…" then auto-switch to single-stream playback.
2. Seek to 0:00, 30:00, 60:00, 90:00, 120:00, 170:00 in random order. Each seek lands in <1 s.
3. Play continuously from 0:00 to 5:00. No drift (single stream — drift is structurally impossible).
4. Flip Isolate-stems toggle. Expect 17-stream player with the honest banner.
5. Adjust mute/solo/volume in Isolate-stems mode. Click "Export Rehearsal Mix." Recipe POST → ~30 s wait → new render available → download link surfaces.
6. Close player, re-open. Default mode plays the most recent render (or the original `mix_default`).

---

## 11. Files referenced

- `js/features/multitrack-rehearsal.js` — current player, line numbers in §2.3
- `worker.js` — multitrack routes at `:1810`+ and `:2097`+
- `services/multitrack-zip/zipper.py` — existing Modal infrastructure pattern to clone for R1
- `02_GrooveLinx/specs/rehearsal_render_pipeline.md` — the proposal this audit promotes to "next"
- `02_GrooveLinx/specs/multitrack_reaper_export_checklist.md` — REAPER export pipeline, source-alignment guarantee lives here
- `02_GrooveLinx/uat/bug_queue.md` — Bug #17 full diagnosis
- `memory/project_multitrack_seek_sync_bug.md` — Bug #17 architectural memory
- `memory/feedback_workbench_no_new_destinations.md` — Drew's "browser = review, server = render" rule

---

## 12. Decision needed from Drew

Before next session builds R1:

1. **Confirm the audit's recommendation** — single-stream rendered mix as default playback, 17-stream as opt-in. (Yes/no.)
2. **Confirm auto-render on session open** — when a session has no render yet, kick off Modal render automatically in the background. Cost ~$0.003/session per the proposal. (Yes/no.)
3. **Confirm interim improvements §8.1 + §8.2 are safe to ship in this session** even though they're tiny — they're additive, don't touch SYSTEM LOCK paths, and don't pre-empt R1–R3. (Yes/no.)
4. **Run the ffprobe audit** against the 5/18 session ZIP? If yes, Drew runs the script locally (it needs the downloaded FLACs) and pastes the output. ~5 min of work. (Yes/no.)
