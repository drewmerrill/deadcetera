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

    var ps = (typeof GLStore !== 'undefined' && GLStore.PracticeSession) ? GLStore.PracticeSession : null;
    var resumeInfo = (ps && ps.has()) ? ps.describe() : null;

    // Stage 1: paint immediately with focus-only items so the user sees
    // something within ~50ms (Practice page must hit < 1s SLA per Drew's
    // music-surface rule). Section B + Resume chip don't need tasks.
    el.innerHTML = _pmRenderCommandCenter(_pmBuildItemsFromFocus(focus)) +
                   _pmRenderSectionB(resumeInfo);

    // Stage 2: load open PracticeTasks async, then re-render Section A
    // with tasks merged in at the top. ~200-500ms typical Firebase RTT.
    _pmLoadOpenPracticeTasks().then(function(tasks) {
        var fullItems = _pmMergeTasksIntoFocus(tasks, focus);
        var sectionAEl = el.querySelector('.pm-section-a');
        if (sectionAEl) {
            var tmp = document.createElement('div');
            tmp.innerHTML = _pmRenderCommandCenter(fullItems);
            sectionAEl.replaceWith(tmp.firstElementChild);
        }
    }).catch(function(e) { console.warn('[pm] tasks load failed', e); });

    if (typeof performance !== 'undefined') {
        console.log('[PERF] practice-entry-rendered', Math.round(performance.now() - t0), 'ms');
    }
}

// ── Command Center: 3-5 items, one click to start, no thinking ─────────
// Per spec — "User opens Practice and knows what to do in under 3
// seconds." Sources: open PracticeTasks (most relevant) + FocusEngine
// candidates (already weights low-readiness, gig urgency, setlist
// membership, rehearsal issues).

function _pmBuildItemsFromFocus(focus) {
    var list = (focus && focus.list) || [];
    return list.map(function(c) {
        return {
            songTitle: c.title,
            reason: _pmReasonForFocusCandidate(c, focus),
            source: 'focus',
            avg: c.avg,
            inSetlist: c.inSetlist
        };
    }).slice(0, 5);
}

function _pmMergeTasksIntoFocus(tasks, focus) {
    var items = [];
    // Tasks first — explicit user intent beats algorithmic recommendation
    (tasks || []).slice(0, 3).forEach(function(t) {
        var raw = (t.noteText || '').trim();
        var reason = raw
            ? '"' + (raw.length > 80 ? raw.slice(0, 80) + '…' : raw) + '"'
            : 'Practice task from rehearsal';
        items.push({
            songTitle: t.songTitle || t.songId || '',
            reason: reason,
            source: 'task',
            taskId: t.taskId,
            timestampSec: t.timestampSec,
            trackId: t.trackId
        });
    });
    // Fill the rest with focus candidates
    _pmBuildItemsFromFocus(focus).forEach(function(it) { items.push(it); });
    // Dedup by songTitle, cap at 5
    var seen = {};
    return items.filter(function(it) {
        if (!it.songTitle || seen[it.songTitle]) return false;
        seen[it.songTitle] = true;
        return true;
    }).slice(0, 5);
}

function _pmReasonForFocusCandidate(c, focus) {
    var avg = c.avg || 0;
    var bits = [];
    if (avg < 2)      bits.push('Low readiness · avg ' + avg.toFixed(1));
    else if (avg < 3) bits.push('Almost there · avg ' + avg.toFixed(1));
    else              bits.push('Needs polish · avg ' + avg.toFixed(1));
    if (c.inSetlist) bits.push('in setlist');
    return bits.join(' · ');
}

async function _pmLoadOpenPracticeTasks() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return [];
    try {
        var snap = await db.ref(bandPath('practice_tasks')).once('value');
        var all = snap.val() || {};
        return Object.keys(all)
            .map(function(k) { return all[k]; })
            .filter(function(t) {
                if (!t) return false;
                return !t.status || t.status === 'open' || t.status === 'in-progress';
            })
            .sort(function(a, b) {
                return (b.createdAt || 0) > (a.createdAt || 0) ? 1 : -1;
            });
    } catch (e) {
        return [];
    }
}

