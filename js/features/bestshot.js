// ============================================================================
// js/features/bestshot.js
// Best Shot vs North Star: recording comparisons, section ratings, overview.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, worker-api.js
// EXPOSES globals: renderBestShotVsNorthStar, renderBestShotPage,
//   renderBestShotOverviewList, bestShotAudioHtml, filterBestShotOverview,
//   loadBestShotOverview
// ============================================================================

'use strict';

// ============================================================================
// BEST SHOT vs NORTH STAR — Side by Side with Section Ratings
// ============================================================================

// ── Song Detail: Side-by-Side View ──────────────────────────────────────────
async function renderBestShotVsNorthStar(songTitle) {
    var container = document.getElementById('bestShotVsNorthStar');
    if (!container) return;

    // Load data in parallel
    var [refVersions, shots, structure, ratings, sectionNotes] = await Promise.all([
        loadRefVersions(songTitle),
        loadBandDataFromDrive(songTitle, 'best_shot_takes').then(function(d) { return toArray(d || []); }),
        loadBandDataFromDrive(songTitle, 'song_structure'),
        loadBandDataFromDrive(songTitle, 'best_shot_ratings'),
        loadBandDataFromDrive(songTitle, 'best_shot_section_notes')
    ]);
    refVersions = toArray(refVersions || []);
    if (!ratings) ratings = {};

    // Find the crowned North Star (most votes)
    var northStar = null;
    refVersions.forEach(function(v) {
        var votes = v.votes ? Object.keys(v.votes).filter(function(k) { return v.votes[k]; }).length : 0;
        if (!northStar || votes > (northStar._voteCount || 0)) {
            northStar = v;
            northStar._voteCount = votes;
        }
    });

    // Find crowned best shot (or latest)
    var crowned = shots.find(function(s) { return s.crowned; });
    if (!crowned && shots.length) crowned = shots[shots.length - 1];

    // Build sections list from structure.sections (custom) or defaults
    var defaultSections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Jam', 'Outro'];
    var sections = (structure && structure.sections && structure.sections.length) ? toArray(structure.sections) : defaultSections;

    // ── Side by Side Players ──
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';

    // North Star column
    html += '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:14px;text-align:center">';
    html += '<div style="font-size:1.2em;margin-bottom:4px">⭐</div>';
    html += '<div style="font-weight:700;font-size:0.85em;color:var(--accent-light);margin-bottom:6px">North Star</div>';
    if (northStar) {
        var nsTitle = northStar.fetchedTitle || northStar.title || 'Reference';
        var nsUrl = northStar.url || northStar.spotifyUrl || '';
        html += '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + nsTitle + '</div>';
        html += '<button onclick="window.open(\'' + nsUrl.replace(/'/g, "\\'") + '\',\'_blank\')" class="btn btn-sm" style="background:rgba(102,126,234,0.2);color:var(--accent-light);border:1px solid rgba(102,126,234,0.3);font-size:0.78em;padding:6px 14px;border-radius:8px;cursor:pointer">▶ Listen</button>';
        html += '<div style="font-size:0.68em;color:var(--text-dim);margin-top:6px">' + (northStar._voteCount || 0) + '/' + Object.keys(bandMembers).length + ' votes</div>';
    } else {
        html += '<div style="font-size:0.78em;color:var(--text-dim)">No reference yet</div>';
        html += '<button onclick="showPage(\'songs\');setTimeout(function(){document.getElementById(\'step3ref\')?.scrollIntoView({behavior:\'smooth\'})},300)" class="btn btn-sm btn-ghost" style="font-size:0.72em;margin-top:6px">+ Add One</button>';
    }
    html += '</div>';

    // Best Shot column
    html += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px;text-align:center">';
    html += '<div style="font-size:1.2em;margin-bottom:4px">🏆</div>';
    html += '<div style="font-weight:700;font-size:0.85em;color:#f59e0b;margin-bottom:6px">Best Shot</div>';
    if (crowned) {
        var who = bandMembers[crowned.uploadedBy]?.name || crowned.uploadedByName || '';
        html += '<div style="font-size:0.78em;color:var(--text-muted);margin-bottom:4px">' + (crowned.label || new Date(crowned.uploadedAt).toLocaleDateString()) + '</div>';
        if (crowned.audioUrl) html += bestShotAudioHtml(crowned.audioUrl, 'width:100%;max-width:200px;height:32px;margin:4px auto');
        else if (crowned.externalUrl) html += '<button onclick="window.open(\'' + crowned.externalUrl.replace(/'/g, "\\'") + '\',\'_blank\')" class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);font-size:0.78em;padding:6px 14px;border-radius:8px;cursor:pointer">▶ Listen</button>';
        html += '<div style="font-size:0.68em;color:var(--text-dim);margin-top:4px">' + who + (crowned.crowned ? ' 👑' : '') + '</div>';
    } else {
        html += '<div style="font-size:0.78em;color:var(--text-dim)">No recording yet</div>';
        html += '<button onclick="addBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\')" class="btn btn-sm btn-ghost" style="font-size:0.72em;margin-top:6px">📤 Upload Take</button>';
    }
    html += '</div></div>';

    // ── Section Scorecard ──
    // ── Section Scorecard (always shown) ──
    {
        html += '<div style="margin-bottom:16px">';
        html += '<div style="font-weight:700;font-size:0.9em;margin-bottom:10px;display:flex;align-items:center;gap:6px"><span>📊 Section Scorecard</span><span style="font-size:0.75em;font-weight:400;color:var(--text-dim)">Tap to rate · 💬 for notes</span><button onclick="editScorecardSections(\'' + songTitle.replace(/'/g, "\\'") + '\')" style="margin-left:auto;background:none;border:none;cursor:pointer;font-size:0.85em;color:var(--text-dim)" title="Edit sections">✏️</button></div>';
        var totalGreen = 0, totalSections = sections.length;
        var allSectionNotes = null; // loaded lazily below
        sections.forEach(function(sec) {
            var sectionRatings = ratings[sec] || {};
            var counts = {green: 0, yellow: 0, red: 0};
            var myRating = sectionRatings[emailKey(currentUserEmail)] || '';
            Object.values(sectionRatings).forEach(function(r) { if (counts[r] !== undefined) counts[r]++; });
            var total = counts.green + counts.yellow + counts.red;
            var pctGreen = total ? Math.round(counts.green / total * 100) : 0;
            var pctYellow = total ? Math.round(counts.yellow / total * 100) : 0;
            if (total && counts.green === total) totalGreen++;
            var barColor = !total ? 'rgba(255,255,255,0.06)' : 'linear-gradient(90deg, #10b981 ' + pctGreen + '%, #f59e0b ' + pctGreen + '% ' + (pctGreen + pctYellow) + '%, #ef4444 ' + (pctGreen + pctYellow) + '%)';
            html += '<div data-section="' + sec + '" style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
            var noteThread = toArray((sectionNotes || {})[sec] || []);
            var noteCount = noteThread.length;
            var hasNew = noteThread.some(function(n) { return n.ts && (Date.now() - new Date(n.ts).getTime()) < 24 * 60 * 60 * 1000; });
            html += '<div style="width:70px;font-size:0.78em;color:var(--text-muted);font-weight:600;flex-shrink:0;cursor:pointer;display:flex;align-items:center;gap:2px" onclick="toggleSectionNotes(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\')" title="View/add notes for ' + sec + '">' + sec + ' 💬' + (noteCount ? '<span style="font-size:0.8em;background:' + (hasNew ? '#f59e0b' : 'rgba(255,255,255,0.1)') + ';color:' + (hasNew ? '#000' : 'var(--text-dim)') + ';border-radius:8px;padding:0 4px;font-weight:700">' + noteCount + '</span>' : '') + '</div>';
            html += '<div data-bar="' + sec + '" style="flex:1;height:22px;border-radius:6px;background:' + barColor + ';position:relative;overflow:hidden;border:1px solid rgba(255,255,255,0.06)">';
            if (total) html += '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.65em;color:white;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.5)">' + counts.green + '🟢 ' + counts.yellow + '🟡 ' + counts.red + '🔴</div>';
            html += '</div>';
            // My vote buttons
            html += '<div data-votes="' + sec + '" style="display:flex;gap:2px;flex-shrink:0">';
            html += '<button onclick="event.stopPropagation();rateBestShotSection(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\',\'green\')" style="width:24px;height:24px;border-radius:6px;border:' + (myRating==='green'?'2px solid #10b981':'1px solid rgba(255,255,255,0.1)') + ';background:' + (myRating==='green'?'rgba(16,185,129,0.2)':'rgba(255,255,255,0.04)') + ';cursor:pointer;font-size:0.7em;display:flex;align-items:center;justify-content:center" title="Locked In">🟢</button>';
            html += '<button onclick="event.stopPropagation();rateBestShotSection(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\',\'yellow\')" style="width:24px;height:24px;border-radius:6px;border:' + (myRating==='yellow'?'2px solid #f59e0b':'1px solid rgba(255,255,255,0.1)') + ';background:' + (myRating==='yellow'?'rgba(245,158,11,0.2)':'rgba(255,255,255,0.04)') + ';cursor:pointer;font-size:0.7em;display:flex;align-items:center;justify-content:center" title="Getting There">🟡</button>';
            html += '<button onclick="event.stopPropagation();rateBestShotSection(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + sec + '\',\'red\')" style="width:24px;height:24px;border-radius:6px;border:' + (myRating==='red'?'2px solid #ef4444':'1px solid rgba(255,255,255,0.1)') + ';background:' + (myRating==='red'?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.04)') + ';cursor:pointer;font-size:0.7em;display:flex;align-items:center;justify-content:center" title="Needs Work">🔴</button>';
            html += '</div></div>';
        });
        html += '</div>';

        // ── Focus Areas (auto-insights) ──
        var weakSections = [];
        var strongSections = [];
        sections.forEach(function(sec) {
            var sr = ratings[sec] || {};
            var vals = Object.values(sr);
            if (!vals.length) return;
            var reds = vals.filter(function(v) { return v === 'red'; }).length;
            var greens = vals.filter(function(v) { return v === 'green'; }).length;
            if (reds > greens) weakSections.push(sec);
            else if (greens === vals.length) strongSections.push(sec);
        });

        if (weakSections.length || strongSections.length) {
            html += '<div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px">';
            html += '<div style="font-weight:700;font-size:0.85em;margin-bottom:8px">🎯 Next Rehearsal Focus</div>';
            if (weakSections.length) {
                html += '<div style="font-size:0.82em;color:#ef4444;margin-bottom:6px">🔴 Needs work: <strong>' + weakSections.join(', ') + '</strong></div>';
                html += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:8px">Spend extra time on ' + (weakSections.length === 1 ? 'the ' + weakSections[0] : 'these sections') + ' at next practice.</div>';
            }
            if (strongSections.length) {
                html += '<div style="font-size:0.82em;color:#10b981">🟢 Locked in: <strong>' + strongSections.join(', ') + '</strong>' + (strongSections.length > 1 ? ' — run these once and move on' : '') + '</div>';
            }
            html += '</div>';
        }

        // ── Overall Progress ──
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">';
        html += '<div style="font-size:0.82em;color:var(--text-muted)">Progress:</div>';
        html += '<div style="flex:1;height:8px;border-radius:4px;background:rgba(255,255,255,0.06);overflow:hidden">';
        var overallPct = totalSections ? Math.round(totalGreen / totalSections * 100) : 0;
        html += '<div style="width:' + overallPct + '%;height:100%;background:linear-gradient(90deg,#10b981,#34d399);border-radius:4px;transition:width 0.3s"></div>';
        html += '</div>';
        html += '<div style="font-size:0.82em;font-weight:700;color:' + (overallPct === 100 ? '#10b981' : 'var(--text)') + '">' + totalGreen + '/' + totalSections + '</div>';
        html += '</div>';
    } // end section scorecard block

    // ── Evolution Timeline ──
    if (shots.length) {
        html += '<div style="margin-bottom:12px">';
        html += '<div style="font-weight:700;font-size:0.85em;margin-bottom:8px">📼 All Takes (' + shots.length + ')</div>';
        shots.forEach(function(s, idx) {
            var isCrowned = s.crowned;
            var recDate = s.recordedDate || s.uploadedAt || '';
            var dateLabel = recDate ? new Date(recDate).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : 'No date';
            var who = bandMembers[s.uploadedBy]?.name || s.uploadedByName || '';
            html += '<div class="app-card" style="margin-bottom:6px;padding:10px;border-left:3px solid ' + (isCrowned ? '#f59e0b' : 'var(--border)') + '">';
            html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
            html += '<div style="flex:1;min-width:0">';
            html += '<div style="font-weight:700;font-size:0.88em">' + (s.label || 'Take ' + (idx + 1)) + (isCrowned ? ' 👑' : '') + '</div>';
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:2px">🗓️ ' + dateLabel + (who ? ' · by ' + who : '') + '</div>';
            if (s.notes) html += '<div style="font-size:0.75em;color:var(--text-muted);margin-top:4px;font-style:italic">' + s.notes + '</div>';
            html += '</div>';
            html += '<div style="display:flex;gap:4px;flex-shrink:0">';
            if (!isCrowned) html += '<button onclick="crownBestShot(\'' + songTitle.replace(/'/g, "\\'") + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:2px" title="Crown as best">👑</button>';
            html += '<button onclick="editBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:2px" title="Edit">✏️</button>';
            html += '<button onclick="deleteBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\',' + idx + ')" style="background:none;border:none;cursor:pointer;font-size:0.85em;padding:2px;color:#ef4444" title="Delete">🗑️</button>';
            html += '</div></div>';
            if (s.audioUrl) html += bestShotAudioHtml(s.audioUrl, 'width:100%;height:32px;margin-top:6px');
            else if (s.externalUrl) html += '<a href="' + s.externalUrl + '" target="_blank" style="display:inline-block;margin-top:4px;font-size:0.75em;color:var(--accent-light)">🔗 External Link</a>';
            html += '</div>';
        });
        html += '</div>';
    }

    // ── Add Take + Chop Rehearsal buttons ──
    html += '<div style="display:flex;gap:8px;margin-top:4px">';
    html += '<button onclick="addBestShotTake(\'' + songTitle.replace(/'/g, "\\'") + '\')" class="btn btn-primary" style="flex:1">📤 Upload Take</button>';
    html += '<button onclick="openRehearsalChopper()" class="btn btn-ghost" style="flex-shrink:0">✂️ Chop</button>';
    html += '<button onclick="sendToPracticePlan(\'' + songTitle.replace(/'/g, "\\'") + '\')" class="btn btn-ghost" style="flex-shrink:0" title="Add to This Week\'s Focus">🎯 Practice</button>';
    html += '</div>';

    container.innerHTML = html;
}

// ── Rate a section ──────────────────────────────────────────────────────────
function emailKey(email) { return (email || '').replace(/[.#$\[\]\/]/g, '_'); }
function emailFromKey(key) {
    // Reverse lookup from sanitized key to real email
    var found = Object.keys(bandMembers).find(function(e) { return emailKey(e) === key; });
    return found || key;
}

async function rateBestShotSection(songTitle, section, rating) {
    var ratings = await loadBandDataFromDrive(songTitle, 'best_shot_ratings') || {};
    if (!ratings[section]) ratings[section] = {};
    var ek = emailKey(currentUserEmail);
    // Toggle off if clicking same rating
    if (ratings[section][ek] === rating) {
        delete ratings[section][ek];
    } else {
        ratings[section][ek] = rating;
    }
    await saveBandDataToDrive(songTitle, 'best_shot_ratings', ratings);
    // Inline update: refresh only this section's row instead of full re-render
    updateSectionRatingInline(songTitle, section, ratings);
}

function updateSectionRatingInline(songTitle, section, allRatings) {
    var sectionRatings = allRatings[section] || {};
    var counts = {green: 0, yellow: 0, red: 0};
    var myRating = sectionRatings[emailKey(currentUserEmail)] || '';
    Object.values(sectionRatings).forEach(function(r) { if (counts[r] !== undefined) counts[r]++; });
    var total = counts.green + counts.yellow + counts.red;
    var pctGreen = total ? Math.round(counts.green / total * 100) : 0;
    var pctYellow = total ? Math.round(counts.yellow / total * 100) : 0;
    var barColor = !total ? 'rgba(255,255,255,0.06)' : 'linear-gradient(90deg, #10b981 ' + pctGreen + '%, #f59e0b ' + pctGreen + '% ' + (pctGreen + pctYellow) + '%, #ef4444 ' + (pctGreen + pctYellow) + '%)';

    // Find the section row
    var rows = document.querySelectorAll('#bestShotVsNorthStar [data-section]');
    var targetRow = null;
    rows.forEach(function(r) { if (r.getAttribute('data-section') === section) targetRow = r; });
    // Bail gracefully if row not found — do NOT full re-render (would kill any playing audio)
    if (!targetRow) return;

    // Update the progress bar
    var bar = targetRow.querySelector('[data-bar="' + section + '"]');
    if (bar) {
        bar.style.background = barColor;
        var inner = bar.querySelector('div');
        if (inner && total) {
            inner.innerHTML = counts.green + '\u{1F7E2} ' + counts.yellow + '\u{1F7E1} ' + counts.red + '\u{1F534}';
        } else if (!total && inner) {
            inner.remove();
        } else if (total && !inner) {
            var newInner = document.createElement('div');
            newInner.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:0.65em;color:white;font-weight:700;text-shadow:0 1px 2px rgba(0,0,0,0.5)';
            newInner.innerHTML = counts.green + '\u{1F7E2} ' + counts.yellow + '\u{1F7E1} ' + counts.red + '\u{1F534}';
            bar.style.position = 'relative';
            bar.style.overflow = 'hidden';
            bar.appendChild(newInner);
        }
    }

    // Update my vote buttons
    var votesContainer = targetRow.querySelector('[data-votes="' + section + '"]');
    var buttons = votesContainer ? votesContainer.querySelectorAll('button') : [];
    buttons.forEach(function(btn) {
        var onclick = btn.getAttribute('onclick') || '';
        var color = '';
        if (onclick.includes("'green'")) color = 'green';
        else if (onclick.includes("'yellow'")) color = 'yellow';
        else if (onclick.includes("'red'")) color = 'red';
        var isActive = myRating === color;
        var borderMap = {green: '#10b981', yellow: '#f59e0b', red: '#ef4444'};
        var bgMap = {green: 'rgba(16,185,129,0.2)', yellow: 'rgba(245,158,11,0.2)', red: 'rgba(239,68,68,0.2)'};
        btn.style.border = isActive ? '2px solid ' + borderMap[color] : '1px solid rgba(255,255,255,0.1)';
        btn.style.background = isActive ? bgMap[color] : 'rgba(255,255,255,0.04)';
    });
}

// ── Section notes (per member, per section) ─────────────────────────────────
async function toggleSectionNotes(songTitle, section) {
    var id = 'secNotes_' + section.replace(/\s/g, '_');
    var existing = document.getElementById(id);
    if (existing) { existing.remove(); return; }

    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    // Sort by timestamp
    thread.sort(function(a, b) { return (a.ts || '').localeCompare(b.ts || ''); });
    var ek = emailKey(currentUserEmail);

    var rows = document.querySelectorAll('#bestShotVsNorthStar [data-section]');
    var targetRow = null;
    rows.forEach(function(r) { if (r.getAttribute('data-section') === section) targetRow = r; });
    if (!targetRow) return;

    var panel = document.createElement('div');
    panel.id = id;
    panel.style.cssText = 'background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:10px;margin:4px 0 8px 68px;font-size:0.82em';

    var threadHtml = '';
    if (!thread.length) {
        threadHtml = '<div style="color:var(--text-dim);margin-bottom:8px;font-style:italic">No notes yet — start the conversation</div>';
    } else {
        thread.forEach(function(note, idx) {
            var name = bandMembers[emailFromKey(note.by)]?.name || note.by || '?';
            var time = note.ts ? new Date(note.ts).toLocaleString('en-US', {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : '';
            var isNew = note.ts && (Date.now() - new Date(note.ts).getTime()) < 24 * 60 * 60 * 1000;
            var isMine = note.by === ek;
            threadHtml += '<div style="margin-bottom:8px;padding:6px 8px;border-radius:6px;background:' + (isMine ? 'rgba(102,126,234,0.06)' : 'rgba(255,255,255,0.02)') + ';border-left:2px solid ' + (isMine ? 'var(--accent-light)' : 'rgba(255,255,255,0.1)') + '">';
            threadHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">';
            threadHtml += '<span style="font-weight:600;font-size:0.85em;color:' + (isMine ? 'var(--accent-light)' : 'var(--text)') + '">' + name + (isNew ? ' 🆕' : '') + '</span>';
            threadHtml += '<span style="font-size:0.7em;color:var(--text-dim)">' + time;
            if (isMine) {
                threadHtml += ' <button onclick="editSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\',' + idx + ')" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-size:1em;padding:0 2px" title="Edit">✏️</button>';
                threadHtml += '<button onclick="deleteSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\',' + idx + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1em;padding:0 2px" title="Delete">🗑️</button>';
            }
            threadHtml += '</span></div>';
            threadHtml += '<div style="color:var(--text-muted);font-size:0.92em" id="secNoteText_' + section + '_' + idx + '">' + (note.text || '') + '</div>';
            threadHtml += '</div>';
        });
    }

    panel.innerHTML = threadHtml +
        '<div style="display:flex;gap:6px;margin-top:6px">' +
        '<input class="app-input" id="secNoteInput_' + section + '" placeholder="Add a note for ' + section + '..." style="flex:1;font-size:0.9em;padding:6px 10px">' +
        '<button class="btn btn-sm btn-primary" onclick="addSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\')" style="font-size:0.78em;padding:4px 10px">💬</button>' +
        '</div>';

    targetRow.parentNode.insertBefore(panel, targetRow.nextSibling);
    document.getElementById('secNoteInput_' + section)?.focus();
}

async function addSectionNote(songTitle, section) {
    var input = document.getElementById('secNoteInput_' + section);
    if (!input || !input.value.trim()) return;
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    if (!Array.isArray(allNotes[section])) {
        // Migrate old format (object with email keys) to array
        var oldObj = allNotes[section] || {};
        var migrated = [];
        Object.keys(oldObj).forEach(function(k) {
            if (typeof oldObj[k] === 'string') migrated.push({by: k, text: oldObj[k], ts: new Date().toISOString()});
        });
        allNotes[section] = migrated;
    }
    allNotes[section].push({
        by: emailKey(currentUserEmail),
        text: input.value.trim(),
        ts: new Date().toISOString()
    });
    await saveBandDataToDrive(songTitle, 'best_shot_section_notes', allNotes);
    showToast('💬 Note added');
    // Re-open the thread to show new note
    var panelId = 'secNotes_' + section.replace(/\s/g, '_');
    var el = document.getElementById(panelId);
    if (el) el.remove();
    toggleSectionNotes(songTitle, section);
}

async function editSectionNote(songTitle, section, idx) {
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    if (!thread[idx]) return;
    var textEl = document.getElementById('secNoteText_' + section + '_' + idx);
    if (!textEl) return;
    var current = thread[idx].text || '';
    textEl.innerHTML = '<div style="display:flex;gap:4px"><input class="app-input" id="secNoteEdit_' + section + '_' + idx + '" value="' + current.replace(/"/g, '&quot;') + '" style="flex:1;font-size:0.9em;padding:4px 8px"><button class="btn btn-sm btn-primary" onclick="saveEditedSectionNote(\'' + songTitle.replace(/'/g, "\\'") + '\',\'' + section + '\',' + idx + ')" style="font-size:0.75em;padding:2px 8px">💾</button></div>';
    document.getElementById('secNoteEdit_' + section + '_' + idx)?.focus();
}

async function saveEditedSectionNote(songTitle, section, idx) {
    var input = document.getElementById('secNoteEdit_' + section + '_' + idx);
    if (!input) return;
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    if (!thread[idx]) return;
    thread[idx].text = input.value.trim();
    thread[idx].editedAt = new Date().toISOString();
    allNotes[section] = thread;
    await saveBandDataToDrive(songTitle, 'best_shot_section_notes', allNotes);
    showToast('✏️ Note updated');
    var panelId = 'secNotes_' + section.replace(/\s/g, '_');
    var el = document.getElementById(panelId);
    if (el) el.remove();
    toggleSectionNotes(songTitle, section);
}

async function deleteSectionNote(songTitle, section, idx) {
    if (!confirm('Delete this note?')) return;
    var allNotes = await loadBandDataFromDrive(songTitle, 'best_shot_section_notes') || {};
    var thread = toArray(allNotes[section] || []);
    thread.splice(idx, 1);
    allNotes[section] = thread;
    await saveBandDataToDrive(songTitle, 'best_shot_section_notes', allNotes);
    showToast('🗑️ Note deleted');
    var panelId = 'secNotes_' + section.replace(/\s/g, '_');
    var el = document.getElementById(panelId);
    if (el) el.remove();
    toggleSectionNotes(songTitle, section);
}

// ── Crown a take ────────────────────────────────────────────────────────────
async function crownBestShot(songTitle, index) {
    var shots = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    shots.forEach(function(s, i) { s.crowned = (i === index); });
    await saveBandDataToDrive(songTitle, 'best_shot_takes', shots);
    showToast('👑 Crowned as Best Shot!');
    renderBestShotVsNorthStar(songTitle);
}

// ── Edit a take ─────────────────────────────────────────────────────────────
async function editBestShotTake(songTitle, index) {
    var shots = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    var take = shots[index];
    if (!take) return;
    var memberOpts = Object.entries(bandMembers).map(function(e) { return '<option value="' + e[0] + '"' + (e[0] === take.uploadedBy ? ' selected' : '') + '>' + e[1].name + '</option>'; }).join('');
    var container = document.getElementById('bestShotVsNorthStar');
    if (!container) return;
    var form = document.createElement('div');
    form.id = 'editTakeForm';
    form.style.cssText = 'background:rgba(102,126,234,0.05);border:1px solid rgba(102,126,234,0.2);border-radius:12px;padding:16px;margin-bottom:12px';
    form.innerHTML = '<div style="font-weight:700;font-size:0.9em;margin-bottom:10px">✏️ Edit Take #' + (index + 1) + '</div>' +
        '<div class="form-grid">' +
        '<div class="form-row"><label class="form-label">Label</label><input class="app-input" id="editTakeLabel" value="' + (take.label || '').replace(/"/g, '&quot;') + '"></div>' +
        '<div class="form-row"><label class="form-label">Recorded By</label><select class="app-select" id="editTakeBy">' + memberOpts + '</select></div>' +
        '<div class="form-row"><label class="form-label">Recording Date</label><input type="date" class="app-input" id="editTakeDate" value="' + (take.recordedDate || (take.uploadedAt ? take.uploadedAt.slice(0,10) : '')) + '"></div>' +
        '<div class="form-row"><label class="form-label">Audio URL</label><input class="app-input" id="editTakeUrl" value="' + (take.audioUrl || '').replace(/"/g, '&quot;') + '"></div>' +
        '<div class="form-row"><label class="form-label">External Link</label><input class="app-input" id="editTakeExtUrl" value="' + (take.externalUrl || '').replace(/"/g, '&quot;') + '"></div>' +
        '</div>' +
        '<div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="editTakeNotes">' + (take.notes || '') + '</textarea></div>' +
        '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" id="editTakeSaveBtn">💾 Save</button><button class="btn btn-ghost" id="editTakeCancelBtn">Cancel</button></div>';
    container.insertBefore(form, container.firstChild);
    document.getElementById('editTakeSaveBtn').addEventListener('click', async function() {
        shots[index].label = document.getElementById('editTakeLabel')?.value?.trim() || '';
        shots[index].uploadedBy = document.getElementById('editTakeBy')?.value || take.uploadedBy;
        shots[index].uploadedByName = bandMembers[document.getElementById('editTakeBy')?.value]?.name || '';
        shots[index].recordedDate = document.getElementById('editTakeDate')?.value || '';
        shots[index].audioUrl = document.getElementById('editTakeUrl')?.value?.trim() || '';
        shots[index].externalUrl = document.getElementById('editTakeExtUrl')?.value?.trim() || '';
        shots[index].notes = document.getElementById('editTakeNotes')?.value?.trim() || '';
        await saveBandDataToDrive(songTitle, 'best_shot_takes', shots);
        showToast('✏️ Take updated');
        renderBestShotVsNorthStar(songTitle);
    });
    document.getElementById('editTakeCancelBtn').addEventListener('click', function() { form.remove(); });
}

// ── Delete a take ───────────────────────────────────────────────────────────
async function deleteBestShotTake(songTitle, index) {
    if (!confirm('Delete this take?')) return;
    var shots = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    shots.splice(index, 1);
    await saveBandDataToDrive(songTitle, 'best_shot_takes', shots);
    showToast('🗑️ Take deleted');
    renderBestShotVsNorthStar(songTitle);
}

// ── Add Take form ───────────────────────────────────────────────────────────
function addBestShotTake(songTitle) {
    var container = document.getElementById('bestShotVsNorthStar');
    if (!container) return;
    var memberOpts = Object.entries(bandMembers).map(function(e) { return '<option value="' + e[0] + '"' + (e[0] === currentUserEmail ? ' selected' : '') + '>' + e[1].name + '</option>'; }).join('');
    var form = document.createElement('div');
    form.style.cssText = 'background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:16px;margin-bottom:12px';
    var h = '<div style="font-weight:700;font-size:0.9em;margin-bottom:10px">📤 Upload Take for ' + songTitle + '</div>';
    h += '<div class="form-grid">';
    h += '<div class="form-row"><label class="form-label">Label</label><input class="app-input" id="bstLabel" placeholder="e.g. 3/1 rehearsal take 2"></div>';
    h += '<div class="form-row"><label class="form-label">Recorded By</label><select class="app-select" id="bstBy">' + memberOpts + '</select></div>';
    h += '<div class="form-row"><label class="form-label">Recording Date</label><input type="date" class="app-input" id="bstRecDate" value="' + new Date().toISOString().slice(0,10) + '"></div>';
    h += '</div>';
    h += '<div class="form-row"><label class="form-label">Audio</label>';
    h += '<div id="bstDropZone" style="border:2px dashed rgba(245,158,11,0.3);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:8px">';
    h += '<div style="font-size:1.5em;margin-bottom:4px">🎵</div>';
    h += '<div style="font-size:0.82em;color:var(--text-muted)">Drag & drop MP3 here</div>';
    h += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px">or paste a link below</div>';
    h += '</div>';
    h += '<input class="app-input" id="bstUrl" placeholder="Google Drive / Dropbox / direct MP3 link" style="margin-bottom:6px">';
    h += '<input type="file" id="bstFileInput" accept=".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/*" style="display:none">';
    h += '<button class="btn btn-ghost btn-sm" style="font-size:0.78em;margin-bottom:8px" id="bstBrowseBtn">📁 Browse files</button>';
    h += '</div>';
    h += '<div class="form-row"><label class="form-label">External Link (opt)</label><input class="app-input" id="bstExtUrl" placeholder="YouTube, SoundCloud, etc."></div>';
    h += '<div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="bstNotes" placeholder="How did it go?"></textarea></div>';
    h += '<div id="bstUploadStatus" style="display:none;font-size:0.78em;color:#f59e0b;margin:4px 0"></div>';
    h += '<div style="font-size:0.75em;color:var(--text-dim);margin:4px 0">💡 Drag MP3 here, browse files, or paste a Google Drive/Dropbox link</div>';
    h += '<div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-success" id="bstSaveBtn">💾 Save Take</button><button class="btn btn-ghost" id="bstCancelBtn">Cancel</button></div>';
    form.innerHTML = h;
    container.insertBefore(form, container.firstChild);
    var dropZone = document.getElementById('bstDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#f59e0b'; dropZone.style.background = 'rgba(245,158,11,0.08)'; });
        dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; });
        dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; var f = e.dataTransfer?.files?.[0]; if (f) handleBestShotFile(f, songTitle); });
        dropZone.addEventListener('click', function() { document.getElementById('bstFileInput')?.click(); });
    }
    var fileInput = document.getElementById('bstFileInput');
    if (fileInput) fileInput.addEventListener('change', function() { if (this.files[0]) handleBestShotFile(this.files[0], songTitle); });
    document.getElementById('bstBrowseBtn')?.addEventListener('click', function() { document.getElementById('bstFileInput')?.click(); });
    document.getElementById('bstSaveBtn')?.addEventListener('click', function() { saveBestShotTake(songTitle); });
    document.getElementById('bstCancelBtn')?.addEventListener('click', function() { renderBestShotVsNorthStar(songTitle); });
}

// ── File upload to Firebase as base64 ───────────────────────────────────────
async function handleBestShotFile(file, songTitle) {
    if (!file) return;
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|flac)$/i)) {
        showToast('Please drop an audio file (MP3, WAV, etc.)'); return;
    }
    if (file.size > 15 * 1024 * 1024) {
        showToast('File too large (max 15MB). Try a link instead.'); return;
    }
    var zone = document.getElementById('bstDropZone');
    var status = document.getElementById('bstUploadStatus');
    if (zone) zone.innerHTML = '<div style="font-size:0.82em;color:#f59e0b">⏳ Reading ' + file.name + '...</div>';
    if (status) { status.style.display = 'block'; status.textContent = '⏳ Uploading...'; }
    try {
        var base64 = await blobToBase64(file);
        var audioKey = 'audio_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        await saveBandDataToDrive(songTitle, 'best_shot_audio_' + audioKey, {
            data: base64, name: file.name, type: file.type, size: file.size, uploadedAt: new Date().toISOString()
        });
        var urlInput = document.getElementById('bstUrl');
        if (urlInput) urlInput.value = 'firebase-audio://' + songTitle + '/best_shot_audio_' + audioKey;
        if (zone) zone.innerHTML = '<div style="font-size:0.82em;color:#10b981">✅ ' + file.name + ' uploaded!</div>';
        if (status) { status.style.display = 'block'; status.textContent = '✅ Audio uploaded!'; status.style.color = '#10b981'; }
    } catch (err) {
        console.error('Audio upload error:', err);
        if (zone) zone.innerHTML = '<div style="font-size:0.82em;color:#ef4444">❌ Upload failed</div>';
        if (status) { status.style.display = 'block'; status.textContent = '❌ ' + err.message; status.style.color = '#ef4444'; }
    }
}

// ── Audio URL normalization ─────────────────────────────────────────────────
function normalizeAudioUrl(url) {
    if (!url) return '';
    if (url.startsWith('firebase-audio://')) return url;
    // Google Drive: extract file ID
    var driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (driveMatch) return 'gdrive:' + driveMatch[1];
    var driveMatch2 = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
    if (driveMatch2) return 'gdrive:' + driveMatch2[1];
    var driveMatch3 = url.match(/id=([a-zA-Z0-9_-]{20,})/);
    if (driveMatch3 && url.includes('drive.google.com')) return 'gdrive:' + driveMatch3[1];
    if (url.includes('dropbox.com')) return url.replace('dl=0', 'dl=1');
    return url;
}

// ── Audio player HTML builder ───────────────────────────────────────────────
function bestShotAudioHtml(audioUrl, style) {
    if (!audioUrl) return '';
    style = style || 'width:100%;height:32px;margin-top:4px';
    if (audioUrl.startsWith('firebase-audio://')) {
        var parts = audioUrl.replace('firebase-audio://', '').split('/');
        var sTitle = decodeURIComponent(parts[0]);
        var aKey = parts.slice(1).join('/');
        var playerId = 'bsPlayer_' + aKey.replace(/[^a-zA-Z0-9]/g, '_');
        return '<div id="' + playerId + '" style="' + style + '"><button class="btn btn-sm btn-ghost" onclick="loadFirebaseAudio(\'' + sTitle.replace(/'/g, "\\'") + '\',\'' + aKey + '\',\'' + playerId + '\')" style="font-size:0.78em">▶ Load Audio</button></div>';
    }
    var normalized = normalizeAudioUrl(audioUrl);
    // Google Drive: lazy-load with user's auth token, fallback to open in Drive
    if (normalized.startsWith('gdrive:')) {
        var fileId = normalized.replace('gdrive:', '');
        var gdriveLink = 'https://drive.google.com/file/d/' + fileId + '/view';
        var pid = 'bsGd_' + fileId.slice(0, 8);
        return '<div id="' + pid + '" style="' + style + '">' +
            '<button class="btn btn-sm btn-ghost" onclick="loadGdriveAudio(\'' + fileId + '\',\'' + pid + '\')" style="font-size:0.78em">▶ Load from Google Drive</button>' +
            ' <a href="' + gdriveLink + '" target="_blank" style="font-size:0.65em;color:var(--accent-light)">open in Drive</a></div>';
    }
    return '<audio controls preload="none" style="' + style + '"><source src="' + normalized + '"></audio>';
}

// ── Firebase audio lazy loader ──────────────────────────────────────────────
async function loadFirebaseAudio(songTitle, audioKey, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<span style="font-size:0.78em;color:#f59e0b">⏳ Loading...</span>';
    try {
        var data = await loadBandDataFromDrive(songTitle, audioKey);
        if (data && data.data) {
            el.innerHTML = '<audio controls autoplay style="width:100%;height:32px"><source src="' + data.data + '" type="' + (data.type || 'audio/mpeg') + '"></audio>';
        } else {
            el.innerHTML = '<span style="font-size:0.78em;color:#ef4444">Audio not found</span>';
        }
    } catch (err) {
        el.innerHTML = '<span style="font-size:0.78em;color:#ef4444">Failed to load</span>';
    }
}

async function loadGdriveAudio(fileId, containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '<span style="font-size:0.78em;color:#f59e0b">\u23f3 Loading from Drive...</span>';
    var driveLink = 'https://drive.google.com/file/d/' + fileId + '/view';
    try {
        var res = null;
        // Try 1: User's access token (has drive.readonly scope after consent)
        if (accessToken) {
            console.log('[GDrive Audio] Trying with access token...');
            res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media', {
                headers: { 'Authorization': 'Bearer ' + accessToken }
            });
            if (res.ok) console.log('[GDrive Audio] Token fetch succeeded');
            else console.log('[GDrive Audio] Token fetch failed:', res.status);
        }
        // Try 2: API key fallback (for publicly shared files)
        if (!res || !res.ok) {
            console.log('[GDrive Audio] Trying with API key...');
            res = await fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media&key=' + GOOGLE_DRIVE_CONFIG.apiKey);
        }
        if (!res.ok) throw new Error('HTTP ' + res.status + (accessToken ? '' : ' (not signed in)'));
        var blob = await res.blob();
        console.log('[GDrive Audio] Got blob:', blob.size, 'bytes, type:', blob.type);
        var objectUrl = URL.createObjectURL(blob);
        el.innerHTML = '<audio controls autoplay style="width:100%;height:32px"><source src="' + objectUrl + '" type="' + (blob.type || 'audio/mpeg') + '"></audio>';
    } catch (err) {
        console.error('[GDrive Audio]', err);
        el.innerHTML = '<a href="' + driveLink + '" target="_blank" class="btn btn-sm btn-ghost" style="font-size:0.82em">\u25b6 Open in Google Drive</a>' +
            '<div style="font-size:0.62em;color:var(--text-dim);margin-top:2px">' + err.message + '</div>';
    }
}

async function saveBestShotTake(songTitle) {
    var url = document.getElementById('bstUrl')?.value?.trim() || '';
    var extUrl = document.getElementById('bstExtUrl')?.value?.trim() || '';
    if (!url && !extUrl) { showToast('Provide an audio file or link'); return; }
    var take = {
        label: document.getElementById('bstLabel')?.value?.trim() || '',
        uploadedBy: document.getElementById('bstBy')?.value || currentUserEmail,
        uploadedByName: bandMembers[document.getElementById('bstBy')?.value]?.name || '',
        audioUrl: url,
        externalUrl: extUrl,
        recordedDate: document.getElementById('bstRecDate')?.value || '',
        notes: document.getElementById('bstNotes')?.value?.trim() || '',
        uploadedAt: new Date().toISOString(),
        crowned: false
    };
    var existing = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
    // Auto-crown if first take
    if (!existing.length) take.crowned = true;
    existing.push(take);
    await saveBandDataToDrive(songTitle, 'best_shot_takes', existing);
    showToast('🏆 Take saved!');
    renderBestShotVsNorthStar(songTitle);
}

// ── Send to Practice Plan ────────────────────────────────────────────────────
async function sendToPracticePlan(songTitle) {
    var song = allSongs.find(function(s) { return s.title === songTitle; });
    if (!song) { showToast('Song not found'); return; }
    var currentStatus = song.status || '';
    if (currentStatus === 'This Week') {
        showToast('Already in This Week\'s Focus!');
        return;
    }
    var oldStatus = currentStatus;
    song.status = 'This Week';
    await saveBandDataToDrive(songTitle, 'song_status', { status: 'This Week' });
    showToast('🎯 Added to This Week\'s Focus!' + (oldStatus ? ' (was: ' + oldStatus + ')' : ''));
}

// ── Custom Section Editor ────────────────────────────────────────────────────
async function editScorecardSections(songTitle) {
    var structure = await loadBandDataFromDrive(songTitle, 'song_structure') || {};
    var defaultSections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Jam', 'Outro'];
    var current = (structure.sections && structure.sections.length) ? toArray(structure.sections) : defaultSections;

    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10002;display:flex;align-items:center;justify-content:center;padding:20px';
    var inner = document.createElement('div');
    inner.style.cssText = 'background:var(--bg-card,#1e293b);border-radius:16px;padding:20px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto';

    var h = '<div style="font-weight:700;font-size:1em;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">';
    h += '<span>\u270f\ufe0f Edit Sections</span>';
    h += '<button id="secEdClose" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:1.2em">\u2715</button></div>';
    h += '<div style="font-size:0.78em;color:var(--text-dim);margin-bottom:10px">One section per line. These become the rows in your Section Scorecard.</div>';
    h += '<textarea id="secEdText" style="width:100%;box-sizing:border-box;min-height:180px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:var(--text);font-size:0.9em;padding:10px;line-height:1.6;resize:vertical">' + current.join('\n') + '</textarea>';
    h += '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">';
    h += '<button id="secEdPresets" class="btn btn-ghost btn-sm" style="font-size:0.75em">Reset to defaults</button>';
    h += '<div style="flex:1"></div>';
    h += '<button id="secEdCancel" class="btn btn-ghost btn-sm">Cancel</button>';
    h += '<button id="secEdSave" class="btn btn-primary btn-sm">Save</button>';
    h += '</div>';
    inner.innerHTML = h;
    modal.appendChild(inner);
    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
    document.getElementById('secEdClose').addEventListener('click', function() { modal.remove(); });
    document.getElementById('secEdCancel').addEventListener('click', function() { modal.remove(); });
    document.getElementById('secEdPresets').addEventListener('click', function() {
        document.getElementById('secEdText').value = defaultSections.join('\n');
    });
    document.getElementById('secEdSave').addEventListener('click', async function() {
        var lines = document.getElementById('secEdText').value.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
        if (!lines.length) { showToast('Add at least one section'); return; }
        structure.sections = lines;
        await saveBandDataToDrive(songTitle, 'song_structure', structure);
        modal.remove();
        showToast('Sections updated!');
        renderBestShotVsNorthStar(songTitle);
    });
}

// ============================================================================
// ============================================================================
// REHEARSAL CHOPPER — Split a long rehearsal MP3 into individual song takes
// ============================================================================
function openRehearsalChopper() {
    if (document.getElementById('rehearsalChopperModal')) return;
    var modal = document.createElement('div');
    modal.id = 'rehearsalChopperModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10002;display:flex;flex-direction:column;overflow-y:auto';
    modal.innerHTML = '<div style="max-width:960px;width:100%;margin:0 auto;padding:16px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
        '<h2 style="margin:0;color:white">✂️ Rehearsal Chopper</h2>' +
        '<button id="chopCloseBtn" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:1.5em">✕</button>' +
        '</div>' +
        '<p style="color:var(--text-dim);font-size:0.85em;margin-bottom:8px">Load a rehearsal MP3, detect pauses, adjust boundaries, name songs, save as individual takes.</p>' +
        '<details style="margin-bottom:12px;font-size:0.78em;color:var(--text-dim)"><summary style="cursor:pointer;color:var(--text-muted);font-weight:600">How it works</summary>' +
        '<div style="padding:6px 0 2px 0;line-height:1.5">' +
        '<b>1.</b> Drop an MP3 (or click to browse). ' +
        '<b>2.</b> Hit Detect Pauses \u2014 adjusts silence threshold and min gap to taste. ' +
        '<b>3.</b> Drag orange markers to fine-tune. Click waveform to seek; Space to play/pause; \u2190\u2192 skip 5s. ' +
        '<b>4.</b> Click a timestamp to set boundary on waveform, or double-click to type an exact time. ' +
        '<b>5.</b> Name each segment from the song dropdown, exclude non-music sections with \ud83d\udeab. ' +
        '<b>6.</b> Save All downloads WAV files and logs takes to Best Shot.' +
        '</div></details>' +
        '<div id="chopDropZone" style="border:2px dashed rgba(245,158,11,0.3);border-radius:12px;padding:30px;text-align:center;cursor:pointer;margin-bottom:12px;transition:all 0.2s">' +
        '<div style="font-size:1.8em;margin-bottom:6px">🎵</div>' +
        '<div style="color:var(--text-muted);font-size:0.9em">Drag & drop rehearsal MP3 here</div>' +
        '<div style="font-size:0.72em;color:var(--text-dim);margin-top:6px;cursor:pointer" onclick="event.stopPropagation();if(typeof glInlineHelp!==\'undefined\')glInlineHelp.showPopover(this,\'Recording Setup\',\'📱 Phone is easiest — 8-10 ft from band, chest height.<br>🎙️ Portable recorder recommended for better quality.<br>🎛️ Board mix advanced but cleanest signal.<br>Real-time capture optional — upload after.\')">📋 Recording setup tips</div>' +
        '<div style="font-size:0.75em;color:var(--text-dim);margin-top:4px">or click to browse</div>' +
        '<input type="file" id="chopFileInput" accept=".mp3,.m4a,.wav,.aac,.ogg,.flac,audio/*" style="display:none">' +
        '</div>' +
        '<div id="chopperContent" style="display:none">' +
        '<div style="margin-bottom:8px">' +
        '<audio id="chopAudio" controls style="width:100%;height:36px;margin-bottom:6px"></audio>' +
        // Mini-map overview
        '<div style="position:relative;margin-bottom:4px">' +
        '<canvas id="chopMinimap" width="920" height="28" style="width:100%;height:28px;border-radius:4px;background:#0a0a14;border:1px solid rgba(255,255,255,0.05);cursor:pointer"></canvas>' +
        '<div id="chopMinimapViewport" style="position:absolute;top:0;height:100%;border:1px solid rgba(99,102,241,0.6);background:rgba(99,102,241,0.1);pointer-events:none;border-radius:3px"></div>' +
        '</div>' +
        // Main waveform
        '<div style="position:relative">' +
        '<canvas id="chopWaveform" width="920" height="130" style="width:100%;height:130px;border-radius:8px;cursor:crosshair;background:#0f0f1e;border:1px solid rgba(255,255,255,0.08)"></canvas>' +
        '<div id="chopPlayhead" style="position:absolute;top:0;left:0;width:2px;height:100%;background:#fff;pointer-events:none;opacity:0.8;display:none"></div>' +
        '<div id="chopHoverLine" style="position:absolute;top:0;left:0;width:1px;height:100%;background:rgba(255,255,255,0.4);pointer-events:none;display:none"></div>' +
        '<div id="chopHoverTime" style="position:absolute;top:2px;left:0;background:rgba(0,0,0,0.8);color:white;font-size:0.65em;padding:1px 4px;border-radius:3px;pointer-events:none;display:none"></div>' +
        '<div id="chopRegionHighlight" style="position:absolute;top:0;height:100%;background:rgba(99,102,241,0.15);border-left:2px solid #667eea;border-right:2px solid #667eea;pointer-events:none;display:none"></div>' +
        '</div>' +
        '<div style="display:flex;justify-content:space-between;margin-top:3px;font-size:0.7em;color:var(--text-dim)"><span id="chopTimeStart">0:00</span><span id="chopTimeEnd">0:00</span></div>' +
        '</div>' +
        // Controls bar
        '<div style="display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;align-items:center">' +
        '<button class="btn btn-primary btn-sm" id="chopDetectBtn">🔍 Detect Pauses</button>' +
        '<button class="btn btn-ghost btn-sm" id="chopAddMarkerBtn" title="Split at playhead">+ Split</button>' +
        '<button class="btn btn-ghost btn-sm" id="chopLoopBtn" title="Loop selected region">🔁 Loop</button>' +
        '<button class="btn btn-ghost btn-sm" id="chopZoomFitBtn" title="Zoom to fit full recording">Fit All</button>' +
        '<button class="btn btn-ghost btn-sm" id="chopClearBtn" style="color:#ef4444">🗑️ Clear</button>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:0.72em;color:var(--text-muted);margin-left:auto">Zoom: <input type="range" id="chopZoomSlider" min="1" max="20" step="0.5" value="1" style="width:70px"> <span id="chopZoomLevel">1x</span></label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:0.72em;color:var(--text-muted)">Silence: <input type="range" id="chopThreshold" min="0.002" max="0.08" step="0.002" value="0.015" style="width:60px"> <span id="chopThreshVal">0.015</span></label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:0.72em;color:var(--text-muted)">Gap: <input type="range" id="chopMinGap" min="0.5" max="8" step="0.5" value="3" style="width:50px"> <span id="chopMinGapVal">3</span>s</label>' +
        '</div>' +
        // Annotation toolbar
        '<div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;align-items:center">' +
        '<span style="font-size:0.68em;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;margin-right:4px">Annotate:</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="chopAddTimestampMarker(\'song-start\')" style="font-size:0.72em;padding:3px 8px" title="Mark song start at playhead">🎵 Song Start</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="chopAddTimestampMarker(\'restart\')" style="font-size:0.72em;padding:3px 8px" title="Mark restart at playhead">🔄 Restart</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="chopAddTimestampMarker(\'clean-run\')" style="font-size:0.72em;padding:3px 8px" title="Mark clean run start at playhead">✅ Clean Run</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="chopAddTimestampMarker(\'discussion\')" style="font-size:0.72em;padding:3px 8px" title="Mark discussion at playhead">💬 Discussion</button>' +
        '</div>' +
        // Timestamp marker list
        '<div id="chopTimestampList" style="margin-bottom:8px"></div>' +
        '<div id="chopSegments"></div>' +
        '</div></div>';
    document.body.appendChild(modal);

    // Wire up events
    var dropZone = document.getElementById('chopDropZone');
    var fileInput = document.getElementById('chopFileInput');
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.style.borderColor = '#f59e0b'; dropZone.style.background = 'rgba(245,158,11,0.08)'; });
    dropZone.addEventListener('dragleave', function() { dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; });
    dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.style.borderColor = 'rgba(245,158,11,0.3)'; dropZone.style.background = 'none'; if (e.dataTransfer?.files?.[0]) chopLoadFile(e.dataTransfer.files[0]); });
    fileInput.addEventListener('change', function() { if (this.files[0]) chopLoadFile(this.files[0]); });
    document.getElementById('chopCloseBtn').addEventListener('click', function() { chopStopPlayheadTracker(); modal.remove(); });
    document.getElementById('chopDetectBtn').addEventListener('click', function() { chopDetectSilence(); });
    document.getElementById('chopAddMarkerBtn').addEventListener('click', function() { chopAddMarker(); });
    // Keyboard shortcuts: Space=play/pause, Left/Right=skip 5s
    document.addEventListener('keydown', function chopKeyHandler(e) {
        if (!document.getElementById('rehearsalChopperModal')) { document.removeEventListener('keydown', chopKeyHandler); return; }
        var audio = document.getElementById('chopAudio');
        if (!audio || !chopAudioBuffer) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
        if (e.code === 'Space') { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
        if (e.code === 'ArrowLeft') { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); }
        if (e.code === 'ArrowRight') { e.preventDefault(); audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5); }
    });

    document.getElementById('chopClearBtn').addEventListener('click', function() { chopMarkers = []; chopExcluded = {}; chopDrawWaveform(); chopRenderSegments(); showToast('Cleared all markers'); });
    document.getElementById('chopThreshold').addEventListener('input', function() { document.getElementById('chopThreshVal').textContent = this.value; });
    document.getElementById('chopMinGap').addEventListener('input', function() { document.getElementById('chopMinGapVal').textContent = this.value; });
}

