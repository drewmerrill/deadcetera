// ============================================================================
// js/features/notifications.js
// Band notifications + Care Package system: member contacts, SMS, push,
// pre-gig/rehearsal packs served via Cloudflare Worker.
// Extracted from app.js Wave-3 refactor.
//
// DEPENDS ON: firebase-service.js, utils.js, worker-api.js
// EXPOSES globals: renderNotificationsPage, notifToggleEdit,
//   notifSaveMemberContact, notifSendSMS, notifFromPracticePlan,
//   carePackageSend, carePackageBuild, carePackageShowSendModal
// ============================================================================

'use strict';

// ══ CARE PACKAGE SYSTEM ══════════════════════════════════════════════════════
// Builds a full pre-gig/rehearsal pack (setlist + charts + crib notes),
// stores it in Firebase, returns a short URL served by the Cloudflare Worker.
// Bandmates tap the link — standalone page, no login, no app required.

var WORKER_BASE = 'https://deadcetera-proxy.drewmerrill.workers.dev';

// Main entry: called from Notifications page
async function carePackageSend(type, preselectedSlIdx) {
    // type = 'rehearsal' | 'gig'
    var modal = document.getElementById('carePackageModal');
    if (modal) { modal.remove(); }

    // Build picker modal
    var m = document.createElement('div');
    m.id = 'carePackageModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center';

    var typeLabel = type === 'gig' ? '🎤 Gig Pack' : '🎸 Rehearsal Pack';
    var typeColor = type === 'gig' ? '#f59e0b' : '#818cf8';

    m.innerHTML = `
    <div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-weight:800;font-size:1em;color:${typeColor}">${typeLabel}</div>
        <button onclick="document.getElementById('carePackageModal').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer">×</button>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:0.8em;color:#64748b;display:block;margin-bottom:6px">Select Setlist</label>
        <select id="cpSetlistPicker" class="app-select" style="width:100%"><option value="">Loading...</option></select>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:0.8em;color:#64748b;display:block;margin-bottom:6px">Add a note (optional)</label>
        <input id="cpNote" class="app-input" placeholder="e.g. Bring your A-game — Dark Star is in the set" style="width:100%;font-size:0.88em">
      </div>
      <div style="margin-bottom:16px">
        <label style="font-size:0.8em;color:#64748b;display:block;margin-bottom:6px">Include crib notes for each member?</label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.88em">
          <input type="checkbox" id="cpIncludeCribs" checked style="width:16px;height:16px">
          Yes — each bandmate sees their own crib notes
        </label>
      </div>
      <button onclick="carePackageBuild('${type}')" style="width:100%;background:linear-gradient(135deg,${typeColor},rgba(255,255,255,0.8));background:${type==='gig'?'rgba(245,158,11,0.2)':'rgba(129,140,248,0.2)'};border:1px solid ${type==='gig'?'rgba(245,158,11,0.4)':'rgba(129,140,248,0.4)'};color:${typeColor};padding:12px;border-radius:12px;font-size:0.9em;font-weight:700;cursor:pointer;margin-bottom:8px" id="cpBuildBtn">
        📦 Build & Send Care Package
      </button>
      <p style="font-size:0.72em;color:#475569;text-align:center">Loads all charts from Firebase → stores pack → sends SMS with tap-to-open link</p>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });

    // Populate setlist picker
    try {
        var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var sel = document.getElementById('cpSetlistPicker');
        if (setlists.length === 0) {
            sel.innerHTML = '<option value="">No setlists yet — build one first</option>';
        } else {
            sel.innerHTML = setlists.map(function(sl, i) {
                return '<option value="' + i + '">' + (sl.name || 'Setlist ' + (i+1)) + (sl.date ? ' — ' + sl.date : '') + '</option>';
            }).join('');
            // Pre-select if called from setlist editor
            if (preselectedSlIdx !== undefined && sel.options[preselectedSlIdx]) {
                sel.selectedIndex = preselectedSlIdx;
            }
        }
    } catch(e) {
        document.getElementById('cpSetlistPicker').innerHTML = '<option value="">Error loading setlists</option>';
    }
}

async function carePackageBuild(type) {
    var btn = document.getElementById('cpBuildBtn');
    var slIdx = parseInt(document.getElementById('cpSetlistPicker')?.value);
    var note = (document.getElementById('cpNote')?.value || '').trim();
    var includeCribs = document.getElementById('cpIncludeCribs')?.checked;

    if (isNaN(slIdx)) { showToast('Select a setlist first'); return; }

    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading charts...'; }

    try {
        var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var sl = setlists[slIdx];
        if (!sl) { showToast('Setlist not found'); return; }

        // Load songs + charts using existing parachute loader
        var songs = await parachuteLoadSetlistData(sl);

        // Optionally load crib notes per member per song
        if (includeCribs) {
            if (btn) btn.textContent = '⏳ Loading crib notes...';
            await Promise.all(songs.map(async function(s) {
                s.cribs = {};
                try {
                    var path = bandPath('songs/' + sanitizeFirebasePath(s.title) + '/personal_tabs');
                    var snap = await firebaseDB.ref(path).once('value');
                    var tabs = snap.val();
                    if (tabs && Array.isArray(tabs)) {
                        var emailToKey = {
                            'drewmerrill1029@gmail.com':'drew','cmjalbert@gmail.com':'chris',
                            'brian@hrestoration.com':'brian','pierce.d.hale@gmail.com':'pierce',
                            'jnault@fegholdings.com':'jay'
                        };
                        tabs.forEach(function(tab) {
                            var mKey = tab.memberKey || emailToKey[tab.addedBy] || null;
                            if (mKey && tab.notes) s.cribs[mKey] = tab.notes;
                        });
                    }
                } catch(e) {}
            }));
        }

        // Build pack object
        var packId = 'pack_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
        var expiresAt = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(); // 14 days
        var pack = {
            name: sl.name || 'Setlist',
            date: sl.date || '',
            type: type,
            note: note,
            songs: songs,
            createdBy: currentUserEmail || 'band',
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt
        };

        if (btn) btn.textContent = '⏳ Saving to Firebase...';

        // Save to Firebase — two paths:
        // 1. Band-scoped path (for band record-keeping)
        var fbPath = bandPath('care_packages/' + packId);
        await firebaseDB.ref(fbPath).set(pack);
        // 2. Public top-level path — readable by Cloudflare Worker without auth
        //    Firebase rules: /care_packages_public/{packId} .read: true
        try { await firebaseDB.ref('care_packages_public/' + packId).set(pack); }
        catch(epub) { console.warn('Public pack path failed (check Firebase rules):', epub.message); }

        // Build the URL — worker serves GET /pack/:id
        var packUrl = WORKER_BASE + '/pack/' + packId;

        // Close builder modal
        document.getElementById('carePackageModal')?.remove();

        // Show send modal with URL + per-member links
        carePackageShowSendModal(pack, packId, packUrl);

    } catch(e) {
        showToast('Error building pack: ' + e.message);
        if (btn) { btn.disabled = false; btn.textContent = '📦 Build & Send Care Package'; }
    }
}

function carePackageShowSendModal(pack, packId, packUrl) {
    var m = document.createElement('div');
    m.id = 'carePackageSendModal';
    m.style.cssText = 'position:fixed;inset:0;z-index:6000;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center';

    var typeLabel = pack.type === 'gig' ? '🎤 Gig Pack' : '🎸 Rehearsal Pack';
    var typeColor = pack.type === 'gig' ? '#f59e0b' : '#818cf8';

    // Per-member personal links (adds ?m=memberKey so they see their crib notes)
    var memberKeys = ['drew','chris','brian','pierce','jay'];
    var memberNames = {drew:'Drew',chris:'Chris',brian:'Brian',pierce:'Pierce',jay:'Jay'};
    var memberLinks = memberKeys.map(function(k) {
        return {key:k, name:memberNames[k], url: packUrl + '?m=' + k};
    });

    var memberLinkHtml = memberLinks.map(function(ml) {
        return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">' +
            '<span style="font-size:0.85em;flex:1;color:#cbd5e1">' + ml.name + '</span>' +
            '<button onclick="cpCopyLink(\'' + ml.url + '\')" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#64748b;padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">📋</button>' +
            '<button onclick="cpTextMember(\'' + ml.key + '\',\'' + packUrl + '\')" style="background:rgba(129,140,248,0.1);border:1px solid rgba(129,140,248,0.2);color:#a5b4fc;padding:3px 10px;border-radius:6px;font-size:0.72em;cursor:pointer">💬 Text</button>' +
            '</div>';
    }).join('');

    var expiryLabel = new Date(pack.expiresAt).toLocaleDateString('en-US',{month:'short',day:'numeric'});

    m.innerHTML = `
    <div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-weight:800;color:#22c55e">✅ Pack Ready!</div>
        <button onclick="document.getElementById('carePackageSendModal').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer">×</button>
      </div>
      <div style="font-size:0.8em;color:#64748b;margin-bottom:14px">${typeLabel} · Expires ${expiryLabel}</div>

      <!-- Universal link -->
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 12px;margin-bottom:12px">
        <div style="font-size:0.7em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">Universal Link (no login)</div>
        <div style="font-size:0.72em;color:#818cf8;word-break:break-all;margin-bottom:8px">${packUrl}</div>
        <div style="display:flex;gap:6px">
          <button onclick="cpCopyLink('${packUrl}')" style="flex:1;background:rgba(129,140,248,0.15);border:1px solid rgba(129,140,248,0.3);color:#a5b4fc;padding:7px;border-radius:8px;font-size:0.82em;font-weight:700;cursor:pointer">📋 Copy</button>
          <button onclick="cpSMSAll('${packUrl}','${pack.name}','${pack.date||''}')" style="flex:1;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.25);color:#86efac;padding:7px;border-radius:8px;font-size:0.82em;font-weight:700;cursor:pointer">💬 Text Everyone</button>
        </div>
      </div>

      <!-- Per-member links -->
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:10px 12px;margin-bottom:16px">
        <div style="font-size:0.7em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Personal Links (includes their crib notes)</div>
        ${memberLinkHtml}
      </div>

      <button onclick="document.getElementById('carePackageSendModal').remove()" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:10px;border-radius:12px;font-size:0.85em;cursor:pointer">Done</button>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', function(e) { if (e.target === m) m.remove(); });
}

