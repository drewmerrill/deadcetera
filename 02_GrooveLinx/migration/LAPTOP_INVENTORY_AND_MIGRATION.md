# GrooveLinx Dev Laptop — Inventory & Migration Plan

**Purpose:** if Drew's current dev Mac dies, melts, or has to be swapped, this file is the single source of truth for "what does the new laptop need." Treated as a living doc — updated alongside any change to installed software, licenses, or auth state.

**Last verified:** 2026-05-19 (build under test `20260518-171227`)
**Source Mac:** macOS Darwin 25.5.0 (`/Users/drewmerrill`), zsh, iTerm2.

---

## Update Protocol (read this first)

Update this file **whenever any of the following happens**:

| Trigger | What to update |
|---|---|
| `brew install X` / `brew uninstall X` | §2 Reproducible Toolchain |
| `npm install -g X` / `pipx install X` | §2 Reproducible Toolchain |
| Install a new GUI app from /Applications | §3 Apps (and §4 if license-bound) |
| Authorize a new license-bound plugin (UA, Steinberg, iLok) | §4 Deauthorize-Before-Wipe |
| Log into a new CLI service (gh, wrangler, modal, firebase, vercel, npm) | §5 Auth & Session State |
| Add/change an SSH key, GPG key, dotfile | §6 Files & Dirs to Migrate |
| Pair new hardware (BT pedal, audio interface) | §7 Hardware Pairings |
| Drew rotates a secret in Cloudflare/Modal/Firebase | §8 GrooveLinx-Specific State |

After any update: `git add` + commit with `docs(migration):` prefix + push immediately (per `feedback_commit_push.md`).

If you're a future Claude session and Drew mentions a new install/license/auth — **proactively edit this file**. Don't wait to be asked.

---

## 1. Quick Restore (TL;DR)

On a fresh Mac, run these in order. Each section below has detail.

1. **Sign in to Apple ID** → enables iCloud, App Store, Final Cut, GarageBand, iMovie, iWork.
2. **Install Xcode CLT:** `xcode-select --install` then accept license.
3. **Install Homebrew:** `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
4. **Run the toolchain block in §2** (one paste).
5. **Sign into the auth surfaces in §5** (one per CLI).
6. **Migrate dotfiles in §6** (or restore from Time Machine / iCloud Drive backup).
7. **Reauthorize license-bound apps in §4** (after deauthorizing on the OLD machine first — see §4 ⚠️).
8. **Clone the repo:** `git clone git@github.com:drewmerrill/deadcetera.git`
9. **Verify with the checklist in §9.**

---

## 2. Reproducible Toolchain

### Homebrew formulae (top-level)

These are the formulae Drew installed directly (everything else is a transitive dep that brew will pull in):

```bash
brew install \
  ffmpeg \
  gh \
  llvm@14 \
  pipx \
  python@3.11 \
  reattach-to-user-namespace \
  rust \
  tmux \
  vercel-cli \
  yt-dlp
```

> Note: `node`, `python@3.14`, `deno`, `sqlite`, `openssl@3`, `ca-certificates` etc. install as deps. The full transitive list (53 formulae as of 2026-05-19) is in §10 appendix.

### Homebrew casks (GUI installs via brew)

```bash
brew install --cask raycast rectangle
```

### Node global packages

After brew installs `node` (currently v25.8.1):

```bash
npm install -g \
  firebase-tools \
  vercel \
  wrangler \
  @modelcontextprotocol/server-filesystem
