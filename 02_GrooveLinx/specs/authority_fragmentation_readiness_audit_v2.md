# Authority Fragmentation — Readiness Audit v2

> **Readiness audit. Design-only. NOT a target authority model. No solutions. No permissions defined.**
>
> Author voice: GrooveLinx Principal Architect. Post-Stage-1 authority readiness — what's actually enforced, what depends on what, and what is the smallest viable resolution slice.
>
> **Purpose:** update v1's readiness picture with post-Stage-1 deployed reality, the structural-error post-mortem, and the explicit Memory Hardening Phase 2 dependency map. The Authority Resolution Phase 1 Design phase is paused; this audit prepares it to begin cleanly.
>
> **Inputs:**
> - `02_GrooveLinx/specs/authority_fragmentation_recognition_v1.md` (the cartography)
> - `02_GrooveLinx/specs/authority_fragmentation_readiness_audit_v1.md` (the initial readiness audit)
> - `02_GrooveLinx/docs/security-stabilization-rules-patch-v1.md` (the Stage 1 patch design)
> - Deployed Firebase Console rules post-Stage-1 publish + 16/16 REST verification (2026-05-30)
> - The Phase 1 `.write` vs `.validate` cascade post-mortem

---

## §0 — Frame

v1 of this audit (commit `56e07237`) was written from the deployed-rules diagnosis. Since v1, the Stage 1 security patch shipped (with one mid-deploy correction) and is verified end-to-end. The authority enforcement surface has shifted. v2 documents the new picture, sharpens the smallest viable resolution slice, and maps Memory Hardening Phase 2 prerequisites concretely.

