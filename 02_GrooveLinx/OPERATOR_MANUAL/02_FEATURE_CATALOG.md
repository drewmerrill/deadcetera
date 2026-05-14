# GrooveLinx — Feature Catalog

_Build `20260514-142926`. Inventory of every named feature in the codebase, grouped by domain. Maturity legend at top._

## Maturity legend

| Tag | Meaning |
|---|---|
| **CORE** | Load-bearing, used daily, beta-stable |
| **MATURE** | Production-grade but not in every workflow |
| **EMERGING** | Working but not fully connected to the rest of the app |
| **EXPERIMENTAL** | Built, lives behind a flag or hidden surface, not announced |
| **DORMANT** | Built and forgotten — wired but not in any nav path |
| **DEPRECATED** | Superseded; kept for compatibility |

---

## 1. Songs & Library

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Songs page** | CORE | `js/features/songs.js` | The library — all songs the band has on the books. Filters by status (active / prospect / shelved). |
| **Song Detail** | CORE | `js/features/song-detail.js` | The "everything about this song" surface. Lens-based: Band / Play Mode / Chart / North Star / Harmony / Reference / Notes / Stems. |
| **Song status taxonomy** | CORE | `groovelinx_store.js:ACTIVE_STATUSES` | Prospect / Learning / Working / Live / Polished / Shelved. Drives intelligence & recommendations. |
| **Active vs Library scope** | CORE | `gl-source-resolver.js` | "Active" = the slice that intelligence/triage operates on. Library = everything. |
| **Song readiness scoring** | MATURE | `gl-readiness.js` | Per-song, per-member readiness percentages from practice + rehearsal signals. |
| **Songs V2 migration** | MATURE | `songs_v2/{songId}` paths | Canonical song shape; old `songs/{title}` still readable for migration. |
| **Title-as-ID legacy** | DEPRECATED | various | Pre-V2 lookups by title. Being phased out — don't introduce new callers. |
| **Song notes lens** | MATURE | `song-detail.js` notes lens | Band-shared free-text notes per song. |
| **Capo + key stamp** | CORE | song schema `key`, `capo` | Surfaced on Songs row, Song Detail header, Stage View. |
| **BPM zone coloring** | MATURE | `gl-tempo.js` | Tempo pill color-coded by zone (ballad / mid / driving / fast). |

---

