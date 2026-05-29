# Member, Role, and Authority Architecture v1 — Design-Only

**Status:** DESIGN-ONLY — no code, no implementation, no UI build, no migrations, no roadmap commitments
**Author:** Drew + Claude · 2026-05-29
**Predecessors:** [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) · [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) · [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) · [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md)
**Frame:** "The Member layer is the most-referenced and least-defined primitive in the stack."

---

## The question this document answers

**What architectural shape does the Member layer take, and which concerns within it deserve independent identity?**

`memberId` is referenced by every prior spec. It carries authorship on comments. It carries provenance on identity rebinds. It carries ownership on personal artifacts. It carries elevation on Memory. None of the prior specs have defined what a Member *is*, what they *do*, what their *boundaries* are, or how they *change over time*. The Member layer has been treated as a free-text field. This document maps it.

This document does not authorize implementation. It does not propose UI. It does not recommend a roadmap slot. It maps territory so that when the next feature is greenlit — whatever it is — it lands on a defined Member model rather than improvising one ad hoc.

---

## Why this layer needs to be architected now

Three observations make this the load-bearing next territory:

1. **The asymmetry is conspicuous.** Songs, Segments, Artifacts, and Memory all have explicit shape. Member exists as a string field in every record that references one. Authority, lifecycle, and role are absent.

2. **Every implementation candidate from here onward needs it.** Phase D share links need authority. Practice task surface needs ownership. Pin-to-Song needs an actor model. Harmony Lab needs role-targeted artifacts. AI-generated content needs a place to live that isn't pretending to be a human author.

3. **The lesson from Canonical Identity applies recursively.** Drift compounds where authority is not defined. Building feature work without an architected Member layer will calcify ad-hoc authorization patterns that become hard to harmonize later.

---

## 1. Should Person, Membership, Role, and Authority collapse?

The proposed concerns:

- **Person** — a human identity, durable across bands
- **Membership** — a relationship between a Person and a Band
- **Role** — a musical or organizational function within a Membership
- **Authority** — what an actor is permitted to do

The question is whether each deserves independent identity. Architectural discipline demands evaluating collapse before accepting separation; over-modeling is its own failure mode.

### Person and Membership cannot collapse

A Person is durable across bands. Pierce is the same Person whether he is playing keys in DeadCetera or sitting in with a Phish tribute. A Membership is the time-bounded, band-bounded relationship between a Person and a specific Band. Collapsing these forces a new Person identity every time someone joins a new band, which breaks every cross-band concept: shared comments, transferable Memories, alumni attribution, multi-band participation.

**Verdict: Person and Membership are distinct.** Person persists forever; Membership has lifecycle within one band.

### Membership and Role *could* collapse — and should not

A Role could be expressed as a field on Membership (`roles: ['keys', 'harmony']`). This would be cheaper to model. But the collapse loses things that matter:

- Roles have their own lifecycle. Brian took over the bridge lead in 2025; Drew held it before. The role itself moved between people. With Roles as Membership fields, this transfer is invisible.
- Roles can be vacant. The band before Jay had no drummer Role held. A vacant Role is a meaningful state that Membership-as-container does not express.
- Some authority attaches to Roles, not to Members. "The lead vocalist confirms vocal arrangement Memories." If two members hold the lead-vocal Role at different times, the authority moved with the Role, not the Membership.
- Roles can be song-specific. Pierce sings lead on one song; harmony on the rest. The Role per-song is a different shape than the Role per-Membership-overall.

**Verdict: Role is distinct from Membership.** Memberships hold Roles; Roles have their own state, lifecycle, and authority implications.

### Role and Authority *should not* collapse

Authority could derive entirely from Role. In some bands this is implicit ("the founder makes the calls; the lead vocalist owns the vocals"). But:

- Some authority is band-wide, regardless of Role. Drew as founder-admin can do anything; this is not derived from any musical Role.
- Some authority is action-specific, not Role-specific. Anyone can pin a Memory; only the original author can edit their own comment. These rules are about ACTIONS, not about Roles.
- Some authority is *contextual*. The lead vocalist of a song has authority over that song's vocal arrangement; another song's lead vocalist has authority elsewhere. Authority varies with the (Role, Subject) pair.
- AI authority is not a Role. AI generates content, but is not a "lead vocalist" or "founder." AI authority is an actor-type constraint.

