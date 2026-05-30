# Memory Hardening — Phase 1 Implementation Design v1

> **Implementation design. Build-spec-grade detail. Grounded in the actual `js/core/gl-annotations.js` codebase, not in spec abstraction.**
>
> Author voice: GrooveLinx Principal Architect. Concrete enough that an engineer could build this without further architecture clarification.
>
> **Purpose:** translate the Memory Hardening readiness assessment into a Phase 1 implementation design — the smallest trust-layer slice that materially advances MVLS readiness while remaining independent of unresolved Authority fragmentation.
>
> **Constraints (non-negotiable):**
> - Do NOT create a new Memory primitive. Use `GLAnnotations` as the operational Memory entity.
> - Do NOT create a new Authority subsystem.
> - Do NOT design MVLS itself.
> - Reinforce existing infrastructure only.
> - Treat anything Authority-dependent as Phase 2.
>
> **Inputs (authoritative):**
> - memory_hardening_implementation_readiness_v1.md
> - groovelinx_mvls_implementation_readiness_audit_v1.md
> - js/core/gl-annotations.js (actual code)
> - elevation_primitive_architecture_v1.md
> - knowledge_acquisition_loop_architecture_v1.md

---

## §0 — Frame

The Memory Hardening Stack identified 11 dependency-ordered items. Five of them (items 3, 4, 8, 10, and the skeleton of item 11) can ship independently of Authority fragmentation resolution. These five form Phase 1.

Phase 1 hardens the *data shape*, the *write pathway*, the *immutability contract*, and the *audit surface*. It deliberately defers the *authority enforcement* to Phase 2, where it lands as soon as Authority work is complete.

Critical principle: **Phase 1 is data-layer reinforcement on existing infrastructure**. No new primitives. No new authority concept. No surface changes. The Annotation primitive gains four new fields, one new write function, immutability rules for those four fields, and an audit query. That's it.

### Decision baked in

The Elevation spec's Memory primitive is *operationalized as a promoted Annotation* — `promoted=true` plus immutable provenance. There is no separate Memory record type. This is faithful to the readiness audit's finding: GLAnnotations already absorbs the role; hardening extends it rather than splitting it.

---

## §1 — Scope

### Phase 1 IN-SCOPE (this document)

1. **Annotation provenance extension** — four new fields on the annotation record.
2. **Canonical promotion pathway** — `GLAnnotations.promoteToMemory()`.
3. **Provenance immutability** — Firebase RTDB rules + in-code whitelist hardening preventing modification of the four new fields.
4. **Provenance audit** — `GLAnnotations.auditProvenance()`.
5. **Dependency analysis** — explicit table of what's Authority-blocked vs not.

### Phase 1 OUT-OF-SCOPE

- Authority permission definitions (Phase 2; depends on Authority fragmentation resolution).
- Server-side promotion-authority enforcement (Phase 2).
- Server-side Resolution-confirmation enforcement (Phase 2; needs auth context).
- Re-open workflow with preserved history (Phase 2; safer with auth gating).
- UI surfaces for promotion / resolution / re-open (post-MVLS).
- Evidence package as separate primitive (rejected — inline string array suffices).
- Comparison engine integration (post-Phase 2).
- Memory query lenses for Song DNA surface (post-Phase 2).
- Decay / auto-archive for stale Candidates (lateral; can ship separately if friction observed).

---

## §2 — Deliverable 1: Annotation provenance extension

### The four new fields

Added to the annotation record schema. All optional (absent for un-promoted annotations).

| Field | Type | Description |
|---|---|---|
| `promoted` | boolean | True when this annotation has been promoted to Memory standing. Defaults to false / absent. Once true, becomes immutable. |
| `promoted_by` | string (memberKey) | The actor who performed the promotion. Set once at promotion time; immutable. |
| `promoted_at` | number (ms timestamp) | Promotion event timestamp. Set once; immutable. |
| `promoted_from` | string[] | Array of source IDs that constituted the supporting evidence at promotion time. Source IDs may be: annotation IDs (`ann_*`), segment IDs (`seg_*`), comment IDs (`com_*`), comparison Delta IDs (`cmp_*` — future), or take IDs (`take_*`). Empty array is permitted but not recommended. Immutable after promotion. |
| `promotion_authority` | object (snapshot) | Authority context at promotion time. Snapshot, not reference. Shape: `{ memberKey: string, role: string, permissions: string[], snapshot_at: number, auth_version: 'phase1' }`. The `auth_version: 'phase1'` marker explicitly records that Phase 1 did NOT enforce authority — it only recorded what the calling context claimed. Phase 2 will bump to `'phase2'` once enforcement lands. Immutable after promotion. |

