# Authority Fragmentation — Readiness Audit v1

> **Readiness audit. Design-only. NOT a design proposal. NOT a target authority model. No solutions. No permissions defined.**
>
> Author voice: GrooveLinx Principal Architect. Honest comparison of deployed Firebase Console rules against the documented design + the recognition spec's findings.
>
> **Purpose:** resolve F3 from `authority_fragmentation_recognition_v1.md` by reading the deployed rules; re-rank all 12 fragmentation findings against deployed reality; identify the smallest viable resolution slice; map Memory Hardening Phase 2 + MVLS dependencies onto the new picture.
>
> **Inputs (now grounded in operator-supplied deployed rules):**
> - `authority_fragmentation_recognition_v1.md` (the cartography)
> - Deployed Firebase Console rules for project `deadcetera-35424` (pasted by Drew 2026-05-30, transcribed in §1.1)
> - `02_GrooveLinx/specs/groovelinx-firebase-rules-notes.md` (the design notes — describes intended posture)
> - `02_GrooveLinx/docs/firebase-rules-snippet.md` (the operations doc — describes deploy posture)
> - `02_GrooveLinx/docs/memory-hardening-phase-1-deploy.md` (Phase 1 runbook — describes the rules merge that was supposed to occur)

---

## §0 — Frame

The Recognition Phase named 12 fragmentation findings, with F3 (rules-vs-code keying contradiction) ranked CRITICAL and unverifiable without Console read access. This audit reads the deployed rules and resolves F3 — and surfaces two additional urgent findings the recognition audit could not have predicted.

The headline: **deployed reality is materially different from documented intent in ways that change the entire fragmentation landscape**. Most findings are re-ranked. Two new CRITICAL findings emerge. Memory Hardening Phase 1's "COMPLETE END-TO-END" status was incorrect.

This audit does not propose what to do. It tells the truth about what is.

---

## §1 — Deployed rules inventory

### §1.1 — The actual deployed rules JSON

Pasted by Drew 2026-05-30 from Firebase Console, project `deadcetera-35424`, Realtime Database → Rules tab:

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

### §1.2 — Decoded posture

What this actually enforces (and does not enforce):

| Top-level path | Read | Write | Effective posture |
|---|---|---|---|
| `care_packages_public` | public (anyone) | authenticated users only | Public broadcast surface; authenticated bands can publish, unauthenticated users can read. |
| `shared_setlists` | public | public (no auth) | Wide open. Anyone on the internet can read AND write. |
| `bands` (top) | public | (cascades to $bandId) | Anyone can list/read the bands tree. |
| `bands/$bandId` | public | **public (no auth)** | **Anyone can read or write ANY band's data.** No membership check, no auth check. |
| `users` | public | public | Wide open. |
| `members_index` | public read | Cloud-Function-only (`.write: false`) | Correctly restricted — only the `mirrorMemberToIndex` Cloud Function (admin SDK bypasses rules) maintains this. |

The `.indexOn` declarations on band sub-paths are query optimization hints — they do not add authorization. They tell Firebase to maintain an index for `orderByChild` queries; that's it.

### §1.3 — What is conspicuously ABSENT from the deployed rules

| Expected | Present in deployed rules? |
|---|---|
| Membership check on `bands/$bandId` (per `groovelinx-firebase-rules-notes.md`) | ❌ NO |
| Admin role check on `bands/$bandId/meta` or invites (per docs) | ❌ NO |
| Per-uid write isolation on `readiness/{uid}` or `crib_notes/{songId}/{uid}` (per docs) | ❌ NO |
| `$other` catch-all gating new paths by membership (per docs) | ❌ NO |
| `activity_log` `.indexOn: ts` (per `firebase-rules-snippet.md`) | ✅ YES — present at `bands/$bandId/activity_log/.indexOn` |
| Phase 1 field-level immutability under `bands/$bandId/annotations/$annotationId/` for `promoted`, `promoted_by`, `promoted_at`, `promoted_from`, `promotion_authority` | ❌ **NO** |

