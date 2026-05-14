# GrooveLinx — Current Phase

_Updated: 2026-05-14 19:17 EDT (build `20260514-191702`) — **Home Skeleton Coherence Fix shipped. Generic 2x2 template-flash replaced with Home-shaped skeleton; warm-cache fast path eliminates skeleton on in-session nav. No more "page rebuilding itself" perception.**_
_  · **Home Skeleton Coherence Fix** (`20260514-191702`, this commit). Drew reported: on Home refresh/navigation, a generic 2x2 dashboard-card skeleton briefly flashes before actual Home content renders. Created visual instability + "template flashing" perception inconsistent with the operational-narrative direction. **Root cause:** `_renderSkeletonHTML()` at `home-dashboard.js:5645` produced 4 equal cards in a 2-col grid (via `.home-card-grid { grid-template-columns: 1fr 1fr }` at line 5940) — shape that bore zero resemblance to the actual `_renderLockinDashboard` layout (left-column narrative + right-rail compact band-status). On EVERY cold render (refresh OR in-session navigation), the path at line 74 injected this generic skeleton before async `_homeDataLoad()` resolved. **Two complementary fixes shipped:** **(1) Reshape skeleton** — replaced 2x2 grid with Home-shaped layout: left column has primary-narrative card (~80px height, amber-tinted left border mirroring Event Risk Card chrome) + 3 focus-row pulses + 3-row activity-feed strip at opacity 0.78 (mirroring the P0.5 demoted activity wrapper); right rail has compact band-status pillar (~100px) matching `_renderBandStatusCompact` dimensions. Scoped CSS class `.gl-home-skeleton-split` with `@media (max-width:900px)` collapse so mobile gets single-column. The skeleton-to-content transition is now visually continuous — same shape, just unwrapping. **(2) Warm-cache fast path** — at top of `_hdRenderInternal`, before the skeleton injection branch, check if `_homeBundle` is fresh (within 5-min TTL) AND the container is currently cold (empty). If both, render synchronously from the cached bundle (same path as `refreshHomeDashboard`) and skip the skeleton entirely. Eliminates flash for in-session navigation (most-common case: user clicked away to Songs/Setlists then tapped Home again). Try/catch wrapper falls through to the normal skeleton-then-async path on any cache-render error. **True cold loads** (browser refresh, fresh page load) still show the skeleton — but the Home-shaped skeleton now feels like loading instead of rebuilding. **1 JS file touched** (`home-dashboard.js`); `node -c` clean. Build atomic to `20260514-191702`. **No SYSTEM LOCK touches.** No routing change. No data-load redesign. ~75 LOC across 2 surgical changes. **Result:** the user no longer sees a generic dashboard template flash before Home content arrives. Home appears either instantly from cache (warm path) OR fades cleanly from a Home-shaped skeleton (cold path)._

_Previous: 2026-05-14 19:09 EDT (build `20260514-190908`) — **Pre-Tester Home Coherence Pass (P0.5) shipped. Narrative compression — unified Event Risk Card absorbs Next Action when an upcoming event exists; scope-chip vocabulary live; metric explainability replaces abstract scores; What's New demoted. No engine merges, no architecture rewrite.**_
_  · **Pre-Tester Home Coherence Pass (P0.5)** (`20260514-190908`, this commit). Reduces ADHD/cognitive-overload feeling on Home without major architecture changes. Implementation derives from Reality Audit #10 P0 plan (4 surgical fixes) **expanded to include the unification logic** that absorbs competing-recommendation surfaces. **(1) New `js/ui/gl-scope-chip.js`** — tiny helper module (~70 LOC) exposing `GLScopeChip.render(scope)` for 5 scopes: `you / band / rehearsal / gig / schedule`. Color-coded pill, inline at start of headline, CSS injected on first use. Loaded after `gl-left-rail.js` in both `index.html` + `index-dev.html`. **(2) Unified Event Risk Card** — `_renderEventRiskCard` in `home-dashboard.js:2429` now pulls actual weak song TITLES (not just a count) via `_homeAggregates.activeSongs` filtered to `avg > 0 && avg < 3` and sorted lowest-first; surfaces top 3 named songs + "(+N more)" suffix. Adds `[REHEARSAL]` or `[GIG]` scope chip to headline. Standard risk card (>24h events) now includes a "▶ Run focused rehearsal →" recommended-next CTA absorbing the role previously played by the separate Next Action Card. **(3) Competing-card suppression** in `_renderLockinDashboard`: when `_riskCard` renders, `_renderNextActionCard` is suppressed (single primary narrative), Focus Songs section relabels to "Additional focus areas" + opacity 0.65 with `[BAND]` chip on label (visual demotion), "N/5 aligned" detached count is hidden (per Audit #10 F10 doctrine — detached polling adds noise), Smart Nudge is suppressed (subsumed by risk-card narrative). All suppressions are conditional — when no risk card renders, these surfaces return to view. **(4) Metric explainability + count-disagreement fix** — `_renderBandStatusCompact` headline switches from `sc.healthSummary` ("1 needs attention" using avg ≤ 2) to operational copy ("N of M songs locked" using `_agg.lockedCount` / `totalActive`). Both headline and footer counts now derive from the SAME `_homeAggregates` source — the "1 needs attention vs 2 need work" Audit #10 F9 disagreement cannot occur. `sc.healthColor` is still used for severity color. `[BAND]` chip prepended. **(5) Smart Nudge scope chips** — added `scope: 'you'` to practice-recency nudge (reads `localStorage.gl_last_practice_ts` — personal-device data) and `scope: 'band'` to readiness-drop nudge (reads `_aggDr.activeSongs` — band-aggregate data). Chip rendered before nudge text. **(6) What's New demotion** — activity-feed slot wrapped with `opacity: 0.78` + softer section label "Recent band activity" (replaces implicit "What's New" framing). Visually subordinate to operational cards. **Build atomic** across 4 sources to `20260514-190908`. **2 JS files touched** (`home-dashboard.js`, `gl-scope-chip.js` new); both pass `node -c`. **HTML files updated** to wire the new script tag. **No SYSTEM LOCK touches.** No `getNowFocus` modification. No engine merges. No nav redesign. No scoring-architecture change. **Estimated LOC: ~180 LOC across 6 distinct surgical changes.** All Audit #10 P0 items addressed plus the unification logic from Drew's P0.5 directive (suppress NBA, demote Focus Songs, gate detached counts). **Pre-Tester safety check:** the cache-null defensive logic from Trust-Hardening Fix #15 is preserved intact — the new weak-song iteration runs from `_homeAggregates(bundle).activeSongs` which is always populated when allSongs is. **Result:** when an upcoming event exists (the high-priority case for Tester #1), Home now shows ONE unified narrative — scope chip + named at-risk songs + recommended next action — instead of a stack of independent recommendation cards._

_Previous: 2026-05-14 18:00 EDT (build `20260514-174732`) — **Reality Audit #10 — Home Page Intelligence Hierarchy shipped. Read-only architecture audit. No code change. Maps Drew's 10-finding "Ops Review" critique to file:line evidence + 4 root causes + proposed target architecture + phased P0/P1/P2 plan.**_
_  · **Reality Audit #10 — Home Page Intelligence Hierarchy** (`20260514-174732`, this commit). Triggered by Drew's "Ops Review" identifying that Home behaves "busy-smart" instead of "guided-smart." Audit maps all 10 of Drew's findings to actual code: (1) risk card lacks song specificity (`home-dashboard.js:2469-2470`), (2) scope confusion in CTA labels (`home-dashboard.js:836-877`), (3) three stacked recommendation engines (`getNowFocus` / `GLInsights.getNextAction` / `_renderSmartNudge`), (4) unexplained "73% gig ready" (`home-dashboard.js:1995-2008`), (5) "dropped in readiness" without scope, (6) hierarchy-not-placement issue on Recording Analyzer, (7) activity feed narrowness (only 8 event types in `_FEED_PRIORITY`), (8) Band Room placement among decision systems, (9) **"1 needs attention" vs "2 need work" — THREE different readiness thresholds across modules** (`avg < 4` in gl-focus.js:92, `avg < 3` in home-dashboard.js:408-438, `avg <= 2` in home-dashboard.js:2237-2242), (10) "1/5 aligned on Focus" detached from origin (`home-dashboard.js:1620` reads localStorage with no back-pointer). **Identifies 4 cross-cutting root causes** (no single readiness source · no scope vocabulary · independent recommendation engines · flat visual priority) — explains all 10 symptoms. **Proposes target architecture:** "One Primary Narrative per visit, then supporting intelligence" → 4-tier system (TIER 1 primary narrative / TIER 2 recommended now / TIER 3 operational context / TIER 4 activity stream). Worked example for Drew's own Sunday-rehearsal scenario showing how same intelligence becomes guided-smart rather than busy-smart. **Proposes canonical `GLReadinessModel` module** with 5 named states every consumer reads from. **Proposes scope-chip vocabulary** ([YOU] / [BAND] / [REHEARSAL] / [GIG] / [SCHEDULE]). **Phased plan:** P0 pre-tester (4 surgical fixes ~150-250 LOC, single commit, low risk — DO NOT ship until tester #1 onboarding outcome reviewed); P1 first 30 days (readiness model + chip system + tier CSS — gated on real tester signal); P2 future (engine consolidation + narrative composition — touches SYSTEM LOCK gl-focus.js, requires careful migration). **6 open questions** flagged for Drew + Tester #1 to resolve before P1. **8 explicit non-goals** documented (no big-bang rewrite, no tutorials, no scoring-algo change, no Feed/Band-Room merge, no Song Detail touch, no new dependencies, no SYSTEM LOCK piercing, no AI narrative-composition commit pre-validation). **Verdict:** codebase not broken; architecture incomplete — narrative layer missing atop solid data foundation. Severity Medium-High (trust + onboarding + retention impact). **Code is untouched.** Audit cross-references: `11_PRODUCT_NARRATIVE.md` (anchor surfaces), `13_TABLE_STAKES_VS_DIFFERENTIATORS.md` (Category B amplify), `08_PROMOTION_BACKLOG.md` (Ideas/Feed defer), CLAUDE.md §7 SYSTEM LOCK, Reality Audit #09 (data-trust layer), Trust-Hardening #15 (same family). **Recommended next step:** onboard Tester #1 per BETA_ONBOARDING_RUNBOOK.md; observe whether testers hit any of these 10 findings; if 2+ confirmed → schedule P0 (small targeted commit, not architecture work); P1 only after BETA_FEEDBACK_QUEUE.md gives signal._

_Previous: 2026-05-14 17:47 EDT (build `20260514-174732`) — **Trust-Hardening Fix #15: Home Hero rehearsal-risk false-positive closed. "No rehearsal in 2+ weeks" no longer fires when the sessions cache hasn't loaded yet. Defensive copy rule added.**_
_  · **Trust-Hardening Fix #15 — Home Hero Rehearsal-Risk Insight Truthfulness** (`20260514-174732`, this commit). Drew reported: Home Hero showed `⚠️ Rehearsal in 4 days is at risk · 3 songs below ready · No rehearsal in 2+ weeks` despite the band having rehearsed 5/11 (3 days ago). Damaging trust because the claim is factually false. **Root cause:** `home-dashboard.js:2473-2480` (`_renderEventRiskCard`) read `_rhSessionsCache` synchronously. The cache starts as `null` and only populates after `_rhLoadSessions()` is awaited — which happens lazily when the user visits the Rehearsal page. On cold Home loads (user hasn't navigated to Rehearsal yet) the cache is null. The silent try/catch collapsed null-cache and stale-cache into the same fall-through, firing a false positive. The 5/11 session exists in Firebase but isn't visible to the synchronous reader. **Fix:** distinguish three explicit states at the read site — (a) cache populated + latest > 14d → factually true claim shown as "Last rehearsal was N days ago" (specific, verifiable); (b) cache populated + zero entries → "No rehearsals logged yet" (factually verifiable); (c) cache null/unavailable → SUPPRESS the risk line entirely AND fire-and-forget `_rhLoadSessions()` so the next render has real data. Per Drew's explicit directive: "Never allow insight text that can be interpreted as factually false at band level." Silence is better than false claim. **Sweep:** confirmed two parallel rehearsal-recency sites are already defensively guarded — `home-dashboard.js:3138` (`scData.latest` gate) and `gl-avatar-guide.js:487` (`rehearsalsThisWeek === 0` only computed when cache is truthy). No other false-claim sites found. **Scope:** ~30 LOC in `js/features/home-dashboard.js`. No SYSTEM LOCK touches. No scoring-architecture change. Build atomic across 4 sources. node -c passes._

