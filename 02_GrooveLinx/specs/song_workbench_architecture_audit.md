# GrooveLinx Architecture Audit: Song Workbench Unification

**Date:** 2026-05-09
**Scope:** Read-only inventory of all surfaces, players, chart/lyrics renderers, and notes systems, plus a target architecture and the smallest next step.
**Revision:** 1
**Author:** Claude (Opus 4.7) — inventory by Explore agent, synthesis (sections 8–9) by primary.

---

## Section 1: Current Music Surfaces

Every UI surface that displays or plays a song.

| Surface Name | File(s) | Render Entry Point | Route / Navigation | What It Shows | State Ownership | Player Engine | Chart/Lyrics Component | Notes/Issues |
|---|---|---|---|---|---|---|---|---|
| **Song Detail Page** | `js/features/song-detail.js:28` | `renderSongDetail(songTitle, containerOverride, options)` | Page: `songs` → Select song → Full-page detail | 6 lenses: Band (chart), Listen (versions), Learn (practice), Sing (harmony), Stems (mixer), Inspire | Module-private `_sdCurrentSong`, `_sdCurrentLens`; GLStore mirrors `_sdCurrentSongMeta` (key/bpm/lead) | None in Band lens; Stems lens has WebAudio mixer + tempo/pitch | Band Chart: `_sdRenderBandChart()` inline text; Stems: `_sdRenderStemsPlayer()` with activity strips | Chart loaded from Firebase via `loadBandDataFromDrive()` cached in `gl_chart_*` localStorage; Stems metadata in `_sdLastStemsRec` |
| **Stems Lens** | `js/features/song-detail.js:1692` | `_sdPopulateStemsLens(title)` | Song Detail → Stems tab | Per-stem faders (volume, pan, mute, solo), playhead scrubber, loop markers, practice presets, speed/key controls | `_sdLoop` (in/out/enabled), `_sdStemsState` (WebAudio context), `_sdActivePreset` | WebAudio via merged track list from GLAudioSession | Activity strip canvas + loop band overlay per stem | Loop state: module variable, persists across re-renders per song; Count-in enabled: `window._sdCountInEnabled` |
| **Practice Mode / Chart Overlay** | `rehearsal-mode.js:103` | `openRehearsalMode(songTitle, mode)` | From song-detail "Practice" button or practice queue | 5 tabs: Chart (chord text, transpose/BPM/metronome/brain-trainer/autoscroll), Know (song info), Memory (palace), Harmony (listen tools), Record (multitrack) | `rmQueue[]`, `rmIndex`, `rmCurrentTab`, `rmFontSize`, `_rmIsPracticeMode` flag | No playback in chart tab; YouTube embed in footer "🎥" button | Chart text from `rmLoadChart()` → Firebase; Brain trainer hides % of lyrics; Autoscroll sync to section markers | Chart notes banner: `_rmCheckChartNotes()` → ChartSystem.loadOverlayNotes(); Notes input via `rmAddNote()` → `rehearsal_notes` Firebase path |
| **Live Gig Chart (Rehearsal Mode)** | `rehearsal-mode.js:524` + `js/features/live-gig.js` | `openRehearsalMode()` when `_rmIsPracticeMode = false` OR `openGigMode()` from gigs page | From Gig page: "Open Setlist" button | Same 5-tab overlay but Gig-specific: header shows "NOW PLAYING", footer shows next/prev song nav, sync bar (band member tracking) | Same `rmQueue/rmIndex` as practice; Gig timing metadata in `_rmSessionStart`, `_rmBlockTimings[]` | None in chart (YouTube in footer) | Same chart system as practice | Gig-specific notes: `gig_notes` Firebase path (loaded `line:539`) |
| **Playlist Player** | `js/features/setlist-player.js:15` | `SetlistPlayer.open(setlistObj)` (exposed as window.SetlistPlayer) | From Setlist page: "▶ Play" button launches overlay | Full-screen overlay with large play/pause buttons, song title, prev/next nav, volume (for YouTube embed), source toggle (YouTube/Spotify/Archive) | `_queue[]`, `_currentIdx`, `_isPlaying`, `_currentSource`, `_setlistId`, `_setlistName` | GLPlayerEngine OR SetlistPlayer's inline YouTube/Spotify/Archive embed logic | None — player-focused, no chart | No notes in player; song metadata from `allSongs` global |
| **Setlist Player (in-page)** | `js/features/setlists.js` | `renderSetlistsPage(el)` | Page: `setlists` | Setlist table with play icons; clicking a song in table may launch inline player or full SetlistPlayer overlay | Per-setlist state in setlist object; Current song in page-level variable | Setlist-player.js's multi-source fallback (YouTube → Spotify → Archive) | ChartSystem.renderSetlistCharts() renders charts inline per song if available | Limited notes UI |
| **Song Drawer (RHS Panel)** | `js/features/song-drawer.js:6` | Implicit render from song-detail.js right-panel logic | Slides open from songs page when a song is selected (mobile-aware) | Song metadata pill (band, key, BPM, lead singer), readiness strip, structure, love/play indicators | Shares `_sdCurrentSong` with song-detail; `_sdRightPanel` globals | None | Band chart inline (same as song-detail) | Right-panel info populated by `_sdPopulateRightPanel()` |
| **Rehearsal Review / Session Summary** | `rehearsal.js:431` + `rehearsal-mode.js:_rmCheckChartNotes()` | Entry via calendar/rehearsal page; overlay opens with session data | From calendar, click a past rehearsal | Rehearsal session scorecard, song-by-song readiness deltas, notes/issues from that session | Session object from Firebase: `sessions/{date}/{slug}` | None (review/summary only) | Chart visible if opened from overlay | Session notes tied to `rehearsal_notes` per song |
| **Song Admin / Charts Page** | `js/features/charts.js:46` | `ChartSystem.renderChartPanel(containerId, songTitle)` | Page: `charts` (if exists) or inline in song-detail right panel | Band chart text with edit/import/link controls, master chart view toggle, chart-specific notes overlay | Inline to container | None | ChartSystem text renderer with toggle between band/master versions | Chart notes: `ChartSystem.loadOverlayNotes()` → `chart_overlay_notes` Firebase path |
| **Harmony Lab (Sing Lens detail)** | `js/features/harmony-lab.js:33` | `renderHarmonyLab(containerEl, songTitle)` | Song Detail → Sing lens | Stacked vocal tracks (lead/backing from LALAL or Demucs), harmony notation, playback buttons per part | `_hlActivePart`, harmony session state | WebAudio playback for harmony snippets | Harmony notation: ABC.js or inline markup; Staves for SATB | Harmony critique: none yet (future feature) |
| **Best Shot Takes Picker** | `js/features/song-detail.js:1813` | `_sdLoadStemsSourcePicker(title)` | Stems Lens → Best Shot section (renders dynamically) | Buttons per uploaded take (label, uploader, crowned status), playable preview or "Use this" for stem separation input | Fetched from `best_shot_takes` Firebase path; rendered ad-hoc | None (source picker only) | None | Takes metadata: label, audioUrl, uploadedByName, crowned flag |

