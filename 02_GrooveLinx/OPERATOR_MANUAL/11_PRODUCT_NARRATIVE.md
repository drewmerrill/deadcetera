# GrooveLinx — Product Narrative

_Build `20260514-142926`. The strongest current product story, the best demo paths, and the top-line recommendations. Single source for "what to say when someone asks what GrooveLinx is."_

This doc combines three sections — Product Narrative Extraction, Demo Path Definition, and Top-Line Recommendations — because they all answer one operational question: **what should Drew be doing with this product right now?**

---

# Part I — What GrooveLinx Actually Is

## The clearest current product story

> **GrooveLinx is where bands lock in.**
>
> It is the layer between rehearsal and gig where every song-level decision a band makes — the chart, the key, the tempo, the lead singer, the canonical version — lives in one place, on every member's phone, offline-safe for the gig.

That's the whole pitch. Forty-something words. It can be tightened further, but this is the version that's true today.

Everything else — Modal stem separation, Spotify Connect playback, multitrack ingest, rehearsal analyzer, harmony split mixer — is supporting evidence for that single thesis.

## The strongest workflow story

The strongest workflow GrooveLinx tells, end-to-end, today:

**"Drew builds a setlist on the laptop. Hits Prep for Gig. Drives to the venue. Phone is on the mic stand. No wifi. Every chart, every key, every BPM, every reference recording — there. The band plays the whole set without anyone reaching for a notebook."**

That story is real. It works. It's verifiable in BETA_LAUNCH_CHECKLIST.md §3, §4, §6. It's the demo that proves the thesis.

## The strongest emotional value

> **"Not having to remember."**

Every persona in `04_USER_JOURNEYS.md` is operating under cognitive load. The drummer doesn't want to remember the BPM. The harmonist doesn't want to remember the part. The leader doesn't want to remember what they decided last week. GrooveLinx is **the externalized memory of the band**.

That's emotionally powerful because the alternative — "I have to remember" — is anxiety. GrooveLinx removes anxiety, not just inefficiency.

## The strongest differentiation

What GrooveLinx does that nothing else on the market does together:

1. **Band-as-first-class-citizen data model.** Other apps are user-centric. GrooveLinx is band-centric — roster + role + readiness baked in.
2. **Offline gig safety as a UX goal.** Most music apps assume wifi. GrooveLinx pre-caches everything for the gig because venue wifi is unreliable.
3. **Rehearsal intelligence as a structured artifact.** Plan → execute → review, with audio analysis built in. Most apps treat rehearsal as "the place where I happen to be when I open the app."

Pick **any one** of these for a 30-second elevator pitch. All three for a 3-minute demo.

## The weakest / confusing narratives

These should NOT anchor demos:

1. **"It does everything."** It doesn't, and the parts it doesn't do are obvious. Don't claim it.
2. **"It uses AI."** Demucs is signal processing; chord detection is classical DSP + a model; nothing is "AI" in the LLM sense. Don't use the word "AI" — it sets wrong expectations and invites the wrong questions.
3. **"It's for songwriters."** It's for performing bands. Songwriting is a different product.
4. **"It replaces your DAW."** It doesn't. It sits next to a DAW.
5. **"It does video."** It doesn't. Per the product story doc: "Not a recording studio."
6. **"Multitrack ingest is for musicians."** It's for operators. Drew runs it; band members don't.
7. **"Pocket Meter is the drummer's tool."** It's an experiment. Jay doesn't actually use it yet (08_PROMOTION_BACKLOG.md §3).

## What should disappear from demos

These currently appear in demos / app-tours but shouldn't:

- Pocket Meter (no clear payoff yet)
- Best Shot (emerging)
- ~~Stage Plot~~ — KEEP. Active Deadcetera daily/gig-flow workflow (reclassified 2026-05-14). Anchor in Gig Prep demos.
- Finances (half-built, misleading)
- Workbench (hidden by decision)
- Social page (dead)
- Ideas page (if Ideas/Feed converge, drop from demo immediately)

These either confuse testers, suggest functionality that's not there, or burn 30 seconds of demo time on something that doesn't strengthen the thesis.

