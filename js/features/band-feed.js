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
    // Momentum reinforcement on 3rd action in a session
    if (_feedSessionCompleted === 3) _feedMicroReinforce('momentum');
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
        _feedMicroReinforce('all_clear');

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
    // Run the guided walkthrough instead of static banner
    if (typeof glSpotlight !== 'undefined') {
        _feedRunWalkthrough();
        return;
    }
    // Fallback: static banner
    var existing = document.getElementById('feedHelpBanner');
    if (existing) { existing.remove(); return; }
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
        + '\uD83D\uDD25 <strong style="color:#fbbf24">Needs You</strong> \u2192 jump in and respond<br>'
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
    el.style.cssText = 'text-align:center;padding:8px 14px;margin-bottom:6px;font-size:0.78em;font-weight:600;color:var(--gl-indigo);background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.1);border-radius:8px;animation:feedHelpIn 0.3s ease';
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

    // Messaging-style creation — feels like typing to your band
    bar.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid rgba(99,102,241,0.12);border-radius:12px;padding:10px 12px">'
        + '<div style="display:flex;gap:6px;margin-bottom:8px">'
        + '<input id="feedQuickAdd" type="text" placeholder="Share something with the band\u2026" onkeydown="if(event.key===\'Enter\')_feedQuickPost()" style="flex:1;font-size:0.88em;padding:10px 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.15);color:var(--text);outline:none" onfocus="this.style.borderColor=\'rgba(99,102,241,0.3)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.08)\'">'
        + '<button onclick="_feedQuickPost()" title="Send" style="flex-shrink:0;width:40px;height:40px;border-radius:50%;cursor:pointer;border:none;background:rgba(99,102,241,0.15);color:#a5b4fc;font-size:1em;font-weight:700;display:flex;align-items:center;justify-content:center">\u2191</button>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
        + '<button onclick="_feedCreateItem(\'note\')" style="flex:1;padding:6px;border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-align:center;min-width:60px">\uD83D\uDCDD Note</button>'
        + '<button onclick="_feedCreateItem(\'link\')" style="flex:1;padding:6px;border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-align:center;min-width:60px">\uD83D\uDD17 Link</button>'
        + '<button onclick="_feedCreateItem(\'photo\')" style="flex:1;padding:6px;border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-align:center;min-width:60px">\uD83D\uDCF7 Photo</button>'
        + '<button onclick="_feedCreateItem(\'idea\')" style="flex:1;padding:6px;border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-align:center;min-width:60px">\uD83D\uDCA1 Idea</button>'
        + '<button onclick="_feedCreateItem(\'poll\')" style="flex:1;padding:6px;border-radius:8px;cursor:pointer;font-size:0.72em;font-weight:600;border:1px solid rgba(255,255,255,0.06);background:none;color:var(--text-dim);text-align:center;min-width:60px">\uD83D\uDDF3\uFE0F Poll</button>'
        + '</div>'
        + '</div>';
    // Wire @mention autocomplete after DOM update
    setTimeout(function() { _feedPendingMentions = []; _feedWireMentionInput('feedQuickAdd'); }, 50);
}

// ── @Mention system for Band Feed ────────────────────────────────────────────
var _feedPendingMentions = [];

function _feedWireMentionInput(inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    if (!members.length && typeof bandMembers !== 'undefined') {
        Object.keys(bandMembers).forEach(function(k) { members.push({ key: k, name: bandMembers[k].name || k, emoji: bandMembers[k].emoji || '' }); });
    }
    // Group mentions
    var groups = [
        { key: '_all', name: 'everyone', display: '@all' },
        { key: '_band', name: 'the whole band', display: '@band' }
    ];
    // Role mentions from band members
    var roles = {};
    if (typeof bandMembers !== 'undefined') {
        Object.keys(bandMembers).forEach(function(k) {
            var role = bandMembers[k].role || bandMembers[k].instrument || '';
            if (role && !roles[role.toLowerCase()]) roles[role.toLowerCase()] = [];
            if (role) roles[role.toLowerCase()].push(k);
        });
    }
    Object.keys(roles).forEach(function(r) {
        groups.push({ key: '_role_' + r, name: r, display: '@' + r, memberKeys: roles[r] });
    });

    input.addEventListener('input', function() {
        var val = input.value;
        var cursorPos = input.selectionStart || val.length;
        var textBefore = val.substring(0, cursorPos);
        var match = textBefore.match(/@(\w*)$/);
        var ddId = 'feedMentionDD_' + inputId;
        var existing = document.getElementById(ddId);

        if (!match) { if (existing) existing.remove(); return; }
        var partial = match[1].toLowerCase();

        // Filter members + groups
        var results = [];
        groups.forEach(function(g) {
            if (g.name.indexOf(partial) === 0 || g.display.substring(1).indexOf(partial) === 0) results.push({ type: 'group', key: g.key, name: g.display, sub: g.name, memberKeys: g.memberKeys });
        });
        members.forEach(function(m) {
            var firstName = (m.name || m.key || '').split(' ')[0].toLowerCase();
            if (firstName.indexOf(partial) === 0 || (m.key || '').toLowerCase().indexOf(partial) === 0) {
                results.push({ type: 'member', key: m.key, name: '@' + (m.name || m.key).split(' ')[0], sub: m.name || m.key, emoji: m.emoji || '' });
            }
        });
        if (!results.length) { if (existing) existing.remove(); return; }

        if (!existing) {
            existing = document.createElement('div');
            existing.id = ddId;
            existing.style.cssText = 'position:absolute;bottom:100%;left:0;right:0;background:#1e293b;border:1px solid rgba(99,102,241,0.25);border-radius:8px;z-index:100;max-height:180px;overflow-y:auto;margin-bottom:4px;box-shadow:0 4px 16px rgba(0,0,0,0.3)';
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(existing);
        }
        existing.innerHTML = results.map(function(r, i) {
            var icon = r.type === 'group' ? '\uD83D\uDC65' : (r.emoji || '\uD83C\uDFA4');
            return '<div data-idx="' + i + '" style="padding:6px 10px;cursor:pointer;font-size:0.82em;display:flex;align-items:center;gap:6px;color:var(--text);transition:background 0.1s" '
                + 'onmouseenter="this.style.background=\'rgba(99,102,241,0.15)\'" onmouseleave="this.style.background=\'none\'">'
                + '<span>' + icon + '</span><span style="font-weight:600;color:#a5b4fc">' + r.name + '</span>'
                + '<span style="font-size:0.75em;color:var(--text-dim)">' + r.sub + '</span></div>';
        }).join('');

        existing.querySelectorAll('[data-idx]').forEach(function(item) {
            item.addEventListener('mousedown', function(e) {
                e.preventDefault();
                var idx = parseInt(item.dataset.idx);
                var r = results[idx];
                var insertText = r.name;
                var beforeAt = textBefore.substring(0, match.index);
                var afterCursor = val.substring(cursorPos);
                input.value = beforeAt + insertText + ' ' + afterCursor;
                input.focus();
                var newPos = (beforeAt + insertText + ' ').length;
                input.setSelectionRange(newPos, newPos);
                // Store mention
                if (r.type === 'group') {
                    if (r.key === '_all' || r.key === '_band') {
                        _feedPendingMentions.push({ type: 'group', key: r.key, display: r.name });
                    } else if (r.memberKeys) {
                        r.memberKeys.forEach(function(mk) { _feedPendingMentions.push({ type: 'member', key: mk, display: r.name }); });
                    }
                } else {
                    _feedPendingMentions.push({ type: 'member', key: r.key, display: r.name });
                }
                existing.remove();
                _feedUpdateComposerPreview(inputId);
            });
        });
    });
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') { var dd = document.getElementById('feedMentionDD_' + inputId); if (dd) dd.remove(); }
    });
}

// Parse mentions from text and return { mentions[], targetMembers[], targetType }
function _feedParseMentions() {
    var mentions = _feedPendingMentions.slice();
    _feedPendingMentions = [];
    if (!mentions.length) return { mentions: [], targetMembers: [], targetType: null };

    var isAll = mentions.some(function(m) { return m.key === '_all' || m.key === '_band'; });
    if (isAll) return { mentions: mentions, targetMembers: [], targetType: 'all' };

    var memberKeys = [];
    mentions.forEach(function(m) {
        if (m.type === 'member' && memberKeys.indexOf(m.key) === -1) memberKeys.push(m.key);
    });
    return { mentions: mentions, targetMembers: memberKeys, targetType: memberKeys.length ? 'specific' : null };
}

// Render mentions highlighted in text — clickable, filtered
function _feedRenderMentions(text) {
    if (!text) return '';
    return text.replace(/@(\w+)/g, function(match, name) {
        return '<span onclick="event.stopPropagation();_feedFilterByMention(\'' + name + '\')" style="color:#a5b4fc;font-weight:600;cursor:pointer;border-radius:3px;transition:background 0.1s" onmouseover="this.style.background=\'rgba(99,102,241,0.1)\'" onmouseout="this.style.background=\'none\'">@' + name + '</span>';
    });
}

