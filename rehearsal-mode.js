// ============================================================================
// PRACTICE MODE — GrooveLinx
// 5-Tab Full-Screen Overlay: Chart · Know · Memory · Harmony · Record
//
// Entry points:
//   openRehearsalMode(songTitle)           — single song (from song detail)
//   openRehearsalModeFromPlan(dateStr)     — loads full practice-plan queue
//   pmOpenPracticeMode(songTitle)          — alias (from PM v2 button)
//
// Depends on: loadBandDataFromDrive, saveBandDataToDrive, showToast,
//             toArray, allSongs (global), practicePlanActiveDate (global),
//             FADR_PROXY, importHarmoniesFromFadr, openMultiTrackStudio,
//             HARMONY_SINGER_COLORS, loadHarmonyAudioSnippets,
//             loadABCNotation, getCurrentMemberKey
// ============================================================================

console.log('%c🔗 GrooveLinx BUILD: 20260329-040611', 'color:#667eea;font-weight:bold;font-size:14px');
// Build version logged once by app.js from <meta> tag
// ── State ───────────────────────────────────────────────────────────────────
let rmQueue   = [];
let rmIndex   = 0;
let rmEditing = false;
let rmCurrentTab = 'chart';
let rmFontSize = 16;
var pmSelectedAudioUrl = '';
var pmPalaceSceneIndex = 0;
var pmPalaceScenes = [];
var pmPalaceAutoTimer = null;
var _rmCache = {};        // In-memory cache: { title: { chart, meta, ts } }
var _rmNavLock = 0;       // Throttle timestamp for rmNavigate
// ── Session timing ──
var _rmSessionStart = 0;       // session start timestamp
var _rmBlockStartTime = 0;     // current block start timestamp
var _rmBlockTimings = [];       // [{ title, budgetMin, actualMs, index }]
var _rmTimingInterval = null;   // live timer update interval
// Resolve band abbreviation to full name for external searches
function _rmFullBandName(abbr) {
    var map = { GD:'Grateful Dead', JGB:'Jerry Garcia Band', WSP:'Widespread Panic', Phish:'Phish', ABB:'Allman Brothers Band', Goose:'Goose', DMB:'Dave Matthews Band' };
    return map[abbr] || abbr || '';
}
var _rmSections = [];     // Current song's normalized sections from song_structure
var _rmActiveSectionIdx = 0; // Index into _rmSections for active section
var _rmScrollSyncEnabled = false; // True when chart has anchored sections

// Archive.org optimized search query per band
function rmArchiveQuery(title, bandCode) {
    const collections = {
        'GD': 'GratefulDead', 'Grateful Dead': 'GratefulDead',
        'JGB': 'JerryGarciaBand', 'Jerry Garcia Band': 'JerryGarciaBand',
        'Phish': 'Phish',
        'WSP': 'WidespreadPanic', 'Widespread Panic': 'WidespreadPanic',
        'ABB': 'AllmanBrothersBand', 'Allman Brothers': 'AllmanBrothersBand',
        'DMB': 'DaveMatthewsBand', 'Dave Matthews Band': 'DaveMatthewsBand',
        'SCI': 'StringCheeseIncident', 'String Cheese Incident': 'StringCheeseIncident',
        'moe.': 'moeperiod',
        'Umphrey\'s McGee': 'UmphreysMcGee',
        'Tedeschi Trucks': 'TedeschiTrucksBand',
        'Goose': 'GooseBand',
    };
    const col = collections[bandCode] || '';
    // Clean song title - remove parenthetical notes
    const clean = title.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    if (col) {
        // Use description: to search setlists, not title: (which is show name)
        // Handle Phish collection split (pre-2017 vs post-2017)
        if (col === 'Phish') return '(collection:Phish OR creator:"Phish") AND description:"' + clean + '"';
        if (col === 'DaveMatthewsBand') return 'creator:"Dave Matthews Band" AND description:"' + clean + '"';
        return 'collection:' + col + ' AND description:"' + clean + '"';
    }
    return clean + ' AND format:MP3 AND mediatype:audio';
}


// ── Entry: single song ───────────────────────────────────────────────────────
function openRehearsalMode(songTitle, mode) {
    const songData = (typeof allSongs !== 'undefined' ? allSongs : [])
        .find(s => s.title === songTitle);
    rmQueue = [{ title: songTitle, band: songData?.band || '' }];
    rmIndex = 0;
    rmShow();
    if (mode === 'paste') { setTimeout(function(){ if (typeof rmStartEdit === 'function') rmStartEdit(); }, 400); }
}

// Entry: from rehearsal planner — full queue with block metadata
window.openRehearsalModeWithQueue = function(queue) {
    if (!queue || !queue.length) return;
    rmQueue = queue;
    rmIndex = 0;
    // Onboarding: mark rehearsal started
    if (typeof GLAvatarGuide !== 'undefined' && GLAvatarGuide.completeOnboardStep) GLAvatarGuide.completeOnboardStep('rehearsal');
    // Init session timing
    _rmSessionStart = Date.now();
    _rmBlockStartTime = Date.now();
    _rmBlockTimings = [];
    // Persist planner queue so it survives refresh
    try { localStorage.setItem('glPlannerQueue', JSON.stringify(queue)); } catch(e) {}
    if (window._rpBlockGuidance) {
        try { localStorage.setItem('glPlannerGuidance', JSON.stringify(window._rpBlockGuidance)); } catch(e) {}
    }
    // Check for chart notes from last rehearsal — nudge before starting
    _rmCheckChartNotes(queue);
    rmShow();
};

// Nudge: show chart notes banner before rehearsal starts (unmissable)
async function _rmCheckChartNotes(queue) {
    if (typeof ChartSystem === 'undefined' || !ChartSystem.loadOverlayNotes) return;
    var totalNotes = 0;
    var songsWithNotes = [];
    for (var i = 0; i < Math.min(queue.length, 5); i++) {
        var title = queue[i].title || queue[i];
        if (!title) continue;
        try {
            var notes = await ChartSystem.loadOverlayNotes(title);
            if (notes.length > 0) { totalNotes += notes.length; songsWithNotes.push(title); }
        } catch(e) {}
    }
    if (totalNotes > 0) {
        // Show unmissable banner at top of rehearsal mode (not just a toast)
        setTimeout(function() {
            var banner = document.createElement('div');
            banner.id = 'rmChartNotesBanner';
            banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:10003;background:linear-gradient(135deg,rgba(245,158,11,0.95),rgba(217,119,6,0.95));color:white;padding:12px 16px;display:flex;align-items:center;gap:10px;font-size:0.85em;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,0.3)';
            banner.innerHTML = '<span style="font-size:1.2em">\uD83D\uDCCC</span>'
                + '<span style="flex:1">' + totalNotes + ' note' + (totalNotes > 1 ? 's' : '') + ' from last rehearsal on ' + songsWithNotes.slice(0, 2).join(', ') + (songsWithNotes.length > 2 ? ' +' + (songsWithNotes.length - 2) + ' more' : '') + '</span>'
                + '<button onclick="document.getElementById(\'rmChartNotesBanner\').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:4px 10px;border-radius:6px;cursor:pointer;font-weight:700;font-size:0.85em">Got it</button>';
            document.body.appendChild(banner);
            // Auto-dismiss after 8 seconds
            setTimeout(function() { var b = document.getElementById('rmChartNotesBanner'); if (b) b.remove(); }, 8000);
        }, 1000);
    }
}

// Alias for PM v2 button
function pmOpenPracticeMode(songTitle) { openRehearsalMode(songTitle); }

// ── Entry: from practice plan ────────────────────────────────────────────────
async function openRehearsalModeFromPlan(dateStr, startIndex) {
    const date = dateStr || (typeof practicePlanActiveDate !== 'undefined' ? practicePlanActiveDate : null);
    if (!date) { showToast('⚠️ No rehearsal plan selected'); return; }
    showToast('Loading rehearsal queue…', 1200);
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${date}`) || {};
    const planSongs = toArray(plan.songs || []);
    if (planSongs.length === 0) { showToast('⚠️ No songs in this rehearsal plan yet'); return; }
    rmQueue = planSongs.map(s => ({ title: s.title, band: s.band || '' }));
    rmIndex = (typeof startIndex === 'number' && startIndex >= 0 && startIndex < rmQueue.length) ? startIndex : 0;
    rmShow();
}

// ── Entry: Chart Queue — bulk chart entry for songs missing charts ────────────
var _rmChartQueueMode = false;
var _rmChartQueueTotal = 0;
var _rmChartQueueDone = 0;

window.openChartQueue = async function() {
    if (typeof showToast === 'function') showToast('Scanning for missing charts...', 1500);
    var activeSongs = (typeof allSongs !== 'undefined' ? allSongs : []).filter(function(s) {
        return typeof isSongActive === 'function' && isSongActive(s.title);
    });
    // Check which active songs have no chart in Firebase
    var missing = [];
    var batchSize = 15;
    for (var b = 0; b < activeSongs.length; b += batchSize) {
        var checks = [];
        for (var i = b; i < Math.min(b + batchSize, activeSongs.length); i++) {
            checks.push((function(song) {
                return loadBandDataFromDrive(song.title, 'chart').then(function(data) {
                    if (!data || !data.text || !data.text.trim()) missing.push({ title: song.title, band: song.band || '' });
                }).catch(function() {
                    missing.push({ title: song.title, band: song.band || '' });
                });
            })(activeSongs[i]));
        }
        await Promise.all(checks);
    }
    if (missing.length === 0) {
        if (typeof showToast === 'function') showToast('All active songs have charts!');
        return;
    }
    // Sort alphabetically for predictable order
    missing.sort(function(a, b) { return a.title.localeCompare(b.title); });
    _rmChartQueueMode = true;
    _rmChartQueueTotal = missing.length;
    _rmChartQueueDone = 0;
    rmQueue = missing;
    rmIndex = 0;
    rmShow();
    // Auto-open UG + paste mode after overlay renders
    setTimeout(function() { _rmChartQueueLoadCurrent(); }, 400);
};

function _rmChartQueueLoadCurrent() {
    if (!_rmChartQueueMode || rmIndex >= rmQueue.length) {
        _rmChartQueueFinish();
        return;
    }
    var song = rmQueue[rmIndex];
    var band = _rmFullBandName(song.band) || 'Grateful Dead';
    var q = encodeURIComponent(song.title + ' ' + band);

    // Show progress banner
    var existing = document.getElementById('rmChartQueueBanner');
    if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'rmChartQueueBanner';
    banner.style.cssText = 'position:sticky;top:0;z-index:10;padding:8px 14px;background:rgba(99,102,241,0.1);border-bottom:2px solid rgba(99,102,241,0.3);display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    var progress = _rmChartQueueDone + 1;
    banner.innerHTML = '<span style="font-size:0.78em;color:#a5b4fc;font-weight:700">Chart Queue: ' + progress + ' of ' + _rmChartQueueTotal + '</span>'
        + '<span style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;min-width:60px"><span style="display:block;height:100%;width:' + Math.round((_rmChartQueueDone / _rmChartQueueTotal) * 100) + '%;background:#a5b4fc;border-radius:2px"></span></span>'
        + '<button onclick="window.open(\'https://www.ultimate-guitar.com/search.php?search_type=title&value=' + q + '\',\'_blank\')" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;font-size:0.75em;font-weight:700;cursor:pointer;white-space:nowrap;min-height:36px">🎸 Open UG</button>'
        + '<button onclick="_rmChartQueueSkip()" style="padding:6px 12px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;font-size:0.75em;cursor:pointer;white-space:nowrap;min-height:36px">Skip</button>'
        + '<button onclick="_rmChartQueueFinish()" style="background:none;border:none;color:rgba(255,255,255,0.2);cursor:pointer;font-size:1em;padding:4px">✕</button>';
    var panel = document.getElementById('rmPanelChart');
    if (panel) panel.insertBefore(banner, panel.firstChild);

    // Open paste mode with empty textarea
    rmEditing = true;
    var ta = document.getElementById('rmEditTextarea');
    if (ta) {
        ta.value = '';
        ta.placeholder = 'Paste chart for ' + song.title + ' here — then hit Save to advance';
    }
    document.getElementById('rmChartText').style.display = 'none';
    document.getElementById('rmNoChart').classList.add('hidden');
    document.getElementById('rmEditPanel').classList.remove('hidden');
    document.getElementById('rmEditToggle').textContent = '✕ Cancel';
    if (ta) ta.focus();
}

function _rmChartQueueSkip() {
    _rmChartQueueDone++;
    rmIndex++;
    if (rmIndex < rmQueue.length) {
        rmLoadSong();
        setTimeout(function() { _rmChartQueueLoadCurrent(); }, 300);
    } else {
        _rmChartQueueFinish();
    }
}

function _rmChartQueueFinish() {
    _rmChartQueueMode = false;
    var banner = document.getElementById('rmChartQueueBanner');
    if (banner) banner.remove();
    if (_rmChartQueueDone > 0) {
        if (typeof showToast === 'function') showToast(_rmChartQueueDone + ' chart' + (_rmChartQueueDone > 1 ? 's' : '') + ' added!');
    }
    closeRehearsalMode();
}

// ── Build & inject the overlay DOM (once) ────────────────────────────────────
function rmEnsureOverlay() {
    if (document.getElementById('rmOverlay')) return;
    const el = document.createElement('div');
    el.id = 'rmOverlay';
    el.innerHTML = `
        <!-- HEADER BAR -->
        <div class="rm-header">
            <button class="rm-close" onclick="closeRehearsalMode()" title="Close (Esc)">✕</button>
            <div class="rm-title-block">
                <div class="rm-song-title" id="rmSongTitle">Song Title</div>
                <div class="rm-song-meta" id="rmSongMeta"></div>
            </div>
            <div class="rm-nav-block">
                <button class="rm-nav-btn" id="rmPrevBtn" onclick="rmNavigate(-1)" title="Previous song">‹</button>
                <span class="rm-position" id="rmPosition">1 / 1</span>
                <button class="rm-nav-btn" id="rmNextBtn" onclick="rmNavigate(1)" title="Next song">›</button>
            </div>
        </div>

        <!-- BAND SYNC BAR (rendered dynamically) -->
        <div id="rmSyncBar" style="display:none"></div>

        <!-- TAB BAR -->
        <div class="rm-tabs" id="rmTabBar">
            <button class="rm-tab active" data-tab="chart"   onclick="rmSwitchTab('chart',this)">📖 Chart</button>
            <button class="rm-tab"        data-tab="know"    onclick="rmSwitchTab('know',this)">📚 Know</button>
            <button class="rm-tab"        data-tab="memory"  onclick="rmSwitchTab('memory',this)">🧠 Mem</button>
            <button class="rm-tab"        data-tab="harmony" onclick="rmSwitchTab('harmony',this)">🎵 Listen</button>
            <button class="rm-tab"        data-tab="record"  onclick="rmSwitchTab('record',this)">🎙️ Rec</button>
        </div>

        <!-- TAB PANELS -->
        <div class="rm-body" id="rmBody">
            <div class="rm-panel active" id="rmPanelChart">
                 <div class="rm-sticky-bar" id="rmStickyBar">
                     <button class="rm-tb" onclick="rmTranspose(-1)" title="Transpose down (flat)">♭</button>
                     <span class="rm-tb-val" id="rmTransposeKey">C</span>
                     <button class="rm-tb" onclick="rmTranspose(1)" title="Transpose up (sharp)">♯</button>
                     <span class="rm-tb-sep"></span>
                     <span class="rm-tb-val" id="rmBpmDisplay" title="Beats per minute">120</span>
                     <button class="rm-tb" id="rmCountOffBtn" onclick="rmStartCountOff()" title="Metronome — tap to start click track">Count Off</button>
                     <button class="rm-tb" id="rmMetroMeasures" onclick="rmCycleMetroMode()" title="Measures: click for 1-4 bars then stop, or ∞ for continuous">2 bars</button>
                     <span class="rm-tb-sep"></span>
                     <button class="rm-tb" id="rmBrainBtn" onclick="rmToggleBrainTrainer()" title="Brain Trainer — hide lyrics to test memory">🧠</button>
                     <button class="rm-tb rm-brain-ctrl hidden" id="rmBrainLess" onclick="rmBrainAdjust(-25)" title="Hide more words">−</button>
                     <span class="rm-tb-val rm-brain-ctrl hidden" id="rmBrainPct" title="Percentage of lyrics visible">75%</span>
                     <button class="rm-tb rm-brain-ctrl hidden" id="rmBrainMore" onclick="rmBrainAdjust(25)" title="Show more words">+</button>
                     <span class="rm-tb-sep"></span>
                     <button class="rm-tb" onclick="rmToggleAutoScroll()" id="rmScrollBtn" title="Auto-scroll chart">📜</button>
                     <button class="rm-tb hidden" id="rmScrollMinus" onclick="rmScrollSpeed(-1)" title="Slower scroll">−</button>
                     <span class="rm-tb-val hidden" id="rmScrollSpeedVal" title="Scroll speed (1-5)">3</span>
                     <button class="rm-tb hidden" id="rmScrollPlus" onclick="rmScrollSpeed(1)" title="Faster scroll">+</button>
                     <span class="rm-tb-sep"></span>
                     <button class="rm-tb" onclick="rmAdjustFont(-1)" title="Smaller text">A−</button>
                     <button class="rm-tb" onclick="rmAdjustFont(1)" title="Larger text">A+</button>
                     <button class="rm-tb" onclick="rmSearchUG()" title="Search Ultimate Guitar">🎸</button>
                     <button class="rm-tb" id="rmEditToggle" onclick="rmToggleEdit()" title="Edit chart">✏️</button>
                     <span class="rm-tb-sep"></span>
                     <button class="rm-tb" onclick="rmOpenPocketMeter()" title="Pocket Meter — tap tempo &amp; metronome">🥁</button>
                 </div>
                 <button class="rm-monkey-float" onclick="rmToggleToolbar()" id="rmMonkeyBtn" title="Hide/show toolbar">🙈</button>
                <div id="rmChartLoading" class="rm-loading">Loading chart…</div>
                <pre class="rm-chart-text" id="rmChartText"></pre>
                <div class="rm-no-chart hidden" id="rmNoChart">
                    <div class="rm-no-chart-icon">🎸</div>
                    <div class="rm-no-chart-msg">No chord chart yet for this song.</div>
                    <div id="rmNoChartActions" style="margin-top:16px;display:flex;flex-direction:column;gap:10px;max-width:320px;margin-left:auto;margin-right:auto"></div>
                </div>
                <div class="rm-edit-panel hidden" id="rmEditPanel">
                    <div class="rm-edit-label">Chord chart, structure, lyrics — anything you need on the floor:</div>
                    <textarea class="rm-edit-textarea" id="rmEditTextarea" placeholder="G  C  D  G&#10;&#10;[Verse]&#10;A  E  D"></textarea>
                    <div class="rm-edit-actions">
                        <button class="rm-save-btn" onclick="rmSaveChart()">💾 Save</button>
                        <button class="rm-cancel-btn" onclick="rmCancelEdit()">Cancel</button>
                    </div>
                </div>
            </div>
            <div class="rm-panel" id="rmPanelKnow"><div id="rmKnowContent" class="rm-scroll-content"><div class="rm-loading">Loading song info…</div></div></div>
            <div class="rm-panel" id="rmPanelMemory"><div id="rmMemoryContent" class="rm-scroll-content"><div class="rm-loading">Loading memory palace…</div></div></div>
            <div class="rm-panel" id="rmPanelHarmony"><div id="rmHarmonyContent" class="rm-scroll-content"><div class="rm-loading">Loading harmony tools…</div></div></div>
            <div class="rm-panel" id="rmPanelRecord"><div id="rmRecordContent" class="rm-scroll-content"><div class="rm-loading">Loading recorder…</div></div></div>
        </div>

        <!-- FOOTER QUICK ACTIONS -->
        <div class="rm-footer">
            <button class="rm-action-btn" onclick="rmOpenYouTube()">🎥 YouTube</button>
            <button class="rm-action-btn" onclick="rmOpenMoises()">🎛️ Moises</button>
            <button class="rm-action-btn" onclick="rmAddSongToQueue()">➕ Queue</button>
            <button class="rm-action-btn" onclick="rmAddNote()">📋 Note</button>
        </div>

        <!-- ADD-NOTE SHEET -->
        <div class="rm-sheet hidden" id="rmNoteSheet">
            <div class="rm-sheet-inner">
                <div class="rm-sheet-title">📋 Add Rehearsal Note</div>
                <textarea class="rm-edit-textarea" id="rmNoteInput" placeholder="What needs work?"></textarea>
                <div class="rm-edit-actions">
                    <button class="rm-save-btn" onclick="rmSaveNote()">Save Note</button>
                    <button class="rm-cancel-btn" onclick="rmCloseSheet('rmNoteSheet')">Cancel</button>
                </div>
            </div>
        </div>

        <!-- ADD-SONG-TO-QUEUE SHEET -->
        <div class="rm-sheet hidden" id="rmQueueSheet">
            <div class="rm-sheet-inner">
                <div class="rm-sheet-title">➕ Add Song to Queue</div>
                <select class="rm-queue-select" id="rmQueuePicker"><option value="">— Pick a song —</option></select>
                <div class="rm-edit-actions">
                    <button class="rm-save-btn" onclick="rmConfirmAddSong()">Add</button>
                    <button class="rm-cancel-btn" onclick="rmCloseSheet('rmQueueSheet')">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(el);
    document.addEventListener('keydown', rmKeyHandler);
}

