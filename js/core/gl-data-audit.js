// ── Gig / Setlist / Calendar Data Model Audit + Migration ────────────────────
//
// Four console-driven debug surfaces for diagnosing and repairing the gig ↔
// setlist ↔ calendar-event linkage that was migrated to ID-based references.
// All four operate on Drive-backed data (loadBandDataFromDrive / saveBandDataToDrive)
// and report extensively to the console.
//
//   1. auditGigSetlistLinks() — read-only diagnostic. Lists gigs linked to
//      blank auto-created setlists and suggests better matches by confidence.
//
//   2. migrateGigSetlistIds(opts) — repair pass. Backfills gigId / setlistId,
//      relinks blanks above the confidence threshold, removes orphan blanks.
//      Default dryRun: true.
//
//   3. repairBadLinks(opts) — targeted repair for cross-year/cross-venue
//      link drift. Nulls out bad setlistId on gigs whose setlist disagrees
//      on date or venue. Default dryRun: true.
//
//   4. postMigrationAudit() — read-only post-state report (link table,
//      suspicious records, duplicate targets, known case, orphan setlists,
//      recoverability assessment).
//
// LOAD ORDER: must come after groovelinx_store.js (uses
// GLStore.clearGigsCache / clearSetlistCache after live writes). Globals
// loadBandDataFromDrive / saveBandDataToDrive / toArray / generateShortId
// are looked up via typeof at call time.
//
// Zero closure-private state. Zero events. None of these run on boot —
// they're explicitly invoked from the browser console.
//
// EXTRACTED 2026-05-08 from groovelinx_store.js (P1.1 phase 15) — ~750 lines.
// Largest single extraction of the session. Local copies of the four
// matching helpers (_normStr / _slSongCount / _isBlankSetlist / _findBestSetlist)
// stay module-private — gl-locations.js has its own _normStr for venue
// fuzzy-matching; drift between the copies is harmless.

