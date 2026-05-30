# GrooveLinx MVLS Implementation Readiness Audit v1

> **Audit-only. Design-only. NOT a roadmap. NOT a project plan. NOT a build spec. No tickets. No code. No schema.**
>
> Author voice: GrooveLinx Principal Product Architect. Honest assessment, not advocacy.
>
> **Purpose:** determine whether GrooveLinx is ready to begin implementation of the Minimum Viable Learning System (MVLS). This audit is the bridge between recognition and build. It asks: is the platform's *current state* prepared to receive MVLS as a new layer, or are there structural preconditions that must be addressed first?
>
> **Inputs (authoritative):**
> - groovelinx_north_star_build_sequence_v1.md
> - comparison_primitive_architecture_v1.md
> - knowledge_acquisition_loop_architecture_v1.md
> - song_dna_convergence_architecture_v1.md
> - elevation_primitive_architecture_v1.md
>
> **The question this document settles:**
>
> > *Would I begin implementation now?*
>
> Answer at §13. Defense at §14.

---

## §0 — Frame

The recognition series is complete. The architecture is whole. The North Star sequence is named. What remains is the *honest* question: is the platform — not the architecture, the actual running codebase — ready to receive MVLS?

This is an audit, not advocacy. It will be tempting to say "yes, build now" because the recognition documents are thorough and the architecture is durable. The honest assessment must distinguish between *architectural readiness* (the design is sound) and *platform readiness* (the foundation can carry the build).

The two are not the same. A perfectly designed cathedral cannot be built on sand.

---

## §1 — What MVLS requires (recap)

Per the North Star Build Sequence, MVLS is:

> *A band can capture a rehearsal, elevate observations to durable Memory, agree on a Convention, run Comparison of a take against that Convention, see a structured Delta, and accept a Practice Recommendation that targets the gap.*

The seven required capabilities, in dependency order:

1. Mature Elevation chain — capture → comment → evidence → candidate → Memory with trust-layer discipline.
2. Performance Convention as built primitive.
3. Reference Recording as built primitive.
4. Comparison primitive + at least one pairing engine.
5. Practice Recommendation surface (Memory + Delta → suggested action).
6. Resolution candidate detection + Resolution gate.
7. Tradition-aware tolerance configuration in the Comparison engine.

This is the audit target.

---

## §2 — Capability classification

For each MVLS capability: READY / PARTIAL / RECOGNIZED / MISSING.

Definitions:
- **READY** — in production, hardened, trusted by the trust layer, fit for the next layer to depend on.
- **PARTIAL** — exists in some form, but with debt, fragility, or trust-layer gaps that must close before it can carry MVLS.
- **RECOGNIZED** — design-complete in the spec series but not yet built.
- **MISSING** — neither built nor designed.

### 2.1 — Foundation capabilities (MVLS depends on these)

| Capability | Status | Notes |
|---|---|---|
| Song primitive | **PARTIAL** | Built; Songs v2 migration in progress (legacy `songs/{title}` → `songs_v2/{songId}`). Building MVLS on top of an incomplete migration is structural risk. |
| Member / Role / Authority graph | **PARTIAL** | Built; **Authority fragmentation is the active P0 architectural finding** from the Shell Integrity Phase. MVLS requires clean authority for the promotion gate. |
| Segment / Take with segmentId anchor | **READY** | Phase C shipped — segmentId is the durable performance anchor. Multi-take per rehearsal is first-class. Canonical Song Identity rebinding helper (`GLStore.rebindSegmentSong`) prevents drift. This is the strongest foundation layer. |
| Comment | **READY** | Built, used throughout, persistence solid. |
| Practice Task primitive | **READY** | Built, surfaces present. Drew's "PracticeTask shape + surfaces + minimal launch" memory confirms shipping. |
| Setlist | **PARTIAL** | Built; SWR-clobber bug (whole-array `set()` over SWR cache) is open and load-bearing. Not directly blocking MVLS but represents foundation-layer trust risk. |
| Event | **READY** | Built. |
| Capture (rehearsal multitrack recording) | **READY** | Multitrack rehearsal infrastructure in production. Stems via Demucs/Modal/R2/Worker. Song Clips Phase C built. |
| Song DNA surface | **PARTIAL** | The product north-side surface exists, with active convergence work. Home dashboard recently null-guard hardened. The "front door" question from Pierce synthesis is unresolved. |
| Harmony Plan (as Part Plan candidate) | **PARTIAL** | Built per harmony_infrastructure_design. Architecturally generalized to Part Plan (subtype = vocal_harmony) per part_lab_architecture_recognition. Internal generalization is a documentation change; no code shift needed for MVLS. |

