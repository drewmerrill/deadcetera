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

// ── Feed Guidance ───────────────────────────────────────────────────────────
// Contextual explainer — shows for first 3 visits, then auto-hides.
// Not a tutorial. Not a modal. Just orientation.

var _FEED_HELP_KEY = 'gl_feed_help_seen';
var _FEED_HIGHLIGHT_KEY = 'gl_first_action_highlight_seen';
var _feedSessionTotal = 0;        // total action items at session start
var _feedSessionCompleted = 0;    // actions completed this session
var _FEED_HISTORY_KEY = 'gl_feed_action_history';
var _FEED_LAST_COUNT_KEY = 'gl_feed_last_count'; // needsMyInput at end of last session

function _feedHelpViewCount() {
    return parseInt(localStorage.getItem(_FEED_HELP_KEY) || '0', 10);
}

// ── Completion Engine ────────────────────────────────────────────────────────
// Called after every meaningful action. Handles:
//   - First-action highlight cleanup
//   - Continuous momentum nudges
//   - Auto-advance to next item
//   - Progress bar update
//   - Completion celebration

function _feedAdvanceOnboarding() {
    // Clean up first-action highlight (one-time)
    if (!localStorage.getItem(_FEED_HIGHLIGHT_KEY)) {
        localStorage.setItem(_FEED_HIGHLIGHT_KEY, '1');
        var hl = document.querySelector('.feed-first-action');
        if (hl) hl.classList.remove('feed-first-action');
        var mg = document.getElementById('feedMicroGuide');
        if (mg) mg.remove();
    }

    // Track completion + compute remaining
    _feedSessionCompleted++;
    _feedRecordAction();
    if (typeof FeedMetrics !== 'undefined') FeedMetrics.trackEvent('action_completed');
    var fas = _fas();
    if (!fas || !_feedCache) return;
    var summary = fas.computeSummary(_feedCache, _feedMeta);
    var remaining = Math.max(0, summary.needsMyInput - 1);

    // Momentum nudge
    if (remaining === 0) {
        // Will be handled by completion celebration after rerender
    } else if (remaining === 1) {
        _feedShowToast('Last one \u2014 finish it');
    } else if (remaining === 2) {
        _feedShowToast('Two left \u2014 almost there');
    } else {
        _feedShowToast(remaining + ' left \u2014 keep going');
    }

    // Schedule auto-advance after rerender
    setTimeout(_feedAutoAdvance, 350);
}

function _feedAutoAdvance() {
    // Find the first remaining "I Owe" item and subtly highlight it
    var items = document.querySelectorAll('[id^="feedItem_"]');
    // Remove any previous auto-advance highlight
    var prev = document.querySelector('.feed-next-action');
    if (prev) prev.classList.remove('feed-next-action');

    if (!_feedCache) return;
    var fas = _fas();
    if (!fas) return;

    for (var i = 0; i < _feedCache.length; i++) {
        var item = _feedCache[i];
        var meta = _feedMeta[item.type + ':' + item.id] || {};
        var state = fas.getActionState(item, meta);
        if (state.needsMyInput) {
            var el = document.getElementById('feedItem_' + item.type + '_' + item.id);
            if (el) {
                el.classList.add('feed-next-action');
                // Scroll into view if off-screen
                var rect = el.getBoundingClientRect();
                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }
    }
}

// Check for completion after rerender
function _feedCheckCompletion() {
    var fas = _fas();
    if (!fas || !_feedCache) return;
    var summary = fas.computeSummary(_feedCache, _feedMeta);
    if (summary.needsMyInput === 0 && _feedSessionCompleted > 0) {
        // Save last count for new-items detection next session
        try { localStorage.setItem(_FEED_LAST_COUNT_KEY, '0'); } catch(e) {}

        // Celebration animation
        if (_feedSessionTotal > 1) {
            var banner = document.querySelector('#feedAttentionBar > div');
            if (banner) {
                banner.classList.add('feed-completion-celebrate');
                setTimeout(function() { banner.classList.remove('feed-completion-celebrate'); }, 2000);
            }
        }

        // Session summary — show once after completion
        if (_feedSessionCompleted > 1 && !document.getElementById('feedSessionSummary')) {
            var sumEl = document.createElement('div');
            sumEl.id = 'feedSessionSummary';
            sumEl.style.cssText = 'text-align:center;padding:10px;font-size:0.78em;color:var(--text-dim);animation:feedHelpIn 0.3s ease';
            sumEl.innerHTML = '<span style="color:#86efac;font-weight:700">You cleared ' + _feedSessionCompleted + ' items.</span>'
                + '<br><span style="opacity:0.7">Band is tighter because of this.</span>';
            var attn = document.getElementById('feedAttentionBar');
            if (attn) attn.parentNode.insertBefore(sumEl, attn.nextSibling);
            // Auto-fade after 8 seconds
            setTimeout(function() {
                if (sumEl.parentNode) { sumEl.style.opacity = '0'; sumEl.style.transition = 'opacity 0.5s'; setTimeout(function() { sumEl.remove(); }, 500); }
            }, 8000);
        }
    }
}

// ── Action History ──────────────────────────────────────────────────────────
// Lightweight rolling weekly count. Stored as JSON array of daily counts.
// Shape: [{ date: "2026-03-24", count: 5 }, ...]

function _feedRecordAction() {
    try {
        var raw = localStorage.getItem(_FEED_HISTORY_KEY);
        var history = raw ? JSON.parse(raw) : [];
        var today = new Date().toISOString().substring(0, 10);
        var last = history.length ? history[history.length - 1] : null;
        if (last && last.date === today) {
            last.count++;
        } else {
            history.push({ date: today, count: 1 });
        }
        // Keep only last 7 days
        var cutoff = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
        history = history.filter(function(h) { return h.date >= cutoff; });
        localStorage.setItem(_FEED_HISTORY_KEY, JSON.stringify(history));
    } catch(e) {}
}

function _feedGetWeeklyCount() {
    try {
        var raw = localStorage.getItem(_FEED_HISTORY_KEY);
        if (!raw) return 0;
        var history = JSON.parse(raw);
        var cutoff = new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10);
        return history.filter(function(h) { return h.date >= cutoff; }).reduce(function(sum, h) { return sum + h.count; }, 0);
    } catch(e) { return 0; }
}

