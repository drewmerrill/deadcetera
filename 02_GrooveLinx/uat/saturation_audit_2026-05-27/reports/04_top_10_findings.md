# Top 10 Most Load-Bearing Findings — Saturation Audit 2026-05-27

Build: `20260527-005638`

Capped at 10. Ranked by trust-layer weight × surface frequency × user-flow centrality. Selection discipline favors fewer-but-deeper items.

Full numbered findings index in `FINDINGS_LIVE.md`.

---

## 1. Home dashboard non-determinism (F-007 + F-008 + F-008b + F-008c + F-012)
Across multiple loads within minutes the Home dashboard rotates its "What matters most" answer (Frankenstein → In Memory of Elizabeth Reed → "No rehearsal scheduled"), flips its attendance count silently (✅ → 0/5), changes its songs-need-work count (1 → 3), and contradicts the Gigs page on the same gig's attendance (Home 0/5 vs Gigs 5/5). Two cards on a single render show different "songs locked" totals (`47/63` vs `35/42`).
**Trust-layer.** Front door tells five different stories.

## 2. iPhone has no visible primary-nav trigger (F-018)
Slide menu containing 32 nav links is rendered at `x=-300` off-screen. Zero visible elements call `toggleMenu()`. From iPhone chrome only Home, Calendar, Stoner Mode, Admin, and Google Drive auth are reachable. Songs / Practice / Rehearsal / Setlists / Tuner / Metronome / Playlists / Gigs / Stage Plot / Venues / Contacts / Band Room / Feed / Care Packages / Equipment / Help are **unreachable from primary chrome**.
**Trust-layer + dead-end.** Critical for a product carried to rehearsals on iPhone.

## 3. `#feed` page broken (F-016)
Console: `[Feed] TypeError: GLPriority.forRsvpEvent is not a function` at `band-feed.js:2052`. Page shows "Could not load feed. Retry". Same pattern as yesterday's Home-dashboard fix (commit `4a2fdfc1`).
**Trust-layer + dead-end.** A primary nav destination that fails on every visit.

## 4. Four left-rail nav buttons + ⚙️ silently render Home (F-006, F-006b, F-011, F-014)
`#schedule`, `#bandRoom`/`#band-room`/`#bandroom`, `#carePackages`/`#care-packages`, `#stage-plot`/`#stagePlot`, and `#settings` all silently fall through to Home with stale breadcrumbs from the prior page (F-013). Working canonical names are inconsistent: `#stageplot` (lowercase) and `#admin` win arbitrarily.
**Trust-layer.** Routing convention drift; nav advertises destinations the URL doesn't have.

## 5. Rehearsal page mislabels tomorrow as "TONIGHT'S REHEARSAL" (F-009)
Today is Tuesday May 26. Calendar and Home both correctly say "tomorrow / Wed May 27." Rehearsal page banner says "🔗 TONIGHT'S REHEARSAL" for the same event in all-caps headline.
**Trust-layer.** A band reading the Rehearsal page and prepping for today is a coordination failure.

## 6. Stale-state lamination across breadcrumb / heading / body (F-013)
After navigating Calendar → `#stage-plot`, the URL was `#stage-plot`, breadcrumb still read `Gigs / Calendar`, the first heading still read `Songs`, and the body rendered Home content. Four identities visible simultaneously.
**Trust-layer.** Touches SYSTEM LOCK 7a (GL_PAGE_READY lifecycle).

## 7. Right-rail "Song context panel" close ✕ is unclickable (F-001)
The button is visible, enabled, and stable per the accessibility tree, but `#mainContent` intercepts the click. Combined with the panel staying visible in iPad portrait at 219px even when empty (F-017), users cannot reclaim the space.
**Trust-layer.** A visible affordance that doesn't work erodes trust on every viewport.

## 8. Song-drawer open does not update URL → reload drops drawer (F-020)
Click a song row → drawer opens with full detail. URL stays `#songs`. Reloading returns to the Songs list with drawer closed. Sharing, bookmarking, and accidental-reload recovery all fail.
**Trust-layer (continuity).** Violates the anchor-element pattern.

## 9. Calendar page shows two contradictory sync indicators side-by-side (F-010)
"✓ Shared Calendar Sync — Last synced 30h ago" sits immediately above "✖ Calendar needs attention — Sign in or reconnect Google Calendar [Fix]". User cannot determine which is true without acting.
**Ground-truth violation.** Same surface, opposed signals.

## 10. Three surfaces give three "what to work on next" answers (F-002 + F-002b)
- Home: **Frankenstein — never practiced**
- Songs: **One Way Out — 2.5/5**
- Practice: **In Memory of Elizabeth Reed — 1.0/5**
Different selection rules — Home prefers "never practiced", Songs uses some hybrid, Practice ranks by lowest readiness. Reasonable each in isolation; together, the user must decide which surface to trust for the most musical-operational question the product asks.
**Trust-layer.** Picking one rule and unifying would close the cluster.

---

## Findings deliberately not in the Top 10

These were observed and logged but ranked below the cut:

- F-003 (right-panel empty-state cost) — covered indirectly by #7
- F-004 (Solo/Band mode implicit in breadcrumb) — conceptually clean once you notice it
- F-005 (TONIGHT/3-days framing on Rehearsal) — covered by #5
- F-015 (per-navigation hidden-heading DOM leak) — latent perf, not user-felt
- F-017 (iPad portrait right-panel non-collapse) — covered by #7
- F-019 (iPhone touch-target undersize) — real but recoverable
- F-021 (avatar title "tap to manage" → Google Drive auth) — copy/binding mismatch, narrow blast radius
