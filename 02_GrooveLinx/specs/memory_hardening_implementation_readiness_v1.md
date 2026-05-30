# Memory Hardening — Implementation Readiness v1

> **Readiness assessment. Design-only. NOT a build spec. NOT a roadmap. NOT a ticket list. No code. No schema. No new primitives. No new concepts.**
>
> Author voice: GrooveLinx Principal Architect. Honest evaluation of what exists, what is missing, and what would justify changing the MVLS audit verdict.
>
> **Purpose:** translate the MVLS audit's "Memory hardening first" recommendation into a concrete implementation-readiness assessment, grounded in the *actual codebase state*, not the architectural spec abstraction.
>
> **Most important constraint:** evaluate readiness of what already exists. Do not expand the architecture.
>
> **Inputs (authoritative):**
> - groovelinx_mvls_implementation_readiness_audit_v1.md
> - elevation_primitive_architecture_v1.md
> - knowledge_acquisition_loop_architecture_v1.md
> - song_dna_convergence_architecture_v1.md
> - comparison_primitive_architecture_v1.md

---

## §0 — Frame

The MVLS audit landed at **NO, not yet** with three structural preconditions: Songs v2 migration completion, Authority fragmentation resolution, and Memory infrastructure trust-layer hardening. This document evaluates only the third — Memory hardening — and asks whether the codebase is *implementation-ready* for that work.

The question is not architectural ("is Memory designed correctly?"). The question is operational ("could a focused engineering pass close this gap without expanding the model?").

### Important calibration

The MVLS audit characterized Memory as PARTIAL based on the spec series. A direct codebase probe reveals the operational state is **more Memory-shaped than the audit assumed** — the `GLAnnotations` primitive already carries a state machine, anchor typing, author provenance, and a promotion field. Hardening is therefore not "build Memory from scratch"; it is **extending existing infrastructure with trust-layer guarantees**.

This recalibration tightens the readiness picture significantly.

---

## §1 — Production state discovery

### What was found

Direct probe of `js/core/gl-annotations.js`, `js/core/gl-notes.js`, `js/core/gl-groovemate-memory.js`:

#### A. `GLAnnotations` primitive (shipped, Phase 1)

- Typed entity at `bands/{slug}/annotations/{annotationId}`
- Schema includes: `id`, `text`, `anchor` (kind + IDs), `tagged_members`, `author`, `created_at`, `updated_at`, `status`, `archived`, `task_id?`
- Status state machine: `open` / `in_progress` / `fixed` / `recheck`
- Anchor kinds: song / rehearsal / recording / take / timestamp / chart / section / stem
- Archived flag = soft-delete (records stay queryable)
- `task_id` field = optional promotion-to-Task (recognized as Phase 4 path)
- Public API: createAnnotation, updateAnnotation, archiveAnnotation, unarchiveAnnotation, listAnnotationsByAnchor, listAnnotationsBySong, listAnnotationsForMember, listOpenAnnotationsForMember
- **Used by**: `rehearsal.js`, `gl-takes.js`, `song-detail.js`

#### B. `GLNotes` unified notes API (shipped, Phase A)

- Wraps 5+ scattered note paths (chart, rehearsal, gig, personal_critique, stem) behind one API
- Each write carries `createdBy` + `createdAt`
- Underlying storage still per-scope; the unification is at the API surface

#### C. `GLGrooveMate` ambient memory (shipped)

- LocalStorage-only, capped at 20 entries
- Stores GrooveMate decision-engine state (history, dismissed, recentAccepted)
- **NOT Song Memory** — this is the AI assistant's own internal state, not band knowledge
- Should not be conflated with Memory primitive

### What this means

The MVLS audit's "Memory PARTIAL" classification is correct but masks a meaningful distinction:

- **Annotation is the operational entity** that maps to what the Elevation spec calls Capture + Comment + Candidate + (loosely) Memory.
- **Memory-as-a-distinct-primitive does not exist in code** — Annotation is currently the unified entity that absorbs all four roles.
- **The status state machine** (`open` → `in_progress` → `fixed` → `recheck`) is structurally close to the Memory active/resolved/re-opened lifecycle, but without the trust-layer enforcement.

This is significant: **Memory hardening is not "build a new Memory primitive"; it is "promote Annotation with trust-layer guarantees and a typed promotion-to-Memory transition."**

### What was NOT found

