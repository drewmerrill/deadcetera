// ============================================================================
// js/core/gl-audio-session.js — Unified audio workspace per song
//
// Single source of truth for stem playback / mixing / future recording. Phase A
// scope: track-list merging + canonical stem order. The Stems lens reads from
// this module so that LALAL lead+backing automatically appears alongside
// Demucs drums/bass/guitar/keys/other without duplicating the vocals row.
//
// Phase B (next) will move WebAudio nodes + state (volume, pan, mute, solo,
// playhead) into here too, so Harmony Lab and a future record mode all
// operate on the same in-memory state instead of cloning audio chains.
//
// Public API (Phase A):
//   GLAudioSession.mergeTracks(demucs, lalalSplit) → ordered Track[]
//   GLAudioSession.STEM_ORDER                     → canonical row order
//
// Track shape:
//   { id, label, color, icon, url, source: 'demucs'|'lalal', kind }
//
// EXPOSES: window.GLAudioSession
// ============================================================================

'use strict';

window.GLAudioSession = (function() {

  // Canonical mixer order — left to right / top to bottom in any UI.
  // Lead + backing slot in where Demucs's vocals used to be, so the visual
  // order stays consistent whether or not LALAL has run.
  var STEM_ORDER = ['drums', 'bass', 'guitar', 'piano', 'lead', 'backing', 'vocals', 'other'];

  // Visual + semantic metadata per stem id. `kind` lets future record-mode
  // decide which stems are "vocal-shaped" (default-mute when recording over)
  // vs "instrumental-shaped" (default-keep).
  var STEM_DEFS = {
    drums:   { label: 'Drums',   color: '#f59e0b', icon: '🥁', kind: 'instrument' },
    bass:    { label: 'Bass',    color: '#10b981', icon: '🎸', kind: 'instrument' },
    guitar:  { label: 'Guitar',  color: '#ef4444', icon: '🎸', kind: 'instrument' },
    piano:   { label: 'Keys',    color: '#06b6d4', icon: '🎹', kind: 'instrument' },
    lead:    { label: 'Lead',    color: '#818cf8', icon: '🎤', kind: 'vocal_lead' },
    backing: { label: 'Backing', color: '#a78bfa', icon: '🎶', kind: 'vocal_backing' },
    vocals:  { label: 'Vocals',  color: '#818cf8', icon: '🎤', kind: 'vocal_full' },
    other:   { label: 'Other',   color: '#94a3b8', icon: '🎵', kind: 'instrument' }
  };

  // Build the canonical track list from a song's Demucs (`stems`) record and
  // optional LALAL (`lalal_split`) record. When LALAL is present, its lead +
  // backing replace Demucs's combined vocals row — that's the entire point of
  // running LALAL. Single source of truth: no UI should hand-merge these
  // anywhere else.
  function mergeTracks(demucs, lalalSplit) {
    var demucsStems = (demucs && demucs.stems) || {};
    var lalalStems = (lalalSplit && lalalSplit.stems) || null;
    var tracks = [];

    // Cache-bust suffix per separation event so a stale R2 cache entry can't
    // poison the WebAudio chain (LALAL ships with Cache-Control: immutable).
    var demucsBust = demucs && demucs.separatedAt
      ? '?v=' + new Date(demucs.separatedAt).getTime() : '';
    var lalalBust = lalalSplit && lalalSplit.separatedAt
      ? '?v=' + new Date(lalalSplit.separatedAt).getTime() : '';

    STEM_ORDER.forEach(function(id) {
      // LALAL lead/backing override Demucs vocals.
      if (id === 'lead' && lalalStems && lalalStems.lead) {
        tracks.push(_makeTrack(id, lalalStems.lead, 'lalal', lalalBust));
        return;
      }
      if (id === 'backing' && lalalStems && lalalStems.backing) {
        tracks.push(_makeTrack(id, lalalStems.backing, 'lalal', lalalBust));
        return;
      }
      // Skip the Demucs combined-vocals row when LALAL has produced finer
      // lead+backing splits — the user already has both above.
      if (id === 'vocals' && lalalStems && lalalStems.lead) return;

      // Demucs row when present.
      if (demucsStems[id]) {
        tracks.push(_makeTrack(id, demucsStems[id], 'demucs', demucsBust));
      }
    });

    return tracks;
  }

  function _makeTrack(id, url, source, bust) {
    var def = STEM_DEFS[id] || { label: id, color: '#94a3b8', icon: '🎵', kind: 'instrument' };
    return {
      id: id,
      label: def.label,
      color: def.color,
      icon: def.icon,
      kind: def.kind,
      url: url + (bust || ''),
      rawUrl: url,
      source: source
    };
  }

  // Are LALAL stems present? Used by UIs that want to surface "→ Generate
  // Harmonies" affordance only when there's nothing yet.
  function hasLalalSplit(lalalSplit) {
    return !!(lalalSplit && lalalSplit.stems && lalalSplit.stems.lead);
  }

  return {
    STEM_ORDER: STEM_ORDER,
    STEM_DEFS: STEM_DEFS,
    mergeTracks: mergeTracks,
    hasLalalSplit: hasLalalSplit
  };

})();

console.log('🎚 gl-audio-session.js loaded');