// ── Tab switching ────────────────────────────────────────────────────────────
function rmSwitchTab(tab, btn) {
    rmCurrentTab = tab;
    document.querySelectorAll('.rm-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.rm-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById('rmPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (panel) panel.classList.add('active');
    const controls = document.getElementById('rmStickyBar');
    if (controls) controls.style.display = (tab === 'chart' && !rmToolbarHidden) ? 'flex' : 'none';
    const monkey = document.getElementById('rmMonkeyBtn');
    // In gig mode the monkey lives on document.body — always keep it visible there
    if (monkey) monkey.style.display = (tab === 'chart' || monkey.parentElement === document.body) ? 'block' : 'none';
    // Lazy-load tab content on first switch — needed when entering via gig mode
    // (openGigMode only calls rmLoadChart; other tabs load on demand)
    if (tab === 'know') {
        const el = document.getElementById('rmKnowContent');
        if (el && el.querySelector('.rm-loading')) rmLoadKnow();
    } else if (tab === 'memory') {
        const el = document.getElementById('rmMemoryContent');
        if (el && el.querySelector('.rm-loading')) rmLoadMemory();
    } else if (tab === 'harmony') {
        const el = document.getElementById('rmHarmonyContent');
        if (el && el.querySelector('.rm-loading')) rmLoadHarmony();
    } else if (tab === 'record') {
        const el = document.getElementById('rmRecordContent');
        if (el && el.querySelector('.rm-loading')) rmLoadRecord();
    }
}

// ── Open / close ─────────────────────────────────────────────────────────────
function rmShow() {
    rmEnsureOverlay();
    // Restore planner queue from localStorage if current queue is empty (page refresh case)
    if ((!rmQueue || !rmQueue.length) && localStorage.getItem('glPlannerQueue')) {
        try {
            var stored = JSON.parse(localStorage.getItem('glPlannerQueue'));
            if (stored && stored.length) {
                rmQueue = stored;
                rmIndex = 0;
                var storedGuidance = localStorage.getItem('glPlannerGuidance');
                if (storedGuidance) window._rpBlockGuidance = JSON.parse(storedGuidance);
            }
        } catch(e) {}
    }
    const overlay = document.getElementById('rmOverlay');
    overlay.classList.add('rm-visible');
    // Milestone 4: notify shell we're entering performance mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('performance');
    if (typeof glWakeLock !== 'undefined') glWakeLock.acquire('rehearsal-mode');
    if (typeof GLStore !== 'undefined' && GLStore.setLiveRehearsalSong) GLStore.setLiveRehearsalSong(rmQueue[rmIndex] ? rmQueue[rmIndex].title : null);
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    rmEditing = false;
    rmCurrentTab = 'chart';
    document.querySelectorAll('.rm-tab').forEach(b => b.classList.remove('active'));
    document.querySelector('.rm-tab[data-tab="chart"]')?.classList.add('active');
    document.querySelectorAll('.rm-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('rmPanelChart')?.classList.add('active');
    const controls = document.getElementById('rmStickyBar');
    if (controls) controls.style.display = 'flex';
    const tools = document.getElementById('rmStickyBar');
    // tools merged into sticky bar
    rmLoadSong();
}

function closeRehearsalMode() {
    const overlay = document.getElementById('rmOverlay');
    if (!overlay) return;
    overlay.classList.remove('rm-visible');
    // Save session timing summary
    if (_rmSessionStart > 0) _rmSaveSessionSummary();
    if (_rmTimingInterval) { clearInterval(_rmTimingInterval); _rmTimingInterval = null; }
    // Milestone 4: restore workspace mode
    if (typeof GLStore !== 'undefined' && GLStore.setAppMode) GLStore.setAppMode('workspace');
    if (typeof glWakeLock !== 'undefined') glWakeLock.release('rehearsal-mode');
    if (typeof GLStore !== 'undefined' && GLStore.setLiveRehearsalSong) GLStore.setLiveRehearsalSong(null);
    const scrollY = document.body.dataset.scrollY || '0';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, parseInt(scrollY));
    rmEditing = false;
    clearInterval(pmPalaceAutoTimer);
    rmStopCountOff();
    if (rmScrollTimer) { clearInterval(rmScrollTimer); rmScrollTimer = null; }
    // NOTE: saved plan (glPlannerQueue) is intentionally NOT cleared here.
    // Closing rehearsal mode ends the active session UI, not the saved plan.
    // Use _rhClearSavedPlan() to explicitly clear the saved plan.
}

// ══════════════════════════════════════════════════════════════════════════════
// CHART TAB — 591 imported chord charts + edit
// ══════════════════════════════════════════════════════════════════════════════
async function rmLoadChart() {
    const song = rmQueue[rmIndex]; if (!song) return;
    const loadIdx = rmIndex; // snapshot index to detect stale results
    rmCancelEdit(true);
    document.getElementById('rmChartLoading').style.display = 'block';
    document.getElementById('rmChartText').style.display = 'none';
    document.getElementById('rmNoChart').classList.add('hidden');

    var cached = _rmCache[song.title];
    let crib = (cached && cached.chart !== undefined) ? cached.chart : null;
    if (crib === null) {
        // Load all chart sources in parallel, use first non-empty
        var _cr = await Promise.all([
            loadBandDataFromDrive(song.title, 'chart').catch(function(){return null;}),
            loadBandDataFromDrive(song.title, 'rehearsal_crib').catch(function(){return null;}),
            loadBandDataFromDrive(song.title, 'gig_notes').catch(function(){return null;})
        ]);
        // Stale check: if user navigated during async load, discard this result
        if (rmIndex !== loadIdx) return;
        if (_cr[0]?.text?.trim()) crib = _cr[0].text;
        else if (_cr[1] && typeof _cr[1] === 'string' && _cr[1].trim()) crib = _cr[1];
        else if (_cr[2]) { var _gn = toArray(_cr[2]); if (_gn.length) crib = _gn.join('\n'); }
        // Cache result (even empty string = "no chart")
        if (!_rmCache[song.title]) _rmCache[song.title] = {};
        _rmCache[song.title].chart = crib || '';
        _rmCache[song.title].ts = Date.now();
    }

    document.getElementById('rmChartLoading').style.display = 'none';
    // Song coaching signal
    var _coachEl = document.getElementById('rmCoachSignal');
    if (!_coachEl) {
        _coachEl = document.createElement('div');
        _coachEl.id = 'rmCoachSignal';
        _coachEl.style.cssText = 'padding:6px 12px;font-size:0.78em;color:#94a3b8;background:rgba(99,102,241,0.06);border-bottom:1px solid rgba(99,102,241,0.1);display:none';
        var chartPanel = document.getElementById('rmChartText');
        if (chartPanel && chartPanel.parentElement) chartPanel.parentElement.insertBefore(_coachEl, chartPanel);
    }
    var _coachMsg = (typeof GLStore !== 'undefined' && GLStore.getSongCoachSignal) ? GLStore.getSongCoachSignal(song.title) : null;
    if (_coachMsg) { _coachEl.textContent = '\uD83C\uDFAF ' + _coachMsg; _coachEl.style.display = 'block'; }
    else { _coachEl.style.display = 'none'; }
    // Band Notes strip — load song_structure and render summary
    _rmLoadBandNotesStrip(song.title);
    const safeSong = song.title.replace(/'/g, "\\'");
    const band = _rmFullBandName(song.band) || 'Grateful Dead';
    const ugQuery = encodeURIComponent(song.title + ' ' + band);
    const chordifyQuery = encodeURIComponent(song.title + ' ' + band);

    if (crib && crib.trim()) {
        rmOriginalChart = crib;
        document.getElementById('rmChartText').textContent = crib;
        document.getElementById('rmChartText').style.display = 'block';
        document.getElementById('rmNoChart').classList.add('hidden');
        rmAutoFitFont();
        rmLoadChartTools(song.title);
        if (rmTransposeSemitones !== 0) rmApplyTranspose();
    } else {
        rmOriginalChart = '';
        document.getElementById('rmChartText').style.display = 'none';
        document.getElementById('rmNoChart').classList.remove('hidden');
        rmLoadChartTools(song.title);
        // Populate no-chart actions
        const actions = document.getElementById('rmNoChartActions');
        if (actions) actions.innerHTML = `
            <button onclick="window.open('https://www.ultimate-guitar.com/search.php?search_type=title&value=${ugQuery}','_blank');_rmShowPasteBanner('${safeSong}')" style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(255,165,0,0.12);border:1px solid rgba(255,165,0,0.3);border-radius:10px;color:#fbbf24;font-weight:700;font-size:0.9em;cursor:pointer;width:100%;text-align:left">
                <span style="font-size:1.3em">🎸</span>
                <div><div>Find Chart on Ultimate Guitar</div><div style="font-size:0.75em;font-weight:400;color:rgba(251,191,36,0.6);margin-top:2px">Log in to UG Pro to copy — then come back and paste</div></div>
            </button>
            <button onclick="_rmStartFreshChart('${safeSong}')" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#94a3b8;font-weight:600;font-size:0.9em;cursor:pointer;width:100%;text-align:left">
                <span style="font-size:1.3em">✏️</span>
                <div><div>Type or Paste a Chart</div><div style="font-size:0.75em;font-weight:400;color:rgba(148,163,184,0.6);margin-top:2px">Write it yourself or paste from any source</div></div>
            </button>
            <div id="rmPersonalTabsInChart" style="margin-top:8px"></div>`;
        // Load personal tabs into the chart panel
        rmLoadPersonalTabsInChart(song.title);
    }
}

// ── Section Timeline + Active Band Notes ─────────────────────────────────────
var _rmTypeIcons = {intro:'🎬',verse:'📝',pre_chorus:'📝',chorus:'🎶',post_chorus:'🎶',solo:'🎸',jam:'🌀',bridge:'🌉',outro:'🔚',ending:'🔚',breakdown:'💥',build:'📈',drop:'📉',vamp:'🔁',tag:'🏷',interlude:'🎵',turnaround:'↩️',head:'🎵',refrain:'🎶',other:'·'};

function _rmLoadBandNotesStrip(songTitle) {
    // Clean up previous elements
    ['rmSectionTimeline','rmActiveSectionPanel','rmBandNotesStrip'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.remove();
    });
    _rmSections = [];
    _rmActiveSectionIdx = 0;
    _rmScrollSyncEnabled = false;

    if (typeof GLStore === 'undefined' || !GLStore.loadFieldMeta) return;
    GLStore.loadFieldMeta(songTitle, 'song_structure').then(function(data) {
        if (!data || !data.sections || !data.sections.length) return;
        _rmSections = data.sections;
        _rmActiveSectionIdx = 0;
        _rmRenderTimeline();
        _rmRenderActiveSectionPanel();
        _rmSetupScrollSync();
    }).catch(function() {});
}

// Render the horizontal scrollable timeline: Intro → V1 → Chorus → Solo → Outro
function _rmRenderTimeline() {
    var existing = document.getElementById('rmSectionTimeline');
    if (existing) existing.remove();
    if (!_rmSections.length) return;

    var timeline = document.createElement('div');
    timeline.id = 'rmSectionTimeline';
    timeline.style.cssText = 'display:flex;align-items:center;gap:2px;padding:5px 10px;overflow-x:auto;-webkit-overflow-scrolling:touch;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(255,255,255,0.06);scrollbar-width:none';

    _rmSections.forEach(function(s, i) {
        var isActive = i === _rmActiveSectionIdx;
        var icon = _rmTypeIcons[s.type] || _rmTypeIcons.other;
        var rawLabel = s.label || s.name || '';
        // Compact labels: "Verse 1" → "V1", "Chorus 2" → "Ch2", but preserve numbering
        var shortLabel = rawLabel
            .replace(/^Verse\s*/i, 'V').replace(/^Chorus\s*/i, 'Ch')
            .replace(/^Bridge\s*/i, 'Br').replace(/^Breakdown\s*/i, 'Bkdn')
            .replace(/^Interlude\s*/i, 'Int').replace(/^Turnaround\s*/i, 'TA');
        if (shortLabel.length > 10) shortLabel = shortLabel.slice(0, 9) + '…';

        var pill = document.createElement('button');
        pill.dataset.secIdx = i;
        pill.style.cssText = 'flex-shrink:0;padding:3px 8px;border-radius:4px;font-size:0.68em;font-weight:' + (isActive ? '800' : '600')
            + ';cursor:pointer;white-space:nowrap;border:1px solid ' + (isActive ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.06)')
            + ';background:' + (isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)')
            + ';color:' + (isActive ? '#a5b4fc' : '#64748b')
            + ';touch-action:manipulation;transition:all 0.15s';
        pill.textContent = icon + ' ' + shortLabel;
        pill.onclick = function() { _rmSetActiveSection(i); };
        timeline.appendChild(pill);

        // Arrow between pills (except last)
        if (i < _rmSections.length - 1) {
            var arrow = document.createElement('span');
            arrow.style.cssText = 'color:rgba(255,255,255,0.15);font-size:0.6em;flex-shrink:0';
            arrow.textContent = '›';
            timeline.appendChild(arrow);
        }
    });

    // Prev/Next section buttons at edges
    var prevBtn = document.createElement('button');
    prevBtn.style.cssText = 'flex-shrink:0;padding:3px 6px;border-radius:4px;font-size:0.7em;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:' + (_rmActiveSectionIdx > 0 ? '#64748b' : 'rgba(255,255,255,0.1)') + ';touch-action:manipulation';
    prevBtn.textContent = '‹';
    prevBtn.onclick = function() { if (_rmActiveSectionIdx > 0) _rmSetActiveSection(_rmActiveSectionIdx - 1); };
    timeline.insertBefore(prevBtn, timeline.firstChild);

    var nextBtn = document.createElement('button');
    nextBtn.style.cssText = 'flex-shrink:0;padding:3px 6px;border-radius:4px;font-size:0.7em;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:' + (_rmActiveSectionIdx < _rmSections.length - 1 ? '#64748b' : 'rgba(255,255,255,0.1)') + ';touch-action:manipulation';
    nextBtn.textContent = '›';
    nextBtn.onclick = function() { if (_rmActiveSectionIdx < _rmSections.length - 1) _rmSetActiveSection(_rmActiveSectionIdx + 1); };
    timeline.appendChild(nextBtn);

    // Swipe on timeline for prev/next section
    var _swStartX = 0;
    timeline.addEventListener('touchstart', function(e) { _swStartX = e.touches[0].clientX; }, { passive: true });
    timeline.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - _swStartX;
        if (Math.abs(dx) < 50) return; // too short
        if (dx < 0 && _rmActiveSectionIdx < _rmSections.length - 1) _rmSetActiveSection(_rmActiveSectionIdx + 1);
        else if (dx > 0 && _rmActiveSectionIdx > 0) _rmSetActiveSection(_rmActiveSectionIdx - 1);
    }, { passive: true });

    // Insert between sticky bar and chart
    var chartEl = document.getElementById('rmChartText');
    if (chartEl && chartEl.parentElement) chartEl.parentElement.insertBefore(timeline, chartEl);
}

// Render the active section's band notes (only non-null fields)
function _rmRenderActiveSectionPanel() {
    // Suppress scroll sync during DOM mutation (prevents scroll fight loop)
    _rmScrollSyncProgrammatic = true;

    var existing = document.getElementById('rmActiveSectionPanel');
    if (!_rmSections.length) { if (existing) existing.innerHTML = ''; _rmScrollSyncProgrammatic = false; return; }

    var s = _rmSections[_rmActiveSectionIdx];
    if (!s) { if (existing) existing.innerHTML = ''; _rmScrollSyncProgrammatic = false; return; }

    // Collect non-null band notes
    var fields = [];
    if (s.starter) fields.push({ icon: '👤', label: s.starter + ' starts' });
    if (s.feel) fields.push({ icon: '🎵', label: s.feel });
    if (s.soloOrder && s.soloOrder.length) fields.push({ icon: '🎸', label: s.soloOrder.join(' → ') });
    if (s.instrument && !(s.soloOrder && s.soloOrder.length)) fields.push({ icon: '🎸', label: s.instrument });
    if (s.dynamics) fields.push({ icon: '📊', label: s.dynamics });
    if (s.stopCue) fields.push({ icon: '✋', label: s.stopCue });
    if (s.endCue) fields.push({ icon: '🔚', label: s.endCue });
    if (s.introType) fields.push({ icon: '🎬', label: s.introType.replace(/_/g, ' ') });
    if (s.endingType) fields.push({ icon: '🏁', label: s.endingType.replace(/_/g, ' ') });
    if (fields.length === 0 && s.notes) fields.push({ icon: '📝', label: s.notes });

    // Use a STABLE container — update innerHTML instead of remove/insert
    // This avoids DOM reflow that shifts chart scroll position
    if (!existing) {
        existing = document.createElement('div');
        existing.id = 'rmActiveSectionPanel';
        existing.style.cssText = 'font-size:0.72em;color:#94a3b8';
        var chartEl = document.getElementById('rmChartText');
        if (chartEl && chartEl.parentElement) chartEl.parentElement.insertBefore(existing, chartEl);
    }

    if (fields.length === 0) {
        existing.innerHTML = '';
        existing.style.display = 'none';
        setTimeout(function() { _rmScrollSyncProgrammatic = false; }, 100);
        return;
    }

    existing.style.display = 'flex';
    existing.style.cssText = 'padding:5px 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:rgba(99,102,241,0.04);border-bottom:1px solid rgba(99,102,241,0.1);font-size:0.72em;color:#94a3b8';

    var sectionIcon = _rmTypeIcons[s.type] || '';
    var html = '<span style="font-size:0.6em;font-weight:800;letter-spacing:0.08em;color:rgba(99,102,241,0.5);text-transform:uppercase;flex-shrink:0">NOW</span>'
        + '<span style="font-weight:700;color:#a5b4fc;flex-shrink:0">' + sectionIcon + ' ' + (s.label || s.name || '') + '</span>'
        + '<span style="color:rgba(255,255,255,0.1)">│</span>';
    fields.forEach(function(f) {
        html += '<span style="white-space:nowrap">' + f.icon + ' ' + f.label + '</span>';
    });
    existing.innerHTML = html;

    // Re-enable scroll sync after DOM settles
    setTimeout(function() { _rmScrollSyncProgrammatic = false; }, 100);
}

// Set active section: update state, re-render timeline + panel, scroll chart
function _rmSetActiveSection(idx) {
    if (idx < 0 || idx >= _rmSections.length) return;
    _rmActiveSectionIdx = idx;
    _rmRenderTimeline();
    _rmRenderActiveSectionPanel();
    // Scroll active pill into view
    var timeline = document.getElementById('rmSectionTimeline');
    if (timeline) {
        var activePill = timeline.querySelector('[data-sec-idx="' + idx + '"]');
        if (activePill) activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
    // Scroll chart to anchor
    _rmScrollChartToSection(idx);
}

// Find chart position for an anchor — case-insensitive exact match, then partial fallback
function _rmFindAnchorPos(text, anchorLabel, anchorIndex) {
    if (!anchorLabel || !text) return -1;
    var textLower = text.toLowerCase();
    var exact = '[' + anchorLabel.toLowerCase() + ']';
    var aIdx = anchorIndex || 0;
    // Try exact case-insensitive match first
    var pos = -1;
    for (var n = 0; n <= aIdx; n++) {
        pos = textLower.indexOf(exact, pos + 1);
        if (pos === -1) break;
    }
    if (pos !== -1) return pos;
    // Partial fallback: search for any [Header] containing the anchor label
    var partial = anchorLabel.toLowerCase();
    var re = /\[([^\]]+)\]/g;
    var match, count = 0;
    while ((match = re.exec(textLower)) !== null) {
        if (match[1].indexOf(partial) !== -1 || partial.indexOf(match[1]) !== -1) {
            if (count === aIdx) return match.index;
            count++;
        }
    }
    return -1;
}

// Scroll chart text to the section's chartAnchor
function _rmScrollChartToSection(idx) {
    var s = _rmSections[idx];
    if (!s || !s.chartAnchor) return;
    var chartEl = document.getElementById('rmChartText');
    if (!chartEl) return;
    var text = chartEl.textContent || '';
    var pos = _rmFindAnchorPos(text, s.chartAnchor, s.anchorIndex);
    if (pos === -1) return;
    var linesBefore = text.substring(0, pos).split('\n').length - 1;
    var lineHeight = parseFloat(getComputedStyle(chartEl).lineHeight) || (rmFontSize * 1.4);
    var scrollTarget = linesBefore * lineHeight;
    var scrollContainer = chartEl.closest('.rm-panel') || chartEl.parentElement;
    if (scrollContainer) {
        // Suppress scroll sync while programmatic scroll is happening
        _rmScrollSyncProgrammatic = true;
        scrollContainer.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        // Re-enable after scroll settles
        setTimeout(function() { _rmScrollSyncProgrammatic = false; }, 600);
    }
}

// Lightweight scroll sync: detect which section anchor is visible and update active
// IMPORTANT: This only updates the timeline pill highlight — it must NEVER scroll the chart,
// or it creates a scroll fight loop (scroll → detect section → scroll to section → repeat).
var _rmScrollSyncProgrammatic = false; // true when code is scrolling (suppress sync)
function _rmSetupScrollSync() {
    _rmScrollSyncEnabled = false;
    if (!_rmSections.length) return;
    var chartEl = document.getElementById('rmChartText');
    if (!chartEl) return;
    var text = chartEl.textContent || '';
    // Build anchor position map using resilient matching
    var anchorPositions = [];
    _rmSections.forEach(function(s, i) {
        if (!s.chartAnchor) return;
        var pos = _rmFindAnchorPos(text, s.chartAnchor, s.anchorIndex);
        if (pos === -1) return;
        var linesBefore = text.substring(0, pos).split('\n').length - 1;
        var isJam = s.type === 'jam' || s.type === 'solo' || s.type === 'vamp';
        anchorPositions.push({ sectionIdx: i, line: linesBefore, isJam: isJam });
    });
    if (anchorPositions.length < 2) return;
    _rmScrollSyncEnabled = true;

    var scrollContainer = chartEl.closest('.rm-panel') || chartEl.parentElement;
    if (!scrollContainer) return;

    var _lastSyncTs = 0;
    scrollContainer.addEventListener('scroll', function() {
        // Skip sync when code is doing the scrolling (prevents fight loop)
        if (_rmScrollSyncProgrammatic) return;
        var now = Date.now();
        if (now - _lastSyncTs < 300) return; // 300ms throttle
        _lastSyncTs = now;
        var lineHeight = parseFloat(getComputedStyle(chartEl).lineHeight) || (rmFontSize * 1.4);
        var scrollLine = Math.round(scrollContainer.scrollTop / lineHeight);
        var bestIdx = 0;
        for (var i = 0; i < anchorPositions.length; i++) {
            var ap = anchorPositions[i];
            var threshold = ap.isJam ? 8 : 2;
            if (ap.line <= scrollLine + threshold) bestIdx = ap.sectionIdx;
        }
        if (bestIdx !== _rmActiveSectionIdx) {
            _rmActiveSectionIdx = bestIdx;
            // Only update the timeline pill — do NOT scroll chart or call _rmSetActiveSection
            _rmRenderTimeline();
            _rmRenderActiveSectionPanel();
            // Scroll the active pill into view WITHIN the timeline container only
            // (do not use scrollIntoView — it can scroll the entire page)
            var timeline = document.getElementById('rmSectionTimeline');
            if (timeline) {
                var pill = timeline.querySelector('[data-sec-idx="' + bestIdx + '"]');
                if (pill) {
                    var tlRect = timeline.getBoundingClientRect();
                    var pillRect = pill.getBoundingClientRect();
                    var offset = pillRect.left - tlRect.left - (tlRect.width / 2) + (pillRect.width / 2);
                    timeline.scrollLeft += offset;
                }
            }
        }
    }, { passive: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// BAND SYNC — UI (leader controls, follower banner, song-change reaction)
// ══════════════════════════════════════════════════════════════════════════════

function _rmRenderSyncBar() {
    var bar = document.getElementById('rmSyncBar');
    if (!bar) return;
    if (typeof GLStore === 'undefined') { bar.style.display = 'none'; return; }
    var session = GLStore.getSyncSession();
    var isLeader = GLStore.isSyncLeader();
    var isFollower = GLStore.isSyncFollower();

    if (!session && !isLeader && !isFollower) {
        // Not in sync — show start button (small, non-intrusive)
        bar.style.display = 'flex';
        bar.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:4px 12px;background:rgba(255,255,255,0.02);border-bottom:1px solid rgba(255,255,255,0.04)';
        bar.innerHTML = '<button onclick="_rmStartSync()" style="font-size:0.7em;font-weight:600;padding:3px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc">🔗 Start Band Sync</button>'
            + '<button onclick="_rmShowJoinSync()" style="font-size:0.7em;font-weight:600;padding:3px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;margin-left:6px">Join Session</button>';
        return;
    }

    bar.style.display = 'flex';

    if (isLeader && session) {
        var count = GLStore.getSyncFollowerCount();
        bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:rgba(99,102,241,0.08);border-bottom:1px solid rgba(99,102,241,0.2);flex-wrap:wrap';
        bar.innerHTML = '<span style="font-size:0.72em;font-weight:700;color:#a5b4fc">🔗 Band Sync ON</span>'
            + '<span style="font-size:0.68em;color:var(--text-dim)">' + count + ' following</span>'
            + '<span style="font-size:0.68em;font-weight:700;color:#fbbf24;background:rgba(251,191,36,0.1);padding:2px 8px;border-radius:4px;border:1px solid rgba(251,191,36,0.2);letter-spacing:0.1em">' + (session.joinCode || '') + '</span>'
            + '<button onclick="endBandSyncFromUI()" style="margin-left:auto;font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(239,68,68,0.2);background:rgba(239,68,68,0.06);color:#f87171;cursor:pointer">End Sync</button>';
        return;
    }

    if (isFollower && session) {
        var leaderName = session.leaderName || 'Leader';
        var songName = session.songTitle || 'Unknown';
        var stale = session._leaderStale;
        var following = GLStore.isSyncFollowing();

        bar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;border-bottom:1px solid ' + (stale ? 'rgba(239,68,68,0.2)' : following ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)') + ';background:' + (stale ? 'rgba(239,68,68,0.06)' : following ? 'rgba(34,197,94,0.04)' : 'rgba(251,191,36,0.04)') + ';flex-wrap:wrap';

        if (session.status === 'ended') {
            bar.innerHTML = '<span style="font-size:0.72em;color:var(--text-dim)">Session ended · Staying on last song</span>'
                + '<button onclick="_rmLeaveSyncUI()" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">Dismiss</button>';
        } else if (stale) {
            bar.innerHTML = '<span style="font-size:0.72em;color:#fca5a5">⚠️ Leader disconnected</span>'
                + '<span style="font-size:0.65em;color:var(--text-dim)">Last song: ' + songName + '</span>'
                + '<button onclick="_rmLeaveSyncUI()" style="margin-left:auto;font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">Leave</button>';
        } else if (following) {
            bar.innerHTML = '<span style="font-size:0.65em;color:#86efac">🔗 Following ' + leaderName + '</span>'
                + '<span style="font-size:0.78em;font-weight:800;color:var(--text,#f1f5f9);letter-spacing:0.02em">NOW PLAYING: ' + songName + '</span>'
                + '<button onclick="_rmPauseFollowUI()" style="margin-left:auto;font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:#94a3b8;cursor:pointer">Pause</button>'
                + '<button onclick="_rmLeaveSyncUI()" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">Leave</button>';
        } else {
            bar.innerHTML = '<span style="font-size:0.72em;color:#fbbf24">⏸ Paused</span>'
                + '<span style="font-size:0.65em;color:var(--text-dim)">' + leaderName + ' is on ' + songName + '</span>'
                + '<button onclick="_rmRejoinFollowUI()" style="margin-left:auto;font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(34,197,94,0.2);background:rgba(34,197,94,0.06);color:#86efac;cursor:pointer;font-weight:700">Rejoin</button>'
                + '<button onclick="_rmLeaveSyncUI()" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">Leave</button>';
        }
    }
}

// Leader: start sync with current song
function _rmStartSync() {
    var song = rmQueue[rmIndex];
    if (!song || typeof GLStore === 'undefined') return;
    var songData = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === song.title; }) : null;
    var songId = songData ? (songData.songId || song.title) : song.title;
    GLStore.startBandSync(songId, song.title).then(function(result) {
        if (result && typeof showToast === 'function') showToast('Band Sync started · Code: ' + result.joinCode);
    });
}

