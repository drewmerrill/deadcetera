# Memory Hardening Phase 1 — Deploy Runbook

> Companion to `02_GrooveLinx/specs/memory_hardening_phase_1_implementation_design_v1.md` and `memory_hardening_phase_1_verification_audit_v1.md`. This file is the operator-facing runbook for shipping Phase 1.

**Build:** `20260530-150905`
**Components:** Firebase rules (Console UI) + code (`js/core/gl-annotations.js`)
**Deploy order (corrected per verification audit C3):** Rules FIRST, code SECOND.

---

## §0 — Why rules first

Firebase rules deploy is manual via the Console UI for project `deadcetera-35424` (rules are NOT in the repo per `02_GrooveLinx/docs/firebase-rules-snippet.md`). Manual deploy means an operator-attention-bounded window — realistically hours, not minutes.

If code shipped first, that window would permit direct console writes to promotion fields without immutability enforcement. Shipping rules first is safe because the immutability rule pattern `!data.exists() || data.val() === newData.val()` evaluates true when the field has never been written — so existing annotation writes continue to work normally before code lands.

---

## §1 — STEP 1: Firebase Console rules merge

### What you are adding

Five field-level immutability rules under `bands/$slug/annotations/$annotationId/`. Each uses the standard Firebase RTDB immutability idiom: writes succeed only if the field has never been set, or if the new value exactly matches the existing value.

### The exact snippet to merge

Console URL: <https://console.firebase.google.com/> → project `deadcetera-35424` → Realtime Database → Rules tab.

```json
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
}
```

### Where this goes in the existing rules JSON

Inside `rules.bands.$slug`. If an `annotations` key already exists there, merge the `$annotationId` child block into it. If `annotations` does not exist at that level today, add it as a new sibling alongside `members`, `readiness`, `crib_notes`, etc.

Example merged shape (preserving existing rules — do NOT replace the whole JSON):

```json
{
  "rules": {
    "bands": {
      "$slug": {
        ".read":  "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()",
        ".write": "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()",

        // ... existing children (members, readiness, crib_notes, songs, etc.) ...

        "annotations": {
          "$annotationId": {
            "promoted":            { ".write": "!data.exists() || data.val() === newData.val()" },
            "promoted_by":         { ".write": "!data.exists() || data.val() === newData.val()" },
            "promoted_at":         { ".write": "!data.exists() || data.val() === newData.val()" },
            "promoted_from":       { ".write": "!data.exists() || data.val() === newData.val()" },
            "promotion_authority": { ".write": "!data.exists() || data.val() === newData.val()" }
          }
        },

        "$other": {
          ".read":  "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()",
          ".write": "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()"
        }
      }
    }
  }
}
```

### How rule cascading works here

When a member writes to `bands/deadcetera/annotations/abc123`, Firebase evaluates:

1. Parent `$slug` rule (membership check) — **must pass.** Permits the write generally.
2. Child `annotations/$annotationId/promoted` rule — **must pass** for any write to `promoted` specifically. Permits the write only if promoted has never been set OR new value matches old.

Result: members can create new annotations freely. Members can promote (writes promoted=true the first time). Members cannot un-promote or alter promotion fields after promotion.

The existing `$other` catch-all is preserved for any band-scoped paths not explicitly listed.

---

## §2 — STEP 2: Test in Firebase Rules Playground BEFORE Publish

The Console has a Rules Playground tab. Use it. Required scenarios:

| # | Scenario | Path | Auth | Operation | Expected |
|---|---|---|---|---|---|
| 1 | Member creates new annotation | `/bands/deadcetera/annotations/test123` | Member UID | `set({...full annotation, no promoted}...)` | ✅ Allow |
| 2 | Member promotes annotation first time | `/bands/deadcetera/annotations/test123/promoted` | Member UID | `set(true)` | ✅ Allow |
| 3 | Member writes promotion fields first time | `/bands/deadcetera/annotations/test123/promoted_by` | Member UID | `set("brian")` | ✅ Allow |
| 4 | Member tries to un-promote already promoted | `/bands/deadcetera/annotations/test123/promoted` | Member UID | `set(false)` | ❌ Deny |
| 5 | Member tries to overwrite promoted_by | `/bands/deadcetera/annotations/test123/promoted_by` | Member UID | `set("notbrian")` | ❌ Deny |
| 6 | Member updates `status` on promoted annotation | `/bands/deadcetera/annotations/test123/status` | Member UID | `set("fixed")` | ✅ Allow (status is not in immutability set) |
| 7 | Non-member tries to promote | `/bands/deadcetera/annotations/test123/promoted` | Non-member UID | `set(true)` | ❌ Deny (parent membership rule) |
| 8 | Member re-writes promotion fields with same values | `/bands/deadcetera/annotations/test123/promoted_at` | Member UID | `set(<same value>)` | ✅ Allow (idempotent overwrite permitted) |

If any scenario fails the expected result, STOP. Debug rule syntax. Re-test. Do not Publish until all 8 pass.

---

## §3 — STEP 3: Publish rules

After Playground tests pass, click **Publish** in the Console.

Verify post-publish: re-run scenario 4 from a real test client (devtools console in dev band):