var chopAudioBuffer = null;
var chopAudioContext = null;
var chopMarkers = [];    // array of seconds where splits happen
var chopExcluded = {};   // index -> true for excluded segments
var chopSegmentMeta = {}; // index -> { kind, confidence, likelyIntent, likelySongTitle }
var chopFile = null;
var chopPlayheadRAF = null;
var chopDraggingMarker = -1; // index of marker being dragged (-1 = none)
var chopSelectedSegment = -1; // which segment is selected for boundary editing
var chopSettingBoundary = null; // 'start' or 'end'
var chopTimestampMarkers = []; // { sec, type, label } — user annotation markers (not segment boundaries)
var chopEnergyEnvelope = null; // { rms: Float32Array, windowSec: number, totalSec: number } — computed once on load

// ── Zoom / Navigation State ──
var chopZoom = { startSec: 0, endSec: 0 };   // visible window (0,0 = full view)
var chopRegion = null;     // { startSec, endSec } or null — selected region
var chopLooping = false;   // loop playback active
var chopLoopRAF = null;    // loop check animation frame
var chopScrubbing = false; // scrub mode active
var chopMinimapDragging = false; // minimap viewport drag

/**
 * Try to rehydrate Chopper state from a stored corrected timeline.
 * Returns true if successful, false if no matching timeline found.
 */