---

## Section 2: Current Player Engines

Every audio player implementation.

| Engine Name | File / Key Functions | Supported Controls | State Storage | Reusable? | Notes |
|---|---|---|---|---|---|
| **Stems WebAudio Mixer** | `js/features/song-detail.js:_sdInitStemsPlayer()` line ~2500+ | Play/Pause (Space), Seek ±10/30s, Tempo (50-150%), Pitch shift (±2 semitones via Tone.js), Per-stem volume, Pan L/R, Mute, Solo, Practice presets (mute-stem), Loop in/out (Shift-click or `[`/`]` keys), Count-in | `_sdStemsState` (module var); Scrub: DOM `#sdStemsScrub`; Volumes: `.sd-stem-vol` sliders; Loop: `_sdLoop` module var | ✅ SAFE TO LIFT — WebAudio chain self-contained, reads merged track list via GLAudioSession.mergeTracks() | Drift compensation via `_sdStemsState.driftTimer` setInterval to keep stems sync'd; multi-platform gesture-arming |
| **SetlistPlayer inline player** | `js/features/setlist-player.js:300+` | Play, Pause, Next, Prev, Seek (YouTube only via YT.Player), Volume (if YouTube embed) | `_queue[]`, `_currentIdx`, `_isPlaying`, `_currentSource` | ❌ TIGHTLY COUPLED — mixes source detection, embed creation, and playback state | Falls back YouTube → Spotify → Archive; caches resolved IDs in localStorage |
| **GLPlayerEngine** | `js/core/gl-player-engine.js:14` | Play, Pause, Next, Prev, Seek (YouTube only), Toggle mute | `_state`, `_queue[]`, `_currentIdx`, `_ytPlayer` (YT.Player instance) | ✅ SAFE TO LIFT — Clear state machine, event emitter, dedicated queue management | Generic queue + YouTube/Spotify/Archive routing; emits `stateChange`, `songChange`, `sourceResolved` events |
| **Rehearsal-Mode Chart (no playback)** | `rehearsal-mode.js:523` `rmLoadChart()` | —Chart-only, no playback— | Chart text in `rmChartText.innerHTML`; BPM in `#rmBpmDisplay` | N/A | Provides metronome via `rmStartCountOff()` but not song playback |
| **Rehearsal-Mode YouTube Footer** | `rehearsal-mode.js:_rmShowYouTubeModal()` | Play, Pause, Seek (via YouTube IFrame API) | YT.Player instance in modal | ❌ MODAL ONLY — Side effect, not integrated with main chart | Optional background listening |
| **Harmony Lab playback** | `js/features/harmony-lab.js:~800+` | Play, Pause per-part snippet | Inline `<audio>` elements per harmony part | ❌ TIGHTLY COUPLED — each part has own audio element, not unified mixer | Phase B of gl-audio-session will unify this |
| **Spotify Web Playback SDK** | `js/core/gl-spotify-player.js:16` | Play, Pause, Next, Prev, Seek, Volume | `window.Spotify.Player` instance; token in cookies/localStorage | ⚠️ PARTIALLY COUPLED — SDK-provided, our wrapper delegates control but embeds SDK init | Requires Spotify Premium; embed-mode in setlist-player fallback |
| **Archive.org Embed** | `js/features/setlist-player.js:251` `_tryArchive()` | Auto-play only (fixed player) | Archive embed params | ❌ READ-ONLY EMBED — No playback control, external service | Fallback when YouTube/Spotify exhausted |

---

## Section 3: Current Chart/Lyrics Systems

