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

  if (!messages.length) {
    html += '<div style="font-size:0.8em;color:var(--text-dim);padding:6px 0;font-style:italic">No comments yet. Start the conversation.</div>';
  } else {
    messages.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
    html += '<div style="max-height:200px;overflow-y:auto;margin-bottom:8px">';
    messages.forEach(function(m) {
      var timeAgo = _bcTimeAgo(m.ts);
      html += '<div style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
        + '<div style="display:flex;align-items:baseline;gap:6px">'
        + '<span style="font-size:0.78em;font-weight:700;color:var(--text)">' + _bcEsc(m.author || 'Anonymous') + '</span>'
        + '<span style="font-size:0.62em;color:var(--text-dim)">' + timeAgo + '</span>'
        + '</div>'
        + '<div style="font-size:0.82em;color:var(--text-muted);margin-top:2px">' + _bcEsc(m.text || '') + '</div>'
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
  el.innerHTML = '<div class="page-header"><h1>💡 Ideas Board</h1><p>Song ideas, jam concepts, setlist suggestions</p></div>'
    + '<div id="bcIdeasContainer" style="max-width:600px;margin:0 auto"><div style="color:var(--text-dim);text-align:center;padding:20px">Loading...</div></div>';
  _bcLoadIdeas();
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
      await firebaseDB.ref(bandPath('ideas/posts')).push({
        title: titleEl.value.trim(),
        link: (linkEl && linkEl.value.trim()) || '',
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

// ── Register ────────────────────────────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
  pageRenderers.ideas = renderIdeasBoardPage;
}

window.renderIdeasBoardPage = renderIdeasBoardPage;

console.log('💬 band-comms.js loaded');