### 2.2 — MVLS-direct capabilities

| Capability | Status | Notes |
|---|---|---|
| Elevation chain (capture → comment → evidence → candidate → Memory) | **PARTIAL** | Capture and Comment are READY. Candidate state, evidence aggregation, and gated promotion exist conceptually but the **trust-layer discipline (provenance immutability, gate enforcement at data layer, resolution semantics) is not yet hardened**. This is the most important MVLS readiness gap. |
| Song Memory primitive | **PARTIAL** | Memory exists. Provenance carrying, resolution-state transitions, and re-opening flows are RECOGNIZED but not built to MVLS quality. |
| Performance Convention | **RECOGNIZED** | Spec complete (performance_conventions_architecture_v1). Not built. Lightest path to a Comparison target. |
| Reference Recording | **RECOGNIZED** | Spec partial (in song_component_canonical_model_v1). External link slots exist informally; typed primitive with fidelity-tier metadata is not built. |
| Comparison primitive | **RECOGNIZED** | Full spec (comparison_primitive_architecture_v1). Engine, Delta substructure, tradition-aware tolerance all defined; nothing built. |
| Comparison pairing engine (Take vs Convention, minimum) | **MISSING** | No engine exists. Trust-layer-disciplined Comparison engine is a first build in the platform. |
| Practice Recommendation synthesis surface | **MISSING** | No synthesis exists. Practice Tasks are user-authored or member-assigned today. AI-or-Memory-driven recommendations are not surfaced. |
| Resolution gate workflow | **MISSING** | Memory resolution as a state transition with confirmation is not implemented. |
| Tradition-aware tolerance configuration | **MISSING** | The Comparison engine's tolerance configuration framework does not exist. |

### 2.3 — Summary tally

| Status | Count | Capabilities |
|---|---|---|
| READY | 4 | Segment/Take, Comment, Practice Task, Event |
| PARTIAL | 6 | Song (Songs v2), Member/Authority (fragmentation P0), Setlist (SWR), Song DNA (front door), Harmony Plan (Part-Plan generalization conceptual), Capture (no debt but lateral) — and most importantly **Elevation chain + Memory** at PARTIAL with trust-layer gaps |
| RECOGNIZED | 3 | Convention, Reference Recording, Comparison primitive |
| MISSING | 4 | Comparison pairing engine, Practice Recommendation, Resolution gate, Tradition-aware tolerance |

**The honest read:** no MVLS capability is ready to ship as-is. Even the strongest (Segment/Take) operates on a Foundation layer that has known P0 issues (Authority fragmentation, Songs v2 migration). The structural preconditions are not all met.

---

## §3 — The dependency-ordered MVLS readiness table

A single table, dependency-ordered, naming the blockers before each capability becomes shippable.

| # | Capability | Status | What blocks | What unblocks it |
|---|---|---|---|---|
| 1 | Songs v2 migration completion | PARTIAL | Legacy `songs/{title}` reads still active on some paths | Migration completion sprint |
| 2 | Authority fragmentation resolution | PARTIAL | Multiple authority surfaces don't agree; P0 finding from Shell Integrity audit | CO-Truth Audit + consolidation per shell_integrity_phase memory |
| 3 | Song DNA "front door" coherence | PARTIAL | Pierce: "the app has many chandeliers but still needs a better front door" | Discernment boundary work + home dashboard hardening (in progress) |
| 4 | Memory provenance + gate hardening | PARTIAL | Provenance not enforced at data layer; gate logic is UI-side | Trust-layer audit of Elevation infrastructure |
| 5 | Resolution gate + re-opening workflow | MISSING | No state-transition workflow exists for Memory resolution | Build of resolution candidate detection + human gate surface |
| 6 | Performance Convention as built primitive | RECOGNIZED | Typed prescriptive entity does not exist | Build of typed Convention primitive (light) |
| 7 | Reference Recording as built primitive | RECOGNIZED | External link slots exist informally; typed primitive does not | Build of typed Reference Recording with metadata (light) |
| 8 | Comparison primitive | RECOGNIZED | No engine, no Delta substructure | Build of Comparison primitive (medium) — depends on #6 or #7 |
| 9 | Tradition-aware tolerance configuration | MISSING | No tolerance configuration framework | Build of tolerance bands per tradition (medium) — depends on #8 |
| 10 | First Comparison pairing engine (Take vs Convention) | MISSING | No engine | Build (medium) — depends on #6 + #8 + #9 |
| 11 | Practice Recommendation synthesis surface | MISSING | No synthesis layer | Build (medium) — depends on #4 + #10 |

