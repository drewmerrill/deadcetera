// ============================================================================
// js/features/band-feed.js — Band Feed v2: Actionable Decision Surface
// Aggregates existing data. Prioritizes critical + needs-input items.
// No new storage. No chat. No messaging.
// ============================================================================

'use strict';

var _feedCache = null;
var _feedFilter = 'all'; // all | critical | needs_input | mine | since_rehearsal
var _feedLastRehearsalTs = null; // ISO timestamp of most recent rehearsal

// ── Song Title Resolver ──────────────────────────────────────────────────────
// Maps sanitized Firebase keys back to canonical display titles.

var _feedSongTitleMap = null;

function _feedBuildSongTitleMap() {
    if (_feedSongTitleMap) return;
    _feedSongTitleMap = {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    songs.forEach(function(s) {
        if (!s || !s.title) return;
        var key = (typeof sanitizeFirebasePath === 'function') ? sanitizeFirebasePath(s.title) : s.title;
        _feedSongTitleMap[key] = s.title;
    });
}

function _feedResolveSongTitle(firebaseKey) {
    _feedBuildSongTitleMap();
    return _feedSongTitleMap[firebaseKey] || firebaseKey.replace(/_/g, ' ');
}

// ── Page Renderer ────────────────────────────────────────────────────────────

window.renderBandFeedPage = async function(el) {
    if (!el) return;
    el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCE1 Band Feed</h1>'
        + '<p>Everything the band said, noted, and decided \u2014 prioritized.</p></div>'
        + '<div id="feedFilterBar"></div>'
        + '<div id="feedList" style="margin-top:8px"><div style="text-align:center;padding:40px;color:var(--text-dim)">Loading feed...</div></div>';
    var items = await _feedLoadAll();
    _feedCache = items;
    _feedRenderFilterBar(items);
    _feedRender(items);
};

// ── Filter Bar (with counts) ─────────────────────────────────────────────────

function _feedRenderFilterBar(items) {
    var bar = document.getElementById('feedFilterBar');
    if (!bar) return;
    var critCount = items.filter(function(i) { return i.tag === 'mission_critical'; }).length;
    var inputCount = items.filter(function(i) { return i.tag === 'needs_input' && !i.resolved; }).length;
    var sinceCount = _feedLastRehearsalTs ? items.filter(function(i) { return (i.timestamp || '') > _feedLastRehearsalTs; }).length : 0;

    var filters = [
        { key: 'all', label: 'All' },
        { key: 'critical', label: '\u26A0\uFE0F Critical' + (critCount ? ' (' + critCount + ')' : '') },
        { key: 'needs_input', label: '\u2753 Needs Input' + (inputCount ? ' (' + inputCount + ' pending)' : '') },
        { key: 'since_rehearsal', label: '\uD83C\uDFB8 Since Last Rehearsal' + (sinceCount ? ' (' + sinceCount + ')' : '') },
        { key: 'mine', label: '\uD83D\uDC64 My Items' }
    ];
    bar.innerHTML = '<div style="display:flex;gap:4px;flex-wrap:wrap">'
        + filters.map(function(f) {
            var active = _feedFilter === f.key;
            return '<button onclick="_feedSetFilter(\'' + f.key + '\')" id="feedFilter_' + f.key + '" style="font-size:0.75em;font-weight:' + (active ? '800' : '600') + ';padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + f.label + '</button>';
        }).join('')
        + '</div>';
}

window._feedSetFilter = function(key) {
    _feedFilter = key;
    if (_feedCache) {
        _feedRenderFilterBar(_feedCache);
        _feedRender(_feedCache);
    }
};

// ── Data Loading ─────────────────────────────────────────────────────────────

async function _feedLoadAll() {
    var items = [];
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return items;

    try {
        // 1. Ideas/Posts
        var ideasSnap = await db.ref(bandPath('ideas/posts')).orderByChild('ts').limitToLast(50).once('value');
        var ideas = ideasSnap.val();
        if (ideas) {
            Object.entries(ideas).forEach(function(entry) {
                var v = entry[1];
                if (!v || !v.ts) return;
                items.push({
                    id: entry[0], type: 'idea',
                    text: v.title || '', link: v.link || '',
                    author: v.author || 'Anonymous', timestamp: v.ts,
                    tag: v.tag || (v.convertedToPitch ? 'fyi' : 'needs_input'),
                    resolved: !!v.convertedToPitch,
                    context: v.convertedToPitch ? 'Converted to pitch' : 'Band idea'
                });
            });
        }

        // 2. Polls
        var pollSnap = await db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value');
        var polls = pollSnap.val();
        if (polls) {
            var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
            Object.entries(polls).forEach(function(entry) {
                var v = entry[1];
                if (!v || !v.ts) return;
                var voteCount = v.votes ? Object.keys(v.votes).length : 0;
                var allVoted = voteCount >= memberCount;
                items.push({
                    id: entry[0], type: 'poll',
                    text: v.question || v.title || '',
                    author: v.author || 'Anonymous', timestamp: v.ts,
                    tag: v.tag || 'needs_input',
                    resolved: allVoted,
                    context: voteCount + '/' + memberCount + ' voted' + (allVoted ? ' \u2705' : '')
                });
            });
        }

        // 3. Song Moments (batch read)
        var songsSnap = await db.ref(bandPath('songs')).once('value');
        var allSongsData = songsSnap.val();
        if (allSongsData) {
            Object.entries(allSongsData).forEach(function(songEntry) {
                var songKey = songEntry[0];
                var songData = songEntry[1];
                if (!songData || !songData.moments) return;
                var displayTitle = _feedResolveSongTitle(songKey);
                Object.entries(songData.moments).forEach(function(momEntry) {
                    var m = momEntry[1];
                    if (!m || !m.ts) return;
                    items.push({
                        id: momEntry[0],
                        type: m.mode === 'rehearsal' ? 'rehearsal_note' : 'song_moment',
                        songId: songKey, text: m.text || '',
                        author: _feedResolveName(m.by), timestamp: m.ts,
                        tag: m.tag || 'fyi', resolved: false,
                        context: '\uD83C\uDFB5 ' + displayTitle
                    });
                });
            });
        }

        // 4. Determine last rehearsal timestamp
        _feedLastRehearsalTs = await _feedGetLastRehearsalTs(db);

    } catch(e) {
        console.warn('[Feed] Load error:', e.message);
    }

    items.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
    return items;
}

async function _feedGetLastRehearsalTs(db) {
    // Check rehearsal_sessions for the most recent completed session
    try {
        var sessSnap = await db.ref(bandPath('rehearsal_sessions')).orderByChild('startedAt').limitToLast(1).once('value');
        var sess = sessSnap.val();
        if (sess) {
            var latest = Object.values(sess)[0];
            if (latest && latest.startedAt) return latest.startedAt;
        }
    } catch(e) {}
    // Fallback: check calendar_events for most recent past rehearsal
    try {
        var events = (typeof loadBandDataFromDrive === 'function')
            ? await loadBandDataFromDrive('_band', 'calendar_events') : null;
        if (events) {
            var today = new Date().toISOString().split('T')[0];
            var rehearsals = (Array.isArray(events) ? events : Object.values(events))
                .filter(function(e) { return e && e.type === 'rehearsal' && (e.date || '') <= today; })
                .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
            if (rehearsals.length > 0) return rehearsals[0].date + 'T00:00:00Z';
        }
    } catch(e) {}
    return null;
}

function _feedResolveName(byField) {
    if (!byField) return 'Anonymous';
    if (byField.indexOf('@') > 0) {
        var emailMap = {
            'drewmerrill1029@gmail.com': 'Drew', 'cmjalbert@gmail.com': 'Chris',
            'brian@hrestoration.com': 'Brian', 'pierce.d.hale@gmail.com': 'Pierce',
            'jnault@fegholdings.com': 'Jay'
        };
        return emailMap[byField] || byField.split('@')[0];
    }
    return byField;
}

// ── Rendering ────────────────────────────────────────────────────────────────

function _feedRender(items) {
    var el = document.getElementById('feedList');
    if (!el) return;

    var myEmail = (typeof currentUserEmail !== 'undefined') ? currentUserEmail : '';
    var myName = (typeof currentUserName !== 'undefined') ? currentUserName : '';

    // Separate critical items (always pinned to top in "all" view)
    var critical = items.filter(function(i) { return i.tag === 'mission_critical'; });
    var needsInput = items.filter(function(i) { return i.tag === 'needs_input' && !i.resolved; });
    var rest = items;

    // Apply filter
    var filtered;
    if (_feedFilter === 'critical') {
        filtered = critical;
    } else if (_feedFilter === 'needs_input') {
        filtered = needsInput;
    } else if (_feedFilter === 'mine') {
        filtered = items.filter(function(i) {
            var a = (i.author || '').toLowerCase();
            return a === myEmail.toLowerCase() || a === myName.toLowerCase() || a === (myEmail.split('@')[0] || '').toLowerCase();
        });
    } else if (_feedFilter === 'since_rehearsal') {
        if (_feedLastRehearsalTs) {
            filtered = items.filter(function(i) { return (i.timestamp || '') > _feedLastRehearsalTs; });
        } else {
            filtered = items; // no rehearsal found — show all
        }
    } else {
        // "all" view — pinned critical at top, then needs input, then rest
        filtered = null; // handled below
    }

    if (filtered !== null && filtered.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">'
            + 'No items match this filter.</div>';
        return;
    }

    var html = '';

    if (_feedFilter === 'all') {
        // PINNED: Critical items at top
        if (critical.length > 0) {
            html += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:10px;border-left:4px solid #ef4444">';
            html += '<div style="font-size:0.72em;font-weight:800;color:#f87171;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">\u26A0\uFE0F CRITICAL (' + critical.length + ')</div>';
            critical.forEach(function(item) { html += _feedRenderItem(item); });
            html += '</div>';
        }

        // GROUPED: Needs Input (unresolved)
        if (needsInput.length > 0) {
            html += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15);border-radius:10px;border-left:4px solid #f59e0b">';
            html += '<div style="font-size:0.72em;font-weight:800;color:#fbbf24;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">\u2753 NEEDS INPUT (' + needsInput.length + ' pending)</div>';
            needsInput.forEach(function(item) { html += _feedRenderItem(item); });
            html += '</div>';
        }

        // REST: chronological
        var restItems = items.filter(function(i) {
            return i.tag !== 'mission_critical' && !(i.tag === 'needs_input' && !i.resolved);
        });
        if (restItems.length > 0) {
            var lastDate = '';
            restItems.forEach(function(item) {
                var itemDate = (item.timestamp || '').substring(0, 10);
                if (itemDate !== lastDate) {
                    lastDate = itemDate;
                    html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;padding:14px 0 6px">' + _feedFormatDate(itemDate) + '</div>';
                }
                html += _feedRenderItem(item);
            });
        }
    } else {
        // Filtered views — simple chronological
        var lastDate = '';
        filtered.forEach(function(item) {
            var itemDate = (item.timestamp || '').substring(0, 10);
            if (itemDate !== lastDate) {
                lastDate = itemDate;
                html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;padding:14px 0 6px">' + _feedFormatDate(itemDate) + '</div>';
            }
            html += _feedRenderItem(item);
        });
    }

    el.innerHTML = html || '<div style="text-align:center;padding:40px;color:var(--text-dim)">No feed items yet.</div>';
}

