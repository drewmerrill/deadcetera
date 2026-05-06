# Rehearsal Review Layer — Per-Stem Annotations + Cross-Session Note Ledger

**Status:** Draft / pre-build (specs only — no code committed)
**Date:** 2026-05-05
**Origin:** 1:1 walkthrough call with Pierce, May 5 2026
**Tracks:** stems player, rehearsal sessions, feed, notifications

---

## TL;DR

Pierce wants the band to upload its weekly rehearsal recording as per-instrument stems, click on any stem at any timestamp to leave a note for any bandmate, see those notes as visible markers on the waveform, and have notes persist + carry forward across rehearsals so improvement is tracked over weeks.

After competitive research: **this exact workflow doesn't exist in any product on the market.** The closest analog is Frame.io (timestamped collaborative review of video — $1.275B Adobe acquisition, 2021). Audio equivalents (Pibox, EvenAudio) are mix-only, not per-stem. DAW-based collab (Pro Tools Cloud, Soundtrap, BandLab) supports per-track comments but treats them as session metadata, not as a workflow — and DAWs are not band-friendly.

**We do not need to become a DAW.** A "Frame.io for stems" — review-only, mute/solo/loop, no editing — is sufficient and probably superior. The competitive moat is *not* the annotation primitive (commodity); it's the **cross-session note ledger tied to band-member identity** — turning weekly rehearsals into a longitudinal performance-improvement record. That's the Song Intelligence System adjacency Pierce is implicitly asking for.

---

## 1. Problem statement

### Pierce's words (verbatim, May 5 call)

> Upload stems for rehearsal and put comments. If we rehearsed on Monday and got a good recording, import the stems and listen through here and put in specific notes for each. I can tell people couldn't hear Brian was leading us out. We should have picked up. Do that for the most recent recording, we come back the next week, we don't want to wipe out all of that context. Could we archive and squash it all down with comments. Go to last rehearsal, go through and review last rehearsal.
>
> Ableton DAW. Use track names to write comments. Need actual stems in there. Brian needs to feed tracks into the app. Breaking up song by song.

### Parsed requirements

1. Brian uploads per-song stems from his Ableton sessions (real multitrack capture, mic-per-source).
2. Anyone in the band can mark a stem at a timestamp with a note targeted at a specific bandmate.
3. Notes appear as visible markers on that stem's waveform; hover/click reveals the note.
4. Notes are surfaced in the Feed AND directly to the named recipient.
5. Notes persist week-to-week. Reviewing "last rehearsal" surfaces unresolved notes from prior weeks.
6. There's a "squash and archive" flow — when notes are resolved, audio can be evicted but the lessons survive.

### Why it matters

This converts what is currently invisible band knowledge ("Brian, you came in late on the turnaround again") into a structured, longitudinal record. It maps directly onto GrooveLinx's stated direction (Song Intelligence System per `CLAUDE.md`): the Feed already surfaces band activity, the rehearsal session already tracks plans + walkthroughs, and the stems lens already plays per-instrument audio. This feature is the missing connective tissue between recording, feedback, and improvement.

---

## 2. Prior art / competitive landscape

### Headline

**No product on the market today implements this exact workflow.** Every product examined matches three of the six requirements at best, with the gap always at the same point: *per-stem annotation tied to a cross-session continuity model.*

### Closest analogs

