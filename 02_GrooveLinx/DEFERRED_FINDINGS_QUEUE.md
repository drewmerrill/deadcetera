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
