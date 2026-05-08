// ── Schedule Blocks ─────────────────────────────────────────────────────────
//
// Unified scheduling model that replaces the legacy blocked_dates list.
// Blocks have a status (unavailable / tentative / booked_elsewhere /
// vacation / travel / personal_block / hold), an owner, a date range,
// and Google-Calendar sync metadata. Hard vs soft conflict classification
// drives the calendar rich-eval and the rehearsal-scheduling engine.
//
// Persistence: Firebase Realtime DB at bandPath('schedule_blocks/{blockId}').
// Legacy blocked_dates are read from Drive via loadBandDataFromDrive and
// merged at read time (deduplicated by ownerKey+startDate+endDate).
//
// Cross-module reads (computeDateStrength):
//   - window.GLStore.BAND_ROLES         (gl-roles-coverage.js, P1.1 phase 17)
//   - window.GLStore.mapMemberToRoleIds (gl-roles-coverage.js, P1.1 phase 17)
//
// External callers:
//   - js/core/gl-calendar-sync.js      → getScheduleBlocks, saveScheduleBlock,
//                                        deleteScheduleBlock
//   - js/core/gl-rehearsal-scheduling.js → getScheduleBlocks, computeDateStrength
//   - js/features/calendar.js          → all public methods (largest consumer)
//
// LOAD ORDER: must come after groovelinx_store.js AND gl-roles-coverage.js.
// Globals firebaseDB, bandPath, bandMembers, loadBandDataFromDrive, toArray
// are looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 21) — ~245 lines.
// Lifts _scheduleBlocksCache into module-private state.

