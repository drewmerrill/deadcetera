# GrooveLinx Competitive Matrix

_Last updated: 2026-04-30_

## TL;DR

GrooveLinx is a "Band Operating System" sitting in a gap that no single competitor fills: dedicated band-ops apps (Bandhelper, OnSong, SongbookPro) own Plan + Perform but ignore Rehearse/Improve and have no native stem separation; AI stems vendors (Moises, LALAL.AI) own Learn but are single-song toys with no setlist, schedule, or band layer; practice tools (Anytune, Soundslice, iRealPro) are solo-musician oriented; and DIY stacks (Notion + Spotify + Moises + Google Calendar) are what most working bands actually use today. GrooveLinx's defensible wedge is the **Rehearse + Improve** pillars (per-member readiness, walkthrough mode, post-rehearsal insights, band pulse) plus a unified shell over self-hosted stems — nothing else combines those.

---

## 1. Competitor Inventory

### Direct band-ops competitors
- **Bandhelper** — setlists, charts, schedule, contacts, file sharing, MIDI/light cues. Strongest all-rounder.
- **OnSong** — chart-centric performance app, big iPad install base, setlist + autoscroll + MIDI.
- **Setlist Maker** (Arlo Leach, predecessor to Bandhelper) — still sold; lighter, cheaper.
- **Setlist Helper** (different vendor) — Android/iOS, gig book + setlist + finances.
- **SongbookPro** — chart library, transposing, setlist, foot pedal support.
- **MobileSheets / MobileSheetsPro** — sheet-music focused, heavy classical/cover-band use.
- **unrealBook / forScore** — sheet-music readers (forScore is iPad-default for classical/jazz).
- **BandFriend / GigBook** — older, smaller niche apps.
- **Prompt** — minimalist iOS setlist/lyrics teleprompter.

### Stems / vocal isolation
- **Moises.ai** — market leader, stems + pitch/tempo + chords + metronome. Was GrooveLinx's old backend.
- **LALAL.AI** — high-quality stem split, web + API. GrooveLinx uses it for Harmony Lab lead/backing split.
- **AudioStrip** — browser vocal remover, free tier.
- **Vocali.se / Vocal Remover.org / vocalremover.org** — free web tools, lower quality.
- **Demucs** (Meta, OSS) — model GrooveLinx self-hosts via Modal.
- **Spleeter** (Deezer, OSS) — older, mostly superseded by Demucs.
- **Audioshake** — pro-grade API stems (sync licensing market).
- **RipX DeepRemix / DeepCreate** — desktop, note-level editing of stems.
- **Stable Audio Tools / Demucs forks** — researcher-tier; not consumer products.

### Practice / learning
- **Anytune / Anytune Pro+** — slow-down, loop, pitch shift; classic practice tool.
- **Capo (SuperMegaUltraGroovy)** — Mac/iOS, chord detection + slow down.
- **iRealPro** — chord-chart playback with band-in-a-box style backing; dominant in jazz.
- **Soundslice** — best-in-class synced notation/tab + video; web-first.
- **Chordify** — auto chord detection from any audio/YouTube; subscription.
- **Ultimate Guitar (Tabs/Tab Pro)** — massive tab library + Tonebridge; practice tools bolted on.
- **Songsterr** — synced tabs, playback.
- **Hookpad / Hooktheory** — songwriting/theory tool; tangential.
- **GuitarTuna / Fender Play** — beginner-focused; tangential.
- **Yousician / Simply Guitar / Rocksmith+** — gamified solo learning.

### Band collaboration / recording
- **BandLab** — free DAW + social, huge user base, mostly bedroom producers.
- **Soundtrap (Spotify)** — browser DAW, education-heavy.
- **Splice** — sample marketplace + project sync; producer-focused.
- **Drooble** — band social network, mostly dormant.
- **Kompoz / ProCollab** — remote collab DAWs, niche.

