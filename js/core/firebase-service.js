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
    scope: 'email profile https://www.googleapis.com/auth/calendar.events'
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
 * V2-enabled types ALWAYS route to songs_v2/{songId}.
 * Non-v2 types (readiness, woodshed, moments, etc.) use legacy songs/{title}.
 */
var _SONG_V2_TYPES = { song_bpm:1, key:1, lead_singer:1, song_status:1,
    chart:1, chart_band:1, chart_master:1, chart_url:1,
    personal_tabs:1, rehearsal_notes:1, spotify_versions:1, practice_tracks:1,
    cover_me:1, song_votes:1, song_structure:1, readiness:1, readiness_history:1 };

// Fallback tracking — logs when legacy path is used for a v2-enabled type
var _songPathFallbackLog = {};

window.songPath = function songPath(songTitle, dataType) {
    if (_SONG_V2_TYPES[dataType]) {
        // V2 type: MUST use songs_v2. No fallback.
        var songId = null;
        if (typeof GLStore !== 'undefined' && GLStore.getSongIdByTitle) {
            songId = GLStore.getSongIdByTitle(songTitle);
        }
        if (songId) {
            return window.bandPath('songs_v2/' + songId + '/' + window.sanitizeFirebasePath(dataType));
        }
        // Missing songId for a v2 type — log it and use legacy as last resort
        var logKey = songTitle + ':' + dataType;
        if (!_songPathFallbackLog[logKey]) {
            _songPathFallbackLog[logKey] = true;
            console.warn('[songPath] LEGACY FALLBACK: "' + songTitle + '" / ' + dataType + ' — missing songId. Run songId repair.');
        }
    }
    // Non-v2 types or fallback: legacy path
    return window.bandPath(
        'songs/' + window.sanitizeFirebasePath(songTitle) +
        '/' + window.sanitizeFirebasePath(dataType)
    );
};

/**
 * Audit all songs for missing or duplicate songIds.
 * Call from console: songIdAudit()
 */
window.songIdAudit = function() {
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var missing = [];
    var ids = {};
    var dupes = [];

    songs.forEach(function(s) {
        if (!s || !s.title) return;
        if (!s.songId) {
            missing.push(s.title);
            return;
        }
        if (ids[s.songId]) {
            dupes.push({ songId: s.songId, titles: [ids[s.songId], s.title] });
        }
        ids[s.songId] = s.title;
    });

    console.log('=== SONG ID AUDIT ===');
    console.log('Total songs:', songs.length);
    console.log('With songId:', Object.keys(ids).length);
    console.log('Missing songId:', missing.length);
    if (missing.length) console.log('  Missing:', missing.slice(0, 20).join(', ') + (missing.length > 20 ? '...' : ''));
    console.log('Duplicate songIds:', dupes.length);
    if (dupes.length) console.table(dupes);
    return { total: songs.length, withId: Object.keys(ids).length, missing: missing, dupes: dupes };
};

/**
 * Repair missing songIds by generating them.
 * Call from console: songIdRepair() for dry run, songIdRepair(false) to execute.
 */
