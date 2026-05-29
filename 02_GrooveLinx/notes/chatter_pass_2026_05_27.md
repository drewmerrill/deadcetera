# 5/27 Rehearsal Chatter Pass — Whisper Transcription Report

**Session:** `rsess_mt_2026_05_27_pass1`
**Model:** faster-whisper-large-v3 (CTranslate2, A10G GPU)
**Source:** all silence-labeled segments >10s (31 total)
**Total audio transcribed:** 641s (10.7 min)

---

## Key empirical finding

The current segmentation analyzer classifies all 239 segments as either `music` or `silence` —
there is no `speech`/`chatter` category. Many segments labeled `silence` actually contain real
conversational chatter (band coordination, setlist talk, gig prep, count-offs). This is why we
had to run Whisper on a duration-filtered silence subset rather than a clean chatter subset.

Whisper handles true silence by hallucinating boilerplate ("Thank you.", "you", ".")
which the report below filters out, leaving substantive turns.

**Deferred:** add a speech/chatter sub-classifier to the silence label so future chatter
passes don't burn GPU cycles on actual silence segments.

---

## Substantive chatter turns (20 of 31)

Sorted by rehearsal time. `prev/next song` columns show the nearest music segments before/after.

### `seg_002` — 0:04:15 → 0:04:50 (35.5s)

**Context:** prev song: *They Love Each Other* · next song: *They Love Each Other*
**Auto-tags:** speaker=brian · song_guess=Down

> Drums. Just drums. Just lay a beat down. The kick will be a good... I'm not going to be able to ask for monitors or set my monitors until I hear you play and how loud it is on stage. So I need drums playing and bass playing before I can even begin to know where I need to be. Am I smelling some goody-goody? Of course. I was getting around to that. in this case i need i have zero kick and snare and overheads and all that what channel is your you know how the bomb goes tonight

### `seg_010` — 0:17:24 → 0:17:37 (12.9s)

**Context:** prev song: *All Along the Watchtower* · next song: *Franklin's Tower*
**Auto-tags:** speaker=brian · song_guess=—

> We'll have our instruments already up.

### `seg_011` — 0:17:37 → 0:17:50 (13.6s)

**Context:** prev song: *All Along the Watchtower* · next song: *Franklin's Tower*
**Auto-tags:** speaker=brian · song_guess=—

> You'll have your instrument on you, actually. No, I'll just leave it out here. You'll probably want to have it backstage to tune it. You'll leave it on stage for an hour or half an hour.

### `seg_020` — 0:18:30 → 0:18:41 (11.6s)

**Context:** prev song: *All Along the Watchtower* · next song: *Franklin's Tower*

> I was like, yep. We all heard that. This is your own guy. I don't understand. This is an advanced question. It's a little beyond.

### `seg_073` — 1:17:35 → 1:18:13 (38.5s)

**Context:** prev song: *After Midnight* · next song: *Possum*
**Auto-tags:** speaker=pierce · song_guess=—

> Thank you again. We are Dead Cetera. Not to be confused. Just kidding. I think we don't say anything about the names at all. Don't say anything about it being the first time. All we got to do is pronounce it right. Pronounce it correctly. We are Dead Cetera. We are Dead Cetera. I'm Pierce Hale, founder and owner. Snake rider. All rights reserved. All rights reserved. uh yeah these are guitarists who are tuning now and ready to play

### `seg_082` — 1:26:23 → 1:26:35 (11.5s)

**Context:** prev song: *Funky Bitch* · next song: *They Love Each Other*
**Auto-tags:** speaker=brian · song_guess=The Other One

> Like trying to fix that, it broke the other one.

### `seg_092` — 1:27:16 → 1:27:28 (12.1s)

**Context:** prev song: *They Love Each Other* · next song: *Green-Eyed Lady - Sugarloaf*

> on this right there. It's like, yeah.

### `seg_099` — 1:28:35 → 1:28:57 (22.2s)

**Context:** prev song: *Green-Eyed Lady - Sugarloaf* · next song: *Green-Eyed Lady - Sugarloaf*
**Auto-tags:** speaker=pierce · song_guess=—

> and one and two and three and four and one and two and three and four and one one and two and wait one and two and three and it starts on that and and two and three and four and one and two and three and four and

### `seg_108` — 1:29:44 → 1:30:02 (18.2s)

**Context:** prev song: *Music Never Stopped* · next song: *Franklin's Tower*
**Auto-tags:** speaker=— · song_guess=Fee

> Yeah, I was just going to say, does anyone know? Oh, shit. It's 7.48. So we're right at hour six. That's pretty good feedback there. So, Drew, do you know exactly when we started?

### `seg_110` — 1:30:05 → 1:30:15 (10.6s)

**Context:** prev song: *Music Never Stopped* · next song: *Franklin's Tower*
**Auto-tags:** speaker=drew · song_guess=Down

> when we walked out here yeah oh yeah that's right because you said 641 and you were counting down and making us all nervous so after midnight like i'm also confused about who's doing solos and not because i thought

### `seg_114` — 1:30:24 → 1:30:52 (28.2s)

**Context:** prev song: *Music Never Stopped* · next song: *Franklin's Tower*
**Auto-tags:** speaker=— · song_guess=Possum

> Two dedicated solos. Okay. I have had fun doing that with Possum, though. I hadn't typically done a solo in Possum, but I think Brian and I. He looks at me funny, and I'm like, ah. Franklin's like, I like that you slow down, but you literally stop. Oh, yeah. Were you thinking the song was over again, or were you just, no, you were just trying to get it atmospheric? I just lost the rhythm, honestly. Yeah, keep that tempo going through that. A little bit, like a little bit of tempo. Not all of it.

