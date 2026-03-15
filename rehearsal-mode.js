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

console.log('%c🔗 GrooveLinx BUILD: 20260315-152334', 'color:#667eea;font-weight:bold;font-size:14px');
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
}

// ══════════════════════════════════════════════════════════════════════════════
// CHART TAB — 591 imported chord charts + edit
// ══════════════════════════════════════════════════════════════════════════════
async function rmLoadChart() {
    const song = rmQueue[rmIndex]; if (!song) return;
    rmCancelEdit(true);
    document.getElementById('rmChartLoading').style.display = 'block';
    document.getElementById('rmChartText').style.display = 'none';
    document.getElementById('rmNoChart').classList.add('hidden');

    let crib = null;
    try { const cd = await loadBandDataFromDrive(song.title, 'chart'); if (cd?.text?.trim()) crib = cd.text; } catch(e) {}
    if (!crib) { try { crib = await loadBandDataFromDrive(song.title, 'rehearsal_crib'); } catch(e) {} }
    if (!crib) { try { const gn = toArray(await loadBandDataFromDrive(song.title, 'gig_notes') || []); if (gn.length) crib = gn.join('\n'); } catch(e) {} }

    document.getElementById('rmChartLoading').style.display = 'none';
    const safeSong = song.title.replace(/'/g, "\\'");
    const band = song.band || 'Grateful Dead';
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
            <a href="https://www.ultimate-guitar.com/search.php?search_type=title&value=${ugQuery}" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,165,0,0.12);border:1px solid rgba(255,165,0,0.3);border-radius:10px;text-decoration:none;color:#fbbf24;font-weight:600;font-size:0.9em">
                <span style="font-size:1.3em">🎸</span> Search Ultimate Guitar
            </a>
            <a href="https://chordify.net/search/${chordifyQuery}" target="_blank" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(102,126,234,0.12);border:1px solid rgba(102,126,234,0.3);border-radius:10px;text-decoration:none;color:#818cf8;font-weight:600;font-size:0.9em">
                <span style="font-size:1.3em">🎹</span> Search Chordify
            </a>
            <button onclick="rmStartEdit()" style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#94a3b8;font-weight:600;font-size:0.9em;cursor:pointer;width:100%;text-align:left">
                <span style="font-size:1.3em">✏️</span> Paste a Chart Manually
            </button>
            <div id="rmPersonalTabsInChart" style="margin-top:8px"></div>`;
        // Load personal tabs into the chart panel
        rmLoadPersonalTabsInChart(song.title);
    }
}

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
    const band = song.band || 'Grateful Dead';
    const q = encodeURIComponent(song.title + ' ' + band);
    window.open('https://www.ultimate-guitar.com/search.php?search_type=title&value=' + q, '_blank');
}

// ── Auto-Scroll ──────────────────────────────────────────────────────────────
let rmScrollTimer = null;
let rmScrollSpeedLevel = parseInt(localStorage.getItem('rm_scroll_speed') || '3');
function rmToggleAutoScroll() {
    const btn = document.getElementById('rmScrollBtn');
    // show/hide scroll speed controls
    if (rmScrollTimer) {
        clearInterval(rmScrollTimer); rmScrollTimer = null;
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
async function rmSaveChart() {
    const song = rmQueue[rmIndex];
    const text = document.getElementById('rmEditTextarea').value.trim();
    try {
        await saveBandDataToDrive(song.title, 'chart', text ? {text: text} : null);
        rmOriginalChart = text; document.getElementById('rmChartText').textContent = text;
        rmCancelEdit();
        if (text) { document.getElementById('rmChartText').style.display = 'block'; document.getElementById('rmNoChart').classList.add('hidden'); rmAutoFitFont(); }
        else { document.getElementById('rmChartText').style.display = 'none'; document.getElementById('rmNoChart').classList.remove('hidden'); }
        showToast('✅ Chart saved!');
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
    var ss = song.title.replace(/'/g,"\\'"), band = song.band||'Grateful Dead';
    var isPhish = /phish/i.test(band);
    rmHarmonyCache = {}; rmJamChartData = null; rmHarmonySourceFilter = 'all';

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

    el.innerHTML = '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">' + srcTabs + '</div>' +
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
    var filtered = rmHarmonySourceFilter !== 'all' ? results.filter(function(r) { return r.sourceType === rmHarmonySourceFilter; }) : results;
    c.innerHTML = '<div style="color:#64748b;font-size:0.7em;padding:4px 8px">' + filtered.length + ' of ' + results.length + ' shows' + (rmHarmonySourceFilter !== 'all' ? ' (' + rmHarmonySourceFilter + ')' : '') + '</div>' +
        filtered.slice(0, 25).map(function(r) {
            var srcBadge = '', srcColor = '#64748b';
            if (r.sourceType === 'SBD') { srcBadge = '🎛️SBD'; srcColor = '#34d399'; }
            else if (r.sourceType === 'AUD') { srcBadge = '🎤AUD'; srcColor = '#fbbf24'; }
            else if (r.sourceType === 'Matrix') { srcBadge = '🔀MTX'; srcColor = '#818cf8'; }
            var jcBadge = '';
            if (rmJamChartData && r.date) { var ds = (r.date || '').split('T')[0]; var jc = rmJamChartData.find(function(j) { return j.showdate === ds; }); if (jc) jcBadge = '<span style="color:#f59e0b;font-size:0.7em" title="' + (jc.jamchart_description || 'Jam Chart').replace(/"/g,'&quot;') + '">⭐JC</span> '; }
            return '<div onclick="rmSelectShow(\'' + r.identifier + '\')" style="padding:7px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
                '<div style="display:flex;align-items:center;gap:6px">' +
                (srcBadge ? '<span style="color:' + srcColor + ';font-size:0.65em;font-weight:700;padding:1px 5px;border:1px solid ' + srcColor + '33;border-radius:4px;white-space:nowrap">' + srcBadge + '</span>' : '') + jcBadge +
                '<span style="color:#e2e8f0;font-size:0.82em;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (r.title || r.identifier) + '</span></div>' +
                '<div style="color:#64748b;font-size:0.72em;margin-top:2px">' + (r.date ? r.date.split('T')[0] : '') + ' · ⭐ ' + (r.rating ? r.rating.toFixed(1) : '—') + ' · ' + (r.downloads ? r.downloads.toLocaleString() + ' dl' : '') + '</div></div>';
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
    var filtered = rmHarmonySourceFilter === 'SBD' ? results.filter(function(r) { return r.hasSbd; }) : rmHarmonySourceFilter === 'AUD' ? results.filter(function(r) { return !r.hasSbd; }) : results;
    var hdr = '<div style="color:#64748b;font-size:0.7em;padding:4px 8px">' + (songName ? '"' + songName + '" — ' : '') + (timesPlayed ? timesPlayed + ' shows · ' : '') + filtered.length + ' shown' + (rmHarmonySourceFilter !== 'all' ? ' (' + rmHarmonySourceFilter + ')' : '') + '</div>';
    c.innerHTML = hdr + filtered.slice(0, 25).map(function(r) {
        var sbdBadge = r.hasSbd ? '<span style="color:#34d399;font-size:0.65em;font-weight:700;padding:1px 5px;border:1px solid #34d39933;border-radius:4px">SBD</span> ' : '';
        var jcBadge = '';
        if (rmJamChartData && r.date) { var jc = rmJamChartData.find(function(j) { return j.showdate === r.date; }); if (jc) jcBadge = '<span style="color:#f59e0b;font-size:0.7em" title="' + (jc.jamchart_description || '').replace(/"/g,'&quot;') + '">⭐JC</span> '; }
        var loc = [r.venue, r.city, r.state].filter(Boolean).join(', ');
        return '<div onclick="window.open(\'' + r.relistenUrl + '\',\'_blank\')" style="padding:7px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04)" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
            '<div style="display:flex;align-items:center;gap:6px">' + sbdBadge + jcBadge + '<span style="color:#e2e8f0;font-size:0.82em;font-weight:600">' + r.date + '</span></div>' +
            '<div style="color:#64748b;font-size:0.72em;margin-top:2px">' + loc + (r.tapeCount ? ' · 📼 ' + r.tapeCount + ' tapes' : '') + '</div></div>';
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
        c.innerHTML = d.results.map(function(v) {
            return '<div onclick="rmSelectTrack(\'' + v.url + '\',\'' + (v.title || '').replace(/'/g, "\\'") + '\')" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;gap:8px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'\'">' +
                '<span style="color:#ef4444">▶</span><div style="flex:1;min-width:0"><div style="color:#e2e8f0;font-size:0.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + v.title + '</div>' +
                '<div style="color:#64748b;font-size:0.68em">' + (v.author || '') + ' · ' + (v.duration || '') + '</div></div></div>';
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
    rmLoadMeta(song.title);
    rmLoadChart(); rmLoadKnow(); rmLoadMemory(); rmLoadHarmony(); rmLoadRecord();
}
async function rmLoadMeta(st) {
    try {
        const m=await loadBandDataFromDrive(st,'song_meta')||{}, b=await loadBandDataFromDrive(st,'song_bpm')||{}, k=await loadBandDataFromDrive(st,'song_key')||{};
        const p=[]; if(k.key||m.key)p.push('🔑 '+(k.key||m.key)); if(b.bpm||m.bpm)p.push('🥁 '+(b.bpm||m.bpm)+' BPM'); if(m.leadSinger)p.push('🎤 '+m.leadSinger.charAt(0).toUpperCase()+m.leadSinger.slice(1));
        document.getElementById('rmSongMeta').textContent = p.join('  ·  ');
    } catch(e) {}
}
function rmNavigate(dir) { const n=rmIndex+dir; if(n<0||n>=rmQueue.length)return; rmIndex=n; rmLoadSong(); }
function rmKeyHandler(e) {
    const ov=document.getElementById('rmOverlay'); if(!ov?.classList.contains('rm-visible'))return; if(rmEditing)return;
    if(e.key==='Escape'){closeRehearsalMode();e.preventDefault();} if(e.key==='ArrowRight'){rmNavigate(1);e.preventDefault();} if(e.key==='ArrowLeft'){rmNavigate(-1);e.preventDefault();}
}

// ── Quick actions ────────────────────────────────────────────────────────────
function rmAddNote(){document.getElementById('rmNoteInput').value='';document.getElementById('rmNoteSheet').classList.remove('hidden');document.getElementById('rmNoteInput').focus();}
function rmCloseSheet(id){document.getElementById(id)?.classList.add('hidden');}
async function rmSaveNote(){const s=rmQueue[rmIndex],t=document.getElementById('rmNoteInput').value.trim();if(!t)return;try{const n=toArray(await loadBandDataFromDrive(s.title,'rehearsal_notes')||[]);n.push({text:t,author:(typeof getCurrentMemberKey==='function'?getCurrentMemberKey():'drew'),date:new Date().toISOString(),priority:'normal'});await saveBandDataToDrive(s.title,'rehearsal_notes',n);rmCloseSheet('rmNoteSheet');showToast('📋 Note saved!');}catch(e){showToast('❌ Note save failed');}}
function rmAddSongToQueue(){const p=document.getElementById('rmQueuePicker');p.innerHTML='<option value="">— Pick a song —</option>';const iq=new Set(rmQueue.map(s=>s.title));(typeof allSongs!=='undefined'?allSongs:[]).forEach(s=>{if(!iq.has(s.title)){const o=document.createElement('option');o.value=s.title;o.textContent=s.title+(s.band?' · '+s.band:'');p.appendChild(o);}});document.getElementById('rmQueueSheet').classList.remove('hidden');}
function rmConfirmAddSong(){const t=document.getElementById('rmQueuePicker').value;if(!t)return;const sd=(typeof allSongs!=='undefined'?allSongs:[]).find(s=>s.title===t);rmQueue.splice(rmIndex+1,0,{title:t,band:sd?.band||''});rmCloseSheet('rmQueueSheet');showToast(`✅ "${t}" added — next up`);document.getElementById('rmPosition').textContent=rmQueue.length>1?`${rmIndex+1} / ${rmQueue.length}`:'';document.getElementById('rmNextBtn').style.opacity='1';}
function rmOpenYouTube(){const s=rmQueue[rmIndex];window.open('https://www.youtube.com/results?search_query='+encodeURIComponent(s.title+' '+(s.band||'')+' live'),'_blank');}
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

console.log('🎸 Practice Mode 5-Tab loaded (Chart · Know · Memory · Harmony · Record)');