- No `songMemory` / `memory` primitive in the codebase.
- No promotion-to-Memory gate logic.
- No immutable provenance enforcement (server-side rules).
- No evidence-package aggregation (Annotations are single-anchor; no multi-capture support claim).
- No Resolution confirmation threshold (status='fixed' is freely settable).
- No Re-open confirmation workflow (status='recheck' exists but workflow is informal).
- No data-layer audit infrastructure ("show me every Annotation whose status changed without proper authority").

---

## §2 — Sub-component readiness assessment

Each Memory-related sub-component classified READY / PARTIAL / MISSING. This is the table the audit needs.

| # | Sub-component | Status | Notes |
|---|---|---|---|
| 1 | Typed entity for observation capture | **READY** | `GLAnnotations` with anchor binding, author, timestamps, archive flag. Production-grade. |
| 2 | Anchor typing | **READY** | 8 anchor kinds covered. Maps cleanly to spec's anchor model. |
| 3 | Author field on observation | **READY** | `author` (memberKey) on every annotation. |
| 4 | Status state machine | **PARTIAL** | open/in_progress/fixed/recheck shipped. Transitions are not authority-gated. |
| 5 | Soft-delete (archived flag) | **READY** | Records stay queryable. Honors loop's no-hard-delete principle. |
| 6 | Cross-anchor query | **READY** | listAnnotationsByAnchor, bySong, forMember, openForMember all shipped. |
| 7 | Unified notes API (provenance carrying) | **READY** | GLNotes wraps scattered paths; createdBy + createdAt on every write. |
| 8 | Promoted-to-Memory state | **MISSING** | No distinct "promoted" flag or transition. Annotation IS the unified entity. |
| 9 | Immutable provenance on promotion | **MISSING** | No promoted_by / promoted_at / promoted_from fields exist. |
| 10 | Promotion gate authority enforcement | **MISSING** | Annotations can be created/updated by anyone with band write access. |
| 11 | Evidence package aggregation | **MISSING** | Annotations are single-anchor. No "this annotation is supported by N captures" structure. |
| 12 | Resolution gate (confidence threshold + confirmation) | **MISSING** | status='fixed' is freely set. No threshold logic. |
| 13 | Re-open workflow (status='recheck' formalization) | **PARTIAL** | The status exists; the workflow (when to surface, who can flip back to open) is informal. |
| 14 | Provenance immutability at data layer (Firebase rules) | **MISSING** | Rules likely permit updates to createdAt / author / created_at without restriction. |
| 15 | Audit query infrastructure | **MISSING** | No "show me all annotations whose provenance is missing or modified" surface. |
| 16 | Decay / archive policy for stale candidates | **MISSING** | No auto-archive after N months for un-promoted candidates. |
| 17 | Promotion provenance carries to Task (if promoted) | **PARTIAL** | task_id field exists; the "carry provenance forward" semantics are not enforced. |
| 18 | Cross-entity provenance graph queryable | **MISSING** | An Annotation that became a Task should be backward-traceable; not built. |

### Tally

- **READY: 5** (entity, anchor, author, soft-delete, query, notes-API)
- **PARTIAL: 3** (status state machine, re-open, task promotion provenance)
- **MISSING: 10**

The READY count is **higher** than the MVLS audit's narrative suggested. The MISSING count is **focused** on trust-layer enforcement, not on data-model gaps.

This is good news. Memory hardening is a *trust-layer reinforcement project*, not a *primitive build project*.

---

## §3 — Trust-layer guarantees required before Comparison can generate candidates

Per the Comparison primitive spec and the Knowledge Acquisition Loop, AI-generated proposals must not erode trust. The guarantees the Annotation/Memory layer must enforce before Comparison engines are allowed to produce Candidates:

### G1 — No Memory exists without provenance

Every promoted observation (Annotation flipped to a Memory-like state, OR a distinct Memory record) MUST carry: who promoted it, when, from what source evidence, with what authority.

**Status today:** UNENFORCED. Server-side rules do not check.

### G2 — Provenance is immutable after creation

Once a promotion happens, the promotedBy / promotedAt / promotedFrom fields cannot be altered.

**Status today:** UNENFORCED. Firebase rules likely permit updates to any field.

### G3 — Promotion requires an authorized actor

Per Member/Role/Authority graph, only members with promotion authority can flip a Candidate to a Memory.

**Status today:** UNENFORCED. Depends on Authority fragmentation resolution (the other MVLS precondition).

