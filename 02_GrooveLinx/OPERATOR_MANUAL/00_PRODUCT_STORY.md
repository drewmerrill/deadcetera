# GrooveLinx — Product Story

_Author's note: written in plain English, for a musician's ear. Code language only when unavoidable. Reflects build `20260514-142926`._

---

## What GrooveLinx is trying to be

GrooveLinx is a **band-rehearsal and performance intelligence system** that lives in a phone or laptop browser. It's not a recording studio. It's not a sheet-music library. It's not a streaming service. It sits in the **gap between rehearsal and gig** — the place where bands today use a tangled mix of Google Drive folders, group texts, paper setlists, YouTube playlists, and notebooks-in-someone's-handwriting that nobody can find when the drummer asks "what's our tempo on this one again?"

The product belief: **bands lose more time and trust to bad coordination than to bad musicianship.** GrooveLinx aims to be the layer where everything a band agrees on — the chart, the key, the tempo, the segue, the lead singer for tonight, the version they're playing, the gig venue, the setlist order — lives in one place, accessible to every member, on their phone, **at the gig**, with **no wifi**.

The motto in the codebase is "where bands lock in." That's the emotional goal.

---

## Who it's for

| Persona | What they need | How GrooveLinx serves them |
|---|---|---|
| **The band leader** (Drew) | A coordinated band that shows up prepared. Wants visibility into who knows what. | Song-readiness dashboards, rehearsal planning, gig prep tools, setlist management. |
| **The rhythm section** (Jay, Brian) | Tempo discipline + structure clarity. No surprises mid-song. | BPM zones with tap-to-pulse, drummer prep walkthroughs, structure cards in stage view. |
| **The harmonist / second voice** (Pierce) | Knowing which part to sing on each tune. Practicing splits. | Harmony Lab with split mixer, lead/backing isolation. |
| **The lead vocalist + guitarist** (Drew himself) | Charts always available, key + capo info on every song, smooth playback for sing-alongs at rehearsal. | Song Detail's chord chart, lens system, Spotify Connect playback. |
| **Founding members of other bands** (beta) | "Will this work for MY band? Is it just Deadcetera's tool?" | Mode-B onboarding gate, beta feedback FAB, band-isolated data. |

---

## The five emotional goals

1. **No more "wait, what key?"** Every song's key + capo + tempo are one tap away from every device.
2. **No more "Drew has the chart, text him."** Charts live in GrooveLinx, cached for offline gig use via Prep for Gig.
3. **No more "I thought we were playing the Dead version, not the Phish version."** The North Star lens records the canonical reference version per song.
4. **No more "what's the order again?"** Setlists are shared, live-updated, and survive into Live Gig mode for the actual performance.
5. **No more "I have no idea how rehearsal went."** Rehearsal analyzer extracts song segments, identifies what was worked, surfaces readiness changes.

---

## What musician pain points it addresses