### Band websites + e-commerce (mostly out-of-scope)
- **Bandzoogle** — band websites + merch.
- **ReverbNation** — band promo, declining.
- **Bandcamp** — artist-direct sales; out-of-scope but bands use it.

### Live performance rigs (host/keyboard layer)
- **Cantabile** — Windows VST host for live keyboard rigs.
- **Apple MainStage** — macOS live rig host.
- **Gig Performer** — cross-platform VST host with setlist/songs.
- **Ableton Live** — used live by many but is a DAW, not a band-ops tool.

### Generic ops (DIY stacks bands actually use)
- **Notion / Airtable** — song databases, gig logs.
- **Trello / Asana** — task lists for bands.
- **Slack / Discord / GroupMe / WhatsApp** — band chat.
- **Google Workspace (Calendar, Drive, Docs, Sheets)** — schedules, charts, recordings.
- **Spotify / Apple Music / YouTube** — reference listening.
- **Dropbox** — file sharing, especially recordings.

### Recently shut down / abandoned (mark and skip)
- **Setlists.fm app** — concert log, not a band-ops tool, still alive but tangential.
- **Gigwell** — booking, pivoted to enterprise.
- **Gigify / Gigsalad** — booking sites; out-of-scope.

---

## 2. Master Matrix (5 Pillars + AI Assistant)

Legend: ✅ full coverage · 🟡 partial · 🟦 adjacent (has it but not core) · ❌ none

### Band-ops competitors

| Competitor | Plan | Rehearse | Perform | Learn | Improve | AI Asst | Notes |
|---|---|---|---|---|---|---|---|
| Bandhelper | ✅ | 🟡 | ✅ | ❌ | 🟡 | ❌ | Best all-rounder; "rehearse" = mark-songs-rehearsed; analytics light |
| OnSong | 🟡 | ❌ | ✅ | ❌ | ❌ | ❌ | Chart performance king; weak on schedule/calendar |
| SongbookPro | 🟡 | ❌ | ✅ | ❌ | ❌ | ❌ | Charts + setlist; no band-side collab |
| Setlist Maker | 🟡 | ❌ | 🟡 | ❌ | ❌ | ❌ | Older/cheaper, similar shape to Bandhelper |
| MobileSheets | 🟡 | ❌ | ✅ | ❌ | ❌ | ❌ | Sheet-music reader, not a band OS |
| forScore | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Classical/jazz iPad sheet reader |
| Prompt | ❌ | ❌ | 🟡 | ❌ | ❌ | ❌ | Lyrics teleprompter only |

### Stems / vocal isolation

| Competitor | Plan | Rehearse | Perform | Learn | Improve | AI Asst | Notes |
|---|---|---|---|---|---|---|---|
| Moises | ❌ | 🟡 | ❌ | ✅ | ❌ | 🟡 | Stems + chords + tempo; "setlists" feature exists but shallow |
| LALAL.AI | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | Single-purpose stem splitter |
| AudioStrip | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | Free vocal-remove; lower fidelity |
| Demucs (OSS) | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | Engine, not a product |
| RipX DeepRemix | ❌ | ❌ | ❌ | 🟡 | ❌ | ❌ | Desktop note-edit on stems; producer tool |
| Audioshake | ❌ | ❌ | ❌ | 🟦 | ❌ | ❌ | B2B sync-licensing; not for bands |

### Practice / learning

| Competitor | Plan | Rehearse | Perform | Learn | Improve | AI Asst | Notes |
|---|---|---|---|---|---|---|---|
| Anytune | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Slow/loop/pitch — solo practice |
| Capo | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Auto chord detect + practice |
| iRealPro | 🟡 | ❌ | 🟡 | ✅ | ❌ | ❌ | Chord-chart + backing; jazz/cover staple |
| Soundslice | ❌ | ❌ | 🟡 | ✅ | ❌ | ❌ | Best synced notation/tab/video web tool |
| Chordify | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Auto chord detect from URL |
| Ultimate Guitar | 🟦 | ❌ | 🟡 | ✅ | ❌ | ❌ | Tab library + Tonebridge tone matching |
| Songsterr | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Synced tab playback |
| Yousician | ❌ | ❌ | ❌ | 🟡 | 🟡 | ❌ | Solo gamified learning |

