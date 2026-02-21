// ============================================================================
// ONE-TIME MIGRATION: Google Drive → Firebase
// Run this in the browser console ONCE while signed into the OLD version
// ============================================================================

(async function migrateToFirebase() {
    console.log('🔥 Starting Google Drive → Firebase migration...');
    
    const FIREBASE_CONFIG = {
        apiKey: "REDACTED",
        authDomain: "deadcetera-35424.firebaseapp.com",
        databaseURL: "https://deadcetera-35424-default-rtdb.firebaseio.com",
        projectId: "deadcetera-35424",
        storageBucket: "deadcetera-35424.firebasestorage.app",
        messagingSenderId: "218400123401",
        appId: "1:218400123401:web:7f64ad84231dcaba6966d8"
    };
    
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = url;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    
    function sanitize(str) {
        return str.replace(/[.#$\[\]\/]/g, '_');
    }
    
    // Load Firebase
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    console.log('✅ Firebase connected');
    
    // Step 1: Migrate master files
    console.log('\n📋 Step 1: Migrating master files...');
    const masterFiles = ['_master_song_statuses.json', '_master_harmonies.json', '_master_activity_log.json'];
    for (const fileName of masterFiles) {
        try {
            const data = await loadMasterFile(fileName);
            if (data) {
                await db.ref(`master/${sanitize(fileName.replace('.json', ''))}`).set(data);
                console.log(`  ✅ ${fileName}`);
            } else {
                console.log(`  ⏭️ ${fileName} - empty`);
            }
        } catch (e) {
            console.log(`  ❌ ${fileName}:`, e.message);
        }
    }
    
    // Step 2: Migrate all files from Metadata folder
    console.log('\n📋 Step 2: Migrating Metadata folder...');
    const metadataFolderId = '1L6eRsjDDVsU2ExAar468a2L3hJxMYg4r';
    let allFiles = [];
    let pageToken = null;
    
    do {
        const res = await gapi.client.drive.files.list({
            q: `'${metadataFolderId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name)',
            spaces: 'drive', pageSize: 100, pageToken: pageToken
        });
        allFiles = allFiles.concat(res.result.files);
        pageToken = res.result.nextPageToken;
    } while (pageToken);
    
    console.log(`  Found ${allFiles.length} files`);
    let migrated = 0;
    
    for (const file of allFiles) {
        if (file.name.startsWith('_master_')) continue;
        try {
            const nameNoExt = file.name.replace('.json', '');
            const lastUnderscore = nameNoExt.lastIndexOf('_');
            if (lastUnderscore === -1) continue;
            
            // Try to find the dataType by looking for known types
            let songTitle, dataType;
            const knownTypes = ['harmonies_data', 'has_harmonies', 'lead_singer', 'song_status', 
                'song_bpm', 'practice_tracks', 'rehearsal_notes', 'spotify_versions', 
                'song_structure', 'personal_tabs', 'moises_stems', 'gig_notes',
                'harmony_audio_section_0', 'harmony_audio_section_1', 'harmony_audio_section_2',
                'abc_section_0', 'abc_section_1', 'abc_section_2',
                'harmony_metadata'];
            
            let found = false;
            for (const type of knownTypes) {
                if (nameNoExt.endsWith('_' + type)) {
                    dataType = type;
                    songTitle = nameNoExt.substring(0, nameNoExt.length - type.length - 1);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Fallback: last underscore split
                dataType = nameNoExt.substring(lastUnderscore + 1);
                songTitle = nameNoExt.substring(0, lastUnderscore);
            }
            
            const response = await gapi.client.drive.files.get({ fileId: file.id, alt: 'media' });
            await db.ref(`songs/${sanitize(songTitle)}/${sanitize(dataType)}`).set(response.result);
            migrated++;
            
            if (migrated % 10 === 0) console.log(`  📊 ${migrated}/${allFiles.length}...`);
        } catch (e) {
            console.log(`  ❌ ${file.name}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 50));
    }
    
    // Step 3: Migrate localStorage audio
    console.log('\n📋 Step 3: Migrating localStorage audio...');
    for (const key of Object.keys(localStorage)) {
        if (!key.startsWith('deadcetera_harmony_audio_')) continue;
        try {
            const match = key.match(/^deadcetera_harmony_audio_(.+?)_section(\d+)$/);
            if (!match) continue;
            const [, songTitle, idx] = match;
            const data = JSON.parse(localStorage.getItem(key));
            if (data && data.length > 0) {
                await db.ref(`songs/${sanitize(songTitle)}/harmony_audio_section_${idx}`).set(data);
                console.log(`  ✅ Audio: ${songTitle} section ${idx}`);
            }
        } catch (e) {}
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log(`🔥 MIGRATION COMPLETE!`);
    console.log(`  ${migrated} Drive files migrated to Firebase`);
    console.log('  You can now deploy the Firebase version of app.js');
    console.log('═══════════════════════════════════════');
})();
