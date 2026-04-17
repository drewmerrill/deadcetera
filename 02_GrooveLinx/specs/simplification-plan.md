# GrooveLinx Simplification Plan

_Created: 2026-04-17_
_Status: PHASE 1 SHIPPED (2026-04-17) — simplified nav + bottom tabs + tools drawer_

---

## Current State: 24 Pages, 4 Nav Sections

```
Primary (5):  Home, Songs, Rehearsal, Schedule, Setlists
Band (4):     Gigs, Band Room, Feed, Settings
Tools (8):    Practice, Playlists, Pocket Meter, Tuner, Metronome, Stage Plot, Venues, Equipment
More (6):     Finances, Social Media, Best Shot, Contacts, Notifications, Help
```

## Target State: 5 Core + Contextual + Drawer

```
Core Nav (5):      Home, Songs, Rehearsal, Schedule, Setlists
Contextual (8):    Surface when relevant (Gigs→Schedule, Practice→Songs, etc.)
Tools Drawer (9):  Searchable palette (⌘K / toolbar icon)
Hidden (2):        Dev-only (UAT, Bugs tabs in Settings)
```

---

## 1. Complete Feature Classification

| Page | Layer | New Location | Rationale |
|------|-------|-------------|-----------|
| **Home** | Core Nav | HOME | Band command center |
| **Songs** | Core Nav | SONGS | Library + practice actions |
| **Rehearsal** | Core Nav | REHEARSAL | Plan → run → review |
| **Schedule** | Core Nav | SCHEDULE (calendar) | When is everything happening |
| **Setlists** | Core Nav | SETLISTS | What's the set |
| **Gigs** | Contextual | SCHEDULE context rail | Gigs are events. Show gig details when a gig event is selected on calendar. Link from Home "upcoming gigs" card. |
| **Band Room** | Contextual | HOME "Band" tab | Merge into Home as a second tab or section below next action |
| **Feed** | Contextual | HOME activity stream | Becomes the "What's New" surface |
| **Practice** | Contextual | SONGS inline actions | "Practice" is an action on a song, not a destination |
| **Playlists** | Tools Drawer | Accessible via drawer + Song Detail | Listening links live on songs |
| **Pocket Meter** | Tools Drawer | Floating tool overlay | Available from any page |
| **Tuner** | Tools Drawer | Floating tool overlay | Available from any page |
| **Metronome** | Tools Drawer | Floating tool overlay | Available from any page |
| **Stage Plot** | Tools Drawer | Accessible via drawer + Gig detail | Stage setup for gigs |
| **Venues** | Tools Drawer | Accessible via drawer + Event form picker | Venue data shown in context |
| **Equipment** | Tools Drawer | Accessible via drawer | Low-frequency admin tool |
| **Best Shot** | Contextual | REHEARSAL session review | Compare recordings in context |
| **Finances** | Tools Drawer | Accessible via drawer | Spreadsheet tool, low frequency |
| **Social Media** | Tools Drawer | Accessible via drawer | Links only, minimal value |
| **Contacts** | Tools Drawer | Merge into Venues | Same data model |
| **Notifications** | Tools Drawer | Accessible via drawer | Care packages + SMS |
| **Help** | Tools Drawer | ? icon in top bar | Not a nav destination |
| **Settings** | Contextual | Gear icon in top bar or left rail footer | Not a primary page |
| **Settings → UAT** | Hide | Dev flag only | Internal testing |
| **Settings → Bugs** | Hide | Dev flag only | Internal tracking |
| **Settings → Plan** | Hide | Dev flag only | Product roadmap |

---

## 2. Phased Rollout Plan

### Phase 1: Simplify Nav (Days 1-5)
**Goal: Left rail shows 5 core pages. Everything else accessible but not in your face.**

**Changes:**
- `js/ui/gl-left-rail.js` lines 28-59: Replace 4-section NAV_SECTIONS with single flat list of 5 core pages + gear icon for settings
- Add `_GL_NAV_SIMPLE` feature flag (localStorage) — `true` = simplified nav, `false` = legacy
- Default: `true` for new users, existing users get migration prompt
- Band/Tools/More sections move to a "More" overflow accessible via `···` button at bottom of rail
- Gigs gets a shortcut card on Schedule page (not hidden, just relocated)

**Files:**
- `js/ui/gl-left-rail.js` — nav structure + feature flag check
- `js/ui/navigation.js` — no changes (all page keys still work)
- `app-shell.css` — spacing for simplified rail

**Risk:** Low. All pages still work. Only the nav entry points change. Feature flag enables instant rollback.

**Rollback:** `localStorage.setItem('_GL_NAV_SIMPLE', 'false')` → full nav restores.

---

