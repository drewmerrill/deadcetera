# GrooveLinx — Page Guide

_Build `20260514-142926`. Every visible page + route in the app. Pulled from `js/ui/navigation.js` (`pageRenderers` + `_HASH_VALID_PAGES`)._

## How routing works

- Primary mechanism: `showPage(pageKey)` in `js/ui/navigation.js`
- Hash-based: every page maps to `#pageKey`
- `pageRenderers` is the registry — every page in this guide has a renderer entry
- `_HASH_VALID_PAGES` is a superset including some non-renderer routes (songs, home, etc. which render via legacy paths)
- `GL_PAGE_READY` signal is `_navSeq`-guarded (Stab #03 / system lock)

## Page maturity legend

| Tag | Meaning |
|---|---|
| **CORE** | Daily-use, load-bearing |
| **MATURE** | Production-grade but secondary |
| **EMERGING** | Working, not in primary flows |
| **EXPERIMENTAL** | Hidden / behind a flag |
| **DORMANT** | Wired but not in nav |

---

## Primary navigation pages

### `#home` — Home Dashboard
- **Maturity:** CORE
- **Renderer:** legacy `home.js` (path via showPage)
- **Purpose:** Landing surface — "what should the band care about right now."
- **What's on it:** Now-focus widget, recent rehearsal summary, upcoming gigs, song readiness highlights.
- **Listens for:** `focusChanged` event (system lock — see CLAUDE.md).
- **Friction:** Three places to start a rehearsal from here (widget / direct nav / live-gig launcher).

### `#songs` — Songs Library
- **Maturity:** CORE
- **Renderer:** `songs.js`
- **Purpose:** Every song the band has on the books.
- **Filters:** Status, key, BPM, last-rehearsed, readiness.
- **Actions:** Open Song Detail, change status, set canonical key/capo.
- **Listens for:** `focusChanged` event.

### `#song/{id}` — Song Detail
- **Maturity:** CORE
- **Renderer:** `song-detail.js`
- **Purpose:** Everything-about-this-song surface.
- **Lenses:** Band · Play Mode · Chart · North Star · Reference · Harmony · Notes · Stems
- **Notes:** Lens choice is dense — see fragmentation notes in `00_PRODUCT_STORY.md`.

### `#setlists` — Setlists
- **Maturity:** CORE
- **Renderer:** `setlists.js`
- **Purpose:** Build, edit, share setlists for upcoming gigs.
- **Actions:** Create, reorder, section, share via link, **Prep for Gig** (Stab #12 — truthful completion).
- **Stage View slot:** `<div id="slPrepGigSummary">` for Prep-for-Gig summary panel.
- **Cross-links to:** `#live-gig` (perform), `#gigs` (gig assignment).

### `#playlists` — Playlists
- **Maturity:** EMERGING
- **Renderer:** `playlists.js`
- **Purpose:** Separate from setlists — reference playlists, learning queues.
- **Confusion point:** Relationship to setlists isn't crisp; testers ask "is this the gig setlist or just a playlist?"

### `#practice` — Practice
- **Maturity:** EMERGING
- **Renderer:** `practice.js`
- **Purpose:** Personal/band practice planning.
- **Practice Task system:** Partially built per `project_practice_task` memory.
- **Friction:** Review→practice loop not fully closed yet.

### `#rehearsal` — Rehearsal
- **Maturity:** CORE
- **Renderer:** `rehearsal.js`
- **Purpose:** Plan + execute rehearsals.
- **Cross-links to:** Rehearsal Mode fullscreen overlay (`rehearsal-mode.js`).
- **Owns:** `GLStore.RehearsalSession` (C2 Phase 1 canonical).

### `#rehearsal-intel` — Rehearsal Intelligence
- **Maturity:** EMERGING
- **Renderer:** `rehearsal-intel.js`
- **Purpose:** Cross-rehearsal pattern surfacing — what's been worked, what's gone cold.
- **Status:** Working but not the primary review path.

### `#calendar` — Calendar
- **Maturity:** MATURE
- **Renderer:** `calendar.js`
- **Purpose:** Calendar view of band events.
- **Integrations:** Google Calendar sync (selected calendars only — per `project_calendar_filtering`).

### `#gigs` — Gigs
- **Maturity:** MATURE
- **Renderer:** `gigs.js`
- **Purpose:** Gig records — venue, date, setlist, set length.
- **Cross-links to:** Setlist, Venue.

### `#venues` — Venues
- **Maturity:** MATURE
- **Renderer:** `venues.js`
- **Purpose:** Venue catalog — notes about load-in, parking, PA.

### `#finances` — Finances
- **Maturity:** EMERGING
- **Renderer:** `finances.js`
- **Purpose:** Gig income / expense tracking per band.

---

## Communication pages

### `#feed` — Band Feed
- **Maturity:** MATURE
- **Renderer:** legacy `band-feed.js` (path-routed)
- **Purpose:** Band-internal social feed.
- **Owner:** `GLBandFeedStore` (canonical, C5 Phase 1).

### `#ideas` — Ideas
- **Maturity:** EMERGING
- **Renderer:** `ideas.js`
- **Purpose:** Idea / suggestion capture.
- **Confusion:** Relationship to Feed/Polls is murky.

### `#notifications` — Notifications
- **Maturity:** MATURE
- **Renderer:** `notifications.js`
- **Purpose:** Notification history.
- **Backed by:** 3-layer notification system (banner + FCM + Twilio SMS).

### `#social` — Social
- **Maturity:** DORMANT
- **Renderer:** `social.js`
- **Purpose:** Predates Band Feed, kept showing up in nav historically.
- **Note:** Probably can be removed in a future cleanup phase.

---

## Tools & utilities

### `#tuner` — Tuner
- **Maturity:** MATURE
- **Renderer:** `tuner.js`
- **Purpose:** In-app chromatic tuner.

### `#metronome` — Metronome
- **Maturity:** MATURE
- **Renderer:** `metronome.js`
- **Purpose:** Tap-to-set, song-linkable click.

### `#pocketmeter` — Pocket Meter
- **Maturity:** EMERGING
- **Renderer:** `pocketmeter.js`
- **Purpose:** Drummer pocket/groove visualization.

### `#bestshot` — Best Shot
- **Maturity:** EMERGING
- **Renderer:** `bestshot.js`
- **Purpose:** Track-your-best-take tool.
- **Stab #11 Q.8:** `pageshow.persisted` AudioContext resume for bfcache.

---

## Roster / Equipment / Logistics

### `#equipment` — Equipment
- **Maturity:** EMERGING
- **Renderer:** legacy `equipment.js`
- **Purpose:** Gear catalog per member.

### `#contacts` — Contacts
- **Maturity:** EMERGING
- **Renderer:** legacy `contacts.js`
- **Purpose:** Venue / booker / agent contacts.

### `#stageplot` — Stage Plot
- **Maturity:** EMERGING
- **Renderer:** `stageplot.js`
- **Purpose:** Stage diagram per venue/gig.

---

## Hidden / admin pages

### `#admin` — Admin
- **Maturity:** EXPERIMENTAL
- **Renderer:** `admin.js`
- **Purpose:** Per-band admin dashboard. Hidden from end users.
- **Access:** Currently surface-by-default unless gated by role check.

### `#workbench` — Workbench
- **Maturity:** EXPERIMENTAL
- **Renderer:** legacy workbench module
- **Purpose:** Fullscreen experimental view per Audit #05.
- **Status:** 10+ programmatic callers, no nav entry, K2 router bug noted.
- **Decision:** Hidden from end users today.

### `#help` — Help
- **Maturity:** MATURE
- **Renderer:** `help.js`
- **Purpose:** In-app help / shortcut reference.

---

## Modes (not pages — fullscreen overlays)

These are full-screen UX modes that exist on top of pages, not as routes:

| Mode | Trigger | Owner | Purpose |
|---|---|---|---|
| **Rehearsal Mode** | From Rehearsal page or Home widget | `rehearsal-mode.js` | The actual in-rehearsal driving surface |
| **Live Gig Mode** | From Setlist or Gig | `live-gig.js` | Performance-mode overlay; Stage View per song |
| **Song Drawer** | Song-row tap | `song-drawer.js` | Bottom-sheet quick-access |
| **Welcome Overlay (Mode-B)** | Boot-time gate block | `app.js` `_glShowNotAuthorizedOverlay` | Soft "I have an invite" surface |

---

## Route summary table

| Route | Page name | Maturity | Daily use? |
|---|---|---|---|
| `#home` | Home | CORE | Yes |
| `#songs` | Songs Library | CORE | Yes |
| `#song/{id}` | Song Detail | CORE | Yes |
| `#setlists` | Setlists | CORE | Yes |
| `#playlists` | Playlists | EMERGING | Sometimes |
| `#practice` | Practice | EMERGING | Aspirational |
| `#rehearsal` | Rehearsal | CORE | Yes |
| `#rehearsal-intel` | Rehearsal Intel | EMERGING | Sometimes |
| `#calendar` | Calendar | MATURE | Yes |
| `#gigs` | Gigs | MATURE | Yes |
| `#venues` | Venues | MATURE | Sometimes |
| `#finances` | Finances | EMERGING | Rare |
| `#feed` | Band Feed | MATURE | Yes |
| `#ideas` | Ideas | EMERGING | Sometimes |
| `#notifications` | Notifications | MATURE | Yes |
| `#social` | Social | DORMANT | No |
| `#tuner` | Tuner | MATURE | Sometimes |
| `#metronome` | Metronome | MATURE | Sometimes |
| `#pocketmeter` | Pocket Meter | EMERGING | Rare |
| `#bestshot` | Best Shot | EMERGING | Rare |
| `#equipment` | Equipment | EMERGING | Sometimes |
| `#contacts` | Contacts | EMERGING | Sometimes |
| `#stageplot` | Stage Plot | EMERGING | Rare |
| `#admin` | Admin | EXPERIMENTAL | Hidden |
| `#workbench` | Workbench | EXPERIMENTAL | Hidden |
| `#help` | Help | MATURE | Onboarding |

**Total surfaced routes:** 26 user-visible + 2 hidden (admin, workbench) = 28 page-level routes.

---

## What's NOT a page (architectural notes)

- **GLStore RehearsalSession** — state, not a page. The Rehearsal page reads/writes it.
- **GLPlayerEngine** — audio core, not a page. Every audio-playing page calls it.
- **ChartRenderer** — single canonical renderer. Surfaces in Song Detail, Stage View, and rehearsal walkthrough.
- **Beta Feedback FAB** — overlay, not a page. Floats on every page when gated in.
- **Runtime Health Overlay** — dev-only HUD, not a page.

---

## Open questions / page-level fragmentation

1. **Playlists vs Setlists** — when does a user choose one or the other? Conceptual map is missing.
2. **Schedule vs Calendar** — both exist, both show band time. Relationship is implicit.
3. **Rehearsal vs Rehearsal-Intel** — one is "the thing you do," other is "what we learned." Needs more visible bridge.
4. **Feed vs Ideas vs Notifications** — three communication surfaces, no clear "this kind of thing goes here" rule.
5. **Workbench reachability** — built but not in nav. Either ship as a real route or remove the 10+ callers.
