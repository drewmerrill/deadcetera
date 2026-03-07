// ============================================================================
// js/features/practice.js
// Practice Plan: per-rehearsal song checklists linked to calendar events.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, calendar.js
// EXPOSES globals: renderPracticePage, renderPracticePlanForDate,
//   practicePlanSelectDate, sendToPracticePlan, exportPracticePlan
// ============================================================================

'use strict';

// ============================================================================
// PRACTICE PLAN
// ============================================================================
// ============================================================================
// PRACTICE PLAN — linked to calendar rehearsal events
// Each rehearsal event on the calendar has its own plan stored under
// _band/practice_plans/{YYYY-MM-DD}
// ============================================================================

let practicePlanActiveDate = null;   // which rehearsal's plan is open

async function renderPracticePage(el) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Loading...</div>';

    // Load song statuses and calendar events in parallel
    const [statusMap, allEvents] = await Promise.all([
        loadSongStatusMap(),
        loadCalendarEventsRaw()
    ]);

    const today = new Date();
    today.setHours(0,0,0,0);

    // Filter to rehearsal events only, sorted by date
    const rehearsals = allEvents
        .filter(e => e.type === 'rehearsal')
        .sort((a,b) => (a.date||'').localeCompare(b.date||''));

    // Find next upcoming rehearsal (or most recent past one)
    const upcoming = rehearsals.filter(r => new Date(r.date+'T00:00:00') >= today);
    const past     = rehearsals.filter(r => new Date(r.date+'T00:00:00') <  today);
    const defaultEvent = upcoming[0] || past[past.length-1] || null;

    if (!practicePlanActiveDate && defaultEvent) {
        practicePlanActiveDate = defaultEvent.date;
    }

    const songList = typeof allSongs !== 'undefined' ? allSongs : [];
    const thisWeek    = songList.filter(s => statusMap[s.title] === 'this_week');
    const needsPolish = songList.filter(s => statusMap[s.title] === 'needs_polish');
    const gigReady    = songList.filter(s => statusMap[s.title] === 'gig_ready');
    const onDeck      = songList.filter(s => statusMap[s.title] === 'on_deck');

    function songRow(s, badge='') {
        return `<div class="list-item" style="cursor:pointer" onclick="selectSong('${s.title.replace(/'/g,"\\'")}');showPage('songs')">
            <span style="color:var(--text-dim);font-size:0.78em;min-width:35px;flex-shrink:0">${s.band||''}</span>
            <span style="flex:1">${s.title}</span>${badge}
        </div>`;
    }

    // Build rehearsal selector tabs
    const tabsHtml = rehearsals.length === 0 ? '' : `
    <div class="app-card" style="margin-bottom:0;border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom:none">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
            <h3 style="margin:0">🎸 Rehearsal Plans</h3>
            <button class="btn btn-primary btn-sm" onclick="practicePlanNew()">+ New Rehearsal</button>
        </div>
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none">
            ${rehearsals.map(r => {
                const isPast = new Date(r.date+'T00:00:00') < today;
                const isActive = r.date === practicePlanActiveDate;
                const label = formatPracticeDate(r.date);
                return `<button onclick="practicePlanSelectDate('${r.date}')"
                    style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid ${isActive?'var(--accent)':'var(--border)'};
                    background:${isActive?'var(--accent)':'rgba(255,255,255,0.03)'};
                    color:${isActive?'white':isPast?'var(--text-dim)':'var(--text-muted)'};
                    font-size:0.78em;font-weight:${isActive?'700':'500'};cursor:pointer;white-space:nowrap">
                    ${isPast?'':'🎸 '}${label}${isPast?' ✓':''}
                </button>`;
            }).join('')}
        </div>
    </div>`;

    el.innerHTML = `
    <div class="page-header">
        <h1>📋 Practice Plans</h1>
        <p>Each rehearsal has its own plan — songs to focus on, goals, notes</p>
    </div>

    <!-- STAT CARDS -->
    <div class="card-grid" style="margin-bottom:16px">
        <div class="stat-card"><div class="stat-value" style="color:var(--red)">${thisWeek.length}</div><div class="stat-label">This Week</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--yellow)">${needsPolish.length}</div><div class="stat-label">Needs Polish</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--green)">${gigReady.length}</div><div class="stat-label">Gig Ready</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--accent-light)">${onDeck.length}</div><div class="stat-label">On Deck</div></div>
    </div>

    <!-- REHEARSAL TABS + PLAN -->
    ${rehearsals.length === 0
        ? `<div class="app-card" style="text-align:center;padding:32px">
            <div style="font-size:2em;margin-bottom:12px">🎸</div>
            <div style="font-weight:600;margin-bottom:8px">No rehearsals on the calendar yet</div>
            <div style="color:var(--text-dim);font-size:0.9em;margin-bottom:16px">Add a rehearsal event on the Calendar page, then come back to build its practice plan.</div>
            <button class="btn btn-primary" onclick="showPage('calendar')">📆 Go to Calendar</button>
           </div>`
        : `${tabsHtml}
           <div class="app-card" id="practicePlanBody" style="border-top-left-radius:0;border-top-right-radius:0">
               <div style="text-align:center;padding:20px;color:var(--text-dim)">Loading plan...</div>
           </div>`
    }

    <!-- SONG STATUS LISTS -->
    <div class="app-card"><h3 style="margin-bottom:10px">🎯 This Week's Focus</h3>
        ${thisWeek.length
            ? thisWeek.map(s => songRow(s, '<span style="color:var(--red);font-size:0.72em;font-weight:600;margin-left:4px">🎯</span>')).join('')
            : '<div style="padding:12px;color:var(--text-dim);text-align:center;font-size:0.9em">No songs marked "This Week" yet</div>'}
    </div>
    <div class="app-card"><h3 style="margin-bottom:10px">⚠️ Needs Polish</h3>
        ${needsPolish.length
            ? needsPolish.map(s => songRow(s)).join('')
            : '<div style="padding:12px;color:var(--text-dim);text-align:center;font-size:0.9em">None — looking tight! 💪</div>'}
    </div>
    <div class="app-card"><h3 style="margin-bottom:10px">📚 On Deck (${onDeck.length})</h3>
        ${onDeck.length
            ? onDeck.map(s => songRow(s)).join('')
            : '<div style="padding:12px;color:var(--text-dim);text-align:center;font-size:0.9em">No songs on deck</div>'}
    </div>`;

    // Render the active plan
    if (practicePlanActiveDate) {
        renderPracticePlanForDate(practicePlanActiveDate, statusMap);
    }
}

