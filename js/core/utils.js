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
    if (Array.isArray(val)) return val;
    if (typeof val === 'object') return Object.values(val);
    return [];
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

    // 2. Seed data from bandKnowledgeBase
    if (typeof bandKnowledgeBase !== 'undefined' && bandKnowledgeBase[title]) {
        var kb = bandKnowledgeBase[title];
        // Check spotifyVersions[0].length first (most likely to have it)
        var versions = kb.spotifyVersions || [];
        for (var i = 0; i < versions.length; i++) {
            if (versions[i].length) {
                var parsed = _parseTimeStr(versions[i].length);
                if (parsed > 0) return parsed;
            }
        }
    }

    // 3. Structural titles = 0 runtime (they're not songs)
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

console.log('✅ utils.js loaded');
