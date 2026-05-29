# Playback Stabilization Investigation — 2026-05-29

**Problem:** iPhone CarPlay using the GrooveLinx PWA, playing a 3-hour rehearsal recording, audio glitches approximately once every second. Pattern is rhythmic and repeatable, not random buffering.

**Scope:** Investigation only. No code changes. No fixes applied.

**Auxiliary issue covered below:** Pierce's one-song stem ZIP produced 3-hour-long FLAC files (with 6 minutes of audio + 2h54m of nothing) that his DAW could not handle.

---

## Executive summary

The most likely cause of the ~1 Hz rhythmic glitch is a **500 ms `setInterval` (`_timeTicker`) clamped by iOS PWA background throttling to roughly 1 Hz when the screen is off / CarPlay is the foreground**, combined with a `timeupdate` handler that performs DOM mutations on every segment row and triggers `scrollIntoView({behavior: 'smooth'})` on transitions. Both pipelines mutate DOM while iOS is trying to keep audio decoding atomic on a single thread.

The Pierce stems issue has a separate root cause: `ffmpeg -c copy` on FLAC does not rewrite the STREAMINFO `total_samples` field, so DAWs read the source's original sample count and see the file as the full rehearsal length even though only the song's frames are present.

---

## 1. Timers running during playback

### Active during steady-state Review Mode playback

| Timer | Cadence | File:line | What it does |
|---|---|---|---|
| `_mtState.player._timeTicker` (Review Mode wiring path A) | 500 ms | `multitrack-rehearsal.js:1831` | Updates `#mtComposerTime` text; calls `_mtHighlightActiveComment` |
| `_mtState.player._timeTicker` (Review Mode wiring path B) | 500 ms | `multitrack-rehearsal.js:2202` | Same callback as path A; identical interval, separately wired |

**Note on the duplication:** there are **two distinct `_timeTicker` setIntervals registered at different code paths** (lines 1831 and 2202). Each path checks `if (p._timeTicker) clearInterval(p._timeTicker)` before assigning, so a single open session should only ever have one running — but if both initialization paths fire during the same player open (e.g. Review Mode opened after Isolate Mode), there is a race window where the new interval is assigned before the old reference is cleared.

### Active only during specific phases (NOT during steady playback)

| Timer | Cadence | File:line | When it runs |
|---|---|---|---|
| `progressTimer` | 500 ms | `multitrack-rehearsal.js:8164` | Only during Play-start sequence; clears once all tracks started |
| `bufferTick` | 250 ms | `multitrack-rehearsal.js:8208` | Only while waiting for first track `canplay`; clears on first ready |
| `initialWaitTimer` (`setTimeout`) | 20 s once | `multitrack-rehearsal.js:8219` | Fallback if no track reports ready; cleared on `canplay` |
| `p._holdTimer` | 200 ms | `multitrack-rehearsal.js:8268` | Only while user holds a skip button |
| `_renderInFlight` Firebase poller | variable | `multitrack-rehearsal.js:2237` | Only while a Custom Mix render is in-flight |
| `_rhTimer.tick` | 500 ms | `rehearsal.js:8157` | Only while the rehearsal-session clock is started |

### Background timers running app-wide (not playback-specific)

| Timer | Cadence | File:line | Note |
|---|---|---|---|
| Band-feed auto-refresh | 5 min | `band-feed.js:2392` | Only when band-feed view is mounted |
| Feed metrics flush | 5 min | `feed-metrics.js:198` | App-wide |
| Avatar `_checkPageChange` | 10 s | `gl-avatar-ui.js:484` | App-wide; touches DOM lightly |
| Avatar `_checkFlowBreaks` | 30 s | `avatar_feedback_service.js:191` | App-wide |
| Avatar cluster-tips refresh | 5 min | `gl-avatar-guide.js:409` | App-wide |
| Band-sync leader heartbeat | 12 s | `gl-leader.js:145` | Only if active band-sync session as leader; Firebase write per tick |

### Animation frames (requestAnimationFrame)

