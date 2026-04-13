// GrooveLinx Cloudflare Worker v4 — Multi-Source Harmony + Jam Charts
// Routes:
//   POST /claude          → Anthropic Claude API proxy
//   ANY  /fadr/*          → Fadr API proxy (key injected server-side)
//   POST /midi2abc        → MIDI binary → ABC notation converter
//   POST /archive-fetch   → Fetch Archive.org audio as binary
//   POST /archive-search  → Search Archive.org by setlist/description
//   POST /archive-files   → List files for a specific show
//   POST /youtube-search  → Search YouTube for videos
//   POST /youtube-audio   → Extract audio from YouTube/Spotify URLs
//   POST /genius-search   → Search Genius.com for songs
//   POST /genius-fetch    → Fetch song meaning from Genius
//   POST /generate-image  → Flux Schnell AI image generation
//   POST /relisten-search → Search Relisten API for shows by song
//   POST /phishnet-jamchart → Fetch Phish.net jam chart for a song
//   POST /phishin-search  → Search Phish.in for tracks by song
//   POST /spotify-search  → Search Spotify for tracks (client credentials)
//   POST /odesli-links    → Get cross-platform links via Odesli/Songlink
//   GET  /fadr-diag       → Fadr API key diagnostics
//   GET  /ical/:bandSlug  → Live ICS calendar feed for Google/Apple Calendar

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (request.method === 'OPTIONS') return cors(new Response(null));
    if ((path === '/' || path === '/claude') && request.method === 'POST')
      return handleClaude(request, env);
    if (path.startsWith('/fadr/'))
      return handleFadr(request, env, path);
    if (path === '/midi2abc' && request.method === 'POST')
      return handleMidi2Abc(request);
    if (path === '/archive-fetch' && request.method === 'POST')
      return handleArchiveFetch(request);
    if (path === '/drive-audio' && request.method === 'POST')
      return handleDriveAudio(request);
    if (path === '/drive-stream' && request.method === 'GET')
      return handleDriveStream(request);
    if (path === '/archive-search' && request.method === 'POST')
      return handleArchiveSearch(request);
    if (path === '/archive-files' && request.method === 'POST')
      return handleArchiveFiles(request);
    if (path === '/genius-search' && request.method === 'POST')
      return handleGeniusSearch(request);
    if (path === '/genius-fetch' && request.method === 'POST')
      return handleGeniusFetch(request);
    if (path === '/youtube-search' && request.method === 'POST')
      return handleYouTubeSearch(request);
    if (path === '/youtube-audio' && request.method === 'POST')
      return handleYouTubeAudio(request);
    if (path === '/generate-image' && request.method === 'POST')
      return handleGenerateImage(request, env);
    if (path === '/relisten-search' && request.method === 'POST')
      return handleRelistenSearch(request);
    if (path === '/phishnet-jamchart' && request.method === 'POST')
      return handlePhishNetJamChart(request, env);
    if (path === '/phishin-search' && request.method === 'POST')
      return handlePhishInSearch(request);
    if (path === '/spotify-search' && request.method === 'POST')
      return handleSpotifySearch(request, env);
    if (path === '/spotify-config' && request.method === 'GET')
      return jsonResp({ clientId: env.SPOTIFY_CLIENT_ID || '' });
    if (path === '/odesli-links' && request.method === 'POST')
      return handleOdesliLinks(request);
    if (path === '/fadr-diag' && request.method === 'GET')
      return handleFadrDiag(request, env);
    if (path.startsWith('/ical/') && request.method === 'GET')
      return handleICalFeed(request, env, path);
    if (path === '/tts' && request.method === 'POST')
      return handleTTS(request, env);
    if (path === '/fetch-chart' && request.method === 'POST')
      return handleFetchChart(request);
    if (path === '/transcribe' && request.method === 'POST')
      return handleTranscribe(request, env);
    // Google Calendar API proxy — forwards user's access token to Google
    // Calendar CRUD — calendarId from query param or default to 'primary'
    var _calId = url.searchParams.get('calendarId') || 'primary';
    if (path === '/calendar/events' && request.method === 'POST')
      return handleCalendarProxy(request, 'POST', _calId);
    if (path.startsWith('/calendar/events/') && request.method === 'PATCH')
      return handleCalendarProxy(request, 'PATCH', _calId, path.replace('/calendar/events/', ''));
    if (path.startsWith('/calendar/events/') && request.method === 'DELETE')
      return handleCalendarProxy(request, 'DELETE', _calId, path.replace('/calendar/events/', ''));
    // Free/busy query
    if (path === '/calendar/freebusy' && request.method === 'POST')
      return handleCalendarFreeBusy(request);
    // List user's calendars (for selection UI)
    if (path === '/calendar/list' && request.method === 'GET')
      return handleCalendarList(request);
    // List events (import)
    if (path === '/calendar/events' && request.method === 'GET')
      return handleCalendarListEvents(request);
    // Get single event (attendee sync)
    if (path.startsWith('/calendar/events/') && request.method === 'GET')
      return handleCalendarGetEvent(request, path.replace('/calendar/events/', ''));
    return cors(new Response('Not found', { status: 404 }));
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function cors(response) {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  h.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, headers: h });
}
function jsonResp(data, status = 200) {
  return cors(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
}

// ── ElevenLabs TTS Proxy ─────────────────────────────────────────────────────
async function handleTTS(request, env) {
  try {
    const apiKey = env.ELEVENLABS_API_KEY;
    if (!apiKey) return jsonResp({ error: 'TTS not configured — add ELEVENLABS_API_KEY to Worker secrets' }, 503);

    const body = await request.json();
    const text = body.text || '';
    const voiceId = body.voice_id || 'EXAVITQu4vr4xnSDxMaL'; // Rachel — warm conversational
    const stability = body.stability ?? 0.5;
    const similarity = body.similarity_boost ?? 0.8;
    const style = body.style ?? 0.4;

    const res = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': apiKey },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability, similarity_boost: similarity, style, use_speaker_boost: true }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return jsonResp({ error: 'ElevenLabs error: ' + res.status, detail: errText.substring(0, 200) }, res.status);
    }

    const audioData = await res.arrayBuffer();
    const headers = new Headers();
    headers.set('Content-Type', 'audio/mpeg');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=3600');
    return new Response(audioData, { status: 200, headers });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

// ── Deepgram Transcription Proxy ─────────────────────────────────────────────
async function handleTranscribe(request, env) {
  try {
    const apiKey = env.DEEPGRAM_API_KEY;
    if (!apiKey) return jsonResp({ error: 'Transcription not configured — add DEEPGRAM_API_KEY to Worker secrets' }, 503);

    // Accept raw audio binary (WAV/MP3) in request body
    const contentType = request.headers.get('Content-Type') || 'audio/wav';
    const audioData = await request.arrayBuffer();

    if (!audioData || audioData.byteLength < 1000) {
      return jsonResp({ error: 'No audio data provided' }, 400);
    }

    // Cap at 25MB to prevent abuse
    if (audioData.byteLength > 25 * 1024 * 1024) {
      return jsonResp({ error: 'Audio too large (max 25MB)' }, 413);
    }

    const dgRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&diarize=true', {
      method: 'POST',
      headers: {
        'Authorization': 'Token ' + apiKey,
        'Content-Type': contentType
      },
      body: audioData
    });

    if (!dgRes.ok) {
      const errText = await dgRes.text();
      return jsonResp({ error: 'Deepgram error: ' + dgRes.status, detail: errText.substring(0, 300) }, dgRes.status);
    }

    const result = await dgRes.json();

    // Extract transcript + speaker segments
    const channel = result.results?.channels?.[0];
    const alt = channel?.alternatives?.[0];
    const transcript = alt?.transcript || '';
    const words = alt?.words || [];

    // Build speaker segments from diarization
    const speakers = [];
    let currentSpeaker = null;
    let currentText = '';
    let currentStart = 0;
    words.forEach(w => {
      if (w.speaker !== currentSpeaker) {
        if (currentSpeaker !== null && currentText.trim()) {
          speakers.push({ speaker: currentSpeaker, text: currentText.trim(), start: currentStart, end: w.start });
        }
        currentSpeaker = w.speaker;
        currentText = w.punctuated_word || w.word || '';
        currentStart = w.start;
      } else {
        currentText += ' ' + (w.punctuated_word || w.word || '');
      }
    });
    if (currentSpeaker !== null && currentText.trim()) {
      speakers.push({ speaker: currentSpeaker, text: currentText.trim(), start: currentStart, end: words[words.length - 1]?.end || 0 });
    }

    return jsonResp({
      transcript: transcript,
      speakers: speakers,
      confidence: alt?.confidence || 0,
      duration: result.metadata?.duration || 0
    });

  } catch (e) {
    return jsonResp({ error: 'Transcription failed: ' + e.message }, 500);
  }
}

