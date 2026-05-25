# Custom Mix Hybrid Architecture — Proposal v1

_Authored 2026-05-25 — audit + phased recommendation. NO code, NO implementation. Commissioned by Drew per the 2026-05-25 Custom Mix workflow feedback. Awaiting Drew + ChatGPT strategic review before any implementation begins._

---

## 0. Framing (Drew's verbatim hypothesis)

> "MODE 1 — Live Preview Mix (browser/local) for fast creative iteration · MODE 2 — Final Render Mix (server) for deterministic export. Treat render/preview jobs as first-class operational objects. At ~75% vocal reverb send I hear little/no audible difference."

This proposal evaluates the hypothesis against the existing render pipeline (`services/multitrack-render/render.py`, `worker.js /multitrack/render/*`, `js/features/multitrack-rehearsal.js`) and the prior browser-mixing audit (`02_GrooveLinx/audits/MULTITRACK_BROWSER_PLAYBACK_AUDIT.md`).

Verdict up front:
- **MODE 2 is solid today** — server render is sample-accurate, well-instrumented (Phase 4 progress markers), and has the right primitives.
- **MODE 1 is partially achievable but bounded** — browser-local preview mixing is feasible for SHORT slices (≤60s) and FOR THE CURRENTLY-OPEN Web Audio graph, but the audit-confirmed 6-connection-per-origin cap rules out simultaneous streaming of all 17 stems for arbitrary playback windows.
- **The reverb "no audible difference" report is REAL and explained by two concrete bugs** in the recipe construction + filter-graph wiring (§5).
- **Render-job persistence is fragile** — `_customMixInFlight` lives on the closure-scoped player object and dies on every `_mtClosePlayer` call. Pattern fix exists (GLStems `gl_stem_jobs_active`); should be reused, not reinvented.

---

## 1. Current render architecture (audit)

### 1.1 Recipe flow — browser → worker → Modal → R2

**Step 1 — Recipe construction.** Two paths exist; they produce DIFFERENT recipe shapes:

| Path | Function | Reverb shape | Per-track granularity |
|---|---|---|---|
| **Custom Mix modal** | `_mtCustomMixRunRender` at `js/features/multitrack-rehearsal.js:2188-2324` | 5 group sliders (vocals/guitars/bass/drums/keys) + 1 master wet slider + 5 binary send checkboxes | Coarse — per-GROUP gain (vocals=100% applies to all 4 vocal stems); per-GROUP binary send |
| **Export Mix from Isolate** | `_mtExportRehearsalMix` at `:1806-1900` | Per-track continuous gain + per-track continuous send (0..1) + master wet | Fine — per-stem `volumes[tid]`, `reverbSends[tid]` from `p.mixState` |

The Modal `render_mix` function (`services/multitrack-render/render.py:135`) accepts BOTH shapes because the recipe schema is per-track (`tracks[trackId] = { gain, mute, solo, reverbSend }`). Custom Mix just collapses 17 distinct stem recipes into 5 group templates and re-emits per-stem entries with the shared group values (`render.py` does not see groups at all).

**Step 2 — Worker proxy.** `worker.js:2204-2300`:
- `/multitrack/render/start` validates band/session/render IDs (regex `^[a-z0-9_-]{1,64}$`), forwards JSON body + shared secret + optional `progress_id` to Modal endpoint URL stored in `MULTITRACK_RENDER_URL`.
- `/multitrack/render/check` forwards `call_id` + optional `progress_id`; relays Modal response back unchanged. 30s abort timeout.
- `/multitrack/render/status` lists existing R2 renders under `multitrack/{slug}/{sid}/renders/`. Filters by extension `.wav|.mp3|.flac`. Skips `renders/_previews/` artifacts (preview path uses different R2 key).

**Step 3 — Modal pipeline (`render.py`).**
- `render_endpoint(item)` dispatches on `action` (start/check) — single endpoint per Modal quota constraint.
- `render_mix.spawn(...)` returns a `call_id` immediately; the actual work runs async on a 4-CPU / 8 GB container.
- `RENDER_PROGRESS_DICT` (Modal Dict) holds per-phase markers keyed by browser-supplied `progress_id`; cleaned in finally block.
- Pipeline phases (per `_mark()` calls at lines 356, 396, 545, 559, 594):
  1. `download` — parallel 8-worker R2 pulls into `/tmp` (~1 min for 3-hour 17-stem rehearsal)
  2. `filter_build` — assemble ffmpeg `-filter_complex` graph
  3. `ffmpeg` — single subprocess call; mix → alimiter
  4. `upload` — boto3 multipart back to R2 under `renders/{renderId}/` (or `renders/_previews/{renderId}/`)
  5. `wrap` — finalize, return public URL

**Step 4 — R2 artifact.** `STEMS_R2_PUBLIC_BASE` + render key. Browser-visible directly via `<audio src=...>` (`ContentDisposition: inline`). No signed URL — relies on R2 public bucket policy.