No `requestAnimationFrame` chains are active during steady-state Review Mode playback. All `rAF` usage is one-shot for scroll/paint scheduling (`songs.js`, `live-gig.js`, `band-feed.js` etc.) and does not loop during playback.

The `live-gig.js:_lgScrollFrame` chain (line 1126) is a continuous `rAF` loop but only runs inside Live Gig Mode, not Review Mode.

---

## 2. Audio listeners firing during playback

### Review Mode `<audio>` element

Located at `multitrack-rehearsal.js:2132–2141` (single-stream Review Mode) and `multitrack-rehearsal.js:1842–1851` (Isolate Mode, multi-stream).

| Event | Handler | What it does |
|---|---|---|
| `loadedmetadata` | inline | `_mtMaybeUpdateDuration()` + `_mtRenderSeekMarkers()` — one-shot at load |
| `timeupdate` | `_mtMaybeUpdateMasterPosition` | **Fires 4–25 Hz on most browsers; on iOS Safari backgrounded, throttled to ~1 Hz.** See §3 below for what this handler does. |
| `ended` | inline | Sets `masterPlaying = false`; flips play button label |

### Other audio listeners registered elsewhere

These are registered but NOT firing during a steady-state Review Mode session:

| File:line | Audio | When |
|---|---|---|
| `recording-analyzer.js:1978` | RecordingAnalyzer playback audio | Only inside the legacy Recording Analyzer surface |
| `harmony-lab.js:644/658/661` | Harmony Lab master | Only inside Harmony Lab |
| `song-detail.js:4828/4847/4852` | Song detail player | Only when Song detail audio is active |
| `rehearsal.js:3944/4440/6081/6829` | Various rehearsal-mode players | Only inside Rehearsal-Mode flows |
| `bestshot.js:1518` | Best Shot upload audio | Only when uploading Best Shot |

---

## 3. Operations executed at playback rate

### Per `timeupdate` (4–25 Hz foregrounded; ~1 Hz iOS background)

`_mtMaybeUpdateMasterPosition` (`multitrack-rehearsal.js:8447`) does the following on every call:

1. `_mtCurrentPlayheadSec()` — reads `audio.currentTime` from the audio element.
2. Loop-wrap check: if a single-tap loop is set and the playhead crossed `endSec`, sets `currentTime = startSec`.
3. `document.getElementById('mtMasterSeek')` — reads seek slider element.
4. **Writes** `seek.value = pct` if the slider is not currently focused.
5. `document.getElementById('mtTimeLabel')` — reads time label element.
6. **Writes** the formatted time label text content.
7. Calls `_mtUpdateActiveSegmentHighlight()`:
   - `document.querySelectorAll('#mtSegmentsList [data-seg-idx]')` — re-queries ALL segment rows every tick.
   - Iterates `p.segments` linearly (up to 380 entries on 5/27).
   - Iterates `rows` (every segment row, often 50–200 visible).
   - **Sets `row.style.outline` on EVERY row** even when the value didn't change (no diff check).
   - **Sets `row.style.outlineOffset` on EVERY row** even when unchanged.
   - On segment transition only: `activeRow.scrollIntoView({behavior: 'smooth'})` — **smooth scroll animation on the main thread**.
   - On segment transition only: calls `_mtUpdateNowReviewingLabel` (cheap DOM text write).

### Per `_timeTicker` interval (500 ms foregrounded; ~1 Hz iOS background)

The callback registered at `multitrack-rehearsal.js:1831` / `:2202`:

1. `_mtCurrentPlayhead()` — reads playhead time.
2. `document.getElementById('mtComposerTime')` — DOM query.
3. **Writes** composer time `textContent` if present.
4. Calls `_mtHighlightActiveComment()`:
   - `document.querySelectorAll('.mt-comment-row')` — re-queries ALL comment rows every tick.
   - Iterates rows linearly, parsing `dataset.commentTime` to float for each.
   - **Adds/removes `.mt-comment-active` class on rows** even when they didn't change category.
   - **Sets / clears `style.background`, `style.borderLeft`, `style.paddingLeft`** on multiple rows per tick.
   - On comment transition: `activeRow.scrollIntoView({behavior: 'smooth'})` when `masterPlaying` — **second smooth scroll animation** stacked on top of the segment-row scroll.

