# Memory Hardening Phase 1 — Implementation Verification Audit v1

> **Verification audit. Design-only. NOT a redesign. NOT a new spec. No code. No schema additions. No architecture expansion.**
>
> Author voice: GrooveLinx Principal Architect. Codebase-grounded verification, not retrospective second-guessing.
>
> **Purpose:** verify whether the Phase 1 implementation design can be executed exactly as written, by auditing every claim against the actual codebase. Surface required design corrections without changing the core architecture.
>
> **Inputs (authoritative):**
> - memory_hardening_implementation_readiness_v1.md
> - memory_hardening_phase_1_implementation_design_v1.md
> - js/core/gl-annotations.js (actual code, 293 lines)
> - firebase.json (actual config, 16 lines — Cloud Functions only)
> - 02_GrooveLinx/docs/firebase-rules-snippet.md (rules deployment posture doc)
> - 02_GrooveLinx/specs/groovelinx-firebase-rules-notes.md (rules design doc)
> - js/features/rehearsal.js, js/features/song-detail.js, js/core/gl-takes.js (GLAnnotations consumers)
> - js/core/firebase-service.js (bandPath helper)

---

## §0 — Method

For each Phase 1 design claim:

1. Locate the asserted code / config / data path.
2. Confirm shape matches design assumption.
3. Identify any gap, mismatch, or risk.

Findings classified as **VERIFIED**, **INVALID**, **RISK**, or **REQUIRED DESIGN CORRECTION**.

The audit examined 11 design claims, 5 file-touch assumptions, 7 caller-compatibility assumptions, the deploy sequence, and the rollback strategy.

---

## §1 — VERIFIED assumptions

### V1 — GLAnnotations primitive exists and matches design shape

`js/core/gl-annotations.js` (293 lines, Phase 1 shipped) exposes the exact API the design assumed:
- `createAnnotation`, `updateAnnotation`, `archiveAnnotation`, `unarchiveAnnotation`
- `listAnnotationsByAnchor`, `listAnnotationsBySong`, `listAnnotationsForMember`, `listOpenAnnotationsForMember`
- `refreshCache`
- `STATUSES`, `ANCHOR_KINDS` constants

Internal helpers also match design assumptions:
- `_author()` — memberKey via `getCurrentMemberKey()` with email-split fallback
- `_normalizeAnchor()` — anchor.kind validation against `ANCHOR_KINDS`
- `_normalizeStatus()` — status validation against `STATUSES`
- `_ensureLoaded()` — load-once + 60s cache + promise-coalescing

**Design assumption confirmed.** `promoteToMemory()` and `auditProvenance()` can be added alongside without architectural disruption.

### V2 — Storage path is `bands/{slug}/annotations/{annotationId}`

`gl-annotations.js:66-69`:
```js
function _path(suffix) {
  if (typeof bandPath !== 'function') return null;
  return bandPath('annotations' + (suffix ? '/' + suffix : ''));
}
```

`js/core/firebase-service.js:104-106`:
```js
window.bandPath = function bandPath(subpath) {
    return 'bands/' + currentBandSlug + (subpath ? '/' + subpath : '');
};
```

**Design assumption confirmed.** The full path is `bands/{currentBandSlug}/annotations/{annotationId}`. Note: variable is `currentBandSlug` (string slug like `deadcetera`), not a numeric `$bandId`.

### V3 — updateAnnotation whitelist behavior

`gl-annotations.js:187-194` (the `safe` object) explicitly lists every accepted patch field:

```js
var safe = {};
if (typeof patch.text === 'string') safe.text = patch.text.trim();
if (patch.anchor) safe.anchor = _normalizeAnchor(patch.anchor);
if (Array.isArray(patch.tagged_members)) safe.tagged_members = patch.tagged_members.slice();
if (patch.status) safe.status = _normalizeStatus(patch.status);
if (typeof patch.archived === 'boolean') safe.archived = patch.archived;
if (typeof patch.task_id === 'string' || patch.task_id === null) safe.task_id = patch.task_id;
safe.updated_at = Date.now();
```