// Load all song statuses into a map
async function loadSongStatusMap() {
    const statusMap = {};
    try {
        const allStatuses = await loadBandDataFromDrive('_band', 'song_statuses');
        if (allStatuses && typeof allStatuses === 'object') Object.assign(statusMap, allStatuses);
        // Fallback to localStorage
        (allSongs||[]).forEach(s => {
            if (!statusMap[s.title]) {
                const cached = localStorage.getItem('deadcetera_status_' + s.title);
                if (cached) statusMap[s.title] = cached;
            }
        });
    } catch(e) {}
    return statusMap;
}

// Load all calendar events as raw array
async function loadCalendarEventsRaw() {
    try {
        return toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    } catch(e) { return []; }
}

function formatPracticeDate(dateStr) {
    if (!dateStr) return '?';
    const d = new Date(dateStr + 'T12:00:00');
    const opts = { month: 'short', day: 'numeric' };
    const day = d.toLocaleDateString('en-US', opts);
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    return `${dow} ${day}`;
}

async function renderPracticePlanForDate(dateStr, statusMap) {
    const body = document.getElementById('practicePlanBody');
    if (!body) return;

    // Load the stored plan for this date
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const statusMap2 = statusMap || await loadSongStatusMap();
    const songList = typeof allSongs !== 'undefined' ? allSongs : [];
    const suggested = songList.filter(s =>
        ['this_week','needs_polish'].includes(statusMap2[s.title])
    );

    const displayDate = formatPracticeDate(dateStr);
    const today = new Date(); today.setHours(0,0,0,0);
    const isPast = new Date(dateStr+'T00:00:00') < today;

    // Goals list
    const goals = toArray(plan.goals || []);
    // Song list for this rehearsal
    const planSongs = toArray(plan.songs || []);

    body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <div>
            <h3 style="margin:0;color:var(--accent-light)">🎸 ${displayDate}${isPast?' — Past Rehearsal':''}</h3>
            ${plan.location ? `<div style="font-size:0.8em;color:var(--text-dim);margin-top:2px">📍 ${plan.location}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="practicePlanEditMeta('${dateStr}')">✏️ Details</button>
            ${!isPast ? `<button class="btn btn-primary btn-sm" onclick="practicePlanSave('${dateStr}')">💾 Save Plan</button>` : ''}
        </div>
    </div>

    <!-- START TIME / LOCATION summary -->
    ${plan.startTime || plan.location ? `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;font-size:0.82em;color:var(--text-muted)">
        ${plan.startTime ? `<span>⏰ ${plan.startTime}</span>` : ''}
        ${plan.location  ? `<span>📍 ${plan.location}</span>` : ''}
        ${plan.duration  ? `<span>⏱ ${plan.duration}</span>` : ''}
    </div>` : ''}

    <!-- GOALS -->
    <div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🎯 Session Goals</div>
        <div id="ppGoalsList" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
            ${goals.length ? goals.map((g,i) => `
            <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px">
                <span style="flex:1;font-size:0.88em">${g}</span>
                ${!isPast ? `<button onclick="ppRemoveGoal(${i},'${dateStr}')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em">✕</button>` : ''}
            </div>`).join('') : '<div style="color:var(--text-dim);font-size:0.85em;font-style:italic">No goals set yet</div>'}
        </div>
        ${!isPast ? `
        <div style="display:flex;gap:6px">
            <input class="app-input" id="ppNewGoal" placeholder="Add a goal, e.g. 'Nail the Scarlet→Fire transition'" style="flex:1;font-size:0.85em" onkeydown="if(event.key==='Enter')ppAddGoal('${dateStr}')">
            <button class="btn btn-ghost btn-sm" onclick="ppAddGoal('${dateStr}')">+ Add</button>
        </div>` : ''}
    </div>

    <!-- SONGS FOR THIS REHEARSAL -->
    <div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🎵 Songs to Rehearse</div>
        <div id="ppSongsList">
            ${planSongs.length ? planSongs.map((s,i) => `
            <div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.03);border-radius:6px;padding:6px 10px;margin-bottom:4px">
                <span style="color:var(--text-dim);font-size:0.72em;min-width:28px">${s.band||''}</span>
                <span style="flex:1;font-size:0.88em;cursor:pointer" onclick="selectSong('${(s.title||'').replace(/'/g,"\\'")}');showPage('songs')">${s.title||''}</span>
                ${s.focus ? `<span style="font-size:0.7em;color:var(--yellow);flex-shrink:0">${s.focus}</span>` : ''}
                ${!isPast ? `<button onclick="ppRemoveSong(${i},'${dateStr}')" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9em;flex-shrink:0">✕</button>` : ''}
            </div>`).join('') : '<div style="color:var(--text-dim);font-size:0.85em;font-style:italic;padding:4px 0">No songs added yet</div>'}
        </div>
        ${!isPast ? `
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <select class="app-select" id="ppSongPicker" style="flex:2;min-width:160px;font-size:0.82em">
                <option value="">— Pick a song —</option>
                ${suggested.length ? '<optgroup label="🎯 Suggested (This Week / Needs Polish)">' + suggested.map(s=>`<option value="${s.title.replace(/"/g,'&quot;')}">${s.title}</option>`).join('') + '</optgroup>' : ''}
                <optgroup label="All Songs">
                    ${(allSongs||[]).map(s=>`<option value="${s.title.replace(/"/g,'&quot;')}">${s.title}</option>`).join('')}
                </optgroup>
            </select>
            <input class="app-input" id="ppSongFocus" placeholder="Focus note (optional)" style="flex:2;min-width:120px;font-size:0.82em">
            <button class="btn btn-ghost btn-sm" onclick="ppAddSong('${dateStr}')">+ Add</button>
        </div>` : ''}
    </div>

    <!-- NOTES / AGENDA -->
    <div>
        <div style="font-weight:700;font-size:0.85em;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">📝 Notes & Agenda</div>
        ${!isPast
            ? `<textarea class="app-textarea" id="ppNotes" rows="4" placeholder="Anything else — warm-up order, who's bringing what, special requests...">${plan.notes||''}</textarea>
               <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                   <button class="btn btn-primary btn-sm" onclick="practicePlanSave('${dateStr}')">💾 Save Plan</button>
                   <button class="btn btn-success btn-sm" onclick="notifFromPracticePlan('${dateStr}')">🔔 Share to Band</button>
                   <button class="btn btn-ghost btn-sm" onclick="practicePlanExport('${dateStr}')">📄 Export Text</button>
               </div>`
            : `<div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:10px;font-size:0.88em;color:var(--text-muted);white-space:pre-wrap">${plan.notes || 'No notes recorded.'}</div>`
        }
    </div>`;
}

function practicePlanSelectDate(dateStr) {
    practicePlanActiveDate = dateStr;
    // Update tab highlight
    document.querySelectorAll('#practicePlanBody').forEach(b => {});
    // Re-render just the plan body (fast)
    renderPracticePlanForDate(dateStr);
    // Update tab button styles
    document.querySelectorAll('[onclick^="practicePlanSelectDate"]').forEach(btn => {
        const active = btn.getAttribute('onclick').includes(`'${dateStr}'`);
        btn.style.background = active ? 'var(--accent)' : 'rgba(255,255,255,0.03)';
        btn.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
        btn.style.color = active ? 'white' : 'var(--text-muted)';
        btn.style.fontWeight = active ? '700' : '500';
    });
    document.getElementById('practicePlanBody')?.scrollIntoView({behavior:'smooth', block:'nearest'});
}

async function ppAddGoal(dateStr) {
    const inp = document.getElementById('ppNewGoal');
    const val = inp?.value.trim();
    if (!val) return;
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const goals = toArray(plan.goals || []);
    goals.push(val);
    plan.goals = goals;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    inp.value = '';
    renderPracticePlanForDate(dateStr);
}

async function ppRemoveGoal(idx, dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const goals = toArray(plan.goals || []);
    goals.splice(idx, 1);
    plan.goals = goals;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    renderPracticePlanForDate(dateStr);
}

async function ppAddSong(dateStr) {
    const title = document.getElementById('ppSongPicker')?.value;
    if (!title) return;
    const focus = document.getElementById('ppSongFocus')?.value.trim() || '';
    const songData = (allSongs||[]).find(s => s.title === title);
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const songs = toArray(plan.songs || []);
    if (songs.find(s => s.title === title)) { alert('Already in this plan!'); return; }
    songs.push({ title, band: songData?.band || '', focus });
    plan.songs = songs;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    document.getElementById('ppSongPicker').value = '';
    document.getElementById('ppSongFocus').value = '';
    renderPracticePlanForDate(dateStr);
}

async function ppRemoveSong(idx, dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const songs = toArray(plan.songs || []);
    songs.splice(idx, 1);
    plan.songs = songs;
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    renderPracticePlanForDate(dateStr);
}

async function practicePlanSave(dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    plan.notes = document.getElementById('ppNotes')?.value || plan.notes || '';
    plan.updatedAt = new Date().toISOString();
    plan.updatedBy = currentUserEmail || 'unknown';
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    // Visual confirmation
    const btn = event?.target;
    if (btn) { const orig = btn.textContent; btn.textContent = '✅ Saved!'; setTimeout(()=>btn.textContent=orig, 1800); }
}

function practicePlanEditMeta(dateStr) {
    const modal = document.createElement('div');
    modal.id = 'ppMetaModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:400px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">✏️ Rehearsal Details</h3>
            <button onclick="document.getElementById('ppMetaModal').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <div class="form-row"><label class="form-label">Start Time</label>
            <input class="app-input" id="ppMetaTime" placeholder="e.g. 7:00 PM"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">Location / Venue</label>
            <input class="app-input" id="ppMetaLoc" placeholder="e.g. Drew's garage, Studio B"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">Expected Duration</label>
            <input class="app-input" id="ppMetaDur" placeholder="e.g. 3 hours"></div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" style="flex:1" onclick="practicePlanSaveMeta('${dateStr}')">💾 Save</button>
            <button class="btn btn-ghost" onclick="document.getElementById('ppMetaModal').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    // Pre-fill
    loadBandDataFromDrive('_band', `practice_plan_${dateStr}`).then(plan => {
        if (!plan) return;
        if (plan.startTime) document.getElementById('ppMetaTime').value = plan.startTime;
        if (plan.location)  document.getElementById('ppMetaLoc').value  = plan.location;
        if (plan.duration)  document.getElementById('ppMetaDur').value  = plan.duration;
    });
}

async function practicePlanSaveMeta(dateStr) {
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    plan.startTime = document.getElementById('ppMetaTime')?.value.trim() || '';
    plan.location  = document.getElementById('ppMetaLoc')?.value.trim() || '';
    plan.duration  = document.getElementById('ppMetaDur')?.value.trim() || '';
    await saveBandDataToDrive('_band', `practice_plan_${dateStr}`, plan);
    document.getElementById('ppMetaModal')?.remove();
    renderPracticePlanForDate(dateStr);
}

function practicePlanNew() {
    // Just send user to calendar to add a rehearsal event
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:360px;width:100%;color:var(--text);text-align:center">
        <div style="font-size:2em;margin-bottom:12px">📆</div>
        <h3 style="margin-bottom:8px">Add a Rehearsal on the Calendar</h3>
        <p style="color:var(--text-dim);font-size:0.88em;margin-bottom:20px">Practice plans are created from calendar rehearsal events. Add a rehearsal event first, then its plan will appear here.</p>
        <div style="display:flex;gap:8px;justify-content:center">
            <button class="btn btn-primary" onclick="this.closest('[style]').remove();showPage('calendar')">📆 Go to Calendar</button>
            <button class="btn btn-ghost" onclick="this.closest('[style]').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function practicePlanExport(dateStr) {
    loadBandDataFromDrive('_band', `practice_plan_${dateStr}`).then(plan => {
        if (!plan) return;
        const displayDate = formatPracticeDate(dateStr);
        const songs = toArray(plan.songs||[]).map(s=>`  • ${s.title}${s.focus?' — '+s.focus:''}`).join('\n');
        const goals = toArray(plan.goals||[]).map(g=>`  • ${g}`).join('\n');
        const text = `🎸 DEADCETERA PRACTICE PLAN — ${displayDate}
${plan.startTime ? '⏰ ' + plan.startTime : ''}${plan.location ? '  📍 ' + plan.location : ''}

GOALS:
${goals || '  (none)'}

SONGS:
${songs || '  (none)'}

NOTES:
${plan.notes || '  (none)'}`.trim();

        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
        modal.innerHTML = `
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:480px;width:100%;color:var(--text)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <h3 style="margin:0;color:var(--accent-light)">📤 Share Practice Plan</h3>
                <button onclick="this.closest('[style]').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
            </div>
            <textarea class="app-textarea" rows="12" style="font-family:monospace;font-size:0.78em">${text}</textarea>
            <button class="btn btn-primary" style="width:100%;margin-top:10px" onclick="navigator.clipboard.writeText(document.querySelector('[style*=fixed] textarea').value).then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy to Clipboard',1800)})">📋 Copy to Clipboard</button>
        </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    });
}

