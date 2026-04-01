// ============================================================================
// js/core/firebase-service.js
// Firebase initialization, auth state, band path routing, and CRUD helpers.
// Extracted from app.js Wave 1 refactor.
//
// DEPENDS ON (must load before this file):
//   js/core/utils.js   — sanitizeFirebasePath, toArray, showToast
//
// EXPOSES globals (window.*):
//   firebaseDB, firebaseStorage
//   currentBandSlug, bandPath()
//   isUserSignedIn, currentUserEmail, currentUserName, currentUserPicture
//   accessToken, tokenClient, isGoogleDriveInitialized
//   initFirebaseOnly(), loadGoogleDriveAPI(), handleGoogleDriveAuth()
//   saveBandDataToDrive(), loadBandDataFromDrive()
//   saveMasterFile(), loadMasterFile(), loadFromLocalStorageFallback()
//   songPath(), masterPath()
//   migrateToMultiBand()
// ============================================================================

'use strict';

// ── Firebase config ──────────────────────────────────────────────────────────
// NOTE: This is a client-side config for a public Firebase project.
// Security is enforced by Firebase Realtime Database Rules, not by hiding this key.
var FIREBASE_CONFIG = {
    apiKey: "AIzaSyC3sMU2S8XT9AhA4w5vTwtPP1Nx5kOHOJo",
    authDomain: "deadcetera-35424.firebaseapp.com",
    databaseURL: "https://deadcetera-35424-default-rtdb.firebaseio.com",
    projectId: "deadcetera-35424",
    storageBucket: "deadcetera-35424.firebasestorage.app",
    messagingSenderId: "218400123401",
    appId: "1:218400123401:web:7f64ad84231dcaba6966d8"
};

var GOOGLE_DRIVE_CONFIG = {
    apiKey: 'AIzaSyC3sMU2S8XT9AhA4w5vTwtPP1Nx5kOHOJo',
    clientId: '177899334738-6rcrst4nccsdol4g5t12923ne4duruub.apps.googleusercontent.com',
    scope: 'email profile'
};

// ── Runtime state ────────────────────────────────────────────────────────────
// All declared as `var` (not `let/const`) to prevent duplicate-declaration
// errors if app.js still has any references that were not yet stubbed out.

var firebaseDB = null;
var firebaseStorage = null;

var isGoogleDriveInitialized = false;
var isUserSignedIn = false;
var accessToken = null;
var tokenClient = null;

var currentUserEmail    = localStorage.getItem('deadcetera_google_email')   || null;
var currentUserName     = localStorage.getItem('deadcetera_google_name')    || '';
var currentUserPicture  = localStorage.getItem('deadcetera_google_picture') || '';

// ── Multi-band routing ───────────────────────────────────────────────────────

var currentBandSlug = localStorage.getItem('deadcetera_current_band') || 'deadcetera';

// Safety: auto-restore production if test slug present but ?dev=true is not
if (currentBandSlug === 'deadcetera-test' && !new URLSearchParams(window.location.search).get('dev')) {
    currentBandSlug = 'deadcetera';
    localStorage.setItem('deadcetera_current_band', 'deadcetera');
    localStorage.removeItem('deadcetera_current_user');
}
// ALWAYS clear test identity if present (even if band slug was already restored)
if (!new URLSearchParams(window.location.search).get('dev')) {
    if (localStorage.getItem('deadcetera_google_email') === 'test@groovelinx.com') {
        localStorage.removeItem('deadcetera_google_email');
        localStorage.removeItem('deadcetera_google_name');
        localStorage.removeItem('deadcetera_google_picture');
        currentUserEmail = null;
        currentUserName = '';
        currentUserPicture = '';
        console.log('\uD83D\uDD12 Cleared test user identity');
    }
    localStorage.removeItem('gl_dev_user');
    localStorage.removeItem('gl_dev_band');
}

