// ============================================================================
// js/features/charts.js — Chord Chart System (Phase 1)
//
// Song chord charts with master + band versions.
// Inline editing, section labels, notes.
// Setlist Chart Mode for continuous scroll through all songs.
//
// Firebase schema:
//   bands/{slug}/songs/{title}/chart_master  — original chart text
//   bands/{slug}/songs/{title}/chart_band    — band-edited version
//
// DEPENDS ON: loadBandDataFromDrive, saveBandDataToDrive, showToast
// ============================================================================

'use strict';

window.ChartSystem = (function() {

    // ── Load / Save ─────────────────────────────────────────────────────────

    async function loadChart(songTitle) {
        try {
            var master = await loadBandDataFromDrive(songTitle, 'chart_master') || '';
            var band = await loadBandDataFromDrive(songTitle, 'chart_band') || '';
            return { master: master, band: band, hasChart: !!(master || band) };
        } catch(e) {
            return { master: '', band: '', hasChart: false };
        }
    }

    async function saveChart(songTitle, type, content) {
        var key = type === 'master' ? 'chart_master' : 'chart_band';
        try {
            await saveBandDataToDrive(songTitle, key, content);
            if (typeof showToast === 'function') showToast('\u2705 Chart saved');
            return true;
        } catch(e) {
            if (typeof showToast === 'function') showToast('\u26A0\uFE0F Could not save chart');
            return false;
        }
    }

    // ── Render Chart Panel ──────────────────────────────────────────────────
    // Renders into a container element. Shows band chart if exists, else master.

    async function renderChartPanel(containerId, songTitle, songKey, songBpm) {
        var el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim);font-size:0.85em">Loading chart\u2026</div>';

        var data = await loadChart(songTitle);

        // Header
        var html = '<div style="padding:12px">';
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">';
        html += '<div><div style="font-size:1.1em;font-weight:800;color:var(--text)">' + _esc(songTitle) + '</div>';
        var meta = [];
        if (songKey) meta.push('Key: ' + _esc(songKey));
        if (songBpm) meta.push(songBpm + ' BPM');
        if (meta.length) html += '<div style="font-size:0.78em;color:var(--text-dim);margin-top:2px">' + meta.join(' \u00B7 ') + '</div>';
        html += '</div>';
        html += '<div style="display:flex;gap:4px">';
        html += '<button onclick="ChartSystem._toggleEdit(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" id="chartEditBtn" style="font-size:0.72em;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(99,102,241,0.2);background:none;color:#a5b4fc">\u270F Edit</button>';
        html += '<button onclick="ChartSystem._showImport(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="font-size:0.72em;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim)">\uD83D\uDCE5 Import</button>';
        html += '</div></div>';

        // Chart content
        var chartText = data.band || data.master;
        if (!chartText) {
            html += '<div style="text-align:center;padding:24px;color:var(--text-dim);font-size:0.85em">'
                + '<div style="margin-bottom:8px">No chart yet</div>'
                + '<button onclick="ChartSystem._toggleEdit(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="font-size:0.82em;font-weight:700;padding:8px 18px;border-radius:8px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Create Chart</button>'
                + '</div>';
        } else {
            html += '<div id="chartDisplay" style="font-family:\'Courier New\',Courier,monospace;font-size:0.82em;line-height:1.6;color:var(--text-muted);white-space:pre-wrap;padding:10px 12px;background:rgba(0,0,0,0.15);border-radius:8px;border:1px solid rgba(255,255,255,0.04);max-height:60vh;overflow-y:auto">' + _formatChart(chartText) + '</div>';
            if (data.band && data.master) {
                html += '<div style="font-size:0.68em;color:#475569;margin-top:4px">Showing band chart \u00B7 <button onclick="ChartSystem._showMaster(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="color:#818cf8;background:none;border:none;cursor:pointer;font-size:1em">View original</button></div>';
            }
        }

        // Edit area (hidden by default)
        html += '<div id="chartEditArea" style="display:none;margin-top:10px">'
            + '<textarea id="chartEditText" style="width:100%;min-height:200px;font-family:\'Courier New\',Courier,monospace;font-size:0.82em;line-height:1.5;padding:10px 12px;border-radius:8px;border:1px solid rgba(99,102,241,0.2);background:rgba(0,0,0,0.2);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>'
            + '<div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">'
            + '<button onclick="ChartSystem._cancelEdit()" style="font-size:0.78em;font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Cancel</button>'
            + '<button onclick="ChartSystem._saveEdit(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac">Save Chart</button>'
            + '</div></div>';

        // Import area (hidden)
        html += '<div id="chartImportArea" style="display:none;margin-top:10px">'
            + '<div style="font-size:0.82em;font-weight:700;color:#c7d2fe;margin-bottom:6px">\uD83D\uDCE5 Import Chart</div>'
            + '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px">Paste chord chart from Ultimate Guitar, Chordify, or any text source:</div>'
            + '<textarea id="chartImportText" placeholder="Paste chart here\u2026" style="width:100%;min-height:150px;font-family:\'Courier New\',Courier,monospace;font-size:0.82em;padding:10px 12px;border-radius:8px;border:1px solid rgba(99,102,241,0.2);background:rgba(0,0,0,0.2);color:var(--text);resize:vertical;box-sizing:border-box"></textarea>'
            + '<div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">'
            + '<button onclick="ChartSystem._cancelImport()" style="font-size:0.78em;font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Cancel</button>'
            + '<button onclick="ChartSystem._confirmImport(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Import as Master</button>'
            + '</div></div>';

        html += '</div>';
        el.innerHTML = html;
    }

    // ── Chart Formatting ────────────────────────────────────────────────────
    // Highlights section labels (e.g., [Intro], [Verse], [Chorus]) and chords.

    function _formatChart(text) {
        if (!text) return '';
        return _esc(text)
            .replace(/\[([^\]]+)\]/g, '<span style="color:#a5b4fc;font-weight:700">[$1]</span>')
            .replace(/\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add|7|9|11|13|6)?(?:\/[A-G][#b]?)?)\b/g, '<span style="color:#fbbf24;font-weight:600">$1</span>');
    }

    // ── Edit Handlers ───────────────────────────────────────────────────────

    var _editingSong = null;

    function _toggleEdit(songTitle) {
        var editArea = document.getElementById('chartEditArea');
        var display = document.getElementById('chartDisplay');
        if (!editArea) return;
        var isHidden = editArea.style.display === 'none';
        editArea.style.display = isHidden ? '' : 'none';
        if (isHidden) {
            _editingSong = songTitle;
            var ta = document.getElementById('chartEditText');
            var displayEl = document.getElementById('chartDisplay');
            if (ta && displayEl) ta.value = displayEl.textContent || '';
        }
    }

    function _cancelEdit() {
        var editArea = document.getElementById('chartEditArea');
        if (editArea) editArea.style.display = 'none';
        _editingSong = null;
    }

    async function _saveEdit(songTitle) {
        var ta = document.getElementById('chartEditText');
        if (!ta) return;
        var content = ta.value;
        var saved = await saveChart(songTitle, 'band', content);
        if (saved) {
            _cancelEdit();
            // Re-render display
            var display = document.getElementById('chartDisplay');
            if (display) display.innerHTML = _formatChart(content);
        }
    }

    // ── Import Handlers ─────────────────────────────────────────────────────

    function _showImport(songTitle) {
        var area = document.getElementById('chartImportArea');
        if (area) area.style.display = area.style.display === 'none' ? '' : 'none';
    }

    function _cancelImport() {
        var area = document.getElementById('chartImportArea');
        if (area) area.style.display = 'none';
    }

    async function _confirmImport(songTitle) {
        var ta = document.getElementById('chartImportText');
        if (!ta || !ta.value.trim()) { if (typeof showToast === 'function') showToast('Paste a chart first'); return; }
        var saved = await saveChart(songTitle, 'master', ta.value.trim());
        if (saved) {
            _cancelImport();
            // Reload panel
            var container = ta.closest('[id]');
            if (container) renderChartPanel(container.id, songTitle);
        }
    }

    async function _showMaster(songTitle) {
        var display = document.getElementById('chartDisplay');
        if (!display) return;
        var data = await loadChart(songTitle);
        if (data.master) {
            display.innerHTML = _formatChart(data.master);
            if (typeof showToast === 'function') showToast('Showing original chart');
        }
    }

    // ── Setlist Chart Mode ──────────────────────────────────────────────────
    // Renders all songs in a setlist as continuous scrollable charts.

    async function renderSetlistCharts(containerId, setlistObj) {
        var el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">Loading charts\u2026</div>';

        var songs = [];
        (setlistObj.sets || []).forEach(function(set, si) {
            songs.push({ type: 'set_header', label: set.name || ('Set ' + (si + 1)) });
            (set.songs || []).forEach(function(sg) {
                var title = typeof sg === 'string' ? sg : (sg.title || '');
                if (title) songs.push({ type: 'song', title: title });
            });
        });

        var html = '<div style="padding:12px">';
        for (var i = 0; i < songs.length; i++) {
            var item = songs[i];
            if (item.type === 'set_header') {
                html += '<div style="font-size:0.88em;font-weight:800;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.05em;padding:16px 0 6px;border-bottom:1px solid rgba(99,102,241,0.15);margin-bottom:8px">' + _esc(item.label) + '</div>';
                continue;
            }
            var data = await loadChart(item.title);
            var chartText = data.band || data.master;
            var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === item.title; });

            html += '<div id="chart_song_' + i + '" data-song="' + _esc(item.title) + '" style="margin-bottom:16px;page-break-inside:avoid">';
            html += '<div style="font-size:1em;font-weight:800;color:var(--text);margin-bottom:2px">' + _esc(item.title) + '</div>';
            if (songData && (songData.key || songData.bpm)) {
                var m = [];
                if (songData.key) m.push('Key: ' + songData.key);
                if (songData.bpm) m.push(songData.bpm + ' BPM');
                html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:4px">' + m.join(' \u00B7 ') + '</div>';
            }
            if (chartText) {
                html += '<div style="font-family:\'Courier New\',Courier,monospace;font-size:0.78em;line-height:1.5;color:var(--text-muted);white-space:pre-wrap;padding:8px 10px;background:rgba(0,0,0,0.1);border-radius:6px;border:1px solid rgba(255,255,255,0.03)">' + _formatChart(chartText) + '</div>';
            } else {
                html += '<div style="font-size:0.78em;color:#475569;padding:8px 0">No chart available</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        el.innerHTML = html;
    }

    function _esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

    // ── Now Playing Highlight ────────────────────────────────────────────────

    function highlightActiveSong(songTitle) {
        // Clear previous highlight
        document.querySelectorAll('[id^="chart_song_"]').forEach(function(el) {
            el.style.borderLeft = '';
            el.style.paddingLeft = '';
            el.style.background = '';
            // Remove "Now playing" label
            var label = el.querySelector('.chart-now-playing');
            if (label) label.remove();
        });
        if (!songTitle) return;
        // Find and highlight matching song
        var els = document.querySelectorAll('[data-song]');
        for (var i = 0; i < els.length; i++) {
            if (els[i].dataset.song === songTitle) {
                els[i].style.borderLeft = '3px solid #22c55e';
                els[i].style.paddingLeft = '10px';
                els[i].style.background = 'rgba(34,197,94,0.04)';
                // Add "Now playing" label
                var label = document.createElement('div');
                label.className = 'chart-now-playing';
                label.style.cssText = 'font-size:0.68em;font-weight:700;color:#22c55e;margin-bottom:2px';
                label.textContent = '\u25CF Now playing';
                els[i].insertBefore(label, els[i].firstChild);
                // Only scroll if not already visible
                var rect = els[i].getBoundingClientRect();
                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                    els[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                break;
            }
        }
    }

    // ── Chart URL (external chart links) ───────────────────────────────────
    // Supports Ultimate Guitar, PDFs, Google Docs, any URL.

    async function loadChartUrl(songTitle) {
        try {
            return await loadBandDataFromDrive(songTitle, 'chart_url') || '';
        } catch(e) { return ''; }
    }

    async function saveChartUrl(songTitle, url) {
        try {
            await saveBandDataToDrive(songTitle, 'chart_url', url.trim());
            if (typeof showToast === 'function') showToast('\u2705 Chart link saved');
            return true;
        } catch(e) {
            if (typeof showToast === 'function') showToast('\u26A0\uFE0F Could not save');
            return false;
        }
    }

    // ── Overlay Notes ────────────────────────────────────────────────────────
    // Simple notes attached to a song's chart. No positioning, no timestamps.
    // Schema: [{ text, createdAt, createdBy }]

    async function loadOverlayNotes(songTitle) {
        try {
            var notes = await loadBandDataFromDrive(songTitle, 'chart_overlay_notes');
            return Array.isArray(notes) ? notes : (notes ? Object.values(notes) : []);
        } catch(e) { return []; }
    }

    async function addOverlayNote(songTitle, text) {
        if (!text || !text.trim()) return false;
        try {
            var notes = await loadOverlayNotes(songTitle);
            notes.push({
                text: text.trim(),
                createdAt: new Date().toISOString(),
                createdBy: (typeof currentUserEmail !== 'undefined') ? currentUserEmail : ''
            });
            await saveBandDataToDrive(songTitle, 'chart_overlay_notes', notes);
            if (typeof showToast === 'function') showToast('\u2705 Note added to chart');
            return true;
        } catch(e) {
            if (typeof showToast === 'function') showToast('\u26A0\uFE0F Could not save note');
            return false;
        }
    }

    async function removeOverlayNote(songTitle, index) {
        try {
            var notes = await loadOverlayNotes(songTitle);
            if (index >= 0 && index < notes.length) {
                notes.splice(index, 1);
                await saveBandDataToDrive(songTitle, 'chart_overlay_notes', notes);
                if (typeof showToast === 'function') showToast('Note removed');
            }
        } catch(e) {}
    }

    // ── Render Overlay Notes ─────────────────────────────────────────────────

    function _renderOverlayNotes(notes, songTitle) {
        if (!notes || !notes.length) return '';
        var html = '<div style="margin-top:8px;padding:8px 10px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.12);border-radius:8px">';
        html += '<div style="font-size:0.65em;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">\uD83D\uDCCC Band Notes</div>';
        for (var i = 0; i < notes.length; i++) {
            var n = notes[i];
            var author = n.createdBy ? n.createdBy.split('@')[0] : '';
            html += '<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03)">';
            html += '<div style="flex:1;font-size:0.78em;color:var(--text-muted);line-height:1.4">' + _esc(n.text) + '</div>';
            if (author) html += '<span style="font-size:0.62em;color:#475569;flex-shrink:0">' + _esc(author) + '</span>';
            html += '<button onclick="ChartSystem._removeNote(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\',' + i + ')" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:0.7em;flex-shrink:0;padding:0 2px">\u2715</button>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // ── Enhanced Chart Panel (with URL + overlay notes) ─────────────────────

    var _origRenderChartPanel = renderChartPanel;

    renderChartPanel = async function(containerId, songTitle, songKey, songBpm) {
        await _origRenderChartPanel(containerId, songTitle, songKey, songBpm);
        var el = document.getElementById(containerId);
        if (!el) return;

        // Load chart URL
        var chartUrl = await loadChartUrl(songTitle);

        // Load overlay notes
        var notes = await loadOverlayNotes(songTitle);

        // Append URL viewer + notes + add note form below existing chart
        var extra = '';

        // Chart URL link
        if (chartUrl) {
            var isUG = chartUrl.indexOf('ultimate-guitar') >= 0;
            var label = isUG ? '\uD83C\uDFB8 Ultimate Guitar' : chartUrl.indexOf('.pdf') >= 0 ? '\uD83D\uDCC4 PDF Chart' : '\uD83D\uDD17 External Chart';
            extra += '<div style="margin-top:8px"><a href="' + _esc(chartUrl) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;font-size:0.78em;font-weight:600;color:#818cf8;text-decoration:none;padding:6px 12px;border:1px solid rgba(99,102,241,0.2);border-radius:6px;background:rgba(99,102,241,0.05)">' + label + ' \u2192</a></div>';
        }

        // Chart URL add/edit
        extra += '<div style="margin-top:6px">';
        extra += '<details style="font-size:0.72em;color:var(--text-dim)"><summary style="cursor:pointer;padding:2px 0">' + (chartUrl ? 'Change chart link' : '+ Add chart link') + '</summary>';
        extra += '<div style="display:flex;gap:4px;margin-top:4px">';
        extra += '<input id="chartUrlInput" class="app-input" placeholder="Paste UG, PDF, or any chart URL" value="' + _esc(chartUrl) + '" style="flex:1;font-size:0.95em;padding:5px 8px">';
        extra += '<button onclick="ChartSystem._saveUrl(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="font-size:0.82em;padding:5px 10px;border-radius:5px;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.08);color:#a5b4fc;cursor:pointer">Save</button>';
        extra += '</div></details></div>';

        // Overlay notes
        extra += _renderOverlayNotes(notes, songTitle);

        // Add note form
        extra += '<div style="margin-top:6px;display:flex;gap:4px">';
        extra += '<input id="chartNoteInput" class="app-input" placeholder="Add a note to this chart\u2026" style="flex:1;font-size:0.78em;padding:5px 8px">';
        extra += '<button onclick="ChartSystem._addNote(\'' + _esc(songTitle).replace(/'/g, "\\'") + '\')" style="font-size:0.75em;padding:5px 10px;border-radius:5px;border:1px solid rgba(245,158,11,0.3);background:rgba(245,158,11,0.05);color:#fbbf24;cursor:pointer">\uD83D\uDCCC Add</button>';
        extra += '</div>';

        // Append to existing content
        var inner = el.querySelector('[style*="padding:12px"]');
        if (inner) {
            inner.insertAdjacentHTML('beforeend', extra);
        }
    };

    async function _saveUrl(songTitle) {
        var input = document.getElementById('chartUrlInput');
        if (!input) return;
        await saveChartUrl(songTitle, input.value);
    }

    async function _addNote(songTitle) {
        var input = document.getElementById('chartNoteInput');
        if (!input || !input.value.trim()) return;
        var saved = await addOverlayNote(songTitle, input.value);
        if (saved) {
            input.value = '';
            // Refresh the notes display
            var notes = await loadOverlayNotes(songTitle);
            var container = input.closest('[style*="padding:12px"]');
            if (container) {
                // Find and replace the notes section
                var existing = container.querySelector('[style*="fbbf24"]');
                if (existing && existing.closest('[style*="rgba(245,158,11"]')) {
                    existing.closest('[style*="rgba(245,158,11"]').outerHTML = _renderOverlayNotes(notes, songTitle);
                }
            }
        }
    }

    async function _removeNote(songTitle, index) {
        await removeOverlayNote(songTitle, index);
        // Re-render the chart panel
        var container = document.querySelector('[id^="chart"]');
        if (container) renderChartPanel(container.id, songTitle);
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        loadChart: loadChart,
        saveChart: saveChart,
        loadChartUrl: loadChartUrl,
        saveChartUrl: saveChartUrl,
        loadOverlayNotes: loadOverlayNotes,
        addOverlayNote: addOverlayNote,
        removeOverlayNote: removeOverlayNote,
        renderChartPanel: renderChartPanel,
        renderSetlistCharts: renderSetlistCharts,
        highlightActiveSong: highlightActiveSong,
        _toggleEdit: _toggleEdit,
        _cancelEdit: _cancelEdit,
        _saveEdit: _saveEdit,
        _showImport: _showImport,
        _cancelImport: _cancelImport,
        _confirmImport: _confirmImport,
        _showMaster: _showMaster,
        _saveUrl: _saveUrl,
        _addNote: _addNote,
        _removeNote: _removeNote
    };

})();

console.log('\uD83C\uDFBC charts.js loaded');
