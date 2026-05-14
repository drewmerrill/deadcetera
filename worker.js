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

// Audit M1 (2026-05-04): origin allowlist for the calendar-mutation surface.
// Worker has been a fully open Google proxy — anyone with a valid OAuth
// token could use it from any browser/CLI. Allowlist below covers the real
// app origins (prod, dev, GitHub Pages staging, localhost). Default mode is
// WARN: violations are logged but the request proceeds, so a misconfigured
// allowlist can't break the live UAT band session. Set env.ENFORCE_ORIGIN
// to '1' (Cloudflare dashboard → Variables) once Drew confirms only the
// expected origins appear in the warn-mode logs.
const ALLOWED_ORIGINS = [
  'https://app.groovelinx.com',
  'https://dev.groovelinx.com',
  'https://groovelinx.com',
  'https://drewmerrill.github.io',
  'https://deadcetera.github.io',
  'http://localhost:5173',
  'http://localhost:8000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:8080'
];
function _checkOrigin(request, env) {
  // Only the Google calendar-mutation surface needs gating today; ICS feeds,
  // Claude/Fadr proxies etc. each have their own auth pattern. Caller decides
  // whether to invoke this.
  const origin = request.headers.get('Origin') || '';
  // Allow same-origin/non-browser callers (no Origin header) — server-to-server
  // tests, native apps. CSRF impossibility class.
  if (!origin) return { ok: true, reason: 'no_origin' };
  const allowed = ALLOWED_ORIGINS.indexOf(origin) !== -1;
  if (allowed) return { ok: true, origin: origin };
  console.warn('[Worker] ORIGIN CHECK FAIL — origin:', origin, '| path:', new URL(request.url).pathname, '| method:', request.method);
  const enforce = env && env.ENFORCE_ORIGIN === '1';
  if (enforce) return { ok: false, origin: origin };
  // Warn-only mode: allow through, but tag so callers know the policy fired.
  return { ok: true, origin: origin, warned: true };
}

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
    if (path.startsWith('/stageplot/') && request.method === 'GET')
      return handleStagePlotPublic(request, env, path);
    if (path === '/tts' && request.method === 'POST')
      return handleTTS(request, env);
    if (path === '/fetch-chart' && request.method === 'POST')
      return handleFetchChart(request);
    if (path === '/transcribe' && request.method === 'POST')
      return handleTranscribe(request, env);
    // FCM push send — fans out a notification to a list of FCM tokens.
    // Body: { tokens: [...], title, body, click_action?, data? }
    if (path === '/push/send' && request.method === 'POST')
      return handleFcmPushSend(request, env);
    // Twilio SMS send — single message, A2P 10DLC channel.
    // Body: { to: '+14085551234', body: 'message text' }
    if (path === '/sms/send' && request.method === 'POST')
      return handleTwilioSmsSend(request, env);
    // Stem separation — proxies to Modal HT-Demucs endpoint, holds the
    // shared secret server-side, accepts either a public URL or a Drive
    // fileId+token (which we re-route through our own /drive-stream).
    // Async flow: /stems/start spawns the GPU job (returns Modal call_id),
    // /stems/check polls the call until done. Required because Modal's web
    // layer 524s synchronous responses past ~150s and the heavier models
    // (htdemucs_ft, mdx_extra) routinely run 150-240s.
    if (path === '/stems/start' && request.method === 'POST')
      return handleStemsStart(request, env);
    if (path === '/stems/check' && request.method === 'POST')
      return handleStemsCheck(request, env);
    // Stab #14 — POST /stems/cancel  Body: { callId }
    // Best-effort GPU job cancellation. Calls Modal's cancel endpoint when
    // configured; otherwise marks the call as client-cancelled and returns
    // success so the client UI can move on without leaking quota.
    if (path === '/stems/cancel' && request.method === 'POST')
      return handleStemsCancel(request, env);
    // Phase 2 — Spatial (pan-aware + tone-fingerprint) separation. Stage 2
    // refinement on top of Demucs: split any stem (typically Demucs "other"
    // or "guitar") by stereo pan position, with optional reference-clip
    // fingerprint biasing (e.g. clean Jerry vs clean Bob). Pure DSP, no GPU.
    if (path === '/stems/pan-analyze' && request.method === 'POST')
      return handlePanAnalyze(request, env);
    if (path === '/stems/fingerprint' && request.method === 'POST')
      return handleToneFingerprint(request, env);
    if (path === '/stems/spatial/start' && request.method === 'POST')
      return handleSpatialStart(request, env);
    if (path === '/stems/spatial/check' && request.method === 'POST')
      return handleSpatialCheck(request, env);
    // LALAL.AI lead/backing split — Phase 0.5 winner. Same source-resolution
    // logic as /stems/separate (URL / Drive fileId / base64 staged to R2),
    // forwards to Modal lalal_split_http with shared-secret + LALAL_API_KEY.
    if (path === '/lalal/split' && request.method === 'POST')
      return handleLalalSplit(request, env);
    // Async LALAL flow — start uploads + submits split (~10-30s),
    // check polls one tick (instant or ~10-30s if downloading stems).
    // Both stay well under Cloudflare's 100s subrequest TTFB and Modal's
    // 150s web-endpoint cap.
    if (path === '/lalal/start' && request.method === 'POST')
      return handleLalalStart(request, env);
    if (path === '/lalal/check' && request.method === 'POST')
      return handleLalalCheck(request, env);
    // Multitrack rehearsal ingest — direct browser→R2 upload via worker.
    // Each per-track FLAC file is POSTed as raw bytes (no base64, no JSON
    // wrapper). Worker streams body to STEMS_BUCKET under
    //   multitrack/{bandSlug}/{sessionId}/{filename}
    // and returns the public URL. Identifying info comes from headers
    // (X-Band-Slug, X-Session-Id, X-Filename) so the body stays pure binary.
    if (path === '/multitrack/upload' && request.method === 'POST')
      return handleMultitrackUpload(request, env);
    // Multitrack share — list every file under a session prefix and return
    // either JSON (?format=json, default) or a self-contained HTML page
    // (?format=html) with download buttons. Path obscurity is the auth
    // boundary for tonight; tighten with MULTITRACK_SHARE_KEY when the
    // session ID is no longer the only thing keeping it private.
    if (path === '/multitrack/share' && request.method === 'GET')
      return handleMultitrackShare(request, env);
    // Multitrack zip — async build of a single session.zip via Modal so
    // Brian (or any bandmate) can download one file instead of clicking
    // 15 FLACs. Mirrors the /stems/start + /stems/check async pattern.
    if (path === '/multitrack/zip/start' && request.method === 'POST')
      return handleMultitrackZipStart(request, env);
    if (path === '/multitrack/zip/check' && request.method === 'POST')
      return handleMultitrackZipCheck(request, env);
    // Quick check: does session.zip exist already in R2? Used by the share
    // page to short-circuit the Modal build when the user re-visits.
    if (path === '/multitrack/zip/status' && request.method === 'GET')
      return handleMultitrackZipStatus(request, env);
    // Rehearsal segmenter — server-side analysis of long rehearsal MP3s.
    // Replaces the in-browser decodeAudioData + RehearsalSegmentationEngine
    // path for multi-hour files that exceed browser AudioBuffer limits.
    // Returns { segments, summary } matching the existing engine's shape.
    if (path === '/rehearsal-segment/start' && request.method === 'POST')
      return handleRehearsalSegmentStart(request, env);
    if (path === '/rehearsal-segment/check' && request.method === 'POST')
      return handleRehearsalSegmentCheck(request, env);
    // Google Calendar API proxy — forwards user's access token to Google.
    // calendarId comes from the query param. We log a clear warning when a
    // mutating call (POST/PATCH/DELETE) arrives without an explicit
    // calendarId — that's almost always a routing bug on the client side
    // (an event is about to land on the user's personal cal). We still
    // honor the request to avoid breaking unknown legacy paths, but the
    // warning makes the bug visible in worker logs.
    // Audit M1 (2026-05-04): origin gate for the entire calendar surface +
    // free/busy + cal list. Warn-only by default; enforced when env
    // .ENFORCE_ORIGIN === '1'. _calId logic preserved below.
    var _isCalendarSurface = path.startsWith('/calendar/');
    if (_isCalendarSurface) {
      var _origCheck = _checkOrigin(request, env);
      if (!_origCheck.ok) {
        return cors(new Response(JSON.stringify({
          error: 'origin_not_allowed',
          message: 'Origin ' + (_origCheck.origin || '?') + ' is not in the allowlist.'
        }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }
    }
    var _calId = url.searchParams.get('calendarId');
    var _isMutating = path.startsWith('/calendar/events') && (request.method === 'POST' || request.method === 'PATCH' || request.method === 'DELETE');
    // Audit T1.4 (2026-05-04): GET /calendar/events without calendarId
    // silently defaults to 'primary' — that's by design for Mode-B overlay
    // but it has caused confusion. Log a clear warning so future routing
    // bugs are debuggable from worker logs.
    if (path === '/calendar/events' && request.method === 'GET' && !_calId) {
      console.warn('[Worker] /calendar/events GET with no calendarId — defaulting to "primary" (personal cal). Pass ?calendarId= for band cal.');
    }
    if (_isMutating && !_calId) {
      // 2026-04-26: HARDENED — refuse to silently fall back to 'primary'.
      // Past behavior pushed updates to the user's personal calendar when a
      // client-side routing bug omitted calendarId. That happened in real
      // prod (the "420 festival" gig update landed on Drew's personal cal
      // instead of DeadCetera). Now the worker returns 400 so the caller
      // fixes the bug instead of polluting personal calendars.
      console.error('[Worker] REJECTED: mutating /calendar/events with no calendarId. Method=', request.method, 'Path=', path);
      return cors(new Response(JSON.stringify({
        error: 'missing_calendarId',
        message: 'Mutating calendar requests must include ?calendarId=... — refusing to fall back to primary.'
      }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
    }
    _calId = _calId || 'primary';
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
    // Audit L6 (2026-05-05): Google OAuth userinfo proxy. Previously the
    // browser called googleapis.com directly with the user's access token,
    // a minor surface-area widening (any third-party script with access to
    // window could read the token by intercepting fetch). Routing through
    // the worker keeps the token off the public URL bar and lets the worker
    // log+rate-limit the call.
    if (path === '/oauth/userinfo' && request.method === 'GET') {
      var _orig = _checkOrigin(request, env);
      if (!_orig.ok) {
        return cors(new Response(JSON.stringify({
          error: 'origin_not_allowed',
          message: 'Origin ' + (_orig.origin || '?') + ' is not in the allowlist.'
        }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
      }
      var _auth = request.headers.get('Authorization') || '';
      if (!_auth.startsWith('Bearer ')) {
        return cors(new Response(JSON.stringify({ error: 'missing_auth' }), { status: 401, headers: { 'Content-Type': 'application/json' } }));
      }
      var _ures = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { 'Authorization': _auth } });
      var _ubody = await _ures.text();
      return cors(new Response(_ubody, { status: _ures.status, headers: { 'Content-Type': 'application/json' } }));
    }
    return cors(new Response('Not found', { status: 404 }));
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function cors(response) {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Band-Slug, X-Session-Id, X-Filename');
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

  // Forward request body for POST and PATCH.
  // sendUpdates default is now 'none' — auto-attendees were removed
  // from the client (events no longer auto-include the band as guests),
  // so the previous 'all' was producing zero notifications anyway. If
  // a future feature opts into attendees, the caller should pass an
  // explicit ?sendUpdates=all in the URL to signal intent.
  if (method === 'POST' || method === 'PATCH') {
    const body = await request.text();
    fetchOpts.body = body;
    const requestUrl = new URL(request.url);
    const sendUpdates = requestUrl.searchParams.get('sendUpdates') || 'none';
    googleUrl += (googleUrl.includes('?') ? '&' : '?') + 'sendUpdates=' + encodeURIComponent(sendUpdates);
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
    // Incremental sync mode: syncToken replaces timeMin/timeMax
    const syncToken = url.searchParams.get('syncToken');
    if (syncToken) {
      params.set('syncToken', syncToken);
      // syncToken mode: don't set singleEvents/orderBy (Google rejects them with syncToken)
    } else {
      if (url.searchParams.get('timeMin')) params.set('timeMin', url.searchParams.get('timeMin'));
      if (url.searchParams.get('timeMax')) params.set('timeMax', url.searchParams.get('timeMax'));
      params.set('singleEvents', 'true');
      params.set('orderBy', 'startTime');
    }
    params.set('maxResults', url.searchParams.get('maxResults') || '250');
    if (url.searchParams.get('pageToken')) params.set('pageToken', url.searchParams.get('pageToken'));
    if (url.searchParams.get('showDeleted')) params.set('showDeleted', 'true');
    // Pass through privateExtendedProperty filter(s) — used for pre-push
    // dedupe by glEventId. Format: privateExtendedProperty=key=value.
    url.searchParams.getAll('privateExtendedProperty').forEach(function (v) {
      params.append('privateExtendedProperty', v);
    });
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
    // Honor the calendarId query param so callers can read events from the
    // band group calendar (or any other shared cal). Previously hardcoded to
    // 'primary', which silently routed reads to the user's personal calendar
    // — wrong attendee data, missing events, etc.
    const url = new URL(request.url);
    const calId = url.searchParams.get('calendarId') || 'primary';
    const googleUrl = 'https://www.googleapis.com/calendar/v3/calendars/' + encodeURIComponent(calId) + '/events/' + encodeURIComponent(eventId);
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

// ── Public stage-plot view ──────────────────────────────────────────────────
// GET /stageplot/:bandSlug/:plotId  →  Standalone HTML page rendering the
// stage plot in read-only mode. No GrooveLinx login required — perfect for
// FOH engineers / venue contacts who just need to see the plot.
//
// Reads from Firebase REST (same pattern as /ical/). Stage plots are stored
// as an array at /bands/{slug}/stage_plots, so we fetch the whole array
// and find by id.
async function handleStagePlotPublic(request, env, path) {
  try {
    var parts = path.replace('/stageplot/', '').split('/');
    var bandSlug = (parts[0] || '').replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    var plotId = parts[1] ? decodeURIComponent(parts[1]) : '';
    if (!bandSlug || !plotId) {
      return cors(new Response('<h1>Bad request</h1><p>URL must be /stageplot/{bandSlug}/{plotId}.</p>', { status: 400, headers: { 'Content-Type': 'text/html' } }));
    }
    var fbUrl = FIREBASE_BASE + '/bands/' + bandSlug + '/stage_plots.json';
    var fbRes = await fetch(fbUrl, { headers: { 'Accept': 'application/json' } });
    if (fbRes.status === 404) {
      return cors(new Response('<h1>Not found</h1><p>No stage plots for this band.</p>', { status: 404, headers: { 'Content-Type': 'text/html' } }));
    }
    if (!fbRes.ok) {
      return cors(new Response('<h1>Firebase error ' + fbRes.status + '</h1>', { status: 502, headers: { 'Content-Type': 'text/html' } }));
    }
    var raw = await fbRes.json();
    var plots = Array.isArray(raw) ? raw.filter(Boolean) : (raw ? Object.values(raw).filter(Boolean) : []);
    var plot = plots.find(function(p) { return p && p.id === plotId; });
    if (!plot) {
      return cors(new Response('<h1>Plot not found</h1><p>Plot id "' + plotId + '" doesn\'t exist on band "' + bandSlug + '".</p>', { status: 404, headers: { 'Content-Type': 'text/html' } }));
    }
    return cors(new Response(renderStagePlotHtml(plot, bandSlug), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } }));
  } catch (e) {
    return cors(new Response('<h1>Error</h1><pre>' + (e && e.message) + '</pre>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
  }
}

function spEsc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function renderStagePlotHtml(plot, bandSlug) {
  var brandColor = plot.brandColor || '#667eea';
  var bandName = (bandSlug.charAt(0).toUpperCase() + bandSlug.slice(1));
  var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  var elements = plot.elements || [];
  var stations = plot.stations || [];
  var isStationMode = plot.layoutMode === 'stations' && stations.length > 0;
  var isFreeMode = plot.placementMode === 'free' && !isStationMode;

  var COMPACT = { 'Vocal':'Vox','Guitar':'Gtr','Bass':'Bass','Keys':'Keys','Drums':'Drums','Percussion':'Perc',
    'Guitar Amp':'GAmp','Bass Amp':'BAmp','Keyboard Rig':'KRig','Drum Kit':'Kit','Pedalboard':'PB','Laptop':'PC','IEM Rack':'IEM',
    'Vocal Mic':'V Mic','Inst Mic':'Mic','Kick Mic':'Kick','Snare Mic':'Sn','Overhead Mic':'OH','Cab Mic':'Cab','DI Box':'DI','Floor Monitor':'Mon','Side Fill':'SF','IEM Pack':'IEM',
    'Riser':'Riser','Drum Riser':'Riser','Power Drop':'Pwr' };

  // Stage canvas
  var stageHtml = '';
  if (isStationMode) {
    stageHtml = '<div style="display:grid;grid-template-columns:repeat(' + Math.max(6, stations.length + 2) + ',1fr);gap:6px;background:#f5f5f7;border:2px solid #ddd;border-radius:8px;padding:14px 10px 8px;position:relative">';
    stageHtml += '<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;font-size:10px;font-weight:700;color:#999;letter-spacing:0.1em">STAGE — ' + (plot.stageWidth || 24) + '\' × ' + (plot.stageDepth || 16) + '\'</div>';
    var cellMap = {};
    stations.forEach(function(st, i) { cellMap[st.x + ',' + st.y] = i; });
    var maxCol = Math.max(6, stations.length + 2);
    for (var r = 0; r < 5; r++) {
      for (var c = 0; c < maxCol; c++) {
        var stIdx = cellMap[c + ',' + r];
        if (stIdx !== undefined) {
          var st = stations[stIdx];
          var name = (st.musicianName || '').split(' ')[0];
          stageHtml += '<div style="grid-column:' + (c + 1) + ';grid-row:' + (r + 1) + ';background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:5px;padding:6px;text-align:center;font-size:11px"><div style="font-weight:700;color:#222">' + spEsc(name) + '</div><div style="font-size:9px;color:#666">' + spEsc(st.role || '') + '</div></div>';
        }
      }
    }
    stageHtml += '</div>';
  } else if (isFreeMode) {
    stageHtml = '<div style="position:relative;background:#f5f5f7;border:2px solid #ddd;border-radius:8px;padding:14px 10px 8px;height:300px;overflow:hidden">';
    stageHtml += '<div style="position:absolute;top:-9px;left:50%;transform:translateX(-50%);background:#fff;padding:0 8px;font-size:10px;font-weight:700;color:#999;letter-spacing:0.1em">STAGE — ' + (plot.stageWidth || 24) + '\' × ' + (plot.stageDepth || 16) + '\'</div>';
    elements.forEach(function(el) {
      var xPct = el.xPct !== undefined ? el.xPct : (el.x + 0.5) / 10 * 100;
      var yPct = el.yPct !== undefined ? el.yPct : (el.y + 0.5) / 5 * 100;
      var baseLabel = (el.label || '').split(' – ')[0].trim();
      stageHtml += '<div style="position:absolute;left:' + xPct + '%;top:' + yPct + '%;transform:translate(-50%,-50%);width:60px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:5px;padding:4px;text-align:center;font-size:11px"><div>' + spEsc(el.icon || '') + '</div><div style="font-size:9px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + spEsc(COMPACT[baseLabel] || baseLabel) + '</div></div>';
    });
    stageHtml += '<div style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:9px;color:#999;letter-spacing:0.15em">▼ AUDIENCE ▼</div>';
    stageHtml += '</div>';
  } else {
    var cols = Math.min(10, Math.max(6, elements.length + 2));
    var rows = 5;
    stageHtml = '<table style="width:100%;border-collapse:collapse;background:#f5f5f7;border:2px solid #ddd;border-radius:8px"><caption style="caption-side:top;font-size:10px;font-weight:700;color:#999;padding:4px">STAGE — ' + (plot.stageWidth || 24) + '\' × ' + (plot.stageDepth || 16) + '\'</caption>';
    for (var rr = 0; rr < rows; rr++) {
      stageHtml += '<tr>';
      for (var cc = 0; cc < cols; cc++) {
        var found = elements.find(function(e) { return e.x === cc && e.y === rr; });
        stageHtml += '<td style="border:1px solid #e5e5e5;padding:5px 3px;text-align:center;height:36px;vertical-align:middle;font-size:11px">';
        if (found) {
          var blab = (found.label || '').split(' – ')[0].trim();
          stageHtml += '<div>' + spEsc(found.icon) + '</div><div style="font-size:9px;color:#666;font-weight:600">' + spEsc(COMPACT[blab] || blab) + '</div>';
        }
        stageHtml += '</td>';
      }
      stageHtml += '</tr>';
    }
    stageHtml += '</table>';
  }

  // Input list
  var inputHtml = '';
  if (plot.channels && plot.channels.length) {
    inputHtml = '<h2 style="margin:24px 0 8px;font-size:16px;color:' + brandColor + '">Input List</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:' + brandColor + ';color:#fff"><th style="padding:6px 8px;text-align:right;width:30px">#</th><th style="padding:6px 8px;text-align:left">Source</th><th style="padding:6px 8px;text-align:left">Mic / DI</th><th style="padding:6px 8px;text-align:center;width:50px">+48V</th><th style="padding:6px 8px;text-align:left;width:120px">Stand</th></tr></thead><tbody>';
    plot.channels.forEach(function(ch, i) {
      inputHtml += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '"><td style="border:1px solid #ddd;padding:5px 8px;text-align:right;font-weight:700;color:' + brandColor + '">' + (i + 1) + '</td><td style="border:1px solid #ddd;padding:5px 8px">' + spEsc(ch.label || '') + '</td><td style="border:1px solid #ddd;padding:5px 8px">' + spEsc(ch.mic || '—') + '</td><td style="border:1px solid #ddd;padding:5px 8px;text-align:center;font-weight:700">' + (ch.phantom ? '✓' : '') + '</td><td style="border:1px solid #ddd;padding:5px 8px;font-size:11px">' + spEsc(ch.stand || '') + '</td></tr>';
    });
    inputHtml += '</tbody></table>';
  }

  // Monitors
  var monHtml = '';
  if (plot.monitors && plot.monitors.length) {
    monHtml = '<h2 style="margin:18px 0 8px;font-size:16px;color:' + brandColor + '">Monitor Mixes</h2><table style="width:100%;border-collapse:collapse;font-size:12px">';
    plot.monitors.forEach(function(m, i) {
      monHtml += '<tr><td style="border:1px solid #ddd;padding:5px 8px;width:60px;font-weight:700;color:' + brandColor + '">Mix ' + (i + 1) + '</td><td style="border:1px solid #ddd;padding:5px 8px">' + spEsc(m.label || '') + '</td></tr>';
    });
    monHtml += '</table>';
  }

  // Logistics — setup time + load-in window
  var logisticsHtml = '';
  if (plot.setupTime || plot.loadIn) {
    logisticsHtml = '<div style="margin:18px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:10px">';
    if (plot.setupTime) logisticsHtml += '<div style="padding:10px;border:1px solid #ddd;border-radius:4px;background:#fff"><div style="font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Setup / Soundcheck</div><div style="font-size:13px;color:#222">' + spEsc(plot.setupTime) + '</div></div>';
    if (plot.loadIn) logisticsHtml += '<div style="padding:10px;border:1px solid #ddd;border-radius:4px;background:#fff"><div style="font-size:11px;font-weight:700;color:' + brandColor + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Load-in Window</div><div style="font-size:13px;color:#222">' + spEsc(plot.loadIn) + '</div></div>';
    logisticsHtml += '</div>';
  }

  // Backline
  var backlineHtml = '';
  if (plot.backline && plot.backline.length) {
    backlineHtml = '<h2 style="margin:18px 0 8px;font-size:16px;color:' + brandColor + '">Backline</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:' + brandColor + ';color:#fff"><th style="padding:6px 8px;text-align:left">Item</th><th style="padding:6px 8px;text-align:left;width:90px">By</th></tr></thead><tbody>';
    plot.backline.forEach(function(b, i) {
      if (!b.label) return;
      var byTxt = b.by === 'venue' ? 'Venue' : (b.by === 'rental' ? 'Rental' : 'Band');
      backlineHtml += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '"><td style="border:1px solid #ddd;padding:5px 8px">' + spEsc(b.label) + '</td><td style="border:1px solid #ddd;padding:5px 8px;font-weight:600">' + byTxt + '</td></tr>';
    });
    backlineHtml += '</tbody></table>';
  }

  // Wireless
  var wirelessHtml = '';
  if (plot.wireless && plot.wireless.length) {
    wirelessHtml = '<h2 style="margin:18px 0 8px;font-size:16px;color:' + brandColor + '">Wireless Frequencies</h2><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:' + brandColor + ';color:#fff"><th style="padding:6px 8px;text-align:left;width:80px">Channel</th><th style="padding:6px 8px;text-align:left">Use / Member</th><th style="padding:6px 8px;text-align:right;width:120px">Frequency</th></tr></thead><tbody>';
    plot.wireless.forEach(function(w, i) {
      if (!w.use && !w.freq && !w.channel) return;
      wirelessHtml += '<tr style="background:' + (i % 2 ? '#f7f7fa' : '#fff') + '"><td style="border:1px solid #ddd;padding:5px 8px">' + spEsc(w.channel || '') + '</td><td style="border:1px solid #ddd;padding:5px 8px">' + spEsc(w.use || '') + '</td><td style="border:1px solid #ddd;padding:5px 8px;text-align:right;font-family:ui-monospace,monospace">' + spEsc(w.freq || '') + '</td></tr>';
    });
    wirelessHtml += '</tbody></table>';
  }

  // Rider + contact
  var riderHtml = '';
  if (plot.riderNotes) {
    riderHtml = '<h2 style="margin:18px 0 8px;font-size:16px;color:' + brandColor + '">Tech Rider</h2><div style="white-space:pre-wrap;font-size:12px;line-height:1.6;border-left:3px solid ' + brandColor + ';padding:8px 14px;background:#f9f9fb">' + spEsc(plot.riderNotes) + '</div>';
  }
  var contactHtml = '';
  if (plot.contact) {
    contactHtml = '<div style="margin-top:18px;font-size:13px;padding:10px 14px;border:1px solid #ddd;border-radius:4px;background:#fff"><strong style="color:' + brandColor + '">Band Contact:</strong> ' + spEsc(plot.contact) + '</div>';
  }

  // QR code linking back to this same page — useful for promoters who want
  // to print and pin the plot to a wall. api.qrserver.com is free / no-key.
  var pageUrl = 'https://share.groovelinx.com/stageplot/' + encodeURIComponent(bandSlug) + '/' + encodeURIComponent(plot.id || '');
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(pageUrl);
  var qrHtml = '<div class="no-print" style="margin-top:24px;padding:16px;border:1px solid #eee;border-radius:6px;background:#fafafa;display:flex;align-items:center;gap:14px"><img src="' + qrUrl + '" alt="QR code" style="width:120px;height:120px;background:#fff;border-radius:4px"><div style="font-size:12px;color:#555;line-height:1.5"><strong style="color:#222">Scan or share</strong><br>This QR code points to this same live stage plot — anyone scanning will always see the latest version.</div></div>';

  var logoTag = plot.brandLogo ? '<img src="' + plot.brandLogo + '" style="max-height:48px;max-width:140px;background:#fff;padding:4px;border-radius:4px;margin-bottom:8px" alt="logo">' : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>' + spEsc(bandName) + ' — ' + spEsc(plot.name || 'Stage Plot') + '</title>'
    + '<style>body{font-family:-apple-system,system-ui,Segoe UI,Roboto,sans-serif;max-width:880px;margin:0 auto;padding:24px;background:#fff;color:#1a1a1a}h1{font-size:24px;margin:0}@media print{body{padding:0;max-width:none}.no-print{display:none}}</style>'
    + '</head><body>'
    + '<div style="border-bottom:3px solid ' + brandColor + ';padding-bottom:12px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end;gap:14px">'
    + '<div>' + logoTag + '<h1>' + spEsc(bandName) + '</h1><div style="font-size:14px;color:' + brandColor + ';font-weight:700;margin-top:4px">' + spEsc(plot.name || 'Stage Plot') + (plot.setVariantLabel ? ' · ' + spEsc(plot.setVariantLabel) : '') + '</div></div>'
    + '<div style="font-size:11px;color:#666;text-align:right">Live link · current as of ' + date + '<br>Stage ' + (plot.stageWidth || 24) + '\' × ' + (plot.stageDepth || 16) + '\'</div>'
    + '</div>'
    + stageHtml
    + logisticsHtml
    + inputHtml
    + monHtml
    + backlineHtml
    + wirelessHtml
    + riderHtml
    + contactHtml
    + qrHtml
    + '<button class="no-print" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:8px 18px;background:' + brandColor + ';color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.2)">🖨 Print / PDF</button>'
    + '<div class="no-print" style="margin-top:30px;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#999;text-align:center">This is a live link — bookmark it to always see the latest version. Powered by GrooveLinx.</div>'
    + '</body></html>';
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


// ── FCM push send ───────────────────────────────────────────────────────────
// Sends a Firebase Cloud Messaging notification to a list of device tokens.
// Authenticates via service-account JWT (RS256) → OAuth2 token → FCM v1
// /messages:send endpoint. Secrets come from Cloudflare Worker env:
//   FCM_CLIENT_EMAIL — service account email
//   FCM_PRIVATE_KEY  — PEM private key (multi-line, includes BEGIN/END markers)
//   FCM_PROJECT_ID   — Firebase project id (e.g. "deadcetera-35424")
//
// Request body: { tokens: [string], title, body, click_action?, data?, tag? }
// Returns: { sent: N, failed: N, invalidTokens: [string] }
async function handleFcmPushSend(request, env) {
  if (!env.FCM_CLIENT_EMAIL || !env.FCM_PRIVATE_KEY || !env.FCM_PROJECT_ID) {
    return cors(jsonError('FCM secrets not configured on worker', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const tokens = Array.isArray(body.tokens) ? body.tokens.filter(Boolean) : [];
  if (!tokens.length) return cors(jsonError('no_tokens', 400));
  const title = String(body.title || 'Band update').slice(0, 200);
  const text  = String(body.body  || '').slice(0, 500);
  const click = String(body.click_action || body.url || '/');
  const tag   = String(body.tag || 'gl-feed');
  const data  = (body.data && typeof body.data === 'object') ? body.data : {};

  // Get OAuth2 access token (cached in module scope for reuse during a sync run)
  let accessToken;
  try { accessToken = await fcmGetAccessToken(env); }
  catch (e) { return cors(jsonError('fcm_auth_failed: ' + (e && e.message), 502)); }

  const sendOne = async (token) => {
    // Data-only payload — the SW's onBackgroundMessage handler is the only display
    // path. Including a top-level `notification` field causes some browsers to
    // auto-handle the message and skip our handler, leaving the icon/click logic
    // we configure in the SW dead.
    const fcmBody = {
      message: {
        token: token,
        data: Object.assign({ title: title, body: text, click_action: click, tag: tag }, data),
        webpush: {
          headers: { TTL: '3600', Urgency: 'high' }
        }
      }
    };
    const res = await fetch(
      'https://fcm.googleapis.com/v1/projects/' + encodeURIComponent(env.FCM_PROJECT_ID) + '/messages:send',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(fcmBody)
      }
    );
    if (res.ok) return { ok: true };
    const errBody = await res.text();
    // 404 / 400 with UNREGISTERED → token is dead (user uninstalled, etc).
    // Surface so the caller can clean up Firebase.
    const isInvalid = res.status === 404
      || (res.status === 400 && /UNREGISTERED|INVALID_ARGUMENT.*registration token/.test(errBody));
    return { ok: false, status: res.status, body: errBody, invalid: isInvalid, token: token };
  };

  // Pace requests so we don't hammer FCM. 5/sec is well under their limit.
  const results = [];
  for (let i = 0; i < tokens.length; i++) {
    results.push(await sendOne(tokens[i]));
    if (i < tokens.length - 1) await new Promise(r => setTimeout(r, 200));
  }
  const sent = results.filter(r => r.ok).length;
  const failed = results.length - sent;
  const invalidTokens = results.filter(r => r.invalid).map(r => r.token);
  return cors(jsonResp({ sent: sent, failed: failed, invalidTokens: invalidTokens, total: tokens.length }));
}

// ── Twilio SMS Send ──────────────────────────────────────────────────────────
// Single-recipient SMS via Twilio Messages API. Used for opt-in confirmation
// and (eventually) per-event band notifications. A2P 10DLC channel.
//
// Required worker secrets (set via `wrangler secret put` or Cloudflare dashboard):
//   - TWILIO_ACCOUNT_SID
//   - TWILIO_AUTH_TOKEN
//   - TWILIO_MESSAGING_SERVICE_SID  (preferred — e.g. MG70657b62c45c0a77bf4b0721d552553c)
//       Routes through the registered A2P 10DLC campaign attached to this messaging
//       service. Required for US destinations once campaigns are enforced; sends
//       without it return error 30034 ("Message from an Unregistered Number").
//   - TWILIO_FROM_NUMBER  (fallback only — e.g. +14085398813)
//       Used only if MESSAGING_SERVICE_SID is unset. Bypasses A2P routing.
//
// Body: { to: '+14085551234', body: 'message text' }
// Returns: { success: bool, sid?: string, status?: string, error?: string, code?: int }
async function handleTwilioSmsSend(request, env) {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    return cors(jsonError('Twilio secrets not configured on worker (need ACCOUNT_SID + AUTH_TOKEN)', 500));
  }
  if (!env.TWILIO_MESSAGING_SERVICE_SID && !env.TWILIO_FROM_NUMBER) {
    return cors(jsonError('Twilio sender not configured (need TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER)', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const to = String(body.to || '').trim();
  const text = String(body.body || '').trim();
  if (!/^\+\d{10,15}$/.test(to)) return cors(jsonError('invalid_to_phone (must be E.164, e.g. +14085551234)', 400));
  if (!text) return cors(jsonError('empty_body', 400));
  if (text.length > 1600) return cors(jsonError('body_too_long (max 1600 chars)', 400));

  const auth = btoa(env.TWILIO_ACCOUNT_SID + ':' + env.TWILIO_AUTH_TOKEN);
  const params = new URLSearchParams();
  // Prefer messaging service (A2P-routed). Fall back to direct From number.
  if (env.TWILIO_MESSAGING_SERVICE_SID) {
    params.set('MessagingServiceSid', env.TWILIO_MESSAGING_SERVICE_SID);
  } else {
    params.set('From', env.TWILIO_FROM_NUMBER);
  }
  params.set('To', to);
  params.set('Body', text);

  try {
    const res = await fetch(
      'https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(env.TWILIO_ACCOUNT_SID) + '/Messages.json',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      }
    );
    let data;
    try { data = await res.json(); } catch(e) { data = {}; }
    if (res.ok) {
      return cors(jsonResp({ success: true, sid: data.sid, status: data.status }));
    }
    return cors(jsonResp({
      success: false,
      error: data.message || ('twilio_http_' + res.status),
      code: data.code,
      moreInfo: data.more_info
    }, res.status));
  } catch (e) {
    return cors(jsonError('twilio_request_failed: ' + (e && e.message), 502));
  }
}

// ── Stem Separation (Modal proxy, async) ─────────────────────────────────────
// Two-stage flow:
//   POST /stems/start  → resolves source URL (R2-stages base64 if needed,
//                        re-routes Drive fileIds), spawns Modal GPU function,
//                        returns { success, call_id, song_id, model } in <2s.
//   POST /stems/check  → polls Modal call status. Returns { success, status:
//                        'processing' } until the GPU job finishes, then
//                        returns the full stems payload with status='done'.
//
// This replaces the legacy synchronous /stems/separate. Modal's web endpoint
// caps responses at ~150s (524 above that), so the heavier models
// (htdemucs_ft 2-4×, mdx_extra 1.5×) couldn't return synchronously even
// though the GPU function itself succeeded. Mirrors the LALAL async flow.

const STEMS_ALLOWED_MODELS = new Set(['htdemucs', 'htdemucs_6s', 'htdemucs_ft', 'mdx_extra']);

// ── Multitrack rehearsal upload ───────────────────────────────────────────
// POST /multitrack/upload — raw FLAC bytes in body, identity in headers.
// Streams to R2 at multitrack/{bandSlug}/{sessionId}/{filename}. Filename
// must match the strict NN_role-member.flac convention (validated below) so
// downstream inference is deterministic. No size cap enforced here — Worker
// Paid plan handles streaming uploads natively.
async function handleMultitrackUpload(request, env) {
  if (!env.STEMS_BUCKET || !env.STEMS_R2_PUBLIC_BASE) {
    return cors(jsonError('multitrack_not_configured: STEMS_BUCKET binding and STEMS_R2_PUBLIC_BASE var required', 500));
  }
  var bandSlug = String(request.headers.get('X-Band-Slug') || '').trim();
  var sessionId = String(request.headers.get('X-Session-Id') || '').trim();
  var filename = String(request.headers.get('X-Filename') || '').trim();

  // Sanity: required headers.
  if (!bandSlug)  return cors(jsonError('missing_header: X-Band-Slug', 400));
  if (!sessionId) return cors(jsonError('missing_header: X-Session-Id', 400));
  if (!filename)  return cors(jsonError('missing_header: X-Filename', 400));

  // Sanity: filename shape — must be NN_role-member.ext (avoids path traversal
  // and enforces the convention that makes inference deterministic).
  if (!/^[0-9]{1,3}_[a-z0-9-]+\.(flac|wav|opus|mp3|m4a)$/i.test(filename)) {
    return cors(jsonError('bad_filename: must match NN_role-member.ext (e.g. 01_kick-jay.flac)', 400));
  }
  // Sanity: bandSlug + sessionId limited to safe chars.
  if (!/^[a-z0-9_-]{1,64}$/i.test(bandSlug))  return cors(jsonError('bad_band_slug', 400));
  if (!/^[a-z0-9_-]{1,64}$/i.test(sessionId)) return cors(jsonError('bad_session_id', 400));

  var contentType = request.headers.get('Content-Type') || 'audio/flac';
  var key = 'multitrack/' + bandSlug + '/' + sessionId + '/' + filename;

  try {
    // request.body is a ReadableStream; R2 binding accepts streams natively.
    await env.STEMS_BUCKET.put(key, request.body, {
      httpMetadata: { contentType: contentType }
    });
  } catch (e) {
    return cors(jsonError('r2_upload_failed: ' + (e && e.message), 502));
  }
  var publicUrl = env.STEMS_R2_PUBLIC_BASE.replace(/\/+$/, '') + '/' + key;
  return jsonResp({ ok: true, key: key, publicUrl: publicUrl });
}

// GET /multitrack/share?bandSlug=...&sessionId=...&format=json|html
// Lists every R2 object under multitrack/{bandSlug}/{sessionId}/ and returns
// public download URLs. R2 serves HTTP range requests natively, so a 200GB
// download in a browser resumes cleanly if the connection drops mid-flight.
async function handleMultitrackShare(request, env) {
  if (!env.STEMS_BUCKET || !env.STEMS_R2_PUBLIC_BASE) {
    return cors(jsonError('multitrack_not_configured', 500));
  }
  var url = new URL(request.url);
  var bandSlug  = String(url.searchParams.get('bandSlug')  || '').trim();
  var sessionId = String(url.searchParams.get('sessionId') || '').trim();
  var format    = String(url.searchParams.get('format')    || 'json').toLowerCase();
  var key       = String(url.searchParams.get('key')       || '');

  if (!/^[a-z0-9_-]{1,64}$/i.test(bandSlug))  return cors(jsonError('bad_band_slug', 400));
  if (!/^[a-z0-9_-]{1,64}$/i.test(sessionId)) return cors(jsonError('bad_session_id', 400));
  // Optional shared-secret gate. Off by default — set MULTITRACK_SHARE_KEY
  // in the worker to require ?key=... on every share request.
  if (env.MULTITRACK_SHARE_KEY && key !== env.MULTITRACK_SHARE_KEY) {
    return cors(jsonError('forbidden', 403));
  }

  var prefix = 'multitrack/' + bandSlug + '/' + sessionId + '/';
  var files = [];
  try {
    // R2.list paginates at 1000 keys. Multitrack sessions can exceed that
    // on heavy nights (24 channels × multiple takes), so paginate until done.
    var cursor = undefined;
    do {
      var page = await env.STEMS_BUCKET.list({ prefix: prefix, cursor: cursor });
      for (var i = 0; i < page.objects.length; i++) {
        var obj = page.objects[i];
        var name = obj.key.substring(prefix.length);
        if (!name) continue; // skip the prefix marker itself
        files.push({
          name: name,
          size: obj.size,
          uploaded: obj.uploaded,
          url: env.STEMS_R2_PUBLIC_BASE.replace(/\/+$/, '') + '/' + obj.key
        });
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  } catch (e) {
    return cors(jsonError('r2_list_failed: ' + (e && e.message), 502));
  }

  files.sort(function(a, b) { return a.name.localeCompare(b.name); });
  var totalBytes = files.reduce(function(s, f) { return s + (f.size || 0); }, 0);

  if (format === 'html') {
    return cors(new Response(_renderMultitrackShareHtml(bandSlug, sessionId, files, totalBytes), {
      status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }));
  }
  return jsonResp({ bandSlug: bandSlug, sessionId: sessionId, files: files, totalBytes: totalBytes });
}

// GET /multitrack/zip/status?bandSlug=X&sessionId=Y — head-check R2 for an
// existing session.zip so the share page can show "Download" immediately
// when one is already cached. Returns { ready, publicUrl, size }.
async function handleMultitrackZipStatus(request, env) {
  if (!env.STEMS_BUCKET || !env.STEMS_R2_PUBLIC_BASE) {
    return cors(jsonError('multitrack_not_configured', 500));
  }
  var url = new URL(request.url);
  var bandSlug  = String(url.searchParams.get('bandSlug')  || '').trim();
  var sessionId = String(url.searchParams.get('sessionId') || '').trim();
  if (!/^[a-z0-9_-]{1,64}$/i.test(bandSlug))  return cors(jsonError('bad_band_slug', 400));
  if (!/^[a-z0-9_-]{1,64}$/i.test(sessionId)) return cors(jsonError('bad_session_id', 400));

  var key = 'multitrack/' + bandSlug + '/' + sessionId + '/session.zip';
  try {
    var obj = await env.STEMS_BUCKET.head(key);
    if (obj) {
      return jsonResp({
        ready: true,
        publicUrl: env.STEMS_R2_PUBLIC_BASE.replace(/\/+$/, '') + '/' + key,
        size: obj.size,
        uploaded: obj.uploaded,
      });
    }
  } catch (e) { /* fall through to not-found */ }
  return jsonResp({ ready: false });
}

// POST /multitrack/zip/start — body: { bandSlug, sessionId }
// Forwards to Modal zip_start (which spawns zip_session and returns call_id).
async function handleMultitrackZipStart(request, env) {
  if (!env.STEMS_SHARED_SECRET) {
    return cors(jsonError('multitrack_not_configured: STEMS_SHARED_SECRET required', 500));
  }
  var startUrl = env.MULTITRACK_ZIP_START_URL;
  if (!startUrl) {
    return cors(jsonError('multitrack_not_configured: MULTITRACK_ZIP_START_URL secret required', 500));
  }
  var body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  var bandSlug  = String(body.bandSlug  || '').trim();
  var sessionId = String(body.sessionId || '').trim();
  if (!/^[a-z0-9_-]{1,64}$/i.test(bandSlug))  return cors(jsonError('bad_band_slug', 400));
  if (!/^[a-z0-9_-]{1,64}$/i.test(sessionId)) return cors(jsonError('bad_session_id', 400));

  var ctrl = new AbortController();
  var timer = setTimeout(function() { ctrl.abort(); }, 60000);
  try {
    var modalRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bandSlug: bandSlug,
        sessionId: sessionId,
        token: env.STEMS_SHARED_SECRET,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    var text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    var msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
    return cors(jsonError(msg, 504));
  }
}

// POST /multitrack/zip/check — body: { call_id }
async function handleMultitrackZipCheck(request, env) {
  if (!env.STEMS_SHARED_SECRET) {
    return cors(jsonError('multitrack_not_configured: STEMS_SHARED_SECRET required', 500));
  }
  var checkUrl = env.MULTITRACK_ZIP_CHECK_URL;
  if (!checkUrl) {
    return cors(jsonError('multitrack_not_configured: MULTITRACK_ZIP_CHECK_URL secret required', 500));
  }
  var body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  var callId = String(body.call_id || body.callId || '').trim();
  if (!callId) return cors(jsonError('missing_call_id', 400));

  var ctrl = new AbortController();
  var timer = setTimeout(function() { ctrl.abort(); }, 30000);
  try {
    var modalRes = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, token: env.STEMS_SHARED_SECRET }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    var text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    var msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
    return cors(jsonError(msg, 504));
  }
}

// ── Rehearsal Segmenter (Modal proxy) ────────────────────────────────────────
// Async pipeline. /rehearsal-segment/start spawns the analysis on Modal and
// returns a call_id. /rehearsal-segment/check polls until the analysis
// returns a { segments[], summary } result the browser renders as
// chopper segments. Reuses _stemsResolveSource for Drive→R2 staging since
// the audio source resolution is identical to the stems pipeline.

// POST /rehearsal-segment/start
// Body: { songId, sourceUrl } | { songId, driveFileId, accessToken }
//                              | { songId, audioBase64DataUrl }
//       Optional: setlist[] — array of { title, bpm?, key?, duration? } for
//                 setlist matching. Truncated server-side to 200 entries.
// Returns: { success, call_id, songId }
async function handleRehearsalSegmentStart(request, env) {
  if (!env.STEMS_SHARED_SECRET) {
    return cors(jsonError('rehearsal_segment_not_configured: STEMS_SHARED_SECRET required', 500));
  }
  var startUrl = env.REHEARSAL_SEGMENT_START_URL;
  if (!startUrl) {
    return cors(jsonError('rehearsal_segment_not_configured: REHEARSAL_SEGMENT_START_URL secret required', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const songId = String(body.songId || '').trim();
  if (!songId) return cors(jsonError('missing songId', 400));

  const driveFileId = String(body.driveFileId || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const audioDataUrl = String(body.audioBase64DataUrl || '').trim();
  const sourceUrlRaw = String(body.sourceUrl || '').trim();
  if (!sourceUrlRaw && !audioDataUrl && !(driveFileId && accessToken)) {
    return cors(jsonError('missing sourceUrl, { driveFileId, accessToken }, or audioBase64DataUrl', 400));
  }

  // Reuse the stems source-resolver: identical Drive→R2 staging + URL passthrough.
  const resolved = await _stemsResolveSource(body, env, request);
  if (resolved.error) return cors(jsonError(resolved.error, resolved.status || 400));
  const sourceUrl = resolved.sourceUrl;

  const setlist = Array.isArray(body.setlist) ? body.setlist : [];

  const ctrl = new AbortController();
  const timer = setTimeout(function() { ctrl.abort(); }, 60000);
  try {
    var modalRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: env.STEMS_SHARED_SECRET,
        songId: songId,
        sourceUrl: sourceUrl,
        setlist: setlist,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    var text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    var msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
    return cors(jsonError(msg, 504));
  }
}

// POST /rehearsal-segment/check
// Body: { call_id }
// Returns: { success, status: 'processing' | 'done', segments?, summary?, duration_sec? }
async function handleRehearsalSegmentCheck(request, env) {
  if (!env.STEMS_SHARED_SECRET) {
    return cors(jsonError('rehearsal_segment_not_configured: STEMS_SHARED_SECRET required', 500));
  }
  var checkUrl = env.REHEARSAL_SEGMENT_CHECK_URL;
  if (!checkUrl) {
    return cors(jsonError('rehearsal_segment_not_configured: REHEARSAL_SEGMENT_CHECK_URL secret required', 500));
  }
  var body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  var callId = String(body.call_id || body.callId || '').trim();
  if (!callId) return cors(jsonError('missing_call_id', 400));

  var ctrl = new AbortController();
  var timer = setTimeout(function() { ctrl.abort(); }, 30000);
  try {
    var modalRes = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, token: env.STEMS_SHARED_SECRET }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    var text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    var msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
    return cors(jsonError(msg, 504));
  }
}

function _renderMultitrackShareHtml(bandSlug, sessionId, files, totalBytes) {
  function esc(s) { return String(s).replace(/[&<>"']/g, function(c) {
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  }); }
  function fmtSize(n) {
    if (!n) return '—';
    var u = ['B','KB','MB','GB','TB'], i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return v.toFixed(v < 10 ? 2 : 1) + ' ' + u[i];
  }
  var rows = files.map(function(f) {
    return '<tr><td><a href="' + esc(f.url) + '" download>' + esc(f.name) + '</a></td>'
         + '<td style="text-align:right;color:#94a3b8">' + fmtSize(f.size) + '</td></tr>';
  }).join('');
  // wgetAll: one-liner Brian can paste into a terminal to grab everything.
  var wgetAll = files.map(function(f) { return 'curl -LOC - "' + f.url + '"'; }).join(' && ');
  return '<!doctype html><html><head><meta charset="utf-8"><title>Multitrack — ' + esc(sessionId) + '</title>'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<style>body{font:14px system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}'
    + 'h1{font-size:1.2em;margin:0 0 4px}.sub{color:#94a3b8;font-size:0.9em;margin-bottom:20px}'
    + 'table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:10px;overflow:hidden}'
    + 'td{padding:10px 14px;border-bottom:1px solid #334155}tr:last-child td{border-bottom:none}'
    + 'a{color:#60a5fa;text-decoration:none}a:hover{text-decoration:underline}'
    + 'pre{background:#1e293b;padding:14px;border-radius:10px;overflow-x:auto;color:#cbd5e1;font-size:12px;margin-top:24px}'
    + '.hint{color:#64748b;font-size:0.85em;margin-top:8px}</style></head><body>'
    + '<h1>Multitrack: ' + esc(bandSlug) + ' / ' + esc(sessionId) + '</h1>'
    + '<div class="sub">' + files.length + ' files · ' + fmtSize(totalBytes) + ' total</div>'
    + (files.length ? '<table><tbody>' + rows + '</tbody></table>'
       + '<div class="hint">Click a filename to download. Downloads resume on dropped connections (R2 supports HTTP range requests).</div>'
       + '<h2 style="font-size:1em;margin-top:24px">Or grab everything via terminal:</h2>'
       + '<pre>' + esc(wgetAll) + '</pre>'
       : '<div class="sub">No files found at this session yet.</div>')
    + '</body></html>';
}

async function _stemsResolveSource(body, env, request) {
  // Returns { sourceUrl } or { error, status }.
  let sourceUrl = String(body.sourceUrl || '').trim();
  const driveFileId = String(body.driveFileId || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const audioDataUrl = String(body.audioBase64DataUrl || '').trim();
  const songId = String(body.songId || '').trim();

  if (audioDataUrl) {
    if (!env.STEMS_BUCKET || !env.STEMS_R2_PUBLIC_BASE) {
      return { error: 'staging_not_configured: STEMS_BUCKET binding and STEMS_R2_PUBLIC_BASE var required', status: 500 };
    }
    const m = audioDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return { error: 'invalid audioBase64DataUrl: expected data:<mime>;base64,<payload>', status: 400 };
    const mime = m[1];
    const b64 = m[2];
    let bin;
    try { bin = atob(b64); } catch (e) { return { error: 'invalid base64 payload', status: 400 }; }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]+/gi, '').slice(0, 8) || 'bin';
    const key = '_staging/' + songId + '.' + ext;
    try {
      await env.STEMS_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
    } catch (e) {
      return { error: 'r2_stage_failed: ' + (e && e.message), status: 502 };
    }
    sourceUrl = env.STEMS_R2_PUBLIC_BASE.replace(/\/+$/, '') + '/' + key;
  }
  if (!sourceUrl && driveFileId && accessToken) {
    const origin = new URL(request.url).origin;
    sourceUrl = origin + '/drive-stream?fileId=' + encodeURIComponent(driveFileId)
              + '&token=' + encodeURIComponent(accessToken);
  }
  return { sourceUrl: sourceUrl };
}

// Tries STEMS_MODAL_START_URL first, then falls back to deriving it from
// STEMS_MODAL_URL by swapping the function-name slug. The legacy URL points
// at -separate; the async start endpoint is published at -separate-start.
function _stemsStartUrl(env) {
  if (env.STEMS_MODAL_START_URL) return env.STEMS_MODAL_START_URL;
  if (!env.STEMS_MODAL_URL) return '';
  // Modal URL pattern: https://<workspace>--<app>-<func>.modal.run
  // Swap the trailing -separate (with optional -http suffix) to -separate-start.
  return env.STEMS_MODAL_URL.replace(/-separate(-http)?(\.modal\.run.*)$/, '-separate-start$2');
}

function _stemsCheckUrl(env) {
  if (env.STEMS_MODAL_CHECK_URL) return env.STEMS_MODAL_CHECK_URL;
  if (!env.STEMS_MODAL_URL) return '';
  return env.STEMS_MODAL_URL.replace(/-separate(-http)?(\.modal\.run.*)$/, '-separate-check$2');
}

// Stab #14 — Modal cancel endpoint. Optional; if STEMS_MODAL_CANCEL_URL is set
// the worker forwards the cancel call. Otherwise the worker still returns
// success so the client can stop polling — the GPU job will complete on its
// own (wasted, but the client UI is no longer lying about the state).
function _stemsCancelUrl(env) {
  if (env.STEMS_MODAL_CANCEL_URL) return env.STEMS_MODAL_CANCEL_URL;
  if (!env.STEMS_MODAL_URL) return '';
  return env.STEMS_MODAL_URL.replace(/-separate(-http)?(\.modal\.run.*)$/, '-separate-cancel$2');
}

// POST /stems/start
// Body: { songId, sourceUrl } | { songId, driveFileId, accessToken } | { songId, audioBase64DataUrl }
//       Optional: model (one of htdemucs, htdemucs_6s, htdemucs_ft, mdx_extra; default htdemucs_6s)
// Returns: { success, call_id, song_id, model }
async function handleStemsStart(request, env) {
  if (!env.STEMS_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('stems_not_configured: STEMS_MODAL_URL and STEMS_SHARED_SECRET secrets required on worker', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const songId = String(body.songId || '').trim();
  if (!songId) return cors(jsonError('missing songId', 400));

  const driveFileId = String(body.driveFileId || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const audioDataUrl = String(body.audioBase64DataUrl || '').trim();
  const sourceUrlRaw = String(body.sourceUrl || '').trim();
  if (!sourceUrlRaw && !audioDataUrl && !(driveFileId && accessToken)) {
    return cors(jsonError('missing sourceUrl, { driveFileId, accessToken }, or audioBase64DataUrl', 400));
  }

  const modelName = STEMS_ALLOWED_MODELS.has(body.model) ? body.model : 'htdemucs_6s';

  const resolved = await _stemsResolveSource(body, env, request);
  if (resolved.error) return cors(jsonError(resolved.error, resolved.status || 400));
  const sourceUrl = resolved.sourceUrl;

  const startUrl = _stemsStartUrl(env);
  if (!startUrl) {
    return cors(jsonError('stems_not_configured: STEMS_MODAL_START_URL secret (or STEMS_MODAL_URL fallback) required', 500));
  }

  // Spawn-only call; should return in <2s.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const modalRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: sourceUrl,
        song_id: songId,
        model_name: modelName,
        token: env.STEMS_SHARED_SECRET
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {
    clearTimeout(timer);
    const msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
    return cors(jsonError(msg, 504));
  }
}

// POST /stems/cancel — Stab #14 (2026-05-14)
// Body: { callId } (accepts call_id too)
// Returns: { success: true, cancelled: 'remote' | 'client_only', callId }
//
// Best-effort GPU cancellation. The handler always returns success so the
// client UI can confidently move on; the `cancelled` field tells the caller
// whether Modal actually killed the job or we couldn't reach a cancel
// endpoint. Idempotent — re-cancelling an already-cancelled call is a no-op.
//
// "client_only" path: when STEMS_MODAL_CANCEL_URL is not configured (and the
// fallback URL derivation doesn't match a real Modal endpoint), we return
// success with cancelled='client_only'. The GPU job runs to completion but
// the client stops polling, freeing the user. This is operationally honest
// — the client-side cancellation is real even when the server-side isn't.
async function handleStemsCancel(request, env) {
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const callId = String(body.callId || body.call_id || '').trim();
  if (!callId) return cors(jsonError('missing callId', 400));

  if (!env.STEMS_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    // Worker not configured for stems at all — still return success so the
    // client UI can stop spinning. Logs the misconfig once for ops visibility.
    console.warn('[stems/cancel] worker not configured — returning client_only success for callId=' + callId);
    return cors(new Response(JSON.stringify({ success: true, cancelled: 'client_only', callId: callId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  const cancelUrl = _stemsCancelUrl(env);
  if (!cancelUrl) {
    return cors(new Response(JSON.stringify({ success: true, cancelled: 'client_only', callId: callId }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const modalRes = await fetch(cancelUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, token: env.STEMS_SHARED_SECRET }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    // 2xx / 404 (job already done or unknown) both treated as cancelled-remote
    // since the result for the caller is identical: nothing to poll anymore.
    if (modalRes.ok || modalRes.status === 404 || modalRes.status === 410) {
      console.log('[stems/cancel] callId=' + callId + ' status=' + modalRes.status);
      return cors(new Response(JSON.stringify({ success: true, cancelled: 'remote', callId: callId }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    // Modal returned a real error — still tell the client success so the UI
    // doesn't hang, but flag client_only so ops can see the orphaned job in logs.
    console.warn('[stems/cancel] modal returned ' + modalRes.status + ' for callId=' + callId);
    return cors(new Response(JSON.stringify({ success: true, cancelled: 'client_only', callId: callId, modalStatus: modalRes.status }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  } catch (e) {
    clearTimeout(timer);
    console.warn('[stems/cancel] fetch failed for callId=' + callId + ' err=' + (e && e.message));
    return cors(new Response(JSON.stringify({ success: true, cancelled: 'client_only', callId: callId, error: 'modal_unreachable' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
}

// POST /stems/check
// Body: { callId } (or call_id — accept both)
// Returns: { success, status: 'processing' } | { success, status: 'done', stems, sample_rate, model, ... }
async function handleStemsCheck(request, env) {
  if (!env.STEMS_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('stems_not_configured: STEMS_MODAL_URL and STEMS_SHARED_SECRET secrets required on worker', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const callId = String(body.callId || body.call_id || '').trim();
  if (!callId) return cors(jsonError('missing callId', 400));

  const checkUrl = _stemsCheckUrl(env);
  if (!checkUrl) {
    return cors(jsonError('stems_not_configured: STEMS_MODAL_CHECK_URL secret (or STEMS_MODAL_URL fallback) required', 500));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const modalRes = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        call_id: callId,
        token: env.STEMS_SHARED_SECRET
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {
    clearTimeout(timer);
    const msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
    return cors(jsonError(msg, 504));
  }
}

// ── Phase 2: Spatial separation (pan + fingerprint) ──────────────────────────
// All four legacy endpoints now proxy to consolidated Modal endpoints to stay
// under the Modal web-endpoint cap (the rehearsal-segmenter needs 2 of the
// 8 slots, so we merged):
//   pan-analyze-http + tone-fingerprint-http → stems-analyze-http (task param)
//   spatial-separate-start → separate-start (mode='spatial')
//   spatial-separate-check → separate-check (already generic to call_id)
// Worker keeps the public /stems/* paths unchanged so browser code is unmodified.

function _spatialUrl(env, slug, secretName) {
  if (env[secretName]) return env[secretName];
  if (!env.STEMS_MODAL_URL) return '';
  return env.STEMS_MODAL_URL.replace(/-separate(-http)?(\.modal\.run.*)$/, '-' + slug + '$2');
}

// Merged sync analysis URL. Prefer the new explicit secret; fall back to
// deriving from STEMS_MODAL_URL by slug substitution.
function _stemsAnalyzeUrl(env) {
  return _spatialUrl(env, 'stems-analyze-http', 'STEMS_MODAL_ANALYZE_URL');
}

// Shared helper for the two merged sync-analysis paths.
async function _proxyStemsAnalyze(request, env, task) {
  if (!env.STEMS_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('stems_not_configured', 500));
  }
  let body; try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const sourceUrl = String(body.sourceUrl || '').trim();
  if (!sourceUrl) return cors(jsonError('missing sourceUrl', 400));
  const url = _stemsAnalyzeUrl(env);
  if (!url) return cors(jsonError('STEMS_MODAL_ANALYZE_URL not set', 500));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: task, source_url: sourceUrl, token: env.STEMS_SHARED_SECRET }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    return cors(new Response(text, {
      status: r.ok ? 200 : (r.status >= 500 ? 502 : r.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    return cors(jsonError(e && e.name === 'AbortError' ? 'modal_timeout' : 'modal_fetch_failed: ' + (e && e.message), 504));
  }
}

// POST /stems/pan-analyze  Body: { sourceUrl } — proxies to /stems-analyze task=pan
async function handlePanAnalyze(request, env) {
  return _proxyStemsAnalyze(request, env, 'pan');
}

// POST /stems/fingerprint  Body: { sourceUrl } — proxies to /stems-analyze task=fingerprint
async function handleToneFingerprint(request, env) {
  return _proxyStemsAnalyze(request, env, 'fingerprint');
}

// POST /stems/spatial/start
// Body: { songId, sourceUrl, panWindows, references?, fpStrength?, pathPrefix? }
// Proxies to the merged /stems/start endpoint with mode='spatial'.
async function handleSpatialStart(request, env) {
  if (!env.STEMS_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('stems_not_configured', 500));
  }
  let body; try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const songId = String(body.songId || '').trim();
  const sourceUrl = String(body.sourceUrl || '').trim();
  const panWindows = Array.isArray(body.panWindows) ? body.panWindows : [];
  const references = body.references && typeof body.references === 'object' ? body.references : null;
  const fpStrength = typeof body.fpStrength === 'number' ? body.fpStrength : 0.5;
  const pathPrefix = String(body.pathPrefix || 'spatial').trim();
  if (!songId || !sourceUrl || panWindows.length === 0) {
    return cors(jsonError('missing songId, sourceUrl, or panWindows', 400));
  }
  const url = _stemsStartUrl(env);  // separate-start handles both modes now
  if (!url) return cors(jsonError('STEMS_MODAL_START_URL not set', 500));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'spatial',
        source_url: sourceUrl, song_id: songId,
        pan_windows: panWindows, references: references,
        fp_strength: fpStrength, path_prefix: pathPrefix,
        token: env.STEMS_SHARED_SECRET,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    return cors(new Response(text, {
      status: r.ok ? 200 : (r.status >= 500 ? 502 : r.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    return cors(jsonError(e && e.name === 'AbortError' ? 'modal_timeout' : 'modal_fetch_failed: ' + (e && e.message), 504));
  }
}

// POST /stems/spatial/check  Body: { callId }
// Proxies to the merged /stems/check endpoint (call_id polling is mode-agnostic).
async function handleSpatialCheck(request, env) {
  if (!env.STEMS_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('stems_not_configured', 500));
  }
  let body; try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const callId = String(body.callId || body.call_id || '').trim();
  if (!callId) return cors(jsonError('missing callId', 400));
  const url = _stemsCheckUrl(env);  // separate-check is generic to any call_id
  if (!url) return cors(jsonError('STEMS_MODAL_CHECK_URL not set', 500));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ call_id: callId, token: env.STEMS_SHARED_SECRET }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const text = await r.text();
    return cors(new Response(text, {
      status: r.ok ? 200 : (r.status >= 500 ? 502 : r.status),
      headers: { 'Content-Type': 'application/json' },
    }));
  } catch (e) {
    clearTimeout(timer);
    return cors(jsonError(e && e.name === 'AbortError' ? 'modal_timeout' : 'modal_fetch_failed: ' + (e && e.message), 504));
  }
}

// ── LALAL.AI Lead/Backing Split (Modal proxy) ────────────────────────────────
// POST /lalal/split
// Body: { songId, sourceUrl }
//     | { songId, driveFileId, accessToken }
//     | { songId, audioBase64DataUrl }   ← stages bytes to R2 first
// Holds LALAL_API_KEY server-side so clients never see it. Output stems
// land at stems/{songId}/lalal/{lead,backing,instrumental,mix_no_lead}.mp3.
async function handleLalalSplit(request, env) {
  if (!env.LALAL_MODAL_URL || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('lalal_not_configured: LALAL_MODAL_URL and STEMS_SHARED_SECRET secrets required on worker', 500));
  }
  if (!env.LALAL_API_KEY) {
    return cors(jsonError('lalal_not_configured: LALAL_API_KEY secret required on worker', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const songId = String(body.songId || '').trim();
  let sourceUrl = String(body.sourceUrl || '').trim();
  const driveFileId = String(body.driveFileId || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const audioDataUrl = String(body.audioBase64DataUrl || '').trim();
  if (!songId) return cors(jsonError('missing songId', 400));
  if (!sourceUrl && !audioDataUrl && !(driveFileId && accessToken)) {
    return cors(jsonError('missing sourceUrl, { driveFileId, accessToken }, or audioBase64DataUrl', 400));
  }
  // Stage base64 audio to R2 (same pattern as /stems/separate — Best Shot
  // takes are stored as data URLs in Firebase, no public URL otherwise).
  if (audioDataUrl) {
    if (!env.STEMS_BUCKET || !env.STEMS_R2_PUBLIC_BASE) {
      return cors(jsonError('staging_not_configured: STEMS_BUCKET binding and STEMS_R2_PUBLIC_BASE var required', 500));
    }
    const m = audioDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return cors(jsonError('invalid audioBase64DataUrl: expected data:<mime>;base64,<payload>', 400));
    const mime = m[1];
    const b64 = m[2];
    let bin;
    try { bin = atob(b64); }
    catch (e) { return cors(jsonError('invalid base64 payload', 400)); }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]+/gi, '').slice(0, 8) || 'bin';
    const key = '_staging/' + songId + '.' + ext;
    try {
      await env.STEMS_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
    } catch (e) {
      return cors(jsonError('r2_stage_failed: ' + (e && e.message), 502));
    }
    sourceUrl = env.STEMS_R2_PUBLIC_BASE.replace(/\/+$/, '') + '/' + key;
  }
  // Drive files — proxy through our /drive-stream so Modal can fetch publicly.
  if (!sourceUrl) {
    const origin = new URL(request.url).origin;
    sourceUrl = origin + '/drive-stream?fileId=' + encodeURIComponent(driveFileId)
              + '&token=' + encodeURIComponent(accessToken);
  }

  // LALAL processing on Modal: ~30-120s per typical song (mostly waiting on
  // LALAL's queue). Modal cold start adds ~10-15s. Generous 8-min ceiling.
  //
  // Cloudflare's eyeball connection idle-times out at ~100s if no body bytes
  // have been written. Modal often takes longer than that. We work around it
  // by returning a streamed response immediately and writing a JSON-safe
  // whitespace heartbeat every 20s while we wait. Browsers ignore leading
  // whitespace before JSON, so existing clients (response.json()) work
  // unchanged. The actual JSON payload is appended once Modal returns.
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let modalDone = false;
      const heartbeat = setInterval(() => {
        if (modalDone) return;
        try { controller.enqueue(enc.encode(' ')); } catch (_) {}
      }, 20000);

      const ctrl = new AbortController();
      const abortTimer = setTimeout(() => ctrl.abort(), 480000); // 8 min

      try {
        // Write an initial heartbeat byte right away so the eyeball
        // connection is established before the long wait begins.
        controller.enqueue(enc.encode(' '));

        const modalRes = await fetch(env.LALAL_MODAL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_url: sourceUrl,
            song_id: songId,
            lalal_key: env.LALAL_API_KEY,
            token: env.STEMS_SHARED_SECRET
          }),
          signal: ctrl.signal
        });
        clearTimeout(abortTimer);
        modalDone = true;
        clearInterval(heartbeat);

        const text = await modalRes.text();
        // If Modal returned a non-2xx, surface it as JSON so the client
        // sees a structured error instead of a parse failure on whitespace.
        if (!modalRes.ok) {
          let payload;
          try { payload = JSON.parse(text); } catch (_) {
            payload = { success: false, error: 'modal_error_' + modalRes.status, details: text.slice(0, 500) };
          }
          if (payload && typeof payload === 'object') payload.success = payload.success || false;
          controller.enqueue(enc.encode(JSON.stringify(payload)));
        } else {
          controller.enqueue(enc.encode(text));
        }
        controller.close();
      } catch (e) {
        clearTimeout(abortTimer);
        modalDone = true;
        clearInterval(heartbeat);
        const msg = e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message));
        try {
          controller.enqueue(enc.encode(JSON.stringify({ success: false, error: msg })));
          controller.close();
        } catch (_) {
          try { controller.error(e); } catch (_) {}
        }
      }
    }
  });

  return cors(new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  }));
}

// POST /lalal/start
// Body: { songId, sourceUrl } | { songId, driveFileId, accessToken } | { songId, audioBase64DataUrl }
// Returns { success, lalal_task_id, source_id, duration_sec, ... }
// Does the upload + split-submit (10-30s). Client then polls /lalal/check.
async function handleLalalStart(request, env) {
  if (!env.LALAL_START_MODAL_URL && !env.LALAL_MODAL_URL) {
    return cors(jsonError('lalal_not_configured: LALAL_START_MODAL_URL secret required on worker', 500));
  }
  if (!env.LALAL_API_KEY || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('lalal_not_configured: LALAL_API_KEY + STEMS_SHARED_SECRET secrets required', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const songId = String(body.songId || '').trim();
  let sourceUrl = String(body.sourceUrl || '').trim();
  const driveFileId = String(body.driveFileId || '').trim();
  const accessToken = String(body.accessToken || '').trim();
  const audioDataUrl = String(body.audioBase64DataUrl || '').trim();
  if (!songId) return cors(jsonError('missing songId', 400));
  if (!sourceUrl && !audioDataUrl && !(driveFileId && accessToken)) {
    return cors(jsonError('missing sourceUrl, { driveFileId, accessToken }, or audioBase64DataUrl', 400));
  }

  // Stage base64 to R2 if needed (same as handleLalalSplit)
  if (audioDataUrl) {
    if (!env.STEMS_BUCKET || !env.STEMS_R2_PUBLIC_BASE) {
      return cors(jsonError('staging_not_configured: STEMS_BUCKET + STEMS_R2_PUBLIC_BASE required', 500));
    }
    const m = audioDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return cors(jsonError('invalid audioBase64DataUrl', 400));
    const mime = m[1]; const b64 = m[2];
    let bin;
    try { bin = atob(b64); } catch (e) { return cors(jsonError('invalid base64', 400)); }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]+/gi, '').slice(0, 8) || 'bin';
    const key = '_staging/' + songId + '.' + ext;
    try { await env.STEMS_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } }); }
    catch (e) { return cors(jsonError('r2_stage_failed: ' + (e && e.message), 502)); }
    sourceUrl = env.STEMS_R2_PUBLIC_BASE.replace(/\/+$/, '') + '/' + key;
  }
  if (!sourceUrl) {
    const origin = new URL(request.url).origin;
    sourceUrl = origin + '/drive-stream?fileId=' + encodeURIComponent(driveFileId)
              + '&token=' + encodeURIComponent(accessToken);
  }

  // Modal lalal_start_http: ~10-30s (upload + submit), well within limits.
  const startUrl = env.LALAL_START_MODAL_URL || env.LALAL_MODAL_URL.replace(/lalal[_-]split[_-]http/, 'lalal-start-http');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000); // 90s safety
  try {
    const modalRes = await fetch(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_url: sourceUrl, song_id: songId,
        lalal_key: env.LALAL_API_KEY, token: env.STEMS_SHARED_SECRET
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {
    clearTimeout(timer);
    return cors(jsonError(e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message)), 504));
  }
}

// POST /lalal/check
// Body: { songId, taskId, pathPrefix? }
// Returns { success, status: 'processing'|'done', stems?, progress?, ... }
// One LALAL check tick. If done, downloads + R2 rehosts (~10-30s).
async function handleLalalCheck(request, env) {
  if (!env.LALAL_CHECK_MODAL_URL && !env.LALAL_MODAL_URL) {
    return cors(jsonError('lalal_not_configured: LALAL_CHECK_MODAL_URL secret required', 500));
  }
  if (!env.LALAL_API_KEY || !env.STEMS_SHARED_SECRET) {
    return cors(jsonError('lalal_not_configured: LALAL_API_KEY + STEMS_SHARED_SECRET required', 500));
  }
  let body;
  try { body = await request.json(); } catch (e) { return cors(jsonError('invalid_json', 400)); }
  const songId = String(body.songId || '').trim();
  const taskId = String(body.taskId || '').trim();
  const pathPrefix = String(body.pathPrefix || 'lalal').trim();
  if (!songId || !taskId) return cors(jsonError('missing songId or taskId', 400));

  const checkUrl = env.LALAL_CHECK_MODAL_URL || env.LALAL_MODAL_URL.replace(/lalal[_-]split[_-]http/, 'lalal-check-http');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000); // 90s safety
  try {
    const modalRes = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: taskId, song_id: songId,
        lalal_key: env.LALAL_API_KEY, token: env.STEMS_SHARED_SECRET,
        path_prefix: pathPrefix
      }),
      signal: ctrl.signal
    });
    clearTimeout(timer);
    const text = await modalRes.text();
    return cors(new Response(text, {
      status: modalRes.ok ? 200 : (modalRes.status >= 500 ? 502 : modalRes.status),
      headers: { 'Content-Type': 'application/json' }
    }));
  } catch (e) {
    clearTimeout(timer);
    return cors(jsonError(e && e.name === 'AbortError' ? 'modal_timeout' : ('modal_fetch_failed: ' + (e && e.message)), 504));
  }
}

// ── FCM OAuth2 helpers ──
let _fcmTokenCache = { token: null, expiresAt: 0 };

async function fcmGetAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  // Reuse cached token if it still has > 5 min left
  if (_fcmTokenCache.token && _fcmTokenCache.expiresAt > now + 300) {
    return _fcmTokenCache.token;
  }
  const jwt = await fcmBuildJwt(env, now);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')
        + '&assertion=' + encodeURIComponent(jwt)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('OAuth2 ' + res.status + ': ' + t);
  }
  const data = await res.json();
  _fcmTokenCache = { token: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return data.access_token;
}

async function fcmBuildJwt(env, now) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: env.FCM_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  const enc = (obj) => fcmB64Url(new TextEncoder().encode(JSON.stringify(obj)));
  const headerB64 = enc(header);
  const payloadB64 = enc(payload);
  const signingInput = headerB64 + '.' + payloadB64;
  const sig = await fcmSignRS256(env.FCM_PRIVATE_KEY, signingInput);
  return signingInput + '.' + sig;
}

async function fcmSignRS256(pemKey, data) {
  // Cloudflare Workers expose crypto.subtle, which can import PKCS8 RSA keys.
  const pem = pemKey.replace(/\\n/g, '\n');
  const pemBody = pem.replace(/-----BEGIN PRIVATE KEY-----/, '')
                     .replace(/-----END PRIVATE KEY-----/, '')
                     .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));
  return fcmB64Url(new Uint8Array(sig));
}

function fcmB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status: status || 500, headers: { 'Content-Type': 'application/json' }
  });
}