| Product | Stems-level annotation | Timestamped comments | Targets specific user | Cross-session continuity | Verdict |
|---|---|---|---|---|---|
| **Pro Tools Cloud Collaboration** | ✅ | ✅ | ✅ | Per-session versions | Closest in capability — but DAW-bound, every member needs PT, ~$30/mo + license. Not band-friendly. |
| **Pibox.io** | ❌ (mix-level) | ✅ | ✅ (@mention) | Versions, no carry-forward | Frame.io for *stereo songs*. Doesn't do stems. |
| **EvenAudio** | ❌ (mix-level) | ✅ | ✅ | Versions | Same niche as Pibox, smaller. |
| **Soundtrap (Spotify)** | Partial | Comments at session level | ✅ | None across sessions | Browser DAW; comments are a side feature, not the workflow. |
| **BandLab** | Partial | Comments on project | ✅ | None | Same as Soundtrap. |
| **Frame.io** | N/A (video) | ✅ | ✅ | Versions | Wrong medium, but the gold-standard UX precedent. |
| **Splice** | ❌ | Project comments | ✅ | Version history | Backup + samples, not review. |
| **Audiomovers Listento / Source Connect / Sessionwire** | ❌ | ❌ | ❌ | ❌ | Live monitoring, not async review. |
| **Soundwhale, Aria, Trackd** | ❌ (mix-level) | ✅ | ✅ | Limited | Mix review for post-production. |
| **Descript / Riverside.fm** | N/A (podcast/transcript) | Text-anchored | ✅ | None | Wrong paradigm. |
| **Moises** | N/A (separation tool) | ❌ | ❌ | ❌ | Practice tool, no collab. |
| **BandHelper / OnSong / Setlist Helper** | ❌ | ❌ | Setlist-level | Setlists only | Charts/setlists, not audio review. |
| **NINJAM (Reaper)** | N/A | ❌ | N/A | ❌ | Live jam over internet. |

### Frame.io: lessons that translate

Frame.io is the relevant precedent because they proved the "review, don't edit" model works as a category-defining product. Adobe paid $1.275B for them in 2021. The UX patterns we should copy:

1. **One-click + keyboard shortcut beats right-click.** Right-click is hostile on touch and inconsistent across browsers. Frame.io uses click-to-scrub + a visible Comment button + the `c` keyboard shortcut. Right-click is a power-user shortcut, not the primary affordance.
2. **Threaded replies are essential.** Feedback isn't monologue. ("Brian, late on the turnaround" → "I was watching the bass for the cue, can we agree on a count-in?")
3. **Explicit open/resolved/completed states**, not optional. Reviewers need to filter by status.
4. **Don't auto-migrate timestamps across versions.** Frame.io keeps comments attached to the version they were made on. A new version is genuinely new — timestamps don't translate cleanly. **This translates directly:** Week 2's rehearsal is *not* "Week 1 v2." It's a new recording. What carries forward is not the timestamp but the **intent of the note**, treated as an unresolved item attached to the bandmate, not the audio.
5. **Mobile is read-and-reply, not creation.** Touch screens are bad for precise timeline targeting. Design for desktop creation, mobile reading.
6. **Notification digest per session, not per comment.** Per-comment notifications cause adoption death. Frame.io ships digest-by-default.

### Do we need to be a DAW?

**No.** Three lines of evidence:

- **Frame.io itself proves the review-only model.** Adding editing affordances would have made Frame.io worse, not better. Editing invites users to "fix it themselves," which kills the feedback loop and pits you against the DAW.
- **DAW-collab attempts have been niche.** Pro Tools Cloud has existed for years; it has not displaced async file-sharing. Soundtrap and BandLab succeeded as creation tools for hobbyists, not review tools for working bands.
- **The minimum viable DAW affordances for this workflow are narrow:** mute/solo per stem (required), playhead scrubbing (required), loop a region (strongly recommended), volume per stem (nice-to-have). Region select / time-stretch / editing are *not* required and are probably harmful.

**The positioning is "Frame.io for stems, with a band-aware note ledger."** No DAW affordances beyond playback control + loop.

---

## 3. What we already have

This feature stacks on top of substantial existing infrastructure:

| System | File(s) | What it gives us |
|---|---|---|
| Stem separation pipeline | `gl-stems.js`, Modal/R2/Worker | Demucs separation of stereo → 4-6 stems, async start/check pipeline (handles long-running splits) |
| Stems player UI | `song-detail.js` (Stems lens) | Stacked per-stem waveforms, per-row mute/solo/volume, loop, pan, fingerprint biasing |
| Bookmark / marker rendering | Stems lens, Stage-Crib | Visual markers on waveform timelines (existing primitive) |
| Rehearsal session entity | `rehearsal.js`, GLStore | Sessions have ID, plan, walkthrough, snapshot — note ledger attaches here |
| Feed | `band-feed.js`, `feed-action-state.js`, `feed-metrics.js` | Activity stream — notes generate Feed entries |
| Notification stack | `gl-push.js`, FCM, SMS | 3-layer push to specific members |
| Per-song instrument assignments | `songs_v2/{songId}` | We already know who plays bass on which song — note targeting can default automatically |
| GrooveMate decision engine | `gl-groovemate.js`, `gl-context.js` | Could later surface "Brian has 3 unresolved bass notes — flag during rehearsal review" |

