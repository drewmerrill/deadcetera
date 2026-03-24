// =============================================================================
// js/features/gigs.js  —  Wave-2 extraction
// =============================================================================
// Contains:
//   • Gig CRUD: venueShortLabel, deleteGig, editGig, saveGigEdit
//   • Gig page: renderGigsPage, loadGigs, addGig, saveGig,
//               _syncGigToCalendar, seedGigData, gigLaunchLinkedSetlist
//   • Gig map:  renderGigsMap, gigsMapSetFilter, _gigsMapApplyFilter (state vars)
//   • Gig history: loadGigHistory
//   • Live Gig Mode: openGigMode, closeGigMode, gmNavigate, gmMarkPlayed,
//               _gmRenderNav, gmToggleDrawer, gmCloseDrawer, gmJumpTo,
//               _gmUpdateNowPlaying, _gmEnsureOverlay, gmOpenPocket,
//               rmCaptureMoment, rmCaptureSave
//   • Gig Payouts: loadGigPayouts, gpRenderExpenses, gpAddExpense, gpSave
//
// Load order: AFTER utils.js, firebase-service.js, worker-api.js, navigation.js,
//             songs.js, data.js  — BEFORE app.js
//
// Globals read at CALL TIME (safe — all defined in app.js or other modules):
//   allSongs, bandMembers, bandPath, firebaseDB, loadBandDataFromDrive,
//   saveBandDataToDrive, showToast, toArray, sanitizeFirebasePath,
//   isUserSignedIn, currentUserEmail, loadSetlists, renderSongs,
//   rmIndex, rmSongBpm (rehearsal-mode.js), openGigPocketMeter (pocket-meter.js)
// =============================================================================

// ── Gig CRUD helpers (app.js 9514–9599) ───────────────────────────────────────

function venueShortLabel(v) {
    const name = v.name || '';
    const addr = v.address || '';
    // Try to extract "City, ST" from address like "123 Main St, Atlanta, GA 30301" or "Atlanta, GA"
    const m = addr.match(/,\s*([^,]+),\s*([A-Z]{2})\b/);
    if (m) return `${name} — ${m[1].trim()}, ${m[2]}`;
    // Fallback: just show address if short enough
    if (addr && addr.length < 30) return `${name} — ${addr}`;
    return name;
}

async function deleteGig(idx) {
    if (!requireSignIn()) return;
    if (!confirm('Delete this gig? This cannot be undone.')) return;
    const raw = (typeof GLStore !== 'undefined' && GLStore.getGigs().length) ? GLStore.getGigs() : toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    const data = [...raw];
    data.splice(idx, 1);
    await saveBandDataToDrive('_band', 'gigs', data);
    showToast('🗑️ Gig deleted');
    loadGigs();
}

async function editGig(idx) {
    const gigData = (typeof GLStore !== 'undefined' && GLStore.getGigs().length) ? GLStore.getGigs() : toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    const g = gigData[idx];
    if (!g) return;
    const venues = await GLStore.getVenues();
    var _slData = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    if (typeof GLStore !== 'undefined' && GLStore.setSetlistCache) GLStore.setSetlistCache(_slData);
    else { window._cachedSetlists = _slData; window._glCachedSetlists = _slData; }
    window._gigSelectedVenueId = g.venueId || null;
    window._gigSelectedVenueName = g.venue || null;
    // Find pre-selected venue by venueId or name match
    var preselected = null;
    if (g.venueId) preselected = venues.find(function(v){ return v.venueId === g.venueId; });
    if (!preselected && g.venue) preselected = venues.find(function(v){ return v.name === g.venue; });
    const el = document.getElementById('gigsList');
    el.innerHTML = `<div class="app-card">
        <h3>🎤 Edit Gig</h3>
        <div class="form-grid">
            <div class="form-row" style="grid-column:1/-1">
                <label class="form-label">Venue</label>
                <div id="gigVenuePicker"></div>
            </div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="gigDate" type="date" value="${g.date||''}"></div>
            <div class="form-row"><label class="form-label">Pay / Guarantee</label><input class="app-input" id="gigPay" value="${(g.pay||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Arrival Time</label><input class="app-input" id="gigArrival" type="time" value="${g.arrivalTime||''}"></div>
            <div class="form-row"><label class="form-label">Soundcheck Time</label><input class="app-input" id="gigSoundcheck" type="time" value="${g.soundcheckTime||''}"></div>
            <div class="form-row"><label class="form-label">Start Time</label><input class="app-input" id="gigStartTime" type="time" value="${g.startTime||''}"></div>
            <div class="form-row"><label class="form-label">End Time</label><input class="app-input" id="gigEndTime" type="time" value="${g.endTime||''}"></div>
            <div class="form-row"><label class="form-label">Sound Person</label><input class="app-input" id="gigSound" value="${(g.soundPerson||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><label class="form-label">Venue Contact</label><input class="app-input" id="gigContact" value="${(g.contact||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <div class="form-row" style="margin-top:10px"><label class="form-label">📋 Linked Setlist</label>
            <select class="app-select" id="gigLinkedSetlist">
                <option value="">-- None --</option>
                ${(window._cachedSetlists||[]).map(sl => `<option value="${sl.setlistId||''}" ${sl.setlistId&&g.setlistId===sl.setlistId?'selected':''}>${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`).join('')}
            </select>
        </div>
        <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="gigNotes">${g.notes||''}</textarea></div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-success" onclick="saveGigEdit(${idx})">💾 Save</button>
            <button class="btn btn-ghost" onclick="loadGigs()">Cancel</button>
        </div>
    </div>`;
    _gigInitVenuePicker(venues, preselected);
}

async function saveGigEdit(idx) {
    if (!requireSignIn()) return;
    const gigData = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var prev = gigData[idx] || {};
    var selectedSetlistId = document.getElementById('gigLinkedSetlist')?.value || '';

    gigData[idx] = {
        ...prev,
        gigId:         prev.gigId || generateShortId(12),
        venueId:       window._gigVenueTouched ? (window._gigSelectedVenueId || null) : (prev.venueId || null),
        venue:         window._gigVenueTouched ? (window._gigSelectedVenueName || '') : (prev.venue || ''),
        date:          document.getElementById('gigDate')?.value,
        pay:           document.getElementById('gigPay')?.value,
        arrivalTime:   document.getElementById('gigArrival')?.value,
        soundcheckTime:document.getElementById('gigSoundcheck')?.value,
        startTime:     document.getElementById('gigStartTime')?.value,
        endTime:       document.getElementById('gigEndTime')?.value,
        soundPerson:   document.getElementById('gigSound')?.value,
        contact:       document.getElementById('gigContact')?.value,
        notes:         document.getElementById('gigNotes')?.value,
        updated: new Date().toISOString()
    };

    // Resolve setlist link by setlistId only
    var allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var linkedSl = null;
    if (selectedSetlistId) {
        linkedSl = allSetlists.find(function(s) { return s.setlistId === selectedSetlistId; });
    }

    // Clear old setlist back-ref if changing
    if (prev.setlistId && (!linkedSl || linkedSl.setlistId !== prev.setlistId)) {
        var oldSl = allSetlists.find(function(s) { return s.setlistId === prev.setlistId; });
        if (oldSl && oldSl.gigId === gigData[idx].gigId) oldSl.gigId = null;
    }

    if (linkedSl) {
        if (!linkedSl.setlistId) linkedSl.setlistId = generateShortId(12);
        gigData[idx].setlistId = linkedSl.setlistId;
        gigData[idx].linkedSetlist = linkedSl.name || '';
        linkedSl.gigId = gigData[idx].gigId;
    } else {
        gigData[idx].setlistId = prev.setlistId || null;
        gigData[idx].linkedSetlist = prev.linkedSetlist || '';
    }
    await saveBandDataToDrive('_band', 'setlists', allSetlists);
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    else { window._cachedSetlists = null; window._glCachedSetlists = null; }

    await saveBandDataToDrive('_band', 'gigs', gigData);
    // Sync updated gig to calendar
    await _syncGigToCalendar(gigData[idx], gigData[idx].created || null);
    showToast('✅ Gig updated!');
    loadGigs();
}

// ── Gig map state + Gig page + Gig CRUD (app.js 11867–12335) ────────────────────

var _gigsMap = null;
var _gigsMapMarkers = [];
var _gigsMapInfoWindows = [];
var _gigsMapFilter = 'all'; // 'all' | 'upcoming' | 'past'

async function renderGigsMap() {
    var el = document.getElementById('gigsMapContainer');
    if (!el) return;

    var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var venues = toArray(await loadBandDataFromDrive('_band', 'venues') || []);

    // Build venue lookups — venueId primary, name fallback
    var venueByIdLookup = {};
    var venueByNameLookup = {};
    venues.forEach(function(v) {
        if (v.venueId) venueByIdLookup[v.venueId] = v;
        if (v.name) venueByNameLookup[v.name] = v;
    });

    // Attach lat/lng from venues to gigs
    var gigsWithCoords = gigs.filter(function(g) {
        var v = (g.venueId && venueByIdLookup[g.venueId]) || venueByNameLookup[g.venue];
        if (v && v.lat && v.lng) { g._lat = parseFloat(v.lat); g._lng = parseFloat(v.lng); return true; }
        return false;
    });

    if (gigsWithCoords.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);font-size:0.88em">No gigs with venue coordinates yet.<br>Add venues with locations on the Venues page first.</div>';
        return;
    }

    el.innerHTML = '';
    el.style.cssText = 'height:360px;border-radius:12px;overflow:hidden;position:relative';

    try {
        if (window.google && google.maps && google.maps.importLibrary) {
            await google.maps.importLibrary('maps');
            await google.maps.importLibrary('marker');
        }
    } catch(e) {}
    if (!window.google || !window.google.maps || !window.google.maps.Map) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Maps loading...</div>';
        return;
    }

    // Create map centered on centroid of all gig coords
    var avgLat = gigsWithCoords.reduce(function(s,g){return s+g._lat;},0)/gigsWithCoords.length;
    var avgLng = gigsWithCoords.reduce(function(s,g){return s+g._lng;},0)/gigsWithCoords.length;

    _gigsMap = new google.maps.Map(el, {
        center: { lat: avgLat, lng: avgLng },
        zoom: 11,
        mapTypeId: 'roadmap',
        styles: [
            {elementType:'geometry',stylers:[{color:'#1a1f2e'}]},
            {elementType:'labels.text.fill',stylers:[{color:'#8ec3b9'}]},
            {elementType:'labels.text.stroke',stylers:[{color:'#1a1f2e'}]},
            {featureType:'road',elementType:'geometry',stylers:[{color:'#2c3554'}]},
            {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#1a1f2e'}]},
            {featureType:'road',elementType:'labels.text.fill',stylers:[{color:'#9ca5b3'}]},
            {featureType:'water',elementType:'geometry',stylers:[{color:'#0e1626'}]},
            {featureType:'poi',elementType:'geometry',stylers:[{color:'#263144'}]},
        ],
        disableDefaultUI: false,
        gestureHandling: 'greedy',
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: true
    });

    _gigsMapMarkers = [];
    _gigsMapInfoWindows = [];
    var today = new Date().toISOString().split('T')[0];

    gigsWithCoords.forEach(function(g, i) {
        var isUpcoming = (g.date||'') >= today;
        var color = isUpcoming ? '#22c55e' : '#818cf8';
        var label = isUpcoming ? '🎤' : '🎸';

        // Custom SVG pin
        var pinSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">'
            + '<path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="' + color + '"/>'
            + '<circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>'
            + '</svg>';

        var marker = new google.maps.Marker({
            position: { lat: g._lat, lng: g._lng },
            map: _gigsMap,
            title: (g.venue||'Venue') + ' — ' + (g.date||''),
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(pinSvg),
                scaledSize: new google.maps.Size(32, 40),
                anchor: new google.maps.Point(16, 40)
            },
            optimized: false
        });

        // Build info window content
        var v = venueLookup[g.venue] || {};
        var mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent((v.address||v.name||g.venue||''));
        var statusBadge = isUpcoming
            ? '<span style="background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700">Upcoming</span>'
            : '<span style="background:rgba(129,140,248,0.2);color:#818cf8;border:1px solid rgba(129,140,248,0.3);border-radius:4px;padding:1px 6px;font-size:11px">Past</span>';

        var infoContent = '<div style="background:#1e293b;color:#e2e8f0;padding:12px 14px;border-radius:10px;min-width:200px;max-width:260px;font-family:-apple-system,sans-serif">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
            + '<strong style="font-size:0.95em;flex:1">' + (g.venue||'Venue') + '</strong>' + statusBadge
            + '</div>'
            + '<div style="font-size:0.8em;color:#94a3b8;margin-bottom:6px">📅 ' + (g.date||'TBD') + (g.startTime?' &nbsp;⏰ '+g.startTime:'') + '</div>'
            + (g.pay ? '<div style="font-size:0.8em;color:#86efac;margin-bottom:4px">💰 ' + g.pay + '</div>' : '')
            + (g.soundPerson ? '<div style="font-size:0.8em;color:#94a3b8;margin-bottom:4px">🔊 ' + g.soundPerson + '</div>' : '')
            + (g.notes ? '<div style="font-size:0.78em;color:#64748b;margin-bottom:8px;border-top:1px solid rgba(255,255,255,0.07);padding-top:6px;margin-top:4px">' + g.notes + '</div>' : '')
            + '<a href="' + mapsUrl + '" target="_blank" style="display:inline-block;background:rgba(129,140,248,0.2);color:#a5b4fc;border:1px solid rgba(129,140,248,0.3);padding:5px 12px;border-radius:6px;font-size:0.78em;text-decoration:none;font-weight:600">🗺 Directions</a>'
            + '</div>';

        var infoWindow = new google.maps.InfoWindow({ content: infoContent });
        _gigsMapInfoWindows.push(infoWindow);

        marker.addListener('click', function() {
            _gigsMapInfoWindows.forEach(function(iw) { iw.close(); });
            infoWindow.open(_gigsMap, marker);
        });

        marker._gigDate = g.date || '';
        marker._isUpcoming = isUpcoming;
        _gigsMapMarkers.push(marker);
    });

    // Fit bounds
    var bounds = new google.maps.LatLngBounds();
    gigsWithCoords.forEach(function(g) { bounds.extend({ lat: g._lat, lng: g._lng }); });
    _gigsMap.fitBounds(bounds);
    if (gigsWithCoords.length === 1) _gigsMap.setZoom(13);

    _gigsMapApplyFilter();
}

