// ============================================================================
// js/features/stoner-mode.js
// Stoner Mode: simplified song browser for on-stage use.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, navigation.js
// EXPOSES globals: stonerSearch, stonerLaunchSong, stonerGoHome,
//   stonerOpenSetlists, toggleStonerMode
// ============================================================================

'use strict';

// ============================================================================
// STONER MODE — Simplified "I just wanna play" interface
// ============================================================================
var _stonerMode = false;

function toggleStonerMode() {
    if (_stonerMode) {
        // Exiting — show summary if any outcomes were recorded
        var totalOutcomes = _stonerSession.good + _stonerSession.needswork + _stonerSession.trainwreck;
        if (totalOutcomes > 0) {
            _stonerShowSummary();
        } else {
            _stonerMode = false;
            localStorage.setItem('deadcetera_stoner_mode', '0');
            _stonerExit();
        }
    } else {
        _stonerMode = true;
        localStorage.setItem('deadcetera_stoner_mode', '1');
        _stonerEnter();
    }
}

function _stonerEnter() {
    _stonerEnsureOverlay();
    var ov = document.getElementById('stonerOverlay');
    if (ov) ov.classList.add('stoner-visible');
    document.body.style.overflow = 'hidden';
    _stonerRender();
    // Update topbar button
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '😵 Exit'; btn.style.background = 'rgba(139,92,246,0.3)'; btn.style.color = '#c084fc'; btn.style.borderColor = 'rgba(139,92,246,0.5)'; }
}

function _stonerExit() {
    var ov = document.getElementById('stonerOverlay');
    if (ov) ov.classList.remove('stoner-visible');
    document.body.style.overflow = '';
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
}

function _stonerEnsureOverlay() {
    if (document.getElementById('stonerOverlay')) return;

    var style = document.createElement('style');
    style.textContent = [
        '#stonerOverlay{display:none;position:fixed;inset:0;z-index:2500;background:linear-gradient(160deg,#0a0a1a 0%,#0d1117 40%,#0a0f0a 100%);flex-direction:column;overflow:hidden}',
        '#stonerOverlay.stoner-visible{display:flex!important}',
        '.stoner-big-btn{width:100%;padding:20px;border-radius:16px;font-size:1.1em;font-weight:800;cursor:pointer;border:1px solid;transition:all 0.18s;letter-spacing:0.02em;display:flex;align-items:center;justify-content:center;gap:12px;min-height:64px}',
        '.stoner-big-btn:active{transform:scale(0.97)}',
        '.stoner-song-row{padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.1s}',
        '.stoner-song-row:hover,.stoner-song-row:active{background:rgba(255,255,255,0.06)}',
        '.stoner-search{width:100%;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f1f5f9;padding:14px 16px;font-size:1.1em;font-family:inherit;outline:none;box-sizing:border-box}',
        '.stoner-search:focus{border-color:rgba(139,92,246,0.5);background:rgba(255,255,255,0.09)}',
        '.stoner-search::placeholder{color:#475569}'
    ].join('\n');
    document.head.appendChild(style);

    var ov = document.createElement('div');
    ov.id = 'stonerOverlay';

    // Header
    ov.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;background:rgba(0,0,0,0.3)">'
        + '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.4em">\uD83C\uDF3F</span><span style="font-weight:800;font-size:1.05em;color:#c084fc">Stoner Mode</span></div>'
        + '<button onclick="toggleStonerMode()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:700">Exit</button>'
        + '</div>'
        + '<div id="stonerContent" style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch"></div>';

    document.body.appendChild(ov);
}

// ── Session state ──────────────────────────────────────────────────────────
var _stonerStreak = 0;
var _stonerCurrentSong = null;
var _stonerQueue = [];
var _stonerQueueIdx = 0;
var _stonerRunStartTime = null;

// Session tracking for summary
var _stonerSession = { good: 0, needswork: 0, trainwreck: 0, bestStreak: 0, songs: {} };

function _stonerResetSession() {
    _stonerSession = { good: 0, needswork: 0, trainwreck: 0, bestStreak: 0, songs: {} };
    _stonerStreak = 0;
}