**We are not starting from zero.** The audio infrastructure, the player UI, the marker primitive, the session entity, and the notification stack all exist. The new pieces are: rehearsal-take entity, the annotation primitive itself, the cross-session ledger, and a review-mode page.

---

## 4. Architectural decisions to commit to up front

These shape everything else. Decide first; build second.

### 4.1 Upload model: Option B — per-song stems from Ableton

Pierce literally said "Brian needs to feed tracks into the app. Breaking up song by song." We honor that.

- Brian splits in his DAW, exports per-song stems (per-instrument WAVs), uploads one zip per song.
- App accepts pre-separated stems — skips Demucs entirely.
- Fallback: a single audio file per song goes through Demucs (existing pipeline).
- We do **not** auto-segment a 2-hour mix into songs. That's Pierce's "no" implicit in his quote ("breaking up song by song").

**Why not "single rehearsal file, auto-segment"?**
Auto-segmentation is fragile, long uploads are painful, and storage is heavy. Brian's existing DAW workflow is the best signal we have — building around it is faster and produces better stems (real mics > algorithmic separation, especially on rehearsal recordings — see §10 on Demucs limits).

### 4.2 Review-only model: copy Frame.io, don't become Ableton

- No editing affordances beyond mute/solo/loop/volume.
- No region select, no time-stretch, no fade.
- Take selector lets users switch between "Studio recording" / "Rehearsal 5/12" / "Rehearsal 5/19."

### 4.3 The note is the persistent entity, not the timestamp

This is the most important architectural call.

- A note has a *timestamp on a specific take*, but the **note itself** is what persists across sessions, not its timestamp.
- When Week 2's rehearsal lands with new stems, Week 1's notes don't auto-place themselves on the new audio.
- Instead, unresolved notes **carry forward as ledger entries** keyed to (band-member, song, intent), surfaced in a "still needed from prior weeks" panel during Week 2 review.
- The audio file's timestamp is a *display detail* of where the note was *made*. The durable record is the (member, song, issue) tuple.

This is the Frame.io "comment stays with the version" pattern, recombined for music: the note's *intent* is first-class, the timestamp is incidental.

### 4.4 Notification model: digest, not per-comment

- One notification per rehearsal: "3 new notes from Tuesday's rehearsal — review."
- No per-comment push. Adoption death otherwise.
- Optional: an explicit "send now" override on a single note when it's truly urgent.

### 4.5 Sync model: independent playheads

- Each reviewer scrubs on their own. No synced playback at MVP.
- "Synced listening" is a Phase 3+ feature, not launch.

### 4.6 Mobile model: read + reply, not create

- Mobile users can listen, see markers, read notes, reply to threads, mark resolved.
- Mobile users do *not* create new annotations as the primary path. (We can add a long-press affordance later if usage shows demand.)
- Right-click on desktop is fine as a power-user shortcut. The primary affordance is a visible "+" button on hover near the playhead, plus a `c` keyboard shortcut.

### 4.7 Storage tiering

- Streaming format: AAC/MP3 (compressed) for fast playback in the player.
- Original WAVs/FLACs: kept in cold storage, evictable after N weeks.
- Notes: never evicted. They're tiny rows in Firebase. Audio is the cost; prose isn't.

---

## 5. Scope

### MVP (~3 focused sessions)

Goal: Pierce uploads a real rehearsal, leaves notes, the bassist gets notified and can reply. End-to-end one-loop validation.

