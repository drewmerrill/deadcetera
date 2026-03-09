# GrooveLinx — Wave-3 Browser Smoke Test Checklist

Generated post-extraction audit. Test on both desktop and iPhone.
Open DevTools console before starting — any `ReferenceError` points directly to a missing cross-module dep.

---

## 📋 Setlists (`js/features/setlists.js`)

**Cross-module deps:** `allSongs`, `bandPath`, `deleteGig`, `editGig`, `firebaseDB`,
`launchGigMode`, `loadBandDataFromDrive`, `loadGigHistory`, `sanitizeFirebasePath`,
`saveBandDataToDrive`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Setlists page from hamburger menu | Page renders with setlist list or empty state |
| 2 | Tap **+ New Setlist** | Create modal opens; name/date/venue fields present |
| 3 | Save a new setlist | Appears in list; toast confirms save |
| 4 | Open a setlist and search for a song | Song search results populate from `allSongs` |
| 5 | Add a song to a set | Song appears in set; readiness meter renders |
| 6 | Reorder or remove a song from a set | Order/removal persists on save |
| 7 | Edit setlist metadata (name, date, venue) | Changes save and reflect in list |
| 8 | Delete a setlist | Confirm prompt appears; setlist removed |
| 9 | Tap **Export** / iPad export | Export modal or download triggers |
| 10 | Open Care Package from setlist toolbar | Care Package modal launches |

**Likely failure points after extraction:**
- `loadGigHistory` called on render — it lives in `gigs.js` which loads before `setlists.js` ✅ safe, but if gigs.js ever moves, this breaks
- `deleteGig` / `editGig` / `launchGigMode` — all in `gigs.js`; setlists references them for gig-linked setlists. Verify those buttons aren't broken on setlists that have an associated gig
- `sanitizeFirebasePath` — in `utils.js`; setlist name sanitization will silently fail if utils.js isn't loaded. Saving a setlist with special chars (e.g. `"Don't Stop"`) is the test
- `openSetlistCarePackage` calls `carePackageSend` which lives in `notifications.js` — loads after setlists.js, so it must be resolved at call time (not definition time). Should be fine but verify the Care Package button works

---

## 📅 Practice (`js/features/practice.js`)

**Cross-module deps:** `allSongs`, `loadBandDataFromDrive`, `saveBandDataToDrive`,
`selectSong`, `showPage`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Practice Plan page | Page renders; rehearsal date list loads or shows empty state |
| 2 | Select a rehearsal date | Song checklist for that date renders |
| 3 | Check/uncheck a song as practiced | State saves; visual feedback shown |
| 4 | Add a goal to the practice plan | Goal appears in list |
| 5 | Remove a goal | Goal removed; saves |
| 6 | Add a song to the plan manually | Song picker populates from `allSongs` |
| 7 | Tap a song title | `selectSong()` fires; navigates to song detail |
| 8 | Tap **Export Practice Plan** | Modal with copyable text appears |
| 9 | Navigate to Practice via calendar rehearsal event | `practicePlanActiveDate` set; correct date pre-selected |

**Likely failure points after extraction:**
- `practicePlanActiveDate` is a module-level `let` declared in `practice.js` — `calendar.js` and `notifications.js` also reference it by name. Since all three load before `app.js`, and it's a `let` (not `var`), it's scoped to `practice.js`. **High risk:** calendar and notifications will get `ReferenceError: practicePlanActiveDate is not defined` when trying to set it. Fix: change to `var` or assign to `window.practicePlanActiveDate`
- `formatPracticeDate` — defined in `practice.js`, called in `notifications.js`. Loads before notifications so should resolve at call time ✅
- `selectSong` lives in `app.js` — still loads after all feature modules, so call-time resolution is fine

---

## 📆 Calendar (`js/features/calendar.js`)