// Filter feed to show items assigned to a specific person
window._feedMentionFilterKey = null;

window._feedFilterByMention = function(name) {
    var members = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var targetKey = null;
    Object.keys(members).forEach(function(k) {
        if ((members[k].name || '').split(' ')[0].toLowerCase() === name.toLowerCase()) targetKey = k;
    });
    if (!targetKey) return;
    // Toggle: if already filtering by this person, clear it
    if (window._feedMentionFilterKey === targetKey) {
        window._feedMentionFilterKey = null;
        if (typeof showToast === 'function') showToast('Filter cleared');
    } else {
        window._feedMentionFilterKey = targetKey;
        if (typeof showToast === 'function') showToast('Showing items for @' + name);
    }
    _feedRerender();
};

// Build assignment chip — standardized "Assigned to" label
function _feedBuildAssignmentChip(item) {
    if (!item.mentions || !item.mentions.length) return '';
    var labels = [];
    item.mentions.forEach(function(m) {
        if (m.key === '_all' || m.key === '_band') { labels = ['Band']; return; }
        if (m.key && m.key.indexOf('_role_') === 0) { labels.push(m.display ? m.display.replace('@', '') : m.key.replace('_role_', '')); return; }
        if (m.display) labels.push(m.display.replace('@', ''));
    });
    if (!labels.length) return '';
    var unique = [];
    labels.forEach(function(l) { if (unique.indexOf(l) === -1) unique.push(l); });
    var label = unique.length <= 2 ? unique.join(', ') : unique[0] + ' +' + (unique.length - 1);
    return '<span style="font-size:0.65em;font-weight:600;color:#a5b4fc;margin-left:6px;display:inline-flex;align-items:center;gap:3px">'
        + '<span style="opacity:0.6">Assigned to</span> ' + label + '</span>';
}

// Composer targeting preview — shows who will be notified
function _feedUpdateComposerPreview(inputId) {
    var previewId = 'feedMentionPreview_' + inputId;
    var existing = document.getElementById(previewId);
    if (!_feedPendingMentions.length) {
        if (existing) existing.remove();
        return;
    }
    var isAll = _feedPendingMentions.some(function(m) { return m.key === '_all' || m.key === '_band'; });
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var text = '';
    if (isAll) {
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : Object.keys(bm).length;
        text = '\uD83D\uDCE2 Will notify: Entire band (' + memberCount + ')';
    } else {
        var parts = [];
        var seen = {};
        _feedPendingMentions.forEach(function(m) {
            if (seen[m.key]) return;
            seen[m.key] = true;
            var n = m.display ? m.display.replace('@', '') : m.key;
            // Add role context if available
            if (m.type === 'member' && bm[m.key]) {
                var role = bm[m.key].role || bm[m.key].instrument || '';
                if (role) n += ' (' + role + ')';
            }
            if (m.key && m.key.indexOf('_role_') === 0) {
                var roleMembers = m.memberKeys ? m.memberKeys.length : '?';
                n += ' (' + roleMembers + ')';
            }
            parts.push(n);
        });
        text = '\uD83D\uDD14 Will notify: ' + parts.join(', ');
    }

    if (!existing) {
        existing = document.createElement('div');
        existing.id = previewId;
        existing.style.cssText = 'font-size:0.72em;color:#a5b4fc;padding:4px 0';
        var inp = document.getElementById(inputId);
        if (inp && inp.parentElement) inp.parentElement.appendChild(existing);
    }
    existing.textContent = text;
    existing.style.color = '#a5b4fc';

    // Group mention guardrail
    if (isAll) {
        existing.style.color = '#fbbf24';
        existing.textContent = '\u26A0\uFE0F Will notify entire band (' + (typeof BAND_MEMBERS_ORDERED !== 'undefined' ? BAND_MEMBERS_ORDERED.length : Object.keys(bm).length) + ' members) \u2014 are you sure?';
    }
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

    // Extract mentions
    var mentionData = _feedParseMentions();
    var tag = mentionData.targetMembers.length > 0 ? 'needs_input' : 'fyi';
    var payload = { title: text, author: author, ts: new Date().toISOString(), tag: tag };
    if (mentionData.mentions.length) payload.mentions = mentionData.mentions;
    if (mentionData.targetType === 'specific') {
        payload.targetType = 'specific';
        payload.targetMembers = mentionData.targetMembers;
    } else if (mentionData.targetType === 'all') {
        payload.targetType = 'all';
        payload.tag = 'needs_input';
    }

    try {
        await db.ref(bandPath('ideas/posts')).push(payload);
        var wasFirst = !localStorage.getItem(_FEED_CREATED_KEY);
        localStorage.setItem(_FEED_CREATED_KEY, '1');
        inp.value = '';
        if (typeof FeedMetrics !== 'undefined') FeedMetrics.trackEvent('item_created', { method: 'quick' });
        if (wasFirst && !localStorage.getItem('gl_feed_reinforce_first_post')) {
            _feedMicroReinforce('first_post');
        } else {
            _feedShowToast('Shared with the band');
        }
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
    } else if (type === 'link') {
        _feedShowCreateForm('link', '\uD83D\uDD17 Share a Link', 'Title or description', 'URL');
    } else if (type === 'photo') {
        _feedShowPhotoForm();
    }
};

function _feedShowPhotoForm() {
    var bar = document.getElementById('feedCreateBar');
    if (!bar) return;
    bar.innerHTML = '<div style="padding:12px 14px;background:var(--bg-card,#1e293b);border:1px solid rgba(99,102,241,0.2);border-radius:10px">'
        + '<div style="font-size:0.85em;font-weight:700;color:#c7d2fe;margin-bottom:8px">\uD83D\uDCF7 Share a Photo</div>'
        + '<input id="feedCreateInput1" type="text" placeholder="Caption (optional)" style="width:100%;font-size:0.82em;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none;margin-bottom:6px;box-sizing:border-box">'
        + '<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">'
        +   '<button onclick="document.getElementById(\'feedPhotoFileInput\').click()" style="flex:1;padding:10px;border-radius:6px;border:1px dashed rgba(99,102,241,0.4);background:rgba(99,102,241,0.05);color:#a5b4fc;font-weight:600;font-size:0.82em;cursor:pointer;text-align:center">\uD83D\uDCE4 Upload Photo</button>'
        +   '<span style="font-size:0.72em;color:var(--text-dim)">or</span>'
        +   '<input id="feedCreateInput2" type="text" placeholder="Paste image URL" style="flex:2;font-size:0.82em;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none;box-sizing:border-box">'
        + '</div>'
        + '<input id="feedPhotoFileInput" type="file" accept="image/*" onchange="_feedPhotoFileSelected(this)" style="display:none">'
        + '<div id="feedPhotoPreview" style="display:none;margin-bottom:8px;text-align:center"></div>'
        + '<div style="margin-bottom:8px">'
        +   '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:4px">Who needs to respond?</div>'
        +   '<div style="display:flex;gap:4px">'
        +     '<button id="feedTargetAll" onclick="_feedSetTarget(\'all\')" class="feedTargetBtn feedTargetBtn--active" style="font-size:0.75em;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Everyone</button>'
        +     '<button id="feedTargetSpecific" onclick="_feedSetTarget(\'specific\')" class="feedTargetBtn" style="font-size:0.75em;font-weight:600;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Specific people</button>'
        +   '</div>'
        +   '<div id="feedTargetMembers" style="display:none;margin-top:4px"></div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;justify-content:flex-end">'
        +   '<button onclick="_feedCancelCreate()" style="font-size:0.78em;font-weight:600;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Cancel</button>'
        +   '<button onclick="_feedSubmitCreate(\'photo\')" style="font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.1);color:#86efac">Post</button>'
        + '</div></div>';
    var inp = document.getElementById('feedCreateInput1');
    if (inp) inp.focus();
}

window._feedPhotoUploadUrl = null;

