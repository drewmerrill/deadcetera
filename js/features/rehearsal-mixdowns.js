// ============================================================================
// js/features/rehearsal-mixdowns.js — Full Rehearsal Recordings
//
// Session-level rehearsal mixdown archive. Upload MP3 or paste Drive link.
// In-app audio player + one-click Rehearsal Chopper integration.
//
// Firebase: bands/{slug}/rehearsal_mixdowns/{id}
//
// DEPENDS ON: loadBandDataFromDrive, saveBandDataToDrive, showToast,
//             openRehearsalChopper (bestshot.js)
// ============================================================================

'use strict';

window.RehearsalMixdowns = (function() {

    var _DATA_KEY = 'rehearsal_mixdowns';
    var _cache = null;

    // ── Data ────────────────────────────────────────────────────────────────

    async function _load() {
        if (_cache) return _cache;
        var raw = await loadBandDataFromDrive('_band', _DATA_KEY) || {};
        _cache = Object.keys(raw).map(function(k) { var m = raw[k]; m.id = k; return m; });
        _cache.sort(function(a, b) { return (b.rehearsal_date || b.created_at || '').localeCompare(a.rehearsal_date || a.created_at || ''); });
        return _cache;
    }

    async function _save(id, data) {
        var all = await loadBandDataFromDrive('_band', _DATA_KEY) || {};
        all[id] = data;
        await saveBandDataToDrive('_band', _DATA_KEY, all);
        _cache = null; // bust cache
    }

    async function _delete(id) {
        var all = await loadBandDataFromDrive('_band', _DATA_KEY) || {};
        delete all[id];
        await saveBandDataToDrive('_band', _DATA_KEY, all);
        _cache = null;
    }

    function _genId() { return 'mx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

    // ── Render ──────────────────────────────────────────────────────────────

    async function render(containerId) {
        var el = containerId ? document.getElementById(containerId) : null;
        if (!el) return;
        el.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Loading mixdowns\u2026</div>';

        var items = await _load();

        var html = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
            + '<div style="font-weight:700;font-size:0.95em">\uD83C\uDFA4 Recordings</div>'
            + '<button onclick="RehearsalMixdowns.showAddForm()" class="btn btn-primary btn-sm" style="font-size:0.78em">+ Add Recording</button>'
            + '</div>';

        html += '<div id="rmAddFormArea"></div>';

        if (!items.length) {
            html += '<div style="text-align:center;color:var(--text-dim);padding:30px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px">'
                + '<div style="font-size:1.5em;margin-bottom:6px">\uD83C\uDFA7</div>'
                + '<div style="font-size:0.85em;margin-bottom:4px">No recordings yet</div>'
                + '<div style="font-size:0.75em;color:#475569">Add your first rehearsal recording</div>'
                + '</div>';
        } else {
            items.forEach(function(m) {
                html += _renderCard(m);
            });
        }

        el.innerHTML = html;
    }

    function _renderCard(m) {
        var dateStr = m.rehearsal_date ? _formatDate(m.rehearsal_date) : '';
        var hasAudio = !!m.audio_url;
        var hasDrive = !!m.drive_url;
        var durationStr = m.duration ? _formatDuration(m.duration) : '';
        var notesPreview = m.notes ? _esc(m.notes).substring(0, 80) + (m.notes.length > 80 ? '\u2026' : '') : '';

        var html = '<div class="app-card" style="padding:10px 14px;margin-bottom:8px">';

        // Header row: title + date
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">';
        html += '<div style="font-weight:700;font-size:0.9em;color:var(--text)">' + _esc(m.title || 'Untitled Mixdown') + '</div>';
        html += '<div style="font-size:0.72em;color:var(--text-dim)">' + dateStr + '</div>';
        html += '</div>';

        // Meta row: duration + setlist + notes
        var meta = [];
        if (durationStr) meta.push(durationStr);
        if (m.linked_setlist_name) meta.push('\uD83D\uDCCB ' + _esc(m.linked_setlist_name));
        if (meta.length) html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:4px">' + meta.join(' \u00B7 ') + '</div>';
        if (notesPreview) html += '<div style="font-size:0.75em;color:#64748b;margin-bottom:6px">' + notesPreview + '</div>';

        // Audio player
        if (hasAudio) {
            html += '<audio controls preload="metadata" style="width:100%;height:36px;margin-bottom:6px" src="' + _esc(m.audio_url) + '"></audio>';
        }

        // Action buttons
        html += '<div style="display:flex;gap:6px;flex-wrap:wrap">';

        if (hasAudio) {
            html += '<button onclick="RehearsalMixdowns.openInChopper(\'' + _esc(m.id) + '\')" style="padding:5px 10px;border-radius:6px;font-size:0.72em;font-weight:700;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.06);color:#fbbf24;cursor:pointer">\u2702\uFE0F Chopper</button>';
        }

        if (hasDrive) {
            html += '<a href="' + _esc(m.drive_url) + '" target="_blank" rel="noopener" style="padding:5px 10px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(66,133,244,0.3);background:rgba(66,133,244,0.06);color:#60a5fa;cursor:pointer;text-decoration:none">\uD83D\uDCC1 Open in Drive</a>';
        }

        if (m.audio_url || m.drive_url) {
            html += '<button onclick="RehearsalMixdowns._copyLink(\'' + _esc(m.id) + '\')" style="padding:5px 10px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">\uD83D\uDD17 Copy Link</button>';
        }

        html += '<button onclick="RehearsalMixdowns.showEditForm(\'' + _esc(m.id) + '\')" style="padding:5px 10px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">\u270F\uFE0F Edit</button>';

        html += '<button onclick="RehearsalMixdowns.deleteMixdown(\'' + _esc(m.id) + '\')" style="padding:5px 10px;border-radius:6px;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.08);background:none;color:#64748b;cursor:pointer">\uD83D\uDDD1\uFE0F</button>';

        html += '</div></div>';
        return html;
    }

    // ── Add / Edit Form ─────────────────────────────────────────────────────

    function showAddForm() {
        _renderForm(null);
    }

    async function showEditForm(id) {
        var items = await _load();
        var m = items.find(function(x) { return x.id === id; });
        if (!m) return;
        _renderForm(m);
    }

    function _renderForm(existing) {
        var area = document.getElementById('rmAddFormArea');
        if (!area) return;

        var isEdit = !!existing;
        var m = existing || {};
        var today = new Date().toISOString().split('T')[0];

        var html = '<div class="app-card" style="padding:14px;margin-bottom:12px;border:1px solid rgba(99,102,241,0.2)">';
        html += '<div style="font-weight:700;font-size:0.88em;margin-bottom:10px">' + (isEdit ? '\u270F\uFE0F Edit Mixdown' : '+ New Mixdown') + '</div>';

        html += '<div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">';
        html += '<input id="rmTitle" class="app-input" placeholder="Title (e.g. Full Run 03/20)" value="' + _esc(m.title || '') + '" style="flex:2;min-width:140px;font-size:0.85em">';
        html += '<input id="rmDate" class="app-input" type="date" value="' + (m.rehearsal_date || today) + '" style="width:130px;font-size:0.82em">';
        html += '</div>';

        html += '<input id="rmNotes" class="app-input" placeholder="Notes (optional)" value="' + _esc(m.notes || '') + '" style="width:100%;font-size:0.82em;margin-bottom:8px;box-sizing:border-box">';

        // Audio source
        html += '<div style="font-size:0.75em;font-weight:600;color:var(--text-dim);margin-bottom:4px">Audio Source</div>';
        html += '<input id="rmDriveUrl" class="app-input" placeholder="Google Drive share link (optional)" value="' + _esc(m.drive_url || '') + '" style="width:100%;font-size:0.82em;margin-bottom:6px;box-sizing:border-box">';
        html += '<input id="rmAudioUrl" class="app-input" placeholder="Direct audio URL (optional)" value="' + _esc(m.audio_url || '') + '" style="width:100%;font-size:0.82em;margin-bottom:6px;box-sizing:border-box">';

        // File upload
        html += '<div style="border:1px dashed rgba(255,255,255,0.15);border-radius:8px;padding:12px;text-align:center;cursor:pointer;margin-bottom:8px" onclick="document.getElementById(\'rmFileInput\').click()">';
        html += '<input type="file" id="rmFileInput" accept="audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac" style="display:none" onchange="RehearsalMixdowns._onFileSelected(this)">';
        html += '<div style="font-size:0.82em;color:var(--text-dim)">\uD83D\uDCE4 Or tap to upload MP3/audio file</div>';
        html += '<div id="rmFileName" style="font-size:0.72em;color:#818cf8;margin-top:4px"></div>';
        html += '</div>';

        // Duration + linked setlist
        html += '<div style="display:flex;gap:8px;margin-bottom:8px">';
        html += '<input id="rmDuration" class="app-input" type="number" placeholder="Duration (min)" value="' + (m.duration || '') + '" style="width:100px;font-size:0.82em">';
        html += '<input id="rmSetlistId" class="app-input" placeholder="Linked setlist name (optional)" value="' + _esc(m.linked_setlist_name || '') + '" style="flex:1;font-size:0.82em">';
        html += '</div>';

        // Buttons
        html += '<div style="display:flex;gap:8px">';
        html += '<button onclick="RehearsalMixdowns._saveForm(\'' + (isEdit ? m.id : '') + '\')" class="btn btn-success btn-sm" style="flex:2;font-size:0.82em">\uD83D\uDCBE Save</button>';
        html += '<button onclick="document.getElementById(\'rmAddFormArea\').innerHTML=\'\'" class="btn btn-ghost btn-sm" style="flex:1;font-size:0.82em">Cancel</button>';
        html += '</div></div>';

        area.innerHTML = html;
    }

    var _pendingFile = null;

    function _onFileSelected(input) {
        if (!input.files || !input.files.length) return;
        _pendingFile = input.files[0];
        var nameEl = document.getElementById('rmFileName');
        if (nameEl) nameEl.textContent = _pendingFile.name + ' (' + Math.round(_pendingFile.size / 1048576) + ' MB)';
    }

    async function _saveForm(existingId) {
        var title = (document.getElementById('rmTitle') || {}).value || '';
        var date = (document.getElementById('rmDate') || {}).value || '';
        var notes = (document.getElementById('rmNotes') || {}).value || '';
        var driveUrl = (document.getElementById('rmDriveUrl') || {}).value || '';
        var audioUrl = (document.getElementById('rmAudioUrl') || {}).value || '';
        var duration = parseInt((document.getElementById('rmDuration') || {}).value) || 0;
        var setlistName = (document.getElementById('rmSetlistId') || {}).value || '';

        if (!title && !date) { if (typeof showToast === 'function') showToast('Add a title or date'); return; }

        // Handle file upload — create object URL for local playback
        // Note: for persistent storage, this would use Firebase Storage like practice tracks
        if (_pendingFile && !audioUrl) {
            // Create a local blob URL for now (persists within session)
            audioUrl = URL.createObjectURL(_pendingFile);
            if (typeof showToast === 'function') showToast('Audio loaded locally \u2014 paste a Drive link to persist');
        }

        var id = existingId || _genId();
        var data = {
            title: title || 'Mixdown ' + date,
            rehearsal_date: date,
            notes: notes,
            audio_url: audioUrl,
            drive_url: driveUrl,
            duration: duration,
            linked_setlist_name: setlistName,
            created_at: existingId ? undefined : new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
        };

        // Preserve created_at on edit
        if (existingId) {
            var items = await _load();
            var prev = items.find(function(x) { return x.id === existingId; });
            if (prev && prev.created_at) data.created_at = prev.created_at;
        }

        // Clean undefined
        Object.keys(data).forEach(function(k) { if (data[k] === undefined) delete data[k]; });

        await _save(id, data);
        _pendingFile = null;
        if (typeof showToast === 'function') showToast('\u2705 Mixdown saved');
        render('rhMixdownsContainer');
    }

    // ── Delete ──────────────────────────────────────────────────────────────

    async function deleteMixdown(id) {
        if (!confirm('Delete this mixdown?')) return;
        await _delete(id);
        if (typeof showToast === 'function') showToast('Mixdown deleted');
        render('rhMixdownsContainer');
    }

    // ── Chopper Integration ─────────────────────────────────────────────────

    async function openInChopper(id) {
        var items = await _load();
        var m = items.find(function(x) { return x.id === id; });
        if (!m) return;

        // Open Rehearsal Chopper
        if (typeof openRehearsalChopper === 'function') {
            openRehearsalChopper();
            // Wait for modal to render, then load the audio
            setTimeout(function() {
                if (m.audio_url) {
                    var audio = document.getElementById('chopAudio');
                    if (audio) {
                        audio.src = m.audio_url;
                        // Set context info
                        var titleEl = document.querySelector('#rehearsalChopperModal [style*="font-weight:800"]');
                        if (titleEl) titleEl.textContent = '\u2702\uFE0F Chopper: ' + (m.title || 'Mixdown');
                    }
                }
                if (typeof showToast === 'function') showToast('Loaded: ' + (m.title || 'Mixdown'));
            }, 300);
        } else {
            if (typeof showToast === 'function') showToast('Rehearsal Chopper not available');
        }
    }

    // ── Copy Link ───────────────────────────────────────────────────────────

    async function _copyLink(id) {
        var items = await _load();
        var m = items.find(function(x) { return x.id === id; });
        if (!m) return;
        var url = m.audio_url || m.drive_url || '';
        if (!url) { if (typeof showToast === 'function') showToast('No link to copy'); return; }
        try {
            await navigator.clipboard.writeText(url);
            if (typeof showToast === 'function') showToast('\uD83D\uDD17 Link copied');
        } catch(e) {
            if (typeof showToast === 'function') showToast('Could not copy');
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    function _formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            var d = new Date(dateStr + 'T12:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch(e) { return dateStr; }
    }

    function _formatDuration(min) {
        if (!min) return '';
        var h = Math.floor(min / 60);
        var m = min % 60;
        return h ? h + 'h ' + m + 'm' : m + ' min';
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        render: render,
        showAddForm: showAddForm,
        showEditForm: showEditForm,
        deleteMixdown: deleteMixdown,
        openInChopper: openInChopper,
        _saveForm: _saveForm,
        _onFileSelected: _onFileSelected,
        _copyLink: _copyLink
    };

})();

console.log('\uD83C\uDFA4 rehearsal-mixdowns.js loaded');