var _STONER_SUBS = [
    'Less thinking. More playing.',
    'For when the jam gets foggy.',
    'Because somebody forgot the setlist.',
    'Play the song. We\'ll remember the rest.',
    'One song at a time.',
];

function _stonerRender() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    _stonerResetSession();
    // Build the queue from Priority Queue → Agenda → Library
    _stonerBuildQueue();
    _stonerCurrentSong = _stonerQueue[_stonerQueueIdx] || null;
    content.innerHTML = '<div id="stonerHome"></div>';
    _stonerRenderCockpit();
}

function _stonerBuildQueue() {
    _stonerQueue = [];
    var seen = {};
    // 1. Practice Attention (Priority Queue source)
    if (typeof GLStore !== 'undefined' && GLStore.getPracticeAttention) {
        var pa = GLStore.getPracticeAttention({ limit: 10 });
        if (pa) pa.forEach(function(item) { if (!seen[item.songId]) { _stonerQueue.push(item.songId); seen[item.songId] = true; } });
    }
    // 2. Rehearsal Agenda
    if (typeof GLStore !== 'undefined' && GLStore.generateRehearsalAgenda) {
        var agenda = GLStore.generateRehearsalAgenda();
        if (agenda && !agenda.empty && agenda.items) {
            agenda.items.forEach(function(item) { if (!seen[item.songId]) { _stonerQueue.push(item.songId); seen[item.songId] = true; } });
        }
    }
    // 3. Fallback: all rated songs
    if (typeof readinessCache !== 'undefined') {
        Object.keys(readinessCache).forEach(function(title) { if (!seen[title]) { _stonerQueue.push(title); seen[title] = true; } });
    }
    _stonerQueueIdx = 0;
}

function _stonerRenderCockpit() {
    var home = document.getElementById('stonerHome');
    if (!home) return;
    var song = _stonerCurrentSong;
    var sub = _STONER_SUBS[Math.floor(Math.random() * _STONER_SUBS.length)];

    // Song indicators
    var indicators = '';
    if (song && typeof readinessCache !== 'undefined' && readinessCache[song]) {
        var vals = Object.values(readinessCache[song]).filter(function(v) { return typeof v === 'number' && v > 0; });
        var avg = vals.length ? vals.reduce(function(a, b) { return a + b; }, 0) / vals.length : 0;
        if (avg < 3 && avg > 0) indicators += '<span style="color:#f59e0b;font-size:0.7em;font-weight:700">&#x26A0; Needs Work</span> ';
    }
    if (song && typeof window.northStarCache !== 'undefined' && window.northStarCache[song]) {
        indicators += '<span style="color:#fbbf24;font-size:0.7em">&#x2B50;</span> ';
    }

    var queueInfo = _stonerQueue.length ? ('Song ' + (_stonerQueueIdx + 1) + ' of ' + _stonerQueue.length) : '';

    home.innerHTML = [
        '<div style="padding:24px 20px;text-align:center;max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:16px;min-height:100%">',
        // Quick chart search
        '<div style="position:relative">',
        '<input class="stoner-search" id="stonerQuickSearch" placeholder="&#x1F50D; Find any song..." oninput="_stonerQuickFilter(this.value)" autocomplete="off" autocorrect="off" spellcheck="false" style="font-size:0.95em;padding:10px 14px">',
        '<div id="stonerQuickResults" style="position:absolute;left:0;right:0;top:100%;z-index:20;max-height:200px;overflow-y:auto;border-radius:0 0 10px 10px;background:#1a1f2e;border:1px solid rgba(139,92,246,0.3);border-top:none;display:none"></div>',
        '</div>',
        // Subtitle
        '<div style="font-size:0.75em;color:#475569;font-style:italic">' + sub + '</div>',
        // Song card
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px 20px;text-align:center">',
        '<div style="font-size:0.6em;font-weight:700;letter-spacing:0.12em;color:#64748b;text-transform:uppercase;margin-bottom:8px">' + queueInfo + '</div>',
        song ? '<div style="font-size:1.6em;font-weight:800;color:#f1f5f9;line-height:1.2;margin-bottom:8px">' + _stonerEsc(song) + '</div>' : '<div style="font-size:1.2em;color:#64748b">No songs in queue</div>',
        indicators ? '<div style="margin-bottom:4px">' + indicators + '</div>' : '',
        '</div>',
        // Action buttons
        song ? [
            '<div style="display:flex;gap:10px">',
            '<button class="stoner-big-btn" onclick="_stonerOpenChart()" style="flex:1;background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.35);color:#a5b4fc;min-height:56px;font-size:1em">&#x1F4D6; CHART</button>',
            '<button class="stoner-big-btn" onclick="_stonerStartRun()" style="flex:1;background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.3);color:#86efac;min-height:56px;font-size:1em">&#x25B6; PRACTICE RUN</button>',
            '</div>',
            // Outcome buttons
            '<div style="display:flex;gap:8px">',
            '<button class="stoner-big-btn" onclick="_stonerOutcome(\'good\')" style="flex:1;background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.35);color:#22c55e;min-height:60px">&#x1F44D;<br>GOOD</button>',
            '<button class="stoner-big-btn" onclick="_stonerOutcome(\'needswork\')" style="flex:1;background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.3);color:#f59e0b;min-height:60px">&#x1F914;<br>NEEDS<br>WORK</button>',
            '<button class="stoner-big-btn" onclick="_stonerOutcome(\'trainwreck\')" style="flex:1;background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.3);color:#ef4444;min-height:60px">&#x1F4A5;<br>TRAIN<br>WRECK</button>',
            '</div>',
        ].join('') : '',
        // Streak + Next
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 4px">',
        '<div style="font-size:0.85em;font-weight:700;color:' + (_stonerStreak >= 3 ? '#22c55e' : '#64748b') + '">&#x1F525; Streak: ' + _stonerStreak + '</div>',
        '<button class="stoner-big-btn" onclick="_stonerNextSong()" style="width:auto;padding:12px 24px;background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.12);color:#94a3b8;min-height:auto;font-size:0.9em">NEXT SONG &#x276F;</button>',
        '</div>',
        // Toast area
        '<div id="stonerToast" style="min-height:24px;font-size:0.8em;color:#64748b;text-align:center"></div>',
        '</div>'
    ].join('');
}

