// ─────────────────────────────────────────────────────────────────────────────
// practice.js — Personal Practice (Woodshed) + Practice Mixes
//
// Tabs:
//   Focus  — This Week / Needs Polish / Gig Ready / weak songs / readiness
//   Mixes  — practiceMixes CRUD, shareSlug, band sharing
//
// Firebase schema:
//   bandPath('practice_mixes/{mixId}') → { id, title, type, songIds[], createdBy,
//     createdAt, shareSlug, isShared }
//
// EXPOSES: renderPracticePage, loadSongStatusMap
// DEPENDS ON: allSongs, readinessCache, loadBandDataFromDrive,
//             saveBandDataToDrive, bandPath, firebaseDB, showToast,
//             toArray, getCurrentMemberReadinessKey, sanitizeFirebasePath
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// ── Module state ──────────────────────────────────────────────────────────────
var _pmTab         = 'focus';      // 'focus' | 'mixes'
var _pmMixes       = [];           // loaded mix objects
var _pmEditingMix  = null;         // mix object being edited/created (null = none)
var _pmMixSongs    = [];           // working song list for editor

var MIX_TYPES = [
    { id:'practice',   emoji:'🎯', label:'Practice'       },
    { id:'rehearsal',  emoji:'🎸', label:'Rehearsal Prep'  },
    { id:'gig',        emoji:'🎤', label:'Gig Prep'        },
    { id:'weak',       emoji:'⚠️', label:'Weak Songs'      },
];

// ── Page entry point ──────────────────────────────────────────────────────────
async function renderPracticePage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'practice');

    el.innerHTML =
        '<div class="page-header">' +
        '  <h1>🎯 Practice</h1>' +
        '  <p>Woodshed and your practice mixes</p>' +
        '</div>' +
        '<div class="pm-tab-strip">' +
        '  <button id="pm-tab-focus" class="pm-tab pm-tab--active" onclick="pmSwitchTab(\'focus\')">🎯 Focus</button>' +
        '  <button id="pm-tab-mixes" class="pm-tab" onclick="pmSwitchTab(\'mixes\')">🎵 Mixes</button>' +
        '</div>' +
        '<div id="pm-panel-focus"></div>' +
        '<div id="pm-panel-mixes" style="display:none"></div>';

    _pmInjectStyles();
    _pmTab = 'focus';
    _pmRenderFocusTab();
    _pmRenderMixesTab();   // pre-load mixes in background
}

// ── Tab switching ─────────────────────────────────────────────────────────────
window.pmSwitchTab = function pmSwitchTab(tab) {
    _pmTab = tab;
    document.querySelectorAll('.pm-tab').forEach(function(b) {
        b.classList.toggle('pm-tab--active', b.id === 'pm-tab-' + tab);
    });
    document.getElementById('pm-panel-focus').style.display = tab === 'focus' ? 'block' : 'none';
    document.getElementById('pm-panel-mixes').style.display = tab === 'mixes' ? 'block' : 'none';
};

// ── Active filter — canonical check for practice-eligible songs ───────────────
var _pmActiveStatuses = GLStore.ACTIVE_STATUSES;
function _pmIsActiveStatus(st) { return !!_pmActiveStatuses[st]; }

function _pmIsActive(title) {
    if (typeof GLStore !== 'undefined' && GLStore.getStatus) {
        var st = GLStore.getStatus(title);
        if (st) return _pmIsActiveStatus(st);
    }
    if (typeof isSongActive === 'function') return isSongActive(title);
    return false;
}

