# CURRENT UX STATE — Rolling Snapshot

**Last updated:** 2026-05-25 16:41 UTC · **Build under test:** `20260524-193407`

> **What this doc is.** A compact, rolling, operational snapshot of GrooveLinx UX/product direction — designed for AI sync without conversational replay. Re-validate before quoting if last-updated > 14 days old.
>
> **Cross-references (authoritative sources of truth):** `specs/groovelinx-ui-principles.md`, `specs/founder_ux_review_2026-05-22.md`, `specs/uat_lab_v1.md` (Tier B Founder Experience categories), `specs/competitive_positioning_reframe.md`, `system/UX_SURFACE_MAP.md`.

---

## 1. Hero principles (per `groovelinx-ui-principles.md`)

- **Band Command Center 3-pane layout** — left rail / center workspace / right context panel
- **One Job Per Screen** — each screen answers one canonical question
- **Music-use <1s SLA** — practice / rehearsal / gig surfaces (per memory `feedback_music_surface_sla`)
- **Layered IA — reposition, never delete** — low usage of a feature is NOT evidence to remove it (memory `feedback_layered_ia_no_deletes`)
- **No new destinations** — Memory + Recording integrate as contextual side panels, NOT new tabs/lenses/fullscreen modes (memory `feedback_workbench_no_new_destinations`)
- **Ground truth over theater** — system-state UI must reflect real state, not decorative simulation (memory `feedback_ground_truth_over_theater`)

---

## 2. Current UX direction (one paragraph)

GrooveLinx is moving from "feature-rich founder project" → "governed product platform." The product is in **convergence pressure phase** (per Drew 2026-05-25): the goal is to canonicalize, simplify, and orchestrate existing surfaces rather than build new ones. The competitive positioning thesis (`specs/competitive_positioning_reframe.md`) frames the moat as **operational continuity for bands**, not any single capability — so UX work that strengthens continuity (memory, improvement loops, accountability) takes precedence over UX work that demos new features. The Rehearsal Intelligence Convergence (Phases 1 → 4B+4C, shipped 2026-05-24) is the most recent example of this discipline: Review Mode replaced the old 17-stream player as the default playback path; Trust engineering (solid confidence chips, "Possible:" placeholders, progressive disclosure on row actions) made the analyzer's reasoning visible rather than hiding behind tinted backgrounds.

---

## 3. Active simplification efforts

