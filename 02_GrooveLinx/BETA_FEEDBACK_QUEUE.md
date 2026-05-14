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
**Runbook build at session:** 20260514-160056
**Session duration:** <minutes>

### What worked
- <list of flows that completed successfully>

### What confused
- <list of moments where the tester paused/asked>

### What broke
- <list of any console errors, blank states, or "this doesn't work" moments>

### Beta Semantic Clarity Pass observations (2026-05-14)
The following clarifications were added pre-tester. Capture whether each landed:

- **Playlists vs Setlists subtitles** — Did the tester pause on which one to use? Did the subtitle copy ("not the gig running order" / "performance running order") successfully distinguish them, or did they still ask?
- **Feed vs Band Room subtitles** — Did the tester understand Feed = activity stream vs Band Room = decisions/proposals? Did the inline cross-references ("see Band Room" / "see Feed") help?
- **Harmony Lab discoverability** — Did the tester find Harmony Lab on their own? Did the new label ("Harmony Lab" vs "Harmony") + tooltip help?
- **Song Detail first impression** — Tester now lands on Chart (Play lens) by default. Did they look for or expect something else first?

### Contextual Confidence Pass observations (2026-05-14, build 20260514-160056)
Empty-state copy improvements landed. Capture whether each empty state gave the tester confidence vs hesitation:

- **Band Feed first-load** — When the tester landed on an empty Feed, did the new explanation ("Recent band activity will show up here…") give them a clear sense of what Feed is for? Did they post a first item, or hesitate?
- **Best Shot column copy** — Did "The canonical version" + "Spotify/YouTube link the band is matching to" make North Star's purpose clear? Same for Best Shot's "strongest take" copy?
- **Harmony Lab takes empty states** — When the tester opened Harmony Lab on a song with no takes, did the new "Record yourself practicing the part — takes save here so the band can hear how it's coming along" land? Did they record a take?
- **Band Room empty state** — Did the reframed "Nothing to decide yet — Ideas, song suggestions, and proposals…" copy clarify what Band Room is for, distinct from Feed?
- **Stage View no-setlist** — If the tester opened Live Gig without a setlist, did the new "Pick a setlist to perform first — head to Setlists, then hit ▶ Live Gig" land as helpful rather than error-y?
- **Prep-for-Gig success → Live Gig cue** — After Prep completed successfully, did the new "Tap ▶ Live Gig when you're ready" toast successfully orient the tester to the next step? Or did they still wonder what to do next?

### Where guidance still feels weak (observe before next pass)
- **Practice page** — emerging surface; minimal empty-state work done by design (don't over-promote half-built feature). If tester taps Practice → frustration likely.
- **Workbench** — hidden by design; tester shouldn't reach it.
- **Three rehearsal entry points** — counter armed (`_glGetRehearsalEntryStats()`); structural convergence deferred until real signal.
- **Lens density** — 6 lenses still present; default `band` landing + tooltips are partial mitigation only.

### Reality Audit #10 — Home Page Intelligence Hierarchy observations
The audit (2026-05-14, build `20260514-174732`) identified 10 findings on Home. Validate whether each hits Tester #1 in the wild — these answers drive whether P0 fixes ship:

- **F1 Risk card specificity** — When tester saw "N songs below ready" on a rehearsal-risk card, did they understand WHICH songs? Did they want to tap to see them?
- **F2 Scope confusion (your set vs band set)** — When CTA said "Start Rehearsal" or "Run your full set," did the tester pause on whether it was a personal or band action?
- **F3 Stacked recommendations** — Did the tester encounter multiple "do this next" suggestions in one viewport and not know which to follow?
- **F4 "73% gig ready" — explainability** — Did the tester ask what 73% means, what it's based on, or which gig?
- **F5 "Dropped in readiness" — scope** — When tester saw a song-dropped nudge, did they understand WHOSE readiness dropped?
- **F6 Recording Analyzer placement** — Did the tester find the Analyze Rehearsal Recording CTA? Did it feel buried or appropriate?
- **F7 What's New completeness** — Did the tester glance at What's New and think "is that all"? Did they expect to see more activity than what rendered?
- **F8 Band Room placement** — Did the tester confuse Band Room with the Feed pending alerts at the top?
- **F9 "1 needs attention" vs "2 need work" disagreement** — Did the tester notice or comment on the contradicting counts? (This is the most-dangerous finding for trust.)
- **F10 "N/5 aligned on Focus"** — Did the tester try to click the count to see who voted? Did they understand the link to "Count me in"?

**If 2+ findings validated by Tester #1 → schedule Audit #10 P0 (4 surgical fixes, ~150-250 LOC). Otherwise defer architectural work; observe across testers #2-3.**

### Rehearsal entry path observation
Query in tester's browser console after session: `_glGetRehearsalEntryStats()`
- Counts per source: <fill in from console output>
- Most-used path: <home-quickstart | home-cta | direct>
- Implications: <if dominant path is "direct," consider primary-nav prominence; if "home-quickstart," validate the zero-friction entry; if "home-cta," confirm CTA copy clarity>

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
