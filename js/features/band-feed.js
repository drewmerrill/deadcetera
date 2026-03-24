// ============================================================================
// js/features/band-feed.js — Band Feed v3: Actionable Workflow Surface
// Aggregates existing data. Prioritizes critical + needs-input items.
// Click-through navigation, inline actions, archive, tag editing, notes.
// Feed metadata (archive, resolved, tags, notes) stored in feed_meta.
// No chat. No messaging.
// ============================================================================

'use strict';

var _feedCache = null;
var _feedMeta = {};   // feed_meta from Firebase: { itemKey: { archived, resolved, tag, notes[] } }
var _feedFilter = 'all'; // all | critical | needs_input | mine | since_rehearsal | archived
var _feedLastRehearsalTs = null; // ISO timestamp of most recent rehearsal

// ── Song Title Resolver ──────────────────────────────────────────────────────

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

// ── Unique key for feed_meta lookup ──────────────────────────────────────────

function _feedItemKey(item) {
    return item.type + ':' + item.id;
}

// ── Page Renderer ────────────────────────────────────────────────────────────

window.renderBandFeedPage = async function(el) {
    if (!el) return;
    el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCE1 Band Feed</h1>'
        + '<p>Everything the band said, noted, and decided \u2014 actionable.</p></div>'
        + '<div id="feedFilterBar"></div>'
        + '<div id="feedList" style="margin-top:8px"><div style="text-align:center;padding:40px;color:var(--text-dim)">Loading feed...</div></div>';
    // Load feed_meta first, then items
    await _feedLoadMeta();
    var items = await _feedLoadAll();
    _feedCache = items;
    _feedRenderFilterBar(items);
    _feedRender(items);
};

// ── Filter Bar (with counts) ─────────────────────────────────────────────────