| Pain point | GrooveLinx response |
|---|---|
| "Where's the chart for this song?" | Song Detail → Chart lens. Cached offline via Prep for Gig. |
| "What key are we doing it in tonight?" | Song-level `key` field + capo stamp, visible on Songs, Song Detail, Stage View. |
| "What's the BPM? Wait, faster or slower than last time?" | BPM pill on the song, tempo-zone color coding, drummer prep BPM walkthrough. |
| "We agreed to learn that song last rehearsal but I forgot which one." | Rehearsal session record + `songsWorked` field. Surfaced in Home dashboards. |
| "Did I practice that section enough?" | Practice tracking + readiness scoring (per-member, per-song). |
| "What recording were we trying to match?" | North Star lens — saves Spotify/YouTube/Apple Music references with hydrated metadata. |
| "Can I please not lose my recording from rehearsal?" | Rehearsal recording upload + analyzer + saved timelines + multitrack. Stab #14 made stem jobs survive tab close. |
| "Will I have internet at the gig venue?" | Prep for Gig pre-caches every chart + metadata to localStorage. (Stab #12 made it truthful.) |
| "Two people are pushing play at once — chaos." | Stab #07 `pauseAll()` arbitration enforces single-owner playback. |
| "Help, my band's data leaked into another tester's session." | Band isolation via `currentBandSlug` + Firebase rules. Stab #02 closed the SWR-clobber vector. |

---

## Primary differentiators

What GrooveLinx does that nothing else on the market does together:

1. **Band-as-first-class-citizen data model.** Other apps are user-centric ("my songs"). GrooveLinx is band-centric ("our songs, our setlists, our rehearsal history"). Roster + role + readiness baked in.
2. **Rehearsal intelligence as a first-class surface.** Most apps treat rehearsal as "the place where I happen to be when I open the app." GrooveLinx treats rehearsal as a structured artifact: plan → execute → review.
3. **Offline gig safety as a UX goal.** Most music apps assume you have wifi. GrooveLinx's Prep for Gig pre-caches everything because venue wifi is unreliable and Drew has lost a chart at a real gig.
4. **Audio-aware analytics.** Rehearsal Analyzer extracts song segments via DSP + chord detection + embeddings. Multitrack ingest converts X32 SD cards into per-instrument stems. Stem separation via Modal HT-Demucs.
5. **The Spotify Connect path on iOS.** The SDK is unusable on iOS; GrooveLinx drives the user's actual Spotify app via REST — playback "just works" at the volume they expect.

---

## Current strongest workflows

Ranked from most-coherent to most-fragmented:

| # | Workflow | Why it works |
|---|---|---|
| 1 | **Song Detail → Chart lens → cached for gig** | Solo path, single canonical owner (`ChartRenderer` via Stab #05), Prep-for-Gig (Stab #12) makes it truthful. Beta-tested heavily by Drew. |
| 2 | **Setlist build → Live Gig launch** | `setlists.js` is well-formed, `live-gig.js` is the dominant performance overlay, navigation between them is clean. |
| 3 | **Rehearsal recording → server analyze → save timeline → review** | Modal-backed analysis pipeline + chopper persistence works end-to-end. Bug #8 (silent Load button) is the known hole. |
| 4 | **Multitrack ingest from X32 SD card** | New wizard (`multitrack-rehearsal.js`), Stab #13 made upload abort honest. End-to-end clean. |
| 5 | **Spotify Connect playback on iOS** | Stab #08 chokepoint + Stab #07 pauseAll arbitration. Iron-clad. |

---

## Current weakest workflows

| # | Workflow | What's fragmented |
|---|---|---|
| 1 | **Onboarding** | Mode-B Phase 1 just landed — invite-by-mailto only, no self-serve redemption. Existing testers have one-band-per-email constraint per duplicate-band bug. |
| 2 | **Practice page** | `practice.js` exists but Practice Task system (per `project_practice_task.md`) is partially built. The review→practice loop isn't fully closed. |
| 3 | **Workbench** | Experimental fullscreen view per Audit #05; 10+ programmatic callers but no nav entry. Router bug noted (K2). Hidden from end users today. |
| 4 | **Harmony Lab** | Powerful (split mixer + take review + LALAL lead/backing) but the entry point is buried inside Song Detail's lens system. Many testers haven't found it. |
| 5 | **Calendar / Gigs / Venues / Schedule** | Three distinct pages with overlapping concepts. Calendar sync (Google) is mature, but the relationship between Gigs, Calendar Events, and Setlists is implicit. |

---

## Where the app still feels fragmented

Be honest. These are the places where a new tester would say "wait, where does this live?":

1. **Three places to start a rehearsal** — Home dashboard widget, the Rehearsal page itself, and rehearsal-mode launched from Live Gig. The "right" entry point depends on whether you're planning or executing.
2. **Lens explosion in Song Detail** — Band / Play Mode / Stems / Harmony / North Star / Reference / Notes. Each is well-built individually; the choice of which lens to land on by default isn't obvious.
3. **Setlist editing vs Live Gig vs Stage View** — Three modes of looking at the same setlist data. Edit in one place, perform in another, summarize in a third. The transitions are clean but the conceptual map is dense.
4. **Multiple "where I am in the app right now" indicators** — currentPage (navigation), currentBandSlug (auth), GLPlayerEngine queue (audio), Rehearsal session (live state). Mostly canonical now after Stab #03 + C2 Phase 2 but the mental model is still 4-dimensional.
5. **Ideas / Polls / Band Feed / Notifications** — Four conceptually-overlapping communication surfaces. Audit #02 found `band-feed` had 20+ unowned reads before C5 Phase 1; ownership is now canonical, but the user-facing distinction "Is this an idea or a poll or a feed post?" is still murky.

---

## The core product philosophy

Stated as plainly as possible:

> **Every piece of band knowledge should live where every band member can find it, on the device in their pocket, offline if needed.**

That's it. Everything else — the audio engines, the chart renderers, the readiness math, the rehearsal analyzer, the Spotify Connect plumbing — is in service of that one sentence.

The product is "won" when a band leader can show up to rehearsal without their notebook, hand every band member a phone, and the rehearsal runs the same way it would have if everyone had spent the prior 3 days memorizing the plan.

---

## What this manual covers

- **00_PRODUCT_STORY.md** (this file) — the why
- **01_CORE_WORKFLOWS.md** — what musicians actually do, step by step
- **02_FEATURE_CATALOG.md** — every feature in the codebase, by name
- **03_PAGE_GUIDE.md** — every visible page + route
- **04_USER_JOURNEYS.md** — by persona (leader / drummer / harmonist / vocalist / beta tester)
- **05_HIDDEN_SYSTEMS.md** — what Drew may have forgotten exists
- **09_MVP_VS_EXPERIMENTAL.md** — what's load-bearing vs what's experimental
- **GROOVELINX_SYSTEM_MAP.md** — ASCII map of how everything connects
