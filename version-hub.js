// ============================================================================
// VERSION HUB — Universal "Find a Version" Source Hub
// One place to search, listen, and route recordings to any feature
// ============================================================================
console.log('%c🔍 Version Hub loaded', 'color:#667eea;font-weight:bold');

// ── State ────────────────────────────────────────────────────────────────────
var vhSong = null;       // { title, band, bandName }
var vhActiveTab = 'archive';
var vhSelectedUrl = '';
var vhSelectedTitle = '';
var vhSelectedPlatform = '';
var vhPlayerActive = false;
var vhArchiveSort = 'downloads';
var vhSourceFilter = 'all';
var vhCache = {};        // { archive: [], relisten: [], youtube: [], phishin: [] }
var vhJamChartData = null;
var vhCallback = null;   // optional callback(url, title, platform) when "Send To" is used
var vhReturnTo = '';     // 'northstar' | 'coverme' | 'fadr' | 'practice' | ''

// ── Launch ───────────────────────────────────────────────────────────────────
function openVersionHub(songTitle, opts) {
    opts = opts || {};
    var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === songTitle; });
    var bandCode = songData ? songData.band : 'GD';
    var bandName = typeof getFullBandName === 'function' ? getFullBandName(bandCode) : bandCode;
    vhSong = { title: songTitle, band: bandCode, bandName: bandName };
    vhActiveTab = opts.tab || 'archive';
    vhCallback = opts.callback || null;
    vhReturnTo = opts.returnTo || '';
    vhSelectedUrl = ''; vhSelectedTitle = ''; vhSelectedPlatform = '';
    vhPlayerActive = false;
    vhCache = {}; vhJamChartData = null;
    vhSourceFilter = 'all'; vhArchiveSort = 'downloads';
    vhRender();
    vhSwitchTab(vhActiveTab);
    // Preload jam charts for Phish
    if (/phish/i.test(bandCode)) vhLoadJamCharts();
}

function closeVersionHub() {
    var ov = document.getElementById('vhOverlay');
    if (ov) ov.classList.remove('vh-visible');
    setTimeout(function() { var o = document.getElementById('vhOverlay'); if (o) o.remove(); }, 200);
    vhStopPlayer();
}

// ── Render Shell ─────────────────────────────────────────────────────────────
function vhRender() {
    var existing = document.getElementById('vhOverlay');
    if (existing) existing.remove();

    var isPhish = /phish/i.test(vhSong.band);
    var ov = document.createElement('div');
    ov.id = 'vhOverlay';

    // Source tabs
    var tabs = [
        { id: 'archive', icon: '🏛️', label: 'Archive' },
        { id: 'youtube', icon: '📺', label: 'YouTube' },
        { id: 'relisten', icon: '🔄', label: 'Relisten' }
    ];
    if (isPhish) tabs.push({ id: 'phishin', icon: '🐟', label: 'Phish.in' });
    tabs.push({ id: 'spotify', icon: '🟢', label: 'Spotify' });
    tabs.push({ id: 'url', icon: '🔗', label: 'Paste URL' });

    var tabsHtml = tabs.map(function(t) {
        return '<button class="vh-tab' + (t.id === vhActiveTab ? ' active' : '') + '" data-tab="' + t.id + '" onclick="vhSwitchTab(\'' + t.id + '\')">' + t.icon + ' ' + t.label + '</button>';
    }).join('');

    // Source filter pills (for Archive/Relisten)
    var filterHtml = '<div id="vhSourceFilters" class="vh-filters">' +
        ['all','SBD','AUD','Matrix'].map(function(f) {
            var label = f === 'all' ? 'All' : f === 'SBD' ? '🎛️ SBD' : f === 'AUD' ? '🎤 AUD' : '🔀 Matrix';
            return '<button class="vh-filter-pill' + (vhSourceFilter === 'all' || vhSourceFilter === f ? ' active' : '') + '" onclick="vhSetFilter(\'' + f + '\')">' + label + '</button>';
        }).join('') + '</div>';

    // Return-to banner
    var returnBanner = '';
    if (vhReturnTo) {
        var dest = { northstar: '⭐ North Star', coverme: '🎤 Cover Me', fadr: '🎚️ Fadr Stems', practice: '🎵 Practice Mode' }[vhReturnTo] || vhReturnTo;
        returnBanner = '<div class="vh-return-banner">Finding for: <strong>' + dest + '</strong></div>';
    }

    ov.innerHTML =
        '<div class="vh-header">' +
            '<button class="vh-close" onclick="closeVersionHub()">✕</button>' +
            '<div class="vh-title-block">' +
                '<div class="vh-song-title">' + vhSong.title + '</div>' +
                '<div class="vh-song-meta">' + vhSong.bandName + ' · Find a Version</div>' +
            '</div>' +
        '</div>' +
        returnBanner +
        '<div class="vh-tabs">' + tabsHtml + '</div>' +
        filterHtml +
        '<div class="vh-body">' +
            '<div class="vh-panel" id="vhPanelArchive"></div>' +
            '<div class="vh-panel" id="vhPanelYoutube"></div>' +
            '<div class="vh-panel" id="vhPanelRelisten"></div>' +
            (isPhish ? '<div class="vh-panel" id="vhPanelPhishin"></div>' : '') +
            '<div class="vh-panel" id="vhPanelSpotify"></div>' +
            '<div class="vh-panel" id="vhPanelUrl"></div>' +
        '</div>' +
        '<div id="vhPlayer" class="vh-player hidden"></div>' +
        '<div id="vhActions" class="vh-actions hidden"></div>';

    document.body.appendChild(ov);
    requestAnimationFrame(function() { ov.classList.add('vh-visible'); });
}

