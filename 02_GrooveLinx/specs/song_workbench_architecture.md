# Song Workbench — Architecture + UX Spec

**Version:** v0.1 (initial draft, 2026-05-10)
**Status:** Spec-only. No code changes yet.
**Audience:** Drew, ChatGPT, future-Claude implementing migrations
**Predecessors / required reading:**
- `02_GrooveLinx/specs/player_engine_contract.md` — PlayerEngine contract (already shipped Phase C)
- `02_GrooveLinx/specs/groovelinx-ui-principles.md` — UI rules
- `CLAUDE.md` SYSTEM LOCKs §7
- `02_GrooveLinx/specs/multitrack_reaper_export_checklist.md` — multitrack ingest

---

## 1 · Core concept

### What is the Song Workbench?

A **persistent, song-scoped shell** that contains everything the user does with one song — practice, study, rehearse, perform, review — under a single identity. Modes are camera angles inside the same room, not separate rooms.

```
┌─────────────────────────────────────────────────────────────┐
│  WORKBENCH HEADER                                           │
│  🎵 Bertha · Grateful Dead · Key A · 124 BPM · ★★★☆☆       │
├─────────────────────────────────────────────────────────────┤
│  [ Practice ] [ Stems ] [ Rehearsal ] [ Gig ] [ Review ]   │ ← mode tabs
├──────────────────────────────────────────────┬──────────────┤
│                                              │              │
│  MODE-SPECIFIC BODY                          │  RIGHT       │
│  (chart, mixer, timeline, etc.)              │  CONTEXT     │
│                                              │              │
│                                              │  · Notes     │
│                                              │  · Tasks     │
│                                              │  · GrooveMate│
│                                              │              │
└──────────────────────────────────────────────┴──────────────┘
```

The **header**, **mode tabs**, and **right context panel** are constant. Only the body swaps. Switching modes never feels like a page change — it feels like a panel swap.

### What problem it solves

1. **Identity loss:** today, a user touching one song in 3 minutes opens 4 different "pages" (song detail → setlist player → rehearsal mode chart → song detail again to make a note). Each page reloads context. The Workbench keeps the song identity locked at the top.
2. **State fragmentation:** each surface keeps its own player, its own playhead, its own notes UI, its own loop region. The Workbench has ONE player, ONE notes layer, ONE loop region — visible from every mode.
3. **GrooveMate context:** to suggest "you should work on the bridge," GrooveMate needs to know what song the user is on, what mode, what position, what they've already done. Today this is scattered. Workbench centralizes it via `PracticeSession`.

### What it replaces

| Existing surface | Becomes |
|---|---|
| Song detail page (`song-detail.js`) | Workbench shell + Stems mode body + Notes panel |
| Practice 5-tab in `rehearsal-mode.js` | Workbench Practice mode body |
| Setlist player (`setlist-player.js`) | Workbench Gig mode body (when launched from setlist) |
| Live Gig Mode | Workbench Gig mode body (full-screen variant) |
| Rehearsal recording analysis | Workbench Review mode body |
| Multitrack player (`multitrack-rehearsal.js`) | Workbench Review mode body (multitrack variant) |

### What stays separate (NOT in the Workbench)

- **Songs list** (Songs page) — the index, not a workbench
- **Setlists** (Setlists page) — playlist management
- **Gigs** (Gigs page) — gig event management
- **Calendar** — scheduling
- **Rehearsal page** — rehearsal-event planning + post-mortem (workbench review is for one song; rehearsal page is for whole sessions)
- **Admin / Settings / Band onboarding** — config, not music
- **Help / GrooveMate full chat surface** — meta, not song-scoped

The Workbench is for **one song at a time**. The list/index pages stay as navigation surfaces that launch into the Workbench.

---

## 2 · Modes

Five canonical modes. Each maps to a `PlayerContract.INTENTS` value where applicable.

| Mode | INTENTS | Primary intent | Body |
|---|---|---|---|
| **Practice** | `STUDY` | "Learn or polish this song alone" | Chart + part-isolation player + section loop |
| **Stems** | `STUDY` | "Hear individual instruments" | Multi-track stems mixer (Demucs-separated) |
| **Rehearsal** | `PERFORM` | "Lead the band through this song right now" | Big-text chart + live transitions + RSVP-aware band hints |
| **Gig** | `BROWSE` (lock) | "Play the chart on stage" | Full-screen chart + auto-scroll + minimal touch surface |
| **Review** | (no playback intent — render-only) | "Look at what we recorded" | Multitrack player OR session timeline + comments |

### Per-mode breakdown

#### 2.1 Practice mode