**The dependency-honoring sequence:** rows 1–4 are *foundation preconditions*. Rows 5–11 are *MVLS proper*. Building MVLS proper while preconditions remain unresolved is structural malpractice — the loop will close around an unstable foundation, generating evidence the Memory layer cannot reliably carry.

---

## §4 — Technical debt blocking MVLS

Audit of known technical debt that touches MVLS-adjacent surfaces.

### 4.1 — Foundation-layer debt

1. **Songs v2 migration incomplete** — legacy paths still read in some code surfaces. Per `project_songs_v2_migration` memory. Migration completion is foundational to consistent songId handling.
2. **Authority fragmentation (P0)** — per `project_shell_integrity_phase` memory: authority fragmentation is the active P0 architectural finding. Multiple authority surfaces don't agree. MVLS depends on clean authority for the promotion gate.
3. **Setlist SWR clobber** — per `project_setlist_swr_clobber_bug`. Whole-array `set()` rolls back unrelated entries. Not direct MVLS blocker but represents foundation-layer trust risk that could compound.
4. **Multitrack seek sync collapse (Bug #17)** — per `project_multitrack_seek_sync_bug`. Fix is server-side render (R1-R3). Not MVLS blocker but adjacent to the rehearsal-input surface.
5. **iOS PWA background throttling (CarPlay)** — recent stabilization fix shipped (visible-path validated; hidden-path untestable in Playwright). Real-device validation outstanding. Not MVLS blocker but affects the multitrack capture trust layer.

### 4.2 — Mid-layer debt

1. **iPhone safe-area validation** — bugs #28 + #30 shipped with code-correct fixes; real-device validation outstanding (Playwright cannot simulate notch). Not MVLS blocker but affects every surface where MVLS will land.
2. **Page-feedback / discoverability gaps** — the platform has many surfaces; not all are reachable from primary navigation. MVLS surfaces need clear entry points.
3. **focusChanged event model maturity** — per CLAUDE.md SYSTEM LOCK: the focusChanged event model is stabilized. This is a positive — MVLS can depend on it.

### 4.3 — Cross-cutting debt

1. **Elevation chain trust-layer infrastructure** — provenance is partially carried but not immutably enforced. Resolution semantics are not coded. Re-opening flow does not exist.
2. **Comment-to-Candidate promotion path** — exists conceptually; not surfaced cleanly.
3. **AI proposal infrastructure** — does not exist. The platform has no precedent for AI-proposing-to-human-gate workflows. Building MVLS Comparison engines requires establishing this infrastructure carefully (confidence floors, batching, dismissal feedback loops).

### 4.4 — Net technical-debt read

The platform has **moderate but addressable** debt. The two structural blockers are **Songs v2 migration completion** and **Authority fragmentation resolution**. Everything else is either MVLS-adjacent or non-blocking.

**Implication:** MVLS build cannot prudently begin until Songs v2 + Authority are resolved. These are 2–4 weeks of focused work each, possibly parallelizable.

---

## §5 — UX debt blocking MVLS

Per Pierce synthesis (`project_pierce_synthesis_2026-05-29`): *"The app has many chandeliers but still needs a better front door."*

### 5.1 — The front-door problem

A user opening GrooveLinx for the first time post-onboarding should see one place that says "start here" and that takes them into the loop. Current state: the home dashboard is functional but per Pierce's signal, the front door is unresolved.

MVLS depends on visible-loop closure. If the user cannot find the loop, they cannot see improvement. The front-door problem is therefore an MVLS blocker.

### 5.2 — Rehearsal Review as killer workflow

Per Pierce: Rehearsal Review IS the killer workflow. MVLS surfaces (Memory promotion, Convention authoring, Comparison reading, Practice Recommendation acceptance) naturally land inside Rehearsal Review. This is good news — the killer workflow and MVLS are aligned. But Rehearsal Review must be stabilized as an entry point before MVLS overlays on it.

### 5.3 — Authority surfaces

Per shell integrity phase: authority fragmentation surfaces in UI as "who can do what" inconsistencies. MVLS introduces a promotion gate (Memory) and a confirmation gate (Resolution). Both require clean authority surfaces. If authority is fragmented, the gates will inherit the confusion.

### 5.4 — Trust-layer surface vocabulary

The platform has no established UI vocabulary for "the system proposed this; you decide." MVLS depends on this vocabulary being clean. Without it, AI-proposed candidates will either feel authoritative (eroding trust) or feel ignorable (collapsing recall).

### 5.5 — Net UX-debt read

The platform has **significant** UX debt against MVLS. The front-door problem and the trust-layer vocabulary gap are the largest. The front-door problem is being actively worked. The trust-layer vocabulary needs explicit design before MVLS overlays on existing surfaces.

---

## §6 — Trust-layer risks

The trust layer is GrooveLinx's structural advantage. MVLS introduces AI-assisted proposal generation, which is the highest-pressure test the trust layer will face.

### 6.1 — Risk: AI candidate flood

Comparison engines run; Deltas surface; Candidate Memories accumulate. Without confidence floors and batching, members are flooded. Trust erodes.

**Mitigation status:** confidence floors are RECOGNIZED in design; not BUILT. Batching infrastructure does not exist.

### 6.2 — Risk: Provenance leakage

Memories without enforced provenance can be authored by AI or system processes without a human gate. This violates the architectural promise.

**Mitigation status:** provenance is partially carried; immutable enforcement at data layer is MISSING.

### 6.3 — Risk: Promotion gate bypass

If the promotion gate is enforced only in the UI, server-side or backend processes could create Memory records without it. Trust collapses.

**Mitigation status:** gate enforcement is currently UI-side. Data-layer enforcement is MISSING.

### 6.4 — Risk: Resolution premature closure

If Resolution is gated only by a count of "good takes" without confidence threshold, premature closure happens. Bands lose confidence in the resolution signal.

**Mitigation status:** Resolution gate workflow does not exist. The risk is theoretical until the workflow is built.

### 6.5 — Risk: Member vs Member surfacing

Comparison's most sensitive pairing is member-vs-member. If this surfaces without consent or in shared contexts, interpersonal harm is real.

**Mitigation status:** the architecture forbids this without opt-in. The build must honor this. No precedent in the platform yet.

### 6.6 — Net trust-layer read

The trust layer is **architecturally protected but operationally untested at MVLS scale**. The principles are documented; the infrastructure to enforce them at data layer (provenance immutability, gate enforcement, confidence floors, batching) is not yet built.

Building Comparison engines before this infrastructure is built is the **single largest trust-layer risk** in the audit.

---

## §7 — Data-model risks

### 7.1 — Risk: songId drift

Recently mitigated via the Canonical Song Identity sprint (`rebindSegmentSong` helper). The defensive infrastructure exists. The risk is contained.

**Status:** mitigated. Continued discipline required.

### 7.2 — Risk: segmentId denormalization pressure

Comparison generates many records that *could* attach via songId for query convenience. The architectural decision (per prior memories): segmentId is the durable anchor; songId aggregation by query. MVLS implementation must honor this even when denormalization seems convenient.

**Status:** principle established. Enforcement depends on build discipline.

### 7.3 — Risk: Songs v2 migration breakage

If MVLS-tied data attaches to legacy `songs/{title}` paths during the migration window, the migration becomes harder and the MVLS data becomes orphaned.

**Status:** open. Migration completion is a precondition.

### 7.4 — Risk: Memory provenance not queryable

If Memory records carry provenance as opaque blobs rather than queryable typed fields, future audits and resolutions cannot trace causality.

**Status:** RECOGNIZED. Build must include queryable provenance.

### 7.5 — Risk: Comparison Delta storage growth

Comparison generates structured Deltas at scale. Without retention policy, storage grows unboundedly.

**Status:** RECOGNIZED in primitive spec. Retention policy is a build concern.

### 7.6 — Net data-model read

Data-model risks are **manageable**. The Canonical Song Identity sprint addressed the largest. Songs v2 migration is the remaining gating concern. Other risks are addressable as part of MVLS build.

---

## §8 — Current GrooveLinx features that directly support MVLS

These are features in production that MVLS can build on:

1. **Multitrack rehearsal infrastructure** — captures takes with segmentId. Direct input for Comparison.
2. **Song Clips Phase C** — segmentId-keyed performance artifacts. Foundation for audition clips and Take-level performance evidence.
3. **Comments** — the conversational substrate. Direct input for Elevation chain.
4. **Practice Task primitive** — direct consumer of Practice Recommendation synthesis.
5. **Song DNA surface** — the read-side destination for promoted Memories, Conventions, and Comparison surfaces.
6. **Harmony Plan** — Part Plan's vocal-harmony subtype; immediate Comparison target candidate (member's harmony performance vs Harmony Plan row).
7. **FocusEngine** — provides readiness signals that feed Practice Recommendation prioritization.
8. **Authority graph** — gates who can promote, who can confirm Resolution.
9. **Stem extraction infrastructure** — feature extraction for Comparison engines that need stems-as-evidence.
10. **Reference recording link slots (informal)** — data exists; typing it as Reference Recording primitive is mostly a schema-formalization step.
11. **GLStore canonical state** — the centralized state layer is the right place for MVLS primitives to live.
12. **Notification system** — can surface Recommendations and Resolution-candidate prompts.

