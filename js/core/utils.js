// ============================================================================
// js/core/utils.js
// Pure utility helpers — no Firebase, no DOM, no app state.
// Extracted from app.js Wave 1 refactor.
// All functions assigned to window so they remain globally callable.
// ============================================================================

// ── String / Firebase path helpers ──────────────────────────────────────────

/**
 * Strips characters Firebase disallows in paths: . # $ [ ] /
 * Used everywhere a song title or user string becomes a Firebase key.
 */
window.sanitizeFirebasePath = function sanitizeFirebasePath(str) {
    return String(str).replace(/[.#$[\]\/]/g, '_');
};

/**
 * Firebase stores arrays as objects with numeric keys when items have been
 * deleted. This normalizes any value back to a plain JS array.
 */
window.toArray = function toArray(val) {
    if (!val) return [];
    var arr;
    if (Array.isArray(val)) {
        arr = val;
    } else if (typeof val === 'object') {
        arr = Object.values(val);
    } else {
        return [];
    }
    // 2026-05-12: filter null/undefined entries. Some legacy delete code
    // paths in calendar_events leave a literal `null` in place of removed
    // events. Downstream iteration sites (forEach, for, find) all assume
    // entries are non-null and crash with "Cannot read properties of null".
    // Filtering here protects every consumer that loads via toArray.
    // Drew + Brian both hit this on calendar grid render + sync in May UAT.
    var hasNulls = false;
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == null) { hasNulls = true; break; }
    }
    return hasNulls ? arr.filter(function(v) { return v != null; }) : arr;
};

// ── HTML escaping ────────────────────────────────────────────────────────────

/**
 * Escape a string for safe injection into innerHTML.
 * Used by Woodshed, Stage Crib Notes, and anywhere user-supplied text
 * is placed inside an HTML template literal.
 */
window.escHtml = function escHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// wsEsc is the historical alias used by Woodshed — keep it pointing at escHtml
window.wsEsc = window.escHtml;

// ── File helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a File/Blob to a base64 data-URL string.
 * Used by harmony audio upload and photo capture.
 */
window.fileToBase64 = function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

window.blobToBase64 = window.fileToBase64; // historical alias

// ── Media helpers ────────────────────────────────────────────────────────────

/**
 * Extract the YouTube video ID from any common YouTube URL format.
 * Returns null if the URL is not a YouTube link.
 */
