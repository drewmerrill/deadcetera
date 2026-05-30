# Authority Fragmentation — Recognition Phase v1

> **Recognition only. Codebase audit. No design. No solutions. No new authority model. No permissions definition. No architecture. No code.**
>
> Author voice: GrooveLinx Principal Architect. Honest cartography of every authority surface currently present.
>
> **Purpose:** identify every authority surface in GrooveLinx, locate each one, classify it, name its consumers, and surface where surfaces fragment or contradict. Determine whether the "Authority fragmentation P0" finding from the Shell Integrity Phase is real, where it lives, and how severe it is.
>
> The goal is to produce a Map — not a Plan.
>
> **Inputs (grounded in actual codebase):**
> - `app.js` (canonical resolver `getCurrentMemberKey`, owner email, gate flow, hardcoded mappings)
> - `js/core/firebase-service.js` (auth bootstrap, currentUserEmail, default member seed)
> - `js/core/gl-annotations.js`, `gl-notes.js`, `gl-takes.js`, `gl-band-admin.js`, `gl-leader.js`, `gl-roles-coverage.js`, `gl-continuity-authority.js`, `gl-user-identity.js`, `gl-beta-feedback.js`, `gl-benchmark.js`, `gl-calendar-sync.js`, `gl-band-metrics.js`, `feed-action-state.js`
> - `js/features/` (broad use of `bandMembers` global)
> - `functions/index.js` (Cloud Function `mirrorMemberToIndex`)
> - `02_GrooveLinx/docs/firebase-rules-snippet.md` + `02_GrooveLinx/specs/groovelinx-firebase-rules-notes.md` (Console-side rule documentation)

---

## §0 — Frame

The MVLS audit and the Memory Hardening Phase 1 docs both identified "Authority fragmentation" as the gating P0 architectural finding from the Shell Integrity Phase. Memory Hardening Phase 2 + trust-layer guarantees G3 / G4 / G5 / G6 depend on Authority resolution.

This document does NOT resolve fragmentation. It identifies it.

### What "authority surface" means in this audit

A surface where the system makes (or records, or signals, or enforces) a decision about WHO can do what, WHO did what, or WHO holds what claim. Includes:

- Authentication identity (who is the current user)
- Membership identity (which band, which member key)
- Access enforcement (server-side rules)
- Access gating (client-side UI rules)
- Role / ownership claims (admin, owner, leader)
- Authorship attribution (createdBy, addedBy, author, owner)
- Authority delegation (calendar locks, sync leader, etc.)
- Authority-shaped naming (modules with "authority" or "role" in the name that may or may not be about access)

### Method

1. Grep across `app.js`, `js/core/*.js`, `js/features/*.js`, `functions/index.js` for authority-related identifiers (auth, role, admin, owner, member, gate, permission, isOwner, isAdmin, hasRole, canEdit, etc.).
2. Read key modules end-to-end where authority lives.
3. Inventory each surface with: location, purpose, decision type, source of truth, downstream consumers.
4. Identify fragmentation: duplicated state, contradictory storage paths, drifting conventions, hardcoded data that bypasses the canonical store.
5. Rank fragmentation by risk severity (impact × frequency × reversibility).

Honest scope: this audit captures **what was reachable via the grep + read pass**. There may be additional surfaces in features I did not read end-to-end. The Map is a v1, not a final cartography.

---

## §1 — Authority Surface Inventory

Twelve identified authority surfaces, organized by category.

### Category A — Authentication identity (the "who am I" layer)

#### Surface A1: `currentUserEmail` global
- **Location:** declared in `js/core/firebase-service.js:71` from `localStorage.getItem('deadcetera_google_email')`; populated via `getCurrentUserEmail()` in `app.js` post-OAuth.
- **Purpose:** canonical "logged-in user's email" for the entire app.
- **Decision type:** identity (who am I in the broadest sense).
- **Source of truth:** Google OAuth token → `currentUserEmail` → `localStorage:deadcetera_google_email` (cache).
- **Downstream consumers:** ~25 files reference it. Includes `getCurrentMemberKey()`, `_author()` helpers in `gl-annotations.js`, `gl-notes.js`, `gl-band-metrics.js`, `feed-action-state.js`, `gl-beta-feedback.js`, `gl-band-admin.js`, `gl-calendar-sync.js`. Used to set `addedBy`, `createdBy`, `owner` fields throughout app.js.