function _feedRenderFilterBar(items) {
    var bar = document.getElementById('feedFilterBar');
    if (!bar) return;

    // Exclude archived from all counts except the archive filter
    var visible = items.filter(function(i) { return !_feedIsArchived(i); });
    var critCount = visible.filter(function(i) { return _feedGetTag(i) === 'mission_critical'; }).length;
    var inputCount = visible.filter(function(i) { return _feedGetTag(i) === 'needs_input' && !_feedIsResolved(i); }).length;
    var sinceCount = _feedLastRehearsalTs ? visible.filter(function(i) { return (i.timestamp || '') > _feedLastRehearsalTs; }).length : 0;
    var archivedCount = items.filter(function(i) { return _feedIsArchived(i); }).length;

    var filters = [
        { key: 'all', label: 'All (' + visible.length + ')' },
        { key: 'critical', label: '\u26A0\uFE0F Critical' + (critCount ? ' (' + critCount + ')' : '') },
        { key: 'needs_input', label: '\u2753 Needs Input' + (inputCount ? ' (' + inputCount + ')' : '') },
        { key: 'since_rehearsal', label: '\uD83C\uDFB8 Since Rehearsal' + (sinceCount ? ' (' + sinceCount + ')' : '') },
        { key: 'mine', label: '\uD83D\uDC64 My Items' },
        { key: 'archived', label: '\uD83D\uDDC4\uFE0F Archived' + (archivedCount ? ' (' + archivedCount + ')' : '') }
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

// ── Feed Meta (archive, resolved, tags, notes) ──────────────────────────────

async function _feedLoadMeta() {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    try {
        var snap = await db.ref(bandPath('feed_meta')).once('value');
        _feedMeta = snap.val() || {};
    } catch(e) {
        console.warn('[Feed] Meta load error:', e.message);
        _feedMeta = {};
    }
}

function _feedGetMeta(item) {
    var key = _feedItemKey(item);
    return _feedMeta[key] || {};
}

function _feedIsArchived(item) {
    return !!_feedGetMeta(item).archived;
}

function _feedIsResolved(item) {
    // Check feed_meta override first, then original item data
    var meta = _feedGetMeta(item);
    if (meta.resolved !== undefined) return !!meta.resolved;
    return !!item.resolved;
}

function _feedGetTag(item) {
    var meta = _feedGetMeta(item);
    return meta.tag || item.tag || 'fyi';
}

function _feedGetNotes(item) {
    return _feedGetMeta(item).notes || [];
}

async function _feedSaveMeta(item, updates) {
    var key = _feedItemKey(item);
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;

    if (!_feedMeta[key]) _feedMeta[key] = {};
    Object.keys(updates).forEach(function(k) { _feedMeta[key][k] = updates[k]; });

    try {
        await db.ref(bandPath('feed_meta/' + key)).update(updates);
    } catch(e) {
        console.warn('[Feed] Meta save error:', e.message);
    }
}

// ── Actions (global handlers) ────────────────────────────────────────────────

window._feedAction = async function(action, type, id) {
    var item = _feedFindItem(type, id);
    if (!item) return;

    if (action === 'resolve') {
        var isResolved = _feedIsResolved(item);
        await _feedSaveMeta(item, { resolved: !isResolved });
        _feedShowToast(isResolved ? 'Reopened' : 'Marked resolved');
    } else if (action === 'archive') {
        await _feedSaveMeta(item, { archived: true });
        _feedShowToast('Archived');
    } else if (action === 'unarchive') {
        await _feedSaveMeta(item, { archived: false });
        _feedShowToast('Restored from archive');
    }

    // Re-render
    if (_feedCache) {
        _feedRenderFilterBar(_feedCache);
        _feedRender(_feedCache);
    }
};

window._feedChangeTag = async function(type, id) {
    var item = _feedFindItem(type, id);
    if (!item) return;
    var currentTag = _feedGetTag(item);
    var tags = ['fyi', 'needs_input', 'mission_critical', 'fun'];
    var labels = { fyi: 'FYI', needs_input: 'Needs Input', mission_critical: 'Critical', fun: 'Fun' };
    // Cycle to next tag
    var idx = tags.indexOf(currentTag);
    var nextTag = tags[(idx + 1) % tags.length];
    await _feedSaveMeta(item, { tag: nextTag });
    _feedShowToast('Tag: ' + labels[nextTag]);
    if (_feedCache) {
        _feedRenderFilterBar(_feedCache);
        _feedRender(_feedCache);
    }
};

window._feedShowNoteInput = function(type, id) {
    var el = document.getElementById('feedNote_' + type + '_' + id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
    if (el.style.display !== 'none') {
        var input = el.querySelector('input');
        if (input) input.focus();
    }
};

window._feedSaveNote = async function(type, id) {
    var el = document.getElementById('feedNote_' + type + '_' + id);
    if (!el) return;
    var input = el.querySelector('input');
    var text = input ? input.value.trim() : '';
    if (!text) return;

    var item = _feedFindItem(type, id);
    if (!item) return;

    var notes = _feedGetNotes(item).slice(); // clone
    var userName = (typeof currentUserName !== 'undefined' && currentUserName)
        ? currentUserName.split(' ')[0]
        : (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail.split('@')[0] : 'Me';
    notes.push({ text: text, by: userName, ts: new Date().toISOString() });
    await _feedSaveMeta(item, { notes: notes });

    input.value = '';
    _feedShowToast('Note added');
    if (_feedCache) {
        _feedRenderFilterBar(_feedCache);
        _feedRender(_feedCache);
    }
};

window._feedNavigate = function(type, id, songId) {
    if (type === 'song_moment' || type === 'rehearsal_note') {
        if (songId) {
            var displayTitle = _feedResolveSongTitle(songId);
            showPage('songs');
            setTimeout(function() { selectSong(displayTitle); }, 150);
        }
    } else if (type === 'idea' || type === 'poll') {
        showPage('ideas');
    }
};

function _feedFindItem(type, id) {
    if (!_feedCache) return null;
    for (var i = 0; i < _feedCache.length; i++) {
        if (_feedCache[i].type === type && _feedCache[i].id === id) return _feedCache[i];
    }
    return null;
}

function _feedShowToast(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    // Fallback mini-toast
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 18px;background:#334155;color:#e2e8f0;border-radius:8px;font-size:0.82em;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.3s';
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.style.opacity = '1'; });
    setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 300); }, 2000);
}

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
    try {
        var sessSnap = await db.ref(bandPath('rehearsal_sessions')).orderByChild('startedAt').limitToLast(1).once('value');
        var sess = sessSnap.val();
        if (sess) {
            var latest = Object.values(sess)[0];
            if (latest && latest.startedAt) return latest.startedAt;
        }
    } catch(e) {}
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

    // Apply archive filter + tag overrides from meta
    var visible;
    if (_feedFilter === 'archived') {
        visible = items.filter(function(i) { return _feedIsArchived(i); });
    } else {
        visible = items.filter(function(i) { return !_feedIsArchived(i); });
    }

    // Separate by effective tag (meta overrides original)
    var critical = visible.filter(function(i) { return _feedGetTag(i) === 'mission_critical'; });
    var needsInput = visible.filter(function(i) { return _feedGetTag(i) === 'needs_input' && !_feedIsResolved(i); });

    // Apply filter
    var filtered;
    if (_feedFilter === 'critical') {
        filtered = critical;
    } else if (_feedFilter === 'needs_input') {
        filtered = needsInput;
    } else if (_feedFilter === 'mine') {
        filtered = visible.filter(function(i) {
            var a = (i.author || '').toLowerCase();
            return a === myEmail.toLowerCase() || a === myName.toLowerCase() || a === (myEmail.split('@')[0] || '').toLowerCase();
        });
    } else if (_feedFilter === 'since_rehearsal') {
        if (_feedLastRehearsalTs) {
            filtered = visible.filter(function(i) { return (i.timestamp || '') > _feedLastRehearsalTs; });
        } else {
            filtered = visible;
        }
    } else if (_feedFilter === 'archived') {
        filtered = visible; // already filtered above
    } else {
        filtered = null; // "all" handled below
    }

    if (filtered !== null && filtered.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">'
            + (_feedFilter === 'archived' ? 'No archived items.' : 'No items match this filter.')
            + '</div>';
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

        // REST: chronological (exclude critical and unresolved needs_input already shown)
        var restItems = visible.filter(function(i) {
            return _feedGetTag(i) !== 'mission_critical' && !(_feedGetTag(i) === 'needs_input' && !_feedIsResolved(i));
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
    var typeIcon = { idea: '\uD83D\uDCA1', poll: '\uD83D\uDDF3\uFE0F', rehearsal_note: '\uD83C\uDFB8', song_moment: '\uD83C\uDFB5', gig_note: '\uD83C\uDFA4' }[item.type] || '\uD83D\uDCCB';
    var effectiveTag = _feedGetTag(item);
    var resolved = _feedIsResolved(item);
    var archived = _feedIsArchived(item);

    // Tag badge (uses effective tag from meta)
    var tagBadge = '';
    if (effectiveTag === 'mission_critical') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)">\u26A0\uFE0F Critical</span>';
    else if (effectiveTag === 'needs_input' && !resolved) tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)">\u2753 Input needed</span>';
    else if (effectiveTag === 'needs_input' && resolved) tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2)">\u2705 Resolved</span>';
    else if (effectiveTag === 'fun') tagBadge = '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:rgba(34,197,94,0.15);color:#86efac;border:1px solid rgba(34,197,94,0.25)">\uD83C\uDF89 Fun</span>';

    var timeStr = _feedTimeAgo(item.timestamp);
    var contextStr = item.context ? '<span style="font-size:0.72em;color:var(--accent-light)">' + _feedEsc(item.context) + '</span>' : '';

    // Escape values for onclick attributes
    var safeType = _feedEsc(item.type);
    var safeId = _feedEsc(item.id);
    var safeSongId = item.songId ? _feedEsc(item.songId) : '';

    // Click-through: whole card is clickable (except action buttons)
    var clickAttr = ' onclick="_feedNavigate(\'' + safeType + '\',\'' + safeId + '\',\'' + safeSongId + '\')" style="cursor:pointer"';

    // Resolved styling: dim the card
    var cardStyle = 'padding:10px 14px;background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;margin-bottom:6px';
    if (resolved) cardStyle += ';opacity:0.6';
    if (archived) cardStyle += ';opacity:0.45';

    var html = '<div style="' + cardStyle + '">';

    // Header row: clickable for navigation
    html += '<div' + clickAttr + ' style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;cursor:pointer">'
        + '<span style="font-size:1em">' + typeIcon + '</span>'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + _feedEsc(item.author) + '</span>'
        + contextStr + tagBadge
        + '<span style="margin-left:auto;font-size:0.68em;color:var(--text-dim);flex-shrink:0">' + timeStr + '</span>'
        + '</div>';

    // Body: clickable
    html += '<div' + clickAttr + ' style="font-size:0.88em;color:var(--text-muted);line-height:1.5;cursor:pointer">' + _feedEsc(item.text) + '</div>';

    // Link (if present)
    if (item.link) {
        html += '<a href="' + _feedEsc(item.link) + '" target="_blank" rel="noopener" style="font-size:0.75em;color:var(--accent-light);margin-top:4px;display:inline-block">\uD83D\uDD17 Link</a>';
    }

    // Feed notes (from meta)
    var notes = _feedGetNotes(item);
    if (notes.length > 0) {
        html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">';
        notes.forEach(function(n) {
            html += '<div style="font-size:0.75em;color:var(--text-dim);padding:2px 0">'
                + '<span style="font-weight:700;color:var(--text-muted)">' + _feedEsc(n.by) + ':</span> '
                + _feedEsc(n.text)
                + ' <span style="opacity:0.5">' + _feedTimeAgo(n.ts) + '</span>'
                + '</div>';
        });
        html += '</div>';
    }

    // Action bar
    html += '<div style="display:flex;align-items:center;gap:4px;margin-top:8px;flex-wrap:wrap" onclick="event.stopPropagation()">';

    // Resolve toggle
    html += '<button onclick="_feedAction(\'' + (resolved ? 'resolve' : 'resolve') + '\',\'' + safeType + '\',\'' + safeId + '\')" '
        + 'style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:' + (resolved ? 'rgba(34,197,94,0.1)' : 'none') + ';color:' + (resolved ? '#86efac' : 'var(--text-dim)') + '">'
        + (resolved ? '\u2705 Resolved' : '\u2611\uFE0F Resolve') + '</button>';

    // Tag cycle
    var tagLabels = { fyi: 'FYI', needs_input: 'Needs Input', mission_critical: 'Critical', fun: 'Fun' };
    html += '<button onclick="_feedChangeTag(\'' + safeType + '\',\'' + safeId + '\')" '
        + 'style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">'
        + '\uD83C\uDFF7\uFE0F ' + (tagLabels[effectiveTag] || effectiveTag) + '</button>';

    // Add note
    html += '<button onclick="_feedShowNoteInput(\'' + safeType + '\',\'' + safeId + '\')" '
        + 'style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">'
        + '\uD83D\uDCDD Note</button>';

    // Archive / Unarchive
    if (archived) {
        html += '<button onclick="_feedAction(\'unarchive\',\'' + safeType + '\',\'' + safeId + '\')" '
            + 'style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">'
            + '\u21A9\uFE0F Restore</button>';
    } else {
        html += '<button onclick="_feedAction(\'archive\',\'' + safeType + '\',\'' + safeId + '\')" '
            + 'style="margin-left:auto;font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);opacity:0.5">'
            + '\uD83D\uDDC4\uFE0F Archive</button>';
    }
    html += '</div>';

    // Inline note input (hidden by default)
    html += '<div id="feedNote_' + safeType + '_' + safeId + '" style="display:none;margin-top:6px" onclick="event.stopPropagation()">'
        + '<div style="display:flex;gap:6px">'
        + '<input type="text" placeholder="Add a note..." onkeydown="if(event.key===\'Enter\')_feedSaveNote(\'' + safeType + '\',\'' + safeId + '\')" '
        + 'style="flex:1;font-size:0.78em;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none">'
        + '<button onclick="_feedSaveNote(\'' + safeType + '\',\'' + safeId + '\')" '
        + 'style="font-size:0.72em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Save</button>'
        + '</div></div>';

    html += '</div>';
    return html;
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

function _feedEsc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ── Register page ────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.feed = function(el) { renderBandFeedPage(el); };
}

console.log('\uD83D\uDCE1 band-feed.js v3 loaded — actionable workflow surface');