(function() {
  'use strict';

  // ── Local helpers ──

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }
  function _bp(path) {
    return (typeof bandPath === 'function') ? bandPath(path) : path;
  }

  // ── Module state ──

  var SCHEDULE_BLOCK_STATUSES = ['unavailable','tentative','booked_elsewhere','vacation','travel','personal_block','hold'];

  var _scheduleBlocksCache = null;

  function _sbGenId() {
    return 'sb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  // Read schedule_blocks from Firebase
  async function _sbLoadBlocks() {
    if (_scheduleBlocksCache) return _scheduleBlocksCache;
    var db = _db(); if (!db) return [];
    try {
      var snap = await db.ref(_bp('schedule_blocks')).once('value');
      var val = snap.val();
      _scheduleBlocksCache = val ? Object.values(val) : [];
      return _scheduleBlocksCache;
    } catch(e) { return []; }
  }

  // Read legacy blocked_dates from Drive and convert to schedule_block shape
  async function _sbLoadLegacyBlocked() {
    try {
      if (typeof loadBandDataFromDrive !== 'function') return [];
      var raw = (typeof toArray === 'function')
        ? toArray(await loadBandDataFromDrive('_band', 'blocked_dates') || [])
        : (await loadBandDataFromDrive('_band', 'blocked_dates') || []);
      return raw.map(function(b, i) {
        // Map person name to member key
        var ownerKey = null;
        if (typeof bandMembers !== 'undefined') {
          Object.entries(bandMembers).forEach(function(e) {
            if (e[1].name === b.person) ownerKey = e[0];
          });
        }
        return {
          blockId: '_legacy_' + i,
          ownerKey: ownerKey || null,
          ownerName: b.person || '',
          status: 'unavailable',
          startDate: b.startDate || '',
          endDate: b.endDate || '',
          allDay: true,
          summary: b.reason || '',
          visibility: 'band_full',
          sourceType: 'manual',
          _legacy: true
        };
      });
    } catch(e) { return []; }
  }

  // ── Public API ──

  // Get all schedule blocks (merged: new + legacy)
  async function getScheduleBlocks() {
    var blocks = await _sbLoadBlocks();
    var legacy = await _sbLoadLegacyBlocked();
    // Deduplicate: if a legacy block matches a migrated block (same owner+dates), skip it
    var migrated = {};
    blocks.forEach(function(b) { migrated[b.ownerKey + '|' + b.startDate + '|' + b.endDate] = true; });
    var filtered = legacy.filter(function(lb) {
      return !migrated[(lb.ownerKey || lb.ownerName) + '|' + lb.startDate + '|' + lb.endDate];
    });
    return blocks.concat(filtered);
  }

  // Get schedule blocks as blocked_dates-compatible format for availability matrix
  function getScheduleBlocksAsRanges() {
    return getScheduleBlocks().then(function(blocks) {
      return blocks.map(function(b) {
        return {
          person: b.ownerName || b.ownerKey || '',
          startDate: b.startDate,
          endDate: b.endDate,
          reason: b.summary || '',
          status: b.status || 'unavailable',
          _block: b
        };
      });
    });
  }

  // CRUD
  // syncOnly=true is used by the calendar-sync engine when writing back sync
  // metadata (googleEventId, lastSyncedAt, syncedToGoogle). In that case we
  // must NOT bump updatedAt or the dirty-detection (updatedAt > lastSyncedAt)
  // would flag the block as needing another push on every sync — infinite loop.
  async function saveScheduleBlock(block, syncOnly) {
    var db = _db(); if (!db) return;
    if (!block.blockId) block.blockId = _sbGenId();
    if (!syncOnly) {
      block.updatedAt = new Date().toISOString();
      if (!block.createdAt) block.createdAt = block.updatedAt;
    }
    await db.ref(_bp('schedule_blocks/' + block.blockId)).set(block);
    _scheduleBlocksCache = null;
    return block;
  }

  async function deleteScheduleBlock(blockId) {
    var db = _db(); if (!db) return;
    await db.ref(_bp('schedule_blocks/' + blockId)).remove();
    _scheduleBlocksCache = null;
  }

  // Get blocks for a specific member on a specific date
  function getBlocksForMemberOnDate(blocks, memberName, dateStr) {
    return blocks.filter(function(b) {
      var matchesPerson = b.ownerName === memberName || b.ownerKey === memberName;
      var inRange = b.startDate && b.endDate && dateStr >= b.startDate && dateStr <= b.endDate;
      return matchesPerson && inRange;
    });
  }

  // Status classification
  var HARD_CONFLICT_STATUSES = { unavailable: true, booked_elsewhere: true, vacation: true, personal_block: true };
  var SOFT_CONFLICT_STATUSES = { tentative: true, travel: true, hold: true };

  function isHardConflict(status) { return HARD_CONFLICT_STATUSES[status] || false; }
  function isSoftConflict(status) { return SOFT_CONFLICT_STATUSES[status] || false; }

  // Evaluate a single member's status for a given date
  function evaluateMemberDateStatus(blocks, memberName, dateStr) {
    var memberBlocks = getBlocksForMemberOnDate(blocks, memberName, dateStr);
    if (memberBlocks.length === 0) return { status: 'available', blocks: [] };
    var hasHard = memberBlocks.some(function(b) { return isHardConflict(b.status); });
    if (hasHard) return { status: 'hard_conflict', blocks: memberBlocks };
    return { status: 'soft_conflict', blocks: memberBlocks };
  }

  // Rich date strength evaluator — role-aware (Phase 4)
  function computeDateStrength(blocks, members, dateStr) {
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var total = members.length;
    var available = 0;
    var hardConflictCount = 0;
    var softConflictCount = 0;
    var reasons = [];
    var memberStatuses = {};

    // Track which roles are covered by available members
    var coveredRoles = {};    // { roleId: true }
    var missingRoles = {};    // { roleId: memberName }
    var softRoles = {};       // { roleId: memberName }
    var allRoleIds = {};

    // BAND_ROLES + mapMemberToRoleIds live in gl-roles-coverage.js (P1.1 phase 17)
    var _GL_RC = (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null;
    var _BAND_ROLES = (_GL_RC && _GL_RC.BAND_ROLES) ? _GL_RC.BAND_ROLES : [];
    var _mapRoles = (_GL_RC && _GL_RC.mapMemberToRoleIds) ? _GL_RC.mapMemberToRoleIds : function() { return []; };

    members.forEach(function(member) {
      var eval_ = evaluateMemberDateStatus(blocks, member, dateStr);
      memberStatuses[member] = eval_;

      // Resolve member key and roles
      var memberKey = null;
      Object.keys(bm).forEach(function(k) { if (bm[k].name === member) memberKey = k; });
      var memberData = memberKey ? bm[memberKey] : null;
      var roleIds = memberData ? _mapRoles(memberData.role) : [];
      if (memberData && memberData.leadVocals) roleIds.push('lead_vocal');
      if (memberData && memberData.harmonies) roleIds.push('harmony');
      roleIds.forEach(function(r) { allRoleIds[r] = true; });

      if (eval_.status === 'available') {
        available++;
        roleIds.forEach(function(r) { coveredRoles[r] = true; });
      } else if (eval_.status === 'hard_conflict') {
        hardConflictCount++;
        var topBlock = eval_.blocks[0];
        var statusLabel = { unavailable:'Unavailable', booked_elsewhere:'Booked elsewhere', vacation:'Vacation', personal_block:'Personal block' }[topBlock.status] || topBlock.status;
        reasons.push(member.split(' ')[0] + ': ' + statusLabel);
        roleIds.forEach(function(r) { if (!coveredRoles[r]) missingRoles[r] = member; });
      } else {
        softConflictCount++;
        var softBlock = eval_.blocks[0];
        var softLabel = { tentative:'Tentative', travel:'Travel', hold:'Hold' }[softBlock.status] || softBlock.status;
        reasons.push(member.split(' ')[0] + ': ' + softLabel);
        roleIds.forEach(function(r) { if (!coveredRoles[r]) softRoles[r] = member; });
      }
    });

    // Remove roles that ARE covered by available members from missing/soft
    Object.keys(coveredRoles).forEach(function(r) {
      delete missingRoles[r];
      delete softRoles[r];
    });

    // Identify critical missing roles
    var missingCritical = [];
    var missingNonCritical = [];
    Object.keys(missingRoles).forEach(function(rid) {
      var role = _BAND_ROLES.find(function(r) { return r.id === rid; });
      if (role && role.critical) missingCritical.push(role.label);
      else if (role) missingNonCritical.push(role.label);
    });

    var softCritical = [];
    Object.keys(softRoles).forEach(function(rid) {
      var role = _BAND_ROLES.find(function(r) { return r.id === rid; });
      if (role && role.critical) softCritical.push(role.label);
    });

    // Add role gap reasons
    if (missingCritical.length > 0) {
      reasons.push('Missing critical: ' + missingCritical.join(', '));
    }
    if (missingNonCritical.length > 0) {
      reasons.push('Missing: ' + missingNonCritical.join(', '));
    }
    if (softCritical.length > 0) {
      reasons.push('Uncertain critical: ' + softCritical.join(', '));
    }

    var conflictCount = hardConflictCount + softConflictCount;
    var score = Math.round(((available + softConflictCount * 0.5) / total) * 100);
    // Penalize score for missing critical roles
    if (missingCritical.length > 0) score = Math.max(0, score - missingCritical.length * 15);

    var label, color;
    if (hardConflictCount === 0 && softConflictCount === 0) {
      label = 'Strong'; color = '#22c55e';
      reasons = ['No conflicts — all roles covered'];
    } else if (missingCritical.length > 0) {
      // Critical role missing is always at least Risky, regardless of headcount
      if (available < Math.ceil(total / 2)) {
        label = 'Not viable'; color = '#64748b';
      } else {
        label = 'Risky'; color = '#ef4444';
      }
    } else if (hardConflictCount === 0 && softConflictCount > 0) {
      label = 'Workable'; color = '#84cc16';
      reasons.unshift(softConflictCount + ' soft conflict' + (softConflictCount > 1 ? 's' : '') + ' — may clear');
    } else if (hardConflictCount === 1 && available >= Math.ceil(total / 2) && missingCritical.length === 0) {
      label = 'Workable'; color = '#f59e0b';
    } else if (available >= Math.ceil(total / 2)) {
      label = 'Risky'; color = '#ef4444';
    } else {
      label = 'Not viable'; color = '#64748b';
    }

    return {
      label: label, color: color, score: score,
      available: available, hardConflictCount: hardConflictCount, softConflictCount: softConflictCount,
      conflictCount: conflictCount, total: total,
      reasons: reasons, memberStatuses: memberStatuses,
      missingCritical: missingCritical, missingNonCritical: missingNonCritical, softCritical: softCritical,
      coveredRoles: Object.keys(coveredRoles), missingRoles: Object.keys(missingRoles)
    };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.SCHEDULE_BLOCK_STATUSES   = SCHEDULE_BLOCK_STATUSES;
    GL._clearScheduleBlocksCache = function() { _scheduleBlocksCache = null; };
    GL.getScheduleBlocks         = getScheduleBlocks;
    GL.getScheduleBlocksAsRanges = getScheduleBlocksAsRanges;
    GL.saveScheduleBlock         = saveScheduleBlock;
    GL.deleteScheduleBlock       = deleteScheduleBlock;
    GL.getBlocksForMemberOnDate  = getBlocksForMemberOnDate;
    GL.evaluateMemberDateStatus  = evaluateMemberDateStatus;
    GL.computeDateStrength       = computeDateStrength;
    GL.isHardConflict            = isHardConflict;
    GL.isSoftConflict            = isSoftConflict;
  }
})();