### The auth_version marker

This is the **single most important design decision** in Phase 1. It honestly records that Phase 1 promotions did NOT pass through enforced authority. Phase 2 promotions will. Future audits can filter by `auth_version === 'phase1'` to identify pre-enforcement promotions that may warrant re-review under the Phase 2 authority model.

This honors the constraint "remain independent of unresolved Authority fragmentation" while preserving auditability.

### Updated annotation shape

```
{
  id: string,
  text: string,
  anchor: { kind, song_id?, ... },           // unchanged
  tagged_members: string[],                  // unchanged
  author: string,                            // unchanged (original capture author)
  created_at: number,                        // unchanged
  updated_at: number,                        // unchanged
  status: 'open'|'in_progress'|'fixed'|'recheck',  // unchanged
  archived: boolean,                         // unchanged
  task_id?: string,                          // unchanged

  // NEW (Phase 1, optional, immutable once set):
  promoted?: boolean,
  promoted_by?: string,
  promoted_at?: number,
  promoted_from?: string[],
  promotion_authority?: {
    memberKey: string,
    role: string,
    permissions: string[],
    snapshot_at: number,
    auth_version: 'phase1' | 'phase2'
  }
}
```

### Status × Promoted matrix

A promoted annotation IS Memory. Status conveys its lifecycle phase:

| status | promoted | Meaning |
|---|---|---|
| open | false | Open observation (not yet Memory) |
| open | true | Active Memory — currently in force |
| in_progress | true | Active Memory — being worked on |
| fixed | true | Resolved Memory — band has fixed the underlying issue |
| recheck | true | Re-opened Memory — needs re-validation |
| (any) | false | Just an annotation; not yet Memory |

The promoted=false annotations are *candidates* in the Elevation primitive sense. The promotion event is the human gate.

### Backward compatibility

Existing annotation records do not carry these fields. Reads MUST treat absent `promoted` as `false`. Writes by existing callers (createAnnotation / updateAnnotation) MUST NOT accept these fields — only the new `promoteToMemory()` path writes them.

---

## §3 — Deliverable 2: Canonical promotion pathway

### Function signature

```
GLAnnotations.promoteToMemory(annotationId, options) → Promise<annotation>

options = {
  evidence: string[],            // REQUIRED. Source IDs supporting promotion. May be []
                                 // but empty arrays are flagged by auditProvenance.
  authority: {                   // OPTIONAL in Phase 1. If omitted, captured from
    memberKey?: string,          // current member context (mirrors _author() helper).
    role?: string,
    permissions?: string[]
  }
}

Returns the updated annotation on success. Rejects on validation failure.
```

### Behavior

1. Reject if `annotationId` missing.
2. Reject if `options.evidence` is not an array.
3. Reject if Firebase/bandPath not ready (`[GLAnnotations] firebase not ready`).
4. Load the annotation. Reject if not found.
5. If `annotation.promoted === true`, reject with idempotency error: `[GLAnnotations] already promoted at {promoted_at} by {promoted_by}`. Do NOT silently no-op.
6. Capture promotion context:
   - `promoted_by`: from `options.authority?.memberKey` OR `_author()` fallback.
   - `promoted_at`: `Date.now()`.
   - `promoted_from`: `options.evidence.slice()` (defensive copy).
   - `promotion_authority`: snapshot with `memberKey`, `role` (default `'member'`), `permissions` (default `[]`), `snapshot_at = Date.now()`, `auth_version: 'phase1'`.
7. Write all four new fields + `promoted: true` + `updated_at: Date.now()` to `bands/{slug}/annotations/{id}` via single `update()` call.
8. Update the hot cache.
9. Return the updated annotation.

### Single write path enforcement

Phase 1 establishes the canonical pathway via convention + whitelist. Phase 2 enforces it via Firebase rules.

In Phase 1, the `updateAnnotation()` whitelist (the `safe` object in `gl-annotations.js:187-194`) MUST be extended to explicitly REJECT writes to promotion fields:

```
// Phase 1 hardening: promotion fields are write-once via promoteToMemory only.
// updateAnnotation silently drops these — never writes them through this path.
if ('promoted' in patch || 'promoted_by' in patch || 'promoted_at' in patch ||
    'promoted_from' in patch || 'promotion_authority' in patch) {
  console.warn('[GLAnnotations] Promotion fields cannot be modified via updateAnnotation. Use promoteToMemory.');
  // Strip them by not including in `safe`. The existing whitelist already does
  // this implicitly, but the explicit warn helps catch caller mistakes.
}
```

