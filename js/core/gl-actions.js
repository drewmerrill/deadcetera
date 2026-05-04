// ============================================================================
// js/core/gl-actions.js — Shared cross-feature action registry.
//
// ROLE
//   Single point through which the GrooveMate decision engine (and,
//   eventually, the avatar action router) invokes feature actions. Each
//   feature self-registers its handlers from its own file, keeping
//   feature-specific logic out of GrooveMate.
//
// API
//   GLActions.register(name, handler, meta?)  — replace any prior entry
//   GLActions.run(name, args)                 — { ok, result|error, name }
//   GLActions.has(name)                       — bool
//   GLActions.list()                          — [{ name, meta }]
//
// CONTRACT
//   Action names use dot-namespacing: <feature>.<verb>. The registry
//   stub-registers the spec'd contract at load time so callers can
//   assume the surface exists from day one — real handlers overwrite
//   stubs when their feature file loads.
// ============================================================================
(function () {
  'use strict';

  var _registry = {};

  function register(name, handler, meta) {
    if (typeof name !== 'string' || typeof handler !== 'function') {
      console.warn('[GLActions] invalid register:', name);
      return;
    }
    _registry[name] = { handler: handler, meta: meta || {} };
  }

  function has(name) {
    return Object.prototype.hasOwnProperty.call(_registry, name);
  }

  function run(name, args) {
    var entry = _registry[name];
    if (!entry) {
      console.warn('[GLActions] no such action:', name);
      return { ok: false, error: 'no_such_action', name: name };
    }
    try {
      var result = entry.handler(args || {});
      return { ok: true, result: result, name: name, stub: !!entry.meta.stub };
    } catch (e) {
      console.error('[GLActions] action threw:', name, e);
      return { ok: false, error: 'handler_threw', message: String(e && e.message), name: name };
    }
  }

  function list() {
    return Object.keys(_registry).map(function (k) {
      return { name: k, meta: _registry[k].meta };
    });
  }

  // Stub-register the contract. Stubs return { stubbed: true } so callers
  // can detect the no-op path without throwing. Feature files overwrite
  // these via subsequent register() calls when they load.
  function _stub(name) {
    register(name, function () {
      console.info('[GLActions] stub:', name, '(no real handler registered yet)');
      return { stubbed: true, name: name };
    }, { stub: true });
  }
  // Stems
  _stub('stems.setLoop');
  _stub('stems.applyPracticeMode');
  _stub('stems.resetMix');
  _stub('stems.recordTake');
  // Rehearsal
  _stub('rehearsal.suggestNextSong');
  _stub('rehearsal.startRehearsal');
  // Songs
  _stub('songs.updateReadiness');
  _stub('songs.assignPractice');
  // Schedule
  _stub('schedule.suggestRehearsalDate');
  _stub('schedule.flagConflict');

  window.GLActions = {
    register: register,
    has: has,
    run: run,
    list: list
  };
})();
