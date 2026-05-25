// tests/uat-lab/contracts/songs.triage.desktop.js
//
// FIRST FLOW — chosen by Drew 2026-05-25 as Phase 1 lead per uat_lab_v1.md §11.2.
// Reason: HIGH-drift target per `specs/founder_ux_review_2026-05-22.md`; better
// candidate than home dashboard for screenshot harvesting, regression structure,
// cognitive-load review, and convergence pressure testing.

module.exports = {
  slug: 'songs.triage.desktop',
  knownStableFlow: 'Songs page triage',  // PROPOSED — awaiting Drew approval per uat_lab_v1.md §11.4
  viewport: 'desktop',
  viewportPx: { width: 1280, height: 720 },
  band: 'deadcetera',
  baseURL: 'http://localhost:8000',
  headless: true,

  // Bounded sequence — no interactive exploration in Phase 1
  steps: [
    { id: 'boot',                goto: '/' },
    { id: 'signin',              signIn: 'deadcetera' },
    { id: 'wait-app-ready',      waitForBoot: true },
    { id: 'nav-songs',           navigateAndWait: 'songs' },
    { id: 'settle',              wait: 800 },
    { id: 'shot-songs-initial', screenshot: 1 },
    { id: 'shot-songs-full',    screenshot: 2, fullPage: true },
  ],

  // Tier A QA expectations — honest pass/fail
  expectations: [
    {
      id: 'no-console-errors',
      assertConsoleErrors: 0,
      category: 'Bug',
      severity: 'MED',
      title: 'Console errors during Songs page load',
    },
    {
      id: 'songs-page-ready',
      assertJs: '() => window.GL_PAGE_READY === "songs"',
      category: 'Bug',
      severity: 'HIGH',
      title: 'Songs page did not signal GL_PAGE_READY',
    },
    {
      id: 'body-text-nonzero',
      assertMinBodyText: 200,
      category: 'Bug',
      severity: 'HIGH',
      title: 'Songs page rendered with near-empty body text',
    },
    {
      id: 'songs-loaded',
      assertJs: '() => (window.GLStore && typeof window.GLStore.getSongs === "function") ? window.GLStore.getSongs().length > 0 : false',
      category: 'Bug',
      severity: 'HIGH',
      title: 'GLStore song library is empty on Songs page',
    },
    // ── C7 anti-drift assertions (2026-05-25) ─────────────────────────────
    // These catch future readiness-threshold divergence: the canonical
    // model (GLStatus in gl-decision-language.js) must be loaded, the
    // 6-band classify() must round-trip across the full 0-5 range, and
    // the home-dashboard count surfaces must agree with countByBand()
    // for the same dataset. If any of these fail, drift has been
    // re-introduced — investigate before shipping the offending change.
    {
      id: 'c7-canonical-model-loaded',
      assertJs: '() => !!(window.GLStatus && typeof window.GLStatus.classify === "function" && typeof window.GLStatus.thresholdAtLeast === "function" && typeof window.GLStatus.countByBand === "function" && Array.isArray(window.GLStatus.BAND_NAMES) && window.GLStatus.BAND_NAMES.length === 6)',
      category: 'Architecture Drift',
      severity: 'HIGH',
      title: 'C7: GLStatus canonical readiness model is not loaded',
    },
    {
      id: 'c7-bands-roundtrip',
      assertJs: '() => { var GLS = window.GLStatus; if (!GLS) return false; var probes = [[0,"unknown"],[1,"rough"],[2.5,"learning"],[3.5,"ready"],[4.5,"gigReady"],[5,"locked"]]; for (var i=0;i<probes.length;i++){ var got = GLS.classify(probes[i][0]).key; if (got !== probes[i][1]) { console.error("[C7 drift] avg=" + probes[i][0] + " expected " + probes[i][1] + " got " + got); return false; } } return true; }',
      category: 'Architecture Drift',
      severity: 'HIGH',
      title: 'C7: GLStatus.classify() does not round-trip across canonical bands',
    },
    {
      id: 'c7-count-coherence',
      assertJs: '() => { var GLS = window.GLStatus, GLStore = window.GLStore; if (!GLS || !GLStore || !GLStore.getSongs) return false; var songs = GLStore.getSongs(); if (!songs.length) return true; var rated = []; for (var i = 0; i < songs.length; i++) { var t = songs[i] && songs[i].title; if (!t) continue; var avg = (GLStore.avgReadiness ? GLStore.avgReadiness(t) : 0) || 0; if (avg > 0) rated.push({title: t, avg: avg}); } if (!rated.length) return true; var canonNeedsWork = GLS.countByBand(rated, ["rough","learning"]); var inlineNeedsWork = 0; for (var j = 0; j < rated.length; j++) { if (rated[j].avg > 0 && rated[j].avg < 3) inlineNeedsWork++; } if (canonNeedsWork !== inlineNeedsWork) { console.error("[C7 drift] needs-work count: canonical=" + canonNeedsWork + " vs inline-<3=" + inlineNeedsWork); return false; } return true; }',
      category: 'Architecture Drift',
      severity: 'HIGH',
      title: 'C7: countByBand([rough,learning]) does not match inline avg<3 over same dataset',
    },
    // ── GLPriority Phase 1 anti-drift assertions (2026-05-25) ─────────────
    // Catch future drift in the Operational Prioritization Layer:
    //   - canonical module loaded (no silent fallback)
    //   - composer respects maxItems cap
    //   - every item has a non-empty reason naming a signal source
    //     (defends against fake AI tone / opaque scoring drift)
    //   - no duplicate urgency surfacing — same gigId can't appear twice
    //     (defends against multiple producers competing for the same gig)
    {
      id: 'priority-canonical-loaded',
      assertJs: '() => !!(window.GLPriority && typeof window.GLPriority.computeTopPriorities === "function" && typeof window.GLPriority.computeTopPrioritiesSync === "function" && typeof window.GLPriority.getStats === "function")',
      category: 'Architecture Drift',
      severity: 'HIGH',
      title: 'GLPriority canonical orchestration module is not loaded',
    },
    {
      id: 'priority-reasons-non-empty',
      // Use computeTopPrioritiesSync to avoid async/Promise-coercion pitfalls
      // in page.evaluate string-form assertions. Sync variant skips the
      // recentRehearsals async load; that's fine for this shape check.
      assertJs: '() => { if (!window.GLPriority) return false; var items = window.GLPriority.computeTopPrioritiesSync({}, []); if (!Array.isArray(items)) return false; if (items.length > 5) { console.error("[GLPriority drift] returned " + items.length + " items, max is 5"); return false; } for (var i = 0; i < items.length; i++) { var it = items[i]; if (!it || typeof it.reason !== "string" || it.reason.trim().length < 10) { console.error("[GLPriority drift] item " + i + " has empty/short reason: " + JSON.stringify(it)); return false; } if (typeof it.kind !== "string" || !it.kind) { console.error("[GLPriority drift] item " + i + " missing kind"); return false; } if (typeof it.weight !== "number") { console.error("[GLPriority drift] item " + i + " missing weight"); return false; } } return true; }',
      category: 'Architecture Drift',
      severity: 'HIGH',
      title: 'GLPriority items missing reason / kind / weight, or exceeding maxItems',
    },
    {
      id: 'priority-no-duplicate-urgency',
      assertJs: '() => { if (!window.GLPriority) return false; var items = window.GLPriority.computeTopPrioritiesSync({}, []); var seenGigs = {}; for (var i = 0; i < items.length; i++) { var it = items[i]; if (it && it.gigId) { if (seenGigs[it.gigId]) { console.error("[GLPriority drift] duplicate urgency surfacing for gigId=" + it.gigId + " across kinds: " + seenGigs[it.gigId] + " and " + it.kind); return false; } seenGigs[it.gigId] = it.kind; } } return true; }',
      category: 'Architecture Drift',
      severity: 'HIGH',
      title: 'GLPriority surfaces the same gig in multiple competing items',
    },
  ],
};