**Design assumption confirmed.** Any unrecognized field (including `promoted`, `promoted_by`, etc.) is silently dropped — the whitelist works as the design relies on. The defensive `warn` insertion the design proposes is a SAFE addition; it converts silent dropping into surfaced caller-mistake feedback.

### V4 — Hot-cache update pattern after writes

`gl-annotations.js:172-176` (after createAnnotation push):
```js
return ref.set(annotation).then(function () {
  if (_cache) _cache[annotation.id] = annotation;
  return annotation;
});
```

`gl-annotations.js:196-201` (after updateAnnotation update):
```js
return db.ref(p).update(safe).then(function () {
  if (_cache && _cache[id]) {
    Object.keys(safe).forEach(function (k) { _cache[id][k] = safe[k]; });
  }
  return _cache ? _cache[id] : null;
});
```

**Design assumption confirmed.** `promoteToMemory()` should follow the `update()` cache-update pattern: after firebase update, set `_cache[id][k] = v` for each new field.

### V5 — All annotation IO routes through GLAnnotations

Grep results: `bandPath('annotations'` appears ONLY in `gl-annotations.js:68`. No other code writes to or reads from the annotations path directly via `firebaseDB.ref('bands/.../annotations/...')`.

**Design assumption confirmed.** The single-pathway invariant for annotations already holds today. Phase 1 reinforces it without breaking it.

### V6 — Existing callers iterate annotation fields by name (safe for new fields)

Verified by inspection of all 7 reader sites across `rehearsal.js`, `song-detail.js`, `gl-takes.js`:

- `rehearsal.js:946-947` — calls `listAnnotationsByAnchor({})`, stores result, no field destructure.
- `rehearsal.js:1919-1925` — iterates and reads `a.archived`, `a.status`, `a.anchor.song_id`, `a.created_at`. By-name access. Safe.
- `rehearsal.js:1937` — patches `{ status: 'fixed' }` only. Safe.
- `rehearsal.js:4803-4805` — calls `listAnnotationsByAnchor({}, { includeArchived: false })`. Safe.
- `song-detail.js:702` — reads `STATUSES` constant. Safe.
- `song-detail.js:719-724` — iterates and reads `a.archived`, `a.status`. Safe.
- `gl-takes.js:433-438` — calls `createAnnotation` with whitelisted input fields. Safe.

**Design assumption confirmed.** No reader iterates all annotation keys or destructures the full shape. New optional fields will be ignored gracefully.

### V7 — No data migration needed (additive optional fields)

Existing annotations lack `promoted` / `promoted_by` / etc. Default-absent reads:
- `a.promoted` → `undefined` (truthy check returns false)
- Audit treats absent fields on un-promoted records as expected; only flags issues when `promoted === true`.

**Design assumption confirmed.** Phase 1 ships with zero backfill. Historical annotations remain un-promoted.

### V8 — Author detection via `_author()` helper

`gl-annotations.js:71-80`:
```js
function _author() {
  if (typeof getCurrentMemberKey === 'function') {
    var k = getCurrentMemberKey();
    if (k) return k;
  }
  if (typeof currentUserEmail !== 'undefined' && currentUserEmail) {
    return currentUserEmail.split('@')[0];
  }
  return 'unknown';
}
```

**Design assumption confirmed.** `promoteToMemory()` can use the same helper for `promoted_by` fallback when `options.authority.memberKey` is omitted.

### V9 — Existing membership-based parent rule exists in Firebase Console

`02_GrooveLinx/specs/groovelinx-firebase-rules-notes.md` (lines 60-66) documents the existing `$other` catch-all in production rules:

```
"$other": {
  ".read": "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()",
  ".write": "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()"
}
```

**Design assumption confirmed (with addendum).** Annotation writes are already gated by band membership at the parent rule. Phase 1's field-level immutability rules will ADD restrictions inside the membership-gated subtree. They will not bypass or weaken the membership gate.

### V10 — Soft-delete via archived flag

`gl-annotations.js:205-207`:
```js
function archiveAnnotation(id) {
  return updateAnnotation(id, { archived: true });
}
```

