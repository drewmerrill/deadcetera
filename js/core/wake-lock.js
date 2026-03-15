/**
 * js/core/wake-lock.js — Screen Wake Lock utility
 *
 * Prevents device sleep during active utility/performance modes.
 * Uses the Screen Wake Lock API where supported, degrades silently elsewhere.
 *
 * Usage:
 *   glWakeLock.acquire('pocket-meter')   — request wake lock with a reason tag
 *   glWakeLock.release('pocket-meter')   — release when mode exits
 *   glWakeLock.releaseAll()              — emergency cleanup
 *
 * Multiple callers can hold locks simultaneously. The browser wake lock
 * is held as long as at least one caller has an active lock.
 * Automatically re-acquires after visibilitychange (browser tab return).
 */

(function () {
  'use strict';

  var _sentinel = null;       // WakeLockSentinel from navigator.wakeLock
  var _holders = {};          // { tag: true } — active holders
  var _supported = ('wakeLock' in navigator);

  async function _acquireBrowser() {
    if (!_supported || _sentinel) return;
    try {
      _sentinel = await navigator.wakeLock.request('screen');
      _sentinel.addEventListener('release', function () { _sentinel = null; });
      console.log('[WakeLock] Acquired');
    } catch (e) {
      // Permission denied or not supported in this context
      console.log('[WakeLock] Could not acquire:', e.message);
    }
  }

  function _releaseBrowser() {
    if (!_sentinel) return;
    try {
      _sentinel.release();
      console.log('[WakeLock] Released');
    } catch (e) {}
    _sentinel = null;
  }

  function acquire(tag) {
    _holders[tag] = true;
    _acquireBrowser();
  }

  function release(tag) {
    delete _holders[tag];
    if (Object.keys(_holders).length === 0) {
      _releaseBrowser();
    }
  }

  function releaseAll() {
    _holders = {};
    _releaseBrowser();
  }

  function isActive() {
    return Object.keys(_holders).length > 0;
  }

  // Re-acquire after tab switch (browser releases wake lock on visibility change)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Object.keys(_holders).length > 0 && !_sentinel) {
      _acquireBrowser();
    }
  });

  window.glWakeLock = {
    acquire: acquire,
    release: release,
    releaseAll: releaseAll,
    isActive: isActive,
    supported: _supported,
  };

  console.log('[WakeLock] ' + (_supported ? 'API available' : 'Not supported — will degrade silently'));
})();
