# Surprisingly GOOD Findings — Saturation Audit 2026-05-27

Build: `20260527-005638`

Where the system already feels unusually coherent or mature. These are the load-bearing positives — the moat surfaces.

## 1. Song-detail drawer is the moat (G-006)

Click any song row → drawer with:
- Artist tag, key picker (chromatic), BPM, lead-vocalist picker
- Per-member readiness in 6 chars: `B:3 C:2 D:2 J:3 P:—`
- 6 functional tabs: Practice / Play / Versions / Harmony Lab / Stems / Inspire
- Full chart with chords above lyrics (Allman Brothers "One Way Out" rendered live)
- **Auto-generated 4-step TODAY'S REHEARSAL PLAN** that reasons about *this* song's score, the weakest member, the vote state, and ends with a "run it start to finish" closer:
  > 1. ⚠️ Band's at 2.5 — not ready for the stage / Getting there, but the rough spots will show under pressure. 10min
  > 2. 👤 Chris is still shaky (2/5) / Drew too. The chain is only as strong as the weakest link. 10min
  > 3. 🗳 Still a prospect — should you learn it? / Cast your vote. 2min
  > 4. 🎵 Full run-through / Play it start to finish. No stops. 8min
- Below: Love (3/5 band, 3/5 audience), Structure & DNA, Notes & Discussion, Annotations, Assets & Practice

This single surface would justify the product on its own. It is mise en place at musician scale.

## 2. Rehearsal page is "prepared-for" at full depth (G-001)

Walking in, the page already knows the answer:
- "TONIGHT'S REHEARSAL: Transitions for Southern Roots Tavern" (label aside — see F-009)
- "🎤 BUILT FOR SOUTHERN ROOTS TAVERN · MAY 30 · 6 songs · 27m · Focus: 5 weak songs"
- "🎯 START HERE — Top 5 songs to focus on"
- "📋 Plan — 6 songs in plan · 27m · ▸ expand"
- "📜 PLAN CHANGE HISTORY (5)" — auditable revision trail
- "LATEST REHEARSAL REVIEW — Listen back to each song, see where the band was tight and where it got rough"
- "🎚 Ingest a multitrack recording — Walk through the X32 SD card → REAPER → upload flow in 5 steps"

Nothing here demands the musician re-establish state. Everything is offered as a ready room.

## 3. Stoner Mode is disciplined to three buttons (G-005)

Top-bar "🌿 Mode" → "🌿 Stoner Mode / For when the jam gets foggy. / WHAT DO YOU NEED RIGHT NOW?" with exactly three choices: *Practice a song / Run rehearsal / We're at the gig*, plus a "Just grab a chart →" escape hatch. No hierarchy, no submenu, no settings. Few products dare ship this kind of intent-compression; the discipline to keep it to three is the moat.

## 4. Gigs page coverage UI is unusually mature (G-004)

Per-gig: lineup completeness, per-member confirmation (✅ Confirmed / ⏳ No response), per-role coverage with severity gradient (🔴 Bass uncovered / 🟠 Keys uncovered). Inline "🎤 Go Live", "▶️ Play Setlist", "📅 Add to Google Calendar", "👥 Band Availability". A band coordinator could run logistics off this page alone.

(That this page contradicts the Home dashboard on the same gig's attendance — F-008c — only sharpens the point: the *Gigs* page is right, the *Home* page is wrong.)

## 5. Setlists page disambiguation is unusually careful (G-002)

Headline "Build Your Set" followed by:
> "The performance running order for a gig or rehearsal. (For reference / listening playlists, see Playlists.)"

Proactively kills the Setlists/Playlists naming confusion that bedevils every product in this space. Then:
- Filter tabs (All / Upcoming / Past)
- "Next Up · In 4 days · Sat, May 30, 2026" with locked status, song count, set count, anchor song
- Every row: relative-time + absolute date + lock state
- Far-past entries (Wing Café 12/14/24 = 528 days ago) render correctly

This page has the calmness the dashboard wishes it had.

## 6. Settings has a tri-state GrooveMate behavior dial (G-007)

"How hands-on do you want GrooveMate to be?" — three plainly-named choices:
- **Hands-on**: You make all the decisions. GrooveMate just suggests.
- **Balanced**: GrooveMate helps but checks with you first.
- **Hands-off**: GrooveMate runs things. You can always undo.

Explicit user control of AI accompaniment, with a one-line explanation per option and an "always undo" promise. This is the accompaniment-axis (memory: `project_accompaniment_axis.md`) made literal — *AI accompanies inside the door the user walked through.* The defaults are visible; the user gets the dial.

## 7. IA mental model is coherent on the surfaces that work (G-003)

Breadcrumb second-level categories: **Solo / Band / Tools / Gigs / Admin** — a small, learnable taxonomy. Active placements:
- Solo: Practice
- Band: Songs, Rehearsal, Setlists
- Tools: Tuner, Metronome, Playlists
- Gigs: Gigs, Stage Plot, Venues, Calendar
- Admin: Contacts, Equipment, Help

Intuitive even before reading. The concept is healthy; only the routing implementation has drifted (see F-014).

## 8. Browser back/forward correctly traverses hash routes (G-008)

Hash and content stay in sync across reload + back chains. Lifecycle survives. Auth persists. Modest but load-bearing — it means continuity is mostly an issue of *deep-link granularity* (drawer state, F-020) rather than a fundamentally broken model.

## 9. UX hesitation tracker is live in production (G-009)

Console: `[UX] hesitation: {"page":"home","duration_sec":15}` at `gl-ux-tracker.js:133`. The app already observes per-page hesitation. The infrastructure to learn from real usage is shipping — exactly what the "observe before expand" discipline depends on.

---

## Pattern

The positives cluster on the **content-and-coordination surfaces** (Songs, Rehearsal, Gigs, Setlists, Calendar) — the places where the product's job is to know things about music and coordinate humans. The negatives cluster on the **navigation-and-dashboard layer** — the shell that should orient you among those surfaces.

A musician using this product day-to-day mostly lives in the moat surfaces and the negatives are mostly chrome friction. That is the right asymmetry for a product at this stage. The shell hardening is the next pass; the core has already arrived.
