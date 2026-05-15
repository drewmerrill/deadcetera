# Deferred Findings Queue

Operational queue for secondary findings surfaced during stabilization /
coherence / convergence work. Lightweight markdown — no app UI, no scripts.

**Purpose.** Catch valuable observations that surface during a focused pass
but should NOT trigger immediate scope expansion. Prevent loss without
inviting chaos-driven development.

**Workflow.**

1. During any stabilization / refactor / bug pass, observations land here
   instead of being silently absorbed.
2. At the end of every release summary, append a `Deferred Findings
   Captured` section listing what was added or moved this cycle.
3. Items leave the queue only by:
   - being addressed in a deliberate later pass, OR
   - being explicitly invalidated (`Status: dismissed — <reason>`).
4. Reorder freely. Newest entries land at the bottom of their category.

**Each entry MUST include:**

```
- **Finding:** what was observed
  - **Why deferred:** why it didn't get fixed in the discovering pass
  - **Trigger:** what condition should pull this back to active
  - **Discovered:** YYYY-MM-DD · <commit hash or release tag>
  - **Resolved:** (optional) YYYY-MM-DD · what changed (only when status flips)
  - **Status:** open | in-progress | resolved | dismissed
```

Keep findings short. If a finding grows beyond a paragraph, it's a real
work item — graduate it to a GitHub issue and link from here.

---

## 1. Stabilization Debt

Dead listeners, no-op toggles, stale render paths, async race risks,
orphan helpers, broken fallbacks.

- **Finding:** `sdToggleAnon` (Anonymous mode toggle in song-detail.js)
  is a no-op on the current rendered surface — it targets a
  `.sd-readiness-inner` inside `#sd-readiness-card`, but the card is now
  a `<details>` element without that inner class.
  - **Why deferred:** Behavior was already broken pre-coherence pass; not a
    regression. Out of scope for the readiness deduplication work.
  - **Trigger:** Next time anon-mode is requested by a tester, or when
    `_sdRenderReadinessBlock` is touched.
  - **Discovered:** 2026-05-15 · d519673d
  - **Status:** open

- **Finding:** `_sdRenderReadinessBlock` and `_sdRenderReadinessInner` in
  song-detail.js are only reachable via `sdToggleAnon` (which itself
  is a no-op on the current surface). Both helpers are effectively dead.
  - **Why deferred:** Cleanup deferred because removing them risks
    surfacing a regression if a hidden callsite exists. Needs a grep
    sweep across the bundle before deletion.
  - **Trigger:** When anon-mode is reworked, OR during a deliberate
    dead-code sweep.
  - **Discovered:** 2026-05-15 · d519673d
  - **Status:** open

- **Finding:** `launchVersionHubForFadr` in app.js:3596 is legacy — the
  Version Hub's "Send to Fadr" destination has already been replaced
  with "Send to Stems."
  - **Why deferred:** Function may still be referenced by an old call
    path; preserving Fadr-related code per `project_lalal_fadr_hierarchy`.
  - **Trigger:** Next Fadr-related cleanup pass, or when grep confirms
    no callers remain.
  - **Discovered:** 2026-05-15 · bb594402
  - **Status:** open

- **Finding:** `_calRenderBestRehearsalHero` (calendar.js:559) is dead code —
  its mount point `#calBestRehearsalHero` is never rendered anywhere. The
  live recommendation hero is `_calRenderDecisionAnchor` mounting at
  `#calDecisionAnchor`.
  - **Why deferred:** Surfaced during Schedule coherence pass; out of scope
    for the engine + action-bar work. Removing it needs a grep sweep to
    confirm no test/dev surface references the function.
  - **Trigger:** Next calendar polish pass, or during a deliberate dead-code
    sweep across calendar.js.
  - **Discovered:** 2026-05-15 · (pre-existing, surfaced during Schedule
    coherence pass)
  - **Status:** open

- **Finding:** GLAnnotations cache has **no realtime listener** — other
  band members or other tabs see new annotations only on their next
  load. Single-band single-user works fine; multi-user concurrent
  editing could surface stale reads.
  - **Why deferred:** Phase 1 deliberately skipped realtime to keep the
    primitive small. The cache invalidates on local writes; cross-tab
    invalidation needs a Firebase `.on('value')` subscription.
  - **Trigger:** First multi-user collision report, OR Phase 3 (Annotated
    Review) where two members annotating the same playback are likely.
  - **Discovered:** 2026-05-15 (Phase 1 build, gl-annotations.js)
  - **Status:** open

- **Finding:** Annotation `song_id` field stores a song **title string**
  during the songs_v2 migration window — same fragility class as the
  Take↔Song string-ref entry above. Two debts share one root cause.
  - **Why deferred:** Identical to the Take entry. Phase 2 of the spec
    converts both at once when the songs_v2 migration completes.
  - **Trigger:** Phase 2 of the proposal, OR the next song rename.
  - **Discovered:** 2026-05-15 (Phase 1 build, song-detail.js call site)
  - **Status:** open