**Cross-module deps:** `loadBandDataFromDrive`, `practicePlanActiveDate`, `saveBandDataToDrive`,
`showPage`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Calendar page | Month grid renders with current month |
| 2 | Tap **<** / **>** month nav arrows | Grid re-renders for correct month |
| 3 | Tap a date with a dot (existing event) | Event detail card expands below grid |
| 4 | Tap **+ Add Event** | Event form opens with type selector |
| 5 | Save a rehearsal event | Event dot appears on calendar; saves to Firebase |
| 6 | Save a gig event | Same as above; gig icon/color distinct from rehearsal |
| 7 | Edit an existing event | Pre-populated form; changes save |
| 8 | Delete an event | Event removed; dot disappears |
| 9 | Tap **📋 Practice Plan** on a rehearsal event | Navigates to Practice page with that date selected |
| 10 | Block dates (availability) | Blocked dates render distinctly on grid |

**Likely failure points after extraction:**
- `practicePlanActiveDate` reference — same issue as practice.js above. Calendar sets this before calling `showPage('practice')`. If it's a `let` in practice.js scope, calendar can't write to it. **Test this first**
- `calShowEvent` is called from inline `onclick` in dynamically generated HTML — relies on `window.calShowEvent` export being present. Confirm the export block fires before any calendar HTML is rendered (it will, since exports run at parse time)
- Gig dots on calendar depend on `loadGigHistory` from `gigs.js` — verify dots appear for known gig dates

---

## 🔔 Notifications (`js/features/notifications.js`)

**Cross-module deps:** `WORKER_URL`, `allSongs`, `bandPath`, `firebaseDB`,
`formatPracticeDate`, `loadBandDataFromDrive`, `practicePlanActiveDate`,
`sanitizeFirebasePath`, `saveBandDataToDrive`, `showPage`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Notifications page | Member contact list renders; push permission status shown |
| 2 | Tap **Edit** on a member row | Inline edit form opens for phone/email |
| 3 | Save a member contact | Contact saved; toast confirms |
| 4 | Tap **Text** on a member | SMS app opens with pre-filled message |
| 5 | Tap **Text All** | SMS opens for each member or copy modal shown |
| 6 | Open Care Package modal (Rehearsal Pack) | Modal renders with setlist picker |
| 7 | Open Care Package modal (Gig Pack) | Modal renders; gig picker loads |
| 8 | Generate and send a Care Package | Toast confirms; link generated via Worker |
| 9 | Copy Care Package link | Link in clipboard; toast confirms |
| 10 | Tap **📋 Rehearsal Reminder** from Practice page | Navigates to Notifications with date pre-selected |

**Likely failure points after extraction:**
- `WORKER_URL` — stubbed out of `app.js` in stabilization, now lives in `worker-api.js`. Notifications references it directly as `WORKER_URL`. Since `worker-api.js` uses `var WORKER_URL` it's a true global — should be fine, but verify Care Package link generation actually hits the Worker
- `formatPracticeDate` — defined in `practice.js` (loads before notifications.js) ✅
- `practicePlanActiveDate` — same scoping risk as above; `notifFromPracticePlan` sets it then calls `showPage`. If it's not a true global, this silently sets nothing
- Most complex module (1,108 lines, 38 exports) — highest overall regression risk. Test Care Package end-to-end first

---

## 📣 Social (`js/features/social.js`)

**Cross-module deps:** `loadBandDataFromDrive`, `saveBandDataToDrive`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Social Media page | Profile links section and post list renders |
| 2 | Tap **Edit Profiles** | Platform URL fields become editable |
| 3 | Save profile links | Links save; display updates |
| 4 | Tap **Add Post** | New post form opens with platform checkboxes |
| 5 | Write and save a post draft | Post appears in list with date |
| 6 | Edit an existing post | Pre-populated form; changes save |
| 7 | Delete a post | Post removed from list |
| 8 | Tap **✨ Get AI Idea** | Worker call fires; AI caption suggestion appears |

