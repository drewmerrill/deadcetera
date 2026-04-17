# GrooveLinx Feature Value Matrix

_Created: 2026-04-17_
_Framework: Usage Frequency × User Value When Needed_

---

## Scoring Framework

**Usage Frequency** (how often a band member opens this)
- **Daily**: Every session or most sessions
- **Weekly**: A few times per week
- **Event-driven**: Before/during/after specific events (gig, rehearsal, new venue)
- **Rare**: A few times per year or setup-only

**User Value When Needed** (how much it matters when you DO use it)
- **Critical**: Can't do the job without it. Blocks real-world outcomes.
- **High**: Significantly improves workflow or decision quality.
- **Medium**: Nice to have, saves some time.
- **Low**: Marginal utility, could use a spreadsheet or notes app.

---

## Complete Feature Matrix

### CORE NAV (always visible — no changes)

| Feature | Frequency | Value | Classification | Notes |
|---------|-----------|-------|---------------|-------|
| Home | Daily | Critical | **Core Nav** | Command center. Every session starts here. |
| Songs | Daily | Critical | **Core Nav** | Library is the foundation of everything. |
| Rehearsal | Weekly | Critical | **Core Nav** | Core workflow: plan → run → review. |
| Schedule | Weekly | Critical | **Core Nav** | When things happen. Google Calendar sync. |
| Setlists | Event-driven | Critical | **Core Nav** | What you play. Directly affects gig quality. |

### SECONDARY FEATURES (currently in tools drawer)

| Feature | Frequency | Value | Classification | Contextual Moment | Drawer Position |
|---------|-----------|-------|---------------|-------------------|-----------------|
| **Gigs** | Event-driven | Critical | **Promote → contextual** | When viewing a gig on Schedule; from Home "upcoming gig" card | Top of drawer |
| **Band Room** | Weekly | High | **Promote → contextual** | From Home when band decisions pending; badge-driven | Top of drawer |
| **Feed** | Weekly | Medium | **Merge into Home** | Activity stream replaces standalone Feed page | Top of drawer |
| **Practice** | Daily | High | **Promote → contextual** | Inline on Songs page; from Home focus songs | Top of drawer |
| **Pocket Meter** | Event-driven | Critical | **Keep in drawer** | During rehearsal/practice — needs mic access, full focus | High in drawer |
| **Tuner** | Event-driven | Critical | **Keep in drawer** | Before rehearsal/gig — quick access, then done | High in drawer |
| **Metronome** | Event-driven | High | **Keep in drawer** | During practice — tempo reference | High in drawer |
| **Stage Plot** | Rare | Critical | **Keep in drawer** | Before a gig at a new venue. Blocks sound check. | Mid drawer |
| **Best Shot** | Rare | High | **Keep contextual** | After rehearsal session review — compare recordings | Mid drawer |
| **Venues** | Rare | High | **Keep in drawer** | When booking a new gig, planning logistics | Mid drawer |
| **Playlists** | Weekly | Medium | **Keep in drawer** | During personal practice — reference listening | Mid drawer |
| **Equipment** | Rare | Medium | **Keep in drawer** | Gear inventory for insurance, load-in lists | Low drawer |
| **Finances** | Rare | Medium | **Keep in drawer** | After gigs — split payouts, track expenses | Low drawer |
| **Notifications** | Rare | Medium | **Keep in drawer** | Pre-gig care packages, SMS to band | Low drawer |
| **Social Media** | Rare | Low | **Archive candidate** | Links to platforms — no real integration | Bottom of drawer |
| **Contacts** | Rare | Medium | **Merge into Venues** | Booking contacts = venue contacts | Remove (merge) |
| **Help** | Rare | Medium | **Keep accessible** | ? icon in top bar — not a drawer item | Remove from drawer |

### SETTINGS (gear icon)

| Tab | Frequency | Value | Classification |
|-----|-----------|-------|---------------|
| Profile | Rare | High | **Keep visible** |
| Band | Rare | Critical | **Keep visible** |
| Data | Rare | Medium | **Keep visible** |
| Notifications | Rare | Medium | **Keep visible** |
| About | Rare | Low | **Keep visible** |
| UAT | Rare | Dev-only | **Hidden (gl_dev_mode)** |
| Bugs | Rare | Dev-only | **Hidden (gl_dev_mode)** |
| Plan | Rare | Dev-only | **Hidden (gl_dev_mode)** |

---

## Classification Actions

### Promote → Contextual (surface at the right moment)

| Feature | Where It Surfaces | Trigger |
|---------|------------------|---------|
| **Gigs** | Schedule page context rail | User taps a gig event on calendar |
| **Gigs** | Home "upcoming gig" card | Gig within 7 days |
| **Practice** | Songs page — inline button per song | Always visible on song rows |
| **Practice** | Home focus songs section | Tap focus song → practice flow |
| **Band Room** | Home — badge or section | Pending polls/votes |
| **Best Shot** | Rehearsal session review | "Compare with best" link per song |

