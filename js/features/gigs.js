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

// Audit M14 (2026-05-04): every persistent write to bands/{slug}/gigs must
// also refresh GLStore's gigsCache. Otherwise getGigs() returns the stale
// pre-write array until the next page navigation reloads the cache from
// Firebase, and downstream consumers (rails, intelligence) act on outdated
// state. Route every gig save through this helper to keep cache + Drive in
// lockstep. Non-fatal if GLStore is unavailable (e.g. early bootstrap).
async function _saveGigsAndInvalidate(arr) {
    var safe = Array.isArray(arr) ? arr : [];
    await saveBandDataToDrive('_band', 'gigs', safe);
    try {
        if (typeof GLStore !== 'undefined' && GLStore.setGigsCache) {
            GLStore.setGigsCache(safe);
        }
    } catch (_e) { /* non-fatal */ }
}

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

// Cascade-delete a gig everywhere it lives. A gig fans out into 3 Firebase
// nodes — _band/gigs (the Gigs page), _band/calendar_events (the Calendar
// page), _band/setlists (auto-created on save). Pre-cascade, deleting from
// any one node left orphans on the others; D2/D3 in bug_queue.md.
//
// Setlist preservation rule: only delete the linked setlist if it's still
// in its auto-created blank state (one set named "Set 1", zero songs, no
// notes). User-edited setlists get their gigId back-ref nulled and survive.
//
// Idempotent: safe to call after one of the rows has already been removed
// (the per-node filter is a no-op in that case). Returns a summary so
// callers can build a useful toast.
async function _cascadeDeleteGig(gig) {
    var summary = { gig: false, calendarEvent: false, setlist: false, setlistKept: null };
    if (!gig) return summary;

    // 1. _band/gigs — match by gigId, fallback venue+date for legacy rows.
    try {
        var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        var gBefore = gigs.length;
        gigs = gigs.filter(function(g) {
            if (gig.gigId && g.gigId === gig.gigId) return false;
            if (!gig.gigId && g.date === gig.date && g.venue === gig.venue) return false;
            return true;
        });
        if (gigs.length !== gBefore) {
            await _saveGigsAndInvalidate(gigs);
            summary.gig = true;
        }
    } catch(e) { console.warn('[Cascade] gigs delete failed:', e && e.message); }

    // 2. _band/calendar_events — only the gig-typed row, matched by gigId.
    //    Falls back to venue+date so legacy rows pre-gigId still cascade.
    try {
        var cal = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
        var cBefore = cal.length;
        cal = cal.filter(function(e) {
            if (e.type !== 'gig') return true;
            if (gig.gigId && e.gigId === gig.gigId) return false;
            if (!gig.gigId && e.date === gig.date && e.venue === gig.venue) return false;
            return true;
        });
        if (cal.length !== cBefore) {
            await saveBandDataToDrive('_band', 'calendar_events', cal);
            summary.calendarEvent = true;
        }
    } catch(e) { console.warn('[Cascade] calendar_events delete failed:', e && e.message); }

    // 3. _band/setlists — only the auto-created blank one. If the band added
    //    songs we keep the setlist and just unlink the back-ref.
    if (gig.setlistId) {
        try {
            var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
            var sIdx = setlists.findIndex(function(s) { return s.setlistId === gig.setlistId; });
            if (sIdx >= 0) {
                var sl = setlists[sIdx];
                var untouched = Array.isArray(sl.sets)
                    && sl.sets.length === 1
                    && (sl.sets[0].name === 'Set 1' || !sl.sets[0].name)
                    && (sl.sets[0].songs || []).length === 0
                    && !sl.notes
                    && sl.gigId === gig.gigId;
                if (untouched) {
                    setlists.splice(sIdx, 1);
                    summary.setlist = true;
                } else {
                    if (sl.gigId === gig.gigId) sl.gigId = null;
                    summary.setlistKept = sl.name || sl.setlistId;
                }
                await saveBandDataToDrive('_band', 'setlists', setlists);
                if (typeof GLStore !== 'undefined' && GLStore.clearSetlistCache) GLStore.clearSetlistCache();
                else { window._cachedSetlists = null; window._glCachedSetlists = null; }
            }
        } catch(e) { console.warn('[Cascade] setlists delete failed:', e && e.message); }
    }
    return summary;
}