- **Primary intent:** solo learning or polishing. "I want to nail the bridge."
- **Default body:** chart with optional auto-scroll, single audio source (preferred reference recording or stems if available)
- **Visible UI:** chart, playhead position, loop region, part-isolation toggle (mute lead/bass/drums to play along), section nav, transcribe-this-section helper
- **Hidden UI:** band-coordination affordances, gig timer, setlist next-up
- **Primary actions:** play/pause, set loop in/out, toggle mute-stem, jump to next section, take a note on a chord/line
- **Player engine:** `INTENTS.STUDY` resolves to `gl-stems-engine-contract.js` if stems exist for the song; else falls back to `INTENTS.QUEUE` with a single-song queue
- **Persistence:** PracticeSession (mode='practice', section, lastPosition, mutedStems)

#### 2.2 Stems mode

- **Primary intent:** isolate or remove specific instruments. "Mute drums, hear what bass is doing."
- **Default body:** Stems mixer (existing `_sdStemsAPI` accessor surface in `song-detail.js`, wrapped via `gl-stems-engine-contract.js`)
- **Visible UI:** per-stem volume + mute + solo + pan, master scrub, count-in toggle, loop in/out, fullscreen toggle
- **Hidden UI:** chart (collapsed to a thin overlay), gig affordances
- **Primary actions:** mute/solo a stem, scrub, set loop, mark a moment with a note (anchors timestamp + stem identity to GLNotes)
- **Player engine:** `INTENTS.STUDY` → Stems mixer
- **Notes scope:** new `stem` scope (currently defined but unwritten — Workbench activates it)
- **Persistence:** PracticeSession (mode='stems', mutedStems, soloed, lastPosition, loop)

#### 2.3 Rehearsal mode

