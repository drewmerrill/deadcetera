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
  ],
};
