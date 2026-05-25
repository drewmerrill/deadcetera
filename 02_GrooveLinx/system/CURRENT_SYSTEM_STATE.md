# CURRENT SYSTEM STATE — Rolling Snapshot

**Last updated:** 2026-05-25 17:36 UTC · **Build under test:** `20260525-173406` · **HEAD commit:** pending UX convergence pass

> **What this doc is.** A compact, rolling, operational export of GrooveLinx state — designed for AI synchronization (esp. ChatGPT ↔ Claude) without massive conversational replay. Not a journal. Re-validate before quoting if last-updated > 14 days old.
>
> **Cross-references (authoritative sources of truth):** `00_Governance/CURRENT_STATE.md`, `00_Governance/CURRENT_PRIORITIES.md`, `00_Governance/ACTIVE_WORKSTREAMS.md`, `00_Governance/STABILIZATION_DASHBOARD.md`, `system/SYSTEM_MAP.md`, `system/STABILITY_CLASSIFICATION.md`.

---

## 1. Build truth

- **Production:** `https://app.groovelinx.com` — Vercel auto-deploys on push to `main`
- **Live build:** `20260525-173406` (UX Convergence Pass 1 — Multitrack Review action hierarchy + per-kind row weight + musical moment markers + text density reduction)
- **Local dev:** `http://localhost:8000` via `python3 -m http.server 8000` (Playwright `webServer` auto-starts)
- **Dev shell:** `https://app.groovelinx.com/index-dev.html` (generated from `index.html` via `scripts/generate-dev-html.js`)
- **Cloudflare Worker:** `deadcetera-proxy` — last redeployed 2026-05-24 (Phase 4C `plan_priors` passthrough)
- **Modal services:** 6 web endpoints live — `groovelinx-stem-separator`, `groovelinx-rehearsal-segment`, `groovelinx-multitrack-zip`, `groovelinx-multitrack-render`, `groovelinx-lalal`, `groovelinx-audio-embeddings`
- **Firebase RTDB:** `deadcetera-35424-default-rtdb.firebaseio.com` · `bands/{slug}/*` open-read rule still in effect
- **Doc-only sessions since `87ec930b`:** `a7c5cb64` (UAT Lab + Bugs #18/#19 filed) · `af79ac0e` (Bug #15 re-verification) · `0ac0f4ee` (UAT Lab v1 draft) · `ad9a2ea6` (UAT Lab v2 + Operational Visibility v1) · `7ffd7800` (Competitive Positioning Reframe) · `0b3f9c84` (System Mapping) · `be3ed592` (AI Synchronization Layer)
- **First code-shipping session since `87ec930b`:** UAT Lab Phase 1 harness (~220 LOC across `tests/uat-lab/` + `scripts/uat-lab/`) — not user-facing code, no build bump

---

## 2. Current operational priorities

Per `00_Governance/CURRENT_PRIORITIES.md` + Drew's 2026-05-25 convergence-pressure feedback:

| Tier | Item | Source |
|---|---|---|
| **P0 — Existential** | Spotify Reliability (auth/token/reconnect/mobile playback) | CURRENT_PRIORITIES |
| **P0 — Existential (NEW 2026-05-25)** | **Readiness Canonicalization** — single threshold authority across `gl-focus.js` + `home-dashboard.js` (3 disagreeing thresholds today) | Drew feedback, system mapping finding |
| **P1** | Rehearsal workflow simplification | CURRENT_PRIORITIES |
| **P1** | Mobile experience | CURRENT_PRIORITIES |
| **P1 (NEW 2026-05-25)** | **GrooveMate Convergence Decision** — orchestration philosophy + intelligence-layer hierarchy + recommendation authority map (NOT implementation yet) | Drew feedback |
| **P1 (NEW 2026-05-25)** | **Entity Canonization** — promote `rehearsal_song_dna_relationship_model.md` into `00_Governance/CANONICAL_SYSTEMS.md` | Drew feedback |
| **P2** | AI Intelligence Layer (harmony / scoring / recommendations / agenda / detection) | CURRENT_PRIORITIES |
| **P3** | Notification + Engagement Layer | CURRENT_PRIORITIES |

**Posture:** convergence pressure phase. Per Drew 2026-05-25: _"deleting or converging things is more valuable than adding things."_ Avoid: new AI features, new surfaces, new workflows, new recommendation systems.

---

## 3. Active workstreams (per `ACTIVE_WORKSTREAMS.md`)

1. Spotify Reliability — playback / auth / reconnect / mobile
2. Rehearsal Intelligence — segmentation / matching / reports / BPM-chord-key
3. Mobile Performance — cache / SWR / render / perceived responsiveness
4. AI Guidance Layer — GrooveMate / recommendations / action routing / coaching
5. Scheduling Intelligence — calendar / availability / conflicts / RSVP
6. Product Simplification — fewer modes / clearer workflows / stronger onboarding / reduced cognitive load

**Net 2026-05-25:** the Product Operations cycle (UAT Lab + Operational Visibility + Competitive Positioning + System Mapping + this sync layer) is **inside Workstream 6**, not a new workstream.

---

## 4. Open convergence (canonical owners not yet enforced or initiatives not yet executed)

| ID | Initiative | Status | Owner | Reference |
|---|---|---|---|---|
| C1 | Player surface unification | ✅ shipped via Stabs #06/#07/#08 | — | STABILIZATION_DASHBOARD |
| C2 | `GLStore.RehearsalSession` ownership | ✅ Phase 1 + 2 complete | — | DATA_OWNERSHIP_RULES |
| C3 | Chart contract (`ChartRenderer`) | ✅ shipped via Stab #05 | — | CANONICAL_SYSTEMS |
| C4 | Status badge (`STATUS_LABELS`) | ✅ shipped via Stab #04 | — | CANONICAL_SYSTEMS |
| C5 | `GLBandFeedStore` ownership | ✅ Phase 1 complete · ⏸ Phase 2 (multi-path updates) deferred | Drew | STABILIZATION_DASHBOARD |
| C6 | Per-route lifecycle (`GLRouteLifecycle`) | ✅ shipped via Stab #03 | — | CANONICAL_SYSTEMS |
| **C7 (NEW)** | **Readiness Canonicalization** | 🔴 OPEN — explicit initiative not yet declared in governance | Drew + ChatGPT to define | System mapping finding 2026-05-25 |
| **C8 (NEW)** | **GrooveMate Convergence Execution** | 🔴 OPEN — committed in `gl-groovemate.js` header comment, no governance backing | Drew + ChatGPT to define | System mapping finding 2026-05-25 |
| — | **Entity-model declaration** | 🔴 OPEN — `rehearsal_song_dna_relationship_model.md` needs promotion to `00_Governance/CANONICAL_SYSTEMS.md` | Drew | Cited by 5 of 7 system maps |
| — | Notes/takes/recordings/tasks migration | ⏳ Phase 1 (annotations) shipped, Phase 2/3 pending | — | Mid-migration drift risk |
| — | Workbench lineage clarification | 🔴 OPEN — only Practice mode wired; intent (MVP scope vs stalled) undeclared | Drew | system/FEATURE_LINEAGE |
| — | Orphan capability roles | 🔴 OPEN — Stage Plot / Stoner Mode / Care Packages / Song Pitches / Finances lack canonical-role declarations | Drew | system/FEATURE_LINEAGE |

C7 + C8 numbering is **proposed**; Drew + ChatGPT formalize.

---

## 5. Active experiments

- **UAT Lab v1 Phase 1** — ✅ **LIVE 2026-05-25.** First flow `songs.triage.desktop` shipped (`tests/uat-lab/runner.js` + contract + `scripts/uat-lab/run.js`). Baseline PASS in 5.5s. Songs page added to `KNOWN_STABLE_FLOWS.md` at Experimental — awaiting Drew approval per `uat_lab_v1.md` §11.4.
- **Operational Visibility v1** — proposal stage. `specs/operational_visibility_v1.md`.
- **Competitive Positioning Reframe** — strategic clarity doc; awaiting Drew + ChatGPT strategic review. `specs/competitive_positioning_reframe.md`.
- **System Intelligence + Governance Mapping** — discovery complete (8 docs, 1,541 lines under `system/`). No new architecture proposed.
- **AI Synchronization Layer** — THIS DOC + 4 companions (in flight 2026-05-25).
- **Beta Operations** — Mode-A hard-block onboarding gate; Beta Feedback FAB live for testers; one tester so far via tester-feedback-driven entries in `STABILIZATION_QUEUE.md`.

---

## 6. Unstable areas / open bugs (per `uat/bug_queue.md`)

| # | Severity | Title | Status |
|---|---|---|---|
| #17 | HIGH | Multitrack far-seek sync collapse | **Architecture verified 2026-05-25** (Review Mode default + single stream + 169 ms far-seek measured); AC3/AC4 surfaced follow-on Bugs #18 + #19 |
| #18 | MED | Multitrack session is missing `durationSec` → §8.1 long-session banner never fires | OPEN |
| #19 | HIGH | Export Mix `/render/check` 502 silently abandons polling | OPEN |
| **NEW** | **HIGH (proposed)** | **Readiness threshold disagreement** — 3 thresholds across `gl-focus.js:92` + `home-dashboard.js:408-438` + `:2237-2242` | Surfaced by system mapping; awaiting promotion to bug_queue or canonical fix per C7 |

---

## 7. Recent major decisions (last 14 days)

- **2026-05-25** — Approved UAT Lab v1 §11 decisions: Option A (extend existing governance), Phase 1 lead = `songs.triage.desktop`, no autonomous KNOWN_STABLE_FLOWS promotion.
- **2026-05-25** — Approved Founder Experience (Tier B) finding categories for UAT Lab.
- **2026-05-25** — Acknowledged 16-doc `00_Governance/` directory as canonical (corrected an earlier inventory miss).
- **2026-05-25** — Strategic posture: convergence pressure phase. No new AI features / surfaces / workflows until C7 + C8 + entity canonization are decided.
- **2026-05-24** — Shipped Rehearsal Intelligence Convergence Phases 2 → 4B+4C (6 commits, Modal segment.py + render.py + worker redeployed).
- **2026-05-24** — Closed Bug #17 architecturally via R1+R2+R3 multitrack render pipeline.
- **2026-05-20** — Bug #15 (Spotify→YouTube cross-source teardown) fixed via `_activeMethod` gate (Stab #08 lineage).
- **2026-05-14** — Beta Operations Enablement: softer onboarding gate + Beta Feedback FAB + onboarding observability (build `20260514-142926`).
- **2026-05-13** — Stab #10 (Runtime Health Overlay) + Stab #11-14 (silent-failure hardening, Prep for Gig truthfulness, multitrack upload abort, stem job persistence).

---

## 8. SYSTEM LOCKs in effect (per `CLAUDE.md` §7 — do not modify without explicit review)

a. `GL_PAGE_READY` lifecycle (`js/ui/navigation.js`) — `_navSeq` guard on 7 assignments
b. `focusChanged` event model (`js/core/groovelinx_store.js`) — Home/Songs/Rehearsal subscribers
c. Firebase error filter (`index.html`) — `firebaseio.com/.lp` long-poll noise suppression only
d. Active status centralization (`GLStore.ACTIVE_STATUSES` + `isActiveSong()`)