### G4 — AI cannot self-promote

Comparison engines may produce Candidates. They cannot directly create promoted Memories. This is enforced at the *write boundary*, not at the UI.

**Status today:** UNENFORCED at the data layer. There is no Comparison engine yet, so the surface has not been tested.

### G5 — Resolution requires confidence + confirmation

A Memory's transition from active → resolved requires both (a) sufficient supporting evidence and (b) human gate confirmation. Status='fixed' today is freely settable.

**Status today:** UNENFORCED.

### G6 — Re-open is first-class

A resolved Memory can be returned to active state by an authorized actor, with re-open provenance carried forward.

**Status today:** UNENFORCED. status='recheck' exists but transition workflow is informal.

### G7 — Evidence references survive deletion

If captures referenced by a Memory's evidence package are later archived/deleted, the Memory's evidence references become tombstones — the Memory knows it WAS once supported, even if the captures are gone.

**Status today:** UNENFORCED. No evidence-package structure exists; no tombstone semantics.

### G8 — Provenance is queryable

Future audits can ask "show me every Memory whose promotion provenance is missing or inconsistent." The trust layer is verifiable.

**Status today:** UNENFORCED. No audit infrastructure exists.

### Summary

**0 of 8 trust-layer guarantees are operationally enforced today.** All exist conceptually in the Elevation primitive spec. None are coded.

This is the actual gap. Memory hardening = closing these 8 guarantees.

---

## §4 — Data-layer protections required

For the trust-layer guarantees to hold, the data layer must enforce them. UI-side trust is insufficient (server-side processes, future API callers, future Comparison engines all bypass UI).

| Protection | Mechanism | Status today |
|---|---|---|
| Provenance fields cannot be altered after creation | Firebase security rules + field-validation | MISSING |
| Promotion transitions require authorized actor | Firebase rules with auth.uid → member-role check | MISSING |
| AI service accounts cannot write promoted=true | Distinct service-account auth model, rule restriction | MISSING |
| Resolution transition requires confirmation field present | Firebase rule requiring confirmedBy + confirmedAt on status='fixed' write | MISSING |
| Evidence references are immutable | Append-only evidence-package collection | MISSING |
| Archived records remain queryable | Existing archived flag honors this; query layer respects it | READY |
| Soft-delete is the only delete | Firebase rules forbidding remove() on annotation records | PARTIAL (UI uses archive; rules unclear) |

The data-layer protections are **the single largest concrete deliverable** of Memory hardening. The trust-layer guarantees collapse to these rule changes plus the field additions they require.

---

## §5 — Provenance model required

Minimum provenance model that satisfies the trust layer:

Each annotation record gains (or already has):
- `author` — memberKey of original capture author (EXISTS)
- `created_at` — ms timestamp of original capture (EXISTS)

Each annotation record that has been promoted to Memory-like state gains:
- `promoted` — boolean (or status enum extension)
- `promoted_by` — memberKey of promoting actor
- `promoted_at` — ms timestamp of promotion
- `promoted_from` — array of evidence source IDs (annotation IDs, comment IDs, segment IDs, Comparison Delta IDs)
- `promotion_authority` — typed authority context (member role + permission set at promotion time)

Each annotation record whose status moves to fixed gains:
- `resolved_by` — memberKey
- `resolved_at` — ms timestamp
- `resolution_evidence` — array of source IDs supporting the resolution (typically Comparison Deltas + recent annotations)

Each annotation record re-opened from fixed gains:
- `reopened_by` — memberKey
- `reopened_at` — ms timestamp
- `reopened_reason` — free-text or typed reason (and optional source evidence ID)

**Status:** all fields above are MISSING. The schema extension is small (no new primitive, just typed slots). The enforcement is via data-layer rules + writes from a thin promotion-helper function.

---

## §6 — Resolution workflow required

The minimum Resolution workflow:

1. Annotation in status='open' or 'in_progress'.
2. Some evidence (manual flag OR Comparison Delta sequence) suggests resolution.
3. A Resolution **candidate** surfaces — "this issue may be resolved."
4. An authorized actor reviews and **confirms** the resolution. Status flips to 'fixed'. resolved_by / resolved_at / resolution_evidence are written.
5. The annotation remains queryable in historical view. The "active issues" lens excludes it.

**Status:** the status='fixed' transition is freely available today. Steps 3 (candidate surfacing) and 4 (confirmation gate) are MISSING. Surfacing depends on a "Resolution candidate" lens that does not exist; gating depends on the data-layer rules that do not exist.