async function deleteGig(idx) {
    if (!requireSignIn()) return;
    if (!confirm('Delete this gig? This cannot be undone.')) return;
    const raw = (typeof GLStore !== 'undefined' && GLStore.getGigs().length) ? GLStore.getGigs() : toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    const gig = raw[idx];
    if (!gig) { if (typeof showToast === 'function') showToast('Gig not found'); return; }
    var sum = await _cascadeDeleteGig(gig);
    // Build a specific receipt so the user sees exactly what was cleaned up.
    var parts = [];
    if (sum.gig) parts.push('gig');
    if (sum.calendarEvent) parts.push('calendar entry');
    if (sum.setlist) parts.push('blank setlist');
    if (sum.setlistKept) parts.push('setlist "' + sum.setlistKept + '" kept (had content)');
    if (typeof showToast === 'function') {
        showToast('🗑️ ' + (parts.length ? 'Removed: ' + parts.join(', ') : 'Gig deleted'));
    }
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
                <span class="form-label">Venue</span>
                <div id="gigVenuePicker"></div>
            </div>
            <div class="form-row"><span class="form-label">Date</span><input class="app-input" id="gigDate" type="date" value="${g.date||''}"></div>
            <div class="form-row"><span class="form-label">Pay / Guarantee</span><input class="app-input" id="gigPay" value="${(g.pay||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><span class="form-label">Arrival Time</span><input class="app-input" id="gigArrival" type="time" value="${g.arrivalTime||''}"></div>
            <div class="form-row"><span class="form-label">Soundcheck Time</span><input class="app-input" id="gigSoundcheck" type="time" value="${g.soundcheckTime||''}"></div>
            <div class="form-row"><span class="form-label">Start Time</span><input class="app-input" id="gigStartTime" type="time" value="${g.startTime||''}"></div>
            <div class="form-row"><span class="form-label">End Time</span><input class="app-input" id="gigEndTime" type="time" value="${g.endTime||''}"></div>
            <div class="form-row"><span class="form-label">Sound Person</span><input class="app-input" id="gigSound" value="${(g.soundPerson||'').replace(/"/g,'&quot;')}"></div>
            <div class="form-row"><span class="form-label">Venue Contact</span><input class="app-input" id="gigContact" value="${(g.contact||'').replace(/"/g,'&quot;')}"></div>
        </div>
        <div class="form-row" style="margin-top:10px"><span class="form-label">📋 Linked Setlist</span>
            <select class="app-select" id="gigLinkedSetlist">
                <option value="">-- None --</option>
                ${(window._cachedSetlists||[]).map(sl => `<option value="${sl.setlistId||''}" ${sl.setlistId&&g.setlistId===sl.setlistId?'selected':''}>${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`).join('')}
            </select>
        </div>
        <div class="form-row"><span class="form-label">Notes</span><textarea class="app-textarea" id="gigNotes">${g.notes||''}</textarea></div>
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

    var newDate = document.getElementById('gigDate')?.value;
    var newStartTime = document.getElementById('gigStartTime')?.value;
    var newEndTime = document.getElementById('gigEndTime')?.value;
    var newVenue = window._gigVenueTouched ? (window._gigSelectedVenueName || '') : (prev.venue || '');

    // Detect critical changes that invalidate RSVPs
    var criticalChange = false;
    var changeReasons = [];
    if (newDate && newDate !== prev.date) { criticalChange = true; changeReasons.push('date changed'); }
    if (newStartTime && newStartTime !== prev.startTime) { criticalChange = true; changeReasons.push('start time changed'); }
    if (newEndTime && newEndTime !== prev.endTime) { criticalChange = true; changeReasons.push('end time changed'); }
    if (newVenue !== (prev.venue || '')) { criticalChange = true; changeReasons.push('venue changed'); }

    gigData[idx] = {
        ...prev,
        gigId:         prev.gigId || generateShortId(12),
        venueId:       window._gigVenueTouched ? (window._gigSelectedVenueId || null) : (prev.venueId || null),
        venue:         newVenue,
        date:          newDate,
        pay:           document.getElementById('gigPay')?.value,
        arrivalTime:   document.getElementById('gigArrival')?.value,
        soundcheckTime:document.getElementById('gigSoundcheck')?.value,
        startTime:     newStartTime,
        endTime:       newEndTime,
        soundPerson:   document.getElementById('gigSound')?.value,
        contact:       document.getElementById('gigContact')?.value,
        notes:         document.getElementById('gigNotes')?.value,
        updated: new Date().toISOString()
    };

    // Build human-friendly change label
    var staleLabel = '';
    if (criticalChange) {
        var hasDate = changeReasons.some(function(r) { return r.match(/date/); });
        var hasTime = changeReasons.some(function(r) { return r.match(/time/); });
        var hasVenue = changeReasons.some(function(r) { return r.match(/venue/); });
        staleLabel = hasDate && hasVenue ? 'Date and location changed'
            : hasDate ? 'Date changed' : hasTime && hasVenue ? 'Time and location changed'
            : hasTime ? 'Time changed' : hasVenue ? 'Location changed' : 'Details changed';
    }

    // Mark RSVPs as stale if critical fields changed
    if (criticalChange && gigData[idx].availability) {

        Object.keys(gigData[idx].availability).forEach(function(k) {
            var a = gigData[idx].availability[k];
            if (a && a.status) {
                a.stale = true;
                a.staleReason = staleLabel;
                a.staleAt = new Date().toISOString();
            }
        });
        gigData[idx]._lastCriticalChange = { fields: changeReasons, at: new Date().toISOString(), by: currentUserEmail || '' };

        // Post notification to band feed
        _postEventChangeNotification('gig', gigData[idx].venue || 'Gig', staleLabel);
    }

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

    await _saveGigsAndInvalidate(gigData);
    // Sync updated gig to calendar
    await _syncGigToCalendar(gigData[idx], gigData[idx].created || null);

    // Audit H9 (2026-05-04): UPDATE cascade symmetry. Calendar-authored gigs
    // store the googleEventId on the cal_event row, NOT on gigs.sync. The
    // legacy "Google Calendar sync" branch below only fires when prev.sync
    // .externalEventId is set on the gig record — meaning calendar-authored
    // gigs whose date/venue moved would never PATCH Google. Now we mark the
    // cal_event row 'dirty' on every critical change so Phase 1 of the next
    // sync picks it up. Idempotent — already-dirty rows stay dirty.
    if (criticalChange) {
        try {
            var _calEvts = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
            var _calIdx = _calEvts.findIndex(function(e) {
                return e && e.type === 'gig' && e.gigId === gigData[idx].gigId;
            });
            if (_calIdx >= 0 && _calEvts[_calIdx].googleEventId) {
                _calEvts[_calIdx].syncStatus = 'dirty';
                _calEvts[_calIdx].sync = _calEvts[_calIdx].sync || {};
                _calEvts[_calIdx].sync.status = 'dirty';
                _calEvts[_calIdx].updated_at = new Date().toISOString();
                await saveBandDataToDrive('_band', 'calendar_events', _calEvts);
            }
        } catch(e) { console.warn('[Gigs] H9 dirty-mark failed:', e && e.message); }
    }

    // Google Calendar sync — auto-update if previously synced
    if (criticalChange && prev.sync && prev.sync.externalEventId && typeof GLCalendarSync !== 'undefined') {
        try {
            var _gcalResult = await GLCalendarSync.update(prev.sync.externalEventId, gigData[idx]);
            if (_gcalResult.success) {
                gigData[idx].sync = Object.assign({}, prev.sync, { status: 'synced', lastSyncedAt: _gcalResult.lastSyncedAt, etag: _gcalResult.etag });
            } else {
                gigData[idx].sync = Object.assign({}, prev.sync, { status: 'error' });
            }
            await _saveGigsAndInvalidate(gigData);
        } catch(e) {
            gigData[idx].sync = Object.assign({}, prev.sync, { status: 'error' });
            await _saveGigsAndInvalidate(gigData);
        }
    } else if (criticalChange && prev.sync && prev.sync.externalEventId) {
        // Sync exists but GLCalendarSync not loaded — mark needs_update
        gigData[idx].sync = Object.assign({}, prev.sync, { status: 'needs_update' });
        await _saveGigsAndInvalidate(gigData);
    }

    if (criticalChange) {
        var syncMsg = gigData[idx].sync && gigData[idx].sync.status === 'synced' ? ' Google Calendar updated.' : '';
        showToast('\u2705 Gig updated \u2014 ' + staleLabel.toLowerCase() + '.' + syncMsg);
    } else {
        showToast('\u2705 Gig updated!');
    }
    // Preserve scroll position by re-anchoring on the saved gig's gigId after
    // the list re-renders (sort may have shifted indices). data-gig-id is the
    // stable key \u2014 data-gig-idx changes if dates re-sort the array.
    var savedGigId = gigData[idx].gigId;
    await loadGigs();
    if (savedGigId) {
        var row = document.querySelector('[data-gig-id="' + savedGigId + '"]');
        if (row) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
}

// ── Gig map state + Gig page + Gig CRUD (app.js 11867–12335) ────────────────────

var _gigsMap = null;
var _gigsMapMarkers = []; // all markers (gigs + homes); each has _isHome/_isBandmate/_isUpcoming flags
var _gigsMapInfoWindows = []; // legacy ref kept for back-compat with _gigsMapApplyFilter close-all
var _gigsMapFilter = 'all'; // 'all' | 'upcoming' | 'past' (gig pins only)
var _gigsMapShowBandmateHomes = false; // toggle, persisted in localStorage
var _gigsMapHoverCloseTimer = null;
var _gigsMapGeocoder = null;
var _glGeocodeCache = null;
// Tracks Google Geocoding API errors during the current renderGigsMap pass.
// REQUEST_DENIED almost always means "API not enabled in Cloud Console" —
// the empty-state guard at the bottom of renderGigsMap surfaces this as a
// clear banner instead of the misleading "No gigs to plot yet" message.
var _gigsMapDeniedCount = 0;
var _gigsMapLastDenialAddr = '';

// Google Maps Map ID — required by google.maps.marker.AdvancedMarkerElement
// (the modern replacement for the soft-deprecated google.maps.Marker). The
// Map ID also references a Cloud-Console-defined Map Style; setting `mapId`
// makes the inline `styles:` option a no-op (the two are mutually exclusive).
//
// SETUP (one-time, Cloud Console):
//   1. Go to https://console.cloud.google.com/google/maps-apis/studio/maps
//      (Google Maps Platform → Map Styles)
//   2. Create a new Map Style. Choose "Dark" or import the JSON from
//      specs/gl_view_map.md "Gig Map dark style" section to match the prior
//      slate/navy theme exactly.
//   3. Associate the style with a new Map ID (e.g. "gl-gig-map-dark").
//   4. Paste that Map ID here in place of 'DEMO_MAP_ID'.
//
// Until the custom Map ID is configured, DEMO_MAP_ID renders the map in
// Google's default light theme. Markers + InfoWindows work; only the
// underlying map style is generic.
var _GIGS_MAP_ID = 'DEMO_MAP_ID';

try { _gigsMapShowBandmateHomes = localStorage.getItem('gl_gig_map_show_bandmates') === '1'; } catch (_e) {}

// Geocode helper — Maps Geocoding API w/ localStorage cache so we don't
// re-pay for the same address across map re-opens. Issue #46.
function _gigsMapLoadCache() {
    if (_glGeocodeCache !== null) return _glGeocodeCache;
    try { _glGeocodeCache = JSON.parse(localStorage.getItem('gl_geocode_cache_v1') || '{}'); }
    catch (_e) { _glGeocodeCache = {}; }
    return _glGeocodeCache;
}
function _gigsMapSaveCache() {
    if (!_glGeocodeCache) return;
    try { localStorage.setItem('gl_geocode_cache_v1', JSON.stringify(_glGeocodeCache)); } catch (_e) {}
}
async function _gigsMapGeocode(addr) {
    if (!addr || !String(addr).trim()) return null;
    var key = String(addr).trim().toLowerCase();
    var cache = _gigsMapLoadCache();
    if (cache[key]) return cache[key];
    if (!window.google || !google.maps || !google.maps.Geocoder) return null;
    if (!_gigsMapGeocoder) _gigsMapGeocoder = new google.maps.Geocoder();
    return new Promise(function(resolve) {
        _gigsMapGeocoder.geocode({ address: addr }, function(results, status) {
            if (status === 'OK' && results && results[0]) {
                var loc = results[0].geometry.location;
                var entry = { lat: loc.lat(), lng: loc.lng() };
                cache[key] = entry;
                _gigsMapSaveCache();
                resolve(entry);
            } else {
                // Don't negative-cache — if user fixes a typo, we want to retry.
                if (status === 'REQUEST_DENIED') {
                    _gigsMapDeniedCount++;
                    _gigsMapLastDenialAddr = addr;
                }
                if (status !== 'OK') console.warn('[GigMap] geocode', status, 'for', addr);
                resolve(null);
            }
        });
    });
}