- New entity: `rehearsal_takes` per song
- Upload UI in song detail: "Add rehearsal take" button — accepts a zip of pre-separated stems OR a single audio file (Demucs fallback)
- Take selector in stems lens: switch between studio recording / available rehearsal takes
- Annotation primitive: `{ id, stemKey, atSec, text, byKey, forKey, createdAt, status }`
- One-click "+" affordance on hover near playhead → modal w/ stem auto-detected (from row context), `forKey` default = song's owner-of-that-instrument, text field
- Marker rendering on stem waveform (color = recipient's avatar color)
- Hover/click marker → popover with text + author + target + status toggle
- Threaded replies (parent note + N replies)
- Status: `open / resolved / archived`
- Feed entry on note creation
- Digest push notification per rehearsal upload (NOT per-comment) — sent ~5 min after upload to allow batching
- Persistence: `bands/{slug}/songs_v2/{songId}/rehearsal_takes/{takeId}` and `…/notes/{noteId}`

### Rich (~1-2 sessions after MVP usage)

Goal: cross-session continuity that turns notes into a longitudinal record.

- "Last Rehearsal" review page: all takes from the most recent rehearsal session, side-by-side with a notes inbox per member
- "Open notes for me" view: Brian sees every unresolved note targeted at him across all songs and rehearsals, ordered by recency
- "Open notes for this song" view on song detail: every unresolved note across all takes
- Resolve / acknowledge / still-needed flow on notes
- Carry-forward ledger: when a song gets a new take, prior unresolved notes for that song surface as "still needed from N weeks ago"
- Squash: when a take is archived, audio gets evicted from R2; notes survive at song level forever
- Bulk archive: "archive all takes from before $date"

### Out of scope (Phase 3 or never)

- Editing audio (no time-stretch, no region edit, no fades — review only)
- Synced playback across viewers
- Auto-migration of timestamps across sessions (notes carry forward as ledger entries, not as timeline markers — see §4.3)
- Mobile-first annotation creation (long-press affordance is a fallback if data shows demand)
- Real-time collaborative cursors
- Auto-segmentation engine (Option A from §4.1)
- Stem separation confidence UI (log internally first)
- Region-based comments (highlight a 4-second range, not a point)

---

## 6. Data model

### Rehearsal take

```
bands/{slug}/songs_v2/{songId}/rehearsal_takes/{takeId}
├─ id              : string  (matches takeId)
├─ date            : string  YYYY-MM-DD
├─ sessionId       : string  links to bands/{slug}/rehearsal_sessions/{sessionId}
├─ uploadedBy      : string  member key
├─ uploadedAt      : ISO timestamp
├─ source          : 'multitrack' | 'separated'   // pre-separated vs Demucs
├─ durationSec     : number
├─ audioUrl        : string  (compressed mix for streaming, R2)
├─ originalUrl     : string  (cold-stored full quality, R2 — eviction candidate)
├─ stems           : { [stemKey]: { url, durationSec, peakDataUrl } }
├─ status          : 'active' | 'archived'
└─ archivedAt      : ISO timestamp | null
```

### Note (annotation primitive)

```
bands/{slug}/songs_v2/{songId}/rehearsal_takes/{takeId}/notes/{noteId}
├─ id              : string
├─ takeId          : string  (denormalised for query)
├─ songId          : string  (denormalised for cross-take queries)
├─ stemKey         : string  (e.g., 'bass', 'drums', 'guitar1') — null if note is on the mix
├─ atSec           : number  timestamp on this take
├─ text            : string
├─ byKey           : string  member who wrote the note
├─ forKey          : string | null   member targeted (null = whole band)
├─ createdAt       : ISO timestamp
├─ status          : 'open' | 'resolved' | 'archived'
├─ resolvedBy      : string | null
├─ resolvedAt      : ISO timestamp | null
├─ replies         : [ { id, byKey, text, createdAt } ]
└─ digestSent      : boolean   prevents duplicate notification batching
```

### Cross-session ledger view (derived, not stored)

The "open notes for Brian across all rehearsals" view is a query, not a stored aggregate:

```
bands/{slug}/songs_v2/*/rehearsal_takes/*/notes/* WHERE forKey = 'brian' AND status = 'open'
```

Firebase doesn't support cross-collection queries directly — implementation will likely use a denormalized index at:

```
bands/{slug}/notes_index/{forKey}/{noteId} → { songId, takeId, createdAt, status }
```

written on note create/update, scanned for the "open notes" panels.

---

## 7. UX patterns (Frame.io-derived)

### Annotation creation (desktop)

Three affordances, in order of discoverability:

1. **Visible "+" button on stem-row hover near playhead.** Primary affordance — the one most users will discover.
2. **Keyboard shortcut: `c`** (comment). Drops a marker at the playhead on the currently focused stem row.
3. **Right-click on stem waveform.** Power-user shortcut. Context menu: "Add note here" / "Add note for [bassist]" / etc.

All three open the same modal:

```
┌─ New note ─────────────────────────┐
│  Stem: [▼ Bass]                    │
│  At:   2:34.2 (in this take)       │
│  For:  [▼ Brian (bass for this song)] [▼ for everyone]
│  Note: [_______________________________] │
│        [_______________________________] │
│  [ ] Send notification immediately │
│  [Cancel]              [Save note] │
└────────────────────────────────────┘
```

- Stem dropdown auto-fills from the row clicked / focused
- "For" defaults to that song's owner of that instrument (we already know this from `songs_v2`)
- "Send immediately" override flag for urgency; default OFF (digest mode)

### Marker rendering

- Star or dot at `atSec` on the named stem's waveform row
- Color = recipient's avatar color (so Brian's notes look the same wherever they appear)
- Hover → tooltip with first 80 chars of text + author + status
- Click → popover with full text, replies, status toggle, "jump to playhead"