This is defensive — the existing whitelist already only accepts the listed fields, so promotion fields would be silently dropped without the warn. The warn surfaces the mistake to console.

### Why no Re-promote / Un-promote in Phase 1

- Re-promote: not meaningful — once Memory, always Memory; only Resolution / Re-open are the lifecycle transitions.
- Un-promote: deferred to Phase 2 with authority gating. A bad promotion should be archivable (existing archiveAnnotation), but should NOT silently disappear. Archival preserves the historical record.

### Idempotency contract

`promoteToMemory(id, options)` is NOT idempotent. Calling twice on the same annotation rejects the second call. Callers must check `annotation.promoted` before calling. This is by design — silent idempotent re-promotion masks logic errors.

---

## §4 — Deliverable 3: Provenance immutability

Two layers: data-layer (Firebase RTDB rules) and code-layer (whitelist hardening).

### Code-layer immutability (Phase 1)

The `updateAnnotation()` whitelist already excludes promotion fields by construction. Phase 1 makes this exclusion explicit via the warn-and-drop pattern in §3.

This protects against:
- Code-path mistakes (a future helper accidentally trying to update `promoted_by`).
- Caller bugs (a UI bug passing the wrong patch shape).

This does NOT protect against:
- Direct Firebase writes from the console / admin.
- Server-side scripts (none currently; defense matters for the future).
- API clients written outside this codebase (none currently; matters for the future).

### Data-layer immutability (Phase 1 minimum-viable)

Firebase RTDB security rules at `bands/{slug}/annotations/{annotationId}` for the five promotion fields.

Strategy: rules permit writes to promotion fields ONLY when the existing value is absent (i.e., during the promotion event itself). Once written, subsequent updates that attempt to modify these fields are rejected.

The rule shape (in `database.rules.json` or wherever Firebase rules live):

```
"annotations": {
  "$annotationId": {
    "promoted":              { ".write": "!data.exists() || data.val() === newData.val()" },
    "promoted_by":           { ".write": "!data.exists() || data.val() === newData.val()" },
    "promoted_at":           { ".write": "!data.exists() || data.val() === newData.val()" },
    "promoted_from":         { ".write": "!data.exists() || data.val() === newData.val()" },
    "promotion_authority":   { ".write": "!data.exists() || data.val() === newData.val()" }
  }
}
```

The pattern `!data.exists() || data.val() === newData.val()` reads as: "writes are allowed if the field has never been written before, OR if the new value exactly matches the old value." This is the standard Firebase RTDB immutability idiom.

### What this strategy explicitly does NOT enforce in Phase 1

- **WHO can promote** — Phase 1 rules permit ANY band member with write access to call promoteToMemory. Phase 2 will add authority enforcement here.
- **WHO can resolve** — Phase 1 does not gate status='fixed' writes by authority. Phase 2 will.
- **Service account distinction** — Phase 1 does not distinguish AI-service-account writes from human writes. Phase 2 will, once authority is consolidated.

The auth_version='phase1' marker in `promotion_authority` records this explicitly per record.

### Rule deployment caveat

Firebase RTDB rules are global — deploying these rules affects ALL annotation writes, immediately, for ALL bands. The deployment should:

1. Be tested against a dev band first (e.g. a known-empty annotations subtree).
2. Be rolled out during low-traffic window.
3. Have a rollback (the prior rules version) ready.

The rules are *additive* — they restrict writes to the five new fields only. Existing fields (text, anchor, status, etc.) keep their current rule shape. This minimizes blast radius.

### Composite rule note

If the existing `database.rules.json` has a permissive parent rule like `"annotations": { ".write": "auth != null && root.child(...members...).exists()" }`, the child field rules in Phase 1 will *narrow* the parent permission for the five promotion fields. This is the desired behavior. Verify on deploy that no broader rule supersedes them.

---

## §5 — Deliverable 4: Provenance audit

### Function signature

```
GLAnnotations.auditProvenance(opts) → Promise<auditReport>

opts = {
  includeArchived?: boolean,  // default false — archived records skipped
  songId?: string             // optional filter — audit only annotations for one song
}

auditReport = {
  scannedCount: number,
  promotedCount: number,
  unpromotedCount: number,
  issues: {
    missing: AuditIssue[],       // promoted=true but required field absent
    invalid: AuditIssue[],       // present but malformed
    inconsistent: AuditIssue[]   // self-contradictory
  },
  generatedAt: number
}

AuditIssue = {
  annotationId: string,
  issueType: string,       // human-readable, e.g. "missing_promoted_by"
  detail: string,          // specifics about this record
  severity: 'low' | 'medium' | 'high'
}
```

