# Operational Coherence Report — Saturation Audit 2026-05-27

Build: `20260527-005638`

This is a texture read of the lived environment, organized along the audit's eight dimensions. It is descriptive, not prescriptive. Mix of what feels coherent and what doesn't.

## Continuity

**Working:** Browser back/forward correctly traverses hash routes. Lifecycle teardown survives reload+back (G-008). Auth persistence across sessions is solid — Andrew Merrill stays logged in across many days. The Setlists page correctly renders far-past entries (Wing Café 12/14/24 = 528 days ago) with proper relative-time framing.

**Broken:** The single largest continuity tear is the **non-determinism of the Home dashboard** (F-007, F-008, F-008b). Across three loads within five minutes, the "What matters most right now" headline rotated between *Frankenstein → In Memory of Elizabeth Reed → "No rehearsal scheduled"*, and the "X of Y songs locked" denominator shifted from `35/42` to `47/63`. Same user. No state change between loads. The dashboard does not feel like a stable place to *return to* — each return shows a new state.

Compounding: the Rehearsal page **mislabels tomorrow's rehearsal as "TONIGHT'S REHEARSAL"** (F-009) while Home and Calendar both correctly say "tomorrow." Three surfaces, three temporal stories.

Song-detail drawers do not deep-link (F-020) — clicking Jack Straw does not change the URL, so reload drops the drawer. The "anchor element" pattern from the One Musical Truth memory is observably violated here.

## Preparedness ("Prepared For")

**Strong:** The Rehearsal page is the most prepared-for surface in the product (G-001). Walking in, you see *Tonight's Rehearsal: Transitions for Southern Roots Tavern · 6 songs · 27m · 5 weak songs · Built For…*. There is a focused Top-5 list, an editable plan, a plan-change history, the latest review, and an unobtrusive multitrack ingest CTA. A musician opening this in the parking lot 10 minutes before a rehearsal has everything in their hands.

The **song-detail drawer** (G-006) is the moat. Auto-generated 4-step practice plan that reasons about *this* song's score, the weakest member, the vote state, and ends with a "run it start to finish" closer. Per-member readiness (B:3 C:2 D:2 J:3 P:—) is visible in 6 chars. Chart, structure, notes, annotations, assets all collapse below. This is mise en place.

The **Gigs page** (G-004) surfaces per-gig lineup completeness, per-member confirmation, per-role coverage with severity gradient (🔴 Bass uncovered / 🟠 Keys uncovered) — a coordinator could run a band off this surface alone.

**Weak:** Home dashboard's "What matters most" should be the apex of preparedness but is undermined by the non-determinism above. The Calendar page sits at "Recommended next rehearsal: Monday Jun 1 / No conflicts — 5 of 5 members clear" — which IS prepared-for — yet immediately below shows two contradictory sync indicators (F-010: "✓ Last synced 30h ago" right next to "✖ Calendar needs attention — Sign in or reconnect"). Reading one resolves nothing.

## Calmness

The product is generally **calm at the surface level**. Color palette is muted greens/grays. Typography is consistent. Iconography is restrained (one emoji per nav item, repeated semantically across breadcrumbs/cards). No motion noise. No notification badges screaming for attention.

**Loud accidentally:**
- The Rehearsal page banner reading "🔗 TONIGHT'S REHEARSAL" in caps is the loudest element on that surface and it's *wrong* (F-009).
- The Calendar page contradictory sync block (F-010) creates noise where there should be a single status.
- The Runtime Health panel in dev mode is dense (~7 collapsible sections, many "yes/no" rows). Fine for dev, but it loads open by default.

## Restoration

**Strong:** Auth restores cleanly across hard reload. Hash routes restore cleanly on direct URL paste (e.g. `#calendar` lands at Calendar). Setlist data, Gigs data, Songs library all hydrate without flash.

**Weak:** Song-drawer state does not restore (F-020). The "Songs / Active vs Library / sort by Default" filter state was not tested for restoration, but the drawer case is symptomatic. Right-side panel state ("Select a song" empty default) restores correctly but is also undismissable (F-001).

## Hierarchy

The IA is conceptually healthy (G-003): a 5-bucket taxonomy (Solo / Band / Tools / Gigs / Admin) that maps cleanly onto musician intent. Breadcrumbs use this consistently on every working surface.

However the **execution leaks**:
- Same concept appears with three names — "Schedule" (left rail) vs "📅 Calendar" (top bar) vs "📆 Calendar" (breadcrumb) vs "📅 Schedule" (page title) all refer to one surface, two of them broken (F-006/F-006b).
- The left-rail nav, the top-bar nav, AND a fold-out slide menu all coexist on desktop with overlapping content. (Side-rail Schedule is broken; top-bar 📅 works.)
- "Settings" lives under `#admin` but probes `#settings` to Home (F-014).

The taxonomy itself is right. The implementation has accumulated naming drift.

## Navigation

**Desktop and iPad:** Generally works. Left rail collapsed correctly on iPad portrait. Some nav buttons hit Home (broken routes per F-014).

**iPhone:** The most severe finding of the audit. The slide menu containing the 32 navigation links is rendered at `x=-300` (off-screen) with no visible chrome trigger to open it (F-018). On iPhone, you can reach Home, Calendar, Stoner Mode menu, Admin/Settings, and Google Drive auth from the top bar — and that's it. Everything else (Songs, Practice, Rehearsal, Setlists, Tuner, Metronome, etc.) is unreachable from primary chrome. The user must either type a URL or navigate via cards on the Home dashboard. A band carrying iPhones to rehearsal cannot navigate to Songs from the top bar.

Touch targets are also undersized (F-019): top-bar buttons run 27–36px in 28–60px width — below the 44pt iOS HIG.

## Shell behavior

The shell (top bar + nav + right rail) is consistent across routes on desktop. On the broken Home-fallback routes (e.g. `#settings`), the *body* renders Home content but the *breadcrumb and heading laminate* old state from previous pages (F-013) — multiple identity layers visible simultaneously.

The Quick View overlay and Runtime Health panel are present-but-passive. Both have ✕ buttons; Runtime Health closes correctly, right context panel ✕ is click-blocked (F-001).

## Environmental trust

This is where the audit's weight settles. The product's stated moat — per CLAUDE.md and per `project_one_musical_truth.md` — is "persistent operational musical continuity." Trust is load-bearing.

**Trust holds:** Setlists, Gigs, Calendar, Rehearsal page, Song-detail drawer — these are surfaces that, taken individually, *deserve* trust. The data is rich, the framing is musician-native, the per-member coverage on Gigs is unusually mature.

**Trust slips:** The Home dashboard — the front door — is the least trustworthy surface. It contradicts itself within a single render (F-012: 47/63 in one card, 35/42 in another) and across loads (F-007, F-008, F-008b). It contradicts the Gigs page on attendance (F-008c: Home says 0/5, Gigs says 5/5). It tells a different story from Rehearsal about "tonight vs tomorrow" (F-009). For a product whose discipline rule is "a bug that DISPLAYS a stale value is HIGH priority regardless of LOC" (trust-layer triage), the Home dashboard is currently the heaviest trust load and the leakiest carrier.

The supporting surfaces are good enough that the band has been using the product through live UAT — so trust is being earned via the moat surfaces, not the dashboard. But the dashboard's job is to *be* the trust anchor, and right now it isn't.

## Net coherence read

The product feels like **two systems living in one shell**: a mature musical-operational core (Rehearsal, Song detail, Gigs, Setlists, Calendar) wrapped in a navigation-and-dashboard layer that is shedding trust. The core is the moat. The shell needs operational maintenance, not new features.
