# Authority Resolution — Phase 1 Design v1

> **Design-only. NOT implementation. NOT code. NOT a Firebase Auth wiring spec. NOT rule deployment. NOT MVLS. NO new primitives.**
>
> Author voice: GrooveLinx Principal Architect. Consolidation-not-invention. Pick canonical winners from existing surfaces; map migration cost; sequence the work.
>
> **Purpose:** select canonical authority surfaces from existing codebase, define migration impact for consolidating each fragmented surface to its canonical winner, sequence Slice A/B/C/D from the v2 readiness audit, and name the minimum slice that unblocks Memory Hardening Phase 2.
>
> **Inputs:**
> - `02_GrooveLinx/specs/authority_fragmentation_recognition_v1.md` (12 surfaces inventoried, 12 findings)
> - `02_GrooveLinx/specs/authority_fragmentation_readiness_audit_v2.md` (post-Stage-1 reality + 4 slices identified)
> - Memory Hardening Phase 1 final state (COMPLETE; immutability via .validate enforced at data layer)
> - Security Stabilization Stage 1 findings (Firebase Auth not wired; /users/ locked; Phase 1 fields immutable; bands/$bandId still open)

---

## §0 — Frame

The fragmentation recognition + readiness work named 12 authority surfaces and 17 findings. Stage 1 closed F13 and F15-partial; F14 remains the central exposure. This design selects canonical winners for the four authority-related concerns identified across the spec series:

1. **Identity** — "who is the current user"
2. **Membership** — "who is a member of this band"
3. **Authorship** — "who created / wrote / authored this record"
4. **Enforcement** — "what server-side gates access decisions"

For each concern: pick a canonical surface from existing options, demote competing surfaces, name the migration cost.

This is the smallest design phase that can be done without writing code, without deploying rules, and without committing to a target authority model beyond consolidation of what already exists.

### Recognition discipline maintained

- No new primitives proposed
- No new authority subsystem proposed
- All canonical picks are EXISTING surfaces in the codebase
- All consolidation work is data-model cleanup OR code-path consolidation (not invention)
- Memory Hardening Phase 1 final state (Annotations + `auth_version: 'phase1'` marker) is preserved and built upon

---

## §1 — Canonical Identity Model

### The question

For "who is the current user," which existing surface is canonical?

### Surfaces examined

| Surface | Type | Current use | Canonicity claim |
|---|---|---|---|
| `currentUserEmail` (global) | Google OAuth-derived | Used in ~25 files for identity claims | **Strongest** — OAuth-derived; unambiguous; immutable per session |
| `currentUserName` (global) | Google OAuth profile | Display only | Display-only; not identity |
| `currentUserPicture` (global) | Google OAuth profile | Display only | Display-only; not identity |
| `GLUserIdentity.getContext()` | Consolidated resolver | Computed view | Computed; not source of truth |
| `localStorage:deadcetera_google_email` | Stickiness layer | OAuth re-hydration on reload | Cache of `currentUserEmail`; not source |

### Canonical pick

**`currentUserEmail` is the canonical identity.** It is the OAuth-derived value; everything else is either display or cache.

### What this implies for consolidation

- `GLUserIdentity.getContext()` becomes the **consolidated read surface** — any caller that wants identity should call it, NOT re-implement email lookup.
- `currentUserName` and `currentUserPicture` stay as display-only globals; not identity.
- `localStorage:deadcetera_google_email` stays as the OAuth cache; not authoritative.

### Demotions

- F9 (getCurrentMemberKey vs GLUserIdentity duplication) — `getCurrentMemberKey()` is identity-related but actually a MEMBERSHIP-MAPPING concern (see §2), not identity. The duplication resolves when callers route through `GLUserIdentity.getContext()` for identity AND membership.

### Migration cost

**Low.** `currentUserEmail` is already widely-used as canonical. The cleanup is:
- ~5 inline `currentUserEmail` checks in non-identity contexts (e.g., feature gates) → route through `GLUserIdentity.getContext().email`
- Display-name-derivation in `feed-action-state.js:47`, `gl-band-metrics.js:38`, `gl-annotations.js:_author()` → all already canonical (email-prefix fallback)

No data migration required. No primitive change.

---

## §2 — Canonical Membership Model

### The question

For "who is a member of this band," which existing surface is canonical?

### Surfaces examined

