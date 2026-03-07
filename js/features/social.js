// ============================================================================
// js/features/social.js
// Social media hub: profiles, post drafts, AI caption ideas.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, worker-api.js
// EXPOSES globals: renderSocialPage, loadSocialProfiles, socialEditProfiles,
//   socialSaveProfiles, loadSocialPosts, socialAddPost, socialDeletePost,
//   socialGetAIIdea
// ============================================================================

'use strict';

function renderSocialPage(el) {
    el.innerHTML = `
    <div class="page-header">
        <h1>📣 Social Media</h1>
        <p>Plan content, draft posts, and coordinate across platforms</p>
    </div>

    <!-- PLATFORM LINKS -->
    <div class="app-card">
        <h3 style="margin-bottom:12px">🔗 Our Profiles</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px" id="socialProfileLinks">
            <div style="text-align:center;padding:12px;color:var(--text-dim);grid-column:1/-1">Loading…</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="socialEditProfiles()">✏️ Edit Profile Links</button>
    </div>

    <!-- CONTENT CALENDAR -->
    <div class="app-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <h3 style="margin:0">📅 Content Queue</h3>
            <button class="btn btn-primary btn-sm" onclick="socialAddPost()">+ Draft Post</button>
        </div>
        <div id="socialPostsList"><div style="text-align:center;padding:20px;color:var(--text-dim)">Loading…</div></div>
    </div>

    <!-- POST FORM (hidden initially) -->
    <div class="app-card" id="socialPostFormArea" style="display:none"></div>

    <!-- IDEAS BANK -->
    <div class="app-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <h3 style="margin:0">💡 Content Ideas</h3>
            <button class="btn btn-ghost btn-sm" onclick="socialAddIdea()">+ Add Idea</button>
        </div>
        <div id="socialIdeasList"></div>
        <div style="margin-top:12px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--border)">
            <div style="font-size:0.8em;color:var(--text-dim);margin-bottom:8px;font-weight:600">💡 Content ideas for bands</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;font-size:0.78em;color:var(--text-muted)">
                <span>📸 Behind-the-scenes rehearsal photos</span>
                <span>🎵 30-sec clip of new song you're working on</span>
                <span>🎥 Time-lapse of gear setup</span>
                <span>📢 "We're learning [song]" announcement</span>
                <span>🎤 Shoutout to a fan who came to a show</span>
                <span>📆 Upcoming gig announcement with flyer</span>
                <span>🎸 Gear spotlight — whose rig is it?</span>
                <span>🎶 Cover preview (acoustic / stripped down)</span>
            </div>
        </div>
    </div>

    <!-- BEST PRACTICES -->
    <div class="app-card">
        <h3 style="margin-bottom:10px">📖 Band Social Media Playbook</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px">
            ${[
                {icon:'📸',title:'Instagram / TikTok',tip:'Best for visual content. Post Reels of rehearsal clips, gear, live moments. Stories for day-of gig hype. Hashtags: #deadhead #gratefuldeadfan #livejam + local city tags.'},
                {icon:'🎵',title:'Facebook',tip:'Great for local event promotion and fan community. Create an event for every gig. Share setlists after shows. Your older/local fans are here.'},
                {icon:'▶️',title:'YouTube',tip:'Upload full live sets or highlight reels. Great long-term SEO. Fans search for "[song] cover" constantly — be in those results.'},
                {icon:'🐦',title:'X / Twitter',tip:'Real-time gig updates, setlist reveals live during shows, quick reactions. Use it day-of for "Heading to soundcheck" energy.'},
                {icon:'📅',title:'Posting Cadence',tip:'Aim for 3-4 posts/week total across platforms. Batch content on Sundays. Use Buffer or Later (free tiers) to schedule ahead.'},
                {icon:'🎯',title:'Post After Shows',tip:'Best engagement window: 30 min – 2 hrs after a gig. Quick iPhone shot + setlist + "Thanks [venue]!" = easy high-engagement post.'},
            ].map(c=>`<div style="background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;padding:12px">
                <div style="font-size:1.3em;margin-bottom:6px">${c.icon}</div>
                <div style="font-weight:600;font-size:0.85em;color:var(--accent-light);margin-bottom:4px">${c.title}</div>
                <div style="font-size:0.78em;color:var(--text-muted);line-height:1.4">${c.tip}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:12px;padding:10px 14px;background:rgba(102,126,234,0.08);border-radius:8px;border:1px solid rgba(102,126,234,0.2);font-size:0.8em;color:var(--text-muted)">
            <strong style="color:var(--accent-light)">⚡ Pro tip:</strong> Since GrooveLinx is on GitHub Pages, <strong>auto-publishing</strong> to social platforms requires a paid tool like Buffer ($6/mo) or Later (free tier). 
            Use the queue below to draft posts with text + notes, then tap "Copy & Post" to open the platform and paste instantly.
        </div>
    </div>`;
    loadSocialProfiles();
    loadSocialPosts();
    loadSocialIdeas();
}

async function loadSocialProfiles() {
    const profiles = (await loadBandDataFromDrive('_band', 'social_profiles') || {});
    const container = document.getElementById('socialProfileLinks');
    if (!container) return;
    const platforms = [
        {key:'instagram',icon:'📸',label:'Instagram',color:'#e1306c',url:'https://instagram.com/'},
        {key:'facebook',icon:'👥',label:'Facebook',color:'#1877f2',url:'https://facebook.com/'},
        {key:'youtube',icon:'▶️',label:'YouTube',color:'#ff0000',url:'https://youtube.com/'},
        {key:'tiktok',icon:'🎵',label:'TikTok',color:'#69c9d0',url:'https://tiktok.com/'},
        {key:'twitter',icon:'🐦',label:'X / Twitter',color:'#1da1f2',url:'https://x.com/'},
        {key:'spotify',icon:'🟢',label:'Spotify Artist',color:'#1db954',url:'https://artists.spotify.com/'},
    ];
    container.innerHTML = platforms.map(p => {
        const handle = profiles[p.key] || '';
        const href = handle ? (handle.startsWith('http') ? handle : p.url + handle.replace('@','')) : '#';
        return `<a href="${href}" target="${handle?'_blank':'_self'}" onclick="${!handle?'event.preventDefault();':''}" 
            style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 8px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;text-decoration:none;cursor:${handle?'pointer':'default'};opacity:${handle?'1':'0.45'}">
            <span style="font-size:1.5em">${p.icon}</span>
            <span style="font-size:0.72em;font-weight:600;color:${handle?p.color:'var(--text-dim)'}">${p.label}</span>
            <span style="font-size:0.65em;color:var(--text-dim);word-break:break-all;text-align:center">${handle||'Not set'}</span>
        </a>`;
    }).join('');
}

function socialEditProfiles() {
    const area = document.getElementById('socialPostFormArea');
    area.style.display = 'block';
    const platforms = ['instagram','facebook','youtube','tiktok','twitter','spotify'];
    const icons = {instagram:'📸',facebook:'👥',youtube:'▶️',tiktok:'🎵',twitter:'🐦',spotify:'🟢'};
    loadBandDataFromDrive('_band', 'social_profiles').then(profiles => {
        profiles = profiles || {};
        area.innerHTML = `<h3 style="margin-bottom:12px">✏️ Edit Profile Links</h3>
        <div class="form-grid">
            ${platforms.map(p=>`<div class="form-row">
                <label class="form-label">${icons[p]} ${p.charAt(0).toUpperCase()+p.slice(1)}</label>
                <input class="app-input" id="sp_${p}" placeholder="@handle or full URL" value="${profiles[p]||''}">
            </div>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-success" onclick="socialSaveProfiles(['${platforms.join("','")}'])">💾 Save</button>
            <button class="btn btn-ghost" onclick="document.getElementById('socialPostFormArea').style.display='none'">Cancel</button>
        </div>`;
        area.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
}

async function socialSaveProfiles(platforms) {
    const profiles = {};
    platforms.forEach(p => { const v = document.getElementById('sp_'+p)?.value.trim(); if(v) profiles[p]=v; });
    await saveBandDataToDrive('_band', 'social_profiles', profiles);
    document.getElementById('socialPostFormArea').style.display = 'none';
    loadSocialProfiles();
}

async function loadSocialPosts() {
    const posts = toArray(await loadBandDataFromDrive('_band', 'social_posts') || []);
    const el = document.getElementById('socialPostsList');
    if (!el) return;
    if (posts.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">No posts drafted yet. Hit "+ Draft Post" to start building your content queue!</div>';
        return;
    }
    const statusColors = {draft:'#667eea',ready:'#10b981',posted:'#64748b'};
    const statusLabels = {draft:'✏️ Draft',ready:'✅ Ready',posted:'📤 Posted'};
    const platformIcons = {instagram:'📸',facebook:'👥',youtube:'▶️',tiktok:'🎵',twitter:'🐦',spotify:'🟢',all:'📣'};
    el.innerHTML = posts.map((p,i) => `<div style="padding:12px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
            <span style="font-size:1.2em;flex-shrink:0">${platformIcons[p.platform||'all']||'📣'}</span>
            <div style="flex:1">
                <div style="font-weight:600;font-size:0.88em;margin-bottom:4px">${p.title||'Untitled Draft'}</div>
                ${p.caption?`<div style="font-size:0.78em;color:var(--text-muted);white-space:pre-wrap;line-height:1.4">${p.caption.substring(0,120)}${p.caption.length>120?'…':''}</div>`:''}
            </div>
            <span style="font-size:0.68em;padding:2px 8px;border-radius:10px;background:${statusColors[p.status||'draft']}22;color:${statusColors[p.status||'draft']};font-weight:600;white-space:nowrap;flex-shrink:0">${statusLabels[p.status||'draft']}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${p.scheduledDate?`<span style="font-size:0.72em;color:var(--text-dim)">📅 ${p.scheduledDate}</span>`:''}
            <div style="margin-left:auto;display:flex;gap:4px">
                <button onclick="socialCopyPost(${i})" style="background:rgba(16,185,129,0.15);color:var(--green);border:1px solid rgba(16,185,129,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.72em;font-weight:600">📋 Copy & Post</button>
                <button onclick="socialEditPost(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.72em;">✏️</button>
                <button onclick="socialDeletePost(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:0.72em;font-weight:700;">✕</button>
            </div>
        </div>
    </div>`).join('');
}

let _socialPosts = [];
async function getSocialPosts() {
    _socialPosts = toArray(await loadBandDataFromDrive('_band', 'social_posts') || []);
    return _socialPosts;
}

function socialAddPost(editIdx) {
    const area = document.getElementById('socialPostFormArea');
    area.style.display = 'block';
    const isEdit = editIdx !== undefined;
    const ev = isEdit ? (_socialPosts[editIdx]||{}) : {};
    area.innerHTML = `<h3 style="margin-bottom:12px">${isEdit?'✏️ Edit Post':'📝 Draft New Post'}</h3>
    <div class="form-grid">
        <div class="form-row"><label class="form-label">Title / Internal Name</label><input class="app-input" id="sp_title" placeholder="e.g. Post-gig recap Sat 3/1" value="${ev.title||''}"></div>
        <div class="form-row"><label class="form-label">Platform</label><select class="app-select" id="sp_platform">
            ${[['all','📣 All Platforms'],['instagram','📸 Instagram'],['tiktok','🎵 TikTok'],['facebook','👥 Facebook'],['youtube','▶️ YouTube'],['twitter','🐦 X / Twitter']].map(([v,l])=>`<option value="${v}" ${(ev.platform||'all')===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-row"><label class="form-label">Status</label><select class="app-select" id="sp_status">
            <option value="draft" ${(ev.status||'draft')==='draft'?'selected':''}>✏️ Draft</option>
            <option value="ready" ${ev.status==='ready'?'selected':''}>✅ Ready to Post</option>
            <option value="posted" ${ev.status==='posted'?'selected':''}>📤 Posted</option>
        </select></div>
        <div class="form-row"><label class="form-label">Scheduled Date (optional)</label><input class="app-input" id="sp_date" type="date" value="${ev.scheduledDate||''}"></div>
    </div>
    <div class="form-row" style="margin-top:8px"><label class="form-label">Caption / Copy</label>
        <textarea class="app-textarea" id="sp_caption" placeholder="Write your post caption here…
Hashtags, emojis, links — the whole thing." style="height:100px;white-space:pre-wrap">${ev.caption||''}</textarea>
    </div>
    <div class="form-row" style="margin-top:8px"><label class="form-label">Notes (internal only)</label>
        <input class="app-input" id="sp_notes" placeholder="e.g. Need photo from Jay" value="${ev.notes||''}">
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-success" onclick="socialSavePost(${isEdit?editIdx:'undefined'})">💾 ${isEdit?'Update':'Save Draft'}</button>
        <button class="btn btn-ghost" onclick="document.getElementById('socialPostFormArea').style.display='none'">Cancel</button>
    </div>`;
    area.scrollIntoView({behavior:'smooth',block:'nearest'});
}

async function socialSavePost(editIdx) {
    const post = {
        title: document.getElementById('sp_title')?.value.trim()||'',
        platform: document.getElementById('sp_platform')?.value||'all',
        status: document.getElementById('sp_status')?.value||'draft',
        scheduledDate: document.getElementById('sp_date')?.value||'',
        caption: document.getElementById('sp_caption')?.value||'',
        notes: document.getElementById('sp_notes')?.value||'',
        updatedAt: new Date().toISOString()
    };
    let posts = await getSocialPosts();
    if (editIdx !== undefined && editIdx < posts.length) posts[editIdx] = {...posts[editIdx], ...post};
    else { post.createdAt = new Date().toISOString(); posts.push(post); }
    await saveBandDataToDrive('_band', 'social_posts', posts);
    document.getElementById('socialPostFormArea').style.display = 'none';
    loadSocialPosts();
}

async function socialEditPost(idx) {
    await getSocialPosts();
    socialAddPost(idx);
}

async function socialDeletePost(idx) {
    if (!confirm('Delete this post draft?')) return;
    let posts = await getSocialPosts();
    posts.splice(idx, 1);
    await saveBandDataToDrive('_band', 'social_posts', posts);
    loadSocialPosts();
}

async function socialCopyPost(idx) {
    await getSocialPosts();
    const p = _socialPosts[idx];
    if (!p) return;
    const text = p.caption || p.title || '';
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        alert('✅ Caption copied to clipboard! Now open the platform and paste.');
    } else {
        prompt('Copy this caption:', text);
    }
}

async function loadSocialIdeas() {
    const ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    const el = document.getElementById('socialIdeasList');
    if (!el) return;
    if (ideas.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = ideas.map((idea,i) => `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid var(--border);border-radius:8px;margin-bottom:6px">
        <span style="flex:1;font-size:0.85em">${idea.text}</span>
        <button onclick="socialIdeaToPost(${i})" style="background:rgba(102,126,234,0.15);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);border-radius:4px;padding:2px 8px;cursor:pointer;font-size:0.72em">→ Draft</button>
        <button onclick="socialDeleteIdea(${i})" style="background:#ef4444;color:white;border:none;border-radius:4px;padding:2px 7px;cursor:pointer;font-size:0.72em;font-weight:700;">✕</button>
    </div>`).join('');
}

async function socialAddIdea() {
    const formId = 'socialIdeaForm';
    if (document.getElementById(formId)) {
        document.getElementById('socialIdeaInput')?.focus();
        return;
    }
    const container = document.getElementById('socialIdeasContainer') || 
                      document.querySelector('[onclick*="socialAddIdea"]')?.closest('.app-card');
    if (!container) return;
    const form = document.createElement('div');
    form.id = formId;
    form.style.cssText = 'display:flex;gap:8px;align-items:center;padding:10px 0;flex-wrap:wrap';
    form.innerHTML = `
        <input id="socialIdeaInput" class="app-input" placeholder="Content idea..."
            style="flex:1;min-width:200px" autocomplete="off">
        <button onclick="saveSocialIdea()" class="btn btn-primary">💾 Save</button>
        <button onclick="document.getElementById('${formId}')?.remove()" class="btn btn-ghost">Cancel</button>
    `;
    const addBtn = document.querySelector('[onclick*="socialAddIdea"]');
    if (addBtn) addBtn.after(form); else container.prepend(form);
    document.getElementById('socialIdeaInput')?.focus();
}

async function saveSocialIdea() {
    const text = document.getElementById('socialIdeaInput')?.value?.trim();
    if (!text) return;
    const ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    ideas.push({ text, addedAt: new Date().toISOString(), addedBy: currentUserEmail });
    await saveBandDataToDrive('_band', 'social_ideas', ideas);
    document.getElementById('socialIdeaForm')?.remove();
    loadSocialIdeas();
    showToast('✅ Idea saved');
}

async function socialDeleteIdea(idx) {
    let ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    ideas.splice(idx, 1);
    await saveBandDataToDrive('_band', 'social_ideas', ideas);
    loadSocialIdeas();
}

async function socialIdeaToPost(idx) {
    const ideas = toArray(await loadBandDataFromDrive('_band', 'social_ideas') || []);
    const idea = ideas[idx];
    if (!idea) return;
    await getSocialPosts();
    // Pre-fill post form with the idea text
    document.getElementById('socialPostFormArea').style.display = 'block';
    socialAddPost();
    setTimeout(() => {
        const cap = document.getElementById('sp_caption');
        if (cap) cap.value = idea.text;
    }, 50);
}

