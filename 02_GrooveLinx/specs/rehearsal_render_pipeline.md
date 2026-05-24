# Rehearsal Render Pipeline — Architecture Proposal

**Status:** Proposal · Drafted 2026-05-24
**Author:** Claude (co-authored with Drew during the 5/18 multitrack ingest session)

---

## North star

> GrooveLinx's browser player is for **collaborative review** of rehearsal recordings — playback, annotation, tagging, commenting. It is NOT a DAW. Final mix rendering, mastering, and archival output happen in a **separate server-side pipeline** that the browser can trigger but does not execute.

This separation is **load-bearing**. Conflating the two would push GrooveLinx toward a browser-DAW pattern, which the codebase is not built for and the band's actual workflow doesn't need.

---

## Why the separation

### Browser playback (what we have today)

- 17 independent `<audio>` elements stream FLACs from R2 on demand
- Each element has its own internal clock; tracks drift apart over long playback (mitigated by the soft-correction watchdog shipped 2026-05-24)
- Mute / solo / volume / reverb / mix-presets all happen in Web Audio against the live streams
- **Optimized for:** low memory, fast open, scrubbing, comment-anchored review
- **NOT suitable for:** sample-accurate sync, archival-quality output, mastering

### Server-side render (what this proposal covers)

- The same mix state (volumes, mutes, solos, reverb sends, segment trim flags) is captured as a recipe
- A Modal job downloads the per-track FLACs from R2, applies the recipe via sox/ffmpeg/pydub, renders a single stereo mix
- Output: lossless WAV (or 320 kbps MP3 for sharing) written back to R2 with a public download URL
- **Optimized for:** sample-accurate, archival quality, distributable file
- **Decoupled from:** the playback engine entirely — server doesn't know or care how the browser sounded

### Why two systems, not one

| Concern | Browser playback | Server render |
|---|---|---|
| Memory | Constrained (~4 GB per tab) | Effectively unlimited |
| Sample sync | Best-effort via drift correction | Sample-accurate by definition |
| Latency to first sound | <2 s (streaming) | N/A (pre-rendered) |
| Format flexibility | Whatever browsers decode | Any sox/ffmpeg output |
| Mastering quality | Limited by browser audio chain | Limited only by stems' source quality |
| Audience | Band members reviewing on laptops/phones | Mastering chain (ProTools / Logic / etc.) |

Conflating these forces compromises on both sides. Keeping them separate lets each be excellent at its job.

---

## What ships first — the "Keeper" + ZIP path (already built 2026-05-24)

Before any server-side render exists, the band needs **a way to NOT lose master-quality stems**.

The minimum-viable archive workflow:

1. **⭐ Keeper flag** on a rehearsal session (`multitrack_sessions/{sid}/keeper: true`)
   - Player header has a ⭐ Keeper toggle
   - History cards show a ⭐ marker when flagged
   - **Any future auto-tiering pipeline (Phase D, currently deferred) MUST exempt sessions where keeper === true**
2. **📦 Download stems** button in the player
   - Calls the existing `/multitrack/zip/start` → `/multitrack/zip/check` Modal pipeline
   - Returns a ZIP of the original per-track FLACs (named per the convention)
   - User drags-and-drops the ZIP into ProTools/Logic for mastering

This satisfies the "don't lose a great take" requirement without building the server-side render yet. The render proposal below is the next layer.

---

## Proposed feature: "Export Rehearsal Mix"

**Naming guidance from Drew (2026-05-24):**
> Avoid "Export Master." Prefer musician-friendly language: **Save Mix**, **Share Mix**, **Export Rehearsal Mix**, or **Publish Mix**.

"Master" implies finalized broadcast-ready mastering (with limiting, EQ, multi-band compression), which this pipeline does NOT do. The pipeline produces a stereo mixdown of the per-track stems with the user's mix state applied. Calling it "Export Rehearsal Mix" or "Publish Mix" sets correct expectations.

### Flow

1. In the player, user dials in the mix they want (existing functionality: volumes, mutes, solos, reverb sends, mix presets)
2. User clicks **"📤 Export Rehearsal Mix"** in the transport bar
3. Browser packages the current mix state as a "recipe" JSON:
   ```json
   {
     "sessionId": "abc123",
     "tracks": {
       "01_vocal-drew": { "gain": 1.8, "mute": false, "solo": false, "reverbSend": 1.0 },
       "10_kick-jay":   { "gain": 0.6, "mute": false, "solo": false, "reverbSend": 0.0 },
       ...
     },
     "masterReverbWet": 0.25,
     "outputFormat": "wav",
     "outputName": "deadcetera-2026-05-18-vocal-up-mix.wav"
   }
   ```
4. POST recipe to a new worker endpoint `POST /multitrack/render`
5. Worker forwards to a new Modal job `render_mix`:
   - Pulls each stem from R2 (no client bandwidth cost)
   - Applies per-track gain + mute (skip the entire stem if muted)
   - Applies per-track reverb send (run through a convolver with a known IR)
   - Sums to stereo
   - Applies master reverb wet/dry
   - Renders to WAV or 320 kbps MP3
   - Uploads to R2 under `multitrack/{bandSlug}/{sessionId}/renders/{renderId}.{ext}`
6. Worker returns the public URL when complete
7. Browser shows a small "Mix ready — download" link in the player; one click → file saves locally

### Renders are first-class entities

