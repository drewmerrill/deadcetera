# GrooveLinx — Beta Launch Checklist

_Build `20260514-142926`. The real launch gate. Before onboarding the first real founding-member tester, every **REQUIRED** item must be ✓._

This is a **gate**, not a wish list. If a REQUIRED item isn't ✓, don't onboard.

---

## How to use this doc

1. Before onboarding tester #1: walk through all REQUIRED items, ✓ each.
2. NICE-TO-HAVE items: skip if tight; revisit between tester #1 and tester #2.
3. POST-BETA: do not block on these.
4. If any REQUIRED item drops below ✓ later, **pause new tester onboarding** until restored.

---

## §1 — Operational Readiness (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | Latest build deployed to prod + dev | `version.json` matches across `index.html` / `index-dev.html` / `service-worker.js` |
| ☐ | Build bump atomic (4 sources synced) | Per `feedback_build_bump_atomic` memory; manual diff check |
| ☐ | Service Worker registers cleanly | DevTools → Application → Service Workers → no errors |
| ☐ | Cloudflare Worker deployed | `wrangler deploy` succeeded recently; `/stems/cancel` endpoint live |
| ☐ | Firebase realtime DB responsive | Console snippet returns `bands/{slug}/meta` payload |
| ☐ | Modal app `groovelinx-stems` deployable | Last 24h job completed successfully OR last deploy was within 14 days |
| ☐ | No pending merge conflicts on `main` | `git status` clean modulo dev work |

---

