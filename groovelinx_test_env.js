// ============================================================================
// groovelinx_test_env.js — Dev/QA Test Environment
// ============================================================================
// Activated via ?dev=true in URL.
// Isolated band slug: deadcetera-test (never touches production data).
// Auto-seeds realistic test data on first load.
// ============================================================================

'use strict';

var GLT = window.GLT = {
    ACTIVE: new URLSearchParams(window.location.search).get('dev') === 'true',
    BAND_SLUG: 'deadcetera-test',
    user: {
        email: 'test@groovelinx.com',
        name: 'Test User',
        memberKey: 'test_user'
    }
};

// ── Test Songs ─────────────────────────────────────────────────────────────

GLT.TEST_SONGS = [
    { title: 'Althea', band: 'GD' },
    { title: 'Bertha', band: 'GD' },
    { title: 'Sugaree', band: 'GD' },
    { title: 'Fire on the Mountain', band: 'GD' },
    { title: 'Eyes of the World', band: 'GD' },
    { title: 'Dark Star', band: 'GD' },
    { title: "Good Lovin'", band: 'GD' },
    { title: "He's Gone", band: 'GD' },
    { title: 'China Cat Sunflower', band: 'GD' },
    { title: 'Deal', band: 'GD' },
    { title: 'After Midnight', band: 'JGB' },
    { title: 'Test & Edge-Case Song!', band: 'Other' }
];

// ── Readiness (title-keyed — matches production convention) ────────────────

GLT.TEST_READINESS = {
    'Althea':                { drew: 5, chris: 4, brian: 4, pierce: 3, jay: 5, test_user: 4 },
    'Bertha':                { drew: 4, chris: 3, brian: 2, pierce: 1, jay: 4, test_user: 3 },
    'Sugaree':               { drew: 3, chris: 3, brian: 3, pierce: 2, jay: 3, test_user: 2 },
    'Fire on the Mountain':  { drew: 5, chris: 5, brian: 5, pierce: 5, jay: 5, test_user: 5 },
    'Eyes of the World':     { drew: 2, chris: 1 },
    'China Cat Sunflower':   { drew: 4, chris: 4, brian: 3, pierce: 3, jay: 4, test_user: 3 },
    'Deal':                  { drew: 5, chris: 5, brian: 4, pierce: 4, jay: 5, test_user: 5 }
};

// ── Statuses ───────────────────────────────────────────────────────────────

GLT.TEST_STATUSES = {
    'Althea': 'gig_ready',
    'Bertha': 'wip',
    'Sugaree': 'wip',
    'Fire on the Mountain': 'gig_ready',
    'Deal': 'gig_ready',
    'China Cat Sunflower': 'prospect',
    'Eyes of the World': 'prospect'
};

// ── Setlist ────────────────────────────────────────────────────────────────

GLT.TEST_SETLIST = {
    name: 'QA Test Setlist \u2014 March 2026',
    date: '2026-03-28',
    venue: 'Test Venue, Atlanta GA',
    notes: 'Full QA test setlist with mixed data',
    sets: [
        {
            name: 'Set 1',
            songs: [
                { title: 'Bertha', segue: 'stop' },
                { title: 'Sugaree', segue: 'flow' },
                { title: 'Althea', segue: 'stop' },
                { title: 'China Cat Sunflower', segue: 'segue' },
                { title: 'Deal', segue: 'stop' }
            ]
        },
        {
            name: 'Set 2',
            songs: [
                { title: 'Dark Star', segue: 'segue' },
                { title: 'Eyes of the World', segue: 'flow' },
                { title: 'Fire on the Mountain', segue: 'stop' }
            ]
        },
        {
            name: 'Encore',
            songs: [
                { title: "Good Lovin'", segue: 'stop' }
            ]
        }
    ],
    created: '2026-03-22T12:00:00.000Z'
};

// ── Charts (per-song) ──────────────────────────────────────────────────────

