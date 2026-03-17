// ============================================================================
// js/features/song-pitch.js
// Song Pitch System — structured song intake with voting and tradeoff logic.
// Lives in Band Room. Integrates with Active/Library scope model.
// ============================================================================

'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Returns array of { name, date, daysAway, severity } for future setlists containing the song
// severity: 'urgent' (≤14 days), 'upcoming' (>14 days)
function _pitchFindSetlistsContaining(songTitle) {
    if (!songTitle) return [];
    var sls = (typeof window._glCachedSetlists !== 'undefined') ? window._glCachedSetlists : [];
    var today = new Date().toISOString().split('T')[0];
    var nowMs = Date.now();
    var matches = [];
    var lower = songTitle.trim().toLowerCase();
    for (var i = 0; i < sls.length; i++) {
        if ((sls[i].date || '') < today) continue;
        var found = false;
        (sls[i].sets || []).forEach(function(set) {
            (set.songs || []).forEach(function(sg) {
                var t = typeof sg === 'string' ? sg : (sg.title || '');
                if (t.toLowerCase() === lower) found = true;
            });
        });
        if (found) {
            var daysAway = sls[i].date ? Math.ceil((new Date(sls[i].date).getTime() - nowMs) / 86400000) : 999;
            matches.push({
                name: sls[i].name || sls[i].title || ('Setlist ' + (i + 1)),
                date: sls[i].date || '',
                daysAway: daysAway,
                severity: daysAway <= 14 ? 'urgent' : 'upcoming'
            });
        }
    }
    return matches.sort(function(a, b) { return a.daysAway - b.daysAway; });
}

// Helper: format setlist match array into a human-readable warning string with severity
function _pitchFormatSetlistWarning(slMatches) {
    if (!slMatches || slMatches.length === 0) return '';
    var urgent = slMatches.filter(function(s) { return s.severity === 'urgent'; });
    var upcoming = slMatches.filter(function(s) { return s.severity === 'upcoming'; });
    var parts = [];
    if (urgent.length > 0) parts.push(urgent.map(function(s) { return s.name + (s.daysAway <= 7 ? ' (this week!)' : ' (' + s.daysAway + 'd)'); }).join(', '));
    if (upcoming.length > 0) parts.push(upcoming.map(function(s) { return s.name + ' (' + s.daysAway + 'd)'; }).join(', '));
    return parts.join('; ');
}

// Helper: does the song appear in any urgent (≤14 day) setlist?
function _pitchHasUrgentSetlist(slMatches) {
    return slMatches && slMatches.some(function(s) { return s.severity === 'urgent'; });
}

// Returns sorted array of { title, avg } for all Active songs
function _pitchGetActiveSongsWithReadiness() {
    var rc = (typeof readinessCache !== 'undefined') ? readinessCache : {};
    var sc = (typeof statusCache !== 'undefined') ? statusCache : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    return songs.filter(function(s) {
        var st = sc[s.title] || '';
        return st === 'prospect' || st === 'learning' || st === 'rotation';
    }).map(function(s) {
        var scores = rc[s.title] || {};
        var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
        return { title: s.title, avg: vals.length ? vals.reduce(function(a,b){return a+b;},0)/vals.length : 99 };
    }).sort(function(a,b) { return a.avg - b.avg; });
}

// Returns true if song is in the current/latest rehearsal agenda
function _pitchIsInRehearsalAgenda(songTitle) {
    if (!songTitle) return false;
    var lower = songTitle.trim().toLowerCase();
    try {
        var agenda = null;
        if (typeof GLStore !== 'undefined') {
            agenda = (GLStore.getActiveRehearsalAgendaSession && GLStore.getActiveRehearsalAgendaSession())
                  || (GLStore.getLatestRehearsalAgenda && GLStore.getLatestRehearsalAgenda());
        }
        if (!agenda || !agenda.items) return false;
        return agenda.items.some(function(item) {
            return (item.songId || item.title || '').toLowerCase() === lower;
        });
    } catch(e) { return false; }
}

