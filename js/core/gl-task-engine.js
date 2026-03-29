/**
 * gl-task-engine.js — GrooveMate Task Execution Engine
 *
 * Strict execution loop: INTENT → PLAN → CONFIRM → EXECUTE → VERIFY → EXPLAIN
 *
 * Sits on top of:
 * - GLActionRouter (intent detection)
 * - GLTools (tool execution)
 * - GLOrchestrator (next action)
 *
 * EXPOSES: window.GLTaskEngine
 */

(function() {
  'use strict';

  // ── Plan Templates ─────────────────────────────────────────────────────
  // Maps intents to multi-step plans with risk assessment.

  var PLAN_TEMPLATES = {
    run_rehearsal: {
      label: 'Run My Rehearsal',
      steps: [
        { action: 'runMyRehearsal', label: 'Build smart rehearsal plan + create setlist' }
      ],
      risk: 'medium',
      baseConfidence: 0.85
    },
    import_artist_pack: {
      label: 'Import Artist Pack',
      steps: [
        { action: 'importArtistPack', label: 'Import songs + create setlist + add sections' }
      ],
      risk: 'medium',
      baseConfidence: 0.85
    },
    bulk_add_songs: {
      label: 'Add Multiple Songs',
      steps: [
        { action: 'bulkAddSongs', label: 'Add songs to library' }
      ],
      risk: 'medium',
      baseConfidence: 0.8
    },
    create_setlist: {
      label: 'Create Setlist',
      steps: [
        { action: 'createSetlist', label: 'Build setlist from library' }
      ],
      risk: 'low',
      baseConfidence: 0.9
    },
    add_song: {
      label: 'Add Song',
      steps: [
        { action: 'addSong', label: 'Add to library' }
      ],
      risk: 'low',
      baseConfidence: 0.95
    },
    add_song_to_setlist: {
      label: 'Add to Setlist',
      steps: [
        { action: 'addSongToSetlist', label: 'Add song to current setlist' }
      ],
      risk: 'low',
      baseConfidence: 0.9
    },
    add_chart_note: {
      label: 'Add Chart Note',
      steps: [
        { action: 'addChartNote', label: 'Save note to chart' }
      ],
      risk: 'low',
      baseConfidence: 0.95
    },
    update_chart_sections: {
      label: 'Add Sections',
      steps: [
        { action: 'suggestSections', label: 'Set song structure' }
      ],
      risk: 'low',
      baseConfidence: 0.85
    },
    attach_chart_source: {
      label: 'Attach Source',
      steps: [
        { action: 'attachChartSource', label: 'Attach link to chart' }
      ],
      risk: 'low',
      baseConfidence: 0.9
    },
    save_rehearsal_note: {
      label: 'Save Rehearsal Note',
      steps: [
        { action: 'saveRehearsalNote', label: 'Save note' }
      ],
      risk: 'low',
      baseConfidence: 0.95
    },
    // Compound tasks
    setup_band: {
      label: 'Full Band Setup',
      steps: [
        { action: 'importArtistPack', label: 'Import songs' },
        { action: 'createSetlist', label: 'Create setlist' }
      ],
      risk: 'medium',
      baseConfidence: 0.8
    }
  };

  // ── PLAN ────────────────────────────────────────────────────────────────

  function plan(intent, input) {
    var template = PLAN_TEMPLATES[intent];
    if (!template) return null;

    return {
      id: 'task_' + Date.now().toString(36),
      intent: intent,
      input: input,
      label: template.label,
      steps: template.steps.map(function(s, i) {
        return { index: i, action: s.action, label: s.label, status: 'pending', result: null, error: null };
      }),
      confidence: template.baseConfidence,
      risk: template.risk,
      createdAt: new Date().toISOString(),
      status: 'planned'
    };
  }

  // ── CONFIRM ─────────────────────────────────────────────────────────────

  function needsConfirmation(taskPlan) {
    if (!taskPlan) return true;
    // Auto-execute: high confidence + low risk
    if (taskPlan.confidence >= 0.9 && taskPlan.risk === 'low') return false;
    return true;
  }

  // ── EXECUTE ─────────────────────────────────────────────────────────────

  async function execute(taskPlan) {
    if (!taskPlan || !taskPlan.steps) return taskPlan;
    var tools = window.GLTools;
    if (!tools) {
      taskPlan.status = 'failed';
      taskPlan.error = 'Tool registry not available';
      return taskPlan;
    }

    taskPlan.status = 'executing';
    taskPlan.startedAt = new Date().toISOString();

    for (var i = 0; i < taskPlan.steps.length; i++) {
      var step = taskPlan.steps[i];
      step.status = 'running';

      try {
        // Route to correct tool
        var result = await _executeTool(step.action, taskPlan.input);

        if (result && result.success) {
          step.status = 'success';
          step.result = result;
        } else {
          // Retry once
          result = await _executeTool(step.action, taskPlan.input);
          if (result && result.success) {
            step.status = 'success';
            step.result = result;
            step.retried = true;
          } else {
            step.status = 'failed';
            step.error = result ? result.message : 'Unknown error';
            step.result = result;
            // Continue to next step (partial success supported)
          }
        }
      } catch(e) {
        step.status = 'failed';
        step.error = e.message || 'Execution error';
      }
    }

    // Determine overall status
    var allSuccess = taskPlan.steps.every(function(s) { return s.status === 'success'; });
    var anySuccess = taskPlan.steps.some(function(s) { return s.status === 'success'; });
    taskPlan.status = allSuccess ? 'complete' : anySuccess ? 'partial' : 'failed';
    taskPlan.completedAt = new Date().toISOString();

    return taskPlan;
  }

  async function _executeTool(toolName, input) {
    var tools = window.GLTools;
    if (!tools) return { success: false, message: 'Tools not loaded' };

    // Extract args from input text
    var text = (typeof input === 'string') ? input : (input && input.text) || '';

    switch(toolName) {
      case 'runMyRehearsal':
        var durMatch = text.match(/(\d+)\s*min/);
        return tools.runMyRehearsal(durMatch ? durMatch[1] : 60);

      case 'importArtistPack':
        var packId = (typeof GLActionRouter !== 'undefined') ? GLActionRouter.detectIntent(text) : null;
        // Extract pack from text directly
        var packs = { 'billy joel': 'billy_joel', 'elton john': 'elton_john', 'grateful dead': 'grateful_dead', 'dead': 'grateful_dead', 'phish': 'phish', 'beatles': 'beatles', 'wedding': 'wedding', 'wsp': 'wsp', 'allman': 'allman', 'goose': 'goose', 'dmb': 'dmb', 'campfire': 'campfire', 'worship': 'worship', 'standards': 'standards' };
        var lower = text.toLowerCase();
        var detectedPack = null;
        for (var key in packs) { if (lower.indexOf(key) >= 0) { detectedPack = packs[key]; break; } }
        return detectedPack ? tools.importArtistPack(detectedPack) : { success: false, message: 'Pack not recognized' };

      case 'bulkAddSongs':
        var titles = text.split(/[,\n]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 1; });
        return tools.bulkAddSongs(titles);

      case 'createSetlist':
        var name = text.replace(/create\s*(a\s*)?setlist\s*/i, '').trim();
        return tools.createSetlist(name);

      case 'addSong':
        var title = text.replace(/add\s*(a\s*)?song\s*/i, '').replace(/["']/g, '').trim();
        return tools.addSong(title);

      case 'addSongToSetlist':
        var songTitle = text.replace(/add\s*.*to\s*setlist\s*/i, '').replace(/["']/g, '').trim();
        return tools.addSongToSetlist(songTitle);

      case 'addChartNote':
        var noteText = text.replace(/add\s*(a\s*)?note:?\s*/i, '').trim();
        var activeSong = (typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : '';
        return tools.addChartNote(activeSong || 'Unknown', noteText || text);

      case 'suggestSections':
        var secSong = (typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : '';
        return tools.suggestSections(secSong || 'Unknown', text);

      case 'attachChartSource':
        var urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        var url = urlMatch ? urlMatch[1] : '';
        var srcSong = (typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : '';
        return tools.attachChartSource(srcSong || 'Unknown', url);

      case 'saveRehearsalNote':
        var rehNote = text.replace(/save\s*rehearsal\s*note:?\s*/i, '').trim();
        return tools.saveRehearsalNote(rehNote || text);

      default:
        return { success: false, message: 'Unknown tool: ' + toolName };
    }
  }

  // ── VERIFY ──────────────────────────────────────────────────────────────

  async function verify(taskPlan) {
    if (!taskPlan) return false;
    // Check each successful step has a real result
    var verified = true;
    taskPlan.steps.forEach(function(step) {
      if (step.status === 'success' && (!step.result || !step.result.success)) {
        step.status = 'unverified';
        verified = false;
      }
    });
    taskPlan.verified = verified;
    return verified;
  }

  // ── EXPLAIN ─────────────────────────────────────────────────────────────

  function explain(taskPlan) {
    if (!taskPlan) return { summary: 'No task to explain.', next: null };

    var successSteps = taskPlan.steps.filter(function(s) { return s.status === 'success'; });
    var failedSteps = taskPlan.steps.filter(function(s) { return s.status === 'failed'; });

    var summary = '';
    if (taskPlan.status === 'complete') {
      // Gather details from results
      var details = successSteps.map(function(s) { return s.result ? s.result.message : s.label; }).join(' ');
      summary = details;
    } else if (taskPlan.status === 'partial') {
      summary = successSteps.length + ' of ' + taskPlan.steps.length + ' steps completed. ';
      if (failedSteps.length) summary += 'Failed: ' + failedSteps.map(function(s) { return s.label + ' (' + (s.error || 'unknown') + ')'; }).join(', ');
    } else {
      summary = 'Could not complete: ' + (failedSteps[0] ? failedSteps[0].error : 'unknown error');
    }

    // Determine next suggestion
    var next = null;
    if (taskPlan.status === 'complete') {
      var lastResult = successSteps[successSteps.length - 1].result;
      if (lastResult && lastResult.action === 'import_artist_pack') next = { label: 'Create a setlist', action: 'create_setlist' };
      else if (lastResult && lastResult.action === 'create_setlist') next = { label: 'View setlist', page: 'setlists' };
      else if (lastResult && lastResult.action === 'add_chart_note') next = { label: 'Open chart', page: 'songs' };
    }

    return { summary: summary, status: taskPlan.status, next: next, stepCount: taskPlan.steps.length, successCount: successSteps.length };
  }

  // ── FULL PIPELINE ───────────────────────────────────────────────────────

  // ── Dynamic Confidence (learns from history) ────────────────────────────

  var _taskHistory = null;

  function _loadHistory() {
    if (_taskHistory) return _taskHistory;
    try { _taskHistory = JSON.parse(localStorage.getItem('gl_task_history') || '{}'); } catch(e) { _taskHistory = {}; }
    return _taskHistory;
  }

  function _saveHistory() {
    try { localStorage.setItem('gl_task_history', JSON.stringify(_taskHistory || {})); } catch(e) {}
  }

  function _recordOutcome(intent, success, undone) {
    var h = _loadHistory();
    if (!h[intent]) h[intent] = { runs: 0, success: 0, failures: 0, undos: 0 };
    h[intent].runs++;
    if (success) h[intent].success++;
    else h[intent].failures++;
    if (undone) h[intent].undos++;
    _saveHistory();
  }

  function getDynamicConfidence(intent) {
    var template = PLAN_TEMPLATES[intent];
    var base = template ? template.baseConfidence : 0.7;
    var h = _loadHistory();
    var stats = h[intent];
    if (!stats || stats.runs < 3) return base; // Not enough data

    var successRate = stats.success / stats.runs;
    var undoRate = stats.undos / stats.runs;

    // Adjust: high success → boost, high undo → reduce
    var adjusted = base * 0.4 + successRate * 0.5 - undoRate * 0.3;
    return Math.max(0.3, Math.min(0.98, adjusted));
  }

  // ── Undo System ─────────────────────────────────────────────────────────

  var _lastSnapshot = null;
  var _lastTask = null;

  async function _snapshotBeforeTask(intent) {
    // Lightweight snapshot: save current song count + setlist count
    var snapshot = { intent: intent, ts: Date.now(), songCount: 0, setlistCount: 0 };
    try { snapshot.songCount = (typeof allSongs !== 'undefined') ? allSongs.length : 0; } catch(e) {}
    try {
      var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
      if (db && typeof bandPath === 'function') {
        var snap = await db.ref(bandPath('setlists')).once('value');
        var data = snap.val();
        snapshot.setlistCount = data ? (Array.isArray(data) ? data.length : Object.keys(data).length) : 0;
        snapshot.setlistData = data; // store for undo
      }
    } catch(e) {}

    // Store songs added by this task (for undo removal)
    snapshot.songsBeforeTask = (typeof allSongs !== 'undefined') ? allSongs.map(function(s) { return s.songId; }) : [];
    _lastSnapshot = snapshot;
    return snapshot;
  }

  async function undoLastTask() {
    if (!_lastSnapshot || !_lastTask) return { success: false, message: 'Nothing to undo.' };
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db) return { success: false, message: 'Not connected.' };

    try {
      // Restore setlists to pre-task state
      if (_lastSnapshot.setlistData !== undefined) {
        await db.ref(bandPath('setlists')).set(_lastSnapshot.setlistData);
      }

      // Remove songs that were added during the task
      var currentSongs = (typeof allSongs !== 'undefined') ? allSongs.map(function(s) { return s.songId; }) : [];
      var addedSongs = currentSongs.filter(function(id) { return _lastSnapshot.songsBeforeTask.indexOf(id) < 0; });

      for (var i = 0; i < addedSongs.length; i++) {
        try { await db.ref(bandPath('song_library/' + addedSongs[i])).remove(); } catch(e) {}
      }

      // Remove from allSongs in-memory
      if (typeof allSongs !== 'undefined' && addedSongs.length) {
        for (var j = allSongs.length - 1; j >= 0; j--) {
          if (addedSongs.indexOf(allSongs[j].songId) >= 0) allSongs.splice(j, 1);
        }
      }

      // Record undo
      _recordOutcome(_lastTask.intent, false, true);

      var count = addedSongs.length;
      _lastSnapshot = null;
      _lastTask = null;

      // Refresh UI
      if (typeof renderSongs === 'function') try { renderSongs(); } catch(e) {}

      return { success: true, message: 'Undone. Removed ' + count + ' songs and restored setlists.', undone: true };
    } catch(e) {
      return { success: false, message: 'Undo failed: ' + e.message };
    }
  }

  // ── Full Pipeline (with snapshot + learning) ────────────────────────────

  async function run(intent, input) {
    // 1. Plan with dynamic confidence
    var taskPlan = plan(intent, input);
    if (!taskPlan) return { success: false, message: 'Unknown task type.', plan: null };
    taskPlan.confidence = getDynamicConfidence(intent);

    // 2. Snapshot for undo
    await _snapshotBeforeTask(intent);

    // 3. Execute
    taskPlan = await execute(taskPlan);

    // 4. Verify
    await verify(taskPlan);

    // 5. Explain
    var explanation = explain(taskPlan);

    // 6. Record outcome for learning
    _recordOutcome(intent, taskPlan.status === 'complete', false);

    // 7. Store for undo
    _lastTask = taskPlan;

    // 8. Log to Firebase
    _logTask(taskPlan);

    // 9. Check if undo should be offered
    var offerUndo = taskPlan.status === 'complete' && (taskPlan.risk === 'medium' || taskPlan.risk === 'high');

    return {
      success: taskPlan.status === 'complete',
      partial: taskPlan.status === 'partial',
      message: explanation.summary,
      plan: taskPlan,
      explanation: explanation,
      canUndo: offerUndo
    };
  }

  // ── Logging ─────────────────────────────────────────────────────────────

  function _logTask(taskPlan) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    var bandId = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : '';
    if (!db || !bandId || !taskPlan) return;
    try {
      db.ref('avatar_tasks/' + bandId + '/' + taskPlan.id).set({
        id: taskPlan.id,
        intent: taskPlan.intent,
        label: taskPlan.label,
        status: taskPlan.status,
        confidence: taskPlan.confidence || 0,
        stepCount: taskPlan.steps.length,
        successCount: taskPlan.steps.filter(function(s) { return s.status === 'success'; }).length,
        verified: taskPlan.verified || false,
        createdAt: taskPlan.createdAt,
        completedAt: taskPlan.completedAt || null
      });
    } catch(e) {}
  }

  // ── Public API ─────────────────────────────────────────────────────────

  window.GLTaskEngine = {
    plan: plan,
    needsConfirmation: needsConfirmation,
    execute: execute,
    verify: verify,
    explain: explain,
    run: run,
    undoLastTask: undoLastTask,
    getDynamicConfidence: getDynamicConfidence,
    getTaskHistory: _loadHistory
  };

  console.log('\u2699\uFE0F GLTaskEngine loaded');
})();