## 2. Charts & Notation

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **ChartRenderer** | CORE | `js/core/gl-chart-renderer.js` | Single canonical chart pipeline (Stab #05). One renderer for all surfaces. |
| **Chart lens** | CORE | `song-detail.js` chart lens | The musician-facing chord chart view. |
| **abcjs rendering** | CORE | `js/vendor/abcjs` | Today's notation engine. Drives chart-with-notes view. |
| **MusicXML target** | EMERGING | per `project_notation_format` memory | Canonical notation target. abcjs remains today-renderer. |
| **Chart import** | MATURE | `js/features/chart-import.js` | Paste / upload a chart, parse to canonical form. Stab #11 Q.1 made button re-enable on error. |
| **Stage View chart** | CORE | `live-gig.js` | Performance-mode chart view, larger type, no UI chrome. |

---

## 3. Audio Playback & Engines

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **GLPlayerEngine** | CORE | `js/core/gl-player-engine.js` | Canonical audio playback core. |
| **pauseAll() arbitration** | CORE | Stab #07 | Single-owner playback — only one source plays at a time. |
| **Spotify Connect** | CORE | `gl-spotify-connect.js` + Stab #08 | Drives user's Spotify app via REST. The iOS playback path. |
| **YouTube embedded player** | MATURE | `gl-yt.js` | Wrapped YT.Player for North Star + reference playback. |
| **Apple Music link-out** | EMERGING | reference links | Link to Apple Music — no in-app SDK playback. |
| **Local mp3 / blob playback** | CORE | `gl-player-engine.js` | Stem playback, recording playback. |
| **Stem player** | MATURE | `song-detail.js` stems lens | 4-stem mixer (drums / bass / vocals / other). |
| **Volume + mute controls** | MATURE | per-source controls | Surfaced per engine. |
| **Pageshow AudioContext resume** | MATURE | Stab #11 Q.8 | bfcache restoration unmutes audio in harmony-lab + bestshot. |

---

## 4. Rehearsal System

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Rehearsal page** | CORE | `js/features/rehearsal.js` | Plan + execute rehearsals. |
| **RehearsalSession (canonical)** | CORE | C2 Phase 1 — `GLStore.RehearsalSession` | The single source of truth for "are we in a rehearsal right now." |
| **Rehearsal Mode (fullscreen)** | CORE | `rehearsal-mode.js` | The actual in-rehearsal driving surface. |
| **Rehearsal plan** | MATURE | `gl-rehearsal-plan.js` | Pre-rehearsal song list + agenda. |
| **Rehearsal walkthrough** | MATURE | `rehearsal-mode.js` walkthrough | Drummer prep BPM walkthrough, etc. |
| **Rehearsal Intel page** | EMERGING | `js/features/rehearsal-intel.js` | Intelligence surface for rehearsal patterns. |
| **Rehearsal recording upload** | CORE | `js/features/rehearsal-recording.js` | Upload phone/board recording for analysis. |
| **Rehearsal Analyzer** | MATURE | `gl-recording-analyzer.js` + Modal | DSP segmentation + chord detection + embeddings. |
| **Chopper persistence** | MATURE | Audit #04 follow-up | Saved analyzer timelines persist across sessions. |
| **songsWorked tracking** | MATURE | rehearsal session schema | Records what was worked in a session — feeds Home dashboards. |
| **Multitrack ingest wizard** | MATURE | `js/features/multitrack-rehearsal.js` + Stab #13 | X32 SD-card upload, per-instrument stem ingest. |

---

## 5. Live Gig / Performance

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Live Gig mode** | CORE | `live-gig.js` | Performance-mode fullscreen overlay. |
| **Setlist page** | CORE | `js/features/setlists.js` | Setlist build / edit / share. |
| **Setlist sections** | MATURE | setlists.js sections | Break setlist into sets / encores. |
| **Prep for Gig** | CORE | `setlists.js` + Stab #12 | Pre-caches every chart + metadata. Stab #12 made it truthful. |
| **Prep retry-failed** | MATURE | Stab #12 `_slPrepRetry()` | Retry only failed items, not whole setlist. |
| **Stage View** | CORE | `live-gig.js` Stage View | Per-song performance card: chord chart, key, capo, BPM. |
| **Setlist on-the-fly reorder** | MATURE | setlists.js | Drag-reorder during gig. |
| **Live gig segue notes** | MATURE | setlist item schema | Per-transition notes ("crossfade into X"). |

---

## 6. Harmony Lab

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Harmony Lab** | MATURE | `js/features/harmony-lab.js` | Harmony practice surface — find buried in Song Detail lens. |
| **Split mixer** | MATURE | harmony-lab.js mixer | Pan vocals left/right for part isolation. |
| **LALAL.AI lead/backing split** | MATURE | external service | Lead-vs-backing-vocal isolation. |
| **Harmony takes review** | MATURE | harmony-lab.js takes | Record + review harmony takes. |

---

## 7. North Star & References

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **North Star lens** | CORE | song-detail.js + Stab #08 hydration | The canonical reference version per song (Spotify/YT/Apple). |
| **North Star metadata hydration** | MATURE | gl-spotify.js | Pulls track title/artist/duration from Spotify API. |
| **Reference lens** | MATURE | song-detail.js reference lens | Additional reference recordings beyond North Star. |
| **YT bot-challenge cookie refresh** | MATURE | Modal `YOUTUBE_COOKIES_BASE64` | Recovery path when YT 429s the Modal worker. |

---

## 8. Stems & Audio Intelligence

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Stem separation (Demucs)** | CORE | `gl-stems.js` + Modal HT-Demucs | 4-stem isolation per song. Self-hosted via Modal+R2+Worker. |
| **Stem job persistence** | CORE | Stab #14 `gl_stem_jobs_active` | Jobs survive tab close, resume on boot. |
| **Stem job cancellation** | CORE | Stab #14 `cancelJob` + worker `/stems/cancel` | Cancel a running stem job, both client + remote. |
| **Multitrack tags** | MATURE | multitrack-rehearsal.js | 11-tag classification for per-instrument stems. |
| **3-tier storage** | MATURE | per `project_multitrack_rehearsal` memory | Modal → R2 → cold storage lifecycle. |

---

## 9. Practice

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Practice page** | EMERGING | `js/features/practice.js` | Practice planning + tracking. |
| **Practice Task system** | EMERGING | per `project_practice_task` memory | Spec'd, partial implementation. Closes review→practice loop. |
| **Practice tracking signals** | MATURE | practice.js + readiness | Feeds per-member readiness. |

---

## 10. Setlists, Gigs, Calendar

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Setlists** | CORE | `js/features/setlists.js` | (also see Live Gig section) |
| **Gigs page** | MATURE | `js/features/gigs.js` | Gig metadata: venue, date, set length, setlist link. |
| **Venues page** | MATURE | `js/features/venues.js` | Venue catalog with notes (load-in, parking, sound system). |
| **Calendar page** | MATURE | `js/features/calendar.js` | Calendar view with band events. |
| **Google Calendar sync** | MATURE | `gl-google-cal.js` + `project_calendar_filtering` | Two-way sync with selected calendars. |
| **Time-aware conflict classification** | MATURE | calendar.js | Prevents overblocking on busy days. |
| **Schedule page** | EMERGING | `js/features/schedule.js` | Member availability matrix. |
| **Finances page** | EMERGING | `js/features/finances.js` | Gig income / expense tracking. |

---

## 11. Communication

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Band Feed** | MATURE | `js/features/band-feed.js` + GLBandFeedStore (C5 Phase 1) | Band-internal social feed. |
| **Ideas page** | EMERGING | `js/features/ideas.js` | Idea capture, separate from feed. |
| **Polls** | EMERGING | embedded in feed/ideas | Pollable band decisions. |
| **Notifications page** | MATURE | `js/features/notifications.js` | Notification history surface. |
| **3-layer notification system** | MATURE | per `project_notification_system` | In-app banner + FCM push + Twilio SMS. |
| **FCM browser push** | MATURE | service-worker.js + FCM | Browser-level push. |
| **Twilio A2P SMS** | MATURE | worker.js + Twilio | Carrier-approved SMS path. |

---

## 12. Equipment, Contacts, Roster

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Equipment page** | EMERGING | `js/features/equipment.js` | Gear catalog per member. |
| **Contacts page** | EMERGING | `js/features/contacts.js` | Venue/booker/agent contacts. |
| **Stageplot page** | MATURE | `js/features/stageplot.js` | Stage diagram per venue/gig. Active Deadcetera daily workflow (reclassified 2026-05-14). |
| **Member roster** | CORE | `bands/{slug}/meta/members/` | Canonical band roster. |
| **Member readiness** | MATURE | gl-readiness.js | Per-member per-song readiness. |

---

## 13. Tuning & Click Tools

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Tuner** | MATURE | `js/features/tuner.js` | In-app chromatic tuner. |
| **Metronome** | MATURE | `js/features/metronome.js` | Tap-to-set, song-linked. |
| **Pocketmeter** | EMERGING | `js/features/pocketmeter.js` | Drummer pocket/groove visualization. |
| **Bestshot** | EMERGING | `js/features/bestshot.js` | Track-your-best-take tool. |

---

## 14. Discovery & Onboarding

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Auth gate Mode A** | CORE | `app.js` `_glCheckBandMembership` | Hard block — not authorized overlay. |
| **Auth gate Mode B** | CORE | `app.js` welcome overlay (Beta Ops) | Soft block — "I have an invite" mailto path. |
| **Beta feedback FAB** | CORE | `gl-beta-feedback.js` (Beta Ops) | In-app capture, 8 categories, snapshot attach. |
| **Help page** | MATURE | `js/features/help.js` | In-app help reference. |
| **Onboarding stats** | MATURE | Beta Ops `_glOnboardingStatsRaw` | Per-device counters for gate / invite / feedback. |
| **Runtime Health Overlay** | CORE | `gl-runtime-health.js` | `?dev=true` / Cmd+Shift+H — live diagnostic snapshot. |

---

## 15. Admin & Hidden Surfaces

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Admin page** | EXPERIMENTAL | `js/features/admin.js` | Per-band admin dashboard. Hidden from end users. |
| **Workbench** | EXPERIMENTAL | per Audit #05 | Fullscreen experimental view, 10+ callers, no nav entry. |
| **Tuner debug** | DORMANT | tuner internals | Tuner debug overlay, no nav path. |
| **Social page** | DORMANT | `js/features/social.js` | Predates Band Feed — keeps showing up. |
| **Playlists page** | EMERGING | `js/features/playlists.js` | Separate from setlists; relationship not crisp. |

---

## 16. Infrastructure (Operator-visible)

| Feature | Maturity | Where it lives | What it does |
|---|---|---|---|
| **Service Worker** | CORE | `service-worker.js` | Offline cache, build-version cache name. |
| **GLStore** | CORE | `groovelinx_store.js` | Canonical state layer. |
| **GLRouteLifecycle** | CORE | `gl-route-lifecycle.js` | Disposer pattern for route teardown. |
| **GL_PAGE_READY** | CORE | navigation.js `_navSeq` | Sequence-guarded page-ready signaling. |
| **Cloudflare Worker** | CORE | `worker.js` (deadcetera-proxy) | API proxy, Modal job orchestration, /stems/cancel. |
| **Modal serverless** | CORE | external Modal app | GPU jobs (Demucs, chord detection). |
| **R2 storage** | CORE | external Cloudflare R2 | Multitrack + stem storage. |
| **Firebase** | CORE | `gl-firebase.js` | Realtime DB + auth. |

---

_Total feature count: ~95 named features. Of these, ~32 are CORE / load-bearing; the rest spread across MATURE / EMERGING / EXPERIMENTAL — see `09_MVP_VS_EXPERIMENTAL.md` for the A/B/C/D/E classification._