// ── Progress Bar ────────────────────────────────────────────────────────────

function _feedRenderProgress() {
    var el = document.getElementById('feedProgressBar');
    if (!el) return;
    var fas = _fas();
    if (!fas || !_feedCache) { el.style.display = 'none'; return; }

    var summary = fas.computeSummary(_feedCache, _feedMeta);
    // Initialize session total on first render (captures starting action debt)
    if (_feedSessionTotal === 0 && summary.needsMyInput > 0) {
        _feedSessionTotal = summary.needsMyInput;
    }
    var total = _feedSessionTotal;
    if (total <= 1) { el.style.display = 'none'; return; }

    var completed = total - summary.needsMyInput;
    var pct = Math.round((completed / total) * 100);

    el.style.display = '';
    el.innerHTML = '<div style="display:flex;align-items:center;gap:8px;padding:0 2px;margin-bottom:8px">'
        + '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden">'
        + '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#6366f1,#818cf8);border-radius:2px;transition:width 0.4s ease"></div>'
        + '</div>'
        + '<span style="font-size:0.7em;font-weight:700;color:' + (pct >= 100 ? '#86efac' : 'var(--text-dim)') + ';white-space:nowrap">' + completed + '/' + total + '</span>'
        + '</div>';
}

window._feedDismissHelp = function() {
    localStorage.setItem(_FEED_HELP_KEY, '99');
    var b = document.getElementById('feedHelpBanner');
    if (b) { b.style.opacity = '0'; b.style.transition = 'opacity 0.2s'; setTimeout(function() { b.remove(); }, 250); }
};

window._feedShowHelpRecall = function() {
    // Re-show explainer without resetting visit counter
    var existing = document.getElementById('feedHelpBanner');
    if (existing) { existing.remove(); return; } // toggle off if already showing
    _feedRenderHelpBanner(true);
};

function _feedRenderOnboarding() {
    var existing = document.getElementById('feedHelpBanner');
    if (existing) existing.remove();

    var views = _feedHelpViewCount();
    if (views >= 3) return;
    localStorage.setItem(_FEED_HELP_KEY, String(views + 1));
    _feedRenderHelpBanner(false);
}

function _feedRenderHelpBanner(isRecall) {
    var el = document.getElementById('page-feed');
    if (!el) return;
    var banner = document.createElement('div');
    banner.id = 'feedHelpBanner';
    banner.style.cssText = 'padding:12px 14px;margin-bottom:8px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:10px;animation:feedHelpIn 0.3s ease';
    banner.innerHTML = '<div style="display:flex;align-items:flex-start;gap:10px">'
        + '<div style="flex:1">'
        + '<div style="font-size:0.85em;font-weight:700;color:#c7d2fe;margin-bottom:4px">This is your band\u2019s control center</div>'
        + '<div style="font-size:0.78em;color:var(--text-dim);line-height:1.6">'
        + '\uD83D\uDD25 <strong style="color:#fbbf24">I Owe</strong> \u2192 what you need to do<br>'
        + '\u23F3 <strong style="color:#a5b4fc">Waiting</strong> \u2192 what others still need to do<br>'
        + '\u2705 When this is clear, you\u2019re locked in<br>'
        + '<span style="color:var(--text-muted)">Start by completing the first item below.</span>'
        + '</div></div>'
        + '<button onclick="' + (isRecall ? '_feedShowHelpRecall()' : '_feedDismissHelp()') + '" style="flex-shrink:0;font-size:0.72em;font-weight:600;padding:3px 8px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">\u2715</button>'
        + '</div>';

    var attnBar = document.getElementById('feedAttentionBar');
    if (attnBar) attnBar.parentNode.insertBefore(banner, attnBar);
    else el.insertBefore(banner, el.firstChild);
    _injectGuidanceStyles();
}

// ── Continuity Signals ──────────────────────────────────────────────────────