// Hover vs click content split (issue #47 follow-up). Hover shows a compact
// preview (no interactive buttons — they were unclickable since mouseout
// closed the window). Click swaps to full content and PINS the window so
// users can actually press Directions / read details. Same InfoWindow per
// marker; we just call .setContent() to swap between hover and click states.
//
// AdvancedMarkerElement migration (2026-05-23): the marker itself is no
// longer a Map overlay with custom events — it wraps a regular HTMLElement
// (`marker.content`). Hover events attach to that DOM element directly;
// click still uses the marker's `addListener('click', ...)` wrapper (which
// internally routes to the `gmp-click` event for backwards compatibility).
function _gigsMapWireMarker(marker, infoWindow, hoverContent, clickContent) {
    marker._infoWindow = infoWindow;
    marker._hoverContent = hoverContent || clickContent;
    marker._clickContent = clickContent || hoverContent;
    var contentEl = marker.content; // HTMLElement on AdvancedMarkerElement
    if (contentEl && contentEl.addEventListener) {
        contentEl.addEventListener('mouseenter', function() {
            if (_gigsMapHoverCloseTimer) { clearTimeout(_gigsMapHoverCloseTimer); _gigsMapHoverCloseTimer = null; }
            if (marker._pinned) return;
            _gigsMapMarkers.forEach(function(m) {
                if (!m._pinned && m._infoWindow) m._infoWindow.close();
            });
            infoWindow.setContent(marker._hoverContent);
            infoWindow.open({ anchor: marker, map: _gigsMap });
        });
        contentEl.addEventListener('mouseleave', function() {
            if (marker._pinned) return;
            if (_gigsMapHoverCloseTimer) clearTimeout(_gigsMapHoverCloseTimer);
            _gigsMapHoverCloseTimer = setTimeout(function() {
                if (!marker._pinned) infoWindow.close();
            }, 250);
        });
    }
    marker.addListener('click', function() {
        _gigsMapMarkers.forEach(function(m) {
            if (m === marker) return;
            m._pinned = false;
            if (m._infoWindow) m._infoWindow.close();
        });
        marker._pinned = true;
        infoWindow.setContent(marker._clickContent);
        infoWindow.open({ anchor: marker, map: _gigsMap });
    });
}

// AdvancedMarkerElement requires `content` as an HTMLElement (not a data URL).
// These builders return a positioned <div> wrapping the SVG so the marker can
// be hover/click-targeted via DOM events. The anchor point (where the pin
// "touches" the lat/lng) is set via CSS transform so it matches the prior
// `anchor: new google.maps.Point(...)` behavior of legacy Marker.
function _gigsMapPinElement(color) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'cursor:pointer;transform:translate(-50%, -100%);width:32px;height:40px';
    wrapper.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40" style="display:block">'
        + '<path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="' + color + '"/>'
        + '<circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>'
        + '</svg>';
    return wrapper;
}
function _gigsMapHomePinElement(color, isSelf) {
    var size = isSelf ? 34 : 28;
    var inner = isSelf ? '#fff' : '#fef3c7';
    var wrapper = document.createElement('div');
    // Home pins are centered on lat/lng (anchor was at center, not bottom).
    wrapper.style.cssText = 'cursor:pointer;transform:translate(-50%, -50%);width:' + size + 'px;height:' + size + 'px';
    wrapper.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 32 32" style="display:block">'
        + '<circle cx="16" cy="16" r="14" fill="' + color + '" stroke="#0f172a" stroke-width="2"/>'
        + '<path d="M16 8 L24 16 L22 16 L22 22 L18 22 L18 18 L14 18 L14 22 L10 22 L10 16 L8 16 Z" fill="' + inner + '"/>'
        + '</svg>';
    return wrapper;
}

// Legacy data-URL builders — kept in case anything off-screen still calls
// them. New AdvancedMarkerElement paths use the *Element builders above.
function _gigsMapPinSvg(color) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">'
        + '<path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="' + color + '"/>'
        + '<circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>'
        + '</svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}