## §2 — Onboarding Readiness (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | Mode-B Phase 1 welcome overlay renders | Visit prod in incognito, no roster entry → welcome overlay shows |
| ☐ | "I have an invite" mailto link works | Click → mail client opens with prefilled `to:`, `subject:`, `body:` |
| ☐ | `members_index` write path verified | Manually add a test email → user reload → gate passes |
| ☐ | Cloud Function `mirrorMemberToIndex` working | Add to `bands/{slug}/meta/members` → `members_index/{sanitized}` populates |
| ☐ | `_glGetOnboardingStats()` returns sane shape | Console call → object with gateChecks / gateAllowed / gateBlocked / etc. |
| ☐ | BETA_ONBOARDING_RUNBOOK.md is current | Build number in runbook matches deployed build |
| ☐ | Drew has test-tester email reserved | One trusted person ready (Pierce's bandmate / Chris / etc.) |
| ☐ | Single-band-per-email rule verified | Per `project_duplicate_band_onboarding_bug` — tester not in any other band |

---

## §3 — Mobile Readiness (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | iOS Safari smoke test passes | iPhone live test: sign-in / Home / Songs / Song Detail / chart render |
| ☐ | Android Chrome smoke test passes | Android live test: same flow |
| ☐ | Add-to-Home-Screen works on iOS | PWA installs, opens fullscreen-ish, no manifest errors in console |
| ☐ | AudioContext resume on pageshow.persisted works | iOS bfcache test: harmony-lab → background tab 30s → return → audio plays |
| ☐ | Spotify Connect path works on iOS | iPhone + premium account → tap play → device's Spotify app starts playback |
| ☐ | Stage View renders correctly on phone | Live Gig → Stage View → chart legible, key/capo/BPM visible |
| ☐ | Service Worker offline mode tested | Disable wifi → reload cached page → still works |

---

## §4 — Playback Readiness (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | `pauseAll()` arbitration works (Stab #07) | Start playback in Stems → start in Harmony → only one plays |
| ☐ | Spotify Connect chokepoint stable (Stab #08) | North Star reference plays cleanly; title hydrates (no "Loading...") |
| ☐ | GLPlayerEngine handles local mp3 / blob | Recording playback works without crash |
| ☐ | YouTube embedded player works | YT-source song → reference play → no console error |
| ☐ | No "Wait, what key?" surface gap | Every song shows key + capo on Songs row + Song Detail + Stage View |

---

## §5 — Rehearsal Readiness (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | Rehearsal Mode launches | From Rehearsal page → fullscreen overlay works |
| ☐ | `RehearsalSession` writes correctly | Start rehearsal → Firebase `bands/{slug}/rehearsal_sessions/{id}` populates |
| ☐ | Rehearsal recording upload works | Phone-recorded mp3 → upload → "queued for analysis" appears |
| ☐ | Rehearsal Analyzer pipeline runs | Latest upload completes → segments + chord detection visible |
| ☐ | `songsWorked` saves to session | After rehearsal end → session record has `songsWorked` array |
| ☐ | Bug #8 (silent Load button) status known | Either fixed OR known-issue communicated to first tester |

---

## §6 — Prep for Gig Verification (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | Prep for Gig completes truthfully (Stab #12) | Test setlist with 1 bad URL → returns PARTIAL status, NOT "Ready for gig" |
| ☐ | Prep for Gig retry-only-failed works | Click retry on PARTIAL → only failed items re-attempt |
| ☐ | Offline Stage View works post-Prep | Run Prep → disable wifi → open Stage View → chart visible |
| ☐ | `_slPrepLastResult` exposes structured data | Console: `_slPrepLastResult` returns ok/failures/total/done |
| ☐ | Catastrophic-failure mode displays correctly | Test fully-offline Prep → red "Prep failed" surface |

---

## §7 — Runtime Overlay Operational Checks (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | Cmd+Shift+H opens overlay | Live test on prod build |
| ☐ | `prepForGig` snapshot section populates | Run Prep → overlay shows result |
| ☐ | `multitrack` snapshot populates | Start multitrack upload → overlay shows in-flight count |
| ☐ | `stems` snapshot populates | Start stem job → overlay shows activeCount + processing |
| ☐ | `onboarding` snapshot populates | New tester → overlay shows gateAllowed/Blocked counts |
| ☐ | No tokens / PII leaked in snapshot | Audit `snapshot()` output — no Firebase auth, no Spotify tokens |

---

## §8 — Feedback Capture Verification (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | Beta Feedback FAB activates on `?beta=true` | Visit prod with `?beta=true` → FAB bottom-right |
| ☐ | Beta Feedback FAB activates via localStorage | `localStorage.setItem('gl_beta_feedback','1')` + reload → FAB appears |
| ☐ | All 8 categories selectable | bug / confusion / playback / rehearsal / onboarding / mobile / performance / suggestion |
| ☐ | Feedback writes to Firebase | Submit test feedback → `bands/{slug}/feedback_reports/{id}` populates |
| ☐ | `betaSnapshot` attaches | Submission with "Attach snapshot" ON → snapshot subkey present |
| ☐ | Drew can read feedback live | Firebase Console + admin snippet returns recent submissions |
| ☐ | BETA_FEEDBACK_QUEUE.md ready | Doc exists with Inbound/Triage/In-flight/Closed sections, plus "First Tester Run" template |

---

## §9 — Rollback Readiness (REQUIRED)

| ✓ | Item | Verification |
|---|---|---|
| ☐ | `git revert` plan known | Last known-good commit identified |
| ☐ | Cloudflare Worker rollback path known | `wrangler rollback` syntax or previous version pinned |
| ☐ | Tester de-onboarding snippet ready | Console one-liner to remove tester from `members_index` |
| ☐ | Communication path to tester | DM / email path to notify tester of any rollback |
| ☐ | BETA_ONBOARDING_RUNBOOK.md §7 (rollback tier) current | Build number matches; tier definitions still valid |

---

## §10 — Known-Risk Acknowledgment (REQUIRED — explicit ✓)

The following are KNOWN open issues. Drew must explicitly acknowledge each before onboarding.

| ✓ | Item | Risk level | Mitigation |
|---|---|---|---|
| ☐ | Bug #8 — silent Load button (chopper) | LOW | Document in welcome message to tester |
| ☐ | LALAL stem job has no resume (M.5 deferred) | LOW | If a LALAL job in progress when tester closes tab → starts over |
| ☐ | Spatial stem job has no resume | LOW | Same as above |
| ☐ | No multi-band switching UI | MEDIUM | Add tester to ONE band only |
| ☐ | No client-side band creation | LOW | Drew manually provisions per BETA_ONBOARDING_RUNBOOK.md |
| ☐ | Workbench K2 router bug | LOW | Workbench is HIDDEN — tester won't see |
| ☐ | Practice page partial | MEDIUM | Don't direct tester to Practice in walkthrough |
| ☐ | Harmony Lab discovery problem | MEDIUM | Mention in tester walkthrough explicitly |
| ☐ | YT cookie bot-challenge possible | LOW | Per `reference_modal_youtube_cookies` — rotation path documented |
| ☐ | A2P 10DLC in carrier review | LOW | SMS may not work yet; rely on in-app + FCM push |

---

## §11 — NICE-TO-HAVE (skip if tight)

These improve tester experience but don't gate launch:

| Item | Why nice |
|---|---|
| Tester walkthrough video (2-3 min) | Reduces support burden |
| Pre-loaded sample songs in tester's band | Reduces empty-state confusion |
| Custom welcome message in welcome overlay (per-tester) | Personalization |
| Cleaned-up Cutlist Tier 1 deletes shipped | Cleaner repo; tester won't see |
| Cutlist Tier 2 hides shipped | Reduces tester nav clutter (high impact!) |
| Promotion: Harmony Lab header button (§5 of 08_PROMOTION_BACKLOG.md) | Visibility win |
| Promotion: Ideas → Feed collapse | Cognitive load drop |

---

## §12 — POST-BETA (do not block)

Items that should NOT delay first-tester launch but should be tracked:

- Audit #07 (Module Decomposition planning)
- C5 Phase 2 (band-comms.js direct refs)
- Mode-B Phase 2 (self-serve invite-code redemption via Worker)
- Self-serve band creation (with duplicate-band-bug solution)
- MusicXML migration (notation format)
- Bug #8 fix (silent Load button) if not landed pre-beta
- M.5 LALAL/spatial resume parity
- M.6-M.9 remaining medium-stab items

---

## §13 — Sign-Off

Once §1-§10 are fully ✓:

```
[ ] Drew verified all REQUIRED items
[ ] Tester #1 identified: __________________________
[ ] Tester #1 contact reserved: __________________
[ ] Tester #1 band slug planned: ________________
[ ] Onboarding date scheduled: ___________________
[ ] BETA_ONBOARDING_RUNBOOK.md printed/loaded
[ ] BETA_FEEDBACK_QUEUE.md "First Tester Run" template ready

LAUNCH GATE: PASS / FAIL
Reason if FAIL: __________________________________
```

If LAUNCH GATE: PASS — proceed with BETA_ONBOARDING_RUNBOOK.md §1.

---

## Maintenance

After every Stabilization Fix, Convergence, or other meaningful code change:

- Re-walk §3 (Mobile) and §4 (Playback) — these are most regression-prone.
- Re-verify §7 (Runtime Overlay) snapshots match the new code paths.
- Update §10 if any known-risk item changed status.

After every tester completes a session:

- Capture findings in BETA_FEEDBACK_QUEUE.md.
- Re-check §10 for new risks discovered.
- Decide §11 promotion candidates based on real friction.

---

## What this checklist is NOT

- **Not a feature checklist.** Features aren't blockers; failures are.
- **Not a quality bar for v1.0 release.** This is a **founding-member beta** gate. v1.0 has a higher bar.
- **Not exhaustive of every codebase concern.** SYSTEM LOCK violations, Firebase rules, A2P compliance — those have their own dedicated docs/memories.
- **Not aspirational.** Every REQUIRED item is verifiable in <5 minutes. If you can't verify it, fix the verification path.