(function() {
  'use strict';

  function _gl() { return (typeof window !== 'undefined' && window.GLStore) ? window.GLStore : null; }

  function _clearGigsCache() {
    var GL = _gl();
    if (GL && GL.clearGigsCache) GL.clearGigsCache();
  }

  function _clearSetlistCache() {
    var GL = _gl();
    if (GL && GL.clearSetlistCache) GL.clearSetlistCache();
  }

  function _toArray(x) {
    return (typeof toArray !== 'undefined') ? toArray(x) : (Array.isArray(x) ? x : []);
  }

  // ── Matching helpers ──

  /** Normalize a string for fuzzy matching: lowercase, trim, strip accents/punctuation */
  function _normStr(s) {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim()
      .replace(/['‘’"“”.,!?&()]/g, '')
      .replace(/\btheatre\b/g, 'theater')
      .replace(/\s+/g, ' ')
      .replace(/^the /, '');
  }

  function _slSongCount(sl) {
    var count = 0;
    (sl.sets || []).forEach(function(set) { count += (set.songs || []).length; });
    return count;
  }

  function _isBlankSetlist(sl) {
    return _slSongCount(sl) === 0;
  }

  /**
   * Multi-signal matcher: find the best existing setlist for a gig.
   * Returns { setlist, confidence, reason } or null.
   *
   * Signals (in priority order):
   *  1. Exact gig.linkedSetlist name match → confidence 100
   *  2. Normalized name match → confidence 95
   *  3. Date + venueId match → confidence 95
   *  4. Date + exact venue text match → confidence 90
   *  5. Date + normalized venue text match → confidence 85
   *  6. Date-only match (single candidate with songs) → confidence 70
   *  7. Date-only match (multiple candidates) → confidence 40 (review)
   */
  function _findBestSetlist(gig, setlists) {
    var candidates = [];

    for (var i = 0; i < setlists.length; i++) {
      var sl = setlists[i];
      var hasSongs = _slSongCount(sl) > 0;

      if (gig.linkedSetlist && sl.name && sl.name === gig.linkedSetlist) {
        return { setlist: sl, confidence: 100, reason: 'exact name match: "' + sl.name + '"' };
      }

      if (gig.linkedSetlist && sl.name && _normStr(sl.name) === _normStr(gig.linkedSetlist)) {
        return { setlist: sl, confidence: 95, reason: 'normalized name match: "' + sl.name + '"' };
      }

      if (sl.date && gig.date && sl.date === gig.date) {
        var venueScore = 0;
        if (gig.venueId && sl.venueId && gig.venueId === sl.venueId) {
          venueScore = 95;
        }
        else if (sl.venue && gig.venue) {
          if (sl.venue === gig.venue) venueScore = 90;
          else if (_normStr(sl.venue) === _normStr(gig.venue)) venueScore = 85;
        }
        if (gig.venueId && sl.venueId && gig.venueId !== sl.venueId && venueScore > 0) {
          venueScore = Math.max(0, venueScore - 50);
        }
        candidates.push({ setlist: sl, venueScore: venueScore, hasSongs: hasSongs });
      }
    }

    var venueMatches = candidates.filter(function(c) { return c.venueScore > 0; });
    venueMatches.sort(function(a, b) {
      if (b.venueScore !== a.venueScore) return b.venueScore - a.venueScore;
      return (_slSongCount(b.setlist) - _slSongCount(a.setlist));
    });
    if (venueMatches.length > 0) {
      var best = venueMatches[0];
      return { setlist: best.setlist, confidence: best.venueScore, reason: 'date+venue: "' + best.setlist.name + '"' };
    }

    var withSongs = candidates.filter(function(c) { return c.hasSongs; });
    if (withSongs.length === 1) {
      return { setlist: withSongs[0].setlist, confidence: 70, reason: 'date-only (sole candidate with songs): "' + withSongs[0].setlist.name + '"' };
    }
    if (withSongs.length > 1) {
      withSongs.sort(function(a, b) { return _slSongCount(b.setlist) - _slSongCount(a.setlist); });
      return { setlist: withSongs[0].setlist, confidence: 40, reason: 'date-only (ambiguous, ' + withSongs.length + ' candidates): "' + withSongs[0].setlist.name + '"' };
    }

    return null;
  }

  // ── Public API ──

  /**
   * Diagnostic report: shows current state, identifies mis-links, suggests repairs.
   * Safe read-only — never writes.
   */
  async function auditGigSetlistLinks() {
    if (typeof loadBandDataFromDrive !== 'function') { console.warn('loadBandDataFromDrive not available'); return null; }
    var gigs     = _toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = _toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var calEvts  = _toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    var blankSetlists = setlists.filter(_isBlankSetlist);
    var realSetlists  = setlists.filter(function(s) { return !_isBlankSetlist(s); });

    var misLinks = [];
    var orphanBlanks = [];
    gigs.forEach(function(g) {
      if (!g.setlistId) return;
      var linked = setlists.find(function(s) { return s.setlistId === g.setlistId; });
      if (!linked || !_isBlankSetlist(linked)) return;

      var better = _findBestSetlist(g, realSetlists);
      misLinks.push({
        gig: (g.venue || '?') + ' ' + (g.date || '?'),
        gigId: g.gigId,
        currentSetlistId: g.setlistId,
        currentSetlistName: linked.name || '?',
        betterMatch: better ? better.setlist.name : null,
        betterSetlistId: better ? better.setlist.setlistId : null,
        confidence: better ? better.confidence : 0,
        reason: better ? better.reason : 'no match found',
        songCount: better ? _slSongCount(better.setlist) : 0
      });
      orphanBlanks.push(linked);
    });

    console.log('%c=== Gig/Setlist Repair Audit ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Gigs:', gigs.length, '| Setlists:', setlists.length, '| Blank setlists:', blankSetlists.length, '| Real setlists:', realSetlists.length);
    console.log('Gigs linked to blank setlists:', misLinks.length);

    if (misLinks.length) {
      var high   = misLinks.filter(function(m) { return m.confidence >= 70; });
      var review = misLinks.filter(function(m) { return m.confidence > 0 && m.confidence < 70; });
      var noMatch = misLinks.filter(function(m) { return m.confidence === 0; });

      console.log('%cHigh confidence relinks (' + high.length + '):', 'color:#22c55e;font-weight:bold');
      high.forEach(function(m) {
        console.log('  ' + m.gig + ' → "' + m.betterMatch + '" (' + m.songCount + ' songs, confidence ' + m.confidence + ', ' + m.reason + ')');
      });

      console.log('%cNeeds review (' + review.length + '):', 'color:#f59e0b;font-weight:bold');
      review.forEach(function(m) {
        console.log('  ' + m.gig + ' → "' + m.betterMatch + '" (' + m.songCount + ' songs, confidence ' + m.confidence + ', ' + m.reason + ')');
      });

      console.log('%cNo match found (' + noMatch.length + '):', 'color:#64748b;font-weight:bold');
      noMatch.forEach(function(m) {
        console.log('  ' + m.gig + ' — blank setlist is correct (no existing setlist for this gig)');
      });

      console.table(misLinks.map(function(m) {
        return { Gig: m.gig, Current: m.currentSetlistName, Better: m.betterMatch || '(none)', Songs: m.songCount, Confidence: m.confidence, Reason: m.reason };
      }));
    }

    var unlinkedReal = realSetlists.filter(function(s) {
      return !gigs.some(function(g) { return g.setlistId === s.setlistId; });
    });
    if (unlinkedReal.length) {
      console.log('%cOrphan real setlists (not linked to any gig): ' + unlinkedReal.length, 'color:#f59e0b');
      unlinkedReal.forEach(function(s) {
        console.log('  "' + s.name + '" (' + _slSongCount(s) + ' songs, date: ' + (s.date || 'none') + ')');
      });
    }

    return { misLinks: misLinks, blankSetlists: blankSetlists.length, realSetlists: realSetlists.length, orphanReal: unlinkedReal.length };
  }

  /**
   * Repair pass: relink gigs from blank auto-created setlists to real existing ones.
   * Only relinks when confidence >= threshold (default 70).
   * Removes orphaned blank setlists that were replaced.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.dryRun=true]
   * @param {number}  [opts.minConfidence=70]  Minimum confidence to auto-relink
   */
  async function migrateGigSetlistIds(opts) {
    var dryRun = !opts || opts.dryRun !== false;
    var minConf = (opts && typeof opts.minConfidence === 'number') ? opts.minConfidence : 70;
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      console.warn('Data functions not available'); return null;
    }

    var gigs     = _toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = _toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var calEvts  = _toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    var log = [];
    var relinked = 0;
    var blanksRemoved = 0;
    var reviewed = 0;

    gigs.forEach(function(g, i) {
      if (!g.gigId) {
        g.gigId = generateShortId(12);
        log.push('ID: Gig #' + i + ' (' + (g.venue||'?') + ' ' + (g.date||'?') + ') → gigId=' + g.gigId);
      }
    });
    setlists.forEach(function(s, i) {
      if (!s.setlistId) {
        s.setlistId = generateShortId(12);
        log.push('ID: Setlist #' + i + ' (' + (s.name||'?') + ') → setlistId=' + s.setlistId);
      }
    });
    calEvts.forEach(function(e, i) {
      if (!e.id) {
        e.id = generateShortId(12);
        log.push('ID: CalEvent #' + i + ' → id=' + e.id);
      }
    });

    var realSetlists = setlists.filter(function(s) { return _slSongCount(s) > 0; });
    var blanksToRemove = [];

    gigs.forEach(function(g) {
      var currentSl = g.setlistId ? setlists.find(function(s) { return s.setlistId === g.setlistId; }) : null;
      var currentIsBlank = currentSl && _isBlankSetlist(currentSl);

      if (currentSl && !currentIsBlank) {
        if (!currentSl.gigId) currentSl.gigId = g.gigId;
        return;
      }

      var match = _findBestSetlist(g, realSetlists);

      if (match && match.confidence >= minConf) {
        var oldId = g.setlistId;
        g.setlistId = match.setlist.setlistId;
        g.linkedSetlist = match.setlist.name;
        match.setlist.gigId = g.gigId;
        relinked++;
        log.push('RELINK: ' + (g.venue||'?') + ' ' + (g.date||'?') + ' → "' + match.setlist.name + '" (conf ' + match.confidence + ', ' + match.reason + ')');

        if (currentIsBlank && currentSl) {
          blanksToRemove.push(currentSl.setlistId);
          log.push('  REMOVE blank: "' + currentSl.name + '" (setlistId=' + currentSl.setlistId + ')');
          blanksRemoved++;
        }
      } else if (match && match.confidence > 0 && match.confidence < minConf) {
        reviewed++;
        log.push('REVIEW: ' + (g.venue||'?') + ' ' + (g.date||'?') + ' → possible "' + match.setlist.name + '" (conf ' + match.confidence + ', ' + match.reason + ')');
      } else if (!g.setlistId) {
        var sl = {
          setlistId: generateShortId(12),
          gigId: g.gigId,
          name: (g.venue || 'Gig') + ' ' + (g.date || ''),
          date: g.date || '',
          venueId: g.venueId || null,
          venue: g.venue || '',
          notes: '',
          sets: [{ name: 'Set 1', songs: [] }],
          created: new Date().toISOString()
        };
        g.setlistId = sl.setlistId;
        g.linkedSetlist = sl.name;
        setlists.push(sl);
        log.push('NEW BLANK: ' + (g.venue||'?') + ' ' + (g.date||'?') + ' — no existing setlist found');
      }
    });

    calEvts.forEach(function(e) {
      if (e.type !== 'gig') return;
      if (e.gigId) return;
      var match = null;
      if (e.venueId && e.date) {
        match = gigs.find(function(g) { return g.venueId === e.venueId && g.date === e.date; });
      }
      if (!match && e.venue && e.date) {
        match = gigs.find(function(g) {
          return g.date === e.date && g.venue && _normStr(g.venue) === _normStr(e.venue);
        });
      }
      if (match) {
        e.gigId = match.gigId;
        log.push('CAL LINK: event ' + e.id + ' → gig ' + match.gigId);
      }
    });

    var finalSetlists = setlists.filter(function(s) {
      return blanksToRemove.indexOf(s.setlistId) < 0;
    });

    console.log('%c=== Gig/Setlist Repair ' + (dryRun ? '(DRY RUN)' : '(LIVE)') + ' ===', 'font-weight:bold;font-size:14px;color:#667eea');
    console.log('Relinked:', relinked, '| Blanks removed:', blanksRemoved, '| Needs review:', reviewed);
    log.forEach(function(l) { console.log('  ' + l); });

    if (!dryRun) {
      await saveBandDataToDrive('_band', 'gigs', gigs);
      await saveBandDataToDrive('_band', 'setlists', finalSetlists);
      await saveBandDataToDrive('_band', 'calendar_events', calEvts);
      _clearGigsCache();
      _clearSetlistCache();
      console.log('%c✅ Repair complete! Relinked ' + relinked + ', removed ' + blanksRemoved + ' blanks.', 'color:#22c55e;font-weight:bold');
    } else {
      console.log('%cDry run — no data written. Run with { dryRun: false } to apply.', 'color:#f59e0b;font-weight:bold');
    }

    return { relinked: relinked, blanksRemoved: blanksRemoved, reviewed: reviewed, log: log };
  }

  /**
   * TARGETED REPAIR: find and fix bad gig↔setlist links.
   *
   * A link is "bad" if:
   *  - Gig date and setlist date disagree (e.g. 2025 gig → 2023 setlist)
   *  - Gig venue and setlist venue/name have zero overlap
   *  - Setlist is blank (0 songs) AND a real setlist exists for this gig's date
   *
   * For bad links: nulls out gig.setlistId and gig.linkedSetlist,
   * clears the setlist's gigId back-ref, and removes orphaned blank setlists.
   *
   * @param {Object} [opts]
   * @param {boolean} [opts.dryRun=true]  If true, only reports — no writes.
   */
  async function repairBadLinks(opts) {
    var dryRun = !opts || opts.dryRun !== false;
    if (typeof loadBandDataFromDrive !== 'function' || typeof saveBandDataToDrive !== 'function') {
      console.warn('Data functions not available'); return null;
    }

    var gigs     = _toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = _toArray(await loadBandDataFromDrive('_band', 'setlists') || []);

    var slById = {};
    setlists.forEach(function(s) { if (s.setlistId) slById[s.setlistId] = s; });

    var log = [];
    var fixed = 0;
    var blanksToRemove = [];

    gigs.forEach(function(g, i) {
      if (!g.setlistId) return;
      var sl = slById[g.setlistId];
      if (!sl) return;

      var dominated = false;
      var reasons = [];
      var songCount = _slSongCount(sl);

      if (g.date && sl.date && g.date !== sl.date) {
        reasons.push('DATE: gig=' + g.date + ' setlist=' + sl.date);
        dominated = true;
      }

      if (g.date && sl.date && g.date !== sl.date) {
        var venueIdMatch = g.venueId && sl.venueId && g.venueId === sl.venueId;
        if (!venueIdMatch && g.venue && sl.name) {
          var nGig = _normStr(g.venue);
          var nSl  = _normStr(sl.name);
          var nSlV = _normStr(sl.venue || '');
          var firstWord = nGig.split(' ')[0];
          if (firstWord.length > 2 && nSl.indexOf(firstWord) < 0 && nSlV.indexOf(firstWord) < 0) {
            reasons.push('VENUE: "' + g.venue + '" vs "' + sl.name + '"');
          }
        }
      }

      if (songCount === 0 && sl.created) {
        var createdDate = (sl.created || '').substring(0, 10);
        var today = new Date().toISOString().substring(0, 10);
        var yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
        if (createdDate === today || createdDate === yesterday) {
          reasons.push('BLANK: 0 songs, created ' + createdDate + ' (likely migration artifact)');
          dominated = true;
        }
      }

      if (!dominated) return;

      fixed++;
      log.push('BAD LINK #' + fixed + ': ' + (g.venue || '?') + ' ' + (g.date || '?') +
        ' → was linked to "' + sl.name + '" (' + sl.date + ', ' + songCount + ' songs)' +
        ' | ' + reasons.join(', '));

      if (!dryRun) {
        g.setlistId = null;
        g.linkedSetlist = null;

        if (sl.gigId === g.gigId) {
          sl.gigId = null;
        }

        if (songCount === 0) {
          blanksToRemove.push(sl.setlistId);
          log.push('  → removing blank setlist "' + sl.name + '"');
        }
      }
    });

    var finalSetlists = dryRun ? setlists : setlists.filter(function(s) {
      return blanksToRemove.indexOf(s.setlistId) < 0;
    });

    console.log('%c=== BAD LINK REPAIR ' + (dryRun ? '(DRY RUN)' : '(LIVE)') + ' ===', 'font-weight:bold;font-size:14px;color:#ef4444');
    console.log('Bad links found:', fixed);
    console.log('Blank setlists to remove:', blanksToRemove.length);
    log.forEach(function(l) { console.log('  ' + l); });

    if (!dryRun && fixed > 0) {
      await saveBandDataToDrive('_band', 'gigs', gigs);
      await saveBandDataToDrive('_band', 'setlists', finalSetlists);
      _clearGigsCache();
      _clearSetlistCache();
      console.log('%c✅ Repaired ' + fixed + ' bad links, removed ' + blanksToRemove.length + ' blank setlists.', 'color:#22c55e;font-weight:bold');
    } else if (!dryRun) {
      console.log('%cNo bad links found — data looks clean.', 'color:#22c55e;font-weight:bold');
    } else {
      console.log('%cDry run — no data written. Run with { dryRun: false } to apply.', 'color:#f59e0b;font-weight:bold');
    }

    return { fixed: fixed, blanksRemoved: blanksToRemove.length, log: log };
  }

  /**
   * POST-MIGRATION AUDIT — Read-only comprehensive report.
   * Never writes data. Produces:
   *  A. Executive summary
   *  B. Full link table
   *  C. Suspicious records
   *  D. Specific case search (From The Earth Brewing 2026-05-17)
   *  E. Recoverability assessment
   */
  async function postMigrationAudit() {
    if (typeof loadBandDataFromDrive !== 'function') { console.warn('loadBandDataFromDrive not available'); return null; }
    var gigs     = _toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var setlists = _toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var calEvts  = _toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);

    var slById = {};
    setlists.forEach(function(s) { if (s.setlistId) slById[s.setlistId] = s; });

    var gigById = {};
    gigs.forEach(function(g) { if (g.gigId) gigById[g.gigId] = g; });

    var linkTable = [];
    var suspicious = [];
    var totalLinked = 0;
    var totalUnlinked = 0;
    var totalBlankSetlist = 0;

    var setlistClaimCount = {};

    gigs.forEach(function(g, i) {
      var sl = g.setlistId ? slById[g.setlistId] : null;
      var songCount = sl ? _slSongCount(sl) : 0;
      var isBlank = sl ? (songCount === 0) : false;

      if (g.setlistId) {
        if (!setlistClaimCount[g.setlistId]) setlistClaimCount[g.setlistId] = [];
        setlistClaimCount[g.setlistId].push(g);
      }

      var row = {
        idx: i,
        gigId: g.gigId || '(none)',
        gigVenue: g.venue || '?',
        gigDate: g.date || '?',
        setlistId: g.setlistId || '(none)',
        setlistName: sl ? (sl.name || '?') : '(not found)',
        setlistDate: sl ? (sl.date || '?') : '-',
        setlistSongs: songCount,
        isBlank: isBlank,
        linkedSetlist: g.linkedSetlist || '',
        gigCreated: g.created || '',
        gigUpdated: g.updated || '',
        slGigId: sl ? (sl.gigId || '') : '',
        status: !g.setlistId ? 'UNLINKED' : (isBlank ? 'BLANK_SETLIST' : 'LINKED'),
        flags: []
      };

      if (g.setlistId) totalLinked++; else totalUnlinked++;
      if (isBlank) totalBlankSetlist++;

      if (sl && sl.date && g.date && sl.date !== g.date) {
        row.flags.push('DATE_MISMATCH: gig=' + g.date + ' sl=' + sl.date);
      }

      if (sl) {
        var hasGigVenueId = !!g.venueId;
        var hasSlVenueId  = !!sl.venueId;
        if (hasGigVenueId && hasSlVenueId) {
          if (g.venueId === sl.venueId) {
            if (g.venue && sl.venue && g.venue !== sl.venue) {
              row.flags.push('VENUE_ID_MATCH_TEXT_DIFF: venueId ok, gig="' + g.venue + '" sl="' + sl.venue + '"');
            }
          } else {
            row.flags.push('VENUE_ID_CONFLICT: gig.venueId=' + g.venueId + ' sl.venueId=' + sl.venueId);
          }
        } else if (g.venue && sl.venue) {
          var nGigV = _normStr(g.venue);
          var nSlV  = _normStr(sl.venue);
          if (nGigV !== nSlV && nGigV.indexOf(nSlV) < 0 && nSlV.indexOf(nGigV) < 0) {
            row.flags.push('VENUE_TEXT_MISMATCH: gig="' + g.venue + '" sl="' + sl.venue + '" (no venueId' + (!hasGigVenueId ? ' on gig' : '') + (!hasSlVenueId ? ' on sl' : '') + ')');
          }
        }
      }

      if (sl && sl.name && g.venue) {
        var nName = _normStr(sl.name);
        var nVenue = _normStr(g.venue);
        if (nName.indexOf(nVenue.split(' ')[0]) < 0 && nName.indexOf(g.date || '????') < 0) {
          var autoPattern = _normStr(g.venue + ' ' + g.date);
          if (nName !== autoPattern) {
            row.flags.push('NAME_WEAK: sl="' + sl.name + '" vs gig="' + g.venue + ' ' + g.date + '"');
          }
        }
      }

      if (g.linkedSetlist && sl && sl.name && g.linkedSetlist !== sl.name) {
        row.flags.push('LEGACY_DRIFT: linkedSetlist="' + g.linkedSetlist + '" but sl.name="' + sl.name + '"');
      }

      if (sl && sl.gigId && sl.gigId !== g.gigId) {
        row.flags.push('BACK_REF_MISMATCH: sl.gigId=' + sl.gigId + ' != gig.gigId=' + g.gigId);
      }

      if (row.flags.length > 0) {
        suspicious.push(row);
      }
      linkTable.push(row);
    });

    var dupeTargets = [];
    Object.keys(setlistClaimCount).forEach(function(slId) {
      if (setlistClaimCount[slId].length > 1) {
        var sl = slById[slId];
        dupeTargets.push({
          setlistId: slId,
          setlistName: sl ? sl.name : '?',
          claimedBy: setlistClaimCount[slId].map(function(g) { return g.venue + ' ' + g.date + ' (' + g.gigId + ')'; })
        });
        setlistClaimCount[slId].forEach(function(g) {
          var row = linkTable.find(function(r) { return r.gigId === g.gigId; });
          if (row) {
            row.flags.push('DUPE_TARGET: ' + setlistClaimCount[slId].length + ' gigs share setlist "' + (sl ? sl.name : slId) + '"');
            if (suspicious.indexOf(row) < 0) suspicious.push(row);
          }
        });
      }
    });

    var knownCase = null;
    var fteGigs = gigs.filter(function(g) {
      return (g.venue || '').toLowerCase().indexOf('from the earth') >= 0;
    });
    var may17Gigs = gigs.filter(function(g) { return g.date === '2026-05-17'; });
    var timsBirthday = setlists.filter(function(s) {
      return (s.name || '').toLowerCase().indexOf('tim') >= 0 || (s.name || '').toLowerCase().indexOf('birthday') >= 0;
    });

    knownCase = {
      fteGigs: fteGigs.map(function(g) {
        var sl = g.setlistId ? slById[g.setlistId] : null;
        return {
          gigId: g.gigId, venue: g.venue, date: g.date,
          setlistId: g.setlistId, setlistName: sl ? sl.name : '(none)',
          setlistDate: sl ? sl.date : '-', setlistSongs: sl ? _slSongCount(sl) : 0,
          linkedSetlist: g.linkedSetlist || '',
          created: g.created, updated: g.updated
        };
      }),
      may17Gigs: may17Gigs.map(function(g) {
        var sl = g.setlistId ? slById[g.setlistId] : null;
        return { gigId: g.gigId, venue: g.venue, date: g.date, setlistId: g.setlistId, setlistName: sl ? sl.name : '(none)' };
      }),
      timsBirthdaySetlists: timsBirthday.map(function(s) {
        return { setlistId: s.setlistId, name: s.name, date: s.date, venue: s.venue, gigId: s.gigId, songs: _slSongCount(s) };
      })
    };

    var orphanSetlists = setlists.filter(function(s) {
      return !gigs.some(function(g) { return g.setlistId === s.setlistId; });
    });

    var hasCreatedTimestamps = gigs.filter(function(g) { return g.created; }).length;
    var hasUpdatedTimestamps = gigs.filter(function(g) { return g.updated; }).length;
    var gigsWithGigId = gigs.filter(function(g) { return g.gigId; }).length;
    var setlistsWithSetlistId = setlists.filter(function(s) { return s.setlistId; }).length;

    console.log('%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');
    console.log('%c  POST-MIGRATION AUDIT — READ ONLY', 'font-weight:bold;font-size:16px;color:#667eea');
    console.log('%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');

    console.log('\n%cA. EXECUTIVE SUMMARY', 'font-weight:bold;font-size:14px;color:#22c55e');
    console.log('  Gigs total:', gigs.length);
    console.log('  Setlists total:', setlists.length);
    console.log('  Calendar events:', calEvts.length);
    console.log('  Gigs linked to setlist:', totalLinked);
    console.log('  Gigs unlinked:', totalUnlinked);
    console.log('  Gigs linked to BLANK setlist:', totalBlankSetlist);
    console.log('  Suspicious records:', suspicious.length);
    console.log('  Duplicate-target conflicts:', dupeTargets.length);
    console.log('  Orphan setlists (not claimed by any gig):', orphanSetlists.length);

    console.log('\n%cB. FULL LINK TABLE', 'font-weight:bold;font-size:14px;color:#818cf8');
    console.table(linkTable.map(function(r) {
      return {
        '#': r.idx,
        Gig: r.gigVenue + ' ' + r.gigDate,
        GigID: r.gigId.substring(0, 8),
        Status: r.status,
        Setlist: r.setlistName,
        SlDate: r.setlistDate,
        Songs: r.setlistSongs,
        Legacy: r.linkedSetlist,
        Flags: r.flags.join(' | ') || '-'
      };
    }));

    console.log('\n%cC. SUSPICIOUS RECORDS (' + suspicious.length + ')', 'font-weight:bold;font-size:14px;color:#f59e0b');
    if (suspicious.length) {
      console.table(suspicious.map(function(r) {
        return {
          Gig: r.gigVenue + ' ' + r.gigDate,
          GigID: r.gigId.substring(0, 8),
          Setlist: r.setlistName,
          Songs: r.setlistSongs,
          Flags: r.flags.join(' | ')
        };
      }));
    } else {
      console.log('  (none found)');
    }

    if (dupeTargets.length) {
      console.log('\n%cDUPLICATE-TARGET CONFLICTS', 'font-weight:bold;color:#ef4444');
      dupeTargets.forEach(function(d) {
        console.log('  Setlist "' + d.setlistName + '" (' + d.setlistId.substring(0, 8) + ') claimed by:');
        d.claimedBy.forEach(function(g) { console.log('    → ' + g); });
      });
    }

    console.log('\n%cD. KNOWN CASE: "From The Earth Brewing"', 'font-weight:bold;font-size:14px;color:#ef4444');
    if (knownCase.fteGigs.length) {
      console.log('  All "From The Earth" gigs:');
      console.table(knownCase.fteGigs);
    } else {
      console.log('  No "From The Earth" gigs found');
    }
    if (knownCase.may17Gigs.length) {
      console.log('  All gigs dated 2026-05-17:');
      console.table(knownCase.may17Gigs);
    }
    if (knownCase.timsBirthdaySetlists.length) {
      console.log('  Setlists matching "Tim" or "Birthday":');
      console.table(knownCase.timsBirthdaySetlists);
    } else {
      console.log('  No "Tim\'s Birthday" setlists found');
    }

    console.log('\n%cE. RECOVERABILITY', 'font-weight:bold;font-size:14px;color:#818cf8');
    console.log('  Gigs with gigId:', gigsWithGigId, '/', gigs.length);
    console.log('  Setlists with setlistId:', setlistsWithSetlistId, '/', setlists.length);
    console.log('  Gigs with created timestamp:', hasCreatedTimestamps);
    console.log('  Gigs with updated timestamp:', hasUpdatedTimestamps);
    console.log('  Pre-migration snapshot: NOT available (no snapshot was taken before migration)');
    console.log('  Migration log: NOT persisted (was console output only)');
    console.log('  Targeted repair: POSSIBLE — can null out setlistId/gigId on suspicious records');
    console.log('  Full rollback: RISKY — no snapshot to restore from. Targeted repair is safer.');

    console.log('\n%cF. ORPHAN SETLISTS (' + orphanSetlists.length + ')', 'font-weight:bold;font-size:14px;color:#64748b');
    if (orphanSetlists.length) {
      console.table(orphanSetlists.map(function(s) {
        return {
          Name: s.name,
          Date: s.date || '-',
          Venue: s.venue || '-',
          Songs: _slSongCount(s),
          SetlistId: (s.setlistId || '').substring(0, 8),
          GigId: s.gigId || '(none)'
        };
      }));
    }

    console.log('\n%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');
    console.log('%c  END OF AUDIT — NO DATA WAS MODIFIED', 'font-weight:bold;font-size:14px;color:#22c55e');
    console.log('%c══════════════════════════════════════════════════', 'color:#667eea;font-weight:bold');

    return {
      summary: {
        gigs: gigs.length, setlists: setlists.length, calEvents: calEvts.length,
        linked: totalLinked, unlinked: totalUnlinked, blankSetlists: totalBlankSetlist,
        suspicious: suspicious.length, dupeTargets: dupeTargets.length,
        orphanSetlists: orphanSetlists.length
      },
      linkTable: linkTable,
      suspicious: suspicious,
      dupeTargets: dupeTargets,
      knownCase: knownCase,
      orphanSetlists: orphanSetlists
    };
  }

  // ── Wire to GLStore ──

  if (typeof window !== 'undefined' && window.GLStore) {
    var GL = window.GLStore;
    GL.auditGigSetlistLinks = auditGigSetlistLinks;
    GL.migrateGigSetlistIds = migrateGigSetlistIds;
    GL.repairBadLinks       = repairBadLinks;
    GL.postMigrationAudit   = postMigrationAudit;
  }
})();
