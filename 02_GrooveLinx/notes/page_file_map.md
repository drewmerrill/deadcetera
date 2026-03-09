# GrooveLinx Page-to-File Map
Version: 1.1 — Phase 2 Baseline

Purpose: Working map of visible app screens, owning files, Firebase paths, and key globals so UAT can be performed methodically and bugs can be routed to the right file immediately.

This is a living document. Update it whenever a page, component, or file ownership changes.

---

# How to Use This Document

For each visible screen:
- What file controls this page?
- Where should a bug be fixed?
- What data does this page depend on?

Every bug report should identify: visible page name · likely owning file · supporting file if relevant.

---

# Core Infrastructure

| File | Role | Notes |
|---|---|---|
| `js/core/utils.js` | sanitizeFirebasePath, toArray, shared helpers | |
| `js/core/firebase-service.js` | bandPath(), songPath(), loadBandDataFromDrive, saveBandDataToDrive, loadMasterFile | Canonical Firebase interface |
| `js/core/groovelinx_store.js` | Shared state, data cache, event bus | Phase 3 — load after firebase-service.js |
| `js/core/worker-api.js` | Cloudflare Worker proxy calls | |
| `js/ui/navigation.js` | showPage(), pageRenderers registry, page hide/show | |
| `data.js` | allSongs[] static array (413 songs), bandKnowledgeBase | Loaded synchronously |
| `app.js` | Auth, startup, all legacy feature functions, shared globals | ~19,600 lines |

---

# Key Globals (app.js)

| Global | Type | Used by |
|---|---|---|
| `allSongs` | const array (data.js) | all feature files |
| `selectedSong` | `{title, band}` | songs, song-detail, home-cc |
| `readinessCache` | `{songTitle: {memberKey: 1-5}}` | songs, song-detail, rehearsal, practice, home-cc |
| `statusCache` | `{songTitle: 'gig_ready'}` | songs, song-detail, rehearsal |
| `northStarCache` | `{songTitle: bool}` | songs |
| `harmonyCache` | `{songTitle: bool}` | songs |
| `BAND_MEMBERS_ORDERED` | array of `{key,name,emoji}` | song-detail, rehearsal |
| `MASTER_READINESS_FILE` | string constant | song-detail |
| `currentUserEmail` | string | rehearsal, many |
| `isUserSignedIn` | bool | rehearsal, many |
| `window._pmPendingRehearsalEventId` | string\|null | rehearsal.js → pocket-meter launch |
| `window._lastPocketScore` | number\|null | pocket-meter.js → home-dashboard-cc |
| `window._lastPocketTrend` | `{direction, delta}` | pocket-meter.js → home-dashboard-cc |

---

# App Shell / Global Nav

| Visible Area | Container | Primary File | Supporting Files | Notes |
|---|---|---|---|---|
| App shell / global nav | main layout | app.js | index.html, navigation.js | Controls page switching, startup, global events |
| Shared modals | modal containers | app.js | modal helpers | Confirm ownership if modals behave inconsistently |
| Shared data/state | global | js/core/groovelinx_store.js | firebase-service.js, utils.js | Add once wired in Phase 3 |

---

# Command Center / Home

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Command Center | page-home | js/features/home-dashboard-cc.js | home-dashboard.js (layout shell), app.js, rehearsal.js, pocket-meter.js, practice.js |

### Major UI Areas
- top summary strip (pills: readiness, pocket score, trend, active mix)
- next rehearsal card
- weak songs / practice tasks
- pocket snapshot
- recent band activity
- quick actions

### Critical Actions
- open rehearsal event
- open song
- open practice page
- open pocket meter
- navigate to any linked resource

### Key Data Dependencies
- `practice_mixes` (Firebase — orderByChild updatedAt, limit 1)
- `rehearsal_plans` (Firebase)
- `readinessCache` (global)
- `window._lastPocketScore`, `window._lastPocketTrend` (session-only globals)
- `allSongs` (global)

---

# Songs List

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Songs page | page-songs | js/features/songs.js | app.js (selectSong, showBandResources) |

### Major UI Areas
- song list with status / readiness / north star / harmony badges
- band filter, status filter, search

### Critical Actions
- filter by band / status / search
- click song → opens page-songdetail (not legacy step-cards)
- badge state reflects saved readiness/status

### Key Data Dependencies
- `allSongs` (data.js)
- `readinessCache`, `statusCache`, `northStarCache`, `harmonyCache` (globals)
- `selectedSong` written on selection

### Key Functions
- `selectSong(title)` — app.js (routes to page-songdetail, also runs showBandResources in background)
- `renderSongList()`, `addStatusBadges()`, `addReadinessChains()` — songs.js

---

# Song Detail (5-Lens)

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Song Detail | page-songdetail | js/features/song-detail.js | harmony-lab.js (Sing lens), version-hub.js (Listen), app.js |

### Major UI Areas
- header (title, ← back button)
- 5 lens tabs: 🎸 Band · 📻 Listen · 📖 Learn · 🎤 Sing · ✨ Inspire

### Critical Actions
- switch lenses
- edit lead singer / status / key / BPM (all must persist after refresh)
- adjust readiness slider
- open Practice Mode (loads chart, opens rehearsal-mode overlay)
- view / add Stage Crib Notes and Rehearsal Notes
- launch Version Hub (Listen), Best Shot (Listen), harmony work (Sing)

### Key Data Dependencies (all via loadBandDataFromDrive unless noted)

