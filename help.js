// ============================================================================
// DEADCETERA — HELP & GUIDE SYSTEM
// Full visual help with overview, feature walkthroughs, and tips
// ============================================================================

function renderHelpPage(el) {
    el.innerHTML = `
    <div style="max-width:860px;margin:0 auto;padding:0 0 60px 0">

        <!-- ═══════════════════════════════════════════════════════════════════
             HERO / APP OVERVIEW
        ════════════════════════════════════════════════════════════════════ -->
        <div style="background:linear-gradient(135deg,rgba(99,102,241,0.25) 0%,rgba(168,85,247,0.15) 100%);border:1px solid rgba(99,102,241,0.35);border-radius:18px;padding:32px 28px;margin-bottom:28px;text-align:center">
            <div style="font-size:3em;margin-bottom:10px">🎸</div>
            <h1 style="margin:0 0 8px;font-size:1.8em;color:var(--text)">Welcome to Deadcetera</h1>
            <p style="color:var(--text-muted);font-size:1.05em;max-width:560px;margin:0 auto 20px;line-height:1.6">
                The all-in-one band HQ for Deadcetera — built so five musicians spend less time on logistics and more time making music.
            </p>
            <!-- Three pillars -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px">
                    <div style="font-size:1.6em;margin-bottom:6px">📚</div>
                    <div style="font-weight:700;color:var(--text);margin-bottom:4px">Learn Faster</div>
                    <div style="font-size:0.8em;color:var(--text-dim);line-height:1.4">Chord charts, reference recordings, cover versions, stems, and harmony parts — all in one place per song</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px">
                    <div style="font-size:1.6em;margin-bottom:6px">🤝</div>
                    <div style="font-weight:700;color:var(--text);margin-bottom:4px">Stay in Sync</div>
                    <div style="font-size:0.8em;color:var(--text-dim);line-height:1.4">Every band member sees the same data — statuses, votes, notes, and setlists update in real time</div>
                </div>
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px">
                    <div style="font-size:1.6em;margin-bottom:6px">🎯</div>
                    <div style="font-weight:700;color:var(--text);margin-bottom:4px">Nail the Gig</div>
                    <div style="font-size:0.8em;color:var(--text-dim);line-height:1.4">Practice plans, setlist building, gig tracking, and on-stage rehearsal mode so nothing falls through the cracks</div>
                </div>
            </div>
            <!-- Quick jump buttons -->
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                <button onclick="helpJump('getting-started')" style="background:var(--accent);color:white;border:none;padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🚀 First Time? Start Here</button>
                <button onclick="helpJump('song-workflow')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🎵 Song Workflow</button>
                <button onclick="helpJump('collaboration')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">☁️ Syncing & Sharing</button>
                <button onclick="helpJump('troubleshooting')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🔧 Troubleshooting</button>
            </div>
        </div>

        <!-- Search -->
        <div style="margin-bottom:20px;position:relative">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-dim);font-size:1em">🔍</span>
            <input class="app-input" id="helpSearch" placeholder="Search help topics — e.g. harmonies, setlist, sync..."
                oninput="filterHelpTopics(this.value)"
                style="padding-left:38px;font-size:0.95em">
        </div>

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: GETTING STARTED
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('getting-started','🚀','Getting Started','First time here? Do these four things first.',`

            ${helpStep(1,'Sign in with Google',`
                <p>Tap <strong>🔗 Connect</strong> in the top-right corner and sign in with your Google account. This is how the app knows who you are and syncs your data with the rest of the band.</p>
                ${helpVisual(`
                    <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 14px;">
                        <span style="font-weight:700;color:#818cf8">🎸 Deadcetera</span>
                        <div style="display:flex;gap:8px">
                            <div style="background:#6366f1;color:white;padding:5px 12px;border-radius:6px;font-size:0.8em;font-weight:700;animation:helpPulse 2s infinite">🔗 Connect</div>
                            <div style="background:rgba(255,255,255,0.1);color:var(--text-muted);padding:5px 8px;border-radius:6px;font-size:0.8em">⚙️</div>
                        </div>
                    </div>
                `,'Top bar — tap Connect to sign in')}
                ${helpCallout('tip','Why sign in?','Without signing in you can browse songs and use tools, but your votes, status changes, notes, and harmonies won\'t sync to the band. Sign in once and you stay signed in.')}
            `)}

            ${helpStep(2,'Pick a song to explore',`
                <p>The <strong>Song Library</strong> is your home base. Type any song name in the search box, or use the dropdown filters to browse by band or status.</p>
                ${helpVisual(`
                    <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:12px;font-size:0.82em">
                        <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:8px 12px;color:var(--text-dim);margin-bottom:8px">🔍 Search for a song...</div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap">
                            <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px 10px;font-size:0.85em">🎸 All Bands ▾</div>
                            <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px 10px;font-size:0.85em">📊 All Statuses ▾</div>
                            <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px 10px;font-size:0.85em">🎤 Harmonies</div>
                            <div style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:5px 10px;font-size:0.85em">⭐ North Star</div>
                        </div>
                    </div>
                `,'Song Library filters — use any combination')}
            `)}

            ${helpStep(3,'Set the song\'s status',`
                <p>Once you open a song, the <strong>Song DNA</strong> panel (Step 2) lets you set a status so the whole band knows where it stands:</p>
                ${helpStatusPills()}
                <p style="margin-top:8px">These statuses appear as badges in the Song Library and power the <em>Practice Plan suggestions</em>.</p>
            `)}

            ${helpStep(4,'Install the app on your phone',`
                <p>Deadcetera works best installed as a home-screen app — it loads faster, works offline, and looks native on iPhone and Android.</p>
                ${helpCallout('info','iPhone (Safari)','Tap the Share button → "Add to Home Screen" → Add. The app icon appears on your home screen.')}
                ${helpCallout('info','Android (Chrome)','Tap the three-dot menu → "Add to Home Screen" or "Install App".')}
            `)}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: SONG WORKFLOW
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('song-workflow','🎵','The Song Workflow','Every song has six steps. Here\'s what each one is for.',`

            ${helpFlowDiagram([
                {num:'1', label:'Song Library', icon:'🔍', desc:'Find & select'},
                {num:'2', label:'Song DNA', icon:'🧬', desc:'Metadata & status'},
                {num:'3', label:'North Star', icon:'⭐', desc:'Target version'},
                {num:'4', label:'Cover Me', icon:'🎤', desc:'Other bands\' takes'},
                {num:'5', label:'Stage Crib', icon:'📄', desc:'Chord charts'},
                {num:'6', label:'Woodshed', icon:'🪵', desc:'Practice tools'},
            ])}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Step 1 — Song Library</h4>
            <p>Your searchable catalog of ${typeof allSongs!=='undefined'?allSongs.length:'350+'} songs spanning Grateful Dead, Jerry Garcia Band, Widespread Panic, Phish, Allman Brothers, Goose, Dave Matthews Band, and more.</p>
            ${helpTwoCol(
                `<strong>Filtering</strong><br><br>
                <span style="display:block;margin-bottom:5px">🎸 <strong>Band</strong> — show only one band's songs</span>
                <span style="display:block;margin-bottom:5px">📊 <strong>Status</strong> — filter by readiness</span>
                <span style="display:block;margin-bottom:5px">🎤 <strong>Harmonies</strong> — only songs with documented vocal parts</span>
                <span style="display:block">⭐ <strong>North Star</strong> — only songs with a voted reference version</span>`,
                `<strong>Song badges</strong><br><br>
                <span style="display:block;margin-bottom:5px">🎤 = has harmony parts documented</span>
                <span style="display:block;margin-bottom:5px">⭐ = has a North Star version voted on</span>
                <span style="display:block;margin-bottom:5px"><span style="background:#10b981;color:white;font-size:0.7em;padding:1px 6px;border-radius:4px;font-weight:700">READY</span> Gig Ready</span>
                <span style="display:block;margin-bottom:5px"><span style="background:#f59e0b;color:white;font-size:0.7em;padding:1px 6px;border-radius:4px;font-weight:700">POLISH</span> Needs Polish</span>
                <span style="display:block;margin-bottom:5px"><span style="background:#6366f1;color:white;font-size:0.7em;padding:1px 6px;border-radius:4px;font-weight:700">THIS WEEK</span> Active focus</span>
                <span style="display:block"><span style="background:#64748b;color:white;font-size:0.7em;padding:1px 6px;border-radius:4px;font-weight:700">ON DECK</span> Coming up</span>`
            )}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Step 2 — Song DNA</h4>
            <p>The metadata panel for every song. Set these fields and the whole band sees them instantly.</p>
            ${helpGrid([
                {icon:'🎤', label:'Lead Singer', desc:'Who\'s on the mic'},
                {icon:'🎯', label:'Status', desc:'Readiness level'},
                {icon:'🔑', label:'Key', desc:'What key you play it in'},
                {icon:'🥁', label:'BPM', desc:'Tempo for practice / metronome'},
                {icon:'🏗️', label:'Structure', desc:'Who starts, cues transitions, ends'},
                {icon:'🎶', label:'Harmonies', desc:'Toggle + tag which members sing'},
            ])}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Step 3 — The North Star ⭐</h4>
            <p>The one recording your band is learning from — voted on by the group. When three or more members vote for the same version it becomes the <strong>👑 Band Choice</strong>.</p>
            ${helpCallout('tip','How to use it','Find a great live version on Spotify, YouTube, or Archive.org. Click "+ Suggest Reference Version", paste the URL, add a note about why it\'s the one. Other members vote by tapping their name.')}
            ${helpCallout('info','Reference Versions vs North Star','Reference Versions is the full list of candidates. North Star is the winner. Both only contain <strong>the original artist performing live.</strong> Covers by other bands go in Cover Me (Step 4).')}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Step 4 — Cover Me 🎤</h4>
            <p>Hear how other bands interpret this song. Different arrangements, different vocal approaches, different tempos — all fuel for your own version.</p>
            ${helpTwoCol(
                `<strong>What belongs here</strong><br><br>
                ✅ Tedeschi Trucks Band doing Whipping Post<br>
                ✅ Gov't Mule covering Melissa<br>
                ✅ moe. playing Friend of the Devil<br>
                ✅ Any band that isn't the original artist`,
                `<strong>What does NOT belong here</strong><br><br>
                ❌ The Grateful Dead playing Whipping Post (→ Reference Versions)<br>
                ❌ Allman Brothers playing Melissa (→ Reference Versions)<br>
                ❌ Your own band's recordings (→ The Woodshed)`
            )}
            ${helpCallout('tip','The inspiration note is required','When adding a cover, you must write a note explaining what the band should listen for. A bare link with no context is useless. Tell them: "Derek plays open E — listen to how he handles the outro."')}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Step 5 — Stage Crib Notes 📄</h4>
            <p>Each member's personal chord chart, tab, or lyric sheet — the thing you'd put on a music stand or iPad at rehearsal.</p>
            ${helpCallout('info','Rehearsal Mode 🎸','Hit the Rehearsal Mode button in Step 5 for a full-screen, high-contrast display optimized for playing and reading at the same time. On iPad it auto-fits the font to fill the screen. Swipe between songs in a queue.')}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Step 6 — The Woodshed 🪵</h4>
            <p>All the practice infrastructure for a song — stems, practice tracks, harmony parts, rehearsal notes, and performance tips.</p>
            ${helpGrid([
                {icon:'🎚️', label:'Moises Stems', desc:'Isolated instrument tracks for focused practice'},
                {icon:'🎸', label:'Practice Tracks', desc:'YouTube links or MP3 uploads, by instrument'},
                {icon:'🎤', label:'Harmony Parts', desc:'Who sings what, section by section'},
                {icon:'📋', label:'Rehearsal Notes', desc:'Band feedback anyone can add'},
                {icon:'🎙️', label:'Multi-Track Recorder', desc:'Record your parts with metronome + mixing'},
                {icon:'🎤', label:'Performance Tips', desc:'Stage reminders and gig-night notes'},
            ])}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: STATUS SYSTEM
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('status-system','📊','Song Status System','How to track readiness across the whole repertoire.',`
            <p>Every song can have one status. Set it from the Song DNA panel (Step 2). Filter the Song Library by status to focus rehearsals on the right songs.</p>
            <div style="display:flex;flex-direction:column;gap:10px;margin:16px 0">
                ${helpStatusCard('🎯','THIS WEEK','#6366f1','Active focus for this week\'s rehearsal. The Practice Plan page auto-suggests these songs. Use this sparingly — pick 3–6 songs at a time so the band knows exactly what to prepare.')}
                ${helpStatusCard('✅','GIG READY','#10b981','Solid enough to play live. Everyone knows their part, the arrangement is locked, and it\'s in the active setlist rotation.')}
                ${helpStatusCard('⚠️','NEEDS POLISH','#f59e0b','You know the song but it needs more work. Maybe the harmony is shaky or the ending is rough. On the radar but not there yet.')}
                ${helpStatusCard('📚','ON DECK','#64748b','Next up to learn. You haven\'t started yet but it\'s queued. Great for building a learning pipeline.')}
            </div>
            ${helpCallout('tip','Workflow suggestion','Move a song from ON DECK → THIS WEEK when you want to focus on it. After a few rehearsals move it to NEEDS POLISH, then GIG READY when it\'s locked. If it starts slipping, bump it back to NEEDS POLISH.')}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: HARMONIES
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('harmonies','🎤','Harmonies & Vocal Parts','Documenting who sings what, section by section.',`
            <p>The harmony system lives in <strong>Step 6 → The Woodshed</strong>. First, check the <strong>🎶 Harmonies</strong> checkbox in Song DNA (Step 2) and tag which members sing the song.</p>

            ${helpStep(1,'Mark the song as having harmonies',`
                <p>In <strong>Step 2 (Song DNA)</strong>, check the <strong>🎶 Harmonies</strong> box. A member checklist appears — check every name that sings on this song. These names get the 🎤 badge in the Song Library.</p>
            `)}

            ${helpStep(2,'Add harmony sections',`
                <p>In <strong>Step 6 → Harmony Parts</strong>, click <strong>"Add Harmony Section"</strong>. Each section represents a part of the song (Verse, Chorus, Bridge, Tag, etc.).</p>
                ${helpVisual(`
                    <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px;font-size:0.82em">
                        <div style="display:flex;gap:8px;margin-bottom:10px">
                            <div style="background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:6px;padding:4px 10px;font-size:0.85em;font-weight:600;color:#818cf8">Chorus</div>
                            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 10px;font-size:0.85em;color:var(--text-dim)">Verse</div>
                            <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:4px 10px;font-size:0.85em;color:var(--text-dim)">Bridge</div>
                        </div>
                        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:center">
                            <div style="font-size:0.78em;color:var(--text-dim);font-weight:700">LEAD</div>
                            <div style="background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:5px;padding:4px 10px;font-size:0.82em;color:#34d399">Drew — main melody</div>
                            <div style="font-size:0.78em;color:var(--text-dim);font-weight:700">HIGH</div>
                            <div style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:5px;padding:4px 10px;font-size:0.82em;color:#818cf8">Chris — third above</div>
                            <div style="font-size:0.78em;color:var(--text-dim);font-weight:700">LOW</div>
                            <div style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:5px;padding:4px 10px;font-size:0.82em;color:#fbbf24">Brian — fifth below</div>
                        </div>
                    </div>
                `,'A fully documented harmony section')}
            `)}

            ${helpStep(3,'Record the parts',`
                <p>Use the <strong>Multi-Track Recorder</strong> (also in Step 6) to record each vocal part. Features include:</p>
                <ul style="margin:8px 0;padding-left:20px;line-height:2">
                    <li><strong>Metronome</strong> with count-in — set the BPM from Song DNA</li>
                    <li><strong>Multiple tracks</strong> — record each singer's part separately</li>
                    <li><strong>Mixing</strong> — volume, pan, mute, and solo per track</li>
                    <li><strong>Karaoke mode</strong> — play a backing track while recording your part</li>
                    <li><strong>WAV export</strong> — download the final mix</li>
                </ul>
                ${helpCallout('tip','Latency tip','Calibrate latency once under the recorder settings for your specific device + headphones combo. This makes recorded parts line up correctly.')}
            `)}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: PRACTICE PLAN
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('practice-plan','📅','Practice Plan','Structuring rehearsals so every minute counts.',`
            <p>The <strong>Practice Plan</strong> page (Menu → Practice Plan) lets you build a structured plan for each rehearsal session — goals, songs, and an agenda — then share it to the band with one tap.</p>

            ${helpStep(1,'Create or open a rehearsal',`
                <p>Tap <strong>"+ New Rehearsal"</strong> and pick a date. Or tap an existing rehearsal date to open it. You can also navigate to it from the Calendar page.</p>
            `)}

            ${helpStep(2,'Add goals and songs',`
                <p>Add session goals (e.g., "Nail the Scarlet → Fire transition") and pick songs from the library. Songs with status <em>This Week</em> or <em>Needs Polish</em> are suggested at the top of the picker.</p>
                ${helpCallout('tip','Focus note','Each song in the plan can have a focus note — "Work on the outro" or "Brian leads the harmony on chorus 2". Keeps everyone aligned before they arrive.')}
            `)}

            ${helpStep(3,'Launch Rehearsal Mode',`
                <p>Hit the <strong>🎸 Rehearse</strong> button in the plan header to launch full-screen <strong>Rehearsal Mode</strong> for the entire song queue in order. Or tap the <strong>▶</strong> button next to any song to start there.</p>
                ${helpCallout('info','What Rehearsal Mode does','Full-screen, high-contrast display of the song\'s chord chart / stage notes. Swipe or use arrow keys to move between songs. Auto-fits font size on iPad so you never need to scroll.')}
            `)}

            ${helpStep(4,'Share to the band',`
                <p>Tap <strong>🔔 Share to Band</strong> to push a notification with the full plan to all members. They'll see it on the Notifications page and can review it before showing up.</p>
            `)}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: SETLISTS
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('setlists','📋','Building Setlists','From blank page to gig-night order.',`
            <p>The <strong>Setlists</strong> page (Menu → Setlists) is where you build and manage your song order for each show.</p>

            ${helpStep(1,'Create a setlist',`
                <p>Click <strong>"+ New Setlist"</strong> and give it a name (usually the venue + date). Set the gig date and optionally link it to a venue.</p>
            `)}

            ${helpStep(2,'Add sets and songs',`
                <p>Each setlist can have multiple sets, an encore, and a soundcheck list. Use the search bar inside each set to find and add songs. Drag-and-drop to reorder.</p>
                ${helpVisual(`
                    <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:14px;font-size:0.82em">
                        <div style="font-weight:700;color:var(--accent-light);margin-bottom:8px;font-size:0.9em">SET 1</div>
                        ${['Shakedown Street','Franklin\'s Tower','Sugaree'].map((s,i) => `
                        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:6px;margin-bottom:4px">
                            <span style="color:var(--text-dim);font-size:0.75em;min-width:16px">${i+1}</span>
                            <span style="flex:1">${s}</span>
                            <span style="font-size:0.75em;color:var(--text-dim)">⠿</span>
                        </div>`).join('')}
                        <div style="margin-top:10px;font-weight:700;color:var(--accent-light);font-size:0.9em">ENCORE</div>
                        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:rgba(255,255,255,0.03);border-radius:6px;margin-top:6px">
                            <span style="color:var(--text-dim);font-size:0.75em;min-width:16px">E</span>
                            <span style="flex:1">Ripple</span>
                        </div>
                    </div>
                `,'A setlist with two sets and an encore')}
            `)}

            ${helpStep(3,'Check gig history',`
                <p>Hover over any song in a setlist to see when and where you last played it — position in the set (opener, closer, encore), date, and venue. Prevents playing the same songs too close together.</p>
            `)}

            ${helpStep(4,'Link to a playlist',`
                <p>Setlists can be linked to a Playlist so band members can pre-listen to all the songs in set order. Great for pre-gig prep listening parties.</p>
            `)}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: MOISES WORKFLOW
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('moises','🎚️','The Moises Stem Workflow','How to isolate individual instrument parts for practice.',`
            <p><a href="https://moises.ai" target="_blank" style="color:var(--accent-light)">Moises.ai</a> is an AI tool that separates a full recording into individual instrument stems — vocals, guitar, bass, keys, drums. Once separated you can mute any instrument and practice your own part against the real recording.</p>

            ${helpNumberedSteps([
                {icon:'⬇️', title:'Find a recording', body:'Open a song in the Song Library, go to Step 3 (North Star) or look under Archive.org versions. You want a clean live recording with good mix balance.'},
                {icon:'📋', title:'Copy the Archive.org URL', body:'On Archive.org, find the specific MP3 file for the song (not the full show). Right-click → Copy Link, or use the Smart Download button in the app to get a direct link.'},
                {icon:'🌐', title:'Open Moises.ai', body:'Go to moises.ai, sign in (free tier works for up to a few tracks/month). Click Upload or paste the URL if it supports direct import.'},
                {icon:'⚙️', title:'Choose 6 Stems separation', body:'Select "AI Music Separation" → "6 Stems" (vocals, guitar, bass, keys, drums, other). Wait 1–2 minutes for AI processing.'},
                {icon:'🎧', title:'Solo your instrument', body:'In the Moises player, click Solo on your instrument. Adjust tempo (slow it down without changing pitch). Loop difficult sections.'},
                {icon:'⬆️', title:'Upload stems back to Deadcetera', body:'Download your stem files from Moises, then upload them via Step 6 → Moises Stems in the song detail. Other members can then access them too.'},
            ])}

            ${helpCallout('tip','Show Splitter for long recordings','If the Archive.org file is a full 2-hour show, use the Show Splitter tool (in the song workflow) to note the timestamp for your song before sending it to Moises. Saves time and Moises processing credits.')}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: GIGS & CALENDAR
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('gigs','🎤','Gigs, Calendar & Venues','Tracking where you\'ve been and where you\'re going.',`

            <h4 style="color:var(--accent-light);margin:0 0 10px">Gigs</h4>
            <p>The <strong>Gigs</strong> page tracks every show — past and upcoming. Each gig stores:</p>
            ${helpGrid([
                {icon:'📍', label:'Venue', desc:'Linked to the Venues database'},
                {icon:'💰', label:'Pay', desc:'Per-show or per-member breakdown'},
                {icon:'🎛️', label:'Sound person', desc:'Name and contact'},
                {icon:'📋', label:'Setlist', desc:'Linked to the Setlists page'},
                {icon:'⏰', label:'Load-in / Start', desc:'Schedule for the night'},
                {icon:'📝', label:'Notes', desc:'Parking, gear needs, special requests'},
            ])}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Calendar</h4>
            <p>The <strong>Calendar</strong> page shows both gigs and rehearsals in a monthly view. Tap any rehearsal event to jump straight to its Practice Plan. Tap a gig event to see the full gig details.</p>

            <h4 style="color:var(--accent-light);margin:20px 0 10px">Venues</h4>
            <p>Build a database of every venue you play. Each entry stores address, capacity, stage dimensions, PA system, load-in details, parking notes, and booking contacts — so you're never scrambling the night of.</p>
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: COLLABORATION & SYNC
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('collaboration','☁️','Syncing & Collaboration','How data stays in sync across all five band members.',`

            ${helpVisual(`
                <div style="display:flex;align-items:center;justify-content:center;gap:0;flex-wrap:wrap;padding:16px">
                    ${['Drew','Chris','Brian','Pierce','Jay'].map((n,i) => `
                        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;margin:6px 10px">
                            <div style="width:40px;height:40px;background:rgba(99,102,241,0.25);border:2px solid rgba(99,102,241,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1em">👤</div>
                            <div style="font-size:0.72em;color:var(--text-muted)">${n}</div>
                        </div>
                        ${i<4 ? '<div style="color:var(--accent-light);font-size:1.2em;margin-bottom:12px">⇄</div>' : ''}`
                    ).join('')}
                    <div style="width:100%;text-align:center;margin-top:10px">
                        <div style="display:inline-block;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:8px;padding:8px 20px;font-size:0.8em;font-weight:700;color:#818cf8">☁️ Google Drive + Firebase</div>
                    </div>
                </div>
            `,'All five members sync through Google Drive and Firebase')}

            <h4 style="color:var(--accent-light);margin:16px 0 8px">What syncs instantly</h4>
            ${helpGrid([
                {icon:'🎯', label:'Song statuses', desc:'Set by anyone, seen by everyone'},
                {icon:'⭐', label:'Reference versions & votes', desc:'Voting updates live'},
                {icon:'🎤', label:'Harmony parts', desc:'Shared across all members'},
                {icon:'📋', label:'Rehearsal notes', desc:'Anyone can add, all can see'},
                {icon:'📋', label:'Setlists', desc:'Real-time collaboration'},
                {icon:'🎤', label:'Gigs & venues', desc:'Full gig database shared'},
                {icon:'💰', label:'Finances', desc:'Pay tracking for everyone'},
                {icon:'🔔', label:'Notifications', desc:'Push to the whole band at once'},
            ])}

            ${helpCallout('info','How it works technically','Song data (harmony parts, notes, tabs, cover versions) lives in Google Drive — one JSON file per song. Global band data (setlists, gigs, finances, statuses) lives in Firebase Realtime Database. Both sync automatically when you\'re signed in.')}
            ${helpCallout('tip','Offline use','The app works offline once loaded. Any changes you make offline will sync the next time you\'re connected and signed in.')}
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: TOOLS
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('tools','🛠️','Built-in Tools','Tuner, metronome, and finances — all in the app.',`

            <h4 style="color:var(--accent-light);margin:0 0 10px">🎸 Guitar Tuner</h4>
            <p>Uses your device microphone to detect pitch in real time. Supports standard tuning (EADGBe) and common alternates. Works best with headphones on so the mic doesn't pick up the app's audio.</p>
            ${helpCallout('tip','iPhone tip','Make sure you\'ve given the browser microphone permission. In Safari: Settings → Safari → Microphone → Allow.')}

            <h4 style="color:var(--accent-light);margin:20px 0 10px">🥁 Metronome</h4>
            <p>Full-featured metronome with tap tempo, BPM display, time signatures (4/4, 3/4, 6/8, etc.), and accent patterns. The BPM you set here is saved per-song if you access it from within a song's detail page.</p>

            <h4 style="color:var(--accent-light);margin:20px 0 10px">💰 Finances</h4>
            <p>Track gig pay, splits, and expenses. Each gig can have a total payout that auto-calculates per-member share. Useful for end-of-year tax records and keeping the split fair.</p>

            <h4 style="color:var(--accent-light);margin:20px 0 10px">📣 Social Media</h4>
            <p>Draft social posts for upcoming gigs and announcements. Templates for Facebook, Instagram, and email.</p>

            <h4 style="color:var(--accent-light);margin:20px 0 10px">🔔 Notifications</h4>
            <p>The band-wide notification system. Send alerts about rehearsal plans, setlist changes, or gig logistics. All members see incoming notifications here.</p>
        `)}

        <!-- ═══════════════════════════════════════════════════════════════════
             SECTION: TROUBLESHOOTING
        ════════════════════════════════════════════════════════════════════ -->
        ${helpSection('troubleshooting','🔧','Troubleshooting','When something\'s not working.',`

            ${helpFAQ([
                {
                    q: 'I can\'t sign in / the Connect button doesn\'t work',
                    a: 'Use Chrome or Safari — Edge and Firefox sometimes block Google auth. Make sure pop-ups aren\'t blocked for this site. On iPhone, try Safari rather than opening the app link in another browser\'s in-app browser.'
                },
                {
                    q: 'I signed in but my changes aren\'t syncing to the other members',
                    a: 'Check that you\'re signed in (the Connect button should show your name or a checkmark). If it still shows "Connect", tap it again. Make sure you have an internet connection. Try refreshing the page.'
                },
                {
                    q: 'The song statuses aren\'t showing up / wrong statuses',
                    a: 'Statuses are cached in the background on first load. Wait a few seconds after signing in — they\'ll populate. If still wrong, go to Settings → Data → Clear Status Cache and refresh.'
                },
                {
                    q: 'Audio won\'t play on iPhone',
                    a: 'iOS requires a physical tap before playing audio (a security restriction). Make sure you\'re tapping a play button directly — JavaScript auto-play is blocked. If using the recorder, try tapping the screen once first.'
                },
                {
                    q: 'I added a harmony part but my bandmate can\'t see it',
                    a: 'Make sure they\'re signed in with their Google account. Harmony data syncs through Google Drive — they need to be connected. Try having them sign out and back in.'
                },
                {
                    q: 'The Cover Me / Reference Versions section is empty even though I added things',
                    a: 'This data is stored in Google Drive. Make sure Drive is connected (tap Connect → authorize Drive access). If it was just added, try refreshing the page.'
                },
                {
                    q: 'Rehearsal Mode won\'t open',
                    a: 'Rehearsal Mode requires a song to be selected first. Make sure you\'ve clicked a song in the library so its detail page is visible, then tap the 🎸 Rehearsal Mode button in Step 5.'
                },
                {
                    q: 'The app is slow or feels stuck',
                    a: 'The first load after a fresh install can be slow as it caches assets. After that it should be fast. If it\'s consistently slow, try: (1) clearing your browser cache, (2) reinstalling as a PWA, (3) checking your internet connection.'
                },
                {
                    q: 'I accidentally deleted something',
                    a: 'Most data is stored in Firebase and Google Drive, which don\'t have a built-in undo. For song data, go to Settings → Data → Export to check if a recent backup exists. For setlists or gigs, the data may still be in Firebase — contact Drew.'
                },
                {
                    q: 'I\'m on Android and the app looks different',
                    a: 'The app is designed mobile-first but there are minor visual differences between iOS and Android browsers. Everything should work — if something looks broken, screenshot it and send to Drew with your device/browser info.'
                },
            ])}

            <div style="margin-top:20px;padding:16px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:10px">
                <div style="font-weight:700;margin-bottom:6px;color:var(--accent-light)">Still stuck?</div>
                <div style="font-size:0.88em;color:var(--text-muted);line-height:1.6">Text Drew directly or open a GitHub issue. When reporting a bug, include: your device, browser, what you were doing, and what happened vs. what you expected.</div>
            </div>
        `)}

    </div>

    <style>
        @keyframes helpPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        .help-section { margin-bottom:10px; }
        .help-section summary { list-style:none; }
        .help-section summary::-webkit-details-marker { display:none; }
        .help-step { display:flex;gap:12px;margin-bottom:18px;align-items:flex-start; }
        .help-step-num { width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0;margin-top:1px; }
        .help-visual { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin:12px 0; }
        .help-visual-caption { font-size:0.75em;color:var(--text-dim);text-align:center;margin-top:8px;font-style:italic; }
        .help-callout-tip { background:rgba(16,185,129,0.08);border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:10px 14px;margin:12px 0;font-size:0.85em; }
        .help-callout-info { background:rgba(99,102,241,0.08);border-left:3px solid #6366f1;border-radius:0 8px 8px 0;padding:10px 14px;margin:12px 0;font-size:0.85em; }
        .help-callout-warn { background:rgba(245,158,11,0.08);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;padding:10px 14px;margin:12px 0;font-size:0.85em; }
        .help-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:12px 0; }
        .help-grid-item { background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:10px 12px; }
        .help-faq-item { border-bottom:1px solid rgba(255,255,255,0.06);padding:12px 0; }
        .help-faq-item:last-child { border-bottom:none; }
        .help-two-col { display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0; }
        @media(max-width:600px) { .help-two-col { grid-template-columns:1fr; } }
    </style>`;
}

// ── Helper builder functions ─────────────────────────────────────────────────

function helpSection(id, icon, title, subtitle, content) {
    return `
    <details class="app-card help-section" id="help-${id}">
        <summary style="cursor:pointer;padding:4px 0;user-select:none">
            <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:1.4em">${icon}</span>
                <div>
                    <div style="font-weight:700;font-size:1em;color:var(--text)">${title}</div>
                    <div style="font-size:0.8em;color:var(--text-dim);margin-top:1px">${subtitle}</div>
                </div>
                <span class="help-chevron" style="margin-left:auto;color:var(--text-dim);font-size:0.9em;transition:transform 0.2s">▶</span>
            </div>
        </summary>
        <div style="padding:16px 0 4px;font-size:0.88em;color:var(--text-muted);line-height:1.7">
            ${content}
        </div>
    </details>`;
}

function helpStep(num, title, content) {
    return `
    <div class="help-step">
        <div class="help-step-num">${num}</div>
        <div style="flex:1">
            <div style="font-weight:700;color:var(--text);margin-bottom:6px">${title}</div>
            ${content}
        </div>
    </div>`;
}

function helpVisual(html, caption) {
    return `
    <div class="help-visual">
        ${html}
        ${caption ? `<div class="help-visual-caption">${caption}</div>` : ''}
    </div>`;
}

function helpCallout(type, label, text) {
    const icons = {tip:'💡', info:'ℹ️', warn:'⚠️'};
    return `
    <div class="help-callout-${type}">
        <strong>${icons[type]||'💡'} ${label}:</strong> ${text}
    </div>`;
}

function helpGrid(items) {
    return `
    <div class="help-grid">
        ${items.map(item => `
        <div class="help-grid-item">
            <div style="font-size:1.2em;margin-bottom:4px">${item.icon}</div>
            <div style="font-weight:700;font-size:0.85em;color:var(--text);margin-bottom:2px">${item.label}</div>
            <div style="font-size:0.78em;color:var(--text-dim);line-height:1.4">${item.desc}</div>
        </div>`).join('')}
    </div>`;
}

function helpTwoCol(left, right) {
    return `
    <div class="help-two-col">
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;font-size:0.85em;line-height:1.8">${left}</div>
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;font-size:0.85em;line-height:1.8">${right}</div>
    </div>`;
}

function helpFlowDiagram(steps) {
    return `
    <div style="display:flex;align-items:center;flex-wrap:wrap;gap:0;margin:16px 0;justify-content:center">
        ${steps.map((s,i) => `
        <div style="display:flex;align-items:center;gap:0">
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:70px;text-align:center">
                <div style="width:36px;height:36px;background:rgba(99,102,241,0.25);border:2px solid rgba(99,102,241,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1em">${s.icon}</div>
                <div style="font-size:0.65em;font-weight:700;color:var(--accent-light)">${s.num}</div>
                <div style="font-size:0.7em;font-weight:600;color:var(--text);line-height:1.2">${s.label}</div>
                <div style="font-size:0.65em;color:var(--text-dim)">${s.desc}</div>
            </div>
            ${i < steps.length-1 ? '<div style="color:var(--text-dim);font-size:0.9em;margin:0 2px;margin-bottom:24px">→</div>' : ''}
        </div>`).join('')}
    </div>`;
}

function helpNumberedSteps(steps) {
    return `
    <div style="margin:12px 0">
        ${steps.map((s,i) => `
        <div style="display:flex;gap:12px;margin-bottom:14px">
            <div style="display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0">
                <div style="width:32px;height:32px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1em">${s.icon}</div>
                ${i<steps.length-1 ? '<div style="width:2px;flex:1;background:rgba(99,102,241,0.15);margin:2px 0"></div>' : ''}
            </div>
            <div style="flex:1;padding-top:4px">
                <div style="font-weight:700;color:var(--text);margin-bottom:3px;font-size:0.9em">Step ${i+1}: ${s.title}</div>
                <div style="color:var(--text-dim);font-size:0.83em;line-height:1.5">${s.body}</div>
            </div>
        </div>`).join('')}
    </div>`;
}

function helpStatusPills() {
    return `
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">
        <span style="background:#6366f1;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">🎯 THIS WEEK</span>
        <span style="background:#10b981;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">✅ GIG READY</span>
        <span style="background:#f59e0b;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">⚠️ NEEDS POLISH</span>
        <span style="background:#64748b;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">📚 ON DECK</span>
    </div>`;
}

function helpStatusCard(icon, label, color, desc) {
    return `
    <div style="display:flex;gap:12px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;align-items:flex-start">
        <div style="background:${color};color:white;padding:5px 10px;border-radius:8px;font-size:0.78em;font-weight:800;white-space:nowrap;flex-shrink:0;margin-top:1px">${icon} ${label}</div>
        <div style="font-size:0.85em;color:var(--text-muted);line-height:1.5">${desc}</div>
    </div>`;
}

function helpFAQ(items) {
    return `
    <div style="margin:12px 0">
        ${items.map(item => `
        <div class="help-faq-item">
            <div style="font-weight:700;color:var(--text);font-size:0.88em;margin-bottom:5px">Q: ${item.q}</div>
            <div style="color:var(--text-muted);font-size:0.83em;line-height:1.6">A: ${item.a}</div>
        </div>`).join('')}
    </div>`;
}

// ── Navigation helpers ────────────────────────────────────────────────────────

function helpJump(id) {
    const el = document.getElementById('help-' + id);
    if (!el) return;
    el.open = true;
    setTimeout(() => el.scrollIntoView({behavior:'smooth', block:'start'}), 50);
}

// ── Section open/close chevron animation ─────────────────────────────────────

document.addEventListener('toggle', function(e) {
    if (!e.target.classList.contains('help-section')) return;
    const chevron = e.target.querySelector('.help-chevron');
    if (chevron) chevron.style.transform = e.target.open ? 'rotate(90deg)' : '';
}, true);

// ── Search / filter ───────────────────────────────────────────────────────────

function filterHelpTopics(query) {
    const q = (query||'').toLowerCase().trim();
    document.querySelectorAll('.help-section').forEach(d => {
        if (!q) { d.style.display = ''; return; }
        const text = d.textContent.toLowerCase();
        const match = text.includes(q);
        d.style.display = match ? '' : 'none';
        if (match && q.length > 2) d.open = true;
    });
}

console.log('❓ Help system loaded');