### Status workflow

- Notes default `status: 'open'`
- Recipient (or anyone) can mark `resolved` — fades the marker on the timeline (still visible, lower opacity)
- After N weeks (configurable), old resolved notes become `archived` — hidden by default, visible behind "show archived" toggle

### Review mode entry points

- **Song detail → Stems lens → Take selector**: switching to a rehearsal take shows that take's notes inline
- **Home → "Last rehearsal needs review"**: surfaces takes uploaded since last user visit
- **Home → "Open notes for you"**: digest of unresolved notes targeted at the logged-in member
- **Song detail → Notes tab**: per-song view of all notes across all takes

### Mobile

- Read + reply on existing notes (full functionality)
- See markers, hover them (long-press → popover)
- Cannot create new notes via primary path (out of scope for MVP)

---

## 8. Workflow walkthroughs

### Brian uploads (Tuesday after rehearsal)

1. Brian opens his Ableton sessions from rehearsal night, exports each song's stems (separate WAV per instrument)
2. Zips each song's stems into one zip per song, names them `Eyes_of_the_World_2026-05-12.zip` etc.
3. In GrooveLinx → Song detail (e.g., Eyes of the World) → "Add rehearsal take" → drag-drops zip
4. App detects multitrack zip, decompresses, converts to streaming-format AAC for each stem, stores in R2
5. Take appears in the take selector immediately
6. Repeats for each rehearsed song (5-10 per rehearsal)

**Total Brian effort:** ~10-15 minutes per rehearsal. The friction here is the make-or-break adoption point (see §10.5).

### Pierce reviews (Wednesday morning)

1. Pierce opens app → Home shows "Last rehearsal: 3 new takes ready to review"
2. Clicks → Last Rehearsal page shows all 3 takes side-by-side
3. Opens Eyes of the World, switches to the rehearsal take in the stems lens
4. Listens through, hits `c` at 2:34 on the bass row
5. Modal opens, "For: Brian" auto-filled, types "Late on the turnaround entry — listen to the kick at 2:32, that's your downbeat"
6. Saves. Marker appears on bass row. Note saves to Firebase.
7. Repeats. After ~30 mins he's done with Tuesday's rehearsal.
8. Closes app. ~5 mins later, digest push goes to all addressed members.

### Brian (the bassist) gets notified

1. Brian gets one push: "Pierce left 3 notes for you on Tuesday's rehearsal"
2. Tap → Open notes for you view → 3 cards, one per note
3. Each card shows: song name + thumbnail + timestamp + note text + "Listen at this timestamp" button
4. Tap → opens song detail → stems lens → bass solo + playhead at 2:34 → plays
5. Brian listens, gets it, replies "Got it, watching the kick next week"
6. Marks resolved. Status changes; Pierce sees green checkmark next time he opens the take.

### Next week (carry-forward)

1. Brian uploads next week's rehearsal of Eyes of the World
2. Pierce opens new take → review mode shows the new take's notes (none yet) AND a "Still needed from prior rehearsals" panel listing Brian's 1 unresolved bass note from 2 weeks ago
3. Pierce listens to the equivalent moment in the new take, decides it's improved → marks the prior note "resolved (improved)"
4. Or: it's still rough → adds a fresh note linking to the new take, leaves the old one open as "regression risk"

---

## 9. Open questions / decisions needed before build