| Surface | Location | Current use | Canonicity claim |
|---|---|---|---|
| `bands/{slug}/meta/members/{memberKey}` | Firebase RTDB | Cloud Function watches this; bandMembers hydrated from this | **Strongest** — already canonical for Cloud Function; hydrates the in-memory cache |
| `bands/{slug}/members/{memberKey}` | Firebase RTDB (parallel path) | Only homeAddress writes go here too | Demoted — parallel writes are debt |
| `members_index/{sanitized_email}` → bandSlug | Firebase RTDB (derived index) | O(1) auth-gate lookup; maintained by `mirrorMemberToIndex` Cloud Function | **Authoritative for email→band lookup** (different concern from the roster) |
| `bandMembers` JS global | In-memory cache | Read everywhere (18+ files) | Cached read surface; loaded from `meta/members/` |
| `BAND_MEMBER_EMAILS` hardcoded array | `app.js:8134-8140` | "known emails" allowlist for stats display | Demoted — duplicates `bandMembers` |
| `OWNER_EMAIL` constant | `app.js:8141` | Admin button gating | Demoted — should consolidate to `member.isOwner` or `member.role === 'admin'` |
| `localStorage:deadcetera_current_user` | localStorage | Sticky memberKey override (dev/test) | Demoted in production; OK for dev impersonation |
| 5+ hardcoded `emailToKey` maps | `app.js:2088`, `app.js:7955`, `band-feed.js:1634`, `calendar.js:48`, `notifications.js:114` | Email→memberKey mapping | Demoted — duplicate of `bandMembers` lookup |

### Canonical picks (three roles, three winners)

| Role | Canonical | Reason |
|---|---|---|
| **Source of truth for roster** | `bands/{slug}/meta/members/{memberKey}` | Cloud Function depends on it; `bandMembers` hydrated from it |
| **Cached in-memory read surface** | `bandMembers` global | Single in-memory copy; consistent across all 18+ consumers |
| **Email → bandSlug lookup** | `members_index/{sanitized_email}` | O(1); Cloud-Function-maintained; matches deployed pattern |

### What this implies for consolidation

- `bands/{slug}/members/{memberKey}` parallel path retires (consolidates to `meta/members/`). The three call sites in `app.js:11759-11976` that write to both need to drop the non-meta write.
- `BAND_MEMBER_EMAILS` array retires (consumers read `bandMembers` instead).
- `OWNER_EMAIL` constant retires (consumers check `bandMembers[key].isOwner` or `bandMembers[key].role === 'admin'`).
- The 5 hardcoded `emailToKey` maps retire (all consumers use `GLUserIdentity.getContext().memberKey` OR a small `getMemberKeyByEmail(email)` helper that scans `bandMembers`).

### Demotions

- F2 (members/ vs meta/members/ split) — resolved by consolidating to meta/members
- F4 (OWNER_EMAIL vs isOwner flag) — resolved by retiring OWNER_EMAIL
- F5 (BAND_MEMBER_EMAILS vs bandMembers) — resolved by retiring the hardcoded array
- F6 (emailToKey maps duplicated in 5+ files) — resolved by single canonical lookup

### Migration cost

**Medium-low.** All resolved by reading `bandMembers` instead of hardcoded data. Code cleanup; no schema change; no data migration (`meta/members` already populated; `members/` parallel writes can be left alone or cleaned up).

Specific code touch list:
- ~3 sites in `app.js` for `members/{key}/homeAddress` parallel writes → drop non-meta write
- 2 sites in `app.js` for `BAND_MEMBER_EMAILS` consumers
- 3 sites in `app.js` for `OWNER_EMAIL` consumers
- 5 sites across `app.js`, `band-feed.js`, `calendar.js`, `notifications.js` for hardcoded `emailToKey` maps

Total: ~15 small edits across ~5 files. Each is replace-an-inline-lookup-with-a-canonical-helper-call.

---

## §3 — Canonical Authorship Model

### The question

For "who created/wrote/authored this record," which existing field name + value shape is canonical?

### Field names in current use

| Field name | Found in | Value format | Sample line |
|---|---|---|---|
| `author` | gl-annotations.js, gl-notes.js, gl-takes.js | memberKey via `_author()` helper | `gl-annotations.js:183` |
| `addedBy` | app.js (≥10 sites) | full `currentUserEmail` | `app.js:1077`, `app.js:2254`, etc. |
| `createdBy` | gl-band-admin.js, gl-notes.js, app.js (multiple), firebase-service.js | mixed: sometimes email-split prefix, sometimes full email, sometimes memberKey | `gl-band-admin.js:73` |
| `owner` | gl-calendar-sync.js, app.js (some equipment) | full `currentUserEmail` | `gl-calendar-sync.js:1819` |