function _chopTryRehydrate(audioDuration) {
    if (typeof GLStore === 'undefined' || !GLStore.getLatestTimeline) return false;
    var tl = GLStore.getLatestTimeline();
    if (!tl || !tl.segments || !tl.segments.length) return false;

    // Duration match check: within 2 seconds tolerance (same recording)
    if (Math.abs(tl.durationSec - audioDuration) > 2) return false;

    _chopLoadFromTimeline(tl);
    _chopLoadTimestampMarkers();
    return true;
}

/**
 * Load Chopper state from a canonical timeline object.
 * Used by both rehydration and fresh AI segmentation.
 */
function _chopLoadFromTimeline(tl) {
    chopMarkers = [];
    chopExcluded = {};
    chopSegmentMeta = {};

    for (var i = 0; i < tl.segments.length; i++) {
        var seg = tl.segments[i];
        if (seg.startSec > 0.5) chopMarkers.push(seg.startSec);
        if (seg.kind === 'silence' || seg.kind === 'speech' || seg.kind === 'excluded') {
            chopExcluded[i] = true;
        }
        chopSegmentMeta[i] = {
            kind: seg.kind || 'unknown',
            confidence: seg.confidence || 0,
            likelyIntent: seg.likelyIntent || 'unknown',
            likelySongTitle: seg.likelySongTitle || null,
        };
    }
    chopMarkers.sort(function(a, b) { return a - b; });
}