**Likely failure points after extraction:**
- Cleanest module (4 deps, all core utils). Low regression risk
- `socialGetAIIdea` calls the Worker via `workerFetch` or direct fetch — confirm the AI caption button isn't broken (network call most likely to fail silently)
- AI idea textarea `focus()` at L290 was flagged by first audit pass but confirmed inside a function — still worth testing that the textarea actually focuses after an AI response

---

## 💰 Finances (`js/features/finances.js`)

**Cross-module deps:** `loadBandDataFromDrive`, `saveBandDataToDrive`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Finances page | Stat cards (income/expenses/balance) render; transaction list loads |
| 2 | Tap **+ Add Transaction** | Transaction form opens with income/expense selector |
| 3 | Save an income transaction | Appears in list; stat cards update |
| 4 | Save an expense transaction | Balance reflects correctly |
| 5 | Delete a transaction | Removed from list; totals recalculate |
| 6 | Set starting balance | Starting balance displays below stat cards |
| 7 | Verify balance math | Income − expenses + starting balance = displayed balance |

**Likely failure points after extraction:**
- Smallest module (112 lines, 7 exports). Lowest regression risk of all nine
- `loadFinances` is called at the end of `renderFinancesPage` — if `loadBandDataFromDrive` isn't available at that moment (e.g. firebase-service.js failed silently), the page renders empty with no error. Check the console for silent Firebase auth failures if stat cards show $0 with no transactions

---

## 🏆 Best Shot (`js/features/bestshot.js`)

**Cross-module deps:** `allSongs`, `blobToBase64`, `chopKeyHandler`, `chopMouseUp`,
`loadBandDataFromDrive`, `loadRefVersions`, `saveBandDataToDrive`, `selectSong`,
`showPage`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open a song and scroll to Best Shot section | Best Shot vs North Star panel renders |
| 2 | Tap **🏆 Best Shot Overview** from menu | Overview grid loads with song cards |
| 3 | Filter overview by member | Grid filters correctly |
| 4 | Tap a song card in overview | `selectSong()` fires; navigates to that song |
| 5 | Record a new Best Shot take | Upload or mic capture works; take saves |
| 6 | Rate a section (green/yellow/red inline dots) | Rating saves; dot color updates |
| 7 | Add a section note | Note saves under correct section |
| 8 | Edit / delete a section note | Changes save |
| 9 | Toggle section notes visibility | Show/hide animates correctly |
| 10 | Compare Best Shot audio vs North Star | Side-by-side audio players render and play |

**Likely failure points after extraction:**
- `chopKeyHandler` and `chopMouseUp` — defined in the Rehearsal Chopper (still in `app.js`). BestShot references these for waveform editing. High risk if the chopper section got shuffled during extraction — verify waveform interaction doesn't throw
- `blobToBase64` — likely still in `app.js`; if it was in the extracted range it may be missing. Check the console when uploading a Best Shot recording
- `loadRefVersions` — still in `app.js` (Version Hub area). The side-by-side comparison panel depends on this; verify it populates
- Largest extracted module (1,537 lines, 46 exports). Second-highest regression risk. Test section rating dots first — they're used on song rows everywhere

---

## 🎵 Playlists (`js/features/playlists.js`)

**Cross-module deps:** `advancePartyToSong`, `copyPlaylistShareUrl`, `deletePlaylist`,
`endListeningParty`, `firebaseDB`, `getBandMemberName`, `getCurrentMemberKey`,
`getPartyState`, `getPlaylistSongs`, `getSourceMeta`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Open Playlists page | Index renders with type filter tabs |
| 2 | Tap **+ New Playlist** | Create form opens |
| 3 | Save a new playlist | Appears in index list |
| 4 | Open a playlist and tap a song | Player launches; song metadata resolves |
| 5 | Play next / previous in player | Track advances; UI updates |
| 6 | Open external link (Spotify/YouTube) | Correct URL opens in new tab |
| 7 | Delete a playlist | Confirm prompt; removed from index |
| 8 | Start Listening Party | Party state initializes in Firebase; members see it |
| 9 | Advance to next song in party | All members' players update |
| 10 | End Listening Party | Party state cleared; player exits party mode |