This is a **strong direct-support base**. MVLS is not building on a green field.

---

## §9 — Current GrooveLinx features unrelated to MVLS

These are features in production that MVLS will not directly affect or be affected by. Noted so they don't get prematurely pulled into MVLS scope:

1. Stage plot
2. Calendar integration (Google Calendar)
3. Gigs surface (event-management — adjacent to but not part of MVLS)
4. Bestshot
5. Playlists (Spotify-side, not GrooveLinx setlists)
6. Help / Onboarding surfaces
7. A2P 10DLC submission / SMS infrastructure
8. Push notification infrastructure (FCM)
9. Admin / band onboarding flows
10. Service-worker / PWA infrastructure

**Implication for build scoping:** MVLS does not need any of these. Resist scope expansion that pulls them in.

---

## §10 — Smallest implementation slice

What is the smallest possible implementation slice that would prove the learning system works?

### 10.1 — Candidate slices

**Slice A — Memory hardening only**
- Provenance immutability at data layer.
- Promotion gate enforcement at data layer.
- Resolution gate workflow + re-opening.
- No new primitive built.

**Visible value:** existing Memories become trustworthy; history queryable; band sees "we used to struggle with X; we don't anymore." Loop does not close — no Comparison.

**Slice B — Memory hardening + Convention primitive**
- Slice A plus:
- Convention as built primitive (typed, versioned, Song-scoped).
- Surface for Convention authoring + display on Song DNA.
- No Comparison.