// Join modal
function _rmShowJoinSync() {
    var code = prompt('Enter the 6-character join code:');
    if (!code || typeof GLStore === 'undefined') return;
    GLStore.joinBandSync(code).then(function(session) {
        if (!session) { if (typeof showToast === 'function') showToast('Invalid or expired code'); return; }
        if (typeof showToast === 'function') showToast('Joined ' + (session.leaderName || 'Leader') + "'s session");
        // Jump to current song
        if (session.songTitle) openRehearsalMode(session.songTitle);
    });
}

window.endBandSyncFromUI = function() {
    if (typeof GLStore !== 'undefined') GLStore.endBandSync();
    if (typeof showToast === 'function') showToast('Band Sync ended');
};

function _rmPauseFollowUI() { if (typeof GLStore !== 'undefined') GLStore.pauseFollow(); }
function _rmRejoinFollowUI() { if (typeof GLStore !== 'undefined') GLStore.rejoinFollow(); }
// Brief transition overlay when leader changes song (follower sees this)
function _rmShowSyncTransition(songTitle) {
    document.getElementById('rmSyncTransition')?.remove();
    var el = document.createElement('div');
    el.id = 'rmSyncTransition';
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.3);border-radius:14px;padding:16px 28px;text-align:center;pointer-events:none;animation:rmSyncFade 1.5s ease-out forwards';
    el.innerHTML = '<div style="font-size:0.7em;color:#a5b4fc;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">NOW PLAYING</div>'
        + '<div style="font-size:1.1em;font-weight:800;color:#f1f5f9">→ ' + (songTitle || '') + '</div>';
    // Inject keyframes if not present
    if (!document.getElementById('rmSyncFadeStyle')) {
        var style = document.createElement('style');
        style.id = 'rmSyncFadeStyle';
        style.textContent = '@keyframes rmSyncFade{0%{opacity:0;transform:translate(-50%,-50%) scale(0.95)}15%{opacity:1;transform:translate(-50%,-50%) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}';
        document.head.appendChild(style);
    }
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 1600);
}

function _rmLeaveSyncUI() {
    if (typeof GLStore !== 'undefined') GLStore.leaveBandSync();
    if (typeof showToast === 'function') showToast('Left sync session');
}

// Subscribe to sync state changes — re-render bar
if (typeof GLStore !== 'undefined' && GLStore.subscribe) {
    GLStore.subscribe('syncStateChanged', function() { _rmRenderSyncBar(); });
    // Follower song-change reaction
    GLStore.subscribe('syncSongChanged', function(e) {
        if (!e || !e.songTitle) return;
        if (typeof GLStore !== 'undefined' && GLStore.isSyncFollowing && GLStore.isSyncFollowing()) {
            // Brief transition flash
            _rmShowSyncTransition(e.songTitle);
            openRehearsalMode(e.songTitle);
        }
    });

    // Leader: detect follower joins/pauses via state diffs
    var _prevFollowerKeys = {};
    GLStore.subscribe('syncStateChanged', function(evt) {
        if (!evt || !evt.session || evt.role !== 'leader') return;
        var followers = evt.session.followers || {};
        Object.keys(followers).forEach(function(key) {
            var f = followers[key];
            var prev = _prevFollowerKeys[key];
            if (!prev) {
                // New joiner
                if (typeof showToast === 'function') showToast('🔗 ' + (f.name || key) + ' joined', 1800);
            }
        });
        _prevFollowerKeys = {};
        Object.keys(followers).forEach(function(key) { _prevFollowerKeys[key] = followers[key]; });
    });
}

// ── Rehearsal Planner: block guidance overlay ────────────────────────────────
function _rmRenderBlockGuidance(songTitle) {
    var existing = document.getElementById('rmBlockGuidance');
    if (existing) existing.remove();
    if (!window._rpBlockGuidance || !window._rpBlockGuidance[songTitle]) return;
    var text = window._rpBlockGuidance[songTitle];
    var colors = { '🔥': '#f59e0b', '🛠': '#ef4444', '🎸': '#22c55e', '🔚': '#818cf8' };
    var color = '#94a3b8';
    Object.keys(colors).forEach(function(k) { if (text.indexOf(k) === 0) color = colors[k]; });
    var el = document.createElement('div');
    el.id = 'rmBlockGuidance';
    el.style.cssText = 'padding:8px 14px;font-size:0.78em;font-weight:700;color:' + color + ';background:' + color + '10;border-bottom:2px solid ' + color + '40;text-align:center';
    el.textContent = text;
    var panel = document.getElementById('rmPanelChart');
    if (panel) panel.insertBefore(el, panel.querySelector('.rm-sticky-bar') || panel.firstChild);
}

// ── Session timing helpers ────────────────────────────────────────────────────
function _rmRecordBlockTime() {
    if (!_rmBlockStartTime) return;
    var song = rmQueue[rmIndex];
    if (!song) return;
    var elapsed = Date.now() - _rmBlockStartTime;
    // Update existing entry for this index or add new
    var existing = _rmBlockTimings.find(function(t) { return t.index === rmIndex; });
    if (existing) {
        existing.actualMs += elapsed;
    } else {
        _rmBlockTimings.push({
            title: song.title,
            budgetMin: song.budgetMin || 0,
            actualMs: elapsed,
            index: rmIndex
        });
    }
}

function _rmRenderTimingBar() {
    var existing = document.getElementById('rmTimingBar');
    if (existing) existing.remove();
    var song = rmQueue[rmIndex];
    if (!song || !song.budgetMin) return;

    var budgetMin = song.budgetMin;
    var priorMs = 0;
    var prior = _rmBlockTimings.find(function(t) { return t.index === rmIndex; });
    if (prior) priorMs = prior.actualMs;
    var currentMs = priorMs + (Date.now() - (_rmBlockStartTime || Date.now()));
    var actualMin = Math.round(currentMs / 60000);
    var pct = Math.min(Math.round((currentMs / (budgetMin * 60000)) * 100), 999);

    var color = pct <= 80 ? '#22c55e' : pct <= 100 ? '#fbbf24' : '#ef4444';
    var label = pct <= 80 ? 'On track' : pct <= 100 ? 'Wrapping up' : 'Over time';

    var el = document.createElement('div');
    el.id = 'rmTimingBar';
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 14px;font-size:0.72em;background:rgba(15,23,42,0.6);border-bottom:1px solid rgba(255,255,255,0.04)';
    el.innerHTML = '<span style="color:var(--text-dim)">⏱</span>'
        + '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden"><div style="width:' + Math.min(pct, 100) + '%;height:100%;background:' + color + ';border-radius:2px;transition:width 0.5s"></div></div>'
        + '<span style="color:' + color + ';font-weight:700;white-space:nowrap">' + actualMin + 'm / ' + budgetMin + 'm</span>'
        + '<span style="color:' + color + ';font-size:0.9em;opacity:0.7">' + label + '</span>';

    // Show note from plan if available
    if (song.note) {
        el.innerHTML += '<span style="color:#fbbf24;font-size:0.9em;margin-left:4px" title="' + (typeof escHtml === 'function' ? escHtml(song.note) : song.note) + '">📝</span>';
    }

    var panel = document.getElementById('rmPanelChart');
    var guidance = document.getElementById('rmBlockGuidance');
    if (panel) {
        var insertBefore = guidance ? guidance.nextSibling : (panel.querySelector('.rm-sticky-bar') || panel.firstChild);
        panel.insertBefore(el, insertBefore);
    }
}

function _rmStartTimingUpdates() {
    if (_rmTimingInterval) clearInterval(_rmTimingInterval);
    _rmTimingInterval = setInterval(function() {
        var ov = document.getElementById('rmOverlay');
        if (!ov || !ov.classList.contains('rm-visible')) { clearInterval(_rmTimingInterval); return; }
        _rmRenderTimingBar();
    }, 10000); // update every 10 seconds
}

async function _rmSaveSessionSummary() {
    _rmRecordBlockTime(); // capture final block
    if (!_rmBlockTimings.length) return;
    var totalBudgetMin = _rmBlockTimings.reduce(function(s, t) { return s + (t.budgetMin || 0); }, 0);
    var totalActualMs = _rmBlockTimings.reduce(function(s, t) { return s + t.actualMs; }, 0);
    var totalActualMin = Math.round(totalActualMs / 60000);
    // Collect unique song titles worked
    var songsWorked = [];
    var seen = {};
    _rmBlockTimings.forEach(function(t) { if (t.title && !seen[t.title]) { seen[t.title] = true; songsWorked.push(t.title); } });

    var summary = {
        sessionId: 'rsess_' + Date.now().toString(36),
        date: new Date().toISOString(),
        start_time: _rmSessionStart ? new Date(_rmSessionStart).toISOString() : null,
        end_time: new Date().toISOString(),
        totalBudgetMin: totalBudgetMin,
        totalActualMin: totalActualMin,
        blocksCompleted: _rmBlockTimings.length,
        totalBlocks: rmQueue.length,
        songsWorked: songsWorked,
        notes: '',
        mixdown_id: null,
        blocks: _rmBlockTimings.map(function(t) {
            return { title: t.title, budgetMin: t.budgetMin, actualMin: Math.round(t.actualMs / 60000) };
        })
    };
    // Save to Firebase
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        try {
            await db.ref(bandPath('rehearsal_sessions/' + summary.sessionId)).set(summary);
        } catch(e) { console.warn('[RhTiming] Save failed:', e.message); }
    }

    // Show session summary screen instead of just a toast
    window._rmLastSummary = summary;
    _rmShowSessionSummary(summary);

    // Reset
    _rmBlockTimings = [];
    _rmSessionStart = 0;
}

// ── Smart Rating Assist ─────────────────────────────────────────────────
// Suggests a rating based on session signals. User confirms or adjusts.

function _rmSuggestRating(summary) {
    var score = 0;
    var reasons = [];
    var completed = (summary.songsWorked || []).length;
    var total = (summary.blocks || []).length || completed;
    var actual = summary.totalActualMin || 0;
    var budget = summary.totalBudgetMin || 0;
    var delta = budget > 0 ? actual - budget : 0;
    var overBlocks = (summary.blocks || []).filter(function(b) { return b.budgetMin > 0 && b.actualMin > b.budgetMin; });

    // 1. Completion ratio (0-30 points)
    if (total > 0) {
        var ratio = completed / total;
        if (ratio >= 0.9) { score += 30; reasons.push('Covered the full plan'); }
        else if (ratio >= 0.6) { score += 20; reasons.push('Got through most of the plan'); }
        else { score += 10; reasons.push('Covered ' + Math.round(ratio * 100) + '% of the plan'); }
    } else if (completed > 0) {
        score += 20;
    }

    // 2. Session length (0-20 points)
    if (actual >= 45) { score += 20; reasons.push(actual + ' min session'); }
    else if (actual >= 20) { score += 15; }
    else if (actual >= 10) { score += 10; }
    else { score += 5; reasons.push('Short session'); }

    // 3. Pacing vs budget (0-20 points)
    if (budget > 0) {
        if (Math.abs(delta) <= 5) { score += 20; reasons.push('Stayed on schedule'); }
        else if (delta > 15) { score += 5; reasons.push('Ran over by ' + delta + ' min'); }
        else if (delta > 0) { score += 12; }
        else { score += 15; reasons.push('Finished early'); }
    } else {
        score += 10; // no budget to compare
    }

    // 4. Few songs running over (0-15 points)
    if (overBlocks.length === 0) { score += 15; }
    else if (overBlocks.length <= 2) { score += 10; }
    else { score += 3; reasons.push(overBlocks.length + ' songs ran over'); }

    // 5. Song count bonus (0-15 points)
    if (completed >= 8) { score += 15; }
    else if (completed >= 5) { score += 10; }
    else if (completed >= 3) { score += 7; }
    else { score += 3; }

    // Map score to rating
    var suggested = 'solid';
    var label = 'Solid';
    var confidence = 'medium';
    if (score >= 75) { suggested = 'great'; label = 'Strong'; confidence = 'high'; }
    else if (score >= 50) { suggested = 'solid'; label = 'Solid'; confidence = 'medium'; }
    else { suggested = 'needs_work'; label = 'Needs Work'; confidence = score >= 35 ? 'medium' : 'low'; }

    return {
        suggested: suggested,
        label: label,
        score: score,
        confidence: confidence,
        reasons: reasons.slice(0, 2)
    };
}

// ── Session Summary Screen ──────────────────────────────────────────────
// Shown after ending rehearsal. Feels like a completion moment.

function _rmGenerateAutoSummary(summary) {
    var songs = summary.songsWorked || [];
    var actual = summary.totalActualMin || 0;
    var budget = summary.totalBudgetMin || 0;
    var delta = actual - budget;
    var overBlocks = (summary.blocks || []).filter(function(b) { return b.budgetMin > 0 && b.actualMin > b.budgetMin; });

    if (!budget) return songs.length + ' song' + (songs.length !== 1 ? 's' : '') + ' in ' + actual + ' minutes.';

    var pacing = '';
    if (Math.abs(delta) <= 3) pacing = 'Great pacing \u2014 right on target.';
    else if (delta > 10) pacing = 'Ran ' + delta + ' min over \u2014 consider tighter transitions.';
    else if (delta > 0) pacing = 'Slightly over by ' + delta + ' min \u2014 close to plan.';
    else pacing = 'Finished ' + Math.abs(delta) + ' min early \u2014 efficient session.';

    var detail = '';
    if (overBlocks.length === 1) detail = ' "' + overBlocks[0].title + '" needed extra time.';
    else if (overBlocks.length > 1) detail = ' ' + overBlocks.length + ' songs ran over budget.';

    return songs.length + ' song' + (songs.length !== 1 ? 's' : '') + ', ' + actual + ' min. ' + pacing + detail;
}

function _rmShowSessionSummary(summary) {
    var totalActual = summary.totalActualMin || 0;
    var totalBudget = summary.totalBudgetMin || 0;
    var delta = totalActual - totalBudget;
    var deltaLabel = delta === 0 ? 'Right on time!' : delta > 0 ? '+' + delta + ' min over' : Math.abs(delta) + ' min under';
    var deltaColor = Math.abs(delta) <= 3 ? '#22c55e' : delta > 0 ? (delta > 10 ? '#ef4444' : '#fbbf24') : '#60a5fa';
    var durLabel = totalActual >= 60 ? Math.floor(totalActual / 60) + 'h ' + (totalActual % 60) + 'm' : totalActual + ' min';
    var songCount = (summary.songsWorked || []).length;
    var songList = (summary.songsWorked || []).join(' \u00B7 ');
    var autoSummary = _rmGenerateAutoSummary(summary);

    var existing = document.getElementById('rmSessionSummaryOverlay');
    if (existing) existing.remove();

    // Inject animation styles
    if (!document.getElementById('rmSummaryStyles')) {
        var st = document.createElement('style');
        st.id = 'rmSummaryStyles';
        st.textContent = '@keyframes rmFadeIn{from{opacity:0;transform:scale(0.95) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}@keyframes rmCheckIn{0%{transform:scale(0)}50%{transform:scale(1.2)}100%{transform:scale(1)}}@keyframes rmSaveFlash{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 20px 8px rgba(34,197,94,0.15)}100%{box-shadow:none}}';
        document.head.appendChild(st);
    }

    var ov = document.createElement('div');
    ov.id = 'rmSessionSummaryOverlay';
    ov.setAttribute('data-testid', 'rehearsal-summary');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)';

    var html = '<div id="rmSummaryCard" style="background:linear-gradient(160deg,#1e293b,#1a2540);border:1px solid rgba(99,102,241,0.3);border-radius:18px;max-width:440px;width:100%;padding:28px 24px;color:#f1f5f9;animation:rmFadeIn 0.4s ease;max-height:90vh;overflow-y:auto">';

    // Completion header
    html += '<div style="text-align:center;margin-bottom:20px">';
    html += '<div style="width:56px;height:56px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(99,102,241,0.2));display:flex;align-items:center;justify-content:center;animation:rmCheckIn 0.5s ease 0.2s both"><span style="font-size:1.6em">\u2705</span></div>';
    html += '<div style="font-size:1.2em;font-weight:800;letter-spacing:-0.01em">Rehearsal Complete</div>';
    html += '<div style="font-size:0.75em;color:#64748b;margin-top:3px">' + new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) + '</div>';
    html += '</div>';

    // Stats row
    html += '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:18px">';
    html += '<div style="text-align:center"><div style="font-size:1.5em;font-weight:800;color:#a5b4fc">' + durLabel + '</div><div style="font-size:0.65em;color:#475569;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Duration</div></div>';
    html += '<div style="text-align:center"><div style="font-size:1.5em;font-weight:800;color:#e2e8f0">' + songCount + '</div><div style="font-size:0.65em;color:#475569;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">Songs</div></div>';
    html += '<div style="text-align:center"><div style="font-size:1.5em;font-weight:800;color:' + deltaColor + '">' + deltaLabel + '</div><div style="font-size:0.65em;color:#475569;font-weight:600;letter-spacing:0.05em;text-transform:uppercase">vs Plan</div></div>';
    html += '</div>';

    // Auto summary
    html += '<div style="font-size:0.78em;color:#94a3b8;text-align:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:14px;line-height:1.5">' + _rmEsc(autoSummary) + '</div>';

    // Songs worked
    if (songList) {
        html += '<div style="font-size:0.72em;color:#64748b;text-align:center;margin-bottom:14px;max-height:48px;overflow-y:auto">' + _rmEsc(songList) + '</div>';
    }

    // Smart Rating Assist
    var _sra = _rmSuggestRating(summary);
    _rmSummaryRating = _sra.suggested;
    window._rmLastSuggestedRating = _sra.suggested; // stored for analytics
    var _sraColors = { great: '#22c55e', solid: '#a5b4fc', needs_work: '#fbbf24' };
    var _sraIcons = { great: '\uD83D\uDD25', solid: '\uD83D\uDCAA', needs_work: '\uD83D\uDD27' };
    html += '<div style="margin-bottom:14px">';
    // Suggestion card
    html += '<div style="text-align:center;padding:12px;background:rgba(' + (_sra.suggested === 'great' ? '34,197,94' : _sra.suggested === 'solid' ? '99,102,241' : '245,158,11') + ',0.06);border:1px solid rgba(' + (_sra.suggested === 'great' ? '34,197,94' : _sra.suggested === 'solid' ? '99,102,241' : '245,158,11') + ',0.2);border-radius:12px;margin-bottom:8px">';
    html += '<div style="font-size:0.88em;font-weight:700;color:' + (_sraColors[_sra.suggested] || '#a5b4fc') + '">' + _sraIcons[_sra.suggested] + ' That felt like a ' + _sra.label + ' rehearsal</div>';
    if (_sra.reasons.length) html += '<div style="font-size:0.68em;color:#64748b;margin-top:3px">' + _sra.reasons.join(' \u00b7 ') + '</div>';
    html += '</div>';
    // Agree / Adjust buttons
    html += '<div style="display:flex;gap:8px;justify-content:center">';
    html += '<button onclick="_rmAcceptSuggested()" id="rmAgreeBtn" style="flex:2;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,' + (_sraColors[_sra.suggested] || '#6366f1') + ',' + (_sra.suggested === 'great' ? '#16a34a' : _sra.suggested === 'solid' ? '#4f46e5' : '#d97706') + ');color:white;cursor:pointer;font-weight:800;font-size:0.88em;transition:all 0.15s">\uD83D\uDC4D Agree</button>';
    html += '<button onclick="_rmShowManualRating()" id="rmAdjustBtn" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:none;color:#94a3b8;cursor:pointer;font-weight:600;font-size:0.82em">\uD83D\uDC4E Adjust</button>';
    html += '</div>';
    // Hidden manual rating (shown on Adjust)
    html += '<div id="rmManualRating" style="display:none;margin-top:8px">';
    html += '<div style="display:flex;gap:8px;justify-content:center">';
    html += '<button onclick="_rmSetRating(\'great\')" id="rmRate_great" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(34,197,94,0.3);background:none;color:#86efac;cursor:pointer;font-weight:700;font-size:0.82em;transition:all 0.15s">\uD83D\uDD25 Great</button>';
    html += '<button onclick="_rmSetRating(\'solid\')" id="rmRate_solid" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(99,102,241,0.3);background:none;color:#a5b4fc;cursor:pointer;font-weight:700;font-size:0.82em;transition:all 0.15s">\uD83D\uDD27 Solid</button>';
    html += '<button onclick="_rmSetRating(\'needs_work\')" id="rmRate_needs_work" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(245,158,11,0.3);background:none;color:#fbbf24;cursor:pointer;font-weight:700;font-size:0.82em;transition:all 0.15s">\uD83D\uDD27 Needs Work</button>';
    html += '</div></div>';
    html += '</div>';

    // Notes input
    html += '<div style="margin-bottom:12px">';
    html += '<textarea id="rmSummaryNotes" placeholder="What went well? What needs work next time?" style="width:100%;min-height:52px;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.2);color:#f1f5f9;font-size:0.82em;resize:vertical;box-sizing:border-box;font-family:inherit"></textarea>';
    html += '</div>';

    // Mixdown attachment
    html += '<details style="margin-bottom:14px"><summary style="font-size:0.75em;font-weight:600;color:#475569;cursor:pointer">\uD83C\uDFA4 Attach Rehearsal Recording</summary>';
    html += '<div style="padding:8px 0">';
    html += '<div style="display:flex;gap:6px">';
    html += '<input id="rmSummaryDriveUrl" placeholder="Paste Google Drive or audio link" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:#f1f5f9;font-size:0.82em;min-width:0">';
    html += '<button onclick="_rmSummaryUpload()" style="padding:8px 12px;border-radius:8px;font-size:0.75em;font-weight:600;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.06);color:#fbbf24;cursor:pointer;white-space:nowrap">\uD83D\uDCE4 Upload</button>';
    html += '</div>';
    html += '<input type="file" id="rmSummaryFileInput" accept="audio/*,.mp3,.m4a,.wav" style="display:none" onchange="_rmSummaryFileSelected(this)">';
    html += '<div id="rmSummaryFileName" style="font-size:0.72em;color:#818cf8;margin-top:3px"></div>';
    html += '<div id="rmSummaryDriveStatus" style="font-size:0.68em;margin-top:3px"></div>';
    html += '</div></details>';

    // Save button
    html += '<button id="rmSaveBtn" onclick="_rmSummarySave(\'' + summary.sessionId + '\')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.95em;cursor:pointer;transition:all 0.2s">\uD83D\uDCBE Save Session</button>';
    html += '<button onclick="document.getElementById(\'rmSessionSummaryOverlay\').remove()" style="width:100%;margin-top:6px;padding:8px;border-radius:8px;border:none;background:none;color:#475569;cursor:pointer;font-size:0.78em">Skip for now</button>';

    html += '</div>';
    ov.innerHTML = html;
    document.body.appendChild(ov);

    // Auto-confirm rating after 5 seconds if user doesn't interact
    // This reduces friction to near-zero — user can just wait and it confirms
    if (_rmAutoConfirmTimer) clearTimeout(_rmAutoConfirmTimer);
    _rmAutoConfirmTimer = setTimeout(function() {
        if (_rmSuggestionAccepted === null) {
            _rmAcceptSuggested();
        }
    }, 3000); // 3s — fast enough to feel automatic, long enough to override
}