### `seg_120` — 1:31:32 → 1:31:52 (19.9s)

**Context:** prev song: *Scarlet Begonias* · next song: *Sugaree*
**Auto-tags:** speaker=— · song_guess=Fee

> You don't think so? Fuck it up. Yeah, but I think someone's going to go to that B. I just feel like maybe we go back to going to the B and just tell them to fuck it up. And everybody goes to the B and Brian can kick us all in the nuts afterwards. Yeah. Because Brian then started going to the B. I was like, what the fuck? Probably if we all are, then he has to. He had to, but I wasn't. I mean, you know, he could.

### `seg_136` — 1:34:44 → 1:35:04 (20.6s)

**Context:** prev song: *Sugaree* · next song: *Music Never Stopped*
**Auto-tags:** speaker=— · song_guess=Nothing

> For McDonough, they probably want it tight. I mean, you know, it depends. We don't need no 18-minute Dark Star or nothing. Some heads could come out. They could be like, oh, I saw a fucking dead sign. They didn't even jam at all. I mean, anyone that comes out to see us is probably going to be dead heads. I don't think. Yeah, anybody that doesn't. I mean, maybe there's some locals there that are just going to go. There's locals that always come no matter what. Do you think there's?

### `seg_151` — 1:56:34 → 1:57:18 (44.3s)

**Context:** prev song: *Funky Bitch* · next song: *Sugaree*
**Auto-tags:** speaker=brian · song_guess=She

> The only thing I need is a room mic. I mean, there's some notes that are up there, aren't there? I know. I think that's like a lot of – Well, it's – no, not – I mean, it's just frequencies. It's not notes. So the cymbals are hitting 10K or so. Guitar only goes up to about 6K, like the highest frequencies in the guitar. Yeah, that's – it's still hearing it. Yeah, you hear it just fine. It's just I don't hear the super – it cuts off the super high, high of it, the frequency. You're at 10K. He's at about – I want to be at 10K. It starts at about 7 to 8K, and then it shelves off like a ramp. It's called a low-pass filter. It's funny. The low-pass is for the high-end, and the high-pass is for the low-end. Yeah, I got that one down. So let's see. But there's no notes.

### `seg_157` — 1:58:47 → 1:59:02 (15.0s)

**Context:** prev song: *Sugaree* · next song: *After Midnight*

> Well, there's no way we'll all come in on the first one. I always ease into it. I always have. I know. We've always kind of missed it at the end. I always start teasing that riff a little bit. Yeah. I just got to turn around and nod at Jay. It's going to be different when I'm not facing him. Maybe. Maybe.

### `seg_158` — 1:59:02 → 1:59:14 (12.0s)

**Context:** prev song: *Sugaree* · next song: *After Midnight*
**Auto-tags:** speaker=pierce · song_guess=—

> tease it and then we're if we're all looking and then but it just gets hard to depend on those types of things i'll signal you guys we can try to yeah you'll signal us the one or you'll signal

### `seg_159` — 1:59:14 → 1:59:38 (24.4s)

**Context:** prev song: *Sugaree* · next song: *After Midnight*
**Auto-tags:** speaker=— · song_guess=Crazy

> I'll signal you the last time. The last time. Okay. Yeah, because he's going to come in. Yeah, because the problem is if I've done the one already and somebody's missed it, then they're going to think the one is the next one. That's where it gets confusing. Yeah, yeah. And it's coming right out of a crazy solo into that. It's just there's, you know. Yeah. And normally we go into fire, too. Yeah, I know.

### `seg_171` — 2:12:45 → 2:13:06 (21.1s)

**Context:** prev song: *Sugaree* · next song: *After Midnight*

> look for me to say yeah yeah I think yeah this is the last time through we're about to start the last time yeah yeah never is versus yeah it's at the end of that whatever phrase short one more you might be doing this short of Jay is short of

### `seg_173` — 2:13:13 → 2:13:46 (32.9s)

**Context:** prev song: *Sugaree* · next song: *After Midnight*
**Auto-tags:** speaker=— · song_guess=Down

> I think that's what we need at the end of this. I think that's what we need is that, too. That's exactly what I just did, though. I just brought my guitar up and waved. I came out of it when you started going into that. Let's just take it from the jam again, and then I'll work into that part. And you're going to hear me tease it a couple times, and then I'm into it for real. Look at me. I'm going to be going one, two. I'm going to count you down through each one of them.

### `seg_216` — 3:13:00 → 3:13:54 (54.6s)

**Context:** prev song: *After Midnight* · next song: *(none)*

> We're going to get through all these songs. Thank you.

---

## Filtered out — Whisper hallucinations on actual silence (11 segments)

These segments were labeled `silence` by the analyzer and Whisper confirmed they were
genuinely silent (only generic boilerplate output). Listed for completeness:

- `seg_023` (0:18:54, 13.4s): "Thank you."
- `seg_029` (0:19:32, 15.2s): "Thank you."
- `seg_030` (0:19:47, 12.3s): "Thank you."
- `seg_031` (0:20:00, 16.3s): "Thank you."
- `seg_033` (0:20:19, 17.2s): "Thank you."
- `seg_036` (0:20:48, 13.8s): "(empty)"
- `seg_047` (0:21:48, 12.8s): "Thank you."
- `seg_048` (0:22:01, 10.4s): "Thank you."
- `seg_050` (0:22:16, 28.3s): "Thank you."
- `seg_054` (0:22:54, 11.7s): "Thank you."
- `seg_095` (1:27:41, 29.8s): "Thank you."