| Effort | Status | Source |
|---|---|---|
| Rehearsal Intelligence Convergence (4 phases) | ✅ shipped 2026-05-24 | CURRENT_PHASE recovery entry |
| Review Mode replaces 17-stream player as default | ✅ shipped (Bug #17 fix) | `uat/bug_queue.md` |
| Custom Mix UX (phase progress + 🔊 30s preview + honest "Close" labeling) | ✅ shipped 2026-05-24 | commit `48a697ab` |
| Filter pills + collapsible groups in segments panel (Phase 4A) | ✅ shipped 2026-05-24 | commit `e87688b7` |
| Progressive disclosure on row actions (Phase 4B) | ✅ shipped 2026-05-24 | commit `87ec930b` |
| **Readiness Canonicalization** (single threshold authority) | 🔴 OPEN (NEW 2026-05-25, P0) | Drew feedback + system mapping |
| **GrooveMate convergence (orchestration philosophy)** | 🔴 OPEN (NEW 2026-05-25, P1) | Drew feedback |
| **Workbench lineage clarification** | 🔴 OPEN | system/FEATURE_LINEAGE |
| Phase 4D backlog (Review Queue mode toggle, J=next-unresolved shortcut, large row restructure, Human-corrected badge, Excluded-as-amber) | ⏸ deferred | DEFERRED_FINDINGS_QUEUE |

---

## 4. Unresolved UX debates

| Debate | Surface | Status |
|---|---|---|
| **Workbench scope** — is it a single canonical song-scoped shell or a Practice-mode-only experiment? | song-detail, rehearsal-mode, setlist-player, live-gig (all positioned as eventual Workbench bodies) | OPEN — Drew judgment needed |
| **Practice vs Rehearsal** mental model | `practice` page vs `rehearsal` page | Partly resolved; see `specs/practice_vs_rehearsal.md` |
| **Schedule tab button cluster** — Schedule + Schedule Rehearsal + Block + Subscribe all near each other with unclear differences | `schedule` page | OPEN — tester-reported (`00_Governance/STABILIZATION_QUEUE.md`) |
| **Song Detail right rail Play tab** — too narrow to be useful; chart-in-rail UX | `song-detail` page | OPEN — tester-reported |
| **Song Detail readiness pills** vs separate slider | `song-detail` page | OPEN — tester-reported |
| **Spotify embed vs SDK vs Connect** routing — when which path is taken is non-obvious to users | playback engine | Partly resolved post Bug #15 fix; UX surfacing still ambiguous |

---

## 5. Navigation philosophy

- Primary nav: 6 left-rail entries (Home, Songs, Practice, Rehearsal, Schedule, Setlists) + Settings + More (Tuner, Metronome, Playlists, Gigs, Stage Plot, Venues, Contacts, Band Room, Feed, Care Packages, Equipment, Help)
- Right rail = song context panel (`gl-right-panel.js`)
- `showPage(pageKey)` is the canonical router (per `CLAUDE.md` rule #1 — do not replace)
- Full-screen modes reserved for: Rehearsal Mode + Live Gig Mode only
- Overlays/modals: minimized where possible
- Avatar (GrooveMate) floats bottom-right; sub-overlays use `gl-spotlight` etc.

**Known navigation friction:**
- Duplicate / parallel UI for several concepts ("rehearsal plan" in 3 places per `system/UX_SURFACE_MAP.md`)
- Drift on launchpad pages (Home MEDIUM, Songs HIGH per `founder_ux_review_2026-05-22.md`)
- Operational surfaces (Practice, Setlists) stay LOW-drift because they already have a single job

---

## 6. Emotional UX goals (per `uat_lab_v1.md` Tier B + competitive positioning)

GrooveLinx is not generic productivity software — it succeeds or fails on:
- **Trust** — system claims match reality (counts, confidence chips, badges)
- **Musical momentum** — workflow doesn't break the flow of practicing/rehearsing
- **Confidence** — band knows where they stand on every song
- **Clarity** — every surface answers "what now?" in <2 seconds
- **Emotional coherence** — the product feels like reviewing a rehearsal, not debugging AI segmentation (memory `feedback_rehearsal_review_centric`)
- **Workflow intuition** — one continuous gesture per task; no "back out and re-enter" patterns
- **Accountability without judgment** — the band feels supported, not surveilled

These map 1:1 to UAT Lab Tier B finding categories: Trust issue / Cognitive overload / Navigation confusion / Musical context loss / Emotional friction / Recommendation confusion / Workflow momentum break.

---

## 7. Known confusion zones

| Zone | Type | Source |
|---|---|---|
| Schedule tab 4-button cluster | Emotional friction | tester report (STABILIZATION_QUEUE) |
| Song Detail right rail Play tab too narrow | Navigation confusion | tester report |
| "Loading..." sentinel persisting on North Star versions | Trust issue | fixed Stab #08 (2026-05-13), monitor for regression |
| Readiness count disagreement across surfaces | **Trust issue (P0)** | system mapping 2026-05-25 → C7 |
| GrooveMate suggestions lacking source citation | Recommendation confusion | system/AI_SYSTEMS_MAP |
| Home dashboard 13-15 panels above fold | Cognitive overload | `founder_ux_review_2026-05-22.md` |
| Songs page opens as filter table with no triage hierarchy | Navigation confusion (HIGH drift) | `founder_ux_review_2026-05-22.md` |

---

## 8. Current workflow hierarchy

Anchored in `00_Governance/CURRENT_STATE.md` core workflow:

```
Plan → Practice → Rehearse → Play → Review → Improve
```

| Stage | Primary surface | Canonical question |
|---|---|---|
| Plan | `rehearsal` page (Tonight's Rehearsal hero) + `setlists` | What are we going to work on? |
| Practice | `practice` page | Pick one song to practice now |
| Rehearse | `rehearsal` page (in-session) + Rehearsal Mode (full-screen) | Run the plan |
| Play | Live Gig Mode (full-screen) | Execute the gig |
| Review | `rehearsal` Latest Rehearsal Review → multitrack Review Mode | Listen back; tag where it was tight / rough |
| Improve | Practice Tasks (from comments) + readiness updates + setlist rotation | Close the loop |

**Loop integrity:** the Review → Improve handoff is the newest part of this hierarchy (Phase 1 of multitrack rehearsal review + PracticeTask scaffolding per memory `project_practice_task`). The Improve loop is the operational continuity moat per competitive positioning.