| Component Name | File / Function | Data Source | Annotations Supported | Personal vs Band Split | Gig-Only Overlay | Karaoke Scroll | Notes |
|---|---|---|---|---|---|---|---|
| **Band Chart (Song Detail)** | `js/features/song-detail.js:_sdRenderBandChart()` line 234 | Firebase: `loadBandDataFromDrive(title, 'chart')` cached in `gl_chart_*` localStorage | Yes: `chart_overlay_notes` via ChartSystem (line 164 rehearsal-mode.js) | ✅ Split: Chart band-shared, notes per-person | ✅ Yes: Gig-mode loads `gig_notes` separately (rehearsal-mode.js:539) | No — static `<pre>` display | HTML entities decoded via `glDecodeHtmlEntities()` |
| **Rehearsal-Mode Chart** | `rehearsal-mode.js:rmLoadChart()` line 524 | Firebase: `loadBandDataFromDrive(song.title, 'chart')` | ✅ Yes: ChartSystem.loadOverlayNotes() → `chart_overlay_notes` (line 157) | ✅ Split: same as above | ✅ Yes: Gig notes in sync bar (line 539) | ✅ Yes: `rmToggleAutoScroll()` with configurable speed (1-5) | Transposition adjusts displayed key; brain-trainer hides percentage of words |
| **Master Chart View** | `js/features/charts.js:_showMaster()` line 77 | Firebase: `loadBandDataFromDrive(title, 'chart_master')` (if differs from band chart) | Notes separate for master version | ✅ Split: master and band both band-shared | No | No | Toggle in chart admin page |
| **Setlist Charts Panel** | `js/features/charts.js:renderSetlistCharts()` line 195 | Per-song: loop setlist, fetch each via `loadBandDataFromDrive(song.title, 'chart')` | Limited: inline per-song, no notes UI | ✅ Split: band chart | No | No | Renders setlist as accordion of charts |
| **Harmony Notation (ABC.js)** | `js/features/harmony-lab.js:~900+` | localStorage cache: `gl_harmony_abc_*` + Firebase `abc_notation` per song | Chord symbols only, no sectional marks | ✅ Split: harmony band-shared | No | No | SATB staves via ABC.js rendering library |
| **Chart Import Dialog** | `js/features/chart-import.js:renderImportModal()` line ~1 | User paste → validate → preview before save | Pre-import notes/marks not supported | N/A — paste flow | No | No | Ultimate Guitar scraper integration; paste detection for chord charts |
| **Live Gig Chart Overlay** | Same as Rehearsal-Mode Chart (line 524) | Same Firebase path | ✅ Yes: gig-specific notes in sync bar + chart overlay notes | ✅ Split: gig notes (`gig_notes`) separate from chart notes | ✅ Yes: Gig sync bar shows band member readiness | ✅ Yes: same autoscroll | Gig context: NOW PLAYING header + prev/next nav + performance confidence cue |

---

## Section 4: Current Notes/Tasks/Issues Systems

| Notes Type | Firebase / Storage Path | File / Function That R/W | Audience | Resolvable? | Tied To | Current UI |
|---|---|---|---|---|---|---|
| **Rehearsal Notes (chart overlay)** | `bands/{slug}/songs/{title}/rehearsal_notes` (array) | `rehearsal-mode.js:rmSaveNote()` line 2908 (write); `ChartSystem.loadOverlayNotes()` line 164 (read) | Band-shared | ✅ Yes (manually archived by deletion) | Song + rehearsal session | Chart overlay sheet modal input; banner display |
| **Chart Overlay Notes** | `bands/{slug}/songs/{title}/chart_overlay_notes` (array of { text, author, date, priority, yPosition? }) | `js/features/charts.js:ChartSystem._addNote()` line 395; `ChartSystem.loadOverlayNotes()` line 318 | Band-shared | ✅ Yes: `ChartSystem._removeNote()` (line 349) | Song + chart session | Floating note badges on chart; click to expand |
| **Gig-Specific Notes** | `bands/{slug}/songs/{title}/gig_notes` | `rehearsal-mode.js` line 539 (load during gig mode) | Band-shared but gig-scoped | ❓ Not resolvable in current UI | Song + Gig ID | Loaded during gig overlay; display TBD |
| **Personal Practice Notes** | `users/{userId}/practice_sessions/{sessionId}/notes` (aspirational; currently in PracticeSession only) | `js/core/gl-practice-session.js:_writeRaw()` line 80; `PracticeSession.update()` (line 246) | Private to user | ❌ No — session-scoped | Practice session (song + mode) | Stored in localStorage only; no UI display yet |
| **Song Structure / Section Ratings** | `bands/{slug}/songs/{title}/section_ratings` | `gl-decision-language.js` / `song-intelligence.js` (read); writes via GLStore | Band-shared aggregates | ✅ Yes: per-member ratings | Song + section ID | Readiness strip in song-detail (line 297) |
| **Task / Issue List** | No unified tasks system currently (aspirational for Workbench) | N/A | — | — | — | — |
| **Audio Critique Notes (stems)** | Not yet implemented (Phase 2 aspiration) | N/A | — | — | Stem (per-instrument track) + timestamp | Planned for Stems Workbench |
| **Live Rehearsal Session Notes** | `bands/{slug}/rehearsal_sessions/{dateISO}/notes` (created on rehearsal end) | Rehearsal-mode.js session-save flow | Band-shared | ✅ Yes: clearable from session detail | Rehearsal session | Rehearsal review page (if UI exists) |
| **Readiness Crib Notes (song-detail)** | `bands/{slug}/songs/{title}/crib_notes` or `personal_tabs` | `song-detail.js:_sdPopulateBandLens()` line 326; renders via `_sdRenderCribNotes()` | ✅ Split: personal_tabs personal, crib_notes band | ❌ Not resolvable (static reference) | Song | Song-detail card (collapsible "Stage Notes") |