function _stonerEsc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _stonerOpenChart() {
    if (!_stonerCurrentSong) return;
    // Exit stoner, open rehearsal mode chart
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    if (typeof openRehearsalMode === 'function') openRehearsalMode(_stonerCurrentSong);
}

function _stonerStartRun() {
    _stonerRunStartTime = Date.now();
    var toast = document.getElementById('stonerToast');
    if (toast) toast.textContent = 'Practice run started \u2014 play the song, then mark the outcome.';
}

function _stonerOutcome(type) {
    if (!_stonerCurrentSong) return;
    var toast = document.getElementById('stonerToast');
    var msg = '';
    // Track session stats
    if (!_stonerSession.songs[_stonerCurrentSong]) _stonerSession.songs[_stonerCurrentSong] = { good: 0, needswork: 0, trainwreck: 0 };
    _stonerSession.songs[_stonerCurrentSong][type === 'needswork' ? 'needswork' : type]++;
    _stonerSession[type === 'needswork' ? 'needswork' : type]++;

    if (type === 'good') {
        _stonerStreak++;
        if (_stonerStreak > _stonerSession.bestStreak) _stonerSession.bestStreak = _stonerStreak;
        msg = '\u2705 Nice! Streak: ' + _stonerStreak;
        // Readiness +1
        if (typeof GLStore !== 'undefined' && GLStore.saveReadiness) {
            var mk = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
            if (mk && typeof readinessCache !== 'undefined') {
                var current = (readinessCache[_stonerCurrentSong] && readinessCache[_stonerCurrentSong][mk]) || 0;
                var newVal = Math.min(5, current + 1);
                if (newVal > current && newVal >= 1) GLStore.saveReadiness(_stonerCurrentSong, mk, newVal);
            }
        }
    } else if (type === 'needswork') {
        msg = '\uD83D\uDD27 Logged \u2014 keep at it.';
    } else if (type === 'trainwreck') {
        _stonerStreak = 0;
        msg = '\uD83D\uDCA5 Trainwreck logged \u2014 this song just moved up in the practice queue.';
        // Readiness -1
        if (typeof GLStore !== 'undefined' && GLStore.saveReadiness) {
            var mk2 = (typeof getCurrentMemberReadinessKey === 'function') ? getCurrentMemberReadinessKey() : null;
            if (mk2 && typeof readinessCache !== 'undefined') {
                var current2 = (readinessCache[_stonerCurrentSong] && readinessCache[_stonerCurrentSong][mk2]) || 0;
                var newVal2 = Math.max(1, current2 - 1);
                if (newVal2 !== current2 && current2 >= 1) GLStore.saveReadiness(_stonerCurrentSong, mk2, newVal2);
            }
        }
    }

    // Log activity
    if (typeof logActivity === 'function') {
        logActivity('stoner_outcome', { song: _stonerCurrentSong, outcome: type, streak: _stonerStreak });
    }

    if (toast) { toast.textContent = msg; toast.style.color = type === 'good' ? '#22c55e' : type === 'trainwreck' ? '#ef4444' : '#f59e0b'; }
    // Re-render streak display
    _stonerRenderCockpit();
}