### Canonical picks

**Field name: `author`.** Already adopted by the newest primitives (Annotation, Notes, Takes). The pattern matches the spec series direction.

**Value shape: memberKey string (via `_author()` helper).** Cross-primitive queries become trivial if values are uniform. `_author()` already exists and works (returns `getCurrentMemberKey()` with email-prefix fallback).

### What this implies for consolidation

**For new code (going forward):** Every new write that records authorship uses:
- Field name: `author`
- Value: `_author()` (memberKey string)

**For existing data (legacy):** Stays as-is. The `addedBy` / `createdBy` / `owner` records that exist today have mixed shapes (email / memberKey / prefix). Retroactive migration is complex (requires bandMembers lookup at migration time for every email-shaped value).

**For read-side aggregation queries:** During the legacy-overlap window, queries that need "all records by Brian" require a small shape-tolerant adapter that handles three value formats per known field.

### Demotions

- F1 (4 author/addedBy/createdBy/owner field-name conventions) — resolved for new writes
- F10 (authorship value sometimes records email vs memberKey) — resolved for new writes

### Migration cost

**Low for new code (per-primitive 1-3 line change to use `author` + `_author()`).**
**Medium for retroactive migration (NOT recommended — leave legacy data; add shape-tolerant read adapters when cross-primitive queries are needed).**

### Decision: do NOT retroactively migrate

Per the discipline established with Memory Hardening Phase 1 (`auth_version: 'phase1'` marker — honestly recording what was vs imposing a retroactive change), legacy authorship values stay as-is. New writes consolidate. Read-side adapters handle the transition. Eventually (years out) legacy records may be archived or migrated as a separate concern.

---

## §4 — Canonical Authority Enforcement Model

### The question

For "what server-side gates access decisions," which existing surface is canonical?

### Surfaces examined