**Verdict: Authority is distinct from Role.** Authority is a derived layer expressed as (Action, Subject, ActorContext) → Permitted. It depends on Role, Membership status, action type, and sometimes the song or artifact being acted upon.

### AI and system processes need a separate primitive

When the extraction layer surfaces a Memory candidate, the "who" is the system. When a service-worker auto-archives stale Memories, the "who" is a system process. When (eventually) AI generates a harmony guide, the "who" is an AI model.

These are not Persons. They have no biography. They have no Membership. They have no Role in the musical sense. Treating them as a special kind of Person creates conceptual rot — confirmation by a Person and "confirmation" by AI are different acts. Treating them as a special kind of Member-with-AI-role muddies role taxonomy.

**Verdict: System and AI actors get a separate primitive: SystemActor.** Distinct from Person, with constrained authority.

### Final shape of the layer

```
Person          (durable across bands; one per human)
  ↓
Membership      (Person × Band, time-bounded, status-tracked)
  ↓
Role            (held within a Membership, possibly multiple, with own lifecycle)
  ↓
Authority       (derived: (Action, Subject, ActorContext) → Permitted)

SystemActor     (parallel to Person; for AI and system processes)
```

The decomposition is conservative — each primitive earns its independence by exposing state or behavior the others cannot model.

---

## 2. Formal primitives

### Person

A Person is the durable human identity. Personhood transcends bands.

```
Person {
  personId            # stable identifier, forever
  displayName         # how this person is referred to in the UI
  primaryEmail        # contact and account identity
  alternateContacts?  # additional emails, phone, etc.

  createdAt           # account creation moment
  lastActiveAt        # most recent app activity

  attributes?         # free-shape: bio, location, instruments-played, etc.
                      # NOT band-specific; this is person-level

  identityMergeHistory?  # if this Person is the merged result of multiple
                            previous personIds, the original ids persist here
                            for audit and referential integrity
}
```

A Person record persists forever once created, even after every Membership ends. Past authorship, comments, Memory pins, and identity rebinds remain attributed to the Person.

### Membership

A Membership is the relationship between a Person and a Band. It has lifecycle.

```
Membership {
  membershipId         # stable identifier
  personId             # references Person
  bandSlug             # references Band

  status               # 'invited' | 'active' | 'on_hiatus' | 'departed' | 'returned'
                       # see lifecycle in §3

  invitedAt, invitedBy
  joinedAt, joinedBy
  departedAt?, departedBy?
  returnedAt?
  hiatusReason?

  displayLabel?        # how this person is referred to in THIS band
                       # ("Pierce" in DeadCetera; "Mr. Hale" in workshops)

  visibilityProfile    # default visibility for this member's artifacts
                       # (band_shared, private_to_member, etc; see §5)

  primaryAdmin         # boolean — does this membership confer admin authority?
                       # for founder/owner. Distinct from Role authority.
}
```

A Membership is append-only in the sense that its lifecycle events accumulate. Departure does not delete the Membership; it transitions its status to `departed`. Past contributions remain attributed.

A Person can hold multiple active Memberships simultaneously (multi-band).

### Role

A Role is a function held within a Membership. Roles are first-class.

```
Role {
  roleId              # stable identifier
  membershipId        # references Membership
  roleType            # categorical: see role taxonomy below

  assignedAt, assignedBy
  releasedAt?, releasedBy?

  scope               # 'membership_wide' | 'song_specific' | 'event_specific'
  scopeRef?           # if scope is song_specific: songId
                      # if scope is event_specific: sessionId

  status              # 'assigned' | 'held' | 'released' | 'historical'

  priority?           # for songs/contexts where members hold multiple roles
                      # ("Drew holds lead-vox AND rhythm-gtr; lead-vox has
                      # higher priority for authority resolution")
}
```

Role taxonomy (open-typed, with registered categories at any time):