function _feedRenderItem(item) {
    var typeIcon = { idea: '\uD83D\uDCA1', poll: '\uD83D\uDDF3', rehearsal_note: '\uD83C\uDFB8', song_moment: '\uD83C\uDFB5', gig_note: '\uD83C\uDFA4' }[item.type] || '\uD83D\uDCCB';
    var tagBadge = '';
    if (item.tag === 'mission_critical') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)">\u26A0\uFE0F Critical</span>';
    else if (item.tag === 'needs_input' && !item.resolved) tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)">\u2753 Input needed</span>';
    else if (item.tag === 'needs_input' && item.resolved) tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2)">\u2705 Resolved</span>';
    else if (item.tag === 'fun') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.25)">\uD83C\uDF89 Fun</span>';

    var timeStr = _feedTimeAgo(item.timestamp);
    var contextStr = item.context ? '<span style="font-size:0.72em;color:var(--accent-light)">' + _feedEsc(item.context) + '</span>' : '';

    return '<div style="padding:10px 14px;background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
        + '<span style="font-size:1em">' + typeIcon + '</span>'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + _feedEsc(item.author) + '</span>'
        + contextStr + tagBadge
        + '<span style="margin-left:auto;font-size:0.68em;color:var(--text-dim);flex-shrink:0">' + timeStr + '</span>'
        + '</div>'
        + '<div style="font-size:0.88em;color:var(--text-muted);line-height:1.5">' + _feedEsc(item.text) + '</div>'
        + (item.link ? '<a href="' + _feedEsc(item.link) + '" target="_blank" rel="noopener" style="font-size:0.75em;color:var(--accent-light);margin-top:4px;display:inline-block">\uD83D\uDD17 Link</a>' : '')
        + '</div>';
}

function _feedFormatDate(dateStr) {
    if (!dateStr) return '';
    var today = new Date().toISOString().substring(0, 10);
    var yesterday = new Date(Date.now() - 86400000).toISOString().substring(0, 10);
    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';
    try { return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
    catch(e) { return dateStr; }
}

function _feedTimeAgo(ts) {
    if (!ts) return '';
    var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 2) return 'just now';
    if (diff < 60) return diff + 'm ago';
    var h = Math.floor(diff / 60);
    if (h < 24) return h + 'h ago';
    var d = Math.floor(h / 24);
    if (d < 7) return d + 'd ago';
    return Math.floor(d / 7) + 'w ago';
}

function _feedEsc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ── Register page ────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.feed = function(el) { renderBandFeedPage(el); };
}

console.log('\uD83D\uDCE1 band-feed.js v2 loaded');