// ── Chart Fetch (extract text from external chart page) ──────────────────────
async function handleFetchChart(request) {
  try {
    const { url } = await request.json();
    if (!url) return jsonResp({ error: 'No URL provided' }, 400);

    // Fetch the page (CORS bypass via worker)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GrooveLinx/1.0)' }
    });
    if (!res.ok) return jsonResp({ error: 'Fetch failed: ' + res.status }, res.status);

    const html = await res.text();

    // Extract meaningful text (strip HTML tags, scripts, styles)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .substring(0, 5000); // cap at 5KB

    return jsonResp({ url: url, text: text, length: text.length });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

// ── Claude API Proxy ────────────────────────────────────────────────────────
async function handleClaude(request, env) {
  try {
    const body = await request.text();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body
    });
    return cors(new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } }));
  } catch (e) { return jsonResp({ error: e.message }, 500); }
}

// ── Fadr API Proxy ──────────────────────────────────────────────────────────
async function handleFadr(request, env, path) {
  const fadrPath = path.replace('/fadr', '');
  const fadrUrl = 'https://api.fadr.com' + fadrPath;
  try {
    const ct = request.headers.get('Content-Type') || 'application/json';
    const body = request.method !== 'GET' ? await request.arrayBuffer() : undefined;
    const fadrReq = new Request(fadrUrl, { method: request.method, body, headers: { 'Content-Type': ct } });
    const keyStr = '' + (env.FADR_API_KEY || '');
    fadrReq.headers.set('Authorization', 'Bearer ' + keyStr.replace(/[\x00-\x1F\x7F]/g, '').trim());
    const res = await fetch(fadrReq);
    const data = await res.arrayBuffer();
    const respHeaders = { 'Content-Type': res.headers.get('Content-Type') || 'application/json' };
    if (!res.ok) respHeaders['X-Fadr-Error'] = 'status-' + res.status;
    return cors(new Response(data, { status: res.status, headers: respHeaders }));
  } catch (e) { return jsonResp({ error: e.message }, 500); }
}

// ── Fadr Diagnostics ────────────────────────────────────────────────────────
async function handleFadrDiag(request, env) {
  const rawKey = String(env.FADR_API_KEY || '');
  const cleaned = rawKey.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return jsonResp({ rawLength: rawKey.length, cleanLength: cleaned.length,
    first4: cleaned.substring(0, 4), last4: cleaned.substring(cleaned.length - 4),
    hasNewline: rawKey.includes('\n'), hasReturn: rawKey.includes('\r'),
    charCodes: [...rawKey].slice(0, 10).map(c => c.charCodeAt(0)) });
}

// ── Archive.org Fetch (audio binary) ────────────────────────────────────────
async function handleArchiveFetch(request) {
  try {
    const { audioUrl } = await request.json();
    if (!audioUrl || !audioUrl.includes('archive.org')) return jsonResp({ error: 'Must be an archive.org URL' }, 400);
    const res = await fetch(audioUrl, { headers: { 'User-Agent': 'GrooveLinx/1.0' } });
    if (!res.ok) return jsonResp({ error: 'Fetch failed: ' + res.status }, 502);
    // Stream the response through instead of buffering entire file
    return cors(new Response(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Length': res.headers.get('Content-Length') || '',
      }
    }));
  } catch (e) { return jsonResp({ error: e.message }, 500); }
}

