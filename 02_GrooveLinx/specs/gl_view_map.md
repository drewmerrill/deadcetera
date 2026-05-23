# GrooveLinx UI Destination Map
Build: 20260312-230337 · Source: index.html + navigation.js + glhot scan

Legend: 🔀 Replaces main view | 🪟 Overlays main view | ◀ Has back-nav

---

## PAGES (showPage — replace main view)

All pages swap visibility of `.app-page` divs. None have a back button;
back = hamburger menu or browser back. `glLastPage` is persisted to
localStorage and restored on next load (except `songs` and `songdetail`).

| Page key | DOM id | Renderer | Triggered by | Notes |
|---|---|---|---|---|
| `home` | `#page-home` | `renderHomeDashboard()` · home-dashboard.js | Default on sign-in; topbar brand click; many CTAs | |
| `songs` | `#page-songs` | Static HTML + `renderSongs()` · songs.js | Menu; many CTAs; `selectSong()` returns here | Rendered on load, not via pageRenderers |
| `songdetail` | `#page-songdetail` | `renderSongDetail(title)` · song-detail.js | `selectSong()` in songs.js line 254; CC radar rows | Needs song context; special restore logic |
| `setlists` | `#page-setlists` | `renderSetlistsPage()` · setlists.js | Menu; home cards; gigs "Open Setlist" btn | |
| `rehearsal` | `#page-rehearsal` | `renderRehearsalPage()` · rehearsal.js | Menu; home cards; CC strip pill | |
| `rehearsal-intel` | `#page-rehearsal-intel` | `renderRehearsalIntel()` · rehearsal.js | (internal — not in menu) | |
| `practice` | `#page-practice` | `renderPracticePage()` · practice.js | Menu; home cards; CC strip pill | |
| `gigs` | `#page-gigs` | `renderGigsPage()` · gigs.js | Menu; home cards; setlists "Open Gig" | |
| `calendar` | `#page-calendar` | `renderCalendarPage()` · calendar.js | Menu; rehearsal modal "Go to Calendar" | |
| `venues` | `#page-venues` | `renderVenuesPage()` · gigs.js | Menu | |
| `playlists` | `#page-playlists` | `renderPlaylistsPage()` · playlists.js | Menu; practice page sidebar | |
| `pocketmeter` | `#page-pocketmeter` | `renderPocketMeterPage()` · pocket-meter.js | Menu; rehearsal.js line 1316; CC strip pill; practice sidebar | |
| `tuner` | `#page-tuner` | `renderTunerPage()` · app.js | Menu; stoner-mode line 359; practice sidebar | |
| `metronome` | `#page-metronome` | `renderMetronomePage()` · app.js | Menu; stoner-mode line 368; practice sidebar | |
| `bestshot` | `#page-bestshot` | `renderBestShotPage()` · bestshot.js | Menu; practice sidebar | |
| `social` | `#page-social` | `renderSocialPage()` · social.js | Menu | |
| `finances` | `#page-finances` | `renderFinancesPage()` · finances.js | Menu | |
| `equipment` | `#page-equipment` | (renderer in app.js) | Menu | Not in pageRenderers — may use app.js inline |
| `contacts` | `#page-contacts` | (renderer in app.js) | Menu | Not in pageRenderers |
| `notifications` | `#page-notifications` | `renderNotificationsPage()` · notifications.js | Menu | |
| `admin` | `#page-admin` | `renderSettingsPage()` · app.js | Menu; topbar ⚙️ btn | |
| `help` | `#page-help` | `renderHelpPage()` · help.js | Menu; topbar ❓ btn | |
| `stoner` | `#page-stoner` | `renderStonerPage()` · stoner-mode.js | (not in menu — triggered internally) | |
| `hero` | `#page-hero` | Static HTML | Shown to signed-out users on load via `glHeroCheck()` | Replaced by home on sign-in |

---

## FULL-SCREEN OVERLAYS (append to body — cover everything)

### Rehearsal Mode 🪟 ◀
- **DOM:** `#rmOverlay` (created by `rmEnsureOverlay()`)
- **File:** `rehearsal-mode.js`
- **Triggered by:** `rmShow()` / `openRehearsalMode(title, tab?)` — called from song rows, practice page, rehearsal page
- **Closes:** `closeRehearsalMode()` — ✕ button, ESC key
- **Tabs inside:** Chart | Harmony | Woodshed | Band Notes | Pocket
- **Back-nav:** ✕ button restores scroll position; no browser back

### Live Gig Mode 🪟 ◀
- **DOM:** `#gigOverlay` (created by `gigEnsureOverlay()`)
- **File:** `js/features/live-gig.js`
- **Triggered by:** `launchLiveGig(setlistId)` → `initLiveGig()` — from setlists 🎤 button, home "Go Live" CTA, `homeGoLive()`
- **NOT via** `showPage('live-gig')` — no `#page-live-gig` div exists
- **Closes:** ✕ button → `showPage('setlists')`
- **Back-nav:** ✕ only; swipe left/right for song nav

