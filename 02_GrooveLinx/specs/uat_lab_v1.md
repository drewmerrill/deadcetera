# GrooveLinx UAT Lab v1 — Proposal + Implementation Plan

_Authored 2026-05-25, revised 2026-05-25 (post-feedback) — entering the **GrooveLinx Product Operations** phase. Status: **proposal awaiting Drew approval**; nothing in this spec is implemented yet (no `tests/` files added, no harness scripts, no new queues). The goal is to formalize a disciplined, AI-assisted UAT operating system that extends existing GrooveLinx operational infrastructure — not a parallel governance layer._

> **🔧 Errata note (2026-05-25 v2).** The v1 draft of this proposal claimed two named docs did not exist (`STABILIZATION_QUEUE.md`, `ACTIVE_WORKSTREAMS.md`). They both exist in `02_GrooveLinx/00_Governance/` — a directory the original inventory missed entirely. All claims about missing docs in §0 / §7 / §11.1 of the v1 draft are corrected below. Drew also locked in directional decisions: §11.1 = Option A (extend existing patterns), §11.2 = Phase 1 lead flow is `songs.triage.desktop`, §11.4 = no autonomous `KNOWN_STABLE_FLOWS` promotion (Claude recommends + attaches evidence; founder approves). Plus an explicit Founder Experience layer (§4.5) was added.

> **Anti-goal.** This is NOT chaos-driven autonomous testing. The v1 perimeter is **deterministic scripted flows + screenshot harvesting + structured findings + stable operational loops**. Broad autonomous exploration is explicitly out of scope until v2.

> **What this is FOR + what this is NOT FOR** (verbatim per Drew, 2026-05-25):
>
> _UAT Lab exists to improve:_
> - _workflow trust_
> - _product coherence_
> - _navigation clarity_
> - _operational stability_
>
> _UAT Lab does NOT exist to:_
> - _maximize automation_
> - _maximize testing breadth_
> - _replace founder intuition_
>
> _Founder intuition remains a first-class input. Playwright + screenshots + telemetry **support** product judgment. They **do not replace** it._

---

## 0. Critical framing — what's in the repo today

Before proposing anything new, here's the existing infrastructure this spec must extend (NOT replace):

### Existing testing infrastructure
- **`playwright.config.js`** — `desktop` + `iphone` projects, `baseURL: http://localhost:8000`, webServer starts `python3 -m http.server 8000` automatically. Reporter `list`, retries 1, timeout 30000, `screenshot: 'only-on-failure'`.
- **`.mcp.json`** — two MCP servers wired at project scope: `playwright` (Playwright MCP, in-session browser control) + `groovelinx-firebase` (read access via service account at `~/.config/groovelinx/firebase-service-account.json`, restricted to `deadcetera` slug).
- **`tests/` directory** — 8 spec files already present:
  - `core-flows.spec.js` — Onboarding / Rehearsal / Reveal happy paths
  - `never-blank.spec.js` — every page renders non-empty content
  - `product-integrity.spec.js` — invariants
  - `first-rehearsal.spec.js` — new-user rehearsal creation
  - `burn-in.spec.js` + `burn-in.config.js` + `burn-in-analyze.js` — long-running stress
  - `chaos.spec.js` — adversarial sequences
  - `helpers.js` — shared utilities + canonical readiness flags
  - `calibration/` — golden-fixture data
- **`tests/helpers.js` patterns** (already deterministic — DO NOT REINVENT):
  - `signIn(page, band)` — localStorage-based: sets `deadcetera_google_email` + `deadcetera_current_band`, reloads, waits for `GL_APP_READY`
  - `waitForBootReady(page)` — gates on `window.GL_APP_READY === true` (30s timeout)
  - `navigateAndWait(page, pageId)` — `showPage(pageId)` + gates on `window.GL_PAGE_READY === pageId` (and `GL_REHEARSAL_READY` for the heavy rehearsal page)
  - `waitForGlobal(page, name, methods)` — waits for a global JS object + named methods
- **`package.json` scripts:** `test`, `test:desktop`, `test:mobile`, `test:headed`, `test:browserstack` (BrowserStack config also present).

### Existing runtime affordances (the app already exposes test/debug surfaces)
- **`GL_APP_READY`** — set by GLStore when firebase + songs + members resolve
- **`GL_PAGE_READY = <pageId>`** — set by `navigation.js` after a page renderer completes (with `_navSeq` stale-render guard per `CLAUDE.md` SYSTEM LOCK)
- **`GL_REHEARSAL_READY`** — set by `rehearsal.js` after the full command-flow renders
- **`GLRuntimeHealth.show()`** — runtime overlay, toggle via `Ctrl/Cmd+Shift+H`
- **`gl_product_mode`** localStorage + **🌿 Mode button** — mode switcher (per `js/features/stoner-mode.js`)
- **Beta feedback FAB** — `?beta=true` query, `localStorage.gl_beta_feedback === '1'`, or `GLBetaFeedback.show()`; captures bug/confusion/playback/rehearsal/onboarding/mobile/performance/suggestion
- **`GLFeedbackService.submitExplicit()`** + **`recordFriction()`** — programmatic feedback intake
- **`?beta=true`** query enables the beta surface generally
- **Direct Firebase RTDB reads** via the open `bands/.read: true` rule work fine for inspection scripts (no Firebase Auth required — see memory `reference_playwright_mcp_limits`)

### Existing governance docs (`02_GrooveLinx/00_Governance/` — 16 docs, **all already in the repo**)
Corrects the v1 draft which incorrectly claimed `STABILIZATION_QUEUE.md` and `ACTIVE_WORKSTREAMS.md` were missing. They exist — here's the full set:

| Doc | Role | Update cadence |
|---|---|---|
| `ReadMe.md` | Index defining each gov doc's purpose | Rare |
| `AI_WORKFLOW.MD` | **Canonical AI-roles definition** — ChatGPT (strategy/architecture/review/sequencing), Claude (implementation/refactors/repo ops), GitHub Projects (execution tracking), Governance docs (continuity). 6-phase Idea→Spec→Ready→Build→Review→Ship. UAT Lab MUST honor this split. | Rare |
| `CHATGPT_THREAD_RULES.md` | Thread-hygiene rules (1 thread = 1 purpose; chat types: Drew Command Center / Strategy / Tactical Build / Scratchpad) | Rare |
| `ARCHITECTURE_DECISIONS.md` | Durable architectural decisions (state mgmt direction, mobile perf, Spotify "reliability > polish", AI workflow direction) | When architecture changes |
| `CURRENT_STATE.md` | What GrooveLinx currently is (platform snapshot) | When capabilities materially change |
| `CURRENT_PRIORITIES.md` | P0/P1/P2/P3 (currently P0 = Spotify Reliability) | When priorities shift |
| `ACTIVE_WORKSTREAMS.md` | 6 workstreams: Spotify Reliability / Rehearsal Intelligence / Mobile Performance / AI Guidance / Scheduling Intelligence / Product Simplification | When workstreams begin/end |
| `CANONICAL_SYSTEMS.md` | Canonical owners + permitted/prohibited patterns. **CRITICAL for UAT Lab:** explicit prohibition on "adding new monkey-patches of global browser APIs for instrumentation purposes. New observability metrics belong inside existing canonical modules behind a `getStats()` getter." | When new canonical owner declared |
| `DATA_OWNERSHIP_RULES.md` | Tier 1/2/3 data ownership: every write must route through canonical owners (GLStore.RehearsalSession, GLBandFeedStore, saveBandArrayDataSafe, etc.). **UAT Lab findings must follow this rule** — writes go through `GLFeedbackService.submitExplicit()` to `bands/{slug}/feedback_reports/{reportId}`. | When new domain added |
| `KNOWN_STABLE_FLOWS.md` (in 00_Governance) | Short stub list (Rehearsal create/save, Setlist playback, Song Detail chart, Harmony playback, Spotify connect, Calendar sync, Pocket Meter, Live Gig, Feed updates) marked Stable/Experimental/Needs verification/iPhone risky. The richer top-level `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` is the canonical version. | After every stabilization fix |
| `KNOWN_TECHNICAL_DEBT.md` | Acknowledged technical debt | When discovered/resolved |
| `STABILIZATION_DASHBOARD.md` | **Stab #N completion ledger + Reality Audits + Convergence Initiatives** (currently at Stab #14, Reality Audits #01-09, Convergence Initiatives C1-C6) | After every Stab ship |
| `STABILIZATION_QUEUE.md` | Tester-feedback priority queue: Critical / High / Medium / Nice-to-have (currently mostly Medium + Nice-to-have UX observations) | After every Drew triage pass |
| `BETA_READINESS_CHECKLIST.md` | Beta launch readiness | When beta posture changes |
| `LAUNCH_BLOCKERS.md` | Active launch blockers | When discovered/resolved |
| `LAUNCH_READINESS.md` | Launch readiness scoring | When readiness changes |