function _stonerNextSong() {
    _stonerQueueIdx++;
    if (_stonerQueueIdx >= _stonerQueue.length) _stonerQueueIdx = 0;
    _stonerCurrentSong = _stonerQueue[_stonerQueueIdx] || null;
    _stonerRunStartTime = null;
    _stonerRenderCockpit();
}

// ── Session Summary ─────────────────────────────────────────────────────────

function _stonerShowSummary() {
    var s = _stonerSession;
    var totalSongs = Object.keys(s.songs).length;
    var totalRuns = s.good + s.needswork + s.trainwreck;

    // Find most improved (most GOODs)
    var mostImproved = null;
    var mostImprovedCount = 0;
    // Find needs attention (most NEEDS WORK + TRAINWRECK)
    var needsAttention = null;
    var needsAttentionCount = 0;

    Object.entries(s.songs).forEach(function(e) {
        var title = e[0], stats = e[1];
        if (stats.good > mostImprovedCount) { mostImproved = title; mostImprovedCount = stats.good; }
        var problemCount = stats.needswork + stats.trainwreck;
        if (problemCount > needsAttentionCount) { needsAttention = title; needsAttentionCount = problemCount; }
    });

    var content = document.getElementById('stonerContent');
    if (!content) return;

    var highlightsHTML = '';
    if (mostImproved && mostImprovedCount > 0) {
        highlightsHTML += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0"><span style="color:#22c55e;font-size:1.1em">&#x2B06;</span><div><div style="font-size:0.7em;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Most improved</div><div style="font-weight:700;color:#f1f5f9">' + _stonerEsc(mostImproved) + '</div></div></div>';
    }
    if (needsAttention && needsAttentionCount > 0) {
        highlightsHTML += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0"><span style="color:#f59e0b;font-size:1.1em">&#x26A0;</span><div><div style="font-size:0.7em;color:#64748b;text-transform:uppercase;letter-spacing:0.08em">Needs attention</div><div style="font-weight:700;color:#f1f5f9">' + _stonerEsc(needsAttention) + '</div></div></div>';
    }

    content.innerHTML = [
        '<div style="padding:32px 20px;max-width:400px;margin:0 auto;text-align:center">',
        '<div style="font-size:0.68em;font-weight:700;letter-spacing:0.12em;color:#64748b;text-transform:uppercase;margin-bottom:8px">Rehearsal Summary</div>',
        '<div style="font-size:2.4em;font-weight:900;color:#f1f5f9;line-height:1">' + totalSongs + '</div>',
        '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:20px">song' + (totalSongs !== 1 ? 's' : '') + ' played</div>',
        // Outcome row
        '<div style="display:flex;gap:12px;justify-content:center;margin-bottom:20px">',
        '<div style="text-align:center"><div style="font-size:1.6em;font-weight:800;color:#22c55e">' + s.good + '</div><div style="font-size:0.68em;color:#64748b">Good</div></div>',
        '<div style="text-align:center"><div style="font-size:1.6em;font-weight:800;color:#f59e0b">' + s.needswork + '</div><div style="font-size:0.68em;color:#64748b">Needs Work</div></div>',
        '<div style="text-align:center"><div style="font-size:1.6em;font-weight:800;color:#ef4444">' + s.trainwreck + '</div><div style="font-size:0.68em;color:#64748b">Trainwrecks</div></div>',
        '</div>',
        // Best streak
        s.bestStreak > 0 ? '<div style="font-size:0.9em;color:' + (s.bestStreak >= 3 ? '#22c55e' : '#94a3b8') + ';font-weight:700;margin-bottom:16px">&#x1F525; Best streak: ' + s.bestStreak + '</div>' : '',
        // Highlights
        highlightsHTML ? '<div style="text-align:left;padding:12px 16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;margin-bottom:20px">' + highlightsHTML + '</div>' : '',
        // CTA
        '<button class="stoner-big-btn" onclick="_stonerDismissSummary()" style="background:rgba(99,102,241,0.15);border-color:rgba(99,102,241,0.35);color:#a5b4fc;max-width:280px;margin:0 auto">Back to Command Center</button>',
        '</div>'
    ].join('');
}