// ── Tab switching ────────────────────────────────────────────────────────────
function vhSwitchTab(tab) {
    vhActiveTab = tab;
    document.querySelectorAll('.vh-tab').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.vh-panel').forEach(function(p) { p.style.display = 'none'; });
    var panel = document.getElementById('vhPanel' + tab.charAt(0).toUpperCase() + tab.slice(1));
    if (panel) { panel.style.display = 'block'; }

    // Show/hide source filters (only for Archive and Relisten)
    var ff = document.getElementById('vhSourceFilters');
    if (ff) ff.style.display = (tab === 'archive' || tab === 'relisten') ? 'flex' : 'none';

    // Load content if not cached
    if (tab === 'archive' && !vhCache.archive) vhRenderArchivePanel();
    if (tab === 'youtube' && !vhCache.youtube) vhRenderYoutubePanel();
    if (tab === 'relisten' && !vhCache.relisten) vhRenderRelistenPanel();
    if (tab === 'phishin' && !vhCache.phishin) vhRenderPhishinPanel();
    if (tab === 'spotify') vhRenderSpotifyPanel();
    if (tab === 'url') vhRenderUrlPanel();
}

function vhSetFilter(f) {
    vhSourceFilter = f;
    document.querySelectorAll('.vh-filter-pill').forEach(function(b) {
        // When "All" is selected, highlight every pill
        if (f === 'all') {
            b.classList.add('active');
        } else {
            b.classList.toggle('active', b.textContent.includes(f));
        }
    });
    if (vhCache.archive) vhRenderArchiveResults(vhCache.archive);
    if (vhCache.relisten) vhRenderRelistenResults(vhCache.relisten);
}

// ── Archive.org Panel ────────────────────────────────────────────────────────
function vhRenderArchivePanel() {
    var panel = document.getElementById('vhPanelArchive');
    var q = typeof rmArchiveQuery === 'function' ? rmArchiveQuery(vhSong.title, vhSong.band) : vhSong.title + ' ' + vhSong.bandName;
    panel.innerHTML =
        '<div class="vh-search-row">' +
            '<input id="vhArchiveQuery" type="text" class="vh-search-input" placeholder="Search Archive.org..." value="' + q.replace(/"/g, '&quot;') + '" onkeydown="if(event.key===\'Enter\')vhSearchArchive()">' +
            '<button class="vh-search-btn" onclick="vhSearchArchive()">🔍</button>' +
        '</div>' +
        '<div id="vhArchiveResults" class="vh-results"><div class="vh-hint">Press 🔍 or Enter to search</div></div>' +
        '<div id="vhArchiveFiles" class="vh-results" style="display:none"></div>';
    // Auto-search
    vhSearchArchive();
}

async function vhSearchArchive() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var q = document.getElementById('vhArchiveQuery')?.value?.trim();
    if (!q) return;
    var c = document.getElementById('vhArchiveResults');
    c.innerHTML = '<div class="vh-loading">🔍 Searching Archive.org...</div>';
    try {
        var sortMap = { downloads: 'downloads+desc', rating: 'avg_rating+desc', date: 'date+desc' };
        var r = await fetch(PROXY + '/archive-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q, rows: 30, sort: sortMap[vhArchiveSort] || 'downloads+desc' }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div class="vh-empty">No results found</div>'; return; }
        vhCache.archive = d.results;
        vhRenderArchiveResults(d.results);
    } catch(e) { c.innerHTML = '<div class="vh-error">Error: ' + e.message + '</div>'; }
}

function vhRenderArchiveResults(results) {
    var c = document.getElementById('vhArchiveResults');
    var filtered = vhSourceFilter !== 'all' ? results.filter(function(r) { return r.sourceType === vhSourceFilter; }) : results;

    // Sort pills
    var sortHtml = '<div class="vh-sort-row">' +
        '<span class="vh-count">' + filtered.length + ' of ' + results.length + ' shows</span>' +
        '<div class="vh-sort-pills">' +
        ['downloads','rating','date'].map(function(s) {
            return '<button class="vh-sort-pill' + (vhArchiveSort === s ? ' active' : '') + '" onclick="vhArchiveSort=\'' + s + '\';vhSearchArchive()">' + s.charAt(0).toUpperCase() + s.slice(1) + '</button>';
        }).join('') +
        '</div></div>';

    c.innerHTML = sortHtml + filtered.slice(0, 30).map(function(r) {
        var srcBadge = vhSourceBadge(r.sourceType);
        var jcBadge = vhJamChartBadge(r.date);
        return '<div class="vh-result-row" onclick="vhSelectArchiveShow(\'' + r.identifier + '\')">' +
            '<div class="vh-result-top">' + srcBadge + jcBadge +
                '<span class="vh-result-title">' + (r.title || r.identifier) + '</span></div>' +
            '<div class="vh-result-meta">' + (r.date ? r.date.split('T')[0] : '') + ' · ⭐ ' + (r.rating ? r.rating.toFixed(1) : '—') + ' · ' + (r.downloads ? r.downloads.toLocaleString() + ' dl' : '') + '</div>' +
        '</div>';
    }).join('');

    // Hide files panel when new search happens
    var fp = document.getElementById('vhArchiveFiles');
    if (fp) fp.style.display = 'none';
}