## What should anchor demos

The **three anchor surfaces** that every demo should hit:

1. **Songs page → Song Detail (Chart lens).** Shows the library + the canonical chart. 30 seconds.
2. **Setlist → Stage View.** Shows the gig-day reality. 60 seconds.
3. **Rehearsal recording → analyzer timeline.** Shows the post-rehearsal review. 60 seconds.

Total demo: ~3 minutes. Hits every emotional beat. Avoids every confusing surface.

---

# Part II — Demo Path Definition

## §1 — Best current demo path (3-minute walkthrough)

For **first-time viewers** (potential testers, investors, curious musicians):

```
Step 1 — Open Home page                                           (10s)
  "This is where the band lands. See the now-focus widget,
   upcoming rehearsal, the song we agreed to work on."

Step 2 — Navigate to Songs                                        (15s)
  "Every song the band's working on. Status, key, capo, BPM.
   Tap a song."

Step 3 — Song Detail with Chart lens                              (45s)
  "Charts live here. Cached for offline. Tap the lens picker —
   here's the reference version (Spotify), here's the harmony
   isolation tool, here's the stems, here's the band notes."

Step 4 — Setlist page                                             (30s)
  "Setlists for upcoming gigs. Drag to reorder. Sections for
   sets and encores. Hit Prep for Gig — every chart, every
   reference, every metadata bit gets cached locally."

Step 5 — Live Gig Stage View                                      (30s)
  "Hit Launch. This is what the band sees during the show.
   Chart, key, capo, BPM. One song per screen. No wifi needed."

Step 6 — Rehearsal Mode + Analyzer                                (60s)
  "Pre-rehearsal: plan. During: hit record. Post: phone uploads,
   server analyzes, you get a timeline of every song that was
   worked. Tap a segment, save the chop, review later."

Step 7 — Close                                                   (10s)
  "That's it. Where bands lock in."
```

**Total: ~3 minutes.** Hits the three anchor surfaces. Skips all D-tier surfaces. Tells the strongest workflow story end-to-end.

## §2 — Best current real-band beta path (first-tester walkthrough)

For an **invited tester** in their first session — this is the path that earns their trust:

```
Phase 1 — Onboarding (5 min)
  - Drew has already added their email to members_index
  - Tester opens app → boot gate passes → lands on Home
  - Tester sees their band's slug at top
  - First impression: "I'm in. This is for me."

Phase 2 — Songs + Charts (10 min)
  - Tester adds 3-5 of their band's actual songs
  - For each: set key, capo, status (Learning / Working)
  - For one: paste a Spotify URL → North Star hydrates
  - For one: paste a chord chart → renders via ChartRenderer
  - First payoff: "Now my band's songs are in here."

Phase 3 — Setlist (10 min)
  - Build a setlist of 5 songs for a fake "upcoming gig"
  - Hit Prep for Gig
  - Show: Prep summary, retry path if anything fails
  - Open Stage View → see the chart for song #1
  - Second payoff: "I'd actually use this at a gig."

Phase 4 — Feedback (5 min)
  - Show: Beta Feedback FAB (enabled via localStorage flip per BETA_ONBOARDING_RUNBOOK.md)
  - Have them submit one piece of feedback (any category) as a test
  - Third payoff: "There's a way for me to tell Drew what's broken."

Phase 5 — Mobile (10 min)
  - Switch to their phone
  - Sign in → load their band's data → verify chart renders
  - Try Spotify Connect (if they have premium)
  - Test offline by airplane-moding mid-Stage-View
```

**Total: ~40 minutes.** Validates the entire A-tier surface set without surfacing any D-tier. Generates BETA_FEEDBACK_QUEUE.md inbound.

## §3 — Best current mobile-first flow

For testers / users primarily on iPhone or Android:

```
Step 1 — Sign in on phone
Step 2 — Add a song with key + Spotify URL (chart paste optional)
Step 3 — Open Song Detail → Chart lens → see chart
Step 4 — Tap Spotify Connect → reference plays on their device's Spotify
Step 5 — Build a 3-song setlist
Step 6 — Prep for Gig → wait for summary
Step 7 — Airplane mode → Stage View still works
Step 8 — Recover wifi → keep going
```