window.songIdRepair = function(dryRun) {
    if (typeof dryRun === 'undefined') dryRun = true;
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var fixed = 0;

    songs.forEach(function(s) {
        if (!s || !s.title || s.songId) return;
        // Generate songId from band + title (same pattern as data.js)
        var band = (s.band || 'xx').toLowerCase().replace(/[^a-z]/g, '');
        var title = s.title.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        var newId = band + '_' + title;
        if (dryRun) {
            console.log('  Would assign:', s.title, '→', newId);
        } else {
            s.songId = newId;
        }
        fixed++;
    });

    console.log((dryRun ? 'DRY RUN: ' : 'DONE: ') + fixed + ' songIds ' + (dryRun ? 'would be' : '') + ' assigned');
    if (!dryRun && fixed > 0) {
        // Rebuild indexes
        if (typeof GLStore !== 'undefined' && GLStore.rebuildSongIndexes) GLStore.rebuildSongIndexes();
        console.log('Song indexes rebuilt');
    }
    return fixed;
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
                        // Track which scopes Google actually granted (vs just requested)
                        window._grantedScopes = response.scope || '';
                        if (window._grantedScopes.indexOf('calendar') !== -1) {
                            console.log('✅ Calendar scope GRANTED');
                            window._calendarScopeGranted = true;
                        } else {
                            console.warn('⚠️ Calendar scope NOT granted — token scopes:', window._grantedScopes);
                            window._calendarScopeGranted = false;
                        }
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

            // Legacy fallback: if v2 path returned null, check legacy path
            // This handles data not yet migrated to songs_v2
            if (songTitle !== '_band' && _SONG_V2_TYPES[dataType]) {
                var legacySongPath = window.bandPath(
                    'songs/' + window.sanitizeFirebasePath(songTitle) +
                    '/' + window.sanitizeFirebasePath(dataType));
                if (legacySongPath !== path) {
                    var legacySongSnap = await firebaseDB.ref(legacySongPath).once('value');
                    if (legacySongSnap.val() !== null) {
                        console.warn('⚠️ [legacy-read] Loaded ' + dataType + ' for "' + songTitle + '" from legacy songs/ path');
                        window._glLegacyReads = (window._glLegacyReads || 0) + 1;
                        return legacySongSnap.val();
                    }
                }
            }

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
    // Enforce songId invariant — no song without songId
    if (!record.songId) {
        record.songId = window.generateSongId ? window.generateSongId(record.title || 'unknown') : ('auto_' + Date.now().toString(36));
        console.warn('[songId] Missing songId — auto-generated for "' + (record.title || '?') + '" →', record.songId);
    }
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
            var _repaired = 0;
            Object.keys(data).forEach(function(id) {
                var s = data[id];
                if (!s || !s.title) return;
                var songId = s.songId || id;
                // Enforce songId invariant
                if (!songId || songId === 'undefined') {
                    songId = window.generateSongId ? window.generateSongId(s.title) : ('lib_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6));
                    _repaired++;
                    console.warn('[song_library] Repaired missing songId for "' + s.title + '" →', songId);
                }
                songs.push({
                    songId: songId,
                    title: s.title,
                    artist: s.artist || '',
                    band: s.band || '',
                    key: s.key || '',
                    bpm: s.bpm || 0,
                    status: s.status || ''
                });
            });
            if (_repaired > 0) console.warn('[song_library] Repaired ' + _repaired + ' songs with missing songIds');
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

        // Runtime integrity check: every song MUST have a songId
        if (typeof allSongs !== 'undefined') {
            var _noId = allSongs.filter(function(s) { return !s.songId; });
            if (_noId.length > 0) {
                console.error('[CRITICAL] ' + _noId.length + ' songs without songId after library load:', _noId.map(function(s) { return s.title; }).slice(0, 10));
                // Auto-repair: generate songIds for any that slipped through
                _noId.forEach(function(s) {
                    s.songId = window.generateSongId ? window.generateSongId(s.title || 'unknown') : ('fix_' + Date.now().toString(36));
                    console.warn('[songId] Emergency repair:', s.title, '→', s.songId);
                });
                if (typeof GLStore !== 'undefined' && GLStore.rebuildSongIndexes) GLStore.rebuildSongIndexes();
            }
        }

        // Auto-migrate legacy song data to songs_v2 (one-time, non-blocking)
        _autoMigrateSongDataToV2();

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

// ── Auto-migrate legacy song data to songs_v2 (one-time) ────────────────────
async function _autoMigrateSongDataToV2() {
    if (!firebaseDB || typeof allSongs === 'undefined' || !allSongs.length) return;
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : '';
    if (!slug) return;
    var bp = 'bands/' + slug + '/';

    // Check migration flag — re-run if song count grew OR schema version changed (new v2 types added)
    var _MIGRATION_SCHEMA_VERSION = 2; // bump when new types are added to _SONG_V2_TYPES
    try {
        var flagSnap = await firebaseDB.ref(bp + 'meta/songs_v2_migrated').once('value');
        var flag = flagSnap.val();
        if (flag && flag.totalSongs && flag.totalSongs >= allSongs.length * 0.9
            && flag.schemaVersion && flag.schemaVersion >= _MIGRATION_SCHEMA_VERSION) return;
        if (flag) console.log('[Migration] Re-running — schema v' + (flag.schemaVersion || 1) + '→' + _MIGRATION_SCHEMA_VERSION + ', songs ' + (flag.totalSongs || 0) + '/' + allSongs.length);
    } catch(e) { return; }

    console.log('[Migration] Auto-migrating legacy song data to songs_v2...');

    // Schema enforcement: verify all v2-routed types are covered by migration
    var _migratedTypes = ['key', 'song_bpm', 'lead_singer', 'song_status', 'song_structure',
        'readiness', 'readiness_history', 'chart', 'chart_band', 'chart_master', 'chart_url',
        'personal_tabs', 'rehearsal_notes', 'spotify_versions', 'practice_tracks', 'cover_me', 'song_votes'];
    var _missing = Object.keys(_SONG_V2_TYPES).filter(function(t) { return _migratedTypes.indexOf(t) === -1; });
    if (_missing.length) console.error('[Migration] SCHEMA GAP: v2-routed types not in migration:', _missing);

    var sanitize = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath : function(s) { return s.replace(/[.#$/\[\]]/g, '_'); };

    try {
        var legacySnap = await firebaseDB.ref(bp + 'songs').once('value');
        var legacyData = legacySnap.val() || {};
        var v2Snap = await firebaseDB.ref(bp + 'songs_v2').once('value');
        var v2Data = v2Snap.val() || {};

        var migrated = 0, total = 0;
        for (var i = 0; i < allSongs.length; i++) {
            var song = allSongs[i];
            if (!song || !song.title || !song.songId) continue;
            total++;
            var titleKey = sanitize(song.title);
            var legacy = legacyData[titleKey] || legacyData[song.title] || {};
            var v2 = v2Data[song.songId] || {};

            // Extract from legacy
            var lk = null, lb = null, ll = null, ls = null, lst = null;
            if (legacy.key) lk = (typeof legacy.key === 'object' && legacy.key.key) ? legacy.key.key : (typeof legacy.key === 'string' ? legacy.key : null);
            if (!lk && legacy.song_key) lk = (typeof legacy.song_key === 'object') ? legacy.song_key.key : legacy.song_key;
            if (legacy.song_bpm) lb = (typeof legacy.song_bpm === 'object') ? legacy.song_bpm.bpm : legacy.song_bpm;
            if (!lb && legacy.bpm) lb = legacy.bpm;
            if (legacy.lead_singer) ll = (typeof legacy.lead_singer === 'object') ? legacy.lead_singer.singer : legacy.lead_singer;
            if (legacy.song_status) lst = (typeof legacy.song_status === 'object') ? legacy.song_status.status : legacy.song_status;
            if (legacy.song_structure && legacy.song_structure.sections) ls = legacy.song_structure;

            // Also check localStorage (data may have been saved locally but not to Firebase)
            var _lsKey = null, _lsBpm = null, _lsLead = null;
            try {
                var _lsk = localStorage.getItem('deadcetera_key_' + song.title);
                if (_lsk) { var _lskp = JSON.parse(_lsk); _lsKey = (typeof _lskp === 'object' && _lskp.key) ? _lskp.key : (typeof _lskp === 'string' ? _lskp : null); }
                var _lsb = localStorage.getItem('deadcetera_song_bpm_' + song.title);
                if (_lsb) { var _lsbp = JSON.parse(_lsb); _lsBpm = (typeof _lsbp === 'object' && _lsbp.bpm) ? _lsbp.bpm : _lsbp; }
                var _lsl = localStorage.getItem('deadcetera_lead_singer_' + song.title);
                if (_lsl) { var _lslp = JSON.parse(_lsl); _lsLead = (typeof _lslp === 'object' && _lslp.singer) ? _lslp.singer : (typeof _lslp === 'string' ? _lslp : null); }
            } catch(e3) {}

            // Merge: v2 > legacy > localStorage
            var fk = (v2.key ? (typeof v2.key === 'object' ? v2.key.key : v2.key) : null) || lk || _lsKey;
            var fb = (v2.song_bpm ? (typeof v2.song_bpm === 'object' ? v2.song_bpm.bpm : v2.song_bpm) : null) || lb || _lsBpm;
            var fl = (v2.lead_singer ? (typeof v2.lead_singer === 'object' ? v2.lead_singer.singer : v2.lead_singer) : null) || ll || _lsLead;
            var fst = v2.song_status ? (typeof v2.song_status === 'object' ? v2.song_status.status : v2.song_status) : null || lst;
            var fstr = v2.song_structure || ls;

            // Also migrate readiness + readiness_history
            var fRead = legacy.readiness || v2.readiness || null;
            var fReadH = legacy.readiness_history || v2.readiness_history || null;

            // Migrate ALL remaining v2-routed types (generic pass)
            // chart_band, chart_master, chart_url, chart, personal_tabs,
            // rehearsal_notes, spotify_versions, practice_tracks, cover_me, song_votes
            var _allV2Fields = ['chart', 'chart_band', 'chart_master', 'chart_url',
                'personal_tabs', 'rehearsal_notes', 'spotify_versions',
                'practice_tracks', 'cover_me', 'song_votes'];
            var _extraFields = {};
            _allV2Fields.forEach(function(field) {
                // v2 takes precedence, then legacy, then localStorage
                var val = v2[field] || legacy[field] || null;
                if (!val) {
                    try {
                        var _lsv = localStorage.getItem('deadcetera_' + field + '_' + song.title);
                        if (_lsv) val = JSON.parse(_lsv);
                    } catch(e4) {}
                }
                if (val) _extraFields[field] = val;
            });
            // Map legacy 'chart' to 'chart_band' if chart_band doesn't exist
            if (_extraFields.chart && !_extraFields.chart_band) {
                _extraFields.chart_band = _extraFields.chart;
            }

            var hasAnyData = fk || fb || fl || fst || fstr || fRead || Object.keys(_extraFields).length > 0;
            if (!hasAnyData) continue;

            var rec = {};
            var now = new Date().toISOString();
            if (fk) rec.key = { key: fk, updatedAt: now, source: 'migration' };
            if (fb) rec.song_bpm = { bpm: Number(fb), updatedAt: now, source: 'migration' };
            if (fl) rec.lead_singer = { singer: fl, updatedAt: now, source: 'migration' };
            if (fst) rec.song_status = { status: fst, updatedAt: now, source: 'migration' };
            if (fstr) rec.song_structure = fstr;
            if (fRead) rec.readiness = fRead;
            if (fReadH) rec.readiness_history = fReadH;
            // Add all extra v2 fields
            Object.keys(_extraFields).forEach(function(f) { rec[f] = _extraFields[f]; });

            try {
                await firebaseDB.ref(bp + 'songs_v2/' + song.songId).update(rec);
                migrated++;
                // Also update in-memory
                if (fk) song.key = fk;
                if (fb) song.bpm = fb;
                if (fl) song.lead = fl;
            } catch(e) { console.warn('[Migration] Write failed for', song.title, e.message); }
        }

        // Set migration flag
        await firebaseDB.ref(bp + 'meta/songs_v2_migrated').set({ completedAt: new Date().toISOString(), migratedCount: migrated, totalSongs: total, schemaVersion: _MIGRATION_SCHEMA_VERSION });
        console.log('[Migration] ✅ Migrated ' + migrated + '/' + total + ' songs to songs_v2 (including readiness)');

        // Re-render if visible (preload will re-run after migration returns)
        if (typeof renderSongs === 'function') try { renderSongs(); } catch(e) {}
    } catch(e) {
        console.error('[Migration] Failed:', e.message);
    }
}

// Also expose for manual use
window.runSongMigration = _autoMigrateSongDataToV2;

// Force re-run migration (resets flag first)
window.runSongMigrationForce = async function() {
    if (!firebaseDB) { console.error('Firebase not ready'); return; }
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    // Clear the migration flag
    await firebaseDB.ref('bands/' + slug + '/meta/songs_v2_migrated').remove();
    window._songV2MigrationRunning = false;
    console.log('[Migration] Flag cleared — running migration...');
    await _autoMigrateSongDataToV2();
    // Re-run preload
    if (typeof _preloadSongDNA === 'function') await _preloadSongDNA();
    // Re-render
    if (typeof renderSongs === 'function') try { renderSongs(); } catch(e) {}
    console.log('[Migration] Done. Reload page to verify.');
};

// Diagnose songs still showing as "missing" key/BPM
window.diagnoseMissingSongData = async function() {
    if (!firebaseDB || typeof allSongs === 'undefined') { console.error('Not ready'); return; }
    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var bp = 'bands/' + slug + '/';
    var sanitize = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath : function(s) { return s.replace(/[.#$/\[\]]/g, '_'); };

    var missing = allSongs.filter(function(s) { return s.songId && (!s.key || !s.bpm); });
    console.log('Songs missing key or BPM in memory:', missing.length);

    for (var i = 0; i < Math.min(missing.length, 5); i++) {
        var s = missing[i];
        var titleKey = sanitize(s.title);
        console.log('\n--- ' + s.title + ' (songId: ' + s.songId + ', titleKey: ' + titleKey + ') ---');
        console.log('  In-memory: key=' + (s.key || 'EMPTY') + ', bpm=' + (s.bpm || 'EMPTY'));

        // Check v2
        try {
            var v2Snap = await firebaseDB.ref(bp + 'songs_v2/' + s.songId).once('value');
            var v2 = v2Snap.val();
            console.log('  songs_v2/' + s.songId + ':', v2 ? JSON.stringify(Object.keys(v2)) : 'NULL');
            if (v2 && v2.key) console.log('    v2.key:', JSON.stringify(v2.key));
            if (v2 && v2.song_bpm) console.log('    v2.song_bpm:', JSON.stringify(v2.song_bpm));
        } catch(e) { console.log('  v2 read failed:', e.message); }

        // Check legacy
        try {
            var legSnap = await firebaseDB.ref(bp + 'songs/' + titleKey).once('value');
            var leg = legSnap.val();
            console.log('  songs/' + titleKey + ':', leg ? JSON.stringify(Object.keys(leg)) : 'NULL');
            if (leg && leg.key) console.log('    legacy.key:', JSON.stringify(leg.key));
            if (leg && leg.song_bpm) console.log('    legacy.song_bpm:', JSON.stringify(leg.song_bpm));
            if (leg && leg.song_key) console.log('    legacy.song_key:', JSON.stringify(leg.song_key));
        } catch(e) { console.log('  legacy read failed:', e.message); }
    }
};

console.log('✅ firebase-service.js loaded');