window.extractYouTubeId = function extractYouTubeId(url) {
    if (!url) return null;
    const patterns = [
        /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
};

/**
 * Extract Spotify track ID from a Spotify URL.
 * e.g. https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh → 4iV5W9uYEdYUVa79Axb7Rh
 */
window.extractSpotifyTrackId = function extractSpotifyTrackId(url) {
    if (!url) return null;
    const m = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
    return m ? m[1] : null;
};

/**
 * Stab #08 — normalize a reference-version title for display.
 *
 * Previously the "add reference" flow saved the literal string 'Loading...'
 * as `v.title` when the user didn't provide one. If metadata hydration
 * failed (Spotify oEmbed timeout, no OAuth, etc.) the stored title stayed
 * 'Loading...' forever and that's what every consumer rendered.
 *
 * This helper is the canonical "what to show for this version's title":
 *   1. v.fetchedTitle (hydrated from Spotify/YouTube/etc. metadata) wins,
 *      UNLESS it's the legacy 'Loading...' sentinel.
 *   2. v.title falls through, with the same 'Loading...' filter.
 *   3. Platform-aware fallback ('Spotify Track' / 'YouTube Video' /
 *      'Archive.org Recording' / etc.) based on v.url.
 *   4. Final fallback supplied by caller (or 'Reference').
 *
 * Safe to call with partial data — pure function, no side effects.
 */
window._glNormalizeRefTitle = function _glNormalizeRefTitle(v, fallback) {
    if (!v) return fallback || 'Reference';
    var t1 = v.fetchedTitle;
    if (t1 && t1 !== 'Loading...' && t1.trim()) return t1;
    var t2 = v.title;
    if (t2 && t2 !== 'Loading...' && t2.trim()) return t2;
    var url = (v.url || v.spotifyUrl || '').toLowerCase();
    if (url.indexOf('spotify.com') !== -1)       return 'Spotify Track';
    if (url.indexOf('youtube.com') !== -1 ||
        url.indexOf('youtu.be') !== -1)          return 'YouTube Video';
    if (url.indexOf('music.apple.com') !== -1)   return 'Apple Music Track';
    if (url.indexOf('tidal.com') !== -1)         return 'Tidal Track';
    if (url.indexOf('soundcloud.com') !== -1)    return 'SoundCloud Track';
    if (url.indexOf('archive.org') !== -1)       return 'Archive.org Recording';
    return fallback || 'Reference';
};

/**
 * Smart open for music links. Prefers native app deep links for Spotify
 * to avoid web player login prompts. Falls back to web URL.
 *
 * Usage: openMusicLink('https://open.spotify.com/track/abc123')
 *   → tries spotify:track:abc123 first (opens Spotify app directly)
 *   → falls back to web URL after a short delay
 */
window.openMusicLink = function openMusicLink(url, opts) {
    if (!url) return;
    opts = opts || {};
    var lower = url.toLowerCase();

    // YouTube → in-app floating player. Per the GrooveLinx Player Layer
    // spec (2026-05-10): never leave the app during practice. Falls back
    // to window.open only if the engine isn't loaded yet (e.g. settings
    // page where the player infra isn't bootstrapped).
    var ytId = _extractYouTubeId(url);
    if (ytId && window.GLPlayerEngine && window.GLPlayerUI) {
        try {
            var title = opts.title || '';
            var song = { title: title || ('YouTube · ' + ytId), youtubeId: ytId };
            window.GLPlayerEngine.loadQueue([song], { name: title || 'YouTube' });
            // Engine resolves async; show the float UI immediately so the
            // user sees the surface as soon as they click.
            window.GLPlayerUI.showFloat({ size: opts.size || 'medium' });
            window.GLPlayerEngine.play(0);
            return;
        } catch (e) {
            console.warn('[openMusicLink] in-app player failed, falling back:', e);
        }
    }

    // Spotify track → in-app floating player. Engine routes to Connect
    // on iOS (audio plays in user's Spotify app on same device, GL stays
    // foreground) or to Web Playback SDK on desktop. Either way, never
    // leaves GL. Drew hit this 2026-05-10: Versions lens "Open in Spotify"
    // button was deeplinking out via _tryDeepLink, defeating the in-app
    // playback architecture.
    if (lower.includes('spotify.com/track/')) {
        var spMatch = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/);
        var spTrackId = spMatch ? spMatch[1] : null;
        if (spTrackId && window.GLPlayerEngine && window.GLPlayerUI) {
            try {
                var spTitle = opts.title || '';
                var spSong = { title: spTitle || ('Spotify track'), spotifyTrackId: spTrackId };
                window.GLPlayerEngine.loadQueue([spSong], { name: spTitle || 'Spotify' });
                window.GLPlayerUI.showFloat({ size: opts.size || 'medium' });
                window.GLPlayerEngine.play(0);
                return;
            } catch (e) {
                console.warn('[openMusicLink] in-app Spotify play failed, falling back:', e);
            }
        }
        // Engine not loaded → fall through to deeplink behavior.
        if (spTrackId) { _tryDeepLink('spotify:track:' + spTrackId, url); return; }
    }
    if (lower.includes('spotify.com/album/')) {
        var id = url.match(/spotify\.com\/album\/([a-zA-Z0-9]+)/);
        if (id) { _tryDeepLink('spotify:album:' + id[1], url); return; }
    }
    if (lower.includes('spotify.com/playlist/')) {
        var id = url.match(/spotify\.com\/playlist\/([a-zA-Z0-9]+)/);
        if (id) { _tryDeepLink('spotify:playlist:' + id[1], url); return; }
    }

    // Everything else: open directly
    window.open(url, '_blank');
};

