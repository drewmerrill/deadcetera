# GrooveLinx — System Map

_Build `20260514-142926`. ASCII map of how the major systems connect. Skim this when re-orienting; expand into specific docs from here._

---

## High-level topology

```
                          +---------------------------+
                          |    User device (browser)  |
                          |  index.html / index-dev   |
                          +-------------+-------------+
                                        |
              +-------------------------+--------------------------+
              |                         |                          |
              v                         v                          v
   +----------+-----------+    +--------+--------+      +----------+----------+
   |  Service Worker      |    |   App shell     |      |  Vendor (abcjs,     |
   |  (offline cache,     |    |   (JS modules)  |      |   Firebase JS SDK,  |
   |   FCM, version)      |    |                 |      |   Spotify SDK)      |
   +----------------------+    +--------+--------+      +---------------------+
                                        |
       +--------------------------------+----------------------------+
       |                                |                            |
       v                                v                            v
+------+------+               +---------+----------+      +----------+----------+
|  GLStore    | <----feeds---- |  Feature modules |      |  Audio engines      |
|  (canonical |               |  js/features/*   |      |  - GLPlayerEngine   |
|   state)    | <----events--- |  songs, rehearsal|      |  - Spotify Connect  |
|             |               |  setlists, etc.  |      |  - YT player        |
+------+------+               +---------+--------+      +----------+----------+
       |                                |                          |
       |                                v                          |
       |                       +--------+---------+                |
       +---------reads-------->|  ChartRenderer   |<-- charts/notation
                               |  (canonical)     |
                               +------------------+
```

---

## State layer

```
                  +-------------------+
                  |     GLStore       |
                  |  (canonical state)|
                  +---+---------+-----+
                      |         |
       owns           |         |        canonical
       canonical      |         |        substores
       roster + meta  |         |
                      |         +---------------------+
                      v                               |
   +------------------+----------------+              |
   | bands/{slug}/meta/members         |              v
   | bands/{slug}/songs_v2/{songId}    |    +---------+----------+
   | bands/{slug}/setlists/...         |    |  RehearsalSession  |  (C2 Phase 1)
   | bands/{slug}/feedback_reports/... |    |  GLBandFeedStore   |  (C5 Phase 1)
   | bands/{slug}/feed/...             |    |  ACTIVE_STATUSES   |
   | bands/{slug}/recordings/...       |    |  isActiveSong()    |
   +-----------------------------------+    |  getNowFocus()     |
                                            +---------+----------+
                                                      |
                                                      | emits
                                                      v
                                            +---------+----------+
                                            |  'focusChanged'    |
                                            |  event             |
                                            +---------+----------+
                                                      |
                            +-------------------------+-------------------+
                            v                         v                   v
                       Home page                Songs page         Rehearsal page
                       (subscribes)             (subscribes)       (subscribes)
```

System locks: `ACTIVE_STATUSES`, `_navSeq`, `focusChanged`, Firebase error filter. See `CLAUDE.md`.

---

## Audio + playback arbitration

```
              +--------------------+
              |  Any feature       |
              |  module that wants |
              |  to play audio     |
              +---------+----------+
                        |
                        v
              +---------+----------+
              |   pauseAll()       |  <-- Stab #07 single-owner enforcement
              +---------+----------+
                        |
        +---------------+----------------+
        |               |                |
        v               v                v
+-------+------+ +------+------+ +-------+---------+
| GLPlayerEng. | | Spotify     | | YT iframe player|
| (local mp3,  | | Connect     | | (North Star,    |
|  stems,      | | (Stab #08   | |  references)    |
|  recordings) | | chokepoint) | |                 |
+-------+------+ +------+------+ +-------+---------+
        |               |                |
        |               v                |
        |        +------+------+         |
        |        | Spotify API |         |
        |        | (proxied    |         |
        |        |  via worker)|         |
        |        +-------------+         |
        |                                |
        +---- AudioContext resume on -----+
              pageshow.persisted (Stab #11 Q.8)
```

---

## Rehearsal pipeline