// ── Today's Practice — answers "what should I practice right now?" ────────────
function _pmGetTodayPracticeSongs(songList, statusMap, rc) {
    var seen = {};
    var result = [];
    function add(title) {
        if (seen[title] || result.length >= 5) return;
        if (typeof isStructuralTitle === 'function' && isStructuralTitle(title)) return;
        if (!_pmIsActive(title)) return;
        seen[title] = true;
        var ratings = rc[title] || {};
        var vals = Object.values(ratings).filter(function(v){ return typeof v === 'number' && v > 0; });
        var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 0;
        var safeTitle = title.replace(/'/g, "\\'");
        result.push({ title: title, avg: avg, safeTitle: safeTitle });
    }
    // 1. Weakest songs (readiness < 3)
    var weak = [];
    Object.keys(rc).forEach(function(title) {
        var ratings = rc[title] || {};
        var vals = Object.values(ratings).filter(function(v){ return typeof v === 'number' && v > 0; });
        if (!vals.length) return;
        var avg = vals.reduce(function(a,b){return a+b;},0)/vals.length;
        if (avg < 3 && _pmIsActive(title)) weak.push({ title: title, avg: avg });
    });
    weak.sort(function(a,b){ return a.avg - b.avg; });
    weak.forEach(function(s){ add(s.title); });
    // 2. This Week
    songList.forEach(function(s){ if (statusMap[s.title] === 'this_week') add(s.title); });
    // 3. Needs Polish (wip)
    songList.forEach(function(s){ var st = statusMap[s.title]; if (st === 'needs_polish' || st === 'wip' || st === 'needsPolish' || st === 'learning') add(s.title); });
    // 4. On Deck
    songList.forEach(function(s){ var st = statusMap[s.title]; if (st === 'on_deck' || st === 'prospect' || st === 'onDeck') add(s.title); });
    return result;
}

// ── Entry Screen (Wave 1) ────────────────────────────────────────────────────
// Section A: one primary recommendation from getNowFocus() + Start button.
// Section B: 3 chips above-fold (Resume disabled, Gig Prep, Improve a Song)
// + "More options" expander revealing Learn / Harmony / Lyrics-Chords.
// Acceptance: user opens Practice → sees one clear recommendation → can start
// in one click OR pick a clear alternative without thinking.

async function _pmRenderFocusTab() {
    var el = document.getElementById('pm-panel-focus');
    if (!el) return;
    var t0 = (typeof performance !== 'undefined') ? performance.now() : 0;

    var focus = (typeof GLStore !== 'undefined' && GLStore.getNowFocus)
        ? GLStore.getNowFocus()
        : null;

    el.innerHTML =
        _pmRenderSectionA(focus) +
        _pmRenderSectionB(/*hasResume*/ false);

    if (typeof performance !== 'undefined') {
        console.log('[PERF] practice-entry-rendered', Math.round(performance.now() - t0), 'ms');
    }
}

function _pmRenderSectionA(focus) {
    var primary = focus && focus.primary;
    if (!primary) {
        return ''+
        '<div class="pm-section pm-section-a pm-section-a-empty">'+
        '  <div class="pm-section-label">Recommended for you right now</div>'+
        '  <div class="pm-empty-card">'+
        '    <div class="pm-empty-emoji">🎸</div>'+
        '    <div class="pm-empty-msg">Nothing flagged for practice right now.</div>'+
        '    <div class="pm-empty-sub">Pick a focus below to get started.</div>'+
        '  </div>'+
        '</div>';
    }
    var title = window.escHtml ? window.escHtml(primary.title) : primary.title;
    var reason = window.escHtml ? window.escHtml(focus.reason || '') : (focus.reason || '');
    var safeTitle = primary.title.replace(/'/g, "\\'");
    return ''+
    '<div class="pm-section pm-section-a">'+
    '  <div class="pm-section-label">Recommended for you right now</div>'+
    '  <div class="pm-primary-card">'+
    '    <div class="pm-primary-title">'+title+'</div>'+
    (reason ? '    <div class="pm-primary-reason">'+reason+'</div>' : '')+
    '    <button class="pm-start-btn" onclick="_pmStart(\'recommended\', \''+safeTitle+'\')">▶ Start Practice</button>'+
    '  </div>'+
    '</div>';
}

function _pmRenderSectionB(hasResume) {
    var resumeChip = hasResume
        ? '<button class="pm-chip pm-chip-resume" onclick="_pmStart(\'resume\')">🔁 Resume Last Session</button>'
        : '<button class="pm-chip pm-chip-disabled" disabled title="Available in Wave 2">🔁 Resume Last Session</button>';
    return ''+
    '<div class="pm-section pm-section-b">'+
    '  <div class="pm-section-label">Or choose your focus</div>'+
    '  <div class="pm-chips">'+
         resumeChip +
    '    <button class="pm-chip" onclick="_pmStart(\'gig-prep\')">🎤 Gig Prep</button>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'improve\')">🎸 Improve a Song</button>'+
    '  </div>'+
    '  <button class="pm-more-btn" onclick="_pmToggleMore(this)">More options ▼</button>'+
    '  <div class="pm-chips pm-chips-more" hidden>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'learn\')">🎶 Learn New Song</button>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'harmony\')">🎧 Harmony Practice</button>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'chart\')">📄 Lyrics / Chords</button>'+
    '  </div>'+
    '</div>';
}

window._pmStart = function _pmStart(focusType, songTitle) {
    if (focusType === 'recommended' && songTitle) {
        _pmOpenSolo(songTitle);
        return;
    }
    if (focusType === 'gig-prep') {
        _pmStartGigPrep();
        return;
    }
    if (focusType === 'resume') {
        // Wave 2 — placeholder; chip is rendered disabled in Wave 1.
        if (typeof showToast === 'function') showToast('Resume lands in Wave 2');
        return;
    }
    if (songTitle) _pmOpenSolo(songTitle);
};

// Open a single song into the chart overlay in solo Practice mode (no
// Band Sync bar, no "Rehearsal saved" modal at exit). Wraps the existing
// openRehearsalModePractice() entry, which already nulls _rmSessionStart.
function _pmOpenSolo(songTitle) {
    var songList = typeof allSongs !== 'undefined' ? allSongs : [];
    var songData = songList.find(function(s) { return s.title === songTitle; });
    var queue = [{ title: songTitle, band: songData ? (songData.band || '') : '' }];
    if (typeof openRehearsalModePractice === 'function') {
        openRehearsalModePractice(queue);
    } else if (typeof openRehearsalMode === 'function') {
        openRehearsalMode(songTitle);
    }
}

// Cached for click-to-switch between upcoming gigs without re-fetching.
var _pmGigPrepUpcoming = [];

// Gig Prep — Drew (2026-05-09): "Why is it not finding next gig automatically
// and then having a list of all gigs after that?" Two fixes here:
//   (1) Use getGigsAsync() so a cold cache (user hasn't visited Schedule yet)
//       still resolves the gig list from calendar_events.
//   (2) Show ALL upcoming gigs in the modal: next one rendered as primary
//       with songs to work on, plus a "Switch gig" list at the bottom so the
//       user can prep for a later gig instead.
async function _pmStartGigPrep() {
    var gigs = [];
    if (typeof GLStore !== 'undefined' && GLStore.getGigsAsync) {
        try { gigs = await GLStore.getGigsAsync(); } catch(e) { gigs = []; }
    }
    if (!gigs || !gigs.length) {
        // Fallback to sync cache in case async path isn't wired yet.
        gigs = (typeof GLStore !== 'undefined' && GLStore.getGigs) ? GLStore.getGigs() : [];
    }
    var todayStr = new Date().toISOString().split('T')[0];
    var upcoming = (gigs || []).filter(function(g) { return g && g.date && g.date >= todayStr; });
    upcoming.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

    if (!upcoming.length) {
        _pmGigPrepUpcoming = [];
        _pmShowGigPrepEmpty('no-gig');
        return;
    }

    _pmGigPrepUpcoming = upcoming;
    // Default: render the next gig (closest date). User can switch from the
    // "Other upcoming gigs" list at the bottom of the modal.
    _pmRenderGigPrepForGig(upcoming[0]);
}

function _pmRenderGigPrepForGig(gig) {
    if (!gig) return;
    var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
    var setlist = null;
    if (gig.setlistId) {
        setlist = setlists.find(function(s) { return s && s.setlistId === gig.setlistId; }) || null;
    }
    if (!setlist && gig.date) {
        setlist = setlists.find(function(s) { return s && s.date === gig.date; }) || null;
    }

    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var seen = {};
    var allSongsInSetlist = [];
    if (setlist) {
        (setlist.sets || []).forEach(function(set) {
            (set.songs || []).forEach(function(sg) {
                var title = typeof sg === 'string' ? sg : (sg && sg.title) || '';
                if (!title || seen[title]) return;
                if (typeof isStructuralTitle === 'function' && isStructuralTitle(title)) return;
                seen[title] = true;
                var ratings = rc[title] || {};
                var vals = Object.values(ratings).filter(function(v){ return typeof v === 'number' && v > 0; });
                var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0) / vals.length : 0;
                allSongsInSetlist.push({ title: title, avg: avg, hasRating: vals.length > 0 });
            });
        });
    }

    var needsWork = allSongsInSetlist.filter(function(s) { return !s.hasRating || s.avg < 4; });
    needsWork.sort(function(a, b) {
        if (a.hasRating && b.hasRating) return a.avg - b.avg;
        if (a.hasRating) return -1;
        if (b.hasRating) return 1;
        return a.title.localeCompare(b.title);
    });

    _pmShowGigPrepModal(gig, setlist, needsWork, allSongsInSetlist.length);
}

function _pmShowGigPrepModal(gig, setlist, needsWork, totalCount) {
    var existing = document.getElementById('pmSongPickerOverlay');
    if (existing) existing.remove();

    var dateLabel = _pmFormatGigDate(gig.date);
    var venueLabel = gig.venue ? (window.escHtml ? window.escHtml(gig.venue) : gig.venue) : 'Venue TBD';

    // Subtitle reflects state of the SELECTED gig
    var subtitle;
    if (!setlist) {
        subtitle = 'No setlist linked to this gig yet';
    } else if (!totalCount) {
        subtitle = 'Setlist is empty';
    } else if (!needsWork.length) {
        subtitle = 'All ' + totalCount + ' songs are gig-ready 🎉';
    } else {
        subtitle = needsWork.length + ' of ' + totalCount + ' songs need work';
    }

    // Body: songs needing work, OR helpful empty branch
    var bodyRows;
    if (!setlist) {
        bodyRows = '<div class="pm-picker-empty">No setlist linked yet for this gig. <a href="#" onclick="event.preventDefault();document.getElementById(\'pmSongPickerOverlay\').remove();showPage(\'setlists\')" style="color:#a5b4fc">Open Setlists →</a></div>';
    } else if (!totalCount) {
        bodyRows = '<div class="pm-picker-empty">Setlist exists but has no songs yet. <a href="#" onclick="event.preventDefault();document.getElementById(\'pmSongPickerOverlay\').remove();showPage(\'setlists\')" style="color:#a5b4fc">Open Setlists →</a></div>';
    } else if (!needsWork.length) {
        bodyRows = '<div class="pm-picker-empty">All set for this gig. Want to brush up anyway? <a href="#" onclick="event.preventDefault();_pmShowGigPrepAll('+JSON.stringify(setlist.setlistId).replace(/"/g,'&quot;')+')" style="color:#a5b4fc">Browse the full setlist →</a></div>';
    } else {
        bodyRows = needsWork.map(function(s) {
            var safe = s.title.replace(/'/g, "\\'");
            var t = window.escHtml ? window.escHtml(s.title) : s.title;
            var avgPill = s.hasRating
                ? '<span class="pm-gig-avg" style="color:'+(s.avg < 2 ? '#f87171' : '#fbbf24')+'">'+s.avg.toFixed(1)+'</span>'
                : '<span class="pm-gig-avg" style="color:#64748b">— —</span>';
            return '<div class="pm-picker-row" onclick="_pmPickerSelect(\'gig-prep\',\''+safe+'\')">'+
                   '<span class="pm-picker-title">'+t+'</span>'+
                   avgPill+
                   '</div>';
        }).join('');
    }

    // "Other upcoming gigs" — clickable list to switch context.
    var others = _pmGigPrepUpcoming.filter(function(g) {
        return _pmGigKey(g) !== _pmGigKey(gig);
    });
    var otherGigsHtml = '';
    if (others.length) {
        otherGigsHtml = '<div class="pm-gig-other-list">' +
            '<div class="pm-gig-other-label">Other upcoming gigs</div>' +
            others.map(function(g) {
                var d = _pmFormatGigDate(g.date);
                var v = window.escHtml ? window.escHtml(g.venue || 'Venue TBD') : (g.venue || 'Venue TBD');
                var safeKey = _pmGigKey(g).replace(/'/g, "\\'");
                return '<div class="pm-gig-other-row" onclick="_pmSwitchGig(\'' + safeKey + '\')">' +
                       '<span class="pm-gig-other-date">' + d + '</span>' +
                       '<span class="pm-gig-other-venue">' + v + '</span>' +
                       '<span class="pm-gig-other-arrow">→</span>' +
                       '</div>';
            }).join('') +
            '</div>';
    }

    var overlay = document.createElement('div');
    overlay.id = 'pmSongPickerOverlay';
    overlay.className = 'modal-overlay pm-picker-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div class="pm-picker-modal">'+
        '  <div class="pm-picker-header pm-gig-header">'+
        '    <div>'+
        '      <div class="pm-gig-eyebrow">' + (others.length ? 'Selected gig' : 'Next gig') + '</div>'+
        '      <div class="pm-picker-title-h">🎤 '+dateLabel+' · '+venueLabel+'</div>'+
        '      <div class="pm-gig-subtitle">'+subtitle+'</div>'+
        '    </div>'+
        '    <button class="pm-picker-close" onclick="document.getElementById(\'pmSongPickerOverlay\').remove()">✕</button>'+
        '  </div>'+
        '  <div class="pm-picker-list" id="pmPickerList">'+bodyRows+'</div>'+
        otherGigsHtml +
        '</div>';
    document.body.appendChild(overlay);
}

window._pmSwitchGig = function _pmSwitchGig(gigKey) {
    var target = _pmGigPrepUpcoming.find(function(g) { return _pmGigKey(g) === gigKey; });
    if (target) _pmRenderGigPrepForGig(target);
};

// Stable identifier for an upcoming gig record. Prefer gigId when present;
// fall back to date+venue (collision-resistant for one band's calendar).
function _pmGigKey(g) {
    if (!g) return '';
    if (g.gigId) return g.gigId;
    return (g.date || '') + '|' + (g.venue || '');
}

// Empty state: zero upcoming gigs in the calendar. Other empty cases
// (no setlist linked, empty setlist) are handled inline in
// _pmShowGigPrepModal so they appear next to the "Other upcoming gigs"
// switcher — the user can pivot to a different gig instead of leaving.
function _pmShowGigPrepEmpty(reason) {
    var existing = document.getElementById('pmSongPickerOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'pmSongPickerOverlay';
    overlay.className = 'modal-overlay pm-picker-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div class="pm-picker-modal">'+
        '  <div class="pm-picker-header">'+
        '    <div class="pm-picker-title-h">🎤 Gig Prep</div>'+
        '    <button class="pm-picker-close" onclick="document.getElementById(\'pmSongPickerOverlay\').remove()">✕</button>'+
        '  </div>'+
        '  <div style="padding:28px 22px;text-align:center">'+
        '    <div style="font-size:2em;margin-bottom:10px;opacity:0.55">📭</div>'+
        '    <div style="font-weight:700;font-size:1.05em;color:var(--text);margin-bottom:6px">No upcoming gigs</div>'+
        '    <div style="font-size:0.88em;color:var(--text-dim);line-height:1.45;margin-bottom:18px">Add a gig in Schedule and we\'ll surface it here.</div>'+
        '    <button class="pm-start-btn" onclick="document.getElementById(\'pmSongPickerOverlay\').remove();showPage(\'calendar\')">Open Schedule</button>'+
        '  </div>'+
        '</div>';
    document.body.appendChild(overlay);
}

window._pmShowGigPrepAll = function _pmShowGigPrepAll(setlistId) {
    // "Browse the full setlist" fallback when all gig songs are already ready.
    var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
    var sl = setlists.find(function(s) { return s && s.setlistId === setlistId; });
    if (!sl) return;
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var seen = {};
    var rows = [];
    (sl.sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(sg) {
            var title = typeof sg === 'string' ? sg : (sg && sg.title) || '';
            if (!title || seen[title]) return;
            if (typeof isStructuralTitle === 'function' && isStructuralTitle(title)) return;
            seen[title] = true;
            var ratings = rc[title] || {};
            var vals = Object.values(ratings).filter(function(v){ return typeof v === 'number' && v > 0; });
            var avg = vals.length ? vals.reduce(function(a,b){return a+b;},0) / vals.length : 0;
            rows.push({ title: title, avg: avg, hasRating: vals.length > 0 });
        });
    });
    rows.sort(function(a, b) { return a.title.localeCompare(b.title); });
    _pmShowGigPrepModal({ date: sl.date || '', venue: sl.title || '' }, sl, rows, rows.length);
};

function _pmFormatGigDate(dateStr) {
    if (!dateStr) return 'Date TBD';
    try {
        var parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        var d = new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    } catch(e) { return dateStr; }
}

window._pmToggleMore = function _pmToggleMore(btn) {
    var more = btn.nextElementSibling;
    if (!more) return;
    var hidden = more.hasAttribute('hidden');
    if (hidden) {
        more.removeAttribute('hidden');
        btn.textContent = 'Fewer options ▲';
    } else {
        more.setAttribute('hidden', '');
        btn.textContent = 'More options ▼';
    }
};

window._pmShowSongPicker = function _pmShowSongPicker(focusType) {
    var songList = typeof allSongs !== 'undefined' ? allSongs : [];
    var statusMap = {};
    try {
        var cached = (typeof GLStore !== 'undefined' && GLStore.getAllStatus) ? GLStore.getAllStatus() : {};
        Object.keys(cached).forEach(function(k) { statusMap[k] = (cached[k] || '').toLowerCase().replace(/\s+/g,'_'); });
    } catch(e) {}

    var filtered = songList.filter(function(s) {
        if (typeof isStructuralTitle === 'function' && isStructuralTitle(s.title)) return false;
        if (focusType === 'learn') {
            var st = statusMap[s.title];
            return st === 'learning' || st === 'prospect' || st === 'wip' || st === 'on_deck' || st === 'onDeck';
        }
        return _pmIsActive(s.title);
    });
    filtered.sort(function(a, b) { return (a.title || '').localeCompare(b.title || ''); });

    var titleLabel = ({
        improve: 'Improve a Song',
        learn:   'Learn a New Song',
        harmony: 'Harmony Practice',
        chart:   'Lyrics / Chords'
    })[focusType] || 'Choose a Song';

    var existing = document.getElementById('pmSongPickerOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'pmSongPickerOverlay';
    overlay.className = 'modal-overlay pm-picker-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var rows = filtered.map(function(s) {
        var safe = s.title.replace(/'/g, "\\'");
        var t = window.escHtml ? window.escHtml(s.title) : s.title;
        var b = window.escHtml ? window.escHtml(s.band || '') : (s.band || '');
        return '<div class="pm-picker-row" onclick="_pmPickerSelect(\''+focusType+'\',\''+safe+'\')">'+
               (b ? '<span class="pm-picker-band">'+b+'</span>' : '')+
               '<span class="pm-picker-title">'+t+'</span></div>';
    }).join('');

    overlay.innerHTML =
        '<div class="pm-picker-modal">'+
        '  <div class="pm-picker-header">'+
        '    <div class="pm-picker-title-h">'+titleLabel+'</div>'+
        '    <button class="pm-picker-close" onclick="document.getElementById(\'pmSongPickerOverlay\').remove()">✕</button>'+
        '  </div>'+
        '  <input class="pm-picker-search" type="text" placeholder="Search…" oninput="_pmPickerFilter(this.value)">'+
        '  <div class="pm-picker-list" id="pmPickerList">'+
            (rows || '<div class="pm-picker-empty">No matching songs.</div>')+
        '  </div>'+
        '</div>';

    document.body.appendChild(overlay);
    setTimeout(function() {
        var input = overlay.querySelector('.pm-picker-search');
        if (input) input.focus();
    }, 50);
};

window._pmPickerSelect = function _pmPickerSelect(focusType, songTitle) {
    var overlay = document.getElementById('pmSongPickerOverlay');
    if (overlay) overlay.remove();
    // Wave 1: all focus types open solo Practice mode (no session save modal,
    // no Band Sync bar). Wave 2 will pre-configure loop / stems / lyrics per
    // focusType before opening.
    _pmOpenSolo(songTitle);
};

window._pmPickerFilter = function _pmPickerFilter(query) {
    var q = (query || '').toLowerCase();
    var rows = document.querySelectorAll('#pmPickerList .pm-picker-row');
    rows.forEach(function(row) {
        var text = (row.textContent || '').toLowerCase();
        row.style.display = !q || text.indexOf(q) !== -1 ? '' : 'none';
    });
};

// ── Mixes Tab ─────────────────────────────────────────────────────────────────
async function _pmRenderMixesTab() {
    var el = document.getElementById('pm-panel-mixes');
    if (!el) return;
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-dim)">Loading mixes…</div>';

    _pmMixes = await _pmLoadMixes();
    _pmRedrawMixList();
}

function _pmRedrawMixList() {
    var el = document.getElementById('pm-panel-mixes');
    if (!el) return;

    var myMixes  = _pmMixes.filter(function(m){return !m.isShared || m.createdBy === _pmMyKey();});
    var bandMixes = _pmMixes.filter(function(m){return m.isShared && m.createdBy !== _pmMyKey();});

    var html = '';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
            '<div style="font-weight:700;font-size:0.95em">🎵 Practice Mixes</div>'+
            '<div style="display:flex;gap:6px">'+
            '<button class="btn btn-ghost btn-sm" onclick="pmGenerateWeakMix()" style="font-size:0.78em">⚠️ Auto from Readiness</button>'+
            '<button class="btn btn-primary btn-sm" onclick="pmNewMix()" style="font-size:0.78em">+ New Mix</button>'+
            '</div></div>';

    if (!_pmMixes.length) {
        html += '<div class="app-card" style="text-align:center;padding:28px;margin-bottom:16px">'+
                '<div style="font-size:2em;margin-bottom:8px">🎛️</div>'+
                '<div style="font-weight:700;margin-bottom:6px">No mixes yet</div>'+
                '<div style="font-size:0.85em;color:var(--text-dim)">Create a mix to organize songs for practice or rehearsal.</div>'+
                '</div>';
    } else {
        if (myMixes.length) {
            html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">MY MIXES</div>';
            html += myMixes.map(_pmMixCard).join('');
        }
        if (bandMixes.length) {
            html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;margin:16px 0 8px">BAND MIXES</div>';
            html += bandMixes.map(_pmMixCard).join('');
        }
    }

    // Editor pane (shown inline when creating/editing)
    html += '<div id="pm-mix-editor" style="display:none"></div>';

    el.innerHTML = html;
}

function _pmMixCard(mix) {
    var type = MIX_TYPES.find(function(t){return t.id===mix.type;}) || MIX_TYPES[0];
    var songs = mix.songIds || [];
    var shareTag = mix.isShared
        ? '<span style="font-size:0.7em;background:rgba(102,126,234,0.15);color:#818cf8;padding:2px 8px;border-radius:8px;font-weight:700;flex-shrink:0">Shared</span>'
        : '';
    return '<div class="app-card" style="margin-bottom:10px">'+
           '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
           '<span style="font-size:1.1em">'+type.emoji+'</span>'+
           '<div style="flex:1;min-width:0">'+
           '<div style="font-weight:700;font-size:0.9em;color:var(--text)">'+_pmEsc(mix.title)+'</div>'+
           '<div style="font-size:0.72em;color:var(--text-dim)">'+type.label+' · '+songs.length+' songs</div>'+
           '</div>'+
           shareTag+
           '<button onclick="pmEditMix(\''+mix.id+'\')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.85em;padding:4px 8px">✏️</button>'+
           '<button onclick="pmDeleteMix(\''+mix.id+'\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.85em;padding:4px 8px">🗑️</button>'+
           '</div>'+
           (songs.length
               ? '<div style="display:flex;flex-wrap:wrap;gap:4px">'+
                 songs.slice(0,6).map(function(s){
                     return '<span style="font-size:0.72em;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);padding:2px 8px;border-radius:8px;color:var(--text-muted)">'+_pmEsc(s)+'</span>';
                 }).join('')+
                 (songs.length>6?'<span style="font-size:0.72em;color:var(--text-dim)">+'+( songs.length-6)+' more</span>':'')+
                 '</div>'
               : '<div style="font-size:0.78em;color:var(--text-dim)">No songs yet</div>')+
           '</div>';
}

// ── Mix Editor ────────────────────────────────────────────────────────────────
window.pmNewMix = function pmNewMix() {
    _pmEditingMix = { id: null, title:'', type:'practice', songIds:[], isShared:false, createdBy: _pmMyKey() };
    _pmMixSongs = [];
    _pmShowEditor();
};

window.pmEditMix = function pmEditMix(mixId) {
    var mix = _pmMixes.find(function(m){return m.id===mixId;});
    if (!mix) return;
    _pmEditingMix = Object.assign({}, mix);
    _pmMixSongs = (mix.songIds || []).slice();
    _pmShowEditor();
};

function _pmShowEditor() {
    var el = document.getElementById('pm-mix-editor');
    if (!el) return;

    var typeOpts = MIX_TYPES.map(function(t){
        return '<option value="'+t.id+'"'+(_pmEditingMix.type===t.id?' selected':'')+'>'+t.emoji+' '+t.label+'</option>';
    }).join('');

    var songSearchHtml =
        '<input type="text" id="pm-song-search" placeholder="Type to search songs…" '+
        'style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:7px 10px;font-size:0.85em;font-family:inherit" '+
        'oninput="pmSongSearchFilter(this.value)" onclick="event.stopPropagation()">';

    var songListHtml = '<div id="pm-song-search-results" style="max-height:160px;overflow-y:auto;margin-top:6px"></div>';

    var addedHtml = _pmMixSongs.length
        ? '<div style="display:flex;flex-direction:column;gap:4px">'+
          _pmMixSongs.map(function(s,i){
              return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
                     '<span style="flex:1;font-size:0.85em;color:var(--text)">'+_pmEsc(s)+'</span>'+
                     (i>0?'<button onclick="pmMoveSong('+i+',-1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↑</button>':'<span style="width:26px"></span>')+
                     (i<_pmMixSongs.length-1?'<button onclick="pmMoveSong('+i+',1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↓</button>':'<span style="width:26px"></span>')+
                     '<button onclick="pmRemoveSong('+i+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px 6px">✕</button>'+
                     '</div>';
          }).join('')+
          '</div>'
        : '<div style="font-size:0.82em;color:var(--text-dim)">No songs added yet</div>';

    el.style.display = 'block';
    el.innerHTML =
        '<div class="app-card" style="margin-top:16px;border:1px solid rgba(102,126,234,0.3)">'+
        '<div style="font-weight:700;font-size:0.9em;margin-bottom:12px">'+(_pmEditingMix.id?'✏️ Edit Mix':'➕ New Mix')+'</div>'+

        '<span style="display:block;margin-bottom:10px">'+
        '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:4px">Mix Name</div>'+
        '<input type="text" id="pm-mix-title" value="'+_pmEsc(_pmEditingMix.title||'')+'" placeholder="e.g. Pre-Rehearsal Brush-Up" '+
        'style="width:100%;box-sizing:border-box;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:8px 10px;font-size:0.88em;font-family:inherit" '+
        'onclick="event.stopPropagation()"></label>'+

        '<span style="display:block;margin-bottom:12px">'+
        '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:4px">Type</div>'+
        '<select id="pm-mix-type" class="app-select" style="font-size:0.88em">'+typeOpts+'</select>'+
        '</label>'+

        '<div style="margin-bottom:12px">'+
        '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:6px">Songs ('+_pmMixSongs.length+')</div>'+
        '<div id="pm-added-songs">'+addedHtml+'</div>'+
        '<div style="margin-top:8px">'+songSearchHtml+songListHtml+'</div>'+
        '</div>'+

        '<label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer">'+
        '<input type="checkbox" id="pm-mix-shared" '+(_pmEditingMix.isShared?'checked':'')+' onclick="event.stopPropagation()">'+
        '<span style="font-size:0.85em;color:var(--text)">Share with band</span>'+
        '<span style="font-size:0.72em;color:var(--text-dim)">(bandmates can view this mix)</span>'+
        '</label>'+

        '<div style="display:flex;gap:8px">'+
        '<button class="btn btn-primary" onclick="pmSaveMix()" style="flex:1">💾 Save Mix</button>'+
        '<button class="btn btn-ghost" onclick="pmCancelEdit()">Cancel</button>'+
        '</div>'+
        '</div>';

    // Initial song search results (show all)
    pmSongSearchFilter('');
}

window.pmSongSearchFilter = function pmSongSearchFilter(term) {
    var el = document.getElementById('pm-song-search-results');
    if (!el) return;
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var filtered = songs.filter(function(s){
        return s.title.toLowerCase().includes(term.toLowerCase()) && !_pmMixSongs.includes(s.title);
    }).slice(0, 20);
    if (!filtered.length) {
        el.innerHTML = '<div style="font-size:0.8em;color:var(--text-dim);padding:6px">No matching songs</div>';
        return;
    }
    el.innerHTML = filtered.map(function(s){
        return '<div style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;transition:background 0.1s" '+
               'onmouseover="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseout="this.style.background=\'\'" '+
               'onclick="pmAddSongToMix(\''+s.title.replace(/'/g,"\\'")+'\')">'+
               '<span style="font-size:0.78em;color:var(--text-dim);min-width:28px">'+_pmEsc(s.band||'')+'</span>'+
               '<span style="font-size:0.85em;color:var(--text);flex:1">'+_pmEsc(s.title)+'</span>'+
               '<span style="font-size:0.8em;color:var(--accent-light)">+ Add</span>'+
               '</div>';
    }).join('');
};

window.pmAddSongToMix = function pmAddSongToMix(title) {
    if (!_pmMixSongs.includes(title)) {
        _pmMixSongs.push(title);
        _pmRefreshAddedSongs();
        // Re-filter to remove added song
        var searchEl = document.getElementById('pm-song-search');
        pmSongSearchFilter(searchEl ? searchEl.value : '');
    }
};

window.pmRemoveSong = function pmRemoveSong(idx) {
    _pmMixSongs.splice(idx, 1);
    _pmRefreshAddedSongs();
    var searchEl = document.getElementById('pm-song-search');
    pmSongSearchFilter(searchEl ? searchEl.value : '');
};

window.pmMoveSong = function pmMoveSong(idx, dir) {
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= _pmMixSongs.length) return;
    var tmp = _pmMixSongs[idx];
    _pmMixSongs[idx] = _pmMixSongs[newIdx];
    _pmMixSongs[newIdx] = tmp;
    _pmRefreshAddedSongs();
};

function _pmRefreshAddedSongs() {
    var el = document.getElementById('pm-added-songs');
    if (!el) return;
    var html = _pmMixSongs.length
        ? '<div style="display:flex;flex-direction:column;gap:4px">'+
          _pmMixSongs.map(function(s,i){
              return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
                     '<span style="flex:1;font-size:0.85em;color:var(--text)">'+_pmEsc(s)+'</span>'+
                     (i>0?'<button onclick="pmMoveSong('+i+',-1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↑</button>':'<span style="width:26px"></span>')+
                     (i<_pmMixSongs.length-1?'<button onclick="pmMoveSong('+i+',1)" style="background:none;border:none;color:var(--text-dim);cursor:pointer;padding:2px 6px">↓</button>':'<span style="width:26px"></span>')+
                     '<button onclick="pmRemoveSong('+i+')" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:2px 6px">✕</button>'+
                     '</div>';
          }).join('')+
          '</div>'
        : '<div style="font-size:0.82em;color:var(--text-dim)">No songs added yet</div>';
    el.innerHTML = html;
    // Update count label
    var countEl = el.closest('.app-card');
    if (countEl) {
        var lbl = countEl.querySelector('[id^="pm-added-songs"]')?.previousElementSibling;
        if (lbl) lbl.textContent = 'Songs (' + _pmMixSongs.length + ')';
    }
}

window.pmSaveMix = async function pmSaveMix() {
    var titleEl  = document.getElementById('pm-mix-title');
    var typeEl   = document.getElementById('pm-mix-type');
    var sharedEl = document.getElementById('pm-mix-shared');
    if (!titleEl) return;

    var title    = titleEl.value.trim();
    var type     = typeEl ? typeEl.value : 'practice';
    var isShared = sharedEl ? sharedEl.checked : false;

    if (!title) { if (typeof showToast==='function') showToast('Please enter a mix name'); return; }

    var mix = {
        title:     title,
        type:      type,
        songIds:   _pmMixSongs.slice(),
        isShared:  isShared,
        createdBy: _pmMyKey(),
        updatedAt: new Date().toISOString(),
    };

    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') {
            if (typeof showToast==='function') showToast('Not connected — sign in to save mixes');
            return;
        }
        var ref;
        if (_pmEditingMix && _pmEditingMix.id) {
            // Update existing
            mix.createdAt = _pmEditingMix.createdAt || mix.updatedAt;
            mix.shareSlug = _pmEditingMix.shareSlug || null;
            if (isShared && !mix.shareSlug) mix.shareSlug = _pmGenSlug(title);
            ref = firebaseDB.ref(bandPath('practice_mixes/' + _pmEditingMix.id));
            await ref.update(mix);
            mix.id = _pmEditingMix.id;
        } else {
            // Create new
            mix.createdAt = mix.updatedAt;
            if (isShared) mix.shareSlug = _pmGenSlug(title);
            ref = firebaseDB.ref(bandPath('practice_mixes')).push();
            mix.id = ref.key;
            await ref.set(mix);
        }

        // Update local list
        var idx = _pmMixes.findIndex(function(m){return m.id===mix.id;});
        if (idx >= 0) _pmMixes[idx] = mix; else _pmMixes.unshift(mix);

        _pmEditingMix = null;
        _pmMixSongs   = [];
        _pmRedrawMixList();
        if (typeof showToast==='function') showToast('Mix saved ✅');
    } catch(e) {
        console.error('[practice] saveMix failed:', e);
        if (typeof showToast==='function') showToast('Save failed — check connection');
    }
};