function cpCopyLink(url) {
    navigator.clipboard.writeText(url).then(function() {
        showToast('📋 Link copied!');
    }).catch(function() {
        prompt('Copy this link:', url);
    });
}

async function cpSMSAll(packUrl, slName, slDate) {
    var phones = await notifGetAllPhones();
    var label = slName + (slDate ? ' — ' + slDate : '');
    var msg = '🎸 GrooveLinx Care Package: ' + label + '\n\nEverything you need — setlist, charts, your crib notes. No app login needed.\n\nTap to open: ' + packUrl;
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'No phone numbers saved yet — add them in the Band Contact Directory.');
        return;
    }
    notifSendSMS(phones, msg);
}

async function cpTextMember(memberKey, basePackUrl) {
    var contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    var contact = contacts[memberKey];
    var phone = contact && contact.phone;
    var name = {drew:'Drew',chris:'Chris',brian:'Brian',pierce:'Pierce',jay:'Jay'}[memberKey] || memberKey;
    var personalUrl = basePackUrl + '?m=' + memberKey;
    var msg = 'Hey ' + name + '! 🎸 Here\'s your personalized GrooveLinx care package — setlist, charts, and your crib notes all in one tap:\n\n' + personalUrl;
    if (!phone) {
        notifShowSMSCopyModal(msg, name + '\'s phone number isn\'t saved yet. Message copied — paste it into your text app.');
        return;
    }
    window.open('sms:' + phone + '?body=' + encodeURIComponent(msg));
}


