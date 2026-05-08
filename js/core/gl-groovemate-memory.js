// ── GrooveMate ambient memory ────────────────────────────────────────────────
// Lightweight cross-session memory for the unified GrooveMate decision
// engine. Recorded by GLGrooveMate.evaluate / accept / dismiss; consumed
// by GLContext.snapshot. Capped at 20 entries per list to stay cheap to
// serialize on every write. Persisted to localStorage so suggestions
// don't re-nag the user across page loads.
//
// LOAD ORDER: must come after groovelinx_store.js (attaches to
// window.GLStore at load time).
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 3) — was a
// pure-localStorage helper with zero closure coupling to the main store.
// First in-IIFE extraction; validates the move-function-and-state-together
// pattern.

(function() {
  'use strict';

  var GM_KEY = 'gl_groovemate_memory';
  var GM_CAP = 20;

  function _gmLoad() {
    try {
      var raw = localStorage.getItem(GM_KEY);
      if (!raw) return { history: [], dismissed: [], recentAccepted: [] };
      var parsed = JSON.parse(raw);
      return {
        history: Array.isArray(parsed.history) ? parsed.history : [],
        dismissed: Array.isArray(parsed.dismissed) ? parsed.dismissed : [],
        recentAccepted: Array.isArray(parsed.recentAccepted) ? parsed.recentAccepted : []
      };
    } catch (e) {
      return { history: [], dismissed: [], recentAccepted: [] };
    }
  }

  function _gmSave(mem) {
    try { localStorage.setItem(GM_KEY, JSON.stringify(mem)); } catch (e) {}
  }

  function _gmAppend(listName, entry) {
    var mem = _gmLoad();
    var list = mem[listName] || [];
    list.unshift(Object.assign({ ts: Date.now() }, entry || {}));
    mem[listName] = list.slice(0, GM_CAP);
    _gmSave(mem);
    return mem;
  }

  function getGroovemateMemory() {
    return _gmLoad();
  }
  function recordGroovemateDecision(entry) { return _gmAppend('history', entry); }
  function recordGroovemateDismissal(entry) { return _gmAppend('dismissed', entry); }
  function recordGroovemateAccepted(entry) { return _gmAppend('recentAccepted', entry); }
  function clearGroovemateMemory() {
    _gmSave({ history: [], dismissed: [], recentAccepted: [] });
  }

  if (typeof window !== 'undefined' && window.GLStore) {
    window.GLStore.getGroovemateMemory      = getGroovemateMemory;
    window.GLStore.recordGroovemateDecision = recordGroovemateDecision;
    window.GLStore.recordGroovemateDismissal= recordGroovemateDismissal;
    window.GLStore.recordGroovemateAccepted = recordGroovemateAccepted;
    window.GLStore.clearGroovemateMemory    = clearGroovemateMemory;
  }
})();