function _gigsMapApplyFilter() {
    var f = _gigsMapFilter;
    _gigsMapMarkers.forEach(function(m) {
        var show = f === 'all' || (f === 'upcoming' && m._isUpcoming) || (f === 'past' && !m._isUpcoming);
        m.setVisible(show);
    });
    // close any open info windows when filtering
    _gigsMapInfoWindows.forEach(function(iw) { iw.close(); });
}

function gigsMapSetFilter(f, btn) {
    _gigsMapFilter = f;
    _gigsMapApplyFilter();
    // Update button styles
    ['gmfAll','gmfUpcoming','gmfPast'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.style.background = 'rgba(255,255,255,0.04)';
        if (el) el.style.color = '#64748b';
    });
    if (btn) { btn.style.background = 'rgba(102,126,234,0.2)'; btn.style.color = '#a5b4fc'; }
}


var _gigFilter = 'upcoming'; // 'all' | 'upcoming' | 'past'

function renderGigsPage(el) {
    if (typeof glInjectPageHelpTrigger === 'function') glInjectPageHelpTrigger(el, 'gigs');
    el.innerHTML = `
    <div class="page-header"><h1>🎤 Gigs</h1><p>Past and upcoming shows</p></div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-primary" onclick="addGig()">+ Add Gig</button>
        <div id="gigFilterBar" style="display:flex;gap:4px;margin-left:auto"></div>
    </div>
    <div class="app-card" style="margin-bottom:16px;padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer;user-select:none" onclick="toggleGigsMap()">
            <span style="font-weight:700;font-size:0.9em">🗺 Gig Map</span>
            <div style="display:flex;align-items:center;gap:6px">
                <div id="gmFilterBtns" style="display:none;gap:4px">
                    <button id="gmfAll" onclick="event.stopPropagation();gigsMapSetFilter('all',this)" style="background:rgba(102,126,234,0.2);color:#a5b4fc;border:1px solid rgba(102,126,234,0.3);padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">All</button>
                    <button id="gmfUpcoming" onclick="event.stopPropagation();gigsMapSetFilter('upcoming',this)" style="background:rgba(255,255,255,0.04);color:#64748b;border:1px solid rgba(255,255,255,0.08);padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">Upcoming</button>
                    <button id="gmfPast" onclick="event.stopPropagation();gigsMapSetFilter('past',this)" style="background:rgba(255,255,255,0.04);color:#64748b;border:1px solid rgba(255,255,255,0.08);padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">Past</button>
                </div>
                <span id="gigsMapChevron" style="color:var(--text-dim);font-size:0.8em;transition:transform 0.2s">▼</span>
            </div>
        </div>
        <div id="gigsMapCollapsible" style="display:none">
            <div style="height:1px;background:var(--border)"></div>
            <div id="gigsMapContainer" style="height:320px;background:rgba(0,0,0,0.3)"></div>
        </div>
    </div>
    <div id="gigsList"><div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px">No gigs added yet.</div></div>`;
    loadGigs();
    // Map renders on expand — see toggleGigsMap()
}

var _gigsMapOpen = false;
function toggleGigsMap() {
    var wrap = document.getElementById('gigsMapCollapsible');
    var chev = document.getElementById('gigsMapChevron');
    var filterBtns = document.getElementById('gmFilterBtns');
    if (!wrap) return;
    _gigsMapOpen = !_gigsMapOpen;
    wrap.style.display = _gigsMapOpen ? '' : 'none';
    if (chev) chev.style.transform = _gigsMapOpen ? 'rotate(180deg)' : '';
    if (filterBtns) filterBtns.style.display = _gigsMapOpen ? 'flex' : 'none';
    if (_gigsMapOpen) renderGigsMap();
}
window.toggleGigsMap = toggleGigsMap;

async function gigLaunchLinkedSetlist(setlistIdOrName) {
    if (!requireSignIn()) return;
    var allSl = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var idx = allSl.findIndex(function(sl) { return sl.setlistId === setlistIdOrName; });
    // Legacy fallback: if no ID match, try name (for records before venueId era)
    if (idx < 0) idx = allSl.findIndex(function(sl) { return (sl.name||'') === setlistIdOrName; });
    if (idx < 0) { showToast('Setlist not found'); return; }
    await launchGigMode(idx);
}

