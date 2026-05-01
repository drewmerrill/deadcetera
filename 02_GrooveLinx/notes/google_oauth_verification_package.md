# Google OAuth Verification Package — GrooveLinx

_Prepared 2026-05-01. Use these texts verbatim in the Google Cloud Console verification submission._

---

## 1. App Info (paste into OAuth Consent Screen → Edit App)

| Field | Value |
|---|---|
| App name | GrooveLinx |
| User support email | drewmerrill@comcast.net |
| App logo | `groovelinx-site/groovelinx_app_icon.png` (1024×1024) |
| Application home page | https://groovelinx.com |
| Application privacy policy | https://groovelinx.com/privacy.html |
| Application terms of service | https://groovelinx.com/terms.html |
| Authorized domains | groovelinx.com |
| Developer contact email | drewmerrill@comcast.net |

---

## 2. Scopes that need verification

After the 2026-05-01 cleanup, the consent screen should request **exactly these five scopes**, no more:

1. `email` — non-sensitive, no justification needed
2. `profile` — non-sensitive, no justification needed
3. `https://www.googleapis.com/auth/calendar.events` — **Sensitive**, requires justification
4. `https://www.googleapis.com/auth/calendar.readonly` — **Sensitive**, requires justification
5. `https://www.googleapis.com/auth/drive.file` — non-sensitive (Picker-scoped), no justification needed

If any **other** scope is still listed in the consent screen (especially `drive.readonly` or full `calendar`), remove it before submitting. Verification reviews the whole consent screen, not just the JS code.

---

## 3. Per-scope justifications (paste into the Scopes form)

### `https://www.googleapis.com/auth/calendar.events`

**Why this scope is needed:**
GrooveLinx is a band-management app. Bands schedule rehearsals and gigs inside the app, and members expect those events to appear automatically on their personal Google Calendars so the events show up alongside the rest of their lives. To keep the band calendar and members' personal calendars in sync, the app must create, update, and delete events on calendars the user has access to.

**How the scope is used:**
When a band member adds a rehearsal or gig in GrooveLinx, the app calls `events.insert` against the band's chosen Google Calendar. When a band admin edits or cancels an event, the app calls `events.patch` or `events.delete` so the change is reflected on every band member's calendar via Google's normal calendar-sharing model. No event content is read or written without a direct user action inside the app.

**Why a narrower scope is not sufficient:**
We initially used `calendar.events.owned`, but the band's calendar is typically owned by one administrator and shared with the rest of the band — `events.owned` does not allow non-owner band admins to update events on the shared calendar, breaking the core scheduling workflow. `calendar.events` is the narrowest scope that supports both reading and writing events on shared calendars the user has access to. We do **not** request the broader `calendar` scope (which would also allow deleting entire calendars) because we never need to create or delete calendars themselves.

---

### `https://www.googleapis.com/auth/calendar.readonly`

**Why this scope is needed:**
Two specific features rely on read-only calendar access:
1. **Calendar list** — when a band admin first connects, the app shows a list of the user's calendars so they can pick which one is the "band calendar" for event sync.
2. **Free/busy availability** — when scheduling rehearsals, the app runs `freeBusy.query` against each band member's primary calendar to suggest times when no one has a conflict. The result returned by Google is an opaque list of busy time ranges; no event titles, descriptions, locations, or attendees are ever read.

**How the scope is used:**
- `calendarList.list` (one call per session) — populates the band-calendar picker.
- `freeBusy.query` (run on demand when the scheduling UI is open) — returns busy/free intervals only.

**Why a narrower scope is not sufficient:**
`calendar.events` alone cannot run `freeBusy.query`, which is the core scheduling feature. `calendar.events.freebusy` exists but does not include `calendarList.list`, so we'd be unable to show the user a list of their calendars to pick the band calendar. `calendar.readonly` is the narrowest scope that supports both required calls.

---

### `https://www.googleapis.com/auth/drive.file` (non-sensitive)

No justification required for this scope. For completeness:

The app uses Google Picker so the user explicitly selects each file they want the app to access. The app never lists, browses, or downloads anything the user has not picked. This is the standard non-sensitive Drive integration pattern and replaces the broader `drive.readonly` scope we previously requested.

---

## 4. Video demo script (2–3 minutes, unlisted YouTube)