### Operations occurring every frame (none in steady playback)

No `requestAnimationFrame` is active during steady-state Review Mode. The smooth scroll triggered inside the `timeupdate` and `_timeTicker` handlers spawns its own internal rAF inside Safari's scroll subsystem but it is not user code.

### Operations occurring every second

Inside the iOS background-throttled regime: the `_timeTicker` callback AND a `timeupdate` callback per ~1 s. Both touch DOM. Both can trigger smooth scrolls on transitions. Both can co-occur within the same frame.

### Operations occurring on every `timeupdate` event

Per §3 above — six DOM reads/writes plus a full `_mtUpdateActiveSegmentHighlight` pass touching every visible segment row.

---

## 4. Operations grouped by frequency on iOS PWA backgrounded

Under CarPlay (page is hidden, audio plays, `setInterval` throttled to 1 Hz minimum, `timeupdate` fires at ~1 Hz):

| Frequency | Operation | Cost |
|---|---|---|
| ~1 Hz | `timeupdate` → `_mtMaybeUpdateMasterPosition` → `_mtUpdateActiveSegmentHighlight` | High — `querySelectorAll`, linear scan, style mutations on every row |
| ~1 Hz | `_timeTicker` callback → `_mtHighlightActiveComment` | High — same pattern on comment rows |
| ~1 Hz (transitions) | Smooth `scrollIntoView` for active segment row | High — synchronous-looking layout pass that iOS Safari often serializes onto the main thread |
| ~1 Hz (transitions) | Smooth `scrollIntoView` for active comment row | High — second scroll, stackable with the segment scroll on the same tick |
| 30 s | Avatar `_checkFlowBreaks` | Low |
| 10 s | Avatar `_checkPageChange` | Low |
| 12 s | Band-sync leader heartbeat (only if active) | Low + Firebase write |
| 5 min | Feed metrics flush, band-feed refresh, avatar cluster-tips | Negligible |

The ~1 Hz beat in the table aligns with the symptom Drew reported.

---

## 5. Per-surface inspection

### Review Mode

- Single `<audio>` element bound to `mix_default` MP3 (the full-rehearsal master).
- Three listeners (`loadedmetadata`, `timeupdate`, `ended`).
- One `_timeTicker` interval (500 ms) attached to the player state.
- Wires both segment highlight and comment highlight through the same playhead query path.
- The segment row container scrolls on every transition; the comment row container scrolls on every transition. **Both happen as smooth animations.**

### Unified Player (`GLPlayerEngine` / `gl-player-engine.js`)

- Used for external sources (Spotify, YouTube, Archive embeds, NotebookLM).
- **Not engaged for multitrack rehearsal playback.** Drew's CarPlay scenario plays the multitrack-render MP3 via Review Mode, not the Unified Player.
- `GLPlayerEngine` emits `stateChange`, `songChange`, `status`, etc. via a custom event bus; subscribers in `gl-player-ui.js` re-render the player UI on each emit. Most emits are state-triggered, not periodic.

### Floating Player

- The "floating bar" referenced in `setlist-player.js:612` and `live-gig.js:60` is a separate UI for setlist / live-gig contexts.
- **Not active during Review Mode playback.**

### Render Picker

- `Tools → All renders for this session` modal — surfaces all R2 renders for the current session.
- Static at open; does not poll during playback.
- The currently-loaded render is identified by `p.renderInfo.url` and rendered at modal-open time only.
- Carries the known cosmetic bugs already filed: double "NOW PLAYING" badges + spike-phase-a test clips appearing in the render list (deferred findings 2026-05-29). Neither causes playback glitches.

### Comment Anchoring