---

## Section 5: Current Stems/Audio Critique Capability

| Capability | Status | File / Function | What's Missing | Notes |
|---|---|---|---|---|
| **Stem Separation (Demucs)** | ✅ LIVE | `js/core/gl-stems.js:separate()` line 59; Modal GPU via Cloudflare worker | — | 4-stem (htdemucs) or 6-stem (htdemucs_6s, default); ~30s warm run |
| **Lead/Backing Split (LALAL.AI)** | ✅ LIVE | `js/core/gl-stems.js:splitLeadBacking()` line 183 | — | Replaces Demucs vocals row with Lead + Backing automatically via GLAudioSession.mergeTracks() |
| **Spatial Split (pan + tone fingerprint)** | ✅ LIVE | `js/core/gl-stems.js` + song-detail.js line 2032 (UI trigger) | Full fingerprint library UI | Phase 2: splits stems by stereo pan; can bias toward reference clip |
| **Per-Stem Volume/Pan/Mute/Solo** | ✅ LIVE | `js/features/song-detail.js:_sdInitStemsPlayer()` | — | WebAudio chain with per-stem GainNode, StereoPannerNode |
| **Per-Stem Loop/Practice Preset** | ✅ LIVE | `js/features/song-detail.js:_sdStemsApplyPreset()` line ~2700 | — | Mute single stem to practice that part; loop in/out per section |
| **Take/Recording Upload** | ✅ LIVE (partial) | `js/features/bestshot.js:renderBestshotPage()` | — | Upload takes to Firebase; flag "crowned" (best); stems picker auto-loads takes |
| **Per-Stem Notes (critique)** | ❌ NOT YET | — | Async note overlay per stem row; timestamp marker in waveform; private notes option | Future Workbench feature |
| **Multitrack Rehearsal Recording** | ⚠️ PARTIAL | `js/features/rehearsal-mixdowns.js:_rmRecordInit()` line ~1 | Real-time isolation recording; playback + review UI | Aspirational for "record and critique" flow |
| **Recorded Rehearsal Playback** | ❌ NOT YET | — | Load past rehearsal recordings; scrub + re-listen for critique | — |
| **Loop State Persistence** | ✅ LIVE | `_sdLoop` module var (song-scoped, clears on song change) | Cross-session resume (save loop point to PracticeSession) | Current: resets on page reload |

---

## Section 6: Current State Ownership

| Concept | Owner | Location (file:line) | Type | Scope |
|---|---|---|---|---|
| **Currently selected song** | Multiple (legacy split) | `app.js:404` `let selectedSong = null`; mirrored in `GLStore` via `gl-selection.js` | Global var + GLStore method | Page-level (songs → detail → chart) |
| **Current song detail lens** | song-detail.js | `js/features/song-detail.js:_sdCurrentLens` (line 8, default 'band') | Module private var | Song-detail page lifespan |
| **Chart overlay current song** | rehearsal-mode.js | `js/rehearsal-mode.js:rmQueue[]`, `rmIndex` (lines 20-21) | Module vars | Overlay lifespan |
| **Current playback position (stems)** | WebAudio engine | `<audio>` `.currentTime` per stem + DOM `#sdStemsScrub` (song-detail.js:2152) | DOM + WebAudio element state | Stems mixer session |
| **Current playback position (setlist)** | SetlistPlayer or GLPlayerEngine | YouTube IFrame Player state if YouTube, else display-only | External player API state | Player overlay lifespan |
| **Active practice mode** | GLStore.PracticeSession | `js/core/gl-practice-session.js:_readRaw()` reads localStorage `gl_practice_session_v1` (line 65) | localStorage JSON + in-memory cache | Practice session lifespan (resumed on app load) |
| **Active chart being viewed** | rehearsal-mode.js | `rmChartText.innerHTML` (DOM), sourced from Firebase via `rmLoadChart()` (line 524) | DOM innerHTML + Firebase fetch | Chart overlay lifespan |
| **Notes visibility (chart overlay)** | ChartSystem + rehearsal-mode.js | `chart_overlay_notes` Firebase loaded on tab switch (rehearsal-mode.js:164); DOM toggle (charts.js:349) | Firebase + DOM display state | Per-song per-session |
| **Loop in/out markers** | song-detail.js | `js/features/song-detail.js:_sdLoop = { inSec, outSec, enabled }` (line 2957) | Module private object | Song-detail stems lens (resets on song change line 1709) |
| **Stems audio state (vol/pan/mute/solo)** | WebAudio + DOM | GainNodes/PannerNodes in `_sdStemsState.gainNodes[]` + DOM `.sd-stem-vol`, `.sd-stem-pan`, `.sd-stem-mute`, `.sd-stem-solo` | WebAudio nodes + DOM input values | Stems mixer session |
| **Selected take/recording** | Best Shot picker | DOM `.sd-stems-pick` button click handler; sourced from `best_shot_takes` (song-detail.js:1818) | Firebase + DOM event handler | Stems lens session |
| **Sync session (band sync tracking)** | rehearsal-mode.js | `_rmSyncBar` (dynamic render, line 322-323) sources from FirebaseCollection listener | Firebase Realtime DB listener + DOM | Rehearsal/gig session |
| **Now-playing song id (setlist player)** | SetlistPlayer or GLPlayerEngine | `_currentIdx` module var (setlist-player.js:20) or GLPlayerEngine state (gl-player-engine.js:22) | Module private var | Player overlay lifespan |
| **Live gig mode flag** | rehearsal-mode.js | `_rmIsPracticeMode` (false = gig mode; line 39) | Module flag | Overlay lifespan |
| **Song readiness (band average)** | GLStore | `GLStore.getSongIntelligence(title)` (song-detail.js:386) | Computed from member ratings + cached | Page lifespan (preloaded in boot) |
| **Song status (prospect/learning/rotation/shelved)** | GLStore + Firebase | `GLStore.getStatus(title)` (song-detail.js:354) | Computed from firebase `song_status` or metadata | App lifespan |
| **Band members map** | Global + GLStore | `bandMembers` global object (app.js) + `GLStore.getMembers()` | Global object + GLStore method | App lifespan |

