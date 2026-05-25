# GrooveLinx — Operational Visibility + AI-Assisted UAT Architecture v1

_Authored 2026-05-25 — entering the **GrooveLinx Product Operations** phase. Companion to (and broader than) `02_GrooveLinx/specs/uat_lab_v1.md`. Status: **proposal awaiting Drew approval**; no code or telemetry changes shipped by this doc. Strict mandate: **extend existing governance, never invent parallel systems.**_

---

## 0. Framing

This proposal answers Drew's commission:

> _"The GrooveLinx local development environment, operational docs, migration system, and AI tooling stack are now mature enough to move from ad hoc testing into a disciplined Product Operations phase. We are NOT trying to accumulate more tools. We ARE trying to improve operational visibility, product coherence, AI-assisted UAT, workflow trust, reduce chaos-driven development, formalize evidence-driven refinement."_

**Core principle:** GrooveLinx already has a sophisticated governance + diagnostic stack. The visibility gap is not "we need more instruments" — it's "we need disciplined patterns for using what's already there." Most recommendations below are **extensions to existing canonical surfaces**, not new tools.

**Hard constraints honored:**
- `00_Governance/CANONICAL_SYSTEMS.md` — "adding new monkey-patches of global browser APIs for instrumentation purposes" is **prohibited**. New observability metrics go inside existing canonical modules behind a `getStats()` getter.
- `00_Governance/DATA_OWNERSHIP_RULES.md` — all writes route through canonical owners (e.g., findings go through `GLFeedbackService.submitExplicit()`, never direct Firebase).
- `00_Governance/AI_WORKFLOW.MD` — ChatGPT owns strategy/architecture/review; Claude owns implementation/execution; GitHub Projects owns execution tracking; governance docs own continuity. Playwright extends Claude's execution surface — it does not become a new governance layer.
- `CLAUDE.md` SYSTEM LOCKs — `GL_PAGE_READY` lifecycle, `focusChanged` event model, Firebase error filter, `ACTIVE_STATUSES` — all untouched.

---

## 1. Existing Visibility Inventory (audited 2026-05-25)

The detailed inventory was produced by an Explore-agent pass on 2026-05-25. Summary tables below; full inventory available on request.

### 1.1 Runtime overlays + debug surfaces

