# GrooveLinx — Core Workflows

_What musicians actually do with GrooveLinx, in order. Each workflow lists the ideal flow, the current reality, friction points, and maturity._

---

## Workflow 1 — Onboard a new band member

**Who:** Band leader (Drew today; expanding to founding members of other bands).

**Ideal flow:**
1. Leader invites a member by sharing their email.
2. Member signs in with that Google email.
3. Member lands on the band's Home page with full access.

**Current reality (Mode-B Phase 1, build `20260514-142926`):**
1. Drew writes the member's email + role to `bands/{slug}/meta/members/{memberKey}` via DevTools console (see `BETA_ONBOARDING_RUNBOOK.md`).
2. Cloud Function `mirrorMemberToIndex` mirrors to `members_index/{sanitized-email}` within ~3 seconds.
3. Member signs in → auth gate (`_glCheckBandMembership`) finds them → routes to the correct band slug.
4. First load: member lands on Home. If Drew enabled `localStorage.gl_beta_feedback='1'` in their browser, the beta-feedback FAB appears bottom-right.

**Friction points:**
- Manual provisioning required — no self-serve redemption yet (Mode-B Phase 2 pending).
- Duplicate-band bug if Drew accidentally provisions twice — auth gate routing is non-deterministic.
- "Welcome to GrooveLinx — not on a roster" overlay (post-Beta-Ops update) is friendly but doesn't actually let the user self-onboard.

**Missing transitions:**
- No "Send me an invite" form on the welcome overlay (deferred to Phase 2).
- No band-creation path for invited founding members of new bands.

**Maturity:** Mode-B Phase 1 — **stable** for manual provisioning. Phase 2 self-serve redemption is deferred.

---

## Workflow 2 — Prepare for rehearsal

**Who:** Band leader.

**Ideal flow:**
1. Look at Home dashboard → see which songs are weak / need attention.
2. Build a rehearsal plan (which songs to work, in what order, how long).
3. Save the plan; band members can see it on their phones.

**Current reality:**
1. Home dashboard shows weak-song badges (avg readiness < 3) + attention-owed polls/ideas.
2. Rehearsal page (`renderRehearsalPage`, `js/features/rehearsal.js`) has plan-building UI.
3. Plan saves to `bands/{slug}/rehearsal_plans/{planId}` (Tier 1, single-owner per DATA_OWNERSHIP_RULES.md).
4. Plan surfaces in the same Rehearsal page on every member's device.

