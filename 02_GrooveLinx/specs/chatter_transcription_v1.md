# Chatter Transcription — v1 Spec

**Date:** 2026-05-29
**Author:** Claude (per Drew's direction following Pierce-synthesis 2026-05-29)
**Status:** SPEC — not yet greenlit for build
**Related:** [`song_clip_architecture_evaluation_2026-05-29.md`](song_clip_architecture_evaluation_2026-05-29.md), [`project_pierce_synthesis_2026-05-29` memory](../../../../.claude/projects/-Users-drewmerrill-Documents-GitHub-deadcetera/memory/project_pierce_synthesis_2026-05-29.md)

---

## The product question

Drew's framing 2026-05-29:

> Wondering if there's something we can do to capture comments as they are given in rehearsal — maybe it's GrooveMate (key word that is used to notify the app to dictate). "Please note Pierce needs to learn the chords better for Sugaree." That way we are capturing some of the insights real-time and it is less important to preserve or review all the in-between talking in songs.

The underlying intent: **valuable insights spoken in rehearsal currently get lost.** Someone says "we need to fix the Sugaree harmony entry" mid-rehearsal, intends to write it down later, never does. The chatter is preserved on the recording but nobody re-listens to find it.

Two product shapes solve this:

- **Path A — post-rehearsal Whisper pass on chatter segments**: After ingest, transcribe every speech-classified segment, surface as draft comments for the user to accept/reject/edit.
- **Path B — live "GrooveMate, note that..." wake-word listening**: App listens continuously during rehearsal for a wake word, captures the following utterance, drops in as a comment in real time.

Path A is what this spec covers. Path B is filed at the bottom as a deliberate "not now."

---

## Why Path A and not Path B

| | Path A | Path B |
|---|---|---|
| Privacy posture | Transcribes recorded chatter that's already in the source FLAC. No new listening capability beyond what's already captured. | Always-on microphone during rehearsal. New listening surface that needs explicit consent and battery posture. |
| Wake-word reliability | N/A | Hard. False positives during normal chatter → noise comments. False negatives → missed captures. |
| Real-time confirmation | None — captures appear post-rehearsal | Immediate confirmation in the moment |
| Setup cost on band | Zero. Band just talks normally. | Phone/iPad must be open + focused + listening throughout rehearsal. |
| Wireless / battery cost | Zero (post-ingest server-side work) | Material drain — continuous mic capture + on-device STT |
| Implementation risk | Low — extends existing ingest pipeline | High — new client-side audio capture + ambient listening UX |
| Alignment with Pierce-synthesis | Clean. Helps band improve without making music feel like homework. Captures spoken signal without changing rehearsal behavior. | Pulls toward "broad AI companion behavior" that Pierce explicitly flagged on the don't-do list. |

**Path A is the right v1.** If after weeks of Path A in real use Drew specifically wants the in-the-moment confirmation that only live capture provides, Path B becomes a considered v2 grounded in actual experience.

---

## The Path A flow end-to-end

1. **Rehearsal happens normally.** Band records via X-Live. No behavior change for anyone.
2. **Ingest pipeline runs** (existing — no change).
3. **Segmentation classifies segments** (existing) — some get `kind: 'music'`, others `kind: 'speech'` or `kind: 'silence'`. The analyzer already does this.
4. **NEW: Whisper transcription job fires** on every segment classified as `speech` (or in v1.1, `speech` + `chatter` if we add that subclass). Audio for each segment is sliced from one or two vocal-stem FLACs (where speech is loudest), submitted to Whisper, transcript returned.
5. **Transcripts persist as draft comments** at `bands/{slug}/rehearsal_sessions/{sid}/captured_insights/{id}` with `status: 'draft'`. NOT yet visible as canonical comments.
6. **User reviews captured insights** in a new panel within Review Mode (or its own dedicated surface — TBD UX). Each draft shows: source segment timestamp, transcribed text, a ▶ play-segment button to verify the audio, and accept/reject/edit affordances.
7. **On accept:** the draft is promoted to a real comment in the normal `comments` collection, anchored to its segment + offset. Status flips to `accepted`. Original draft record stays for audit.
8. **On reject:** status flips to `rejected`. Draft is hidden from default view but recoverable from a "rejected" filter. Original audio stays intact and re-transcribable later if needed.
9. **On edit:** user fixes STT errors (e.g., "Pierce" was transcribed as "Pearce") before accepting. Edits are tracked for STT quality feedback.

The chatter audio itself stays in the source FLACs forever. The transcript becomes the searchable, scannable intelligence layer on top. Drew's framing — "less important to preserve or review all the in-between talking" — is honored: the talking is still preserved (FLAC source of truth), but reviewing it is no longer the bottleneck because the insights have already been extracted.

---

## Whisper integration

### Model choice

Whisper-large (most accurate, slowest, most expensive) is the right v1. Rehearsal chatter is hard input:

- Background music bleed (people talking while someone noodles on guitar)
- Echo/reverb in rehearsal spaces
- Multiple overlapping speakers
- Casual quiet speech rather than declarative announcements
- Dropped words, unfinished sentences

Whisper-medium or smaller would produce more errors that defeat the purpose. Optimize for accuracy first; if cost becomes a concern at scale, downshift later. The accept/reject UI absorbs error gracefully so accuracy directly determines workflow speed.

### Audio input selection

For each speech segment, transcribe from the **vocal stems specifically** (channels 01-04 in the Deadcetera map — drew/brian/chris/pierce vocals). Three reasons:

1. **Lower background noise** — vocal mics are directional and picked up close to the speaker
2. **Higher speech intelligibility** — mics tuned for vocal frequency response
3. **Speaker attribution potential** — if only channel 03 (Chris's vocal) has audible speech in the segment, we can tag the transcript with `speakerCandidate: 'chris'` for free

Implementation: ffmpeg slice each of the four vocal-stem FLACs to the segment's time range, mixdown to a single mono input for Whisper. Bitrate doesn't matter for transcription accuracy beyond ~64 kbps so use whatever ffmpeg flag minimizes processing.

### Modal endpoint shape

New endpoint `groovelinx-chatter-transcription` (separate Modal app so it can scale independently of the demux/clip endpoints).

```
POST /transcribe-segment
Body: {
  bandSlug, sessionId, segmentId, startSec, endSec, token
}
Returns: {
  success, transcript, language, speakerCandidate?,
  segmentDurationSec, billedSec, modelVersion
}
```

Image: `debian_slim + ffmpeg + openai-whisper + boto3 + fastapi`. Whisper-large model loaded into Modal volume to avoid cold-start download cost.

**Cost estimate at scale:** Whisper-large on Modal A10G costs ~$0.03 per minute of audio. Average rehearsal has ~60 min of chatter across all speech segments (analyzer-classified, not raw 3-hour audio). Per-rehearsal STT cost ~$1.80. At one rehearsal per week per band, ~$90/year per band. Negligible at GrooveLinx scale; meaningful only if user count grows large enough that we need a cost-control valve.

### Triggering

Two options:

**Option A — trigger automatically on segmentation-complete**

Most ergonomic. After analyze finishes, transcription kicks off in background. Drew opens Captured Insights panel later, finds drafts ready.

Cost: STT fires for every analyzed rehearsal regardless of whether the user actually wants it. At $1.80 per rehearsal this is fine; at $20 it would not be.

**Option B — trigger on explicit user request ("Transcribe chatter")**

Lower default cost. User decides when to spend the STT budget. But adds a chandelier-y button — Drew has to remember to click "transcribe" after every rehearsal, which is exactly the kind of homework Pierce-synthesis warns against.

**Recommendation: Option A** (auto-trigger). Frame as part of the ingest pipeline — when a rehearsal is processed, both the segment intelligence AND the chatter intelligence get extracted. Drew comes back to a complete picture. If the cost ever becomes a concern, add a band-level setting "Skip auto-transcription" rather than gating on per-rehearsal user action.

---

## Captured Insights UI

### Where it lives

**v1: a new section inside the existing Comments panel in Review Mode.** Drafts render above (or filtered from) canonical comments with distinct visual treatment.

This matches the Pierce-synthesis priority: don't add new surfaces, work the existing front door harder. Drafts are comments-in-waiting; they belong in the comments panel.

### Visual treatment for drafts

Each draft:

- Distinct background tint (slate-blue, dimmer than confirmed comments)
- Header: `📝 Captured insight · [time]` instead of the standard comment header
- Body: the transcript text, rendered in italic to signal "machine-generated, not yet human-confirmed"
- Action row: `▶ Play segment` · `✓ Accept` · `✏ Edit` · `✕ Reject`
- Optional: speakerCandidate badge if we extracted one ("(Chris was on mic)")

### Filter

Existing Comments header gets a new filter chip: `📝 Captured (N draft)` where N is the count of unreviewed drafts in the session. Click → list scopes to drafts only. Like the existing `@ My mentions` and `📬 Inbox` filters.

### Empty / loading states

- Transcription in progress: "📝 Transcribing chatter… (N speech segments)"
- No speech segments: nothing rendered (the chip doesn't appear)
- All drafts reviewed: chip hides

---

## Promotion flow

On `✓ Accept`:

1. Read the draft record.
2. Create a new comment at `bands/{slug}/rehearsal_sessions/{sid}/comments/{newId}` with:
   - `text`: the (possibly edited) transcript
   - `timestampSec`: segment.startSec + 0 (start of speech segment by default; user can adjust offset later)
   - `segmentId`: the source segment's id
   - `offsetWithinSegment`: 0 by default; could be refined if Whisper provides word-level timing
   - `createdBy`: the user who accepted it (NOT the speaker — that's a speakerCandidate field if we add it)
   - `originalDraftId`: pointer back to the draft for audit
   - `source`: `'chatter-transcript'`
3. Mark the draft `status: 'accepted'` so it doesn't re-surface.

On `✕ Reject`:

- Mark draft `status: 'rejected'`. No new comment created. Draft hidden from default view but available via a "Show rejected" filter for review/recovery.

On `✏ Edit`:

- Open the transcript text in an editor inline.
- Save edits to the draft, then accept-flow runs with the edited text.
- Track that the user edited so we can later analyze "which kinds of transcripts get edited most" for STT quality improvement.

---

## Privacy posture

- **Transcripts are visible only to authenticated band members.** Same access pattern as comments. Cookie/auth-gated. Not indexed externally.
- **Original audio is the source of truth** and stays untouched. Anyone can verify a transcript by clicking `▶ Play segment`.
- **No transcripts sent outside the GrooveLinx infrastructure.** Whisper runs in Modal under Drew's account. Transcript text only ever lands in the band's Firebase node and is fanned out only to authorized readers.
- **Speaker attribution is best-effort, not authoritative.** A speakerCandidate field is offered when one vocal channel clearly dominates; otherwise null. Never claim definitively "Pierce said this."
- **Rejection is recoverable.** Rejected drafts stay in Firebase under `status: 'rejected'` so a misclick doesn't lose the transcript. A "Show rejected" filter restores access.

---

## Cost summary

| Component | Cost (per rehearsal) | Cost (per band per year, ~52 rehearsals) |
|---|---|---|
| Whisper-large inference (Modal A10G) | ~$1.80 (60 min of chatter @ $0.03/min) | ~$94 |
| Storage of transcripts (Firebase RTDB) | ~$0.001 (text payload) | ~$0.05 |
| Storage of draft records | ~$0.001 | ~$0.05 |
| Total | **~$1.80** | **~$94** |

At Drew's current scale (one band, weekly rehearsals), under $100/year. At 100 bands, ~$10K/year — meaningful but bounded. Cost-control valves available if scale exceeds budget:

- Switch to whisper-medium (3x cheaper, accuracy drops noticeably)
- Auto-skip very short speech segments (<10 sec — often noise, not insight)
- Move trigger to opt-in instead of auto

---

## Implementation phases

| Phase | Scope | Estimate | Risk |
|---|---|---|---|
| A — Spike | Manually run whisper-large on one Sugaree chatter segment from 5/27 ingest. Verify transcript quality. Listen to source vs. read transcript. Decide if quality is acceptable for v1. | ~half session | Low |
| B — Modal endpoint | Build `groovelinx-chatter-transcription` Modal app. Single endpoint, async start/check pattern matching existing services. Returns transcript + metadata. | ~1 session | Medium |
| C — Pipeline integration | After segmentation completes, identify speech segments and fire transcription jobs. Persist drafts to Firebase. Status tracking. | ~1 session | Medium (touches live ingest pipeline) |
| D — Drafts UI in Comments panel | Render drafts with distinct visual treatment. Filter chip. Accept/reject/edit affordances. | ~1 session | Low |
| E — Speaker attribution (optional) | If only one vocal channel has audible speech in a segment, tag transcript with speakerCandidate. Pure heuristic; no ML. | ~half session | Low |

**Total estimate:** ~3-4 focused sessions for v1 rollout. Phase E is non-blocking polish.

---

## Open questions for Drew before greenlight

1. **Cost tolerance.** ~$1.80 per rehearsal is the operating cost. Comfortable proceeding at that level, or want to gate on user-triggered transcription instead of auto?
2. **Speaker attribution scope.** Worth shipping in v1, or defer? It's nice-to-have but materially complicates the Whisper pre-processing (need to mix channels conditionally instead of always-all-vocals).
3. **Whether to also transcribe silence segments that contain breath / minor sounds.** Probably no — but worth being explicit. The analyzer should only flag for transcription segments classified `speech` (or a future `chatter` subclass).
4. **What happens with chatter during music.** Currently the analyzer classifies sections as either music or speech, not both. If someone says "play it from the bridge" while the band is still playing, that's classified as music and won't get transcribed. Acceptable for v1; could be addressed later with a "music + speech overlap" classifier.
5. **Default reviewer.** The captured-insights drafts are visible to all band members. Anyone can accept/reject. Worth scoping to "the person who started Review Mode" or "anyone who clicks first" or making it always-collaborative? My v1 lean is collaborative — first-clicker wins, with the action tracked.

---

## Architectural connection to song-clip work

This spec dovetails with [`song_clip_architecture_evaluation_2026-05-29.md`](song_clip_architecture_evaluation_2026-05-29.md):

- Per-song clips are clean of dead time **because** chatter is classified out
- Chatter being classified out is fine **because** the insights have been extracted via transcription
- Comments stay anchored to segments **whether** the segment is music or speech
- Song DNA → Our Takes surfaces only music clips, but the chatter insights live in the Comments layer adjacent to each session

Together the two specs realize Pierce-synthesis priority #6 ("preserve full rehearsal AND song-take access") more completely: full rehearsal is preserved as ground truth, song-takes give a clean DNA browse path, and chatter intelligence is extracted as comment-layer signal. Three layers, each clean about its job.

---

## What this spec does NOT do

- Decide. Drew owns the greenlight.
- Build anything. Pure spec.
- Specify Path B (live wake-word capture). That's a separate question for after Path A is in real use.
- Address transcript translation for non-English bands. Whisper supports multilingual; English-only assumption for v1.
- Specify a separate "captured insights" page outside Review Mode. v1 lives inside the existing Comments panel.

---

## TL;DR

Speech-to-text on the chatter segments the analyzer already identifies. Whisper-large on Modal, ~$1.80 per rehearsal. Transcripts surface as draft comments in the existing Comments panel with accept/reject/edit affordances. Honors Pierce-synthesis ("preserve full rehearsal, extract intelligence, don't make music feel like homework"). Path B (live wake-word) is filed but explicitly out of scope for v1.

**Open before greenlight:** cost tolerance, speaker attribution scope, and whether to spike Whisper quality on one real chatter segment from 5/27 before committing.