GLT.TEST_CHARTS = {
    'Althea': {
        text: 'Althea \u2014 Key of E\n\nIntro: E  A  B  A\n\nVerse:\nE              A\nAlthea told me on a stormy sea\nB              A          E\nI could rest my weary head on the shore\n\nChorus:\nA        B        E\nThere are things you can replace\nA        B        E\nAnd others you cannot\n\nJam: E  A  B  A (repeat)\n\nOutro: E  A  B  A  E (hold)'
    },
    'Dark Star': {
        text: 'Dark Star \u2014 Key of A\n\nIntro: A  G  A  G\n\nVerse:\nA                    G\nDark star crashes, pouring its light\nA                      G\nInto ashes, reason tatters\n\nJam: Am  G (free form, extended)\n\nOutro: A  G  A (fade)'
    },
    'Fire on the Mountain': {
        text: 'Fire on the Mountain \u2014 Key of B\n\nIntro: B  A  B  A (4x)\n\nVerse:\nB                     A\nLong distance runner what you standing there for\nB                     A\nGet up get out get out of the door\n\nChorus:\nB    A    B    A\nFire, fire on the mountain\n\nJam: B  A (extended groove)'
    },
    'Bertha': {
        text: "Bertha \u2014 Key of G\n\nIntro: G  C  G  D\n\nVerse:\nG                C\nI had a hard run, running from your window\nG                D\nI was all night running\n\nChorus:\nG  C  G  D\nBertha don't you come around here anymore"
    }
};

// ============================================================================
// ACTIVATION
// ============================================================================

GLT.activate = function() {
    if (!GLT.ACTIVE) return;

    console.log('%c\uD83E\uDDEA TEST ENV ACTIVE \u2014 band: ' + GLT.BAND_SLUG,
        'color:#f59e0b;font-weight:bold;font-size:14px;background:#1a1a00;padding:4px 8px;border-radius:4px');

    // 1. Switch band slug (isolates all Firebase paths)
    if (typeof currentBandSlug !== 'undefined') currentBandSlug = GLT.BAND_SLUG;
    localStorage.setItem('deadcetera_current_band', GLT.BAND_SLUG);

    // 2. Set test user identity
    if (typeof currentUserEmail !== 'undefined') currentUserEmail = GLT.user.email;
    if (typeof currentUserName  !== 'undefined') currentUserName  = GLT.user.name;
    if (typeof isUserSignedIn   !== 'undefined') isUserSignedIn   = true;
    localStorage.setItem('deadcetera_google_email', GLT.user.email);
    localStorage.setItem('deadcetera_google_name', GLT.user.name);
    localStorage.setItem('deadcetera_current_user', GLT.user.memberKey);

    // 3. Add test_user to band members
    if (typeof bandMembers !== 'undefined' && !bandMembers.test_user) {
        bandMembers.test_user = { name: 'Test User', role: 'Rhythm Guitar' };
    }
    if (typeof BAND_MEMBERS_ORDERED !== 'undefined') {
        if (!BAND_MEMBERS_ORDERED.find(function(m) { return m.key === 'test_user'; })) {
            BAND_MEMBERS_ORDERED.push({ key: 'test_user', name: 'Test User', emoji: '\uD83E\uDDEA' });
        }
    }

    // 4. Update auth button after a tick
    setTimeout(function() {
        if (typeof updateDriveAuthButton === 'function') updateDriveAuthButton();
    }, 500);

    // 5. Visual indicator
    var ind = document.createElement('div');
    ind.id = 'glDevIndicator';
    ind.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:9999;background:#f59e0b;color:#000;font-size:11px;font-weight:800;padding:3px 8px;border-radius:4px;opacity:0.85;pointer-events:none';
    ind.textContent = '\uD83E\uDDEA DEV';
    document.body.appendChild(ind);
};

// ============================================================================
// SEED DATA
// ============================================================================