Reader respect: `gl-annotations.js:221-222` skips archived in default lists; `opts.includeArchived` toggles.

**Design assumption confirmed.** The "no hard delete" invariant the Phase 1 design relies on is operational. Tombstone semantics for evidence references (mentioned in §10 of design) are compatible — archived annotations remain queryable as ID-resolvable tombstones.

### V11 — STATUSES + ANCHOR_KINDS constants exported

`gl-annotations.js:288-289`. Used by `song-detail.js:702` to render a status `<select>`.

**Design assumption confirmed.** No need to add a "promoted" value to STATUSES — design correctly chose orthogonal boolean.

---

## §2 — INVALID assumptions (DESIGN CORRECTIONS REQUIRED)

### I1 — CRITICAL: `database.rules.json` does NOT exist in the repository

**Design assumption:** Phase 1 file touch list includes "`database.rules.json` (Firebase RTDB rules) — Add five field-level immutability rules under `bands/$bandId/annotations/$annId`."

**Codebase reality:** No `database.rules.json` exists. Search of the repo:
- `firebase.json` exists but contains ONLY Cloud Functions config (16 lines).
- No `.rules` files anywhere.
- `02_GrooveLinx/docs/firebase-rules-snippet.md:3` explicitly states: *"The app's Firebase security rules are **not checked into this repo** — they live in the Firebase Console for the project (deadcetera-35424)."*

**Severity:** HIGH. The Phase 1 deploy sequence as written is unexecutable as-is.

**Correction required:** The Phase 1 deploy sequence (Steps 5–6) must be rewritten with two viable paths:

- **Path A (Console-only, status quo):** Edit rules manually in the Firebase Console UI for project `deadcetera-35424`. Merge new field-level rules into the existing `bands/$slug/annotations` subtree. Do NOT replace the whole rules JSON. Test via Firebase Rules Playground before Publish. This is the path firebase-rules-snippet.md documents (line 31-36).

- **Path B (Bring rules into repo first):** Per firebase-rules-snippet.md lines 49-52, first run `firebase init database`, commit `database.rules.json` to the repo, add `firebase deploy --only database` to the release checklist. THEN deploy Phase 1 rules. This adds version control over rules but expands Phase 1 scope by 1–2 days of one-time setup.

**Recommendation:** Path A for Phase 1 ship velocity. Optionally do Path B as a parallel governance improvement, not blocking on Phase 1.

### I2 — Rule key naming uses `$slug`, not `$bandId`

**Design assumption:** Phase 1 design uses `$bandId` placeholder (e.g. "`bands/$bandId/annotations/$annId`").

**Codebase reality:** The existing Console rules and the `bandPath()` helper both use `currentBandSlug` (a string slug like `deadcetera`). The documented rules pattern uses `$slug` consistently (firebase-rules-snippet.md line 21; groovelinx-firebase-rules-notes.md throughout).

**Severity:** MEDIUM. Inconsistent naming would survive at code level (RTDB placeholders are arbitrary names) but creates ambiguity for the engineer applying the rule.

**Correction required:** Rewrite the design's rule snippets to use `$slug` consistently (not `$bandId`, not `$bandSlug` — match the existing rule vocabulary).

### I3 — Deploy sequence Step 1 (code-first) is unsafe given manual rule deploy posture

**Design assumption:** "Deploy code changes (`gl-annotations.js` + build bump) FIRST. New functions exist; new fields can be written; no rules block them." Then Step 3 deploys rules. The design rates the deploy window risk as LOW with "minutes" between steps.

**Codebase reality:** Rules deploy is manual via Firebase Console UI, not via a CLI deploy that can be sequenced atomically with code. The window between code deploy and rules update is bounded only by operator attention — realistically hours, not minutes, especially on first-time-doing-this risk.