async function renderNotificationsPage(el) {
    el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">Loading...</div>';

    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    const pushState = ('Notification' in window) ? Notification.permission : 'unsupported';
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const appUrl = window.location.origin + window.location.pathname.replace(/\/(index|test)\.html$/, '/');

    el.innerHTML = `
    <div class="page-header">
        <h1>🔔 Notifications</h1>
        <p>Install the app, share the link, manage contacts &amp; push alerts</p>
    </div>

    <!-- INSTALL APP CARD -->
    <div class="app-card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(129,140,248,0.06));border-color:rgba(99,102,241,0.35)">
        <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
            <img src="icon-192.png" style="width:56px;height:56px;border-radius:12px;flex-shrink:0" onerror="this.style.display='none'">
            <div style="flex:1;min-width:180px">
                <h3 style="margin:0 0 4px 0">📲 Install GrooveLinx App</h3>
                <p style="color:var(--text-dim);font-size:0.82em;margin:0">Add to your home screen — opens like a native app, no App Store needed</p>
            </div>
            ${isStandalone
                ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:6px 16px;font-size:0.82em;font-weight:700;flex-shrink:0">✓ Already Installed</span>'
                : `<button class="btn btn-primary" onclick="pwaTriggerInstall()" id="installAppBtn" style="flex-shrink:0">
                    Install App
                   </button>`
            }
        </div>
        <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.06)">
            <div style="font-weight:600;font-size:0.85em;margin-bottom:10px;color:var(--text-muted)">📨 Share the app link with your bandmates:</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <code style="flex:1;background:rgba(0,0,0,0.3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:0.8em;color:var(--accent-light);word-break:break-all;min-width:0">${appUrl}</code>
                <button class="btn btn-ghost btn-sm" style="flex-shrink:0" onclick="navigator.clipboard.writeText('${appUrl}').then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy',1800)})">📋 Copy</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <button class="btn btn-ghost btn-sm" onclick="notifShareAppLink('${appUrl}')">🔗 Share via Messages / Email</button>
                <button class="btn btn-ghost btn-sm" onclick="notifSMSAppLink('${appUrl}')">💬 Text the link to band</button>
            </div>
        </div>
        <div style="margin-top:12px;padding:10px 12px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:0.78em;color:var(--text-dim)">
            <strong style="color:var(--text-muted)">iPhone (Safari only):</strong> Open link in Safari → Share (□↑) → "Add to Home Screen" → turn <strong style="color:#10b981">Open as Web App ON</strong> → Add<br><br>
            <strong style="color:var(--text-muted)">Android (Chrome):</strong> Open in Chrome → tap the Install banner, or ⋮ menu → "Add to Home screen" → Install
        </div>
    </div>

    <!-- BAND CONTACT DIRECTORY -->
    <div class="app-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <h3 style="margin:0">👥 Band Contact Directory</h3>
            <button class="btn btn-primary btn-sm" onclick="notifAddMember()">+ Add</button>
        </div>
        <p style="color:var(--text-dim);font-size:0.82em;margin-bottom:14px">Tap ✏️ Edit on any member to add their phone number for group texts.</p>
        <div id="bandContactList"></div>
    </div>

    <!-- PUSH NOTIFICATIONS -->
    <div class="app-card" style="margin-bottom:16px">
        <h3 style="margin-bottom:12px">📲 Push Notifications (This Device)</h3>
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid var(--border);gap:12px;flex-wrap:wrap">
            <div>
                <div style="font-weight:600;margin-bottom:3px">
                    ${pushState==='granted'?'✅ Enabled':pushState==='denied'?'🚫 Blocked':'🔔 Not Enabled'}
                </div>
                <div style="font-size:0.78em;color:var(--text-dim)">
                    ${pushState==='granted'?'Alerts come to this device when band posts updates':pushState==='denied'?'Click the 🔒 lock in your address bar to allow':'Get alerts when the band posts updates'}
                </div>
            </div>
            ${pushState==='granted'
                ? '<span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:20px;padding:4px 14px;font-size:0.8em;font-weight:600">Active ✓</span>'
                : pushState!=='denied'
                    ? '<button class="btn btn-primary" onclick="notifRequestPush()">Enable Push</button>'
                    : ''}
        </div>
    </div>

    <!-- SEND PRACTICE PLAN -->
    <div class="app-card" style="margin-bottom:16px">
        <h3 style="margin-bottom:6px">📋 Share Practice Plan</h3>
        <p style="color:var(--text-dim);font-size:0.85em;margin-bottom:14px">Send a rehearsal plan to the whole band</p>
        <div class="form-row" style="margin-bottom:12px">
            <label class="form-label">Select Rehearsal</label>
            <select class="app-select" id="notifRehearsalPicker" style="width:100%">
                <option value="">Loading...</option>
            </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-success" style="width:100%" onclick="notifSendSMSPracticePlan()">💬 Open Group Text (SMS)</button>
            <button class="btn btn-primary" style="width:100%" onclick="notifSendPracticePlanPush()">🔔 Send Push Notification</button>
        </div>
        <p style="font-size:0.75em;color:var(--text-dim);margin-top:8px">SMS opens your Messages app pre-filled with the plan. Push sends an in-app alert.</p>
    </div>


    <!-- CARE PACKAGE -->
    <div class="app-card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(102,126,234,0.1),rgba(16,185,129,0.06));border-color:rgba(102,126,234,0.3)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span style="font-size:2em">🪂</span>
            <div>
                <h3 style="margin:0;color:#a5b4fc">Send Care Package</h3>
                <p style="color:var(--text-dim);font-size:0.8em;margin:3px 0 0">One tap → your bandmates get every chart, key, BPM &amp; their crib notes. No app. No login.</p>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <button onclick="carePackageSend('rehearsal')" style="background:rgba(129,140,248,0.12);border:1px solid rgba(129,140,248,0.3);color:#a5b4fc;padding:12px 8px;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;text-align:center">
                <div style="font-size:1.4em;margin-bottom:4px">🎸</div>
                <div>Rehearsal Pack</div>
                <div style="font-size:0.72em;color:#64748b;margin-top:2px;font-weight:400">Charts + crib notes</div>
            </button>
            <button onclick="carePackageSend('gig')" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#fbbf24;padding:12px 8px;border-radius:12px;font-size:0.88em;font-weight:700;cursor:pointer;text-align:center">
                <div style="font-size:1.4em;margin-bottom:4px">🎤</div>
                <div>Gig Pack</div>
                <div style="font-size:0.72em;color:#64748b;margin-top:2px;font-weight:400">Full setlist + all charts</div>
            </button>
        </div>
        <div style="font-size:0.72em;color:#475569;display:flex;gap:12px;flex-wrap:wrap">
            <span>✓ Personalized per member</span>
            <span>✓ No app required</span>
            <span>✓ Expires in 14 days</span>
        </div>
    </div>

    <!-- CUSTOM ANNOUNCEMENT -->
    <div class="app-card">
        <h3 style="margin-bottom:6px">📢 Send Announcement</h3>
        <p style="color:var(--text-dim);font-size:0.85em;margin-bottom:12px">Quick message to the whole band</p>
        <textarea class="app-textarea" id="announcementText" rows="3" placeholder="e.g. Practice moved to Saturday 7pm — bring your A-game!"></textarea>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
            <button class="btn btn-success" style="flex:1;min-width:130px" onclick="notifSendAnnouncementSMS()">💬 Group Text</button>
            <button class="btn btn-primary" style="flex:1;min-width:130px" onclick="notifSendAnnouncementPush()">🔔 Push</button>
        </div>
    </div>`;

    renderBandContactList(contacts);
    notifPopulateRehearsalPicker();
}

// ─────────────────────────────────────────────────────────────────────────────
// BAND CONTACT DIRECTORY — editable, stored in Firebase by member key
// ─────────────────────────────────────────────────────────────────────────────

