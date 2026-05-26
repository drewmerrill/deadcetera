# Emotional-Trust Evidence Harvest — iPhone Safari Review Mode

**Date:** 2026-05-26 13:30–13:41 UTC
**Build under test:** `20260526-102503` (commit `fd347556`) on `app.groovelinx.com`
**Session:** `rsess_mt_mpju4yyn_7pko` (5/18 Drew's House rehearsal, 73 multitrack segments, 17 tracks)
**Harvester:** Claude via Playwright MCP
**Audience:** ChatGPT — for emotional-trust evaluation Drew is too close to do first-pass

---

## ⚠️ Methodology constraint — read before relying on this evidence

**This is Chromium at iPhone viewport (390×844), not WebKit/Safari.** Playwright MCP cannot run real iOS Safari. Each observation is tagged:

| Tag | Meaning |
|---|---|
| **[DIRECT]** | Observable in this harness exactly as it would be on a desktop browser (visual hierarchy, layout, opacity, persistence APIs, data flow). Translates to real iPhone. |
| **[APPROX]** | Observable but with caveats (touch-as-mouse, scroll-as-mouse-scroll, programmatic state changes). Likely-but-not-certain to match real iPhone. |
| **[NOT-OBSERVABLE]** | Cannot be tested in this harness. Real iOS keyboard appearance / address-bar collapse on scroll / iOS Safari rendering quirks / DRM playback. Listed when relevant so ChatGPT knows where the gaps are. |

Claude's "calm / stressful / trustworthy / fragile" labels are **best-effort observations from the visual evidence**, intended as input to ChatGPT's evaluation. They are NOT authoritative claims about how Drew or band members will feel.

---

## Sequential screenshot index

All paths relative to `02_GrooveLinx/uat/screenshots/2026-05-26/emotional-trust-iphone-safari/`.

### Flow 1 — Draft persistence (`draft-persistence/`)
1. `01-sugaree-focused-fresh.png` — Sugaree at idx 20 focused; composer not yet open
2. `02-composer-open-empty.png` — contextual composer opened, empty textarea, "+ Add note at 38:40 · Sugaree" header
3. `03-meaningful-text-typed.png` — full musician note typed (97 chars)
4. `04-switched-to-after-midnight.png` — focus switched to idx 11 (the destructive interaction); old composer torn down
5. `05-back-to-sugaree-focused-pre-composer.png` — refocused Sugaree row, composer not yet reopened
6. `06-composer-reopened-draft-restored.png` — composer reopened; textarea pre-filled byte-for-byte; **"📝 unsaved draft" badge visible in header**
7. `07-review-mode-closed.png` — Review Mode entirely closed (overlay gone)
8. `08-review-mode-reopened-after-close.png` — Review Mode re-launched fresh
9. `09-after-close-reopen-draft-still-there.png` — refocused Sugaree, reopened composer → draft survives close+reopen cycle byte-for-byte

### Flow 2 — Interruption (`interruption/`)
1. `01-typing-resumed-mid-thought.png` — appended " — added more thought" to restored draft (118 chars total)
2. `02-scrolled-with-composer-open.png` — segments-list scrolled 400px while composer open; composer scrolls with the list (NOT sticky)
3. `03-navigated-away-to-songs.png` — full hash-route nav to `#songs` while composer was open
4. `04-returned-draft-restored.png` — back to `#rehearsal`, fresh Review Mode open, refocused Sugaree, reopened composer → extended draft restored

### Flow 3 — Cognitive load (`cognitive-load/`)
1. `01-focused-row-dimmed-neighbors-composer-open.png` — Sugaree focused, neighbors at opacity 0.5, composer open
2. `02-play-attempted-with-composer.png` — Play tapped (button changes to ⏸ Pause); Now Reviewing still says "Music Never Stopped" (idx 0) while focus + composer are on Sugaree (idx 20)
3. `03-full-page-cognitive-landscape.png` — full-page screenshot exposing the entire visual landscape

### Flow 4 — Cold open (`cold-open/`)
1. `00-app-landing-on-load.png` — initial app load (pre-band-selection)
2. `01-rehearsal-page-loaded.png` — Rehearsal page after band activated
3. `02-review-mode-fresh-open-viewport.png` — Review Mode immediately on open — **THE CANONICAL COLD-OPEN VIEW**
4. `03-review-mode-fresh-open-fullpage.png` — full-page version of cold open
5. `04-segments-scrolled-down.png` — segments scrolled 300px to expose more rows

### Flow 5 — Reverb interaction (`reverb-flow/`)
1. `01-tools-sheet-open.png` — Tools (⋯) bottom sheet expanded
2. `02-custom-mix-opened.png` — Custom Mix attempted to open (blocked — see #3)
3. `03-onboarding-overlay-bug-23-intercepts.png` — **Bug #23 caught live: Songs onboarding overlay auto-shown + intercepting clicks** on a wholly unrelated workflow
4. `04-custom-mix-modal-actual.png` — Custom Mix modal after onboarding overlay programmatically dismissed
5. `05-reverb-at-0pct-default.png` — Master reverb amount slider at 0%
6. `06-reverb-at-50pct.png` — slider moved to 50%
7. `07-reverb-at-100pct.png` — slider at 100%
8. `08-custom-mix-fullpage.png` — full-page Custom Mix at reverb=100%
9. `09-reopened-reverb-value-check.png` — modal closed and reopened → reverb returns to 0% (NOT persisted)
10. `10-custom-mix-reopened-fullpage.png` — full-page after close+reopen

---

## Per-flow interaction notes

### Flow 1 — Draft persistence

| Step | Interaction | Result | Latency |
|---|---|---|---|
| Focus Sugaree | `_mtMobileFocusRow(20)` | Row gains action surface (rename / ▶ / ✓ / ⊘ / "+ Add note at 38:40 · Sugaree"); neighbors drop to opacity 0.5 | <100ms |
| Open composer | tap "+ Add note at 38:40 · Sugaree" | textarea + 5 tag chips + "+ more tags ▾" + Cancel + Save render inline below row | ~80ms render delay |
| Type 97-char note | `pressSequentially` | textarea fills; localStorage key `gl_mt_composer_drafts/rsess_mt_mpju4yyn_7pko/s2320948e2405497` populated after 400ms debounce | confirmed via localStorage read |
| Switch focus to idx 11 | `_mtMobileFocusRow(11)` | OLD composer DOM destroyed; draft localStorage value preserved exactly | confirmed |
| Refocus idx 20 | `_mtMobileFocusRow(20)` | New action surface; "+ Add note at 38:40" reappears | <100ms |
| Reopen composer | tap "+ Add note at 38:40" | textarea pre-filled with full 97 chars byte-for-byte; header reads **"📝 at 38:40 · Sugaree · 📝 unsaved draft"** | restore is immediate |
| Close Review Mode entirely | × button | overlay removed; localStorage draft persists | confirmed |
| Reopen Review Mode + refocus + reopen composer | full round-trip | textarea pre-filled byte-for-byte; "unsaved draft" badge present | full restore |

**Verdict: the Bug #21 trust-layer fix works exactly as designed.** Three teardown paths tested (focus-switch, close, navigate-away in Flow 2) — all preserve text byte-for-byte and re-surface with badge on reopen.

### Flow 2 — Interruption

| Step | Result |
|---|---|
| Extend draft with " — added more thought" | dispatched `input` event; localStorage value updated to 118 chars after debounce |
| Scroll segments list 400px down while composer open | textarea scrolls UP with the content (from top=542 → top=368). Composer is **inline within row, not sticky**. Save button stayed in viewport (top=701 → 528) |
| **[NOT-OBSERVABLE]** iOS keyboard appearance / dismissal | Chromium reports `window.visualViewport.height = 844` regardless of textarea focus. Real iOS would shrink visualViewport to ~470px when keyboard appears. Cannot validate Save-visible-with-keyboard scenario. |
| Nav away (`#rehearsal` → `#songs`) | Review Mode overlay stayed in DOM but hash-route changed; localStorage draft preserved |
| Nav back + reopen Review Mode + refocus + reopen composer | extended draft (118 chars) restored byte-for-byte |

**Verdict: draft persistence is robust across navigation interruption.** What's NOT testable in this harness: whether iOS Safari's address-bar collapse + keyboard appearance combine to push Save off-viewport in a way the desktop Chromium tests don't catch.

### Flow 3 — Cognitive load

**Visible-viewport landscape with Sugaree focused + composer open + render persistence banner active:**
- **15 indigo-tinted elements** in the visible 844px viewport at once:
  - `#mtReviewStatusBanner` — "⏳ Rendering on the server… (15s elapsed)" — indigo 10% (persisted in-flight render from prior session)
  - `🎯 Analyze` button — indigo 12%
  - Instruction band "💡 Name songs · flag chatter · then 🎛 Tools → Mix → Render songs only" — indigo 6%
  - "🎵 Songs 31" filter chip — indigo 22%
  - "+ More" filter chip — indigo 10%
  - **`Music Never Stopped` row at top=207 — indigo 10% AND opacity 0.5** (Bug #11 visually confirmed: dimmed neighbor is STILL indigo-tinted, creating a competing "lit" row even when Sugaree is the focused row)
- **30 segment rows at opacity 0.5** (all neighbors of Sugaree)
- **0 rows at full opacity in the visible window** (focused Sugaree is partially below the segment-list visible area due to composer expansion)

**Now-Reviewing label vs focused row vs playback context — three separate concepts:**
- Focus = Sugaree (idx 20) — user is composing about it
- "🎵 Reviewing: Music Never Stopped · 0:00–8:36 · 96%" — the now-reviewing label
- Play button after tap = ⏸ Pause — playing the auto-active segment (Music Never Stopped), NOT the focused row

This is the strongest cognitive-load finding: focus, now-reviewing label, and playback context are three decoupled concepts. The visual evidence cannot tell the user which one of these the system considers "current."

### Flow 4 — Cold open

**Order of visual attention on first paint** (DOM measurement of top-of-viewport elements, top → down):

1. `top=62` — header row: `👁 Mon, May 18 · Drew's House (Rehearsal) · 17 tracks ⋯ ×`
2. `top=99` — **`⏳ Rendering on the server… (25s elapsed)` banner with indigo 10% wash** (Bug #19 mitigation; in-flight render from prior session surfaces on cold open)
3. `top=143–219` — transport row: ⏪30 ⏪5 ▶Play 5⏩ 30⏩ — and 🎯 Analyze | 📋 Digest buttons
4. `top=201` — **"🎵 Reviewing: Music Never Stopped · 0:00–8:36 · 96%"** — the now-reviewing label
5. `top=318` — segments panel header: `🎯 Segments — 31 songs · 110 more in filters`
6. `top=361` — instruction band: `💡 Name songs · flag chatter · then 🎛 Tools → Mix → Render songs only ×`
7. `top=403` — Songs 31 filter chip + + More chip
8. **`top=433` — `🎵 Music Never Stopped 96% 8m 36s` — segment row WITH `background-color: rgba(99, 102, 241, 0.1)` indigo wash applied even though no audio has played**

**Bug #26 visually confirmed at cold open:** the auto-active-segment indigo highlight is on row 0 the moment Review Mode opens, with zero user playback. Same indigo color family (`rgba(99,102,241,0.X)`) as the render banner, the Songs filter chip, and the cognitive-load-flow's lit elements — creating **three to five competing indigo elements** at first glance.

### Flow 5 — Reverb interaction

| Step | Result | Note |
|---|---|---|
| Open Tools (⋯) | bottom sheet renders with 6 options (Keeper / Mix / Text / Export / Isolate / Stems) | each option has descriptive label per Pass 1 UX convergence |
| Tap "🎛 Mix — dial in levels + render" | **CLICK INTERCEPTED by `gl-onboard-backdrop`** — Songs onboarding overlay auto-rendered on top of Review Mode | **Bug #23 caught live mid-harvest.** No path forward for non-technical user. |
| (Workaround) programmatically dismiss onboarding overlay | onboard nodes removed | required Claude-level DOM access; band member would be stuck |
| Open Custom Mix modal | renders with: header `🎛 Custom Mix ×`, helper text `Dial each group, then render. The new mix becomes Review Mode's playback.`, 5 group sliders (Vocals/Guitars/Bass/Drums/Keys at 100% each), `💧 Master reverb amount 0%` slider, `Send to reverb [🎤 Vocals 🎸 Guitars 🎸 Bass 🥁 Drums 🎹 Keys]` per-group toggles, `Render songs only` action with `(31 segments ~111 min of audio)` and explanation copy | Pass 2 "Master reverb amount" relabel confirmed |
| Slider 0% → 50% → 100% | label updates live to "💧 Master reverb amount 50%" → "100%" | <50ms input latency |
| **[NOT-OBSERVABLE]** Audible reverb difference at 0/50/100% | Playwright cannot render or play audio output. Drew's A/B perceptual test cannot be replaced by this harness. | the perceptual A/B is still on Drew |
| Close + reopen Custom Mix modal | **slider resets to 0%** (NOT persisted) | see finding below |
| Firebase mixState probe | `bands/deadcetera/rehearsal_sessions/{sid}/mixState` contains `reverbWet: 0.48` saved 2026-05-24 from prior Isolate Mode usage | two reverb surfaces with different persistence semantics |

---

## Emotional UX observations (Claude's best-effort, NOT authoritative)

### Moments that read as CALM

1. **The "+ Add note at 38:40 · Sugaree" affordance.** Pre-fills the time anchor automatically. The user doesn't have to think about "what segment, what timestamp." Reads as the system meeting the user at the rehearsal-native level. *[DIRECT]*
2. **Focused row dim model when nothing else competes.** When the render banner and the now-reviewing label don't fight for attention, the dim-to-0.5 on neighbors creates clear focal direction. *[DIRECT]*
3. **The "💡 Name songs · flag chatter · then 🎛 Tools → Mix → Render songs only" instruction band.** Sets expectations without being preachy. *[DIRECT]*

### Moments that read as STRESSFUL

1. **Cold-open with the render banner counting up (15s, 25s, 75s elapsed).** *[DIRECT]* The user sees "still rendering" before they've done anything in this session. Two readings: (a) reassuring continuity — "my render didn't die" — OR (b) anxiety — "why is it still going? did something hang?" The reading depends on whether the user remembers initiating the render in a prior session. New users will read it as ambient anxiety.
2. **Three competing indigo elements at first glance.** *[DIRECT]* Render banner (indigo 10%) + auto-active segment row (indigo 10%) + Songs filter chip (indigo 22%) all use the same color family. The user's eye has nowhere to rest first.
3. **Bug #23 onboarding overlay intercepting Mix flow.** *[DIRECT]* A band member trying to render a custom mix would tap Mix → nothing happens → tap again → still nothing. Cannot proceed without dismissing onboarding which they didn't request. **This is a hard blocker masquerading as a UX quirk.**

### Moments that read as TRUSTWORTHY

1. **"📝 unsaved draft" badge on composer reopen after focus-switch.** *[DIRECT]* The system is announcing "I remembered." Combined with the textarea pre-filled byte-for-byte = exactly the trust gesture Pass 2.5 was designed to deliver.
2. **Draft survives close + reopen of Review Mode entirely.** *[DIRECT]* The most demanding teardown path. Draft is keyed by `sessionId + startSec/endSec`, NOT by transient indices, so it survives re-analyze re-indexing too. This is invisible engineering but it's the foundation under "musical operational memory."
3. **Persisted render banner.** *[DIRECT]* Closes Drew's "I hope the render worked" emotional failure — the render's progress is visible without the user having to remember they started it. (Note: stressful in some readings, trustworthy in others; depends on user mental model.)

### Moments that read as FRAGILE

1. **Custom Mix reverb value does NOT persist across close + reopen.** *[DIRECT]* User dials reverb to a setting they like, closes the modal (e.g., to scroll the segments list, or check the Now Reviewing context), reopens → slider is back to 0%. Their adjustment is gone. **This is borderline trust-layer (LOSES captured user data).** A band member who spends 30 seconds dialing in a mix and then loses it would treat the app as untrustworthy for mix work.
2. **Two reverb surfaces (Custom Mix vs Isolate Mode) with different persistence semantics.** *[DIRECT]* Isolate Mode's `reverbWet` IS saved to Firebase (`0.48` from 2026-05-24); Custom Mix's `Master reverb amount` is ephemeral. Visually they look the same to the user. The user has no way to know which adjustment is "remembered."
3. **Now-reviewing label decouples from focused row.** *[DIRECT]* When the user has focused Sugaree, has the composer open, and starts playback, the audio is playing Music Never Stopped (the auto-active segment from cold-open) — and the system never explicitly tells them this is the case. Trust gap: "what am I actually hearing?"
4. **Composer is inline, not sticky.** *[DIRECT]* If the user opens the composer and then scrolls the segments list to glance at another segment, the composer scrolls UP with the page. If the segments list scroll is long enough, the composer's Save button could disappear off the top edge while the user is still typing. Drafts protect against data loss, but the user's mental model of "where is my note" gets fragile.
5. **[NOT-OBSERVABLE]** Real iOS keyboard impact on Save visibility — cannot validate from Chromium.

---

## Most visually confusing moment

**Cold-open of Review Mode while a prior render is still in flight.** Single screenshot to look at: `cold-open/02-review-mode-fresh-open-viewport.png`.

Three things compete for first-glance attention, all in the same indigo color family:
- `⏳ Rendering on the server… (25s elapsed)` banner (indigo wash, top of viewport)
- `🎵 Reviewing: Music Never Stopped · 0:00–8:36 · 96%` (now-reviewing label)
- `🎵 Music Never Stopped` segment row (indigo background highlight applied with no audio playing — Bug #26)

A band member opening Review Mode for the first time cannot tell which of these is the "current state of the system." Is something playing? Is something rendering? Is "Music Never Stopped" the song to focus on, or is that just where the cursor happens to be? The visual language is ambiguous.

---

## Most successful interaction

**Type note → switch segments → return → reopen composer → see byte-for-byte restored text + "📝 unsaved draft" badge.** Screenshots `draft-persistence/03 → 04 → 05 → 06`.

The Pass 2.5 trust-layer fix delivers exactly the emotional gesture it was designed for: the app says "I remembered." The badge is direct, the timestamp anchor is preserved, the tag chips reset cleanly (a separate UX call worth checking — tags don't restore, only text does). The restore happens fast enough that there is no "loading" moment where the user wonders if their text is gone.

---

## Most emotionally reassuring interaction

**Close Review Mode entirely → reopen → refocus → reopen composer → text still there.** Screenshots `draft-persistence/07 → 08 → 09`.

The user can fully leave the player and come back later — what feels like the most "ephemeral" UI surface (a modal overlay) — and their captured thought survives. This is the gesture that, if Drew validates it emotionally, justifies the "musical operational memory" framing in the moat narrative. The badge persists across this round-trip too, which means the user gets the same "I remembered" announcement on every re-entry, not just the first one.

---

## Most emotionally risky interaction

**Setting a Custom Mix reverb value, closing the modal, reopening, and finding the value reset to 0%.** Screenshots `reverb-flow/07 → 09`.

Symmetry break: drafts are remembered, but mix adjustments are not. The user has no way to predict which "I adjusted this" gestures are durable. Worse, the Firebase-saved Isolate Mode reverbWet=0.48 from a prior session sits there persistently while the Custom Mix slider opens at 0 every time — so the visual reverb story across the two surfaces is contradictory.

Trust-layer classification per `feedback_trust_layer_triage_rule`:
- **LOSES captured user data** (reverb value adjusted by user, not persisted on close)
- **OBSCURES system state** (user doesn't know which reverb adjustment is "remembered" without inspecting Firebase)

Recommend Drew + ChatGPT evaluate whether this rises to HIGH trust-layer priority or stays as quality/coherence work. The visual evidence supports HIGH; the *intent* of the Custom Mix slider (ephemeral pre-render dial-in vs persistent mix preference) is a product decision that would clarify priority.

---

## Findings ChatGPT should specifically evaluate

| # | Finding | Severity (Claude's read) | Trust-layer? |
|---|---|---|---|
| 1 | Pass 2.5 draft persistence works end-to-end across 3 teardown paths (focus-switch / close+reopen / nav-away+return) | POSITIVE | n/a — closes a trust gap |
| 2 | Bug #26 visually confirmed at cold open: indigo highlight on first segment row with no playback | MED | Borderline (creates "is this playing? was it?" uncertainty = OBSCURES system state) |
| 3 | Bug #11 (focus dim + auto-active highlight competing) visually confirmed: dimmed neighbor row still indigo-tinted | MED | No — visual coherence, not data loss |
| 4 | Bug #23 caught live: Songs onboarding overlay intercepts Mix flow with no recovery | **HIGH** | Borderline (blocks user from a paid path = OBSCURES intent) |
| 5 | Custom Mix reverb amount does NOT persist across close+reopen | **HIGH-candidate** | **YES** (LOSES captured user data) — but intent ambiguity (ephemeral vs persistent) needs Drew product decision |
| 6 | Two reverb surfaces (Custom Mix vs Isolate Mode) with different persistence semantics | MED | Borderline (OBSCURES which adjustment is remembered) |
| 7 | Now-Reviewing label decouples from focused row decouples from active playback — three concepts | MED | Borderline (OBSCURES "what am I hearing right now") |
| 8 | Cold-open visual landscape has 3–5 indigo-tinted elements competing for first attention | MED | No — quality/coherence |
| 9 | Composer is inline, scrolls with segments list — can disappear off viewport during scroll while typing | LOW (drafts protect) | No |
| 10 | "📝 at 38:40 · Sugaree · 📝 unsaved draft" badge uses TWO 📝 emojis (anchor + draft state) — possibly visually redundant | LOW | No |
| 11 | **[NOT-OBSERVABLE]** Real iOS keyboard impact on Save visibility | Unknown | Unknown — needs real iPhone validation by Drew |

---

## Recommendations (for Drew + ChatGPT review)

**Highest leverage observations to act on:**

1. **Bug #23 escalates to TRUST-LAYER candidate.** Caught live mid-harvest = high real-world hit rate. A user tap that produces no visible response on a billed/promoted feature path is the worst UX failure mode. Recommend re-triage from MED to HIGH per the standing trust-layer rule.

2. **Custom Mix reverb persistence is a product decision, not a bug to "fix" without thought.** If the intent is "you dial in the mix you want and render it," ephemeral state is fine — but then add either (a) an "auto-saved" affordance when the user moves the slider, or (b) a sticky "your last mix" recall option on reopen. If the intent is "this is the mix preference for this session," persist to `mixState.reverbWet` on debounce.

3. **Cold-open competing indigo elements deserve a coherence pass.** The render banner, the auto-active highlight, and the filter chip should use distinguishable visual languages (different hue, different weight, different shape) so the first-glance attention has a single anchor.

4. **Bug #26 + Bug #11 form a coherent pair.** Both are about the auto-active-segment indigo highlight behaving as a permanent "lit" indicator regardless of focus / playback. A single fix that gates the auto-highlight on `audio.currentTime > 0 || _mobileFocusedIdx === idx` closes both.

5. **Now-Reviewing decoupling deserves a label fix at minimum.** When user focuses a different row than the auto-active one, the "Now Reviewing" label could show `🎵 Reviewing: Music Never Stopped · ⏸ paused · focused on Sugaree` or similar — explicitly disambiguating the three concepts.

---

## What's still pending Drew's ear (not replaceable by this harness)

- Reverb perceptual A/B (wet=0/0.5/1.0 on Custom Mix output) — only Drew can validate Phase A.5 ratio boost
- Real-iOS-Safari Save-button-with-keyboard scenario — needs real iPhone
- Real-iOS-Safari scroll momentum + address-bar behavior during composer-open-and-scroll — needs real iPhone
- Whether the "📝 unsaved draft" badge reads as trust-positive vs nagging in actual band-member use — only humans

---

## Test session cleanup

- Test draft `gl_mt_composer_drafts/rsess_mt_mpju4yyn_7pko/s2320948e2405497` was removed from localStorage at end of harvest
- No Firebase writes were performed (all reads only)
- No real Custom Mix render was triggered (slider state changes only; never tapped "Render songs only")
- Songs onboarding overlay was DOM-removed during harvest; it will reappear on next legitimate hit per its own logic