| Field | Firebase key | Expected shape |
|---|---|---|
| Lead Singer | `lead_singer` | `{singer: 'drew'}` |
| Status | `song_status` | `{status: 'gig_ready'}` |
| Key | `key` | `{key: 'E'}` |
| BPM | `song_bpm` | `{bpm: 120}` |
| Chart | `chart` | `{text: '...'}` |
| Crib Notes / Tabs | `personal_tabs` | array of `{url, label, notes, memberKey}` |
| Rehearsal Notes | `rehearsal_notes` | array |
| North Star versions | `spotify_versions` | array |
| Best Shot takes | `best_shot_takes` | array |
| Practice Tracks | `practice_tracks` | array |
| Cover Me | `cover_me` | array |
| Section Ratings | direct: `songs/{key}/section_ratings` | object |
| Readiness | direct: `songs/{key}/readiness` | `{memberKey: 1-5}` |

### Key Functions
- `renderSongDetail()`, `switchLens()`, `glSongDetailBack()` — song-detail.js
- `sdUpdateLeadSinger/Status/Key/Bpm()`, `sdSaveReadiness()` — song-detail.js
- `pageRenderers['songdetail']` registered in song-detail.js

---

# Practice

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Practice page | page-practice | js/features/practice.js | songs.js, song-detail.js |

### Major UI Areas
- Focus tab: weak songs by readiness, status buckets, personal readiness bars
- Mixes tab: mix cards, mix editor, band mixes (shared)

### Critical Actions
- open practice song
- create / edit / delete a mix
- add / remove / reorder songs in a mix
- auto-generate mix from readiness scores
- enable sharing (creates shareSlug)

### Key Data Dependencies
- `practice_mixes` (Firebase)
- `_master_readiness.json` (loadMasterFile)
- `allSongs`, `readinessCache` (globals)

---

# Rehearsals

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Rehearsals page | page-rehearsal | js/features/rehearsal.js | pocket-meter.js, app.js, songs.js |

### Major UI Areas
- Sessions tab: rehearsal event list + event detail
- Plans tab: rehearsal plans

### Critical Actions
- open rehearsal event
- edit rehearsal info
- launch Pocket Meter (passes rehearsalEventId via `window._pmPendingRehearsalEventId`)
- review saved groove summary inline
- view scoreboard + song suggestions

### Key Data Dependencies
- `rehearsal_plans`, `rehearsals/{id}`, `rehearsals/{id}/grooveAnalysis` (Firebase)
- `allSongs`, `BAND_MEMBERS_ORDERED`, `currentUserEmail`, `readinessCache`, `statusCache` (globals)

---

# Pocket Meter

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Pocket Meter | page-pocketmeter | pocket-meter.js | app.js (renderPocketMeterPage) |

### Major UI Areas
- source selector (mic / file / URL)
- score gauge + stability score
- groove analysis summary (pocket position, beat count, confidence)
- save action

### Critical Actions
- start / stop analysis
- save result → writes `rehearsals/{id}/grooveAnalysis`
- return to rehearsal → verify groove card updated inline
- verify Command Center pocket pill updated (session-only)

### Key Data Dependencies
- `window._pmPendingRehearsalEventId` (consumed on launch, set by rehearsal.js)
- `window._lastPocketScore`, `window._lastPocketTrend` (written on save)
- `rehearsals/{rehearsalEventId}/grooveAnalysis` (Firebase write)

---

# Harmony Lab / Sing Lens

| Visible Area | Container | Primary File | Supporting Files |
|---|---|---|---|
| Harmony Lab | inside page-songdetail (Sing lens) | js/features/harmony-lab.js | song-detail.js, firebase helpers |

### Key Data Dependencies
- harmony data loaded within song-detail loadSongDetail
- `harmonyCache` global (badge display only)

---

# Gigs

| Visible Area | Container | Primary File | Notes |
|---|---|---|---|
| Gigs page | page-gigs | js/features/gigs.js | Google Maps / Places for venue autocomplete |

### Key Data Dependencies
- `gigs`, `venues`, `setlists` (Firebase)

---

# Calendar

| Visible Area | Container | Primary File |
|---|---|---|
| Calendar page | page-calendar | js/features/calendar.js |

Links to: Rehearsals, Gigs pages

---

# Known Ownership Assumptions to Verify

| Assumption | Status | Verification Notes |
|---|---|---|
| app.js owns navigation / page switching | ✅ Confirmed | showPage(), navigation.js |
| songs.js owns song selection | ✅ Confirmed | selectSong() in app.js routes to page-songdetail |
| song-detail.js owns 5-lens rendering | ✅ Confirmed | pageRenderers['songdetail'] registered |
| rehearsal.js owns rehearsal event detail | ✅ Confirmed | rhOpenEvent() verified |
| pocket-meter.js owns analysis + save | ✅ Confirmed | PocketMeter class |
| practice.js owns practice mixes | ✅ Confirmed | Mixes tab added Phase 2 |
| groovelinx_store.js becomes shared state owner | Planned | Phase 3 migration |

---

# How to Verify File Ownership

1. Search for the visible page name or container id in index.html and JS
2. Search for click handlers on nav items / buttons
3. Search for render functions: `renderSongs`, `selectSong`, `loadSongDetail`, `rhOpenEvent`, `initPocketMeter`
4. Search for Firebase read/write calls near those functions
5. Update this map when ownership becomes clearer