Stored at `multitrack_sessions/{sid}/renders/{renderId}` with:
```json
{
  "name": "Vocal-up mix",
  "createdAt": "2026-05-24T12:34:56Z",
  "createdBy": "drewmerrill1029@gmail.com",
  "format": "wav",
  "publicUrl": "...",
  "sizeBytes": 250000000,
  "mixRecipe": { ... },
  "durationSec": 11274
}
```

Multiple renders per session. The recipe is stored so the user can REGENERATE the same mix later (or tweak and re-render). The browser surfaces renders as a list under the player ("📁 Renders" panel).

### Output formats

- **WAV 24-bit/48 kHz** — archival, ProTools-ready, large (~2 GB per rehearsal hour)
- **MP3 320 kbps** — shareable, small (~150 MB per rehearsal hour), good for sending to non-musician friends or social media
- **FLAC (lossless)** — middle ground, ~50% smaller than WAV with no quality loss

User picks at export time (UI toggle).

### Cost model

A 3-hour rehearsal render takes ~30s on a small Modal CPU instance. At Modal's pricing (~$0.0001 / CPU-second), each render costs ~$0.003. Even 100 renders/month = $0.30. Negligible.

Storage for rendered files at R2 ($0.015/GB/month):
- WAV 24/48: ~2 GB per render × 1 keeper per week = ~100 GB/year = ~$18/year
- Manageable. Same Keeper rules apply: rendered files of Keeper sessions stay forever; renders of non-Keeper sessions can age out after N days.

---

## Distinction from Phase D auto-tiering

The original `project_multitrack_rehearsal.md` memory proposed Phase D as:
- Drum submix at 7 days
- FLAC → Opus at 90 days

That tiering was about **storage cost optimization** — converting full per-track stems into a cheaper-to-store representation after the user's review window closed.

This proposal **does not replace Phase D** — it complements it:

- **⭐ Keeper sessions:** Phase D MUST NOT touch them. Stems retained forever at original FLAC fidelity. Renders also retained forever.
- **Non-Keeper sessions:** Phase D can tier as planned. Renders of non-Keeper sessions can be aged out separately.
- **Phase D itself remains deferred** until storage growth actually demands it (per the original architecture).

---

## What this proposal explicitly does NOT do

- **No in-browser mastering chain.** No EQ, no compression, no limiter, no spectral analysis in the browser. The browser is review.
- **No live "render preview"** that streams back from Modal as it renders. Too complex for value delivered.
- **No multi-segment mixing** in v1. The render captures one mix state across the entire rehearsal. (Future v2 could let you assign different mix recipes to different detected segments.)
- **No automatic naming or tagging from segmentation results.** User names the export themselves.
- **No "Master" terminology.** This is a mix render for review/archive/sharing — not a broadcast master.

---

## Implementation phases

| Phase | Scope | Effort | When |
|---|---|---|---|
| **R1** | Modal `render_mix` endpoint that takes a stem-URL + recipe and emits WAV/MP3/FLAC | ~3-4 hours | Next session |
| **R2** | Worker `/multitrack/render` route that proxies + auth | ~30 min | With R1 |
| **R3** | Player "📤 Export Rehearsal Mix" button + recipe builder | ~1 hour | With R1+R2 |
| **R4** | Renders list panel in player | ~1-2 hours | After R3, when users have made a few |
| **R5** | Per-segment mix recipes (mix changes during a rehearsal) | ~3-4 hours | Future v2, may never need |

R1+R2+R3 is the MVP — one button, one rendered file, one download. R4 adds discoverability for past renders. R5 is speculative.

---

## Open questions for future sessions

1. **Should renders auto-trigger on save of a mix preset?** Argument for: a saved preset implies the user thinks it's worth keeping. Argument against: render cost (cents per render, but it adds up at scale; also disk space). **Tentative answer:** no auto-render; explicit user click. Mix presets stay cheap and ephemeral; renders are deliberate archival events.

2. **Multi-band roll-out.** When other bands onboard, each gets their own R2 paths (already band-slug-prefixed). The render pipeline scales horizontally trivially (Modal spawns parallel instances). No architectural blockers.

3. **Direct-to-streaming-platform export?** (e.g., upload directly to SoundCloud, BandLab, etc.) Out of scope for v1, but the WAV/MP3 file the user gets is what they'd upload manually.

4. **Render queue UI.** If multiple renders are pending, do we show a queue? For v1, render is fast enough (~30s for 3-hour rehearsal) that a single inline progress bar is sufficient. Queue panel becomes worth building if the band starts batch-rendering multiple takes.

---

## Related work

- **`02_GrooveLinx/specs/multitrack_reaper_export_checklist.md`** — REAPER pipeline that produces the per-track FLACs (upstream of this proposal)
- **`memory/project_multitrack_rehearsal.md`** — original architecture, Phase D auto-tiering plan (still deferred)
- **`memory/project_x32_reaper_ingest_empirical.md`** — empirical walkthrough of the X32 → REAPER → GrooveLinx ingest
- **`services/multitrack-zip/`** — existing Modal service for ZIP packaging (the path the ⭐ Keeper + 📦 Download buttons use today)
- **Build `20260524-151343`** — ships the ⭐ Keeper flag + 📦 Download stems buttons (the MVP archive path described above)

---

## TL;DR

- **Browser = review tool.** Always will be. No DAW features.
- **Server-side render = the way to produce archive-quality mixes.** Deferred until R1 ships next session.
- **⭐ Keeper flag bridges the gap today.** No render needed to preserve master-quality stems — Keeper marks the session for forever-retention, and 📦 Download lets the user grab the original FLACs into ProTools any time.
- **Naming:** "Export Rehearsal Mix" or "Publish Mix" — never "Master."
