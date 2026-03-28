// ============================================================================
// js/core/worker-api.js
// All calls to the Cloudflare Worker proxy (deadcetera-proxy).
// Extracted from app.js Wave 1 refactor.
//
// DEPENDS ON: nothing (pure fetch wrappers)
//
// EXPOSES globals:
//   WORKER_URL, FADR_PROXY  (kept as aliases — version-hub.js reads these)
//   workerPost(path, body)  — generic POST helper
//   workerGet(path)         — generic GET helper
//   workerApi.*             — named call wrappers
// ============================================================================

'use strict';

// Single source of truth for the worker base URL.
// Both FADR_PROXY and WORKER_URL historically pointed at the same origin;
// keeping both names prevents breakage in version-hub.js and app.js call sites.
var WORKER_URL  = 'https://deadcetera-proxy.drewmerrill.workers.dev';
var FADR_PROXY  = WORKER_URL;   // historical alias — do NOT remove

// ── Low-level helpers ────────────────────────────────────────────────────────

/**
 * POST JSON to a Worker endpoint.
 * @param {string} path   e.g. '/claude' or '/archive-search'
 * @param {object} body   Plain object — will be JSON.stringify'd
 * @returns {Promise<Response>}
 */
window.workerPost = function workerPost(path, body) {
    return fetch(WORKER_URL + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
};

/**
 * GET from a Worker endpoint.
 * @param {string} path  e.g. '/pack/abc123'
 * @returns {Promise<Response>}
 */
window.workerGet = function workerGet(path) {
    return fetch(WORKER_URL + path);
};

// ── Named API wrappers ────────────────────────────────────────────────────────
// Each function returns the parsed JSON result (or throws on error).
// Callers that previously called fetch(FADR_PROXY + '/foo', ...) directly
// can be migrated to these wrappers over time; existing call sites still work
// because FADR_PROXY is still defined above.

var workerApi = window.workerApi = {

    // ── AI ──────────────────────────────────────────────────────────────────

    /**
     * Send a prompt to Claude via the Worker.
     * @param {string} systemPrompt
     * @param {string} userPrompt
     * @param {number} [maxTokens=1024]
     * @returns {Promise<string>} Claude's text response
     */
    async claude(systemPrompt, userPrompt, maxTokens) {
        // Send in Anthropic Messages API format (worker passes body directly)
        var res = await window.workerPost('/claude', {
            model: 'claude-haiku-4-5-20251001',
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            max_tokens: maxTokens || 1024
        });
        if (!res.ok) {
            var errText = '';
            try { errText = await res.text(); } catch(e) {}
            throw new Error('Claude API error ' + res.status + ': ' + errText.substring(0, 100));
        }
        var data = await res.json();
        // Anthropic returns { content: [{type:'text',text:'...'}] }
        return (data.content || []).map(function(b) { return b.text || ''; }).join('');
    },

    /**
     * Generate an image via the Worker.
     * @param {string} prompt
     * @returns {Promise<string>} URL of generated image
     */
    async generateImage(prompt) {
        var res = await window.workerPost('/generate-image', { prompt: prompt });
        if (!res.ok) throw new Error('Image generation error: ' + res.status);
        var data = await res.json();
        return data.url || data.imageUrl || '';
    },

    // ── Archive.org ─────────────────────────────────────────────────────────

    /**
     * Search Archive.org for shows matching a query.
     * @param {string} query
     * @param {string} [sort='downloads+desc']
     * @returns {Promise<object>}
     */
    async archiveSearch(query, sort) {
        var res = await window.workerPost('/archive-search', {
            query: query,
            sort: sort || 'downloads+desc'
        });
        if (!res.ok) throw new Error('Archive search error: ' + res.status);
        return res.json();
    },

    /**
     * Get the file list for an Archive.org identifier.
     * @param {string} identifier  e.g. 'gd1977-05-08.sbd.miller.31775.sbeok.flac16'
     * @returns {Promise<object>}
     */
    async archiveFiles(identifier) {
        var res = await window.workerPost('/archive-files', { identifier: identifier });
        if (!res.ok) throw new Error('Archive files error: ' + res.status);
        return res.json();
    },

    /**
     * Fetch raw audio from Archive.org via the Worker (bypasses CORS).
     * @param {string} audioUrl
     * @returns {Promise<ArrayBuffer>}
     */
    async archiveFetch(audioUrl) {
        var res = await window.workerPost('/archive-fetch', { audioUrl: audioUrl });
        if (!res.ok) throw new Error('Archive fetch error: ' + res.status);
        return res.arrayBuffer();
    },

    // ── YouTube ─────────────────────────────────────────────────────────────

    /**
     * Search YouTube for videos matching a query.
     * @param {string} query
     * @returns {Promise<object>}
     */
    async youtubeSearch(query) {
        var res = await window.workerPost('/youtube-search', { query: query });
        if (!res.ok) throw new Error('YouTube search error: ' + res.status);
        return res.json();
    },

    // ── Spotify ─────────────────────────────────────────────────────────────

    /**
     * Search Spotify for tracks matching a query.
     * @param {string} query
     * @returns {Promise<object>}
     */
    async spotifySearch(query) {
        var res = await window.workerPost('/spotify-search', { query: query });
        if (!res.ok) throw new Error('Spotify search error: ' + res.status);
        return res.json();
    },

    /**
     * Get cross-platform links for a track via Odesli (songlink.io).
     * @param {string} url  Any music service URL
     * @returns {Promise<object>}
     */
    async odesliLinks(url) {
        var res = await window.workerPost('/odesli-links', { url: url });
        if (!res.ok) throw new Error('Odesli error: ' + res.status);
        return res.json();
    },

    // ── Genius ──────────────────────────────────────────────────────────────

    /**
     * Search Genius for song lyrics metadata.
     * @param {string} query  e.g. "Friend of the Devil Grateful Dead"
     * @returns {Promise<object>}
     */
    async geniusSearch(query) {
        var res = await window.workerPost('/genius-search', { query: query });
        if (!res.ok) throw new Error('Genius search error: ' + res.status);
        return res.json();
    },

    /**
     * Fetch full lyrics for a Genius song.
     * @param {number|string} songId
     * @param {string}        url  Genius song URL
     * @returns {Promise<object>}
     */
    async geniusFetch(songId, url) {
        var res = await window.workerPost('/genius-fetch', { songId: songId, url: url });
        if (!res.ok) throw new Error('Genius fetch error: ' + res.status);
        return res.json();
    },

    // ── Relisten / Phish.in / Phish.net ─────────────────────────────────────

    /**
     * Search Relisten for versions of a song.
     * @param {string} songTitle
     * @param {string} bandSlug  e.g. 'grateful-dead'
     * @returns {Promise<object>}
     */
    async relistenSearch(songTitle, bandSlug) {
        var res = await window.workerPost('/relisten-search', {
            songTitle: songTitle,
            bandSlug: bandSlug
        });
        if (!res.ok) throw new Error('Relisten search error: ' + res.status);
        return res.json();
    },

    /**
     * Search Phish.in for versions of a Phish song.
     * @param {string} songTitle
     * @returns {Promise<object>}
     */
    async phishinSearch(songTitle) {
        var res = await window.workerPost('/phishin-search', { songTitle: songTitle });
        if (!res.ok) throw new Error('Phish.in search error: ' + res.status);
        return res.json();
    },

    /**
     * Get Phish.net jam chart data for a song.
     * @param {string} songTitle
     * @returns {Promise<object>}
     */
    async phishnetJamchart(songTitle) {
        var res = await window.workerPost('/phishnet-jamchart', { songTitle: songTitle });
        if (!res.ok) throw new Error('Phish.net jamchart error: ' + res.status);
        return res.json();
    },

    // ── Fadr (stem separation) ───────────────────────────────────────────────

    async fadrUploadUrl(filename, extension) {
        var res = await window.workerPost('/fadr/assets/upload2', {
            name: filename, extension: extension
        });
        if (!res.ok) throw new Error('Fadr upload URL error: ' + res.status);
        return res.json();
    },

    async fadrCreateAsset(name, s3Path, extension, group) {
        var res = await window.workerPost('/fadr/assets', {
            name: name, s3Path: s3Path, extension: extension, group: group
        });
        if (!res.ok) throw new Error('Fadr create asset error: ' + res.status);
        return res.json();
    },

    async fadrAnalyzeStem(assetId) {
        var res = await window.workerPost('/fadr/assets/analyze/stem', { _id: assetId });
        if (!res.ok) throw new Error('Fadr analyze error: ' + res.status);
        return res.json();
    },

    async fadrGetAsset(assetId) {
        var res = await window.workerGet('/fadr/assets/' + assetId);
        if (!res.ok) throw new Error('Fadr get asset error: ' + res.status);
        return res.json();
    },

    async fadrDownloadAsset(assetId) {
        var res = await window.workerGet('/fadr/assets/' + assetId + '/download');
        if (!res.ok) throw new Error('Fadr download error: ' + res.status);
        return res.json();
    },

    async midiToAbc(midiBuffer) {
        var res = await fetch(WORKER_URL + '/midi2abc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: midiBuffer
        });
        if (!res.ok) throw new Error('midi2abc error: ' + res.status);
        return res.json();
    },

    // ── Care Package ─────────────────────────────────────────────────────────

    /**
     * Get the public URL for a Care Package pack by ID.
     * (The data lives in Firebase; the Worker just serves the standalone page.)
     * @param {string} packId
     * @returns {string}
     */
    carePackageUrl(packId) {
        return WORKER_URL + '/pack/' + packId;
    }
};

console.log('✅ worker-api.js loaded');
