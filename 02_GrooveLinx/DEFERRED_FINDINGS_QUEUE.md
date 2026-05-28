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

- **Finding:** Server-side analysis phase markers — replace the
  current heuristic phase narrator (browser maps elapsed-seconds → fake
  phase label) with ground-truth phase emission from `segment_audio` in
  Modal. The user prefers seeing what's actually computing, not a
  decorative simulation. Per Drew (2026-05-24): "I would much rather
  know what is going on then just a flashy front."
  - **Why deferred:** Heuristic narrator shipped in `ea72808f` works
    well enough for the impressive-feel UX and was the smallest
    deliverable change. Ground truth requires Modal-side state
    plumbing.
  - **Trigger:** When we're touching `services/rehearsal-segment/segment.py`
    again, OR when other long-running Modal jobs (render, stem
    separation) need the same treatment and we want one consistent
    pattern.
  - **Implementation sketch:**
    1. `segment_audio` writes to a Firebase doc at
       `rehearsal_sessions/{sid}/_analyzeProgress/{callId}` between
       phases — each write is `{phase, label, startedAt}`. Needs
       Modal to authenticate to Firebase (firebase-admin SDK + service
       account secret already in the `groovelinx-stems` Modal secret).
    2. Browser polls that doc each tick alongside `/rehearsal-segment/check`
       (or replaces the elapsed-time check entirely — the doc gives
       phase + timestamp so the browser can compute elapsed locally).
    3. Replace `_mtCurrentAnalyzePhaseIdx(elapsedSec)` heuristic with
       a direct read of the phase id from the Firebase doc.
    4. Pattern can extend to the multitrack `render_mix` and
       `separate_stems` Modal functions for unified progress UX.
    5. Mark the existing heuristic clearly when deprecating —
       `_MT_ANALYZE_PHASES` thresholds become a fallback used only
       when the Firebase doc is absent or stale.
  - **See also:** new memory `feedback_ground_truth_over_theater.md`
    captures the principle: prefer real-time truth over decorative
    simulation, log a deferred finding when shipping a heuristic.
  - **Discovered:** 2026-05-24 · `ea72808f`
  - **Status:** open

- **Finding:** Tier 2 segment-correction primitives (Merge with next /
  Lightweight trimming ±5s ±0.5s / Keyboard review workflow S/C/T/X/Enter).
  Split-at-playhead already shipped earlier (build `20260524-192317`).
  Merge + trim + keyboard are net-new and were explicitly held out of
  Phase 1 per Drew's instruction "no new merge/trim work yet unless
  it already exists and is only being surfaced safely."
  - **Why deferred:** Phase 1 needs in-browser verification first to
    confirm the trust+usability foundation works before layering edit
    primitives on top. Edit ops change segments destructively; building
    them on an unverified UI risks user error.
  - **Trigger:** Drew confirms Phase 1 visually works → Phase 2 lands.
  - **Discovered:** 2026-05-24 · Phase 1 commit
  - **Status:** open

