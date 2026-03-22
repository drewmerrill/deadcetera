# GrooveLinx — Durable Project Knowledge
_Extracted from all sessions. Last updated: 2026-03-22_
_This document replaces session notes. It contains only timeless, actionable knowledge._

---

## 1. Architecture Decisions

### Stack (intentionally simple, do not change)
- **Frontend:** Vanilla JavaScript SPA, no framework, no build toolchain
- **Hosting:** Vercel (`app.groovelinx.com`) — auto-deploys on push to main
- **CI:** GitHub Actions — JS syntax validation + auto version stamping
- **Legacy hosting:** GitHub Pages (retired, needs redirect page)
- **Database:** Firebase Realtime Database (`deadcetera-35424`)
- **Auth:** Google Identity Services — `initTokenClient` with `email profile` scope only
- **API proxy:** Cloudflare Worker (`deadcetera-proxy.drewmerrill.workers.dev`)
- **No traditional server.** Never add one. This is a hard constraint.
- **No React, Vue, TypeScript, or build tools.** Ever. This is intentional.

### Firebase Data Layout
All band data is namespaced under `/bands/{slug}/`:
```
/bands/deadcetera/songs/
/bands/deadcetera/gigs/
/bands/deadcetera/venues/
/bands/deadcetera/setlists/
/bands/deadcetera/calendar_events/
/bands/deadcetera/rehearsal_plans/       ← shared rehearsal plans (Firebase-synced)
/bands/deadcetera/rehearsal_history/     ← plan snapshots for reuse
/bands/deadcetera/rehearsal_sessions/    ← session timing summaries
/bands/deadcetera/rehearsals/
/bands/deadcetera/schedule_blocks/       ← member availability/conflicts
/bands/deadcetera/song_pitches/          ← song intake with anonymous voting
/bands/deadcetera/care_packages_public/  ← public read, no auth required
```
`bandPath()` is the single helper that routes all refs — always use it, never hardcode paths.

### Multi-Band Architecture
- `bandPath()` routes all Firebase refs through `/bands/{slug}/`
- `currentBandSlug` stored in localStorage as `deadcetera_current_band`
- `validateBandSlug()` runs on Firebase init to auto-correct stale slugs
- 413 songs migrated to `/bands/deadcetera/` (one-time, complete)
- Invite-only join model — no public discovery

### Auth Model
- Google OAuth via `initTokenClient` — token is NOT persistent, dies on page reload
- Auto-reconnect on load: if localStorage has user email, call `handleGoogleDriveAuth(true)` with `prompt: 'none'` (silent re-auth)
- `interaction_required` error → fall back to `prompt: 'select_account'`
- Scope is `email profile` only — adding Drive scopes triggers "unverified app" screen
- OAuth client lives in GCP project "Deadcetera YouTube" (not "deadcetera-35424")
  - Client ID: `177899334738-6rcrst4nccsdol4g5t12923ne4duruub.apps.googleusercontent.com`
  - Authorized origins: `https://app.groovelinx.com`, `https://drewmerrill.github.io`, `http://localhost:8000`

### Cloudflare Worker
- Deployed as `deadcetera-proxy`, compatibility-date `2024-01-01`
- Deploy: `wrangler deploy worker.js --name deadcetera-proxy --compatibility-date 2024-01-01`
- No `wrangler.toml` in repo — always pass flags explicitly
- Secrets: `ANTHROPIC_API_KEY`, `FADR_API_KEY`, `PHISHNET_API_KEY`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- Worker proxies: Archive.org, Relisten, Phish.in, Phish.net, Spotify, Odesli, Claude AI, Care Packages
- **Never use Routes REST API from browser** — use `google.maps.DirectionsService` (JS SDK, handles auth)
- **Archive.org blocks browser fetch() silently via CORS** — always proxy through Worker

### Module Structure (after Wave-1/2/3 refactor)
```
app.js                    — core app, auth, global state (~19k+ lines)
js/core/
  firebase-service.js     — loadBandDataFromDrive, saveBandDataToDrive, GOOGLE_DRIVE_CONFIG
  worker-api.js           — all Cloudflare Worker calls
  utils.js                — shared helpers
js/ui/
  navigation.js           — showPage() at line 31 (THE navigation function — not navigateTo)
js/features/
  songs.js, gigs.js, setlists.js, rehearsal.js, practice.js
  calendar.js, notifications.js, social.js, finances.js
  bestshot.js, playlists.js, stoner-mode.js, home-dashboard.js
  song-detail.js, harmony-lab.js, pocket-meter.js
version-hub.js            — Version Hub (find-a-version command center)
rehearsal-mode.js         — Rehearsal/Practice Mode overlay
help.js                   — Help system (19 sections)
worker.js                 — Cloudflare Worker proxy
```

### Navigation
- **Correct function: `showPage()`** defined in `js/ui/navigation.js` line 31
- `navigateTo()` does NOT exist — any call to it throws ReferenceError silently
- Cross-feature navigation pattern: `showPage('gigs'); setTimeout(function(){ editGig(idx); }, 400);`