function _gigsMapHomePinSvg(color, isSelf) {
    var size = isSelf ? 34 : 28;
    var inner = isSelf ? '#fff' : '#fef3c7';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 32 32">'
        + '<circle cx="16" cy="16" r="14" fill="' + color + '" stroke="#0f172a" stroke-width="2"/>'
        + '<path d="M16 8 L24 16 L22 16 L22 22 L18 22 L18 18 L14 18 L14 22 L10 22 L10 16 L8 16 Z" fill="' + inner + '"/>'
        + '</svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

async function renderGigsMap() {
    var el = document.getElementById('gigsMapContainer');
    if (!el) return;

    el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);font-size:0.88em">Loading map…</div>';

    // Reset Geocoding denial telemetry for this render pass. If every geocode
    // comes back REQUEST_DENIED we surface a clear banner instead of the
    // misleading "No gigs to plot yet" empty state.
    _gigsMapDeniedCount = 0;
    _gigsMapLastDenialAddr = '';

    var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var venues = toArray(await loadBandDataFromDrive('_band', 'venues') || []);

    // Track original venue array index for leaf-write Firebase backfill below.
    venues.forEach(function(v, i) { v._idx = i; });

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

    // (Issue #46) BACKFILL missing venue coords via Geocoding API. Bug #16
    // silently dropped lat/lng on Places-autofilled venues until 2026-05-22;
    // existing venues have address text but no coords. We geocode each one,
    // cache locally, and write back to Firebase via leaf-path .set() so we
    // don't clobber siblings (per project_setlist_swr_clobber_bug discipline).
    var backfillCount = 0;
    var venuesNeedingCoords = venues.filter(function(v) {
        return !(v.lat && v.lng) && (v.address || v.name);
    });
    for (var bi = 0; bi < venuesNeedingCoords.length; bi++) {
        var vbf = venuesNeedingCoords[bi];
        var coords = await _gigsMapGeocode(vbf.address || vbf.name);
        if (coords) {
            vbf.lat = coords.lat;
            vbf.lng = coords.lng;
            backfillCount++;
            try {
                if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function' && typeof vbf._idx === 'number') {
                    firebaseDB.ref(bandPath('venues/' + vbf._idx + '/lat')).set(coords.lat);
                    firebaseDB.ref(bandPath('venues/' + vbf._idx + '/lng')).set(coords.lng);
                }
            } catch (_e) {}
        }
    }
    if (backfillCount > 0) console.log('[GigMap] backfilled coords for', backfillCount, 'venues');

    // Build venue lookups — venueId primary, name fallback
    var venueByIdLookup = {};
    var venueByNameLookup = {};
    venues.forEach(function(v) {
        if (v.venueId) venueByIdLookup[v.venueId] = v;
        if (v.name) venueByNameLookup[v.name] = v;
    });

    // (Issue #47 follow-up) GROUP gigs by venue identity so we render ONE pin
    // per venue with all the dates we've played there, instead of stacking
    // duplicate pins at the same coordinates for repeat venues.
    //
    // Group key: lowercased venue name (matches gigs that share a venue even
    // when one has venueId set and the other only has venue text). Each group
    // tries: (1) a resolved venue record's lat/lng, (2) the venue's address
    // geocoded, (3) the venue NAME itself geocoded as a free-text search.
    // Step (3) is the load-bearing addition — it rescues past gigs whose
    // venue field was never added to the venues table (Drew, 2026-05-23:
    // "I am missing all of the other gigs we have had").
    var venueGroups = {}; // key → { name, address, venue, gigs[] }
    gigs.forEach(function(g) {
        var v = (g.venueId && venueByIdLookup[g.venueId]) || venueByNameLookup[g.venue] || null;
        var displayName = (v && v.name) || g.venue || '';
        if (!displayName) return; // can't group a gig with no venue identity
        var key = displayName.trim().toLowerCase();
        if (!venueGroups[key]) {
            venueGroups[key] = {
                name: displayName,
                address: (v && v.address) || '',
                venue: v || null,
                gigs: []
            };
        }
        venueGroups[key].gigs.push(g);
    });

    var gigGroupsForRender = [];
    var freeTextGeocodeCount = 0;
    var groupKeys = Object.keys(venueGroups);
    for (var gki = 0; gki < groupKeys.length; gki++) {
        var grp = venueGroups[groupKeys[gki]];
        var lat = null, lng = null;
        if (grp.venue && grp.venue.lat && grp.venue.lng) {
            lat = parseFloat(grp.venue.lat); lng = parseFloat(grp.venue.lng);
        } else if (grp.address) {
            var geoAddr = await _gigsMapGeocode(grp.address);
            if (geoAddr) { lat = geoAddr.lat; lng = geoAddr.lng; }
        }
        // Fallback: geocode the venue NAME as a free-text Google search.
        // Google Maps Geocoding handles "Southern Roots Tavern" reasonably
        // well — usually within a few hundred meters of the actual venue.
        if (!lat || !lng) {
            var geoName = await _gigsMapGeocode(grp.name);
            if (geoName) { lat = geoName.lat; lng = geoName.lng; freeTextGeocodeCount++; }
        }
        if (!lat || !lng) continue; // truly unresolvable
        grp._lat = lat; grp._lng = lng;
        gigGroupsForRender.push(grp);
    }
    if (freeTextGeocodeCount > 0) console.log('[GigMap] resolved', freeTextGeocodeCount, 'venue(s) by free-text name geocode (no venue record / no address)');

    // (Issue #46) HOME markers — signed-in user + opted-in bandmates (toggle).
    // Member key from localStorage; member records read from `bandMembers`
    // (global, hydrated from bands/{slug}/meta/members). homeAddress stored
    // as text at members/{key}/homeAddress; lat/lng lazily geocoded + written
    // back to leaf paths to avoid clobber.
    var currentMemberKey = (function() {
        try { return localStorage.getItem('deadcetera_current_user') || ''; } catch (_e) { return ''; }
    })();
    var homePoints = []; // { key, member, isSelf, lat, lng }
    if (typeof bandMembers !== 'undefined' && bandMembers) {
        var memberKeys = Object.keys(bandMembers);
        for (var mi = 0; mi < memberKeys.length; mi++) {
            var mkey = memberKeys[mi];
            var m = bandMembers[mkey];
            if (!m || !m.homeAddress) continue;
            var isSelf = (mkey === currentMemberKey);
            if (!isSelf && !_gigsMapShowBandmateHomes) continue; // toggle gates bandmate homes
            // (Issue #47) Privacy opt-in: a bandmate can hide their home pin
            // from others via Settings → Profile. The signed-in user always
            // sees their OWN home regardless (they're looking at their own UI).
            if (!isSelf && m.showHomeOnMap === false) continue;
            var hlat = (typeof m.homeLat === 'number') ? m.homeLat : null;
            var hlng = (typeof m.homeLng === 'number') ? m.homeLng : null;
            if (!hlat || !hlng) {
                var geo = await _gigsMapGeocode(m.homeAddress);
                if (!geo) continue;
                hlat = geo.lat; hlng = geo.lng;
                try {
                    if (typeof firebaseDB !== 'undefined' && firebaseDB && typeof bandPath === 'function') {
                        firebaseDB.ref(bandPath('meta/members/' + mkey + '/homeLat')).set(hlat);
                        firebaseDB.ref(bandPath('meta/members/' + mkey + '/homeLng')).set(hlng);
                    }
                } catch (_e) {}
            }
            homePoints.push({ key: mkey, member: m, isSelf: isSelf, lat: hlat, lng: hlng });
        }
    }

    // Empty-state guard: nothing at all to render? Distinguish two failure
    // modes so the next debugging cycle doesn't burn a session on this.
    if (gigGroupsForRender.length === 0 && homePoints.length === 0) {
        if (_gigsMapDeniedCount > 0) {
            // Every geocode hit REQUEST_DENIED — almost always means the
            // Geocoding API isn't enabled on the Cloud project that owns
            // the Maps JS key. Tell the user where to go instead of
            // pretending there's no data.
            el.innerHTML = '<div style="padding:18px 22px;border-radius:10px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);color:#fecaca;font-size:0.88em;line-height:1.5">'
                + '<div style="font-weight:700;color:#f87171;margin-bottom:6px">⚠️ Geocoding API not enabled</div>'
                + 'Google rejected ' + _gigsMapDeniedCount + ' geocode request' + (_gigsMapDeniedCount === 1 ? '' : 's') + ' with <code>REQUEST_DENIED</code>. Enable the <strong>Geocoding API</strong> in the Google Cloud project that owns this site\'s Maps JS API key, then reload.'
                + '<div style="font-size:0.78em;color:#fca5a5;margin-top:8px;font-style:italic">Last denied address: ' + (_gigsMapLastDenialAddr || '(none)') + '</div>'
                + '<a href="https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com" target="_blank" style="display:inline-block;margin-top:10px;background:rgba(239,68,68,0.2);color:#fecaca;border:1px solid rgba(239,68,68,0.4);padding:5px 12px;border-radius:6px;font-size:0.82em;text-decoration:none;font-weight:600">Open Cloud Console →</a>'
                + '</div>';
            return;
        }
        el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-dim);font-size:0.88em">No gigs or homes to plot yet.<br>Add a venue (with address) on the Venues page or set your home address in Settings.</div>';
        return;
    }

    el.innerHTML = '';
    el.style.cssText = 'height:360px;border-radius:12px;overflow:hidden;position:relative';

    // (Issue #47) Inject one-time CSS overrides so Google's white default
    // info-window wrapper matches our dark map theme. Idempotent — the
    // style tag is only added once even across map re-renders.
    if (!document.getElementById('gigsMapStyleOverrides')) {
        var styleEl = document.createElement('style');
        styleEl.id = 'gigsMapStyleOverrides';
        styleEl.textContent = '.gm-style .gm-style-iw-c{background:#1e293b!important;box-shadow:0 4px 16px rgba(0,0,0,0.4)!important;padding:0!important;border-radius:10px!important;max-width:280px!important}'
            + '.gm-style .gm-style-iw-d{background:#1e293b!important;overflow:auto!important;padding:0!important}'
            + '.gm-style .gm-style-iw-tc::after{background:#1e293b!important}'
            + '.gm-style .gm-style-iw-chr{background:transparent!important}'
            + '.gm-style .gm-ui-hover-effect>span{background:#94a3b8!important}'
            + '.gm-style .gm-style-iw button.gm-ui-hover-effect{opacity:0.6}';
        document.head.appendChild(styleEl);
    }

    // Map center: bounds-fit if we have anything, otherwise default Atlanta-ish
    var anchorLat = gigGroupsForRender.length ? gigGroupsForRender[0]._lat : (homePoints[0] ? homePoints[0].lat : 33.749);
    var anchorLng = gigGroupsForRender.length ? gigGroupsForRender[0]._lng : (homePoints[0] ? homePoints[0].lng : -84.388);

    _gigsMap = new google.maps.Map(el, {
        center: { lat: anchorLat, lng: anchorLng },
        zoom: 11,
        // `mapId` is required by AdvancedMarkerElement (vector map). It also
        // makes the inline `styles:` option a no-op, so the dark theme is
        // configured via a Cloud Console Map Style associated with this ID.
        // See _GIGS_MAP_ID comment at the top of this file for setup.
        mapId: _GIGS_MAP_ID,
        mapTypeId: 'roadmap',
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

    function _esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    gigGroupsForRender.forEach(function(grp) {
        // Sort: next-upcoming first (soonest), other upcoming after, then past
        // (most recent first). This makes the hover list read naturally.
        var sortedGigs = grp.gigs.slice().sort(function(a, b) {
            var ad = a.date || '', bd = b.date || '';
            var au = ad >= today, bu = bd >= today;
            if (au && !bu) return -1;
            if (!au && bu) return 1;
            if (au && bu) return ad.localeCompare(bd);     // upcoming: soonest first
            return bd.localeCompare(ad);                    // past: most recent first
        });
        var hasUpcoming = sortedGigs.some(function(g) { return (g.date||'') >= today; });
        var hasPast = sortedGigs.some(function(g) { return (g.date||'') !== '' && (g.date||'') < today; });

        // Pin color reflects "any upcoming" — green if there's a future booking
        // at the venue, indigo if it's only past plays.
        var color = hasUpcoming ? '#22c55e' : '#818cf8';
        var marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: grp._lat, lng: grp._lng },
            map: _gigsMap,
            content: _gigsMapPinElement(color)
        });

        var statusBadge = hasUpcoming
            ? '<span style="background:rgba(34,197,94,0.2);color:#22c55e;border:1px solid rgba(34,197,94,0.3);border-radius:4px;padding:1px 6px;font-size:11px;font-weight:700">Upcoming</span>'
            : '<span style="background:rgba(129,140,248,0.2);color:#818cf8;border:1px solid rgba(129,140,248,0.3);border-radius:4px;padding:1px 6px;font-size:11px">Past</span>';
        var mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent(grp.address || grp.name);
        var nGigs = sortedGigs.length;

        // ─── HOVER content — compact: venue name + status + first 4 dates ───
        // Intentionally no Directions button (it's unclickable on hover —
        // mouseout would close the window before the user could click it).
        var hoverDates = sortedGigs.slice(0, 4).map(function(g, i) {
            var d = g.date || 'TBD';
            var suffix = (i === 0 && hasUpcoming && (g.date||'') >= today) ? ' <span style="color:#22c55e;font-size:0.85em">(next)</span>' : '';
            return '<div style="font-size:0.8em;color:#cbd5e1;line-height:1.5">• ' + _esc(d) + suffix + '</div>';
        }).join('');
        var hoverOverflow = nGigs > 4
            ? '<div style="font-size:0.78em;color:#64748b;line-height:1.5">…and ' + (nGigs - 4) + ' more</div>'
            : '';
        var hoverContent = '<div style="background:#1e293b;color:#e2e8f0;padding:12px 14px;border-radius:10px;min-width:200px;max-width:260px;font-family:-apple-system,sans-serif">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
            + '<strong style="font-size:0.95em;flex:1">' + _esc(grp.name) + '</strong>' + statusBadge
            + '</div>'
            + '<div style="font-size:0.8em;color:#94a3b8;margin-bottom:6px">🎤 ' + nGigs + ' show' + (nGigs === 1 ? '' : 's') + ' here</div>'
            + hoverDates + hoverOverflow
            + '<div style="font-size:0.72em;color:#64748b;margin-top:6px;font-style:italic">Click for details + directions</div>'
            + '</div>';

        // ─── CLICK content — full: address + all dates + Directions ───
        // The next-upcoming (or most-recent past if no upcoming) gets enriched
        // with startTime / pay / soundPerson; remaining dates are just bullets.
        var anchorGig = sortedGigs[0] || {};
        var anchorIsUpcoming = (anchorGig.date || '') >= today;
        var clickDateList = sortedGigs.map(function(g, i) {
            var d = g.date || 'TBD';
            var extras = '';
            if (i === 0) {
                if (g.startTime) extras += ' &nbsp;⏰ ' + _esc(g.startTime);
                if (g.pay)       extras += ' &nbsp;<span style="color:#86efac">💰 ' + _esc(g.pay) + '</span>';
            }
            var nextTag = (i === 0 && anchorIsUpcoming) ? ' <span style="color:#22c55e;font-size:0.85em">(next)</span>' : '';
            return '<div style="font-size:0.82em;color:#cbd5e1;line-height:1.55">• ' + _esc(d) + nextTag + extras + '</div>';
        }).join('');
        var anchorMetaBits = [];
        if (anchorGig.soundPerson) anchorMetaBits.push('🔊 ' + _esc(anchorGig.soundPerson));
        if (anchorGig.notes)       anchorMetaBits.push('<span style="color:#64748b">' + _esc(anchorGig.notes) + '</span>');
        var anchorMeta = anchorMetaBits.length
            ? '<div style="font-size:0.78em;color:#94a3b8;margin-top:6px;border-top:1px solid rgba(255,255,255,0.07);padding-top:6px">' + anchorMetaBits.join(' &nbsp;·&nbsp; ') + '</div>'
            : '';
        var clickContent = '<div style="background:#1e293b;color:#e2e8f0;padding:12px 14px;border-radius:10px;min-width:220px;max-width:280px;font-family:-apple-system,sans-serif">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
            + '<strong style="font-size:0.95em;flex:1">' + _esc(grp.name) + '</strong>' + statusBadge
            + '</div>'
            + (grp.address ? '<div style="font-size:0.78em;color:#94a3b8;margin-bottom:6px">📍 ' + _esc(grp.address) + '</div>' : '')
            + '<div style="font-size:0.8em;color:#94a3b8;margin-bottom:4px">🎤 ' + nGigs + ' show' + (nGigs === 1 ? '' : 's') + ' here</div>'
            + '<div style="max-height:140px;overflow-y:auto;margin-bottom:8px">' + clickDateList + '</div>'
            + anchorMeta
            + '<a href="' + mapsUrl + '" target="_blank" style="display:inline-block;margin-top:8px;background:rgba(129,140,248,0.2);color:#a5b4fc;border:1px solid rgba(129,140,248,0.3);padding:5px 12px;border-radius:6px;font-size:0.78em;text-decoration:none;font-weight:600">🗺 Directions</a>'
            + '</div>';

        var infoWindow = new google.maps.InfoWindow({ content: hoverContent });
        _gigsMapInfoWindows.push(infoWindow);
        _gigsMapWireMarker(marker, infoWindow, hoverContent, clickContent);

        marker._venueName = grp.name;
        marker._hasUpcoming = hasUpcoming;
        marker._hasPast = hasPast;
        // Back-compat: _isUpcoming reflects "this pin should appear under
        // the Upcoming filter" — true iff there's any upcoming gig at this
        // venue. Past pins with NO upcoming behave as before.
        marker._isUpcoming = hasUpcoming;
        marker._isHome = false;
        _gigsMapMarkers.push(marker);
    });

    // (Issue #46) Home markers — render AFTER gig pins so the home icon
    // sits visually on top of nearby gig pins.
    homePoints.forEach(function(hp) {
        var color = hp.isSelf ? '#3b82f6' : '#a78bfa';
        var marker = new google.maps.marker.AdvancedMarkerElement({
            position: { lat: hp.lat, lng: hp.lng },
            map: _gigsMap,
            content: _gigsMapHomePinElement(color, hp.isSelf),
            zIndex: hp.isSelf ? 9999 : 9998
        });
        var roleLine = (typeof _memberDisplayRole === 'function') ? _memberDisplayRole(hp.member) : (hp.member.role || '');
        var mapsUrl = 'https://maps.google.com/?q=' + encodeURIComponent(hp.member.homeAddress || '');
        // Hover: just name + role (no address, no Directions). Click: full.
        var homeHoverContent = '<div style="background:#1e293b;color:#e2e8f0;padding:12px 14px;border-radius:10px;min-width:180px;max-width:240px;font-family:-apple-system,sans-serif">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            + '<strong style="font-size:0.95em;flex:1">🏠 ' + _esc(hp.member.name || hp.key) + (hp.isSelf ? ' (you)' : '') + '</strong>'
            + '</div>'
            + (roleLine ? '<div style="font-size:0.78em;color:#94a3b8">' + _esc(roleLine) + '</div>' : '')
            + '<div style="font-size:0.72em;color:#64748b;margin-top:6px;font-style:italic">Click for address + directions</div>'
            + '</div>';
        var homeClickContent = '<div style="background:#1e293b;color:#e2e8f0;padding:12px 14px;border-radius:10px;min-width:180px;max-width:260px;font-family:-apple-system,sans-serif">'
            + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">'
            + '<strong style="font-size:0.95em;flex:1">🏠 ' + _esc(hp.member.name || hp.key) + (hp.isSelf ? ' (you)' : '') + '</strong>'
            + '</div>'
            + (roleLine ? '<div style="font-size:0.78em;color:#94a3b8;margin-bottom:4px">' + _esc(roleLine) + '</div>' : '')
            + '<div style="font-size:0.78em;color:#94a3b8;margin-bottom:8px">📍 ' + _esc(hp.member.homeAddress || '') + '</div>'
            + '<a href="' + mapsUrl + '" target="_blank" style="display:inline-block;background:rgba(129,140,248,0.2);color:#a5b4fc;border:1px solid rgba(129,140,248,0.3);padding:5px 12px;border-radius:6px;font-size:0.78em;text-decoration:none;font-weight:600">🗺 Directions</a>'
            + '</div>';
        var infoWindow = new google.maps.InfoWindow({ content: homeHoverContent });
        _gigsMapInfoWindows.push(infoWindow);
        _gigsMapWireMarker(marker, infoWindow, homeHoverContent, homeClickContent);
        marker._isHome = true;
        marker._isBandmate = !hp.isSelf;
        _gigsMapMarkers.push(marker);
    });

    // Fit bounds across every visible marker (gigs + homes).
    // AdvancedMarkerElement uses `marker.position` (property) and `marker.map`
    // for visibility (null = hidden) instead of getPosition()/getVisible().
    var bounds = new google.maps.LatLngBounds();
    var anyExtended = false;
    _gigsMapMarkers.forEach(function(m) {
        if (m.map && m.position) { bounds.extend(m.position); anyExtended = true; }
    });
    if (anyExtended) {
        _gigsMap.fitBounds(bounds);
        if (_gigsMapMarkers.length === 1) _gigsMap.setZoom(13);
    }

    _gigsMapApplyFilter();
}

