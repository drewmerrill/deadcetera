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

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        loadChart: loadChart,
        saveChart: saveChart,
        renderChartPanel: renderChartPanel,
        renderSetlistCharts: renderSetlistCharts,
        highlightActiveSong: highlightActiveSong,
        _toggleEdit: _toggleEdit,
        _cancelEdit: _cancelEdit,
        _saveEdit: _saveEdit,
        _showImport: _showImport,
        _cancelImport: _cancelImport,
        _confirmImport: _confirmImport,
        _showMaster: _showMaster
    };

})();

console.log('\uD83C\uDFBC charts.js loaded');
