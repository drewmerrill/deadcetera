/**
 * js/features/band-comms.js — Band Communication System v1
 *
 * Phase 1: Song Discussions + Ideas Board
 * Phase 2: Full chat + link locker (future)
 * Phase 3: Video rooms (future — integrate, don't build)
 *
 * Firebase paths:
 *   bands/{slug}/discussions/{songKey}/messages[]
 *   bands/{slug}/ideas/posts[]
 *
 * DEPENDS ON: firebase-service.js, data.js (bandMembers)
 */

'use strict';

// ── Song Discussion ──────────────────────────────────────────────────────────
// Per-song comment thread. Accessed from Song Detail panel.

var _bcPendingMentions = [];

window.renderSongDiscussion = async function(songTitle, container) {
  if (!container || !songTitle) return;
  var songKey = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/[\]]/g, '_');

  container.innerHTML = '<div style="font-size:0.82em;color:var(--text-dim);padding:8px">Loading discussion...</div>';

  var messages = [];
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var snap = await firebaseDB.ref(bandPath('discussions/' + songKey + '/messages')).orderByChild('ts').limitToLast(30).once('value');
      var val = snap.val();
      if (val) messages = Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
    }
  } catch(e) {}

  var memberName = _bcGetName();

  var html = '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Discussion</div>';

  // Mark as seen for notification tracking
  try { localStorage.setItem('bc_seen_disc_' + songKey, String(Date.now())); } catch(e) {}

  if (!messages.length) {
    html += '<div style="font-size:0.8em;color:var(--text-dim);padding:6px 0;font-style:italic">No comments yet — say something to your band. Comments stay attached to this song.</div>';
  } else {
    messages.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
    // Pinned messages first
    var pinned = messages.filter(function(m) { return m.pinned; });
    var unpinned = messages.filter(function(m) { return !m.pinned; });
    if (pinned.length) {
      html += '<div style="margin-bottom:6px">';
      pinned.forEach(function(m) {
        html += '<div style="padding:5px 8px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.15);border-radius:6px;margin-bottom:4px;font-size:0.78em;color:var(--text-muted)">&#x1F4CC; ' + _bcEsc(m.text || '') + ' <span style="font-size:0.8em;color:var(--text-dim)">— ' + _bcEsc(m.author || '') + '</span></div>';
      });
      html += '</div>';
    }
    messages = unpinned;
    html += '<div style="max-height:200px;overflow-y:auto;margin-bottom:8px">';
    messages.forEach(function(m) {
      var timeAgo = _bcTimeAgo(m.ts);
      // Reaction counts
      var reactions = m.reactions || {};
      var rCounts = {};
      Object.values(reactions).forEach(function(e) { rCounts[e] = (rCounts[e] || 0) + 1; });
      var rHTML = ['👍','🔥','😂'].map(function(e) {
        var count = rCounts[e] || 0;
        var msgPath = 'discussions/' + songKey + '/messages/' + m._key;
        return '<button onclick="_bcReact(\'' + msgPath + '\',\'' + e + '\')" style="background:' + (count ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)') + ';border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:1px 5px;cursor:pointer;font-size:0.7em">' + e + (count ? '<span style="font-size:0.85em;margin-left:2px;color:var(--text-dim)">' + count + '</span>' : '') + '</button>';
      }).join('');

      html += '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
        + '<div style="display:flex;align-items:baseline;gap:6px">'
        + '<span style="font-size:0.78em;font-weight:700;color:var(--text)">' + _bcEsc(m.author || 'Anonymous') + '</span>'
        + '<span style="font-size:0.62em;color:var(--text-dim)">' + timeAgo + '</span>'
        + '</div>'
        + '<div style="font-size:0.82em;color:var(--text-muted);margin-top:2px">' + _bcRenderMentions(_bcEsc(m.text || ''), m.mentions) + '</div>'
        + '<div style="display:flex;gap:3px;margin-top:3px;align-items:center">' + rHTML
        + '<button onclick="_bcPinMsg(\'' + songKey + '\',\'' + m._key + '\')" style="margin-left:auto;background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.65em;padding:1px 4px" title="Pin message">&#x1F4CC;</button>'
        + '</div>'
        + '</div>';
    });
    html += '</div>';
  }

  // Input
  var safeSong = songTitle.replace(/'/g, "\\'");
  html += '<div style="display:flex;gap:6px">';
  html += '<input id="bcDiscussionInput" placeholder="Add a comment..." style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:6px 8px;border-radius:6px;font-size:0.8em;font-family:inherit">';
  html += '<button onclick="_bcPostComment(\'' + safeSong + '\')" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:0.75em;font-weight:700;white-space:nowrap">Send</button>';
  html += '</div>';

  container.innerHTML = html;
  _bcPendingMentions = [];
  _bcWireMentionInput(songTitle);
};

