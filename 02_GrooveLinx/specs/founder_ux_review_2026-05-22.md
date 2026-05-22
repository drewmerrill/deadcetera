# Founder/Bandmate UX Review — Synthesis

_Authored 2026-05-22 in response to Drew's structured UX architecture and operational-flow review. Anchored in current codebase state (build `20260522-180511`) via 5-way subagent fan-out (homepage / page-thesis / song-detail entry-points / recommendation logic / specs + memory). No code changes proposed here are speculative — each cites real file:line refs._

---

## 0. Framing

The review request is unusual in scope: it asks for an **operational-clarity framework**, not feature ideas. Bandmate feedback validated five themes (overload, missing page thesis, navigation friction, recommendation trust, Song DNA reachability) and one prioritization signal: framework clarity must come BEFORE deeper intelligence systems.

This synthesis honors that signal. It proposes:
- One hero per page (One Job Per Screen)
- Universal Song DNA deep-linking (kills the "back out and re-enter" pattern)
- Additive recommendation rules anchored to gigs AND rehearsals (no rewrite)
- A 4-phase sequencing so each ship can be UAT-verified before the next starts

Existing constraints honored (from `groovelinx-ui-principles.md` + memory `feedback_one_job_per_screen`, `feedback_music_surface_sla`, `feedback_layered_ia_no_deletes`, `feedback_workbench_no_new_destinations`):
- **Band Command Center 3-pane layout** (left rail / center workspace / right context panel)
- **One Job Per Screen** — each screen answers one canonical question
- **Music-Use <1s SLA** — practice / rehearsal / gig screens
- **Layered IA — reposition, never delete**
- **No new destinations** — contextual side panels, not new tabs/fullscreens

---

## 1. UX Architecture Review of Core Operational Pages

Six pages audited, drift severity scored as LOW (focused) / MEDIUM (soft sprawl) / HIGH (kitchen sink):

| Page | Drift | Why |
|---|---|---|
| Practice | LOW | Two-tab structure (Focus / Mixes); single Start CTA on a recommended song. Aligned. |
| Setlists | LOW | One green "Build a New Set" CTA + list below. Clear thesis. |
| Homepage | MEDIUM | 13-15 panels render simultaneously; 4-5 above-fold CTAs compete. |
| Rehearsal | MEDIUM | Dual personality — multitrack ingest hero tile vs. plan/review workspace. |
| Calendar | MEDIUM | Soft purpose drift between "see what's coming" and "resolve scheduling conflicts." |
| Songs | HIGH | Opens as a filter table with no triage hierarchy. No "I came here to..." answer. |

Root finding: **drift is concentrated on the launchpad surfaces (Home + Songs), not the operational surfaces (Practice + Setlists).** The pages that already have a single job stayed coherent; the pages designed as "capability hubs" sprawled.

---

## 2. Page Thesis Statements

Proposed canonical thesis for each page. The implementation move follows each thesis.

**Homepage** — _"What does the band need from me, right now?"_
Today: 13-15 panels (event-risk card, next-action card, focus songs, weekly pulse, smart nudge, upload CTA, activity feed, post-rehearsal prompt, poll, band-status compact, rail guidance). Tomorrow: ONE hero card + 4 quick-jumps + collapsibles. See §5.

**Practice** — _"Pick one song to practice now."_
Today: aligned (two tabs, single Start). Keep as-is.