- **Finding:** `rehearsal_mixdowns.audio_url` is a local-blob field that
  was never meant to persist — leftover from an earlier upload flow.
  Sits next to the canonical `drive_url`; confusing for any future reader.
  - **Why deferred:** Phase 3 of the Rehearsal ↔ Song DNA proposal will
    touch this surface anyway. Cleaning up now without that context
    risks scope-creep.
  - **Trigger:** Phase 3 of the proposal.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Status:** open

- **Finding:** `_sdRenderBandChart` legacy fallback (song-detail.js:285+)
  serves cached service-worker shells without `ChartRenderer`. Likely
  rarely hit now; duplicates the canonical path.
  - **Why deferred:** Safety net for stale SW shells; removing could
    regress users on offline / cached bundles.
  - **Trigger:** Once service-worker version churn settles and we can
    confirm no live clients hit this branch.
  - **Discovered:** 2026-05-15 (pre-existing, noted during Edit
    double-click investigation) · 9f08b2b8
  - **Status:** open

## 2. UX Coherence Debt

Inconsistent terminology, duplicate interaction models, source
vocabulary mismatches, fragmented flows, naming drift.

- **Finding:** Player `_sourceLabels.url` renders as "Link" in the
  lower-right "Playing on X" footer. Could be clearer as "URL" or
  the actual hostname.
  - **Why deferred:** Coherence pass needed a default before testers
    saw it; final wording can be tuned with feedback.
  - **Trigger:** First tester confusion about "Link" vs. host name; or
    once we have hostname-aware metadata in the source detector.
  - **Discovered:** 2026-05-15 · bb594402
  - **Resolved:** 2026-05-15 — Drew's call: hostname rendering wins
    because source identity matters musically (archive.org, nugs.net,
    dead.net, phish.in carry context). `_renderSource` now derives a
    `www.`-stripped hostname for `url`/unknown sources.
  - **Status:** resolved

- **Finding:** Readiness scale 1↔2 swap (old `1=Learning, 2=Rough`
  → new `1=Rough, 2=Learning`). Pre-existing 1-ratings now render as
  "Rough" instead of "Learning."
  - **Why deferred:** Scores are stable; only labels shifted. A band-wide
    ping covers it without a data migration.
  - **Trigger:** If any analytics / recommendation logic uses score
    semantics (not just numeric thresholds), this needs a normalisation
    step.
  - **Discovered:** 2026-05-15 · 7a68b97d
  - **Status:** open

- **Finding:** Multiple "Add a Note" surfaces still use generic
  placeholders (e.g., setlist `app.js:13490` "Note (optional)…",
  tabNotes `app.js:2147/2175` "Notes (optional)"). Only the top-traffic
  ones were tuned in the coherence pass.
  - **Why deferred:** Diminishing returns vs. risk of touching legacy
    paths; tuning each requires a context decision per surface.
  - **Trigger:** Next setlist or tabs polish pass; or if a tester
    reports confusion.
  - **Discovered:** 2026-05-15 · bb594402
  - **Status:** open

## 3. Architecture Convergence Debt

Duplicated intelligence systems, legacy/new render overlap, model
fragmentation, recommendation-engine duplication, parallel surfaces.

- **Finding:** Workbench is lazy-loaded but song-detail's chart Edit
  button assumes `_wbOpenChartEditor` exists — fallback to
  `openRehearsalMode(..,'paste')` is now correct, but the underlying
  divergence (workbench vs. rehearsal-mode chart-edit surfaces)
  remains.
  - **Why deferred:** Two parallel chart-edit overlays exist; consolidating
    is a larger architecture call than the original double-click fix
    warranted.
  - **Trigger:** Workbench graduates from lazy to eager load, OR a
    deliberate "single chart editor" convergence pass.
  - **Discovered:** 2026-05-15 · 9f08b2b8
  - **Status:** open

- **Finding:** Readiness data has at least three render surfaces —
  top member pills (edit), bottom collapsed summary (read-only),
  Now-Playing avg chip. Each computes its own color thresholds; only
  the top pills + popover now use `SD_READINESS_SCALE` constants.
  - **Why deferred:** Coherence pass deliberately scoped to edit-surface
    deduplication; Now-Playing color logic untouched to avoid scope
    creep into the global player UI.
  - **Trigger:** Next player UI work, or if a tester reports color
    mismatch between pill and Now-Playing chip.
  - **Discovered:** 2026-05-15 · d519673d
  - **Status:** open

- **Finding:** Scheduling intelligence currently reads from multiple
  event persistence surfaces — `rehearsals`, `rehearsal_sessions`, and
  `calendar_events`. The May 20 recommendation bug revealed that scoring
  can silently diverge when one persistence path is excluded from the
  input set. Long-term direction likely requires one canonical
  operational calendar graph, a unified event persistence model, and a
  normalized scheduling-intelligence input layer.
  - **Why deferred:** The Schedule coherence pass fixed the immediate
    credibility issue by merging `calendar_events` rehearsals into
    `existingDates`. Full calendar/event unification would create
    excessive churn before beta.
  - **Trigger:** Post-beta scheduling architecture review, OR a
    recurring class of recommendation inconsistencies that can't be
    pinned to a single missing input.
  - **Discovered:** 2026-05-15 · dcd75cd2 (Schedule coherence pass)
  - **Goal:** Prevent future "algorithmically correct but operationally
    wrong" recommendation behaviour.
  - **Status:** open

