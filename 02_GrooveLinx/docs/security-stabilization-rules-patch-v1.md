# Security Stabilization Rules Patch v1

> **Production security stabilization. Not a full Authority Resolution design. Not MVLS. Console-ready rules patch + Playground tests + rollback notes.**
>
> Author voice: GrooveLinx Principal Architect. Honest about what a pure rules patch can and cannot achieve given current code state.
>
> **Purpose:** close the largest currently-exploitable public exposures in the deployed Firebase Realtime Database rules WITHOUT requiring a code deploy, while preserving current app functionality.
>
> **Inputs:**
> - Deployed rules JSON (operator-supplied 2026-05-30)
> - `02_GrooveLinx/specs/authority_fragmentation_readiness_audit_v1.md` (the readiness audit identifying F13 and F14 as CRITICAL)
> - Codebase confirmation: Firebase Auth is NOT wired in the app (Google OAuth only)
> - `02_GrooveLinx/docs/memory-hardening-phase-1-deploy.md` (Phase 1 immutability rules already designed)

---

## §0 — Critical operating constraint (disclosure)

**The GrooveLinx app does NOT establish Firebase Auth sessions.** The Firebase Auth SDK is loaded via the compat script but is NEVER invoked. The app authenticates via Google OAuth, stores `currentUserEmail` in localStorage, and reads/writes Firebase RTDB through the `firebase.database()` SDK WITHOUT a Firebase Auth context.

**Implication:** in any RTDB security rule, `auth` is always `null`. **Adding `auth != null` to any rule that the app currently writes to will reject those writes and break the feature.**

Verified by exhaustive grep for: `firebase.auth()`, `signInWithCredential`, `signInWithPopup`, `GoogleAuthProvider`, `onAuthStateChanged`, `auth().currentUser`. Zero hits across `app.js`, all of `js/`, and `index.html`.

**Therefore:** the security patch must work WITHOUT requiring `auth != null` on paths the app actively writes to.

This document presents a STAGE 1 patch (rules-only, ships now) and outlines a STAGE 2 (code change + rules tightening — separate work, NOT done in this patch).

---

## §1 — Stage 1 — what CAN be done in a pure rules patch

These changes do NOT require Firebase Auth to be wired. They are safe to ship today.

### S1-A. Lock down `/users/` entirely

- **Current rule:** `.read: "true"`, `.write: "true"` (wide open).
- **Code usage:** ZERO. Grep confirms no code writes to or reads from `/users/`.
- **Patch:** `.read: false`, `.write: false`.
- **Effect:** anyone attempting to read/write `/users/` is denied. App functionality unaffected.

### S1-B. Lock down `/care_packages_public/` write further

- **Current rule:** `.read: true`, `.write: "auth != null"`.
- **Code usage:** ONE write site (`notifications.js:149`). Since the app doesn't establish Firebase Auth, this write currently SUCCEEDS only if a different mechanism (Cloud Function, admin SDK) handles it OR is silently failing.
- **Patch:** keep `.read: true`, change `.write` to `false` (Cloud-Function-only).
- **Effect:** if there is a Cloud Function path for care package creation, it continues to work (admin SDK bypasses rules). If the client write was working, it stops working — but the deployed rule was already declaring intent to deny client writes via `auth != null`. This patch makes the intent explicit.
- **Risk:** if care package creation was actually working from the client (rules misconfiguration somewhere), it stops. Drew should validate care package creation flow post-deploy.

### S1-C. Add Memory Hardening Phase 1 field-level immutability under annotations