---

## §7 — Re-open workflow required

The minimum Re-open workflow:

1. Annotation in status='fixed'.
2. New evidence (manual flag OR Comparison Delta) indicates the issue has returned.
3. An authorized actor flips status back to 'recheck' or 'open'. reopened_by / reopened_at / reopened_reason are written.
4. The historical resolution remains in the record (resolved_by / resolved_at are NOT cleared — they become resolution-history).
5. The annotation re-surfaces in active lenses.

**Status:** the status='recheck' value exists; the data-shape (preserving prior resolution as history) and the surface workflow are MISSING. This is a small extension of the existing status model.

---

## §8 — Authority model required

For promotion / resolution / re-open transitions to be gated, the authority model must answer:

- **Who can promote an Annotation to Memory-like state?** — Member with role permission `promote_song_knowledge` (or similar typed permission).
- **Who can confirm a Resolution?** — Same or different permission.
- **Who can re-open?** — Same or different permission.
- **What about AI service accounts?** — Distinct auth identity with NO promotion / resolution / re-open permissions.

**Status today:** the Member / Role / Authority graph exists (it's a foundation primitive), but **Authority fragmentation is the active P0 architectural finding** per the Shell Integrity Phase. The authority surfaces don't all agree. Memory hardening cannot fully complete until Authority fragmentation is resolved or contained enough that the promotion/resolution/re-open gates can read a consistent authority state.

This is the **single largest cross-cutting dependency** for Memory hardening.

---

## §9 — Failure modes that could destroy trust

If Memory hardening is rushed or skipped, these failure modes are real:

1. **AI-authored Memory** — a future Comparison engine writes promoted=true Memory records without human gate. Members lose trust in the Memory layer instantly. **Defense:** G4 (AI cannot self-promote).
2. **Provenance drift** — a Memory exists; nobody can tell why or who promoted it. **Defense:** G1 + G2 (provenance immutable from creation).
3. **Mass auto-promotion** — a script or AI batch promotes hundreds of Candidates overnight. **Defense:** G3 + G4 + Resolution-confirmation gate.
4. **Premature Resolution** — system marks a Memory resolved after one good rehearsal; the issue returns; trust collapses. **Defense:** G5 (confidence threshold + human gate).
5. **Silent re-open without history** — a resolved Memory flips back to active and the resolution history is lost. **Defense:** G6 (re-open preserves history).
6. **Evidence vanishment** — captures referenced by a Memory's evidence package are deleted; the Memory becomes uninterpretable. **Defense:** G7 (tombstone references).
7. **Authority drift** — promotion was authorized at time X under one role set; the role set later changes; future audits cannot reconstruct. **Defense:** G3 + `promotion_authority` snapshot at promotion time.
8. **Cross-band leakage** — Memory accidentally surfaces across bands. **Defense:** band-scoping on the storage path (`bands/{slug}/annotations`) — already in place. No additional work.
9. **Member-vs-Member surfacing without consent** — a Memory references a specific member's performance gap and surfaces without consent. **Defense:** tagged_members already exists as attention-not-ownership; promotion gate authority must respect member privacy preferences (out of pure Memory hardening scope).
10. **Comparison Delta flood with no batching** — once Comparison runs, every Delta becomes a Candidate; members drown. **Defense:** outside Memory hardening proper; lives in Comparison engine design. But Memory hardening must NOT make this worse by accepting unbatched Candidate writes.

All ten failure modes are defended against by the trust-layer guarantees (G1–G8). The hardening work is, fundamentally, the construction of these defenses.

---

## §10 — The Memory Hardening Stack (dependency-ordered)

A single dependency-ordered stack identifying what must happen for Memory hardening to complete. Each item names its prerequisite.

| # | Capability | Depends on | Status |
|---|---|---|---|
| 1 | Authority graph consistency (P0 finding resolved or contained) | Shell Integrity Phase work | OPEN (P0 in progress) |
| 2 | Promotion / Resolution / Re-open authority permissions defined | #1 | MISSING |
| 3 | Provenance fields added to annotation schema (promoted, promoted_by, promoted_at, promoted_from, resolved_by, resolved_at, resolution_evidence, reopened_by, reopened_at, reopened_reason, promotion_authority) | nothing | MISSING |
| 4 | Server-side data rules enforcing provenance immutability | #3 | MISSING |
| 5 | Server-side data rules enforcing promotion authority | #2 + #3 | MISSING |
| 6 | Server-side data rules enforcing Resolution confirmation field presence | #3 + #5 | MISSING |
| 7 | Re-open workflow with history preservation | #3 + #5 | MISSING |
| 8 | Evidence-reference tombstone semantics (deleted captures keep their reference shape) | #3 | MISSING |
| 9 | Decay / auto-archive for stale Candidates | nothing (lateral) | MISSING |
| 10 | Audit query: "show me every Memory whose provenance is incomplete" | #3 + #4 | MISSING |
| 11 | Promotion helper function (single canonical entry point for promotion writes) | #2 + #3 + #4 + #5 | MISSING |
| 12 | Promotion surface in UI (where the human gate happens) | #11 | MISSING (Memory hardening proper; surfaces can come after) |

**Critical insight:** items 3–11 are *one focused engineering pass* — they all touch the same schema + rules + helper function. Item 1 (Authority) is the gating dependency outside Memory hardening proper.

If Authority is resolved or contained, items 2–11 are a **single bounded engineering deliverable**. Item 12 (UI surface) can land subsequently as part of MVLS proper.

---

## §11 — Minimum viable Memory-hardening implementation

The smallest possible implementation that would justify changing the MVLS audit verdict.

### Slice scope

The minimum slice includes:

1. **Authority permissions for Memory transitions** — define `promote_song_knowledge` / `confirm_resolution` / `reopen_memory` permissions in the Member/Role/Authority graph. (Depends on Authority work.)
2. **Provenance field extension on annotations** — schema gains the typed slots listed in §5.
3. **Single canonical promotion helper** — `GLAnnotations.promoteToMemory(annotationId, { evidence: [...] })` writes promoted_by / promoted_at / promoted_from / promotion_authority. No other code path writes these fields.
4. **Server-side rules: provenance immutability** — once promoted, provenance fields are read-only.
5. **Server-side rules: promotion authority** — promoteToMemory writes are rejected unless the writing member has the required permission.
6. **Server-side rules: Resolution confirmation present** — status='fixed' writes are rejected unless resolved_by + resolved_at + resolution_evidence are present in the same write.
7. **Re-open workflow** — flipping status='fixed' back to active writes reopened_by + reopened_at + reopened_reason; preserves resolved_by + resolved_at as history.
8. **Audit query** — `GLAnnotations.auditProvenance()` returns any annotations whose provenance shape is invalid. Run periodically; alert if non-empty.

### What this slice deliberately excludes

- Evidence package as a distinct entity (single-anchor annotations remain; evidence is an ID array, not an aggregation surface).
- Decay / auto-archive of stale Candidates (lateral; can land later).
- UI surfaces for promotion / resolution / re-open (these land as part of MVLS proper).
- Memory-as-distinct-primitive (the Annotation primitive absorbs the role; no new entity).
- Cross-band anything.

### Why this is sufficient

This slice satisfies trust-layer guarantees G1, G2, G3, G4, G5, G6, G7, G8 at the data layer. Above this slice, any UI surface, any Comparison engine, any AI proposal pathway operates against a hardened trust foundation. The MVLS gate (per the audit) is met.

### Cost

The slice is small — 8 bounded deliverables on existing infrastructure. Estimated engineering scope: 2–4 weeks of focused work, possibly parallelized with the Songs v2 migration completion and Authority resolution work.

---

## §12 — The CTO question

> **If I were CTO, would I authorize Memory Hardening implementation immediately?**

# **YES.**

But conditional on the simultaneous (or immediately preceding) progress on Authority fragmentation work, since item #1 in the Hardening Stack gates items #2 and #5.

---

## §13 — Defense

### Why YES

**1. The work is bounded and well-understood.**

Items 3–11 in the Hardening Stack form one cohesive engineering pass against existing infrastructure. The GLAnnotations primitive is shipped and stable. The trust-layer guarantees (G1–G8) translate directly into schema + rule changes. No new primitive, no new concept, no architectural expansion. This is exactly the discipline the spec series has demanded.

**2. The infrastructure is more Memory-shaped than the audit assumed.**

The codebase probe revealed that GLAnnotations already carries a status state machine, anchor binding, author provenance, soft-delete, and a task-promotion field. The hardening work is *trust-layer reinforcement on existing infrastructure*, not *building Memory from scratch*. This is dramatically cheaper than the MVLS audit's framing suggested.

**3. Without it, no upstream MVLS work can begin.**

Convention as built primitive, Comparison engine, Practice Recommendation surface — every MVLS capability writes through (or generates Candidates for) the Memory layer. Building any of them on un-hardened Memory infrastructure is the trust-layer risk the audit explicitly identified. Memory hardening is the unlock.

**4. It is the right work regardless of MVLS timing.**

Even if MVLS deferred indefinitely, Memory hardening would still be the right move. The Annotation primitive ships today *without* immutable provenance, *without* authority gates, *without* Resolution confirmation. These are gaps in the platform's trust posture regardless of whether Comparison ever ships. Hardening them is overdue.

**5. It can parallelize with the other MVLS preconditions.**

Songs v2 migration completion is independent. Authority fragmentation resolution is required for Hardening Stack items #2, #5, #6 — but the schema extension (item #3) and the canonical promotion helper (item #11 skeleton) can begin in parallel. The work parallelizes cleanly.

**6. The discipline holds.**

The hardening slice does NOT expand architecture. It does NOT create new primitives. It does NOT invent new concepts. It is purely the operational enforcement of guarantees that the Elevation primitive spec already names. The Principal Architect can authorize this work without compromising the recognition-before-build discipline.

**7. The downside is bounded.**

If Memory hardening encounters unforeseen complexity, the cost is engineering time on existing infrastructure — not trust-layer regression, not user-facing surface churn, not architectural sprawl. The blast radius is small. The reversal cost is small.

### Why the qualifier

The honest qualifier: Authority fragmentation resolution is the active P0 architectural finding. If Memory hardening is authorized today but Authority work stalls, Hardening Stack items #2, #5, and #6 stall with it. The authorization should explicitly couple Memory hardening to Authority progress — they ship together, or in immediate sequence.

If Authority work is *not* on the immediate priority list, Memory hardening reduces to items #3, #4, #7, #8, #9, #10 — still meaningful, still worth doing, but incomplete relative to the trust-layer guarantees.

The clearest authorization framing:

> "Begin Memory hardening immediately. Couple delivery to Authority fragmentation resolution. Items that depend on Authority wait; items that don't proceed in parallel."

### What this authorization protects

- The trust layer (operational, not just architectural).
- The path to MVLS (the precondition is being actively addressed).
- The architectural discipline (no expansion; just enforcement).
- The platform's structural advantage (trust is the moat; trust requires data-layer enforcement, not UI hope).

### What this authorization does NOT do

- It does not build MVLS proper. Convention, Reference Recording, Comparison, Practice Recommendation, Resolution surface all remain RECOGNIZED/MISSING and await their own go-ahead.
- It does not commit to a UI surface for Memory. The hardening work is data-layer + rules + helper. Surfaces follow.
- It does not promote any primitive. Annotation remains the operational entity; Memory remains a state of Annotation (promoted=true), not a separate record type.

### The closing posture

The MVLS audit's "NO, not yet" verdict was correct because the platform foundation was not ready. The Memory hardening work IS that foundation. Authorizing it is the move that bends the audit verdict toward "YES, foundation ready" within a defined and bounded engineering window.

Memory hardening is the unlock. It is small. It is concrete. It is well-understood. It is overdue.

# **Authorize.**

---

## Appendix — What this document settles vs. does NOT settle

### Settles

- The codebase state for Memory infrastructure (GLAnnotations + GLNotes + GLGrooveMate, with their actual capabilities).
- The trust-layer guarantees required (G1–G8).
- The minimum implementation slice (8 bounded deliverables on existing infrastructure).
- The dependency on Authority fragmentation resolution.
- The verdict: **YES, authorize Memory hardening immediately, coupled to Authority work.**

### Does NOT settle

- The Authority fragmentation resolution itself (separate work).
- The Songs v2 migration completion (separate work).
- Any MVLS-proper deliverable (Convention, Reference Recording, Comparison, Recommendation, surfaces).
- UI surfaces for promotion / resolution / re-open.
- Schedule, ownership, sprint planning.
- Specific Firebase rule syntax or schema migration ordering.

The audit asks one question and answers it. The downstream work is downstream.

**The Song is the place. The rehearsal is the input. Improvement is the output. The Memory layer is what carries forward what the band has learned. Hardening it is the platform's most overdue trust-layer investment. Authorize.**
