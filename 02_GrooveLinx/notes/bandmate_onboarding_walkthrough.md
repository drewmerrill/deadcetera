# Bandmate Onboarding Walkthrough — Script + Flow

**Purpose:** Drew walks a single bandmate through GrooveLinx on a 20-25 min 1:1 call. Used 2026-05-05 for Pierce; reusable for Brian, Chris, Jay, or any future addition.

**Goal of the call (Drew's goal, not theirs):**
1. Bandmate logged in on phone + laptop
2. Notifications allowed
3. They understand the three things they'll touch most — Songs, Rehearsal, Schedule
4. They commit to using it for the next two rehearsals so we have real data

**What NOT to do:**
- Don't show every feature. The product has a lot — the point of this call is *adoption*, not *tour*.
- Don't apologize for anything that's rough. They'll forgive a few rough edges if they see why it matters; they won't forgive a 45-minute demo.
- Don't get sucked into bug-hunting on the call. Note it, move on.

---

## The Script

### 1 · Frame it (90 seconds)

> "Hey — quick walkthrough of GrooveLinx so we're on the same page. The short version: this is the tool I've been building so we stop losing track of where every song stands. Right now we've got songs in different states — some we know cold, some we're learning, some someone wants to try — and it's all in our heads or in scattered text threads. GrooveLinx puts that in one place so when we walk into rehearsal we already know what we're working on and why.
>
> Three things I want to show you: how to find a song and what you'll do with it, how rehearsals get planned and tracked, and how the calendar side works so you're not getting double-booked. Should take about twenty minutes. Sound good?"

**Why this opening works:** names the pain ("lost track / scattered threads"), names the payoff ("walk in knowing what we're working on"), sets a time box. No feature list.

---

### 2 · Get them logged in (2-3 min)

This is the highest-leverage part of the call. If they don't get logged in *while you're on the line*, the odds drop fast.

> "Open a browser, go to **app.groovelinx.com**. Sign in with the Google account you got the invite on. … Got it? Good.
>
> Now do the same on your phone. Same URL, same Google login. On iPhone you can hit Share → Add to Home Screen and it'll act like an app. Android, the install prompt usually shows up on its own."

**Watch for:**
- They click the wrong Google account (common). Have them sign out and pick the band-invited one.
- They see "no band data" — means they're not on the band roster yet. Note it; you'll fix after the call.

> "One more thing while we're here — when it asks about **notifications, say yes**. That's how you'll find out about rehearsal changes, setlist updates, and anyone marking themselves out. If you say no now, the browser remembers and it's a pain to undo. Just allow it."

**Why this matters:** the FCM push system is one of the high-leverage things you've built. If they don't allow notifications, the rest of the system loses half its value to them.

---

### 3 · The Home screen — what is this thing? (2 min)

> "This is Home. Think of it as the band's dashboard. Top of the screen is **Now Focus** — that's the song the band should be working on most right now, based on where it sits in our rotation, when we last touched it, and how shaky it still is. You don't have to do anything with that — it's just always there as a 'hey, this is the one.'
>
> Below that you've got our **next rehearsal**, our **next gig**, anything that's gone stale, and stuff that needs attention. The whole point of this screen is: open the app, look at it for ten seconds, know what's going on. Don't dig — if it's important, it's on Home."

**Don't show them:** every card. Just point at Now Focus and Next Rehearsal. Move on.

---

### 4 · Songs — the heart of it (5-7 min)

This is the deepest part of the call. Give it room.

> "Click **Songs** on the left rail.
>
> Two things to notice: every song has a **status** — Active, Learning, Prospect, Library, Retired — and that status is the single most important thing in this whole tool. Anything **Active** is what we play live or are getting ready to play live. **Learning** is in progress. **Prospect** is someone wants to try it. **Library** is everything else — songs we used to play, songs we know but aren't currently working on. The intelligence stuff — what to rehearse, what's gone stale, what to put in a setlist — only looks at Active and Learning. Library doesn't clutter recommendations.
>
> Click one of our songs. Any one. … This is the **song drawer**. Everything we know about this song lives here: tempo, key, who plays what, lyrics, chord chart if we have one, the recording or stems if we've uploaded them, notes from past rehearsals. The idea is: if you're driving and want to hear how the bridge goes, open the drawer, hit play."

**Show — pick a song you know is filled in well:**
- Tempo / key
- Lyrics or chord chart
- Stems if uploaded ("we can solo just the bass if you want to lock in a part")
- Notes / recent rehearsal mentions

> "If something's wrong or missing — wrong key, missing chart, whatever — just edit it. Everything you change is shared with the band instantly. Don't worry about breaking anything; we have version history."

**Pitch the buy-in moment:**

> "What I want from you here is: spend ten minutes this week going through the **Active** list and flag anything that's wrong about your part — your key, your tuning, anything that says you play X when you actually play Y. That's it. You don't have to fill in lyrics. You don't have to upload anything. Just: is what's listed about your part correct? That's the most useful thing you can do this week."

**Why this works:** you're giving them ONE concrete task. Not "explore the tool." Not "play with it." One job, ten minutes.

**Readiness note:** if you want to demo readiness scoring, scroll down to the Readiness card in the right panel — they'll see a slider on their own row (post build `20260506-004041`). Other members are read-only colored bars.

---

### 5 · Rehearsal — what we're working on (3-4 min)

> "Click **Rehearsal**.
>
> This is the screen you'll have open during rehearsal. Top of the page is the **plan** — songs we're hitting tonight, in order, with how long we expect to spend on each. Below that's the **walkthrough** — once we start, this tracks what we actually played, what we got through, what we punted on. After rehearsal it generates a summary — what improved, what's still rough, what to come back to next time."

> "On rehearsal night the move is: open this on your phone or laptop, follow the plan, tap into a song to see notes for that one. When we finish a song you can hit a quick rating — green/yellow/red — and that feeds back into the system so it knows what's still shaky and what we can shelve for a while."

**Don't show them:** the analyzer, golden timeline, walkthrough internals. They don't need that.

> "I'll drive the plan for now. Your job is just to follow it and tap ratings. Easy."

---

### 6 · Schedule — gigs, rehearsals, your life (3-4 min)

This is where the calendar TZ war we just fought pays off.

> "Click **Schedule**.
>
> This is the band calendar. Gigs, rehearsals, anyone marked out. **Two-way synced with Google Calendar** — meaning, if you mark yourself unavailable on your personal Google calendar (vacation, kid's recital, whatever), it shows up here as 'Brian out' so we know not to schedule a rehearsal on top of it. Conversely, when I add a gig here, it shows up on your Google calendar so you can see it next to everything else in your life."

> "**You don't have to do anything to make this work** — it just runs. The only thing I need from you is: when a gig or rehearsal is on the calendar, mark whether you can make it. Tap the event, hit Free / Tentative / Out. That's it. The whole band can see in real time who's confirmed."

**Show:**
- Click a rehearsal, show the availability buttons
- Show the "DeadCetera" calendar in their Google Calendar sidebar so they see it's a real shared calendar, not a black box

**Note on the Rules / Sign-In dance (post build `20260506-012554`):** if they balk at OAuth, click **Rules** — the modal opens pre-OAuth now and they can pick their scheduling mode + read what each setting controls before they sign in. There's also a "Preview Rules" link below the 3-mode chooser cards. This addresses Pierce's "I won't sign in until I see what I'm signing into" concern.

**Ground rules to set verbally:**
- "If you're going to be out for a stretch — work travel, vacation — block it on your personal Google calendar and the band calendar will pick it up automatically. Don't double-enter."
- "If something on the band calendar is wrong, tell me. Don't edit it directly in Google — there's some plumbing about who's the source of truth and it gets weird."

---

### 7 · Setlists — building a show (2-3 min)

Only show this if they're not exhausted yet. If they are, skip.

> "Setlists. Click into one we've built. Each line is a song from our Active list, in order, with key and tempo. If a song needs work between now and the show, it'll flag here. If someone in the band is going to be out, the setlist knows and warns me."

> "You'll mostly just look at these to know what we're playing. I build them. If you've got a strong opinion — 'we should open with X, not Y' — tell me, I'll move it. Don't worry about editing them yourself."

---

### 8 · The two modes — Rehearsal Mode and Live Gig Mode (90 seconds)

> "Last thing. There are two **full-screen modes** — Rehearsal Mode and Live Gig Mode. They're for when we're actually playing. Big text, no chrome, easy to read on a phone propped up on an amp. Rehearsal Mode pulls up the plan and walkthrough; Live Gig Mode pulls up the setlist with the next song highlighted, lyrics if you want them, key reminders.
>
> You don't need to set these up. I'll launch them when we need them. Just know they exist so when you see your phone go full-screen black-and-green at our next rehearsal, that's why."

---

### 9 · Wrap — what you actually want from them (2 min)

> "OK, three things from you between now and next rehearsal:
>
> 1. **Logged in on phone and laptop.** Done if we did it on this call.
> 2. **Notifications allowed** on at least one of them.
> 3. **Ten minutes on the Songs page**, scanning the Active list, flagging anything wrong about *your* part.
>
> Then at next rehearsal, just have it open and follow the plan. That's the whole ask. If anything's broken, weird, confusing — text me. Don't suffer in silence; that's how I find out what to fix."

---

## Logical flow at a glance

```
1. Frame it                     (90s)   — pain + payoff, time box
2. Login on phone + laptop      (3m)    — the moment of truth
3. Home screen                  (2m)    — orientation
4. Songs                        (6m)    — depth, then ASK for one task
5. Rehearsal                    (3m)    — what they'll touch on rehearsal night
6. Schedule                     (3m)    — calendar + availability ground rules
7. Setlists                     (2m)    — light touch
8. Modes                        (90s)   — heads-up, no action needed
9. Wrap                         (2m)    — three concrete things, send-off
```

**Total: ~22 minutes.** If they're engaged, you can stretch to 30 by going deeper on Songs. If they're checked out, you can compress to 15 by skipping Setlists and Modes.

---

## Demo prep checklist (before the call)

- [ ] Their account is on the band roster — verify in Settings before the call so login works first try
- [ ] Pick **one well-populated song** to show in the Songs section — tempo, key, chart, ideally stems. Have it ready.
- [ ] Have a rehearsal on the calendar within the next 2 weeks so the Rehearsal page has something to show
- [ ] Have a setlist built (even a draft) so the Setlist page isn't empty
- [ ] Phone and laptop both signed in to your own account so you can demo from both perspectives
- [ ] Console closed. They don't need to see logs.
- [ ] Verify build is current and you've hard-reloaded — first impression hardening only works on the latest build

---

## If they push back

**"Why not just keep using texts and a Google doc?"**
> "That's exactly what we used to do. Problem is, by the time we get to a gig, nobody can remember what key we agreed on for X, who said they'd learn the bridge, or whether we ever decided if Y was in or out of the set. This makes that the same problem the tool solves once and forever, instead of a problem we solve over and over in the group chat."

**"Looks complicated."**
> "It's complicated to *build*. To *use* it's three things: glance at Home, mark yourself in or out for events, look at songs when you want to woodshed. Everything else is for me, not you."

**"I'm not gonna use a tool."**
> "Totally fair. Then just allow notifications and use it for the calendar piece. The rest is bonus. The calendar alone is worth it because right now we lose half a week of back-and-forth every time we try to pick a rehearsal date."

**"I don't want to grant Google Calendar access until I know what it does."**
> "Click Rules — the modal opens before OAuth now, you can pick your scheduling mode and read what every setting controls. Sign in only when you've seen enough."

---

## Lessons from the Pierce call (2026-05-05)

What we learned that should shape future walkthroughs:

1. **The Songs page can fail loudly for users with stale localStorage** (the `_topGaps` hoist bug). Fixed in build `20260505-222943` + render fault tolerance in `20260506-012554`. Future walkthroughs should be safe but still: do a hard reload on the bandmate's machine before starting.
2. **Right-panel readiness was read-only** until build `20260506-004041`. Now editable on desktop. Don't promise readiness editing without confirming the bandmate is on the latest build.
3. **The OAuth ask felt like a black box** until the Rules modal opened pre-OAuth (build `20260506-012554`). Always offer "click Rules first" before the OAuth grant.
4. **One concrete task per call** wins. Pierce got "10 minutes scanning Active list, flag your part." Don't add a second ask.
5. **Personal-calendar replicas of old `deadcetera Gig` events** persist on bandmates' Google calendars from the auto-attendee era. Be ready to explain: those are legacy invites, sync won't manage them, manually delete from personal cal.
