// DeadCetera Cloudflare Worker v3
// Routes:
//   POST /           → Anthropic Claude API proxy (legacy)
//   POST /claude     → Anthropic Claude API proxy
//   ANY  /fadr/*     → Fadr API proxy (key injected server-side)
//   POST /midi2abc   → MIDI binary → ABC notation converter
//   POST /archive-fetch → Fetch Archive.org audio and return as binary
//   POST /ug-search  → Search Ultimate Guitar for chords
//   POST /ug-fetch   → Fetch a specific UG tab by URL

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
    if (path === '/ug-search' && request.method === 'POST')
      return handleUGSearch(request);
    if (path === '/ug-fetch' && request.method === 'POST')
      return handleUGFetch(request);
    if (path === '/genius-search' && request.method === 'POST')
      return handleGeniusSearch(request);
    if (path === '/genius-fetch' && request.method === 'POST')
      return handleGeniusFetch(request);
    if (path === '/archive-search' && request.method === 'POST')
      return handleArchiveSearch(request);
    if (path === '/archive-files' && request.method === 'POST')
      return handleArchiveFiles(request);
    if (path === '/audio-trim' && request.method === 'POST')
      return handleAudioTrim(request);
    if (path === '/youtube-search' && request.method === 'POST')
      return handleYouTubeSearch(request);
    if (path === '/youtube-audio' && request.method === 'POST')
      return handleYouTubeAudio(request);
    if (path === '/fadr-diag' && request.method === 'GET')
      return handleFadrDiag(request, env);
    return new Response('Not found', { status: 404 });
  }
};
function cors(response) {
  const h = new Headers(response.headers);
  h.set('Access-Control-Allow-Origin', '*');
  h.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  h.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  h.set('Access-Control-Max-Age', '86400');
  return new Response(response.body, { status: response.status, headers: h });
}
function jsonResp(data, status = 200) {
  return cors(new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }));
}
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
async function handleFadr(request, env, path) {
  const fadrPath = path.replace('/fadr', '');
  const fadrUrl = 'https://api.fadr.com' + fadrPath;
  const apiKey = env.FADR_API_KEY;
  
  if (!apiKey) return jsonResp({ error: 'FADR_API_KEY not set in env' }, 500);
  
  try {
    const ct = request.headers.get('Content-Type') || 'application/json';
    const body = request.method !== 'GET' ? await request.arrayBuffer() : undefined;
    
    // Create a new Request object instead of passing headers as plain object
    const fadrReq = new Request(fadrUrl, {
      method: request.method,
      body: body,
      headers: {
        'Content-Type': ct
      }
    });
    // Set Authorization header separately on the Request
    const keyStr = '' + apiKey;
    fadrReq.headers.set('Authorization', 'Bearer ' + keyStr);
    
    const res = await fetch(fadrReq);
    
    const data = await res.arrayBuffer();
    const rh = new Headers({ 'Content-Type': res.headers.get('Content-Type') || 'application/json' });
    rh.set('Access-Control-Allow-Origin', '*');
    if (!res.ok) {
      try { rh.set('X-Fadr-Error', new TextDecoder().decode(data).substring(0, 200)); } catch(e) {}
    }
    return new Response(data, { status: res.status, headers: rh });
  } catch (e) {
    // Last resort: try the request without the Authorization header to test connectivity
    try {
      const testRes = await fetch(fadrUrl, { method: 'GET' });
      return jsonResp({ 
        error: e.message,
        hint: 'Auth header failed. Fadr connectivity OK (got ' + testRes.status + '). Key length=' + String(apiKey).length,
        path: path
      }, 500);
    } catch(e2) {
      return jsonResp({ error: e.message, connectError: e2.message, path: path }, 500);
    }
  }
}
async function handleFadrDiag(request, env) {
  const rawKey = String(env.FADR_API_KEY || '');
  const cleaned = rawKey.replace(/[\x00-\x1F\x7F]/g, '').trim();
  return jsonResp({
    rawLength: rawKey.length,
    cleanLength: cleaned.length,
    first4: cleaned.substring(0, 4),
    last4: cleaned.substring(cleaned.length - 4),
    hasNewline: rawKey.includes('\n'),
    hasReturn: rawKey.includes('\r'),
    hasSpace: rawKey.includes(' '),
    charCodes: [...rawKey].slice(0, 10).map(c => c.charCodeAt(0)),
    keyType: typeof env.FADR_API_KEY
  });
}
async function handleArchiveFetch(request) {
  try {
    const { audioUrl } = await request.json();
    if (!audioUrl || !audioUrl.includes('archive.org')) return jsonResp({ error: 'Must be an archive.org URL' }, 400);
    const res = await fetch(audioUrl, { headers: { 'User-Agent': 'DeadCetera/1.0' } });
    if (!res.ok) return jsonResp({ error: `Fetch failed: ${res.status}` }, 502);
    const data = await res.arrayBuffer();
    return cors(new Response(data, { headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg' } }));
  } catch (e) { return jsonResp({ error: e.message }, 500); }
}

// ── Ultimate Guitar Search ──────────────────────────────────────────────────
async function handleUGSearch(request) {
  try {
    const { song, artist } = await request.json();
    if (!song) return jsonResp({ error: 'song is required' }, 400);

    const query = `${song} ${artist || ''}`.trim();
    // UG search URL — type[]=Chords filters to chord charts only
    const searchUrl = `https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(query)}&type[]=Chords`;

    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!res.ok) return jsonResp({ error: `UG search returned ${res.status}` }, 502);
    const html = await res.text();

    // Extract the js-store data-content JSON
    const results = parseUGSearchResults(html);
    return jsonResp({ results, query });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

function parseUGSearchResults(html) {
  // UG embeds search data in <div class="js-store" data-content="...">
  const storeMatch = html.match(/class="js-store"\s+data-content="([^"]*)"/);
  if (!storeMatch) return [];

  try {
    const decoded = storeMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'");
    const data = JSON.parse(decoded);
    const results = data?.store?.page?.data?.results || [];

    return results
      .filter(r => r.type === 'Chords' && r.tab_url)
      .map(r => ({
        title: r.song_name || '',
        artist: r.artist_name || '',
        url: r.tab_url,
        rating: r.rating || 0,
        votes: r.votes || 0,
        version: r.version || 1,
        capo: r.capo || 0,
        tonality: r.tonality_name || '',
      }))
      .sort((a, b) => (b.rating * Math.log(b.votes + 1)) - (a.rating * Math.log(a.votes + 1)))
      .slice(0, 10);
  } catch (e) {
    return [];
  }
}

// ── Ultimate Guitar Fetch (single tab) ──────────────────────────────────────
async function handleUGFetch(request) {
  try {
    const { url } = await request.json();
    if (!url || !url.includes('ultimate-guitar.com')) return jsonResp({ error: 'Must be a UG URL' }, 400);

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!res.ok) return jsonResp({ error: `UG fetch returned ${res.status}` }, 502);
    const html = await res.text();

    const tab = parseUGTabPage(html);
    if (!tab) return jsonResp({ error: 'Could not parse tab content' }, 404);
    return jsonResp(tab);
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

function parseUGTabPage(html) {
  const storeMatch = html.match(/class="js-store"\s+data-content="([^"]*)"/);
  if (!storeMatch) return null;

  try {
    const decoded = storeMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'");
    const data = JSON.parse(decoded);

    const tabView = data?.store?.page?.data?.tab_view;
    const tabInfo = data?.store?.page?.data?.tab;
    if (!tabView) return null;

    // wiki_tab.content is the chord chart with [ch]...[/ch] tags around chords
    let content = tabView?.wiki_tab?.content || '';

    // Strip [ch]...[/ch] tags to get plain text (chords stay, just no tags)
    content = content.replace(/\[ch\]/g, '').replace(/\[\/ch\]/g, '');
    // Strip [tab]...[/tab] tags
    content = content.replace(/\[tab\]/g, '').replace(/\[\/tab\]/g, '');

    return {
      title: tabInfo?.song_name || '',
      artist: tabInfo?.artist_name || '',
      content: content,
      capo: tabInfo?.capo || 0,
      tonality: tabInfo?.tonality_name || '',
      rating: tabInfo?.rating || 0,
      votes: tabInfo?.votes || 0,
      url: tabInfo?.tab_url || '',
    };
  } catch (e) {
    return null;
  }
}

// ── MIDI → ABC ──────────────────────────────────────────────────────────────
async function handleMidi2Abc(request) {
  try {
    const buf = await request.arrayBuffer();
    return jsonResp({ abc: midiToAbc(new Uint8Array(buf)) });
  } catch (e) { return jsonResp({ error: e.message }, 500); }
}
const NOTE_NAMES = ['C','^C','D','^D','E','F','^F','G','^G','A','^A','B'];
function midiPitchToAbc(pitch) {
  const oct = Math.floor(pitch / 12) - 1, name = NOTE_NAMES[pitch % 12];
  if (oct <= 3) return name + ','.repeat(Math.max(0, 3 - oct));
  if (oct === 4) return name;
  if (oct === 5) return name.toLowerCase();
  return name.toLowerCase() + "'".repeat(oct - 5);
}
function ticksToDur(ticks, tpb) {
  const r = ticks / (tpb / 2);
  return [[0.25,'/4'],[0.5,'/2'],[1,''],[1.5,'3/2'],[2,'2'],[3,'3'],[4,'4'],[6,'6'],[8,'8']].reduce((b,d) => Math.abs(r-d[0]) < Math.abs(r-b[0]) ? d : b)[1];
}
function noteToAbc(n, tpb) { return n.isRest ? 'z'+ticksToDur(n.dur,tpb) : midiPitchToAbc(n.pitch)+ticksToDur(n.dur,tpb); }
function extractNotes(events, tpb) {
  const ons = new Map(), notes = []; let tick = 0;
  for (const e of events) {
    tick += e.delta;
    if (e.type === 'on' && e.vel > 0) ons.set(e.pitch, tick);
    else if (e.type === 'off' || (e.type === 'on' && e.vel === 0)) {
      if (ons.has(e.pitch)) { notes.push({ pitch: e.pitch, start: ons.get(e.pitch), dur: tick - ons.get(e.pitch) }); ons.delete(e.pitch); }
    }
  }
  notes.sort((a,b) => a.start - b.start);
  const result = []; let cursor = 0;
  for (const n of notes) {
    if (n.start > cursor) result.push({ isRest:true, dur: n.start - cursor });
    result.push({ pitch: n.pitch, dur: n.dur, isRest: false });
    cursor = n.start + n.dur;
  }
  return result;
}
function parseMidi(bytes) {
  let p = 0;
  const r = n => { const s=p; p+=n; return bytes.slice(s,p); };
  const u32 = () => { const b=r(4); return (b[0]<<24)|(b[1]<<16)|(b[2]<<8)|b[3]; };
  const u16 = () => { const b=r(2); return (b[0]<<8)|b[1]; };
  const vl = () => { let v=0,b; do { b=bytes[p++]; v=(v<<7)|(b&0x7f); } while(b&0x80); return v; };
  if (String.fromCharCode(...r(4)) !== 'MThd') return null;
  u32(); const fmt=u16(), nTrk=u16(), tpb=u16(); let bpm=120, timeSig={num:4,den:4}; const tracks=[];
  for (let t=0; t<nTrk; t++) {
    const tag=String.fromCharCode(...r(4)), len=u32();
    if (tag !== 'MTrk') { p+=len; continue; }
    const end=p+len, evts=[]; let rs=0;
    while (p<end) {
      const delta=vl(); let sb=bytes[p];
      if (sb&0x80) { rs=sb; p++; } else { sb=rs; }
      const type=(sb>>4)&0xf;
      if (sb===0xff) { const mt=bytes[p++],ml=vl(),md=r(ml); if(mt===0x51&&ml===3) bpm=60000000/((md[0]<<16)|(md[1]<<8)|md[2]); if(mt===0x58&&ml===4) timeSig={num:md[0],den:Math.pow(2,md[1])}; }
      else if (sb===0xf0||sb===0xf7) { p+=vl(); }
      else if (type===9) { const pitch=bytes[p++],vel=bytes[p++]; evts.push({delta,type:'on',pitch,vel}); }
      else if (type===8) { const pitch=bytes[p++]; p++; evts.push({delta,type:'off',pitch}); }
      else if (type>=8&&type<=14) { p+=(type===12||type===13)?1:2; }
    }
    p=end; tracks.push(evts);
  }
  return {fmt,tpb,bpm,timeSig,tracks};
}
function midiToAbc(bytes) {
  const midi=parseMidi(bytes); if (!midi) throw new Error('Invalid MIDI');
  const {tpb,bpm,timeSig,tracks}=midi;
  const voices=tracks.map((t,i)=>({name:`V${i+1}`,notes:extractNotes(t,tpb)})).filter(v=>v.notes.length>0);
  if (!voices.length) return `X:1\nT:Imported Harmony\nM:${timeSig.num}/${timeSig.den}\nQ:1/4=${Math.round(bpm)}\nL:1/8\nK:C\nz4 |]`;
  const lines=['X:1','T:Imported Harmony',`M:${timeSig.num}/${timeSig.den}`,`Q:1/4=${Math.round(bpm)}`,'L:1/8','K:C'];
  if (voices.length===1) { lines.push(voices[0].notes.map(n=>noteToAbc(n,tpb)).join(' ')); }
  else {
    const roles=['Lead','Harmony 1','Harmony 2','Bass'];
    for (let i=0;i<voices.length;i++) lines.push(`V:${i+1} name="${roles[i]||`Part ${i+1}`}"`);
    for (let i=0;i<voices.length;i++) { lines.push(`[V:${i+1}]`); lines.push(voices[i].notes.map(n=>noteToAbc(n,tpb)).join(' ')); }
  }
  return lines.join('\n');
}

// ── Genius Song Meaning Scraper ──────────────────────────────────────────────
async function handleGeniusSearch(request) {
    const { song, artist } = await request.json();
    if (!song) return jsonResp({ error: 'No song' }, 400);

    const query = encodeURIComponent(`${song} ${artist || ''}`);
    
    // Try Genius search API first
    try {
        const searchUrl = `https://genius.com/api/search/multi?per_page=5&q=${query}`;
        const res = await fetch(searchUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json'
            } 
        });
        if (!res.ok) {
            // Fallback: try the simpler search endpoint
            const fallbackUrl = `https://genius.com/api/search?q=${query}`;
            const fbRes = await fetch(fallbackUrl, { 
                headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
            });
            if (!fbRes.ok) return jsonResp({ error: `Genius API returned ${res.status}`, results: [] });
            const fbData = await fbRes.json();
            const hits = (fbData?.response?.hits || [])
                .filter(h => h.type === 'song')
                .map(h => ({
                    title: h.result.title,
                    artist: h.result.primary_artist?.name,
                    url: h.result.url,
                    id: h.result.id
                }))
                .slice(0, 5);
            return jsonResp({ results: hits });
        }
        const data = await res.json();
        const hits = (data?.response?.sections || [])
            .flatMap(s => s.hits || [])
            .filter(h => h.type === 'song')
            .map(h => ({
                title: h.result.title,
                artist: h.result.primary_artist?.name,
                url: h.result.url,
                id: h.result.id,
                thumbnail: h.result.song_art_image_thumbnail_url
            }))
            .slice(0, 5);
        return jsonResp({ results: hits });
    } catch(e) {
        return jsonResp({ error: e.message, results: [] }, 200);
    }
}

async function handleGeniusFetch(request) {
    const { url, id, song, artist } = await request.json();
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    let description = '';

    try {
        // Method 1: Genius song API (gets the "About" section)
        if (id) {
            try {
                const apiRes = await fetch(`https://genius.com/api/songs/${id}`, { headers: { 'User-Agent': ua, 'Accept': 'application/json' } });
                if (apiRes.ok) {
                    const apiData = await apiRes.json();
                    const s = apiData?.response?.song;
                    if (s?.description?.plain && s.description.plain !== '?') description = s.description.plain;
                    else if (s?.description?.html) {
                        const cleaned = s.description.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                        if (cleaned && cleaned !== '?') description = cleaned;
                    }
                }
            } catch(e) {}
        }

        // Method 2: Scrape Genius page for the "About" annotation block
        if (!description && url) {
            try {
                const res = await fetch(url, { headers: { 'User-Agent': ua } });
                const html = await res.text();
                // Look for song_about rich text in the page's embedded data
                const aboutMatch = html.match(/"description":\{"html":"((?:[^"\\]|\\.)*)"/);
                if (aboutMatch) {
                    const decoded = aboutMatch[1].replace(/\\u[\dA-Fa-f]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16))).replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    const cleaned = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                    if (cleaned && cleaned !== '?' && cleaned.length > 20) description = cleaned;
                }
            } catch(e) {}
        }

        // Method 3: Try Songfacts (specifically for song meanings)
        if (!description && (song || url)) {
            try {
                const songName = song || url.split('/').pop().replace(/-lyrics$/, '').replace(/-/g, ' ');
                const sfRes = await fetch(`https://www.songfacts.com/facts/${encodeURIComponent((artist || 'grateful-dead').toLowerCase().replace(/\s+/g, '-'))}/${encodeURIComponent(songName.toLowerCase().replace(/\s+/g, '-'))}`, { headers: { 'User-Agent': ua } });
                if (sfRes.ok) {
                    const sfHtml = await sfRes.text();
                    // Extract the factoid content
                    const factMatch = sfHtml.match(/class="factoid-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);
                    if (factMatch) {
                        const cleaned = factMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                        if (cleaned.length > 30) description = cleaned;
                    }
                    // Also try the main content area
                    if (!description) {
                        const mainMatch = sfHtml.match(/class="facts-content"[^>]*>([\s\S]*?)<\/section>/);
                        if (mainMatch) {
                            const cleaned = mainMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                            if (cleaned.length > 30) description = cleaned.substring(0, 2000);
                        }
                    }
                }
            } catch(e) {}
        }
        
        return jsonResp({ description: description || '', url, source: description ? 'found' : 'empty' });
    } catch(e) {
        return jsonResp({ error: e.message }, 500);
    }
}