**Why this matters for UAT Lab:**
1. **CANONICAL_SYSTEMS.md prohibits new monkey-patched instrumentation** → UAT Lab findings flow through existing surfaces (`GLFeedbackService`, `GLUXTracker`, `GLRuntimeHealth` snapshots), not new global handlers.
2. **DATA_OWNERSHIP_RULES.md mandates canonical-owner writes** → UAT Lab finding storage uses the existing `bands/{slug}/feedback_reports/{reportId}` path via `GLFeedbackService.submitExplicit()`.
3. **AI_WORKFLOW.MD defines the AI-roles split** → UAT Lab is a Claude-executed system; specifications + sequencing decisions remain ChatGPT/Drew. UAT findings inform strategy but don't make strategy.
4. **STABILIZATION_QUEUE.md is the tester-friction triage surface** (not a Stab #N registry) → UAT Lab user-facing UX findings land here under the appropriate priority bucket.
5. **STABILIZATION_DASHBOARD.md is the Stab #N completion ledger** → Stab #N fixes triggered by UAT Lab findings get stamped here when shipped.
6. **ACTIVE_WORKSTREAMS.md is the workstream registry** → UAT Lab itself is part of "Workstream 6 — Product Simplification" (no new workstream needed).

### Existing UAT / operational documentation
- **`02_GrooveLinx/uat/bug_queue.md`** — canonical open bug queue (open + in-flight + resolved sections, severity column, ~545 lines)
- **`02_GrooveLinx/uat/screenshots/`** — screenshot evidence, organized by date (`2026-05-25/` started by the multitrack UAT pass)
- **`02_GrooveLinx/notes/uat_bug_log.md`** — resolved-bug ledger (long-form context preserved per fix)
- **`02_GrooveLinx/notes/uat_master_checklist.md`** — manual checklist patterns
- **`02_GrooveLinx/notes/smoke_test_plan.md`** — smoke patterns
- **`02_GrooveLinx/KNOWN_STABLE_FLOWS.md`** — canonical user-facing flow registry by trust level (Stable / Experimental / Needs iPhone verification / Known issue). Updated on every stabilization fix. **THIS IS THE EXISTING HOME FOR CANONICAL FLOW NAMING.**
- **`02_GrooveLinx/BETA_FEEDBACK_QUEUE.md`** — 4-stage workflow (Inbound → Triage → In-flight → Closed), 8 categories, in-app FAB + manual paths
- **`02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md`** — 5 categories already: Stabilization Debt / UX Coherence Debt / Architecture Convergence Debt / Beta Observation Candidates / Intentional Non-Fixes
- **`02_GrooveLinx/CURRENT_PHASE.md`** — top entry = active phase narrative; `Stab #N` fixes are stamped chronologically here
- **`02_GrooveLinx/CLAUDE_HANDOFF.md`** — cumulative session history + restart prompts
- **`02_GrooveLinx/specs/founder_ux_review_2026-05-22.md`** — existing UX synthesis pattern (page-by-page drift assessment + page thesis statements + 4-phase sequencing)
- **`02_GrooveLinx/specs/groovelinx-stabilization-audit.md`** — Stab-pattern origin doc
- **`02_GrooveLinx/specs/groovelinx-ui-principles.md`** — Band Command Center 3-pane, One Job Per Screen, <1s SLA, layered IA, no new destinations
- **`02_GrooveLinx/specs/groovelinx-wave3-smoke-test.md`** — wave-cut smoke patterns
- **`02_GrooveLinx/PROJECT_INDEX.md`** — repo high-level map; UAT Lab spec must register here

### Production URLs + auth surface
- **Production:** `https://app.groovelinx.com` (Vercel auto-deploys on push to `main`)
- **Local:** `http://localhost:8000` (Python http.server started by `playwright.config.js` webServer)
- **Dev shell:** `https://app.groovelinx.com/index-dev.html` (generated from `index.html` via `scripts/generate-dev-html.js` — never edit directly per memory `feedback_index_dev_generated`)
- **Auth bypass for tests:** the `helpers.js` `signIn(page, band)` pattern stamps `localStorage.deadcetera_google_email` + `deadcetera_current_band` and reloads — **no real Google OAuth required for E2E tests** because the app routes auth through `GLStore.isReady('firebase')` + `_glCheckBandMembership` (which honors the localStorage email). Firebase RTDB reads use the open `bands/.read: true` rule.
- **Auth in Playwright MCP (interactive sessions):** does require real OAuth — see `reference_playwright_mcp_limits` memory for the recipe.

### Doc-name reality check — CORRECTED 2026-05-25 v2
The v1 draft claimed two docs were missing. **They both exist in `02_GrooveLinx/00_Governance/`** (see the table above). My v1 inventory only checked the top level of `02_GrooveLinx/` and missed the governance subdirectory entirely. Inventory now includes the full set. UAT Lab integrates directly with the existing docs — no new governance files proposed, no Option A/B alternatives needed.

---

## 1. Proposed name + thesis

**Name:** **GrooveLinx UAT Lab v1**

**Thesis:** _A repeatable, evidence-driven loop where Claude drives deterministic Playwright flows against the live app, harvests timestamped screenshots, classifies findings into existing GrooveLinx queues, and produces structured exports that make external UX review fast and grounded._

**Three north-star properties:**
1. **Disciplined.** Every UAT run is a named flow with a stable identifier; results land in existing queues with stable shapes.
2. **Evidence-driven.** No finding is filed without (a) a screenshot or measurable artifact, (b) a stable repro path, (c) a build stamp.
3. **Founder-time-respecting.** Reduces what Drew has to click through manually. A UAT run that takes Drew 20 min interactively should take Claude 2 min unattended + 5 min Drew-review.

---

## 2. Canonical UAT flow structure

UAT flows are the unit of work. Each flow has a stable slug, a screen-by-screen contract, a viewport matrix, and a finding routing rule. Flow names mirror the page taxonomy from `KNOWN_STABLE_FLOWS.md` and `groovelinx-ui-principles.md`.

### 2.1 Flow naming convention

`<surface>.<job>.<variant>` — kebab-case, three segments, stable across runs.

Examples:
- `home.morning-glance.desktop`
- `home.morning-glance.iphone`
- `song-detail.versions-hub.desktop`
- `practice.pick-one-song.desktop`
- `rehearsal.review-last.desktop`
- `setlist.lock-and-share.desktop`
- `multitrack.review-mode.desktop`
- `multitrack.isolate-mode.desktop`
- `multitrack.export-mix.desktop`
- `schedule.add-gig.iphone`

**Rule:** A flow name maps to **one** entry in `KNOWN_STABLE_FLOWS.md`. New flows must be added to that doc with their trust level before the UAT script can be merged. This prevents the UAT Lab from growing a parallel flow registry.

### 2.2 v1 in-scope flow set

The first wave deliberately mirrors `KNOWN_STABLE_FLOWS.md` + the operational pages from `founder_ux_review_2026-05-22.md`:

| Flow slug | Maps to KNOWN_STABLE_FLOWS section | Why first |
|---|---|---|
| `home.morning-glance.desktop` | (add) Home dashboard | Highest-traffic launchpad, drift-prone per founder review |
| `home.morning-glance.iphone` | (add) Home dashboard | Mobile is the working surface for the band |
| `songs.triage.desktop` | (add) Songs page | HIGH-drift page per founder review |
| `song-detail.versions-hub.desktop` | Playback flows · Song Detail | Anchors the Versions/North Star/Chart/Stems system |
| `practice.pick-one-song.desktop` | (add) Practice | Stays simple — regression-detection canary |
| `rehearsal.review-last.desktop` | (add) Rehearsal | Where multitrack review lives |
| `rehearsal.plan-and-share.desktop` | (add) Rehearsal | Founder-review hero |
| `setlist.lock-and-share.desktop` | SetlistPlayer | Critical path for gigs |
| `multitrack.review-mode.desktop` | (add) Multitrack | Just verified — protect from regression |
| `multitrack.isolate-mode.desktop` | (add) Multitrack | Bug #18 surfaced here |
| `multitrack.export-mix.desktop` | (add) Multitrack | Bug #19 surfaced here |

Out of v1 scope (queued for v2):
- Live Gig Mode (`live-gig.full-screen.iphone`) — needs gesture sim
- Stage Plot share URL
- Harmony Lab full mixer
- Spotify SDK paths (blocked by Playwright Widevine — see `reference_playwright_mcp_limits`)

### 2.3 Flow contract shape (what every flow specifies)

Every flow file in `tests/uat-lab/` declares:

```js
// tests/uat-lab/home.morning-glance.desktop.spec.js
module.exports = {
  slug: 'home.morning-glance.desktop',
  knownStableFlow: 'Home dashboard',  // matches KNOWN_STABLE_FLOWS.md heading
  viewport: 'desktop',                 // desktop | iphone | ipad
  band: 'deadcetera',
  steps: [
    { id: 'boot',  action: 'goto', url: '/' },
    { id: 'signin', action: 'signIn' },
    { id: 'home-loaded', waitFor: () => window.GL_PAGE_READY === 'home' },
    { id: 'home-shot',  screenshot: { name: '01-home-loaded', fullPage: false } },
    { id: 'expand-activity', click: '[data-testid="activity-feed-toggle"]' },
    { id: 'activity-shot',   screenshot: { name: '02-activity-expanded', fullPage: false } },
  ],
  expectations: [
    { id: 'no-console-errors',  assert: 'console.errors.length === 0' },
    { id: 'no-blank-region',    assert: 'document.body.innerText.length > 200' },
    { id: 'sla-tti',            measure: 'GL_APP_READY_AT_MS', max: 1000 },
  ],
  routing: {
    // Where do findings from this flow land?
    bug: '02_GrooveLinx/uat/bug_queue.md',          // OPEN section, severity from rules
    uxIssue: '02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md',  // section 2 UX Coherence Debt
    regression: '02_GrooveLinx/uat/bug_queue.md',   // tagged as REGRESSION in title
  },
};
```

The spec file itself is a thin Playwright test that consumes the contract via a shared runner (see §8 implementation sequence). The contract is the artifact of record; the spec file is generated boilerplate.

---

## 3. Screenshot harvesting workflow

### 3.1 Storage convention

```
02_GrooveLinx/uat/screenshots/
  YYYY-MM-DD/                              ← date-bucketed (already started today)
    <flow-slug>/                           ← per-flow subfolder
      <build>/                             ← build stamp (e.g. 20260524-193407)
        01-<step-id>.png
        02-<step-id>.png
        ...
        _manifest.json                     ← machine-readable run metadata
```

Example:
```
02_GrooveLinx/uat/screenshots/2026-05-26/
  multitrack.review-mode.desktop/
    20260526-090000/
      01-modal-opened.png
      02-segments-panel.png
      03-row-expanded.png
      _manifest.json
```

The `_manifest.json` captures everything needed for diffing + later analysis:

```json
{
  "flow": "multitrack.review-mode.desktop",
  "build": "20260526-090000",
  "ranAt": "2026-05-26T09:00:00.000Z",
  "viewport": "desktop",
  "viewportPx": { "width": 1280, "height": 720 },
  "band": "deadcetera",
  "appUrl": "http://localhost:8000",
  "steps": [
    { "id": "modal-opened", "screenshot": "01-modal-opened.png", "elapsedMs": 1240 },
    { "id": "segments-panel", "screenshot": "02-segments-panel.png", "elapsedMs": 1810 }
  ],
  "expectations": [
    { "id": "no-console-errors", "result": "pass" },
    { "id": "no-blank-region", "result": "pass" }
  ],
  "findings": [],
  "consoleErrors": [],
  "consoleWarnings": []
}
```

### 3.2 Viewport matrix

Three canonical viewports (matches Playwright config + Drew's device reality):

| Label | Width × Height | Source |
|---|---|---|
| `desktop` | 1280 × 720 | Playwright `devices['Desktop Chrome']` |
| `iphone` | 390 × 844 | Playwright `devices['iPhone 14']` (already configured) |
| `ipad` | 820 × 1180 | Playwright `devices['iPad (gen 7)']` (add when needed — not v1) |

iPad is out of v1 scope. Add it only when a flow specifies a tablet variant.

### 3.3 Stable screenshot names

- **Two-digit prefix** + **step ID kebab-case** — sorts naturally, easy diff
- **No timestamps in filenames** — date is in folder path; build is in folder path; `_manifest.json` carries the per-step elapsed ms
- **`fullPage: false` is default** — viewport-only screenshots are diffable; full-page screenshots fragment by content height

---

## 4. Finding classification

Findings are classified at intake by the UAT Lab runner. Each finding has exactly one **category** and is routed to **exactly one existing queue** — no new queues created.

### 4.1 Canonical categories + routing rule

GrooveLinx is not generic productivity software — it succeeds or fails on **trust, musical momentum, confidence, clarity, emotional coherence, and workflow intuition**. The category set is therefore explicitly bigger than technical QA. Two tiers:

**Tier A — Technical QA categories (7):**

| Category | Definition | Lands in | Severity guidance |
|---|---|---|---|
| **Bug** | Concrete behavior broken (error, wrong result, crash, silent fail) | `uat/bug_queue.md` → Open section | HIGH if blocks a critical flow; MED if recoverable; LOW if cosmetic |
| **UX Issue** | Behavior is "correct" but confusing, mistitled, mis-hierarchized, or trust-eroding | `DEFERRED_FINDINGS_QUEUE.md` § 2 UX Coherence Debt | n/a |
| **Stabilization** | Listener lifecycle, race, orphan, dead listener, broken fallback — survives across builds | `DEFERRED_FINDINGS_QUEUE.md` § 1 Stabilization Debt; promoted to `Stab #N` in `STABILIZATION_DASHBOARD.md` + `CURRENT_PHASE.md` when fixed | n/a |
| **Architecture Drift** | Symbol drift, duplicate render pipeline, parallel governance, broken abstraction boundary | `DEFERRED_FINDINGS_QUEUE.md` § 3 Architecture Convergence Debt | n/a |
| **Regression** | A previously-verified flow now fails | `uat/bug_queue.md` → Open section, title prefixed `REGRESSION:` | HIGH by default |
| **Performance** | SLA violation (e.g., music-use surface > 1s, far-seek > 1s, render > 5min) | `uat/bug_queue.md` → Open section if blocking; otherwise `DEFERRED_FINDINGS_QUEUE.md` § 1 | MED unless gating a real user task |
| **Trust/Clarity** | Confidence chip wrong, naming auto-asserted at low conf, system-state UI doesn't match real state | `DEFERRED_FINDINGS_QUEUE.md` § 2 UX Coherence Debt; tag `[trust]` | n/a |

**Tier B — Founder Experience / Emotional UX categories (7, NEW per Drew 2026-05-25):**

| Category | Definition | Lands in | Examples from existing GrooveLinx context |
|---|---|---|---|
| **Trust issue** | A user-facing claim, badge, or signal does not match reality (or feels uncertain when it shouldn't) | `STABILIZATION_QUEUE.md` (priority bucket per impact) + `DEFERRED_FINDINGS_QUEUE.md` § 2 with `[trust]` tag | "47/63 songs locked" but actually 46. "Loading..." sentinel persists. Confidence chip color doesn't match data. Auto-asserted titles below 0.75. |
| **Cognitive overload** | Too many panels / CTAs / decisions visible at once for the canonical job of the page | `STABILIZATION_QUEUE.md` Medium → Nice-to-have + `DEFERRED_FINDINGS_QUEUE.md` § 2 | Homepage rendering 13-15 panels (per `founder_ux_review_2026-05-22.md`). Schedule tab with 4 competing buttons. |
| **Navigation confusion** | User cannot answer "what now?" or "how do I get back?" in <2 seconds | `STABILIZATION_QUEUE.md` + `DEFERRED_FINDINGS_QUEUE.md` § 2 | Versions tab buried under tab → tab → tab. Right rail Play tab too narrow to be useful. |
| **Musical context loss** | The band's musical reality (current readiness, BPM, key, recent rehearsal) is not visible when the user needs it | `DEFERRED_FINDINGS_QUEUE.md` § 2 | Song Detail tab not showing "where everyone is" without scrolling. Rehearsal review not linking back to the song's prep state. |
| **Emotional friction** | Workflow makes the user feel uncertain, ignored, or like the system is fighting them | `STABILIZATION_QUEUE.md` (often High priority) + `DEFERRED_FINDINGS_QUEUE.md` § 2 | "Schedule" + "Schedule rehearsal" + "Block" buttons all near each other with unclear differences. Onboarding stalls that don't recover. |
| **Recommendation confusion** | Suggested action / focus song / next step does not justify itself | `DEFERRED_FINDINGS_QUEUE.md` § 2 (link to AI Guidance workstream) | Focus engine top-5 picks not explained. "Quick practice →" CTA without showing what it'll practice. GrooveMate suggestions lacking source citation. |
| **Workflow momentum break** | A flow that should be one continuous gesture requires the user to back out and re-enter | `DEFERRED_FINDINGS_QUEUE.md` § 2 + `STABILIZATION_QUEUE.md` if blocking | "back out and re-enter" pattern from founder review §1. Song Detail → Versions → realize you wanted Chart → back → tab swap. Setlist mid-edit interrupted by overlay close. |

**De-dupe + routing rule (applies to both tiers):** A finding with the same `flow + category + title` as an existing open queue entry is appended as a "seen again on build X" stamp inside the existing entry — NOT filed as a new entry. Tier B findings additionally try to attach to the matching workstream from `ACTIVE_WORKSTREAMS.md` (e.g., "Recommendation confusion" findings ping Workstream 4 — AI Guidance Layer).

### 4.2 Required finding fields (machine + human readable)

Every finding emitted by the UAT Lab runner has:

```yaml
finding:
  id: F-2026-05-26-001         # YYYY-MM-DD-NNN, monotonic per day
  flow: multitrack.export-mix.desktop
  build: 20260524-193407
  category: Bug                # one of the 7 canonical categories
  severity: HIGH               # only for Bug / Regression / Performance
  title: Export Mix /render/check 502 silently abandons poll
  observed: |
    After 150s of "⏳ Rendering (Ns)…" the button reverted to "📤 Export" with
    no download surfaced. Console: 502 on /multitrack/render/check, body
    starts "modal-http..." → frontend SyntaxError on .json() → poll abandoned.
  evidence:
    screenshots:
      - 02_GrooveLinx/uat/screenshots/2026-05-25/multitrack.export-mix.desktop/20260524-193407/04-button-reverted.png
    consoleErrors:
      - "Failed to load resource: status 502 (...) @ /multitrack/render/check"
      - "SyntaxError: Unexpected token 'm', \"modal-http\"..."
    network:
      - { url: "/multitrack/render/check", status: 502, durationMs: 1234 }
    measurements:
      - { name: "first-poll-failure-elapsed-ms", value: 23000 }
  repro:
    - Open multitrack rehearsal review on rsess_mt_mpju4yyn_7pko
    - Click 📤 Export → pick mp3
    - Observe live timer for ~150s
  routes:
    queue: 02_GrooveLinx/uat/bug_queue.md
    section: Open
    bugNumber: 19              # assigned by runner from next-free
  links:
    relatedMemory: project_multitrack_seek_sync_bug
    relatedSpec: specs/multitrack_render_deploy_runbook.md
```

Findings are also appended (one-line) to the run's `_manifest.json` so the manifest is the canonical run record.

### 4.3 De-dupe rule

(See "De-dupe + routing rule" inline at end of §4.1.)

### 4.4 Founder intuition stays first-class

Per Drew 2026-05-25: _"Founder intuition remains a first-class input. Playwright + screenshots + telemetry **support** product judgment. They **do not replace** it."_ Practically:

- **Claude does not file Tier B findings autonomously without screenshot + flow context.** A Tier B finding requires the visual evidence + a 1-line description of the specific reproducible step where the friction was observed. No "the homepage feels overloaded" without saying which panel + which step.
- **Tier B findings are recommendations, not bug reports.** The queue note explicitly says `(UAT Lab recommendation — founder review needed)` until Drew triages.
- **Drew can dismiss any Tier B finding with one line.** `Status: dismissed — founder calls this correct/intentional` is a valid resolution that requires no further investigation.
- **Disagreement is signal.** If Claude flags a Trust issue Drew dismisses, the dismissal context goes into the finding's evidence trail so the same finding doesn't recur. Memory `feedback_layered_ia_no_deletes` reminds us: low usage of a feature is NOT evidence that the feature should be removed.

### 4.5 Founder Experience review cadence

In addition to per-flow finding intake (§4.1), the UAT Lab supports a **structured Founder Experience review** that runs against a multi-flow snapshot:

- Cadence: weekly (during high-velocity phases) → monthly (during stabilization phases)
- Output: `specs/ux_review_YYYY-MM-DD.md` (see §5)
- Format: structured snapshot across the v1 flow set with Tier B categories scored 1-5 per flow
- Anchored to existing UI principles: `specs/groovelinx-ui-principles.md` (3-pane Band Command Center, One Job Per Screen, <1s music-surface SLA, layered IA, no new destinations) + the existing `founder_ux_review_2026-05-22.md` synthesis pattern
- Reviewed jointly: Claude assembles evidence + recommendations; Drew (and optionally ChatGPT acting in its strategic role per `AI_WORKFLOW.MD`) decides priority + sequencing

---

## 5. UX review export format

Goal: produce an artifact Drew (or an external UX reviewer) can read in 5 minutes and use to make design decisions. Extends the existing `specs/founder_ux_review_*.md` pattern.

### 5.1 Export file shape

`02_GrooveLinx/specs/ux_review_YYYY-MM-DD.md` — one file per review session. Sections:

```markdown
# UX Review — YYYY-MM-DD (build XXXXXXXX-XXXXXX)

## 0. Scope
- Flows reviewed: [list of slugs]
- Viewports: desktop, iphone
- Reviewer: <name or "self">

## 1. Cognitive load assessment (one row per flow)
| Flow | # panels above fold | # primary CTAs above fold | Drift level (LOW/MED/HIGH) | Score 1-5 |

## 2. Trust observations
| Flow | Trust signal | Status | Evidence |
| home.morning-glance.desktop | "47/63 songs locked" badge | Solid green, matches data | screenshot 01 |
| multitrack.review-mode.desktop | Confidence chips on segment rows | Solid colors, no tint | screenshot 02 |

## 3. Emotional coherence
- What does the page feel like? (e.g., "rehearsal review", not "AI debug console")
- Anchors in `feedback_rehearsal_review_centric` memory + similar.

## 4. Hierarchy problems
- Pages where the most-important action is not the most visible.

## 5. Navigation friction
- Required clicks to complete each canonical job. Compare to spec.

## 6. Workflow confusion
- Steps where a user would reasonably ask "what now?"

## 7. Top 5 recommended changes (with severity + scope)

## 8. Screenshots
- Embedded thumbnails with captions, linked to full-res in /uat/screenshots/
```

### 5.2 Companion machine export

`02_GrooveLinx/uat/exports/ux_review_YYYY-MM-DD.json` — same content as the markdown but structured for tooling. Tools that consume this:
- `scripts/uat-lab/render-review.js` — generate the markdown from the JSON
- (future) external review tools

---

## 6. Regression workflow

### 6.1 Before/after structure

A regression check is a flow run at two builds. Output:

```
02_GrooveLinx/uat/regressions/
  YYYY-MM-DD_<flow-slug>_<before-build>_vs_<after-build>/
    before/                ← copy of before-build screenshots
    after/                 ← copy of after-build screenshots
    diff/                  ← image-diff PNGs (per-step)
    report.md              ← human-readable summary
    report.json            ← machine-readable
```

### 6.2 Diff strategy

- **Pixel diff (default v1):** use `pixelmatch` (already a Playwright peer dep) for per-step PNG diffs. Output a 3-up image: before, after, diff-mask.
- **Threshold:** `0.1` (10% pixel delta = flagged). Tunable per flow.
- **Excluded regions:** specific selectors can be masked (e.g., live activity feed timestamps).

### 6.3 Replayable flows

The same contract (§2.3) runs against:
- `--build current` — current local/live build
- `--build origin/main~N` — checks out, runs, restores
- `--build <tag>` — specific git tag

Replayability is what makes the contract format stable (§2.3) — the spec file is generated, the contract is portable.

### 6.4 Stable naming

Regression artifacts are immutable once produced. The directory name is the artifact ID; never rewritten. Failed regressions become Bug findings (§4) with the regression directory linked in `evidence`.

---

## 7. Operational governance integration

This is where "do NOT invent a parallel governance system" gets enforced. Every UAT Lab artifact has exactly one home in the existing doc tree.

### 7.1 Routing matrix

| UAT Lab artifact | Existing doc/queue it lands in | Why |
|---|---|---|
| New flow slug | Add a row in `KNOWN_STABLE_FLOWS.md` first (with trust level) | Single source of truth for flow registry |
| Bug finding | `uat/bug_queue.md` → Open section | Existing canonical bug queue |
| Resolved bug | Drew (or Claude on his behalf) moves to `notes/uat_bug_log.md` per `feedback_bug_queue_workflow` | Existing ledger pattern |
| UX Issue finding | `DEFERRED_FINDINGS_QUEUE.md` § 2 UX Coherence Debt | Existing 5-category queue |
| Stabilization finding | `DEFERRED_FINDINGS_QUEUE.md` § 1 Stabilization Debt; promoted to `Stab #N` entry in `CURRENT_PHASE.md` when fixed | Existing Stab pattern |
| Architecture Drift | `DEFERRED_FINDINGS_QUEUE.md` § 3 | Existing |
| Regression | `uat/bug_queue.md` (title `REGRESSION:`) + regression artifact under `uat/regressions/` | Same Bug queue, separate evidence dir |
| Performance | `uat/bug_queue.md` (if blocking) or `DEFERRED_FINDINGS_QUEUE.md` § 1 | Existing |
| Trust/Clarity | `DEFERRED_FINDINGS_QUEUE.md` § 2 with `[trust]` tag | Existing |
| Screenshots | `uat/screenshots/YYYY-MM-DD/<flow>/<build>/` | Extends pattern started 2026-05-25 |
| UX Review export | `specs/ux_review_YYYY-MM-DD.md` | Extends `founder_ux_review_2026-05-22.md` pattern |
| Run manifest | `_manifest.json` inside the per-build screenshot dir | New leaf file, not a new queue |
| External tester feedback (still preferred) | `BETA_FEEDBACK_QUEUE.md` (unchanged) | Tester intake stays separate from automation intake |
| Active workstream view | `CURRENT_PHASE.md` top entry (no new file) | Existing pattern serves this role |
| Stabilization queue view | `Stab #N` entries inside `CURRENT_PHASE.md` (no new file) | Existing pattern serves this role |

### 7.2 Governance doc integration — CORRECTED 2026-05-25 v2

The v1 draft offered "Option A or B" because I incorrectly believed `STABILIZATION_QUEUE.md` and `ACTIVE_WORKSTREAMS.md` didn't exist. Per the §0 inventory correction, both DO exist in `02_GrooveLinx/00_Governance/`. **Drew has confirmed Option A is the right posture** anyway: extend existing patterns, do NOT create new governance files. This section now describes the integration with the real docs.

**Routing matrix updated for the real governance landscape:**

| UAT Lab artifact | Existing doc it lands in (canonical) | Note |
|---|---|---|
| Tier A Bug, severe | `02_GrooveLinx/uat/bug_queue.md` → Open section | Drew triages; severe ones may be promoted to `Stab #N` |
| Tier A Bug, light | `02_GrooveLinx/uat/bug_queue.md` → Open section, LOW severity | |
| Resolved bug | Move to `02_GrooveLinx/notes/uat_bug_log.md` per `feedback_bug_queue_workflow` | Drew or Claude on his behalf |
| Tier A UX Issue | `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` § 2 UX Coherence Debt | |
| Tier A Stabilization | `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` § 1 Stabilization Debt | Promoted to `Stab #N` in `00_Governance/STABILIZATION_DASHBOARD.md` when shipped |
| Tier A Architecture Drift | `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md` § 3 Architecture Convergence Debt | May trigger a new Convergence Initiative (C-series) — Drew calls |
| Tier A Regression | `uat/bug_queue.md` (title `REGRESSION:`) + regression artifact under `uat/regressions/` | HIGH severity default |
| Tier A Performance | `uat/bug_queue.md` (if blocking) or `DEFERRED_FINDINGS_QUEUE.md` § 1 | SLA reference: `feedback_music_surface_sla` |
| Tier A Trust/Clarity | `DEFERRED_FINDINGS_QUEUE.md` § 2 with `[trust]` tag | Often dual-routes to Tier B Trust issue |
| Tier B Trust issue | `00_Governance/STABILIZATION_QUEUE.md` (priority bucket per impact) + `DEFERRED_FINDINGS_QUEUE.md` § 2 with `[trust]` | Tester-priority queue; Drew triages Critical/High/Med/Nice-to-have |
| Tier B Cognitive overload | `STABILIZATION_QUEUE.md` (usually Medium → Nice-to-have) + `DEFERRED_FINDINGS_QUEUE.md` § 2 | Often links to `Workstream 6 — Product Simplification` |
| Tier B Navigation confusion | `STABILIZATION_QUEUE.md` + `DEFERRED_FINDINGS_QUEUE.md` § 2 | |
| Tier B Musical context loss | `DEFERRED_FINDINGS_QUEUE.md` § 2 | Often links to `Workstream 2 — Rehearsal Intelligence` or `Workstream 4 — AI Guidance Layer` |
| Tier B Emotional friction | `STABILIZATION_QUEUE.md` (often High priority) + `DEFERRED_FINDINGS_QUEUE.md` § 2 | |
| Tier B Recommendation confusion | `DEFERRED_FINDINGS_QUEUE.md` § 2 (link to Workstream 4) | |
| Tier B Workflow momentum break | `DEFERRED_FINDINGS_QUEUE.md` § 2 + `STABILIZATION_QUEUE.md` if blocking | |
| Screenshots | `02_GrooveLinx/uat/screenshots/YYYY-MM-DD/<flow>/<build>/` | Extends today's pattern |
| UX Review export | `02_GrooveLinx/specs/ux_review_YYYY-MM-DD.md` | Extends `founder_ux_review_2026-05-22.md` |
| Run manifest | `_manifest.json` inside the per-build screenshot dir | New leaf file, not a new queue |
| External tester feedback | `02_GrooveLinx/BETA_FEEDBACK_QUEUE.md` (unchanged) | Tester intake stays separate from automation |
| Stab #N completion | `00_Governance/STABILIZATION_DASHBOARD.md` (chronological) + narrative in `CURRENT_PHASE.md` | Existing pattern — UAT Lab never writes Stab numbers itself |
| New canonical owner declared | `00_Governance/CANONICAL_SYSTEMS.md` | Drew authors; UAT Lab respects the prohibitions inside |
| Workstream assignment | `00_Governance/ACTIVE_WORKSTREAMS.md` references | UAT Lab is part of Workstream 6 (Product Simplification); does NOT create a new workstream |
| Strategic priority shift | `00_Governance/CURRENT_PRIORITIES.md` (P0/P1/P2/P3) | Drew authors; UAT Lab does NOT |
| Architectural decision | `00_Governance/ARCHITECTURE_DECISIONS.md` | Drew/ChatGPT author per `AI_WORKFLOW.MD` |
| Active in-flight work | `CURRENT_PHASE.md` top entry (no new file) | Existing pattern |
| Findings actionable as work items | **GitHub Projects** (per `AI_WORKFLOW.MD` "GitHub Projects is the official task board") | Markdown queues are continuity; GitHub Projects is execution |

**Cross-doc invariants UAT Lab enforces:**
1. Never writes to `CANONICAL_SYSTEMS.md`, `DATA_OWNERSHIP_RULES.md`, `ARCHITECTURE_DECISIONS.md`, `CURRENT_PRIORITIES.md` — these are Drew/ChatGPT-owned strategic surfaces.
2. Never adds a new top-level governance doc — uses existing 16 in `00_Governance/`.
3. Stab numbering is **never assigned by UAT Lab** — only by the human-led stabilization cycle when a finding is promoted to a Stab #N fix; that promotion is recorded in `STABILIZATION_DASHBOARD.md`.
4. Convergence Initiatives (C1-C6) are similarly human-assigned; UAT Lab can flag Architecture Drift but does not declare new Convergence Initiatives.
5. KNOWN_STABLE_FLOWS.md promotions require founder approval (per §11.4 lock-in below). Claude may add at `Experimental` only if Drew has pre-approved that flow's addition.

### 7.3 Session-close discipline

Every UAT Lab run that produces findings appends to `CURRENT_PHASE.md` per the same release-summary convention (memory `feedback_release_format`):
- Build, commit, files changed, deploys, findings captured (with category breakdown), screenshot dir path
- Per `feedback_runtime_state_sync`: also include the GROOVELINX RUNTIME STATE block

And to `CLAUDE_HANDOFF.md`:
- Updated top entry with what was run, key findings, restart prompt for next UAT session

---

## 8. Implementation sequence (phased rollout)

Drew was explicit: **start small, deterministic, scripted**. Below is a 4-phase rollout. Each phase is a checkpoint where we stop, verify, and confirm before the next.

### Phase 0 — Approval + foundation (this proposal, ~0 LOC)
- Drew reads this spec, picks Option A or B for §7.2, approves the perimeter.
- No code shipped in Phase 0.

### Phase 1 — Harness skeleton + 1 flow (~150 LOC, ~half-day)
Goal: prove the contract → manifest → screenshot loop works end-to-end on the simplest flow.

Files added:
```
tests/uat-lab/
  runner.js                              ← shared contract → Playwright runner
  contracts/
    songs.triage.desktop.js              ← FIRST FLOW (Drew-selected, HIGH-drift target)
  helpers/
    screenshot-store.js                  ← writes to uat/screenshots/<date>/<flow>/<build>/
    manifest.js                          ← writes _manifest.json
    finding-router.js                    ← classifies + routes to existing queues
  schemas/
    manifest.schema.json                 ← JSON schema for _manifest.json validation
    finding.schema.json                  ← JSON schema for finding records
scripts/uat-lab/
  run.js                                 ← `node scripts/uat-lab/run.js <flow-slug>`
  list.js                                ← `node scripts/uat-lab/list.js` → all flow slugs
02_GrooveLinx/uat/screenshots/<date>/    ← populated by first run
```

Acceptance for Phase 1:
1. `node scripts/uat-lab/run.js songs.triage.desktop` produces a directory of screenshots + `_manifest.json` with `expectations: all pass` (or honest fail) against the current build.
2. The run takes < 30 seconds for the Songs page (it's a heavy load — `Songs=586+`).
3. Manually inject one expectation failure (e.g., expect a non-existent selector) → finding is filed in `uat/bug_queue.md` Open section with a stable shape (per §4.2 schema).
4. **`KNOWN_STABLE_FLOWS.md` updated with the new "Songs page triage" entry at `Experimental` trust level — Drew explicitly approves the entry before commit** (per §11.4 lock-in).
5. `_manifest.json` validates against the schema added under `tests/uat-lab/schemas/`.
6. **One Tier B finding surfaces honestly** — given the founder review flagged Songs as HIGH-drift, Phase 1 should produce at least one Cognitive Overload or Navigation Confusion finding routed to `STABILIZATION_QUEUE.md` at the appropriate priority. If zero Tier B findings surface, Drew + Claude review whether the Tier B sensors are calibrated correctly.
7. Manifest run-record is committed alongside screenshots; the Phase 1 commit explicitly notes "recommended at Experimental — pending Drew approval" in the PR/commit message per §11.4.

### Phase 2 — Expand to first wave of v1 flows (~300 LOC, ~1-2 days)
Add contracts for:
- `home.morning-glance.desktop`
- `home.morning-glance.iphone`
- `songs.triage.iphone`  (mobile variant of the Phase 1 lead)
- `practice.pick-one-song.desktop`
- `setlist.lock-and-share.desktop`
- `rehearsal.review-last.desktop`

Build out `helpers/finding-router.js` rules per category. Add `scripts/uat-lab/run-all.js` for batch runs.

Acceptance for Phase 2:
1. `node scripts/uat-lab/run-all.js` runs all 6 flows against current build in < 5 min total.
2. At least one real finding is filed automatically (we'll find at least one because the founder review already documented MED-drift on Home + HIGH-drift on Songs).
3. `CURRENT_PHASE.md` gets a new entry summarizing the first batch run.

### Phase 3 — Multitrack + screenshots harvest (~200 LOC, ~1 day)
Add contracts for the three multitrack flows + integrate with the Spotify/YouTube Bug #15 re-verification recipe (per `reference_playwright_mcp_limits` memory).

Acceptance for Phase 3:
1. `multitrack.review-mode.desktop` + `.isolate-mode.desktop` + `.export-mix.desktop` all run cleanly.
2. The Phase 4B+4C visual checks + Bug #17 ACs from 2026-05-25 can be re-run by Claude in < 3 min total.
3. A regression run of `multitrack.review-mode.desktop` against build `20260524-193407` vs HEAD produces a clean diff (or surfaces real differences).

### Phase 4 — UX review export + regression workflow (~150 LOC, ~half-day)
Add `scripts/uat-lab/ux-review.js` (generates `specs/ux_review_YYYY-MM-DD.md` from a multi-flow run). Add `scripts/uat-lab/regression.js` (before/after diff).

Acceptance for Phase 4:
1. `node scripts/uat-lab/ux-review.js --flows home,songs,practice,setlist` produces a populated `specs/ux_review_YYYY-MM-DD.md` that Drew can hand to an external reviewer.
2. `node scripts/uat-lab/regression.js --flow multitrack.review-mode.desktop --before <build> --after <build>` produces the before/after/diff directory with a `report.md` summary.

### Phase 5+ (out of v1 scope, listed for transparency)
- Mobile flow expansion (iphone variants for every desktop flow where mobile is a real surface)
- Live Gig Mode flow (`live-gig.full-screen.iphone`)
- Performance regression baselines (TTI, music-surface SLA, far-seek)
- CI integration (GitHub Actions on PR — only for non-secret flows)
- Tester replay (let a tester's bug report auto-generate a UAT Lab contract that reproduces it)

---

## 9. Low-risk starting point

The single, smallest, lowest-blast-radius move that proves the UAT Lab concept end-to-end:

**Implement Phase 1 only.** One flow, one contract, one runner, one screenshot harvest. The Phase 1 acceptance criteria are explicit and bounded. If anything about the contract shape, manifest shape, or finding routing feels wrong, we discover it on one file — not on 10.

After Phase 1 lands cleanly, Drew + Claude decide together whether to proceed to Phase 2 or revise the contract shape first.

---

## 10. Out-of-scope (explicit)

So this proposal doesn't grow into something it isn't:

- **No new AI agent behavior.** UAT Lab is scripted Playwright + Claude reading the manifest. No autonomous "go find bugs" loops, no LLM-driven flow generation.
- **No new test framework.** Stays on `@playwright/test`.
- **No new build system, no TypeScript, no React.** Same constraints as the app (`CLAUDE.md`).
- **No parallel queues.** Findings land in existing queues; if a category doesn't fit, that's a signal to discuss before adding a new section.
- **No CI integration in v1.** Manual `node scripts/uat-lab/run.js <flow>` only.
- **No Spotify SDK flows in v1.** Blocked by Playwright Widevine; documented in `reference_playwright_mcp_limits`.
- **No live Modal/render cost in routine runs.** Multitrack render flows use the existing pre-rendered mix for AC1/AC2; AC4 (Export Mix) is opt-in per-run.
- **No screenshot diff thresholds tuned per element.** Phase 4 v1 uses a single threshold; per-element masking is v2.

---

## 11. Decisions locked in by Drew 2026-05-25 (was: open questions)

1. **§7.2 — DECISION: Option A.** Standardize on existing governance pattern. Note: the v1 draft framed this incorrectly as "two docs don't exist"; they both exist in `00_Governance/`. §0 + §7.2 now reflect the real landscape. Reason given by Drew: _"canonical governance consolidation > decomposition at current scale."_
2. **Phase 1 lead flow — DECISION: `songs.triage.desktop`.** Drew's reasoning: _"higher operational density and more likely to surface meaningful findings than homepage-first review. Better candidate for screenshot harvesting, regression structure, cognitive-load review, convergence pressure testing, metadata cleanup workflow validation."_ Aligns with `founder_ux_review_2026-05-22.md` HIGH-drift assessment of the Songs page.
3. **Screenshot storage — DEFERRED.** Today they commit to `02_GrooveLinx/uat/screenshots/` (the 4 from 2026-05-25 already are). Long-term this could bloat the repo. Not blocking Phase 1; revisit when repo size or churn becomes a real cost.
4. **§11.4 — DECISION: No autonomous KNOWN_STABLE_FLOWS promotion.** Drew's lock-in: _"Claude may recommend / propose / attach evidence. Founder approval still required for KNOWN_STABLE_FLOWS promotion during this phase."_ Reason: _"trust calibration and operational semantics still evolving."_ Practical implication for Phase 1: when Claude adds a flow, the PR/commit must explicitly state "recommended at Experimental — pending Drew approval" and Drew applies the actual line in `KNOWN_STABLE_FLOWS.md` (top-level, the canonical version, not the 00_Governance stub).
5. **Replay-against-old-builds (§6.3) — DEFERRED to v2.** Phase 4 stays focused on current-build regression and pixel-diff against the previous run within the same build epoch. Cross-build git-checkout replay is out of scope until v2.

**Net for Phase 1:** all blockers cleared. Lead flow is `songs.triage.desktop`. Phase 1 implementation can begin when Drew gives the explicit go signal.

---

## 12. References (memory + spec anchors)

- Memory `reference_playwright_mcp_limits` — Widevine, auth carryover, `isIOSPlatform` gate (anchors Phase 3 Spotify recipe)
- Memory `feedback_bug_queue_workflow` — bug intake + close-out discipline
- Memory `feedback_doc_updates` — living-doc update cadence
- Memory `feedback_release_format` — release summary block (used by §7.3)
- Memory `feedback_runtime_state_sync` — runtime state block (also §7.3)
- Memory `feedback_ground_truth_over_theater` — UX expectations for evidence-driven findings
- Memory `feedback_one_job_per_screen` — page thesis anchoring §5.1 cognitive load assessment
- Memory `feedback_layered_ia_no_deletes` — never use UAT-Lab data to argue for deletion
- Spec `groovelinx-ui-principles.md` — Band Command Center 3-pane, the visual North Star
- Spec `founder_ux_review_2026-05-22.md` — UX synthesis pattern §5 extends
- Spec `groovelinx-stabilization-audit.md` — Stab #N origin
- Doc `KNOWN_STABLE_FLOWS.md` — flow registry §2 extends
- Doc `BETA_FEEDBACK_QUEUE.md` — tester-feedback workflow runs parallel (not replaced)
- Doc `DEFERRED_FINDINGS_QUEUE.md` — 5-category finding queue §4 routes into

---

## 13. Sign-off

This document is the proposal. No code is added by this commit. **§11 decisions are now locked** (Option A, `songs.triage.desktop` lead flow, no autonomous KNOWN_STABLE_FLOWS promotion, screenshots-in-repo deferred, cross-build replay deferred). Phase 1 implementation begins on Drew's explicit go signal.

When Drew gives the go: Phase 1 lands as a single commit that adds `tests/uat-lab/`, `scripts/uat-lab/`, one proposed-Experimental entry in `KNOWN_STABLE_FLOWS.md` (awaiting Drew approval before promotion), and produces the first artifact in `02_GrooveLinx/uat/screenshots/<date>/songs.triage.desktop/<build>/`.