// ── @Mention rendering ───────────────────────────────────────────────────────
function _bcRenderMentions(escapedText, mentions) {
  if (mentions && mentions.length) {
    mentions.forEach(function(m) {
      var re = new RegExp('@' + m.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      escapedText = escapedText.replace(re, '<span style="color:#818cf8;font-weight:600">@' + m.displayName + '</span>');
    });
    return escapedText;
  }
  // Fallback: regex highlight for legacy comments without structured mentions
  return escapedText.replace(/@(\w+)/g, '<span style="color:#818cf8;font-weight:600">@$1</span>');
}

// ── @Mention input wiring ────────────────────────────────────────────────────
function _bcWireMentionInput(songTitle) {
  var input = document.getElementById('bcDiscussionInput');
  if (!input) return;
  var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
  if (!members.length) return;

  input.addEventListener('input', function() {
    var val = input.value;
    var cursorPos = input.selectionStart || val.length;
    var textBefore = val.substring(0, cursorPos);
    var match = textBefore.match(/@(\w*)$/);
    var existing = document.getElementById('bcMentionDropdown');

    if (!match) {
      if (existing) existing.remove();
      return;
    }
    var partial = match[1].toLowerCase();
    var filtered = members.filter(function(m) {
      var firstName = (m.name || m.key || '').split(' ')[0].toLowerCase();
      return firstName.indexOf(partial) === 0 || (m.key || '').toLowerCase().indexOf(partial) === 0;
    });
    if (!filtered.length) { if (existing) existing.remove(); return; }

    if (!existing) {
      existing = document.createElement('div');
      existing.id = 'bcMentionDropdown';
      existing.style.cssText = 'position:absolute;bottom:100%;left:0;right:0;background:#1e293b;border:1px solid rgba(99,102,241,0.25);border-radius:8px;z-index:100;max-height:160px;overflow-y:auto;margin-bottom:4px';
      input.parentElement.style.position = 'relative';
      input.parentElement.appendChild(existing);
    }
    existing.innerHTML = filtered.map(function(m, i) {
      var firstName = (m.name || m.key).split(' ')[0];
      return '<div class="bc-mention-item" data-idx="' + i + '" style="padding:6px 10px;cursor:pointer;font-size:0.82em;display:flex;align-items:center;gap:6px;color:var(--text)" '
        + 'onmouseenter="this.style.background=\'rgba(99,102,241,0.15)\'" onmouseleave="this.style.background=\'none\'">'
        + '<span>' + (m.emoji || '') + '</span><span style="font-weight:600">' + firstName + '</span>'
        + '<span style="font-size:0.75em;color:var(--text-dim)">' + (m.name || m.key) + '</span>'
        + '</div>';
    }).join('');

    existing.querySelectorAll('.bc-mention-item').forEach(function(item, i) {
      item.addEventListener('mousedown', function(e) {
        e.preventDefault();
        var m = filtered[i];
        var firstName = (m.name || m.key).split(' ')[0];
        var beforeAt = textBefore.substring(0, match.index);
        var afterCursor = val.substring(cursorPos);
        input.value = beforeAt + '@' + firstName + ' ' + afterCursor;
        input.focus();
        var newPos = (beforeAt + '@' + firstName + ' ').length;
        input.setSelectionRange(newPos, newPos);
        _bcPendingMentions.push({ userId: m.key, displayName: firstName });
        existing.remove();
      });
    });
  });

  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var dd = document.getElementById('bcMentionDropdown');
      if (dd) dd.remove();
    }
  });
}

window._bcPostComment = async function(songTitle) {
  var input = document.getElementById('bcDiscussionInput');
  if (!input || !input.value.trim()) return;
  var songKey = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/[\]]/g, '_');
  var name = _bcGetName();

  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var payload = {
        author: name,
        text: input.value.trim(),
        ts: new Date().toISOString()
      };
      if (_bcPendingMentions.length) payload.mentions = _bcPendingMentions.slice();
      await firebaseDB.ref(bandPath('discussions/' + songKey + '/messages')).push(payload);
      // Emit mention notification
      if (_bcPendingMentions.length && typeof GLStore !== 'undefined' && GLStore.emit) {
        GLStore.emit('mentionNotification', { song: songTitle, mentions: _bcPendingMentions, author: name });
      }
      _bcPendingMentions = [];
      input.value = '';
      // Re-render
      var container = input.closest('[id]') || input.parentElement.parentElement;
      if (container) window.renderSongDiscussion(songTitle, container);
      if (typeof showToast === 'function') showToast('Comment posted');
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Failed to post: ' + e.message);
  }
};

// ── Ideas Board ──────────────────────────────────────────────────────────────
// Band-wide idea sharing. Accessed from a dedicated page.

function renderIdeasBoardPage(el) {
  if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'ideas');
  // Band Room: action-first structure
  // Section tabs: Needs Votes | Open Ideas | Polls | Decisions | Archive
  el.innerHTML = '<div class="gl-page">'
    + '<div class="gl-page-title">\uD83C\uDFB8 Band Room</div>'
    + '<div class="gl-page-sub">Decisions, polls, and ideas</div>'
    + '<div class="gl-page-split">'
    + '<div class="gl-page-primary">'
    + '<div id="bcQuickCreate" style="margin-bottom:12px"></div>'
    + '<div id="bcNeedsVotes"></div>'
    + '<div id="bcOpenIdeas"></div>'
    + '<div id="bcPollsSection"></div>'
    + '</div>'
    + '<div class="gl-page-context">'
    + '<div id="bcDecisions"></div>'
    + '<div id="bcBriefContainer" style="margin-top:10px"></div>'
    + '</div>'
    + '</div></div>';

  _bcLoadBandRoom();

  setTimeout(function() {
    var briefContainer = document.getElementById('bcBriefContainer');
    if (briefContainer && typeof renderRehearsalBrief === 'function') renderRehearsalBrief(briefContainer);
  }, 100);
}

