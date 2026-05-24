# Multitrack Rehearsal — REAPER Export Checklist

This is the canonical recipe for getting an X32 multitrack rehearsal recording into GrooveLinx with **zero per-session manual track mapping**.

The strict filename convention `NN_role-member.flac` is what enables the GrooveLinx ingest UI to auto-infer role + band member from the filename — saving ~20 minutes of click-fest per rehearsal.

---

## One-time setup (do this once, then forget)

### 1. Create a REAPER project template

Open REAPER → File → New project. Add tracks matching your X32 channel count and name each one precisely with the GrooveLinx filename convention.

**Critical:** the channel-to-mic mapping is BAND-SPECIFIC and depends on how YOUR X32 inputs are wired. Don't trust a hypothetical "standard" plot — verify by listening to each channel after import. The earlier version of this doc assumed kick was on ch 1; Deadcetera's actual plot has VOCALS on ch 1-4 (see below).

### Deadcetera's actual X32 plot (captured 2026-05-24, first real ingest)

| Track # | Name (exactly this) | Source |
|---|---|---|
| 1 | `01_vocal-drew` | Drew's vocal mic (lead vox + rhythm guitar) |
| 2 | `02_vocal-brian` | Brian's vocal mic (lead guitar + sings) |
| 3 | `03_vocal-chris` | Chris's vocal mic (bass + sings) |
| 4 | `04_vocal-pierce` | Pierce's vocal mic (keys + sings) |
| 5 | `05_guitar-brian` | Brian's guitar (lead) |
| 6 | `06_guitar-drew` | Drew's guitar (rhythm) |
| 7 | `07_bass-chris` | Chris's bass DI |
| 8 | `08_open-jay` | "Open" mic — purpose TBD (audience/talkback? open hi-hat?) |
| 9 | `09_bongos-jay` | Jay's hand-percussion (bongos) — not the kit |
| 10 | `10_kick-jay` | Kick drum |
| 11 | `11_snare-jay` | Snare top |
| 12 | `12_tom1-jay` | Rack tom 1 |
| 13 | `13_tom2-jay` | Rack tom 2 |
| 14 | `14_tom3-jay` | Floor tom |
| 15 | `15_oh-l-jay` | Overhead L |
| 16 | `16_oh-r-jay` | Overhead R |
| 17 | `17_keys-l-pierce` | Keys L (stereo) |
| 18 | `18_keys-r-pierce` | Keys R (stereo) |
| 19-32 | _leave un-renamed; will batch-delete_ | Empty inputs / talkback / bus returns |

**No room mics** — Deadcetera uses ch 17-18 for stereo keys instead. Adjust to your own band's actual plot.

### For OTHER bands onboarding to GrooveLinx

Each band's X32 mic plot will differ. Best practice on first ingest:
1. Create a generic 22-track template with placeholder names
2. Drop the X-LIVE recording in, explode to per-channel tracks
3. Solo + listen each channel to identify what's on it
4. Rename the channel tracks in place per the `NN_role-member.flac` convention
5. Save the project as the band's permanent template — future ingests reuse the same naming

The filename convention itself (next section) is universal; only the channel-to-mic mapping is band-specific.

Save as: **`File → Project Templates → Save Project as Template…`** → name it `GrooveLinx-Multitrack`.

Now `File → New project from template → GrooveLinx-Multitrack` always gives you a properly-named track layout.

### 2. Save the export settings preset

In REAPER, after you've imported an X-LIVE folder once and routed each X32 channel to its corresponding GrooveLinx-named track:

- `File → Render…`
- Source: **Stems (selected tracks)**
- Bounds: **Entire project**
- Output filename: `$track` (REAPER token — uses each track's name as the filename)
- Output format: **FLAC** at **24-bit / 48 kHz**, compression level **8 (highest)**
- Channels: Mono per track (or follow track channel count if you have stereo pairs like keys L/R)
- Save preset as: `GrooveLinx FLAC stems`

Now every render is two clicks: pick the preset, hit Render.

---

## Per-rehearsal workflow

1. **Pop SD card → USB 3.0 reader → Mac.** Copy the X-LIVE recording folder to `~/Rehearsals/YYYY-MM-DD-VENUE/`. ~2 minutes for ~30GB at USB 3.0 speeds.
2. **Open the GrooveLinx-Multitrack template in REAPER.** New project from template → drag the X-LIVE folder onto the timeline. REAPER will parse the multiplexed WAV and route channels into your pre-named tracks (you may need to verify channel-to-track mapping the first time).
3. **(Optional) Trim silence at start/end.** Just the obvious bits — REAPER's "trim to selection" or set a time selection and `File → Render selection only`.
4. **Render with the GrooveLinx FLAC stems preset.** Output goes to a folder like `~/Rehearsals/YYYY-MM-DD-VENUE/stems/` containing `01_kick-jay.flac`, `02_snare-jay.flac`, etc.
5. **In GrooveLinx, click `+ Import multitrack 🎚`** in the Rehearsal page History section.
6. **Drag the `stems/` folder onto the drop zone.** All files land. Mapping table auto-fills (you'll see "auto" status on every row if names are correct).
7. **Set the date + venue, click "Upload & Create Session."** Uploads run in parallel. ~3-5 min for ~14 GB of FLAC over 100 Mbps.
8. **Player opens automatically.** Mute/solo any track, scrub the master timeline. Phase B will add timestamped comments.

---

## Filename convention reference

Pattern: `NN_role-member.flac`

- `NN` = 1-3 digit track number (just for sort order; doesn't have to match X32 channel)
- `role` = canonical role key (lowercase, hyphenated for multi-token):
  - Drums: `kick`, `snare`, `hat`, `tom-1`, `tom-2`, `tom-3`, `ride`, `oh-l`, `oh-r`
  - Room: `room-l`, `room-r`
  - Bass: `bass`
  - Guitar: `guitar`, `guitar-l`, `guitar-r`
  - Keys: `keys`, `keys-l`, `keys-r`
  - Vocal: `vocal`, `vocal-bg`
  - Misc: `click`, `aux`
- `member` = lowercase first name from the band roster (`drew`, `brian`, `pierce`, `jay`). Optional — leave it off for `room-l` / `room-r` etc.

Examples that parse cleanly:
- `01_kick-jay.flac` → role:kick, member:jay
- `04_oh-l-jay.flac` → role:oh-l (multi-token), member:jay
- `09_bass-brian.flac` → role:bass, member:brian
- `17_room-l.flac` → role:room-l, member:none

If a filename doesn't match this pattern, the ingest UI will flag it as `manual` and ask you to pick role + member from dropdowns.

---

## Troubleshooting

- **"Bad filename" error from worker:** Filename failed the regex `^[0-9]{1,3}_[a-z0-9-]+\.(flac|wav|opus|mp3|m4a)$`. Most common cause: spaces or capital letters. Rename to lowercase, no spaces.
- **All rows show "manual" in the mapping table:** Filenames probably don't match the convention. Spot-check one file's name vs. the examples above.
- **Upload stalls or times out:** Large FLACs (>500 MB each) over slow upstream may need to be retried per-file. The mapping table holds your selections; just close and re-drop the failed file.
- **Player can't decode FLAC:** Some older browsers don't support FLAC. Chrome, Safari, Edge, and Firefox 51+ all do. Check your browser version.

---

## When this gets revisited

- **Phase B (comments + segments):** Adds timestamped notes anchored to (timestamp, optional trackId, optional songId). Tag chips: rushed, dragged, pitchy, wrong chord, missed cue, transition, too loud, too quiet, tone, nail this, revisit.
- **Phase D (storage automation, deferred):** Auto-submix drum tracks to a stereo pair after 7 days; convert FLAC → Opus 128k after 90 days.

The strict filename convention will hold across all phases — this checklist won't go stale.