**Step 5 — Browser polling.**
- `_mtCustomMixRunRender` polls every 5s for up to 180 attempts (15 min full render) or 60 attempts (5 min preview) — `multitrack-rehearsal.js:2299-2321`.
- Updates `p._customMixInFlight.serverPhase` from check response; `_mtRenderProgressHtml` consumes this with LIVE / EST / ELAPSED-EST badges depending on whether the server has emitted a phase yet (`:2137-2148`).
- On done, swaps `<audio id="mtReviewAudio">.src` to the new render URL.

### 1.2 What works well today

1. **Phase 4 progress markers are good observability** — server-truth phase IDs + browser-side elapsed-time fallback + visible LIVE/EST badge. This mirrors the Analyze flow Drew already trusts.
2. **Recipe schema is forward-compatible** — Custom Mix's "group" abstraction is a UI layer; Modal sees per-stem records and would happily accept a future per-stem reverb-send slider.
3. **Preview slice path exists** (`previewSliceSec`, `render.py:251-266, 519-536`) — fast input seek `-ss` before inputs when no segment concat, output-side `-t` cap when concat is in play. Cap at 60s preview enforced server-side.
4. **R2 listing is a durable system-of-record** — even if the browser forgets a render exists, `/multitrack/render/status` enumerates them from R2 itself. The render exists in the world independent of the browser.

### 1.3 What's fragile today

1. **`_customMixInFlight` is closure-scoped on `_mtState.player`** (`:2267`). When `_mtClosePlayer` fires (`:2563`), `_mtState.player = null` drops the in-flight reference. The Modal job continues spending CPU; the browser has no resume hook.
2. **No persistence across page reload** — `_customMixInFlight` is in-memory only. A reload during a 5-min render strands the job entirely (browser doesn't know its `call_id`; can only resume by listing R2 after the render lands).
3. **Custom Mix mutates Review Mode `<audio>.src` on completion** (`:2355-2370`) without a transactional "render landed → ready to play" handshake. If the user has scrubbed Review Mode mid-render, the swap interrupts playback at an arbitrary position.
4. **Per-track reverb-send is fractional in Web Audio (`:2711`) but BINARY in Custom Mix recipe (`:2229`)** — Custom Mix's "Send to reverb" checkboxes always emit `1` or `0`; no graduated send. (Drew's "75% send" is the MASTER reverb slider, not a per-group send.) See §5.

---

## 2. Browser-local preview mixing feasibility

### 2.1 What already exists in the browser

The Isolate Mode player already runs a Web Audio graph (`_mtInitWebAudio`, `:2669-2729`):

```
<audio> × 17 → MediaElementSource → trackGain → masterDry  ─┐
                                              → reverbSend ─┤
                                                            ├→ destination
                                  convolver ← reverbSend ───┘
              reverbWet ← convolver
```

Per-track `trackGain` and `reverbSend` are both fractional `GainNode`s controllable in real time via `setTargetAtTime` (already used by `_mtSetTrackVolume`, `_mtSetReverbWet`). A synthesized impulse response (`_mtSynthImpulseResponse`, `:2733`) drives the ConvolverNode — 2.0s decay, no external file dependency.

**This means a per-slider live preview is ALREADY ENGINEERED for the currently-open Isolate Mode session.** The Custom Mix modal does NOT use this graph — it builds a recipe and round-trips through Modal.

### 2.2 What blocks "MODE 1" as Drew describes it

The cited audit (`MULTITRACK_BROWSER_PLAYBACK_AUDIT.md` §3.1) establishes:
- **Chromium/Firefox/Safari cap 6 simultaneous TCP/HTTP connections per origin.**
- All 17 stems share one origin (`STEMS_R2_PUBLIC_BASE`).
- Far seeks serialize range fetches into ~3 waves; tail-of-wave-3 lands 20-30s after seek.
- Each `<audio>` has its own clock; brief stalls cause permanent drift.
- 17-stream full-decode into `AudioBufferSourceNode` = 22 GB for a 3-hour session — infeasible (browser tab cap ~4 GB).

**Conclusion: full-session, all-stem live preview mixing is NOT feasible.** The audit's verdict applies directly here — adding "and react to slider changes live" doesn't change the network physics.

### 2.3 What IS feasible — and the bounded shape MODE 1 should take

Two patterns CAN work in the browser:

**Pattern A — "Live mix on the current Web Audio graph" (existing infrastructure).**
The Isolate Mode graph already responds to slider changes in real time. The blocker is UI: today Custom Mix is a MODAL that DOES NOT TOUCH the Isolate graph — it just builds a recipe. If we instead route the Custom Mix sliders to the existing per-track `GainNode`s + master `reverbWet`, slider changes become audible immediately while playback is happening.