var _rmSummaryFile = null;
var _rmSummaryRating = null;
var _rmSuggestionAccepted = null;
var _rmAutoConfirmTimer = null;

window._rmAcceptSuggested = function() {
    if (_rmAutoConfirmTimer) { clearTimeout(_rmAutoConfirmTimer); _rmAutoConfirmTimer = null; }
    _rmSuggestionAccepted = true;
    var btn = document.getElementById('rmAgreeBtn');
    if (btn) { btn.textContent = '\u2705 Confirmed'; btn.style.opacity = '0.7'; btn.disabled = true; }
    var adj = document.getElementById('rmAdjustBtn');
    if (adj) adj.style.display = 'none';
    showToast('\uD83D\uDC4D Rating confirmed');
};

window._rmShowManualRating = function() {
    _rmSuggestionAccepted = false;
    var manual = document.getElementById('rmManualRating');
    if (manual) manual.style.display = 'block';
    var agree = document.getElementById('rmAgreeBtn');
    if (agree) agree.style.display = 'none';
    var adjust = document.getElementById('rmAdjustBtn');
    if (adjust) adjust.style.display = 'none';
};

window._rmSetRating = function(rating) {
    _rmSummaryRating = rating;
    ['great', 'solid', 'needs_work'].forEach(function(r) {
        var btn = document.getElementById('rmRate_' + r);
        if (!btn) return;
        if (r === rating) {
            btn.style.background = r === 'great' ? 'rgba(34,197,94,0.15)' : r === 'solid' ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)';
            btn.style.transform = 'scale(1.05)';
            btn.style.borderWidth = '2px';
        } else {
            btn.style.background = 'none';
            btn.style.transform = 'scale(1)';
            btn.style.borderWidth = '1px';
        }
    });
};

window._rmSummaryUpload = function() {
    var fi = document.getElementById('rmSummaryFileInput');
    if (fi) fi.click();
};

window._rmSummaryFileSelected = function(input) {
    if (!input.files || !input.files.length) return;
    _rmSummaryFile = input.files[0];
    var el = document.getElementById('rmSummaryFileName');
    if (el) el.textContent = _rmSummaryFile.name + ' (' + Math.round(_rmSummaryFile.size / 1048576) + ' MB)';
};

window._rmSummarySave = async function(sessionId) {
    var notes = (document.getElementById('rmSummaryNotes') || {}).value || '';
    var driveUrl = (document.getElementById('rmSummaryDriveUrl') || {}).value || '';
    var audioUrl = '';

    // Detect + validate Drive link
    if (driveUrl) {
        var statusEl = document.getElementById('rmSummaryDriveStatus');
        var isDrive = driveUrl.indexOf('drive.google.com') >= 0 || driveUrl.indexOf('docs.google.com') >= 0;
        if (isDrive && statusEl) statusEl.innerHTML = '<span style="color:#22c55e">\u2705 Google Drive link detected</span>';
        else if (statusEl) statusEl.innerHTML = '<span style="color:#94a3b8">Direct audio link</span>';
    }

    // Handle file upload
    if (_rmSummaryFile) {
        audioUrl = URL.createObjectURL(_rmSummaryFile);
    }

    // Create mixdown record if we have audio/drive
    var mixdownId = null;
    if (audioUrl || driveUrl) {
        mixdownId = 'mx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        var mxData = {
            title: 'Rehearsal ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rehearsal_date: new Date().toISOString().split('T')[0],
            audio_url: audioUrl,
            drive_url: driveUrl,
            notes: notes ? 'From session: ' + notes.substring(0, 100) : '',
            linked_session_id: sessionId,
            created_at: new Date().toISOString(),
            created_by: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
        };
        try {
            var all = await loadBandDataFromDrive('_band', 'rehearsal_mixdowns') || {};
            all[mixdownId] = mxData;
            await saveBandDataToDrive('_band', 'rehearsal_mixdowns', all);
        } catch(e) { console.warn('[Session] Mixdown save failed:', e); }
    }

    // Generate summary line
    var autoSummary = _rmGenerateAutoSummary(window._rmLastSummary || {});

    // Update session
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
        var updates = {};
        if (notes) updates.notes = notes;
        if (mixdownId) updates.mixdown_id = mixdownId;
        if (_rmSummaryRating) updates.rating = _rmSummaryRating;
        if (_rmSuggestionAccepted !== null) updates.ratingAcceptedSuggestion = _rmSuggestionAccepted;
        // Store the original suggestion for analytics (compare suggested vs final)
        if (window._rmLastSuggestedRating) updates.ratingSuggested = window._rmLastSuggestedRating;
        if (autoSummary) updates.summary = autoSummary;
        if (Object.keys(updates).length) {
            try { await db.ref(bandPath('rehearsal_sessions/' + sessionId)).update(updates); } catch(e) {}
        }
    }

    // Save animation
    var saveBtn = document.getElementById('rmSaveBtn');
    if (saveBtn) {
        saveBtn.textContent = '\u2705 Saved!';
        saveBtn.style.animation = 'rmSaveFlash 0.6s ease';
    }

    _rmSummaryFile = null;
    _rmSummaryRating = null;
    _rmSuggestionAccepted = null;

    // Brief pause to show "Saved!", then transition to Reveal Screen
    setTimeout(function() {
        var ov = document.getElementById('rmSessionSummaryOverlay');
        if (ov) ov.remove();
        // Show Rehearsal Reveal if Product Brain has insight
        _rmShowRevealScreen();
    }, 800);
};

// ── Rehearsal Reveal Screen ──────────────────────────────────────────────
// The most important screen in the product.
// Shows: what happened, what matters, what to do next.
// Data source: GLProductBrain ONLY.

function _rmShowRevealScreen() {
    var insight = null;
    if (typeof GLProductBrain !== 'undefined') {
        insight = GLProductBrain.getInsightFromSession('latest');
    }
    // Safe mode: if no Product Brain insight, show a clean confirmation (never blank)
    if (!insight || insight._empty) {
        var safeOv = document.createElement('div');
        safeOv.id = 'rmRevealOverlay';
        safeOv.setAttribute('data-testid', 'rehearsal-reveal');
        safeOv.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px)';
        safeOv.innerHTML = '<div style="max-width:400px;width:100%;text-align:center;animation:rmRevealIn 0.25s ease">'
            + '<div style="width:56px;height:56px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,rgba(34,197,94,0.2),rgba(99,102,241,0.2));display:flex;align-items:center;justify-content:center"><span style="font-size:1.6em">\u2705</span></div>'
            + '<div style="font-size:1.3em;font-weight:800;color:#f1f5f9;margin-bottom:8px">Session Saved</div>'
            + '<div style="font-size:0.85em;color:#94a3b8;margin-bottom:24px">Your scorecard is tracking this rehearsal.</div>'
            + '<button onclick="document.getElementById(\'rmRevealOverlay\').remove();if(typeof showPage===\'function\')showPage(\'home\')" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.92em;cursor:pointer">Done \u2192 Home</button>'
            + '</div>';
        document.body.appendChild(safeOv);
        if (typeof GLAvatarUI !== 'undefined' && GLAvatarUI.checkForTips) {
            setTimeout(function() { GLAvatarUI.checkForTips(); }, 1500);
        }
        return;
    }

    // Inject animation styles
    if (!document.getElementById('rmRevealStyles')) {
        var st = document.createElement('style');
        st.id = 'rmRevealStyles';
        st.textContent = '@keyframes rmRevealIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes rmRevealStagger{from{opacity:0;transform:translateX(-4px)}to{opacity:1;transform:translateX(0)}}';
        document.head.appendChild(st);
    }

    var tc = insight.ui.topCard;
    var coaching = insight.coaching || {};
    var hasIssue = tc.biggestIssue && tc.biggestIssue.length > 0;

    // Check for cross-session progress signal
    var progressSignal = null;
    if (typeof RehearsalStoryEngine !== 'undefined' && RehearsalStoryEngine.buildProgressSignal && insight.story) {
        progressSignal = RehearsalStoryEngine.buildProgressSignal(insight.story);
    }

    // Build HTML — headline, optional progress, ONE insight card, next action
    var html = '<div style="max-width:440px;width:100%;animation:rmRevealIn 0.25s ease">';

    // ── Headline ──
    html += '<div style="text-align:center;padding:32px 24px ' + (progressSignal ? '10px' : '20px') + '">';
    html += '<div style="font-size:1.6em;font-weight:900;color:#f1f5f9;line-height:1.2;letter-spacing:-0.02em">' + _rmEsc(tc.headline) + '</div>';
    html += '</div>';

    // ── Attribution Signal (what changed + why) ──
    if (progressSignal) {
        var sigColors = { improvement: '#22c55e', regression: '#f87171', steady: '#94a3b8' };
        var sigIcons = { improvement: '\u2191', regression: '\u2193', steady: '\u2192' };
        var sigBg = { improvement: '34,197,94', regression: '248,113,113', steady: '148,163,184' };
        var sc = sigColors[progressSignal.type] || '#94a3b8';
        var si = sigIcons[progressSignal.type] || '\u2192';
        var sb = sigBg[progressSignal.type] || '148,163,184';

        html += '<div style="padding:0 24px 16px">';
        html += '<div style="padding:10px 14px;background:rgba(' + sb + ',0.06);border:1px solid rgba(' + sb + ',0.15);border-radius:12px">';
        // What changed
        html += '<div style="font-size:0.85em;font-weight:700;color:' + sc + ';margin-bottom:4px">' + si + ' ' + _rmEsc(progressSignal.text) + '</div>';
        // Why it changed
        if (progressSignal.whyItChanged) {
            html += '<div style="font-size:0.75em;color:#94a3b8;line-height:1.4">' + _rmEsc(progressSignal.whyItChanged) + '</div>';
        }
        html += '</div></div>';
    }

    // ── ONE insight card with "why this matters" ──
    html += '<div style="padding:0 24px 20px">';
    if (hasIssue) {
        html += '<div style="padding:14px 16px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:12px">';
        html += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px">';
        html += '<span style="font-size:1.1em;flex-shrink:0">\u26A0\uFE0F</span>';
        html += '<div style="font-size:0.88em;color:#fbbf24;line-height:1.4;font-weight:600">' + _rmEsc(tc.biggestIssue) + '</div>';
        html += '</div>';
        html += '<div style="font-size:0.68em;color:#64748b;padding-left:28px">Why: fixing this one thing will save the most time next rehearsal.</div>';
        html += '</div>';
    } else if (tc.strongestMoment) {
        html += '<div style="padding:14px 16px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:12px">';
        html += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:6px">';
        html += '<span style="font-size:1.1em;flex-shrink:0">\u2B50</span>';
        html += '<div style="font-size:0.88em;color:#86efac;line-height:1.4;font-weight:600">' + _rmEsc(tc.strongestMoment) + '</div>';
        html += '</div>';
        html += '<div style="font-size:0.68em;color:#64748b;padding-left:28px">This is what gig-ready sounds like. Build on it.</div>';
        html += '</div>';
    }
    // Confidence + data basis
    var confLabel = insight.confidence && insight.confidence.segmentation === 'high' ? 'High confidence' : insight.confidence && insight.confidence.segmentation === 'medium' ? 'Moderate confidence' : '';
    var dataMin = coaching.totalMinutes ? 'Based on ' + coaching.totalMinutes + ' min of data' : '';
    if (confLabel || dataMin) {
        html += '<div style="font-size:0.6em;color:#475569;text-align:right;margin-top:4px">' + [confLabel, dataMin].filter(Boolean).join(' \u00b7 ') + '</div>';
    }
    html += '</div>';

    // ── Next Action ──
    if (coaching.nextAction) {
        html += '<div style="padding:0 24px 28px">';
        html += '<div style="padding:14px 16px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:12px;text-align:center">';
        html += '<div style="font-size:0.6em;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Next Focus</div>';
        html += '<div style="font-size:0.9em;font-weight:700;color:#a5b4fc;line-height:1.4">' + _rmEsc(coaching.nextAction) + '</div>';
        html += '</div>';
        html += '</div>';
    }

    // ── Auto Chart Note (default YES — saved automatically, user can undo) ──
    var _revealProbSong = coaching.problematicSongs && coaching.problematicSongs.length ? coaching.problematicSongs[0].song : null;
    var _revealNoteText = hasIssue ? tc.biggestIssue : (coaching.nextAction || '');
    if (_revealProbSong && _revealNoteText && typeof ChartSystem !== 'undefined') {
        // Auto-save the note immediately (default YES)
        window._rmRevealChartSong = _revealProbSong;
        window._rmRevealChartNote = _revealNoteText;
        window._rmRevealChartSaved = false;
        setTimeout(function() {
            ChartSystem.addOverlayNote(_revealProbSong, _revealNoteText).then(function(saved) {
                window._rmRevealChartSaved = saved;
                if (saved && typeof logActivity === 'function') logActivity('reveal_chart_note', { song: _revealProbSong });
                var statusEl = document.getElementById('rmChartAutoStatus');
                if (statusEl) statusEl.textContent = saved ? '\u2705 Added to chart' : '';
            });
        }, 500);
        // Show inline confirmation with undo
        html += '<div style="padding:0 24px 8px">';
        html += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.12);border-radius:10px;font-size:0.78em">';
        html += '<span style="color:#fbbf24">\uD83D\uDCCC</span>';
        html += '<span style="flex:1;color:var(--text-dim,#94a3b8)">Adding note to <strong style="color:#fbbf24">' + _rmEsc(_revealProbSong) + '</strong>\u2019s chart</span>';
        html += '<span id="rmChartAutoStatus" style="color:#64748b;font-size:0.9em"></span>';
        html += '<button onclick="_rmRevealUndoChart()" style="background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;padding:3px 8px;border-radius:5px;cursor:pointer;font-size:0.85em">Undo</button>';
        html += '</div></div>';
    }

    // ── Done + Next Rehearsal ──
    html += '<div style="padding:0 24px 16px">';
    html += '<button onclick="document.getElementById(\'rmRevealOverlay\').remove();if(typeof showPage===\'function\')showPage(\'home\');setTimeout(function(){if(typeof GLPlans!==\'undefined\'&&GLPlans.shouldShowValueSignal())GLPlans.showValueSignalPrompt();},2000)" style="width:100%;padding:14px;border-radius:12px;border:none;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;font-weight:800;font-size:0.95em;cursor:pointer">Done \u2192 Home</button>';
    html += '</div>';
    // Return loop — nudge to schedule next rehearsal
    html += '<div style="padding:0 24px 24px;text-align:center">';
    html += '<button onclick="document.getElementById(\'rmRevealOverlay\').remove();showPage(\'rehearsal\');setTimeout(function(){if(typeof rhOpenCreateModal===\'function\')rhOpenCreateModal();},1200)" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.78em;text-decoration:underline">Schedule next rehearsal \u2192</button>';
    html += '</div>';

    html += '</div>';

    // Create overlay
    var ov = document.createElement('div');
    ov.id = 'rmRevealOverlay';
    ov.setAttribute('data-testid', 'rehearsal-reveal');
    ov.style.cssText = 'position:fixed;inset:0;z-index:10002;background:rgba(0,0,0,0.92);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    // Track reveal viewed
    if (typeof logActivity === 'function') logActivity('reveal_viewed');
    ov.innerHTML = html;
    document.body.appendChild(ov);

    // Speak the headline via Voice Coach
    setTimeout(function() {
        if (typeof GLVoiceCoach !== 'undefined' && GLVoiceCoach.isVoiceEnabled()) {
            GLVoiceCoach.speakInsight(insight);
        }
        if (typeof GLAvatarUI !== 'undefined' && GLAvatarUI.checkForTips) GLAvatarUI.checkForTips();
    }, 800);
}

window._rmRevealUndoChart = async function() {
    var song = window._rmRevealChartSong;
    if (!song || typeof ChartSystem === 'undefined') return;
    // Remove the last note (the one we just auto-added)
    var notes = await ChartSystem.loadOverlayNotes(song);
    if (notes.length > 0) {
        await ChartSystem.removeOverlayNote(song, notes.length - 1);
        if (typeof showToast === 'function') showToast('Chart note removed');
        var statusEl = document.getElementById('rmChartAutoStatus');
        if (statusEl) statusEl.textContent = 'Undone';
    }
};

function _rmEsc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function rmAdjustFont(delta) {
    rmFontSize = Math.min(30, Math.max(10, rmFontSize + delta * 2));
    document.getElementById('rmChartText').style.fontSize = rmFontSize + 'px';
}
function rmAutoFitFont() {
    const isTablet = window.innerWidth >= 768;
    if (!isTablet) { rmFontSize = 16; document.getElementById('rmChartText').style.fontSize = rmFontSize + 'px'; return; }
    const panel = document.getElementById('rmPanelChart'), pre = document.getElementById('rmChartText');
    if (!panel || !pre) return;
    const availH = panel.clientHeight - 80;
    let lo = 10, hi = 26, best = 14;
    for (let i = 0; i < 8; i++) { const mid = Math.floor((lo+hi)/2); pre.style.fontSize = mid+'px'; if (pre.scrollHeight <= availH) { best = mid; lo = mid+1; } else { hi = mid-1; } }
    rmFontSize = best; pre.style.fontSize = rmFontSize + 'px';
}
function rmSearchUG() {
    const song = rmQueue[rmIndex]; if (!song) return;
    const band = _rmFullBandName(song.band) || 'Grateful Dead';
    const q = encodeURIComponent(song.title + ' ' + band);
    window.open('https://www.ultimate-guitar.com/search.php?search_type=title&value=' + q, '_blank');
    // Show paste-back banner when user returns
    _rmShowPasteBanner(song.title);
}