function renderBandContactList(contacts) {
    const el = document.getElementById('bandContactList');
    if (!el) return;

    // Build rows: start with data.js bandMembers, overlay stored contacts
    const rows = Object.entries(bandMembers).map(([key, m]) => {
        const stored = contacts[key] || {};
        return { key, name: stored.name || m.name, role: stored.role || m.role || '', phone: stored.phone || '', email: stored.email || '', isCore: true };
    });
    // Any extra members added manually (not in data.js)
    Object.entries(contacts).forEach(([key, c]) => {
        if (!bandMembers[key]) rows.push({ key, name: c.name||key, role: c.role||'', phone: c.phone||'', email: c.email||'', isCore: false });
    });

    if (rows.length === 0) {
        el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim)">No contacts yet. Click + Add to start.</div>';
        return;
    }

    el.innerHTML = rows.map(r => `
    <div id="contact-row-${r.key}" style="border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:8px;background:rgba(255,255,255,0.02)">

        <!-- Header row: avatar + name + buttons -->
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:1.4em;flex-shrink:0;width:30px;text-align:center">${r.isCore ? (bandMembers[r.key]?.emoji||'🎸') : '👤'}</span>
            <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.95em">${r.name}</div>
                <div style="font-size:0.75em;color:var(--text-dim)">${r.role}</div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0">
                ${r.phone ? `<button onclick="notifTextOne('${r.phone.replace(/'/g,"&#39;")}','${r.name.replace(/'/g,"&#39;")}')" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:0.72em;font-weight:600;white-space:nowrap">💬 Text</button>` : ''}
                <button onclick="notifToggleEdit('${r.key}')" style="background:rgba(102,126,234,0.12);color:var(--accent-light);border:1px solid rgba(102,126,234,0.25);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:0.72em;font-weight:600">✏️ Edit</button>
                ${!r.isCore ? `<button onclick="notifDeleteMember('${r.key}')" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.2);border-radius:6px;padding:4px 7px;cursor:pointer;font-size:0.72em">✕</button>` : ''}
            </div>
        </div>

        <!-- Contact info display -->
        <div id="contact-info-${r.key}" style="display:flex;gap:14px;flex-wrap:wrap;font-size:0.82em;padding-left:40px">
            <span style="color:${r.phone?'var(--text-muted)':'var(--text-dim)'}">📞 ${r.phone||'<em style="color:var(--text-dim)">No phone — tap Edit</em>'}</span>
            <span style="color:${r.email?'var(--text-muted)':'var(--text-dim)'}">✉️ ${r.email||'<em style="color:var(--text-dim)">No email</em>'}</span>
        </div>

        <!-- Edit form (hidden by default) -->
        <div id="contact-edit-${r.key}" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">Name</label>
                    <input class="app-input" id="cedit-name-${r.key}" value="${r.name}" style="font-size:0.85em">
                </div>
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">Role / Instrument</label>
                    <input class="app-input" id="cedit-role-${r.key}" value="${r.role}" placeholder="e.g. Bass" style="font-size:0.85em">
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">📞 Phone</label>
                    <input class="app-input" id="cedit-phone-${r.key}" value="${r.phone}" placeholder="+1 404 555 0123" type="tel" style="font-size:0.85em">
                </div>
                <div>
                    <label style="font-size:0.75em;color:var(--text-dim);display:block;margin-bottom:3px">✉️ Email</label>
                    <input class="app-input" id="cedit-email-${r.key}" value="${r.email}" placeholder="name@email.com" type="email" style="font-size:0.85em">
                </div>
            </div>
            <div style="display:flex;gap:6px">
                <button class="btn btn-primary btn-sm" style="flex:1" onclick="notifSaveMemberContact('${r.key}')">💾 Save</button>
                <button class="btn btn-ghost btn-sm" onclick="notifToggleEdit('${r.key}')">Cancel</button>
            </div>
        </div>
    </div>`).join('');
}

function notifToggleEdit(key) {
    const info = document.getElementById(`contact-info-${key}`);
    const form = document.getElementById(`contact-edit-${key}`);
    if (!info || !form) return;
    const opening = form.style.display === 'none';
    form.style.display = opening ? 'block' : 'none';
    info.style.display = opening ? 'none' : 'flex';
    if (opening) setTimeout(() => document.getElementById(`cedit-phone-${key}`)?.focus(), 50);
}

async function notifSaveMemberContact(key) {
    const name  = document.getElementById(`cedit-name-${key}`)?.value.trim() || '';
    const role  = document.getElementById(`cedit-role-${key}`)?.value.trim() || '';
    const phone = document.getElementById(`cedit-phone-${key}`)?.value.trim() || '';
    const email = document.getElementById(`cedit-email-${key}`)?.value.trim() || '';

    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    contacts[key] = { name, role, phone, email, updatedAt: new Date().toISOString() };
    await saveBandDataToDrive('_band', 'band_contacts', contacts);

    // Update info display without full re-render
    const infoEl = document.getElementById(`contact-info-${key}`);
    if (infoEl) {
        infoEl.innerHTML = `
            <span style="color:${phone?'var(--text-muted)':'var(--text-dim)'}">📞 ${phone||'<em style="color:var(--text-dim)">No phone — tap Edit</em>'}</span>
            <span style="color:${email?'var(--text-muted)':'var(--text-dim)'}">✉️ ${email||'<em style="color:var(--text-dim)">No email</em>'}</span>`;
    }
    // Refresh Text button visibility
    const headerBtns = document.querySelector(`#contact-row-${key} div[style*="display:flex"][style*="gap:5px"]`);
    if (headerBtns && phone) {
        const existingText = headerBtns.querySelector('[onclick*="notifTextOne"]');
        if (!existingText) {
            const btn = document.createElement('button');
            btn.innerHTML = '💬 Text';
            btn.style.cssText = 'background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:4px 9px;cursor:pointer;font-size:0.72em;font-weight:600;white-space:nowrap';
            btn.onclick = () => notifTextOne(phone, name);
            headerBtns.insertBefore(btn, headerBtns.firstChild);
        }
    }

    notifToggleEdit(key);
    notifToast(`✅ ${name || key} saved`);
}