function _stonerDismissSummary() {
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    _stonerExit();
    if (typeof showPage === 'function') showPage('home');
}

// ── Quick Chart Picker ──────────────────────────────────────────────────────

function _stonerQuickFilter(q) {
    var results = document.getElementById('stonerQuickResults');
    if (!results) return;
    if (!q || q.length < 2) { results.style.display = 'none'; results.innerHTML = ''; return; }
    var matches = (typeof allSongs !== 'undefined' ? allSongs : [])
        .filter(function(s) { return s.title.toLowerCase().indexOf(q.toLowerCase()) >= 0; })
        .slice(0, 5);
    if (!matches.length) { results.style.display = 'block'; results.innerHTML = '<div style="padding:10px;color:#64748b;font-size:0.85em">No songs found</div>'; return; }
    results.style.display = 'block';
    results.innerHTML = matches.map(function(s) {
        return '<div onclick="_stonerQuickOpen(\'' + s.title.replace(/'/g, "\\'") + '\')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;align-items:center;gap:8px;transition:background 0.1s" onmouseover="this.style.background=\'rgba(255,255,255,0.06)\'" onmouseout="this.style.background=\'\'">'
            + '<span style="font-size:0.95em;color:#f1f5f9;font-weight:600">' + _stonerEsc(s.title) + '</span>'
            + '<span style="margin-left:auto;font-size:0.7em;color:#818cf8;font-weight:700">CHART &#x276F;</span>'
            + '</div>';
    }).join('');
}

function _stonerQuickOpen(title) {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof openRehearsalMode === 'function') openRehearsalMode(title);
}

// Keep old home renderer as fallback
function _stonerRenderHome() {
    _stonerRenderCockpit();
}