These need to be resolved before MVP scoping.

1. **Brian-as-single-point-of-failure mitigation.** What's the backup path if Brian doesn't upload? (a) Anyone in band can upload, (b) Drew uploads from a stereo mix Brian texts him, (c) phone-recorded backup auto-uploads. Which?
2. **Stem set per song.** Are we standardizing stem keys (always: vocals, guitar1, guitar2, bass, drums, keys, other)? Or freeform? Standardized = easier targeting; freeform = more flexibility per song.
3. **Note visibility.** Default visible to whole band, OR only to author + addressee? Pierce's quote suggests both (Feed + direct). I'd default whole-band, with a "private to addressee" checkbox.
4. **Resolve permissions.** Who can mark a note resolved? Just the addressee? Anyone? The author? I'd lean: addressee + author can resolve; anyone else can comment.
5. **"Send now" notification override.** Default off (digest-only). Worth shipping the override for urgency cases, or simplify by removing?
6. **Mobile creation in MVP.** Long-press at playhead → quick-note modal? Or strictly desktop creation for MVP?
7. **Audio retention policy.** 4 weeks before audio evicts? 12? Forever (until manual archive)?
8. **Demucs fallback handling.** If Brian uploads a mixed file (not pre-separated), Demucs runs. The separation is worse on rehearsal recordings (see §10). Do we surface a "low confidence — rerecord with mics?" warning, or stay quiet?
9. **Take label naming.** "Rehearsal 5/12" vs "Tuesday rehearsal" vs Brian-named labels? Auto-name from upload date by default; allow rename.
10. **Per-song instrument owner inference.** When the note has no `forKey`, do we auto-target "the bassist for this song" based on `songs_v2` instrument assignments? Or always require explicit selection? I'd auto-suggest with override.

---

## 10. Risks & hard-won lessons (from competitive research)

### 10.1 Stem separation quality on rehearsal recordings is materially worse than on studio recordings

Demucs HTDemucs v4 (Meta, 2023) is SOTA on commercial mixes and degrades sharply on:
- Room recordings with bleed
- Two guitars in the same frequency range
- Backing vocals
- Percussion that isn't a kit (shakers, tambourines)

The MUSDB18 benchmark Demucs trains on doesn't resemble a basement rehearsal. **Mitigation: encourage mic-per-source capture (Brian's Ableton workflow already does this); fall back to separation only when needed; consider transparency in the UI about separation confidence per stem.**

### 10.2 Storage scales aggressively

A 2-hour rehearsal at 48kHz/24-bit stereo is ~1.2GB raw. With 6 stems, ~3-4GB per session. Per-band, weekly, for a year: ~150-200GB.

R2/B2 storage is cheap (~$0.015/GB/mo) but processing isn't free. **Mitigation:** compressed AAC for streaming (~10x smaller); originals cold-stored in a separate R2 bucket; eviction lever after N weeks.

### 10.3 Sync between viewers is a forking decision

Frame.io defaults to *independent* playheads. Synced playback ("Presentations") was added later. **Independent is right for MVP** — bandmates review on their own time. Synced is a Phase 3 feature for "let's all listen to bar 32 right now" moments.

### 10.4 Mobile annotation is fundamentally different from desktop

Right-click doesn't exist on touch. Long-press is slow and discoverable only by accident. **Realistic mobile pattern: tap timeline to seek, tap a "+" button to drop a marker at current time, type comment in a sheet. Don't try to make right-click work cross-device.** MVP scopes mobile to read+reply.

### 10.5 Adoption fails at the "who uploads" step

Every band-tool study shows the same pattern: **tools die when the burden of uploading falls on one person.** If Brian has to upload, tag, and split stems every week, the system has a bus factor of one. The win condition is *frictionless ingestion* — a phone-app one-click upload, or a Zoom/multitrack recorder that pushes to the app automatically.

Pibox and BandHelper both struggle here; their power users are the only consistent uploaders.

**Mitigation:** make the upload as fast as humanly possible (drag-and-drop zip, no metadata required). Phase 2: allow Drew/anyone to upload too, not just Brian. Phase 3: investigate phone-recording → auto-upload integrations.

### 10.6 Notification fatigue kills feedback loops