### Phase 2: Tools Drawer (Days 6-10)
**Goal: ⌘K / toolbar icon opens searchable tool palette.**

**Changes:**
- New file: `js/ui/gl-tools-drawer.js` (~150 lines)
- Renders as bottom sheet on mobile, modal on desktop
- Shows all Layer 2 + Layer 3 pages as searchable cards
- Typing filters instantly (like Spotlight/Alfred)
- Each card: icon + name + one-line description
- Clicking navigates via existing `showPage()`
- Keyboard shortcut: `⌘K` or `/` when no input focused

**File inventory for drawer items:**
```javascript
var _glToolItems = [
  { key: 'gigs', icon: '🎤', name: 'Gigs', desc: 'Shows and performances' },
  { key: 'ideas', icon: '💬', name: 'Band Room', desc: 'Ideas, votes, decisions' },
  { key: 'feed', icon: '📧', name: 'Feed', desc: 'Action items and assignments' },
  { key: 'practice', icon: '🎯', name: 'Practice', desc: 'Focus songs and mixes' },
  { key: 'playlists', icon: '🎧', name: 'Playlists', desc: 'Listening and learning' },
  { key: 'pocketmeter', icon: '⏱', name: 'Pocket Meter', desc: 'Live BPM detection' },
  { key: 'tuner', icon: '🎸', name: 'Tuner', desc: 'Chromatic tuner' },
  { key: 'metronome', icon: '🥁', name: 'Metronome', desc: 'Click track' },
  { key: 'stageplot', icon: '🎭', name: 'Stage Plot', desc: 'Stage layout builder' },
  { key: 'venues', icon: '🏛', name: 'Venues', desc: 'Locations and contacts' },
  { key: 'equipment', icon: '🎛', name: 'Equipment', desc: 'Gear inventory' },
  { key: 'finances', icon: '💰', name: 'Finances', desc: 'Income and expenses' },
  { key: 'social', icon: '📱', name: 'Social', desc: 'Social media links' },
  { key: 'bestshot', icon: '🏆', name: 'Best Shot', desc: 'Performance comparisons' },
  { key: 'notifications', icon: '🔔', name: 'Notifications', desc: 'SMS and care packages' },
  { key: 'help', icon: '❓', name: 'Help', desc: 'Guides and walkthroughs' },
  { key: 'admin', icon: '⚙', name: 'Settings', desc: 'Profile, band, data' },
];
```

**Files:**
- New: `js/ui/gl-tools-drawer.js`
- `js/ui/gl-left-rail.js` — add drawer trigger button
- `index.html` — add script tag
- `app-shell.css` — drawer styles

**Risk:** Low. Additive only. No existing behavior changes.

---

### Phase 3: Contextual Surfacing (Days 11-18)
**Goal: Power tools appear at the right moment without user searching.**

**Changes:**

A. **Schedule page → Gigs context**
- When a gig event is selected on calendar, show gig details in right rail
- "View full gig" link opens gigs page for that specific gig
- File: `js/features/calendar.js` (calDayClick already shows event detail)

B. **Songs page → Practice actions**
- Add inline "Practice" button on song cards/rows
- Tapping starts practice timer for that song (from practice.js)
- File: `js/features/songs.js`

C. **Rehearsal → Best Shot access**
- In session review, add "Compare with best" link per song
- Opens Best Shot for that specific song
- File: `js/features/rehearsal.js`

D. **Home → Band activity**
- Add "Recent activity" section below Next Action card
- Sources: Firebase writes for practice, rehearsal, song ratings, gig additions
- File: `js/features/home-dashboard.js`

**Risk:** Medium. Touches multiple feature files. Each change is small and additive.

---

### Phase 4: Home Redesign (Days 19-25)
**Goal: Home answers "what's happening with my band?"**

**Layout (mobile):**
```
┌─────────────────────────┐
│ Thursday, Apr 17         │  ← Date + freshness
│                          │
│ ┌─────────────────────┐ │
│ │ 🎸 Rehearsal Tue     │ │  ← Next Action (countdown)
│ │ Run the set — 3 weak │ │
│ │ [Start Rehearsal]    │ │
│ └─────────────────────┘ │
│                          │
│ What's New               │  ← Activity stream
│ ─────────────────────── │
│ Brian practiced 3 songs  │
│ Chris rated Sugar Mag    │
│ Jay added May 10 gig     │
│ Drew locked setlist      │
│                          │
│ Band Pulse               │  ← Momentum
│ 🔥 4-day streak · 3/5    │
│ members active this week │
│ ●●●●○ last 5 sessions   │
│                          │
│ Focus Songs              │  ← What to work on
│ ┌────┐ ┌────┐ ┌────┐   │
│ │Fire│ │Sug │ │Deal│   │
│ │2.1 │ │2.8 │ │3.0 │   │
│ └────┘ └────┘ └────┘   │
└─────────────────────────┘
```

