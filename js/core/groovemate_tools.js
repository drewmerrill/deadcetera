/**
 * groovemate_tools.js — GrooveMate Deterministic Action Tools
 *
 * Each tool: validates input, performs one app action, returns result.
 * No scraping, no protected content copying.
 *
 * DEPENDS ON: firebase-service.js, ensureBandSong(), GLStore
 * EXPOSES: window.GLTools
 */

(function() {
  'use strict';

  // ── Artist Packs (curated, not scraped) ──────────────────────────────────

  var ARTIST_PACKS = {
    billy_joel: {
      name: 'Billy Joel Essentials',
      songs: ['Piano Man','Scenes from an Italian Restaurant','Vienna','Just the Way You Are','Movin\' Out','My Life','She\'s Always a Woman','Allentown','Only the Good Die Young','New York State of Mind','The Longest Time','Uptown Girl','River of Dreams']
    },
    elton_john: {
      name: 'Elton John Essentials',
      songs: ['Tiny Dancer','Rocket Man','Bennie and the Jets','Crocodile Rock','Your Song','Don\'t Let the Sun Go Down on Me','Saturday Night\'s Alright','I\'m Still Standing','Goodbye Yellow Brick Road','Candle in the Wind','Philadelphia Freedom','Daniel']
    },
    grateful_dead: {
      name: 'Grateful Dead Starter',
      songs: ['Friend of the Devil','Truckin\'','Casey Jones','Sugar Magnolia','Scarlet Begonias','Fire on the Mountain','Eyes of the World','Bertha','Althea','Touch of Grey','Jack Straw','Ripple','Uncle John\'s Band','Shakedown Street']
    },
    phish: {
      name: 'Phish Starter',
      songs: ['Bouncing Around the Room','Sample in a Jar','Down with Disease','Chalk Dust Torture','You Enjoy Myself','Fluffhead','Divided Sky','Bathtub Gin','Stash','Harry Hood','Waste','Farmhouse']
    },
    beatles: {
      name: 'Beatles Essentials',
      songs: ['Come Together','Let It Be','Hey Jude','Yesterday','Here Comes the Sun','Twist and Shout','A Hard Day\'s Night','Eleanor Rigby','Blackbird','Norwegian Wood','While My Guitar Gently Weeps','In My Life','Something','Get Back']
    },
    wedding: {
      name: 'Wedding Dance Floor',
      songs: ['Shout','September','I Gotta Feeling','Don\'t Stop Believin\'','Shut Up and Dance','Uptown Funk','Sweet Caroline','Dancing Queen','Twist and Shout','Celebration','Love Shack','Build Me Up Buttercup','Brown Eyed Girl','Crazy in Love']
    },
    wsp: {
      name: 'Widespread Panic Starter',
      songs: ['Chilly Water','Ain\'t Life Grand','Porch Song','Barstools and Dreamers','Space Wrangler','Tall Boy','Fishwater','Climb to Safety','Pigeons','Blue Indian','North']
    },
    allman: {
      name: 'Allman Brothers Starter',
      songs: ['Whipping Post','Midnight Rider','Jessica','Ramblin\' Man','Melissa','Statesboro Blues','Blue Sky','In Memory of Elizabeth Reed','Soulshine','Revival']
    },
    goose: {
      name: 'Goose Starter',
      songs: ['Rockdale','Hungersite','Arcadia','Turned Clouds','Tumble','Hot Tea','Empress of Organos','So Ready','Seekers on the Ridge','Madhuvan']
    },
    dmb: {
      name: 'Dave Matthews Band Starter',
      songs: ['Crash Into Me','Ants Marching','Satellite','Two Step','Warehouse','So Much to Say','What Would You Say','Grey Street','Don\'t Drink the Water','The Space Between']
    },
    campfire: {
      name: 'Campfire Singalongs',
      songs: ['Wagon Wheel','Country Roads','Brown Eyed Girl','Wish You Were Here','Redemption Song','Horse with No Name','Knockin\' on Heaven\'s Door','Free Fallin\'','Ring of Fire','Lean on Me','Three Little Birds','Riptide']
    },
    worship: {
      name: 'Contemporary Worship',
      songs: ['Oceans','What a Beautiful Name','Good Good Father','10,000 Reasons','Reckless Love','Way Maker','Build My Life','Great Are You Lord','King of My Heart','Here I Am to Worship','Amazing Grace','How Great Is Our God']
    },
    standards: {
      name: 'Jazz Standards',
      songs: ['Fly Me to the Moon','The Way You Look Tonight','Autumn Leaves','Blue Moon','Georgia on My Mind','Summertime','My Funny Valentine','Night and Day','All of Me','Misty','Take Five','What a Wonderful World']
    }
  };

  // ── TOOL: Add Single Song ────────────────────────────────────────────────

  async function addSong(title) {
    if (!title) return { success: false, message: 'What song should I add? Try: "add song Piano Man"' };
    if (typeof ensureBandSong === 'function') await ensureBandSong(title);
    return { success: true, message: 'Added "' + title + '" to your library.', action: 'add_song', count: 1, songs: [title] };
  }

  // ── TOOL: Bulk Add Songs ─────────────────────────────────────────────────

  async function bulkAddSongs(titles) {
    if (!titles || !titles.length) return { success: false, message: 'No songs to add.' };
    var added = 0;
    for (var i = 0; i < titles.length; i++) {
      if (titles[i] && typeof ensureBandSong === 'function') {
        await ensureBandSong(titles[i]);
        added++;
      }
    }
    return { success: true, message: 'Added ' + added + ' songs to your library.', action: 'bulk_add_songs', count: added, songs: titles };
  }

  // ── TOOL: Import Artist Pack ─────────────────────────────────────────────

  async function importArtistPack(packId) {
    var pack = ARTIST_PACKS[packId];
    if (!pack) return { success: false, message: 'Pack not found: ' + packId };

    // Add all songs to band library
    var added = 0;
    for (var i = 0; i < pack.songs.length; i++) {
      if (typeof ensureBandSong === 'function') {
        await ensureBandSong(pack.songs[i]);
        added++;
      }
    }

    // Create a starter setlist
    var setlistResult = await _createSetlistFromSongs(pack.name, pack.songs.slice(0, 10));

    return {
      success: true,
      message: 'Imported ' + added + ' songs from "' + pack.name + '"' + (setlistResult ? ' and created a starter setlist.' : '.'),
      action: 'import_artist_pack',
      count: added,
      pack: pack.name,
      songs: pack.songs,
      setlistCreated: !!setlistResult
    };
  }

  // ── TOOL: Create Setlist ─────────────────────────────────────────────────

  async function createSetlist(name) {
    var songSource = (typeof GLStore !== 'undefined' && GLStore.getSongs) ? GLStore.getSongs() : (typeof allSongs !== 'undefined' ? allSongs : []);
    var songs = songSource.slice(0, 10).map(function(s) { return s.title; });
    if (!songs.length) return { success: false, message: 'No songs in your library yet. Add some songs first.' };

    var slName = name || (localStorage.getItem('deadcetera_band_name') || 'Band') + ' Set';
    var result = await _createSetlistFromSongs(slName, songs);
    return {
      success: !!result,
      message: result ? 'Created setlist "' + slName + '" with ' + songs.length + ' songs.' : 'Failed to create setlist.',
      action: 'create_setlist',
      setlistName: slName,
      count: songs.length
    };
  }

  // ── TOOL: Add Song to Setlist ────────────────────────────────────────────

  async function addSongToSetlist(title) {
    if (!title) return { success: false, message: 'Which song should I add to the setlist?' };
    // Ensure song exists
    if (typeof ensureBandSong === 'function') await ensureBandSong(title);
    // Add to most recent setlist
    var db = _db();
    if (!db) return { success: false, message: 'Not connected.' };
    try {
      var snap = await db.ref(_bp('setlists')).once('value');
      var data = snap.val();
      var setlists = data ? (Array.isArray(data) ? data : Object.values(data)) : [];
      if (!setlists.length) return { success: false, message: 'No setlists yet. Create one first.' };
      var latest = setlists[setlists.length - 1];
      if (!latest.sets) latest.sets = [{ name: 'All Songs', songs: [] }];
      latest.sets[0].songs.push({ title: title, segue: 'stop' });
      await db.ref(_bp('setlists')).set(setlists);
      return { success: true, message: 'Added "' + title + '" to "' + (latest.name || 'setlist') + '".', action: 'add_song_to_setlist' };
    } catch(e) {
      return { success: false, message: 'Failed to add to setlist: ' + e.message };
    }
  }

  // ── TOOL: Add Chart Note ─────────────────────────────────────────────────

  async function addChartNote(songTitle, noteText) {
    if (!songTitle) return { success: false, message: 'Which song should I add the note to?' };
    if (!noteText) return { success: false, message: 'What should the note say?' };

    // Detect note type
    var noteType = 'arrangement';
    var lower = noteText.toLowerCase();
    if (lower.match(/vocal|harmony|sing|voice/)) noteType = 'vocal';
    else if (lower.match(/guitar|bass|drum|keyboard|piano|solo/)) noteType = 'instrumental';
    else if (lower.match(/transition|segue|into|between/)) noteType = 'transition';
    else if (lower.match(/louder|softer|dynamics|feel|energy/)) noteType = 'performance';

    var db = _db();
    if (!db) return { success: false, message: 'Not connected.' };

    try {
      var noteId = 'note_' + Date.now().toString(36);
      var note = {
        id: noteId,
        text: noteText,
        type: noteType,
        author: (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getFirstName() || 'GrooveMate' : 'GrooveMate',
        createdAt: new Date().toISOString(),
        source: 'groovemate'
      };

      var songKey = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/\[\]]/g, '_');
      await db.ref(_bp('songs/' + songKey + '/chart_notes/' + noteId)).set(note);

      // Also add as overlay note if charts module available
      if (typeof addOverlayNote === 'function') {
        addOverlayNote(songTitle, noteText);
      }

      return { success: true, message: 'Saved note to "' + songTitle + '" chart (' + noteType + ').', action: 'add_chart_note', song: songTitle, noteType: noteType };
    } catch(e) {
      return { success: false, message: 'Failed to save note: ' + e.message };
    }
  }

  // ── TOOL: Suggest Chart Sections ─────────────────────────────────────────

  async function suggestSections(songTitle, inputText) {
    if (!songTitle) return { success: false, message: 'Which song should I section?' };

    var STANDARD_SECTIONS = ['Intro','Verse','Pre-Chorus','Chorus','Bridge','Solo','Interlude','Outro','Breakdown','Jam','Tag','Coda'];

    // Extract sections from input or generate standard structure
    var sections = [];
    var lower = (inputText || '').toLowerCase();
    STANDARD_SECTIONS.forEach(function(s) {
      if (lower.indexOf(s.toLowerCase()) >= 0) sections.push(s);
    });

    // Default structure if none detected
    if (sections.length === 0) {
      sections = ['Intro','Verse','Chorus','Verse','Chorus','Bridge','Chorus','Outro'];
    }

    var db = _db();
    if (!db) return { success: false, message: 'Not connected.' };

    try {
      var songKey = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/\[\]]/g, '_');
      var sectionData = sections.map(function(s, i) { return { label: s, order: i }; });
      await db.ref(_bp('songs/' + songKey + '/metadata/structure')).set({ sections: sectionData, updatedAt: new Date().toISOString(), source: 'groovemate' });
      return { success: true, message: 'Set ' + sections.length + ' sections for "' + songTitle + '": ' + sections.join(' \u2192 '), action: 'update_chart_sections', song: songTitle, sections: sections };
    } catch(e) {
      return { success: false, message: 'Failed to save sections: ' + e.message };
    }
  }

  // ── TOOL: Attach Chart Source Link ───────────────────────────────────────

  async function attachChartSource(songTitle, url) {
    if (!songTitle) return { success: false, message: 'Which song should I attach the link to?' };
    if (!url) return { success: false, message: 'What\'s the URL? Try: "attach https://..." ' };

    var db = _db();
    if (!db) return { success: false, message: 'Not connected.' };

    // Detect source label from URL
    var label = 'Chart Source';
    if (url.indexOf('ultimate-guitar') >= 0 || url.indexOf('tabs.ultimate') >= 0) label = 'Ultimate Guitar';
    else if (url.indexOf('chordify') >= 0) label = 'Chordify';
    else if (url.indexOf('songsterr') >= 0) label = 'Songsterr';
    else if (url.indexOf('musescore') >= 0) label = 'MuseScore';
    else if (url.indexOf('youtube') >= 0 || url.indexOf('youtu.be') >= 0) label = 'YouTube';
    else if (url.indexOf('drive.google') >= 0) label = 'Google Drive';

    try {
      var songKey = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/\[\]]/g, '_');
      await db.ref(_bp('songs/' + songKey + '/chart_source')).set({
        url: url,
        label: label,
        addedAt: new Date().toISOString(),
        addedBy: 'groovemate'
      });

      // Also save via charts module if available
      if (typeof saveChartUrl === 'function') saveChartUrl(songTitle, url);

      return { success: true, message: 'Attached ' + label + ' link to "' + songTitle + '".', action: 'attach_chart_source', song: songTitle, label: label };
    } catch(e) {
      return { success: false, message: 'Failed to attach link: ' + e.message };
    }
  }

  // ── TOOL: Save Rehearsal Note ────────────────────────────────────────────

  async function saveRehearsalNote(noteText) {
    if (!noteText) return { success: false, message: 'What should the rehearsal note say?' };

    var db = _db();
    if (!db) return { success: false, message: 'Not connected.' };

    try {
      var noteId = 'rn_' + Date.now().toString(36);
      var note = {
        id: noteId,
        text: noteText,
        author: (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getFirstName() || 'Unknown' : 'Unknown',
        createdAt: new Date().toISOString(),
        source: 'groovemate'
      };
      await db.ref(_bp('rehearsal_notes/' + noteId)).set(note);
      return { success: true, message: 'Saved rehearsal note.', action: 'save_rehearsal_note' };
    } catch(e) {
      return { success: false, message: 'Failed to save note: ' + e.message };
    }
  }

  // ── Internal Helpers ─────────────────────────────────────────────────────

  function _db() { return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null; }
  function _bp(path) { return (typeof bandPath === 'function') ? bandPath(path) : 'bands/unknown/' + path; }

  async function _createSetlistFromSongs(name, songTitles) {
    var db = _db();
    if (!db || !songTitles.length) return null;

    var setlist = {
      setlistId: (typeof generateShortId === 'function') ? generateShortId(12) : Date.now().toString(36),
      name: name,
      date: new Date().toISOString().split('T')[0],
      sets: [{ name: 'All Songs', songs: songTitles.map(function(t) { return { title: t, segue: 'stop' }; }) }],
      created: new Date().toISOString(),
      notes: 'Created by GrooveMate'
    };

    try {
      var snap = await db.ref(_bp('setlists')).once('value');
      var existing = snap.val() ? (Array.isArray(snap.val()) ? snap.val() : Object.values(snap.val())) : [];
      existing.push(setlist);
      await db.ref(_bp('setlists')).set(existing);
      return setlist;
    } catch(e) {
      console.error('[GLTools] Create setlist failed:', e.message);
      return null;
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.GLTools = {
    addSong: addSong,
    bulkAddSongs: bulkAddSongs,
    importArtistPack: importArtistPack,
    createSetlist: createSetlist,
    addSongToSetlist: addSongToSetlist,
    addChartNote: addChartNote,
    suggestSections: suggestSections,
    attachChartSource: attachChartSource,
    saveRehearsalNote: saveRehearsalNote,
    getAvailablePacks: function() { return Object.keys(ARTIST_PACKS).map(function(k) { return { id: k, name: ARTIST_PACKS[k].name, count: ARTIST_PACKS[k].songs.length }; }); }
  };

  console.log('\uD83D\uDEE0 GLTools loaded (' + Object.keys(ARTIST_PACKS).length + ' artist packs)');
})();