- **Primary intent:** "I'm leading the band through this right now in our practice space."
- **Default body:** big-text chart, today's setlist context, who's available
- **Visible UI:** chart with chord-only / lyrics-only toggle, "next up" peek if in a setlist context, transition reminder ("→ Sugaree, 1 bar piano fill"), avatar dock for band members present, big play/pause + section jump
- **Hidden UI:** stems mixer (rehearsal isn't for studying), task creation UI (rehearsal is for execution; tasks come up in Review)
- **Primary actions:** big play, big pause, jump to section, "this transition needs work" tag (creates a Task in the Review/Rehearsal page), attendance toggle
- **Player engine:** `INTENTS.PERFORM` → `GLPlayerEngine` (queue + playback)
- **Persistence:** PracticeSession (mode='rehearsal', section, lastPosition) + RehearsalEventContext (which session, which plan)

#### 2.4 Gig mode

- **Primary intent:** "I'm on stage. Show me the chart. Touch nothing else."
- **Default body:** full-screen chart with locked primary version
- **Visible UI:** chart, auto-scroll speed control (single tap), section markers, BPM, key
- **Hidden UI:** EVERYTHING else — no notes UI, no GrooveMate, no nav rail, no tabs. Per `feedback_one_job_per_screen.md`.
- **Primary actions:** tap to start auto-scroll, tap section to jump, swipe for next song
- **Player engine:** `INTENTS.BROWSE` → `setlist-player.js` (already locks primary version when in gig context)
- **Constraints:** must respect `LOCK_PRIMARY_VERSION` capability; must use `AUTOPLAY_WATCHDOG` (D6 fix); must surface `NOW_PLAYING_BAR` so the band knows what's playing without blocking the chart
- **Persistence:** minimal — gig progress is captured by the SetlistPlayer; the workbench just mounts it

#### 2.5 Review mode

- **Primary intent:** "What happened the last time we played this song? Where were we tight, where were we sloppy?"
- **Default body:** if a multitrack session contains this song → multitrack player rooted at the song's section in the recording. Else the segmented Demucs-style timeline.
- **Visible UI:** waveform/timeline, comment markers, comment composer + list (Phase B+ shipped), per-track mute/solo if multitrack, segment markers if single-file
- **Hidden UI:** chart (Review is about audio, not score), live affordances
- **Primary actions:** scrub, comment, tag (rushed/dragged/etc.), filter by member or by track, export digest
- **Player engine:** custom — no single PlayerEngine contract intent (Review playback is multi-source: multitrack stems OR Demucs segmented)
- **Persistence:** comments at `rehearsal_sessions/{sessionId}/comments/{commentId}`; song-level link is the song-context filter

### Mode parity matrix

What's available across modes:

| Capability | Practice | Stems | Rehearsal | Gig | Review |
|---|---|---|---|---|---|
| Chart | ✓ | ◐ overlay | ✓ | ✓ | ✗ |
| Stems mixer | ✗ | ✓ | ✗ | ✗ | ◐ if multitrack |
| Comments / notes | chord+line | timestamp+stem | rehearsal-issue | ✗ | timestamp |
| Loop | ✓ | ✓ | ◐ section | ✗ | ✗ |
| GrooveMate | ✓ | ✓ | ◐ subtle | ✗ | ✓ |
| Right rail visible | ✓ | ✓ | ◐ collapsed | ✗ hidden | ✓ |

`◐` = present but secondary/collapsible.

---

## 3 · Shared components

### 3.1 Player

**Already exists:** `gl-player-contract.js` defines the canonical surface (16 capabilities, 11 events, 9 states, 5 intents). Three engines registered (Phase C complete):

- `gl-player-engine-contract.js` → wraps `GLPlayerEngine` (INTENTS.QUEUE + PERFORM)
- `gl-stems-engine-contract.js` → wraps Stems mixer (INTENTS.STUDY)
- `gl-setlist-player-contract.js` → wraps `setlist-player.js` (INTENTS.BROWSE)

**Workbench responsibility:** call `GLPlayerContract.get(intent)` to mount the right engine for the current mode. Workbench never instantiates an engine directly. Workbench listens for canonical events (`PLAY`, `PAUSE`, `SEEK`, `ENDED`, etc.) and updates UI.

**State:** lives inside the engine. Workbench reads via `engine.state()` and listens for change events.

**Inputs:** intent (from current mode), source (song or setlist context).
**Outputs:** standardized events; UI elements bind to those.

**To add for Workbench:**
- A new `INTENTS.REVIEW` for the multitrack/segmented review playback (currently no intent registered for review)
- `gl-multitrack-engine-contract.js` adapter wrapping `multitrack-rehearsal.js`'s player (similar minimal-blast-radius wrap pattern as Phase C.3)

### 3.2 Chart renderer

**Current state:** `js/features/charts.js` exposes `loadOverlayNotes` / `addOverlayNote` / `removeOverlayNote` (GLNotes-routed) + `highlightActiveSong`. Chart renderer itself is invoked from multiple surfaces.

**Workbench responsibility:** mount one chart instance per song, pass `mode` so renderer can vary density (Gig = big text, Practice = denser with lyrics, Rehearsal = chord-emphasis).

**Inputs:** `songId`, `mode`, `currentPlaybackPosition` (for highlightActiveSong-style follow-the-bouncing-ball).
**Outputs:** rendered HTML chart; emits `lineClicked(lineIdx)` and `chordClicked(chordIdx)` for note attachment.

**State:** the chart text + overlays live at `bands/{slug}/songs_v2/{songId}/chart` and `.../overlays`. Workbench passes through.

### 3.3 Notes / annotations (GLNotes-based)

**Current state:** `gl-notes.js` exposes 5 scopes (`SCOPES`). `write` / `read` / `update` / `remove` API. Per-scope adapters route to existing Firebase paths; readers untouched by this layer keep working.

**Workbench responsibility:** every mode renders notes for the song, filtered by mode-relevant scopes:

| Mode | Visible note scopes |
|---|---|
| Practice | `chart` (line/chord), `personal` |
| Stems | `stem` (timestamp + stem identity), `personal` |
| Rehearsal | `chart`, `rehearsal` (issues + reminders), `personal` |
| Gig | `chart` (read-only), `gig` (gig-only reminders that survive only until gig ends) |
| Review | `rehearsal_session_comment` (Phase B comments at `rehearsal_sessions/.../comments`), `personal` |

**To extend for Workbench:**
- Activate the existing `stem` scope (currently defined but unwritten)
- Add `gig` scope semantics (auto-pruned X days after the gig date — `_glPurgeGigNotesAfterDate`)
- Add a `rehearsal` scope alias that maps to the new `rehearsal_sessions/.../comments` path (or keep them separate — see §5)

**Visibility:**
- `personal` — scoped to user; never synced
- `chart`, `rehearsal`, `gig` — band-visible; written to band Firebase path
- `stem` — band-visible by default; per-band setting to make personal

### 3.4 Loop / section control

**Current state:** Stems mixer has loop in/out via the `LOOP` capability (Phase C.3). Existing `_sdStemsAPI` exposes `loop.set(in, out)` etc.

**Workbench responsibility:** loop is a mode-shared concern. When in Practice or Stems, a unified loop control sits in the workbench player bar. Loop region survives mode switches (you set a loop in Practice mode, switch to Stems, the same loop is active).

**State:** lives on PracticeSession (`section: { in, out }`). Engine reads from session on mount; writes back on user change.

### 3.5 Timeline (for Review)

**Current state:** rehearsal session timeline rendered via `RehearsalSegmentationEngine` (single-file Demucs path) or by the multitrack player's seek bar with markers (Phase B+ shipped tonight).

**Workbench responsibility:** Review mode mounts the appropriate timeline based on session type. Common contract: `timestamp` is the unit, `comments[]` are markers, `play(t)` jumps the engine.

### 3.6 Track / stems controls

**Current state:** Stems mixer (mute/solo/volume/pan per track), multitrack player (mute/solo/master scrub).

**Workbench responsibility:** mount the appropriate track-controls component. Practice mode uses simplified mute-stem (4 buttons: lead/bass/drums/other). Stems mode uses full mixer. Review mode (multitrack) uses the multitrack player's controls.

### 3.7 Task / issues layer

**NEW.** No system today.

**Concept:** during Rehearsal mode, the band leader can flag "this transition needs work" → creates a Task. Tasks are scoped to a song (and optionally a section + member assignment). Tasks live at `bands/{slug}/song_tasks/{taskId}` with shape:

```
{
  taskId, songId, songTitle, section?, sectionLabel?,
  text, tags: [], assignedMemberKey?,
  status: 'open' | 'in-progress' | 'done',
  createdAt, createdBy, updatedAt,
  source: 'rehearsal-flag' | 'review-comment' | 'manual',
  sourceRef?: { sessionId?, commentId? }
}
```

**Where tasks surface:**
- In Workbench right rail, under "Tasks" section, filtered to current song
- In a global "My Tasks" view (Phase X — out of Workbench scope)
- In the Review mode comment list, comments tagged `revisit` or `nail this` get a "Promote to Task" button

**State:** Firebase. Tasks survive across modes and rehearsals.

---

## 4 · Player architecture

### 4.1 Single contract, multiple engines

Already in production. The contract (`gl-player-contract.js`) treats intent as the routing key. Workbench picks intent from mode:

```
mode 'practice'  → STUDY  → gl-stems-engine-contract OR gl-player-engine-contract (fallback)
mode 'stems'     → STUDY  → gl-stems-engine-contract
mode 'rehearsal' → PERFORM → gl-player-engine-contract
mode 'gig'       → BROWSE  → gl-setlist-player-contract
mode 'review'    → REVIEW  → gl-multitrack-engine-contract  (new — to build)
```

### 4.2 Source resolution

Sources (YouTube / Spotify / Archive.org / R2 stems / multitrack FLAC) are resolved by `gl-source-resolver.js` (existing). Workbench passes `songId` + intent to the resolver; the resolver returns a source object the engine can play.

For multitrack rehearsal sessions: the source is `rehearsal_sessions/{sessionId}/tracks` and the Workbench mounts the multitrack player rooted at the song's appearance in that session. The "song's appearance" is derived from session metadata (Phase C work for Workbench).

### 4.3 Latency / sync differences

Each engine handles its own latency internally. Examples:

- **YouTube iframe:** has unavoidable 200-500ms latency between `play()` and audible audio. Engine surfaces `STATE.PLAYING` only when YouTube reports it (not on `play()` invocation).
- **Stems WebAudio:** sub-frame latency once buffered. Engine emits `STATE.PLAYING` synchronously on `play()`.
- **Multitrack `<audio>` elements:** ~10-50ms variance between elements; engine should sync via `currentTime` reset before play (already done in multitrack-rehearsal.js).

The Workbench UI binds to `STATE` events, not action calls — so latency variance is invisible to the user. Play button doesn't say "Playing" until the engine confirms.

### 4.4 Cross-engine handoff

When the user switches modes, the current engine pauses (workbench calls `engine.pause()` then unmounts), and the new engine mounts at the same playhead position when possible.

For modes that share semantically equivalent positions (Practice ↔ Stems both root in the song at time T), playhead is preserved. For Practice ↔ Review (different recording entirely — practice plays a reference recording; review plays a rehearsal recording), playhead resets and PracticeSession captures both positions separately:

```
PracticeSession {
  ...,
  positions: {
    practice: 142.3,     // seconds into the reference recording
    stems:    142.3,     // same recording → preserved
    rehearsal: 142.3,    // same playback context as practice
    review:   { sessionId, songSegmentStartSec, lastSeenAtSec }   // different artifact
  }
}
```

---

## 5 · Notes + annotation model

### 5.1 Extend GLNotes scopes

Today: `chart`, `rehearsal`, `personal`, `gig`, `stem` (last two defined-but-unwritten per `gl-notes.js` header comment).

Workbench activates the unwritten scopes:

#### `stem` scope
- **Anchor:** songId + timestampSec + stemId
- **Visibility:** band by default
- **Persistence:** `bands/{slug}/songs_v2/{songId}/stem_notes/{noteId}` (new path)
- **Surfaced:** Stems mode body — markers above the master scrub, plus a notes panel filtered to current song
- **Example:** "Pierce's Leslie hit on this beat — Brian's bass note clashes"

#### `gig` scope
- **Anchor:** songId + (optional) gigId
- **Visibility:** band
- **Persistence:** `bands/{slug}/songs_v2/{songId}/gig_notes/{noteId}`
- **Auto-prune:** rows with `gigId` are auto-pruned 14 days after that gig's date (background sweep). Untied gig notes persist until manually cleared.
- **Surfaced:** Gig mode body (read-only big text overlay if recent), Practice mode notes panel (with "since the [gig name] gig" framing)
- **Example:** "Drew's monitor was dead — start vocal cue earlier"

### 5.2 Cross-mode visibility rules

| Note origin | Practice sees? | Stems sees? | Rehearsal sees? | Gig sees? | Review sees? |
|---|---|---|---|---|---|
| `chart` (chord/line) | ✓ inline | ✓ overlay | ✓ inline | ✓ inline (read-only) | ✗ (chart not in review) |
| `personal` | ✓ | ✓ | ✗ (band view) | ✗ | ✓ |
| `stem` | ✗ (or filtered) | ✓ | ✗ | ✗ | ✗ |
| `rehearsal` (issue) | ✓ "open issues" panel | ✗ | ✓ | ✗ | ✓ source |
| `gig` | ✓ "gig reminders" | ✗ | ✗ | ✓ | ✗ |
| `rehearsal_session_comment` (Phase B) | (via review) | (via review) | ✗ | ✗ | ✓ |

### 5.3 Note → Task promotion

Comments tagged `revisit` or `nail this` (or `wrong chord`, `missed cue` in band-comm context) get a "Promote to Task" button. Promotion creates a `song_task` linked to the original comment.

---

## 6 · PracticeSession model

### 6.1 Existing schema (`gl-practice-session.js`)

```
{
  songId, songTitle,
  section: { in, out } | null,
  mode: 'focus' | 'part' | 'harmony' | 'learn' | 'chart',
  settings: { stemPreset, stemId, mutedStems, showLyrics, showChords, showNotes },
  lastPosition,
  startedAt, updatedAt,
  version: 1
}
```

Local-first (`localStorage` key `gl_practice_session_v1`). Single session at a time.

### 6.2 Workbench extensions

Add fields:

```
{
  ...existing,
  workbenchMode: 'practice' | 'stems' | 'rehearsal' | 'gig' | 'review',
  positions: {
    practice: number,        // seconds in reference recording
    stems: number,
    rehearsal: number,
    gig: number,
    review: { sessionId, lastSeenAtSec } | null
  },
  loop: { in, out } | null,  // promoted from settings.section, shared across modes
  rightRailState: {
    notesScope?: string,     // currently filtered scope in notes panel
    expandedSections: { tasks: boolean, notes: boolean, groovemate: boolean }
  },
  context: {
    setlistId?: string,      // when launched from a setlist
    gigId?: string,          // when launched from a gig
    rehearsalEventId?: string // when launched from a rehearsal event
  }
}
```

### 6.3 Persistence

- **v1 (Phase 1):** stays local-first. `gl-practice-session.js` already does this.
- **v2 (Phase 3):** Firebase mirror at `bands/{slug}/users/{userKey}/practice_session` for cross-device resume. Behind a feature flag.

### 6.4 Resume semantics

When the user opens the Workbench:
- If `PracticeSession` matches the song they're opening → resume in the saved `workbenchMode` at the saved `positions[mode]`
- If different song → start a new session (overwrites)
- If same song but explicit different mode → preserve other-mode state, switch to new mode

`describe()` (existing) shows session age. UI "Resume practice from yesterday?" dialog if age > 24h.

### 6.5 GrooveMate read pattern

GrooveMate reads `PracticeSession` to know:
- What song the user is on
- What mode
- What position
- What loop region (if any)
- What notes/tasks exist for this song

GrooveMate writes are routed through `GLActionRouter` (existing). It does not write directly to PracticeSession.

---

## 7 · Rehearsal integration

Rehearsal page (`js/features/rehearsal.js`) plans + reviews rehearsals. Multitrack ingest (`js/features/multitrack-rehearsal.js`) captures + comments on rehearsals. Workbench Rehearsal/Review modes consume that data.

### 7.1 Rehearsal-issue flow

During a rehearsal in Workbench Rehearsal mode, the band leader can:

1. Notice a problem ("transition into Sugaree was sloppy")
2. Tap a "Flag this" button on the chart
3. A bottom sheet opens with: text input, tag chips (matching multitrack tag set: rushed/dragged/wrong chord/missed cue/transition/etc.), "Assign to" dropdown
4. Submit → creates a `song_task` (§3.7) AND a `rehearsal_event_issue` linked to the current rehearsal event

### 7.2 Workbench → Rehearsal page link

The Rehearsal page's session-history view shows tasks created during each rehearsal. Click a task → opens the Workbench for that song in Practice mode, with the task displayed prominently in the right rail.

### 7.3 Resolution tracking

A task closes when:
- User explicitly marks it `done`
- Comments on a NEW rehearsal session for that song's section don't include the same tag (heuristic — could overrule manually)
- 6+ weeks pass with no flag (auto-archive, not auto-close)

---

## 8 · Multitrack review integration

### 8.1 Multitrack session → song mapping

Today, multitrack sessions cover an entire rehearsal (90+ min). Songs aren't yet mapped within that.

**Phase 2 work (post-Workbench Phase 1):**
- Run the existing `RehearsalSegmentationEngine` against the multitrack session's master mix (one of the rehearsal stems, e.g. room-l) to detect song boundaries
- Store song-segment metadata at `rehearsal_sessions/{sessionId}/song_segments[]` with `{songId, startSec, endSec, confidence, transitions: {prevSongId, nextSongId}}`
- Workbench Review mode uses this mapping to root playback at "Bertha within last Tuesday's rehearsal"

### 8.2 Comment ↔ song link

Phase B comments (`rehearsal_sessions/.../comments`) currently anchor to a track + timestamp. Phase 2 will derive `songId` from the timestamp via the segment mapping above. Backfill is automatic.

### 8.3 Stems vs rehearsal audio coexistence

Both are useful for different things:
- **Stems** (Demucs-separated reference recording): clean isolated parts, perfect for learning
- **Rehearsal audio** (X32 multitrack of the band actually playing): real, with feel + mistakes

Workbench Stems mode defaults to Demucs stems if available. A toggle in the mode header lets the user switch to "rehearsal audio" if a multitrack session contains this song. Same controls, different source.

---

## 9 · GrooveMate integration

`GLOrchestrator` is the NBA engine. `GLActionRouter` handles intent → action mapping. `GLKnowledge` is the knowledge resolver. `GrooveMate` is the user-facing avatar shell.

### 9.1 Context read

GrooveMate reads `PracticeSession` (now extended per §6.2) to build context:

```
{
  song: { id, title, key, bpm, status },
  mode: 'practice',
  position: 142.3,
  loop: { in: 120, out: 168 },
  recentTasks: [{ taskId, text, tags, status }],
  recentNotes: [{ scope, text, anchor }]
}
```

### 9.2 Action surface (what GrooveMate can do)

Existing `GLActions` registry. New actions to register for Workbench:

- `workbench.switchMode(modeName)` — swap mode without leaving the song
- `workbench.setLoop(inSec, outSec)` — set loop region from a suggestion ("loop the bridge for me")
- `workbench.openNote(noteScope, anchor)` — focus the note input pre-filled with a target
- `workbench.promoteToTask(commentId)` — convert a Review comment into a song task

### 9.3 Suggestion surfacing

GrooveMate suggestions appear in three intensity levels:

| Level | Where it surfaces | When |
|---|---|---|
| **Ambient** | Right rail "GrooveMate" panel, dismissible | Always when there's a contextually relevant suggestion |
| **Inline hint** | Subtle chip near the relevant control ("loop the bridge?") | When user is hesitating (>5s no input on a section) |
| **Modal** | Full-screen avatar modal | Never automatically — user-invoked only |

In **Gig mode**, GrooveMate is **silent**. No ambient, no inline. Per the "one job per screen" rule: gig mode shows the chart, period.

### 9.4 Avoiding intrusiveness

- **Suggestion budget:** at most 1 ambient suggestion at a time per song. Stale suggestions are replaced, not stacked.
- **Cool-down:** dismissed suggestions don't reappear for 4 hours.
- **Mode-aware silence:** Gig mode is silent; Rehearsal mode is "quiet" (only critical suggestions like "Pierce isn't here — drop the Leslie part?"); Practice + Stems + Review are full-fat.

---

## 10 · Migration plan

### Guiding principles

1. **No big rewrite.** Wrap existing surfaces; don't reimplement.
2. **PRESERVE existing working behavior.** Songs page, Setlists page, Calendar, Rehearsal page, Live Gig — all keep working through migration.
3. **SYSTEM LOCKs untouched** (CLAUDE.md §7): `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES`.
4. **DO NOT TOUCH** during Workbench migration:
   - Stems Demucs separation pipeline (`gl-stems.js` + Modal worker)
   - Multitrack-rehearsal player core (`multitrack-rehearsal.js`'s WebAudio path)
   - LALAL split pipeline
   - Recording analysis pipeline (`rehearsal-analysis-pipeline.js`)
   - Calendar sync (`gl-calendar-sync.js`)
   - Rehearsal scheduling engine (`gl-rehearsal-scheduling.js`)
   - The Rehearsal page itself (Phase 3 work just landed; let it stabilize)

### Phase 1 — Wrap (≈1 week)

**Goal:** create the Workbench shell as a new top-level surface; no existing surface is removed or rewritten.

- New `js/features/workbench.js` exports `openWorkbench(songId, mode?)` 
- Workbench shell renders header + mode tabs + right rail; mode body is an `<iframe>`-or-mount of the existing surface
- Practice mode mounts the existing `rehearsal-mode.js` 5-tab in `mode='chart'` view
- Stems mode mounts `_sdRenderStemsPlayer` from `song-detail.js` directly into the body slot
- Rehearsal mode mounts the chart half of `rehearsal-mode.js`
- Gig mode mounts the existing `setlist-player.js`
- Review mode mounts the multitrack player OR the segmented timeline depending on session type
- Mode-switching tabs route via `_workbenchSetMode(mode)` — no full page render
- Song detail page gets a "Open Workbench" CTA; existing flows unchanged

**Acceptance:** open Workbench for Bertha → land in Practice → switch to Stems → mixer appears, song identity stays in the header → switch to Review → multitrack player or segmented timeline appears. No state loss between mode switches (same song, same general position).

### Phase 2 — Unify player + notes (≈1 week)

**Goal:** every mode reads/writes through the unified contracts.

- Add `gl-multitrack-engine-contract.js` adapter (mirrors C.3/C.4 pattern)
- Add `INTENTS.REVIEW` to the contract
- Workbench player resolves engines via `GLPlayerContract.get(intent)` — the modes stop knowing which concrete engine they use
- Activate `stem` and `gig` GLNotes scopes
- Right rail "Notes" panel reads from GLNotes filtered by mode-relevant scopes
- New `song_tasks` collection + UI in right rail Tasks panel
- Cross-mode loop region promoted from PracticeSession; same loop visible in Practice + Stems

**Acceptance:** set a loop in Practice mode → switch to Stems → loop region preserved → write a stem note → switch back to Practice → notes panel shows the stem note in the "stem" filter.

### Phase 3 — Consolidate UI (≈2 weeks)

**Goal:** retire duplicate surfaces; Workbench becomes THE way to interact with a song.

- Song detail page → fully replaced by Workbench. Old route redirects.
- "Open in Workbench" becomes the default CTA from Songs list, Setlist player, Rehearsal page session-history, Multitrack session-list
- Live Gig Mode → becomes Workbench Gig mode in full-screen variant
- Optional: PracticeSession Firebase mirror for cross-device resume

**Acceptance:** Drew on iPad in band practice opens Workbench for Sugaree from the rehearsal plan; switches to Stems to hear what the bass is doing; bookmarks a chord with a note; later that night on his Mac, opens Workbench for Sugaree → resume sees yesterday's note + position.

### Safe-to-refactor areas

- Workbench shell HTML/CSS — own the layout
- Mode-tab routing logic
- Right rail panels (notes, tasks, GrooveMate)
- Cross-mode state transitions

### Do NOT touch (per Phase 1)

| Subsystem | Reason |
|---|---|
| `gl-stems.js` Demucs pipeline | Worker bound, GPU-priced; rewrites cost real money + downtime |
| `multitrack-rehearsal.js` upload + player core | Drew's band starts using this Monday; can't break in flight |
| `rehearsal-analysis-pipeline.js` | 3 working integrations; risk of cross-cutting regression |
| `gl-calendar-sync.js` | Hard-won stability after April 2026 bug arc |
| `setlist-player.js` D6 autoplay watchdog | Critical for gig flow on iOS |

---

## 11 · UX walkthroughs

### Flow A — Practice a song (solo)

> **Setup:** Drew is at home. Wants to nail the Bertha bridge.

1. Drew opens Songs page → searches "Bertha" → clicks the row
2. Songs page calls `openWorkbench('bertha-001')`
3. Workbench shell renders. Header: `🎵 Bertha · Grateful Dead · Key A · 124 BPM · ★★★☆☆`. Mode tabs: `[ Practice ✓ ] [ Stems ] [ Rehearsal ] [ Gig ] [ Review ]`. Body: chart with chords + lyrics. Right rail: Notes panel (filtered to chart + personal scopes). GrooveMate panel suggests "Loop the bridge?" (because Drew has flagged this song "needs work" recently).
4. Drew clicks the GrooveMate "loop the bridge" suggestion → it sets `loop = {in: 120, out: 168}`. Player reference recording starts looping. Chart auto-scrolls within the loop.
5. Drew toggles "Mute lead vocal" — single button in the player bar. Reference recording stems unmute the lead → stems continue playing.
6. Drew clicks a chord on the chart → "Note: this chord wants to resolve sooner" → saves to `chart` scope at line 12.
7. After ~10 min, Drew closes the tab. PracticeSession persists: `{songId: 'bertha-001', mode: 'practice', loop: {120, 168}, lastPosition: 138.4, ...}`.

**Tomorrow:** Drew opens Workbench for any song → lands on the song he was on, with the same loop and position. Banner: "Resume from yesterday?" with Yes/Start fresh.

### Flow B — Review rehearsal → fix issue → practice

> **Setup:** Drew imported last Monday's multitrack rehearsal. Reviewing Tuesday morning.

1. Drew opens Rehearsal page → sees Monday's session in History → clicks **Open**
2. Workbench shell loads in **Review** mode. Body: multitrack player. Header: `🎚 Multitrack rehearsal · Mon May 12 · Brian's garage · 20 tracks`.
3. Drew plays back, hears Brian rushing the bridge of Sugaree. Solos the bass track. Confirms.
4. Composer at the bottom — Drew types "Brian rushing on bridge", taps `rushed` tag, hits Enter. Comment lands in the list anchored to bass + the timestamp.
5. Drew clicks the **"Promote to Task"** option on the new comment → creates a `song_task` with `songId: 'sugaree-002'`, text, `assignedMemberKey: 'brian'`, `tags: ['rushed']`, `source: 'review-comment'`.
6. Drew clicks the song chip on that task → Workbench navigates to **Sugaree in Practice mode**. Task appears in right rail under "Tasks" with "Open: Brian rushing on bridge".
7. Drew sets a loop on the bridge of Sugaree, plays the reference, hits "Mute bass" so he can hear himself sing along. Drills it 5 times.
8. Drew taps **"Mark Done"** on the task. Status flips to `done`; the Review session's comment retains a "→ task closed" badge.

**Brian's view:** Brian opens GrooveLinx Tuesday afternoon. Home dashboard shows "1 new task assigned to you." Click → Workbench opens for Sugaree in Practice mode with the task highlighted.

### Flow C — Gig mode usage

> **Setup:** Drew is on stage at the Tavern. Setlist is loaded. About to start.

1. Drew opens Setlists page → taps the gig setlist → **Start Gig** button
2. Setlist player launches its existing flow (autoplay watchdog active per D6). First song = Bertha.
3. Workbench shell mounts in **Gig mode** with body = full-screen chart. Right rail is **HIDDEN**. Mode tabs are HIDDEN. GrooveMate is SILENT. Header is condensed: `🎵 Bertha · Key A · 124 BPM · 1/12` (song position in setlist). Auto-scroll speed control: single tap toggles between Slow/Med/Fast/Off.
4. Drew taps the chart → auto-scroll starts at the saved per-song speed. Now-playing bar appears at the bottom (already exists).
5. Mid-song, Drew swipes left → "Pre-load next chart" — Sugaree is rendered behind Bertha so the swap is instant.
6. Bertha ends → setlist player advances → Workbench updates: `🎵 Sugaree · Key Bb · 110 BPM · 2/12`. Chart swaps. Auto-scroll resumes at Sugaree's saved speed.
7. The whole gig: zero accidental nav, zero modal interruptions. Touch surface is the chart itself + a single thin control bar.

**After the gig:** Drew can open Workbench for any song from that gig → Review mode shows the multitrack rehearsal recording (if exists) AND has a `gig` scope note from this gig if anyone left one ("Drew's mic was hot during chorus 2") — those are auto-pruned 14 days later.

---

## Summary — the highest-leverage decisions

1. **Songs are the noun, modes are the camera angles.** Workbench is the song-shaped container that survives mode switches.
2. **The PlayerEngine contract is already the unification lever.** Phase C shipped 4 engines registered against 4 intents. Workbench just wraps + uses what exists. New: REVIEW intent + multitrack adapter.
3. **GLNotes is the notes lever.** Activate the unwritten `stem` and `gig` scopes. Add `song_tasks` as a new sibling collection.
4. **PracticeSession is the GrooveMate context.** Already exists local-first. Extend with `workbenchMode`, `positions`, `loop`. Defer Firebase mirror to Phase 3.
5. **Migration is wrap-not-rewrite.** Phase 1 mounts existing surfaces inside the new shell; no existing surface is broken. Phase 2 unifies under contracts. Phase 3 retires duplicates.
6. **DO-NOT-TOUCH list is hard.** Demucs pipeline, multitrack player core, calendar sync, recording analysis, autoplay watchdog — all stay as-is during migration. Drew's band depends on every one of them this week.
7. **Gig mode is special.** Single job per screen. No tabs, no rail, no GrooveMate. Workbench has to know how to disappear.

---

## Open questions for next session

1. **Does the Workbench replace the Songs page entirely?** No — Songs remains the index. But "click a song" should always launch the Workbench, not the legacy song detail.
2. **What's the URL scheme?** Suggest `#workbench/{songId}/{mode}` so deep links work and back-button respects mode switches.
3. **Multi-tab support:** can Drew open two Workbenches at once for two songs (e.g. comparing arrangements)? Yes (each tab is its own JS context); no shared state weirdness because PracticeSession is per-tab.
4. **Right rail collapsibility:** mobile/tablet narrow-viewport. Right rail collapses below the body? Or hides entirely with a peek button? Decide before Phase 1 implementation.
5. **What happens when a song has NO chart, NO stems, NO reference recording?** Workbench needs an empty-state per mode that gracefully degrades to "this song needs setup — start by adding a chart."

---

**End of v0.1 draft.** Next iteration: ChatGPT/Drew review, refine, then Phase 1 implementation plan.
