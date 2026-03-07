// ============================================================================
// js/features/song-detail.js  — Phase 2: direct Firebase rendering, no DOM mirroring
// LENSES: Band · Listen · Learn · Sing · Inspire
// EXPOSES: renderSongDetail, switchLens, glSongDetailBack, sdUpdate*, sdSaveReadiness
// ============================================================================
'use strict';

var _sdCurrentLens   = 'band';
var _sdCurrentSong   = null;
var _sdLensPopulated = {};

var SD_LENSES = [
    { id:'band',    icon:'🎸', label:'Band'    },
    { id:'listen',  icon:'📻', label:'Listen'  },
    { id:'learn',   icon:'📖', label:'Learn'   },
    { id:'sing',    icon:'🎤', label:'Sing'    },
    { id:'inspire', icon:'✨', label:'Inspire' },
];

// ── Entry ────────────────────────────────────────────────────────────────────
window.renderSongDetail = function renderSongDetail(songTitle) {
    var title = songTitle || (selectedSong && (selectedSong.title || selectedSong));
    if (!title) { if (typeof showPage==='function') showPage('songs'); return; }
    _sdCurrentSong   = title;
    _sdLensPopulated = {};
    _sdCurrentLens   = 'band';
    var container = document.getElementById('page-songdetail');
    if (!container) return;
    container.innerHTML = _sdShellHTML(title);
    _sdInjectStyles();
    _sdActivateTab('band');
    _sdPopulateBandLens(title);
    requestAnimationFrame(function() { container.classList.add('sd-entered'); });
};

window.switchLens = function switchLens(lens) {
    if (!SD_LENSES.find(function(l){return l.id===lens;})) return;
    _sdCurrentLens = lens;
    _sdActivateTab(lens);
    if (!_sdLensPopulated[lens]) {
        _sdLensPopulated[lens] = true;
        if (lens==='listen')  _sdPopulateListenLens(_sdCurrentSong);
        if (lens==='learn')   _sdPopulateLearnLens(_sdCurrentSong);
        if (lens==='sing')    _sdPopulateSingLens(_sdCurrentSong);
        if (lens==='inspire') _sdPopulateInspireLens(_sdCurrentSong);
    }
};

window.glSongDetailBack = function glSongDetailBack() {
    if (typeof showPage==='function') showPage('songs');
};

function _sdActivateTab(lens) {
    document.querySelectorAll('.sd-tab-btn').forEach(function(btn) {
        btn.classList.toggle('sd-tab-btn--active', btn.dataset.lens===lens);
    });
    document.querySelectorAll('.sd-lens-panel').forEach(function(panel) {
        panel.style.display = (panel.dataset.lens===lens) ? 'block' : 'none';
    });
}

// ── Shell HTML ────────────────────────────────────────────────────────────────
function _sdShellHTML(title) {
    var song = (typeof allSongs!=='undefined') ? allSongs.find(function(s){return s.title===title;}) : null;
    var band=song?(song.band||''):'', key=song?(song.key||''):'', bpm=song?(song.bpm||''):'';
    var pills = (key?'<span class="sd-meta-pill">🔑 '+_sdEsc(key)+'</span>':'')+
                (bpm?'<span class="sd-meta-pill">🥁 '+_sdEsc(String(bpm))+' BPM</span>':'')+
                (band?'<span class="sd-meta-pill sd-band-pill '+band.toLowerCase()+'">'+_sdEsc(band)+'</span>':'');
    var tabs = SD_LENSES.map(function(l) {
        return '<button class="sd-tab-btn" data-lens="'+l.id+'" onclick="switchLens(\''+l.id+'\')">'+
               '<span class="sd-tab-icon">'+l.icon+'</span>'+
               '<span class="sd-tab-label">'+l.label+'</span></button>';
    }).join('');
    var panels = SD_LENSES.map(function(l) {
        return '<div class="sd-lens-panel" data-lens="'+l.id+'" style="display:none">'+_sdSkeleton()+'</div>';
    }).join('');
    return '<div class="song-detail-page">'+
           '<div class="sd-header">'+
           '  <div class="sd-header-top">'+
           '    <button class="sd-back-btn" onclick="glSongDetailBack()">← Songs</button>'+
           '    <div class="sd-header-meta">'+pills+'</div>'+
           '  </div>'+
           '  <h1 class="sd-title">'+_sdEsc(title)+'</h1>'+
           '  <div id="sd-readiness-strip" class="sd-readiness-strip"></div>'+
           '</div>'+
           '<nav class="sd-tab-bar">'+tabs+'</nav>'+
           '<div class="sd-panels">'+panels+'</div>'+
           '</div>';
}

