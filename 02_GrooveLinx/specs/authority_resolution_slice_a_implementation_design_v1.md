# Authority Resolution — Slice A Implementation Design v1

> **Design-only. NOT code. NOT a rules deploy. NOT MVLS. NOT Slice B/C/D beyond dependency notes.**
>
> Author voice: GrooveLinx Principal Architect. Smallest safe slice that closes the unauthenticated-write exposure on `bands/$bandId`.
>
> **Purpose:** specify the Firebase Auth wiring mechanics + the minimal rule change that tightens `bands/$bandId/.write: true` → `auth != null`, so any future signed-in Google user can write to band data but anonymous internet clients cannot.
>
> **Inputs:**
> - `02_GrooveLinx/specs/authority_fragmentation_recognition_v1.md`
> - `02_GrooveLinx/specs/authority_fragmentation_readiness_audit_v2.md`
> - `02_GrooveLinx/specs/authority_resolution_phase_1_design_v1.md`
> - Security Stabilization Stage 1 final state (Phase 1 immutability via `.validate` enforced; `/users/` locked; `bands/$bandId/.read+write: true` unchanged)
> - Codebase grounding: `app.js:5826 getCurrentUserEmail()` (OAuth flow), `firebase-service.js:454 handleGoogleDriveAuth()` (sign-out toggle)

---

## §0 — Frame

This is the implementation design for **Slice A only**. Per Drew's tightened scope:

- IN: Firebase Auth wiring code + `bands/$bandId/.write: true` → `auth != null` rule change
- OUT: `shared_setlists/` posture change (preserved as-is)
- OUT: `OWNER_EMAIL` retirement
- OUT: authorship migration
- OUT: Memory Hardening Phase 2 work
- OUT: read-side tightening on `bands/$bandId/.read` (Slice B territory)

Slice A is the gating prerequisite for Slice B/C/D. It establishes Firebase Auth as a real session state in every browser and tightens the central exposure (F14) from "wide-open" to "authenticated-Google-user-required."

This design does NOT propose code; it specifies what code must do, where, with what error handling and what lifecycle.

---

## §1 — Firebase Auth wiring mechanics

### §1.1 — Where to hook

**Hook point: `getCurrentUserEmail()` in `app.js:5826`**, after the Google profile fetch succeeds (line 5829-5837) and BEFORE the membership gate check (line 5845 `_glCheckBandMembership`).

Specifically, immediately after these lines (5836-5838):
```
console.log('👤 Signed in as:', currentUserEmail);
localStorage.setItem('deadcetera_google_email', currentUserEmail);
```

Insert:
```
// Slice A: establish Firebase Auth session using the Google access token.
// This is the trust-layer foundation for server-side rule enforcement.
await _glSignInToFirebaseAuth(accessToken, currentUserEmail);
```

Rationale: at this point, `accessToken` is populated (from Google OAuth), `currentUserEmail` is canonical, and we have NOT yet attempted any Firebase RTDB reads. The membership gate check that follows reads `members_index/{email}` — under Slice A's tightened rules, this path remains public-read so the gate still works without auth. But any subsequent write to `bands/$bandId/*` will require the auth session established here.

### §1.2 — How to sign into Firebase Auth

**Method: `firebase.auth().signInWithCredential()` using a Google credential built from the OAuth access token.**

