# GrooveLinx — Competitive Workflow Mapping

_Build `20260514-142926`. Operator-level decision layer over the inventory at [`02_GrooveLinx/notes/competitive_matrix.md`](../notes/competitive_matrix.md). For each tool category bands already use, decide: REPLACE / INTEGRATE / PARTIALLY SUBSUME / IGNORE._

## Why this doc exists

The competitive matrix is the inventory layer — ~50 tools across 7 categories, 5-pillar capability mapping. This doc is the **decision layer**: for each tool a real band currently relies on, what is GrooveLinx's correct strategic response?

**The fundamental principle:** integrated beats replaced. A product that orchestrates around the tools bands already use is more survivable than a product that demands users abandon them.

## The four strategic responses

| Action | Meaning | When it's right |
|---|---|---|
| **REPLACE** | GrooveLinx fully substitutes the external tool; band doesn't need it for this purpose | Only when the external tool is bad-fit for bands AND GrooveLinx's version is materially better |
| **INTEGRATE** | The external tool remains in the workflow; GrooveLinx orchestrates around it | Default for any tool with strong network effects or universal adoption |
| **PARTIALLY SUBSUME** | GrooveLinx covers the band-specific subset; the external tool retains the rest | When the band's use case is narrow within a broader tool |
| **IGNORE** | Out of scope; GrooveLinx is not in this category | When chasing it would dilute "where bands lock in" |

## Anti-pattern to avoid

**Parity-chasing.** "Competitor X has feature Y, we should add it" is the wrong frame. The right frame is: "does a real band reject GrooveLinx because of feature Y?" If no, ignore. If yes, ask whether INTEGRATE solves it before REPLACE.

---

## §1 — BandHelper / OnSong / Setlist Helper / SongbookPro (Band-Ops Apps)

**Why bands use it:** Setlists, charts, schedule, file sharing. The dominant pre-GrooveLinx category.

**Emotional dependency:** MEDIUM-HIGH for active gigging bands. These are the tools a band leader bought a year ago and trained the band on. "I have this set up already."

**Workflow dependency:** HIGH for charts at gigs, MEDIUM for setlists, LOW for everything else. The chart-at-the-gig use case is the load-bearing dependency.

**Replacement difficulty:** MEDIUM. The data is portable in principle (charts as PDFs, setlists as text); the muscle memory and "I already trained Jay on this" friction is what holds bands.

**GrooveLinx response: REPLACE**

- This is the only category where GrooveLinx legitimately competes head-on.
- The competitive matrix confirms GrooveLinx is at parity on Perform pillar + ahead on Rehearse + Improve.
- Migration path: a band switching from BandHelper to GrooveLinx loses MIDI/lighting trigger features (matters for ~10% of pro cover bands) but gains rehearsal intelligence + per-member readiness + offline-honest Prep for Gig.
- **Strategic note:** the matrix recommendation #1 (footpedal + offline-first + iOS App Store wrapper) is what closes the migration friction here. Without those three, BandHelper retains the most-aggressive cover-band segment.

---

## §2 — Ultimate Guitar / Songsterr / Chordify (Tab Libraries)

**Why bands use it:** Pre-loaded tab library; solo learning of unfamiliar parts.

**Emotional dependency:** LOW. Bands use these as **lookup tools**, not workflow tools. "I need to learn this riff" → search Ultimate Guitar.

**Workflow dependency:** LOW. Most band leaders don't expect their band's chart system to also be a public tab library.

**Replacement difficulty:** N/A. There's no replacement question — they coexist.

**GrooveLinx response: IGNORE (as competitors) / INTEGRATE (as references)**

- GrooveLinx is **not** in the public tab library category. Building one is a different product (legal-rights heavy, data-acquisition heavy).
- INTEGRATE path: allow pasting a Ultimate Guitar URL as a chart-source reference (already partially supported via chart import).
- **Strategic note:** Avoid any "we should have a tab library" temptation. That's scope-creep death.

---

## §3 — Moises / LALAL.AI / AudioStrip / Fadr (AI Stems Vendors)

**Why bands use it:** Vocal isolation for harmony practice; instrumental tracks for solo work; chord/tempo detection.

**Emotional dependency:** MEDIUM. Bands that have used Moises like the magic moment when the vocal isolates. Subscription fatigue is real ($4-10/mo per member).

**Workflow dependency:** MEDIUM for harmony singers, LOW for rhythm section.

**Replacement difficulty:** LOW. Moises is single-song-at-a-time; no band-state to migrate.

**GrooveLinx response: REPLACE (already done)**