GLT.seed = async function() {
    if (!GLT.ACTIVE) { console.warn('GLT.seed() requires ?dev=true'); return; }
    if (typeof firebaseDB === 'undefined' || !firebaseDB) {
        console.warn('Firebase not ready. Try again.'); return;
    }

    console.log('%c\uD83C\uDF31 Seeding test data...', 'color:#22c55e;font-weight:bold');
    var bp = function(sub) { return 'bands/' + GLT.BAND_SLUG + '/' + sub; };
    var sfp = (typeof sanitizeFirebasePath === 'function')
        ? sanitizeFirebasePath
        : function(s) { return String(s).replace(/[.#$[\]\/]/g, '_'); };
    var updates = {};

    // Songs: readiness + charts
    GLT.TEST_SONGS.forEach(function(song) {
        var key = sfp(song.title);
        var r = GLT.TEST_READINESS[song.title];
        if (r) {
            Object.keys(r).forEach(function(mk) {
                updates['songs/' + key + '/readiness/' + mk] = r[mk];
            });
        }
        var c = GLT.TEST_CHARTS[song.title];
        if (c) {
            updates['songs/' + key + '/chart'] = c;
        }
    });

    // Master files
    updates['master/_master_readiness'] = GLT.TEST_READINESS;
    updates['master/_master_song_statuses'] = GLT.TEST_STATUSES;

    // Setlists (top-level — uses the fixed _band routing)
    updates['setlists'] = [GLT.TEST_SETLIST];

    // Custom songs
    updates['custom_songs'] = GLT.TEST_SONGS.filter(function(s) {
        return s.title === 'Test & Edge-Case Song!';
    }).map(function(s) {
        return { title: s.title, band: s.band, notes: 'QA edge case',
                 addedBy: GLT.user.email, addedAt: '2026-03-22T12:00:00Z' };
    });

    // Migration flag (prevent band-level migration from running)
    updates['_meta/band_level_migration_v1'] = {
        completedAt: new Date().toISOString(), stats: { test: true }
    };

    try {
        await firebaseDB.ref(bp('')).update(updates);
        console.log('%c\u2705 Test data seeded: ' + GLT.TEST_SONGS.length + ' songs, 1 setlist, ' +
            Object.keys(GLT.TEST_CHARTS).length + ' charts',
            'color:#22c55e;font-weight:bold');

        // Load into live caches
        if (typeof readinessCache !== 'undefined') Object.assign(readinessCache, GLT.TEST_READINESS);
        if (typeof statusCache !== 'undefined') Object.assign(statusCache, GLT.TEST_STATUSES);

        return { status: 'seeded' };
    } catch(e) {
        console.error('\u274C Seed failed:', e);
        return { status: 'error', error: e.message };
    }
};

// ============================================================================
// AUTO-SEED ON FIRST DEV LOAD
// ============================================================================

GLT.autoSeedIfNeeded = async function() {
    if (!GLT.ACTIVE || typeof firebaseDB === 'undefined' || !firebaseDB) return;
    try {
        var snap = await firebaseDB.ref('bands/' + GLT.BAND_SLUG + '/setlists').once('value');
        if (snap.val()) {
            console.log('\uD83E\uDDEA Test data present. GLT.seed() to re-seed, GLT.cleanup() to wipe.');
            if (typeof readinessCache !== 'undefined') Object.assign(readinessCache, GLT.TEST_READINESS);
            if (typeof statusCache !== 'undefined') Object.assign(statusCache, GLT.TEST_STATUSES);
            return;
        }
    } catch(e) {}
    await GLT.seed();
};

// ============================================================================
// CLEANUP + DEACTIVATE
// ============================================================================

GLT.cleanup = async function() {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) { console.warn('Firebase not ready'); return; }
    try {
        await firebaseDB.ref('bands/' + GLT.BAND_SLUG).remove();
        console.log('%c\uD83E\uDDF9 Test data cleaned', 'color:#ef4444;font-weight:bold');
    } catch(e) { console.error('Cleanup failed:', e); }
};

GLT.deactivate = function() {
    if (typeof currentBandSlug !== 'undefined') currentBandSlug = 'deadcetera';
    localStorage.setItem('deadcetera_current_band', 'deadcetera');
    localStorage.removeItem('deadcetera_current_user');
    var el = document.getElementById('glDevIndicator');
    if (el) el.remove();
    console.log('\uD83D\uDD12 Restored production mode');
};

console.log('\uD83E\uDDEA GLT loaded' + (GLT.ACTIVE ? ' \u2014 ACTIVE' : ''));