```js
async function _glSignInToFirebaseAuth(googleAccessToken, email) {
  // Guard: Firebase Auth SDK must be loaded. It is preloaded in the
  // service-worker CDN cache (firebase-auth-compat.js).
  if (typeof firebase === 'undefined' || !firebase.auth) {
    console.error('[Auth] Firebase Auth SDK unavailable; Slice A signIn skipped');
    _glBumpAuthCounter('firebase_auth_sdk_missing');
    return null;
  }

  // Dev-mode bypass: test identity (test@groovelinx.com) has no real Google
  // credential. Establish auth context via anonymous sign-in so Slice A rules
  // (.write: "auth != null") permit writes. Slice B will need test users
  // seeded in meta/members/ to pass membership.
  if (email === 'test@groovelinx.com') {
    try {
      const anon = await firebase.auth().signInAnonymously();
      console.log('[Auth] Dev mode: anonymous Firebase Auth established');
      return anon.user;
    } catch (e) {
      console.error('[Auth] Dev mode anonymous signIn failed:', e.code);
      return null;
    }
  }

  // Production path: sign in with Google credential.
  try {
    const credential = firebase.auth.GoogleAuthProvider.credential(null, googleAccessToken);
    const result = await firebase.auth().signInWithCredential(credential);
    console.log('[Auth] Firebase Auth session established:', result.user.email);
    _glBumpAuthCounter('firebase_auth_signin_ok');
    return result.user;
  } catch (e) {
    console.error('[Auth] Firebase Auth signInWithCredential failed:', e.code, e.message);
    _glBumpAuthCounter('firebase_auth_signin_failed');
    // See §1.3 for fail-open vs fail-closed decision.
    return null;
  }
}
```

The `_glBumpAuthCounter` helper mirrors the existing `_glBumpOnboardingCounter` pattern (`app.js:5910`). Tracks success/failure counts in localStorage for the Runtime Health Overlay to surface.

### §1.3 — Error handling: fail-open vs fail-closed

**Recommended: fail-open with telemetry, sub-sliced deploy.**

Three failure modes:

| Failure | Cause | Recommended response |
|---|---|---|
| Firebase Auth SDK not loaded | CDN cache miss + network error during fetch | Skip signIn; log; counter bump. App continues; band writes will fail at rules layer if Slice A.2 (rule tightening) has shipped. |
| `signInWithCredential` fails (transient) | Network blip, Google API hiccup | Skip; log; counter bump. Same as above. |
| Credential rejected (e.g., scope mismatch) | OAuth scopes don't include `email` / `openid` | Should not happen — current OAuth scope includes `email profile`. If it does, log + counter bump. |

**Why fail-open:** failing closed means a transient Firebase Auth issue locks the user out entirely. Fail-open means the user gets a degraded experience (band-data writes silently fail with `PERMISSION_DENIED` from the rules layer) but the app still loads and reads work. Telemetry surfaces the issue.

**Mitigation against silent write failures:** the existing GLStore write helpers can be hardened in a later slice to detect `PERMISSION_DENIED` errors and surface a "session lost — sign in again" toast. NOT in scope for Slice A.

### §1.4 — Auth lifecycle

**Sign-in path** (Slice A): after Google OAuth succeeds → `_glSignInToFirebaseAuth(accessToken, email)` → continue with `_glCheckBandMembership`.

**Sign-out path:** `handleGoogleDriveAuth()` in `firebase-service.js:454` handles the sign-out toggle. Add a Firebase Auth signOut alongside the existing OAuth cleanup:

Insert after line 458 (`accessToken = null;`):
```js
// Slice A: also sign out of Firebase Auth.
try {
  if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
    await firebase.auth().signOut();
  }
} catch (e) {
  console.warn('[Auth] Firebase Auth signOut failed (non-fatal):', e.message);
}
```

**Token refresh:** Google access tokens expire (typically 1 hour). The existing `tokenClient.requestAccessToken({ prompt: 'none' })` in `firebase-service.js:488,491` refreshes silently. After refresh, the Firebase Auth session should also refresh — BUT Firebase Auth's own session persists ~1 hour after credential-based sign-in and auto-refreshes via its own token.

**Slice A scope decision:** do NOT re-call `_glSignInToFirebaseAuth` on Google token refresh. Firebase Auth's own session lifecycle handles refresh. If Firebase Auth session expires (~1 hour), `auth.currentUser` becomes null and subsequent writes fail at rules layer. Telemetry surfaces this if it happens at scale.

**Slice A+ future:** could add `firebase.auth().onAuthStateChanged()` listener to detect session loss and trigger re-sign-in. Out of Slice A scope.

### §1.5 — Dev-mode behavior

The test identity flow (`test@groovelinx.com`, gated by `?dev=true` URL param and `gl_dev_user` localStorage) does NOT have a real Google credential. Per `firebase-service.js:79-96`, the test user state is auto-cleared if `?dev=true` is not present.

