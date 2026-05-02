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

  // Build the canonical track list from a song's Demucs (`stems`) record,
  // optional LALAL (`lalal_split`) record, and any Phase 2 spatial-split
  // records. When LALAL is present, its lead + backing replace Demucs's
  // combined vocals row. When a spatial-split exists for a stem, the
  // children appear *immediately after* the parent stem (or replace it,
  // depending on the record's `replace_parent` flag — defaults to false so
  // the parent remains visible for A/B comparison).
  //
  // mergeTracks(demucs, lalalSplit, spatialSplits?)
  //   demucs: stems band-data record  (or null)
  //   lalalSplit: lalal_split record  (or null)
  //   spatialSplits: array of spatial_split records (or null)
  function mergeTracks(demucs, lalalSplit, spatialSplits) {
    var demucsStems = (demucs && demucs.stems) || {};
    var lalalStems = (lalalSplit && lalalSplit.stems) || null;
    var splits = Array.isArray(spatialSplits) ? spatialSplits : [];
    var tracks = [];

    var demucsBust = demucs && demucs.separatedAt
      ? '?v=' + new Date(demucs.separatedAt).getTime() : '';
    var lalalBust = lalalSplit && lalalSplit.separatedAt
      ? '?v=' + new Date(lalalSplit.separatedAt).getTime() : '';

    // Index spatial splits by their parent stem id for O(1) lookup
    var splitByParent = {};
    splits.forEach(function(rec) {
      if (rec && rec.sourceStemId) splitByParent[rec.sourceStemId] = rec;
    });

    STEM_ORDER.forEach(function(id) {
      // LALAL lead/backing override Demucs vocals.
      if (id === 'lead' && lalalStems && lalalStems.lead) {
        tracks.push(_makeTrack(id, lalalStems.lead, 'lalal', lalalBust));
        _appendSpatialChildren(tracks, splitByParent[id], id);
        return;
      }
      if (id === 'backing' && lalalStems && lalalStems.backing) {
        tracks.push(_makeTrack(id, lalalStems.backing, 'lalal', lalalBust));
        _appendSpatialChildren(tracks, splitByParent[id], id);
        return;
      }
      if (id === 'vocals' && lalalStems && lalalStems.lead) return;

      if (demucsStems[id]) {
        var split = splitByParent[id];
        var hide = split && split.replaceParent === true;
        if (!hide) {
          tracks.push(_makeTrack(id, demucsStems[id], 'demucs', demucsBust));
        }
        _appendSpatialChildren(tracks, split, id);
      }
    });

    return tracks;
  }

  // Append spatial-split child rows after their parent. Each child gets a
  // synthetic id like 'other__left_lead' so audio nodes don't collide.
  function _appendSpatialChildren(tracks, splitRec, parentId) {
    if (!splitRec || !splitRec.stems) return;
    var bust = splitRec.separatedAt
      ? '?v=' + new Date(splitRec.separatedAt).getTime() : '';
    Object.keys(splitRec.stems).forEach(function(childName) {
      var url = splitRec.stems[childName];
      if (!url) return;
      var id = parentId + '__' + childName;
      var label = _spatialChildLabel(parentId, childName, splitRec);
      var color = _spatialChildColor(parentId, childName);
      var icon = '↳';  // visually anchor as a child row
      tracks.push({
        id: id,
        label: label,
        color: color,
        icon: icon,
        kind: 'spatial_child',
        url: url + bust,
        rawUrl: url,
        source: 'spatial',
        parentId: parentId,
        childName: childName
      });
    });
  }

  function _spatialChildLabel(parentId, childName, splitRec) {
    var parentDef = STEM_DEFS[parentId];
    var parentLabel = parentDef ? parentDef.label : parentId;
    // If the user named a fingerprint reference for this child window, surface
    // that — "Other → Jerry" reads better than "Other → left_lead".
    var win = (splitRec && splitRec.panWindows || []).filter(function(w) {
      return w && w.name === childName;
    })[0];
    if (win && win.fingerprint_ref) return parentLabel + ' → ' + win.fingerprint_ref;
    var pretty = childName.replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); });
    return parentLabel + ' → ' + pretty;
  }

  function _spatialChildColor(parentId, childName) {
    if (childName.indexOf('left') !== -1) return '#f59e0b';   // amber-left
    if (childName.indexOf('right') !== -1) return '#22d3ee';  // cyan-right
    if (childName.indexOf('center') !== -1) return '#a78bfa'; // violet-center
    var parentDef = STEM_DEFS[parentId];
    return parentDef ? parentDef.color : '#94a3b8';
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

  function hasLalalSplit(lalalSplit) {
    return !!(lalalSplit && lalalSplit.stems && lalalSplit.stems.lead);
  }

  // True if any spatial-split children exist for this stem id.
  function hasSpatialSplitFor(spatialSplits, stemId) {
    if (!Array.isArray(spatialSplits) || !stemId) return false;
    return spatialSplits.some(function(r) { return r && r.sourceStemId === stemId; });
  }

  return {
    STEM_ORDER: STEM_ORDER,
    STEM_DEFS: STEM_DEFS,
    mergeTracks: mergeTracks,
    hasLalalSplit: hasLalalSplit,
    hasSpatialSplitFor: hasSpatialSplitFor
  };

})();

console.log('🎚 gl-audio-session.js loaded');