- **Instrumental roles**: `lead_gtr`, `rhythm_gtr`, `bass`, `drums`, `keys`, `percussion`, `horns`, etc.
- **Vocal roles**: `lead_vox`, `harmony_vox`, `backing_vox`, with refinement like `lead_vox_high`, `harmony_vox_low` when arrangements differentiate.
- **Organizational roles**: `founder`, `admin`, `bandleader`, `setlist_curator`, `archivist`.
- **Per-song overrides**: any of the above with `scope: song_specific`.

A Role can transfer between Memberships. The Role record's `releasedAt` on the old Membership corresponds (in event time) to `assignedAt` on the new Membership. The musical fact (the band's bridge lead-vox responsibility) is the same; the *who* changed.

### SystemActor

A SystemActor represents AI, automated processes, or other non-human actors.

```
SystemActor {
  actorId             # stable identifier: 'system:extraction', 'system:cleanup_sweep',
                      #                    'ai:harmony_guide_v2.1', etc.
  actorType           # 'extraction' | 'cleanup' | 'ai_generator' | 'service_worker' | etc.
  capabilities        # explicit list of action types this actor is permitted
  modelVersion?       # for AI actors, identifies the underlying model
  createdAt           # when this actor was registered
  retiredAt?          # actors can be retired; their historical attributions persist
}
```

A SystemActor's authority is enumerated explicitly. The default for a new SystemActor is no authority over confirmation, curation, or destruction; only authoring (producing candidate content). Confirmation of AI-produced content requires a Person.

---

## 3. Lifecycle model

### Person lifecycle

```
[nonexistent] → account_created → active ↻ active ↻ ...
                                    ↓
                                 deleted (account removed, but personId persists in audit)
                                    ↓
                                 deleted_but_referenced (forever)
```

A Person never fully vanishes from the system. Account deletion is a status, not an erasure. Every past attribution remains intact. (GDPR or similar data-rights requests are a separate concern that may require redacting `displayName` and `primaryEmail` while preserving `personId` and audit links — addressed in a future privacy spec, not here.)

Identity merge: when two Person records are determined to represent the same human, they merge into a single canonical `personId` with `identityMergeHistory` recording the originals. All Memberships and attributions pointing to the deprecated `personId`s are redirected via lookup, not rewrite (the originals remain in audit trail).

Identity split: rare but real. A guest sit-in that was initially recorded as a return of an existing Person turns out to be a different human. The Person record splits; the in-question Memberships are reassigned. Splits are auditable and rare; the architecture supports them but does not optimize for them.

### Membership lifecycle

```
invited → active → [optional: on_hiatus → returned to active] → departed → [optional: returned to active]
```

Membership transitions:

- **invited**: a Person has been invited to a Band but has not yet accepted.
- **active**: full member; default state.
- **on_hiatus**: temporarily not active (illness, sabbatical, life events); contributions during hiatus are minimal; Role assignments often pause.
- **departed**: no longer in the band; past contributions remain attributed.
- **returned**: a departed Membership re-activated. This is the SAME Membership record (or a new one — see Open Questions below). Past contributions during the prior period remain timestamped to that period.

Departure does not auto-archive Roles. Roles released by a departed Member become VACANT until reassigned. Vacancy is a meaningful state.

### Role lifecycle

```
assigned → held → released → historical
```

A Role transition is itself an event with attribution. Releasing the bridge lead-vox Role from Drew's Membership is auditable: when, by whom (Drew himself, or a band decision), and historical context.

A Role can be re-assigned to a different Membership. The musical responsibility moves with the new Role record; the historical Role record persists as historical.

### SystemActor lifecycle

```
registered → active → retired → historical
```

SystemActors are versioned. `ai:harmony_guide_v2.1` is a different actor than `ai:harmony_guide_v2.0`. Retiring an actor does not invalidate its past attributions; new content is generated under the new actor.

---

## 4. Authority model

Authority is derived. It is not a stored permission set on a Person or Membership; it is computed from the (Action, Subject, ActorContext) tuple.

### Action taxonomy

Actions cluster into five types, each with distinct authority requirements:

| Action class | Examples | Default authority |
|---|---|---|
| **Author** | Create a comment, create a take rating, create a practice task, generate AI candidate content | Any active Membership; SystemActors with author capability |
| **Curate** | Pin to Song, set North Star, mark Best Shot, archive Memory, edit chart | Any active Membership; SystemActors NEVER |
| **Confirm** | Confirm an extraction candidate, resolve a disputed Memory, confirm an arrangement decision | Any active Membership; SystemActors NEVER |
| **Mutate** | Rebind segment songId, edit canonical chart, change song catalog metadata | Any active Membership (with optional Role gate for vocal/instrumental specificity); SystemActors NEVER |
| **Administer** | Invite member, change role, change band metadata, delete records (where deletion is allowed) | `primaryAdmin: true` Memberships only |

### Subject-aware refinement

Some authority is refined by the Subject of the action:

- **Vocal arrangement Memories**: any active Member can pin, but Role-gated confirmation requires a Member with a `lead_vox` or `harmony_vox` Role. (Optional refinement; the band can decide its own conventions.)
- **Per-song authority**: a Role with `scope: song_specific` confers authority for that song. Pierce's `lead_vox` on one song means Pierce's confirmation of that song's Memories carries more weight than a non-vocalist's.
- **Author-only mutations**: editing a comment is permitted only by its original author. Once edited, the comment's `editHistory` records the change.

### ActorContext

The third axis: who is acting, in what capacity, at what moment.