_Previous: 2026-05-14 16:00 EDT (build `20260514-160056`) — **Contextual Confidence Pass shipped. Empty-state copy improvements on Band Feed, Best Shot, Harmony Lab, Band Room, Stage View + Prep-for-Gig "what next" cue. Lightweight; no structural change.**_
_  · **Contextual Confidence Pass** (`20260514-160056`, this commit). Pre-tester empty-state + reassurance pass. Audit ran across 11 named surfaces; 4 already had strong specific empty-state copy (Songs / Playlists / Rehearsal / Practice); 5 had weak generic copy + 1 transition lacked a "what next" cue → all 6 improved with surgical edits. **(1) Band Feed first-load empty state** — was "No items match this filter."; now distinguishes filter-empty from first-load-empty. First-load state renders: "Nothing in the feed yet — Recent band activity ... will show up here. Use the box above to post your first note, or check Band Room for decisions and proposals." Inline link to `#ideas`. **(2) Best Shot North Star empty state** — was "No reference yet"; now "The canonical version" + sub-copy "A Spotify / YouTube link the band is matching to" + button "+ Add Reference". Explains what North Star IS rather than its absence. **(3) Best Shot recording empty state** — was "No recording yet"; now "The band's strongest take" + sub-copy "Upload a rehearsal/recording the band votes as best". Explains the surface. **(4) Harmony Lab takes empty state** — was bare "No takes yet" / "No reference take"; now action-oriented "Record yourself practicing the part — takes save here so the band can hear how it's coming along." for My Takes and "The canonical take the band is matching to. (None set for this song yet.)" for Band Reference. Both line-height 1.5 for legibility. **(5) Band Room empty state** — was "No ideas yet. Be the first to suggest something."; now reframed: "Nothing to decide yet — Ideas, song suggestions, and proposals the band needs to vote on or talk through — they live here. Post one above to start the discussion." **(6) Stage View no-setlist** — was error-toned "No setlist selected. Please choose..."; now operational: "Pick a setlist to perform first — head to Setlists, then hit the ▶ Live Gig button on the one you're playing." Inline link. **(7) Prep-for-Gig success → Stage View cue** — success status text upgraded with reassurance ("Safe to use at the venue without wifi") + toast now reads "Ready for gig — N songs offline. Tap ▶ Live Gig when you're ready to play." 6-second duration. **6 JS files touched** (`band-feed.js` / `bestshot.js` / `harmony-lab.js` / `band-comms.js` / `live-gig.js` / `setlists.js`); all pass `node -c`. Build atomic across 4 sources to `20260514-160056`. **No tutorial system, no modal walkthroughs, no product tour, no tooltip overload.** All changes are inline empty-state strings or status-text updates — feel like "a good bandmate quietly helping," not "software training." Mobile-first verified: every change is short copy with sensible line-wrapping; no new UI elements, no clutter. **Remaining hesitation risks (deliberately NOT addressed):** Practice page emerging state (don't over-promote half-built surface), Workbench hidden by design, lens density (subtitle pass already partially mitigated), three-rehearsal-entry-points (now observable via counter from prior pass). These wait for real BETA_FEEDBACK_QUEUE.md signal. Codebase is now in its strongest emotionally-prepared state for tester #1 onboarding._

_Previous: 2026-05-14 15:50 EDT (build `20260514-155010`) — **Beta Semantic Clarity Pass shipped. Lightweight subtitle/copy clarifications on Playlists, Setlists, Feed, Band Room + rehearsal-entry observability counter. No structural change.**_
_  · **Beta Semantic Clarity Pass** (`20260514-155010`, this commit). Pre-tester mental-model tightening. ALL changes are surgical copy edits or pure observability — zero structural change, zero merges, zero feature churn. **(1) Playlists vs Setlists clarification** — Playlists page subtitle replaced with `"For rehearsal listening, learning, and reference — not the gig running order. Use [Setlists] when it's time to perform."` (includes inline link to `#setlists`). Setlists subtitle replaced with mirror copy: `"The performance running order for a gig or rehearsal. (For reference / listening playlists, see [Playlists].)"`. Reduces the Spotify-style "playlist = running order" mental-model collision that's the most-predicted tester confusion. **(2) Feed vs Band Room clarification** — Band Feed gl-page-sub upgraded from poetic `"What's waiting. What changed."` to interpretable `"Recent band activity — what's waiting, what changed, what's decided. (Discussion + proposals live in [Band Room].)"`. Mirror clarifier on Band Room: `"Decisions, polls, and proposals — the space for deciding things together. (For the recent-activity stream, see [Feed].)"`. Each page's subtitle explicitly references the other, eliminating the "where does this kind of thing go?" ambiguity per `15_POSITIONING_AND_ADOPTION.md` Part I §4. Feed positioned as operational-activity-stream; Band Room as decisions/proposals surface. Neither is chat. **(3) Lens guidance** — verified Harmony Lab label + tooltips from prior pass still in place; no change. **(4) Rehearsal entry observability** — `renderRehearsalPage()` in `js/features/rehearsal.js` now records every entry into `localStorage.gl_rehearsal_entry_stats` keyed by `window._glRehearsalEntrySource` (default `'direct'`). Home dashboard tagged: `_hdShowRehearsalPreview()` sets source `'home-quickstart'`; all `_cta.onclick` strings calling `showPage('rehearsal')` upgraded to `"window._glRehearsalEntrySource='home-cta';showPage('rehearsal')"` (replace-all, 7 sites). Console helpers exposed: `window._glGetRehearsalEntryStats()` / `window._glClearRehearsalEntryStats()`. Pure observation — zero behavior change. Drew can query during tester sessions to learn which path users naturally choose. **Lightweight ONLY:** no merges, no route changes, no nav redesign, no Song Detail overhaul, no rehearsal-path removal. Build atomic across 4 sources: `version.json` + `index.html` + `index-dev.html` + `service-worker.js` = `20260514-155010`. All 6 touched JS files pass `node -c`. **Unresolved conceptual risks (deliberately NOT addressed pre-tester):** lens density (6 lenses), three-rehearsal-entry-points (still all 3 paths work — now instrumented for observation), Practice page emerging state, Workbench hidden. These wait for real BETA_FEEDBACK_QUEUE.md signal before convergence decisions._

_Previous: 2026-05-14 15:18 EDT (build `20260514-151844`) — **Beta-Readiness Execution Pass shipped. Five real code changes + Bug #8 closed + Stage-Plot reclassified KEEP across Operator Manual. First-tester onboarding gates are now clear.**_
_  · **Beta-Readiness Execution Pass** (`20260514-151844`, this commit). The first net code-touching pass since the Operator Manual analysis cycle. Five targeted changes, all small, all defensible, no SYSTEM LOCK touches. **(1) HIDE pass** — `js/ui/gl-left-rail.js` NAV_MORE reduced: pocketmeter / bestshot / finances / social removed from primary nav. Routes + renderers + `_HASH_VALID_PAGES` + `_glPageScripts` all preserved → URL access still works. Stage Plot reclassified **KEEP** (active Deadcetera workflow) — explicitly NOT hidden. social.js NOT deleted (held back per "destructive deletion only if verified orphan"; it's still registered + has render function). Admin page stays as-is — sensitive tabs (Bugs / UAT / Plan) already gated behind `gl_dev_mode==='true'`; non-sensitive tabs (Profile / Band / Data / About) are appropriately visible to all users. **(2) Bug #8 fix** — `js/features/bestshot.js` `_chopLoadSavedTimeline()` reworked from the silent early-return pattern to truthful semantics. The picker now lists saved timelines EVEN WHEN no audio is loaded; if user picks while audioless, a clear `alert()` surfaces label + segment count + the original `sourceUrl` + how to attach (paste URL into ✨ Analyze on Server). Approach combines bug_queue's Option A (show picker first) with Option C's source-URL surfacing. No silent failures. **(3) Harmony Lab promotion** — `js/features/song-detail.js` `SD_LENSES_FULL[3]` label changed `'Harmony'` → `'Harmony Lab'`. Lens picker render adds `title=`/`aria-label=` tooltips for ALL 6 lenses (Practice / Play / Versions / Harmony Lab / Stems / Inspire) — first-time discoverability tip on desktop hover + screen-reader access on mobile. **(4) Default lens = Play (band)** — `_defaultTab = 'learn'` → `'band'`. Users now land on the chord chart (the strongest first impression per `11_PRODUCT_NARRATIVE.md`) instead of the guided Practice surface. Other lenses populate lazily on first switch (existing pattern). **(5) Feed positioning copy** — `js/features/band-feed.js` composer placeholder `"Share something with the band…"` → `"Add a note or update for the band…"`. Surgical 1-string change; reinforces operational-activity-stream positioning per `15_POSITIONING_AND_ADOPTION.md` Part I §4 (NOT a chat replacement). Comment block updated. **Docs updated:** `07_CUTLIST.md` (HIDE pass shipped + Stage Plot reclass), `02_FEATURE_CATALOG.md` + `03_PAGE_GUIDE.md` (Stage Plot EMERGING → MATURE), `09_MVP_VS_EXPERIMENTAL.md` (Stage Plot out of D-tier), `13_TABLE_STAKES_VS_DIFFERENTIATORS.md` (Stage Plot out of E.7), `11_PRODUCT_NARRATIVE.md` (×2 Stage Plot reclass strikes), `15_POSITIONING_AND_ADOPTION.md` (Stage Plot removed from HIDDEN list), `02_GrooveLinx/uat/bug_queue.md` (Bug #8 closed; queue now empty), `02_GrooveLinx/notes/uat_bug_log.md` (Bug #8 entry added). Build atomic across 4 sources: `version.json` + `index.html` + `index-dev.html` + `service-worker.js` = `20260514-151844`. All 5 touched JS files pass `node -c`. **Most-important result:** the first-tester onboarding path is now visibly cleaner (4 fewer mystery nav entries) without losing power-user optionality (all routes still URL-reachable). Bug #8 closed before tester #1. Harmony Lab is discoverable via a clearer label. Chart-first landing on Song Detail. Feed reads operational. Codebase is now meaningfully more beta-confident._

_Previous: 2026-05-14 15:30 EDT (build `20260514-142926`) — **Operator Manual Phase 2 Addendum shipped. Four new docs adding competitive-convergence + migration-risk analysis, anchored on the existing `notes/competitive_matrix.md` inventory. No code change.**_
_  · **Operator Manual Phase 2 Addendum — Competitive Convergence + Migration Risk** (`20260514-142926`, this commit). Strategic-decision layer built ON TOP of the existing competitive matrix at `02_GrooveLinx/notes/competitive_matrix.md` (which stays canonical as raw market inventory). Four new docs under `02_GrooveLinx/OPERATOR_MANUAL/`: **`12_MIGRATION_RISK_ANALYSIS.md`** — per-workflow LOW/MED/HIGH risk classification across 9 workflows (Onboarding/Rehearsal/Setlists/Charts/Playback/Scheduling/Rehearsal Review/Harmony/Recordings); each assessed for migration friction + user fear + missing-feature concern + real-vs-perceived blocker + operational workaround; aggregate post-mitigation score: 7 LOW · 2 MEDIUM · 0 HIGH; 5 highest-leverage mitigations identified (Bug #8 fix / Harmony header / pre-provisioning filter / archive framing / sample seeding). **`13_TABLE_STAKES_VS_DIFFERENTIATORS.md`** — 5-category strategic framework (A stabilize · B amplify · C integrate · D avoid · E reduce) with 8+8+6+10+9 = 41 surfaces classified across all five; implies "next 3-6 months should be 80% reduce + 15% amplify + 5% stabilize + 0% scope-expansion." **`14_COMPETITIVE_WORKFLOW_MAPPING.md`** — operator-level REPLACE/INTEGRATE/PARTIALLY-SUBSUME/IGNORE decisions for 15 external categories (BandHelper-class / tab libraries / Moises-class / file storage / music services / standalone setlists / calendars / band chat / DAWs / practice tools / DIY wikis / band websites / live rig hosts / sheet readers / MIDI-lighting triggers); tally: 3 REPLACE · 4 INTEGRATE · 2 PARTIALLY-SUBSUME · 6 IGNORE; explicit anti-parity discipline. **`15_POSITIONING_AND_ADOPTION.md`** — synthesis of Phases 4-7: (I) "What GrooveLinx Should NOT Try To Be" — 10 explicit non-categories with reasoning; (II) Minimum Viable Adoption Package — A/B/C/D/E behavioral requirements, with conclusion "minimum-viable bar is MET TODAY for a correctly-selected first band"; (III) Demo Narrative — 30-sec / 2-min / strongest migration argument / wow workflow / biggest blocker / easiest category win / weakest gap (Soundslice notation depth, correctly NOT pursued); (IV) Recommendations R1-R7 — stabilize / acceptable-weak / overbuilt / under-promoted / fear-generators / integration-strategy / switching-narratives-per-source-tool. **Strategic anchor saved as memory** `feedback_competitive_strategy_lens.md`: 5-category framework + "integrated beats replaced" principle + "rehearsal+performance operational confidence is the real category, NOT band management" + explicit never-parity-chase rule. **Anchors on existing matrix; does not duplicate inventory.** Reaffirms positioning: "The thin band-context layer that orchestrates the tools your band already uses." **Code is untouched.** No new feature work. No SYSTEM LOCK touches. No A2P. No nav changes. Codebase still mode-B ready. Most-important strategic finding: **no new features are required for minimum-viable adoption** — the work shifts to operator discipline + friction reduction + communication framing._

_Previous: 2026-05-14 15:00 EDT (build `20260514-142926`) — **Operator Manual Phase 2 shipped. Five new docs converting the Phase 1 inventory into product-convergence guidance. No code change.**_
_  · **Operator Manual Phase 2 — Product Convergence Guidance** (`20260514-142926`, this commit). Built on Phase 1's descriptive inventory to deliver prescriptive product-clarity work. Five new docs under `02_GrooveLinx/OPERATOR_MANUAL/`: **`07_CUTLIST.md`** — per-surface DELETE / HIDE / QUARANTINE / KEEP INTERNAL / PROMOTE LATER recommendations across 5 tiers (1 DELETE candidate `social.js` + 6 HIDE candidates + 2 QUARANTINE candidates + 5 KEEP INTERNAL operator surfaces + 5 PROMOTE LATER deferrals); explicit "remove from nav" vs "delete from repo" distinction; single-commit cleanup sequencing block estimated at ~50-200 LOC. **`08_PROMOTION_BACKLOG.md`** — 8 D-tier candidates evaluated against 4-criterion promotion bar (strengthens thesis / clear persona / one-job-per-screen / nameable blockers); priority queue ranks Harmony Lab visibility (S effort, HIGH payoff) and Ideas→Feed collapse (S-M effort) as top promotions; explicit anti-recommendation for Pocket Meter (§3) and Multitrack visibility (§7). **`06_BETA_LAUNCH_CHECKLIST.md`** — real launch-gate with 13 sections: Operational / Onboarding / Mobile / Playback / Rehearsal / Prep for Gig / Runtime Overlay / Feedback Capture / Rollback / Known-Risk Acknowledgment / Nice-to-have / Post-beta / Sign-Off; every REQUIRED item verifiable in <5min; explicit "if a REQUIRED item drops below ✓, pause new tester onboarding" gating rule. **`10_FUTURE_ROADMAP.md`** — 10 high-confidence directions only (Mode-B Phase 2 / Multi-Band / MusicXML / Rehearsal Intel maturation / Practice closure / Mobile hardening / Playback reliability / Workflow simplification / Rehearsal→Review loop flagship / Beta Ops maturation); inclusion-rule requires deferred-commit, tester-pain pattern, OR identified blocker basis; explicit exclusion list (no AI-chord-synth, no cross-band, no video, no AR/VR, no monetization). **`11_PRODUCT_NARRATIVE.md`** — 3 sections collapsing Phase 2 §5–§7: **(I) What GrooveLinx Actually Is** — clearest product story ("where bands lock in" — 40-word pitch), strongest workflow story (Prep-for-Gig→Stage-View-at-venue), strongest emotional value ("not having to remember"), strongest differentiator triad, 7 narratives that should disappear from demos, 3 anchor surfaces every demo must hit. **(II) Demo Path Definition** — 3-min cold demo (7-step walkthrough), 40-min real-tester onboarding path (5 phases), mobile-first flow (8 steps), 8 confusion traps with mitigation. **(III) Recommendations** — top 5 to hide, top 5 to emphasize, most emotionally compelling workflow, most dangerous cognitive-overload area (Song Detail's 8 lenses), most likely onboarding confusion, most likely "wow" moment (Stage View on phone with their own band's data), best flagship-feature candidate (closed rehearsal→review→practice loop); appendices of demo phrases that land vs phrases that don't. **Code is untouched.** No new feature work. No SYSTEM LOCK touches. No A2P. No nav-table changes (that's a follow-up Cleanup commit, not this docs commit). Build untouched. Codebase still mode-B ready. Phase 2 closes the descriptive→prescriptive arc: Drew can now decide what GrooveLinx actually IS, what to hide, what to promote, what to ship before tester #1._

_Previous: 2026-05-14 14:30 EDT (build `20260514-142926`) — **Operator Manual Phase 1 shipped. Eight new docs reconstructing GrooveLinx from the musician/operator perspective rather than the code perspective. No code change.**_
_  · **Operator Manual Phase 1** (`20260514-142926`, this commit). New `02_GrooveLinx/OPERATOR_MANUAL/` directory with 8 deliverables. **`00_PRODUCT_STORY.md`** — plain-English product purpose: who it's for (5 personas), 5 emotional goals, 5 differentiators, strongest/weakest workflow rankings, honest fragmentation notes. **`01_CORE_WORKFLOWS.md`** — 12 musician-facing workflows (onboard / prep rehearsal / run rehearsal / review rehearsal / prep gig / harmony / practice / setlist / review recordings / playback / intelligence / scheduling) documented as ideal flow + current reality + friction points + maturity. **`02_FEATURE_CATALOG.md`** — ~95 named features in 16 domain tables with CORE/MATURE/EMERGING/EXPERIMENTAL/DORMANT/DEPRECATED maturity tags. **`03_PAGE_GUIDE.md`** — every visible route (26 user-visible + 2 hidden = 28 total) pulled from `js/ui/navigation.js` `pageRenderers`+`_HASH_VALID_PAGES`, each with purpose / actions / maturity / daily-use rating. **`04_USER_JOURNEYS.md`** — by persona: leader (Drew) / drummer (Jay) / bassist (Brian) / harmonist (Pierce) / beta tester. **`05_HIDDEN_SYSTEMS.md`** — 17 hidden/dark-matter surfaces (gated FAB, runtime overlay, console-only diagnostics, no-nav admin/workbench, ops-rotation procedures) classified by access type. **`09_MVP_VS_EXPERIMENTAL.md`** — every surface classified A (beta-required) / B (beta-helpful) / C (operator infrastructure) / D (roadmap-aspirational) / E (cuttable-today); 63 surfaces tracked. **`GROOVELINX_SYSTEM_MAP.md`** — ASCII map of high-level topology + state layer + audio arbitration + rehearsal pipeline + setlist→gig pipeline + onboarding flow + stem job lifecycle + feedback/observability + Runtime Health Overlay + external integrations + file-level entry points + read order. **Code is untouched.** No new feature work. No SYSTEM LOCK touches. No A2P. Pure product cognition recovery — Drew now has a single read-order for re-orienting after any pause._

_Previous: 2026-05-14 11:00 EDT (build `20260514-142926`) — **Beta Ops Task #01 — onboarding runbook drafted. No code change. Ready to onboard first real founding-member tester whenever Drew picks one.**_
_  · **Beta Ops Task #01 — First Founding-Member Onboarding Runbook** (`20260514-142926`, doc-only commit). New `02_GrooveLinx/BETA_ONBOARDING_RUNBOOK.md` codifies the step-by-step procedure: pre-provision checklist (tester picks, duplicate-band check, slug uniqueness), Firebase provisioning (single-shot meta+members write, Cloud Function mirroring, sanity-check snippet), tester instructions (copy-paste-ready message including the `gl_beta_feedback='1'` localStorage flip), first-session test script (sign-in → home → songs → song detail → playback → feedback FAB → mobile checks), Drew observer checklist (real-time feedback inbox snippet, Runtime Health Overlay collection, console-error triage), success criteria (8 verifiable lines), rollback/rescue plan (4 escalation tiers), next-decision gate (A onboard more / B build Phase 2 redemption / C fix friction first). Every Firebase snippet single-line + pbcopy-friendly. Server-side stem cancellation confirmed live (`cancelled:'remote'`) — worker is deployed and ready. **Code is untouched.** Confirmed by Drew: `wrangler deploy` succeeded, `/stems/cancel` returns `{success:true, cancelled:'remote'}` end-to-end._

_Previous: 2026-05-14 10:29 EDT (build `20260514-142926`) — **Beta Operations Enablement shipped. Mode-B Phase 1 ready for controlled founding-member onboarding.**_
_  · **Beta Operations Enablement** (`20260514-142926`, this commit). Phase 1: softer onboarding gate UX (welcome overlay with mailto-Drew invite path replaces hard-block kick — same gate, kinder UX, no client-side band creation). Phase 2: new lightweight `GLBetaFeedback` FAB in `js/core/gl-beta-feedback.js` (gated by `?beta=true` / localStorage flag / dev shell + roster / console call) — category-tagged modal routes through existing `GLFeedbackService.submitExplicit` to `bands/{slug}/feedback_reports`. Phase 3: `_glOnboardingStats` localStorage counters (gateAllowed/gateBlocked/inviteCodeViewed/feedbackSubmitted) surfaced via new `onboarding` Runtime Health Overlay section. Phase 4 (broad empty-state hardening) deferred to reactive Stab passes driven by real feedback. Phase 5: BETA_FEEDBACK_QUEUE.md opened. ~280 LOC. All `node -c` clean. Build atomic across 4 sources. No public self-signup. No band-creation. No SYSTEM LOCK. No A2P. No Firebase rule changes. `_glCheckBandMembership` unchanged. Mode-B Phase 2 (self-serve invite-code redemption) deferred — needs Cloudflare Worker admin endpoint._

_Previous: 2026-05-14 10:14 EDT (build `20260514-141450`) — **Reality Stabilization Fix #14 shipped — stem jobs are now resumable + cancellable. ALL HIGH RISK findings from Audit #09 are now closed. Codebase is mode-B operationally ready.**_
_  · **Stab #14 — Stem Job Persistence + Cancellation Hardening** (`20260514-141450`, this commit). Closes Audit #09's last HIGH RISK item — Modal stem-separation jobs (`gl-stems.js separate()`, 90s–25min) now survive tab close, refresh, and nav-away via localStorage-backed persistence. New `gl_stem_jobs_active` map keyed by jobId holds kind/callId/title/status/model/source-pointers/startedAt/lastPollAt. Boot resume walks the map, prunes stale entries, re-attaches polling for fresh `'processing'` jobs. `_pollSeparateJob` extracted so initial + resume share one code path with cancellation check between ticks. New public `GLStems.cancelJob(jobId)` marks cancelled locally + fires-and-forgets POST to new `/stems/cancel` worker endpoint. **New worker route `POST /stems/cancel`** in worker.js — accepts `{callId}`, forwards to `STEMS_MODAL_CANCEL_URL` (with fallback derivation), always returns success with `cancelled:'remote'|'client_only'` so client UI never hangs. **Runtime Health Overlay** gains `stems` section via `GLStems.getStats()` exposing activeCount/processing/completed/cancelled/failed/lastPollAt/kinds/liveLoops — NO URLs/call_ids/stem URLs leaked. Survivability > forced cancel: no `beforeunload` cancel fetch (false-cancel of a wanted job is worse than abandoning one). LALAL + spatial resume not yet wired — separate medium-effort follow-up. **Worker deploy required** (Drew `wrangler deploy`) for server-side GPU cancellation; client-side cancel works regardless. ~330 LOC across `gl-stems.js` + `gl-runtime-health.js` + `worker.js`. All pass `node -c`. No stem-system redesign. No SYSTEM LOCK. No A2P. **All HIGH RISK Audit #09 items closed** via Stabs #11–#14._

_Previous: 2026-05-14 09:52 EDT (build `20260514-135200`) — **Reality Stabilization Fix #13 shipped — multitrack upload cancellation is now truthful.**_
_  · **Stab #13 — Multitrack Upload Abort Hardening** (`20260514-135200`, this commit). Closes Audit #09 §3.2.1 + §3.2.2 — the modal UI promised "Closing the modal will cancel pending uploads" but no `AbortController` was wired. Same trust-violation pattern as Prep-for-Gig (Stab #12), now applied to multitrack uploads. New behavior: per-upload `AbortController` on `track._uploadController`; `_mtAbortAllUploads(reason)` walks active controllers and marks unfinished tracks as `'cancelled'` (distinct from `'failed'`); `_mtCancelImport` actually aborts before removing the DOM and shows "Cancelled N in-flight uploads" toast; AbortError routes to the cancelled status path, never the failed path; pre-fetch guard short-circuits queued uploads when the session is already aborted; offline detection adds "(network interrupted)" to the footer message; render UI distinguishes 4 footer states (uploading / all-done / some-failed / all-aborted-with-partial-count) and adds a calm grey "↻ Re-upload" button for cancelled rows (distinct from amber "↻ Retry" for failed); `finally` clause nulls controllers post-settle to keep abort sweeps idempotent. Runtime Health Overlay gains a `multitrack` section exposing `inFlight / queued / done / failed / cancelled` counts + `aborted / abortReason` flags. NO URLs, NO tokens, NO file paths leaked. ~180 LOC across `js/features/multitrack-rehearsal.js` + `js/core/gl-runtime-health.js`. Both pass `node -c`. No upload-architecture redesign. No retry-behavior change. No stem-job code touched (M.4 separate). No SYSTEM LOCK. No A2P. Held back: M.4 stem job persistence — next medium-stab, needs worker-side cancel endpoint._

_Previous: 2026-05-14 09:06 EDT (build `20260514-130621`) — **Reality Stabilization Fix #12 shipped — Prep for Gig is now truthful about partial failures.**_
_  · **Stab #12 — Prep for Gig Trust Hardening** (`20260514-130621`, this commit). Closes Audit #09's most-dangerous-silent-failure-still-open (`setlists.js:1641-1648` per-song silent swallow + "Ready for gig" lie). New behavior: structured per-item result tracking → COMPLETE / PARTIAL / CATASTROPHIC / CANCELLED outcome semantics. Partial state shows amber button + inline summary + "Retry failed only" + "Try again" buttons (instead of green "Ready for gig"). Re-entrancy guard via `_slPrepInProgress`. Route-leave cancellation via `GLRouteLifecycle.register('setlists', _abortPrep)`. Offline-mid-run signal feeds catastrophic-message. `_slPrepLastResult` exposed for Runtime Health Overlay (new `prepForGig` snapshot section). New HTML slot `#slPrepGigSummary` for retry UI. `_slPrepRetry()` runs only still-retryable items, falling through to full re-run if nothing remains. ~250 LOC across `js/features/setlists.js` + `js/core/gl-runtime-health.js`. Both pass `node -c`. No setlist redesign. No retry framework. No SYSTEM LOCK. No A2P. Held back: M.3 (multitrack abort) + M.4 (stem job persistence) — next medium-stab._

_Previous: 2026-05-14 08:43 EDT (build `20260514-124346`) — **Reality Audit #09 (Failure-State Resilience) shipped 2026-05-14; Reality Stabilization Fix #11 acts on it the same day.**_
_  · **Stab #11 — Silent Failure + Recovery Hardening** (`20260514-124346`, this commit). 8 quick wins from Audit #09 Q.1–Q.8. **Q.1** Chart Import button try/catch/finally — re-enables on all paths. **Q.2** `gl-leader.js:250` listener errorCallback added — silent leader-follower sync loss is closed; logs throttled 1/30s. **Q.3** `gl_pending_feedback` capped at 50 newest + QuotaExceededError halve-and-retry — no more unbounded growth + corruption cascade. **Q.4** Update banner dismissal persisted per build version in localStorage; reload preserves dismissal; new deploy re-shows banner. **Q.5** 5 unversioned CSS files now `?v=BUILD` stamped in both index files — closes Audit #06 §3.4 partial-deploy window. **Q.6** Recording analyzer `_analysisInProgress` guard — double-click Analyze throws early. **Q.7** `gl-source-resolver.js` cache auto-clears on invalid JSON — YouTube/Spotify caches self-heal. **Q.8** AudioContext `pageshow.persisted` resume hook on harmony-lab + bestshot — first play tap after iOS bfcache restore now yields sound. ~150 LOC. All 10 touched files pass `node -c`. No service-worker rewrite. No A2P. No SYSTEM LOCK touches. Held back per scope: M.2 Prep-for-Gig surface, M.3 multitrack abort, M.4 stem job persistence — separate medium-stab next._

_Previous: 2026-05-13 21:30 EDT (build `20260513-213032`) — **Convergence Initiative C5 Phase 1 COMPLETE.** Build trail today: ... → `20260513-211446` → `20260513-213032`._
_  · **C5 Phase 1 — `GLBandFeedStore` Canonical Ownership Layer** (`20260513-213032`, prior commit). New module `js/core/gl-band-feed-store.js` (~480 LOC) introduces the canonical chokepoint for `bands/{slug}/ideas/posts/**`, `bands/{slug}/polls/**`, `bands/{slug}/feed_meta/**`. **19 helpers** covering reads (loadFeed/loadPosts/loadPolls/loadLatest/loadFeedMeta), writes (createPost/updatePost/removePost/createPoll/updatePoll/removePoll/votePoll/setFeedMeta/removeFeedMeta), subscriptions (subscribe/unsubscribe with type registry: `'poll-new'`, `'idea-new'`, `'polls-all'`, `'ideas-all'`, `'feed-meta'`), and observability (teardown/getStats). Auto-stamps `createdAt`/`updatedAt`+`createdBy`/`updatedBy`. Route-lifecycle disposer registered for `feed` route. Subscription registry de-duplicates by `(type+handler ref)`. Stats counters include `activeSubscriptions`, `pollingLoops`, `lastRealtimeEventAt`, `lastWriteAt`, `subscriptionCount`, `cleanupFailures` — surfaced via Runtime Health Overlay (Stab #10). **15 sites migrated** across `band-feed.js` (× 11: typed creates, deletes, edit save, _feedLoadAll reads → loadPosts+loadPolls, _feedBgBadgeRefresh polling, _feedRealtimeNotifs subscribers, _feedSaveMeta), `home-dashboard.js` (× 3: action card / attention-owed / Band Room polls+ideas previews), `feed-action-state.js` (× 1: votePoll). Every site preserves canonical+fallback shape — stale SW shells degrade gracefully. **Deferred to C5 Phase 2:** multi-path updates (auto-resolve / auto-archive / stale-vote cleanup / orphan-vote cleanup — needs `multiPathUpdate(updates)` helper), `band-comms.js` composer surface direct refs, single-subscribed-listener convergence. All 5 touched JS files pass `node -c`. Build bumped atomically across all 4 sources. No feed redesign, no polls rewrite, no schema change, no A2P file changes, no SYSTEM LOCK touches._

_Previous: 2026-05-13 21:14 EDT (build `20260513-211446`) — **Convergence Initiative C2 Phase 2 COMPLETE.** Build trail today: ... → `20260513-210049` → `20260513-211446`._
_  · **C2 Phase 2 — RehearsalSession Ownership Migration COMPLETE** (`20260513-211446`, prior commit). All 19 deferred sites from Phase 1 migrated. New helpers in `gl-rehearsal-session.js`: `loadField`, `removeField`, `loadRecent`, `loadForBand`, `setForBand`. Existing helpers extended with `opts.slug`. Sites migrated across `groovemate_tools.js`, `band-feed.js`, `gl-rehearsal-scheduling.js`, `recording-analyzer.js` (6), `multitrack-rehearsal.js` (6 incl. comments), `rehearsal-analysis-pipeline.js` (4 explicit-slug), `gl-insights.js` (1). Every site preserves canonical+fallback shape. Stats expanded with Phase 2 counters — surfaced via Runtime Health Overlay. **Final state:** 28/28 user-facing access sites canonical-routed; 0 unprotected direct refs; 4 documented permanent exceptions. C2 fully resolved. No schema/UI/behavior changes beyond auto-stamping (canonical contract). All 8 touched JS files pass `node -c`. Build bumped atomically across all 4 sources._

_Previous: 2026-05-13 21:00 EDT (build `20260513-210049`) — **Reality Audit thread, day 2 still rolling. Reality Audit #08 (Listener Lifecycle deep dive) + Stab #10 (Runtime Health Overlay) shipped in the same commit.** Build trail today: ... → `20260513-204319` → `20260513-210049`._
_  · **Reality Audit #08 — Listener & Subscription Lifecycle** (`20260513-210049`, this commit). Audit + action. Confirms all 5 known listener leaks from Audit #02 §2.2 are closed by Stabs #01/#03/#06/#07/#09. Five canonical cleanup paths now exist. Rather than produce a 500-line static grep inventory, ships a Runtime Health Overlay as the chosen ongoing observability solution (catches future regressions live)._
_  · **Stab #10 — Runtime Health Overlay** (`20260513-210049`, this commit). New module `js/core/gl-runtime-health.js` (~430 LOC). Dev-only floating panel with live state of core/SW/route lifecycle/playback/Spotify/teardown exports + warnings. Activation: `?dev=true`, `localStorage.gl_runtime_health='1'`, `GLRuntimeHealth.show()`, or `Cmd+Shift+H`. Powered by three new `getStats()` getters on `GLRouteLifecycle` / `GLPlayerContract` / `GLSpotifyConnect` — purely observational. **No tokens, no PII, no Firebase auth, no raw localStorage values exposed** (verified by grep). Wired into both index files; build bumped atomically across all 4 sources._

_Previous: 2026-05-13 20:43 EDT (build `20260513-204319`) — **Reality Audit thread, day 2 still rolling. Reality Audit #06 (Stale Client) shipped + Stab #09 acting on it.** Build trail today: ... → `20260513-192327` → `20260513-201027` → `20260513-204319`._
_  · **Reality Audit #06 — Stale Client / Service Worker / Update UX** (`20260513-204319`, this commit). Read-only inventory. Foundation sound (SW strategy is right per resource, `skipWaiting+clientsClaim` wired, per-version banner correct, ~60 cached-shell fallback branches classified Necessary). Three risk areas: iOS PWA backgrounded-tab stale gap (no visibility hook), 5 unversioned CSS hrefs, unconditional `controllerchange` auto-reload. Plus 1 dead-code finding (`_loadedVersion === '0'` skip guard). Index renumbered: previous #06 (Listener Lifecycle) bumped to #08; Stale Client took the #06 slot._
_  · **Stab #09 — Stale Client Resume Check + Rehearsal Reload Guard** (`20260513-204319`, this commit). Acts on Audit #06 §7.2 recommendations 1–3. Five additive changes across `app.js` + `app-dev.js` mirror, ≤50 LOC. (1) `visibilitychange` → `checkForAppUpdate()` with 30s debounce. (2) `pageshow.persisted` → same. (3) `controllerchange` listener now checks `GLStore.isPerformanceMode()` first; in performance mode (rehearsal-mode or live-gig active) it shows the existing banner instead of auto-reloading. (4) Removed unreachable `_loadedVersion === '0'` skip guard. (5) `KNOWN_STABLE_FLOWS.md` gained Update/Resume/Reload section. **No service-worker rewrite. No cache architecture redesign. No banner behavior changes (per-version gating preserved). No SYSTEM LOCK touches.** Build bumped atomically across all 4 sources. **Held back:** CSS cache-busting on 5 unversioned hrefs, settings debug panel, forced-reload-on-mismatch (explicitly not done — would risk mid-show disruption)._

_Previous: 2026-05-13 20:10 EDT (build `20260513-201027`) — **Reality Audit thread, day 2 close-out. Reality Audit #05 (Dead Code + Orphan Flow) shipped, plus Clean #1 — the first cleanup commit acting on it (5 verified-dead removals, zero behavior change).** Build trail today: ... → `20260513-192327` → `20260513-201027`._
_  · **Reality Audit #05 — Dead Code + Orphan Flow** (`20260513-201027`, this commit). Read-only inventory of file orphans, dead routes, orphan functions/handlers, legacy/superseded systems. Report at `02_GrooveLinx/audits/GROOVELINX_REALITY_AUDIT_05_DEAD_CODE_ORPHAN_FLOW.md`. **Key findings:** 1 verified-dead file (`home-dashboard-cc.js`), 1 dead config entry (`_glPageScripts['rehearsal-mode']`), 3 dead branches/comments, 2 deprecated null shims, 1 orphan writer (`bulk-import.js:182 chart_url` per Audit #04 known-orphan), 1 router bug (`workbench` missing from `VALID` restore array). **Reclassifications:** `workbench.js` is EXPERIMENTAL not HALF-BUILT (10+ programmatic callers, no nav entry); `playback-session.js` is ACTIVE BUT DUPLICATIVE. **Verified-LIVE despite earlier suspicions:** `pocket-meter.js`, `band-comms.js`, `song-pitch.js`, `plLoadIndex()`, all 4 avatar-feedback modules, all 4 rehearsal compute engines. The audit explicitly corrects three earlier agent misreads caught during verification. **No SYSTEM LOCK violations.** Index renumbered: Audit #04 is Player Architecture (already done), Audit #05 is Dead Code (this), #06 is Listener Lifecycle (pending), #07 is Module Decomposition (pending, was #05 before today's renumber)._
_  · **Clean #1 — First Audit #05 cleanup commit** (`20260513-201027`, this commit). Drew approved items D1 + D4 + D5 + D6 + D7 only. **Changes:** deleted `js/features/home-dashboard-cc.js` (file); removed `'rehearsal-mode': ['rehearsal-mode.js']` line from `_glPageScripts` at `navigation.js:337`; deleted unreachable `if (false) { ... }` block at `navigation.js:575-576`; deleted 2-line `// REMOVED` comment blocks at `home-dashboard.js:1492` + `:2788`. **Verification:** `home-dashboard-cc.js` absent from disk ✓; zero `rehearsal-mode` matches in `navigation.js` ✓; zero `if (false)` matches in `navigation.js` ✓; zero `// REMOVED` matches in `home-dashboard.js` ✓; `node -c` passes on all touched JS ✓; build bump consistent across all 4 sources (`version.json`, `index.html`, `index-dev.html`, `service-worker.js`) ✓. **Held back per Drew's scoped instruction:** Q1 `SD_LENSES_BY_MODE`, Q2 `GL.MODE_PAGES/MODE_LANDING`, Q3 `bulk-import.js:182 chart_url`, K1 `if (false)` retained gig-day logic, K2 workbench router bug, K3 `playback-session ↔ gl-now-playing` duplication, U1 workbench no-nav-entry, D2 archive folder, D3 doc folder snippet, plus the workbench routing decision. **No A2P file changes. No SYSTEM LOCK touches.**_

_Previous: 2026-05-13 15:23 EDT (build `20260513-192327`) — **GrooveLinx Reality Audit thread, day 2. Issue #30. Stabilization Fixes #02 → #08 + Convergence C2 Phase 1 + Reality Audit #04 shipped today on top of yesterday's Stab #01.** Build trail today: `20260513-012353` → `20260513-122512` → `20260513-133724` → `20260513-151218` → `20260513-152155` → `20260513-175835` → `20260513-184757` → `20260513-190522` → `20260513-192327`._
_  · **Stab #08 — Spotify API Chokepoint + North Star Title Hydration** (`20260513-192327`, this commit). Two concurrent fixes. **(A) Spotify API chokepoint:** `GLSpotifyConnect.apiRequest(method, path, body?, opts?)` is now the canonical wrapper for every `api.spotify.com` call. Wraps existing internal `_req()` (token refresh + 401 retry + 429 backoff + 5xx retry + network blip recovery). Opts: `legacyShape` (preserves listening-bundles' null/error-body contract), `silent` (swallow warnings). Companion `hasValidConnection({bypassCache})` does a `/me` probe with 60s cache. `listening-bundles.js` 2 direct call paths migrated. **(B) North Star "Loading..." bug:** root cause was `app.js:3330` + `app-dev.js:3310` storing the literal string `'Loading...'` as `version.title` whenever the user didn't supply one — if subsequent oEmbed hydration failed, the title stayed `'Loading...'` forever. Fix: new save sentinel is platform-aware (`'Spotify Track'`, `'YouTube Video'`, etc.); `window._glNormalizeRefTitle(v, fallback)` helper in `js/core/utils.js` filters the legacy sentinel at all 9 display sites; `fetchRefTrackInfo` Spotify branch upgraded to prefer `apiRequest('GET','/tracks/{id}')` when OAuth available (richer metadata) → oEmbed fallback → `'Spotify Track'` fallback; `renderRefVersions` persists hydrated `fetchedTitle` back to Firebase so a single Listen-lens visit heals legacy `'Loading...'` records system-wide. **No Spotify rewrite. No North Star schema migration. No UI redesign.** Cached SW-shell fallbacks retained verbatim for stale-bundle safety._
_  · **Stab #07 — Global `pauseAll()` Playback Arbitration** (`20260513-190522`, this commit). Built the cross-engine pause arbitrator that Stab #06 declared as groundwork. `GLPlayerContract.pauseAll(exceptId)` is now live — single-owner playback is enforced by construction across 5 surfaces (GLPlayerEngine, SetlistPlayer, Stems mixer, Harmony Lab, BestShot). Arbitration walks two registries: engine adapters declaring `PAUSE_ALL` capability + ad-hoc surfaces registered via new `registerPausable(id, pauseFn)` API. Recursion-guarded via `_arbitrating` flag. Defensive try/catch per surface — a failing pause doesn't block the cascade. Quiet logging (only when something paused or failed). **6 assertion call sites** across 5 source files. **2 pausable registrations** for non-engine surfaces. **Excluded by design + documented:** app.js memory loops (4 transient base64 audio sites scattered through unrelated code paths — wrapping is invasive), Spotify SDK/Connect transports (already covered by GLPlayerEngine arbitration), pocket-meter mic (input only). **New doc:** `02_GrooveLinx/KNOWN_STABLE_FLOWS.md` — trust-level matrix marking Song Detail Stems + Harmony Lab + BestShot as Needs iPhone verification for the new arbitration paths. **No transport-control changes. No queue-behavior changes. No UI changes.**_
_  · **Stab #06 — Player Lifecycle Integration** (`20260513-184757`, this commit). Translated Audit #04's quick-win list into action. **Per-route disposers added:** `setlist-player.js` overlay close on nav-away (queue + floating bar persist); `harmony-lab.js` pause-all on songdetail leave; `bestshot.js` chopAudio pause + chopAudioContext suspend on bestshot leave. **Cross-route `beforeunload` defense (intentionally not per-route, to preserve floating-bar UX):** `gl-player-engine.js` calls `stop()` + closes shared `_deadceteraAudioCtx`; `gl-spotify-connect.js` calls `stopPolling()` defensively. **Audit #04 reconciliation:** `_deadceteraAudioCtx` "dedup" was already guarded with `if (!window._deadceteraAudioCtx)` at all 4 sites — only the missing `beforeunload` close was added. **Contract groundwork:** `GLPlayerContract.CAPABILITIES.PAUSE_ALL` constant declared; the cross-engine arbitration mechanism remains unimplemented per task scope. **No player redesign, no playback unification, no UI work.** All 6 files modified pass `node -c`; engine play behavior unchanged._
_  · **Reality Audit #04 — Player / Audio / Playback Architecture** (`20260513-175835`, this commit). Read-only inventory: ~13 audio surfaces, ~5 orchestration layers. Key finding: the contract layer is mostly DONE — Phases C.1–C.4 already shipped via `gl-player-contract.js` + 3 adapters. What remains is lifecycle integration (Stab-scale work), not Convergence-Initiative-scale unification. Three gap classes identified: (1) `GLPlayerEngine`/`SetlistPlayer`/`GLSpotifyConnect`/`harmony-lab`/`bestshot` are NOT registered with `GLRouteLifecycle`; (2) `listening-bundles.js` makes 3 direct `api.spotify.com` calls bypassing both wrappers; (3) no global `pauseAll()` — concurrent `<audio>` elements can play simultaneously. iOS-specific: SDK intentionally unusable per docs in `gl-spotify-connect.js:6–10` (Connect path is mandatory); no `pagehide`/`freeze` handlers. **Zero SYSTEM LOCK violations** (no GL_PAGE_READY, focusChanged, or ACTIVE_STATUSES piercing in player code). **Recommendation:** Stab #06 — Player Lifecycle Integration — should run before C1 Phase 2. ~75 LOC across 7 files, all S-effort lifecycle disposers, low risk. Audit also renumbered the previously-planned listener-lifecycle deep-dive as #06 since the original #04 slot was reassigned to player architecture._
_  · **C2 Phase 1 — `GLStore.RehearsalSession` canonical ownership** (`20260513-152155`, this commit). New module `js/core/gl-rehearsal-session.js` (~280 lines) wraps `bands/{slug}/rehearsal_sessions/**` with `loadAll / loadById / create / update / setField / remove / subscribe / setCurrent / getCurrent / clearCurrent / getStats`. Auto-stamps `updatedAt`+`updatedBy` on writes. Registers a `GLRouteLifecycle` disposer for `rehearsal` route so subscriptions detach on route leave. Defensive counters for duplicate-subscribe detection + read/write/remove telemetry. **Phase 1 migrated 9 sites** (rehearsal.js × 7, rehearsal-mode.js × 2) with canonical+fallback defensive pattern. **Phase 2 deferred 19 sites** across multitrack-rehearsal, recording-analyzer, rehearsal-analysis-pipeline, gl-insights, gl-rehearsal-scheduling, groovemate_tools, band-feed — see `02_GrooveLinx/audits/C2_REHEARSAL_SESSION_MIGRATION_MAP.md`. **No schema changes. No rehearsal redesign.** Pattern modeled on `GLStore.PracticeSession` precedent._
_  · **Stab #05 — Chart Renderer Enforcement** (`20260513-151218`, this commit). Inventoried 12 chart-related surfaces. B.1 (song-detail Band lens) + B.2 (rehearsal-mode Chart Tab load) were already canonical from prior work. **Migrated 1 new surface:** `song-detail.js:467` Play Mode lens chart text now routes through `ChartRenderer.renderHtml({fontSize:15, lineHeight:1.8, letterSpacing:'0.02em', maxHeight:'none'})`. Required small canonical API extension — added `letterSpacing` opt + documented `maxHeight: 'none'` sentinel. **Side effect of migration:** Play Mode now decodes HTML entities (Band lens already did — closes silent inconsistency). **Documented exceptions** (cannot safely migrate): live-gig smart chord-segment renderer (different functionality), setlists print HTML (`<div class="chart">` with print CSS), workbench fullscreen (interactive transpose/scroll/fit), 4-line chart preview cards (canonical can't express `overflow:hidden`+`padding`). Legacy SW-shell fallback branches in song-detail + rehearsal-mode preserved verbatim per Phase A pattern. CANONICAL_SYSTEMS.md Chart Rendering section rewritten with full API + migration phases + exception list._
_  · **Stab #02 — Groovemate Setlist Write Safety** (`20260513-012353`). `groovemate_tools.js:190/358` fallback branches replaced with fail-loud `console.error` + early return. Zero unsafe `db.ref(bandPath('setlists')).set` calls now remain in user/AI-triggered code paths. `gl-task-engine.js:392` intentional undo/snapshot restore left untouched._
_  · **Stab #03 — Per-Route Lifecycle Hook** (`20260513-122512`). New `window.GLRouteLifecycle` (register/leave/disposers/currentRoute) wired into `showPage()` in `js/ui/navigation.js`. Per-route disposers wired for the two actual leaks: `song-detail.js` stems drift `setInterval` + AudioContext (`window._sdStemsCleanup`); Pocket Meter mic/classifier/visibilitychange/rAF/Firebase listener (`_pmInstance.destroy()`). Teardown capability added (not per-route) for three session-wide handlers honestly reconciled: `band-feed.js _feedBgBadgeRefresh`, `home-dashboard.js` visibilitychange, `rehearsal.js` focusChanged unsubscribe. Of the 5 listeners Audit #03 flagged, only 2 were actual per-route leaks; the other 3 were single-execution IIFE/module-load listeners with internal page guards._
_  · **Stab #04 — Status Display Centralization** (`20260513-133724`, this commit). **Premise correction first:** Audit #01's "7 inline ACTIVE_STATUSES shadows" conflated three patterns — load-order fallback guards (already canonical-routed), intentional 4-key subset filters in home-dashboard.js (excludes legacy `wip`/`active` by design — converging them would silently change weak-song counts), and display-label maps in songs.js (legitimate duplicates of each other, but NOT of ACTIVE_STATUSES). Also discovered `gl-status-badge.js` is the connectivity badge (Live/Refreshing/Cached/Offline) — no canonical song-status badge component exists. **Fix:** added `GLStore.STATUS_LABELS`, `GLStore.STATUS_LABELS_EMOJI`, `GLStore.STATUS_COLORS` to `groovelinx_store.js`; routed `songs.js:217/382/383/860` through them. Annotated home-dashboard.js header + site 3001 documenting the 4-key subset is intentional. Left `gl-focus.js:48` + `song_matching_engine.js:364` untouched (already canonical-routed). Rewrote `CANONICAL_SYSTEMS.md` Status Rendering section — corrected the wrong gl-status-badge.js owner, added canonical owners for active set + display maps + colors, documented the home-dashboard subset exception._

**Reality Audit progression so far:** #01 System Inventory (✅), #02 Data Access (✅), #03 Page Coverage (✅) → Stab #01 (✅, listener cleanup + W1 fix), Stab #02 (✅), Stab #03 (✅), Stab #04 (✅, today). Audit #04 (Listener Lifecycle deep dive) and #05 (Module Decomposition criteria) remain pending. Recommended next action: act on Audit #03's C4 (status badge component enforcement) was just done as Stab #04; next-most-valuable is C2 — `GLStore.RehearsalSession` (largest data-ownership conflict's solution, L effort, HIGH value).

---

_Updated: 2026-05-12 19:23 EDT (build `20260512-232320`) — **A2P 10DLC resubmission day + rehearsal timeline persistence + 3 follow-up fixes. Nine commits across the day, builds `20260512-145711` → `20260512-232320`.** Two threads:_
_  · **A2P 10DLC compliance resubmission.** Full alignment of in-app SMS opt-in UI, public `sms-opt-in.html`, screenshot PNG, and Twilio Console submission fields. Disclosure repositioned ABOVE the Enable SMS button (industry-standard informed-consent-before-action pattern, was below). Button label tightened to "Enable SMS". Categories specified verbatim ("rehearsal schedules, gigs, setlist updates, time-sensitive band logistics"). Frequency tightened ("typically 2–5 messages per week"). Verbatim "Message and data rates may apply" everywhere (not the abbreviated form). Three screenshot retakes to keep the public PNG in lockstep with description text. **Submitted:** Campaign SID `CM5eff550348c1933e9b57ce99c6aeafc6`, Brand SID `BN690df404c69f445c14c1be8383f1de93`, MG `MG70657b62c45c0a77bf4b0721d552553c`. Phone `+1 408-539-8813` verified in Sender Pool. Status: **In progress**, ~2–3 week carrier review per Twilio banner._
_  · **Rehearsal timeline persistence + 3 follow-up fixes** (single commit `a95fdb59`). **Timeline persistence:** 💾 Save Timeline + 📂 Load buttons on chopper toolbar; persists `{id, label, savedAt, savedBy, sourceUrl, timeline}` to `bands/{band}/rehearsal_timelines/{key}`; closes the data-loss gap that ate Drew's 5/11 server analysis when he closed the tab. **#5 blob: URL leak:** `_rmSummarySave` no longer persists `URL.createObjectURL()` output to Firebase as `audio_url`; Copy Link defensively rejects blob: URLs from legacy records. **#6 calendar_events nulls:** `_sanitizeForFirebase` now FILTERS nulls from arrays instead of preserving them (root cause for "Cannot read properties of null" crashes Brian was hitting); `toArray()` read-side filter stays as belt-and-suspenders. **#7 creator attribution:** `_calResolveCreatorName` maps roster emails to display names; `calSaveEvent` stamps `creatorEmail`; `calShowEvent` renders "👤 Added by X" in event detail metadata row, falling through to Google sync's `organizerEmail` for legacy events._

**Frozen surfaces during A2P review:** `sms-opt-in.html`, `sms-opt-in-screenshot.png`, `privacy.html`, `terms.html`, the SMS Notifications UI section in `app.js`. **Rest of repo unfrozen** — daily commits to everything else fine.

**Acceptance for today's bundle:**
- Open chopper → load audio → ✨ Analyze on Server → click 💾 Save Timeline (label it) → close tab → re-open chopper → 📂 Load → label appears → reload restores all segments.
- Open any new calendar event → "👤 Added by Drew" appears in metadata row; existing Google-synced events show `organizerEmail`-derived name.
- Try Copy Link on a legacy mixdown with blob: in `audio_url` → "No shareable link" toast (not the dead blob URL).
- After any calendar sync, console either silent or shows `[sanitize] Stripped N null entries…` (proves legacy nulls are being scrubbed at save time).

**Verify post-deploy (incognito):**
- `app.groovelinx.com/sms-opt-in-screenshot.png` → disclosure above phone field, Enable Notifications ON, URL bar visible
- `app.groovelinx.com/sms-opt-in.html` → "typically 2–5 messages per week", "directly above the phone number field and Enable SMS button"
- `app.groovelinx.com/version.json` → `20260512-232320`

**Next recommended step:** Drew re-runs the 5/11 rehearsal analysis through `✨ Analyze on Server` with the same Drive URL and clicks `💾 Save Timeline` immediately on completion. Label: "Deadcetera 5/11/2026". Once saved, it's recoverable forever via 📂 Load.

---

_Updated: 2026-05-11 11:33 EDT (build `20260511-113334`) — **Pre-rehearsal Spotify hardening + iPhone perf SWR caches + worker `/multitrack/share` endpoint. 14 commits this morning bulletproofing tonight's live UAT rehearsal.** Major themes:_
_  · **Spotify defensive moats**: silent token refresh (no mid-rehearsal "Connect Spotify" CTAs), Premium detection + clear upgrade CTA for non-Premium accounts, tap-to-switch device picker (push to Bluetooth speakers / PA / other phones), rapid-play race guard, transient network/5xx retry, mid-song session-lost detection → wake CTA recovery, force-poll on visibility return (no stale UI after iPhone unlock), prewarm next song's trackId during setlist play (snappy transitions), artist-aware Spotify search ("Ain't Life Grand" now finds Widespread Panic, not a random cover)._
_  · **iPhone perf**: hardened `window._glSafeCache` (versioned envelope, safe-parse with auto-clear, 1 MB cap, delta detection). Two new caches — `gl_song_library_<slug>` + `gl_sdget_<slug>_<subpath>` — cut Songs-page paint from 5-10s to ~0ms on repeat visits and song-detail open ("Ain't Life Grand") from 5-10s to instant._
_  · **Worker `/multitrack/share`** — Drew can DM Brian a URL after rehearsal; Brian downloads the FLACs via R2 public URLs with native HTTP range resume. Replaces the brittle dashboard paste-deploy workflow with `wrangler deploy` (CLI gave full error output when the dashboard silently truncated a 130KB paste this morning)._
_  · **Polish bundle**: volume routing (slider actually works on Spotify now, hides when Connect device can't accept remote volume), status copy ("Starting on iPhone" not "Sending to Spotify on iPhone…"), adaptive polling cadence (1.5s when playing / 5s when idle), Up Next on float player._

_Final build: `20260511-113334` (8 atomic 4-source bumps today). 10-minute pre-rehearsal smoke test plan lives at `02_GrooveLinx/notes/spotify_diagnostic_toolkit.md`._

_**Open thread**: end-to-end test pass on iPhone + iPad + MBP at T-30min before rehearsal per the smoke test plan. Stop coding after that — additional polish has diminishing returns vs regression risk this close to live use._

---

_Updated: 2026-05-11 09:41 EDT (build `20260511-093520`) — **Spotify Phase 5 COMPLETE + cache-invalidation fix for the wake-flow regression.** Phase 5 polish shipped 3 items: pre-warm device list, sticky preferred-device, real-time device pill (with green-pulse/gray play-state dot + device-type icon). Drew tested iPhone and found that the new 30s device cache was breaking `retryAfterSpotifyWake` (5 polls all hit stale cache → "eventually it suddenly worked" = cache TTL expired). Fixed by clearing the cache at start of every wake-retry + on visibilitychange-to-visible. Final build `20260511-093520`._

_Updated: 2026-05-11 ~01:30 EDT (build `20260511-015215`) — **Full day comprehensive close: 22 commits, 2 sessions split by laptop crash, 7 atomic 4-source bumps. (A) Spotify Connect Phases 1–4 shipped end-to-end with 8 follow-up fixes + cross-device token sync + iPad routing fix + MBP transport-control fix. (B) P0 setlist-clobber incident root-caused, fixed, all data recovered, defense extended to 5 of 8 band-level shared types covering 63 callsites.** Final build `20260511-015215`. Full audit trail in CLAUDE_HANDOFF.md._

_Updated: 2026-05-10 (late PM, build `20260511-001530`) — **SWR Cache Clobber Incident: root-caused, fixed, all data recovered. Two builds shipped, defense extended from setlists to gigs + calendar_events.** Drew reported Southern Roots Tavern setlist had been mangled (24 songs flattened into one set instead of the intended 3-section 22-song structure). Investigation found a systemic architectural bug: every band-level shared-array write (`saveBandDataToDrive('_band','setlists', wholeArray)` and its siblings) read the input from SWR cache (`loadBandDataFromDrive` returns cached data instantly, refreshes in background). When the cache was stale relative to Firebase truth — typical for any multi-tab or multi-device session, or simply within the post-load refresh window — the whole-array `.set()` overwrote Firebase with the stale snapshot, silently rolling back every unrelated record. **3 damaged + 2 dropped setlists** identified in audit: Southern Roots (key 16, 22→24 with section labels in songs[]), Tim's Birthday/Earth Brewing 6/28 (key 13, songs preserved but name/date/gigId clobbered to a deleted gig, 35→42 with section labels), Avon Theater 8/8 (key 19, wiped to 0 songs), MoonShadow 6/5 + Earth Brewing 9/11 (entirely dropped). Recovered via per-record `firebaseDB.ref('setlists/<key>').update()` writes — bypassing the broken whole-array path — from the legacy `localStorage['deadcetera_setlists__band']` snapshot which held a pre-clobber 22-entry copy. Tim's Birthday additionally renamed/relinked to the real Earth Brewing 6/28 gig (gigId xec32casc6qr); MoonShadow + Earth Brewing 9/11 created as empty shells (legacy LS only held them as near-stubs anyway, so content is genuinely gone). **Code fix build `20260511-000510`:** new `window.saveBandSetlistsSafe()` in `js/core/firebase-service.js` reads Firebase truth (bypasses SWR cache), diffs by `setlistId`, writes only changed records via `.update()`, stamps `updatedAt`/`updatedBy`, re-syncs both localStorage caches from a fresh Firebase read (not from the input array — that was the original sin). `saveBandDataToDrive('_band','setlists',...)` shim auto-routes through the safe writer — all 11 existing call sites in setlists.js / gigs.js / calendar.js / gl-data-audit.js protected without modification. Two direct-Firebase bypass writes in `groovemate_tools.js` converted to use the safe writer. **Extended fix build `20260511-001530`:** generalized `saveBandSetlistsSafe` → `saveBandArrayDataSafe(dataType, newArray, options)` with per-type ID-field registry `window._BAND_ARRAY_ID_FIELDS = { setlists: 'setlistId', gigs: 'gigId', calendar_events: 'id' }`. Shim now routes all three through the safe writer — **7 gig writers + 39 calendar_event writers** protected automatically. `saveBandSetlistsSafe` preserved as thin backwards-compat alias. Section-label flattener validator (regex catching "Soundcheck"/"Set 1"/"Set Break"/"Encore" as song titles inside `songs[]`) runs only on setlists writes. **gl-task-engine.js:392 snapshot restore** left as-is — it intentionally writes the whole array because it's restoring a known-good backup. **Lessons baked into the fix:** (a) writes always read from Firebase truth, never from cache; (b) caches resync from Firebase truth post-write, never from input; (c) every shared-array record gets `updatedAt`/`updatedBy` audit stamps; (d) section-label-in-songs[] is logged as a "suspicious title" warning at write time to catch any regression. **Memory saved:** `project_setlist_swr_clobber_bug.md`. **Bug log:** `02_GrooveLinx/notes/uat_bug_log.md` top entry documents the full incident. **Final state:** 22 setlists in Firebase (17 untouched + 3 restored + 2 shells), all audit-stamped. **SYSTEM LOCKs preserved:** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES`. **Builds shipped:** `20260511-000510` then `20260511-001530` (two atomic 4-source bumps from `20260510-233547`). **Watch:** monitor `[saveBandArrayDataSafe:*]` console log lines for "suspicious title" or "record missing idField" warnings over the next few days. If clean for a week, the bug class is closed. **Next options on the table:** (i) audit other shared-array data types not yet covered (rehearsal_plan_*, blocked_dates, song_pitches, custom_songs, band_contacts) — lower-traffic so lower risk, but the pattern is the same; (ii) write a small per-tab leader election to suppress multi-tab clobber risk further; (iii) the Jerry Jam 9/19 setlist (gigId missing) flagged during audit needs a manual relink; (iv) resume previously-paused work (Phase D Workbench shell, Rehearsal Phase 2/3, etc). **Older Song Workbench Phase A context preserved below for history:**_

_Updated: 2026-05-09 (mid-PM, build `20260509-164828`) — **Phase A of the Song Workbench unification shipped: GLNotes API + Practice Quick Note.** New `js/core/gl-notes.js` (~280 LOC) is the single read/write/remove/subscribe surface across 5 scopes (`chart`, `rehearsal`, `gig`, `personal_critique`, `stem`). Each scope adapter routes to the existing Firebase path and preserves the legacy field shape (no backing-store migration). Migrated: `ChartSystem.addOverlayNote`+`removeOverlayNote` → `GLNotes 'chart'`; `rmSaveNote` → `GLNotes 'rehearsal'`. Both retain documented legacy-fallback branches (`typeof window.GLNotes === 'undefined'` guard) for cached-shell safety. PracticeSession extended with `addNote(text)`/`getNotes()` that mirror to `GLNotes 'personal_critique'` (per-user, per-song; tagged with `sessionStartedAt` and `mode`). Practice entry screen surfaces a 📝 Quick Note chip + inline form, gated to active PracticeSession only — first new use case, first visible product win for Pierce's "let me jot a note about this practice session" ask. **Same push also shipped a fix batch** (commit `940cb2e8`): chart-load false-positive on new songs (heuristic now gates on `navigator.onLine === false`, not raw null), UG Get-Chart modal "Other" band fallback (uses `song.artist`, then `song.notes`), Add/Edit Custom Song modals (custom artist input + Firebase data migration on title rename), scoped chart input IDs and `name=` attrs to clear DevTools form-field warnings. **Phase A.1 logged in bug_queue:** `app.js saveGigNotes` writes raw strings (not objects), so a clean migration needs a renderer-side shape adapter — out of scope for Phase A. **Architecture audit lives at** `02_GrooveLinx/specs/song_workbench_architecture_audit.md` — full inventory of 11 music surfaces, 7 player engines, 4 chart renderers, 5 notes systems, plus proposed Phase A→F migration order. **SYSTEM LOCKs preserved:** `_navSeq`, `focusChanged`, Firebase error filter, `ACTIVE_STATUSES` — all untouched. **Smoke-test snippets pre-built and clipboard-ready** for the three round-trips (chart, rehearsal, Practice quick-note). **Next:** wait for smoke-test confirmation; if green, Phase B (ChartRenderer extraction) follows per audit Section 8.4. **Older Practice Wave 2 close-out preserved below for history:**_

_Updated: 2026-05-09 (early AM, build `20260509-021107`) — Practice Page Wave 2 shipped autonomously: PracticeSession persistence + Resume + save hooks.** Drew gave the go-ahead "do Wave 2 now and go as far as you can making decisions on your own. I trust you to get it right!" and went to bed; this is what landed before he wakes. **What's live:** new module `js/core/gl-practice-session.js` (~250 lines, IIFE) owns the localStorage-backed session model at key `gl_practice_session_v1` with schema `{ songId, songTitle, section: { in, out } | null, mode, settings: { stemPreset, stemId, mutedStems, showLyrics, showChords, showNotes }, lastPosition, startedAt, updatedAt, version: 1 }` and API `GLStore.PracticeSession.{ get, has, start, update, touch, clear, describe }`. Mode enum locked at `'focus' | 'part' | 'harmony' | 'learn' | 'chart'` per Drew's earlier directive. Mode-specific defaults inside `_defaultsForMode()`: harmony pre-mutes vocals + hides chords; learn/chart shows lyrics+chords; focus is generic. `update()` debounced 250ms via `_scheduleSave` to avoid thrashing localStorage on rapid loop nudges; `start()` is immediate (deliberate action). `start()` on the same songId preserves section + lastPosition (treat as "switching modes for the same song") so re-picking a song from the picker doesn't lose your loop point; different songId wipes. Emits `practiceSessionChanged` on the GLStore event bus. No Firebase mirror in v1, no auto-expiry — `describe().ageStr` lets the user judge staleness. Wired into both `index.html` and `index-dev.html` after `groovelinx_store.js`, before `gl-decision-language.js`. **Resume button now actually resumes:** new `_pmResumeSession()` in practice.js reads `PracticeSession.get()`, calls `_pmOpenSolo(songTitle, mode)` (which itself calls `PracticeSession.start()` with the sameSong path so config is preserved), then on a 600ms timeout (overlay needs DOM mount time per the existing `rmStartEdit` precedent) calls `GLActions.run('stems.setLoop', { inSec, outSec, enabled: true })` and `GLActions.run('stems.applyPracticeMode', { mode: 'mute-stem', stemId })` to re-arm the saved loop and stems. Resume chip text: dynamic via `describe()` — shows song title + section label ("Loop 0:12-0:29") + age string ("4 min ago") so the user knows exactly what they're returning to. **Save hooks** in song-detail.js wrap `_sdStemsToggleLoop`, `_sdStemsSetLoopIn`, `_sdStemsSetLoopOut`, `_sdStemsApplyPreset`, `_sdStemsResetPresets` with two new helpers `_sdNotifyPracticeSessionLoop()` and `_sdNotifyPracticeSessionStems(stemId)` that call `PracticeSession.update()`. Both helpers gate on `PracticeSession.has()` so rehearsal-flow opens of the chart overlay don't accidentally write practice-session state. **30s heartbeat** in rehearsal-mode.js: `_rmStartPracticeHeartbeat` starts a setInterval when `openRehearsalModePractice()` is called, calling `PracticeSession.touch()` each tick to keep `updatedAt` current; `_rmStopPracticeHeartbeat` clears it on `closeRehearsalMode`. **Practice entry screen subscribes to `practiceSessionChanged`** so the Resume chip refreshes live when the chart overlay updates session state via the save hooks. **Phase 2D (in-session GrooveMate pill) was deemed already-shipped.** Existing `ruleStemsLoopDeepen` in `js/core/gl-groovemate.js:84-110` already fires when the user loops the same section 3x and suggests "Mute the guitar and play along?", and `_sdGmRefreshHint` at `song-detail.js:3176` already renders the pill UI inside the chart overlay with Apply/Dismiss buttons. Adding a duplicate `practice-*` rule would be feature creep without clear benefit. Future rule additions (loop-this-section, record-a-take) can layer on top using the same pill surface. **Build cadence today:** Wave 1 closure + 5 Wave 1 follow-ups (`20260509-002659` → `015637`) → Wave 2 ship (`021107`). 9 atomic 4-source bumps total this session. **Files changed in Wave 2 (commit `1fbc6662`):** `js/core/gl-practice-session.js` (NEW), `js/features/practice.js` (Resume wiring + mode mapping), `js/features/song-detail.js` (4 setter hooks), `rehearsal-mode.js` (heartbeat lifecycle), `index.html` + `index-dev.html` (script tag), `service-worker.js` + `version.json` (atomic build bump). **Open follow-ons for tomorrow's review:** (a) verify Resume on production — open Practice → Start Practice on any song → set a loop → close → return → "Resume: <title> · Loop <bounds>" should be enabled and clicking it should re-open the song with the loop pre-armed. (b) verify mode pre-config — pick "Harmony Practice" from More options → song picker → click any song → chart overlay should open and on Resume next time, vocals should mute. (c) consider whether to add a `practice-*` rule family if Drew wants Practice-specific suggestions distinct from the existing stems-*. (d) Wave 3 candidates: cross-device session sync (Firebase mirror behind feature flag), section-level readiness data feeding auto-loop on Improve a Song, dedicated "record a take" rule. **Drew's Wave 1 hold gate ("if user can't start in one click, stop and fix before adding session persistence") was already cleared with the 5 follow-up commits earlier in the session — Wave 2 only proceeded once that was true.** Drew said "I will wake up tomorrow to review" — recommendations: hard reload, walk the Wave 1 acceptance test first, then walk the Wave 2 verification list above._

_Updated: 2026-05-09 (early AM, build `20260509-015637`) — **Practice Page Wave 1 + 3 follow-up fixes complete; ready to pivot.** Five commits across the evening: `c94e613b` Wave 1 entry screen → `fcbf938e` solo Practice mode flag + Gig Prep gig-aware list → `dd516608` Gig Prep finds-next-automatically + lists-the-rest → `c3a9acfe` Practice in NAV_CORE + Learn shows full library + add-new paths. **What's now in production:** Section A renders one primary recommendation from `GLStore.getNowFocus()` with a single Start Practice button; Section B has 3 chips above-fold (Resume disabled until Wave 2 / Gig Prep / Improve a Song) plus a More-options expander revealing 3 more (Learn New / Harmony / Lyrics-Chords); Practice is in the always-visible left rail at NAV_CORE position 2 (between Songs and Rehearsal); solo Practice mode flag in `rehearsal-mode.js` (`_rmIsPracticeMode`) hides the Band Sync bar and skips the post-session "Rehearsal saved" modal — chart overlay opens clean for solo work; Gig Prep modal pulls upcoming gigs via `getGigsAsync()` (works on cold cache), shows next gig as primary with songs-needing-work, then lists every other upcoming gig at bottom for click-to-switch context; Learn a New Song picker shows full library (active + inactive) with status badges on every row plus a "Don't see it?" footer with paths to the Songs library and the chart-import modal. **Wave 1 acceptance gate cleared:** user can open Practice → see one clear recommendation → start in one click OR pick a clear alternative without thinking. **Constraints honored throughout:** 1 primary + 3 above-fold strict; hardcoded the 3 priority flows; session-scoped state only (no TTL / long-term memory); no SYSTEM LOCKs touched; mode enum locked in for Wave 2 (`'focus' | 'part' | 'harmony' | 'learn' | 'chart'`) but unused this session — Wave 1 doesn't materialize sessions yet. **Files changed across the session:** `js/features/practice.js` 720 → ~1100 lines (added _pmRenderSectionA/B, _pmShowGigPrep stack, _pmShowSongPicker, _pmOpenSolo, _pmFormatGigDate, _pmGigKey, _pmGigPrepUpcoming cache, focusChanged subscription, full CSS); `rehearsal-mode.js` (3 entry points + _rmRenderSyncBar gated on _rmIsPracticeMode); `js/ui/gl-left-rail.js` (Practice promoted from NAV_MORE → NAV_CORE position 2); `index.html` + `index-dev.html` (mobile fallback adds Practice). **Build bump cadence:** `20260509-002659` → `012920` → `014212` → `014720` → `015637` (5 atomic 4-source bumps; deploy protocol per memory). **Pivot point:** Wave 2 (PracticeSession persistence + Resume + pre-configured sessions + in-session GrooveMate suggestion pill) is the natural next major increment — estimated 13-17 hours per the original Plan agent. Three other live threads still open from earlier today: Twilio A2P 10DLC campaign `CM477976503ab1334d5...` is in carrier review (~5 business days from 2026-05-08 = ~2026-05-15), all SMS sends to US numbers blocked until that flips to Approved; P0.1 lazy-load expansion soak day 1+ for social/notifications/playlists, day 2+ for finances; band-wide UAT continues with band running on the freshly-shipped Practice surface. Drew said "Ready to move on" — Wave 1 is feature-complete and shippable. Wave 2 begins immediately in a follow-on autonomous run._

_Updated: 2026-05-09 (early AM, build `20260509-012920`) — **Practice Page redesign Wave 1 shipped: "guided autonomy" entry screen.** Replaces the Focus tab content (Mixes tab untouched) with one primary recommendation (Section A, sourced from `GLStore.getNowFocus()`) and three control chips (Section B: Resume disabled in Wave 1, Gig Prep, Improve a Song) plus a "More options" expander revealing Learn New Song / Harmony Practice / Lyrics & Chords. Acceptance test passes by design: user opens Practice → sees one clear recommendation → can start practicing in one click OR choose a clear alternative without thinking. **Constraints honored:** 1 primary + 3 above-fold strictly enforced; hardcoded the 3 priority flows (Gig Prep, Improve, Resume) per Drew's "do not over-generalize with a config engine yet"; session-scoped dismissals only (no TTL / long-term memory yet — that's Wave 2 territory); no SYSTEM LOCKs touched. **Mode enum locked in for Wave 2** as `'focus' | 'part' | 'harmony' | 'learn' | 'chart'` (musician intent, not mechanics) — Wave 1 doesn't materialize sessions yet so the enum is documented but not used. **Architectural choices:** Section A subscribes to `focusChanged` (CLAUDE.md §7b SYSTEM LOCK contract — consumed only, never emitted) and re-renders when Practice is the visible page and Focus is the active tab. New `[PERF] practice-entry-rendered <ms>` log tracks entry SLA against the <1s music-surface target from `feedback_music_surface_sla.md`. Removed `_fillPracticeWeakSongs` and `_fillPracticeReadiness` (Focus-tab fill helpers) — replaced by getNowFocus() + Section A primary card. Removed `window._pmStartSession`; replaced by `window._pmStart(focusType, songTitle)` orchestrator with hardcoded paths for 'recommended', 'gig-prep', 'resume'. Added `_pmShowSongPicker(focusType)` modal with search input, used by all 4 picker-driven chips (Improve / Learn / Harmony / Lyrics-Chords); Wave 2 will pre-configure loop region, stems mix, notes/lyrics visibility per focus type. **Files changed:** `js/features/practice.js` 720 → 792 lines (+72 net after replacing dead code). Build bumped atomically to `20260509-012920`. **Commit:** `c94e613b`. **Wave 2 (next):** ship `PracticeSession` model in `js/core/gl-practice-session.js` + Resume capability + pre-configured sessions + in-session GrooveMate suggestion pill. Estimated 13–17 hours per the original Plan agent breakdown. **Hold gate:** Drew said "If [acceptance] is not true, stop and fix before adding session persistence." Verify Wave 1 acceptance after this build deploys (~60s) before proceeding._

_Updated: 2026-05-08 (late evening, build `20260509-002659`) — **Twilio A2P 10DLC campaign resubmitted after 1st-round carrier rejection. Status: "In progress" — under carrier review, ~5 business day turnaround.** Prior campaign `CMdd0bfeb64c9bd73e50e556016201030b` was rejected 2026-05-07 with generic "did not meet registration requirements" wording. Drew shared the official Twilio A2P 10DLC Campaign Onboarding Guide (https://help.twilio.com/articles/11847054539547) which surfaced **five specific root causes** that all needed addressing simultaneously, none of which were called out by name in Twilio's rejection notice. **Path C taken — keep Sole Prop registration, reconcile DBA in description text.** Path A (form entity, get EIN, register Standard Brand "GrooveLinx" — $44 brand fee + parallel registration) noted in memory as the upgrade path when volume or business posture demands it (currently ~3,000 segments/day cap on major networks, 1,000/day T-Mobile, single 10DLC number). **Five rejection causes addressed:** (1) **Behind-login + in-app opt-in flow had no publicly-accessible screenshot URL in Message Flow field** — guide §"Providing proof when opt-in isn't publicly visible" is explicit that this is required for both behind-login pages AND in-app flows (GrooveLinx is both). Captured a clean screenshot in incognito mode (Image #7 from Drew, build `20260509-002659`, post-verbiage-fix) showing the SMS Notifications card in pre-opt-in state with placeholder phone field, gray Enable button, and verbatim disclosure visible. Saved as `sms-opt-in-screenshot.png` in repo root, served at `https://app.groovelinx.com/sms-opt-in-screenshot.png`. (2) **Brand-name vs message-name mismatch** — Sole Prop brand registers as "Andrew Merrill" but messages use "GrooveLinx:" prefix. Fixed by opening the new campaign description with: *"Messages are sent by GrooveLinx (operated by Andrew Merrill, sole proprietor — DBA filed under that name) to..."* Reconciled across `privacy.html`, `terms.html`, `sms-opt-in.html` headers and signatures. (3) **Embedded-links boolean mismatched samples** — original samples had no URLs but "embedded links: Yes" was checked. New samples #2/#3/#5 contain `app.groovelinx.com` URLs. (4) **Privacy policy CTIA opt-in-data-exclusion language was too narrow** — original said "phone numbers are never shared with third parties for marketing"; guide requires explicit "mobile information and SMS opt-in consent data are not shared with third parties or affiliates for marketing or promotional purposes." Verbatim language now in `privacy.html` plus restatement in `sms-opt-in.html` privacy section. (5) **Terms missing carrier-liability disclosure** — guide requires verbatim "Carriers are not liable for any delayed or undelivered messages" (different from saying GrooveLinx isn't liable). Added to `terms.html` §5 as a bolded standalone statement plus Program Name + Program Description headers and bolded HELP/STOP keywords as required. **Bonus fix:** US fee disclosure verbiage requires verbatim "Message and data rates may apply" — original in-app disclosure (`app.js:10407`) and opt-in confirmation SMS (`app.js:10483`) used abbreviated "Msg & data rates may apply" / "Msg frequency varies (typically a few/week)". Updated both to the verbatim full forms. Build bumped atomically `20260508-233715` → `20260508-002659` → `20260509-002659` per the deploy protocol. **Three commits this evening:** `a5f09aaf` (rewrite privacy/terms/sms-opt-in.html with all 5 guide-aligned changes) → `de94cd3f` (initial screenshot, later replaced) → `63109383` (verbatim Message wording in app.js + atomic build bump) → `75f8c7e6` (replacement screenshot showing the new verbatim text). **New campaign details:** SID `CM477976503ab1334d5...`, created 2026-05-08, use case Sole Proprietor, connected Messaging Service `MG70657b62c45c0a77bf4b0721d552553c` (the same one as the rejected campaign — kept to avoid Worker `TWILIO_MESSAGING_SERVICE_SID` secret rotation), brand `BN690df404c69f445c14c1be8383f1de93` "Andrew Merrill" Registered. **5 dormant Sole-Prop Messaging Services parked** (test/onboarding cycle artifacts) — clean up after approval, not before, to avoid breaking sends mid-flight. **SMS sends remain blocked** until campaign moves from "In progress" → "Approved" — until then, US sends fail with 30034. Don't test SMS-send features during the wait. **Memory updated:** `project_notification_system.md` Layer 3 SMS section refreshed with current state. **New memory created:** `project_a2p_10dlc_submission.md` codifying the 5 rejection causes + bonus rules so a future session can hit submission right the first time. **Open follow-on:** if approval lands, reply STOP test from a band-member phone to verify opt-out keyword routing through the worker; if rejection lands, fetch the specific carrier reason via Twilio support (which Drew now knows to ask for explicitly)._

_Updated: 2026-05-08 (very late PM, build `20260508-233715`) — **P0.1 lazy-load expanded from finances pilot to social + notifications + playlists.** Drew opted to ship 6 days into the planned 7-day soak (pilot started this morning); risk-managed by stub coverage rather than soak duration. **Three eager `<script>` tags removed** from `index.html` + `index-dev.html` (`js/features/social.js`, `js/features/notifications.js`, `js/features/playlists.js`) — replaced by a single explanatory comment block. Pages now hydrate on demand via the existing `_glPageScripts` map in `js/ui/navigation.js` (entries already present from prior infra work; only the eager tags were holding them back). **Cross-page entry-point regression caught and fixed pre-push:** `notifications.js` exports three symbols called from outside the Notifications page — `glShowInviteModal` + `glCopyInviteLink` (inline `onclick` handlers in `home-dashboard.js:2867-2868` "Invite Bandmates" / "Copy Invite Link" buttons) and `notifFromPracticePlan` (rehearsal share button at `rehearsal.js:5760`). Without coverage, clicking those buttons before ever visiting Notifications would throw `ReferenceError`. Added new `_glStubLazy(name, src)` helper in `js/ui/navigation.js` (sibling to the existing `venueShortLabel` stub pattern) that intercepts the first call, fires `glLazy('js/features/notifications.js')`, then re-invokes the now-real function. After the first call all three globals point to the real implementations for the rest of the session. **Pre-push grep audit covered all three lazy targets.** social.js has zero external callers (only `navigation.js` references it, which already lazy-loads via the renderer map). playlists.js has multiple `app.js` callers (`plPlayerRender` from listening-party Firebase listener, `plLoadIndex` from `plEdSave`) but they're all transitively gated — `_partyListener` only attaches inside `joinListeningParty()` which is reachable only via the Playlists page UI; `plEdSave` only fires from the editor save button reachable only via the same UI. By the time those code paths run, `playlists.js` has been loaded by `_glLazyLoadPage('playlists')`. No additional stubs needed. **Files changed:** `index.html` + `index-dev.html` (3 script tags → 1 comment block, build version bumped 124 sites each), `js/ui/navigation.js` (new `_glStubLazy` helper + 3 stub registrations, ~22 lines added at line 354), `service-worker.js` (CACHE_NAME bumped), `version.json` (atomic). **Build:** `20260508-233715`. **Commit:** `020151af`. **Soak watch:** social/notifications/playlists soak begins now; finances pilot rolls into day 2 of 7. **Cumulative P0.1 progress:** 4 of 4 candidate routes lazy-loaded (finances + social + notifications + playlists). Plan note: do NOT expand to calendar.js / rehearsal.js / home-dashboard.js until P1.6 file decomposition lands first (per `optimization_plan.md` direction)._

_Updated: 2026-05-08 (very late PM — P1.1 phases 11–29 shipped, build `20260508-230928`) — **Big session: store dropped from 5,585 → 1,036 lines (-81%) across 19 additional extractions in one sitting.** Cumulative this session: 6,814 → 1,036 lines (-85%, -5,778 lines, 28 modules total). All slices verified by fresh post-push trace. **Modules shipped this run (in order):** Phase 11 `gl-rehearsal-agenda` (828 lines, agenda+session+scorecard+practice stats); Phase 12 `gl-band-admin` (238, invitations+voting+library health); Phase 13 `gl-locations` (223, venues+rehearsal locations); Phase 14 `gl-rehearsal-timeline` (269, segmentation+pocket+history); Phase 15 `gl-data-audit` (758, gig/setlist/calendar audit+migration debug); Phase 16 `gl-rehearsal-intel` (404, rehearsal+attempt+dashboard intel); Phase 17 `gl-roles-coverage` (212, BAND_ROLES+backup players+gig coverage); Phase 18 `gl-rehearsal-scheduling` (519, cadence+scoring+recommendations engine — also fixed two pre-existing bugs `_dbSet` + `_memberKeys` undefined references); Phase 19 `gl-band-metrics` (129, activity log+page views+retention); Phase 20 `gl-transition-intelligence` (141, per-pair confidence); Phase 21 `gl-schedule-blocks` (312, unified scheduling model); Phase 22 `gl-collection-caches` (153, setlists+gigs+SWR); Phase 23 `gl-status-migration` (162, console-driven legacy status audit/migrate); Phase 24 `gl-rehearsal-recordings` (148, pocket/groove + practice mixes); Phase 25 `gl-song-coach-signal` (145 — also fixed silent `_members()` bug that had been failing inside try/catch); Phase 26 `gl-shell-state` (281, page+panel+app-mode+now-playing+derived selectors); Phase 27 `gl-song-value` (113, priority+gap+signals math); Phase 28 `gl-selection` (135, active song + selection cluster); Phase 29 `gl-cache-setters` (79, status+readiness write side). **`_state` keys lifted (Tier B, 19 keys total this session):** `transitionIntelligence`; `setlistCache`+`gigsCache`; `grooveCache`+`mixCache`+`mixCacheTs`; `activeSongId`; 10 shell-state keys (`activePage`, `rightPanelMode`, `navCollapsed`, `mobilePanelState`-dead, `appMode`, `nowPlayingSongId`, `liveRehearsalSongId`, `currentBandId`, `currentSnapshotRange`, `restoreState`); `songPracticeStats` (in `gl-rehearsal-agenda`). **Pattern protocol locked in:** pre-push grep audit for bare-identifier references caught real orphans on phases 11, 16, 17, 19 — saved 4 IIFE crash bugs from shipping. Detailed in [`specs/store_split_audit.md`](./specs/store_split_audit.md) §"Final State". **Commits this session (after handoff at phase 10):** P1.1 phase 11 hot-fix `1cd87293`; phases 11–20 via 10 commits ending at `c5d325a2` (phase 21); phases 22–25 batched as `ee2f6488`; phases 26–29 batched as `5f6a35c4`. **Build:** `20260508-230928`. **Stopping at phase 29 — explicit decision.** The remaining 1,036 lines are foundational scaffolding (event bus, dep-readiness gate, helpers, songs index, songs_v2 dual-path, song detail writes, readiness writes, full cache accessors, the public-API export object). Further splitting would shave ~80 more lines across 3 trivially-small modules (`gl-field-history`, `gl-current-timeline`, `gl-active-lens`) at the cost of 3 more cross-module bridges. Net cost > benefit. **Next P1 thread should be a different concern** — see CLAUDE_HANDOFF for candidates._

_Updated: 2026-05-08 (late PM, P1.1 phase 10 — gl-love extracted, build `20260508-210419`) — **The Love system is now its own module.** Largest single extraction by line count this session. Moved 4 cache objects (`_bandLoveCache`, `_audienceLoveCache`, `_personalBandLoveCache`, `_personalAudienceLoveCache`) + 13 functions (4 save × 4 get × 2 disagreement + `deriveSongStatus` + 3 internal preloaders + the retry-loop pair) into `js/core/gl-love.js` (~371 lines). **5 internal store callers rewritten** (`getSongPriority`, `getSongGap`, `getSongSignals`, `getBandPreferences` + the moved `deriveSongStatus`) to read love values via `window.GLStore.getBandLove()` / `getAudienceLove()` runtime lookups instead of direct closure access. Module owns its own `beforeunload` listener for the preload retry timer; the store's `_glCleanup` no longer calls `_stopLovePreload`. Local duplicates of `_db`/`_bp`/`_sanitize`/`_emit` helpers (small, pure — duplicate is cleaner than threading them through). **Files changed:** `js/core/groovelinx_store.js` (-309 lines, now 5,585), `js/core/gl-love.js` (NEW, 371 lines), `index.html` + `index-dev.html`, `service-worker.js` + `version.json`. **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 5,585 lines (-1,229 / -18% across 9 commits / 9 extractions). Nine slices extracted. **`groovelinx_store.js` crossed under 5,600 lines** for the first time. **Open items:** `gl-rehearsal-agenda` (~700 lines, large + complex, multi-section). Several smaller residuals could go too (band invitations, schedule blocks, venue cache, etc.). Or pause for a clean session-close handoff and fresh trace verification of the Love extraction (this one has more behavioral surface than most — every "love score" UI element depends on it)._

_Updated: 2026-05-08 (late PM, P1.1 phase 9 — gl-product-mode extracted, build `20260508-204657`) — **Tiny mostly-deprecated helper extracted in ~10 minutes.** Moved `VALID_MODES` + `MODE_PAGES` (null) + `MODE_LANDING` (null) + `setProductMode` + `getProductMode` + `getModePages` + `isPageVisibleInMode` out into `js/core/gl-product-mode.js` (~59 lines). Lifted `_state.productMode` out of the store's `_state` object — the new module's closure owns `_currentMode` initialized from the same localStorage key (`gl_product_mode`). Updated the `[GLStore loaded (mode: …)]` boot log to read directly from localStorage so it doesn't break when `_state.productMode` no longer exists. Three external callers (gl-avatar-guide, avatar_feedback_context, home-dashboard) all use `GLStore.getProductMode()` with null-checks, unchanged. **Files changed:** `js/core/groovelinx_store.js` (-44 lines, now 5,894), `js/core/gl-product-mode.js` (NEW, 59 lines), `index.html` + `index-dev.html` (script tag inserted after `gl-focus.js`), `service-worker.js` + `version.json` (build bumped). **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 5,894 lines (-920 / -13.5% across 8 commits / 8 extractions). Eight slices extracted. **Open items:** `gl-love` (~300 lines, intertwined with focus — but focus already moved out, so love's now decoupled), `gl-rehearsal-agenda` (~700 lines, large + complex). Or pause for a clean handoff at end of day._

_Updated: 2026-05-08 (late PM, P1.1 phase 8 — gl-focus extracted, build `20260508-203356`) — **The SYSTEM-LOCKED Focus Engine is now extracted.** Moved `_focusCache` + `_focusCacheTime` + `getNowFocus()` + `invalidateFocusCache()` (lines 1102-1198 of pre-extract store, ~97 lines) into `js/core/gl-focus.js`. **CLAUDE.md §7b SYSTEM LOCK contract preserved exactly:** `invalidateFocusCache()` still emits `'focusChanged'` (now via `GLStore.emit()` from the new module's body); same 30s TTL; identical `[FocusEngine]` console logs; same scoring formula. **Cross-module reads handled:** closure access to `_bandLoveCache` / `_audienceLoveCache` (still in store closure for love system) swapped to `GLStore.getBandLove()` / `getAudienceLove()` runtime lookups; `_state.setlistCache` / `_state.gigsCache` swapped to `GLStore.getSetlists()` / `getGigs()` (existing exported getters); `getSongPriority` swapped to `GLStore.getSongPriority()`; `ACTIVE_STATUSES` swapped to `GLStore.ACTIVE_STATUSES` with literal fallback. **Verified safe by grep:** 4 external `invalidateFocusCache` callers (recording-analyzer.js, rehearsal-analysis-pipeline.js, app.js × 2) and 12+ `getNowFocus` callers (gl-avatar-guide, gl-context, songs.js, home-dashboard.js × 7+, etc.) all use the existing `window.GLStore.*` shape with null-checks. **Files changed:** `js/core/groovelinx_store.js` (-91 lines, now 5,939), `js/core/gl-focus.js` (NEW, 128 lines), `index.html` + `index-dev.html` (script tag inserted after `gl-leader.js`), `service-worker.js` + `version.json` (build bumped). **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 5,939 lines (-875 / -12.8% across 7 commits / 7 extractions). Seven slices extracted. **Coupling patterns proven:** all 6 from prior extractions plus SYSTEM-LOCKED-with-cross-module-reads (Phase 8). **`groovelinx_store.js` has now crossed below 6,000 lines for the first time.** **Open items:** Smaller residuals (gl-product-mode ~50 lines, gl-love ~300 lines) and large items (gl-rehearsal-agenda ~700 lines, complex). Or pause to capture a fresh trace and verify focusChanged subscribers (Home, Songs, Rehearsal) still re-render correctly._

_Updated: 2026-05-08 (late PM, P1.1 phase 7 — gl-leader extracted, build `20260508-201731`) — **Band Sync V1 extracted; first Tier-B slice that needed `_state` lift-out.** Moved 17 functions (3 helpers + 13 public API + 1 internal cleanup), 3 closure-private vars (`SYNC_HEARTBEAT_INTERVAL`, `SYNC_STALE_THRESHOLD`, `_syncStaleCheckInterval`), and 5 `_state.sync*` sub-keys into a new `js/core/gl-leader.js` (~365 lines). The 5 sub-keys (`syncSession`, `syncRole`, `syncFollowing`, `syncListener`, `syncHeartbeat`) now live in a private `_sync` cluster owned by the new module — none of the other slices read them, so the lift was clean per the Phase 2 audit. **Largest single extraction this session at 309 lines stripped from store.** Module owns its own `beforeunload` listener for cleanup; the store's `_glCleanup` no longer calls `_syncCleanup` (already updated to remove that block). Reaches `window.GLStore.emit()` at runtime for `syncStateChanged` and `syncSongChanged` events. **Drove down to no consumers in the codebase yet** — Band Sync V1 is dormant code, no UI surface wired up. That made this extraction lower-risk than the line count suggested. **Files changed:** `js/core/groovelinx_store.js` (-309 lines, now 6,030; also dropped 5 `_state.sync*` keys from the state object and 13 export entries), `js/core/gl-leader.js` (NEW, 365 lines), `index.html` + `index-dev.html` (script tag inserted after `gl-intelligence.js`), `service-worker.js` + `version.json` (build bumped). **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 6,030 lines (-784 / -11.5% across 6 commits / 6 extractions). Six slices extracted, six different coupling profiles validated. **Patterns now proven:** window-IIFEs, localStorage closure-private, DOM-helper-with-lifecycle, cross-module function calls, cross-module event subscription + internal-call rewrite, **`_state.*` sub-key lift into private cluster** (new this phase). **Open items:** Phase N = `gl-focus` is the last big ticket — SYSTEM-LOCKED per CLAUDE.md §7b, depends on `_bandLoveCache` from love system. Smaller residuals also possible: gl-product-mode, gl-love, gl-rehearsal-agenda. Or pause + capture a fresh trace to soak Phase 7._

_Updated: 2026-05-08 (late PM, P1.1 phase 6 — gl-intelligence extracted, build `20260508-200346`) — **Combined Song Intelligence + Practice Attention extraction.** Audit named these as two separate slices (Phase 6 + Phase 7); merged into one module since both share the `SongIntelligence` engine, the same invalidation triggers (`readinessChanged`, `songFieldUpdated.status`), and have similar caching shape. New `js/core/gl-intelligence.js` (~200 lines) holds `_intelligenceCache`/`_intelligenceCacheTs`/`INTEL_CACHE_TTL` + 4 intelligence functions (Song / Catalog / Gaps / Recommendations) + `_attentionCache`/`_attentionCacheTs`/`ATTENTION_CACHE_TTL` + 1 attention function. Subscribes to events via `GLStore.on()` at load time. Reads `getAllReadiness` / `getAllStatus` / `getSongs` / `getSetlists` via runtime `window.GLStore.*` lookups. **Validates two new patterns:** (a) cross-module event subscription — the new module `GLStore.on('readinessChanged')` from outside the store IIFE; (b) replacing internal store-to-store closure calls — `getSongCoachSignal` (which stays in the store) used to call `getSongIntelligence(songId)` and `getSongGaps(songId)` directly via closure; rewrote those two call sites to use `window.GLStore.getSongIntelligence(songId)` etc. with null-check. **Files changed:** `js/core/groovelinx_store.js` (-149 lines, now 6,339), `js/core/gl-intelligence.js` (NEW, 200 lines), `index.html` + `index-dev.html` (script tag inserted after `gl-onboarding.js`), `service-worker.js` + `version.json` (build bumped). **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 6,339 lines (-475 across 5 commits / 5 extractions). Five slices extracted, each validating a different coupling profile. **Open items:** Phase 7+ = harder slices (`gl-leader` needs `_state.sync*` strategy, `gl-focus` is SYSTEM-LOCKED). Or pause + capture a fresh trace to soak Phase 6._

_Updated: 2026-05-08 (late PM, P1.1 phase 5 — gl-onboarding extracted, build `20260508-195933`) — **`gl-onboarding` extracted from `groovelinx_store.js`.** Moved 1 closure var (`_onboardingState`) + 5 functions (`evaluateOnboardingState`, `getOnboardingState`, `getOnboardingProgress`, `isBandActivated`, `dismissOnboardingCard`) from lines 5262-5330 of pre-extract store (~70 lines) into `js/core/gl-onboarding.js`. **First slice that validates cross-module access** — the extracted functions reach `GLStore.getSongs` and `GLStore.emit` via runtime `window.GLStore.*` lookups (was direct closure access before). Both calls null-check before use so brief absence during load is safe. **Audit estimate was 250 lines; actual was 70** because the audit grouped the adjacent Band Invitations block (5332+) which is its own concern (database I/O for invite records, separate from the onboarding state machine). **Files changed:** `js/core/groovelinx_store.js` (-69 lines, now 6,488), `js/core/gl-onboarding.js` (NEW, 90 lines), `index.html` + `index-dev.html` (script tag inserted after `gl-status-badge.js`), `service-worker.js` + `version.json` (build bumped). **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 6,488 lines (-326 across 4 commits / 4 extractions). Four slices extracted, each validating a different coupling profile: window-IIFEs (Phase 1), localStorage-only closure-private (Phase 3), DOM-helper with own lifecycle (Phase 4), cross-module function calls (Phase 5). **Open items:** Phase 6 = `gl-intelligence` + `gl-attention` (small caches, similar profile to onboarding). Phase 7+ = harder slices (`gl-leader` needs `_state.sync*` strategy)._

_Updated: 2026-05-08 (late PM, P1.1 phase 4 + trace-driven follow-ups logged, build `20260508-163917`) — **`gl-status-badge` extracted from `groovelinx_store.js`.** Moved 3 closure vars (`_glStatusBadgeEl`/`_glStatusBadgeState`/`_glStatusBadgeTimer`) + `setGlobalStatus` function + co-located `online`/`offline` window listeners (lines 1920-1965 of pre-extract store, ~46 lines) into `js/core/gl-status-badge.js`. The new module owns its own `beforeunload` listener for timer cleanup, so the store's `_glCleanup` hook no longer references `_glStatusBadgeTimer` — that comment block was updated. Pure DOM-helper, zero coupling to store's `_state` or event bus. Validates moving slices that own window event listeners + their own lifecycle. **Consumers (setlists.js, calendar.js, app.js)** all call `if (GLStore.setGlobalStatus) GLStore.setGlobalStatus(...)` with null-checks, so the load-time attachment timing is non-blocking. **Files changed:** `js/core/groovelinx_store.js` (-46 lines, now 6,557), `js/core/gl-status-badge.js` (NEW, 73 lines), `index.html` + `index-dev.html` (script tag inserted after `gl-groovemate-memory.js`), `service-worker.js` + `version.json` (build bumped). **Trace-driven follow-ups logged** in `optimization_plan.md` for future sessions: F1 silence misleading `[GLStore] Ready timeout` warning when 800ms ceiling already rendered; F2 investigate slow `[Members] Loaded` (5.7s after firebase-ready, causes F1's timeout); F3 deduplicate `showPage('songs')` × 2 on `?page=` deep-links. **P1.1 cumulative this session:** `groovelinx_store.js` 6,814 → 6,557 lines (-257 across 2 commits). Three slices extracted (decision-language window-IIFEs, GrooveMate-memory closure-private, status-badge with own lifecycle). Pattern proven for three different coupling profiles. **Open items:** Phase 5 = `gl-onboarding` (~250 lines, 1 closure var, depends on `GLStore.getSongs()`). Phase 6 = `gl-intelligence` + `gl-attention`. Phase 7+ = harder slices (gl-leader needs `_state.sync*` strategy)._

_Updated: 2026-05-08 (late PM, P1.1 phases 2 + 3 + two trace-driven follow-up fixes, builds `20260508-153813` and `20260508-155606`) — **P1.1 split moved through three further increments in one sitting plus two regressions fixed mid-stream from Drew's iPhone trace.** (1) **`20260508-153813` follow-up fixes from the trace.** Songs page sat ~2.2s on a "Loading songs..." skeleton waiting for `_preloadSongDNA` after the songs library had already loaded. The skeleton gate at `songs.js:84` required BOTH songs AND dna ready, but DNA fields (key/bpm/lead) only populate chips and the triage CTA — the song titles themselves are usable without them. Fix: drop DNA from the master gate; render songs immediately after `markReady('songs')` in `app.js`, then re-render after DNA loads to fill in chips. The triage CTA bar at `_renderTriageBar()` is already separately gated on `_glDnaPreloaded` so it stays empty until DNA arrives — no inflated counts during the early paint. New `[PERF] songs-rendered-bare <ms>` log measures the early paint. **Second fix in the same build:** `renderHomeDashboard` was firing twice during a deep-link to `?page=songs` even though page-home was hidden. Root cause in `invalidateHomeCache`: the visibility check `hp.style.display !== 'none'` only reads INLINE style, but pages are hidden via the `.hidden` class (CSS `display:none!important`). The inline check returned true for hidden home and triggered wasted full renders on every readiness/data invalidator. Switched to `getComputedStyle(hp).display !== 'none'` so both inline and CSS-set display:none are honored. Inline check kept as catch-fallback. Eliminates two wasted renders observed in the trace (4753ms script-load + 5647ms post-readiness, ~1050ms each on a slow trace). (2) **P1.1 phase 2 — closure-coupling audit (no code).** Mapped every closure-private variable (60+) in `groovelinx_store.js` by feature area, scored each extractable slice by closure vars / `_state` coupling / external globals / line count, ranked by extraction risk. Deliverable: `02_GrooveLinx/specs/store_split_audit.md`. Two Tier-A candidates surfaced (move-function-and-state-together, no namespace surgery): `gl-groovemate-memory` (50 lines, 2 constants, zero `_state` coupling, localStorage-only — smallest possible first move) and `gl-status-badge` (70 lines, 3 vars, DOM helper). Tier-B candidates (need shared `_GLStoreInternal` namespace or `_state.*` lift-out): `gl-leader` (4 sync sub-keys live in `_state`), `gl-product-mode`, `gl-focus`. Tier-C deferred: `gl-rehearsal-agenda` (too large), `gl-love` (intertwined with focus). (3) **`20260508-155606` P1.1 phase 3 — `gl-groovemate-memory` extracted.** First in-IIFE extraction. Moved `GM_KEY`/`GM_CAP` constants + `_gmLoad`/`_gmSave`/`_gmAppend` helpers + `getGroovemateMemory`/`recordGroovemateDecision`/`recordGroovemateDismissal`/`recordGroovemateAccepted`/`clearGroovemateMemory` (lines 6544-6595 of pre-extract `groovelinx_store.js`, ~52 lines) into a new `js/core/gl-groovemate-memory.js`. The new file's IIFE attaches its public methods to `window.GLStore` at load time (which is safe because the script tag loads after `groovelinx_store.js`). Verified runtime equivalence by reconstructing the original section as a stand-alone IIFE and running both against a stubbed `localStorage`+`window.GLStore` context across (a) API surface match, (b) operation result match for `clear→record×3→get`, (c) 20-cap behavior. All match. **Files changed across this session's three commits:** `js/features/songs.js`, `js/features/home-dashboard.js`, `app.js`, `js/core/groovelinx_store.js` (-52 lines, now 6,600), `js/core/gl-groovemate-memory.js` (NEW), `02_GrooveLinx/specs/store_split_audit.md` (NEW), `02_GrooveLinx/specs/optimization_plan.md` (Phase 1+2+3 marked done; Phases 4-7+N enumerated), `index.html` + `index-dev.html` + `service-worker.js` + `version.json` (build bumped twice atomically). **Commits this batch:** `87f664f4` (DNA gate fix + visibility fix) → `3e40a355` (Phase 2 audit doc) → next commit (Phase 3 extraction). **Status:** P1.1 cumulative — 217 lines moved out of `groovelinx_store.js` across 2 extractions. Pattern proven for both window-scoped (Phase 1) and closure-private (Phase 3) state. Next slice: `gl-status-badge` Phase 4 (~70 lines, DOM + window event listeners). Soak watch on Phase 3 before expanding._

_Updated: 2026-05-08 (late PM, P1.1 phase 1 — decision-language extraction, build `20260508-150622`) — **First incremental slice of `groovelinx_store.js` (6,814 → 6,648 lines, -166).** New session opened on the P1.1 split; chose a phased approach over the all-at-once plan in `optimization_plan.md`. Phase 1: extract `GLStatus` / `GLUrgency` / `GLPriority` / `GLScheduleQuality` to `js/core/gl-decision-language.js`. These were already self-contained `window.*` IIFEs at the BOTTOM of the file (lines 6649-6814), explicitly flagged as MODULARIZATION-READY in the source comment at line 6663 — zero closure coupling to the main store IIFE. Pure code move; verified byte-for-byte equivalence by running the original-section vs new-file in isolated `vm.createContext` against a battery of inputs across all four engines (28 test cases — readiness 0-5, days-out 0-30, all priority opt combos, schedule with/without score). All matched. **Why this first:** validates the load-order pattern (new file loads after `groovelinx_store.js` and before feature consumers — same effective evaluation order as before, since the engines were already at the file tail) without touching closure variables. Phases 2-N (gl-leader, gl-status-badge, gl-song-dna, gl-focus, etc.) require closure-variable strategy decisions and stay deferred to subsequent commits. **Build:** `20260508-150622`. Files changed: `js/core/groovelinx_store.js` (-166), new `js/core/gl-decision-language.js`, `index.html`, `index-dev.html`, `service-worker.js`, `version.json`. CLAUDE.md SYSTEM LOCK preserved (focusChanged event model + ACTIVE_STATUSES centralization + `_glCleanup` timer hook all live in store, untouched)._

_Updated: 2026-05-08 (PM, optimization-plan execution session, builds `20260508-122950` → `20260508-143102`) — **Full P0 round + 4 of 6 P1 items shipped in one sitting. 9 commits, 8 live builds, 1 deferred-as-non-issue, 1 Modal capability ship intentionally not wired up, 1 Firebase rules merge applied by Drew. Six race conditions in load_sequence.md now closed (was 7).** Drew picked up from the morning briefing and walked the optimization plan top-down per his revised execution order: P0.2 → P0.3 → P0.4 → P0.1 pilot → opportunistic P1 work. **Builds in chronological order:** **`20260508-122950` P0.2 hybrid** — first attempt at deep-link readiness was pure event-driven via `GLStore.ready(['firebase','members'], 5000)`; trace from Drew's iPhone showed 2.6s blank shell (worse than the original fixed-800ms timer). Pivoted to hybrid race: render shell at 800ms ceiling OR earlier if firebase+members ready first. Same trace surfaced two larger hot spots that became P1.7 + P1.2 phase 2. **`20260508-123518` P0.3 — central timer cleanup.** Audited every setInterval / recurring setTimeout in groovelinx_store.js. Sync heartbeat + stale check were correctly paired; status badge was self-bounded. Real leak: `_tryLovePreload` retry loop with no captured timer ID. Fixed via `_lovePreloadTimer` capture + `_stopLovePreload()` helper + new `GLStore.cleanup()` hook wired to existing `beforeunload`. **`20260508-125759` P0.4 — version-tracked update banner + reload hardening.** Most of the original brief was already shipped piecewise. Real gaps fixed: dismiss-then-newer-deploy bug (now tracks `_bannerShownForVersion` per-version); both update-poll setIntervals (SW reg.update + version.json poll) captured into module vars and cleared on `beforeunload`; reload button now listens for `controllerchange` (was fixed 400ms blind, now 1500ms safety net); new `window.glCheckUpdate()` debug hook. **`20260508-131319` P0.1 pilot — lazy-load `finances.js`.** Surprise: lazy-load infrastructure was already battle-tested by past-Claude (`glLazy()` + `_glPageScripts` + `_glLazyLoadPage()`). Finances was even already in the route map. Pilot was 1 line removed × 2 files. Soak watch is 1 week before expanding. **Modal Stage 3 deploy decision** — Drew successfully deployed the previously-failing image (G4NIHWDB / 7701PCEC). Image now bundles karaoke melband checkpoint + SepACap.pth. `split_vocals` + `sepacap_split` functions live but intentionally NOT wired to UI: 8-endpoint cap already at 8, Demucs already won the Phase 0 vocal bake-off 5/5 over MelBand-Roformer (per source comment at separator.py:1108-1112), SepACap is JaCappella-only training (35 Japanese a cappella children's songs — cross-genre untested). Memory file updated. **`20260508-133751` P1.7 — defer `_preloadLeadSingerCache` off boot critical path.** Original brief was misdiagnosed: blamed the 10s `[PERF] songs-with-dna` log on per-song DNA computation. Audit found the actual culprit was `_preloadLeadSingerCache` (200 songs × 20 sequential Firebase batches), not DNA. Fixed: first render gates on DNA only; lead-meta cache hydrates from `requestIdleCallback` after paint with re-render on completion. Six-line diff. New `[PERF] lead-meta-hydrated <ms>` log. **`20260508-134443` P1.2 phase 1 — coalesce home-dashboard renders.** Trace showed 1874ms then 4758ms (~2.9s of duplicated work). Two sources: explicit double-call at app.js:826-827 (removed); race between async invalidators (fixed via dirty-flag coalescer wrapping `window.renderHomeDashboard`). New `[PERF] renderHomeDashboard coalesced` log. **`20260508-135234` P1.4 — stems iOS gesture-arming + observability.** Real bug: `_sdStemsToggle` calls `audio.play()` AFTER `await _sdStemsCountIn()`, gesture context consumed. Fix: gesture-arm each `<audio>` synchronously before any await with `muted=true; play(); pause()`; logged catch (was silent); inline tap-to-start hint when all stems reject. Race condition #5 closed. **`20260508-140648` P1.5 phase 1 — calendar_events date-range helper.** Original brief assumed child-keyed storage (doesn't exist — RTDB stores as array node `{0:{...},1:{...}}`); 30+ call sites read full calendar_events and most genuinely need the whole array. Phase 1 ships `window.loadCalendarEventsByDateRange(start, end)` helper for new code; phase 2 (storage migration) deferred to P2 territory. Drew applied `.indexOn: ["date"]` rule via Firebase Console (merged with his existing rules tree). **P1.3 — DEFERRED-AS-NON-ISSUE.** Brief described intelligence layer recompute as too expensive. Audit: `getCatalogIntelligence` already 5s-TTL cached; `getSongIntelligence` is uncached but trivial (~5 ops); only 5 consumer call sites, none in tight loops; total compute = ~150 active songs × ~15 ops = microseconds; never appears in any captured trace as a hot spot. Trigger for revisit: any future feature that calls `getSongIntelligence` in a render loop, or active catalog past ~2000 songs. Lesson: gate effort on actual measured cost, not "it sounds expensive." **`20260508-143102` P1.2 phase 2 — memoize per-render aggregates over `allSongs`.** Six sub-render functions in home-dashboard each iterated allSongs → isActiveSong filter → call `GLStore.avgReadiness` per song. Per render: ~6 × 400 outer iterations × 1 readiness call each = ~2,400 calls (each allocating on Object.values/filter/reduce — ~24K small allocations per render, matters more on iOS than CPU suggests). Fixed: new `_homeAggregates(bundle)` helper does ONE pass per bundle, returns materialized `activeSongs: [{title, avg}, ...]` plus pre-bucketed counts. Cache invalidates by bundle reference (rotates automatically with `_homeDataLoad`). Tricky bug: `_renderBandStatusCompact` had a NESTED member-readiness loop deeper in the function that wasn't in the initial audit; fixed by switching it to iterate `_agg.activeSongs` too. **Status:** P0 round complete. P1 progress: P1.7 ✅, P1.2 phases 1+2 ✅, P1.4 ✅, P1.5 phase 1 ✅, P1.3 🚫 deferred. **Open items:** **P1.1 (split groovelinx_store.js — 6,792 lines, prerequisite for expanding the P0.1 lazy-load pilot)** is the natural next session priority. P1.6 (split calendar.js + rehearsal.js) follows. Both are 2-3 day jobs with cross-file consequences and warrant a fresh session start. **Lessons captured:** (1) Briefs written before traces existed routinely overestimated cost on the wrong axis (P1.5 assumed child-keyed storage; P1.4 referenced a non-existent watchdog pattern; P1.7 named the wrong function; P1.3 described a problem that doesn't exist). Always audit the actual code before committing to scope. (2) "Stop and surface" worked well twice (P1.5 and P1.3) — Drew got to choose between phase-1-only ship vs full migration vs skip. (3) `Promise.all` PERF logs measure the slower branch only; split co-located preloads into separate logs before locating cost. **9 commits this session:** `088bdf01` (P0.2 hybrid) → `87efd1f4` (P0.3) → `2c2aa11f` (P0.4) → `bc90e733` (P0.1 pilot) → `4d3e5617` (P1.7) → `33c2973b` (P1.2 phase 1) → `2063bea6` (P1.4) → `7a071736` (P1.5 phase 1) → `05487799` (P1.3 deferral + P1.2 phase 2)._

_Updated: 2026-05-08 (overnight, deep architecture documentation pass) — **Three new reference deliverables shipped while Drew slept.** He asked: "Really document that thoroughly and intuitively and visually... look for areas of opportunity or potential challenges, bugs, scalability, speed impacters and build out a thorough plan on how we could tackle optimizing in the future. Lastly, is there something about building what is loaded when so we can see sequencing of all functions and when you load them to know if we have hot spots we need to deal with to avoid sluggish startups or race issues." Three deliverables produced from real codebase audit data:_

_**1. `architecture-deep-dive.html`** at `app.groovelinx.com/architecture-deep-dive.html` — visual reference page (sibling to `stack-map.html`). Five sections each with a Mermaid diagram: §1 Shared Engines (20 modules with reach badges + consumer-screen cascade graph), §2 Field Cascades (8 load-bearing data fields → consumer engines, with insight callouts on why each matters), §3 Boot Sequence (11-phase startup flowchart with hot-spot + async-kickoff annotations), §4 Hot Spots (top 14 files ranked by line count + phase number), §5 Race Conditions (7 identified, with status closed/planned/open), §6 "What to do with this" playbook (refactor planning / bug triage / performance tuning). Dark theme matches stack-map; sticky TOC with active highlighting; smooth scroll; print mode; `noindex,nofollow` + robots.txt Disallow._

_**2. `02_GrooveLinx/specs/load_sequence.md`** — phase-by-phase walkthrough of 94 synchronous scripts loading on every page open. 11 phases mapped, every script listed with line-count + load-order position, top-level execution behavior documented. 7 race conditions catalogued with mitigations (current vs planned). "How to read a future boot trace" guide for DevTools / Safari timeline analysis. Identified Phase 9 (~50k lines of feature code) as the headline cold-start cost._

_**3. `02_GrooveLinx/specs/optimization_plan.md`** — prioritized P0/P1/P2/P3 roadmap with concrete effort + risk per item. **P0 (this week):** lazy-load feature pages by route (~3× cold-start improvement target), fix 800ms magic-number race on showPage timer, audit setInterval cleanup in groovelinx_store.js, SW versioning + reload prompt. **P1 (this month):** split groovelinx_store.js into focused modules, home-dashboard memoization (106 iterations counted), incremental intelligence, stems iOS gesture-arming, calendar_events date-indexed reads, split calendar.js + rehearsal.js. **P2 (this quarter):** Firebase SDK 10→12 migration, Stage-2 cal/gigs source-of-truth flip, Firebase Auth wiring, build system decision (need Drew approval), Sentry integration, mobile performance pass, Cloud Function observability. **P3 (research):** RTDB→Firestore consideration, SSR/static generation, Demucs replacement, native iOS app. Plus H1-H5 rolling hygiene (constants extraction, leveled logger, dead code audit, etc.). Roadmap visualized week-by-week. Estimated impact: 3× faster cold start, 3× smaller JS payload, 12× less calendar data transfer if P0+P1 ship._

_**Linkage:** All three new docs cross-link. Stack-map.html now has a prominent button to the deep-dive. Inventory file links to all three. Deep-dive links back to load_sequence + optimization_plan. vercel.json + robots.txt updated for the new HTML route._

_**Overnight commits (chronological, 9 total since Drew went to bed):** `47694d52` (mermaid fallback) → `78a151d8` (Modal URL fix; was 500ing) → `af787981` (Ultimate Guitar) → `fd0b6c99` (socials + share.groovelinx subdomain + iconforge sips) → `26071b90` (§11 internal features) → `37ecdd57` (§12 shared engines + field deps) → `8258b10e` (architecture deep-dive + load sequence + optimization plan). Plus earlier evening: gate cutover, Cloud Function infra, Node 24 across CF + CI, full software audit, multiple bumps. **Total tonight: 17 commits, ~3,000 lines of code/docs added, 4 new files in 02_GrooveLinx/specs/ + 2 new HTML pages.**_

_**Drew's morning briefing:** (a) Open `app.groovelinx.com/stack-map.html` — has Mermaid architecture diagram at top; click any tile to jump to that vendor's dashboard. (b) Open `app.groovelinx.com/architecture-deep-dive.html` — 5 internal-architecture diagrams. (c) Skim `02_GrooveLinx/specs/optimization_plan.md` to pick which P0 to tackle next session. (d) Quick wins available: trigger the monthly version-check workflow manually via Actions tab to file the first `version-audit` issue. (e) Modal stem-separator deploy still failing with G4NIHWDB / 7701PCEC — non-blocking; existing service runs on old image. Email Modal support if you want to chase. (f) Eventually remove `bands/.read: true` from Firebase rules after band-wide signin verification confirms the gate works for all 5 testers._

_Updated: 2026-05-08 (overnight, autonomous polish session) — **Architecture map + automated version checking shipped (build `20260508-003218`).** Drew went to bed; I kept iterating per his ask. **What landed:** (1) **Comprehensive stack inventory doc** at `02_GrooveLinx/specs/stack_inventory.md` — 50+ tools / services / libraries across 11 sections, plain-English descriptions, what GrooveLinx feature each powers, where it runs, cost, current vs latest, vendor, failure mode, login URL. Structured for paste-into-Sheets but readable as markdown on GitHub. Includes a "what we don't use and why" section, rough monthly cost rollup ($10-30/mo), and key cross-tool integrations (GoDaddy → Cloudflare DNS → Vercel chain, Firebase ↔ GCP project unity, Worker → Modal → R2 stem flow). (2) **Interactive architecture map** at `app.groovelinx.com/stack-map.html` — single-file HTML, dark-themed brand-aligned, sticky TOC nav, every tile click-throughs to vendor dashboard / login / docs. Pulls live build version from `/version.json`. Set to `noindex,nofollow` + `robots.txt Disallow` so search engines skip it. Lives at the apex domain but is URL-discoverable rather than auth-gated (truly private would require a separate Vercel project). vercel.json updated with explicit rewrite for the path. (3) **Automated version checking** — `scripts/check_versions.py` scans every pinned version in the repo (npm root + functions, PyPI requirements files, inline `pip_install` blocks in separator.py, jsdelivr/unpkg/gstatic CDN URLs in HTML + JS, GitHub Actions in workflow YAMLs) and hits each registry to compare. Outputs a markdown report with status emoji per component (🟢 current / 🟡 patch / 🟠 minor / 🔴 major / 🔵 ahead). `.github/workflows/version-check.yml` runs it monthly (1st @ 08:00 UTC + manual dispatch) and opens or updates a tracking issue labeled `version-audit`. `.github/dependabot.yml` adds weekly auto-PRs for npm + pip + GitHub Actions ecosystems (covers what Dependabot can see; the script covers what it can't). (4) **GitHub Actions bumped further** — script discovered v6 was already out for `actions/checkout` + `setup-node`; bumped from v5 → v6, plus `setup-python` v5 → v6 and `github-script` v7 → v9. (5) **Polish on the architecture map** — sticky TOC with color-coded zone indicators, smooth scroll, status badges (live / pending / deferred / deprecated) on key tiles. **Files added:** `02_GrooveLinx/specs/stack_inventory.md` (305 lines), `stack-map.html`, `scripts/check_versions.py`, `.github/workflows/version-check.yml`, `.github/dependabot.yml`, `robots.txt`. **Files modified:** `vercel.json`, `.github/workflows/{stamp-version,validate}.yml`. **5 commits this overnight chunk:** `a181f0ac` (inventory) → `539ada37` (architecture map + version checker) → `37b0491e` (TOC + polish). Earlier in the evening: `c04d78cd` (gate cutover) → `cb3959f2` (Node 24) → `d6cfe0ef` (dynamic banners + functions ^7) → `e571276e` (CI bump) → `afecee05` (CDN libs + Modal pins). **Drew action when he wakes up:** (a) hard-reload to verify gate still works for the band, (b) open `app.groovelinx.com/stack-map.html` and confirm the infographic loads + tiles open vendor dashboards, (c) optionally trigger the monthly version-check workflow manually via Actions tab → "Monthly version check" → "Run workflow" to see the bot file the first audit issue, (d) Modal deploy of stem-separator still pending (G4NIHWDB / 7701PCEC infra errors — non-blocking, can email support or retry tomorrow), (e) eventually remove `bands/.read: true` from rules after band-wide signin verification._

_Updated: 2026-05-07 (late PM, members_index cutover) — **#19 shipped — auth gate now O(1), 1.7GB/day egress hole closed (build `20260507-215059`).** Per yesterday's session the boot-time membership gate scanned the entire `bands/` tree on every sign-in, which over the day hit Firebase RTDB downloads quota (1GB no-cost limit exceeded by 693.2MB; ~$0.69 in pay-as-you-go egress, plus the privacy hole of every login pulling every band's roster). Today's cutover replaces the tree scan with a single `members_index/{sanitized_email}` lookup. **What shipped:** (1) **Cloud Function `mirrorMemberToIndex`** in new `functions/` codebase (Node 20, firebase-functions ^6, firebase-admin ^12) — RTDB onWrite trigger at `/bands/{bandSlug}/meta/members/{memberKey}` mirrors create/update/delete events into `/members_index/{sanitized_email}: bandSlug`. Region pinned to `us-central1` (must match the default RTDB instance region). Last-write-wins on collision (logged as warning). (2) **`app.js _glCheckBandMembership` refactored** from `firebaseDB.ref('bands').once('value')` (megabytes per call) to `firebaseDB.ref('members_index/' + sanitize(email)).once('value')` — single key lookup, ~50 bytes payload. ~99.99% reduction in sign-in egress. (3) **Firebase rules** updated: added `members_index` block with `.read: true, .write: false` (final state — Cloud Function uses admin SDK and bypasses rules). (4) **Backfill** ran cleanly — 6 entries (5 deadcetera + 1 whitney, the only members with `email` set on their meta records). **Deploy infrastructure scaffolded for the first time:** `firebase.json` + `.firebaserc` pin project to `deadcetera-35424`; `functions/` codebase with package.json + .gitignore + Node 20 runtime declared. Function deployed via `firebase deploy --only functions` (with the standard first-time-2nd-gen Eventarc-permissions-propagation hiccup). **Rules quirk discovered:** app uses Google OAuth for sign-in but does NOT authenticate to Firebase Auth — so `auth != null` rules return false even when signed into the app. Same reason `bands/$bandId/.write` is `true` (no auth required), not `"auth != null"`. Backfill required `.write: true` temporarily; then locked back to `.write: false`. **Issue #19 closes; #20 (song migration shortfall) remains open. Open follow-ons:** (a) remove `bands/.read: true` from rules now that the gate doesn't need it (privacy hole closes; verify all 8 testers can still sign in first); (b) tighten `members_index/.read` to `auth != null` once we wire actual Firebase Auth (separate workstream); (c) bump function runtime Node 20 → 22 or 24 before 2026-10-30 decommission; (d) bump `firebase-functions` ^6 → ^7 (breaking change warning during deploy). **Memory updated:** `feedback_console_snippets.md` now codifies a hard 80-char limit per snippet (iTerm2 wraps long lines on copy and inserts newlines mid-identifier — bit us tonight when `sanitizeFirebasePath` got broken into `sanitizeFi\nrebasePath` causing `Uncaught SyntaxError: Unexpected identifier 'rebasePath'`). Long backfills should ship as a script-load (write to repo, dynamic-import) instead of inline paste. **Drew action remaining:** hard reload across band devices to pick up new gate; verify all 8 testers still sign in cleanly; then remove `bands/.read: true` from rules._

_Updated: 2026-05-07 (PM, session close) — **Foundation day across multiple workstreams (build `20260507-181011`).** Two code ships: (1) Boot-time membership gate (Mode A — hard block) — non-roster users blocked at sign-in with overlay + OAuth revoke + localStorage clear. (2) iPhone safe-area padding on `#glAvatarPanel` (notch/dynamic-island fix). **Worker fix (Cloudflare-deployed):** Twilio SMS now uses `MessagingServiceSid` (A2P-routed) when set — would have kept failing 30034 even after campaign approval otherwise. **Firebase rules:** `bands/.read = true` so the gate can scan rosters. **GitHub Issues + Project #1 "GrooveLinx Work":** new work-tracking layer per Pierce ask for "devops type environment vs MD docs." 16 issues seeded (#3–#19), 5 custom fields (Stage/Impact/Effort/Owner/Submitted by), all band members granted Read-on-repo + Writer-on-project. Project description, README, first status update written tonight. Markdown remains design/history layer. **Whitney UAT:** Drew's brother joined as first non-DeadCetera tester; ended up with two bands (auto-onboarded `chalkyrocks` + Drew-provisioned `whitney`); chalkyrocks deleted, gate now routes him to active `whitney` band. **Firebase test-band cleanup (#18 closed):** 623 → 2 bands. 530 e2e/test patterns + 91 nonexistent/test artifacts removed. End state: only `deadcetera` (5 members, 418 active songs) and `whitney` (3 members, 25 songs). **#20 opened:** 195-song migration shortfall — `meta/songs_v2_migrated.totalSongs=609` vs `migratedCount=414`; needs referential-integrity scan. **Memory updates:** console snippets rule (single-line single-statement only — iTerm2 wrap breaks string literals; multi-line blocks hang DevTools), duplicate-band-on-onboarding bug (will recur), auth gate Mode A → B switch trigger, GitHub Issues workflow. **Next session priority:** #19 members_index refactor (O(1) gate, 3d effort) is the natural Phase 2 of today's gate work and unblocks the duplicate-band fix._

_Updated: 2026-05-05 (PM, post-Pierce demo) — **First-impression hardening shipped across 5 builds today (final `20260506-012554`).** Triggered by a 1:1 walkthrough call with Pierce that surfaced four issues. **(1)** UAT-discovered Phase 1 UPDATE→CREATE fallthrough fix + M7 imported-untouchable narrowing (build `20260505-111425`) — every PATCH was being followed by a `create() refused` because `_status` wasn't bumped after UPDATE success; M7 type-only filter was over-broad. **(2)** TZ-stable `_buildEventBody` (build `20260505-112453`) — emits floating-local datetime + `timeZone:'America/New_York'` so syncs from any timezone produce correct Eastern times on Google. Drew flagged this from Colorado. **(3)** songs.js `_topGaps` hoist fix (build `20260505-222943`) — Pierce's Songs page was stuck on "Loading…" forever because the sort comparator at line 317 read `_topGaps[a.title]` while `var _topGaps` was declared at line 394 (after the sort). Triggered only for users with persisted `gl_song_sort:'needs_work'` localStorage. Brand-new users with no localStorage cannot reach the buggy branch (`_userSortActive` guard). **(4)** Right-panel readiness slider (build `20260506-004041`) — Drew demoed Bird Song readiness; right-panel readiness card was read-only because the slider only existed in `_sdRenderReadinessInner` (full-page detail), not in `_sdPopulateRightPanel`. Added range slider on the current member's row in the right panel; same `sdSaveReadiness` handler. **(5) Bundled deploy (build `20260506-012554`):** **(5a) Render error fallbacks** — new `_glRenderError` helper in utils.js. `renderSongs`, `renderCalendarInner`, `renderRehearsalPage`, `_rhRenderCommandFlow` (try/finally on `_rhRenderInProgress`), `renderSetlistsPage`, `renderSongDetail` wrap their bodies in try/catch and call the helper on throw. Fallback shows the error + Reload + "Reset preferences" buttons (clears `gl_*`/`_sq*` localStorage keys — most likely cause of a render-breaking bad input). **(5b) Hoist-bug scan** — Explore agent audited 6 render entry points + re-scanned songs.js. **No other reachable hoist-before-use bugs found.** **(5c) Calendar Rules pre-OAuth refactor** — `_calShowAvailabilitySettings` previously hard-rejected without calendar scope. Pierce balked at OAuth before he could see what he'd configure. Now the modal opens regardless: scheduling-mode dropdown, conflict rules, rehearsal-window selector all editable. Calendar-list and band-cal dropdown are replaced by an inline "Sign in to Google Calendar" CTA exactly where the missing data would render (option (i) — contextual, not a banner). Save button becomes "Done" pre-OAuth. Added "Preview Rules — see what each mode controls" link below the 3-mode chooser cards. **(5d) Stale-comment cleanup** — `selectSong` routing comment claimed gl-right-panel.js wasn't loaded by index.html; it now is. Replaced with a brief, accurate description. **Files changed:** `utils.js`, `songs.js`, `calendar.js`, `rehearsal.js`, `setlists.js`, `song-detail.js`. All pass `node --check`. **Drew action: hard reload across band devices to pull the new bundle.** Tasks #56 (calendar grid post-cleanup verification on 7 dates), #57 (Stage-2 source-of-truth flip), #65 (9 hidden-event synthetic stubs) still pending._

_Updated: 2026-05-05 (Tier-3b + Tier-4 shipped) — **Final 8 MED + 6 LOW audit items closed (build `20260505-110755`).** **Tally: 45/45 audit findings closed (16 HIGH + 23 MED + 6 LOW). Audit is now fully resolved.** What landed: M11+M12+M16 unified into a runtime `_assertCalEventInvariants(ev)` helper called from `_buildGigCalEventBody` — flags time/startTime drift, updated/updated_at drift, and linkedSetlist NAME-in-ID-slot (D12 sibling) on every write. `_buildGigCalEventBody` now writes both pair-fields atomically. M17 scope taxonomy doc-block added at the top of `gl-calendar-sync.js` with per-operation policy table; `deduplicateBandCalendar`, `refreshGigTimesOnGoogle`, `mergeOrphanDuplicates` switched from `hasCalendarScope()` to `hasCalendarEventsScope()` (write-scope gate). M18 new **Calendar Maintenance** modal (`window._calOpenMaintenance`) surfaces 7 console-only repair tools as one-click Dry-run / Apply rows with descriptions; entry button added to the Google panel. M20 D5 corruption watchdog: Phase 2 import flags suspicious titles ("deadcetera Event", repeated "X — X — X" forms) into `result.suspiciousImports` + `suspiciousSample` rolled into sync_activity. M21 stale-member banner copy rewritten to acknowledge BOTH possibilities (user simply hasn't opened app vs. Google token expired) instead of implying device sync failure. M23 four `calendar_events/IDX` index-keyed updates (calSaveEvent Phase B1+B2) routed through new `_calFindEventRefKey(eventId)` ID-keyed lookup — eliminates wrong-row write race when concurrent delete shifts the array. L1 `_calSyncNow` re-entrancy flag (`window._calSyncInFlight`) — rapid double-click now toasts "Sync already running" instead of silently stacking. L2 first-name block ownership match now requires unique-first-name AND no ownerKey on the block (two members named "Drew" no longer trade each other's blocks). L3 `repairCorruptedTitles` member cap bumped 5 → 10. L4 `_queryBandCalendarFreeBusy` logs a clear "freebusy returned empty AND scope partial" warning when Path B can't surface hidden events. L5 doc-comment header on `deduplicateBandCalendar` documents when to use it vs `mergeOrphanDuplicates` vs `cleanupOrphanGigEvents`. L6 `userinfo` call now routes through worker `/oauth/userinfo` proxy (with origin gate + direct fallback). Files: `gl-calendar-sync.js`, `calendar.js`, `firebase-service.js`, `worker.js`. All 4 pass `node --check`. **Drew action: deploy worker via Cloudflare dashboard so `/oauth/userinfo` is live.** Audit grade A− → A._

_Updated: 2026-05-04 (Tier-3 shipped) — **Tier-3a defense-in-depth batch shipped (build `20260505-032715`).** All 12 Tier-3a items closed: M2 sync lock fails closed with bounded retry (was fail-open). M3 lock TTL bumped 60s → 180s (full sync + Path B.2 has been observed at 90s+). M4 `_withRetry()` helper wraps create/update/remove fetches with exponential backoff + Retry-After honoring; kills the legacy inline single-retry hack. M5 Phase 1 401/403 sets `needsReauth` + stops Phase 1 (was Phase 2 only). M6 Phase 1 dirty→synced flips persisted before Phase 2 starts (legacy gate skipped saves when only UPDATEs ran). M7 `_UNTOUCHABLE` filter narrowed: only skip pushes when `_importedFromGoogle && calendarId !== bandCalId` (was type-only — blocked legitimate band-cal-authored blocks). M8 missing-title silent drop now logs first-5 + counts via `result.skippedNoTitle`. M9 `_logSyncActivity` includes row-level samples (first 5 of pushed/pulled/updated/deleted with title+date+ids) — Sync Activity modal can show *what*, not just *how many*. M10 stale-synthetic clear count surfaces via `result.syntheticsCleared`. M14 every gig writer routes through `_saveGigsAndInvalidate` helper (gigs.js) or inline `GLStore.setGigsCache` update (calendar.js, setlists.js) — gigsCache stays in lockstep with Drive. M15 `_syncGigToCalendar` emits `calendarEventsChanged` event after the mirror write. M22 `_calSyncNow` holds the sync lock across reclassify→sync→reclassify via new `GLCalendarSync.acquireSyncLock`/`releaseSyncLock` API (syncBandCalendar detects outer lock and skips inner acquire). Files: `gl-calendar-sync.js`, `gigs.js`, `calendar.js`, `setlists.js`. All pass `node --check`. **Tally: 31/45 audit findings closed (16 HIGH + 15 MED). 0 HIGH + 8 MED remaining — all in Tier-3b deferred bucket.** Tier-3b deferred (alias migration / schema lint / admin UI / scope-gate sweep / corruption watchdog) tracked as task #76. Stage-2 source-of-truth flip remains ready to schedule._

_Updated: 2026-05-04 (Tier-2 shipped) — **Tier-2 audit fixes shipped (build `20260505-031207`).** All 9 Tier-2 items closed in one batch. **Tally: 19/45 audit findings closed (16 HIGH + 3 MED). 0 HIGH remaining.** Closed: H3 (ghost-row sites), H4 (stuck syncStatus retries), H7 (cal→gig reverse-mirror centralized via _buildGigFromCalEvent), H8 (calendar-page deletes cascade), H9 (UPDATE cascade symmetry — calendar-authored gig date moves now PATCH Google), H10 (RSVP unification — gigs node canonical, cal-page writes through), H11 (gpSave triggers mirror), H12 (D1 sibling at calendar.js:878), H15 (Phase 2 partial-fetch bails before reconcile). Plus M13 (rehearsal.js parallel insert canonicalized) as a bonus from H3. Files: gl-calendar-sync.js, calendar.js, gigs.js, rehearsal.js. All pass node --check. No worker deploy needed. **Audit grade B− → B+.** Stage-2 source-of-truth flip now safe to schedule. Tier-3 (defense in depth) and Tier-4 (LOW polish) still open but non-blocking._

_Updated: 2026-05-04 (post-audit Tier-1 shipped) — **Tier-1 audit fixes + worker auth shipped (build `20260505-024126`).** 6/6 Tier-1 items + M1 + M19 in one batch. T1.1 maintenance-mode flag (`calendar_sync_state.maintenanceUntil` + `_withMaintenance` wrapper around every repair tool, `_calSyncNow` UI gate). T1.2 `repairGigMirror` seeds sync state from gig.sync, marks rows without Google linkage as `'migration_only'` (Phase 1 skips). T1.3 central `_buildGigCalEventBody` helper used by both `_syncGigToCalendar` + `repairGigMirror` — single source of truth for D12 override + preserved keys + title resolution. T1.4 `listGoogleEvents` accepts explicit `opts.calendarId` (default `'primary'`); worker logs warn-on-default. T1.5 `hasCalendarEventsScope()` granular gate replaces `hasCalendarScope()` in 6 mutation helpers; all short-circuits return classified errors (`'no_scope'`, `'no_event_id'`, `'no_block'`). M1 worker origin allowlist in WARN-ONLY mode (request proceeds, log only). M19 `deleteGoogleEventsDirect` is now dry-run by default. Files: gl-calendar-sync.js (+347), gigs.js (simplified), calendar.js (+16), worker.js (+58). All 4 JS files pass `node --check`. **Drew action: deploy worker via Cloudflare dashboard → paste-deploy. Once warn-mode logs show only expected origins, set `ENFORCE_ORIGIN=1` env var to enforce.** Tier-2 items deferred (small contained fixes); Tier-3/4 further out._

_Updated: 2026-05-04 (post-audit) — **Full Calendar/Google integration audit complete.** 4 parallel agents, 45 findings (16 HIGH, 23 MED, 6 LOW), grade B−. Synthesized at `02_GrooveLinx/audits/calendar_integration_audit_2026-05-04.md`. Trust verdict: conditional — routine UI ops are safe; migrations/partial-scope/multi-device are not yet trustworthy. 8 newly-discovered HIGH bugs surfaced. Tier-1 action plan (5 items, blocks Stage-2): maintenance-mode flag, harden repairGigMirror sync-state seeding, centralize gig mirror, fix listGoogleEvents personal-cal bleed, centralize Google mutations into classified primitive. No code changed yet — audit is read-only deliverable; Drew decides next move._

_Updated: 2026-05-04 (very late PM) — **Stage-1 applied + regression recovered (build `20260505-015827`).** Drew applied the migration (39 gigs comprehensively mirrored, 0 orphans recreated thanks to fuzzy-venue 3rd pass). A routine mid-recovery sync exposed two latent bugs: (1) migration didn't seed sync state → 21 historical gigs got pushed to Google as fresh events + 7 prefix-duplicate orphans pulled back; (2) `linkedSetlist` schema asymmetry (ID vs name) corrupted 14 setlist linkages via the new mirror code's `Object.assign` spread. Both fixed inline: explicit `linkedSetlist: gig.setlistId || null` override in the mirror + `fixGigSetlistLinkage` repair tool (14 rows repaired) + `cleanupOrphanGigEvents` orphan classifier + `deleteGoogleEventsDirect` bypass-scope deleter (7/7 Google duplicates removed HTTP 204). Final verification sync: `pushed 0 | pulled 0 | updated 73 | deleted 0`, no Inbound NEW. Calendar grid spot-check pending (7 dates: 2/1, 4/19, 4/20, 6/5, 6/20, 9/11, 9/19). Stage-1 lessons written into the handoff so Stage-2 doesn't repeat them: (a) enumerate shared-field semantics before any blanket `Object.assign` mirror, (b) migrations that touch sync-tracked records must seed sync state, (c) runbook must explicitly forbid sync between migration steps, (d) bypass-scope deletion via worker proxy is the right pattern when OAuth scope is partial. Stage-2 (source-of-truth flip + 50-site migration + gigs node deletion) still deferred._

_Updated: 2026-05-04 (late PM) — **Calendar/Gigs merge Stage 1 shipped (build `20260505-005511`).** Mirror hardening + repair tool + canonical reader stub. `_syncGigToCalendar` now copies the full gig record (was cherry-picking 8 fields → kills field-drift bug class). New `GLCalendarSync.repairGigMirror({apply})` backfills comprehensive mirror onto existing cal_events. New `GLStore.getGigsAsync()` derived-view reader for Stage-2 adoption. Stage-2 (source-of-truth flip + 50-site migration + gigs node deletion) deferred to dedicated session — schema asymmetry (gigs has availability/RSVP/sync state) and regression risk warrant focused scope. **Drew action: run repair tool dry-run → apply.**_

_Updated: 2026-05-04 (PM) — **SMS Layer 3 verified end-to-end + A2P 10DLC campaign resubmitted.** Pipeline (client UI → worker `/sms/send` → Twilio API) confirmed working. Deliverability gated by carrier review of new campaign `CMdd0bfeb64c9bd73e50e556016201030b` (Sole Prop, 5 samples, embedded-links checked, truthful in-app opt-in flow described, live `app.groovelinx.com/{privacy,terms,sms-opt-in}.html` URLs). Phone `+14085398813` attached. ETA 1-5 business days; until then Twilio returns error 30034. No code action needed; on approval, existing flow delivers automatically._

_Updated: 2026-05-03 (late) — **GrooveMate cross-app decision engine v1 (build `20260504-020659`).** Three new core files (gl-context, gl-actions, gl-groovemate), all additive. `GLContext.snapshot()` reads GLStore + globals; `GLActions` is the shared registry (10 stub-registered actions); `GLGrooveMate.evaluate()` runs heuristic rules over the snapshot. Memory persisted via GLStore (`gl_groovemate_memory`, 20-cap each list). Two real surfaces: Home gets a suggestion card at the top of the left rail; Stems fullscreen gets a persistent hint pill near loop controls. Existing GLActionRouter (avatar) untouched — side-by-side. Real actions: `rehearsal.suggestNextSong`, `rehearsal.startRehearsal`, `stems.setLoop`, `stems.applyPracticeMode`, `stems.resetMix`. Phase 2 stem-separation items still pending._

_Updated: 2026-05-03 (later, post grid-deprecation) — **Stage-plot context popover + arbitrary-angle rotation (build `20260504-014622`).** Old `prompt()` menu replaced with a floating toolbar — sliders for rotation (0–359°) and size (50–250%) with live preview, plus quick-action buttons. Outside-click + Esc close. `_spRender` re-anchors after content changes. PDF export already honors arbitrary angles + sizes. Phase 2 stem-separation items still pending._

_Updated: 2026-05-03 (later) — **Stage-plot grid mode deprecated; all plots free-mode with snap-to-grid (build `20260504-003408`).** Drew: "yes. Do this!" — competitor research (StagePlot Guru, TecRider, MyStagePlan) confirmed none use grid mode, and grid was blocking the new resize feature. New plots default `placementMode:'free'` + `snapToGrid:true`. Existing plots auto-migrate on render (grid `(x,y)` → `(xPct,yPct)` % conversion already implemented in `_spSetPlacementMode`). Toggle UI replaced with a Snap-to-grid checkbox (5% increments, ⌥/Alt overrides). Faint gridlines render on canvas when snap is on. PDF page-1 stage rebuilt as absolute-positioned `<div>` canvas matching the on-screen renderer. Grid-only render functions deferred for deletion. Phase 2 stem-separation testing items still pending (Drew's Modal redeploy + Bob FP swap to 1972 Veneta clean isolate)._

_Updated: 2026-05-03 (mid-session, third fix) — **Spatial-split panel state persistence shipped (build `20260503-160531`).** Renames + fp assignments + fp_strength now hydrated from persisted record on panel re-open. Without this fix, every re-open reset to defaults and the next Run overwrote the persisted record with those defaults. Drew's prior renames on Brown-Eyed Women are already overwritten — re-rename once more, then they persist permanently. Phase 2 testing resumes._

_Updated: 2026-05-03 (mid-session, second batch) — Phase 2 testing pass continues; second UX batch shipped (build `20260503-153132`) addressing Drew's 9-item iPhone bug list. Five fixes batched: pan tap-to-center on touch, reset-volumes button, phone-portrait rotation banner, kbd→touch hint flip via media queries, and lightweight iPhone stem-playback drift resync (500ms interval, snap-on-drift > 100ms). Heavy AudioBuffer-based sync rewrite deferred — lightweight should be enough for Phase 2 validation. Multi-solo + loop-persistence confirmed-as-intended. Garble-removal question deferred until Phase 2C/D give us empirical data on whether the fix is algorithmic or recording-specific. Phase 2 progress unchanged: 2A done (zones inverted vs defaults — Bob-left / Jerry-center / keys-right), 2B partial (Jerry fp at 50%, modest improvement). Still to run: 2C fp_strength sweep (0/50/100), Bob fingerprint via self-bootstrap, 2D cross-song validation._

_Updated: 2026-05-03 (mid-session) — Phase 2 testing pass in flight; two UX fixes shipped inline (build `20260503-150718`). Phase 2A baseline complete on Brown-Eyed Women (Europe '72 — official Rhino/Warner upload via Grateful Dead - Topic channel): zone defaults inverted vs this mix (Bob-left / Jerry-center / keys-leakage-right rather than the test plan's Jerry-left default — Stephen Barncard's mix doesn't follow modern conventions). Pan-split functionally correct, but garble persists in Bob and Jerry zones. Phase 2B partial: Jerry fingerprint (Sugaree from Garcia 1972) added, fp=50%, modest improvement on key-bleed. fp_strength sweep (0/50/100) + Bob fingerprint via self-bootstrap from current Bob zone still to run. Inline fixes during the test break: (1) Version Hub `vhArchiveFiles` scroll-into-view UX (was anchoring panel before fetch resolved); (2) Stems player fullscreen state preservation across spatial-split re-renders. Results being captured at `notes/session_2026-05-03_phase2_results.md`._

_Updated: 2026-05-02 PM (session close) — Phase 2 spatial split + tone fingerprinting fully shipped end-to-end. Final build `20260503-000647` (commit `ad729a13`). Six commits this session: stems async pipeline, Change-source button, Phase 2 build, Modal endpoint cleanup, menu-action data-attr fix, overlay window-positioning fix. All deploys completed (Modal + Cloudflare worker). Worker secrets added by Drew. Next session = Phase 2 empirical testing pass on real Dead recordings. Test plan + curated test-material list at `02_GrooveLinx/notes/session_2026-05-03_phase2_test_plan.md`. Tier 1 starting picks: "Brown-Eyed Women" (Europe '72) and "Scarlet → Fire" (Cornell 5/8/77)._

_Updated: 2026-05-02 (mid-session) — Phase 2 shipped: pan-aware spatial split + tone fingerprinting (build `20260502-222416`, commit `7e6b3e89`). Per-stem ⋮ menu adds "↳ Spatial split…" — splits any Demucs stem (typically "other" or "guitar") by stereo pan window with optional reference-fingerprint biasing. Band-level fingerprint library ("Jerry — Wolf '77", "Bob Mesa") at `bands/{slug}/fingerprints` reusable across every song. Pure DSP, no GPU, ~30-90s per split. **Manual deploys required: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: stems async start/check pipeline (`20260502-213153`), Change source button (`20260502-215628`)._

_Updated: 2026-05-02 — Stems async start/check pipeline shipped (build `20260502-213153`, commit `523124e0`). Replaces the synchronous `/stems/separate` route (was hitting Modal's ~150s web-endpoint cap with 524s on `htdemucs_ft` + `mdx_extra`) with a spawn → poll architecture mirroring LALAL split. Worker `/stems/start` returns Modal `call_id` immediately; client polls `/stems/check` every 5s. Stems lens UI now renders a live progress bar with stage labels. **Manual deploys still pending: `modal deploy services/stem-separation/separator.py` + Cloudflare worker dashboard redeploy.** Earlier today: GLAudioSession Phase A unification (`20260502-184243`), worker streaming heartbeat (`20260502-210652`), service-worker network-first for `index.html` (`20260502-211020`)._

---

## Active Phase: Stems Intelligence — Phase 1 Harmony Painkiller (2026-04-30 →)

**Status:** Phase 0 + Phase 0.5 both closed. Tool choices empirically locked. Phase 1 implementation can begin.

**Master plan:** `02_GrooveLinx/specs/stems_intelligence_plan.md` (v4, research-hardened, ChatGPT-reviewed)
**Session notes:** `02_GrooveLinx/notes/session_2026-04-29_stems_planning.md`

**ROI-ordered roadmap (post-Phase-0.5):**
| # | Phase | Effort | Status |
|---|---|---|---|
| 0 | Vocal-isolation bake-off (5 songs: Demucs vs MelBand) | 0.5 day | ✅ **CLOSED 2026-04-29** — Demucs sweeps 5/5 |
| 0.5 | Lead/backing bake-off (3 songs: LALAL.AI vs Fadr vs Demucs combined) | 0.5 day | ✅ **CLOSED 2026-04-30** — LALAL.AI sweeps 5/6 (1 tie on physics-ceiling) |
| 1 | Harmony Painkiller — LALAL.AI lead/backing + Basic Pitch notation + Harmony Lab + source picker + pan knob | 4–8 days | 🟢 **UNBLOCKED** — ready to implement |
| 2 | Dead Guitar Split (Jerry/Bob via stereo pan) | 1.5–2 days | Blocked by P1 |
| 3 | Song Intelligence Pass (BPM/key/sections/chords/lyrics) | 3–4 days | Blocked by P2 |
| 4 | Cheap Polish (waveform, A-B loop, presets) | 1 day | Blocked by P3 |
| 5 | SepACap multi-voice (archived) | n/a | ❌ OOMs on full-length rock; archived from P1 promotion |

**Phase 0 corpus (locked 2026-04-29):**
1. **Because** — Beatles (Abbey Road) — clean studio multitrack, control floor
2. **Brokedown Palace** — Grateful Dead (American Beauty) — three-part stack, spacious
3. **Cumberland Blues** — Grateful Dead (Workingman's Dead) — busy mix, multi-singer
4. **Attics of My Life** — Grateful Dead (American Beauty) — close-harmony trio, tight thirds
5. **Helplessly Hoping** — CSN — shared-mic harmonies, physics ceiling

All studio sources. Live-SBD slot deferred to P1 UAT.

**Phase 0 result (closed 2026-04-29):** Demucs wins 5/5 ("huge" margin) on blind A/B listening via `02_GrooveLinx/notes/bakeoff_player.html`. **Production vocal isolation = Demucs `vocals.flac`** (used by Stems lens for per-instrument practice mixer).

**Phase 0.5 result (closed 2026-04-30):** LALAL.AI wins 5/6 rows. Lead 3/3 huge; backing 2/3 (1 huge, 1 clear, 1 tie). The tie was on Helplessly Hoping (CSN shared-mic — physics ceiling, not algorithmic). Empirically observed: **Fadr does NOT produce separate lead/backing audio stems** — only standard 4-stem combined vocals + per-harmony MIDI. Fadr therefore demoted to MIDI-per-harmony seed role (notation aid for Harmony Lab); LALAL.AI takes the audio lead/backing role. **Phase 1 lead/backing source = LALAL.AI** (`multivocal=lead_back` mode, $50 Master pack, 760 min ≈ 190 songs). Full bake-off detail in `02_GrooveLinx/notes/session_2026-04-29_bakeoff.md` (Phase 0.5 section).

**Phase 1 production pipeline (locked 2026-04-30):**
1. **Demucs htdemucs_6s** (existing Modal `separate_stems`) → drums/bass/vocals/other/piano/guitar — Stems lens.
2. **LALAL.AI** (new Modal `lalal_lead_back`) on full mix → `lead.mp3` + `backing.mp3` + `instrumental.mp3` — Harmony Lab.
3. **Basic Pitch** (existing `app.js:4859`) on LALAL `lead.mp3` → MIDI → ABC for lead notation.
4. **Harmony Lab** consumes ABC + LALAL backing audio + GLStore mixer state.

**Phase 1 build order (4–8 days):**
1. Move LALAL key from local file to Cloudflare Worker secret `LALAL_API_KEY` (~30 min) — ⏳ awaiting Drew (paste-deploy required)
2. Worker `/lalal/split` endpoint (~1 hour) — ✅ shipped (commit `3dbdbcf4`)
3. Client `splitLeadBacking(title)` in `js/core/gl-stems.js` (~1 hour) — ✅ shipped (commit `3dbdbcf4`)
4. Wire Basic Pitch to LALAL `lead.mp3` (~2 hours) — ✅ shipped (build `20260430-113903`, `runBasicPitchOnLalalLead`)
5. Harmony Lab abcjs render + WebAudio mixer + phrase loops (~1 day each = 3 days, the core lift) — ✅ shipped (build `20260430-120034`, `_hlRenderSplitMixer` + `_hlRenderLeadNotation` + lazy abcjs CDN)
6. "Auto-Split Harmonies" button + source picker (~4 hours) — ✅ shipped (build `20260430-113903`, two mirror points wired)
7. Pan knob in Stems lens / Harmony Lab (~30 min) — ✅ shipped (build `20260430-120034`, StereoPannerNode in both surfaces, double-click centers)
8. Band UAT — Drew + 1 bandmate learn a part (~1 day) — ⏳

**Drew's resolved decisions (§14 of plan):**
- ✅ $50 LALAL.AI Master pack budget approved for bake-off
- ✅ Coexist with Fadr via `source` flag (no destructive cutover)
- ✅ Phrase loops with manual markers in P1, auto-populated by P3
- ✅ Pan knob ships in Phase 1 (moved from P4)
- ✅ Per-action source picker (Option A from §4.6) — defaults to North Star, lets band override per-split for cleaner studio source
- ✅ Phase 0 corpus locked (5 studio masters listed above)
- ✅ Stage B Modal deployment approved — MelBand-Roformer + SepACap built as bake-off instruments; client UI frozen until P0 names winner
- ✅ **Path A locked (2026-04-29)** — no public self-hosted lead/backing checkpoint exists; Fadr stays as lead/backing tool of record. MelBand-Roformer pivots to vocal-cleanup pre-stage candidate. Path B (MVSEP API) deferred unless P1 UAT shows Fadr insufficient.
- ⏳ Phase 2 pan-split confidence-gate threshold — tune during P2 implementation
- ⏳ Keep ROI order (Dead Guitar before Intelligence) — revisit after P0+P1 ships

**Architecture principle (§4.4 — read first):** Vocal stems are **first-class stems in the Stems lens mixer** alongside drums/bass/guitar/keys. Harmony Lab is a *specialized view* of the same audio data with notation, singer assignments, and recording mode added. **DO NOT BUILD TWO PARALLEL UIs.** Shared state via `GLStore.mixerState`.

**Product success metric:** Bandmates learn parts faster than YouTube + manual transcription. Not SDR. Not technical benchmarks.

---

## Layer 3 SMS — Twilio Campaign in carrier review (verified status 2026-04-29 PM)

**Campaign already submitted on 2026-04-26** with strong content (described in detail below). Earlier confusion: Twilio's A2P 10DLC overview page shows step 3 as "Not registered" until full carrier verification completes — that label means "not yet **approved**," not "not yet **submitted**." When attempts to "Continue registration" hit "Campaign limit reached on Brand," that was Twilio correctly enforcing Sole Proprietor's one-campaign-per-brand rule, not telling us a campaign was missing.

**Campaign state (snapshot 2026-04-29 19:42):**
- Campaign SID: `CMd3c50db7c82d07e1951e0e23a9493da5`
- Brand: Andrew Merrill (Sole Proprietor) — `BN690df404c69f445c14c1be8383f1de93`
- Linked Messaging Service: `MG6281103d4ebc3161ca33c728de1f3fe2`
- Status: **In progress** (submitted 2026-04-26; under TCR + carrier review)
- ETA: "couple of days to several weeks" per Twilio's banner — carrier review (T-Mobile / AT&T / Verizon) is the slow part, not Twilio's auto-vetting

**Submitted content (already strong, no edits needed):**
- Description: "private band, 5 members, explicitly enabled SMS notifications" — better than generic draft because it leans into Sole-Prop low-volume / known-recipient framing
- 5 sample messages (rehearsal/gig/poll/availability/setlist) with STOP keywords
- Embedded links: Yes · Embedded phone: No · Age-gated: No · Direct lending: No
- Privacy: `groovelinx.com/privacy.html` · Terms: `groovelinx.com/terms.html`
- Consent description calls out "personally invited by band leader, direct relationship" — strengthens Sole-Prop justification
- Twilio managing opt-out keywords (OPTOUT/CANCEL/END/QUIT/UNSUBSCRIBE/REVOKE/STOP/STOPALL) and HELP/INFO

**Optional polish (skip if you don't want to disturb the in-flight review):** Help auto-reply could be tightened to include brand name + frequency. Current: *"Reply STOP to unsubscribe. Msg&Data Rates May Apply."* Suggested: *"GrooveLinx: Band coordination notifications. ~5-15 msgs/mo. Msg&data rates may apply. Reply STOP to unsubscribe. Support: drewmerrill1029@gmail.com"*. Edit via Campaign → Messaging Service - Opt-Out Management.

**No further action required from Drew or Claude until Twilio emails approval.** When status flips to "Verified" / "Approved," Layer 3 SMS unblocks per build plan in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` — new `/sms/send` worker endpoint, storage `bands/{slug}/sms_subscriptions/{memberKey}`, mirrors FCM Layer 2 pattern.

---

## Previous Phase: Self-Hosted Stem Separation (Modal + Demucs + R2) — shipped 2026-04-29 AM

End-to-end stem separation pipeline (commit `7aaa7e70` and follow-ups). HT-Demucs on Modal T4 GPU (scale-to-zero, ~$0.005/song), R2 storage, Worker proxy at `POST /stems/separate`, `js/core/gl-stems.js` client, new "🎚 Stems" lens in Song Detail with synced 4-track mixer (vol/mute/solo/master scrub). Later same day: htdemucs_6s default (commit `124dc0ff`), Best Shot picker, per-stem download, tempo/pitch (Tone.js v15 `Tone.connect()` to bridge native↔Tone nodes), yt-dlp fallback with IPRoyal residential proxy, file upload as primary path with URL fallback. **Replaces dependence on Moises** — Moises rip-out followed in PM session.

---

## Previous Phase: Calendar sync hardening — shipped 2026-04-28 (build 20260428-210842)

Diagnosis from a user report (5/30 cell rendered three rows: local "deadcetera Gig" at 20:00, a separate "From Google" twin at 19:00, and a third row with title "Southern Roots Tavern — Southern Roots Tavern — Southern Roots Tavern" at 20:00). Three connected bugs in the sync layer; bundled the fixes since they share helpers.

**1. Timezone-safe extraction (`_extractLocalHM`, `_extractLocalDate` in `js/core/gl-calendar-sync.js`)**
`startStr.substring(11,16)` and `substring(0,10)` were silently wrong when Google returned `dateTime` in UTC form (`2026-05-31T00:00:00Z`) instead of offset form (`2026-05-30T20:00:00-04:00`). UTC return rolled the displayed date forward by a day and reported the time as `00:00`. Replaced with `Date` + `Intl.DateTimeFormat` in `BAND_TZ = 'America/New_York'`. Applied at all five call sites in `_reconcileEvent` and `_importGoogleEvent`.

**2. Generalized compounded-title self-heal (`_cleanCompoundedTitle`)**
Old regex required `existing.venue` to be set and only ran in `_reconcileEvent`. Now generic: detects any leading run of identical em-dash-separated segments and collapses, regardless of whether the data has a venue field. Wired into `_importGoogleEvent` so newly-discovered corrupt rows arrive cleaned. Cleaned-on-import rows ship with `syncStatus = 'dirty'` so the next push writes the cleaned title back to Google.

**3. Orphan re-link fallback (inbound sync path)**
Between the existing `glEventId`-match branch and the new-import branch, added a date+type+(time-within-60min OR exact-title) match against unlinked local events. Conservative: only re-links when EXACTLY ONE candidate matches; logs and skips when 2+ candidates exist. Marks the linked row dirty so a corrected local time pushes back to Google rather than getting clobbered by Google's stale value.

**4. "Merge orphan dupes" admin button (`mergeOrphanDuplicates` + `_calMergeOrphanDupes`)**
One-shot cleanup for already-existing duplicates that the on-the-fly fixes can't reach (different googleEventIds, three rows of same gig). Groups `calendar_events` by `date + type + normalized venue/title` (with self-heal applied to absorb triplicated rows). Keeps the local non-imported row when present, otherwise the oldest. Deletes the sibling Google events server-side and removes sibling rows from Firebase. Marks keeper dirty so next push reconciles correct time. Lives in the Google panel admin bar next to "Clean duplicates".

---

## 3-Layer Notification System — Layer 2 shipped 2026-04-26 (PM)

**Status:** Confirmed working end-to-end on both Mac Chrome and iPhone Safari (PWA). Drew's two devices are live FCM subscribers.

**Layer 1 — In-app banner:** ✅ Live (was already shipped pre-session)
**Layer 2 — Browser/OS push:** ✅ Shipped 2026-04-26 PM (build `20260426-234233`)
**Layer 3 — Twilio SMS:** ⏳ Pending 10DLC carrier approval (~3 days from 2026-04-26). Phone number +14085398813 registered. Compliance pages live at groovelinx.com/privacy.html + /terms.html.

**Architecture (Layer 2):**
- New worker endpoint `/push/send`: service-account JWT → OAuth2 → FCM v1 messages:send. Worker secrets `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`. Auto-cleans dead tokens.
- New client module `js/core/gl-push.js` exposes `window.GLPush`. Storage: `bands/{slug}/push_subscriptions/{memberKey}/{tokenHash}`.
- New service worker `firebase-messaging-sw.js` at root. Uses raw `push` event listener (Firebase SDK's `onBackgroundMessage` was unreliable on Mac Chrome).
- Settings master toggle redirected from legacy Web Push (`feed-action-state.js`) to `GLPush.subscribe/unsubscribe`.
- All band-feed events (poll/idea/note/link/photo) auto-fire `GLPush.notifyBand()` to all subscribers except sender.

**Five hard-won FCM/push quirks:** documented in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` — data-only payload requirement, raw listener vs SDK, SW activation wait, macOS same-tag dedup, DevTools Push button limitation. Read this BEFORE touching anything in the push path.

**Service account key rotation completed:** new key generated, Cloudflare secrets updated, old leaked key deleted from Google Cloud IAM. Procedure documented in session notes.

**Outstanding security cleanup:** Browser API key currently has Application restrictions = None (was loosened during troubleshooting). Re-tighten to HTTP referrers limited to known domains + add Firebase Installations API and FCM Registration API to API restrictions list.

---

## Calendar correctness — shipped 2026-04-26

- **Classifier expansion + band-cal-source rule**: events on the shared cal that don't match keywords now attribute to creator email and become member-blocking. No more silent blue dots.
- **`meeting` type**: purple cell + 📋 icon, doesn't count as a hard conflict.
- **Unified red-cell hover**: shows "Brian — daughter's wedding", "Drew — out of town" pulled from both schedule_blocks and band-cal calendar_events.
- **Audit hardening — data-loss fix**: dropped `default` visibility from the pollution heuristic (was flagging real venue-titled gigs as pollution; user confirmed past gigs/rehearsals went missing). Pre-delete confirm now lists actual titles+dates. Stamps `lastAuditApplied` for future undo banner.

**Recovery in progress:** Drew checking Google Calendar Trash (~30-day retention) for events deleted by past audit runs.



## Stage Plot v4 — shipped 2026-04-25

- **Logistics fields**: setupTime, loadIn, backline[] (band/venue/rental), wireless[] (channel/use/freq) — wired through editor, share view, multi-page PDF, worker public page.
- **Soundcheck order suggester**: button on input list header → modal grouping channels by family in standard FOH order with copy-as-text.
- **QR codes**: in-app share view + worker public page both embed QR pointing at the live link.
- **Setlist plot badge**: 🎭 Plot chip on cards with a matching stage plot, one-click jump to that plot.

**Action item:** Drew must paste `worker.js` into Cloudflare dashboard `deadcetera-proxy` worker and Deploy — does not auto-deploy from GitHub.



## Active Phase: Mode A Hardening (2-week sprint)

**Decision 2026-04-22:** Do NOT begin Phase 1 provider refactor yet. For the next 2 weeks, all calendar effort goes to Mode A operational hardening. Provider architecture starts only after 14 days of stable DeadCetera use.

**Mode A DoD:** (1) shared calendar mirrors into GrooveLinx, (2) GL events reliably appear in shared cal, (3) deletes propagate, (4) no duplicates, (5) clear last-sync timestamps, (6) conflict logic trusted, (7) Brian's device works without handholding, (8) mobile feels usable.

## Mode A Sprint — Week 1 (2026-04-22)

Shipped:
- **#1 block UPDATE propagation** — Phase 1.5 falls through on dirty blocks (updatedAt > lastSyncedAt); `saveScheduleBlock(block, syncOnly)` prevents dirty-loop when writing back sync metadata
- **#2 block DELETE propagation** — Mode A auto-propagates without prompt; tombstones on Google failure; Phase 1.5 retries on next sync; Phase 1.5 delete path checks return value before hard-deleting local
- **#4 misconfig banner** — red banner on Google panel when `_getBandCalendarId` returns null due to personal cal rejection; one-tap "Fix in Rules →"
- **#7 accurate Last Synced** — `calendar_sync_state.lastSyncAt` written on every sync (not just when syncToken issues); panel reads from it; `GLCalendarSync.getSyncState()` public API
- **#8 title+date dedupe** — `_findByTitleAndDate` catches direct-Google events created by one member when another pushes via GrooveLinx; prevents duplicates
- **#9 broadened legacy cleanup** — scan now matches events by GrooveLinx description signature, not just "Busy" title; excludes events with matching schedule_block
- **#11 pending-push indicators** — amber ⏳ pending for unsynced/dirty blocks; red ⏳ delete pending for tombstones
- **#12 explicit success copy** — persistent "✓ Last run: N pushed · N imported" line below Last Synced; survives toast fade
- **#14 specific failure messaging** — `_calTranslateSyncError` maps 401/403/404/5xx/network/no-scope/another_device_syncing to actionable user copy + fix hints

Admin button added: **"Move misplaced events"** in Google panel — one-shot fix for the Drew/Brian personal-calendar leak. Runs per-user; only moves events the current token owns.

Week 2 cleanup (now closed — 2026-04-22 build 20260422-223450):
- **#10 mobile scheduling audit** — code-only audit complete. Tap-target fixes for Google panel admin bar + all new modals. Full doc: `02_GrooveLinx/specs/mobile_scheduling_audit.md` (10-point physical-device checklist).
- **#13 sync activity log** — shipped. Firebase `bands/{slug}/sync_activity`, trim-to-100 on write. "Sync activity" admin-bar button → per-member row modal.

## Mode A Sprint — Paths B + C + D#6 (2026-04-22, build 20260422-222724)

Structural fix for the "invisible event" class of bugs (hidden/private events failing to sync) + the operational gaps it exposed.

- **Path B — Freebusy overlay safety net (`gl-calendar-sync.js`):** `_runHiddenEventCheck(bandCalId)` runs on every sync after Phase 2. Fetches full events.list window + freebusy over same window; `_computeHiddenRanges` subtracts visible intervals from busy ranges. Remainders ≥ 5 min = hidden events. Stored in `calendar_sync_state.lastSyncResult.{hiddenCount, hiddenRanges}` (capped at 50 ranges). Public API: `GLCalendarSync.runHiddenEventCheck`.
- **Path B UI (`calendar.js`):** Yellow banner on Google panel when `hiddenCount > 0`; "Show which dates" opens a details modal grouping ranges by day; "How to fix" opens generic visibility-help modal with instructions for changing one event's visibility + account-level default.
- **Path C — Mode A welcome wizard:** First successful Mode A connect triggers `_calShowModeAWelcome` (gated by `localStorage.gl_cal_mode_a_welcome_shown`) — 3-card checklist: pick a shared group calendar, set Default visibility to Public (with fix guide), share the calendar with the band. "Visibility help" button in admin bar for on-demand access.
- **Path D #6 — Stale-member nudge:** Every successful sync stamps `google_connections/{myKey}/lastSyncAt`. `_calMemberSyncStatus(key, connsMap)` classifies each member: fresh (<1d green), recent (1-7d amber), stale (>7d red). Connections popover shows age label per row + "their schedule changes won't reach the band calendar" hint for stale rows. Yellow banner on Google panel lists stale members by first name.

All copy is band-agnostic ("your shared band calendar", not "DeadCetera") per multi-band generic-copy rule.

---

## Previous Phase: Band Adoption + Polish

## What's Live (2026-04-21)

### Calendar Sync — Phase 1.5: Schedule Blocks → Band Calendar
- **Mode A auto-push of member unavailability blocks.** Previously "Drew — busy" blocks lived only in GrooveLinx's local grid; the shared band calendar never saw them. Now `_syncBandCalendarImpl` has a Phase 1.5 that iterates the current user's schedule blocks and pushes them to the band calendar with visibility=default + `glBlockId` extended property.
- **`syncConflictToGoogle(block, opts)` extended** — accepts `{ calendarId, summary, visibility }`. Legacy call sites still use the old defaults (primary calendar, "Busy" summary, private visibility).
- **Phase 2 block re-link** — incoming Google events with `glBlockId` matching a local MY-block save `googleEventId` back and skip import (prevents duplicate grid render). Other members' block-events import normally so the unavailability classifier picks them up.
- **Phase 2 converted** from `forEach` to `for` loop so the new `await` calls work.
- **Toast surfaces block counts** — "1 block pushed" etc.
- **Known unfinished:** delete propagation for schedule blocks (Phase 1.5 handles create and update only; delete relies on a `_deleted` flag that isn't set anywhere yet). Also the manual per-block "Add to Google" button still targets personal calendar in all modes.

### Windows Dark Form Controls
- `html { color-scheme: dark }` in `index.html` — fixes Brian's white `<select>` popup on Windows Chromium. All 101 selects + date/time pickers + scrollbars now render dark on Windows. macOS was already correct.

### Calendar Sync — Stale-Token Recovery
- **401/403 → silent re-auth → retry once.** In-memory `accessToken` can be truthy-but-stale (expired / revoked / cookie-cleared). Previous code passed the truthy check, hit Google, got 401, aborted Phase 2 pull, and imported zero events — while the toast still said "Sync complete — everything up to date". Fixed: `gl-calendar-sync.js` sets `result.needsReauth` on 401/403; `calendar.js` calls `_calConnectGoogle()` and re-runs `syncBandCalendar()` once.
- **Honest sync toast.** An errored sync that landed nothing now opens with "⚠ Sync failed — Google sign-in expired. Tap Sync Calendars again." If some events landed but errors occurred on other pages, the error is labeled "partial" instead of sharing the leading checkmark.
- **Resolved the 2026-04-20 "Brian's events invisible via API" mystery.** That diagnosis (Google UI/API discrepancy) was wrong. Real cause was our stale-token handling; Brian's cookie-clearing habit amplified the frequency on his side.

---


## What's Live (2026-04-19 → 2026-04-20 — gig-hardening arc)

### Live Gig Chart Rendering
- **Wrap-safe chord chart renderer** — chord+lyric pairs as atomic inline-block segments; chords stay locked above their syllables when lines wrap at narrow widths. Supports dash-runs ("G-F#-F-E"), parenthesized annotations ("(slow down)", "(hold)"), multi-line chord groups merging over a single lyric, and chord+annotation lines like "F --> Am C 3x".
- **Auto-scroll engine with right-edge vertical pill** — ▲ / ▶⏸ / ▼ hands-free chart reading. Per-song speed saved to localStorage, BPM-derived default, long-press repeat, visible in Focus mode. Replaced broken browser Full Screen mode (froze on iPad).
- **iPhone multi-space collapse fix** — chord cells use non-breaking spaces so "F7  F#7  G7" renders with real spacing on iOS (desktop was always fine).
- **Self-healing entity decode** — charts with stored `&amp;` now render as `&` without DB migration (`glDecodeHtmlEntities` runs before all render paths).
- **Focus mode polish** — safe-area insets, touch-action pan-y, exit button pinned, thumb-zone controls reclaimed.

### Offline-for-Gig Infrastructure
- **SWR Firebase cache** — `loadBandDataFromDrive` checks localStorage first, returns instantly, refreshes in background. 20s timeout on cache-miss (was too-tight 5s before).
- **"Prep for Gig" one-tap warmer** — Stage View button walks every song in the setlist, pre-fetches chart + 8 metadata fields per song + band-level setlists/gigs/calendar. Button label reflects real cache state on every render (Ready / Top-up / Download).
- **Cache-first service worker** — parses index.html on install and pre-caches every local asset + Firebase SDK + Google Fonts CSS. Font woff2 files now served by browser (SW intercept was causing opaque-response errors).
- **Save-path writes to SWR cache** — `saveBandDataToDrive` now updates the SWR cache after Firebase write, so next read returns fresh data synchronously. Fixed silent "I saved but it didn't stick" class of bugs.

### Calendar Mode A Contract (strict)
- **Only the shared band calendar contributes in Mode A.** Personal-calendar overlays disabled, legacy free/busy imports auto-purged on every sync (`purgeNonBandEvents`).
- **Dedupe sweep shipped** — pre-push check via `privateExtendedProperty=glEventId`, sync lock via Firebase transaction, re-link path fixed, admin "Clean duplicates" button.
- **Gig end-time end-to-end** — `endTime` now plumbs through gig → calendar_event → Google; `_buildEventBody` respects provided end time; one-shot "Refresh gig times" admin button to migrate existing events.
- **Unified Gig editor in Calendar** — Arrival / Soundcheck / Pay / Sound Person / Contact editable inline from Calendar event form when type=gig. Dual-writes to `bands/X/gigs` so Gigs-page list stays in sync. Step 1 of the Calendar/Gigs merge.
- **Unavailability classification runs in main sync path** — extracted `_detectUnavailability` to module scope, wired into `_importGoogleEvent` + `_reconcileEvent`, one-shot `reclassifyUnavailability` runs after every Sync Calendars tap.
- **Mode A contract copy in UI** — amber warning on onboarding Mode A card, green "How shared calendar mode works" callout at top of Rules modal when Mode A is active. Documents the two gotchas (must be on shared calendar + must not be Private visibility).
- **Auto-reconnect to Google** — Sync Calendars / Clean duplicates / Refresh gig times now auto-trigger OAuth re-auth when `accessToken` is missing (common after page reload since token is session-scoped).
- **Hover details enriched** — day hover shows title + organizer name ("by Brian") + event description (truncated) for shared-calendar events.

### Pocket Meter v2 — Guided Mode (MVP)
- **Chooser UI** — Use song BPM / Type BPM / Tap 4 to lock. Default guided mode (legacy auto-detect moved behind "Experimental auto-detect" toggle with a return chip).
- **Locked screen** — "YOU'RE AT {actualBPM}" big, "Locked at {target} BPM" reference chip, rushing↔dragging meter with damped dot, tier label (Locked In / Rushing / Dragging / Uncertain), confidence pill (Solid / Medium / Uncertain).
- **IOI-based classifier** — measures actual BPM from median inter-onset interval, compares to locked BPM. Replaced phase-based approach that was aliasing (clapping at 131 against 120 was showing Dragging).
- **Groove Feel per user** — Tight / Normal / Loose, stored globally. Tight flips to Rushing/Dragging faster; Loose is forgiving (jam band mode).
- **False-positive protection** — warmup state, listening gap detection, hysteresis on flip-out.

### Reliability Fixes
- **Start Gig launched wrong setlist** — ID/index collision in `_loadSetlistFromStore`. Setlist IDs contain digits so `parseInt` was interpreting "3p7kqn..." as index 3. Fixed: string-ID match first, numeric-index only for pure-numeric IDs.
- **Lock This Set silently lost changes** — save path didn't write SWR cache; next read returned stale data. Fixed app-wide.
- **Transient "No chart yet"** — 5s SWR timeout was firing on cold-start even on good wifi. Raised to 20s; song-detail distinguishes "doesn't exist" from "couldn't load" (Retry button).
- **Stage View horizontal-pan trap on iPhone** — flex row missing `min-width:0` let long titles push past viewport, triggering iOS pan-horizontal lock that broke vertical scroll.
- **Firebase save rejecting calendar_events** — undefined fields from a couple reconcile paths. Fixed, plus added `_sanitizeForFirebase` defense-in-depth on every save.
- **`mode is not defined` silent error** — typeof-guarded the legacy Play-mode branch in `_sdPopulateBandLens`.

### Docs
- **`02_GrooveLinx/docs/firebase-rules-snippet.md`** — canonical reference for the `.indexOn` declaration needed for `/bands/*/activity_log`. Rules live in Firebase Console, not repo.

---

## What's Live (2026-04-18 — earlier that same day)

## What's Live (2026-04-18)

### Setlists — Stage View + Plan Clean Build / Edit split

**Stage View** (pre-gig confidence + launch):
- SVG Confidence Meter arc at top — human labels (Strong / Mixed / At Risk), color-coded
- Dynamic coaching: names specific weak songs, tone adapts to count
- Per-set readiness cards, collapsed by default
- Expanded rows: weak songs amber + bold + 5px bar; strong songs dim 3px bar
- Sacred read-only: only `Start Gig` and set expand/collapse clickable
- `Start Gig` hands off to existing `live-gig.js` via `_lgLaunchSetlistId` (no duplicate performance code)

**Plan Mode — Clean Build (default, mobile):**
- Rows: `1  Title  →    96 · D` — BPM · Key at 0.45 opacity, title dominant
- No edit chrome, no readiness grid, no break buttons on mobile
- Sets collapsible, one expanded at a time

**Plan Mode — Edit Mode (opt-in):**
- Single-line rows: `1  Title  ▲ ▼  Stop▾  ✕`
- No BPM/key in edit (reduces distraction)
- Stop / Flow / Segue / Cut labels kept (jam-band standard)

### Play tab speed fix (song-detail.js)

- Chart loads via own `await`, paints instantly
- 8 other Firebase reads run async, don't block
- `localStorage` cache at `gl_chart_{songKey}` — instant paint on repeat opens
- Before: 15–45s iPhone hang. After: <1s.
- Established permanent SLA: **music-use screens must render useful content in <1s**

### Live gig mode reclamation

- Controls 48px, header 40px → more chart real estate
- Settings menu with font size +/- (persists via localStorage)
- **Zen → Focus** rename everywhere (`lgToggleFocus`, `.lg-focus`, `lgFocusExit`)
- Focus mode has always-visible exit button
- Float player: minimize / close / drag / seek / transport controls; YouTube API preloaded

### Architectural rules adopted this session

- **One Job Per Screen** — canonical jobs: Song Workspace (learn/practice/edit), Setlist Plan (organize), Stage View (confidence/launch), Live Mode (perform). Challenge any screen accumulating secondary jobs.
- **<1s SLA for music-use screens** — critical content first, enrichment async, cache aggressively.
- **Layered IA, not deletion** — features repositioned via Core Nav / Contextual / Tools Drawer. Never prune by page-views alone; use frequency × value scoring.

### In-flight / next priorities

1. Real-world gig simulation QA on iPhone/iPad (sunlight, weak Wi-Fi, one-hand, stand distance)
2. Edit Chart path clarity — rename "Rehearsal Mode editor" → "Chart Editor"
3. Songs page inline Practice (focus songs only, keep Songs calm)
4. Home feed: wire remaining activity types (rehearsal_started/ended, song_added, gig_added, practice, status_changed); rank by emotional importance
5. Weekly Band Pulse card on Home
6. Gig context on Schedule page
7. Merge Contacts into Venues
8. Shared chart renderer (code quality; defer until user-facing pain clear)

---


Build: **local stamp via `scripts/stamp-version.py`** (GitHub Actions auto-stamp disabled)
Deploy: **Vercel** (auto-deploy on push to main)
Worker: **Cloudflare** (`wrangler deploy worker.js --name deadcetera-proxy`)
Production URL: **https://app.groovelinx.com**

---

## What's Live (2026-04-13)

### Navigation Simplification (NEW 2026-04-17)
- **5 core pages** in left rail: Home, Songs, Rehearsal, Schedule, Setlists
- **Mobile bottom tab bar**: 5 icons + More, replaces hamburger menu on ≤768px
- **Tools drawer**: ··· button opens searchable bottom sheet with all 17 secondary pages
- **Settings cleanup**: UAT/Bugs/Plan tabs hidden behind `gl_dev_mode` flag
- **Zero capability removed**: every page accessible via drawer, URL, or search

### Performance Sprint (NEW 2026-04-17)
- **Firebase read deduplication**:
  - Home: gigs loaded once (was 2x), setlists/calendar use GLStore cache first
  - loadGigHistory(): checks GLStore.getGigs/getSetlists before Firebase
  - Home reduced from 6 Firebase reads to 3-4
- **Boot render consolidation**: removed duplicate renderHomeDashboard() call — single render after readiness
- **SWR cache fixes**: reset network flags on every page entry (Calendar + Setlists)
- **SWR boot seeding**: setlists cached in localStorage during boot for instant first visit
- **Calendar mode cached**: scheduling mode in localStorage — instant on repeat visits
- **Setlists no longer blocked on loadGigHistory()**: parallel instead of serial
- **Calendar repaint optimization**: fingerprint comparison skips redundant grid rebuilds
- **Generic event indicator**: 📅 emoji replaced with subtle 5px indigo dot
- **Freshness states**: Calendar, Setlists, and Home all show "Updated just now" / "Refreshing..."
- **PERF instrumentation**: `[PERF]` tags on all critical paths for waterfall analysis

### Mobile Touch Reorder (NEW 2026-04-16)
- **▲/▼ move buttons** replace HTML5 drag on ≤600px (drag events don't fire on iOS Safari)
- Buttons: 32×32px touch targets, stacked vertically next to song number
- `_slMovesong(setIdx, songIdx, dir)` splices array + re-renders + marks dirty
- Desktop keeps native drag-and-drop (mobile rows omit `draggable` attribute)
- First song hides ▲, last song hides ▼

### Calendar Repaint Optimization (NEW 2026-04-16)
- `_calEventFingerprint()` checksums date+type+title+endDate+updated for all events
- Background SWR refresh skips `_calRenderGridOnly()` when fingerprint matches cached version
- Fingerprint seeded from cache on SWR first paint
- Freshness indicator still updates even when grid repaint skipped

### Mode A/B/C Burn Test (2026-04-16)
- **Verified clean**: all mode-dependent UI properly gated
- Mode A: band calendar only (no personal calendars, no availability warnings)
- Mode B: availability + conflict rules + band calendar + partial scope warnings
- Mode C: mode selector only (Google panel cleared, availability hidden, quick actions hidden)
- No cross-contamination found

### Mobile Setlist Redesign (NEW 2026-04-16)
- **2-line stacked card layout** for editor song rows on ≤600px
  - Line 1: drag handle + number + title + delete
  - Line 2: key/bpm badges + love indicators + segue selector
- **52px+ min-height** song rows (was 28px micro rows)
- **Full-width Open button** on list view cards
- **44px+ song picker rows** with 20px checkboxes
- **Safe-area padding** on bottom CTA (env(safe-area-inset-bottom))
- **80px spacer** so last song fully visible above fixed save bar
- Search results use `sl-search-result` class for comfortable touch

### SWR Trust States (NEW 2026-04-16)
- **Calendar freshness**: "Updated Xm ago · Refreshing…" during SWR → "Updated just now" after
- **Setlist freshness**: same pattern in page header with `sl-freshness` indicator
- Both show "Offline — showing cached data" on network failure
- Calendar indicator auto-fades after 8 seconds

### Stronger SWR Invalidation (NEW 2026-04-16)
- **Deep setlist comparison** via `_slDataChanged()`: checks name, date, notes, lock state, updated timestamp, song order/segue checksum
- Replaces ID-only comparison that missed in-place edits

### Stale-While-Revalidate Cache (NEW 2026-04-16)
- localStorage-backed SWR for Calendar + Setlists
- `GLStore.getCachedBandData(type)` / `setCachedBandData(type, data)`
- Calendar: renders from cache instantly, background Firebase refresh
- Setlists: renders from cache instantly, background Firebase refresh
- Only repaints if data actually changed (deep comparison)
- Skeleton grid fallback if no cache exists
- iPhone Firebase takes 45+ seconds — SWR bypasses this completely

### Scheduling Modes + Onboarding (NEW 2026-04-14 → 2026-04-16)
- Three modes: A_SHARED_SYNC, B_PERSONAL_AVAILABILITY, C_NATIVE
- Onboarding chooser: "Get [band] on the same page" with 3 cards
- Mode C recommended by default (fastest activation)
- Mode saved to Firebase, persists forever, changeable in Rules
- Rules modal content adapts to selected mode
- Mode dropdown live-updates modal sections
- Mode A: band calendar only (no personal calendars)
- Mode B: availability + conflict rules + band calendar
- Mode C: mode selector only (minimal)
- Upgrade path prompts: C→B and B→A nudges in weekly pressure

### Two-Way Sync Engine (NEW 2026-04-14 → 2026-04-16)
- `syncBandCalendar()`: Phase 1 push → Phase 2 pull (syncToken) → Phase 3 delete propagation
- Google Calendar syncToken for incremental sync (only deltas)
- Delete sync: GrooveLinx deletes propagate to Google and vice versa
- Reconciliation: Google wins for scheduling, GL preserves metadata
- Worker: syncToken + showDeleted passthrough support

### Multi-Day Events (NEW 2026-04-16)
- Event form has End Date field
- Single record in Firebase with date + endDate
- Grid shows event on every day it spans
- Delete removes entire range in one action
- Google sync: proper all-day multi-day format (exclusive end date)
- Inbound sync imports as single record (not per-day expansion)

### Calendar Render Architecture (NEW 2026-04-14)
- **Single grid renderer**: `_calRenderGridOnly()` is the ONLY function that writes to `#calGrid`
- **Shell vs grid separation**: `renderCalendarInner()` builds static shell only, calls `_calRenderGridOnly()` once
- **Month navigation**: `calNavMonth()` calls `_calRenderGridOnly()` directly — no shell rebuild
- **Stale nav guard**: `_calNavSeq` token prevents old async callbacks from overwriting current month
- **No duplicate renders**: removed ~90 lines of duplicate grid builder from renderCalendarInner
- **All event CRUD** uses `_calRenderGridOnly()` instead of `renderCalendarInner()`
- **Post-auth/sync flows** use targeted `_calRenderGooglePanel()` + `_calRenderGridOnly()`
- **isUnavailable variable** added to grid renderer for unavailable event detection
- **Grid day alignment verified**: June 25, 2026 = Thursday (confirmed via Python + JS)

### Atomic Event Save Architecture (NEW 2026-04-14)
- **Phase A (Core Save)**: validate → write to Firebase → confirm success → clear form → re-render grid → toast
- **Phase B (Post-Save Enrichment)**: gig record + setlist + Google sync — non-blocking, try/catch isolated
- **Targeted Firebase updates**: gigId + Google sync metadata stamped via individual field updates (no full array re-read/re-save)
- **Form DOM guard**: checks calDate/calType/calTitle exist before reading (venue modal safety)
- **Google sync gated**: only runs after confirmed core save success

### Band Calendar Inbound Sync (NEW 2026-04-14)
- **`pullBandCalendarEvents()`**: fetches ALL events from band Google Calendar with pagination
- **Multi-day all-day events**: expanded to one record per day with "(day N/M)" suffix
- **Dedup by googleEventId**: skips already-imported events, upgrades existing to unavailable if keywords match
- **"From Google" badge**: shown on imported events in day panel and upcoming list
- **Member unavailability detection**: keyword + member name matching (strong: out/unavailable/pto/vacation/away/travel; weak: busy/conflict/off/blocked only with member name)
- **Whole-band phrases**: "band off", "everyone out", "no rehearsal"
- **Ambiguous events**: imported but NOT blocking (unavailable_unassigned type)
- **Availability injection**: unavailable events create blocked ranges for assigned members only
- **Help text in Rules**: naming convention examples for users
- **KNOWN BUG**: Google Calendar API returns different event sets for different time ranges — Brian's events appear in June-only query but not in 6-month range. Needs investigation.

### Availability Enable Fix (NEW 2026-04-14)
- **Persisted scope state**: gl_scope_calendar + gl_scope_freeBusy saved to localStorage after OAuth
- **Three-source priority**: 1) OAuth callback flag → 2) persisted localStorage → 3) config fallback
- **Smart button labels**: "Connect Google Calendar" vs "Set Up Availability" vs "Reconnect"
- **Post-auth re-render**: _calRenderGooglePanel() + _calRenderGridOnly() (not renderCalendarInner)
- **Auto-open availability setup** after first connect
- **_hasToken crash fixed**: was using undefined variable in Google panel render

### Stage Plot (NEW 2026-04-14)
- **Rename**: click plot name to rename via prompt
- **Save As**: duplicate current plot under new name with fresh ID
- **Dropdown styling**: forced dark theme colors for readability

### Calendar Trust Layer + Band Calendar Architecture (NEW)
- **Band calendar separation**: personal calendars (read-only availability) vs shared band calendar (write target)
- **Band calendar selection**: dropdown with placeholder, saved at band level in Firebase
- **Band calendar auto-excluded** from availability queries (prevents circular conflicts)
- **Fuzzy name matching**: band calendar hidden from availability list by ID, exact name, or substring match (+ localStorage fallback)
- **Deterministic circular conflict suppression**: Layer 1 = extendedProperties tag on Google events + eventId matching; Layer 2 = fuzzy time-window fallback
- **All new Google events tagged** with `extendedProperties.private.groovelinx = 'true'` + `glEventId`
- **Parallel events.list** call alongside free/busy to identify band events deterministically
- **Sync Now guard fixed**: checks both `ev.sync.externalEventId` and `ev.googleEventId` patterns (was re-creating all synced events, spamming invites)
- **OAuth scope expanded**: `drive.readonly` added for Drive audio streaming
- **Drive API enabled** on GCP projects 177899334738 + 218400123401
- **Connect-then-setup flow**: after OAuth, guides user to select band calendar before event creation
- **Access enforcement**: blocks event creation when no band calendar configured

### Rehearsal Page Two-Mode Split (NEW)
- **Review Mode** (default): timeline/analysis primary, plan collapsed in right rail
- **Plan Mode** (click "Plan Next Rehearsal"): plan workspace is primary content, review collapses
- **Page title changes**: "Rehearsal" vs "Planning Next Rehearsal"
- **Plan Mode right rail**: readiness, upcoming gig, Plan Versions (single canonical location), quick actions
- **Top bar adapts**: Review = Start/Plan/Solo; Plan = Back to Review / save state / Start This Plan
- **Auto-seed**: entering Plan Mode with no plan creates one from focus songs
- **Save state syncs** to both plan card and top bar
- **No duplicate rendering**: Plan Versions, What Happened, plan card — each rendered once

### What to Work On — Accept/Dismiss (NEW)
- Each recommendation has green checkmark (add to plan) and red X (dismiss)
- Accept adds song to rehearsal plan if not already there
- Dismiss fades out the row with animation
- Quick triage of 18+ recommendations

### Drive Audio Streaming for Timeline Playback (NEW)
- **Worker GET /drive-stream**: proxies Google Drive API, forwards Range headers for seeking
- **Worker POST /drive-audio**: extracts file ID, tries OAuth token → public download fallback
- **Load Audio picker**: "Stream from Google Drive" vs "Choose local file" options
- **Session-matched audio**: matches mixdown by rehearsal_date to session date
- **Auto Drive scope request**: if token lacks drive.readonly, triggers consent before streaming
- **Blob-based playback**: fetches full file, creates blob URL (Safari won't play cross-origin audio src)
- **Session tracking**: loading audio no longer jumps to latest session — stays on viewed session

### Golden Standard Timelines (NEW)
- **4/3/2026**: 29 songs, 4h19m, all timestamps manually verified by Drew
- **3/23/2026**: 15 entries, 7 songs, ~83 min, includes detailed per-song performance notes
- Scripts: `scripts/apply-golden-timeline.js`, `scripts/apply-golden-timeline-0323.js`
- `label_overrides` persisted in Firebase for each session
- `_goldenStandard: true` flag hides confidence/explanation labels (not useful for verified data)

### iPad + Mobile UX Fixes (NEW)
- **Calendar day card auto-scrolls** into view on iPad (was below fold)
- **Inline sign-in prompt** replaces confirm() dialog (Safari blocks OAuth popups after confirm)
- **"tap to RSVP" hint** next to member names in day panel
- **Smart add buttons**: collapse into "+ Add another event" when date already has an event
- **Update banner unified**: was two separate systems (SW-based dark + version.json purple); now one
- **iPhone safe area**: update banner uses `env(safe-area-inset-top)` padding

## What's Live (2026-04-11)

### Audience Love — Second Axis of Song Value (NEW)
- `saveAudienceLove/getAudienceLove/getAllAudienceLove` in GLStore
- Purple heart widget on Song Detail (1-5: Quiet → CROWD GOES WILD)
- Priority scoring updated: `(bandLove * 0.5) + (audienceLove * 0.2) + ((5 - readiness) * 0.3)`
- Compact dot indicators on song list rows (red = band, purple = audience)
- Insight lines when both rated: "Band + crowd favorite — anchor song", etc.

### Personal Love Overrides + Band Disagreement Insights (NEW)
- Per-member personal band love + audience love (stored under `personal/{memberKey}`)
- "Your take" row below each shared rating (only current user sees/edits)
- Disagreement detection: `getBandLoveDisagreement()`, `getAudienceLoveDisagreement()`
- Insight text: "You're higher/lower than the band", "Mixed band feelings", "Band agrees strongly"
- Action hints: "worth pushing?", "revisit or consider dropping", "try it live and decide"
- Privacy: no individual scores exposed by name, insights are aggregate/directional only

### Love-Aware Recommendations (NEW)
- Focus engine reasons now contextual: "Crowd loves this, get it tight", "Anchor song — keep it sharp"
- GLInsights detail bullets include love context
- Home hero subtitle adds love context when no other urgency exists

### Setlist Intelligence (NEW)
- Energy model: `(audienceLove * 0.6) + (bandLove * 0.3) + (readiness * 0.1)`
- Energy flow visualization: horizontal colored bar strip below setlist songs
- Song badges in editor: ❤️ band love + 💜 audience love + ⚠ readiness warning
- Set quality insights (max 4): energy flow, mid-set dip, love balance, readiness
- Setlist song search fix: click to add works, "add to band" only shows when no matches

### Rehearsal Scorecard + Song Outcome Cards (NEW)
- Scorecard on latest session card: score (0-100), label, biggest win/risk, top 2 actions
- Full scorecard in session report view: headline, highlights, top 3 action items
- Song Outcome Cards: grid per song with outcome status (Locked in / Improving / Needs work / Skipped)
- Status derived from segment data (attempt count, duration, clean takes)

### Analyzer Calibration Framework (NEW)
- `tests/calibration/calibration-runner.js`: evaluates against gold truth segments
- Metrics: detection rate, label accuracy, false start recall, jam misclassification
- Gold truth: `rehearsal_2026-04-03_gold.json` (29 segments, 4+ hours)
- Segmentation improvements: false start clustering, partial song detection, jam detection
- Plan cascade eliminated: planMatch weight 0.35 → 0.15, position-dependent scoring removed
- Low-confidence-only matches labeled "Unknown (needs review)" instead of wrong song name
- RMS tuned: MIN_SILENCE 8s → 3s, MIN_MUSIC 60s → 20s

### Analyze Recording (renamed from "Recreate from Recording")
- Local file upload: file picker for MP3/WAV (primary), URL input (secondary fallback)
- Duplicate date detection: warns if session exists, offers "Add to existing" or "Create separate"
- Trend indicator: "Trend" label + descriptive tooltip explaining emoji dots
- Fixed: analysis now actually runs on uploaded files (broken setContext path replaced)

### Schedule Enhancements (2026-04-10 evening)
- Cross-midnight event classification fix (10pm-1am events now detected as conflicts)
- Event-aware availability: gigs use actual time window instead of fixed rehearsal window
- Availability explainability: hover tooltips show "Brian busy 2-4pm (conflicts with this gig)"
- Decision anchor: "No conflicts — 4 of 5 members clear" replaces generic text
- Selected date card: conflict summary with per-member time + conflict status
- Conflict resolver: plain language "3 of 5 clear · 1 conflict · 1 same-day"

### Deploy Infrastructure Hardening (NEW)
- `scripts/stamp-version.py`: targeted updates to 3 files with validation, fails on anomalies
- `tests/verify-deploy.sh`: checks version.json, HTML meta, SW CACHE_NAME, ?v= consistency, HTTP status
- Disabled auto-stamp GitHub Action (was causing constant rebase conflicts)
- Vercel caching: no-cache headers on version.json + service-worker.js
- index.html rebuilt from 1.1MB (64 duplicate head sections) to 55KB
- Love cards now render in panel mode (Songs page right panel)

### Rehearsal Analyzer Intelligence Pipeline (2026-04-11 → 2026-04-12)
- **Per-segment BPM extraction**: spectral flux onset detection via OfflineAnalyser.analyseBuffer()
- **Per-segment groove/pocket analysis**: stability score, pocket position, drift, iois for PocketMeterTimeSeries
- **CLAP audio embeddings**: 512-dim vectors from localhost:8200 (laion/clap-htsat-unfused)
- **Chord detection (Essentia)**: auto-analysis via localhost:8100, chordSimilar signal active
- **Spoken cue transcription**: Deepgram on talking segments, song title cue extraction
- **Chart chord parsing**: 408 charts auto-parsed into fingerprints for chord-to-audio matching
- **On-demand segment decode for large files**: raw MP3 bytes → targeted 35s chunk decode → feature extraction
- **Candidate priority order**: plan → recent sessions → active → library (was alphabetical)
- **Progress bar**: inline stage descriptions + elapsed time during analysis
- **Groove-informed quality labels**: "Nailed it" (tight timing), downgrade on loose timing

### Songs Page Stabilization (NEW 2026-04-12)
- **Hydration gating**: songs + DNA required before first render (no premature flash)
- **Normalized row model**: all cell data pre-computed, no per-cell async reads
- **Sort safety**: love/readiness sorts fall back to title until data loads
- **6-column layout**: Song | Readiness | Status | ⚠ | Band | Love (sortable)
- **Mobile responsive**: Status/NeedsWork/Band hidden on <640px
- **Love preload fix**: waits for Firebase + retries on failure (iPad fix)
- **Cleanup summary**: shows Key/BPM/Lead/Status/Structure with checkmarks

### Architecture Cleanup (NEW 2026-04-12)
- **Mode system removed**: Practice/Rehearse/Play are perspectives, not UI gates
- **All pages always visible**: no mode-based nav hiding
- **All song detail tabs always visible**: no lens-by-mode gating
- **Dead code removed**: _renderSharpenDashboard, _renderPlayDashboard (~150 lines)
- **home-dashboard-cc.js removed**: legacy summary chip system
- **Google consent fix**: no automatic popup, no silent token flash
- **Starter pack DNA guard**: seed values only fill blanks, never overwrite live data
- **debugSongDNA() helper**: inspect runtime song data from console

### Love System Fixes (2026-04-11 → 2026-04-12)
- **Instant heart feedback**: optimistic cache update before Firebase write
- **Apostrophe fix**: songs with ' in title no longer break onclick handlers
- **Consistent colors**: Band Love = all red hearts, Audience Love = all purple hearts
- **Love preload**: triggers on songs ready event, retries if Firebase not available

---

## What's Live (2026-04-10)

### Google Calendar Integration (FULLY WORKING + TRUST LAYER)
- OAuth scope: `email profile calendar drive.readonly`
- API enabled on projects **177899334738** (OAuth client) + **218400123401** (API key)
- Band calendar architecture: personal availability (read-only) vs shared band calendar (write target)
- Band calendar saved at Firebase band level, shared across all members
- Deterministic circular conflict suppression (extendedProperties + eventId + fuzzy fallback)
- Sync Now guard checks both sync patterns before re-pushing events
- Multi-user band sync: each member connects their own calendar
- Free/busy merged from all connected members via shared Firebase path
- External Google events visible as indigo dots on calendar cells
- Consent flow: revoke → fresh consent → verify scope → connect
- Connect-then-setup flow: guides user to configure band calendar after first connect

### Conflict → Google Calendar Sync (NEW 2026-04-10)
- After saving a conflict: "Also add to your Google Calendar?" prompt
- Creates private "Busy" event (no band names, no attendees, no reminders)
- Edit: auto-updates Google event silently if already synced
- Delete: prompts "Also remove from Google Calendar?"
- Existing/legacy conflicts: 📅 sync button in conflict list
- ✅ badge on already-synced conflicts

### Band Room Upgrades (NEW 2026-04-10)
- Rich text rendering: **bold**, *italic*, bullets, numbered lists, headers, horizontal rules
- Textarea auto-grows on paste (multi-line post support)
- Full text always visible (no truncation)
- Edit + Delete in overflow menu (creator/admin only)
- @mention tagging in compose + edit (with @everyone/@band groups)
- "Forgot to tag?" prompt on long untagged posts

### Availability (2026-04-10)
- Modal: month-by-month infinite scroll (3 months → load more)
- Member names on every month block
- Matrix: 7/14/30/60/90 day ranges
- "View conflicts" toggles full conflict list in right rail

### Mobile Fixes (2026-04-10)
- Rehearsal page stacks to single column on mobile (removed inline grid override)
- manifest.json 403 fixed (vercel.json explicit rewrite before catch-all)

### Design System (2026-04-07 → 2026-04-09)
- GLStatus, GLUrgency, GLPriority, GLScheduleQuality engines
- Shared CSS tokens, components, spacing, interaction patterns
- Calendar full-cell day design with hover popovers
- Mobile bottom card for date interaction

### System-Wide Layout (2026-04-07 → 2026-04-08)
- All 6 pages on shared split layout (primary + context rail)
- Rehearsal: timeline-first, plan in rail
- Schedule: calendar-dominant, minimal right rail
- Band Feed/Room: continuous stream + context filters

### Action System (2026-04-06 → 2026-04-07)
- Deep linking, @mentions, follow-up signals, accountability
- Proactive intelligence: risk detection, nudges, streaks
- Band alignment: shared focus, commitments, team summaries

---

## Next Steps
1. **Fix BPM double-detection**: OfflineAnalyser detecting snare+kick as separate beats, doubling BPM (172-225 should be 86-112). Need half-BPM correction.
2. **Fix plan songs not reaching matcher**: `window.glPlannerQueue` is empty at analysis time. Need to load plan from Firebase or pass from UI.
3. **Raise matching confidence**: with chords+tempo active (2 signals), scores are 0.12-0.30 — below MEDIUM threshold (0.5). Chart fingerprint matching needs tuning.
4. **Reference clip seeding**: add "Record reference" to song detail for signature intros/heads
5. **Performance**: 120-minute analysis for 4h recording — need to parallelize or skip CLAP for speed

---

## What's Live (2026-04-02)

### Song Data Consolidation — songs_v2 (2026-03-31 → 2026-04-02)

**Architecture:**
- All song data migrating from `songs/{sanitizedTitle}/` to `songs_v2/{songId}/`
- `songPath()` routes 17 v2 types via `_SONG_V2_TYPES` registry
- `_autoMigrateSongDataToV2()` runs on boot with schema versioning (v2)
- `loadBandDataFromDrive()` reads v2 first, falls back to legacy songs/ path
- songId invariant enforced at all insertion points

**Key Bug Fixes (2026-04-02):**
- Chart data stuck in legacy path — added legacy fallback for all v2 type reads
- "View Chart" button was no-op in Improve mode — replaced with `sdShowChart()` inline chart loader
- Song Info (Key/BPM/Lead/Status) missing in Improve mode — added collapsible `<details>` section

### Product Capability Audit (2026-04-02)

Full inventory of 50+ features across all pages and modes. Key findings:

**CRITICAL — No mode switcher UI exists.** App permanently in Improve (sharpen) mode. These features are built but inaccessible:
- Band Love rating (5 hearts) — Lock In mode only
- Prospect Voting — Lock In mode only
- Song Structure editor — Lock In mode only
- Band Discussion (per-song) — Lock In mode only
- Play mode (stage-ready charts, set navigation, transition hints, performance confidence)
- Harmony Lab (Sing lens) — Lock In tab bar only

**Naming drift:** "Sharpen" still user-visible in dashboard header. "Learn lens" in tooltip.

**Dead code:** `_renderSharpenDashboard` + 3 helpers (never called). Entire `home-dashboard-cc.js` is a no-op.

**Broken pages:** Feed (no renderer), Equipment/Contacts (empty/minimal).

**Recommended consolidation plan (4 phases):**
- Phase A: Quick wins — naming fixes, dead code deletion, broken page fixes
- Phase B: Un-gate hidden features from mode locks
- Phase C: Structural cleanup — mode model decision, duplication reduction
- Phase D: Internal naming normalization (function names, CSS comments)

### Player & UI Fixes (2026-03-31 → 2026-04-02)

- Spotify embed "Preview only" label with open-in-Spotify link
- YouTube search via Worker proxy, seek buttons (-10s/+10s/±30s), completion screen
- Mini player: draggable YouTube player with transport controls, A-B loop, speed control
- Archive.org collection name fixes: JGB, moe., Phish, ABB, DMB
- Schedule page: RSVP buttons, confidence-scored best rehearsal dates, intelligence banner
- Left rail: emoji icons restored, collapsible sections with chevrons
- Calendar: date off-by-one fix, month nav collapse fix, event row redesign

---

### UX Overhaul (2026-03-29 — 15+ deploys)

**Home — State-Driven Single Action:**
- Dynamic "Next up for your band" card based on state detection
- Priority: no songs → no setlist → gig imminent → has setlist (rehearsal always primary)
- Weak songs demoted to secondary amber bar, not primary hero
- Intent section: Practice Solo / Rehearse / Play a Gig (smaller, secondary)
- Zero post-click friction: rehearsal starts directly, practice opens first weak song, play launches live mode
- Avatar hidden when generic (`display:none`), only shows with actionable insight

**Navigation — Simplified:**
- Primary nav: Home, Songs, Rehearsal, Schedule, Setlists
- Secondary (collapsed): Tools, Band, More
- Mode switcher (Sharpen/Lock In/Play) removed from nav
- Calendar → Schedule (throughout)

**Setlists — "Build Your Set":**
- Page title "Build Your Set" with supporting copy
- "Lock This Set" save label
- "Add a song..." placeholder, "✂ add a break"
- 3-song inline assist: "That's a solid start. Want me to round this into a full set?"
- Post-save: "Set locked. You're ready to rehearse." + [Start Rehearsal] [Done]

**Rehearsal — Plan vs Session Clarity:**
- Page title "Rehearsal Plan" with blue Draft badge
- Two-button CTA: "Start Band Rehearsal" (guardrail modal) + "Open Charts to Practice" (no session)
- Guardrail: "Start a real band rehearsal? This will create a dated session."
- GrooveMate toast at rehearsal start
- "Rehearsal saved." end screen
- Separator between draft plan and saved rehearsals
- "Recreate from Recording" for recovering past sessions

**Reveal — 4-Block Emotional Payoff:**
- Headline → Proof → Directive → Confidence Close
- Contextual CTA: "Run That Transition Again" / "Practice That Ending" / "Lock In the Tempo"
- Varied confidence close phrases
- No raw scores or confidence values

**Songs — Practice-First:**
- "Work on this next" recommendation card with "▶ Practice Now"
- "What to fix" items on recommendation
- Simplified chips (max 2 per row: lifecycle + needs work/setlist)
- "Practice This Song" section on Song Detail (4 buttons with GrooveMate guidance)
- Band chart always primary on Song Detail (external links under "References")

**Schedule — Action-Driving:**
- "Next Up" section at top: next rehearsal + next gig
- Availability warnings, readiness warnings, risk signals
- "Who's in" member roster with status icons
- Action buttons: "Open Rehearsal Plan" / "View Setlist"

**Focus Engine (Single Source of Truth):**
- `GLStore.getNowFocus()` — top 5 priority songs with composite scoring
- Scoring: readiness gap × setlist membership × gig urgency × band love × active status
- All UI consumers wired (Home, Songs, Rehearsal) — replaces scattered weak-song logic

**Band Love + Song Value Model:**
- 1-5 heart rating per song (`GLStore.saveBandLove()` / `getBandLove()`)
- Derived status: Core Song, Worth the Work, Utility, Shelve Candidate, Solid, Growing, Developing
- Priority scoring: `(love * 0.6) + ((5 - readiness) * 0.4)`
- Song Detail: heart rating widget + derived status badge

**Calendar Locations:**
- Location fields on events: name, address (Google Maps directions link), venue, meeting link
- Reusable location picker (`GLStore.getRehearsalLocations()` / `createRehearsalLocation()`)
- Inline "add new location" form + Meet/Zoom link field

**Chart Import:**
- `/fetch-chart` Worker endpoint — external chart fetch with HTML stripping (5KB cap)
- "Make this your chart" on external tab links → imports into band chart

**Songs — Focus Mode:**
- "Get Better" button enters focus mode (`_glFocusMode=true`)
- Filters songs to focus list only with "What to work on right now" banner

**Voice Coach:**
- Locked Web Speech voice (never changes mid-session)
- Configurable ElevenLabs voice with localStorage persistence

**Test Stabilization:**
- Deterministic readiness flags: `GL_APP_READY`, `GL_PAGE_READY`, `GL_REHEARSAL_READY`
- Shared `tests/helpers.js` with condition-based waits
- Burn-in test suite (`tests/burn-in.spec.js`) — repeated critical flows with timing capture
- Chaos test suite (`tests/chaos.spec.js`) — 46 tests: rapid nav, state mutation, cross-surface, edge cases
- 188 tests total (142 core + 46 chaos), 0 failed

### Data Integrity Pass (2026-03-30)

**Active Status Centralization (SYSTEM LOCK):**
- `GLStore.ACTIVE_STATUSES` — single canonical 6-status set
- `GLStore.isActiveSong(title)` / `GLStore.avgReadiness(title)` — public API
- 20+ inline status definitions replaced across 8 files
- Bug fix: 4 files had 4-status variant missing `wip`/`active`

**Duplicate Logic Removed:**
- 3 weak-song calculators → `GLStore.getNowFocus()`
- 4 inline readiness computations → `GLStore.avgReadiness()`
- `statusCache`/`readinessCache` direct access → GLStore wrappers

**Critical Fixes:**
- bestshot.js `song.status` mutation on shared object — removed
- song-detail.js `statusCache` bypass — routed through `GLStore.setStatus()`
- rehearsal.js unguarded `item.songs[0]/[1]` — bounds check added

**Dead Code:** 4 unreachable functions (97 lines) in app.js + dead bandKnowledgeBase paths

### Stabilization Pass (2026-03-30)

**GL_PAGE_READY Lifecycle (SYSTEM LOCK):**
- `_navSeq` counter guards all GL_PAGE_READY assignments
- Stale async renders detected and skipped

**focusChanged Event Model (SYSTEM LOCK):**
- `invalidateFocusCache()` emits `'focusChanged'`
- Home, Songs, Rehearsal subscribe and re-render when visible

**Firebase Error Filtering (SYSTEM LOCK):**
- Suppresses only `.lp` long-poll disconnect noise

### Rehearsal Intelligence V1 (2026-03-30)

**Analysis Pipeline** (`js/core/rehearsal-analysis-pipeline.js`):
- Notes → timestamps, song refs, player mentions, issues, positives
- Automatic trigger after session save and "Recreate from Recording"
- Persists to `bands/{slug}/rehearsal_sessions/{id}/analysis`
- Re-run with `force: true` + UI button in session report

**GLInsights** (`js/core/gl-insights.js`):
- Persistent Firebase issue store: `bands/{slug}/intelligence/issues/` and `sessions/`
- Action plans: 7 types × 2 severity levels, bandmate voice, anchors + stop conditions
- Focus boost: +1 to +4 in getNowFocus() based on rehearsal issues
- Explainability: `getFocusExplanation(title)` with reasons + details
- Trend detection, bulk re-analysis utility

**GrooveMate Intelligence** (`js/core/gl-avatar-guide.js`):
- 5 intelligence triggers wired into existing guidance system
- `getNextBestAction()` uses GLInsights for song-specific coaching
- buildContext() enriched with issue data from analysis pipeline

**Unified Guided Home** (`js/features/home-dashboard.js`):
- Single hero card: intelligence → schedule → default (priority cascade)
- High confidence: hero only, no competing actions
- Inline justification + "Quick plan ▼" expandable depth
- Progress + momentum signals inside expansion
- Removed: session plan, what to do next, last rehearsal issues (redundant)

### Core Product Loop
1. **Build Set** → "Build Your Set" with guided flow
2. **Start Rehearsal** → guardrail confirms real session, GrooveMate listens
3. **Run Rehearsal** → rehearsal mode with charts, timer, chart notes banner
4. **End + Rate** → Smart Rating Assist, "Rehearsal saved." confirmation
5. **Reveal** → 4-block emotional payoff with contextual CTA
6. **Practice** → zero-friction song detail with Play Along / Learn / Harmonies / Lyrics

### Intelligence Layer
- **GLProductBrain**: unified insight API — sole source for rehearsal UI
- **RehearsalAnalysis**: notes parsing → structured insights → per-song issues → recommendations
- **GLInsights**: persistent issue store, action plans, focus boost, trend detection, explainability
- **Event Segmentation v2**: 12 event types, rhythm detection
- **Story Engine**: timeline grouping, plan vs actual, coaching
- **Narrative Engine**: headline, biggestIssue, strongestMoment, nextAction
- **Smart Rating**: 5-signal scoring

### Reliability
- **Never Blank Screen**: GLRenderState (loading/error/empty/degraded states)
- **Lazy Loading**: 15 scripts (967KB) deferred
- **Boot Staging**: Stage 1 (render) → Stage 2 (Firebase) → Stage 3 (idle preloads)
- **Deterministic test flags**: GL_APP_READY, GL_PAGE_READY (_navSeq guarded), GL_REHEARSAL_READY
- **Reactive focus**: focusChanged event → auto re-render on visible pages
- **Firebase noise filter**: long-poll disconnect suppressed

### Data Architecture (SYSTEM LOCK)
- **Firebase-only**: all band data from `/bands/{slug}/`
- **Band-scoped songs**: non-DC bands start empty
- **GLStore.ready()**: dependency gating (firebase/members/songs/statuses/setlists)
- **GLStore.isBootReady()**: true when firebase + songs + members resolved

---

## Pending Work

### HIGH
1. Founder Test Manual (Sections 2-10)
2. Brian's 4/1 rehearsal test
3. Demo video clips for website
4. Real user testing with non-founder bands

### MEDIUM
5. Stripe payment integration
6. Venue Google Places autocomplete
7. Push notifications for rehearsal reminders

### LOW
8. BrowserStack real-device testing
9. Migrate remaining `allSongs` / `statusCache` / `readinessCache` global refs through GLStore (85+ sites, low risk)
10. Remove `bandKnowledgeBase = {}` stub + 15 app.js comment references

---

## Key Architecture Files

```
js/core/groovelinx_store.js             — GLStore: ACTIVE_STATUSES, getNowFocus (+issue boost), focusChanged
js/core/rehearsal-analysis-pipeline.js  — Notes → insights → issues → recommendations → Firebase
js/core/gl-insights.js                  — Persistent intelligence: issue store, action plans, trends, explainability
js/core/gl-avatar-guide.js             — GrooveMate: 5 intelligence triggers, context-aware coaching
js/features/home-dashboard.js          — Unified hero card: directive, intelligence-driven, zero-hesitation
js/features/rehearsal.js                — Rehearsal Plan + "Start Here" directive + session report + re-analyze
js/features/songs.js                    — Focus engine + explainability dots + focusChanged subscriber
js/features/setlists.js                — "Build Your Set" + energy flow + set insights
js/features/calendar.js                 — Schedule (Next Up, availability, risk, locations, explainability)
js/features/song-detail.js             — Song detail (band love + audience love + personal overrides + disagreement)
js/ui/gl-left-rail.js                  — Simplified nav (5 primary + collapsed secondary)
js/ui/gl-avatar-ui.js                  — Avatar: photorealistic portraits, action plans, settings
js/ui/navigation.js                     — GL_PAGE_READY lifecycle (_navSeq guard, SYSTEM LOCK)
rehearsal-mode.js                        — Rehearsal mode + Reveal + analysis pipeline trigger
js/core/firebase-service.js             — Firebase CRUD, songPath(), songs_v2 migration, legacy fallback
worker.js                               — Cloudflare Worker: /tts, /fetch-chart, /transcribe, API proxies
js/core/recording-analyzer.js          — Upload → segment → match → review → report (NEW)
js/core/song_matching_engine.js        — 6-signal weighted scoring + learning loop (NEW)
services/chord-analysis/               — Essentia chord hints microservice, port 8100 (NEW)
services/audio-embeddings/             — CLAP embedding microservice, port 8200 (NEW)
scripts/stamp-version.py                — Safe version stamping (replaces auto-stamp CI)
tests/verify-deploy.sh                  — Post-deploy verification script
tests/calibration/calibration-runner.js — Analyzer accuracy evaluation vs gold truth
tests/chaos.spec.js                      — Chaos stability tests (46 tests)
tests/burn-in.spec.js                   — Burn-in stability tests
```

### Completed (2026-04-02 → 2026-04-05)

- ✅ Un-gated Band Love, Structure, Discussion, Voting from Lock In mode
- ✅ Song Page restructured: Practice/Play/Versions/Harmony guided workflows
- ✅ Home redesigned: decision engine, one hero, no competing actions
- ✅ Recording Analysis: upload → segment → match → review → report
- ✅ Song Matching Engine: 6-signal weighted scoring + learning loop
- ✅ Chord Analysis microservice (Essentia, port 8100) installed + running
- ✅ Audio Embedding microservice (CLAP, port 8200) installed + running
- ✅ Deepgram transcription wired via Cloudflare Worker
- ✅ Rehearsal page: timeline-driven command center (not dashboard)
- ✅ Timeline: expandable segments, groove colors, hover actions, loop, compare, practice
- ✅ Band Notes: topic labels, transcripts, "Applies to" song links
- ✅ Coaching Insights: priority songs + specific fixes + action buttons
- ✅ Lightweight playback: stream-only blob URL (no OOM on 337MB files)
- ✅ Auto-split oversized segments (>15min) via energy dip detection
- ✅ Persistent label overrides across re-analyses
- ✅ Page consolidation: removed duplicate CTAs, collapsed plan, removed legacy sections
- ✅ Segment-based report: single source of truth from reviewed segments
- ✅ Multiple OOM crash fixes (playback, chord analysis queue, file loading)

### Pending Work (Priority — Updated 2026-04-05)

**HIGH — Recording Intelligence:**
1. Calibrate song matching on real rehearsal data (threshold tuning with debug tools)
2. Wire chord hints into automatic post-segmentation (currently on-demand per segment)
3. Persist embedding bank to Firebase for cross-session learning
4. Test Deepgram transcription end-to-end on real talking segments
5. Auto-start chord/embedding services (Docker or systemd)

**HIGH — Timeline Enhancement:**
6. Waveform visualization in timeline strip
7. "Build next rehearsal from insights" flow (connect coaching → plan builder)
8. Inline A/B comparison (replace modal with inline expansion)
9. Progress bar inside playing row

**MEDIUM:**
10. Founder Test Manual (Sections 2-10)
11. Demo video clips for website
12. Real user testing with non-founder bands
13. Stripe payment integration
14. iPad/mobile responsive testing

**LOW:**
15. Delete dead dashboard code + home-dashboard-cc.js
16. Internal function naming normalization
17. BrowserStack real-device testing