- **Finding:** Notes / comments / annotations live in **5+ separate
  Firebase storage paths** (`chart_overlay_notes`, `rehearsal_notes`,
  `gig_notes`, `personal_critique`, `stem_critique_notes`,
  `best_shot_section_notes`, `rehearsal_sessions/{id}/comments`).
  `js/core/gl-notes.js` exists as a 5-scope read adapter but is not a
  canonical write store. Multi-member tagging on comments (a founder ask
  per the Rehearsal ↔ Song DNA proposal) cannot ship cleanly until these
  paths converge to a single `Annotation` primitive with an `anchor`
  field.
  - **Why deferred:** Phase 1 of the relationship-model proposal; not
    started yet.
  - **Trigger:** Starting Phase 1 of
    `02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md`,
    OR any tagging/cross-anchor feature request.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Phase 1 active:** 2026-05-15 — `js/core/gl-annotations.js` shipped
    as the canonical store at `bands/{slug}/annotations/{id}` with the
    full anchor + tagged_members + status schema. Song Detail is the
    single proof-point surface; legacy paths remain untouched. Migration
    of the 5+ legacy paths into this primitive remains future work
    (Phase 2+).
  - **Status:** in-progress

- **Finding:** Takes (audio segments) reference songs by **title string**
  (`audio_segments[].songTitle`), not by `songId`. Fragile under the
  songs_v2 migration ([[project_songs_v2_migration]]); silent break on
  any rename.
  - **Why deferred:** No active break today; the songs_v2 migration is
    mid-flight and adding takes→songId would create churn until the
    migration completes.
  - **Trigger:** Phase 2 of the Rehearsal ↔ Song DNA proposal,
    OR the next song rename, whichever comes first.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Phase 2 active:** 2026-05-15 — `js/core/gl-takes.js` shipped as
    the canonical Take store at `bands/{slug}/takes/{takeId}` with
    `song_id` resolved via `getSongByTitle()` when unambiguous (kept
    `null` + `song_title` populated when the title is ambiguous, so
    the migration window doesn't drop data). Additive normalization
    hooks on the two existing `audio_segments` writers
    (`rehearsal.js:325`, `recording-analyzer.js:2141`) call
    `GLTakes.normalizeRehearsalSegments()`. Legacy `audio_segments[]`
    path remains the source of truth for the analyzer / timeline UI;
    full migration to take FKs (and elimination of `songTitle`) is
    later-phase work.
  - **Status:** in-progress

- **Finding:** `rehearsal_mixdowns` records (Recordings) link back to a
  Rehearsal only via a free-text `rehearsal_date` string. No FK to
  `rehearsal_sessions/{sessionId}`. Programmatic queries can't reliably
  ask "which rehearsal does this recording belong to?"
  - **Why deferred:** Annotated Rehearsal Review (Phase 3 of the
    relationship-model proposal) needs this; nothing breaks at MVP
    without it.
  - **Trigger:** Phase 3 of the proposal.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Status:** open

- **Finding:** Phase 2 Takes are written with `recording_id: null` by
  default — the recording analyzer runs from a transient blob, not from
  a persisted `rehearsal_mixdowns/{id}` row, so there is no FK to
  attach. The Take's `playback_ref.recording_id` is therefore also
  unset; playback today flows through the legacy `audio_segments[]`
  path on the rehearsal session.
  - **Why deferred:** Recording↔Rehearsal FK (entry above) is the
    upstream prerequisite. Once that lands, the analyzer can resolve
    or create a `rehearsal_mixdowns` row first and pass its id into
    `GLTakes.normalizeRehearsalSegments({ recording_id })`.
  - **Trigger:** Phase 3 of the proposal, OR the first feature that
    needs to play a take from a stable URL (e.g. cross-rehearsal Song
    Detail history).
  - **Discovered:** 2026-05-15 (Phase 2 build, gl-takes.js)
  - **Status:** open

- **Finding:** Phase 2 take-number bucketing keys on
  `(rehearsal_id, song_id || song_title || '__unknown__')`. Takes that
  enter with `song_id=null` (ambiguous title) live in a separate bucket
  from same-title takes that resolved cleanly — and if the title later
  resolves to a real songId, those numbers do NOT renumber.
  - **Why deferred:** Renumbering on resolve would race with annotation
    references to the old number; the safer fix is to wait for the
    songs_v2 migration to finish so resolution is deterministic at
    write time.
  - **Trigger:** songs_v2 migration completion, OR a tester reports a
    take labelled "Take 2" appearing before "Take 1" in a per-song view.
  - **Discovered:** 2026-05-15 (Phase 2 build, gl-takes.js)
  - **Status:** open

- **Finding:** Analyzer song-mismatch risk — the matcher's plan-first
  pass + honest-unresolved policy is now wired (LOW confidence segments
  are returned with `songTitle=null` + top-3 suggestions in
  `seg.matching.top_suggestions`), but the existing surfaces
  (recording analyzer segment list, rehearsal report, rehearsal-mode UI)
  still render `seg.songTitle` directly without surfacing the
  `matching.confidence_reason` or top suggestions. So an unresolved take
  shows blank instead of "(uncertain — top guess: X)". Honest, but not
  yet actionable.
  - **Why deferred:** The Reality Check pass scoped to data plumbing —
    surface the canonical `matching` field on the Take primitive without
    changing visible UI in this commit. UI work belongs in the Phase 3
    Annotated Review surface where suggestions can be confirmed inline.
  - **Trigger:** Phase 3 of the Rehearsal ↔ Song DNA proposal, OR first
    tester reports an unresolved segment with no actionable suggestion.
  - **Discovered:** 2026-05-15 (Analyzer Matching + Breakpoint Reality
    Check pass)
  - **Status:** open

- **Finding:** Breakpoint over-splitting risk — segmentation engine now
  preserves `raw_markers` lineage and stamps `boundary_confidence`
  (hard / soft / inferred), but no UI surface exposes these. Operators
  cannot yet inspect "this take's start was inferred from 4 merged
  fragments" without a console snippet against the canonical Take.
  - **Why deferred:** Same scoping rationale — data first, surface
    later. The metadata is now persistent and queryable, so a debug
    overlay or a Phase 3 review surface can read it without an analyzer
    re-run.
  - **Trigger:** Phase 3 Annotated Review surface, OR a tester reports
    a take with a clearly wrong start/end boundary that needs a debug
    explanation.
  - **Discovered:** 2026-05-15 (Analyzer Matching + Breakpoint Reality
    Check pass)
  - **Status:** open

- **Finding:** Human-correction learning loop — `_updateSegTitle` and
  `_applyUserOverrides` now stamp `matching.correction_source='human'`
  on the segment, and `GLTakes.normalizeRehearsalSegments` refuses to
  auto-overwrite the `song_id`/`song_title` of any take whose existing
  matching record carries that flag. But there is no feedback path back
  into the matcher's `_accuracyLog` / per-song correction signal beyond
  what `recordConfirmation` already captured per segment. Corrections
  should eventually re-rank the candidate pool for the same song
  cluster across rehearsals.
  - **Why deferred:** Cross-rehearsal correction propagation requires
    the embedding bank + accuracy log to be persistent across sessions,
    which crosses into the Phase 5+ "rehearsal intelligence maturation"
    territory the Operator Manual flagged as future work.
  - **Trigger:** Phase 5+ rehearsal intelligence pass, OR observation
    that the matcher repeats the same wrong guess on the same song
    across 3+ consecutive rehearsals despite human corrections.
  - **Discovered:** 2026-05-15 (Analyzer Matching + Breakpoint Reality
    Check pass)
  - **Status:** open

- **Finding:** Plan-first matching strategy is now active in the
  matcher (plan songs get +120 base in candidate pool, recent +50,
  active +25, library +1; plan-first scoring pass runs before broad
  search at `song_matching_engine.js:263-271`), but the
  `matching.candidate_pool` value the Take primitive carries is derived
  from `result._planFirstMatch` rather than from a single source of
  truth in the matcher. Future matcher refactors could drift the two
  apart silently (e.g., a new pool tier added at the candidate-builder
  level wouldn't propagate to the canonical field). Logged as a
  fragility note, not an active break.
  - **Why deferred:** No active mismatch today; introducing a single
    canonical pool enum on the matcher's return value would require
    touching the candidate-builder, scoreSegment, and the matching
    field builder in coordination. Out of scope for this stabilization
    pass.
  - **Trigger:** Next matcher tuning pass that adds a candidate pool
    tier (e.g., "harmonic_neighbors" for chord-similar fallback).
  - **Discovered:** 2026-05-15 (Analyzer Matching + Breakpoint Reality
    Check pass)
  - **Status:** open

- **Finding:** Phase 3A Take Review card sources audio from
  `session.recording_url` only — sessions where the recording was
  uploaded via Mixdowns (`rehearsal_mixdowns/{mxId}` with `drive_url` /
  non-blob `audio_url`) render with playback disabled even when a
  playable source exists in Firebase. The "No persistent audio
  attached" copy is technically true for `recording_url` but misleading
  about Mixdowns.
  - **Why deferred:** Mixdown lookup requires a separate fetch + dedup
    logic (which mixdown belongs to which session — only date-based
    today; see `rehearsal_mixdowns.audio_url` deferred entry). The
    spec asked us not to add fetch complexity in Phase 3A.
  - **Trigger:** Phase 3B (Annotated Review), OR first tester reports
    that a session with a known recording shows "no audio" in the
    Review card.
  - **Discovered:** 2026-05-15 (Phase 3A — Lightweight Analyzer Review
    Surface)
  - **Status:** open

- **Finding:** Phase 3A Take Review card uses its own `<audio>`
  element (`#rhTakeReviewAudio_{sessionId}`) that does not coordinate
  with the global Now Playing bar / `GLPlayer` queue. Two streams can
  play simultaneously if a user hits Play on a take while the global
  player has audio active.
  - **Why deferred:** A proper "claim the audio focus" handshake needs
    a small contract on `GLPlayer` (pause + suppress autoresume) that
    didn't exist in scope. Practical impact today is low — Now Playing
    is rarely active inside the Rehearsal page.
  - **Trigger:** First tester reports overlapping audio, OR when the
    Phase 3B Annotated Review surface starts to use take playback in
    contexts where Now Playing IS active.
  - **Discovered:** 2026-05-15 (Phase 3A build)
  - **Status:** open

- **Finding:** Auto-stop accuracy — Phase 3A take playback stops at
  the take's `end_sec` via the `timeupdate` event. Browsers throttle
  this event to ~250ms intervals, so the actual pause can overshoot
  the boundary by up to a quarter second. Imperceptible for typical
  song takes (3-5 min) but noticeable for short restart/false-start
  takes (10-15s).
  - **Why deferred:** Tighter stopping needs a `setTimeout(audio.pause,
    (endSec - startSec) * 1000)` fallback alongside the `timeupdate`
    listener — adds 2 lines but I deliberately kept the playback loop
    minimal in Phase 3A to avoid drift risk between the two stop
    sources during scrubs / network stalls.
  - **Trigger:** First tester reports overshoot on a short take.
  - **Discovered:** 2026-05-15 (Phase 3A build)
  - **Status:** open

- **Finding:** Phase 3A correction picker uses `<datalist>` for song
  autocomplete. iOS Safari supports the dropdown but typing-to-filter
  has historically been spotty across iOS versions, and the dropdown
  shows up below the input field — on a phone with the keyboard up,
  the dropdown can be clipped by the viewport.
  - **Why deferred:** Custom autocomplete UI is heavier than the spec
    allows for Phase 3A. The datalist gets us 80% of the way for free.
  - **Trigger:** First tester on iOS reports difficulty picking a song
    from the correction form.
  - **Discovered:** 2026-05-15 (Phase 3A build)
  - **Status:** open

- **Finding:** Phase 3A correction flow does not record WHO corrected
  the take. Takes get `matching.correction_source='human'` but no
  author field — the Annotation primitive has `author` but Takes do
  not. For a multi-member band, "Pierce reassigned this take" carries
  social signal that "Corrected by band" doesn't.
  - **Why deferred:** Adds a member-key field on Take + UI surfacing
    of who; not in Phase 3A's lightweight scope.
  - **Trigger:** First multi-member band tests Take Review, OR Phase
    3B Annotated Review work surfaces the same need.
  - **Discovered:** 2026-05-15 (Phase 3A build)
  - **Status:** open

- **Finding:** Phase 3A re-renders the entire Take Review card after
  every correction. Cheap at MVP scale (<30 takes per rehearsal) but
  loses focus + scroll position. A user mid-way down a list of 25
  takes who corrects take #18 jumps back to the top of the list.
  - **Why deferred:** Row-level surgical re-render is the right fix
    but requires a stable row-key model that survives the cache
    refresh. Phase 3A keeps the simple-and-correct path.
  - **Trigger:** First tester reports the scroll jump as friction.
  - **Discovered:** 2026-05-15 (Phase 3A build)
  - **Status:** open

- **Finding:** Phase 3B calibration toggle is hidden by design (URL
  `?calibration=1`, `localStorage.gl_analyzer_calibration='1'`, or
  `GLObs.enable()` in console). There is **no visible enable affordance**
  in the app — a new admin who doesn't know about the flag won't find
  it. Trade-off: keeping the UI calm for band members vs discoverability
  for founders/operators.
  - **Why deferred:** Visible-but-gated UI (e.g. an Admin Settings entry)
    would require deciding what counts as "admin" + plumbing through
    the existing `gl_dev_mode` flag. The console toggle is good enough
    while only Drew uses calibration mode.
  - **Trigger:** A second founder/operator joins ops, OR the admin
    settings surface is consolidated.
  - **Discovered:** 2026-05-15 (Phase 3B — Analyzer Calibration +
    Observability Layer)
  - **Status:** open

- **Finding:** `GLObs.analyzeTakeContinuity` is observation-only today
  — it emits `adjacent_same_song`, `unresolved_cluster`,
  `restart_loop_candidate`, and `short_take_run` signals that the
  calibration banner renders, but no downstream consumer reacts to
  them. The signals are visible, not actionable.
  - **Why deferred:** Phase 3B spec explicitly says "DO NOT solve
    continuity yet. Just expose signals." A continuity engine that
    auto-merges adjacent same-song takes (or flags loops to the user)
    is the natural Phase 4 follow-up.
  - **Trigger:** Phase 4 continuity engine, OR Drew observes the same
    signal repeatedly enough to justify a fix.
  - **Discovered:** 2026-05-15 (Phase 3B build)
  - **Status:** open

- **Finding:** Phase 3B `previous_auto_guess` is captured only when a
  human correction overwrites a take that previously had
  `correction_source !== 'human'`. If the same take is corrected twice
  by humans (e.g. Drew picks "Sugaree", then Pierce picks
  "Brown Eyed Women"), only the first correction's prior auto guess
  survives — Pierce's correction won't capture Drew's choice as a
  "prior".
  - **Why deferred:** Multi-hop correction history needs a small
    append-only log on the Take (or a separate annotation per
    correction). The single-slot field is enough for "analyzer vs
    human" diagnostics, which is the primary Phase 3B use case.
  - **Trigger:** First time two band members re-correct the same take,
    OR cross-rehearsal correction learning (Phase 5+) starts to need
    a richer history.
  - **Discovered:** 2026-05-15 (Phase 3B build, gl-takes.js
    updateTake)
  - **Status:** open

- **Finding:** Calibration banner's audio-source diagnostic reports
  `mixdownLookupAvailable: false` with the note "Mixdown lookup is not
  implemented in Phase 3B" — surfacing the same gap as the standing
  Phase 3A Mixdown finding above, but doing nothing new about it. The
  diagnostic is informational; the gap remains.
  - **Why deferred:** Linked to the Phase 3A mixdown finding above.
    Resolving both at once when Phase 3B+ adds the mixdown→session
    join.
  - **Trigger:** Same as the Phase 3A mixdown finding.
  - **Discovered:** 2026-05-15 (Phase 3B build, GLObs.summarizeAudioSource)
  - **Status:** open

- **Finding:** GLObs.log is gated only at the call site
  (`if (window.GLObs && window.GLObs.isEnabled())`). Every gated log
  pays a function-call overhead even when OFF (the arg expressions
  still evaluate, even though the log doesn't print). The cost is
  negligible in practice, but the pattern can drift — a future log
  with an expensive payload computation (e.g. building a JSON dump
  before passing it in) would still pay that cost when calibration
  mode is off.
  - **Why deferred:** Migrating every call site to a lambda-based API
    (`GLObs.log('Group', 'event', function() { return expensivePayload(); })`)
    is overkill for today's payload shapes. Document the pattern; revisit
    when a callsite genuinely needs lazy evaluation.
  - **Trigger:** A real log site with non-trivial payload-building cost.
  - **Discovered:** 2026-05-15 (Phase 3B build)
  - **Status:** open

- **Finding:** Calibration mode is global — once on, every Take
  Review card in every rehearsal session gets diagnostics. There's no
  per-session "calibrate just this rehearsal" toggle. Acceptable today
  (founder works in their own browser), but if the toggle ever ships
  to non-founders, a band member could toggle it on and accidentally
  send a screenshot full of internal IDs to the band chat.
  - **Why deferred:** Phase 3B explicitly admin-only. Per-session
    scoping is a Phase 5+ concern once roles + permissions matter.
  - **Trigger:** Any non-founder access to calibration mode, OR
    consolidation of band-member-visible diagnostics into a separate
    public-facing surface.
  - **Discovered:** 2026-05-15 (Phase 3B build)
  - **Status:** open

- **Finding:** Rehearsal page hierarchy refactor (Tonight's Rehearsal
  hero) demoted the intent picker behind a collapsed "+ Build a
  different flow ▾" details when a plan exists, but did NOT remove the
  picker. Mental model is improved (the page now answers "what are we
  rehearsing?" first), but the four-button workflow chooser (Run the
  Gig / Practice Transitions / Work Weak Songs / Build Custom Plan) is
  still present one tap away. Some testers may still default to it
  rather than editing the existing plan from the hero.
  - **Why deferred:** The intent picker is the only entry path for
    "no-plan-yet" cases AND the only path that auto-builds plans from
    setlists / focus songs. Removing it entirely would require a new
    "+ Add to flow" affordance on the hero that does the same auto-build
    work — out of scope for the incremental refactor pass.
  - **Trigger:** First tester explicitly reports the picker still feels
    like "what should I do?" decision tax, OR when the flow rail gains
    direct add-from-setlist / add-from-focus inline buttons.
  - **Discovered:** 2026-05-15 (Rehearsal Page Refactor — Tonight's
    Rehearsal Flow)
  - **Status:** open

- **Finding:** Inline intelligence on plan-rail rows — the spec called
  for "⚠ rough transition into Deal last rehearsal", "⚠ low readiness",
  "✓ strong" markers per song row. The hero refactor surfaced the
  signals at the top (focus count, gig countdown), but the existing
  plan-unit row renderer (rehearsal.js:728-1067) was NOT modified — so
  individual song rows in the flow rail still render without per-row
  status hints. The data IS available (`weakSongs` list, focus engine,
  linked-pair metadata), just not yet displayed at the row level.
  - **Why deferred:** Surgically modifying the existing 340-line plan
    unit rendering risked destabilizing the drag-reorder logic + plan
    edit surfaces. The hero + demoted picker were the highest-impact
    UX wins; row enrichment is the natural next pass.
  - **Trigger:** Next Rehearsal page polish pass, OR first tester
    reports "I can't tell which songs need work just from the flow."
  - **Discovered:** 2026-05-15 (Rehearsal Page Refactor)
  - **Status:** open

- **Finding:** Transition pairs rendering — linked-pair units (`{type:
  'linked', songs:[A,B], title:'A → B'}`) already exist in the data
  model (built from setlist segue metadata), and the existing plan
  section renders them as a single combined row. The Phase 3 spec
  asked for transitions to feel like inline-between-songs UX
  ("Sugaree → Deal · ⚠ transition flagged · [Practice Transition]"),
  but the hero refactor pass did not break linked pairs out into
  inline connector elements. They still display as one combined unit.
  - **Why deferred:** Splitting linked pairs into two rows + a
    connector requires touching the same plan unit renderer (with
    drag-reorder constraints) flagged in the inline intelligence
    finding above. Both should land together in a row-rendering pass.
  - **Trigger:** Next Rehearsal page polish pass, OR Phase 4 transition
    intelligence work.
  - **Discovered:** 2026-05-15 (Rehearsal Page Refactor)
  - **Status:** open

- **Finding:** Right rail content (Snapshots / Session History /
  Mixdowns) is still conditionally rendered into `#rhContextRail`
  alongside the new Tonight's Rehearsal hero. On wide viewports the
  rail renders side-by-side with the main column; the hero ends up
  competing with the rail for visual attention even though the rail
  contains lower-priority content. Mobile is fine (rail collapses
  below main).
  - **Why deferred:** Right rail demotion was flagged in the spec but
    the existing rail content already uses `<details>` for collapse and
    only renders one open at a time. A more aggressive demotion (move
    rail content into a single "More" details below the flow rail)
    would touch four call sites and risk regressing the rail's existing
    accordion logic.
  - **Trigger:** First tester reports the right rail is distracting
    from the hero on desktop, OR right-rail content is consolidated
    into a single "Past rehearsals" surface.
  - **Discovered:** 2026-05-15 (Rehearsal Page Refactor)
  - **Status:** open

- **Finding:** `window._rhDemotedPickerHtml` is a window-scoped
  string used to stash the demoted intent-picker HTML across the
  async branch in `_rhRenderCommandFlow` so it can be appended to
  the main HTML below the plan section. It works, but using window
  globals as cross-branch variable storage in a 740-line async
  function is fragile — a future refactor that re-renders mid-flight
  could leave a stale picker HTML in place.
  - **Why deferred:** Threading the picker HTML through closure
    scope cleanly would have required restructuring more of
    `_rhRenderCommandFlow` than the incremental refactor pass should
    attempt. A future rehearsal-page modularization pass should
    factor the page into smaller render functions that return HTML
    strings + share state via a normal closure.
  - **Trigger:** Next Rehearsal page modularization pass.
  - **Discovered:** 2026-05-15 (Rehearsal Page Refactor)
  - **Status:** open

- **Finding:** Mobile-specific flow rail testing — the Tonight's
  Rehearsal hero uses flex-wrap so CTAs stack on narrow viewports,
  and the existing plan section already renders single-column on
  mobile. But there's no explicit mobile QA in this pass — the
  refactor was tested via syntax check + structural reasoning only,
  not in a mobile browser.
  - **Why deferred:** The user's spec emphasized mobile as critical;
    a real mobile-first review on a phone is a separate validation
    pass that needs Drew or a tester actually opening the app on a
    phone after this commit deploys.
  - **Trigger:** Drew's first mobile session post-deploy, OR
    Tester #1 mobile onboarding.
  - **Discovered:** 2026-05-15 (Rehearsal Page Refactor)
  - **Status:** open

- **Finding:** `PracticeTask` schema supports only `open`/`resolved`.
  The proposed task lifecycle (Open / In Progress / Fixed / Recheck +
  optional Archived / Deferred / Won't Fix) requires a schema bump.
  - **Why deferred:** Phase 4 of the Rehearsal ↔ Song DNA proposal;
    additive change with a clean backward-compat map (old `resolved` →
    new `fixed`).
  - **Trigger:** Phase 4 of the proposal, OR any task-management
    feature request.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Status:** open

## 4. Beta Observation Candidates

"Watch whether testers understand X." "Observe if users ignore Y."
"Don't fix unless validated." Things worth tracking before changing.

- **Finding:** Does anyone notice the "Rate from your pill at the top"
  hint inside the now-read-only Readiness section? If readers ignore
  it, the bottom section may be more confusing than helpful.
  - **Why deferred:** Pure observation — requires real usage data.
  - **Trigger:** First time a tester reports confusion about how to
    rate readiness despite the new popover.
  - **Discovered:** 2026-05-15 · d519673d
  - **Status:** open

- **Finding:** Do band members re-rate songs after the readiness
  vocabulary change (1=Rough vs old 1=Learning)? Or do scores stay
  put, meaning the new vocabulary just retroactively reframes them?
  - **Why deferred:** Behavioral question; no fix needed unless trust
    drops.
  - **Trigger:** Aggregate readiness scores trending unusually low/high
    in the week post-deploy, OR a tester says "my old rating doesn't
    match what the label says now."
  - **Discovered:** 2026-05-15 · 7a68b97d
  - **Status:** open

- **Finding:** Do testers actually expand the bottom Readiness section,
  or has it become invisible now that the top pills cover the primary
  flow?
  - **Why deferred:** Need usage signal before deciding whether to keep,
    remove, or fold into the popover footer.
  - **Trigger:** Next time we audit which song-detail sections still
    earn their vertical space.
  - **Discovered:** 2026-05-15 · d519673d
  - **Status:** open

- **Finding:** Does the cleanup-health summary line ("82% metadata
  complete · N fields missing across M active songs") feel useful or
  noisy? Could be replaced with just the per-button counts.
  - **Why deferred:** Added speculatively as part of cleanup-visibility
    work; needs real-use validation.
  - **Trigger:** First tester says it's noise, or first tester quotes
    the % in a band conversation (validation signal).
  - **Discovered:** 2026-05-15 · 9f08b2b8
  - **Status:** open

- **Finding:** Do testers actually want multi-member tagging on
  comments, or is "shared with the band" enough? Risk of
  over-engineering the comment primitive before behaviour is observed.
  - **Why deferred:** Phase 1 of the Rehearsal ↔ Song DNA proposal will
    ship tagging on chart-overlay first as a single-surface test before
    extending it across annotation kinds.
  - **Trigger:** First tester says "I wish I could send this comment
    specifically to Brian" — validates demand; OR three weeks pass
    with no tagging usage in shipped Phase 1 surface — invalidates.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Status:** open

- **Finding:** Does the Annotated Rehearsal Review surface feel like a
  "document with a comment rail" or a "DAW"? The proposal frames it as
  the former (Word-style); a tester who reads it as a DAW will look for
  multitrack-mixer-style controls and feel let down.
  - **Why deferred:** Unmeasurable without the surface in front of users.
  - **Trigger:** First Annotated Review surface ships in Phase 3 of the
    proposal; watch for "where's the mixer?" questions.
  - **Discovered:** 2026-05-15 (Rehearsal ↔ Song DNA proposal)
  - **Status:** open

- **Finding:** Do users distinguish the recommendation hero's
  "Use this date" CTA from the action bar's "+ Rehearsal" button? The
  former is a date-specific shortcut; the latter is the canonical
  generic add. They could still read as duplicate scheduling actions
  to a new band member.
  - **Why deferred:** Coherence pass deliberately preserved both — the
    hero CTA is a meaningful shortcut when the engine has a strong
    recommendation. Removing it would lose operational momentum.
  - **Trigger:** First tester confusion ("which Schedule button do I
    use?"), or once we have usage data showing one button dominates.
  - **Discovered:** 2026-05-15 (Schedule coherence pass)
  - **Status:** open

## 5. Intentional Non-Fixes

Things we explicitly chose NOT to fix and want to remember why.
Future contributors should not "fix" these without checking back.

- **Finding:** `openRehearsalMode` is not being renamed to its actual
  purpose (chart/practice overlay).
  - **Why deferred:** 50+ callsites across rehearsal.js, song-detail.js,
    workbench.js, songs.js etc. Rename is high-risk churn for purely
    cosmetic gain. Existing alias path documented at rehearsal-mode.js
    line 100.
  - **Trigger:** Only revisit during a deliberate naming-pass with a
    full automated rename + test cycle.
  - **Discovered:** 2026-05-15 (pre-existing; surfaced during Edit
    double-click investigation) · 9f08b2b8
  - **Status:** dismissed — intentional preservation

- **Finding:** Missing-Charts count not added to the cleanup category
  buttons.
  - **Why deferred:** Computing chart presence is async (per-song
    Firebase reads, see `openChartQueue` scan). Synchronous counts
    would require a `_hasChart` preload — out of scope for the
    lightweight cleanup-visibility pass.
  - **Trigger:** If we add a chart-presence preload for other reasons,
    pipe it into the cleanup count.
  - **Discovered:** 2026-05-15 · 9f08b2b8
  - **Status:** dismissed — intentional non-fix

- **Finding:** `tooClose` field on rehearsal-date scoring objects now
  also covers organizer-conflict disqualifications — semantically it's
  becoming "disqualified for primary recommendation," not just spacing.
  - **Why deferred:** Renaming the field requires touching every UI
    consumer that reads `c.tooClose` / `recs.tooClose`. The new
    organizer-conflict label ("Organizer conflict") already disambiguates
    the user-facing copy; only the internal field name is overloaded.
  - **Trigger:** Next deliberate scheduling refactor, or when a third
    disqualification reason gets added and the overload becomes painful.
  - **Discovered:** 2026-05-15 (Schedule coherence pass)
  - **Status:** dismissed — intentional preservation

- **Finding:** Fadr is not being removed; it's behind an "Advanced
  audio tools" disclosure.
  - **Why deferred:** Fadr's distinct value is per-instrument MIDI
    extraction (LALAL doesn't produce MIDI). Useful for the notation
    pipeline and experimental harmony workflows.
  - **Trigger:** Only if the notation pipeline no longer needs MIDI
    seeds, OR Fadr stops being maintained upstream.
  - **Discovered:** 2026-05-15 · bb594402
  - **Status:** dismissed — intentional preservation
    (see `project_lalal_fadr_hierarchy` memory)