### Key Data Patterns
- **Last-write-wins Firebase** — no merge/patch on arrays. Concurrent saves clobber.
- `loadBandDataFromDrive` / `saveBandDataToDrive` are the only read/write helpers — use them
- `window._cachedSetlists` — runtime cache, must be nulled after any setlist save
- Firebase keys cannot contain `. # $ / [ ]` — `saveMasterFile` sanitizes before writing
- Song status field names: `needsPolish` (was wip), `onDeck` (was prospect), `gigReady`
- Venue data: `{ name, city, address, created }` — `venueShortLabel()` renders "Name — City"
- `_origIdx` on gig rows is the raw unsorted Firebase array index — stale after any new gig save

### CSS / Injection Model
- `app.js` injects a `deadcetera-responsive-css` style tag at runtime
- This loads after `app-shell.css`, so `!important` rules placed there reliably win the cascade
- Use this pattern for override fixes

### Push / Deploy System
- `push.py` uses Git Data API batch commit (one commit = one Pages deployment trigger)
- Reads token from `~/.deadcetera_token`
- Stamps `BUILD_VERSION` into all JS/HTML/service-worker files
- Safety guard: won't push if app.js < 90% of original line count (prevents zero-file push)
- GitHub Contents API silently returns empty content for files >1MB — `sync.py` uses blob API fallback

### Service Worker
- Cache name is `groovelinx-*` (changed from `deadcetera-*` during rebrand)
- SW update: single-click reload via `controllerchange` listener — no auto-reload
- `promptUpdate()` passes `null` as serverVersion on SW-triggered updates (version string only on polling path)
- Version polling: every 60 seconds via `checkForAppUpdate()`

---

## 2. Workflow Conventions

### Deploy Flow
```bash
glsync           # always sync first — refreshes local sha cache from GitHub
gldeploy "msg"   # deploy changed files
```
Never run `gldeploy` alone after a sha error — sha cache will still be stale.

### GL Commands (authoritative list)
| Command | What it does |
|---------|-------------|
| `gl` | Open GrooveLinx workspace |
| `gldev` | Ensure Python server on port 8000 in tmux `server`, then open workspace |
| `glinstall` | Install Claude-generated files from staging |
| `gldeploy "msg"` | Deploy to GitHub Pages |
| `glship "msg"` | Full cycle: install + deploy + smoke + close |
| `glsync` | Sync from GitHub (refresh sha cache) |
| `glsyncc` | Sync + copy to clipboard |
| `gldrop` | Move files from Downloads to staging |
| `glsmoke` | Run smoke test checklist |
| `glclose` | Close checklist |
| `glbak` | Backup current files |
| `glappjs` | Quick app.js status |

### New File Checklist (NEVER defer)
Any session that creates a new file must immediately:
1. Add it to `push.py` DEPLOY_FILES
2. Add it to `install_claude_files.sh` case statement with correct dest path
3. Verify filename appears in `gldeploy` output list

### File Patching Convention
- Preferred: `patch.py @/tmp/old.txt @/tmp/new.txt` file inputs
- Write `/tmp` files with single-quoted heredoc `<< 'PYEOF'`
- Before patching ANY file: grep it for a known recent function to confirm it's current
- Never patch a file from a stale upload — always verify provenance first

### Code Review Checklist (before any deploy)
1. `node --check` syntax validation
2. Runtime render test
3. Verify all onclick function names are defined
4. Check for ID collisions
5. Verify apostrophe escaping
6. Check cross-file refs
7. Verify service-worker cache list includes new files

---

## 3. Local Development Setup

### URLs
- **Local dev:** `http://localhost:8000` (Python server)
- **Production:** `https://drewmerrill.github.io/deadcetera/`
- **Worker:** `https://deadcetera-proxy.drewmerrill.workers.dev`

### Starting Local Dev
```bash
gl      # open workspace only
gldev   # start Python server on port 8000 in tmux window "server", then open workspace
```

### Google OAuth for Local Dev
- Add `http://localhost:8000` to Authorized JavaScript Origins on the OAuth client
- Go to: Google Cloud Console → "Deadcetera YouTube" project → Credentials → "Deadcetera Web Client"
- No redirect URIs needed for `initTokenClient` (token flow, not redirect flow)
- The API key (`AIzaSyC3...`) lives in the `deadcetera-35424` project — add `http://localhost:8000` to its HTTP referrers too

### Firebase
- Project: `deadcetera-35424`
- Rules: `care_packages_public` has public read — all other paths require auth
- `currentBandSlug` in localStorage (`deadcetera_current_band`) must equal a slug that has a `meta` node in Firebase, otherwise `validateBandSlug()` falls back to `'deadcetera'`

---

## 4. AI Collaboration Rules

### Session Start
1. Ask Drew to run `glsync` and paste output — no uploads needed for patching
2. Before touching any file, grep it for a known recent function to confirm it's current
3. If grep returns 0 hits on a function that should exist: stop and say "this doesn't look like the current file"

### Session End (Claude owns this — no exceptions)
1. Output all changed files + `uat_bug_log.md` to `/mnt/user-data/outputs/` and present with `present_files`
2. Provide a single copyable deploy command code block
3. Write session summary to memory