/**
 * Prefix any Firebase subpath with the current band's root.
 * e.g. bandPath('songs/foo') → 'bands/deadcetera/songs/foo'
 */
window.bandPath = function bandPath(subpath) {
    return 'bands/' + currentBandSlug + (subpath ? '/' + subpath : '');
};

// ── Convenience path builders ────────────────────────────────────────────────

/**
 * Full path to a per-song data node.
 * Routes v2-enabled data types through songs_v2/{songId} when available.
 * Falls back to legacy songs/{sanitizedTitle} for non-v2 types or missing songIds.
 */
var _SONG_V2_TYPES = { song_bpm:1, key:1, lead_singer:1, song_status:1, chart:1,
    personal_tabs:1, rehearsal_notes:1, spotify_versions:1, practice_tracks:1,
    cover_me:1, song_votes:1, song_structure:1 };

window.songPath = function songPath(songTitle, dataType) {
    // For v2-enabled types, use songs_v2/{songId} if songId is available
    if (_SONG_V2_TYPES[dataType] && typeof GLStore !== 'undefined' && GLStore.getSongIdByTitle) {
        var songId = GLStore.getSongIdByTitle(songTitle);
        if (songId) {
            return window.bandPath('songs_v2/' + songId + '/' + window.sanitizeFirebasePath(dataType));
        }
    }
    // Legacy path for non-v2 types or songs without songId
    return window.bandPath(
        'songs/' + window.sanitizeFirebasePath(songTitle) +
        '/' + window.sanitizeFirebasePath(dataType)
    );
};

/**
 * Full path to a master (band-level) data file node.
 * e.g. masterPath('_master_readiness.json')
 *   → 'bands/deadcetera/master/_master_readiness'
 */
window.masterPath = function masterPath(fileName) {
    var name = String(fileName).replace('.json', '');
    return window.bandPath('master/' + window.sanitizeFirebasePath(name));
};

// ── One-time migration: flat → multi-band ────────────────────────────────────

/**
 * Copies legacy flat /songs and /master data to /bands/deadcetera/.
 * Safe to call multiple times — checks for existing data first.
 * Runs automatically after Firebase init.
 */
window.migrateToMultiBand = async function migrateToMultiBand() {
    if (!firebaseDB) return;
    var migrationKey = 'deadcetera_migrated_to_multiband';
    if (localStorage.getItem(migrationKey) === 'done') return;

    try {
        var testSnap = await firebaseDB.ref('bands/deadcetera/master').once('value');
        if (testSnap.val()) {
            localStorage.setItem(migrationKey, 'done');
            return;
        }

        var oldSongsSnap   = await firebaseDB.ref('songs').once('value');
        var oldMasterSnap  = await firebaseDB.ref('master').once('value');
        var oldPartiesSnap = await firebaseDB.ref('listening_parties').once('value');

        var oldSongs   = oldSongsSnap.val();
        var oldMaster  = oldMasterSnap.val();
        var oldParties = oldPartiesSnap.val();

        if (!oldSongs && !oldMaster) {
            localStorage.setItem(migrationKey, 'done');
            return;
        }

        console.log('Migrating data to /bands/deadcetera/ ...');
        var updates = {};
        if (oldSongs)   updates['bands/deadcetera/songs']              = oldSongs;
        if (oldMaster)  updates['bands/deadcetera/master']             = oldMaster;
        if (oldParties) updates['bands/deadcetera/listening_parties']  = oldParties;

        updates['bands/deadcetera/meta'] = {
            name: 'Deadcetera', slug: 'deadcetera', createdAt: Date.now(),
            catalog: ['GD','JGB','Phish','WSP','ABB'],
            members: {
                drew:  { name:'Drew',  role:'Rhythm Guitar', email:'drewmerrill1029@gmail.com',  joined: Date.now() },
                chris: { name:'Chris', role:'Bass',          email:'cmjalbert@gmail.com',         joined: Date.now() },
                brian: { name:'Brian', role:'Lead Guitar',   email:'brian@hrestoration.com',      joined: Date.now() },
                pierce:{ name:'Pierce',role:'Keyboard',      email:'pierce.d.hale@gmail.com',     joined: Date.now() },
                jay:   { name:'Jay',   role:'Drums',         email:'jnault@fegholdings.com',      joined: Date.now() }
            }
        };

        await firebaseDB.ref().update(updates);
        console.log('Multi-band migration complete!');
        localStorage.setItem(migrationKey, 'done');
        if (typeof showToast === 'function') showToast('Data migrated to multi-band format');
    } catch (err) {
        console.error('Migration error:', err);
    }
};