// ── Google Drive Audio Proxy ─────────────────────────────────────────────────
// POST /drive-audio { driveUrl: "https://drive.google.com/file/d/FILE_ID/..." }
// Extracts file ID, constructs direct download URL, streams audio back.
// Works with "Anyone with the link" shared files.
async function handleDriveAudio(request) {
  try {
    const { driveUrl, accessToken } = await request.json();
    if (!driveUrl) return jsonResp({ error: 'driveUrl required' }, 400);

    // Extract file ID from various Google Drive URL formats
    var fileId = null;
    var m = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (m) fileId = m[1];
    if (!fileId) { m = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/); if (m) fileId = m[1]; }
    if (!fileId) return jsonResp({ error: 'Could not extract file ID from Drive URL' }, 400);

    // Strategy 1: Use Google Drive API with user's OAuth token (most reliable)
    if (accessToken) {
      // supportsAllDrives=true handles files in Shared Drives (Team Drives)
      var apiUrl = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&supportsAllDrives=true';
      var res = await fetch(apiUrl, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      if (res.ok) {
        var ct = res.headers.get('Content-Type') || 'audio/mpeg';
        return cors(new Response(res.body, {
          status: 200,
          headers: {
            'Content-Type': ct.includes('audio') ? ct : 'audio/mpeg',
            'Content-Length': res.headers.get('Content-Length') || ''
          }
        }));
      }
      // Return detailed error so we can debug
      var apiErr = '';
      try { apiErr = await res.text(); } catch(e) {}
      // If it's a clear auth/not-found error, return it directly
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        return jsonResp({
          error: 'Drive API ' + res.status + ' for file ' + fileId,
          detail: apiErr.substring(0, 500),
          driveUrl: driveUrl,
          hint: res.status === 404
            ? 'File not found. The file ID is ' + fileId + '. Check that this file exists and is shared with your Google account (drewmerrill1029@gmail.com).'
            : res.status === 401
            ? 'Token rejected. The Drive scope may not have been granted. Try disconnecting and reconnecting Google.'
            : 'Access denied. The file exists but your account cannot access it. Make sure it is shared with you.'
        }, res.status);
      }
      // Other errors — fall through to public methods
    }

    // Strategy 2: Try multiple public download URLs (no auth needed for "anyone with link" files)
    var urls = [
      'https://drive.google.com/uc?export=download&confirm=t&id=' + fileId,
      'https://drive.google.com/uc?export=download&id=' + fileId,
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&key=AIzaSyDummyKeyForPublicFiles'
    ];

    for (var i = 0; i < urls.length; i++) {
      try {
        var res2 = await fetch(urls[i], {
          headers: { 'User-Agent': 'GrooveLinx/1.0' },
          redirect: 'follow'
        });
        var ct2 = res2.headers.get('Content-Type') || '';
        // Skip HTML responses (login pages, virus scan warnings)
        if (res2.ok && !ct2.includes('text/html')) {
          return cors(new Response(res2.body, {
            status: 200,
            headers: {
              'Content-Type': ct2.includes('audio') ? ct2 : 'audio/mpeg',
              'Content-Length': res2.headers.get('Content-Length') || ''
            }
          }));
        }
      } catch(e) { /* try next */ }
    }

    return jsonResp({ error: 'Could not download from Drive. Make sure the file is shared with "Anyone with the link" and try passing your Google access token.' }, 403);
  } catch (e) { return jsonResp({ error: e.message }, 500); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Google Drive Audio Stream (GET) ──────────────────────────────────────────
// GET /drive-stream?fileId=XXX&token=YYY
// Safari can't use googleapis.com URLs as <audio> src (CORS/auth issues).
// This endpoint proxies the Drive API response so the <audio> element
// streams from our Worker domain. Supports Range requests for seeking.
async function handleDriveStream(request) {
  try {
    const url = new URL(request.url);
    const fileId = url.searchParams.get('fileId');
    const token = url.searchParams.get('token');
    if (!fileId || !token) return cors(new Response('fileId and token required', { status: 400 }));

    const apiUrl = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&supportsAllDrives=true';
    const headers = { 'Authorization': 'Bearer ' + token };

    // Forward Range header for seeking support
    const rangeHeader = request.headers.get('Range');
    if (rangeHeader) headers['Range'] = rangeHeader;

    const res = await fetch(apiUrl, { headers: headers });
    if (!res.ok) {
      var errBody = '';
      try { errBody = await res.text(); } catch(e) {}
      return cors(new Response(errBody || 'Drive API error', { status: res.status }));
    }

    // Build response headers — pass through content info from Drive
    var respHeaders = {
      'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    };
    if (res.headers.get('Content-Length')) respHeaders['Content-Length'] = res.headers.get('Content-Length');
    if (res.headers.get('Content-Range')) respHeaders['Content-Range'] = res.headers.get('Content-Range');

    return new Response(res.body, {
      status: res.status, // 200 for full, 206 for partial
      headers: respHeaders
    });
  } catch (e) {
    return cors(new Response(e.message, { status: 502 }));
  }
}

// Archive.org Search v2 — structured queries + source type detection
// ══════════════════════════════════════════════════════════════════════════════
function parseSourceType(srcStr) {
  const s = (srcStr || '').toLowerCase();
  if (/\bsbd\b|soundboard|betty/i.test(s)) return 'SBD';
  if (/\bmatrix\b|\bmtx\b/i.test(s)) return 'Matrix';
  if (/\baud\b|audience|\bfob\b|schoeps|nakamichi/i.test(s)) return 'AUD';
  if (/\bfm\b|radio|broadcast/i.test(s)) return 'SBD';
  return 'Unknown';
}

async function handleArchiveSearch(request) {
  const { query, sort, rows } = await request.json();
  if (!query) return jsonResp({ error: 'No query' }, 400);

  const isStructured = /collection:|creator:|description:/.test(query);
  const maxRows = rows || 30;
  const sortParam = sort || 'downloads+desc';
  const base = '&fl[]=identifier&fl[]=title&fl[]=date&fl[]=avg_rating&fl[]=num_reviews&fl[]=downloads&fl[]=source&output=json';

  try {
    let results = [];

    if (isStructured) {
      // Frontend sent well-formed query — use directly
      const url1 = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(query) + base + '&sort[]=' + sortParam + '&rows=' + maxRows;
      try { const r = await fetch(url1); if (r.ok) { const d = await r.json(); results = d?.response?.docs || []; } } catch(e) {}

      // Fallback if description search found < 5
      if (results.length < 5 && query.includes('description:')) {
        const songMatch = query.match(/description:"([^"]+)"/);
        const collMatch = query.match(/(collection:\S+|\(collection:\S+\s+OR\s+creator:"[^"]+"\)|creator:"[^"]+")/);
        if (songMatch && collMatch) {
          const url2 = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(collMatch[1] + ' AND "' + songMatch[1] + '"') + base + '&sort[]=downloads+desc&rows=20';
          try { const r = await fetch(url2); if (r.ok) { const d = await r.json();
            const seen = new Set(results.map(x => x.identifier));
            for (const doc of (d?.response?.docs || [])) { if (!seen.has(doc.identifier)) results.push(doc); }
          }} catch(e) {}
        }
      }
    } else {
      // Legacy unstructured — detect band
      const bandMap = {
        'grateful dead': 'GratefulDead', 'the grateful dead': 'GratefulDead', 'dead': 'GratefulDead', 'gd': 'GratefulDead',
        'jerry garcia': 'JerryGarcia', 'jgb': 'JerryGarcia', 'jerry garcia band': 'JerryGarcia',
        'phish': 'Phish', 'widespread panic': 'WidespreadPanic', 'wsp': 'WidespreadPanic',
        'allman brothers': 'AllmanBrothersBand', 'allman brothers band': 'AllmanBrothersBand', 'abb': 'AllmanBrothersBand',
        'dave matthews': 'DaveMatthewsBand', 'dave matthews band': 'DaveMatthewsBand', 'dmb': 'DaveMatthewsBand',
        'goose': 'GooseBand', 'string cheese': 'StringCheeseIncident', 'sci': 'StringCheeseIncident',
        'moe.': 'moeperiod', 'moe': 'moeperiod', "umphrey's mcgee": 'UmphreysMcGee', 'umphreys': 'UmphreysMcGee',
        'tedeschi trucks': 'TedeschiTrucksBand'
      };
      let collection = 'GratefulDead', songQuery = query.trim();
      const qLow = query.toLowerCase().trim();
      for (const name of Object.keys(bandMap).sort((a,b) => b.length - a.length)) {
        if (qLow.includes(name)) { collection = bandMap[name]; songQuery = query.replace(new RegExp(name, 'gi'), '').trim(); break; }
      }
      if (!songQuery) songQuery = query;

      let collPart = 'collection:' + collection;
      if (collection === 'Phish') collPart = '(collection:Phish OR creator:"Phish")';
      else if (collection === 'DaveMatthewsBand') collPart = 'creator:"Dave Matthews Band"';

      const songEnc = encodeURIComponent('"' + songQuery + '"');
      const url1 = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(collPart) + '+AND+description:' + songEnc + base + '&sort[]=' + sortParam + '&rows=' + maxRows;
      try { const r = await fetch(url1); if (r.ok) { const d = await r.json(); results = d?.response?.docs || []; } } catch(e) {}

      if (results.length < 5) {
        const url2 = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent(collPart) + '+AND+' + songEnc + base + '&sort[]=downloads+desc&rows=20';
        try { const r = await fetch(url2); if (r.ok) { const d = await r.json();
          const seen = new Set(results.map(x => x.identifier));
          for (const doc of (d?.response?.docs || [])) { if (!seen.has(doc.identifier)) results.push(doc); }
        }} catch(e) {}
      }
    }

    return jsonResp({
      results: results.map(d => ({
        identifier: d.identifier, title: d.title, date: d.date,
        rating: d.avg_rating, reviews: d.num_reviews, downloads: d.downloads,
        source: d.source, sourceType: parseSourceType(d.source)
      })),
      total: results.length
    });
  } catch(e) { return jsonResp({ error: e.message }, 500); }
}

// ── Archive.org File Listing ────────────────────────────────────────────────
async function handleArchiveFiles(request) {
  const { identifier } = await request.json();
  if (!identifier) return jsonResp({ error: 'No identifier' }, 400);
  try {
    const res = await fetch('https://archive.org/metadata/' + identifier);
    if (!res.ok) return jsonResp({ error: 'Metadata failed' }, 502);
    const meta = await res.json();
    const audioFormats = ['VBR MP3', 'MP3', 'Ogg Vorbis', 'Flac', '128Kbps MP3', '64Kbps MP3'];
    const files = (meta.files || [])
      .filter(f => audioFormats.some(af => (f.format || '').includes(af)) || /\.(mp3|ogg|flac)$/i.test(f.name))
      .map(f => ({
        name: f.name, format: f.format, size: f.size, length: f.length, title: f.title,
        url: 'https://archive.org/download/' + identifier + '/' + encodeURIComponent(f.name)
      }));
    const srcFields = [meta.metadata?.source, meta.metadata?.lineage, meta.metadata?.taper].filter(Boolean).join(' ');
    return jsonResp({ files, title: meta.metadata?.title, date: meta.metadata?.date, sourceType: parseSourceType(srcFields), source: meta.metadata?.source || '' });
  } catch(e) { return jsonResp({ error: e.message }, 500); }
}

// ══════════════════════════════════════════════════════════════════════════════
// Relisten API — find shows by song, with tape counts + SBD flags
// ══════════════════════════════════════════════════════════════════════════════
async function handleRelistenSearch(request) {
  const { songTitle, bandSlug } = await request.json();
  if (!songTitle) return jsonResp({ error: 'No songTitle' }, 400);

  const slugMap = {
    'GD': 'grateful-dead', 'Grateful Dead': 'grateful-dead',
    'JGB': 'jerry-garcia-band', 'Jerry Garcia Band': 'jerry-garcia-band',
    'Phish': 'phish', 'WSP': 'widespread-panic', 'Widespread Panic': 'widespread-panic',
    'ABB': 'allman-brothers-band', 'Allman Brothers': 'allman-brothers-band',
    'DMB': 'dave-matthews-band', 'Dave Matthews Band': 'dave-matthews-band',
    'Goose': 'goose', 'SCI': 'string-cheese-incident', 'moe.': 'moe'
  };
  const slug = slugMap[bandSlug] || bandSlug || 'grateful-dead';
  const ua = 'GrooveLinx/1.0 (band practice app)';

  try {
    // Primary API only — alecgorge.com has SSL cert issues
    const apiBase = 'https://api.relisten.net';
    const songsUrl = apiBase + '/api/v3/artists/' + slug + '/songs';
    let songsRes;
    try {
      songsRes = await fetch(songsUrl, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
    } catch(e) {
      return jsonResp({ results: [], error: 'Relisten API connection failed: ' + e.message, debug: { url: songsUrl } });
    }
    if (!songsRes.ok) return jsonResp({ results: [], error: 'Relisten API returned ' + songsRes.status, debug: { url: songsUrl } });

    const songsRaw = await songsRes.json();
    // API may return array directly or nested under a key
    const songsData = Array.isArray(songsRaw) ? songsRaw : (songsRaw.data || songsRaw.songs || []);
    if (!songsData.length) return jsonResp({ results: [], error: 'Relisten returned empty song list for ' + slug, debug: { responseKeys: Object.keys(songsRaw), type: typeof songsRaw } });

    const cleanTitle = songTitle.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
    let matchedSong = null;
    // Try exact match first, then includes
    for (const s of songsData) {
      const sName = (s.name || s.slug || '').toLowerCase();
      if (sName === cleanTitle) { matchedSong = s; break; }
    }
    if (!matchedSong) {
      for (const s of songsData) {
        const sName = (s.name || s.slug || '').toLowerCase();
        if (sName.includes(cleanTitle) || cleanTitle.includes(sName)) { matchedSong = s; break; }
      }
    }
    if (!matchedSong) return jsonResp({ results: [], matched: false, songTitle, debug: { cleanTitle, totalSongs: songsData.length, sampleNames: songsData.slice(0, 5).map(s => s.name || s.slug) } });

    const showsRes = await fetch(apiBase + '/api/v3/artists/' + slug + '/songs/' + matchedSong.slug, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
    if (!showsRes.ok) return jsonResp({ results: [], error: 'Relisten shows error: ' + showsRes.status });
    const showsData = await showsRes.json();

    const showsList = showsData.shows || showsData.data || [];
    const shows = showsList.map(sh => ({
      date: sh.display_date || sh.date, venue: sh.venue?.name || '',
      city: sh.venue?.city || '', state: sh.venue?.state || '',
      tapeCount: sh.source_count || 0, duration: sh.duration || 0,
      avgRating: sh.avg_rating || 0,
      relistenUrl: 'https://relisten.net/' + slug + '/' + (sh.display_date || '').replace(/-/g, '/'),
      hasSbd: sh.has_soundboard_source || false
    }));
    shows.sort((a, b) => b.tapeCount - a.tapeCount);

    return jsonResp({ results: shows.slice(0, 30), songName: matchedSong.name, timesPlayed: showsList.length, bandSlug: slug });
  } catch(e) { return jsonResp({ error: e.message, results: [] }, 500); }
}

// ══════════════════════════════════════════════════════════════════════════════
// Phish.net Jam Charts — curated "best version" data (Phish only)
// ══════════════════════════════════════════════════════════════════════════════
async function handlePhishNetJamChart(request, env) {
  const { songTitle } = await request.json();
  if (!songTitle) return jsonResp({ error: 'No songTitle' }, 400);

  const apiKey = env.PHISHNET_API_KEY || '7E83A77012D1BE8A5CB2';
  try {
    const cleanTitle = songTitle.replace(/\s*\(.*?\)\s*/g, '').trim();
    const slug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Try setlists endpoint to find all shows with this song + jamchart flags
    const slUrl = 'https://api.phish.net/v5/setlists/slug/' + encodeURIComponent(slug) + '.json?apikey=' + apiKey + '&order_by=showdate&direction=desc';
    const slRes = await fetch(slUrl, { headers: { 'User-Agent': 'GrooveLinx/1.0' } });
    if (!slRes.ok) {
      // Try with song name directly
      const slUrl2 = 'https://api.phish.net/v5/setlists/song/' + encodeURIComponent(cleanTitle) + '.json?apikey=' + apiKey + '&order_by=showdate&direction=desc';
      const slRes2 = await fetch(slUrl2, { headers: { 'User-Agent': 'GrooveLinx/1.0' } });
      if (!slRes2.ok) return jsonResp({ results: [], error: 'Phish.net lookup failed: ' + slRes.status });
      const slData2 = await slRes2.json();
      const entries2 = (slData2.data || []).filter(e => e.isjamchart === '1').map(e => ({
        showdate: e.showdate, venue: e.venue, city: e.city, state: e.state,
        isjamchart: true, jamchart_description: e.jamchart_description || '',
        tracktime: e.tracktime, permalink: e.permalink
      }));
      return jsonResp({ results: entries2.slice(0, 25), source: 'setlists', totalPlayed: slData2.data?.length || 0 });
    }

    const slData = await slRes.json();
    const allEntries = slData.data || [];
    const jamcharts = allEntries.filter(e => e.isjamchart === '1').map(e => ({
      showdate: e.showdate, venue: e.venue, city: e.city, state: e.state,
      isjamchart: true, jamchart_description: e.jamchart_description || '',
      tracktime: e.tracktime, permalink: e.permalink
    }));

    return jsonResp({ results: jamcharts.slice(0, 25), source: 'setlists', songSlug: slug, totalPlayed: allEntries.length });
  } catch(e) { return jsonResp({ error: e.message, results: [] }, 500); }
}

// ══════════════════════════════════════════════════════════════════════════════
// Phish.in — audience recordings with per-track likes (Phish only)
// ══════════════════════════════════════════════════════════════════════════════
async function handlePhishInSearch(request) {
  const { songTitle } = await request.json();
  if (!songTitle) return jsonResp({ error: 'No songTitle' }, 400);
  const cleanTitle = songTitle.replace(/\s*\(.*?\)\s*/g, '').trim();
  const ua = 'GrooveLinx/1.0';
  try {
    const searchUrl = 'https://phish.in/api/v2/songs?term=' + encodeURIComponent(cleanTitle);
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
    if (!searchRes.ok) return jsonResp({ results: [], error: 'Phish.in error: ' + searchRes.status });
    const searchData = await searchRes.json();
    const songs = searchData.data || searchData || [];

    const matchedSong = songs.find(s => {
      const sTitle = (s.title || s.name || '').toLowerCase();
      return sTitle === cleanTitle.toLowerCase() || sTitle.includes(cleanTitle.toLowerCase());
    });
    if (!matchedSong) return jsonResp({ results: [], matched: false });

    const songSlug = matchedSong.slug || matchedSong.id;
    const tracksUrl = 'https://phish.in/api/v2/songs/' + songSlug + '?include=tracks';
    const tracksRes = await fetch(tracksUrl, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
    if (!tracksRes.ok) return jsonResp({ results: [], error: 'Phish.in tracks error' });
    const tracksData = await tracksRes.json();

    const tracks = (tracksData.data?.tracks || tracksData.tracks || []).map(t => ({
      date: t.show_date, duration: t.duration, likes: t.likes_count || 0,
      tags: (t.tags || []).map(tag => tag.name || tag),
      isJamchart: (t.tags || []).some(tag => (tag.name || tag || '').toLowerCase().includes('jamchart')),
      mp3Url: t.mp3_url || t.mp3, venue: t.venue_name || '', showId: t.show_id
    }));
    tracks.sort((a, b) => b.likes - a.likes);

    return jsonResp({ results: tracks.slice(0, 30), songTitle: matchedSong.title || matchedSong.name, timesPlayed: tracks.length });
  } catch(e) { return jsonResp({ error: e.message, results: [] }, 500); }
}

// ── Genius Search ───────────────────────────────────────────────────────────
async function handleGeniusSearch(request) {
  const { query } = await request.json();
  if (!query) return jsonResp({ error: 'No query' }, 400);
  try {
    const res = await fetch('https://genius.com/api/search/multi?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } });
    const data = await res.json();
    const songs = [];
    for (const section of (data?.response?.sections || [])) {
      for (const hit of (section.hits || [])) {
        if (hit.type === 'song' && hit.result) songs.push({ id: hit.result.id, title: hit.result.title, artist: hit.result.primary_artist?.name, url: hit.result.url });
      }
    }
    return jsonResp({ results: songs.slice(0, 5) });
  } catch(e) { return jsonResp({ error: e.message }, 500); }
}

// ── Genius Song Meaning Fetch ───────────────────────────────────────────────
async function handleGeniusFetch(request) {
  const { songId, url } = await request.json();
  if (!songId && !url) return jsonResp({ error: 'Need songId or url' }, 400);
  const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  try {
    let description = '';
    if (songId) { try { const r = await fetch('https://genius.com/api/songs/' + songId, { headers: { 'User-Agent': ua } }); if (r.ok) { const d = await r.json(); description = d?.response?.song?.description?.plain || ''; } } catch(e) {} }
    if (!description && url) { try { const r = await fetch(url, { headers: { 'User-Agent': ua } }); if (r.ok) { const html = await r.text(); const m = html.match(/"description"\s*:\s*\{"html"\s*:\s*"((?:[^"\\]|\\.)*)"/); if (m) { const decoded = m[1].replace(/\\n/g,' ').replace(/\\"/g,'"').replace(/<[^>]+>/g,'').trim(); if (decoded.length > 20) description = decoded; } } } catch(e) {} }
    return jsonResp({ description: description || '', source: description ? 'found' : 'empty' });
  } catch(e) { return jsonResp({ error: e.message }, 500); }
}

// ── YouTube Search ──────────────────────────────────────────────────────────
async function handleYouTubeSearch(request) {
  const { query } = await request.json();
  if (!query) return jsonResp({ error: 'No query' }, 400);
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  try {
    const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    const res = await fetch(ytUrl, { headers: { 'User-Agent': ua, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html',
      'Cookie': 'CONSENT=PENDING+999; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMxMDE2LjA3X3AxGgJlbiACGgYIgJnPqgY' } });
    if (!res.ok) return jsonResp({ results: [], error: 'YouTube HTTP ' + res.status });
    const html = await res.text();
    let jsonStr = null;
    for (const pat of [/var\s+ytInitialData\s*=\s*({.+?})\s*;\s*<\/script/s, /ytInitialData\s*=\s*({.+?})\s*;\s*<\/script/s]) { const m = html.match(pat); if (m) { jsonStr = m[1]; break; } }
    if (!jsonStr) return jsonResp({ results: [], error: 'parse_failed' });
    const ytData = JSON.parse(jsonStr);
    const sections = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    let items = []; for (const s of sections) items = items.concat(s?.itemSectionRenderer?.contents || []);
    const results = items.filter(c => c.videoRenderer).slice(0, 12).map(c => {
      const v = c.videoRenderer; const durText = v.lengthText?.simpleText || '';
      let secs = 0; const parts = durText.split(':').map(Number);
      if (parts.length === 2) secs = parts[0] * 60 + parts[1];
      if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
      return { title: v.title?.runs?.[0]?.text || '', videoId: v.videoId, author: v.ownerText?.runs?.[0]?.text || '', lengthSeconds: secs, duration: durText, url: 'https://www.youtube.com/watch?v=' + v.videoId };
    });
    return jsonResp({ results });
  } catch(e) { return jsonResp({ error: e.message, results: [] }); }
}

// ── YouTube/Spotify Audio Extraction ────────────────────────────────────────
async function handleYouTubeAudio(request) {
  const { url } = await request.json();
  if (!url) return jsonResp({ error: 'No URL' }, 400);
  if (!/youtube\.com|youtu\.be|open\.spotify\.com/i.test(url)) return jsonResp({ error: 'URL must be YouTube or Spotify' }, 400);
  for (const apiBase of ['https://api.cobalt.tools']) {
    try { const r = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, audioFormat: 'mp3', downloadMode: 'audio' }) }); if (r.ok) { const d = await r.json(); if (d.url) return jsonResp({ audioUrl: d.url, service: 'cobalt' }); } } catch(e) {}
    try { const r = await fetch(apiBase + '/api/json', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ url, aFormat: 'mp3', isAudioOnly: true }) }); if (r.ok) { const d = await r.json(); if (d.url || d.audio) return jsonResp({ audioUrl: d.url || d.audio, service: 'cobalt-legacy' }); } } catch(e) {}
  }
  return jsonResp({ error: 'Audio extraction failed. Try downloading manually and using Direct URL.' }, 502);
}