// ── Unified Band Room loader ──────────────────────────────────────────────────
async function _bcLoadBandRoom() {
  var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
  var myVoteKey = fas ? fas.getMyVoteKey() : _bcGetName();
  var memberCount = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED.length : 5;

  // Load all data in parallel
  var polls = [], ideas = [], pitches = [];
  try {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (db && typeof bandPath === 'function') {
      var results = await Promise.all([
        db.ref(bandPath('polls')).orderByChild('ts').limitToLast(20).once('value'),
        db.ref(bandPath('ideas/posts')).orderByChild('ts').limitToLast(50).once('value'),
        (typeof loadBandDataFromDrive === 'function' ? loadBandDataFromDrive('_band', 'song_pitches').catch(function() { return null; }) : Promise.resolve(null))
      ]);
      var pVal = results[0].val();
      if (pVal) polls = Object.entries(pVal).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
      var iVal = results[1].val();
      if (iVal) ideas = Object.entries(iVal).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
      pitches = (typeof toArray === 'function') ? toArray(results[2] || []) : (results[2] || []);
    }
  } catch(e) { console.warn('[BandRoom] Load error:', e.message); }

  polls.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
  ideas.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });

  // Categorize polls
  var unvotedPolls = [], votedPolls = [], completedPolls = [];
  polls.forEach(function(p) {
    var vc = p.votes ? Object.keys(p.votes).length : 0;
    var allVoted = vc >= memberCount;
    var iVoted = !!(myVoteKey && p.votes && p.votes[myVoteKey] !== undefined);
    p._iVoted = iVoted;
    p._allVoted = allVoted;
    p._voteCount = vc;
    if (allVoted) completedPolls.push(p);
    else if (!iVoted) unvotedPolls.push(p);
    else votedPolls.push(p);
  });

  // Categorize pitches
  var unvotedPitches = [], decidedPitches = [];
  var myMemberKey = fas ? fas.getMyMemberKey() : null;
  pitches.forEach(function(pitch) {
    if (!pitch || pitch.status === 'rejected' || pitch.status === 'deferred') { decidedPitches.push(pitch); return; }
    if (pitch.status === 'approved') { decidedPitches.push(pitch); return; }
    var iVoted = !!(myMemberKey && pitch.votes && pitch.votes[myMemberKey]);
    if (!iVoted) unvotedPitches.push(pitch);
    else decidedPitches.push(pitch);
  });

  // Categorize ideas
  var openIdeas = [], convertedIdeas = [];
  ideas.forEach(function(idea) {
    if (idea.convertedToPitch) convertedIdeas.push(idea);
    else openIdeas.push(idea);
  });

  var needsVotesCount = unvotedPolls.length + unvotedPitches.length;
  var decisionsCount = completedPolls.length + decidedPitches.length + convertedIdeas.length;
  var fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
  var recentDecisions = completedPolls.filter(function(p) { return (p.ts || '') >= fourteenDaysAgo; });

  // ── Quick Create — always visible, minimal ──
  var qcEl = document.getElementById('bcQuickCreate');
  if (qcEl) {
    qcEl.innerHTML = '<div style="display:flex;gap:6px;margin-bottom:4px">'
      + '<input id="bcIdeaTitle" placeholder="Post an idea or song\u2026" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:7px 10px;border-radius:8px;font-size:0.82em;font-family:inherit;box-sizing:border-box">'
      + '<button onclick="_bcPostIdea()" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:#86efac;padding:6px 14px;border-radius:8px;cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap">Post</button>'
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center">'
      + '<input id="bcIdeaLink" placeholder="Link (optional)" style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:var(--text-muted);padding:5px 8px;border-radius:6px;font-size:0.72em;font-family:inherit;box-sizing:border-box">'
      + '<button onclick="document.getElementById(\'bcPollForm\').style.display=document.getElementById(\'bcPollForm\').style.display===\'none\'?\'block\':\'none\'" style="font-size:0.68em;color:var(--text-dim);background:none;border:1px solid rgba(255,255,255,0.06);padding:4px 8px;border-radius:6px;cursor:pointer">\uD83D\uDDF3\uFE0F Poll</button>'
      + '</div>'
      + '<div id="bcPollForm" style="display:none;margin-top:8px;padding:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px">'
      + '<input id="bcPollQ" placeholder="Question\u2026" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:5px 8px;border-radius:5px;font-size:0.78em;font-family:inherit;margin-bottom:4px;box-sizing:border-box">'
      + '<input id="bcPollOpts" placeholder="Options (comma-separated)" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:5px 8px;border-radius:5px;font-size:0.78em;font-family:inherit;margin-bottom:4px;box-sizing:border-box">'
      + '<button onclick="_bcCreatePoll()" style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);color:#86efac;padding:4px 12px;border-radius:5px;cursor:pointer;font-size:0.72em;font-weight:700">Create Poll</button>'
      + '</div>';
  }

  // ── Needs Votes — flows naturally at top ──
  var nvEl = document.getElementById('bcNeedsVotes');
  if (nvEl) {
    var nvHtml = '';
    if (needsVotesCount > 0) {
      nvHtml += '<div style="margin-bottom:16px;border-left:3px solid #f59e0b;padding-left:12px">';
      // Unvoted polls
      unvotedPolls.forEach(function(p) {
        nvHtml += _bcRenderPollCard(p, myVoteKey, memberCount, true);
      });
      // Unvoted pitches
      unvotedPitches.forEach(function(pitch) {
        nvHtml += '<div style="padding:10px;background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.15);border-radius:8px;margin-bottom:8px">'
          + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
          + '<span style="font-size:0.85em">\uD83C\uDFB5</span>'
          + '<span style="font-weight:700;font-size:0.85em;color:var(--text)">Song Pitch: ' + _bcEsc(pitch.title || '') + '</span>'
          + '</div>'
          + (pitch.reason ? '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:8px">' + _bcEsc(pitch.reason) + '</div>' : '')
          + '<div style="display:flex;gap:6px">'
          + '<button onclick="showPage(\'ideas\')" style="font-size:0.78em;font-weight:700;padding:6px 16px;border-radius:6px;cursor:pointer;border:1px solid rgba(99,102,241,0.3);background:rgba(99,102,241,0.1);color:#a5b4fc">Review Pitch</button>'
          + '</div></div>';
      });
      nvHtml += '</div>';
    } else {
      // All clear — minimal, no heavy box
      nvHtml += '<div style="font-size:0.75em;color:var(--text-dim);padding:8px 0">\u2705 All votes cast</div>';
    }
    nvEl.innerHTML = nvHtml;
  }

  // ── Render Open Ideas ──
  var ideasEl = document.getElementById('bcOpenIdeas');
  if (ideasEl) {
    var idHtml = '';
    if (openIdeas.length > 0) {
      idHtml += '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;padding-top:8px">Ideas</div>';
      openIdeas.forEach(function(p) {
        var linkHTML = '';
        if (p.link) {
          var isYT = p.link.indexOf('youtube') >= 0 || p.link.indexOf('youtu.be') >= 0;
          var isSP = p.link.indexOf('spotify') >= 0;
          var linkIcon = isYT ? '\u25B6\uFE0F' : isSP ? '\uD83C\uDFB5' : '\uD83D\uDD17';
          linkHTML = '<a href="' + _bcEsc(p.link) + '" target="_blank" rel="noopener" style="font-size:0.75em;color:#818cf8;text-decoration:none;display:inline-flex;align-items:center;gap:3px">' + linkIcon + ' ' + (isYT ? 'YouTube' : isSP ? 'Spotify' : 'Link') + '</a>';
        }
        idHtml += '<div style="padding:10px 12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:6px">';
        idHtml += '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">';
        idHtml += '<span style="font-weight:700;font-size:0.85em;color:var(--text)">' + _bcEsc(p.title || 'Untitled') + '</span>';
        idHtml += linkHTML + '</div>';
        idHtml += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">';
        idHtml += '<span style="font-size:0.68em;color:var(--text-dim)">' + _bcEsc(p.author || '') + ' \u00B7 ' + _bcTimeAgo(p.ts) + '</span>';
        var safeTitle = (p.title || '').replace(/'/g, "\\'");
        var safeAuthor = (p.author || 'Ideas Board').replace(/'/g, "\\'");
        var safeKey = (p._key || '').replace(/'/g, "\\'");
        // Contextual actions menu
        var _imId = 'bcIdeaMenu_' + safeKey;
        idHtml += '<div style="position:relative">';
        idHtml += '<button onclick="event.stopPropagation();_bcToggleIdeaMenu(\'' + _imId + '\')" style="background:transparent;border:1px solid var(--gl-border,rgba(255,255,255,0.05));color:var(--gl-text-secondary,#94a3b8);border-radius:5px;padding:1px 6px;cursor:pointer;font-size:0.72em">\u22EF</button>';
        idHtml += '<div id="' + _imId + '" style="display:none;position:absolute;top:calc(100% + 4px);right:0;min-width:140px;background:var(--bg-card,#1e293b);border:1px solid var(--gl-border,rgba(255,255,255,0.05));border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);padding:4px;z-index:20">';
        idHtml += '<button onclick="_bcConvertToPitch(\'' + safeTitle + '\',\'' + safeAuthor + '\',\'' + safeKey + '\')" style="display:block;width:100%;text-align:left;padding:5px 8px;font-size:0.75em;border:none;background:none;color:var(--gl-text-secondary);cursor:pointer;border-radius:4px" onmouseover="this.style.background=\'var(--gl-hover)\'" onmouseout="this.style.background=\'none\'">\uD83D\uDDF3\uFE0F Create poll</button>';
        idHtml += '<button onclick="selectSong(\'' + safeTitle + '\')" style="display:block;width:100%;text-align:left;padding:5px 8px;font-size:0.75em;border:none;background:none;color:var(--gl-text-secondary);cursor:pointer;border-radius:4px" onmouseover="this.style.background=\'var(--gl-hover)\'" onmouseout="this.style.background=\'none\'">\uD83C\uDFB5 Link to song</button>';
        idHtml += '<button onclick="showPage(\'rehearsal\')" style="display:block;width:100%;text-align:left;padding:5px 8px;font-size:0.75em;border:none;background:none;color:var(--gl-text-secondary);cursor:pointer;border-radius:4px" onmouseover="this.style.background=\'var(--gl-hover)\'" onmouseout="this.style.background=\'none\'">\uD83C\uDFAF Add to plan</button>';
        idHtml += '</div></div>';
        idHtml += '</div></div>';
      });
    }
    ideasEl.innerHTML = idHtml;
  }

  // ── Render Polls (active, voted) ──
  var pollsEl = document.getElementById('bcPollsSection');
  if (pollsEl) {
    var pollHtml = '';
    if (votedPolls.length > 0) {
      pollHtml += '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;padding-top:8px">Waiting on band</div>';
      votedPolls.forEach(function(p) { pollHtml += _bcRenderPollCard(p, myVoteKey, memberCount, false); });
    }
    pollsEl.innerHTML = pollHtml;
  }

  // ── Render Recent Decisions (compact, read-only) ──
  var decEl = document.getElementById('bcDecisions');
  if (decEl) {
    var decHtml = '';
    var allDecisions = [];
    recentDecisions.forEach(function(p) {
      // Find winning option
      var winner = '';
      if (p.pollOptions && p.votes) {
        var vc = {};
        Object.values(p.votes).forEach(function(v) { vc[v] = (vc[v] || 0) + 1; });
        var topIdx = 0, topC = 0;
        Object.keys(vc).forEach(function(k) { if (vc[k] > topC) { topC = vc[k]; topIdx = parseInt(k); } });
        if (p.pollOptions[topIdx]) winner = p.pollOptions[topIdx] + ' (' + topC + '/' + p._voteCount + ')';
      }
      allDecisions.push({ text: _bcEsc(p.question || ''), result: winner ? '\u2192 ' + _bcEsc(winner) : '\u2705', ts: p.ts, type: 'poll' });
    });
    decidedPitches.forEach(function(pitch) {
      if (!pitch) return;
      var statusLabel = { approved: '\u2705 Approved', rejected: '\u274C Rejected', deferred: '\u23F8\uFE0F Deferred' }[pitch.status] || '\u2705';
      allDecisions.push({ text: '\uD83C\uDFB5 ' + _bcEsc(pitch.title || ''), result: statusLabel, ts: pitch.ts || '', type: 'pitch' });
    });
    convertedIdeas.forEach(function(idea) {
      allDecisions.push({ text: '\uD83D\uDCA1 ' + _bcEsc(idea.title || ''), result: '\u2192 Pitched', ts: idea.convertedAt || idea.ts || '', type: 'idea' });
    });
    allDecisions.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });

    if (allDecisions.length > 0) {
      decHtml += '<details><summary style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;padding:4px 0;list-style:none;display:flex;align-items:center;gap:6px">'
        + '<span style="font-size:1em">\u25B8</span>'
        + 'Recent Decisions (' + allDecisions.length + ')</summary>'
        + '<div style="padding-top:6px">';
      allDecisions.slice(0, 10).forEach(function(d) {
        decHtml += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.78em;border-bottom:1px solid rgba(255,255,255,0.03)">'
          + '<span style="color:var(--text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + d.text + '</span>'
          + '<span style="color:var(--text-dim);font-size:0.85em;flex-shrink:0">' + d.result + '</span>'
          + '</div>';
      });
      decHtml += '</div></details>';
    }
    decEl.innerHTML = decHtml;
  }

  // Quick create is rendered at top — no separate create section needed
}