**Friction points:**
- Rehearsal page is 6,000+ LOC (Audit #05 flagged for decomposition in Audit #07 pending).
- Plan-building UI is functional but dense.
- The connection between "this song needs work" (Home) and "let's add it to today's plan" (Rehearsal) requires a manual jump.

**Missing transitions:**
- No drag-from-home-to-rehearsal-plan flow.
- No "auto-suggest plan based on readiness" button.

**Maturity:** **Stable** for plan-build-save-share. **Beta** for intelligence-driven suggestions.

---

## Workflow 3 — Run rehearsal (live, on the night)

**Who:** Whole band.

**Ideal flow:**
1. Drummer counts off song 1.
2. Whoever's leading clicks "Start rehearsal" on a phone.
3. The app records what songs were played, when, in what order.
4. Between songs, members can pull up the chart, hit play on the reference recording, etc.
5. After rehearsal, the session is saved and viewable.

**Current reality:**
1. **Rehearsal Mode** (`rehearsal-mode.js`) is a full-screen overlay (NOT a route — launched directly from Rehearsal page).
2. Per-song heartbeat writes to `bands/{slug}/rehearsal_sessions/{sessionId}` (now canonical-routed via `GLStore.RehearsalSession` — C2 Phase 1 + 2).
3. `GLPlayerContract.pauseAll()` arbitration (Stab #07) prevents two surfaces playing audio at once.
4. **Live Gig Mode** (`live-gig.js`) is the performance-focused alternative — launched from Setlists page when it's actually showtime.
5. Both modes survive route changes; floating now-playing bar persists.

**Friction points:**
- "Rehearsal" vs "Live Gig" mental model — they look similar; the right one to pick depends on context.
- Rehearsal Mode's stage view + chart view + drummer-prep view are well-built individually but switching mid-rehearsal requires nav clicks.
- Audio interruption on iOS (phone call, notification) — recovery via Stab #11 Q.8 pageshow listener helps but isn't bulletproof.

**Missing transitions:**
- No "I'm starting a rehearsal RIGHT NOW" shortcut from Home — must go through Rehearsal page first.
- No automatic switch to Live Gig when a gig calendar entry kicks in.

**Maturity:** **Canonical** for rehearsal session ownership (C2 complete). **Stable** for in-rehearsal UX.

---

## Workflow 4 — Review rehearsal

**Who:** Band leader (sometimes other members).

**Ideal flow:**
1. After rehearsal, upload the audio recording.
2. Server analyzes — identifies song segments, extracts BPM, transcribes talk.
3. Review timeline → "we worked these 8 songs, here's what was learned, here are the recordings."
4. Save key takeaways into per-song notes.

**Current reality:**
1. **Rehearsal page → Upload recording** dropzone (Drive or local file).
2. **Recording Analyzer** (`js/core/recording-analyzer.js`) runs the pipeline: decode → segment → chord detect → embedding match → song attribution.
3. **Best Shot chopper** (`bestshot.js`) is the timeline review UI — segments visible, regions selectable, save timeline to Firebase.
4. **Stab #11 Q.6** added a re-entrancy guard so double-clicking Analyze doesn't race the writes.

**Friction points:**
- Bug #8: chopper Load button silently no-ops without audio loaded → Drew lost a 5/11 timeline this way.
- Server analysis takes 30s–3min; UI feedback during is just "Analyzing…" (no real progress).
- Saved timelines live at `bands/{slug}/rehearsal_timelines/{key}` — they're recoverable but the "where did my analysis go?" mental model is murky.
- Chord detection silently degrades if `_chordServiceUrl` is unreachable (Audit #09 finding 3.2.6 — PARTIAL).

**Missing transitions:**
- "Find the rehearsal I did 3 days ago" requires knowing the date — no search.
- No automatic per-song readiness update after analyzing a rehearsal recording.

**Maturity:** **Stable** for the happy path. **Fragile** at the chopper save-and-recall edge cases.

---

## Workflow 5 — Prep for gig

**Who:** Band leader, day-of or day-before gig.

**Ideal flow:**
1. Confirm setlist for the gig.
2. Click "Prep for Gig" — every chart, key, BPM, lead singer, notes get pre-cached to phone for offline use.
3. Show up at venue with no wifi → app works.

**Current reality:**
1. Setlist Stage View → "⬇ Prep for Gig · Download N charts offline" button.
2. Tap → loops through every song × 8 metadata types + 4 band-level keys.
3. **Stab #12** made this truthful — partial failures now surface "⚠ Partial · N of M items cached" with retry UI. Old behavior silently claimed "Ready for gig" even with 10/50 songs failed.
4. Status text + per-song failure summary + "Retry failed only" + "Try again" buttons.

**Friction points:**
- Initial pre-cache loop is slow (~30s for 50 songs on weak wifi).
- localStorage has a 5MB cap; very large setlists with rich charts could approach it (Audit #09 5.2.5).
- Audio files are NOT pre-cached — only metadata. Playback at gig requires either Spotify Premium (Connect) or YouTube cached by the SW.

**Missing transitions:**
- No "warn me if any song in my setlist isn't ready" pre-flight.
- No "wipe gig cache" button for storage cleanup.

**Maturity:** **Stable + truthful** after Stab #12. Best-shipped workflow of 2026.

---

## Workflow 6 — Learn harmony

**Who:** Harmonist (Pierce), sometimes the vocalist working out their lead.

**Ideal flow:**
1. Open the song.
2. Switch to Harmony view.
3. Hear the lead vs backing isolated.
4. Practice the harmony part with the mix muted.
5. Record a take, review it.

**Current reality:**
1. **Song Detail → Harmony lens** (`harmony-lab.js`).
2. **Split mixer**: takes a multi-track source + plays each part (lead / harmony / instrumental) with independent volumes and pans.
3. **Take review**: record yourself singing the part, play back.
4. **LALAL.AI lead/backing split** (`gl-stems.js splitLeadBacking`) — 25-min job, separates lead vocal from backing for songs where stems weren't already provided.
5. **Stab #07** registered `harmony-lab` as a pausable so other surfaces don't fight it for audio.
6. **Stab #11 Q.8** added pageshow.persisted AudioContext resume so first tap after iOS bfcache restore yields sound.

**Friction points:**
- The Harmony lens is buried inside Song Detail — many users haven't found it.
- LALAL job has no resume yet (Stab #14 only covered Demucs `separate()`; LALAL deferred).
- Take review is fundamentally good but lacks "compare my take to the reference" overlay.

**Missing transitions:**
- No "see all songs where harmony has been worked" page.
- No band-wide "who's the harmony lead for this song" tag (could live in song metadata but doesn't).

**Maturity:** **Beta** — capable but underused.

---

## Workflow 7 — Practice a difficult section

**Who:** Any member, solo, between rehearsals.

**Ideal flow:**
1. Open the song they're struggling with.
2. Loop a 4-bar section.
3. Slow down without changing pitch.
4. Practice with metronome.
5. Mark "I worked this" — readiness updates.

**Current reality:**
1. **Song Detail → Play Mode lens** (or Stems lens for instrumental isolation).
2. **GLPlayerEngine** queue plays the song.
3. **No loop UI yet** on the standard lenses.
4. **Practice Task system** (`PracticeTask` shape per `project_practice_task` memory) is the closes-the-loop layer — partially built.
5. Per-song `readiness` is per-member; `avgReadiness` rolls up to the band.

**Friction points:**
- Practice page (`practice.js`) is functional but not yet integrated with the rehearsal review loop.
- No tempo slowdown / pitch preservation.
- No 4-bar looping UI on standard lenses (would need to live in Workbench).

**Missing transitions:**
- "I worked this song for 20 minutes" → readiness +1 — not automatic.
- "Show me what to practice tonight" — no recommendation engine.

**Maturity:** **Beta** — Practice Task is in-flight but not closed-loop.

---

## Workflow 8 — Build a setlist

**Who:** Band leader, sometimes the vocalist (calling sets at a gig).

**Ideal flow:**
1. Pick songs from the library.
2. Order them.
3. Mark segues / transitions.
4. Group into sets (Set 1 / Set 2 / Encore).
5. Save, share with band.

**Current reality:**
1. **Setlists page** (`setlists.js`) — Plan / Stage / Live modes.
2. **Plan mode**: editor with drag-to-reorder, song picker, segue dropdown.
3. **Stage mode**: read-only summary + Drummer Prep + Prep for Gig button.
4. **Live mode**: launches Live Gig overlay (`live-gig.js`).
5. **Stab #01** (W1 fix) closed the SWR-clobber risk on whole-array writes.
6. **Stab #02** added fail-loud guards on `groovemate_tools.js` setlist writes.

**Friction points:**
- "Plan vs Stage vs Live" mode names aren't intuitive at first glance.
- Section labels (set names) editing is in a separate flow from song reordering.
- No "import setlist from text" / paste-and-parse feature.

**Missing transitions:**
- No "duplicate last week's setlist" shortcut.
- No "swap setlist mid-gig" path in Live Gig (works but not obvious).

**Maturity:** **Canonical** — most-edited surface in the app, well-defended.

---

## Workflow 9 — Review recordings

**Who:** Whole band, between rehearsals.

**Ideal flow:**
1. Open a song.
2. See all the rehearsal recordings of it.
3. Play, compare, mark "best take."
4. Save the chart corrections, notes, etc.

**Current reality:**
1. **Song Detail → Best Shot section** — lists recorded takes for the song.
2. **Chopper view** — opens a take, lets you segment + save a timeline.
3. **Rehearsal Mixdowns** (`rehearsal-mixdowns.js`) — auto-mixed rehearsal cuts.
4. **Multitrack player** (`multitrack-rehearsal.js _mtOpenPlayer`) — per-instrument playback for sessions ingested from X32 SD card.
5. **Stab #13** made multitrack upload cancellation honest.

**Friction points:**
- Three ways to find a recording (chopper saved timelines / Best Shot takes / multitrack sessions) — discoverability is uneven.
- No band-wide "play this version" canonical-take selection.
- File sizes are large; storage management isn't user-visible.

**Missing transitions:**
- No "auto-promote best take to North Star reference" path.
- No annotated playback (timestamp comments on a recording).

**Maturity:** **Beta** — multiple recording sources work; the unified mental model is still being built.

---

## Workflow 10 — Use playback tools

**Who:** Anyone using the app to actually play music.

**Ideal flow:**
1. Tap play on a song.
2. Hear it.
3. Pause it.
4. Skip to next.
5. iOS works as well as desktop.

**Current reality:**
1. **GLPlayerEngine** (`gl-player-engine.js`) is the unified queue across YouTube / Spotify / Archive.
2. **Stab #07** `pauseAll()` arbitration prevents concurrent audio.
3. **Stab #08** `GLSpotifyConnect.apiRequest()` is the canonical Spotify chokepoint.
4. **iOS path**: Spotify SDK is unusable; Connect (REST API to user's Spotify app) is mandatory and works flawlessly.
5. **Floating now-playing bar** (`gl-now-playing.js`) persists across routes.

**Friction points:**
- Five places audio can come from (engine queue / SetlistPlayer / Stems mixer / Harmony Lab / BestShot chopper) — all now arbitrated but still 5 surfaces conceptually.
- Spotify Premium required for Connect; non-Premium users see a clear CTA but the fallback flow (YouTube / Archive) is less smooth.
- Memory pressure on iPhone SE with large audio buffers (Audit #09 7.2.3).

**Missing transitions:**
- No cross-fade between songs in a setlist.
- No volume-normalization across sources.

**Maturity:** **Canonical** — most-stabilized subsystem of 2026.

---

## Workflow 11 — Use rehearsal intelligence

**Who:** Band leader.

**Ideal flow:**
1. After every rehearsal, get a summary: "you worked songs A/B/C, B improved, C still weak."
2. Get suggestions: "consider doing D next time — band hasn't touched it in 3 weeks."

**Current reality:**
1. **Rehearsal Intel page** (`rehearsal-intel`, registered in `pageRenderers`) — surface for AI/insights.
2. **Rehearsal Analysis Pipeline** (`rehearsal-analysis-pipeline.js`) + **GLInsights** (`gl-insights.js`) compute the data.
3. Surface is **experimental** — depth varies by song coverage.
4. **Multiple compute engines** verified live in Audit #05 (agenda, scorecard, segmentation, story).

**Friction points:**
- "How did Drew get to Rehearsal Intel?" — nav menu entry exists but it's down the list.
- The insights are sometimes noisy (e.g., "you haven't worked song X in 2 weeks" when X was retired).
- No "ignore this song for intel purposes" toggle.

**Missing transitions:**
- No automatic "after rehearsal, surface 3 takeaways" prompt.
- No band-wide "what should we work on next?" recommendation that all members see.

**Maturity:** **Experimental** — powerful underneath, polish-thin on top.

---

## Workflow 12 — Use scheduling / conflict systems

**Who:** Band leader + all members for availability.

**Ideal flow:**
1. Member's Google Calendar syncs with GrooveLinx.
2. When leader proposes a rehearsal date, app checks every member's availability.
3. Conflicts surface immediately.

**Current reality:**
1. **Calendar page** + **Gigs page** + **Venues page** — three distinct routes.
2. **gl-calendar-sync.js** is the Tier-1 owner of `band_calendar` + per-member `cal_settings` + `member_freebusy`.
3. Google Calendar OAuth wired (`google_connections/{memberKey}`).
4. **Time-aware conflict classification** (per `project_calendar_filtering` memory) prevents overblocking.
5. **Sync_activity** log under band path (append-only).

**Friction points:**
- Three pages for three concepts that overlap conceptually (Calendar / Gigs / Venues).
- iOS PWA + Google OAuth = occasional re-auth friction.
- Conflict UX is buried — no "show me everyone's calendar in one view."

**Missing transitions:**
- No "propose 3 rehearsal dates" multi-select with auto-availability check.
- No SMS-the-band-when-conflict feature.

**Maturity:** **Stable** for Drew-only use. **Beta** for multi-member band-wide use.

---

## Workflow summary

| # | Workflow | Maturity |
|---|---|---|
| 1 | Onboard band member | Mode-B Phase 1 |
| 2 | Prepare for rehearsal | Stable |
| 3 | Run rehearsal | Canonical |
| 4 | Review rehearsal | Stable (Bug #8 hole) |
| 5 | Prep for gig | Canonical + truthful |
| 6 | Learn harmony | Beta — underused |
| 7 | Practice difficult section | Beta — Practice Task in-flight |
| 8 | Build setlist | Canonical |
| 9 | Review recordings | Beta — discoverability uneven |
| 10 | Use playback tools | Canonical |
| 11 | Use rehearsal intelligence | Experimental |
| 12 | Use scheduling | Stable (single-user) / Beta (band-wide) |
