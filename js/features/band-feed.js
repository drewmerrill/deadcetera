// ============================================================================
// js/features/band-feed.js — Band Feed v5: Unified Action Engine
//
// Personal action feed powered by FeedActionState (feed-action-state.js).
// All ownership, completion, badges, CTA, and prioritization logic is
// centralized in the action state engine. This file owns rendering + data.
//
// No chat. No messaging. No notifications.
// ============================================================================

'use strict';

var _feedCache = null;
var _feedMeta = {};
var _feedFilter = 'all';
var _feedLastRehearsalTs = null;

// ── Shorthand ───────────────────────────────────────────────────────────────

var FAS = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;

function _fas() {
    if (!FAS && typeof FeedActionState !== 'undefined') FAS = FeedActionState;
    return FAS;
}

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

function _feedItemKey(item) {
    return item.type + ':' + item.id;
}

// ── Onboarding ──────────────────────────────────────────────────────────────

var _FEED_OB_KEY = 'gl_onboarding_feed_step';

function _feedGetOnboardingStep() {
    var v = localStorage.getItem(_FEED_OB_KEY);
    if (v === 'done') return 'done';
    var n = parseInt(v, 10);
    return (n >= 1 && n <= 3) ? n : 1;
}

function _feedAdvanceOnboarding() {
    var step = _feedGetOnboardingStep();
    if (step === 'done') return;
    localStorage.setItem(_FEED_OB_KEY, (step + 1) > 3 ? 'done' : String(step + 1));
    _feedRemoveOnboardingBanner();
}

window._feedDismissOnboarding = function() {
    var step = _feedGetOnboardingStep();
    if (step === 'done') return;
    localStorage.setItem(_FEED_OB_KEY, step >= 3 ? 'done' : String(step + 1));
    _feedRemoveOnboardingBanner();
};

function _feedRemoveOnboardingBanner() {
    var b = document.getElementById('feedOnboarding');
    if (b) b.remove();
}

function _feedRenderOnboarding() {
    _feedRemoveOnboardingBanner();
    var step = _feedGetOnboardingStep();
    if (step === 'done') return;
    var msgs = {
        1: '\uD83D\uDC4B This is your band\u2019s command center. Red = urgent. Yellow = you owe input. Tap any item to take action.',
        2: 'Try this: tap a yellow item and respond. That\u2019s how your band stays locked in.',
        3: 'Use this instead of texting. Everything your band needs lives here.'
    };
    var msg = msgs[step];
    if (!msg) return;
    var el = document.getElementById('page-feed');
    if (!el) return;
    var banner = document.createElement('div');
    banner.id = 'feedOnboarding';
    banner.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;margin-bottom:8px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:10px;max-height:60px;overflow:hidden;animation:feedObFadeIn 0.3s ease';
    banner.innerHTML = '<div style="flex:1;font-size:0.8em;font-weight:600;color:#c7d2fe;line-height:1.4">' + msg + '</div>'
        + '<button onclick="_feedDismissOnboarding()" style="flex-shrink:0;font-size:0.72em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.15);color:#a5b4fc;white-space:nowrap">Got it</button>';
    var attnBar = document.getElementById('feedAttentionBar');
    if (attnBar) attnBar.parentNode.insertBefore(banner, attnBar);
    else el.insertBefore(banner, el.firstChild);
    if (!document.getElementById('feedObStyles')) {
        var s = document.createElement('style');
        s.id = 'feedObStyles';
        s.textContent = '@keyframes feedObFadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}';
        document.head.appendChild(s);
    }
}

// ── Page Renderer ────────────────────────────────────────────────────────────