**Constraint:** this only works when the user has already opened Isolate Mode (which has streamed enough audio to be playing). It does NOT replace the server render — sliders show LIVE EFFECT preview but the SERVER render is still the deterministic export. Drift caveat from MULTITRACK_BROWSER_PLAYBACK_AUDIT still applies; user is warned.

**Pattern B — "Short-slice preview render against the server" (already exists, refine UX).**
The 30s `_mtCustomMixPreview` path (`:2391-2444`) is server-rendered, not browser-rendered. It already takes 30-60s to feel back from Modal. Drew's "fast creative iteration" goal isn't met by this latency, BUT the architecture is correct for cases where Pattern A can't apply (e.g., user not in Isolate Mode; cross-stem fades that the Web Audio graph doesn't model).

### 2.4 Stem file sizes — concrete numbers

Per the multitrack export checklist + `MULTITRACK_BROWSER_PLAYBACK_AUDIT.md` §2.2:
- 24-bit / 48 kHz FLAC mono ≈ **700-1100 kbps**
- 3-hour mono stem ≈ **1.0-1.5 GB**
- Full 17-stem session ≈ **17-25 GB**
- A **60-second slice** ≈ **5-8 MB per stem × 17 = ~100 MB total**

A 60-second windowed prefetch of all 17 stems is feasible in browser memory (~100 MB), but the network cost is non-trivial — even prefetched, the first slider tweak still has to wait for the prefetch wave to complete. Cold start of a 60s window = ~3-6s on a fast connection assuming the 6-connection cap.

### 2.5 CORS / cross-origin

R2 stems already use `crossorigin="anonymous"` for both Isolate and Review modes (`:1181, 1557`). The CORS preflight is satisfied (audio plays, so it works). MediaElementAudioSourceNode requires this attribute or the graph outputs silence. **No CORS change needed for MODE 1.**

### 2.6 Memory budget — explicit numbers

| Mode | Memory | Network on slider tweak | Latency to hear change |
|---|---|---|---|
| **MODE 1 Pattern A — live Web Audio graph** | ~50-200 MB (streaming buffer) | Zero (sliders modulate GainNodes) | <50ms (Web Audio param ramp) |
| **MODE 1 Pattern B — 60s server preview** | ~5 MB (single rendered MP3) | 30-60s render + ~1 MB download | 30-60s |
| **MODE 1 hypothetical full-stem decode** | ~22 GB | Tab-exceeds memory | n/a — infeasible |
| **MODE 2 current Custom Mix** | ~5-10 MB (single rendered MP3) | 2-5 min render | 2-5 min |

The honest takeaway: **MODE 1 is only fast when it leverages the already-streaming Isolate Mode graph.** Outside of that, server-side preview is the realistic fallback and is not as fast as Drew's "live preview" framing suggests.

---

## 3. Minimum viable hybrid-preview implementation

The smallest useful Phase 1 of MODE 1 is **"route Custom Mix sliders to the Isolate Mode Web Audio graph WHEN IT IS ALREADY OPEN."**

Scope:
1. When Custom Mix modal opens, detect if `_mtState.player.audioCtx` exists (i.e., Isolate Mode has been used in this session).
2. If yes: each slider change fires `setTargetAtTime` on the matching per-track `gain.gain` (group → apply to all stems in group) and `reverbSend.gain` (group → binary 0/1 on send), and on `reverbWet.gain` (master). The user hears the change immediately on whatever audio is currently playing.
3. If no: show a one-line tip "▶ Play Isolate Mode for live preview" — fall through to existing server-render-only behavior. Don't auto-open Isolate Mode (that's a heavy operation; user opts in).
4. The 🔊 Preview 30s server path stays as the cross-validation tool ("does the SERVER mix sound like what I just heard live?"). Server render remains the source of truth for the final export.

What this is NOT:
- NOT building a new browser DAW (forbidden by `feedback_workbench_no_new_destinations`).
- NOT prefetching short audio windows for browser-local preview (out of scope for Phase 1; revisit only if Pattern A proves insufficient).
- NOT replacing the server render. Live preview is a CONVENIENCE layer; the rendered mix is the artifact.
- NOT introducing a new audio graph topology. Reuses the existing `_mtInitWebAudio` graph and the existing per-track `GainNode`s.

LOC estimate: **~80-150 LOC** in `multitrack-rehearsal.js` (modal open hook + slider event wiring + tip banner + cleanup on modal close). No worker changes. No Modal changes. No new files.

Acceptance criteria:
1. With Isolate Mode playing, opening Custom Mix and moving the vocals slider audibly changes vocal level within 100ms.
2. With Isolate Mode NOT playing, Custom Mix shows the tip banner and behaves exactly as today.
3. Closing the Custom Mix modal restores per-track GainNode values to whatever Isolate Mode had set (or to the recipe values if user clicked Render — see §4 for persistence story).
4. No regression to existing 🔊 Preview / 🎬 Render Mix flows.

---

## 4. Render job persistence proposal