---

## Section 7: Duplications and Conflicts

### Duplication 7.1 — Multiple Chart Renderers

**Affected:**
1. Song-detail Band Chart (`song-detail.js:_sdRenderBandChart()` line 234)
2. Rehearsal-Mode Chart (`rehearsal-mode.js:rmLoadChart()` line 524)
3. Setlist Charts Inline (`charts.js:renderSetlistCharts()` line 195)
4. Master Chart View Toggle (`charts.js:_showMaster()` line 77)

**Divergence:** Song-detail caches chart in localStorage `gl_chart_*`; rehearsal-mode caches in module-level `_rmCache`; setlist charts bypass cache entirely.
**Risk:** MEDIUM — all read same Firebase path, all decode entities, but transposition only in rehearsal-mode.
**Unification target:** Central `ChartRenderer` with caching + optional transposition layer.

### Duplication 7.2 — Multiple "Now Playing" Representations

**Affected:** `selectedSong` global, `rmQueue[rmIndex]`, `SetlistPlayer._queue`, `GLPlayerEngine._queue`, `PracticeSession.songId` — five independent records of "what am I looking at."
**Divergence:** Different shapes (string vs object), different metadata (some include youtubeId/spotifyTrackId).
**Risk:** HIGH — load-bearing for nav/persistence; cannot refactor without touching app.js, navigation.js, and 5+ pages. SYSTEM LOCK on `currentPage` (`navigation.js:20`).
**Unification target:** GLStore as single source of truth (already partially done via `selectSong`/`getSelectedSong`/`PracticeSession.get`).

### Duplication 7.3 — Multiple Play/Pause/Seek Control Bars

**Affected:** Stems mixer (song-detail.js:2147), SetlistPlayer transport (~350), Rehearsal-mode YouTube footer (rehearsal-mode.js:388), Harmony Lab per-part (~850).
**Divergence:** Stems has speed/key; SetlistPlayer has source toggle; YouTube footer is external embed; Harmony has per-snippet only.
**Risk:** MEDIUM-HIGH — SetlistPlayer/GLPlayerEngine partially abstracted; Stems is audio-domain-specific.
**Unification target:** Shared engine contract; Stems exposes same interface for macro integration.

### Duplication 7.4 — Multiple Notes UIs

**Affected:** ChartSystem floating badges (charts.js:318), rehearsal sheet modal (rehearsal-mode.js:2908), gig_notes load (rehearsal-mode.js:539, no display), PracticeSession (no critique UI), crib notes (song-detail).
**Divergence:** 5 different Firebase paths (chart_overlay_notes, rehearsal_notes, gig_notes, crib_notes/personal_tabs) and one localStorage. No cross-reading — chart notes don't appear in rehearsal; rehearsal notes don't appear on chart.
**Risk:** MEDIUM — each has distinct audience.
**Unification target:** Unified Notes API with audience/visibility model.

### Duplication 7.5 — Multiple Loop / Section Selection Patterns

**Affected:** Stems `_sdLoop`, rehearsal-mode `_rmSections[]`/`_rmActiveSectionIdx`, Harmony Lab section selection (no UI), PracticeSession.section (stored but not wired).
**Divergence:** Stems uses seconds (ephemeral); rehearsal-mode uses charted section anchors (persistent); PracticeSession holds section but UI doesn't restore it.
**Risk:** MEDIUM — loop only persists in Stems until reload.
**Unification target:** Unified `Section { id, name, startSec, endSec }` + `Loop { sectionId, enabled }` stored in PracticeSession.

### Duplication 7.6 — Multiple Practice Flows (Focus, Part, Harmony, Learn, Chart)

**Affected:** Practice Resume (practice.js:278), Song-detail "Practice This Song" card (song-detail.js:264), Stems lens presets (~2700), Harmony Lab entry (harmony-lab.js:33), Rehearsal mode practice intent (rehearsal-mode.js:114).
**Divergence:** Each entry point hardcodes its own routing; not all respect `PracticeSession.mode`.
**Risk:** MEDIUM-HIGH — entry points multiplying with each new feature.
**Unification target:** Central dispatcher `PracticeWorkbench.start(songTitle, mode, options)` resolves song + stems + chart + harmony, opens overlay, sets PracticeSession.

### Duplication 7.7 — Multiple Harmony / Vocal Isolation Flows