### Issue categories

**Missing** (promoted=true but required fields absent):
- `missing_promoted_by` — high
- `missing_promoted_at` — high
- `missing_promoted_from` — medium (empty array allowed but flagged)
- `missing_promotion_authority` — high

**Invalid** (present but malformed):
- `invalid_promoted_at` — value is in the future (clock skew or tampering)
- `invalid_promoted_at` — value is before created_at (impossible)
- `invalid_promoted_from` — not an array
- `invalid_promotion_authority` — missing required sub-fields

**Inconsistent** (self-contradictory):
- `promoted_by_mismatch` — `promoted_by !== promotion_authority.memberKey`
- `promoted_at_mismatch` — `promoted_at !== promotion_authority.snapshot_at` (allow small drift; flag if > 60s)
- `auth_version_unknown` — `promotion_authority.auth_version` is neither 'phase1' nor 'phase2'

### Behavior

1. Load annotations (uses `_ensureLoaded`).
2. For each annotation, if `promoted === true`:
   - Run all checks above.
   - Accumulate issues by category.
3. Return the report.

The function is read-only. It does NOT fix issues. Remediation is a human decision — Phase 1 surfaces; humans investigate.

### When to run

- Manually invoke from devtools console: `GLAnnotations.auditProvenance().then(r => console.table(r.issues))`.
- Periodically in a background task (post-Phase 1): if any HIGH-severity issues, alert.
- Before any future migration that touches annotations.

### Why no auto-remediation

Auto-remediation would be AI authorship of Memory state — exactly the trust-layer violation the architecture forbids. The audit surfaces issues; humans decide. This honors the accompaniment axis at the audit layer.

---

## §6 — Deliverable 5: Dependency analysis

The Memory Hardening Stack identified 11 items. This audit classifies each as **Independent** (Phase 1 ships now) or **Authority-blocked** (Phase 2 awaits Authority fragmentation resolution).

| # | Hardening Stack Item | Phase 1 Independent? | Reasoning |
|---|---|:---:|---|
| 1 | Authority graph consistency | — | NOT a Memory hardening item — it's the precondition. |
| 2 | Promotion / Resolution / Re-open authority permissions defined | NO | Pure Authority work. Phase 2. |
| 3 | Provenance fields added to annotation schema | **YES** | Pure schema extension. **Phase 1.** |
| 4 | Server-side data rules enforcing provenance immutability | **YES** | Field-level immutability rules do not require authority context. **Phase 1.** |
| 5 | Server-side data rules enforcing promotion authority | NO | Requires consolidated authority surface. Phase 2. |
| 6 | Server-side data rules enforcing Resolution confirmation field presence | PARTIAL | The "presence" check is independent. The "by authorized actor" check is Phase 2. Phase 1 can ship the presence-only check IF Resolution-confirmation fields are added (deferred to Phase 2 for cohesion). |
| 7 | Re-open workflow with history preservation | NO | Best gated by Authority. Phase 2. |
| 8 | Evidence-reference tombstone semantics | **YES** | Pure data discipline — when a referenced annotation/segment is archived, the reference becomes a tombstone (existing ID, marked as not-resolvable). Can ship in Phase 1 as a documentation contract; audit catches stale references. |
| 9 | Decay / auto-archive for stale Candidates | **YES (lateral)** | Independent of everything. Could ship in Phase 1 if friction observed; otherwise defer to as-needed. |
| 10 | Audit query infrastructure | **YES** | Pure read function. **Phase 1.** |
| 11 | Promotion helper function (canonical entry point) | **YES (skeleton)** | The function ships now. Authority enforcement layer added in Phase 2 by changing the auth_version marker and rule strictness. **Phase 1.** |
| 12 | Promotion surface in UI | NO | MVLS-proper concern. Not Memory hardening. |

### Phase 1 ships: items 3, 4, 8, 10, 11 (skeleton)

These five items form Phase 1. They do not require Authority resolution. They reinforce the data model + the write pathway + the audit surface.

### Phase 2 ships (when Authority lands): items 2, 5, 6, 7, 11 (full enforcement)

These five items require the consolidated authority surface. Phase 2's main work is bumping `auth_version: 'phase1' → 'phase2'` once rules can actually enforce, and adding Resolution + Re-open workflows with proper authority gates.