**Slice A handling:** detect `email === 'test@groovelinx.com'` and use `firebase.auth().signInAnonymously()` instead of `signInWithCredential`. Anonymous sign-in establishes `auth != null` (satisfying Slice A's rule) without requiring a real Google identity.

**Slice B implication:** the membership rule will need to handle the test-identity case. Either (a) seed test users in `meta/members/` with their dev emails (recommended), or (b) special-case anonymous auth in the membership rule. Recommended: (a) so the same rule shape works in dev and prod.

**This is the only dev-mode-specific code path in Slice A.** Everything else is uniform.

---

## §2 — Rules patch

### §2.1 — The single rule change

Replace one rule:

```diff
  "bands": {
    ".read": true,
    "$bandId": {
      // ... preserved indexOn declarations ...
      // ... preserved Phase 1 annotation .validate rules ...
      ".read": true,
-     ".write": true
+     ".write": "auth != null"
    }
  }
```

That's the entire rule change. **Everything else is preserved verbatim.**

### §2.2 — What is preserved (explicit list)

| Path | Posture | Reason for preservation in Slice A |
|---|---|---|
| `care_packages_public/.read: true, .write: false` | Stage 1 settled | No change in Slice A |
| `shared_setlists/.read: true, .write: "true"` | Wide-open write preserved | Drew explicit: do NOT change in Slice A |
| `bands/.read: true` | Top-level public read | Tightening is Slice B territory (read-side) |
| `bands/$bandId/.read: true` | Public read | Tightening is Slice B territory |
| All `.indexOn` declarations on band sub-paths | Query optimization | Mechanical preservation |
| Phase 1 `.validate` immutability rules on `bands/$bandId/annotations/$annotationId/promoted*` (5 fields) | Memory Hardening Phase 1 trust contract | **Critical to preserve** — these enforce G1/G2 at data layer |
| `users/.read: false, .write: false` | Stage 1 settled | No change in Slice A |
| `members_index/.read: true, .write: false` | Boot gate dependency + Cloud Function maintained | No change in Slice A |

### §2.3 — Console-ready rules JSON for Slice A

```json
{
  "rules": {
    "care_packages_public": {
      ".read": true,
      ".write": false
    },
    "shared_setlists": {
      ".read": true,
      ".write": "true"
    },
    "bands": {
      ".read": true,
      "$bandId": {
        "practice_mixes": { ".indexOn": ["updatedAt"] },
        "feedback_reports": { ".indexOn": ["createdAt"] },
        "ideas": { "posts": { ".indexOn": ["ts"] } },
        "polls": { ".indexOn": ["ts"] },
        "gigs": { ".indexOn": ["date"] },
        "setlists": { ".indexOn": ["date"] },
        "calendar_events": { ".indexOn": ["date"] },
        "discussions": { "$songKey": { "messages": { ".indexOn": ["ts"] } } },
        "events": { "$eventId": { "comments": { ".indexOn": ["ts"] } } },
        "rehearsal_sessions": { ".indexOn": ["date", "startedAt"] },
        "activity_log": { ".indexOn": ["ts"] },
        "annotations": {
          "$annotationId": {
            "promoted":            { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promoted_by":         { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promoted_at":         { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promoted_from":       { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promotion_authority": { ".validate": "!data.exists() || data.val() === newData.val()" }
          }
        },
        ".read": true,
        ".write": "auth != null"
      }
    },
    "users": {
      ".read": false,
      ".write": false
    },
    "members_index": {
      ".read": true,
      ".write": false
    }
  }
}
```

**Diff from current deployed:** exactly one line — `bands/$bandId/.write` changes from `true` to `"auth != null"`. Everything else byte-for-byte identical to current.

### §2.4 — Recommended sub-sliced deploy: A.1 → A.2

**Slice A.1 (code-only, ships first):**
- Deploy the Firebase Auth wiring code (§1).
- Rules unchanged (still `bands/$bandId/.write: true`).
- Watch in production: telemetry counters report `firebase_auth_signin_ok` vs `firebase_auth_signin_failed`. Verify Firebase Auth establishes for all bandmates after they sign in.
- Duration: 3-7 days of observation, or until each active bandmate has signed in at least once with `firebase_auth_signin_ok`.

**Slice A.2 (rules-only, ships second):**
- Deploy the rule change in §2.1.
- Run the verification sweep (§3).
- F14 closed.

**Why sub-slice?** If Firebase Auth wiring has any unforeseen issue (browser compat, mobile Safari quirks, etc.), shipping Slice A.1 alone gives the failure mode a window to surface in telemetry BEFORE the rules tightening would cause silent write failures for the affected user. The sub-slicing turns a potential outage into a logged warning.

**Alternative — single combined ship:** acceptable if the rollback discipline is tight. Higher risk; faster path. Drew picks.

---

## §3 — Verification plan

Three layers, in order:

### §3.1 — Rules Playground scenarios (operator runs in Console BEFORE Publish)

Required: 6 scenarios specifically for Slice A. Existing Stage 1 scenarios (1-16) remain in effect; the new ones supplement.

| # | Scenario | Path | Auth | Operation | Expected |
|---|---|---|---|---|---|
| A1 | Unauth read band data (preserved) | `/bands/deadcetera/songs/test` | unauthenticated | `get` | ✅ Allow |
| A2 | Unauth write band data (NEWLY DENIED) | `/bands/deadcetera/_slice_a_test` | unauthenticated | `set("test")` | ❌ Deny |
| A3 | Auth write band data (NEW) | `/bands/deadcetera/_slice_a_test` | authenticated (any uid) | `set("test")` | ✅ Allow |
| A4 | Phase 1 forgery still rejected (no regression) | `/bands/deadcetera/annotations/test_id/promoted_by` | authenticated | `set("forged")` (with existing value) | ❌ Deny (`.validate` still enforces) |
| A5 | Unauth write shared_setlists (preserved) | `/shared_setlists/test_slug` | unauthenticated | `set({...})` | ✅ Allow (per Drew: preserved in Slice A) |
| A6 | Unauth write /users/ (preserved Stage 1) | `/users/test` | unauthenticated | `set("x")` | ❌ Deny |

A1, A3, A5 are "preserve current behavior." A2, A4, A6 are critical-must-pass.

**All 6 must pass** before Console Publish. Plus all 16 prior Stage 1 scenarios.

### §3.2 — REST API equivalent sweep (Claude runs via curl post-Publish)

Same sweep pattern as Stage 1 verification. The unauthenticated scenarios (A1, A2, A5, A6) are testable via curl from a non-authenticated context. The authenticated scenarios (A3, A4) require an authenticated Firebase ID token — not easily obtainable from curl without Firebase Admin SDK service account. **For A3 and A4, the browser/devtools verification in §3.3 covers them.**

Curl scenarios for Slice A:
- A1 (unauth GET) → expect HTTP 200
- A2 (unauth PUT) → expect HTTP 401 (NEW)
- A5 (unauth PUT shared_setlists) → expect HTTP 200 (preserved)
- A6 (unauth PUT users) → expect HTTP 401 (preserved Stage 1)

Plus regression-test the Stage 1 immutability rules to confirm `.validate` still works under the new `.write: "auth != null"` parent. A4-equivalent via curl: create test annotation (unauth — should now fail with the new parent rule, so this test needs to be done from browser-devtools post-Slice-A).

Adjusted Slice A REST sweep: ~6 unauth scenarios via curl + 6 auth scenarios via devtools.

### §3.3 — Browser/devtools verification (operator runs from logged-in app session)

```js
// Slice A post-deploy verification
// Run in devtools console on app.groovelinx.com, signed in as a band member

(async () => {
  console.log('=== Slice A Verification ===');

  // V1: Firebase Auth session established
  const fbUser = firebase.auth().currentUser;
  if (!fbUser) {
    console.error('🚨 V1 FAIL: Firebase Auth session NOT established');
    console.error('  → Slice A code did not execute, OR Firebase Auth signIn failed');
    console.error('  → Check localStorage:gl_onboarding_stats for failure counters');
    return;
  }
  console.log('✓ V1 PASS: Firebase Auth as', fbUser.email, '(uid:', fbUser.uid + ')');

  // V2: authenticated band write succeeds
  try {
    await firebaseDB.ref('bands/deadcetera/_slice_a_v2_test').set({ts: Date.now()});
    console.log('✓ V2 PASS: authenticated band write succeeded');
    await firebaseDB.ref('bands/deadcetera/_slice_a_v2_test').remove();
  } catch (e) {
    console.error('🚨 V2 FAIL: authenticated band write rejected:', e.code, e.message);
    console.error('  → Rules may not have been published, OR Firebase Auth context not reaching rules');
    return;
  }

  // V3: existing app write paths work (regression test)
  // Create a test annotation via the normal pathway
  try {
    const ann = await GLAnnotations.createAnnotation({
      text: 'slice A regression test',
      anchor: { kind: 'song', song_id: '_slice_a_test' }
    });
    console.log('✓ V3 PASS: GLAnnotations.createAnnotation worked (id:', ann.id + ')');
    await GLAnnotations.archiveAnnotation(ann.id);
  } catch (e) {
    console.error('🚨 V3 FAIL: existing app write path broken:', e.code, e.message);
    return;
  }

  // V4: Phase 1 immutability still enforced (regression test)
  try {
    const ann = await GLAnnotations.createAnnotation({
      text: 'slice A immutability regression',
      anchor: { kind: 'song', song_id: '_slice_a_test' }
    });
    await GLAnnotations.promoteToMemory(ann.id, { evidence: ['seg_test'] });
    try {
      await firebaseDB.ref('bands/deadcetera/annotations/' + ann.id + '/promoted_by').set('forged');
      console.error('🚨 V4 FAIL: Phase 1 immutability NO LONGER enforced — forgery succeeded');
    } catch (e) {
      console.log('✓ V4 PASS: Phase 1 immutability still enforced (forgery denied:', e.code + ')');
    }
    await GLAnnotations.archiveAnnotation(ann.id);
  } catch (e) {
    console.error('V4 setup error:', e.message);
  }

  // V5: auditProvenance still works
  const r = await GLAnnotations.auditProvenance({ refresh: true });
  console.log('✓ V5: auditProvenance scan:', r.scannedCount, 'records,', r.promotedCount, 'promoted,',
    r.issues.missing.length + r.issues.invalid.length + r.issues.inconsistent.length, 'issues');

  console.log('=== Slice A Verification Complete ===');
})();
```

Five verification points: Firebase Auth establishes (V1), authenticated band write works (V2), normal app write paths work (V3), Phase 1 immutability still enforced (V4), audit function still works (V5).

### §3.4 — Regression checks for normal app writes

Beyond V2-V5 above, manually exercise these flows in the app after Slice A.2 deploys:

| Flow | Expected |
|---|---|
| Add a comment in song-detail | Writes to `bands/$bandId/...` succeed |
| Toggle a song's readiness score | Writes to `bands/$bandId/songs/{title}/readiness/{memberKey}` succeed |
| Create a setlist | Writes to `bands/$bandId/setlists/{id}` succeed |
| Mark a rehearsal segment as confirmed | Writes to `bands/$bandId/rehearsal_sessions/{id}/segments/{segId}` succeed |
| Open Song DNA Listen lens | Reads succeed (no write involved) |
| Open Review Mode | Reads succeed |

If any flow surfaces `PERMISSION_DENIED` errors: Firebase Auth session is not being established at sign-in. Investigate before promoting to "Slice A verified."

---

## §4 — Rollback plan

### §4.1 — Rollback order — RULES FIRST

If anything is broken post-Slice-A:

1. **Rules rollback FIRST.** Revert `bands/$bandId/.write` from `"auth != null"` back to `true` in Console. Click Publish. Takes ~30 seconds.
2. **Code rollback SECOND** (only if code is the failure mode). `git revert <slice A code commit>` + atomic build bump + push.

Rules-first rollback is correct because: rules tightening is what produces the user-visible failure (writes deny). Reverting rules immediately restores the "wide-open write" state Stage 1 ships against. Code stays harmless (Firebase Auth wiring with rules at `.write: true` is a no-op for app behavior).

### §4.2 — Rules rollback JSON

```json
{
  "rules": {
    "care_packages_public": { ".read": true, ".write": false },
    "shared_setlists": { ".read": true, ".write": "true" },
    "bands": {
      ".read": true,
      "$bandId": {
        "practice_mixes": { ".indexOn": ["updatedAt"] },
        "feedback_reports": { ".indexOn": ["createdAt"] },
        "ideas": { "posts": { ".indexOn": ["ts"] } },
        "polls": { ".indexOn": ["ts"] },
        "gigs": { ".indexOn": ["date"] },
        "setlists": { ".indexOn": ["date"] },
        "calendar_events": { ".indexOn": ["date"] },
        "discussions": { "$songKey": { "messages": { ".indexOn": ["ts"] } } },
        "events": { "$eventId": { "comments": { ".indexOn": ["ts"] } } },
        "rehearsal_sessions": { ".indexOn": ["date", "startedAt"] },
        "activity_log": { ".indexOn": ["ts"] },
        "annotations": {
          "$annotationId": {
            "promoted":            { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promoted_by":         { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promoted_at":         { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promoted_from":       { ".validate": "!data.exists() || data.val() === newData.val()" },
            "promotion_authority": { ".validate": "!data.exists() || data.val() === newData.val()" }
          }
        },
        ".read": true,
        ".write": true
      }
    },
    "users": { ".read": false, ".write": false },
    "members_index": { ".read": true, ".write": false }
  }
}
```

This is identical to the current post-Stage-1 rules (preserves Phase 1 immutability and all Stage 1 locks; reverts only the one Slice A change).

### §4.3 — Code rollback

```bash
git revert <slice-A-commit-sha>
# Atomic 4-source build bump
# Push
```

After code rollback: new sessions stop establishing Firebase Auth. If rules are still tight, all writes fail. THIS IS WHY RULES MUST BE ROLLED BACK FIRST.

If rules have been rolled back already, code rollback is safe — the app reverts to OAuth-only and continues working.

### §4.4 — Failure modes

| Symptom | Likely cause | Action |
|---|---|---|
| Bandmate signs in but all writes fail with PERMISSION_DENIED | Firebase Auth session not established for this bandmate (browser-specific issue, network) | Telemetry check: `localStorage:gl_onboarding_stats.firebase_auth_signin_failed`. If only one bandmate affected, support them; if multiple, rules rollback. |
| All writes fail after Slice A.2 deploy | Rules tightening shipped before code (out-of-order deploy) | Rules rollback; verify code is deployed first; re-publish rules. |
| Sign-in flow breaks (Hero page never advances) | Firebase Auth signIn throws synchronously, blocking the flow | Code rollback. The signIn is `await`ed — if it throws, downstream `_glCheckBandMembership` never runs. Mitigation: wrap in try/catch as written in §1.2. |
| Phase 1 immutability stops working | Rules rollback was incomplete (lost the `.validate` rules) | Re-paste the full rollback JSON from §4.2; verify the 5 `.validate` blocks present. |
| Test user (`test@groovelinx.com`) writes fail | Anonymous sign-in failed in dev-mode path | Check Firebase project config: anonymous sign-in must be ENABLED in Authentication → Sign-in method. If not, enable it (1-click). |

### §4.5 — Pre-flight checklist (before deploy)

1. ✅ Anonymous sign-in enabled in Firebase Auth Console (for dev-mode path)
2. ✅ Google sign-in method enabled in Firebase Auth Console (typically already configured)
3. ✅ OAuth client ID matches Firebase project's authorized OAuth client (already does — same Google project)
4. ✅ Service worker CDN_PRECACHE includes `firebase-auth-compat.js` (verified — already in `service-worker.js:22`)
5. ✅ Verification sweep checklist ready (§3.3 snippet on hand)

If any item unchecked: STOP and resolve before deploy.

---

## §5 — Impact analysis

### §5.1 — What paths remain public after Slice A

Even after Slice A ships:

| Path | Posture post-Slice-A | Public exposure |
|---|---|---|
| `/bands/.read: true` | Top-level read | Anyone can list band slugs |
| `/bands/$bandId/.read: true` | Read still wide-open | Anyone can read any band's complete data tree |
| `/bands/$bandId/.write: "auth != null"` | **NEW: write requires auth** | Any signed-in Google user can write any band's data (NO membership check) |
| `/shared_setlists/.read: true` | Preserved | Public read |
| `/shared_setlists/.write: "true"` | Preserved | Public write (any client) |
| `/care_packages_public/.read: true` | Preserved | Public read |
| `/members_index/.read: true` | Preserved | Public read (needed by auth gate) |

### §5.2 — What Slice A solves

✅ **F14 (downgraded to MEDIUM):** the central exposure transitions from "wide-open public write" to "authenticated-Google-user write." Anonymous internet attackers no longer write band data.

✅ Firebase Auth is now wired in the codebase. Future slices (B/C/D) can build on `auth != null`, `auth.uid`, and `auth.token.email` in rules.

✅ The trust-layer foundation Memory Hardening Phase 2 needs is in place at the auth context level.

### §5.3 — What Slice A does NOT solve

❌ **F14 cross-band write isolation:** any signed-in Google user can write any band's data. Need Slice B's membership check.

❌ **Read posture:** `bands/$bandId/.read: true` still public. Any anonymous client can read all band data. Need Slice B read-tightening.

❌ **Admin role enforcement:** OWNER_EMAIL constant still gates admin features client-side. Need Slice C.

❌ **Memory Hardening Phase 2 gates:** promotion permission, Resolution confirmation, Re-open workflow. Need Slice D (after Slices A + B at minimum).

❌ **shared_setlists write posture:** preserved wide-open. Stage 2 / Slice B candidate.

❌ **Authorship convention consolidation (F1/F10):** not addressed.

❌ **OWNER_EMAIL retirement (F4):** not addressed.

### §5.4 — What Slice B must solve next

Slice B's core job: tighten `bands/$bandId/.write` from `"auth != null"` to **member-of-band-checked**, using Option B (auth.token.email + orderByChild + .indexOn) per the Phase 1 design.

Specifically:
- Add `.indexOn: "email"` on `bands/$bandId/meta/members`
- Change `bands/$bandId/.write` to:
  ```
  auth != null && root.child('bands/' + $bandId + '/meta/members').orderByChild('email').equalTo(auth.token.email).limitToFirst(1).numChildren() > 0
  ```
- Optionally: tighten `bands/$bandId/.read` similarly
- Optionally: tighten `shared_setlists/.write`

Slice B's design is the next Implementation Design spec. Out of Slice A scope.

### §5.5 — Trust-layer guarantee impact

Memory Hardening trust-layer guarantees post-Slice-A:

| Guarantee | Pre-Slice-A | Post-Slice-A |
|---|---|---|
| G1 (no Memory without provenance) | ✅ API + data layer | ✅ API + data layer (unchanged; `.validate` rules preserved) |
| G2 (provenance immutable from creation) | ✅ API + data layer | ✅ API + data layer (unchanged) |
| G7 (evidence references survive deletion) | ✅ | ✅ |
| G8 (provenance is queryable) | ✅ | ✅ |
| G3 (promotion authority enforced) | ❌ | Partial: `auth != null` requirement is a foundation for G3 but does not enforce membership or permission |
| G4 (AI cannot self-promote) | ❌ | Partial: Firebase Auth identity now distinct from anonymous; no service account distinction yet |
| G5 (Resolution requires confidence + confirmation) | ❌ | ❌ (Slice D) |
| G6 (Re-open is first-class) | ❌ | ❌ (Slice D) |

Slice A is a foundation move, not a guarantee-completion move. It builds the auth context that later slices will read.

---

## §6 — Open decisions resolved per Drew's directive

Per Drew's open-decisions list for Slice A:

| Decision | Drew's resolution | Reflected in this spec |
|---|---|---|
| Backfill authorship | NO | Not addressed in Slice A |
| Retire OWNER_EMAIL | NO | Not addressed in Slice A |
| Change shared_setlists | NO | Preserved verbatim in §2.3 |
| Start Memory Phase 2 | NO | Out of scope |

These are out of scope. They remain on the Authority Resolution Phase 1 Design v1 §8 open-questions list for later slices.

### §6.1 — Remaining open decisions for Slice A specifically

1. **Sub-slice or combined ship?** §2.4 recommends sub-slicing (A.1 code → A.2 rules) as safer. Drew picks.
2. **Sub-slice duration?** If sub-sliced, how long to watch A.1 before promoting to A.2? Recommendation: until each active bandmate has `firebase_auth_signin_ok` at least once, OR 7 days minimum.
3. **Anonymous sign-in enable confirmation:** §4.5 pre-flight requires anonymous sign-in to be enabled in Firebase Auth Console. Drew confirms before deploy.
4. **`onAuthStateChanged` listener for session-loss handling:** §1.4 marks as out of Slice A scope. Drew confirms — or escalates to Slice A scope.

---

## §7 — What this design settles vs does NOT settle

### Settles
- Where to hook Firebase Auth wiring (`getCurrentUserEmail` post-OAuth-success)
- How to sign in (`signInWithCredential` with Google access token; anonymous in dev mode)
- Error handling (fail-open with telemetry)
- Auth lifecycle (sign-in path; sign-out path in `handleGoogleDriveAuth`; no token-refresh re-sign in Slice A)
- Dev-mode behavior (anonymous sign-in for `test@groovelinx.com`)
- The single rule change (`bands/$bandId/.write: true → "auth != null"`)
- What's preserved (everything else — verbatim)
- Sub-slice recommendation (A.1 → A.2)
- Verification plan (6 Playground scenarios + REST sweep + browser devtools snippet + regression flows)
- Rollback order (rules first, code second)
- Rollback JSON (§4.2)
- Pre-flight checklist
- Impact analysis (what Slice A solves vs doesn't)

### Does NOT settle
- The actual code (no implementation in this spec)
- Final operator deploy decision (Drew authorizes)
- Sub-slice vs combined ship decision (§6.1 #1)
- Sub-slice duration (§6.1 #2)
- `onAuthStateChanged` scope decision (§6.1 #4)
- Slice B/C/D details (touched only as dependency notes)

---

## §8 — Recommended next phase

Once Slice A ships and verifies:
1. **Slice B Implementation Design** — analogous spec for the membership-checked write rule (Option B from Phase 1 design). Specifies the rule shape, `.indexOn: "email"` addition, verification sweep with authenticated-member vs authenticated-non-member contexts.
2. **OR** open-decisions session to resolve §6.1 items if Drew prefers explicit decisions before Slice A authorization.

Standing by for Drew authorization to either:
- Authorize Slice A.1 (code-only sub-slice) to begin implementation
- Authorize combined Slice A (code + rules) to begin implementation
- Resolve §6.1 open decisions first

---

## Closing posture

Slice A is the smallest possible step that closes the F14 central exposure to "authenticated-Google-user" posture. One rule changes; ~20 lines of code added in `app.js` + ~10 lines added in `firebase-service.js` sign-out path. Memory Hardening Phase 1 trust contract preserved. All Stage 1 locks preserved. Dev-mode handled via anonymous sign-in. Rollback is single-rule and reversible.

Slice A does NOT close F14 fully. It downgrades the central exposure from CRITICAL-when-public to MEDIUM-when-any-authenticated-user. Slice B (membership check) is what closes F14 fully. Slice A is the prerequisite that makes Slice B's rule shape possible.

The architecture continues consolidating. No new primitives. No new authority subsystem. The existing surfaces are picking their canonical roles, in order, with bounded reversible steps.

Awaiting Drew signal.
