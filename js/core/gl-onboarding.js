// ── Onboarding / Band Activation ─────────────────────────────────────────────
//
// Progressive onboarding tracks 3 activation steps:
//   1. addSongs — band has >= 10 songs
//   2. inviteBandmates — band has >= 2 members (bandMembers count)
//   3. scheduleRehearsal — at least 1 rehearsal event exists
//
// State is computed from real data, not manual checkboxes.
// Dismiss state persists in localStorage.
//
// LOAD ORDER: must come after groovelinx_store.js (calls GLStore.getSongs and
// GLStore.emit). Consumers in home-dashboard.js null-check the export, so the
// brief absence during load is harmless.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 5) — was a
// self-contained state machine with one closure var and three external
// dependencies (getSongs, bandMembers global, emit). All three reach the
// new module via standard global / window.GLStore lookups.

(function() {
  'use strict';

  var _onboardingState = null;

  function evaluateOnboardingState(bundle) {
    var songs = (window.GLStore && window.GLStore.getSongs) ? window.GLStore.getSongs() : [];
    var songCount = songs.length;
    var memberCount = (typeof bandMembers !== 'undefined') ? Object.keys(bandMembers).length : 1;
    // Check for rehearsal events
    var hasRehearsal = false;
    var gigs = (bundle && bundle.gigs) ? bundle.gigs : [];
    // Also check calendar events if available
    if (bundle && bundle._calEvents) {
      hasRehearsal = bundle._calEvents.some(function(e) { return e.type === 'rehearsal'; });
    }
    if (!hasRehearsal && typeof loadBandDataFromDrive === 'function') {
      // Sync check — will be evaluated after data loads
    }

    var addSongs = songCount >= 10;
    var hasInvites = bundle && bundle._invites && bundle._invites.some(function(inv) { return inv.status === 'pending' || inv.status === 'accepted'; });
    var inviteBandmates = memberCount >= 2 || hasInvites;
    var inviteDetail = hasInvites ? memberCount + ' member' + (memberCount !== 1 ? 's' : '') + ' + invites sent' : memberCount + ' member' + (memberCount !== 1 ? 's' : '');
    var scheduleRehearsal = hasRehearsal;

    var completedCount = (addSongs ? 1 : 0) + (inviteBandmates ? 1 : 0) + (scheduleRehearsal ? 1 : 0);
    var isDismissed = false;
    try { isDismissed = localStorage.getItem('gl_onboarding_dismissed') === '1'; } catch(e) {}

    _onboardingState = {
      isActive: completedCount < 3 && !isDismissed,
      isComplete: completedCount === 3,
      isDismissed: isDismissed,
      completedCount: completedCount,
      steps: {
        addSongs: { complete: addSongs, detail: songCount + ' song' + (songCount !== 1 ? 's' : '') + ' in library' },
        inviteBandmates: { complete: inviteBandmates, detail: inviteDetail },
        scheduleRehearsal: { complete: scheduleRehearsal, detail: scheduleRehearsal ? 'Rehearsal scheduled' : 'No rehearsal yet' }
      }
    };
    return _onboardingState;
  }

  function getOnboardingState() {
    return _onboardingState;
  }

  function getOnboardingProgress() {
    if (!_onboardingState) return { completed: 0, total: 3 };
    return { completed: _onboardingState.completedCount, total: 3 };
  }

  function isBandActivated() {
    return _onboardingState ? _onboardingState.isComplete : false;
  }

  function dismissOnboardingCard() {
    try { localStorage.setItem('gl_onboarding_dismissed', '1'); } catch(e) {}
    if (_onboardingState) _onboardingState.isDismissed = true;
    if (window.GLStore && window.GLStore.emit) window.GLStore.emit('onboardingDismissed', {});
  }

  if (typeof window !== 'undefined' && window.GLStore) {
    window.GLStore.evaluateOnboardingState = evaluateOnboardingState;
    window.GLStore.getOnboardingState      = getOnboardingState;
    window.GLStore.getOnboardingProgress   = getOnboardingProgress;
    window.GLStore.isBandActivated         = isBandActivated;
    window.GLStore.dismissOnboardingCard   = dismissOnboardingCard;
  }
})();