```
     +-----------+
     |  Drew     |
     |  (band    |
     |   leader) |
     +-----+-----+
           |
           | plans
           v
   +-------+-------+         +----------------+
   |  Rehearsal    |-------->|  GLStore       |
   |  page         | writes  |  RehearsalSess |
   +-------+-------+         +----------------+
           |
           | launches
           v
   +-------+-------+         +----------------+
   | Rehearsal Mode|<--------|  song plan     |
   |  (fullscreen) |  reads  +----------------+
   +-------+-------+
           |
           | rec
           v
   +-------+-------+
   |  Phone /      |
   |  X32 SD card  |
   +-------+-------+
           |
           | upload
           v
   +-------+----------+      +-----------------+
   | Rehearsal-       |----->| Modal worker    |
   | recording.js OR  |      | (DSP, segment,  |
   | multitrack-      |      |  chord detect,  |
   | rehearsal.js     |      |  Demucs stems)  |
   +-------+----------+      +--------+--------+
           |                          |
           |                          | results
           v                          v
   +-------+----------+      +--------+--------+
   |  Saved timelines |<-----| Analyzer output |
   |  Chopper data    |      | + stem tracks   |
   +-------+----------+      +-----------------+
           |
           | feeds
           v
   +-------+-------+
   |  Rehearsal    |
   |  Intel page   |
   +---------------+
```

Stabs: #13 multitrack abort hardened, #14 stem jobs persistent.

---

## Setlist → Gig pipeline

```
   +---------------+        +----------------+
   | Setlists page |------->| Setlist data   |
   +-------+-------+        | (Firebase)     |
           |                +-------+--------+
           |                        |
           | Prep for Gig           |
           | (Stab #12)             |
           v                        v
   +-------+-------+        +-------+--------+
   | Pre-cache:    |        | Stage View     |
   |  - chart      |<-------| (Live Gig mode)|
   |  - North Star |        +-------+--------+
   |  - reference  |                |
   |  - song meta  |                |
   +-------+-------+                |
           |                        |
           v                        v
   +-------+------------------------+--+
   |  Local Storage / Service Worker   |
   |  (offline gig safety)             |
   +-----------------------------------+
                    |
                    | served
                    v
            +-------+--------+
            | At the gig     |
            | (no wifi)      |
            +----------------+
```

---

## Onboarding (Mode-B Phase 1)

```
    +------------+
    | User       |
    | visits URL |
    +-----+------+
          |
          v
    +-----+------------+
    | Boot membership  |
    | gate             |
    +--+-----------+---+
       |           |
   member?     not member?
       |           |
       v           v
    +--+----+   +--+--------------+
    | Home  |   | Welcome overlay |
    +-------+   | "I have invite" |
                +--+--------------+
                   |
                   | clicks
                   v
                +--+--------------+
                | Mailto Drew     |
                | with email      |
                +--+--------------+
                   |
                   | (manual)
                   v
                +--+--------------+
                | Drew adds to    |
                | bands/{slug}/   |
                | meta/members    |
                +--+--------------+
                   |
                   v
                +--+--------------+
                | User reloads,   |
                | gate passes     |
                +-----------------+

   counters at every step ---> localStorage.gl_onboarding_stats
                              (via _glBumpOnboardingCounter)
                              read via _glGetOnboardingStats()
```

---

## Stem job lifecycle (Stab #14)

```
   +----------+         +-----------+         +---------------+
   | Click    |-------->| GLStems   |-------->| Cloudflare    |
   | "make    |         | .start()  |         | Worker        |
   | stems"   |         +-----+-----+         | /stems/start  |
   +----------+               |               +-------+-------+
                              |                       |
                              v                       v
                       +------+-----+         +-------+-------+
                       | localStor: |         | Modal app:    |
                       | gl_stem_   |<--+     | groovelinx-   |
                       | jobs_active|   |     | stems         |
                       +------+-----+   |     | (Demucs GPU)  |
                              |         |     +-------+-------+
                              |   poll  |             |
                              +---------+             |
                              |                       |
                              v                       |
                       +------+--------+              |
                       | Job state:    |<-------------+
                       | processing -> |
                       | completed     |
                       +------+--------+
                              |
                +-------------+-------------+
                |             |             |
                v             v             v
            success      cancel(jobId)    error
                |             |             |
                |             v             |
                |     +-------+--------+    |
                |     | Worker         |    |
                |     | /stems/cancel  |    |
                |     | returns        |    |
                |     | 'remote' or    |    |
                |     | 'client_only'  |    |
                |     +----------------+    |
                v                           v
            stem files                  user re-tries
            in R2 +                     or removes
            UI surfaces                 from queue
```

Survives tab close: jobs in `gl_stem_jobs_active` are resumed on boot via `_resumeActiveJobsOnBoot()`.

---

## Feedback + observability

