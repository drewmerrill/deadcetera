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

// ── Dev/Preview Auth Bypass ──────────────────────────────────────────────────
// Injects mock authenticated user on Vercel preview deploys and localhost ONLY.
// NEVER activates on production domain. Does not modify real auth logic.
(function() {
  var h = window.location.hostname;
  var isPreview = (h.indexOf('vercel.app') !== -1 && h.indexOf('deadcetera.vercel.app') !== 0)
               || h === 'localhost' || h === '127.0.0.1';
  if (!isPreview) return;

  // Only inject if no real session exists
  if (currentUserEmail && currentUserEmail !== 'dev@groovelinx.local') return;

  currentUserEmail   = 'dev@groovelinx.local';
  currentUserName    = 'Drew Dev';
  currentUserPicture = '';
  isUserSignedIn     = true;

  // Seed localStorage so auto-reconnect flow picks it up
  localStorage.setItem('deadcetera_google_email', currentUserEmail);
  localStorage.setItem('deadcetera_google_name', currentUserName);

  console.log('%c⚡ Dev auth bypass active — preview mode', 'color:#fbbf24;font-weight:bold');
})();

// ── Multi-band routing ───────────────────────────────────────────────────────

var currentBandSlug = localStorage.getItem('deadcetera_current_band') || 'deadcetera';

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
 * e.g. songPath('Friend of the Devil', 'spotify_versions')
 *   → 'bands/deadcetera/songs/Friend_of_the_Devil/spotify_versions'
 */
window.songPath = function songPath(songTitle, dataType) {
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
};

// ── Full init with Google Identity (triggered on first "Connect" click) ──────

window.loadGoogleDriveAPI = function loadGoogleDriveAPI() {
    return new Promise((resolve, reject) => {
        console.log('🔥 Loading Firebase + Google Identity...');

        const loadScript = (src) => new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });

        Promise.all([
            loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js'),
            loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'),
            loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js'),
            loadScript('https://accounts.google.com/gsi/client')
        ]).then(() => {
            try {
                if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);

                if (!firebaseDB) firebaseDB = firebase.database();

                try {
                    if (firebase.storage && !firebaseStorage) firebaseStorage = firebase.storage();
                } catch(e) {}

                console.log('✅ Firebase initialized');

                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_DRIVE_CONFIG.clientId,
                    scope: GOOGLE_DRIVE_CONFIG.scope,
                    callback: async (response) => {
                        if (response.error) {
                            console.error('Token error:', response);
                            window.updateSignInStatus(false);
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
 * Save data for a song to Firebase (and localStorage as fallback).
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
        var path = window.songPath(songTitle, dataType);
        await firebaseDB.ref(path).set(data);
        return true;
    } catch (error) {
        console.error('❌ Failed to save to Firebase:', error.message || error);
        if (typeof showToast === 'function') showToast('❌ Save failed — ' + (error.message || 'check your connection'));
        return false;
    }
};

/**
 * Load data for a song from Firebase, falling back to localStorage.
 * @returns {Promise<any>} data or null
 */
window.loadBandDataFromDrive = async function loadBandDataFromDrive(songTitle, dataType) {
    if (firebaseDB) {
        try {
            var path = window.songPath(songTitle, dataType);
            var snapshot = await firebaseDB.ref(path).once('value');
            var data = snapshot.val();
            if (data !== null) return data;
        } catch (error) {
            console.log('⚠️ Firebase error for ' + dataType + ':', error.message);
        }
    }
    return window.loadFromLocalStorageFallback(songTitle, dataType);
};

window.loadFromLocalStorageFallback = function loadFromLocalStorageFallback(songTitle, dataType) {
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

console.log('✅ firebase-service.js loaded');