// ── Poll card renderer — shared between Needs Votes and Waiting sections ──
function _bcRenderPollCard(p, myVoteKey, memberCount, showCta) {
  var votes = p.votes || {};
  var myVote = votes[myVoteKey];
  var remaining = memberCount - (p._voteCount || 0);
  var statusLine = p._iVoted
    ? '<span style="color:var(--text-dim)">You voted \u00B7 ' + remaining + ' remaining</span>'
    : '<span style="color:#fbbf24;font-weight:700">' + remaining + ' of ' + memberCount + ' need to vote</span>';
  var html = '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:8px">';
  html += '<div style="font-weight:700;font-size:0.85em;color:var(--text);margin-bottom:6px">' + _bcEsc(p.question || '') + '</div>';
  (p.options || []).forEach(function(opt, i) {
    var count = Object.values(votes).filter(function(v) { return v === i; }).length;
    var isMyVote = myVote === i;
    html += '<div onclick="_bcVotePoll(\'' + p._key + '\',' + i + ')" style="display:flex;align-items:center;gap:8px;padding:4px 8px;margin-bottom:3px;border-radius:4px;cursor:pointer;background:' + (isMyVote ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (isMyVote ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)') + '">';
    html += '<span style="flex:1;font-size:0.8em;color:var(--text-muted)">' + _bcEsc(opt) + '</span>';
    html += '<span style="font-size:0.72em;font-weight:700;color:' + (isMyVote ? '#a5b4fc' : 'var(--text-dim)') + '">' + count + '</span>';
    html += '</div>';
  });
  html += '<div style="font-size:0.62em;color:var(--text-dim);margin-top:4px;display:flex;justify-content:space-between">';
  html += statusLine;
  html += '<span>' + _bcEsc(p.author || '') + ' \u00B7 ' + _bcTimeAgo(p.ts) + '</span>';
  html += '</div></div>';
  return html;
}

async function _bcLoadIdeas() {
  var container = document.getElementById('bcIdeasContainer');
  if (!container) return;

  var posts = [];
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var snap = await firebaseDB.ref(bandPath('ideas/posts')).orderByChild('ts').limitToLast(50).once('value');
      var val = snap.val();
      if (val) posts = Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
    }
  } catch(e) {}

  posts.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
  var name = _bcGetName();

  var html = '';

  // New idea input
  html += '<div style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin-bottom:16px">';
  html += '<input id="bcIdeaTitle" placeholder="Song title or idea..." style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:8px 10px;border-radius:6px;font-size:0.88em;font-family:inherit;margin-bottom:6px;box-sizing:border-box">';
  html += '<div style="display:flex;gap:6px">';
  html += '<input id="bcIdeaLink" placeholder="YouTube / Spotify link (optional)" style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:6px 8px;border-radius:6px;font-size:0.78em;font-family:inherit;box-sizing:border-box">';
  html += '<button onclick="_bcPostIdea()" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:0.78em;font-weight:700;white-space:nowrap">Post Idea</button>';
  html += '</div></div>';

  // Posts
  if (!posts.length) {
    html += '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:0.85em">No ideas yet. Be the first to suggest something.</div>';
  } else {
    posts.forEach(function(p) {
      var linkHTML = '';
      if (p.link) {
        var isYT = p.link.indexOf('youtube') >= 0 || p.link.indexOf('youtu.be') >= 0;
        var isSP = p.link.indexOf('spotify') >= 0;
        var linkIcon = isYT ? '▶️' : isSP ? '🎵' : '🔗';
        linkHTML = '<a href="' + _bcEsc(p.link) + '" target="_blank" rel="noopener" style="font-size:0.75em;color:#818cf8;text-decoration:none;display:inline-flex;align-items:center;gap:3px">' + linkIcon + ' ' + (isYT ? 'YouTube' : isSP ? 'Spotify' : 'Link') + '</a>';
      }
      html += '<div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:8px">';
      html += '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:4px">';
      html += '<span style="font-weight:700;font-size:0.9em;color:var(--text)">' + _bcEsc(p.title || 'Untitled') + '</span>';
      html += linkHTML;
      html += '</div>';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:6px">';
      html += '<span style="font-size:0.72em;color:var(--text-dim)">' + _bcEsc(p.author || 'Anonymous') + ' · ' + _bcTimeAgo(p.ts) + '</span>';
      if (p.convertedToPitch) {
        html += '<button onclick="_bcScrollToPitch(\'' + (p.convertedPitchId || '').replace(/'/g, "\\'") + '\')" style="font-size:0.65em;color:#22c55e;font-weight:600;background:none;border:none;cursor:pointer;padding:0">✅ Open Pitch ↑</button>';
      } else {
        var safeTitle = (p.title || '').replace(/'/g, "\\'");
        var safeAuthor = (p.author || 'Ideas Board').replace(/'/g, "\\'");
        var safeKey = (p._key || '').replace(/'/g, "\\'");
        html += '<button onclick="_bcConvertToPitch(\'' + safeTitle + '\',\'' + safeAuthor + '\',\'' + safeKey + '\')" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.06);color:#a5b4fc;cursor:pointer;font-weight:600;white-space:nowrap">Convert to Pitch</button>';
      }
      html += '</div>';
      if (p.note) html += '<div style="font-size:0.8em;color:var(--text-muted);margin-top:4px">' + _bcEsc(p.note) + '</div>';
      html += '</div>';
    });
  }

  container.innerHTML = html;
}

// Scroll to a pitch card in the Song Pitches section
window._bcScrollToPitch = function(pitchId) {
    var pitchSection = document.getElementById('bcPitchSection');
    if (pitchSection) {
        pitchSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Brief highlight flash
        pitchSection.style.outline = '2px solid rgba(34,197,94,0.4)';
        pitchSection.style.outlineOffset = '4px';
        setTimeout(function() { pitchSection.style.outline = ''; pitchSection.style.outlineOffset = ''; }, 1500);
    }
};

// Convert an Ideas Board post to a formal Song Pitch
window._bcConvertToPitch = function(title, originalAuthor, ideaKey) {
    // Open pitch modal prefilled
    if (typeof showPitchModal === 'function') {
        showPitchModal(title);
        // After modal opens, inject attribution into the reason field
        setTimeout(function() {
            var reasonEl = document.getElementById('pitchReason');
            if (reasonEl && !reasonEl.value) {
                reasonEl.value = 'Originally suggested by ' + (originalAuthor || 'a band member') + ' via Ideas Board';
            }
        }, 100);
    }
    // Store the idea key so we can mark it converted after pitch is submitted
    window._bcConvertingIdeaKey = ideaKey || null;
    // Also store on window so submitPitch can embed the source idea reference in the pitch
    window._bcConvertingIdeaTitle = title || null;
};

// Hook: after a pitch is submitted, mark the source idea with full metadata
var _origSubmitPitch = window.submitPitch;
if (typeof _origSubmitPitch === 'function') {
    window.submitPitch = async function() {
        await _origSubmitPitch();
        if (window._bcConvertingIdeaKey && typeof firebaseDB !== 'undefined' && typeof bandPath === 'function') {
            try {
                var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : 'unknown';
                var pitchId = window._lastCreatedPitchId || null;
                await firebaseDB.ref(bandPath('ideas/posts/' + window._bcConvertingIdeaKey)).update({
                    convertedToPitch: true,
                    convertedPitchId: pitchId,
                    convertedAt: new Date().toISOString(),
                    convertedBy: memberKey
                });
            } catch(e) {}
            window._bcConvertingIdeaKey = null;
            _bcLoadBandRoom();
        }
    };
}

window._bcPostIdea = async function() {
  var titleEl = document.getElementById('bcIdeaTitle');
  var linkEl = document.getElementById('bcIdeaLink');
  if (!titleEl || !titleEl.value.trim()) { if (typeof showToast === 'function') showToast('Enter a song title or idea'); return; }

  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      // Auto-detect links in title text
      var titleText = titleEl.value.trim();
      var autoLink = (linkEl && linkEl.value.trim()) || '';
      if (!autoLink) {
        var urlMatch = titleText.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) { autoLink = urlMatch[1]; titleText = titleText.replace(urlMatch[1], '').trim(); }
      }
      await firebaseDB.ref(bandPath('ideas/posts')).push({
        title: titleText,
        link: autoLink,
        author: _bcGetName(),
        ts: new Date().toISOString()
      });
      titleEl.value = '';
      if (linkEl) linkEl.value = '';
      _bcLoadBandRoom();
      if (typeof showToast === 'function') showToast('💡 Idea posted!');
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Failed: ' + e.message);
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function _bcGetName() {
  // 1. Try explicit member selection (Settings → "Who are you?")
  var cu = localStorage.getItem('deadcetera_current_user') || '';
  if (typeof bandMembers !== 'undefined' && bandMembers[cu]) return bandMembers[cu].name;
  // 2. Try email → member lookup (works if signed in with Google)
  if (typeof currentUserEmail !== 'undefined' && currentUserEmail && typeof getCurrentMemberKey === 'function') {
    var key = getCurrentMemberKey();
    if (key && typeof bandMembers !== 'undefined' && bandMembers[key]) return bandMembers[key].name;
  }
  // 3. Try Google display name
  if (typeof currentUserName !== 'undefined' && currentUserName) return currentUserName;
  // 4. Try email prefix as last resort
  if (typeof currentUserEmail !== 'undefined' && currentUserEmail && currentUserEmail !== 'unknown') {
    return currentUserEmail.split('@')[0];
  }
  return 'Anonymous';
}

function _bcTimeAgo(ts) {
  if (!ts) return '';
  try {
    var diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 2) return 'just now';
    if (diff < 60) return diff + 'm ago';
    var h = Math.floor(diff / 60);
    if (h < 24) return h + 'h ago';
    return Math.floor(h / 24) + 'd ago';
  } catch(e) { return ''; }
}

function _bcEsc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event Comment Threads (Phase 2) ──────────────────────────────────────────
// Attach comments to rehearsals or gigs by eventId.
// Firebase: bands/{slug}/events/{eventId}/comments[]

window.renderEventComments = async function(eventId, container, label) {
  if (!container || !eventId) return;
  container.innerHTML = '<div style="font-size:0.82em;color:var(--text-dim);padding:4px">Loading comments...</div>';

  var messages = [];
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var snap = await firebaseDB.ref(bandPath('events/' + eventId + '/comments')).orderByChild('ts').limitToLast(30).once('value');
      var val = snap.val();
      if (val) messages = Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
    }
  } catch(e) {}
  messages.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });

  var html = '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px">' + _bcEsc(label || 'Comments') + '</div>';
  if (!messages.length) {
    html += '<div style="font-size:0.78em;color:var(--text-dim);font-style:italic;padding:4px 0">No comments yet — say something to your band.</div>';
  } else {
    html += '<div style="max-height:180px;overflow-y:auto;margin-bottom:6px">';
    messages.forEach(function(m) {
      html += '<div style="padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
        + '<span style="font-size:0.75em;font-weight:700;color:var(--text)">' + _bcEsc(m.author || '') + '</span>'
        + '<span style="font-size:0.6em;color:var(--text-dim);margin-left:6px">' + _bcTimeAgo(m.ts) + '</span>'
        + '<div style="font-size:0.78em;color:var(--text-muted);margin-top:1px">' + _bcEsc(m.text || '') + '</div>'
        + '</div>';
    });
    html += '</div>';
  }
  var safeId = eventId.replace(/'/g, "\\'");
  html += '<div style="display:flex;gap:4px"><input id="bcEventInput_' + eventId + '" placeholder="Add comment..." style="flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:5px 8px;border-radius:5px;font-size:0.78em;font-family:inherit">';
  html += '<button onclick="_bcPostEventComment(\'' + safeId + '\')" style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.25);color:#a5b4fc;padding:4px 10px;border-radius:5px;cursor:pointer;font-size:0.72em;font-weight:700">Send</button></div>';
  container.innerHTML = html;
};

