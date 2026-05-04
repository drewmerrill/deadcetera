# GrooveLinx Roadmap

_Last updated: 2026-05-04_

All product ideas, feature requests, and API integrations live here.
Claude memory should never store roadmap content — update this file instead.

---

## Phase 1 — Song Intelligence & Practice (COMPLETE)
- Per-member readiness + heatmap
- Section-level status
- Woodshed checklists
- Practice timers
- Setlist builder w/ keys/BPM/segues
- Live gig mode
- Export

## Phase 2 — Band Coordination (MOSTLY COMPLETE)
- ✅ Rehearsal planner (full system: plans, sections, timing, assignments, notes, snapshots)
- ✅ Calendar with availability matrix, conflict resolver, date validation
- ✅ Song Pitch system (structured intake with anonymous voting)
- ✅ Stage Plot builder (station model, compact grid, share mode)
- ✅ RSVP
- ✅ Calendar sync
- ⬜ Gig payouts
- ⬜ Expenses
- ⬜ Reports

## Phase 3 — Community & Sharing
- Canon templates
- Rotation helper
- Post-gig debrief
- Vibe tracker
- Public sharing
- Song DNA templates

## Active Priorities (next session)
1. Notification inbox UI (data stored, no reader)
2. Lesson unification Phase 2 (unified learning_resources model)
3. Setlist Phase B (drag between sets, per-song duration override)
4. GitHub Pages redirect page
5. Update stale doc URLs (5 files still reference GitHub Pages)

## Backlog
- Best Shot versioning + AB player
- Improvement journal
- Roles/permissions
- Sub musicians by instrument and availability
- Band Members single source of truth
- Replace free-form instrument fields with structured selector
- Confirm before delete with don't ask again option (global)
- Transaction receipt photo upload
- Replace Photo URL in Edit Gear with native camera/photo picker
- Add Contact address field with Google Places autocomplete
- Contacts filter/search by contact type
- Gig Map collapsible
- Gig Map show band member locations with legend
- Replace synthetic tuner tones with real guitar samples (WebAudioFont)
- Metronome tap-to-type BPM and slider tick marks
- Groove personality profiles (Pocket Meter v2)
- Best groove segment detection
- Rehearsal block duration budgeting for non-song blocks
- Per-song setlist duration override field

## Calendar / Gigs / Setlist consolidation — queued

### Finish the Calendar/Gigs merge (Step 2+)
**Status:** Backlog. Logged 2026-05-04 — Step 1 shipped per `CURRENT_PHASE.md:262`; Step 2+ never landed and is now generating user-visible bugs (orphan rows on delete, broken cascade UX, gig vs setlist navigation confusion).
**Why:** Today gigs live in **two** Firebase nodes — `calendar_events` (Calendar page) and `gigs` (Gigs page) — plus an auto-created setlist. Every create/update/delete needs hand-coded cascades that keep regressing. The dual-write architecture is the underlying cause of bug_queue items D1/D2/D3 (2026-05-04 Drew dump).
**Plan (~3–5 days):**
1. **One canonical node:** `calendar_events` becomes the single source of truth. Add `kind: 'gig' | 'rehearsal' | 'block' | 'busy'` and a `gigDetails` sub-object (venue, payout, contact, …) when `kind === 'gig'`.
2. **Setlist as a child:** `calendar_events/{eventId}/setlistId` references a setlist row. Setlist rows live in their own collection but are owned by the event.
3. **Gigs page becomes a filtered view** of `calendar_events` where `kind === 'gig'`, sorted by date. No separate writes.
4. **Migration:** one-shot Firebase script merges existing `gigs` rows into matching `calendar_events` rows by date+venue match; for `gigs` rows with no calendar event, create one. Then deprecate the `gigs` collection (read-only fallback for ~30 days, then drop).
5. **Cascade is automatic** because there's only one row per gig.
**Tactical interim (next session):** ship cascade fixes that keep both nodes in sync on delete + setlist orphan cleanup. Closes D1/D2/D3 in hours. Cascade logic survives into the merge — not throwaway work.
**Acceptance:** Deleting a gig from anywhere (Calendar, Gigs page, Google sync) removes it from every surface. Tapping a gig in Calendar opens that gig's editor (not a generic list). No "gigs created from Google calendar" / "gigs created in Gigs page" divergence.

## Stems Intelligence — queued

### MusicXML migration (canonical notation format)
**Status:** Backlog. Logged 2026-05-04 — Drew confirmed the May 2 recommendation should ship.
**Why:** Canonical storage is currently ABC. MusicXML is the universal interchange format (MuseScore, Finale, Sibelius, Dorico, Logic Pro, alphaTab) and is what the band actually exports to / imports from. ABC was a reasonable lightweight pick when abcjs was the only renderer, but it loses fidelity on multi-staff, lyrics, and chord symbols — exactly what Harmony Lab needs as it grows. See `memory/project_notation_format.md` for the full rationale and competitive table.
**Plan (~1–2 days):**
1. Server: change Basic Pitch worker output from MIDI→ABC to **MIDI→MusicXML** (Python `music21` lib).
2. Client: thin **MusicXML→ABC adapter** so the existing `harmony-lab.js:629` abcjs render path keeps working unchanged.
3. One-shot Firebase migration: convert existing `harmonies_data` ABC entries to MusicXML.
4. Update spec drift: `stems_intelligence_plan.md` lines 29, 134, 161, 293, 380, 415, 428, 469, 474, 484, 678 and `competitive_matrix.md` lines 189, 248. Replace ABC references with MusicXML.
5. Defer: OSMD swap (replaces abcjs) until multi-voice harmony display is needed.
**Acceptance:** Basic Pitch on a vocals stem produces MusicXML; Harmony Lab still renders via abcjs (now via the adapter); MuseScore download/upload uses the same MusicXML directly.

### Score-aligned soft mask for vocal isolation (Stems Phase 3)
**Status:** Backlog. Logged 2026-05-04 — Phase 3 add-on to the existing Modal DSP service.
**Why:** For shared-mic close-harmony recordings ("Helplessly Hoping" tier from the bake-off corpus), blind source separation hits the physics ceiling. Score-informed source separation (Ewert / Müller / Cano lineage) uses a known pitch trajectory per voice to build a frequency-domain attenuator that suppresses energy outside the predicted F0 + harmonics window. Real research, real boost — bounded by physics on homophonic stacks, useful on counterpoint / divergent-line passages.
**Plan (~1–2 days, no GPU):**
1. Input: MusicXML score (per-voice pitch trajectory) + an audio stem.
2. Align score time to audio (use existing tempo/beat detection or onset alignment).
3. Per voice: build a soft spectral mask that passes energy near predicted F0 + harmonics, attenuates elsewhere.
4. Apply mask in STFT domain; iSTFT back to audio.
5. Output one isolated audio per voice + per-frame confidence label (high when voice is monophonic at a unique pitch; low when stacked in unison/octaves with another voice).
6. Wire into stems lens as a new action surface (parallel to spatial split).
**Honest limits to surface in UI:** Won't unlock close-stacked refrains where partials share frequency bins; will help on lead-line passages and any time the voices diverge in pitch. Confidence label per frame is the trust signal.
**Depends on:** MusicXML migration above (need the score format locked).
**Acceptance:** On Helplessly Hoping verses, Mike's lead-line passages are noticeably more isolated than blind LALAL output; on the homophonic refrains, output is honestly labeled "low confidence."