**Data sources (all existing):**
- Next Action: `_renderNextActionCard()` (already works)
- Activity: Firebase `bandPath('activity_log')` (new lightweight write-on-action)
- Band Pulse: streaks + momentum (already computed)
- Focus Songs: `GLStore.getNowFocus()` (already works)

**Files:**
- `js/features/home-dashboard.js` — restructure `_renderLockinDashboard()`
- `js/core/groovelinx_store.js` — add `logBandActivity(type, detail)` helper

**Risk:** Medium. Home dashboard is the most-rendered page. Test thoroughly.

---

### Phase 5: Mobile Bottom Tab Bar (Days 26-30)
**Goal: Native-feeling tab switching on mobile.**

**Changes:**
- On `≤ 768px`: hide left rail entirely, show bottom tab bar with 5 icons
- Tab bar: Home, Songs, Rehearsal, Schedule, Setlists
- Fixed bottom, safe-area padding, 50px height
- Active tab highlighted with accent color
- Tap = instant navigation (warm page swap)
- Tools drawer accessible via `···` icon in tab bar or top-right

**Files:**
- `js/ui/gl-left-rail.js` — add bottom bar render for mobile
- `app-shell.css` — bottom bar styles + hide rail on mobile
- `js/ui/navigation.js` — update active tab on page change

**Risk:** Medium. Changes mobile layout significantly. Left rail still works on desktop.

---

## 3. Home Redesign Detail

### What's New Feed
**Source:** New `bandPath('activity_log')` collection.
**Writes:** Whenever a user takes an action, log it:
```javascript
GLStore.logBandActivity('practice', { member: 'drew', songs: ['Fire on the Mountain'], duration: 720 });
GLStore.logBandActivity('rating', { member: 'chris', song: 'Sugar Magnolia', readiness: 4 });
GLStore.logBandActivity('gig_added', { member: 'jay', date: '2026-05-10', venue: 'Avon Theater' });
GLStore.logBandActivity('setlist_locked', { member: 'drew', name: 'May Residency Set 1' });
```
**Reads:** Last 10 entries, deduplicated, formatted as human-readable sentences.
**Display:** Scrollable list below Next Action card.

### Next Action Card (keep, refine)
- Already works well — directive, contextual
- Move below activity feed (feed answers "what happened", card answers "what to do")
- Add countdown: "Rehearsal in 2 days" / "Gig in 5 days"

### Band Pulse (keep, enhance)
- Streak display (already works)
- Member activity dots: which members were active this week
- Session trend: last 5 rehearsal ratings as dot chart

### Focus Songs (keep, compact)
- 3 cards showing weakest songs with readiness score
- Tap → opens Song Detail with Practice action

---

## 4. Mobile-First Redesign Detail

### Bottom Tab Bar
```
┌────┬──────┬──────────┬──────────┬──────────┐
│ 🏠 │  🎵  │    🎸    │    📅    │    📋    │
│Home│Songs │Rehearsal │Schedule  │Setlists  │
└────┴──────┴──────────┴──────────┴──────────┘
```
- 50px height + env(safe-area-inset-bottom)
- Active tab: accent color icon + label
- Inactive: dim icon, no label (save space)
- `···` overflow in top-right for tools drawer

### Card Layouts
Already started (setlist song cards). Extend to:
- Song list: cards instead of table rows
- Gig list: cards with date, venue, setlist link
- Rehearsal plan: cards per song with readiness

### Thumb-Friendly Actions
- Minimum 44px tap targets (already enforced on setlists)
- Swipe gestures where appropriate (future)
- Bottom-anchored CTAs (already done for setlist save)

### Preserved Shells
Already implemented:
- Warm page detection prevents white flashes
- Scroll position preserved on warm pages
- Skeleton only on cold renders

---

## 5. Keeping Features Available Without Clutter

### Floating Tools (Pocket Meter, Tuner, Metronome)
- Open as overlay/bottom sheet from tools drawer
- Keep full functionality
- Close button returns to previous page
- No nav entry needed — drawer is the entry point

### Stage Plot
- Primary access: tools drawer
- Contextual access: from gig detail on Schedule → "View stage plot"
- Keep as separate page (complex UI needs full screen)

### Charts
- Already accessible from Song Detail
- No standalone page needed

### Best Shot
- Primary access: tools drawer
- Contextual access: from Rehearsal session review → "Compare recordings"

### Equipment
- Tools drawer only
- Very low frequency — admin task

---

## 6. Settings Simplification

### Current tabs: Profile, Band, Data, Notifications, Bugs, UAT, Plan, About