function stonerSearch(q) {
    var results = document.getElementById('stonerSearchResults');
    if (!results) return;
    if (!q || q.length < 2) { results.innerHTML = ''; return; }
    var matches = (typeof allSongs !== 'undefined' ? allSongs : [])
        .filter(function(s) { return s.title.toLowerCase().includes(q.toLowerCase()); })
        .slice(0, 8);
    if (!matches.length) { results.innerHTML = '<div style="padding:12px 16px;color:#64748b;font-size:0.9em">No songs found</div>'; return; }
    results.innerHTML = matches.map(function(s) {
        var bandColor = { GD:'#f87171', JGB:'#60a5fa', WSP:'#fbbf24', PHISH:'#34d399' }[s.band] || '#94a3b8';
        return '<div class="stoner-song-row" onclick="stonerLaunchSong(\'' + s.title.replace(/'/g,"\\'") + '\')">'
            + '<span style="font-size:0.72em;font-weight:700;color:' + bandColor + ';background:' + bandColor + '18;padding:2px 7px;border-radius:10px;flex-shrink:0">' + (s.band||'?') + '</span>'
            + '<span style="flex:1;font-size:0.95em;font-weight:600;color:#f1f5f9">' + s.title + '</span>'
            + '<span style="font-size:1em;color:#64748b">\u276F</span>'
            + '</div>';
    }).join('');
}

function stonerLaunchSong(title) {
    // Close overlay, select song, open practice mode on Chart tab
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    // Use Practice Mode
    if (typeof openRehearsalMode === 'function') {
        openRehearsalMode(title);
    } else if (typeof selectSong === 'function') {
        showPage('songs');
        selectSong(title);
    }
}

function _stonerLoadRecent() {
    var container = document.getElementById('stonerRecentSongs');
    if (!container) return;
    // Get recent from activity log cache or localStorage
    var recent = [];
    try {
        var logged = JSON.parse(localStorage.getItem('deadcetera_recent_songs') || '[]');
        recent = logged.slice(0, 6);
    } catch(e) {}
    // Fallback: try activityLog global
    if (!recent.length && typeof window._activityLog !== 'undefined') {
        var seen = new Set();
        window._activityLog.forEach(function(entry) {
            if (entry.songTitle && !seen.has(entry.songTitle)) {
                seen.add(entry.songTitle);
                recent.push(entry.songTitle);
            }
        });
        recent = recent.slice(0, 6);
    }
    if (!recent.length) {
        container.innerHTML = '<div style="color:#475569;font-size:0.85em;padding:8px 0">Play some songs and they\'ll show up here</div>';
        return;
    }
    container.innerHTML = recent.map(function(title) {
        var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === title; });
        var band = songData ? songData.band : '';
        var bandColor = { GD:'#f87171', JGB:'#60a5fa', WSP:'#fbbf24', PHISH:'#34d399' }[band] || '#94a3b8';
        return '<div class="stoner-song-row" style="border-radius:10px;margin-bottom:4px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)" onclick="stonerLaunchSong(\'' + title.replace(/'/g,"\\'") + '\')">'
            + (band ? '<span style="font-size:0.7em;font-weight:700;color:' + bandColor + ';flex-shrink:0">' + band + '</span>' : '')
            + '<span style="flex:1;font-size:0.95em;color:#e2e8f0">' + title + '</span>'
            + '<span style="color:#64748b;font-size:0.9em">\uD83D\uDCCB</span>'
            + '</div>';
    }).join('');
}

function _stonerExitToPage(page) {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    showPage(page);
}

function stonerExitToGigs() { _stonerExitToPage('gigs'); }

function stonerGoHome() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    content.innerHTML = '<div id="stonerHome"></div>';
    _stonerRenderHome();
}

async function stonerOpenSetlists() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    var header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0';
    header.innerHTML = '<button onclick="stonerGoHome()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:600">\u2190 Home</button>'
        + '<span style="font-weight:700;color:#f1f5f9">\uD83D\uDCCB Setlists</span>';
    var listDiv = document.createElement('div');
    listDiv.id = 'stonerSetlistList';
    listDiv.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px';
    listDiv.innerHTML = '<div style="color:#64748b;font-size:0.85em;padding:20px;text-align:center">Loading...</div>';
    content.innerHTML = '';
    content.appendChild(header);
    content.appendChild(listDiv);

    var data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    data.sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
    var list = document.getElementById('stonerSetlistList');
    if (!list) return;
    if (!data.length) { list.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">No setlists yet</div>'; return; }
    list.innerHTML = data.map(function(sl, i) {
        var totalSongs = (sl.sets||[]).reduce(function(a,s){ return a+(s.songs||[]).length; }, 0);
        return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:10px">'
            + '<div style="font-weight:700;font-size:0.95em;color:#f1f5f9;margin-bottom:4px">' + (sl.name||'Untitled') + '</div>'
            + '<div style="font-size:0.78em;color:#64748b;display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
            + (sl.date ? '<span>\uD83D\uDCC5 ' + sl.date + '</span>' : '')
            + (sl.venue ? '<span>\uD83C\uDFDB\uFE0F ' + sl.venue + '</span>' : '')
            + '<span>\uD83C\uDFB5 ' + totalSongs + ' songs</span>'
            + '</div>'
            + '<button onclick="stonerLaunchSetlist(' + i + ')" style="background:linear-gradient(135deg,#22c55e,#16a34a);border:none;color:white;padding:8px 20px;border-radius:8px;font-size:0.85em;font-weight:700;cursor:pointer">\uD83C\uDFA4 Go Live</button>'
            + '</div>';
    }).join('');
}