### Version Hub 🪟 ◀
- **DOM:** `#versionHubOverlay` (created by version-hub.js)
- **File:** `version-hub.js`
- **Triggered by:** `launchVersionHub()`, `launchVersionHubForNorthStar()`, `launchVersionHubForCoverMe()` — from song detail steps 3/4, stepVersionHub card
- **Closes:** ✕ button / ESC
- **Back-nav:** ✕ button

### Pocket Meter Gig Overlay 🪟 ◀
- **DOM:** `#gigPocketOverlay` (static in index.html)
- **File:** `pocket-meter.js`
- **Triggered by:** `openGigPocketMeter(title, bpm, key, bandPath)` — from Gig Mode Pocket button
- **Closes:** `closeGigPocketMeter()` — ✕ button
- **Back-nav:** ✕ only

### Song Drawer 🪟 ◀
- **DOM:** `#songDrawerPanel` (created by `openSongDrawer()`)
- **File:** `js/features/song-drawer.js`
- **Width:** 420px, slides in from right
- **Triggered by:** hover + S key; "⚡ View" button on song rows (both app.js ~line 974 and songs.js); `data-song-drawer` attribute clicks
- **Closes:** ✕ button, ESC, backdrop click
- **Back-nav:** ✕ / ESC / backdrop
- **Renders:** `renderSongDetail(title, containerOverride)` scoped inside drawer

### Stoner Mode 🪟 ◀
- **DOM:** full-screen overlay created by stoner-mode.js
- **File:** `js/features/stoner-mode.js`
- **Triggered by:** (internal trigger — not in main nav)
- **Closes:** `showPage('songs')` on exit
- **Back-nav:** back button inside mode

---

## MODALS (z-index overlays, partial screen)

### Chart Import Modal 🪟 ◀
- **Triggered by:** 📋 button on Songs page header → `showChartImportModal()`
- **File:** `js/features/chart-import.js`
- **Closes:** ✕ / backdrop
- **Back-nav:** ✕

### Song Structure Modal 🪟 ◀
- **Triggered by:** ✏️ button in Song DNA → `showSongStructureForm()`
- **File:** `app.js` (renders into `#songStructureFormContainer`)
- **Closes:** cancel/save buttons
- **Back-nav:** cancel button

### Moises Stems Modal 🪟 ◀
- **Triggered by:** 🎚️ Moises Stems section in Woodshed → `moisesModal()`
- **File:** `app.js`
- **Back-nav:** ✕

### Add Venue Modal (inline in Gigs) 🪟 ◀
- **Triggered by:** "Add Venue" button in Gigs page → `showAddVenueModal()`
- **File:** `js/features/gigs.js`
- **Back-nav:** cancel/✕

### Rehearsal RSVP / Event Modal 🪟 ◀
- **Triggered by:** Create/Edit rehearsal in Rehearsals page
- **File:** `js/features/rehearsal.js`
- **Back-nav:** cancel button; "Go to Calendar" routes to calendar page

### Harmony Lab Modal 🪟 ◀
- **Triggered by:** Generate button in Harmony section
- **File:** `js/features/harmony-lab.js`
- **Back-nav:** ✕

### Singers Dropdown (inline) 🪟
- **DOM:** `#singersDropdown` (static in index.html inside `#page-songs`)
- **Triggered by:** `toggleSingersDropdown()` — Harmony Members row
- **Closes:** outside click
- **Back-nav:** none (inline dropdown)

### Onboarding Overlay 🪟 ◀
- **Triggered by:** `glCheckOnboarding(page)` — fires once per page per device after `showPage()`
- **File:** `help.js`
- **Back-nav:** dismiss button

### Help Tooltip Popover 🪟
- **Triggered by:** ⓘ icons → `glShowHelp(topic, el)`
- **File:** `help.js` / `app.js`
- **Closes:** outside click / dismiss
- **Back-nav:** none

---

## PANELS / INLINE SECTIONS (within a page, not separate views)

### Song DNA (Step 2) — inline in Songs page
- **Triggered by:** `selectSong(title)` — clicking any song row
- **Reveals:** step2, stepVersionHub, step3ref, step3bestshot, step4ref, step4cover, step5ref

### Band Lock-In Readiness — inline in Song DNA
- **DOM:** `#readinessContainer`
- **File:** `app.js` / `groovelinx_store.js`
- **Triggered by:** song selection; renders readiness sliders per member

### Command Center Strip — inline in Home
- **DOM:** rendered by `home-dashboard-cc.js` into `#page-home`
- **Pills:** Next Rehearsal → `showPage('rehearsal')` | Mix → `showPage('practice')` | Pocket → `showPage('pocketmeter')`

### Rehearsal Mode Tabs (within Rehearsal Mode overlay)
- Chart | Harmony | Woodshed | Band Notes | Pocket
- All tab-switched within `#rmOverlay` — no separate routing

### Gig Directions Panel — inline in Gigs page
- Pre-fills home address, shows route + leave-by time via `google.maps.DirectionsService`
- **Triggered by:** directions button on a gig card