### 4.1 Current state (audit)

`_customMixInFlight` is a property on `_mtState.player` (`multitrack-rehearsal.js:2267`):

```js
p._customMixInFlight = {
    progressId, startedAt, isPreview, serverPhase
};
```

This dies in three ways:
1. **Modal close** — `_mtClosePlayer` (`:2563`) sets `_mtState.player = null`.
2. **Player tear-down** — `_mtState.player` is replaced when opening a different session (`:1288`).
3. **Page reload** — module-scope state is lost entirely.

The Modal job continues running on the server in all three cases. The browser has no way to reattach to it. The user sees no in-flight indication anywhere outside the modal.

### 4.2 Existing canonical pattern — GLStems `gl_stem_jobs_active`

`js/core/gl-stems.js:38-99` already solved this problem. Pattern:
- `_ACTIVE_KEY = 'gl_stem_jobs_active'` — single localStorage key holds a map of `jobId → job`.
- `_putActiveJob`, `_updateActiveJob`, `_removeActiveJob` — atomic CRUD with `_ACTIVE_MAX = 8` runaway protection.
- `_resumeActiveJobsOnBoot` (`:434-474`) — on boot, walks the map, prunes stale entries beyond `_maxPollMsForKind(j.kind)`, resumes anything still in `'processing'` state.
- `getStats()` (`:115-134`) — exposed for Runtime Health Overlay.
- `getActiveJobs()` (`:174-177`) — public read so any consumer (Review Mode banner, modal reopen) can reattach.

This is the right pattern for render jobs too. Per `feedback_consolidate_dont_retire` and the precedent of Stab #14: extend the existing canonical pattern; don't invent a new persistence container.

### 4.3 Proposed extension

Add to a canonical module (likely `gl-multitrack-renders.js` as a new sibling, or extend `gl-stems.js` if Drew prefers single-key consolidation):

**Storage key:** `gl_render_jobs_active` (mirror naming of `gl_stem_jobs_active`).
**Per-job record:**
```
{
  jobId: 'render:<callId>',
  callId,               // Modal FunctionCall id
  progressId,           // browser-supplied for phase markers
  bandSlug,
  sessionId,
  renderId,
  isPreview: bool,
  recipe: {…},          // for "reopen modal → show what I asked for"
  startedAt: epoch_ms,
  status: 'processing' | 'completed' | 'failed' | 'cancelled',
  serverPhase: {…},     // last seen phase marker
  publicUrl: ?,         // populated on completion
  completedAt: ?
}
```

**Boot resume:** on app load, walk the map; for each `processing` job not older than the 15-min poll budget, re-attach a poll loop that:
1. Continues hitting `/multitrack/render/check` until done/failed.
2. Writes terminal status + `publicUrl` back into the persisted record.
3. Emits an event (`'glRenderJobUpdated'`) that surfaces consumers can subscribe to.

**Consumers:**
1. **Custom Mix modal** — on open, if `_mtState.player.sessionId` matches a persisted in-flight job, reattach the modal's progress UI (mirrors today's `_mtRenderCustomMixStatus` reopen logic at `:2065-2073`, but driven by the persisted record instead of the closure-scoped one).
2. **Review Mode header banner** — show "🎬 Render in progress (vocals + master reverb, 2m 30s)" when a job is in-flight for the current session; "✓ Custom mix ready" with a Listen action when one completes.
3. **Multitrack history card** — show a "🎬 rendering…" badge on a session card whose render is in flight (even from a previous tab — e.g., user kicked the render on desktop, opens phone, sees the in-flight status).
4. **Runtime Health Overlay** — add `GLRenderJobs.getStats()` returning `{activeCount, processing, completed, failed, lastPollAt}` (mirror `GLStems.getStats()`). Surfaces in Stab #10 Runtime Health Overlay per the existing canonical pattern.

**Why not Firebase?** GLStems chose localStorage for orthogonality to band-data schema. Same reasoning applies here. Render jobs are per-device operational state; the durable artifact (the rendered mix) ALREADY lives in R2 and is enumerable via `/multitrack/render/status`. Persisting the JOB record per-device is correct.

**Why match GLStems exactly?** Per `feedback_consolidate_dont_retire` and `00_Governance/CANONICAL_SYSTEMS.md` precedent — when a pattern already exists and works, extend it. Don't invent a parallel.

LOC estimate: **~250-350 LOC** for a new `gl-multitrack-renders.js` module + ~50 LOC of wiring into Custom Mix modal + Review Mode banner + history card badge.

### 4.4 Open question for Drew

Should this live in a NEW `gl-multitrack-renders.js` module (clean separation, parallel to `gl-stems.js`), or as a SECTION of `gl-stems.js` (single canonical "long-running media jobs" module)? Recommend the former for clarity; the two job types have different polling cadences, different terminal artifacts, and different consumers.

---

## 5. Reverb routing audit (evidence-based)