### Proposed:
- **Visible:** Profile, Band, Data, About
- **Hidden behind dev flag:** UAT, Bugs, Plan
- **Merged:** Notifications settings → Band tab subsection

### Dev flag: `localStorage.getItem('gl_dev_mode') === 'true'`
- When true: show UAT, Bugs, Plan tabs
- When false: hide them
- Existing dev users: set flag in console

---

## 7. Metrics to Track

| Metric | How | Why |
|--------|-----|-----|
| DAU | Firebase `bandPath('dau/' + date)` increment on app open | Core engagement |
| Return opens | Count distinct days per user per week | Retention signal |
| Session length | `performance.now()` delta on visibilitychange | Depth |
| Feature usage | Log `showPage()` calls to Firebase | What's used |
| Navigation taps | Count in tools drawer + tab bar | Simplification validation |
| Rehearsal starts | Already tracked via agenda engine | Core workflow |
| Weekly retention | % of DAU users who return within 7 days | Health |
| Tools drawer opens | Count per session | Discovery |
| Warm page hits | [PERF] log warm vs cold | Speed validation |

### Implementation:
Add to `showPage()`:
```javascript
if (typeof GLStore !== 'undefined' && GLStore.logPageView) GLStore.logPageView(page);
```

---

## 8. Rollback Plan

### Feature flag: `_GL_NAV_SIMPLE`

| Value | Behavior |
|-------|----------|
| `'true'` | Simplified 5-page nav + tools drawer |
| `'false'` | Full legacy navigation (all 24 pages in left rail) |
| Not set | Default to `'true'` |

### Per-phase rollback:
- **Phase 1 (nav simplification):** Set flag to `false`. Instant restore.
- **Phase 2 (tools drawer):** Drawer is additive — just hide trigger button.
- **Phase 3 (contextual tools):** Each contextual link is additive — remove individually.
- **Phase 4 (home redesign):** Feature flag gates old vs new home layout.
- **Phase 5 (bottom tab bar):** CSS media query — remove styles to restore hamburger.

### Monitoring:
- If DAU drops >20% in first week → rollback Phase 1
- If session length drops >30% → investigate which pages users miss
- If tools drawer usage <5% after 2 weeks → reconsider placement

---

## 9. Top 10 Fastest Wins (Highest User-Perceived Impact)

| # | Win | Effort | Impact | File(s) |
|---|-----|--------|--------|---------|
| 1 | **Warm page navigation** (already shipped) | Done | No white flashes | navigation.js |
| 2 | **Simplify left rail to 5 items** | 2 hours | Instantly calmer | gl-left-rail.js |
| 3 | **Hide UAT/Bugs/Plan from Settings** | 30 min | Professional trust | app.js |
| 4 | **Add `···` More button to rail** | 1 hour | Access preserved | gl-left-rail.js |
| 5 | **Tools drawer (⌘K)** | 4 hours | Power user delight | new file |
| 6 | **"What's New" activity section on Home** | 4 hours | Band connection | home-dashboard.js |
| 7 | **Gigs shown on Schedule page** | 2 hours | -1 nav item | calendar.js |
| 8 | **Bottom tab bar on mobile** | 3 hours | Native feel | gl-left-rail.js, css |
| 9 | **Practice action on song cards** | 2 hours | -1 nav item | songs.js |
| 10 | **Countdown on Next Action card** | 1 hour | Urgency clarity | home-dashboard.js |

---

## 10. Final Recommendation

GrooveLinx already has the intelligence of a great product. The problem is presentation, not capability. The path from "powerful founder-built app" to "simple elite product":

**Week 1: Reduce visible complexity.**
Ship the simplified nav (5 core + `···` more). This is the single highest-leverage change. A band member opening the app should see 5 choices, not 24. Every secondary feature remains one tap away in the More menu, zero capability lost.

**Week 2: Add the tools drawer and relocate.**
Give power users `⌘K` to find anything. Move Gigs to Schedule context. This earns the right to simplify further because nothing is truly hidden — it's discoverable.

**Week 3: Make Home social.**
The "What's New" activity stream transforms Home from "what should I do" to "what's happening with my band." This is the retention play — users open the app to see what their bandmates did, not just to receive instructions.

**Week 4: Mobile-first.**
Bottom tab bar + card layouts. The app should feel like it was built for the phone in your hand at rehearsal, not the monitor on your desk.

**What NOT to do:**
- Don't delete any pages or data models
- Don't rewrite the navigation system
- Don't change the home dashboard intelligence engine
- Don't touch the rehearsal mode or live gig mode
- Don't bundle scripts yet (save for later optimization sprint)

**The soul of GrooveLinx** is the intelligence layer — the focus engine, the readiness model, the next-action card, the rehearsal analysis. None of that changes. What changes is how many doors the user has to walk past to find it.