window._bcPostEventComment = async function(eventId) {
  var input = document.getElementById('bcEventInput_' + eventId);
  if (!input || !input.value.trim()) return;
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      await firebaseDB.ref(bandPath('events/' + eventId + '/comments')).push({
        author: _bcGetName(), text: input.value.trim(), ts: new Date().toISOString()
      });
      input.value = '';
      var container = input.closest('[id]') || input.parentElement.parentElement;
      if (container) window.renderEventComments(eventId, container);
    }
  } catch(e) {}
};

// ── Polls (Phase 2) ──────────────────────────────────────────────────────────
// Firebase: bands/{slug}/polls/{pollId}

window.renderPollWidget = async function(container) {
  if (!container) return;
  var polls = [];
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var snap = await firebaseDB.ref(bandPath('polls')).orderByChild('ts').limitToLast(5).once('value');
      var val = snap.val();
      if (val) polls = Object.entries(val).map(function(e) { return Object.assign({ _key: e[0] }, e[1]); });
    }
  } catch(e) {}
  polls.sort(function(a, b) { return (b.ts || '').localeCompare(a.ts || ''); });
  var userId = _bcGetName();

  var html = '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px">Polls</div>';

  // Create poll form
  html += '<div style="margin-bottom:12px"><input id="bcPollQ" placeholder="Ask a question..." style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:5px 8px;border-radius:5px;font-size:0.78em;font-family:inherit;margin-bottom:4px;box-sizing:border-box">';
  html += '<input id="bcPollOpts" placeholder="Options (comma-separated)" style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:5px 8px;border-radius:5px;font-size:0.78em;font-family:inherit;margin-bottom:4px;box-sizing:border-box">';
  html += '<button onclick="_bcCreatePoll()" style="background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:4px 12px;border-radius:5px;cursor:pointer;font-size:0.72em;font-weight:700">Create Poll</button></div>';

  // Existing polls
  polls.forEach(function(p) {
    html += '<div style="padding:10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:8px">';
    html += '<div style="font-weight:700;font-size:0.85em;color:var(--text);margin-bottom:6px">' + _bcEsc(p.question) + '</div>';
    var votes = p.votes || {};
    var myVote = votes[userId];
    (p.options || []).forEach(function(opt, i) {
      var count = Object.values(votes).filter(function(v) { return v === i; }).length;
      var isMyVote = myVote === i;
      html += '<div onclick="_bcVotePoll(\'' + p._key + '\',' + i + ')" style="display:flex;align-items:center;gap:8px;padding:4px 8px;margin-bottom:3px;border-radius:4px;cursor:pointer;background:' + (isMyVote ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.02)') + ';border:1px solid ' + (isMyVote ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)') + '">';
      html += '<span style="flex:1;font-size:0.8em;color:var(--text-muted)">' + _bcEsc(opt) + '</span>';
      html += '<span style="font-size:0.72em;font-weight:700;color:' + (isMyVote ? '#a5b4fc' : 'var(--text-dim)') + '">' + count + '</span>';
      html += '</div>';
    });
    html += '<div style="font-size:0.6em;color:var(--text-dim);margin-top:4px">' + _bcEsc(p.author || '') + ' · ' + _bcTimeAgo(p.ts) + '</div>';
    html += '</div>';
  });

  container.innerHTML = html;
};

