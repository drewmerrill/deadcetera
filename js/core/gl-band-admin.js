// ── Band Admin: Invitations + Song Voting + Library Health Audit ─────────────
//
// Three small admin/audit concerns grouped into one module:
//
//   1. Band Invitations — create/list/revoke invite records under
//      bands/{slug}/invites/{inviteId}. Plus join-link builder + the simple
//      getBandMembers shape adapter (used by notifications + analysis-pipeline).
//
//   2. Song Prospect Voting — per-member yes/maybe/no votes under
//      songs_v2/{songId}/song_votes. Feeds Song Intelligence priority scoring.
//
//   3. Song Library Health — read-only audits (auditSongTitles for collisions,
//      auditMigrationStatus for v2 progress). Console-output-style debug surfaces.
//
// LOAD ORDER: must come after groovelinx_store.js (uses GLStore.emit and
// GLStore.getSongs). Globals firebaseDB / bandPath / sanitizeFirebasePath /
// generateShortId / currentUserEmail / currentBandSlug / bandMembers are
// looked up via typeof at call time.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 12) — three small
// sections totaling ~190 lines. Zero closure-private state.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }
  function _emit(eventName, payload) {
    var GL = _gl();
    if (GL && GL.emit) GL.emit(eventName, payload);
  }

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _bp(subpath) {
    return (typeof bandPath === 'function') ? bandPath(subpath) : subpath;
  }

  function _now() { return new Date().toISOString(); }

  function _v2Path(songId, dataType) {
    return (typeof bandPath === 'function') ? bandPath('songs_v2/' + songId + '/' + dataType) : null;
  }

  // ── Band Invitations ────────────────────────────────────────────────────
  //
  // Firebase: bands/{slug}/invites/{inviteId}
  // Shape: { inviteId, name, email, role, status, createdBy, createdAt, acceptedAt }
  // Status: 'pending' | 'accepted' | 'revoked'

  async function getBandInvites() {
    var db = _db();
    if (!db || typeof bandPath !== 'function') return [];
    try {
      var snap = await db.ref(bandPath('invites')).once('value');
      var val = snap.val();
      if (!val) return [];
      return Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
    } catch(e) { return []; }
  }

  async function createBandInvite(data) {
    var db = _db();
    if (!db || typeof bandPath !== 'function') return null;
    var inviteId = (typeof generateShortId === 'function') ? generateShortId(10) : Date.now().toString(36);
    var invite = {
      inviteId: inviteId,
      name: (data.name || '').trim(),
      email: (data.email || '').trim(),
      role: data.role || 'member',
      status: 'pending',
      createdBy: (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'unknown',
      createdAt: _now()
    };
    await db.ref(bandPath('invites/' + inviteId)).set(invite);
    _emit('inviteCreated', { invite: invite });
    return invite;
  }

  async function revokeBandInvite(inviteId) {
    var db = _db();
    if (!db || typeof bandPath !== 'function') return;
    await db.ref(bandPath('invites/' + inviteId + '/status')).set('revoked');
    _emit('inviteRevoked', { inviteId: inviteId });
  }

  function getBandInviteLink() {
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var base = window.location.origin + window.location.pathname;
    return base + '?join=' + encodeURIComponent(slug);
  }

  function getBandMembers() {
    if (typeof bandMembers !== 'undefined') {
      return Object.entries(bandMembers).map(function(e) {
        return { key: e[0], name: e[1].name || e[0], role: e[1].role || '', status: 'active' };
      });
    }
    return [];
  }

  // ── Song Prospect Voting ────────────────────────────────────────────────
  //
  // Firebase: songs_v2/{songId}/song_votes
  // Shape: { [memberKey]: 'yes'|'maybe'|'no', _updatedAt: ISO }

  async function voteSongProspect(songId, memberKey, vote) {
    if (!songId || !memberKey || !vote) return;
    var db = _db();
    var path = _v2Path(songId, 'song_votes');
    if (!db || !path) return;
    var update = {};
    update[memberKey] = vote;
    update['_updatedAt'] = _now();
    await db.ref(path).update(update);
    _emit('songVoteChanged', { songId: songId, memberKey: memberKey, vote: vote });
  }

  async function getSongVotes(songId) {
    if (!songId) return null;
    var db = _db();
    var path = _v2Path(songId, 'song_votes');
    if (!db || !path) return null;
    try {
      var snap = await db.ref(path).once('value');
      return snap.val() || null;
    } catch(e) { return null; }
  }

  // ── Song library health ─────────────────────────────────────────────────

  // Snapshot of v2-tracked field types — kept in sync with the store's
  // _V2_ENABLED_TYPES constant. Drift here only affects the audit's
  // "v2 fields tracked" report; not load-bearing.
  var _V2_AUDIT_FIELDS = [
    'song_bpm', 'key',
    'lead_singer', 'song_status',
    'chart', 'chart_band', 'chart_master', 'chart_url',
    'personal_tabs', 'rehearsal_notes',
    'spotify_versions', 'practice_tracks', 'cover_me',
    'song_votes', 'song_structure',
    'readiness', 'readiness_history'
  ];

  function auditSongTitles() {
    var GL = _gl();
    var songs = (GL && GL.getSongs) ? GL.getSongs() : [];
    var seen = {};
    var duplicates = [];
    songs.forEach(function(s) {
      var key = s.title.toLowerCase();
      if (!seen[key]) { seen[key] = []; }
      seen[key].push(s);
    });
    Object.keys(seen).forEach(function(key) {
      if (seen[key].length > 1) {
        duplicates.push({
          title: seen[key][0].title,
          entries: seen[key].map(function(s) { return s.band; }),
          count: seen[key].length,
          risk: 'Firebase data collision — all entries share storage path'
        });
      }
    });
    if (duplicates.length) {
      console.warn('[GLStore] Song title collisions found:', duplicates.length);
      console.table(duplicates.map(function(d) {
        return { Title: d.title, Bands: d.entries.join(', '), Count: d.count, Risk: d.risk };
      }));
    } else {
      console.log('[GLStore] Song library clean — no title collisions.');
    }
    return { duplicates: duplicates, clean: duplicates.length === 0 };
  }

  async function auditMigrationStatus() {
    var GL = _gl();
    var songs = (GL && GL.getSongs) ? GL.getSongs() : [];
    var db = _db();
    if (!db || !songs.length) { console.warn('[GLStore] Cannot audit — no DB or songs'); return null; }

    var v2Fields = _V2_AUDIT_FIELDS.slice();
    var totalSongs = songs.filter(function(s) { return s.songId; }).length;
    var withV2 = 0;
    var fullyMigrated = 0;
    var pendingMigration = 0;

    var snap = await db.ref((typeof bandPath === 'function') ? bandPath('songs_v2') : 'songs_v2').once('value');
    var v2Data = snap.val() || {};
    var v2SongIds = Object.keys(v2Data);

    songs.forEach(function(s) {
      if (!s.songId) return;
      if (v2Data[s.songId]) {
        withV2++;
        var v2Node = v2Data[s.songId];
        var hasAll = v2Fields.every(function(f) { return v2Node[f] !== undefined; });
        if (hasAll) fullyMigrated++;
        else pendingMigration++;
      } else {
        pendingMigration++;
      }
    });

    var result = {
      totalSongs: totalSongs,
      withV2Data: withV2,
      fullyMigrated: fullyMigrated,
      pendingMigration: pendingMigration,
      v2Fields: v2Fields,
      v2SongNodes: v2SongIds.length
    };

    console.log('%c=== songs_v2 Migration Status ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Total songs with songId:', totalSongs);
    console.log('Songs with any v2 data:', withV2);
    console.log('Fully migrated (all ' + v2Fields.length + ' fields):', fullyMigrated);
    console.log('Pending migration:', pendingMigration);
    console.log('v2 fields tracked:', v2Fields.join(', '));
    return result;
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.getBandInvites      = getBandInvites;
    GL.createBandInvite    = createBandInvite;
    GL.revokeBandInvite    = revokeBandInvite;
    GL.getBandInviteLink   = getBandInviteLink;
    GL.getBandMembers      = getBandMembers;
    GL.voteSongProspect    = voteSongProspect;
    GL.getSongVotes        = getSongVotes;
    GL.auditSongTitles     = auditSongTitles;
    GL.auditMigrationStatus = auditMigrationStatus;
  }
})();