**Rehearsal** — _"Plan, run, and review band rehearsals."_
Today: multitrack ingest tile dominates first paint. Tomorrow: demote ingest to header utility; let plan/review (the page's actual job) own the workspace.

**Songs** — _"Browse and triage the band's song catalog."_
Today: data-table library browser. Tomorrow: opens with weak-songs triage view active by default; full library is one filter-toggle away.

**Schedule (Calendar)** — _"What's coming up, and what conflicts need resolving?"_
Today: viewing + conflict resolution intermixed. Tomorrow: Next Up card becomes the dominant first-paint surface; conflict UI surfaces only when conflicts exist.

**Setlists** — _"Pick a setlist to perform, or build a new one."_
Today: aligned. Keep as-is.

---

## 3. Navigation-Flow Review

Audited every place a song reference renders in the UI. Friction inventory:

**Already clickable to Song Detail** ✓
- Songs page rows (`songs.js:641` — `onclick="selectSong(...)"`)
- Home Dashboard readiness nudge (`home-dashboard.js:2727`)
- Home Dashboard weak-songs widget (indirect — 2-step: filter → auto-select)

**NOT clickable (high friction)** 🚨
- **Rehearsal Take Rows** (`rehearsal.js:5518+`) — CRITICAL. Take Review renders song titles as `<span>` text only. You just walked the 5/11 takes; this surface is where the gap bites hardest.
- **Setlist Builder song rows** (`setlists.js:569-574`) — plain `<div class="song-title">`, no onclick. Can't preview Song DNA while building a set.
- **Live Gig Display** (`live-gig.js:445`) — `<span class="lg-song-title">`, no onclick. Performers can't reference key/chart/notes mid-gig.
- **Practice Mode Task Rows** — partial (plays/practices the song but no Song DNA deep-link).
- **Setlist Player "Now Playing"** (`setlist-player.js:962`) — title click only returns to the player, not Song DNA.

**Top 3 highest-friction fixes** (smallest code, biggest payoff):
1. **Take rows → Song DNA** — one-line onclick wiring per row.
2. **Setlist Builder song rows → Song DNA right panel** — preserve in-progress builder state via right-panel target.
3. **Live Gig title → dismissable Song DNA overlay** — small modal, returns to gig on close.

---

## 4. Song DNA Linking Strategy

**Adopt platform-wide rule: every song reference is a deep-link to Song DNA.**

Implementation policy:
- **Display form unchanged** — no underline, no link styling. Preserves the cockpit aesthetic. The interaction is the change, not the visual.
- **Interaction: clickable** — onclick → `window.renderSongDetail(title)` (the canonical entry at `js/features/song-detail.js:28`).
- **Surface target by context:**
  - From Songs page, Home, navigation chips → standard Song DNA page render.
  - From in-progress flows (Setlist Builder, Rehearsal active session, Live Gig) → Song DNA as **right-panel context** OR dismissable overlay. NEVER navigate away from in-progress state. Honors `feedback_workbench_no_new_destinations`.
- **Convention:** add `data-song-title="<title>"` to all song chip/title elements. A single delegated click handler at the app shell routes everything to `renderSongDetail` without per-call wiring. Future song surfaces inherit the behavior for free.

Stretch: register a "back-trail" stack on Song DNA opens, so the right-panel UX includes a "← Back to Setlist Builder" affordance when launched from an in-progress flow. Closes the operational-continuity loop.

---

## 5. Homepage Hierarchy Proposal

**Current:** 13-15 stacked panels, 4-5 above-fold CTAs competing.

**Proposed first-paint hierarchy (top to bottom):**

```
┌─ Band Header (date + freshness label)
├─ ONE Hero Card  ← THE primary action right now
│   • Event Risk Card (if event ≤7d AND risk detected)
│   • Next Action Card (otherwise)
│   • Smart Nudge collapsed into hero's secondary line, not standalone
│
├─ Quick Jumps (4 tiles, horizontal strip)
│   • → Practice  → Rehearsal  → Setlists  → Songs
│
├─ [Disclosure — collapsed by default] Focus Songs (top 3)
├─ [Disclosure — collapsed by default] Recent Activity feed
│
├─ [Right rail] Compact Band Status (readiness %, weak count, member status)
└─ [Right rail] Upcoming events (next gig + next rehearsal)
```

**Demoted out of first paint:**
- Weekly Band Pulse → move to /stats subroute or right rail only
- Post-Rehearsal Prompt → move to rehearsal page entry
- Poll Card → move to Band Feed page (already a destination)
- Upload Rehearsal CTA → move to rehearsal page header
- Smart Nudge → fold into hero card's secondary line

Result: first paint = band header + ONE hero card + 4 quick-jumps + rail context. Everything else is 1 click away, nothing deleted (Layered IA discipline).

---

## 6. Recommendation-Priority Logic Proposal

**Current weighting** (`js/core/gl-focus.js:78-90` `getNowFocus()`):
```
focusScore = (5 - readiness) * 2       // 0-10 base
if in setlist:               +3
if gig ≤7d AND in setlist:   +(8 - gigDays)    // +1 to +7
priority bonus:              +0.5 * pri        // bandLove*0.5 + audienceLove*0.2 + ...
```

**Gaps Drew flagged, validated by the audit:**

1. **Rehearsal urgency: missing entirely.** Recommendation:
   ```
   if rehearsal ≤4d AND song in any upcoming setlist:
       focusScore += (5 - rehearsalDays)        // +1 to +4
   ```
   Parallel to gig logic, smaller window because rehearsals are higher-frequency.

2. **Gig-urgency window too narrow (7d hard cliff).** Bands plan further out. Recommendation:
   ```
   if gig ≤14d AND in setlist:
       focusScore += (15 - gigDays) * 0.6       // +0.6 to +8.4
   ```
   Smooth ramp, longer reach. Replaces the step-function.

3. **Stale-focus rotation: no logic.** Recommendation:
   ```
   if practiced_at within last 48h AND readiness ≥ 3.5:
       focusScore -= 2
   ```
   Rotates out songs that just got worked; lets fresh weak songs surface. Closes the "stale focus" issue Drew flagged.

4. **Unresolved rehearsal feedback weight: missing.** If a take has `matching.correction_source === 'human'` AND the song is in an upcoming setlist, surface as a focus item. Closes the review → practice loop per `project_practice_task` memory.

**Scope discipline:** no ML, no scoring rewrite. All four are additive rule-based deltas. Ship as <50 LOC total. Each adjustable independently if a single rule misbehaves under UAT.

---

## 7. Prioritization Order — Sequenced Phases

Anchored in Drew's #5 finding: framework clarity before deeper intelligence. Each phase is independently UAT-shippable.

**Phase 1 — Reduce overload (1-2 weeks)**
- [ ] Homepage hierarchy cleanup (§5) — collapse Focus Songs / Activity / Poll / Smart Nudge under disclosure; ONE hero + 4 quick-jumps
- [ ] Songs page triage view — opens with weak-songs filter active; library one toggle away

**Phase 2 — Song DNA deep-linking sweep (1-2 weeks)**
- [ ] Rehearsal Take Rows → onclick → renderSongDetail (CRITICAL — highest-friction surface)
- [ ] Setlist Builder song rows → clickable with right-panel Song DNA preview
- [ ] Live Gig Display title → dismissable Song DNA overlay
- [ ] Practice task rows → ⓘ affordance → Song DNA
- [ ] Setlist Player "Now Playing" → Song DNA right panel
- [ ] (Stretch) `data-song-title` convention + delegated click handler

**Phase 3 — Recommendation polish (1 week)**
- [ ] Add rehearsal-urgency boost to gl-focus.js
- [ ] Widen gig-urgency window 7d → 14d (smooth ramp)
- [ ] Add stale-focus 48h-practiced demotion
- [ ] Add unresolved-rehearsal-feedback signal
- [ ] Wire rehearsal completion → `invalidateFocusCache()`

**Phase 4 — Page thesis nail-down (per-page passes)**
- [ ] Rehearsal — demote multitrack ingest to header utility, let plan/review own the workspace
- [ ] Calendar — make Next Up the dominant surface; conflict UI surfaces conditionally
- [ ] (Practice + Setlists left alone — already focused)

**Out of scope (per Drew's explicit NOT-doing list):**
- AI/ML matcher work (Phase 3I already done; no further intelligence systems this review)
- Visual redesigns / themes / mobile responsiveness polish
- 5 mode-gated features (Band Love / Prospect Voting / Song Structure / Band Discussion / Play mode) — flagged in Deferred Findings (§8)

---

## 8. Deferred Findings Queue Additions

To route into `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md`:

1. **Songs page is a library browser, not a destination.** No clear "I came here to..." answer. Phase 2 triage view fixes this — documented here in case a deeper IA decision supersedes.

2. **Live Gig Display has no inline Song DNA escape hatch.** Performers can't reference key/chart/notes mid-gig without backing out. Stems and chart overlay both exist but require navigation. Phase 2 fix is dismissable overlay; documenting in case a different approach (e.g. always-on gig-side chart) is preferred.

3. **Setlist Player "Now Playing" title isn't a deep-link.** Currently navigates back to player only.

4. **5 mode-gated features unreachable** (from `groovelinx-ui-principles.md` + spec audit): Band Love, Prospect Voting, Song Structure editor, Band Discussion, Play mode. No UI mode switcher exists. Out of UX framework scope; flagged because the IA decision affects framework clarity.

5. **Naming drift: "Sharpen" still visible** in dashboard (should be "Improve" per UI principles). Cosmetic but adds friction to thesis clarity.

6. **Music-use SLA (<1s) untested on Songs page, Home feed, Rehearsal page, Schedule grid.** Memory says the SLA exists; no evidence it's measured. Telemetry instrumentation is a separate ticket.

7. **`focusChanged` event has no rehearsal-context fan-in.** When a rehearsal completes, focus should re-evaluate; today it relies on the 30s cache TTL or manual `invalidateFocusCache()`. After Phase 3, rehearsal completion should explicitly invalidate.

8. **`linkedSetlist` is name-based, not ID-based** (calendar.js:7837). Pre-existing finding from notification candidate #2 (issue #41). Re-flag here because the Song DNA deep-linking sweep may benefit from migrating to ID-based references across the board.

---

## Process Notes

- **Research method:** 5-way subagent fan-out across homepage / page-thesis / song-detail entry-points / recommendation logic / specs+memory. Each agent returned independently in parallel — first non-trivial application of the pattern Drew piloted earlier this session.
- **Constraint discipline:** every proposal cites either a current file:line or a documented memory/spec principle. No invented "industry best practice" framings.
- **Scope discipline:** zero code changes proposed inside this review. All proposals are scope-bounded for individual UAT-shippable phases. The deferred findings list captures everything that would be tempting to fold in but isn't this review's job.

---

_Tracking: GitHub epic to be created on Project board #1 with Phase 1-4 as separate issues._