window._bcCreatePoll = async function() {
  var qEl = document.getElementById('bcPollQ');
  var oEl = document.getElementById('bcPollOpts');
  if (!qEl || !qEl.value.trim() || !oEl || !oEl.value.trim()) { if (typeof showToast === 'function') showToast('Enter question and options'); return; }
  var options = oEl.value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
  if (options.length < 2) { if (typeof showToast === 'function') showToast('Need at least 2 options'); return; }
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      await firebaseDB.ref(bandPath('polls')).push({
        question: qEl.value.trim(), options: options, votes: {}, author: _bcGetName(), ts: new Date().toISOString()
      });
      qEl.value = ''; oEl.value = '';
      _bcLoadBandRoom();
      if (typeof showToast === 'function') showToast('Poll created!');
    }
  } catch(e) {}
};

window._bcToggleIdeaMenu = function(menuId) {
  document.querySelectorAll('[id^="bcIdeaMenu_"]').forEach(function(m) { if (m.id !== menuId) m.style.display = 'none'; });
  var menu = document.getElementById(menuId);
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
  if (menu && menu.style.display === 'block') {
    setTimeout(function() {
      var h = function(e) { if (!menu.contains(e.target)) { menu.style.display = 'none'; document.removeEventListener('click', h); } };
      document.addEventListener('click', h);
    }, 10);
  }
};

