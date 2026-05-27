# Traversal Map — Saturation Audit 2026-05-27

Build: `20260527-005638`
Auth: persistent session as Andrew Merrill
Tool: Playwright MCP over Chromium

## Viewports exercised

| Viewport | Dimensions | Pass |
|---|---|---|
| Desktop | 1440 × 900 | Full |
| iPad landscape | 1024 × 768 | Layout + Home |
| iPad portrait | 768 × 1024 | Layout + Home + Songs + Rehearsal + Calendar |
| iPhone 14 | 390 × 844 | Home + Songs + Rehearsal + Calendar + Gigs + Song detail + nav investigation |

## Hash routes probed (36 total)

All routes were exercised programmatically with a single deterministic loop (see `desktop/route-probe.json`).

### Working — render their own surface

| Route | Breadcrumb | Status |
|---|---|---|
| `#home` | `🏠/Band/GrooveLinx` | OK |
| `#songs` | `🏠 / Band / 🎵 Songs` | OK |
| `#practice` | `🏠 / Solo / 🎯 Practice` | OK |
| `#rehearsal` | `🏠 / Band / 🎸 Rehearsal` | OK |
| `#setlists` | `🏠 / Band / 📋 Setlists` | OK |
| `#tuner` | `🏠 / Tools / 🔱 Tuner` | OK |
| `#metronome` | `🏠 / Tools / 🥁 Metronome` | OK |
| `#playlists` | `🏠 / Tools / 🎧 Playlists` | OK |
| `#gigs` | `🏠 / Gigs / 🎤 Gigs` | OK |
| `#stageplot` | `🏠 / Gigs / 🎭 Stage Plot` | OK (lowercase only) |
| `#venues` | `🏠 / Gigs / 🏛️ Venues` | OK |
| `#contacts` | `🏠 / Admin / 👥 Contacts` | OK |
| `#feed` | `🏠/Admin/👥 Contacts` (stale) | **Render error** — `[Feed] TypeError: GLPriority.forRsvpEvent is not a function` (F-016) |
| `#equipment` | `🏠 / Admin / 🎛️ Equipment` | OK |
| `#help` | `🏠 / Admin / ❓ Help` | OK |
| `#calendar` | `🏠 / Gigs / 📆 Calendar` | OK |
| `#admin` | `🏠 / Admin / ⚙️ Settings` | OK (reached via top-bar ⚙️) |

### Broken — silently render Home dashboard with stale breadcrumb

These routes ARE wired to nav buttons OR are reasonable variants — they should resolve to a surface, but they fall through to Home:

| Route | Wired to | Symptom |
|---|---|---|
| `#schedule` | LEFT-RAIL `📅 Schedule` button | Renders Home content |
| `#stagePlot`, `#stage-plot` | (camelCase / kebab variants) | Renders Home content |
| `#bandRoom`, `#band-room`, `#bandroom` | LEFT-RAIL `💬 Band Room` button | Renders Home content |
| `#carePackages`, `#care-packages` | LEFT-RAIL `🔔 Care Packages` button | Renders Home content |
| `#settings` | (variant — actual route is `#admin`) | Renders Home content |
| `#review`, `#isolate`, `#stoner`, `#liveGig`, `#live-gig`, `#livegig` | Modes (likely triggered differently) | Renders Home content |
| `#analyzer`, `#multitrack`, `#chart`, `#chord`, `#stems` | Contextual sub-routes | Renders Home content |

**Net dead-end mapping:** Left-rail nav buttons `📅 Schedule`, `🎭 Stage Plot`, `💬 Band Room`, `🔔 Care Packages` and top-bar `⚙️` (in its `#settings` form) all advertise destinations the URL doesn't reach. Routing convention is inconsistent: lowercase wins (`stageplot`) over kebab (`stage-plot`) over camelCase (`stagePlot`).

## Modals / overlays / contextual surfaces visited

| Surface | How invoked | Notes |
|---|---|---|
| Top-bar mode menu (Stoner Mode) | Top-bar `🌿 Mode` | 3-button intent menu — see G-005 |
| Settings & Admin | Top-bar `⚙️` (routes `#admin`) | Tabs: Profile / Band / Data / Notifications / About |
| Song-detail drawer | Click any song row in Songs table | Tabs: Practice / Play / Versions / Harmony Lab / Stems / Inspire |
| Runtime Health panel | Auto-open in dev mode | Build, SW, Route lifecycle, Playback, Spotify, Multitrack, Teardowns |
| Right-rail "Song context panel" | Default on Home/Songs | Persists even when empty (see F-003, F-017) |
| `Quick View` overlay | Visible chrome at top of main | Inert at idle |

## Unreachable surfaces on iPhone

On iPhone (390×844), the primary slide-menu containing 32 navigation links is rendered in DOM at `x=-300` (off-screen) but **no visible chrome element calls `toggleMenu()` to open it** (F-018). Reachable destinations from iPhone chrome alone:
- Home (via GrooveLinx logo OR breadcrumb 🏠)
- Calendar (via 📅)
- Stoner Mode menu (via 🌿 Mode)
- Admin/Settings (via ⚙️)
- Google Drive auth (via user avatar — but labeled "tap to manage", see F-021)

**Unreachable from iPhone chrome**: Songs, Practice, Rehearsal, Setlists, Tuner, Metronome, Playlists, Gigs, Stage Plot, Venues, Contacts, Band Room, Feed, Care Packages, Equipment, Help. (Reachable only via Home cards/links or direct URL typing.)

## Modes not exercised

These were noted but not entered (would have required a song in progress or live state):
- Live Gig Mode (triggered from Gigs page "🎤 Go Live")
- Rehearsal Mode (triggered from Rehearsal page "▶ Start Rehearsal")
- Review Mode / Isolate Mode (contextual to a multitrack rehearsal recording — none active)

## Coverage gap

iPad landscape pass is light (single screenshot). A future pass would re-run the full surface list at 1024×768 and compare layout collapse behavior against portrait. Findings at iPad portrait (F-017) suggest no behavioral surprise vs desktop except the persistent right panel.