// Returns human-readable relative time string (e.g. "2 days ago")
function _pitchRelativeTime(isoStr) {
    if (!isoStr) return '';
    var diff = Date.now() - new Date(isoStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
}

// Returns count of Active songs
function _pitchActiveCount() {
    var sc = (typeof statusCache !== 'undefined') ? statusCache : {};
    var songs = (typeof allSongs !== 'undefined') ? allSongs : [];
    return songs.filter(function(s) {
        var st = sc[s.title] || '';
        return st === 'prospect' || st === 'learning' || st === 'rotation';
    }).length;
}

// Brief approval overlay — richer than a toast, auto-dismisses
function _pitchShowApprovalCard(pitch) {
    document.getElementById('pitchApprovalCard')?.remove();
    var lines = ['✅ <strong>' + pitch.title + '</strong> is now Active'];
    if (pitch.replaceSong) {
        lines.push('<span style="color:#f59e0b">' + pitch.replaceSong + '</span> → Shelved');
    } else {
        lines.push('Active set expanded — no song replaced');
    }
    lines.push('<span style="color:var(--text-dim)">The band has spoken. Time to learn it.</span>');
    var card = document.createElement('div');
    card.id = 'pitchApprovalCard';
    card.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.97);border:1px solid rgba(34,197,94,0.3);border-radius:12px;padding:14px 20px;z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,0.5);max-width:360px;width:90%;text-align:center;animation:pitchFadeIn 0.3s ease';
    card.innerHTML = '<div style="font-size:0.88em;color:#f1f5f9;line-height:1.6">' + lines.join('<br>') + '</div>';
    // Inject animation if not present
    if (!document.getElementById('pitchApprovalAnim')) {
        var style = document.createElement('style');
        style.id = 'pitchApprovalAnim';
        style.textContent = '@keyframes pitchFadeIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(style);
    }
    document.body.appendChild(card);
    setTimeout(function() {
        card.style.transition = 'opacity 0.4s';
        card.style.opacity = '0';
        setTimeout(function() { card.remove(); }, 400);
    }, 4000);
}