```

Pinned versions as of 2026-05-19: firebase-tools 15.17.0, vercel 53.2.0, wrangler 4.69.0.

### Python tools (via pipx)

```bash
pipx install modal
```

Pinned: modal 1.4.2 (uses Python 3.14.4).

### Claude Code

Install per official docs (currently at `~/.local/bin/claude`, version 2.1.144). Check current install instructions at the time of migration — install path/method evolves.

---

## 3. App Reinstall Priority

### Tier A — Required to develop GrooveLinx

| App | Source | Notes |
|---|---|---|
| iTerm | iterm2.com | Restore config from `~/Library/Preferences/com.googlecode.iterm2.plist` |
| Google Chrome | google.com/chrome | Sign in → bookmarks/extensions sync automatically |
| Claude.app + Claude Code URL Handler | claude.ai/download | Companion to the CLI |
| GitHub Desktop | desktop.github.com | Optional; CLI works fine alone |
| Xcode | Mac App Store | Required for git Apple-Git build + iOS sim if ever needed |
| Spotify | spotify.com | Sign in with `drewmerrill@comcast.net` (premium) for GL playback testing |
| Raycast | raycast.com | Productivity launcher |
| Rectangle | rectangleapp.com | Window mgmt |
| CleanShot X | cleanshot.com | Screenshots |
| Loom | loom.com | Recorded walkthroughs (cloud-stored, no local migration) |
| LastPass | lastpass.com | Password vault (cloud-synced) |
| Okta Verify | App Store | **MFA — re-enrollment is painful; do it BEFORE leaving the old Mac if possible** |

### Tier B — Music production (license-bound, see §4)

REAPER, MainStage, GarageBand, Final Cut Pro, Audacity, MuseScore 4, Moises, SpectraLayers 8, Topaz Video, Adobe After Effects 2025, Steinberg family (HALion Library Manager, HALion Sonic SE, Groove Agent SE, Steinberg Activation Manager, Steinberg Download Assistant, Steinberg Library Manager), iLok License Manager, License Control Center, UA Connect + Universal Audio + iLok, GE300 + Mooer Studio, AirTurn Manager, JamKazam, DrumBeats+, Muse Hub, Ultimate Guitar, Sonos S1.

### Tier C — Cloud sync (sign in, files come back)

Dropbox, Google Drive, OneDrive.

### Tier D — Office / iWork

Microsoft 365 (Word/Excel/PowerPoint/Outlook), iWork (Pages/Numbers/Keynote/Pages Creator Studio), iMovie.

### Tier E — Utilities

Disk Doctor, PhotoSweeper, Elmedia Video Player, Paint S, Wayback Machine, WinX HD Video Converter, HP printer software, Zoom.

---

## 4. ⚠️ Deauthorize-Before-Wipe Checklist (CRITICAL)

**Do this on the OLD Mac BEFORE wiping/selling/recycling, or you may be locked out of these apps for days while support tickets resolve.**

| App | Deauth flow |
|---|---|
| **iLok License Manager** | Sign in → right-click each license → Move to iLok cloud or another machine. If you have a physical iLok USB dongle, unplug it cleanly (no deauth needed). |
| **Universal Audio (UA Connect)** | UA Connect → Settings → Sign Out. Plugins are tied to iLok — handle via iLok above. |
| **Steinberg Activation Manager** | Open SAM → click each product → "Deactivate this product on this computer." If on eLicenser dongle, just unplug. |
| **Adobe After Effects 2025** | Creative Cloud app → Profile → Sign Out (Adobe allows 2 active devices). |
| **Microsoft 365** | account.microsoft.com → Devices → Sign out / Deactivate Office on this Mac. |
| **Final Cut Pro / MainStage / Logic** | Tied to Apple ID — no deauth, just sign out of Apple ID before wipe. |
| **Topaz Video** | App → Account → Sign Out (limited activations). |
| **Moises.app** | Sign out — subscription is account-bound, not machine-bound, so low risk but cleaner. |
| **MuseScore 4 / Muse Hub** | Sign out of Muse account if signed in. |
| **iLok USB dongle** | If physical key is plugged in: power down Mac → unplug → it's done. |
| **AirTurn pedal** | Forget BT pairing in macOS Bluetooth settings (optional, keeps pedal clean). |

After deauth pass: open each app once and confirm it shows "Not licensed on this computer" before wiping.

---

## 5. Auth & Session State (after fresh install)

None of these survive a clean OS install. Run/sign into each:

| Service | Command / location |
|---|---|
| GitHub (CLI) | `gh auth login` — choose SSH, paste new key, log in via browser |
| GitHub (SSH) | Generate fresh key: `ssh-keygen -t ed25519 -C "drewmerrill@comcast.net"` → add `~/.ssh/id_ed25519.pub` to github.com/settings/keys |
| Cloudflare (wrangler) | `wrangler login` — opens browser, OAuth flow |
| Modal | `modal token new` — opens browser |
| Firebase | `firebase login` — OAuth via Google |
| Vercel | `vercel login` |
| npm registry | `npm login` (only if publishing — not currently needed for GL) |
| Anthropic (Claude Code) | Launch `claude` → follow auth flow |
| Google Chrome | Sign in with Google account → sync restores bookmarks/passwords/extensions |
| Spotify (dev) | Sign into Spotify desktop app with `drewmerrill@comcast.net` (premium) |
| Twilio (web) | Browser login — no CLI auth state to migrate |
| Cloudflare dashboard | Browser login (separate from wrangler — used to edit Worker via UI as fallback) |

### Where these tokens live (in case migration is wanted vs. re-login)

| Path | Service |
|---|---|
| `~/.config/gh/` | gh CLI auth |
| `~/.wrangler/` (legacy) or `~/Library/Preferences/.wrangler-config/` | Cloudflare wrangler |
| `~/.modal/` (or `~/Library/Application Support/modal/`) | Modal API key |
| `~/.npmrc` | npm registry tokens |
| `~/.config/firebase-tools/` | Firebase CLI |
| `~/Library/Application Support/Vercel/` | Vercel session |

> **Recommendation:** prefer fresh re-login over copying tokens. Tokens leak via Time Machine backups + copying them defeats device-rotation security.

---

## 6. Files & Dirs to Migrate

### MUST migrate (irreplaceable)

| Path | Why |
|---|---|
| `~/.claude/` | **Auto-memory dir (`memory/`), settings, projects, history — IRREPLACEABLE institutional context across sessions.** Back this up before wipe. |
| `~/.zshrc` (11.3 KB as of 2026-05-19) | Custom aliases, PATH, env vars. Includes `claude-mem-backup` function (tars `~/.claude/projects/-Users-drewmerrill-Documents-GitHub-deadcetera/memory/` to iCloud Drive — re-run periodically while laptop status is uncertain). |
| `~/.ssh/` | If you choose to migrate the keypair instead of regenerating. Better: regenerate (see §5). |

### SHOULD migrate (large, but recoverable from cloud)

| Path | Note |
|---|---|
| `~/Library/Application Support/REAPER/` | REAPER prefs, custom actions, render presets |
| `~/Library/Application Support/Google/Chrome/` | Browser sync covers most of this; this dir is the local fallback |
| Loom recordings | Cloud-synced — no local action needed |
| CleanShot X library | Check CleanShot Settings → Cloud sync status |
| `~/Library/Audio/` (sample libraries, AU plugins) | HALion, UA plugins, etc. — large; reinstall via vendor managers is cleaner |

### Repo state to verify before wiping

- `git status` clean — no uncommitted work
- All branches pushed: `git push --all`
- All tags pushed: `git push --tags`
- Any local scratch dirs outside the repo (e.g. `~/Downloads/groovelinx-*`) you want to preserve

---

## 7. Hardware Pairings

| Device | Pairing flow on new Mac |
|---|---|
| **AirTurn BT pedal** | Power on pedal → System Settings → Bluetooth → pair. Install AirTurn Manager app if custom mapping is needed. |
| **Universal Audio interface (Apollo/Volt)** | Install UA Connect (already in app list) → connect via USB/TB → driver auto-loads |
| **Mooer GE300** | Install GE300 + Mooer Studio for GE300 → USB connect |
| **iLok USB dongle** (if present) | Just plug in — no software pairing |
| **Sonos S1** | Install Sonos S1 Controller → sign in to Sonos account |
| **HP printer** | macOS auto-discovers via AirPrint or install HP app |

---

## 8. GrooveLinx-Specific State (not in repo)

External state Drew controls that the repo depends on:

| Surface | Where it lives | How to restore |
|---|---|---|
| **Cloudflare Worker** `deadcetera-proxy` | dash.cloudflare.com → Workers & Pages → deadcetera-proxy | `wrangler deploy` from repo (`wrangler.toml` is committed). See `reference_cloudflare_worker.md`. |
| **Cloudflare Worker secrets** | Set via wrangler or dashboard | `MULTITRACK_SHARE_KEY`, `YOUTUBE_COOKIES_BASE64` (refresh per `reference_modal_youtube_cookies.md`), Spotify client id/secret, etc. |
| **Cloudflare R2 bucket** `groovelinx-stems` | Cloudflare account | Persists in cloud — no local state |
| **Modal account** | modal.com (Drew's account) | `modal token new` after install → Modal app code in repo |
| **Modal secret** `groovelinx-stems` | modal.com → Secrets | Holds `YOUTUBE_COOKIES_BASE64` etc. |
| **Firebase project** `groovelinx-app` | console.firebase.google.com | All band/user/song data lives here — no local migration |
| **Twilio account** (SMS) | twilio.com | A2P 10DLC campaign `CM5eff550348c1933e9b57ce99c6aeafc6` — see `project_a2p_10dlc_submission.md` |
| **GitHub** `drewmerrill/deadcetera` | github.com | Repo, Issues, Project board #1 (work tracking — see `feedback_github_issues_workflow.md`) |
| **Production app** | app.groovelinx.com | Deploys from `main` via Vercel — `vercel login` then redeploy if creds were rotated |
| **Spotify dev app** | developer.spotify.com | Client id/secret stored as Worker secrets |

---

## 9. New-Laptop Verification Checklist

Walk through this on the new machine. If any line fails, fix before declaring migration complete.

- [ ] `git clone git@github.com:drewmerrill/deadcetera.git` succeeds (SSH key works)
- [ ] `gh auth status` shows logged in
- [ ] `wrangler whoami` shows Drew's Cloudflare account
- [ ] `modal token current` shows a token
- [ ] `firebase login --status` shows logged in
- [ ] `claude --version` runs (and `claude` opens with memory intact — `~/.claude/memory/MEMORY.md` should list all entries)
- [ ] `ffmpeg -version` runs
- [ ] `yt-dlp --version` runs
- [ ] Open `app.groovelinx.com` in Chrome → sign in → song library loads
- [ ] iLok License Manager: all expected licenses show "Activated"
- [ ] Open REAPER → load a recent project → sample libraries load (HALion etc.)
- [ ] AirTurn pedal pairs and triggers actions
- [ ] UA interface shows in macOS Sound output
- [ ] Spotify desktop app: sign in, premium status shows
- [ ] Twilio Console accessible; A2P campaign status visible
- [ ] Cloudflare dashboard accessible
- [ ] Modal dashboard accessible
- [ ] Test deploy: `cd worker && wrangler deploy --dry-run` succeeds

---

## 10. Appendix — Full Transitive Brew Formula List (2026-05-19)

For reference if something breaks during the §2 install. Full output of `brew list --formula`:

```
ada-url, brotli, c-ares, ca-certificates, certifi, dav1d, deno, ffmpeg, fmt,
gh, hdrhistogram_c, icu4c@78, jpeg-turbo, lame, libevent, libgit2, libnghttp2,
libnghttp3, libngtcp2, libssh2, libtiff, libuv, libvpx, little-cms2, llhttp,
llvm, llvm@14, lz4, mpdecimal, ncurses, node, openssl@3, opus, pipx, pkgconf,
python@3.11, python@3.14, readline, reattach-to-user-namespace, rust, sdl2,
simdjson, sqlite, svt-av1, tmux, utf8proc, uvwasi, vercel-cli, x264, x265,
xz, yt-dlp, z3, zstd
```

53 formulae. The §2 top-level list pulls all of these as deps.

---

## 11. Known Migration Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Locked out of UA/Steinberg/Adobe after wipe** | Always run §4 deauth checklist BEFORE wiping. Document any new license-bound install in §4. |
| **Lost Claude auto-memory** | `~/.claude/memory/` is the single biggest irreplaceable thing. Time Machine + manual zip-and-cloud-store before wipe. |
| **iLok cloud lockout** | If you've moved licenses to iLok cloud and then can't log back in, contact iLok support — has 24-48hr SLA. Keep account email/2FA recovery accessible. |
| **Spotify dev creds rotated** | Worker secret update via `wrangler secret put SPOTIFY_CLIENT_SECRET` after rotation. Update `project_spotify_connect.md` if account changes. |
| **YouTube cookies expire** | Refresh per `reference_modal_youtube_cookies.md` — yt-dlp export → base64 → Modal secret. |
| **A2P 10DLC re-verification** | Twilio campaign is tied to brand SID, not machine. No migration impact — but keep the submission docs (`project_a2p_10dlc_submission.md`) handy. |

---

_If you're a future Claude session reading this: when Drew tells you he installed/uninstalled/licensed/authorized something, update the relevant section of this file in the same turn, commit, and push. Don't wait to be asked._