**Severity:** MEDIUM (bumped from design's LOW).

**Correction required:** Re-sequence Phase 1 deploy:

- **NEW Step 5a:** Update Console rules FIRST (before code deploy). The new rules accept absent fields (immutability rule pattern `!data.exists() || data.val() === newData.val()` evaluates true when the field has never been written). So rules can land before code without breaking existing writes.
- **NEW Step 5b:** Deploy code (with `promoteToMemory()` + audit) SECOND.
- This reverses the design's order but eliminates the unsafe window.

### I4 — Existing `$other` rule wildcard already covers annotations; design did not explicitly acknowledge

**Design assumption:** Phase 1 rules will operate at `bands/$slug/annotations/$annotationId/*`.

**Codebase reality:** A more permissive `$other` catch-all already exists at `bands/$slug/$other` permitting any-member write to ANY path under a band — including `annotations/`. Phase 1's field-level rules will narrow this for the five promotion fields specifically.

**Severity:** LOW. Phase 1's strategy works correctly under Firebase RTDB rule cascading semantics — child rules can restrict beyond parent permissions. But the design did not explicitly name this interaction, which could confuse the engineer applying the rules.

**Correction required:** Add to the design's §4 (Provenance immutability) a note: "These rules nest inside the existing `$other` catch-all that gates writes by band membership. Field-level immutability rules tighten further; they do not replace the membership gate. RTDB rule cascading evaluates each write against both the parent membership rule AND the child immutability rule; both must pass."

---

## §3 — RISKS discovered during verification

Risks that the Phase 1 design did not anticipate or under-rated.

### R1 — `rehearsal.js:1937` programmatically sets `status: 'fixed'` via auto-resolve helper

**Found at** `js/features/rehearsal.js:1937`:
```js
await window.GLAnnotations.updateAnnotation(oldest.id, { status: 'fixed' });
```

Context (lines 1919-1942): an automated helper finds the oldest open annotation for a song and marks it fixed when some condition is met. This is an automated resolution path.

**Phase 1 impact:** Zero. Phase 1 does not gate status='fixed' writes. This caller continues to function exactly as today.

**Phase 2 impact:** HIGH. Phase 2 plans to require resolution-confirmation fields and an authority gate on status='fixed' writes. This caller would BREAK without one of:
- Migration to a new typed `resolveAnnotation()` helper that supplies the required fields.
- Service-actor exception in the Phase 2 rules.
- Removal of the auto-resolve helper.

**Recommendation:** Phase 1 design's Appendix A (Phase 2 trigger conditions) must be expanded to include: *"Inventory and migrate all programmatic status='fixed' write paths before Phase 2 ships. Known caller: rehearsal.js:1937."*

### R2 — Manual rule deploy window is operator-attention-bounded, not minutes

Already covered in I3. Restated as risk: between rule update and code deploy (in the corrected order), the platform runs on Phase 0 rules with Phase 1 code. New `promoteToMemory()` calls would succeed (rules are absent-permissive). The window has acceptable behavior: promoted_* fields get written but can also be overwritten. The risk is small because no Comparison engine yet exists to drive volume; the human gate is in human hands.

**Mitigation:** Reverse the deploy order (per I3 correction). Window risk drops to negligible.

### R3 — Firebase Rules Playground discipline not specified in design

`02_GrooveLinx/docs/firebase-rules-snippet.md:31-36` documents the standard rule-publish workflow includes Playground testing. The Phase 1 design's deploy sequence does not specify Playground test cases.

**Severity:** MEDIUM. Missing test discipline against the manual deploy increases risk of typos / rule-shape errors that block writes.

**Correction required:** Add to Phase 1 deploy sequence: *"Before publishing rules to Console: test in Firebase Rules Playground. Required scenarios: (a) un-promoted annotation can be promoted (write succeeds); (b) promoted annotation cannot have `promoted_by` modified (write rejected); (c) promoted annotation can have other fields like `status` modified (write succeeds); (d) non-member cannot promote an annotation (write rejected — parent membership rule)."*

### R4 — "Merge into existing rules, do not replace" discipline not specified

firebase-rules-snippet.md line 35 explicitly warns: *"Preserve every other rule you already have."* The Phase 1 design's Console deploy instructions do not call this out.

**Severity:** HIGH if missed. Replacing the rules JSON wholesale would clobber existing membership rules, indexOn declarations, per-member write isolation, etc. This would break the entire app.

**Correction required:** Add to Phase 1 deploy sequence: *"In the Console, locate the existing `bands` → `$slug` block. ADD the new field-level rules under `annotations/$annotationId/`. Do NOT replace the rules root. Verify before Publish that all existing rules (members, readiness, crib_notes, activity_log indexOn, $other catch-all) remain intact."*

### R5 — `currentBandSlug` is mutable global; rule snapshot timing matters

`bandPath()` reads `currentBandSlug` at call time. If a band switch happens mid-flight (unlikely but possible), a promotion could write to a different band than intended.

**Severity:** LOW. Existing pattern; not new to Phase 1. But `promoteToMemory()` should capture `currentBandSlug` at function entry and verify it's still the same at write time, OR (simpler) accept this risk as inherited from the existing primitive.

**Recommendation:** Accept inherited risk. Phase 1 does not need to fix this.

### R6 — `auditProvenance()` is a full scan; cost grows with annotation count

`_ensureLoaded()` loads ALL annotations into memory at once. `auditProvenance()` would iterate the full set. For a band with ~50 annotations today this is fine. For a band with 5,000 annotations in a few years, the audit becomes expensive.

**Severity:** LOW for Phase 1 (small dataset). MEDIUM in 1–2 years.

**Recommendation:** Phase 1 design accepts this; audit is invoked manually. Add a `songId` filter (already in the design) so audits can be scoped. Long-term, an indexed query path may be needed.

### R7 — `_ensureLoaded()` 60s cache TTL could serve stale audit data

`gl-annotations.js:107`: cache is considered fresh for 60 seconds. `auditProvenance()` would read from a 60-second-old cache without forcing refresh.

**Severity:** LOW. Stale-by-60s audit results are acceptable for an investigation tool.

**Recommendation:** `auditProvenance({ refresh: true })` should force-refresh the cache (use the existing pattern from `_ensureLoaded(opts.refresh)`). Add this to the design's auditProvenance signature.

### R8 — `_loadInFlight` Promise-coalescing means concurrent reads share one fetch

Already in current code; not Phase 1 specific. But `promoteToMemory()` followed immediately by `auditProvenance()` might both hit the same in-flight load. Behavior: both see the same data; both succeed. No issue.

**Severity:** None. Verified.

### R9 — Existing rule deploy doc warns of `.indexOn` requirements for new query patterns

groovelinx-firebase-rules-notes.md line 44: *"Any collection under `/bands/{bandSlug}/` that the app queries with `.orderByChild("fieldName")` needs a matching `.indexOn` declaration."*

`auditProvenance()` does not use `.orderByChild`. It loads all annotations and filters in-memory. No `.indexOn` needed.

**Severity:** None. Verified.

### R10 — `promoteToMemory()` rejection on already-promoted may conflict with future re-attempt logic

Phase 1 design rejects re-promotion attempts. If a Comparison engine future-build wants to "refresh" a promotion's evidence (without re-promoting), it would need a separate operation (perhaps an `appendPromotionEvidence()` — but this would break immutability of `promoted_from`).

**Severity:** LOW for Phase 1. May matter for Phase 2 or beyond.

**Recommendation:** Phase 1 design's choice (no idempotent re-promote, no evidence appending) is correct. If future evidence-augmentation is needed, it should be a separate primitive or a Phase 3+ design decision. Document as out-of-scope.

---

## §4 — REQUIRED DESIGN CORRECTIONS (summary)

Bounded list of corrections to the Phase 1 design document. None require architectural redesign.

| # | Correction | Where in design |
|---|---|---|
| C1 | Replace "Update `database.rules.json`" with explicit rule-deployment posture: Console UI editing (Path A) is the current reality; Path B (bring rules into repo via `firebase init database`) is the optional governance improvement. | §4, §8, §11 Step 5 |
| C2 | Use `$slug` (not `$bandId`) as the rule-key placeholder throughout. | §4 rule snippet |
| C3 | Reverse deploy order: Console rules update FIRST (Step 5), then code deploy SECOND (Step 4). Rules are absent-permissive when fields don't yet exist, so rules-before-code is safe. | §11 sequence |
| C4 | Add explicit acknowledgment that field-level rules nest under existing `$other` membership gate (RTDB cascading). | §4 |
| C5 | Add "merge into existing rules, do not replace" discipline to Console deploy instructions. | §11 Step 5 |
| C6 | Add required Firebase Rules Playground test scenarios before Console publish. | §11 Step 5 |
| C7 | Expand Phase 2 trigger conditions (Appendix A) to include: "Inventory and migrate all programmatic `status: 'fixed'` write paths." Name `rehearsal.js:1937` as the known caller. | Appendix A |
| C8 | Add `refresh: boolean` to `auditProvenance()` options, mirroring `_ensureLoaded()` pattern. | §5 |
| C9 | File touch list: replace `database.rules.json` row with "Firebase Console rules (out-of-repo) — manual edit per firebase-rules-snippet.md." | §8 |

---

## §5 — Go / No-Go recommendation

> **GO, with corrections.**

### Why GO

- **All architectural assumptions verified.** The GLAnnotations primitive shape, the storage path, the whitelist behavior, the cache pattern, the caller compatibility — all checked out. The design is fundamentally sound.
- **No new primitives required.** The corrections are scope-preserving, not scope-expanding.
- **Reader compatibility confirmed.** All 7 existing GLAnnotations call sites tolerate new optional fields without modification.
- **No data migration needed.** Additive optional fields; existing records remain valid.
- **The corrections are all narrow and bounded.** Nine items, none requiring architectural redesign. Each is a documentation or sequencing adjustment, not a structural change.

### Why NOT a hard NO despite I1 (missing rules file)

The `database.rules.json` discovery (I1) initially reads as a deal-breaker — the design's deploy sequence cannot execute literally as written. But this is a documentation/sequencing correction, not an architectural failure. The actual rule deployment path (Console UI manual edit) is documented in firebase-rules-snippet.md. The Phase 1 design need only be re-aimed at the correct deploy surface. This is C1.

### Conditions for proceeding

1. Apply corrections C1–C9 to the Phase 1 implementation design document (or capture them in the engineering brief that drives the build). The architectural design itself does not need re-issuing — these are deploy and naming clarifications.
2. Sequence the deploy as: rules-first (Path A, Console), then code, then verification. The reversed order eliminates the design's R1.
3. Include the Firebase Rules Playground test scenarios in the deploy checklist (C6).
4. Add the `rehearsal.js:1937` caller to the Phase 2 trigger doc as a known migration target (C7).

### What this audit does NOT recommend

- No architectural redesign.
- No new primitives.
- No expansion of Phase 1 scope.
- No MVLS work.
- No new authority subsystem.
- No Path B (bring rules into repo) as a Phase 1 blocker. Path B is a worthwhile governance improvement that can be tackled separately.

### Net read

Phase 1 is **implementation-ready with corrections**. The corrections are small, well-documented, and do not perturb the architecture. An engineer working from the Phase 1 design + this audit's corrections can build, test, and ship Phase 1 in the originally-estimated 2–3 days of engineering + 1 day of deploy + verification.

The trust-layer guarantees the audit identified (G1, G2, G7, G8) move from CONCEPTUAL to OPERATIONAL on schedule. The Memory hardening foundation is laid. Phase 2 awaits Authority fragmentation resolution as planned.

---

## §6 — Audit closure

### What was verified

11 design claims VERIFIED against actual code/config.
4 design assumptions INVALID (require correction).
10 risks examined, with severity classifications.
9 required design corrections itemized.

### What was NOT changed

- The Phase 1 architecture.
- The four-field provenance extension.
- The single-pathway promotion design.
- The audit function design.
- The dependency analysis (Phase 1 vs Phase 2 partition).
- The migration strategy (no backfill).
- The scope boundaries (no new primitives, no Authority subsystem, no MVLS).

### Closing posture

Phase 1 implementation design holds. The corrections are operational — they refine deploy sequencing, name the actual rule-deployment surface, and acknowledge codebase realities the design abstracted past. With those corrections folded in (or carried in the engineering brief), Phase 1 is buildable exactly as architected.

**Go.**