**Likely failure points after extraction:**
- `advancePartyToSong`, `endListeningParty`, `getPartyState`, `getPlaylistSongs`, `getSourceMeta`, `copyPlaylistShareUrl`, `deletePlaylist`, `getBandMemberName` — these are all called from playlists.js but may be defined in `app.js` (not yet extracted). If any were accidentally included in the extraction range, they'll be missing from app.js. Check the console when starting a Listening Party
- `getCurrentMemberKey` — lives in `firebase-service.js` ✅ safe
- Listening Party is the most Firebase-intensive flow here — real-time listener + multi-user state. Most likely to surface timing issues if Firebase isn't fully initialized when playlists.js first executes

---

## 🌿 Stoner Mode (`js/features/stoner-mode.js`)

**Cross-module deps:** `allSongs`, `injectStonerBtn`, `launchGigMode`,
`loadBandDataFromDrive`, `selectSong`, `showPage`, `showToast`, `toArray`

| # | Action | Expected Result |
|---|--------|----------------|
| 1 | Tap **🌿 Mode** button in topbar | Stoner overlay slides in fullscreen |
| 2 | Search for a song | Results populate from `allSongs` |
| 3 | Tap a song result | `selectSong()` fires; navigates to song detail |
| 4 | Tap **📋 Pick a Setlist** | Setlist picker opens |
| 5 | Select a setlist | Active setlist label updates in header |
| 6 | Tap **🎤 Gigs** | Navigates to gigs page; overlay closes |
| 7 | Tap 🏠 home button | Returns to stoner home screen |
| 8 | Exit stoner mode | Overlay hides; normal app resumes |
| 9 | Reload page with stoner mode was active | Mode restores from localStorage |
| 10 | Tap 😵 Exit button | Stoner mode off; topbar button resets |

**Likely failure points after extraction:**
- `injectStonerBtn` is an IIFE at the bottom of `stoner-mode.js` — it runs at parse time (intentionally, to inject the topbar button). This is correct behavior but it fires before `app.js` and Firebase are initialized. Verify the 🌿 button appears in the topbar on load
- `launchGigMode` — defined in `gigs.js`, loads before stoner-mode.js ✅ safe
- `stonerPickSetlist` calls `loadBandDataFromDrive` for setlist data — verify it doesn't silently fail if called before Firebase auth completes (user not yet signed in)
- `localStorage.getItem('deadcetera_stoner_mode')` restore on load — test by enabling stoner mode, reloading, and confirming the overlay re-opens

---

## 🔑 Cross-Module Issue to Fix Before Testing

Before running any of the above, fix `practicePlanActiveDate`:

```js
// practice.js — change this:
let practicePlanActiveDate = null;

// to this:
var practicePlanActiveDate = null;
```

`var` hoists to the global scope. `let` is scoped to `practice.js` only. Both `calendar.js` and `notifications.js` write to `practicePlanActiveDate` before calling `showPage('practice')` — with `let`, those writes silently create a new local variable and the practice page never sees the correct date. This will cause the "navigate from calendar rehearsal event → practice plan opens on wrong date" bug.

---

## Console Error Quick Reference

| Error | Module | Cause |
|-------|--------|-------|
| `practicePlanActiveDate is not defined` | calendar / notifications | `let` scope issue — fix above |
| `carePackageSend is not defined` | setlists | notifications.js not loaded / window export missing |
| `loadRefVersions is not defined` | bestshot | still in app.js, check extraction boundary |
| `blobToBase64 is not defined` | bestshot | check if it landed in extraction range |
| `chopKeyHandler is not defined` | bestshot | rehearsal chopper still in app.js — verify boundary |
| `launchGigMode is not defined` | stoner / setlists | gigs.js not loaded |
| `formatPracticeDate is not defined` | notifications | practice.js not loaded or load order wrong |
| `WORKER_URL is not defined` | notifications | worker-api.js not loaded |
| `getPlaylistSongs is not defined` | playlists | still in app.js — check boundary |