- GrooveLinx self-hosts Demucs htdemucs_6s via Modal — matches Moises quality, no per-member subscription, privacy-friendly for unreleased material.
- LALAL.AI is integrated (not replaced) for lead/backing split — different model, different output.
- This is one of two categories where REPLACE is the right answer (the other being §1).
- **Strategic note:** Stem-separation parity is **table stakes** for Learn pillar. Don't over-invest beyond parity. Soundslice still wins on notation depth — that's a different pillar.

---

## §4 — Google Drive / Dropbox / iCloud (File Storage)

**Why bands use it:** Storing rehearsal recordings, chart PDFs, miscellaneous band files. The shared-folder pattern is **universal**.

**Emotional dependency:** HIGH. "All our recordings are in this Dropbox folder." Years of files. Years of muscle memory.

**Workflow dependency:** HIGH for recording archives; MEDIUM for chart sharing (where charts may live in shared folders rather than in any app).

**Replacement difficulty:** HIGH. Moving years of recordings is painful. Many bands have grandfathered file shares that pre-date the current lineup.

**GrooveLinx response: INTEGRATE — do NOT replace**

- GrooveLinx should never try to be a band's primary file store.
- Charts can be uploaded into GrooveLinx (already supported); the original files can stay in Drive/Dropbox.
- Rehearsal recordings: GrooveLinx ingests from local upload AND from Drive URL (via Modal proxy). The Drive folder stays canonical for the band's recording archive.
- Per `feedback_workbench_no_new_destinations`: Memory + Recording integrate as **side panels**, never new destinations.
- **Strategic note:** This is the highest-leverage INTEGRATE example. A band that can keep its existing Drive folder AND get GrooveLinx's rehearsal intelligence migrates with zero loss-of-archive anxiety.

---

## §5 — Spotify / Apple Music / YouTube (Reference Listening)

**Why bands use it:** Listening to canonical versions of songs they're working on.

**Emotional dependency:** EXTREME. Spotify is where bands listen to music. The library is their library.

**Workflow dependency:** HIGH for North Star references; daily-use for casual listening.

**Replacement difficulty:** IMPOSSIBLE. Spotify is not a thing to replace.