**Affected:** LALAL split (gl-stems.js:183), Harmony Lab (harmony-lab.js:33), Stems lens harmony banner (song-detail.js:2170), Rehearsal-mode Harmony tab.
**Divergence:** Multiple "do we have LALAL?" checks (GLAudioSession.hasLalalSplit:165, song-detail.js:1999).
**Risk:** MEDIUM — LALAL is expensive (25 min timeout) and runs once per song; redundant detection logic.
**Unification target:** `GLStems.getLalalStatus(songTitle)` + `GLStems.onLalalComplete(callback)`.

### Duplication 7.8 — Live Gig vs Solo Practice Branch Logic

**Affected:** `_rmIsPracticeMode` flag (rehearsal-mode.js:39), dead `mode` parameter on song-detail (line 415), practice.js vs live-gig.js entry points, sync bar gating.
**Risk:** LOW — flag is clear; song-detail mode parameter is dead code (✅ SAFE TO DELETE).
**Unification target:** Formalize `context: { intent, visibility, sync_enabled }` in PracticeSession.

---

## Section 7.A: System Locks (do not refactor without coordination)

These are critical to live UAT and must not be touched without band coordination.

### Lock 1 — Navigation Sequence Counter (`_navSeq`)
- **File:** `js/ui/navigation.js:20`
- **Why:** Prevents stale async renders from setting `GL_PAGE_READY` after a newer page nav has started.
- **Risk if changed:** Page-ready signal fires from stale render → page visibility breaks.

### Lock 2 — Focus Changed Event (`focusChanged`)
- **File:** `js/core/groovelinx_store.js` (`invalidateFocusCache()`)
- **Why:** Triggers cross-module re-render for the user's current focus song.
- **Risk if changed:** Harmony Lab readiness sync, feed notifications, home dashboard miss focus changes.

### Lock 3 — Firebase Error Filter
- **File:** `index.html` (filter for `firebaseio.com/.lp` long-poll noise)
- **Why:** Suppresses transient long-poll disconnect noise. Gig mode depends on graceful fallbacks under flaky venue wifi.
- **Risk if changed:** Gig mode could surface transient errors mid-performance.

### Lock 4 — Active Song Status Values (`ACTIVE_STATUSES`)
- **File:** `js/core/groovelinx_store.js` — `GLStore.ACTIVE_STATUSES`, `GLStore.isActiveSong()`
- **Why:** Setlist curation depends on exact status values; song filtering on home/practice keys off these.
- **Risk if changed:** Active songs vanish from rehearsal queue or home dashboard.

---

## Section 7.B: Safe-to-Refactor Components

| Component | File:Line | Status | Why Safe | Suggested Action |
|---|---|---|---|---|
| Dead song-detail mode parameter | `song-detail.js:415` | Unused | Parameter exists but never passed | DELETE — remove mode parameter, delete play/sharpen/lock-in branches |
| Chart-import UG scraper | `chart-import.js:~100` | Isolated | Only called from chart edit modal | LIFT — move to ChartRenderer module as `importFromUltimateGuitar()` |
| SetlistPlayer source preference caching | `setlist-player.js:34-43` | Tightly coupled to SetlistPlayer | localStorage `gl_player_source_pref` only read here | EXTRACT — shared `SourcePreference` module if GLPlayerEngine needs it |
| Harmony Lab SATB notation rendering | `harmony-lab.js:~600` | Self-contained | Only ABC.js library; no other module reads its DOM | LIFT — move to harmonyRenderer.js module |
| Rehearsal session timing logic | `rehearsal-mode.js:31-34` | Isolated | `_rmSessionStart`, `_rmBlockStartTime`, `_rmBlockTimings[]` modified/read only within rehearsal-mode | EXTRACT — move to sessionTimer.js module |
| Pocket Meter (tap-tempo) | `rehearsal-mode.js:361` `rmOpenPocketMeter()` | External tool | Launches separate page; no state coupling | KEEP — Workbench can embed metronome directly later |

---

## Section 8: Recommended Unification Architecture

### 8.1 Core insight

Eleven music surfaces, but only three real "modes of looking at a song":
- **Study** (private, no time pressure): admin, song-detail, charts page, harmony lab
- **Prepare** (private, time-bounded): solo practice with stems/chart/loop
- **Perform** (band, real-time): rehearsal, gig, sync bar visible

Today these modes are spread across separate files (song-detail.js, practice.js, rehearsal-mode.js, charts.js, live-gig.js) with each re-implementing chart, notes, and player logic. The Workbench thesis is **one surface, one set of components, three context overlays**.

### 8.2 Target architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SongWorkbench(songId, intent)               │
│  intent: study | prepare | perform                              │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Chart Pane   │  │ Player Pane     │  │ Notes Pane         │  │
│  │ ChartRenderer│  │ PlayerEngine    │  │ Notes API          │  │
│  │ (transpose,  │  │ (Stems |        │  │ (chart | rehearsal │  │
│  │  scroll,     │  │  Sourced |      │  │  | gig | personal  │  │
│  │  brain mode) │  │  Silent)        │  │  | stem-critique)  │  │
│  └──────────────┘  └─────────────────┘  └────────────────────┘  │
│                                                                 │
│  Shared:                                                        │
│   - PracticeSession (loop, mode, position, intent)              │
│   - WorkbenchActions registry (commands surfaced in command bar)│
│   - GrooveMate sidecar (reads Session + readiness, suggests)    │
│                                                                 │
│  Intent overlays:                                               │
│   study   → admin controls, edit chart, manage stems            │
│   prepare → loop/preset bar, GrooveMate prompts, no sync bar    │
│   perform → sync bar, NOW PLAYING header, prev/next nav         │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 The five abstractions to build

