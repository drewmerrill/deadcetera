# GrooveLinx — User Journeys

_Build `20260514-142926`. Walk through the app from the perspective of each persona — what they touch, what they ignore, what frustrates them, where the product wins their trust._

Personas covered:

1. **Band Leader** (Drew himself — Deadcetera vocal/guitar)
2. **Drummer** (Jay — rhythm section, BPM-discipline focus)
3. **Bassist** (Brian — rhythm section, structure focus)
4. **Harmonist / Keys** (Pierce — second voice + keyboard)
5. **Beta Tester / Founding Member of another band**

---

## 1. Band Leader — Drew

### Daily / weekly cadence

> "Where's the band right now, what should we focus on, what's coming up?"

**Morning check (phone, 2 minutes):**
- Open app → lands on `#home`
- Glance at Now-focus widget (weak song? recent rehearsal? upcoming gig?)
- Skim recent rehearsal summary if there was a session last night
- Check Calendar for the week ahead

**Pre-rehearsal (laptop, 15 minutes):**
- `#rehearsal` → build a plan
- Pull songs from `#songs` filtered by `Learning` / `Working` status
- Set the order, estimate timing
- Hit publish — band members see it in Feed and via push notification

**During rehearsal (phone, hands-free where possible):**
- Launch Rehearsal Mode fullscreen
- Tap the song in the plan → Stage View opens
- Spotify Connect kicks off the reference at the right key/tempo
- After the song: tap "worked" / "needs more"
- End-of-rehearsal: stop recording → triggers analyzer → review later

**Post-rehearsal (laptop, 20 minutes):**
- `#rehearsal-intel` → review what we worked vs planned
- Open the analyzer timeline → label sections / save chops
- Cross-check readiness → see whose practice needs nudging
- Update the next rehearsal plan accordingly

**Pre-gig (laptop + phone, 30 minutes total):**
- `#setlists` → build the gig setlist
- Hit **Prep for Gig** → caches every chart for offline (Stab #12 truthful summary)
- Review any failed items → retry-only-failed
- Walk through Stage View song-by-song to spot-check

**At the gig (phone only, no wifi assumed):**
- Open the gig → Live Gig Mode launches Stage View
- Setlist scrolls; charts are cached, BPM/key/capo always visible
- Mid-set adjustments stick in the live setlist

### Where the leader wins
- Coordination cost drops massively — no more "Drew has the chart, text him"
- Rehearsal review actually surfaces what was missed
- Prep for Gig genuinely works offline now

### Where the leader struggles
- Three places to start rehearsal (Home widget vs Rehearsal page vs Live Gig launcher)
- Practice page is half-built — review→practice loop incomplete
- Lens density in Song Detail — even Drew sometimes lands on the wrong lens

---

## 2. Drummer — Jay

### Daily / weekly cadence

> "What's the tempo? What's the structure? Don't surprise me mid-song."

**Pre-rehearsal (phone, 5 minutes):**
- Push notification: "Rehearsal plan for Tuesday — 12 songs"
- Open Feed entry → tap into plan
- Glance at BPM zone for each song (color-coded pill)
- Tap any song where he doesn't remember the structure → Song Detail Chart lens

**During rehearsal:**
- Sets up phone on hi-hat stand
- Rehearsal Mode → Stage View shows BPM + structure
- Metronome pulls tempo from song → tap-to-pulse to confirm feel
- Drummer prep walkthrough surfaces structure cards if Drew enabled it

**Post-rehearsal:**
- Rarely opens the app. Maybe glances at recording if Drew asks.

**Pre-gig:**
- Same as pre-rehearsal but with more attention to segue notes ("this rolls into Friend of the Devil — no break").

**At the gig:**
- Phone on the floor tom
- Stage View per song → BPM pill is the main affordance
- If structure surprises happen, he taps the chart to see it

### Where Jay wins
- Tempo discipline: BPM is always visible and unambiguous
- Structure clarity: no more "wait, are we doing the bridge?"
- Drummer prep walkthrough makes new material approachable

### Where Jay struggles
- Pocket Meter is interesting but he doesn't use it — too experimental, no clear payoff yet
- Multitrack ingest is Drew's domain, not his — he doesn't need to touch it

---

## 3. Bassist — Brian

### Cadence

> "Where am I in this song, what key, what's the bass figure?"

**Pre-rehearsal:**
- Same as Jay — checks the plan, glances at keys, opens Charts for anything unfamiliar
- Particularly cares about Notes lens for any "bass does X here" reminders

**During rehearsal:**
- Phone clipped to mic stand
- Rehearsal Mode → Stage View → Chart lens

**At the gig:**
- Same as rehearsal but tighter — key + capo + chart must be one tap away

### Where Brian wins
- Charts cached for offline gig use (Stab #12)
- North Star reference helps him match the canonical bass feel

### Where Brian struggles
- Harmony Lab doesn't help him (it's vocal-focused)
- Stems lens occasionally useful for isolating the original bass, but he doesn't know how to find it on every device

---

## 4. Harmonist / Keys — Pierce

### Cadence

> "Which part am I singing? Can I practice the harmony with the lead muted?"

**Pre-rehearsal:**
- Plan check, like the others
- For any new harmony song: opens Harmony Lab
- Uses split mixer (vocals panned) to isolate the part
- Or uses LALAL.AI-split lead/backing if the song has it

**During rehearsal:**
- Stage View for charts + key
- Sometimes pulls up the recording from last rehearsal to remind himself how the take went

**Post-rehearsal:**
- Reviews own takes in Harmony Lab if Drew flagged a section

**At the gig:**
- Stage View only. Charts + key.

### Where Pierce wins
- Harmony Lab is genuinely useful for the prep work
- Split mixer + LALAL split = practice the part in isolation

### Where Pierce struggles
- **Harmony Lab is buried** — has to navigate Song Detail → Harmony lens to find it
- Many testers (not Pierce specifically) haven't found it at all
- Take review UX is OK but the export-a-good-take flow isn't crisp

---

## 5. Beta Tester — Founding Member of Another Band

### First-touch journey (Mode-B Phase 1)

> "What is this, will it work for MY band, and how do I get in?"

**Discovery (off-app):**
- Drew tells them about GrooveLinx in a band meeting or DM
- "Send me your email and I'll add you" — invite-by-mailto

**First visit (phone or laptop):**
- Lands on the production URL → boot membership gate runs
- Email not yet in members_index → Mode-B welcome overlay appears
- Sees: "GrooveLinx is currently invitation-only..." with "I have an invite" button
- Clicks "I have an invite" → reveals hidden mailto panel with email-Drew link
- Email Drew → Drew manually adds to `bands/{slug}/meta/members/`

**Second visit:**
- Reloads → boot gate passes → lands on `#home`
- Beta Feedback FAB appears bottom-right (dev shell + roster gate)
- Welcome state — home is empty / has skeleton data
- Drew may have pre-loaded their band with a few starter songs or sample setlists

**Exploration (15-30 min):**
- Pokes around Songs, Setlists, Rehearsal
- Likely confused by:
  - Why is there a Playlists page AND a Setlists page?
  - Where's the harmony tool I heard about? (it's in Song Detail)
  - What's the difference between Ideas / Feed / Notifications?