- **Finding:** Tier 3 rehearsal-intelligence learning loop —
  rehearsal-plan-aware analyzer matching (Modal reads upcoming gig
  setlist as priors); fingerprint training corpus at
  `bands/{slug}/song_fingerprints/{songSlug}/{sampleId}` written on
  confirm; segment provenance ("Detected via: rehearsal plan /
  fingerprint match / bpm-key / prior correction / audio classifier");
  cross-rehearsal intelligence schema hooks (every Franklin's across
  all rehearsals, lineage of recurring issues). Phase 1 lays the
  groundwork (Confirmed state + songId resolution + multitrackSegments
  overlay) but doesn't connect to matching yet.
  - **Why deferred:** Phase 3 territory — Drew's convergence directive
    explicitly phases this after Tier 1 verification + Tier 2 edit
    primitives. Confirmed segments accumulate in Firebase now so the
    training corpus has data to read from when Phase 3 ships.
  - **Trigger:** Phase 1 verified + Phase 2 shipped, then start Phase 3
    on the next session that touches segment.py.
  - **Implementation sketch (mostly carried forward from earlier note):**
    1. `segment_audio` reads `bands/{slug}/song_fingerprints/*` on start
       (one-time cache load).
    2. Matching pipeline order: rehearsal plan / setlist (highest weight)
       → known band fingerprints → general BPM/key/duration heuristics.
    3. On segment match, emit `provenance: { source, score, prior_id }`
       in the segment record.
    4. Browser displays provenance chip in Segments panel.
    5. Confirmed segments (Phase 1 reviewState='confirmed') auto-promote
       to fingerprint corpus via a Modal sweep function or worker cron.
  - **Discovered:** 2026-05-24 · Phase 1 commit
  - **Status:** open

- **Finding:** Tier 5 advanced rehearsal intelligence — segment quality
  metadata (keeper / false start / partial / best take / breakdown /
  needs revisit), annotation graph integration (annotations attach to
  segment + timestamp + Song DNA + rehearsal + tagged members +
  open/in-progress/fixed/recheck lifecycle), shared editing primitives
  extracted into a service (merge/split/trim/confirm/exclude/rename/retag)
  reusable across Review Mode + Chopper.
  - **Why deferred:** Phase 5 future-ready territory. Phase 3 schema
    hooks (provenance + songId + reviewState) lay enough groundwork that
    Tier 5 features can be added without breaking changes.
  - **Trigger:** When annotation system gets its next overhaul, OR when
    we need to unify Review Mode + Chopper edit logic, OR when band
    requests quality metadata for Best Take tracking.
  - **Discovered:** 2026-05-24 · Phase 1 commit
  - **Status:** open

- **Finding:** Per-song share — one shareable URL per analyzed song
  segment instead of one URL for the whole mix. Useful for narrow
  bandmate workflows ("send Brian the new Sugaree arrangement").
  Currently we share `mix_songs_only` which is all songs concatenated.
  - **Why deferred:** Drew explicitly excluded this from the Option A
    scope ("Do NOT create per-song share yet"). Songs-only mix covers
    the immediate bandmate-sharing need.
  - **Trigger:** When the band wants to share individual songs without
    sending the whole rehearsal, OR when Take Review / chopper gets
    integrated with the multitrack render flow.
  - **Discovered:** 2026-05-24 · `9d561f86`
  - **Status:** open

- **Finding:** Multitrack player has no UI to flag individual segments
  as between-song chatter. Today the songs-only mix relies on the
  analyzer's segmentation + any `isBetween` flags set via the
  chopper/segment editor surface in `rehearsal.js`. If the analyzer
  misclassifies (e.g., includes 90s of tuning as a "song"), the user
  has no in-player way to fix it before rendering songs-only.
  - **Why deferred:** Out of Option A's scope. The analyzer is good
    enough for most rehearsals; misclassifications are visible at the
    output stage (Drew can listen back and re-render).
  - **Trigger:** First time the songs-only mix has clearly wrong
    segment boundaries that bandmates complain about.
  - **Discovered:** 2026-05-24 · `9d561f86`
  - **Status:** open

- **Finding:** Multitrack browser playback architecture cannot meet the
  product requirement (17 stems × 3 hours, no audible drift, fast seek,
  responsive). Confirmed via thorough audit at
  `02_GrooveLinx/audits/MULTITRACK_BROWSER_PLAYBACK_AUDIT.md`. Dominant
  cause is the 6-connection-per-origin browser cap colliding with 17
  simultaneous FLAC range fetches on far seeks; secondary cause is the
  independent-clock-per-element semantics of HTML5 `<audio>`. Three
  browser-only patch attempts on 2026-05-24 (builds `153606`, `155054`,
  `160224`) all failed in different ways.
  - **Why deferred:** Audit is analysis-only; no code change in this pass
    per the audit-scope instructions. Strategic fix (R1–R3 server-side
    render pipeline) needs explicit go-ahead from Drew before next
    session.
  - **Trigger:** Drew confirms the audit's recommendation in §12. Then
    next session builds R1 (Modal `render_mix`) + R2 (worker
    `/multitrack/render`) + R3 (player "Export Rehearsal Mix" button)
    per `specs/rehearsal_render_pipeline.md`. ~5 hours of work.
  - **Discovered:** 2026-05-24 · `50a36ec3`
  - **Status:** open

- **Finding:** FLAC stems' source-alignment is theoretical — REAPER
  "Entire project" bounds + FLAC's zero codec delay should guarantee
  sample-aligned cross-stem playback, but this has never been empirically
  verified. If REAPER is misconfigured (different sample rate per track,
  trim region not honored, etc.) it could be contributing to drift
  alongside the connection-pool issue.
  - **Why deferred:** Audit proposes an ffprobe/sox/metaflac script
    (see §4 of `MULTITRACK_BROWSER_PLAYBACK_AUDIT.md`) but doesn't run
    it without Drew's confirmation — needs a downloaded session ZIP.
  - **Trigger:** Run the script against the 5/18 session's `📦 Stems`
    ZIP once Drew greenlights. If misalignment found, file as separate
    upstream bug; if not, dismiss this finding.
  - **Discovered:** 2026-05-24 · `50a36ec3`
  - **Status:** open

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

- **Finding:** `saveHomeAddress` (app.js + app-dev.js) dual-writes the
  member's home address to BOTH the legacy path
  `bands/{slug}/members/{key}/homeAddress` AND the canonical
  `bands/{slug}/meta/members/{key}/homeAddress`. The legacy write is
  retained for back-compat with `_restoreHomeAddress` (which still
  reads from the legacy path on init to repopulate localStorage).
  - **Why deferred:** Existing user records (pre-`20260523-181905`)
    only have the address at the legacy path. Removing the dual-write
    now would orphan the canonical path until every member re-saves;
    keeping it costs one extra Firebase write per save. Cheap to live
    with.
  - **Trigger:** After every active band member has re-saved their
    address at least once (verifiable via a one-time Firebase scan),
    drop the legacy write and migrate `_restoreHomeAddress` to read
    from `meta/members/{key}/homeAddress`. Alternatively, a one-shot
    migration script that copies legacy → canonical and deletes the
    legacy path closes this faster.
  - **Discovered:** 2026-05-23 · 9d7a85df (issue #47)
  - **Status:** open

- **Finding:** Phase 4C `plan_priors` matching is deployed (worker
  passthrough + Modal `segment_endpoint` reads + 1.5× boost in
  `_match_segment_to_setlist`) but no existing multitrack session
  surfaces the `🎯 ON PLAN` chip — the Phase 4B+4C UAT pass on
  2026-05-25 confirmed 0/141 segments on `rsess_mt_mpju4yyn_7pko`
  carry `onPlan` / `planMatch` / `provenance.matchSource='plan'`.
  Root cause: the only multitrack sessions in `bands/deadcetera/
  rehearsal_sessions` (`rsess_mt_moz3077x_5793` from 5/10 and
  `rsess_mt_mpju4yyn_7pko` from 5/24) were both analyzed BEFORE
  Phase 4C shipped, so their segment objects predate the
  `provenance` schema and never went through the plan-prior code
  path. Feature is shipped, data is stale.
  - **Why deferred:** No new bug — Phase 4C works for the next
    rehearsal that runs through Analyze. Backfilling old sessions
    requires re-running `_mtAnalyzeRun` per session, which is a
    paid Modal call (~5-15 min each for a 3-hour rehearsal).
    Premature to backfill before Drew has seen the chip on a
    fresh session and decided it's worth the spend.
  - **Trigger:** (a) next multitrack rehearsal lands — verify the
    chip surfaces on the fresh analysis without action; OR (b)
    Drew explicitly wants the chip visible on `rsess_mt_mpju4yyn_7pko`
    today for screenshot/demo purposes — then hit `🎯 Analyze` in
    that session's transport to re-run with current plan priors.
  - **Implementation sketch (if Drew wants opportunistic backfill):**
    a one-shot `scripts/reanalyze-with-plan-priors.js` that walks
    `bands/{slug}/rehearsal_sessions/*` where `type === 'multitrack'`
    and `analysis.story.segments[0].provenance == null`, queues
    `_mtAnalyzeRun` for each. Skips sessions older than ~90 days.
    Idempotent. Logs Modal cost per session.
  - **Discovered:** 2026-05-25 · 87ec930b (Phase 4B+4C UAT)
  - **Status:** open

## 2. UX Coherence Debt

Inconsistent terminology, duplicate interaction models, source
vocabulary mismatches, fragmented flows, naming drift.

- **Finding:** Multiple entry points to mobile Review Mode from the Rehearsal
  page — "Review Last Rehearsal" button, "Last rehearsal · 0m" row,
  "Listen back to each song" text, scrolled "RECORDINGS" section. First-time
  mobile user doesn't know which to tap.
  - **Why deferred:** Single-entry-point consolidation is a navigation
    simplification; Pass 3 mobile tabs territory. Filed 2026-05-25 (harvest F03).

- **Finding:** Page title "Rehearsal" appears twice on mobile — once in the
  topbar overlay, once as a big heading below. Two title sources, ~80px of
  redundant vertical real estate.
  - **Why deferred:** Mobile-shell concern, not multitrack-rehearsal scope.
    Filed 2026-05-25 (harvest F05).

- **Finding:** Empty-comments-state copy says "No comments yet — scrub to a
  moment, type a note, hit Enter." References desktop keyboard ("hit Enter")
  on mobile.
  - **Why deferred:** One-line copy change for mobile branch. Filed
    2026-05-25 (harvest F15). Closes when Bug #22 ships (session composer hidden).

- **Finding:** Right-side context panel ("DeadCetera · Song context panel")
  still in DOM on mobile even though hidden visually.
  - **Why deferred:** Mobile-shell DOM/perf optimization, not Pass 2 scope.
    Filed 2026-05-25 (harvest F16).

- **Finding:** Now-reviewing label text "🎵 Reviewing: Music Never Stopped ·
  0:00–8:36 · 96%" renders in full (60+ chars) and contributes to viewport
  pressure on mobile. Mobile-friendly label could be just "🎵 Music Never
  Stopped" (verb implied, timestamps + conf already on the row).
  - **Why deferred:** Linked to Bug #29-territory; will be touched when the
    now-reviewing label gets a mobile-specific layout. Filed 2026-05-25
    (harvest F19).

- **Finding:** 5/18 rehearsal has 31 music segments with heavy duplication
  (Music Never Stopped × 6, Green-Eyed Lady × 4, Life During Wartime × 3,
  Sugaree × 2, etc.). Real rehearsal behavior (band practiced same songs
  multiple times) but visually reads as "analyzer made same call repeatedly."
  No indicator of "different take of the same song."
  - **Why deferred:** Future surface: group repeated segments under
    expandable parent OR add "take 1 / take 2" labels. Pass 4+. Filed
    2026-05-25 (harvest F18).

- **Finding:** Tools menu rage-tap shows visual flicker — 6 taps = 3 open + 3
  close, bottom-sheet appearing and disappearing rapidly.
  - **Why deferred:** Debounce the toggle handler (60ms minimum gap) to
    prevent rage-tap flicker. Cosmetic. Filed 2026-05-25 (harvest F27).

- **Finding:** Inner `<div>` elements inside the focused mobile row don't
  propagate click handlers usefully — GLUXTracker flags them as `dead_click`.
  Row container has onclick, inner divs don't.
  - **Why deferred:** Pass 3+ row-redesign territory. Filed 2026-05-25
    (harvest F26 follow-on).

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

- **Finding:** Multitrack Review Mode — Review Queue mode toggle
  ("show only needs-review + unnamed segments") not yet built. Drew
  has filter pills (Phase 4A) but no one-click "give me only the
  rows I have to fix" toggle for triage workflow.
  - **Why deferred:** Phase 4B+4C had a coherent 2-slice scope (trust
    engineering + plan-aware matching). Adding the queue toggle would
    have diluted the focus. Pills already approximate it (Needs Review
    + Unnamed both ON, everything else OFF).
  - **Trigger:** Phase 4D pickup; or if Drew finds himself toggling
    pills the same way every session.
  - **Discovered:** 2026-05-24 · 87ec930b
  - **Status:** open

- **Finding:** Multitrack Review Mode — `J` keyboard shortcut for
  "jump to next unresolved segment" not yet wired. `S`/`C`/`T`/`X`/
  `Enter`/`↑`/`↓` already work (Phase 2D).
  - **Why deferred:** Same Phase 4B+4C scope discipline as the
    Review Queue toggle. The two pair naturally as Phase 4D.
  - **Trigger:** Phase 4D pickup.
  - **Discovered:** 2026-05-24 · 87ec930b
  - **Status:** open

- **Finding:** Multitrack Review Mode — large row layout restructure
  was in Drew's original Phase 4B request but ChatGPT's reframe
  dropped it in favor of the trust-engineering slice.
  - **Why deferred:** "Incremental convergence" frame — better to
    ship trust signals (4B-1/2/3/4) that the user feels immediately
    than to reshape rows in a way that costs UAT cycles.
  - **Trigger:** If Phase 4B+4C UAT surfaces row-density complaints,
    or if the Review Queue toggle (above) ends up needing different
    row formatting.
  - **Discovered:** 2026-05-24 · 87ec930b
  - **Status:** open

- **Finding:** Multitrack Review Mode — "Human-corrected" badge per
  segment (visually distinguish user-edited rows from analyzer-only
  rows) deferred from Phase 4B.
  - **Why deferred:** Same incremental-convergence reasoning. The
    confirmed-state green wash + ✓ chip already partially conveys
    this; a dedicated badge is the polish pass.
  - **Trigger:** Phase 4D or when cross-rehearsal analytics need to
    distinguish human-validated vs analyzer-only training data.
  - **Discovered:** 2026-05-24 · 87ec930b
  - **Status:** open

- **Finding:** Multitrack Review Mode — Excluded rows still rendered
  with red-tinted "danger" semantics; Drew's instinct was that
  Excluded is more of a "set aside" amber than a "broken" red.
  - **Why deferred:** Color-vocabulary change touches multiple chip
    and stripe paths; held until other Phase 4B color decisions
    landed first (solid confidence chips, red wash for needs-review).
  - **Trigger:** Phase 4D color audit; or if confirmed-state
    green vs needs-review red vs excluded amber feels inconsistent
    in UAT.
  - **Discovered:** 2026-05-24 · 87ec930b
  - **Status:** open

- **Finding:** Multitrack Review Mode — segment-row waveform
  rendering could be simplified (server-rendered peaks already
  exist; consider eliding the per-row mini-waveform when row is
  collapsed).
  - **Why deferred:** Performance is currently fine; simplification
    is an opportunistic cleanup, not a needed fix.
  - **Trigger:** If row-render perf degrades on long rehearsals
    (~150+ segments) OR Phase 4D row restructure makes it natural.
  - **Discovered:** 2026-05-24 · 87ec930b
  - **Status:** open

- **Finding:** Multitrack Review Mode — comments/annotations
  embedding per segment (band member notes, "fix this take", etc.)
  was on Drew's wish list but not in Phase 4B scope.
  - **Why deferred:** Cross-cutting feature — needs schema
    decisions (per-segment vs per-song threads), auth model, and
    Practice/Workbench integration. Not a UI tweak; it's a
    feature.
  - **Trigger:** When the band starts asking "where do I record my
    note about Pierce's solo in song X take 2?" — currently they
    use external tools.
  - **Discovered:** 2026-05-24 · 87ec930b
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

- **Finding:** Living Set Sheet inline signals fire ONE per row by
  precedence: ⚠ Transition needs work → 💬 N open notes → ⚠ Low
  readiness → ✓ Tight last rehearsal. Restraint by design, but the
  precedence is a heuristic — a song that's both in focus AND has
  open notes will show the notes signal (higher priority) and the
  user won't see the readiness flag inline. The data is still in
  the hero's "Focus: N weak songs" summary, but per-row visibility
  is reduced.
  - **Why deferred:** Showing two signals per row would push us into
    chip-stack territory the spec explicitly forbids. Single-signal
    restraint wins. If testers report missing readiness context,
    the precedence can be re-tuned (e.g., low-readiness > notes
    when avg < 2).
  - **Trigger:** First tester says "I knew Sugaree was weak but the
    flow rail didn't show it because it had a comment."
  - **Discovered:** 2026-05-15 (Living Set Sheet — Rehearsal Flow
    Intelligence Pass)
  - **Status:** open

- **Finding:** "Tight last rehearsal" positive signal uses a
  conservative confidence threshold (avg ≥ 0.7 across the song's
  music segments in the latest session). On a recent recording where
  the analyzer confidence is generally low (few audio embeddings,
  cold matcher start), no songs will fire the positive signal even
  if the band actually played them tight. The signal will become
  more reliable as the matcher's embedding bank grows over multiple
  rehearsals.
  - **Why deferred:** Auto-tuning the threshold from observed
    confidence distribution would help, but pre-tester data is too
    sparse to know the right threshold. Ship the conservative one,
    observe.
  - **Trigger:** Drew reports "we played 5 songs tight but only 1
    shows ✓" after a real rehearsal, OR analyzer matcher tuning
    pass.
  - **Discovered:** 2026-05-15 (Living Set Sheet)
  - **Status:** open

- **Finding:** Annotation count signal ("💬 N open notes") buckets
  by `anchor.song_id`, which during the songs_v2 migration window
  stores the song title string (per the existing songs_v2 entry
  above). When the migration completes, the bucket key will need to
  switch to canonical songId — and the signal will stop firing for
  any annotation whose `song_id` was written under the old title-
  string convention until those annotations are migrated.
  - **Why deferred:** The fix lives in the songs_v2 migration story,
    not Phase 3 UI. Logged so the migration plan accounts for the
    flow-rail consumer.
  - **Trigger:** songs_v2 migration completion.
  - **Discovered:** 2026-05-15 (Living Set Sheet)
  - **Status:** open

- **Finding:** Per-unit "Practice transition" handler queues just the
  two songs in the linked pair via `openRehearsalModeWithQueue`.
  Each song gets a flat 5-minute budget — there's no transition-
  specific time hint or "play through, stop, drill the seam"
  guidance baked in. Functionally lets the band practice the songs
  back-to-back; doesn't yet teach the transition itself.
  - **Why deferred:** A real transition-practice mode (drill the
    seam, loop the last bar of A into the first bar of B) is a Phase
    4+ build. Phase 3 keeps it lightweight and additive.
  - **Trigger:** Phase 4 transition intelligence work, OR first
    tester reports "Practice transition just plays them in sequence,
    I needed the seam."
  - **Discovered:** 2026-05-15 (Living Set Sheet)
  - **Status:** open

- **Finding:** Transition signal only fires for `linked` units (the
  paired form built from gig setlist segue metadata). Two adjacent
  `single` units that the band plays as a transition don't get the
  signal because the data model doesn't link them. Drew can
  manually convert adjacent singles to a linked pair via the planner
  but there's no inline prompt suggesting "these two are adjacent —
  link them?"
  - **Why deferred:** Suggesting linkage from adjacency is its own
    UX problem (false positives if the band always opens with two
    songs that aren't transitions). Skip until tester signal.
  - **Trigger:** First tester reports a transition that's actually
    important but doesn't show inline because the units aren't
    linked.
  - **Discovered:** 2026-05-15 (Living Set Sheet)
  - **Status:** open

- **Finding:** Living Set Sheet signals add zero cost when no signal
  fires (most rows), but every row pays a synchronous lookup against
  the `_rhUnitSignals` map. For a 30-unit plan that's 30 hash
  lookups + 30 conditional render branches per render pass.
  Imperceptible at MVP scale; flagged for the modularization pass
  if plan size ever crosses 100+ units.
  - **Why deferred:** No active perf issue today.
  - **Trigger:** First plan with 100+ units.
  - **Discovered:** 2026-05-15 (Living Set Sheet)
  - **Status:** open

- **Finding:** Progression-memory signal fatigue risk — "Still rough
  after N rehearsals" warning persists as long as an open annotation
  exists on the song. If the band addresses the issue in real
  rehearsal but doesn't mark the annotation as `fixed`, the signal
  keeps shouting the count (3, 4, 5 rehearsals…). The system has no
  auto-resolve heuristic; band hygiene (closing the note when done)
  is required.
  - **Why deferred:** Auto-resolving an annotation based on a "tight
    last rehearsal" positive signal would be guessing about the
    band's actual judgment. Phase 3-style restraint says: don't
    auto-act on inference. Worth observing whether annotation hygiene
    is high or low among real testers.
  - **Trigger:** First tester reports "this annotation is fixed but
    GrooveLinx still flags the song as rough," OR observed
    annotation-resolve rate is low after first month.
  - **Discovered:** 2026-05-15 (Rehearsal Progression Memory Pass)
  - **Status:** open

- **Finding:** Recurring-warning desensitization — once a song is in
  the "Still rough after 3 rehearsals" state, the band might start
  ignoring the row's warning entirely (banner blindness). The pass
  uses a sharper amber (`#f97316`) than the soft warning amber
  (`#fbbf24`) for persistent issues to distinguish them visually,
  but color alone doesn't fix attention fatigue.
  - **Why deferred:** Real signal of fatigue requires observation in
    actual band use. If the user reports it, the response is likely
    a "snooze this signal for one rehearsal" affordance — out of
    scope for this pass.
  - **Trigger:** Tester explicitly mentions ignoring the persistent
    warning, OR usage data shows zero clicks on the [Open notes]
    inline action despite ≥3 persistent signals.
  - **Discovered:** 2026-05-15 (Rehearsal Progression Memory Pass)
  - **Status:** open

- **Finding:** Positive-signal effectiveness is unmeasured — "🔥
  Strongest take from last rehearsal", "✓ Tightened significantly
  since last week", "✓ Tight last rehearsal" are emotionally
  intended but may not actually shift band behavior or feeling. The
  signals only show when no warning matches, so they're rare by
  design. Whether rare-but-positive lands better than frequent-but-
  warning is an open psychological question.
  - **Why deferred:** Mood/effect of UI copy is a tester-observation
    question, not a code question.
  - **Trigger:** First tester quotes a positive signal back ("hey
    the system noticed we tightened Sugaree" — validation), OR
    tester reports the warnings feel disproportionate to praise.
  - **Discovered:** 2026-05-15 (Rehearsal Progression Memory Pass)
  - **Status:** open

- **Finding:** "Tightened significantly since last week" copy is
  loose — the comparison is actually "latest session vs
  second-to-latest session," not a calendar week. If a band rehearses
  twice a week, "last week" reads as a stale week-old comparison
  even though the data is one rehearsal back. If they rehearse every
  three weeks, "last week" reads forward (the data is older than
  last week). Copy ergonomics > strict accuracy at MVP, but worth
  rephrasing once a real cadence is observed.
  - **Why deferred:** Phrasing tunable once tester signal indicates
    whether the copy reads naturally or weirdly. Possible alternative:
    "Tightened significantly since last rehearsal."
  - **Trigger:** First tester says "we didn't rehearse last week" or
    similar comment.
  - **Discovered:** 2026-05-15 (Rehearsal Progression Memory Pass)
  - **Status:** open

- **Finding:** Strongest-take winner depends on which song has the
  highest analyzer confidence on the latest session — a single
  metric. A song with one very-high-confidence segment (e.g. a
  60-second solo passage) can outscore a song with many medium-
  confidence segments (a full song run-through). The signal isn't
  invariant to take length or count, just to mean confidence per
  song in that session.
  - **Why deferred:** A confidence-weighted-by-duration or
    quality-tag-weighted winner would be more "musically true," but
    requires deeper analyzer surgery + an "is this a song run or a
    section drill?" classification that Phase 2 didn't ship.
  - **Trigger:** Drew or tester reports the "strongest take" signal
    landing on the wrong song.
  - **Discovered:** 2026-05-15 (Rehearsal Progression Memory Pass)
  - **Status:** open

- **Finding:** Historical-memory edge case — songs that haven't been
  played in the last 5 sessions appear without any history signal
  (no `_rhSongHistory` entry). This is correct behavior, but the
  spec mentioned "'not played recently'" as a candidate signal kind.
  Implementing it requires comparing the unit's title against the
  union of recent `songsWorked` arrays — light work, but the signal
  itself risks fatigue if half the catalog earns it during a long
  cycle of focused rehearsals.
  - **Why deferred:** Restraint by design — adding another signal
    type before the existing four are observed in real use violates
    the "use restraint, only show highest-value signal" rule.
  - **Trigger:** Real tester says "we have a backlog of songs we
    haven't touched and I can't tell from the flow rail which ones."
  - **Discovered:** 2026-05-15 (Rehearsal Progression Memory Pass)
  - **Status:** open

- **Finding:** Mark-resolved is single-tap with no confirm — instantly
  flips the OLDEST open annotation on the unit's song to
  `status='fixed'` via `GLAnnotations.updateAnnotation`. Spec said
  "Simple. Fast. Human." but the absence of a confirm means an
  accidental tap on mobile (or a misread) silently closes the wrong
  note. There's no undo affordance in the toast either.
  - **Why deferred:** A confirm dialog would re-introduce the "task
    management" feel the spec explicitly forbids. The right safety
    net is an undo (5-second toast with [Undo]) — out of scope for
    this pass.
  - **Trigger:** First tester reports a wrong note closed
    accidentally, OR observed mis-tap rate is non-zero in early use.
  - **Discovered:** 2026-05-15 (Lightweight Rehearsal Closure Pass)
  - **Status:** open

- **Finding:** Mark-resolved closes the OLDEST open annotation only.
  When a song has multiple open notes (e.g., separate observations
  about intro timing AND ending drift), tapping [Mark resolved]
  picks the one created first — which may not be the one the band
  just judged fixed. The persistent signal will still fire after
  closing the wrong one, signalling "still rough after N rehearsals"
  even though one issue was closed.
  - **Why deferred:** Letting the user pick WHICH note to close from
    a list reintroduces "open notes" workflow complexity. Today's
    [Open notes] action already opens Song Detail where granular
    closing is available — keeping Mark Resolved as a one-tap
    coarse affordance feels correct.
  - **Trigger:** First multi-note-per-song scenario reported where
    Mark Resolved closes the wrong note, OR a "Mark all resolved"
    affordance becomes desired.
  - **Discovered:** 2026-05-15 (Lightweight Rehearsal Closure Pass)
  - **Status:** open

- **Finding:** Tonight's Progress card has no playback affordances —
  the spec mentioned "quick replay of strongest take" + "quick replay
  of unresolved section" as a "Where lightweight and useful" feature.
  Today the best-take line is text-only (just the song title). Users
  who want to actually listen scroll down to the Take Review card
  below and tap the ▶ button there. Two-tap, but reasonable.
  - **Why deferred:** Adding a ▶ Listen button to the Best Take row
    means computing which Take row corresponds to the song's peak
    segment then synthesizing a play call — non-trivial coordination
    between the closure card and Take Review's audio element. The
    Take Review surface below already provides this; pointing users
    there with copy ("see Take Review below") is the lighter path.
  - **Trigger:** First tester says "I want to listen to the best take
    without scrolling," OR Take Review is consolidated into Tonight's
    Progress.
  - **Discovered:** 2026-05-15 (Lightweight Rehearsal Closure Pass)
  - **Status:** open

- **Finding:** Tonight's Progress "Newly resolved" section only counts
  annotations whose `updated_at` falls between the prior-session date
  (23:59:59) and this session date (23:59:59). If a band resolves a
  note in the wrong rehearsal window (e.g., types up "fixed" in
  GroovLinx between rehearsals while still listening to the recording),
  the resolve gets attributed to whichever session-date window
  encompasses its `updated_at`. Bounded acceptably for MVP — sessions
  almost always run nightly and resolves stay close to the relevant
  rehearsal — but could drift in odd cadences.
  - **Why deferred:** Tighter attribution (e.g., "resolves within 24h
    after rehearsal end") needs session start/end times that aren't
    always reliable. The day-bucket heuristic is the simplest
    correct-most-of-the-time approach.
  - **Trigger:** Real-use observation of resolve-attribution drift.
  - **Discovered:** 2026-05-15 (Lightweight Rehearsal Closure Pass)
  - **Status:** open

- **Finding:** Carry-forward UX is implicit, not explicit — there's
  no [Bring this back next rehearsal] button. Songs with open
  annotations automatically carry into the next session's
  progression signals via the existing `_rhBuildAnnotationAge` path.
  The spec listed explicit carry-forward as a "Required improvement,"
  but adding a button would either (a) duplicate "Still needs work"
  (no real signal added), or (b) create a tag system that's the
  task-management creep the spec explicitly forbids. Reading
  implicit-carry-forward as compliant with spec intent.
  - **Why deferred:** Explicit carry-forward would need a per-song
    "needs another pass" flag, which is a tag/task primitive. Spec
    intent (continuity) is met without it.
  - **Trigger:** First tester reports "I want to mark a song as
    'definitely bring this back' without leaving a comment."
  - **Discovered:** 2026-05-15 (Lightweight Rehearsal Closure Pass)
  - **Status:** open

- **Finding:** Tonight's Progress positive-signal scarcity may need
  tuning — the card only shows ✓ Tightened songs that gained ≥0.15
  in confidence between consecutive sessions. On a stable rehearsal
  where nothing changed much (band is already locked in), the
  Tightened section will be empty + the Best Take + Newly Resolved
  sections might also be empty → entire card hidden. The closure
  experience disappears precisely when the band is at peak quality,
  which is the inverse of desirable.
  - **Why deferred:** A "we're locked in tonight" positive signal
    when nothing improved-or-degraded is its own UX problem — risks
    feeling patronizing or generic. Better to observe whether real
    bands hit this empty-card state and report it.
  - **Trigger:** Drew or tester reports running a tight rehearsal
    where the Tonight's Progress card was empty/hidden, OR a "Steady
    tonight — nothing regressed" signal becomes worth designing.
  - **Discovered:** 2026-05-15 (Lightweight Rehearsal Closure Pass)
  - **Status:** open

- **Finding:** Multiple Mixdown rows can match a single rehearsal
  session by date. `_findMixdownForSession` returns the **first**
  match it iterates, with no ordering guarantee from Firebase. For a
  band that uploads multiple mixdowns for the same date (e.g. dry
  mix + wet mix), the auto-created Recording will pick whichever
  Firebase enumerated first — which may not be the band's preferred
  reference take.
  - **Why deferred:** Picking the right one needs ordering signal
    (uploaded_at? user-tagged-as-canonical?). Phase 3C deliberately
    avoided "Mixdowns architecture rewrite" — one-mixdown-per-date
    is the simple-and-correct heuristic until tester signal indicates
    otherwise.
  - **Trigger:** First tester reports a session resolving to the
    wrong mixdown, OR Drew uploads two mixdowns for the same date
    intentionally.
  - **Discovered:** 2026-05-15 (Phase 3C — Recording Identity)
  - **Status:** open

- **Finding:** Auto-create writes are not idempotent across concurrent
  resolves. If two surfaces (e.g. Take Review + a future Tonight's
  Progress playback hook) both call `resolvePlaybackSource` on the
  same un-stamped session at the same render tick, both can race to
  create separate Recording rows before either's `recording_id`
  writeback completes. The session ends up stamped with one id, but
  the orphan record persists in `bands/{slug}/recordings`.
  - **Why deferred:** Adding a per-session resolve mutex needs an
    in-memory lock that survives Promise reentry — non-trivial
    plumbing for an edge case. The orphan records are harmless (no
    Take or playback consumer reads them), and the per-session
    `_resolveCache` already short-circuits the second resolve within
    a single render pass.
  - **Trigger:** Calibration mode shows duplicate canonical-recording
    counts on the same session, OR Recording cache reaches a size
    larger than expected.
  - **Discovered:** 2026-05-15 (Phase 3C build)
  - **Status:** open

- **Finding:** Auto-create writes happen on every first resolve of
  an un-stamped session — even for read-only browsing of past
  rehearsals. A user clicking through 30 historical sessions in one
  browse triggers 30 Recording creates + 30 session updates,
  effectively normalizing the back-catalog as a side effect of
  navigation. Functionally fine and probably desirable, but the
  write cost is real and not gated by user intent.
  - **Why deferred:** A bulk migration script would be cleaner but
    requires a separate admin tool. The lazy-on-resolve approach is
    incremental and self-healing, which matches the spec's "additive
    normalization" rule.
  - **Trigger:** Firebase write quota concerns, OR observed slowness
    on first-view of historical rehearsals.
  - **Discovered:** 2026-05-15 (Phase 3C build)
  - **Status:** open

- **Finding:** Phase 3C migrated only the Phase 3A Take Review
  surface to use `resolvePlaybackSource`. Other playback consumers
  remain on legacy paths: `_rhToggleMixdownPlayer` reads `mx.audio_url`
  / `mx.drive_url` directly; `recording-analyzer.js` uses its own
  `<audio id="raPlaybackAudio">` element with per-session URL; the
  in-flight analyzer audio buffer is shared session-wide. The
  central resolver is the recommended path going forward, but the
  migration is incremental.
  - **Why deferred:** Migrating every playback consumer in one pass
    risks breaking the analyzer's per-session audio handling. Take
    Review is the highest-leverage consumer (emotional-continuity
    claims like "Best take from last rehearsal" depend on it
    resolving reliably) and goes first; the rest follow as their
    surfaces evolve.
  - **Trigger:** Next playback work on Mixdowns / analyzer review,
    OR a confirmed playback inconsistency between surfaces.
  - **Discovered:** 2026-05-15 (Phase 3C build)
  - **Status:** open

- **Finding:** Take primitives still write `playback_ref.recording_id:
  null` (per the Phase 2 deferred entry). Phase 3C didn't backfill
  existing takes with `recording_id` from their session's resolved
  Recording. Take playback in Phase 3A still works because it routes
  through the session-level resolver, but the take's own playback_ref
  remains incomplete — a future "play this take from anywhere" surface
  (cross-rehearsal Song Detail history) would need either a backfill
  pass or an inline resolver call per take.
  - **Why deferred:** Backfilling thousands of takes mid-render is
    expensive; doing it lazily-on-resolve-of-take is acceptable but
    needs the take playback path to thread through GLRecordings —
    which Phase 3A's `_rhTakePlay` doesn't yet do (it still reads
    take.playback_ref directly via the session-shared audio element).
  - **Trigger:** Phase 4+ cross-rehearsal Song Detail playback work,
    OR observed take-playback failures when the session-level audio
    element doesn't have a src.
  - **Discovered:** 2026-05-15 (Phase 3C build)
  - **Status:** open

- **Finding:** Recording records auto-created from blob-only sessions
  do NOT happen — Path 4 (blob fallback) returns the URL with
  `isBlob: true` but skips `_ensureRecordingForSession`. So a band
  that records straight into a session blob without uploading to
  Drive/Mixdowns ever gets a canonical Recording for that session.
  Once they leave the page, the blob URL is gone and there's no
  Recording to resolve to. The session is permanently un-resolvable.
  - **Why deferred:** Auto-creating a Recording for a session-scoped
    blob URL that's about to die would persist a dead reference.
    The right fix is upload-time normalization (every session blob
    gets persisted to Drive/Storage when the user explicitly saves)
    — out of scope for Phase 3C identity stabilization.
  - **Trigger:** First case of a session that has audio_segments but
    no canonical Recording can be resolved, OR upload-flow
    consolidation.
  - **Discovered:** 2026-05-15 (Phase 3C build)
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

- **Finding:** `normalizeRehearsalSegments` auto-resolves recording_id
  by loading the session via Firebase when `opts.recording_id` is
  missing. That's one extra `bands/{slug}/rehearsal_sessions/{id}`
  read per analyze run.
  - **Why deferred:** The per-session resolver cache short-circuits
    redundant resolves within a render pass, and the analyzer is
    already an expensive op — one extra read is negligible against the
    audio-decode + matching cost. The proper optimization is to teach
    `recording-analyzer.js` to pre-stamp `opts.recording_id` itself
    before calling `normalizeRehearsalSegments`, eliminating the hop.
  - **Trigger:** Profiling shows analyze p95 dominated by the session
    read, OR a future analyzer refactor unifies the session-load path.
  - **Discovered:** 2026-05-15 (Phase 3D)
  - **Status:** open

- **Finding:** The 🎯 Benchmark `rid mismatch` counter is
  observation-only. When a Take's `recording_id` diverges from the
  session-level resolver result, the calibration banner flags the
  count in red but no auto-repair fires.
  - **Why deferred:** Phase 3D spec explicitly forbade auto-healing.
    Real-world this only happens after re-analysis against a swapped
    recording, which is rare and should be a human decision. Until
    5/11 validation surfaces this in the wild, no fix can be designed
    without speculation.
  - **Trigger:** First observed mismatch on the 5/11 benchmark or
    later sessions, OR a re-analysis flow ships that intentionally
    rewrites recording_id.
  - **Discovered:** 2026-05-15 (Phase 3D)
  - **Status:** open

- **Finding:** `_rhToggleMixdownPlayer` calls
  `GLRecordings.resolvePlaybackSource(..., { autoCreate: false })` —
  the Mixdown player surface won't materialize a Recording row even
  for a Drive-backed mixdown that doesn't yet have one.
  - **Why deferred:** Intentional. The analyzer pipeline is the
    canonical write path for Recording rows; surfacing auto-create on
    a play-only UI would create duplicate Recordings every time the
    user clicks Play on an unanalyzed mixdown. Better to let the
    analyzer (which already runs at upload time) own the canonical write.
  - **Trigger:** If we ever ship a surface that uploads mixdowns
    without an analyze step, OR the analyzer stops being the only
    Recording-write path.
  - **Discovered:** 2026-05-15 (Phase 3D)
  - **Status:** open

- **Finding:** `_rhTakePlay` lazy-binds `audio.src` from
  `take.playback_ref.recording_id` via `GLRecordings.getRecording`,
  but that path bypasses the Phase 3C session-level resolver cache
  (`_resolveCache`). Two takes from the same recording on the same
  page render trigger two separate `getRecording` calls.
  - **Why deferred:** `getRecording` itself uses the GLRecordings
    60s in-memory cache, so the second call is a no-op against
    Firebase. The redundancy is at the cache-key-shape level, not
    a network level. Mitigation cost > benefit until a profile
    shows it.
  - **Trigger:** Profiling shows take-row play latency dominated by
    cache misses, OR a refactor of GLRecordings unifies the two cache
    layers.
  - **Discovered:** 2026-05-15 (Phase 3D)
  - **Status:** open

- **Finding:** The 🎯 Benchmark cheat-sheet line is calibration-mode
  only — band members never see the convergence health line. If
  recording_id coverage silently drops below 60% in production, no
  band-facing surface warns about it.
  - **Why deferred:** Intentional per Drew's spec ("don't bleed
    analyzer complexity into band-member UX"). The benchmark line is
    a founder/admin diagnostic, not a user-facing health bar. The
    band-facing equivalent (if needed) would be a soft "playback may
    be unreliable" hint, not a percentage.
  - **Trigger:** First observed in-production coverage degradation
    that wasn't caught by Drew's calibration-mode validation pass.
  - **Discovered:** 2026-05-15 (Phase 3D)
  - **Status:** open

- **Finding:** `recording-analyzer.js` doesn't pre-stamp
  `opts.recording_id` when calling `normalizeRehearsalSegments` — it
  relies on the gl-takes auto-resolve hop to do it. The indirect
  path works correctly but means a future refactor that touches the
  analyzer's call shape must remember the indirect dependency.
  - **Why deferred:** Phase 3D spec forbade touching recording-analyzer
    architecture. The auto-resolve in gl-takes is the cleaner
    separation of concerns anyway — the analyzer shouldn't need to
    know about Recording canonicalization. Direct stamping would be a
    performance optimization, not an architecture improvement.
  - **Trigger:** Performance profiling, OR a future analyzer refactor
    that already needs to load the session for other reasons.
  - **Discovered:** 2026-05-15 (Phase 3D)
  - **Status:** open

- **Finding:** Benchmark snapshot diff only compares against the most
  recent prior snapshot. No multi-point trend, no historical heatmap,
  no rolling-window average. If Drew snapshots after every analyzer
  tweak, he sees "did THIS one improve" but not "is the trend going
  in the right direction over the last 5 attempts."
  - **Why deferred:** Phase 3E spec explicitly forbade trend charts /
    analytics dashboards / time-series. Single-prior diff answers the
    immediate question. Multi-point trend is a deliberate next-phase
    decision after Drew accumulates ≥3 snapshots and finds the single
    comparison insufficient.
  - **Trigger:** Drew accumulates 3+ snapshots on 5/11 AND reports
    the single-prior diff doesn't tell him enough.
  - **Discovered:** 2026-05-15 (Phase 3E)
  - **Status:** open

- **Finding:** Per-take benchmark classification has no severity
  picker in the UI — `addObservation` accepts `'info' | 'warning' |
  'critical'` but the dropdown only writes `severity: 'info'`. All
  classifications render the same color in the observation list.
  - **Why deferred:** Adding a severity dropdown doubles the form
    surface area for marginal benefit; the classification kind already
    carries enough information (`continuity_failure` is intrinsically
    more severe than `talking_split`). Severity is reserved for the
    rare case where two takes share a classification but one is a
    near-miss and one is catastrophic.
  - **Trigger:** First time Drew wants to flag a take as "critical"
    inside an existing classification kind.
  - **Discovered:** 2026-05-15 (Phase 3E)
  - **Status:** open

- **Finding:** Benchmark observations have no edit affordance — only
  add + remove. To fix a typo in a note, the analyst must delete the
  observation and re-add it (losing the original `created_at`).
  - **Why deferred:** Edit-in-place adds form-state machinery
    (loading existing value into the input, distinguishing
    update-vs-create write paths, optimistic UI rollback on error)
    for a use case (typo correction) that's cheaper to handle by
    delete + re-add. Trade-off chosen for code economy.
  - **Trigger:** First observed Drew frustration at re-typing a long
    note after a typo correction.
  - **Discovered:** 2026-05-15 (Phase 3E)
  - **Status:** open

- **Finding:** Snapshot diff is computed live (current calibration
  banner metrics) vs stored (prior snapshot's metrics). If calibration
  mode wasn't on when the prior snapshot fired, OR if a snapshot was
  captured under different observation-count conditions, the diff may
  be apples-to-oranges. There's no warning when this happens.
  - **Why deferred:** Snapshots always include `build` + `created_at`,
    so the analyst can audit conditions by reading the snapshot
    history. Adding a "diff conditions changed" warning surfaces a
    rare edge case loudly; we'd rather Drew notice it manually first.
  - **Trigger:** First reported false-positive improvement signal
    traced back to changed conditions between the two compared
    snapshots.
  - **Discovered:** 2026-05-15 (Phase 3E)
  - **Status:** open

- **Finding:** Benchmark classifications are per-take only — there's
  no first-class slot for session-level observations like "the whole
  rehearsal had pervasive over-splitting" or "calibration revealed
  the analyzer can't handle this band's jam style." Such observations
  end up as a note on an arbitrary take.
  - **Why deferred:** `addObservation` already accepts a null
    `take_id` (session-level), but the calibration UI doesn't expose
    a session-level form. Adding one means another UI surface in the
    calibration banner, which the spec said keep compact. The store
    is forward-compatible — adding a session-level form later is
    additive.
  - **Trigger:** Drew accumulates enough cross-cutting observations
    that pinning them to arbitrary takes feels wrong.
  - **Discovered:** 2026-05-15 (Phase 3E)
  - **Status:** open

- **Finding:** The 🎯 Benchmark calibration line is rehearsal-only —
  no cross-band roll-up of benchmark health. With multiple bands on
  GrooveLinx, founders may want "show me which bands have <80%
  recording_id coverage" or "which bands have the most classified
  failures" without opening every rehearsal individually.
  - **Why deferred:** Cross-band roll-up requires a separate index
    or aggregation pass. Phase 3E was explicit about avoiding
    dashboards. Single-band, single-rehearsal view is the right
    diagnostic primitive; cross-band aggregation is a separate
    decision later.
  - **Trigger:** GrooveLinx has 3+ bands actively analyzing AND a
    founder needs to triage which band's analyzer needs attention.
  - **Discovered:** 2026-05-15 (Phase 3E)
  - **Status:** open

- **Finding:** H3 restart_loop and H4 weak_boundary_suppression are
  observation-only by default — they appear in the calibration kind
  breakdown but don't apply to the segment array. The applier respects
  `opts.continuity_aggressive` to opt them in, but no UI toggle wires
  it. Drew has no way to A/B aggressive vs conservative without
  editing code.
  - **Why deferred:** Phase 3F spec was explicit about observation-first.
    A UI toggle would invite premature application before Drew has
    validated H1 + H2 don't over-merge on 5/11. Adding it later is
    additive — a single localStorage flag + `opts.continuity_aggressive`
    pass-through into `normalizeRehearsalSegments`.
  - **Trigger:** H1 + H2 alone visibly improve 5/11 segmentation AND
    H3 / H4 suggestions look safe in the kind breakdown.
  - **Discovered:** 2026-05-15 (Phase 3F)
  - **Status:** open

- **Finding:** H5 confidence_downgrade is suggestion-only — the
  applier never rewrites `take.matching.confidence` even when the
  heuristic flags brittle 'high' confidence under continuity
  ambiguity. The suggestion shows up in the kind breakdown count
  but has no UI surface to act on.
  - **Why deferred:** Auto-downgrade silently changes the
    confidence the band sees. That's a UX call, not a heuristic call —
    needs a deliberate decision about whether "high → medium" feels
    helpful or distressing. Until Drew sees the H5 count climb on
    real sessions, no point pre-deciding.
  - **Trigger:** H5 count consistently >0 on 5/11 AND Drew confirms
    those takes ARE in fact brittle.
  - **Discovered:** 2026-05-15 (Phase 3F)
  - **Status:** open

- **Finding:** Continuity pre-pass results only stash for the most
  recently normalized session — `window._glContinuityLatest[sessionId]`
  is populated on normalize but never persisted. Reopening an old
  session report shows "🔗 Continuity pre-pass not run yet" instead of
  the historical counts.
  - **Why deferred:** Persisting per-session continuity counts would
    require a Firebase write inside the analyze path (extra latency)
    or a new collection (more schema). The Phase 3E benchmark
    snapshots capture continuity counts at capture time — that IS
    the durable record. The "not run yet" copy in calibration mode
    is informational, not a regression.
  - **Trigger:** Drew accumulates enough sessions that browsing
    history without snapshots becomes a regular workflow.
  - **Discovered:** 2026-05-15 (Phase 3F)
  - **Status:** open

- **Finding:** When the continuity applier merges two segments, the
  anchor take inherits the FIRST segment's `matching.confidence` —
  the merged take's confidence is not recomputed from the union of
  evidence. A high-confidence + medium-confidence merge keeps the
  anchor's confidence (high) even though the merge implies more
  evidence than the anchor alone had.
  - **Why deferred:** Re-running matching against the merged audio
    span requires the audio buffer + matching engine — re-entry into
    the analyzer surface that Phase 3F was explicit about NOT
    touching. The simpler fix (take the max confidence of constituents)
    would be misleading in the rare opposite case (high anchor merged
    with low neighbor — the low might have been correct).
  - **Trigger:** Real 5/11 data shows merged takes mis-confident in
    either direction.
  - **Discovered:** 2026-05-15 (Phase 3F)
  - **Status:** open

- **Finding:** CONFIG thresholds in gl-continuity.js are hardcoded —
  same_song_max_gap_sec=30, short_gap_max_sec=10, restart_max_gap_sec=90,
  etc. No per-band or per-genre tuning. A blues band with tight
  silence between songs needs a tighter gap window than a jam band
  that holds long ambient transitions.
  - **Why deferred:** Tuning thresholds requires real cross-band
    data. The single-band Drew/Deadcetera dataset (5/11) is the
    starting point; per-band overrides are premature optimization.
  - **Trigger:** Second tester band onboards AND their 5/11-style
    benchmark shows the defaults miscalibrate.
  - **Discovered:** 2026-05-15 (Phase 3F)
  - **Status:** open

- **Finding:** No UI surface to inspect WHICH specific takes were
  merged within a session. The calibration banner shows kind counts
  (e.g. "adjacent_same_song: 3") but the analyst has to inspect the
  Phase 2 `_continuity_merged_from` stamp on each take to see the
  per-merge story. No "show me the 3 merges that happened" affordance.
  - **Why deferred:** Per-merge inspection adds a third UI surface
    inside calibration mode (alongside kind breakdown + suggestions
    sublist). Wait until Drew actually wants this — kind counts may
    be sufficient signal.
  - **Trigger:** Drew opens a take's diagnostics drawer to read
    `_continuity_merged_from` more than once.
  - **Discovered:** 2026-05-15 (Phase 3F)
  - **Resolved:** 2026-05-16 (Phase 3G) — Take Review 🔬 Diagnostics
    drawer now shows the 🔗 Merge lineage block with per-suggestion
    kind / reason / gap, sourced from `take.continuity.applied`.
  - **Status:** resolved

- **Finding:** `good_merge` decisions stamp benchmark truth (analyst
  affirmed the merge) but don't feed back into future analyzer
  weighting — a heuristic kind that gets 50 good_merge confirmations
  on a band still runs with the same default safety tier on the next
  analyze. No reinforcement learning loop.
  - **Why deferred:** Phase 3G spec explicitly forbade automatic
    learning loops. good_merge as durable truth IS the prerequisite
    for that future loop; capturing the data is the prerequisite
    decision. Whether to ever close that loop is a separate
    deliberate decision.
  - **Trigger:** Drew accumulates 50+ good_merge decisions on a
    single band AND notices a recurring failure mode that automatic
    reinforcement could solve.
  - **Discovered:** 2026-05-16 (Phase 3G)
  - **Status:** open

- **Finding:** `keep_separate` and `ignore_kind` decisions persist
  forever unless manually reversed via the [×] button. No expiry,
  no "review old decisions" prompt. A decision made in haste during
  early calibration may silently shape analyzer behavior months
  later after the underlying audio / catalog / band has changed.
  - **Why deferred:** Decision expiry adds time-of-relevance
    machinery (when does a decision "go stale"? per-band? per-rehearsal?
    per-N-analyzes?) that's premature optimization until Drew
    accumulates enough decisions to notice staleness. Reversibility
    via [×] is the primary mitigation; the calibration banner already
    shows the decision count, so old decisions are visible.
  - **Trigger:** First time a stale `keep_separate` decision is
    traced to a wrong analyzer behavior on a re-analyzed session.
  - **Discovered:** 2026-05-16 (Phase 3G)
  - **Status:** open

- **Finding:** `ignore_kind` is rehearsal-scoped only — there's no
  per-band global preference like "this band's restart_loop pattern
  always means real separate attempts, never apply that heuristic."
  Drew would have to mark ignore_kind on every rehearsal individually.
  - **Why deferred:** Per-band preferences add a settings layer
    that's premature until Drew has data on whether a kind is
    systematically wrong for a band vs case-by-case wrong on a
    rehearsal. Rehearsal-scoped is the natural unit of analysis;
    global-scoped is the natural unit of preference.
  - **Trigger:** Drew marks `ignore_kind` on 3+ consecutive
    rehearsals for the same band with the same kind.
  - **Discovered:** 2026-05-16 (Phase 3G)
  - **Status:** open

- **Finding:** The authority decision load fires twice per render —
  once for the calibration banner badge (👤 N decisions count via
  summarizeDecisionsForSession), once per Take Review diagnostics
  drawer open (via _rhContAuthorityLoad). Both go through the same
  60s in-memory cache, so the second is a no-op, but it's two
  redundant cache lookups per render.
  - **Why deferred:** Both calls already hit the cached path after
    the first load. The redundancy is at the call-shape level, not
    network. Refactoring to a shared lookup would couple the
    diagnostics drawer to the banner hydrator. Wait for profile
    evidence before doing surgery.
  - **Trigger:** Profile data shows render latency dominated by
    GLContinuityAuthority cache lookups.
  - **Discovered:** 2026-05-16 (Phase 3G)
  - **Status:** open

- **Finding:** `take.continuity` is the Phase 3G snapshot of merge
  provenance at Take-creation time, capturing pair_key based on the
  segment ids THAT analyze produced. A re-analyze regenerates seg
  ids (analyzer doesn't preserve `seg_N` numbering across runs), so
  prior `keep_separate` decisions tied to old pair_keys don't
  automatically migrate to the new pair_keys even when the
  semantically-same merge fires again.
  - **Why deferred:** True identity migration would require either
    stable seg ids across analyze runs (analyzer-engine surgery) or
    semantic-pair matching (heavy heuristic). Both out of Phase 3G
    scope. The current behavior is "decisions silently lose
    binding on re-analyze" — surfaces if Drew makes decisions then
    re-analyzes and sees the same suggestions re-fire.
  - **Trigger:** Drew makes 5+ decisions on a session, re-analyzes,
    and observes that the prior decisions don't filter the new
    suggestions.
  - **Discovered:** 2026-05-16 (Phase 3G)
  - **Status:** open

- **Finding:** No top-level "review all merges this session"
  workspace. Inspection requires expanding 🔬 Diagnostics on each
  merged take individually. On a session with 20+ merges, this is
  click-heavy.
  - **Why deferred:** A consolidated merge-review surface would be
    a fourth UI element in calibration mode (banner + classified +
    decisions + merges) and risks tipping into "giant continuity
    dashboard" territory the spec was explicit about avoiding. The
    per-take drawer pattern keeps the surface compact; if Drew
    finds click-throughput painful on long sessions, a flat list
    becomes justified.
  - **Trigger:** Drew analyzes a 30+ take session AND reports
    drawer-per-take clicking is friction.
  - **Discovered:** 2026-05-16 (Phase 3G)
  - **Status:** open

- **Finding:** Evidence rows are sorted per-take but the calibration
  banner has no session-level filter like "show me all takes whose
  dominant signal was planMatch" or "show me takes with signals_disagree
  flagged." Drew has to scan every Take's drawer to find pattern outliers.
  - **Why deferred:** Filter-by-signal adds a search/filter UI to the
    Take Review surface — non-trivial scope that risks tipping into
    analytics dashboard. The dominant_signal histogram on the banner
    already exposes the macro pattern; per-take outliers can be found
    by clicking into the suspicious-looking Takes manually.
  - **Trigger:** Drew accumulates enough sessions that scanning every
    drawer becomes friction.
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** `confidence_breakdown.reasons` is heuristic-derived
  English ("best score 0.72 ≥ 0.65", "forced LOW — only plan prior
  active"). Not localizable; if GrooveLinx ever serves non-English
  band-facing UI, the reasons would leak through any future surface
  that exposed them.
  - **Why deferred:** Evidence surface is calibration-only — the
    target audience is Drew (English-speaking founder). Localization
    is premature until band-facing exposure happens. The structured
    breakdown fields (best_score, gap, active_signal_count, etc.)
    ARE language-neutral; reasons[] is the only text fragment.
  - **Trigger:** A band-facing surface ever wants to render
    confidence reasons OR a non-English-speaking founder onboards.
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** The matcher's WEIGHTS table (planMatch: 0.15,
  audioSimilar: 0.30, chordSimilar: 0.20, tempoProx: 0.15,
  lyricsMatch: 0.05, continuity: 0.05) is hardcoded in
  song_matching_engine.js. Drew can see contributions per Take but
  can't see "this build uses weight 0.20 for chord" without reading
  the source. Tuning requires code-edit + redeploy.
  - **Why deferred:** Live weight tuning UI is the start of a
    "matcher control panel" the spec was explicit about avoiding.
    Hardcoded weights are also the safety property — they can't
    drift accidentally. Exposing them read-only in calibration mode
    is a small additive change worth considering later.
  - **Trigger:** Drew wants to compare snapshot diffs between two
    weight configurations OR a tester band needs different weights.
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** `_missingReason` is hardcoded English keyed by
  signal name. Adding a new signal (e.g. future `lyricAnchor` per
  the lyric audit) requires touching this helper AND the WEIGHTS
  table AND the active-signal availability check — three places
  for one schema change.
  - **Why deferred:** The current six-signal taxonomy is stable.
    Refactoring to a single signal-descriptor table is a deliberate
    cleanup, but only worth it once a 7th signal lands.
  - **Trigger:** Adding `lyricAnchor` or any new signal to WEIGHTS.
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** The Evidence block's contribution bar maps
  `contribution × 200 → percent width`, so 0.5 contribution = full
  bar. A higher contribution would visually cap at full while the
  number still reads correctly. Picks a "good enough" visual ceiling
  rather than a true 0-100% scale.
  - **Why deferred:** Real contributions on the current weight
    layout rarely exceed 0.30 even for strong signals
    (max single-signal contribution = weight × value = 0.30 × 1.0 =
    0.30 for audioSimilar at full strength). 0.5 ceiling is generous.
    If WEIGHTS ever change to where one signal can dominate >0.5,
    the bar scaling needs revisit.
  - **Trigger:** WEIGHTS rebalance that pushes single-signal
    contribution above 0.5.
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** Re-analyzing a session OVERWRITES the existing Take's
  evidence array with the new analysis's evidence — no diff, no
  history of "this take used to have chord:0.18, now has chord:0.05."
  Benchmark snapshots (Phase 3E) capture session-level metrics but
  NOT per-take evidence.
  - **Why deferred:** Per-take evidence history would explode storage
    (every Take × every analyze = N evidence rows × M analyzes).
    Benchmark snapshots are the right granularity for trend; if Drew
    needs per-take diff, the right primitive is "snapshot the
    evidence for this specific take into a Benchmark observation"
    rather than universal history.
  - **Trigger:** Drew wants to see "did this specific take's
    evidence change between analyze runs."
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** The session-level Evidence-mix histogram on the
  calibration banner counts only `dominant_signal` per Take. A Take
  where chord and plan tied for top contribution is attributed to
  whichever sorted first (planMatch wins ties in the current
  evidence-sort order). The histogram understates ties.
  - **Why deferred:** Tracking co-dominant signals would double-count
    Takes (one Take → 2 histogram entries), inflating the totals.
    The single-attribution model is conventional for "what carried
    this session" reporting. Ties are rare enough at MVP scale that
    the distortion is small.
  - **Trigger:** Drew notices the histogram totals don't match
    `(takes count)` AND the cause traces to under-counted ties.
  - **Discovered:** 2026-05-16 (Phase 3H)
  - **Status:** open

- **Finding:** Phase 3I runtime activation requires `modal deploy
  services/audio-embeddings/modal_app.py` + setting
  `window._glEmbedServiceUrl` in index.html / index-dev.html. Neither
  step can ship by code alone — both require Drew's Modal CLI auth
  and a manual config edit. Until completed, the 0.30 audioSimilar
  signal remains zero in production.
  - **Why deferred:** Deployment requires credentials (Modal auth)
    and GPU quota that only Drew has. Code-side activation is the
    most this phase can ship.
  - **Trigger:** Drew runs `modal deploy` AND adds the URL to the
    index files.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open — blocking 3I full activation

- **Finding:** Bootstrap workflow is scoped per-session (one
  button per rehearsal session). To seed the bank with all corrected
  Takes across the band's history, Drew has to click 🌱 Bootstrap on
  every session report individually.
  - **Why deferred:** Per-session bootstrap is the safest unit —
    audio is already loaded for that session's surfaces, the user
    can verify confirmed Takes before triggering. A "bootstrap all
    sessions" surface would need a different UI placement
    (calibration-mode admin panel?) and risks accidental
    multi-Gigabyte audio fetches.
  - **Trigger:** Drew accumulates ≥10 sessions with confirmed Takes
    AND finds per-session bootstrap tedious.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open

- **Finding:** Embedding vectors are persisted as full 512-float
  arrays in Firebase Realtime DB (~4KB per row). At MAX 10 embeddings
  per song × 100 songs × 5 bands = ~20MB storage. Fine at MVP scale;
  worth re-evaluating if the catalog or band count grows.
  - **Why deferred:** Float arrays in Firebase Realtime are
    serialized as JSON arrays — no compression, no quantization. A
    future optimization could quantize to int8 (75% size reduction)
    OR migrate to Firebase Storage as binary blobs. Both are
    deferred until storage cost / load latency surface as actual
    pain.
  - **Trigger:** Bank size in any band exceeds 50MB total OR
    `preloadEmbeddingBank` p95 exceeds 2s.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open

- **Finding:** Bootstrap workflow decodes the FULL session WAV in
  the browser (`AudioContext.decodeAudioData(fullBuffer)`) before
  slicing per-Take. On a 90-minute rehearsal at 44.1kHz mono, this
  is ~16MB decoded PCM in memory — fine on desktop, but mobile may
  hit AudioContext memory limits. The recording-analyzer.js has a
  large-file on-demand decode path for exactly this reason;
  Bootstrap hasn't adopted it.
  - **Why deferred:** Bootstrap is calibration-mode only and Drew
    runs it on a desktop. Mobile bootstrap isn't a real use case
    yet. Mirroring the analyzer's on-demand decode pattern is
    ~80 LOC of additional complexity that doesn't earn its weight
    until mobile Bootstrap is needed.
  - **Trigger:** A tester ever needs to bootstrap from a mobile
    device, OR a >2hr rehearsal becomes the bootstrap target.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open

- **Finding:** `model_version` migration isn't automated. If we
  swap CLAP for another model, `preloadEmbeddingBank` will skip the
  stale rows (logged as `stale: N` on hydrate), but the actual
  re-embedding requires re-running Bootstrap manually with the new
  model active. No "migrate bank" button.
  - **Why deferred:** Model swaps are rare events (planned, not
    incidental). When one happens, the right operator action is a
    deliberate re-bootstrap pass; automating it before the first
    swap is premature. The stale-skip behavior is the safety net
    (no false-positive matches against old embeddings).
  - **Trigger:** Drew swaps to a newer CLAP variant or moves to a
    different embedding model entirely.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open

- **Finding:** `storeConfirmedEmbedding`'s eviction-then-Firebase-
  remove sequence isn't atomic — if two `storeConfirmedEmbedding`
  calls fire concurrently and both evict the same in-memory row,
  the second's Firebase remove targets an already-deleted document
  (Firebase handles this cleanly as no-op) AND the second's add
  could in-theory overlap. Minor — but flagged.
  - **Why deferred:** Concurrent confirmations happen on the same
    Take row only if two users hit the same button within
    milliseconds. At single-founder scale: not a real race. At
    multi-analyst scale: worth a Firebase transaction or a per-song
    write lock.
  - **Trigger:** Concurrent multi-analyst editing surfaces as a
    real workflow.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open

- **Finding:** Bootstrap only ingests `correction_source === 'human'`
  Takes. The Phase 3E spec for embeddings mentioned ingesting from
  `wrong_match` benchmark observations too (where the analyst noted
  the correct song title in the observation notes), but that path
  isn't shipped — it requires natural-language → songId resolution
  from free-text notes, which is its own decision.
  - **Why deferred:** Free-text → songId resolution is fuzzy.
    Better to wait for a structured `truth_song_id` field on
    benchmark_observations (Phase 3E deferred entry territory) than
    to ship a fragile note-parser.
  - **Trigger:** Phase 3E gains a structured `truth_song_id` field
    on wrong_match observations.
  - **Discovered:** 2026-05-16 (Phase 3I)
  - **Status:** open

- **Finding:** First `modal deploy` after Phase 3I.1 consolidation
  rebuilds the `embed_image` from scratch — Modal hasn't seen it
  before (it's a new image instance inside the existing app, so the
  image cache layer is empty for it). One-time ~5 minute build cost.
  Subsequent deploys reuse the cached layers and complete in seconds.
  - **Why deferred:** This is unavoidable on any first image build;
    pre-baking the image via a Modal CI step would shift the cost,
    not remove it. Acceptable one-time overhead.
  - **Trigger:** None — purely informational so the first deploy
    doesn't look broken.
  - **Discovered:** 2026-05-16 (Phase 3I.1)
  - **Status:** open

- **Finding:** Embedding endpoint now shares the stems app's deploy
  lifecycle — touching either side (stems separator code OR the
  EMBEDDINGS section) re-runs `modal deploy` on the whole app, which
  re-verifies both images and republishes both endpoint URLs. The
  URLs themselves don't change, but the cold-start window for both
  functions resets simultaneously after every deploy.
  - **Why deferred:** Coupling is the price of staying under the
    8-web-endpoint-per-workspace cap (per commit `bcb809f7`,
    2026-05-12). The only fix is splitting into two apps again with
    its own web endpoint, which would push the workspace to 9
    endpoints. Practical impact is one extra warm-up after deploys.
  - **Trigger:** Modal raises the workspace web-endpoint cap OR
    stems vs embed deploy cadences diverge enough that coupled
    redeploys become friction.
  - **Discovered:** 2026-05-16 (Phase 3I.1)
  - **Status:** open

- **Finding:** Consolidated URL pattern includes `stem-separator` in
  the embed endpoint:
  `https://drewmerrill--groovelinx-stem-separator-embed-serve.modal.run`.
  Semantically misleading (the endpoint serves audio embeddings, not
  stems) but operationally fine. Renaming the Modal app would require
  redeploying the stems endpoints too, breaking the existing browser
  config that points at the current stems URL.
  - **Why deferred:** Cosmetic only. Browser code reads
    `window._glEmbedServiceUrl` so the misleading hostname is
    invisible at the call site. Renaming has nonzero cost
    (re-pointing stems consumers too) that doesn't earn its weight.
  - **Trigger:** A future stem-vs-embed identity migration where
    re-pointing both URLs is acceptable.
  - **Discovered:** 2026-05-16 (Phase 3I.1)
  - **Status:** open

- **Finding:** Embed image's transformers pin is narrowed to
  `transformers>=4.36,<4.40` because v4.40+ calls the public
  `torch.utils._pytree.register_pytree_node`, which only exists in
  torch>=2.2. We're pinned to `torch==2.1.2` (matches stems image).
  If the stems image's torch pin is ever bumped to 2.2.x+, the
  embed pin can (and should) be relaxed. The two pins are coupled
  via the pytree API surface; future torch bumps must touch both.
  - **Why deferred:** Constraint is documented inline in
    separator.py's embed_image comment. No reason to bump torch
    today — stems works fine on 2.1.2 and the demucs pin rationale
    (line 246) explicitly cites torch 2.1 compatibility.
  - **Trigger:** Stems image's torch pin is bumped to 2.2.x or
    higher for any reason (new demucs version, GPU stack update,
    etc.).
  - **Discovered:** 2026-05-16 (Phase 3I.2)
  - **Status:** open

- **Finding:** In-browser RecordingAnalyzer is unacceptably slow
  for full-rehearsal MP3s. Observed 2026-05-17: 277MB / ~2.5hr file
  takes ~80+ minutes for the "Extracting BPM, groove & chords"
  stage alone (browser-side single-threaded JavaScript running BPM
  + key + chord extraction per segment, plus segmentation that
  produces 40+ segments). Total pipeline ~90+ minutes wall-clock
  for one rehearsal. The page is unresponsive during the run
  (Chrome shows the standard "wait for unresponsive page" prompt
  multiple times). Tester UX impact is severe — any band uploading
  a real rehearsal hits this on first contact.
  - **Why deferred:** A faster path exists: `bestshot.js`'s
    `chopAnalyzeOnServer` button calls the `groovelinx-rehearsal-
    segment` Modal app (per commit `bcb809f7`, 2026-05-12) which
    runs CPU-based segmentation on Modal in 3-8 min per its UI
    hint. But that path is wired only into the Bestshot chopper,
    not the Rehearsal page modal (`_rhRecreateFromRecording`).
    Wiring it into the Rehearsal page flow is a UI integration
    task that warrants its own scoped commit, not an inline fix.
  - **Trigger:** Any tester reports analyze-time friction OR the
    next live Deadcetera rehearsal upload exceeds patience.
  - **Discovered:** 2026-05-17 (Phase 3I.2 validation)
  - **Status:** open — HIGH severity for tester UX; bottleneck
    surfaces immediately on first real import

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

- **Finding:** `app-dev.js`'s `_renderNotifSettings` is missing the
  entire SMS Notifications section that exists in production `app.js`
  (lines 10778–10801 in app.js are absent in app-dev.js, which ends
  the function at the master/preference toggles). Same drift applies
  to `_smsToggleOptIn`, `_smsNormalizePhone`, and now
  `_smsSendTestPing` — none of these exist in app-dev.js. Surfaced
  while wiring the SMS pipeline smoke test on 2026-05-19.
  - **Why deferred:** Out of scope for the smoke-test wiring. Mirroring
    ~80 LOC of SMS opt-in flow + test handler into app-dev.js plus the
    surrounding stylistic conformance is a separate deliberate sync
    pass. The dev surface currently has no SMS UI at all, so users
    testing dev simply don't see the channel.
  - **Trigger:** Next dev/prod sync pass on notifications, OR if any
    band member starts using `app-dev.js` for SMS-relevant testing.
    Per `feedback_dev_prod_sync.md` this should not linger.
  - **Discovered:** 2026-05-19 · build `20260519-174217` · while
    wiring SMS pipeline smoke test
  - **Status:** open

- **Finding:** Inline-onclick handlers in `js/features/song-detail.js`
  that receive `safeSong` via the HTML→JS parse and then re-emit it
  into another inline onclick attribute are vulnerable to a classic
  quoting bug for titles with apostrophes (e.g. "Ain't Life Grand",
  "Don't Let Go"). One instance found + fixed today
  (`sdOpenReadinessPopover` — readiness picker silently failed on
  apostrophe-songs, build `20260519-184759`). Grep for `safeSong = `
  in song-detail.js shows ~20 other escape sites; most are at render
  entry points (where the title is freshly escaped from `_sdCurrentSong`
  or similar), but if any of them are nested inside a handler that
  receives an already-decoded value through an inline onclick, the
  same bug pattern may exist.
  - **Why deferred:** No reported instance beyond the readiness picker.
    Auditing all 20+ sites preemptively is scope creep.
  - **Trigger:** Any new "click does nothing only on
    apostrophe-songs" bug report. Fix template:
    `var jsSong = String(safeSong || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");`
    then use `jsSong` (not `safeSong`) in the re-emitted onclick.
  - **Discovered:** 2026-05-19 · build `20260519-184759` · while
    fixing readiness picker
  - **Status:** open

- **Finding:** Live Gig analyze context silently auto-picks `setlists[0]`
  with no chooser (`recording-analyzer.js:2767-2769`). User got matched
  against an old setlist on first analyze of the 5/27 rehearsal because
  the freshest setlist happened to not be index 0. The 🥁 Band Rehearsal
  branch DOES offer a picker (current planner queue / past sessions /
  no plan); 🎤 Live Gig should mirror that.
  - **Why deferred:** Surfaced live during the first overnight ingest
    review session 2026-05-28; needed to ship the workaround verbally
    (re-analyze as Band Rehearsal) rather than block on a code patch
    at 11 PM during active user testing.
  - **Trigger:** Next Live Gig analyze that runs against the wrong
    setlist, OR next focused pass on Review Mode UX coherence.
  - **Discovered:** 2026-05-28 · post-3d9c450b first-ingest review
  - **Status:** open

- **Finding:** Ingest script (`services/glx-ingest/ingest_full_rehearsal.py`)
  sets the rehearsal session's `date` field to the ingest-run date, not the
  recording date. When the band finishes rehearsal at 11 PM and the ingest
  pipeline kicks off + finalizes past midnight, the resulting session
  shows up dated for the FOLLOWING day. Surfaced 2026-05-28: the 5/27
  rehearsal session was written with `date: "2026-05-28"`. This breaks the
  analyzer's plan-prior lookup (it reads `rehearsal_plan_${sessionDate}`)
  AND breaks Review Mode / History UI labels.
  - **Why deferred:** Manually corrected the data for the 5/27 session
    via Firebase database:set 2026-05-28 (date field + rehearsal_plan
    write). The code fix (derive session date from first chunk's mtime,
    not from ingest-run wall clock) needs to land before the NEXT
    overnight ingest to prevent recurrence.
  - **Trigger:** Next overnight ingest that crosses midnight (likely the
    2026-06-03 rehearsal if Drew records again next week and the ingest
    runs after midnight). Also: any audit pass on the ingest pipeline.
  - **Fix:** Use first chunk's `os.path.getmtime()` (already collected
    during the WAV continuity scan) to derive `recording_date` in
    `ingest_metadata.json`, then use that field rather than `date.today()`
    when writing the session to Firebase.
  - **Discovered:** 2026-05-28 · post-3d9c450b first-ingest review
  - **Status:** open

- **Finding:** No in-app surface lists all rendered mixes for a multitrack
  session. The Mix tool RENDERS new ones, the player auto-loads ONE
  (mix_default preferred, else newest), SMS/Export/Isolate-stems all act
  on the currently-loaded render. But the user has no way to see what
  renders exist for a session OR to switch the active render. Drew
  surfaced this 2026-05-28 after realizing his 5/27 session already had
  4 renders in R2 (mix_default + export-* + custom-*-songs + a preview)
  that he had no UI to discover or load. Cost: zero — they're in R2
  fine; storage isn't the problem. Visibility is the problem.
  - **Why deferred:** Pierce in the app at the time of discovery; no
    commits per Drew's request. Also a natural next-ship after the
    render-pipeline work; not a trust-layer bug, just a missing surface.
  - **Trigger:** Next focused multitrack UX pass, OR the moment Drew (or
    another bandleader) renders ≥2 mixes per session and the "which one
    am I sending to the band?" question becomes recurring friction.
  - **Likely shape:** Tools → 🎵 Renders dropdown listing all completed
    renders for the session with renderId, filename, size, modified
    date. Click loads that render. ~100-150 LOC, mirrors the existing
    `/multitrack/render/status` worker response.
  - **Discovered:** 2026-05-28 · post-04169069 first-songs-only-render
    review
  - **Status:** open

- **Finding:** Render filenames bake the date at render time, not from
  the session's canonical date field. After the 2026-05-28 date drift
  fix (session date corrected 5/28 → 5/27), the existing renders still
  carry their original filenames ("rehearsal-mix-2026-05-28.mp3" for
  what's actually the 5/27 session). Cosmetic, not functional — the
  R2 path stays sessionId-keyed regardless.
  - **Why deferred:** Cosmetic. Renaming files in R2 means uploading
    new objects + cleaning up old ones; not worth the operational risk
    for a label-only fix. Future renders use the canonical date already.
  - **Trigger:** Cosmetic cleanup pass, OR if Drew finds the mixed
    dates in the future render-picker UI confusing.
  - **Discovered:** 2026-05-28
  - **Status:** open

- **Finding:** Multitrack-rehearsal comments are anchored to absolute
  `timestampSec` in the rendered audio file, NOT to segment IDs.
  Surfaced live 2026-05-28 by Pierce: he made 11 comments while playing
  the songs-only mix (303.8 MB, ~2:12 duration); the player has since
  reverted to auto-loading the full mix (443.8 MB, ~3:14 duration);
  his comment timestamps now drift forward by the cumulative
  silence+chatter excluded BEFORE each comment position. Delta is
  +14:41 at 42:02 (songs-only timeline) and grows to +31:08 by
  1:16:09 — fully accounting for ~1h of excluded chatter/silence
  spread through the rehearsal.
  - **Why this is bad:** any render switch — overwrite of `mix_default`,
    user toggle between songs-only and full, service-worker cache
    reset reverting auto-load to default, future Custom Mix renders
    changing the newest-wins order — silently breaks comment
    alignment. Pierce reported this himself with an exact reproduction:
    "I think the rendered rehearsal file may have changed, but the
    comment time points are the same." This is a real trust-layer
    bug per Drew's own triage rule (comments are captured user data;
    misaligning them = lost meaning + lost effort).
  - **Why deferred:** People in the app at moment of discovery; no
    commits per Drew's request. Also a non-trivial fix — needs to
    span save / load / render / display paths AND migrate ~existing
    comments. Estimated 200-300 LOC.
  - **Trigger:** Next user-reported comment drift, OR before
    onboarding bands beyond Deadcetera (other bands will have NO
    workaround context for the drift).
  - **Fix shape:** Store `{segmentId, offsetWithinSegment, fallback:
    {timestampSec, renderId}}` per comment instead of just
    `timestampSec`. At display time, look up the segment from the
    current player's segment list, add the offset, render the
    absolute position. If the segment was excluded from the current
    render (e.g., chatter excluded from songs-only), surface the
    comment as "exists but out of view; jump to context?" rather
    than silently mapping to wrong position. Fall back to absolute
    timestamp if segmentId can't be resolved (legacy comments
    without the new anchor field).
  - **Workaround for Pierce TODAY:** point him at the songs-only
    render URL directly (still in R2, never overwritten), where
    his original comment timestamps line up. Requires manual URL
    handoff until a render-picker UI ships (separate deferred item).
  - **Discovered:** 2026-05-28 · post-90313264 review-mode session
  - **Status:** open

- **Finding:** Stems download is whole-session ZIP only (13.3 GB for
  a typical 3-hour rehearsal × 17 channels × 24-bit FLAC). No per-stem
  download path in the UI. Surfaced 2026-05-28 by Brian: he's on LTE
  with carrier deprioritization, getting 3.2 Mbps, projected 9+ hours
  to pull the full ZIP. He only actually needs HIS tracks (vocal +
  guitar = ~1.2 GB = 50 min vs 9 hours).
  - **Why deferred:** People in app; no commits per Drew's request.
    Also genuinely small fix (~50-80 LOC UI patch) — should ship
    soon but doesn't block tonight.
  - **Fix shape:** Per-track download icons in the existing Stems
    modal track list. URL pattern already works (R2 public bucket
    with per-track FLAC at known path); just needs the affordance
    surfaced. No backend changes. Optional: bulk-select checkboxes
    for "download these 4 tracks" zipped subset, but YAGNI for v1.
  - **Workaround until shipped:** Manual URL share. Per-stem URL
    pattern: `https://pub-468e762ddbdc4c0d8b90402ae303906a.r2.dev/
    multitrack/{slug}/{sessionId}/{filenameStem}.flac`. Track list
    is in Firebase `bands/{slug}/rehearsal_sessions/{sid}/tracks/`.
  - **Discovered:** 2026-05-28 · Brian Hillman first-real-DAW pull
  - **Status:** open

- **Finding:** Calendar two-way sync reports "73 updated, 0 added,
  0 deleted" on every sync even when Google returned 0-1 actual
  changes. `saveBandArrayDataSafe` (firebase-service.js:670-672) DOES
  byte-compare records and skips unchanged writes — so the 73 count
  means 73 records produced a different serialized form vs what's
  stored. Suspected causes (not yet confirmed):
  (a) `_sanitizeForFirebase` mutates `undefined` → `null` on every
      pass, creating non-stored-side diffs;
  (b) Phase 2 pull processing reclassifies all events (type field,
      freebusy flags) regardless of whether Google sent a change;
  (c) JSON key ordering differences between local reconstruction
      and Firebase's storage.
  Cost: Firebase write quota burn (73 writes when 1 needed). NOT
  data destruction — events stay intact (verified 2026-05-28:
  126 events, types preserved, no dup, 119 unique googleEventIds).
  But the alarming log message correctly worried Drew.
  - **Why deferred:** Diagnosis-only tonight; fix needs careful
    audit of the Phase 2 processing path to find what mutates
    events without changing meaningful content. Estimated 1-3h
    of focused work. Not blocking.
  - **Trigger:** Next Firebase quota concern, OR if write rate
    becomes user-visible (e.g., paid plan with usage alerts).
  - **Fix shape:** Audit Phase 2 normalization — either (1) make
    in-memory records match Firebase's stored form before save,
    or (2) diff only meaningful fields (title/date/start/end/
    type/gigId) in saveBandArrayDataSafe instead of full JSON
    serialization equality, or (3) add a per-record changedAt
    timestamp that ONLY updates on meaningful change and use it
    as the equality check.
  - **Improve logging in the meantime:** Change the log message
    from "73 updated" (which implies content change) to "73 written
    (X content-changed)" so the user can see the difference
    between churn and real change. ~5 LOC, ship anytime.
  - **Discovered:** 2026-05-28 · Drew's "scares me" report after
    seeing post-edit sync log
  - **Status:** open