**The mobile flow is the truth flow.** GrooveLinx that doesn't work on phone is GrooveLinx that doesn't work. Every demo should end with phone-side validation.

## §4 — Worst current confusion traps

These are the **most likely points** where a tester gets stuck or confused:

### Trap 1 — Three places to start a rehearsal
- Home dashboard widget
- Rehearsal page direct
- Live Gig mode rehearsal-launch

**Why confusing:** Different entry points implicitly suggest different functionality.
**Mitigation in demo:** Show only the Rehearsal page entry. Don't even mention the others.

### Trap 2 — Lens density in Song Detail
- Band / Play Mode / Chart / North Star / Reference / Harmony / Notes / Stems

**Why confusing:** Each is well-built individually; the choice of default landing isn't obvious.
**Mitigation in demo:** Land on Chart lens always; mention you can switch to other views; don't enumerate all 8 lenses.

### Trap 3 — Ideas vs Feed vs Notifications
- Three communication surfaces with murky boundaries.

**Why confusing:** Testers ask "where does this kind of thing go?"
**Mitigation in demo:** Skip Ideas entirely. Show Feed only.

### Trap 4 — Playlists vs Setlists
- "Is this the gig setlist or just a playlist?"

**Why confusing:** Conceptually overlapping.
**Mitigation in demo:** Show Setlists only.

### Trap 5 — Harmony Lab discoverability
- Buried inside Song Detail → Harmony lens.

**Why confusing:** Vocalists hear "harmony tool exists" then can't find it.
**Mitigation in demo:** If demo'ing for a vocalist, navigate explicitly: Song Detail → lens picker → Harmony. Make the path visible.

### Trap 6 — Workbench
- Hidden but URL-reachable.

**Why confusing:** A tester who types `#workbench` lands on a weird page.
**Mitigation in demo:** Don't mention. Don't go to. Per Cutlist, this should HIDE explicitly.

### Trap 7 — Practice page
- Half-built.

**Why confusing:** Tester taps Practice → empty / partial state.
**Mitigation in demo:** Skip until §5 of 08_PROMOTION_BACKLOG.md ships.

### Trap 8 — Three "where am I" indicators
- currentPage / currentBandSlug / GLPlayerEngine queue / RehearsalSession

**Why confusing:** Not user-facing per se, but state can drift visually (e.g., player keeps showing a song after rehearsal ends).
**Mitigation in demo:** Don't dwell on edge cases. Let them play with it.

---

# Part III — Recommendations

The seven prompts from Operator Manual Phase 2 §7, answered directly.

## §1 — Top 5 things to HIDE from beta users

1. **`#workbench`** — confirmed hidden per Cutlist; verify it stays hidden.
2. **`#pocketmeter`** — no clear payoff per 08_PROMOTION_BACKLOG.md §3.
3. **`#finances`** — half-built; sets wrong expectations.
4. ~~`#stageplot`~~ — RECLASSIFIED 2026-05-14: Stage Plot is a Deadcetera-active workflow. KEEP visible. Not in the HIDE list.
5. **`#bestshot`** — EMERGING; no daily-use story yet.

**Bonus:** `#social` should be DELETED, not hidden (07_CUTLIST.md §1.1).

## §2 — Top 5 things to EMPHASIZE in demos / onboarding

1. **Stage View at the gig.** This is the magic moment.
2. **Prep for Gig truthful completion.** "Cached, offline-safe, honest about failures."
3. **Rehearsal analyzer timeline.** "We recorded last night, here's what got worked."
4. **Spotify Connect playback.** "Reference plays on YOUR Spotify, at YOUR volume."
5. **Per-band scoping.** "Your band's data is your band's data. No cross-band leakage."

## §3 — Most emotionally compelling workflow

> **Pre-gig Prep → Stage View at the venue.**

Drew has a real lived story: "I had no wifi at the venue. The app worked. Every chart was there. The band played the full set without anyone asking me anything."