// ── Render Pitch Section (called from Band Room page) ────────────────────────
window.renderSongPitchSection = async function(container) {
    if (!container) return;
    var pitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    var pending = pitches.filter(function(p) { return p.status === 'pending'; });
    var backlog = pitches.filter(function(p) { return p.status === 'rejected' || p.status === 'deferred'; });

    var html = '<div style="margin-bottom:16px">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px">'
        + '<h3 style="margin:0;font-size:0.95em;color:var(--text)">🎤 Song Pitches</h3>'
        + '<button onclick="showPitchModal()" style="font-size:0.75em;font-weight:700;padding:6px 14px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc;min-height:36px">+ Pitch a Song</button>'
        + '</div>';

    if (pending.length === 0 && backlog.length === 0) {
        html += '<div style="font-size:0.82em;color:var(--text-dim);padding:12px;text-align:center;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">No active pitches. Suggest a song for the band to learn.</div>';
    }

    // Pending pitches
    pending.forEach(function(p) {
        var myKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : null;
        var votes = p.votes || {};
        var yesCount = Object.values(votes).filter(function(v) { return v === 'yes'; }).length;
        var noCount = Object.values(votes).filter(function(v) { return v === 'no'; }).length;
        var deferCount = Object.values(votes).filter(function(v) { return v === 'defer'; }).length;
        var totalVotes = Object.keys(votes).length;
        var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
        var majority = Math.ceil(memberCount / 2);
        var myVote = myKey ? (votes[myKey] || null) : null;

        // Card container — mobile-friendly padding
        html += '<div style="padding:12px;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:8px;margin-bottom:8px">';

        // Title + reason (full width on mobile)
        html += '<div style="margin-bottom:6px">'
            + '<div style="font-weight:700;font-size:0.88em;color:var(--text)">' + (p.title || 'Untitled') + '</div>'
            + (p.reason ? '<div style="font-size:0.78em;color:var(--text-dim);margin-top:2px">"' + p.reason + '"</div>' : '')
            + '<div style="font-size:0.7em;color:var(--text-dim);margin-top:2px">Pitched by ' + (p.pitchedBy || 'someone') + ' · Vote choices are private</div>'
            + '</div>';

        // Vote tally — progress toward pass/fail
        var yesNeeded = Math.max(0, majority - yesCount);
        var noNeeded = Math.max(0, majority - noCount);
        var progressPct = Math.min(100, Math.round((yesCount / majority) * 100));
        var progressColor = yesCount >= majority ? '#22c55e' : (yesCount > 0 ? '#a5b4fc' : 'rgba(255,255,255,0.1)');
        var statusText = yesNeeded === 0 ? 'Passing!' : (noNeeded === 0 ? 'Blocked' : yesNeeded + ' more yes to pass');

        html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px">'
            // Progress bar
            + '<div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:4px;overflow:hidden">'
            + '<div style="height:100%;width:' + progressPct + '%;background:' + progressColor + ';border-radius:2px;transition:width 0.3s"></div></div>'
            // Counts + status
            + '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">'
            + '<div><span style="color:#22c55e">👍 ' + yesCount + '</span>&nbsp; <span style="color:#ef4444">👎 ' + noCount + '</span>&nbsp; <span style="color:var(--text-dim)">🤷 ' + deferCount + '</span></div>'
            + '<div style="font-size:0.9em;font-weight:600;color:' + (yesNeeded === 0 ? '#22c55e' : (noNeeded === 0 ? '#ef4444' : 'var(--text-dim)')) + '">' + statusText + '</div>'
            + '</div>'
            + '<div style="font-size:0.88em;color:var(--text-muted);margin-top:1px">' + totalVotes + ' of ' + memberCount + ' voted · ' + majority + ' yes to pass</div>'
            + '</div>';

        // Tradeoff preview
        if (p.replaceSong) {
            // Check if replacement is in a setlist or rehearsal
            var _slMatches = _pitchFindSetlistsContaining(p.replaceSong);
            var _inAgenda = _pitchIsInRehearsalAgenda(p.replaceSong);
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;padding:6px 8px;background:rgba(255,255,255,0.02);border-radius:4px">'
                + 'If approved: <strong style="color:#22c55e">' + (p.title || '') + '</strong> → Active · <strong style="color:#f59e0b">' + p.replaceSong + '</strong> → Shelved'
                + '</div>';
            var _cardWarnings = [];
            if (_slMatches.length > 0) _cardWarnings.push((_pitchHasUrgentSetlist(_slMatches) ? '🔴 gig soon — ' : '') + 'in setlist: ' + _pitchFormatSetlistWarning(_slMatches));
            if (_inAgenda) _cardWarnings.push('in current rehearsal agenda');
            if (_cardWarnings.length > 0) {
                var _urgentCard = _pitchHasUrgentSetlist(_slMatches);
                html += '<div style="font-size:0.72em;padding:5px 8px;margin-bottom:6px;background:rgba(' + (_urgentCard ? '239,68,68,0.12' : '245,158,11,0.08') + ');border:1px solid rgba(' + (_urgentCard ? '239,68,68,0.25' : '245,158,11,0.2') + ');border-radius:4px;color:' + (_urgentCard ? '#fca5a5' : '#fcd34d') + '">'
                    + '<strong>' + p.replaceSong + '</strong> is ' + _cardWarnings.join(' · ')
                    + '</div>';
            }
        } else {
            // No replacement — expanding Active set
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-bottom:6px;padding:6px 8px;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.12);border-radius:4px">'
                + 'If approved: <strong style="color:#22c55e">' + (p.title || '') + '</strong> → Active · <span style="color:var(--text-muted)">No replacement — Active set expands by 1</span>'
                + '</div>';
        }

        // Vote buttons — min 44px touch targets, wrap on narrow screens
        if (myKey) {
            var _pid = (p.id || '').replace(/'/g, "\\'");
            var _vStyle = function(type, isActive) {
                var colors = { yes: ['34,197,94', '#22c55e'], no: ['239,68,68', '#ef4444'], defer: ['255,255,255', 'var(--text-dim)'] };
                var c = colors[type] || colors.defer;
                return 'font-size:0.78em;padding:8px 14px;border-radius:6px;cursor:pointer;min-height:44px;min-width:44px;border:' + (isActive ? '2px' : '1px') + ' solid rgba(' + c[0] + ',' + (isActive ? '0.6' : '0.2') + ');background:rgba(' + c[0] + ',' + (isActive ? '0.15' : '0.05') + ');color:' + c[1] + ';font-weight:' + (isActive ? '800' : '600');
            };
            html += '<div style="display:flex;gap:8px;flex-wrap:wrap">'
                + '<button onclick="votePitch(\'' + _pid + '\',\'yes\')" style="' + _vStyle('yes', myVote === 'yes') + '">👍 Yes</button>'
                + '<button onclick="votePitch(\'' + _pid + '\',\'no\')" style="' + _vStyle('no', myVote === 'no') + '">👎 No</button>'
                + '<button onclick="votePitch(\'' + _pid + '\',\'defer\')" style="' + _vStyle('defer', myVote === 'defer') + '">🤷 Not now</button>'
                + '</div>';
            if (myVote) {
                var _vLabels = { yes: '👍 Yes', no: '👎 No', defer: '🤷 Not now' };
                html += '<div style="font-size:0.68em;color:var(--text-dim);margin-top:4px">Your vote: <strong>' + (_vLabels[myVote] || myVote) + '</strong> · tap to change</div>';
            }
        }
        html += '</div>';
    });

    // Recently decided (approved + rejected within last 14 days, collapsed)
    var _cutoff = Date.now() - (14 * 24 * 60 * 60 * 1000);
    var recent = pitches.filter(function(p) {
        return (p.status === 'approved' || p.status === 'rejected') && p.decidedAt && new Date(p.decidedAt).getTime() > _cutoff;
    }).sort(function(a, b) { return (b.decidedAt || '').localeCompare(a.decidedAt || ''); });
    if (recent.length > 0) {
        html += '<details style="margin-top:8px"><summary style="font-size:0.75em;color:var(--text-dim);cursor:pointer;padding:6px 0">Recently decided (' + recent.length + ')</summary>';
        recent.forEach(function(p) {
            var icon = p.status === 'approved' ? '✅' : '❌';
            var label = p.status === 'approved' ? 'Approved' : 'Not approved';
            html += '<div style="font-size:0.78em;color:var(--text-dim);padding:6px 8px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.04)">'
                + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + icon + ' ' + (p.title || '') + '</span>'
                + '<span style="font-size:0.85em;white-space:nowrap;color:var(--text-muted)">' + label + ' · ' + _pitchRelativeTime(p.decidedAt) + '</span>'
                + '</div>';
        });
        html += '</details>';
    }

    // Backlog (collapsed) — mobile-friendly tap targets
    if (backlog.length > 0) {
        html += '<details style="margin-top:8px"><summary style="font-size:0.75em;color:var(--text-dim);cursor:pointer;padding:6px 0">Backlog (' + backlog.length + ' songs)</summary>';
        backlog.forEach(function(p) {
            var _time = _pitchRelativeTime(p.decidedAt || p.pitchedAt);
            html += '<div style="font-size:0.8em;color:var(--text-dim);padding:8px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid rgba(255,255,255,0.04)">'
                + '<div style="flex:1;min-width:0"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (p.title || '') + '</div>'
                + (_time ? '<div style="font-size:0.8em;color:var(--text-muted)">' + _time + '</div>' : '')
                + '</div>'
                + '<button onclick="showPitchModal(\'' + (p.title || '').replace(/'/g, "\\'") + '\')" style="font-size:0.75em;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.15);color:var(--accent-light);cursor:pointer;padding:6px 12px;border-radius:5px;min-height:36px;white-space:nowrap">Re-pitch</button>'
                + '</div>';
        });
        html += '</details>';
    }

    html += '</div>';
    container.innerHTML = html;
};

// ── Pitch Modal ──────────────────────────────────────────────────────────────
window.showPitchModal = function(prefillTitle) {
    var existing = document.getElementById('pitchModal');
    if (existing) existing.remove();

    // Build Active song list for replacement picker (sorted by readiness, lowest first)
    var activeSongs = _pitchGetActiveSongsWithReadiness();

    // Find songs already targeted by pending pitches (to exclude from picker)
    var _pendingTargets = {};
    try {
        // Use cached pitches if available; if not, picker still works — just no exclusions
        var _cachedPitches = window._spCachedPitches || [];
        _cachedPitches.forEach(function(p) {
            if (p.status === 'pending' && p.replaceSong) _pendingTargets[p.replaceSong.toLowerCase()] = true;
        });
    } catch(e) {}

    // Build <select> options
    var optionsHtml = '<option value="">None — Active set expands by 1</option>';
    activeSongs.forEach(function(s) {
        var excluded = _pendingTargets[s.title.toLowerCase()];
        var rdLabel = s.avg < 99 ? ' (' + Math.round(s.avg) + '%)' : '';
        var slMatches = _pitchFindSetlistsContaining(s.title);
        var inAgenda = _pitchIsInRehearsalAgenda(s.title);
        var flags = '';
        if (_pitchHasUrgentSetlist(slMatches)) flags += ' [GIG SOON]';
        else if (slMatches.length > 0) flags += ' [IN SETLIST]';
        if (inAgenda) flags += ' [IN REHEARSAL]';
        if (excluded) {
            optionsHtml += '<option value="' + s.title.replace(/"/g, '&quot;') + '" disabled style="color:#666">⛔ ' + s.title + rdLabel + ' — already targeted</option>';
        } else {
            optionsHtml += '<option value="' + s.title.replace(/"/g, '&quot;') + '"' + (flags ? ' style="color:#f59e0b"' : '') + '>' + s.title + rdLabel + flags + '</option>';
        }
    });

    // Pre-select suggested replacement: lowest readiness, not targeted, prefer no setlist, never urgent
    var suggestReplace = '';
    var _suggestFallback = '';
    for (var si = 0; si < activeSongs.length; si++) {
        if (activeSongs[si].avg >= 99 || _pendingTargets[activeSongs[si].title.toLowerCase()]) continue;
        var _slCheck = _pitchFindSetlistsContaining(activeSongs[si].title);
        if (_slCheck.length === 0) { suggestReplace = activeSongs[si].title; break; }
        // Allow non-urgent setlist songs as fallback only
        if (!_suggestFallback && !_pitchHasUrgentSetlist(_slCheck)) _suggestFallback = activeSongs[si].title;
    }
    if (!suggestReplace) suggestReplace = _suggestFallback;

    var activeCount = _pitchActiveCount();

    var modal = document.createElement('div');
    modal.id = 'pitchModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto;-webkit-overflow-scrolling:touch';
    modal.innerHTML = '<div style="background:var(--bg-card,#1e293b);border:1px solid var(--border);border-radius:14px;padding:20px;max-width:480px;width:100%;color:var(--text);margin:auto 0">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">'
        + '<h3 style="margin:0;color:var(--accent-light);font-size:1em">🎤 Pitch a Song</h3>'
        + '<button onclick="document.getElementById(\'pitchModal\').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.4em;padding:8px;min-height:44px;min-width:44px;display:flex;align-items:center;justify-content:center">✕</button>'
        + '</div>'
        + '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:10px">Propose a song for the band to learn. Band members will vote.</div>'
        // Step 1: Song info
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Song Title</label>'
        + '<input id="pitchTitle" value="' + (prefillTitle || '').replace(/"/g, '&quot;') + '" placeholder="e.g. Green Eyed Lady" style="width:100%;padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.88em;box-sizing:border-box;margin-bottom:10px;min-height:44px">'
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Why this song? <span style="font-weight:400">(optional)</span></label>'
        + '<input id="pitchReason" placeholder="e.g. Great crowd-pleaser, easy to learn" style="width:100%;padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text);font-size:0.85em;box-sizing:border-box;margin-bottom:10px;min-height:44px">'
        // Step 2: Tradeoff — starts dimmed, reveals when title has content
        + '<div id="pitchStep2" style="opacity:0.35;pointer-events:none;transition:opacity 0.2s">'
        + '<div style="font-size:0.72em;color:#f59e0b;padding:6px 8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.12);border-radius:6px;margin-bottom:8px">Adding a song means more to practice. Pick a replacement to keep the set focused, or skip to expand.</div>'
        + '<label style="font-size:0.78em;font-weight:700;color:var(--text-muted);display:block;margin-bottom:4px">Replace which Active song? <span style="font-weight:400;color:var(--text-dim)">(' + activeCount + ' Active now)</span></label>'
        + '<select id="pitchReplace" style="width:100%;padding:10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:var(--text);font-size:0.85em;box-sizing:border-box;margin-bottom:4px;min-height:44px;-webkit-appearance:menulist">'
        + optionsHtml
        + '</select>'
        + '<div id="pitchReplaceHint" style="font-size:0.68em;color:var(--text-dim);margin-bottom:10px;min-height:18px"></div>'
        + '</div>'
        + '<button id="pitchSubmitBtn" onclick="submitPitch()" disabled style="width:100%;padding:12px;border-radius:8px;border:1px solid rgba(99,102,241,0.15);background:rgba(99,102,241,0.06);color:rgba(165,180,252,0.4);font-weight:700;cursor:not-allowed;font-size:0.88em;min-height:48px;transition:all 0.2s">Submit Pitch for Vote</button>'
        + '</div>';
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    // Pre-select suggested replacement
    var selectEl = document.getElementById('pitchReplace');
    if (selectEl && suggestReplace) selectEl.value = suggestReplace;

    var ACTIVE_EXPANSION_THRESHOLD = 25;

    // Dynamic hint based on selection
    function _updateReplaceHint() {
        var hint = document.getElementById('pitchReplaceHint');
        if (!hint || !selectEl) return;
        var val = selectEl.value;
        if (!val) {
            // No replacement — show expansion message, warn if above threshold
            if (activeCount >= ACTIVE_EXPANSION_THRESHOLD) {
                hint.innerHTML = '<span style="color:#fbbf24">You already have ' + activeCount + ' Active songs. Adding without replacing may spread the band thin.</span>';
            } else {
                hint.innerHTML = '<span style="color:#86efac">No replacement — Active set will grow to ' + (activeCount + 1) + '.</span>';
            }
        } else {
            var warnings = [];
            var slMatches = _pitchFindSetlistsContaining(val);
            if (slMatches.length > 0) {
                var slText = _pitchFormatSetlistWarning(slMatches);
                var isUrgent = _pitchHasUrgentSetlist(slMatches);
                warnings.push((isUrgent ? '🔴 gig soon — ' : '') + 'in setlist: ' + slText);
            }
            if (_pitchIsInRehearsalAgenda(val)) warnings.push('in current rehearsal agenda');
            if (warnings.length > 0) {
                hint.innerHTML = '<span style="color:#fca5a5">' + warnings.join(' · ') + '</span>';
            } else {
                hint.textContent = 'Lowest readiness in Active set — safe to replace.';
            }
        }
    }
    if (selectEl) {
        selectEl.addEventListener('change', _updateReplaceHint);
        _updateReplaceHint(); // show initial hint
    }

    // Library song hint — show when pitched title matches an existing Library song
    var titleEl = document.getElementById('pitchTitle');
    var titleHint = document.createElement('div');
    titleHint.id = 'pitchTitleHint';
    titleHint.style.cssText = 'font-size:0.68em;margin-top:-6px;margin-bottom:6px';
    if (titleEl) titleEl.parentNode.insertBefore(titleHint, titleEl.nextSibling);
    function _updateTitleHint() {
        if (!titleHint || !titleEl) return;
        var val = titleEl.value.trim();
        if (!val) { titleHint.textContent = ''; return; }
        var match = (typeof allSongs !== 'undefined') ? allSongs.find(function(s) { return s.title.toLowerCase() === val.toLowerCase(); }) : null;
        if (match) {
            var scope = (typeof getSongScope === 'function') ? getSongScope(match.title) : '';
            if (scope === 'library') {
                titleHint.innerHTML = '<span style="color:#93c5fd">This song is in your Library. Pitching will propose activating it.</span>';
            } else if (scope === 'active') {
                titleHint.innerHTML = '<span style="color:#fca5a5">This song is already Active.</span>';
            } else {
                titleHint.textContent = '';
            }
        } else {
            titleHint.textContent = '';
        }
    }
    // Progressive disclosure: reveal step 2 + enable submit when title has content
    var step2 = document.getElementById('pitchStep2');
    var submitBtn = document.getElementById('pitchSubmitBtn');
    function _updateProgressiveState() {
        var hasTitle = titleEl && titleEl.value.trim().length > 0;
        if (step2) {
            step2.style.opacity = hasTitle ? '1' : '0.35';
            step2.style.pointerEvents = hasTitle ? 'auto' : 'none';
        }
        if (submitBtn) {
            submitBtn.disabled = !hasTitle;
            submitBtn.style.cursor = hasTitle ? 'pointer' : 'not-allowed';
            submitBtn.style.borderColor = hasTitle ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.15)';
            submitBtn.style.background = hasTitle ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)';
            submitBtn.style.color = hasTitle ? '#a5b4fc' : 'rgba(165,180,252,0.4)';
        }
    }
    if (titleEl) {
        titleEl.addEventListener('input', function() { _updateTitleHint(); _updateProgressiveState(); });
        _updateTitleHint(); // check prefill
        _updateProgressiveState(); // enable if prefilled
    }

    // Pre-load pitches for conflict exclusion in future opens
    loadBandDataFromDrive('_band', 'song_pitches').then(function(data) {
        window._spCachedPitches = toArray(data || []);
    }).catch(function(){});
};

// ── Submit Pitch ─────────────────────────────────────────────────────────────
window.submitPitch = async function() {
    var title = (document.getElementById('pitchTitle') || {}).value || '';
    var reason = (document.getElementById('pitchReason') || {}).value || '';
    var replaceEl = document.getElementById('pitchReplace');
    var replaceSong = replaceEl ? replaceEl.value : '';
    if (!title.trim()) { alert('Enter a song title'); return; }

    // Guard: check if song is already Active
    if (typeof isSongActive === 'function' && isSongActive(title.trim())) {
        alert(title.trim() + ' is already in your Active set.');
        return;
    }

    // Guard: check if there's already a pending pitch for this song
    var existingPitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    if (existingPitches.some(function(p) { return p.status === 'pending' && p.title.toLowerCase() === title.trim().toLowerCase(); })) {
        alert('There is already a pending pitch for ' + title.trim());
        return;
    }

    // Warn if replacement song is targeted by another pending pitch
    if (replaceSong) {
        var _conflicting = existingPitches.filter(function(p) { return p.status === 'pending' && p.replaceSong && p.replaceSong.toLowerCase() === replaceSong.toLowerCase(); });
        if (_conflicting.length > 0) {
            if (!confirm(replaceSong + ' is already targeted for replacement in another pitch. Continue anyway?')) return;
        }

        // Warn if replacement is in setlist (severity-aware) or rehearsal agenda
        var _slMatches = _pitchFindSetlistsContaining(replaceSong);
        var _inAgenda = _pitchIsInRehearsalAgenda(replaceSong);
        if (_slMatches.length > 0 || _inAgenda) {
            var _warnParts = [];
            if (_slMatches.length > 0) _warnParts.push('in setlist: ' + _pitchFormatSetlistWarning(_slMatches));
            if (_inAgenda) _warnParts.push('in the current rehearsal agenda');
            var _severity = _pitchHasUrgentSetlist(_slMatches) ? '🔴 GIG SOON: ' : '⚠️ ';
            if (!confirm(_severity + replaceSong + ' is ' + _warnParts.join(' and ') + '.\n\nShelving it will affect your plans. Continue?')) return;
        }
    }

    // Soft guard: warn if expanding an already-large Active set
    if (!replaceSong) {
        var _ac = _pitchActiveCount();
        if (_ac >= 25) {
            if (!confirm('Your Active set already has ' + _ac + ' songs. Adding without a replacement means more to practice.\n\nContinue without replacing?')) return;
        }
    }

    var memberKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : 'unknown';
    var memberName = '';
    if (typeof bandMembers !== 'undefined' && bandMembers[memberKey]) memberName = bandMembers[memberKey].name || memberKey;

    var pitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    var newPitch = {
        id: (typeof generateShortId === 'function') ? generateShortId(10) : Date.now().toString(36),
        title: title.trim(),
        reason: reason.trim(),
        replaceSong: replaceSong,
        pitchedBy: memberName || memberKey,
        pitchedAt: new Date().toISOString(),
        status: 'pending',
        votes: {}
    };
    pitches.push(newPitch);
    await saveBandDataToDrive('_band', 'song_pitches', pitches);

    // Cache for conflict exclusion
    window._spCachedPitches = pitches;

    document.getElementById('pitchModal').remove();
    if (typeof showToast === 'function') showToast('Song pitched! Band members can now vote.');

    // Refresh pitch section if visible
    var container = document.getElementById('bcPitchSection');
    if (container) renderSongPitchSection(container);

    // Emit event
    if (typeof GLStore !== 'undefined' && GLStore.emit) GLStore.emit('songPitched', { title: title });
};

// ── Vote on Pitch ────────────────────────────────────────────────────────────
window.votePitch = async function(pitchId, vote) {
    var memberKey = typeof getCurrentMemberKey === 'function' ? getCurrentMemberKey() : null;
    if (!memberKey || !pitchId) return;

    var pitches = toArray(await loadBandDataFromDrive('_band', 'song_pitches') || []);
    var pitch = pitches.find(function(p) { return p.id === pitchId; });
    if (!pitch) return;

    if (!pitch.votes) pitch.votes = {};
    var previousVote = pitch.votes[memberKey] || null;
    pitch.votes[memberKey] = vote;

    // Check if majority reached (simple majority of band members)
    var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;
    var yesCount = Object.values(pitch.votes).filter(function(v) { return v === 'yes'; }).length;
    var noCount = Object.values(pitch.votes).filter(function(v) { return v === 'no'; }).length;
    var majority = Math.ceil(memberCount / 2);

    if (yesCount >= majority) {
        // APPROVED — but warn about setlist/rehearsal impact before finalizing
        if (pitch.replaceSong) {
            var _approveWarnings = [];
            var slMatches = _pitchFindSetlistsContaining(pitch.replaceSong);
            if (slMatches.length > 0) _approveWarnings.push('in setlist: ' + _pitchFormatSetlistWarning(slMatches));
            if (_pitchIsInRehearsalAgenda(pitch.replaceSong)) _approveWarnings.push('in the current rehearsal agenda');
            if (_approveWarnings.length > 0) {
                var _appSev = _pitchHasUrgentSetlist(slMatches) ? '🔴 GIG SOON: ' : '⚠️ ';
                if (!confirm(_appSev + 'Approving this will shelve "' + pitch.replaceSong + '", which is ' + _approveWarnings.join(' and ') + '.\n\nProceed with approval?')) {
                    // Undo this vote — don't lock in an approval the user backed away from
                    delete pitch.votes[memberKey];
                    await saveBandDataToDrive('_band', 'song_pitches', pitches);
                    var _c = document.getElementById('bcPitchSection');
                    if (_c) renderSongPitchSection(_c);
                    return;
                }
            }
        }

        pitch.status = 'approved';
        pitch.decidedAt = new Date().toISOString();

        // Add song to library if not exists, then set to prospect
        if (typeof allSongs !== 'undefined' && !allSongs.find(function(s) { return s.title === pitch.title; })) {
            var customSongs = toArray(await loadBandDataFromDrive('_band', 'custom_songs') || []);
            customSongs.push({ songId: 'c_' + generateShortId(8), title: pitch.title, artist: 'Other', band: 'Other', originType: 'pitch', addedBy: pitch.pitchedBy, addedAt: new Date().toISOString() });
            await saveBandDataToDrive('_band', 'custom_songs', customSongs);
            if (typeof loadCustomSongs === 'function') await loadCustomSongs();
        }
        if (typeof GLStore !== 'undefined' && GLStore.updateSongField) {
            GLStore.updateSongField(pitch.title, 'status', 'prospect');
            // Only shelve replacement if it exists and is currently Active
            if (pitch.replaceSong && typeof isSongActive === 'function' && isSongActive(pitch.replaceSong)) {
                GLStore.updateSongField(pitch.replaceSong, 'status', 'shelved');
            }
        }
        if (typeof renderSongs === 'function') renderSongs();
        _pitchShowApprovalCard(pitch);
    } else if (noCount >= majority) {
        // REJECTED — move to backlog
        pitch.status = 'rejected';
        pitch.decidedAt = new Date().toISOString();
        if (typeof showToast === 'function') showToast(pitch.title + ' was not approved. Moved to backlog.');
    } else {
        // No majority yet — confirm vote to user
        if (typeof showToast === 'function') {
            var _vLabels = { yes: '👍 Yes', no: '👎 No', defer: '🤷 Not now' };
            if (previousVote && previousVote !== vote) {
                showToast('Vote changed to ' + (_vLabels[vote] || vote));
            } else if (!previousVote) {
                showToast('Vote recorded: ' + (_vLabels[vote] || vote));
            }
        }
    }

    await saveBandDataToDrive('_band', 'song_pitches', pitches);

    // Update cache
    window._spCachedPitches = pitches;

    // Refresh
    var container = document.getElementById('bcPitchSection');
    if (container) renderSongPitchSection(container);
};

console.log('✅ song-pitch.js loaded');