// Pull a YouTube video id from any of the common URL forms:
// youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID,
// youtube.com/shorts/ID. Returns null when no match.
function _extractYouTubeId(url) {
    if (!url) return null;
    var m;
    m = url.match(/youtu\.be\/([\w-]{11})/); if (m) return m[1];
    m = url.match(/[?&]v=([\w-]{11})/);       if (m) return m[1];
    m = url.match(/youtube\.com\/embed\/([\w-]{11})/);  if (m) return m[1];
    m = url.match(/youtube\.com\/shorts\/([\w-]{11})/); if (m) return m[1];
    return null;
}

function _tryDeepLink(deepUrl, fallbackUrl) {
    // On mobile, try the deep link directly
    if (/iPhone|iPad|Android/i.test(navigator.userAgent)) {
        window.location.href = deepUrl;
        // If the app doesn't handle it within 1.5s, fall back to web
        setTimeout(function() { window.open(fallbackUrl, '_blank'); }, 1500);
        return;
    }
    // Desktop: hand off to the OS-registered protocol handler (spotify://)
    // via a hidden iframe so the page itself doesn't navigate AND we never
    // spawn a Web Player (Chrome) tab. Spawning that tab is what causes
    // Spotify desktop to "follow" the web player as the active device,
    // producing the green "playing in Web Player" bar and a stuttery start.
    try {
        var f = document.createElement('iframe');
        f.style.display = 'none';
        f.src = deepUrl;
        document.body.appendChild(f);
        setTimeout(function() { try { f.remove(); } catch (e) {} }, 2000);
    } catch (e) {
        // If iframe trick is blocked, fall back to web URL — better than nothing.
        window.open(fallbackUrl, '_blank');
    }
}

// ── Toast notification ───────────────────────────────────────────────────────

/**
 * Show a brief, self-dismissing toast at the bottom of the screen.
 * Safe to call before DOM ready (no-ops silently).
 *
 * @param {string} message  Text to display
 * @param {number} duration Milliseconds before auto-dismiss (default 2500)
 */
window.showToast = function showToast(message, duration) {
    duration = duration || 2500;
    if (typeof document === 'undefined') return;

    // Remove any existing toast to avoid stacking
    document.getElementById('glToast')?.remove();

    const toast = document.createElement('div');
    toast.id = 'glToast';
    toast.textContent = message;
    toast.style.cssText = [
        'position:fixed',
        'bottom:80px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:rgba(15,23,42,0.96)',
        'color:#f1f5f9',
        'padding:10px 20px',
        'border-radius:20px',
        'font-size:0.88em',
        'font-weight:600',
        'z-index:99999',
        'pointer-events:none',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
        'border:1px solid rgba(255,255,255,0.08)',
        'max-width:85vw',
        'text-align:center',
        'animation:glToastIn 0.2s ease-out'
    ].join(';');

    // Inject keyframe once
    if (!document.getElementById('glToastStyle')) {
        const s = document.createElement('style');
        s.id = 'glToastStyle';
        s.textContent = '@keyframes glToastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
        document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast?.remove(), duration);
};

// ── Date / time formatting ───────────────────────────────────────────────────

/**
 * Format a YYYY-MM-DD date string for display (e.g. "Mon Mar 10, 2025").
 * Returns the original string unchanged if it can't be parsed.
 */
window.formatPracticeDate = function formatPracticeDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Append T12:00 to avoid timezone-shifted "day before" issue
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
        return dateStr;
    }
};

// ── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Generate a short random alphanumeric ID (avoids visually confusing chars).
 * @param {number} length  Default 8
 */
