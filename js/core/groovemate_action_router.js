/**
 * groovemate_action_router.js — GrooveMate Action Router
 *
 * Detects action intent from avatar input, validates context, routes to tools.
 * Returns structured result for avatar to display.
 *
 * DEPENDS ON: groovemate_tools.js, gl-user-identity.js
 * EXPOSES: window.GLActionRouter
 */

(function() {
  'use strict';

  // ── Intent Detection ─────────────────────────────────────────────────────

  var INTENTS = [
    { id: 'run_band_session',    keywords: ['run my band','run session','band session','run everything','full session'], priority: 12 },
    { id: 'run_rehearsal',       keywords: ['run rehearsal','run my rehearsal','start rehearsal','run this rehearsal','lead rehearsal','band leader','run through'], priority: 11 },
    { id: 'import_artist_pack',  keywords: ['import','pack','starter','essentials','add all','billy joel','elton john','grateful dead','phish','wedding','beatles'], priority: 10 },
    { id: 'bulk_add_songs',      keywords: ['add songs','add these songs','add the following','add a bunch'], priority: 9 },
    { id: 'create_setlist',      keywords: ['create setlist','make a setlist','build a setlist','new setlist','create a set'], priority: 8 },
    { id: 'add_song_to_setlist', keywords: ['add to setlist','put on the setlist','add it to the set'], priority: 7 },
    { id: 'add_song',            keywords: ['add song','add a song','add the song'], priority: 6 },
    { id: 'add_chart_note',      keywords: ['add note','add a note','note for','save note','chart note','watch the','stronger','softer','louder','remember to'], priority: 5 },
    { id: 'update_chart_sections', keywords: ['sections','add sections','section the chart','verse chorus','intro verse','structure'], priority: 4 },
    { id: 'attach_chart_source', keywords: ['attach','link','source','ultimate guitar','chart url','chart link','open source'], priority: 3 },
    { id: 'save_rehearsal_note', keywords: ['rehearsal note','session note','add rehearsal','save rehearsal'], priority: 2 },
    { id: 'import_band_type_pack', keywords: ['cover band songs','church songs','worship songs','campfire songs','wedding songs','jam band songs'], priority: 9 }
  ];

  function detectIntent(text) {
    if (!text) return null;
    var lower = text.toLowerCase();
    var best = null;
    var bestScore = 0;

    INTENTS.forEach(function(intent) {
      var score = 0;
      intent.keywords.forEach(function(kw) {
        if (lower.indexOf(kw) >= 0) score += intent.priority;
      });
      if (score > bestScore) { bestScore = score; best = intent.id; }
    });

    return best;
  }

  // ── Context Gathering ────────────────────────────────────────────────────

  function _getContext() {
    return {
      page: (typeof currentPage !== 'undefined') ? currentPage : '',
      activeSong: (typeof GLStore !== 'undefined' && GLStore.getActiveSong) ? GLStore.getActiveSong() : null,
      bandSlug: (typeof currentBandSlug !== 'undefined') ? currentBandSlug : '',
      user: (typeof GLUserIdentity !== 'undefined') ? GLUserIdentity.getContext() : {}
    };
  }

  // ── Route + Execute ──────────────────────────────────────────────────────

  async function route(text) {
    var intent = detectIntent(text);
    if (!intent) return null;

    var ctx = _getContext();
    var tools = window.GLTools;
    if (!tools) return { success: false, message: 'Action tools not available.' };

    var result;

    switch (intent) {
      case 'run_band_session':
        if (typeof GLOrchestrator !== 'undefined' && GLOrchestrator.runBandSession) {
          result = await GLOrchestrator.runBandSession();
        } else {
          result = { success: false, message: 'Session engine not loaded.' };
        }
        break;

      case 'run_rehearsal':
        var durMatch = text.match(/(\d+)\s*min/);
        result = await tools.runMyRehearsal(durMatch ? durMatch[1] : 60);
        break;

      case 'add_song':
        result = await tools.addSong(_extractSongTitle(text));
        break;

      case 'bulk_add_songs':
        result = await tools.bulkAddSongs(_extractSongList(text));
        break;

      case 'import_artist_pack':
        var packId = _detectPack(text);
        if (!packId) return { success: false, message: 'I didn\'t recognize that artist pack. Try "import Billy Joel" or "import wedding songs".' };
        result = await tools.importArtistPack(packId);
        break;

      case 'import_band_type_pack':
        var typePackId = _detectBandTypePack(text);
        if (!typePackId) return { success: false, message: 'I didn\'t recognize that song pack.' };
        result = await tools.importArtistPack(typePackId);
        break;

      case 'create_setlist':
        var slName = _extractAfter(text, ['called','named','for','create setlist','make a setlist','build a setlist']);
        result = await tools.createSetlist(slName || '');
        break;

      case 'add_song_to_setlist':
        var songForSl = _extractSongTitle(text);
        result = await tools.addSongToSetlist(songForSl);
        break;

      case 'add_chart_note':
        var noteText = _extractAfter(text, ['add note:','add a note:','note for','note:','save note:','chart note:']);
        if (!noteText) noteText = text; // use full text as note
        var noteSong = ctx.activeSong || _extractSongTitle(text);
        result = await tools.addChartNote(noteSong, noteText);
        break;

      case 'update_chart_sections':
        var sectionSong = ctx.activeSong || _extractSongTitle(text);
        result = await tools.suggestSections(sectionSong, text);
        break;

      case 'attach_chart_source':
        var url = _extractUrl(text);
        var sourceSong = ctx.activeSong || _extractSongTitle(text);
        result = await tools.attachChartSource(sourceSong, url);
        break;

      case 'save_rehearsal_note':
        var rehNote = _extractAfter(text, ['rehearsal note:','session note:','add rehearsal note:','save rehearsal note:']);
        result = await tools.saveRehearsalNote(rehNote || text);
        break;

      default:
        return null;
    }

    return result;
  }

  // ── Text Extraction Helpers ──────────────────────────────────────────────

  function _extractSongTitle(text) {
    // Try quoted title first
    var quoted = text.match(/["']([^"']+)["']/);
    if (quoted) return quoted[1];
    // Try "called X" or "named X"
    var called = text.match(/(?:called|named|for|song)\s+(.+?)(?:\s+to|\s+on|$)/i);
    if (called) return called[1].trim();
    return '';
  }

  function _extractSongList(text) {
    // Comma-separated or newline-separated
    var cleaned = text.replace(/add\s+(these\s+)?songs?:?\s*/i, '');
    return cleaned.split(/[,\n]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 1; });
  }

  function _extractAfter(text, triggers) {
    var lower = text.toLowerCase();
    for (var i = 0; i < triggers.length; i++) {
      var idx = lower.indexOf(triggers[i]);
      if (idx >= 0) return text.substring(idx + triggers[i].length).trim();
    }
    return '';
  }

  function _extractUrl(text) {
    var match = text.match(/(https?:\/\/[^\s]+)/);
    return match ? match[1] : '';
  }

  function _detectPack(text) {
    var lower = text.toLowerCase();
    var packs = {
      'billy joel': 'billy_joel', 'elton john': 'elton_john', 'elton': 'elton_john',
      'grateful dead': 'grateful_dead', 'dead': 'grateful_dead',
      'phish': 'phish', 'beatles': 'beatles',
      'wedding': 'wedding', 'dance floor': 'wedding',
      'widespread': 'wsp', 'wsp': 'wsp',
      'allman': 'allman', 'allman brothers': 'allman',
      'goose': 'goose', 'dmb': 'dmb', 'dave matthews': 'dmb',
      'campfire': 'campfire', 'acoustic': 'campfire',
      'worship': 'worship', 'church': 'worship',
      'standards': 'standards', 'jazz standards': 'standards'
    };
    for (var key in packs) {
      if (lower.indexOf(key) >= 0) return packs[key];
    }
    return null;
  }

  function _detectBandTypePack(text) {
    return _detectPack(text);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.GLActionRouter = {
    detectIntent: detectIntent,
    route: route
  };

  console.log('\uD83C\uDFAF GLActionRouter loaded');
})();