This document is recognition + readiness only. It does NOT propose what the target authority model should look like (that's design, which Drew has paused).

---

## §1 — Actual enforcement surfaces (post-Stage-1)

Authority — in the access-control sense — is enforced today through these surfaces:

### §1.1 — Server-side enforcement (Firebase RTDB rules)

| Path | Enforcement | Strength |
|---|---|---|
| `/users/` | `.read: false`, `.write: false` | **Hard lock.** No client can read or write. Cloud Functions (admin SDK) bypass rules — but the path is unused by both Functions and client code. |
| `/care_packages_public/` | `.read: true`, `.write: false` | Public broadcast; client-write deprecated. Cloud Functions can still write via admin SDK. |
| `/members_index/` | `.read: true`, `.write: false` | Public read (needed by auth gate); Cloud-Function-only write (mirrorMemberToIndex maintains it). |
| `/bands/$bandId/annotations/$annotationId/promoted` | `.validate: !data.exists() OR data.val() === newData.val()` | Write-once enforcement on promotion boolean. Cannot be modified after first write. |
| `/bands/$bandId/annotations/$annotationId/promoted_by` | `.validate: !data.exists() OR data.val() === newData.val()` | Same — forgery rejected. |
| `/bands/$bandId/annotations/$annotationId/promoted_at` | `.validate: !data.exists() OR data.val() === newData.val()` | Same. |
| `/bands/$bandId/annotations/$annotationId/promoted_from` | `.validate: !data.exists() OR data.val() === newData.val()` | Same. |
| `/bands/$bandId/annotations/$annotationId/promotion_authority` | `.validate: !data.exists() OR data.val() === newData.val()` | Same. |

### §1.2 — Surfaces with NO server-side enforcement

| Path | Posture | Risk surface |
|---|---|---|
| `/bands/$bandId/.read` | `true` (public) | **Any internet client can read any band's complete data tree.** |
| `/bands/$bandId/.write` | `true` (public) | **Any internet client can write to any band's data tree** — except the five Phase 1 promotion fields (validated above) and the future Stage 2 tightening targets. |
| `/shared_setlists/.read` | `true` | Intentional (public share). |
| `/shared_setlists/.write` | `"true"` (public) | Anyone can write any shared setlist. Stage 2 candidate to tighten to `auth != null` after Firebase Auth wiring. |
| `/bands/.read` (root) | `true` | Anyone can list the bands tree at the root. |

### §1.3 — Client-side gates (UI-layer only — bypassable via direct SDK)

| Surface | Mechanism | Real protection? |
|---|---|---|
| Boot auth gate (`_glCheckBandMembership` in `app.js:5888`) | Reads `members_index/{sanitized_email}` to determine band membership; kicks if not found | **NO** — the gate runs only in the app's loaded JS context. A client that initializes Firebase directly (with the project config visible in DevTools) skips it. |
| Admin button (`injectAdminButton`) | `currentUserEmail !== OWNER_EMAIL` check | NO — pure UI gate; data layer permits anyone. |
| Member identity (`getCurrentMemberKey`) | Resolves OAuth email → bandMembers memberKey | NO — used for authorship attribution; not a permission gate. |

### §1.4 — The fundamental enforcement asymmetry

**Server-side enforcement exists on the periphery** (locked `/users/`, gated `/care_packages_public/` write, mirror-only `/members_index/`, and field-level immutability on five promotion fields). **The central band data tree (`bands/$bandId/*`) has no server-side enforcement of any kind.**

The auth gate is real for UI flow but illusory for security. This is the F14 finding from v1, unchanged by Stage 1.

---

## §2 — Authority dependencies graph

What depends on what, post-Stage-1.

```
                  Firebase Auth wiring (CODE CHANGE)
                              │
                ┌─────────────┼─────────────┬─────────────┐
                ▼             ▼             ▼             ▼
        Tighten bands/  Tighten /shared/  Resolve F3    Stage 2 admin
        $bandId/.write   setlists.write   (keying       role server-side
        to auth != null  to auth != null   convention)  enforcement
                │             │             │             │
                ▼             ▼             ▼             ▼
       MVLS preconditions     ✓     Member-keyed     Memory Hardening
       partial unblock              auth rules        Phase 2 gates
                │                       │                  │
                └───────────────────────┴──────────────────┘
                                       │
                                       ▼
                          MVLS authorization eligible
                          (with Songs v2 + Pierce front-door)
```

### §2.1 — Critical path dependencies

1. **Firebase Auth wiring (CODE)** is the gating prerequisite for everything else. Without it, no `auth != null` rule can fire.
2. **Tightening `bands/$bandId/.write`** to require auth is the first server-side enforcement on the central exposure. It's NOT a membership check — it's "any signed-in Google user." This is the minimum-viable F14 mitigation.
3. **F3 reactivates** as a design question: should the membership rule key on `auth.uid` (Firebase Auth's identifier) or on memberKey (the app's identifier)? The deployed code stores members as `bands/{slug}/meta/members/{memberKey}` — a memberKey-keyed membership rule would need to derive memberKey from `auth.token.email` at rule-evaluation time. This is the central authority-modeling decision Drew paused.
4. **Memory Hardening Phase 2** requires both #2 (auth != null on parent) AND a server-side role/permission model for the promotion / resolution / re-open gates. The role model could be:
   - **Permissive variant:** any band member can promote (simplest; `auth != null && member-of-band`)
   - **Authority-checked variant:** specific permissions on member records (matches v1 documented intent)
   - This decision blocks Phase 2 design.

### §2.2 — Independent / lateral concerns

| Concern | Authority-dependent? | Notes |
|---|---|---|
| Phase 1 immutability (DONE) | No — uses value-comparison, not auth | Already enforced via .validate |
| F1 (author/addedBy/createdBy/owner naming) | No | Pure data-model cleanup; doesn't require auth wiring |
| F2 (`members/` vs `meta/members/` split) | Indirect | Path consolidation is data-model work; not blocked by auth |
| F10 (authorship value shape: email vs memberKey) | No | Pure data-model normalization |
| F6 (hardcoded email→key maps in 5+ files) | No | Pure code cleanup |
| F9 (`getCurrentMemberKey` vs `GLUserIdentity` duplication) | No | Pure code cleanup |
| Songs v2 migration | No | Independent of authority |
| Pierce front-door work | No | Independent of authority |

**Insight:** roughly half of the fragmentation findings (the data-model/cleanup half) can be addressed independently of Authority Resolution. The other half (server-side enforcement, role model, membership check shape) all gate on Firebase Auth wiring + the F3 design decision.

---

## §3 — Smallest viable Authority Resolution slice

The Recognition v1 spec identified three concentric slices (ZERO / ONE / TWO). With Stage 1 shipped, the boundary between them is sharper.

### §3.1 — Updated slice taxonomy

**Slice Z — Stage 1 (SHIPPED).**
- Phase 1 immutability rules (5 .validate guards on annotation promotion fields)
- /users/ lock, /care_packages_public/ write lock
- **What it bought:** trust-layer enforcement for Memory promotion fields. F13 resolved. F15 (partial) resolved.
- **What it did NOT close:** F14, the central exposure.

**Slice A — Firebase Auth wiring + minimum auth gate (CODE + RULES, smallest viable next step).**
- **CODE work:** wire `firebase.auth().signInWithCredential(googleCredential)` in `app.js` `getCurrentUserEmail()` after Google OAuth succeeds. Approximate scope: ~10-30 lines of code touching the auth flow + careful handling of auth state changes + Firebase Auth SDK already loaded.
- **RULES work:** change `bands/$bandId/.write: true` → `.write: "auth != null"`. Change `shared_setlists.write: "true"` → `.write: "auth != null"`.
- **What it buys:** server-side enforcement that only signed-in Google users (any signed-in Google user, NOT membership-checked) can write to band data. Closes F14 to "authenticated-user-required" posture. Stage 2 of security stabilization.
- **What it does NOT do:** membership check. Any signed-in Google user can still write any band's data via direct SDK access. But the public-write-from-internet exposure is closed.
- **Constraint:** does not require resolving F3. The auth.uid vs memberKey design decision can be deferred.

**Slice B — Membership-checked write (RULES + design decision).**
- **Design decision:** resolve F3 — does the membership rule use `auth.uid` or memberKey? Given the deployed code uses memberKey storage, the natural fit is to derive memberKey from `auth.token.email` and check `bands/$slug/meta/members/{memberKey}` exists. But this requires Firebase Auth + email scope on the credential.
- **RULES work:** `bands/$bandId/.write: "auth != null && root.child('bands/'+$bandId+'/meta/members').orderByChild('email').equalTo(auth.token.email).limitToFirst(1).numChildren() > 0"` — or a sanitized-email mirror approach.
- **What it buys:** server-side enforcement that ONLY band members can write to their band's data. Closes F14 fully.
- **Open question:** the rule-shape design — efficient membership check via RTDB rules requires either (a) the index already exists, or (b) a derived path lookup. Needs careful design.

**Slice C — Admin role enforcement (RULES, post-Slice-B).**
- After Slice B, add admin role check on paths that need it: `bands/$bandId/meta/members/{key}/role === 'admin'` gates specific paths.
- Resolves F16 (admin role check not enforced).
- Replaces F4 hardcoded `OWNER_EMAIL` constant with data-layer check.

**Slice D — Memory Hardening Phase 2 promotion authority (RULES + .validate semantics).**
- Builds on Slice B + C.
- Adds promotion permission check on the five Phase 1 immutability fields' first-write.
- Adds Resolution-confirmation rules (status='fixed' requires authority + confirmation fields).
- Adds Re-open workflow with preserved history.

### §3.2 — Smallest viable resolution slice = Slice A

**Slice A is the smallest meaningful step.** It:
- Closes the central public-write exposure (F14) to authenticated-user posture
- Does NOT require resolving F3 (deferred)
- Does NOT require designing the role model (deferred to Slice C/D)
- Is bounded: code change is well-scoped (a few lines in `getCurrentUserEmail`); rules change is a 2-key edit
- Is reversible: rollback is straightforward (revert code change + revert rules to current state)
- Enables Slice B / C / D to follow incrementally

**Slice A does NOT close all authority gaps**, but it materially improves security posture and unblocks the design path forward.

---

## §4 — Memory Hardening Phase 2 prerequisites (concrete)

Phase 2 capabilities, with concrete prerequisite ordering:

| Phase 2 capability | Prerequisites (ordered) |
|---|---|
| G3: Promotion authority enforcement | Slice A → Slice B → Slice D promotion-permission rule design |
| G5: Resolution-confirmation gate (status='fixed' requires confirmation fields) | Slice A → migrate `rehearsal.js:1937` auto-resolve caller → design resolution-confirmation rule shape |
| G6: Re-open workflow with history preservation | Slice A → design re-open rule shape (must preserve `resolved_by`/`resolved_at` as history when status transitions away from 'fixed') |
| G4: AI service-account distinction | Slice A → introduce service-account identity concept (currently no service accounts exist) → design service-account permission gates |

### §4.1 — Phase 2 cannot ship without Slice A at minimum

Each Phase 2 capability requires `auth != null` to be enforced on `bands/$bandId/.write` at minimum. Otherwise, an attacker can:
- Forge promotion records by creating a fresh annotation with arbitrary `promoted_*` values (the `.validate` rule's `!data.exists()` branch permits first-time writes — but in practice this means an unauthenticated attacker can create a fresh annotation that LOOKS LIKE a promoted Memory)
- Bypass Resolution gates by writing `status: 'fixed'` directly
- Delete and re-create annotations to circumvent immutability

Slice A closes the "unauthenticated attacker" vector. Membership checks (Slice B) close the "any-authenticated-user-attacks-another-band" vector.

### §4.2 — `rehearsal.js:1937` known caller migration

The Phase 1 design noted this caller (`await window.GLAnnotations.updateAnnotation(oldest.id, { status: 'fixed' });`) as a Phase 2 migration target. Any Slice D Resolution-confirmation rule will need to either:
- Migrate this caller to use a typed `resolveAnnotation()` helper that supplies the required confirmation fields, OR
- Grandfather it as a service-actor exception (less clean)

The caller is well-bounded and the migration is small. Should land before or with Slice D.

---

## §5 — Re-ranked fragmentation findings (post-Stage-1)

| # | Finding | v1 Severity | v2 Severity | Change rationale |
|---|---|---|---|---|
| F1 | author/addedBy/createdBy/owner naming | HIGH | HIGH | Unchanged — pure data-model cleanup; not addressed by Stage 1 |
| F2 | `members/` vs `meta/members/` split | MEDIUM | MEDIUM | Unchanged |
| F3 | Docs use auth.uid; code uses memberKey | RESOLVED-NEUTRALIZED | **REACTIVATES AT SLICE B DESIGN** | Currently moot (no auth enforcement); becomes the central design decision when Slice B begins |
| F4 | `OWNER_EMAIL` constant vs `isOwner` flag | MEDIUM | MEDIUM | Unchanged; Slice C resolves |
| F5 | `BAND_MEMBER_EMAILS` array vs `bandMembers` global | MEDIUM | MEDIUM | Unchanged |
| F6 | `emailToKey` maps duplicated in 5+ files | MEDIUM | MEDIUM | Unchanged |
| F7 | Mode-B observability in Mode-A deploy | LOW | LOW | Unchanged |
| F8 | "authority"/"role" naming overload | LOW | LOW | Unchanged |
| F9 | `getCurrentMemberKey` vs `GLUserIdentity` duplication | LOW-MEDIUM | LOW-MEDIUM | Unchanged |
| F10 | Authorship value shape inconsistency | MEDIUM | MEDIUM | Unchanged |
| F11 | Phase 1 inherits fragmentation | MEDIUM | RESOLVED-DEFERRED | Phase 1 ships with `auth_version: 'phase1'` marker; identity-shape resolution still deferred to Phase 2 |
| F12 | `localStorage` override of OAuth identity | LOW | LOW | Unchanged |
| F13 | Phase 1 immutability rules NOT deployed | CRITICAL (v1 readiness) | ✅ **RESOLVED** | Stage 1 shipped + verified 2026-05-30 |
| F14 | `bands/$bandId` publicly readable + writable | CRITICAL | **HIGH (downgraded from CRITICAL)** | Still wide-open, but Phase 1 immutability now protects the five most-sensitive fields against modification; F14 closure depends on Slice A (Firebase Auth + rule tightening) |
| F15 | `/users/` and `/shared_setlists/` wide-open writes | MEDIUM | PARTIAL-RESOLVED | `/users/` locked by Stage 1; `/shared_setlists/` remains until Slice A |
| F16 | Admin role check documented but not deployed | MEDIUM | MEDIUM | Unchanged; Slice C resolves |
| F17 | Per-uid write isolation documented but not deployed | MEDIUM | MEDIUM | Unchanged; Slice B+ design question |

### §5.1 — Post-Stage-1 severity tally

**v1 readiness audit:** 2 CRITICAL, 1 HIGH, 8 MEDIUM, 4 LOW, 1 RESOLVED.

**v2 (post-Stage-1):** **0 CRITICAL**, **2 HIGH** (F1, F14-downgraded), **7 MEDIUM** (F2/F4/F5/F6/F10/F16/F17), **4 LOW** (F7/F8/F9/F12), **2 RESOLVED** (F13/F11), **1 PARTIAL-RESOLVED** (F15), **1 REACTIVATES-AT-DESIGN** (F3).

**The critical-finding count went from 2 to 0.** Stage 1 closed the immediate security incident posture. F14 remains the largest gap but is no longer critical-severity — Phase 1 immutability constrains the most-trust-sensitive surface even with the parent open. Closing F14 fully requires Slice A.

---

## §6 — Prerequisites for Memory Hardening Phase 2

In dependency order:

1. **Drew authorizes Authority Resolution work to begin.** Currently paused.
2. **Authority Resolution Phase 1 Design** ships. The design must:
   - Resolve F3 (auth.uid vs memberKey for membership rules)
   - Specify Slice A scope (Firebase Auth wiring + minimum auth gate)
   - Specify Slice B scope (membership check rule shape)
   - Specify Slice C scope (admin role enforcement)
3. **Slice A ships** (Firebase Auth code + bands/$bandId/.write tightening to `auth != null`).
4. **Slice B ships** (membership-checked write).
5. **Slice C ships** (admin role enforcement at data layer; F4 resolves).
6. **Memory Hardening Phase 2 Design** can then begin. Specifies promotion-permission rule, Resolution-confirmation rule, Re-open workflow rule, `rehearsal.js:1937` migration.
7. **Phase 2 ships**.

### §6.1 — Earliest viable Phase 2 ship

Optimistic critical path: Authorization → Authority Phase 1 Design (1-2 sessions) → Slice A (small ship: code + rules) → Slice B (medium ship: design + rules) → Phase 2 Design → Phase 2 Ship.

Realistic: spanning multiple working sessions. The recognition discipline (each step is its own spec) keeps each step bounded.

### §6.2 — Phase 2 can be partially shipped against Slice A only

If urgency requires it, Phase 2 could ship the simplest variant (any-authenticated-user can promote; no role check) against Slice A's auth-required posture. This is structurally weak — it doesn't enforce member-of-band — but it's a real improvement over today's no-server-enforcement state. Slice B + C + full Phase 2 follow.

This is a design choice, not a recommendation. Surfaced for future Phase 2 design conversation.

---

## §7 — MVLS precondition status (refreshed)

Original three MVLS preconditions:
1. Songs v2 migration completion
2. Authority fragmentation resolution
3. Memory Hardening Phase 2

**Updated against v2 readiness:**

1. **Songs v2 migration completion** — 🔄 IN PROGRESS. Independent of Authority work.
2. **Authority fragmentation resolution** — Now better characterized as "Slice A + Slice B at minimum" — partial resolution is sufficient for MVLS preconditions (full F1-F17 resolution is not required). Slice A alone may be enough if MVLS's promotion gate accepts the "any-authenticated-user" permissive variant.
3. **Memory Hardening Phase 2** — Status preserved: PENDING — gated by Slice A + Slice B at minimum.
4. **Pierce front-door coherence** — Independent; MVLS-soft precondition.

**MVLS authorization remains:** 🚫 NOT AUTHORIZED. The path is clearer post-Stage-1 but not shorter.

---

## §8 — What this audit settles

- Post-Stage-1 enforcement surface inventory complete
- Phase 1 immutability resolved (F13 closed; verified end-to-end)
- F14 severity downgraded HIGH (not CRITICAL) — Phase 1 immutability constrains the most-trust-sensitive surface
- Slice A identified as smallest viable Authority Resolution next step
- Memory Hardening Phase 2 prerequisites mapped concretely
- F3 will reactivate as the central design question when Slice B begins
- Stage 2 post-mortem captured: `.write` cascade error in the original Phase 1 design; corrected to `.validate`; verification sweep caught it; lesson preserved

## §9 — What this audit does NOT settle

- The Slice A design (Firebase Auth wiring approach, error handling, auth state migration)
- The Slice B design (membership rule shape, F3 resolution)
- The Slice C design (admin role enforcement)
- The Memory Hardening Phase 2 design
- The schedule for any of the above
- Whether `shared_setlists/.write` should be `auth != null` or tighter
- Whether to migrate `rehearsal.js:1937` now or wait for Phase 2

These are all design phase concerns, paused per Drew's directive.

---

## §10 — Recommended next operator decisions

Drew chooses among:

1. **Authorize Authority Resolution Phase 1 Design** to begin. The design phase produces specs for Slice A / B / C without committing to build order. Lowest commitment; preserves recognition discipline.
2. **Authorize Slice A immediately** (skip the design phase). This combines Firebase Auth wiring code work + the rule change in one sprint. Higher commitment; faster path to F14 closure but skips the structured recognition cadence used for all prior work.
3. **Continue pause.** Stage 1 is sufficient stabilization for now; Authority Resolution waits.

Recommendation: option 1. The design phase is small (1-2 sessions) and the pattern has worked well across the spec series. Slice A then becomes an authorized implementation against a clear spec.

---

## Closing posture

The post-Stage-1 reality is materially safer than the pre-Stage-1 reality. The Phase 1 trust-layer is real; the central exposure (F14) is downgraded; the path to full Authority Resolution is clear and bounded. The Stage 2 post-mortem produced a durable lesson (`.validate` for immutability, not `.write`) preserved in this audit + the Phase 1 deploy runbook.

Authority Resolution Phase 1 Design is ready to begin when Drew un-pauses. Until then, the architecture is in a stable post-Stage-1 state with no in-flight workstreams.