async function chopLoadFile(file) {
    chopFile = file;
    chopMarkers = [];
    chopExcluded = {};
    chopSegmentMeta = {};
    var dropZone = document.getElementById('chopDropZone');
    if (dropZone) dropZone.innerHTML = '<div style="color:#10b981">✅ ' + file.name + ' (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)</div>';

    var audio = document.getElementById('chopAudio');
    audio.src = URL.createObjectURL(file);

    document.getElementById('chopperContent').style.display = 'block';
    var canvas = document.getElementById('chopWaveform');
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⏳ Analyzing waveform...', canvas.width / 2, canvas.height / 2);

    try {
        chopAudioContext = chopAudioContext || new (window.AudioContext || window.webkitAudioContext)();
        var arrayBuffer = await file.arrayBuffer();
        chopAudioBuffer = await chopAudioContext.decodeAudioData(arrayBuffer);
        document.getElementById('chopTimeEnd').textContent = formatChopTime(chopAudioBuffer.duration);
        chopZoom = { startSec: 0, endSec: chopAudioBuffer.duration };
        chopRegion = null;
        chopLooping = false;
        chopComputeEnergyEnvelope();
        chopDrawWaveform();
        chopDrawMinimap();
        chopWireCanvasEvents();
        chopStartPlayheadTracker();

        // M8 Phase 2.5: Try rehydrating from stored corrected timeline first
        var rehydrated = _chopTryRehydrate(chopAudioBuffer.duration);
        if (rehydrated) {
            chopDrawWaveform();
            chopRenderSegments();
            chopRenderTimestampMarkerList();
            chopComputeRestartHotspots();
            showToast('Restored ' + chopMarkers.length + ' saved segment boundaries');
        }
        // If no stored timeline, run fresh AI segmentation
        else if (typeof GLStore !== 'undefined' && GLStore.segmentRehearsalAudio) {
            var timeline = GLStore.segmentRehearsalAudio(chopAudioBuffer);
            if (timeline && timeline.segments && timeline.segments.length > 1) {
                _chopLoadFromTimeline(timeline);
                chopTimestampMarkers = []; // fresh segmentation = clear old markers
                chopComputeRestartHotspots();
                chopDrawWaveform();
                chopRenderSegments();
                chopRenderTimestampMarkerList();
                showToast('AI detected ' + timeline.summary.segmentCount + ' segments (' + timeline.summary.musicSegments + ' music, ' + timeline.summary.likelyRestarts + ' restarts)');
                // Show first-use help banner
                if (typeof glInlineHelp !== 'undefined') {
                    var helpBanner = document.createElement('div');
                    helpBanner.style.cssText = 'background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:0.78em;color:var(--text-muted,#94a3b8)';
                    var es = glInlineHelp.getEmptyState('first-segments');
                    if (es) helpBanner.innerHTML = '<span style="font-size:1.2em">' + es.icon + '</span><div style="flex:1"><strong style="color:#818cf8">' + es.title + '</strong><br>' + es.text + '</div><button onclick="this.parentElement.remove()" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:1em;flex-shrink:0">✕</button>';
                    var segEl = document.getElementById('chopSegments');
                    if (segEl && es) segEl.parentNode.insertBefore(helpBanner, segEl);
                    // Add next-step workflow banner
                    var nsBanner = glInlineHelp.renderNextStepBanner('after-segmentation', 'glHelp_afterSeg');
                    if (nsBanner && segEl) {
                        var nsDiv = document.createElement('div');
                        nsDiv.innerHTML = nsBanner;
                        segEl.parentNode.insertBefore(nsDiv.firstChild, segEl);
                    }
                }
            }
        }
    } catch (err) {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.fillText('Error: ' + err.message, canvas.width / 2, canvas.height / 2);
    }
}

function chopWireCanvasEvents() {
    var canvas = document.getElementById('chopWaveform');
    var audio = document.getElementById('chopAudio');
    var minimap = document.getElementById('chopMinimap');
    if (!canvas || !chopAudioBuffer) return;

    // Helper: pixel to seconds in zoom window
    function pxToSec(x, rect) {
        var zw = chopGetZoomWindow();
        return zw.start + (x / rect.width) * zw.dur;
    }
    function secToPx(sec, rect) {
        var zw = chopGetZoomWindow();
        return ((sec - zw.start) / zw.dur) * rect.width;
    }

    var regionStartX = -1; // for click-drag region selection

    // Hover: line + tooltip + marker drag
    canvas.addEventListener('mousemove', function(e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var sec = pxToSec(x, rect);

        // Near marker check
        var nearM = false;
        for (var mi = 0; mi < chopMarkers.length; mi++) {
            var mx = secToPx(chopMarkers[mi], rect);
            if (Math.abs(x - mx) < 8) { nearM = true; break; }
        }
        canvas.style.cursor = chopDraggingMarker >= 0 ? 'col-resize' : (nearM ? 'col-resize' : 'crosshair');

        var hoverLine = document.getElementById('chopHoverLine');
        var hoverTime = document.getElementById('chopHoverTime');
        if (hoverLine) { hoverLine.style.display = 'block'; hoverLine.style.left = x + 'px'; }
        if (hoverTime) { hoverTime.style.display = 'block'; hoverTime.style.left = (x + 6) + 'px'; hoverTime.textContent = formatChopTime(sec); }

        // Marker drag with snap
        if (chopDraggingMarker >= 0) {
            var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
            var origIdx = chopMarkers.indexOf(sorted[chopDraggingMarker]);
            if (origIdx >= 0) {
                var snapped = chopSnapToNearest(sec);
                chopMarkers[origIdx] = Math.max(0.1, Math.min(snapped, chopAudioBuffer.duration - 0.1));
            }
            chopDrawWaveform();
            chopRenderSegments();
        }

        // Region drag
        if (regionStartX >= 0) {
            var startSec = pxToSec(Math.min(regionStartX, x), rect);
            var endSec = pxToSec(Math.max(regionStartX, x), rect);
            chopRegion = { startSec: startSec, endSec: endSec };
            chopUpdateRegionHighlight();
        }
    });

    canvas.addEventListener('mouseleave', function() {
        var hl = document.getElementById('chopHoverLine');
        var ht = document.getElementById('chopHoverTime');
        if (hl) hl.style.display = 'none';
        if (ht) ht.style.display = 'none';
        if (chopDraggingMarker >= 0) { chopDraggingMarker = -1; chopMarkers.sort(function(a,b){return a-b}); chopRenderSegments(); }
    });

    // Click: seek or set boundary
    canvas.addEventListener('click', function(e) {
        if (chopDraggingMarker >= 0 || regionStartX >= 0) return;
        var rect = canvas.getBoundingClientRect();
        var sec = pxToSec(e.clientX - rect.left, rect);
        if (chopSelectedSegment >= 0 && chopSettingBoundary) { chopSetBoundary(sec); return; }
        audio.currentTime = sec;
        audio.play();
    });

    // Double-click: zoom to segment
    canvas.addEventListener('dblclick', function(e) {
        var rect = canvas.getBoundingClientRect();
        var sec = pxToSec(e.clientX - rect.left, rect);
        var dur = chopAudioBuffer.duration;
        var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
        var all = [0].concat(sorted).concat([dur]);
        for (var i = 0; i < all.length - 1; i++) {
            if (sec >= all[i] && sec < all[i + 1]) { chopZoomToSegment(i); break; }
        }
    });

    // Mousedown: marker drag or region selection start
    canvas.addEventListener('mousedown', function(e) {
        var rect = canvas.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        // Check marker drag
        var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
        for (var i = 0; i < sorted.length; i++) {
            var mx = secToPx(sorted[i], rect);
            if (Math.abs(clickX - mx) < 8) {
                chopDraggingMarker = i;
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                e.preventDefault();
                return;
            }
        }
        // Start region selection (shift+click or right side of canvas)
        if (e.shiftKey) {
            regionStartX = clickX;
            chopRegion = null;
            chopUpdateRegionHighlight();
            e.preventDefault();
        }
    });

    // Mouseup: end drag / region
    document.addEventListener('mouseup', function() {
        if (chopDraggingMarker >= 0) {
            chopDraggingMarker = -1;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            chopMarkers.sort(function(a,b){return a-b});
            chopDrawWaveform();
            chopRenderSegments();
        }
        if (regionStartX >= 0) {
            regionStartX = -1;
            // Keep chopRegion for loop/split use
        }
    });

    // Mousewheel: zoom centered on cursor
    canvas.addEventListener('wheel', function(e) {
        e.preventDefault();
        chopApplyMouseZoom(e, canvas);
    }, { passive: false });

    // ── Minimap events ──
    if (minimap) {
        minimap.addEventListener('mousedown', function(e) {
            // Try hotspot click first
            var rect = minimap.getBoundingClientRect();
            var clickSec = ((e.clientX - rect.left) / rect.width) * chopAudioBuffer.duration;
            if (_chopMinimapHotspotClick(clickSec)) return;
            chopMinimapDragging = true;
            _minimapSeek(e);
        });
        minimap.addEventListener('mousemove', function(e) {
            if (chopMinimapDragging) _minimapSeek(e);
        });
        document.addEventListener('mouseup', function() { chopMinimapDragging = false; });

        function _minimapSeek(e) {
            var rect = minimap.getBoundingClientRect();
            var pct = (e.clientX - rect.left) / rect.width;
            var centerSec = pct * chopAudioBuffer.duration;
            var zw = chopGetZoomWindow();
            var halfDur = zw.dur / 2;
            chopSetZoom(centerSec - halfDur, centerSec + halfDur);
        }
    }

    // ── Wire toolbar buttons ──
    var loopBtn = document.getElementById('chopLoopBtn');
    if (loopBtn) loopBtn.addEventListener('click', chopToggleLoop);
    var fitBtn = document.getElementById('chopZoomFitBtn');
    if (fitBtn) fitBtn.addEventListener('click', chopZoomToFit);
    var zoomSlider = document.getElementById('chopZoomSlider');
    if (zoomSlider) {
        zoomSlider.addEventListener('input', function() {
            var level = parseFloat(this.value);
            var zw = chopGetZoomWindow();
            var center = (zw.start + zw.end) / 2;
            var newDur = chopAudioBuffer.duration / level;
            chopSetZoom(center - newDur / 2, center + newDur / 2);
            var lbl = document.getElementById('chopZoomLevel');
            if (lbl) lbl.textContent = level.toFixed(1) + 'x';
        });
    }
}