```js
// On a known-promoted annotation in your dev band:
firebaseDB.ref('bands/deadcetera/annotations/<promoted_id>/promoted').set(false)
  .then(() => console.error('❌ FAILED — immutability not enforced'))
  .catch(err => console.log('✓ OK — rule rejected as expected:', err.code));
```

Expected: rule rejection (`PERMISSION_DENIED`).

---

## §4 — STEP 4: Code deploy

Atomic build bump per the standard deploy ritual (CLAUDE.md §OPERATIONAL DISCIPLINE rule 4):

- `<meta name="build-version">` in `index.html` AND `index-dev.html` → `20260530-150905`
- All `?v=` query params in both HTMLs replaced via `replace_all: true` (~154 occurrences each)
- `version.json` bumped
- `service-worker.js` `CACHE_NAME` bumped to `groovelinx-20260530-150905`

Then: commit + push.

---

## §5 — STEP 5: Verification

After the deploy lands, run in the devtools console (logged in as a band member):

```js
// Expected: 0 promoted, 0 issues (nothing has been promoted yet in production)
GLAnnotations.auditProvenance({ refresh: true }).then(r => {
  console.log('Audit report:', r);
  console.assert(r.promotedCount === 0, 'Expected no promotions yet');
  console.assert(r.issues.missing.length === 0 && r.issues.invalid.length === 0 && r.issues.inconsistent.length === 0, 'Expected no issues');
});
```

Then test the promotion path on a real (or test) annotation in dev:

```js
// 1. Create a test annotation
GLAnnotations.createAnnotation({
  text: 'phase 1 deploy verification',
  anchor: { kind: 'song', song_id: 'test_song' }
}).then(a => window._testAnn = a);

// 2. Promote it
GLAnnotations.promoteToMemory(window._testAnn.id, { evidence: ['seg_test_evidence'] })
  .then(r => console.log('✓ Promoted:', r))
  .catch(e => console.error('Promote failed:', e));

// 3. Try to promote again (should reject)
GLAnnotations.promoteToMemory(window._testAnn.id, { evidence: ['seg_test'] })
  .then(r => console.error('❌ Re-promotion should have failed'))
  .catch(e => console.log('✓ Re-promotion correctly rejected:', e.message));

// 4. Try to modify promotion fields via updateAnnotation (warn + drop)
GLAnnotations.updateAnnotation(window._testAnn.id, { promoted_by: 'someone_else' })
  .then(() => console.log('✓ updateAnnotation silently dropped promoted_by (check console for warn)'));

// 5. Audit — expect 1 promoted, 0 issues
GLAnnotations.auditProvenance({ refresh: true, songId: 'test_song' }).then(r => {
  console.log('Audit:', r);
  console.assert(r.promotedCount === 1, 'Expected 1 promotion');
  console.assert(r.issues.missing.length === 0, 'Expected no missing');
});

// 6. Cleanup: archive the test annotation
GLAnnotations.archiveAnnotation(window._testAnn.id);
```

If all 6 steps behave as expected → Phase 1 ship verified.

---

## §6 — Rollback

### Code rollback

Revert the commit. New annotations stop receiving promotion fields. Existing promoted annotations retain their fields (data is not removed). Phase 1 functions become undefined; the defensive warn in updateAnnotation is gone. No data loss.

### Rules rollback

Edit Console rules: remove the `annotations/$annotationId/promoted*` field-level blocks. Click Publish. Direct console writes to promotion fields again become permitted. The API-surface whitelist still prevents accidental writes from updateAnnotation, so day-to-day behavior is unaffected. No data loss.

Both rollbacks are independent and clean.

---

## §7 — Known Phase 2 migration target

`js/features/rehearsal.js:1937` programmatically writes `{ status: 'fixed' }` via an auto-resolve helper. Phase 1 does NOT gate this — status='fixed' writes remain freely settable. Phase 2's planned Resolution-confirmation enforcement will BREAK this caller unless it is migrated to use a future typed `resolveAnnotation()` helper that supplies the required confirmation fields.

**Action for Phase 2 inventory:** before Phase 2 ships, grep for any code path that calls `GLAnnotations.updateAnnotation` with `status: 'fixed'`. Known caller: `js/features/rehearsal.js:1937`. Each must be migrated to the future typed Resolution path OR explicitly grandfathered.

---

## §8 — What Phase 1 ships, what it does NOT

### Ships
- Five-field promotion provenance extension on annotation records (optional, immutable once set)
- `GLAnnotations.promoteToMemory()` canonical pathway
- `GLAnnotations.auditProvenance()` trust-layer audit
- Defensive warn in `updateAnnotation` for promotion-field write attempts
- Firebase rules enforcing field-level immutability on the five new fields
- `auth_version: 'phase1'` marker on every Phase 1 promotion (honestly records that authority was NOT enforced)

### Does NOT ship
- Authority permissions for Memory transitions (Phase 2)
- Server-side authority enforcement on promotion writes (Phase 2)
- Resolution-confirmation field enforcement (Phase 2)
- Re-open workflow (Phase 2)
- UI surfaces (MVLS proper)
- New primitives (none)
- Backfill of historical annotations as Memory (out of scope by design — retroactive promotion without human gate would violate trust layer)
- Comparison engine integration (post-Phase 2)