- Comments anchor at `(segmentId, offsetWithinSegment)` per Phase A spec; rendered as time-labeled rows in `#mtCommentPanel`.
- Each row carries `data-comment-time` (the absolute master time of the comment).
- `_mtHighlightActiveComment` (called every 500 ms via `_timeTicker`) reads `data-comment-time` on every row each tick. **No per-row index or cache** — full linear scan every interval.

### Segment Highlighting

- `_mtUpdateActiveSegmentHighlight` (called per `timeupdate`) re-queries the segment row list, linear-scans, mutates style on every row.
- The mutation is unconditional: `row.style.outline = ''` (or the active value) on every row every call, regardless of whether the value changed. **No equality check** before the style write.
- Style mutations on rows trigger Safari style-recalc invalidation; in aggregate across hundreds of rows this is a measurable cost even when individual changes are zero.

---

## 6. Confidence-ranked suspects

### HIGH confidence

1. **`_timeTicker` 500 ms `setInterval` clamped to ~1 Hz on iOS PWA backgrounded, plus its DOM-mutation payload.**
   - File:line — `multitrack-rehearsal.js:1831` and `:2202`.
   - Why high: iOS Safari throttles backgrounded `setInterval` to 1 Hz (well-known behavior). The cadence matches Drew's "approximately once every second." The callback queries the DOM, parses `data-commentTime` per row, mutates style on multiple rows, and (on comment transitions) triggers `scrollIntoView({behavior: 'smooth'})`. DOM style mutations + smooth scroll animations contend with the audio decoder for main-thread time on iOS, producing audible micro-stalls.

2. **`timeupdate` event handler `_mtMaybeUpdateMasterPosition` performing unconditional style mutations on every segment row.**
   - File:line — handler registered at `multitrack-rehearsal.js:2136` (Review Mode) and `:1846` (Isolate Mode). Handler body at `:8447`. Style mutation in `_mtUpdateActiveSegmentHighlight` at `:6842–6851`.
   - Why high: this handler runs on every `timeupdate` (~1 Hz when iOS backgrounded). On every call it sets `style.outline` and `style.outlineOffset` on every segment row, even when the value didn't change. With many rows (hundreds for a 3-hour rehearsal) this triggers a style-recalc storm on iOS Safari. Combined with #1 above, two main-thread-occupying operations execute in the same backgrounded ~1 Hz window.

3. **`scrollIntoView({behavior: 'smooth'})` invoked from the playback handlers.**
   - File:line — `multitrack-rehearsal.js:6855` (segment scroll on transition) and `:9150` (comment scroll on transition).
   - Why high: iOS Safari's smooth-scroll animation is known to seize main-thread cycles. Triggered automatically on segment / comment transitions during playback. While these only fire on transitions (not every tick), a 3-hour rehearsal review has many transitions — and any one of them can produce an audible audio dropout.

### MEDIUM confidence

4. **Style-mutation lack of diff check on segment + comment rows.**
   - Files — `multitrack-rehearsal.js:6842–6851` (segments), `:9140–9159` (comments).
   - Why medium: the cost of writing the same value back is sometimes optimized away by the browser, but Safari historically does not optimize redundant style writes. Each write invalidates the row's computed style. The aggregate impact compounds with row count.

5. **Two distinct `_timeTicker` registrations at different code paths.**
   - Files — `multitrack-rehearsal.js:1831` (Isolate Mode wire-up) and `:2202` (Review Mode wire-up).
   - Why medium: each path defensively clears `p._timeTicker` before re-assigning, so steady-state should run one interval. But if both paths execute during the same player-open lifecycle (e.g. Isolate Mode → Review Mode swap), there is a small race window. If a leaked second interval survives, the cadence doubles to 2 Hz (or 2 calls per second of backgrounded throttle). Worth instrumenting before fixing.

6. **`document.querySelectorAll` re-issued every interval / every `timeupdate`.**
   - Files — `:6799` (segments), `:9125` (comments), `:8470` (slider), `:8472` (label).
   - Why medium: the DOM query itself is cheap, but issuing several queries per second over hundreds of rows on a backgrounded tab where the browser already deprioritizes the page can contribute to the stutter. Caching the row references would eliminate the per-tick traversal.