window.pmDeleteMix = async function pmDeleteMix(mixId) {
    if (!confirm('Delete this mix?')) return;
    try {
        if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
            await firebaseDB.ref(bandPath('practice_mixes/' + mixId)).remove();
        }
        _pmMixes = _pmMixes.filter(function(m){return m.id!==mixId;});
        _pmRedrawMixList();
        if (typeof showToast==='function') showToast('Mix deleted');
    } catch(e) {
        if (typeof showToast==='function') showToast('Delete failed');
    }
};

window.pmCancelEdit = function pmCancelEdit() {
    _pmEditingMix = null;
    _pmMixSongs   = [];
    var el = document.getElementById('pm-mix-editor');
    if (el) el.style.display = 'none';
};

// ── Auto-generate weak mix ────────────────────────────────────────────────────
window.pmGenerateWeakMix = async function pmGenerateWeakMix() {
    var rc = (typeof GLStore !== 'undefined') ? GLStore.getAllReadiness() : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    var weak = songs
        .map(function(s){
            var scores=rc[s.title]||{};
            var vals=Object.values(scores).filter(function(v){return typeof v==='number';});
            var avg=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:null;
            return {title:s.title,avg:avg};
        })
        .filter(function(s){return s.avg!==null&&s.avg<=2.5;})
        .sort(function(a,b){return a.avg-b.avg;})
        .map(function(s){return s.title;})
        .slice(0,15);

    if (!weak.length) {
        if (typeof showToast==='function') showToast('No weak songs found (avg ≤ 2.5)');
        return;
    }

    var today = new Date().toISOString().slice(0,10);
    _pmEditingMix = { id:null, title:'Weak Songs — '+today, type:'weak', songIds:[], isShared:false, createdBy:_pmMyKey() };
    _pmMixSongs = weak;
    pmSwitchTab('mixes');
    _pmShowEditor();
    if (typeof showToast==='function') showToast('Generated '+weak.length+' weak songs — review and save');
};