window._feedPhotoFileSelected = function(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];
    if (file.size > 10 * 1024 * 1024) { _feedShowToast('Max 10MB'); return; }

    // Show preview
    var preview = document.getElementById('feedPhotoPreview');
    if (preview) {
        var reader = new FileReader();
        reader.onload = function(e) {
            preview.style.display = 'block';
            preview.innerHTML = '<img src="' + e.target.result + '" style="max-width:100%;max-height:200px;border-radius:8px;border:1px solid rgba(255,255,255,0.1)">'
                + '<div style="font-size:0.72em;color:#86efac;margin-top:4px">\u2713 ' + file.name + ' (' + Math.round(file.size/1024) + 'KB)</div>';
        };
        reader.readAsDataURL(file);
    }

    // Upload to Firebase Storage
    if (typeof firebaseStorage === 'undefined' || !firebaseStorage) {
        _feedShowToast('Storage not ready — try pasting a URL instead');
        return;
    }
    var safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    var path = bandPath('feed_photos/' + Date.now() + '_' + safeName);
    var ref = firebaseStorage.ref(path);
    var task = ref.put(file);

    if (preview) {
        preview.innerHTML += '<div id="feedPhotoProgress" style="font-size:0.72em;color:#818cf8;margin-top:2px">Uploading...</div>';
    }

    task.on('state_changed',
        function(snapshot) {
            var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            var prog = document.getElementById('feedPhotoProgress');
            if (prog) prog.textContent = 'Uploading... ' + pct + '%';
        },
        function(error) {
            _feedShowToast('Upload failed: ' + error.message);
            var prog = document.getElementById('feedPhotoProgress');
            if (prog) prog.textContent = 'Upload failed';
        },
        function() {
            task.snapshot.ref.getDownloadURL().then(function(url) {
                window._feedPhotoUploadUrl = url;
                var prog = document.getElementById('feedPhotoProgress');
                if (prog) { prog.textContent = '\u2713 Uploaded'; prog.style.color = '#86efac'; }
                // Also set the URL input so submit picks it up
                var inp2 = document.getElementById('feedCreateInput2');
                if (inp2) inp2.value = url;
            });
        }
    );
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
            + '<div style="font-size:0.78em;font-weight:700;color:var(--text-muted);margin-bottom:4px">Who needs to respond?</div>'
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
    _feedPendingMentions = [];
    var inp = document.getElementById('feedCreateInput1');
    if (inp) { inp.focus(); setTimeout(function() { _feedWireMentionInput('feedCreateInput1'); }, 50); }
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

    // Build targeting payload — mentions override manual targeting
    var mentionData = _feedParseMentions();
    var targetPayload = {};
    if (mentionData.targetMembers.length > 0) {
        targetPayload = { targetType: 'specific', targetMembers: mentionData.targetMembers, mentions: mentionData.mentions, tag: 'needs_input' };
    } else if (mentionData.targetType === 'all') {
        targetPayload = { targetType: 'all', mentions: mentionData.mentions, tag: 'needs_input' };
    } else if (type !== 'note') {
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
        } else if (type === 'note') {
            await db.ref(bandPath('ideas/posts')).push({
                title: text, author: author,
                ts: new Date().toISOString(), tag: 'fyi', post_type: 'note'
            });
        } else if (type === 'link') {
            var linkUrl = inp2 ? inp2.value.trim() : '';
            if (!linkUrl) { _feedShowToast('Add a URL'); return; }
            var linkData = { title: text || linkUrl, link: linkUrl, author: author, ts: new Date().toISOString(), tag: 'fyi', post_type: 'link' };
            Object.assign(linkData, targetPayload);
            await db.ref(bandPath('ideas/posts')).push(linkData);
        } else if (type === 'photo') {
            var photoUrl = inp2 ? inp2.value.trim() : '';
            if (!photoUrl) { _feedShowToast('Add a photo URL'); return; }
            var photoData = { title: text || 'Photo', photo_url: photoUrl, author: author, ts: new Date().toISOString(), tag: 'fyi', post_type: 'photo' };
            Object.assign(photoData, targetPayload);
            await db.ref(bandPath('ideas/posts')).push(photoData);
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
    el.innerHTML = '<div class="gl-page">'
        + '<div class="gl-page-title">\uD83D\uDCE1 Band Feed</div>'
        + '<div class="gl-page-sub">What\u2019s waiting. What changed.</div>'
        + '<div class="gl-page-split">'
        + '<div class="gl-page-primary">'
        + '<div id="feedCreateBar" style="margin-bottom:8px"></div>'
        + '<div id="feedAttentionBar"></div>'
        + '<div id="feedList"><div style="text-align:center;padding:40px;color:var(--text-dim)">Loading feed\u2026</div></div>'
        + '</div>'
        + '<div class="gl-page-context">'
        + '<div id="feedFilterBar"></div>'
        + '<div id="feedProgressBar" style="display:none"></div>'
        + '</div>'
        + '</div></div>';
    try {
        await _feedLoadMeta();
        var items = await _feedLoadAll();
        _feedCache = items;
        // Auto-resolve: persist resolved state for fully-voted polls and converted ideas
        _feedAutoResolve(items);
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

    // Deep link: ?item=poll:abc123 → scroll to + highlight
    _feedHandleDeepLink();

    // Trigger walkthrough on first visit
    _feedTriggerWalkthrough();

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

    var html = '<div style="display:flex;gap:var(--gl-space-sm);margin-bottom:var(--gl-space-sm);flex-wrap:wrap">';
    if (summary.critical > 0) {
        html += '<button onclick="_feedSetFilter(\'critical\')" class="gl-chip gl-chip--danger" style="padding:8px 14px;font-size:0.82em;gap:8px">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:var(--gl-red);flex-shrink:0"></span>'
            + '<span style="font-weight:800">' + summary.critical + '</span> Critical</button>';
    }
    if (summary.needsMyInput > 0) {
        html += '<button onclick="_feedSetFilter(\'needs_input\')" class="gl-chip gl-chip--warning" style="padding:8px 14px;font-size:0.82em;gap:8px">'
            + '<span style="width:8px;height:8px;border-radius:50%;background:var(--gl-amber);flex-shrink:0"></span>'
            + '<span style="font-weight:800">' + summary.needsMyInput + '</span> Needs You</button>';
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

    var systemCount = items.filter(function(i) { return i._source === 'playlist_sync' && !_feedIsArchived(i); }).length;
    var filters = [
        { key: 'all', label: 'All (' + summary.total + ')' },
        { key: 'critical', label: '\u26A0\uFE0F Critical' + (summary.critical ? ' (' + summary.critical + ')' : '') },
        { key: 'needs_input', label: '\u270B Needs You' + (summary.needsMyInput ? ' (' + summary.needsMyInput + ')' : '') },
        { key: 'waiting_on_band', label: '\uD83D\uDC65 Waiting' + (summary.waitingOnBand ? ' (' + summary.waitingOnBand + ')' : '') },
        { key: 'since_rehearsal', label: '\uD83C\uDFB8 Since Rehearsal' + (sinceCount ? ' (' + sinceCount + ')' : '') },
        { key: 'links', label: '\uD83D\uDD17 Links' },
        { key: 'photos', label: '\uD83D\uDCF7 Photos' },
        { key: 'pinned', label: '\uD83D\uDCCC Pinned' },
        { key: 'system', label: '\u2699\uFE0F System' + (systemCount ? ' (' + systemCount + ')' : '') },
        { key: 'archived', label: '\uD83D\uDDC4\uFE0F Archived' + (archivedCount ? ' (' + archivedCount + ')' : '') }
    ];
    bar.innerHTML = '<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">'
        + filters.map(function(f) {
            var active = _feedFilter === f.key;
            return '<button onclick="_feedSetFilter(\'' + f.key + '\')" class="gl-btn-ghost" style="font-size:0.72em;' + (active ? 'font-weight:800;border-color:rgba(99,102,241,0.4);background:rgba(99,102,241,0.1);color:var(--gl-indigo)' : '') + '">' + f.label + '</button>';
        }).join('')
        + '<button onclick="_feedToggleBulkMode()" class="gl-btn-ghost" style="font-size:0.68em;margin-left:auto;' + (_feedBulkMode ? 'border-color:rgba(239,68,68,0.4);color:var(--gl-red)' : 'color:var(--gl-text-tertiary)') + '">' + (_feedBulkMode ? '\u2715 Cancel' : '\u2611 Select') + '</button>'
        + '</div>'
        + (_feedBulkMode ? '<div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 12px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:8px"><span id="feedBulkCount" style="font-size:0.78em;font-weight:600;color:#f87171">0 selected</span><button onclick="_feedBulkDelete()" style="margin-left:auto;font-size:0.78em;font-weight:700;padding:5px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);color:#f87171">\uD83D\uDDD1 Delete Selected</button></div>' : '');
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

// Auto-resolve: persist resolved state to feed_meta for items that are
// resolved by computation but not yet stored. Prevents badge/state drift.
function _feedAutoResolve(items) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var updates = {};
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (!item.resolved) continue; // only auto-resolve items that are computed-resolved
        var key = _feedItemKey(item);
        var meta = _feedMeta[key];
        if (meta && meta.resolved) continue; // already persisted
        // Persist resolved state with timestamp
        updates[bandPath('feed_meta/' + key + '/resolved')] = true;
        updates[bandPath('feed_meta/' + key + '/resolvedAt')] = new Date().toISOString();
        // Update local cache
        if (!_feedMeta[key]) _feedMeta[key] = {};
        _feedMeta[key].resolved = true;
        _feedMeta[key].resolvedAt = new Date().toISOString();
    }
    if (Object.keys(updates).length > 0) {
        db.ref().update(updates).catch(function(e) {
            console.warn('[Feed] Auto-resolve write failed:', e.message);
        });
        console.log('[Feed] Auto-resolved', Object.keys(updates).length, 'items');
    }
    // Auto-archive: items resolved for 14+ days
    _feedAutoArchive(items);
}

function _feedAutoArchive(items) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var cutoff = Date.now() - 14 * 86400000;
    var updates = {};
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var key = _feedItemKey(item);
        var meta = _feedMeta[key] || {};
        if (meta.archived) continue;
        if (!meta.resolved && !item.resolved) continue;
        // Check if resolved long enough — use resolvedAt if stored, else item timestamp
        var resolvedTs = meta.resolvedAt || item.timestamp || '';
        if (!resolvedTs) continue;
        var resolvedTime = new Date(resolvedTs).getTime();
        if (isNaN(resolvedTime) || resolvedTime > cutoff) continue;
        updates[bandPath('feed_meta/' + key + '/archived')] = true;
        if (!_feedMeta[key]) _feedMeta[key] = {};
        _feedMeta[key].archived = true;
    }
    if (Object.keys(updates).length > 0) {
        db.ref().update(updates).catch(function(e) {
            console.warn('[Feed] Auto-archive write failed:', e.message);
        });
        console.log('[Feed] Auto-archived', Object.keys(updates).length, 'items (resolved 14+ days)');
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
        var resolveUpdate = was ? { resolved: false } : { resolved: true, resolvedAt: new Date().toISOString() };
        await _feedSaveMeta(item, resolveUpdate);
        if (!was) {
            _feedAdvanceOnboarding();
            // Animate resolve: fade + shrink
            var _rEl = document.getElementById('feedItem_' + type + '_' + id);
            if (_rEl) {
                _rEl.style.transition = 'opacity 0.3s, transform 0.3s';
                _rEl.style.opacity = '0.4';
                _rEl.style.transform = 'scale(0.98)';
            }
        }
        _feedShowToast(was ? 'Reopened' : 'Resolved \u2713');
    } else if (action === 'archive') {
        // Animate archive: slide out
        var _aEl = document.getElementById('feedItem_' + type + '_' + id);
        if (_aEl) {
            _aEl.style.transition = 'opacity 0.2s, transform 0.2s';
            _aEl.style.opacity = '0';
            _aEl.style.transform = 'translateX(20px)';
        }
        await _feedSaveMeta(item, { archived: true });
        _feedShowToast('Archived');
    } else if (action === 'unarchive') {
        await _feedSaveMeta(item, { archived: false });
        _feedShowToast('Restored');
    } else if (action === 'delete') {
        if (!_feedCanDelete(item)) { _feedShowToast('Only the creator or admin can delete'); return; }
        if (!confirm('Delete this post? This cannot be undone.')) return;
        await _feedDeleteItem(item);
        _feedShowToast('Post deleted');
    } else if (action === 'pin') {
        await _feedSaveMeta(item, { pinned: true });
        _feedShowToast('\uD83D\uDCCC Pinned to Band Room');
    } else if (action === 'unpin') {
        await _feedSaveMeta(item, { pinned: false });
        _feedShowToast('Unpinned');
    }
    _feedRerender();
};