// ── Flux Schnell AI Image Generation ────────────────────────────────────────
async function handleGenerateImage(request, env) {
  if (!env.AI) return jsonResp({ error: 'AI binding not configured.' }, 500);
  try {
    const { prompt, steps } = await request.json();
    if (!prompt) return jsonResp({ error: 'No prompt' }, 400);
    const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: steps || 6 });
    if (response && response.image) return jsonResp({ image: response.image });
    return jsonResp({ error: 'No image returned from Flux' }, 500);
  } catch(e) { return jsonResp({ error: e.message }, 500); }
}

// ── MIDI → ABC Converter ────────────────────────────────────────────────────
async function handleMidi2Abc(request) {
  try { const buf = await request.arrayBuffer(); return jsonResp({ abc: midiToAbc(new Uint8Array(buf)) }); }
  catch (e) { return jsonResp({ error: e.message }, 500); }
}
const NOTE_NAMES = ['C','^C','D','^D','E','F','^F','G','^G','A','^A','B'];
function midiPitchToAbc(pitch) { const oct = Math.floor(pitch / 12) - 1, name = NOTE_NAMES[pitch % 12]; if (oct <= 3) return name + ','.repeat(Math.max(0, 3 - oct)); if (oct === 4) return name; if (oct === 5) return name.toLowerCase(); return name.toLowerCase() + "'".repeat(oct - 5); }
function ticksToDur(ticks, tpb) { const r = ticks / (tpb / 2); return [[0.25,'/4'],[0.5,'/2'],[1,''],[1.5,'3/2'],[2,'2'],[3,'3'],[4,'4'],[6,'6'],[8,'8']].reduce((b,d) => Math.abs(r-d[0]) < Math.abs(r-b[0]) ? d : b)[1]; }
function noteToAbc(n, tpb) { return n.isRest ? 'z'+ticksToDur(n.dur,tpb) : midiPitchToAbc(n.pitch)+ticksToDur(n.dur,tpb); }
function extractNotes(events, tpb) {
  const ons = new Map(), notes = []; let tick = 0;
  for (const e of events) { tick += e.delta; if (e.type === 'on' && e.vel > 0) ons.set(e.pitch, tick); else if (e.type === 'off' || (e.type === 'on' && e.vel === 0)) { if (ons.has(e.pitch)) { notes.push({ pitch: e.pitch, start: ons.get(e.pitch), dur: tick - ons.get(e.pitch) }); ons.delete(e.pitch); } } }
  notes.sort((a,b) => a.start - b.start);
  const result = []; let cursor = 0;
  for (const n of notes) { if (n.start > cursor) result.push({ isRest:true, dur: n.start - cursor }); result.push({ pitch: n.pitch, dur: n.dur, isRest: false }); cursor = n.start + n.dur; }
  return result;
}
function parseMidi(bytes) {
  let p = 0; const r = n => { const s=p; p+=n; return bytes.slice(s,p); }; const u32 = () => { const b=r(4); return (b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3]; }; const u16 = () => { const b=r(2); return (b[0]<<8)|b[1]; }; const vl = () => { let v=0,b; do { b=bytes[p++]; v=(v<<7)|(b&0x7f); } while(b&0x80); return v; };
  if (String.fromCharCode(...r(4)) !== 'MThd') return null;
  u32(); const fmt=u16(), nTrk=u16(), tpb=u16(); let bpm=120, timeSig={num:4,den:4}; const tracks=[];
  for (let t=0; t<nTrk; t++) { const tag=String.fromCharCode(...r(4)), len=u32(); if (tag !== 'MTrk') { p+=len; continue; } const end=p+len, evts=[]; let rs=0;
    while (p<end) { const delta=vl(); let sb=bytes[p]; if (sb&0x80) { rs=sb; p++; } else { sb=rs; } const type=(sb>>4)&0xf;
      if (sb===0xff) { const mt=bytes[p++],ml=vl(),md=r(ml); if(mt===0x51&&ml===3) bpm=60000000/((md[0]<<16)|(md[1]<<8)|md[2]); if(mt===0x58&&ml===4) timeSig={num:md[0],den:Math.pow(2,md[1])}; }
      else if (sb===0xf0||sb===0xf7) { p+=vl(); } else if (type===9) { const pitch=bytes[p++],vel=bytes[p++]; evts.push({delta,type:'on',pitch,vel}); }
      else if (type===8) { const pitch=bytes[p++]; p++; evts.push({delta,type:'off',pitch}); } else if (type>=8&&type<=14) { p+=(type===12||type===13)?1:2; } }
    p=end; tracks.push(evts); }
  return {fmt,tpb,bpm,timeSig,tracks};
}
function midiToAbc(bytes) {
  const midi=parseMidi(bytes); if (!midi) throw new Error('Invalid MIDI');
  const {tpb,bpm,timeSig,tracks}=midi;
  const voices=tracks.map((t,i)=>({name:'V'+(i+1),notes:extractNotes(t,tpb)})).filter(v=>v.notes.length>0);
  if (!voices.length) return 'X:1\nT:Imported Harmony\nM:'+timeSig.num+'/'+timeSig.den+'\nQ:1/4='+Math.round(bpm)+'\nL:1/8\nK:C\nz4 |]';
  const lines=['X:1','T:Imported Harmony','M:'+timeSig.num+'/'+timeSig.den,'Q:1/4='+Math.round(bpm),'L:1/8','K:C'];
  if (voices.length===1) { lines.push(voices[0].notes.map(n=>noteToAbc(n,tpb)).join(' ')); }
  else { const roles=['Lead','Harmony 1','Harmony 2','Bass']; for (let i=0;i<voices.length;i++) lines.push('V:'+(i+1)+' name="'+(roles[i]||'Part '+(i+1))+'"'); for (let i=0;i<voices.length;i++) { lines.push('[V:'+(i+1)+']'); lines.push(voices[i].notes.map(n=>noteToAbc(n,tpb)).join(' ')); } }
  return lines.join('\n');
}

