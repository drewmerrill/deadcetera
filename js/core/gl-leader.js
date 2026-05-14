// ── Band Sync (V1) — leader-driven live rehearsal sync ───────────────────────
//
// Leader broadcasts current song; followers auto-navigate to match.
// Firebase: bands/{slug}/rehearsal_sync/{sessionId}
//   _active_session pointer + _active_code/{code} index for join-by-code.
//
// LOAD ORDER: must come after groovelinx_store.js (uses GLStore.emit and
// global firebaseDB / bandPath / bandMembers / getCurrentMemberKey).
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 7) — was 5
// closure-private vars deeply bound into _state.sync* sub-keys. Lifted those
// 5 sub-keys into a private cluster object owned by this module (none of
// the other store slices read _state.sync*, confirmed in the closure-coupling
// audit). Module owns its own beforeunload listener so the store's _glCleanup
// no longer calls _syncCleanup.

(function() {
  'use strict';

  var SYNC_HEARTBEAT_INTERVAL = 12000;  // leader pings every 12s
  var SYNC_STALE_THRESHOLD = 40000;     // follower considers leader stale after 40s

  // Private state cluster — was previously spread across _state.sync* sub-keys
  var _sync = {
    session:            null,   // full session object from Firebase
    role:               null,   // 'leader' | 'follower' | null
    following:          false,  // follower: auto-navigating with leader?
    heartbeat:          null,   // setInterval id for leader heartbeat
    listener:           null,   // Firebase .on() unsubscribe fn
    staleCheckInterval: null
  };

  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _emit(eventName, payload) {
    if (typeof window !== 'undefined' && window.GLStore && window.GLStore.emit) {
      window.GLStore.emit(eventName, payload);
    }
  }

  function _syncGenCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    var code = '';
    for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
  }

  function _syncGenId() { return 'sync_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

  function _syncRef(path) {
    var db = _db();
    if (!db) return null;
    if (typeof bandPath !== 'function') return null;
    return db.ref(bandPath('rehearsal_sync/' + path));
  }

  // ── Leader: start sync session ──────────────────────────────────────────

  async function startBandSync(songId, songTitle) {
    var db = _db(); if (!db) return null;
    if (typeof bandPath !== 'function') return null;
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return null;
    var memberName = '';
    if (typeof bandMembers !== 'undefined' && bandMembers[memberKey]) memberName = bandMembers[memberKey].name || memberKey;

    // End any existing active session first
    await _syncEndActiveSession();

    var sessionId = _syncGenId();
    var joinCode = _syncGenCode();
    var now = new Date().toISOString();
    var session = {
      sessionId: sessionId,
      leaderKey: memberKey,
      leaderName: memberName || memberKey,
      status: 'active',
      syncMode: 'song',
      songId: songId || null,
      songTitle: songTitle || '',
      sectionId: null,
      joinCode: joinCode,
      startedAt: now,
      updatedAt: now,
      leaderHeartbeatAt: now,
      followers: {}
    };

    // Write session + active pointer + join code index
    await db.ref(bandPath('rehearsal_sync/' + sessionId)).set(session);
    await db.ref(bandPath('rehearsal_sync/_active_session')).set({
      sessionId: sessionId, joinCode: joinCode, status: 'active', updatedAt: now
    });
    await db.ref(bandPath('rehearsal_sync/_active_code/' + joinCode)).set(sessionId);

    // Update local state
    _sync.session = session;
    _sync.role = 'leader';
    _sync.following = false;

    // Start heartbeat
    _syncStartHeartbeat(sessionId);

    // Attach listener so leader sees follower changes
    _syncAttachListener(sessionId);

    _emit('syncStateChanged', { session: session, role: 'leader' });
    return { sessionId: sessionId, joinCode: joinCode };
  }

  // ── Leader: broadcast song change ───────────────────────────────────────

  function syncBroadcastSong(songId, songTitle) {
    if (_sync.role !== 'leader' || !_sync.session) return;
    var ref = _syncRef(_sync.session.sessionId);
    if (!ref) return;
    var now = new Date().toISOString();
    ref.update({ songId: songId, songTitle: songTitle || '', updatedAt: now });
    _sync.session.songId = songId;
    _sync.session.songTitle = songTitle || '';
    _sync.session.updatedAt = now;
  }

  // ── Leader: end sync session ────────────────────────────────────────────

  async function endBandSync() {
    if (_sync.role === 'leader' && _sync.session) {
      var ref = _syncRef(_sync.session.sessionId);
      if (ref) await ref.update({ status: 'ended', updatedAt: new Date().toISOString() });
      var codeRef = _syncRef('_active_code/' + _sync.session.joinCode);
      if (codeRef) codeRef.remove();
      var activeRef = _syncRef('_active_session');
      if (activeRef) activeRef.remove();
    }
    _syncCleanup();
    _emit('syncStateChanged', { session: null, role: null });
  }

  // ── Leader: heartbeat ───────────────────────────────────────────────────

  function _syncStartHeartbeat(sessionId) {
    _syncStopHeartbeat();
    _sync.heartbeat = setInterval(function() {
      var ref = _syncRef(sessionId);
      if (ref && _sync.role === 'leader') {
        ref.update({ leaderHeartbeatAt: new Date().toISOString() });
      }
    }, SYNC_HEARTBEAT_INTERVAL);
  }

  function _syncStopHeartbeat() {
    if (_sync.heartbeat) { clearInterval(_sync.heartbeat); _sync.heartbeat = null; }
  }

  // ── Follower: join via code ─────────────────────────────────────────────

  async function joinBandSync(joinCode) {
    var db = _db(); if (!db) return null;
    if (typeof bandPath !== 'function') return null;
    joinCode = (joinCode || '').toUpperCase().trim();
    if (!joinCode) return null;

    // Look up session ID from join code
    var codeSnap = await db.ref(bandPath('rehearsal_sync/_active_code/' + joinCode)).once('value');
    var sessionId = codeSnap.val();
    if (!sessionId) return null; // invalid code

    // Read session
    var sessionSnap = await db.ref(bandPath('rehearsal_sync/' + sessionId)).once('value');
    var session = sessionSnap.val();
    if (!session || session.status !== 'active') return null; // ended or missing

    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown';
    var memberName = '';
    if (typeof bandMembers !== 'undefined' && bandMembers[memberKey]) memberName = bandMembers[memberKey].name || memberKey;

    // Register as follower
    await db.ref(bandPath('rehearsal_sync/' + sessionId + '/followers/' + memberKey)).set({
      name: memberName || memberKey,
      following: true,
      connectedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString()
    });

    _sync.session = session;
    _sync.role = 'follower';
    _sync.following = true;

    // Attach real-time listener
    _syncAttachListener(sessionId);

    // Start stale-leader check
    _syncStartStaleCheck();

    _emit('syncStateChanged', { session: session, role: 'follower' });
    return session;
  }

  // ── Follower: leave session ─────────────────────────────────────────────

  async function leaveBandSync() {
    if (_sync.role === 'follower' && _sync.session) {
      var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
      if (memberKey) {
        var ref = _syncRef(_sync.session.sessionId + '/followers/' + memberKey);
        if (ref) ref.remove();
      }
    }
    _syncCleanup();
    _emit('syncStateChanged', { session: null, role: null });
  }

  // ── Follower: pause / rejoin ────────────────────────────────────────────

  function pauseFollow() {
    _sync.following = false;
    _syncUpdateFollowerState(false);
    _emit('syncStateChanged', { session: _sync.session, role: 'follower' });
  }

  function rejoinFollow() {
    _sync.following = true;
    _syncUpdateFollowerState(true);
    _emit('syncStateChanged', { session: _sync.session, role: 'follower' });
    // Jump to current leader song
    if (_sync.session && _sync.session.songTitle) {
      _emit('syncSongChanged', { songId: _sync.session.songId, songTitle: _sync.session.songTitle });
    }
  }

  function _syncUpdateFollowerState(following) {
    if (!_sync.session || _sync.role !== 'follower') return;
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return;
    var ref = _syncRef(_sync.session.sessionId + '/followers/' + memberKey);
    if (ref) ref.update({ following: following, lastSeenAt: new Date().toISOString() });
  }

  // ── Firebase real-time listener ─────────────────────────────────────────

  function _syncAttachListener(sessionId) {
    _syncDetachListener();
    var db = _db(); if (!db) return;
    if (typeof bandPath !== 'function') return;
    var ref = db.ref(bandPath('rehearsal_sync/' + sessionId));
    var prevSongId = _sync.session ? _sync.session.songId : null;

    // errorCallback (Stab #11 Q.2): without this, Firebase silently swallows
    // permission_denied / auth-failure / connection-cancel on the rehearsal_sync
    // listener — followers think they're synced when they aren't. Throttle to
    // one log per 30s so a flapping permission error can't spam the console.
    var _syncListenerLastErrAt = 0;
    var onValue = ref.on('value', function(snap) {
      var data = snap.val();
      if (!data) return;
      _sync.session = data;

      // Detect session ended
      if (data.status === 'ended') {
        _syncCleanup();
        _emit('syncStateChanged', { session: null, role: null, reason: 'ended' });
        return;
      }

      // Follower: detect song change
      if (_sync.role === 'follower' && data.songId && data.songId !== prevSongId) {
        prevSongId = data.songId;
        if (_sync.following) {
          _emit('syncSongChanged', { songId: data.songId, songTitle: data.songTitle });
        }
      }

      // Emit general state change (UI re-renders)
      _emit('syncStateChanged', { session: data, role: _sync.role });
    }, function(err) {
      var now = Date.now();
      if (now - _syncListenerLastErrAt < 30000) return;
      _syncListenerLastErrAt = now;
      console.warn('[gl-leader] rehearsal_sync listener error', (err && err.code) || '', (err && err.message) || err);
      _emit('syncStateChanged', { session: _sync.session, role: _sync.role, error: (err && (err.code || err.message)) || 'unknown' });
    });

    _sync.listener = function() { ref.off('value', onValue); };
  }

  function _syncDetachListener() {
    if (_sync.listener) { _sync.listener(); _sync.listener = null; }
  }

  // ── Follower: stale leader detection ────────────────────────────────────

  function _syncStartStaleCheck() {
    _syncStopStaleCheck();
    _sync.staleCheckInterval = setInterval(function() {
      if (_sync.role !== 'follower' || !_sync.session) return;
      var hb = _sync.session.leaderHeartbeatAt;
      if (!hb) return;
      var age = Date.now() - new Date(hb).getTime();
      var wasStale = _sync.session._leaderStale;
      _sync.session._leaderStale = age > SYNC_STALE_THRESHOLD;
      if (_sync.session._leaderStale !== wasStale) {
        _emit('syncStateChanged', { session: _sync.session, role: 'follower' });
      }
    }, 10000);
  }

  function _syncStopStaleCheck() {
    if (_sync.staleCheckInterval) { clearInterval(_sync.staleCheckInterval); _sync.staleCheckInterval = null; }
  }

  // ── Cleanup (shared) ───────────────────────────────────────────────────

  function _syncCleanup() {
    _syncDetachListener();
    _syncStopHeartbeat();
    _syncStopStaleCheck();
    _sync.session = null;
    _sync.role = null;
    _sync.following = false;
  }

  // ── End any existing active session (called before starting new one) ───

  async function _syncEndActiveSession() {
    var db = _db(); if (!db) return;
    if (typeof bandPath !== 'function') return;
    try {
      var activeSnap = await db.ref(bandPath('rehearsal_sync/_active_session')).once('value');
      var active = activeSnap.val();
      if (active && active.sessionId && active.status === 'active') {
        await db.ref(bandPath('rehearsal_sync/' + active.sessionId)).update({ status: 'ended', updatedAt: new Date().toISOString() });
        if (active.joinCode) db.ref(bandPath('rehearsal_sync/_active_code/' + active.joinCode)).remove();
        db.ref(bandPath('rehearsal_sync/_active_session')).remove();
      }
    } catch(e) {}
  }

  // ── Public getters ─────────────────────────────────────────────────────

  function getSyncSession() { return _sync.session; }
  function isSyncLeader() { return _sync.role === 'leader'; }
  function isSyncFollower() { return _sync.role === 'follower'; }
  function isSyncFollowing() { return _sync.role === 'follower' && _sync.following; }
  function getSyncFollowerCount() {
    if (!_sync.session || !_sync.session.followers) return 0;
    return Object.values(_sync.session.followers).filter(function(f) { return f.following; }).length;
  }
  function getSyncJoinCode() { return _sync.session ? _sync.session.joinCode : null; }

  // ── Wire to GLStore ──────────────────────────────────────────────────────

  if (typeof window !== 'undefined') {
    // Self-cleanup on page unload — module owns its own timer lifecycle now.
    window.addEventListener('beforeunload', _syncCleanup);

    if (window.GLStore) {
      var GL = window.GLStore;
      GL.startBandSync         = startBandSync;
      GL.endBandSync           = endBandSync;
      GL.syncBroadcastSong     = syncBroadcastSong;
      GL.joinBandSync          = joinBandSync;
      GL.leaveBandSync         = leaveBandSync;
      GL.pauseFollow           = pauseFollow;
      GL.rejoinFollow          = rejoinFollow;
      GL.getSyncSession        = getSyncSession;
      GL.isSyncLeader          = isSyncLeader;
      GL.isSyncFollower        = isSyncFollower;
      GL.isSyncFollowing       = isSyncFollowing;
      GL.getSyncFollowerCount  = getSyncFollowerCount;
      GL.getSyncJoinCode       = getSyncJoinCode;
    }
  }
})();