function chopStartPlayheadTracker() {
    var audio = document.getElementById('chopAudio');
    var playhead = document.getElementById('chopPlayhead');
    var canvas = document.getElementById('chopWaveform');
    if (!audio || !playhead || !canvas || !chopAudioBuffer) return;

    function tick() {
        chopPlayheadRAF = requestAnimationFrame(tick);
        if (audio.paused) { playhead.style.display = 'none'; return; }
        var zw = chopGetZoomWindow();
        var t = audio.currentTime;
        if (t < zw.start || t > zw.end) { playhead.style.display = 'none'; return; }
        var pct = (t - zw.start) / zw.dur;
        var rect = canvas.getBoundingClientRect();
        playhead.style.display = 'block';
        playhead.style.left = (pct * rect.width) + 'px';
    }
    tick();
}

function chopStopPlayheadTracker() {
    if (chopPlayheadRAF) cancelAnimationFrame(chopPlayheadRAF);
    chopPlayheadRAF = null;
}

// ── Zoom Helpers ─────────────────────────────────────────────────────────────

function chopGetZoomWindow() {
    if (!chopAudioBuffer) return { start: 0, end: 0, dur: 0 };
    var totalDur = chopAudioBuffer.duration;
    var s = chopZoom.startSec;
    var e = chopZoom.endSec;
    if (e <= s || e <= 0) { s = 0; e = totalDur; }
    return { start: s, end: e, dur: e - s };
}

function chopSetZoom(startSec, endSec) {
    if (!chopAudioBuffer) return;
    var d = chopAudioBuffer.duration;
    chopZoom.startSec = Math.max(0, startSec);
    chopZoom.endSec = Math.min(d, endSec);
    if (chopZoom.endSec - chopZoom.startSec < 2) { chopZoom.startSec = 0; chopZoom.endSec = d; }
    chopDrawWaveform();
    chopDrawMinimap();
    // Update time labels
    var tsEl = document.getElementById('chopTimeStart');
    var teEl = document.getElementById('chopTimeEnd');
    if (tsEl) tsEl.textContent = formatChopTime(chopZoom.startSec);
    if (teEl) teEl.textContent = formatChopTime(chopZoom.endSec);
}

function chopZoomToFit() {
    chopZoom.startSec = 0;
    chopZoom.endSec = 0;
    chopSetZoom(0, chopAudioBuffer ? chopAudioBuffer.duration : 0);
    var slider = document.getElementById('chopZoomSlider');
    if (slider) { slider.value = '1'; var lbl = document.getElementById('chopZoomLevel'); if (lbl) lbl.textContent = '1x'; }
}

