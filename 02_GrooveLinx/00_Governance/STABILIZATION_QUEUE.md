Critical


High

**Canonical-system readiness threshold divergence** (filed 2026-05-25 — **IMPLEMENTED 2026-05-25, see C7 / Stab #15 in STABILIZATION_DASHBOARD.md**)

Songs-that-need-work has at least **3 contradictory definitions** in active code, with at least a 4th color-tier threshold layered on top. This is governance debt becoming visible in UX: every "count disagreement" tester observation (the kind Pierce was reacting to emotionally) traces back to this divergence. Treat as **canonical-system fix (C7 candidate), NOT a local patch** — patching at one site moves the contradiction rather than resolving it.

Concrete divergences:
- `js/core/gl-focus.js:92` — `if (avg < 4)` — focus-engine "songs that need work" candidates
- `js/features/home-dashboard.js:439, 454` — `belowReadyCount = avg > 0 && avg < 3` (used by home-dashboard sites B/D/E)
- `js/features/home-dashboard.js:2084, 2321` — `lowReady = avg <= 2` (scorecard headline). The code at `:2321` even contains an explicit comment: `"lowReady = avg<=2 differs from belowReadyCount"` — the authors knew.
- `js/features/home-dashboard.js:1111` — `s.avg <= 2 ? red : s.avg <= 3 ? amber : grey` — urgency color tier (4th threshold)
- `js/features/home-dashboard.js:1835-1836` — `avg < 2` = "needs work", `avg <= 3.5` = "getting there" — status text yet another threshold
- `js/features/home-dashboard.js:1952` — `avg >= 3.5` / `avg >= 2.5` — bar color (yet another)
- `js/core/gl-focus.js:108-110` — `avg < 2` / `avg < 3` — focus engine messaging tiers

User-visible symptom: homepage may say "3 songs need work" while another panel says "5" and a third says "2" — all reading the same underlying readiness data, all "correct" by their own threshold, but the band has no way to know which number to trust. Per Drew 2026-05-25: _"if the product stops feeling authoritative, it stops being a Band Operating System."_

Recommended posture (per Drew 2026-05-25 and the AI Synchronization Layer's `system/CURRENT_ARCHITECTURE_STATE.md` §2 candidates list):
1. Promote to **Convergence Initiative C7 — Readiness Canonicalization** (governance decision; Drew + ChatGPT formalize the number in `STABILIZATION_DASHBOARD.md`)
2. Declare a canonical readiness model (proposal: `GLReadinessModel` from Audit #10) in `00_Governance/CANONICAL_SYSTEMS.md` with semantic labels (`lockedIn`, `inProgress`, `needsWork`, `unrated`) and a single threshold authority
3. Migrate the 8 sites above to consume the canonical model via `GLReadinessModel.classify(avg)` instead of inline arithmetic
4. Add a SYSTEM LOCK note to `CLAUDE.md` §7 prohibiting new inline `avg < N` comparisons in feature files

Surfaced by: System Intelligence + Governance Mapping (2026-05-25, commit `0b3f9c84`, `02_GrooveLinx/system/AI_SYSTEMS_MAP.md` + `SYSTEM_MAP.md` §4). Reinforced by: Audit #10 Home Hierarchy root-cause C.


Medium


Medium
When I first log on to home page, 4 blank rectangle frames flash for a second or two before homepage loads


Nice-to-have
Schedule tab - there is a green "Schedule "button in the upper right of the calendar, a green "schedule rehearsal" button in the lower left, then a red "Block" button that is very dim in the lower right for creating conflicts, and a very dimmed Subscribe button.  I feel like all of these buttons should be together and renamed appropriately so it is clear what it does.  Schedule and Schedule rehearsal probably do the same thing?  Block... Set unavailability?, Subscribe... should it be here or somewhere else?  If they select the right mode, just wondering if this might confuse them.  Maybe we change the directions to be clear if they click it so they don't create noise in the system?

On Song Detail Right Rail, in the tabs, there is one called Play that calls up the chord chart.  If you are really going to show the chart in the right rail, you need to put a maximize and minimize button on it so it can expand out and be useful.  Right now it is too narrow to be effective.  Maybe think about this b/c it is duplicative of rehearsal/gig chart and we should all be working off the same thing.

On Song Detail tab, we have key, BPM, and Lead vocalist
Then underneath, we have readiness pills.  To avoid having to go all the way down the rail to find readiness and see where everybody is, what if the person just clicks on the pill and it pulls up their selector to determine level along with some standardized wording for what each level means underneath as they move the selector?  That way, it eliminates the need for the slider.  Probably also need Key, BPM, Lead Vocals, and Readiness next to each field so newbies know what they are looking at.

On Song Detail Tab, when you click versions, it says find a version.  Search archive.org, Relisten, Phish.in, Youtube, and More.  Do we have Phish.in?  Shouldn't we order it the same as version hub?  First Youtube, Then Spotify, then Archive, then Relisten