// Decode HTML entities repeatedly until stable. Used by chart renderers to
// recover plain text from stored values that were double-escaped at some
// point (e.g. "1 &amp; 2 &amp;" stored literally instead of "1 & 2 &").
// Loop-decode handles the double-encoded "&amp;amp;" case.
window.glDecodeHtmlEntities = function glDecodeHtmlEntities(s) {
    var out = String(s || ''), prev;
    do {
        prev = out;
        out = out
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&apos;/gi, "'")
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/gi, ' ')
            .replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(+n); })
            .replace(/&#x([0-9a-f]+);/gi, function(_, h) { return String.fromCharCode(parseInt(h, 16)); });
    } while (out !== prev);
    return out;
};

window.generateShortId = function generateShortId(length) {
    length = length || 8;
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    var id = '';
    for (var i = 0; i < length; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
};

// ── Timezone-safe date utilities ─────────────────────────────────────────────
// RULE: Never pass a bare YYYY-MM-DD string to new Date() — it creates midnight
// UTC which shifts to the wrong day in US timezones. Always use these helpers.

/**
 * Parse a YYYY-MM-DD date string safely (noon anchor prevents timezone drift).
 * Returns a Date object or null if invalid.
 */
window.glParseDate = function glParseDate(dateStr) {
    if (!dateStr) return null;
    var d = new Date(dateStr + 'T12:00:00');
    return isNaN(d.getTime()) ? null : d;
};

/**
 * Get today's date as YYYY-MM-DD string (UTC-based, consistent across timezones).
 */
window.glToday = function glToday() {
    // Use local date components (not UTC) so "today" matches the user's wall clock
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
};

/**
 * Days between a YYYY-MM-DD date and today. Positive = future, negative = past.
 */
window.glDaysAway = function glDaysAway(dateStr) {
    if (!dateStr) return null;
    return Math.round((new Date(dateStr + 'T12:00:00').getTime() - Date.now()) / 86400000);
};

/**
 * Human-readable countdown label: "Today", "Tomorrow", "in 5 days", "3 days ago"
 */
window.glCountdownLabel = function glCountdownLabel(dateStr) {
    var diff = glDaysAway(dateStr);
    if (diff === null) return '';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff > 1) return 'in ' + diff + ' days';
    if (diff === -1) return 'Yesterday';
    if (diff < -1) return Math.abs(diff) + ' days ago';
    return '';
};

/**
 * Is a YYYY-MM-DD date in the future (>= today)?
 */
window.glIsUpcoming = function glIsUpcoming(dateStr) {
    if (!dateStr) return false;
    return dateStr >= glToday();
};

/**
 * Format a YYYY-MM-DD date for display. compact=true: "Fri, Jun 5, 2026"
 */
window.glFormatDate = function glFormatDate(dateStr, compact) {
    if (!dateStr) return 'No date';
    var d = glParseDate(dateStr);
    if (!d) return dateStr;
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var daysS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    var monthsS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (compact) return daysS[d.getDay()] + ', ' + monthsS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
};

// ── Structural title guard ────────────────────────────────────────────────────
// Titles that represent setlist structure, not real playable songs.
// Used to exclude fake entries from practice, readiness, recommendations, etc.
var _structuralTitles = {
    'soundcheck':1, 'set 1':1, 'set 2':1, 'set 3':1, 'set 4':1,
    'set break':1, 'encore':1, 'break':1, 'intermission':1,
    'all songs':1, 'full show':1
};
window.isStructuralTitle = function(title) {
    if (!title) return false;
    return !!_structuralTitles[title.toLowerCase().trim()];
};

// ── Song Runtime Estimation ──────────────────────────────────────────────────
// Returns estimated runtime in seconds for a song title.
// Priority: 1) persistent override, 2) seed data, 3) fallback default.
// Used for setlist show-length estimation. NOT rehearsal block budgeting.