### 5.1 The user-facing complaint

> "At ~75% vocal reverb send, little/no audible difference."

This is REAL and is caused by THREE compounding issues, ranked by impact.

### 5.2 Bug A — Custom Mix reverb-send is BINARY, not graduated

**File:line:** `js/features/multitrack-rehearsal.js:2229`
**Code:**
```js
tracksRecipe[t.trackId] = {
    gain: gain,
    mute: false,
    solo: false,
    reverbSend: !!sendsByGroup[grp] ? 1 : 0,
};
```

`sendsByGroup[grp]` comes from checkboxes (`:2209-2219`), which yield `true` or `false`. The ternary then emits literal `1` or `0`. **There is NO graduated per-group send in Custom Mix.** The 75% the user adjusts is the MASTER reverb wet slider (`mtCmxReverb`, range 0-100), which maps to `recipe.masterReverbWet ∈ [0,1]` at `:2207-2208`.

**Implication:** the user's mental model ("75% vocal reverb send") doesn't match the UI's actual model. If the user expects per-track sends and tries to dial them via the master wet slider, they're dialing the MASTER wet level — which IS audible when working correctly (see Bug B + C).

### 5.3 Bug B — Master wet level is multiplied INTO the wet branch only, with NO dry-signal subtraction

**File:line:** `services/multitrack-render/render.py:437`
**Code:**
```python
gain = t["gain"]
send = t["reverbSend"]
has_wet = master_reverb_wet > 0 and send > 0
wet_gain = gain * send * master_reverb_wet if has_wet else 0.0
need_wet_branch = has_wet and wet_gain > 0
# ...
filter_parts.append(f"[{dry_in}]volume={gain:.4f}[{dry_label}]")     # dry: full gain
filter_parts.append(f"[{wet_in}]aecho=...,volume={wet_gain:.4f}[{wet_label}]")  # wet: gain × send × master_wet
amix_inputs.append(dry_label)
amix_inputs.append(wet_label)
```

The dry branch uses `volume={gain}` (line 483, line 496). The wet branch uses `volume={gain * send * master_reverb_wet}` (line 489). Both are summed via `amix=inputs=N:normalize=0:dropout_transition=0` (line 505).

**At master_reverb_wet=0.75 and send=1 (from Custom Mix), the wet branch is added at 0.75× the dry signal level.** That IS audible in isolation — but it's added ON TOP of the full-strength dry signal. The dry signal is not reduced when wet increases. This is a "send architecture" (parallel dry+wet) rather than a "wet/dry mix knob" (crossfade dry↔wet).

**Audible consequence:** moving the master wet slider from 0% to 75% should add an audibly delayed echo (aecho is the synthesized reverb stand-in, see line 488) at 75% level. Whether the user perceives this as "reverb" depends heavily on (a) the aecho params, (b) whether the alimiter clobbers the wet branch in the limiter stage.

### 5.4 Bug C — `alimiter` is applied AFTER amix, possibly squashing the wet branch

**File:line:** `services/multitrack-render/render.py:509`
**Code:**
```python
limiter_filter = "[mix]alimiter=level_in=1:level_out=1:limit=0.97:attack=5:release=50[out]"
```

The alimiter sits between `[mix]→[out]` with `limit=0.97` (~-0.3 dBFS). When `amix=normalize=0` is used, the summed signal can EASILY exceed 1.0 because there's no automatic gain reduction. With 17 stems at unity, the natural sum is well above 1.0; the alimiter then squashes peaks.

**The wet branch IS one of the inputs being summed.** When the alimiter activates on dry-signal peaks, it pulls down EVERYTHING including the wet echo. The audible result: at high stem counts, the wet branch is masked by the dry signal AND by the limiter's gain reduction. The user hears "louder mix" but not "more reverb."

This is plausibly the root of Drew's "75% sounds the same as 0%." A way to verify:
1. Render the same recipe twice — once with `masterReverbWet=0`, once with `masterReverbWet=1.0`.
2. Diff the output WAVs (e.g., `ffmpeg -i a.wav -i b.wav -filter_complex 'amerge,channelsplit=channel_layout=stereo:channels=FL+FR,asplit[diff_l][diff_r]'` or compute spectral difference).
3. If the diff is small, the alimiter is masking the wet branch. If the diff is large, the user's perception is the variable.

### 5.5 Bug D — `aecho` is a poor stand-in for "reverb" and is barely perceptible at low send values

**File:line:** `services/multitrack-render/render.py:488`
**Code:**
```python
f"[{wet_in}]aecho=0.7:0.5:60|110|180:0.5|0.35|0.2,"
```

`aecho` is a multi-tap delay (3 taps at 60/110/180ms, decays 0.5/0.35/0.2). The browser-side Web Audio graph uses a CONVOLVER with a synthesized impulse response of 2.0s decay (`_mtSynthImpulseResponse`, `:2733`). These are NOT the same effect.