function _feedRenderContinuitySignals(items) {
    var fas = _fas();
    if (!fas) return;
    var summary = fas.computeSummary(items, _feedMeta);
    var current = summary.needsMyInput;
    var lastCount = parseInt(localStorage.getItem(_FEED_LAST_COUNT_KEY) || '-1', 10);

    // New items indicator: previous session ended at 0, now there are items
    if (lastCount === 0 && current > 0) {
        _feedShowContinuityBanner(current + ' new thing' + (current > 1 ? 's' : '') + ' need' + (current === 1 ? 's' : '') + ' you');
        return;
    }

    // Occasional weekly history (show ~1 in 3 sessions, not every time)
    var weekly = _feedGetWeeklyCount();
    if (weekly >= 3 && Math.random() < 0.33) {
        _feedShowContinuityBanner('You\u2019ve completed ' + weekly + ' actions this week');
    }
}

function _feedShowContinuityBanner(text) {
    var container = document.getElementById('feedAttentionBar');
    if (!container || !container.parentNode) return;
    var existing = document.getElementById('feedContinuity');
    if (existing) existing.remove();

    var el = document.createElement('div');
    el.id = 'feedContinuity';
    el.style.cssText = 'text-align:center;padding:8px 14px;margin-bottom:6px;font-size:0.78em;font-weight:600;color:#a5b4fc;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.1);border-radius:8px;animation:feedHelpIn 0.3s ease';
    el.textContent = text;
    container.parentNode.insertBefore(el, container);
    // Auto-fade after 6 seconds
    setTimeout(function() {
        if (el.parentNode) { el.style.opacity = '0'; el.style.transition = 'opacity 0.5s'; setTimeout(function() { el.remove(); }, 500); }
    }, 6000);
}

function _injectGuidanceStyles() {
    if (document.getElementById('feedGuidanceStyles')) return;
    var s = document.createElement('style');
    s.id = 'feedGuidanceStyles';
    s.textContent = [
        '@keyframes feedHelpIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}',
        '@keyframes feedFirstPulse{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0)}50%{box-shadow:0 0 0 4px rgba(245,158,11,0.15)}}',
        '.feed-first-action{animation:feedFirstPulse 2s ease-in-out 3;border-color:rgba(245,158,11,0.3) !important}',
        '.feed-next-action{border-color:rgba(99,102,241,0.25) !important;background:rgba(99,102,241,0.03) !important;transition:border-color 0.3s,background 0.3s}',
        '@keyframes feedCelebrate{0%{transform:scale(1)}40%{transform:scale(1.015)}100%{transform:scale(1)}}',
        '.feed-completion-celebrate{animation:feedCelebrate 0.6s ease}'
    ].join('\n');
    document.head.appendChild(s);
}

// ── Create Bar ──────────────────────────────────────────────────────────────

var _FEED_CREATED_KEY = 'gl_feed_has_created';

function _feedRenderCreateBar() {
    var bar = document.getElementById('feedCreateBar');
    if (!bar) return;

    // Quick add input + full menu
    var nudge = '';
    if (!localStorage.getItem(_FEED_CREATED_KEY)) {
        nudge = '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;opacity:0.7">Have an idea? Add something for the band.</div>';
    }
    bar.innerHTML = nudge
        + '<div style="display:flex;gap:6px;margin-bottom:8px">'
        + '<input id="feedQuickAdd" type="text" placeholder="Share something with the band\u2026" onkeydown="if(event.key===\'Enter\')_feedQuickPost()" style="flex:1;font-size:0.85em;padding:10px 14px;border-radius:10px;border:1px solid rgba(99,102,241,0.15);background:rgba(0,0,0,0.12);color:var(--text);outline:none" onfocus="this.style.borderColor=\'rgba(99,102,241,0.35)\'" onblur="this.style.borderColor=\'rgba(99,102,241,0.15)\'">'
        + '<button onclick="_feedQuickPost()" title="Send" style="flex-shrink:0;font-size:0.85em;font-weight:700;padding:10px 16px;border-radius:10px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">\u2191</button>'
        + '</div>'
        + '<button onclick="_feedToggleCreateMenu()" id="feedCreateBtn" style="display:flex;align-items:center;gap:6px;width:100%;padding:7px 14px;border-radius:8px;cursor:pointer;border:1px dashed rgba(99,102,241,0.15);background:none;color:var(--text-dim);font-size:0.75em;font-weight:600;text-align:left;transition:background 0.15s" onmouseover="this.style.background=\'rgba(99,102,241,0.04)\'" onmouseout="this.style.background=\'none\'">'
        + '<span style="color:#a5b4fc">+</span> Poll, Idea, or more</button>'
        + '<div id="feedCreateMenu" style="display:none;margin-top:6px;padding:6px;background:var(--bg-card,#1e293b);border:1px solid rgba(99,102,241,0.2);border-radius:10px">'
        + '<button onclick="_feedCreateItem(\'poll\')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;color:var(--text-muted);font-size:0.82em;cursor:pointer;border-radius:6px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'none\'">\uD83D\uDDF3\uFE0F Poll / Decision</button>'
        + '<button onclick="_feedCreateItem(\'idea\')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;color:var(--text-muted);font-size:0.82em;cursor:pointer;border-radius:6px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'none\'">\uD83D\uDCA1 Idea</button>'
        + '<button onclick="_feedCreateItem(\'note\')" style="display:block;width:100%;text-align:left;padding:8px 12px;border:none;background:none;color:var(--text-muted);font-size:0.82em;cursor:pointer;border-radius:6px" onmouseover="this.style.background=\'rgba(255,255,255,0.04)\'" onmouseout="this.style.background=\'none\'">\uD83D\uDCDD Note</button>'
        + '</div>';
}