### Gig Map (collapsible) — inline in Gigs page
- **Triggered by:** toggle button; lazy-renders on first open
- Dark Google Map with venue pins
- **Pin model:** ONE pin per venue (grouped by lowercased venue name), not one per gig. A venue played N times shows as a single pin with N dates listed. Pin color = green when any upcoming gig exists at the venue, indigo when only past plays.
- **Venue pins coords resolution (in order):** (1) venue record `lat`/`lng`; (2) venue record address geocoded + cached; (3) **free-text geocode of the venue NAME** as a Google query (rescues legacy free-text gigs with no venues-table row). Coords cached in `localStorage['gl_geocode_cache_v1']`; address-backfill results also written back to `venues/{idx}/lat,lng` as leaf paths (avoids array clobber per `project_setlist_swr_clobber_bug`).
- **Home pins:** signed-in user (blue 🏠, larger) always rendered; bandmate homes (purple 🏠, smaller) gated by the "🏠 Band" toggle (off by default; state in `localStorage['gl_gig_map_show_bandmates']`)
- **Privacy opt-in (issue #47):** each member can hide their home pin from bandmates via Settings → Profile → "🗺 Gig Map Privacy" checkbox. Defaults ON. Stored at `bands/{slug}/meta/members/{key}/showHomeOnMap`. Signed-in user always sees their own pin regardless of their own toggle (self-bypass at `gigs.js:521`).
- **Hover vs click info windows:** dark-themed (slate-800 override via one-time `<style id="gigsMapStyleOverrides">`). Same InfoWindow instance per marker; content swapped via `setContent()` between hover and click. **Hover** = compact preview (name + status + first 4 dates + "click for details" hint) — NO interactive buttons. **Click** = full content (address + scrollable all-dates list + anchor-gig metadata + Directions) AND pins the window so the Directions button is actually clickable. Mouseout closes after 250ms unless pinned.
- **Filter behavior:** "All" shows everything; "Upcoming" shows pins where `_hasUpcoming` is true; "Past" shows pins where `_hasPast` is true. A venue with both upcoming and past gigs appears under BOTH filters (deliberate — same pin reads "we play here / we played here").
- **Hydration dependency:** `bandMembers` cache (built by `loadBandMembersFromFirebase` from `meta/members`) MUST include `homeAddress`/`homeLat`/`homeLng`/`showHomeOnMap` on its allowlist — `gigs.js:520` reads `m.homeAddress` to decide whether to render a pin. Save path: `saveHomeAddress` dual-writes to `members/{key}/homeAddress` (legacy) and `meta/members/{key}/homeAddress` (canonical).
- **Markers use `google.maps.marker.AdvancedMarkerElement`** (post-2026-05-23 migration; replaces soft-deprecated `google.maps.Marker`). Required by the new API: `mapId` on the Map options. The `_GIGS_MAP_ID` constant in `gigs.js` points to a Cloud Console Map Style — see "Gig Map dark style (Cloud Console JSON)" below for the JSON to paste when creating the Map Style. Until a custom Map ID is configured, `_GIGS_MAP_ID = 'DEMO_MAP_ID'` ships markers + InfoWindows working but with Google's default light-theme tiles.
- **Hover/click DOM events:** `AdvancedMarkerElement` is a DOM-based marker — the `content` HTMLElement carries native `mouseenter`/`mouseleave` events. Click still uses `marker.addListener('click', ...)` (backwards-compat wrapper for `gmp-click`). Visibility toggles via `marker.map = null | _gigsMap` (no more `setVisible`).

### Gig Map dark style (Cloud Console JSON)

Paste this when creating the Map Style in Cloud Console → Google Maps Platform → Map Styles. After creating, copy the generated Map ID and replace `'DEMO_MAP_ID'` in `js/features/gigs.js` (`_GIGS_MAP_ID` constant).

```json
[
  { "elementType": "geometry", "stylers": [{ "color": "#1a1f2e" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#8ec3b9" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1a1f2e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#2c3554" }] },
  { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#1a1f2e" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0e1626" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#263144" }] }
]
```

---

## SPECIAL ROUTES / AUTH STATES

| State | What shows |
|---|---|
| Signed out (no `deadcetera_google_email` in localStorage) | `#page-hero` only |
| Sign-in button | `handleGoogleDriveAuth()` → OAuth → `glHeroCheck(true)` → `showPage('home')` |
| URL has `?playlist=` or `?pack=` | Stripped immediately; no page change |
| Share link `/pack/:id` | Served by Cloudflare Worker as standalone HTML — not in-app |
| `glLastPage` in localStorage | Restored 800ms after load (except songs/songdetail special cases) |
| `glLastSong` + `songdetail` | Polls until `allSongs` ready, then restores full song detail view |

---

## MISSING FROM pageRenderers (in menu but no registered renderer)

| Page | Status |
|---|---|
| `equipment` | Rendered inline in app.js — not registered in pageRenderers map |
| `contacts` | Same — inline app.js renderer, not in map |
| `home` | Rendered by home-dashboard.js via `renderHomeDashboard()` — registered separately outside navigation.js |
| `stoner` | Has `#page-stoner` div but triggered via stoner-mode.js directly, not showPage |