// ── Spotify Search (Client Credentials) ──────────────────────────────────────
// Uses Spotify Web API — requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET as Cloudflare secrets
let _spotifyToken = null;
let _spotifyTokenExpiry = 0;

async function getSpotifyToken(env) {
  if (_spotifyToken && Date.now() < _spotifyTokenExpiry) return _spotifyToken;
  const cid = env.SPOTIFY_CLIENT_ID;
  const secret = env.SPOTIFY_CLIENT_SECRET;
  if (!cid || !secret) throw new Error('Spotify credentials not configured');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(cid + ':' + secret)
    },
    body: 'grant_type=client_credentials'
  });
  if (!res.ok) throw new Error('Spotify auth failed: ' + res.status);
  const data = await res.json();
  _spotifyToken = data.access_token;
  _spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _spotifyToken;
}

async function handleSpotifySearch(request, env) {
  try {
    const { query, type, limit, debug } = await request.json();
    if (!query) return jsonResp({ error: 'No query' }, 400);
    const token = await getSpotifyToken(env);
    const searchType = type || 'track';
    const searchLimit = Math.min(limit || 10, 10);
    const url = 'https://api.spotify.com/v1/search?q=' + encodeURIComponent(query) +
      '&type=' + searchType + '&limit=' + searchLimit + '&market=US';
    let res = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    // If 401, token may be stale — clear and retry once
    if (res.status === 401) {
      _spotifyToken = null; _spotifyTokenExpiry = 0;
      const newToken = await getSpotifyToken(env);
      res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + newToken } });
    }
    if (!res.ok) {
      const errBody = await res.text().catch(() => 'no body');
      return jsonResp({ error: 'Spotify API ' + res.status, detail: errBody.substring(0, 500), url: url.replace(token, 'TOKEN'), results: [] });
    }
    const data = await res.json();
    // Normalize track results
    const tracks = (data.tracks?.items || []).map(t => ({
      id: t.id,
      name: t.name,
      artist: (t.artists || []).map(a => a.name).join(', '),
      album: t.album?.name || '',
      albumArt: t.album?.images?.[0]?.url || '',
      albumArtSmall: (t.album?.images || []).find(i => i.width <= 64)?.url || t.album?.images?.[t.album.images.length - 1]?.url || '',
      duration: t.duration_ms,
      durationStr: Math.floor(t.duration_ms / 60000) + ':' + String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, '0'),
      url: t.external_urls?.spotify || '',
      previewUrl: t.preview_url || '',
      popularity: t.popularity || 0,
      explicit: t.explicit || false,
      releaseDate: t.album?.release_date || '',
      isrc: t.external_ids?.isrc || ''
    }));
    return jsonResp({ results: tracks });
  } catch(e) { return jsonResp({ error: e.message, results: [] }, 500); }
}

