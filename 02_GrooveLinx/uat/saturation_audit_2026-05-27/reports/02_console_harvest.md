# Console / Error Harvest — Saturation Audit 2026-05-27

Build: `20260527-005638`

Console traffic across the full audit was unusually quiet. Only one true error class was triggered. Telemetry warnings are benign.

## Errors (severity: HIGH)

### 1. Feed render failure
- **Surface:** `#feed`
- **Reproducibility:** 100% — fires on every Feed page navigation
- **Console output:**
  ```
  [Feed] Render failed: TypeError: GLPriority.forRsvpEvent is not a function
      at _feedRenderItem (band-feed.js:2052:75)
      at band-feed.js:1906:63
      at Array.forEach (<anonymous>)
      at _feedRender (band-feed.js:1906:25)
      at window.renderBandFeedPage (band-feed.js:960:5)
  ```
- **User-visible symptom:** Page renders only "📡 Band Feed / Could not load feed. Retry"
- **Severity:** HIGH (TRUST-LAYER + DEAD-END)
- **Diagnosis:** Same shape as the Home-dashboard "Could not load" bug fixed yesterday in commit `4a2fdfc1` — likely `GLPriority.forRsvpEvent` was renamed/removed without updating call site. Null-guard or feature-detect pattern recommended.
- **Note:** The *same feed data* renders correctly inside Home dashboard's "Recent band activity" widget, so the underlying data source is fine. Bug is in the standalone page renderer only.

## Errors (severity: NONE found)

No other errors observed during full desktop / iPad / iPhone traversal, including:
- Navigation between 36 hash routes
- Opening + closing modals (Mode menu, Settings, song drawer)
- Viewport resizes (desktop ↔ iPad ↔ iPhone)
- Browser back/forward
- Page reloads
- Auth-protected calls (Google Calendar, Drive, Spotify already linked)

## Warnings (severity: LOW / informational)

### UX hesitation tracker
- `[WARNING] [UX] hesitation: {"page":"home","duration_sec":15}` at `gl-ux-tracker.js:133`
- Fires when user lingers ≥15s on a page without interaction.
- **Not a defect** — this is intentional behavioral telemetry. Documented as G-009 (positive instrumentation).

### Firebase long-poll noise (filtered)
- Per CLAUDE.md SYSTEM LOCK 7c, `firebaseio.com/.lp` long-poll disconnect noise is suppressed in `index.html`. No leaks observed during the audit.

## Console hygiene summary

| Category | Count across full traversal |
|---|---|
| Errors (real) | 1 (Feed render) |
| Errors (deferred / suppressed) | 0 |
| Warnings (real) | 0 |
| Warnings (telemetry) | 2 (UX hesitation) |

**Net read:** Console hygiene is *very good*. The product is not noisily logging routine issues; the one error is a clean signal pointing at a clear bug. This is rare and load-bearing for the "operational visibility" frame — a noisy console would drown the one finding.
