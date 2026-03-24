// ============================================================================
// js/features/band-feed.js — Band Feed (NOT chat)
// Aggregates existing data into a single chronological feed.
// Sources: ideas/posts, polls, song moments, gig notes, rehearsal captures.
// No new storage — reads from existing Firebase paths.
// ============================================================================

'use strict';

var _feedCache = null;
var _feedFilter = 'all'; // all | critical | needs_input | mine

// ── Page Renderer ────────────────────────────────────────────────────────────

window.renderBandFeedPage = async function(el) {
    if (!el) return;
    el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCE1 Band Feed</h1>'
        + '<p>Everything the band said, noted, and decided — in one place.</p></div>'
        + _feedFilterBar()
        + '<div id="feedList" style="margin-top:8px"><div style="text-align:center;padding:40px;color:var(--text-dim)">Loading feed...</div></div>';
    var items = await _feedLoadAll();
    _feedCache = items;
    _feedRender(items);
};

// ── Filter Bar ───────────────────────────────────────────────────────────────

function _feedFilterBar() {
    var filters = [
        { key: 'all', label: 'All' },
        { key: 'critical', label: '\u26A0\uFE0F Critical' },
        { key: 'needs_input', label: '\u2753 Needs Input' },
        { key: 'mine', label: '\uD83D\uDC64 My Items' }
    ];
    return '<div style="display:flex;gap:4px;flex-wrap:wrap">'
        + filters.map(function(f) {
            return '<button onclick="_feedSetFilter(\'' + f.key + '\')" id="feedFilter_' + f.key + '" style="font-size:0.75em;font-weight:' + (_feedFilter === f.key ? '800' : '600') + ';padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid ' + (_feedFilter === f.key ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (_feedFilter === f.key ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (_feedFilter === f.key ? '#a5b4fc' : 'var(--text-dim)') + '">' + f.label + '</button>';
        }).join('')
        + '</div>';
}

window._feedSetFilter = function(key) {
    _feedFilter = key;
    if (_feedCache) _feedRender(_feedCache);
    // Update button styles
    ['all','critical','needs_input','mine'].forEach(function(k) {
        var btn = document.getElementById('feedFilter_' + k);
        if (btn) {
            var active = k === key;
            btn.style.fontWeight = active ? '800' : '600';
            btn.style.borderColor = active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)';
            btn.style.background = active ? 'rgba(99,102,241,0.1)' : 'none';
            btn.style.color = active ? '#a5b4fc' : 'var(--text-dim)';
        }
    });
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
                    id: entry[0],
                    type: 'idea',
                    text: v.title || '',
                    link: v.link || '',
                    author: v.author || 'Anonymous',
                    timestamp: v.ts,
                    tag: v.tag || (v.convertedToPitch ? 'fyi' : 'needs_input'),
                    context: v.convertedToPitch ? 'Converted to pitch' : 'Band idea'
                });
            });
        }

        // 2. Polls
        var pollSnap = await db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value');
        var polls = pollSnap.val();
        if (polls) {
            Object.entries(polls).forEach(function(entry) {
                var v = entry[1];
                if (!v || !v.ts) return;
                var voteCount = v.votes ? Object.keys(v.votes).length : 0;
                items.push({
                    id: entry[0],
                    type: 'poll',
                    text: v.question || v.title || '',
                    author: v.author || 'Anonymous',
                    timestamp: v.ts,
                    tag: v.tag || 'needs_input',
                    context: voteCount + ' vote' + (voteCount !== 1 ? 's' : '')
                });
            });
        }

        // 3. Song Moments — scan all songs for moments (batch read)
        var songsSnap = await db.ref(bandPath('songs')).once('value');
        var allSongsData = songsSnap.val();
        if (allSongsData) {
            Object.entries(allSongsData).forEach(function(songEntry) {
                var songKey = songEntry[0];
                var songData = songEntry[1];
                if (!songData || !songData.moments) return;
                Object.entries(songData.moments).forEach(function(momEntry) {
                    var m = momEntry[1];
                    if (!m || !m.ts) return;
                    items.push({
                        id: momEntry[0],
                        type: m.mode === 'rehearsal' ? 'rehearsal_note' : 'song_moment',
                        songId: songKey,
                        text: m.text || '',
                        author: _feedResolveName(m.by),
                        timestamp: m.ts,
                        tag: m.tag || 'fyi',
                        context: '\uD83C\uDFB5 ' + songKey.replace(/_/g, ' ')
                    });
                });
            });
        }

    } catch(e) {
        console.warn('[Feed] Load error:', e.message);
    }

    // Sort reverse chronological
    items.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
    return items;
}

function _feedResolveName(byField) {
    if (!byField) return 'Anonymous';
    if (byField.indexOf('@') > 0) {
        // Email → try to map to band member name
        var emailMap = {
            'drewmerrill1029@gmail.com': 'Drew',
            'cmjalbert@gmail.com': 'Chris',
            'brian@hrestoration.com': 'Brian',
            'pierce.d.hale@gmail.com': 'Pierce',
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

    // Apply filter
    var filtered = items;
    if (_feedFilter === 'critical') {
        filtered = items.filter(function(i) { return i.tag === 'mission_critical'; });
    } else if (_feedFilter === 'needs_input') {
        filtered = items.filter(function(i) { return i.tag === 'needs_input'; });
    } else if (_feedFilter === 'mine') {
        filtered = items.filter(function(i) {
            var a = (i.author || '').toLowerCase();
            return a === myEmail.toLowerCase() || a === myName.toLowerCase() || a === (myEmail.split('@')[0] || '').toLowerCase();
        });
    }

    if (filtered.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">'
            + (_feedFilter === 'all' ? 'No feed items yet.' : 'No items match this filter.')
            + '</div>';
        return;
    }

    var html = '';
    var lastDate = '';
    filtered.forEach(function(item) {
        var itemDate = (item.timestamp || '').substring(0, 10);
        if (itemDate !== lastDate) {
            lastDate = itemDate;
            var dateLabel = _feedFormatDate(itemDate);
            html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;padding:14px 0 6px">' + dateLabel + '</div>';
        }
        html += _feedRenderItem(item);
    });
    el.innerHTML = html;
}

function _feedRenderItem(item) {
    var typeIcon = { idea: '\uD83D\uDCA1', poll: '\uD83D\uDDF3', rehearsal_note: '\uD83C\uDFB8', song_moment: '\uD83C\uDFB5', gig_note: '\uD83C\uDFA4' }[item.type] || '\uD83D\uDCCB';
    var tagBadge = '';
    if (item.tag === 'mission_critical') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)">\u26A0\uFE0F Critical</span>';
    else if (item.tag === 'needs_input') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)">\u2753 Input</span>';
    else if (item.tag === 'fun') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.25)">\uD83C\uDF89 Fun</span>';

    var timeStr = _feedTimeAgo(item.timestamp);
    var contextStr = item.context ? '<span style="font-size:0.72em;color:var(--accent-light)">' + _feedEsc(item.context) + '</span>' : '';

    return '<div style="padding:10px 14px;background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        + '<span style="font-size:1em">' + typeIcon + '</span>'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + _feedEsc(item.author) + '</span>'
        + contextStr
        + tagBadge
        + '<span style="margin-left:auto;font-size:0.68em;color:var(--text-dim)">' + timeStr + '</span>'
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
    try {
        return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch(e) { return dateStr; }
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

function _feedEsc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Register page ────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.feed = function(el) { renderBandFeedPage(el); };
}

console.log('\uD83D\uDCE1 band-feed.js loaded');