---

## §2 — Critical findings (new, surfaced by Console read)

Two urgent findings the Recognition Phase could not predict because they required deployed-rule inspection.

### §2.1 — NEW CRITICAL #1: Memory Hardening Phase 1 immutability rules are NOT deployed

**Status:** Phase 1 was marked COMPLETE END-TO-END at 2026-05-30 15:23 UTC after `auditProvenance({refresh: true})` returned baseline clean. That verification was insufficient.

**What the verification actually proved:** the `auditProvenance()` function works correctly on an empty annotation collection. It scanned 0 annotations and reported 0 issues. The function's success path was exercised. This is structurally correct.

**What the verification did NOT prove:** that the Firebase rules enforce immutability on promotion fields. The audit reads annotations; it does not test the rules. To verify the rules, the test would need to attempt to overwrite a `promoted_by` field on an already-promoted record from a non-Cloud-Function client and observe rejection. That test was not run.

**Deployed reality (per §1.1):** the deployed rules contain ZERO entries under `bands/$bandId/annotations/$annotationId/`. The five field-level immutability rules from `memory-hardening-phase-1-deploy.md` §1 are absent. The Phase 1 Console merge step either was not performed, was performed against a different config, was lost when republishing, or never reached this rules tree.

**Operational impact today:**
- Memory Hardening Phase 1 is **SHIPPED IN CODE; RULES NOT DEPLOYED**.
- Phase 1 trust-layer guarantees G1 and G2 are operational at the API layer (via the `updateAnnotation()` whitelist + `promoteToMemory()` single pathway) but NOT at the data layer.
- A direct Firebase ref write to a promotion field (e.g. `firebaseDB.ref('bands/deadcetera/annotations/X/promoted_by').set('forged')`) would succeed against the deployed rules — the rules grant `.write: true` at `bands/$bandId/*`.
- Since no annotations have been promoted yet (the audit confirmed `Promoted: 0`), the immediate exposure is bounded — there are no Memory records to tamper with. But any future `promoteToMemory()` write lands without data-layer immutability protection.

