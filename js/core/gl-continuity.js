// =============================================================================
// js/core/gl-continuity.js — Phase 3F Continuity Heuristics
//
// Pure functions for continuity reasoning on an analyzer-emitted segment list.
// The analyzer treats each segment in isolation; this module asks the
// follow-up question: "given the neighbors, does this boundary actually
// represent a real song break?"
//
// Design rules (per Phase 3F spec):
//   - No analyzer rewrite. This is a post-processing pass over the
//     segment array, run BEFORE Take normalization.
//   - Conservative by default. Only HIGH-safety merges apply automatically.
//     Lower-confidence suggestions surface in calibration mode without
//     touching segments.
//   - Human-corrected segments are SACRED. Caller passes
//     `opts.protectedSegmentIds` (a {segId: true} set) and we skip them.
//   - Observation-first. Every suggestion has a `kind`, a `reason`, and
//     evidence segment ids — so calibration mode and Benchmark snapshots
//     can show what changed and why.
//   - No giant scoring system. Each heuristic is a small predicate. Hard
//     thresholds are exposed in CONFIG so Drew can tune them after seeing
//     5/11 behavior.
//
// Heuristics shipped this pass:
//   H1 adjacent_same_song      — same song_title, gap ≤ 30s → MERGE
//   H2 short_gap_continuation  — gap < 10s + matching top suggestion → MERGE
//   H3 restart_loop            — two unresolved, gap ≤ 90s, shared top-2 → MERGE
//                                (gated behind opts.aggressive)
//   H4 weak_boundary_suppression — boundary_confidence==inferred + small gap
//                                + matching identity → MERGE
//                                (gated behind opts.aggressive)
//   H5 confidence_downgrade    — segment near continuity ambiguity but stamped
//                                'high' → recommend downgrade to 'medium'
//                                (suggestion only, never auto-applied yet)
//
// Returns:
//   evaluate(segments) -> { segments (unchanged), suggestions: [...] }
//   apply(segments, suggestions, opts) -> mergedSegments
//
// Suggestion shape:
//   {
//     kind: string,              // see heuristic list above
//     reason: string,            // short human-readable explanation
//     evidence_seg_ids: [...],   // segments involved
//     safety: 'high' | 'medium', // 'high' auto-applies; 'medium' opt-in
//     action: 'merge' | 'downgrade_confidence'
//   }
// =============================================================================

