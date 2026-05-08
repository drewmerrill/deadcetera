// ── Band Roles + Backup Players + Gig Coverage Evaluator ────────────────────
//
// Cohesive role-coverage cluster that determines whether a gig is "covered"
// given member availability + active backup players:
//
//   1. BAND_ROLES — canonical role catalog (lead vocal, rhythm guitar, …)
//      with critical/non-critical flags.
//
//   2. COVERAGE_STRENGTHS — labels for backup confidence (confident / can_sub)
//      with legacy 'full'/'partial' migration in _normalizeStrength.
//
//   3. Backup Player CRUD — Firebase-backed list at bands/{slug}/backup_players.
//      In-memory cache (_backupPlayersCache) busts on every save/delete.
//
//   4. Gig Coverage Evaluator — for a given gig, walks band members + their
//      availability, identifies missing roles, then matches backups by
//      coverageRoles. Returns one of: full_core / covered_with_backup /
//      partial_risk / not_covered.
//
// External callers: js/features/gigs.js uses GLStore.evaluateGigCoverage and
// GLStore.BAND_ROLES.
//
// LOAD ORDER: must come after groovelinx_store.js. Globals firebaseDB,
// bandPath, bandMembers, BAND_MEMBERS_ORDERED looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 17) — ~170 lines.
// One closure-private cache (_backupPlayersCache) lifted into module scope.

