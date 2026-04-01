#!/usr/bin/env node
/**
 * migrate-songs-v2.js — Song Data Consolidation Migration
 *
 * Reads ALL song data from both legacy (songs/{title}) and new (songs_v2/{songId})
 * Firebase paths, merges them (v2 takes precedence), and writes complete records
 * to songs_v2/{songId}.
 *
 * IDEMPOTENT: safe to run multiple times. Only writes if data would change.
 *
 * Usage:
 *   This script is designed to run IN THE BROWSER console (not Node.js)
 *   because it needs access to the Firebase connection.
 *
 *   Copy the runMigration() function and paste it into the browser console
 *   on the GrooveLinx app page (must be signed in).
 *
 * What it does:
 *   1. Reads bands/{slug}/songs/ (all legacy data)
 *   2. Reads bands/{slug}/songs_v2/ (all v2 data)
 *   3. For each song in allSongs:
 *      - Finds legacy data by sanitized title
 *      - Finds v2 data by songId
 *      - Merges: v2 fields take precedence over legacy
 *      - Extracts: key, bpm, lead, structure, status
 *      - Writes complete record to songs_v2/{songId}
 *   4. Reports: migrated, skipped, conflicts
 */

// Paste this entire function into the browser console:
window.runSongMigration = async function(dryRun) {
    if (typeof dryRun === 'undefined') dryRun = true;
    console.log('=== SONG DATA MIGRATION ' + (dryRun ? '(DRY RUN)' : '(LIVE)') + ' ===');

    var db = (typeof firebaseDB !== 'undefined') ? firebaseDB : null;
    if (!db) { console.error('Firebase not ready'); return; }

    var slug = (typeof currentBandSlug !== 'undefined') ? currentBandSlug : 'deadcetera';
    var bp = 'bands/' + slug + '/';

    // 1. Load all data
    console.log('Loading legacy songs/...');
    var legacySnap = await db.ref(bp + 'songs').once('value');
    var legacyData = legacySnap.val() || {};
    console.log('  Found', Object.keys(legacyData).length, 'legacy song nodes');

    console.log('Loading songs_v2/...');
    var v2Snap = await db.ref(bp + 'songs_v2').once('value');
    var v2Data = v2Snap.val() || {};
    console.log('  Found', Object.keys(v2Data).length, 'v2 song nodes');

    // 2. Build sanitized title → legacy data map
    var sanitize = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath : function(s) { return s.replace(/[.#$/\[\]]/g, '_'); };
    var legacyByTitle = {};
    Object.keys(legacyData).forEach(function(k) { legacyByTitle[k] = legacyData[k]; });

    // 3. Process each song
    var stats = { total: 0, migrated: 0, skipped: 0, noData: 0, conflicts: [] };
    var writes = {};

    (typeof allSongs !== 'undefined' ? allSongs : []).forEach(function(song) {
        if (!song || !song.title) return;
        stats.total++;

        var songId = song.songId;
        if (!songId) {
            console.warn('  SKIP (no songId):', song.title);
            stats.skipped++;
            return;
        }

        var titleKey = sanitize(song.title);
        var legacy = legacyByTitle[titleKey] || legacyByTitle[song.title] || {};
        var v2 = v2Data[songId] || {};

        // Extract fields from legacy (multiple format variants)
        var legacyKey = null;
        if (legacy.key && typeof legacy.key === 'object' && legacy.key.key) legacyKey = legacy.key.key;
        else if (legacy.key && typeof legacy.key === 'string') legacyKey = legacy.key;
        else if (legacy.song_key && typeof legacy.song_key === 'object') legacyKey = legacy.song_key.key || null;
        else if (legacy.song_key && typeof legacy.song_key === 'string') legacyKey = legacy.song_key;

        var legacyBpm = null;
        if (legacy.song_bpm && typeof legacy.song_bpm === 'object') legacyBpm = legacy.song_bpm.bpm || null;
        else if (legacy.bpm) legacyBpm = legacy.bpm;

        var legacyLead = null;
        if (legacy.lead_singer && typeof legacy.lead_singer === 'object') legacyLead = legacy.lead_singer.singer || null;
        else if (legacy.lead_singer && typeof legacy.lead_singer === 'string') legacyLead = legacy.lead_singer;

        var legacyStructure = null;
        if (legacy.song_structure && typeof legacy.song_structure === 'object' && legacy.song_structure.sections) {
            legacyStructure = legacy.song_structure;
        }

        var legacyStatus = null;
        if (legacy.song_status && typeof legacy.song_status === 'object') legacyStatus = legacy.song_status.status || null;
        else if (legacy.song_status && typeof legacy.song_status === 'string') legacyStatus = legacy.song_status;

        // Extract fields from v2
        var v2Key = v2.key ? (typeof v2.key === 'object' ? v2.key.key || v2.key : v2.key) : null;
        var v2Bpm = v2.song_bpm ? (typeof v2.song_bpm === 'object' ? v2.song_bpm.bpm || v2.song_bpm : v2.song_bpm) : (v2.bpm || null);
        var v2Lead = v2.lead_singer ? (typeof v2.lead_singer === 'object' ? v2.lead_singer.singer || null : v2.lead_singer) : null;
        var v2Structure = v2.song_structure || null;
        var v2Status = v2.song_status ? (typeof v2.song_status === 'object' ? v2.song_status.status : v2.song_status) : null;

        // Merge: v2 takes precedence
        var finalKey = v2Key || legacyKey;
        var finalBpm = v2Bpm || legacyBpm;
        var finalLead = v2Lead || legacyLead;
        var finalStructure = v2Structure || legacyStructure;
        var finalStatus = v2Status || legacyStatus;

        if (!finalKey && !finalBpm && !finalLead && !finalStructure && !finalStatus) {
            stats.noData++;
            return;
        }

        // Build canonical v2 record
        var record = {};
        if (finalKey) record.key = { key: finalKey, updatedAt: new Date().toISOString(), source: 'migration' };
        if (finalBpm) record.song_bpm = { bpm: Number(finalBpm), updatedAt: new Date().toISOString(), source: 'migration' };
        if (finalLead) record.lead_singer = { singer: finalLead, updatedAt: new Date().toISOString(), source: 'migration' };
        if (finalStructure) record.song_structure = finalStructure;
        if (finalStatus) record.song_status = { status: finalStatus, updatedAt: new Date().toISOString(), source: 'migration' };

        // Check for conflicts (v2 and legacy both have data but differ)
        if (v2Key && legacyKey && v2Key !== legacyKey) {
            stats.conflicts.push({ song: song.title, field: 'key', v2: v2Key, legacy: legacyKey, used: v2Key });
        }
        if (v2Bpm && legacyBpm && String(v2Bpm) !== String(legacyBpm)) {
            stats.conflicts.push({ song: song.title, field: 'bpm', v2: v2Bpm, legacy: legacyBpm, used: v2Bpm });
        }

        writes[songId] = record;
        stats.migrated++;
    });

    // 4. Report
    console.log('\n=== MIGRATION SUMMARY ===');
    console.log('Total songs:', stats.total);
    console.log('Will migrate:', stats.migrated);
    console.log('Skipped (no songId):', stats.skipped);
    console.log('No data (empty):', stats.noData);
    console.log('Conflicts:', stats.conflicts.length);
    if (stats.conflicts.length) {
        console.table(stats.conflicts);
    }

    // Sample output
    var sampleKeys = Object.keys(writes).slice(0, 3);
    sampleKeys.forEach(function(k) {
        console.log('\nSample:', k);
        console.log(JSON.stringify(writes[k], null, 2));
    });

    // 5. Write (if not dry run)
    if (dryRun) {
        console.log('\n⚠️  DRY RUN — no data written. Call runSongMigration(false) to execute.');
        return { stats: stats, writes: writes };
    }

    console.log('\nWriting', Object.keys(writes).length, 'records to songs_v2/...');
    var writeCount = 0;
    var writeKeys = Object.keys(writes);
    for (var i = 0; i < writeKeys.length; i++) {
        var wk = writeKeys[i];
        try {
            // Use update (not set) to preserve existing v2 data we're not touching
            await db.ref(bp + 'songs_v2/' + wk).update(writes[wk]);
            writeCount++;
        } catch(e) {
            console.error('  WRITE FAILED:', wk, e.message);
        }
    }
    console.log('✅ Written', writeCount, '/', writeKeys.length, 'records');

    // 6. Verify
    console.log('\nVerifying...');
    var v2After = await db.ref(bp + 'songs_v2').once('value');
    var v2AfterData = v2After.val() || {};
    var v2Count = Object.keys(v2AfterData).length;
    var withKey = 0, withBpm = 0, withLead = 0;
    Object.values(v2AfterData).forEach(function(d) {
        if (d.key) withKey++;
        if (d.song_bpm) withBpm++;
        if (d.lead_singer) withLead++;
    });
    console.log('songs_v2 total:', v2Count);
    console.log('  with key:', withKey);
    console.log('  with bpm:', withBpm);
    console.log('  with lead:', withLead);

    return { stats: stats, writes: writes, verification: { total: v2Count, withKey: withKey, withBpm: withBpm, withLead: withLead } };
};

console.log('Migration script loaded. Run: runSongMigration() for dry run, runSongMigration(false) to execute.');