**Docs requiring correction (separate from this readiness audit, per Drew's "readiness only" directive):**
- `02_GrooveLinx/CLAUDE_HANDOFF.md` — the "Memory Hardening Phase 1 VERIFIED END-TO-END" session-close entry overclaims.
- `02_GrooveLinx/CURRENT_PHASE.md` — the "COMPLETE END-TO-END" workstream row overclaims.
- Trust-layer guarantees G1 / G2 status should revert from "✅ operational at both API and data layers" to "✅ operational at API layer; data-layer awaits rules deploy."

This is not a security incident — it is a documentation correctness issue. The remediation is straightforward (re-attempt the Console merge per the runbook) once Authority work permits.

### §2.2 — NEW CRITICAL #2: The entire `bands/$bandId` tree is publicly readable AND publicly writable

**Severity: SECURITY-RELEVANT. Not a fragmentation finding — a posture finding.**

The deployed rule `"bands": { ".read": true, "$bandId": { ".read": true, ".write": true } }` grants any client on the public internet (authenticated or not) the ability to:

- Read any band's complete data tree (rosters, member home addresses, calendar events, setlists, gig schedules, song notes, rehearsal recordings metadata, member readiness scores, comments, harmony plans, ALL annotations including any future Memories).
- Write to any path under `bands/{any_band_slug}/...` (including overwriting member records, deleting setlists, injecting fake activity logs, fabricating song clips, etc.).

The auth gate in `app.js` (`_glCheckBandMembership` at line 5888) is purely UI-side. It controls whether the *client app* loads band data after sign-in. It does NOT prevent direct Firebase SDK access. Anyone with the Firebase project config (visible to anyone who opens DevTools on app.groovelinx.com — `firebaseConfig` is always client-visible by design) can:

1. Initialize a Firebase client with that config.
2. Skip the auth gate.
3. Read or write `bands/deadcetera/...` paths arbitrarily.

**What is the actual access posture today:** trust-on-honor at the client level + obscurity at the band-slug level. The band slug `deadcetera` is not secret (it's in the URL, in client code, in commit history, in marketing). Other bands would have less-discoverable slugs but the same architectural exposure.

**Documented intent (per `groovelinx-firebase-rules-notes.md`):** membership-gated read AND write on `bands/$slug` via `root.child('bands/' + $slug + '/members/' + auth.uid).exists()`. This was the design. It is NOT what's deployed.

**Operational impact today:**
- Memory Hardening Phase 1 immutability rules, even if deployed, would have provided field-level protection on annotations — but the surrounding tree being wide open means an attacker could still delete entire annotation records, or replace the whole annotation document with a forged record that has new promotion fields (since `!data.exists()` is true on a deleted node, the immutability rules permit fresh writes).
- Memory Hardening Phase 2's planned authority enforcement on promotion/resolution will sit on a foundation that grants `.write: true` to everyone unless the parent rules are tightened.
- MVLS's promotion gate, the comparison engine's data integrity, the band's trust in its own data — all depend on this foundation hardening.

**Why this is a posture finding, not a fragmentation finding:** fragmentation implies multiple incompatible truths. The deployed truth is unambiguous — it's just very permissive. This is a single source of truth that is wide-open, not multiple competing sources.

**Scope note:** this audit does NOT propose how to harden. Per Drew's directive ("do not design solutions"), the recommendation is to surface and rank. The next phase (Authority Resolution Phase 1 Design) will address the how.

---

## §3 — F3 Resolution (the documented-vs-deployed comparison)

F3 in the recognition spec was: *"Documented rules use `auth.uid` keying; deployed code uses memberKey string keying. The deployed Console rules need to be read to determine actual reality."*

### §3.1 — Three-way comparison

| Concern | Documented (rules-notes.md) | Documented (Recognition spec inferred from app code) | DEPLOYED |
|---|---|---|---|
| Membership check | `root.child('bands/' + $slug + '/members/' + auth.uid).exists()` | `bands/{slug}/meta/members/{memberKey}` writes; `bandMembers[memberKey]` reads | **No check at all** — `bands/$bandId/.write: true` |
| Membership key shape | Firebase Auth UID | memberKey string ("drew", "chris") | N/A (no check) |
| Membership data location | `bands/{slug}/members/{auth.uid}` | `bands/{slug}/meta/members/{memberKey}` (Cloud Function watches this) | N/A for enforcement; storage location matches the Cloud Function's path |
| Admin gate | `members/{auth.uid}/role === 'admin'` | `OWNER_EMAIL` hardcoded constant client-side | **No server-side admin gate** (client-side `OWNER_EMAIL` is the only check) |
| Per-uid isolation (readiness, crib_notes) | `$uid === auth.uid` rule | `bands/{slug}/songs/{title}/readiness/{memberKey}` writes (memberKey-keyed) | **No isolation** — wide open `.write: true` |
| `$other` catch-all | gates new paths by membership | (none) | Does not exist |

### §3.2 — Actual authoritative membership check

**The actual authoritative membership check is the client-side `_glCheckBandMembership()` function in `app.js:5888`.** This is the auth gate that runs after Google OAuth and either kicks the user or routes them to a band. The server-side rules grant unconditional access to `bands/*` — they do not perform any membership enforcement.

This is a structural finding: **the application's access posture is entirely client-side**. There is no server-side defense in depth.

The Cloud Function `mirrorMemberToIndex` maintains `members_index` to support O(1) auth-gate lookups, but the lookup is performed by the client app, not enforced by the rules. A client that bypasses the auth gate (e.g. by initializing Firebase directly) sees no rules-layer obstacle.

### §3.3 — What this means for F3's CRITICAL ranking

The Recognition spec ranked F3 as CRITICAL because the docs-vs-code mismatch implied "server-side enforcement may not be doing what's documented." The deployed reality is more extreme than that: **server-side enforcement does NOT EXIST for the band data tree**. F3 resolves not by reconciling two conventions but by acknowledging neither convention is enforced.

F3 is therefore RESOLVED as **DEFERRED-NEUTRALIZED**: the keying-convention mismatch is moot because no keying is enforced. Future design must address the larger posture finding (§2.2) before any keying convention applies.

---

## §4 — Re-ranked fragmentation findings

The original 12 findings, re-scored against deployed reality.

### §4.1 — Re-rank table

| # | Finding | Original severity | New severity | Why changed |
|---|---|---|---|---|
| F1 | 4 author/addedBy/createdBy/owner field-name conventions | HIGH | HIGH | Unchanged — still operationally pervasive. |
| F2 | `bands/{slug}/members/` vs `bands/{slug}/meta/members/` storage split | HIGH | MEDIUM | Downgraded — both paths are wide-open per §2.2; the split is a code-cleanliness issue more than an access integrity issue today. Will need to be resolved when access is tightened. |
| F3 | Docs use `auth.uid` keying; code uses memberKey | CRITICAL | RESOLVED-NEUTRALIZED | Deployed rules use neither — they use no keying at all (`.write: true` blanket). Will become relevant when posture tightens; currently moot. |
| F4 | `OWNER_EMAIL` constant vs `isOwner` flag | MEDIUM | MEDIUM | Unchanged. |
| F5 | `BAND_MEMBER_EMAILS` array vs `bandMembers` global | MEDIUM | MEDIUM | Unchanged. |
| F6 | `emailToKey` maps duplicated in 5+ files | MEDIUM | MEDIUM | Unchanged. |
| F7 | Mode-B observability in Mode-A deploy | LOW | LOW | Unchanged. |
| F8 | "authority"/"role" naming overload | LOW | LOW | Unchanged. |
| F9 | `getCurrentMemberKey()` vs `GLUserIdentity.getContext()` duplication | LOW-MEDIUM | LOW-MEDIUM | Unchanged. |
| F10 | Authorship value sometimes records email vs memberKey | MEDIUM | MEDIUM | Unchanged. |
| F11 | Memory Hardening Phase 1 inherits the fragmentation | MEDIUM | MEDIUM | Unchanged. |
| F12 | `localStorage:deadcetera_current_user` can override OAuth | LOW | LOW | Unchanged. |

### §4.2 — New findings (added by readiness audit)

| # | Finding | Severity | Origin |
|---|---|---|---|
| **F13** | **Memory Hardening Phase 1 immutability rules NOT deployed** (per §2.1) | **CRITICAL — short-term fixable** | Surfaced by reading deployed rules + recognizing that the prior verification was insufficient |
| **F14** | **`bands/$bandId` tree is publicly readable AND publicly writable** (per §2.2) | **CRITICAL — security posture** | Surfaced by reading deployed rules + reconciling against design intent |
| F15 | `shared_setlists` and `users` are wide-open (`.write: "true"`) | MEDIUM | Surfaced by reading deployed rules; possibly intentional for `shared_setlists` legacy reason but `users` write being public is suspicious |
| F16 | Admin role check (`role === 'admin'`) is documented but not deployed; only `OWNER_EMAIL` client-side constant gates admin features | MEDIUM | Consequence of F14 — without server-side admin enforcement, the documented role hierarchy is decorative |
| F17 | Per-uid write isolation on `readiness/{uid}` and `crib_notes/{songId}/{uid}` is documented but not deployed | MEDIUM | Consequence of F14 |

### §4.3 — New severity distribution

**Original recognition spec:** 1 CRITICAL, 3 HIGH, 4 MEDIUM, 4 LOW.

**Post-readiness re-rank:** 2 CRITICAL, 1 HIGH, 8 MEDIUM, 4 LOW, 1 RESOLVED-NEUTRALIZED.

The center of gravity has shifted: F3 (the original CRITICAL) resolves as moot; two new CRITICAL findings emerge in its place. The HIGH cluster shrinks (F2 downgraded because the storage split is overshadowed by the wider posture finding). MEDIUM cluster expands (F2 downgraded into it; F15/F16/F17 added).

The two new CRITICAL findings (F13, F14) are qualitatively different from each other:
- **F13** is operationally fixable in the same way as the original Phase 1 deploy — re-attempt the Console merge per the runbook. Bounded engineering scope. Restores Phase 1 to the state Drew thought it was in.
- **F14** is a posture-level finding requiring design + careful migration. The right approach is a question — tighten rules to gate `bands/$bandId` by membership, but doing so prematurely breaks the existing client app (which assumes it can read/write freely once past the auth gate).

---

## §5 — Smallest viable Authority resolution slice

The Recognition spec offered Candidate Single Sources of Truth without committing to migration. With deployed rules now known, the smallest viable resolution slice can be identified.

### §5.1 — Three concentric slices, smallest first

**Slice ZERO — Re-deploy Phase 1 immutability rules (F13 only).**
- Scope: re-attempt the Console merge per `memory-hardening-phase-1-deploy.md`. No new rules beyond the five field-level immutability rules already designed.
- Effect: restores Memory Hardening Phase 1 to true END-TO-END state. G1 + G2 become enforced at data layer.
- Constraint: bounded by the existing rules tree. Does NOT address F14 (wide-open `bands/$bandId`). Forged annotation records can still be created from scratch; the immutability protects against modification of already-promoted records but does not protect against fabrication.
- Estimated operator time: ~15 minutes (the runbook is ready).
- Does NOT address Authority fragmentation. It addresses Phase 1 verification gap only.

**Slice ONE — Tighten the `bands/$bandId` parent rule (F14 + F13 + F16 + F17).**
- Scope: replace `bands/$bandId/.write: true` and `.read: true` with membership-gated equivalents. This is the design work explicitly deferred for now.
- Effect: server-side enforcement kicks in. Admin role check becomes meaningful. Per-uid isolation can be added. Phase 1 immutability sits on a foundation that protects records from fabrication.
- Constraint: requires reconciling the keying convention (`auth.uid` vs memberKey) — F3 reactivates as a design question. The deployed code uses memberKey storage and email-derived membership lookup, but Firebase rules can only check `auth.uid` directly (not `auth.token.email` reliably in RTDB). This is the central design question.
- Estimated scope: full design + migration phase. Cannot be specified without design work that is currently paused.

**Slice TWO — Full Authority Resolution (all 16 fragmentation findings).**
- Scope: address F1 / F2 / F4 / F5 / F6 / F8 / F9 / F10 / F11 / F12 / F15 + F13 + F14 + F16 + F17.
- This is the full Authority Resolution Phase work. Out of scope for this readiness audit.

### §5.2 — Recommendation

**Slice ZERO is safe to do now. Slice ONE is the design phase. Slice TWO is the full resolution.**

Slice ZERO costs nothing architecturally and restores documentation truthfulness. It does NOT make MVLS unblocked, but it makes the Phase 1 status claim accurate.

Slice ONE is what Drew explicitly paused. Recognition + readiness only; no design.

Slice TWO is downstream.

---

## §6 — Memory Hardening Phase 2 dependency map

What capabilities Phase 2 was planned to deliver, and which fragments must resolve for each.

| Phase 2 capability | Required fragments resolved |
|---|---|
| Promotion authority enforcement (G3) | F14 (tighten `bands/$bandId` write) + F16 (deploy role-based admin check) + F3-reactivated (decide keying convention) |
| Resolution-confirmation gate (G5) | Same as above + decision on which programmatic callers (e.g. `rehearsal.js:1937`) grandfather |
| Re-open workflow with history (G6) | Same as above |
| AI service-account distinction (G4) | F14 + a new auth identity model (separate service account) — currently the platform has only band-member identity, no service accounts |

**Key insight:** all four Phase 2 capabilities require **F14 to resolve** (or at least partially harden — the `bands/$bandId` parent rule must allow membership-gated writes with the immutability rules nested under them).

Slice ZERO alone does NOT unblock Phase 2.

Slice ONE unblocks Phase 2 (with the keying-convention design question answered).

### §6.1 — Phase 2 cannot ship against the current deployed rules

Even if Phase 2 immutability rules + role checks were merged today, they would be **layered on top of `.write: true`**. Field-level immutability still protects mutation of existing fields, but the surrounding wide-open tree means an attacker can:
- Delete the annotation entirely (then re-create with new promotion fields, since `!data.exists()` evaluates true on a missing path).
- Inject completely fabricated annotation records with arbitrary `promoted_by` values.
- Bypass any UI-layer authority check by writing directly via Firebase SDK.

Phase 2 cannot meaningfully enforce promotion authority without first tightening the `bands/$bandId` parent. This is the architectural ordering constraint.

---

## §7 — MVLS preconditions status update

Original three MVLS preconditions (per the readiness audit):
1. Songs v2 migration completion
2. Authority fragmentation resolution
3. Memory Hardening Phase 2

**Updated against this readiness audit:**

1. **Songs v2 migration completion** — Status unchanged: 🔄 IN PROGRESS. Independent of Authority work.
2. **Authority fragmentation resolution** — Status sharpened: the resolution is materially more involved than the Recognition spec suggested. F14 is the dominant gating finding. Slice ZERO partially mitigates the smaller F13 gap; Slice ONE is what actually unblocks Phase 2.
3. **Memory Hardening Phase 2** — Status downgraded: was "PENDING — gated by Authority fragmentation resolution"; now must add the qualifier "Phase 2 cannot meaningfully enforce promotion authority without F14 resolution AND keying-convention design AND existing-caller migration plan." Phase 2 design itself awaits Slice ONE design.
4. **NEW precondition: Memory Hardening Phase 1 Slice ZERO re-deploy** — newly identified. Restores Phase 1 to its claimed state. Bounded operator work.

**MVLS authorization remains:** 🚫 NOT AUTHORIZED. The deployed reality makes the path slightly clearer (the gating constraint is F14 and downstream design decisions) but no closer to authorization than before.

---

## §8 — Honest correction of prior documentation

The Memory Hardening Phase 1 ship documentation contains overclaims that this readiness audit identifies. Per Drew's "readiness only" directive, this audit does NOT fix the documentation — it identifies what needs fixing.

### §8.1 — Documents that overclaim

**`02_GrooveLinx/CLAUDE_HANDOFF.md`** — the "🔒 SESSION CLOSE — 2026-05-30 15:23 UTC — Memory Hardening Phase 1 VERIFIED END-TO-END" entry states:
- "Drew completed Firebase Console rules merge per `02_GrooveLinx/docs/memory-hardening-phase-1-deploy.md`. Five field-level immutability rules on `promoted` / `promoted_by` / `promoted_at` / `promoted_from` / `promotion_authority` now active under `bands/$slug/annotations/$annotationId/`."

The deployed rules show NO such entries. The merge was either not performed, not saved, performed against a different config, or rejected by an error not surfaced.

**`02_GrooveLinx/CURRENT_PHASE.md`** — the Workstream status table row:
- "Memory Hardening Phase 1 | ✅ **COMPLETE END-TO-END** | Code shipped + Firebase rules deployed + auditProvenance() baseline clean."

The middle clause is incorrect.

**Pinned restart prompt in CLAUDE_HANDOFF.md** — describes Phase 1 as "VERIFIED END-TO-END."

### §8.2 — What the verification actually verified

`GLAnnotations.auditProvenance({refresh: true})` returned baseline clean. This proves:
- The `auditProvenance()` function loads annotations from Firebase.
- It iterates the cache (empty in this case).
- It returns the correct shape.

It does NOT prove:
- That the Firebase rules enforce immutability on promotion fields.
- That `promoteToMemory()` writes survive rule evaluation.
- That a forged direct-ref write would be rejected.

A genuine end-to-end verification would require a test like: promote a test annotation, then attempt `firebaseDB.ref('bands/deadcetera/annotations/<id>/promoted_by').set('forged')` from devtools and observe `PERMISSION_DENIED`. That test was not run.

### §8.3 — Recommended documentation corrections (separate work, not done in this readiness audit)

Per "readiness only" — flagging without acting:

1. CLAUDE_HANDOFF.md: revert Phase 1 entry's "VERIFIED END-TO-END" to "SHIPPED IN CODE; rules pending Console merge"; correct the trust-layer guarantee status of G1/G2 back to "operational at API layer; data-layer awaits rules deploy."
2. CURRENT_PHASE.md: Workstream status row for Phase 1 revert from "✅ COMPLETE END-TO-END" to "✅ SHIPPED IN CODE / ⏸ RULES NOT DEPLOYED."
3. Pinned restart prompt: same correction.

These corrections can land in a single small commit when Drew signals.

---

## §9 — What this audit settles vs does NOT settle

### Settles

- F3 from the recognition spec is RESOLVED — neither documented nor code-implied keying convention is enforced because no rules-layer enforcement exists on `bands/$bandId`.
- Two new CRITICAL findings (F13, F14) surfaced by Console read.
- Re-ranked all 12 original findings + 5 new findings → 2 CRITICAL, 1 HIGH, 8 MEDIUM, 4 LOW, 1 RESOLVED.
- Three concentric resolution slices identified (Slice ZERO / ONE / TWO).
- Phase 2 capabilities mapped to required fragment resolutions — all four Phase 2 capabilities require F14 to resolve.
- Phase 1 documentation overclaims identified.

### Does NOT settle

- How to tighten `bands/$bandId` rules without breaking the existing client app (this is design work explicitly paused).
- Whether the keying convention should be `auth.uid` or memberKey going forward.
- Whether `shared_setlists` and `users` wide-open posture is intentional (legacy reason needed) or accidental.
- The mechanism for AI service-account distinction in Phase 2.
- The migration plan for existing callers like `rehearsal.js:1937`.
- The schedule for any of the above.

---

## §10 — Recommended next actions

In order of dependency:

1. **Decide whether to do Slice ZERO now.** Re-deploy Phase 1 immutability rules per the existing runbook. Bounded ~15 min operator step. Restores documentation truthfulness. Does NOT unblock Phase 2 or MVLS but reduces overclaim debt.

2. **Decide whether to correct CLAUDE_HANDOFF.md + CURRENT_PHASE.md now** (regardless of Slice ZERO timing). The corrections are doc-only, take ~5 minutes, and restore accuracy regardless of what happens next.

3. **Once those two decisions are made, decide whether to begin Slice ONE design** (the Authority Resolution Phase 1 Design). This is the work Drew explicitly paused awaiting deployed rules. Now that rules are known, the design phase has the foundation it needs to begin — or be further deferred.

4. **Independent of #3, MVLS remains NOT AUTHORIZED** until all preconditions resolve. The preconditions stack now includes the new Slice ZERO step as a bounded near-term restoration.

This readiness audit ends here. No design proposed.

---

## Closing posture

The Recognition Phase drew a map; this readiness audit walked the territory. The territory is messier than the map suggested. Two CRITICAL findings emerged from reading the deployed rules: Phase 1 isn't actually end-to-end deployed, and the entire band data tree is publicly accessible.

These are not insurmountable — they are knowable. Slice ZERO is a bounded near-term fix. Slice ONE is the design phase the system is now ready to enter once Drew signals. The architecture remains durable; the rules deployment posture needs catching up to the architecture.

**Status update line:**
- F3: RESOLVED-NEUTRALIZED.
- F13: NEW CRITICAL — Phase 1 rules absent.
- F14: NEW CRITICAL — `bands/$bandId` wide-open.
- Authority Resolution Phase 1 Design: ready to begin once Drew un-pauses.
- Memory Hardening Phase 1: SHIPPED IN CODE; not END-TO-END.
- MVLS: NOT AUTHORIZED.

Map is updated. Awaiting signal.