// ── Delete ─────────────────────────────────────────────────────────────────

function _feedCanDelete(item) {
    var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
    if (!fas) return true; // can't check, allow
    // Creator can delete
    if (fas.isMe && fas.isMe(item.author)) return true;
    // Admin check: drew is admin (band owner)
    var key = fas.getMyMemberKey ? fas.getMyMemberKey() : '';
    if (key === 'drew') return true;
    return false;
}

async function _feedDeleteItem(item) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;

    // Delete from source: ideas/posts is the main store for posts type
    if (item.type === 'post' || item.type === 'idea' || item.type === 'ideas') {
        try { await db.ref(bandPath('ideas/posts/' + item.id)).remove(); } catch(e) {}
    }
    if (item.type === 'poll') {
        try { await db.ref(bandPath('polls/' + item.id)).remove(); } catch(e) {}
    }

    // Delete metadata
    var key = _feedItemKey(item);
    try { await db.ref(bandPath('feed_meta/' + key)).remove(); } catch(e) {}
    delete _feedMeta[key];

    // Remove from cache
    if (_feedCache) {
        _feedCache = _feedCache.filter(function(f) { return !(f.type === item.type && f.id === item.id); });
    }
}

// ── Bulk Delete ────────────────────────────────────────────────────────────

var _feedBulkMode = false;
var _feedBulkSelected = {};

window._feedToggleBulkMode = function() {
    _feedBulkMode = !_feedBulkMode;
    _feedBulkSelected = {};
    _feedRerender();
};

window._feedBulkToggle = function(type, id) {
    var key = type + ':' + id;
    if (_feedBulkSelected[key]) delete _feedBulkSelected[key];
    else _feedBulkSelected[key] = { type: type, id: id };
    // Update checkbox UI
    var cb = document.getElementById('feedBulkCb_' + type + '_' + id);
    if (cb) cb.checked = !!_feedBulkSelected[key];
    // Update count
    var countEl = document.getElementById('feedBulkCount');
    if (countEl) countEl.textContent = Object.keys(_feedBulkSelected).length + ' selected';
};

// ── Edit ───────────────────────────────────────────────────────────────────

window._feedEditItem = function(type, id) {
    var item = _feedFindItem(type, id);
    if (!item) return;
    if (!_feedCanDelete(item)) { _feedShowToast('Only the creator can edit'); return; }

    var cardEl = document.getElementById('feedItem_' + type + '_' + id);
    if (!cardEl) return;

    var existingText = item.text || item.title || '';
    var existingLink = item.link || '';

    var html = '<div style="padding:8px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.2);border-radius:8px;margin-top:6px" onclick="event.stopPropagation()">';
    html += '<textarea id="feedEditText_' + type + '_' + id + '" style="width:100%;min-height:40px;padding:8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);font-size:0.82em;resize:vertical;box-sizing:border-box;font-family:inherit">' + _feedEsc(existingText) + '</textarea>';
    if (existingLink || item.post_type === 'link') {
        html += '<input id="feedEditLink_' + type + '_' + id + '" value="' + _feedEsc(existingLink) + '" placeholder="URL" style="width:100%;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);font-size:0.78em;margin-top:4px;box-sizing:border-box">';
    }
    html += '<div style="display:flex;gap:6px;margin-top:6px;justify-content:flex-end">';
    html += '<button onclick="document.getElementById(\'feedEditArea_' + type + '_' + id + '\').remove()" style="font-size:0.75em;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim)">Cancel</button>';
    html += '<button onclick="_feedSaveEdit(\'' + type + '\',\'' + id + '\')" style="font-size:0.75em;font-weight:700;padding:4px 10px;border-radius:5px;cursor:pointer;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.08);color:#86efac">Save</button>';
    html += '</div></div>';

    var editArea = document.createElement('div');
    editArea.id = 'feedEditArea_' + type + '_' + id;
    editArea.innerHTML = html;
    cardEl.appendChild(editArea);
};

window._feedSaveEdit = async function(type, id) {
    var item = _feedFindItem(type, id);
    if (!item) return;

    var textEl = document.getElementById('feedEditText_' + type + '_' + id);
    var linkEl = document.getElementById('feedEditLink_' + type + '_' + id);
    var newText = textEl ? textEl.value.trim() : '';
    if (!newText) { _feedShowToast('Cannot be empty'); return; }

    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;

    // Update in Firebase
    var path = null;
    if (type === 'post' || type === 'idea' || type === 'ideas') path = 'ideas/posts/' + id;
    else if (type === 'poll') path = 'polls/' + id;
    if (!path) return;

    var updates = { title: newText };
    if (linkEl) updates.link = linkEl.value.trim();
    updates.edited_at = new Date().toISOString();

    try {
        await db.ref(bandPath(path)).update(updates);
        _feedShowToast('Updated');
        // Refresh
        var el = document.getElementById('page-feed');
        if (el && typeof renderBandFeedPage === 'function') renderBandFeedPage(el);
    } catch(e) { _feedShowToast('Update failed'); }
};

// ── Helpers ────────────────────────────────────────────────────────────────

function _feedLinkLabel(url) {
    if (!url) return 'Link';
    try {
        var host = new URL(url).hostname.replace('www.', '');
        if (host.indexOf('youtube') >= 0 || host.indexOf('youtu.be') >= 0) return 'YouTube';
        if (host.indexOf('spotify') >= 0) return 'Spotify';
        if (host.indexOf('archive.org') >= 0) return 'Archive';
        if (host.indexOf('drive.google') >= 0) return 'Google Drive';
        if (host.indexOf('instagram') >= 0) return 'Instagram';
        return host.length > 20 ? host.substring(0, 18) + '\u2026' : host;
    } catch(e) { return 'Link'; }
}