| Component | File | Activation | What it exposes |
|---|---|---|---|
| **Runtime Health Overlay** | `js/core/gl-runtime-health.js` (430 LOC, Stab #10) | `?dev=true` / `localStorage.gl_runtime_health='1'` / `GLRuntimeHealth.show()` / `Cmd+Shift+H` | Build/route/SW status; `GLRouteLifecycle.getStats()` (registers/leaves/cleanup failures); `GLPlayerContract.getStats()` (pauseAll calls, reentrant drops, pause failures); `GLSpotifyConnect.getStats()` (token PRESENCE, polling, API call/failure counts); 9 known teardown exports; onboarding stats; multitrack upload state; Prep for Gig results; stems persistence |
| **Beta Feedback FAB** | `js/core/gl-beta-feedback.js` (~210 LOC, Phase 2 of Beta Operations Enablement) | `?beta=true` / `localStorage.gl_beta_feedback='1'` / dev shell + roster member / `GLBetaFeedback.show()` | 8-category modal (bug/confusion/playback/rehearsal/onboarding/mobile/performance/suggestion) + free-text + optional Runtime Health snapshot attachment; writes to `bands/{slug}/feedback_reports/{reportId}` |
| **Product Mode (deprecated)** | `js/core/gl-product-mode.js` | `gl_product_mode` localStorage | 3 legacy modes (sharpen/lockin/play); no longer gates UI, read-only |
| **🌿 Mode button** | UI shell + `js/features/stoner-mode.js` | Top bar | Currently surfaces Stoner Mode + legacy mode references |

### 1.2 Playback diagnostics

| System | File | Diagnostic surface |
|---|---|---|
| **GLPlayerEngine** | `js/core/gl-player-engine.js` | State machine: `IDLE → LOADING → RESOLVING → PLAYING → FALLBACK → ERROR`; `[GLPlayer] prev → state` log on every transition with source/method/device-id context |
| **GLSpotifyConnect** | `js/core/gl-spotify-connect.js:645-665` | `getStats()` returns `apiCalls`, `apiFailures`, `lastApiAt`, `lastApiPath`, `lastApiStatus`, `cachedConnection`, `pollingActive`, `hasToken`. Retry/refresh/backoff/network-recovery built into `apiRequest()` per Stab #08 |
| **GLPlayerContract** | `js/core/gl-player-contract.js` | `pauseAll(exceptId)` arbitration log; 5 surfaces participate (engine, setlist, stems, harmony, bestshot). Recursion-guarded |
| **GLStems** | `js/core/gl-stems.js` (Stab #14) | Job persistence in `gl_stem_jobs_active` localStorage, boot-time resume, `cancelJob(jobId)`, `getStats()` surfaces `activeCount/processing/completed/cancelled/failed/lastPollAt/kinds/liveLoops` |
| **Multitrack uploads** | `js/features/multitrack-rehearsal.js` (Stab #13) | AbortController per upload, `_mtAbortAllUploads`, `_mtGetUploadStats` surfaces `available/sessionId/aborted/abortReason/total/inFlight/queued/done/failed/cancelled` |
| **UX Tracker** | `js/core/gl-ux-tracker.js` | Rage click (3+ in 2s), dead click, rapid nav, hesitation (15+s), slow render (>3s); `[UX] event_type: data` console.warn; writes to `bands/{slug}/ux_events/{type}_{timestamp}`; auto-triggers `GLFeedbackService.recordFriction()` for `slow_render`, `rage_click`, render errors |

### 1.3 Firebase diagnostics

| Path | Writer | What lands |
|---|---|---|
| `bands/{slug}/feedback_reports/{reportId}` | `GLFeedbackService.submitExplicit()` | Explicit user reports + auto-friction events (3 triggers: `render_error`, `repeated_failure` 3x, `onboarding_stall`); max 1 auto-report per type per session |
| `bands/{slug}/feedback_reports/{reportId}/betaSnapshot` | `gl-beta-feedback.js:202` | Runtime Health snapshot JSON if user checks "attach snapshot" |
| `bands/{slug}/ux_events/{type}_{timestamp}` | `gl-ux-tracker.js:149` | rage_click/dead_click/rapid_nav/hesitation/slow_render/abandoned_flow/js_error |
| **Firebase MCP server** | `services/mcp-firebase/server.js` (in `.mcp.json`) | Stdio MCP exposes: `firebase_read`, `firebase_list_children`, `firebase_write`, `firebase_update`, `firebase_delete`, `firebase_push`. Scoped to `bands/deadcetera/` via `ALLOWED_BAND_SLUGS` env. Read unbounded; write/delete gated |

### 1.4 Latency instrumentation

- **Sparse `[PERF]` log lines** in: `calendar.js`, `home-dashboard.js`, `practice.js`, `setlists.js` (renderXxx start/painted, SWR cache HIT/MISS, Firebase complete)
- **No app-boot instrumentation** — DOMContentLoaded / TTI / boot-complete markers are not consistently emitted (some appear in CURRENT_PHASE.md release summaries but aren't fired from a single canonical source)
- **Music-surface <1s SLA** — referenced in `js/features/practice.js:132` ("must hit < 1s SLA") + memory `feedback_music_surface_sla`, **but no active measurement instrumentation present.** This is a real gap.

### 1.5 Error capture + friction tracking

| Component | Behavior |
|---|---|
| `GLFeedbackContext` (`js/core/avatar_feedback_context.js`) | Wraps `window.onerror` + `onunhandledrejection`; tracks last 10 actions + 5 recent errors |
| `GLFeedbackService.recordFriction(eventType, detail)` | Auto-files friction reports for render_error, repeated_failure (3x), onboarding_stall; max 1 per type per session |
| Firebase long-poll filter | `index.html:~870` suppresses `firebaseio.com/.lp` disconnect noise only. SYSTEM LOCK per CLAUDE.md §7c |
| `[UX]` logging | `gl-ux-tracker.js` — categorized events, in-memory cap 100 |

### 1.6 External telemetry — already wired

- **Contentsquare (Hotjar)** — `index.html:10` loads `https://t.contentsquare.net/uxa/6a9eda5501cfe.js`. Provides session replay, heatmaps, frustration detection. **Already covers most of what Sentry/PostHog/LogRocket would add.**
- **Google Maps API** — `index.html:38` for venue maps. Not telemetry-relevant.
- **No Sentry, PostHog, Mixpanel, LogRocket, FullStory, or Datadog** in the codebase.

### 1.7 Test/dev environments

| File | Purpose | Activation |
|---|---|---|
| `index-dev.html` | Dev shell — Contentsquare removed, loads `app-dev.js` instead of `app.js`; **generated from `index.html` via `scripts/generate-dev-html.js`** per memory `feedback_index_dev_generated` (never edit directly) | Visible to authenticated band members running locally |
| `?dev=true` | Gates Runtime Health overlay, Firebase test-path warnings | Query param |
| `?beta=true` | Gates Beta Feedback FAB | Query param |
| `?purge=1` | localStorage wipe (`index.html:844`) | Query param |
| Playwright `playwright.config.js` | Desktop + iPhone projects; `webServer: python3 -m http.server 8000` | `npm run test:*` |

### 1.8 AI tooling surface

| Tool | Status | Scope |
|---|---|---|
| `.mcp.json` — `groovelinx-firebase` | Active (Node.js stdio) | Firebase RTDB CRUD; scoped to `deadcetera` slug |
| `.mcp.json` — `playwright` | Active (`@playwright/mcp@latest`) | In-session browser control; used 2026-05-25 for UAT |
| `agents/` directory | Present | 9 prompt files: builder, operator, planner, handoff, state-machine, outbox, regressions — session-continuity scaffolding, not runtime agents |
| `AGENTS.md` ↔ `CLAUDE.md` (symlink) | Active | Canonical AI agent guidance, dual readership (Claude Code + Cursor + Aider + GitHub Copilot etc.) |
| `00_Governance/AI_WORKFLOW.MD` | Active | The canonical ChatGPT/Claude/GitHub split |
| `00_Governance/CHATGPT_THREAD_RULES.md` | Active | Thread hygiene |

---

## 2. AI Workflow Architecture (extends `00_Governance/AI_WORKFLOW.MD`)

`AI_WORKFLOW.MD` already defines the canonical AI split. This proposal does NOT redefine it — it extends with Playwright's role.

### 2.1 Existing roles (canonical, from `AI_WORKFLOW.MD`)

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Plan → Spec → Ready → Build → Review → Ship    │
└──────────────────────────────────────────────────────────────────────┘

ChatGPT          │ strategy / architecture / prioritization / sequencing /
                 │   workflow design / UX review / implementation review
                 │   governance
                 │   PHASES: Idea, Spec, Review

Claude           │ implementation / coding / patching / refactors /
                 │   repo operations / tactical debugging / execution
                 │   PHASES: Spec (formalization), Ready, Build, Ship

GitHub Projects  │ execution tracking / implementation status / work
                 │   prioritization / sprint visibility
                 │   THE OFFICIAL TASK BOARD

Governance docs  │ continuity / strategic truth / architecture truth /
                 │   current priorities / operational alignment
                 │   NOT a duplicate task board
```

### 2.2 Extension: where does Playwright fit?

Playwright (via MCP for interactive UAT, via `@playwright/test` for scripted runs) is a **Claude execution tool**, not a new role. It does NOT govern; it surfaces evidence.

```
ChatGPT          │ specifies UAT priorities and flow targets
                 │ reviews UAT findings for strategic implication
                 │ decides whether to promote a finding to a Stab/Convergence

Claude           │ writes Playwright contracts (per uat_lab_v1 §2.3)
                 │ runs deterministic UAT flows
                 │ classifies findings into existing queues (per uat_lab_v1 §4)
                 │ produces UX review exports for Drew + ChatGPT consumption

Playwright       │ evidence-capture tool only
                 │ NOT a decision-maker
                 │ NOT a finding-classifier (Claude classifies the output)
                 │ NOT a strategy surface

GitHub Projects  │ when a UAT finding becomes a tracked work item, it
                 │ lands here (per AI_WORKFLOW.MD "GitHub Projects is
                 │ the official task board")

Governance docs  │ unchanged — UAT findings inform CURRENT_PHASE.md,
                 │ STABILIZATION_DASHBOARD.md, STABILIZATION_QUEUE.md
                 │ via the existing queue patterns (uat_lab_v1 §7.2)
```

### 2.3 Where canonical truth lives (recap, NOT new — sourced from `00_Governance/ReadMe.md`)

| Truth | Lives in | Update cadence |
|---|---|---|
| What GrooveLinx currently IS | `CURRENT_STATE.md` | When platform changes materially |
| Strategic priorities | `CURRENT_PRIORITIES.md` (P0/P1/P2/P3) | When priorities shift |
| Active workstreams | `ACTIVE_WORKSTREAMS.md` (6 streams) | When workstreams begin/end |
| Architectural decisions | `ARCHITECTURE_DECISIONS.md` | When architecture changes |
| Canonical system owners | `CANONICAL_SYSTEMS.md` (305 lines, dense) | When new canonical owner declared |
| Data write authority | `DATA_OWNERSHIP_RULES.md` (Tier 1/2/3) | When new domain added |
| What's live in the latest build | `CURRENT_PHASE.md` (top entry) | After every meaningful change |
| Stabilization fix ledger | `STABILIZATION_DASHBOARD.md` (Stab #N completion record) | After every Stab ship |
| Tester-friction priority queue | `STABILIZATION_QUEUE.md` (Critical/High/Med/Nice-to-have) | After every triage |
| Tester-feedback intake | `BETA_FEEDBACK_QUEUE.md` (Inbound/Triage/In-flight/Closed) | As feedback arrives |
| Long-tail finding queue | `DEFERRED_FINDINGS_QUEUE.md` (5 categories) | As findings surface |
| Bug queue | `uat/bug_queue.md` (Open + In-flight + Resolved) | As bugs surface |
| Resolved bug ledger | `notes/uat_bug_log.md` | When bug moves from queue |
| Known flows registry | `KNOWN_STABLE_FLOWS.md` (top-level, canonical; trust levels) | After every stabilization |
| AI workflow rules | `AI_WORKFLOW.MD` + `CHATGPT_THREAD_RULES.md` | Rare |
| Tactical handoff | `CLAUDE_HANDOFF.md` | After every session |
| Project index | `PROJECT_INDEX.md` | When structure changes |

This is the existing operating system. The Operational Visibility proposal **does not change it**.

### 2.4 Stabilization loops (recap, NOT new)

```
Tester reports friction
        ↓
BETA_FEEDBACK_QUEUE.md (Inbound)
        ↓
Drew triages → STABILIZATION_QUEUE.md (priority bucketed)
                   ↓
Reality Audit #N (Drew + ChatGPT) → finds patterns
                   ↓
Stab #N (Claude implements) → STABILIZATION_DASHBOARD.md (ledger)
                   ↓
CURRENT_PHASE.md narrative + CLAUDE_HANDOFF.md handoff
                   ↓
KNOWN_STABLE_FLOWS.md updated (Drew approves promotion)
```

UAT Lab inserts evidence into the LEFT side of this loop (right at the "tester reports friction" stage) — it does not bypass any existing review gate.

---

## 3. Canonical UAT Workflow (cross-link to `specs/uat_lab_v1.md`)

The full UAT workflow proposal is in `specs/uat_lab_v1.md` — this section is a one-page summary.

| Element | Where to read |
|---|---|
| Flow naming convention `<surface>.<job>.<variant>` | `uat_lab_v1.md` §2.1 |
| v1 in-scope flow set (11 flows) | `uat_lab_v1.md` §2.2 |
| Flow contract shape | `uat_lab_v1.md` §2.3 |
| Screenshot harvest convention | `uat_lab_v1.md` §3 |
| 14-category finding classification (7 Tier A QA + 7 Tier B Founder Experience) | `uat_lab_v1.md` §4 |
| Founder intuition first-class rule | `uat_lab_v1.md` §4.4 |
| UX review export format | `uat_lab_v1.md` §5 |
| Regression workflow | `uat_lab_v1.md` §6 |
| Governance integration matrix | `uat_lab_v1.md` §7 |
| Phase 1-4 rollout sequencing | `uat_lab_v1.md` §8 |
| Locked-in decisions (Phase 1 lead = `songs.triage.desktop`, etc.) | `uat_lab_v1.md` §11 |

**v1 flow coverage (mapped to Drew's commission list):**

| Drew listed | UAT Lab v1 covers | Status |
|---|---|---|
| Homepage | `home.morning-glance.desktop`, `home.morning-glance.iphone` | Phase 2 |
| Song Detail | `song-detail.versions-hub.desktop` | Phase 2 |
| Practice | `practice.pick-one-song.desktop` | Phase 2 |
| Rehearsal | `rehearsal.plan-and-share.desktop` | Phase 2 |
| Rehearsal Review | `rehearsal.review-last.desktop` | Phase 2 |
| Schedule | `schedule.add-gig.iphone` | Deferred to v2 (Drew can promote) |
| Setlists | `setlist.lock-and-share.desktop` | Phase 2 |
| Multitrack Review | `multitrack.review-mode.desktop`, `.isolate-mode.desktop`, `.export-mix.desktop` | Phase 3 |
| Playback | Implicit in song-detail + setlist + multitrack flows | Phase 2-3 |
| Mobile navigation | iPhone variants per flow | Phase 2+ |

---

## 4. Telemetry Recommendations Matrix

The framing of this section is deliberately conservative because:
1. **`CANONICAL_SYSTEMS.md` prohibits new monkey-patches** for instrumentation. Sentry, PostHog, LogRocket all install global error handlers + click/network interceptors. They would violate this rule unless paired with an explicit `getStats()` adapter inside a canonical module.
2. **Contentsquare is already wired** and provides session replay, heatmaps, and frustration detection. Adding a parallel session-replay tool is wasteful.
3. **GrooveLinx is small-scale** — Drew's band + a handful of testers. Enterprise observability tools optimize for thousands of concurrent users; they're the wrong abstraction here.

### 4.1 Matrix

| Tool | What it provides | Already covered by | Recommendation | Reason |
|---|---|---|---|---|
| **Sentry** | Error capture, unhandled promise rejections, source-mapped stack traces, release tracking | `GLFeedbackContext` (window.onerror + onunhandledrejection) + `GLFeedbackService.recordFriction` + `feedback_reports/` in Firebase | **DO NOT ADD** | Duplicates existing capture; adds 2nd governance surface for errors; monkey-patches global handlers (CANONICAL_SYSTEMS prohibition). |
| **PostHog** | Product analytics, funnel analysis, session recording, feature flags | Contentsquare (replay + heatmaps); `GLUXTracker` (rage/dead/hesitation events to Firebase `ux_events/`); `gl_onboarding_stats` localStorage for funnel | **DO NOT ADD in v1** | Overlap with Contentsquare for replay; funnel analysis can be done via Firebase reads against `ux_events/` + `feedback_reports/`. Revisit if scale grows past ~50 active users. |
| **Session replay** (generic) | Watch a session unfold | Already wired — **Contentsquare** | **ALREADY ACTIVE** | Verify Contentsquare quota + retention; no second tool needed. |
| **Rage-click detection** | Identify frustrated users | `GLUXTracker._handleClick` (3+ clicks in 2s) writes to `bands/{slug}/ux_events/rage_click_{ts}` | **ALREADY EXISTS** | Surface via UAT Lab UX Review export §5. |
| **Funnel analysis** | Drop-off between steps | `gl_onboarding_stats` localStorage counters (gateAllowed/gateBlocked/gateError/feedbackSubmitted) + Firebase `ux_events/` | **EXTEND EXISTING** | Add a `funnel-report.js` script (Phase 2 of UAT Lab) that reads from Firebase + outputs a funnel chart. No new external service. |
| **Mobile friction analysis** | Touch-target sizing, scroll friction, viewport issues | UAT Lab iPhone-variant flows (§2.2 of `uat_lab_v1.md`) + `GLUXTracker` | **EXTEND VIA UAT LAB** | Phase 2-3 of UAT Lab covers iPhone variants for every desktop flow that matters on mobile. |
| **Runtime error capture** | window.onerror, unhandled promise | `GLFeedbackContext` (already does this) | **ALREADY EXISTS** | Confirmed in inventory. |
| **Latency tracking** | TTI, FCP, music-surface SLA | Sparse `[PERF]` log lines; no canonical surface | **EXTEND** (build-in, not external) | Add `GLPerf.getStats()` getter to a new canonical module (or extend GLStore) per CANONICAL_SYSTEMS rule. Surface in Runtime Health Overlay. **This is a real gap.** |
| **Workflow coherence signals** | Multi-step workflow completion / abandonment | Partial — `GLUXTracker` `abandoned_flow` event exists but is rarely fired | **EXTEND** | Phase 4 of UAT Lab: define abandonment criteria per flow contract, fire `abandoned_flow` events from canonical modules when contract steps are skipped. |
| **Trust signals** | When system claims don't match reality | UAT Lab Tier B Trust issue category (§4.1 of `uat_lab_v1.md`) | **NEW VIA UAT LAB** | Tier B Trust issue findings are the canonical surface; no external tool. |

### 4.2 Genuine gaps surfaced by this audit

Three real gaps where current visibility is insufficient. None requires a new external service:

1. **App-boot latency.** No canonical TTI / FCP / boot-complete instrumentation. Music-surface SLA is documented (`feedback_music_surface_sla` memory: "<1s") but not measured. **Recommendation:** add a `GLPerf` canonical module (or extend GLStore) with `getStats()` returning `{tti, fcp, bootCompleteAt, musicSurfaceMs[]}`. Surface in Runtime Health Overlay. Estimated effort: 1 small Stab.
2. **Workflow abandonment.** `GLUXTracker.abandoned_flow` event exists but is only fired manually. **Recommendation:** when UAT Lab flow contracts are defined (Phase 2-3 of UAT Lab), the corresponding in-app surfaces can opt-in to firing `abandoned_flow` when a contract's `expectations` are not met within the SLA. Coupled with the contract, not a separate system.
3. **Cross-rehearsal signal.** Multitrack rehearsal data exists per-session but no cross-rehearsal trends (which song improves week-over-week? which tester reports the most friction?). **Recommendation:** **NOT a v1 telemetry concern.** This is product intelligence — belongs in the AI Guidance Layer (Workstream 4) backlog, not the Operational Visibility proposal.

### 4.3 Explicit "do not add" list

To prevent accidental tool sprawl:

- **Sentry** — duplicates `GLFeedbackContext`
- **PostHog** — overlap with Contentsquare + `GLUXTracker`
- **LogRocket / FullStory** — overlap with Contentsquare
- **Datadog / New Relic / Honeycomb** — enterprise-scale, wrong abstraction for a band-sized product
- **Generic "AI ops" autonomous monitoring** — violates anti-goal of UAT Lab v1 ("not chaos-driven autonomous testing")
- **Any tool that monkey-patches `window.onerror`, `addEventListener`, `setInterval`, `setTimeout`, `requestAnimationFrame`, `fetch`, or `XMLHttpRequest` globally** — direct violation of `CANONICAL_SYSTEMS.md`

---

## 5. Canonical Operational Evidence Pipeline

All defined in `uat_lab_v1.md`; one-page summary here.

### 5.1 Storage layout (extends what exists)

```
02_GrooveLinx/
  uat/
    bug_queue.md                    ← existing canonical bug queue
    screenshots/
      YYYY-MM-DD/                   ← date-bucketed (extends today's pattern)
        <flow-slug>/
          <build>/
            01-<step>.png
            02-<step>.png
            _manifest.json          ← machine-readable run record
    regressions/
      YYYY-MM-DD_<flow>_<before>_vs_<after>/
        before/  after/  diff/  report.md  report.json
    exports/
      ux_review_YYYY-MM-DD.json     ← machine-readable companion to specs/ux_review_*.md
  specs/
    ux_review_YYYY-MM-DD.md         ← extends founder_ux_review_2026-05-22.md pattern
    uat_lab_v1.md                   ← THE UAT spec
    operational_visibility_v1.md    ← THIS doc
  00_Governance/                    ← unchanged
  notes/
    uat_bug_log.md                  ← existing resolved-bug ledger
```

### 5.2 Naming conventions

- **Flow slug:** `<surface>.<job>.<variant>` (e.g., `songs.triage.desktop`)
- **Screenshot:** `NN-<step-id>.png` (e.g., `01-songs-loaded.png`)
- **Date:** `YYYY-MM-DD` everywhere
- **Build:** existing `YYYYMMDD-HHMMSS` (matches version.json)
- **Finding ID:** `F-YYYY-MM-DD-NNN` (monotonic per day)
- **Regression artifact:** `YYYY-MM-DD_<flow-slug>_<before-build>_vs_<after-build>/`

### 5.3 Version + issue linkage

Every artifact carries:
- Build stamp (from version.json)
- Flow slug
- Run timestamp
- Findings → if escalated to a GitHub Issue, the issue number is back-linked in the manifest

### 5.4 Retention

- Screenshots: committed to repo today (4 from 2026-05-25 already in `uat/screenshots/2026-05-25/`). Deferred decision: when repo size becomes a real cost, move to git-lfs or external bucket. Not blocking v1.
- Manifests: committed alongside screenshots; small JSON
- Regression artifacts: committed; periodic prune as repo grows (deferred decision)

---

## 6. Governance Integration

This proposal does not write to any governance doc. All artifacts flow through the matrix in `uat_lab_v1.md` §7.2 (which now correctly references all 16 docs in `00_Governance/`).

**Hard rules enforced:**
1. Operational Visibility proposal does NOT modify `CANONICAL_SYSTEMS.md` (Drew authors)
2. Does NOT modify `DATA_OWNERSHIP_RULES.md` (Drew authors)
3. Does NOT modify `AI_WORKFLOW.MD` (extends with Playwright role in this spec — separate from the governance doc)
4. Does NOT create new top-level governance docs
5. Does NOT introduce parallel queues

**What it does write to:**
- `CURRENT_PHASE.md` — release-summary entry per `feedback_release_format`
- `CLAUDE_HANDOFF.md` — session handoff entry
- `PROJECT_INDEX.md` — discoverability pointer
- `uat/bug_queue.md` — findings (via existing pattern)
- `DEFERRED_FINDINGS_QUEUE.md` — findings (via existing 5-category pattern)
- `STABILIZATION_QUEUE.md` — Tier B Founder Experience findings (via existing priority-bucketed pattern)

---

## 7. Deliverables (this proposal)

### 7.1 Operational Visibility assessment
See §1 above. Net: GrooveLinx is **far more instrumented than typical at this scale** thanks to Stab #10 (Runtime Health Overlay), Stab #14 (Stems Persistence), the GLUXTracker + GLFeedbackService combo, and Contentsquare. The visibility gap is not "missing tools" but "disciplined patterns for using what's already there."

### 7.2 AI workflow architecture map
See §2 above. Net: `AI_WORKFLOW.MD` already defines the canonical split; Playwright extends Claude's execution surface without becoming a new governance layer. Cross-doc constraints from `CANONICAL_SYSTEMS.md`, `DATA_OWNERSHIP_RULES.md`, and the `CLAUDE.md` SYSTEM LOCKs are all honored.

### 7.3 UAT Lab v1 proposal
Cross-linked: `specs/uat_lab_v1.md`. Revised 2026-05-25 v2 to correct the governance-doc inventory error and to add the Founder Experience (Tier B) finding categories Drew specified.

### 7.4 Telemetry recommendation matrix
See §4 above. Net: **no new external telemetry tool recommended in v1.** Three internal gaps (`GLPerf` instrumentation, opt-in `abandoned_flow` firing, cross-rehearsal intelligence) get extension recommendations against existing canonical patterns. Explicit "do not add" list covers Sentry/PostHog/LogRocket/etc.

### 7.5 Rollout sequencing

| Phase | Scope | Trigger | Risk |
|---|---|---|---|
| **Phase 0 — Approval (this proposal)** | Drew + ChatGPT read both specs, ratify decisions | NOW | Zero |
| **Phase 1 — UAT Lab v1 Phase 1** | Single flow (`songs.triage.desktop`) + harness skeleton (~150 LOC) | After Drew gives go | Low (1 contract, contained) |
| **Phase 2 — UAT Lab v1 Phase 2** | First wave of 5 flows + UX review export prototype | After Phase 1 acceptance + finding-shape feedback | Low |
| **Phase 3 — `GLPerf` instrumentation gap** | New canonical module behind `getStats()` + Runtime Health Overlay extension | When Drew prioritizes the latency-gap fix | Low (additive) |
| **Phase 4 — UAT Lab v1 Phase 3-4** | Multitrack flows + regression workflow + UX review export | After Phase 2 produces a real finding | Medium (touches multitrack render — coordinate with multitrack work) |
| **Phase 5 — Workflow abandonment opt-in** | Flow contracts opt-in to firing `GLUXTracker.abandoned_flow` events | After Phase 4 lands clean | Low |

### 7.6 Low-risk starting point
**UAT Lab v1 Phase 1 only.** One contract, one flow (`songs.triage.desktop`), bounded to ~150 LOC + screenshot harvest. Acceptance criteria in `uat_lab_v1.md` §8. If anything about the contract shape, manifest shape, or finding routing feels wrong, we discover it on one file — not on ten.

### 7.7 Immediate quick wins (no code required)
1. **Acknowledge `00_Governance/` to all future AI sessions.** Add a one-line pointer in `CLAUDE.md` / `AGENTS.md` so Claude doesn't miss the directory next time. (This proposal commits a `PROJECT_INDEX.md` update for this — see §8.)
2. **Verify Contentsquare quota + retention.** Drew confirms what plan we're on; if free tier is sufficient, no action; if approaching limits, decide tradeoff.
3. **Surface Runtime Health Overlay in Drew's bookmarks.** `Cmd+Shift+H` is the canonical toggle but might be underused. One-line addition to `DEV_WORKFLOW.md`.
4. **Add a `STABILIZATION_QUEUE.md` triage note.** The doc is currently 19 lines of mostly Medium / Nice-to-have UX items. A 1-paragraph header explaining the workflow (per `feedback_bug_queue_workflow`) would help future contributors triage faster.

### 7.8 Convergence risks
1. **GitHub Projects vs markdown queues.** `AI_WORKFLOW.MD` says GitHub Projects is the official task board, but operationally many tracked items live in `uat/bug_queue.md` / `DEFERRED_FINDINGS_QUEUE.md` / `STABILIZATION_QUEUE.md`. If a UAT Lab finding lands in both Firebase `feedback_reports/` and a markdown queue AND a GitHub Issue, that's triple bookkeeping. **Recommendation:** finding intake is in markdown queues + Firebase (machine-readable); when Drew + ChatGPT promote a finding to "actionable work," it becomes a GitHub Issue. Drew confirms this resolution.
2. **Stab numbering ambiguity.** `STABILIZATION_DASHBOARD.md` currently lists Stab #1-14 + Reality Audits + Convergence Initiatives. The CURRENT_PHASE.md narrative also stamps Stab numbers chronologically. Two sources of truth = drift risk. **Recommendation:** STABILIZATION_DASHBOARD.md is the authoritative numbered ledger; CURRENT_PHASE.md narrates but does not introduce new Stab numbers. UAT Lab never assigns Stab numbers (per §7.2 of `uat_lab_v1.md`).
3. **00_Governance vs top-level docs.** `KNOWN_STABLE_FLOWS.md` exists in BOTH `02_GrooveLinx/` (richer) and `02_GrooveLinx/00_Governance/` (stub). Risk of editing the wrong one. **Recommendation:** the top-level version is canonical; the 00_Governance stub should either link to it or be deleted. **Drew calls.**

### 7.9 Operational debt observations
1. **Sparse latency instrumentation.** Music-surface <1s SLA is documented but not measured. Reality Audit #04 (Player/Audio/Playback) closed many architecture issues but didn't add canonical perf surfaces.
2. **`?dev=true` doesn't expose everything dev-relevant.** Runtime Health Overlay surfaces a lot; UX Tracker output is in console only (no overlay panel).
3. **No central "what is the live build doing right now" view.** CURRENT_PHASE.md narrates; STABILIZATION_DASHBOARD.md catalogs; ACTIVE_WORKSTREAMS.md scopes; no single page answers "what is the system actively doing this minute." For founder use only, this might be acceptable; for ChatGPT-as-strategist this might be a gap. **Recommendation:** defer to Drew.
4. **Beta Feedback FAB only fires for explicit testers.** It's not surfaced to the band naturally during real rehearsal use. Trade-off was intentional (per `BETA_FEEDBACK_QUEUE.md`); revisit when Mode-B opens to non-DeadCetera testers.

---

## 8. Open questions for Drew

1. **Convergence risk #1 (3-place bookkeeping)** — confirm the recommended resolution (markdown queues + Firebase = intake; GitHub Issues = actionable work)?
2. **Convergence risk #3 (KNOWN_STABLE_FLOWS duplicate)** — top-level canonical, 00_Governance stub to link or delete?
3. **Quick win #2 (Contentsquare quota)** — what plan are we on?
4. **§7.5 Phase 3 (`GLPerf` instrumentation)** — priority relative to UAT Lab Phase 2? If P0 (because of the existing <1s SLA), ship before UAT Lab Phase 2.
5. **§4.2 gap #3 (cross-rehearsal intelligence)** — confirm this is correctly deferred to Workstream 4 (AI Guidance Layer) rather than treated as an Operational Visibility item?

---

## 9. Sign-off

This document is a proposal. No code, no telemetry tools, no governance file changes shipped by this commit. Approval gate: Drew + (optionally) ChatGPT in its strategic role per `AI_WORKFLOW.MD`.

The `uat_lab_v1.md` proposal is the **first deliverable** of this initiative; Phase 1 of that proposal is the lowest-risk implementation start.

---

## 10. References

- `02_GrooveLinx/00_Governance/ReadMe.md` — governance doc index
- `02_GrooveLinx/00_Governance/AI_WORKFLOW.MD` — canonical ChatGPT/Claude/GitHub split
- `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md` — canonical owners + prohibited patterns
- `02_GrooveLinx/00_Governance/DATA_OWNERSHIP_RULES.md` — Tier 1/2/3 data ownership
- `02_GrooveLinx/00_Governance/CURRENT_PRIORITIES.md` — P0/P1/P2/P3
- `02_GrooveLinx/00_Governance/ACTIVE_WORKSTREAMS.md` — 6 workstreams
- `02_GrooveLinx/00_Governance/STABILIZATION_QUEUE.md` — tester-priority queue
- `02_GrooveLinx/00_Governance/STABILIZATION_DASHBOARD.md` — Stab #N completion ledger
- `02_GrooveLinx/00_Governance/ARCHITECTURE_DECISIONS.md` — durable decisions
- `02_GrooveLinx/specs/uat_lab_v1.md` — UAT Lab v1 proposal (companion)
- `02_GrooveLinx/specs/founder_ux_review_2026-05-22.md` — UX review pattern UAT Lab extends
- `02_GrooveLinx/specs/groovelinx-ui-principles.md` — Band Command Center, One Job Per Screen, <1s SLA
- `02_GrooveLinx/CURRENT_PHASE.md` — what's live now
- `02_GrooveLinx/CLAUDE_HANDOFF.md` — tactical handoff
- `02_GrooveLinx/uat/bug_queue.md` — canonical bug queue
- `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` — 5-category finding queue
- `02_GrooveLinx/BETA_FEEDBACK_QUEUE.md` — tester feedback intake
- `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` (top-level, canonical) — flow trust registry
- Memory `reference_playwright_mcp_limits` — Playwright Chromium limitations
- Memory `feedback_bug_queue_workflow` — bug intake/close discipline
- Memory `feedback_music_surface_sla` — <1s music surface SLA
- Memory `feedback_ground_truth_over_theater` — evidence-driven UX expectations
- Memory `feedback_layered_ia_no_deletes` — never prune by low page-views
- `CLAUDE.md` / `AGENTS.md` — project guidance, SYSTEM LOCKs