window._bcVotePoll = async function(pollKey, optionIdx) {
  // Route through canonical vote path for consistent identity
  var fas = (typeof FeedActionState !== 'undefined') ? FeedActionState : null;
  if (fas && fas.voteOnPoll) {
    var result = await fas.voteOnPoll(pollKey, optionIdx);
    if (result.ok) {
      if (typeof showToast === 'function') showToast('Vote recorded');
    } else {
      if (typeof showToast === 'function') showToast('Vote failed: ' + (result.reason || 'unknown'));
    }
  } else {
    // Legacy fallback
    var userId = _bcGetName();
    try {
      if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
        await firebaseDB.ref(bandPath('polls/' + pollKey + '/votes/' + userId)).set(optionIdx);
        if (typeof showToast === 'function') showToast('Vote recorded');
      }
    } catch(e) {}
  }
  if (typeof currentPage !== 'undefined' && currentPage === 'ideas') _bcLoadBandRoom();
};

// ── Reactions (Phase 2) ──────────────────────────────────────────────────────
// Add reactions to song discussion comments.

window._bcReact = async function(path, emoji) {
  var userId = _bcGetName();
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      await firebaseDB.ref(bandPath(path + '/reactions/' + userId)).set(emoji);
    }
  } catch(e) {}
};

// ── Pin Messages ─────────────────────────────────────────────────────────────