window._feedBulkDelete = async function() {
    var keys = Object.keys(_feedBulkSelected);
    if (!keys.length) { _feedShowToast('Nothing selected'); return; }
    if (!confirm('Delete ' + keys.length + ' item' + (keys.length > 1 ? 's' : '') + '? This cannot be undone.')) return;

    for (var i = 0; i < keys.length; i++) {
        var sel = _feedBulkSelected[keys[i]];
        var item = _feedFindItem(sel.type, sel.id);
        if (item) await _feedDeleteItem(item);
    }
    _feedShowToast(keys.length + ' item' + (keys.length > 1 ? 's' : '') + ' deleted');
    _feedBulkMode = false;
    _feedBulkSelected = {};
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
    // Micro-feedback: vote confirmation
    if (item && item.resolved) {
        // Poll just completed — show completion summary
        var _winIdx = 0, _winCount = 0, _winCounts = {};
        if (item.pollVotes) {
            Object.values(item.pollVotes).forEach(function(v) { _winCounts[v] = (_winCounts[v] || 0) + 1; });
            Object.keys(_winCounts).forEach(function(k) { if (_winCounts[k] > _winCount) { _winCount = _winCounts[k]; _winIdx = parseInt(k); } });
        }
        var _winOpt = item.pollOptions && item.pollOptions[_winIdx] ? item.pollOptions[_winIdx] : '';
        _feedShowToast('\u2705 Decision made: ' + _winOpt + ' (' + _winCount + ' votes)');
        // Animate the card collapse
        var _cardEl = document.getElementById('feedItem_poll_' + _feedEsc(pollKey));
        if (_cardEl) {
            _cardEl.style.transition = 'opacity 0.3s, max-height 0.4s, padding 0.4s, margin 0.4s';
            _cardEl.style.opacity = '0.5';
            _cardEl.style.maxHeight = _cardEl.offsetHeight + 'px';
            _cardEl.style.overflow = 'hidden';
            setTimeout(function() { _cardEl.style.maxHeight = '48px'; _cardEl.style.padding = '6px 14px'; }, 50);
        }
    } else if (!localStorage.getItem(_FEED_FIRST_VOTE_KEY)) {
        localStorage.setItem(_FEED_FIRST_VOTE_KEY, '1');
        _feedMicroReinforce('first_vote');
    } else if (item && item.targetType === 'specific') {
        _feedMicroReinforce('targeted');
    } else {
        _feedShowToast('Vote recorded \u2713');
    }
    _feedAdvanceOnboarding();
    // Delay rerender slightly so animation is visible
    setTimeout(function() { _feedRerender(); }, item && item.resolved ? 800 : 0);
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
    await _feedSaveMeta(item, { notes: notes, resolved: true, resolvedAt: new Date().toISOString() });
    item.resolved = true;
    _feedShowToast('Got it \u2713');
    _feedAdvanceOnboarding();
    // Animate collapse
    var _el = document.getElementById('feedItem_idea_' + id);
    if (_el) {
        _el.style.transition = 'opacity 0.3s, max-height 0.4s';
        _el.style.opacity = '0.4';
    }
    setTimeout(function() { _feedRerender(); }, 500);
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
    fas.setActionCount(summary.needsMyInput, summary.unvotedPolls);
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
    _feedMicroReinforce('return');
};