**First "real" use:**
- Adds 3-5 of their own band's songs
- Tries to add charts → discovers chart import
- Maybe attempts a rehearsal plan
- Most likely friction: getting other band members added — they can't self-onboard

**Feedback path:**
- Hits a confusion → taps Beta Feedback FAB
- Picks category (confusion / bug / mobile / etc.) + free text
- Submits → lands in `bands/{slug}/feedback_reports/` with `[confusion]` tag
- Drew reviews via BETA_FEEDBACK_QUEUE.md workflow

### Where the tester wins
- The welcome overlay is gentle, not "ACCESS DENIED"
- Feedback FAB is one tap, not "go find Drew's email"
- Once in, the app works on their phone with their band's data

### Where the tester struggles
- **No self-serve band creation** — they're dependent on Drew for every roster add
- **No band-switching UI** — if Drew accidentally adds them to two bands, behavior is undefined
- **Mode-B Phase 1 is invite-only by design** — Phase 2 (Worker-backed code redemption) deferred
- **Onboarding-pace is admin-mediated** — bottleneck = Drew

### What the tester journey reveals
- Beta Ops Task #01 (runbook) exists specifically to script the first tester through this journey
- The first tester's friction will populate BETA_FEEDBACK_QUEUE.md
- Pace of redemption (Phase 2) is gated on volume of inbound interest

---

## Cross-persona summary

| Persona | Daily app time | Primary surfaces | Biggest friction |
|---|---|---|---|
| Leader (Drew) | 30-60 min/day | Home, Songs, Rehearsal, Setlists, Intel | Lens density, three-rehearsal-entrypoints |
| Drummer (Jay) | 5-15 min/rehearsal | Plan, Stage View, BPM pill | Pocket Meter unclear payoff |
| Bassist (Brian) | 10-20 min/rehearsal | Plan, Chart lens, Notes | Stems lens not on the path |
| Harmonist (Pierce) | 10-30 min/rehearsal+prep | Plan, Harmony Lab, Chart | Harmony Lab is buried |
| Beta tester | 15-45 min first session | Home, Songs, Beta FAB | Band-switching, self-serve onboarding |

---

## Journey patterns the product gets right

1. **Phone-first, no-wifi gig safety** — every persona uses the app at the gig, every persona's needs are cached offline via Prep for Gig.
2. **Stage View as the great equalizer** — every persona converges on the same surface during performance: BPM, key, capo, chart. One job per screen.
3. **Push notifications drive coordination** — pre-rehearsal plan notifications get rhythm-section members to check the plan before showing up.
4. **Feedback FAB closes the learning loop for beta testers** — friction → tap → caught.

## Journey patterns the product still gets wrong

1. **Discoverability of Harmony Lab** — Pierce knows where it is; new harmony singers won't.
2. **Three-entrypoint rehearsal** — Drew can navigate it; new leaders will pick the wrong one.
3. **Practice page incompleteness** — every persona has a practice-mental-model but the page doesn't yet support it.
4. **Multi-band testers** — gracefully handling testers in 2+ bands is unsolved.
5. **The leaderless band** — every workflow assumes there IS a band leader. Co-led / leaderless bands aren't a designed-for case.