The aecho output at 75% level sounds like a thin, slappy delay — not a hall or plate reverb. A user who DIALS UP the master wet slider expecting "more reverb" but hears "a faint echo tail" reasonably concludes "the slider isn't doing anything." The browser convolver impulse decay gives a much more present reverb feel.

**Implication:** even if Bugs A/B/C were all fixed, the wet effect would still feel weak at musically-reasonable settings (~25-40% wet) because aecho is acoustically much quieter than a true convolution reverb of the same wet-mix ratio.

### 5.6 The reverb verdict

| Bug | Source | Real? | Fix complexity |
|---|---|---|---|
| **A** | `multitrack-rehearsal.js:2229` — binary per-group send | **REAL** — user's "75% vocal send" doesn't exist in the UI | UX-level (add per-group slider) OR documentation (rename master slider clearly) |
| **B** | `render.py:437,483,489` — wet added to full dry | **REAL but DESIGN INTENT** — this is send-architecture, not a bug per se. But it makes "more reverb" feel like "more volume + delay tail" | Design decision — keep parallel send (current) or convert to dry/wet crossfade |
| **C** | `render.py:509` — alimiter masks wet branch | **LIKELY REAL — needs A/B render comparison to confirm** | Either move alimiter before amix (per-branch limiting; expensive) or reduce dry-branch gain when wet is high (mix-down) |
| **D** | `render.py:488` — aecho is not reverb | **REAL** — aecho is the wrong effect for the user's mental model | Swap to convolution reverb (ffmpeg's `afir` with a real impulse) — same wet branch position, different filter |

**Conclusion for Drew:** the "75% no audible difference" report is structurally explained. Bug A makes the UI confusing; Bugs B+C+D make the actual reverb effect quieter than expected at audible-but-musical settings. Without running the A/B diff in §5.4, I can't quantify which of B/C/D dominates — but the SUM is enough to explain the user perception. Recommend running the diff before fixing.

### 5.7 Test Drew can run locally

```bash
# Inside the GrooveLinx repo
cd services/multitrack-render
python3 -c "
import json
recipe_dry = {'tracks': {'01_vocal-drew': {'gain': 1.0, 'reverbSend': 1.0}},
              'masterReverbWet': 0.0, 'outputFormat': 'wav', 'outputName': 'a.wav'}
recipe_wet = {'tracks': {'01_vocal-drew': {'gain': 1.0, 'reverbSend': 1.0}},
              'masterReverbWet': 0.75, 'outputFormat': 'wav', 'outputName': 'b.wav'}
print(json.dumps(recipe_dry, indent=2))
print(json.dumps(recipe_wet, indent=2))
"
# Then POST both as previewSliceSec={start:30, duration:30} render jobs against
# a single-vocal-stem session, download a.wav and b.wav, and run:
#   ffmpeg -i a.wav -i b.wav -filter_complex \
#     '[0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0-c1|c1=c1-c0' diff.wav
# Listen to diff.wav. Anything non-silent = the reverb IS being applied (Bug C
# excused). Diff that's near-silent at 75% wet = limiter is masking the wet
# branch (Bug C confirmed).
```

I did not run this myself because (a) I cannot trigger the Modal endpoint from this audit-only session, (b) Drew has the credentials and a 1-stem session is the cleanest test. Estimated time: 10 min.

---

## 6. Phased recommendation

Each phase is bounded; LOC estimates are rough. Phase 1 lands first; later phases gated on Phase 1 acceptance + Drew strategic review.

### Phase 1 — Render-job persistence (Stab-class)

**Scope:** new `js/core/gl-multitrack-renders.js` mirroring `gl-stems.js` Stab #14 pattern. localStorage-backed job map; boot-resume hook; `getStats()` for Runtime Health Overlay; event-emission on job completion. Wire Custom Mix modal reopen, Review Mode header banner, and history-card badge to consume it.

**LOC estimate:** ~250-350 LOC new module + ~50 LOC consumer wiring.
**Risk:** Low. Pattern is proven. No worker changes. No Modal changes.
**Acceptance criteria:**
1. Start a Custom Mix render; close the modal; reload the tab; reopen Multitrack — see "🎬 rendering…" badge on the session card, see in-flight state in Review Mode header.
2. Job completes while user is on another page — toast appears with "✓ Custom mix ready" and a Listen link.
3. Runtime Health Overlay shows `activeCount`, `processing`, `lastPollAt` for renders.
4. Failed renders persist `status='failed'` and surface a "✗ Render failed — retry" affordance in the modal-reopen path.
5. No regression to existing Custom Mix UX when no in-flight job exists.

**Why this is Phase 1:** unblocks every other improvement (browser-local preview, reverb fixes, etc.) by making render jobs first-class observable state. Today, debugging a render bug requires being in the right modal at the right moment. After Phase 1, the job is always visible.