function notifAddMember() {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:400px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 style="margin:0;color:var(--accent-light)">➕ Add Member</h3>
            <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        <div class="form-row"><label class="form-label">Name *</label>
            <input class="app-input" id="newMemberName" placeholder="e.g. Alex" autofocus></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">Role / Instrument</label>
            <input class="app-input" id="newMemberRole" placeholder="e.g. Keyboards"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">📞 Phone</label>
            <input class="app-input" id="newMemberPhone" type="tel" placeholder="+1 404 555 0123"></div>
        <div class="form-row" style="margin-top:8px"><label class="form-label">✉️ Email</label>
            <input class="app-input" id="newMemberEmail" type="email" placeholder="alex@email.com"></div>
        <div style="display:flex;gap:8px;margin-top:16px">
            <button class="btn btn-primary" style="flex:1" onclick="notifConfirmAddMember()">Add Member</button>
            <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Cancel</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

async function notifConfirmAddMember() {
    const name  = document.getElementById('newMemberName')?.value.trim();
    const role  = document.getElementById('newMemberRole')?.value.trim() || '';
    const phone = document.getElementById('newMemberPhone')?.value.trim() || '';
    const email = document.getElementById('newMemberEmail')?.value.trim() || '';
    if (!name) { alert('Name is required'); return; }
    const key = name.toLowerCase().replace(/\W+/g,'_') + '_' + Date.now().toString().slice(-4);
    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    contacts[key] = { name, role, phone, email, addedAt: new Date().toISOString() };
    await saveBandDataToDrive('_band', 'band_contacts', contacts);
    document.querySelector('[style*="position:fixed"][style*="z-index:9999"]')?.remove();
    notifToast(`✅ ${name} added`);
    showPage('notifications');
}

async function notifDeleteMember(key) {
    if (!confirm('Remove this contact?')) return;
    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    delete contacts[key];
    await saveBandDataToDrive('_band', 'band_contacts', contacts);
    document.getElementById(`contact-row-${key}`)?.remove();
    notifToast('Contact removed');
}

function notifShareAppLink(url) {
    if (navigator.share) {
        navigator.share({
            title: 'GrooveLinx — Where Bands Lock In',
            text: '🎸 Our band app — songs, setlists, rehearsals, harmonies. Add it to your home screen!',
            url: url
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(url).then(() => notifToast('📋 Link copied!'));
    }
}

function notifIsDesktop() {
    return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function notifSendSMS(phones, msg) {
    if (notifIsDesktop()) {
        navigator.clipboard.writeText(msg).catch(() => {});
        notifShowSMSCopyModal(msg,
            'You\'re on a desktop — group SMS doesn\'t work reliably here (Mac Messages only takes the first recipient). ' +
            'The message has been copied to your clipboard. Paste it into your band group text, or open this page on your phone to auto-send to everyone at once.'
        );
        return;
    }
    window.open(`sms:${phones.join(',')}?body=${encodeURIComponent(msg)}`);
}

async function notifSMSAppLink(url) {
    const phones = await notifGetAllPhones();
    const msg = `🎸 Hey! Here\'s the GrooveLinx band app — add it to your home screen so you always have it:\n\n${url}\n\n📱 iPhone (Safari only — not Chrome):\n1. Open the link in Safari\n2. Tap the Share button (□↑) at the bottom\n3. Tap "Add to Home Screen"\n4. Make sure "Open as Web App" is ON ✅\n5. Tap Add\n\n🤖 Android (Chrome):\n1. Open the link in Chrome\n2. Tap the Install banner that appears, OR tap ⋮ menu → "Add to Home screen"\n3. Tap Install\n\nOpens like a real app — no browser bar, works offline!`;
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'Add phone numbers in the Band Contact Directory to auto-fill recipients.');
        return;
    }
    notifSendSMS(phones, msg);
}

function notifTextOne(phone, name) {
    const appUrl = window.location.href.split('?')[0];
    const msg = `Hey ${name}! 🎸 Check the GrooveLinx app for updates: ${appUrl}`;
    window.open(`sms:${phone}?body=${encodeURIComponent(msg)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SEND HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function notifPopulateRehearsalPicker() {
    const sel = document.getElementById('notifRehearsalPicker');
    if (!sel) return;
    const events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    const today = new Date().toISOString().split('T')[0];
    const rehearsals = events.filter(e => e.type === 'rehearsal').sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    if (rehearsals.length === 0) {
        sel.innerHTML = '<option value="">No rehearsals — add one on the Calendar page</option>';
        return;
    }
    const upcoming = rehearsals.filter(r => r.date >= today);
    const past = rehearsals.filter(r => r.date < today);
    sel.innerHTML =
        (upcoming.length ? '<optgroup label="Upcoming">' + upcoming.map(r=>`<option value="${r.date}">🎸 ${formatPracticeDate(r.date)} — ${r.title||'Rehearsal'}</option>`).join('') + '</optgroup>' : '') +
        (past.length ? '<optgroup label="Past">' + past.slice(-3).reverse().map(r=>`<option value="${r.date}">✓ ${formatPracticeDate(r.date)} — ${r.title||'Rehearsal'}</option>`).join('') + '</optgroup>' : '');
}

async function notifGetAllPhones() {
    const contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
    const phones = [];
    // Core band members first
    Object.keys(bandMembers).forEach(key => { if (contacts[key]?.phone) phones.push(contacts[key].phone); });
    // Extra contacts
    Object.entries(contacts).forEach(([key, c]) => { if (!bandMembers[key] && c.phone) phones.push(c.phone); });
    return phones;
}

// ══════════════════════════════════════════════════════════════════════════
// CARE PACKAGE SYSTEM
// Curated, server-rendered gig/rehearsal pack delivered via SMS.
// Flow: buildPack → save to Firebase → worker serves /pack/:id → SMS link
// ══════════════════════════════════════════════════════════════════════════

// var WORKER_URL → js/core/worker-api.js (Wave-1 refactor)
var FIREBASE_DB_URL = 'https://deadcetera-35424-default-rtdb.firebaseio.com';

// ── Unique pack ID generator ──────────────────────────────────────────────
function carePackageGenId() {
    var chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no 0/O/1/I confusion
    var id = '';
    for (var i = 0; i < 8; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

// ── Load all data for a setlist (charts + key/bpm + crib notes per member) ─
async function carePackageLoadSongs(sl) {
    var songs = [];
    (sl.sets || []).forEach(function(set, si) {
        (set.songs || []).forEach(function(item) {
            var t = typeof item === 'string' ? item : item.title;
            if (t) songs.push({
                title: t,
                setName: set.name || 'Set ' + (si + 1),
                key: '',
                bpm: '',
                chart: '',
                cribs: {},
                segue: typeof item === 'object' ? (item.segue || 'stop') : 'stop'
            });
        });
    });

    // Load key/bpm + chart + crib notes for each song in parallel
    await Promise.all(songs.map(async function(s) {
        // Key + BPM from allSongs cache
        var sd = allSongs.find(function(a) { return a.title === s.title; });
        s.key = sd && sd.key ? sd.key : '';
        s.bpm = sd && sd.bpm ? String(sd.bpm) : '';

        // Chord chart
        try {
            var cd = await loadBandDataFromDrive(s.title, 'chart');
            if (cd && cd.text && cd.text.trim()) s.chart = cd.text.trim();
        } catch (e) {}

        // Crib notes: personal tabs text per member
        try {
            var tabs = await loadPersonalTabs(s.title) || [];
            tabs.forEach(function(tab) {
                var mk = tab.memberKey;
                if (mk && tab.notes) {
                    if (!s.cribs[mk]) s.cribs[mk] = '';
                    s.cribs[mk] += (s.cribs[mk] ? '\n' : '') + (tab.label ? tab.label + ': ' : '') + tab.notes;
                }
            });
        } catch (e) {}
    }));

    return songs;
}

// ── Save pack to Firebase ─────────────────────────────────────────────────
async function carePackageSave(packData) {
    var packId = carePackageGenId();
    var path = bandPath('care_packages/' + packId);
    await firebaseDB.ref(path).set(packData);

    // Also write to public node (no bandPath prefix) so worker can read it
    // Worker reads /bands/deadcetera/care_packages/:id
    var publicPath = bandPath('care_packages/' + packId);
    await firebaseDB.ref(publicPath).set(packData);

    return packId;
}

// ── Main entry: show the care package send modal ──────────────────────────
async function carePackageShowModal() {
    var existing = document.getElementById('carePackageModal');
    if (existing) existing.remove();

    // Load setlists + calendar events for pickers
    var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
    var events = toArray(await loadBandDataFromDrive('_band', 'calendar_events') || []);
    var today = new Date().toISOString().split('T')[0];
    var upcoming = events.filter(function(e) { return (e.type === 'rehearsal' || e.type === 'gig') && e.date >= today; })
        .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); });

    var modal = document.createElement('div');
    modal.id = 'carePackageModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5100;background:rgba(0,0,0,0.75);display:flex;align-items:flex-end;justify-content:center';

    var slOptions = setlists.map(function(sl, i) {
        return '<option value="' + i + '">' + (sl.name || 'Untitled Setlist') + (sl.date ? ' — ' + sl.date : '') + '</option>';
    }).join('');

    var eventOptions = upcoming.length
        ? upcoming.map(function(e) {
            var icon = e.type === 'gig' ? '🎤' : '🎸';
            return '<option value="' + e.date + '">' + icon + ' ' + (e.title || e.type) + ' — ' + e.date + '</option>';
          }).join('')
        : '<option value="">No upcoming events</option>';

    modal.innerHTML = '<div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<div>' +
        '<div style="font-weight:800;font-size:1.05em">🪂 Send Care Package</div>' +
        '<div style="font-size:0.75em;color:#64748b;margin-top:2px">Delivers charts + crib notes to the whole band — no app needed</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'carePackageModal\').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em;flex-shrink:0">×</button>' +
        '</div>' +

        '<div style="display:flex;flex-direction:column;gap:12px">' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Type</label>' +
        '<div style="display:flex;gap:8px">' +
        '<button id="cpTypeRehearsal" onclick="cpSetType(\'rehearsal\')" style="flex:1;padding:8px;border-radius:8px;font-size:0.85em;font-weight:600;cursor:pointer;background:rgba(129,140,248,0.2);border:1px solid rgba(129,140,248,0.4);color:#a5b4fc">🎸 Rehearsal</button>' +
        '<button id="cpTypeGig" onclick="cpSetType(\'gig\')" style="flex:1;padding:8px;border-radius:8px;font-size:0.85em;font-weight:600;cursor:pointer;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b">🎤 Gig</button>' +
        '</div>' +
        '</div>' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Setlist</label>' +
        '<select id="cpSetlistPicker" class="app-select" style="width:100%;font-size:0.88em">' +
        (slOptions || '<option value="">No setlists yet</option>') +
        '</select>' +
        '</div>' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Event (optional)</label>' +
        '<select id="cpEventPicker" class="app-select" style="width:100%;font-size:0.88em">' +
        '<option value="">None</option>' +
        eventOptions +
        '</select>' +
        '</div>' +

        '<div>' +
        '<label style="font-size:0.75em;color:#64748b;display:block;margin-bottom:4px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em">Message to band (optional)</label>' +
        '<textarea id="cpNote" class="app-textarea" rows="2" placeholder="e.g. Heads up — new set order, check the charts!" style="font-size:0.85em;resize:none"></textarea>' +
        '</div>' +

        '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:10px 12px;font-size:0.78em;color:#fbbf24">' +
        '🪂 Each bandmate gets a personalized SMS with their crib notes highlighted. The link works in any browser — no app, no login.' +
        '</div>' +

        '<button id="cpSendBtn" onclick="carePackageBuild()" style="background:linear-gradient(135deg,#667eea,#764ba2);border:none;color:white;padding:13px;border-radius:12px;font-size:0.95em;font-weight:700;cursor:pointer;width:100%">🪂 Build &amp; Send Care Package</button>' +
        '</div></div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    window._cpType = 'rehearsal';
}

function cpSetType(type) {
    window._cpType = type;
    var rBtn = document.getElementById('cpTypeRehearsal');
    var gBtn = document.getElementById('cpTypeGig');
    if (type === 'rehearsal') {
        rBtn.style.cssText += ';background:rgba(129,140,248,0.2);border:1px solid rgba(129,140,248,0.4);color:#a5b4fc';
        gBtn.style.cssText += ';background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b';
    } else {
        gBtn.style.cssText += ';background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.35);color:#fbbf24';
        rBtn.style.cssText += ';background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#64748b';
    }
}

// ── Build the pack, save it, send SMS to each member ──────────────────────
async function carePackageBuild() {
    var btn = document.getElementById('cpSendBtn');
    if (btn) { btn.textContent = '⏳ Loading charts...'; btn.disabled = true; }

    try {
        var slIdx = parseInt(document.getElementById('cpSetlistPicker')?.value || '0');
        var eventDate = document.getElementById('cpEventPicker')?.value || '';
        var note = (document.getElementById('cpNote')?.value || '').trim();
        var type = window._cpType || 'rehearsal';

        var setlists = toArray(await loadBandDataFromDrive('_band', 'setlists') || []);
        var sl = setlists[slIdx];
        if (!sl) { showToast('No setlist selected'); return; }

        if (btn) btn.textContent = '⏳ Loading songs & charts...';
        var songs = await carePackageLoadSongs(sl);

        var expires = new Date();
        expires.setDate(expires.getDate() + 14); // 14-day link

        var packData = {
            name: sl.name || 'Setlist',
            date: sl.date || eventDate || '',
            type: type,
            note: note,
            songs: songs,
            createdBy: currentUserEmail || 'unknown',
            createdAt: new Date().toISOString(),
            expiresAt: expires.toISOString()
        };

        if (btn) btn.textContent = '⏳ Saving to Firebase...';
        var packId = await carePackageSave(packData);
        var baseUrl = WORKER_URL + '/pack/' + packId;

        if (btn) btn.textContent = '⏳ Building SMS messages...';

        // Send a personalized SMS to each band member
        var contacts = await loadBandDataFromDrive('_band', 'band_contacts') || {};
        var membersSent = 0;

        // Collect all members with phones
        var recipients = [];
        Object.keys(bandMembers).forEach(function(mk) {
            var contact = contacts[mk];
            var member = bandMembers[mk];
            if (contact && contact.phone) {
                recipients.push({ key: mk, name: member.name || mk, phone: contact.phone });
            }
        });

        // Also extra contacts
        Object.entries(contacts).forEach(function(pair) {
            var k = pair[0], c = pair[1];
            if (!bandMembers[k] && c.phone) {
                recipients.push({ key: k, name: c.name || k, phone: c.phone });
            }
        });

        document.getElementById('carePackageModal')?.remove();

        if (recipients.length === 0) {
            // No phone numbers — show the link to copy manually
            carePackageShowLinkModal(baseUrl, packData);
            return;
        }

        // Show the delivery modal with per-member SMS openers
        carePackageShowDeliveryModal(baseUrl, packData, recipients, packId);

    } catch (e) {
        showToast('Error building pack: ' + e.message);
        if (btn) { btn.textContent = '🪂 Build & Send Care Package'; btn.disabled = false; }
    }
}

// ── Delivery modal: per-member SMS buttons ────────────────────────────────
function carePackageShowDeliveryModal(baseUrl, packData, recipients, packId) {
    var existing = document.getElementById('cpDeliveryModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'cpDeliveryModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5200;background:rgba(0,0,0,0.8);display:flex;align-items:flex-end;justify-content:center';

    var typeLabel = packData.type === 'gig' ? '🎤 Gig Pack' : '🎸 Rehearsal Pack';
    var packName = packData.name + (packData.date ? ' — ' + packData.date : '');

    var recipientBtns = recipients.map(function(r) {
        var memberUrl = baseUrl + '?m=' + encodeURIComponent(r.key);
        var msg = carePackageBuildSMS(r.name, packData, memberUrl);
        var encodedMsg = encodeURIComponent(msg);
        var smsHref = 'sms:' + r.phone + '?body=' + encodedMsg;
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px">' +
            '<div>' +
            '<div style="font-size:0.88em;font-weight:600;color:#e2e8f0">' + r.name + '</div>' +
            '<div style="font-size:0.7em;color:#475569">' + r.phone + '</div>' +
            '</div>' +
            '<a href="' + smsHref + '" style="background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#86efac;padding:6px 14px;border-radius:8px;font-size:0.82em;font-weight:700;text-decoration:none;flex-shrink:0">💬 Text</a>' +
            '</div>';
    }).join('');

    // "Text everyone at once" button
    var allPhones = recipients.map(function(r) { return r.phone; }).join(',');
    var groupMsg = carePackageBuildSMS('everyone', packData, baseUrl);
    var groupSms = 'sms:' + allPhones + '?body=' + encodeURIComponent(groupMsg);

    modal.innerHTML = '<div style="background:#1e293b;border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:20px;max-height:85vh;overflow-y:auto">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
        '<div style="font-weight:800;font-size:1em">✅ Care Package Ready</div>' +
        '<button onclick="document.getElementById(\'cpDeliveryModal\').remove()" style="background:rgba(255,255,255,0.08);border:none;color:#94a3b8;width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em">×</button>' +
        '</div>' +
        '<div style="font-size:0.78em;color:#64748b;margin-bottom:14px">' + typeLabel + ' — ' + packName + '</div>' +

        '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:0.78em">' +
        '<div style="font-size:0.7em;color:#818cf8;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Pack Link</div>' +
        '<div style="display:flex;align-items:center;gap:8px">' +
        '<code style="color:#94a3b8;font-size:0.85em;flex:1;word-break:break-all">' + baseUrl + '</code>' +
        '<button onclick="navigator.clipboard.writeText(\'' + baseUrl + '\').then(function(){showToast(\'Copied!\')})" style="background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);color:#a5b4fc;padding:4px 10px;border-radius:6px;font-size:0.75em;cursor:pointer;flex-shrink:0;white-space:nowrap">Copy</button>' +
        '</div>' +
        '</div>' +

        '<div style="margin-bottom:12px">' +
        '<a href="' + groupSms + '" style="display:block;background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px;border-radius:12px;text-align:center;font-weight:700;font-size:0.9em;text-decoration:none;margin-bottom:8px">💬 Text Everyone at Once</a>' +
        '<div style="font-size:0.72em;color:#475569;text-align:center">Opens group text with the care package link</div>' +
        '</div>' +

        '<div style="font-size:0.72em;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px">Or text individually (personalized with their crib notes):</div>' +

        '<div style="display:flex;flex-direction:column;gap:6px">' + recipientBtns + '</div>' +

        '<div style="margin-top:14px;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:0.72em;color:#475569">' +
        '🔗 Link stays active for 14 days — works on any phone, no login needed.' +
        '</div>' +
        '</div>';

    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}

// ── Build the SMS message body ────────────────────────────────────────────
function carePackageBuildSMS(recipientName, packData, packUrl) {
    var typeEmoji = packData.type === 'gig' ? '🎤' : '🎸';
    var greeting = recipientName === 'everyone' ? 'Hey band' : 'Hey ' + recipientName.split(' ')[0];
    var eventLine = packData.date ? ' for ' + packData.date : '';
    var noteLine = packData.note ? '\n\n' + packData.note : '';
    var songCount = (packData.songs || []).length;

    return greeting + ' —' + noteLine + '\n\n' +
        typeEmoji + ' ' + (packData.type === 'gig' ? 'Gig' : 'Rehearsal') + ' care package' + eventLine + ' is ready:\n' +
        packData.name + ' (' + songCount + ' songs)\n\n' +
        'Tap to see charts, key/BPM, and your crib notes — no login needed:\n' +
        packUrl + '\n\n' +
        '— GrooveLinx 🎸';
}

// ── Fallback: no phones saved, just show the link ─────────────────────────
function carePackageShowLinkModal(baseUrl, packData) {
    showToast('Pack saved! No phone numbers found — copy the link below.');
    var modal = document.createElement('div');
    modal.id = 'cpLinkModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:5200;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = '<div style="background:#1e293b;border-radius:16px;padding:20px;max-width:400px;width:100%">' +
        '<div style="font-weight:800;margin-bottom:8px">🪂 Care Package Ready</div>' +
        '<div style="font-size:0.78em;color:#64748b;margin-bottom:12px">Share this link — works on any phone, no login needed:</div>' +
        '<code style="display:block;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;font-size:0.78em;color:#a5b4fc;word-break:break-all;margin-bottom:12px">' + baseUrl + '</code>' +
        '<div style="display:flex;gap:8px">' +
        '<button onclick="navigator.clipboard.writeText(\'' + baseUrl + '\').then(function(){showToast(\'Copied!\')})" style="flex:1;background:rgba(102,126,234,0.2);border:1px solid rgba(102,126,234,0.4);color:#a5b4fc;padding:10px;border-radius:10px;font-size:0.88em;font-weight:700;cursor:pointer">📋 Copy Link</button>' +
        '<button onclick="document.getElementById(\'cpLinkModal\').remove()" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:#64748b;padding:10px;border-radius:10px;font-size:0.88em;cursor:pointer">Close</button>' +
        '</div>' +
        '<div style="margin-top:12px;font-size:0.7em;color:#475569">Add phone numbers in Band Contact Directory to auto-text next time.</div>' +
        '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}


async function notifSendSMSPracticePlan() {
    const dateStr = document.getElementById('notifRehearsalPicker')?.value;
    if (!dateStr) { alert('Please select a rehearsal first'); return; }
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const displayDate = formatPracticeDate(dateStr);
    const songs = toArray(plan.songs||[]).map(s=>`• ${s.title}${s.focus?' ('+s.focus+')':''}`).join('\n') || '• TBD';
    const goals = toArray(plan.goals||[]).map(g=>`• ${g}`).join('\n') || '• TBD';
    const appUrl = window.location.href.split('?')[0];
    const msg = `🎸 DEADCETERA — ${displayDate}${plan.startTime?'\n⏰ '+plan.startTime:''}${plan.location?'\n📍 '+plan.location:''}\n\nSONGS:\n${songs}\n\nGOALS:\n${goals}${plan.notes?'\n\nNOTES:\n'+plan.notes:''}\n\n📱 Full plan: ${appUrl}`;
    const phones = await notifGetAllPhones();
    if (phones.length === 0) {
        notifShowSMSCopyModal(msg, 'No phone numbers saved yet — tap ✏️ Edit on each band member above to add their number, then try again.');
        return;
    }
    notifSendSMS(phones, msg);
}

async function notifSendPracticePlanPush() {
    const dateStr = document.getElementById('notifRehearsalPicker')?.value;
    if (!dateStr) { alert('Please select a rehearsal first'); return; }
    const plan = await loadBandDataFromDrive('_band', `practice_plan_${dateStr}`) || {};
    const songs = toArray(plan.songs||[]).map(s=>s.title).join(', ') || 'TBD';
    await notifSendPush(`Practice Plan — ${formatPracticeDate(dateStr)}`, `Songs: ${songs.substring(0,80)}${songs.length>80?'...':''}\nOpen the app for the full plan.`, 'practice_plan');
}

async function notifSendPush(title, body, eventType) {
    const log = toArray(await loadBandDataFromDrive('_band', 'notif_log') || []);
    log.unshift({ title, body, eventType, sentBy: currentUserEmail, sentAt: new Date().toISOString() });
    await saveBandDataToDrive('_band', 'notif_log', log.slice(0,50));
    if (Notification.permission === 'granted') {
        new Notification(`🔗 GrooveLinx: ${title}`, { body, icon: '/favicon.ico', tag: eventType });
        notifToast('🔔 Notification sent!');
    } else {
        notifToast('⚠️ Enable push notifications first');
    }
}

async function notifRequestPush() {
    if (!('Notification' in window)) { alert('This browser does not support push notifications.'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
        notifToast('✅ Push notifications enabled!');
        showPage('notifications');
    } else if (perm === 'denied') {
        alert('Notifications blocked. Click the 🔒 lock in your browser address bar and allow notifications for this site.');
    }
}

async function notifSendAnnouncementPush() {
    const msg = document.getElementById('announcementText')?.value.trim();
    if (!msg) { alert('Please type a message first'); return; }
    await notifSendPush('Band Announcement', msg, 'announcements');
    document.getElementById('announcementText').value = '';
}

async function notifSendAnnouncementSMS() {
    const msg = document.getElementById('announcementText')?.value.trim();
    if (!msg) { alert('Please type a message first'); return; }
    const appUrl = window.location.href.split('?')[0];
    const full = `🔗 GrooveLinx: ${msg}\n\n📱 ${appUrl}`;
    const phones = await notifGetAllPhones();
    if (phones.length === 0) {
        notifShowSMSCopyModal(full, 'No phone numbers saved — tap ✏️ Edit on each member above to add their number.');
        return;
    }
    notifSendSMS(phones, full);
}

function notifShowSMSCopyModal(msg, hint) {
    const isDesktop = notifIsDesktop();
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    modal.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:500px;width:100%;color:var(--text)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="margin:0;color:var(--accent-light)">💬 ${isDesktop ? 'Message Not Auto-Sent' : 'Copy & Send'}</h3>
            <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.2em">✕</button>
        </div>
        ${isDesktop ? `
        <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:flex-start">
            <span style="font-size:1.4em;flex-shrink:0">⚠️</span>
            <div style="font-size:0.83em;color:#fca5a5;line-height:1.5">
                <strong style="display:block;margin-bottom:4px;font-size:1em">Group text didn't send — you're on desktop.</strong>
                Mac can only text one person at a time via SMS. <strong>Open this page on your phone</strong> to auto-send to the whole band at once, or copy the message below and paste it into your group chat manually.
            </div>
        </div>
        <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:8px 12px;font-size:0.8em;color:#6ee7b7;margin-bottom:10px">
            ✅ Message already copied to your clipboard — just paste it!
        </div>` 
        : hint ? `<p style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:8px;padding:8px 12px;font-size:0.82em;color:var(--yellow);margin-bottom:10px">⚠️ ${hint}</p>` : ''}
        <textarea class="app-textarea" rows="8" style="font-size:0.78em;font-family:monospace" readonly>${msg}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary" style="flex:1"
                onclick="navigator.clipboard.writeText(this.closest('[style*=fixed]').querySelector('textarea').value).then(()=>{this.textContent='✅ Copied!';setTimeout(()=>this.textContent='📋 Copy Message',1800)})">
                📋 Copy Message
            </button>
            <button class="btn btn-ghost" onclick="this.closest('[style*=fixed]').remove()">Close</button>
        </div>
    </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
}

function notifToast(msg) {
    document.querySelectorAll('.notif-toast').forEach(t=>t.remove());
    const t = document.createElement('div');
    t.className = 'notif-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 20px;font-weight:600;z-index:9999;font-size:0.88em;color:var(--text);box-shadow:0 4px 20px rgba(0,0,0,0.4);white-space:nowrap;transition:opacity 0.3s';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.style.opacity='0', 2200);
    setTimeout(() => t.remove(), 2600);
}

async function notifFromPracticePlan(dateStr) {
    practicePlanActiveDate = dateStr;
    showPage('notifications');
    setTimeout(() => {
        const sel = document.getElementById('notifRehearsalPicker');
        if (sel) sel.value = dateStr;
    }, 600);
}