**Visible value:** band codifies what they've agreed; "watch Jay for the ending" lives on Song. The trust layer holds. But the loop still does not close — no measurement against the Convention.

**Slice C — Slice B + minimum Comparison engine**
- Slice B plus:
- Comparison primitive with one pairing engine (Take vs Convention, binary trigger).
- Delta as substructure within Comparison.
- Tradition-aware tolerance for the one pairing (start with binary "honored / not honored / inconclusive" — simplest tolerance).
- Surface: Comparison Deltas appear as Evidence within candidate Memory proposals.

**Visible value:** the loop closes for the first time. The band sees "we agreed to drop out after first chorus; the system shows we did it on 4 of 5 takes Saturday." The Memory layer absorbs the Delta as evidence. A Candidate Memory may be proposed. A human gates it.

**Slice D — Slice C + Practice Recommendation surface**
- Slice C plus:
- Synthesis: Memory + Delta → Practice Recommendation.
- Recommendation surfaces in Practice Task surface.
- Acceptance creates a Practice Task; dismissal dampens future signal.

**Visible value:** the loop's backward edge surfaces. Band sees not just "we missed it" but "here's what to practice."

### 10.2 — Recommendation

**The smallest slice that closes the loop is Slice C.**

Slice A is a hardening pass — necessary, but does not close the loop.
Slice B is a primitive build — necessary, but does not close the loop.
Slice C is the minimum at which a user can say "GrooveLinx actually helped us see something we agreed to and measure whether we did it."
Slice D adds the backward edge but is not strictly minimum.

### 10.3 — The progressive shape

Slices A → B → C → D form a progressive shape. Each is a coherent shippable step. Each adds visible value over the prior. None requires building D's surfaces before A's foundation is solid.

This is the dependency-honoring path. Sequence is the discipline.

---

## §11 — Highest-confidence path to first user-visible improvement

The path with the strongest visible-value-per-build-effort ratio:

### Step 1 — Memory infrastructure hardening (Slice A foundation)