// ── Archive.org Search (collection-aware) ────────────────────────────────────
async function handleArchiveSearch(request) {
    const { query, band } = await request.json();
    if (!query) return jsonResp({ error: 'No query' }, 400);

    const bandCollections = {
        'grateful dead':    ['GratefulDead'],
        'the grateful dead':['GratefulDead'],
        'dead':             ['GratefulDead'],
        'gd':               ['GratefulDead'],
        'jerry garcia':     ['JerryGarcia', 'JerryGarciaBand'],
        'jgb':              ['JerryGarcia', 'JerryGarciaBand'],
        'jerry garcia band':['JerryGarcia', 'JerryGarciaBand'],
        'phish':            ['Phish'],
        'widespread panic': ['WidespreadPanic'],
        'wsp':              ['WidespreadPanic'],
        'allman brothers':  ['AllmanBrothersBand'],
        'allman brothers band': ['AllmanBrothersBand'],
        'abb':              ['AllmanBrothersBand']
    };

    let collections = ['GratefulDead'];
    let songQuery = query.trim();
    const queryLower = query.toLowerCase().trim();

    const bandNames = Object.keys(bandCollections).sort((a, b) => b.length - a.length);
    for (const name of bandNames) {
        if (queryLower.includes(name)) {
            collections = bandCollections[name];
            songQuery = query.replace(new RegExp(name, 'gi'), '').trim();
            break;
        }
    }
    if (!songQuery) songQuery = query;

    // Build collection filter
    const collPart = collections.length === 1
        ? 'collection:' + collections[0]
        : 'collection:(' + collections.join('+OR+') + ')';

    // Encode ONLY the song name for the query value
    const songEncoded = encodeURIComponent('"' + songQuery + '"');

    // Strategy 1: description search (setlist contains song name)
    const url1 = 'https://archive.org/advancedsearch.php?q=' + collPart + '+AND+description:' + songEncoded +
        '&fl[]=identifier&fl[]=title&fl[]=date&fl[]=avg_rating&fl[]=num_reviews&fl[]=downloads&fl[]=source' +
        '&sort[]=avg_rating+desc&sort[]=downloads+desc&rows=30&output=json';

    try {
        let results = [];
        try {
            const res1 = await fetch(url1);
            if (res1.ok) {
                const data1 = await res1.json();
                results = data1?.response?.docs || [];
            }
        } catch(e) {}

        // Strategy 2: title/fulltext search as fallback
        if (results.length < 10) {
            const url2 = 'https://archive.org/advancedsearch.php?q=' + collPart + '+AND+' + songEncoded +
                '&fl[]=identifier&fl[]=title&fl[]=date&fl[]=avg_rating&fl[]=num_reviews&fl[]=downloads&fl[]=source' +
                '&sort[]=downloads+desc&rows=20&output=json';
            try {
                const res2 = await fetch(url2);
                if (res2.ok) {
                    const data2 = await res2.json();
                    const seen = new Set(results.map(r => r.identifier));
                    for (const doc of (data2?.response?.docs || [])) {
                        if (!seen.has(doc.identifier)) results.push(doc);
                    }
                }
            } catch(e) {}
        }

        // Strategy 3: Also try without quotes for partial matches
        if (results.length < 5) {
            const songWords = songQuery.split(/\s+/).map(w => encodeURIComponent(w)).join('+');
            const url3 = 'https://archive.org/advancedsearch.php?q=' + collPart + '+AND+' + songWords +
                '&fl[]=identifier&fl[]=title&fl[]=date&fl[]=avg_rating&fl[]=num_reviews&fl[]=downloads' +
                '&sort[]=downloads+desc&rows=15&output=json';
            try {
                const res3 = await fetch(url3);
                if (res3.ok) {
                    const data3 = await res3.json();
                    const seen = new Set(results.map(r => r.identifier));
                    for (const doc of (data3?.response?.docs || [])) {
                        if (!seen.has(doc.identifier)) results.push(doc);
                    }
                }
            } catch(e) {}
        }

        return jsonResp({
            results: results.map(d => ({
                identifier: d.identifier,
                title: d.title,
                date: d.date,
                rating: d.avg_rating,
                reviews: d.num_reviews,
                downloads: d.downloads,
                source: d.source
            })),
            total: results.length
        });
    } catch(e) {
        return jsonResp({ error: e.message }, 500);
    }
}
async function handleArchiveFiles(request) {
    const { identifier } = await request.json();
    if (!identifier) return jsonResp({ error: 'No identifier' }, 400);

    try {
        const res = await fetch(`https://archive.org/metadata/${identifier}`);
        const data = await res.json();
        const files = (data?.files || [])
            .filter(f => /\.(mp3|flac|ogg|wav)$/i.test(f.name))
            .map(f => ({
                name: f.name,
                title: f.title || f.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '),
                size: f.size,
                length: f.length,
                track: f.track,
                format: f.name.split('.').pop().toUpperCase(),
                url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`
            }))
            // Sort: MP3 first, then by track number
            .sort((a, b) => {
                const aMP3 = a.format === 'MP3' ? 0 : 1;
                const bMP3 = b.format === 'MP3' ? 0 : 1;
                if (aMP3 !== bMP3) return aMP3 - bMP3;
                return (parseInt(a.track) || 99) - (parseInt(b.track) || 99);
            });
        return jsonResp({ files, title: data?.metadata?.title?.[0] || identifier, date: data?.metadata?.date?.[0] || '' });
    } catch(e) {
        return jsonResp({ error: e.message }, 500);
    }
}

// ── Audio trimming proxy ─────────────────────────────────────────────────────
async function handleAudioTrim(request) {
    const { url, startSec, endSec } = await request.json();
    if (!url) return jsonResp({ error: 'No URL' }, 400);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) return jsonResp({ error: `Fetch failed: ${res.status}` }, 500);
        const h = new Headers();
        h.set('Access-Control-Allow-Origin', '*');
        h.set('Content-Type', res.headers.get('Content-Type') || 'audio/mpeg');
        return new Response(res.body, { headers: h });
    } catch(e) {
        return jsonResp({ error: e.message }, 500);
    }
}

// ── YouTube search ───────────────────────────────────────────────────────────
async function handleYouTubeSearch(request) {
    const { query } = await request.json();
    if (!query) return jsonResp({ error: 'No query' }, 400);
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    try {
        // YouTube search - must set cookie consent to bypass GDPR page
        const ytUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query) + '&sp=EgIQAQ%253D%253D';
        const res = await fetch(ytUrl, {
            headers: {
                'User-Agent': ua,
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml',
                'Cookie': 'CONSENT=PENDING+999; SOCS=CAISNQgDEitib3FfaWRlbnRpdHlmcm9udGVuZHVpc2VydmVyXzIwMjMxMDE2LjA3X3AxGgJlbiACGgYIgJnPqgY'
            }
        });

        if (!res.ok) {
            return jsonResp({ results: [], error: 'YouTube HTTP ' + res.status });
        }

        const html = await res.text();

        // Try multiple regex patterns for ytInitialData
        let jsonStr = null;
        const patterns = [
            /var\s+ytInitialData\s*=\s*({.+?})\s*;\s*<\/script/s,
            /ytInitialData\s*=\s*({.+?})\s*;\s*<\/script/s,
            /window\["ytInitialData"\]\s*=\s*({.+?})\s*;/s,
            /ytInitialData\s*=\s*'({.+?})'/s
        ];

        for (const pat of patterns) {
            const m = html.match(pat);
            if (m) { jsonStr = m[1]; break; }
        }

        if (!jsonStr) {
            // Debug: check what we got back
            const hasConsent = html.includes('consent') || html.includes('CONSENT');
            const hasResults = html.includes('videoRenderer');
            const htmlSnippet = html.substring(0, 300);
            return jsonResp({
                results: [],
                error: 'Could not find ytInitialData',
                debug: { htmlLength: html.length, hasConsent, hasResults, snippet: htmlSnippet }
            });
        }

        const ytData = JSON.parse(jsonStr);

        // Navigate the YouTube data structure
        const sections = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
        let items = [];
        for (const section of sections) {
            const sectionItems = section?.itemSectionRenderer?.contents || [];
            items = items.concat(sectionItems);
        }

        const results = items
            .filter(c => c.videoRenderer)
            .slice(0, 12)
            .map(c => {
                const v = c.videoRenderer;
                const durText = v.lengthText?.simpleText || '';
                let secs = 0;
                const parts = durText.split(':').map(Number);
                if (parts.length === 2) secs = parts[0] * 60 + parts[1];
                if (parts.length === 3) secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
                return {
                    title: v.title?.runs?.[0]?.text || '',
                    videoId: v.videoId,
                    author: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || '',
                    lengthSeconds: secs,
                    duration: durText,
                    url: 'https://www.youtube.com/watch?v=' + v.videoId
                };
            });

        return jsonResp({ results });
    } catch(e) {
        return jsonResp({ error: e.message, results: [] });
    }
}

// ── YouTube/Spotify Audio Extraction ─────────────────────────────────────────
async function handleYouTubeAudio(request) {
    const { url } = await request.json();
    if (!url) return jsonResp({ error: 'No URL provided' }, 400);
    
    // Validate it's a YouTube or Spotify URL
    const isYT = /youtube\.com|youtu\.be/i.test(url);
    const isSpotify = /open\.spotify\.com/i.test(url);
    if (!isYT && !isSpotify) return jsonResp({ error: 'URL must be YouTube or Spotify' }, 400);

    // Try multiple extraction services
    const services = [
        { name: 'cobalt', fn: () => extractCobalt(url) },
        { name: 'cobalt-alt', fn: () => extractCobaltAlt(url) }
    ];

    for (const svc of services) {
        try {
            const result = await svc.fn();
            if (result?.audioUrl) {
                return jsonResp({ audioUrl: result.audioUrl, service: svc.name });
            }
        } catch(e) { continue; }
    }

    return jsonResp({ error: 'All extraction services failed. Try downloading the audio manually and using Direct URL.' }, 502);
}

async function extractCobalt(url) {
    // cobalt.tools API - popular open-source media extraction
    const apis = [
        'https://api.cobalt.tools',
        'https://cobalt-api.kwiatekmiki.com'
    ];
    for (const api of apis) {
        try {
            const res = await fetch(api + '/api/json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    vCodec: 'h264',
                    vQuality: '360',
                    aFormat: 'mp3',
                    isAudioOnly: true,
                    isNoTTWatermark: true
                })
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.url) return { audioUrl: data.url };
            if (data.audio) return { audioUrl: data.audio };
        } catch(e) { continue; }
    }
    return null;
}

async function extractCobaltAlt(url) {
    // Alternative cobalt API format (v7+)
    const apis = [
        'https://api.cobalt.tools'
    ];
    for (const api of apis) {
        try {
            const res = await fetch(api, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    url: url,
                    audioFormat: 'mp3',
                    downloadMode: 'audio'
                })
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (data.url) return { audioUrl: data.url };
        } catch(e) { continue; }
    }
    return null;
}