### Collaboration / DAW / live rig / generic

| Competitor | Plan | Rehearse | Perform | Learn | Improve | AI Asst | Notes |
|---|---|---|---|---|---|---|---|
| BandLab | 🟦 | ❌ | ❌ | 🟡 | ❌ | 🟡 | Free DAW + social; AI tools added 2024-25 |
| Soundtrap | ❌ | ❌ | ❌ | 🟡 | ❌ | 🟡 | Browser DAW; education focus |
| Splice | ❌ | ❌ | ❌ | 🟦 | ❌ | 🟡 | Sample marketplace + project sync |
| Cantabile / MainStage / Gig Performer | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | Live VST host; setlist of patches, not band ops |
| Bandzoogle | 🟦 | ❌ | ❌ | ❌ | ❌ | ❌ | Website/merch — out of scope |
| Notion + Airtable | ✅ | 🟡 | ❌ | ❌ | 🟡 | 🟦 | DIY band wiki; what bands actually use |
| Google Workspace | ✅ | ❌ | 🟡 | ❌ | ❌ | 🟦 | Calendar/Drive/Docs DIY |
| Slack / Discord / GroupMe | ❌ | 🟦 | ❌ | ❌ | 🟡 | 🟦 | Band chat; pulse-of-band lives here |

---

## 3. Pillar Drill-Downs

### 3a. Plan — songs, setlists, schedule, calendar sync, gigs

| Tool | Songs catalog | Setlists | Schedule/Gigs | 2-way Cal sync | Member roles |
|---|---|---|---|---|---|
| Bandhelper | ✅ | ✅ | ✅ | 🟡 (export) | ✅ |
| OnSong | ✅ | ✅ | 🟡 | ❌ | 🟡 |
| SongbookPro | ✅ | ✅ | ❌ | ❌ | ❌ |
| Setlist Maker | ✅ | ✅ | ✅ | 🟡 | ✅ |
| iRealPro | ✅ | ✅ | ❌ | ❌ | ❌ |
| Notion/Airtable (DIY) | ✅ | 🟡 | ✅ | 🟡 | ✅ |
| **GrooveLinx** | ✅ | ✅ | ✅ | ✅ (true 2-way) | ✅ |

### 3b. Rehearse — plans, agenda, readiness, walkthrough, insights

| Tool | Rehearsal plan | Per-song readiness | **Per-member readiness** | Walkthrough mode | Practice actions | Cross-session insights |
|---|---|---|---|---|---|---|
| Bandhelper | 🟡 (rehearsed flag) | 🟡 | ❌ | ❌ | ❌ | ❌ |
| OnSong | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Moises | ❌ | ❌ | ❌ | ❌ | 🟡 (loop/tempo) | ❌ |
| Soundslice | ❌ | ❌ | ❌ | 🟡 (course mode) | 🟡 | ❌ |
| Notion (DIY) | 🟡 | 🟡 | 🟡 | ❌ | ❌ | ❌ |
| **GrooveLinx** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> No competitor combines per-member readiness + walkthrough + post-session analytics. This is GrooveLinx's clearest moat.

### 3c. Perform — Stage View, Live Gig charts, Stage Plot, sub-second SLA

| Tool | Stage/setlist view | Auto-scroll | Swipe nav | Big-text mode | Stage plot | <1s render |
|---|---|---|---|---|---|---|
| Bandhelper | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| OnSong | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| SongbookPro | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| MobileSheets | ✅ | ✅ | ✅ | 🟡 | ❌ | ✅ |
| Prompt | 🟡 | ✅ | ✅ | ✅ | ❌ | ✅ |
| Cantabile/MainStage | 🟡 (patches) | ❌ | 🟡 | ❌ | ❌ | ✅ |
| StagePlotPro / Stage Plot Designer | ❌ | ❌ | ❌ | ❌ | ✅ | n/a |
| **GrooveLinx** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> Native band-ops apps own this pillar. GrooveLinx is at parity (and adds stage plot inline), not ahead. Performance reliability is table-stakes here — drop a frame on stage and you lose trust.

