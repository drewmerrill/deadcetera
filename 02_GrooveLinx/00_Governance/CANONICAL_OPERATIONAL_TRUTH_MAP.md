# Canonical Operational Truth Map

*Cartography of authority and trust across GrooveLinx surfaces — 2026-05-27.*

---

## What this document is

A **descriptive inventory** of where operational truth is computed and where it is displayed, surface-by-surface, for the load-bearing authority domains. The map's job is to make divergences *visible* — both the accidental ones and the intentional ones.

## What this document is NOT

- **Not** a redesign proposal
- **Not** a consolidation plan
- **Not** an "ideal architecture" sketch
- **Not** an exhaustive line-by-line audit (it points at the load-bearing places; it does not enumerate every consumer)

The reader of the map will know what to do. The map's job is to make the choices visible.

## How to read it

Each authority domain has a section with:

1. **The authority concept** — what question this answers
2. **Computation sources** — code locations that compute "the answer"
3. **Display surfaces** — user-visible places that show it
4. **Observed divergence** — what the audit found, with evidence pointers
5. **Trust position** — when surfaces disagree, which one does the musician trust? (Where known.)
6. **Open question** — is this divergence accidental, or intentional contextual truth?

## Relationship to other governance docs

- `CANONICAL_SYSTEMS.md` (this folder) — documents what canonical authority *should be* per Stab-numbered governance decisions. It is the registry of canonical owners.
- **This map** — documents what canonical authority *currently is* in lived runtime behavior across surfaces.

Where the two agree, the map cites CANONICAL_SYSTEMS.md. Where they diverge, the map flags the gap. Neither doc proposes fixes.

## Critical reading discipline (per Drew 2026-05-27 framing)

- Do NOT assume all duplication is bad
- Do NOT assume all divergence is accidental
- Do NOT assume all truth should centralize
- Do NOT assume GLStore should own everything
- Do NOT assume one engine should absorb all logic

**Some divergence may represent intentional contextual truth.** The core question is: *when two surfaces disagree, which one does the musician trust?* — not "which source computed last?"

---

# Authority domain 1 — Recommendation ("what to work on next")

## Concept
The musical question: *what should I (or the band) work on right now?*

## Computation sources
There are **two genuinely different engines** answering two genuinely different sub-questions:

### 1a. Song-centric focus engine — `GLStore.getNowFocus()`
- **Owner:** `js/core/gl-focus.js` (extracted 2026-05-08, P1.1 phase 8 from `groovelinx_store.js`)
- **Returns:** `{ primary, list[5], reason, count }`
- **Question answered:** *which active songs need musical work?*
- **Inputs:** active songs · readiness cache · setlist membership · gig urgency · per-song priority · rehearsal-issue boost
- **Filter rule:** `avg > 0` (rated only) AND `avg < gigReadyThreshold` (4)
- **Cache:** 30s; invalidated via `invalidateFocusCache()` which emits `'focusChanged'`
- **CLAUDE.md SYSTEM LOCK 7b** protects this — "Do not bypass `getNowFocus()` with inline weak-song calculations"

### 1b. Band-coordination priority engine — `GLPriority.computeTopPriorities()`
- **Owner:** `js/core/gl-priority.js:47` (Operational Prioritization Layer Phase 1, 2026-05-25)
- **Spec:** `02_GrooveLinx/specs/operational_prioritization_layer_v1.md`
- **Returns:** up to 5 weighted priority items, deduped per `gigId`
- **Question answered:** *what should the band collectively notice right now?*
- **Five producers:**
  - `_produceGigsWithReadinessGaps` — upcoming gigs (≤21d) with weak setlist songs
  - `_produceGigsWithoutRehearsals` — upcoming gigs with no scheduled rehearsals
  - `_produceRsvpGaps` — rehearsal RSVPs not collected
  - `_produceTonightPlanNeglected` — tonight's plan songs that have been neglected
  - `_producePracticeNeglect` — songs never practiced (includes unrated songs that getNowFocus would exclude)
- **Anti-drift assertion in code:** "same gig should never surface in two competing kinds because that's exactly the simultaneous-importance syndrome GLPriority exists to prevent"

### Confused-with: `gl-decision-language.js:248` defines a *different* `window.GLPriority` exporting `forRsvpEvent` / `forAction`. Two engines, same global name, load order picks one. This collision is the **F-016 root** stabilized by the 2026-05-27 11:33 UTC null-guard hotfix. (Documented here, not proposed for fix.)