window._feedQuickPost = async function() {
    var inp = document.getElementById('feedQuickAdd');
    if (!inp) return;
    var text = inp.value.trim();
    if (!text) return;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') { _feedShowToast('Not connected'); return; }
    var fas = _fas();
    var author = fas ? (fas.getMyDisplayName() || 'Anonymous') : 'Anonymous';
    try {
        await db.ref(bandPath('ideas/posts')).push({
            title: text, author: author, ts: new Date().toISOString(), tag: 'fyi'
        });
        localStorage.setItem(_FEED_CREATED_KEY, '1');
        inp.value = '';
        if (typeof FeedMetrics !== 'undefined') FeedMetrics.trackEvent('item_created', { method: 'quick' });
        _feedShowToast('Shared with the band');
        var el = document.getElementById('page-feed');
        if (el) renderBandFeedPage(el);
    } catch(e) { _feedShowToast('Failed'); }
};

window._feedToggleCreateMenu = function() {
    var menu = document.getElementById('feedCreateMenu');
    if (menu) menu.style.display = menu.style.display === 'none' ? '' : 'none';
};

window._feedCreateItem = function(type) {
    var menu = document.getElementById('feedCreateMenu');
    if (menu) menu.style.display = 'none';

    if (type === 'poll') {
        _feedShowCreateForm('poll', '\uD83D\uDDF3\uFE0F Create a Poll', 'Question', 'Options (comma-separated)');
    } else if (type === 'idea') {
        _feedShowCreateForm('idea', '\uD83D\uDCA1 Share an Idea', 'Song title or idea', 'Link (optional)');
    } else if (type === 'note') {
        _feedShowCreateForm('note', '\uD83D\uDCDD Add a Note', 'What does the band need to know?', null);
    }
};

function _feedShowCreateForm(type, title, placeholder1, placeholder2) {
    var bar = document.getElementById('feedCreateBar');
    if (!bar) return;
    var isNote = (type === 'note');
    var html = '<div style="padding:12px 14px;background:var(--bg-card,#1e293b);border:1px solid rgba(99,102,241,0.2);border-radius:10px">'
        + '<div style="font-size:0.85em;font-weight:700;color:#c7d2fe;margin-bottom:8px">' + title + '</div>'
        + '<input id="feedCreateInput1" type="text" placeholder="' + placeholder1 + '" style="width:100%;font-size:0.82em;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none;margin-bottom:6px;box-sizing:border-box">';
    if (placeholder2) {
        html += '<input id="feedCreateInput2" type="text" placeholder="' + placeholder2 + '" style="width:100%;font-size:0.82em;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none;margin-bottom:6px;box-sizing:border-box">';
    }
    // Target selector (not for notes — notes are FYI)
    if (!isNote) {
        html += '<div style="margin-bottom:8px">'
            + '<div style="font-size:0.75em;font-weight:600;color:var(--text-dim);margin-bottom:4px">Who needs to respond?</div>'
            + '<div style="display:flex;gap:4px;margin-bottom:4px">'
            + '<button id="feedTargetAll" onclick="_feedSetTarget(\'all\')" class="feedTargetBtn feedTargetBtn--active" style="font-size:0.75em;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Everyone</button>'
            + '<button id="feedTargetSpecific" onclick="_feedSetTarget(\'specific\')" class="feedTargetBtn" style="font-size:0.75em;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Specific people</button>'
            + '</div>'
            + '<div id="feedTargetMembers" style="display:none;margin-top:4px"></div>'
            + '</div>';
    }
    html += '<div style="display:flex;gap:6px;justify-content:flex-end">'
        + '<button onclick="_feedCancelCreate()" style="font-size:0.78em;font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Cancel</button>'
        + '<button onclick="_feedSubmitCreate(\'' + type + '\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac">Post</button>'
        + '</div></div>';
    bar.innerHTML = html;
    var inp = document.getElementById('feedCreateInput1');
    if (inp) inp.focus();
}

var _feedCreateTargetType = 'all';
var _feedCreateTargetMembers = [];