// ── Lightweight Firebase-only init ───────────────────────────────────────────

/**
 * Load Firebase SDKs and initialize firebaseDB without triggering Google sign-in.
 * Called automatically on page load so data is available immediately.
 */
window.initFirebaseOnly = async function initFirebaseOnly() {
    if (firebaseDB) return;

    const loadScript = (src) => new Promise((res, rej) => {
        if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
        const s = document.createElement('script');
        s.src = src; s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
    });

    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js');

    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    firebaseDB = firebase.database();

    try {
        await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js');
        if (firebase.storage) firebaseStorage = firebase.storage();
    } catch(e) { /* storage optional */ }

    console.log('🔥 Firebase DB ready (auto-init)');
    window.migrateToMultiBand().catch(err => console.log('Migration skipped:', err.message));
    window.migrateBandLevelData().catch(err => console.log('Band-level migration skipped:', err.message));
};

// ── Full init with Google Identity (triggered on first "Connect" click) ──────

window.loadGoogleDriveAPI = function loadGoogleDriveAPI() {
    return new Promise((resolve, reject) => {
        console.log('🔥 Loading Google Identity...');

        // Reuse the dedup-aware loadScript from initFirebaseOnly
        const loadScript = (src) => new Promise((res, rej) => {
            if (document.querySelector('script[src="' + src + '"]')) { res(); return; }
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });

        // Firebase SDKs are already loaded by initFirebaseOnly().
        // Only load Google Identity Services if not yet present.
        var gisReady = (window.google && window.google.accounts && window.google.accounts.oauth2)
            ? Promise.resolve()
            : loadScript('https://accounts.google.com/gsi/client');

        gisReady.then(() => {
            try {
                // Ensure Firebase is initialized (idempotent)
                if (typeof firebase !== 'undefined' && !firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
                if (!firebaseDB && typeof firebase !== 'undefined') firebaseDB = firebase.database();
                try { if (typeof firebase !== 'undefined' && firebase.storage && !firebaseStorage) firebaseStorage = firebase.storage(); } catch(e) {}

                console.log('✅ Google Identity ready');

                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_DRIVE_CONFIG.clientId,
                    scope: GOOGLE_DRIVE_CONFIG.scope,
                    callback: async (response) => {
                        if (response.error) {
                            console.error('Token error:', response);
                            window.updateSignInStatus(false);
                            // Show hero/login if no page is visible (user may be stuck)
                            if (typeof window.glHeroCheck === 'function') window.glHeroCheck(false);
                            return;
                        }
                        accessToken = response.access_token;
                        window.updateSignInStatus(true);
                        console.log('✅ User signed in');
                        await window.getCurrentUserEmail();
                        console.log('🔥 Firebase ready - no folder sharing needed!');
                    }
                });

                isGoogleDriveInitialized = true;
                console.log('✅ Backend initialized (Firebase + Google Identity)');
                window.migrateToMultiBand().catch(err => console.log('Migration skipped:', err.message));
                resolve(true);
            } catch (error) {
                console.error('❌ Firebase initialization failed:', error);
                reject(error);
            }
        }).catch(reject);
    });
};

// ── Auth helpers ─────────────────────────────────────────────────────────────