- Trust-layer audit of Elevation chain.
- Provenance immutability at data layer.
- Resolution gate + re-opening workflow.
- Memory query surfaces hardened.

**Why first:** every downstream MVLS capability depends on Memory being trustworthy. Hardening Memory before adding Comparison engines protects the trust layer at scale.

**Visible value:** existing Memories become more trustworthy. Drew can see "we used to struggle with X; we don't anymore." This is incremental, not transformational.

### Step 2 — Convention as built primitive

- Typed Convention entity (Song-scoped, optional Arrangement Version scope, versioned).
- Convention authoring + display surface on Song DNA.
- Convention promotion path (from Comment thread agreement).

**Why second:** lightest weight new primitive. Highest trust-layer alignment (Conventions are explicit human agreements). Immediately surfaces on Song DNA.

**Visible value:** band has a place to put "watch Jay for the ending." First load-bearing addition to the Memory layer.

### Step 3 — Comparison primitive + Take vs Convention engine

- Comparison primitive (typed record, provenance, queryable).
- Delta substructure.
- Tradition-aware tolerance (start with binary).
- Engine for Take vs Convention.
- Delta-to-Evidence integration.

**Why third:** loop closure. The first Comparison pairing engine is the medium-weight build that makes the platform demonstrably "help the band get better."

**Visible value:** the loop closes. Drew sees "did we honor the convention?" answered structurally.

### Step 4 — Practice Recommendation surface

- Synthesis: Memory + Delta → suggested action.
- Surface on Practice Task panel.
- Acceptance / dismissal feedback.

**Why fourth:** the loop's backward edge becomes visible. Without this, the platform measures but does not teach.

**Visible value:** band starts seeing improvement signal. The North Star "GrooveLinx actually helped my band get better" becomes audibly true.

### Net read

This four-step path is the **highest-confidence sequence**. Each step is independent enough to ship, dependent enough to require ordering, and visible enough to validate before the next.

---

## §12 — Highest-risk assumptions currently embedded

### 12.1 — Assumption: Memory infrastructure is hardenable in reasonable time

If Memory hardening (Slice A) reveals deeper trust-layer issues than anticipated, MVLS is delayed substantially. The audit cannot validate this without doing the hardening work.

### 12.2 — Assumption: Convention authoring can be light-weight

If Convention authoring requires complex conditional-trigger structures, structured semantics, or extensive surface design, "light" becomes "medium" and the build slows.

### 12.3 — Assumption: Tradition-aware tolerance can be designed from Western data

If MVLS Comparison engines are designed with Western tonal defaults and then have to be retrofitted for global users, the retrofit cost may exceed the upfront-design cost.

### 12.4 — Assumption: AI proposal infrastructure can be built without precedent

The platform has no current AI-proposes-to-human-gate workflow. Building one for Comparison-generated candidate Memories establishes both the engine and the discipline. If the first AI-proposal surface gets the discipline wrong, the trust layer is harder to defend later.

### 12.5 — Assumption: Songs v2 migration completes before MVLS data lands

If MVLS data attaches to mixed-state Song records during the migration window, post-MVLS migration cleanup may be painful or lossy.

### 12.6 — Assumption: Authority fragmentation can be resolved without new fragmentation

Resolving authority fragmentation is itself a stabilization project. If the resolution introduces new fragmentation (e.g. MVLS-specific authority surfaces that diverge), the P0 finding re-opens.

### 12.7 — Assumption: Pierce's "front door" work converges in time

If the front-door consolidation is still in motion when MVLS surfaces ship, MVLS surfaces add to the chandelier problem rather than helping the front door.

### 12.8 — Assumption: Real-device validation pipeline matures

The Playwright UAT pass identified gaps in real-device validation (iPhone safe-area, CarPlay background throttling, FCM behavior at scale). MVLS surfaces will inherit these validation challenges. Without a mature real-device pipeline, MVLS surfaces ship with unknown mobile risk.

### 12.9 — Assumption: Band remains in active live-UAT mode

Drew's band is doing live UAT. MVLS development depends on real friction signals. If band rehearsal cadence drops or UAT discipline slips, the signal source weakens.

### 12.10 — Assumption: Recognition discipline holds through implementation

The platform's discipline is to defer build until friction signals. If implementation pressure causes recognized-but-deferred primitives (Arrangement, Part, Reference Recording in full) to ship prematurely to "complete MVLS faster", the architectural integrity erodes.