// Persistent paste-back banner — appears after opening UG, survives tab-switch
function _rmShowPasteBanner(songTitle) {
    var existing = document.getElementById('rmPasteBanner');
    if (existing) existing.remove();
    var banner = document.createElement('div');
    banner.id = 'rmPasteBanner';
    banner.style.cssText = 'position:sticky;top:0;z-index:10;padding:10px 14px;background:rgba(251,191,36,0.12);border-bottom:2px solid rgba(251,191,36,0.3);display:flex;align-items:center;gap:10px;flex-wrap:wrap';
    var safeSong = songTitle.replace(/'/g, "\\'");
    banner.innerHTML = '<span style="font-size:0.82em;color:#fbbf24;font-weight:700;flex:1">📋 Found a chart? Paste it here to replace the current one.</span>'
        + '<button onclick="_rmOpenPasteFromBanner(\'' + safeSong + '\')" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.12);color:#86efac;font-weight:700;font-size:0.82em;cursor:pointer;white-space:nowrap;min-height:40px">Paste Chart</button>'
        + '<button onclick="document.getElementById(\'rmPasteBanner\').remove()" style="background:none;border:none;color:rgba(255,255,255,0.3);cursor:pointer;font-size:1.1em;padding:4px 8px">✕</button>';
    // Insert at top of chart panel, before sticky bar
    var panel = document.getElementById('rmPanelChart');
    if (panel) panel.insertBefore(banner, panel.firstChild);
}

// Start a fresh chart — empty textarea with section template, ready for typing or pasting
function _rmStartFreshChart(songTitle) {
    rmEditing = true;
    var template = '[Intro]\n\n\n[Verse 1]\n\n\n[Chorus]\n\n\n[Verse 2]\n\n\n[Chorus]\n\n\n[Solo]\n\n\n[Outro]\n';
    var ta = document.getElementById('rmEditTextarea');
    if (ta) {
        ta.value = '';
        ta.placeholder = 'Type or paste your chart here.\n\nTip: Use [Section] headers like [Verse], [Chorus], [Solo]\nfor automatic structure detection.';
    }
    document.getElementById('rmChartText').style.display = 'none';
    document.getElementById('rmNoChart').classList.add('hidden');
    document.getElementById('rmEditPanel').classList.remove('hidden');
    document.getElementById('rmEditToggle').textContent = '✕ Cancel';
    // Ask: start from template or blank?
    if (ta) {
        ta.value = '';
        ta.focus();
        // Show a small hint above textarea
        var hint = document.createElement('div');
        hint.id = 'rmChartTemplateHint';
        hint.style.cssText = 'padding:6px 10px;font-size:0.72em;color:var(--text-dim);display:flex;align-items:center;gap:8px;flex-wrap:wrap';
        hint.innerHTML = '<span>Start from scratch or</span>'
            + '<button onclick="document.getElementById(\'rmEditTextarea\').value=\'' + template.replace(/\n/g, '\\n') + '\';document.getElementById(\'rmEditTextarea\').focus();this.parentElement.remove()" style="font-size:1em;padding:2px 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer">Load section template</button>';
        var editPanel = document.getElementById('rmEditPanel');
        if (editPanel) editPanel.insertBefore(hint, editPanel.firstChild);
    }
}

// Open edit mode pre-focused for paste, from the banner
function _rmOpenPasteFromBanner(songTitle) {
    var banner = document.getElementById('rmPasteBanner');
    if (banner) banner.remove();
    // Open edit mode but clear the textarea for fresh paste
    rmEditing = true;
    document.getElementById('rmChartText').style.display = 'none';
    document.getElementById('rmNoChart').classList.add('hidden');
    document.getElementById('rmEditPanel').classList.remove('hidden');
    document.getElementById('rmEditToggle').textContent = '✕ Cancel';
    var ta = document.getElementById('rmEditTextarea');
    if (ta) {
        ta.value = '';
        ta.placeholder = 'Paste the chart text here — then hit Save';
        ta.focus();
    }
}

// ── Auto-Scroll ──────────────────────────────────────────────────────────────
let rmScrollTimer = null;
let rmScrollSpeedLevel = parseInt(localStorage.getItem('rm_scroll_speed') || '3');
function rmToggleAutoScroll() {
    const btn = document.getElementById('rmScrollBtn');
    // show/hide scroll speed controls
    if (rmScrollTimer) {
        clearInterval(rmScrollTimer); rmScrollTimer = null;
        _rmScrollSyncProgrammatic = false; // re-enable scroll sync
        btn.textContent = '📜 Scroll'; btn.style.background = ''; btn.style.color = '';
        document.getElementById('rmScrollMinus')?.classList.add('hidden');document.getElementById('rmScrollSpeedVal')?.classList.add('hidden');document.getElementById('rmScrollPlus')?.classList.add('hidden');
        return;
    }
    btn.textContent = '⏹ Stop'; btn.style.background = '#ef4444'; btn.style.color = 'white';
    document.getElementById('rmScrollMinus')?.classList.remove('hidden');document.getElementById('rmScrollSpeedVal')?.classList.remove('hidden');document.getElementById('rmScrollPlus')?.classList.remove('hidden');
    rmStartScrolling();
}
function rmStartScrolling() {
    clearInterval(rmScrollTimer);
    const panel = document.getElementById('rmPanelChart');
    if (!panel) return;
    const speeds = [0.8, 1.5, 2.5, 4.0, 6.0];
    const pxPerTick = speeds[Math.min(rmScrollSpeedLevel - 1, 4)];
    // Suppress scroll sync during auto-scroll to prevent fight
    _rmScrollSyncProgrammatic = true;
    rmScrollTimer = setInterval(() => {
        panel.scrollTop += pxPerTick;
        if (panel.scrollTop >= panel.scrollHeight - panel.clientHeight - 5) rmToggleAutoScroll();
    }, 30);
}
function rmScrollSpeed(delta) {
    rmScrollSpeedLevel = Math.max(1, Math.min(5, rmScrollSpeedLevel + delta));
    localStorage.setItem("rm_scroll_speed", rmScrollSpeedLevel);
    document.getElementById('rmScrollSpeedVal').textContent = rmScrollSpeedLevel;
    if (rmScrollTimer) rmStartScrolling();
}

// ── Toolbar Toggle (🙈) ─────────────────────────────────────────────────────
let rmToolbarHidden = false;
function rmToggleToolbar() {
    rmToolbarHidden = !rmToolbarHidden;
    const bar = document.getElementById('rmStickyBar');
    const btn = document.getElementById('rmMonkeyBtn');
    if (bar) bar.style.display = rmToolbarHidden ? 'none' : 'flex';
    if (btn) btn.textContent = rmToolbarHidden ? '🐵' : '🙈';
}

function rmToggleEdit() { if (rmEditing) rmCancelEdit(); else rmStartEdit(); }
function rmStartEdit() {
    rmEditing = true;
    document.getElementById('rmEditTextarea').value = document.getElementById('rmChartText').textContent;
    document.getElementById('rmChartText').style.display = 'none';
    document.getElementById('rmNoChart').classList.add('hidden');
    document.getElementById('rmEditPanel').classList.remove('hidden');
    document.getElementById('rmEditToggle').textContent = '✕ Cancel';
    document.getElementById('rmEditTextarea').focus();
}
function rmCancelEdit(silent) {
    rmEditing = false;
    document.getElementById('rmEditPanel')?.classList.add('hidden');
    const toggle = document.getElementById('rmEditToggle');
    if (toggle) toggle.textContent = '✏️ Edit';
    if (!silent) {
        const crib = document.getElementById('rmChartText').textContent;
        if (crib.trim()) document.getElementById('rmChartText').style.display = 'block';
        else document.getElementById('rmNoChart').classList.remove('hidden');
    }
}
// After chart save: detect [Header] markers and auto-derive song_structure
function _rmAutoStructureAfterSave(songTitle, chartText) {
    if (!chartText || !songTitle) return;
    if (typeof deriveStructureFromChart !== 'function') return;
    if (typeof GLStore === 'undefined' || !GLStore.saveSongData || !GLStore.loadFieldMeta) return;
    // Don't overwrite existing structure
    GLStore.loadFieldMeta(songTitle, 'song_structure').then(function(existing) {
        if (existing && existing.sections && existing.sections.length > 0) return; // already has structure
        var derived = deriveStructureFromChart(chartText);
        if (derived.length > 0) {
            // Auto-save — no confirmation needed, structure is just derived from what they pasted
            var who = (typeof getCurrentMemberKey === 'function' && getCurrentMemberKey()) || 'unknown';
            GLStore.saveSongData(songTitle, 'song_structure', { sections: derived, updatedBy: who, updatedAt: new Date().toISOString() });
            showToast(derived.length + ' sections detected — structure saved');
            // Refresh timeline if visible
            _rmLoadBandNotesStrip(songTitle);
        } else {
            // No headers found — subtle warning
            _rmShowNoHeadersHint();
        }
    }).catch(function() {});
}

function _rmShowNoHeadersHint() {
    var existing = document.getElementById('rmNoHeadersHint');
    if (existing) existing.remove();
    var hint = document.createElement('div');
    hint.id = 'rmNoHeadersHint';
    hint.style.cssText = 'padding:6px 12px;font-size:0.72em;color:#fbbf24;background:rgba(251,191,36,0.06);border-bottom:1px solid rgba(251,191,36,0.12);display:flex;align-items:center;gap:6px';
    hint.innerHTML = '<span>⚠️ No [Section] headers found in chart.</span>'
        + '<span style="color:var(--text-dim)">Add headers like [Verse], [Chorus], [Solo] for automatic structure.</span>'
        + '<button onclick="this.parentElement.remove()" style="margin-left:auto;background:none;border:none;color:rgba(255,255,255,0.2);cursor:pointer;padding:2px 6px">✕</button>';
    var chartEl = document.getElementById('rmChartText');
    if (chartEl && chartEl.parentElement) chartEl.parentElement.insertBefore(hint, chartEl);
    // Auto-dismiss after 8 seconds
    setTimeout(function() { var h = document.getElementById('rmNoHeadersHint'); if (h) h.remove(); }, 8000);
}

async function rmSaveChart() {
    const song = rmQueue[rmIndex];
    const text = document.getElementById('rmEditTextarea').value.trim();
    try {
        if (typeof GLStore !== 'undefined' && GLStore.saveSongData) {
            await GLStore.saveSongData(song.title, 'chart', text ? {text: text} : null);
        } else {
            await saveBandDataToDrive(song.title, 'chart', text ? {text: text} : null);
        }
        rmOriginalChart = text; document.getElementById('rmChartText').textContent = text;
        // Invalidate cache so next visit picks up the edit
        if (_rmCache[song.title]) _rmCache[song.title].chart = text || '';
        rmCancelEdit();
        if (text) { document.getElementById('rmChartText').style.display = 'block'; document.getElementById('rmNoChart').classList.add('hidden'); rmAutoFitFont(); }
        else { document.getElementById('rmChartText').style.display = 'none'; document.getElementById('rmNoChart').classList.remove('hidden'); }
        showToast('✅ Chart saved!');
        // Auto-derive structure from section headers
        _rmAutoStructureAfterSave(song.title, text);
        // Chart queue: auto-advance to next missing song
        if (_rmChartQueueMode) {
            _rmChartQueueDone++;
            rmIndex++;
            if (rmIndex < rmQueue.length) {
                setTimeout(function() { rmLoadSong(); setTimeout(_rmChartQueueLoadCurrent, 300); }, 200);
            } else {
                _rmChartQueueFinish();
            }
            return;
        }
    } catch(e) { showToast('❌ Save failed — are you signed in?'); }
}

let rmTransposeSemitones = 0;
let rmOriginalChart = '';
let rmBrainActive = false;
let rmBrainPct = 100;
let rmCountOffTimer = null;
let rmWakeLock = null;
let rmSongBpm = 120;
let rmSongKey = '';
const RM_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const RM_NOTE_RE = /\b([A-G][#b]?)(m|min|maj|dim|aug|sus[24]?|add\d|7|9|11|13|\/[A-G][#b]?)?\b/g;

// ── Transpose ────────────────────────────────────────────────────────────────
function rmTranspose(delta) {
    rmTransposeSemitones = ((rmTransposeSemitones + delta) % 12 + 12) % 12;
    // Save preference per song
    const song = rmQueue[rmIndex];
    if (song) localStorage.setItem('rm_transpose_' + song.title, rmTransposeSemitones);
    rmApplyTranspose();
}
function rmApplyTranspose() {
    if (!rmOriginalChart) return;
    if (rmTransposeSemitones === 0) {
        document.getElementById('rmChartText').textContent = rmOriginalChart;
    } else {
        const transposed = rmOriginalChart.replace(RM_NOTE_RE, (match, root, suffix) => {
            let idx = RM_NOTES.indexOf(root);
            if (root.length === 2 && root[1] === 'b') {
                idx = RM_NOTES.indexOf(root[0]) - 1;
                if (idx < 0) idx = 11;
            }
            if (idx === -1) return match;
            const newIdx = (idx + rmTransposeSemitones) % 12;
            return RM_NOTES[newIdx] + (suffix || '');
        });
        document.getElementById('rmChartText').textContent = transposed;
    }
    // Update key display
    if (rmSongKey) {
        let keyRoot = rmSongKey.match(/^[A-G][#b]?/)?.[0] || 'C';
        let keyIdx = RM_NOTES.indexOf(keyRoot);
        if (keyRoot.length === 2 && keyRoot[1] === 'b') keyIdx = (RM_NOTES.indexOf(keyRoot[0]) - 1 + 12) % 12;
        if (keyIdx >= 0) {
            const newKey = RM_NOTES[(keyIdx + rmTransposeSemitones) % 12];
            const suffix = rmSongKey.replace(/^[A-G][#b]?/, '');
            document.getElementById('rmTransposeKey').textContent = newKey + suffix;
        }
    } else {
        document.getElementById('rmTransposeKey').textContent = rmTransposeSemitones === 0 ? '—' : '+' + rmTransposeSemitones;
    }
    if (rmBrainActive) rmApplyBrainTrainer();
}

// ── BPM Count Off ────────────────────────────────────────────────────────────
// Metro modes: 0=continuous, 1-4=count-in measures then stop
let rmMetroMode = 2; // default: 2-bar count-in // 0=infinite, 1-4=measures
function rmCycleMetroMode() {
    rmMetroMode = (rmMetroMode + 1) % 5; // 0,1,2,3,4
    const btn = document.getElementById('rmMetroMeasures');
    const labels = ['∞', '1 bar', '2 bars', '3 bars', '4 bars'];
    if (btn) btn.textContent = labels[rmMetroMode];
}
function rmStartCountOff() {
    if (rmCountOffTimer) { rmStopCountOff(); return; }
    const btn = document.getElementById('rmCountOffBtn');
    const measBtn = document.getElementById('rmMetroMeasures');
    const bpm = rmSongBpm || 120;
    const interval = 60000 / bpm;
    let beat = 0;
    const maxBeats = rmMetroMode === 0 ? Infinity : rmMetroMode * 4;
    btn.textContent = '⏹ Stop';
    btn.style.background = '#ef4444';
    btn.style.color = 'white';
    if (measBtn) measBtn.classList.remove('hidden');
    // Audio context for click
    let audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    function tick() {
        beat++;
        const beatInMeasure = ((beat - 1) % 4) + 1;
        btn.textContent = beatInMeasure.toString();
        if (audioCtx) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.frequency.value = beatInMeasure === 1 ? 1200 : 880;
            gain.gain.value = 0.15;
            osc.start(); osc.stop(audioCtx.currentTime + 0.06);
        }
        if (beat >= maxBeats) rmStopCountOff();
    }
    tick();
    rmCountOffTimer = setInterval(tick, interval);
    // Prevent screen sleep while metronome is running
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(function(lock) {
            rmWakeLock = lock;
        }).catch(function() {});
    }
}
function rmStopCountOff() {
    clearInterval(rmCountOffTimer); rmCountOffTimer = null;
    // Release screen wake lock
    if (rmWakeLock) { rmWakeLock.release().catch(function(){}); rmWakeLock = null; }
    const btn = document.getElementById('rmCountOffBtn');
    const measBtn = document.getElementById('rmMetroMeasures');
    if (btn) { btn.textContent = 'Count Off'; btn.style.background = ''; btn.style.color = ''; }
    if (measBtn) measBtn.classList.add('hidden');
}

// ── Brain Trainer (lyric redaction) ──────────────────────────────────────────
function rmToggleBrainTrainer() {
    rmBrainActive = !rmBrainActive;
    const btn = document.getElementById('rmBrainBtn');
    document.querySelectorAll('.rm-brain-pct, .rm-brain-ctrl').forEach(el => el.classList.toggle('hidden', !rmBrainActive));
    if (rmBrainActive) {
        btn.style.background = '#667eea'; btn.style.color = 'white';
        rmBrainPct=(rmQueue[rmIndex]?parseInt(localStorage.getItem("rm_brain_"+rmQueue[rmIndex].title)||"75"):75)
        var bl2={100:'Full',75:'75%',50:'50%',25:'25% Cues',0:'Mastered'};document.getElementById('rmBrainPct').textContent=bl2[rmBrainPct]||rmBrainPct+'%';
        rmApplyBrainTrainer();
    } else {
        btn.style.background = ''; btn.style.color = '';
        rmApplyTranspose(); // restore full text
    }
}
function rmBrainAdjust(delta) {
    rmBrainPct = Math.max(0, Math.min(100, rmBrainPct + delta));
    var bs=rmQueue[rmIndex];if(bs)localStorage.setItem("rm_brain_"+bs.title,rmBrainPct);
    const labels = { 100: '📖 Full', 75: '75%', 50: '50%', 25: '25% Cues', 0: '🏆 Mastered' };
    document.getElementById('rmBrainPct').textContent = labels[rmBrainPct] || rmBrainPct + '%';
    rmApplyBrainTrainer();
}
function rmApplyBrainTrainer() {
    const source = rmTransposeSemitones === 0 ? rmOriginalChart : document.getElementById('rmChartText').textContent;
    if (!source) { rmApplyTranspose(); return; }
    if (rmBrainPct >= 100) { document.getElementById('rmChartText').textContent = rmOriginalChart; if (rmTransposeSemitones !== 0) rmApplyTranspose(); return; }
    const showPct = rmBrainPct / 100; // 0.75 = show 75% of words, 0 = show nothing
    const lines = (rmTransposeSemitones === 0 ? rmOriginalChart : rmOriginalChart).split('\n');
    // Re-apply transpose first if needed
    let srcLines = rmOriginalChart.split('\n');
    if (rmTransposeSemitones !== 0) {
        srcLines = rmOriginalChart.replace(RM_NOTE_RE, (match, root, suffix) => {
            let idx = RM_NOTES.indexOf(root);
            if (root.length === 2 && root[1] === 'b') idx = (RM_NOTES.indexOf(root[0]) - 1 + 12) % 12;
            if (idx === -1) return match;
            return RM_NOTES[(idx + rmTransposeSemitones) % 12] + (suffix || '');
        }).split('\n');
    }
    const redacted = srcLines.map(line => {
        if (/^\s*$/.test(line)) return line;
        if (/^\s*[\[\(]/.test(line)) return line; // [Verse], (Intro)
        const stripped = line.replace(/\s+/g, ' ').trim();
        const tokens = stripped.split(/\s+/);
        const chordCount = tokens.filter(t => /^[A-G][#b]?[m7dimaugsus\d\/]*$/i.test(t)).length;
        if (chordCount > tokens.length * 0.6) return line; // chord line, keep
        // Split into word tokens (preserving whitespace)
        const parts = line.split(/(\s+)/);
        const wordParts = parts.map((p, i) => ({ text: p, isWord: /\S/.test(p) && !/^[A-G][#b]?[m7dimaugsus\d\/]*$/.test(p) }));
        const totalWords = wordParts.filter(p => p.isWord).length;
        if (totalWords === 0) return line;
        const wordsToShow = rmBrainPct === 0 ? 0 : Math.max(1, Math.round(totalWords * showPct));
        let wordCount = 0;
        return wordParts.map(p => {
            if (!p.isWord) return p.text;
            wordCount++;
            if (wordCount <= wordsToShow) return p.text;
            return '▒'.repeat(p.text.length);
        }).join('');
    }).join('\n');
    document.getElementById('rmChartText').textContent = redacted;
}

// ── Load BPM/Key for tools bar ───────────────────────────────────────────────
async function rmLoadChartTools(songTitle) {
    rmSongBpm = 120; rmSongKey = '';
    try { rmSongBpm = await loadSongBpm(songTitle) || 120; } catch(e) {}
    try { rmSongKey = await loadSongKey(songTitle) || ''; } catch(e) {}
    document.getElementById('rmBpmDisplay').textContent = rmSongBpm;
    // Load saved transpose
    rmTransposeSemitones = parseInt(localStorage.getItem('rm_transpose_' + songTitle) || '0');
    if (rmSongKey) {
        let keyRoot = rmSongKey.match(/^[A-G][#b]?/)?.[0] || '';
        let keyIdx = RM_NOTES.indexOf(keyRoot);
        if (keyRoot.length === 2 && keyRoot[1] === 'b') keyIdx = (RM_NOTES.indexOf(keyRoot[0]) - 1 + 12) % 12;
        if (keyIdx >= 0 && rmTransposeSemitones) {
            const newKey = RM_NOTES[(keyIdx + rmTransposeSemitones) % 12];
            const suffix = rmSongKey.replace(/^[A-G][#b]?/, '');
            document.getElementById('rmTransposeKey').textContent = newKey + suffix;
        } else {
            document.getElementById('rmTransposeKey').textContent = rmSongKey.replace(/\s*(major|minor)/i, m => m.trim()[0].toLowerCase() === 'm' && m.trim().length > 1 ? 'm' : '');
        }
    } else {
        document.getElementById('rmTransposeKey').textContent = '—';
    }
    // Reset brain trainer on song change
    if (rmBrainActive) rmToggleBrainTrainer();
}

// ── Personal tabs in Chart panel ──────────────────────────────────────────────
async function rmLoadPersonalTabsInChart(songTitle) {
    const container = document.getElementById('rmPersonalTabsInChart');
    if (!container) return;
    const tabs = await loadPersonalTabs(songTitle);
    if (!tabs || !tabs.length) { container.innerHTML = ''; return; }
    container.innerHTML = '<div style="color:#64748b;font-size:0.75em;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">Band Members\' Tabs</div>' +
        tabs.map(t => `<a href="${t.url}" target="_blank" style="display:block;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:4px;text-decoration:none;color:#818cf8;font-size:0.82em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${t.label || t.notes || t.url} <span style="color:#64748b;font-size:0.85em">${t.memberKey ? '· ' + t.memberKey : ''}</span></a>`).join('');
}

// ══════════════════════════════════════════════════════════════════════════════
// KNOW TAB — Genius / Claude AI song meaning
// ══════════════════════════════════════════════════════════════════════════════
async function rmLoadKnow() {
    const song = rmQueue[rmIndex]; if (!song) return;
    const el = document.getElementById('rmKnowContent');
    el.innerHTML = '<div class="rm-loading">Loading song info…</div>';
    const cached = await loadBandDataFromDrive(song.title, 'song_meaning');
    if (cached && cached.text) { el.innerHTML = rmRenderKnow(cached.text, cached.source || ''); return; }
    const PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    if (!PROXY) { el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">Cloudflare proxy not configured.</div>'; return; }
    try {
        const sr = await fetch(PROXY + '/genius-search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ query: song.title + ' ' + song.band }) });
        const sd = await sr.json();
        if (sd.results?.length) {
            const g = sd.results[0];
            const fr = await fetch(PROXY + '/genius-fetch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ songId: g.id, url: g.url }) });
            const fd = await fr.json();
            if (fd.description && fd.description.length > 30) {
                await saveBandDataToDrive(song.title, 'song_meaning', { text: fd.description, source: 'Genius' });
                el.innerHTML = rmRenderKnow(fd.description, 'Genius'); return;
            }
        }
    } catch(e) { console.log('Genius error:', e); }
    try {
        el.innerHTML = '<div class="rm-loading">🤖 Asking AI about this song…</div>';
        const ar = await fetch(PROXY + '/claude', { method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{role:'user', content:`Tell me about the song "${song.title}" by ${song.band}. Cover: meaning, inspiration, emotional themes, history, notable performances. 2-3 concise paragraphs.`}]})});
        const ad = await ar.json(); const text = ad?.content?.[0]?.text || '';
        if (text) { await saveBandDataToDrive(song.title, 'song_meaning', { text, source: 'AI-generated' }); el.innerHTML = rmRenderKnow(text, 'AI-generated'); return; }
    } catch(e) { console.log('Claude error:', e); }
    el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">Could not load song info.</div>';
}
function rmRenderKnow(text, source) {
    return `<div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px">
        <div style="color:#fbbf24;font-size:0.75em;margin-bottom:8px">${source ? '📚 Source: '+source : ''}</div>
        <div style="color:#e2e8f0;font-size:0.9em;line-height:1.7;white-space:pre-wrap">${text}</div></div>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MEMORY TAB — AI Memory Palace + Flux images
// ══════════════════════════════════════════════════════════════════════════════
async function rmLoadMemory() {
    const song = rmQueue[rmIndex]; if (!song) return;
    const el = document.getElementById('rmMemoryContent');
    el.innerHTML = '<div class="rm-loading">Loading memory palace…</div>';
    const cached = await loadBandDataFromDrive(song.title, 'memory_palace');
    if (cached && cached.scenes?.length) { pmPalaceScenes = cached.scenes; el.innerHTML = rmRenderMemoryTab(song.title, cached.scenes); return; }
    const ss = song.title.replace(/'/g,"\\'"), sb = (song.band||'Grateful Dead').replace(/'/g,"\\'");
    el.innerHTML = `<div style="text-align:center;padding:30px">
        <div style="font-size:2em;margin-bottom:12px">🏰</div>
        <div style="color:#e2e8f0;font-size:0.95em;margin-bottom:16px">Create a Memory Palace for <strong>${song.title}</strong></div>
        <div style="color:#94a3b8;font-size:0.82em;margin-bottom:20px">AI will create vivid visual scenes to help you memorize the song structure, lyrics, and feel — each with a stunning AI-generated image.</div>
        <button onclick="rmGeneratePalace('${ss}','${sb}')" style="padding:12px 24px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-size:0.95em">🤖 Generate Memory Palace</button></div>`;
}
async function rmGeneratePalace(songTitle, band) {
    const PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    if (!PROXY) { showToast('\u274c Proxy not configured'); return; }
    const el = document.getElementById('rmMemoryContent');
    el.innerHTML = '<div class="rm-loading">🤖 Generating memory palace scenes\u2026</div>';
    
    // Gather song content we already have (chart text, song meaning)
    let chartText = '';
    try { const cd = await loadBandDataFromDrive(songTitle, 'chart'); if (cd?.text?.trim()) chartText = cd.text; } catch(e) {}
    if (!chartText) { try { chartText = await loadBandDataFromDrive(songTitle, 'rehearsal_crib') || ''; } catch(e) {} }
    
    let meaning = '';
    try { const m = await loadBandDataFromDrive(songTitle, 'song_meaning'); if (m) meaning = typeof m === 'string' ? m : m.text || m.meaning || JSON.stringify(m); } catch(e) {}
    
    // Build context from what we have
    let songContext = '';
    if (chartText) songContext += 'Here is the chord chart with lyrics for this song:\n\n' + chartText.substring(0, 3000) + '\n\n';
    if (meaning) songContext += 'Here is background on the song meaning:\n\n' + meaning.substring(0, 1500) + '\n\n';
    if (!songContext) songContext = 'I don\'t have the lyrics available, but this is a well-known song. Use your knowledge of its themes and imagery.\n\n';
    
    const bandThemes = {
        'GD': 'Grateful Dead: hippie aesthetic, tie-dye, 1960s-70s San Francisco, psychedelic warmth, dancing bears',
        'Grateful Dead': 'Grateful Dead: hippie aesthetic, tie-dye, 1960s-70s San Francisco, psychedelic warmth, dancing bears',
        'JGB': 'Jerry Garcia Band: mellow, soulful, late-night jazz club, intimate warm lighting',
        'Jerry Garcia Band': 'Jerry Garcia Band: mellow, soulful, late-night jazz club, intimate warm lighting',
        'Phish': 'Phish: playful, surreal, Vermont outdoors, whimsical, trampolines and glow sticks',
        'WSP': 'Widespread Panic: Southern rock, red clay Georgia, honky-tonk bars, swampy heat',
        'Widespread Panic': 'Widespread Panic: Southern rock, red clay Georgia, honky-tonk bars, swampy heat'
    };
    const bandStyle = bandThemes[band] || 'classic rock band aesthetic';
    
    try {
        const res = await fetch(PROXY+'/claude',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
            model:'claude-sonnet-4-20250514',
            max_tokens:4000,
            system:'You are a memory palace creator for musicians. You create vivid, concrete visual scenes that help singers remember song sections. You always respond with ONLY a valid JSON array. No other text, no markdown, no explanation — just the JSON array.',
            messages:[{role:'user',content:`Create a Memory Palace with 4 scenes for the song "${songTitle}" by ${band}.

${songContext}YOUR JOB: Read the lyrics above line by line and translate each line into a plain visual description of what to draw. Do NOT quote lyrics. Just describe what a picture of that line would look like.

EXAMPLE: If a line talks about a bird singing inside someone, you write: "A hippie woman standing in golden light with a small bird visible inside her chest, beak open, singing." That's it — just describe the picture.

RULES:
- Create one scene per major section (verse 1, verse 2, chorus, bridge).
- For EACH scene, go through the lines in that section one by one and describe what picture each line would be. Combine 2-4 lines into one connected visual scene.
- Be extremely literal. If a line mentions a truck, show a truck. If it mentions rain, show rain. If it mentions a friend, show a friend.
- Do NOT interpret, do NOT be poetic, do NOT use abstract imagery. Just describe what you would literally photograph if you were making a movie of each line.
- Style everything with ${bandStyle} aesthetic (clothing, colors, setting, vibe).

Return EXACTLY 4 scenes as a JSON array:
[{"title":"Short scene title","room":"A vivid location name","description":"Go line by line through this section. For each line, describe the literal picture. 3-5 sentences total.","imagePrompt":"Photorealistic scene: [the most important visual from this section]. ${bandStyle} aesthetic. Vivid colors, cinematic lighting. NO text in image.","section":"verse 1"}]`}]})});
        const data = await res.json(); const text = data?.content?.[0]?.text||'';
        const jm = text.match(/\[[\s\S]*\]/); if (!jm) throw new Error('No JSON in response: ' + text.substring(0,200));
        const scenes = JSON.parse(jm[0]); if (!scenes.length) throw new Error('Empty');
        el.innerHTML = '<div class="rm-loading">🎨 Generating AI artwork\u2026<div id="rmImageProgress" style="color:#64748b;font-size:0.82em;margin-top:8px"></div></div>';
        for (let i=0;i<scenes.length;i++) {
            const p=document.getElementById('rmImageProgress'); if(p) p.textContent=`Scene ${i+1} of ${scenes.length}\u2026`;
            try { const ir=await fetch(PROXY+'/generate-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:scenes[i].imagePrompt||scenes[i].description,steps:6})}); if(ir.ok){const id=await ir.json(); if(id.image)scenes[i].imageBase64=id.image;} } catch(e){}
        }
        pmPalaceScenes = scenes;
        const scenesToSave = scenes.map(s => { const {imageBase64, ...rest} = s; return rest; });
        await saveBandDataToDrive(songTitle, 'memory_palace', { scenes: scenesToSave });
        el.innerHTML = rmRenderMemoryTab(songTitle, scenes);
    } catch(e) {
        const ss=songTitle.replace(/'/g,"\\'"),sb=(band||'Grateful Dead').replace(/'/g,"\\'");
        el.innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center">\u274c ${e.message}<br><button onclick="rmGeneratePalace('${ss}','${sb}')" style="margin-top:12px;padding:8px 16px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer">Retry</button></div>`;
    }
}

function rmRenderMemoryTab(songTitle, scenes) {
    const ss=songTitle.replace(/'/g,"\\'");
    const cards = scenes.map((s,i) => {
        const bg = s.imageBase64 ? `background-image:url(data:image/jpeg;base64,${s.imageBase64});background-size:cover;background-position:center` : `background:linear-gradient(135deg,${['#1a1a2e,#16213e','#0f3460,#533483','#1a1a2e,#e94560','#16213e,#0f3460'][i%4]})`;
        return `<div style="border-radius:12px;overflow:hidden;margin-bottom:12px;position:relative;min-height:160px;${bg}">
            <div style="position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(0,0,0,0.85))"></div>
            <div style="position:relative;padding:16px;display:flex;flex-direction:column;justify-content:flex-end;min-height:160px">
                <div style="color:#fbbf24;font-size:0.7em;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${s.section||'Scene '+(i+1)} · Room ${i+1}</div>
                <div style="color:white;font-size:1em;font-weight:700;margin-bottom:6px">${s.title||s.room||''}</div>
                <div style="color:#cbd5e1;font-size:0.82em;line-height:1.5">${s.description}</div>
                <div style="display:flex;gap:6px;margin-top:8px">
                    <button onclick="rmEditScene('${ss}',${i})" style="background:rgba(255,255,255,0.1);border:none;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em" title="Edit scene description and image prompt">✏️ Edit</button>
                    <button onclick="rmPasteSceneImage(${i})" style="background:rgba(255,255,255,0.1);border:none;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em" title="Upload your own image">🖼️ Image</button>
                    <button onclick="rmRegenSceneImage('${ss}',${i})" style="background:rgba(255,255,255,0.1);border:none;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.75em" title="Regenerate AI image">🔄 Regen</button>
                </div></div></div>`;
    }).join('');
    return `<div style="margin-bottom:12px;display:flex;gap:8px">
        <button onclick="rmOpenPalaceWalk()" style="flex:1;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-weight:700;cursor:pointer">🏰 Walk</button>
        <button onclick="rmOpenPalaceOverview()" style="flex:1;padding:10px;background:rgba(255,255,255,0.05);color:#94a3b8;border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-weight:700;cursor:pointer">🗺️ Overview</button>
        <button onclick="rmRegeneratePalace('${ss}')" style="padding:10px 14px;background:rgba(255,255,255,0.05);color:#94a3b8;border:none;border-radius:10px;cursor:pointer">🔄</button></div>${cards}`;
}
function rmEditScene(songTitle, idx) {
    const s = pmPalaceScenes[idx]; if (!s) return;
    const form = document.createElement('div');
    form.id = 'rmSceneEditForm';
    form.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1e293b;border:1px solid rgba(255,255,255,0.15);border-radius:14px;padding:20px;width:90%;max-width:400px;z-index:10001;box-shadow:0 20px 60px rgba(0,0,0,0.6)';
    const esc = v => (v||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    form.innerHTML = `<div style="color:white;font-weight:700;margin-bottom:10px">\u270f\ufe0f Edit Scene ${idx+1}</div>
        <label style="color:#94a3b8;font-size:0.78em;display:block;margin-bottom:4px">Scene Title</label>
        <input id="rmSceneTitle" value="${esc(s.title||s.room||'')}" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;padding:8px;border-radius:6px;margin-bottom:10px;box-sizing:border-box" />
        <label style="color:#94a3b8;font-size:0.78em;display:block;margin-bottom:4px">Description (what you visualize to remember lyrics)</label>
        <textarea id="rmSceneDesc" rows="4" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;padding:8px;border-radius:6px;margin-bottom:10px;resize:vertical;box-sizing:border-box">${s.description||''}</textarea>
        <label style="color:#94a3b8;font-size:0.78em;display:block;margin-bottom:4px">Image Prompt (describes what AI should draw)</label>
        <textarea id="rmScenePrompt" rows="2" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;padding:8px;border-radius:6px;margin-bottom:12px;resize:vertical;box-sizing:border-box">${s.imagePrompt||''}</textarea>
        <div style="display:flex;gap:8px"><button onclick="rmSaveSceneEdit('${songTitle.replace(/'/g,"\\'")}',${idx})" style="flex:1;background:#667eea;color:white;border:none;padding:10px;border-radius:8px;font-weight:700;cursor:pointer">💾 Save</button><button onclick="document.getElementById('rmSceneEditForm')?.remove()" style="padding:10px 16px;background:rgba(255,255,255,0.1);color:#94a3b8;border:none;border-radius:8px;cursor:pointer">Cancel</button></div>`;
    document.body.appendChild(form);
}
async function rmSaveSceneEdit(songTitle, idx) {
    const s = pmPalaceScenes[idx]; if (!s) return;
    s.title = document.getElementById('rmSceneTitle')?.value || s.title;
    s.room = s.title;
    s.description = document.getElementById('rmSceneDesc')?.value || s.description;
    s.imagePrompt = document.getElementById('rmScenePrompt')?.value || s.imagePrompt;
    document.getElementById('rmSceneEditForm')?.remove();
    const scenesToSave = pmPalaceScenes.map(sc => { const {imageBase64, ...rest} = sc; return rest; });
    await saveBandDataToDrive(songTitle, 'memory_palace', { scenes: scenesToSave });
    const el = document.getElementById('rmPanelMemory');
    if (el) el.innerHTML = rmRenderMemoryTab(songTitle, pmPalaceScenes);
    showToast('\u2705 Scene updated!');
}
function rmPasteSceneImage(idx) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            pmPalaceScenes[idx].imageBase64 = base64;
            const el = document.getElementById('rmPanelMemory');
            const st = rmQueue[rmIndex]?.title || '';
            if (el) el.innerHTML = rmRenderMemoryTab(st, pmPalaceScenes);
            showToast('🖼️ Image added to scene ' + (idx+1));
        };
        reader.readAsDataURL(file);
    };
    input.click();
}
async function rmRegenSceneImage(songTitle, idx) {
    const s = pmPalaceScenes[idx]; if (!s) return;
    showToast('🎨 Generating new image...');
    try {
        const PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : 'https://deadcetera-proxy.drewmerrill.workers.dev';
        const ir = await fetch(PROXY + '/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: s.imagePrompt || s.description, steps: 6 }) });
        if (!ir.ok) { showToast('❌ Image service error (' + ir.status + ') — try again later'); return; }
        const id = await ir.json();
        if (id.image) { s.imageBase64 = id.image; showToast('✅ New image generated!'); }
        else showToast('❌ Image generation failed');
    } catch(e) { showToast('❌ ' + e.message); }
    const el = document.getElementById('rmPanelMemory');
    if (el) el.innerHTML = rmRenderMemoryTab(songTitle, pmPalaceScenes);
}

async function rmRegeneratePalace(st) { await saveBandDataToDrive(st,'memory_palace',null); rmGeneratePalace(st,(allSongs.find(s=>s.title===st)||{}).band||'Grateful Dead'); }
function rmOpenPalaceOverview() {
    if (!pmPalaceScenes.length) return;
    const ov = document.createElement('div');
    ov.id = 'rmPalaceOverviewOv';
    ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:rgba(0,0,0,0.95);overflow-y:auto;-webkit-overflow-scrolling:touch';
    const grid = pmPalaceScenes.map((s, i) => {
        const bg = s.imageBase64 ? 'background-image:url(data:image/jpeg;base64,' + s.imageBase64 + ');background-size:cover;background-position:center' : 'background:linear-gradient(135deg,' + ['#1a1a2e,#16213e','#0f3460,#533483','#1a1a2e,#e94560','#16213e,#0f3460'][i%4] + ')';
        return '<div style="position:relative;border-radius:10px;overflow:hidden;' + bg + ';aspect-ratio:16/9;min-height:140px">' +
            '<div style="position:absolute;inset:0;background:linear-gradient(transparent 20%,rgba(0,0,0,0.85))"></div>' +
            '<div style="position:absolute;top:8px;left:8px;background:rgba(102,126,234,0.9);color:white;padding:3px 10px;border-radius:12px;font-size:0.7em;font-weight:700;text-transform:uppercase;letter-spacing:1px">' + (s.section || 'Scene ' + (i+1)) + '</div>' +
            '<div style="position:absolute;bottom:0;left:0;right:0;padding:10px 12px">' +
            '<div style="color:white;font-size:0.85em;font-weight:700;margin-bottom:3px">' + (s.title || s.room || '') + '</div>' +
            '<div style="color:#cbd5e1;font-size:0.72em;line-height:1.4">' + (s.description || '') + '</div></div></div>';
    }).join('');
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '\u2715';
    closeBtn.style.cssText = 'background:none;border:none;color:#94a3b8;font-size:1.3em;cursor:pointer';
    closeBtn.onclick = () => ov.remove();
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px';
    header.innerHTML = '<h3 style="color:white;margin:0;font-size:1.1em">🗺️ Palace Overview</h3>';
    header.appendChild(closeBtn);
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'max-width:600px;margin:0 auto;padding:16px';
    wrapper.appendChild(header);
    const gridEl = document.createElement('div');
    gridEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';
    gridEl.innerHTML = grid;
    wrapper.appendChild(gridEl);
    ov.appendChild(wrapper);
    document.body.appendChild(ov);
}

function rmOpenPalaceWalk() {
    if (!pmPalaceScenes.length) return; pmPalaceSceneIndex=0;
    const ov=document.createElement('div');ov.id='rmPalaceWalkOverlay';
    ov.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;background:#000;transition:background 0.8s ease';
    ov.innerHTML=`<div id="rmPalaceScene" style="width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;transition:opacity 0.4s ease"></div>
        <div style="position:absolute;top:16px;right:16px;display:flex;gap:8px;z-index:2">
            <button id="rmAutoBtn" onclick="rmPalaceAutoPlay()" style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.82em">▶ Auto</button>
            <button onclick="document.getElementById('rmPalaceWalkOverlay')?.remove();clearInterval(pmPalaceAutoTimer)" style="background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.82em">✕ Close</button></div>
        <div style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:8px;z-index:2" id="rmPalaceDots"></div>
        <button onclick="rmPalaceNav(-1)" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1.2em;z-index:2;display:flex;align-items:center;justify-content:center" id="rmPalacePrev">◀</button>
        <button onclick="rmPalaceNav(1)" style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:1.2em;z-index:2;display:flex;align-items:center;justify-content:center" id="rmPalaceNext">▶</button>`;
    document.body.appendChild(ov);
    let tx=0;
    ov.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;});
    ov.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tx;if(Math.abs(dx)>50)rmPalaceNav(dx>0?-1:1);});
    document.addEventListener('keydown',function pk(e){if(!document.getElementById('rmPalaceWalkOverlay')){document.removeEventListener('keydown',pk);return;}if(e.key==='ArrowRight'||e.key===' ')rmPalaceNav(1);if(e.key==='ArrowLeft')rmPalaceNav(-1);if(e.key==='Escape'){document.getElementById('rmPalaceWalkOverlay')?.remove();clearInterval(pmPalaceAutoTimer);}});
    rmRenderPalaceScene();
}
function rmRenderPalaceScene() {
    const s=pmPalaceScenes[pmPalaceSceneIndex]; if(!s)return;
    const c=document.getElementById('rmPalaceScene');
    const bg=s.imageBase64?`background-image:url(data:image/jpeg;base64,${s.imageBase64});background-size:cover;background-position:center`:`background:linear-gradient(135deg,${['#1a1a2e,#16213e','#0f3460,#533483','#1a1a2e,#e94560','#16213e,#0f3460'][pmPalaceSceneIndex%4]})`;
    c.style.opacity='0';
    setTimeout(()=>{c.innerHTML=`<div style="position:absolute;inset:0;${bg}"></div><div style="position:absolute;inset:0;background:linear-gradient(transparent 30%,rgba(0,0,0,0.9))"></div>
        <div style="position:relative;padding:32px 24px"><div style="color:#fbbf24;font-size:0.8em;text-transform:uppercase;letter-spacing:2px;margin-bottom:8px">Room ${pmPalaceSceneIndex+1} · ${s.section||''}</div>
        <div style="color:white;font-size:1.4em;font-weight:800;margin-bottom:12px">${s.title||s.room||''}</div>
        <div style="color:#e2e8f0;font-size:1em;line-height:1.6">${s.description}</div></div>`;c.style.opacity='1';},200);
    const d=document.getElementById('rmPalaceDots');
    const pb=document.getElementById('rmPalacePrev'),nb=document.getElementById('rmPalaceNext');if(pb)pb.style.opacity=pmPalaceSceneIndex===0?'0.3':'1';if(nb)nb.style.opacity=pmPalaceSceneIndex>=pmPalaceScenes.length-1?'0.3':'1';if(d)d.innerHTML=pmPalaceScenes.map((_,i)=>`<div style="width:${i===pmPalaceSceneIndex?20:8}px;height:8px;border-radius:4px;background:${i===pmPalaceSceneIndex?'#fbbf24':'rgba(255,255,255,0.3)'};transition:all 0.3s"></div>`).join('');
}
function rmPalaceNav(dir){pmPalaceSceneIndex=Math.max(0,Math.min(pmPalaceScenes.length-1,pmPalaceSceneIndex+dir));rmRenderPalaceScene();}
function rmPalaceAutoPlay(){const b=document.getElementById('rmAutoBtn');if(pmPalaceAutoTimer){clearInterval(pmPalaceAutoTimer);pmPalaceAutoTimer=null;if(b)b.textContent='▶ Auto';return;}if(b)b.textContent='⏸ Pause';pmPalaceAutoTimer=setInterval(()=>{if(pmPalaceSceneIndex>=pmPalaceScenes.length-1){clearInterval(pmPalaceAutoTimer);pmPalaceAutoTimer=null;if(b)b.textContent='▶ Auto';return;}rmPalaceNav(1);},6000);}

// ══════════════════════════════════════════════════════════════════════════════
// HARMONY TAB v2 — Multi-Source: Archive · Relisten · Phish.in · YouTube · URL
//   + Source type filters (SBD/AUD/Matrix)
//   + Popularity sort
//   + Phish.net jam chart badges
//   + External link-outs (nugs, Bandcamp, Relisten)
// ══════════════════════════════════════════════════════════════════════════════
var rmHarmonyCache = {};
var rmHarmonySourceFilter = 'all';
var rmJamChartData = null;

function rmLoadHarmony() {
    var song = rmQueue[rmIndex]; if(!song)return;
    var el = document.getElementById('rmHarmonyContent');
    var ss = song.title.replace(/'/g,"\\'"), band = _rmFullBandName(song.band) || song.band || 'Grateful Dead';
    var isPhish = /phish/i.test(band);
    rmHarmonyCache = {}; rmJamChartData = null; rmHarmonySourceFilter = 'all';

    // ── North Star + Best Shot (load async, render at top) ──────────────
    var quickListenId = 'rmQuickListen_' + Date.now();
    var quickListenPlaceholder = '<div id="' + quickListenId + '" style="margin-bottom:14px"><div style="color:#64748b;font-size:0.78em;padding:8px 0">Loading reference versions...</div></div>';

    (async function() {
        var northStar = null, bestShot = null, lessons = [];
        // Lessons are per-user (each member has their own instrument-specific lessons)
        var _lessonKey = 'my_lessons';
        try {
            var _email = typeof currentUserEmail !== 'undefined' ? currentUserEmail : '';
            if (_email) _lessonKey = 'my_lessons_' + _email.replace(/[.#$/\[\]]/g, '_');
        } catch(e) {}
        try {
            var res = await Promise.all([
                loadBandDataFromDrive(song.title, 'spotify_versions').catch(function(){ return null; }),
                loadBandDataFromDrive(song.title, 'best_shot_takes').catch(function(){ return null; }),
                loadBandDataFromDrive(song.title, _lessonKey).catch(function(){ return null; })
            ]);
            var refs = toArray(res[0] || []);
            var shots = toArray(res[1] || []);
            refs.forEach(function(v) {
                var votes = v.votes ? Object.keys(v.votes).filter(function(k){ return v.votes[k]; }).length : 0;
                if (!northStar || votes > (northStar._voteCount || 0)) northStar = Object.assign({}, v, { _voteCount: votes });
            });
            bestShot = shots.find(function(s){ return s.crowned; }) || (shots.length ? shots[shots.length - 1] : null);
            lessons = toArray(res[2] || []);
        } catch(e) {}

        // Look up container AFTER await — innerHTML is set by then
        var container = document.getElementById(quickListenId);
        if (!container) return;

        var _e = function(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };
        var _songTitle = song.title.replace(/'/g, "\\'");
        var html = '';

        // ── North Star card ──
        var totalMembers = (typeof bandMembers !== 'undefined') ? Object.keys(bandMembers).length : 5;
        var nsMajority = Math.ceil(totalMembers / 2);
        if (northStar) {
            var nsUrl = (northStar.url || northStar.spotifyUrl || '').replace(/'/g, "\\'");
            var nsTitle = _e(northStar.fetchedTitle || northStar.title || 'Reference Version');
            var nsAdded = northStar.addedBy ? northStar.addedBy.split('@')[0] : '';
            var nsDate = northStar.dateAdded || '';
            var nsNotes = _e(northStar.notes || '');
            var nsMeta = [nsAdded, nsDate].filter(Boolean).join(' · ');
            var nsIsBandChoice = (northStar._voteCount || 0) >= nsMajority;
            var nsVotesNeeded = Math.max(0, nsMajority - (northStar._voteCount || 0));
            var nsVoteLabel = nsIsBandChoice ? '👑 Band Choice' : nsVotesNeeded + ' more vote' + (nsVotesNeeded !== 1 ? 's' : '') + ' for Band Choice';
            // Check if current user already voted
            var nsUserVoted = false;
            try { var _ce = typeof currentUserEmail !== 'undefined' ? currentUserEmail.replace(/\./g,'_').replace(/[#$\/\[\]]/g,'_') : ''; nsUserVoted = northStar.votes && northStar.votes[_ce]; } catch(e){}
            html += '<div style="padding:10px 12px;background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px;margin-bottom:8px">'
                + '<div style="display:flex;align-items:center;gap:10px">'
                + '<span style="font-size:1.2em">⭐</span>'
                + '<div style="flex:1;min-width:0">'
                + '<div style="font-size:0.82em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + nsTitle + '</div>'
                + '<div style="font-size:0.65em;color:#64748b">' + (northStar._voteCount || 0) + '/' + totalMembers + ' votes · ' + nsVoteLabel + (nsMeta ? ' · ' + nsMeta : '') + '</div>'
                + '</div>'
                + (nsUrl ? '<button onclick="rmPlayInline(\'' + nsUrl + '\')" style="padding:6px 14px;background:rgba(102,126,234,0.2);color:#a5b4fc;border:1px solid rgba(102,126,234,0.3);border-radius:8px;cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap">▶ Play</button>' : '')
                + '</div>'
                + (nsNotes ? '<div style="font-size:0.72em;color:#94a3b8;margin-top:4px;font-style:italic;padding-left:30px">' + nsNotes + '</div>' : '')
                + '<div style="display:flex;gap:6px;margin-top:6px;margin-left:30px;flex-wrap:wrap">'
                + '<button onclick="rmVoteNorthStar(\'' + _songTitle + '\')" style="padding:3px 10px;background:' + (nsUserVoted ? 'rgba(102,126,234,0.2)' : 'none') + ';border:1px solid rgba(102,126,234,0.3);color:#a5b4fc;border-radius:6px;cursor:pointer;font-size:0.68em;font-weight:600">' + (nsUserVoted ? '✅ Voted' : 'Vote ⭐') + '</button>'
                + '<button onclick="rmEditNorthStarUrl(\'' + _songTitle + '\')" style="padding:3px 10px;background:none;border:1px solid rgba(255,255,255,0.1);color:#64748b;border-radius:6px;cursor:pointer;font-size:0.68em">✏️ Edit URL</button>'
                + '</div>'
                + '</div>';
        } else {
            html += '<div style="padding:8px 12px;background:rgba(102,126,234,0.04);border:1px solid rgba(102,126,234,0.1);border-radius:10px;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
                + '<span style="font-size:1em">⭐</span>'
                + '<span style="font-size:0.78em;color:#64748b">No North Star set — find a reference version below</span></div>';
        }

        // ── Best Shot card ──
        if (bestShot) {
            var bsLabel = _e(bestShot.label || 'Best Take');
            var bsBy = bestShot.uploadedByName || (bestShot.uploadedBy ? bestShot.uploadedBy.split('@')[0] : '');
            html += '<div style="padding:10px 12px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:10px;margin-bottom:8px">'
                + '<div style="display:flex;align-items:center;gap:10px">'
                + '<span style="font-size:1.2em">🏆</span>'
                + '<div style="flex:1;min-width:0">'
                + '<div style="font-size:0.82em;font-weight:700;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + bsLabel + (bestShot.crowned ? ' 👑' : '') + '</div>'
                + '<div style="font-size:0.65em;color:#64748b">Best Shot' + (bsBy ? ' · ' + _e(bsBy) : '') + '</div></div>';
            if (bestShot.audioUrl) {
                html += '<audio controls src="' + bestShot.audioUrl.replace(/"/g,'&quot;') + '" style="height:32px;max-width:120px"></audio>';
            } else if (bestShot.externalUrl) {
                var bsUrl = bestShot.externalUrl.replace(/'/g, "\\'");
                html += '<button onclick="window.open(\'' + bsUrl + '\',\'_blank\')" style="padding:6px 14px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.3);border-radius:8px;cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap">▶ Play</button>';
            }
            html += '</div></div>';
        } else {
            html += '<div style="padding:8px 12px;background:rgba(245,158,11,0.03);border:1px solid rgba(245,158,11,0.1);border-radius:10px;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
                + '<span style="font-size:1em">🏆</span>'
                + '<span style="font-size:0.78em;color:#64748b">No Best Shot yet</span>'
                + '<button onclick="closeRehearsalMode();setTimeout(function(){if(typeof showPage===\'function\')showPage(\'songs\');if(typeof GLStore!==\'undefined\')GLStore.selectSong(\'' + _songTitle + '\');},300)" style="margin-left:auto;padding:3px 10px;background:none;border:1px solid rgba(245,158,11,0.3);color:#fbbf24;border-radius:6px;cursor:pointer;font-size:0.68em;font-weight:600">Upload a Take →</button>'
                + '</div>';
        }

        // ── Lessons & Tutorials section (always visible, per-user) ──
        html += '<div style="padding:8px 12px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);border-radius:10px;margin-bottom:8px">'
            + '<div style="font-size:0.72em;font-weight:700;color:#86efac;margin-bottom:4px">🎓 My Lessons & Tutorials</div>';
        if (lessons.length) {
            lessons.forEach(function(l, li) {
                var lUrl = (l.url || '').replace(/'/g, "\\'");
                var lTitle = _e(l.title || 'Lesson');
                html += '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03)">'
                    + '<span style="flex:1;font-size:0.78em;color:#e2e8f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lTitle + '</span>'
                    + (lUrl ? '<button onclick="window.open(\'' + lUrl + '\',\'_blank\')" style="padding:3px 10px;background:rgba(34,197,94,0.12);color:#86efac;border:1px solid rgba(34,197,94,0.25);border-radius:6px;cursor:pointer;font-size:0.68em;font-weight:600">▶ Watch</button>' : '')
                    + '<button onclick="rmRemoveLesson(\'' + _songTitle + '\',' + li + ')" style="background:none;border:none;color:#475569;cursor:pointer;font-size:0.68em">✕</button>'
                    + '</div>';
            });
        } else {
            html += '<div style="font-size:0.72em;color:#64748b;padding:4px 0">No lessons saved yet — search YouTube below and click 🎓 Lesson to add one.</div>';
        }
        html += '</div>';

        container.innerHTML = html;
    })();

    var srcTabs = '<button class="rm-src-tab active" onclick="rmSrcTab2(\'archive\',this)" style="padding:6px 10px;border:none;border-radius:8px;cursor:pointer;font-size:0.78em;background:#667eea;color:white">🏛️ Archive</button>' +
        '<button class="rm-src-tab" onclick="rmSrcTab2(\'relisten\',this)" style="padding:6px 10px;border:none;border-radius:8px;cursor:pointer;font-size:0.78em;background:rgba(255,255,255,0.05);color:#94a3b8">🔄 Relisten</button>';
    if (isPhish) srcTabs += '<button class="rm-src-tab" onclick="rmSrcTab2(\'phishin\',this)" style="padding:6px 10px;border:none;border-radius:8px;cursor:pointer;font-size:0.78em;background:rgba(255,255,255,0.05);color:#94a3b8">🐟 Phish.in</button>';
    srcTabs += '<button class="rm-src-tab" onclick="rmSrcTab2(\'youtube\',this)" style="padding:6px 10px;border:none;border-radius:8px;cursor:pointer;font-size:0.78em;background:rgba(255,255,255,0.05);color:#94a3b8">📺 YouTube</button>' +
        '<button class="rm-src-tab" onclick="rmSrcTab2(\'url\',this)" style="padding:6px 10px;border:none;border-radius:8px;cursor:pointer;font-size:0.78em;background:rgba(255,255,255,0.05);color:#94a3b8">🔗 URL</button>';

    var filterPills = '<div id="rmSourceFilters" style="display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap">' +
        '<button class="rm-filter-pill active" onclick="rmSetSourceFilter(\'all\',this)" style="padding:4px 10px;border:1px solid rgba(102,126,234,0.4);border-radius:20px;cursor:pointer;font-size:0.72em;background:rgba(102,126,234,0.25);color:#818cf8">All</button>' +
        '<button class="rm-filter-pill" onclick="rmSetSourceFilter(\'SBD\',this)" style="padding:4px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;cursor:pointer;font-size:0.72em;background:rgba(255,255,255,0.03);color:#94a3b8">🎛️ SBD</button>' +
        '<button class="rm-filter-pill" onclick="rmSetSourceFilter(\'AUD\',this)" style="padding:4px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;cursor:pointer;font-size:0.72em;background:rgba(255,255,255,0.03);color:#94a3b8">🎤 AUD</button>' +
        '<button class="rm-filter-pill" onclick="rmSetSourceFilter(\'Matrix\',this)" style="padding:4px 10px;border:1px solid rgba(255,255,255,0.08);border-radius:20px;cursor:pointer;font-size:0.72em;background:rgba(255,255,255,0.03);color:#94a3b8">🔀 Matrix</button></div>';

    var extLinks = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
    if (isPhish) {
        extLinks += '<a href="https://relisten.net/phish" target="_blank" style="padding:4px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#94a3b8;font-size:0.7em;text-decoration:none">🔄 relisten.net</a>';
        extLinks += '<a href="https://phish.in" target="_blank" style="padding:4px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#94a3b8;font-size:0.7em;text-decoration:none">🐟 phish.in</a>';
        extLinks += '<a href="https://phish.net" target="_blank" style="padding:4px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#94a3b8;font-size:0.7em;text-decoration:none">📊 phish.net</a>';
    }
    var nugsQ = encodeURIComponent((band||'') + ' ' + song.title);
    extLinks += '<a href="https://play.nugs.net/#/search/' + nugsQ + '" target="_blank" style="padding:4px 8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#94a3b8;font-size:0.7em;text-decoration:none">🎧 nugs.net</a></div>';

    el.innerHTML = quickListenPlaceholder +
        '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">' + srcTabs + '</div>' +
        '<button onclick="rmSearchAllSources()" style="width:100%;padding:8px;background:linear-gradient(135deg,rgba(102,126,234,0.2),rgba(118,75,162,0.2));color:#c4b5fd;border:1px solid rgba(102,126,234,0.3);border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;margin-bottom:10px">🔍 Search All Sources</button>' +
        filterPills + extLinks +
        '<div id="rmSrcArchive"><div style="display:flex;gap:6px;margin-bottom:8px">' +
            '<input id="rmArchiveQuery" type="text" placeholder="Search Archive.org..." value="' + rmArchiveQuery(song.title, song.band).replace(/"/g,'&quot;') + '" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;font-family:inherit" onkeydown="if(event.key===\'Enter\')rmSearchArchive()">' +
            '<button onclick="rmSearchArchive()" style="padding:8px 14px;background:rgba(102,126,234,0.2);color:#818cf8;border:none;border-radius:8px;cursor:pointer">🔍</button></div>' +
            '<div style="color:#64748b;font-size:0.72em;margin-bottom:8px">Searches the ' + band + ' collection. Add year for better results.</div>' +
            '<div id="rmArchiveResults" style="max-height:220px;overflow-y:auto"></div>' +
            '<div id="rmArchiveFiles" style="display:none;max-height:200px;overflow-y:auto"></div></div>' +
        '<div id="rmSrcRelisten" style="display:none">' +
            '<div style="display:flex;gap:6px;margin-bottom:8px">' +
                '<input id="rmRelistenQuery" type="text" placeholder="Song name..." value="' + song.title.replace(/"/g,'&quot;') + '" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;font-family:inherit" onkeydown="if(event.key===\'Enter\')rmSearchRelisten()">' +
                '<button onclick="rmSearchRelisten()" style="padding:8px 14px;background:rgba(102,126,234,0.2);color:#818cf8;border:none;border-radius:8px;cursor:pointer">🔍</button></div>' +
            '<div id="rmRelistenResults" style="max-height:300px;overflow-y:auto"></div></div>' +
        (isPhish ? '<div id="rmSrcPhishin" style="display:none">' +
            '<div id="rmPhishinResults" style="max-height:300px;overflow-y:auto"><div style="color:#94a3b8;font-size:0.82em;padding:8px">Tap Search to find Phish.in recordings...</div></div>' +
            '<button onclick="rmSearchPhishIn()" style="width:100%;padding:10px;background:rgba(234,179,8,0.15);color:#fbbf24;border:1px solid rgba(234,179,8,0.3);border-radius:8px;cursor:pointer;font-size:0.85em;margin-top:8px">🐟 Search Phish.in</button></div>' : '') +
        '<div id="rmSrcYoutube" style="display:none"><div style="display:flex;gap:6px;margin-bottom:8px">' +
            '<input id="rmYoutubeQuery" type="text" placeholder="Search YouTube..." value="' + (song.title + ' ' + band + ' live').replace(/"/g,'&quot;') + '" style="flex:1;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;font-family:inherit" onkeydown="if(event.key===\'Enter\')rmSearchYouTube()">' +
            '<button onclick="rmSearchYouTube()" style="padding:8px 14px;background:rgba(239,68,68,0.2);color:#f87171;border:none;border-radius:8px;cursor:pointer">🔍</button></div>' +
            '<div id="rmYoutubeResults" style="max-height:260px;overflow-y:auto"></div>' +
            '<div style="margin-top:8px"><input id="rmYoutubeUrl" type="url" placeholder="Or paste a YouTube URL..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;box-sizing:border-box;font-family:inherit" oninput="rmSelectFromInput(this)"></div></div>' +
        '<div id="rmSrcUrl" style="display:none"><div style="color:#94a3b8;font-size:0.82em;margin-bottom:6px">Paste any direct audio URL (MP3, FLAC, OGG, WAV):</div>' +
            '<input id="rmDirectUrl" type="url" placeholder="https://..." style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#e2e8f0;padding:8px;font-size:13px;box-sizing:border-box;font-family:inherit" oninput="rmSelectFromInput(this)"></div>' +
        '<div id="rmSelectedSource" style="display:none;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.3);border-radius:8px;padding:10px;margin:12px 0">' +
            '<div style="color:#818cf8;font-size:0.78em;font-weight:600">Selected:</div>' +
            '<div id="rmSelectedSourceText" style="color:#e2e8f0;font-size:0.82em;word-break:break-all"></div></div>' +
        '<button id="rmFadrGoBtn" onclick="rmRunFadr(\'' + ss + '\')" style="width:100%;padding:12px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:10px;font-weight:700;font-size:0.95em;cursor:pointer;margin-top:12px" disabled>🤖 Send to Fadr AI</button>' +
        '<div id="rmFadrProgress" style="display:none;margin-top:12px;background:rgba(255,255,255,0.03);border-radius:8px;padding:12px">' +
            '<div id="rmFadrProgressText" style="color:#e2e8f0;font-size:0.85em"></div>' +
            '<div style="background:rgba(255,255,255,0.1);border-radius:4px;height:6px;margin-top:8px"><div id="rmFadrProgressBar" style="height:100%;background:#667eea;border-radius:4px;width:0;transition:width 0.3s"></div></div></div>' +
        '<div style="margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.06)">' +
            '<button onclick="importHarmoniesFromFadr(\'' + ss + '\')" style="width:100%;padding:10px;background:rgba(5,150,105,0.15);color:#6ee7b7;border:1px solid rgba(5,150,105,0.3);border-radius:8px;cursor:pointer;font-size:0.85em">🎵 Open Full Fadr Import Modal</button></div>';

    if (isPhish) rmFetchJamCharts(song.title);
}

function rmSelectFromInput(el) { var v = el.value.trim(); if (v) { pmSelectedAudioUrl = v; document.getElementById('rmSelectedSource').style.display = 'block'; document.getElementById('rmSelectedSourceText').textContent = v; document.getElementById('rmFadrGoBtn').disabled = false; } }

function rmSrcTab2(tab, btn) {
    document.querySelectorAll('.rm-src-tab').forEach(function(b) { b.style.background = 'rgba(255,255,255,0.05)'; b.style.color = '#94a3b8'; });
    btn.style.background = '#667eea'; btn.style.color = 'white';
    ['archive','relisten','phishin','youtube','url'].forEach(function(t) { var e = document.getElementById('rmSrc' + t.charAt(0).toUpperCase() + t.slice(1)); if (e) e.style.display = t === tab ? 'block' : 'none'; });
    var ff = document.getElementById('rmSourceFilters'); if (ff) ff.style.display = (tab === 'archive' || tab === 'relisten') ? 'flex' : 'none';
    // Auto-search on first visit to Relisten or Phish.in tabs
    if (tab === 'relisten' && !rmHarmonyCache.relisten) rmSearchRelisten();
    if (tab === 'phishin' && !rmHarmonyCache.phishin) rmSearchPhishIn();
}

function rmSetSourceFilter(filter, btn) {
    rmHarmonySourceFilter = filter;
    document.querySelectorAll('.rm-filter-pill').forEach(function(b) { b.style.background = 'rgba(255,255,255,0.03)'; b.style.color = '#94a3b8'; b.style.borderColor = 'rgba(255,255,255,0.08)'; });
    btn.style.background = 'rgba(102,126,234,0.25)'; btn.style.color = '#818cf8'; btn.style.borderColor = 'rgba(102,126,234,0.4)';
    if (rmHarmonyCache.archive) rmRenderArchiveResults(rmHarmonyCache.archive);
    if (rmHarmonyCache.relisten) rmRenderRelistenResults(rmHarmonyCache.relisten);
}

// ── Archive.org search + render ──────────────────────────────────────────────
async function rmSearchArchive() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var q = document.getElementById('rmArchiveQuery')?.value?.trim(); if (!q) return;
    var c = document.getElementById('rmArchiveResults');
    c.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">🔍 Searching Archive.org...</div>';
    try {
        var r = await fetch(PROXY + '/archive-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, rows: 30 }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No results.</div>'; return; }
        rmHarmonyCache.archive = d.results;
        rmRenderArchiveResults(d.results);
    } catch(e) { c.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

function rmRenderArchiveResults(results) {
    var c = document.getElementById('rmArchiveResults');
    var _st = (rmQueue[rmIndex] ? rmQueue[rmIndex].title : '').replace(/'/g, "\\'");
    var filtered = rmHarmonySourceFilter !== 'all' ? results.filter(function(r) { return r.sourceType === rmHarmonySourceFilter; }) : results;
    c.innerHTML = '<div style="color:#64748b;font-size:0.7em;padding:4px 8px">' + filtered.length + ' of ' + results.length + ' shows' + (rmHarmonySourceFilter !== 'all' ? ' (' + rmHarmonySourceFilter + ')' : '') + '</div>' +
        filtered.slice(0, 25).map(function(r) {
            var srcBadge = '', srcColor = '#64748b';
            if (r.sourceType === 'SBD') { srcBadge = '🎛️SBD'; srcColor = '#34d399'; }
            else if (r.sourceType === 'AUD') { srcBadge = '🎤AUD'; srcColor = '#fbbf24'; }
            else if (r.sourceType === 'Matrix') { srcBadge = '🔀MTX'; srcColor = '#818cf8'; }
            var jcBadge = '';
            if (rmJamChartData && r.date) { var ds = (r.date || '').split('T')[0]; var jc = rmJamChartData.find(function(j) { return j.showdate === ds; }); if (jc) jcBadge = '<span style="color:#f59e0b;font-size:0.7em" title="' + (jc.jamchart_description || 'Jam Chart').replace(/"/g,'&quot;') + '">⭐JC</span> '; }
            var archiveUrl = 'https://archive.org/details/' + r.identifier;
            var _safeId = r.identifier.replace(/'/g, "\\'");
            var _safeTitle = ((r.title || r.identifier) + '').replace(/'/g, "\\'");
            return '<div style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">' +
                '<div onclick="rmSelectShow(\'' + _safeId + '\')" style="cursor:pointer" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
                '<div style="display:flex;align-items:center;gap:6px">' +
                (srcBadge ? '<span style="color:' + srcColor + ';font-size:0.65em;font-weight:700;padding:1px 5px;border:1px solid ' + srcColor + '33;border-radius:4px;white-space:nowrap">' + srcBadge + '</span>' : '') + jcBadge +
                '<span style="color:#e2e8f0;font-size:0.82em;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.title || r.identifier) + '</span></div>' +
                '<div style="color:#64748b;font-size:0.72em;margin-top:2px">' + (r.date ? r.date.split('T')[0] : '') + ' · ⭐ ' + (r.rating ? r.rating.toFixed(1) : '—') + ' · ' + (r.downloads ? r.downloads.toLocaleString() + ' dl' : '') + '</div></div>' +
                '<div style="display:flex;gap:4px;margin-top:3px">' +
                '<button onclick="rmSetAsNorthStar(\'' + _st + '\',\'' + archiveUrl.replace(/'/g, "\\'") + '\',\'' + _safeTitle + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(102,126,234,0.25);color:#a5b4fc;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">⭐ North Star</button>' +
                '<button onclick="rmAddAsLesson(\'' + _st + '\',\'' + archiveUrl.replace(/'/g, "\\'") + '\',\'' + _safeTitle + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(34,197,94,0.25);color:#86efac;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">🎓 Lesson</button>' +
                '</div></div>';
        }).join('');
}

async function rmSelectShow(id) {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var c = document.getElementById('rmArchiveFiles'); c.style.display = 'block';
    c.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">Loading tracks...</div>';
    try {
        var r = await fetch(PROXY + '/archive-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: id }) });
        var d = await r.json();
        if (!d.files?.length) { c.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No audio files.</div>'; return; }
        var sorted = d.files.sort(function(a, b) { var am = /mp3/i.test(a.format || a.name), bm = /mp3/i.test(b.format || b.name); if (am && !bm) return -1; if (!am && bm) return 1; return 0; });
        var showBadge = '';
        if (d.sourceType && d.sourceType !== 'Unknown') { var sc = d.sourceType === 'SBD' ? '#34d399' : d.sourceType === 'AUD' ? '#fbbf24' : '#818cf8'; showBadge = '<span style="color:' + sc + ';font-size:0.65em;font-weight:700;padding:1px 5px;border:1px solid ' + sc + '33;border-radius:4px;margin-left:6px">' + d.sourceType + '</span>'; }
        c.innerHTML = '<div style="color:#fbbf24;font-size:0.75em;padding:4px 8px">' + (d.title || id) + showBadge + '</div>' + sorted.map(function(f) {
            var n = f.title || f.name.replace(/\.[^.]+$/, ''), fm = (f.format || '').replace('VBR ', '');
            return '<div onclick="rmSelectTrack(\'' + f.url.replace(/'/g, "\\'") + '\',\'' + n.replace(/'/g, "\\'") + '\')" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
                '<div style="color:#e2e8f0;font-size:0.8em">' + n + '</div>' +
                '<div style="color:#64748b;font-size:0.68em">' + fm + ' · ' + (f.length ? Math.floor(f.length / 60) + ':' + String(Math.floor(f.length % 60)).padStart(2, '0') : '') + ' · ' + (f.size ? (parseInt(f.size) / 1024 / 1024).toFixed(1) + 'MB' : '') + '</div></div>';
        }).join('');
    } catch(e) { c.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

function rmSelectTrack(url, title) { pmSelectedAudioUrl = url; document.getElementById('rmSelectedSource').style.display = 'block'; document.getElementById('rmSelectedSourceText').textContent = title; document.getElementById('rmFadrGoBtn').disabled = false; document.getElementById('rmFadrGoBtn').scrollIntoView({ behavior: 'smooth', block: 'center' }); }

// ── Relisten search ──────────────────────────────────────────────────────────
async function rmSearchRelisten() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var song = rmQueue[rmIndex]; if (!song) return;
    var queryEl = document.getElementById('rmRelistenQuery');
    var searchTitle = queryEl ? queryEl.value.trim() : song.title;
    if (!searchTitle) searchTitle = song.title;
    var c = document.getElementById('rmRelistenResults');
    c.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">🔄 Searching Relisten...</div>';
    try {
        var r = await fetch(PROXY + '/relisten-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songTitle: searchTitle, bandSlug: song.band }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No Relisten results.' + (d.matched === false ? ' Song not found in catalog.' : '') + '</div>'; return; }
        rmHarmonyCache.relisten = d.results;
        rmRenderRelistenResults(d.results, d.songName, d.timesPlayed);
    } catch(e) { c.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

function rmRenderRelistenResults(results, songName, timesPlayed) {
    var c = document.getElementById('rmRelistenResults');
    var _st = (rmQueue[rmIndex] ? rmQueue[rmIndex].title : '').replace(/'/g, "\\'");
    var filtered = rmHarmonySourceFilter === 'SBD' ? results.filter(function(r) { return r.hasSbd; }) : rmHarmonySourceFilter === 'AUD' ? results.filter(function(r) { return !r.hasSbd; }) : results;
    var hdr = '<div style="color:#64748b;font-size:0.7em;padding:4px 8px">' + (songName ? '"' + songName + '" — ' : '') + (timesPlayed ? timesPlayed + ' shows · ' : '') + filtered.length + ' shown' + (rmHarmonySourceFilter !== 'all' ? ' (' + rmHarmonySourceFilter + ')' : '') + '</div>';
    c.innerHTML = hdr + filtered.slice(0, 25).map(function(r) {
        var sbdBadge = r.hasSbd ? '<span style="color:#34d399;font-size:0.65em;font-weight:700;padding:1px 5px;border:1px solid #34d39933;border-radius:4px">SBD</span> ' : '';
        var jcBadge = '';
        if (rmJamChartData && r.date) { var jc = rmJamChartData.find(function(j) { return j.showdate === r.date; }); if (jc) jcBadge = '<span style="color:#f59e0b;font-size:0.7em" title="' + (jc.jamchart_description || '').replace(/"/g,'&quot;') + '">⭐JC</span> '; }
        var loc = [r.venue, r.city, r.state].filter(Boolean).join(', ');
        var rlUrl = (r.relistenUrl || '').replace(/'/g, "\\'");
        var rlTitle = (r.date + ' ' + (r.venue || '')).replace(/'/g, "\\'");
        return '<div style="padding:7px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">' +
            '<div onclick="window.open(\'' + rlUrl + '\',\'_blank\')" style="cursor:pointer" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
            '<div style="display:flex;align-items:center;gap:6px">' + sbdBadge + jcBadge + '<span style="color:#e2e8f0;font-size:0.82em;font-weight:600">' + r.date + '</span></div>' +
            '<div style="color:#64748b;font-size:0.72em;margin-top:2px">' + loc + (r.tapeCount ? ' · 📼 ' + r.tapeCount + ' tapes' : '') + '</div></div>' +
            '<div style="display:flex;gap:4px;margin-top:3px">' +
            '<button onclick="rmSetAsNorthStar(\'' + _st + '\',\'' + rlUrl + '\',\'' + rlTitle + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(102,126,234,0.25);color:#a5b4fc;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">⭐ North Star</button>' +
            '<button onclick="rmAddAsLesson(\'' + _st + '\',\'' + rlUrl + '\',\'' + rlTitle + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(34,197,94,0.25);color:#86efac;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">🎓 Lesson</button>' +
            '</div></div>';
    }).join('');
}

// ── Phish.in search (Phish only) ─────────────────────────────────────────────
async function rmSearchPhishIn() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var song = rmQueue[rmIndex]; if (!song) return;
    var c = document.getElementById('rmPhishinResults');
    c.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">🐟 Searching Phish.in...</div>';
    try {
        var r = await fetch(PROXY + '/phishin-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songTitle: song.title }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No Phish.in results.' + (d.matched === false ? ' Song not found.' : '') + '</div>'; return; }
        rmHarmonyCache.phishin = d.results;
        c.innerHTML = '<div style="color:#64748b;font-size:0.7em;padding:4px 8px">"' + (d.songTitle || song.title) + '" — ' + (d.timesPlayed || d.results.length) + ' recordings, sorted by likes</div>' +
            d.results.slice(0, 25).map(function(t) {
                var durMin = t.duration ? Math.floor(t.duration / 60000) + ':' + String(Math.floor((t.duration % 60000) / 1000)).padStart(2, '0') : '';
                var jcBadge = t.isJamchart ? '<span style="color:#f59e0b;font-size:0.7em">⭐JC</span> ' : '';
                var likesStr = t.likes ? '❤️ ' + t.likes : '';
                var click = t.mp3Url ? "rmSelectTrack('" + (t.mp3Url || '').replace(/'/g, "\\'") + "','" + (t.date + ' Phish.in').replace(/'/g, "\\'") + "')" : "window.open('https://phish.in/" + (t.date || '') + "','_blank')";
                return '<div onclick="' + click + '" style="padding:7px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
                    '<div style="display:flex;align-items:center;gap:6px">' + jcBadge + '<span style="color:#e2e8f0;font-size:0.82em;font-weight:600">' + (t.date || '') + '</span><span style="color:#64748b;font-size:0.72em;margin-left:auto">' + likesStr + '</span></div>' +
                    '<div style="color:#64748b;font-size:0.72em;margin-top:2px">' + (t.venue || '') + (durMin ? ' · ' + durMin : '') + (t.mp3Url ? ' · 🎵 streamable' : '') + '</div></div>';
            }).join('');
    } catch(e) { c.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

// ── Phish.net jam chart background fetch ─────────────────────────────────────
async function rmFetchJamCharts(songTitle) {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    try {
        var r = await fetch(PROXY + '/phishnet-jamchart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songTitle: songTitle }) });
        var d = await r.json();
        if (d.results?.length) { rmJamChartData = d.results; if (rmHarmonyCache.archive) rmRenderArchiveResults(rmHarmonyCache.archive); if (rmHarmonyCache.relisten) rmRenderRelistenResults(rmHarmonyCache.relisten); }
    } catch(e) { /* jam charts are bonus overlay — fail silently */ }
}

// ── YouTube search ───────────────────────────────────────────────────────────
async function rmSearchYouTube() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var q = document.getElementById('rmYoutubeQuery')?.value?.trim(); if (!q) return;
    var c = document.getElementById('rmYoutubeResults');
    c.innerHTML = '<div style="color:#94a3b8;font-size:0.82em;padding:8px">🔍 Searching...</div>';
    try {
        var r = await fetch(PROXY + '/youtube-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div style="color:#64748b;font-size:0.82em;padding:8px">No results.</div>'; return; }
        var _st = (rmQueue[rmIndex] ? rmQueue[rmIndex].title : '').replace(/'/g, "\\'");
        c.innerHTML = d.results.map(function(v) {
            var _vu = (v.url || '').replace(/'/g, "\\'");
            var _vt = (v.title || '').replace(/'/g, "\\'");
            return '<div style="padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.04)">'
                + '<div onclick="rmSelectTrack(\'' + _vu + '\',\'' + _vt + '\')" style="cursor:pointer;display:flex;align-items:center;gap:8px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">'
                + '<span style="color:#ef4444">▶</span><div style="flex:1;min-width:0"><div style="color:#e2e8f0;font-size:0.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + v.title + '</div>'
                + '<div style="color:#64748b;font-size:0.68em">' + (v.author || '') + ' · ' + (v.duration || '') + '</div></div></div>'
                + '<div style="display:flex;gap:4px;margin-top:3px;padding-left:20px">'
                + '<button onclick="rmPlayInline(\'' + _vu + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(239,68,68,0.25);color:#f87171;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">👁 Preview</button>'
                + '<button onclick="rmSetAsNorthStar(\'' + _st + '\',\'' + _vu + '\',\'' + _vt + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(102,126,234,0.25);color:#a5b4fc;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">⭐ North Star</button>'
                + '<button onclick="rmAddAsLesson(\'' + _st + '\',\'' + _vu + '\',\'' + _vt + '\')" style="padding:2px 8px;background:none;border:1px solid rgba(34,197,94,0.25);color:#86efac;border-radius:4px;cursor:pointer;font-size:0.62em;font-weight:600">🎓 Lesson</button>'
                + '</div></div>';
        }).join('');
    } catch(e) { c.innerHTML = '<div style="color:#ef4444;font-size:0.82em;padding:8px">Error: ' + e.message + '</div>'; }
}

async function rmRunFadr(songTitle) { if (!pmSelectedAudioUrl) return; var m = document.getElementById('fadrImportModal'); if (m) m.remove(); importHarmoniesFromFadr(songTitle); setTimeout(function() { var u = document.getElementById('fadrArchiveUrl'); if (u) u.value = pmSelectedAudioUrl; }, 100); }

// ── Search All Sources at once ───────────────────────────────────────────────
async function rmSearchAllSources() {
    var song = rmQueue[rmIndex]; if (!song) return;
    var isPhish = /phish/i.test(song.band || '');
    showToast('🔍 Searching all sources...', 2000);
    // Fire all searches in parallel
    var promises = [rmSearchArchive(), rmSearchRelisten()];
    if (isPhish) promises.push(rmSearchPhishIn());
    await Promise.allSettled(promises);
    showToast('✅ All searches complete', 1500);
}

// ══════════════════════════════════════════════════════════════════════════════
// RECORD TAB — Multi-Track Studio wrapper
// ══════════════════════════════════════════════════════════════════════════════
async function rmLoadRecord() {
    const song = rmQueue[rmIndex]; if(!song) return;
    const el = document.getElementById('rmRecordContent');
    let sections = [];
    try { const h = await loadBandDataFromDrive(song.title,'harmonies_data'); sections = toArray(h?.sections||[]); } catch(e) {}
    if (!sections.length) {
        el.innerHTML = `<div style="text-align:center;padding:30px"><div style="font-size:2em;margin-bottom:12px">🎙️</div>
            <div style="color:#e2e8f0;font-size:0.95em;margin-bottom:12px">No harmony sections yet for <strong>${song.title}</strong></div>
            <div style="color:#94a3b8;font-size:0.82em;margin-bottom:20px">Add harmony sections in the main song view first, then record here.</div>
            <button onclick="closeRehearsalMode();setTimeout(function(){var el=document.getElementById("step4cover");if(el){el.classList.remove("hidden");el.scrollIntoView({behavior:"smooth",block:"start"});}},400)" style="padding:10px 20px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:600">Go to Song View → Harmonies</button></div>`;
        return;
    }
    el.innerHTML = `<div style="margin-bottom:12px"><div style="color:#e2e8f0;font-weight:700;margin-bottom:8px">🎙️ Record Harmony Parts</div>
        <div style="color:#94a3b8;font-size:0.82em;margin-bottom:16px">Select a section to open the multi-track recorder.</div></div>` +
        sections.map((sec,i) => {
            const pc = toArray(sec.parts||[]).length;
            return `<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <div><div style="color:#e2e8f0;font-weight:600;font-size:0.9em">${sec.name||'Section '+(i+1)}</div>
                        <div style="color:#64748b;font-size:0.75em">${sec.lyric?sec.lyric.substring(0,60)+(sec.lyric.length>60?'…':''):''} · ${pc} parts</div></div>
                    <button onclick="rmOpenStudio('${song.title.replace(/'/g,"\\'")}',${i})" style="padding:8px 14px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.82em;font-weight:600;white-space:nowrap">🎛️ Record</button>
                </div><div id="rmStudioContainer_${i}"></div></div>`;
        }).join('');
}
function rmOpenStudio(songTitle, si) {
    const cid = `rmStudioContainer_${si}`;
    let c = document.getElementById(cid); if(!c)return;
    if(c.innerHTML.trim()){c.innerHTML='';return;}
    c.id = 'harmonyAudioFormContainer' + si;
    if (typeof openMultiTrackStudio === 'function') openMultiTrackStudio(songTitle, si);
    setTimeout(()=>{c.id=cid;},50);
}

// ══════════════════════════════════════════════════════════════════════════════
// SONG LOAD + NAVIGATION
// ══════════════════════════════════════════════════════════════════════════════
async function rmLoadSong() {
    const song = rmQueue[rmIndex]; if(!song)return;
    document.getElementById('rmSongTitle').textContent = song.title;
    document.getElementById('rmPosition').textContent = rmQueue.length>1?`${rmIndex+1} / ${rmQueue.length}`:'';
    document.getElementById('rmPrevBtn').style.opacity = rmIndex>0?'1':'0.25';
    document.getElementById('rmNextBtn').style.opacity = rmIndex<rmQueue.length-1?'1':'0.25';
    document.getElementById('rmSongMeta').textContent = '';
    rmLoadMeta(song.title, rmIndex);
    rmLoadChart();
    // Band Sync: broadcast song change if leader
    if (typeof GLStore !== 'undefined' && GLStore.isSyncLeader && GLStore.isSyncLeader()) {
        var _songData = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title === song.title; }) : null;
        var _songId = _songData ? (_songData.songId || song.title) : song.title;
        GLStore.syncBroadcastSong(_songId, song.title);
    }
    // Render sync bar (may have changed)
    _rmRenderSyncBar();
    // Rehearsal planner: show block guidance if available
    _rmRenderBlockGuidance(song.title);
    // Show timing bar and start live updates
    _rmRenderTimingBar();
    _rmStartTimingUpdates();
    // Non-chart tabs use lazy-load on first switch (lines 216-228) — don't eagerly load all 5
    // Reset tab content to loading state so lazy-load triggers on switch
    ['rmKnowContent','rmMemoryContent','rmHarmonyContent','rmRecordContent'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.innerHTML = '<div class="rm-loading" style="padding:20px;text-align:center;color:#64748b">Loading...</div>';
    });
}
async function rmLoadMeta(st, snapshotIdx) {
    // Check in-memory cache first
    var cached = _rmCache[st];
    if (cached && cached.meta) {
        document.getElementById('rmSongMeta').textContent = cached.meta;
        return;
    }
    try {
        // Parallel reads instead of sequential
        var results = await Promise.all([
            loadBandDataFromDrive(st,'song_meta').catch(function(){return {};}),
            loadBandDataFromDrive(st,'song_bpm').catch(function(){return {};}),
            loadBandDataFromDrive(st,'key').catch(function(){return {};})
        ]);
        // Stale check: if user navigated during async load, discard
        if (typeof snapshotIdx === 'number' && rmIndex !== snapshotIdx) return;
        var m=results[0]||{}, b=results[1]||{}, k=results[2]||{};
        // Fallback for legacy key path
        if (!k.key) { try { k = (await loadBandDataFromDrive(st,'song_key'))||{}; } catch(e2){} }
        var p=[]; if(k.key||m.key)p.push('🔑 '+(k.key||m.key)); if(b.bpm||m.bpm)p.push('🥁 '+(b.bpm||m.bpm)+' BPM'); if(m.leadSinger)p.push('🎤 '+m.leadSinger.charAt(0).toUpperCase()+m.leadSinger.slice(1));
        var metaStr = p.join('  ·  ');
        document.getElementById('rmSongMeta').textContent = metaStr;
        // Cache
        if (!_rmCache[st]) _rmCache[st] = {};
        _rmCache[st].meta = metaStr;
        _rmCache[st].ts = Date.now();
    } catch(e) {}
}
function rmNavigate(dir) {
    var now = Date.now();
    if (now - _rmNavLock < 300) return;
    _rmNavLock = now;
    var n = rmIndex + dir;
    if (n < 0 || n >= rmQueue.length) return;
    // Record elapsed time for current block
    _rmRecordBlockTime();
    rmIndex = n;
    _rmBlockStartTime = Date.now();
    rmLoadSong();
}
function rmKeyHandler(e) {
    const ov=document.getElementById('rmOverlay'); if(!ov?.classList.contains('rm-visible'))return; if(rmEditing)return;
    if(e.key==='Escape'){closeRehearsalMode();e.preventDefault();} if(e.key==='ArrowRight'){rmNavigate(1);e.preventDefault();} if(e.key==='ArrowLeft'){rmNavigate(-1);e.preventDefault();}
}

// ── Quick actions ────────────────────────────────────────────────────────────
function rmAddNote(){document.getElementById('rmNoteInput').value='';document.getElementById('rmNoteSheet').classList.remove('hidden');document.getElementById('rmNoteInput').focus();}
function rmCloseSheet(id){document.getElementById(id)?.classList.add('hidden');}
async function rmSaveNote(){const s=rmQueue[rmIndex],t=document.getElementById('rmNoteInput').value.trim();if(!t)return;try{const n=toArray(await loadBandDataFromDrive(s.title,'rehearsal_notes')||[]);n.push({text:t,author:(typeof getCurrentMemberKey==='function'?getCurrentMemberKey():'drew'),date:new Date().toISOString(),priority:'normal'});if(typeof GLStore!=='undefined'&&GLStore.saveSongData){await GLStore.saveSongData(s.title,'rehearsal_notes',n);}else{await saveBandDataToDrive(s.title,'rehearsal_notes',n);}rmCloseSheet('rmNoteSheet');showToast('📋 Note saved!');}catch(e){showToast('❌ Note save failed');}}
function rmAddSongToQueue(){const p=document.getElementById('rmQueuePicker');p.innerHTML='<option value="">— Pick a song —</option>';const iq=new Set(rmQueue.map(s=>s.title));(typeof allSongs!=='undefined'?allSongs:[]).forEach(s=>{if(!iq.has(s.title)){const o=document.createElement('option');o.value=s.title;o.textContent=s.title+(s.band?' · '+s.band:'');p.appendChild(o);}});document.getElementById('rmQueueSheet').classList.remove('hidden');}
function rmConfirmAddSong(){const t=document.getElementById('rmQueuePicker').value;if(!t)return;const sd=(typeof allSongs!=='undefined'?allSongs:[]).find(s=>s.title===t);rmQueue.splice(rmIndex+1,0,{title:t,band:sd?.band||''});rmCloseSheet('rmQueueSheet');showToast(`✅ "${t}" added — next up`);document.getElementById('rmPosition').textContent=rmQueue.length>1?`${rmIndex+1} / ${rmQueue.length}`:'';document.getElementById('rmNextBtn').style.opacity='1';}
function rmOpenYouTube(){const s=rmQueue[rmIndex];window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(s.title+' '+_rmFullBandName(s.band)+' live'),'_blank');}
function rmOpenPocketMeter() {
    var song = rmQueue[rmIndex] || {};
    var bpm  = rmSongBpm || 120;
    var key  = (typeof rmSongKey !== 'undefined' ? rmSongKey : '') || '';
    if (typeof openGigPocketMeter === 'function') {
        openGigPocketMeter(song.title || '', bpm, key);
    } else {
        showToast('Pocket Meter not loaded yet');
    }
}
function rmOpenMoises(){window.open('https://studio.moises.ai/library/','_blank');}

// ── Touch swipe ──────────────────────────────────────────────────────────────
(function(){let sx=0;document.addEventListener('touchstart',e=>{if(document.getElementById('rmPalaceWalkOverlay'))return;const o=document.getElementById('rmOverlay');if(!o?.classList.contains('rm-visible')||rmEditing)return;sx=e.touches[0].clientX;},{passive:true});document.addEventListener('touchend',e=>{if(document.getElementById('rmPalaceWalkOverlay'))return;const o=document.getElementById('rmOverlay');if(!o?.classList.contains('rm-visible')||rmEditing)return;const dx=e.changedTouches[0].clientX-sx;if(Math.abs(dx)>60)rmNavigate(dx<0?1:-1);},{passive:true});})();

// Vote on North Star from Practice Mode Listen tab
window.rmVoteNorthStar = async function(songTitle) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    try {
        var versions = toArray(await loadBandDataFromDrive(songTitle, 'spotify_versions') || []);
        if (!versions.length) { if (typeof showToast === 'function') showToast('No North Star to vote on'); return; }
        // Find the top-voted version (same logic as the loader)
        var best = versions[0], bestVotes = 0;
        versions.forEach(function(v, i) {
            var vc = v.votes ? Object.keys(v.votes).filter(function(k){ return v.votes[k]; }).length : 0;
            if (vc > bestVotes || i === 0) { best = v; bestVotes = vc; }
        });
        var idx = versions.indexOf(best);
        var email = typeof currentUserEmail !== 'undefined' ? currentUserEmail : '';
        if (!email) { if (typeof showToast === 'function') showToast('Sign in to vote'); return; }
        // Sanitize email for Firebase key (no . # $ / [ ])
        var safeEmail = email.replace(/\./g, '_').replace(/[#$\/\[\]]/g, '_');
        if (!versions[idx].votes) versions[idx].votes = {};
        versions[idx].votes[safeEmail] = !versions[idx].votes[safeEmail];
        versions[idx].totalVotes = Object.values(versions[idx].votes).filter(Boolean).length;
        await saveBandDataToDrive(songTitle, 'spotify_versions', versions);
        if (typeof showToast === 'function') showToast(versions[idx].votes[safeEmail] ? '⭐ Voted!' : 'Vote removed');
        // Refresh the Listen tab
        rmLoadHarmony();
    } catch(e) {
        if (typeof showToast === 'function') showToast('Vote failed');
    }
};

// Edit North Star URL from Practice Mode
window.rmEditNorthStarUrl = async function(songTitle) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    try {
        var versions = toArray(await loadBandDataFromDrive(songTitle, 'spotify_versions') || []);
        if (!versions.length) { if (typeof showToast === 'function') showToast('No North Star to edit'); return; }
        var best = versions[0], bestVotes = 0;
        versions.forEach(function(v, i) {
            var vc = v.votes ? Object.keys(v.votes).filter(function(k){ return v.votes[k]; }).length : 0;
            if (vc > bestVotes || i === 0) { best = v; bestVotes = vc; }
        });
        var idx = versions.indexOf(best);
        var currentUrl = versions[idx].url || versions[idx].spotifyUrl || '';
        var newUrl = prompt('Edit North Star URL:\n(Paste any link — YouTube, Spotify, Archive, etc.)', currentUrl);
        if (newUrl === null || newUrl.trim() === '' || newUrl.trim() === currentUrl) return;
        var trimmed = newUrl.trim();
        try { new URL(trimmed); } catch(e) { alert('Please paste a valid URL'); return; }
        versions[idx].url = trimmed;
        versions[idx].spotifyUrl = trimmed;
        versions[idx].editedBy = typeof currentUserEmail !== 'undefined' ? currentUserEmail : '';
        versions[idx].editedAt = new Date().toISOString();
        await saveBandDataToDrive(songTitle, 'spotify_versions', versions);
        if (typeof showToast === 'function') showToast('✅ North Star URL updated');
        rmLoadHarmony();
    } catch(e) {
        if (typeof showToast === 'function') showToast('Edit failed');
    }
};

// Set a search result as North Star directly from Listen tab
window.rmSetAsNorthStar = async function(songTitle, url, title) {
    if (typeof requireSignIn === 'function' && !requireSignIn()) return;
    if (!songTitle || !url) return;
    try {
        var versions = toArray(await loadBandDataFromDrive(songTitle, 'spotify_versions') || []);
        var safeEmail = typeof currentUserEmail !== 'undefined' ? currentUserEmail.replace(/\./g,'_').replace(/[#$\/\[\]]/g,'_') : '';
        var version = {
            id: 'version_' + Date.now(),
            title: title || 'From search',
            url: url, spotifyUrl: url,
            platform: url.indexOf('youtube') !== -1 || url.indexOf('youtu.be') !== -1 ? 'youtube' : 'link',
            votes: {}, totalVotes: 0, isDefault: false,
            addedBy: typeof currentUserEmail !== 'undefined' ? currentUserEmail : '',
            notes: 'Added from Practice Mode', dateAdded: new Date().toLocaleDateString()
        };
        if (typeof bandMembers !== 'undefined') Object.keys(bandMembers).forEach(function(k) { version.votes[k.replace(/\./g,'_')] = false; });
        if (safeEmail) { version.votes[safeEmail] = true; version.totalVotes = 1; }
        versions.push(version);
        await saveBandDataToDrive(songTitle, 'spotify_versions', versions);
        if (typeof showToast === 'function') showToast('⭐ Added as North Star!');
        rmLoadHarmony();
    } catch(e) {
        if (typeof showToast === 'function') showToast('Failed to save');
    }
};

// Per-user lesson storage key
function _rmLessonKey() {
    try {
        var email = typeof currentUserEmail !== 'undefined' ? currentUserEmail : '';
        if (email) return 'my_lessons_' + email.replace(/[.#$/\[\]]/g, '_');
    } catch(e) {}
    return 'my_lessons';
}

// Add a search result as a Lesson (per-user)
window.rmAddAsLesson = async function(songTitle, url, title) {
    if (!songTitle || !url) return;
    try {
        var key = _rmLessonKey();
        var lessons = toArray(await loadBandDataFromDrive(songTitle, key) || []);
        lessons.push({
            id: 'lesson_' + Date.now(),
            title: title || 'Lesson',
            url: url,
            addedBy: typeof currentUserEmail !== 'undefined' ? currentUserEmail : '',
            addedAt: new Date().toISOString()
        });
        await saveBandDataToDrive(songTitle, key, lessons);
        if (typeof showToast === 'function') showToast('🎓 Saved as lesson!');
        rmLoadHarmony();
    } catch(e) {
        if (typeof showToast === 'function') showToast('Failed to save');
    }
};

// Remove a lesson (per-user)
window.rmRemoveLesson = async function(songTitle, idx) {
    try {
        var key = _rmLessonKey();
        var lessons = toArray(await loadBandDataFromDrive(songTitle, key) || []);
        lessons.splice(idx, 1);
        await saveBandDataToDrive(songTitle, key, lessons);
        if (typeof showToast === 'function') showToast('Lesson removed');
        rmLoadHarmony();
    } catch(e) {}
};

// Inline player for North Star and YouTube preview
window.rmPlayInline = function(url) {
    var existing = document.getElementById('rmInlinePlayer');
    if (existing) existing.remove();

    var videoId = null;
    var m = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (m) videoId = m[1];

    var player = document.createElement('div');
    player.id = 'rmInlinePlayer';
    player.style.cssText = 'position:fixed;bottom:60px;left:8px;right:8px;z-index:9998;background:#0f172a;border:1px solid rgba(99,102,241,0.3);border-radius:12px;overflow:hidden;box-shadow:0 -8px 30px rgba(0,0,0,0.6)';

    if (videoId) {
        player.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:rgba(0,0,0,0.4)">'
            + '<span style="font-size:0.72em;color:#a5b4fc;font-weight:600">Now Playing</span>'
            + '<button onclick="document.getElementById(\'rmInlinePlayer\').remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em">✕</button></div>'
            + '<div style="position:relative;padding-bottom:56.25%;height:0"><iframe src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none" allow="autoplay;encrypted-media" allowfullscreen></iframe></div>';
    } else {
        // Non-YouTube URL — open in new tab as fallback
        window.open(url, '_blank');
        return;
    }
    document.body.appendChild(player);
};

console.log('🎸 Practice Mode 5-Tab loaded (Chart · Know · Memory · Harmony · Record)');