// ── Firebase helpers ──────────────────────────────────────────────────────────
async function _pmLoadMixes() {
    try {
        if (typeof firebaseDB==='undefined'||!firebaseDB||typeof bandPath!=='function') return [];
        var snap = await firebaseDB.ref(bandPath('practice_mixes')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.entries(val).map(function(entry){
            return Object.assign({}, entry[1], {id:entry[0]});
        }).sort(function(a,b){
            return (b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||'');
        });
    } catch(e) { return []; }
}

function _pmMyKey() {
    return typeof getCurrentMemberKey==='function' ? (getCurrentMemberKey()||'unknown') : 'unknown';
}

function _pmGenSlug(title) {
    // Generate a short URL-safe slug for sharing
    var base = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,20);
    var rand = Math.random().toString(36).slice(2,7);
    return base + '-' + rand;
}

function _pmEsc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Status map ────────────────────────────────────────────────────────────────
async function loadSongStatusMap() {
    try {
        // Primary: read from GLStore.getAllStatus() (statusCache)
        var cached = (window.GLStore && typeof GLStore.getAllStatus === 'function')
            ? GLStore.getAllStatus() : null;
        if (cached && typeof cached === 'object' && Object.keys(cached).length) {
            var map = {};
            Object.keys(cached).forEach(function(k) {
                var raw = cached[k];
                if (raw && typeof raw === 'string') {
                    map[k] = raw.toLowerCase().replace(/\s+/g, '_');
                } else if (raw && raw.status) {
                    map[k] = raw.status.toLowerCase().replace(/\s+/g, '_');
                }
            });
            return map;
        }
        // Fallback: try band-level key
        var allStatuses = await loadBandDataFromDrive('_band','song_statuses');
        if (!allStatuses||typeof allStatuses!=='object') return {};
        var map={};
        Object.keys(allStatuses).forEach(function(k){
            var v=allStatuses[k];
            var raw=(v&&v.status)?v.status:(typeof v==='string'?v:'');
            if(raw) map[k]=raw.toLowerCase().replace(/\s+/g,'_');
        });
        return map;
    } catch(e){return {};}
}