async function vhSelectArchiveShow(id) {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var c = document.getElementById('vhArchiveFiles');
    c.style.display = 'block';
    c.innerHTML = '<div class="vh-loading">Loading tracks...</div>';
    c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    try {
        var r = await fetch(PROXY + '/archive-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: id }) });
        var d = await r.json();
        if (!d.files?.length) { c.innerHTML = '<div class="vh-empty">No audio files found</div>'; return; }
        // Sort: MP3 first
        var sorted = d.files.sort(function(a, b) { var am = /mp3/i.test(a.format || a.name), bm = /mp3/i.test(b.format || b.name); if (am && !bm) return -1; if (!am && bm) return 1; return 0; });
        var showBadge = d.sourceType && d.sourceType !== 'Unknown' ? vhSourceBadge(d.sourceType) : '';
        c.innerHTML = '<div class="vh-files-header">' + showBadge + '<span class="vh-files-title">' + (d.title || id) + '</span>' +
            '<button class="vh-files-close" onclick="document.getElementById(\'vhArchiveFiles\').style.display=\'none\'">✕</button></div>' +
            sorted.map(function(f) {
                var name = f.title || f.name.replace(/\.[^.]+$/, '');
                var dur = f.length ? Math.floor(f.length / 60) + ':' + String(Math.floor(f.length % 60)).padStart(2, '0') : '';
                var size = f.size ? (parseInt(f.size) / 1024 / 1024).toFixed(1) + 'MB' : '';
                var fmt = (f.format || '').replace('VBR ', '');
                return '<div class="vh-file-row" onclick="vhPlayArchiveTrack(\'' + f.url.replace(/'/g, "\\'") + '\', \'' + name.replace(/'/g, "\\'") + '\')">' +
                    '<div class="vh-file-play">▶</div>' +
                    '<div class="vh-file-info">' +
                        '<div class="vh-file-name">' + name + '</div>' +
                        '<div class="vh-file-meta">' + [fmt, dur, size].filter(Boolean).join(' · ') + '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
    } catch(e) { c.innerHTML = '<div class="vh-error">Error: ' + e.message + '</div>'; }
}

function vhPlayArchiveTrack(url, title) {
    vhSelectedUrl = url;
    vhSelectedTitle = title;
    vhSelectedPlatform = 'archive';
    vhShowPlayer('archive', url, title);
    vhShowActions();
}

// ── YouTube Panel ────────────────────────────────────────────────────────────
function vhRenderYoutubePanel() {
    var panel = document.getElementById('vhPanelYoutube');
    var q = vhSong.title + ' ' + vhSong.bandName;
    panel.innerHTML =
        '<div class="vh-search-row">' +
            '<input id="vhYoutubeQuery" type="text" class="vh-search-input" placeholder="Search YouTube..." value="' + q.replace(/"/g, '&quot;') + '" onkeydown="if(event.key===\'Enter\')vhSearchYoutube()">' +
            '<button class="vh-search-btn" onclick="vhSearchYoutube()">🔍</button>' +
        '</div>' +
        '<div id="vhYoutubeResults" class="vh-results"><div class="vh-hint">Press 🔍 or Enter to search</div></div>';
    vhSearchYoutube();
}

async function vhSearchYoutube() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var q = document.getElementById('vhYoutubeQuery')?.value?.trim();
    if (!q) return;
    var c = document.getElementById('vhYoutubeResults');
    c.innerHTML = '<div class="vh-loading">🔍 Searching YouTube...</div>';
    try {
        var r = await fetch(PROXY + '/youtube-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: q }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div class="vh-empty">No results found</div>'; return; }
        vhCache.youtube = d.results;
        c.innerHTML = d.results.map(function(v) {
            return '<div class="vh-yt-row" onclick="vhPlayYoutube(\'' + v.videoId + '\', \'' + (v.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')">' +
                '<img class="vh-yt-thumb" src="https://img.youtube.com/vi/' + v.videoId + '/mqdefault.jpg" alt="">' +
                '<div class="vh-yt-info">' +
                    '<div class="vh-yt-title">' + (v.title || 'Untitled') + '</div>' +
                    '<div class="vh-yt-meta">' + (v.author || '') + (v.duration ? ' · ' + v.duration : '') + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    } catch(e) { c.innerHTML = '<div class="vh-error">Error: ' + e.message + '</div>'; }
}

function vhPlayYoutube(videoId, title) {
    vhSelectedUrl = 'https://www.youtube.com/watch?v=' + videoId;
    vhSelectedTitle = title;
    vhSelectedPlatform = 'youtube';
    vhShowPlayer('youtube', videoId, title);
    vhShowActions();
}

// ── Relisten Panel ───────────────────────────────────────────────────────────
function vhRenderRelistenPanel() {
    var panel = document.getElementById('vhPanelRelisten');
    panel.innerHTML =
        '<div class="vh-search-row">' +
            '<input id="vhRelistenQuery" type="text" class="vh-search-input" placeholder="Search Relisten..." value="' + vhSong.title.replace(/"/g, '&quot;') + '" onkeydown="if(event.key===\'Enter\')vhSearchRelisten()">' +
            '<button class="vh-search-btn" onclick="vhSearchRelisten()">🔍</button>' +
        '</div>' +
        '<div id="vhRelistenResults" class="vh-results"><div class="vh-loading">🔄 Searching Relisten...</div></div>';
    vhSearchRelisten();
}

async function vhSearchRelisten() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var queryEl = document.getElementById('vhRelistenQuery');
    var searchTitle = queryEl ? queryEl.value.trim() : vhSong.title;
    var c = document.getElementById('vhRelistenResults');
    c.innerHTML = '<div class="vh-loading">🔄 Searching Relisten...</div>';
    try {
        var r = await fetch(PROXY + '/relisten-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songTitle: searchTitle, bandSlug: vhSong.band }) });
        var d = await r.json();
        if (!d.results?.length) { c.innerHTML = '<div class="vh-empty">No Relisten results' + (d.matched === false ? ' — song not found in catalog' : '') + '</div>'; return; }
        vhCache.relisten = d.results;
        vhRenderRelistenResults(d.results, d.songName, d.timesPlayed);
    } catch(e) { c.innerHTML = '<div class="vh-error">Error: ' + e.message + '</div>'; }
}

function vhRenderRelistenResults(results, songName, timesPlayed) {
    var c = document.getElementById('vhRelistenResults');
    var filtered = vhSourceFilter === 'SBD' ? results.filter(function(r) { return r.hasSbd; }) : vhSourceFilter === 'AUD' ? results.filter(function(r) { return !r.hasSbd; }) : results;
    var hdr = '<div class="vh-count-row">' + (songName ? '"' + songName + '" — ' : '') + (timesPlayed ? timesPlayed + ' shows · ' : '') + filtered.length + ' shown</div>';
    c.innerHTML = hdr + filtered.slice(0, 30).map(function(r) {
        var sbdBadge = r.hasSbd ? '<span class="vh-badge vh-badge-sbd">SBD</span> ' : '';
        var jcBadge = vhJamChartBadge(r.date);
        var loc = [r.venue, r.city, r.state].filter(Boolean).join(', ');
        return '<div class="vh-result-row" onclick="vhSelectRelisten(\'' + (r.relistenUrl || '').replace(/'/g, "\\'") + '\', \'' + (r.date || '').replace(/'/g, "\\'") + '\')">' +
            '<div class="vh-result-top">' + sbdBadge + jcBadge + '<span class="vh-result-title">' + r.date + '</span></div>' +
            '<div class="vh-result-meta">' + loc + (r.tapeCount ? ' · 📼 ' + r.tapeCount + ' tapes' : '') + '</div>' +
        '</div>';
    }).join('');
}

function vhSelectRelisten(url, date) {
    vhSelectedUrl = url;
    vhSelectedTitle = vhSong.title + ' — ' + date;
    vhSelectedPlatform = 'relisten';
    // Relisten links open externally — no inline player
    vhShowPlayer('link', url, vhSelectedTitle);
    vhShowActions();
}

// ── Phish.in Panel ───────────────────────────────────────────────────────────
function vhRenderPhishinPanel() {
    var panel = document.getElementById('vhPanelPhishin');
    panel.innerHTML = '<div id="vhPhishinResults" class="vh-results"><div class="vh-loading">🐟 Searching Phish.in...</div></div>';
    vhSearchPhishIn();
}

async function vhSearchPhishIn() {
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    var c = document.getElementById('vhPhishinResults');
    c.innerHTML = '<div class="vh-loading">🐟 Searching Phish.in...</div>';
    try {
        var r = await fetch(PROXY + '/phishin-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songTitle: vhSong.title }) });
        var d = await r.json();
        if (!d.tracks?.length) { c.innerHTML = '<div class="vh-empty">No Phish.in results' + (d.error ? ': ' + d.error : '') + '</div>'; return; }
        vhCache.phishin = d.tracks;
        c.innerHTML = '<div class="vh-count-row">' + d.tracks.length + ' tracks found</div>' +
            d.tracks.slice(0, 30).map(function(t) {
                var dur = t.duration ? Math.floor(t.duration / 1000 / 60) + ':' + String(Math.floor((t.duration / 1000) % 60)).padStart(2, '0') : '';
                return '<div class="vh-result-row" onclick="vhPlayPhishin(\'' + (t.mp3_url || t.mp3 || '').replace(/'/g, "\\'") + '\', \'' + (t.show_date || '').replace(/'/g, "\\'") + '\')">' +
                    '<div class="vh-result-top"><span class="vh-result-title">' + (t.show_date || '') + '</span></div>' +
                    '<div class="vh-result-meta">' + (t.venue_name || '') + (dur ? ' · ' + dur : '') + (t.likes_count ? ' · ❤️ ' + t.likes_count : '') + '</div>' +
                '</div>';
            }).join('');
    } catch(e) { c.innerHTML = '<div class="vh-error">Error: ' + e.message + '</div>'; }
}

function vhPlayPhishin(mp3Url, date) {
    if (!mp3Url) { window.open('https://phish.in/', '_blank'); return; }
    vhSelectedUrl = mp3Url;
    vhSelectedTitle = vhSong.title + ' — ' + date + ' (Phish.in)';
    vhSelectedPlatform = 'phishin';
    vhShowPlayer('audio', mp3Url, vhSelectedTitle);
    vhShowActions();
}

// ── Spotify Panel ────────────────────────────────────────────────────────────
function vhRenderSpotifyPanel() {
    var panel = document.getElementById('vhPanelSpotify');
    var q = vhSong.title + ' ' + vhSong.bandName;
    panel.innerHTML =
        '<div class="vh-search-row">' +
            '<input id="vhSpotifyQuery" type="text" class="vh-search-input" placeholder="Search Spotify..." value="' + q.replace(/"/g, '&quot;') + '" onkeydown="if(event.key===\'Enter\')vhSearchSpotify()">' +
            '<button class="vh-search-btn" onclick="vhSearchSpotify()">&#128269;</button>' +
        '</div>' +
        '<div id="vhSpotifyResults" class="vh-results"><div class="vh-hint">Press search or hit Enter</div></div>';
    // Auto-search on load
    vhSearchSpotify();
}

var _vhSpotifySearching = false;
async function vhSearchSpotify() {
    var input = document.getElementById('vhSpotifyQuery');
    var query = input ? input.value.trim() : '';
    if (!query || _vhSpotifySearching) return;
    var results = document.getElementById('vhSpotifyResults');
    if (!results) return;
    results.innerHTML = '<div class="vh-loading">Searching Spotify...</div>';
    _vhSpotifySearching = true;
    try {
        var workerUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev';
        var res = await fetch(workerUrl + '/spotify-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, limit: 10 })
        });
        var data = await res.json();
        if (data.error) {
            results.innerHTML = '<div class="vh-error">Spotify search error: ' + data.error + '</div>';
            _vhSpotifySearching = false;
            return;
        }
        var tracks = data.results || [];
        if (tracks.length === 0) {
            results.innerHTML = '<div class="vh-empty">No results found on Spotify</div>';
            _vhSpotifySearching = false;
            return;
        }
        results.innerHTML = '<div class="vh-count-row">' + tracks.length + ' results</div>' +
            tracks.map(function(t, i) {
                return '<div class="vh-yt-row" onclick="vhSelectSpotifyTrack(' + i + ')" data-idx="' + i + '">' +
                    '<img class="vh-yt-thumb" src="' + (t.albumArt || '') + '" alt="" style="width:56px;height:56px;border-radius:6px">' +
                    '<div class="vh-yt-info">' +
                        '<div class="vh-yt-title">' + (t.name || '') + '</div>' +
                        '<div class="vh-yt-meta">' + (t.artist || '') + ' · ' + (t.album || '') + '</div>' +
                        '<div class="vh-yt-meta">' + (t.durationStr || '') +
                            (t.releaseDate ? ' · ' + t.releaseDate.substring(0, 4) : '') +
                            (t.explicit ? ' · <span style="color:#f59e0b;font-weight:600">E</span>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            }).join('');
        // Stash results for selection
        vhCache.spotifyTracks = tracks;
    } catch(e) {
        results.innerHTML = '<div class="vh-error">Search failed: ' + e.message + '</div>';
    }
    _vhSpotifySearching = false;
}

function vhSelectSpotifyTrack(idx) {
    var tracks = vhCache.spotifyTracks || [];
    var t = tracks[idx];
    if (!t) return;
    vhSelectedUrl = t.url;
    vhSelectedTitle = t.name + ' - ' + t.artist;
    vhSelectedPlatform = 'spotify';

    // Show embed + cross-platform links
    var results = document.getElementById('vhSpotifyResults');
    if (results) {
        var trackId = t.id || '';
        results.innerHTML =
            '<div style="padding:8px 0">' +
                (trackId ? '<iframe src="https://open.spotify.com/embed/track/' + trackId + '?theme=0" width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style="border-radius:12px;margin-bottom:8px" loading="lazy"></iframe>' : '') +
                '<div style="font-weight:700;color:var(--text);margin-bottom:4px">' + (t.name || '') + '</div>' +
                '<div style="font-size:0.82em;color:var(--text-muted);margin-bottom:8px">' + (t.artist || '') + ' · ' + (t.album || '') + '</div>' +
                '<div id="vhOdesliLinks" style="margin-top:8px"><div class="vh-loading" style="font-size:0.8em">Loading links for other platforms...</div></div>' +
            '</div>';
        // Fetch cross-platform links via Odesli
        vhFetchOdesliLinks(t.url);
    }
    vhShowPlayer('spotify', t.url, vhSelectedTitle);
    vhShowActions();
}

async function vhFetchOdesliLinks(spotifyUrl) {
    var container = document.getElementById('vhOdesliLinks');
    if (!container) return;
    try {
        var workerUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : 'https://deadcetera-proxy.drewmerrill.workers.dev';
        var res = await fetch(workerUrl + '/odesli-links', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: spotifyUrl })
        });
        var data = await res.json();
        var links = data.links || {};
        var platformInfo = [
            { key: 'spotify', icon: '🟢', label: 'Spotify' },
            { key: 'appleMusic', icon: '🍎', label: 'Apple Music' },
            { key: 'youtubeMusic', icon: '▶️', label: 'YouTube Music' },
            { key: 'youtube', icon: '📺', label: 'YouTube' },
            { key: 'tidal', icon: '🌊', label: 'Tidal' },
            { key: 'amazonMusic', icon: '📦', label: 'Amazon Music' },
            { key: 'deezer', icon: '🎧', label: 'Deezer' },
            { key: 'soundcloud', icon: '☁️', label: 'SoundCloud' },
            { key: 'pandora', icon: '📻', label: 'Pandora' }
        ];
        var html = '<div style="font-size:0.78em;font-weight:600;color:var(--text-dim);margin-bottom:6px">Also available on:</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px">';
        var found = 0;
        platformInfo.forEach(function(p) {
            if (links[p.key]) {
                found++;
                html += '<a href="' + links[p.key].url + '" target="_blank" rel="noopener" ' +
                    'style="display:inline-flex;align-items:center;gap:4px;padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.88em;text-decoration:none;transition:all 0.15s" ' +
                    'onmouseover="this.style.background=\'rgba(255,255,255,0.08)\';this.style.color=\'white\'" ' +
                    'onmouseout="this.style.background=\'rgba(255,255,255,0.04)\';this.style.color=\'var(--text-muted)\'">' +
                    p.icon + ' ' + p.label + '</a>';
            }
        });
        html += '</div>';
        if (data.pageUrl) {
            html += '<div style="margin-top:8px"><a href="' + data.pageUrl + '" target="_blank" rel="noopener" style="color:var(--accent-light);font-size:0.78em;text-decoration:none">View all platforms on song.link ↗</a></div>';
        }
        container.innerHTML = found > 0 ? html : '<div style="font-size:0.78em;color:var(--text-dim)">No cross-platform links found</div>';
    } catch(e) {
        container.innerHTML = '<div style="font-size:0.78em;color:var(--text-dim)">Could not load platform links</div>';
    }
}

function vhSelectSpotify() {
    var url = document.getElementById('vhSpotifyUrl')?.value?.trim();
    if (!url || !url.includes('spotify.com')) { if (typeof showToast === 'function') showToast('Paste a Spotify URL'); return; }
    vhSelectedUrl = url;
    vhSelectedTitle = vhSong.title + ' (Spotify)';
    vhSelectedPlatform = 'spotify';

    // Try to show embed preview
    var match = url.match(/track\/([a-zA-Z0-9]+)/);
    var preview = document.getElementById('vhSpotifyPreview');
    if (match) {
        preview.innerHTML = '<iframe src="https://open.spotify.com/embed/track/' + match[1] + '?theme=0" width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" style="border-radius:12px;margin-top:8px"></iframe>';
    }
    vhShowPlayer('spotify', url, vhSelectedTitle);
    vhShowActions();
}

// ── Paste URL Panel ──────────────────────────────────────────────────────────
function vhRenderUrlPanel() {
    var panel = document.getElementById('vhPanelUrl');
    panel.innerHTML =
        '<div class="vh-url-info">' +
            '<p>Paste any URL — Spotify, YouTube, Archive.org, SoundCloud, or a direct MP3 link.</p>' +
        '</div>' +
        '<div class="vh-search-row">' +
            '<input id="vhPasteUrl" type="text" class="vh-search-input" placeholder="https://..." onkeydown="if(event.key===\'Enter\')vhSelectPastedUrl()" oninput="vhDetectPlatform(this.value)">' +
            '<button class="vh-search-btn" onclick="vhSelectPastedUrl()">✓</button>' +
        '</div>' +
        '<div id="vhUrlDetect" class="vh-url-detect"></div>' +
        '<div class="vh-url-fields">' +
            '<input id="vhPasteTitle" type="text" class="vh-search-input" placeholder="Version title (optional)" style="margin-top:8px">' +
        '</div>';
}

function vhUrlPanelSendTo(btn) {
    var dest = btn.getAttribute('data-dest');
    if (!dest) return;
    vhSelectPastedUrl();
    // vhSelectPastedUrl sets vhSelectedUrl — give it a tick then send
    setTimeout(function() { vhSendTo(dest); }, 0);
}

function vhDetectPlatform(url) {
    var el = document.getElementById('vhUrlDetect');
    if (!el) return;
    if (!url) { el.innerHTML = ''; return; }
    var platform = 'link';
    if (url.includes('spotify.com')) platform = 'spotify';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
    else if (url.includes('archive.org')) platform = 'archive';
    else if (url.includes('soundcloud.com')) platform = 'soundcloud';
    else if (url.includes('relisten.net')) platform = 'relisten';
    else if (url.includes('phish.in')) platform = 'phishin';
    else if (/\.(mp3|m4a|wav|ogg|flac)(\?|$)/i.test(url)) platform = 'audio';
    var icons = { spotify: '🟢 Spotify', youtube: '▶️ YouTube', archive: '🏛️ Archive.org', soundcloud: '🔊 SoundCloud', relisten: '🔄 Relisten', phishin: '🐟 Phish.in', audio: '🎵 Audio File', link: '🔗 Link' };
    el.innerHTML =
        '<span class="vh-detect-badge">' + (icons[platform] || icons.link) + ' detected</span>' +
        '<div class="vh-url-sendto" style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">' +
        '<span style="font-size:0.72em;color:#64748b;align-self:center;margin-right:4px">Send to:</span>' +
        '<button class="vh-action-btn vh-action-northstar" style="flex:0 0 auto;padding:6px 10px;font-size:0.72em" data-dest="northstar" onclick="vhUrlPanelSendTo(this)">&#11088; North Star</button>' +
        '<button class="vh-action-btn vh-action-coverme" style="flex:0 0 auto;padding:6px 10px;font-size:0.72em" data-dest="coverme" onclick="vhUrlPanelSendTo(this)">&#127908; Cover Me</button>' +
        '<button class="vh-action-btn vh-action-fadr" style="flex:0 0 auto;padding:6px 10px;font-size:0.72em" data-dest="fadr" onclick="vhUrlPanelSendTo(this)">&#127928; Fadr</button>' +
        '<button class="vh-action-btn vh-action-practice" style="flex:0 0 auto;padding:6px 10px;font-size:0.72em" data-dest="practice" onclick="vhUrlPanelSendTo(this)">&#127925; Practice</button>' +
        '</div>';
}

function vhSelectPastedUrl() {
    var url = document.getElementById('vhPasteUrl')?.value?.trim();
    if (!url) return;
    try { new URL(url); } catch(e) { if (typeof showToast === 'function') showToast('Enter a valid URL'); return; }
    var title = document.getElementById('vhPasteTitle')?.value?.trim() || '';
    var platform = 'link';
    if (url.includes('spotify.com')) platform = 'spotify';
    else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
    else if (url.includes('archive.org')) platform = 'archive';
    else if (url.includes('soundcloud.com')) platform = 'soundcloud';
    else if (/\.(mp3|m4a|wav|ogg|flac)(\?|$)/i.test(url)) platform = 'audio';

    vhSelectedUrl = url;
    vhSelectedTitle = title || vhSong.title + ' (' + platform + ')';
    vhSelectedPlatform = platform;

    // Auto-detect and show player
    if (platform === 'youtube') {
        var vid = typeof extractYouTubeVideoId === 'function' ? extractYouTubeVideoId(url) : null;
        if (vid) { vhShowPlayer('youtube', vid, vhSelectedTitle); }
    } else if (platform === 'spotify') {
        var m = url.match(/track\/([a-zA-Z0-9]+)/);
        if (m) { vhShowPlayer('spotify', url, vhSelectedTitle); }
    } else if (platform === 'audio' || platform === 'archive') {
        vhShowPlayer('audio', url, vhSelectedTitle);
    } else {
        vhShowPlayer('link', url, vhSelectedTitle);
    }
    vhShowActions();
}

// ── Inline Player ────────────────────────────────────────────────────────────
function vhShowPlayer(type, src, title) {
    var player = document.getElementById('vhPlayer');
    player.classList.remove('hidden');
    vhPlayerActive = true;

    if (type === 'audio' || type === 'archive') {
        // Use archive-fetch proxy for archive.org URLs (CORS)
        var audioSrc = src;
        if (src.includes('archive.org') && typeof FADR_PROXY !== 'undefined') {
            // Direct archive.org URLs usually work without proxy for audio
            audioSrc = src;
        }
        player.innerHTML =
            '<div class="vh-player-inner">' +
                '<div class="vh-player-info">' +
                    '<div class="vh-player-title">' + (title || 'Audio').substring(0, 60) + '</div>' +
                    '<div class="vh-player-src">' + (type === 'archive' ? '🏛️ Archive.org' : '🎵 Audio') + '</div>' +
                '</div>' +
                '<audio id="vhAudio" controls autoplay style="width:100%;height:36px;margin-top:4px">' +
                    '<source src="' + audioSrc + '" type="audio/mpeg">' +
                '</audio>' +
            '</div>';
    } else if (type === 'youtube') {
        var videoId = src.length === 11 ? src : (typeof extractYouTubeVideoId === 'function' ? extractYouTubeVideoId(src) : src);
        player.innerHTML =
            '<div class="vh-player-inner vh-player-yt">' +
                '<iframe id="vhYtFrame" width="100%" height="200" src="https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen style="border-radius:8px"></iframe>' +
                '<div class="vh-player-title" style="margin-top:4px">' + (title || '').substring(0, 80) + '</div>' +
            '</div>';
    } else if (type === 'spotify') {
        var trackMatch = src.match(/track\/([a-zA-Z0-9]+)/);
        if (trackMatch) {
            player.innerHTML =
                '<div class="vh-player-inner">' +
                    '<iframe src="https://open.spotify.com/embed/track/' + trackMatch[1] + '?theme=0" width="100%" height="80" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media" style="border-radius:12px"></iframe>' +
                '</div>';
        } else {
            player.innerHTML = '<div class="vh-player-inner"><div class="vh-player-title">🟢 ' + (title || 'Spotify track selected') + '</div></div>';
        }
    } else {
        // Generic link — no inline player
        player.innerHTML =
            '<div class="vh-player-inner">' +
                '<div class="vh-player-title">🔗 ' + (title || src).substring(0, 80) + '</div>' +
                '<a href="' + src + '" target="_blank" class="vh-open-link">Open in new tab ↗</a>' +
            '</div>';
    }
}

function vhStopPlayer() {
    var audio = document.getElementById('vhAudio');
    if (audio) { audio.pause(); audio.src = ''; }
    var frame = document.getElementById('vhYtFrame');
    if (frame) frame.src = '';
    vhPlayerActive = false;
}

// ── Action Bar (Send To) ────────────────────────────────────────────────────
function vhShowActions() {
    var bar = document.getElementById('vhActions');
    bar.classList.remove('hidden');

    // If launched with a specific returnTo, show a prominent "Use This" button
    if (vhReturnTo) {
        var dest = { northstar: '⭐ Set as North Star', coverme: '🎤 Add to Cover Me', fadr: '🎚️ Send to Fadr', practice: '🎵 Load in Practice Mode' }[vhReturnTo] || 'Use This';
        bar.innerHTML =
            '<button class="vh-action-primary" onclick="vhSendTo(\'' + vhReturnTo + '\')">' + dest + '</button>' +
            '<button class="vh-action-secondary" onclick="vhShowAllActions()">More ▾</button>';
        return;
    }

    vhShowAllActions();
}

function vhShowAllActions() {
    var bar = document.getElementById('vhActions');
    bar.innerHTML =
        '<button class="vh-action-btn vh-action-northstar" onclick="vhSendTo(\'northstar\')">⭐ North Star</button>' +
        '<button class="vh-action-btn vh-action-coverme" onclick="vhSendTo(\'coverme\')">🎤 Cover Me</button>' +
        '<button class="vh-action-btn vh-action-fadr" onclick="vhSendTo(\'fadr\')">🎚️ Fadr</button>' +
        '<button class="vh-action-btn vh-action-practice" onclick="vhSendTo(\'practice\')">🎵 Practice</button>';
}

function vhSaveUrl(songTitle, url, title, platform) {
    // Persist URL to Firebase so it survives across sessions
    if (typeof firebaseDB === 'undefined' || !firebaseDB || typeof bandPath !== 'function') return;
    if (typeof sanitizeFirebasePath !== 'function') return;
    var songKey = sanitizeFirebasePath(songTitle);
    var urlKey = 'url_' + Date.now();
    var record = {
        url: url,
        title: title || songTitle,
        platform: platform || 'link',
        savedAt: new Date().toISOString(),
        savedBy: typeof currentUserEmail !== 'undefined' ? currentUserEmail : ''
    };
    firebaseDB.ref(bandPath('songUrls/' + songKey + '/' + urlKey)).set(record)
        .catch(function(e) { console.warn('[vh] saveUrl failed:', e); });
}

async function vhSendTo(dest) {
    if (!vhSelectedUrl || !vhSong) return;
    var songTitle = vhSong.title;
    var url = vhSelectedUrl;
    var title = vhSelectedTitle;
    // Persist URL to Firebase regardless of destination
    vhSaveUrl(songTitle, url, title, vhSelectedPlatform);

    if (dest === 'northstar') {
        // Add as reference version
        var platform = vhSelectedPlatform || 'link';
        var version = {
            id: 'version_' + Date.now(),
            title: title || 'Version from Hub',
            url: url,
            spotifyUrl: url,
            platform: platform,
            votes: {},
            totalVotes: 0,
            isDefault: false,
            addedBy: typeof currentUserEmail !== 'undefined' ? currentUserEmail : '',
            notes: 'Added via Find a Version',
            dateAdded: new Date().toLocaleDateString()
        };
        if (typeof bandMembers !== 'undefined') {
            Object.keys(bandMembers).forEach(function(email) { version.votes[email] = false; });
        }
        var versions = typeof loadRefVersions === 'function' ? (await loadRefVersions(songTitle) || []) : [];
        if (!Array.isArray(versions)) versions = [];
        versions.push(version);
        if (typeof saveRefVersions === 'function') await saveRefVersions(songTitle, versions);
        if (typeof renderRefVersions === 'function') {
            var bd = (typeof bandKnowledgeBase !== 'undefined' ? bandKnowledgeBase[songTitle] : null) || {};
            await renderRefVersions(songTitle, bd);
        }
        if (typeof showToast === 'function') showToast('⭐ Added to North Star!');
        closeVersionHub();
        // Re-render Listen lens in song-detail if it is currently open
        setTimeout(function() {
            var listenPanel = document.querySelector('.sd-lens-panel[data-lens="listen"]');
            if (listenPanel && listenPanel.style.display !== 'none' && typeof _sdPopulateListenLensPublic === 'function') {
                _sdPopulateListenLensPublic(songTitle);
            }
        }, 300);

    } else if (dest === 'coverme') {
        // Add as cover version
        var entry = {
            artist: title || 'Unknown',
            url: url,
            description: 'Added via Find a Version',
            addedBy: typeof currentUserEmail !== 'undefined' ? currentUserEmail : '',
            addedAt: new Date().toISOString()
        };
        var existing = typeof loadBandDataFromDrive === 'function' ? (await loadBandDataFromDrive(songTitle, 'cover_me') || []) : [];
        var covers = Array.isArray(existing) ? existing : (existing.covers || []);
        covers.push(entry);
        if (typeof GLStore !== 'undefined' && GLStore.saveSongData) await GLStore.saveSongData(songTitle, 'cover_me', covers);
        else if (typeof saveBandDataToDrive === 'function') await saveBandDataToDrive(songTitle, 'cover_me', covers);
        if (typeof renderCoverMe === 'function') await renderCoverMe(songTitle);
        if (typeof showToast === 'function') showToast('🎤 Added to Cover Me!');
        closeVersionHub();

    } else if (dest === 'fadr') {
        // Launch the Fadr stem separation modal directly
        if (typeof pmSelectedAudioUrl !== 'undefined') pmSelectedAudioUrl = url;
        closeVersionHub();
        if (typeof importHarmoniesFromFadr === 'function') {
            importHarmoniesFromFadr(songTitle);
            // Pre-fill the URL after a tick (modal needs to render first)
            setTimeout(function() {
                var u = document.getElementById('fadrArchiveUrl');
                if (u) u.value = url;
            }, 150);
        }
        if (typeof showToast === 'function') showToast('🎚️ Fadr stem separation ready — hit Start!');

    } else if (dest === 'practice') {
        // Open in Practice Mode harmony tab
        if (typeof pmSelectedAudioUrl !== 'undefined') pmSelectedAudioUrl = url;
        closeVersionHub();
        if (typeof openPracticeMode === 'function') {
            openPracticeMode(songTitle, 'harmony');
        }
    }

    // Fire callback if provided
    if (vhCallback) vhCallback(url, title, vhSelectedPlatform);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function vhSourceBadge(sourceType) {
    if (!sourceType || sourceType === 'Unknown') return '';
    var colors = { SBD: '#34d399', AUD: '#fbbf24', Matrix: '#818cf8' };
    var icons = { SBD: '🎛️', AUD: '🎤', Matrix: '🔀' };
    var c = colors[sourceType] || '#64748b';
    return '<span class="vh-badge" style="color:' + c + ';border-color:' + c + '33">' + (icons[sourceType] || '') + sourceType + '</span> ';
}

function vhJamChartBadge(date) {
    if (!vhJamChartData || !date) return '';
    var ds = (date || '').split('T')[0];
    var jc = vhJamChartData.find(function(j) { return j.showdate === ds; });
    if (!jc) return '';
    return '<span class="vh-badge vh-badge-jc" title="' + (jc.jamchart_description || 'Jam Chart').replace(/"/g, '&quot;') + '">⭐JC</span> ';
}

async function vhLoadJamCharts() {
    if (vhJamChartData) return;
    var PROXY = typeof FADR_PROXY !== 'undefined' ? FADR_PROXY : '';
    try {
        var r = await fetch(PROXY + '/phishnet-jamchart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ songTitle: vhSong.title }) });
        var d = await r.json();
        if (d.entries?.length) vhJamChartData = d.entries;
    } catch(e) { /* silent */ }
}

console.log('🔍 Version Hub functions loaded');