```
   +-------------+
   | Tester hits |
   | friction    |
   +-----+-------+
         |
         v
   +-----+-----------+        +----------------------+
   | Beta Feedback   |------->| GLFeedbackService    |
   | FAB (gated)     |        | .submitExplicit()    |
   +-----------------+        +---------+------------+
                                        |
                                        v
                              +---------+------------+
                              | bands/{slug}/        |
                              | feedback_reports/{id}|
                              | + betaSnapshot       |
                              +---------+------------+
                                        |
                                        v
                              +---------+------------+
                              | BETA_FEEDBACK_QUEUE  |
                              | .md (Drew triages)   |
                              +---------+------------+
                                        |
                +-----------------------+-----------------------+
                |                       |                       |
                v                       v                       v
       Stab-able now ?           bug_queue.md           memory or doc
            ship a Stab          (then bug log)         (then defer)
```

Parallel paths:

- **Avatar feedback** (`GLFeedbackService.submitExplicit`) — same destination.
- **Auto-friction** (`GLFeedbackService.recordFriction`) — render-error / repeated-failure / onboarding-stall.

---

## Runtime Health Overlay (Stab snapshots)

```
        Cmd+Shift+H  /  ?dev=true  /  gl_runtime_health
                  |
                  v
        +---------+----------+
        | GLRuntimeHealth    |
        |    .snapshot()     |
        +---------+----------+
                  |
   +--------------+------------------------------+
   |              |                              |
   v              v                              v
+--+----+   +-----+--------+              +------+-----+
| store |   | player engine|              | onboarding |
| state |   | + queue      |              | counters   |
+-------+   +--------------+              +------------+
                  |                              |
                  +------+------+-------+--------+
                         |      |       |
                         v      v       v
                  +------+-----+-+--------+
                  | prepForGig | multitrack
                  | snapshot   | stats
                  | (Stab #12) | (Stab #13)
                  +------------+--+--------+
                                 |
                                 v
                          +------+------+
                          | stems stats |
                          | (Stab #14)  |
                          +-------------+
```

---

## External integrations

```
   +-------------+
   | GrooveLinx  |
   | app         |
   +------+------+
          |
          v
   +------+--------------------------------+
   |  Cloudflare Worker (deadcetera-proxy) |
   |  - /stems/start                       |
   |  - /stems/cancel  (Stab #14)          |
   |  - Spotify proxy                      |
   |  - Twilio SMS                         |
   |  - FCM topic broadcasts               |
   +---+---+------+------+------+-----+----+
       |   |      |      |      |     |
       v   v      v      v      v     v
   +---+---+- +---+---+ ++--+-+ ++--+-+ ++--+
   |Modal  |  |Spotify|  |Twilio|  |FCM|  |R2|
   |groove |  |API    |  |A2P  |  |Push|  |  |
   |linx-  |  |       |  |10DLC|  |    |  |  |
   |stems  |  |       |  |     |  |    |  |  |
   +-------+  +-------+  +-----+  +----+  +--+
```

---

## File-level entry points (Claude orientation)

```
   index.html / index-dev.html
        |
        v
   app.js / app-dev.js
        |
        v
   js/core/groovelinx_store.js  <-- single source of truth
   js/ui/navigation.js          <-- showPage(), _navSeq
   js/core/gl-route-lifecycle.js
        |
        v
   js/features/*.js             <-- per-page modules
        |
        v
   js/core/gl-*.js              <-- shared core (chart, audio, stems...)
```

System lock list (do not modify without review):
- `js/ui/navigation.js` `_navSeq` guard
- `js/core/groovelinx_store.js` `focusChanged` event model
- `index.html` Firebase error filter
- `js/core/groovelinx_store.js` `ACTIVE_STATUSES` + `isActiveSong`

---

## Read order for re-orientation

If you're a new Claude session (or a returning Drew) and need to re-orient:

1. **00_PRODUCT_STORY.md** — why the product exists
2. **01_CORE_WORKFLOWS.md** — what musicians actually do
3. **This file (GROOVELINX_SYSTEM_MAP.md)** — how systems connect
4. **03_PAGE_GUIDE.md** — every visible page
5. **05_HIDDEN_SYSTEMS.md** — what Drew may have forgotten exists
6. **02_FEATURE_CATALOG.md** — every named feature
7. **04_USER_JOURNEYS.md** — by persona
8. **09_MVP_VS_EXPERIMENTAL.md** — what's load-bearing vs cuttable

Then go to the audit ledger (`02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_INDEX.md`) and the current phase doc (`02_GrooveLinx/CURRENT_PHASE.md`) for active work.