(function() {
  'use strict';

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _bp(subpath) {
    return (typeof bandPath === 'function') ? bandPath(subpath) : subpath;
  }

  // ── Canonical role catalog ──

  var BAND_ROLES = [
    { id: 'lead_vocal',    label: 'Lead Vocal',     critical: true },
    { id: 'rhythm_guitar', label: 'Rhythm Guitar',  critical: true },
    { id: 'lead_guitar',   label: 'Lead Guitar',    critical: false },
    { id: 'bass',          label: 'Bass',            critical: true },
    { id: 'drums',         label: 'Drums',           critical: true },
    { id: 'keys',          label: 'Keys',             critical: false },
    { id: 'harmony',       label: 'Harmony Vocals', critical: false }
  ];

  var COVERAGE_STRENGTHS = {
    confident: { label: 'Confident', color: '#22c55e', description: 'Can perform reliably in a gig' },
    can_sub:   { label: 'Can Sub',   color: '#f59e0b', description: 'Can step in if needed but not primary strength' }
  };

  function _normalizeStrength(val) {
    if (val === 'full' || val === 'confident') return 'confident';
    if (val === 'partial' || val === 'can_sub') return 'can_sub';
    return 'confident';
  }

  function _mapMemberToRoleIds(memberRole) {
    if (!memberRole) return [];
    var r = memberRole.toLowerCase();
    var roles = [];
    if (r.indexOf('rhythm') > -1 && r.indexOf('guitar') > -1) roles.push('rhythm_guitar');
    else if (r.indexOf('lead') > -1 && r.indexOf('guitar') > -1) roles.push('lead_guitar');
    else if (r.indexOf('guitar') > -1) roles.push('rhythm_guitar');
    if (r.indexOf('bass') > -1) roles.push('bass');
    if (r.indexOf('drum') > -1 || r.indexOf('percussion') > -1) roles.push('drums');
    if (r.indexOf('key') > -1 || r.indexOf('piano') > -1 || r.indexOf('organ') > -1) roles.push('keys');
    if (r.indexOf('vocal') > -1 || r.indexOf('singer') > -1) roles.push('lead_vocal');
    return roles;
  }

  // ── Backup Player CRUD ──

  var _backupPlayersCache = null;

  async function getBackupPlayers() {
    if (_backupPlayersCache) return _backupPlayersCache;
    var db = _db(); if (!db) return [];
    try {
      var snap = await db.ref(_bp('backup_players')).once('value');
      var val = snap.val();
      _backupPlayersCache = val ? Object.values(val) : [];
      return _backupPlayersCache;
    } catch(e) { return []; }
  }

  function getActiveBackupPlayers() {
    return getBackupPlayers().then(function(all) {
      return all.filter(function(p) { return p.active !== false; });
    });
  }

  async function saveBackupPlayer(player) {
    var db = _db(); if (!db) return;
    if (!player.id) player.id = 'bp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
    player.updatedAt = new Date().toISOString();
    if (!player.createdAt) player.createdAt = player.updatedAt;
    await db.ref(_bp('backup_players/' + player.id)).set(player);
    _backupPlayersCache = null;
    return player;
  }

  async function deleteBackupPlayer(playerId) {
    var db = _db(); if (!db) return;
    await db.ref(_bp('backup_players/' + playerId)).remove();
    _backupPlayersCache = null;
  }

  // ── Gig Coverage Evaluator ──

  async function evaluateGigCoverage(gig) {
    if (!gig) return null;
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var avail = gig.availability || {};
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var backups = await getActiveBackupPlayers();

    var coveredRoles = {};
    var missingRoles = {};
    var allRoleIds = {};

    members.forEach(function(ref) {
      var mKey = (typeof ref === 'object') ? ref.key : ref;
      var member = bm[mKey];
      if (!member) return;
      var roleIds = _mapMemberToRoleIds(member.role);
      if (member.leadVocals) roleIds.push('lead_vocal');
      if (member.harmonies) roleIds.push('harmony');
      roleIds.forEach(function(rid) { allRoleIds[rid] = true; });

      var a = avail[mKey];
      var status = a ? a.status : null;
      if (status === 'yes') {
        roleIds.forEach(function(rid) { coveredRoles[rid] = true; });
      }
    });

    Object.keys(allRoleIds).forEach(function(rid) {
      if (!coveredRoles[rid]) missingRoles[rid] = true;
    });

    var backupCoverage = {};
    var missingRoleIds = Object.keys(missingRoles);
    missingRoleIds.forEach(function(rid) {
      for (var i = 0; i < backups.length; i++) {
        var bp = backups[i];
        if (!bp.coverageRoles) continue;
        var match = bp.coverageRoles.find(function(cr) { return cr.roleId === rid; });
        if (match) {
          var alreadyUsed = Object.values(backupCoverage).some(function(bc) { return bc.playerId === bp.id; });
          if (!alreadyUsed) {
            backupCoverage[rid] = { playerId: bp.id, playerName: bp.name, strength: match.strength || 'full', notes: match.notes || '' };
            break;
          }
        }
      }
    });

    var criticalMissing = missingRoleIds.filter(function(rid) {
      var role = BAND_ROLES.find(function(r) { return r.id === rid; });
      return role && role.critical;
    });
    var criticalUncovered = criticalMissing.filter(function(rid) { return !backupCoverage[rid]; });
    var partialBackups = Object.values(backupCoverage).filter(function(bc) { var s = _normalizeStrength(bc.strength); return s === 'can_sub'; });

    var status = 'full_core';
    if (missingRoleIds.length === 0) status = 'full_core';
    else if (criticalUncovered.length > 0) status = 'not_covered';
    else if (partialBackups.length > 0) status = 'partial_risk';
    else if (missingRoleIds.length > 0 && Object.keys(backupCoverage).length >= missingRoleIds.length) status = 'covered_with_backup';
    else status = 'partial_risk';

    return {
      status: status,
      coveredRoles: coveredRoles,
      missingRoles: missingRoleIds,
      backupCoverage: backupCoverage,
      criticalMissing: criticalMissing,
      criticalUncovered: criticalUncovered,
      allRoleIds: Object.keys(allRoleIds)
    };
  }

  function getBackupOptionsForRole(roleId) {
    return getActiveBackupPlayers().then(function(backups) {
      return backups.filter(function(bp) {
        return bp.coverageRoles && bp.coverageRoles.some(function(cr) { return cr.roleId === roleId; });
      });
    });
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.BAND_ROLES                = BAND_ROLES;
    GL.COVERAGE_STRENGTHS        = COVERAGE_STRENGTHS;
    GL.normalizeStrength         = _normalizeStrength;
    GL.mapMemberToRoleIds        = _mapMemberToRoleIds;
    GL.getBackupPlayers          = getBackupPlayers;
    GL.getActiveBackupPlayers    = getActiveBackupPlayers;
    GL.saveBackupPlayer          = saveBackupPlayer;
    GL.deleteBackupPlayer        = deleteBackupPlayer;
    GL.evaluateGigCoverage       = evaluateGigCoverage;
    GL.getBackupOptionsForRole   = getBackupOptionsForRole;
  }
})();