window._feedSetTarget = function(type) {
    _feedCreateTargetType = type;
    // Update button styles
    var allBtn = document.getElementById('feedTargetAll');
    var specBtn = document.getElementById('feedTargetSpecific');
    if (allBtn) { allBtn.style.background = type === 'all' ? 'rgba(99,102,241,0.1)' : 'none'; allBtn.style.borderColor = type === 'all' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'; allBtn.style.color = type === 'all' ? '#a5b4fc' : 'var(--text-dim)'; }
    if (specBtn) { specBtn.style.background = type === 'specific' ? 'rgba(99,102,241,0.1)' : 'none'; specBtn.style.borderColor = type === 'specific' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'; specBtn.style.color = type === 'specific' ? '#a5b4fc' : 'var(--text-dim)'; }
    // Show/hide member list
    var membersEl = document.getElementById('feedTargetMembers');
    if (!membersEl) return;
    if (type === 'specific') {
        _feedCreateTargetMembers = [];
        var members = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var fas = _fas();
        var myKey = fas ? fas.getMyMemberKey() : null;
        var html = '';
        Object.keys(members).forEach(function(key) {
            if (key === myKey) return; // don't show self
            var m = members[key];
            html += '<label style="display:flex;align-items:center;gap:6px;padding:3px 0;cursor:pointer;font-size:0.8em;color:var(--text-muted)">'
                + '<input type="checkbox" value="' + key + '" onchange="_feedToggleTargetMember(\'' + key + '\',this.checked)" style="accent-color:#6366f1">'
                + (m.name || key) + '</label>';
        });
        membersEl.innerHTML = html;
        membersEl.style.display = '';
    } else {
        _feedCreateTargetMembers = [];
        membersEl.style.display = 'none';
    }
};

window._feedToggleTargetMember = function(key, checked) {
    if (checked && _feedCreateTargetMembers.indexOf(key) === -1) _feedCreateTargetMembers.push(key);
    else _feedCreateTargetMembers = _feedCreateTargetMembers.filter(function(k) { return k !== key; });
};

window._feedCancelCreate = function() { _feedRenderCreateBar(); };

window._feedSubmitCreate = async function(type) {
    var inp1 = document.getElementById('feedCreateInput1');
    var inp2 = document.getElementById('feedCreateInput2');
    var text = inp1 ? inp1.value.trim() : '';
    if (!text) { _feedShowToast('Enter something'); return; }

    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') { _feedShowToast('Not connected'); return; }
    var fas = _fas();
    var author = fas ? (fas.getMyDisplayName() || 'Anonymous') : 'Anonymous';

    // Build targeting payload
    var targetPayload = {};
    if (type !== 'note') {
        if (_feedCreateTargetType === 'specific' && _feedCreateTargetMembers.length > 0) {
            targetPayload = { targetType: 'specific', targetMembers: _feedCreateTargetMembers.slice() };
        } else {
            targetPayload = { targetType: 'all' };
        }
    }

    try {
        if (type === 'poll') {
            var options = inp2 ? inp2.value.split(',').map(function(o) { return o.trim(); }).filter(Boolean) : [];
            if (options.length < 2) { _feedShowToast('Add at least 2 options'); return; }
            var pollData = { question: text, options: options, votes: {}, author: author, ts: new Date().toISOString(), tag: 'needs_input' };
            Object.assign(pollData, targetPayload);
            await db.ref(bandPath('polls')).push(pollData);
        } else if (type === 'idea') {
            var link = inp2 ? inp2.value.trim() : '';
            var ideaData = { title: text, link: link, author: author, ts: new Date().toISOString(), tag: 'needs_input' };
            Object.assign(ideaData, targetPayload);
            await db.ref(bandPath('ideas/posts')).push(ideaData);
                title: text, link: link, author: author,
                ts: new Date().toISOString(), tag: 'needs_input'
            });
        } else if (type === 'note') {
            await db.ref(bandPath('ideas/posts')).push({
                title: text, author: author,
                ts: new Date().toISOString(), tag: 'fyi'
            });
        }
        localStorage.setItem(_FEED_CREATED_KEY, '1');
        if (typeof FeedMetrics !== 'undefined') FeedMetrics.trackEvent('item_created', { method: 'structured', targeted: _feedCreateTargetType === 'specific' });
        _feedShowToast('Shared with the band');
        _feedRenderCreateBar();
        // Reload feed to show new item
        var el = document.getElementById('page-feed');
        if (el) renderBandFeedPage(el);
    } catch(e) {
        _feedShowToast('Failed: ' + (e.message || 'unknown'));
    }
};

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
    el.innerHTML = '<div class="page-header" style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:12px;border-bottom:2px solid rgba(99,102,241,0.15);margin-bottom:12px">'
        + '<div><h1 style="margin:0;font-size:1.4em">\uD83D\uDCE1 Band Feed</h1>'
        + '<p style="margin:4px 0 0;font-size:0.82em;color:var(--text-dim)">What do you owe? What\u2019s waiting? What changed?</p></div>'
        + '<button onclick="_feedShowHelpRecall()" title="How this works" style="flex-shrink:0;margin-top:4px;width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim);cursor:pointer;font-size:0.82em;font-weight:700;display:flex;align-items:center;justify-content:center">?</button>'
        + '</div>'
        + '<div id="feedCreateBar" style="margin-bottom:8px"></div>'
        + '<div id="feedProgressBar" style="display:none"></div>'
        + '<div id="feedAttentionBar"></div>'
        + '<div id="feedFilterBar"></div>'
        + '<div id="feedList" style="margin-top:8px"><div style="text-align:center;padding:40px;color:var(--text-dim)">Loading feed\u2026</div></div>';
    try {
        await _feedLoadMeta();
        var items = await _feedLoadAll();
        _feedCache = items;
    } catch(loadErr) {
        console.warn('[Feed] Data load failed:', loadErr);
        _feedCache = [];
        var items = [];
    }
    _feedSessionTotal = 0;
    _feedSessionCompleted = 0;
    if (typeof FeedMetrics !== 'undefined') FeedMetrics.trackEvent('feed_visit');
    _feedRenderCreateBar();
    _feedRenderOnboarding();
    _feedRenderAttentionBar(items);
    _feedRenderProgress();
    _feedRenderContinuitySignals(items);
    _feedRenderFilterBar(items);
    _feedRender(items);
    _feedSyncNavBadge();

    // Save current count for next-session new-items detection
    var fas2 = _fas();
    if (fas2) {
        var s2 = fas2.computeSummary(items, _feedMeta);
        try { localStorage.setItem(_FEED_LAST_COUNT_KEY, String(s2.needsMyInput)); } catch(e) {}
    }

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
        var acHtml = '<div style="padding:16px 18px;background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(16,185,129,0.04));border:1px solid rgba(34,197,94,0.2);border-radius:12px;margin-bottom:10px;display:flex;align-items:center;gap:14px">'
            + '<div style="width:40px;height:40px;border-radius:50%;background:rgba(34,197,94,0.15);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:1.3em">\u2705</span></div>'
            + '<div><div style="font-size:0.92em;font-weight:800;color:#86efac">You\u2019re locked in.</div>'
            + '<div style="font-size:0.78em;color:#6ee7b7;margin-top:2px">The band is tighter because you showed up.</div>';
        if (summary.waitingOnBand > 0) {
            acHtml += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px;opacity:0.7">Waiting on band: ' + summary.waitingOnBand + ' item' + (summary.waitingOnBand > 1 ? 's' : '') + '</div>';
        }
        acHtml += '</div></div>';
        bar.innerHTML = acHtml;
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