- **Active Membership**: full default authority.
- **On hiatus**: read-only by default; can be manually re-elevated.
- **Departed**: read-only access; cannot author, curate, confirm, or mutate. Past attributions remain.
- **Guest** (a special Membership status TBD; see Open Questions): can author content within scoped contexts (the guest's appearances) but cannot curate or confirm band-wide Memory.
- **SystemActor**: capability-enumerated. Default = author candidates only.
- **Cross-band participant**: when Pierce is also a member of a different band, his authority in that band is computed from his Membership there, not his DeadCetera Membership.

### Authority resolution example

When Pierce attempts to confirm a Model B extraction candidate that suggests "Pierce's keys solo drags in the second chorus":

1. Action class: Confirm.
2. Subject: a vocal/instrumental arrangement Memory candidate involving Pierce's role.
3. ActorContext: Pierce's active DeadCetera Membership, holds `keys` Role.

Resolution: any active Member may confirm. Pierce specifically has the subject-relevant Role, so his confirmation MAY carry additional weight in confidence calibration (per Elevation v1's confidence model). But the architectural permission is granted by the active Membership; the Role refinement informs trust, not permission.

### Authority is computed, not stored

A Person's effective authority at any moment is the join of:
- All their active Memberships
- Roles held within each Membership
- The action class being attempted
- The Subject of the action
- The Band scope (a Membership's authority is bounded by that Band)

No "permissions" field is stored on a Person or Membership. The authority layer is a derivation function. This is deliberate: it makes lifecycle transitions clean (departure = authority drops to historical without touching authority records) and keeps the model adaptable.

---

## 5. Cross-cutting concerns

### Multi-band participation

A single Person can hold multiple active Memberships in different bands. Each Membership is independent:

- Pierce's DeadCetera contributions do not leak into his Phish cover band's surfaces.
- Memberships do not share Memory, comments, or artifacts. Each band is its own knowledge system per Canonical Identity v1's band-isolation invariant.
- Authority in Band A does not confer authority in Band B.
- A Person's `displayName` is global; their `displayLabel` per Membership can differ ("Pierce" in DeadCetera, "Mr. Hale" in workshops).

What MAY transfer (deferred to Open Questions): personal artifacts (a singer's vocal-practice mix produced for one band might be useful for another). The architecture supports per-artifact visibility settings that could allow cross-band reuse with explicit permission. v1 default: no cross-band data flow.

### Former members and alumni

A departed Membership preserves all attributions. The Member's past comments, pinned Memories, rebinds, and authored content remain visible with their original `createdBy` attribution, including the displayLabel they used at the time.

Departed Members lose:
- Authority to author new content
- Authority to curate (pin, archive, mark Best Shot)
- Authority to confirm Memory candidates
- Authority to mutate (rebind segments, edit charts)

Departed Members retain:
- Visibility (can still read what the band has produced, subject to visibility settings on individual artifacts)
- Attribution for past contributions
- The ability to be re-invited (Membership transitions to `returned`)

A future product question: do departed Members' personal artifacts (their practice mixes, overdubs) remain or sweep? Default: remain, with explicit archive option per artifact. The Memory layer's append-only discipline argues for retention.

### Guest musicians

A guest musician sits in for one or several rehearsals or gigs without becoming a full Member. The architecture has three options:

1. **No special primitive — guests become full Memberships with a status like `guest_only`.**
   - Pros: minimal model surface.
   - Cons: muddies what "Membership" means; guest contributions appear in band-wide aggregations.

2. **Guest as a sub-status of Membership.**
   - Adds a `guest: true` flag and constrains the guest's Role assignments to `scope: event_specific`. Authority is restricted.
   - Pros: lifecycle is preserved; guests are real Members but with bounded scope.
   - Cons: requires authority resolution to honor the guest flag carefully.

3. **Guest as a separate primitive — GuestParticipation.**
   - Distinct from Membership. Attached to specific Sessions or Events. No Roles.
   - Pros: cleanest semantic boundary.
   - Cons: more primitives; integration with attribution requires duplication of the Person reference pattern.

The architectural truth: any of these can work. Option 2 (guest as sub-status) is recommended as the lowest-cost path that preserves model integrity, but the choice is deferred to implementation time.

### AI and system actors

SystemActors are first-class but constrained. Their authority is enumerated per actor type:

- `system:extraction`: Author (creates Memory candidates). No Confirm, Curate, Mutate, or Administer.
- `system:cleanup_sweep`: Mutate (archives stale records per configured policy), with rate-limit and audit-trail discipline. No author authority.
- `ai:harmony_guide_v2.1`: Author (generates guide audio + metadata). No Confirm authority. Generated guides remain candidate until a Member confirms.
- `system:notification`: Author (creates notification records). No other authority.

SystemActor attributions appear in audit trails alongside Person attributions. The `createdBy` field on any record accepts both `personId` and `actorId`; the calling context distinguishes them. This is the rare case in the architecture where a single field's referent type is polymorphic; the alternative (separate `createdByPerson` and `createdBySystem` fields with NULL on the unused one) was rejected as more surface for no architectural gain.

### Personal vs shared boundary

Visibility is an axis orthogonal to ownership. A comment is owned by its author; its visibility is a separate field:

- `private_to_member`: only the authoring Person can see. (Personal practice notes: "I always miss this transition.")
- `member_only`: any active Member of the Band can see. Default for most content.
- `role_scoped`: only Members holding a specified Role can see. (Vocal coaching notes visible to vocal Roles only.)
- `band_shared`: same effective scope as `member_only`; named separately for clarity in shared artifacts.
- `public_shared`: explicitly shared outside the Band. Touches Phase D share-link architecture (out of scope here).

Defaults vary by artifact category:
- Comments default to `member_only`.
- Practice mixes default to `private_to_member`.
- Memory defaults to `member_only` (Memory is band-level by design).
- Takes / clips default to `member_only`.
- AI-generated candidates default to `member_only` until confirmed.

### Harmony Lab singer targeting

Per Harmony Infrastructure v1, derived artifacts can carry `memberId` and `roleId`. With the Member layer formalized, these fields resolve cleanly:

- A practice mix produced for Pierce's harmony part carries `memberId: <pierce.personId>` AND `roleId: <pierce's harmony_vox role for this song>`.
- The mix appears under Pierce's view of Song DNA by default, hidden from others (visibility = `private_to_member`).
- If Pierce shares the mix with the band ("here's the harmony reference I'm working from"), visibility transitions to `member_only`.
- If Pierce departs the band, the mix's visibility and ownership rules apply: by default it remains as historical context; a future band-level archive sweep may collect it.

The mute-my-part mix logic depends on Role targeting:
- A mix with `roleId: lead_vox` mutes the lead vocal track and is intended for the Member holding lead_vox on that song.
- The Member's *current* lead_vox Role (which may change over time) determines what they see by default.

### Practice task ownership

A practice task has:
- An author (`createdBy`: the Person who created it)
- An owner (`assignedTo`: the Person responsible for it; may be self)
- A subject (a song or a take)
- A state (open / in-progress / completed / archived)

Authority to create/edit/complete: author and owner each have authority on their respective fields. The author can edit description; the owner can update state. A band-wide task ("everyone practice the bridge") has multiple owners or a band-level owner.

### Comment authorship

A comment's `createdBy` is the authoring Person's `personId`. Edit history persists. Authority to edit is author-only. Authority to delete a comment is author or band admin; deletion does not erase, it transitions to `deleted_by_author` with a tombstone (the Memory layer's evidence chain may reference it).

### Memory creation, confirmation, resolution

Per Elevation v1, Memory carries:
- `createdBy`: the actor who first elevated the Memory (Person or SystemActor)
- `elevatedBy`: the Member who confirmed (always a Person)
- `resolvedBy`: the Member who marked the Memory resolved (always a Person)

With the Member layer:
- `createdBy` accepts `personId` or `actorId` (SystemActors can author candidates).
- `elevatedBy` requires `personId` of an active Member.
- `resolvedBy` requires `personId` of an active Member.
- Confidence calibration MAY consider the subject-relevance of the confirmer's Role (per §4).

### Share-link permissions

(Phase D scope — referenced here for integration only.) Share links inherit Band-level visibility settings. A share link is created by an authorized Member and grants `public_shared` visibility to the linked artifact. Authority to create share links is `member_only` by default; can be restricted to admin-only per band preference.

### Trust and provenance considerations

Provenance is a Person-anchored audit trail across the stack. Every record that can be authored, confirmed, curated, or mutated carries one or more Person references with timestamp. The audit chain forms an immutable history: who did what, when. This trust foundation is what makes the Memory layer credible and what allows future intelligence layers to layer onto an established baseline.

When attribution is to a SystemActor, that fact is visible. A Member can always distinguish AI-generated content from human-authored content. This is a Pierce-synthesis-aligned trust commitment: the band's claims about itself remain claims made BY the band, even when AI is involved in their generation.

### Identity merge and split

**Merge** (two Persons → one):

- Initiated by an administrator after confirming the two records represent the same human.
- The new canonical `personId` becomes the merge result.
- The original two `personId`s persist in `identityMergeHistory`.
- All attributions pointing to either original `personId` are redirected at read time via lookup. No rewrite.
- The deprecated personIds remain valid references (lookups will resolve them); they are simply not the canonical form.

**Split** (one Person → two):

- Initiated by an administrator when contributions previously attributed to one Person actually came from two distinct humans.
- A new Person is created for the contributions that should not have been on the original.
- Affected attributions are explicitly transferred (this IS a rewrite of records — rare and auditable).
- The original Person record retains the contributions that remain hers.

Both operations are auditable. They are not common. The architecture supports them but does not optimize for them.

---

## 6. Integration with prior architectures

### Canonical Song Identity v1

- `rebindSegmentSong()` accepts a `user` field. With Member formalized: `user` is the `personId` of the authoring Member (or `actorId` of a SystemActor, e.g. an automated cleanup pass).
- Authority to call the helper requires active Membership in the segment's Band.
- The identity audit trail's `identityUpdatedBy` field stores the actor reference.

### Harmony Infrastructure v1

- Artifacts' `createdBy`, `memberId`, `roleId` fields resolve to Member-layer entities.
- `derivedFrom` for overdubs references both the source segmentId AND the recording Member.
- Artifact visibility uses the Personal/Shared boundary from §5.

### Song DNA Convergence v1

- The "who can see what" question in faceted aggregation views is now answerable: filter artifacts by visibility against the viewing Member's context.
- "Pierce's practice mixes for this song" is a query over `artifactType=practice_mix AND memberId=<pierce.personId>`.

### Elevation Primitive v1

- The "confirmation" gate for Model B candidates resolves cleanly: requires a Person, not a SystemActor.
- Memory attribution fields anchor to Persons. SystemActor-authored candidates are visible as such.
- The Trust dimension of confidence calibration can optionally weight by the confirmer's subject-relevance Role.

The Member layer dissolves several previously hand-waved attributes across the prior specs. Nothing in the prior architecture requires revision; the Member layer is the substrate they implicitly assumed.

---

## Open architectural questions deferred to future specs

1. **Returning Membership: same record or new?** When a departed Member returns, does the original Membership reactivate (with continuous identity) or does a new Membership begin? Argument for same: continuity of contribution attribution. Argument for new: the gap in membership IS a meaningful boundary.

2. **Guest primitive shape.** §5 outlined three options. The choice is deferred.

3. **Cross-band artifact reuse.** Can Pierce's practice mix follow him to another band with his explicit permission? Touches privacy, attribution, and the band-isolation invariant.

4. **GDPR / right-to-be-forgotten compliance.** Person records persisting forever in audit trail conflicts with right-to-erasure requests. Architecturally, redacting `displayName` and `primaryEmail` while preserving `personId` and audit links is the likely path. A future privacy spec.

5. **AI authority elevation over time.** Can an AI actor that proves reliable accumulate authority (e.g., AI-confirmed candidates after sufficient agreement history)? The architecture currently forbids this; future products may want to reconsider.

6. **Role taxonomy governance.** Who can register new Role types? The band? GrooveLinx maintainers? Open-typed within the band scope is the lowest-cost path; centralized taxonomy is the most consistent.

7. **Authority quorum.** Some Memory confirmations might require multiple Members' agreement (band-defining decisions). The architecture supports per-confirmation Member count via the Memory's evidence; whether quorum is built in is a future product question.

8. **Anonymous identities.** Can a Person be anonymous? Probably not for v1; band membership implies known identity. Future cases (anonymous feedback, audience contributions at gigs) may require an `anonymous_actor` primitive.

9. **Band-level identity.** This spec only minimally architects the Band (`bandSlug` as a reference). A future Band Architecture spec may formalize Band identity, lifecycle, sub-projects, and lineage.

10. **Per-Membership visibility settings.** Some Members may want a different default visibility profile from the band default. The `visibilityProfile` field on Membership supports this but the policy machinery is unspecified.

---

## What this spec does NOT do

- Does not authorize any implementation.
- Does not propose UI for member management, role assignment, or authority resolution.
- Does not migrate existing band data into Person/Membership records.
- Does not modify Canonical Identity, Harmony Infrastructure, Song DNA Convergence, or Elevation Primitive decisions; those are treated as settled.
- Does not specify the SystemActor capability registry (which AI models exist, what they're authorized for) — that's per-actor implementation work.
- Does not propose authentication flows or session management.
- Does not authorize cross-band data sharing.
- Does not commit any engineering time or roadmap slot.

---

## Song Member Layer North Star

The band's living roster reflects how the band has actually evolved: who has played, what roles they've held, when they've stepped in and stepped out, what they've contributed, and what authority they hold today. Every comment is attributed to a Person whose path through the band is visible. Every Memory is confirmed by Members whose Roles inform but do not gate the trust the band places in their judgment. Departures and returns are recorded; alumni attributions persist; guests can sit in without becoming permanent fixtures; AI participates as a recognizable kind of actor whose claims always remain candidates until a Member confirms. The band is the durable unit; the Members are the durable contributors; the Roles are the durable musical responsibilities; Authority emerges from their composition rather than being statically assigned. The architecture makes who-did-what visible without making who-may-do-what bureaucratic.

---

## Top Five Architectural Insights

1. **Person, Membership, Role, and Authority each earn their independence.** Collapsing them was evaluated and rejected on the merits — each exposes state or behavior the others cannot model. Person is durable across bands; Membership is time-bounded within one band; Role is independently tracked and transferable; Authority is derived from their composition plus action context. The four-level decomposition is conservative — each level is justified by what would be lost by collapsing it.

2. **SystemActor is parallel to Person, not a subtype.** AI-generated content and system-process actions need an actor model. Treating them as a special kind of Person creates conceptual rot — confirmation by a Person and "confirmation" by an AI are different acts. Treating them as a special kind of Member-with-AI-role muddies role taxonomy. A parallel primitive with constrained, enumerated authority preserves the integrity of both the human Member model and the trust commitment that the band's claims about itself remain human claims.

3. **Authority is derived, not stored.** No "permissions" field exists on a Person or Membership. Authority is a function of (Action, Subject, ActorContext) → Permitted, computed at the moment of the action attempt. This makes lifecycle transitions clean — departure drops authority automatically without touching authority records — and keeps the model adaptable as the band's conventions evolve. Storing authority creates the maintenance burden of keeping permissions in sync with role changes and membership transitions; deriving authority sidesteps the burden by recomputing from current state.

4. **Append-only attribution is the trust substrate, just as append-only evidence is for Memory.** Departures don't erase attribution; merges don't rewrite history; deletions transition to tombstones. The audit trail is a load-bearing feature, not bookkeeping. Without it, attribution becomes opinion that updates silently, and the band's record of its own evolution loses credibility. This invariant aligns with the Elevation Primitive's evidence model: trust at scale requires durable provenance at every layer.

5. **The Member layer dissolves several previously hand-waved attributes without revising prior architectures.** Canonical Identity's `user` field, Harmony Infrastructure's `memberId` and `roleId` fields, Convergence's "who can see what" questions, and Elevation's confirmer requirements all resolve cleanly once Member is formalized. The layer was the implicit substrate the prior four specs assumed without naming. Mapping it now is less an addition than a recognition.

---

## Top Five Risks

1. **Over-modeling at the Role layer.** The Role primitive is rich enough to express many distinctions (instrumental vs vocal, scope variants, priority, transfer). A band that just wants "Pierce plays keys" may find the model heavier than their needs. The architecture supports minimal Role usage (single membership-wide Role per Member with no scope variants) but the temptation to over-structure exists. Discipline at the implementation layer must hold the model proportional to the band's actual complexity.

2. **AI authority creep.** SystemActors start with author-only capability. Over time the pressure to "let AI do more" — auto-confirm low-stakes candidates, auto-archive obvious stale Memories, auto-suggest Role changes — will accumulate. Each expansion is locally reasonable; cumulative expansion erodes the trust foundation. The architecture has no built-in check against this drift; it relies on continued discipline at the implementation gate.

3. **Identity merge complexity.** Merge and split are rare but real. When they happen, the redirect-at-read-time pattern is clean but introduces subtle bugs: a query that filters by `personId === X` may miss records that point at a now-deprecated personId. The architecture is correct in principle but requires careful query-time discipline. Implementation specs for merge / split flows must address this explicitly.

4. **Authority resolution latency.** Computing authority from (Action, Subject, ActorContext) at every action attempt is correct in principle, but at scale it can become an unexpected hot path. A naive implementation could perform poorly when the action involves traversing all of a Person's Memberships, all Roles within each, and their per-song scope refinements. The architecture allows caching the derivation; whether caching is needed depends on implementation choices not pinned here.

5. **Departed Members' visibility erosion.** The default — departed Members retain visibility into past contributions — is the kindest interpretation. But over time, bands evolve, and a departed Member retaining ongoing access may feel inappropriate. The architecture supports per-Membership visibility settings on departure, but there is no canonical answer for what those defaults should be. Bands that don't think to configure them inherit the default. This is a product question masquerading as an architectural one, and resolving it requires the band's own conversation, not the system's.

---

## Related documents

- [`canonical_song_identity_v1.md`](canonical_song_identity_v1.md) — the substrate. Member-layer authority gates calls to `rebindSegmentSong()`.
- [`harmony_infrastructure_design_v1.md`](harmony_infrastructure_design_v1.md) — derived artifacts whose `memberId` and `roleId` fields now resolve to formalized Member entities.
- [`song_dna_convergence_architecture_v1.md`](song_dna_convergence_architecture_v1.md) — the "who can see what" surface; faceted queries filter by Member context.
- [`elevation_primitive_architecture_v1.md`](elevation_primitive_architecture_v1.md) — the confirmation gate; requires a Person, not a SystemActor.
- Memory: `user_band_members` — current DeadCetera roster; the lived case study this layer formalizes.
- Memory: `project_pierce_synthesis_2026-05-29` — the Pierce-synthesis frame that grounds the trust commitments enumerated here.

---

The Member layer was the implicit substrate the prior architecture assumed without naming. Mapping it now is less an addition to the stack than a recognition of what was already there. The territory is now visible.