### 3d. Learn — stems, harmony lab, BPM/key, song intelligence

| Tool | Stem separation | Lead/backing split | Notation overlay | BPM auto-detect | Key auto-detect | Phrase loops | Self-host option |
|---|---|---|---|---|---|---|---|
| Moises | ✅ (4-6 stems) | 🟡 (vocal stem only) | ❌ | ✅ | ✅ | ✅ | ❌ |
| LALAL.AI | ✅ | 🟡 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Soundslice | ❌ | ❌ | ✅ | 🟡 | 🟡 | ✅ | ❌ |
| Anytune | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Capo | 🟡 | ❌ | 🟡 (chords) | ✅ | ✅ | ✅ | ❌ |
| Chordify | ❌ | ❌ | 🟡 | ✅ | ✅ | ❌ | ❌ |
| iRealPro | ❌ | ❌ | ✅ (chord chart) | n/a | ✅ | ✅ | ❌ |
| RipX | ✅ | 🟡 | ✅ (note-level) | ✅ | ✅ | ✅ | ❌ |
| **GrooveLinx** | ✅ (Demucs htdemucs_6s) | ✅ (LALAL.AI) | 🟡 (abcjs) | ✅ | ✅ | ✅ | ✅ |

> GrooveLinx is the only one combining 6-stem + lead/backing split + notation in one shell, and the only one self-hosting stems (cost + privacy advantage). Soundslice still beats GrooveLinx on notation depth.

### 3e. Improve — insights, activity feed, band pulse, notifications

| Tool | Post-rehearsal recap | Activity feed | Band pulse / health | In-app banner | Browser push (FCM) | SMS (Twilio) |
|---|---|---|---|---|---|---|
| Bandhelper | ❌ | 🟡 (file activity) | ❌ | 🟡 | ❌ | ❌ |
| OnSong | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Slack/Discord | n/a | ✅ | 🟡 | ✅ | ✅ | ❌ |
| Notion | ❌ | 🟡 | ❌ | ✅ | ✅ | ❌ |
| BandLab | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **GrooveLinx** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> No competitor frames the band as an entity-with-a-pulse. Closest analogue is Slack-as-band-channel — which bands already use, so GrooveLinx must beat the "good-enough Slack thread" baseline.

### 3f. AI Assistant (GrooveMate)

| Tool | Voice input | Text chat | Imports/song packs | Captures notes | Captures feedback | Operates the app |
|---|---|---|---|---|---|---|
| Moises (chatbot) | ❌ | 🟡 | ❌ | ❌ | ❌ | ❌ |
| BandLab AI tools | 🟡 | ✅ | ❌ | ❌ | ❌ | 🟡 (DAW only) |
| Soundtrap AI | ❌ | 🟡 | ❌ | ❌ | ❌ | 🟡 |
| Notion AI | ❌ | ✅ | 🟡 | ✅ | 🟡 | 🟡 (Notion only) |
| ChatGPT/Claude (DIY) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **GrooveLinx GrooveMate** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> Domain-specific AI assistant for band operations is uncontested. Risk is execution quality, not competition.

---

## 4. Gap Analysis

### What only GrooveLinx has (true differentiators)

1. **Per-member readiness** — every other tool tracks song-level state, not member-level. Huge for bands with one weak link on a song.
2. **Walkthrough Mode** — structured run-through with timing snapshots; no analogue.
3. **Cross-session rehearsal insights** — "this song has been on the list 4 weeks and never landed" — competitors stop at "rehearsed: yes/no".
4. **Band pulse / activity feed framed as band health** — Slack has activity but not "what's happening with my band" as a product surface.
5. **Stems + Harmony Lab + setlist + schedule under one shell** — Moises has stems but no setlist; Bandhelper has setlist but no stems.
6. **Self-hosted Demucs pipeline** — cost-controlled, no Moises subscription per member, privacy-friendly for unreleased material.
7. **Domain-specific AI assistant (GrooveMate)** — Notion AI knows Notion; GrooveMate knows the band.
8. **3-layer notification system (in-app + FCM + SMS)** — band-ops apps mostly rely on email or nothing.