window.updateSignInStatus = function updateSignInStatus(signedIn) {
    isUserSignedIn = signedIn;
    if (typeof updateDriveAuthButton === 'function') updateDriveAuthButton();
};

window.getCurrentUserEmail = async function getCurrentUserEmail() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: 'Bearer ' + accessToken }
        });
        const userInfo = await response.json();
        currentUserEmail   = userInfo.email;
        currentUserName    = userInfo.name || userInfo.given_name || '';
        currentUserPicture = userInfo.picture || '';
        localStorage.setItem('deadcetera_google_email',   currentUserEmail);
        localStorage.setItem('deadcetera_google_name',    currentUserName);
        localStorage.setItem('deadcetera_google_picture', currentUserPicture);
        console.log('👤 Signed in as:', currentUserEmail);
        // Save activity log immediately after sign-in
        if (typeof logActivity === 'function') {
            logActivity('sign_in').then(() => {
                if (typeof activityLogCache !== 'undefined' && activityLogCache &&
                    typeof saveMasterFile === 'function' &&
                    typeof MASTER_ACTIVITY_LOG !== 'undefined') {
                    saveMasterFile(MASTER_ACTIVITY_LOG, activityLogCache).catch(() => {});
                    if (typeof activityLogDirty !== 'undefined') activityLogDirty = false;
                }
            });
        }
        if (typeof injectAdminButton === 'function') injectAdminButton();
        if (typeof updateDriveAuthButton === 'function') updateDriveAuthButton();
        if (typeof recoverLocalStorageToFirebase === 'function') recoverLocalStorageToFirebase();
    } catch (error) {
        console.error('Could not get user email:', error);
        currentUserEmail = 'unknown';
    }
};

/**
 * Toggle Google sign-in / sign-out.
 * Called by the topbar Connect button and the sign-in nudge banner.
 */
window.handleGoogleDriveAuth = async function handleGoogleDriveAuth(silent) {
    if (isUserSignedIn) {
        // Sign out
        isUserSignedIn = false;
        accessToken = null;
        currentUserEmail    = null;
        currentUserName     = '';
        currentUserPicture  = '';
        localStorage.removeItem('deadcetera_google_email');
        localStorage.removeItem('deadcetera_google_name');
        localStorage.removeItem('deadcetera_google_picture');
        if (typeof updateDriveAuthButton === 'function') updateDriveAuthButton();
        if (typeof showToast === 'function') showToast('Signed out');
        return;
    }

    // Sign in — load backend if not yet ready
    if (!isGoogleDriveInitialized) {
        try {
            await window.loadGoogleDriveAPI();
        } catch (err) {
            console.error('Failed to initialize backend:', err);
            if (!silent) alert('Could not connect. Please check your internet connection.');
            return;
        }
    }

    try {
        console.log('🔑 Requesting sign-in...' + (silent ? ' (auto-reconnect)' : ''));
        tokenClient.requestAccessToken({ prompt: silent ? 'none' : '' });
    } catch (error) {
        console.error('Sign-in failed:', error);
        if (!silent) alert('Sign-in failed.\n\nError: ' + error.message);
    }
};

// ── CRUD: per-song data ───────────────────────────────────────────────────────

/**
 * Save data for a song (or band-level entity) to Firebase + localStorage.
 *
 * Band-level data (songTitle === '_band') routes to the top-level band path:
 *   bands/{slug}/{dataType}
 * Song-level data routes through songPath:
 *   bands/{slug}/songs/{sanitized_title}/{dataType}
 *
 * @returns {Promise<boolean>} true if Firebase write succeeded
 */