function chopZoomToSegment(segIdx) {
    if (!chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var all = [0].concat(sorted).concat([dur]);
    var s = all[segIdx] || 0;
    var e = all[segIdx + 1] || dur;
    var pad = (e - s) * 0.1;
    chopSetZoom(s - pad, e + pad);
}

function chopApplyMouseZoom(e, canvas) {
    if (!chopAudioBuffer) return;
    var rect = canvas.getBoundingClientRect();
    var xPct = (e.clientX - rect.left) / rect.width;
    var zw = chopGetZoomWindow();
    var centerSec = zw.start + xPct * zw.dur;
    var factor = e.deltaY < 0 ? 0.7 : 1.4; // scroll up = zoom in
    var newDur = Math.max(2, Math.min(chopAudioBuffer.duration, zw.dur * factor));
    var newStart = centerSec - xPct * newDur;
    chopSetZoom(newStart, newStart + newDur);
    // Update slider
    var zoomLevel = chopAudioBuffer.duration / newDur;
    var slider = document.getElementById('chopZoomSlider');
    if (slider) { slider.value = Math.min(20, zoomLevel).toFixed(1); var lbl = document.getElementById('chopZoomLevel'); if (lbl) lbl.textContent = zoomLevel.toFixed(1) + 'x'; }
}

// ── Minimap ──────────────────────────────────────────────────────────────────

function chopDrawMinimap() {
    var canvas = document.getElementById('chopMinimap');
    if (!canvas || !chopAudioBuffer) return;
    var ctx = canvas.getContext('2d');
    var data = chopAudioBuffer.getChannelData(0);
    var step = Math.ceil(data.length / canvas.width);
    var amp = canvas.height / 2;
    var dur = chopAudioBuffer.duration;

    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw minimap waveform with segment colors
    var allM = [0].concat(chopMarkers.slice().sort(function(a,b){return a-b})).concat([dur]);
    for (var px = 0; px < canvas.width; px++) {
        var sec = (px / canvas.width) * dur;
        var segIdx = 0;
        for (var m = 0; m < allM.length - 1; m++) { if (sec >= allM[m] && sec < allM[m + 1]) { segIdx = m; break; } }
        var min = 1, max = -1;
        for (var j = 0; j < step; j++) { var d = data[px * step + j] || 0; if (d < min) min = d; if (d > max) max = d; }
        ctx.fillStyle = chopExcluded[segIdx] ? 'rgba(100,100,100,0.2)' : (segIdx % 2 === 0 ? 'rgba(102,126,234,0.5)' : 'rgba(52,211,153,0.5)');
        ctx.fillRect(px, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw viewport indicator
    var vp = document.getElementById('chopMinimapViewport');
    if (vp) {
        var zw = chopGetZoomWindow();
        var leftPct = (zw.start / dur) * 100;
        var widthPct = (zw.dur / dur) * 100;
        vp.style.left = leftPct + '%';
        vp.style.width = widthPct + '%';
    }

    // Draw timestamp markers on minimap
    _chopDrawMinimapEnvelope(ctx, canvas);
    _chopDrawMinimapHeatmap(ctx, canvas, dur);
    _chopDrawMinimapTimestampMarkers(ctx, canvas, dur);
}

// ── Region Selection ─────────────────────────────────────────────────────────

function chopUpdateRegionHighlight() {
    var el = document.getElementById('chopRegionHighlight');
    if (!el || !chopRegion || !chopAudioBuffer) { if (el) el.style.display = 'none'; return; }
    var zw = chopGetZoomWindow();
    var canvas = document.getElementById('chopWaveform');
    if (!canvas) return;
    var w = canvas.getBoundingClientRect().width;
    var leftPct = ((chopRegion.startSec - zw.start) / zw.dur) * 100;
    var widthPct = ((chopRegion.endSec - chopRegion.startSec) / zw.dur) * 100;
    el.style.display = 'block';
    el.style.left = Math.max(0, leftPct) + '%';
    el.style.width = Math.min(100 - Math.max(0, leftPct), widthPct) + '%';
}

// ── Loop Playback ────────────────────────────────────────────────────────────

function chopToggleLoop() {
    chopLooping = !chopLooping;
    var btn = document.getElementById('chopLoopBtn');
    if (btn) btn.style.color = chopLooping ? '#667eea' : '';
    if (chopLooping && chopRegion) {
        var audio = document.getElementById('chopAudio');
        if (audio) { audio.currentTime = chopRegion.startSec; audio.play(); }
        chopStartLoopCheck();
    } else {
        chopStopLoopCheck();
    }
}

function chopStartLoopCheck() {
    chopStopLoopCheck();
    function check() {
        if (!chopLooping || !chopRegion) return;
        var audio = document.getElementById('chopAudio');
        if (audio && audio.currentTime >= chopRegion.endSec) {
            audio.currentTime = chopRegion.startSec;
        }
        chopLoopRAF = requestAnimationFrame(check);
    }
    check();
}

function chopStopLoopCheck() {
    if (chopLoopRAF) { cancelAnimationFrame(chopLoopRAF); chopLoopRAF = null; }
}

// ── Boundary Snapping ────────────────────────────────────────────────────────

function chopSnapToNearest(sec) {
    if (!chopAudioBuffer) return sec;
    var best = sec;
    var bestDist = 0.5; // snap within 0.5 seconds

    // Snap to silence gap edges
    var data = chopAudioBuffer.getChannelData(0);
    var sr = chopAudioBuffer.sampleRate;
    var windowSize = Math.floor(sr * 0.05);
    var sampleIdx = Math.floor(sec * sr);
    var searchRange = Math.floor(sr * 0.5);
    var minRms = Infinity;
    var minRmsIdx = sampleIdx;

    for (var i = Math.max(0, sampleIdx - searchRange); i < Math.min(data.length, sampleIdx + searchRange); i += windowSize) {
        var sum = 0;
        var end = Math.min(i + windowSize, data.length);
        for (var j = i; j < end; j++) sum += data[j] * data[j];
        var rms = Math.sqrt(sum / (end - i));
        if (rms < minRms) { minRms = rms; minRmsIdx = i; }
    }
    var quietestSec = minRmsIdx / sr;
    if (Math.abs(quietestSec - sec) < bestDist) best = quietestSec;

    // Snap to existing markers
    for (var m = 0; m < chopMarkers.length; m++) {
        if (Math.abs(chopMarkers[m] - sec) < 0.3) { best = chopMarkers[m]; break; }
    }

    return Math.round(best * 100) / 100;
}

// ── Restart Hotspot Clustering ────────────────────────────────────────────────

var chopRestartHotspots = []; // computed from segments + user markers

/**
 * Build restart hotspot clusters from timeline segments and user markers.
 * Clusters nearby restart events within a time window.
 * @param {number} [windowSec]  Clustering window (default 30s)
 * @returns {Array} hotspots
 */
function chopComputeRestartHotspots(windowSec) {
    windowSec = windowSec || 30;
    var events = []; // { sec, source, songTitle }

    // Gather from timeline segments
    if (typeof GLStore !== 'undefined' && GLStore.getLatestTimeline) {
        var tl = GLStore.getLatestTimeline();
        if (tl && tl.segments) {
            for (var i = 0; i < tl.segments.length; i++) {
                var seg = tl.segments[i];
                if (seg.likelyIntent === 'restart') {
                    events.push({ sec: seg.startSec, source: 'ai', songTitle: seg.likelySongTitle || null });
                }
            }
        }
    }

    // Gather from user timestamp markers
    for (var m = 0; m < chopTimestampMarkers.length; m++) {
        if (chopTimestampMarkers[m].type === 'restart') {
            events.push({ sec: chopTimestampMarkers[m].sec, source: 'user', songTitle: null });
        }
    }

    if (!events.length) { chopRestartHotspots = []; return []; }

    // Sort by time
    events.sort(function(a, b) { return a.sec - b.sec; });

    // Cluster: merge events within windowSec of each other
    var clusters = [];
    var current = { events: [events[0]], startSec: events[0].sec, endSec: events[0].sec };

    for (var e = 1; e < events.length; e++) {
        if (events[e].sec - current.endSec <= windowSec) {
            current.events.push(events[e]);
            current.endSec = events[e].sec;
        } else {
            clusters.push(current);
            current = { events: [events[e]], startSec: events[e].sec, endSec: events[e].sec };
        }
    }
    clusters.push(current);

    // Build hotspot objects
    chopRestartHotspots = clusters.map(function(c) {
        var center = (c.startSec + c.endSec) / 2;
        var songTitle = null;
        var userConfirmed = false;
        for (var ev = 0; ev < c.events.length; ev++) {
            if (c.events[ev].songTitle && !songTitle) songTitle = c.events[ev].songTitle;
            if (c.events[ev].source === 'user') userConfirmed = true;
        }
        return {
            startSec: c.startSec,
            endSec: c.endSec,
            centerSec: Math.round(center * 10) / 10,
            restartCount: c.events.length,
            songTitle: songTitle,
            userConfirmed: userConfirmed,
            intensity: Math.min(1, c.events.length / 4), // normalize 0-1 for visual
        };
    });

    return chopRestartHotspots;
}

/**
 * Draw restart heatmap on the minimap canvas.
 */
function _chopDrawMinimapHeatmap(ctx, canvas, totalDur) {
    if (!chopRestartHotspots.length || totalDur <= 0) return;
    for (var i = 0; i < chopRestartHotspots.length; i++) {
        var h = chopRestartHotspots[i];
        var startPx = (h.startSec / totalDur) * canvas.width;
        var endPx = ((h.endSec + 10) / totalDur) * canvas.width; // pad for visibility
        var width = Math.max(4, endPx - startPx);
        var alpha = 0.15 + h.intensity * 0.35; // 0.15 - 0.50
        ctx.fillStyle = 'rgba(239, 68, 68, ' + alpha + ')';
        ctx.fillRect(startPx, 0, width, canvas.height);
        // Tick mark at center
        var cx = (h.centerSec / totalDur) * canvas.width;
        ctx.fillStyle = 'rgba(239, 68, 68, ' + (0.5 + h.intensity * 0.4) + ')';
        ctx.fillRect(cx - 1, 0, 2, canvas.height);
    }
}

/**
 * Draw restart heatmap overlay on the main waveform.
 */
function _chopDrawWaveformHeatmap(ctx, canvas, viewStart, viewDur) {
    if (!chopRestartHotspots.length || viewDur <= 0) return;
    for (var i = 0; i < chopRestartHotspots.length; i++) {
        var h = chopRestartHotspots[i];
        // Check if hotspot is in view
        var hEnd = h.endSec + 10;
        if (hEnd < viewStart || h.startSec > viewStart + viewDur) continue;

        var startPx = ((h.startSec - viewStart) / viewDur) * canvas.width;
        var endPx = ((hEnd - viewStart) / viewDur) * canvas.width;
        var width = Math.max(6, endPx - startPx);
        var alpha = 0.08 + h.intensity * 0.12; // subtle: 0.08 - 0.20

        // Gradient band
        ctx.fillStyle = 'rgba(239, 68, 68, ' + alpha + ')';
        ctx.fillRect(startPx, 0, width, canvas.height);

        // Intensity marker at center
        var cx = ((h.centerSec - viewStart) / viewDur) * canvas.width;
        if (cx >= 0 && cx <= canvas.width) {
            ctx.fillStyle = 'rgba(239, 68, 68, ' + (0.4 + h.intensity * 0.3) + ')';
            ctx.beginPath();
            ctx.moveTo(cx, canvas.height - 2);
            ctx.lineTo(cx - 4, canvas.height - 8);
            ctx.lineTo(cx + 4, canvas.height - 8);
            ctx.closePath();
            ctx.fill();

            // Count label
            if (h.restartCount >= 2) {
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.font = 'bold 8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(h.restartCount + '×', cx, canvas.height - 10);
            }
        }
    }
}

/**
 * Handle click on minimap to jump to nearest hotspot.
 */
function _chopMinimapHotspotClick(sec) {
    if (!chopRestartHotspots.length) return false;
    var bestDist = 15; // within 15 seconds
    var bestHotspot = null;
    for (var i = 0; i < chopRestartHotspots.length; i++) {
        var dist = Math.abs(chopRestartHotspots[i].centerSec - sec);
        if (dist < bestDist) { bestDist = dist; bestHotspot = chopRestartHotspots[i]; }
    }
    if (bestHotspot) {
        var audio = document.getElementById('chopAudio');
        if (audio) { audio.currentTime = bestHotspot.startSec; audio.play(); }
        // Zoom to hotspot region
        var pad = 15;
        chopSetZoom(bestHotspot.startSec - pad, bestHotspot.endSec + pad + 10);
        var info = bestHotspot.restartCount + ' restart' + (bestHotspot.restartCount > 1 ? 's' : '');
        if (bestHotspot.songTitle) info += ' · ' + bestHotspot.songTitle;
        showToast('🔴 ' + info + ' at ' + formatChopTime(bestHotspot.centerSec));
        return true;
    }
    return false;
}

// ── Timestamp Markers ─────────────────────────────────────────────────────────

var CHOP_MARKER_TYPES = {
    'song-start':  { icon: '🎵', color: '#22c55e', label: 'Song Start' },
    'restart':     { icon: '🔄', color: '#f59e0b', label: 'Restart' },
    'clean-run':   { icon: '✅', color: '#60a5fa', label: 'Clean Run' },
    'discussion':  { icon: '💬', color: '#a78bfa', label: 'Discussion' },
};

window.chopAddTimestampMarker = function(type) {
    var audio = document.getElementById('chopAudio');
    if (!audio || !chopAudioBuffer) return;
    var sec = audio.currentTime || 0;
    var def = CHOP_MARKER_TYPES[type];
    if (!def) return;
    chopTimestampMarkers.push({
        id: 'tm_' + Date.now() + '_' + chopTimestampMarkers.length,
        sec: Math.round(sec * 100) / 100,
        type: type,
        label: def.label,
    });
    chopTimestampMarkers.sort(function(a, b) { return a.sec - b.sec; });
    if (type === 'restart') chopComputeRestartHotspots();
    chopDrawWaveform();
    chopDrawMinimap();
    _chopSyncTimestampMarkers();
    showToast(def.icon + ' ' + def.label + ' at ' + formatChopTime(sec));
};

window.chopRemoveTimestampMarker = function(id) {
    chopTimestampMarkers = chopTimestampMarkers.filter(function(m) { return m.id !== id; });
    chopComputeRestartHotspots();
    chopDrawWaveform();
    chopDrawMinimap();
    _chopSyncTimestampMarkers();
};

function _chopSyncTimestampMarkers() {
    if (typeof GLStore === 'undefined' || !GLStore.getLatestTimeline) return;
    var tl = GLStore.getLatestTimeline();
    if (!tl) return;
    // Store markers alongside the timeline
    tl.timestampMarkers = chopTimestampMarkers.slice();
    if (GLStore.saveTimelineCorrections) GLStore.saveTimelineCorrections(tl);
}

function _chopLoadTimestampMarkers() {
    if (typeof GLStore === 'undefined' || !GLStore.getLatestTimeline) return;
    var tl = GLStore.getLatestTimeline();
    if (tl && tl.timestampMarkers && Array.isArray(tl.timestampMarkers)) {
        chopTimestampMarkers = tl.timestampMarkers.slice();
    }
}

function _chopDrawTimestampMarkers(ctx, canvas, viewStart, viewDur) {
    for (var i = 0; i < chopTimestampMarkers.length; i++) {
        var m = chopTimestampMarkers[i];
        if (m.sec < viewStart || m.sec > viewStart + viewDur) continue;
        var x = ((m.sec - viewStart) / viewDur) * canvas.width;
        var def = CHOP_MARKER_TYPES[m.type] || { color: '#94a3b8', icon: '📌' };

        // Vertical dashed line
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Diamond marker at top
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.moveTo(x, 2);
        ctx.lineTo(x + 4, 6);
        ctx.lineTo(x, 10);
        ctx.lineTo(x - 4, 6);
        ctx.closePath();
        ctx.fill();

        // Label
        ctx.fillStyle = def.color;
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(def.icon, x, canvas.height - 4);
    }
}

function _chopDrawMinimapTimestampMarkers(ctx, canvas, totalDur) {
    for (var i = 0; i < chopTimestampMarkers.length; i++) {
        var m = chopTimestampMarkers[i];
        var x = (m.sec / totalDur) * canvas.width;
        var def = CHOP_MARKER_TYPES[m.type] || { color: '#94a3b8' };
        ctx.fillStyle = def.color;
        ctx.fillRect(x - 1, 0, 2, canvas.height);
    }
}

function chopRenderTimestampMarkerList() {
    var el = document.getElementById('chopTimestampList');
    if (!el) return;
    if (!chopTimestampMarkers.length) {
        el.innerHTML = '<div style="font-size:0.72em;color:var(--text-dim);font-style:italic;padding:4px 0">No annotations yet. Use the buttons above to mark song starts, restarts, clean runs, or discussions.</div>';
        return;
    }
    var html = '';
    for (var i = 0; i < chopTimestampMarkers.length; i++) {
        var m = chopTimestampMarkers[i];
        var def = CHOP_MARKER_TYPES[m.type] || { icon: '📌', label: m.type, color: '#94a3b8' };
        html += '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:0.78em">'
            + '<span style="color:' + def.color + '">' + def.icon + '</span>'
            + '<span style="font-family:monospace;font-size:0.9em;color:var(--text-dim);cursor:pointer" onclick="var a=document.getElementById(\'chopAudio\');if(a){a.currentTime=' + m.sec + ';a.play()}">' + formatChopTime(m.sec) + '</span>'
            + '<span style="color:var(--text-muted);flex:1">' + def.label + '</span>'
            + '<button onclick="chopRemoveTimestampMarker(\'' + m.id + '\')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8em;padding:2px" title="Remove">✕</button>'
            + '</div>';
    }
    el.innerHTML = html;
}

// ── Energy Envelope ───────────────────────────────────────────────────────────

function chopComputeEnergyEnvelope() {
    if (!chopAudioBuffer) { chopEnergyEnvelope = null; return; }
    var data = chopAudioBuffer.getChannelData(0);
    var sr = chopAudioBuffer.sampleRate;
    var windowSec = 0.08; // 80ms windows for smooth envelope
    var windowSamples = Math.floor(sr * windowSec);
    var count = Math.ceil(data.length / windowSamples);
    var rms = new Float32Array(count);

    for (var i = 0; i < count; i++) {
        var start = i * windowSamples;
        var end = Math.min(start + windowSamples, data.length);
        var sum = 0;
        for (var j = start; j < end; j++) sum += data[j] * data[j];
        rms[i] = Math.sqrt(sum / (end - start));
    }

    // Light smoothing pass (3-point moving average)
    var smoothed = new Float32Array(count);
    smoothed[0] = rms[0];
    smoothed[count - 1] = rms[count - 1];
    for (var s = 1; s < count - 1; s++) {
        smoothed[s] = (rms[s - 1] + rms[s] * 2 + rms[s + 1]) / 4;
    }

    // Find peak for normalization
    var peak = 0;
    for (var p = 0; p < count; p++) { if (smoothed[p] > peak) peak = smoothed[p]; }

    chopEnergyEnvelope = {
        rms: smoothed,
        peak: peak || 0.001,
        windowSec: windowSec,
        totalSec: chopAudioBuffer.duration,
        count: count,
    };
}

function _chopDrawEnvelope(ctx, canvas, viewStart, viewDur) {
    if (!chopEnergyEnvelope || !chopEnergyEnvelope.count) return;
    var env = chopEnergyEnvelope;
    var w = canvas.width;
    var h = canvas.height;

    // Map envelope indices to the zoom window
    var startIdx = Math.floor(viewStart / env.windowSec);
    var endIdx = Math.ceil((viewStart + viewDur) / env.windowSec);
    startIdx = Math.max(0, startIdx);
    endIdx = Math.min(env.count - 1, endIdx);
    var spanIdx = endIdx - startIdx;
    if (spanIdx < 2) return;

    // Draw filled envelope
    ctx.beginPath();
    ctx.moveTo(0, h);

    for (var px = 0; px < w; px++) {
        var sec = viewStart + (px / w) * viewDur;
        var idx = sec / env.windowSec;
        // Linear interpolation between envelope points
        var i0 = Math.floor(idx);
        var i1 = Math.min(i0 + 1, env.count - 1);
        i0 = Math.max(0, Math.min(i0, env.count - 1));
        var frac = idx - i0;
        var val = env.rms[i0] * (1 - frac) + env.rms[i1] * frac;
        var normalized = val / env.peak; // 0–1
        var y = h - normalized * h * 0.85; // leave 15% headroom
        ctx.lineTo(px, y);
    }

    ctx.lineTo(w, h);
    ctx.closePath();

    // Fill with semi-transparent gradient
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(99, 102, 241, 0.15)');
    grad.addColorStop(1, 'rgba(99, 102, 241, 0.02)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Stroke the top line
    ctx.beginPath();
    for (var px2 = 0; px2 < w; px2++) {
        var sec2 = viewStart + (px2 / w) * viewDur;
        var idx2 = sec2 / env.windowSec;
        var i02 = Math.floor(idx2);
        var i12 = Math.min(i02 + 1, env.count - 1);
        i02 = Math.max(0, Math.min(i02, env.count - 1));
        var frac2 = idx2 - i02;
        var val2 = env.rms[i02] * (1 - frac2) + env.rms[i12] * frac2;
        var y2 = h - (val2 / env.peak) * h * 0.85;
        if (px2 === 0) ctx.moveTo(px2, y2);
        else ctx.lineTo(px2, y2);
    }
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

function _chopDrawMinimapEnvelope(ctx, canvas) {
    if (!chopEnergyEnvelope || !chopEnergyEnvelope.count) return;
    var env = chopEnergyEnvelope;
    var w = canvas.width;
    var h = canvas.height;

    ctx.beginPath();
    ctx.moveTo(0, h);
    for (var px = 0; px < w; px++) {
        var idx = (px / w) * env.count;
        var i0 = Math.max(0, Math.min(Math.floor(idx), env.count - 1));
        var i1 = Math.min(i0 + 1, env.count - 1);
        var frac = idx - i0;
        var val = env.rms[i0] * (1 - frac) + env.rms[i1] * frac;
        var y = h - (val / env.peak) * h * 0.8;
        ctx.lineTo(px, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (var px2 = 0; px2 < w; px2++) {
        var idx2 = (px2 / w) * env.count;
        var i02 = Math.max(0, Math.min(Math.floor(idx2), env.count - 1));
        var i12 = Math.min(i02 + 1, env.count - 1);
        var val2 = env.rms[i02] * (1 - (idx2 - i02)) + env.rms[i12] * (idx2 - i02);
        var y2 = h - (val2 / env.peak) * h * 0.8;
        if (px2 === 0) ctx.moveTo(px2, y2); else ctx.lineTo(px2, y2);
    }
    ctx.stroke();
}

function chopDrawWaveform() {
    if (!chopAudioBuffer) return;
    var canvas = document.getElementById('chopWaveform');
    var ctx = canvas.getContext('2d');
    var data = chopAudioBuffer.getChannelData(0);
    var amp = canvas.height / 2;
    var totalDur = chopAudioBuffer.duration;

    // Zoom window
    var zw = chopGetZoomWindow();
    var viewStart = zw.start;
    var viewDur = zw.dur;

    // Samples per pixel for the zoomed view
    var sr = chopAudioBuffer.sampleRate;
    var startSample = Math.floor(viewStart * sr);
    var endSample = Math.floor((viewStart + viewDur) * sr);
    var samplesInView = endSample - startSample;
    var step = Math.max(1, Math.ceil(samplesInView / canvas.width));

    ctx.fillStyle = '#0f0f1e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Build segment boundaries for coloring
    var allMarkers = [0].concat(chopMarkers.slice().sort(function(a,b){return a-b})).concat([totalDur]);

    // Draw waveform with segment coloring (zoomed)
    for (var px = 0; px < canvas.width; px++) {
        var sec = viewStart + (px / canvas.width) * viewDur;
        var segIdx = 0;
        for (var m = 0; m < allMarkers.length - 1; m++) {
            if (sec >= allMarkers[m] && sec < allMarkers[m + 1]) { segIdx = m; break; }
        }
        var isExcluded = !!chopExcluded[segIdx];

        var sIdx = startSample + px * step;
        var min = 1.0, max = -1.0;
        for (var j = 0; j < step && (sIdx + j) < data.length; j++) {
            var datum = data[sIdx + j] || 0;
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }

        if (isExcluded) {
            ctx.fillStyle = 'rgba(100,100,100,0.3)';
        } else {
            ctx.fillStyle = segIdx % 2 === 0 ? '#667eea' : '#34d399';
        }
        ctx.fillRect(px, (1 + min) * amp, 1, Math.max(1, (max - min) * amp));
    }

    // Draw energy envelope overlay
    _chopDrawEnvelope(ctx, canvas, viewStart, viewDur);

    // Draw restart heatmap overlay
    _chopDrawWaveformHeatmap(ctx, canvas, viewStart, viewDur);

    // Draw split markers (only those in view)
    chopMarkers.forEach(function(sec) {
        if (sec < viewStart || sec > viewStart + viewDur) return;
        var x = ((sec - viewStart) / viewDur) * canvas.width;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.moveTo(x - 5, 0); ctx.lineTo(x + 5, 0); ctx.lineTo(x, 8); ctx.fill();
        ctx.fillStyle = 'rgba(245,158,11,0.9)';
        ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(formatChopTime(sec), x, canvas.height - 2);
    });

    // Highlight selected segment
    if (chopSelectedSegment >= 0) {
        var selStart = allMarkers[chopSelectedSegment];
        var selEnd = allMarkers[Math.min(chopSelectedSegment + 1, allMarkers.length - 1)];
        if (selStart !== undefined && selEnd !== undefined) {
            var x1 = ((selStart - viewStart) / viewDur) * canvas.width;
            var x2 = ((selEnd - viewStart) / viewDur) * canvas.width;
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x1, 0, x2 - x1, canvas.height);
            ctx.setLineDash([]);
            if (chopSettingBoundary === 'start') {
                ctx.fillStyle = 'rgba(245,158,11,0.3)';
                ctx.fillRect(x1 - 3, 0, 6, canvas.height);
            } else if (chopSettingBoundary === 'end') {
                ctx.fillStyle = 'rgba(245,158,11,0.3)';
                ctx.fillRect(x2 - 3, 0, 6, canvas.height);
            }
        }
    }

    // Draw timestamp markers on top of everything
    _chopDrawTimestampMarkers(ctx, canvas, viewStart, viewDur);
}

function chopDetectSilence() {
    if (!chopAudioBuffer) { showToast('Load an audio file first'); return; }
    var threshold = parseFloat(document.getElementById('chopThreshold')?.value || 0.015);
    var minGapSec = parseFloat(document.getElementById('chopMinGap')?.value || 3);
    var data = chopAudioBuffer.getChannelData(0);
    var sampleRate = chopAudioBuffer.sampleRate;
    var minSilenceSamples = minGapSec * sampleRate;

    var windowSize = Math.floor(sampleRate * 0.1);
    var silenceStart = -1;
    chopMarkers = [];
    chopExcluded = {};
    chopSegmentMeta = {};

    for (var i = 0; i < data.length; i += windowSize) {
        var sum = 0;
        var end = Math.min(i + windowSize, data.length);
        for (var j = i; j < end; j++) { sum += data[j] * data[j]; }
        var rms = Math.sqrt(sum / (end - i));

        if (rms < threshold) {
            if (silenceStart < 0) silenceStart = i;
        } else {
            if (silenceStart >= 0 && (i - silenceStart) >= minSilenceSamples) {
                var midpoint = (silenceStart + i) / 2 / sampleRate;
                chopMarkers.push(midpoint);
            }
            silenceStart = -1;
        }
    }

    chopDrawWaveform();
    chopRenderSegments();
    showToast('Found ' + chopMarkers.length + ' pause' + (chopMarkers.length !== 1 ? 's' : '') + ' — drag markers to adjust');
}

function chopAddMarker() {
    if (!chopAudioBuffer) return;
    var audio = document.getElementById('chopAudio');
    var time = audio?.currentTime || chopAudioBuffer.duration / 2;
    chopMarkers.push(time);
    chopMarkers.sort(function(a, b) { return a - b; });
    // Find where the new marker landed and shift meta indices
    var newIdx = chopMarkers.indexOf(time);
    var newMeta = {};
    var newExcluded = {};
    Object.keys(chopSegmentMeta).forEach(function(k) {
        var ki = parseInt(k);
        if (ki > newIdx) newMeta[ki + 1] = chopSegmentMeta[ki];
        else newMeta[ki] = chopSegmentMeta[ki];
    });
    // New segment gets unknown metadata
    newMeta[newIdx + 1] = { kind: 'unknown', confidence: 0, likelyIntent: 'unknown', likelySongTitle: null };
    Object.keys(chopExcluded).forEach(function(k) {
        var ki = parseInt(k);
        if (ki > newIdx) newExcluded[ki + 1] = true;
        else newExcluded[ki] = true;
    });
    chopSegmentMeta = newMeta;
    chopExcluded = newExcluded;
    chopDrawWaveform();
    chopRenderSegments();
}

function chopRemoveMarker(index) {
    // When removing a marker, merge excluded and meta state
    if (chopExcluded[index + 1]) delete chopExcluded[index + 1];
    chopMarkers.splice(index, 1);
    // Rebuild excluded + meta maps with shifted indices
    var newExcluded = {};
    var newMeta = {};
    Object.keys(chopExcluded).forEach(function(k) {
        var ki = parseInt(k);
        if (ki > index + 1) newExcluded[ki - 1] = true;
        else if (ki <= index) newExcluded[ki] = true;
    });
    Object.keys(chopSegmentMeta).forEach(function(k) {
        var ki = parseInt(k);
        if (ki > index + 1) newMeta[ki - 1] = chopSegmentMeta[ki];
        else if (ki <= index) newMeta[ki] = chopSegmentMeta[ki];
        // index+1 is merged into index — keep index's metadata
    });
    chopExcluded = newExcluded;
    chopSegmentMeta = newMeta;
    chopDrawWaveform();
    chopRenderSegments();
}

function chopToggleExclude(segIndex) {
    if (chopExcluded[segIndex]) delete chopExcluded[segIndex];
    else chopExcluded[segIndex] = true;
    chopDrawWaveform();
    chopRenderSegments();
}

function chopRenderSegments() {
    var el = document.getElementById('chopSegments');
    if (!el || !chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allMarkers = [0].concat(sorted).concat([dur]);

    // Build song picker options — prioritize agenda songs
    var agendaSongs = [];
    if (typeof GLStore !== 'undefined' && GLStore.getLatestRehearsalAgenda) {
        var agenda = GLStore.getLatestRehearsalAgenda();
        if (agenda && agenda.items) agendaSongs = agenda.items.map(function(it) { return it.songId; });
    }
    var allSongsList = typeof allSongs !== 'undefined' ? allSongs : [];
    var songOptsHtml = '<option value="">— Choose song —</option>';
    if (agendaSongs.length) {
        songOptsHtml += '<optgroup label="Agenda Songs">';
        for (var ag = 0; ag < agendaSongs.length; ag++) {
            songOptsHtml += '<option value="' + agendaSongs[ag].replace(/"/g,'&quot;') + '">' + agendaSongs[ag] + '</option>';
        }
        songOptsHtml += '</optgroup><optgroup label="All Songs">';
    }
    songOptsHtml += allSongsList.map(function(s) { return '<option value="' + (s.title||'').replace(/"/g,'&quot;') + '">' + (s.title||'') + '</option>'; }).join('');
    if (agendaSongs.length) songOptsHtml += '</optgroup>';

    var kindIcons = { music: '🎵', speech: '💬', silence: '⏸', unknown: '❓', excluded: '🚫' };
    var intentLabels = { attempt: 'Attempt', restart: 'Restart', discussion: 'Discussion', tuning: 'Tuning', break: 'Break', pause: 'Pause', unknown: '—' };
    var kindColors = { music: '#667eea', speech: '#f59e0b', silence: '#475569', unknown: '#64748b', excluded: '#666' };

    var activeCount = 0;
    for (var k = 0; k < allMarkers.length - 1; k++) { if (!chopExcluded[k]) activeCount++; }

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">';
    html += '<div style="font-weight:700;font-size:0.88em">🎵 Segments (' + activeCount + ' active / ' + (allMarkers.length - 1) + ' total)</div>';
    html += '<div style="font-size:0.68em;color:var(--text-dim)">Click a time to set boundary on waveform</div>';
    html += '</div>';

    for (var i = 0; i < allMarkers.length - 1; i++) {
        var startSec = allMarkers[i];
        var endSec = allMarkers[i + 1];
        var segDuration = endSec - startSec;
        var isExcluded = !!chopExcluded[i];
        var isSel = chopSelectedSegment === i;
        var meta = chopSegmentMeta[i] || { kind: 'unknown', confidence: 0, likelyIntent: 'unknown', likelySongTitle: null };
        var borderColor = isSel ? '#f59e0b' : (isExcluded ? '#666' : (kindColors[meta.kind] || '#667eea'));

        html += '<div class="app-card" style="margin-bottom:4px;padding:8px 10px;opacity:' + (isExcluded ? '0.4' : '1') + ';border-left:3px solid ' + borderColor + ';' + (isSel ? 'background:rgba(245,158,11,0.08)' : '') + '">';

        // Row 1: time + kind badge + intent + confidence + actions
        html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">';
        // Time
        html += '<div style="font-size:0.7em;color:var(--text-dim);flex-shrink:0">';
        html += "<button onclick=\"chopSelectBoundary(" + i + ",'start')\" ondblclick=\"chopEditTime(event," + i + ",'start')\" style=\"background:none;border:1px solid " + (isSel && chopSettingBoundary === 'start' ? '#f59e0b' : 'transparent') + ";border-radius:3px;cursor:pointer;padding:1px 3px;color:var(--text);font-size:1em;font-family:monospace\" title=\"Click: set on waveform\">" + formatChopTime(startSec) + "</button>";
        html += '<span>\u2013</span>';
        html += "<button onclick=\"chopSelectBoundary(" + i + ",'end')\" ondblclick=\"chopEditTime(event," + i + ",'end')\" style=\"background:none;border:1px solid " + (isSel && chopSettingBoundary === 'end' ? '#f59e0b' : 'transparent') + ";border-radius:3px;cursor:pointer;padding:1px 3px;color:var(--text);font-size:1em;font-family:monospace\" title=\"Click: set on waveform\">" + formatChopTime(endSec) + "</button>";
        html += ' <span style="font-size:0.85em">(' + formatChopTime(segDuration) + ')</span>';
        html += '</div>';
        // Kind badge
        html += '<span style="font-size:0.65em;font-weight:700;padding:1px 6px;border-radius:4px;background:' + (kindColors[meta.kind]||'#64748b') + '22;color:' + (kindColors[meta.kind]||'#64748b') + '">' + (kindIcons[meta.kind]||'❓') + ' ' + (meta.kind||'?') + '</span>';
        // Intent
        if (meta.likelyIntent && meta.likelyIntent !== 'unknown') {
            html += '<span style="font-size:0.62em;color:var(--text-dim,#475569)">' + (intentLabels[meta.likelyIntent]||meta.likelyIntent) + '</span>';
        }
        // Confidence
        if (meta.confidence > 0) {
            html += '<span style="font-size:0.58em;color:var(--text-dim,#475569);opacity:0.7">' + Math.round(meta.confidence * 100) + '%</span>';
        }
        // Spacer + actions
        html += '<div style="margin-left:auto;display:flex;gap:2px;flex-shrink:0">';
        html += '<button onclick="chopPreviewSegment(' + startSec + ',' + endSec + ')" class="btn btn-sm btn-ghost" style="font-size:0.72em;padding:3px 6px" title="Preview">▶</button>';
        html += '<button onclick="chopToggleExclude(' + i + ')" style="background:none;border:none;cursor:pointer;font-size:0.8em;padding:2px" title="' + (isExcluded ? 'Include' : 'Exclude') + '">' + (isExcluded ? '➕' : '🚫') + '</button>';
        if (i > 0) html += '<button onclick="chopRemoveMarker(' + (i - 1) + ')" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:0.8em;padding:2px" title="Merge with previous">✕</button>';
        html += '</div></div>';

        // Row 2: song picker + kind/intent correction (only for non-excluded)
        if (!isExcluded) {
            html += '<div style="display:flex;gap:4px;align-items:center">';
            // Song picker
            html += '<select class="app-select" id="chopSong_' + i + '" onchange="chopUpdateMeta(' + i + ')" style="flex:1;font-size:0.78em">' + songOptsHtml + '</select>';
            // Kind correction
            html += '<select class="app-select" id="chopKind_' + i + '" onchange="chopUpdateMeta(' + i + ')" style="width:80px;font-size:0.72em">';
            var kinds = ['music','speech','silence','unknown'];
            for (var ki = 0; ki < kinds.length; ki++) {
                html += '<option value="' + kinds[ki] + '"' + (meta.kind === kinds[ki] ? ' selected' : '') + '>' + (kindIcons[kinds[ki]]||'') + ' ' + kinds[ki] + '</option>';
            }
            html += '</select>';
            // Intent correction
            html += '<select class="app-select" id="chopIntent_' + i + '" onchange="chopUpdateMeta(' + i + ')" style="width:90px;font-size:0.72em">';
            var intents = ['attempt','restart','discussion','tuning','break','pause','unknown'];
            for (var ii = 0; ii < intents.length; ii++) {
                html += '<option value="' + intents[ii] + '"' + (meta.likelyIntent === intents[ii] ? ' selected' : '') + '>' + (intentLabels[intents[ii]]||intents[ii]) + '</option>';
            }
            html += '</select>';
            html += '</div>';
        }

        html += '</div>';
    }
    html += '<button class="btn btn-success" onclick="chopSaveAll()" style="width:100%;margin-top:8px">💾 Save All Named Segments as Takes</button>';
    el.innerHTML = html;

    // Restore song selections from meta
    for (var ri = 0; ri < allMarkers.length - 1; ri++) {
        var rmeta = chopSegmentMeta[ri];
        if (rmeta && rmeta.likelySongTitle) {
            var sel = document.getElementById('chopSong_' + ri);
            if (sel) sel.value = rmeta.likelySongTitle;
        }
    }

    // Sync corrections back to store
    _chopSyncToStore(allMarkers);
}

// M8 Phase 2: Update metadata from UI correction dropdowns
window.chopUpdateMeta = function(segIndex) {
    var kindSel = document.getElementById('chopKind_' + segIndex);
    var intentSel = document.getElementById('chopIntent_' + segIndex);
    var songSel = document.getElementById('chopSong_' + segIndex);

    if (!chopSegmentMeta[segIndex]) {
        chopSegmentMeta[segIndex] = { kind: 'unknown', confidence: 0, likelyIntent: 'unknown', likelySongTitle: null };
    }
    var meta = chopSegmentMeta[segIndex];
    if (kindSel) { meta.kind = kindSel.value; meta.confidence = 1.0; }
    if (intentSel) meta.likelyIntent = intentSel.value;
    if (songSel) meta.likelySongTitle = songSel.value || null;

    // Re-sync to store without full re-render
    var dur = chopAudioBuffer ? chopAudioBuffer.duration : 0;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allM = [0].concat(sorted).concat([dur]);
    _chopSyncToStore(allM);
};

function _chopSyncToStore(allMarkers) {
    if (typeof GLStore === 'undefined' || !GLStore.saveTimelineCorrections || !chopAudioBuffer) return;
    var timeline = GLStore.getLatestTimeline();
    if (!timeline) return;

    var segments = [];
    for (var i = 0; i < allMarkers.length - 1; i++) {
        var meta = chopSegmentMeta[i] || {};
        var songSel = document.getElementById('chopSong_' + i);
        var songTitle = (songSel ? songSel.value : null) || meta.likelySongTitle || null;

        segments.push({
            id: 'seg_' + i,
            startSec: Math.round(allMarkers[i] * 10) / 10,
            endSec: Math.round(allMarkers[i + 1] * 10) / 10,
            durationSec: Math.round((allMarkers[i + 1] - allMarkers[i]) * 10) / 10,
            kind: chopExcluded[i] ? 'excluded' : (meta.kind || 'music'),
            confidence: meta.confidence || (chopExcluded[i] ? 1.0 : 0.5),
            likelyIntent: chopExcluded[i] ? 'excluded' : (meta.likelyIntent || 'attempt'),
            likelySongId: null,
            likelySongTitle: songTitle,
            notes: [],
        });
    }

    var music = 0, speech = 0, silence = 0, restarts = 0;
    for (var j = 0; j < segments.length; j++) {
        if (segments[j].kind === 'music') music++;
        if (segments[j].kind === 'speech') speech++;
        if (segments[j].kind === 'silence') silence++;
        if (segments[j].likelyIntent === 'restart') restarts++;
    }

    GLStore.saveTimelineCorrections({
        id: timeline.id,
        createdAt: timeline.createdAt,
        correctedAt: new Date().toISOString(),
        sourceType: 'user-corrected',
        durationSec: timeline.durationSec,
        segments: segments,
        summary: { segmentCount: segments.length, musicSegments: music, speechSegments: speech, silenceSegments: silence, likelyRestarts: restarts },
    });
}

// Parse m:ss time string to seconds
function parseChopTime(str) {
    var parts = str.trim().split(':');
    if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    if (parts.length === 3) return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    return parseFloat(str) || 0;
}

// Update marker time from editable inputs
function chopUpdateTime(segIndex, isStart) {
    if (!chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});

    var inputId = isStart ? 'chopStart_' + segIndex : 'chopEnd_' + segIndex;
    var input = document.getElementById(inputId);
    if (!input) return;
    var newSec = parseChopTime(input.value);
    newSec = Math.max(0, Math.min(newSec, dur));

    if (isStart && segIndex > 0) {
        var markerVal = sorted[segIndex - 1];
        var origIdx = chopMarkers.indexOf(markerVal);
        if (origIdx >= 0) chopMarkers[origIdx] = newSec;
    } else if (!isStart && segIndex < sorted.length) {
        var markerVal = sorted[segIndex];
        var origIdx = chopMarkers.indexOf(markerVal);
        if (origIdx >= 0) chopMarkers[origIdx] = newSec;
    }

    chopMarkers.sort(function(a,b){return a-b});
    chopDrawWaveform();
    chopRenderSegments();
}

function chopSelectBoundary(segIndex, which) {
    if (chopSelectedSegment === segIndex && chopSettingBoundary === which) {
        chopSelectedSegment = -1;
        chopSettingBoundary = null;
    } else {
        chopSelectedSegment = segIndex;
        chopSettingBoundary = which;
    }
    chopDrawWaveform();
    chopRenderSegments();
    if (chopSettingBoundary) showToast('Click on the waveform to set ' + which + ' point');
}

function chopSetBoundary(sec) {
    if (chopSelectedSegment < 0 || !chopSettingBoundary || !chopAudioBuffer) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allMarkers = [0].concat(sorted).concat([dur]);
    var seg = chopSelectedSegment;
    sec = Math.max(0.1, Math.min(sec, dur - 0.1));

    if (chopSettingBoundary === 'start') {
        if (seg === 0) {
            chopMarkers.push(sec);
            chopMarkers.sort(function(a,b){return a-b});
            var newExcluded = {0: true};
            Object.keys(chopExcluded).forEach(function(k) { newExcluded[parseInt(k) + 1] = chopExcluded[k]; });
            chopExcluded = newExcluded;
        } else {
            var markerVal = sorted[seg - 1];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = sec;
        }
    } else {
        if (seg >= allMarkers.length - 2) {
            chopMarkers.push(sec);
            chopMarkers.sort(function(a,b){return a-b});
            var newAll = [0].concat(chopMarkers.slice().sort(function(a,b){return a-b})).concat([dur]);
            chopExcluded[newAll.length - 2] = true;
        } else {
            var markerVal = sorted[seg];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = sec;
        }
    }

    chopMarkers.sort(function(a,b){return a-b});
    chopSettingBoundary = null;
    chopSelectedSegment = -1;
    chopDrawWaveform();
    chopRenderSegments();
    showToast('Boundary set');
}

function chopEditTime(event, segIndex, which) {
    event.preventDefault();
    event.stopPropagation();
    var btn = event.target;
    var currentTime = btn.textContent.trim();
    var input = document.createElement('input');
    input.type = 'text';
    input.value = currentTime;
    input.style.cssText = 'width:55px;background:rgba(0,0,0,0.5);border:1px solid #f59e0b;border-radius:3px;color:#f59e0b;font-size:1em;font-family:monospace;padding:1px 3px;text-align:center';
    input.placeholder = 'm:ss';
    btn.replaceWith(input);
    input.focus();
    input.select();

    function commit() {
        var newSec = parseChopTime(input.value);
        if (!chopAudioBuffer) return;
        var dur = chopAudioBuffer.duration;
        newSec = Math.max(0.1, Math.min(newSec, dur - 0.1));
        var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
        if (which === 'start' && segIndex > 0) {
            var markerVal = sorted[segIndex - 1];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = newSec;
        } else if (which === 'end' && segIndex < sorted.length) {
            var markerVal = sorted[segIndex];
            var idx = chopMarkers.indexOf(markerVal);
            if (idx >= 0) chopMarkers[idx] = newSec;
        }
        chopMarkers.sort(function(a,b){return a-b});
        chopDrawWaveform();
        chopRenderSegments();
    }
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { chopRenderSegments(); }
    });
    input.addEventListener('blur', commit);
}

var chopPreviewTimeout = null;
function chopPreviewSegment(startSec, endSec) {
    var audio = document.getElementById('chopAudio');
    if (!audio) return;
    audio.currentTime = startSec;
    audio.play();
    // Auto-stop at end of segment
    if (chopPreviewTimeout) clearTimeout(chopPreviewTimeout);
    var duration = (endSec - startSec) * 1000;
    chopPreviewTimeout = setTimeout(function() { audio.pause(); }, duration);
}

async function chopSaveAll() {
    if (!chopAudioBuffer || !chopFile) return;
    var dur = chopAudioBuffer.duration;
    var sorted = chopMarkers.slice().sort(function(a,b){return a-b});
    var allMarkers = [0].concat(sorted).concat([dur]);
    var saved = 0;
    var errors = 0;

    // Show progress
    var btn = document.querySelector('#chopSegments .btn-success');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

    for (var i = 0; i < allMarkers.length - 1; i++) {
        if (chopExcluded[i]) continue;
        var songTitle = document.getElementById('chopSong_' + i)?.value;
        if (!songTitle) continue;
        var startSec = allMarkers[i];
        var endSec = allMarkers[i + 1];
        var segDuration = endSec - startSec;
        var sampleRate = chopAudioBuffer.sampleRate;
        var startSample = Math.floor(startSec * sampleRate);
        var numSamples = Math.floor(segDuration * sampleRate);
        var numChannels = chopAudioBuffer.numberOfChannels;

        try {
            var offline = new OfflineAudioContext(numChannels, numSamples, sampleRate);
            var newBuffer = offline.createBuffer(numChannels, numSamples, sampleRate);
            for (var ch = 0; ch < numChannels; ch++) {
                var oldData = chopAudioBuffer.getChannelData(ch);
                var newData = newBuffer.getChannelData(ch);
                for (var s = 0; s < numSamples && (startSample + s) < oldData.length; s++) {
                    newData[s] = oldData[startSample + s];
                }
            }
            var source = offline.createBufferSource();
            source.buffer = newBuffer;
            source.connect(offline.destination);
            source.start();
            var rendered = await offline.startRendering();
            var wav = audioBufferToWav(rendered);
            // Use chunked btoa for large files
            var bytes = new Uint8Array(wav);
            var binary = '';
            for (var b = 0; b < bytes.length; b += 8192) {
                binary += String.fromCharCode.apply(null, bytes.subarray(b, Math.min(b + 8192, bytes.length)));
            }
            var base64 = btoa(binary);
            var dataUrl = 'data:audio/wav;base64,' + base64;

            // Download WAV file (too large for Firebase JSON storage)
            var wavBlob = new Blob([wav], { type: 'audio/wav' });
            var dlUrl = URL.createObjectURL(wavBlob);
            var dlLink = document.createElement('a');
            dlLink.href = dlUrl;
            dlLink.download = songTitle.replace(/[^a-z0-9]/gi, '_') + '_' + formatChopTime(startSec).replace(':','-') + '.wav';
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
            setTimeout(function() { URL.revokeObjectURL(dlUrl); }, 1000);
            var audioKey = 'chop_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

            var take = {
                label: 'Rehearsal ' + (chopFile?.name || '').replace(/\.[^.]+$/, ''),
                uploadedBy: currentUserEmail,
                uploadedByName: bandMembers[currentUserEmail]?.name || '',
                audioUrl: 'downloaded:' + dlLink.download,
                externalUrl: '',
                recordedDate: new Date().toISOString().slice(0, 10),
                notes: 'Chopped: ' + formatChopTime(startSec) + '-' + formatChopTime(endSec) + ' from ' + (chopFile?.name || 'rehearsal'),
                uploadedAt: new Date().toISOString(),
                crowned: false
            };
            var existing = toArray(await loadBandDataFromDrive(songTitle, 'best_shot_takes') || []);
            if (!existing.length) take.crowned = true;
            existing.push(take);
            await saveBandDataToDrive(songTitle, 'best_shot_takes', existing);
            saved++;
            if (btn) btn.textContent = '⏳ Saved ' + saved + '...';
        } catch (err) {
            console.error('Error chopping segment ' + i + ':', err);
            errors++;
        }
    }
    var msg = '✂️ Saved ' + saved + ' segment' + (saved !== 1 ? 's' : '') + ' as takes!';
    if (errors) msg += ' (' + errors + ' failed)';
    showToast(msg);
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save All Named Segments as Takes'; }
    if (saved > 0 && !errors) document.getElementById('rehearsalChopperModal')?.remove();
}

function formatChopTime(sec) {
    if (sec >= 3600) {
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = Math.floor(sec % 60);
        return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
}

// WAV encoder (PCM 16-bit)
function audioBufferToWav(buffer) {
    var numChannels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var format = 1;
    var bitsPerSample = 16;
    var bytesPerSample = bitsPerSample / 8;
    var blockAlign = numChannels * bytesPerSample;
    var dataLength = buffer.length * blockAlign;
    var totalLength = 44 + dataLength;
    var arrayBuffer = new ArrayBuffer(totalLength);
    var view = new DataView(arrayBuffer);

    function writeString(offset, string) { for (var i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); }
    writeString(0, 'RIFF');
    view.setUint32(4, totalLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    var offset = 44;
    for (var i = 0; i < buffer.length; i++) {
        for (var ch = 0; ch < numChannels; ch++) {
            var sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }
    return arrayBuffer;
}

// // BEST SHOT — Overview Page (Gap Dashboard)
// ============================================================================
function renderBestShotPage(el) {
    // Lightweight overview — only loads status data, not full takes for every song
    el.innerHTML = '<div class="page-header"><h1>🏆 Best Shot</h1><p>Band recordings vs reference versions</p></div>' +
        '<div style="font-size:0.82em;color:var(--text-dim);margin-bottom:12px">Select a song to see its Section Scorecard, takes, and reference versions.</div>' +
        '<input class="app-input" id="bsOverviewSearch" placeholder="Search songs..." oninput="filterBestShotOverview()" style="margin-bottom:12px">' +
        '<div id="bsOverviewList"></div>';
    renderBestShotOverviewList();
}

async function renderBestShotOverviewList() {
    var el = document.getElementById('bsOverviewList');
    if (!el) return;
    var search = (document.getElementById('bsOverviewSearch')?.value || '').toLowerCase();
    var filtered = allSongs.filter(function(s) { return !search || s.title.toLowerCase().includes(search); });
    // Only show first 30 for performance
    var shown = filtered.slice(0, 30);
    var html = '';
    shown.forEach(function(song) {
        var status = song.status || '';
        var statusBadge = '';
        if (status === 'Gig Ready') statusBadge = '<span style="font-size:0.65em;background:rgba(16,185,129,0.15);color:#10b981;padding:1px 5px;border-radius:4px">✅</span>';
        else if (status === 'This Week') statusBadge = '<span style="font-size:0.65em;background:rgba(245,158,11,0.15);color:#f59e0b;padding:1px 5px;border-radius:4px">🎯</span>';
        html += '<div class="list-item" onclick="showPage(\'songs\');setTimeout(function(){selectSong(\'' + song.title.replace(/'/g, "\\'") + '\');document.getElementById(\'step3bestshot\')?.scrollIntoView({behavior:\'smooth\'})},300)" style="cursor:pointer;padding:10px 12px">';
        html += '<div style="display:flex;align-items:center;gap:8px"><div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.88em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + song.title + '</div>';
        html += '<div style="font-size:0.72em;color:var(--text-dim)">' + (song.artist || '') + '</div></div>';
        html += statusBadge + '</div></div>';
    });
    if (filtered.length > 30) {
        html += '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:0.82em">Showing 30 of ' + filtered.length + ' songs. Use search to narrow.</div>';
    }
    if (!filtered.length) {
        html += '<div style="text-align:center;padding:40px;color:var(--text-dim)">No songs match.</div>';
    }
    el.innerHTML = html;
}

function filterBestShotOverview() { renderBestShotOverviewList(); }

async function loadBestShotOverview() {
    var el = document.getElementById('bsOverviewGrid');
    if (!el) return;
    var songs = typeof allSongs !== 'undefined' ? allSongs : [];

    // Only show songs that have North Star OR best shots
    var relevantSongs = [];
    for (var si = 0; si < songs.length; si++) {
        var s = songs[si];
        var title = s.title || '';
        if (!title) continue;
        if (northStarCache[title]) { relevantSongs.push(s); continue; }
        // Check if it has best shot takes
        var takes = toArray(await loadBandDataFromDrive(title, 'best_shot_takes') || []);
        if (takes.length) relevantSongs.push(s);
    }

    if (!relevantSongs.length) {
        el.innerHTML = '<div class="app-card" style="text-align:center;padding:40px"><div style="font-size:2em;margin-bottom:8px">🏆</div><div style="color:var(--text-dim)">No songs with North Star references or recordings yet.</div><div style="font-size:0.82em;color:var(--text-dim);margin-top:8px">Add a reference version to any song to get started.</div></div>';
        return;
    }

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
    for (var i = 0; i < relevantSongs.length; i++) {
        var song = relevantSongs[i];
        var title = song.title;
        var ratings = await loadBandDataFromDrive(title, 'best_shot_ratings') || {};
        var takes = toArray(await loadBandDataFromDrive(title, 'best_shot_takes') || []);
        var hasNorthStar = !!northStarCache[title];

        var sections = ['Intro', 'Verse', 'Chorus', 'Bridge', 'Jam', 'Outro'];
        var greenCount = 0, ratedCount = 0;
        sections.forEach(function(sec) {
            var sr = ratings[sec] || {};
            var vals = Object.values(sr);
            if (!vals.length) return;
            ratedCount++;
            var greens = vals.filter(function(v) { return v === 'green'; }).length;
            if (greens === vals.length) greenCount++;
        });
        var pct = ratedCount ? Math.round(greenCount / sections.length * 100) : 0;
        var statusColor = pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : 'var(--text-dim)';
        var statusLabel = pct >= 80 ? '🔥 Almost there' : pct >= 40 ? '💪 Making progress' : pct > 0 ? '🎯 Keep working' : 'Not rated';

        html += '<div class="app-card" style="cursor:pointer;padding:14px;transition:all 0.15s" onclick="selectSong(\'' + title.replace(/'/g, "\\'") + '\');showPage(\'songs\')" onmouseover="this.style.borderColor=\'rgba(102,126,234,0.3)\'" onmouseout="this.style.borderColor=\'\'">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">';
        html += '<div style="font-weight:700;font-size:0.9em;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + title + '</div>';
        html += '<div style="display:flex;gap:4px;flex-shrink:0">';
        if (hasNorthStar) html += '<span style="font-size:0.7em;padding:2px 6px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.2);border-radius:4px;color:var(--accent-light)">⭐</span>';
        if (takes.length) html += '<span style="font-size:0.7em;padding:2px 6px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:4px;color:#f59e0b">🏆 ' + takes.length + '</span>';
        html += '</div></div>';

        // Mini progress bar
        html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
        html += '<div style="flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,0.06);overflow:hidden">';
        html += '<div style="width:' + pct + '%;height:100%;background:' + statusColor + ';border-radius:3px;transition:width 0.3s"></div>';
        html += '</div>';
        html += '<div style="font-size:0.75em;font-weight:700;color:' + statusColor + '">' + greenCount + '/' + sections.length + '</div>';
        html += '</div>';

        // Section dots
        html += '<div style="display:flex;gap:4px;flex-wrap:wrap">';
        sections.forEach(function(sec) {
            var sr = ratings[sec] || {};
            var vals = Object.values(sr);
            var dot = '⬜';
            if (vals.length) {
                var greens = vals.filter(function(v) { return v === 'green'; }).length;
                var reds = vals.filter(function(v) { return v === 'red'; }).length;
                if (greens === vals.length) dot = '🟢';
                else if (reds > greens) dot = '🔴';
                else dot = '🟡';
            }
            html += '<span style="font-size:0.55em;display:flex;align-items:center;gap:1px;color:var(--text-dim)">' + dot + '<span style="font-size:0.9em">' + sec.slice(0,3) + '</span></span>';
        });
        html += '</div>';

        html += '<div style="font-size:0.72em;color:' + statusColor + ';margin-top:6px">' + statusLabel + '</div>';
        html += '</div>';
    }
    html += '</div>';
    el.innerHTML = html;
}

// ============================================================================
// GUITAR TUNER

// ── Window exports (called from inline HTML onclick handlers) ──────────────
window.renderBestShotVsNorthStar = renderBestShotVsNorthStar;
window.emailKey = emailKey;
window.emailFromKey = emailFromKey;
window.rateBestShotSection = rateBestShotSection;
window.updateSectionRatingInline = updateSectionRatingInline;
window.toggleSectionNotes = toggleSectionNotes;
window.addSectionNote = addSectionNote;
window.editSectionNote = editSectionNote;
window.saveEditedSectionNote = saveEditedSectionNote;
window.deleteSectionNote = deleteSectionNote;
window.crownBestShot = crownBestShot;
window.editBestShotTake = editBestShotTake;
window.deleteBestShotTake = deleteBestShotTake;
window.addBestShotTake = addBestShotTake;
window.handleBestShotFile = handleBestShotFile;
window.normalizeAudioUrl = normalizeAudioUrl;
window.bestShotAudioHtml = bestShotAudioHtml;
window.loadFirebaseAudio = loadFirebaseAudio;
window.loadGdriveAudio = loadGdriveAudio;
window.saveBestShotTake = saveBestShotTake;
window.sendToPracticePlan = sendToPracticePlan;
window.editScorecardSections = editScorecardSections;
window.openRehearsalChopper = openRehearsalChopper;
window.chopLoadFile = chopLoadFile;
window.chopWireCanvasEvents = chopWireCanvasEvents;
window.chopStartPlayheadTracker = chopStartPlayheadTracker;
window.chopStopPlayheadTracker = chopStopPlayheadTracker;
window.chopDrawWaveform = chopDrawWaveform;
window.chopDetectSilence = chopDetectSilence;
window.chopAddMarker = chopAddMarker;
window.chopRemoveMarker = chopRemoveMarker;
window.chopToggleExclude = chopToggleExclude;
window.chopRenderSegments = chopRenderSegments;
window.parseChopTime = parseChopTime;
window.chopUpdateTime = chopUpdateTime;
window.chopSelectBoundary = chopSelectBoundary;
window.chopSetBoundary = chopSetBoundary;
window.chopEditTime = chopEditTime;
window.chopPreviewSegment = chopPreviewSegment;
window.chopSaveAll = chopSaveAll;
window.formatChopTime = formatChopTime;
window.audioBufferToWav = audioBufferToWav;
window.renderBestShotPage = renderBestShotPage;
window.renderBestShotOverviewList = renderBestShotOverviewList;
window.filterBestShotOverview = filterBestShotOverview;
window.loadBestShotOverview = loadBestShotOverview;
