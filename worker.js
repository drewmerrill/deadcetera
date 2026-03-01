// DeadCetera Cloudflare Worker v2
// Routes:
//   POST /           → Anthropic Claude API proxy (legacy)
//   POST /claude     → Anthropic Claude API proxy
//   ANY  /fadr/*     → Fadr API proxy (key injected server-side)
//   POST /midi2abc   → MIDI binary → ABC notation converter
//   POST /archive-fetch → Fetch Archive.org audio and return as binary

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
  const fadrUrl = `https://api.fadr.com${path.replace('/fadr', '')}`;
  try {
    const ct = request.headers.get('Content-Type') || 'application/json';
    const body = request.method !== 'GET' ? await request.arrayBuffer() : undefined;
    const res = await fetch(fadrUrl, { method: request.method, headers: { 'Authorization': `Bearer ${env.FADR_API_KEY}`, 'Content-Type': ct }, body });
    const data = await res.arrayBuffer();
    return cors(new Response(data, { status: res.status, headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' } }));
  } catch (e) { return jsonResp({ error: e.message }, 500); }
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
