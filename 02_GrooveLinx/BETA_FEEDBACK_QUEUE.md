# GrooveLinx — Beta Feedback Queue

_Created: 2026-05-14 (build `20260514-142926`) — opened with Beta Operations Enablement._

This is the operational learning pipeline for Mode-B founding-member testing. Real-user findings land here, get triaged, and either become a Stab #, a tracked bug in `uat/bug_queue.md`, a memory entry, or a deferred long-term item.

## How feedback lands here

**In-app capture (lightweight beta-feedback FAB):**
- Mounted bottom-right when any gate is satisfied:
  - `?beta=true` URL query
  - `localStorage.gl_beta_feedback === '1'`
  - User is on a roster AND running the dev shell (`index-dev.html`)
  - `GLBetaFeedback.show()` console call
- Modal asks for category (bug / confusion / playback / rehearsal / onboarding / mobile / performance / suggestion) + free-text + optional runtime snapshot attachment
- Submits via existing `GLFeedbackService.submitExplicit()` → lands in `bands/{slug}/feedback_reports/{reportId}` with a leading `[category]` tag

**Direct paths (still supported):**
- Avatar feedback (`GLFeedbackService.submitExplicit`) — full surface
- Auto-friction (`GLFeedbackService.recordFriction`) — render-error / repeated-failure / onboarding-stall

**Manual paths:**
- Tester texts Drew → Drew enters here under "Inbound"
- Tester emails Drew → Drew enters here under "Inbound"

## Workflow

1. **Inbound** — raw feedback, untriaged
2. **Triage** — Drew classifies: Stab-able now / bug-log / memory / deferred / wontfix
3. **In-flight** — actively being worked
4. **Closed** — fix shipped + tester acknowledged (or wontfix with reason)

---

## Categories + intake form

| Category | Owner | Typical landing |
|---|---|---|
| **bug** | Drew + Claude | bug_queue.md → Stab # if HIGH RISK |
| **confusion** | Drew | UX adjustment or doc clarification |
| **playback** | Drew | Bug log if reproducible, memory if iOS-specific |
| **rehearsal** | Drew | Bug log or rehearsal-system spec doc |
| **onboarding** | Drew | Mode-B improvements, bug_queue if blocking |
| **mobile** | Drew | iPhone/Android specifics, memory |
| **performance** | Drew | bug_queue if slow surface, defer if cosmetic |
| **suggestion** | Drew | Long-term roadmap, README, deferred |

---

## First Tester Run

_Reserved for the first real founding-member onboarding session._

Once Drew executes `02_GrooveLinx/BETA_ONBOARDING_RUNBOOK.md` with tester #1, populate this section with the Ops Review summary from runbook §5.5:

```
## First Tester Run — <tester-name> / <date>

**Tester:** <name>, <email>, <band slug>, <device>
**Runbook build at session:** 20260514-142926
**Session duration:** <minutes>

### What worked
- <list of flows that completed successfully>

### What confused
- <list of moments where the tester paused/asked>

### What broke
- <list of any console errors, blank states, or "this doesn't work" moments>

### Success criteria (§6 grading)
- 8 lines: ✓ / ✗ / N/A
- Overall: SUCCESSFUL / PARTIAL / FAILED

### Next-action decision (§8 gate)
- A: onboard 2-3 more testers
- B: build Mode-B Phase 2 redemption
- C: fix specific friction before tester #2
- Chosen: <A | B | C>
- Reason: <one sentence>
```

The runbook's §5.5 "Ops Review" instructs Drew to drop the summary here. After the first run, each subsequent tester gets a new sub-section under this heading until the cadence justifies splitting into per-tester pages.

---

## Inbound — untriaged

_Nothing yet — opening with Mode-B enablement build `20260514-142926`._

---

## Triage — categorized, scheduled

_Nothing yet._

---

## In-flight — actively being worked

_Nothing yet._

---

## Closed — shipped or wontfix

_Nothing yet._

---

## Known onboarding limitations (Mode-B Phase 1)

1. **No client-side band creation.** Per `project_duplicate_band_onboarding_bug` memory: in-app onboarding that auto-creates a band has caused duplicate-band confusion when an admin separately provisions one. The Mode-B Phase 1 path is **admin-mediated**: invited user lands on the welcome overlay → clicks "I have an invite" → emails Drew via prefilled mailto → Drew manually adds their email to `bands/{slug}/meta/members/{memberKey}` → user reloads and is in.
2. **No self-serve invite-code redemption.** A future Phase 2 could add a Cloudflare Worker `POST /beta-invite-redeem` endpoint that takes `{code, email}`, verifies against a Firebase-stored invite, and adds the user to the band roster server-side with admin credentials. Until then, the bottleneck is intentional — Drew controls the actual roster writes.
3. **No band switching UI for multi-band users.** If a tester is added to two bands, the auth gate's `Object.keys(all).forEach` non-determinism applies. Drew should ensure each tester has exactly one band entry until the multi-band UI ships.
4. **Email is the only identity.** No invite-code-driven onboarding yet. Users must sign in with the email Drew added.

---

## Runtime Health Overlay — onboarding section

The Runtime Health Overlay (`?dev=true` / `localStorage.gl_runtime_health='1'` / `Cmd+Shift+H`) now includes an `onboarding` snapshot section:

```
onboarding: {
  gateChecks: N,            // total membership-check calls
  gateAllowed: N,           // user found in members_index
  gateBlocked: N,           // user not found → not-authorized overlay shown
  gateError: N,             // Firebase error during check (fail-closed)
  inviteCodeViewed: N,      // user clicked "I have an invite" in the overlay
  inviteCodeSubmitted: 0,   // reserved for Phase 2 redemption
  feedbackSubmitted: N,     // GLBetaFeedback successful sends
  recentBlockedCount: N,    // capped at 32 recent blocked emails
  lastEvent: 'gateBlocked', // most recent counter event
  lastEventAt: <epoch ms>
}
```

These are per-device counters in `localStorage.gl_onboarding_stats`. Useful for sanity-checking that uninvited landings + invite-code views + feedback submissions are in the ranges Drew expects.

---

## Doc cross-references

- **Auth gate evolution:** memory `project_auth_gate_mode.md`
- **Duplicate-band bug:** memory `project_duplicate_band_onboarding_bug.md`
- **Resolved bugs:** `02_GrooveLinx/notes/uat_bug_log.md`
- **Open bugs:** `02_GrooveLinx/uat/bug_queue.md`
- **Audit ledger:** `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md`
- **Stable flows:** `02_GrooveLinx/KNOWN_STABLE_FLOWS.md`