### Keep in Drawer (ordered by combined frequency × value)

1. Pocket Meter (event-driven × critical)
2. Tuner (event-driven × critical)
3. Metronome (event-driven × high)
4. Stage Plot (rare × critical)
5. Venues (rare × high)
6. Playlists (weekly × medium)
7. Equipment (rare × medium)
8. Finances (rare × medium)
9. Notifications (rare × medium)
10. Social Media (rare × low)

### Merge

| Feature | Into | Rationale |
|---------|------|-----------|
| Contacts | Venues | Same data: people + places for gigs. One page. |
| Feed | Home activity stream | "What's New" replaces standalone feed as primary surface. Feed page stays accessible for deep dive. |

### Archive Candidate (only if truly unused AND low-cost to maintain)

| Feature | Condition | Action if met |
|---------|-----------|---------------|
| Social Media | <3 visits in 30 days across all band members AND no content created | Move to Settings sub-tab, not drawer |

**No other features should be archived.** Stage Plot, Equipment, Finances, Best Shot — all stay. They're infrequent but valuable when needed.

---

## Smarter Metrics

### Replace "cut after 2 weeks" with this:

Track per feature:
1. **Visit count** (page views via `logPageView`)
2. **Action count** (did user DO something on the page, not just view)
3. **Time on page** (rough: log entry/exit timestamps)
4. **Contextual discovery** (was feature accessed via drawer, contextual link, or direct URL)

### Decision framework after 2 weeks:

| Visit Count | Action Rate | Decision |
|-------------|------------|----------|
| High visits, high actions | **Promote** to contextual or core |
| High visits, low actions | **Improve** the page (users want it but can't act) |
| Low visits, high actions | **Keep in drawer** (niche but valuable) |
| Low visits, low actions | **Reposition** (better contextual trigger or merge) |
| Zero visits, zero actions | **Archive only if** maintaining it costs effort |

### What to track in `logPageView`:

```javascript
GLStore.logPageView(page)        // already wired
GLStore.logPageAction(page, action)  // NEW — track meaningful actions
```

Actions to track:
- Songs: `song_selected`, `readiness_rated`, `practice_started`
- Setlists: `setlist_created`, `setlist_edited`, `song_added`
- Schedule: `event_created`, `event_edited`, `gig_viewed`
- Rehearsal: `rehearsal_started`, `plan_created`, `session_reviewed`
- Gigs: `gig_created`, `gig_edited`
- Stage Plot: `plot_created`, `plot_edited`
- Finances: `transaction_added`
- Equipment: `item_added`

---

## Contextual Surfacing Moments

### When to surface niche tools automatically:

| Moment | Tool to Surface | How |
|--------|----------------|-----|
| Gig created with new venue | Stage Plot | "Set up your stage plot for [venue]?" toast |
| Gig within 48 hours | Setlist + Stage Plot + Contacts | Home card: "Gig prep: set locked? stage plot ready?" |
| Rehearsal starting | Tuner + Pocket Meter | Floating toolbar during rehearsal mode |
| Song has no readiness data | Practice | "Rate your readiness" prompt on song detail |
| Post-gig (day after) | Finances | "Log your payout from [venue]?" nudge on Home |
| First time at venue | Venues | "Save venue details for next time?" after gig |
| Recording analyzed | Best Shot | "Compare with your best take?" in session review |
| Care package not sent, gig in 3 days | Notifications | "Send charts to the band?" nudge |

---

## Revised Drawer Ordering

Current: alphabetical-ish.
Proposed: value-weighted, with section dividers.

```
QUICK TOOLS
  ⏱  Pocket Meter    Live BPM detection
  🎸 Tuner           Tune your instrument
  🥁 Metronome       Click track

BAND
  🎤 Gigs            Shows and performances
  💬 Band Room       Ideas, votes, decisions
  📧 Feed            Action items and assignments
  🎯 Practice        Focus songs and mixes

PLAN & PREP
  🎭 Stage Plot      Stage layout builder
  🏛  Venues          Locations and contacts
  🎧 Playlists       Listening and learning
  🏆 Best Shot       Performance comparisons

ADMIN
  🎛  Equipment       Gear inventory
  💰 Finances        Income and expenses
  🔔 Notifications   SMS and care packages
  📱 Social Media    Social links
```

---

## No Reckless Pruning — The Rule

**A feature is valuable if a band would miss it at the worst possible moment.**

- Stage Plot: sound check at a new venue with no layout → chaos
- Equipment: insurance claim after gear theft → need serial numbers
- Finances: tax time, band disagreement about money → need records
- Best Shot: band argues about whether a song is ready → play the recordings
- Contacts: need sound engineer's number at 4pm day of show → critical

**None of these should be removed.** They should be easy to find when you need them and invisible when you don't. That's what the drawer + contextual surfacing achieves.