If every rehearsal generates 20 comments and each one pushes the addressed bandmate, the bandmate stops looking. **Batch by rehearsal session.** One digest notification: "3 new notes from Tuesday's rehearsal." This is what Frame.io learned the hard way and shipped as their default.

### 10.7 The "carry-forward unresolved" feature IS the product, not the annotation

Annotation alone is a commodity. What makes this a band intelligence system is that **"Brian is consistently late on turnarounds" becomes a visible pattern across weeks.** The data model has to treat a note as a persistent entity with state (open/resolved), an owner, and a history — not a piece of metadata attached to a waveform timestamp.

Most existing tools get this wrong because they tie comments to the audio file, not to the human and the issue. **Don't repeat their mistake.**

### 10.8 Right-click is a discoverability problem even on desktop

Even on desktop, only ~30% of users discover right-click features without a tooltip. Frame.io ships visible button + right-click + keyboard shortcut as redundant affordances. **Match this redundancy.**

---

## 11. Effort estimate (rough, planning-only)

| Phase | Scope | Sessions |
|---|---|---|
| **Phase 0 — Validation** | Brian uploads one real rehearsal manually to R2; existing stems UI plays it; verify quality is acceptable; verify the marker primitive can render at-timestamp | 1 |
| **Phase 1 — MVP** | Take entity + upload UI + take selector + annotation primitive + marker rendering + reply threads + status + Feed entry + digest push | 3 |
| **Phase 2 — Cross-session ledger** | "Open notes for you" view + "Last rehearsal" page + carry-forward UI + squash/archive flow + audio eviction | 1-2 |
| **Phase 3 — Polish & expansion** | Mobile creation (long-press), synced listening, "send now" override refinement, Demucs confidence UI, GrooveMate integration ("flag Brian's open notes during rehearsal review"), per-rehearsal grouping, instrument-owner inference improvements | 2-3 |
| **Total** | | **7-9 sessions** |

Sessions = ~2-3 hours of focused build with a clean spec. This is fast because the audio infrastructure already exists.

---

## 12. Sequencing recommendation

Don't commit to MVP until Phase 0 validates the basic premise.

1. **Phase 0 first.** Have Brian record one real rehearsal (or use a recent one), pre-separate stems, drop them in R2 manually. Open existing stems lens with this audio. Confirm: (a) per-stem playback feels right, (b) the existing marker primitive can be repurposed, (c) audio quality is acceptable for review (not just listening).
2. **Discuss with Pierce + Brian.** Show them the Phase 0 result. Confirm scope before building MVP.
3. **MVP if green-lit.** ~3 sessions.
4. **Real usage for 2-3 rehearsals** before building Phase 2. The "right" carry-forward UI is the kind of thing you can't spec correctly in advance — let actual notes accumulate, then design the ledger view from observed behavior.
5. **Phase 2.** Cross-session ledger.
6. **Phase 3.** Polish + GrooveMate integration.

---

## 13. The competitive moat

This is worth saying out loud because it shapes prioritization.

The annotation feature itself is a **commodity** — Pibox or EvenAudio could ship it in a quarter if motivated. What's defensible is:

1. **Cross-session continuity tied to band-member identity.** Turning weekly rehearsals into a longitudinal performance-improvement record. No competitor in the space currently does this.
2. **Integration with the existing GrooveLinx Song Intelligence System.** Notes can feed into the focus engine, GrooveMate suggestions, rehearsal plans. None of the standalone audio review tools have this surface area.
3. **Stems-centric UX paired with band identity.** Frame.io is video; Pibox is mix-only. The intersection is unfilled.

This means: spend the build budget on cross-session continuity (the moat), not on making the annotation feel ever-more-DAW-like (the commodity).

---

## 14. Verbatim Pierce quote (preserved for future scope discussions)

> "Upload stems for rehearsal and put comments. If we rehearsed on Monday and got a good recording, import the stems and listen through here and put in specific notes for each. I can tell people couldn't hear Brian was leading us out. We should have picked up. Do that for the most recent recording, we come back the next week, we don't want to wipe out all of that context. Could we archive and squash it all down with comments. Go to last rehearsal, go through and review last rehearsal.
>
> Ableton DAW. Use track names to write comments. Need actual stems in there. Brian needs to feed tracks into the app. Breaking up song by song."

---

**End of spec. No code committed.**
