# Stems Intelligence Plan — Hardened for Real Band Pain

**Status:** Draft v4 — research-hardened + ChatGPT-reviewed, awaiting Drew approval
**Date:** 2026-04-29
**Author:** Drew + Claude (session 2026-04-29, plus 3 research passes + ChatGPT review)
**Builds on:** `harmony_lab_ux_spec.md`, `pocket_meter.md`, `song_intelligence.md`, the Stems lens shipped 2026-04-29

**v4 changes:** realistic effort estimates (5–10 days for Phase 1, not 2.5); "1–4 min depending on track length" not "90 seconds"; "better fit for GrooveLinx harmony workflow" not "beats Fadr"; source-quality detection + warnings; Draft/Moderate/Strong notation confidence; storage retention strategy; shared mixer state store; product metric is "do bandmates learn parts faster," not SDR. Per-action source picker for harmony split (Option A from §4.6) added.

---

## 1. North Star

**This is not a Moises clone.** It's the **best tool in the world for bands learning harmonies**, that *happens to render Moises Premium unnecessary*.

The two features Moises will never do well — **(1) painkiller-quality vocal harmony separation + auto-notation, and (2) Jerry-vs-Bob lead/rhythm guitar split** — are GrooveLinx's wedge. Phase those first. Generic Moises parity (BPM/key/sections/chords/lyrics) lands behind them, where existing GrooveLinx surfaces (Pocket Meter, song_metadata, song_structure) absorb it cleanly.

**Fastest path to "wow" for Deadcetera:** Phase 0+1 produce a feature Moises cannot match at any tier — lead vocal isolated + notated, backing isolated as audio, "minus-one" practice mixes, all inside the rehearsal app the band already uses. **Realistic effort for production-quality Phase 1: 5–10 days** (was previously estimated at 2.5 days; revised upward after honest reassessment of the Harmony Lab integration work, edge cases, and band UAT).

---

## 2. Brutal Honesty Up Front (What Ships ≠ Magic)

Drew asked for the BEST shot at perfect multi-part harmony separation. Here is the truth, validated by 2026 research:

### What's achievable today (Phase 1 ships this)
- ✅ **Lead vocal** isolated from full mix (clean on well-mixed studio sources; quality varies on live and shared-mic recordings)
- ✅ **Backing vocal stack** isolated as a single combined stem (audio-only)
- ✅ **Lead vocal auto-notated** to ABC via Basic Pitch (labeled with confidence: Draft / Moderate / Strong — band edits accordingly)
- ✅ **Phrase looping** in Harmony Lab on whatever harmony sections exist
- ✅ **Side-by-side comparison** of multiple separator outputs (modular pipeline, swap freely)
- ✅ **Source-quality detection** — pre-flight analysis warns when input is mono / shared-mic / live / heavily compressed before user wastes a separation run