### Table-stakes where GrooveLinx is solid

- Songs catalog + setlists + chart rendering
- Setlist Stage View / Live Gig auto-scroll, swipe nav, big text
- BPM and key detection
- Stem separation (matches Moises quality with htdemucs_6s)
- Google Calendar two-way sync (better than most — Bandhelper is export-only)
- Multi-member band accounts
- Stage Plot

### Where competitors are better (honest gaps)

| Gap | Best-in-class | Severity |
|---|---|---|
| Notation/tab fidelity (synced playback, note-level) | Soundslice, RipX | Medium — Harmony Lab uses abcjs which is functional but not Soundslice-grade |
| Chord chart authoring + auto chord detect from any URL | Chordify, Capo | Medium — GrooveLinx relies on user-uploaded charts |
| MIDI / lighting / backing-track triggering at gigs | Bandhelper, OnSong | Medium-High — pro cover bands expect this |
| VST host / live keyboard rig integration | MainStage, Cantabile, Gig Performer | Low for target user (most working bands aren't running keyboard rigs) |
| Tab library (millions of songs pre-loaded) | Ultimate Guitar, Songsterr | Low — different use case (solo learning) |
| Footpedal hardware support for hands-free page turns | OnSong, SongbookPro, forScore | Medium — Live Gig hands-free is on stage today; pedal is a real ask |
| Sheet-music PDF library + annotation | forScore, MobileSheets | Low — covered by chart upload but not at forScore polish |
| Native iOS app (App Store presence, offline-first) | Bandhelper, OnSong, all sheet readers | High strategic concern — PWA reaches but App Store is where bands shop |
| Public song database / shared chord chart cloud | iRealPro forums, Ultimate Guitar | Low — not GrooveLinx's job |
| Booking / contracts / invoicing | Bandhelper (basic), Gigwell (pro) | Low-Medium — adjacent to gigs queue |
| Audio recording inside the app (rehearsal recordings) | BandLab, Soundtrap | Medium — bands record rehearsals constantly; lives in Dropbox today |
| Real-time collaboration on charts (multi-cursor edit) | Notion, Google Docs | Low — bands rarely co-author live |

---

## 5. Priority Recommendations

1. **Close: footpedal + offline-first + iOS App Store wrapper.** These are the table-stakes gaps that lose deals against Bandhelper/OnSong on stage. Footpedal is small effort, big trust signal. App Store presence affects discoverability more than capability.
2. **Close (medium term): rehearsal audio recording.** Bands already record every rehearsal — capturing it inside GrooveLinx and feeding it to the Improve pillar is a natural extension and turns a Dropbox habit into a product loop.
3. **Watch but don't chase: MIDI/lighting/backing-track triggering.** This is Bandhelper's moat with high-end cover bands; pursuing it pulls focus from the working-band sweet spot. Revisit only if pipeline shows demand.
4. **Ignore: e-commerce, band websites, booking platforms, full DAW, public tab library.** These are different products. Bandzoogle/Splice/Ultimate Guitar play different games — staying out keeps GrooveLinx coherent.
5. **Double down on the moat: Rehearse + Improve + GrooveMate.** No competitor is even attempting per-member readiness, walkthrough mode, or band pulse. These are where word-of-mouth comes from. Every roadmap quarter should ship at least one feature here before any parity-chasing work.

---

_Tools surveyed: ~50 across 7 categories. Coverage notes are based on publicly documented features as of early 2026; mark any cell as "verify" before quoting externally — vendor feature sets shift quarterly._