### iTerm Output Rule
Every command where Drew needs to paste output back must end with:
```bash
> /tmp/out.txt && cat /tmp/out.txt | pbcopy && echo "copied!"
```
Then say: "come back and ⌘+V the output (the command copies it automatically)"

### Shell Rules (zsh — CRITICAL)
- **Never put `!` inside double-quoted strings** — zsh expands it as history
- Rewrite `if (!x)` as `var t = x; if (!t)` in shell-injected JS
- Use single-quoted heredocs `<< 'PYEOF'` for Python blocks
- No clever shell tricks — boring, explicit shell only

### Coding Rules
- `let` declared in two loaded files = SyntaxError killing entire second file — use `var` for shared globals
- `innerHTML+=` destroys and recreates DOM, orphaning element refs — use `appendChild`
- Python `\U` unicode escapes write literally into JS — always use actual emoji chars
- `onclick` attrs must use single-quote escaped keys — never `JSON.stringify`
- Multiline `\n` in JS string literals = syntax error
- Large files (800+ lines): build iteratively with skeleton + `str_replace`, never `create_file` in one shot
- `str_replace` can write `\\'` as literal double-backslash — fix with Python post-processing

### What Claude Should Never Do
- Suggest cache as an issue (Drew has update banner + build numbers)
- Give `cp ~/Downloads/` commands (Drew downloads directly to repo folder)
- Run `git checkout HEAD -- app.js` (dangerous)
- Use Routes REST API from browser JS (use DirectionsService SDK instead)
- Assume an upload is current without verifying

---

## 5. Open Long-Term Design Themes

### Song Intelligence System
Each song is the central record connecting all activity:
- Five lenses per song: **Band / Listen / Learn / Sing / Inspire**
- Song connects: listening (Version Hub), learning (charts/tabs), harmony practice (Harmony Lab), band recordings (Best Shot), and live performance (Stage Crib Notes)
- Long-term data model: `songs/`, `mediaItems/`, `songMediaLinks/`, `harmonyProfiles/`, `harmonyParts/`

### Readiness & Practice Loop
- Per-member readiness scores (1-5) stored per song per member
- Heatmap: chain-link icons on song rows colored by score
- Band Readiness = aggregate score shown on home dashboard
- Practice queue = any song with status `needsPolish` / `onDeck` / `gigReady`
- Woodshed checklists per role (Solo Practice → Rehearsal Ready → Gig Night phases)
- Section-level readiness (green/yellow/red per song section)

### Setlist Builder
- Songs enriched with key + BPM for setlist planning
- Segue indicators between songs
- Filter song picker by readiness status
- Initiate setlist directly from Gig form

### Live Gig Mode (Stoner Mode)
- Big font, minimal UI
- Tap to mark song played
- Stage Crib Notes accessible per song
- Care Package: offline-safe gig data delivery via SMS link (no login required)

### Rehearsal → Gig Pipeline
- Rehearsal planner → RSVP → Practice Plan → Setlist → Gig card → Go Live → Post-gig debrief
- Calendar events sync to both `calendar_events` and `gigs` Firebase paths
- Linked gig ↔ setlist ↔ rehearsal plan should be navigable in one tap from any entry point

### Harmony Lab
- Per-song harmony assets (URLs, uploads, recordings)
- AI-generated harmony guides (ABC notation → WAV)
- Section-scoped generation (verse/chorus/bridge/jam separately)
- AB player for side-by-side comparison
- Practice mixer: solo/mute/backing/loop/slow tempo/transpose

### Groove Analysis
- Pocket Meter: spectral-flux onset detection, Tempo Stability Score
- Saves groove analysis to rehearsal record in Firebase
- Long-term: per-song groove history, improvement tracking

### Multi-Band Future
- Current: single band (`deadcetera`), multi-band architecture already deployed
- Future: groovelinx.com landing page, band creation sign-up flow, public catalog templates
- Catalog strategy: band creator picks relevant catalogs (GD/JGB/Phish/WSP etc.) at setup

### GrooveLinx as Routing Layer (not a music player)
- GrooveLinx should never attempt to become a universal music player
- It routes to the best external source (Spotify, YouTube, Archive.org, Relisten) for any song
- Internal audio is for rehearsal clips and harmony guides only

---

## Appendix: Infrastructure Quick Reference

| Thing | Value |
|-------|-------|
| Repo | `drewmerrill/deadcetera` (rename is future work) |
| Live app | `https://drewmerrill.github.io/deadcetera/` |
| Firebase project | `deadcetera-35424` |
| Firebase RTDB | `deadcetera-35424-default-rtdb` |
| Worker name | `deadcetera-proxy` |
| Worker URL | `deadcetera-proxy.drewmerrill.workers.dev` |
| OAuth client | "Deadcetera Web Client" in "Deadcetera YouTube" GCP project |
| localStorage prefix | `deadcetera_*` (migration risk if renamed) |
| Band slug | `deadcetera` |
| Band members | Drew (guitar), Chris (guitar), Brian (guitar), Pierce (keys), Jay (drums) |
| Repertoire | Grateful Dead, Jerry Garcia Band, Phish, Widespread Panic |
