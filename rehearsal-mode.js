// ============================================================================
// REHEARSAL MODE — Deadcetera Band HQ
// Full-screen overlay for on-the-floor rehearsal reference
//
// Entry points:
//   openRehearsalMode(songTitle)           — single song (from song detail)
//   openRehearsalModeFromPlan(dateStr)     — loads full practice-plan queue
//
// Depends on: loadBandDataFromDrive, saveBandDataToDrive, showToast,
//             toArray, allSongs (global), practicePlanActiveDate (global)
// ============================================================================

console.log('%c🎸 DeadCetera BUILD: 20260301-002814', 'color:#667eea;font-weight:bold;font-size:14px');
// ── State ───────────────────────────────────────────────────────────────────
let rmQueue   = [];   // [{title, band}, ...]
let rmIndex   = 0;    // current position in queue
let rmEditing = false;

// ── Entry: single song ───────────────────────────────────────────────────────
function openRehearsalMode(songTitle) {
    const songData = (typeof allSongs !== 'undefined' ? allSongs : [])
        .find(s => s.title === songTitle);
    rmQueue = [{ title: songTitle, band: songData?.band || '' }];
    rmIndex = 0;
    rmShow();
}

// ── Entry: from practice plan ────────────────────────────────────────────────
async function openRehearsalModeFromPlan(dateStr, startIndex) {
    const date = dateStr || (typeof practicePlanActiveDate !== 'undefined' ? practicePlanActiveDate : null);
    if (!date) {
        showToast('⚠️ No rehearsal plan selected');
        return;
    }
    showToast('Loading rehearsal queue…', 1200);
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${date}`) || {};
    const planSongs = toArray(plan.songs || []);
    if (planSongs.length === 0) {
        showToast('⚠️ No songs in this rehearsal plan yet');
        return;
    }
    rmQueue = planSongs.map(s => ({ title: s.title, band: s.band || '' }));
    rmIndex = (typeof startIndex === 'number' && startIndex >= 0 && startIndex < rmQueue.length)
        ? startIndex : 0;
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

        <!-- FONT SIZE CONTROLS (mobile) -->
        <div class="rm-font-controls" id="rmFontControls">
            <button class="rm-font-btn" onclick="rmAdjustFont(-1)" title="Smaller text">A−</button>
            <button class="rm-font-btn" onclick="rmAdjustFont(1)"  title="Larger text">A+</button>
            <button class="rm-font-btn rm-edit-btn" id="rmEditToggle" onclick="rmToggleEdit()">✏️ Edit Crib</button>
            <button class="rm-font-btn" onclick="rmAddNote()" title="Add rehearsal note">📋 Note</button>
        </div>

        <!-- MAIN CONTENT: chord chart / crib notes -->
        <div class="rm-body" id="rmBody">
            <div class="rm-loading" id="rmLoading">Loading…</div>

            <!-- VIEW mode -->
            <pre class="rm-crib-text" id="rmCribText"></pre>
            <div class="rm-no-crib hidden" id="rmNoCrib">
                <div class="rm-no-crib-icon">🎸</div>
                <div class="rm-no-crib-msg">No chord chart yet for this song.</div>
                <div class="rm-no-crib-sub">Tap <strong>✏️ Edit Crib</strong> above to paste one in.</div>
            </div>

            <!-- EDIT mode -->
            <div class="rm-edit-panel hidden" id="rmEditPanel">
                <div class="rm-edit-label">Stage Crib Notes — paste chord chart, structure, lyrics cues, anything you need on the floor:</div>
                <textarea class="rm-edit-textarea" id="rmEditTextarea" placeholder="G  C  D  G&#10;&#10;[Verse]&#10;A  E  D&#10;&#10;[Chorus]&#10;G  D  Em  C&#10;&#10;Key: G  |  Capo: none  |  BPM: 95"></textarea>
                <div class="rm-edit-actions">
                    <button class="rm-save-btn" onclick="rmSaveCrib()">💾 Save</button>
                    <button class="rm-cancel-btn" onclick="rmCancelEdit()">Cancel</button>
                </div>
            </div>
        </div>

        <!-- FOOTER QUICK ACTIONS -->
        <div class="rm-footer">
            <button class="rm-action-btn" id="rmYtBtn" onclick="rmOpenYouTube()">🎥 YouTube</button>
            <button class="rm-action-btn" id="rmMoisesBtn" onclick="rmOpenMoises()">🎛️ Moises</button>
            <button class="rm-action-btn" onclick="rmAddSongToQueue()">➕ Queue Song</button>
        </div>

        <!-- ADD-NOTE SHEET (hidden by default) -->
        <div class="rm-note-sheet hidden" id="rmNoteSheet">
            <div class="rm-note-sheet-inner">
                <div class="rm-note-sheet-title">📋 Add Rehearsal Note</div>
                <textarea class="rm-edit-textarea" id="rmNoteInput" placeholder="What needs work? E.g., 'Chris entry too early on chorus 2'"></textarea>
                <div class="rm-edit-actions">
                    <button class="rm-save-btn" onclick="rmSaveNote()">Save Note</button>
                    <button class="rm-cancel-btn" onclick="rmCloseNoteSheet()">Cancel</button>
                </div>
            </div>
        </div>

        <!-- ADD-SONG-TO-QUEUE SHEET (hidden by default) -->
        <div class="rm-note-sheet hidden" id="rmQueueSheet">
            <div class="rm-note-sheet-inner">
                <div class="rm-note-sheet-title">➕ Add Song to Queue</div>
                <select class="rm-queue-select" id="rmQueuePicker">
                    <option value="">— Pick a song —</option>
                </select>
                <div class="rm-edit-actions">
                    <button class="rm-save-btn" onclick="rmConfirmAddSong()">Add</button>
                    <button class="rm-cancel-btn" onclick="rmCloseQueueSheet()">Cancel</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(el);

    // Keyboard nav
    document.addEventListener('keydown', rmKeyHandler);
}

// ── Open / close ─────────────────────────────────────────────────────────────
function rmShow() {
    rmEnsureOverlay();
    const overlay = document.getElementById('rmOverlay');
    overlay.classList.add('rm-visible');
    document.body.style.overflow = 'hidden';
    rmEditing = false;
    rmLoadSong();
}

function closeRehearsalMode() {
    const overlay = document.getElementById('rmOverlay');
    if (!overlay) return;
    overlay.classList.remove('rm-visible');
    document.body.style.overflow = '';
    rmEditing = false;
}

// ── Load current song ────────────────────────────────────────────────────────
async function rmLoadSong() {
    const song = rmQueue[rmIndex];
    if (!song) return;

    // Header
    document.getElementById('rmSongTitle').textContent = song.title;
    document.getElementById('rmPosition').textContent =
        rmQueue.length > 1 ? `${rmIndex + 1} / ${rmQueue.length}` : '';
    document.getElementById('rmPrevBtn').style.opacity = rmIndex > 0 ? '1' : '0.25';
    document.getElementById('rmNextBtn').style.opacity = rmIndex < rmQueue.length - 1 ? '1' : '0.25';

    // Meta line (key + BPM from Drive)
    document.getElementById('rmSongMeta').textContent = '';
    rmLoadMeta(song.title);

    // Reset view
    rmCancelEdit(true);
    document.getElementById('rmLoading').style.display = 'block';
    document.getElementById('rmCribText').style.display = 'none';
    document.getElementById('rmNoCrib').classList.add('hidden');

    // Load crib from Drive
    let crib = null;
    try {
        crib = await loadBandDataFromDrive(song.title, 'rehearsal_crib');
    } catch(e) {}

    // Fallback: pull gig_notes and join them as plain text
    if (!crib) {
        try {
            const gigNotes = toArray(await loadBandDataFromDrive(song.title, 'gig_notes') || []);
            if (gigNotes.length > 0) crib = gigNotes.join('\n');
        } catch(e) {}
    }

    document.getElementById('rmLoading').style.display = 'none';

    if (crib && crib.trim()) {
        document.getElementById('rmCribText').textContent = crib;
        document.getElementById('rmCribText').style.display = 'block';
        document.getElementById('rmNoCrib').classList.add('hidden');
        rmAutoFitFont();
    } else {
        document.getElementById('rmCribText').style.display = 'none';
        document.getElementById('rmNoCrib').classList.remove('hidden');
    }
}

async function rmLoadMeta(songTitle) {
    try {
        const meta = await loadBandDataFromDrive(songTitle, 'song_meta') || {};
        const parts = [];
        if (meta.key) parts.push(`🔑 ${meta.key}`);
        if (meta.bpm) parts.push(`🥁 ${meta.bpm} BPM`);
        if (meta.leadSinger) parts.push(`🎤 ${meta.leadSinger.charAt(0).toUpperCase() + meta.leadSinger.slice(1)}`);
        document.getElementById('rmSongMeta').textContent = parts.join('  ·  ');
    } catch(e) {}
}

// ── Navigation ────────────────────────────────────────────────────────────────
function rmNavigate(dir) {
    const newIdx = rmIndex + dir;
    if (newIdx < 0 || newIdx >= rmQueue.length) return;
    rmIndex = newIdx;
    rmLoadSong();
}

function rmKeyHandler(e) {
    const overlay = document.getElementById('rmOverlay');
    if (!overlay?.classList.contains('rm-visible')) return;
    if (rmEditing) return; // don't hijack keyboard while editing
    if (e.key === 'Escape')     { closeRehearsalMode(); e.preventDefault(); }
    if (e.key === 'ArrowRight') { rmNavigate(1);  e.preventDefault(); }
    if (e.key === 'ArrowLeft')  { rmNavigate(-1); e.preventDefault(); }
}

// ── Font size ─────────────────────────────────────────────────────────────────
let rmFontSize = 16; // px baseline

function rmAdjustFont(delta) {
    rmFontSize = Math.min(30, Math.max(10, rmFontSize + delta * 2));
    document.getElementById('rmCribText').style.fontSize = rmFontSize + 'px';
}

function rmAutoFitFont() {
    const isTablet = window.innerWidth >= 768;
    if (!isTablet) {
        // iPhone: use comfortable reading size, let it scroll
        rmFontSize = 16;
        document.getElementById('rmCribText').style.fontSize = rmFontSize + 'px';
        return;
    }

    // iPad: binary-search a font size that fits without scrolling
    const body = document.getElementById('rmBody');
    const pre  = document.getElementById('rmCribText');
    const availH = body.clientHeight - 32; // 16px padding top+bottom

    let lo = 10, hi = 26, best = 14;
    for (let i = 0; i < 8; i++) {
        const mid = Math.floor((lo + hi) / 2);
        pre.style.fontSize = mid + 'px';
        if (pre.scrollHeight <= availH) { best = mid; lo = mid + 1; }
        else { hi = mid - 1; }
    }
    rmFontSize = best;
    pre.style.fontSize = rmFontSize + 'px';
}

// ── Edit crib ─────────────────────────────────────────────────────────────────
function rmToggleEdit() {
    if (rmEditing) { rmCancelEdit(); } else { rmStartEdit(); }
}

function rmStartEdit() {
    rmEditing = true;
    const current = document.getElementById('rmCribText').textContent;
    document.getElementById('rmEditTextarea').value = current;
    document.getElementById('rmCribText').style.display = 'none';
    document.getElementById('rmNoCrib').classList.add('hidden');
    document.getElementById('rmEditPanel').classList.remove('hidden');
    document.getElementById('rmEditToggle').textContent = '✕ Cancel';
    document.getElementById('rmEditTextarea').focus();
}

function rmCancelEdit(silent) {
    rmEditing = false;
    document.getElementById('rmEditPanel')?.classList.add('hidden');
    const toggle = document.getElementById('rmEditToggle');
    if (toggle) toggle.textContent = '✏️ Edit Crib';
    // Restore correct view
    if (!silent) {
        const crib = document.getElementById('rmCribText').textContent;
        if (crib.trim()) {
            document.getElementById('rmCribText').style.display = 'block';
        } else {
            document.getElementById('rmNoCrib').classList.remove('hidden');
        }
    }
}

async function rmSaveCrib() {
    const song = rmQueue[rmIndex];
    const text = document.getElementById('rmEditTextarea').value.trim();
    try {
        await saveBandDataToDrive(song.title, 'rehearsal_crib', text || null);
        document.getElementById('rmCribText').textContent = text;
        rmCancelEdit();
        if (text) {
            document.getElementById('rmCribText').style.display = 'block';
            document.getElementById('rmNoCrib').classList.add('hidden');
            rmAutoFitFont();
        } else {
            document.getElementById('rmCribText').style.display = 'none';
            document.getElementById('rmNoCrib').classList.remove('hidden');
        }
        showToast('✅ Crib notes saved!');
    } catch(e) {
        showToast('❌ Save failed — are you signed in?');
    }
}

// ── Quick action: rehearsal note ──────────────────────────────────────────────
function rmAddNote() {
    document.getElementById('rmNoteInput').value = '';
    document.getElementById('rmNoteSheet').classList.remove('hidden');
    document.getElementById('rmNoteInput').focus();
}

function rmCloseNoteSheet() {
    document.getElementById('rmNoteSheet').classList.add('hidden');
}

async function rmSaveNote() {
    const song = rmQueue[rmIndex];
    const text = document.getElementById('rmNoteInput').value.trim();
    if (!text) return;
    try {
        const notes = toArray(await loadBandDataFromDrive(song.title, 'rehearsal_notes') || []);
        const member = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'drew';
        notes.push({ text, author: member, date: new Date().toISOString(), priority: 'normal' });
        await saveBandDataToDrive(song.title, 'rehearsal_notes', notes);
        rmCloseNoteSheet();
        showToast('📋 Note saved!');
    } catch(e) {
        showToast('❌ Note save failed');
    }
}

// ── Quick action: add song to in-memory queue ─────────────────────────────────
function rmAddSongToQueue() {
    const picker = document.getElementById('rmQueuePicker');
    picker.innerHTML = '<option value="">— Pick a song —</option>';
    const inQueue = new Set(rmQueue.map(s => s.title));
    (typeof allSongs !== 'undefined' ? allSongs : []).forEach(s => {
        if (!inQueue.has(s.title)) {
            const opt = document.createElement('option');
            opt.value = s.title;
            opt.textContent = `${s.title}${s.band ? ' · ' + s.band : ''}`;
            picker.appendChild(opt);
        }
    });
    document.getElementById('rmQueueSheet').classList.remove('hidden');
}

function rmCloseQueueSheet() {
    document.getElementById('rmQueueSheet').classList.add('hidden');
}

function rmConfirmAddSong() {
    const title = document.getElementById('rmQueuePicker').value;
    if (!title) return;
    const songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(s => s.title === title);
    // Insert after current position
    rmQueue.splice(rmIndex + 1, 0, { title, band: songData?.band || '' });
    rmCloseQueueSheet();
    showToast(`✅ "${title}" added — next up`);
    // Refresh position indicator
    document.getElementById('rmPosition').textContent =
        rmQueue.length > 1 ? `${rmIndex + 1} / ${rmQueue.length}` : '';
    document.getElementById('rmNextBtn').style.opacity = '1';
}

// ── Quick links ───────────────────────────────────────────────────────────────
function rmOpenYouTube() {
    const song = rmQueue[rmIndex];
    const q = encodeURIComponent(song.title + ' ' + (song.band || '') + ' live');
    window.open('https://www.youtube.com/results?search_query=' + q, '_blank');
}

function rmOpenMoises() {
    window.open('https://moises.ai/studio', '_blank');
}

// ── Touch swipe support ───────────────────────────────────────────────────────
(function() {
    let startX = 0;
    document.addEventListener('touchstart', e => {
        const overlay = document.getElementById('rmOverlay');
        if (!overlay?.classList.contains('rm-visible')) return;
        if (rmEditing) return;
        startX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        const overlay = document.getElementById('rmOverlay');
        if (!overlay?.classList.contains('rm-visible')) return;
        if (rmEditing) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 60) rmNavigate(dx < 0 ? 1 : -1);
    }, { passive: true });
})();

// ── Expose globals ────────────────────────────────────────────────────────────
// (all functions already global; this comment is just a checklist reminder)
// openRehearsalMode, openRehearsalModeFromPlan, closeRehearsalMode — ✓

console.log('🎸 Rehearsal Mode loaded');
