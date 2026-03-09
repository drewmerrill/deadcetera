# GrooveLinx — Module Dependency Map
**As of Session 20260307-S1 (Wave-2 Deployed)**

---

## Module Load Order (index.html)

```
index.html
├── Google Maps JS SDK (async, key in index.html)
├── Firebase SDK (compat)
├── navigation.js
├── rehearsal-mode.js
├── version-hub.js
├── help.js
├── js/features/gigs.js          ← Wave-2
├── js/features/rehearsal.js     ← Wave-2
└── app.js                       (loads last; wires everything together)
```

> `app.js` must load last — it references globals and functions defined in all other files.

---

## Global State (declared in `app.js`, used cross-file)

These are `var`-declared globals (not `const`/`let`) to avoid duplicate-declaration SyntaxErrors across files.

| Variable | Type | Purpose |
|---|---|---|
| `firebaseDB` | Firebase DB ref | Primary database handle |
| `FIREBASE_CONFIG` | Object | Firebase project config |
| `currentPage` | String | Active page identifier |
| `pageRenderers` | Object | Map of page name → render function |
| `currentBandSlug` | String | Active band slug (e.g. `"deadcetera"`) |
| `currentMemberKey` | String | Logged-in member's Firebase key |
| `isUserSignedIn` | Boolean | Google OAuth state |
| `FADR_PROXY` | String | Worker proxy base URL |

---

## Cross-File Function Dependencies

### `navigation.js` → depends on `app.js`
| navigation.js calls | Defined in |
|---|---|
| `pageRenderers[page]()` | app.js |
| `renderPocketMeterPage()` | app.js |
| `gmCloseDrawer()` | app.js |

### `js/features/gigs.js` → depends on `app.js`
| gigs.js calls | Defined in |
|---|---|
| `bandPath(ref)` | app.js |
| `firebaseDB` | app.js (global) |
| `currentBandSlug` | app.js (global) |
| `currentMemberKey` | app.js (global) |
| `showToast(msg)` | app.js |
| `renderVenueDropdown()` | app.js (venues) |
| `openGigPocketMeter()` | app.js |
| `renderSetlistForGig()` | app.js (setlists) |

### `js/features/rehearsal.js` → depends on `app.js`
| rehearsal.js calls | Defined in |
|---|---|
| `bandPath(ref)` | app.js |
| `firebaseDB` | app.js (global) |
| `currentBandSlug` | app.js (global) |
| `renderSongReadinessBars()` | app.js (members) |
| `showToast(msg)` | app.js |

### `version-hub.js` → depends on `app.js` + Worker
| version-hub.js calls | Defined in |
|---|---|
| `FADR_PROXY` | app.js (global) |
| `currentBandSlug` | app.js (global) |
| Worker `GET /archive` | worker.js |
| Worker Spotify token endpoint | worker.js |

### `help.js` → depends on `app.js`
| help.js calls | Defined in |
|---|---|
| `glShowHelp(sectionId)` | help.js (self-contained) |
| `currentPage` | app.js (global) |

### `rehearsal-mode.js` → depends on `app.js`
| rehearsal-mode.js calls | Defined in |
|---|---|
| `bandPath(ref)` | app.js |
| `firebaseDB` | app.js (global) |
| `currentMemberKey` | app.js (global) |
| `showToast(msg)` | app.js |

---

## `app.js` — Major Internal Function Groups

These are the functional clusters still living in `app.js` after Wave-2 extraction.

```
app.js
├── Bootstrap & Auth
│   ├── Firebase init
│   ├── Google OAuth (auto-reconnect on load)
│   └── bandPath(), migrateToMultiBand(), switchToBand()
│
├── Song List
│   ├── renderSongList()
│   ├── filterSongs()
│   └── section dots on song rows
│
├── Song Detail
│   ├── Song DNA
│   ├── North Star
│   ├── Stage Crib Notes (toggleCribPillForm ~line 1468)
│   └── The Woodshed
│
├── Version Hub (wiring only; logic in version-hub.js)
│   └── openVersionHub(), sendToVersionHub()
│
├── Setlists
│   ├── slRenderSetSongs()          ← fixed s.title→s bug in S1
│   ├── setlist key/BPM async enrichment
│   └── setlist toolbar + Care Package button
│
├── Venues
│   ├── renderVenueDropdown()
│   ├── venue edit/delete
│   ├── venue alpha sort
│   └── Google Maps autocomplete
│
├── Calendar
│   ├── renderCalendarPage()
│   └── gig↔setlist + venue link
│
├── Gig Map
│   ├── dark Google Map
│   ├── green/purple pins + info cards
│   └── All/Upcoming/Past filter
│
├── Pocket Meter
│   ├── openGigPocketMeter()
│   ├── closeGigPocketMeter()
│   └── renderPocketMeterPage()
│
├── Notifications + Care Package
│   ├── Care Package create → Firebase care_packages_public
│   ├── Worker GET /pack/:id → standalone SMS link page
│   └── 14-day expiry
│
├── Parachute System
│   ├── Print
│   ├── Email
│   ├── Public URL
│   └── Offline cache
│
├── Members + Readiness
│   ├── renderMemberHeatmap()       ← auto-refresh
│   ├── renderSongReadinessBars()
│   └── section dots
│
├── Multi-band
│   ├── band creation modal
│   ├── invite/join flow
│   └── switchToBand()
│
└── Utilities
    ├── showToast(msg)
    ├── bandPath(ref)
    ├── saveMasterFile() (sanitizes Firebase keys)
    └── equipPickPhoto() (camera + resize)
```

---

## Wave-3 Extraction Targets (not started)

| Target file | Current location in app.js | Risk level |
|---|---|---|
| `js/features/calendar.js` | Calendar page renderer | Medium — calls gig + venue fns |
| `js/features/setlists.js` | Setlist builder + slRenderSetSongs | High — many cross-refs |
| `js/features/versions.js` | Version Hub wiring | Low — mostly delegates to version-hub.js |
| `js/features/song-detail.js` | DNA, North Star, Crib Notes, Woodshed | High — deeply stateful |

---

## Worker (`worker.js`) — Route Map

```
worker.js (811 lines)
├── GET  /archive?q=&sortParam=   → Archive.org search proxy
├── GET  /pack/:id                → Care Package public page (HTML)
├── POST /fadr                    → FADR API proxy
└── POST /spotify-token           → Spotify client credentials
```

**Worker secrets:** `ANTHROPIC_API_KEY`, `FADR_API_KEY`, `PHISHNET_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

---

## Declared Global Safety Rules

- All shared globals must use `var` (not `const`/`let`) — duplicate `let` across two loaded files kills the second file entirely (Lesson #4)
- `FIREBASE_CONFIG`, `firebaseDB`, `isUserSignedIn`, `FADR_PROXY`, `currentPage`, `pageRenderers` — all fixed to `var` in S1
- `loadGigHistory` and `launchGigMode` now have `typeof` guards before bare calls (fixed S1)
