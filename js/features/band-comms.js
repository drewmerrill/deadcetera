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
    html += '<div style="font-size:0.8em;color:var(--text-dim);padding:6px 0;font-style:italic">No comments yet. Start the conversation.</div>';
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
        + '<div style="font-size:0.82em;color:var(--text-muted);margin-top:2px">' + _bcEsc(m.text || '') + '</div>'
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
};

window._bcPostComment = async function(songTitle) {
  var input = document.getElementById('bcDiscussionInput');
  if (!input || !input.value.trim()) return;
  var songKey = typeof sanitizeFirebasePath === 'function' ? sanitizeFirebasePath(songTitle) : songTitle.replace(/[.#$/[\]]/g, '_');
  var name = _bcGetName();

  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      await firebaseDB.ref(bandPath('discussions/' + songKey + '/messages')).push({
        author: name,
        text: input.value.trim(),
        ts: new Date().toISOString()
      });
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
  el.innerHTML = '<div class="page-header"><h1>💡 Ideas Board</h1><p>Song ideas, jam concepts, setlist suggestions, polls</p></div>'
    + '<div style="max-width:600px;margin:0 auto">'
    + '<div id="bcIdeasContainer"><div style="color:var(--text-dim);text-align:center;padding:20px">Loading...</div></div>'
    + '<div id="bcBriefContainer" style="margin-top:20px;padding:12px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px"></div>'
    + '<div id="bcPollsContainer" style="margin-top:20px"></div>'
    + '</div>';
  _bcLoadIdeas();
  setTimeout(function() {
    var briefContainer = document.getElementById('bcBriefContainer');
    if (briefContainer && typeof renderRehearsalBrief === 'function') renderRehearsalBrief(briefContainer);
    var pollContainer = document.getElementById('bcPollsContainer');
    if (pollContainer && typeof renderPollWidget === 'function') renderPollWidget(pollContainer);
  }, 100);
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
      html += '<div style="font-size:0.72em;color:var(--text-dim)">' + _bcEsc(p.author || 'Anonymous') + ' · ' + _bcTimeAgo(p.ts) + '</div>';
      if (p.note) html += '<div style="font-size:0.8em;color:var(--text-muted);margin-top:4px">' + _bcEsc(p.note) + '</div>';
      html += '</div>';
    });
  }

  container.innerHTML = html;
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
      _bcLoadIdeas();
      if (typeof showToast === 'function') showToast('💡 Idea posted!');
    }
  } catch(e) {
    if (typeof showToast === 'function') showToast('Failed: ' + e.message);
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function _bcGetName() {
  var cu = localStorage.getItem('deadcetera_current_user') || '';
  if (typeof bandMembers !== 'undefined' && bandMembers[cu]) return bandMembers[cu].name;
  if (typeof currentUserName !== 'undefined' && currentUserName) return currentUserName;
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
    html += '<div style="font-size:0.78em;color:var(--text-dim);font-style:italic;padding:4px 0">No comments yet.</div>';
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
      var container = qEl.closest('[id]') || qEl.parentElement.parentElement.parentElement;
      if (container && typeof renderPollWidget === 'function') renderPollWidget(container);
      if (typeof showToast === 'function') showToast('Poll created!');
    }
  } catch(e) {}
};

window._bcVotePoll = async function(pollKey, optionIdx) {
  var userId = _bcGetName();
  try {
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
      await firebaseDB.ref(bandPath('polls/' + pollKey + '/votes/' + userId)).set(optionIdx);
      if (typeof showToast === 'function') showToast('Vote recorded');
      // Refresh — find the poll container
      var containers = document.querySelectorAll('[id]');
      // Simple refresh: just reload ideas page if on it
      if (typeof currentPage !== 'undefined' && currentPage === 'ideas') _bcLoadIdeas();
    }
  } catch(e) {}
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

  // Songs needing work
  if (typeof readinessCache !== 'undefined') {
    var weak = [];
    Object.entries(readinessCache).forEach(function(e) {
      var title = e[0], scores = e[1] || {};
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