#### Surface A2: `currentUserName` + `currentUserPicture` globals
- **Location:** `firebase-service.js`, populated in `getCurrentUserEmail()` from Google profile.
- **Purpose:** display name + avatar for UI.
- **Decision type:** identity (display only).
- **Source of truth:** Google OAuth profile.
- **Consumers:** profile views, headers, member badges.

#### Surface A3: `GLUserIdentity.getContext()` module
- **Location:** `js/core/gl-user-identity.js`.
- **Purpose:** consolidated identity resolver — returns `{email, fullName, firstName, memberKey, bandSlug, bandName}`.
- **Decision type:** identity resolution (computed view).
- **Source of truth:** `currentUserEmail` + `bandMembers` + `currentUserName` + `currentBandSlug` + `localStorage:deadcetera_band_name`.
- **Consumers:** any caller of `GLUserIdentity.getContext()`. **Notably, the canonical resolver `getCurrentMemberKey()` in `app.js:2203` does NOT use this; it duplicates the same logic inline.**

### Category B — Membership identity (the "who am I in this band" layer)

#### Surface B1: `getCurrentMemberKey()` canonical resolver
- **Location:** `app.js:2203`.
- **Purpose:** resolve current Firebase Auth email to band-internal member key (e.g. `"drew"`, `"chris"`).
- **Decision type:** identity (band-scoped).
- **Source of truth:** `localStorage:deadcetera_current_user` (sticky pick) → `bandMembers[stored]` validation → email-match scan of `bandMembers`.
- **Consumers:** at least 10 files reference it via `typeof getCurrentMemberKey === 'function'` guard. Used in `gl-annotations.js`, `gl-benchmark.js`, `gl-continuity-authority.js`, `gl-leader.js`, `gl-notes.js`, `feed-action-state.js`, `app.js` (multiple sites), and as the fallback identity for any `_author()` helper.

#### Surface B2: `bandMembers` global (in-memory roster)
- **Location:** JS global, hydrated from Firebase RTDB.
- **Purpose:** the band's current member roster — used for display, role-coverage, identity resolution, harmony plans.
- **Decision type:** identity + role + display.
- **Source of truth:** `bands/{slug}/meta/members/` (per `app.js:15430`, `15492`, `15501`).
- **Consumers:** 18+ files reference `bandMembers[...]` directly. Includes `feed-action-state.js`, `gl-leader.js`, `gl-calendar-sync.js`, `gl-user-identity.js`, `gl-voice-coach.js`, `band-feed.js`, `playlists.js`, `gigs.js`, `setlists.js`, `song-detail.js`, `band-comms.js`, `bestshot.js`, `rehearsal.js`, `notifications.js`, `song-pitch.js`, `workbench.js`, `multitrack-rehearsal.js`, `app.js`.

#### Surface B3: `members_index/{sanitized_email}` derived index
- **Location:** Firebase RTDB top-level node.
- **Purpose:** O(1) email → bandSlug lookup for the boot-time auth gate.
- **Decision type:** access (membership check at boot).
- **Source of truth:** maintained by `mirrorMemberToIndex` Cloud Function in `functions/index.js`, derived from writes to `bands/{slug}/meta/members/{memberKey}/email`.
- **Consumers:** `_glCheckBandMembership()` in `app.js:5888-5905` (the auth gate).

#### Surface B4: `localStorage:deadcetera_current_user`
- **Location:** browser localStorage.
- **Purpose:** sticky member-key pick across reloads.
- **Decision type:** identity (which member key am I claiming).
- **Source of truth:** user selection (typically Drew picking "drew" in dev contexts).
- **Consumers:** `getCurrentMemberKey()` reads this first; if `bandMembers[stored]` exists, returns immediately without email-match.

#### Surface B5: `localStorage:deadcetera_current_band`
- **Location:** browser localStorage.
- **Purpose:** sticky band-slug across reloads.
- **Decision type:** band routing (which band am I currently scoped to).
- **Source of truth:** `_glCheckBandMembership` writes this when auth gate routes the user, overriding any stale prior value.
- **Consumers:** `window.currentBandSlug` global → `bandPath()` helper → every Firebase ref under `bands/`.

