# Tier 2 Single-Tap Loop — iPhone Safari Validation

**Build:** `20260526-181017` · **Commit:** `56ff5a54` · **~10–15 min**

## Before you start

- On iPhone Safari, open `app.groovelinx.com`
- Pull-to-refresh once (clears any prior service-worker cache)
- Confirm bottom of any page shows build `20260526-181017`. If it shows the old build (`20260526-102503`), close Safari tab fully, reopen.
- Open Rehearsal → tap a session with multitrack data + a completed render (5/18 Drew's House is the canonical UAT session)

---

## 1 · Cold-open honesty

Open Review Mode for the first time this session. Look at the top of the player.

✅ **Pass:** Header reads exactly `🎵 Tap a song to start`. No row in the segments list has an indigo outline. Nothing claims to be "currently reviewing."
⚠️ **Fail:** Any row has the indigo outline. Header says `🎵 Reviewing: Music Never Stopped …` (or any segment name) before you've done anything.

---

## 2 · Tap row sets loop (no audio yet)

Tap **Sugaree** (or any row).

✅ **Pass:** The row enters its focused state (action buttons appear, neighbors dim to ~0.5 opacity). Header reads `🔁 Sugaree · 38:40–40:05 · paused`. **No audio starts.** That row is the only one with the indigo outline.
⚠️ **Fail:** Audio starts on its own. Header still says "Tap a song to start." Multiple rows have outlines simultaneously.

---

## 3 · Tap Play, listen for the wrap (the load-bearing check)

Tap ▶ Play. Let the loop go around **3–5 times** without touching anything.

✅ **Pass:** Audio enters at the segment's start time. As the playhead reaches the end of the segment, it jumps back to the start and continues. The transition **feels musical** — like the band starting the section again. Header reads `🔁 Sugaree · 38:40–40:05 · playing`.
⚠️ **Fail (any of these):**
  - Audible click at the wrap point
  - Noticeable silence gap at the wrap (>50ms feels gappy)
  - Audio stutters or buffer-stalls when wrapping
  - Wrap feels "engineered" — a system event you can hear, not a musical loop
  - Audio plays past the segment end and into the next segment instead of wrapping

**Make a note of which:** clicky / gappy / stuttery / overruns / fine.

---

## 4 · Switch loops mid-playback

While audio is still looping, tap a different row (e.g., **After Midnight**).

✅ **Pass:** Audio immediately jumps to the new segment's start time and begins looping the new bounds. Header updates to the new segment's name + range.
⚠️ **Fail:** Audio keeps playing the old segment. Loop doesn't move. Visual focus moves but audio doesn't follow.

---

## 5 · Composer doesn't interrupt the music

While audio is still looping, on the focused row, tap **+ Add note at HH:MM**.

✅ **Pass:** Composer textarea appears. **Audio keeps looping — does NOT pause.** You can type a few words while the loop continues.
⚠️ **Fail:** Audio pauses when the composer opens. Loop stops. Header changes to "paused."

(Optional: type something, tap Cancel. The composer closes. Audio still looping. Per Pass 2.5, your text is auto-saved as a draft — that's existing behavior, not new in this ship.)

---

## 6 · Close + reopen → loop restored paused

Tap ▶/⏸ to pause. Then tap the **×** at the top of Review Mode (closes the modal entirely).

Then tap the same multitrack session from the Rehearsal page to open Review Mode again.

✅ **Pass:** Header reads `🔁 Sugaree · 38:40–40:05 · paused` (or whichever segment was your last loop). **Audio does NOT auto-start.** You tap Play to resume.
⚠️ **Fail:** Header shows the cold-open message. Loop has been forgotten. Or worse: audio auto-starts on reopen.

---

## 7 · Anchor sentence reads as natural

Across all the steps above, the header sentence should feel like **one calm fact**, not a status panel.

✅ **Pass:** Reading it once tells you what's happening. The grammar feels human.
⚠️ **Fail:** You have to parse multiple chunks to understand the state. The sentence feels like telemetry. Anything reads as "wrong" or "off."

---

## What to report back

A one-line verdict per item is enough:

```
1 cold-open       — pass / fail (notes)
2 tap-sets-loop   — pass / fail (notes)
3 wrap-feel       — pass / clicky / gappy / stuttery / overruns
4 switch-mid-play — pass / fail (notes)
5 composer-cont   — pass / fail (notes)
6 close-reopen    — pass / fail (notes)
7 anchor-reads    — pass / fail (notes)
```

Anything that fails or feels "off but I can't say why" — quick voice memo or screenshot is plenty.

The wrap-feel check (#3) is the one Playwright couldn't validate. Everything else is mechanical; #3 is musical.