// ── Odesli / Songlink — Cross-platform links ────────────────────────────────
// Free API, no key needed. Returns links for Spotify, Apple Music, Tidal, etc.
async function handleOdesliLinks(request) {
  try {
    const { url } = await request.json();
    if (!url) return jsonResp({ error: 'No URL' }, 400);
    const apiUrl = 'https://api.song.link/v1-alpha.1/links?url=' + encodeURIComponent(url) + '&userCountry=US';
    const res = await fetch(apiUrl, { headers: { 'User-Agent': 'GrooveLinx/1.0' } });
    if (!res.ok) return jsonResp({ error: 'Odesli API ' + res.status, links: {} }, res.status);
    const data = await res.json();
    // Extract platform links
    var links = {};
    var platforms = ['spotify', 'appleMusic', 'youtube', 'youtubeMusic', 'tidal', 'amazonMusic', 'deezer', 'soundcloud', 'pandora'];
    platforms.forEach(function(p) {
      if (data.linksByPlatform?.[p]) {
        links[p] = {
          url: data.linksByPlatform[p].url,
          entityUniqueId: data.linksByPlatform[p].entityUniqueId
        };
      }
    });
    // Get title/artist from first available entity
    var title = '', artist = '', thumbnail = '';
    var entities = data.entitiesByUniqueId || {};
    var firstEntity = Object.values(entities)[0];
    if (firstEntity) {
      title = firstEntity.title || '';
      artist = firstEntity.artistName || '';
      thumbnail = firstEntity.thumbnailUrl || '';
    }
    return jsonResp({ links, title, artist, thumbnail, pageUrl: data.pageUrl || '' });
  } catch(e) { return jsonResp({ error: e.message, links: {} }, 500); }
}