function _feedShowBackBar() {
    _feedRemoveBackBar();
    var bar = document.createElement('div');
    bar.id = 'feedBackBar';
    // Floating pill button — stays visible without covering the full topbar
    var rail = document.getElementById('gl-left-rail');
    var railW = rail ? rail.offsetWidth + 16 : 16;
    bar.style.cssText = 'position:fixed;top:8px;z-index:1100;display:inline-flex;align-items:center;padding:0;border-radius:8px;background:rgba(15,23,42,0.92);border:1px solid rgba(99,102,241,0.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 2px 8px rgba(0,0,0,0.2);left:' + railW + 'px';
    bar.innerHTML = '<button onclick="_feedBackToFeed()" style="display:flex;align-items:center;gap:6px;font-size:0.78em;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;border:none;background:transparent;color:#a5b4fc">\u2190 Back to Feed</button>';
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
    // Filter state bar — shows when filtered
    if (window._feedMentionFilterKey) {
        var _mfName = '';
        var _bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        if (_bm[window._feedMentionFilterKey]) _mfName = _bm[window._feedMentionFilterKey].name || window._feedMentionFilterKey;
        el.insertAdjacentHTML('beforebegin', '<div id="feedFilterStateBar" style="font-size:0.78em;color:var(--gl-text-secondary,#94a3b8);opacity:0.8;margin-bottom:8px;display:flex;align-items:center;gap:8px">'
            + 'Showing: <span style="font-weight:600;color:var(--gl-indigo,#818cf8)">@' + _mfName + '</span>'
            + '<button onclick="window._feedMentionFilterKey=null;_feedRerender();var b=document.getElementById(\'feedFilterStateBar\');if(b)b.remove()" style="font-size:0.85em;padding:2px 8px;border-radius:4px;border:1px solid var(--gl-border,rgba(255,255,255,0.05));background:none;color:var(--gl-text-tertiary,#64748b);cursor:pointer">Clear</button>'
            + '</div>');
    }
    // Mention filter overlay — narrows to items targeting a specific member
    if (window._feedMentionFilterKey) {
        var _mfk = window._feedMentionFilterKey;
        visible = visible.filter(function(i) {
            if (i.targetMembers && i.targetMembers.indexOf(_mfk) !== -1) return true;
            if (i.mentions) return i.mentions.some(function(m) { return m.key === _mfk; });
            return false;
        });
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
    } else if (_feedFilter === 'links') {
        filtered = visible.filter(function(i) { return i.post_type === 'link' || (!i.post_type && i.link); });
    } else if (_feedFilter === 'photos') {
        filtered = visible.filter(function(i) { return i.post_type === 'photo' || i.photo_url; });
    } else if (_feedFilter === 'pinned') {
        filtered = visible.filter(function(i) { return _feedGetMeta(i).pinned; });
    } else if (_feedFilter === 'system') {
        filtered = visible.filter(function(i) { return i._source === 'playlist_sync'; });
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
        // Hide system-generated posts from default view
        visible = visible.filter(function(i) { return i._source !== 'playlist_sync'; });
        // 3 tiers: ACTION REQUIRED → WAITING → CONTEXT → RESOLVED (collapsed)
        var groups = { critical: [], myInput: [], bandWait: [], context: [], resolved: [] };
        var thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
        visible.forEach(function(item) {
            var state = fas.getActionState(item, _feedGetMeta(item));
            if (state.isResolved) { groups.resolved.push(item); return; }
            if (state.priorityBucket === 1) groups.critical.push(item);
            else if (state.needsMyInput) groups.myInput.push(item);
            else if (state.waitingOnOthers) groups.bandWait.push(item);
            else groups.context.push(item);
        });

        // ── ACTION REQUIRED — strongest emphasis ──
        var actionItems = groups.critical.concat(groups.myInput);
        if (actionItems.length) {
            html += '<div style="margin-bottom:16px;border-left:3px solid #f59e0b;padding-left:12px">';
            var highlightFirst = !localStorage.getItem(_FEED_HIGHLIGHT_KEY);
            actionItems.forEach(function(item, idx) { html += _feedRenderItem(item, idx === 0 && highlightFirst); });
            html += '</div>';
        }

        // ── WAITING ON BAND — compact rows, subtle label ──
        if (groups.bandWait.length) {
            html += '<div style="margin-bottom:16px;padding-top:8px">';
            html += '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Waiting on band</div>';
            groups.bandWait.forEach(function(item) { html += _feedRenderItemCompact(item); });
            html += '</div>';
        }

        // ── CONTEXT — recent + stale merged, compact, continuous ──
        if (groups.context.length) {
            html += '<div style="margin-bottom:16px;padding-top:8px">';
            groups.context.forEach(function(item) {
                var isStale = (item.timestamp || '') < thirtyDaysAgo;
                html += _feedRenderItemCompact(item, false, isStale);
            });
            html += '</div>';
        }

        // ── RESOLVED — collapsed ──
        if (groups.resolved.length) {
            html += '<details style="margin-top:8px">'
                + '<summary style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;cursor:pointer;padding:6px 0;list-style:none;display:flex;align-items:center;gap:5px">'
                + '<span style="transition:transform 0.15s;display:inline-block">\u25B8</span>'
                + 'Resolved \u00B7 ' + groups.resolved.length
                + '</summary><div style="padding-top:4px">';
            groups.resolved.forEach(function(item) {
                html += _feedRenderItemCompact(item, true);
            });
            html += '</div></details>';
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
        // All caught up — show next event if available
        var _nextCtx = '';
        var _fas3 = _fas();
        if (_fas3 && _fas3.getNextEvents) {
            var _ne = _fas3.getNextEvents();
            if (_ne) {
                if (_ne.rehearsal) {
                    try { var _rd = new Date(_ne.rehearsal + 'T12:00:00'); _nextCtx = '\uD83C\uDFB8 Next rehearsal: ' + _rd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch(e) {}
                } else if (_ne.gig) {
                    try { var _gd = new Date(_ne.gig + 'T12:00:00'); _nextCtx = '\uD83C\uDFA4 Next gig: ' + _gd.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); } catch(e) {}
                }
            }
        }
        html = '<div style="text-align:center;padding:48px 20px">'
            + '<div style="font-size:1em;font-weight:700;color:#86efac;margin-bottom:4px">You\u2019re all set \uD83D\uDC4D</div>'
            + '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:4px">No actions needed right now.</div>'
            + (_nextCtx ? '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:12px">' + _nextCtx + '</div>' : '')
            + '<button onclick="_feedCreateItem(\'note\')" style="font-size:0.78em;font-weight:700;padding:8px 18px;border-radius:8px;cursor:pointer;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc">+ Post to band</button>'
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

    var cardStyle = 'padding:var(--gl-space-sm) 14px;background:var(--gl-surface-raised);border:1px solid var(--gl-border);border-radius:10px;margin-bottom:6px';
    if (resolved) cardStyle += ';opacity:0.6';
    if (archived) cardStyle += ';opacity:0.45';

    var highlightClass = isFirstAction ? ' feed-first-action' : '';
    var html = '<div id="feedItem_' + safeType + '_' + safeId + '" class="' + highlightClass + '" style="' + cardStyle + '">';

    // Bulk select checkbox
    if (_feedBulkMode) {
        var bKey = safeType + ':' + safeId;
        html += '<div style="float:left;margin-right:8px;margin-top:2px" onclick="event.stopPropagation()">'
            + '<input type="checkbox" id="feedBulkCb_' + safeType + '_' + safeId + '" onchange="_feedBulkToggle(\'' + safeType + '\',\'' + safeId + '\')"' + (_feedBulkSelected[bKey] ? ' checked' : '') + ' style="accent-color:#ef4444;width:16px;height:16px;cursor:pointer">'
            + '</div>';
    }

    // System-generated badge
    if (item._source === 'playlist_sync') {
        html += '<div style="font-size:0.6em;font-weight:700;color:#475569;background:rgba(71,85,105,0.15);display:inline-block;padding:1px 6px;border-radius:3px;margin-bottom:4px">SYSTEM</div>';
    }

    // Micro-guidance on first action item
    if (isFirstAction) {
        html += '<div id="feedMicroGuide" style="font-size:0.68em;font-weight:600;color:var(--gl-amber);margin-bottom:6px;opacity:0.8">\u2192 Tap to complete this</div>';
    }

    // Header
    html += '<div' + clickAttr + ' style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;cursor:pointer">'
        + '<span style="font-size:1em">' + typeIcon + '</span>'
        + '<span style="font-size:0.82em;font-weight:700;color:var(--text)">' + _feedEsc(item.author) + '</span>'
        + contextStr + _feedBuildAssignmentChip(item) + badgeHtml + _feedRenderUrgencyTag(state)
        + '<span style="margin-left:auto;font-size:0.68em;color:var(--text-dim);flex-shrink:0">' + timeStr + '</span>'
        + '</div>';

    // Body
    html += '<div' + clickAttr + ' style="font-size:0.88em;color:var(--text-muted);line-height:1.5;cursor:pointer">' + _feedRenderMentions(_feedEsc(item.text)) + '</div>';

    if (item.link) html += '<a href="' + _feedEsc(item.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:0.75em;color:var(--accent-light);margin-top:4px;display:inline-block">\uD83D\uDD17 ' + _feedEsc(_feedLinkLabel(item.link)) + '</a>';

    // Photo
    if (item.photo_url) html += '<div style="margin-top:6px"><img src="' + _feedEsc(item.photo_url) + '" style="max-width:100%;max-height:240px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)" onerror="this.style.display=\'none\'"></div>';

    // Post type badge
    if (item.post_type && item.post_type !== 'note') {
        var ptLabels = { link: '\uD83D\uDD17 Link', photo: '\uD83D\uDCF7 Photo' };
        if (ptLabels[item.post_type]) html += '<span style="font-size:0.6em;font-weight:700;color:#475569;background:rgba(71,85,105,0.15);padding:1px 5px;border-radius:3px;margin-top:4px;display:inline-block">' + ptLabels[item.post_type] + '</span>';
    }

    // Pinned badge
    var isPinned = _feedGetMeta(item).pinned;
    if (isPinned) html += '<span class="gl-chip gl-chip--amber" style="margin-top:4px;margin-left:4px">\uD83D\uDCCC Pinned</span>';

    // ── Action signals: time-aware, socially visible, escalating ──
    if (state && !resolved) {
        var _ageMs = item.timestamp ? (Date.now() - new Date(item.timestamp).getTime()) : 0;
        var _ageH = Math.floor(_ageMs / 3600000);
        var _ageLabel = _ageH < 1 ? '' : _ageH < 24 ? _ageH + 'h' : Math.floor(_ageH / 24) + 'd';
        var _isStuck = _ageH >= 48;
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;

        if (state.isRsvpUrgent) {
            var _urgDays = state.urgency ? state.urgency.days : null;
            var _rsvpP = (typeof GLPriority !== 'undefined') ? GLPriority.forRsvpEvent(_urgDays) : { label: 'RSVP needed', color: 'var(--gl-red)' };
            var _isFinal = _urgDays !== null && _urgDays <= 1;
            html += '<div style="font-size:0.75em;font-weight:800;color:' + _rsvpP.color + ';margin-top:6px;padding:var(--gl-space-xs) var(--gl-space-sm);background:rgba(239,68,68,' + (_isFinal ? '0.12' : '0.08') + ');border-radius:6px;border-left:3px solid ' + _rsvpP.color + '">'
                + _rsvpP.label + '</div>';
        } else if (state.isMentioned || state.needsMyInput) {
            // Blocker detection for polls
            var _isBlocker = false;
            var _progressHtml = '';
            if (item.type === 'poll' && item.pollVotes && fas) {
                var _voted = Object.keys(item.pollVotes).length;
                var _remaining = memberCount - _voted;
                _isBlocker = _remaining === 1;
                _progressHtml = _isBlocker
                    ? ' <span style="opacity:0.8;font-weight:600">\u00B7 everyone else responded</span>'
                    : ' <span style="opacity:0.6;font-weight:500">\u00B7 ' + _voted + ' of ' + memberCount + ' responded</span>';
            }
            var _pri = (typeof GLPriority !== 'undefined')
                ? GLPriority.forAction({ isBlocker: _isBlocker, isStuck: _isStuck, isMentioned: state.isMentioned, isRsvpUrgent: false })
                : { label: 'Waiting on YOU', color: 'var(--gl-amber)', weight: '700', icon: '\u26A1' };
            html += '<div style="font-size:0.72em;font-weight:' + _pri.weight + ';color:' + _pri.color + ';margin-top:6px;padding:3px 0">'
                + _pri.icon + ' ' + _pri.label + _progressHtml
                + (_ageLabel ? ' <span style="opacity:0.5;font-weight:500">\u00B7 ' + _ageLabel + '</span>' : '')
                + '</div>';
        }
    }

    // Targeted members list (for items targeted at specific people)
    if (item.targetType === 'specific' && item.targetMembers && item.targetMembers.length) {
        var members = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var targetNames = item.targetMembers.map(function(k) { return members[k] ? members[k].name : k; });
        var tLabel = targetNames.length <= 3 ? targetNames.join(', ') : targetNames.slice(0, 2).join(', ') + ' +' + (targetNames.length - 2) + ' more';
        html += '<div style="font-size:0.72em;color:#a5b4fc;margin-top:3px">Needs input from: ' + _feedEsc(tLabel) + '</div>';
    }

    // Waiting-on-band names (when I already acted)
    if (item.type === 'poll' && state && state.waitingOnOthers && fas && !resolved) {
        var waiting = fas.getWaitingMembers(item);
        if (waiting.length > 0) {
            var names = waiting.length <= 3 ? waiting.join(', ') : waiting.slice(0, 2).join(', ') + ' +' + (waiting.length - 2) + ' more';
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:3px">Waiting on: ' + _feedEsc(names) + '</div>';
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

    // State + type metadata row
    var _typeLabels = { idea: 'Idea', poll: 'Poll', rehearsal_note: 'Rehearsal', song_moment: 'Song Note', note: 'Note', link: 'Link', photo: 'Photo' };
    var _tl = _typeLabels[item.type] || _typeLabels[item.post_type] || '';
    var _stateChips = '';
    if (_tl) _stateChips += '<span class="gl-chip">' + _tl + '</span>';
    if (isPinned) _stateChips += '<span class="gl-chip gl-chip--amber">\uD83D\uDCCC Pinned</span>';
    if (resolved) _stateChips += '<span class="gl-chip gl-chip--success">\u2705 Resolved</span>';
    if (archived) _stateChips += '<span class="gl-chip" style="opacity:0.5">Archived</span>';
    if (state && state.needsMyInput && !resolved) _stateChips += '<span class="gl-chip gl-chip--warning">\u26A1 Needs input</span>';
    if (_stateChips) html += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">' + _stateChips + '</div>';

    // Action bar — type-aware visible actions + overflow menu
    var effectiveTag = state ? state.effectiveTag : _feedGetTag(item);
    var _menuId = 'feedMenu_' + safeType + '_' + safeId;
    var _confirmId = 'feedConfirm_' + safeType + '_' + safeId;
    var _isSystem = item._source === 'playlist_sync';
    html += '<div style="display:flex;align-items:center;gap:4px;margin-top:4px" onclick="event.stopPropagation()">';

    // Type-aware primary actions (max 2)
    if (_isSystem) {
        // System items: no visible actions
    } else if (item.type === 'poll') {
        // Polls: Resolve only (voting is inline above)
        html += '<button onclick="_feedAction(\'resolve\',\'' + safeType + '\',\'' + safeId + '\')" class="gl-btn-ghost" style="font-size:0.65em;padding:2px 7px;' + (resolved ? 'color:var(--gl-green);border-color:rgba(34,197,94,0.2)' : '') + '">' + (resolved ? 'Resolved' : 'Resolve') + '</button>';
    } else if (item.type === 'idea' && state && state.needsMyInput) {
        // Actionable idea: Resolve
        html += '<button onclick="_feedAction(\'resolve\',\'' + safeType + '\',\'' + safeId + '\')" class="gl-btn-ghost" style="font-size:0.65em;padding:2px 7px">Resolve</button>';
    } else if (item.link || item.post_type === 'link') {
        // Link items: Open link + Add note
        html += '<a href="' + _feedEsc(item.link || '') + '" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="gl-btn-ghost" style="font-size:0.65em;padding:2px 7px;text-decoration:none">Open link</a>';
        html += '<button onclick="_feedShowNoteInput(\'' + safeType + '\',\'' + safeId + '\')" class="gl-btn-ghost" style="font-size:0.65em;padding:2px 7px">Add note</button>';
    } else {
        // Default: Add note (discussion-oriented items)
        html += '<button onclick="_feedShowNoteInput(\'' + safeType + '\',\'' + safeId + '\')" class="gl-btn-ghost" style="font-size:0.65em;padding:2px 7px">Add note</button>';
    }

    // Overflow menu trigger (all items except system)
    if (!_isSystem) {
        html += '<div style="position:relative;margin-left:auto">';
        html += '<button onclick="_feedToggleMenu(\'' + _menuId + '\')" style="background:transparent;border:1px solid var(--gl-border);color:var(--gl-text-secondary);border-radius:6px;padding:2px 8px;cursor:pointer;font-size:0.78em;line-height:1">\u22EF</button>';
        html += '<div id="' + _menuId + '" style="display:none;position:absolute;top:calc(100% + 4px);right:0;min-width:150px;background:var(--bg-card,#1e293b);border:1px solid var(--gl-border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);padding:4px;z-index:20">';
        // Always available
        if (!resolved) html += _feedMenuBtn('Resolve', "_feedAction('resolve','" + safeType + "','" + safeId + "')");
        html += _feedMenuBtn('Add note', "_feedShowNoteInput('" + safeType + "','" + safeId + "')");
        var tagLabels = { fyi: 'FYI', needs_input: 'Needs Input', mission_critical: 'Critical', fun: 'Fun' };
        html += _feedMenuBtn('\uD83C\uDFF7\uFE0F ' + (tagLabels[effectiveTag] || 'Tag'), "_feedChangeTag('" + safeType + "','" + safeId + "')");
        html += _feedMenuBtn('\uD83D\uDCCC ' + (isPinned ? 'Unpin' : 'Pin'), "_feedAction('" + (isPinned ? 'unpin' : 'pin') + "','" + safeType + "','" + safeId + "')");
        if (archived) {
            html += _feedMenuBtn('\u21A9\uFE0F Restore', "_feedAction('unarchive','" + safeType + "','" + safeId + "')");
        } else {
            html += _feedMenuBtn('\uD83D\uDDC4\uFE0F Archive', "_feedAction('archive','" + safeType + "','" + safeId + "')");
        }
        if (_feedCanDelete(item)) {
            html += '<div style="height:1px;background:var(--gl-border);margin:2px 0"></div>';
            html += _feedMenuBtn('\u270F\uFE0F Edit', "_feedEditItem('" + safeType + "','" + safeId + "')");
            html += _feedMenuBtn('\uD83D\uDDD1\uFE0F Delete', "_feedConfirmDelete('" + safeType + "','" + safeId + "')", 'var(--gl-red)');
        }
        html += '</div></div>';
    }
    html += '</div>';
    // Inline delete confirmation
    html += '<div id="' + _confirmId + '" style="display:none;margin-top:6px;padding:6px 10px;background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:6px;font-size:0.75em;display:none" onclick="event.stopPropagation()">'
        + 'Delete this post? '
        + '<button onclick="_feedAction(\'delete\',\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.85em;font-weight:700;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.1);color:var(--gl-red);margin-left:6px">Delete</button>'
        + '<button onclick="document.getElementById(\'' + _confirmId + '\').style.display=\'none\'" style="font-size:0.85em;padding:2px 8px;border-radius:4px;cursor:pointer;border:1px solid var(--gl-border);background:none;color:var(--gl-text-tertiary);margin-left:4px">Cancel</button>'
        + '</div>';

    // Inline note input
    html += '<div id="feedNote_' + safeType + '_' + safeId + '" style="display:none;margin-top:6px" onclick="event.stopPropagation()"><div style="display:flex;gap:6px">'
        + '<input type="text" placeholder="Add a note\u2026" onkeydown="if(event.key===\'Enter\')_feedSaveNote(\'' + safeType + '\',\'' + safeId + '\')" style="flex:1;font-size:0.78em;padding:6px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:var(--text);outline:none">'
        + '<button onclick="_feedSaveNote(\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.72em;font-weight:700;padding:4px 12px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Save</button>'
        + '</div></div>';

    html += '</div>';
    return html;
}

// ── Overflow menu helpers ────────────────────────────────────────────────────
function _feedMenuBtn(label, onclick, color) {
    return '<button onclick="' + onclick + '" style="display:block;width:100%;text-align:left;padding:5px 8px;font-size:0.78em;font-weight:500;border:none;background:none;color:' + (color || 'var(--gl-text-secondary)') + ';cursor:pointer;border-radius:4px;transition:background 0.1s" onmouseover="this.style.background=\'var(--gl-hover)\'" onmouseout="this.style.background=\'none\'">' + label + '</button>';
}

window._feedToggleMenu = function(menuId) {
    // Close any other open menus first
    document.querySelectorAll('[id^="feedMenu_"]').forEach(function(m) {
        if (m.id !== menuId) m.style.display = 'none';
    });
    var menu = document.getElementById(menuId);
    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    // Close on click outside
    if (menu && menu.style.display === 'block') {
        setTimeout(function() {
            var handler = function(e) {
                if (!menu.contains(e.target)) { menu.style.display = 'none'; document.removeEventListener('click', handler); }
            };
            document.addEventListener('click', handler);
        }, 10);
    }
};

window._feedConfirmDelete = function(type, id) {
    // Close the overflow menu
    document.querySelectorAll('[id^="feedMenu_"]').forEach(function(m) { m.style.display = 'none'; });
    var el = document.getElementById('feedConfirm_' + type + '_' + id);
    if (el) el.style.display = 'block';
};

// Compact single-line renderer for context / resolved / waiting items
function _feedRenderItemCompact(item, isResolved, isStale) {
    var typeIcon = { idea: '\uD83D\uDCA1', poll: '\uD83D\uDDF3\uFE0F', rehearsal_note: '\uD83C\uDFB8', song_moment: '\uD83C\uDFB5', gig_note: '\uD83C\uDFA4' }[item.type] || '\uD83D\uDCCB';
    var safeType = _feedEsc(item.type), safeId = _feedEsc(item.id);
    var safeSongId = item.songId ? _feedEsc(item.songId) : '';
    var text = _feedEsc((item.text || '').substring(0, 80));
    if ((item.text || '').length > 80) text += '\u2026';
    var dimLevel = isResolved ? 'opacity:0.5;' : isStale ? 'opacity:0.7;' : '';

    // Converted idea: show as linked reference, not standalone
    if (item.type === 'idea' && item.convertedToPitch) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:3px 8px;' + dimLevel + 'font-size:0.72em;color:var(--text-dim)">'
            + '\uD83D\uDCA1\u2192\uD83C\uDFB5 <span style="text-decoration:line-through;opacity:0.6">' + text + '</span>'
            + '<span style="color:#22c55e;font-weight:600">Pitched</span>'
            + '</div>';
    }

    // Completed poll: show winner summary
    var pollResult = '';
    if (item.type === 'poll' && item.pollOptions && item.pollVotes) {
        var voteCounts = {};
        Object.values(item.pollVotes).forEach(function(v) { voteCounts[v] = (voteCounts[v] || 0) + 1; });
        var topIdx = 0, topCount = 0;
        Object.keys(voteCounts).forEach(function(k) { if (voteCounts[k] > topCount) { topCount = voteCounts[k]; topIdx = parseInt(k); } });
        if (item.pollOptions[topIdx]) pollResult = ' \u2192 ' + _feedEsc(item.pollOptions[topIdx]);
    }

    // Stale nudge buttons
    var trailHtml = '<span style="font-size:0.62em;color:var(--text-dim);flex-shrink:0">' + _feedTimeAgo(item.timestamp) + '</span>';
    if (isStale) {
        trailHtml += '<span onclick="event.stopPropagation();_feedAction(\'resolve\',\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.58em;padding:1px 4px;border-radius:3px;cursor:pointer;color:var(--text-dim);border:1px solid rgba(255,255,255,0.06);margin-left:2px">\u2713</span>'
            + '<span onclick="event.stopPropagation();_feedAction(\'archive\',\'' + safeType + '\',\'' + safeId + '\')" style="font-size:0.58em;padding:1px 4px;border-radius:3px;cursor:pointer;color:var(--text-dim);border:1px solid rgba(255,255,255,0.06)">\u2715</span>';
    }

    return '<div onclick="_feedNavigate(\'' + safeType + '\',\'' + safeId + '\',\'' + safeSongId + '\')" style="display:flex;align-items:center;gap:8px;padding:4px 8px;margin-bottom:1px;border-radius:4px;cursor:pointer;transition:background 0.12s,opacity 0.15s;' + dimLevel + '" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'none\'">'
        + '<span style="font-size:0.78em;flex-shrink:0">' + typeIcon + '</span>'
        + '<span style="font-size:0.78em;color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _feedRenderMentions(text) + '<span style="color:var(--text-dim)">' + pollResult + '</span></span>'
        + trailHtml
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
            if (!polls) { fas.setActionCount(0, 0); return; }
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
            // Both badges get the same count (polls-only estimate)
            fas.setActionCount(count, count);
        }).catch(function() {});
    }
    // Run after Firebase is likely ready
    setTimeout(refresh, 4000);
    // Periodic refresh every 5 minutes (was 2min — reduce for mobile perf)
    setInterval(refresh, 300000);
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
                { itemType: 'poll', itemId: snap.key, notifClass: 'action_required',
                  url: '/#songs?item=' + encodeURIComponent('poll:' + snap.key) });
        });

        db.ref(bandPath('ideas/posts')).orderByChild('ts').limitToLast(1).on('child_added', function(snap) {
            var p = snap.val();
            if (!p || !p.ts) return;
            if (Date.now() - new Date(p.ts).getTime() > 60000) return;
            if (fas.isMe(p.author)) return;
            if (p.tag !== 'needs_input' && p.tag !== 'mission_critical') return;
            fas.fireLocalNotification('New idea shared',
                (p.title || 'Band idea').substring(0, 80),
                { itemType: 'idea', itemId: snap.key, notifClass: 'action_required',
                  url: '/#songs?item=' + encodeURIComponent('idea:' + snap.key) });
        });
    }
    setTimeout(setup, 6000);
})();