async function loadGigs() {
    var rawData = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var el = document.getElementById('gigsList');
    if (!el) return;
    if (typeof GLStore !== 'undefined' && GLStore.setGigsCache) GLStore.setGigsCache(rawData);
    else window._cachedGigs = rawData;
    if (!rawData.length) { el.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px">No gigs added yet.</div>'; return; }
    var data = rawData.map(function(g, origIdx) { return Object.assign({}, g, { _origIdx: origIdx }); });

    // Filter tabs
    var filterBar = document.getElementById('gigFilterBar');
    if (filterBar) {
        filterBar.innerHTML = ['upcoming','all','past'].map(function(f) {
            var active = _gigFilter === f;
            var label = { upcoming: 'Upcoming', all: 'All', past: 'Past' }[f];
            return '<button onclick="_gigFilter=\'' + f + '\';loadGigs()" style="font-size:0.72em;font-weight:' + (active ? '800' : '600') + ';padding:3px 10px;border-radius:6px;cursor:pointer;border:1px solid ' + (active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)') + ';background:' + (active ? 'rgba(99,102,241,0.1)' : 'none') + ';color:' + (active ? '#a5b4fc' : 'var(--text-dim)') + '">' + label + '</button>';
        }).join('');
    }

    // Split + sort
    var upcoming = data.filter(function(g) { return glIsUpcoming(g.date); }).sort(function(a,b) { return (a.date || '').localeCompare(b.date || ''); });
    var past = data.filter(function(g) { return !glIsUpcoming(g.date) && g.date; }).sort(function(a,b) { return (b.date || '').localeCompare(a.date || ''); });
    var noDate = data.filter(function(g) { return !g.date; });

    var html = '';
    if (_gigFilter === 'upcoming' || _gigFilter === 'all') {
        if (upcoming.length > 0) {
            if (_gigFilter === 'all') html += '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:#22c55e;text-transform:uppercase;margin-bottom:6px">Upcoming</div>';
            upcoming.forEach(function(g) { html += _gigRenderCard(g, true); });
        } else if (_gigFilter === 'upcoming') {
            html += '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:0.85em">No upcoming gigs. <button onclick="addGig()" style="background:none;border:none;color:var(--accent-light);cursor:pointer;font-weight:600">Add one →</button></div>';
        }
    }
    if (_gigFilter === 'past' || _gigFilter === 'all') {
        if (past.length > 0) {
            if (_gigFilter === 'all') html += '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;margin:12px 0 6px">Past</div>';
            past.forEach(function(g) { html += _gigRenderCard(g, false); });
        }
    }
    if ((_gigFilter === 'all') && noDate.length > 0) {
        html += '<div style="font-size:0.68em;font-weight:800;letter-spacing:0.12em;color:var(--text-dim);text-transform:uppercase;margin:12px 0 6px">No Date</div>';
        noDate.forEach(function(g) { html += _gigRenderCard(g, true); });
    }
    el.innerHTML = html;
    _gigLoadCoverageSummaries(data);
}

function _gigRenderCard(g, isUpcoming) {
    var idx = g._origIdx;
    var dateDisplay = (typeof glFormatDate === 'function') ? glFormatDate(g.date, true) : (g.date || 'TBD');
    var countdown = (typeof glCountdownLabel === 'function') ? glCountdownLabel(g.date) : '';
    return '<div class="app-card" data-gig-idx="' + idx + '" style="margin-bottom:8px;padding:10px 14px">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
        + '<div style="flex:1">'
        + '<div style="font-weight:700;font-size:0.92em;margin-bottom:2px">' + (g.venue || 'TBD') + '</div>'
        + '<div style="font-size:0.78em;color:var(--text-muted);display:flex;gap:8px;flex-wrap:wrap">'
        + '<span>📅 ' + dateDisplay + (countdown ? ' · ' + countdown : '') + '</span>'
        + (g.startTime ? '<span>⏰ ' + g.startTime + '</span>' : '')
        + (g.pay ? '<span>💰 ' + g.pay + '</span>' : '')
        + '</div></div>'
        + '<div style="display:flex;gap:3px;align-items:center;flex-shrink:0">'
        + _gigAvailabilitySummaryChip(g)
        + '<button class="btn btn-sm btn-ghost" onclick="editGig(' + idx + ')" title="Edit" style="font-size:0.78em">✏️</button>'
        + '<button class="btn btn-sm btn-ghost" onclick="deleteGig(' + idx + ')" title="Delete" style="color:var(--red);font-size:0.78em">🗑️</button>'
        + '</div></div>'
        + (g.notes ? '<div style="font-size:0.78em;color:var(--text-muted);margin-top:4px">' + g.notes + '</div>' : '')
        + ((g.setlistId || g.linkedSetlist) ? '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:0.75em;color:var(--accent-light)">📋 ' + (g.linkedSetlist || 'linked') + '</span>'
            + '<button onclick="gigLaunchLinkedSetlist(\'' + (g.setlistId || '').replace(/'/g,'\\\'') + '\')" style="background:linear-gradient(135deg,#22c55e,#16a34a);border:none;color:white;padding:3px 10px;border-radius:5px;font-size:0.7em;font-weight:700;cursor:pointer">🎤 Go Live</button></div>' : '')
        + _gigRenderAvailability(g)
        + '</div>';
}

async function _gigLoadCoverageSummaries(gigs) {
    if (typeof GLStore === 'undefined' || !GLStore.evaluateGigCoverage) return;
    for (var i = 0; i < gigs.length; i++) {
        var g = gigs[i];
        if (!glIsUpcoming(g.date)) continue; // only for upcoming gigs
        var el = document.getElementById('gigCoverage_' + g._origIdx);
        if (!el) continue;
        try {
            var cov = await GLStore.evaluateGigCoverage(g);
            if (!cov || cov.missingRoles.length === 0) {
                el.innerHTML = '<span style="font-size:0.72em;color:#86efac">✅ All roles covered</span>';
                continue;
            }
            var roles = (GLStore.BAND_ROLES || []);
            var lines = cov.missingRoles.map(function(rid) {
                var role = roles.find(function(r) { return r.id === rid; });
                var label = role ? role.label : rid;
                var bc = cov.backupCoverage[rid];
                if (bc) {
                    var strengthLabel = bc.strength === 'partial' ? ' (partial)' : '';
                    return '<span style="font-size:0.72em;color:#fcd34d">🟡 ' + label + ' → ' + bc.playerName + strengthLabel + '</span>';
                }
                var isCritical = role && role.critical;
                return '<span style="font-size:0.72em;color:' + (isCritical ? '#fca5a5' : '#fcd34d') + '">' + (isCritical ? '🔴' : '🟠') + ' ' + label + ' uncovered</span>';
            });
            var statusChip = { full_core: '✅ Core covered', covered_with_backup: '🟡 Backup needed', partial_risk: '🟠 Partial risk', not_covered: '🔴 Not covered' };
            el.innerHTML = '<div style="font-size:0.72em;font-weight:700;color:var(--text-dim);margin-bottom:4px">' + (statusChip[cov.status] || '') + '</div>'
                + lines.join('<br>');
        } catch(e) {}
    }
}

async function addGig() {
    const el = document.getElementById('gigsList');
    const venues = await GLStore.getVenues();
    var _slData2 = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    if (typeof GLStore !== 'undefined' && GLStore.setSetlistCache) GLStore.setSetlistCache(_slData2);
    else { window._cachedSetlists = _slData2; window._glCachedSetlists = _slData2; }
    window._gigSelectedVenueId = null;
    window._gigSelectedVenueName = null;
    el.innerHTML = `<div class="app-card">
        <h3>🎤 Add New Gig</h3>
        <div class="form-grid">
            <div class="form-row" style="grid-column:1/-1">
                <label class="form-label">Venue</label>
                <div id="gigVenuePicker"></div>
            </div>
            <div class="form-row"><label class="form-label">Date</label><input class="app-input" id="gigDate" type="date"></div>
            <div class="form-row"><label class="form-label">Pay / Guarantee</label><input class="app-input" id="gigPay" placeholder="e.g. $500 + tips"></div>
            <div class="form-row"><label class="form-label">Arrival Time</label><input class="app-input" id="gigArrival" type="time"></div>
            <div class="form-row"><label class="form-label">Soundcheck Time</label><input class="app-input" id="gigSoundcheck" type="time"></div>
            <div class="form-row"><label class="form-label">Start Time</label><input class="app-input" id="gigStartTime" type="time"></div>
            <div class="form-row"><label class="form-label">End Time</label><input class="app-input" id="gigEndTime" type="time"></div>
            <div class="form-row"><label class="form-label">Sound Person</label><input class="app-input" id="gigSound" placeholder="Who's doing sound?"></div>
            <div class="form-row"><label class="form-label">Venue Contact</label><input class="app-input" id="gigContact" placeholder="Booking contact name"></div>
        </div>
        </div>
        <div class="form-row" style="margin-top:10px"><label class="form-label">📋 Linked Setlist</label>
            <select class="app-select" id="gigLinkedSetlist">
                <option value="">-- None --</option>
                ${(window._cachedSetlists||[]).map(sl => `<option value="${sl.setlistId||(sl.name||'').replace(/"/g,'&quot;')}">${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`).join('')}
            </select>
        </div>
        <div class="form-row"><label class="form-label">Notes</label><textarea class="app-textarea" id="gigNotes" placeholder="Parking, load-in door, set length, gear needed…"></textarea></div>
        <div style="display:flex;gap:8px"><button class="btn btn-success" onclick="saveGig()">💾 Save</button><button class="btn btn-ghost" onclick="loadGigs()">Cancel</button></div>
    </div>` + el.innerHTML;
    _gigInitVenuePicker(venues, null);
}

// Shared venue picker initializer for gig add/edit forms
function _gigInitVenuePicker(venues, preselected) {
    window._gigVenueTouched = false;
    function _onVenueSelect(v) {
        window._gigVenueTouched = true;
        if (v) {
            window._gigSelectedVenueId = v.venueId || null;
            window._gigSelectedVenueName = v.name || '';
        } else {
            window._gigSelectedVenueId = null;
            window._gigSelectedVenueName = null;
        }
    }
    function _onCreateNew(text) {
        glVenueCreateModal({
            initialName: text,
            onSave: function(venue) {
                window._gigSelectedVenueId = venue.venueId;
                window._gigSelectedVenueName = venue.name;
                GLStore.getVenues().then(function(v) {
                    if (window._gigVenuePicker) window._gigVenuePicker.refresh(v);
                    if (window._gigVenuePicker) window._gigVenuePicker.setValue(venue.venueId);
                });
            },
            onUseExisting: function(venue) {
                window._gigSelectedVenueId = venue.venueId;
                window._gigSelectedVenueName = venue.name;
                if (window._gigVenuePicker) window._gigVenuePicker.setValue(venue.venueId);
            }
        });
    }
    window._gigVenuePicker = glEntityPicker({
        containerId: 'gigVenuePicker',
        items: venues,
        labelFn: venueShortLabel,
        subLabelFn: function(v) { return v.address || ''; },
        onSelect: _onVenueSelect,
        onCreateNew: _onCreateNew,
        placeholder: 'Search venues...',
        emptyText: 'No venues yet',
        selectedItem: preselected || null
    });
}
// Sync a gig record to calendar_events — match by gigId first, fallback venue+date
async function _syncGigToCalendar(gig, createdKey) {
    if (!gig || !gig.date || !gig.venue) return;
    const calEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    // Match by gigId first (stable), fallback to venue+date (legacy compat)
    var existIdx = -1;
    if (gig.gigId) {
        existIdx = calEvents.findIndex(function(e) { return e.type === 'gig' && e.gigId === gig.gigId; });
    }
    if (existIdx < 0) {
        const matchKey = (gig.venue||'') + '|' + (gig.date||'');
        existIdx = calEvents.findIndex(function(e) { return e.type === 'gig' && ((e.venue||'')+'|'+(e.date||'')) === matchKey; });
    }
    const calRecord = {
        type: 'gig',
        gigId: gig.gigId || null,
        venueId: gig.venueId || null,
        date: gig.date || '',
        title: gig.venue || '',
        time: gig.startTime || '',
        venue: gig.venue || '',
        notes: gig.notes || '',
        linkedSetlist: gig.linkedSetlist || null,
        updated: new Date().toISOString()
    };
    if (existIdx >= 0) {
        calEvents[existIdx] = { ...calEvents[existIdx], ...calRecord };
        // Ensure id exists on existing event
        if (!calEvents[existIdx].id) calEvents[existIdx].id = generateShortId(12);
    } else {
        calRecord.id = generateShortId(12);
        calRecord.created = createdKey || gig.created || new Date().toISOString();
        calEvents.push(calRecord);
    }
    // Store back-ref on gig
    if (!gig.calendarEventId && existIdx >= 0 && calEvents[existIdx].id) {
        gig.calendarEventId = calEvents[existIdx].id;
    } else if (!gig.calendarEventId && existIdx < 0) {
        gig.calendarEventId = calRecord.id;
    }
    await saveBandDataToDrive('_band', 'calendar_events', calEvents);
}

async function saveGig() {
    if (!requireSignIn()) return;
    var selectedSetlistId = document.getElementById('gigLinkedSetlist')?.value || null;
    const gig = {
        gigId:      generateShortId(12),
        venueId:    window._gigSelectedVenueId || null,
        venue:      window._gigSelectedVenueName || '',
        date:       document.getElementById('gigDate')?.value,
        pay:        document.getElementById('gigPay')?.value,
        arrivalTime:   document.getElementById('gigArrival')?.value,
        soundcheckTime:document.getElementById('gigSoundcheck')?.value,
        startTime:  document.getElementById('gigStartTime')?.value,
        endTime:    document.getElementById('gigEndTime')?.value,
        soundPerson:document.getElementById('gigSound')?.value,
        contact:    document.getElementById('gigContact')?.value,
        notes:      document.getElementById('gigNotes')?.value,
        setlistId:  null,
        linkedSetlist: null,
        created: new Date().toISOString()
    };
    if (!gig.venue) { alert('Venue required'); return; }

    // Resolve setlist link by setlistId only
    var allSetlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var linkedSl = null;
    if (selectedSetlistId) {
        linkedSl = allSetlists.find(function(s) { return s.setlistId === selectedSetlistId; });
    }

    if (linkedSl) {
        // Ensure setlist has an ID
        if (!linkedSl.setlistId) linkedSl.setlistId = generateShortId(12);
        gig.setlistId = linkedSl.setlistId;
        gig.linkedSetlist = linkedSl.name || '';
        linkedSl.gigId = gig.gigId;
        await saveBandDataToDrive('_band', 'setlists', allSetlists);
    } else {
        // Auto-create blank setlist for this gig
        var newSl = {
            setlistId: generateShortId(12),
            gigId: gig.gigId,
            name: (gig.venue || 'Gig') + ' ' + (gig.date || ''),
            date: gig.date || '',
            venueId: gig.venueId || null,
            venue: gig.venue || '',
            notes: '',
            sets: [{ name: 'Set 1', songs: [] }],
            created: new Date().toISOString()
        };
        gig.setlistId = newSl.setlistId;
        gig.linkedSetlist = newSl.name;
        allSetlists.push(newSl);
        await saveBandDataToDrive('_band', 'setlists', allSetlists);
    }
    if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
    else { window._cachedSetlists = null; window._glCachedSetlists = null; }

    const existing = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    existing.push(gig);
    await saveBandDataToDrive('_band', 'gigs', existing);
    // Sync to calendar as a gig event
    await _syncGigToCalendar(gig, null);
    showToast('✅ Gig saved!');
    loadGigs();
}

// ============================================================================
// SEED DATA — removed. All data already imported into live Firebase.
// seedGigData() was a one-time static import. Data now lives in the app.
// ============================================================================
function seedGigData() { console.log('Seed data removed — all data is in Firebase.'); }

// ── Gig history loader (app.js 15256–15285) ─────────────────────────────────────

async function loadGigHistory() {
    if (window._gigHistory) return window._gigHistory;
    try {
        const gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        const setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        const history = {};
        setlists.forEach(sl => {
            (sl.sets || []).forEach((set, si) => {
                (set.songs || []).forEach((song, songIdx) => {
                    const title = typeof song === 'string' ? song : song.title;
                    if (!title) return;
                    if (!history[title]) history[title] = [];
                    const isOpener = songIdx === 0;
                    const isCloser = songIdx === (set.songs.length - 1);
                    const setName = set.name || ('Set ' + (si+1));
                    const isEncore = setName.toLowerCase().includes('encore');
                    let position = 'middle';
                    if (isEncore) position = 'encore';
                    else if (isOpener) position = 'opener';
                    else if (isCloser) position = 'closer';
                    history[title].push({ date: sl.date || '', venue: sl.venue || sl.name || '', position, set: setName });
                });
            });
        });
        // Sort each song's history by date descending
        Object.values(history).forEach(arr => arr.sort((a,b) => (b.date||'').localeCompare(a.date||'')));
        window._gigHistory = history;
        return history;
    } catch(e) { console.log('Gig history load error:', e); return {}; }
}

// ── Live Gig Mode state + functions + Gig Payouts (app.js 18808–19296) ──────────

var _gmSetlist = null;       // full setlist object
var _gmFlatList = [];        // [{title, setName, segue}]
var _gmPlayedSet = null;     // Set of played indices
var _gmOverlayBuilt = false;

// ── Launch from setlist card ─────────────────────────────────────────────────
async function launchGigMode(setlistIdx) {
    if (!requireSignIn()) return;
    var data = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var sl = data[setlistIdx];
    if (!sl) { showToast('Setlist not found'); return; }
    openGigMode(sl);
}

function openGigMode(setlistObj) {
    _gmSetlist = setlistObj;
    _gmFlatList = [];
    _gmPlayedSet = new Set();
    (setlistObj.sets || []).forEach(function(set, si) {
        (set.songs || []).forEach(function(sg) {
            var title = typeof sg === 'string' ? sg : sg.title;
            var segue = typeof sg === 'object' ? (sg.segue || 'stop') : 'stop';
            _gmFlatList.push({ title: title, setName: set.name || ('Set '+(si+1)), segue: segue });
        });
    });
    if (!_gmFlatList.length) { showToast('No songs in setlist'); return; }

    // Load into Practice Mode's rmQueue
    rmQueue = _gmFlatList.map(function(item) {
        var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === item.title; });
        return { title: item.title, band: songData ? (songData.band || '') : '' };
    });
    rmIndex = 0;

    _gmEnsureOverlay();
    _gmRenderNav();
    _gmShow();
    // Reset to chart tab (gig mode should always open on chart)
    if (typeof rmSwitchTab === 'function') {
        var chartBtn = document.querySelector('#gmOverlay .rm-tab[data-tab="chart"]');
        rmSwitchTab('chart', chartBtn);
    }
    rmLoadChart();
}

function gmOpenPocket() {
    var cur = _gmFlatList[rmIndex];
    if (!cur) return;
    var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === cur.title; });
    var bpm = (songData && songData.bpm) ? parseInt(songData.bpm) : (typeof rmSongBpm !== 'undefined' ? rmSongBpm : 120);
    if (typeof openGigPocketMeter === 'function') {
        openGigPocketMeter(cur.title, bpm, null, typeof bandPath === 'function' ? bandPath() : null);
    } else {
        if (typeof showToast === 'function') showToast('\u26a0\ufe0f Pocket Meter not loaded yet');
    }
}

function closeGigMode() {
    var ov = document.getElementById('gmOverlay');
    if (ov) ov.classList.remove('gm-visible');
    // Keep styles intact — removing them breaks reopening since _gmEnsureOverlay
    // skips if the DOM node exists. Styles are idempotent (id-based).
    if (typeof closeGigPocketMeter === 'function') closeGigPocketMeter();
    var scrollY = document.body.dataset.scrollY || '0';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    window.scrollTo(0, parseInt(scrollY));
    if (typeof rmStopCountOff === 'function') rmStopCountOff();
    if (typeof rmScrollTimer !== 'undefined' && rmScrollTimer) { clearInterval(rmScrollTimer); rmScrollTimer = null; }
}

function _gmShow() {
    var ov = document.getElementById('gmOverlay');
    if (!ov) return;
    ov.classList.add('gm-visible');
    document.body.dataset.scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + window.scrollY + 'px';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
}

// ── Navigation ───────────────────────────────────────────────────────────────
// Capture Moment
function rmCaptureMoment() {
    var songTitle = (typeof rmQueue !== 'undefined' && rmQueue[rmIndex]) ? rmQueue[rmIndex].title : '';
    if (!songTitle) { showToast('No song loaded'); return; }
    var existing = document.getElementById('rmCapturePopup');
    if (existing) { existing.remove(); return; }
    var popup = document.createElement('div');
    popup.id = 'rmCapturePopup';
    popup.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;background:#1e293b;border:1px solid rgba(102,126,234,0.3);border-radius:14px;padding:14px;z-index:4000;box-shadow:0 8px 32px rgba(0,0,0,0.6)';
    popup.innerHTML = '<div style="font-size:0.78em;font-weight:700;color:#818cf8;margin-bottom:4px">\uD83D\uDCDD Quick Note — ' + songTitle + '</div><div style="font-size:0.65em;color:var(--text-dim);margin-bottom:8px">Saved to this song\'s detail page under Moments</div>';
    popup.innerHTML += '<textarea id="rmCaptureText" class="app-textarea" placeholder="What just happened? (e.g. “Hit the intro landing perfectly” or “Section C still shaky”)" style="height:70px;font-size:0.85em;margin-bottom:8px"></textarea>';
    popup.innerHTML += '<div style="display:flex;gap:8px">';
    popup.innerHTML += '<button onclick="rmCaptureSave()" style="background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.4);color:#a5b4fc;padding:6px 14px;border-radius:8px;font-size:0.85em;font-weight:700;cursor:pointer;flex:1">💾 Save Note</button>';
    popup.innerHTML += '<button onclick="rmCaptureCancel()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:6px 14px;border-radius:8px;font-size:0.85em;cursor:pointer">Cancel</button>';
    popup.innerHTML += '</div>';
    document.body.appendChild(popup);
    var ta = document.getElementById('rmCaptureText');
    if (ta) setTimeout(function(){ta.focus();}, 80);
}

function rmCaptureCancel() { document.getElementById('rmCapturePopup')?.remove(); }

async function rmCaptureSave() {
    var ta = document.getElementById('rmCaptureText');
    var text = ta ? ta.value.trim() : '';
    if (!text) { showToast('Write something first!'); return; }
    var songTitle = (typeof rmQueue !== 'undefined' && rmQueue[rmIndex]) ? rmQueue[rmIndex].title : '';
    if (!songTitle) { showToast('No song loaded'); return; }
    var ts = new Date().toISOString();
    var note = { text: text, ts: ts, by: currentUserEmail || 'me', mode: 'rehearsal' };
    // Try Firebase first, fall back to localStorage (no auth gate — rehearsal must not be blocked)
    var saved = false;
    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
        try {
            var path = bandPath('songs/' + sanitizeFirebasePath(songTitle) + '/moments');
            await firebaseDB.ref(path).push(note);
            saved = true;
        } catch(e) {}
    }
    if (!saved) {
        var key = 'deadcetera_moments_' + songTitle;
        var arr = JSON.parse(localStorage.getItem(key)||'[]');
        arr.push(note);
        localStorage.setItem(key, JSON.stringify(arr));
    }
    showToast(saved ? '📸 Note saved' : '📸 Saved locally (will sync later)');
    document.getElementById('rmCapturePopup')?.remove();
}

function gmNavigate(dir) {
    var n = rmIndex + dir;
    if (n < 0 || n >= _gmFlatList.length) return;
    rmIndex = n;
    _gmRenderNav();
    // Always show chart tab when navigating songs
    if (typeof rmSwitchTab === 'function') {
        var chartBtn = document.querySelector('#gmOverlay .rm-tab[data-tab="chart"]');
        rmSwitchTab('chart', chartBtn);
    }
    if (typeof rmLoadChart === 'function') rmLoadChart();
    // Update pocket meter target BPM for new song
    var cur = _gmFlatList[rmIndex];
    if (cur && typeof _gigPocketMeterInstance !== 'undefined' && _gigPocketMeterInstance) {
        var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === cur.title; });
        var bpm = (songData && songData.bpm) ? parseInt(songData.bpm) : 120;
        _gigPocketMeterInstance.setTargetBPM(bpm);
        var titleEl = document.getElementById('gigPocketSongTitle');
        if (titleEl) titleEl.textContent = cur.title;
    }
    // Reload other tabs if open
    if (typeof rmCurrentTab !== 'undefined' && rmCurrentTab !== 'chart') {
        if (rmCurrentTab === 'know' && typeof rmLoadKnow === 'function') rmLoadKnow();
        if (rmCurrentTab === 'memory' && typeof rmLoadMemory === 'function') rmLoadMemory();
        if (rmCurrentTab === 'harmony' && typeof rmLoadHarmony === 'function') rmLoadHarmony();
    }
}

function gmMarkPlayed() {
    var idx = rmIndex;
    if (_gmPlayedSet.has(idx)) {
        _gmPlayedSet.delete(idx);
    } else {
        _gmPlayedSet.add(idx);
    }
    _gmRenderNav();
    _gmRefreshDrawerIfOpen();
}

function _gmRenderNav() {
    var bar = document.getElementById('gmNavBar');
    if (!bar) return;
    var prev = _gmFlatList[rmIndex - 1] || null;
    var cur  = _gmFlatList[rmIndex] || null;
    var next = _gmFlatList[rmIndex + 1] || null;
    var total = _gmFlatList.length;
    var played = _gmPlayedSet ? _gmPlayedSet.size : 0;
    var isPlayed = _gmPlayedSet && _gmPlayedSet.has(rmIndex);
    var segueIcon = { stop:'', flow:' →', segue:' ~', cutoff:' |' };

    // Close button (left)
    var closeBtn = '<button onclick="closeGigMode()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;width:28px;height:28px;min-width:28px;border-radius:6px;font-size:0.85em;cursor:pointer">✕</button>';

    // Prev song
    var prevHTML = prev
        ? '<button onclick="gmNavigate(-1)" style="flex:1;min-width:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:3px 6px;cursor:pointer;text-align:left;overflow:hidden">'
          + '<div style="font-size:0.55em;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">PREV</div>'
          + '<div style="font-size:0.72em;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + prev.title + '</div></button>'
        : '<div style="flex:1"></div>';

    // Current song — song name + action buttons on one compact row
    var curHTML = '<div style="flex:2;min-width:0;text-align:center;padding:0 4px">'
        + '<div style="font-size:0.78em;font-weight:800;color:' + (isPlayed?'#475569':'#f1f5f9') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' + (isPlayed?'text-decoration:line-through;':'') + '">' + (cur ? cur.title : '') + '</div>'
        + '<div style="font-size:0.55em;color:#64748b;margin:1px 0 3px">' + (rmIndex+1) + ' / ' + total + ' • ' + played + ' played</div>'
        + '<div style="display:flex;gap:4px;justify-content:center">'
        + '<button onclick="gmMarkPlayed()" style="font-size:0.6em;padding:2px 8px;border-radius:8px;border:1px solid;cursor:pointer;font-weight:700;'
        + (isPlayed ? 'background:rgba(255,255,255,0.05);border-color:rgba(255,255,255,0.1);color:#64748b' : 'background:rgba(34,197,94,0.15);border-color:rgba(34,197,94,0.3);color:#22c55e')
        + '">' + (isPlayed ? '↩ Unmark' : '✓ Played') + '</button>'
        + '<button onclick="gmToggleDrawer()" style="font-size:0.6em;padding:2px 8px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#94a3b8;cursor:pointer;font-weight:700">▲ Setlist</button>'
        + '<button onclick="gmOpenPocket()" style="font-size:0.6em;padding:2px 8px;border-radius:8px;border:1px solid rgba(0,170,85,0.35);background:rgba(0,255,136,0.08);color:#00cc66;cursor:pointer;font-weight:700">&#127903; Pocket</button>'
        + '</div></div>';

    // Next song
    var nextHTML = next
        ? '<button onclick="gmNavigate(1)" style="flex:1;min-width:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:6px;padding:3px 6px;cursor:pointer;text-align:right;overflow:hidden">'
          + '<div style="font-size:0.55em;color:#475569;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">NEXT' + (segueIcon[cur?cur.segue:'stop']||'') + '</div>'
          + '<div style="font-size:0.72em;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + next.title + '</div></button>'
        : '<div style="flex:1"></div>';

    bar.innerHTML = closeBtn + prevHTML + curHTML + nextHTML;

    // Also sync the rmOverlay song title / position
    var rmTitle = document.getElementById('rmSongTitle');
    if (rmTitle && cur) rmTitle.textContent = cur.title;
    var rmPos = document.getElementById('rmPosition');
    if (rmPos) rmPos.textContent = (rmIndex+1) + ' / ' + total;
    // Update Now Playing bar
    _gmUpdateNowPlaying(cur);
}

// ── Setlist drawer ────────────────────────────────────────────────────────────
var _gmDrawerOpen = false;
function gmToggleDrawer() {
    _gmDrawerOpen = !_gmDrawerOpen;
    var drawer = document.getElementById('gmDrawer');
    var backdrop = document.getElementById('gmDrawerBackdrop');
    if (!drawer) return;
    if (_gmDrawerOpen) {
        _gmRenderDrawer();
        drawer.style.transform = 'translateY(0)';
        backdrop.style.display = 'block';
    } else {
        drawer.style.transform = 'translateY(100%)';
        backdrop.style.display = 'none';
    }
}
function gmCloseDrawer() {
    _gmDrawerOpen = false;
    var drawer = document.getElementById('gmDrawer');
    var backdrop = document.getElementById('gmDrawerBackdrop');
    if (drawer) drawer.style.transform = 'translateY(100%)';
    if (backdrop) backdrop.style.display = 'none';
}
function _gmRefreshDrawerIfOpen() { if (_gmDrawerOpen) _gmRenderDrawer(); }

function _gmRenderDrawer() {
    var list = document.getElementById('gmDrawerList');
    if (!list) return;
    var html = '';
    var lastSet = '';
    _gmFlatList.forEach(function(item, idx) {
        if (item.setName !== lastSet) {
            html += '<div style="font-size:0.68em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;padding:10px 16px 4px">'
                + item.setName + '</div>';
            lastSet = item.setName;
        }
        var isCur = idx === rmIndex;
        var isPlayed = _gmPlayedSet && _gmPlayedSet.has(idx);
        var segArr = { stop:'', flow:' \u2192', segue:' ~', cutoff:' |' }[item.segue] || '';
        html += '<div onclick="gmJumpTo(' + idx + ')" style="display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;'
            + (isCur ? 'background:rgba(102,126,234,0.15);border-left:3px solid #667eea;' : 'border-left:3px solid transparent;')
            + '">'
            + '<span style="font-size:0.72em;color:#64748b;min-width:22px;text-align:right">' + (idx+1) + '</span>'
            + '<span style="flex:1;font-size:0.92em;font-weight:' + (isCur?'700':'400') + ';color:' + (isCur?'#f1f5f9':isPlayed?'#475569':'#94a3b8') + ';' + (isPlayed&&!isCur?'text-decoration:line-through':'') + '">'
            + item.title + '</span>'
            + (segArr ? '<span style="font-size:0.72em;color:#818cf8">' + segArr + '</span>' : '')
            + (isPlayed ? '<span style="color:#22c55e;font-size:0.85em">\u2713</span>' : '')
            + '</div>';
    });
    list.innerHTML = html;
    // Scroll current song into view
    var els = list.querySelectorAll('[onclick]');
    if (els[rmIndex]) els[rmIndex].scrollIntoView({ block: 'nearest' });
}

function gmJumpTo(idx) {
    rmIndex = idx;
    _gmRenderNav();
    if (typeof rmLoadChart === 'function') rmLoadChart();
    gmCloseDrawer();
}

// ── Overlay build ─────────────────────────────────────────────────────────────
function _gmUpdateNowPlaying(cur) {
    var bar = document.getElementById('gmNowPlayingBar');
    if (!bar || !cur) return;
    var songData = (typeof allSongs !== 'undefined' ? allSongs : []).find(function(s) { return s.title === cur.title; });
    var key = songData && songData.key ? songData.key : '';
    var bpm = songData && songData.bpm ? songData.bpm : '';
    var chips = '';
    if (key) chips += '<span style="background:rgba(102,126,234,0.25);color:#a5b4fc;border-radius:6px;padding:2px 8px;font-size:0.72em;font-weight:700">' + key + '</span>';
    if (bpm) chips += '<span style="background:rgba(34,197,94,0.2);color:#86efac;border-radius:6px;padding:2px 8px;font-size:0.72em;font-weight:700">🥁 ' + bpm + ' BPM</span>';
    bar.innerHTML = '<div style="display:flex;align-items:center;gap:8px;overflow:hidden">';
    bar.innerHTML += '<span style="font-size:0.65em;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;flex-shrink:0">NOW</span>';
    bar.innerHTML += '<span style="font-weight:700;font-size:0.88em;color:#f1f5f9;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">' + cur.title + '</span>';
    if (chips) bar.innerHTML += '<div style="display:flex;gap:4px;flex-shrink:0">' + chips + '</div>';
    bar.innerHTML += '</div>';
}

function _gmEnsureOverlay() {
    if (document.getElementById('gmOverlay')) return;

    var style = document.createElement('style');
    style.id = 'gm-injected-style';
    style.textContent = [
        '#gmOverlay{display:none;position:fixed;inset:0;z-index:3000;background:#0a0f1e;flex-direction:column;overflow:hidden}',
        '#gmOverlay.gm-visible{display:flex!important}',
        '#gmNavBar{display:flex;align-items:center;gap:4px;padding:3px 6px;background:linear-gradient(135deg,#0f172a,#060d1a);border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;min-height:40px}',
        '#gmNowPlayingBar{display:none}',  // removed — key/BPM shown in nav bar meta
        '#gmDrawer{position:fixed;bottom:0;left:0;right:0;z-index:3100;background:#111827;border-radius:16px 16px 0 0;border-top:1px solid rgba(102,126,234,0.25);max-height:65vh;transform:translateY(100%);transition:transform 0.28s cubic-bezier(.32,.72,0,1);overflow-y:auto}',
        '#gmDrawerBackdrop{display:none;position:fixed;inset:0;z-index:3050;background:rgba(0,0,0,0.5)}',
        // Reuse rmOverlay styles but inside gmOverlay — remap panels
        '#gmOverlay .rm-header{display:none}', // hide rm header, we have gmNavBar
        '#gmOverlay #rmTabBar{flex-shrink:0}',
        '#gmOverlay #rmBody{flex:1;overflow:hidden}',
        '#gmOverlay .rm-footer{flex-shrink:0}',
        '#gmOverlay .rm-panel.active{display:block}',
        // Hide non-essential tabs in gig mode (Know/Mem/Listen stay but are accessible; we hide tab buttons for space)
        '#gmOverlay .rm-tab[data-tab="know"],#gmOverlay .rm-tab[data-tab="memory"],#gmOverlay .rm-tab[data-tab="harmony"]{display:none}',
        // Hide YouTube and Moises footer buttons in gig mode
        '#gmOverlay .rm-footer .rm-action-btn:nth-child(1),#gmOverlay .rm-footer .rm-action-btn:nth-child(2){display:none}',
        // FAB stack — monkey, capture, utility all right-side, evenly spaced, same size
        'body > .rm-monkey-float{position:fixed!important;bottom:186px!important;right:12px!important;width:36px!important;height:36px!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important;z-index:3500!important;border-radius:8px!important}',
        '#rmCaptureMomentBtn{bottom:142px!important;right:12px!important;width:36px!important;height:36px!important}',
        '#gmPocketMinimized{position:fixed!important;bottom:98px!important;right:12px!important;width:36px!important;height:36px!important;z-index:3500!important}'
    ].join('\n');
    document.head.appendChild(style);

    var ov = document.createElement('div');
    ov.id = 'gmOverlay';

    // Single compact nav bar — close button + prev/song/next all in one row
    var navBar = document.createElement('div');
    navBar.id = 'gmNavBar';
    ov.appendChild(navBar);

    // Hijack the rmOverlay DOM — move it inside gmOverlay
    // We use rmEnsureOverlay() to build the standard overlay, then reparent its innards
    if (typeof rmEnsureOverlay === 'function') rmEnsureOverlay();
    var rmOv = document.getElementById('rmOverlay');
    if (rmOv) {
        // Extract rmTabBar, rmBody, rm-footer and append to gmOverlay
        var tabBar = document.getElementById('rmTabBar');
        var body   = document.getElementById('rmBody');
        var footer = rmOv.querySelector('.rm-footer');
        var sheets = rmOv.querySelectorAll('.rm-sheet');
        var monkey = document.getElementById('rmMonkeyBtn');
        if (tabBar)  ov.appendChild(tabBar);
        if (body)    ov.appendChild(body);
        if (footer)  ov.appendChild(footer);
        // Capture Moment floating button — appended to body so position:fixed works
        var capBtn = document.createElement('button');
        capBtn.id = 'rmCaptureMomentBtn';
        capBtn.innerHTML = '\uD83D\uDCDD';
        capBtn.title = 'Quick Note — saves to this song\'s detail page';
        capBtn.onclick = rmCaptureMoment;
        capBtn.style.cssText = 'position:fixed;bottom:74px;right:14px;width:44px;height:44px;border-radius:50%;background:rgba(102,126,234,0.25);border:1.5px solid rgba(102,126,234,0.5);color:#a5b4fc;font-size:1.2em;cursor:pointer;z-index:3500;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,0.4)';
        document.body.appendChild(capBtn);
        sheets.forEach(function(s) { ov.appendChild(s); });
        // Monkey button — reparent to document.body so position:fixed works.
        // Inside gmOverlay (position:fixed flex container) it loses viewport anchoring.
        // The rm-monkey-float CSS class handles positioning — just move it to body.
        if (monkey) {
            document.body.appendChild(monkey);
            monkey.style.removeProperty('display');
        }
        // Remove the now-empty rmOverlay shell (we'll rebuild from scratch next time practice mode opens)
        rmOv.remove();
        // Mark rmOverlay as gone so rmEnsureOverlay rebuilds it when practice mode is opened normally
        window._rmOverlayReparented = true;
    }

    // Setlist drawer + backdrop
    var backdrop = document.createElement('div');
    backdrop.id = 'gmDrawerBackdrop';
    backdrop.onclick = gmCloseDrawer;
    document.body.appendChild(backdrop);

    var drawer = document.createElement('div');
    drawer.id = 'gmDrawer';
    drawer.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px 8px;border-bottom:1px solid rgba(255,255,255,0.06)">'
        + '<span style="font-size:0.85em;font-weight:700;color:#f1f5f9">\uD83C\uDFB5 Setlist</span>'
        + '<button onclick="gmCloseDrawer()" style="background:none;border:none;color:#64748b;font-size:1em;cursor:pointer">\u2715</button></div>'
        + '<div id="gmDrawerList"></div>';
    document.body.appendChild(drawer);

    document.body.appendChild(ov);
    _gmOverlayBuilt = true;

    // Keyboard nav
    document.addEventListener('keydown', function(e) {
        var ov2 = document.getElementById('gmOverlay');
        if (!ov2 || !ov2.classList.contains('gm-visible')) return;
        if (e.key === 'Escape') { if (_gmDrawerOpen) gmCloseDrawer(); else closeGigMode(); e.preventDefault(); }
        if (e.key === 'ArrowRight' && !rmEditing) { gmNavigate(1); e.preventDefault(); }
        if (e.key === 'ArrowLeft'  && !rmEditing) { gmNavigate(-1); e.preventDefault(); }
    });

    // Touch swipe on gig overlay
    var swipeStartX = 0;
    ov.addEventListener('touchstart', function(e) { swipeStartX = e.touches[0].clientX; }, { passive: true });
    ov.addEventListener('touchend', function(e) {
        var dx = e.changedTouches[0].clientX - swipeStartX;
        if (Math.abs(dx) > 60 && !rmEditing) gmNavigate(dx < 0 ? 1 : -1);
    }, { passive: true });
}

console.log('\uD83C\uDFA4 Live Gig Mode loaded');

// ============================================================================
// GIG PAYOUTS & EXPENSES
// ============================================================================

async function loadGigPayouts(gigIdx) {
    var data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var gig = data[gigIdx];
    if (!gig) return;
    var container = document.getElementById('gigsList');
    if (!container) return;
    var expenses = gig.expenses || [];
    var guarantee = parseFloat(gig.guarantee) || 0;
    var totalExp = expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var net = guarantee - totalExp;
    var memberCount = Object.keys(bandMembers||{}).length || 5;
    var perMember = net > 0 ? net / memberCount : 0;

    var memberRows = Object.entries(bandMembers||{}).map(function(kv) {
        var key=kv[0], m=kv[1];
        var custom=(gig.memberSplit||{})[key];
        var amt = custom !== undefined ? custom : perMember;
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
            + '<span style="min-width:22px">'+(m.emoji||'\uD83C\uDFB8')+'</span>'
            + '<span style="flex:1;font-size:0.85em;color:#e2e8f0;font-weight:500">'+m.name+'</span>'
            + '<span style="font-size:0.85em;font-weight:700;color:#22c55e">$'+amt.toFixed(2)+'</span>'
            + '</div>';
    }).join('');

    container.innerHTML = '<div class="app-card">'
        + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">'
        + '<h3 style="flex:1;margin:0">\uD83D\uDCB0 Payout \u2014 '+(gig.venue||'Gig')+'</h3>'
        + '<button class="btn btn-sm btn-ghost" onclick="loadGigs()">\u2715 Close</button></div>'
        + '<div class="form-row" style="margin-bottom:10px"><label class="form-label">Guarantee / Door ($)</label>'
        + '<input class="app-input" id="gpGuarantee" type="number" min="0" step="0.01" value="'+guarantee+'" placeholder="0.00"></div>'
        + '<div style="margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<label class="form-label" style="margin:0">Expenses</label>'
        + '<button class="btn btn-sm btn-ghost" onclick="gpAddExpense('+gigIdx+')">+ Add</button></div>'
        + '<div id="gpExpenseList">'+gpRenderExpenses(expenses, gigIdx)+'</div></div>'
        + '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:14px;margin-bottom:12px">'
        + '<div style="display:flex;justify-content:space-between;font-size:0.85em;margin-bottom:4px"><span style="color:#94a3b8">Guarantee</span><span style="color:#f1f5f9;font-weight:600">$'+guarantee.toFixed(2)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:0.85em;margin-bottom:4px"><span style="color:#94a3b8">Expenses</span><span style="color:#f87171;font-weight:600">-$'+totalExp.toFixed(2)+'</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-size:0.95em;font-weight:700;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px;margin-top:4px"><span style="color:#f1f5f9">Net</span><span style="color:#22c55e">$'+net.toFixed(2)+'</span></div></div>'
        + '<div style="margin-bottom:14px"><div style="font-size:0.72em;font-weight:700;color:#64748b;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px">Per-Member Split ('+memberCount+' members)</div>'
        + memberRows+'</div>'
        + '<div style="display:flex;gap:8px"><button class="btn btn-success" onclick="gpSave('+gigIdx+')">&#x1F4BE; Save</button>'
        + '<button class="btn btn-ghost" onclick="loadGigs()">Cancel</button></div>'
        + '</div>';
}

function gpRenderExpenses(expenses, gigIdx) {
    if (!expenses.length) return '<div style="color:#64748b;font-size:0.82em;padding:8px 0">No expenses yet</div>';
    return expenses.map(function(e, i) {
        return '<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04)">'
            + '<input class="app-input" style="flex:2;font-size:0.82em;padding:5px 8px" placeholder="Description" value="'+(e.desc||'').replace(/"/g,'&quot;')+'" id="gpExpDesc_'+i+'">'
            + '<input class="app-input" style="flex:1;font-size:0.82em;padding:5px 8px" type="number" min="0" step="0.01" placeholder="$0" value="'+(e.amount||'')+'" id="gpExpAmt_'+i+'">'
            + '<button class="btn btn-sm btn-ghost" onclick="gpRemoveExpense('+gigIdx+','+i+')" style="color:#f87171;flex-shrink:0">\u2715</button>'
            + '</div>';
    }).join('');
}

function gpReadExpensesFromDOM(existing) {
    return existing.map(function(_, i) {
        return {
            desc: document.getElementById('gpExpDesc_'+i)?.value || '',
            amount: parseFloat(document.getElementById('gpExpAmt_'+i)?.value) || 0
        };
    });
}

async function gpAddExpense(gigIdx) {
    var data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    if (!data[gigIdx]) return;
    data[gigIdx].guarantee = parseFloat(document.getElementById('gpGuarantee')?.value) || 0;
    data[gigIdx].expenses = gpReadExpensesFromDOM(data[gigIdx].expenses || []);
    data[gigIdx].expenses.push({ desc: '', amount: 0 });
    await saveBandDataToDrive('_band', 'gigs', data);
    loadGigPayouts(gigIdx);
}

async function gpRemoveExpense(gigIdx, idx) {
    var data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    if (!data[gigIdx]) return;
    data[gigIdx].guarantee = parseFloat(document.getElementById('gpGuarantee')?.value) || 0;
    data[gigIdx].expenses = gpReadExpensesFromDOM(data[gigIdx].expenses || []);
    data[gigIdx].expenses.splice(idx, 1);
    await saveBandDataToDrive('_band', 'gigs', data);
    loadGigPayouts(gigIdx);
}

async function gpSave(gigIdx) {
    var data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    if (!data[gigIdx]) return;
    data[gigIdx].guarantee = parseFloat(document.getElementById('gpGuarantee')?.value) || 0;
    data[gigIdx].expenses = gpReadExpensesFromDOM(data[gigIdx].expenses || []);
    var totalExp = data[gigIdx].expenses.reduce(function(a,e){ return a+(parseFloat(e.amount)||0); }, 0);
    var net = data[gigIdx].guarantee - totalExp;
    var memberCount = Object.keys(bandMembers||{}).length || 5;
    var perMember = net > 0 ? net/memberCount : 0;
    data[gigIdx].netPayout = net;
    data[gigIdx].memberSplit = {};
    Object.keys(bandMembers||{}).forEach(function(k){ data[gigIdx].memberSplit[k] = perMember; });
    await saveBandDataToDrive('_band', 'gigs', data);
    showToast('\uD83D\uDCB0 Payout saved!');
    loadGigs();
}


// ══════════════════════════════════════════════════════════════════════════════
// GIG AVAILABILITY / RSVP — Phase 1+2: UX refinement + role-aware gaps
// ══════════════════════════════════════════════════════════════════════════════

// Normalize role strings to canonical instrument categories
function _gigNormalizeRole(role) {
    if (!role) return 'other';
    var r = role.toLowerCase();
    if (r.indexOf('drum') > -1 || r.indexOf('percussion') > -1) return 'drums';
    if (r.indexOf('bass') > -1) return 'bass';
    if (r.indexOf('key') > -1 || r.indexOf('piano') > -1 || r.indexOf('organ') > -1) return 'keys';
    if (r.indexOf('guitar') > -1) return 'guitar';
    if (r.indexOf('vocal') > -1 || r.indexOf('singer') > -1) return 'vocals';
    return 'other';
}

var _gigRoleLabels = { drums: 'Drums', bass: 'Bass', keys: 'Keys', guitar: 'Guitar', vocals: 'Vocals', other: 'Other' };
var _gigRoleEmoji = { drums: '🥁', bass: '🎸', keys: '🎹', guitar: '🎸', vocals: '🎤', other: '👤' };

// Compute availability stats + role gaps for a gig
function _gigComputeAvailability(gig) {
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var avail = gig.availability || {};
    var total = members.length;
    var yesCount = 0, maybeCount = 0, noCount = 0, awaitingCount = 0;
    var roleStatus = {}; // { drums: 'yes'|'maybe'|'no'|'awaiting' }

    members.forEach(function(key) {
        var mKey = (typeof key === 'object') ? key.key : key;
        var a = avail[mKey];
        var status = a ? a.status : null;
        if (status === 'yes') yesCount++;
        else if (status === 'maybe') maybeCount++;
        else if (status === 'no') noCount++;
        else awaitingCount++;

        var role = bm[mKey] ? _gigNormalizeRole(bm[mKey].role) : 'other';
        var existing = roleStatus[role];
        // Best status for each role: yes > maybe > no > awaiting
        var priority = { yes: 3, maybe: 2, no: 1 };
        var curPri = priority[status] || 0;
        var existPri = existing ? (priority[existing] || 0) : -1;
        if (curPri > existPri) roleStatus[role] = status || 'awaiting';
    });

    // Identify missing/uncertain roles (exclude 'other')
    var missingRoles = [];
    var maybeRoles = [];
    Object.keys(roleStatus).forEach(function(role) {
        if (role === 'other') return;
        if (roleStatus[role] === 'no' || roleStatus[role] === 'awaiting') missingRoles.push(role);
        else if (roleStatus[role] === 'maybe') maybeRoles.push(role);
    });

    var coreRolesCovered = missingRoles.length === 0 && maybeRoles.length === 0;

    return {
        total: total, yesCount: yesCount, maybeCount: maybeCount, noCount: noCount, awaitingCount: awaitingCount,
        missingRoles: missingRoles, maybeRoles: maybeRoles, coreRolesCovered: coreRolesCovered, roleStatus: roleStatus
    };
}

// Header chip — priority: critical gap > under-covered > covered
function _gigAvailabilitySummaryChip(gig) {
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    if (!members.length) return '';
    var s = _gigComputeAvailability(gig);
    if (s.yesCount === 0 && s.maybeCount === 0 && s.noCount === 0) return ''; // no responses

    // Priority 1: critical role missing
    if (s.missingRoles.length > 0) {
        var roleLabel = s.missingRoles.map(function(r) { return _gigRoleLabels[r] || r; }).join(', ');
        return '<span style="font-size:0.62em;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(239,68,68,0.12);color:#fca5a5;border:1px solid rgba(239,68,68,0.25)">⚠️ Missing ' + roleLabel + '</span>';
    }
    // Priority 2: maybe roles (uncertain)
    if (s.maybeRoles.length > 0) {
        return '<span style="font-size:0.62em;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(245,158,11,0.12);color:#fcd34d;border:1px solid rgba(245,158,11,0.25)">👥 ' + s.yesCount + ' confirmed · ' + s.maybeCount + ' maybe</span>';
    }
    // Priority 3: covered
    if (s.coreRolesCovered && s.yesCount === s.total) {
        return '<span style="font-size:0.62em;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(34,197,94,0.12);color:#86efac;border:1px solid rgba(34,197,94,0.25)">✅ Full lineup</span>';
    }
    if (s.coreRolesCovered) {
        return '<span style="font-size:0.62em;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(34,197,94,0.1);color:#86efac;border:1px solid rgba(34,197,94,0.2)">✅ Core covered</span>';
    }
    return '<span style="font-size:0.62em;font-weight:700;padding:2px 8px;border-radius:6px;background:rgba(245,158,11,0.1);color:#fcd34d;border:1px solid rgba(245,158,11,0.2)">👥 ' + s.yesCount + ' confirmed</span>';
}

// Full availability section — collapsible based on gig date
function _gigRenderAvailability(gig) {
    var members = (typeof BAND_MEMBERS_ORDERED !== 'undefined') ? BAND_MEMBERS_ORDERED : [];
    if (!members.length) return '';
    var bm = (typeof bandMembers !== 'undefined') ? bandMembers : {};
    var avail = gig.availability || {};
    var myKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    var gigIdx = gig._origIdx;
    var s = _gigComputeAvailability(gig);
    var isUpcoming = (typeof glIsUpcoming === 'function') ? glIsUpcoming(gig.date) : (gig.date >= new Date().toISOString().split('T')[0]);

    // Summary line: "3 confirmed · 1 maybe · 1 awaiting"
    var summaryParts = [];
    if (s.yesCount > 0) summaryParts.push(s.yesCount + ' confirmed');
    if (s.maybeCount > 0) summaryParts.push(s.maybeCount + ' maybe');
    if (s.awaitingCount > 0) summaryParts.push(s.awaitingCount + ' awaiting');
    if (s.noCount > 0) summaryParts.push(s.noCount + ' out');
    var summaryText = summaryParts.length > 0 ? summaryParts.join(' · ') : 'No responses yet';

    // Role gap alerts
    var roleAlerts = '';
    if (s.missingRoles.length > 0) {
        roleAlerts = s.missingRoles.map(function(r) {
            return '<span style="font-size:0.72em;color:#fca5a5">⚠️ Missing ' + (_gigRoleLabels[r] || r) + '</span>';
        }).join(' ');
    } else if (s.maybeRoles.length > 0) {
        roleAlerts = s.maybeRoles.map(function(r) {
            return '<span style="font-size:0.72em;color:#fcd34d">❓ ' + (_gigRoleLabels[r] || r) + ' uncertain</span>';
        }).join(' ');
    } else if (s.yesCount > 0) {
        roleAlerts = '<span style="font-size:0.72em;color:#86efac">✅ Core lineup covered</span>';
    }

    // Backup coverage placeholder (populated async after render)
    var coverageHtml = isUpcoming ? '<div id="gigCoverage_' + gigIdx + '" style="margin-top:6px"></div>' : '';

    // Wrap in collapsible: upcoming=open, past=closed
    var detailId = 'gigAvail_' + gigIdx;
    var html = '<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06)">';

    // Always-visible summary + RSVP buttons
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;cursor:pointer" onclick="var d=document.getElementById(\'' + detailId + '\');if(d)d.open=!d.open">'
        + '<span style="font-size:0.78em;font-weight:700;color:var(--text)">👥 Band Availability</span>'
        + '<span style="font-size:0.7em;color:var(--text-dim)">' + summaryText + '</span>'
        + '</div>';
    if (roleAlerts) html += '<div style="margin-top:4px;display:flex;gap:8px;flex-wrap:wrap">' + roleAlerts + '</div>';
    html += coverageHtml;

    // My RSVP — compact if already voted, full if not; finalized for past gigs
    if (myKey && isUpcoming) {
        var myStatus = avail[myKey] ? avail[myKey].status : null;
        if (myStatus) {
            // Compact post-vote state
            var voteLabels = { yes: '✅ You\'re In', maybe: '❓ Maybe', no: '❌ Out' };
            var voteColors = { yes: '#22c55e', maybe: '#f59e0b', no: '#ef4444' };
            html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
                + '<span style="font-size:0.78em;font-weight:700;color:' + (voteColors[myStatus] || 'var(--text-dim)') + '">' + (voteLabels[myStatus] || myStatus) + '</span>'
                + '<button onclick="event.stopPropagation();_gigShowFullRsvp(' + gigIdx + ')" style="font-size:0.65em;padding:2px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:none;color:var(--text-dim);cursor:pointer">Change</button>'
                + '</div>';
            // Hidden full RSVP (revealed by Change button)
            html += '<div id="gigFullRsvp_' + gigIdx + '" style="display:none;margin-top:4px">';
        } else {
            // No vote yet — show full buttons
            html += '<div style="margin-top:6px">';
        }
        html += '<div style="display:flex;gap:6px">';
        ['yes', 'maybe', 'no'].forEach(function(st) {
            var labels = { yes: "I'm In", maybe: 'Maybe', no: 'Out' };
            var colors = { yes: '34,197,94', maybe: '245,158,11', no: '239,68,68' };
            var active = myStatus === st;
            html += '<button onclick="event.stopPropagation();gigSetAvailability(' + gigIdx + ',\'' + st + '\')" style="flex:1;padding:5px;border-radius:6px;font-size:0.75em;font-weight:' + (active ? '800' : '600') + ';cursor:pointer;border:' + (active ? '2px' : '1px') + ' solid rgba(' + colors[st] + ',' + (active ? '0.6' : '0.2') + ');background:rgba(' + colors[st] + ',' + (active ? '0.15' : '0.04') + ');color:rgba(' + colors[st] + ',1);min-height:34px">' + labels[st] + '</button>';
        });
        html += '</div></div>';
    } else if (!isUpcoming) {
        // Past gig — show finalized attendance summary only
        var myStatus = myKey && avail[myKey] ? avail[myKey].status : null;
        if (s.yesCount > 0 || s.noCount > 0 || s.maybeCount > 0) {
            html += '<div style="font-size:0.72em;color:var(--text-dim);margin-top:4px">Final: ' + summaryText + (myStatus ? ' · You: ' + ({ yes:'In', maybe:'Maybe', no:'Out' }[myStatus] || myStatus) : '') + '</div>';
        }
    }

    // Collapsible member list
    html += '<details id="' + detailId + '"' + (isUpcoming ? ' open' : '') + ' style="margin-top:8px">'
        + '<summary style="font-size:0.68em;color:var(--text-dim);cursor:pointer;padding:4px 0">Member details</summary>';

    members.forEach(function(memberRef) {
        var mKey = (typeof memberRef === 'object') ? memberRef.key : memberRef;
        var name = bm[mKey] ? bm[mKey].name : mKey;
        var role = bm[mKey] ? (bm[mKey].role || '') : '';
        var normalizedRole = _gigNormalizeRole(role);
        var emoji = _gigRoleEmoji[normalizedRole] || '👤';
        var a = avail[mKey];
        var status = a ? a.status : null;
        var icon = status === 'yes' ? '✅' : status === 'maybe' ? '❓' : status === 'no' ? '❌' : '⏳';
        var label = status === 'yes' ? 'Confirmed' : status === 'maybe' ? 'Maybe' : status === 'no' ? 'Out' : 'No response';
        var statusColor = status === 'yes' ? '#22c55e' : status === 'maybe' ? '#f59e0b' : status === 'no' ? '#ef4444' : '#64748b';
        var isMe = mKey === myKey;

        html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:0.8em' + (isMe ? ';font-weight:700' : '') + '">'
            + '<span style="min-width:16px">' + emoji + '</span>'
            + '<span style="flex:1;color:var(--text)">' + name + (isMe ? ' (you)' : '') + '</span>'
            + '<span style="font-size:0.72em;color:var(--text-dim)">' + role + '</span>'
            + '<span style="font-size:0.82em;color:' + statusColor + '">' + icon + ' ' + label + '</span>'
            + '</div>';
    });

    html += '</details></div>';
    return html;
}

window._gigShowFullRsvp = function(gigIdx) {
    var el = document.getElementById('gigFullRsvp_' + gigIdx);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

window.gigSetAvailability = async function(gigIdx, status) {
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return;
    try {
        var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        var gig = gigs[gigIdx];
        if (!gig) return;
        if (!gig.availability) gig.availability = {};
        gig.availability[memberKey] = { status: status, updatedAt: new Date().toISOString() };
        await saveBandDataToDrive('_band', 'gigs', gigs);
        if (typeof showToast === 'function') showToast(status === 'yes' ? "You're in!" : status === 'maybe' ? 'Marked as maybe' : 'Marked as out');
        loadGigs(); // refresh
    } catch(e) {
        if (typeof showToast === 'function') showToast('Failed to update availability');
    }
};

// ── Expose all onclick-referenced functions to window ─────────────────────────
// async function declarations in non-strict scripts may not auto-bind to window
// in all browsers (Safari). Explicit assignment ensures onclick handlers work.
window.deleteGig = deleteGig;
window.editGig = editGig;
window.saveGigEdit = saveGigEdit;
window.gigLaunchLinkedSetlist = gigLaunchLinkedSetlist;
window.loadGigs = loadGigs;
window.addGig = addGig;
window.saveGig = saveGig;
window.launchGigMode = launchGigMode;
window.openGigMode = openGigMode;
window.closeGigMode = closeGigMode;
window.gmNavigate = gmNavigate;
window.gmMarkPlayed = gmMarkPlayed;
window.rmCaptureSave = rmCaptureSave;
window.rmCaptureCancel = rmCaptureCancel;
window.gigsMapSetFilter = gigsMapSetFilter;
window.renderGigsPage = renderGigsPage;
window.loadGigHistory = loadGigHistory;

console.log('✅ gigs.js loaded');