7. **Avatar / GrooveMate periodic checks (`_checkPageChange` at 10 s, `_checkFlowBreaks` at 30 s).**
   - Files — `gl-avatar-ui.js:484`, `avatar_feedback_service.js:191`.
   - Why medium: cadence is too slow to match the 1 Hz beat directly, but on iOS the avatar's DOM polls could contribute to occasional larger glitches at 10 s / 30 s intervals which Drew may not have noticed separately.

### LOW confidence

8. **Band-sync leader heartbeat (Firebase write every 12 s).**
   - File — `gl-leader.js:145`.
   - Why low: only runs if Drew has an active band-sync session as leader, which is rare during solo CarPlay listening. Firebase writes do touch network; if running, they could contribute to occasional 12 s-cadence glitches.

9. **Render-In-Flight Firebase listener residue.**
   - File — `multitrack-rehearsal.js:2225+`.
   - Why low: only active if a Custom Mix render was kicked off and is still in-flight. The poller eventually clears itself. Not periodic in steady steady-state.

10. **Service worker cache reads on app-shell.**
    - File — `service-worker.js:167–206`.
    - Why low: SW intercepts page-shell requests but not audio streaming. Audio playback bypasses the SW for the R2 MP3 URL.

11. **iOS Web Audio context drift.**
    - File — `multitrack-rehearsal.js:3485+` (AudioContext setup) and surrounding GainNode graph.
    - Why low: Web Audio only engages in Isolate Mode (multi-stem mixing). The Review Mode path used for CarPlay playback is a plain `<audio>` element with no AudioContext routing. If Drew has the Isolate Mode mixer open while listening via CarPlay, the GainNode graph could be involved, but the default Review Mode flow does not engage it.

12. **`_mtMaybeUpdateMasterPosition` loop-wrap branch.**
    - File — `multitrack-rehearsal.js:8458–8468`.
    - Why low: only runs when a single-tap loop is set. Drew listening to a 3-hour rehearsal end-to-end almost certainly has no loop set; this branch is a no-op.

---

## 7. Pierce's one-song stems issue — separate root cause

Pierce downloaded the "🎵 One-song stems" ZIP (the `/multitrack/zip` Modal endpoint produced by `clip_song`). The expected output is per-channel FLAC clips at the song's 6-minute range. The actual output: FLAC files that DAWs (Pro Tools, REAPER, Logic) read as 3-hour-long, with 6 minutes of audio at the start and silence afterward.

### Root cause

The `clip_song` Modal endpoint at `services/multitrack-song-clip/clipper.py:210–217` uses:

```python
ffmpeg -hide_banner -loglevel error -y \
  -ss {startSec} -i {source.flac} -t {duration} \
  -c copy {output.flac}
```

`-c copy` (stream copy) avoids re-encoding. For FLAC this is intended to be fast and lossless. But it has a well-documented edge case:

**FLAC's STREAMINFO block carries a `total_samples` field at the start of the file.** When ffmpeg muxes a `-c copy` output, it writes a new STREAMINFO header *before* it knows how many samples it will copy. On many ffmpeg versions, that header either (a) is copied verbatim from the source (carrying the full-rehearsal sample count) or (b) gets set to zero (unknown duration).

If `total_samples` = source value: DAWs read the header and present the file as 3 hours long. The 6 minutes of actual audio data plays; the rest is interpreted as silence or unreadable padding.

If `total_samples` = 0: most playback applications cope, but some DAWs (Pro Tools specifically is finicky here) refuse to import the file or display "unknown duration" and behave unpredictably.

Either way, the symptom Pierce reported (file presents as 3 hours, contains 6 minutes of actual audio, blocks DAW workflow) matches the `-c copy` + stale STREAMINFO failure mode.

### Why this wasn't caught earlier