function _gigsMapApplyFilter() {
    var f = _gigsMapFilter;
    _gigsMapMarkers.forEach(function(m) {
        var show;
        if (m._isHome) {
            // Home pins ignore upcoming/past filter; bandmate homes gated by toggle.
            show = m._isBandmate ? _gigsMapShowBandmateHomes : true;
        } else {
            // Group-aware filter: a venue with both upcoming + past gigs
            // appears under BOTH the Upcoming and Past filters (deliberate —
            // it's the same pin showing "we play here / we played here").
            if (f === 'all') show = true;
            else if (f === 'upcoming') show = !!m._hasUpcoming;
            else if (f === 'past') show = !!m._hasPast;
            else show = true;
        }
        // AdvancedMarkerElement uses `marker.map = null` for hide,
        // `marker.map = <map>` for show. Replaces legacy setVisible().
        m.map = show ? _gigsMap : null;
        if (!show) m._pinned = false;
    });
    // close any open info windows when filtering
    _gigsMapInfoWindows.forEach(function(iw) { iw.close(); });
}

window.gigsMapToggleBandmateHomes = function (btn) {
    _gigsMapShowBandmateHomes = !_gigsMapShowBandmateHomes;
    try { localStorage.setItem('gl_gig_map_show_bandmates', _gigsMapShowBandmateHomes ? '1' : '0'); } catch (_e) {}
    if (btn) {
        if (_gigsMapShowBandmateHomes) {
            btn.style.background = 'rgba(167,139,250,0.2)';
            btn.style.color = '#c4b5fd';
            btn.style.borderColor = 'rgba(167,139,250,0.4)';
        } else {
            btn.style.background = 'rgba(255,255,255,0.04)';
            btn.style.color = '#64748b';
            btn.style.borderColor = 'rgba(255,255,255,0.08)';
        }
    }
    // Re-render is overkill — we just need to render bandmate markers we
    // haven't created yet (or hide ones we have). Simplest path: re-render.
    if (_gigsMap) renderGigsMap();
};

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
                    <button id="gmfBandmates" onclick="event.stopPropagation();gigsMapToggleBandmateHomes(this)" title="Show bandmate home locations" style="background:rgba(255,255,255,0.04);color:#64748b;border:1px solid rgba(255,255,255,0.08);padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer;margin-left:4px">🏠 Band</button>
                </div>
                <span id="gigsMapChevron" style="color:var(--text-dim);font-size:0.8em;transition:transform 0.2s">▼</span>
            </div>
        </div>
        <div id="gigsMapCollapsible" style="display:none">
            <div style="height:1px;background:var(--border)"></div>
            <div id="gigsMapContainer" style="height:320px;background:rgba(0,0,0,0.3)"></div>
        </div>
    </div>
    <div id="gigsList"><div class="app-card" style="text-align:center;color:var(--text-dim);padding:40px"><div style="font-size:1.5em;margin-bottom:8px">\uD83C\uDFA4</div><div style="font-weight:600;margin-bottom:4px">No gigs yet</div><div style="font-size:0.85em">Add your first gig to start tracking shows.</div></div></div>`;
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
    // Sync the Bandmates toggle visual to persisted state on open.
    var bmBtn = document.getElementById('gmfBandmates');
    if (bmBtn && _gigsMapShowBandmateHomes) {
        bmBtn.style.background = 'rgba(167,139,250,0.2)';
        bmBtn.style.color = '#c4b5fd';
        bmBtn.style.borderColor = 'rgba(167,139,250,0.4)';
    }
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
    if (!rawData.length) { el.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:40px"><div style="font-size:1.5em;margin-bottom:8px">\uD83C\uDFA4</div><div style="font-weight:600;margin-bottom:4px">No gigs yet</div><div style="font-size:0.85em">Add your first gig to start tracking shows.</div></div>'; return; }
    var data = rawData.map(function(g, origIdx) { return Object.assign({}, g, { _origIdx: origIdx }); });
    window._loadedGigs = data;

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
    return '<div class="app-card" data-gig-idx="' + idx + '" data-gig-id="' + (g.gigId || '') + '" style="margin-bottom:8px;padding:10px 14px">'
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
        + ((g.setlistId || g.linkedSetlist) ? '<div style="margin-top:6px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:0.75em;color:var(--accent-light)">\uD83D\uDCCB ' + (g.linkedSetlist || 'linked') + '</span>'
            + '<button onclick="gigLaunchLinkedSetlist(\'' + (g.setlistId || '').replace(/'/g,'\\\'') + '\')" style="background:linear-gradient(135deg,#22c55e,#16a34a);border:none;color:white;padding:3px 10px;border-radius:5px;font-size:0.7em;font-weight:700;cursor:pointer">\uD83C\uDFA4 Go Live</button>'
            + '<button onclick="gigPlaySetlist(\'' + (g.setlistId || '').replace(/'/g,'\\\'') + '\')" style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);color:#a5b4fc;padding:3px 10px;border-radius:5px;font-size:0.7em;font-weight:700;cursor:pointer">\u25B6\uFE0F Play Setlist</button></div>' : '')
        + (isUpcoming && typeof calBuildGigGoogleLink === 'function' ? '<button onclick="_gigAddToGoogleCal(' + idx + ')" style="margin-top:6px;width:100%;padding:6px;border-radius:5px;border:1px solid rgba(66,133,244,0.2);background:rgba(66,133,244,0.04);color:#4285f4;cursor:pointer;font-size:0.7em;font-weight:600;font-family:inherit">\uD83D\uDCC5 Add to Google Calendar</button>' : '')
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
                <span class="form-label">Venue</span>
                <div id="gigVenuePicker"></div>
            </div>
            <div class="form-row"><span class="form-label">Date</span><input class="app-input" id="gigDate" type="date"></div>
            <div class="form-row"><span class="form-label">Pay / Guarantee</span><input class="app-input" id="gigPay" placeholder="e.g. $500 + tips"></div>
            <div class="form-row"><span class="form-label">Arrival Time</span><input class="app-input" id="gigArrival" type="time"></div>
            <div class="form-row"><span class="form-label">Soundcheck Time</span><input class="app-input" id="gigSoundcheck" type="time"></div>
            <div class="form-row"><span class="form-label">Start Time</span><input class="app-input" id="gigStartTime" type="time"></div>
            <div class="form-row"><span class="form-label">End Time</span><input class="app-input" id="gigEndTime" type="time"></div>
            <div class="form-row"><span class="form-label">Sound Person</span><input class="app-input" id="gigSound" placeholder="Who's doing sound?"></div>
            <div class="form-row"><span class="form-label">Venue Contact</span><input class="app-input" id="gigContact" placeholder="Booking contact name"></div>
        </div>
        </div>
        <div class="form-row" style="margin-top:10px"><span class="form-label">📋 Linked Setlist</span>
            <select class="app-select" id="gigLinkedSetlist">
                <option value="">-- None --</option>
                ${(window._cachedSetlists||[]).map(sl => `<option value="${sl.setlistId||(sl.name||'').replace(/"/g,'&quot;')}">${sl.name||'Untitled'}${sl.date?' ('+sl.date+')':''}</option>`).join('')}
            </select>
        </div>
        <div class="form-row"><span class="form-label">Notes</span><textarea class="app-textarea" id="gigNotes" placeholder="Parking, load-in door, set length, gear needed…"></textarea></div>
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
// Mirror a gig record onto its calendar_events row. Matches by gigId first
// (stable), falls back to venue+date for legacy rows pre-gigId.
//
// Mirror policy: copy the FULL gig record onto the cal_event row. This kills
// the "field drift" bug class (e.g. 4/20 endTime drop, future fields added to
// gigs but not propagated through the pipeline). The only fields preserved
// from the existing cal_event are calendar-event-managed metadata that the
// gig record doesn't track: id, googleEventId, calendarId, sync, syncStatus,
// updated_at, _syntheticFromFreeBusy, _importedFromGoogle, assignedMembers,
// hiddenInfo, organizerEmail, recurrence, etag.
async function _syncGigToCalendar(gig, createdKey) {
    if (!gig || !gig.date || !gig.venue) return;
    const calEvents = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    var existIdx = -1;
    if (gig.gigId) {
        existIdx = calEvents.findIndex(function(e) { return e.type === 'gig' && e.gigId === gig.gigId; });
    }
    if (existIdx < 0) {
        const matchKey = (gig.venue||'') + '|' + (gig.date||'');
        existIdx = calEvents.findIndex(function(e) { return e.type === 'gig' && ((e.venue||'')+'|'+(e.date||'')) === matchKey; });
    }
    var existing = (existIdx >= 0) ? calEvents[existIdx] : null;

    // Audit T1.3 (2026-05-04): use the centralized builder. Single source
    // of truth for the linkedSetlist override (D12 fix), preserved-keys
    // list, time/startTime alias, and title resolution. _syncGigToCalendar
    // is the live edit path (Save/Edit gig), so seedSyncFromGig is OFF —
    // sync state on the existing cal_event row is preserved naturally.
    if (typeof GLCalendarSync === 'undefined' || !GLCalendarSync._buildGigCalEventBody) {
        console.error('[Gigs] _syncGigToCalendar: GLCalendarSync._buildGigCalEventBody unavailable — aborting mirror');
        return;
    }
    var calRecord = GLCalendarSync._buildGigCalEventBody(gig, existing);

    // Backfill id and created on first mirror.
    if (!calRecord.id) calRecord.id = generateShortId(12);
    if (existIdx < 0) {
        calRecord.created = createdKey || gig.created || new Date().toISOString();
        calEvents.push(calRecord);
    } else {
        calEvents[existIdx] = calRecord;
    }

    // Forward-ref on gig so future cascade ops can find the cal_event row.
    if (!gig.calendarEventId) gig.calendarEventId = calRecord.id;

    await saveBandDataToDrive('_band', 'calendar_events', calEvents);

    // Audit M15 (2026-05-04): emit calendarEventsChanged so visible grids
    // (calendar page, dashboard rails) can re-render against the freshly
    // mirrored row instead of waiting for the next sync poll. GLStore
    // doesn't yet cache calendar_events, but downstream renderers can
    // subscribe to this event regardless.
    try {
        if (typeof GLStore !== 'undefined' && typeof GLStore.emit === 'function') {
            GLStore.emit('calendarEventsChanged', { source: '_syncGigToCalendar', gigId: gig && gig.gigId, eventId: calRecord.id });
        } else if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('calendarEventsChanged', { detail: { source: '_syncGigToCalendar', gigId: gig && gig.gigId, eventId: calRecord.id } }));
        }
    } catch (_e) { /* non-fatal */ }
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

    // Path B.2 #38: warn if the gig date has any unavailability blocks (real
    // schedule_blocks OR synthetic hidden-event blocks). Cheap pre-flight
    // check — keeps users from booking a gig on a date the band can't make.
    if (gig.date) {
        try {
            var _calEvts = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
            var _conflicts = _calEvts.filter(function(e) {
                if (!e || e.type !== 'unavailable') return false;
                if (e.date !== gig.date) {
                    // multi-day check
                    if (!(e.date && e.endDate && e.date <= gig.date && gig.date <= e.endDate)) return false;
                }
                return true;
            });
            if (_conflicts.length) {
                var _hiddenCount = _conflicts.filter(function(c) { return c._syntheticFromFreeBusy; }).length;
                var _realCount = _conflicts.length - _hiddenCount;
                var _msgParts = [];
                if (_hiddenCount > 0) _msgParts.push(_hiddenCount + ' hidden-event block' + (_hiddenCount === 1 ? '' : 's'));
                if (_realCount > 0) _msgParts.push(_realCount + ' member conflict' + (_realCount === 1 ? '' : 's'));
                var _msg = '\u26A0 ' + gig.date + ' has ' + _msgParts.join(' + ') + '.\n\nBook this gig anyway?';
                if (!confirm(_msg)) return;
            }
        } catch (_e) { /* non-fatal — continue with save */ }
    }

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
    await _saveGigsAndInvalidate(existing);
    // Sync to calendar as a gig event
    await _syncGigToCalendar(gig, null);
    // UX sprint #9: specific receipt — confirms what was saved.
    var _gigWhen = (gig.date || '') + (gig.startTime ? ' \u00B7 ' + gig.startTime : '') + (gig.endTime ? '\u2013' + gig.endTime : '');
    showToast('\u2705 Gig saved: ' + (gig.venue || 'Untitled') + ' \u00B7 ' + _gigWhen + (gig.linkedSetlist ? ' \u00B7 \u201C' + gig.linkedSetlist + '\u201D' : ''), 5000);
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
        // Use in-memory caches first — avoid redundant Firebase reads
        var _cachedGigs = (typeof GLStore !== 'undefined' && GLStore.getGigs) ? GLStore.getGigs() : null;
        var _cachedSetlists = (typeof GLStore !== 'undefined' && GLStore.getSetlists) ? GLStore.getSetlists() : (window._glCachedSetlists || window._cachedSetlists || null);
        const gigs = (_cachedGigs && _cachedGigs.length) ? _cachedGigs : toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
        const setlists = (_cachedSetlists && _cachedSetlists.length) ? _cachedSetlists : toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
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
        // Hide YouTube footer button in gig mode
        '#gmOverlay .rm-footer .rm-action-btn:nth-child(1){display:none}',
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
        + '<div class="form-row" style="margin-bottom:10px"><span class="form-label">Guarantee / Door ($)</span>'
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
    await _saveGigsAndInvalidate(data);
    loadGigPayouts(gigIdx);
}