var _glDefaultRuntimeSec = 360; // 6 min fallback
var _glLinkedTransitionBufferSec = 60; // 1 min segue buffer for linked pairs

window.getSongRuntimeSec = function(title) {
    if (!title) return _glDefaultRuntimeSec;

    // 1. Persistent override (stored in songDetailCache or GLStore)
    if (typeof GLStore !== 'undefined' && GLStore._getDetailCache) {
        var cached = GLStore._getDetailCache(title);
        if (cached && cached.durationSec && cached.durationSec > 0) return cached.durationSec;
    }

    // 2. Structural titles = 0 runtime (they're not songs)
    if (typeof isStructuralTitle === 'function' && isStructuralTitle(title)) return 0;

    // 4. Fallback default
    return _glDefaultRuntimeSec;
};

// Get runtime for a linked pair (sum + transition buffer)
window.getLinkedPairRuntimeSec = function(fromTitle, toTitle) {
    var fromSec = getSongRuntimeSec(fromTitle);
    var toSec = getSongRuntimeSec(toTitle);
    return fromSec + toSec + _glLinkedTransitionBufferSec;
};

// Parse "M:SS" or "H:MM:SS" string to seconds
function _parseTimeStr(str) {
    if (!str || typeof str !== 'string') return 0;
    var parts = str.split(':').map(Number);
    if (parts.length === 2) return (parts[0] * 60) + (parts[1] || 0);
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + (parts[2] || 0);
    return 0;
}

// Format seconds to human-readable "Xh Ymin" or "Xmin"
window.formatRuntimeSec = function(totalSec) {
    if (!totalSec || totalSec <= 0) return '0 min';
    var mins = Math.round(totalSec / 60);
    if (mins >= 60) {
        var h = Math.floor(mins / 60);
        var m = mins % 60;
        return h + 'h' + (m ? ' ' + m + 'min' : '');
    }
    return mins + ' min';
};

// ── Render-error fallback ──────────────────────────────────────────────────
// Top-level page renderers wrap their bodies in try/catch and call this
// helper on throw, so a single bad sort comparator can no longer leave a
// user staring at "Loading..." forever. Reset clears UI preferences likely
// to be the cause (sort/filter/scope) without touching auth or band data.
window._glRenderError = function _glRenderError(targetEl, where, err) {
    try { console.error('[GL render fail]', where, err); } catch(_e) {}
    if (!targetEl) return;
    var msg = '';
    try { msg = (err && err.message) ? String(err.message) : 'Unexpected error'; } catch(_e) { msg = 'Unexpected error'; }
    msg = msg.replace(/[<>&]/g, '');
    targetEl.innerHTML = '<div style="padding:32px 24px;text-align:center;max-width:480px;margin:32px auto">'
        + '<div style="font-size:1.15em;font-weight:700;color:#fbbf24;margin-bottom:8px">Something went wrong loading this page</div>'
        + '<div style="font-size:0.82em;color:var(--text-dim,#94a3b8);margin-bottom:6px">' + (where ? '(' + where + ')' : '') + '</div>'
        + '<div style="font-size:0.78em;color:var(--text-dim,#94a3b8);margin-bottom:18px;font-family:monospace">' + msg + '</div>'
        + '<button onclick="location.reload()" style="font-size:0.85em;font-weight:700;padding:8px 18px;border-radius:6px;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.12);color:#a5b4fc;cursor:pointer;margin-right:8px">Reload</button>'
        + '<button onclick="(function(){try{var rm=[];Object.keys(localStorage).forEach(function(k){if(/^gl_/i.test(k)||/^_sq/i.test(k))rm.push(k);});rm.forEach(function(k){localStorage.removeItem(k);});}catch(_e){}location.reload();})()" style="font-size:0.85em;padding:8px 18px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:none;color:var(--text-dim,#94a3b8);cursor:pointer">Reset preferences</button>'
        + '</div>';
};

console.log('✅ utils.js loaded');