### What's NOT achievable reliably today (research-stage)
- 🟡 **3–4 individual harmony lines isolated separately** (Phil's high vs Brent's mid vs Bob's low). **SepACap** (ETH Zürich, NeurIPS 2025 AI4Music workshop) does exactly this — and **weights ARE public** (HuggingFace `Tino3141/sepacap`, MIT, 161MB, fits a T4 trivially). **BUT** it's trained ONLY on JaCappella (35 Japanese children's a cappella songs, 0.57 hours augmented to 145h). **Cross-genre generalization to English close-harmony rock is COMPLETELY UNTESTED** — paper never evaluates on Dagstuhl ChoirSet, ESMUC, or anything English/popular. We will test it in Phase 0 — running it on a Dead/CSN vocal stem may be one of the first cross-domain evals in existence. Treat as experimental until validated.
- ❌ **Notating overlapping close harmony** (e.g. CSN's stacked thirds). Basic Pitch collapses on voice crossings. No off-the-shelf multi-pitch tracker handles 3–4 singing voices.
- ❌ **Recovering CSN-style shared-mic harmonies.** They recorded around the same mic — voices blended in the air before tape. **No AI can recover sources that were never separately encoded.** This is physics, not tooling. State this in the UI when uploading such content.

### The honest framing (UI copy)
> "Auto-Split Harmonies" produces a **starting draft** for your band:
> an isolated lead vocal track + isolated harmony stack + notated lead melody.
> The harmony stack is audio-only — multi-part transcription is research-grade and not yet reliable.
> Usually finishes in 1–4 minutes depending on track length.
> Use this as a head-start, not a final transcription.

This framing is the difference between shipping value and shipping disappointment.

---

## 3. ROI-Ranked Roadmap

| # | Phase | Band pain | Effort (realistic) | Existing leverage | Moises has it? |
|---|---|---|---|---|---|
| **0** | **Quality bake-off** (validate pipeline on real Deadcetera songs) | Foundation | 0.5–1 day | All existing tooling | n/a |
| **1** | **Harmony Painkiller** (split + notate + Harmony Lab finished + source picker + pan knobs) | **HIGHEST — Drew's #1** | **5–10 days** | Harmony Lab MVP, Fadr pipeline, abcjs, harmonies_data | Premium (lead/back only, no notation) |
| **2** | **Dead Guitar Split** (Jerry/Bob via stereo pan) | **HIGH — band-defining** | 1.5–2 days | Stems lens, Modal pipeline | No — impossible single-pass |
| **3** | **Song Intelligence Pass** (BPM/key/sections/chords/lyrics) | MEDIUM — broad utility | 3–4 days | Pocket Meter, song_metadata, song_structure, GLStore | Yes (their selling point) |
| **4** | **Cheap Polish** (waveform, A-B loop, presets — pan knob ships in Phase 1 per Drew) | LOW — niceties | 1 day | Existing Stems lens WebAudio chain | Yes |
| **5** | **SepACap multi-voice split** (experimental, validated in Phase 0) | Frontier | 0.5–1 day to integrate IF P0 shows it works | Phase 1 modular separator slot | Cannot match |

**Total Phase 0–4: ~11–17 days.** Phase 0+1 alone (~5–11 days) ships a feature Moises cannot match.

> **ROI ordering note:** ChatGPT review suggested swapping Phase 2 (Dead Guitar) and Phase 3 (Intelligence), reasoning that Intelligence helps the entire catalog universally while pan-split is band-specific. Drew's stated priorities put Dead Guitar second because it's Deadcetera's wedge. **Current order favors Drew's framing**; revisit if data shows Intelligence is more frequently used during real rehearsals.

---

## 4. Architecture — Modular Stacked Separator

The research is unambiguous: **no single tool wins; a stack does.** The plan locks in a modular separator architecture so we can swap models freely without re-plumbing storage.

### 4.1 Separator interface (server-side, in `services/stem-separation/separator.py`)

```python
class VocalSeparator:
    name: str               # 'melband_roformer_karaoke' | 'mdx_voc_ft' | 'demucs_htdemucs_ft' | 'fadr' | 'lalal' | 'mvsep'
    hosted: bool            # True = hosted API call, False = self-hosted on Modal
    cost_per_min: float     # 0.0 for self-hosted
    output_kind: str        # 'lead+backing' | 'lead+individual' | 'instrumental_only'
    sdr_lead: float         # benchmarked SDR (higher better)
    
    def separate(self, vocals_url: str, song_id: str) -> dict:
        """Returns {'lead_url', 'backing_url', 'individual_lines': [...optional...]}"""
```

### 4.2 Default Phase 1 stack (self-hosted, $0 licensing)

```
                    ┌─────────────────────────────────────┐
                    │ Source song (URL/Drive/Best Shot)   │
                    └──────────────────┬──────────────────┘
                                       ▼
                     ┌─────────────────────────────────────┐
                     │  Demucs htdemucs_ft  (already shipped)  │
                     │  → vocals.wav + instrumental stems │
                     └──────────────────┬──────────────────┘
                                        ▼
                     ┌─────────────────────────────────────┐
                     │ MelBand-Roformer Karaoke (NEW)      │
                     │  → lead.wav + backing_stack.wav     │
                     │  Self-hosted on Modal T4            │
                     │  Free (HuggingFace checkpoint)      │
                     │  Better fit for GrooveLinx's        │
                     │  harmony workflow than Fadr's       │
                     │  black-box pipeline                 │
                     └──────────────────┬──────────────────┘
                                        ▼
                     ┌─────────────────────────────────────┐
                     │ Optional cascade:                   │
                     │ MDX-Net Voc_FT on the residual      │
                     │  → cleaner backing if needed        │
                     │  Self-hosted on Modal               │
                     └──────────────────┬──────────────────┘
                                        ▼
                     ┌─────────────────────────────────────┐
                     │ Basic Pitch on LEAD ONLY            │
                     │  → MIDI → ABC notation              │
                     │  (existing pipeline, app.js:4859)   │
                     │  Backing stack: audio-only          │
                     └──────────────────┬──────────────────┘
                                        ▼
                     ┌─────────────────────────────────────┐
                     │ Save to existing harmonies_data     │
                     │ schema with source: 'melband_v1'    │
                     └─────────────────────────────────────┘
```

### 4.3 Fallback/comparison stack (hosted, optional, opt-in)

When the self-hosted result is unsatisfying on a particular song, the modular interface lets the user re-run through:
- **MVSEP** (hosted, ~$0.04/min, ensemble of community models including the duet checkpoint topping their leaderboard at 11.08 SDR lead)
- **LALAL.AI Lead/Back Splitter** (hosted, ~$0.06/min on Master pack)
- **Klangio Sing2Notes** (hosted, paid, vocal-targeted notation — **fallback for backing-blob notation when Phase 5 needs it**)

These are **opt-in per-song, billed to the band**, not the production default. Architecture supports both.

### 4.4 One data source, two views (Stems lens + Harmony Lab)

A core UX principle: **the lead/backing/multi-line vocal stems are first-class stems alongside drums/bass/guitar/keys.** They live in the Stems lens mixer just like any other stem — full mute/solo/volume/pan controls. Harmony Lab is a *specialized view* of the same data with notation, singer assignments, and recording mode added.

This means:
- **Stems lens (band-mix view)**: 8+ stem channels — drums, bass, guitar (or guitar_left/right when Phase 2 splits), keys, lead vocal, backing vocal (or SATB lines if SepACap works), other. Mute/solo/volume/pan per stem. Pitch shift, tempo, A-B loop. Use case: **"minus-one" practice mixes** — mute your own part(s), play/sing along with everything else
- **Harmony Lab (specialized vocal view)**: same lead/backing audio, plus ABC notation per part, click-note-to-seek, singer assignments, recording mode. Use case: **learning a part, recording takes, coordinating who sings what**

Practical band rehearsal scenarios this enables:
- "Practice my rhythm guitar AND sing my backing harmony" → mute `guitar_left` + `vocals.backing_mine`, leave everything else playing
- "Drew can't make rehearsal" → mute `guitar_left` + `vocals.lead`, the stems substitute for him
- "Learn Brent's harmony part for the bridge" → Harmony Lab Learn mode, solo backing stem, see the notation, loop the bridge
- "Test my live take vs the recording" → record live mic in Stems lens, A/B with original backing stem
- "Pre-gig run-through" → mute every part you personally play, sing/play your part along live

**No new top-level UI is built.** Stems lens grows two channels (or more if SepACap works). Harmony Lab is unchanged structurally — its mixer just gets fed the same audio Stems lens shows.

### 4.5 Storage — every part tagged with separator source

Existing `harmonies_data.sections[].parts[]` schema gets one new field:

```js
parts: [
  {
    singer: 'lead',
    part: 'lead',
    notes: leadAbc,
    audio_url: 'r2://.../lead.wav',
    source: 'melband_roformer_karaoke_v1',  // NEW — lets us re-run later with better tools
    separated_at: iso8601,
    notation_confidence: 'moderate',         // NEW — 'draft' | 'moderate' | 'strong' | 'audio-only' | 'manual'
    confidence_score: 0.71,                  // NEW — 0.0–1.0, computed from Basic Pitch frame accuracy + voice clarity
    confidence_reason: 'Some notes uncertain (vibrato/scoops detected)'  // NEW — short user-facing explanation
  },
  {
    singer: 'backing',
    part: 'harmony',
    notes: null,                              // explicitly no notation
    audio_url: 'r2://.../backing.wav',
    source: 'melband_roformer_karaoke_v1',
    separated_at: iso8601,
    notation_confidence: 'audio-only',
    confidence_reason: 'Multi-voice harmony — transcription not yet reliable'
  }
]
```

When SepACap weights drop or a better tool arrives, we **re-run with new source flag** and the user picks which version to display. **No data loss, no migration.**

### 4.6 Per-action audio source picker (Option A — Drew's choice)

**Problem solved:** Bands love their North Star (live recording, defines how they play it) but live mixes have mic bleed that hurts harmony separation quality. Studio versions often separate cleaner. Without a second North Star, how do we route the right source to the right job?

**Solution:** Per-action picker at the moment of choice. The "Auto-Split Harmonies" button shows a quick picker:

```
┌─────────────────────────────────────────────────────┐
│ Pick source for harmony split                       │
├─────────────────────────────────────────────────────┤
│ ◉ North Star — Cornell 5/8/77 (live)                │
│   ⚠️ Live recording — vocal mic may pick up drums    │
│ ○ Studio version — Workingman's Dead (1970)         │
│   ✅ Recommended for harmony separation             │
│ ○ Best Shot #2 — Veneta 8/27/72                     │
│ ○ Paste URL                                         │
│                              [ Cancel ]  [ Split ]  │
└─────────────────────────────────────────────────────┘
```

- Defaults to North Star
- Source-quality detection (§4.7) flags live/shared-mic sources with ⚠️ and recommends cleaner alternatives
- Selected source label saved alongside split: `stems.split_source_label = "Workingman's Dead studio"`
- Re-split uses same source unless user picks differently
- All band members see what was used in the Stems lens UI

**Caveat (UI note):** When studio harmonies imported but band plays the live arrangement, harmony assignments may differ between versions. Harmony Lab already supports per-section singer reassignment — surface a small note: "Studio split imported. Live arrangement may assign parts differently — check singer assignments per section."

### 4.7 Source-quality detection (pre-flight warnings)

Before any separation pipeline runs, analyze the source for known-failure characteristics. Cheap (~5 seconds), runs client-side or on Modal:

| Check | Threshold | Warning |
|---|---|---|
| Mono / near-mono mix | `corr(L,R) > 0.9` | "⚠️ Track is mono — pan-based guitar split won't work, harmony separation may be muddy" |
| Heavy compression | dynamic range < 4 LU | "⚠️ Heavy compression detected — separation may have artifacts" |
| Live recording with shared mics | bandpass-correlated noise floor + audience presence | "⚠️ Live recording — vocal mics likely picked up drums/guitar, expect bleed" |
| Very low vocal energy | vocal-band RMS < threshold | "⚠️ Vocals are buried in the mix — separation will struggle" |
| Sample rate < 44.1kHz | metadata check | "⚠️ Low-quality source — upgrade for better results" |

Each warning links to "Why this matters" tooltip. None of them BLOCK the user — they inform.

### 4.8 Shared mixer state (Stems lens ↔ Harmony Lab)

If both views show the same audio with the same controls, mute/solo/volume/pan state must persist across views. Otherwise: user mutes guitar in Harmony Lab, switches to Stems lens, guitar is unmuted, confusion.

**Implementation:** New GLStore section for ephemeral mixer state, scoped per-song:
```js
GLStore.mixerState = {
  [songTitle]: {
    [stemId]: { volume: 0–1, mute: bool, solo: bool, pan: -1–1 }
  }
}
```
- In-memory only (not persisted to Firebase — too noisy)
- Both Stems lens and Harmony Lab subscribe and re-render on change
- Reset button per-song clears state
- "Save mix" button optionally persists a named mix (e.g. "Drew's harmony practice mix" — `stems.saved_mixes[]`) for power users

### 4.9 Storage retention & version strategy

When SepACap drops or we re-run with a better separator, what happens to the old split?

**Default policy:**
- R2 keeps **only the latest 2 versions** of any stem set per song (older versions garbage-collected after 30 days)
- `harmonies_data.sections[].parts[].source` records which version produced each part
- Old `harmonies_data` entries with `source: 'fadr'` or `'melband_v1'` retained even after newer splits — user picks which to display per song
- Schema includes `version: int` for the separator algorithm version
- "Re-split with newer model" UI: shows comparison ("Old: melband_v1, 2026-04-29 / New: sepacap_v1, 2026-08-15") and lets band vote which to keep

**Edge case:** if user has manually edited the auto-draft notation, **never overwrite** on re-split. Manual edits are sacred.

---

## 5. What's Already Built (Reused — Do Not Duplicate)

| System | Location | How Plan reuses it |
|---|---|---|
| **Harmony Lab MVP** | `js/features/harmony-lab.js` (1281 lines) | Phase 1 finishes its 3 stubbed pieces (notation/mixer/loop). Plan does not build a new harmony UI. |
| **Fadr import** | `app.js:4947–5122` | Stays as alternate path with `source: 'fadr'`. User picks. Phase 1 default is the new self-hosted stack. |
| **Basic Pitch** | `app.js:4859–4938` | Phase 1 reuses the same pipeline for lead-vocal notation. |
| **harmonies_data schema** | `app.js:3796–3852` | Phase 1 writes here with new `source` and `notation_quality` fields. |
| **Pocket Meter** | `pocket-meter.js` | Phase 3 writes BPM to the same `song_metadata.bpm` field. |
| **song_metadata** | `app.js:1122–1288` | Phase 3 extends with `timeSignature`, `duration`. |
| **song_structure** | `app.js:6843–6856` | Phase 3 adds `auto_sections` sub-field. |
| **GLStore** | `js/core/groovelinx_store.js` | Phase 3 BPM/key writes route through `GLStore.updateSongField()`. |
| **Stems lens** | `js/features/song-detail.js:1685–2300` | Phase 2 adds 2 stems (left/right guitar). Phase 3 adds sidebar/grid. Phase 4 adds polish. |
| **The Chart** | `app.js:1836–1858` | Phase 3 chord grid is new subview beside the manual chart. |
| **Metronome** | `app.js:7590–9550` | Phase 3 wires it to consume per-song BPM. |
| **abcjs** | already loaded | Phase 1 wires it into Harmony Lab notation panel. |
| **Tone.js (PitchShift)** | wired in Stems lens | Phase 1 reuses for Harmony Lab transpose. |
| **Worker `/stems/separate`** | `worker.js:84` | Phase 2 extends with `pan_split` flag. |
| **Worker `/midi2abc`** | `worker.js` | Phase 1 reuses for notation conversion. |
| **Modal `separator.py`** | `services/stem-separation/separator.py` | Phase 1 adds `split_vocals()` function. Phase 2 extends `separate_stems()` with `pan_split`. Phase 3 adds `analyze_song()`. |

**Zero new top-level Firebase keys for Phase 0–2.** Phase 3 adds three (`auto_sections`, `detected_chords`, `lyrics_synced`).

---

## 6. Phase 0 — Quality Bake-Off (~0.5 day)

Before committing the production pipeline, prove it works on Deadcetera's real catalog. ChatGPT's advice was right: don't trust marketing claims; trust ears.

### 6.1 Test corpus (5 songs, varied difficulty)
Drew picks 5 from Active songs covering the difficulty spectrum:
1. **Easy** — clean studio recording, well-panned (e.g. Touch of Grey studio)
2. **Medium** — 1980s+ Dead live with separated vocal mic feeds (e.g. recent Dave's Picks)
3. **Hard** — 1970s SBD with shared mics (Cornell 5/8/77 vocal sections)
4. **Very Hard** — CSN-style close-harmony Dead moment (e.g. Attics of My Life vocal-trio sections)
5. **Wildcard** — a non-Dead cover the band actually plays

### 6.2 Run each through 5 pipelines
| Pipeline | Output kind | Why |
|---|---|---|
| **Fadr** (existing) | lead + N harmony | Baseline; what we have today |
| **MelBand-Roformer Karaoke** (self-hosted, new) | lead + backing-stack | Proposed Phase 1 default |
| **MelBand-Roformer Karaoke + MDX-Net Voc_FT cascade** | lead + cleaner backing | Proposed Phase 1 with optional cleanup |
| **LALAL.AI Master pack** ($50, 750min) | lead + backing | Hosted control / sanity check |
| **SepACap** (self-hosted, experimental) | S / A / T / B / Lead / V-Perc | **Cross-domain test — first known eval on English rock content.** Run AFTER MelBand-Roformer (chains on the vocals-only output). If it works on close-harmony Dead/CSN, generational advantage. If it doesn't, lose 30 min and we have authoritative answer. |

Total cost: ~$50 (LALAL trial) + Modal compute ~$3.

**Note on SepACap chaining:** SepACap expects pure-vocal input (it's an a cappella separator, not a vocals-vs-band stemmer). Run on the **Demucs vocals stem**, not the full mix. The Phase 1 pipeline naturally produces a clean vocals stem — SepACap slots in *after* that.

### 6.3 Score each output (Drew + 1–2 band members listen blind)
| Criterion | Scale |
|---|---|
| Lead vocal isolation quality | 1 (artifact-heavy) → 5 (clean) |
| Backing-stack quality | 1–5 |
| Notation usefulness on lead | 1 (unusable) → 5 (sing-along ready) |
| Bleed (instruments leaking into vocal) | 1 (heavy) → 5 (none) |
| **(SepACap only)** Individual line separation quality | 1 (mush) → 5 (cleanly distinct voices) |

Output: a 5-row × 5-pipeline matrix. **Pick the production default based on actual band ears, not paper specs.**

If SepACap works on even one of the test songs, plan for an experimental "🧪 Try SepACap (Multi-Voice Split)" button in Phase 1 that lets the user opt in per song.

### 6.4 Phase 0 exit criteria
- [ ] Bake-off matrix populated for all 5 songs × 5 pipelines
- [ ] Decision: which pipeline becomes Phase 1 default
- [ ] Decision: do we keep LALAL.AI Master as opt-in fallback ($50 buys 750 min, covers ~150 songs)
- [ ] **Decision on SepACap:** does it generalize to English rock content? If yes, becomes opt-in "experimental multi-voice split" feature in Phase 1. If no, archive and revisit when fine-tuned variants appear
- [ ] Plan §7 (Phase 1) updated with chosen pipeline
- [ ] **Bonus:** if SepACap shows surprising results, write up findings — first published cross-genre eval would be reputation-building for GrooveLinx

---

## 7. Phase 1 — Harmony Painkiller (~5–10 days, ROI #1)

**Goal:** A Deadcetera band member opens any song's Harmony Lab → after a 1–4 minute split (depending on track length), sees lead vocal isolated + notated with confidence label, backing-stack isolated as audio, ready to loop a phrase and practice alone with backing track. Source picker (§4.6) lets band override the default North Star with a cleaner studio source when needed.

**Why 5–10 days, not 2.5:** earlier estimate underweighted Harmony Lab integration depth (3 stubs each take a real day), source-quality pre-flight, source picker UI, mixer state plumbing, confidence label rendering, and end-of-phase band UAT. ChatGPT review caught this; estimate now realistic.

### 7.1 Modal `split_vocals(vocals_url, song_id)` (~6 hours)

- Loads MelBand-Roformer Karaoke checkpoint from HuggingFace ([jarredou/aufr33-viperx-karaoke-melroformer-model](https://huggingface.co/jarredou/aufr33-viperx-karaoke-melroformer-model))
- **Chunked inference** — full model wants 40GB VRAM, T4 has 16GB; chunk size tuned for fit
- Inputs: `vocals_url` (the Demucs vocals stem we already produce), `song_id`
- Outputs: `{lead_url, backing_url}` saved to R2 alongside existing stems
- Stored at `bands/{slug}/songs/{title}/stems.lead_vocals` and `.backing_vocals` (extends existing stems blob, no new top-level Firebase key)
- Idempotent (cache by song_id + separator_version)
- Returns separator metadata: `{source, separated_at, sdr_estimate, model_version}`

**Optional cascade flag** (Phase 1.5 if Phase 0 shows it helps): `split_vocals(..., cascade='mdx_voc_ft')` runs MDX-Net Voc_FT on the residual.

### 7.2 Worker `/vocals/split` (~1 hour)

- New endpoint mirroring `/stems/separate` pattern
- Forwards to Modal, persists to Firebase via existing helpers
- Auth via existing shared-secret pattern

### 7.3 Client API (~1 hour)

`js/core/gl-stems.js` adds:
- `splitVocals(title, opts)` — kicks off split, persists result
- `getVocalSplit(title)` — read cached split if exists
- `hasVocalSplit(title)` — check existence

Routes through existing `loadBandDataFromDrive` / `saveBandDataToDrive` patterns.

### 7.4 Auto-notate lead, mark backing as audio-only (~2 hours)

After `split_vocals` completes:
- Run **Basic Pitch on lead.wav only** → MIDI → ABC (reuse `/api/basic-pitch` path at `app.js:4859`)
- Save into existing `harmonies_data.sections[].parts[]` schema with:
  ```js
  { singer: 'lead', part: 'lead', notes: leadAbc, audio_url: '...', source: 'melband_v1', notation_quality: 'auto-draft' }
  { singer: 'backing', part: 'harmony', notes: null, audio_url: '...', source: 'melband_v1', notation_quality: 'audio-only' }
  ```
- **Don't overwrite existing Fadr-imported harmonies** — if `harmonies_data.sections[0].parts[].source === 'fadr'`, prompt user before replacing

### 7.5 Wire the Harmony Lab stubs (~1 day — the core lift)

`js/features/harmony-lab.js` MVP has 3 stubbed pieces blocking real use:

#### 7.5.1 abcjs notation render (currently placeholder div)
- Replace placeholder with `ABCJS.renderAbc(divId, abcString, opts)` call per part
- Click any note → seek lead audio to that beat (uses abcjs `clickListener`)
- Backing stack: render an audio-only block ("🎤 Backing harmonies — audio reference, not yet notated")

#### 7.5.2 WebAudio mixer (currently visual only)
- Build the audio graph: per-part audio → GainNode → master → destination (copy pattern from Stems lens `_sdInitStemsPlayer`)
- Mute/solo wires to gain nodes
- Tempo slowdown via existing Tone.js path (proven in Stems lens)
- Transpose via existing Tone.PitchShift
- "My Mic" channel via `getUserMedia` → MediaStreamSource → Gain (live monitor only, recording is Mode 3)

#### 7.5.3 Phrase loop on sections
- Harmony Lab already loads sections from `harmonies_data.sections[]`
- Add per-section `loopStart` / `loopEnd` fields, set via "Mark loop here" buttons
- When loop enabled and section active, audio playback wraps `[loopStart, loopEnd]`
- Phase 3 will auto-populate from auto-detected sections; Phase 1 ships with manual

### 7.6 "Auto-Split Harmonies" button + source picker (~4 hours)

- Visible when `harmonies_data` is empty or `source !== 'melband_v1'`
- **Source picker (§4.6) shows first** — defaults to North Star, lists Best Shots, paste-URL option
- Source-quality detection (§4.7) runs on chosen source, displays warnings inline
- Calls `GLStems.splitVocals(songTitle, sourceOpts)` → progress UI
- Honest copy:
  > **Auto-Split Harmonies (1–4 min depending on track length)**
  > Isolates lead vocal + harmony stack and writes a starting draft for the lead melody with a confidence label.
  > The harmony stack will be audio-only — multi-part transcription isn't reliable yet.
  > Best on well-mixed studio tracks. Live recordings with shared mics will produce a blended harmony stack.

### 7.7 Pan knob in Stems lens / Harmony Lab mixer (~30 min, moved from Phase 4 per Drew)

- Stereo pan slider per stem channel via StereoPannerNode in existing WebAudio chain
- Persists to GLStore.mixerState (§4.8) so Stems lens and Harmony Lab stay synced
- Particularly useful in Harmony Lab — pan lead and backing to opposite ears for ear-training

### 7.8 Phase 1 exit criteria

**Functional:**
- [ ] Source picker (§4.6) appears at "Auto-Split Harmonies" button click
- [ ] Source-quality detection (§4.7) runs and surfaces warnings on selected source before split
- [ ] On a representative song, click "Auto-Split Harmonies" → 1–4 min later: lead.wav + backing.wav exist + lead notation rendered in Harmony Lab with confidence label (Draft/Moderate/Strong)
- [ ] Practice mode mixer actually mutes/solos parts (real audio, not visual-only)
- [ ] Pan knobs work in both Stems lens and Harmony Lab, state shared via GLStore (§4.8)
- [ ] Tempo slowdown + transpose work in Practice mode
- [ ] User can drag to mark a phrase loop region, hit play, the phrase repeats
- [ ] Harmony Lab Learn mode shows ABC notation for lead (real abcjs render, not placeholder)
- [ ] Backing stack plays as audio-only with appropriate UI label
- [ ] Existing Fadr harmonies preserved with `source: 'fadr'` flag, user prompted before overwrite
- [ ] Build bumped, deployed dev + prod

**Product success metric (the one that matters):**
- [ ] **Drew + at least one other Deadcetera band member uses Phase 1 to learn a harmony part for a song they didn't already know.** Measure: did they learn it faster than they would have via YouTube + manual transcription? **Not SDR. Not technical benchmarks. Real human "I learned my part faster" feedback.**

### 7.9 Why this is the wow (rest of the math)

A Dead band's #1 hassle: "what notes does the lead sing on this verse" + "how do my backing parts fit." Today that's an hour per song of YouTube comparison + manual transcription. **Phase 1 makes it 1–4 minutes + ABC notation with a confidence label.** Moises Premium does the lead/backing split but doesn't notate. We do both, in the rehearsal app, with honest UI about limits, and the band can pick whichever source separates cleanest while keeping the live North Star sacred for performance feel.

---

## 8. Phase 2 — Dead-Specific Guitar Split (~1 day, ROI #2)

**Goal:** Drew (rhythm guitar) and Brian (lead guitar) cleanly isolate their own parts from any well-panned Dead live recording.

### 8.1 Mid-side decomposition in Modal (~3 hours)
- Extend existing `separate_stems()` with `pan_split=true` flag
- Pre-process: `M = (L+R)/2`, `S = (L−R)/2`
- Build emphasis tracks: `L_emphasis = L + 0.3·M`, `R_emphasis = R + 0.3·M`
- Run Demucs on each (2× GPU time, still under 3 minutes total on T4)
- Cross-cancel guitar tracks to isolate `guitar_left` / `guitar_right`

### 8.2 Confidence gate (~1 hour)
- Compute `corr(L, R)` in 80–8000 Hz band on source
- If `corr > 0.85` → mix is mono-ish, fall back to single guitar stem
- Log confidence in `stems.pan_split_confidence`

### 8.3 Stems lens UI (~3 hours)
- When `stems.guitar_left` / `.guitar_right` present, swap single Guitar slot for two: **Rhythm (L)** and **Lead (R)**
- Toggle: "Lead/Rhythm split" — defaults on for Dead-tagged songs
- Confidence indicator below stems

### 8.4 Phase 2 exit criteria
- [ ] On Cornell 5/8/77, pan-split produces audibly distinct Bob/Jerry stems
- [ ] On a studio recording, gate falls back to single guitar with warning
- [ ] Stems lens shows 7 stems when split successful

---

## 9. Phase 3 — Song Intelligence Pass (~2.5 days, ROI #3)

**Goal:** Auto-populate the data Phase 1+2 use manually, plus add Moises-equivalent surfaces.

### 9.1 Modal `analyze_song()` (~1 day)
- New `@app.function` in `services/stem-separation/separator.py`
- Pipeline: librosa (BPM/key/timeSig/duration) → allin1 (sections) → autochord (chords) → Whisper-medium on cached vocals (lyrics with word timestamps)
- Output: single JSON blob, cached in R2
- Idempotent

### 9.2 Worker `/stems/analyze` + Client API (~2 hours)
- Mirrors `/stems/separate` pattern
- Persists to Firebase:
  - `song_metadata.bpm/key/timeSignature/duration` ← **same fields Pocket Meter writes to**
  - `song_structure.auto_sections` ← new sub-field beside manual `whoStarts`/`howStarts`
  - `detected_chords` ← new top-level key
  - `lyrics_synced` ← new top-level key
- BPM/key writes route through `GLStore.updateSongField()`

### 9.3 Sections sidebar in Stems lens (~3 hours)
- Vertical list of `auto_sections[]`, click to seek + auto-loop
- Surface in Rehearsal Mode as horizontal section ribbon

### 9.4 Chord grid view in The Chart (~3 hours)
- Renders `detected_chords[]` per-bar grid
- Easy/Medium/Hard toggle (research showed this is what users default to)
- "Use as my Chart" → copies to manual chart

### 9.5 Synced lyrics+chords karaoke view (~3 hours)
- Two-line layout: chord above word, lyric below
- Auto-scroll keeps current line centered

### 9.6 Metronome auto-BPM (~30 min)
- Prefill BPM from `song_metadata.bpm` when opened from song context

### 9.7 Phase 3 exit criteria
- [ ] `GLStems.analyze(title)` populates all 4 storage paths in <2min
- [ ] Sections sidebar renders + jumps + auto-loops
- [ ] Chord grid + Easy toggle work
- [ ] Karaoke view renders
- [ ] Metronome auto-fills BPM
- [ ] Harmony Lab phrase loops use `auto_sections` when no manual loop set

---

## 10. Phase 4 — Cheap Polish (~1 day, ROI #4)

- **Stereo pan per stem** — StereoPannerNode in audio chain (~10 lines)
- **Waveform per stem** — WaveSurfer.js, one canvas per stem (~3 hours)
- **A-B loop region UI** — drag handles on progress bar (~2 hours)
- **Speed presets** — 0.5x / 1x / 2x buttons (~30 min)

---

## 11. Phase 5 — Multi-Voice Frontier

### 11.1 SepACap (weights public, untested on rock)
- ETH Zürich, NeurIPS 2025 AI4Music workshop. Authors: Lanzendörfer, Pinkl, Grötschla, Wattenhofer
- Code: [github.com/ETH-DISCO/SepACap](https://github.com/ETH-DISCO/SepACap)
- Weights: [huggingface.co/Tino3141/sepacap](https://huggingface.co/Tino3141/sepacap) (161MB, MIT)
- Paper: [arXiv 2509.26580](https://arxiv.org/abs/2509.26580), [OpenReview oERJ6K8FIn](https://openreview.net/forum?id=oERJ6K8FIn)
- **Trained ONLY on JaCappella** (Japanese a cappella children's songs, 35 tracks, 0.57h augmented to 145h)
- **Cross-genre generalization completely untested** — paper never evaluates on English / popular / live recordings
- **Architectural constraint:** It's a pure-vocal multi-singer separator. Chain order: full mix → Demucs (existing) → vocals stem → MelBand-Roformer Karaoke (Phase 1) → backing-stack → **SepACap on backing-stack** to attempt SATB/Lead split
- **Phase 0 evaluates this empirically.** If the bake-off shows SepACap produces meaningful individual voice splits on a Dead/CSN test song, becomes a Phase 1 opt-in feature. If not, archive
- **Add as `VocalSeparator` plugin** with `source: 'sepacap_v1'` per the modular architecture in §4. When fine-tuned variants on English/rock corpora appear, swap is trivial
- **No replyCount on OpenReview** — the workshop track doesn't open peer reviews publicly, so any "positive reviews" online are blog posts, not peer assessments. Treat with appropriate skepticism

### 11.2 Other frontier candidates
- **Ensemble of MelBand-Roformer Karaoke variants** — there are 5+ community-trained checkpoints with different bias profiles. Could ensemble for higher quality
- **MDX-Net BS-Roformer** — newer architecture, trained heads available on HuggingFace
- **Klangio Sing2Notes** — closed paid API, vocal-targeted notation. Could be the polyphonic-notation-on-backing-stem fallback when SepACap or successor produces multiple lines
- **MERT / Music2Latent** — embedding-space approaches that may eventually enable better source separation
- **Build our own** — if Phase 0 shows none of the off-the-shelf options work on Dead live tracks, we have JaCappella-style training infrastructure to fine-tune SepACap on a Dead / CSN multitrack corpus (if anyone has multitracks). Multi-month research project; only worth doing if Drew sees it as a competitive moat

**Don't promise multi-voice split in product copy until Phase 0 validates.** Ship as "🧪 Experimental: Try SepACap multi-voice split" with appropriate "your mileage may vary" framing.

---

## 12. Cost Reality

| Pipeline | Per-song | Catalog (449 songs) | Notes |
|---|---|---|---|
| **Self-hosted Modal stack (Phase 1 default)** | $0.04 (T4 compute) | **~$18** | $0 model licensing |
| LALAL.AI Master pack 750min (opt-in fallback) | $0.07 | ~$50 (covers ~150) | Hosted, decent quality |
| MVSEP Premium (opt-in fallback) | ~$0.04 | ~$60–100 | Hosted, ensemble of models |
| Fadr (existing alt path) | (current sub) | unchanged | Already paying |
| AudioShake Indie | quota-gated | untenable at catalog scale | Skip |

**Recommendation:** Default to self-hosted ($18 total). Hold $50 LALAL Master in reserve for opt-in per-song use cases where Phase 0 bake-off shows the self-hosted output isn't good enough.

---

## 13. Out of Scope (Will Not Build)

| Feature | Reason |
|---|---|
| 16 specialized stems (kick-only, electric vs acoustic) | Research showed real users stick to 4–6 stems |
| Generative AI Studio (auto-create matching drum/bass) | Bands don't generate fake parts |
| Live-on-stage smart metronome | Almost no users do this |
| Full 3–4 individual harmony line transcription | Research-grade only; defer to Phase 5 SepACap watch |
| Lyric Writer / Voice Studio / Mastering | Not band rehearsal needs |

---

## 14. Risks & Open Questions

### Risks
- **MelBand-Roformer chunked inference on 16GB T4** — full-resolution wants 40GB. Chunked inference loses some quality at chunk boundaries. **Mitigation:** Phase 0 bake-off measures impact; if degraded, switch to MVSEP hosted as default
- **Vocal split quality on 1970s SBD recordings** — shared-mic blending physically can't be reversed. **Mitigation:** Phase 0 includes a 1970s SBD test; UI warns when corr(L,R) is high or source is dated
- **Basic Pitch monophonic limitation** — even on isolated lead, lead vocal often has microtones/scoops. **Mitigation:** label clearly as "auto-draft," ship with manual edit capability already in `harmonies_data` schema
- **Whisper accuracy on jam vocals** (Phase 3) — Dead vocals are loose, often unintelligible. **Mitigation:** trust word timestamps for chord placement, allow user lyric editing

### Drew's resolved decisions (2026-04-29)
1. ✅ **$50 LALAL.AI Master pack budget approved** for Phase 0 bake-off
2. ⏳ **Phase 0 test corpus** — Drew to pick 5 songs spanning easy → CSN-hard before Phase 0 begins
3. ✅ **Coexist with Fadr** via `source` flag (Option A in §4.6 / 4.5)
4. ✅ **Phrase loops ship with manual markers in Phase 1**, auto-populated by Phase 3
5. ⏳ **Phase 2 pan-split default rule** — recommend: confidence-gate-only (no artist tag dependency); revisit if confidence gate underperforms
6. ✅ **Pan knob ships in Phase 1** (per Drew, helps Harmony Lab mixer)
7. ✅ **Per-action source picker** (Option A from §4.6) — implemented in Phase 1
8. ⏳ **ROI ordering (Dead Guitar before Intelligence)** — keep Drew's order; revisit if usage data shows Intelligence is more reached-for during real rehearsals

### Remaining open questions
- Phase 0 test corpus song picks (Drew, before bake-off)
- Phase 2 confidence-gate threshold tuning (during Phase 2 implementation)
- Whether to keep ROI order as-is after Phase 0+1 ships and band uses it for a few weeks

---

## 15. End-to-End Success Criteria

### The product metric (the one that matters)
- [ ] **Bandmates learn parts faster.** Measured by Drew + at least 2 Deadcetera band members reporting "I learned [song]'s harmony / lead vocal / rhythm guitar in less time than I would have via YouTube + manual transcription." Not SDR. Not technical benchmarks. Real human "this saved me time" feedback for at least 5 songs.

### Functional criteria
- [ ] Drew cancels Moises Premium with no capability loss
- [ ] Any band member opens any Active song's Harmony Lab → 1–4 minutes later sees lead notated (with confidence label) + backing audio + can loop phrases + practice alone
- [ ] **Per-action source picker** (§4.6) lets band override North Star with cleaner studio source for harmony split
- [ ] **Source-quality detection** (§4.7) warns before wasting a separation run on poor source material
- [ ] **Same vocal stems show up as first-class channels in Stems lens** — full mute/solo/volume/pan controls alongside drums/bass/guitar
- [ ] **Shared mixer state** (§4.8) keeps Stems lens and Harmony Lab in sync
- [ ] **"Minus-one" practice mixes work end-to-end** — band member mutes their own part(s), records or live-sings/plays their part along with the rest
- [ ] On a panned Dead live recording, Bob/Jerry are audibly separable in Stems lens
- [ ] On any analyzed song, BPM/key/sections/chords/lyrics auto-populated, all surfaces consume the data
- [ ] Metronome auto-tunes to per-song BPM
- [ ] **Zero parallel storage.** Existing `harmonies_data`, `song_metadata`, `song_structure`, `stems` keys absorb everything except 3 new keys (`auto_sections`, `detected_chords`, `lyrics_synced`)
- [ ] **Single audio source feeds both Stems lens and Harmony Lab** — not two parallel UIs
- [ ] **Storage retention policy** (§4.9) garbage-collects old separator outputs after 30 days, never overwrites manual edits
- [ ] Modular separator pipeline can swap models without re-plumbing — when SepACap or successor drops, swap is trivial

---

## 16. Restart Prompt (next session)

> Continue Stems Intelligence Plan v4 (`02_GrooveLinx/specs/stems_intelligence_plan.md`). Drew approved the reprioritized plan: harmony first, Dead guitar second, intelligence third, polish fourth. ChatGPT review hardened estimates (Phase 1 = 5–10 days), language ("better fit for GrooveLinx" not "beats Fadr"), durations ("1–4 min" not "90s"), confidence labels (Draft/Moderate/Strong), source-quality pre-flight, shared mixer state, storage retention. Research validated MelBand-Roformer Karaoke as Phase 1 default (self-hosted on Modal, $0 licensing). SepACap weights ARE public on HuggingFace (`Tino3141/sepacap`) but trained on Japanese a cappella only — added as 5th experimental pipeline in Phase 0 bake-off. Brutal honesty captured: 3-4 individual harmony lines NOT reliably achievable today, lead+backing-stack IS, lead notation works, backing notation doesn't.
>
> **DREW'S RESOLVED DECISIONS (§14):** $50 LALAL budget approved · Coexist with Fadr · Manual phrase loops in P1 · Pan knob in P1 (not P4) · Per-action source picker (Option A) · Keep ROI ordering as-is (revisit after P0+P1 ships). **Remaining open:** Phase 0 test corpus picks (Drew picks before P0 begins).
>
> **CORE ARCHITECTURE PRINCIPLE — read §4.4 first.** Vocal stems are **first-class stems in the Stems lens mixer**, alongside drums/bass/guitar/keys. Same audio data is also rendered in Harmony Lab with notation/recording overlays. **DO NOT BUILD TWO PARALLEL UIs.** Mixer state lives in shared `GLStore.mixerState` (§4.8) so views stay synced. Per-action source picker (§4.6) lives at the "Auto-Split Harmonies" button — defaults to North Star, lets band override with studio source for cleaner separation, while keeping live North Star sacred for performance feel. Source-quality detection (§4.7) runs before any split to warn about mono/live/shared-mic recordings.
>
> **Next step: Phase 0 quality bake-off (§6, 0.5–1 day).** Drew picks 5 representative Deadcetera songs spanning easy-to-CSN-hard. Run each through Fadr / MelBand-Roformer Karaoke / +MDX-Voc_FT cascade / LALAL.AI Master / SepACap. Score blind with band members on the 4-criterion scale (5 criteria for SepACap). Use the 5×5 matrix to pick Phase 1 production default. Don't write Phase 1 code until Phase 0 results are in.
>
> **When Phase 1 begins (after bake-off, 5–10 days):** start with `services/stem-separation/separator.py` adding `split_vocals()` function; persist outputs to `bands/{slug}/songs/{title}/stems.lead_vocals` and `.backing_vocals` (extends existing stems blob, no new top-level Firebase key). Then wire the same audio URLs into BOTH the Stems lens render path (`js/features/song-detail.js` Stems lens) and the Harmony Lab Practice mixer (`js/features/harmony-lab.js`). Same audio, two mixer surfaces, shared state via `GLStore.mixerState`. Pan knob ships in this phase (StereoPannerNode in audio chain). Phase 1 success metric is **"bandmates learn parts faster than YouTube + manual transcription," not SDR.**
