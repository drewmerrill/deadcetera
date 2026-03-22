# GrooveLinx — Current Phase

_Updated: 2026-03-22_

## Active Phase: Practice Intelligence + Setlist Authoring + SaaS Infrastructure

Build: **auto-stamped via GitHub Actions (YYYYMMDD-HHMMSS)**
Deploy: **Vercel** (auto-deploy on push to main)
Production URL: **https://app.groovelinx.com**
CI: GitHub Actions syntax validation on all branch pushes

---

## GrooveLinx Product Philosophy

**Two-layer product model:**
1. **Band Operations Layer** — calendar, availability, gigs, setlists, polls/discussions
2. **Musicianship Intelligence Layer** — Song Intelligence, Rehearsal Intelligence, Groove Intelligence

**Command Center = Band Mission Control.** Answers: "What should the band do next?"

**Navigation roadmap:** Migrate from data-module nav to workflow-based groups (Music / Rehearsal / Shows / Band / Tools).

**Out of scope:** file storage, messaging/chat, complex RBAC, email blasts, multi-band.

---

## Recently Shipped (2026-03-20 → 2026-03-22)

### Infrastructure
- Vercel hosting cutover (from GitHub Pages)
- Custom domain: app.groovelinx.com
- GitHub Actions: auto version stamping + JS syntax validation
- Update banner: reliable deploy detection for open clients
- Dev auth bypass (preview-only, not on main)

### Practice System
- Practice Command Center: Today's Practice, active filter, session launch
- Now Playing bar: auto-set on song click, persistent, ▶ Practice button
- Practice Cockpit (Listen tab): North Star + Best Shot + Lessons at top
- Inline YouTube player for North Star and search result previews
- One-click ⭐ North Star and 🎓 Lesson from YouTube/Archive/Relisten results
- Per-user lessons (each member sees their own instrument-specific content)
- Transition confidence indicator in rehearsal agenda

### Setlist System
- Song Picker: checkbox-based bulk song selection with active/library filter
- Show Builder: "All Songs" default → ✂ set break to split into sets
- Duration estimates per set and total (6 min/song)
- Set merge (↑ Merge to undo a break)
- Setlist lock/unlock with warnings, full names, and notification to locker
- Structural title guard (Soundcheck, Set 1, etc. excluded from practice logic)

### Rehearsal System
- Editable rehearsal agendas: reorder, remove, add song, add Band Business
- Transition practice units in agenda engine
- Chart scroll fix (scroll sync no longer fights manual scrolling)

### Other
- North Star: edit URL, vote from Practice Mode, race condition fix
- Stage Plot: compact grid, station model, share mode
- iPhone notch/Dynamic Island safe area fixes
- Hero splash fix for Samsung S24
- Google Places API migration to PlaceAutocompleteElement
- statusCache let→var scoping fix
- Setlist cache centralization in GLStore

---

## Next Priorities

1. Setlist authoring Phase B: drag songs between sets, per-song duration
2. Practice lessons: instrument tags + member assignment
3. Notification inbox (notifications are being stored but no UI reads them yet)
4. Store centralization: gig cache, pitch cache, calendar blocked ranges
5. GitHub Pages redirect page (retire old URL)