| Surface | Layer | Currently enforced? | Canonicity claim |
|---|---|---|---|
| Firebase RTDB rules (Console-deployed) | Server-side | Partial (post-Stage-1: /users/ locked, Phase 1 immutability via .validate, /care_packages_public/ write locked; bands/$bandId/* wide open) | **Canonical** for access enforcement — only server-side mechanism |
| Cloud Functions (admin SDK) | Server-side | Used for `mirrorMemberToIndex` derived index; bypass rules | Canonical for derived state; not access enforcement |
| `OWNER_EMAIL` constant + `injectAdminButton()` UI check | Client-side | Cosmetic gate only; bypassable | Demoted — UI-only; not enforcement |
| `_glCheckBandMembership()` boot gate | Client-side | Routes user to band; bypassable | Demoted — UI flow; not enforcement |
| `gl-leader.js` `_sync.role` (leader/follower) | Client-side | Operational state; not access | Out of scope (operational role, not authority) |
| Memory Hardening Phase 1 `promotion_authority` snapshot | Data layer (record-level metadata) | Recorded but `auth_version: 'phase1'` marks NOT enforced | Reactivates at Slice D as the Phase 2 promotion-authority enforcement target |

### Canonical pick

**Firebase RTDB rules.** Only the server-side mechanism enforces. Client-side gates are UI flow only.

### The central design question (F3 reactivated)

The membership rule needs to identify "current authenticated user" against the deployed member roster. Three viable shapes for the rule predicate:

**Option A — auth.uid keying (the v1 documented design):**
```
root.child('bands/' + $bandId + '/meta/members').orderByChild('uid').equalTo(auth.uid).limitToFirst(1).numChildren() > 0
```
- Requires storing `auth.uid` on every member record (data migration to add the field per existing member).
- Native Firebase pattern; survives email changes if a member changes their Google address.

**Option B — auth.token.email keying (matches deployed storage):**
```
root.child('bands/' + $bandId + '/meta/members').orderByChild('email').equalTo(auth.token.email).limitToFirst(1).numChildren() > 0
```
- Requires `.indexOn: "email"` on `meta/members` (additive rules change).
- No data migration; existing `email` field on member records already populated.
- Tied to email-identity (member email changes need member record update).

**Option C — members_index reverse lookup (matches current Cloud Function pattern):**
```
root.child('members_index/' + auth.token.email.replace('.', '_').replace('@', '_').replace('#', '_')...).val() === $bandId
```
- O(1) lookup. Matches `_glCheckBandMembership()` client-side pattern exactly.
- Sanitization-in-rule is awkward (`.replace()` chaining for `.#$[]/` is ugly).
- The `members_index` already exists and is Cloud-Function-maintained.

### Recommended canonical pick: Option B

**Rationale:**
- No data migration required (email field already on every member record).
- Rule is concise and readable.
- Performance: with 5-10 members per band, `orderByChild + equalTo` is sub-millisecond.
- Sanitization complexity is avoided.
- The `.indexOn: "email"` addition is a small rules change.

**Trade-offs:**
- Member email changes require updating the member record's email field (which is already standard practice; the Cloud Function then mirrors the new email to members_index).
- Auth.token.email requires Firebase Auth credential to include email scope (Google OAuth does; trivially).

### Demotions

- F3 — RESOLVED via Option B selection.
- F14 — addressed by Slice A + B (tightening `bands/$bandId/.write` from `true` → `auth != null` → membership-check).
- F16 (admin role check not deployed) — addressed by Slice C (add `member.role === 'admin'` check via the same Option B pattern on admin-gated paths).
- F17 (per-uid write isolation not deployed) — addressed by Slice B (member-keyed write isolation on per-member paths).

### Migration cost

**Low at the rule layer** (a handful of rule blocks to add). **Medium at the code layer** (Firebase Auth wiring — Slice A code work, prerequisite).

---

## §5 — Migration Impact Analysis (consolidated)

For each canonical pick from §1-§4, the migration cost:

| Concern | Canonical | Code touch sites | Data touch sites | Total cost |
|---|---|---|---|---|
| Identity | `currentUserEmail` | ~5 (route through `GLUserIdentity`) | 0 | LOW |
| Membership: roster | `bands/{slug}/meta/members/{memberKey}` | ~3 (drop parallel `members/{key}/homeAddress` writes) | 0 (data already in meta/) | LOW |
| Membership: in-memory cache | `bandMembers` global | ~5 hardcoded `emailToKey` maps + 2 `BAND_MEMBER_EMAILS` sites | 0 | LOW |
| Membership: email→bandSlug | `members_index/{sanitized_email}` | 0 (already canonical) | 0 (already maintained) | NONE |
| Authorship: field name | `author` | 1 per primitive type (new writes only) | 0 (no retroactive migration) | LOW |
| Authorship: value shape | memberKey via `_author()` | (same as above) | 0 | LOW |
| Enforcement: rules | Option B (auth.token.email) | Slice A code (Firebase Auth wiring) | Add `.indexOn: "email"` rule | MEDIUM (gated on Slice A code) |
| Admin gate retirement | `member.isOwner` or `member.role === 'admin'` | ~3 `OWNER_EMAIL` consumer sites | 0 (isOwner already on Drew's record) | LOW |

### Cumulative cost shape

- **No data migration is required** for ANY canonical pick. All consolidations are code-cleanup or rule-additive.
- **No primitive change** is required. Every canonical pick is an existing surface.
- **The most expensive component is Slice A** (Firebase Auth wiring in `getCurrentUserEmail`), which is the prerequisite for §4's enforcement model.
- **Everything else can ship independently of Slice A** — data-model cleanups (F1/F2/F4/F5/F6/F10) don't require Auth.

---

## §6 — Slice A/B/C/D Sequencing

Refined from v2 audit §3.1, with the §4 canonical pick (Option B) baked in.

### Slice A — Firebase Auth wiring + minimum auth gate

**Scope:**
- **CODE (in `app.js` `getCurrentUserEmail()`):** after Google OAuth succeeds and `accessToken` is populated, call `firebase.auth().signInWithCredential(firebase.auth.GoogleAuthProvider.credential(null, accessToken))`. Add error handling for the credential-sign-in step. Add cleanup in sign-out path.
- **RULES (Console):** change `bands/$bandId/.write: true` → `.write: "auth != null"`. Change `shared_setlists/.write: "true"` → `.write: "auth != null"`.
- **VERIFY:** repeat the 16-scenario test sweep; tests 2 and 14 (previously ALLOW unauthenticated) now expect DENY.

**Estimated scope:** ~15 lines of code + 2 rule changes + verification.

**What it buys:** server-side enforcement that only signed-in Google users can write to band data. F14 closed to "authenticated-user-required" posture.

**Risk:** Firebase Auth bootstrapping in a vanilla-JS SPA without Auth previously wired needs care around timing (Auth state must exist BEFORE bandMembers loads). Reversible.

### Slice B — Membership-checked write (Option B rule shape)

**Scope:**
- **CODE:** none (Slice A's Firebase Auth provides the auth context Slice B's rule needs).
- **RULES (Console):**
  - Tighten `bands/$bandId/.read` and `.write` to:
    ```
    auth != null && root.child('bands/' + $bandId + '/meta/members').orderByChild('email').equalTo(auth.token.email).limitToFirst(1).numChildren() > 0
    ```
  - Add `.indexOn: "email"` on `bands/$bandId/meta/members`.
  - Tighten `shared_setlists/.write` similarly OR leave at `auth != null` (legacy compatibility decision).
- **VERIFY:** scenario sweep with auth + non-member context.

**Estimated scope:** ~3 rule blocks + verification.

**What it buys:** server-side enforcement that ONLY band members can write to their band's data. F14 fully closed.

**Risk:** F3 resolution baked in; rule performance acceptable at 5-10 members per band. Reversible.

### Slice C — Admin role enforcement + OWNER_EMAIL retirement

**Scope:**
- **CODE:** retire `OWNER_EMAIL` constant; consumers (e.g. `injectAdminButton`) check `bandMembers[key].isOwner === true` OR `bandMembers[key].role === 'admin'`. Resolves F4.
- **RULES (Console):** on admin-gated paths (e.g. `bands/$bandId/invites`, `bands/$bandId/meta/members` writes-for-other-keys), add:
  ```
  auth != null && root.child('bands/' + $bandId + '/meta/members').orderByChild('email').equalTo(auth.token.email).limitToFirst(1).val().role === 'admin'
  ```
  (Or a derived `isOwner` check.)
- **VERIFY:** admin paths blocked for non-admin members.

**Estimated scope:** ~3 code sites + ~2-3 rule blocks + verification.

**What it buys:** server-side enforcement of admin operations. Resolves F4, F16.

**Risk:** decision needed — `isOwner` boolean OR `role === 'admin'` string? Both exist on member records. Recommendation: `role` (string is more extensible; `isOwner` becomes legacy).

### Slice D — Memory Hardening Phase 2 (promotion authority + Resolution + Re-open)

**Scope:**
- **CODE:** new typed helpers in `gl-annotations.js`: `resolveAnnotation(id, {evidence, authority?})`, `reopenAnnotation(id, {reason, authority?})`. Defensive warn in `updateAnnotation` for `status: 'fixed'` writes (mirroring Phase 1 warn pattern).
- **CODE:** migrate `rehearsal.js:1937` from `updateAnnotation({status: 'fixed'})` to `resolveAnnotation(...)`.
- **CODE:** `promoteToMemory()` bumps `auth_version: 'phase1' → 'phase2'`.
- **RULES (Console):**
  - Add `.validate` rules to require Resolution-confirmation fields when `status === 'fixed'`.
  - Add `.write` enforcement that promotion + resolution + re-open writes require member-of-band AND optionally specific permissions.
  - Add field-level immutability for resolution provenance fields (parallel to Phase 1's promotion immutability).
- **VERIFY:** Phase 2 trust-layer guarantees G3/G5/G6 enforced.

**Estimated scope:** ~150 LOC + ~5-8 rule blocks + verification.

**What it buys:** trust-layer guarantees G3, G5, G6 operational at API + data layers. Phase 2 ships.

**Risk:** `rehearsal.js:1937` migration is bounded; the auto-resolve helper needs to supply confirmation fields OR be grandfathered as service-actor.

### Sequencing constraints

```
Slice A (code + rules)
  └──→ Slice B (rules only, depends on auth context)
         ├──→ Slice C (code + rules, depends on member context)
         │
         └──→ Slice D (code + rules, depends on member context + auth context)
                Slice C is RECOMMENDED but NOT STRICTLY REQUIRED for Slice D
                (Slice D can ship "any band member can promote" without admin role)
```

Slice C is optional for Slice D's minimum variant.

---

## §7 — Minimum Slice Required for Memory Hardening Phase 2

### Minimum: Slice A + Slice B + Slice D

**Slice A** establishes `auth != null` on bands/$bandId. Required because Phase 2's promotion / resolution / re-open rules all need an authenticated context.

**Slice B** establishes member-of-band as the write predicate. Required because Phase 2's promotion authority must check "is the writer a member of this band" — without it, any signed-in Google user could promote on any band.

**Slice D** is Phase 2 itself.

**Slice C** is NOT required for the minimum. Phase 2's minimum variant — "any band member can promote / resolve / re-open" — satisfies the trust-layer guarantees G3/G5/G6 at the "member-vs-non-member" level without enforcing specific permissions (admin / promote_song_knowledge / etc.).

If a richer permission model is desired (e.g., only specific members can promote), Slice C is required. That's a design choice in Phase 2 itself, not a structural requirement.

### Minimum path summary

```
Slice A  →  Slice B  →  Slice D (with "any-member" permissive variant)
                          OR
Slice A  →  Slice B  →  Slice C  →  Slice D (with role-checked variant)
```

Drew picks. The first path is faster and ships Phase 2 sooner. The second is more secure and matches the documented v1 intent.

---

## §8 — Open Design Questions (for Drew to resolve)

1. **Slice A risk tolerance:** Firebase Auth wiring touches the central auth flow. Acceptable to ship as a single small sprint (code + rules in one go)?
2. **Slice B `shared_setlists/.write` posture:** tighten to `auth != null` (any signed-in user can write any shared setlist) or tighten further (only the owning band's members can write)?
3. **Slice C `OWNER_EMAIL` retirement: `isOwner` or `role === 'admin'`?** Both exist; either works. `role` is more extensible long-term.
4. **Slice D Phase 2 variant: permissive ("any band member can promote") or role-checked (specific permissions)?**
5. **Authorship migration: backfill retroactively or leave legacy as-is?** Recommendation in §3 is leave legacy; Drew confirms.
6. **Cross-band lookup posture: does anything else need to migrate to use `members_index` for derived membership?** Currently only the boot gate does.

These are all design choices. None requires invention; each is a pick between existing options.

---

## §9 — What this design settles

- Canonical identity = `currentUserEmail`
- Canonical membership: source-of-truth = `bands/{slug}/meta/members/`; cache = `bandMembers`; lookup = `members_index/`
- Canonical authorship: field = `author`; value = memberKey via `_author()`
- Canonical enforcement: Firebase RTDB rules with Option B (auth.token.email + orderByChild) as the membership predicate
- Slice A/B/C/D sequence and dependencies named
- Minimum Phase 2 slice = Slice A + B + D (permissive variant) OR Slice A + B + C + D (role-checked variant)
- All consolidations are existing-surface picks; no new primitives proposed
- No data migration required for any canonical pick

## §10 — What this design does NOT settle

- The actual Slice A code implementation (`signInWithCredential` mechanics, error handling, auth state lifecycle)
- The actual Firebase Console rules JSON for Slice A or B (Console-ready snippet not produced yet)
- Resolution of the open design questions in §8
- Phase 2 design (which permission shape, which fields, which rule patterns)
- The schedule for any slice
- Whether the `rehearsal.js:1937` caller is migrated to `resolveAnnotation()` OR grandfathered
- The `auth_version: 'phase2'` marker shape

These are design-phase work for the next iteration (Slice A Implementation Design, Slice B Implementation Design, etc.).

---

## §11 — Recommended next phase

Per the recognition discipline used throughout this spec series, the next phase is **Slice A Implementation Design**:

1. Specify the Firebase Auth wiring mechanics (where in `getCurrentUserEmail`, what error handling, what auth state lifecycle).
2. Produce the Console-ready rules patch for Slice A (`bands/$bandId/.write: true → "auth != null"`, `shared_setlists/.write: "true" → "auth != null"`).
3. Specify the 16-scenario verification sweep (re-run with auth context expectations).
4. Specify the rollback path (revert code + revert rules).

This is analogous to `memory_hardening_phase_1_implementation_design_v1.md` — a single-slice implementation spec ready for Drew to authorize.

Until that spec is written, Slice A remains design-ready but not build-ready.

---

## Closing posture

The fragmentation findings are now mapped onto canonical winners. Every winner is an EXISTING surface. No new primitives. No new authority subsystem. Each fragment that retires has a low-cost consolidation path. The Slice A/B/C/D sequence is bounded and each step is reversible.

The single most important design decision in this document is the F3 resolution — Option B (auth.token.email + orderByChild). This unblocks Slice B and downstream. If Drew prefers Option A or C, the rest of the design holds with minor adjustments.

The architecture is consolidating, not expanding. The Memory Hardening Phase 1 trust contract continues to hold. MVLS remains 🚫 NOT AUTHORIZED until preconditions clear.

Awaiting Drew's signal: authorize Slice A Implementation Design to begin, OR address open design questions (§8) first, OR continue pause.