| # | Abstraction | Replaces | New API surface |
|---|---|---|---|
| 1 | **Notes API** (`js/core/gl-notes.js`) | 5 notes paths writing to Firebase directly | `Notes.read(songTitle, scope?)`, `Notes.write(songTitle, scope, text, opts)`, `Notes.subscribe(songTitle, cb)`, scope = `'chart' \| 'rehearsal' \| 'gig' \| 'personal_critique' \| 'stem'` |
| 2 | **ChartRenderer** (`js/core/gl-chart-renderer.js`) | 4 chart renderers + duplicate caches | `ChartRenderer.render(container, songTitle, { transpose, autoscroll, brainTrainer, notesOverlay, source: 'band' \| 'master' })` |
| 3 | **PlayerEngine contract** (`js/core/gl-player-contract.js`) | Stems mixer / GLPlayerEngine / SetlistPlayer / Harmony Lab playback | Interface: `play(), pause(), seek(t), setRate(r), setLoop({in,out}), on(event,cb)`. Three implementations: `StemsEngine`, `SourcedEngine` (YouTube/Spotify/Archive), `SilentEngine` (chart-only with metronome) |
| 4 | **WorkbenchActions** (`js/core/gl-workbench-actions.js`) | Hardcoded buttons in 11 surfaces | `Actions.register(id, { label, icon, condition(ctx), handler(ctx) })`. The Workbench command bar enumerates all actions where `condition(ctx)` is true given current intent + song + session |
| 5 | **PracticeSession extension** (extend `js/core/gl-practice-session.js`) | Loop/preset/position scattered in module vars | Extend schema with `intent`, `loop: {sectionId, enabled}`, `stemPreset`, `rate`, `pitch`, `position`. Persists across engine swaps and session resumes |

### 8.4 Migration order (lowest blast radius first)

| Phase | Change | Blast radius | Visible to user? |
|---|---|---|---|
| **A** | Build Notes API; migrate ChartSystem._addNote and rmSaveNote to call it. Backing Firebase paths unchanged. | One new file + 2 call sites | No (drop-in) |
| **B** | Build ChartRenderer; migrate song-detail Band lens first, then rehearsal-mode chart, then setlist accordion. | 3 sequential surface migrations | Identical visuals; faster cache |
| **C** | Define PlayerEngine contract; wrap GLPlayerEngine and StemsEngine to conform. SetlistPlayer wraps last. | Internal — 3 engines re-shaped, no consumer changes | No |
| **D** | Build SongWorkbench shell as new surface accepting `intent`. song-detail page renders inside Workbench with `intent='study'`. | New surface; existing paths still work | New top-level routing for selected song |
| **E** | Migrate rehearsal-mode chart overlay → Workbench(intent='perform'). rehearsal-mode.js becomes thin shim, eventually deleted. | High — Lock #1 zone (navigation), Lock #3 zone (gig error suppression) | Same overlay, new internals |
| **F** | Build WorkbenchActions registry + GrooveMate sidecar binding | Low — additive | New command bar + suggestions |

### 8.5 What this preserves

- All four SYSTEM LOCKS (navigation seq counter, focusChanged event, Firebase error filter, ACTIVE_STATUSES) — the Workbench is built on top of GLStore, not in place of it.
- Existing Firebase schema (Notes API uses scope adapters to write to existing paths).
- Vanilla JS, `showPage()` routing, the ban on frameworks.
- Stems WebAudio chain (already self-contained per Section 2 — wraps cleanly into PlayerEngine).

### 8.6 What this kills

- `_rmIsPracticeMode` flag (replaced by Workbench intent)
- Dead `mode` parameter on song-detail (Section 7.B)
- Duplicate chart caches (`gl_chart_*` localStorage + `_rmCache` module var)
- Per-surface notes write logic (5 → 1)
- Hardcoded entry-point routing in practice.js (`_pmOpenSolo` etc.) — replaced by Action registry

---

## Section 9: Immediate Next Step

**Build the Notes API (Phase A above) — one new file, two migrated call sites, no UI change.**

### Why this first