function _pmRenderCommandCenter(items) {
    var esc = window.escHtml || function(s) { return String(s == null ? '' : s); };
    if (!items || !items.length) {
        return ''+
        '<div class="pm-section pm-section-a pm-section-a-empty">'+
        '  <div class="pm-section-label">🎯 Today\'s Focus</div>'+
        '  <div class="pm-empty-card">'+
        '    <div class="pm-empty-emoji">🎸</div>'+
        '    <div class="pm-empty-msg">Nothing flagged for practice right now.</div>'+
        '    <div class="pm-empty-sub">Pick a focus below to get started.</div>'+
        '  </div>'+
        '</div>';
    }
    var rows = items.map(function(it, i) {
        var safe = it.songTitle.replace(/'/g, "\\'");
        var tsLabel = (typeof it.timestampSec === 'number')
            ? Math.floor(it.timestampSec / 60) + ':' + (Math.floor(it.timestampSec % 60) < 10 ? '0' : '') + Math.floor(it.timestampSec % 60)
            : '';
        var icon = it.source === 'task' ? '🎯' : (it.inSetlist ? '🎤' : '🎸');
        var taskAttr = it.taskId ? ",'" + String(it.taskId).replace(/'/g, "\\'") + "'" : ',null';
        return '<button class="pm-cc-item" onclick="window._pmCCStart(\'' + safe + '\'' + taskAttr + ')">' +
            '<div class="pm-cc-rank">' + (i + 1) + '</div>' +
            '<div class="pm-cc-icon">' + icon + '</div>' +
            '<div class="pm-cc-body">' +
                '<div class="pm-cc-title">' + esc(it.songTitle) +
                    (tsLabel ? ' <span class="pm-cc-ts">' + tsLabel + '</span>' : '') +
                '</div>' +
                '<div class="pm-cc-reason">' + esc(it.reason) + '</div>' +
            '</div>' +
            '<div class="pm-cc-cta">▶</div>' +
        '</button>';
    }).join('');
    var first = items[0];
    var firstSafe = first.songTitle.replace(/'/g, "\\'");
    var firstTaskAttr = first.taskId ? ",'" + String(first.taskId).replace(/'/g, "\\'") + "'" : ',null';
    var firstReason = first.reason ? esc(first.reason) : '';
    return ''+
    '<div class="pm-section pm-section-a">'+
    '  <div class="pm-section-label">🎯 Today\'s Focus</div>'+
    '  <div class="pm-cc-list">' + rows + '</div>'+
    '  <button class="pm-start-btn pm-cc-start" onclick="window._pmCCStart(\'' + firstSafe + '\'' + firstTaskAttr + ')" title="Launches the #1 focus song. Click any other song row above to practice that one instead.">'+
    '    <div class="pm-cc-start-main">▶ Start with #1: ' + esc(first.songTitle) + '</div>'+
    (firstReason ? '    <div class="pm-cc-start-sub">' + firstReason + '</div>' : '')+
    '  </button>'+
    '</div>';
}

// One-click launcher — routes through the Workbench shell which handles
// loop window, track emphasis, and task highlight via existing
// _wbApplyTaskContext path. Fallback to _pmStart('improve', title) if
// Workbench isn't loaded for some reason (defensive).
window._pmCCStart = function(songTitle, taskId) {
    if (!songTitle) return;
    if (typeof openWorkbench === 'function') {
        openWorkbench(songTitle, 'practice', taskId ? { taskId: taskId } : {});
    } else if (typeof _pmStart === 'function') {
        _pmStart('improve', songTitle);
    }
};

// Kept for backward compatibility with any callers that still reference
// the old single-card render path. New code should not call this.
function _pmRenderSectionA(focus) {
    return _pmRenderCommandCenter(_pmBuildItemsFromFocus(focus));
}

function _pmRenderSectionB(resumeInfo) {
    var resumeChip;
    var quickNoteAffordance = '';
    if (resumeInfo) {
        // Resume chip shows what you were working on at a glance:
        // "🔁 Resume: Wonderwall · Loop 0:12-0:29 · 4 min ago"
        var bits = [resumeInfo.songTitle];
        if (resumeInfo.sectionLabel) bits.push('Loop ' + resumeInfo.sectionLabel);
        else if (resumeInfo.modeLabel && resumeInfo.modeLabel !== 'Focus') bits.push(resumeInfo.modeLabel);
        var label = bits.join(' · ');
        var ageStr = resumeInfo.ageStr ? (' · ' + resumeInfo.ageStr) : '';
        var safe = (window.escHtml ? window.escHtml(label) : label) + (window.escHtml ? window.escHtml(ageStr) : ageStr);
        resumeChip = '<button class="pm-chip pm-chip-resume" onclick="_pmStart(\'resume\')" title="Pick up where you left off">🔁 Resume: ' + safe + '</button>';
        // Quick Note affordance — only renders when an active session exists.
        // First Workbench Notes use case: capture a critique mid-practice
        // ("the bridge drag", "lyric in v2 is wrong") without breaking flow.
        quickNoteAffordance =
            '<div class="pm-quick-note">'+
            '  <button class="pm-chip pm-chip-quick-note" onclick="_pmOpenQuickNote()" title="Jot a personal note about this practice session">📝 Quick Note</button>'+
            '  <div id="pm-quick-note-form" class="pm-quick-note-form" hidden>'+
            '    <textarea id="pm-quick-note-text" placeholder="What do you want to revisit later? Problem spots, breakthroughs, things to fix… (saved with this practice session)" rows="2"></textarea>'+
            '    <div class="pm-quick-note-actions">'+
            '      <button class="pm-chip" onclick="_pmSaveQuickNote()">Save</button>'+
            '      <button class="pm-chip pm-chip-ghost" onclick="_pmCloseQuickNote()">Cancel</button>'+
            '    </div>'+
            '  </div>'+
            '</div>';
    } else {
        resumeChip = '<button class="pm-chip pm-chip-disabled" disabled title="No saved session yet">🔁 Resume Last Session</button>';
    }
    return ''+
    '<div class="pm-section pm-section-b">'+
    '  <div class="pm-section-label">Or choose your focus</div>'+
    '  <div class="pm-chips">'+
         resumeChip +
    '    <button class="pm-chip" onclick="_pmStart(\'gig-prep\')">🎤 Gig Prep</button>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'improve\')">🎸 Improve a Song</button>'+
    '  </div>'+
       quickNoteAffordance +
    '  <button class="pm-more-btn" onclick="_pmToggleMore(this)">More options ▼</button>'+
    '  <div class="pm-chips pm-chips-more" hidden>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'learn\')">🎶 Learn New Song</button>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'harmony\')">🎧 Harmony Practice</button>'+
    '    <button class="pm-chip" onclick="_pmShowSongPicker(\'chart\')">📄 Lyrics / Chords</button>'+
    '  </div>'+
    '</div>';
}

// Quick Note: open inline textarea on the Practice entry screen for the
// active practice session. Persists via PracticeSession.addNote → GLNotes
// 'personal_critique' scope (per-user, per-song).
window._pmOpenQuickNote = function _pmOpenQuickNote() {
    var form = document.getElementById('pm-quick-note-form');
    if (!form) return;
    form.hidden = false;
    var ta = document.getElementById('pm-quick-note-text');
    if (ta) { ta.value = ''; ta.focus(); }
};

window._pmCloseQuickNote = function _pmCloseQuickNote() {
    var form = document.getElementById('pm-quick-note-form');
    if (form) form.hidden = true;
    var ta = document.getElementById('pm-quick-note-text');
    if (ta) ta.value = '';
};

window._pmSaveQuickNote = async function _pmSaveQuickNote() {
    var ta = document.getElementById('pm-quick-note-text');
    if (!ta) return;
    var text = (ta.value || '').trim();
    if (!text) { _pmCloseQuickNote(); return; }
    var ps = (typeof GLStore !== 'undefined' && GLStore.PracticeSession) ? GLStore.PracticeSession : null;
    if (!ps || typeof ps.addNote !== 'function') {
        if (typeof showToast === 'function') showToast('⚠️ Notes not available');
        return;
    }
    try {
        var ok = await ps.addNote(text);
        if (ok) {
            _pmCloseQuickNote();
            if (typeof showToast === 'function') showToast('📝 Note saved');
        } else {
            if (typeof showToast === 'function') showToast('⚠️ Could not save note');
        }
    } catch (e) {
        if (typeof showToast === 'function') showToast('⚠️ Could not save note');
    }
};

// focusType → mode mapping (Wave 2). Mode is the user's intent for this
// session, persisted in PracticeSession and read by chart-overlay code to
// pre-configure stems / lyrics / chord visibility on open.
function _pmModeForFocus(focusType) {
    switch (focusType) {
        case 'learn':   return 'learn';
        case 'harmony': return 'harmony';
        case 'chart':   return 'chart';
        case 'recommended':
        case 'gig-prep':
        case 'improve':
        default:        return 'focus';
    }
}

window._pmStart = function _pmStart(focusType, songTitle) {
    if (focusType === 'recommended' && songTitle) {
        _pmOpenSolo(songTitle, 'focus');
        return;
    }
    if (focusType === 'gig-prep') {
        _pmStartGigPrep();
        return;
    }
    if (focusType === 'resume') {
        _pmResumeSession();
        return;
    }
    if (songTitle) _pmOpenSolo(songTitle, _pmModeForFocus(focusType));
};

// Open a single song into the song-detail page's Stems lens — that's
// where the loop bar, mute-stem presets, and the GrooveMate suggestion
// pill all live. The chart overlay (openRehearsalMode*) is a chord-chart-
// only surface with no audio controls; routing Practice users there leaves
// them with nowhere to actually loop.
//
// PracticeSession.start() is called BEFORE navigation so the save hooks
// (_sdNotifyPracticeSessionLoop / Stems in song-detail.js) write into the
// existing session record rather than racing to create one.
function _pmOpenSolo(songTitle, mode) {
    if (!songTitle) return;
    mode = mode || 'focus';

    // Record the focus/mode for downstream surfaces (Workbench, charts,
    // recommendations). Independent of the routing target below.
    if (typeof GLStore !== 'undefined' && GLStore.PracticeSession) {
        try {
            GLStore.PracticeSession.start(songTitle, mode, { songTitle: songTitle });
        } catch (e) {
            console.warn('[Practice] PracticeSession.start failed:', e && e.message);
        }
    }

    // Practice intent → Workbench (per the controlled migration 2026-05-10).
    // Falls through to the legacy selectSong + Stems-lens path if Workbench
    // isn't loaded; that path in turn falls back to the chart overlay.
    if (typeof openWorkbench === 'function') {
        openWorkbench(songTitle, 'practice', {});
        return;
    }
    if (typeof selectSong === 'function') {
        selectSong(songTitle);
        setTimeout(function() {
            if (typeof switchLens === 'function') {
                try { switchLens('stems'); } catch (e) { console.warn('[Practice] switchLens failed:', e && e.message); }
            }
        }, 200);
        return;
    }
    // Last-resort fallback to the chart overlay.
    var songList = typeof allSongs !== 'undefined' ? allSongs : [];
    var songData = songList.find(function(s) { return s.title === songTitle; });
    var queue = [{ title: songTitle, band: songData ? (songData.band || '') : '' }];
    if (typeof openRehearsalModePractice === 'function') {
        openRehearsalModePractice(queue);
    } else if (typeof openRehearsalMode === 'function') {
        openRehearsalMode(songTitle);
    }
}

// Resume the saved PracticeSession. Re-opens chart overlay for the saved
// song, then re-arms loop and stems via GLActions on a setTimeout (the
// overlay needs a tick to mount its DOM before action handlers can run —
// matches the rmStartEdit pattern at rehearsal-mode.js line 88).
function _pmResumeSession() {
    if (typeof GLStore === 'undefined' || !GLStore.PracticeSession) {
        if (typeof showToast === 'function') showToast('Session storage not ready');
        return;
    }
    var ps = GLStore.PracticeSession;
    var session = ps.get();
    if (!session) {
        if (typeof showToast === 'function') showToast('No saved session to resume');
        return;
    }

    var songTitle = session.songTitle || session.songId;
    var mode = session.mode || 'focus';

    // Open song-detail page → Stems lens. PracticeSession.start() inside
    // _pmOpenSolo sees the same songId and preserves section/settings via
    // the sameSong path.
    _pmOpenSolo(songTitle, mode);

    // Re-arm saved configuration after navigation + lens switch + stems load.
    // Total budget: 1200ms — selectSong → showPage (~50ms) → switchLens
    // (~200ms) → stems async load (~500-800ms typical). GLActions calls bail
    // gracefully if stems aren't loaded yet so a too-short delay only means
    // the loop/preset doesn't apply, not a crash.
    setTimeout(function() {
        try {
            if (session.section && typeof session.section.in === 'number' && typeof session.section.out === 'number') {
                if (typeof GLActions !== 'undefined' && GLActions.run) {
                    GLActions.run('stems.setLoop', {
                        inSec: session.section.in,
                        outSec: session.section.out,
                        enabled: true
                    });
                }
            }
            var s = session.settings || {};
            if (s.stemPreset === 'mute-stem' && s.stemId) {
                if (typeof GLActions !== 'undefined' && GLActions.run) {
                    GLActions.run('stems.applyPracticeMode', {
                        mode: 'mute-stem',
                        stemId: s.stemId
                    });
                }
            }
            console.log('[PracticeSession] resumed', songTitle, 'mode=' + mode);
        } catch (e) {
            console.warn('[PracticeSession] resume re-arm failed:', e && e.message);
        }
    }, 1200);
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

    // Stash the full song list so "Run the Gig" can grab it without
    // re-walking the setlist. Keyed per-gig so back-and-forth between
    // gigs in the modal stays correct.
    _pmGigPrepFullSongs[_pmGigKey(gig)] = allSongsInSetlist.map(function(s) { return s.title; });

    _pmShowGigPrepModal(gig, setlist, needsWork, allSongsInSetlist.length);
}

// Per-gig stash of the full setlist song list, populated by
// _pmRenderGigPrepForGig and read by _pmStartGigRun when the user clicks
// "Run the Gig" from the modal.
var _pmGigPrepFullSongs = {};

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

    // "Run the Gig" CTA — only meaningful when the gig has a setlist with
    // songs in it. Estimated time uses 90s per song (the default per-song
    // budget for a quick run).
    var runCta = '';
    if (setlist && totalCount) {
        var estMin = Math.max(1, Math.round((totalCount * 90) / 60));
        var safeKey = _pmGigKey(gig).replace(/'/g, "\\'");
        runCta =
            '<div class="pm-gig-mode-row">'+
            '  <button class="pm-gig-mode-btn pm-gig-mode-run" onclick="_pmStartGigRun(\''+safeKey+'\')">'+
            '    <div class="pm-gig-mode-title">🏃 Run the Gig</div>'+
            '    <div class="pm-gig-mode-sub">Touch all '+totalCount+' songs · ~'+estMin+' min</div>'+
            '  </button>'+
            '  <div class="pm-gig-mode-or">or pick one to focus on ↓</div>'+
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
        runCta +
        '  <div class="pm-picker-list" id="pmPickerList">'+bodyRows+'</div>'+
        otherGigsHtml +
        '</div>';
    document.body.appendChild(overlay);
}

window._pmSwitchGig = function _pmSwitchGig(gigKey) {
    var target = _pmGigPrepUpcoming.find(function(g) { return _pmGigKey(g) === gigKey; });
    if (target) _pmRenderGigPrepForGig(target);
};

// ── Run the Gig ─────────────────────────────────────────────────────────
// Multi-song queue runner for the selected gig's setlist. Per-song budget
// defaults to 90s; auto-advances unless paused; supports prev/next/jump.
// Drew spec 2026-05-10: "Workbench remains one surface with contextual
// tools" — the run is a contextual strip rendered above the Workbench
// header, not a new mode tab.
window._gigRunState = null;
var _gigRunGen = 0;  // generation counter — bumped on every state change
                     // so stale interval/timeout callbacks can bail out

window._pmStartGigRun = function _pmStartGigRun(gigKey) {
    var songs = _pmGigPrepFullSongs[gigKey] || [];
    if (!songs.length) {
        if (typeof showToast === 'function') showToast('No songs in this gig\'s setlist');
        return;
    }
    // Defensive: if a prior run is somehow still active, nuke it cleanly
    // before starting a new one. _pmStartGigRun → multiple times caused
    // the cycling bug.
    if (window._gigRunState) {
        _gigRunFinish(true);
    }
    // Close the picker modal so the Workbench surface is visible.
    var modal = document.getElementById('pmSongPickerOverlay');
    if (modal) modal.remove();

    window._gigRunState = {
        gen: ++_gigRunGen,
        songs: songs.slice(),
        idx: 0,
        perSongSec: 90,
        remainingSec: 90,
        paused: false,
        autoAdvance: false,   // Manual by default — timer is a guide, not a
                              // forcing function. User toggles 🔁 Auto in
                              // the strip to opt into auto-advance per run.
        intervalId: null,
        openTimeoutId: null,
        startedAt: Date.now(),
        gigKey: gigKey
    };
    _gigRunOpenCurrent();
};

window._gigRunToggleAuto = function() {
    var st = window._gigRunState;
    if (!st) return;
    st.autoAdvance = !st.autoAdvance;
    // If they just enabled auto and the timer was already at 0, advance now.
    if (st.autoAdvance && st.remainingSec <= 0) {
        window._gigRunNext();
        return;
    }
    // Restart the timer if it was stopped at 0:00 in manual mode and they
    // turned auto on (so countdown can complete and trigger advance).
    if (st.autoAdvance && !st.intervalId && !st.paused) _gigRunStartTimer();
    _gigRunRenderStrip();
};

// Emergency kill switch — surfaceable from console for debugging.
// Also called by _wbClose etc. so abandoned runs don't keep ticking.
window._gigRunKill = function() {
    var st = window._gigRunState;
    if (st) {
        if (st.intervalId) clearInterval(st.intervalId);
        if (st.openTimeoutId) clearTimeout(st.openTimeoutId);
    }
    window._gigRunState = null;
    _gigRunGen++; // invalidate any stale closures still pending
    var strip = document.getElementById('gigRunStrip');
    if (strip) strip.remove();
    var menu = document.getElementById('gigRunJumpMenu');
    if (menu) menu.remove();
};

function _gigRunOpenCurrent() {
    var st = window._gigRunState;
    if (!st) return;
    if (st.idx < 0 || st.idx >= st.songs.length) {
        _gigRunFinish();
        return;
    }
    st.remainingSec = st.perSongSec;
    // Clear ALL pending timers/timeouts so stale callbacks don't fire
    // _gigRunNext after we've already advanced.
    if (st.intervalId) { clearInterval(st.intervalId); st.intervalId = null; }
    if (st.openTimeoutId) { clearTimeout(st.openTimeoutId); st.openTimeoutId = null; }
    // Bump generation so any in-flight closure (e.g. an interval tick
    // that's already queued in the event loop) bails out on next fire.
    var capturedGen = ++_gigRunGen;
    st.gen = capturedGen;
    if (typeof openWorkbench === 'function') {
        openWorkbench(st.songs[st.idx], 'practice', { gigRun: true });
    }
    // Defer strip refresh + timer until Workbench has had a moment to mount.
    st.openTimeoutId = setTimeout(function() {
        // Stale check — if state changed between when we queued this and
        // when it fires, bail.
        if (!window._gigRunState || window._gigRunState.gen !== capturedGen) return;
        _gigRunRenderStrip();
        if (!window._gigRunState.paused) _gigRunStartTimer();
    }, 100);
}

function _gigRunStartTimer() {
    var st = window._gigRunState;
    if (!st) return;
    if (st.intervalId) clearInterval(st.intervalId);
    var capturedGen = st.gen;
    // Use a local timer ref so the callback can self-clear on stale gen.
    var localTimerId = setInterval(function() {
        // Stale-callback guard — fixes the rapid-cycling bug.
        var cur = window._gigRunState;
        if (!cur || cur.gen !== capturedGen) {
            clearInterval(localTimerId);
            return;
        }
        if (cur.paused) return;
        if (cur.remainingSec <= 0) {
            // Manual mode: timer already at 0, just stop counting. The user
            // will click ⏭ Next when they're ready. We keep the strip alive
            // showing 0:00 so the budget is visible but no advance fires.
            if (!cur.autoAdvance) {
                clearInterval(localTimerId);
                cur.intervalId = null;
                _gigRunRefreshTimerOnly();
                return;
            }
            // Auto mode: advance.
            window._gigRunNext();
            return;
        }
        cur.remainingSec--;
        _gigRunRefreshTimerOnly();
        if (cur.remainingSec <= 0 && cur.autoAdvance) {
            window._gigRunNext();
        }
    }, 1000);
    st.intervalId = localTimerId;
}

window._gigRunNext = function() {
    var st = window._gigRunState;
    if (!st) return;
    if (st.intervalId) { clearInterval(st.intervalId); st.intervalId = null; }
    if (st.openTimeoutId) { clearTimeout(st.openTimeoutId); st.openTimeoutId = null; }
    st.idx++;
    if (st.idx >= st.songs.length) { _gigRunFinish(); return; }
    _gigRunOpenCurrent();
};

window._gigRunBack = function() {
    var st = window._gigRunState;
    if (!st) return;
    if (st.intervalId) { clearInterval(st.intervalId); st.intervalId = null; }
    if (st.openTimeoutId) { clearTimeout(st.openTimeoutId); st.openTimeoutId = null; }
    st.idx = Math.max(0, st.idx - 1);
    _gigRunOpenCurrent();
};

window._gigRunPause = function() {
    var st = window._gigRunState;
    if (!st) return;
    st.paused = !st.paused;
    if (st.paused && st.intervalId) { clearInterval(st.intervalId); st.intervalId = null; }
    else if (!st.paused) _gigRunStartTimer();
    _gigRunRenderStrip();
};

window._gigRunJump = function(idx) {
    var st = window._gigRunState;
    if (!st) return;
    if (idx < 0 || idx >= st.songs.length) return;
    if (st.intervalId) { clearInterval(st.intervalId); st.intervalId = null; }
    if (st.openTimeoutId) { clearTimeout(st.openTimeoutId); st.openTimeoutId = null; }
    st.idx = idx;
    // Close the jump menu if it's open.
    var menu = document.getElementById('gigRunJumpMenu');
    if (menu) menu.remove();
    _gigRunOpenCurrent();
};

window._gigRunToggleJumpMenu = function() {
    var existing = document.getElementById('gigRunJumpMenu');
    if (existing) { existing.remove(); return; }
    var st = window._gigRunState;
    if (!st) return;
    var menu = document.createElement('div');
    menu.id = 'gigRunJumpMenu';
    menu.className = 'gig-run-jump-menu';
    menu.innerHTML = st.songs.map(function(title, i) {
        var isActive = (i === st.idx);
        var safeTitle = (window.escHtml ? window.escHtml(title) : title);
        return '<button class="gig-run-jump-item' + (isActive ? ' is-active' : '') + '" onclick="_gigRunJump(' + i + ')">' +
               '<span class="gig-run-jump-rank">' + (i + 1) + '</span>' +
               '<span class="gig-run-jump-title">' + safeTitle + '</span>' +
               (isActive ? '<span class="gig-run-jump-now">now</span>' : '') +
               '</button>';
    }).join('');
    document.body.appendChild(menu);
};

window._gigRunEnd = function() {
    if (!confirm('End this run?')) return;
    _gigRunFinish(true);
};

function _gigRunFinish(canceled) {
    var st = window._gigRunState;
    if (!st) return;
    if (st.intervalId) clearInterval(st.intervalId);
    if (st.openTimeoutId) clearTimeout(st.openTimeoutId);
    var doneCount = canceled ? st.idx : st.songs.length;
    var elapsedMin = Math.max(1, Math.round((Date.now() - st.startedAt) / 60000));
    window._gigRunState = null;
    _gigRunGen++;  // invalidate any in-flight stale closures
    var strip = document.getElementById('gigRunStrip');
    if (strip) strip.remove();
    var menu = document.getElementById('gigRunJumpMenu');
    if (menu) menu.remove();
    if (typeof showToast === 'function') {
        showToast(canceled
            ? '🏁 Run ended — ' + doneCount + ' of ' + st.songs.length + ' songs in ' + elapsedMin + ' min'
            : '🎉 Run complete — ' + doneCount + ' songs in ' + elapsedMin + ' min'
        );
    }
}

// Render or refresh the gig-run strip pinned at the very top of the page.
// Inserted into <body> directly so it persists across openWorkbench calls
// (which rebuild the #page-workbench DOM each time).
function _gigRunRenderStrip() {
    var st = window._gigRunState;
    var existing = document.getElementById('gigRunStrip');
    if (!st) { if (existing) existing.remove(); return; }
    var pos = (st.idx + 1) + ' / ' + st.songs.length;
    var title = st.songs[st.idx];
    var safeTitle = (window.escHtml ? window.escHtml(title) : title);
    var pauseLabel = st.paused ? '▶ Resume' : '⏸ Pause';
    if (!existing) {
        existing = document.createElement('div');
        existing.id = 'gigRunStrip';
        existing.className = 'gig-run-strip';
        document.body.appendChild(existing);
    }
    var autoLabel = st.autoAdvance ? '🔁 Auto: ON' : '🔁 Auto: OFF';
    var autoCls = st.autoAdvance ? 'gig-run-btn gig-run-btn-auto-on' : 'gig-run-btn gig-run-btn-auto-off';
    existing.innerHTML =
        '<div class="gig-run-eyebrow">🏃 RUN · ' + pos + '</div>' +
        '<div class="gig-run-title">' + safeTitle + '</div>' +
        '<div class="gig-run-timer" id="gigRunTimer">' + _gigRunFormatTime(st.remainingSec) + '</div>' +
        '<div class="gig-run-controls">' +
            '<button class="gig-run-btn" onclick="_gigRunBack()" title="Previous song">⏪</button>' +
            '<button class="gig-run-btn gig-run-btn-pause" onclick="_gigRunPause()" title="Pause / Resume timer">' + pauseLabel + '</button>' +
            '<button class="gig-run-btn gig-run-btn-next" onclick="_gigRunNext()" title="Next song (move on when ready)">⏭ Next</button>' +
            '<button class="gig-run-btn" onclick="_gigRunToggleJumpMenu()" title="Jump to any song">☰</button>' +
            '<button class="' + autoCls + '" onclick="_gigRunToggleAuto()" title="Toggle auto-advance when timer hits 0">' + autoLabel + '</button>' +
            '<button class="gig-run-btn gig-run-btn-end" onclick="_gigRunEnd()" title="End run">✕</button>' +
        '</div>';
}

function _gigRunRefreshTimerOnly() {
    var el = document.getElementById('gigRunTimer');
    var st = window._gigRunState;
    if (!el || !st) return;
    el.textContent = _gigRunFormatTime(st.remainingSec);
    if (st.remainingSec <= 10) el.classList.add('gig-run-timer-warn');
    else el.classList.remove('gig-run-timer-warn');
}

function _gigRunFormatTime(sec) {
    sec = Math.max(0, sec | 0);
    return Math.floor(sec / 60) + ':' + (sec % 60 < 10 ? '0' : '') + (sec % 60);
}

// Safety-net listener for the custom event Workbench dispatches when
// it re-renders. The normal _gigRunOpenCurrent path already refreshes
// the strip via setTimeout; this handles direct openWorkbench jumps
// from outside the run controller.
document.addEventListener('gigrun:refresh', function() {
    if (window._gigRunState) _gigRunRenderStrip();
});

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
    // Either-or toggle (per Drew 2026-05-09): when "More options" is
    // expanded, the above-fold chips (Resume / Gig Prep / Improve a Song)
    // hide so the screen doesn't show all 6 at once. Click "Fewer options"
    // to come back. This keeps the "1 primary + limited options" rule even
    // when the user is browsing alternatives.
    var section = btn.closest ? btn.closest('.pm-section-b') : null;
    var primaryChips = section ? section.querySelector('.pm-chips:not(.pm-chips-more)') : null;
    var more = btn.nextElementSibling;
    if (!more) return;
    var hidden = more.hasAttribute('hidden');
    if (hidden) {
        more.removeAttribute('hidden');
        if (primaryChips) primaryChips.setAttribute('hidden', '');
        btn.textContent = '↑ Back to quick start';
    } else {
        more.setAttribute('hidden', '');
        if (primaryChips) primaryChips.removeAttribute('hidden');
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

    // Per Drew (2026-05-09): "Learn a New Song" must include both active AND
    // inactive library songs, plus a path to add a brand-new song that isn't
    // in the library yet. Other focus types (improve / harmony / chart) stay
    // scoped to active songs — those are about working on what you already
    // have a chart for.
    var filtered = songList.filter(function(s) {
        if (typeof isStructuralTitle === 'function' && isStructuralTitle(s.title)) return false;
        if (focusType === 'learn') return true;  // entire library, active + inactive
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
        // Only "Learn" gets status badges since it's the one that shows
        // inactive songs alongside active ones — the badge tells you which.
        var statusBadge = '';
        if (focusType === 'learn') {
            var st = statusMap[s.title] || '';
            var isActive = _pmIsActive(s.title);
            if (st === 'learning' || st === 'prospect' || st === 'wip' || st === 'on_deck' || st === 'onDeck') {
                statusBadge = '<span class="pm-picker-status pm-picker-status-active">Learning</span>';
            } else if (isActive) {
                statusBadge = '<span class="pm-picker-status pm-picker-status-active">Active</span>';
            } else {
                statusBadge = '<span class="pm-picker-status pm-picker-status-inactive">Inactive</span>';
            }
        }
        return '<div class="pm-picker-row" onclick="_pmPickerSelect(\''+focusType+'\',\''+safe+'\')">'+
               (b ? '<span class="pm-picker-band">'+b+'</span>' : '')+
               '<span class="pm-picker-title">'+t+'</span>'+
               statusBadge+
               '</div>';
    }).join('');

    // Footer for "Learn" — paths to Songs library + chart-paste import for
    // songs not yet in the library. Other focus types don't need this.
    var footer = '';
    if (focusType === 'learn') {
        var hasChartImport = (typeof window.showChartImportModal === 'function');
        footer = '<div class="pm-picker-footer">'+
                 '  <div class="pm-picker-footer-label">Don\'t see it?</div>'+
                 '  <button class="pm-picker-footer-btn" onclick="document.getElementById(\'pmSongPickerOverlay\').remove();showPage(\'songs\')">🔍 Browse full song library</button>'+
                 (hasChartImport ? '  <button class="pm-picker-footer-btn" onclick="document.getElementById(\'pmSongPickerOverlay\').remove();showChartImportModal()">📋 Paste a new chart</button>' : '')+
                 '</div>';
    }

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
        footer+
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
    // Wave 2: focusType → mode is recorded in PracticeSession before opening.
    // Chart overlay can read this to pre-configure stems / lyrics / chords.
    _pmOpenSolo(songTitle, _pmModeForFocus(focusType));
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
    var derivedTag = mix.sourceLabel
        ? '<div style="font-size:0.7em;color:#a5b4fc;margin-top:2px">🔗 Derived from: '+_pmEsc(mix.sourceLabel)+' setlist</div>'
        : '';
    return '<div class="app-card" style="margin-bottom:10px">'+
           '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
           '<span style="font-size:1.1em">'+type.emoji+'</span>'+
           '<div style="flex:1;min-width:0">'+
           '<div style="font-weight:700;font-size:0.9em;color:var(--text)">'+_pmEsc(mix.title)+'</div>'+
           '<div style="font-size:0.72em;color:var(--text-dim)">'+type.label+' · '+songs.length+' songs</div>'+
           derivedTag+
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
// Source-derivation fields (Drew 2026-05-10): when type='gig', mixes can be
// auto-populated from a gig's linked setlist. sourceType/sourceId/sourceLabel
// record the provenance so we can show "Derived from: [Gig] setlist" and
// later re-sync if the setlist changes.
window.pmNewMix = function pmNewMix() {
    _pmEditingMix = {
        id: null, title:'', type:'practice', songIds:[],
        isShared:false, createdBy: _pmMyKey(),
        sourceType: null, sourceId: null, sourceLabel: null
    };
    _pmMixSongs = [];
    _pmShowEditor();
};

window.pmEditMix = function pmEditMix(mixId) {
    var mix = _pmMixes.find(function(m){return m.id===mixId;});
    if (!mix) return;
    _pmEditingMix = Object.assign({
        sourceType: null, sourceId: null, sourceLabel: null
    }, mix);
    _pmMixSongs = (mix.songIds || []).slice();
    _pmShowEditor();
};

// Cache of upcoming gigs for the gig picker — refreshed each time the
// editor opens so newly-added gigs surface without a page reload.
var _pmMixUpcomingGigs = [];

async function _pmLoadMixUpcomingGigs() {
    var gigs = [];
    if (typeof GLStore !== 'undefined' && GLStore.getGigsAsync) {
        try { gigs = await GLStore.getGigsAsync(); } catch(e) { gigs = []; }
    }
    if (!gigs || !gigs.length) {
        gigs = (typeof GLStore !== 'undefined' && GLStore.getGigs) ? GLStore.getGigs() : [];
    }
    var todayStr = new Date().toISOString().split('T')[0];
    var upcoming = (gigs || []).filter(function(g) { return g && g.date && g.date >= todayStr; });
    upcoming.sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
    _pmMixUpcomingGigs = upcoming;
    return upcoming;
}

// Resolve a gig's setlist songs (deduped, structural-titles filtered) the
// same way Gig Prep / Run-the-Gig do. Returns { songs: [titles], setlist }.
function _pmResolveGigSongs(gig) {
    if (!gig) return { songs: [], setlist: null };
    var setlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : [];
    var setlist = null;
    if (gig.setlistId) {
        setlist = setlists.find(function(s) { return s && s.setlistId === gig.setlistId; }) || null;
    }
    if (!setlist && gig.date) {
        setlist = setlists.find(function(s) { return s && s.date === gig.date; }) || null;
    }
    if (!setlist) return { songs: [], setlist: null };
    var seen = {};
    var songs = [];
    (setlist.sets || []).forEach(function(set) {
        (set.songs || []).forEach(function(sg) {
            var title = typeof sg === 'string' ? sg : (sg && sg.title) || '';
            if (!title || seen[title]) return;
            if (typeof isStructuralTitle === 'function' && isStructuralTitle(title)) return;
            seen[title] = true;
            songs.push(title);
        });
    });
    return { songs: songs, setlist: setlist };
}

window.pmMixTypeChanged = function(newType) {
    if (!_pmEditingMix) return;
    _pmEditingMix.type = newType;
    // If user switched AWAY from gig, the source is no longer meaningful
    // for display — but we keep the data in case they switch back.
    _pmShowEditor();
};

window.pmMixDeriveFromGig = async function(gigKey) {
    if (!gigKey) return;
    var gig = _pmMixUpcomingGigs.find(function(g) { return _pmGigKey(g) === gigKey; });
    if (!gig) {
        if (typeof showToast === 'function') showToast('Gig not found');
        return;
    }
    var resolved = _pmResolveGigSongs(gig);
    if (!resolved.songs.length) {
        if (typeof showToast === 'function') {
            showToast(resolved.setlist
                ? 'Setlist for this gig is empty — add songs in Setlists first.'
                : 'No setlist linked to this gig yet — link one in Setlists.');
        }
        return;
    }
    // Confirm replace if mix already has songs
    if (_pmMixSongs.length) {
        var ok = confirm('Replace the current ' + _pmMixSongs.length + ' song(s) with the ' + resolved.songs.length + ' song(s) from this gig\'s setlist? You can still edit afterward.');
        if (!ok) return;
    }
    _pmMixSongs = resolved.songs.slice();
    _pmEditingMix.sourceType = 'setlist';
    _pmEditingMix.sourceId = gig.gigId || resolved.setlist.setlistId || _pmGigKey(gig);
    _pmEditingMix.sourceLabel = _pmFormatGigLabel(gig);
    // Auto-fill the title on first derive (only if title is empty or looks
    // like the default placeholder)
    var titleEl = document.getElementById('pm-mix-title');
    if (titleEl && !titleEl.value.trim()) {
        titleEl.value = 'Gig Prep · ' + _pmEditingMix.sourceLabel;
        _pmEditingMix.title = titleEl.value;
    }
    _pmShowEditor();
    if (typeof showToast === 'function') showToast('Loaded ' + resolved.songs.length + ' songs from ' + _pmEditingMix.sourceLabel);
};

window.pmMixClearSource = function() {
    if (!_pmEditingMix) return;
    if (!confirm('Unlink this mix from the gig setlist? The current songs stay; you\'ll just lose the "Derived from" tag.')) return;
    _pmEditingMix.sourceType = null;
    _pmEditingMix.sourceId = null;
    _pmEditingMix.sourceLabel = null;
    _pmShowEditor();
};

function _pmFormatGigLabel(gig) {
    if (!gig) return 'Gig';
    var dateStr = gig.date || '';
    var venueStr = gig.venue || 'Venue TBD';
    var datePart = '';
    try {
        if (dateStr) {
            var d = new Date(dateStr + 'T00:00:00');
            datePart = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }
    } catch(e) { datePart = dateStr; }
    return (datePart ? datePart + ' · ' : '') + venueStr;
}

function _pmShowEditor() {
    var el = document.getElementById('pm-mix-editor');
    if (!el) return;

    var typeOpts = MIX_TYPES.map(function(t){
        return '<option value="'+t.id+'"'+(_pmEditingMix.type===t.id?' selected':'')+'>'+t.emoji+' '+t.label+'</option>';
    }).join('');

    // Gig-source picker (only shown when type='gig'). Populated async on first
    // open — see the deferred _pmLoadMixUpcomingGigs() call after innerHTML.
    var gigSourceHtml = '';
    if (_pmEditingMix.type === 'gig') {
        var gigOpts = '<option value="">— Pick an upcoming gig to autopopulate —</option>' +
            _pmMixUpcomingGigs.map(function(g) {
                var key = _pmGigKey(g);
                var lbl = _pmFormatGigLabel(g);
                return '<option value="'+_pmEsc(key)+'">'+_pmEsc(lbl)+'</option>';
            }).join('');
        var sourceBadge = _pmEditingMix.sourceLabel
            ? '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding:6px 10px;background:rgba(102,126,234,0.12);border:1px solid rgba(102,126,234,0.3);border-radius:8px">'+
              '<span style="font-size:0.78em;color:#a5b4fc;flex:1">🔗 Derived from: <strong>'+_pmEsc(_pmEditingMix.sourceLabel)+'</strong> setlist</span>'+
              '<button onclick="pmMixClearSource()" style="background:none;border:1px solid rgba(255,255,255,0.15);color:var(--text-dim);cursor:pointer;font-size:0.72em;padding:3px 8px;border-radius:6px">Unlink</button>'+
              '</div>'
            : '';
        var emptyHint = _pmMixUpcomingGigs.length
            ? ''
            : '<div style="font-size:0.74em;color:var(--text-dim);margin-top:4px">No upcoming gigs found — add one in Schedule first.</div>';
        gigSourceHtml =
            '<div style="margin-bottom:12px;padding:10px;background:rgba(0,0,0,0.15);border-radius:8px;border:1px solid rgba(255,255,255,0.05)">'+
            '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:6px">🎤 Autopopulate from gig</div>'+
            '<select id="pm-mix-gig-source" class="app-select" style="font-size:0.85em;width:100%" onchange="pmMixDeriveFromGig(this.value)">'+gigOpts+'</select>'+
            emptyHint+
            sourceBadge+
            '</div>';
    }

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
        '<select id="pm-mix-type" class="app-select" style="font-size:0.88em" onchange="pmMixTypeChanged(this.value)">'+typeOpts+'</select>'+
        '</label>'+

        gigSourceHtml+

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

    // If we're showing the gig picker and haven't loaded the upcoming gigs
    // cache yet, fetch and re-render once. Cheap idempotent refresh otherwise.
    if (_pmEditingMix.type === 'gig' && !_pmMixUpcomingGigs.length) {
        _pmLoadMixUpcomingGigs().then(function(gigs) {
            if (gigs && gigs.length && _pmEditingMix && _pmEditingMix.type === 'gig') {
                _pmShowEditor();
            }
        }).catch(function(){});
    }
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
        // Source-derivation provenance — null for hand-built mixes, set when
        // autopopulated from a gig's setlist via pmMixDeriveFromGig.
        sourceType:  (_pmEditingMix && _pmEditingMix.sourceType)  || null,
        sourceId:    (_pmEditingMix && _pmEditingMix.sourceId)    || null,
        sourceLabel: (_pmEditingMix && _pmEditingMix.sourceLabel) || null,
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
    /* Section A — Command Center: 3-5 clickable items + one big CTA */
    '.pm-section-a .pm-primary-card{background:linear-gradient(135deg,rgba(102,126,234,0.12),rgba(118,75,162,0.08));border:1px solid rgba(102,126,234,0.25);border-radius:14px;padding:20px 20px 18px;}'+
    '.pm-primary-title{font-size:1.4em;font-weight:800;color:var(--text,#f1f5f9);line-height:1.2;margin-bottom:6px;letter-spacing:-0.01em;}'+
    '.pm-primary-reason{font-size:0.88em;color:var(--text-dim,#94a3b8);line-height:1.4;margin-bottom:16px;}'+
    '.pm-start-btn{width:100%;padding:14px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;font-weight:800;font-size:1em;cursor:pointer;font-family:inherit;letter-spacing:0.02em;box-shadow:0 4px 16px rgba(102,126,234,0.32);transition:transform 0.1s ease,box-shadow 0.15s ease;}'+
    '.pm-start-btn:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(102,126,234,0.45);}'+
    '.pm-start-btn:active{transform:translateY(0);}'+
    /* CC item list */
    '.pm-cc-list{display:flex;flex-direction:column;gap:8px;margin-bottom:14px;}'+
    '.pm-cc-item{display:flex;align-items:center;gap:12px;width:100%;padding:12px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;font-family:inherit;text-align:left;transition:background 0.12s ease,border-color 0.12s ease,transform 0.08s ease;-webkit-appearance:none;appearance:none;}'+
    '.pm-cc-item:hover{background:rgba(102,126,234,0.08);border-color:rgba(102,126,234,0.32);}'+
    '.pm-cc-item:active{transform:scale(0.99);}'+
    '.pm-cc-item:first-child{background:linear-gradient(135deg,rgba(102,126,234,0.10),rgba(118,75,162,0.06));border-color:rgba(102,126,234,0.28);}'+
    '.pm-cc-rank{font-size:0.78em;font-weight:800;color:var(--text-dim,#94a3b8);width:18px;text-align:center;flex-shrink:0;font-variant-numeric:tabular-nums;}'+
    '.pm-cc-icon{font-size:1.15em;flex-shrink:0;width:22px;text-align:center;}'+
    '.pm-cc-body{flex:1;min-width:0;}'+
    '.pm-cc-title{font-size:0.95em;font-weight:700;color:var(--text,#f1f5f9);line-height:1.25;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
    '.pm-cc-ts{display:inline-block;margin-left:6px;padding:1px 6px;background:rgba(245,158,11,0.16);color:#fbbf24;border-radius:6px;font-size:0.72em;font-weight:700;font-variant-numeric:tabular-nums;vertical-align:middle;}'+
    '.pm-cc-reason{font-size:0.78em;color:var(--text-dim,#94a3b8);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
    '.pm-cc-cta{font-size:1em;color:#a5b4fc;flex-shrink:0;font-weight:700;opacity:0.7;transition:opacity 0.12s,transform 0.12s;}'+
    '.pm-cc-item:hover .pm-cc-cta{opacity:1;transform:translateX(2px);}'+
    '.pm-cc-start{margin-top:4px;display:flex;flex-direction:column;align-items:center;gap:2px;line-height:1.3;}'+
    '.pm-cc-start-main{font-size:1em;font-weight:800;}'+
    '.pm-cc-start-sub{font-size:0.74em;font-weight:500;opacity:0.85;letter-spacing:0.01em;}'+
    // ── Run the Gig CTA inside Gig Prep modal ──────────────────────────
    '.pm-gig-mode-row{padding:14px 16px 6px;display:flex;flex-direction:column;gap:6px;}'+
    '.pm-gig-mode-btn{width:100%;padding:14px 16px;border:none;border-radius:12px;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;cursor:pointer;font-family:inherit;text-align:left;box-shadow:0 4px 14px rgba(22,163,74,0.32);transition:transform 0.08s,box-shadow 0.15s;}'+
    '.pm-gig-mode-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(22,163,74,0.45);}'+
    '.pm-gig-mode-btn:active{transform:translateY(0);}'+
    '.pm-gig-mode-title{font-size:1em;font-weight:800;margin-bottom:2px;}'+
    '.pm-gig-mode-sub{font-size:0.78em;font-weight:500;opacity:0.92;}'+
    '.pm-gig-mode-or{font-size:0.74em;color:var(--text-dim);text-align:center;letter-spacing:0.04em;text-transform:uppercase;font-weight:600;padding:4px 0;}'+
    // ── Run the Gig strip (top of viewport during a run) ───────────────
    '.gig-run-strip{position:fixed;top:0;left:0;right:0;z-index:9700;display:flex;align-items:center;gap:14px;padding:10px 16px;background:linear-gradient(135deg,#16a34a,#059669);color:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.4);font-family:inherit;}'+
    '.gig-run-eyebrow{font-size:0.7em;font-weight:800;letter-spacing:0.08em;opacity:0.9;flex-shrink:0;}'+
    '.gig-run-title{flex:1;font-size:0.95em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;}'+
    '.gig-run-timer{font-size:1.1em;font-weight:800;font-variant-numeric:tabular-nums;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.25);min-width:54px;text-align:center;flex-shrink:0;transition:background 0.2s;}'+
    '.gig-run-timer-warn{background:rgba(220,38,38,0.85);animation:gigRunPulse 1s ease-in-out infinite;}'+
    '@keyframes gigRunPulse{50%{opacity:0.7;}}'+
    '.gig-run-controls{display:flex;gap:4px;flex-shrink:0;}'+
    '.gig-run-btn{background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;padding:5px 10px;border-radius:6px;font-size:0.85em;font-weight:700;font-family:inherit;}'+
    '.gig-run-btn:hover{background:rgba(255,255,255,0.25);}'+
    '.gig-run-btn-pause{min-width:78px;}'+
    '.gig-run-btn-next{background:rgba(255,255,255,0.22);border-color:rgba(255,255,255,0.3);font-weight:800;}'+
    '.gig-run-btn-next:hover{background:rgba(255,255,255,0.32);}'+
    '.gig-run-btn-auto-off{opacity:0.75;}'+
    '.gig-run-btn-auto-on{background:rgba(0,0,0,0.30);border-color:rgba(0,0,0,0.35);}'+
    '.gig-run-btn-end{background:rgba(0,0,0,0.25);border-color:rgba(0,0,0,0.3);}'+
    '.gig-run-btn-end:hover{background:rgba(0,0,0,0.4);}'+
    // Push Workbench (and any page) down so the strip doesn\'t cover content.
    'body:has(#gigRunStrip) #app{padding-top:48px;}'+
    'body:has(#gigRunStrip) #page-workbench{padding-top:0;}'+
    // ── Jump-to-song menu ──────────────────────────────────────────────
    '.gig-run-jump-menu{position:fixed;top:54px;right:12px;z-index:9750;max-width:340px;max-height:60vh;overflow-y:auto;background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,0.55);padding:6px;}'+
    '.gig-run-jump-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;background:none;border:0;color:#cbd5e1;cursor:pointer;font-family:inherit;font-size:0.84em;text-align:left;border-radius:6px;}'+
    '.gig-run-jump-item:hover{background:rgba(255,255,255,0.06);color:#fff;}'+
    '.gig-run-jump-item.is-active{background:rgba(22,163,74,0.18);color:#86efac;}'+
    '.gig-run-jump-rank{font-size:0.7em;font-weight:800;color:var(--text-dim);min-width:22px;text-align:right;font-variant-numeric:tabular-nums;}'+
    '.gig-run-jump-item.is-active .gig-run-jump-rank{color:#86efac;}'+
    '.gig-run-jump-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}'+
    '.gig-run-jump-now{font-size:0.66em;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;background:rgba(34,197,94,0.2);color:#86efac;padding:2px 6px;border-radius:4px;}'+
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
    '.pm-chip-quick-note{background:rgba(99,102,241,0.06);border-color:rgba(99,102,241,0.2);color:#a5b4fc;flex:0 0 auto;min-width:auto;padding:7px 12px;font-size:0.8em;}'+
    '.pm-chip-quick-note:hover{background:rgba(99,102,241,0.14);border-color:rgba(99,102,241,0.35);}'+
    '.pm-chip-ghost{background:transparent;border-color:rgba(255,255,255,0.08);color:var(--text-dim,#94a3b8);}'+
    '.pm-quick-note{margin-top:10px;}'+
    '.pm-quick-note-form{margin-top:8px;display:flex;flex-direction:column;gap:8px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:10px;padding:10px;}'+
    '.pm-quick-note-form textarea{width:100%;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--text,#f1f5f9);padding:8px 10px;font-family:inherit;font-size:0.88em;resize:vertical;box-sizing:border-box;}'+
    '.pm-quick-note-form textarea:focus{outline:none;border-color:rgba(99,102,241,0.45);}'+
    '.pm-quick-note-actions{display:flex;gap:8px;}'+
    '.pm-quick-note-actions .pm-chip{flex:0 0 auto;min-width:auto;padding:6px 14px;font-size:0.82em;}'+
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
    '.pm-gig-other-arrow{color:var(--text-dim,#94a3b8);font-size:0.9em;flex-shrink:0;}'+
    /* Status badges in Learn picker (Active / Inactive / Learning) */
    '.pm-picker-status{font-size:0.66em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:2px 7px;border-radius:8px;flex-shrink:0;margin-left:8px;}'+
    '.pm-picker-status-active{background:rgba(34,197,94,0.12);color:#86efac;}'+
    '.pm-picker-status-inactive{background:rgba(255,255,255,0.05);color:var(--text-dim,#94a3b8);}'+
    /* Picker footer: "Don\'t see it?" actions for Learn flow */
    '.pm-picker-footer{padding:14px 18px;border-top:1px solid rgba(255,255,255,0.06);background:rgba(255,255,255,0.02);}'+
    '.pm-picker-footer-label{font-size:0.72em;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim,#94a3b8);margin-bottom:8px;}'+
    '.pm-picker-footer-btn{display:block;width:100%;text-align:left;padding:10px 12px;margin-bottom:6px;background:rgba(102,126,234,0.06);border:1px solid rgba(102,126,234,0.2);border-radius:8px;color:var(--text,#f1f5f9);cursor:pointer;font-weight:600;font-size:0.85em;font-family:inherit;transition:background 0.12s ease;}'+
    '.pm-picker-footer-btn:hover{background:rgba(102,126,234,0.14);}'+
    '.pm-picker-footer-btn:last-child{margin-bottom:0;}';
    document.head.appendChild(s);
}

window.renderPracticePage = renderPracticePage;
window.loadSongStatusMap  = loadSongStatusMap;

// ── Live re-render on focus / session changes ────────────────────────────────
// Section A reads getNowFocus() — if readiness changes elsewhere (rehearsal
// scoring, status flip, etc.) the focus engine emits 'focusChanged' and we
// re-render the entry screen so the recommendation stays current.
// Section B's Resume chip reads PracticeSession — if a session starts/updates
// elsewhere (chart overlay loop change, etc.) the session module emits
// 'practiceSessionChanged' and we refresh the chip text.
// Only re-render when Practice is the visible page and Focus is the active tab.
if (typeof GLStore !== 'undefined' && GLStore.on) {
    var _pmRerenderIfVisible = function() {
        if (typeof currentPage !== 'undefined' && currentPage !== 'practice') return;
        if (_pmTab !== 'focus') return;
        var el = document.getElementById('pm-panel-focus');
        if (!el) return;
        _pmRenderFocusTab();
    };
    GLStore.on('focusChanged', _pmRerenderIfVisible);
    GLStore.on('practiceSessionChanged', _pmRerenderIfVisible);
}