## Display surfaces
| Surface | Reads from | Renders as |
|---|---|---|
| Home dashboard "🎯 What matters most right now" hero | `GLPriority.computeTopPriorities()` (`home-dashboard.js:849 _hdRenderPriorityHero`) | Up to 3 priority rows with action buttons + "Show N more" |
| Songs page "Work on this next" card | `GLStore.getNowFocus()` (`songs.js:485-506`) | Single song with reason + Practice Now button |
| Practice page "Today's Focus" stack | `GLStore.getNowFocus()` (`practice.js:113-125`) | Numbered 1-5 list of focus songs |
| Rehearsal page "Top 5 to focus on" | `GLStore.getNowFocus()` (`rehearsal.js:556, 1355, 2227, 8669`) | Numbered list with per-song readiness |
| Calendar "Recommended next rehearsal" context | `GLStore.getNowFocus()` (`calendar.js:712, 921`) | Used in scheduling-suggestion logic |
| Avatar Guide | `GLStore.getNowFocus()` (`gl-avatar-guide.js:644-645`) | Conversational suggestion |
| Listening Bundles | internal `_getFocusSongs()` (`listening-bundles.js:67, 118`) | Bundle composition |

## Observed divergence
**F-002b (saturation audit 2026-05-27):** Three surfaces gave three different "what to work on next" answers under identical state, within minutes:
- Home → **Frankenstein** (never practiced; no readiness score)
- Songs → **One Way Out** (2.5/5)
- Practice → **In Memory of Elizabeth Reed** (1.0/5)