// ── Google Calendar API Proxy ─────────────────────────────────────────────────
// Forwards user's OAuth access token to Google Calendar API.
// No API keys stored in worker — the user's token provides authorization.
// Routes:
//   POST   /calendar/events          → calendar.events.insert
//   PATCH  /calendar/events/:eventId → calendar.events.patch
//   DELETE /calendar/events/:eventId → calendar.events.delete

async function handleCalendarProxy(request, method, calendarId, eventId) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return cors(new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
      status: 401, headers: { 'Content-Type': 'application/json' }
    }));
  }

  const baseUrl = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calendarId) + '/events';
  let googleUrl = baseUrl;
  if (eventId) googleUrl += '/' + encodeURIComponent(eventId);

  const fetchOpts = {
    method: method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json'
    }
  };

  // Forward request body for POST and PATCH
  if (method === 'POST' || method === 'PATCH') {
    const body = await request.text();
    fetchOpts.body = body;
    // Add sendUpdates=all to automatically send invite emails
    googleUrl += (googleUrl.includes('?') ? '&' : '?') + 'sendUpdates=all';
  }

  try {
    const googleRes = await fetch(googleUrl, fetchOpts);
    const responseBody = await googleRes.text();
    return cors(new Response(responseBody, {
      status: googleRes.status,
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (err) {
    return cors(new Response(JSON.stringify({ error: 'Google Calendar API error: ' + err.message }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    }));
  }
}

// ── Google Calendar Free/Busy Query ──────────────────────────────────────────
// POST /calendar/freebusy → Google freeBusy.query
// Body: { timeMin, timeMax, items: [{ id: calendarId }] }
async function handleCalendarFreeBusy(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return cors(new Response('Unauthorized', { status: 401 }));
  try {
    const body = await request.text();
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      body: body
    });
    const data = await res.text();
    return cors(new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } }));
  } catch (err) {
    return cors(new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } }));
  }
}

// ── Google Calendar List — returns user's calendar list for selection UI ──────
// GET /calendar/list
async function handleCalendarList(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return cors(new Response('Unauthorized', { status: 401 }));
  try {
    const googleUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=freeBusyReader&maxResults=100';
    const res = await fetch(googleUrl, { headers: { 'Authorization': authHeader } });
    const data = await res.text();
    return cors(new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } }));
  } catch (err) {
    return cors(new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } }));
  }
}

// ── Google Calendar List Events ──────────────────────────────────────────────
// GET /calendar/events?timeMin=...&timeMax=...
async function handleCalendarListEvents(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return cors(new Response('Unauthorized', { status: 401 }));
  try {
    const url = new URL(request.url);
    const params = new URLSearchParams();
    if (url.searchParams.get('timeMin')) params.set('timeMin', url.searchParams.get('timeMin'));
    if (url.searchParams.get('timeMax')) params.set('timeMax', url.searchParams.get('timeMax'));
    params.set('singleEvents', 'true');
    params.set('orderBy', 'startTime');
    params.set('maxResults', url.searchParams.get('maxResults') || '250');
    if (url.searchParams.get('pageToken')) params.set('pageToken', url.searchParams.get('pageToken'));
    const calId = url.searchParams.get('calendarId') || 'primary';
    const googleUrl = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calId) + '/events?' + params.toString();
    const res = await fetch(googleUrl, { headers: { 'Authorization': authHeader } });
    const data = await res.text();
    return cors(new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } }));
  } catch (err) {
    return cors(new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } }));
  }
}

// ── Google Calendar Get Single Event ─────────────────────────────────────────
// GET /calendar/events/:eventId → read event with attendee status
async function handleCalendarGetEvent(request, eventId) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return cors(new Response('Unauthorized', { status: 401 }));
  try {
    const googleUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events/' + encodeURIComponent(eventId);
    const res = await fetch(googleUrl, { headers: { 'Authorization': authHeader } });
    const data = await res.text();
    return cors(new Response(data, { status: res.status, headers: { 'Content-Type': 'application/json' } }));
  } catch (err) {
    return cors(new Response(JSON.stringify({ error: err.message }), { status: 502, headers: { 'Content-Type': 'application/json' } }));
  }
}

