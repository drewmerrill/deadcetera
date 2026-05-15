# OAuth Verification Video — Recording Script

**Print this page. Read VO lines verbatim. Each shot has timing · action · what's on screen · voiceover.**

Source of truth: `02_GrooveLinx/notes/google_oauth_verification_package.md` (this script is §4 extracted + expanded for the recording session). Updated 2026-05-15.

Target length: **2:30–2:45**. If you go over 3:00, trim VO words — don't trim shots.

---

## Pre-flight (do this BEFORE you hit record)

**Logo upload — confirm before recording:**
- [ ] In Google Cloud Console → APIs & Services → OAuth consent screen → Edit App → App logo: uploaded `icon-1024.png` from repo root (1024×1024 PNG, GrooveLinx mark on dark background).
- [ ] Save and reload the consent screen URL once to confirm the logo renders.

**Browser setup:**
- [ ] Chrome, **full-screen** (⌃⌘F on macOS) so URL bar reads cleanly
- [ ] **Hide bookmarks bar** (View → Hide Bookmarks Bar) so the URL bar is unambiguous
- [ ] Sign in to Chrome with a **non-developer Google account** — a band member's account is ideal (the band-only context strengthens the case)
- [ ] **Pre-open these tabs in this order**, then go back to Tab 1:
  1. https://groovelinx.com (landing page — Tab 1)
  2. https://calendar.google.com (you'll switch to this in Shot 3)

**Recording setup:**
- [ ] Screen recorder ready (QuickTime, OBS, ScreenFlow, etc.)
- [ ] Audio armed; mic at consistent distance
- [ ] Phone on Do Not Disturb
- [ ] Quiet room
- [ ] Practice run-through once without recording — make sure each shot transition feels natural

**Test data:**
- [ ] You'll be adding a "Demo Gig" at "The Test Lounge" in Shot 3 — don't worry about deleting it after; reviewers expect to see real data flow

---

## Shot 1 — App domain visible · 0:00 → 0:15

**On screen:** Tab 1, https://groovelinx.com — landing page, URL bar showing `groovelinx.com`

**Action:** No action — just hold the shot.

**Voiceover:**
> "GrooveLinx is a band-management app at groovelinx.com — bands plan rehearsals, track readiness, and run their gigs from a single tool."

---

## Shot 2 — OAuth consent screen · 0:15 → 0:35

**Action 1:** Click "Sign in with Google" → sign-in prompt appears
**Action 2:** Pick the test Google account
**Action 3:** Consent screen loads — **PAUSE 5+ SECONDS** so reviewers can read:
- The "This app hasn't been verified by Google" warning banner (top of screen)
- The three sensitive-scope checkboxes (currently unchecked):
  - "See, edit, create, and delete only the specific Google Drive files you use with this app"
  - "View and edit events on all your calendars"
  - "See and download any calendar you can access using your Google Calendar"

**Action 4:** **Check each scope checkbox on camera**, one at a time
**Action 5:** Click Continue

**Voiceover (start as Action 3 begins):**
> "When you sign in, GrooveLinx asks for three sensitive scopes — calendar event read-write, read-only calendar listing for free/busy availability, and per-file Drive access through Google's Picker. Each is opt-in via the granular consent checkboxes. Email and profile are auto-granted; nothing else is requested."

---

## Shot 3 — calendar.events demo (write) · 0:35 → 1:15

**Action 1:** Inside the app, navigate to the **Schedule** page
**Action 2:** In the SCHEDULE action zone, click **+ Gig**
**Action 3:** Fill in:
- Title: `Demo Gig`
- Venue: `The Test Lounge`
- Date / time: any future date that's clearly visible
**Action 4:** Click Save → toast confirms `Gig saved + synced to Google Calendar`
**Action 5:** Switch to Tab 2 (https://calendar.google.com) — point at the new "Demo Gig" event on the calendar

**Voiceover (start as Action 4 fires):**
> "Adding a gig writes the event to the band's shared Google Calendar via `events.insert` — every band member sees it on their calendar through Google's normal sharing model. Editing or canceling triggers `events.patch` or `events.delete` the same way."

---

## Shot 4 — calendar.readonly demo (calendarList + freeBusy) · 1:15 → 1:45

**Action 1:** Switch back to the app
**Action 2:** On the Schedule page, click **Set Up Band Calendar** (the band-calendar picker)
**Action 3:** Show the dropdown of available calendars — let it sit long enough that the list is readable

**Voiceover (over Action 3):**
> "Listing your calendars uses `calendarList.list` from the read-only scope so the user can pick which calendar is the band calendar."

**Action 4:** Close that picker, scroll up to where the **Recommended next rehearsal** card sits at the top of the Schedule page

**Voiceover (over Action 4):**
> "When the scheduling UI loads, the app runs `freeBusy.query` against each band member's primary calendar to suggest times when nobody has a conflict. Only busy/free time ranges are returned — never event titles, locations, or attendees."

---

## Shot 5 — drive.file demo (Picker) · 1:45 → 2:15

**Action 1:** Open a rehearsal session → "Recordings" tab
**Action 2:** Click **+ Add Recording**
**Action 3:** Click **📂 Pick from Google Drive**
**Action 4:** Google Picker dialog opens — pick an audio file
**Action 5:** Recording appears in the list — let it play back inline for a beat

**Voiceover (start as Action 3 fires):**
> "When a band member uploads a rehearsal recording from Drive, they pick the file via Google's Picker. The app only ever sees the file they explicitly select — this is the non-sensitive `drive.file` scope; the app never browses or scans the user's Drive."

---

## Shot 6 — Wrap · 2:15 → 2:30

**Action:** Navigate back to the app home / dashboard

**Voiceover:**
> "All three sensitive scopes are requested only because they're directly required by core features the band sees and uses. We removed broader scopes like `drive.readonly` and full `calendar` in our 2026-05-01 cleanup."

---

## Post-record (after you stop recording)

- [ ] Trim any pre-roll silence or fumbled takes
- [ ] Watch the whole thing once — is the URL bar readable in every shot? Are the consent-screen checkboxes visible? Did you actually click Save in Shot 3?
- [ ] Upload to YouTube
- [ ] Set visibility to **Unlisted** (NOT Private — Google reviewers cannot watch private videos)
- [ ] Copy the YouTube URL
- [ ] Paste into Google Cloud Console → OAuth verification form
- [ ] Run through the §5 submission checklist in the master package one final time
- [ ] Submit

---

## What reviewers are looking for (so you know what NOT to skip)

1. **Your domain in the URL bar** — Shot 1 covers this.
2. **The OAuth consent screen with the requested scopes** — Shot 2 covers this. The 5+ second pause is what makes this watchable for reviewers.
3. **Each requested sensitive scope demonstrated being used inside the app** — Shots 3, 4, 5. One scope per shot.
4. **Granular consent checkboxes being interacted with** — Shot 2 Action 4. Newer reviewers expect to see this.

If you skip any of these four, the reviewer will likely email asking for a revised video — adding 2–6 weeks to the timeline.