The output FLACs are SMALLER than the source files (about 6 / 180 ≈ 3% the size), so byte-count checks suggested the clip worked. The bug is in the duration-reporting metadata, not in the audio frame count. Generic players that ignore STREAMINFO duration (VLC, the macOS Finder Quick Look) play the file as 6 minutes and the bug stays invisible. DAWs that trust STREAMINFO see the 3-hour reading.

### Fix candidates (not authorized — for discussion)

**Option A — Re-encode the clip instead of stream-copying.**

Change the ffmpeg command from `-c copy` to `-c:a flac -compression_level 5`. The output is still lossless (FLAC is a lossless codec; re-encoding produces bit-identical PCM). The STREAMINFO is written fresh and contains the correct `total_samples`.

Trade-off: time-to-build per channel goes from ~1–2 s (stream-copy) to ~5–10 s (re-encode). For a 17-channel clip the total bumps from ~30–90 s to ~90–180 s. Acceptable; the user is already waiting for the ZIP.

Cost: same R2 storage. Same audio quality. Same file format compatibility.

**Option B — Post-process with `metaflac` to rewrite STREAMINFO.**

After `-c copy`, run `metaflac --remove --block-type=STREAMINFO` then `flac --decode --stdout {clip} | flac --best --output-name={clip}.new --stdin --silent`. This is awkward, adds a tool dependency, and is more fragile than Option A.

**Option C — Different ffmpeg muxer flags.**

`-fflags +bitexact -flags +bitexact` may force ffmpeg to recompute the STREAMINFO. Some ffmpeg versions support `-write_xing 0` analog for FLAC, but FLAC doesn't have an equivalent flag. Inconsistent across ffmpeg versions; not reliable.

**Option D — Document and route around.**

Add a note in the download UI that DAWs may report incorrect duration; users should use the ffmpeg one-liner to fix locally. Acceptable as a temporary stopgap but transfers the fix burden to every DAW user.

**Recommendation (not authorized to ship):** Option A. Smallest code change, removes the failure mode entirely, no new dependencies. The ~60s additional Modal build time is well within Pierce's tolerance per his description ("when he unzipped and put it in the DAW" — he's already in async territory).

---

## 8. What would inform a fix decision

The investigation is read-only. If Drew greenlights remediation, these are the questions an implementation spec would answer:

For the playback glitch:
- Should `_timeTicker` be eliminated entirely and replaced with `timeupdate`-driven UI?
- Should `_mtUpdateActiveSegmentHighlight` cache the active row reference and only mutate when the index changes?
- Should `scrollIntoView` lose `behavior: 'smooth'` during playback, or only auto-scroll when the row is outside the viewport?
- Should the segment highlight + comment highlight paths consolidate (single tick per second, single DOM pass)?
- Is there a `document.hidden` check to skip DOM mutations entirely when the page isn't visible?

For Pierce's stems:
- Switch Option A — re-encode with `-c:a flac` — and validate the Modal output in Pro Tools / REAPER before declaring done?
- Apply same fix to the chatter Whisper transcription pipeline's FLAC slicing (which uses the same `-c copy` pattern)?
- Apply same fix to per-channel individual-track download (the "Individual tracks · full rehearsal" path produces ~600 MB FLACs at full rehearsal length, but those are *intended* to be full length so the issue does not apply there)?

These are not decisions for this report. They are surfaces a future implementation spec would need to cover.

---

## Summary of findings

The 1 Hz playback glitch is consistent with a known pattern in iOS Safari PWAs: a high-frequency timer + a high-frequency listener that both perform DOM work get throttled to ~1 Hz when the page is hidden, and the DOM work each tick is heavy enough to briefly delay audio decoding. The Review Mode playback path contains both ingredients — a 500 ms `setInterval` and a `timeupdate` listener that each touch hundreds of DOM rows per call and trigger smooth-scroll animations on transitions.

The Pierce stems issue is a separate, well-understood ffmpeg `-c copy` FLAC bug. The fix is one line of Python; the validation is loading a clip into Pro Tools.

Neither fix has been applied. The investigation is complete.
