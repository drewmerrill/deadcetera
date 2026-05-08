# GrooveLinx Stack Inventory

A plain-English reference for every tool, service, and library GrooveLinx depends on. Built to help someone who isn't a developer understand what each piece does, what it powers in the app, and what would break if it disappeared.

**How to import to Google Sheets:** select the table you want, copy, paste into Sheets. Markdown tables auto-split into columns.

**Last audited:** 2026-05-08

**Marketing site:** None separate. `groovelinx.com`, `/privacy.html`, `/terms.html`, `/sms-opt-in.html`, and `app.groovelinx.com` all serve from the same Vercel deployment. If a real marketing/landing site is added later, that would be a separate Vercel project (or a different host like Webflow / Framer / a `www.groovelinx.com` subdomain).

**🗺️ Visual architecture map:** [`https://app.groovelinx.com/stack-map.html`](https://app.groovelinx.com/stack-map.html) — a single-page interactive infographic showing every component on this list grouped into zones, with click-through to each vendor's dashboard. Same content as this file, optimized for browsing instead of reading. Set to `noindex,nofollow` so search engines skip it.

**🤖 Automated version checking:**
- **Dependabot** (`.github/dependabot.yml`) — auto-PRs for `npm`, `pip`, and GitHub Actions every Monday.
- **Monthly audit** (`.github/workflows/version-check.yml`) — runs `scripts/check_versions.py` on the 1st of each month, opens or updates a GitHub Issue labeled `version-audit` with a full diff. Catches the messy stuff Dependabot can't see (CDN URLs, inline pip_install pins).

---

## How to read this

Each table has the same columns:

- **Component** — the name of the thing.
- **What it is (plain English)** — one or two sentences describing the tool without jargon.
- **What GrooveLinx uses it for** — specific features in our app that depend on it.
- **Where it runs** — your phone, a Cloudflare server, Modal's GPU cluster, etc.
- **Cost model** — free, pay-per-use, monthly subscription.
- **Current** — the version we run today.
- **Latest** — the newest version available (where applicable).
- **Vendor** — the company or open-source community behind it.
- **If it breaks** — what users would see if this piece went down.
- **Docs** — where to learn more.

---

## 1. Frontend (runs in the band's browsers)

What loads onto your iPhone / laptop when you open `app.groovelinx.com`.

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Latest | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|---|
| **Vanilla JavaScript** | The standard programming language all web browsers can run, with no extra framework wrapped around it. | Every screen of the app — Songs, Calendar, Setlists, Rehearsal Mode, Live Gig, Stems, Harmony Lab. We chose vanilla over React/Vue to keep the app small and fast. | Browser | Free | n/a (built into browsers) | n/a | n/a (web standard) | The whole app stops working. | https://developer.mozilla.org/en-US/docs/Web/JavaScript |
| **HTML / CSS** | The markup and styling languages that describe what the app looks like. | Page layout, dark mode, mobile responsive design, the iPhone safe-area handling we shipped on 2026-05-07. | Browser | Free | HTML5 / CSS3 | n/a | Web standards | Visual layout breaks but data still flows. | https://developer.mozilla.org/en-US/docs/Web/HTML |
| **Service Worker** (`service-worker.js`) | A small script the browser runs in the background even when the app isn't open. It caches files and intercepts network requests. | Offline-for-gig caching ("Prep for Gig" button), push notification reception, fast app startup, version cache-busting. | Browser (background) | Free | n/a (custom code) | n/a | Web standard | Slower loads, no offline mode, no push notifications. | https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API |
| **Firebase JS SDK (compat)** | Google's library that lets the browser talk to Firebase Realtime Database, Cloud Messaging, and Storage. "Compat" is the older API shape we still use. | Reading and writing every band's data: songs, gigs, members, rehearsal sessions, calendar events, RSVPs, readiness scores. Also: receiving FCM push notifications. | Browser | Free | **10.12.0** | 12.x | Google | App can't load any band data — blank Songs page, blank Calendar, no notifications. | https://firebase.google.com/docs/web/setup |
| **abcjs** | A library that takes ABC notation (a text format for music: `"C"DEF\|G2A2\|`) and renders it as actual sheet music. | Drawing the lead notation in Harmony Lab, rendering chord-line excerpts in song detail. | Browser (loaded on-demand from CDN) | Free | **6.6.3** | 6.6.x | Open-source (Paul Rosen + community) | Harmony Lab notation page goes blank; chord charts still work. | https://www.abcjs.net/ |
| **Tone.js** | A Web Audio toolkit for in-browser audio manipulation: pitch shift, tempo change, mixing, effects. | The Stems lens mixer — adjust pitch and tempo of each stem independently while keeping them in sync. | Browser (loaded on-demand from CDN) | Free | **15.1.22** (latest) | 15.1.22 | Open-source (Yotam Mann) | Stems lens loses pitch/tempo controls; basic playback still works. | https://tonejs.github.io/ |
| **Google Maps JS API** | Google's library for rendering maps and looking up venue addresses. | Venue location lookup when adding a gig (so addresses geocode + show on a map). | Browser (loaded from Google CDN) | Free tier covers our usage | weekly (auto-updated) | weekly | Google | Venue map renders blank; gig date/time still saves. | https://developers.google.com/maps/documentation/javascript |
| **Contentsquare** | A user-experience analytics tool that records anonymous session replays so we can see where people get stuck. | UX research / hesitation tracking. Helps Drew see where bandmates struggle. | Browser (vendor script) | Vendor's free tier | site-pinned hash | n/a | Contentsquare (company) | Lose UX analytics; app functionality unaffected. | https://contentsquare.com/ |

---

## 2. Hosting & CDN (where the app's files live)

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Latest | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|---|
| **Vercel** | A cloud platform that hosts websites and auto-deploys them every time you push code to GitHub. | Hosts `app.groovelinx.com` and `dev.groovelinx.com`. When you `git push`, Vercel rebuilds and serves the new version within ~30 seconds. | Vercel's edge network (~30 cities globally) | Free tier sufficient for our traffic | linked to project `groovelinx` | n/a | Vercel | Whole app goes dark — `app.groovelinx.com` returns 5xx until restored. | https://vercel.com/docs |
| **`vercel.json`** | A small config file in our repo that tells Vercel how to route requests (e.g. fall back to `index.html` for any unknown path, since we're a single-page app). | SPA routing for `/songs`, `/calendar`, etc. — ensures clicking a deep link works. Cache-control headers for `service-worker.js` and `version.json`. | Repo (read by Vercel on deploy) | Free | current | n/a | n/a | Refreshes break (cache too aggressive), or deep links 404. | https://vercel.com/docs/project-configuration |
| **GitHub** | Code hosting platform owned by Microsoft. Stores every version of every file in our codebase. | Source of truth for all GrooveLinx code. Auto-triggers Vercel deploys on push. Hosts our work-tracking issues + Project board. | GitHub's servers | Free for public repos / paid for private | n/a | n/a | GitHub (Microsoft) | Can't push new code; deployed app keeps running. Catastrophic if account gets suspended. | https://github.com |
| **GitHub Actions** | GitHub's built-in CI runner. Automatically validates code on every PR. | Runs `validate.yml` workflow that syntax-checks all JS files and counts script tags in HTML to catch merge-conflict bloat. | GitHub-hosted runners (Ubuntu) | Free tier sufficient | actions/checkout@v5, actions/setup-node@v5, Node 24 | latest | GitHub | Tests don't run on PRs; bad code can merge undetected. | https://docs.github.com/actions |

---

## 3. Backend / "Server" code

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Latest | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|---|
| **Cloudflare Worker** (`worker.js`, deployed as `deadcetera-proxy`) | A tiny server program that runs at Cloudflare's edge locations, very close to wherever the user is. Acts as a middleman between the browser and various external APIs so we don't expose secret API keys. | Routes for: Twilio SMS sending, Anthropic Claude (GrooveMate brain), Fadr (harmony MIDI), YouTube/Spotify/Genius search, Archive.org/Phish.net/Phish.in/Relisten, Odesli music links, MIDI→ABC conversion, FCM push send, Deepgram transcription, ElevenLabs TTS, Drive file streaming, OpenAI image generation. **Also serves two public-facing routes via custom subdomains:** (a) `share.groovelinx.com/stageplot/{bandSlug}/{plotId}` → standalone HTML stage-plot view for FOH engineers / venue contacts who don't have GrooveLinx accounts; reads `bands/{slug}/stage_plots` from Firebase RTDB REST and renders read-only HTML/CSS. (b) `/ical/{bandSlug}` → live ICS calendar feed that any external calendar app (Google, Apple, Outlook) can subscribe to for the band's gig schedule. | Cloudflare's edge (300+ cities) | Free tier (100k requests/day) | live, compatibility_date 2026-04-10 | rolling | Cloudflare | Almost every external lookup breaks; public stage-plot share URLs and ICS feeds also break. App's own data flow keeps working. | https://developers.cloudflare.com/workers |
| **Cloudflare R2** | Object storage (like Amazon S3 but cheaper). Holds large binary files like audio. | Stores Demucs-separated stems for every song. Bucket: `groovelinx-stems`. Public URL: `stems.groovelinx.com`. | Cloudflare's storage layer | $0.015/GB-month, generous free tier on egress | bucket `groovelinx-stems` | n/a | Cloudflare | Stems lens can't load any stems — silent player. Stems would have to be re-separated to repopulate. | https://developers.cloudflare.com/r2 |
| **Cloudflare DNS** | The system that translates `app.groovelinx.com` into a server's IP address. | Manages all `*.groovelinx.com` DNS records. | Cloudflare | Free | live | n/a | Cloudflare | Domain stops resolving — no one can reach the app even if Vercel is fine. | https://developers.cloudflare.com/dns |
| **Firebase Realtime Database (RTDB)** | Google's cloud database that keeps the same data in sync across every device that's signed in. When one user changes a setlist, every other user's screen updates within seconds. | Source of truth for ALL band data: songs, members, gigs, calendar events, setlists, rehearsal sessions, readiness scores, RSVPs, push subscriptions, sync state. | Google Cloud (us-central1 region) | Pay-as-you-go on Blaze plan; free tier within reach for our usage | live, project `deadcetera-35424` | n/a | Google | App can't read or write any data — songs page blank, calendar blank, can't save changes. | https://firebase.google.com/docs/database |
| **Firebase Cloud Functions** | Google service that runs your server-side code in response to events (database writes, HTTP requests, scheduled times). Scales to zero (you pay nothing when idle). | The `mirrorMemberToIndex` function we just shipped — automatically maintains the `members_index` lookup table whenever a band's roster changes. Powers the O(1) auth gate. | Google Cloud (us-central1) | Free tier (2M invocations/month) — way more than we need | mirrorMemberToIndex on Node 24, firebase-functions ^7, firebase-admin ^13 | Node 24 / firebase-functions ^7 | Google | The members_index drifts if rosters change. Existing users still sign in fine; new members might sign in to the wrong band until next manual fix. | https://firebase.google.com/docs/functions |
| **Firebase Cloud Messaging (FCM)** | Google's push notification system. Lets the app send notifications to phones / browsers even when the app isn't open. | Layer 2 of the notification system: browser push notifications for rehearsal reminders, gig changes, polls. | Google Cloud + each user's device | Free | active | n/a | Google | No push notifications. SMS (Layer 3) and in-app banner (Layer 1) keep working. | https://firebase.google.com/docs/cloud-messaging |
| **Firebase Storage** | File hosting service for things too big for the database (audio, PDFs, images). | Practice mix uploads, archived recording snippets, exported stage plot PDFs. | Google Cloud | Pay-as-you-go (cheap for our scale) | active | n/a | Google | File uploads/downloads fail; data in RTDB is fine. | https://firebase.google.com/docs/storage |
| **Firebase Authentication** | Google's identity service that proves who a user is. | **Not currently used** — we sign users in with Google OAuth directly without going through Firebase Auth. This is why our database rules can't use `auth != null`. | Google Cloud | Free | not wired | n/a | Google | n/a — we don't depend on it | https://firebase.google.com/docs/auth |

---

## 4. AI / ML services (the heavy compute)

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Latest | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|---|
| **Modal** | A serverless platform for Python code. You write a Python function, Modal runs it on a GPU/CPU in the cloud only when called — no servers to manage. | Hosts our 3 Python services: stem separator (Demucs), chord analyzer (Essentia), audio embeddings (HuggingFace transformers). Each service spins up a GPU on-demand and shuts down after. | Modal cloud (their data centers) | Pay-per-second on T4 GPU (~$0.005/song stem-sep) | account active, 1 service deployed (`groovelinx-stem-separator`), 2 ready to deploy | latest | Modal Labs | Stems lens can't separate new songs (existing R2-cached stems still play); chord analyzer + embeddings unavailable. | https://modal.com/docs |
| **Demucs / HT-Demucs** | A state-of-the-art neural network that separates a song into individual stems (drums, bass, vocals, guitar, piano, "other"). | The Stems lens — every song you separate runs through Demucs. Result: 6-track mixer where you can solo bandmates' parts. | Modal GPU (T4) | Compute time only | **htdemucs_6s** v4.0.1 | 4.0.1 (no successor) | Open-source (Meta/Facebook research) | Stem separation breaks. Existing stems keep working. | https://github.com/facebookresearch/demucs |
| **PyTorch + torchaudio** | Python's premier deep-learning framework. Demucs is built on top of it. | Required by Demucs to actually run the neural network. | Modal GPU | n/a | 2.1.2 (pinned by Demucs compat) | 2.6+ | Open-source (Meta) | Demucs can't run; same as Demucs failure. | https://pytorch.org |
| **Essentia** | An open-source music analysis toolkit. Detects tempo, key, chord changes, and other musical features. | Powers the (not-yet-deployed) chord-analysis service that auto-detects BPM, key, and chord progressions. | Modal CPU | n/a | 2.1b6.dev1110 (beta dev build) | 2.1b6.devXXXX | Open-source (Music Tech Group, UPF Barcelona) | Auto-detected BPM/key/chords unavailable; manual entry still works. | https://essentia.upf.edu |
| **HuggingFace transformers + librosa** | Tools for loading pre-trained audio models and doing audio analysis. | Powers the (not-yet-deployed) audio-embeddings service for song similarity matching and tone fingerprinting. | Modal GPU | n/a | transformers >=4.36, librosa >=0.10 | 4.50+ / 0.10.x | Open-source (HuggingFace, librosa team) | Tone fingerprinting (Phase 2 spatial split) and song similarity unavailable. | https://huggingface.co/docs/transformers |
| **LALAL.AI** | A commercial vocal-isolation service that splits lead and backing vocals more cleanly than open-source tools. | Lead/backing vocal split for Harmony Lab. We use this instead of Demucs because it produces cleaner stems for harmony singers learning their parts. | LALAL.AI cloud | $50 prepaid pack ≈ 190 songs | active, key in worker secret `LALAL_API_KEY` | n/a | LALAL.AI (company) | Harmony Lab can't process new songs; existing splits cached in R2 still work. | https://www.lalal.ai/api/help/ |
| **Anthropic Claude API** | The AI model behind Claude. We call it server-side from the worker. | Powers GrooveMate — the cross-app decision engine that suggests "you've been looping this section, want to record it?" or "next gig is in 3 days, here's the song with weakest readiness." | Anthropic's cloud (via worker proxy) | Pay-per-token | model pinned in worker.js | Claude 4.7 Opus / Sonnet 4.6 / Haiku 4.5 | Anthropic | GrooveMate suggestions stop. Avatar action router still works for direct commands. | https://docs.anthropic.com/claude/reference/getting-started-with-the-api |
| **Fadr** | A commercial API that extracts MIDI per harmony voice from audio. | **Still in use, but demoted role.** Originally the primary lead/backing audio splitter for Harmony Lab; the 2026-04-30 bake-off proved Fadr only outputs MIDI (not separate audio stems), so LALAL.AI took the audio split role and Fadr is now used only for the MIDI-per-harmony notation seed. Worker routes `/fadr/*` and `/fadr-diag` still active. | Fadr cloud (via worker proxy) | Subscription | active, key in worker | n/a | Fadr (company) | Harmony Lab notation MIDI seed unavailable; LALAL audio splits still work. | https://fadr.com |
| **Basic Pitch** | A model from Spotify that converts audio to MIDI in the browser (no server needed). | Generates MIDI from LALAL `lead.mp3` for the Harmony Lab notation. | Browser (WASM) | Free | bundled in app.js | latest | Open-source (Spotify) | Lead notation generation breaks; existing MIDI cached in Firebase still renders. | https://basicpitch.spotify.com/ |

---

## 5. Third-party APIs (data sources)

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|
| **Google OAuth** | Google's "Sign in with Google" service. | The way every band member authenticates. Also grants the app permission to access their Calendar / Drive / Gmail when needed. | Google's auth servers | Free | active, configured in worker | Google | No one can sign in. App is unreachable. | https://developers.google.com/identity/protocols/oauth2 |
| **Google Calendar API** | Programmatic access to a user's Google Calendar. | The two-way calendar sync — pulls each member's busy times, pushes the band's gigs/rehearsals to a shared band calendar. | Google Cloud (via worker proxy) | Free | active | Google | Calendar sync breaks; manual schedule entry still works. | https://developers.google.com/calendar |
| **Google Drive API** | Programmatic access to a user's Google Drive files. | Audio + media file storage — Drive Picker (`gl-drive-picker.js`), Best Shot reference recordings (`bestshot.js`), rehearsal audio loading (`rehearsal.js`), public-Drive file fetch via worker `/drive/` route. **Note:** band JSON state lives in Firebase RTDB; the function `saveBandDataToDrive` is misleadingly named (it writes to RTDB, not Drive — legacy name from when the app did use Drive for state). | Google Cloud | Free | active | Google | File-picker + audio loads break; primary RTDB still works. | https://developers.google.com/drive |
| **YouTube Data API + yt-dlp** | YouTube's official search API + a Python tool that can download audio from YouTube videos (used as a fallback). | Source picker for stem separation when a user pastes a YouTube URL. The `youtube-search` worker route, then yt-dlp on Modal handles the actual audio fetch. | Worker + Modal | Free (YouTube quota) / yt-dlp is open-source | active | YouTube + yt-dlp project | Can't ingest songs from YouTube URLs; direct file uploads still work. | https://developers.google.com/youtube/v3 |
| **Spotify Web API** | Spotify's API for searching tracks. | Worker `/spotify-search` route — used to find canonical song metadata (BPM, duration, artwork). | Spotify cloud | Free (client credentials, low rate limit) | active | Spotify | Spotify-sourced metadata unavailable; manual entry still works. | https://developer.spotify.com/documentation/web-api |
| **Genius.com API** | API for song lyrics + meanings. | Lyric lookup + song meaning context for the avatar / song detail. | Genius cloud (via worker) | Free tier | active | Genius (Rap Genius) | Lyric/meaning lookups break; song detail still functions. | https://docs.genius.com |
| **Archive.org API** | Internet Archive's API for live concert recordings. | Source for Grateful Dead / Phish / etc. live recordings — the "Find this song in a live show" feature. | Archive.org (via worker) | Free | active | Internet Archive (nonprofit) | Live-recording lookup breaks; studio sources still work. | https://archive.org/services/docs/api/ |
| **Phish.net** | A fan-maintained database of every Phish setlist, jam chart, and song history since 1983. | Worker `/phishnet-jamchart` route — pulls jam chart data ("which version of this song is best") for the song detail page. | Phish.net (via worker) | Free | active, key in worker secret | Phish.net (volunteer-run nonprofit) | Phish jam chart context disappears; other sources unaffected. | https://docs.phish.net |
| **Phish.in** | Streaming archive of every Phish concert recording. | Worker `/phishin-search` route — finds Phish-specific live audio for any song the band covers. | Phish.in (via worker) | Free | active | Phish.in (fan-run) | Phish-specific live audio unavailable; Archive.org and Relisten still work. | https://phish.in/api-docs |
| **Relisten** | Streaming archive for jam bands — Grateful Dead, Phish, Almanac, etc. (overlap with Archive.org but different curation). | Worker `/relisten-search` route — alternative live-audio source for the band's repertoire. | Relisten cloud (via worker) | Free | active | Relisten (fan-run) | One alternative live source disappears; others fill in. | https://relisten.net |
| **Odesli (Songlink)** | Cross-platform music link converter. Give it a Spotify URL, it returns Apple Music / YouTube / etc. | Music link normalization — band can paste any service link and we resolve to all platforms. | Odesli cloud (via worker) | Free tier | active | Odesli (company) | Cross-platform links break; original-platform link still works. | https://odesli.co/api |
| **Ultimate Guitar** | The largest crowd-sourced tab and chord chart database online. | **Deep-link target only — no API integration.** The Songs page, bulk import (`bulk-import.js`), and chart-source buttons (`song-detail.js`) construct `https://www.ultimate-guitar.com/search.php?search_type=title&value=...` URLs and open them in new tabs. Source attribution is detected from the URL via `groovemate_tools.js` and `charts.js` for the "chart source" labeling. Not proxied through the worker. | Browser (new-tab open) | Free | active | Ultimate Guitar (company, owned by Muse Group) | Search links open to a 404; user can manually search elsewhere. | https://www.ultimate-guitar.com |
| **Instagram / Facebook / TikTok / X (Twitter)** | Major social platforms. | **Deep-link targets only — no API integration.** `js/features/social.js` renders link-out chips for whichever profiles each band has filled into their meta. Used for sharing the band's social presence on the public-facing surfaces. | Browser (new-tab open) | Free | active | Meta / TikTok / X | Profile chips deep-link to a 404; band loses outbound social discovery. | https://www.instagram.com |
| **Bandcamp + SoundCloud** | Independent-artist hosting platforms. We don't have direct API integrations — yt-dlp on Modal handles ingestion if a user pastes one of their URLs into the stems source picker. | Source URL fallback for stem separation when a user shares a Bandcamp or SoundCloud link instead of a direct audio file. | Modal (via yt-dlp) | Free | active via yt-dlp | Bandcamp / SoundCloud | If either site changes its embed format, yt-dlp updates daily so the fix usually arrives within a day. | https://bandcamp.com / https://soundcloud.com |
| **Anthropic Claude API** *(also listed in §4)* | The AI model behind GrooveMate. | Worker `/claude` route — proxies all Claude calls so the API key stays server-side. | Anthropic (via worker) | Pay-per-token | active, model pinned in worker.js | Anthropic | GrooveMate suggestions stop. | https://docs.anthropic.com |
| **Deepgram** | A specialized speech-to-text API focused on accuracy and speaker diarization (knowing who said what). | Worker route using `nova-3` model with smart-format + punctuation + diarization. Likely powering rehearsal recording transcription / voice memos. | Deepgram cloud (via worker) | Pay-per-minute of audio | active, key in worker secret | Deepgram (company) | Voice transcription unavailable; recordings still save. | https://developers.deepgram.com |
| **ElevenLabs** | A text-to-speech service with very natural-sounding voices. | Worker route using their TTS endpoint — likely powering audio guidance, avatar speech, or rehearsal playback narration. | ElevenLabs cloud (via worker) | Pay-per-character (~$5-22/mo for typical use) | active, key in worker secret | ElevenLabs (company) | Synthesized voice features go silent. | https://elevenlabs.io/docs |
| **OpenAI (gpt-image-1)** | OpenAI's image-generation model (the one behind ChatGPT Plus image gen). | One-time use by `services/iconforge/generate.py` to produce the 25 photorealistic stage-plot instrument icons. ~$1.75 total. Not called at runtime — only when regenerating icons. After generation, `services/iconforge/optimize.sh` runs the icons through macOS's built-in `sips` command (Scriptable Image Processing System) to downscale 1024×1024 → 256×256 (~40KB each, ~50× smaller). | OpenAI cloud (one-shot script) | Pay-per-image (~$0.07 each at quality=medium) | one-time-run; icons stored in `js/assets/stageplot/icons/` | OpenAI | n/a — icons are static files now. | https://platform.openai.com/docs/api-reference/images |
| **QR Server** (`api.qrserver.com`) | A free public QR-code generator API. | Generates QR codes — likely for sharing setlists, gig invites, or onboarding band members via a scannable link. | qrserver.com (via worker) | Free | active | qrserver.com | QR codes don't render. | https://goqr.me/api |
| **Twilio SMS API** | Twilio is the largest SMS gateway in the US. | Layer 3 of the notification system — sends real text messages to band members for important alerts (gig changes, rehearsal reminders). Currently in A2P 10DLC carrier review. | Twilio cloud (via worker) | $0.0083 per SMS sent + monthly fees for phone number | active, MessagingService configured | n/a | Twilio | SMS notifications stop; FCM push + in-app banner still work. | https://www.twilio.com/docs/sms |
| **IPRoyal residential proxy** | A pool of residential IP addresses we rent to bypass YouTube's bot detection on cloud servers. | Used by yt-dlp on Modal so YouTube doesn't block our cloud requests. | IPRoyal infrastructure | $7-15/month for the small pool we need | active, key in worker secret | IPRoyal | YouTube downloads from cloud start failing with bot challenges. | https://iproyal.com |

---

## 6. Tooling on Drew's machine

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Latest | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|---|
| **Node.js** | The JavaScript runtime that lets JS run outside a browser (on a server, on your laptop, etc.). | Your local environment for running tooling (firebase-tools, vercel CLI, npm). | Drew's Mac | Free | **25.8.1** | 24 (LTS), 25 (current) | OpenJS Foundation | Can't run any local tooling; doesn't affect deployed app. | https://nodejs.org |
| **npm** | The package manager that installs JavaScript libraries. Comes with Node.js. | Installs firebase-tools, vercel, modal-related packages, dependencies in `functions/` and root. | Drew's Mac | Free | **11.11.0** | 11.11.0 | OpenJS Foundation | Can't install packages; existing installs keep working. | https://docs.npmjs.com |
| **firebase-tools (Firebase CLI)** | Command-line tool for interacting with Firebase. Deploys functions, manages rules, lists projects. | Deploying `mirrorMemberToIndex` Cloud Function. Will be used for any future functions. | Drew's Mac | Free | **15.17.0** | 15.17.0 | Google | Can't deploy or manage Firebase from CLI; web console still works as fallback. | https://firebase.google.com/docs/cli |
| **Modal CLI** | Command-line tool for deploying and managing Modal services. | Deploying the stem separator and (eventually) chord-analysis + audio-embeddings. | Drew's Mac | Free | **1.4.2** | 1.4.x | Modal Labs | Can't deploy Modal services; deployed services keep running. | https://modal.com/docs |
| **Vercel CLI** | Command-line tool for managing Vercel deployments. | Optional — auto-deploy on git push works without it. Useful for env vars, preview deploys, log streaming. | Drew's Mac | Free | **53.x** (just bumped from 50.34.3) | 53.2.0 | Vercel | Can't manage Vercel from CLI; auto-deploys via git keep working. | https://vercel.com/docs/cli |
| **Wrangler** (cached locally; not actively used) | Cloudflare's CLI for Workers. We don't use it — Drew paste-deploys via the Cloudflare dashboard instead. | n/a (paste-deploy workflow). | Drew's Mac | Free | unused | latest | Cloudflare | n/a | https://developers.cloudflare.com/workers/wrangler |
| **Git** | The version-control system every modern codebase uses. | Tracks every change to every file. Powers `git push` → Vercel auto-deploy. | Drew's Mac | Free | macOS bundled | 2.x | Git project | Can't commit / push code; deployed app keeps running. | https://git-scm.com |
| **GitHub CLI (`gh`)** | Command-line tool for GitHub operations. | Creating issues, listing PRs, viewing project boards from terminal. Used in the GitHub Issues + Project board workflow we set up 2026-05-07. | Drew's Mac | Free | (whatever was installed) | 2.x | GitHub | Can't manage GitHub issues from CLI; web UI still works. | https://cli.github.com |

---

## 7. Testing / CI

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it runs | Cost | Current | Latest | Vendor | If it breaks | Docs |
|---|---|---|---|---|---|---|---|---|---|
| **Playwright** | A browser-automation framework for end-to-end tests. Drives a real Chrome / Safari / Firefox to click through the app the way a human would. | E2E test suite (`npm run test`). Catches regressions before they hit production. | Drew's Mac (or CI) | Free | **^1.59.1** | 1.59.1 | Microsoft | E2E tests don't run; manual testing still works. | https://playwright.dev |
| **WebKit binary** (Playwright) | The Safari engine, downloaded as a separate binary so Playwright can drive it for cross-browser tests. | iPhone Safari emulation in tests. | Drew's Mac | Free (size ~80 MB) | 26.4 (just downloaded) | latest | Apple (binary) | iOS test path breaks; Chrome path keeps working. | https://playwright.dev/docs/browsers |

---

## 8. Build / deploy artifacts (in our repo)

| Component | What it is (plain English) | What GrooveLinx uses it for | Where it lives | Notes |
|---|---|---|---|---|
| **`version.json`** | A tiny JSON file with the current build version, served at the root. | Used by the app to detect when a new build has shipped (so it can prompt for a hard reload). Also one of 4 sources we bump on every deploy. | repo root | Atomic with `index.html`, `index-dev.html`, `service-worker.js`. |
| **`<meta name="build-version">`** | A meta tag in `index.html` carrying the current build version. | Read by app.js and the dynamic console banners we shipped tonight. The single source of truth in the running app. | `index.html` line 4 | Was hardcoded in 4 JS files; now read at runtime from this tag. |
| **`service-worker.js`** | The actual Service Worker code (see frontend table). | Caches files, serves push notifications. Cache name embeds the build version for cache busting. | repo root | Bumps in lockstep with the build. |
| **`firebase.json` + `.firebaserc`** | Firebase CLI config: what to deploy, which project to deploy to. | Tells the firebase CLI: "the `functions/` folder is the codebase, deploy to project `deadcetera-35424`." | repo root | Created tonight. |
| **`functions/`** | A subfolder containing all our Firebase Cloud Functions code. | Contains `mirrorMemberToIndex` (today). Future server-side logic lands here. | `functions/` | Node 24, firebase-functions ^7. |
| **`worker.js`** | The Cloudflare Worker source code. | Drew copies this file into the Cloudflare dashboard to deploy. (Not picked up automatically — paste-deploy.) | repo root | ~1700 lines. Deploy = Drew opens dashboard, paste, save. |

---

## How it all fits together (a typical user action)

**Scenario: Drew taps "Practice Now" on the Songs page.**

1. **Browser** loads `app.groovelinx.com` → served by **Vercel**.
2. **Service worker** serves cached app shell → near-instant load.
3. **Firebase JS SDK** opens a websocket to **Firebase RTDB** to read the song record.
4. App routes to song detail page (using its own `showPage()` router — vanilla JS).
5. User clicks **Stems lens** → app fetches stem URLs from RTDB.
6. **Cloudflare R2** serves the stem audio files (cached in **Cloudflare's edge** for fast download).
7. **Tone.js** wires up the audio context and plays the stems with sync.
8. User loops a section → app records to localStorage and writes a record to RTDB.
9. **Cloud Function** `mirrorMemberToIndex` is silent here (only triggered by member roster changes).
10. **Anthropic Claude** is consulted by GrooveMate after 3 loop reps to suggest "want to deepen this section?"

**Scenario: Drew adds a new band member.**

1. Drew edits the band's `meta/members` in the app or Firebase Console.
2. **Firebase RTDB** receives the write.
3. **Cloud Function** `mirrorMemberToIndex` fires (it's listening to that path).
4. It writes to `members_index/{sanitized_email}: bandSlug` using admin SDK.
5. The new member signs in → **Google OAuth** → **app.js gate** does **one read** of `members_index` → routes them to the right band.

---

## Cost summary (rough monthly bill)

| Bucket | Approx monthly | Notes |
|---|---|---|
| Vercel | $0 | Free tier covers traffic |
| Firebase | ~$0-7 | Pay-as-you-go on Blaze. Database egress was the 2026-05-07 spike; should be $0 going forward post-gate-fix |
| Cloud Functions | $0 | 2M invocations free; we'll do ~10/month |
| Cloudflare Workers + R2 | ~$0-2 | Free tier mostly covers; R2 storage scales with stem catalog |
| Modal | ~$0.50-2 | $0.005/song stem-sep × songs/month |
| Twilio | ~$1-3 | Phone number ~$1/mo + per-SMS pennies |
| LALAL.AI | $0 (prepaid) | $50 pack ≈ 190 songs, runs out in months |
| IPRoyal | ~$7-15 | Smallest residential proxy pack |
| Anthropic Claude | varies | Pay-per-token, GrooveMate calls are small |
| Domain registration | ~$1/mo | `groovelinx.com` annual fee |
| **Total** | **~$10-30/mo** | At current band size and usage |

---

## 9. Drew's Workflow Tools

These aren't part of GrooveLinx's runtime — users never touch them. They're the apps Drew uses to build, ship, debug, and operate the system.

| Tool | What it is (plain English) | Used for | Cost | Primary URL |
|---|---|---|---|---|
| **macOS 26.4.1** | Apple's desktop operating system. | Drew's primary work computer; everything else lives on top of it. | included with Mac | https://www.apple.com/macos |
| **iTerm2** | A more capable replacement for macOS's built-in Terminal app. Tabs, split panes, search, custom themes. | Running every CLI command (git, firebase, modal, vercel, npm, gh). Note: the wrap-on-copy bug we worked around tonight (`sanitizeFi\nrebasePath`) is from iTerm2 inserting newlines at wrap points. | Free | https://iterm2.com |
| **Claude Code** | Anthropic's command-line AI coding assistant — what we're using right now. | Pair programming sessions, debugging, writing docs, multi-step refactors like tonight's gate cutover. | Subscription via claude.ai/Pro/Max plans | https://claude.ai/code |
| **ChatGPT** | OpenAI's flagship AI assistant. | Second-opinion code reviews (the Phase 1 stems plan was ChatGPT-reviewed; the Rehearsal page UX got a 7-point ChatGPT critique). Stress-testing proposals before committing to them. | Free / Plus $20/mo / Team $30/mo | https://chat.openai.com |
| **Google Gemini** | Google's AI assistant, embedded in Chrome and accessible standalone. | Quick lookups while in-browser ("Ask Gemini" button); cross-checking technical claims. Complements Claude / ChatGPT for diversity of opinion. | Free / Advanced $20/mo | https://gemini.google.com |
| **Code editor** (VS Code / Cursor / Sublime / etc.) | Where you actually edit JS/HTML/CSS/Python files outside of CLI tools. | Editing the GrooveLinx codebase. (Fill in your specific editor here — common choices are VS Code, Cursor, Sublime Text, or BBEdit.) | Free or paid depending on choice | https://code.visualstudio.com |
| **Google Chrome** | Google's web browser. | Primary testing browser; DevTools console for the snippets we paste; Network tab for inspecting Firebase / worker traffic. | Free | https://www.google.com/chrome |
| **Safari (desktop + iPhone)** | Apple's browser. | Testing the iPhone-specific behavior — Safari has the strictest autoplay rules and unique audio quirks (every Phase 2 stems iPhone fix tells the story). | Free | https://www.apple.com/safari |
| **Xcode + iOS Simulator** | Apple's iOS development environment. The Simulator runs a virtual iPhone on your Mac. | Testing the PWA on a simulated iPhone before pushing changes to band devices. Required for installing iOS profile certs / dev builds. | Free | https://developer.apple.com/xcode |
| **iPhone Mirroring** | macOS feature (Sequoia+ / iOS 18+) that displays your real iPhone on your Mac so you can drive it with your keyboard, mouse, and copy/paste. | Testing GrooveLinx on real iPhone Safari without having to pick up the phone — drives the actual device, not a simulator, so it surfaces real-device-only quirks (iOS gesture conflicts, autoplay policy, battery throttling). | included with macOS Sequoia | n/a |
| **Rectangle** | Open-source macOS window manager — snap windows to halves, quarters, thirds, etc. with keyboard shortcuts. | Multi-window debugging workflow: terminal + browser + Firebase console + DevTools all visible at once instead of constant Cmd-Tab. Quality-of-life, not load-bearing. | Free (paid Pro version available) | https://rectangleapp.com |
| **Loom** | Browser-based screen + webcam recorder, hosted in the cloud. Generates a shareable link. | Recording the bandmate-onboarding walkthrough script (per `02_GrooveLinx/notes/bandmate_onboarding.md`). Async demos for testers. | Free tier + paid tiers ($12.50/mo) | https://www.loom.com/login |
| **CleanShot X** | macOS screenshot + screen recording app — way more capable than the built-in `Cmd+Shift+4`. Annotations, scrolling capture, GIF export, hosted sharing. | Capturing the screenshots you've been pasting in this session (Firebase Console, terminal output, browser DevTools). | One-time purchase ~$29 / Setapp included | https://cleanshot.com |
| **TextEdit** | macOS's built-in plain-text editor. | Quick-and-dirty file edits when a full code editor is overkill. Reading log files, scratch notes. | included with macOS | n/a |
| **Google Calendar (web)** | Browser interface to Google Calendar. | Setting up the band calendar, granting share access to bandmates, manual event edits when the GrooveLinx UI doesn't cover it. (The same calendar is *also* synced via the Google Calendar API listed in §5.) | Free | https://calendar.google.com |
| **Figma** | Browser-based design tool — vector UI mockups, prototypes, design systems. Real-time collaborative. | UI mockups for new features (e.g. spec for command-center layout), reviewing designs before code, possibly icon assets. | Free tier + paid (Pro $15/mo) | https://www.figma.com/login |
| **Numbers / Excel / Google Sheets** | Spreadsheet apps. | Viewing this stack inventory; tracking gigs, costs, member readiness, song progress. | Numbers free on Mac / Excel paid / Sheets free | https://docs.google.com/spreadsheets |
| **iMessage** | Apple's messaging service. | Quick communication with band/testers (the iMessage tabs in your screenshots). Tester-facing channel since most bandmates have iPhones. | included with macOS/iOS | n/a |
| **Gmail (web + iOS app)** | Google's email service. | Primary email for vendor support tickets (Twilio, Modal, ElevenLabs), OAuth verification flows, tester invitations, account recovery. Drew's `drewmerrill1029@gmail.com` is the registered owner of the GrooveLinx Firebase / Google Cloud project. | Free | https://mail.google.com |
| **Apple Mail (`Mail.app`)** | macOS email client. | Reads Drew's `drewmerrill@comcast.net` and Gmail accounts side-by-side. | included with macOS | n/a |
| **Midjourney** | AI image generation service (text-to-image). | Marketing visuals, hero imagery, brand exploration. (Not used by the app at runtime — `services/iconforge/` uses OpenAI for the stage-plot icons instead.) | $10-60/mo subscription tiers | https://www.midjourney.com/login |
| **Apple Calendar (macOS)** | Apple's local calendar app. | Personal-cal mirror of Drew's Google Calendar (which mirrors the band cal). | included | n/a |
| **GitHub web** | The browser-side of GitHub. | Reviewing PRs, managing issues + Project board #1, watching Actions runs, browsing commits. | Free | https://github.com |
| **Firebase Console** | Browser dashboard for Firebase. | Editing RTDB data + rules, viewing Cloud Functions logs, managing FCM. | Free | https://console.firebase.google.com |
| **Cloudflare Dashboard** | Browser dashboard for Cloudflare. | Paste-deploying `worker.js`, managing R2 buckets, editing DNS, viewing worker logs. | Free | https://dash.cloudflare.com |

---

## 10. Quick-reference: Vendor Dashboards & Logins

Bookmark this. Every account login or admin URL in one place.

| Provider | Login / Dashboard | What you manage there |
|---|---|---|
| **Vercel** | https://vercel.com/dashboard | Deployment history, env vars, preview branches, edge logs |
| **GitHub (repo)** | https://github.com/drewmerrill/deadcetera | Code, issues, PRs, Actions, Releases |
| **GitHub (project board)** | https://github.com/users/drewmerrill/projects/1 | The "GrooveLinx Work" Kanban — Stage / Impact / Effort fields |
| **Cloudflare** | https://dash.cloudflare.com | Workers (`deadcetera-proxy`), R2 (`groovelinx-stems`), DNS, SSL |
| **Firebase Console** | https://console.firebase.google.com/project/deadcetera-35424 | RTDB data + rules, Cloud Functions, FCM, Storage, usage/billing |
| **Google Cloud Console** | https://console.cloud.google.com/?project=deadcetera-35424 | Under-the-hood for Cloud Functions: Cloud Build logs, Eventarc, Artifact Registry images, Cloud Run revisions |
| **Google Account / OAuth** | https://myaccount.google.com | Manage which apps have which scopes; see the GrooveLinx OAuth client there |
| **Google Cloud APIs** | https://console.cloud.google.com/apis/dashboard?project=deadcetera-35424 | YouTube Data API quotas, Maps API key, Calendar/Drive API enable/disable |
| **Modal** | https://modal.com/ | Deployed services (`groovelinx-stem-separator`), logs, secrets, runtime metrics. (Modal moved their dashboard URL structure — `/apps` returns 500; sign in from the home page and they'll route you to your workspace.) |
| **Anthropic Console** | https://console.anthropic.com | Claude API key, usage, billing, model selection |
| **Twilio Console** | https://console.twilio.com | A2P 10DLC campaigns, phone numbers, Messaging Services, send logs |
| **LALAL.AI** | https://www.lalal.ai | Prepaid pack balance, recent splits, API key |
| **Fadr** | https://fadr.com | API key, usage |
| **Deepgram Console** | https://console.deepgram.com | API key, usage, request logs |
| **ElevenLabs** | https://elevenlabs.io | API key, voice library, character usage |
| **OpenAI Platform** | https://platform.openai.com | API key, usage (currently only the iconforge one-shot script) |
| **Spotify Developer** | https://developer.spotify.com/dashboard | Client ID/secret for `/spotify-search` worker route |
| **Genius API** | https://genius.com/api-clients | Token for `/genius-search` and `/genius-fetch` |
| **IPRoyal** | https://iproyal.com | Residential proxy account, usage, billing |
| **Twilio Customer Profile** | https://console.twilio.com/us1/develop/sms/regulatory-compliance/customer-profiles | Sole Prop registration; A2P brand state |
| **Domain registrar (GoDaddy)** | https://account.godaddy.com | `groovelinx.com` registration, renewal, WHOIS contact info. (DNS itself is delegated to Cloudflare — GoDaddy holds the registration but Cloudflare answers the queries.) |
| **Apple Developer** | https://developer.apple.com/account | Apple ID for iOS PWA install profiles (used with Xcode) |
| **Loom** | https://www.loom.com/login | Recorded walkthrough videos |
| **CleanShot X** | n/a (local app — purchase via https://cleanshot.com) | Screenshots / screen recordings (local app, no cloud login unless using CleanShot Cloud) |
| **Figma** | https://www.figma.com/login | UI mockups, design files |
| **Contentsquare** | https://app.contentsquare.com | UX session replay, hesitation events, click maps |
| **GoDaddy** | https://account.godaddy.com | `groovelinx.com` domain registration |
| **Midjourney** | https://www.midjourney.com/login | Marketing visuals, hero imagery |
| **Gmail** | https://mail.google.com | Primary email account `drewmerrill1029@gmail.com` — owns the Firebase / Google Cloud project |
| **Fadr** | https://fadr.com | Account, API key, billing |
| **Anthropic / Claude.ai** | https://claude.ai | Claude Code subscription, API key management |

---

## 11. GrooveLinx internal features (which external platforms they depend on)

These are features inside the app — pages, tools, and surfaces. None of them introduce new third-party software; each is built on top of platforms already in this inventory. This table answers "if I disable X feature, what else stops working?"

| Feature | Files | Depends on | Notes |
|---|---|---|---|
| **Songs page** | `songs.js`, `song-detail.js`, `song-drawer.js` | Firebase RTDB (data); Spotify, YouTube, Genius, Ultimate Guitar (deep links); abcjs (notation) | The hub — every other feature links back to a song. |
| **Setlists** | `setlists.js`, `setlist-player.js` | Firebase RTDB; YouTube IFrame Player API | Includes the in-app YouTube playback engine. |
| **Calendar / Gigs** | `calendar.js`, `gigs.js`, `gl-calendar-sync.js` | Firebase RTDB; Google Calendar API; Cloudflare Worker `/ical/{slug}` | Two-way sync with each member's Google Calendar. |
| **Stems lens** | `song-detail.js` (stems block) | Modal stem-separator; Cloudflare R2; Tone.js; Web Audio API | All stem audio served from R2 after Demucs separation. |
| **Harmony Lab** | `harmony-lab.js` | LALAL.AI (audio split); Fadr (MIDI); Basic Pitch (audio→MIDI); abcjs (render) | The notation MIDI seed comes from Fadr; lead/backing audio from LALAL. |
| **Rehearsal Mode** | `rehearsal.js`, `practice.js`, `rehearsal-mixdowns.js` | Firebase RTDB; Web Audio API; Wake Lock API; Google Drive (audio loading) | Pocket Meter / Metronome live here — pure Web Audio + custom PLL phase-lock. |
| **Live Gig Mode** | `live-gig.js` | Service Worker (offline cache); Wake Lock API; Cache API | Designed to work without wifi during a gig. |
| **Stage Plot** | `stage-plot.js` | Firebase RTDB; HTML5 drag-drop; `window.print()` for PDF; OpenAI gpt-image-1 (icons via iconforge) | Public read-only share URL at `share.groovelinx.com/stageplot/...` served by the Cloudflare Worker. |
| **Playlists** | `playlists.js`, `listening-bundles.js` | Firebase RTDB; Spotify Web API; YouTube Data API; OAuth | Persistent synced playlists across Spotify and YouTube. |
| **Notifications** | `notifications.js`, `gl-push.js` | Firebase RTDB; Firebase FCM (Layer 2); Twilio SMS (Layer 3); browser Notifications API | Three layers: in-app banner / FCM push / SMS. |
| **Care Packages** | `notifications.js` (pack helpers) | Firebase RTDB (`bands/{slug}/care_packages` + public mirror at `care_packages_public/{id}`); Cloudflare Worker `/pack/:id` route | Public-readable bundles of band info; no GrooveLinx login required to view. |
| **Band Feed** | `band-feed.js` | Firebase RTDB | Internal activity feed within a band. |
| **Band Comms / Discussions** | `band-comms.js` | Firebase RTDB | Per-song threaded discussion. |
| **GrooveMate** | `gl-groovemate.js`, `gl-actions.js`, `gl-context.js`, `groovemate_*.js` | Anthropic Claude API (via worker); Firebase RTDB (memory persistence) | Decision engine — heuristic + Claude-augmented suggestions. |
| **Finances** | `finances.js` | Firebase RTDB | Internal income/expense tracker; **no Stripe / QuickBooks / payments integration**. Just bookkeeping on top of RTDB. |
| **Socials** | `social.js` | Browser (deep-link out only) | Profile chips for Instagram / Facebook / TikTok / X. |
| **Help system** | `help.js`, `gl-help-v2.js` | None — pure HTML/CSS/JS | In-app guide; no external deps. |
| **Bestshot (reference recordings)** | `bestshot.js` | Firebase RTDB; Google Drive API | Audio reference snippets attached to songs. |
| **Practice Mixes** | `firebase-service.js` (`practice_mixes`) | Firebase RTDB; Firebase Storage | User-uploaded practice tracks. |
| **Stage Plot share URL** | `worker.js` `handleStagePlotPublic` | Firebase RTDB REST; Cloudflare Worker; `share.groovelinx.com` subdomain | Public read-only HTML page for FOH engineers. |
| **iCal calendar feed** | `worker.js` `handleICalFeed` | Firebase RTDB REST; Cloudflare Worker | Live calendar subscription URL for external apps (Google/Apple/Outlook). |
| **Bulk Import** | `bulk-import.js` | Spotify Web API; YouTube Data API; Ultimate Guitar (deep link) | Paste a list of song titles, auto-resolve everything. |
| **Bug / feedback collection** | `app.js` (avatar feedback service) | Firebase RTDB (`bands/{slug}/feedback_reports`); GitHub Issues (manual triage layer) | Two-tier: instant in-app capture into Firebase, then Drew triages into GitHub Issues for the Project board. |
| **Admin tools** | scattered across pages (calendar maintenance modal, member provisioning console snippets, etc.) | Firebase RTDB; Cloudflare Worker | No dedicated admin page; admin actions embedded in the relevant feature pages. |

---

## 12. Shared engines (cross-cutting modules behind multiple screens)

These are internal modules that power multiple screens. A bug in any of them cascades — you change one engine, you affect every consumer. Knowing this map helps you (a) reason about blast radius before refactoring, (b) understand why a "song detail bug" might also break the home page.

Sorted by reach (most-consumed at top).

| Engine | File(s) | Job | Screens / features that consume it | If it breaks |
|---|---|---|---|---|
| **GLStore** | `js/core/groovelinx_store.js` | The central in-memory + localStorage cache. Every read/write of band state goes through it; emits change events. | **Everything.** 19 features call into it: songs, calendar, gigs, setlists, rehearsal, song-detail, home, practice, song-pitch, stoner-mode, bestshot, song-drawer, band-feed, band-comms, notifications, bulk-import, chart-import, live-gig, home-dashboard-cc. | Whole app fails to render or save. |
| **GL_PAGE_READY lifecycle** | `js/ui/navigation.js` (`_navSeq` counter, 7 render entry points) | The router contract. Detects stale async renders so a slow re-render can't paint over a newer page. **System-locked** per CLAUDE.md. | Every page render. | Pages flicker, paint stale data, or get stuck on "Loading…". |
| **Focus engine** | `js/core/groovelinx_store.js` (`getNowFocus`, `invalidateFocusCache`, emits `focusChanged`) | Computes "what should the band work on next?" — weakest songs, top gaps, gig-imminent priorities. | home-dashboard, songs, rehearsal, calendar. | Recommendation cards go blank or stale; the "Focus: 2 songs need work" tile breaks. |
| **GLPlayerEngine** | `js/core/gl-player-engine.js` | The unified YouTube IFrame Player wrapper. Handles autoplay watchdog, song-to-song transitions, error recovery. | live-gig, setlists, home-dashboard, gigs. | Audio playback fails for setlist player + live-gig + practice playback. |
| **Service Worker** | `service-worker.js` + `firebase-messaging-sw.js` | Caches the app shell, intercepts requests for offline support, receives FCM push notifications. | Every page (always installed when supported). | No offline mode, no push notifications, slow cold starts. |
| **GLActions** | `js/core/gl-actions.js` | Registry of action handlers (`stems.setLoop`, `rehearsal.startRehearsal`, etc.) — lets the avatar router and GrooveMate trigger UI actions without coupling. | home-dashboard, rehearsal, song-detail. | Avatar commands and GrooveMate "Apply" buttons silently no-op. |
| **GLContext** | `js/core/gl-context.js` | Frozen snapshot of GLStore + window globals + localStorage. Read by GrooveMate to decide what to suggest. | home-dashboard, song-detail (via GrooveMate). | GrooveMate suggestions vanish or fire on stale state. |
| **GLGrooveMate** | `js/core/gl-groovemate.js` + `groovemate_*.js` | The decision engine — heuristic + Claude-augmented suggestions ("you've looped this section 3×, want to deepen it?"). | home-dashboard, song-detail. | No suggestion cards; avatar still works for direct commands. |
| **GLCalendarSync** | `js/core/gl-calendar-sync.js` | The two-way Google Calendar bridge. Phase-1 push, Phase-2 pull, freeBusy overlay, hidden-event check, reconciliation. | calendar, gigs, rehearsal. | Calendar gets out of sync with members' Google calendars; gig dates drift. |
| **GLAudioSession** | `js/core/gl-audio-session.js` | Single shared Web Audio context across stems mixer, harmony lab, rehearsal recordings, and setlist player — prevents conflicts and leaks. | song-detail (and inherits to Stems lens, Harmony Lab, Rehearsal Mode, Setlist Player). | Audio randomly stops, double-plays, or distorts on iOS Safari. |
| **GLStems** | `js/core/gl-stems.js` | Stem separation orchestrator. Manages async start/check polling, R2 URL retrieval, mixer state. | harmony-lab, song-detail (Stems lens). | Stems lens can't load or play stems. |
| **GLInsights** | `js/core/gl-insights.js` | Cross-band intelligence — readiness scoring, gap detection, top-priority surfacing. | home-dashboard, songs. | Readiness scores wrong; "needs work" sort breaks. |
| **GLOrchestrator** | `js/core/gl-orchestrator.js` | Coordinates multi-step workflows (e.g. Stems → Harmony Lab → Rehearsal). | home-dashboard. | Workflow CTAs fail to chain steps. |
| **recording-analyzer** | `js/core/recording-analyzer.js` + `js/core/rehearsal-analysis-pipeline.js` | Pocket Meter / Metronome — pure Web Audio AnalyserNode + custom PLL phase-lock + IOI tempo classifier. | rehearsal, rehearsal-analysis-pipeline. | Metronome silent or wildly off; Pocket Meter stops detecting tempo. |
| **Wake Lock** | `js/core/wake-lock.js` | Browser Wake Lock API wrapper — keeps the screen on during long sessions. | rehearsal, live-gig. | Phone screen sleeps mid-song during a gig. |
| **Push system** | `js/core/gl-push.js` | FCM token registration, subscription management, permission flow. | notifications. | Push notifications stop arriving. |
| **Avatar feedback** | `js/core/avatar_feedback_service.js` + `_classifier.js` + `_context.js` + `_summarizer.js` | Background telemetry — captures hesitation events, classifies them, summarizes for review. | All pages (passive). | UX feedback collection silently breaks; app keeps working. |
| **Spotify player** | `js/core/gl-spotify-player.js` | Spotify Web Playback SDK wrapper. | playlists, listening-bundles. | Spotify previews stop playing. |
| **Render state guard** | `js/core/gl_render_state.js` | Tracks render-in-progress flags, prevents concurrent renders that would race. | All renderable pages. | Concurrent renders trample each other; UI glitches. |
| **User identity** | `js/core/gl-user-identity.js` | Resolves the current member from email/OAuth → memberKey for readiness, RSVPs, etc. | All multi-member features. | Per-member state attaches to the wrong member. |

### Field dependencies (high-leverage data fields and what consumes them)

A change to any of these fields ripples through several engines. Treat them as load-bearing.

| Field | Consumers |
|---|---|
| `bands/{slug}/songs_v2/{songId}.title` | Used as Firebase key in 9+ paths (charts, readiness, intelligence, discussions, moments). Renaming requires the songs_v2 migration tool. |
| `bands/{slug}/songs_v2/{songId}.status` | Drives the Active vs Library scope split. `GLStore.isActiveSong()` and `GLStore.ACTIVE_STATUSES` are the canonical check. |
| `songs_v2/{songId}.bpm` + `key` | Pocket Meter metronome default, rehearsal pacing, setlist timing rollup, intelligence sorting. |
| `songs_v2/{songId}.readiness[memberKey]` | Focus engine, intelligence engine, home dashboard, rehearsal recommendations, weak-songs sort, GrooveMate "next song" suggestion. |
| `bands/{slug}/meta/members` | **Now triggers the `mirrorMemberToIndex` Cloud Function** which writes `members_index/{email}: bandSlug`. The auth gate reads from `members_index`. Direct edits to `meta/members` propagate automatically. |
| `bands/{slug}/calendar_events/{idx}` | Calendar grid, gigs page (for `type:gig`), rehearsal page (for `type:rehearsal`), home dashboard "Next Up", iCal feed via worker. |
| `gigs/{gigId}` (parallel-mirror to calendar_events) | Gig editor, setlist linkage, RSVPs, payouts, Stage-2 source-of-truth flip pending. |
| Build version (`<meta name="build-version">`) | Read by app.js console banner, GLContext, knowledge resolver, service worker cache name. **Bumping this is the 4-source-atomic operation** per `feedback_build_bump_atomic.md`. |

### How to extend this map

When adding a new engine: add a row to the table above with files / job / consumers. When refactoring an existing engine: read the consumers column first — the change blast radius is right there. When debugging a "this screen broke" issue: find the screen in the consumers column and look up the engines it relies on.

---

## 13. Key integrations (how the tools talk to each other)

These are the wires connecting different vendors. Knowing they exist helps when something breaks — the symptom often shows up far from the cause.

| Integration | What it does |
|---|---|
| **GitHub → Vercel auto-deploy** | Every `git push` to `main` triggers Vercel to rebuild and deploy `app.groovelinx.com`. Configured in Vercel project settings. |
| **GitHub Actions → repo** | The `validate.yml` workflow runs on every PR; uses `actions/checkout@v5` to grab code, `actions/setup-node@v5` to install Node 24. |
| **GoDaddy → Cloudflare DNS delegation** | GoDaddy holds the `groovelinx.com` domain registration, but the nameservers point to Cloudflare. Cloudflare answers all DNS queries. (To change nameservers: GoDaddy console → Domain → DNS → Nameservers.) |
| **Cloudflare DNS → Vercel** | Cloudflare DNS has CNAME records pointing `app.groovelinx.com` and `dev.groovelinx.com` to Vercel's edge servers. (To repoint: Cloudflare dash → DNS → records.) |
| **Cloudflare DNS → R2** | `stems.groovelinx.com` is a custom domain pointing to the `groovelinx-stems` R2 bucket. |
| **Firebase project ↔ Google Cloud project** | Same project, two consoles. Firebase Console (`console.firebase.google.com`) and Google Cloud Console (`console.cloud.google.com`) are different views on the same `deadcetera-35424` project. Cloud Functions, Cloud Build, Eventarc all live under GCP; Firebase RTDB / FCM under Firebase Console — but both consoles see them. |
| **Cloud Functions → Eventarc → Pub/Sub → RTDB** | When a member roster changes, RTDB raises an event → Eventarc routes it via Pub/Sub → triggers `mirrorMemberToIndex`. All managed by Google; no config needed. |
| **Cloudflare Worker → Modal** | Worker `/stems/start` and `/stems/check` routes hit Modal endpoints with a shared secret (`STEMS_SHARED_SECRET`). |
| **Cloudflare Worker → external APIs** | The worker proxies every third-party API call (Twilio, Anthropic, Spotify, Genius, Archive.org, Phish.net/in, Relisten, Odesli, ElevenLabs, Deepgram, Fadr, IPRoyal). Centralized so secrets stay server-side. |
| **Modal → Cloudflare R2** | Stem separator uploads its output `.flac` files to R2 (S3 API) using `boto3`. URLs return through the worker to the browser. |
| **Browser → Firebase RTDB (WebSocket)** | The Firebase JS SDK keeps a persistent WebSocket open to RTDB so any change anyone makes appears within 1-2 seconds on every other device. |
| **Browser → Twilio (via worker)** | Notifications screen has a per-member SMS opt-in toggle that hits worker `/sms/subscribe` → writes to RTDB → outbound SMS via worker `/sms/send` → Twilio API. |
| **GitHub Issues + Project board #1** | Drew's Issues are linked to "GrooveLinx Work" Project (https://github.com/users/drewmerrill/projects/1) with Stage/Impact/Effort/Owner/Submitted by fields. Markdown docs (handoff, current_phase) reference issue numbers. |

---

## Stuff that ISN'T in our stack (and worth knowing why)

| Not used | Why not |
|---|---|
| **Google Analytics / Mixpanel / Amplitude / PostHog** | We rely on Contentsquare for UX session replay + custom `gl-ux-tracker.js` for hesitation events. No need for a second analytics layer. |
| **Sentry / Bugsnag / Rollbar / Honeycomb** | Errors log to console + are captured by Contentsquare session replays. Adding a dedicated error tracker would be valuable, but isn't a priority yet. |
| **webpack / Vite / Rollup / esbuild / Parcel** | Vanilla-JS architecture deliberately skips bundling. Files served as-is. Faster to ship, easier to debug, no build step. |
| **Sass / Less / PostCSS / Tailwind** | Plain CSS only. Same simplicity rationale. |
| **React / Vue / Svelte / Angular** | Same — vanilla JS by design. CLAUDE.md explicitly forbids introducing one of these. |
| **Stripe / PayPal / Lemon Squeezy** | `gl-plans.js` has a Stripe scaffold for future use, but no active billing. The app is currently invite-only and free for the band. |
| **SendGrid / Mailgun / Postmark / Resend** | No transactional email service. Twilio for SMS, FCM for push, in-app banner for in-app. Email from app to user not currently a need. |
| **Workbox / localforage / IndexedDB** | Service worker is hand-rolled (small enough not to need Workbox). State persists via localStorage + Cache API + Firebase RTDB — no IndexedDB needed yet. |
| **Husky / pre-commit hooks** | Validation runs in GitHub Actions on PR instead. Local hooks are easy to bypass and add friction. |
| **Dependabot / Renovate** | Manual version audits (like this one). Could add Dependabot in the future for low-friction dep updates on `functions/package.json` and root `package.json`. |
| **BrowserStack** | `package.json` has a `test:browserstack` script but no config file — script is a vestige. Not currently active. |
| **Firebase Hosting** | Vercel hosts the app instead. Firebase Hosting was an option but Vercel's auto-deploy on `git push` was simpler. |
| **GitHub Pages** | Same — Vercel does the job. |
| **Firebase Auth** | We sign users in via Google OAuth directly. This is why our database rules can't use `auth != null` — there's no Firebase auth context. (Worth wiring eventually for tighter rules.) |