// ── Deep link handler ────────────────────────────────────────────────────────
// URL format: /#feed?item=poll:abc123 or ?item=idea:xyz
function _feedHandleDeepLink() {
    var search = window.location.search || '';
    var match = search.match(/[?&]item=([^&]+)/);
    if (!match) return;
    var decoded = decodeURIComponent(match[1]);
    var parts = decoded.split(':');
    if (parts.length < 2) return;
    var type = parts[0], id = parts.slice(1).join(':');
    // Clear the query param from URL without reload
    try {
        var url = new URL(window.location.href);
        url.searchParams.delete('item');
        history.replaceState(null, '', url.pathname + url.hash);
    } catch(e) {}
    // Scroll to item after render settles
    setTimeout(function() { _feedScrollToItem(type, id); }, 300);
}

function _feedScrollToItem(type, id) {
    var el = document.getElementById('feedItem_' + type + '_' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.transition = 'box-shadow 0.3s, border-color 0.3s';
    el.style.boxShadow = '0 0 0 2px rgba(251,191,36,0.5)';
    el.style.borderColor = 'rgba(251,191,36,0.4)';
    setTimeout(function() {
        el.style.boxShadow = '';
        el.style.borderColor = '';
    }, 3000);
}

// ── Notification tap handler ────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'GL_NOTIF_TAP') {
            showPage('feed');
            setTimeout(function() { _feedScrollToItem(event.data.itemType, event.data.itemId); }, 1500);
        }
    });
}