function _sdSkeleton() {
    return '<div class="sd-panel-inner">'+
           '<div class="sd-skeleton-pulse" style="height:22px;width:45%;margin-bottom:12px;border-radius:6px"></div>'+
           '<div class="sd-skeleton-pulse" style="height:14px;width:72%;margin-bottom:8px;border-radius:4px"></div>'+
           '<div class="sd-skeleton-pulse" style="height:14px;width:58%;border-radius:4px"></div>'+
           '</div>';
}

// ── Band Lens ─────────────────────────────────────────────────────────────────
async function _sdPopulateBandLens(title) {
    var panel = document.querySelector('.sd-lens-panel[data-lens="band"]');
    if (!panel) return;
    panel.style.display = 'block';
    _sdBuildReadinessStrip(title);

    var songKey = typeof sanitizeFirebasePath==='function' ? sanitizeFirebasePath(title) : title;
    var safeSong = title.replace(/'/g,"\\'");
    var lead='', status='', cribData=null, rehearsalNotes=null, sectionRatings={}, songMeta={};

    try {
        var res = await Promise.all([
            _sdGet('songs/'+songKey+'/lead_singer'),
            _sdGet('songs/'+songKey+'/song_status'),
            _sdGet('songs/'+songKey+'/metadata'),
            loadBandDataFromDrive(title,'crib').catch(function(){return null;}),
            loadBandDataFromDrive(title,'rehearsal_notes').catch(function(){return null;}),
            _sdGet('songs/'+songKey+'/section_ratings'),
        ]);
        lead=res[0]||''; status=res[1]||''; songMeta=res[2]||{};
        cribData=res[3]; rehearsalNotes=res[4]; sectionRatings=res[5]||{};
    } catch(e) {}

    var songObj=(typeof allSongs!=='undefined')?allSongs.find(function(s){return s.title===title;}):null;
    var metaKey=(songObj&&songObj.key)||songMeta.key||'';
    var metaBpm=songObj&&songObj.bpm?String(songObj.bpm):songMeta.bpm?String(songMeta.bpm):'';

    var leadOpts=['','drew','chris','brian','pierce','drew,chris'].map(function(v){
        var lbl=v===''?'Select…':v==='drew,chris'?'Drew & Chris':v.charAt(0).toUpperCase()+v.slice(1);
        return '<option value="'+v+'"'+(lead===v?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var statusOpts=[['','— Not on Radar —'],['prospect','👀 Prospect'],['wip','🔧 Work in Progress'],['gig_ready','✅ Gig Ready']].map(function(p){
        return '<option value="'+p[0]+'"'+(status===p[0]?' selected':'')+'>'+p[1]+'</option>';
    }).join('');
    var keyOpts=['','A','Am','Bb','B','Bm','C','C#','D','Dm','E','Em','F','F#','G','Gm','Ab'].map(function(k){
        return '<option value="'+k+'"'+(metaKey===k?' selected':'')+'>'+(k||'—')+'</option>';
    }).join('');

    panel.innerHTML =
        '<div class="sd-panel-inner">'+

        // Song DNA
        '<div class="sd-card">'+
        '<div class="sd-card-title">🧬 Song DNA</div>'+
        '<div class="sd-dna-grid">'+
        '<label class="sd-dna-item"><span class="sd-dna-label">🎤 Lead</span>'+
        '<select class="app-select sd-select" onchange="sdUpdateLeadSinger(this.value)">'+leadOpts+'</select></label>'+
        '<label class="sd-dna-item"><span class="sd-dna-label">🎯 Status</span>'+
        '<select class="app-select sd-select" onchange="sdUpdateSongStatus(this.value)">'+statusOpts+'</select></label>'+
        '<label class="sd-dna-item"><span class="sd-dna-label">🔑 Key</span>'+
        '<select class="app-select sd-select" style="width:80px" onchange="sdUpdateSongKey(this.value)">'+keyOpts+'</select></label>'+
        '<label class="sd-dna-item"><span class="sd-dna-label">🥁 BPM</span>'+
        '<input type="number" class="app-input sd-bpm-input" min="40" max="240" placeholder="120" value="'+_sdEsc(metaBpm)+'" onchange="sdUpdateSongBpm(this.value)"></label>'+
        '</div>'+
        _sdSectionDots(sectionRatings)+
        '</div>'+

        // Readiness
        '<div class="sd-card">'+
        '<div class="sd-card-title">📊 Readiness</div>'+
        _sdRenderReadinessBlock(title,safeSong)+
        '</div>'+

        // Crib Notes
        '<div class="sd-card">'+
        '<div class="sd-card-title">🎭 Stage Crib Notes</div>'+
        _sdRenderCribNotes(cribData)+
        '</div>'+

        // Rehearsal Notes
        '<div class="sd-card">'+
        '<div class="sd-card-title">📝 Rehearsal Notes</div>'+
        _sdRenderRehearsalNotes(rehearsalNotes)+
        '</div>'+

        '</div>';

    _sdBuildReadinessStrip(title);
}

function _sdSectionDots(sectionRatings) {
    if (!sectionRatings||!Object.keys(sectionRatings).length) return '';
    var dots = Object.entries(sectionRatings).map(function(entry) {
        var secName=entry[0], ratings=entry[1];
        var vals=Object.values(ratings||{}).filter(function(v){return typeof v==='number';});
        if (!vals.length) return '';
        var avg=vals.reduce(function(a,b){return a+b;},0)/vals.length;
        var color=avg>=4?'#10b981':avg>=2.5?'#f59e0b':'#ef4444';
        return '<span class="sd-section-dot" style="background:'+color+'20;border:1px solid '+color+'40" title="'+_sdEsc(secName)+': '+avg.toFixed(1)+'/5">'+
               '<span style="width:7px;height:7px;border-radius:50%;background:'+color+';display:inline-block;flex-shrink:0"></span>'+
               '<span style="font-size:0.72em;font-weight:700;color:var(--text)">'+_sdEsc(secName)+'</span>'+
               '</span>';
    }).filter(Boolean).join('');
    return dots?'<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)"><div style="display:flex;flex-wrap:wrap;gap:5px">'+dots+'</div></div>':'';
}

function _sdRenderCribNotes(cribData) {
    if (!cribData) return '<div style="color:var(--text-dim);font-size:0.85em">No crib notes yet.</div>';
    if (typeof cribData==='string') return '<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.85em;color:var(--text);line-height:1.6">'+_sdEsc(cribData)+'</pre>';
    var memberEmoji={drew:'🎸',chris:'🎸',brian:'🎸',pierce:'🎹',jay:'🥁'};
    var html = Object.entries(cribData).map(function(e) {
        var member=e[0], note=e[1];
        if (!note||typeof note!=='string') return '';
        return '<div style="margin-bottom:8px"><span style="font-size:0.8em;font-weight:700;color:var(--text-muted)">'+
               (memberEmoji[member]||'👤')+' '+member.charAt(0).toUpperCase()+member.slice(1)+'</span>'+
               '<div style="font-size:0.85em;color:var(--text);margin-top:3px;line-height:1.5">'+_sdEsc(note)+'</div></div>';
    }).join('');
    return html||'<div style="color:var(--text-dim);font-size:0.85em">No crib notes yet.</div>';
}

function _sdRenderRehearsalNotes(notesData) {
    if (!notesData) return '<div style="color:var(--text-dim);font-size:0.85em">No rehearsal notes yet.</div>';
    var notes=Array.isArray(notesData)?notesData:Object.values(notesData||{});
    if (!notes.length) return '<div style="color:var(--text-dim);font-size:0.85em">No rehearsal notes yet.</div>';
    return notes.slice(-5).reverse().map(function(n) {
        if (!n) return '';
        var text=typeof n==='string'?n:(n.note||n.text||'');
        var author=n.author||n.by||'', date=n.date?n.date.slice(0,10):'';
        return '<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
               '<div style="font-size:0.85em;color:var(--text);line-height:1.5">'+_sdEsc(text)+'</div>'+
               ((author||date)?'<div style="font-size:0.72em;color:var(--text-dim);margin-top:3px">'+
               (author?_sdEsc(author)+' ':'')+(date?'· '+date:'')+'</div>':'')+'</div>';
    }).join('');
}

function _sdRenderReadinessBlock(title, safeSong) {
    var rc=(typeof readinessCache!=='undefined')?readinessCache:{};
    var members=(typeof BAND_MEMBERS_ORDERED!=='undefined')?BAND_MEMBERS_ORDERED:[];
    var songScores=rc[title]||{};
    var myKey=typeof getCurrentMemberKey==='function'?getCurrentMemberKey():null;
    if (!members.length) return '<div style="color:var(--text-dim);font-size:0.85em">Loading…</div>';
    return '<div>'+members.map(function(m) {
        var key=m.key||m, name=m.name||(key.charAt(0).toUpperCase()+key.slice(1));
        var score=songScores[key]||0, pct=score?Math.round((score/5)*100):0;
        var color=score>=4?'#10b981':score>=3?'#f59e0b':score>0?'#ef4444':'rgba(255,255,255,0.1)';
        var isMe=myKey&&key===myKey;
        var slider=isMe?'<input type="range" min="1" max="5" step="1" value="'+(score||3)+'" '+
                        'style="width:80px;accent-color:var(--accent)" '+
                        'title="Set your readiness" '+
                        'onchange="sdSaveReadiness(\''+safeSong+'\',\''+key+'\',this.value)">':'';
        return '<div style="display:flex;align-items:center;gap:10px;padding:6px 0">'+
               '<span style="font-size:0.82em;font-weight:'+(isMe?'800':'600')+';color:var(--text);min-width:52px">'+_sdEsc(name)+'</span>'+
               '<div style="flex:1;height:6px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden">'+
               '<div style="height:100%;width:'+pct+'%;background:'+color+';border-radius:3px;transition:width 0.4s ease"></div></div>'+
               '<span style="font-size:0.78em;font-weight:700;color:'+color+';min-width:22px;text-align:right">'+(score||'—')+'</span>'+
               slider+'</div>';
    }).join('')+'</div>';
}

function _sdBuildReadinessStrip(title) {
    var strip=document.getElementById('sd-readiness-strip');
    if (!strip) return;
    var rc=(typeof readinessCache!=='undefined')?readinessCache:{};
    var members=(typeof BAND_MEMBERS_ORDERED!=='undefined')?BAND_MEMBERS_ORDERED:[];
    var songScores=rc[title]||{};
    var pills=members.map(function(m){
        var key=m.key||m, name=m.name||(key.charAt(0).toUpperCase()+key.slice(1));
        var score=songScores[key];
        var color=score?(score>=4?'#10b981':score>=3?'#f59e0b':'#ef4444'):'rgba(255,255,255,0.1)';
        return '<span class="sd-readiness-pill" style="background:'+color+'" title="'+_sdEsc(name)+'">'+
               name.charAt(0)+':'+(score||'—')+'</span>';
    }).join('');
    strip.innerHTML='<div class="sd-readiness-pills">'+pills+'</div>';
}

// ── DNA update handlers ───────────────────────────────────────────────────────
window.sdUpdateLeadSinger=function(v){if(!_sdCurrentSong)return;var k=typeof sanitizeFirebasePath==='function'?sanitizeFirebasePath(_sdCurrentSong):_sdCurrentSong;_sdSet('songs/'+k+'/lead_singer',v);if(typeof showToast==='function')showToast('Lead singer saved');};
window.sdUpdateSongStatus=function(v){if(!_sdCurrentSong)return;var k=typeof sanitizeFirebasePath==='function'?sanitizeFirebasePath(_sdCurrentSong):_sdCurrentSong;_sdSet('songs/'+k+'/song_status',v);if(typeof showToast==='function')showToast('Status saved');};
window.sdUpdateSongKey=function(v){if(!_sdCurrentSong)return;var k=typeof sanitizeFirebasePath==='function'?sanitizeFirebasePath(_sdCurrentSong):_sdCurrentSong;_sdSet('songs/'+k+'/metadata/key',v);};
window.sdUpdateSongBpm=function(v){if(!_sdCurrentSong)return;var n=parseInt(v,10);if(isNaN(n)||n<20||n>320)return;var k=typeof sanitizeFirebasePath==='function'?sanitizeFirebasePath(_sdCurrentSong):_sdCurrentSong;_sdSet('songs/'+k+'/metadata/bpm',n);};
window.sdSaveReadiness=function(songTitle,memberKey,val){
    var v=parseInt(val,10); if(isNaN(v)||v<1||v>5)return;
    var k=typeof sanitizeFirebasePath==='function'?sanitizeFirebasePath(songTitle):songTitle;
    _sdSet('songs/'+k+'/readiness/'+memberKey,v);
    if(typeof readinessCache!=='undefined'){if(!readinessCache[songTitle])readinessCache[songTitle]={};readinessCache[songTitle][memberKey]=v;}
    _sdBuildReadinessStrip(songTitle);
    if(typeof showToast==='function')showToast('Readiness saved');
};

// ── Listen Lens ───────────────────────────────────────────────────────────────
async function _sdPopulateListenLens(title) {
    var panel=document.querySelector('.sd-lens-panel[data-lens="listen"]');
    if (!panel) return;
    var northStar=null, bestShot=null;
    try {
        var res=await Promise.all([
            loadBandDataFromDrive(title,'ref_versions').catch(function(){return null;}),
            loadBandDataFromDrive(title,'best_shot_takes').catch(function(){return null;}),
        ]);
        var refs=_sdArr(res[0]), shots=_sdArr(res[1]);
        refs.forEach(function(v){
            var votes=v.votes?Object.keys(v.votes).filter(function(k){return v.votes[k];}).length:0;
            if(!northStar||votes>(northStar._voteCount||0)) northStar=Object.assign({},v,{_voteCount:votes});
        });
        bestShot=shots.find(function(s){return s.crowned;})||(shots.length?shots[shots.length-1]:null);
    } catch(e){}

    var nsHTML=northStar
        ?('<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px">'+
          '<span style="font-size:1.4em">⭐</span><div style="flex:1;min-width:0">'+
          '<div style="font-size:0.85em;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_sdEsc(northStar.fetchedTitle||northStar.title||'Reference')+'</div>'+
          '<div style="font-size:0.72em;color:var(--text-dim)">'+(northStar._voteCount||0)+' votes</div></div>'+
          (northStar.url?'<button class="btn btn-sm" onclick="window.open(\''+northStar.url.replace(/'/g,"\\'")+'\',\'_blank\')" style="background:rgba(102,126,234,0.2);color:#818cf8;border:1px solid rgba(102,126,234,0.3);font-size:0.78em;padding:6px 12px;border-radius:8px;cursor:pointer;white-space:nowrap">▶ Listen</button>':'')+
          '</div>')
        :'<div style="color:var(--text-dim);font-size:0.85em">No North Star set yet — open Version Hub to browse and vote.</div>';

    var bsHTML=bestShot
        ?('<div style="display:flex;align-items:center;gap:10px;padding:10px;background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:10px">'+
          '<span style="font-size:1.4em">🏆</span><div style="flex:1;min-width:0">'+
          '<div style="font-size:0.85em;font-weight:700;color:var(--text)">'+_sdEsc(bestShot.label||'Best Take')+(bestShot.crowned?' 👑':'')+'</div>'+
          '<div style="font-size:0.72em;color:var(--text-dim)">'+_sdEsc(bestShot.uploadedByName||'')+'</div></div>'+
          (bestShot.audioUrl?'<audio controls src="'+_sdEsc(bestShot.audioUrl)+'" style="height:32px;max-width:140px"></audio>':
           bestShot.externalUrl?'<button class="btn btn-sm" onclick="window.open(\''+bestShot.externalUrl.replace(/'/g,"\\'")+'\',\'_blank\')" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.78em;padding:6px 12px;border-radius:8px;cursor:pointer">▶ Listen</button>':'')+
          '</div>')
        :'<div style="color:var(--text-dim);font-size:0.85em">No recording yet — upload a take from the Songs page.</div>';

    panel.innerHTML=
        '<div class="sd-panel-inner">'+
        '<div class="sd-card"><div class="sd-card-title">🔍 Find a Version</div>'+
        '<div style="font-size:0.85em;color:var(--text-muted);margin-bottom:12px">Search Archive.org, Relisten, Phish.in, YouTube and more.</div>'+
        '<button class="btn btn-primary" onclick="launchVersionHub()" style="width:100%;padding:13px;font-size:0.95em;background:linear-gradient(135deg,#667eea,#764ba2)">🔍 Open Version Hub</button></div>'+
        '<div class="sd-card"><div class="sd-card-title">⭐ North Star <span class="sd-title-badge">Reference</span></div>'+nsHTML+'</div>'+
        '<div class="sd-card"><div class="sd-card-title">🏆 Best Shot <span class="sd-title-badge sd-title-badge--gold">Our Recording</span></div>'+bsHTML+'</div>'+
        '</div>';
}

// ── Learn Lens ────────────────────────────────────────────────────────────────
async function _sdPopulateLearnLens(title) {
    var panel=document.querySelector('.sd-lens-panel[data-lens="learn"]');
    if (!panel) return;
    var tracks=null, tabs=null, covers=null;
    try {
        var res=await Promise.all([
            loadBandDataFromDrive(title,'practice_tracks').catch(function(){return null;}),
            loadBandDataFromDrive(title,'personal_tabs').catch(function(){return null;}),
            loadBandDataFromDrive(title,'cover_me').catch(function(){return null;}),
        ]);
        tracks=_sdArr(res[0]); tabs=_sdArr(res[1]); covers=_sdArr(res[2]);
    } catch(e){}
    panel.innerHTML=
        '<div class="sd-panel-inner">'+
        '<div class="sd-card"><div class="sd-card-title">🎧 Practice Tracks</div>'+_sdLinkList(tracks,'🎧','No practice tracks yet.')+'</div>'+
        '<div class="sd-card"><div class="sd-card-title">📄 Tabs &amp; Charts</div>'+_sdLinkList(tabs,'📄','No tabs or charts yet.')+'</div>'+
        '<div class="sd-card"><div class="sd-card-title">🎵 Cover Versions to Study</div>'+_sdLinkList(covers,'🎵','No cover versions added yet.')+'</div>'+
        '</div>';
}

function _sdLinkList(items, icon, emptyMsg) {
    if (!items||!items.length) return '<div style="color:var(--text-dim);font-size:0.85em">'+emptyMsg+'</div>';
    return items.map(function(item){
        var url=item.url||item.link||item.spotifyUrl||'';
        var label=item.title||item.label||item.name||url;
        var who=item.addedBy||item.memberKey||'';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'+
               '<span style="font-size:1.2em">'+icon+'</span>'+
               '<div style="flex:1;min-width:0">'+
               '<div style="font-size:0.85em;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_sdEsc(label)+'</div>'+
               (who?'<div style="font-size:0.72em;color:var(--text-dim)">'+_sdEsc(who)+'</div>':'')+
               '</div>'+(url?'<a href="'+_sdEsc(url)+'" target="_blank" style="color:var(--accent-light);font-size:0.78em;white-space:nowrap;text-decoration:none">Open →</a>':'')+
               '</div>';
    }).join('');
}

// ── Sing Lens ─────────────────────────────────────────────────────────────────
function _sdPopulateSingLens(title) {
    var panel=document.querySelector('.sd-lens-panel[data-lens="sing"]');
    if (!panel) return;
    if (typeof renderHarmonyLab==='function') {
        panel.innerHTML='<div class="sd-panel-inner"><div id="sd-harmony-lab-mount"></div></div>';
        renderHarmonyLab(title,'sd-harmony-lab-mount');
    } else {
        panel.innerHTML='<div class="sd-panel-inner"><div class="sd-card sd-coming-soon"><div class="sd-cs-icon">🎤</div><div class="sd-cs-title">Harmony Lab</div><div class="sd-cs-desc">Loading…</div></div></div>';
    }
}

// ── Inspire Lens ──────────────────────────────────────────────────────────────
function _sdPopulateInspireLens() {
    var panel=document.querySelector('.sd-lens-panel[data-lens="inspire"]');
    if (!panel) return;
    panel.innerHTML='<div class="sd-panel-inner"><div class="sd-card sd-coming-soon"><div class="sd-cs-icon">✨</div><div class="sd-cs-title">Inspire</div><div class="sd-cs-desc">Mood clips, alternate interpretations, and creative references — coming soon.</div></div></div>';
}

// ── Firebase helpers ──────────────────────────────────────────────────────────
function _sdGet(subpath){
    if(typeof firebaseDB==='undefined'||!firebaseDB||typeof bandPath!=='function') return Promise.resolve(null);
    return firebaseDB.ref(bandPath(subpath)).once('value').then(function(s){return s.val();}).catch(function(){return null;});
}
function _sdSet(subpath,val){
    if(typeof firebaseDB==='undefined'||!firebaseDB||typeof bandPath!=='function') return;
    firebaseDB.ref(bandPath(subpath)).set(val).catch(function(e){console.warn('[song-detail] write failed:',e);});
}

// ── Util ──────────────────────────────────────────────────────────────────────
function _sdEsc(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _sdArr(v){if(!v)return[];if(Array.isArray(v))return v;return Object.values(v);}

// ── Page registration ─────────────────────────────────────────────────────────
if (typeof pageRenderers!=='undefined') {
    pageRenderers['songdetail']=function(){
        _sdLensPopulated={}; _sdCurrentLens='band';
        window.renderSongDetail();
    };
}

// ── Styles ────────────────────────────────────────────────────────────────────
function _sdInjectStyles(){
    if(document.getElementById('sd-styles')) return;
    var s=document.createElement('style');
    s.id='sd-styles';
    s.textContent='.song-detail-page{max-width:800px;margin:0 auto;padding:0 0 80px;opacity:0;transform:translateY(12px);transition:opacity 0.25s ease,transform 0.25s ease}'+
    '#page-songdetail.sd-entered .song-detail-page{opacity:1;transform:none}'+
    '.sd-header{padding:14px 16px 0;background:var(--bg-card,#1e293b);border-bottom:1px solid var(--border,rgba(255,255,255,0.08));position:sticky;top:0;z-index:50;backdrop-filter:blur(12px)}'+
    '.sd-header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}'+
    '.sd-back-btn{background:transparent;border:1px solid rgba(255,255,255,0.1);color:var(--text-muted,#94a3b8);padding:5px 12px;border-radius:20px;font-size:0.82em;font-weight:600;cursor:pointer;transition:all 0.15s}'+
    '.sd-back-btn:hover{background:rgba(255,255,255,0.06);color:var(--text,#f1f5f9)}'+
    '.sd-header-meta{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}'+
    '.sd-meta-pill{font-size:0.73em;font-weight:700;padding:3px 8px;border-radius:12px;background:rgba(255,255,255,0.07);color:var(--text-muted,#94a3b8);border:1px solid rgba(255,255,255,0.08)}'+
    '.sd-title{font-size:1.45em;font-weight:800;color:var(--text,#f1f5f9);margin:0 0 8px;line-height:1.2}'+
    '.sd-readiness-strip{margin-bottom:8px;min-height:20px}'+
    '.sd-readiness-pills{display:flex;gap:4px;flex-wrap:wrap}'+
    '.sd-readiness-pill{font-size:0.7em;font-weight:700;padding:2px 7px;border-radius:10px;color:#fff}'+
    '.sd-tab-bar{display:flex;overflow-x:auto;-webkit-overflow-scrolling:touch;background:var(--bg-card,#1e293b);border-bottom:2px solid var(--border,rgba(255,255,255,0.08));padding:0 8px;scrollbar-width:none;position:sticky;top:0;z-index:49}'+
    '.sd-tab-bar::-webkit-scrollbar{display:none}'+
    '.sd-tab-btn{display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 14px 6px;background:transparent;border:none;border-bottom:3px solid transparent;color:var(--text-muted,#94a3b8);cursor:pointer;font-weight:600;white-space:nowrap;transition:all 0.15s;flex-shrink:0}'+
    '.sd-tab-btn:hover{color:var(--text,#f1f5f9);background:rgba(255,255,255,0.03)}'+
    '.sd-tab-btn--active{color:var(--accent,#667eea);border-bottom-color:var(--accent,#667eea)}'+
    '.sd-tab-icon{font-size:1.15em}.sd-tab-label{font-size:0.7em;font-weight:700;letter-spacing:0.04em;text-transform:uppercase}'+
    '.sd-panels{padding:14px}.sd-lens-panel{min-height:200px}'+
    '.sd-panel-inner{display:flex;flex-direction:column;gap:12px}'+
    '.sd-card{background:var(--bg-card,#1e293b);border:1px solid var(--border,rgba(255,255,255,0.08));border-radius:12px;padding:16px}'+
    '.sd-card-title{font-size:0.82em;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted,#94a3b8);margin-bottom:12px;display:flex;align-items:center;gap:8px}'+
    '.sd-title-badge{font-size:0.78em;font-weight:700;padding:2px 7px;border-radius:8px;background:rgba(102,126,234,0.15);color:#818cf8;text-transform:none;letter-spacing:0}'+
    '.sd-title-badge--gold{background:rgba(251,191,36,0.15);color:#fbbf24}'+
    '.sd-dna-grid{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:8px}'+
    '.sd-dna-item{display:flex;align-items:center;gap:6px}'+
    '.sd-dna-label{font-size:0.8em;font-weight:700;color:var(--text-muted,#94a3b8);white-space:nowrap}'+
    '.sd-select{font-size:0.82em!important;padding:5px 8px!important}'+
    '.sd-bpm-input{width:65px!important;padding:5px 8px!important;font-size:0.82em!important}'+
    '.sd-coming-soon{text-align:center;padding:36px 20px}'+
    '.sd-cs-icon{font-size:2.2em;margin-bottom:10px}'+
    '.sd-cs-title{font-size:1.1em;font-weight:800;color:var(--text,#f1f5f9);margin-bottom:6px}'+
    '.sd-cs-desc{font-size:0.88em;color:var(--text-muted,#94a3b8);margin-bottom:10px}'+
    '.sd-skeleton-pulse{background:linear-gradient(90deg,rgba(255,255,255,0.06) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.06) 75%);background-size:200% 100%;animation:sdSkeletonPulse 1.4s infinite;border-radius:4px;margin-bottom:8px}'+
    '@keyframes sdSkeletonPulse{0%{background-position:200% 0}100%{background-position:-200% 0}}';
    document.head.appendChild(s);
}

console.log('✅ song-detail.js loaded (Phase 2 — direct Firebase, no DOM mirroring)');
