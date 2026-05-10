// ── GrooveLinx Workbench (MVP shell) ─────────────────────────────────────
// Spec: 02_GrooveLinx/specs/song_workbench_architecture.md (v0.2)
//
// Minimum viable: only Practice mode is wired. Other mode tabs render
// disabled. Body mounts the existing song-detail surface (chart + player
// via the lens system) using its `containerOverride` + `panelMode` API.
// Right rail shows Tasks (filtered to this song) and Notes.
//
// PracticeTask launch (opts.taskId) fetches the task, highlights it in
// the rail with a "From last rehearsal" badge, and waits for the STUDY
// engine (stems player) to mount before applying a ±15s loop around
// task.timestampSec via the existing PlayerContract.

(function() {
    var _wbState = window._wbState || null;

    // ── Public entry point ──────────────────────────────────────────────────
    // Stash the launch context, then route through the standard page system.
    // The renderer (registered below) reads _wbState and builds the shell.
    window.openWorkbench = function openWorkbench(songId, mode, opts) {
        if (!songId) {
            console.warn('[wb] openWorkbench called without songId');
            return;
        }
        window._wbState = { songId: songId, mode: mode || 'practice', opts: opts || {} };
        if (typeof showPage === 'function') showPage('workbench');
        // Re-render the Run-the-Gig strip if a run is active. showPage
        // rebuilds the page DOM but the strip lives at <body> level so
        // it persists; we still need to refresh its label/timer to match
        // the new song.
        if (window._gigRunState && typeof window._gigRunRenderStripIfActive === 'function') {
            setTimeout(window._gigRunRenderStripIfActive, 0);
        }
    };

    // Tiny window-scoped helper so practice.js can poke the strip from
    // openWorkbench without practice.js having to re-export anything.
    window._gigRunRenderStripIfActive = function() {
        if (!window._gigRunState) return;
        // The render function is internal to practice.js; we expose a
        // refresh trigger by dispatching a custom event practice.js can
        // listen for. Simpler: practice.js's _gigRunOpenCurrent already
        // calls _gigRunRenderStrip after openWorkbench, so this is a
        // safety net for direct showPage('workbench') jumps.
        try { document.dispatchEvent(new CustomEvent('gigrun:refresh')); } catch (e) {}
    };

    // ── Shell render ────────────────────────────────────────────────────────
    function _wbRender(songId, mode, opts) {
        var page = document.getElementById('page-workbench');
        if (!page) return;
        _wbInjectStyles();
        page.innerHTML = _wbShellHTML(songId, mode);

        // Mount existing song-detail into the body. panelMode keeps it
        // single-column so it slots into the workbench layout cleanly.
        // Mark the container with `wb-mounted-detail` so Workbench-scoped
        // CSS can hide the song-detail lens tab strip — Workbench's own
        // mode tabs are the outer navigation; the inner lens picker felt
        // like a duplicate menu (Drew's feedback).
        var body = page.querySelector('#wb-body');
        if (body && typeof renderSongDetail === 'function') {
            body.classList.add('wb-mounted-detail');
            try {
                renderSongDetail(songId, body, { panelMode: true });
                // Auto-default to Stems lens — that's where the player +
                // loop live, and Practice mode's whole point is "play
                // along with the section the task flagged." Defer a tick
                // so song-detail finishes setting up its tabs first.
                setTimeout(function() {
                    if (typeof window.switchLens === 'function') {
                        try { window.switchLens('stems'); } catch (e) {}
                    }
                    _wbInjectChartHint();
                    // Practice mode auto-launches the floating player with
                    // the song's North Star (or first available reference)
                    // so the user can start playing along immediately.
                    // Per the GLP Floating Player spec 2026-05-10:
                    //   Practice → Medium, Rehearsal → Mini, Gig → hidden.
                    if (mode === 'practice') {
                        _wbAutoLaunchPlayer(songId, opts || {});
                    }
                }, 60);
            } catch (e) {
                console.error('[wb] song-detail mount failed:', e);
                body.innerHTML = '<div class="wb-empty">Could not mount practice surface.</div>';
            }
        }

        // Initial rail (will re-render once task context loads if a taskId
        // was passed — applies the highlight + badge in-place).
        _wbRenderRail(songId, opts || {});

        if (opts && opts.taskId) {
            _wbApplyTaskContext(songId, opts.taskId);
        }
    }

    function _wbShellHTML(songId, mode) {
        var modes = [
            { id: 'practice',  label: 'Practice',  enabled: true  },
            { id: 'rehearsal', label: 'Rehearsal', enabled: false },
            { id: 'gig',       label: 'Gig',       enabled: false },
            { id: 'review',    label: 'Review',    enabled: false }
        ];
        var modeTabs = modes.map(function(m) {
            var isActive = (m.id === mode);
            var classes = 'wb-mode-tab' + (isActive ? ' active' : '') + (m.enabled ? '' : ' disabled');
            var attrs = m.enabled
                ? 'onclick="window._wbSetMode(\'' + m.id + '\')"'
                : 'disabled title="Coming soon"';
            return '<button class="' + classes + '" ' + attrs + '>' + m.label + '</button>';
        }).join('');
        // "More views" dropdown surfaces the song-detail lenses we hide
        // inside Workbench. Most of Practice mode wants the Stems lens
        // visible, but users still need access to Versions (vote/north
        // star), Harmony (chart), Inspire (related), etc.
        var moreViewsHTML =
            '<div class="wb-more-views">' +
                '<button class="wb-more-views-btn" onclick="window._wbToggleMoreViews(this)" title="Switch the inner panel to a different view">More views ▾</button>' +
                '<div class="wb-more-views-menu" hidden>' +
                    '<button onclick="window._wbJumpLens(\'stems\')">🎚 Stems (default)</button>' +
                    '<button onclick="window._wbJumpLens(\'band\')">📋 Chart</button>' +
                    '<button onclick="window._wbJumpLens(\'learn\')">🎓 Practice</button>' +
                    '<button onclick="window._wbJumpLens(\'listen\')">🎧 Versions</button>' +
                    '<button onclick="window._wbJumpLens(\'sing\')">🎤 Harmony</button>' +
                    '<button onclick="window._wbJumpLens(\'inspire\')">✨ Inspire</button>' +
                '</div>' +
            '</div>';
        return '<div class="wb-root">' +
            '<header class="wb-header">' +
                '<div class="wb-song-title">' + _wbEsc(songId) + '</div>' +
                moreViewsHTML +
                '<button class="wb-close" onclick="window._wbClose()" title="Back to Practice">✕</button>' +
            '</header>' +
            '<nav class="wb-mode-tabs" role="tablist">' + modeTabs + '</nav>' +
            '<div class="wb-layout">' +
                '<main class="wb-body" id="wb-body">' +
                    '<button id="wb-chart-max-btn" class="wb-chart-max-btn" onclick="window._wbToggleChartMax()" title="Maximize chart (F · Esc to exit)">⤢</button>' +
                '</main>' +
                '<aside class="wb-rail" id="wb-rail"></aside>' +
            '</div>' +
            // Action bar — sticky bottom. Hidden by default; shown when an
            // active PracticeTask is loaded. Drives the completion loop:
            // Mark as Improved → resolve task + auto-advance to next.
            '<footer class="wb-action-bar" id="wb-action-bar" hidden>' +
                '<button class="wb-action wb-action-improved" onclick="window._wbMarkImproved()" title="Resolve this task and advance to the next one">✓ Mark as Improved</button>' +
                '<button class="wb-action wb-action-next" onclick="window._wbAdvanceToNext()" title="Skip to the next task without marking this one">Next ▶</button>' +
            '</footer>' +
        '</div>';
    }

    // ── Right rail: Tasks + Notes ───────────────────────────────────────────
    async function _wbRenderRail(songId, opts) {
        var rail = document.getElementById('wb-rail');
        if (!rail) return;
        opts = opts || {};
        var activeTaskId = opts.taskId || null;

        var tasks = await _wbLoadTasksForSong(songId);
        var notesByScope = await _wbLoadNotes(songId);

        var tasksHTML = tasks.length
            ? tasks.map(function(t) { return _wbRenderTaskRow(t, activeTaskId); }).join('')
            : '<div class="wb-empty">No open practice tasks for this song yet.</div>';

        var notesHTML = _wbRenderNotesList(notesByScope);

        rail.innerHTML =
            '<section class="wb-rail-card">' +
                '<header class="wb-rail-header">🎯 Tasks</header>' +
                tasksHTML +
            '</section>' +
            '<section class="wb-rail-card">' +
                '<header class="wb-rail-header">📝 Notes</header>' +
                notesHTML +
            '</section>';
    }

    function _wbRenderTaskRow(task, activeTaskId) {
        var active = (task.taskId === activeTaskId);
        var ts = (typeof task.timestampSec === 'number') ? _wbFmtTime(task.timestampSec) : '';
        // Member context — read by name, not key. "Brian (Bass)" reads
        // better than "brian · bass" (Drew/ChatGPT critique 2026-05-10).
        var memberName = '';
        var trackLabel = task.trackId ? String(task.trackId).charAt(0).toUpperCase() + String(task.trackId).slice(1) : '';
        try {
            if (task.memberKey && typeof bandMembers !== 'undefined' && bandMembers) {
                Object.keys(bandMembers).forEach(function(email) {
                    var m = bandMembers[email] || {};
                    if (m.key === task.memberKey || (m.name && m.name.toLowerCase() === String(task.memberKey).toLowerCase())) {
                        memberName = m.name || '';
                    }
                });
                if (!memberName) memberName = String(task.memberKey).charAt(0).toUpperCase() + String(task.memberKey).slice(1);
            }
        } catch (e) {}
        var who = '';
        if (memberName && trackLabel) who = ' · ' + _wbEsc(memberName) + ' (' + _wbEsc(trackLabel) + ')';
        else if (memberName)         who = ' · ' + _wbEsc(memberName);
        else if (trackLabel)         who = ' · ' + _wbEsc(trackLabel);
        var badge = active
            ? '<span class="wb-task-badge" title="Promoted from a recent rehearsal review">From last rehearsal</span>'
            : '';
        var text = task.noteText || 'Practice this section';
        return '<div class="wb-task' + (active ? ' active' : '') + '">' +
            '<div class="wb-task-text">' + _wbEsc(text) + '</div>' +
            '<div class="wb-task-meta">' + (ts ? '<span class="wb-task-ts">' + ts + '</span>' : '') + who + badge + '</div>' +
        '</div>';
    }

    function _wbRenderNotesList(notesByScope) {
        if (!notesByScope || !notesByScope.length) return '<div class="wb-empty">No notes yet.</div>';
        var rows = [];
        notesByScope.forEach(function(group) {
            (group.items || []).forEach(function(item) {
                rows.push({ scope: group.scope, text: (item && (item.text || item)) || '', ts: (item && item.timestamp) || 0 });
            });
        });
        if (!rows.length) return '<div class="wb-empty">No notes yet.</div>';
        // Most recent first, cap at 8 so rail doesn't get tall
        rows.sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
        return rows.slice(0, 8).map(function(n) {
            return '<div class="wb-note">' +
                '<div class="wb-note-scope">' + _wbEsc(n.scope) + '</div>' +
                '<div class="wb-note-text">' + _wbEsc(n.text) + '</div>' +
            '</div>';
        }).join('');
    }

    // ── PracticeTask context: highlight in rail + auto-loop on player ──────
    async function _wbApplyTaskContext(songId, taskId) {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return;
        var snap = null;
        try { snap = await db.ref(bandPath('practice_tasks/' + taskId)).once('value'); } catch (e) {}
        var task = snap && snap.val();
        if (!task) return;
        // Stamp the active task on window so any other surface can read it
        // and so the existing rh-side stash stays in sync.
        window._wbActiveTask = task;
        window._rhActivePracticeTask = task;
        // Reveal the completion action bar (hidden when no task).
        var bar = document.getElementById('wb-action-bar');
        if (bar) bar.hidden = false;
        // Re-render the rail with this taskId active (overrides initial pass)
        _wbRenderRail(songId, { taskId: taskId });
        // Defer loop application until the STUDY engine is mounted (which
        // typically only happens once the user opens the Stems lens or
        // stems are auto-loaded for an already-separated song).
        if (typeof task.timestampSec === 'number') {
            _wbWaitForStudyEngineAndApply(task);
        }
    }

    // ── Completion loop: Mark as Improved + Next ────────────────────────────
    // The "momentum" pattern from the Practice flow spec — closing one task
    // should pull the next one in front of the user immediately. Without
    // auto-advance, every completion drops them back to the Practice page
    // and they have to click again, breaking flow.

    async function _wbLoadAllOpenTasks() {
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
                .sort(function(a, b) { return (b.createdAt || 0) > (a.createdAt || 0) ? 1 : -1; });
        } catch (e) { return []; }
    }

    var _wbAdvanceTimer = null;

    window._wbMarkImproved = async function() {
        var task = window._wbActiveTask;
        if (!task || !task.taskId) {
            if (typeof showToast === 'function') showToast('No active task to mark');
            return;
        }
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') {
            if (typeof showToast === 'function') showToast('Cannot save: offline');
            return;
        }
        try {
            await db.ref(bandPath('practice_tasks/' + task.taskId)).update({
                status: 'resolved',
                resolvedAt: Date.now(),
                resolvedBy: (typeof currentUserEmail !== 'undefined' ? currentUserEmail : '') || ''
            });
        } catch (e) {
            console.warn('[wb] mark improved failed:', e);
            if (typeof showToast === 'function') showToast('Failed to mark: ' + (e.message || e));
            return;
        }
        // Auto-advance with 1s delay + cancel option per Drew/ChatGPT
        // critique 2026-05-10: gives the user a moment to feel "I just
        // finished" before the next task lands. Cancel clears the timer
        // and stays on the current task. Momentum without whiplash.
        _wbShowAdvanceCountdown();
    };

    function _wbShowAdvanceCountdown() {
        // Replace the action bar with a "Loading next…" + Cancel overlay.
        var bar = document.getElementById('wb-action-bar');
        if (!bar) {
            // No bar to swap — just advance immediately.
            _wbAdvanceToNextTask();
            return;
        }
        var prevHTML = bar.innerHTML;
        bar.innerHTML =
            '<div class="wb-advance-countdown" style="flex:1;display:flex;align-items:center;gap:10px;font-weight:700;color:#86efac">' +
                '<span style="font-size:1.1em">✓</span>' +
                '<span>Marked as improved — loading next task…</span>' +
            '</div>' +
            '<button class="wb-action wb-action-next" onclick="window._wbCancelAdvance()" style="flex:0 0 auto">Cancel</button>';
        if (_wbAdvanceTimer) clearTimeout(_wbAdvanceTimer);
        _wbAdvanceTimer = setTimeout(function() {
            _wbAdvanceTimer = null;
            _wbAdvanceToNextTask();
        }, 1000);
        // Stash the previous HTML so cancel can restore it (no full
        // re-render needed — keeps any inline state).
        bar.dataset._prevHtml = prevHTML;
    }

    window._wbCancelAdvance = function() {
        if (_wbAdvanceTimer) {
            clearTimeout(_wbAdvanceTimer);
            _wbAdvanceTimer = null;
        }
        var bar = document.getElementById('wb-action-bar');
        if (bar && bar.dataset._prevHtml) {
            bar.innerHTML = bar.dataset._prevHtml;
            delete bar.dataset._prevHtml;
        }
        if (typeof showToast === 'function') showToast('Stayed on current task');
    };

    window._wbAdvanceToNext = async function() {
        await _wbAdvanceToNextTask();
    };

    // ── Chart fullscreen toggle ─────────────────────────────────────────────
    // Recreates the old "1-click fullscreen chart" experience as a top-level
    // overlay (independent of song-detail's max-width constraints). Brings
    // the legacy rehearsal-mode chart toolbar (font size, transpose, auto-
    // scroll) so practice in fullscreen has the same controls as gigs.
    // Keyboard: F to toggle, Esc to exit.
    window._wbChartMaxState = false;
    var _CHART_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    // Match a chord root (A-G with optional #/b) followed by its quality/
    // extension token. Word-boundary anchored to skip lyric words.
    var _CHART_NOTE_RE = /\b([A-G][#b]?)((?:m|maj|min|dim|aug|sus|add)?[0-9b#+\-/]*)?\b/g;
    window._wbChartFs = {
        fontSize: 14,     // px
        semitones: 0,     // transpose
        scrolling: false,
        scrollSpeed: 2,   // 1-5
        scrollTimer: null,
        originalText: ''
    };

    async function _wbLoadChartTextForCurrent() {
        var st = window._wbState;
        if (!st || !st.songId) return null;
        // Try cached chart first (set by song-detail when it loaded)
        if (typeof window._sdCachedChart === 'string' && window._sdCachedChart) {
            return window._sdCachedChart;
        }
        if (typeof loadBandDataFromDrive !== 'function') return null;
        try {
            var d = await loadBandDataFromDrive(st.songId, 'chart');
            return (d && d.text && d.text.trim()) ? d.text : null;
        } catch (e) { return null; }
    }

    window._wbToggleChartMax = async function() {
        var existing = document.getElementById('wbChartFs');
        if (existing) { _wbExitChartFs(); return; }
        var st = window._wbState;
        if (!st || !st.songId) return;
        var chartText = await _wbLoadChartTextForCurrent();
        var songObj = (typeof allSongs !== 'undefined') ? (allSongs.find(function(s){return s.title === st.songId;}) || {}) : {};
        window._wbChartFs.originalText = chartText || '';
        window._wbChartFs.semitones = 0;
        window._wbChartFs.scrolling = false;
        window._wbChartFs.songKey = songObj.key || '';
        window._wbChartFs.songBpm = songObj.bpm || '';
        var overlay = document.createElement('div');
        overlay.id = 'wbChartFs';
        overlay.className = 'wb-chart-fs';
        overlay.innerHTML = _wbBuildChartFsHTML(st.songId, chartText);
        document.body.appendChild(overlay);
        // Set chart text via textContent (avoids HTML-encoding issues with
        // chord characters like # in chart text)
        var pre = document.getElementById('wbChartFsText');
        if (pre && chartText) {
            var decoded = (typeof window.glDecodeHtmlEntities === 'function')
                ? window.glDecodeHtmlEntities(chartText)
                : chartText;
            window._wbChartFs.originalText = decoded;
            pre.textContent = decoded;
        }
        window._wbChartMaxState = true;
        var btn = document.getElementById('wb-chart-max-btn');
        if (btn) { btn.textContent = '⤡'; btn.title = 'Restore chart (Esc to exit)'; }
    };

    function _wbExitChartFs() {
        var existing = document.getElementById('wbChartFs');
        if (!existing) return;
        if (window._wbChartFs.scrollTimer) {
            clearInterval(window._wbChartFs.scrollTimer);
            window._wbChartFs.scrollTimer = null;
        }
        existing.remove();
        window._wbChartMaxState = false;
        var btn = document.getElementById('wb-chart-max-btn');
        if (btn) { btn.textContent = '⤢'; btn.title = 'Maximize chart (F · Esc to exit)'; }
    }

    function _wbBuildChartFsHTML(songId, chartText) {
        var st = window._wbChartFs;
        var keyDisplay = st.songKey || '—';
        var bpm = st.songBpm ? (st.songBpm + ' BPM') : '';
        var hasChart = !!(chartText && chartText.trim());
        var chartBody = hasChart
            ? '<pre id="wbChartFsText" class="wb-chart-fs-text" style="font-size:' + st.fontSize + 'px"></pre>'
            : '<div class="wb-chart-fs-empty"><div style="font-size:2.4em;margin-bottom:10px">📋</div><div style="font-weight:700;font-size:1.05em;margin-bottom:6px">No chord chart yet for ' + _wbEsc(songId) + '</div><div style="color:var(--text-dim);margin-bottom:14px">Add one now — type or paste chords, lyrics, and section markers.</div><button class="wb-fs-btn wb-chart-editor-save" onclick="window._wbToggleChartMax();window._wbOpenChartEditor()" style="padding:8px 18px">📝 Add Chart</button></div>';
        return ''+
        '<div class="wb-chart-fs-toolbar">'+
            '<div class="wb-chart-fs-song">'+
                '<div class="wb-chart-fs-title">' + _wbEsc(songId) + '</div>'+
                '<div class="wb-chart-fs-meta">' +
                    '<span id="wbChartFsKeyDisplay">' + _wbEsc(keyDisplay) + '</span>' +
                    (bpm ? ' · <span>' + _wbEsc(bpm) + '</span>' : '') +
                '</div>'+
            '</div>'+
            '<div class="wb-chart-fs-controls">'+
                '<button class="wb-fs-btn" onclick="window._wbChartFsTranspose(-1)" title="Transpose down (♭)">♭</button>'+
                '<span class="wb-fs-val" id="wbChartFsSemi">' + (st.semitones === 0 ? '0' : (st.semitones > 0 ? '+' + st.semitones : st.semitones)) + '</span>'+
                '<button class="wb-fs-btn" onclick="window._wbChartFsTranspose(1)" title="Transpose up (♯)">♯</button>'+
                '<span class="wb-fs-sep"></span>'+
                '<button class="wb-fs-btn" onclick="window._wbChartFsFont(-1)" title="Smaller text">A−</button>'+
                '<button class="wb-fs-btn" onclick="window._wbChartFsFont(1)" title="Larger text">A+</button>'+
                '<span class="wb-fs-sep"></span>'+
                '<button class="wb-fs-btn" id="wbChartFsScrollBtn" onclick="window._wbChartFsToggleScroll()" title="Auto-scroll">📜</button>'+
                '<button class="wb-fs-btn wb-fs-btn-scroll-adj wb-fs-hidden" id="wbChartFsScrollDown" onclick="window._wbChartFsScrollSpeed(-1)" title="Slower">−</button>'+
                '<span class="wb-fs-val wb-fs-hidden" id="wbChartFsScrollSpeed">' + st.scrollSpeed + '</span>'+
                '<button class="wb-fs-btn wb-fs-btn-scroll-adj wb-fs-hidden" id="wbChartFsScrollUp" onclick="window._wbChartFsScrollSpeed(1)" title="Faster">+</button>'+
                '<span class="wb-fs-sep"></span>'+
                '<button class="wb-fs-btn wb-fs-exit" onclick="window._wbToggleChartMax()" title="Exit fullscreen (Esc)">✕</button>'+
            '</div>'+
        '</div>'+
        '<div class="wb-chart-fs-body" id="wbChartFsBody">' + chartBody + '</div>';
    }

    // ── Chart toolbar handlers ─────────────────────────────────────────────
    window._wbChartFsFont = function(delta) {
        var st = window._wbChartFs;
        st.fontSize = Math.max(10, Math.min(36, st.fontSize + delta));
        var pre = document.getElementById('wbChartFsText');
        if (pre) pre.style.fontSize = st.fontSize + 'px';
    };

    window._wbChartFsTranspose = function(delta) {
        var st = window._wbChartFs;
        st.semitones = ((st.semitones + delta) % 12 + 12) % 12;
        if (st.semitones > 6) st.semitones -= 12; // prefer signed range -5..+6
        _wbChartFsApplyTranspose();
        var semiEl = document.getElementById('wbChartFsSemi');
        if (semiEl) semiEl.textContent = st.semitones === 0 ? '0' : (st.semitones > 0 ? '+' + st.semitones : String(st.semitones));
        // Update key display if we know the original key
        var keyEl = document.getElementById('wbChartFsKeyDisplay');
        if (keyEl && st.songKey) {
            var keyRoot = (st.songKey.match(/^[A-G][#b]?/) || ['C'])[0];
            var keyIdx = _CHART_NOTES.indexOf(keyRoot);
            if (keyRoot.length === 2 && keyRoot[1] === 'b') {
                keyIdx = (_CHART_NOTES.indexOf(keyRoot[0]) - 1 + 12) % 12;
            }
            if (keyIdx >= 0) {
                var newKeyIdx = (keyIdx + st.semitones + 12) % 12;
                var suffix = st.songKey.replace(/^[A-G][#b]?/, '');
                keyEl.textContent = _CHART_NOTES[newKeyIdx] + suffix + (st.semitones !== 0 ? ' (' + (st.semitones > 0 ? '+' : '') + st.semitones + ')' : '');
            }
        }
    };

    function _wbChartFsApplyTranspose() {
        var st = window._wbChartFs;
        var pre = document.getElementById('wbChartFsText');
        if (!pre || !st.originalText) return;
        if (st.semitones === 0) {
            pre.textContent = st.originalText;
            return;
        }
        var transposed = st.originalText.replace(_CHART_NOTE_RE, function(match, root, suffix) {
            if (!root) return match;
            var idx = _CHART_NOTES.indexOf(root);
            if (root.length === 2 && root[1] === 'b') {
                idx = (_CHART_NOTES.indexOf(root[0]) - 1 + 12) % 12;
            }
            if (idx === -1) return match;
            var newIdx = (idx + st.semitones + 12) % 12;
            return _CHART_NOTES[newIdx] + (suffix || '');
        });
        pre.textContent = transposed;
    }

    window._wbChartFsToggleScroll = function() {
        var st = window._wbChartFs;
        st.scrolling = !st.scrolling;
        var btn = document.getElementById('wbChartFsScrollBtn');
        if (btn) {
            btn.textContent = st.scrolling ? '⏸' : '📜';
            btn.classList.toggle('wb-fs-active', st.scrolling);
        }
        ['wbChartFsScrollDown','wbChartFsScrollSpeed','wbChartFsScrollUp'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.classList.toggle('wb-fs-hidden', !st.scrolling);
        });
        if (st.scrollTimer) { clearInterval(st.scrollTimer); st.scrollTimer = null; }
        if (st.scrolling) _wbChartFsStartScroll();
    };

    window._wbChartFsScrollSpeed = function(delta) {
        var st = window._wbChartFs;
        st.scrollSpeed = Math.max(1, Math.min(5, st.scrollSpeed + delta));
        var el = document.getElementById('wbChartFsScrollSpeed');
        if (el) el.textContent = st.scrollSpeed;
        if (st.scrolling) {
            if (st.scrollTimer) clearInterval(st.scrollTimer);
            _wbChartFsStartScroll();
        }
    };

    function _wbChartFsStartScroll() {
        var st = window._wbChartFs;
        var body = document.getElementById('wbChartFsBody');
        if (!body) return;
        // Speeds 1-5 → 1px every 80/60/45/30/20 ms
        var intervalMs = [80, 60, 45, 30, 20][st.scrollSpeed - 1] || 45;
        st.scrollTimer = setInterval(function() {
            if (!body || !st.scrolling) return;
            body.scrollTop += 1;
            if (body.scrollTop + body.clientHeight >= body.scrollHeight - 1) {
                // Stop at the bottom
                window._wbChartFsToggleScroll();
            }
        }, intervalMs);
    }

    document.addEventListener('keydown', function(e) {
        var page = document.getElementById('page-workbench');
        if (!page || page.classList.contains('hidden')) return;
        var t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        var key = (typeof e.key === 'string') ? e.key.toLowerCase() : '';
        if (key === 'f') {
            window._wbToggleChartMax();
            e.preventDefault();
            return;
        }
        if (e.key === 'Escape' && window._wbChartMaxState) {
            _wbExitChartFs();
            e.preventDefault();
        }
    });


    async function _wbAdvanceToNextTask() {
        var current = window._wbActiveTask;
        var tasks = await _wbLoadAllOpenTasks();
        // Skip current (in case it hasn't propagated as resolved yet)
        var next = tasks.find(function(t) {
            return t && t.taskId && (!current || t.taskId !== current.taskId);
        });
        if (next) {
            var songId = next.songId || next.songTitle;
            if (songId && typeof window.openWorkbench === 'function') {
                window.openWorkbench(songId, 'practice', { taskId: next.taskId });
                return;
            }
        }
        // No more tasks — return to Practice Command Center
        if (typeof showToast === 'function') showToast('🎉 All practice tasks done — back to Practice');
        window._wbActiveTask = null;
        if (typeof showPage === 'function') showPage('practice');
    }

    function _wbWaitForStudyEngineAndApply(task) {
        var contract = window.GLPlayerContract;
        if (!contract || !contract.get || !contract.INTENTS || !contract.INTENTS.STUDY) return;
        var maxAttempts = 40; // ~8 s
        var attempts = 0;
        var poll = setInterval(function() {
            attempts++;
            var engine = contract.get(contract.INTENTS.STUDY);
            var mounted = engine && typeof engine.isMounted === 'function' && engine.isMounted();
            if (mounted) {
                clearInterval(poll);
                _wbApplyLoop(engine, task);
            } else if (attempts >= maxAttempts) {
                clearInterval(poll);
                // Silent — many songs don't have stems yet. The rail
                // highlight + badge still surface the task context.
            }
        }, 200);
    }

    function _wbApplyLoop(engine, task) {
        try {
            var contract = window.GLPlayerContract;
            var ts = task.timestampSec || 0;
            var inSec = Math.max(0, ts - 15);
            var outSec = ts + 15;
            if (engine.has && contract.CAPABILITIES && engine.has(contract.CAPABILITIES.LOOP) && engine.loop) {
                if (typeof engine.loop.setIn === 'function') engine.loop.setIn(inSec);
                if (typeof engine.loop.setOut === 'function') engine.loop.setOut(outSec);
                var current = (typeof engine.loop.get === 'function') ? engine.loop.get() : null;
                if ((!current || !current.enabled) && typeof engine.loop.toggle === 'function') {
                    engine.loop.toggle();
                }
                if (typeof showToast === 'function') {
                    showToast('🎯 Looping ' + _wbFmtTime(inSec) + '–' + _wbFmtTime(outSec));
                }
            }
        } catch (e) {
            console.warn('[wb] loop apply failed:', e);
        }
    }

    // ── Data loaders ────────────────────────────────────────────────────────
    async function _wbLoadTasksForSong(songId) {
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return [];
        try {
            var snap = await db.ref(bandPath('practice_tasks')).once('value');
            var all = snap.val() || {};
            return Object.keys(all)
                .map(function(k) { return all[k]; })
                .filter(function(t) {
                    if (!t) return false;
                    var matches = (t.songId && t.songId === songId) || (t.songTitle && t.songTitle === songId);
                    var open = !t.status || t.status === 'open' || t.status === 'in-progress';
                    return matches && open;
                })
                .sort(function(a, b) { return (b.createdAt || 0) > (a.createdAt || 0) ? 1 : -1; });
        } catch (e) {
            console.warn('[wb] tasks load failed:', e);
            return [];
        }
    }

    async function _wbLoadNotes(songId) {
        if (!window.GLNotes || typeof GLNotes.read !== 'function') return [];
        try {
            var notes = await GLNotes.read(songId);
            return Array.isArray(notes) ? notes : [];
        } catch (e) {
            console.warn('[wb] notes load failed:', e);
            return [];
        }
    }

    // ── Mode switching ──────────────────────────────────────────────────────
    window._wbSetMode = function(mode) {
        // MVP: only Practice is implemented. Disabled tabs are inert via the
        // `disabled` attribute, but guard here too in case a caller bypasses.
        if (mode !== 'practice') return;
        if (!window._wbState) return;
        window._wbState.mode = mode;
        _wbRender(window._wbState.songId, mode, window._wbState.opts || {});
    };

    // ── Auto-launch float player on Practice mode entry ────────────────────
    // Looks up the song's saved versions, picks the North Star (or the
    // most-recently-added reference), extracts a YouTube id, and launches
    // GLPlayerUI.showFloat() with a Medium/bottom-right default. If the
    // launch was driven by a PracticeTask with timestampSec, applies a
    // ±15s loop window via GLPlayerUI.setLoopWindow once the player is
    // loaded — the user can hit play and immediately practice the section
    // the rehearsal flagged. Falls back silently if no reference exists.
    async function _wbAutoLaunchPlayer(songId, opts) {
        if (!window.GLPlayerEngine || !window.GLPlayerUI) return;
        // Helper: when this song has no playable reference, the old song's
        // audio MUST stop. Otherwise the player keeps playing the prior
        // song (Sugaree) while Workbench shows the new one (Tall Boy) — a
        // confusing stale state Drew hit in Run-the-Gig on 2026-05-10.
        var stopStale = function(reason) {
            try { if (window.GLPlayerEngine.stop) window.GLPlayerEngine.stop(); } catch (e) {}
            if (typeof showToast === 'function') {
                showToast('No audio reference for "' + songId + '" — add a YouTube version in Listen lens.');
            }
            console.log('[wb] auto-launch skipped:', songId, reason);
        };
        try {
            var url = await _wbResolvePrimaryUrl(songId);
            if (!url) { stopStale('no reference URL'); return; }
            var ytId = _wbExtractYouTubeId(url);
            if (!ytId) { stopStale('non-YouTube reference (' + url.slice(0, 40) + '…)'); return; }
            var queue = [{ title: songId, youtubeId: ytId }];
            window.GLPlayerEngine.loadQueue(queue, { name: songId });
            window.GLPlayerUI.showFloat({ size: 'medium', dock: 'bottom-right' });
            window.GLPlayerEngine.play(0);
            // PracticeTask auto-loop: ±15s around timestampSec. We rely on
            // the engine reaching a "playable" state before we can read
            // currentTime / call setLoopWindow. Poll briefly.
            var task = window._wbActiveTask;
            var ts = (task && typeof task.timestampSec === 'number') ? task.timestampSec : null;
            if (ts != null) {
                var inSec = Math.max(0, ts - 15);
                var outSec = ts + 15;
                var attempts = 0;
                var poll = setInterval(function() {
                    attempts++;
                    var ready = window._ytPlayer && typeof window._ytPlayer.seekTo === 'function';
                    if (ready) {
                        clearInterval(poll);
                        try {
                            window._ytPlayer.seekTo(ts, true);
                            // Spec: "start paused" — call pauseVideo right
                            // after seek so the user has a moment to read
                            // the chart before hitting play.
                            if (typeof window._ytPlayer.pauseVideo === 'function') {
                                window._ytPlayer.pauseVideo();
                            }
                        } catch (e) {}
                        try { window.GLPlayerUI.setLoopWindow(inSec, outSec); } catch (e) {}
                    } else if (attempts > 50) {
                        clearInterval(poll);
                    }
                }, 200);
            }
        } catch (e) {
            console.warn('[wb] auto-launch player failed:', e);
        }
    }

    function _wbExtractYouTubeId(url) {
        if (!url) return null;
        var m;
        m = url.match(/youtu\.be\/([\w-]{11})/); if (m) return m[1];
        m = url.match(/[?&]v=([\w-]{11})/);       if (m) return m[1];
        m = url.match(/youtube\.com\/embed\/([\w-]{11})/);  if (m) return m[1];
        m = url.match(/youtube\.com\/shorts\/([\w-]{11})/); if (m) return m[1];
        return null;
    }

    async function _wbResolvePrimaryUrl(songId) {
        // North Star (explicit isNorthStar) wins; otherwise highest
        // vote-count YouTube reference; otherwise first version with a URL.
        try {
            if (typeof loadRefVersions !== 'function') return null;
            var versions = await loadRefVersions(songId) || [];
            if (!versions.length) return null;
            var ns = versions.find(function(v) { return v && v.isNorthStar === true; });
            if (ns && ns.url) return ns.url;
            // Sort by votes desc; pick the first YouTube (player engine
            // can play YT directly).
            var sorted = versions.slice().sort(function(a, b) {
                var va = a.votes ? Object.keys(a.votes).filter(function(k){return a.votes[k];}).length : 0;
                var vb = b.votes ? Object.keys(b.votes).filter(function(k){return b.votes[k];}).length : 0;
                return vb - va;
            });
            for (var i = 0; i < sorted.length; i++) {
                var url = sorted[i].url || sorted[i].spotifyUrl || '';
                if (url && /youtu/.test(url)) return url;
            }
            // No YouTube — return whatever we have first (Spotify will be
            // handled by switchToSource fallback).
            return sorted[0].url || sorted[0].spotifyUrl || null;
        } catch (e) { return null; }
    }

    // Subtle hint: "Need chords? View Chart" — surfaces below the player
    // for users who think "I want the chart" without scanning lens tabs.
    // Idempotent: removed if already present, then re-added fresh so
    // it stays in sync with Workbench mode/state changes.
    function _wbInjectChartHint() {
        var body = document.getElementById('wb-body');
        if (!body) return;
        var existing = document.getElementById('wb-lens-switcher');
        if (existing) existing.remove();
        // Bi-directional lens switcher — replaces the old one-way "View
        // Chart" hint. Active lens is highlighted. Switching back to Stems
        // (or any other) is one click; no stranded state.
        var sw = document.createElement('div');
        sw.id = 'wb-lens-switcher';
        sw.className = 'wb-lens-switcher';
        // Labels are intent-based, not feature-named (Drew 2026-05-10):
        //   Play   = play along with stems + player (lens id: stems)
        //   Chart  = chords + lyrics (lens id: band)
        //   Harmony = vocals (lens id: sing)
        //   Listen = references / versions (lens id: listen)
        var lenses = [
            { id: 'stems',   label: '🎸 Play' },
            { id: 'band',    label: '📋 Chart' },
            { id: 'sing',    label: '🎤 Harmony' },
            { id: 'listen',  label: '🎧 Listen' }
        ];
        sw.innerHTML = lenses.map(function(l) {
            return '<button class="wb-lens-btn" data-lens="' + l.id + '" onclick="window._wbJumpLens(\'' + l.id + '\');window._wbUpdateLensSwitcherActive(\'' + l.id + '\')">' + l.label + '</button>';
        }).join('');
        body.appendChild(sw);
        // Default highlight = stems (Workbench auto-defaults to stems lens)
        window._wbUpdateLensSwitcherActive('stems');
    }

    // ── Public wrappers (Drew 2026-05-10 deprecation directive) ────────────
    // The user-facing API is the openWorkbench* family. rehearsal-mode is
    // hidden fallback only — never a primary entry point.
    //
    //   openWorkbenchChartEditor(song)    — chart editor overlay
    //   openWorkbenchRunQueue(queue)       — run a multi-song queue
    //   openWorkbenchRecording(session)    — TODO when recording playback
    //                                         needs a Workbench-native UI
    //
    // These names are stable; internal implementations may change.

    // Run a multi-song queue inside Workbench. For MVP we open the first
    // song in Practice mode and leave queue management to the calling
    // surface (e.g. rehearsal.js Live Mode already maintains its own
    // timeline and song-list UI; clicking a song just routes to Workbench).
    // Future: integrate with the _gigRunState contextual strip if a queue
    // explicitly wants auto-advance / per-song budget semantics.
    window.openWorkbenchRunQueue = function(queue, opts) {
        opts = opts || {};
        if (!Array.isArray(queue) || !queue.length) return;
        var first = queue[0];
        var title = (typeof first === 'string') ? first : (first && (first.title || first.songTitle));
        if (!title) return;
        if (typeof window.openWorkbench === 'function') {
            window.openWorkbench(title, opts.mode || 'practice', opts);
        }
    };

    // ── Workbench-native Chart Editor overlay ───────────────────────────────
    // Drew 2026-05-10: Edit Chart must stay inside Workbench. Full-screen
    // modal that reuses the same data shape as the legacy editor
    // (loadBandDataFromDrive/saveBandDataToDrive on the 'chart' path) so
    // saves are read-compatible with rehearsal-mode and any other consumer.
    window._wbOpenChartEditor = async function(songId) {
        songId = songId || (window._wbState && window._wbState.songId);
        if (!songId) return;
        // Remove any existing instance (defensive)
        var existing = document.getElementById('wbChartEditor');
        if (existing) existing.remove();

        var overlay = document.createElement('div');
        overlay.id = 'wbChartEditor';
        overlay.className = 'wb-chart-editor';
        overlay.dataset.song = songId;
        overlay.innerHTML = ''+
            '<div class="wb-chart-editor-toolbar">' +
                '<div class="wb-chart-editor-titleblock">' +
                    '<div class="wb-chart-editor-eyebrow">EDIT CHART</div>' +
                    '<div class="wb-chart-editor-title">' + _wbEsc(songId) + '</div>' +
                '</div>' +
                '<div class="wb-chart-editor-actions">' +
                    '<button class="wb-fs-btn wb-chart-editor-cancel" onclick="window._wbCloseChartEditor(false)" title="Discard changes (Esc)">Cancel</button>' +
                    '<button class="wb-fs-btn wb-chart-editor-save" onclick="window._wbSaveChartEditor()" title="Save and return">💾 Save</button>' +
                    '<button class="wb-fs-btn wb-fs-exit" onclick="window._wbCloseChartEditor(false)" title="Close (Esc)">✕</button>' +
                '</div>' +
            '</div>' +
            '<div class="wb-chart-editor-hint">Chord chart, structure, lyrics — anything you need on the floor. Use [Verse] / [Chorus] / [Bridge] markers to auto-derive song structure.</div>' +
            '<div class="wb-chart-editor-body">' +
                '<textarea id="wbChartEditorText" class="wb-chart-editor-textarea" placeholder="G  C  D  G\n\n[Verse]\nA  E  D\nLyrics here..." spellcheck="false"></textarea>' +
            '</div>';
        document.body.appendChild(overlay);

        // Load existing chart text into the textarea
        var textarea = document.getElementById('wbChartEditorText');
        if (textarea && typeof loadBandDataFromDrive === 'function') {
            try {
                var d = await loadBandDataFromDrive(songId, 'chart');
                if (d && d.text) textarea.value = d.text;
            } catch (e) { console.warn('[wb] chart load failed:', e); }
        }
        if (textarea) {
            textarea.focus();
            // Place cursor at end for new edits
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    };

    window._wbSaveChartEditor = async function() {
        var overlay = document.getElementById('wbChartEditor');
        var textarea = document.getElementById('wbChartEditorText');
        if (!overlay || !textarea) return;
        var songId = overlay.dataset.song;
        if (!songId) return;
        var text = textarea.value.trim();
        try {
            // Same save contract as rmSaveChart — keeps legacy reads working.
            if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
                await GLStore.saveSongData(songId, 'chart', text ? { text: text } : null);
            } else if (typeof saveBandDataToDrive === 'function') {
                await saveBandDataToDrive(songId, 'chart', text ? { text: text } : null);
            }
            if (typeof showToast === 'function') showToast('✅ Chart saved');
            window._wbCloseChartEditor(true);
        } catch (e) {
            console.warn('[wb] chart save failed:', e);
            if (typeof showToast === 'function') showToast('Save failed: ' + (e.message || e));
        }
    };

    // Public alias — preferred name per deprecation spec
    window.openWorkbenchChartEditor = window._wbOpenChartEditor;

    window._wbCloseChartEditor = function(saved) {
        var overlay = document.getElementById('wbChartEditor');
        if (!overlay) return;
        var songId = overlay.dataset.song;
        overlay.remove();
        if (saved && songId) {
            // Refresh the band-lens panel so the saved text shows up.
            // sdShowChart re-renders the lens via loadBandDataFromDrive.
            if (typeof window.sdShowChart === 'function') {
                try { window.sdShowChart(songId); } catch (e) {}
            }
            // If the chart fullscreen overlay is open on the same song,
            // refresh its body too so the user sees the new text.
            var fsBody = document.getElementById('wbChartFsBody');
            if (fsBody && window._wbChartFs) {
                // Re-trigger the fullscreen overlay so it reloads chart text
                if (typeof window._wbToggleChartMax === 'function') {
                    var open = document.getElementById('wbChartFs');
                    if (open) {
                        window._wbToggleChartMax(); // close
                        setTimeout(function() { window._wbToggleChartMax(); }, 50); // reopen
                    }
                }
            }
        }
    };

    // Esc handler for the chart editor (separate from chart-fullscreen)
    document.addEventListener('keydown', function(e) {
        var overlay = document.getElementById('wbChartEditor');
        if (!overlay) return;
        if (e.key === 'Escape') {
            window._wbCloseChartEditor(false);
            e.preventDefault();
        }
    });

    window._wbUpdateLensSwitcherActive = function(activeLens) {
        var sw = document.getElementById('wb-lens-switcher');
        if (!sw) return;
        Array.prototype.forEach.call(sw.querySelectorAll('[data-lens]'), function(btn) {
            if (btn.getAttribute('data-lens') === activeLens) btn.classList.add('is-active');
            else btn.classList.remove('is-active');
        });
    };

    // "More views" — switch the embedded song-detail to a different lens.
    // Defaults are hidden (Practice mode auto-loads Stems); this lets a
    // user pop into Chart / Versions / Harmony / Inspire without leaving
    // Workbench. Lens id maps directly to song-detail's switchLens.
    window._wbToggleMoreViews = function(btn) {
        var menu = btn && btn.parentElement && btn.parentElement.querySelector('.wb-more-views-menu');
        if (!menu) return;
        menu.hidden = !menu.hidden;
    };
    window._wbJumpLens = function(lensId) {
        if (typeof window.switchLens === 'function') {
            try { window.switchLens(lensId); } catch (e) {}
        }
        // Close the dropdown after selection
        document.querySelectorAll('.wb-more-views-menu').forEach(function(m) { m.hidden = true; });
    };

    window._wbClose = function() {
        // Clear active task so subsequent surfaces don't pick up stale state.
        window._wbActiveTask = null;
        // Exit chart fullscreen if open so the next song doesn't inherit it.
        var fs = document.getElementById('wbChartFs');
        if (fs) _wbExitChartFs();
        // If a Run-the-Gig is active, ✕ Close ends it cleanly (matches the
        // user's expectation that closing the surface ends the run too).
        if (window._gigRunState && typeof window._gigRunKill === 'function') {
            window._gigRunKill();
        }
        // Return to Practice Command Center — that's where the user came
        // from in the new flow. (Old behavior was 'songs', kept available
        // by clicking Songs in the left rail.)
        if (typeof showPage === 'function') showPage('practice');
    };

    // ── Styles (scoped to .wb-* classes; injected once) ────────────────────
    function _wbInjectStyles() {
        if (document.getElementById('wb-styles')) return;
        var s = document.createElement('style');
        s.id = 'wb-styles';
        s.textContent = [
            '#page-workbench { padding: 0; }',
            '.wb-root { display: flex; flex-direction: column; min-height: calc(100vh - 60px); }',
            // Sticky-top so the Workbench mode tabs stay visible while the
            // song-detail body scrolls. Without this, scrolling into the
            // body makes the song-detail lens tabs (PRACTICE/PLAY/VERSIONS
            // /HARMONY/STEMS) appear as the new top-bar, which reads like
            // a duplicate menu.
            '.wb-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 50; background: var(--bg-primary, #0f172a); }',
            '.wb-song-title { font-size: 1.15em; font-weight: 700; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
            '.wb-close { background: none; border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 4px 12px; border-radius: 6px; font-size: 0.95em; }',
            '.wb-close:hover { color: var(--text); border-color: rgba(255,255,255,0.3); }',
            // Mode tabs stick directly under the header. 56px is the header
            // height (14px*2 padding + ~28px content). Adjust if header
            // padding changes.
            '.wb-mode-tabs { display: flex; gap: 2px; padding: 0 12px; border-bottom: 1px solid var(--border); background: var(--bg-primary, #0f172a); position: sticky; top: 56px; z-index: 49; }',
            '.wb-mode-tab { background: none; border: 0; padding: 11px 18px; color: var(--text-dim); cursor: pointer; border-bottom: 2px solid transparent; font-size: 0.92em; font-weight: 600; transition: color 0.15s, border-color 0.15s; }',
            '.wb-mode-tab:hover:not(.disabled) { color: var(--text); }',
            '.wb-mode-tab.active { color: var(--text); border-bottom-color: #818cf8; }',
            '.wb-mode-tab.disabled { opacity: 0.35; cursor: not-allowed; }',
            '.wb-layout { display: grid; grid-template-columns: 1fr 320px; gap: 16px; padding: 16px; flex: 1; align-items: start; }',
            '@media (max-width: 900px) { .wb-layout { grid-template-columns: 1fr; } .wb-rail { order: -1; } }',
            '.wb-body { min-width: 0; position: relative; }',
            // Chart maximize button — anchored top-right of the body. When
            // chart-max state is on, switches to fixed position so it stays
            // reachable as the surrounding chrome hides.
            '.wb-chart-max-btn { position: absolute; top: 4px; right: 8px; z-index: 30; background: rgba(15,23,42,0.85); border: 1px solid rgba(255,255,255,0.12); color: #cbd5e1; cursor: pointer; padding: 4px 9px; border-radius: 6px; font-size: 0.85em; font-family: inherit; line-height: 1; }',
            '.wb-chart-max-btn:hover { color: var(--text); border-color: rgba(255,255,255,0.3); background: rgba(15,23,42,0.95); }',
            // True chart fullscreen: a top-level overlay independent of
            // song-detail's max-width constraints. Z-index just below the
            // floating player (9800) so playback controls stay visible if
            // the user wants them.
            '.wb-chart-fs { position: fixed; inset: 0; z-index: 9700; background: var(--bg-primary, #0f172a); display: flex; flex-direction: column; }',
            '.wb-chart-fs-toolbar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: rgba(15,23,42,0.97); border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }',
            '.wb-chart-fs-song { flex: 1; min-width: 0; }',
            '.wb-chart-fs-title { font-size: 1.05em; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
            '.wb-chart-fs-meta { font-size: 0.78em; color: var(--text-dim); margin-top: 2px; }',
            '.wb-chart-fs-controls { display: flex; align-items: center; gap: 4px; flex-shrink: 0; flex-wrap: wrap; }',
            '.wb-fs-btn { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10); color: var(--text); cursor: pointer; padding: 6px 10px; border-radius: 6px; font-size: 0.85em; font-weight: 700; font-family: inherit; min-width: 32px; }',
            '.wb-fs-btn:hover { background: rgba(255,255,255,0.10); border-color: rgba(255,255,255,0.20); }',
            '.wb-fs-btn.wb-fs-active { background: rgba(99,102,241,0.20); color: #a5b4fc; border-color: rgba(99,102,241,0.40); }',
            '.wb-fs-btn.wb-fs-exit { background: rgba(239,68,68,0.10); color: #fca5a5; border-color: rgba(239,68,68,0.25); }',
            '.wb-fs-btn.wb-fs-exit:hover { background: rgba(239,68,68,0.20); }',
            '.wb-fs-val { font-size: 0.78em; color: var(--text-dim); padding: 0 6px; font-variant-numeric: tabular-nums; min-width: 22px; text-align: center; }',
            '.wb-fs-sep { width: 1px; height: 22px; background: rgba(255,255,255,0.10); margin: 0 4px; }',
            '.wb-fs-hidden { display: none !important; }',
            '.wb-chart-fs-body { flex: 1; overflow-y: auto; padding: 24px 32px 60px; -webkit-overflow-scrolling: touch; }',
            '.wb-chart-fs-text { white-space: pre-wrap; font-family: "Courier New", monospace; line-height: 1.7; color: #e2e8f0; margin: 0; letter-spacing: 0.01em; max-width: 100%; }',
            '.wb-chart-fs-empty { text-align: center; padding: 60px 24px; color: var(--text); }',
            '@media (max-width: 640px) { .wb-chart-fs-toolbar { flex-direction: column; align-items: stretch; gap: 8px; } .wb-chart-fs-controls { justify-content: center; } }',
            '.wb-rail { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 12px; }',
            '@media (max-width: 900px) { .wb-rail { position: static; } }',
            '.wb-rail-card { padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: rgba(255,255,255,0.02); }',
            '.wb-rail-header { font-size: 0.74em; font-weight: 700; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.06em; }',
            '.wb-task { padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; }',
            '.wb-task:last-child { margin-bottom: 0; }',
            '.wb-task.active { border-color: rgba(102,126,234,0.45); background: rgba(102,126,234,0.07); }',
            '.wb-task-text { font-size: 0.85em; color: var(--text); line-height: 1.35; }',
            '.wb-task-meta { font-size: 0.7em; color: var(--text-dim); margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }',
            '.wb-task-ts { font-variant-numeric: tabular-nums; font-weight: 600; }',
            '.wb-task-badge { background: rgba(245,158,11,0.18); color: #fbbf24; padding: 2px 7px; border-radius: 8px; font-size: 0.92em; font-weight: 700; margin-left: auto; }',
            '.wb-note { padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.82em; }',
            '.wb-note:last-child { border: 0; padding-bottom: 0; }',
            '.wb-note-scope { font-size: 0.66em; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1px; }',
            '.wb-note-text { color: var(--text); line-height: 1.4; }',
            '.wb-empty { font-size: 0.82em; color: var(--text-dim); font-style: italic; padding: 4px 0; }',
            // Bi-directional lens switcher — pinned to the bottom of wb-body
            // so it stays reachable from any lens. Sticky-bottom inside the
            // scrollable body so it doesn\'t scroll away.
            '.wb-lens-switcher { position: sticky; bottom: 0; display: flex; gap: 4px; margin-top: 14px; padding: 8px; background: rgba(15,23,42,0.95); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); justify-content: center; flex-wrap: wrap; }',
            '.wb-lens-btn { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: var(--text-dim); cursor: pointer; padding: 7px 14px; border-radius: 7px; font-size: 0.84em; font-weight: 600; font-family: inherit; transition: background 0.12s, color 0.12s, border-color 0.12s; }',
            '.wb-lens-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); border-color: rgba(255,255,255,0.18); }',
            '.wb-lens-btn.is-active { background: rgba(99,102,241,0.18); color: #a5b4fc; border-color: rgba(99,102,241,0.4); }',
            // ── Chart Editor overlay (Workbench-native) ────────────────────
            '.wb-chart-editor { position: fixed; inset: 0; z-index: 9710; background: var(--bg-primary, #0f172a); display: flex; flex-direction: column; }',
            '.wb-chart-editor-toolbar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: rgba(15,23,42,0.97); border-bottom: 1px solid rgba(255,255,255,0.08); flex-shrink: 0; }',
            '.wb-chart-editor-titleblock { flex: 1; min-width: 0; }',
            '.wb-chart-editor-eyebrow { font-size: 0.68em; font-weight: 800; letter-spacing: 0.08em; color: #a5b4fc; }',
            '.wb-chart-editor-title { font-size: 1.05em; font-weight: 800; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }',
            '.wb-chart-editor-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }',
            '.wb-chart-editor-save { background: linear-gradient(135deg,#22c55e,#16a34a) !important; color: #fff !important; border-color: rgba(34,197,94,0.5) !important; font-weight: 800 !important; }',
            '.wb-chart-editor-save:hover { box-shadow: 0 2px 12px rgba(34,197,94,0.35); }',
            '.wb-chart-editor-hint { padding: 8px 16px; font-size: 0.78em; color: var(--text-dim); background: rgba(255,255,255,0.015); border-bottom: 1px solid rgba(255,255,255,0.04); }',
            '.wb-chart-editor-body { flex: 1; display: flex; min-height: 0; padding: 14px 16px 16px; }',
            '.wb-chart-editor-textarea { flex: 1; width: 100%; resize: none; background: rgba(0,0,0,0.30); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; color: #e2e8f0; padding: 16px; font-family: "Courier New", monospace; font-size: 14px; line-height: 1.7; letter-spacing: 0.01em; outline: none; }',
            '.wb-chart-editor-textarea:focus { border-color: rgba(99,102,241,0.4); }',
            '@media (max-width: 640px) { .wb-chart-editor-toolbar { flex-direction: column; align-items: stretch; } .wb-chart-editor-actions { justify-content: flex-end; } }',
            // Action bar — sticky bottom completion controls. Only shown
            // when a PracticeTask is active (revealed via `hidden` toggle).
            '.wb-action-bar { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 12px 16px; background: var(--bg-primary, #0f172a); border-top: 1px solid rgba(255,255,255,0.08); z-index: 48; box-shadow: 0 -8px 24px rgba(0,0,0,0.35); }',
            '.wb-action-bar[hidden] { display: none; }',
            '.wb-action { flex: 1; padding: 11px 16px; border: 0; border-radius: 10px; cursor: pointer; font-family: inherit; font-weight: 700; font-size: 0.92em; transition: transform 0.08s, box-shadow 0.15s; }',
            '.wb-action:active { transform: scale(0.98); }',
            '.wb-action-improved { background: linear-gradient(135deg, #22c55e, #16a34a); color: #fff; box-shadow: 0 4px 14px rgba(34,197,94,0.32); }',
            '.wb-action-improved:hover { box-shadow: 0 6px 20px rgba(34,197,94,0.45); }',
            '.wb-action-next { background: rgba(102,126,234,0.18); color: #a5b4fc; border: 1px solid rgba(102,126,234,0.35); flex: 0 0 auto; padding-left: 22px; padding-right: 22px; }',
            '.wb-action-next:hover { background: rgba(102,126,234,0.28); }',
            // Hide the song-detail lens tab strip when mounted inside
            // Workbench. The Workbench mode tabs (Practice/Rehearsal/Gig/
            // Review) are the outer nav; an inner duplicate-tab strip
            // confused testers. "More views" pill in the header gives
            // power users a way to swap lenses if they need to.
            '.wb-mounted-detail .sd-tab-bar { display: none !important; }',
            // More views dropdown
            '.wb-more-views { position: relative; }',
            '.wb-more-views-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; padding: 4px 12px; border-radius: 6px; font-size: 0.82em; font-family: inherit; font-weight: 600; }',
            '.wb-more-views-btn:hover { color: var(--text); border-color: rgba(255,255,255,0.25); }',
            '.wb-more-views-menu { position: absolute; right: 0; top: calc(100% + 6px); background: #1e293b; border: 1px solid var(--border); border-radius: 8px; padding: 4px 0; min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,0.45); z-index: 60; }',
            '.wb-more-views-menu button { display: block; width: 100%; text-align: left; padding: 8px 14px; background: none; border: 0; color: var(--text); cursor: pointer; font-family: inherit; font-size: 0.86em; }',
            '.wb-more-views-menu button:hover { background: rgba(102,126,234,0.12); color: #a5b4fc; }'
        ].join('\n');
        document.head.appendChild(s);
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function _wbEsc(s) {
        if (s == null) return '';
        return String(s).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function _wbFmtTime(sec) {
        sec = Math.max(0, Math.floor(sec || 0));
        var m = Math.floor(sec / 60);
        var s = sec % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    // ── Page renderer registration ──────────────────────────────────────────
    if (typeof window.pageRenderers === 'object' && window.pageRenderers) {
        window.pageRenderers['workbench'] = function() {
            var st = window._wbState || null;
            if (!st || !st.songId) {
                if (typeof showPage === 'function') showPage('songs');
                return;
            }
            _wbRender(st.songId, st.mode || 'practice', st.opts || {});
        };
    }
})();