// ── Inline Poll Voting ──────────────────────────────────────────────────────

window._feedVotePoll = async function(pollKey, optionIdx) {
    var fas = _fas();
    if (!fas) return;
    var result = await fas.voteOnPoll(pollKey, optionIdx);
    if (!result.ok) {
        _feedShowToast('Vote failed: ' + (result.reason || 'unknown'));
        return;
    }
    // Update local cache immediately
    var item = _feedFindItem('poll', pollKey);
    if (item) {
        item.iVoted = true;
        if (!item.pollVotes) item.pollVotes = {};
        item.pollVotes[result.voteKey] = optionIdx;
        // Recount
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
        var voteCount = Object.keys(item.pollVotes).length;
        item.resolved = voteCount >= memberCount;
        var remaining = memberCount - voteCount;
        var ctx = ['You voted'];
        ctx.push(item.resolved ? (voteCount + '/' + memberCount + ' voted \u2705') : (remaining + ' of ' + memberCount + ' still need to vote'));
        item.context = ctx.join(' \u00B7 ');
    }
    _feedShowToast('Vote recorded');
    _feedAdvanceOnboarding();
    _feedRerender();
    // Also refresh left rail badge
    if (typeof _updateBandRoomBadge === 'function') setTimeout(_updateBandRoomBadge, 500);
};

// ── Inline Idea Acknowledgment ───────────────────────────────────────────────

window._feedAcknowledgeIdea = async function(id) {
    var item = _feedFindItem('idea', id);
    if (!item) return;
    // Save acknowledgment as a note + mark resolved via meta
    var fas = _fas();
    var by = fas ? (fas.getMyDisplayName() || 'Me') : 'Me';
    var notes = _feedGetNotes(item).slice();
    notes.push({ text: 'Acknowledged', by: by, ts: new Date().toISOString() });
    await _feedSaveMeta(item, { notes: notes, resolved: true });
    item.resolved = true;
    _feedShowToast('Acknowledged');
    _feedAdvanceOnboarding();
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
    _feedRenderProgress();
    _feedRenderFilterBar(_feedCache);
    _feedRender(_feedCache);
    _feedSyncNavBadge();
    _feedCheckCompletion();
}

function _feedSyncNavBadge() {
    var fas = _fas();
    if (!fas || !_feedCache) return;
    var summary = fas.computeSummary(_feedCache, _feedMeta);
    fas.setActionCount(summary.needsMyInput);
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
                    targetType: v.targetType || 'all',
                    targetMembers: v.targetMembers || [],
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
                    pollOptions: v.options || [],
                    pollVotes: v.votes || {},
                    targetType: v.targetType || 'all',
                    targetMembers: v.targetMembers || [],
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
        await _feedLoadNextEvents(db);
    } catch(e) {
        console.warn('[Feed] Load error:', e.message);
    }

    // Sort by priority (action urgency + time proximity)
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

// ── Load next event dates for urgency ────────────────────────────────────────