### What Phase 1 buys

Even without Authority enforcement, Phase 1 delivers:
- **Provenance shape exists.** Every future promotion carries the four fields.
- **Promotion is auditable.** Future investigations can ask "who promoted this Memory and when, from what evidence?"
- **Data-layer immutability.** The fields cannot be silently modified post-promotion.
- **Canonical pathway exists.** All future promotion code paths go through one function — no fragmentation.
- **Audit surface exists.** Non-conforming records are detectable.
- **Honest marking.** auth_version='phase1' records that authority was NOT enforced. Phase 2 can re-audit these explicitly.

This is enough to begin building Comparison engine Candidate-generation against, knowing the Memory shape is stable even if the authority gate is still permissive.

### What Phase 1 explicitly DOES NOT buy

- Protection against malicious promotion by a band member with write access.
- Protection against AI service accounts writing promoted=true (no service accounts exist yet; Phase 2 distinguishes them).
- Resolution gate (status='fixed' remains freely settable).
- Re-open workflow (status='recheck' remains informal).

These are honest gaps. Phase 2 closes them. Phase 1 ships the foundation that Phase 2 hardens.

---

## §7 — Architecture impact analysis

### What changes

- `js/core/gl-annotations.js`: adds `promoteToMemory()`, hardens `updateAnnotation()` whitelist (adds defensive warn), adds `auditProvenance()`. Module grows from 293 to ~450 lines.
- `database.rules.json` (or wherever Firebase RTDB rules live): adds field-level immutability rules for the five promotion fields under `bands/$bandId/annotations/$annId`.
- Annotation records gain five new optional fields.

### What does NOT change

- The Annotation primitive's role.
- Any other code that reads or writes annotations (existing readers see new fields as additional keys; existing writers do not touch them).
- The Member / Role / Authority graph.
- Any UI surface.
- The Songs v2 migration.
- The Comparison primitive (not yet built).
- The Convention primitive (not yet built).
- The Reference Recording primitive (not yet built).
- The unified GLNotes API.
- The GrooveMate ambient memory (localStorage; unaffected).

### Architectural debt added

**None.** Phase 1 honors the constraint "do not expand architecture." The annotation schema grows by five fields; no primitive is created; no concept is introduced. The auth_version marker is an explicit recognition of Phase 1's authority-deferral, not a new abstraction.

### Architectural debt resolved

- The trust-layer guarantee G1 (no Memory without provenance) becomes operational.
- The trust-layer guarantee G2 (provenance immutable from creation) becomes operational at the data layer.
- The trust-layer guarantee G7 (evidence references survive deletion) becomes operational via documented tombstone contract.
- The trust-layer guarantee G8 (provenance is queryable) becomes operational via `auditProvenance()`.

Four of eight trust-layer guarantees move from CONCEPTUAL to OPERATIONAL.

---

## §8 — File touch list

The minimum set of files changed.

| File | Change | Approximate scope |
|---|---|---|
| `js/core/gl-annotations.js` | Add `promoteToMemory()` (new ~50 lines). Add defensive warn in `updateAnnotation()` whitelist (~6 lines). Add `auditProvenance()` (~100 lines). Update window.GLAnnotations export (~3 lines). Update header comment block to document Phase 1 promotion semantics (~30 lines). | ~190 lines added / modified |
| `database.rules.json` (Firebase RTDB rules) | Add five field-level immutability rules under `bands/$bandId/annotations/$annId`. | ~10 lines added |
| `index.html` + `index-dev.html` | Build-bump (per atomic build-bump discipline). No other change. | Build params only |
| `service-worker.js` | CACHE_NAME bump (per atomic build-bump discipline). | 1 line |
| `version.json` | New build + deploy timestamp. | 2 lines |
| `02_GrooveLinx/CLAUDE_HANDOFF.md` | Session handoff documenting Phase 1 ship + Phase 2 trigger conditions. | ~50 lines |
| `02_GrooveLinx/CURRENT_PHASE.md` | Phase tracker update. | ~10 lines |
| `02_GrooveLinx/notes/uat_bug_log.md` | If any bugs fixed during Phase 1, log them. | as-needed |

### Files NOT touched