| Criterion | Notes API | ChartRenderer (Phase B) | PlayerEngine (Phase C) |
|---|---|---|---|
| Touches a SYSTEM LOCK | No | No | No |
| Touches navigation | No | No | No |
| Backing-store change | No (scope adapters) | No | No |
| Backwards-compatible | Yes (drop-in helper) | Requires per-surface migration | Engines re-shaped |
| Unblocks Workbench | Yes (Notes Pane needs it) | Yes (Chart Pane needs it) | Yes (Player Pane needs it) |
| Visible practice payoff | **Yes — enables PracticeSession critique notes** (Pierce's ask) | No (cosmetic) | No (cosmetic) |
| LOC | ~150 new + ~10 migrated | ~300 new + ~400 migrated across 4 files | ~400 new + 3 engines re-shaped |

Notes API is the only Phase-A candidate that **also delivers a visible practice payoff** — the long-missing Pierce ask of "let me jot a note about how this practice session went" lands as the first new use case.

### Concrete first PR

**File: `js/core/gl-notes.js`** (new, ~150 LOC)

```js
// GLNotes — unified notes API across chart/rehearsal/gig/personal/stem scopes.
// Write/read/subscribe surface; scope adapters route to existing Firebase paths.
(function (global) {
  const SCOPES = {
    chart:             { path: (slug, t) => `bands/${slug}/songs/${encodeURIComponent(t)}/chart_overlay_notes` },
    rehearsal:         { path: (slug, t) => `bands/${slug}/songs/${encodeURIComponent(t)}/rehearsal_notes` },
    gig:               { path: (slug, t) => `bands/${slug}/songs/${encodeURIComponent(t)}/gig_notes` },
    personal_critique: { path: (slug, t, uid) => `users/${uid}/song_notes/${encodeURIComponent(t)}` },
    stem:              { path: (slug, t) => `bands/${slug}/songs/${encodeURIComponent(t)}/stem_critique_notes` },
  };

  async function write(songTitle, scope, text, opts = {}) { /* ... */ }
  async function read(songTitle, scope) { /* ... */ }
  function subscribe(songTitle, cb) { /* aggregates across all scopes the user can see */ }

  global.GLNotes = { write, read, subscribe, SCOPES: Object.keys(SCOPES) };
})(window);
```

**File: `js/features/charts.js`** (~5 LOC change)
- `ChartSystem._addNote()` swaps direct Firebase write for `GLNotes.write(songTitle, 'chart', text, { author, priority })`.

**File: `rehearsal-mode.js`** (~5 LOC change)
- `rmSaveNote()` swaps direct Firebase write for `GLNotes.write(songTitle, 'rehearsal', text, { author })`.

**File: `js/core/gl-practice-session.js`** (~30 LOC addition — the new use case)
- Extend schema with `criticalNotes: []` field (locally cached; mirror to `GLNotes.write(..., 'personal_critique', ...)` on touch).
- Expose `PracticeSession.addNote(text)` and `PracticeSession.getNotes()`.

**File: `js/features/practice.js`** (~40 LOC addition)
- Practice entry screen surfaces a "📝 Quick Note" pill in the active session card. Click opens an inline textarea; submit calls `PracticeSession.addNote(text)`.

### Definition of done

1. `GLNotes` callable from console with all five scopes round-tripping read/write
2. `ChartSystem._addNote()` and `rmSaveNote()` no longer write Firebase directly (grep confirms zero `firebase.database().ref('...notes')` calls outside `gl-notes.js`)
3. Practice entry screen shows "📝 Quick Note" affordance when an active session exists
4. Smoke: open Practice → start session → add note → close → reopen → note still visible
5. Build bumped (4-file atomic), pushed to dev + prod
6. Handoff + bug log updated

### Why not start with ChartRenderer or PlayerEngine?

- ChartRenderer touches 4 surfaces and the rehearsal-mode chart overlay sits next to SYSTEM LOCK #3 (Firebase error filter) — higher coordination cost
- PlayerEngine wraps the Stems WebAudio chain, which is the most complex audio code in the codebase (drift compensation, gesture-arming, count-in) — larger PR, more regression surface
- Notes API has zero visual change, zero LOCK exposure, and a visible practice win. **It is the highest-EV smallest-risk Phase A.**

---

## Appendix A: Firebase Schema Snapshot

```
bands/{slug}/songs/{title}/
  - chart                    (text, band-shared)
  - chart_master             (text, if differs from band chart)
  - chart_overlay_notes      (array)
  - stems                    (object)
  - lalal_split              (object)
  - spatial_split            (array)
  - rehearsal_notes          (array)
  - gig_notes                (array)
  - best_shot_takes          (array)
  - lead_singer              (string)
  - song_status              (string: prospect | learning | rotation | shelved)
  - song_bpm                 (number)
  - song_key                 (string)
  - metadata                 (object)
  - section_ratings          (object: per-member per-section)
  - personal_tabs            (object, user-scoped crib notes)
  - ABC_notation             (text)

bands/{slug}/
  - fingerprints             (object)
  - practice_plan_{dateISO}  (object)

rehearsal_sessions/{dateISO}/{slug}/
  - notes                    (array)
  - timing_summary           (object)
```

---

## Appendix B: Global Variables Summary

**Load-bearing globals in app.js:**
- `selectedSong` (line 404)
- `bandMembers`
- `allSongs`
- `currentFilter`, `activeStatusFilter`

**Module-private state to migrate to Workbench:**
- `_sdCurrentLens`
- `_sdLoop`
- `rmQueue`, `rmIndex`
- `_rmIsPracticeMode`
- `_sdStemsState`

---

## Appendix C: Unaddressed / TBD Surfaces

Mentioned in requirements, not fully traced in inventory:
- **Rehearsal recording playback/critique** — `rehearsal-mixdowns.js` exists (26KB), orchestration not traced
- **Band sync real-time tracking** — Sync bar renders, full handshake not traced
- **Live gig performance scorecard** — likely in `live-gig.js`, not deeply inspected

---

## End of Audit

**Total surfaces inventoried:** 11 major + 3 aspirational
**Player engines:** 7 (1 unified pattern, 6 scattered)
**Chart renderers:** 4 (all same Firebase source, different display contexts)
**Notes systems:** 5 (3 live + 2 aspirational)
**Key duplications:** 7 (transport controls, notes UI, loop, practice entry points, harmony, gig vs practice, chart display)
**System locks:** 4
**Safe-to-delete:** 1 (song-detail mode parameter)
**Safe-to-extract:** 5+
**Recommended next step:** Build Notes API (Phase A) — see Section 9.