window._bcPinMsg = async function(songKey, msgKey) {
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var ref = firebaseDB.ref(bandPath('discussions/' + songKey + '/messages/' + msgKey + '/pinned'));
      var snap = await ref.once('value');
      await ref.set(!snap.val()); // toggle
      if (typeof showToast === 'function') showToast(snap.val() ? 'Unpinned' : '📌 Pinned');
    }
  } catch(e) {}
};

// ── Notification Tracking (localStorage-based) ──────────────────────────────
// Tracks "last seen" timestamps per surface. New items after that timestamp
// count as unread. Checked on navigation to show badges.

window.bcGetUnreadCount = async function(type, key) {
  var seenKey = 'bc_seen_' + type + '_' + (key || 'global');
  var lastSeen = 0;
  try { lastSeen = parseInt(localStorage.getItem(seenKey) || '0'); } catch(e) {}
  if (!lastSeen) return 0;

  var count = 0;
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      var path = type === 'disc' ? 'discussions/' + key + '/messages' : type === 'ideas' ? 'ideas/posts' : type === 'polls' ? 'polls' : null;
      if (!path) return 0;
      var snap = await firebaseDB.ref(bandPath(path)).orderByChild('ts').startAt(new Date(lastSeen).toISOString()).once('value');
      var val = snap.val();
      if (val) count = Object.keys(val).length;
    }
  } catch(e) {}
  return count;
};

window.bcMarkSeen = function(type, key) {
  var seenKey = 'bc_seen_' + type + '_' + (key || 'global');
  try { localStorage.setItem(seenKey, String(Date.now())); } catch(e) {}
};

// ── Rehearsal Brief ──────────────────────────────────────────────────────────
// Auto-generated pre-rehearsal summary using existing intelligence.

window.renderRehearsalBrief = function(container) {
  if (!container) return;
  var html = '<div style="font-size:0.65em;font-weight:700;color:var(--text-dim);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px">Rehearsal Brief</div>';
  var sections = [];

  // Songs needing work (Active songs only)
  if (typeof readinessCache !== 'undefined') {
    var weak = [];
    Object.entries(readinessCache).forEach(function(e) {
      var title = e[0], scores = e[1] || {};
      // Only include Active songs (not Library/Shelved)
      if (typeof isSongActive === 'function' && !isSongActive(title)) return;
      var vals = Object.values(scores).filter(function(v) { return typeof v === 'number' && v > 0; });
      if (vals.length) {
        var avg = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
        if (avg < 3) weak.push({ title: title, avg: avg });
      }
    });
    weak.sort(function(a, b) { return a.avg - b.avg; });
    if (weak.length) {
      var items = weak.slice(0, 5).map(function(w) {
        return '<div style="font-size:0.82em;color:var(--text-muted);padding:2px 0">\u2022 ' + _bcEsc(w.title) + ' <span style="color:#f59e0b;font-size:0.85em">(' + w.avg.toFixed(1) + '/5)</span></div>';
      }).join('');
      sections.push('<div style="margin-bottom:10px"><div style="font-size:0.72em;font-weight:700;color:#f59e0b;margin-bottom:4px">Songs Needing Work</div>' + items + '</div>');
    }
  }

  // Tempo reminders from song metadata
  if (typeof GLStore !== 'undefined' && GLStore.getPracticeAttention) {
    var pa = GLStore.getPracticeAttention({ limit: 3 });
    if (pa && pa.length) {
      var tempoItems = pa.map(function(p) {
        return '<div style="font-size:0.82em;color:var(--text-muted);padding:2px 0">\u2022 ' + _bcEsc(p.songId) + ' <span style="font-size:0.8em;color:var(--text-dim)">— ' + _bcEsc(p.topReason || '') + '</span></div>';
      }).join('');
      sections.push('<div style="margin-bottom:10px"><div style="font-size:0.72em;font-weight:700;color:#818cf8;margin-bottom:4px">Practice Focus</div>' + tempoItems + '</div>');
    }
  }

  // Recent discussion activity
  sections.push('<div style="font-size:0.72em;color:var(--text-dim);font-style:italic">Check Song Discussions for arrangement notes and the Ideas Board for new suggestions.</div>');

  if (!sections.length) {
    html += '<div style="font-size:0.82em;color:var(--text-dim)">No data available for briefing yet.</div>';
  } else {
    html += sections.join('');
  }

  container.innerHTML = html;
};

// ── Register ────────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
  pageRenderers.ideas = renderIdeasBoardPage;
}

window.renderIdeasBoardPage = renderIdeasBoardPage;

console.log('💬 band-comms.js loaded');