Google's verification team requires the video to:
- Show the app's domain in the browser address bar at some point
- Show the OAuth consent screen with the requested scopes
- Demonstrate each requested **sensitive** scope being used inside the app

### Recording setup

- Browser: Chrome, signed in to a non-developer Google account (a band member's account is fine — the band-only context strengthens the case)
- Window: full-screen or maximized so URL bar is clearly visible
- Mic: optional; the script below assumes voiceover. Captions also fine.
- Length target: 2:30–2:45

### Shot list + voiceover

**[0:00 – 0:15] App domain visible**
- Open https://groovelinx.com — landing page visible with URL bar showing `groovelinx.com`
- VO: "GrooveLinx is a band-management app at groovelinx.com — bands plan rehearsals, track readiness, and run their gigs from a single tool."

**[0:15 – 0:35] OAuth consent screen**
- Click "Sign in with Google" — sign-in prompt appears
- Pick the Google account, then the consent screen appears
- Slow-pan or pause on the consent screen showing the requested scopes:
  - "View and edit events on all your calendars"
  - "See and download any calendar you can access"
  - "See, edit, create, and delete only the specific Google Drive files you use with this app"
- VO: "When you sign in, GrooveLinx requests three Google scopes: read-write events on the calendars you choose, read-only access to list your calendars and check free/busy availability, and per-file Drive access via Google's Picker for rehearsal recordings."

**[0:35 – 1:15] calendar.events demo (write)**
- Inside the app, navigate to **Calendar** page
- Click **Add Gig** → fill in "Demo Gig", venue "The Test Lounge", date/time
- Save → toast shows "Gig saved + synced to Google Calendar"
- Switch tab to https://calendar.google.com — show the new event appearing on the connected calendar
- VO: "Adding a gig in the app calls `events.insert` to write that gig to the band's shared Google Calendar so every member sees it. Editing or canceling calls `events.patch` or `events.delete` the same way."

**[1:15 – 1:45] calendar.readonly demo (calendar list + freeBusy)**
- Back in the app → **Admin** → **Calendar Settings** (or wherever the band-calendar picker lives)
- Show the dropdown of calendars (this is `calendarList.list`)
- VO: "Listing your calendars uses `calendarList.list` from the read-only scope. When a band member opens the scheduling UI..."
- Open the rehearsal scheduling page (or wherever freeBusy results show up — e.g., gig availability widget)
- VO: "...the app runs `freeBusy.query` against each member's primary calendar so we can suggest times when nobody has a conflict. Only busy/free time ranges are returned — never event titles or details."

**[1:45 – 2:15] drive.file demo (Picker)**
- Open a rehearsal session → "Recordings" → "+ Add Recording"
- Click **📂 Pick from Google Drive**
- Google Picker dialog opens — pick an audio file
- Recording appears in the list, plays back inline
- VO: "When a band member uploads a rehearsal recording from Drive, they pick the file via Google's Picker — the app only ever sees files explicitly selected this way. This is the non-sensitive `drive.file` scope; the app never browses or scans the user's Drive."

**[2:15 – 2:30] Wrap**
- Back to app home
- VO: "All three scopes are requested only because they're directly required by core features that the band sees and uses. We removed broader scopes like `drive.readonly` and full `calendar` in our 2026-05-01 cleanup."

### Submitting the video

- Upload to YouTube → set visibility to **Unlisted**
- Paste the YouTube URL into Google's verification form
- Don't make it Private — Google reviewers can't watch private videos

---

## 5. Submission checklist

Before clicking "Submit for verification":

- [ ] Consent screen shows exactly the 5 scopes listed in §2 (no extras)
- [ ] App logo uploaded (1024×1024 PNG)
- [ ] Privacy + Terms URLs return HTTP 200 (verified 2026-05-01)
- [ ] `groovelinx.com` listed under Authorized domains
- [ ] All 3 sensitive-scope justifications pasted (§3)
- [ ] Demo video uploaded, set to Unlisted, URL ready to paste
- [ ] App is in **Production** publishing status (not Testing — submission is only available from Production)

After submission:
- Google emails an acknowledgment within 1–2 business days
- Reviewer typically responds in 2–6 weeks for sensitive-scope-only submissions
- If they request changes, fix them and resubmit (resets the clock partially but not fully)

Once approved: warning gone permanently. No re-submission needed unless scopes change.