- **Current rule:** none under `bands/$bandId/annotations/$annotationId/`.
- **Code path:** `js/core/gl-annotations.js` `promoteToMemory()` writes five promotion fields once; should be immutable thereafter.
- **Patch:** add the five field-level immutability rules from `memory-hardening-phase-1-deploy.md` §1 under `bands/$bandId/annotations/$annotationId/`.
- **Effect:** restores Memory Hardening Phase 1 to its claimed END-TO-END state. Field modification after first write is rejected by the data layer.
- **Constraint preserved:** the parent `bands/$bandId/.write: true` remains open (because removing it requires Firebase Auth). This means an attacker could still DELETE an annotation entirely or write a fresh annotation with arbitrary `promoted_*` values — but cannot MODIFY existing promotion fields.

### S1-D. Preserve everything else exactly as deployed

- `care_packages_public/.read: true` — preserved (intentional public broadcast).
- `shared_setlists/.read: true, .write: "true"` — **preserved as-is** because `shared_setlists/{slug}` writes from `setlists.js:2877` would break if tightened to `auth != null`. Hardening this requires Stage 2.
- `bands/.read: true` — preserved (top-level listing).
- `bands/$bandId/.read: true, .write: true` — **preserved as-is** (the central exposure). Hardening this is Stage 2's core work.
- All `.indexOn` declarations — preserved verbatim.
- `members_index/.read: true, .write: "false"` — preserved (correctly Cloud-Function-only already).

### Stage 1 summary

The patch closes:
- One unused exposed path (`/users/`)
- One client-write-deprecated path (`/care_packages_public/.write`)
- The Phase 1 immutability gap (under annotations)

The patch does NOT close (deferred to Stage 2):
- `bands/$bandId` wide-open read AND write
- `shared_setlists` wide-open write

Honest assessment: **this patch reduces attack surface meaningfully but does NOT remove the central exposure.** The central exposure (`bands/$bandId/.write: true`) requires Firebase Auth wiring before rules can be tightened. That's Stage 2.

---

## §2 — Stage 2 — what CANNOT be done in a pure rules patch

These changes require code work. Surface them so Drew knows they're queued, not forgotten.

### S2-A. Wire Firebase Auth using existing Google OAuth credential

**Code change needed:** after Google OAuth succeeds in `getCurrentUserEmail()` (`app.js:5826`), establish a Firebase Auth session using `firebase.auth().signInWithCredential(googleCredential)`. This makes `auth` non-null in RTDB rules and exposes `auth.uid` and `auth.token.email`.

**Scope:** small — a few lines of code in `app.js` + the Firebase Auth SDK is already loaded in the SW precache.

**Risk:** moderate — code touches the auth flow. Requires careful testing because every existing user's auth state changes from "Google-only" to "Google + Firebase Auth."

### S2-B. Tighten `bands/$bandId/.write` to require auth

**Once S2-A lands**, this rule can change from `.write: true` to `.write: "auth != null"`. Minimum gate: any signed-in Google user can read/write any band's data. Better than wide-open public; still very permissive at the cross-band level.

### S2-C. Tighten further to require membership

**Beyond S2-B**, the documented design is `.write: "auth != null && root.child('bands/' + $bandId + '/members/' + auth.uid).exists()"`. But the deployed code stores members at `bands/{slug}/meta/members/{memberKey}` not `bands/{slug}/members/{auth.uid}` — so this rule shape needs reconciliation with the storage shape. This is the F3 design question explicitly paused.

### S2-D. Tighten `shared_setlists/.write`

After S2-A, `.write: "auth != null"` is sufficient and preserves the share-setlist flow.

---

## §3 — Stage 1 Console-ready rules patch (full JSON)

**Deploy procedure:** in the Firebase Console for project `deadcetera-35424` → Realtime Database → Rules → **REPLACE the entire rules tree with the JSON below** (this is a full replacement, not a partial merge, because the changes touch multiple top-level paths and the diff is clean). Test in Rules Playground BEFORE clicking Publish.

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
            "promoted": {
              ".write": "!data.exists() || data.val() === newData.val()"
            },
            "promoted_by": {
              ".write": "!data.exists() || data.val() === newData.val()"
            },
            "promoted_at": {
              ".write": "!data.exists() || data.val() === newData.val()"
            },
            "promoted_from": {
              ".write": "!data.exists() || data.val() === newData.val()"
            },
            "promotion_authority": {
              ".write": "!data.exists() || data.val() === newData.val()"
            }
          }
        },
        ".read": true,
        ".write": true
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