async function _feedLoadNextEvents(db) {
    var fas = _fas();
    if (!fas) return;
    var today = new Date().toISOString().split('T')[0];
    var nextRehearsal = null, nextGig = null;
    try {
        // Gigs
        var gigsData = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive('_band', 'gigs') : null;
        if (gigsData) {
            var gigs = (Array.isArray(gigsData) ? gigsData : Object.values(gigsData))
                .filter(function(g) { return g && (g.date || '') >= today; })
                .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
            if (gigs.length) nextGig = gigs[0].date;
        }
        // Calendar events for next rehearsal
        var calData = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive('_band', 'calendar_events') : null;
        if (calData) {
            var rehearsals = (Array.isArray(calData) ? calData : Object.values(calData))
                .filter(function(e) { return e && e.type === 'rehearsal' && (e.date || '') >= today; })
                .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });
            if (rehearsals.length) nextRehearsal = rehearsals[0].date;
        }
    } catch(e) {}
    fas.setNextEvents({ rehearsal: nextRehearsal, gig: nextGig });
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
            var highlightFirst = !localStorage.getItem(_FEED_HIGHLIGHT_KEY);
            groups.myInput.forEach(function(item, idx) { html += _feedRenderItem(item, idx === 0 && highlightFirst); });
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

    if (!html) {
        html = '<div style="text-align:center;padding:48px 20px">'
            + '<div style="font-size:1.6em;margin-bottom:8px">\u2705</div>'
            + '<div style="font-size:1em;font-weight:800;color:#86efac;margin-bottom:4px">You\u2019re locked in</div>'
            + '<div style="font-size:0.82em;color:#6ee7b7;margin-bottom:4px">Nothing blocking rehearsal.</div>'
            + '<div style="font-size:0.75em;color:var(--text-dim);margin-bottom:16px">The band is tighter because you showed up.</div>'
            + '<button onclick="_feedCreateItem(\'note\')" style="font-size:0.82em;font-weight:700;padding:10px 22px;border-radius:10px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">+ Add something for the band</button>'
            + '</div>';
    }
    el.innerHTML = html;
}

function _feedRenderItem(item, isFirstAction) {
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

    var highlightClass = isFirstAction ? ' feed-first-action' : '';
    var html = '<div id="feedItem_' + safeType + '_' + safeId + '" class="' + highlightClass + '" style="' + cardStyle + '">';

    // Micro-guidance on first action item
    if (isFirstAction) {
        html += '<div id="feedMicroGuide" style="font-size:0.68em;font-weight:600;color:#fbbf24;margin-bottom:6px;opacity:0.8">\u2192 Tap to complete this</div>';
    }

    // Header
    html += '<div' + clickAttr + ' style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;cursor:pointer">'
        + '<span style="font-size:1em">' + typeIcon + '</span>'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + _feedEsc(item.author) + '</span>'
        + contextStr + badgeHtml + _feedRenderUrgencyTag(state)
        + '<span style="margin-left:auto;font-size:0.68em;color:var(--text-dim);flex-shrink:0">' + timeStr + '</span>'
        + '</div>';

    // Body
    html += '<div' + clickAttr + ' style="font-size:0.88em;color:var(--text-muted);line-height:1.5;cursor:pointer">' + _feedEsc(item.text) + '</div>';

    if (item.link) html += '<a href="' + _feedEsc(item.link) + '" target="_blank" rel="noopener" style="font-size:0.75em;color:var(--accent-light);margin-top:4px;display:inline-block">\uD83D\uDD17 Link</a>';

    // Target indicator for specifically-targeted items
    if (item.targetType === 'specific' && item.targetMembers && item.targetMembers.length) {
        var members = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var targetNames = item.targetMembers.map(function(k) { return members[k] ? members[k].name : k; });
        var tLabel = targetNames.length <= 3 ? targetNames.join(', ') : targetNames.slice(0, 2).join(', ') + ' +' + (targetNames.length - 2) + ' more';
        html += '<div style="font-size:0.72em;color:#a5b4fc;margin-top:4px;opacity:0.8">For: ' + _feedEsc(tLabel) + '</div>';
    }

    // "Waiting on" indicator for polls where I voted but others haven't
    if (item.type === 'poll' && state && state.waitingOnOthers && fas) {
        var waiting = fas.getWaitingMembers(item);
        if (waiting.length > 0) {
            var names = waiting.length <= 3 ? waiting.join(', ') : waiting.slice(0, 2).join(', ') + ' +' + (waiting.length - 2) + ' more';
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px;opacity:0.7">Waiting on: ' + _feedEsc(names) + '</div>';
        }
    }

    // Inline poll voting — show options when I haven't voted yet
    if (item.type === 'poll' && state && state.needsMyInput && item.pollOptions && item.pollOptions.length) {
        html += '<div style="margin-top:8px" onclick="event.stopPropagation()">';
        item.pollOptions.forEach(function(opt, idx) {
            var voteCount = 0;
            if (item.pollVotes) Object.values(item.pollVotes).forEach(function(v) { if (v === idx) voteCount++; });
            html += '<button onclick="_feedVotePoll(\'' + _feedEsc(item.id) + '\',' + idx + ')" '
                + 'style="display:flex;align-items:center;gap:8px;width:100%;padding:6px 10px;margin-bottom:4px;border-radius:6px;cursor:pointer;'
                + 'background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);text-align:left;transition:background 0.15s" '
                + 'onmouseover="this.style.background=\'rgba(99,102,241,0.08)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.02)\'">'
                + '<span style="flex:1;font-size:0.82em;color:var(--text-muted)">' + _feedEsc(opt) + '</span>'
                + '<span style="font-size:0.72em;font-weight:700;color:var(--text-dim)">' + voteCount + '</span>'
                + '</button>';
        });
        html += '</div>';
    }

    // Inline idea acknowledgment — simple "Got it" for ideas needing my input
    if (item.type === 'idea' && state && state.needsMyInput) {
        html += '<div style="margin-top:8px" onclick="event.stopPropagation()">'
            + '<button onclick="_feedAcknowledgeIdea(\'' + safeId + '\')" '
            + 'style="font-size:0.78em;font-weight:700;padding:6px 16px;border-radius:6px;cursor:pointer;'
            + 'border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac;transition:background 0.15s" '
            + 'onmouseover="this.style.background=\'rgba(34,197,94,0.15)\'" onmouseout="this.style.background=\'rgba(34,197,94,0.08)\'">'
            + '\u2713 Got it</button></div>';
    }

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

function _feedRenderUrgencyTag(state) {
    if (!state || !state.urgency) return '';
    var u = state.urgency;
    var color = u.tone === 'red' ? '#f87171' : '#fbbf24';
    var bg = u.tone === 'red' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';
    var border = u.tone === 'red' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)';
    return '<span style="font-size:0.6em;font-weight:700;padding:1px 5px;border-radius:3px;background:' + bg + ';color:' + color + ';border:1px solid ' + border + '">\u23F0 ' + u.text + '</span>';
}