That story is **emotional** because it removes anxiety at a moment when bands historically have maximum anxiety — gig night. It also happens to be the workflow that's most-hardened (Stab #12 truthful, Service Worker offline cache, ChartRenderer canonical).

This should be the one workflow Drew can demo with eyes closed.

## §4 — Most dangerous cognitive-overload area

> **Song Detail's 8 lenses.**

Band / Play Mode / Chart / North Star / Reference / Harmony / Notes / Stems.

Each individual lens is well-built. The aggregate is overwhelming. New testers don't know which to land on, and the default isn't always the most useful.

**Why dangerous:** Song Detail is the most-visited page in the app. If users get confused here, they get confused everywhere. The fragmentation here radiates outward.

**Mitigation paths:**
- Smart-default landing per song state (new song → Chart; familiar song → last-used lens)
- Hide rarely-used lenses behind a "more" affordance
- Per-mode lens visibility (Practice mode hides Stems, Performance mode hides Notes)

This is a future Operator Manual Phase 3 candidate.

## §5 — Most likely onboarding confusion

> **"Where do I add my band's songs?"** combined with **"How do I get the rest of my band in here?"**

Both have answers — Songs page → Add Song button; mailto-Drew for additional members — but neither answer is on-screen on first landing.

**Mitigation:** Pre-loaded sample songs (NICE-TO-HAVE in BETA_LAUNCH_CHECKLIST.md §11) + an explicit walkthrough card on first landing for new testers ("Welcome to your band. Add your first song." / "Want to add a bandmate? Email Drew.").

## §6 — Most likely "wow" moment

> **First time the tester opens Stage View on their phone, sees a chart for one of their own band's songs, and the BPM pill is color-coded and the key is right.**

This compresses every promise of the product into one screen. It's the moment "phone-first, band-centric, gig-safe" stops being a slogan and becomes a real artifact in their hand.

**Other wow moments (less universal):**
- Spotify Connect: "Wait, it's playing on MY Spotify?"
- Rehearsal analyzer: "It actually figured out where each song started?"
- Harmony Lab split mixer: "I can isolate the harmony part?"

But Stage View is the one that lands every time.

## §7 — Best candidate for future flagship feature

> **The closed rehearsal → review → practice → re-rehearsal loop** (`10_FUTURE_ROADMAP.md` §9).

Three reasons:

1. **It's the only thing that turns GrooveLinx from "tool" into "coach."** Every other roadmap item makes existing things better. This makes the product fundamentally different.
2. **All upstream pieces exist.** Rehearsal analyzer (mature). Practice page (emerging). Readiness scoring (mature). PracticeTask shape (memory-spec'd). The loop is closeable, not invent-able.
3. **It's defensible.** Once a band experiences "the app told me what to practice, I practiced it, next rehearsal I was ready" — they don't switch.

**Anti-candidates:** Avoid promoting Pocket Meter (no payoff path); Workbench (per memory: never new destinations); video integration (out of scope per product story).

---

## Appendix — Demo phrases that land

Tested phrases that consistently get nods from musicians when shown the app:

- "Every chart, on every phone, offline."
- "No more 'wait, what key?'"
- "Prep for Gig means I know what I have before I lose wifi at the venue."
- "It records the rehearsal and tells me which songs we actually worked."
- "Spotify Connect: the reference plays where you'd already be playing it."
- "It's not a DAW. It's the layer between rehearsal and gig."

## Appendix — Demo phrases that don't land

Phrases tested in past demos that confuse or under-perform:

- "AI-powered rehearsal." (Sets wrong expectations.)
- "The Spotify of band collaboration." (Wrong metaphor.)
- "It does everything." (Triggers skepticism.)
- "Multitrack ingest." (Operator concept; band members glaze over.)
- "It uses Demucs and Modal." (Tech-stack name-drop; nobody cares.)
- "It's like Google Drive for bands." (Underclaims what it actually does.)

---

## Closing principle

> Demo the workflow that closes the loop. Not the feature that's most clever.

Closed loops feel like products. Open loops feel like tech demos.

Stage View at the gig is a closed loop. So is Prep for Gig. So is the rehearsal recording → analyzer → save timeline path.

These are what GrooveLinx is.
