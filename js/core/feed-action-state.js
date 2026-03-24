// ============================================================================
// js/core/feed-action-state.js — Global Action Engine
//
// Single source of truth for personal action ownership across all surfaces:
//   Band Feed, nav badges, home dashboard, push eligibility.
//
// Answers three questions for every surface:
//   1. What do I owe?        → needsMyInput
//   2. What's waiting?       → waitingOnOthers
//   3. What's done?          → isResolved
//
// DEPENDS ON (resolved at call time):
//   bandMembers, getCurrentMemberKey, currentUserEmail, currentUserName
//
// LOAD ORDER: after groovelinx_store.js, before band-feed.js
// ============================================================================

'use strict';

window.FeedActionState = (function() {

    // ── Identity Resolution ─────────────────────────────────────────────────
    //
    // Formats in use:
    //   Member key:   'drew'                    (bandMembers, readiness, localStorage)
    //   Display name: 'Drew'                    (poll votes, feed notes)
    //   Email:        'drewmerrill1029@gmail.com' (auth, idea authors)
    //   Prefix:       'drewmerrill1029'          (fallback)
    //
    // Poll votes stored under display names (bandMembers[key].name).
    // MIGRATION NOTE: if vote keys move to member keys, update getMyVoteKey().

    function getMyMemberKey() {
        if (typeof getCurrentMemberKey === 'function') {
            var k = getCurrentMemberKey();
            if (k) return k;
        }
        var cu = localStorage.getItem('deadcetera_current_user') || '';
        if (cu && typeof bandMembers !== 'undefined' && bandMembers[cu]) return cu;
        return null;
    }

    function getMyDisplayName() {
        var key = getMyMemberKey();
        if (key && typeof bandMembers !== 'undefined' && bandMembers[key]) return bandMembers[key].name;
        if (typeof currentUserName !== 'undefined' && currentUserName) return currentUserName;
        if (typeof currentUserEmail !== 'undefined' && currentUserEmail) return currentUserEmail.split('@')[0];
        return null;
    }

    function getMyVoteKey() { return getMyDisplayName(); }

    function getMyEmail() {
        return (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail : null;
    }

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

    // ── Targeting ─────────────────────────────────────────────────────────
    //
    // Items can specify who needs to respond:
    //   targetType: 'all' (default) | 'specific' | 'fyi'
    //   targetMembers: ['drew', 'chris'] (member keys, only when 'specific')
    //
    // 'fyi' items never require input regardless of needs_input tag.
    // 'specific' items only require input from listed members.
    // 'all' or missing targetType = everyone (legacy behavior).

    function _isTargetedAtMe(item) {
        var tt = item.targetType || 'all';
        if (tt === 'fyi') return false;
        if (tt === 'all' || !item.targetMembers || !item.targetMembers.length) return true;
        // 'specific' — check if my member key is in the list
        var myKey = getMyMemberKey();
        if (myKey && item.targetMembers.indexOf(myKey) !== -1) return true;
        // Also check display name (defensive)
        var myName = getMyDisplayName();
        if (myName && item.targetMembers.indexOf(myName) !== -1) return true;
        return false;
    }

    // ── Priority Buckets ────────────────────────────────────────────────────

    var BUCKET = {
        CRITICAL:        1,
        NEEDS_MY_INPUT:  2,
        WAITING_ON_BAND: 3,
        RECENT_FYI:      4,
        RESOLVED:        5,
        ARCHIVED:        6
    };

    // ── Notification Eligibility ────────────────────────────────────────────
    //
    // Classifies events for push notification decisions.
    // Push should only fire for ACTION_REQUIRED and selected CRITICAL_CHANGE.
    //
    // Preference buckets (stored in localStorage gl_notif_prefs):
    //   action_required:  ON by default  — polls needing my vote, items assigned to me
    //   critical_change:  ON by default  — setlist/rehearsal changes near a gig
    //   band_updates:     OFF by default — FYI activity, comments, low-signal

    var NOTIF_CLASS = {
        ACTION_REQUIRED:  'action_required',   // I must act
        CRITICAL_CHANGE:  'critical_change',    // near-term rehearsal/gig material change
        FYI:              'fyi'                 // informational, no push
    };

    var _NOTIF_PREF_KEY = 'gl_notif_prefs';
    var _NOTIF_DEFAULTS = { action_required: true, critical_change: true, band_updates: false };

    function getNotifPrefs() {
        try {
            var raw = localStorage.getItem(_NOTIF_PREF_KEY);
            if (raw) {
                var parsed = JSON.parse(raw);
                // Merge with defaults so new keys get safe defaults
                return { action_required: parsed.action_required !== false, critical_change: parsed.critical_change !== false, band_updates: !!parsed.band_updates };
            }
        } catch(e) {}
        return { action_required: true, critical_change: true, band_updates: false };
    }

    function setNotifPrefs(prefs) {
        try { localStorage.setItem(_NOTIF_PREF_KEY, JSON.stringify(prefs)); } catch(e) {}
    }

    function classifyNotification(item, meta) {
        meta = meta || {};
        var tag = meta.tag || item.tag || 'fyi';
        var resolved = (meta.resolved !== undefined) ? !!meta.resolved : !!item.resolved;
        if (resolved || meta.archived) return NOTIF_CLASS.FYI;

        // ACTION_REQUIRED: poll needing my vote, unresolved needs_input
        if (tag === 'needs_input') {
            if (item.type === 'poll' && !item.iVoted) return NOTIF_CLASS.ACTION_REQUIRED;
            if (item.type === 'idea') return NOTIF_CLASS.ACTION_REQUIRED;
        }
        if (tag === 'mission_critical') return NOTIF_CLASS.ACTION_REQUIRED;

        // CRITICAL_CHANGE: rehearsal/gig notes with critical tag
        if ((item.type === 'rehearsal_note' || item.type === 'gig_note') && tag === 'mission_critical') {
            return NOTIF_CLASS.CRITICAL_CHANGE;
        }

        return NOTIF_CLASS.FYI;
    }

    function isPushEligible(item, meta) {
        var cls = classifyNotification(item, meta);
        var prefs = getNotifPrefs();
        if (cls === NOTIF_CLASS.ACTION_REQUIRED) return !!prefs.action_required;
        if (cls === NOTIF_CLASS.CRITICAL_CHANGE) return !!prefs.critical_change;
        return false; // FYI never pushes
    }

    // Push payload shape for future delivery
    function buildPushPayload(item, meta) {
        var cls = classifyNotification(item, meta);
        var state = getActionState(item, meta);
        return {
            type: cls,
            title: cls === NOTIF_CLASS.ACTION_REQUIRED ? 'Action needed' : 'Band update',
            body: (item.text || '').substring(0, 120),
            tag: 'gl-' + cls + '-' + item.id,
            data: {
                itemType: item.type,
                itemId: item.id,
                url: '/#feed',
                badge: state.badge ? state.badge.text : ''
            }
        };
    }

    // ── Urgency Context ───────────────────────────────────────────────────
    //
    // Time-aware priority. Uses cached next-event dates to tag items as
    // urgent when rehearsal or gig is imminent. No new data structures —
    // reads from the same gig/calendar data already loaded by the dashboard.

    var _nextEventCache = null; // { rehearsal: "2026-03-28", gig: "2026-04-05" }

    function setNextEvents(events) {
        _nextEventCache = events || null;
    }

    function getNextEvents() { return _nextEventCache; }

    function _daysUntil(dateStr) {
        if (!dateStr) return Infinity;
        var now = new Date(); now.setHours(0,0,0,0);
        var target = new Date(dateStr + 'T12:00:00');
        return Math.ceil((target - now) / 86400000);
    }

    function getUrgencyTag(item, meta) {
        if (!_nextEventCache) return null;
        meta = meta || {};
        var tag = meta.tag || item.tag || 'fyi';
        var resolved = (meta.resolved !== undefined) ? !!meta.resolved : !!item.resolved;
        if (resolved || (meta.archived)) return null;
        if (tag !== 'needs_input' && tag !== 'mission_critical') return null;

        var daysToRehearsal = _daysUntil(_nextEventCache.rehearsal);
        var daysToGig = _daysUntil(_nextEventCache.gig);

        if (daysToGig <= 3) return { text: 'Needed for upcoming gig', tone: 'red', days: daysToGig };
        if (daysToRehearsal <= 2) return { text: 'Needed for next rehearsal', tone: 'yellow', days: daysToRehearsal };
        if (daysToGig <= 7) return { text: 'Needed for upcoming gig', tone: 'yellow', days: daysToGig };
        return null;
    }

    // Urgency score: lower = more urgent (used as sort tiebreaker within same bucket)
    function _urgencyScore(item, meta) {
        var u = getUrgencyTag(item, meta);
        if (!u) return 999;
        return u.days;
    }

    // ── Compute Normalized Action State ─────────────────────────────────────

    function getActionState(item, meta) {
        meta = meta || {};
        var effectiveTag = meta.tag || item.tag || 'fyi';
        var isArchived = !!meta.archived;
        var isResolved = (meta.resolved !== undefined) ? !!meta.resolved : !!item.resolved;
        var iVoted = !!item.iVoted;

        var needsMyInput = false, needsBandInput = false, waitingOnOthers = false;
        var completeForMe = true, completeForBand = isResolved;

        if (effectiveTag === 'needs_input' && !isResolved) {
            // Check targeting: does this item apply to me?
            var targeted = _isTargetedAtMe(item);

            if (item.type === 'poll') {
                needsMyInput = targeted && !iVoted;
                needsBandInput = iVoted || !targeted; // waiting if I voted OR not targeted at me
                waitingOnOthers = iVoted;
                completeForMe = iVoted || !targeted;
            } else {
                needsMyInput = targeted;
                needsBandInput = true;
                completeForMe = !targeted;
            }
        }

        var bucket;
        if (isArchived) bucket = BUCKET.ARCHIVED;
        else if (effectiveTag === 'mission_critical' && !isResolved) bucket = BUCKET.CRITICAL;
        else if (needsMyInput) bucket = BUCKET.NEEDS_MY_INPUT;
        else if (waitingOnOthers) bucket = BUCKET.WAITING_ON_BAND;
        else if (isResolved) bucket = BUCKET.RESOLVED;
        else bucket = BUCKET.RECENT_FYI;

        return {
            itemType: item.type, itemId: item.id, title: item.text || '',
            effectiveTag: effectiveTag,
            needsMyInput: needsMyInput, needsBandInput: needsBandInput,
            completeForMe: completeForMe, completeForBand: completeForBand,
            waitingOnOthers: waitingOnOthers,
            isResolved: isResolved, isArchived: isArchived, iVoted: iVoted,
            priorityBucket: bucket,
            urgency: getUrgencyTag(item, meta),
            badge: _computeBadge(effectiveTag, isResolved, iVoted, item.type, isArchived),
            cta: _computeCTA(item, needsMyInput, isResolved, isArchived),
            notifClass: classifyNotification(item, meta)
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
            total: total, critical: critical,
            needsMyInput: myInput, waitingOnBand: bandInput,
            resolved: resolved, allClear: critical === 0 && myInput === 0
        };
    }

    // ── Band Alignment ────────────────────────────────────────────────────

    function computeBandAlignment(items, metaMap) {
        metaMap = metaMap || {};
        var actionable = 0, resolved = 0;
        for (var i = 0; i < items.length; i++) {
            var meta = metaMap[items[i].type + ':' + items[i].id] || {};
            if (meta.archived) continue;
            var tag = meta.tag || items[i].tag || 'fyi';
            if (tag !== 'needs_input' && tag !== 'mission_critical') continue;
            actionable++;
            var state = getActionState(items[i], meta);
            if (state.isResolved || state.completeForBand) resolved++;
        }
        if (actionable === 0) return { pct: 100, actionable: 0, resolved: 0, label: 'All clear' };
        var pct = Math.round((resolved / actionable) * 100);
        var label = pct >= 100 ? 'Locked in' : pct >= 75 ? 'Almost there' : pct >= 50 ? 'Making progress' : 'Needs work';
        return { pct: pct, actionable: actionable, resolved: resolved, label: label };
    }

    // Determine who hasn't responded to a poll
    function getWaitingMembers(item) {
        if (item.type !== 'poll' || !item.pollVotes) return [];
        var members = (typeof bandMembers !== 'undefined') ? bandMembers : {};
        var voted = item.pollVotes || {};
        var waiting = [];
        Object.keys(members).forEach(function(key) {
            var name = members[key].name;
            if (name && voted[name] === undefined) waiting.push(name);
        });
        return waiting;
    }

    function sortByPriority(items, metaMap) {
        metaMap = metaMap || {};
        var decorated = items.map(function(item) {
            var meta = metaMap[item.type + ':' + item.id] || {};
            var state = getActionState(item, meta);
            var urgScore = _urgencyScore(item, meta);
            return { item: item, state: state, urgency: urgScore };
        });
        decorated.sort(function(a, b) {
            // 1. Bucket priority (lower = more urgent)
            if (a.state.priorityBucket !== b.state.priorityBucket) return a.state.priorityBucket - b.state.priorityBucket;
            // 2. Within same bucket, urgent items (near event) rise higher
            if (a.urgency !== b.urgency) return a.urgency - b.urgency;
            // 3. Chronological tiebreak (newest first)
            return (b.item.timestamp || '').localeCompare(a.item.timestamp || '');
        });
        return decorated.map(function(d) { return d.item; });
    }

    // ── Return Context ──────────────────────────────────────────────────────

    var _RETURN_KEY = 'gl_feed_return_ctx';

    function setReturnContext(ctx) { try { sessionStorage.setItem(_RETURN_KEY, JSON.stringify(ctx)); } catch(e) {} }
    function getReturnContext() { try { var r = sessionStorage.getItem(_RETURN_KEY); return r ? JSON.parse(r) : null; } catch(e) { return null; } }
    function clearReturnContext() { sessionStorage.removeItem(_RETURN_KEY); sessionStorage.removeItem('gl_feed_context'); }
    function hasReturnContext() { return sessionStorage.getItem('gl_feed_context') === '1'; }

    // ── Badge HTML ──────────────────────────────────────────────────────────

    var _TONE_STYLES = {
        red: 'background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)',
        yellow: 'background:rgba(245,158,11,0.15);color:#fbbf24;border:1px solid rgba(245,158,11,0.25)',
        green: 'background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2)',
        indigo: 'background:rgba(99,102,241,0.1);color:#a5b4fc;border:1px solid rgba(99,102,241,0.2)',
        dim: 'background:rgba(255,255,255,0.04);color:var(--text-dim);border:1px solid rgba(255,255,255,0.08)',
        none: ''
    };

    function renderBadgeHTML(badge) {
        if (!badge || !badge.text) return '';
        var style = _TONE_STYLES[badge.tone] || _TONE_STYLES.none;
        if (!style) return '';
        return '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;' + style + '">' + badge.text + '</span>';
    }

    // ── Inline Vote ─────────────────────────────────────────────────────────

    async function voteOnPoll(pollKey, optionIdx) {
        var voteKey = getMyVoteKey();
        if (!voteKey) return { ok: false, reason: 'no identity' };
        var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
        if (!db || typeof bandPath !== 'function') return { ok: false, reason: 'no database' };
        try {
            await db.ref(bandPath('polls/' + pollKey + '/votes/' + voteKey)).set(optionIdx);
            return { ok: true, voteKey: voteKey, optionIdx: optionIdx };
        } catch(e) {
            return { ok: false, reason: e.message };
        }
    }

    // ── Nav Badge State ─────────────────────────────────────────────────────
    //
    // Cached action count for nav badge. Updated by feed after data loads,
    // and after any action that changes counts. Any surface can read it.

    var _cachedActionCount = 0;

    function setActionCount(count) {
        _cachedActionCount = count;
        _updateNavBadge(count);
        _updateAppBadge(count);
    }

    function getActionCount() { return _cachedActionCount; }

    function _updateNavBadge(count) {
        // Feed nav badge in left rail
        var badge = document.getElementById('glRailFeedBadge');
        if (badge) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.style.display = count > 0 ? '' : 'none';
        }
    }

    function _updateAppBadge(count) {
        // PWA app icon badge (navigator.setAppBadge) — supported on Chrome/Edge
        // iOS PWA does not support this yet (as of 2026), but the call is safe.
        if ('setAppBadge' in navigator) {
            try {
                if (count > 0) navigator.setAppBadge(count);
                else navigator.clearAppBadge();
            } catch(e) {}
        }
    }

    // ── Push Notifications ─────────────────────────────────────────────────
    //
    // Two layers:
    //   1. LOCAL: Firebase real-time listener fires Notification API when app
    //      is backgrounded/minimized. Works immediately, no server needed.
    //   2. PUSH: VAPID subscription stored in Firebase. Cloud Function sends
    //      push when app is fully closed. Requires function deployment.

    var _VAPID_PUBLIC = 'BKH5-I_52giyvB9ljg4Uwhc_UUzgbzaHrVZrJm8eXoN_ikZAsqej8U3x_LaMCWkjZlEqcm30SPOkBXmFruzNSVw';
    var _PUSH_SUB_KEY = 'gl_push_subscription';
    var _PUSH_ENABLED_KEY = 'gl_push_enabled';

    function getPushState() {
        if (!('Notification' in window)) return 'unsupported';
        return Notification.permission;
    }

    function isPushEnabled() {
        return localStorage.getItem(_PUSH_ENABLED_KEY) === '1';
    }

    function getPushSubscription() {
        try { var r = localStorage.getItem(_PUSH_SUB_KEY); return r ? JSON.parse(r) : null; }
        catch(e) { return null; }
    }

    async function enablePush() {
        if (!('Notification' in window)) return { ok: false, reason: 'unsupported' };
        var perm = await Notification.requestPermission();
        if (perm !== 'granted') return { ok: false, reason: perm };

        // Subscribe via service worker push manager (for true push when app closed)
        try {
            var reg = await navigator.serviceWorker.ready;
            var sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: _urlBase64ToUint8Array(_VAPID_PUBLIC)
            });
            var subJson = sub.toJSON();
            // Store subscription in Firebase for server-side push delivery
            var memberKey = getMyMemberKey();
            if (memberKey && typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
                await firebaseDB.ref(bandPath('push_subscriptions/' + memberKey)).set({
                    endpoint: subJson.endpoint,
                    keys: subJson.keys,
                    ts: new Date().toISOString()
                });
            }
            localStorage.setItem(_PUSH_SUB_KEY, JSON.stringify(subJson));
        } catch(e) {
            console.warn('[Push] Subscription failed:', e.message);
            // Still enable local notifications even if push subscription fails
        }

        localStorage.setItem(_PUSH_ENABLED_KEY, '1');
        return { ok: true };
    }

    async function disablePush() {
        localStorage.setItem(_PUSH_ENABLED_KEY, '0');
        // Unsubscribe from push
        try {
            var reg = await navigator.serviceWorker.ready;
            var sub = await reg.pushManager.getSubscription();
            if (sub) await sub.unsubscribe();
            // Remove from Firebase
            var memberKey = getMyMemberKey();
            if (memberKey && typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
                await firebaseDB.ref(bandPath('push_subscriptions/' + memberKey)).remove();
            }
        } catch(e) {}
        localStorage.removeItem(_PUSH_SUB_KEY);
        return { ok: true };
    }

    // Fire a local notification (works when app is open but backgrounded)
    function fireLocalNotification(title, body, data) {
        if (!isPushEnabled()) return;
        if (getPushState() !== 'granted') return;
        if (document.visibilityState === 'visible') return; // don't notify when user is looking at app
        var prefs = getNotifPrefs();
        var cls = (data && data.notifClass) || 'fyi';
        if (cls === 'fyi' && !prefs.band_updates) return;
        if (cls === 'action_required' && !prefs.action_required) return;
        if (cls === 'critical_change' && !prefs.critical_change) return;

        try {
            navigator.serviceWorker.ready.then(function(reg) {
                reg.showNotification(title, {
                    body: body,
                    icon: 'icon-192.png',
                    tag: 'gl-' + (data && data.itemId || 'general'),
                    data: Object.assign({ url: '/#feed' }, data || {})
                });
            });
        } catch(e) {
            // Fallback: Notification API directly
            try { new Notification(title, { body: body, icon: 'icon-192.png', tag: 'gl-local' }); } catch(e2) {}
        }
    }

    function _urlBase64ToUint8Array(base64String) {
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        var rawData = atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    }

    // ── Public API ──────────────────────────────────────────────────────────

    return {
        // Identity
        getMyMemberKey: getMyMemberKey, getMyDisplayName: getMyDisplayName,
        getMyVoteKey: getMyVoteKey, getMyEmail: getMyEmail, isMe: isMe,

        // Action state
        getActionState: getActionState, computeSummary: computeSummary,
        sortByPriority: sortByPriority, renderBadgeHTML: renderBadgeHTML,

        // Actions
        voteOnPoll: voteOnPoll,

        // Band alignment
        computeBandAlignment: computeBandAlignment,
        getWaitingMembers: getWaitingMembers,

        // Urgency
        setNextEvents: setNextEvents, getNextEvents: getNextEvents,
        getUrgencyTag: getUrgencyTag,

        // Nav badge
        setActionCount: setActionCount, getActionCount: getActionCount,

        // Notifications
        classifyNotification: classifyNotification, isPushEligible: isPushEligible,
        buildPushPayload: buildPushPayload,
        getNotifPrefs: getNotifPrefs, setNotifPrefs: setNotifPrefs,
        getPushState: getPushState, isPushEnabled: isPushEnabled,
        enablePush: enablePush, disablePush: disablePush,
        fireLocalNotification: fireLocalNotification,
        NOTIF_CLASS: NOTIF_CLASS,

        // Return context
        setReturnContext: setReturnContext, getReturnContext: getReturnContext,
        clearReturnContext: clearReturnContext, hasReturnContext: hasReturnContext,

        // Constants
        BUCKET: BUCKET
    };

})();

// ── GLStore Bridge ──────────────────────────────────────────────────────────

if (typeof GLStore !== 'undefined') {
    GLStore.getActionSummary = function(feedItems, feedMeta) {
        return FeedActionState.computeSummary(feedItems || [], feedMeta || {});
    };
    GLStore.getActionState = function(item, meta) {
        return FeedActionState.getActionState(item, meta || {});
    };
    GLStore.getActionCount = function() {
        return FeedActionState.getActionCount();
    };
}

console.log('\u2699\uFE0F feed-action-state.js loaded (global action engine)');