### Phase 2 — Reverb routing fix (Stab-class)

**Scope:** address Bugs A/C/D per §5.
- **Bug A:** rename master slider to "Master reverb amount" and add a one-line tooltip explaining sends are binary per-group. (UI-only, 5 LOC.) Defer per-group fractional sends to Phase 3.
- **Bug C:** add a "wet branch limiter" decision — either move alimiter inside each branch (expensive — 17× alimiter cost) OR apply a gentle pre-amix attenuation on the dry sum so the wet branch isn't masked. Recommend the latter: scale dry-branch gain by `(1 - 0.3 × masterReverbWet)` so dry dips slightly as wet rises, restoring perceived headroom for the wet signal.
- **Bug D:** swap `aecho` for ffmpeg's `afir` driven by the same synthesized impulse the browser uses (or a similar baked impulse shipped with the Modal container). Need to verify ffmpeg build includes `afir` (Debian-slim's apt ffmpeg typically does, but smoke-test on Modal first).

**LOC estimate:** ~30-60 LOC in `render.py` + minor UI text in `multitrack-rehearsal.js`. Bake an impulse `.wav` into the Modal image (≤500 KB).
**Risk:** Medium. Reverb fix requires A/B audio validation. Don't ship without §5.4 diff confirming the perceived improvement.
**Acceptance criteria:**
1. A/B render diff with master_wet=0 vs master_wet=0.75 produces audibly different output (verified via the §5.7 test).
2. The same 30s preview rendered before vs after Phase 2 sounds audibly more reverberant at master_wet=0.5 (subjective, but Drew + at least one bandmate confirm).
3. No level changes >2 dB on full-dry (master_wet=0) renders — backwards-compatible for any saved Custom Mix presets.

### Phase 3 — Live browser preview (Stab-class)

**Scope:** route Custom Mix slider events to the Isolate Mode Web Audio graph when it exists (per §3). Add the "▶ Play Isolate Mode for live preview" tip when graph isn't initialized. Cleanup hooks on modal close (restore Isolate graph values OR commit the slider values).

**LOC estimate:** ~80-150 LOC in `multitrack-rehearsal.js`.
**Risk:** Low. No new audio graph; reuses existing `_mtInitWebAudio` output. Only touches the modal's slider handlers.
**Acceptance criteria:**
1. With Isolate Mode playing, slider changes audibly modulate the playback within 100ms.
2. With Isolate Mode not initialized, Custom Mix behaves exactly as today (no surprise).
3. Closing Custom Mix without clicking Render restores Isolate Mode's per-track values (no destructive write).
4. Clicking Render still produces a SERVER-rendered artifact — live preview is convenience, not source of truth.
5. Runtime Health Overlay surfaces a `livePreviewActive: bool` flag.

### Deferred (Phase 4+)

- **Per-group fractional reverb sends in Custom Mix.** Replaces binary checkboxes with sliders. Requires Phase 2 (audible-reverb fix) to land first or the UI is decorative.
- **Per-stem reverb sends in Custom Mix.** Already exists in Isolate Mode; Custom Mix could expose it under a "🎛 Show all 17" disclosure. Don't add until Custom Mix's coarse path is solid.
- **Preset/recipe library.** Save named Custom Mixes ("songs only with vocals up"); reload on later sessions. Touches persistence + UX; not blocking.
- **Cross-session render queue.** Kick renders on multiple sessions; see them all in a status panel. Belongs after Phase 1's job-persistence pattern is proven.

---

## 7. Risks + deferrals

### 7.1 Risks the proposal accepts

1. **Pattern A live preview only works when Isolate Mode is loaded.** Users who go straight to Custom Mix won't get live preview. The tip banner addresses this transparently rather than auto-loading Isolate (which would burn network + memory).
2. **Reverb fix could subtly change all prior renders' tonal character.** Phase 2 must explicitly version the recipe shape if Drew wants to render-archive comparability with pre-fix outputs. Recommend NOT versioning — older renders are stored on R2 and remain accessible; new renders use the new graph.
3. **Job persistence requires localStorage** (per the GLStems precedent). Private-mode browsers / quota-exhausted devices won't get resume. This is the same trade-off Stab #14 accepted; no different.

### 7.2 Risks the proposal explicitly does NOT accept

1. **Don't build a browser DAW.** Forbidden by `feedback_workbench_no_new_destinations`. Live preview reuses the existing Isolate Mode graph; it does not introduce mastering, EQ, multi-band compression, or any other DAW affordance.
2. **Don't replace MODE 2 with MODE 1.** Server render remains the source of truth for the artifact. Browser preview is preview only.
3. **Don't break the Phase 4 progress markers.** They work and Drew explicitly likes them. Job-persistence adds, never replaces.
4. **Don't add a parallel job-state container.** Reuse `localStorage` + the GLStems job-shape pattern.

### 7.3 What's intentionally not in this proposal