**GrooveLinx response: INTEGRATE — already done (Stab #08)**

- North Star lens stores Spotify/YouTube/Apple Music URLs as canonical references.
- Spotify Connect playback drives the user's actual Spotify app via REST (iOS-mandatory path per Stab #08).
- Spotify metadata hydrates via the API chokepoint (also Stab #08).
- The Spotify subscription stays with the user — GrooveLinx never tries to be a music service.
- **Strategic note:** This is the model integration: external service stays canonical, GrooveLinx adds the band-context layer. Future integrations should follow this pattern.

---

## §6 — Setlist Maker / Setlist Helper (Standalone Setlist Apps)

**Why bands use it:** Single-purpose: build the night's setlist and share it.

**Emotional dependency:** LOW-MEDIUM. Single-purpose apps have less emotional pull than tool-suites.

**Workflow dependency:** MEDIUM. Lives in the night-of-gig flow.

**Replacement difficulty:** LOW. Setlists are text — recreate in 5 minutes.

**GrooveLinx response: REPLACE**

- GrooveLinx setlist system covers this fully. Stab #12 made Prep for Gig truthful; the offline-honest gig path beats standalone setlist apps.
- **Strategic note:** Setlist Maker users are an easy migration target. They've already accepted "the setlist lives in the app" mental model.

---

## §7 — Google Calendar / Apple Calendar (Schedule)

**Why bands use it:** Personal + band scheduling. Universal calendar layer.

**Emotional dependency:** EXTREME. Same as Spotify — calendar is where life lives. Nobody migrates away from their primary calendar.

**Workflow dependency:** EXTREME. Every band member checks their personal calendar before saying yes to a rehearsal.

**Replacement difficulty:** IMPOSSIBLE.

**GrooveLinx response: INTEGRATE — already done (better than competitors)**

- Two-way Google Calendar sync (matrix §3a: ✅ vs Bandhelper's 🟡 export-only).
- Per `project_calendar_filtering`: time-aware conflict classification prevents overblocking.
- **Strategic note:** This is one of GrooveLinx's strongest INTEGRATE wins. Bandhelper users sometimes cite the lack of true two-way sync as a real migration friction. GrooveLinx wins on this exact point.

---

## §8 — Slack / Discord / GroupMe / WhatsApp / Group Text (Band Chat)

**Why bands use it:** Day-to-day band communication. "Hey, can we move rehearsal." "Pierce can't make it Thursday." "Drew sent the new chart."

**Emotional dependency:** EXTREME. Group chat is where the band actually lives socially. Threads have years of history.

**Workflow dependency:** EXTREME for coordination; HIGH for friction-reducing chatter.

**Replacement difficulty:** IMPOSSIBLE. Nobody migrates a band chat. The platform is wherever the band's been for 3+ years.

**GrooveLinx response: PARTIALLY SUBSUME (for band-ops chatter) / IGNORE (for general social)**

- Band Feed (GLBandFeedStore canonical post C5 Phase 1) covers band-specific chatter: "I worked on this song, here's how it went," polls about rehearsal time, ideas for setlists.
- The general band chat stays where it is. GrooveLinx is not Slack.
- The 3-layer notification system (in-app + FCM + SMS) covers the "did you see this important thing" gap — bands won't move their day-to-day chat to GrooveLinx, but they will accept push notifications from it.
- **Strategic note:** This is the most-likely scope-creep trap. The temptation to "be the band's communication hub" is real and fatal. Resist. Notifications go OUT; chat stays elsewhere.

---

## §9 — BandLab / Soundtrap / Splice / DAWs (Recording / Production)

**Why bands use it:** Multitrack recording, mixing, sample marketplace, project sync. Mostly bedroom-producer / single-artist territory.

**Emotional dependency:** HIGH for production-focused bands; LOW for working bands.

**Workflow dependency:** LOW for the rehearse-and-gig sweet spot.

**Replacement difficulty:** N/A.

**GrooveLinx response: IGNORE**

- Per `00_PRODUCT_STORY.md`: "It's not a recording studio." That stance is correct and should be defended.
- Multitrack ingest (project_multitrack_rehearsal memory) captures **band rehearsal** multitracks for review — that's intelligence, not production.
- **Strategic note:** Every time someone says "could you also be a DAW," the answer is no. DAWs are a 30-year-old category with mature competitors; entering it is a different product.

---

## §10 — Soundslice / Anytune / Capo / iRealPro (Practice Tools)

**Why bands use it:** Solo musician practice — slow down a phrase, loop a section, see synced tab while playing.

**Emotional dependency:** MEDIUM for individual musicians who practice with these tools daily.

**Workflow dependency:** LOW at the band level; HIGH at the individual-member level.

**Replacement difficulty:** LOW-MEDIUM. These are individual habits.

**GrooveLinx response: PARTIALLY SUBSUME (Practice page) / INTEGRATE (link out for deep practice)**

- The Practice page (currently EMERGING, per 08_PROMOTION_BACKLOG.md §1) should subsume the band-specific portion of practice: "what does this band need me to work on?"
- Deep-practice tools (Soundslice's synced notation, Capo's chord detection) stay external. GrooveLinx surfaces references; users open Soundslice for the actual practice session if they want.
- **Strategic note:** Soundslice is the leader on notation depth. Trying to match it is a years-long investment. Better: surface the link as "open in Soundslice" from Song Detail.

---

## §11 — Notion / Airtable / Trello (DIY Band Wikis)

**Why bands use it:** Custom song database, gig log, contact list, anything tabular. The "we built it ourselves" stack.

**Emotional dependency:** HIGH for the band member who built the Notion workspace. Often the band leader.

**Workflow dependency:** MEDIUM. The wiki is a reference; not in every daily flow.

**Replacement difficulty:** MEDIUM-HIGH for the builder. Years of accumulated structure.

**GrooveLinx response: REPLACE (for band-specific data) / IGNORE (for everything else)**

- GrooveLinx's band-as-first-class-citizen data model is the answer to "we have a Notion table for songs." Songs page + Song Detail covers this categorically better than a Notion table.
- Other Notion use cases (gig log, contracts, contacts) — GrooveLinx covers some (Venues, Contacts) but doesn't need to cover all.
- **Strategic note:** Notion converts are the strongest evangelists. They've already done the work of believing "our band data deserves a system." GrooveLinx just has to be better than the system they built themselves.

---

## §12 — Bandzoogle / ReverbNation / Bandcamp (Band Websites + Promotion)

**Why bands use it:** Public-facing band identity, merch, fan email lists, ticket links.

**Emotional dependency:** LOW for working bands; HIGH for promotion-focused bands.

**Workflow dependency:** N/A for daily operations.

**Replacement difficulty:** N/A.

**GrooveLinx response: IGNORE**

- Different product entirely. Public-facing band identity is not "where bands lock in" — it's a different category of work.
- **Strategic note:** No temptation here. Easy ignore.

---

## §13 — Cantabile / MainStage / Gig Performer (Live Rig Hosts)

**Why bands use it:** Live VST patches, keyboard rigs, backing-track triggering at gigs. Mostly keyboardists with synth-heavy live setups.

**Emotional dependency:** HIGH for the specific user; band-wide LOW.

**Workflow dependency:** N/A for non-keyboard bands.

**GrooveLinx response: IGNORE**

- This is a different layer entirely (audio-routing software vs band-ops software).
- Live Gig mode's Stage View shows song info; it does not trigger MIDI patches. That's MainStage's job.
- **Strategic note:** Pierce uses keys but he's not running MainStage today. If a tester is, GrooveLinx coexists with MainStage; doesn't compete.

---

## §14 — forScore / MobileSheets / unrealBook (Sheet Music Readers)

**Why bands use it:** Classical / jazz musicians with PDF sheet music libraries.

**Emotional dependency:** HIGH for classical/jazz musicians.

**Workflow dependency:** HIGH for those users; N/A for rock/pop bands.

**GrooveLinx response: IGNORE for the target user; INTEGRATE via chart import for crossover users**

- GrooveLinx's chord-chart system isn't a sheet-music reader and shouldn't try to be.
- A jazz musician who wants polish-level PDF rendering is forScore's user, not GrooveLinx's.
- **Strategic note:** Don't pursue notation depth past the working-band threshold. The matrix recommendation #5 is correct: amplify the moat (Rehearse + Improve) not the notation pillar.

---

## §15 — Bandhelper MIDI / lighting / backing-track triggering

**Why bands use it:** Pro cover bands with elaborate stage rigs (light cues, MIDI patch changes, sync backing tracks).

**Emotional dependency:** HIGH for pro cover bands; ZERO for everyone else.

**Workflow dependency:** EXTREME for the ~10% of bands that do this.

**Replacement difficulty:** HIGH. Multi-year configuration.

**GrooveLinx response: IGNORE**

- Per matrix recommendation #3: watch, don't chase. This is Bandhelper's moat.
- The target user (working bands at the rehearse-and-gig sweet spot) doesn't need this.
- **Strategic note:** This is the single biggest "we should have parity with Bandhelper on X" temptation. Resist. Pursuing it would force a multi-year build that pulls focus from the moat.

---

## Decision summary table

| Category | Response | Difficulty | Why |
|---|---|---|---|
| Band-ops apps (BandHelper/OnSong/SongbookPro) | **REPLACE** | M | Direct competition; GrooveLinx wins on Rehearse + Improve |
| Tab libraries (UG/Chordify) | **IGNORE/INTEGRATE** | L | Different category; reference paste only |
| AI Stems (Moises/LALAL) | **REPLACE** (done) | L | Self-hosted Demucs achieves parity + cost win |
| File storage (Drive/Dropbox) | **INTEGRATE** | H | Universal; never replace |
| Music services (Spotify/Apple/YT) | **INTEGRATE** (done) | Impossible | Universal; reference + Connect |
| Standalone setlist apps | **REPLACE** | L | Easy migration target |
| Calendars (Google/Apple) | **INTEGRATE** (done, better than competitors) | Impossible | Universal; 2-way sync wins |
| Band chat (Slack/Discord/SMS) | **PARTIALLY SUBSUME** (band-ops only) | Impossible | Notifications out; chat stays elsewhere |
| DAWs / Production | **IGNORE** | N/A | Different product; not GrooveLinx |
| Practice tools (Soundslice/Anytune) | **PARTIALLY SUBSUME** + **INTEGRATE** | L-M | Band practice subsumed; deep practice external |
| DIY wikis (Notion/Airtable) | **REPLACE** (band data) / **IGNORE** (rest) | M | Strong evangelism target |
| Band websites / promotion | **IGNORE** | N/A | Different product |
| Live rig hosts (MainStage/Cantabile) | **IGNORE** | N/A | Different layer |
| Sheet readers (forScore/MobileSheets) | **IGNORE** + chart import for crossover | N/A | Different user |
| MIDI/lighting trigger | **IGNORE** | N/A | Bandhelper's moat; resist |

**Tally:** REPLACE × 3 (already done × 2). INTEGRATE × 4 (already done × 3). PARTIALLY SUBSUME × 2. IGNORE × 6.

**Strategic interpretation:** GrooveLinx's actual competitive surface is **narrower than the matrix suggests**. Six of fifteen categories are explicit IGNORE. Four of the remaining are INTEGRATE — already done or correctly framed. Only three are REPLACE — band-ops apps (where GrooveLinx is positioned to win), Moises (won), standalone setlists (easy win). PARTIALLY SUBSUME captures Practice + band-ops-chat — both correctly bounded.

## How to use this doc

When evaluating any new feature request that touches an external tool:

1. Find the relevant category above.
2. Read the strategic response.
3. If the request is "we should be more like X" — check whether X is an IGNORE category. Almost always, it is.
4. If REPLACE — verify GrooveLinx is materially better, not just at parity.
5. If INTEGRATE — check whether we're orchestrating around the tool, not absorbing it.

## When to revisit

When BETA_FEEDBACK_QUEUE.md shows 2+ testers naming the same external tool as a switching blocker. That's a real signal — re-read the relevant section and ask whether the strategic response needs updating.

Until then: trust the framework. Avoid parity-chasing.