// ── ICS Calendar Feed ─────────────────────────────────────────────────────────
// GET /ical/:bandSlug  → Live VCALENDAR ICS feed for Google/Apple/Outlook.
// Band members subscribe once — events auto-update via 1h cache TTL.
//
// Firebase path: /bands/{bandSlug}/_band/calendar_events
// UID stability: ev.id > ev.uid > ev.created (never hash title+date)
// Schema: supports both current {date,time} and future {start_at,end_at}

const FIREBASE_PROJECT = 'deadcetera-35424';
const FIREBASE_BASE    = 'https://' + FIREBASE_PROJECT + '-default-rtdb.firebaseio.com';

async function handleICalFeed(request, env, path) {
  try {
    // Sanitize slug — only lowercase alphanumeric, hyphens, underscores
    const bandSlug = path.replace('/ical/', '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    if (!bandSlug) {
      return new Response('Band slug required. Use /ical/deadcetera', { status: 400 });
    }

    // Read events from Firebase REST (no auth needed for public band data)
    const fbUrl = FIREBASE_BASE + '/bands/' + bandSlug + '/_band/calendar_events.json';
    let fbRes;
    try {
      fbRes = await fetch(fbUrl, { headers: { 'Accept': 'application/json' } });
    } catch (fetchErr) {
      return new Response('Firebase unreachable: ' + fetchErr.message, { status: 502 });
    }
    if (fbRes.status === 404) {
      // Band exists but has no events — return valid empty calendar
      return icsResponse(icsCalendar([], bandSlug), bandSlug);
    }
    if (!fbRes.ok) {
      return new Response('Firebase error ' + fbRes.status, { status: 502 });
    }

    const raw = await fbRes.json();
    // Firebase returns null when path is empty, object when populated, or array
    let events = [];
    if (Array.isArray(raw)) {
      events = raw.filter(Boolean);
    } else if (raw && typeof raw === 'object') {
      events = Object.values(raw).filter(Boolean);
    }
    // raw === null means no events — valid, return empty calendar

    return icsResponse(icsCalendar(events, bandSlug), bandSlug);

  } catch(e) {
    // Return error as valid ICS with descriptive X-ERROR header
    // rather than returning non-ICS text which breaks subscribed clients
    return new Response(
      'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GrooveLinx//Band Calendar//EN\r\nX-ERROR:' + e.message + '\r\nEND:VCALENDAR',
      { status: 200, headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

function icsResponse(icsString, bandSlug) {
  return new Response(icsString, {
    status: 200,
    headers: {
      // text/calendar is the correct MIME type per RFC 5545
      'Content-Type': 'text/calendar; charset=utf-8',
      // inline so Google Calendar can read it directly; attachment for direct-download browsers
      'Content-Disposition': 'inline; filename="' + bandSlug + '-groovelinx.ics"',
      // 1h cache: subscribed clients re-fetch hourly. Matches X-PUBLISHED-TTL in body.
      // Must NOT be no-store or Google Calendar subscription breaks.
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

function icsCalendar(events, bandSlug) {
  const slug    = bandSlug || 'groovelinx';
  const calName = 'GrooveLinx \u2014 ' + slug.charAt(0).toUpperCase() + slug.slice(1) + ' Band Calendar';
  const nowStr  = icsUTCStr(new Date());

  const vevents = events
    .filter(function(ev) { return ev && (ev.date || ev.start_at); })
    .map(function(ev) { return icsVEvent(ev, nowStr); })
    .filter(Boolean)
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GrooveLinx//Band Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    icsFold('X-WR-CALNAME:' + icsEsc(calName)),
    'X-WR-TIMEZONE:America/New_York',
    'X-PUBLISHED-TTL:PT1H',
    vevents,
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
}

function icsVEvent(ev, nowStr) {
  try {
    // Time parsing: prefer future schema (start_at/end_at), fall back to date+time
    let start, end;
    if (ev.start_at) {
      start = new Date(ev.start_at);
      end   = ev.end_at ? new Date(ev.end_at) : new Date(start.getTime() + 7200000);
    } else {
      const timeStr = (ev.time && /^\d{1,2}:\d{2}$/.test(ev.time)) ? ev.time : '19:00';
      start = new Date(ev.date + 'T' + timeStr + ':00');
      end   = new Date(start.getTime() + 7200000);
    }
    if (isNaN(start.getTime())) return ''; // Malformed date — skip silently

    // UID: stable identity. Priority: id > uid > created. Never hash title+date.
    const uidBase = (ev.id || ev.uid || ev.created || '');
    const uid     = (uidBase ? uidBase.replace(/[^a-zA-Z0-9\-_.]/g, '') : icsGenId()) + '@groovelinx.band';

    const lastMod = ev.updated_at ? icsUTCStr(new Date(ev.updated_at)) : nowStr;

    // SUMMARY: no emoji (Outlook strips them; plain text is safest)
    const typeLabel = { rehearsal: 'Rehearsal', gig: 'Gig', meeting: 'Meeting', other: 'Event' };
    const summary   = (typeLabel[ev.type] || 'Event') + ': ' + (ev.title || 'Untitled');

    // CATEGORIES: maps to calendar color in Google Calendar
    const catMap  = { rehearsal: 'REHEARSAL', gig: 'GIG', meeting: 'MEETING', other: 'EVENT' };
    const category = catMap[ev.type] || 'EVENT';

    // DESCRIPTION: multiline, all fields visible in calendar event detail
    const desc = [
      ev.type    ? 'Type: ' + (typeLabel[ev.type] || ev.type)  : null,
      ev.venue   ? 'Venue: ' + ev.venue                        : null,
      ev.linkedSetlist ? 'Setlist: ' + ev.linkedSetlist        : null,
      ev.notes   ? ev.notes                                    : null,
      '\u2014 GrooveLinx Band Calendar',
    ].filter(Boolean).join('\n');

    const lines = [
      'BEGIN:VEVENT',
      icsFold('UID:'          + uid),
      icsFold('DTSTAMP:'      + nowStr),
      icsFold('LAST-MODIFIED:' + lastMod),
      icsFold('DTSTART:'      + icsUTCStr(start)),
      icsFold('DTEND:'        + icsUTCStr(end)),
      icsFold('SUMMARY:'      + icsEsc(summary)),
      icsFold('CATEGORIES:'   + category),
      icsFold('DESCRIPTION:'  + icsEsc(desc)),
    ];
    if (ev.venue) lines.push(icsFold('LOCATION:' + icsEsc(ev.venue)));
    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
    return lines.join('\r\n');
  } catch(e) {
    return ''; // Malformed event — skip silently, don't break the feed
  }
}

// ── ICS utilities (worker-side, no DOM) ──────────────────────────────────────

function icsUTCStr(d) {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function icsEsc(str) {
  // RFC 5545 §3.3.11: escape backslash first, then semicolon, comma, newlines
  return (str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function icsFold(line) {
  // RFC 5545 §3.1: fold at 75 octets, continuation lines begin with single space
  if (line.length <= 75) return line;
  const out = [line.slice(0, 75)];
  let i = 75;
  while (i < line.length) { out.push(' ' + line.slice(i, i + 74)); i += 74; }
  return out.join('\r\n');
}

function icsGenId() {
  // Simple random ID for last-resort UID generation (no crypto needed in worker)
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