async function gpRemoveExpense(gigIdx, idx) {
    var data = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    if (!data[gigIdx]) return;
    data[gigIdx].guarantee = parseFloat(document.getElementById('gpGuarantee')?.value) || 0;
    data[gigIdx].expenses = gpReadExpensesFromDOM(data[gigIdx].expenses || []);
    data[gigIdx].expenses.splice(idx, 1);
    await _saveGigsAndInvalidate(data);
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
    await _saveGigsAndInvalidate(data);
    // Audit H11 (2026-05-04): payout fields wrote to gigs only \u2014 cal_event
    // mirror went stale until the next gig edit. Now propagates immediately.
    try { await _syncGigToCalendar(data[gigIdx]); }
    catch(e) { console.warn('[Gigs] gpSave: cal_event mirror failed:', e && e.message); }
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
    // Stale RSVP warning
    var _myAvailEntry = avail[myKey] || {};
    if (_myAvailEntry.stale && isUpcoming) {
        var staleMsg = _myAvailEntry.staleReason ? _myAvailEntry.staleReason : 'Details changed';
        html += '<div style="padding:6px 8px;margin-top:6px;border-radius:6px;border:1px solid rgba(245,158,11,0.25);background:rgba(245,158,11,0.04);font-size:0.72em;color:#fbbf24;font-weight:600">'
            + '\u26A0 ' + staleMsg + ' \u2014 please re-confirm your RSVP</div>';
    }
    if (myKey && isUpcoming) {
        var myStatus = avail[myKey] ? avail[myKey].status : null;
        if (myStatus && !_myAvailEntry.stale) {
            // Compact post-vote state (only if not stale)
            var voteLabels = { yes: '\u2705 You\'re In', maybe: '\u2753 Maybe', no: '\u274C Out' };
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

    // Collapsible member list. Default state by need-to-look-at-it:
    //   - Past gigs always collapsed.
    //   - Upcoming gigs with NO gaps (all roles covered, nothing maybe,
    //     nobody awaiting) → collapsed (compact card, no real estate
    //     wasted on the "everything's fine" case).
    //   - Upcoming gigs with ANY gap → open by default so the missing
    //     piece is immediately visible.
    var _allClear = isUpcoming
        && s.missingRoles.length === 0
        && s.maybeRoles.length === 0
        && (s.awaitingCount || 0) === 0;
    var _detailsOpen = isUpcoming && !_allClear;
    html += '<details id="' + detailId + '"' + (_detailsOpen ? ' open' : '') + ' style="margin-top:8px">'
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
        gig.availability[memberKey] = { status: status, updatedAt: new Date().toISOString() }; // stale flag cleared by full replace
        await _saveGigsAndInvalidate(gigs);
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
window._cascadeDeleteGig = _cascadeDeleteGig;

// Open the gig editor for a specific gig — by gigId OR by date — used by
// Calendar surfaces (Next Up cards, mobile date sheet) so taps land on the
// right gig instead of the generic Setlists page (D1 in bug_queue.md).
// Accepts either form because the desktop Next Up cards have ev.gigId at
// hand, but the mobile date sheet only has the clicked date.
window.openGigById = async function(gigIdOrDate) {
    if (typeof showPage !== 'function') return;
    showPage('gigs');
    if (!gigIdOrDate) return;
    // Pull fresh from Drive so we don't race with showPage's async render
    // (loadGigs() runs in parallel; its cache may not be populated yet).
    var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var idx = gigs.findIndex(function(g) {
        return (g.gigId && g.gigId === gigIdOrDate) || g.date === gigIdOrDate;
    });
    if (idx < 0) {
        if (typeof showToast === 'function') showToast('Gig not found in Gigs list');
        return;
    }
    if (typeof editGig === 'function') editGig(idx);
};
window.saveGigEdit = saveGigEdit;
window.gigLaunchLinkedSetlist = gigLaunchLinkedSetlist;
window.loadGigs = loadGigs;
window.addGig = addGig;
window.saveGig = saveGig;
window.launchGigMode = launchGigMode;
window.openGigMode = openGigMode;
window.closeGigMode = closeGigMode;

window.gigPlaySetlist = async function(setlistId) {
    try {
        var slData = (typeof loadBandDataFromDrive === 'function') ? await loadBandDataFromDrive('_band', 'setlists') : null;
        if (!slData) { showToast('Could not load setlists'); return; }
        var all = Array.isArray(slData) ? slData : Object.values(slData);
        var sl = all.find(function(s) { return s && (s.setlistId === setlistId || s.name === setlistId || s.title === setlistId); });
        if (!sl) { showToast('Setlist not found'); return; }
        var name = sl.name || sl.title || 'Setlist';
        // Use unified engine if available (prevents z-index conflict with SetlistPlayer)
        if (typeof GLPlayerEngine !== 'undefined' && typeof GLPlayerUI !== 'undefined') {
            GLPlayerEngine.loadFromSetlist(sl, { name: name });
            GLPlayerUI.showOverlay();
            GLPlayerEngine.play(0);
        } else if (typeof SetlistPlayer !== 'undefined') {
            SetlistPlayer.launch(sl, name);
        } else {
            showToast('Player not available');
        }
    } catch(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); }
};
window.gmNavigate = gmNavigate;
window.gmMarkPlayed = gmMarkPlayed;
window.rmCaptureSave = rmCaptureSave;
window.rmCaptureCancel = rmCaptureCancel;
window.gigsMapSetFilter = gigsMapSetFilter;
window.renderGigsPage = renderGigsPage;
window.loadGigHistory = loadGigHistory;

// ── Admin one-shots (run from DevTools console) ──────────────────────────────
// (2026-05-23 Drew request) Mark every band member as "yes" on every past gig
// that doesn't already have a final RSVP. Idempotent by default — re-running
// won't overwrite a member's existing decision. Pass {overwrite:true} to clobber.
// Mirrors each touched gig to calendar_events via _syncGigToCalendar.
window._gl_backfillPastGigRsvps = async function(opts) {
    opts = opts || {};
    var overwrite = !!opts.overwrite;
    if (typeof bandMembers === 'undefined' || !bandMembers || Object.keys(bandMembers).length === 0) {
        console.error('[backfillRSVP] bandMembers not loaded yet — wait for boot and retry');
        return;
    }
    var gigs = toArray(await loadBandDataFromDrive('_band', 'gigs') || []);
    var today = new Date().toISOString().split('T')[0];
    var memberKeys = Object.keys(bandMembers);
    var stamp = new Date().toISOString();
    var stats = { gigsTouched: 0, entriesAdded: 0, entriesOverwritten: 0, gigsSkippedFuture: 0, gigsSkippedNoDate: 0 };
    gigs.forEach(function(g) {
        if (!g) return;
        if (!g.date) { stats.gigsSkippedNoDate++; return; }
        if (g.date >= today) { stats.gigsSkippedFuture++; return; }
        if (!g.availability) g.availability = {};
        var changed = false;
        memberKeys.forEach(function(mkey) {
            var existing = g.availability[mkey];
            if (existing && existing.status && !overwrite) return; // respect prior decisions
            g.availability[mkey] = { status: 'yes', updatedAt: stamp, _backfill: true };
            if (existing && existing.status) stats.entriesOverwritten++; else stats.entriesAdded++;
            changed = true;
        });
        if (changed) {
            g.updated = stamp;
            stats.gigsTouched++;
        }
    });
    await saveBandDataToDrive('_band', 'gigs', gigs);
    if (typeof GLStore !== 'undefined' && GLStore.setGigsCache) GLStore.setGigsCache(gigs);
    // Mirror each touched gig to calendar_events so the cal surface reflects.
    if (typeof _syncGigToCalendar === 'function') {
        for (var i = 0; i < gigs.length; i++) {
            var gg = gigs[i];
            if (gg && gg.availability && Object.values(gg.availability).some(function(a){ return a && a._backfill; })) {
                try { await _syncGigToCalendar(gg); } catch(_e) {}
            }
        }
    }
    console.log('[backfillRSVP] done', stats);
    if (typeof showToast === 'function') showToast('✓ Backfilled ' + stats.entriesAdded + ' RSVPs across ' + stats.gigsTouched + ' past gigs');
    return stats;
};

// (2026-05-23 Drew request) One-shot: clean section-label artifacts
// ("Set Break", "Soundcheck", "Set 1", etc.) from every setlist by triggering
// a save. The validator in saveBandArrayDataSafe strips them inline.
window._gl_cleanSetlistArtifacts = async function() {
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    await saveBandDataToDrive('_band', 'setlists', setlists);
    if (typeof showToast === 'function') showToast('✓ Setlist sweep complete — check console for stripped artifacts');
    console.log('[cleanSetlistArtifacts] save triggered — auto-cleaner ran inline');
};

// ── Post event change notification to band feed ──────────────────────────────
function _postEventChangeNotification(eventType, eventName, changeLabel) {
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return;
    var author = (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : 'Someone';
    var typeLabel = eventType === 'gig' ? 'Gig' : 'Rehearsal';
    var msg = typeLabel + ' updated: ' + eventName + ' \u2014 ' + changeLabel.toLowerCase() + '. Please re-confirm your RSVP.';
    db.ref(bandPath('ideas/posts')).push({
        title: msg,
        author: author,
        ts: new Date().toISOString(),
        tag: 'needs_input',
        post_type: 'note',
        _system: true,
        _eventChangeType: eventType,
        _eventName: eventName
    }).catch(function() {});
}
window._postEventChangeNotification = _postEventChangeNotification;

// ── Add to Google Calendar for gigs ──────────────────────────────────────────
var _gigGcalDebounce = 0;
window._gigAddToGoogleCal = function(gigIdx) {
    if (Date.now() - _gigGcalDebounce < 3000) return;
    _gigGcalDebounce = Date.now();
    if (typeof calBuildGigGoogleLink !== 'function') {
        if (typeof showToast === 'function') showToast('Calendar export not available');
        return;
    }
    // Find the gig by index from the loaded gigs cache
    var gigs = window._loadedGigs || [];
    var g = gigs[gigIdx];
    if (!g) { if (typeof showToast === 'function') showToast('Gig not found'); return; }
    var url = calBuildGigGoogleLink(g);
    if (url && url !== '#') {
        window.open(url, '_blank');
        if (typeof showToast === 'function') showToast('\uD83D\uDCC5 Opening Google Calendar\u2026 send invites there');
    }
    else if (typeof showToast === 'function') showToast('Could not build calendar link');
};

console.log('\u2705 gigs.js loaded');