- No new files created (Phase 1 fits entirely in `gl-annotations.js` plus the rules file).
- No other JS modules edited (callers of GLAnnotations don't need changes — promotion is opt-in via new function).
- No CSS / styling.
- No new HTML surfaces.
- No spec files in 02_GrooveLinx/specs/ (the spec series is design-only; Phase 1 implements an existing recognition).

### Surface impact

Zero. No user-facing changes ship in Phase 1. This is data-layer hardening. The first user-visible MVLS surface ships in MVLS proper, not in Phase 1.

---

## §9 — Migration strategy

### No data migration required

Existing annotations have no `promoted` field. They are implicitly `promoted=false`. The new fields are additive and optional. Existing reads see the unchanged fields; existing writes go through the unchanged paths.

### Backfill posture

Phase 1 does NOT backfill historical annotations as "promoted Memory." That would be retroactive promotion without a human gate — a trust-layer violation. Annotations that pre-date Phase 1 remain un-promoted unless explicitly promoted post-deploy.

If the band wants to retroactively mark historical observations as Memory, they call `promoteToMemory(id, { evidence: [...] })` per record. This is a human gate per promotion, even for historical records.

### Rule deployment sequence

1. Deploy code changes (`gl-annotations.js` + build bump) FIRST. New functions exist; new fields can be written; no rules block them.
2. Verify Phase 1 functions work in dev band: call `promoteToMemory()` on a test annotation; verify fields written; call `auditProvenance()`; verify zero issues.
3. Deploy `database.rules.json` changes SECOND. Once rules are live, the immutability contract holds for all subsequent writes.
4. Re-verify: attempt to call `updateAnnotation(id, { promoted: false })` on a promoted record — must succeed at the API call layer (because the whitelist drops promoted) but the Firebase write of `promoted_by` etc. via direct ref must reject.

If rules deploy is rolled back: code still works correctly (whitelist enforcement holds at API surface). The only loss is the data-layer guarantee against console-direct writes.

### Rollback

Code rollback: revert `gl-annotations.js` to pre-Phase-1 commit. New annotations stop receiving promotion fields. Existing promoted annotations retain their fields (data is not removed).

Rules rollback: revert `database.rules.json`. The immutability contract is lost at the data layer; the API-surface whitelist still prevents accidental writes.

Both rollbacks are clean. No data is lost.

---

## §10 — Risk assessment

### R1 — Direct Firebase writes from console bypass rules during the deploy window

**Risk:** Between Step 1 (code deploy) and Step 3 (rules deploy), a console-direct write to promotion fields would not be rejected.

**Mitigation:** The window is short (minutes). The number of users with console access is small (Drew, possibly Pierce). The defensive whitelist in `updateAnnotation` catches API-layer mistakes. Coordinate the deploy so rules land within minutes of code.

**Severity:** LOW.

### R2 — Phase 1 promotions are not authority-enforced

**Risk:** During Phase 1, any band member with write access can promote any annotation. Without authority gating, premature or unauthorized promotions are possible.

**Mitigation:** The auth_version='phase1' marker on every Phase 1 promotion makes these promotions auditable and revisitable. Phase 2 can re-audit by querying `promotion_authority.auth_version === 'phase1'`. Drew/Pierce can manually review.

**Severity:** MEDIUM. Acceptable for Phase 1 given the explicit honest marking.

### R3 — promoteToMemory rejection (already promoted) feels like a bug to UI callers

**Risk:** A future UI caller that fails to check `annotation.promoted` first will see a rejection. They may treat it as an error.

**Mitigation:** The rejection error message is explicit and includes who/when. Documentation makes the check-before-promote pattern clear.

**Severity:** LOW. By-design behavior.

### R4 — promoted_from references break if source annotations are deleted (not archived)

**Risk:** If a Phase 1 promotion references annotation IDs that are later hard-deleted (vs archived), the references become unresolvable.

**Mitigation:** The Annotation primitive already uses soft-delete (archived flag). The architecture's invariant is "no hard delete." `auditProvenance()` can detect references to non-existent annotations and flag them (low-severity).

**Severity:** LOW. Existing soft-delete discipline protects against this.

### R5 — Firebase rule deploy errors block all annotation writes

**Risk:** A typo in the rules JSON could block ALL annotation writes, not just promotion-field writes.

**Mitigation:** Test rules in dev band first. Have prior rules version ready for instant rollback. Deploy during low-traffic window.

**Severity:** MEDIUM. Standard Firebase rule deployment risk; well-understood mitigation.

### R6 — auditProvenance() generates noise that fatigues investigators

**Risk:** Early Phase 1 deployments may have many minor inconsistencies (clock skew on promoted_at, mismatches between snapshots). Frequent audits may produce alert fatigue.

**Mitigation:** Severity classification (high/medium/low) helps prioritize. Auto-alerting (post-Phase 1 if added) should fire only on HIGH severity. Drew can run manual audits as desired without alerting.

**Severity:** LOW.

### R7 — The auth_version marker creates a "two classes of Memory" sensation

**Risk:** Phase 1-promoted Memories are honestly less-protected than Phase 2-promoted Memories. Users seeing both classes may feel uncertain.

**Mitigation:** Phase 1 ships with NO user-visible Memory surface. By the time a user-visible surface lands (MVLS proper), Phase 2 is likely complete. If timing diverges, the UI can choose to display only Phase 2 Memories or to surface the auth_version distinction explicitly.

**Severity:** LOW. Surface concern, not architecture concern.

### R8 — Comparison engine (future) writes Candidate Memories via promoteToMemory

**Risk:** Once Comparison ships, it generates Candidates. If Comparison's automation calls promoteToMemory directly (bypassing human gate), this is the exact trust-layer violation the architecture forbids.

**Mitigation:** Phase 2 enforces authority — AI service accounts will have no promotion permission. Phase 1's auth_version='phase1' marker also creates a discoverable trail. The Comparison primitive spec explicitly forbids auto-promotion; this is honored at the engine design level too.

**Severity:** Acceptable in Phase 1 (no Comparison engine exists). Becomes HIGH if Phase 2 lags Comparison build — must order properly.

### R9 — Backward compatibility breaks for legacy annotation readers

**Risk:** Readers that destructure annotation shape may break if they don't tolerate new fields.

**Mitigation:** Read code in `rehearsal.js`, `gl-takes.js`, `song-detail.js` uses `.field` access patterns that tolerate additional fields. Verified by inspection. No existing reader iterates all fields.

**Severity:** VERY LOW.

### R10 — Phase 1 implementation drifts from this design

**Risk:** During the build, decisions get made differently than designed (e.g. fields named differently, auth_version omitted, rules structured differently).

**Mitigation:** This document is the build spec. The engineer references it. Phase 1 PR review checks design conformance.

**Severity:** LOW. Standard implementation discipline.

### Aggregate risk read

Phase 1 is a **low-risk, bounded engineering deliverable**. The highest individual risk (R5 — rule deploy errors) is well-understood. The most architecturally-sensitive risk (R8 — Comparison auto-promotion) is properly addressed by ordering: Phase 2 must complete before Comparison engine ships.

---

## §11 — Recommended implementation sequence

A bounded, low-risk sequence for the Phase 1 ship.

### Step 1 — Schema design lock

- Confirm the four-field design (plus the `promoted` boolean) is acceptable.
- Confirm the `promotion_authority` snapshot shape.
- Confirm the `auth_version: 'phase1'` honest marker.
- No code yet.

### Step 2 — Code implementation in `gl-annotations.js`

- Add `promoteToMemory()` function per §3.
- Add defensive warn in `updateAnnotation()` whitelist per §3.
- Add `auditProvenance()` function per §5.
- Update window.GLAnnotations export.
- Update header comment block to document Phase 1 promotion semantics.

### Step 3 — Manual test in dev band

- Create a test annotation.
- Call `promoteToMemory(testId, { evidence: ['seg_abc'] })`. Verify all five fields written.
- Call `updateAnnotation(testId, { promoted: false })`. Verify no change (whitelist drops).
- Call `auditProvenance({ songId: testSongId })`. Verify the promoted record reports no issues.
- Call `promoteToMemory(testId, { evidence: [] })` again. Verify rejection (already promoted).

### Step 4 — Atomic build bump + deploy (code only)

- Per the deploy ritual: build bump, commit, push.
- Deploy code only at this stage. Rules still permissive.

### Step 5 — Firebase rules deploy

- Update `database.rules.json` per §4.
- Test rules in dev band: attempt direct ref-set to `promoted_by` on a promoted record. Verify rejection.
- Roll out to production during low-traffic window.

### Step 6 — Verification audit

- Run `GLAnnotations.auditProvenance()` against production.
- Expected: 0 promoted records, 0 issues (no Phase 1 promotions have occurred yet in production).

### Step 7 — Documentation update

- Update `02_GrooveLinx/CLAUDE_HANDOFF.md` with Phase 1 ship + Phase 2 trigger conditions.
- Update `02_GrooveLinx/CURRENT_PHASE.md` with phase state.
- Reference this design spec.

### Step 8 — Phase 2 trigger conditions documented

- Phase 2 begins when Authority fragmentation resolution work lands.
- At that point: define promotion permission, define resolution-confirmation permission, define re-open permission. Update Firebase rules to enforce authority. Bump auth_version marker to 'phase2' for new promotions. Document the cohort of Phase 1 promotions that may warrant re-audit.

### Sequence summary

Each step is small, observable, and reversible. Total scope: roughly 2–3 days of engineering plus 1 day for deploy + verification.

---

## §12 — Closing posture

Phase 1 ships:

- A four-field promotion provenance extension on the existing GLAnnotations primitive.
- A canonical `promoteToMemory()` write pathway.
- Data-layer immutability rules for the five promotion fields.
- A `auditProvenance()` query function.
- An honest `auth_version: 'phase1'` marker recording that Phase 1 did not enforce authority.

Phase 1 does NOT:

- Create a new Memory primitive.
- Create a new Authority subsystem.
- Design MVLS.
- Build user-visible surfaces.
- Enforce promotion authority.
- Build Resolution / Re-open workflows.
- Touch Songs v2 migration, Comparison primitive, Convention primitive, or any other concept.

The architectural discipline holds: no new primitives, no new concepts, just operational reinforcement of guarantees that the Elevation spec already names.

The MVLS audit's recommendation — "Memory hardening first" — has its implementation design. The Phase 1 slice is bounded, reversible, low-risk, and trust-layer-enhancing. It moves four of eight trust-layer guarantees from CONCEPTUAL to OPERATIONAL. It establishes the foundation Phase 2 will harden once Authority work lands.

The Song is the place. The rehearsal is the input. Improvement is the output. The Memory layer carries forward what the band has learned. Phase 1 is how that carrying becomes structurally trustworthy — without expansion, without sprawl, without architectural regret.

Authorize Phase 1.

---

## Appendix A — Phase 2 trigger conditions (for future reference)

Phase 2 begins when ALL of the following are true:

1. Authority fragmentation resolution is complete or contained enough that a `promote_song_knowledge` / `confirm_resolution` / `reopen_memory` permission set can be defined and queried consistently.
2. The Member / Role / Authority graph exposes an API to check current actor permissions at write time.
3. Firebase rules can express `auth.uid → member → permission` lookups against the consolidated authority surface.

Phase 2 scope (preview, not commitment):
- Define the three Memory permissions in the authority graph.
- Update Firebase rules: promotion writes require `promote_song_knowledge`; status='fixed' writes require `confirm_resolution` + resolution-confirmation fields present; re-open writes require `reopen_memory`.
- Update `promoteToMemory()` to bump `auth_version: 'phase2'`.
- Add `GLAnnotations.resolveAnnotation(id, options)` and `GLAnnotations.reopenAnnotation(id, options)` canonical pathways.
- Re-audit cohort of Phase 1 promotions (`promotion_authority.auth_version === 'phase1'`) and flag for review.

Phase 2 is NOT designed in this document. This appendix only names the trigger and previews scope.

---

## Appendix B — Decision log

Decisions made in this design document, with rationale.

| Decision | Rationale |
|---|---|
| Use `promoted` boolean rather than new status enum value | Status conveys lifecycle (open/in_progress/fixed/recheck); promoted is orthogonal. A Memory can be active OR resolved OR re-opened. The two axes serve different purposes. |
| `promotion_authority` is a snapshot, not a reference | Authority changes over time. The Memory record needs to know what authority was held at promotion time, not what authority the member has today. |
| `promoted_from` is a string array of source IDs, not a typed evidence package | Constraint: do not expand architecture. Inline string array satisfies the audit + traceability needs without creating a new primitive. |
| `auth_version: 'phase1'` marker | Honest acknowledgment that Phase 1 did not enforce authority. Critical for future auditability of pre-Phase-2 promotions. |
| promoteToMemory rejects if already promoted (no idempotent re-promote) | Silent idempotency masks logic errors. Explicit rejection forces caller awareness. |
| No backfill of historical annotations as Memory | Retroactive promotion without human gate = trust-layer violation. Each promotion must be a human act. |
| Field-level Firebase rules using `!data.exists() || data.val() === newData.val()` | Standard Firebase RTDB immutability idiom. Well-understood; minimal blast radius; preserves existing parent permissions. |
| auditProvenance() is read-only — no auto-remediation | Auto-remediation = AI authoring Memory state = trust-layer violation. Audit surfaces; humans decide. |
| Defensive warn in updateAnnotation whitelist for promotion fields | The whitelist already drops these fields; the warn surfaces caller mistakes that would otherwise be silent. |
| Phase 1 ships with ZERO user-visible surface | Phase 1 is data-layer hardening only. User-visible Memory surfaces are MVLS-proper concerns, not hardening concerns. |
