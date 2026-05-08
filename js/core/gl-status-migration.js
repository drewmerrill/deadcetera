// ── Legacy Status Audit + Migration ─────────────────────────────────────────
//
// Console-driven debug helpers to audit and normalize legacy song-status
// values stored in the master file. Valid lifecycle statuses:
//   '', 'prospect', 'active', 'parked', 'retired'
// Legacy values still accepted: 'wip' (→ active), 'gig_ready' (→ active)
//
// Usage from the browser console:
//   GLStore.auditLegacyStatuses()                         // dry-run report
//   GLStore.migrateLegacyStatuses({ dryRun: false })      // normalize + save
//
// Persistence: writes back to master file (saveMasterFile global) and
// per-song Firebase records (saveBandDataToDrive global).
//
// LOAD ORDER: must come after groovelinx_store.js. Reads
// GLStore.getAllStatus() at call time. Globals saveMasterFile and
// saveBandDataToDrive are looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 23) — ~130 lines.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _allStatus() {
    var GL = _gl();
    return (GL && GL.getAllStatus) ? GL.getAllStatus() : {};
  }

  // ── Status mapping tables ──

  var _VALID_STATUSES = { '': true, 'prospect': true, 'learning': true, 'rotation': true, 'shelved': true, 'wip': true, 'gig_ready': true, 'active': true, 'parked': true, 'retired': true };

  var _STATUS_MIGRATION_MAP = {
    'needs_polish':      'learning',
    'needspolish':       'learning',
    'needs polish':      'learning',
    'work in progress':  'learning',
    'work_in_progress':  'learning',
    'wip':               'learning',
    'active':            'learning',
    'on_deck':           'prospect',
    'ondeck':            'prospect',
    'on deck':           'prospect',
    'gig ready':         'learning',
    'gig-ready':         'learning',
    'gigready':          'learning',
    'gig_ready':         'learning',
    'ready':             'learning',
    'parked':            'shelved',
    'retired':           'shelved',
    'not on radar':      '',
    'not_on_radar':      '',
    'none':              '',
    'null':              '',
    'undefined':         '',
  };

  // ── Public API ──

  function auditLegacyStatuses() {
    var sc = _allStatus();
    var entries = Object.entries(sc);
    var legacy = [];
    var valid = [];
    var empty = 0;

    for (var i = 0; i < entries.length; i++) {
      var title = entries[i][0];
      var raw = entries[i][1];
      if (!raw || raw === '') { empty++; continue; }
      var val = (typeof raw === 'string') ? raw : (raw && raw.status) ? raw.status : '';
      if (_VALID_STATUSES[val]) {
        valid.push({ title: title, status: val });
      } else {
        var normalized = val.toLowerCase().replace(/\s+/g, ' ').trim();
        var mapped = _STATUS_MIGRATION_MAP[normalized] || null;
        legacy.push({ title: title, current: val, normalized: normalized, wouldMapTo: mapped || '(UNKNOWN — needs manual review)' });
      }
    }

    console.log('%c=== Legacy Status Audit ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Total songs with status:', entries.length);
    console.log('Valid statuses:', valid.length);
    console.log('Empty/unset:', empty);
    console.log('Legacy values found:', legacy.length);

    if (legacy.length) {
      console.log('%cLegacy songs:', 'font-weight:bold;color:#f59e0b');
      console.table(legacy);
    } else {
      console.log('%cNo legacy statuses found — all clean!', 'color:#22c55e;font-weight:bold');
    }

    return { total: entries.length, valid: valid.length, empty: empty, legacy: legacy };
  }

  function migrateLegacyStatuses(opts) {
    var dryRun = !opts || opts.dryRun !== false;
    var audit = auditLegacyStatuses();

    if (!audit.legacy.length) {
      console.log('Nothing to migrate.');
      return { migrated: 0, skipped: 0 };
    }

    var migrated = 0;
    var skipped = 0;
    var sc = _allStatus();

    for (var i = 0; i < audit.legacy.length; i++) {
      var item = audit.legacy[i];
      if (item.wouldMapTo.indexOf('UNKNOWN') >= 0) {
        console.warn('SKIPPING (unknown mapping):', item.title, '→', item.current);
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log('[DRY RUN] Would migrate:', item.title, '"' + item.current + '" → "' + item.wouldMapTo + '"');
      } else {
        sc[item.title] = item.wouldMapTo;
        migrated++;
      }
    }

    if (!dryRun && migrated > 0) {
      // Persist to master file
      if (typeof saveMasterFile === 'function') {
        saveMasterFile('_master_song_statuses.json', sc).then(function() {
          console.log('%cMigration saved to master file!', 'color:#22c55e;font-weight:bold');
        }).catch(function(e) {
          console.error('Failed to save master file:', e);
        });
      }
      // Also write migrated statuses to per-song Firebase records so
      // song-detail.js (which reads per-song) stays in sync with master file
      if (typeof saveBandDataToDrive === 'function') {
        for (var w = 0; w < audit.legacy.length; w++) {
          var _mItem = audit.legacy[w];
          if (_mItem.wouldMapTo.indexOf('UNKNOWN') >= 0) continue;
          try {
            saveBandDataToDrive(_mItem.title, 'song_status', { status: _mItem.wouldMapTo, updatedAt: new Date().toISOString(), migratedFrom: _mItem.current });
          } catch(e2) {}
        }
        console.log('%cPer-song Firebase records synced.', 'color:#22c55e');
      }
      console.log('%cMigrated ' + migrated + ' songs. Skipped ' + skipped + '.', 'font-weight:bold;color:#22c55e');
    } else if (dryRun) {
      console.log('%c[DRY RUN] Would migrate ' + (audit.legacy.length - skipped) + ' songs. Run GLStore.migrateLegacyStatuses({ dryRun: false }) to apply.', 'font-weight:bold;color:#f59e0b');
    }

    return { migrated: migrated, skipped: skipped };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.auditLegacyStatuses   = auditLegacyStatuses;
    GL.migrateLegacyStatuses = migrateLegacyStatuses;
  }
})();