### Diff summary (vs deployed)

- `care_packages_public/.write`: `"auth != null"` → `false`
- `users/.read`: `"true"` → `false`
- `users/.write`: `"true"` → `false`
- `bands/$bandId/annotations/$annotationId/` block — newly added with 5 field-level immutability rules
- All other rules preserved verbatim

---

## §4 — Rules Playground test cases

Run these in the Firebase Console Rules Playground BEFORE clicking Publish.

| # | Scenario | Path | Auth | Operation | Expected |
|---|---|---|---|---|---|
| 1 | Read band data (current app behavior) | `/bands/deadcetera/songs/anysong` | unauthenticated | `get` | ✅ Allow (preserves wide-open read) |
| 2 | Write band data (current app behavior) | `/bands/deadcetera/songs/anysong/notes` | unauthenticated | `set("hello")` | ✅ Allow (preserves wide-open write — Stage 2 will tighten) |
| 3 | Promote annotation first time | `/bands/deadcetera/annotations/test123/promoted` | unauthenticated | `set(true)` | ✅ Allow (immutability rule's first-write branch) |
| 4 | Write all promotion fields first time | `/bands/deadcetera/annotations/test123` | unauthenticated | `update({promoted: true, promoted_by: "drew", promoted_at: 1700000000000, promoted_from: ["seg_1"], promotion_authority: {memberKey: "drew", role: "member", permissions: [], snapshot_at: 1700000000000, auth_version: "phase1"}})` | ✅ Allow (all five branches' first-write) |
| 5 | Modify `promoted_by` on already-promoted record | `/bands/deadcetera/annotations/test123/promoted_by` | unauthenticated | `set("forged")` | ❌ Deny (immutability rejects modification) |
| 6 | Modify `promoted_at` on already-promoted record | `/bands/deadcetera/annotations/test123/promoted_at` | unauthenticated | `set(0)` | ❌ Deny (immutability rejects modification) |
| 7 | Modify `status` (non-immutable field) on promoted annotation | `/bands/deadcetera/annotations/test123/status` | unauthenticated | `set("fixed")` | ✅ Allow (status is NOT in immutability set) |
| 8 | Re-write `promoted_by` with same value | `/bands/deadcetera/annotations/test123/promoted_by` | unauthenticated | `set("drew")` | ✅ Allow (idempotent rule branch) |
| 9 | Read `/users/` | `/users/anything` | unauthenticated OR authenticated | `get` | ❌ Deny (now locked) |
| 10 | Write `/users/` | `/users/anything` | unauthenticated OR authenticated | `set("anything")` | ❌ Deny (now locked) |
| 11 | Write `/care_packages_public/{id}` from client | `/care_packages_public/pkg_test` | unauthenticated | `set({...})` | ❌ Deny (now Cloud-Function-only) |
| 12 | Read `/care_packages_public/{id}` | `/care_packages_public/pkg_test` | unauthenticated | `get` | ✅ Allow (preserves public read) |
| 13 | Read `/shared_setlists/{slug}` | `/shared_setlists/sometest` | unauthenticated | `get` | ✅ Allow (preserves public read) |
| 14 | Write `/shared_setlists/{slug}` | `/shared_setlists/sometest` | unauthenticated | `set({...})` | ✅ Allow (preserves wide-open write — Stage 2 will tighten) |
| 15 | Read `/members_index/{key}` | `/members_index/sometest_at_gmail_com` | unauthenticated | `get` | ✅ Allow (preserves auth-gate lookup) |
| 16 | Write `/members_index/{key}` from client | `/members_index/sometest` | unauthenticated | `set("anyband")` | ❌ Deny (preserved Cloud-Function-only) |

**All 16 must pass before Publish.** If any fails, debug rule syntax before deploying.

---

## §5 — Rollback notes

### Rollback to deployed-rules-as-of-2026-05-30

If the patch causes unexpected failures, revert by pasting back the original deployed rules:

```json
{
  "rules": {
    "care_packages_public": {
      ".read": true,
      ".write": "auth != null"
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
        ".read": true,
        ".write": true
      }
    },
    "users": {
      ".read": "true",
      ".write": "true"
    },
    "members_index": {
      ".read": true,
      ".write": "false"
    }
  }
}
```

Click Publish in Console. Rollback completes immediately.

**Data side:** no data is moved or deleted by this patch. Rules changes are read-side enforcement only. Rollback has zero data implications.

### Specific failure scenarios and rollback triggers

| Symptom | Likely cause | Rollback? |
|---|---|---|
| Care package creation broken | S1-B was wrong — client write WAS working | Yes — revert care_packages_public rule only |
| Some band feature unable to write something previously fine | Unexpected coverage of S1-A or S1-B | Yes — full rollback to be safe; debug |
| `auditProvenance()` reports new issues | Pre-existing data inconsistency — NOT caused by this patch | No — investigate data |
| Cannot promote new annotations | The Phase 1 immutability rule is missing or malformed | Re-check rule syntax in Console; do NOT roll back the whole patch — only the annotations sub-block |
| Cannot modify any annotation `text` / `status` | Over-broad rule capture — should NOT happen given the patch only restricts the 5 promotion fields | Roll back; debug |

---

## §6 — Honest residual risk after Stage 1

The patch closes meaningful exposures but **does not close the central exposure**: `bands/$bandId/.write: true` remains in place. Anyone with the Firebase project config (visible in the client app's DevTools) can still write directly to `bands/{any_slug}/*` via Firebase SDK.

After Stage 1, an attacker can still:
- Read all band data (preserved by `bands.$bandId/.read: true`)
- Write to any band path (preserved by `bands.$bandId/.write: true`)
- Delete annotations (delete is a write; the immutability rule only prevents MODIFICATION, not DELETION)
- Inject fabricated annotations with arbitrary promotion fields (the immutability rule's `!data.exists()` branch allows fresh writes; only re-writes are blocked)
- Write to `/shared_setlists/{any_slug}` (preserved wide open)

After Stage 1, an attacker cannot:
- Modify already-promoted annotation provenance fields (Phase 1 immutability now enforced)
- Read or write `/users/` (locked)
- Write `/care_packages_public/` from client (Cloud-Function-only)

**Stage 1 is a partial mitigation, not a comprehensive fix.** Stage 2 (Firebase Auth wiring + rule tightening) is required to close the central exposure. Stage 2 is code work and is NOT included in this patch.

---

## §7 — Deploy sequence

1. **Pre-deploy:** confirm no in-flight rehearsal recording / multitrack ingest in progress. The patch is non-disruptive but safer to deploy during quiet time.
2. **Step 1:** in Firebase Console → Project `deadcetera-35424` → Realtime Database → Rules. Paste the Stage 1 JSON from §3 into the editor. **Do NOT click Publish yet.**
3. **Step 2:** open the Rules Playground tab (in the Console). Run all 16 scenarios from §4. All must pass.
4. **Step 3:** if all pass, click **Publish**.
5. **Step 4 (verification):** in devtools console on app.groovelinx.com (logged in), run:
   ```js
   // Should still succeed (band write is preserved)
   firebaseDB.ref('bands/deadcetera/_security_patch_test').set({ts: Date.now()}).then(
     () => console.log('✓ Band write still works'),
     e => console.error('✗ BAND WRITE BROKEN:', e.code)
   );
   // Should be denied (users locked)
   firebaseDB.ref('users/test').set('test').then(
     () => console.error('✗ /users/ write NOT blocked'),
     e => console.log('✓ /users/ write correctly denied:', e.code)
   );
   ```
6. **Step 5:** clean up the test write: `firebaseDB.ref('bands/deadcetera/_security_patch_test').remove()`.
7. **Step 6 (Phase 1 verification):** run the existing Phase 1 verification from `memory-hardening-phase-1-deploy.md` §5 — create a test annotation, promote it, attempt to forge `promoted_by`, confirm rejection.

If Step 4's first test fails: ROLL BACK IMMEDIATELY per §5. The band-write preservation is the most important property of this patch.

If Step 4's second test fails: investigate; the `/users/` lock is the new restriction.

If Step 6's forge attempt SUCCEEDS (it should be denied): the Phase 1 immutability rules are not effective. Check rule syntax in Console.

---

## §8 — Handoff + phase tracker corrections (per Drew Goal #10)

Per Drew's directive: "Correct `CURRENT_PHASE.md` / `CLAUDE_HANDOFF.md` so Memory Phase 1 is marked: **SHIPPED IN CODE — RULES ENFORCEMENT PENDING / SECURITY PATCH REQUIRED**"

These corrections are made in the same commit as this patch document. They:
- Revert the "Memory Hardening Phase 1 VERIFIED END-TO-END" overclaim from 2026-05-30 15:23 UTC
- Revert trust-layer guarantee status of G1/G2 from "operational at both API and data layers" back to "operational at API layer only"
- Add the security patch context as the next operator action
- Add F13 + F14 (the readiness-audit-surfaced findings) to the workstream status

The corrections leave the audit-trail intact — the prior "VERIFIED END-TO-END" SESSION CLOSE entry remains in the dated history (per the no-rewrite-history discipline), but a new SESSION CLOSE entry above it documents the correction.

---

## §9 — Recommended sequence

1. **Right now (Drew):** review this patch. If approved, run the deploy procedure (§7) — Console rules patch + 16 Playground tests + Publish + verification.
2. **Right now (Claude, in same commit):** apply handoff + phase tracker corrections per §8.
3. **After Stage 1 deploys cleanly:** Memory Hardening Phase 1 is restored to actual END-TO-END state for the field-level immutability. The central `bands/$bandId` exposure remains open pending Stage 2.
4. **Stage 2 (deferred — code change required):** wire Firebase Auth via `signInWithCredential` post-Google-OAuth, then tighten `bands/$bandId/.write` and `shared_setlists/.write` to `auth != null` minimum. This is a separate design + implementation pass.
5. **Authority Resolution Phase 1 Design** (currently paused per Drew): can resume after Stage 2 lands.

---

## §10 — What this patch settles vs does NOT settle

### Settles
- F13 (Phase 1 immutability rules absent) — RESOLVED after Stage 1 deploys.
- F15-partial (`/users/` wide-open write) — RESOLVED after Stage 1 deploys.
- `/care_packages_public/` deprecated client-write — explicit after Stage 1.
- Honest documentation of Memory Hardening Phase 1 actual status.

### Does NOT settle
- F14 (`bands/$bandId` wide-open) — central exposure remains. Stage 2.
- `/shared_setlists/.write: true` — remains wide-open. Stage 2.
- The keying-convention design question (F3-reactivated) — design work, paused.
- Full Authority Resolution — paused per Drew.
- MVLS — NOT AUTHORIZED.

---

## Closing posture

This patch closes the smallest meaningful security gaps that a pure rules-only change can close given the constraint that Firebase Auth is not wired. It honestly does NOT close the largest exposure (the `bands/$bandId` central wide-open posture) because doing so requires code work first.

The patch is small, reversible, and Console-deployable in ~15 minutes including all 16 Playground tests. After it ships, Memory Hardening Phase 1 is genuinely END-TO-END. The central exposure remains as a Stage 2 concern.

**Authorize Stage 1. Sequence Stage 2 separately.**