---

## §13 — The verdict

> **Would I begin implementation now?**
>
> # **NO.**
>
> Not yet. With a qualified path forward and a defended position.

---

## §14 — Defense of the answer

### 14.1 — Why not YES

The temptation is to say YES because the architecture is whole, the recognition is complete, the foundation is real, and the smallest slice (Slice A) is light. The temptation is reasonable. It is also wrong.

**Three structural reasons NOT to begin now:**

1. **Songs v2 migration is incomplete.** Building MVLS on a foundation undergoing migration risks orphaning MVLS data or creating mixed-state Memory records that future migrations cannot cleanly handle. The migration completion is a precondition.

2. **Authority fragmentation is the active P0 architectural finding.** Per the Shell Integrity Phase memory, this is the named structural priority. MVLS's promotion gate depends on clean authority. Building MVLS through fragmented authority surfaces inherits and compounds the fragmentation.

3. **Memory infrastructure has not been trust-layer-hardened.** The Elevation chain exists conceptually with capture and comment in production; the gate-at-data-layer, provenance-immutability, resolution-workflow infrastructure is not built. Adding AI-proposal capability (Comparison engines) to a Memory layer that is not yet hardened risks erosion of the platform's structural advantage. Trust-layer-protection-first is the discipline.

### 14.2 — Why the answer is not "never"

The answer is "not yet" — not "not at all." The architecture is sound. The path is clear. The preconditions are bounded and addressable. The friction signals will surface as Drew and his band continue active UAT.

The conditions under which the answer flips to YES are explicit:

1. Songs v2 migration completes.
2. Authority fragmentation is named, consolidated, and the P0 finding is closed (or contained to a degree that MVLS's promotion gate can operate on a stable authority surface).
3. Memory infrastructure is trust-layer-hardened: provenance immutable at data layer, gate enforced at data layer, resolution workflow built.
4. The "front door" coherence work converges to a state where MVLS surfaces can land inside a known entry path.

Steps 1–4 are roughly 2–4 months of focused work each, possibly parallelizable into 2–3 months total elapsed. The architecture is patient. The build can wait that long.

### 14.3 — What "NO, not yet" enables

This answer is not a postponement. It is a **prioritization**.

While the preconditions are being addressed, the recognition specs serve as the design source-of-truth. Future agents reading this work do not need to re-litigate the architecture. The architecture is ready; the platform foundation is what needs hardening.

By saying NO now, the platform protects:
- The trust layer (it does not get tested by MVLS until it is hardened).
- The architectural integrity (recognition discipline holds).
- The Song-centric narrative (it does not get diluted by half-built MVLS surfaces on top of fragmented authority).
- The band's UAT signal (the band continues to surface friction at the right layer — foundation issues, not premature MVLS issues).

### 14.4 — What "NO, not yet" costs

This answer defers visible loop-closure for 2–4 months. During that time:
- The "GrooveLinx actually helped my band get better" moment is delayed.
- Competitive pressure may continue (though no competitor models the loop architecturally).
- Drew's strategic urgency may push for earlier build.

The audit's claim is that the cost of waiting is **lower than the cost of building on an unstable foundation**. A Memory layer that fails the trust test under MVLS load damages the platform more than a 2–4 month delay does.

### 14.5 — The smallest move that points toward YES

If implementation pressure is high and "do something MVLS-shaped now" is required, the smallest defensible move is:

**Begin Slice A (Memory infrastructure hardening) immediately — in parallel with Songs v2 migration completion and Authority fragmentation resolution.**

Memory hardening is the right work regardless of MVLS timing. It is the foundation that MVLS depends on. Building it now is not premature; it is prerequisite. Slices B / C / D wait until the foundation work is closed.

This compromise honors the discipline (no premature primitive build) while making forward progress on the work that is unblocked.

### 14.6 — The honest closing posture

The audit chose NO because honesty serves the architecture better than enthusiasm. The platform is closer to MVLS than ever before in its history. The recognition is complete. The sequence is named. The build is patient. The work that comes first — Songs v2, Authority, Memory hardening, Front door — is the same work that would have come first under any disciplined sequencing.

NO now means YES soon, with confidence. YES now means uncertain progress on an unstable foundation, with the trust layer at risk.

The Song is the place. The rehearsal is the input. Improvement is the output. Comparison is the engine. The engine is ready in design. The platform that will run the engine needs another quarter of foundation work first.

Then YES.
