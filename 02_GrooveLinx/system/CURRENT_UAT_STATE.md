# CURRENT UAT STATE — Rolling Snapshot

**Last updated:** 2026-05-25 18:32 UTC · **Build under test:** `20260525-183202`

> **What this doc is.** A compact, rolling, operational snapshot of GrooveLinx UAT/stabilization state — designed for AI sync without conversational replay. Re-validate before quoting if last-updated > 14 days old.
>
> **Cross-references (authoritative sources of truth):** `uat/bug_queue.md`, `notes/uat_bug_log.md`, `KNOWN_STABLE_FLOWS.md` (top-level, canonical), `00_Governance/STABILIZATION_DASHBOARD.md`, `00_Governance/STABILIZATION_QUEUE.md`, `BETA_FEEDBACK_QUEUE.md`, `DEFERRED_FINDINGS_QUEUE.md`, `specs/uat_lab_v1.md`, `specs/operational_visibility_v1.md`, `system/STABILITY_CLASSIFICATION.md`.

---

## 1. Stable flows (per top-level `KNOWN_STABLE_FLOWS.md`)

| Flow | Trust level | Last verified |
|---|---|---|
| SetlistPlayer (in-app 6-source player) | Stable | post Stab #07 (2026-05-13) |
| GLPlayerEngine queue (home practice, live-gig) | Stable | post Stab #07/#08 |
| Spotify→YouTube cross-source teardown (Bug #15) | Stable — re-verified | 2026-05-25 via Playwright MCP (659 ms silence) |
| Multitrack Review Mode (Bug #17 architecture fix) | Architecture-verified | 2026-05-25 (Review Mode default + 169 ms far-seek) |
| Per-route lifecycle (`GLRouteLifecycle`) | Stable | Stab #03 / #06 / #07 |
| Cross-engine pauseAll arbitration | Stable | Stab #07 (5 surfaces participate) |

---

## 2. Unstable / partially-verified flows

| Flow | Issue | Status |
|---|---|---|
| Song Detail playback (Stems lens) | Lens-switch does NOT pause stems (no lens-lifecycle system) | **Known limitation** per KNOWN_STABLE_FLOWS |
| Harmony Lab playback (split mixer + take review) | Stab #07 added arbitration; iPhone gesture-resume not yet field-verified | **Experimental** |
| Multitrack Isolate Mode (17-stream player) | §8.1 long-session banner code in place but gated on missing `session.durationSec` | **Bug #18 OPEN** |
| Multitrack Export Mix | `/render/check` 502 silently abandons polling (frontend `SyntaxError` on non-JSON body) | **Bug #19 OPEN** |
| Spotify SDK in Playwright MCP | Widevine missing → `EMEError: No supported keysystem`; structurally untestable from Playwright | known limit (memory `reference_playwright_mcp_limits`) |
| Home dashboard readiness counts | 3 disagreeing thresholds across surfaces | **Trust issue — C7 candidate** |
| GrooveMate recommendation surfaces | Parallel intelligence engines; recommendation inconsistency risk | **C8 candidate** |

---

## 3. Open bugs (per `uat/bug_queue.md`)

| # | Severity | Title | Status |
|---|---|---|---|
| #17 | HIGH | Multitrack player playback sync collapses on far seek | **ARCHITECTURE VERIFIED 2026-05-25** (Review Mode default, 169 ms seek) — considered resolved; AC3/AC4 surfaced follow-on bugs |
| #18 | MED | Multitrack session is missing `durationSec` → §8.1 long-session banner never fires | OPEN — short-term: browser-side fallback reading `audio.duration` on `loadedmetadata`; long-term: persist `durationSec` to Firebase on upload finalization |
| #19 | HIGH | Export Mix `/render/check` 502 silently abandons polling | OPEN — fix: worker wraps Modal HTTP errors as JSON envelopes; frontend surfaces poll failures + retry |
| **NEW** | **HIGH (proposed)** | **Readiness threshold disagreement** — 3 thresholds across surfaces | Surfaced 2026-05-25; awaiting promotion to bug_queue or canonical-system fix (C7) |

**Resolved this week (per `notes/uat_bug_log.md` style):**
- Bug #15 — Spotify→YouTube cross-source teardown — FIXED 2026-05-20 (build `20260520-163238`, commit `a776bcf4`); re-verified 2026-05-25 via Playwright

---

## 4. Active findings (per `DEFERRED_FINDINGS_QUEUE.md`)

- **§1 Stabilization Debt:** Server-side analysis phase markers (replace heuristic narrator with ground-truth Modal emission); Phase 4C plan_priors not visible on pre-4C sessions (backfill script sketch included); per-member home address overlap (issue #47)
- **§2 UX Coherence Debt:** Player `_sourceLabels.url` renders as "Link" (should be hostname); 13 other UX items
- **§3 Architecture Convergence Debt:** Open
- **§4 Beta Observation Candidates:** Open
- **§5 Intentional Non-Fixes:** Open

Plus the 5 Phase 4D items deferred from 2026-05-24 (Review Queue mode toggle, J=next-unresolved shortcut, large row restructure, Human-corrected badge, Excluded-as-amber).

---

## 5. Playwright maturity

- **Config:** `playwright.config.js` — desktop + iphone projects, `baseURL: http://localhost:8000`, webServer auto-starts `python3 -m http.server 8000`
- **Existing test specs (8):** `core-flows`, `never-blank`, `product-integrity`, `first-rehearsal`, `burn-in` (+ config + analyze), `chaos`, plus `helpers.js` + `calibration/`
- **Deterministic readiness flags:** `GL_APP_READY`, `GL_PAGE_READY=<pageId>`, `GL_REHEARSAL_READY`
- **Test sign-in pattern:** `localStorage.deadcetera_google_email` + `deadcetera_current_band` then reload (no real Google OAuth required for E2E)
- **MCP servers wired (`.mcp.json`):** `playwright` (`@playwright/mcp@latest`) + `groovelinx-firebase` (scoped to `deadcetera`)
- **Operational limits:** Widevine missing → Spotify SDK blocked; no auth carryover between Playwright sessions; engine gates Connect on `isIOSPlatform()` (memory `reference_playwright_mcp_limits`)
- **UAT Lab v1 Phase 1:** ✅ **LIVE 2026-05-25.** Minimal harness shipped: `tests/uat-lab/runner.js` (contract-driven Playwright runner, ~220 LOC), `tests/uat-lab/contracts/songs.triage.desktop.js` (first flow contract), `scripts/uat-lab/run.js` (CLI). First real run produced PASS in 5.5s, 2 screenshots, 0 findings, 1 expected `[UX] rapid_nav` warning. Inject-failure test confirmed finding shape is stable. Songs page entry added to `KNOWN_STABLE_FLOWS.md` at **Experimental** — awaiting Drew approval per `uat_lab_v1.md` §11.4 before promotion to Stable.

---

## 6. Screenshot harvesting status

- **Convention now operational** (Phase 1 of UAT Lab, 2026-05-25): `02_GrooveLinx/uat/screenshots/YYYY-MM-DD/<flow-slug>/<build>/NN-<step>.png` + `_manifest.json` + `_founder_review.md` (Founder Experience Summary template) + `_findings.md` (when findings surface)
- **First per-flow harvest:** `02_GrooveLinx/uat/screenshots/2026-05-25/songs.triage.desktop/20260524-193407/` (2 PNGs + manifest + founder review template)
- **Multitrack UAT screenshots from earlier today** still at the date-folder root (`2026-05-25/{mt-review-modal,mt-row-expanded,isolate-mode,export-after}.png`) — pre-convention artifacts; leave in place

---

## 7. Active regressions

**None currently tracked.** The regression workflow (before/after screenshots + `pixelmatch` diff) is documented in `specs/uat_lab_v1.md` §6 but not yet operational. UAT Lab Phase 4 ships the regression harness.

---

## 8. Telemetry maturity (per `specs/operational_visibility_v1.md` §1)

**Currently wired (all already in repo, do not duplicate):**
- `GLRuntimeHealth` (gl-runtime-health.js, Stab #10) — dev-only overlay; `?dev=true` / `Cmd+Shift+H`. Surfaces SW status, route lifecycle, playback arbitration, Spotify Connect, stems persistence, multitrack upload state, onboarding stats
- `GLUXTracker` (gl-ux-tracker.js) — rage_click (3+ in 2s), dead_click, rapid_nav, hesitation (15+s), slow_render (>3s), abandoned_flow, js_error → writes to `bands/{slug}/ux_events/{type}_{timestamp}` + auto-triggers `GLFeedbackService.recordFriction()`
- `GLFeedbackContext` — wraps `window.onerror` + `onunhandledrejection`; last 10 actions + 5 recent errors
- `GLFeedbackService.submitExplicit()` + `recordFriction()` — auto-files 3 trigger types (render_error, repeated_failure 3x, onboarding_stall); writes to `bands/{slug}/feedback_reports/{reportId}`
- `GLBetaFeedback` (gl-beta-feedback.js, ~210 LOC) — 8-category modal; activated via `?beta=true` / dev shell / `GLBetaFeedback.show()`
- `GLSpotifyConnect.getStats()` — apiCalls / apiFailures / lastApiAt / pollingActive / hasToken
- `GLPlayerContract.getStats()` — pauseAll calls + reentrant drops + pause failures
- `GLRouteLifecycle.getStats()` — registers / leaves / cleanup failures
- `GLStems.getStats()` — job persistence (Stab #14)
- **Contentsquare (Hotjar)** — wired at `index.html:10`; session replay, heatmaps, frustration detection

**Known gaps:**
1. **No canonical TTI / FCP / music-surface-SLA measurement** — `feedback_music_surface_sla` memory says "<1s" but no instrumentation. **`GLPerf` canonical module proposed.**
2. **`GLUXTracker.abandoned_flow` exists but rarely fires** — UAT Lab flow contracts can opt-in
3. **Cross-rehearsal intelligence** — not Operational Visibility scope; belongs in Workstream 4 (AI Guidance)

**Explicit DO NOT ADD (per `operational_visibility_v1.md` §4.3):** Sentry / PostHog / LogRocket / FullStory / Datadog — duplicate existing surfaces or violate `00_Governance/CANONICAL_SYSTEMS.md` monkey-patch prohibition.

---

## 9. Known high-risk surfaces

| Surface | Risk | Why |
|---|---|---|
| Multitrack Export Mix | HIGH | Bug #19 silently fails; pipeline works but error handling masks failure |
| Multitrack Isolate Mode on long sessions | MED | Bug #18 banner gated off; user gets no honest warning about drift |
| Home dashboard count consistency | HIGH (trust) | Readiness threshold disagreement → C7 |
| GrooveMate suggestion authority | MED-HIGH | Multiple engines compute recommendations; no canonical hierarchy |
| Modal cold-start | MED | First-call latency on Stems/Render endpoints; existing `_pollJob` resume mitigates Stab #14 |
| iPhone Safari playback | MED | SDK unusable per `gl-spotify-connect.js:6-10`; Connect path mandatory; bfcache resume hooks added per Stab #11 Q.8 |
| Setlist SWR clobber | LOW (mitigated) | Stab #01 closed; mutations route through `saveBandArrayDataSafe`; memory `project_setlist_swr_clobber_bug` documents the pattern to never repeat |

---

## 10. Tester intake (per `BETA_FEEDBACK_QUEUE.md`)

- **Workflow:** Inbound → Triage → In-flight → Closed
- **Active testers:** DeadCetera band members + hand-curated invitees (Whitney in his own band)
- **Onboarding gate:** Mode A (hard block via `_glCheckBandMembership`); switch to Mode B (self-onboard) when ready for founding members of other bands (per memory `project_auth_gate_mode`)
- **Recent tester observations** (per `00_Governance/STABILIZATION_QUEUE.md` Medium / Nice-to-have):
  - Home: 4 blank rectangle frames flash for 1-2s before homepage loads
  - Schedule tab: 4 button cluster (Schedule / Schedule Rehearsal / Block / Subscribe) unclear differences
  - Song Detail right rail Play tab too narrow
  - Song Detail readiness pills vs separate slider redundancy
  - "Find a Version" platform ordering (YouTube/Spotify/Archive/Relisten — currently Archive/Relisten/Phish.in/YouTube/More)