### Category C — Server-side access enforcement (rules layer)

#### Surface C1: Firebase RTDB rules — `$slug` membership gate
- **Location:** Firebase Console for project `deadcetera-35424`, NOT in repo. Documented in `02_GrooveLinx/specs/groovelinx-firebase-rules-notes.md` + `firebase-rules-snippet.md`.
- **Purpose:** server-side enforcement of "member of band X may read/write band X data."
- **Decision type:** access (read + write).
- **Source of truth:** rules JSON in Console. The rule check pattern is `root.child('bands/' + $slug + '/members/' + auth.uid).exists()`.
- **Consumers:** every Firebase write from the browser. **Notably the rule documentation uses `members/{auth.uid}` keying.**

#### Surface C2: Firebase RTDB rules — admin role check
- **Location:** Firebase Console (documented in same notes file).
- **Purpose:** server-side enforcement for paths that require admin (meta updates, invite creation, writing other members' records).
- **Decision type:** access (admin-level write).
- **Source of truth:** the role field on a member record: `root.child('bands/' + $slug + '/members/' + auth.uid + '/role').val() === 'admin'`.
- **Consumers:** paths gated by this rule (per the notes: invite creation, member writes for other UIDs, meta updates).

#### Surface C3: Firebase RTDB rules — per-member write isolation
- **Location:** Firebase Console (documented).
- **Purpose:** prevent member X from writing member Y's personal data.
- **Decision type:** access (per-uid write).
- **Source of truth:** rule `$uid === auth.uid` on paths like `/bands/{slug}/readiness/{uid}` and `/bands/{slug}/crib_notes/{songId}/{uid}`.
- **Consumers:** readiness writes, crib_notes writes.

#### Surface C4: Firebase RTDB rules — Phase 1 promotion immutability (newly added)
- **Location:** Firebase Console (deployed 2026-05-30 15:23 UTC per Phase 1 ship).
- **Purpose:** field-level immutability on `promoted`, `promoted_by`, `promoted_at`, `promoted_from`, `promotion_authority` after first write.
- **Decision type:** integrity (not access — write-once contract).
- **Source of truth:** the field's prior value (idempotency rule).
- **Consumers:** `GLAnnotations.promoteToMemory()` writes; subsequent updates rejected at data layer.

### Category D — Client-side access / display gating

#### Surface D1: `OWNER_EMAIL` constant + `injectAdminButton()` gate
- **Location:** `app.js:8141` (`const OWNER_EMAIL = 'drewmerrill1029@gmail.com'`), used in `app.js:7873` (`if (currentUserEmail !== OWNER_EMAIL) return;`) inside `injectAdminButton()`.
- **Purpose:** show the admin button + check feedback badge only for the owner.
- **Decision type:** UI display gate.
- **Source of truth:** hardcoded email constant in `app.js`.
- **Consumers:** `injectAdminButton()` and `checkUnreadFeedback()`.

#### Surface D2: `BAND_MEMBER_EMAILS` constant
- **Location:** `app.js:8134-8140`, a hardcoded 5-element array.
- **Purpose:** "known members" allowlist for activity-log per-member breakdown rendering.
- **Decision type:** display-classification (known vs unknown user in stats).
- **Source of truth:** hardcoded list.
- **Consumers:** `app.js:7965` (`...BAND_MEMBER_EMAILS,`) + `app.js:7972` (`BAND_MEMBER_EMAILS.includes(email)`).

#### Surface D3: `isOwner: true` flag on member records
- **Location:** `app.js:12413`, `app.js:15452`, `app.js:15495` (default member seed for "drew").
- **Purpose:** mark Drew as the owner in the bandMembers data.
- **Decision type:** identity (owner claim on a member record).
- **Source of truth:** seeded by `app.js:15495` default; persisted as `isOwner` on member record at `bands/{slug}/meta/members/drew`.
- **Consumers:** rendered in admin UI (line 15452) but not used as the gate (the gate uses OWNER_EMAIL constant directly, not `isOwner` lookup).

### Category E — Per-feature operational authority

#### Surface E1: `gl-leader.js` sync leader/follower role
- **Location:** `js/core/gl-leader.js`, `_sync.role` internal state.
- **Purpose:** multi-device chart sync — one device is the leader broadcasting position; others follow.
- **Decision type:** operational role (per-session, ephemeral).
- **Source of truth:** session-internal state at `bands/{slug}/live_sync/{sessionId}` (presumably; not exhaustively verified in this audit).
- **Consumers:** multitrack rehearsal + live-gig surfaces.
- **Naming overload:** uses `_sync.role` which is unrelated to musical role or member role.

#### Surface E2: `gl-continuity-authority.js` analyst decision store
- **Location:** `js/core/gl-continuity-authority.js`, storage at `bands/{slug}/continuity_decisions/{decisionId}`.
- **Purpose:** record human analyst calibration decisions for the rehearsal-segment continuity engine.
- **Decision type:** calibration (not access; not identity).
- **Source of truth:** explicit human calibration actions.
- **Consumers:** `gl-continuity.apply()` consumes `opts.skipPairKeys` + `opts.ignoredKinds` derived here.
- **Naming overload:** the word "authority" in the module name does NOT refer to access control — it refers to the human analyst as the authoritative arbiter of continuity decisions.

#### Surface E3: `gl-roles-coverage.js` band roles
- **Location:** `js/core/gl-roles-coverage.js`.
- **Purpose:** musical role coverage analysis for gigs (lead vocal, rhythm guitar, etc.) + backup-player matching.
- **Decision type:** operational classification (musical, not access).
- **Source of truth:** `BAND_ROLES` canonical role catalog + `bands/{slug}/backup_players` + `member.role` field (musical role like "Rhythm Guitar").
- **Consumers:** `js/features/gigs.js` via `GLStore.evaluateGigCoverage`.
- **Naming overload:** "roles" here are MUSICAL roles, not permission roles.

#### Surface E4: Memory Hardening Phase 1 `promotion_authority` snapshot
- **Location:** `js/core/gl-annotations.js` — written by `promoteToMemory()`.
- **Purpose:** record promotion provenance — who promoted what, when, with what claimed authority.
- **Decision type:** integrity (not enforcement — Phase 1 records only; Phase 2 will enforce).
- **Source of truth:** caller-supplied `options.authority` OR fallback to `_author()` helper.
- **Consumers:** `auditProvenance()` reads this; future Phase 2 will enforce via rules.
- **Naming overload:** explicit `auth_version: 'phase1'` marker honestly records that authority was NOT enforced — distinct from the access-control meaning of "authority."

### Category F — Calendar / mutex authority

#### Surface F1: Calendar sync lock owner
- **Location:** `js/core/gl-calendar-sync.js:1819`.
- **Purpose:** mutex / TTL lock to prevent concurrent calendar sync jobs.
- **Decision type:** operational mutex (not access).
- **Source of truth:** `{owner: currentUserEmail, expires: now + LOCK_TTL_MS}` written to a Firebase lock node.
- **Consumers:** the calendar sync engine.

---

## §2 — Fragmentation Findings

Where authority surfaces overlap, contradict, drift, or duplicate.

### F1 — Three different naming conventions for "who did this"

**Severity: HIGH (operational; affects every primitive that records authorship).**

The codebase uses at least four different field names for authorship attribution, often with different value formats:

| Field name | Example callers | Value format |
|---|---|---|
| `author` | `gl-annotations.js:183`, `gl-notes.js:148/175/239`, `gl-takes.js:437` | memberKey (via `_author()`) |
| `addedBy` | `app.js:984/1077/1313/1327/2254/2289/2402/3345/3427/13052` | `currentUserEmail` (full email) |
| `createdBy` | `gl-band-admin.js:73`, `gl-notes.js:129`, `app.js:11480/12420/13247`, `firebase-service.js:1082` | mixed: sometimes email-split prefix, sometimes full email, sometimes memberKey |
| `owner` | `gl-calendar-sync.js:1819`, `app.js:13045` | `currentUserEmail` |

For the same logical question ("who did this?"), four answers exist with inconsistent shape. Any cross-primitive "show me everything Brian created" query needs N adapters.

### F2 — `bands/{slug}/members/` vs `bands/{slug}/meta/members/` storage split

**Severity: HIGH (data-model; affects every member-data write).**

Two Firebase paths hold member data:

| Path | What's stored | Witnessed at |
|---|---|---|
| `bands/{slug}/meta/members/{key}` | full member record (name, role, email, etc.) | `app.js:11849`, `11878`, `11973`, `12939`, `12986`, `15430`, `15492`, `15501`; `gigs.js:729-730`; watched by Cloud Function |
| `bands/{slug}/members/{key}/homeAddress` | parallel write of homeAddress only | `app.js:11759`, `11772`, `11976` |

`app.js:11759-11760` writes the SAME homeAddress value to BOTH paths in parallel. This implies a transitional state — either `members/` is being phased out, or `meta/members/` is, but the parallel write is the smell.

The Cloud Function `mirrorMemberToIndex` watches ONLY `bands/{slug}/meta/members/{memberKey}/email`. So `members/` writes do NOT trigger the index mirror.

### F3 — Documented rules use `auth.uid` keying; deployed code uses `memberKey` string keying

**Severity: HIGH (rules-vs-code contradiction; deployed reality unverified).**

The Firebase rules documentation (`groovelinx-firebase-rules-notes.md`) describes:
- `root.child('bands/' + $slug + '/members/' + auth.uid).exists()` — **`{auth.uid}` keyed**

The deployed application code uses:
- `bandMembers["drew"]` — string-keyed (memberKey)
- `bands/{slug}/meta/members/drew` — string-keyed
- `members_index/{sanitized_email}` → bandSlug (email-keyed, NOT auth.uid-keyed)

If the deployed Console rules actually use `{auth.uid}` keying, then the rules check against a path that the application code never writes to (the app writes to `bands/{slug}/meta/members/drew`, not `bands/{slug}/members/{auth.uid}`). This would mean **the documented membership rule cannot actually fire as documented**.

The likely deployed reality: the Console rules differ from the documented design — either (a) the `$other` catch-all is the actual gate (which uses string `$bandSlug` interpolation but doesn't check uid-keyed membership), OR (b) the rules use a more permissive membership check than documented. This audit cannot verify without Console read access.

**This is the single most architecturally suspicious finding** because it implies the server-side enforcement layer may not be doing what the documentation claims.

### F4 — `OWNER_EMAIL` hardcoded constant vs `isOwner` flag on member records

**Severity: MEDIUM (admin gating bypasses canonical store).**

Two independent claims about ownership exist:
1. `OWNER_EMAIL = 'drewmerrill1029@gmail.com'` constant in `app.js:8141`, used by `injectAdminButton()` for the admin-feature gate.
2. `isOwner: true` field on the "drew" member record at `bands/{slug}/meta/members/drew`, written by default seed at `app.js:15495`.

These represent the same fact but are written and consumed independently. If Drew's email ever changed (or if a second owner were added), the hardcoded `OWNER_EMAIL` would silently drift from the `isOwner` field — and admin gating would follow the hardcoded constant, not the data.

### F5 — `BAND_MEMBER_EMAILS` hardcoded 5-element array vs dynamic `bandMembers` global

**Severity: MEDIUM (allowlist drift risk).**

`app.js:8134-8140` declares a hardcoded array of 5 emails. `bandMembers` global (loaded from Firebase) holds the actual current member roster.

These can drift independently — and have. The existing `app.js:7965-7972` code already mitigates by unioning `BAND_MEMBER_EMAILS` with all emails seen in activity logs, but the hardcoded array is treated as the "known members" baseline for stats display.

A 6th band member (or a member email change) would not appear in the hardcoded list unless code is edited and deployed.

### F6 — Hardcoded email → memberKey maps duplicated in 5+ files

**Severity: MEDIUM (data-shape duplication; will drift).**

The same mapping `{drewmerrill1029@gmail.com: drew, cmjalbert@gmail.com: chris, ...}` is hardcoded in:
- `app.js:2088` (renderPersonalTabs)
- `app.js:7955` (admin panel rendering)
- `js/features/band-feed.js:1634`
- `js/features/calendar.js:48`
- `js/features/notifications.js:114`

Each instance is its own copy. Updating one does not update others. The canonical resolution path (`getCurrentMemberKey()` reads `bandMembers`) exists but is bypassed by these inline maps.

### F7 — Auth-gate documentation says hard-block mode A; code includes mode-B observability scaffolding

**Severity: LOW (capability-mode-mismatch; documented as deferred).**

The auth gate is documented as Mode A (hard block — `app.js:5843` comment: *"Future: switch to soft-onboard (mode B) when ready"*). The actual code includes Beta-ops Mode-B observability: localStorage counters for `gateAllowed`/`gateBlocked`/`gateError` (`_glBumpOnboardingCounter` at `app.js:5896-5910`), plus invite-code surface counters (`inviteCodeViewed`, `inviteCodeSubmitted`).

This is not a bug — it's instrumentation for the eventual Mode B transition. But the presence of Mode-B-shaped code in a Mode-A deployment is itself an authority surface that exists at low intensity.

### F8 — Module names use "authority" or "role" without consistent meaning

**Severity: LOW (cognitive load; not functional).**

Three modules carry authority/role language with different semantics:
- `gl-continuity-authority.js` → "authority" means *human analyst calibration arbiter*, not access control
- `gl-roles-coverage.js` → "roles" means *musical roles*, not permission roles
- `gl-leader.js` → `_sync.role` means *leader/follower sync state*, not member role

New contributor cognitive load: each of these names primes the wrong mental model. A reader expecting "authority" to mean access control finds calibration; a reader expecting "role" to mean permission finds either musical instrument assignment or sync state.

The Memory Hardening Phase 1 `promotion_authority` field is the SAME word with a fourth meaning (caller-supplied identity claim).

### F9 — `getCurrentMemberKey()` is canonical but `GLUserIdentity.getContext()` re-implements the same lookup

**Severity: LOW–MEDIUM (function duplication).**

`getCurrentMemberKey()` in `app.js:2203` is the canonical resolver: localStorage sticky → email-match scan of `bandMembers`. `GLUserIdentity.getContext()` in `gl-user-identity.js` re-implements the email-match scan of `bandMembers` for its `fullName` lookup, AND separately calls `getCurrentMemberKey()` for the `memberKey` field.

Both modules read `bandMembers` directly; both apply email-match logic. Neither calls the other for the shared "find member by email" step.

### F10 — Authorship attribution sometimes records the OAuth email instead of memberKey

**Severity: MEDIUM (downstream-query inconsistency).**

When `addedBy: currentUserEmail` is recorded (app.js multiple sites), the value is the full Google email. When `author: _author()` is recorded (gl-annotations.js, gl-notes.js), the value is the memberKey via `getCurrentMemberKey()` fallback to email-split.

A downstream "show me everything Brian made" query has to:
- Match `author === "brian"` (memberKey form)
- AND match `addedBy === "brian@hrestoration.com"` (email form)
- AND match `createdBy === "brian"` OR `createdBy === "brian@hrestoration.com"` (mixed)

This is the F1 problem manifesting at the value-shape level.

### F11 — Memory Hardening Phase 1 inherits the fragmentation

**Severity: MEDIUM (newly introduced; bounded by Phase 1 design).**

The Phase 1 `promoteToMemory()` uses `_author()` (memberKey via `getCurrentMemberKey()`) for `promoted_by`. This is consistent with the `author` field convention but inconsistent with `addedBy` / `createdBy` / `owner` conventions used elsewhere. A future Comparison engine that aggregates evidence across primitives will hit the F10 shape problem.

The `auth_version: 'phase1'` marker explicitly records that Authority enforcement is not yet active — but does NOT resolve the identity-shape fragmentation. Phase 2 must address both.

### F12 — `localStorage:deadcetera_current_user` can override the email-match

**Severity: LOW (intentional but underdocumented).**

`getCurrentMemberKey()` first checks `localStorage:deadcetera_current_user` and returns that if `bandMembers[stored]` validates. This means a member can be "logged in as Drew (OAuth)" but "acting as Chris" if the localStorage value differs from the OAuth email's member match.

This was likely a dev / impersonation convenience. In production it can produce surprising results: a member resigns their email but keeps the sticky localStorage memberKey and continues acting as that person. No surface flags this divergence.

---

## §3 — Candidate Single Sources of Truth

Recognition only. For each category of fragmentation, which existing surface is the *most authoritative* and could plausibly become the canonical source. **No commitment made.**

| Fragment | Candidate canonical | Reasoning |
|---|---|---|
| "Who is the current user" | `currentUserEmail` (already canonical for auth identity) | The OAuth-derived email is the unambiguous identity at the auth layer. |
| "Who is the current user as a band member" | `getCurrentMemberKey()` (already canonical for membership identity) | This resolver already exists and is widely used. |
| "Who is a member of this band" | `bands/{slug}/meta/members/` Firebase path | The mirrorMemberToIndex Cloud Function depends on this path; the `bandMembers` global is hydrated from it. |
| "What is the email-keyed band lookup" | `members_index/{sanitized_email}` | Already canonical for the auth-gate path. |
| "Which band am I in right now" | `currentBandSlug` global → `localStorage:deadcetera_current_band` | Already canonical; populated by auth gate. |
| "Who is the owner" | The `isOwner: true` field on a member record | Lives in the data layer; survives email changes. The hardcoded `OWNER_EMAIL` is the contradiction. |
| "Who is a known band member" | `bandMembers` global (loaded from `meta/members/`) | Authoritative roster. `BAND_MEMBER_EMAILS` hardcoded array duplicates this. |
| "What is this member's email" | `bandMembers[memberKey].email` | Already canonical at the data layer. The hardcoded `emailToKey` maps in 5+ files duplicate this. |
| "Who authored this record" | A single typed field name (recommend `author` — already adopted by Annotation/Notes/Takes) | Currently fragmented across `author` / `addedBy` / `createdBy` / `owner`. |
| "What value goes in the author field" | memberKey string (the `author` convention) | Currently mixed: email / memberKey / email-prefix / full-name. memberKey is the most queryable. |
| "What is the server-side membership check" | A single rule pattern, consistently using either `auth.uid` keying OR memberKey keying — not both | Currently the docs describe `auth.uid` but the data uses memberKey. The deployed Console rules need to be read to determine which the deployed reality uses. |

These are CANDIDATES only — surfacing them does not mean committing to migrate every consumer onto them. That is a design phase concern.

---

## §4 — Risk Ranking

Severity scoring: impact (how much breaks) × frequency (how often it surfaces) × reversibility (how hard to undo if we get it wrong).

### CRITICAL (1)

| # | Finding | Why |
|---|---|---|
| F3 | Documented rules use `auth.uid` keying; deployed code uses memberKey | Server-side enforcement may not be doing what's documented. Risk: real access posture is unknown until Console rules are read. Memory Hardening Phase 2 + every future authority-gated write depends on knowing the truth here. |

### HIGH (3)

| # | Finding | Why |
|---|---|---|
| F1 | Three different naming conventions for "who did this" | Affects every primitive that records authorship. Cross-primitive identity queries are broken. F10 is the value-shape companion. |
| F2 | `bands/{slug}/members/` vs `bands/{slug}/meta/members/` storage split | Parallel writes (homeAddress) imply a transitional state that has not been completed. Risk: writes go to the wrong path and data is orphaned. |
| F10 | Authorship value sometimes records email instead of memberKey | Cross-primitive aggregation requires N adapters. Direct consequence of F1 plus inconsistent author/addedBy value shape. |

### MEDIUM (4)

| # | Finding | Why |
|---|---|---|
| F4 | `OWNER_EMAIL` constant vs `isOwner` flag | Two ownership claims. Hardcoded constant wins for admin gating, so the data-layer `isOwner` is decorative. Risk: owner change requires code edit. |
| F5 | `BAND_MEMBER_EMAILS` hardcoded vs `bandMembers` global | Allowlist drift risk. Mitigated by existing union logic, but the hardcoded array is the baseline for stats display. |
| F6 | Hardcoded `emailToKey` maps in 5+ files | Will drift independently. Each one needs updating on any roster change. |
| F11 | Memory Hardening Phase 1 inherits the fragmentation | `promoteToMemory()` uses `_author()` (memberKey), consistent with `author` convention but inconsistent with other authorship fields. Phase 2 must address. |

### LOW (4)

| # | Finding | Why |
|---|---|---|
| F7 | Mode-B observability scaffolding in a Mode-A deployment | Instrumented but inert. Risk only manifests if Mode-B is enabled without surface design. |
| F8 | Module names use "authority"/"role" with inconsistent meaning | Cognitive load; no functional impact. New contributors will need orientation. |
| F9 | `getCurrentMemberKey()` canonical, `GLUserIdentity.getContext()` re-implements lookup | Function duplication. Low-impact; one consolidation would resolve. |
| F12 | `localStorage:deadcetera_current_user` can override OAuth email-match | Likely dev-only convenience; production surprise possible if member email changes. |

### Aggregate read

**12 fragmentation findings. 1 CRITICAL, 3 HIGH, 4 MEDIUM, 4 LOW.**

The single CRITICAL is F3 — the gap between the documented Firebase rule structure and the actual deployed code paths. This is what gates Memory Hardening Phase 2 most directly: Phase 2 wants to enforce `promote_song_knowledge` / `confirm_resolution` permissions via rules, and that enforcement depends on knowing whether the deployed rules actually look at member records via `auth.uid` or via memberKey, and whether they read the documented role field at all.

The three HIGH findings cluster around the same root: **band membership data is fragmented across path conventions (meta/ vs not), name conventions (author / addedBy / createdBy / owner), and value conventions (email / memberKey / mixed).**

The MEDIUM findings are all derivative — hardcoded duplicates of what the canonical data layer already holds. They're individually low-pain but collectively represent N maintenance surfaces.

The LOW findings are cognitive / naming / dev-convenience concerns.

---

## §5 — What this audit settles vs does NOT settle

### Settles

- The Authority fragmentation P0 finding is **real** — 12 specific findings catalogued, 1 CRITICAL.
- The fragmentation lives across at least 5 categories: authentication identity, membership identity, server-side rules, client-side gating, per-feature operational role.
- The single most architecturally suspicious gap is **F3** — the rules-vs-code keying contradiction.
- The single most operationally pervasive gap is **F1/F10** — the author/addedBy/createdBy/owner naming and value fragmentation.
- The single most architecturally bounded gap is **F11** — Memory Hardening Phase 1 inherited (but did not amplify) the fragmentation.

### Does NOT settle

- Whether the deployed Firebase Console rules actually do what the documentation describes. **This requires Console read access to verify** — a step that must precede design.
- How to consolidate any of the fragments. (This is design, not recognition.)
- Which fragments to address in what order. (Design + roadmap.)
- Whether the `bands/{slug}/members/` legacy path should be removed, kept, or migrated. (Requires read-side audit.)
- Whether the hardcoded `OWNER_EMAIL` should remain or migrate to the `isOwner` field. (Design.)
- Whether the membership rule should use `auth.uid` or memberKey going forward. (Design + migration planning.)
- Whether Phase 2 should require a particular author-value shape. (Phase 2 design.)

---

## §6 — Recommended next phase

Per the recognition discipline used throughout this spec series, the next phase is the **Resolution Readiness Audit** — analogous to `memory_hardening_implementation_readiness_v1.md`. That audit would:

1. Read the deployed Firebase Console rules (operator step — requires Drew) and determine the actual deployed shape.
2. Resolve F3 by reconciling documented vs deployed rules.
3. Inventory which Phase 2 capabilities depend on which fragments resolving.
4. Surface the smallest viable slice that unblocks Memory Hardening Phase 2.
5. Propose dependency-ordered Authority Resolution Stack.

The recommended next-next phase is the **Authority Resolution Phase 1 Implementation Design** — analogous to `memory_hardening_phase_1_implementation_design_v1.md`.

This recognition document is the cartography. It does not specify what to do; it specifies what is.

---

## Closing posture

Authority fragmentation is real. It is well-bounded (12 specific surfaces, 1 CRITICAL gap), but it is non-trivial. The good news: most surfaces have a defensible canonical candidate already present in the codebase. The work is consolidation, not invention.

The single most important next operator action is **read the deployed Firebase Console rules** to resolve F3. Until that is known, any Authority design proposal would be speculation about the foundation it has to land on.

The map is drawn. The design phase awaits.
