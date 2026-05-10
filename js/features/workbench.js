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
                '<main class="wb-body" id="wb-body"></main>' +
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
        var who = task.memberKey ? (' · ' + _wbEsc(task.memberKey)) : '';
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
            if (typeof showToast === 'function') showToast('✓ Marked as improved');
        } catch (e) {
            console.warn('[wb] mark improved failed:', e);
            if (typeof showToast === 'function') showToast('Failed to mark: ' + (e.message || e));
            return;
        }
        await _wbAdvanceToNextTask();
    };

    window._wbAdvanceToNext = async function() {
        await _wbAdvanceToNextTask();
    };

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
            '.wb-body { min-width: 0; }',
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
            // Action bar — sticky bottom completion controls. Only shown
            // when a PracticeTask is active (revealed via `hidden` toggle).
            '.wb-action-bar { position: sticky; bottom: 0; display: flex; gap: 10px; padding: 12px 16px; background: var(--bg-primary, #0f172a); border-top: 1px solid rgba(255,255,255,0.08); z-index: 48; box-shadow: 0 -8px 24px rgba(0,0,0,0.35); }',
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