- **Convolution reverb tuning beyond Bug D.** Picking the right impulse response is a creative decision, not an audit decision.
- **Cost/billing for renders.** Modal CPU at ~$0.003/render × N users × M renders per week is rounding-error today. Revisit when there's actual scale.
- **Migration of legacy `_customMixInFlight` records.** None exist on disk today (it's closure-scope); Phase 1 starts fresh.

---

## 8. Open questions for Drew

1. **Confirm the reverb verdict in §5 before any code change.** Run the §5.7 A/B test? Or proceed on the audit-level evidence?
2. **Phase 1 module location:** new `js/core/gl-multitrack-renders.js`, or extend `js/core/gl-stems.js` to be a "long-running media jobs" container?
3. **Phase 2 Bug C remediation choice:** dry-attenuation as wet rises (recommended, simpler), or per-branch alimiter (more correct, more expensive)?
4. **Phase 3 cleanup semantics:** when user closes Custom Mix modal mid-preview without clicking Render, restore Isolate Mode values OR commit the preview values? (Recommend restore — preview is non-destructive.)
5. **Sequencing:** Phase 1 → 2 → 3 in that order? Or Phase 2 (reverb fix) first because it's user-visible quality, with Phase 1 (persistence) as a prereq for the Live Preview banner work in Phase 3?

---

## 9. References

### Code under audit
- `js/features/multitrack-rehearsal.js`
  - `_mtCustomMixRunRender` at `:2188-2324` — recipe construction + poll loop
  - `_mtCustomMixRender` at `:2338-2383` — full render dispatch
  - `_mtCustomMixPreview` at `:2391-2444` — 30s preview slice
  - `_mtOpenCustomMixModal` at `:1952-2074` — modal UI
  - `_mtRenderProgressHtml` at `:2130-2183` — Phase 4 phase narration
  - `_mtExportRehearsalMix` at `:1806-1900` — Isolate Mode export path (per-track granular recipe)
  - `_mtInitWebAudio` at `:2669-2729` — existing per-track GainNode + ConvolverNode graph
  - `_mtState` at `:89` — closure-scoped player container (where `_customMixInFlight` lives)
  - `_mtClosePlayer` at `:2543-2566` — where `_mtState.player = null` strands jobs
- `worker.js`
  - `handleMultitrackRenderStart` at `:2204-2257`
  - `handleMultitrackRenderCheck` at `:2259-2300`
  - `handleMultitrackRenderStatus` at `:2306-2361`
- `services/multitrack-render/render.py`
  - `render_mix` at `:135-622` — main pipeline
  - Filter graph construction at `:430-510` (Bugs B/C/D evidence)
  - `render_endpoint` at `:631-716` — start/check dispatcher
  - `RENDER_PROGRESS_DICT` at `:106-109` — Phase 4 progress

### Persistence pattern reference (Stab #14)
- `js/core/gl-stems.js`
  - `_ACTIVE_KEY = 'gl_stem_jobs_active'` at `:38`
  - `_loadActiveJobs/_saveActiveJobs/_putActiveJob/_updateActiveJob/_removeActiveJob` at `:48-99`
  - `_resumeActiveJobsOnBoot` at `:434-474`
  - `getStats` at `:115-134`
  - `getActiveJobs` at `:174-177`

### Spec / audit context
- `02_GrooveLinx/audits/MULTITRACK_BROWSER_PLAYBACK_AUDIT.md` — 17-stream sync collapse, 6-connection cap, structural infeasibility of full-stream live mixing
- `02_GrooveLinx/specs/rehearsal_render_pipeline.md` — north-star separation of browser-review vs server-render
- `02_GrooveLinx/specs/multitrack_reaper_export_checklist.md` — REAPER export, FLAC params, sample-alignment
- `02_GrooveLinx/specs/operational_visibility_v1.md` — Phase 4 progress-marker pattern, Runtime Health Overlay extension pattern
- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` — monkey-patch prohibition; reuse-not-reinvent rule
- `CLAUDE.md` SYSTEM LOCKs — `_navSeq`, `focusChanged`, `ACTIVE_STATUSES`, Firebase error filter (none touched by this proposal)

### Memory references
- `feedback_workbench_no_new_destinations` — browser = review, server = render
- `feedback_consolidate_dont_retire` — extend existing canonical patterns; don't invent parallels
- `feedback_ground_truth_over_theater` — live preview must be honestly bounded; the LIVE/EST badge precedent applies
- `project_multitrack_seek_sync_bug` — Bug #17 architectural memory
- `project_multitrack_rehearsal` — intelligence-not-storage north star

### Verification tests proposed
- `§4.2 ffprobe stem-alignment audit` — already proposed in `MULTITRACK_BROWSER_PLAYBACK_AUDIT.md §4`
- `§5.4 / §5.7 A/B render diff` — new; Drew runs against a single-vocal session to confirm/falsify Bug C dominance