// ── @Mention notification listener ──────────────────────────────────────────
// When someone posts a comment with @mentions, fire notification for tagged users
(function() {
    if (typeof GLStore === 'undefined' || !GLStore.on) return;
    GLStore.on('mentionNotification', function(data) {
        if (!data || !data.mentions || !data.author) return;
        var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
        if (!fas) return;
        // Only fire if I'm mentioned
        var myKey = fas.getMyMemberKey();
        var myName = fas.getMyDisplayName();
        var mentioned = data.mentions.some(function(m) {
            return (m.memberKey && m.memberKey === myKey) || (m.displayName && m.displayName === myName);
        });
        if (!mentioned) return;
        if (fas.isMe(data.author)) return; // don't notify yourself
        var body = (data.author + ' mentioned you').substring(0, 80);
        if (data.song) body += ' in ' + data.song;
        fas.fireLocalNotification('You were mentioned', body,
            { itemType: 'song_moment', itemId: data.song || '', notifClass: 'action_required' });
    });
})();

// ── Feed Spotlight Walkthrough ───────────────────────────────────────────────
// Guided behavior onboarding. 7 steps targeting real UI elements.
// Runs once on first feed visit. Replayable via help button.

var _FEED_WT_KEY = 'feed-walkthrough-v2';
var _FEED_FIRST_VOTE_KEY = 'gl_feed_first_vote';

function _feedRegisterWalkthrough() {
    if (typeof glSpotlight === 'undefined' || !glSpotlight.register) return;

    glSpotlight.register(_FEED_WT_KEY, [
        // 1 — Purpose
        { target: '.page-header',
          text: 'Your band\u2019s command center.\nEverything that matters shows up here.' },

        // 2 — Action
        { target: function() { return document.querySelector('[style*="Needs you"]') || document.querySelector('#feedAttentionBar > div'); },
          text: 'This needs you.\nJump in.' },

        // 3 — Ownership
        { target: function() { return document.querySelector('[style*="Needs input from"]') || document.querySelector('[style*="Waiting on"]') || document.querySelector('#feedFilterBar'); },
          text: 'Some items are for specific people.\nYou\u2019ll see exactly who.' },

        // 4 — Creation
        { target: '#feedCreateBar',
          text: 'This replaces texting the band.\nType and send. Start here.' },

        // 5 — Interaction
        { target: function() { return document.querySelector('[id^="feedItem_"]'); },
          text: 'Tap to vote or respond.\nPolls work right here \u2014 no extra screens.' },

        // 6 — Navigation
        { target: function() { return document.getElementById('feedBackBar') || document.querySelector('#feedFilterBar'); },
          text: 'Leave and come back anytime.\n\u2190 Back to Feed' },

        // 7 — Completion
        { target: '#feedAttentionBar',
          text: 'Clear everything and you\u2019re locked in.\nThat\u2019s the goal.' },

        // 8 — Call to action
        { target: '#feedQuickAdd',
          text: 'Try it now.\nAsk the band something.' }
    ]);
}

// ── Micro-reinforcement ─────────────────────────────────────────────────────

function _feedMicroReinforce(type) {
    var key = 'gl_feed_reinforce_' + type;
    var sessionTypes = { targeted: 1, return: 1, momentum: 1 };
    if (sessionTypes[type]) {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, '1');
    } else {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, '1');
    }

    var msgs = {
        first_post: '\uD83C\uDF89 First post \u2014 you\u2019re using Band Feed',
        first_vote: '\uD83C\uDF89 First vote \u2014 you just influenced the band',
        all_clear: '\uD83D\uDCAA All clear \u2014 the band is locked in',
        targeted: '\uD83C\uDFAF Nice \u2014 you jumped in where it mattered',
        return: 'Back to Feed \u2014 you\u2019re in the right place',
        momentum: '\uD83D\uDD25 Nice \u2014 keep it going'
    };
    var msg = msgs[type];
    if (msg) _feedShowToast(msg);
}

function _feedTriggerWalkthrough() {
    if (typeof glSpotlight === 'undefined') return;
    try {
        // Check both v1 and v2 keys so users who completed v1 don't see v2
        if (localStorage.getItem('gl_wt_' + _FEED_WT_KEY) === '1') return;
        if (localStorage.getItem('gl_wt_feed-walkthrough-v1') === '1') return;
    } catch(e) {}
    setTimeout(function() { glSpotlight.run(_FEED_WT_KEY); }, 1200);
}

// Replay from help button
window._feedRunWalkthrough = function() {
    if (typeof glSpotlight !== 'undefined') {
        glSpotlight.run(_FEED_WT_KEY, null, { force: true });
    }
};

// Register on file load
_feedRegisterWalkthrough();

console.log('\uD83D\uDCE1 band-feed.js v5 loaded \u2014 unified action engine');