(function () {
  'use strict';

  var CONFIG = {
    // H1 adjacent_same_song
    same_song_max_gap_sec: 30,
    // H2 short_gap_continuation
    short_gap_max_sec: 10,
    // H3 restart_loop
    restart_max_gap_sec: 90,
    restart_min_shared_suggestions: 2,
    // H4 weak_boundary_suppression
    weak_boundary_max_gap_sec: 20,
    // H5 confidence_downgrade
    downgrade_ambiguity_window_sec: 120
  };

  function _segGap(prev, cur) {
    if (!prev || !cur) return Infinity;
    return Math.max(0, (cur.startSec || 0) - (prev.endSec || 0));
  }

  function _topTitles(seg, n) {
    var m = (seg && seg.matching) || {};
    var arr = (m.top_suggestions || []).map(function (s) { return s && s.title; }).filter(Boolean);
    return n ? arr.slice(0, n) : arr;
  }

  function _sharedTitles(a, b) {
    var setB = {};
    (b || []).forEach(function (t) { setB[t] = 1; });
    var hits = 0;
    (a || []).forEach(function (t) { if (setB[t]) hits++; });
    return hits;
  }

  function _identityOf(seg) {
    // The most-confident identity claim for a segment, used as the merge
    // join key. song_id wins; falls back to song_title; falls back to top-1
    // suggestion when both are absent.
    if (!seg) return null;
    if (seg.song_id) return 'sid:' + seg.song_id;
    if (seg.songTitle) return 'title:' + seg.songTitle;
    var top = _topTitles(seg, 1)[0];
    return top ? 'top:' + top : null;
  }

  function _isMusicBearing(seg) {
    var t = (seg && (seg.type || seg.segType)) || 'song';
    return t !== 'talking' && t !== 'speech' && t !== 'discussion' &&
           t !== 'ignore' && t !== 'false_start';
  }

  // ── Heuristic evaluation ────────────────────────────────────────────────
  function evaluate(segments) {
    if (!Array.isArray(segments) || segments.length < 2) {
      return { segments: segments || [], suggestions: [] };
    }
    var sorted = segments.slice().sort(function (a, b) {
      return (a.startSec || 0) - (b.startSec || 0);
    });
    var suggestions = [];

    for (var i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var cur = sorted[i];
      if (!_isMusicBearing(prev) || !_isMusicBearing(cur)) continue;

      var gap = _segGap(prev, cur);
      var prevIdent = _identityOf(prev);
      var curIdent = _identityOf(cur);
      var prevTops = _topTitles(prev, 3);
      var curTops = _topTitles(cur, 3);

      // H1: adjacent same song
      if (prevIdent && curIdent && prevIdent === curIdent &&
          (prev.song_id || prev.songTitle) && gap <= CONFIG.same_song_max_gap_sec) {
        suggestions.push({
          kind: 'adjacent_same_song',
          reason: 'same song ' + (prev.songTitle || prev.song_id) + ' with ' + Math.round(gap) + 's gap',
          evidence_seg_ids: [prev.id, cur.id],
          safety: 'high',
          action: 'merge'
        });
        continue;
      }

      // H2: short gap continuation (top-1 of cur matches prev identity)
      if (prevIdent && curTops.length && gap < CONFIG.short_gap_max_sec) {
        var prevTitle = prev.songTitle || prevTops[0];
        if (prevTitle && curTops[0] === prevTitle) {
          suggestions.push({
            kind: 'short_gap_continuation',
            reason: 'gap ' + Math.round(gap) + 's + matching top suggestion: ' + prevTitle,
            evidence_seg_ids: [prev.id, cur.id],
            safety: 'high',
            action: 'merge'
          });
          continue;
        }
      }

      // H3: restart loop (both unresolved, share top suggestions)
      var prevUnresolved = !prev.song_id && !prev.songTitle;
      var curUnresolved = !cur.song_id && !cur.songTitle;
      if (prevUnresolved && curUnresolved && gap <= CONFIG.restart_max_gap_sec &&
          prevTops.length >= 2 && curTops.length >= 2) {
        var shared = _sharedTitles(prevTops.slice(0, 3), curTops.slice(0, 3));
        if (shared >= CONFIG.restart_min_shared_suggestions) {
          suggestions.push({
            kind: 'restart_loop',
            reason: shared + ' shared top suggestions across unresolved adjacent takes',
            evidence_seg_ids: [prev.id, cur.id],
            safety: 'medium',
            action: 'merge'
          });
          continue;
        }
      }

      // H4: weak boundary suppression
      if (cur.boundary_confidence === 'inferred' && gap < CONFIG.weak_boundary_max_gap_sec &&
          prevIdent && curIdent && prevIdent === curIdent) {
        suggestions.push({
          kind: 'weak_boundary_suppression',
          reason: 'inferred boundary + ' + Math.round(gap) + 's gap + identity match',
          evidence_seg_ids: [prev.id, cur.id],
          safety: 'medium',
          action: 'merge'
        });
        continue;
      }
    }

    // H5: confidence downgrade — flag segments that are stamped 'high' but
    // have an adjacent same-identity segment within the ambiguity window.
    // Surfacing-only — never auto-applied this phase.
    for (var j = 0; j < sorted.length; j++) {
      var s = sorted[j];
      if (!s || !_isMusicBearing(s)) continue;
      var m = s.matching || {};
      if (m.confidence !== 'high') continue;
      var ident = _identityOf(s);
      if (!ident) continue;
      var ambiguous = false;
      var rep = null;
      for (var k = 0; k < sorted.length; k++) {
        if (k === j) continue;
        var other = sorted[k];
        if (!other || !_isMusicBearing(other)) continue;
        var oIdent = _identityOf(other);
        var sep = Math.abs((other.startSec || 0) - (s.startSec || 0));
        if (oIdent === ident && sep <= CONFIG.downgrade_ambiguity_window_sec) {
          ambiguous = true; rep = other.id; break;
        }
      }
      if (ambiguous) {
        suggestions.push({
          kind: 'confidence_downgrade',
          reason: 'adjacent same-identity segment within ' + CONFIG.downgrade_ambiguity_window_sec + 's — confidence too brittle',
          evidence_seg_ids: [s.id, rep],
          safety: 'medium',
          action: 'downgrade_confidence'
        });
      }
    }

    // Phase 3G: stamp canonical pair_key + gap_sec on every suggestion so
    // downstream authority decisions and UI lineage can address suggestions
    // by stable identity.
    suggestions.forEach(function (sug) {
      sug.pair_key = pairKeyForEvidence(sug.evidence_seg_ids);
      if (!sug.hasOwnProperty('gap_sec')) {
        var evid = sug.evidence_seg_ids || [];
        if (evid.length === 2) {
          var a = null, b = null;
          for (var ii = 0; ii < sorted.length; ii++) {
            if (sorted[ii].id === evid[0]) a = sorted[ii];
            else if (sorted[ii].id === evid[1]) b = sorted[ii];
            if (a && b) break;
          }
          if (a && b) sug.gap_sec = _segGap(a, b);
        }
      }
    });

    return { segments: sorted, suggestions: suggestions };
  }

  // ── Conservative applier ────────────────────────────────────────────────
  // Walks the suggestion list and folds eligible merges into the segment
  // array. Defaults to high-safety only. `opts.aggressive` opts into
  // medium-safety merges. `opts.protectedSegmentIds` shields human-corrected
  // segments from any modification.
  //
  // Idempotent: re-applying the same suggestions to the post-merge array
  // produces the same array.
  function apply(segments, suggestions, opts) {
    opts = opts || {};
    if (!Array.isArray(segments) || !segments.length) return segments || [];
    if (!Array.isArray(suggestions) || !suggestions.length) return segments;

    var protectedIds = opts.protectedSegmentIds || {};
    var aggressive = !!opts.aggressive;
    // Phase 3G: respect analyst authority. skipPairKeys is a {pairKey: true}
    // map of evidence pairs the analyst has marked "keep separate".
    // ignoredKinds is a {kind: true} map of suggestion kinds the analyst
    // told the heuristic to stop firing for this rehearsal.
    var skipPairKeys = opts.skipPairKeys || {};
    var ignoredKinds = opts.ignoredKinds || {};

    var allowed = suggestions.filter(function (sug) {
      if (sug.action !== 'merge') return false;
      if (sug.safety === 'medium' && !aggressive) return false;
      if (ignoredKinds[sug.kind]) return false;
      var pk = sug.pair_key || pairKeyForEvidence(sug.evidence_seg_ids);
      if (pk && skipPairKeys[pk]) return false;
      var evid = sug.evidence_seg_ids || [];
      for (var i = 0; i < evid.length; i++) {
        if (protectedIds[evid[i]]) return false;
      }
      return true;
    });
    if (!allowed.length) return segments;

    // Group merges by transitive closure — overlapping merges should
    // collapse to one combined merge instead of fighting each other.
    var parent = {};
    function _find(x) {
      while (parent[x] !== undefined && parent[x] !== x) {
        parent[x] = parent[parent[x]] !== undefined ? parent[parent[x]] : parent[x];
        x = parent[x];
      }
      return x;
    }
    function _union(a, b) {
      var ra = _find(a), rb = _find(b);
      if (ra === rb) return;
      // Lower id wins as canonical root for stability
      if (ra < rb) parent[rb] = ra; else parent[ra] = rb;
    }
    allowed.forEach(function (sug) {
      var evid = sug.evidence_seg_ids || [];
      for (var i = 0; i < evid.length; i++) parent[evid[i]] = parent[evid[i]] !== undefined ? parent[evid[i]] : evid[i];
      for (var j = 1; j < evid.length; j++) _union(evid[0], evid[j]);
    });

    // Build merged segments, preserving the first segment in each group
    // as the canonical record; absorbing the rest's duration + raw_markers.
    var sorted = segments.slice().sort(function (a, b) {
      return (a.startSec || 0) - (b.startSec || 0);
    });
    var groupMap = {}; // segId → groupId
    sorted.forEach(function (s) {
      if (!s || !s.id) return;
      if (parent[s.id] === undefined) { groupMap[s.id] = s.id; return; }
      groupMap[s.id] = _find(s.id);
    });

    var byGroup = {};
    var groupOrder = [];
    sorted.forEach(function (s) {
      if (!s) return;
      var gid = groupMap[s.id] || s.id;
      if (!byGroup[gid]) {
        var clone = Object.assign({}, s);
        clone.raw_markers = Array.isArray(s.raw_markers) ? s.raw_markers.slice() : [];
        byGroup[gid] = { anchor: clone, members: [s] };
        groupOrder.push(gid);
      } else {
        var bucket = byGroup[gid];
        bucket.members.push(s);
        bucket.anchor.endSec = Math.max(bucket.anchor.endSec || 0, s.endSec || 0);
        bucket.anchor.duration = (bucket.anchor.endSec || 0) - (bucket.anchor.startSec || 0);
        if (!bucket.anchor.songTitle && s.songTitle) bucket.anchor.songTitle = s.songTitle;
        if (!bucket.anchor.song_id && s.song_id) bucket.anchor.song_id = s.song_id;
        var add = Array.isArray(s.raw_markers) ? s.raw_markers : [];
        for (var ri = 0; ri < add.length; ri++) bucket.anchor.raw_markers.push(add[ri]);
        // boundary_confidence: a merged segment's effective boundary is the
        // STRONGEST of its constituents (the merge swallowed the weak ones).
        bucket.anchor.boundary_confidence = _strongerBoundary(bucket.anchor.boundary_confidence, s.boundary_confidence);
        // Phase 3F: short-form provenance list. Kept for backward compatibility.
        if (!bucket.anchor._continuity_merged_from) bucket.anchor._continuity_merged_from = [];
        bucket.anchor._continuity_merged_from.push(s.id);
      }
    });

    // Phase 3G: stamp rich provenance on each merged anchor so the take
    // record can carry it forward. Walks the allowed suggestion list and
    // attaches the ones whose evidence touched this group's anchor.
    groupOrder.forEach(function (gid) {
      var bucket = byGroup[gid];
      var anchor = bucket.anchor;
      var memberIds = {};
      bucket.members.forEach(function (m) { if (m && m.id) memberIds[m.id] = true; });
      var attached = [];
      allowed.forEach(function (sug) {
        var evid = sug.evidence_seg_ids || [];
        var touchesGroup = false;
        for (var i = 0; i < evid.length; i++) {
          if (memberIds[evid[i]]) { touchesGroup = true; break; }
        }
        if (!touchesGroup) return;
        attached.push({
          kind: sug.kind,
          reason: sug.reason,
          evidence_seg_ids: evid,
          safety: sug.safety,
          pair_key: sug.pair_key || pairKeyForEvidence(evid),
          gap_sec: typeof sug.gap_sec === 'number' ? Math.round(sug.gap_sec) : null
        });
      });
      if (attached.length || (anchor._continuity_merged_from || []).length) {
        anchor._continuity_provenance = {
          merged_seg_ids: (anchor._continuity_merged_from || []).slice(),
          applied: attached
        };
      }
    });

    return groupOrder.map(function (g) { return byGroup[g].anchor; });
  }

  function _strongerBoundary(a, b) {
    var rank = { hard: 3, soft: 2, inferred: 1 };
    var ra = rank[a] || 0, rb = rank[b] || 0;
    return ra >= rb ? (a || b || null) : b;
  }

  // Phase 3G: canonical pair key for analyst authority decisions. Sorting
  // makes A↔B and B↔A produce the same key so a "Keep Separate" decision
  // is direction-agnostic.
  function pairKeyForEvidence(evidenceSegIds) {
    if (!Array.isArray(evidenceSegIds) || !evidenceSegIds.length) return '';
    var sorted = evidenceSegIds.slice().filter(Boolean).sort();
    return sorted.join('|');
  }

  // ── Summary helpers for calibration UI ──────────────────────────────────
  function bucketSuggestions(suggestions) {
    var out = { adjacent_same_song: 0, short_gap_continuation: 0, restart_loop: 0,
                weak_boundary_suppression: 0, confidence_downgrade: 0 };
    (suggestions || []).forEach(function (s) {
      if (!s || !s.kind) return;
      if (out[s.kind] !== undefined) out[s.kind]++;
    });
    return out;
  }

  function countApplied(suggestions, aggressive) {
    return (suggestions || []).filter(function (s) {
      if (!s || s.action !== 'merge') return false;
      return s.safety === 'high' || (aggressive && s.safety === 'medium');
    }).length;
  }

  // ── Wire to window ──────────────────────────────────────────────────────
  window.GLContinuity = {
    CONFIG:               CONFIG,
    evaluate:             evaluate,
    apply:                apply,
    bucketSuggestions:    bucketSuggestions,
    countApplied:         countApplied,
    pairKeyForEvidence:   pairKeyForEvidence
  };

  console.log('✅ GLContinuity initialised');
})();