window.saveBandDataToDrive = async function saveBandDataToDrive(songTitle, dataType, data) {
    var localKey = 'deadcetera_' + dataType + '_' + songTitle;
    try { localStorage.setItem(localKey, JSON.stringify(data)); } catch(e) {}

    if (!firebaseDB) {
        console.warn('⚠️ Firebase not ready — saved to localStorage only');
        if (typeof showToast === 'function') showToast('⚠️ Not signed in — changes saved locally only. Sign in to sync.');
        return false;
    }

    try {
        var path = (songTitle === '_band')
            ? window.bandPath(window.sanitizeFirebasePath(dataType))
            : window.songPath(songTitle, dataType);
        await firebaseDB.ref(path).set(data);
        return true;
    } catch (error) {
        console.error('❌ Failed to save to Firebase:', error.message || error);
        if (typeof showToast === 'function') showToast('❌ Save failed — ' + (error.message || 'check your connection'));
        return false;
    }
};

/**
 * Load data for a song (or band-level entity) from Firebase, with localStorage fallback.
 *
 * Band-level data (songTitle === '_band') reads from top-level band path first,
 * then falls back to the legacy songs/_band/ path for backward compatibility.
 *
 * @returns {Promise<any>} data or null
 */
window.loadBandDataFromDrive = async function loadBandDataFromDrive(songTitle, dataType) {
    if (firebaseDB) {
        try {
            var path = (songTitle === '_band')
                ? window.bandPath(window.sanitizeFirebasePath(dataType))
                : window.songPath(songTitle, dataType);
            var snapshot = await firebaseDB.ref(path).once('value');
            var data = snapshot.val();
            if (data !== null) return data;

            // Legacy fallback for _band data that hasn't been migrated yet
            if (songTitle === '_band') {
                var legacyPath = window.songPath(songTitle, dataType);
                if (legacyPath !== path) {
                    var legacySnap = await firebaseDB.ref(legacyPath).once('value');
                    if (legacySnap.val() !== null) {
                        console.warn('⚠️ [legacy-read] Loaded ' + dataType + ' from songs/_band/ — run migrateBandLevelData() to fix');
                        window._glLegacyReads = (window._glLegacyReads || 0) + 1;
                        return legacySnap.val();
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Firebase error for ' + dataType + ':', error.message);
        }
    }
    return window.loadFromLocalStorageFallback(songTitle, dataType);
};

window.loadFromLocalStorageFallback = function loadFromLocalStorageFallback(songTitle, dataType) {
    // Only use localStorage fallback for the original Deadcetera band —
    // other bands should never have localStorage data (Firebase is canonical)
    if (typeof currentBandSlug !== 'undefined' && currentBandSlug && currentBandSlug !== 'deadcetera') {
        return null;
    }
    var key = 'deadcetera_' + dataType + '_' + songTitle;
    var data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
};

// ── CRUD: master (band-level) files ──────────────────────────────────────────

/**
 * Load a master (band-level aggregate) file from Firebase, falling back to localStorage.
 */
window.loadMasterFile = async function loadMasterFile(fileName) {
    if (firebaseDB) {
        try {
            var path = window.masterPath(fileName);
            var snapshot = await firebaseDB.ref(path).once('value');
            var data = snapshot.val();
            if (data !== null) return data;
        } catch (error) {
            console.log('Could not load master file from Firebase: ' + fileName);
        }
    }
    // Only use localStorage fallback for Deadcetera — other bands are Firebase-only
    if (typeof currentBandSlug !== 'undefined' && currentBandSlug && currentBandSlug !== 'deadcetera') {
        return null;
    }
    var key = 'deadcetera_' + fileName;
    var localData = localStorage.getItem(key);
    return localData ? JSON.parse(localData) : null;
};

/**
 * Save a master file to Firebase (with key sanitization) and localStorage.
 * @returns {Promise<boolean>}
 */
window.saveMasterFile = async function saveMasterFile(fileName, data) {
    var key = 'deadcetera_' + fileName;
    localStorage.setItem(key, JSON.stringify(data));

    if (!firebaseDB) return false;

    try {
        var sanitized = (typeof data === 'object' && data !== null && !Array.isArray(data))
            ? Object.fromEntries(
                Object.entries(data).map(([k, v]) => [k.replace(/[.#$[\]\/]/g, '_'), v])
              )
            : data;
        var path = window.masterPath(fileName);
        await firebaseDB.ref(path).set(sanitized);
        return true;
    } catch (error) {
        console.error('Error saving master file:', error);
        return false;
    }
};

// ── Band-level data migration: songs/_band/* → top-level ────────────────────
//
// Legacy bug: saveBandDataToDrive('_band', 'setlists', ...) routed through
// songPath() which wrote to songs/_band/setlists. The fix above routes _band
// to bandPath(dataType) instead. This migration copies any data stuck at the
// old path to the correct top-level path.
//
// Idempotent. Non-destructive (never deletes old data). Auto-runs on startup.

var BAND_LEVEL_MIGRATION_FLAG = '_meta/band_level_migration_v1';

var BAND_LEVEL_DATA_TYPES = [
    'setlists', 'gigs', 'custom_songs', 'calendar_events', 'blocked_dates',
    'equipment', 'contacts', 'playlists', 'finances', 'finances_meta',
    'social_profiles', 'venues', 'notifications', 'notif_log', 'notif_members',
    'feedback', 'band_contacts', 'song_pitches', 'playlist_listens', 'best_shots',
    'gig_history', 'rehearsal_mixdowns'
];

window.migrateBandLevelData = async function migrateBandLevelData() {
    if (!firebaseDB) return { status: 'skipped', reason: 'no firebase' };

    // Check idempotency flag
    try {
        var flagSnap = await firebaseDB.ref(window.bandPath(BAND_LEVEL_MIGRATION_FLAG)).once('value');
        if (flagSnap.val()) return { status: 'already_done', completedAt: flagSnap.val().completedAt };
    } catch(e) {}

    console.log('%c🔄 Migrating band-level data from songs/_band/ to top-level...', 'color:#f59e0b;font-weight:bold');
    var stats = { migrated: 0, skipped: 0, errors: 0, types: [] };

    // Read legacy path: songs/_band/ (sanitized _band → _band)
    var legacyKey = window.sanitizeFirebasePath('_band');
    var legacyRoot;
    try {
        legacyRoot = await firebaseDB.ref(window.bandPath('songs/' + legacyKey)).once('value');
    } catch(e) {
        console.warn('Could not read legacy songs/_band/ path:', e.message);
        return { status: 'error', error: e.message };
    }

    var legacyData = legacyRoot.val();
    if (!legacyData || typeof legacyData !== 'object') {
        console.log('No legacy band-level data found at songs/_band/');
        await firebaseDB.ref(window.bandPath(BAND_LEVEL_MIGRATION_FLAG)).set({
            completedAt: new Date().toISOString(), stats: stats, note: 'no legacy data'
        });
        return { status: 'complete', stats: stats };
    }

    var updates = {};
    Object.keys(legacyData).forEach(function(dataType) {
        // Match known types OR pattern-prefixed types (practice_plan_*, rehearsal_plan_*, notif_member_*)
        var isKnown = BAND_LEVEL_DATA_TYPES.indexOf(dataType) !== -1;
        var isPattern = /^(practice_plan_|rehearsal_plan_|notif_member_)/.test(dataType);
        if (isKnown || isPattern) {
            updates[dataType] = legacyData[dataType];
            stats.migrated++;
            stats.types.push(dataType);
        } else {
            stats.skipped++;
        }
    });

    if (stats.migrated > 0) {
        try {
            await firebaseDB.ref(window.bandPath('')).update(updates);
            console.log('%c✅ Migrated ' + stats.migrated + ' band-level types: ' + stats.types.join(', '),
                'color:#22c55e;font-weight:bold');
        } catch(e) {
            console.error('Migration write failed:', e);
            stats.errors++;
            return { status: 'error', error: e.message, stats: stats };
        }
    }

    await firebaseDB.ref(window.bandPath(BAND_LEVEL_MIGRATION_FLAG)).set({
        completedAt: new Date().toISOString(), stats: stats
    });
    return { status: 'complete', stats: stats };
};

// ── Band Song Library — Firebase-scoped songs per band ────────────────────────
//
// Replaces the global allSongs[] catalog. Each band has its own song library
// stored at /bands/{slug}/song_library/{songId}.
// Songs are created implicitly when added to setlists.

var _GL_SONG_LIB_LOADED = false;
var _GL_SONG_LIB_MIGRATED_KEY = '_meta/song_library_migrated_v1';

/**
 * Generate a Firebase-safe song ID from a title.
 * "Friend of the Devil" → "friend_of_the_devil"
 */
window.generateSongId = function generateSongId(title) {
    return String(title || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 80);
};

/**
 * Ensure a song exists in the band's Firebase library.
 * Creates a minimal record if missing. Safe to call repeatedly.
 */
window.ensureBandSong = async function ensureBandSong(title) {
    if (!title || !firebaseDB) return;
    var songId = window.generateSongId(title);
    if (!songId) return;

    // Check local cache first
    var exists = (typeof allSongs !== 'undefined') && allSongs.some(function(s) {
        return s.title === title || s.songId === songId;
    });
    if (exists) return;

    // Check Firebase
    try {
        var snap = await firebaseDB.ref(window.bandPath('song_library/' + songId + '/title')).once('value');
        if (snap.val()) {
            // Exists in Firebase but not in local cache — add to cache
            _addSongToLocalCache({ songId: songId, title: title });
            return;
        }
    } catch(e) { /* proceed to create */ }

    // Create minimal record
    var record = {
        title: title,
        songId: songId,
        createdAt: Date.now(),
        createdFrom: 'setlist',
        createdBy: (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail : ''
    };

    try {
        await firebaseDB.ref(window.bandPath('song_library/' + songId)).set(record);
        _addSongToLocalCache(record);
        console.log('[SongLib] Created:', title);
    } catch(e) {
        console.warn('[SongLib] Failed to create:', title, e.message);
    }
};

/**
 * Add a song to the in-memory allSongs array + rebuild GLStore indexes.
 */
function _addSongToLocalCache(record) {
    if (typeof allSongs === 'undefined') return;
    // Avoid duplicates
    var exists = allSongs.some(function(s) { return s.songId === record.songId; });
    if (exists) return;
    allSongs.push({
        songId: record.songId,
        title: record.title,
        artist: record.artist || '',
        band: record.band || ''
    });
    allSongs.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });
    if (typeof GLStore !== 'undefined' && GLStore.rebuildSongIndexes) GLStore.rebuildSongIndexes();
}

/**
 * Load the band's song library from Firebase and replace allSongs contents.
 * For Deadcetera: migrates from hardcoded allSongs on first run.
 */
window.loadBandSongLibrary = async function loadBandSongLibrary() {
    if (!firebaseDB || _GL_SONG_LIB_LOADED) return;

    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : '';
    if (!slug) return;

    // Check if this band needs migration (Deadcetera only)
    if (slug === 'deadcetera') {
        try {
            var migFlag = await firebaseDB.ref(window.bandPath(_GL_SONG_LIB_MIGRATED_KEY)).once('value');
            if (!migFlag.val()) {
                await _migrateSongLibrary();
            }
        } catch(e) { console.warn('[SongLib] Migration check failed:', e.message); }
    }

    // Load from Firebase
    try {
        var snap = await firebaseDB.ref(window.bandPath('song_library')).once('value');
        var data = snap.val();
        if (data && typeof data === 'object') {
            var songs = [];
            Object.keys(data).forEach(function(id) {
                var s = data[id];
                if (!s || !s.title) return;
                songs.push({
                    songId: s.songId || id,
                    title: s.title,
                    artist: s.artist || '',
                    band: s.band || '',
                    key: s.key || '',
                    bpm: s.bpm || 0,
                    status: s.status || ''
                });
            });
            songs.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });

            // Replace allSongs contents in-place (all 263 references auto-update)
            if (typeof allSongs !== 'undefined') {
                allSongs.length = 0;
                songs.forEach(function(s) { allSongs.push(s); });
            }
            console.log('[SongLib] Loaded ' + songs.length + ' songs for band: ' + slug);
        } else if (slug !== 'deadcetera') {
            // Non-DC band with no songs — clear allSongs
            if (typeof allSongs !== 'undefined') {
                allSongs.length = 0;
            }
            console.log('[SongLib] Empty library for band: ' + slug);
        }

        _GL_SONG_LIB_LOADED = true;
        if (typeof GLStore !== 'undefined' && GLStore.rebuildSongIndexes) GLStore.rebuildSongIndexes();

        // Re-render songs page if visible
        if (typeof renderSongs === 'function') {
            try { renderSongs(); } catch(e) { console.warn('[Firebase] renderSongs failed after sync', e); }
        }
    } catch(e) {
        console.error('[SongLib] Load failed:', e.message);
        // Show toast so user knows something went wrong
        if (typeof showToast === 'function') showToast('Song library loading — retrying...', 3000);
        // Retry once after 3 seconds
        if (!window._glSongLibRetried) {
            window._glSongLibRetried = true;
            setTimeout(function() {
                _GL_SONG_LIB_LOADED = false;
                window.loadBandSongLibrary();
            }, 3000);
        }
    }
};

/**
 * One-time migration: copy hardcoded allSongs + statuses to Firebase song_library.
 * Only runs for Deadcetera.
 */
async function _migrateSongLibrary() {
    if (typeof allSongs === 'undefined' || !allSongs.length || !firebaseDB) return;
    console.log('[SongLib] Migrating ' + allSongs.length + ' songs to Firebase...');

    var updates = {};
    allSongs.forEach(function(s) {
        var id = s.songId || window.generateSongId(s.title);
        var record = {
            title: s.title,
            songId: id,
            artist: s.artist || '',
            band: s.band || '',
            createdAt: Date.now(),
            createdFrom: 'migration'
        };
        // Carry over status if available
        if (typeof statusCache !== 'undefined' && statusCache[s.title]) {
            record.status = statusCache[s.title];
        }
        updates[id] = record;
    });

    try {
        await firebaseDB.ref(window.bandPath('song_library')).update(updates);
        await firebaseDB.ref(window.bandPath(_GL_SONG_LIB_MIGRATED_KEY)).set({
            completedAt: new Date().toISOString(),
            songCount: allSongs.length
        });
        console.log('[SongLib] Migration complete: ' + allSongs.length + ' songs');
    } catch(e) {
        console.error('[SongLib] Migration failed:', e.message);
    }
}

// ── Global Error Capture ──────────────────────────────────────────────────────
// Route all uncaught errors to GLRenderState so pages never go blank silently.

window.onerror = function(msg, source, line, col, error) {
    console.error('[GlobalError]', msg, source + ':' + line + ':' + col);
    // Don't show error state for non-critical issues
    if (typeof GLRenderState !== 'undefined') {
        var currentPage = (typeof window._glCurrentPage !== 'undefined') ? window._glCurrentPage : '';
        if (currentPage) {
            var state = GLRenderState.get(currentPage);
            // Only show error if page is still loading
            if (state && state.status === 'loading') {
                GLRenderState.set(currentPage, {
                    status: 'error',
                    title: 'Something went wrong',
                    message: String(msg).substring(0, 120),
                    retry: "showPage('" + currentPage + "')"
                });
            }
        }
    }
};

window.onunhandledrejection = function(event) {
    var reason = event.reason;
    var msg = (reason && reason.message) ? reason.message : String(reason);
    console.error('[UnhandledRejection]', msg);
};

console.log('✅ firebase-service.js loaded');