function _feedEsc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ── Register ────────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.feed = function(el) {
        // Render header immediately (sync) so page is never blank
        el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCE1 Band Feed</h1><p style="color:var(--text-dim)">Loading\u2026</p></div>';
        renderBandFeedPage(el).catch(function(err) {
            console.error('[Feed] Render failed:', err);
            el.innerHTML = '<div class="page-header"><h1>\uD83D\uDCE1 Band Feed</h1></div>'
                + '<div style="text-align:center;padding:40px;color:var(--text-dim)">Could not load feed. <button onclick="showPage(\'feed\')" style="color:#a5b4fc;background:none;border:none;cursor:pointer;font-weight:700">Retry</button></div>';
        });
    };
}

// ── Background badge refresh (runs on app startup, not just feed page) ──────
// Lightweight: loads only polls (the primary action-required source) to update
// the nav badge without loading the full feed.
(function _feedBgBadgeRefresh() {
    function refresh() {
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!fas || !db || typeof bandPath !== 'function') return;
        var myVoteKey = fas.getMyVoteKey();
        if (!myVoteKey) return;
        db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value').then(function(snap) {
            var polls = snap.val();
            if (!polls) { fas.setActionCount(0); return; }
            var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
            var count = 0;
            Object.values(polls).forEach(function(p) {
                if (!p || !p.ts) return;
                var voteCount = p.votes ? Object.keys(p.votes).length : 0;
                var allVoted = voteCount >= memberCount;
                if (allVoted) return;
                var iVoted = !!(p.votes && p.votes[myVoteKey] !== undefined);
                if (!iVoted) count++;
            });
            fas.setActionCount(count);
        }).catch(function() {});
    }
    // Run after Firebase is likely ready
    setTimeout(refresh, 4000);
    // Periodic refresh every 2 minutes
    setInterval(refresh, 120000);
})();

// ── Real-time notification listener ──────────────────────────────────────────
// Watches for new polls/ideas and fires local notifications when backgrounded.

(function _feedRealtimeNotifs() {
    function setup() {
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!fas || !db || typeof bandPath !== 'function') return;
        if (!fas.isPushEnabled()) return;
        var myVoteKey = fas.getMyVoteKey();
        if (!myVoteKey) return;

        db.ref(bandPath('polls')).orderByChild('ts').limitToLast(1).on('child_added', function(snap) {
            var p = snap.val();
            if (!p || !p.ts) return;
            if (Date.now() - new Date(p.ts).getTime() > 60000) return; // ignore old
            if (p.votes && p.votes[myVoteKey] !== undefined) return;
            if (fas.isMe(p.author)) return;
            fas.fireLocalNotification('Band needs your input',
                (p.question || 'New poll').substring(0, 80),
                { itemType: 'poll', itemId: snap.key, notifClass: 'action_required' });
        });

        db.ref(bandPath('ideas/posts')).orderByChild('ts').limitToLast(1).on('child_added', function(snap) {
            var p = snap.val();
            if (!p || !p.ts) return;
            if (Date.now() - new Date(p.ts).getTime() > 60000) return;
            if (fas.isMe(p.author)) return;
            if (p.tag !== 'needs_input' && p.tag !== 'mission_critical') return;
            fas.fireLocalNotification('New idea shared',
                (p.title || 'Band idea').substring(0, 80),
                { itemType: 'idea', itemId: snap.key, notifClass: 'action_required' });
        });
    }
    setTimeout(setup, 6000);
})();

// ── Notification tap handler ────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'GL_NOTIF_TAP') {
            showPage('feed');
            setTimeout(function() {
                var el = document.getElementById('feedItem_' + event.data.itemType + '_' + event.data.itemId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('feed-next-action');
                    setTimeout(function() { el.classList.remove('feed-next-action'); }, 3000);
                }
            }, 1500);
        }
    });
}

console.log('\uD83D\uDCE1 band-feed.js v5 loaded \u2014 unified action engine');