async function stonerLaunchSetlist(idx) {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    if (typeof launchGigMode === 'function') await launchGigMode(idx);
}

function stonerOpenGigs() {
    var content = document.getElementById('stonerContent');
    if (!content) return;
    var header = document.createElement('div');
    header.style.cssText = 'padding:12px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0';
    header.innerHTML = '<button onclick="stonerGoHome()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.85em;font-weight:600">\u2190 Home</button>'
        + '<span style="font-weight:700;color:#f1f5f9">\uD83C\uDFA4 Gigs</span>'
        + '<button onclick="stonerExitToGigs()" style="margin-left:auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em">Full View \u2192</button>';
    var bodyDiv = document.createElement('div');
    bodyDiv.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px 16px';
    bodyDiv.innerHTML = '<div style="color:#64748b;font-size:0.85em;padding:20px;text-align:center">Loading gigs...</div>';
    content.innerHTML = '';
    content.appendChild(header);
    content.appendChild(bodyDiv);
    // Load gigs async
    loadBandDataFromDrive('_band','gigs').then(function(raw2) {
        var gigs = toArray(raw2||[]).sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
        if (!gigs.length) { bodyDiv.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">No gigs yet</div>'; return; }
        var upcoming = gigs.filter(function(g){ return g.date >= new Date().toISOString().slice(0,10); });
        var past = gigs.filter(function(g){ return g.date < new Date().toISOString().slice(0,10); });
        function gigCard(g) {
            return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px 16px;margin-bottom:8px">'
                + '<div style="font-weight:700;color:#f1f5f9">' + (g.venue||'Unknown Venue') + '</div>'
                + '<div style="font-size:0.8em;color:#64748b;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">'
                + (g.date?'<span>\uD83D\uDCC5 '+g.date+'</span>':'')
                + (g.startTime?'<span>\uD83D\uDD50 '+g.startTime+'</span>':'')
                + (g.pay?'<span>\uD83D\uDCB0 '+g.pay+'</span>':'')
                + '</div></div>';
        }
        var html = '';
        if (upcoming.length) {
            html += '<div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px">Upcoming</div>';
            html += upcoming.map(gigCard).join('');
        }
        if (past.length) {
            html += '<div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;margin:16px 0 8px">Past</div>';
            html += past.slice(0,5).map(gigCard).join('');
        }
        bodyDiv.innerHTML = html;
    });
}

async function stonerPickSetlist() {
    var container = document.getElementById('stonerContent');
    if (!container) return;
    container.innerHTML = '';
    var el = document.createElement('div');
    el.style.cssText = 'padding:20px 16px';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:16px';
    var backBtn = document.createElement('button');
    backBtn.textContent = '\u2190 Back';
    backBtn.className = 'btn btn-ghost btn-sm';
    backBtn.onclick = stonerGoHome;
    var title = document.createElement('div');
    title.style.cssText = 'font-weight:800;font-size:1.1em;color:#f1f5f9';
    title.textContent = '\uD83D\uDCCB Pick a Setlist';
    header.appendChild(backBtn);
    header.appendChild(title);
    el.appendChild(header);

    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    setlists.sort(function(a,b) { return (b.updatedAt||b.date||'').localeCompare(a.updatedAt||a.date||''); });

    if (!setlists.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'text-align:center;color:#64748b;padding:40px 0;font-size:0.9em';
        empty.textContent = 'No setlists yet. Create one in the Setlists page.';
        el.appendChild(empty);
    } else {
        setlists.forEach(function(sl, i) {
            var btn = document.createElement('button');
            btn.className = 'stoner-big-btn';
            var songCount = (sl.sets||[]).reduce(function(a,s){return a+(s.songs||[]).length;},0);
            btn.innerHTML = '<span style="font-size:1.3em">\uD83D\uDCCB</span>'
                + '<span style="flex:1;text-align:left"><div style="font-weight:800">' + (sl.name||'Untitled') + '</div>'
                + '<div style="font-size:0.72em;opacity:0.7;margin-top:2px">' + (sl.date?sl.date+' \u2022 ':'') + songCount + ' songs</div></span>';
            btn.style.cssText = 'background:rgba(102,126,234,0.1);border-color:rgba(102,126,234,0.25);color:#c7d2fe;margin-bottom:8px;justify-content:flex-start;padding:14px 16px;gap:12px';
            btn.onclick = function() {
                localStorage.setItem('deadcetera_stoner_setlist', i);
                _stonerUpdateSetlistLabel();
                stonerGoHome();
                showToast('\uD83D\uDCCB ' + (sl.name||'Setlist') + ' selected');
            };
            el.appendChild(btn);
        });
    }
    container.appendChild(el);
}

function _stonerUpdateSetlistLabel() {
    var label = document.getElementById('stonerActiveSetlistLabel');
    if (!label) return;
    var idx = localStorage.getItem('deadcetera_stoner_setlist');
    if (idx === null) { label.textContent = 'Pick a Setlist'; return; }
    // Load name async
    loadBandDataFromDrive('_band', 'setlists').then(function(setlists) {
        setlists = toArray(setlists || []);
        setlists.sort(function(a,b) { return (b.updatedAt||b.date||'').localeCompare(a.updatedAt||a.date||''); });
        var sl = setlists[parseInt(idx)];
        if (sl) label.textContent = sl.name || 'Setlist';
        else { label.textContent = 'Pick a Setlist'; localStorage.removeItem('deadcetera_stoner_setlist'); }
    });
}

function stonerOpenTuner() {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    showPage('tuner');
}

function stonerOpenMetronome() {
    _stonerExit();
    _stonerMode = false;
    localStorage.setItem('deadcetera_stoner_mode', '0');
    var btn = document.getElementById('stonerBtn');
    if (btn) { btn.textContent = '\uD83C\uDF3F Mode'; btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = ''; }
    showPage('metronome');
}

// ── Inject Stoner Mode button into topbar on load ─────────────────────────────
(function() {
    function injectStonerBtn() {
        if (document.getElementById('stonerBtn')) return;
        var topbarRight = document.querySelector('.topbar-right');
        if (!topbarRight) return;
        var btn = document.createElement('button');
        btn.id = 'stonerBtn';
        btn.className = 'topbar-btn';
        btn.title = 'Stoner Mode — simplified UI for when you just wanna play';
        btn.textContent = '\uD83C\uDF3F Mode';
        btn.onclick = toggleStonerMode;
        // Insert before the last button (settings gear)
        var gear = topbarRight.querySelector('[title*="Settings"],[onclick*="admin"],[onclick*="settings"]');
        if (gear) {
            topbarRight.insertBefore(btn, gear);
        } else {
            topbarRight.appendChild(btn);
        }
        // Restore stoner mode state if it was on
        if (localStorage.getItem('deadcetera_stoner_mode') === '1') {
            _stonerMode = true;
            _stonerEnter();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(injectStonerBtn, 500); });
    } else {
        setTimeout(injectStonerBtn, 500);
    }
})();

console.log('\uD83C\uDF3F Stoner Mode loaded');

// ── Window exports (called from inline HTML onclick handlers) ──────────────
window.toggleStonerMode = toggleStonerMode;
window.stonerSearch = stonerSearch;
window.stonerLaunchSong = stonerLaunchSong;
window.stonerExitToGigs = stonerExitToGigs;
window.stonerGoHome = stonerGoHome;
window.stonerOpenSetlists = stonerOpenSetlists;
window.stonerLaunchSetlist = stonerLaunchSetlist;
window.stonerOpenGigs = stonerOpenGigs;
window.stonerPickSetlist = stonerPickSetlist;
window.stonerOpenTuner = stonerOpenTuner;
window.stonerOpenMetronome = stonerOpenMetronome;
// Stoner Mode v1 cockpit functions
window._stonerOpenChart = _stonerOpenChart;
window._stonerStartRun = _stonerStartRun;
window._stonerOutcome = _stonerOutcome;
window._stonerNextSong = _stonerNextSong;
window._stonerDismissSummary = _stonerDismissSummary;
window._stonerQuickFilter = _stonerQuickFilter;
window._stonerQuickOpen = _stonerQuickOpen;