## Trust position
Each surface is correctly answering its own question; the divergence is real but reflects different concepts:
- Home hero serves *band-coordination notice* (includes practice-neglect candidates regardless of readiness — that's why Frankenstein surfaced)
- Songs/Practice/Rehearsal serve *active-song musical focus* (sub-gigReady, rated)

The musician's trust position is **not yet harvested.** Both questions are legitimate. The unanswered question is whether the surfaces communicate *which* question they are answering — currently the labels ("What matters most" vs "Work on this next" vs "Today's Focus") read as synonyms.

## Open question
Is the dual-engine pattern intentional contextual truth (band-context vs solo-context) that just needs surface-level disambiguation in labels and chrome? Or is one engine the more correct authority and the other should be retired? Map only — answer deferred.

---

# Authority domain 2 — Urgency / temporal framing ("tonight" vs "tomorrow")

## Concept
The temporal question: *when is the next thing happening, and how do I describe it in the UI?*

## Computation sources
Each consuming surface owns its own day-relative computation:
- **Home dashboard:** inline `isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(gig.date)` (`home-dashboard.js:4261-4268`)
- **Calendar:** inline `isToday = ds === todayStr` (`calendar.js:4271, 5157`)
- **GLPriority engine:** `_daysBetween(isoOrDateStr)` (`gl-priority.js:60-66`)
- **Feed-action-state:** `_daysUntil(dateStr)` (`feed-action-state.js:201`)
- **Rehearsal page "TONIGHT'S REHEARSAL" header:** **hardcoded literal string** (`rehearsal.js:1981`) — no temporal check at all

## Display surfaces
| Surface | Behavior |
|---|---|
| Home dashboard | Day-relative: Today→"Tonight", +1→"Tomorrow", else→short date |
| Calendar | Day-relative + month-grid `isToday` highlight |
| Rehearsal page | Always "Tonight's Rehearsal" — the literal string is hardcoded regardless of actual day |

## Observed divergence
**F-009 (saturation audit 2026-05-27):** Today = Tue May 26. Rehearsal scheduled Wed May 27.
- Home: "🎸 Rehearsal tomorrow · deadcetera Rehearsal · 2026-05-27 @ 18:00" (correct)
- Calendar: "Wed, May 27, 2026 · Tomorrow" (correct)
- Rehearsal page banner: "🔗 TONIGHT'S REHEARSAL" (incorrect — was tomorrow's)

## Trust position
Home and Calendar use real temporal computation. Rehearsal page uses an assumed context ("if you opened this page, presumably it's the day of"). The musician at rehearsal-day-minus-one reading the Rehearsal page banner will be misled.

## Open question
Is "Tonight's Rehearsal" intentionally a label for *the upcoming plan* regardless of date (a context-frame, not a temporal claim)? Or was the day-relative logic meant to be there and got dropped? Map only — answer deferred.

---

# Authority domain 3 — Readiness ("gig ready %", per-song scores, member readiness)

## Concept
*How ready is the band? How ready is this song? How ready is each member?*

## Computation sources

### 3a. Readiness band classification — `GLStatus` (`gl-decision-language.js:81-90`)
- **Canonical per `CANONICAL_SYSTEMS.md`** ("Song Readiness — Canonical Interpretation, Stab #15")
- 6 bands: `unknown / rough / learning / ready / gigReady / locked`
- Authoritative API: `GLStatus.classify(avg)`, `thresholdAtLeast`, `countByBand`, `filterByBand`, `isGigReady`, etc.
- Honored by `gl-focus.js`, `gl-priority.js`, `song-intelligence.js`, `home-dashboard.js`
- Existing intentional exception documented: `GLStatus.getSongColor()` uses 3-tier `≥3.5 / ≥2.5 / <2.5` for visual quick-scan (different from 6-band actionable taxonomy). Both correct in their domain.

### 3b. Per-song average — `GLStore.avgReadiness(title)` (`groovelinx_store.js`)
- Single source.
- Backed by `readinessCache` keyed by song title.

### 3c. Aggregate "X of Y locked" + "gig ready %"
- **Home dashboard:** `_homeAggregates(bundle)` called from FOUR sites (`home-dashboard.js:1171, 2229, 2480, 2720`). Same function, but called with potentially different `bundle` inputs and at different render times.
- **Setlist-card readiness bar:** independent computation at `home-dashboard.js:5734-5737` using threshold `_bandAvgForSong(rc[t]) >= 3` (NOT the canonical `gigReady` 4).
- **Code-comment archaeology:** lines 2238-2244 say "P0.5 (Audit #10 F4 + F9 fix, 2026-05-14): headline now uses the SAME count source as the footer (`_agg` aggregate) so the card cannot self-contradict." So a prior contradiction was already triaged.

### 3d. Per-member readiness — rendered as `B:3 C:2 D:2 J:3 P:—` on song-detail
- Source path not fully traced in this audit.

## Display surfaces
| Surface | Readiness expression |
|---|---|
| Songs page table | Per-song `4.5/5`, color-coded; band/audience tooltip |
| Song detail header | `READINESS B:3 C:2 D:2 J:3 P:—` per-member chips |
| Home "This week" card | `75% gig ready · 47/63 songs locked` |
| Home "BAND" footer card | `BAND · 35 of 42 songs locked · 4.2/5` |
| Home setlist card (next-gig) | Readiness bar per linked setlist, threshold ≥3 (not 4) |
| Rehearsal page focus | Per-song readiness in plan list |

## Observed divergence
**F-007, F-008b, F-012 (saturation audit):**
- Same page render simultaneously showed `47/63` (top card) AND `35 of 42` (bottom card)
- Across loads minutes apart with no state change: `83%` then `75%`; `35/42` then `47/63`
- "songs need work" count jumped `1 → 3` between loads

## Trust position
The per-song scores have a single canonical owner (`GLStore.avgReadiness`). The aggregate divergence comes from:
1. Different `bundle` inputs passed to `_homeAggregates` at different render times
2. The setlist-card using a different threshold (≥3) than the canonical `gigReady` (≥4)

The musician likely trusts the per-song numbers (canonical band, single source). The aggregate numbers on Home are the trust-eroding layer.

## Open question
Is the setlist-card's `≥3` threshold (instead of `gigReady ≥4`) intentional ("could play it" vs "polished")? Or is it inline-threshold drift that should route through `GLStatus.thresholdAtLeast`? Map only — answer deferred.

---

# Authority domain 4 — Route + breadcrumb

## Concept
*Where am I in the app? How do URLs map to surfaces?*

## Computation sources
- **Route dispatcher:** `window.showPage(page)` (`js/ui/navigation.js:113`)
- **Route lifecycle authority:** `GLRouteLifecycle` (per `CANONICAL_SYSTEMS.md` and `gl-runtime-health.js`)
- **`_navSeq` counter:** CLAUDE.md SYSTEM LOCK 7a — guards all 7 `GL_PAGE_READY` assignments to prevent stale async renders
- **Hash → page mapping:** convention is *lowercase* (e.g., `#stageplot` works, `#stage-plot` and `#stagePlot` silently render Home)
- **Breadcrumb:** rendered inline within each feature's render function (not centralized)

## Display surfaces
Working routes (canonical hash form → surface):
`#home, #songs, #practice, #rehearsal, #setlists, #tuner, #metronome, #playlists, #gigs, #stageplot, #venues, #contacts, #feed, #equipment, #help, #calendar, #admin`

## Observed divergence
**F-006, F-006b, F-011, F-013, F-014 (saturation audit — route-probe.json is the definitive map):**
- Five nav buttons silently render Home with stale breadcrumbs: `#schedule` (left-rail Schedule), `#bandRoom` / `#band-room` / `#bandroom` (Band Room button), `#carePackages` / `#care-packages` (Care Packages button), `#stage-plot` / `#stagePlot` (lowercase-only `#stageplot` works), `#settings` (top-bar ⚙️ actually routes `#admin`)
- After navigating Calendar → `#stage-plot`: URL says `#stage-plot`, breadcrumb still reads `Gigs / Calendar`, first heading still reads `Songs`, body renders Home content (F-013 — four UI identities visible simultaneously)
- Concept "schedule/calendar" has three names: "Schedule" (left rail), "📅" (top bar tooltip "Schedule"), "Calendar" (breadcrumb), "📅 Schedule" (page title)

## Trust position
The URL is technically authoritative (it's what `window.showPage` was invoked with). The breadcrumb lags or laminates from the previous surface. The musician likely trusts the page CONTENT first, the breadcrumb second, and barely looks at the URL.

## Open question
Why does routing convention drift exist (camelCase vs kebab vs lowercase)? Is this organic accumulation, or were canonical forms changed at some point and not all call sites migrated? Map only — answer deferred.

---

# Authority domain 5 — Restoration ("what persists across reload")

## Concept
*If I close the tab, reload, or come back tomorrow — what state do I find?*

## Computation sources
- **Hash route:** persists naturally (browser URL bar)
- **Auth + band membership:** Firebase auth + localStorage
- **Playback / focus state:** `GLStore` slice — `getNowPlaying`, `getLiveRehearsalSong`, `selectedSongId`
- **Drawer state (song-detail open):** NOT persisted — opening a song does not update URL (`#songs` stays `#songs`)
- **Session intent persistence pattern** (per memory `project_session_intent_persistence`): user adjustments persist across close/reopen + nav + reload within session, but NOT globally forever

## Display surfaces
Persistent: hash route, auth, band, focus cache (30s).
Non-persistent: song-drawer open state, scroll position, filter chips on Songs page, sort selection.

## Observed divergence
**F-020 (saturation audit):** Click a song row → drawer opens with full detail → URL stays `#songs` → reload returns to Songs list with drawer closed. Cannot share a song-detail link, cannot bookmark, cannot recover from accidental reload.

## Trust position
The musician trusts the URL = what they see. When the URL underspecifies state (drawer open), reload returns less than was there, and trust slips silently.

## Open question
Is the lack of drawer deep-link intentional (drawer = transient overlay) or accidental (drawer = primary content that should be linkable)? The drawer is the moat surface (G-006), which suggests linkability matters. Per `project_one_musical_truth` the anchor-element pattern argues for URL = entity-state coupling. Map only — answer deferred.

---

# Authority domain 6 — Shell state (chrome containers)

## Concept
*Who decides what chrome (left rail, right panel, slide menu, bottom tabs, top bar, runtime panel) is visible when?*

## Computation sources
- **`gl-shell-state.js`** — central shell state coordinator
- **CSS media queries** — `≥901px` shows left rail, `<900px` shows bottom tabs, hides hamburger (per `gl-left-rail.js:331-345`)
- **Per-component visibility classes:** `body.gl-mt-player-open`, `body.gl-onboarding-open`, etc.
- **Right context panel:** `gl-right-panel.js` — independent visibility logic; persists across pages

## Display surfaces
| Surface | Visibility rule |
|---|---|
| Top bar | Always visible |
| Left rail | `min-width: 901px` only |
| Bottom tab bar (`#glBottomTabs`) | `max-width: 900px` only — IS the iPhone primary nav |
| Hamburger button (`.hamburger`) | `min-width: 901px` HIDES; on mobile also hidden via `gl-left-rail.js:333` (because bottom tabs replaces it) |
| Right context panel | Always rendered; collapses on narrow viewports per `gl-shell.css:340-359` |
| Runtime Health panel | Dev mode only |
| Now-playing chip | Visible when `GLStore.getNowPlaying()` is set |

## Observed divergence
**F-001 (saturation audit):** Right-rail "Song context panel" close ✕ is unclickable — `#mainContent` intercepts pointer events. The affordance is present but non-functional.

**F-017:** iPad portrait — left rail correctly collapses, but right panel stays at 219px even when empty.

**F-018 RETRACTED:** Audit incorrectly claimed iPhone had no nav trigger. Bottom tab bar IS the trigger. (Investigator error documented in `feedback_audit_instrumentation_discipline`.)

## Trust position
Shell visibility is mostly governed by CSS media queries which are deterministic. The trust slip is the *unclickable close button* (F-001) — the affordance promises something the system doesn't deliver.

## Open question
Is the right context panel intended to be undismissable (always-on context)? Or was the close ✕ a real affordance that regressed? Map only — answer deferred.

---

# Authority domain 7 — Dashboard composition (Home cards)

## Concept
*Who decides which cards appear on Home, in what order, with what content?*

## Computation sources
- **Top-level composer:** `_hdRenderInternal()` (`home-dashboard.js:66`) coordinates the bundle + card rendering
- **Per-card render functions:** roughly 10+ `_render*` functions per card type
- **Bundle hydration:** Firebase reads + cache reads gathered into a single `bundle` object passed to each card renderer
- **Async hero hydration:** `_hdRenderPriorityHero(bundle)` (`home-dashboard.js:849`) runs after first paint and demotes downstream cards (sets opacity 0.55 on `.hd-left` etc.)

## Display surfaces
Home dashboard composition (top to bottom on first paint):
1. "🎯 What matters most right now" (Priority hero) — domain 1b
2. "REHEARSAL · 🎸 Rehearsal tomorrow" — domain 2
3. "BEFORE YOU GO" checklist — uses stubbed `rsvpCount` (domain 9)
4. "BAND · ADDITIONAL FOCUS AREAS" — uses `getNowFocus()` (domain 1a)
5. "This week" stats card — aggregate (domain 3c)
6. "Analyze Rehearsal Recording" CTA
7. "RECENT BAND ACTIVITY" feed widget
8. "Band Room" snippet
9. Bottom footer "BAND · 35 of 42 songs locked" — aggregate (domain 3c)

## Observed divergence
The Home dashboard is the SURFACE where most of the other domains' divergences become visible:
- Domain 1 fork between hero (GLPriority) and Additional Focus Areas (getNowFocus)
- Domain 3 aggregate-vs-footer card differences
- Domain 9 stubbed attendance count vs the rest of the product

## Trust position
The Home dashboard is the front door. When its cards self-contradict, *every other surface inherits suspicion*. This is the highest-leverage trust surface in the product.

## Open question
Should the dashboard be composed by a single orchestrator (e.g., `groovemate_action_router` or a new "Home composer") that resolves cross-card consistency? Or should cards stay independent and the dashboard accept some lag because each card serves a different question? Map only — answer deferred.

---

# Authority domain 8 — Player context ("which song is active?")

## Concept
*Across the app, "now playing" / "currently selected" / "live rehearsal song" — who owns each, and how do they relate?*

## Computation sources
- **`GLStore.getNowPlaying()` / `setNowPlaying()`** — explicit user action ONLY (per `gl-now-playing.js:9-14`)
- **`GLStore.getLiveRehearsalSong()` / `setLiveRehearsalSong()`** — set by rehearsal-mode flows
- **`selectedSongId`** — separate from both; transient selection state
- **`GLPlayerContract`** — pauseAll arbitration across 4 engines (queue, perform, study, browse) per Runtime Health
- **Now-playing chip UI:** `gl-now-playing.js` listens for `nowPlayingSongId` changes
- **Right context panel "Song context":** `gl-right-panel.js` — displays selected song's metadata

## Display surfaces
| Surface | Source |
|---|---|
| Bottom now-playing chip | `GLStore.getNowPlaying()` |
| Right context panel detail | `selectedSongId` |
| Song drawer open state | drawer-local |
| Multitrack player overlay | `gl-mt-player-open` body class |
| Rehearsal Mode active-song highlight | `getLiveRehearsalSong()` |

## Observed divergence
**F-001 implied:** the right context panel persistent presence means "selected song" is its own authority orthogonal to "now playing." Three concepts (selected / now-playing / live-rehearsal) intentionally separate per the gl-now-playing.js header comment.

## Trust position
Triangulation is intentional here. The musician opening a song to *read* the chart should not have the *now-playing audio* switch. This is documented intentional separation — likely **intentional contextual truth** rather than divergence.

## Open question
Does the user always understand which of the three "current song" concepts a given surface is showing? When the now-playing chip shows song A and the right panel shows song B, is that confusing or correctly differentiated? Map only — answer deferred.

---

# Authority domain 9 — Attendance / RSVP

## Concept
*Who has confirmed they'll be at the next rehearsal/gig?*

## Computation sources
- **Gigs page:** real source — `s.yesCount / s.maybeCount` aggregated per gig via setlist+gig RSVP data (`gigs.js:2143-2168`)
- **Home dashboard:** **STUBBED to 0** — `home-dashboard.js:2700` initializes `var rsvpCount = 0;` and line 2705 has the TODO comment `// TODO: async RSVP count from Firebase — using 0 as default for now`

## Display surfaces
| Surface | Behavior |
|---|---|
| Home "BEFORE YOU GO · Attendance confirmed (0/5)" | Always 0/5 (stubbed) |
| Gigs page per-gig card | `5 confirmed · ✅ Full lineup · ✅ Core lineup covered · ✅ All roles covered · ✅ You're In` |

## Observed divergence
**F-008c (saturation audit):** Same gig (Southern Roots Tavern, 4 days out). Home says `0/5 confirmed`. Gigs says `5 confirmed · Full lineup`.

## Trust position
The Gigs page has the real data and shows it richly (per-member status, role coverage, severity gradient). The Home dashboard has a stub. The musician trusting Home would think no one has RSVPed — opposite of reality.

This is **NOT authority fragmentation** in the architectural sense. It is a stub-with-TODO that never got wired up. A different category of finding from domains 1, 3, 4.

## Open question
None for cartography — the TODO is the open question and it sits at `home-dashboard.js:2705`. Wiring up the async Firebase read closes this. Whether to do that as a hotfix or bundle into the shell-integrity remediation pass is a Drew call.

---

# Cross-domain synthesis

## Categories of authority divergence observed

The 9 domains map to **three different categories** of divergence:

### Category A — Intentional contextual truth (do NOT consolidate without harvesting trust)
- **Domain 1 (Recommendation)** — two genuinely different engines answering two genuinely different questions
- **Domain 8 (Player context)** — three "current song" concepts intentionally separated per documented design
- **Domain 2 (Urgency)** — Rehearsal page's "TONIGHT'S" *may* be intentional context-frame rather than temporal claim

### Category B — Authority drift (single canonical owner exists; some consumers bypass it)
- **Domain 3 (Readiness)** — `GLStatus` is canonical, but the setlist-card uses inline `>= 3` threshold instead of `GLStatus.thresholdAtLeast('gigReady')`
- **Domain 4 (Route)** — `showPage` is canonical, but routing convention has accumulated three forms (camelCase / kebab / lowercase) with no redirects

### Category C — Stub / partial implementation (not a fork — just unfinished)
- **Domain 9 (Attendance)** — Home has stub; Gigs has real
- **Domain 5 (Restoration)** — drawer state simply isn't persisted; no fork

### Hybrid — Domains 3, 7
- **Domain 3 (Readiness aggregates)** has *both* category B drift AND category C re-render-timing issues
- **Domain 7 (Dashboard composition)** is where most other domains' divergences become visible; not itself an authority fork

## What the map does NOT decide

- It does not decide whether the Domain-1 dual-engine pattern should consolidate.
- It does not decide whether to wire the Domain-9 stub.
- It does not propose a redesign of dashboard composition.
- It does not name a single "shell-state authority" winner.

Those decisions are for Drew, ChatGPT, and the next session that opens with this map in hand.

## Methodology notes

- Surface evidence comes from the 2026-05-27 saturation audit (`02_GrooveLinx/uat/saturation_audit_2026-05-27/`).
- Code locations were verified by direct file inspection per `feedback_audit_instrumentation_discipline`.
- Where the map says "trust position needs harvesting," that means real-musician evidence has not yet been collected; the audit captured surface evidence only.
- This map is a single pass. It will require revision as more code is traced and as musician-trust evidence is collected.

---

## Reference index

- Source-of-truth surfaces: `02_GrooveLinx/uat/saturation_audit_2026-05-27/FINDINGS_LIVE.md`
- Existing canonical-owner registry: `02_GrooveLinx/00_Governance/CANONICAL_SYSTEMS.md`
- Operational Prioritization Layer spec: `02_GrooveLinx/specs/operational_prioritization_layer_v1.md`
- Shell Integrity Phase frame: memory `project_shell_integrity_phase`
- Coherence Stewardship discipline: memory `feedback_coherence_stewardship_phase`
- Audit instrumentation rules: memory `feedback_audit_instrumentation_discipline`
- Foundational product philosophy: memory `project_one_musical_truth`