window.renderBandFeedPage = async function(el) {
    if (!el) return;

    // Restore filter from return context if coming back
    var fas = _fas();
    if (fas) {
        var rc = fas.getReturnContext();
        if (rc && rc.filter) _feedFilter = rc.filter;
        fas.clearReturnContext();
    }

    _feedRemoveBackBar();
    el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCE1 Band Feed</h1>'
        + '<p>What do you owe? What\u2019s waiting on others? What changed?</p></div>'
        + '<div id="feedAttentionBar"></div>'
        + '<div id="feedFilterBar"></div>'
        + '<div id="feedList" style="margin-top:8px"><div style="text-align:center;padding:40px;color:var(--text-dim)">Loading feed\u2026</div></div>';
    await _feedLoadMeta();
    var items = await _feedLoadAll();
    _feedCache = items;
    _feedRenderOnboarding();
    _feedRenderAttentionBar(items);
    _feedRenderFilterBar(items);
    _feedRender(items);

    // Scroll to focused item if return context specified one
    if (rc && rc.focusItem) {
        setTimeout(function() {
            var target = document.getElementById('feedItem_' + rc.focusItem);
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 200);
    }
};

// ── Attention Summary Bar ───────────────────────────────────────────────────

function _feedRenderAttentionBar(items) {
    var bar = document.getElementById('feedAttentionBar');
    if (!bar) return;
    var fas = _fas();
    if (!fas) return;

    var summary = fas.computeSummary(items, _feedMeta);

    if (summary.allClear) {
        bar.innerHTML = '<div style="padding:10px 14px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.15);border-radius:10px;margin-bottom:10px;display:flex;align-items:center;gap:10px">'
            + '<span style="font-size:1.1em">\u2705</span>'
            + '<span style="font-size:0.82em;font-weight:700;color:#86efac">All clear \u2014 nothing needs your attention</span>'
            + '</div>';
        return;
    }

    var html = '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap">';
    if (summary.critical > 0) {
        html += '<button onclick="_feedSetFilter(\'critical\')" style="flex:1;min-width:130px;padding:12px 16px;border-radius:10px;cursor:pointer;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);display:flex;align-items:center;gap:10px">'
            + '<span style="width:10px;height:10px;border-radius:50%;background:#ef4444;flex-shrink:0"></span>'
            + '<div><div style="font-size:1.2em;font-weight:800;color:#f87171;line-height:1">' + summary.critical + '</div>'
            + '<div style="font-size:0.68em;font-weight:600;color:#fca5a5">Critical</div></div></button>';
    }
    if (summary.needsMyInput > 0) {
        html += '<button onclick="_feedSetFilter(\'needs_input\')" style="flex:1;min-width:130px;padding:12px 16px;border-radius:10px;cursor:pointer;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);display:flex;align-items:center;gap:10px">'
            + '<span style="width:10px;height:10px;border-radius:50%;background:#f59e0b;flex-shrink:0"></span>'
            + '<div><div style="font-size:1.2em;font-weight:800;color:#fbbf24;line-height:1">' + summary.needsMyInput + '</div>'
            + '<div style="font-size:0.68em;font-weight:600;color:#fcd34d">You owe input</div></div></button>';
    }
    html += '</div>';
    bar.innerHTML = html;
}

// ── Filter Bar ──────────────────────────────────────────────────────────────

function _feedRenderFilterBar(items) {
    var bar = document.getElementById('feedFilterBar');
    if (!bar) return;
    var fas = _fas();
    var summary = fas ? fas.computeSummary(items, _feedMeta) : { total: items.length, critical: 0, needsMyInput: 0, waitingOnBand: 0 };
    var sinceCount = _feedLastRehearsalTs ? items.filter(function(i) { return !_feedIsArchived(i) && (i.timestamp || '') > _feedLastRehearsalTs; }).length : 0;
    var archivedCount = items.filter(function(i) { return _feedIsArchived(i); }).length;

    var filters = [
        { key: 'all', label: 'All (' + summary.total + ')' },
        { key: 'critical', label: '\u26A0\uFE0F Critical' + (summary.critical ? ' (' + summary.critical + ')' : '') },
        { key: 'needs_input', label: '\u270B I Owe' + (summary.needsMyInput ? ' (' + summary.needsMyInput + ')' : '') },
        { key: 'waiting_on_band', label: '\uD83D\uDC65 Waiting' + (summary.waitingOnBand ? ' (' + summary.waitingOnBand + ')' : '') },
        { key: 'since_rehearsal', label: '\uD83C\uDFB8 Since Rehearsal' + (sinceCount ? ' (' + sinceCount + ')' : '') },
        { key: 'archived', label: '\uD83D\uDDC4\uFE0F Archived' + (archivedCount ? ' (' + archivedCount + ')' : '') }
    ];
    bar.innerHTML = '<div style="display:flex;gap:4px;flex-wrap:wrap">'
        + filters.map(function(f) {
            var active = _feedFilter === f.key;
            return '<button onclick="_feedSetFilter(\'' + f.key + '\')" style="font-size:0.75em;font-weight:' + (active ? '800' : '600') + ';padding:5px 12px;border-radius:6px;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + f.label + '</button>';
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
    return _feedMeta[_feedItemKey(item)] || {};
}
function _feedIsArchived(item) { return !!_feedGetMeta(item).archived; }
function _feedIsResolved(item) {
    var m = _feedGetMeta(item);
    return (m.resolved !== undefined) ? !!m.resolved : !!item.resolved;
}
function _feedGetTag(item) {
    var m = _feedGetMeta(item);
    return m.tag || item.tag || 'fyi';
}
function _feedGetNotes(item) { return _feedGetMeta(item).notes || []; }

async function _feedSaveMeta(item, updates) {
    var key = _feedItemKey(item);
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    if (!_feedMeta[key]) _feedMeta[key] = {};
    Object.keys(updates).forEach(function(k) { _feedMeta[key][k] = updates[k]; });
    try { await db.ref(bandPath('feed_meta/' + key)).update(updates); }
    catch(e) { console.warn('[Feed] Meta save error:', e.message); }
}

// ── Actions ─────────────────────────────────────────────────────────────────

window._feedAction = async function(action, type, id) {
    var item = _feedFindItem(type, id);
    if (!item) return;
    if (action === 'resolve') {
        var was = _feedIsResolved(item);
        await _feedSaveMeta(item, { resolved: !was });
        if (!was) _feedAdvanceOnboarding();
        _feedShowToast(was ? 'Reopened' : 'Marked resolved');
    } else if (action === 'archive') {
        await _feedSaveMeta(item, { archived: true });
        _feedShowToast('Archived');
    } else if (action === 'unarchive') {
        await _feedSaveMeta(item, { archived: false });
        _feedShowToast('Restored');
    }
    _feedRerender();
};

window._feedChangeTag = async function(type, id) {
    var item = _feedFindItem(type, id);
    if (!item) return;
    var tags = ['fyi', 'needs_input', 'mission_critical', 'fun'];
    var labels = { fyi: 'FYI', needs_input: 'Needs Input', mission_critical: 'Critical', fun: 'Fun' };
    var cur = _feedGetTag(item);
    var next = tags[(tags.indexOf(cur) + 1) % tags.length];
    await _feedSaveMeta(item, { tag: next });
    _feedShowToast('Tag: ' + labels[next]);
    _feedRerender();
};

window._feedShowNoteInput = function(type, id) {
    var el = document.getElementById('feedNote_' + type + '_' + id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
    if (el.style.display !== 'none') {
        var inp = el.querySelector('input');
        if (inp) inp.focus();
    }
};

window._feedSaveNote = async function(type, id) {
    var el = document.getElementById('feedNote_' + type + '_' + id);
    if (!el) return;
    var inp = el.querySelector('input');
    var text = inp ? inp.value.trim() : '';
    if (!text) return;
    var item = _feedFindItem(type, id);
    if (!item) return;
    var fas = _fas();
    var notes = _feedGetNotes(item).slice();
    var by = fas ? (fas.getMyDisplayName() || 'Me') : 'Me';
    notes.push({ text: text, by: by, ts: new Date().toISOString() });
    await _feedSaveMeta(item, { notes: notes });
    inp.value = '';
    _feedAdvanceOnboarding();
    _feedShowToast('Note added');
    _feedRerender();
};

window._feedToggleOlderNotes = function(type, id) {
    var el = document.getElementById('feedOlderNotes_' + type + '_' + id);
    var btn = document.getElementById('feedOlderNotesBtn_' + type + '_' + id);
    if (!el || !btn) return;
    var hidden = el.style.display === 'none';
    el.style.display = hidden ? '' : 'none';
    btn.textContent = hidden ? 'Hide older notes' : btn.dataset.label;
};

function _feedRerender() {
    if (!_feedCache) return;
    _feedRenderAttentionBar(_feedCache);
    _feedRenderFilterBar(_feedCache);
    _feedRender(_feedCache);
}

// ── Navigation ──────────────────────────────────────────────────────────────

window._feedNavigate = function(type, id, songId) {
    _feedAdvanceOnboarding();
    var fas = _fas();
    if (fas) {
        fas.setReturnContext({
            filter: _feedFilter,
            focusItem: type + '_' + id,
            ts: Date.now()
        });
        sessionStorage.setItem('gl_feed_context', '1');
    }
    _feedShowBackBar();

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

window._feedBackToFeed = function() {
    _feedRemoveBackBar();
    showPage('feed');
};

function _feedShowBackBar() {
    _feedRemoveBackBar();
    var bar = document.createElement('div');
    bar.id = 'feedBackBar';
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:900;display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(15,23,42,0.95);border-bottom:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)';
    bar.innerHTML = '<button onclick="_feedBackToFeed()" style="display:flex;align-items:center;gap:6px;font-size:0.8em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">\u2190 Back to Feed</button>';
    document.body.appendChild(bar);
}

function _feedRemoveBackBar() {
    var existing = document.getElementById('feedBackBar');
    if (existing) existing.remove();
}

// Feed context management via GLStore
if (typeof GLStore !== 'undefined' && GLStore.subscribe) {
    GLStore.subscribe('pageChanged', function(payload) {
        var fas = _fas();
        if (payload.page === 'feed') {
            // Returned to feed — context stays (restored in renderBandFeedPage)
            _feedRemoveBackBar();
        } else if (fas && fas.hasReturnContext()) {
            _feedShowBackBar();
        }
    });
}
// Show back bar on load if feed context was active
if (typeof FeedActionState !== 'undefined' && FeedActionState.hasReturnContext()) {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(_feedShowBackBar, 500);
    });
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _feedFindItem(type, id) {
    if (!_feedCache) return null;
    for (var i = 0; i < _feedCache.length; i++) {
        if (_feedCache[i].type === type && _feedCache[i].id === id) return _feedCache[i];
    }
    return null;
}

function _feedShowToast(msg) {
    if (typeof showToast === 'function') { showToast(msg); return; }
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:8px 18px;background:#334155;color:#e2e8f0;border-radius:8px;font-size:0.82em;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.3s';
    document.body.appendChild(t);
    requestAnimationFrame(function() { t.style.opacity = '1'; });
    setTimeout(function() { t.style.opacity = '0'; setTimeout(function() { t.remove(); }, 300); }, 2000);
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

// ── Data Loading ─────────────────────────────────────────────────────────────

async function _feedLoadAll() {
    var items = [];
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return items;
    var fas = _fas();

    try {
        // 1. Ideas
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

        // 2. Polls — per-user vote tracking
        var pollSnap = await db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value');
        var polls = pollSnap.val();
        if (polls) {
            var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
            var myVoteKey = fas ? fas.getMyVoteKey() : null;
            Object.entries(polls).forEach(function(entry) {
                var v = entry[1];
                if (!v || !v.ts) return;
                var voteCount = v.votes ? Object.keys(v.votes).length : 0;
                var allVoted = voteCount >= memberCount;
                var iVoted = !!(myVoteKey && v.votes && v.votes[myVoteKey] !== undefined);
                var remaining = memberCount - voteCount;
                var ctx = [];
                if (iVoted) ctx.push('You voted');
                ctx.push(allVoted ? (voteCount + '/' + memberCount + ' voted \u2705') : (remaining + ' of ' + memberCount + ' still need to vote'));
                items.push({
                    id: entry[0], type: 'poll',
                    text: v.question || v.title || '',
                    author: v.author || 'Anonymous', timestamp: v.ts,
                    tag: v.tag || 'needs_input',
                    resolved: allVoted, iVoted: iVoted,
                    context: ctx.join(' \u00B7 ')
                });
            });
        }

        // 3. Song Moments
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

        _feedLastRehearsalTs = await _feedGetLastRehearsalTs(db);
    } catch(e) {
        console.warn('[Feed] Load error:', e.message);
    }

    // Sort by priority (action urgency), not just chronology
    if (fas) {
        items = fas.sortByPriority(items, _feedMeta);
    } else {
        items.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
    }
    return items;
}

async function _feedGetLastRehearsalTs(db) {
    try {
        var sessSnap = await db.ref(bandPath('rehearsal_sessions')).orderByChild('startedAt').limitToLast(1).once('value');
        var sess = sessSnap.val();
        if (sess) { var latest = Object.values(sess)[0]; if (latest && latest.startedAt) return latest.startedAt; }
    } catch(e) {}
    try {
        var events = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive('_band', 'calendar_events') : null;
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

// ── Rendering ────────────────────────────────────────────────────────────────

function _feedRender(items) {
    var el = document.getElementById('feedList');
    if (!el) return;
    var fas = _fas();

    var visible;
    if (_feedFilter === 'archived') {
        visible = items.filter(function(i) { return _feedIsArchived(i); });
    } else {
        visible = items.filter(function(i) { return !_feedIsArchived(i); });
    }

    // Apply filter using action state
    var filtered;
    if (_feedFilter === 'critical') {
        filtered = visible.filter(function(i) { var s = fas ? fas.getActionState(i, _feedGetMeta(i)) : null; return s && s.priorityBucket === 1; });
    } else if (_feedFilter === 'needs_input') {
        filtered = visible.filter(function(i) { var s = fas ? fas.getActionState(i, _feedGetMeta(i)) : null; return s && s.needsMyInput; });
    } else if (_feedFilter === 'waiting_on_band') {
        filtered = visible.filter(function(i) { var s = fas ? fas.getActionState(i, _feedGetMeta(i)) : null; return s && s.waitingOnOthers; });
    } else if (_feedFilter === 'since_rehearsal') {
        filtered = _feedLastRehearsalTs ? visible.filter(function(i) { return (i.timestamp || '') > _feedLastRehearsalTs; }) : visible;
    } else if (_feedFilter === 'archived') {
        filtered = visible;
    } else {
        filtered = null; // "all" — grouped rendering below
    }

    if (filtered !== null && filtered.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">'
            + (_feedFilter === 'archived' ? 'No archived items.' : 'No items match this filter.')
            + '</div>';
        return;
    }

    var html = '';

    if (_feedFilter === 'all' && fas) {
        // Group by action urgency
        var groups = { critical: [], myInput: [], bandWait: [], rest: [] };
        visible.forEach(function(item) {
            var state = fas.getActionState(item, _feedGetMeta(item));
            if (state.priorityBucket === 1) groups.critical.push(item);
            else if (state.needsMyInput) groups.myInput.push(item);
            else if (state.waitingOnOthers) groups.bandWait.push(item);
            else groups.rest.push(item);
        });

        if (groups.critical.length) {
            html += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:10px;border-left:4px solid #ef4444">';
            html += '<div style="font-size:0.72em;font-weight:800;color:#f87171;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">\u26A0\uFE0F CRITICAL (' + groups.critical.length + ')</div>';
            groups.critical.forEach(function(item) { html += _feedRenderItem(item); });
            html += '</div>';
        }
        if (groups.myInput.length) {
            html += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(245,158,11,0.04);border:1px solid rgba(245,158,11,0.15);border-radius:10px;border-left:4px solid #f59e0b">';
            html += '<div style="font-size:0.72em;font-weight:800;color:#fbbf24;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">\u270B YOU OWE INPUT (' + groups.myInput.length + ')</div>';
            groups.myInput.forEach(function(item) { html += _feedRenderItem(item); });
            html += '</div>';
        }
        if (groups.bandWait.length) {
            html += '<div style="margin-bottom:12px;padding:10px 14px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:10px;border-left:4px solid #6366f1">';
            html += '<div style="font-size:0.72em;font-weight:800;color:#a5b4fc;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:8px">\uD83D\uDC65 WAITING ON BAND (' + groups.bandWait.length + ')</div>';
            groups.bandWait.forEach(function(item) { html += _feedRenderItem(item); });
            html += '</div>';
        }
        if (groups.rest.length) {
            var lastDate = '';
            groups.rest.forEach(function(item) {
                var d = (item.timestamp || '').substring(0, 10);
                if (d !== lastDate) { lastDate = d; html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;padding:14px 0 6px">' + _feedFormatDate(d) + '</div>'; }
                html += _feedRenderItem(item);
            });
        }
    } else {
        var lastDate = '';
        (filtered || visible).forEach(function(item) {
            var d = (item.timestamp || '').substring(0, 10);
            if (d !== lastDate) { lastDate = d; html += '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);letter-spacing:0.05em;text-transform:uppercase;padding:14px 0 6px">' + _feedFormatDate(d) + '</div>'; }
            html += _feedRenderItem(item);
        });
    }

    el.innerHTML = html || '<div style="text-align:center;padding:40px;color:var(--text-dim)">No feed items yet.</div>';
}

function _feedRenderItem(item) {
    var fas = _fas();
    var meta = _feedGetMeta(item);
    var state = fas ? fas.getActionState(item, meta) : null;

    var typeIcon = { idea: '\uD83D\uDCA1', poll: '\uD83D\uDDF3\uFE0F', rehearsal_note: '\uD83C\uDFB8', song_moment: '\uD83C\uDFB5', gig_note: '\uD83C\uDFA4' }[item.type] || '\uD83D\uDCCB';
    var badgeHtml = (fas && state) ? fas.renderBadgeHTML(state.badge) : '';
    var resolved = state ? state.isResolved : _feedIsResolved(item);
    var archived = state ? state.isArchived : _feedIsArchived(item);

    var timeStr = _feedTimeAgo(item.timestamp);
    var contextStr = item.context ? '<span style="font-size:0.72em;color:var(--accent-light)">' + _feedEsc(item.context) + '</span>' : '';

    var safeType = _feedEsc(item.type);
    var safeId = _feedEsc(item.id);
    var safeSongId = item.songId ? _feedEsc(item.songId) : '';
    var clickAttr = ' onclick="_feedNavigate(\'' + safeType + '\',\'' + safeId + '\',\'' + safeSongId + '\')"';

    var cardStyle = 'padding:10px 14px;background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:10px;margin-bottom:6px';
    if (resolved) cardStyle += ';opacity:0.6';
    if (archived) cardStyle += ';opacity:0.45';

    var html = '<div id="feedItem_' + safeType + '_' + safeId + '" style="' + cardStyle + '">';

    // Header
    html += '<div' + clickAttr + ' style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;cursor:pointer">'
        + '<span style="font-size:1em">' + typeIcon + '</span>'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + _feedEsc(item.author) + '</span>'
        + contextStr + badgeHtml
        + '<span style="margin-left:auto;font-size:0.68em;color:var(--text-dim);flex-shrink:0">' + timeStr + '</span>'
        + '</div>';

    // Body
    html += '<div' + clickAttr + ' style="font-size:0.88em;color:var(--text-muted);line-height:1.5;cursor:pointer">' + _feedEsc(item.text) + '</div>';

    if (item.link) html += '<a href="' + _feedEsc(item.link) + '" target="_blank" rel="noopener" style="font-size:0.75em;color:var(--accent-light);margin-top:4px;display:inline-block">\uD83D\uDD17 Link</a>';

    // Notes
    var notes = _feedGetNotes(item);
    if (notes.length > 0) {
        html += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.04)">';
        var latest = notes[notes.length - 1];
        var isNew = latest.ts && (Date.now() - new Date(latest.ts).getTime() < 86400000);
        html += '<div style="font-size:0.78em;padding:4px 0;' + (isNew ? 'color:var(--text);font-weight:600' : 'color:var(--text-muted)') + '">'
            + (isNew ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#818cf8;margin-right:5px;vertical-align:middle"></span>' : '')
            + '<span style="font-weight:700;color:' + (isNew ? '#a5b4fc' : 'var(--text-muted)') + '">' + _feedEsc(latest.by) + ':</span> '
            + _feedEsc(latest.text)
            + ' <span style="opacity:0.5;font-size:0.9em">' + _feedTimeAgo(latest.ts) + '</span></div>';
        if (notes.length > 1) {
            var oc = notes.length - 1;
            html += '<button id="feedOlderNotesBtn_' + safeType + '_' + safeId + '" data-label="View ' + oc + ' older note' + (oc > 1 ? 's' : '') + '" onclick="event.stopPropagation();_feedToggleOlderNotes(\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.68em;font-weight:600;color:var(--accent-light,#818cf8);background:none;border:none;cursor:pointer;padding:2px 0;opacity:0.7">View ' + oc + ' older note' + (oc > 1 ? 's' : '') + '</button>';
            html += '<div id="feedOlderNotes_' + safeType + '_' + safeId + '" style="display:none">';
            for (var ni = notes.length - 2; ni >= 0; ni--) {
                var n = notes[ni];
                html += '<div style="font-size:0.75em;color:var(--text-dim);padding:2px 0"><span style="font-weight:700;color:var(--text-muted)">' + _feedEsc(n.by) + ':</span> ' + _feedEsc(n.text) + ' <span style="opacity:0.5">' + _feedTimeAgo(n.ts) + '</span></div>';
            }
            html += '</div>';
        }
        html += '</div>';
    }

    // Action bar
    var effectiveTag = state ? state.effectiveTag : _feedGetTag(item);
    html += '<div style="display:flex;align-items:center;gap:4px;margin-top:8px;flex-wrap:wrap" onclick="event.stopPropagation()">';
    html += '<button onclick="_feedAction(\'resolve\',\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:' + (resolved ? 'rgba(34,197,94,0.1)' : 'none') + ';color:' + (resolved ? '#86efac' : 'var(--text-dim)') + '">' + (resolved ? '\u2705 Resolved' : '\u2611\uFE0F Resolve') + '</button>';
    var tagLabels = { fyi: 'FYI', needs_input: 'Needs Input', mission_critical: 'Critical', fun: 'Fun' };
    html += '<button onclick="_feedChangeTag(\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">\uD83C\uDFF7\uFE0F ' + (tagLabels[effectiveTag] || effectiveTag) + '</button>';
    html += '<button onclick="_feedShowNoteInput(\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">\uD83D\uDCDD Note</button>';
    if (archived) {
        html += '<button onclick="_feedAction(\'unarchive\',\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">\u21A9\uFE0F Restore</button>';
    } else {
        html += '<button onclick="_feedAction(\'archive\',\'' + safeType + '\',\'' + safeId + '\')" style="margin-left:auto;font-size:0.68em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);opacity:0.5">\uD83D\uDDC4\uFE0F Archive</button>';
    }
    html += '</div>';

    // Inline note input
    html += '<div id="feedNote_' + safeType + '_' + safeId + '" style="display:none;margin-top:6px" onclick="event.stopPropagation()"><div style="display:flex;gap:6px">'
        + '<input type="text" placeholder="Add a note\u2026" onkeydown="if(event.key===\'Enter\')_feedSaveNote(\'' + safeType + '\',\'' + safeId + '\')" style="flex:1;font-size:0.78em;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none">'
        + '<button onclick="_feedSaveNote(\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.72em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Save</button>'
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

// ── Register ────────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.feed = function(el) { renderBandFeedPage(el); };
}

console.log('\uD83D\uDCE1 band-feed.js v5 loaded \u2014 unified action engine');
