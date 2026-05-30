// =============================================================================
// js/core/gl-annotations.js — Phase 1 of the Annotation primitive
//
// Canonical store for the Annotation entity defined in
// 02_GrooveLinx/specs/rehearsal_song_dna_relationship_model.md §1.5.
//
// One primitive replaces (eventually) the five+ scattered note storage paths
// (chart_overlay_notes, rehearsal_notes, gig_notes, personal_critique,
// stem_critique_notes, best_shot_section_notes, rehearsal_sessions/comments).
// Phase 1 ships only the primitive + ONE proof-point surface (Song Detail).
// Legacy note paths remain untouched until later phases migrate them.
//
// Storage:
//   bands/{slug}/annotations/{annotationId}
//
// Shape (per spec):
//   {
//     id: string,
//     text: string,
//     anchor: {
//       kind: 'song' | 'rehearsal' | 'recording' | 'take' | 'timestamp'
//             | 'chart' | 'section' | 'stem',
//       song_id?, rehearsal_id?, recording_id?, take_id?,
//       timestamp_sec?, section_name?, chart_line?, stem_id?
//     },
//     tagged_members: string[],   // memberKeys — attention/visibility, NOT ownership
//     author: string,             // memberKey of writer
//     created_at: number,         // ms
//     updated_at: number,         // ms
//     status: 'open' | 'in_progress' | 'fixed' | 'recheck',
//     archived: boolean,          // soft-delete (records stay queryable)
//     task_id?: string            // optional promotion to TaskItem (Phase 4)
//   }
//
// Founder decisions baked in:
//   - tagged_members is attention only; ownership comes via promote-to-task
//   - status defaults to 'open' on create
//   - archived defaults to false (only true on explicit archiveAnnotation)
//
// Indexing: deliberately none yet. Firebase RTDB load-all-and-filter is fine
// at MVP scale. Add an index when annotations/song or annotations/member
// query latency becomes visible.
//
// ── Memory Hardening Phase 1 (2026-05-30) ────────────────────────────────────
// Promotion provenance added per memory_hardening_phase_1_implementation_design_v1.md
// with corrections from memory_hardening_phase_1_verification_audit_v1.md.
//
// New optional fields (write-once via promoteToMemory only, immutable thereafter):
//   promoted              boolean
//   promoted_by           string (memberKey at promotion)
//   promoted_at           number (ms timestamp)
//   promoted_from         string[] (source IDs supporting promotion)
//   promotion_authority   { memberKey, role, permissions[], snapshot_at, auth_version }
//
// auth_version: 'phase1' on every Phase 1 promotion honestly records that
// authority was NOT enforced at the data layer. Phase 2 bumps to 'phase2'
// once the Authority fragmentation P0 resolves and rules can enforce.
//
// New API:
//   GLAnnotations.promoteToMemory(id, {evidence, authority?})  → write-once promotion
//   GLAnnotations.auditProvenance({songId?, includeArchived?, refresh?}) → trust-layer audit
//
// updateAnnotation now WARNS (not errors) when callers pass promotion fields.
// The existing whitelist drops them by construction; the warn surfaces the
// caller mistake. promoteToMemory is the only canonical write path for
// promotion fields. Data-layer immutability is enforced by Firebase rules
// (Console deploy — see 02_GrooveLinx/docs/memory-hardening-phase-1-deploy.md).
// =============================================================================

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────
  var STATUSES = ['open', 'in_progress', 'fixed', 'recheck'];
  var ANCHOR_KINDS = ['song', 'rehearsal', 'recording', 'take', 'timestamp', 'chart', 'section', 'stem'];

  // ── In-memory cache (per session) ─────────────────────────────────────────
  // Loaded once on first read; refreshed on every mutation so subsequent
  // reads see local writes immediately. Other tabs / band members get the
  // update on their next read — no realtime listener yet (Phase 1 keeps it
  // simple; revisit if multi-user concurrency surfaces an issue).
  var _cache = null;          // map of id → annotation
  var _cacheLoadedAt = 0;     // ms timestamp
  var _loadInFlight = null;   // Promise-coalescing flag

  // ── Internal helpers ──────────────────────────────────────────────────────
  function _db() {
    return (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
  }

  function _path(suffix) {
    if (typeof bandPath !== 'function') return null;
    return bandPath('annotations' + (suffix ? '/' + suffix : ''));
  }

  function _author() {
    if (typeof getCurrentMemberKey === 'function') {
      var k = getCurrentMemberKey();
      if (k) return k;
    }
    if (typeof currentUserEmail !== 'undefined' && currentUserEmail) {
      return currentUserEmail.split('@')[0];
    }
    return 'unknown';
  }

  function _normalizeAnchor(anchor) {
    var a = anchor || {};
    if (!a.kind || ANCHOR_KINDS.indexOf(a.kind) === -1) {
      throw new Error('[GLAnnotations] anchor.kind required, must be one of: ' + ANCHOR_KINDS.join('|'));
    }
    var out = { kind: a.kind };
    ['song_id', 'rehearsal_id', 'recording_id', 'take_id', 'section_name', 'chart_line', 'stem_id'].forEach(function (f) {
      if (a[f] != null && a[f] !== '') out[f] = a[f];
    });
    if (typeof a.timestamp_sec === 'number' && !isNaN(a.timestamp_sec)) {
      out.timestamp_sec = a.timestamp_sec;
    }
    return out;
  }

  function _normalizeStatus(s) {
    if (!s) return 'open';
    if (STATUSES.indexOf(s) === -1) {
      console.warn('[GLAnnotations] unknown status "' + s + '", defaulting to open');
      return 'open';
    }
    return s;
  }

  function _ensureLoaded(force) {
    if (!force && _cache && (Date.now() - _cacheLoadedAt) < 60000) {
      return Promise.resolve(_cache);
    }
    if (_loadInFlight) return _loadInFlight;
    var db = _db();
    var p = _path('');
    if (!db || !p) {
      _cache = {};
      _cacheLoadedAt = Date.now();
      return Promise.resolve(_cache);
    }
    _loadInFlight = db.ref(p).once('value').then(function (snap) {
      _cache = snap.val() || {};
      _cacheLoadedAt = Date.now();
      _loadInFlight = null;
      return _cache;
    }).catch(function (err) {
      console.warn('[GLAnnotations] load failed:', err && err.message);
      _loadInFlight = null;
      _cache = _cache || {};
      return _cache;
    });
    return _loadInFlight;
  }

  function _matchesAnchor(annotation, filter) {
    if (!filter) return true;
    var a = annotation && annotation.anchor;
    if (!a) return false;
    var keys = Object.keys(filter);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (a[k] !== filter[k]) return false;
    }
    return true;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  // Create — minimal required: text + anchor.kind + at least one anchor target
  function createAnnotation(input) {
    input = input || {};
    var text = (input.text || '').trim();
    if (!text) return Promise.reject(new Error('[GLAnnotations] text required'));
    var anchor = _normalizeAnchor(input.anchor);
    var now = Date.now();
    var annotation = {
      id: '',                  // filled in after push()
      text: text,
      anchor: anchor,
      tagged_members: Array.isArray(input.tagged_members) ? input.tagged_members.slice() : [],
      author: input.author || _author(),
      created_at: now,
      updated_at: now,
      status: _normalizeStatus(input.status),
      archived: false
    };
    if (input.task_id) annotation.task_id = input.task_id;

    var db = _db();
    var p = _path('');
    if (!db || !p) return Promise.reject(new Error('[GLAnnotations] firebase not ready'));

    var ref = db.ref(p).push();
    annotation.id = ref.key;
    return ref.set(annotation).then(function () {
      // Hot-cache the new write so reads don't have to wait for refetch
      if (_cache) _cache[annotation.id] = annotation;
      return annotation;
    });
  }

  // Update — patch existing fields; updated_at always bumps
  function updateAnnotation(id, patch) {
    if (!id) return Promise.reject(new Error('[GLAnnotations] id required'));
    patch = patch || {};

    // Phase 1 hardening (2026-05-30): promotion fields are write-once via
    // promoteToMemory(). The whitelist below already drops them; the warn
    // surfaces caller mistakes that would otherwise be silent.
    if ('promoted' in patch || 'promoted_by' in patch || 'promoted_at' in patch ||
        'promoted_from' in patch || 'promotion_authority' in patch) {
      console.warn('[GLAnnotations] Promotion fields cannot be modified via updateAnnotation. Use promoteToMemory() instead. Dropping: promoted/promoted_by/promoted_at/promoted_from/promotion_authority.');
    }

    var db = _db();
    var p = _path(id);
    if (!db || !p) return Promise.reject(new Error('[GLAnnotations] firebase not ready'));

    var safe = {};
    if (typeof patch.text === 'string') safe.text = patch.text.trim();
    if (patch.anchor) safe.anchor = _normalizeAnchor(patch.anchor);
    if (Array.isArray(patch.tagged_members)) safe.tagged_members = patch.tagged_members.slice();
    if (patch.status) safe.status = _normalizeStatus(patch.status);
    if (typeof patch.archived === 'boolean') safe.archived = patch.archived;
    if (typeof patch.task_id === 'string' || patch.task_id === null) safe.task_id = patch.task_id;
    safe.updated_at = Date.now();

    return db.ref(p).update(safe).then(function () {
      if (_cache && _cache[id]) {
        Object.keys(safe).forEach(function (k) { _cache[id][k] = safe[k]; });
      }
      return _cache ? _cache[id] : null;
    });
  }

  // Archive — soft delete; record remains queryable
  function archiveAnnotation(id) {
    return updateAnnotation(id, { archived: true });
  }

  // Unarchive — defensive helper for accidental archives
  function unarchiveAnnotation(id) {
    return updateAnnotation(id, { archived: false });
  }

  // List — generic query by anchor filter (e.g. {kind: 'song', song_id: 'X'})
  function listAnnotationsByAnchor(anchorFilter, opts) {
    opts = opts || {};
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var a = cache[id];
        if (!a) return;
        if (a.archived && !opts.includeArchived) return;
        if (!_matchesAnchor(a, anchorFilter)) return;
        out.push(a);
      });
      // Newest first by default — matches reverse-chron expectation
      out.sort(function (x, y) { return (y.created_at || 0) - (x.created_at || 0); });
      return out;
    });
  }

  // List — by song. Most common Phase 1 query. songId may be a real songs_v2
  // id OR a song title string during the migration window — callers pass
  // whatever identifier they already have for the song.
  function listAnnotationsBySong(songId, opts) {
    if (!songId) return Promise.resolve([]);
    return listAnnotationsByAnchor({ song_id: songId }, opts);
  }

  // List — annotations where memberKey is in tagged_members. Used by the
  // future "My Issues" surface; exposed in Phase 1 so the data contract is
  // stable before the UI ships.
  function listAnnotationsForMember(memberKey, opts) {
    opts = opts || {};
    if (!memberKey) return Promise.resolve([]);
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var out = [];
      Object.keys(cache).forEach(function (id) {
        var a = cache[id];
        if (!a) return;
        if (a.archived && !opts.includeArchived) return;
        var tagged = Array.isArray(a.tagged_members) ? a.tagged_members : [];
        if (tagged.indexOf(memberKey) === -1) return;
        out.push(a);
      });
      out.sort(function (x, y) { return (y.created_at || 0) - (x.created_at || 0); });
      return out;
    });
  }

  function listOpenAnnotationsForMember(memberKey, opts) {
    return listAnnotationsForMember(memberKey, opts).then(function (rows) {
      return rows.filter(function (a) { return (a.status || 'open') === 'open' || a.status === 'in_progress' || a.status === 'recheck'; });
    });
  }

  // Force-refresh helper — call after a write that bypassed our writers
  // (e.g. a future migration script). Phase 1 callers shouldn't need this.
  function refreshCache() {
    return _ensureLoaded(true);
  }

  // ── Memory Hardening Phase 1 ──────────────────────────────────────────────

  // Single canonical promotion pathway. Writes the five promotion provenance
  // fields exactly once per annotation. Rejects on re-promotion attempts
  // (idempotency by-design — silent re-promote would mask logic errors).
  //
  // Required: options.evidence (array of source IDs supporting the claim).
  // Optional: options.authority (snapshot fields; falls back to _author()).
  //
  // Phase 1 does NOT enforce authority server-side. Every promotion records
  // auth_version: 'phase1' so future audits can re-review this cohort once
  // Phase 2 ships authority enforcement.
  function promoteToMemory(annotationId, options) {
    if (!annotationId) return Promise.reject(new Error('[GLAnnotations] annotationId required'));
    options = options || {};
    if (!Array.isArray(options.evidence)) {
      return Promise.reject(new Error('[GLAnnotations] options.evidence required (array of source IDs; may be empty but discouraged)'));
    }
    var db = _db();
    var p = _path(annotationId);
    if (!db || !p) return Promise.reject(new Error('[GLAnnotations] firebase not ready'));

    return _ensureLoaded().then(function (cache) {
      var existing = cache && cache[annotationId];
      if (!existing) {
        return Promise.reject(new Error('[GLAnnotations] annotation ' + annotationId + ' not found'));
      }
      if (existing.promoted === true) {
        return Promise.reject(new Error(
          '[GLAnnotations] annotation ' + annotationId + ' already promoted at ' +
          existing.promoted_at + ' by ' + existing.promoted_by + ' — re-promotion is not permitted'
        ));
      }

      var auth = options.authority || {};
      var now = Date.now();
      var promotedBy = auth.memberKey || _author();
      var promotionAuthority = {
        memberKey: promotedBy,
        role: auth.role || 'member',
        permissions: Array.isArray(auth.permissions) ? auth.permissions.slice() : [],
        snapshot_at: now,
        auth_version: 'phase1'
      };

      var patch = {
        promoted: true,
        promoted_by: promotedBy,
        promoted_at: now,
        promoted_from: options.evidence.slice(),
        promotion_authority: promotionAuthority,
        updated_at: now
      };

      return db.ref(p).update(patch).then(function () {
        if (_cache && _cache[annotationId]) {
          Object.keys(patch).forEach(function (k) { _cache[annotationId][k] = patch[k]; });
        }
        return _cache ? _cache[annotationId] : null;
      });
    });
  }

  // Provenance integrity audit. Read-only. Surfaces issues; does NOT remediate
  // (auto-remediation = AI authoring Memory state = trust-layer violation).
  //
  // Issue categories:
  //   missing      — promoted=true but a required provenance field is absent
  //   invalid      — present but malformed (e.g. promoted_at in the future)
  //   inconsistent — self-contradictory (e.g. promoted_by != authority.memberKey)
  //
  // Returns: { scannedCount, promotedCount, unpromotedCount, issues, generatedAt }
  function auditProvenance(opts) {
    opts = opts || {};
    return _ensureLoaded(opts.refresh).then(function (cache) {
      var report = {
        scannedCount: 0,
        promotedCount: 0,
        unpromotedCount: 0,
        issues: { missing: [], invalid: [], inconsistent: [] },
        generatedAt: Date.now()
      };
      var now = Date.now();

      Object.keys(cache).forEach(function (id) {
        var a = cache[id];
        if (!a) return;
        if (a.archived && !opts.includeArchived) return;
        if (opts.songId) {
          var sid = a.anchor && a.anchor.song_id;
          if (sid !== opts.songId) return;
        }
        report.scannedCount++;
        if (a.promoted !== true) { report.unpromotedCount++; return; }
        report.promotedCount++;

        // ── Missing ───────────────────────────────────────────────────────
        if (!a.promoted_by) {
          report.issues.missing.push({
            annotationId: id, issueType: 'missing_promoted_by',
            detail: 'promoted=true but promoted_by is absent', severity: 'high'
          });
        }
        if (typeof a.promoted_at !== 'number') {
          report.issues.missing.push({
            annotationId: id, issueType: 'missing_promoted_at',
            detail: 'promoted=true but promoted_at is absent or not a number', severity: 'high'
          });
        }
        if (!Array.isArray(a.promoted_from)) {
          report.issues.missing.push({
            annotationId: id, issueType: 'missing_promoted_from',
            detail: 'promoted_from is not an array', severity: 'medium'
          });
        } else if (a.promoted_from.length === 0) {
          report.issues.missing.push({
            annotationId: id, issueType: 'missing_promoted_from',
            detail: 'promoted_from is empty (no supporting evidence captured)', severity: 'medium'
          });
        }
        if (!a.promotion_authority || typeof a.promotion_authority !== 'object') {
          report.issues.missing.push({
            annotationId: id, issueType: 'missing_promotion_authority',
            detail: 'promotion_authority is absent or not an object', severity: 'high'
          });
        }

        // ── Invalid ───────────────────────────────────────────────────────
        if (typeof a.promoted_at === 'number') {
          if (a.promoted_at > now + 5000) {
            report.issues.invalid.push({
              annotationId: id, issueType: 'invalid_promoted_at_future',
              detail: 'promoted_at is in the future (' + new Date(a.promoted_at).toISOString() + ')',
              severity: 'medium'
            });
          }
          if (typeof a.created_at === 'number' && a.promoted_at < a.created_at) {
            report.issues.invalid.push({
              annotationId: id, issueType: 'invalid_promoted_at_pre_creation',
              detail: 'promoted_at (' + a.promoted_at + ') is before created_at (' + a.created_at + ') — impossible',
              severity: 'high'
            });
          }
        }
        if (a.promotion_authority && typeof a.promotion_authority === 'object') {
          var pa = a.promotion_authority;
          if (!pa.memberKey || typeof pa.snapshot_at !== 'number' || !pa.auth_version) {
            report.issues.invalid.push({
              annotationId: id, issueType: 'invalid_promotion_authority',
              detail: 'promotion_authority missing required sub-fields (memberKey/snapshot_at/auth_version)',
              severity: 'high'
            });
          }
        }

        // ── Inconsistent ──────────────────────────────────────────────────
        if (a.promotion_authority && typeof a.promotion_authority === 'object') {
          var pa2 = a.promotion_authority;
          if (a.promoted_by && pa2.memberKey && a.promoted_by !== pa2.memberKey) {
            report.issues.inconsistent.push({
              annotationId: id, issueType: 'promoted_by_mismatch',
              detail: 'promoted_by (' + a.promoted_by + ') !== promotion_authority.memberKey (' + pa2.memberKey + ')',
              severity: 'high'
            });
          }
          if (typeof a.promoted_at === 'number' && typeof pa2.snapshot_at === 'number') {
            var drift = Math.abs(a.promoted_at - pa2.snapshot_at);
            if (drift > 60000) {
              report.issues.inconsistent.push({
                annotationId: id, issueType: 'promoted_at_snapshot_drift',
                detail: 'promoted_at and promotion_authority.snapshot_at differ by ' + Math.round(drift / 1000) + 's',
                severity: 'low'
              });
            }
          }
          if (pa2.auth_version && pa2.auth_version !== 'phase1' && pa2.auth_version !== 'phase2') {
            report.issues.inconsistent.push({
              annotationId: id, issueType: 'auth_version_unknown',
              detail: 'auth_version "' + pa2.auth_version + '" is not phase1 or phase2',
              severity: 'medium'
            });
          }
        }
      });

      return report;
    });
  }

  // ── Wire to window ────────────────────────────────────────────────────────
  window.GLAnnotations = {
    // CRUD
    createAnnotation:              createAnnotation,
    updateAnnotation:              updateAnnotation,
    archiveAnnotation:             archiveAnnotation,
    unarchiveAnnotation:           unarchiveAnnotation,
    // Queries
    listAnnotationsByAnchor:       listAnnotationsByAnchor,
    listAnnotationsBySong:         listAnnotationsBySong,
    listAnnotationsForMember:      listAnnotationsForMember,
    listOpenAnnotationsForMember:  listOpenAnnotationsForMember,
    // Memory Hardening Phase 1 (2026-05-30)
    promoteToMemory:               promoteToMemory,
    auditProvenance:               auditProvenance,
    // Cache control
    refreshCache:                  refreshCache,
    // Constants exposed for UI consumers
    STATUSES:                      STATUSES,
    ANCHOR_KINDS:                  ANCHOR_KINDS
  };

  console.log('✅ GLAnnotations initialised (Memory Hardening Phase 1)');
})();