// ── Styles ────────────────────────────────────────────────────────────────────
function _pmInjectStyles(){
    if(document.getElementById('pm-styles'))return;
    var s=document.createElement('style');
    s.id='pm-styles';
    s.textContent=
    /* Tab strip container */
    '.pm-tab-strip{display:flex;gap:0;margin:0 0 16px;border-bottom:2px solid rgba(255,255,255,0.08);background:transparent;width:100%;}'+
    /* Individual tab */
    '.pm-tab{flex:1;padding:12px 8px;background:transparent;border:none;border-bottom:3px solid transparent;color:var(--text-muted,#94a3b8);cursor:pointer;font-weight:700;font-size:0.88em;transition:all 0.15s;font-family:inherit;-webkit-appearance:none;appearance:none;text-align:center;}'+
    '.pm-tab:hover{color:var(--text,#f1f5f9);background:rgba(255,255,255,0.04);}'+
    '.pm-tab--active{color:var(--accent,#667eea)!important;border-bottom-color:var(--accent,#667eea)!important;background:transparent!important;-webkit-text-fill-color:var(--accent,#667eea)!important;}'+
    /* Entry screen — Section A (recommended) + Section B (alternatives) */
    '.pm-section{margin-bottom:24px;}'+
    '.pm-section-label{font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim,#94a3b8);margin-bottom:10px;}'+
    /* Section A — primary recommendation card */
    '.pm-section-a .pm-primary-card{background:linear-gradient(135deg,rgba(102,126,234,0.12),rgba(118,75,162,0.08));border:1px solid rgba(102,126,234,0.25);border-radius:14px;padding:20px 20px 18px;}'+
    '.pm-primary-title{font-size:1.4em;font-weight:800;color:var(--text,#f1f5f9);line-height:1.2;margin-bottom:6px;letter-spacing:-0.01em;}'+
    '.pm-primary-reason{font-size:0.88em;color:var(--text-dim,#94a3b8);line-height:1.4;margin-bottom:16px;}'+
    '.pm-start-btn{width:100%;padding:14px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:800;font-size:1em;cursor:pointer;font-family:inherit;letter-spacing:0.02em;box-shadow:0 4px 16px rgba(102,126,234,0.32);transition:transform 0.1s ease,box-shadow 0.15s ease;}'+
    '.pm-start-btn:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(102,126,234,0.45);}'+
    '.pm-start-btn:active{transform:translateY(0);}'+
    /* Empty state */
    '.pm-empty-card{background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.12);border-radius:14px;padding:28px 20px;text-align:center;}'+
    '.pm-empty-emoji{font-size:2em;margin-bottom:8px;opacity:0.6;}'+
    '.pm-empty-msg{font-weight:700;color:var(--text,#f1f5f9);margin-bottom:4px;}'+
    '.pm-empty-sub{font-size:0.85em;color:var(--text-dim,#94a3b8);}'+
    /* Section B — focus chips */
    '.pm-chips{display:flex;flex-wrap:wrap;gap:8px;}'+
    '.pm-chips-more{margin-top:8px;}'+
    '.pm-chip{flex:1 1 calc(50% - 4px);min-width:140px;padding:11px 14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:var(--text,#f1f5f9);cursor:pointer;font-weight:600;font-size:0.86em;font-family:inherit;text-align:left;transition:background 0.12s ease,border-color 0.12s ease;-webkit-appearance:none;appearance:none;}'+
    '.pm-chip:hover:not(:disabled){background:rgba(102,126,234,0.1);border-color:rgba(102,126,234,0.3);}'+
    '.pm-chip-disabled{opacity:0.42;cursor:not-allowed;}'+
    '.pm-chip-resume{background:rgba(34,197,94,0.08);border-color:rgba(34,197,94,0.25);}'+
    '.pm-chip-resume:hover{background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.4);}'+
    '.pm-more-btn{display:block;margin:12px auto 0;padding:6px 14px;background:transparent;border:none;color:var(--text-dim,#94a3b8);cursor:pointer;font-size:0.78em;font-family:inherit;font-weight:600;letter-spacing:0.02em;}'+
    '.pm-more-btn:hover{color:var(--text,#f1f5f9);}'+
    /* Song picker modal */
    '.pm-picker-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;}'+
    '.pm-picker-modal{background:var(--bg-card,#1e293b);border:1px solid rgba(255,255,255,0.1);border-radius:14px;width:100%;max-width:520px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;}'+
    '.pm-picker-header{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);}'+
    '.pm-picker-title-h{font-weight:800;font-size:1.05em;color:var(--text,#f1f5f9);}'+
    '.pm-picker-close{background:transparent;border:none;color:var(--text-dim,#94a3b8);font-size:1.2em;cursor:pointer;padding:4px 10px;font-family:inherit;}'+
    '.pm-picker-close:hover{color:var(--text,#f1f5f9);}'+
    '.pm-picker-search{margin:12px 16px 0;padding:10px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text,#f1f5f9);font-family:inherit;font-size:0.9em;}'+
    '.pm-picker-search:focus{outline:none;border-color:rgba(102,126,234,0.5);}'+
    '.pm-picker-list{flex:1;overflow-y:auto;padding:8px 0;margin-top:8px;}'+
    '.pm-picker-row{display:flex;align-items:center;gap:10px;padding:10px 18px;cursor:pointer;font-size:0.9em;}'+
    '.pm-picker-row:hover{background:rgba(102,126,234,0.08);}'+
    '.pm-picker-band{color:var(--text-dim,#94a3b8);font-size:0.78em;min-width:36px;flex-shrink:0;}'+
    '.pm-picker-title{flex:1;color:var(--text,#f1f5f9);}'+
    '.pm-picker-empty{padding:24px;text-align:center;color:var(--text-dim,#94a3b8);font-size:0.88em;line-height:1.5;}'+
    /* Gig Prep header variant */
    '.pm-gig-header{align-items:flex-start;}'+
    '.pm-gig-eyebrow{font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#a5b4fc;margin-bottom:2px;}'+
    '.pm-gig-subtitle{font-size:0.8em;color:var(--text-dim,#94a3b8);margin-top:4px;}'+
    '.pm-gig-avg{font-size:0.78em;font-weight:700;min-width:30px;text-align:right;flex-shrink:0;}'+
    /* "Other upcoming gigs" switcher list at bottom of Gig Prep modal */
    '.pm-gig-other-list{border-top:1px solid rgba(255,255,255,0.06);padding:10px 0 6px;background:rgba(255,255,255,0.015);}'+
    '.pm-gig-other-label{font-size:0.68em;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-dim,#94a3b8);padding:6px 18px 8px;}'+
    '.pm-gig-other-row{display:flex;align-items:center;gap:12px;padding:9px 18px;cursor:pointer;font-size:0.86em;}'+
    '.pm-gig-other-row:hover{background:rgba(102,126,234,0.08);}'+
    '.pm-gig-other-date{color:#a5b4fc;font-weight:700;min-width:88px;flex-shrink:0;}'+
    '.pm-gig-other-venue{flex:1;color:var(--text,#f1f5f9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
    '.pm-gig-other-arrow{color:var(--text-dim,#94a3b8);font-size:0.9em;flex-shrink:0;}';
    document.head.appendChild(s);
}

window.renderPracticePage = renderPracticePage;
window.loadSongStatusMap  = loadSongStatusMap;

// ── Live re-render on focus changes ──────────────────────────────────────────
// Section A reads getNowFocus() — if readiness changes elsewhere (rehearsal
// scoring, status flip, etc.) the focus engine emits 'focusChanged' and we
// re-render the entry screen so the recommendation stays current. Only
// re-render when Practice is the visible page and Focus is the active tab.
if (typeof GLStore !== 'undefined' && GLStore.on) {
    GLStore.on('focusChanged', function() {
        if (typeof currentPage !== 'undefined' && currentPage !== 'practice') return;
        if (_pmTab !== 'focus') return;
        var el = document.getElementById('pm-panel-focus');
        if (!el) return;
        _pmRenderFocusTab();
    });
}
