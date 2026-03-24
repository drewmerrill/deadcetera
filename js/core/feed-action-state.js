// ============================================================================
// js/core/feed-action-state.js — Feed Action State Engine
//
// Centralized source of truth for feed item ownership, completion,
// actionability, badges, CTA labels, and return navigation.
//
// Used by band-feed.js and available for any surface that needs to answer:
//   - What do I owe?
//   - What is waiting on others?
//   - What is done?
//
// DEPENDS ON (resolved at call time, not load time):
//   bandMembers, getCurrentMemberKey, currentUserEmail, currentUserName
//   — all from firebase-service.js / app.js
//
// LOAD ORDER: after groovelinx_store.js, before band-feed.js
// ============================================================================

'use strict';

window.FeedActionState = (function() {

    // ── Identity Resolution ─────────────────────────────────────────────────
    //
    // The app uses multiple identity formats depending on context:
    //   - Member key: 'drew', 'chris' (bandMembers keys, readiness, localStorage)
    //   - Display name: 'Drew', 'Chris' (poll votes via _bcGetName(), feed notes)
    //   - Email: 'drewmerrill1029@gmail.com' (Firebase auth, idea authors)
    //   - Email prefix: 'drewmerrill1029' (fallback display)
    //
    // Poll votes are stored under DISPLAY NAMES (bandMembers[key].name).
    // This mirrors _bcGetName() in band-comms.js.
    //
    // MIGRATION NOTE: If vote keys ever move to member keys instead of display
    // names, update getMyVoteKey() to return the member key directly.

    function getMyMemberKey() {
        if (typeof getCurrentMemberKey === 'function') {
            var k = getCurrentMemberKey();
            if (k) return k;
        }
        // Fallback: try localStorage directly
        var cu = localStorage.getItem('deadcetera_current_user') || '';
        if (cu && typeof bandMembers !== 'undefined' && bandMembers[cu]) return cu;
        return null;
    }

    function getMyDisplayName() {
        var key = getMyMemberKey();
        if (key && typeof bandMembers !== 'undefined' && bandMembers[key]) {
            return bandMembers[key].name;
        }
        if (typeof currentUserName !== 'undefined' && currentUserName) return currentUserName;
        if (typeof currentUserEmail !== 'undefined' && currentUserEmail) return currentUserEmail.split('@')[0];
        return null;
    }

    // Vote key: display name used by _bcGetName() when saving poll votes
    function getMyVoteKey() {
        return getMyDisplayName();
    }

    function getMyEmail() {
        return (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail : null;
    }

    // Check if an author string matches the current user
    function isMe(authorStr) {
        if (!authorStr) return false;
        var a = authorStr.toLowerCase();
        var name = getMyDisplayName();
        if (name && a === name.toLowerCase()) return true;
        var email = getMyEmail();
        if (email && a === email.toLowerCase()) return true;
        if (email && a === email.split('@')[0].toLowerCase()) return true;
        var key = getMyMemberKey();
        if (key && a === key.toLowerCase()) return true;
        return false;
    }

    // ── Priority Buckets ────────────────────────────────────────────────────

    var BUCKET = {
        CRITICAL:       1,  // mission_critical tag
        NEEDS_MY_INPUT: 2,  // I owe action
        WAITING_ON_BAND: 3, // I acted, others haven't
        RECENT_FYI:     4,  // recent activity, no action needed
        RESOLVED:       5,  // complete
        ARCHIVED:       6   // hidden
    };

    // ── Compute Normalized Action State ─────────────────────────────────────

    function getActionState(item, meta) {
        meta = meta || {};

        var effectiveTag = meta.tag || item.tag || 'fyi';
        var isArchived = !!meta.archived;
        var isResolved = (meta.resolved !== undefined) ? !!meta.resolved : !!item.resolved;
        var iVoted = !!item.iVoted;

        // Determine personal vs band input need
        var needsMyInput = false;
        var needsBandInput = false;
        var waitingOnOthers = false;
        var completeForMe = true;
        var completeForBand = isResolved;

        if (effectiveTag === 'needs_input' && !isResolved) {
            if (item.type === 'poll') {
                needsMyInput = !iVoted;
                needsBandInput = iVoted;
                waitingOnOthers = iVoted;
                completeForMe = iVoted;
            } else {
                // Ideas, pitches: needs everyone's input until resolved
                needsMyInput = true;
                needsBandInput = true;
                completeForMe = false;
            }
        }

        // Priority bucket
        var bucket;
        if (isArchived) bucket = BUCKET.ARCHIVED;
        else if (effectiveTag === 'mission_critical' && !isResolved) bucket = BUCKET.CRITICAL;
        else if (needsMyInput) bucket = BUCKET.NEEDS_MY_INPUT;
        else if (waitingOnOthers) bucket = BUCKET.WAITING_ON_BAND;
        else if (isResolved) bucket = BUCKET.RESOLVED;
        else bucket = BUCKET.RECENT_FYI;

        // Badge
        var badge = _computeBadge(effectiveTag, isResolved, iVoted, item.type, isArchived);

        // Primary CTA
        var cta = _computeCTA(item, needsMyInput, isResolved, isArchived);

        return {
            itemType:         item.type,
            itemId:           item.id,
            title:            item.text || '',
            effectiveTag:     effectiveTag,
            needsMyInput:     needsMyInput,
            needsBandInput:   needsBandInput,
            completeForMe:    completeForMe,
            completeForBand:  completeForBand,
            waitingOnOthers:  waitingOnOthers,
            isResolved:       isResolved,
            isArchived:       isArchived,
            iVoted:           iVoted,
            priorityBucket:   bucket,
            badge:            badge,
            cta:              cta
        };
    }

    function _computeBadge(tag, resolved, iVoted, type, archived) {
        if (archived) return { text: 'Archived', tone: 'dim' };
        if (tag === 'mission_critical' && !resolved) return { text: 'Critical', tone: 'red' };
        if (tag === 'needs_input' && !resolved && type === 'poll' && iVoted) return { text: 'You voted \u00B7 waiting on band', tone: 'indigo' };
        if (tag === 'needs_input' && !resolved) return { text: 'Your input needed', tone: 'yellow' };
        if (tag === 'needs_input' && resolved) return { text: 'Complete', tone: 'green' };
        if (resolved) return { text: 'Resolved', tone: 'green' };
        if (tag === 'fun') return { text: 'Fun', tone: 'green' };
        return { text: '', tone: 'none' };
    }

    function _computeCTA(item, needsMyInput, resolved, archived) {
        if (archived) return { label: 'Restore', action: 'unarchive' };
        if (resolved) return { label: 'Reopen', action: 'resolve' };
        if (needsMyInput) {
            if (item.type === 'poll') return { label: 'Vote now', action: 'navigate' };
            if (item.type === 'idea') return { label: 'Respond', action: 'navigate' };
            return { label: 'Take action', action: 'navigate' };
        }
        return { label: 'Resolve', action: 'resolve' };
    }

    // ── Aggregate Queries ───────────────────────────────────────────────────

    function computeSummary(items, metaMap) {
        metaMap = metaMap || {};
        var critical = 0, myInput = 0, bandInput = 0, resolved = 0, total = 0;

        for (var i = 0; i < items.length; i++) {
            var meta = metaMap[items[i].type + ':' + items[i].id] || {};
            if (meta.archived) continue;
            total++;
            var state = getActionState(items[i], meta);
            if (state.priorityBucket === BUCKET.CRITICAL) critical++;
            if (state.needsMyInput) myInput++;
            if (state.waitingOnOthers) bandInput++;
            if (state.isResolved) resolved++;
        }

        return {
            total: total,
            critical: critical,
            needsMyInput: myInput,
            waitingOnBand: bandInput,
            resolved: resolved,
            allClear: critical === 0 && myInput === 0
        };
    }

    // Sort items by action urgency
    function sortByPriority(items, metaMap) {
        metaMap = metaMap || {};
        // Compute state for each item once, then sort
        var decorated = items.map(function(item) {
            var meta = metaMap[item.type + ':' + item.id] || {};
            var state = getActionState(item, meta);
            return { item: item, state: state };
        });

        decorated.sort(function(a, b) {
            // Primary: bucket priority (lower = more urgent)
            if (a.state.priorityBucket !== b.state.priorityBucket) {
                return a.state.priorityBucket - b.state.priorityBucket;
            }
            // Secondary: chronological (newest first)
            return (b.item.timestamp || '').localeCompare(a.item.timestamp || '');
        });

        return decorated.map(function(d) { return d.item; });
    }

    // ── Return Context ──────────────────────────────────────────────────────
    //
    // Persisted in sessionStorage so it survives page navigation and refresh
    // within the same session. Cleared when user explicitly exits feed loop.

    var _RETURN_KEY = 'gl_feed_return_ctx';

    function setReturnContext(ctx) {
        try {
            sessionStorage.setItem(_RETURN_KEY, JSON.stringify(ctx));
        } catch(e) {}
    }

    function getReturnContext() {
        try {
            var raw = sessionStorage.getItem(_RETURN_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch(e) { return null; }
    }

    function clearReturnContext() {
        sessionStorage.removeItem(_RETURN_KEY);
        sessionStorage.removeItem('gl_feed_context');
    }

    function hasReturnContext() {
        return sessionStorage.getItem('gl_feed_context') === '1';
    }

    // ── Badge HTML helper ───────────────────────────────────────────────────

    var _TONE_STYLES = {
        red:    'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)',
        yellow: 'background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)',
        green:  'background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2)',
        indigo: 'background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.2)',
        dim:    'background:rgba(255,255,255,0.04);color:var(--text-dim);border:1px solid rgba(255,255,255,0.08)',
        none:   ''
    };

    function renderBadgeHTML(badge) {
        if (!badge || !badge.text) return '';
        var style = _TONE_STYLES[badge.tone] || _TONE_STYLES.none;
        if (!style) return '';
        return '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;' + style + '">' + badge.text + '</span>';
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        // Identity
        getMyMemberKey:    getMyMemberKey,
        getMyDisplayName:  getMyDisplayName,
        getMyVoteKey:      getMyVoteKey,
        getMyEmail:        getMyEmail,
        isMe:              isMe,

        // Action state
        getActionState:    getActionState,
        computeSummary:    computeSummary,
        sortByPriority:    sortByPriority,
        renderBadgeHTML:   renderBadgeHTML,

        // Return context
        setReturnContext:  setReturnContext,
        getReturnContext:  getReturnContext,
        clearReturnContext: clearReturnContext,
        hasReturnContext:  hasReturnContext,

        // Constants
        BUCKET: BUCKET
    };

})();

console.log('\u2699\uFE0F feed-action-state.js loaded');
