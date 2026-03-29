// ============================================================================
// DEADCETERA — HELP & GUIDE SYSTEM
// Full visual help with overview, feature walkthroughs, and tips
// ============================================================================

console.log('%c🔗 GrooveLinx BUILD: 20260329-171836', 'color:#667eea;font-weight:bold;font-size:14px');
// Build version logged once by app.js from <meta> tag
function renderHelpPage(el) {
    el.innerHTML = `
    <div style="max-width:860px;margin:0 auto;padding:0 0 60px 0">

        <div style="background:linear-gradient(135deg,rgba(99,102,241,0.25) 0%,rgba(168,85,247,0.15) 100%);border:1px solid rgba(99,102,241,0.35);border-radius:18px;padding:32px 28px;margin-bottom:28px;text-align:center">
            <img src="logo-large.png" alt="GrooveLinx" style="width:80px;height:80px;margin-bottom:10px;border-radius:12px">
            <h1 style="margin:0 0 8px;font-size:1.8em;background:linear-gradient(135deg,#667eea,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Welcome to GrooveLinx</h1>
            <p style="color:var(--text-muted);font-size:1.05em;max-width:560px;margin:0 auto 20px;line-height:1.6">Where bands lock in — built so musicians spend less time on logistics and more time making music.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:24px">
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px"><div style="font-size:1.6em;margin-bottom:6px">📚</div><div style="font-weight:700;color:var(--text);margin-bottom:4px">Learn Faster</div><div style="font-size:0.8em;color:var(--text-dim);line-height:1.4">Chord charts, reference recordings, cover versions, stems, and harmony parts — all in one place per song</div></div>
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px"><div style="font-size:1.6em;margin-bottom:6px">🤝</div><div style="font-weight:700;color:var(--text);margin-bottom:4px">Stay in Sync</div><div style="font-size:0.8em;color:var(--text-dim);line-height:1.4">Every band member sees the same data — statuses, votes, notes, and setlists update in real time</div></div>
                <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:14px"><div style="font-size:1.6em;margin-bottom:6px">🎯</div><div style="font-weight:700;color:var(--text);margin-bottom:4px">Nail the Gig</div><div style="font-size:0.8em;color:var(--text-dim);line-height:1.4">Practice plans, setlist building, gig tracking, and on-stage rehearsal mode so nothing falls through the cracks</div></div>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
                <button onclick="helpJump('getting-started')" style="background:var(--accent);color:white;border:none;padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🚀 First Time? Start Here</button>
                <button onclick="helpJump('song-workflow')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🎵 Song Workflow</button>
                <button onclick="helpJump('practice-mode')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🧠 Practice Mode</button>
                <button onclick="helpJump('collaboration')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">☁️ Syncing & Sharing</button>
                <button onclick="helpJump('all-pages')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">📑 All Pages A–Z</button>
                <button onclick="helpJump('troubleshooting')" style="background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15);padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">🔧 Troubleshooting</button>
            </div>
        </div>

        <div style="margin-bottom:20px;position:relative">
            <span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-dim);font-size:1em">🔍</span>
            <input class="app-input" id="helpSearch" placeholder="Search help topics — e.g. harmonies, setlist, sync..." oninput="filterHelpTopics(this.value)" style="padding-left:38px;font-size:0.95em">
        </div>

        ${helpSection('getting-started','\uD83D\uDE80','Getting Started','First time here? Do these four things first.',
            helpStep(1,'Sign in with Google','<p>Tap <strong>\uD83D\uDD17 Connect</strong> in the top-right corner and sign in with your Google account. This is how the app knows who you are and syncs your data with the rest of the band.</p>' + helpCallout('tip','Why sign in?','Without signing in you can browse songs and use tools, but your votes, status changes, notes, and harmonies won\'t sync to the band. Sign in once and you stay signed in.')) +
            helpStep(2,'Pick a song to explore','<p>The <strong>Song Library</strong> is your home base. Type any song name in the search box, or use the dropdown filters to browse by band or status.</p>') +
            helpStep(3,'Set the song\'s status','<p>Once you open a song, the <strong>Song DNA</strong> panel (Step 2) lets you set a status so the whole band knows where it stands:</p>' + helpStatusPills() + '<p style="margin-top:8px">These statuses appear as badges in the Song Library and power the <em>Practice Plan suggestions</em>.</p>') +
            helpStep(4,'Install the app on your phone','<p>GrooveLinx works best installed as a home-screen app \u2014 it loads faster, works offline, and looks native on iPhone and Android.</p>' + helpCallout('info','iPhone (Safari)','Tap the Share button \u2192 "Add to Home Screen" \u2192 Add.') + helpCallout('info','Android (Chrome)','Tap the three-dot menu \u2192 "Add to Home Screen" or "Install App".'))
        )}

        ${helpSection('song-workflow','\uD83C\uDFB5','The Song Workflow','Every song has six steps. Here\'s what each one is for.',
            helpFlowDiagram([
                {num:'1', label:'Song Library', icon:'\uD83D\uDD0D', desc:'Find & select'},
                {num:'2', label:'Song DNA', icon:'\uD83E\uDDEC', desc:'Metadata & status'},
                {num:'3', label:'North Star', icon:'\u2B50', desc:'Target version'},
                {num:'4', label:'Cover Me', icon:'\uD83C\uDFA4', desc:'Other bands\' takes'},
                {num:'5', label:'Stage Crib', icon:'\uD83D\uDCC4', desc:'Chord charts'},
                {num:'6', label:'Woodshed', icon:'\uD83E\uDEB5', desc:'Practice tools'},
            ]) +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Step 1 \u2014 Song Library</h4>' +
            '<p>Your searchable catalog of ' + (typeof allSongs!=='undefined'?allSongs.length:'350+') + ' songs spanning Grateful Dead, Jerry Garcia Band, Widespread Panic, Phish, Allman Brothers, Goose, Dave Matthews Band, and more. Filter by band, status, harmonies, or North Star.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Step 2 \u2014 Song DNA</h4>' +
            '<p>The metadata panel for every song: lead singer, status, key, BPM, song structure, and harmony tags. Set these fields and the whole band sees them instantly.</p>' +
            helpCallout('tip','Song Structure','The \uD83C\uDFD7\uFE0F Structure button opens a dedicated editor where you define intro, verse, chorus, bridge, solo, and outro sections with notes about cues and transitions. This feeds into the Scorecard and Best Shot systems.') +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Find a Version \uD83D\uDD0D</h4>' +
            '<p>The <strong>Version Hub</strong> is your one-stop shop for finding recordings across all sources. Search Archive.org, YouTube, Relisten, Phish.in, and Spotify from one screen. Listen inline without leaving the app, then route any version directly to North Star, Cover Me, Fadr stems, or Practice Mode.</p>' +
            helpCallout('tip','How to launch','Click the big \"Find a Version\" button on any song page, or use the \uD83D\uDD0D Find links inside North Star and Cover Me sections.') +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Step 3 \u2014 The North Star \u2B50</h4>' +
            '<p>The one recording your band is learning from \u2014 voted on by the group. When three or more members vote for the same version it becomes the <strong>\uD83D\uDC51 Band Choice</strong>.</p>' +
            helpCallout('tip','How to use it','Find a great live version on Spotify, YouTube, or Archive.org. Click "+ Suggest Reference Version", paste the URL, add a note about why it\'s the one. Other members vote by tapping their name.') +
            helpCallout('info','Reference Versions vs North Star','Reference Versions is the full list of candidates. North Star is the winner. Both only contain <strong>the original artist performing live.</strong> Covers by other bands go in Cover Me (Step 4).') +
            '<p>The <strong>Archive.org</strong> search is built in \u2014 it auto-searches for live recordings of the song and lets you preview, sort by date, and add directly. You can also send any Archive.org recording to <strong>Fadr AI</strong> for stem separation.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Step 4 \u2014 Cover Me \uD83C\uDFA4</h4>' +
            '<p>Hear how other bands interpret this song. Different arrangements, vocal approaches, tempos \u2014 all fuel for your own version. When adding a cover, write a note explaining what the band should listen for.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Step 5 \u2014 Stage Crib Notes \uD83D\uDCC4</h4>' +
            '<p>Each member\'s personal chord chart, tab, or lyric sheet. Any signed-in member can add reference links for <strong>any</strong> member \u2014 click any member pill to open the add form, even if it\'s not your own.</p>' +
            helpCallout('info','Practice Mode \uD83E\uDDE0','Practice Mode is your full-screen music lab \u2014 five tabs packed with tools for learning songs. Open it from the Chart section of any song. See the <a href="#" onclick="helpJump(\'practice-mode\');return false" style="color:var(--accent-light)">Practice Mode</a> section below for the full guide.') +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Step 6 \u2014 The Woodshed \uD83E\uDEB5</h4>' +
            '<p>All the practice infrastructure for a song:</p>' +
            helpGrid([
                {icon:'\uD83C\uDF9A\uFE0F', label:'Moises Stems', desc:'Isolated instrument tracks for focused practice'},
                {icon:'\uD83C\uDFB8', label:'Practice Tracks', desc:'YouTube links or MP3 uploads, by instrument'},
                {icon:'\uD83C\uDFA4', label:'Harmony Parts', desc:'Who sings what, section by section'},
                {icon:'\uD83D\uDCCB', label:'Rehearsal Notes', desc:'Band feedback anyone can add \u2014 timestamped with your name'},
                {icon:'\uD83C\uDF99\uFE0F', label:'Multi-Track Recorder', desc:'Record your parts with metronome + mixing'},
                {icon:'\uD83C\uDFA4', label:'Performance Tips', desc:'Stage reminders and gig-night notes'},
            ])
        )}

        ${helpSection('status-system','\uD83D\uDCCA','Song Lifecycle','How songs move between Active rehearsal and Library.',
            '<p>Every song has a lifecycle status that determines whether it\u2019s part of your <strong>Active</strong> rehearsal set or sitting in the <strong>Library</strong>.</p>' +
            '<div style="margin:12px 0 6px;font-size:0.78em;font-weight:800;color:#22c55e;text-transform:uppercase;letter-spacing:0.1em">Active Set \u2014 what the band is working on</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">' +
            helpStatusCard('\uD83D\uDC40','PROSPECT','#7c3aed','A song the band is considering learning. Pitched by a member, waiting for first run-through. Active in recommendations so it gets attention.') +
            helpStatusCard('\uD83D\uDCD6','LEARNING','#d97706','Being actively learned. Parts are being worked out, arrangement is taking shape. Shows up in rehearsal agenda and practice priorities.') +
            helpStatusCard('\uD83D\uDD04','IN ROTATION','#059669','Current working songs. Solid enough to play at gigs. The core of your rehearsal set and setlist building.') +
            '</div>' +
            '<div style="margin:12px 0 6px;font-size:0.78em;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.1em">Library \u2014 everything else</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">' +
            helpStatusCard('\uD83D\uDCE6','SHELVED','#64748b','Not currently being rehearsed. All data (readiness, notes, charts) is preserved. Does not appear in rehearsal suggestions or intelligence scoring. Move back to Active any time.') +
            '</div>' +
            helpCallout('tip','How songs flow','Pitch a Song \u2192 <strong>Prospect</strong> \u2192 first run-through \u2192 <strong>Learning</strong> \u2192 gig-ready \u2192 <strong>In Rotation</strong>. When you\u2019re done with a song, <strong>Shelve</strong> it to move it to Library. Nothing is deleted \u2014 you can always bring it back.')
        )}

        ${helpSection('harmonies','\uD83C\uDFA4','Harmonies & Vocal Parts','Documenting who sings what, section by section.',
            '<p>The harmony system lives in <strong>Step 6 \u2192 The Woodshed</strong>. First, check the <strong>\uD83C\uDFB6 Harmonies</strong> checkbox in Song DNA (Step 2) and tag which members sing the song.</p>' +
            helpStep(1,'Mark the song as having harmonies','<p>In <strong>Step 2 (Song DNA)</strong>, check <strong>\uD83C\uDFB6 Harmonies</strong>. A member checklist appears \u2014 check every name that sings. These names get the \uD83C\uDFA4 badge in the Song Library.</p>') +
            helpStep(2,'Add harmony sections','<p>In <strong>Step 6 \u2192 Harmony Parts</strong>, click <strong>"Add Harmony Section"</strong>. Each section represents a part of the song (Verse, Chorus, Bridge, Tag, etc.) with Lead, High, and Low vocal assignments.</p>') +
            helpStep(3,'Record the parts','<p>Use the <strong>Multi-Track Recorder</strong> (also in Step 6) to record each vocal part. Features: metronome with count-in, multiple tracks, mixing with volume/pan/mute/solo, karaoke mode, and WAV export.</p>' + helpCallout('tip','Latency tip','Calibrate latency once under the recorder settings for your specific device + headphones combo. This makes recorded parts line up correctly.'))
        )}

        ${helpSection('practice-plan','\uD83D\uDCC5','Practice Plan','Structuring rehearsals so every minute counts.',
            '<p>The <strong>Practice Plan</strong> page (Menu \u2192 Practice Plan) lets you build a structured plan for each rehearsal \u2014 goals, songs, and an agenda \u2014 then share it to the band with one tap.</p>' +
            helpStep(1,'Create or open a rehearsal','<p>Tap <strong>"+ New Rehearsal"</strong> and pick a date. Or tap an existing date. You can also navigate from the Calendar page.</p>') +
            helpStep(2,'Add goals and songs','<p>Add session goals (e.g., "Nail the Scarlet \u2192 Fire transition") and pick songs. Songs with status <em>Learning</em> or <em>In Rotation</em> are suggested at the top.</p>' + helpCallout('tip','Focus note','Each song in the plan can have a focus note \u2014 "Work on the outro" or "Brian leads the harmony on chorus 2". Keeps everyone aligned.')) +
            helpStep(3,'Launch Rehearsal Mode','<p>Hit <strong>\uD83C\uDFB8 Rehearse</strong> to launch full-screen <strong>Rehearsal Mode</strong> for the entire song queue in order. Or tap \u25B6 next to any song to start there. Full-screen, high-contrast chart display.</p>') +
            helpStep(4,'Share to the band','<p>Tap <strong>\uD83D\uDD14 Share to Band</strong> to push a notification to all members.</p>') +
            helpCallout('tip','Send to Practice Plan','From any song\'s detail page, tap <strong>"Send to Practice Plan"</strong> to add it directly to the current or next scheduled rehearsal.')
        )}

        ${helpSection('practice-mode','\uD83E\uDDE0','Practice Mode','Your full-screen music lab \u2014 five powerful tabs for learning any song.',
            '<p>Practice Mode is the heart of GrooveLinx. Open any song and tap the <strong style="background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent">\uD83E\uDDE0 Practice Mode</strong> card to launch a full-screen overlay with five tabs.</p>' +
            helpCallout('tip','Multiple songs?','Add songs to the practice queue from a Practice Plan, or use the \u2190 \u2192 arrows to navigate between songs. Swipe on mobile.') +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83D\uDCCB Chart Tab</h4><p>Your chord chart with a sticky toolbar:</p>' +
            helpGrid([
                {icon:'\u266D \u266F', label:'Transpose', desc:'Flat/sharp buttons shift all chords. Shows current key. Saved per song.'},
                {icon:'\uD83E\uDD41', label:'Metronome', desc:'Count Off at song\'s BPM. Choose 1\u20134 bars or \u221E continuous. Beat 1 accented.'},
                {icon:'\uD83E\uDDE0', label:'Brain Trainer', desc:'Progressively hides lyrics: 100% \u2192 75% \u2192 50% \u2192 25% \u2192 Mastered. Words redact from end of lines.'},
                {icon:'\uD83D\uDCDC', label:'Auto-Scroll', desc:'Hands-free scrolling, speed 1\u20135, stops at bottom. Speed saved.'},
                {icon:'\uD83D\uDE48', label:'Focus Mode', desc:'Monkey button hides toolbar for clean chart view. Tap \uD83D\uDC35 to bring it back.'},
                {icon:'\uD83C\uDFB8 \u270F\uFE0F A\u00B1', label:'More Tools', desc:'Search Ultimate Guitar for charts. Edit/paste your own chart. Adjust font size.'},
            ]) +
            helpCallout('info','No chart yet?','If a song has no chart, you\'ll see links to search Ultimate Guitar and Chordify, plus a button to paste one manually. Once saved, it\'s available to the whole band.') +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83D\uDCD6 Know Tab</h4><p>Pulls the song\'s meaning and background from Genius \u2014 context about lyrics, story behind the song, and how other artists have covered it.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83E\uDDE0 Memory Tab \u2014 Memory Palace</h4><p>AI-powered visual memory system that turns lyrics into vivid images styled to each band\'s aesthetic. Three views: <strong>Walk the Palace</strong> (full-screen walkthrough), <strong>Overview</strong> (2\u00D72 grid), and <strong>Edit Scenes</strong> (customize descriptions and prompts).</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83C\uDFB5 Harmony Tab</h4><p>Find audio on Archive.org or YouTube, send to <strong>Fadr AI</strong> for stem separation (vocals, bass, drums, guitar, keys), then practice your isolated part.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83C\uDF99\uFE0F Record Tab</h4><p>Multi-track recording studio in your browser. Record yourself singing along, layer parts, adjust volumes, and export your mix.</p>' +
            helpCallout('tip','Keyboard shortcuts','\u2190 \u2192 to navigate songs. Esc to close. In Palace Walk: \u2190 \u2192 or Space to advance, Esc to exit.')
        )}

        ${helpSection('setlists','\uD83D\uDCCB','Building Setlists','From blank page to gig-night order \u2014 including transitions and PDF printing.',
            '<p>The <strong>Setlists</strong> page (Menu \u2192 Setlists) is where you build and manage song order for each show.</p>' +
            helpStep(1,'Create a setlist','<p>Click <strong>"+ New Setlist"</strong> and give it a name (usually venue + date). Set the gig date and optionally link to a venue.</p>') +
            helpStep(2,'Add sets and songs','<p>Each setlist can have multiple sets, an encore, and a soundcheck list. Use the search bar inside each set to find and add songs. Drag-and-drop to reorder.</p>') +
            helpStep(3,'Mark transitions (segues) \u2192','<p>When one song flows directly into the next, tap the \u23F9 button to the right. It turns into a purple \u2192 arrow. The \u2192 marker prints on the PDF so the band reads it on stage.</p>') +
            helpStep(4,'Check gig history','<p>Hover over any song in a setlist to see when and where you last played it. Prevents playing the same songs too close together.</p>') +
            helpStep(5,'Print to PDF \uD83D\uDDA8\uFE0F','<p>Tap <strong>\uD83D\uDDA8\uFE0F Print PDF</strong> for a large-format, one-set-per-page PDF with artistic font \u2014 designed for music stands under stage lighting.</p>') +
            helpStep(6,'Export Crib Sheet \uD83D\uDCF1','<p>Tap <strong>\uD83D\uDCF1 Export</strong> to generate an HTML Crib Sheet with every song\'s chord chart and crib notes for all members, organized by set. Open on an iPad at the gig.</p>') +
            helpStep(7,'Link to a playlist','<p>Setlists can be linked to a Playlist so band members can pre-listen in set order.</p>')
        )}

        ${helpSection('playlists','\uD83C\uDFA7','Playlists','Curated listening for pre-gig prep and practice.',
            '<p>The <strong>Playlists</strong> page (Menu \u2192 Playlists) lets you create themed song collections \u2014 like a mixtape for the band.</p>' +
            helpGrid([
                {icon:'\uD83D\uDD17', label:'Link to setlists', desc:'Mirror a setlist so the band can pre-listen in order before a gig'},
                {icon:'\uD83D\uDCF1', label:'Queue-based player', desc:'Songs play in a queue \u2014 no tab explosion. One player, seamless flow.'},
                {icon:'\uD83D\uDC42', label:'Listen tracking', desc:'Members can mark songs as "listened" so the band knows who\'s prepped'},
                {icon:'\uD83C\uDF89', label:'Listening Party', desc:'Sync listening across the band in real time (experimental)'},
            ]) +
            helpCallout('tip','Setlist \u2192 Playlist','Create a setlist first, then click "Link to Playlist". It auto-populates with the North Star version of every song in set order.')
        )}

        ${helpSection('recorder','\uD83C\uDF9B\uFE0F','Multi-Track Harmony Studio','Record, layer, mix, and export harmony parts \u2014 all in the browser.',
            '<p>The Multi-Track Studio lives inside each harmony section (Step 6 \u2192 Harmony Parts \u2192 click the \uD83C\uDF9B\uFE0F button). It\'s a full DAW-lite for capturing vocal parts.</p>' +
            helpCallout('info','First time?','Click the \uD83D\uDCD6 Tour button in the top-right of the studio for a guided walkthrough.') +
            helpGrid([
                {icon:'\uD83C\uDFA4', label:'Karaoke', desc:'Sheet music with moving cursor \u2014 only shows when ABC notation is saved'},
                {icon:'\uD83C\uDFB5', label:'Pitch Monitor', desc:'Real-time note name. Green = in tune, yellow = close, red = off'},
                {icon:'\uD83E\uDD41', label:'Metronome', desc:'Click track with flashing beat dots. Red = beat 1, blue = 2\u20134'},
                {icon:'\uD83C\uDF9A\uFE0F', label:'Tracks', desc:'All takes with Solo, Mute, Volume, Pan, Delete per track'},
                {icon:'\u23F1\uFE0F', label:'Sync / Latency', desc:'Compensates for device audio delay so tracks line up'},
                {icon:'\uD83C\uDF9B\uFE0F', label:'Effects', desc:'Dry \u00B7 Warm \u00B7 Bright \u00B7 Room reverb \u00B7 Hall reverb'},
                {icon:'\uD83D\uDD34', label:'Record', desc:'Captures mic while playing checked tracks as backing. Headphones required.'},
                {icon:'\uD83D\uDCBE', label:'Export', desc:'Bounces all checked tracks to one downloadable WAV file'},
            ]) +
            helpCallout('warn','Common mistakes','<strong>1. No headphones when recording vocals</strong> \u2014 bleed ruins the take.<br><strong>2. Skipping latency calibration</strong> \u2014 tracks sound out of sync. Calibrate once per device.<br><strong>3. Recording the full song at once</strong> \u2014 work section by section for easier fixes.')
        )}

        ${helpSection('karaoke','\uD83C\uDFA4','Karaoke Mode','Sing along to sheet music with a moving cursor and highlighted notes.',
            '<p>Karaoke Mode lives inside the Multi-Track Studio and only appears when a harmony section has <strong>ABC notation</strong> saved. It renders sheet music and plays it back \u2014 a red cursor tracks the current note, notes highlight as they play, and lyrics scroll word-by-word below.</p>' +
            helpCallout('warn','Prerequisite','Requires ABC notation saved for the section. Use <strong>\uD83C\uDFBC Edit Notation</strong> in the harmony section first.') +
            helpGrid([
                {icon:'\uD83C\uDFBC', label:'Sheet music', desc:'Full rendered notation from your ABC'},
                {icon:'\uD83D\uDCCD', label:'Red cursor', desc:'Moves across the staff tracking current position'},
                {icon:'\uD83D\uDC9C', label:'Note highlighting', desc:'Current notes turn purple as they play'},
                {icon:'\uD83D\uDFE1', label:'Lyrics scroll', desc:'Current word shown bright yellow in large text'},
                {icon:'\u25B6\uFE0F', label:'Playback controls', desc:'Play, pause, restart, loop'},
                {icon:'\u2195\uFE0F', label:'Resizable panel', desc:'Drag bottom edge to resize'},
            ]) +
            helpCallout('info','What is ABC notation?','Plain-text music notation \u2014 like Markdown for music. The in-app editor shows a live rendered preview as you type.')
        )}

        ${helpSection('bestshot','\uD83C\uDFC6','Best Shot','Rate your band\'s own recordings section by section and crown the definitive take.',
            '<p>The <strong>Best Shot</strong> page (Menu \u2192 Best Shot) is where you evaluate and rank your own band\'s recordings. Unlike North Star (the original artist), Best Shot is about <strong>your performances</strong>.</p>' +
            helpStep(1,'Add a take','<p>Upload or link a recording of your band playing a song \u2014 rehearsal recordings, live shows, or phone captures.</p>') +
            helpStep(2,'Rate by section','<p>If the song has a defined structure (Song DNA \u2192 Structure), rate each section 1\u20135. Compare how your chorus sounded across different rehearsals.</p>') +
            helpStep(3,'Crown the best','<p>When a take is clearly the best, crown it with \uD83D\uDC51. The crowned take becomes the definitive reference for your arrangement.</p>') +
            helpCallout('tip','Use with Scorecard','If you\'ve set up song structure sections, Best Shot shows an overview of all songs with section-level ratings. Great for identifying which parts still need work.')
        )}

        ${helpSection('equipment','\uD83C\uDF9B\uFE0F','Equipment','Keep a shared inventory of all band gear.',
            '<p>The <strong>Equipment</strong> page (Menu \u2192 Equipment) is a shared gear database \u2014 every pedal, amp, cable, and mic the band owns or shares.</p>' +
            helpGrid([
                {icon:'\uD83D\uDCF7', label:'Photo', desc:'Snap a photo with your phone camera or upload from library. Images auto-resize.'},
                {icon:'\uD83C\uDFF7\uFE0F', label:'Details', desc:'Name, category, owner, serial number, and notes'},
                {icon:'\uD83D\uDCDD', label:'Notes', desc:'Setup notes, signal chain position, settings to remember'},
                {icon:'\uD83D\uDD0D', label:'Search', desc:'Filter gear by name or category'},
            ]) +
            helpCallout('tip','Pre-gig checklist','Scroll through Equipment before load-in to make sure you have everything.')
        )}

        ${helpSection('moises','\uD83C\uDF9A\uFE0F','The Moises Stem Workflow','How to isolate individual instrument parts for practice.',
            '<p><a href="https://moises.ai" target="_blank" style="color:var(--accent-light)">Moises.ai</a> is an AI tool that separates a full recording into individual instrument stems \u2014 vocals, guitar, bass, keys, drums.</p>' +
            helpNumberedSteps([
                {icon:'\u2B07\uFE0F', title:'Find a recording', body:'Go to Step 3 (North Star) or Archive.org versions. You want a clean live recording.'},
                {icon:'\uD83D\uDCCB', title:'Copy the URL', body:'On Archive.org, find the specific MP3 for the song. Right-click \u2192 Copy Link.'},
                {icon:'\uD83C\uDF10', title:'Open Moises.ai', body:'Sign in (free tier works). Upload or paste the URL.'},
                {icon:'\u2699\uFE0F', title:'Choose 6 Stems', body:'Select "AI Music Separation" \u2192 "6 Stems". Wait 1\u20132 minutes.'},
                {icon:'\uD83C\uDFA7', title:'Solo your instrument', body:'Click Solo on your instrument. Adjust tempo without changing pitch. Loop sections.'},
                {icon:'\u2B06\uFE0F', title:'Upload back to GrooveLinx', body:'Download stems, upload via Step 6 \u2192 Moises Stems.'},
            ]) +
            helpCallout('tip','Show Splitter','If the Archive.org file is a full show, use the Show Splitter tool to note the timestamp for your song before sending to Moises.')
        )}

        ${helpSection('chopper','\u2702\uFE0F','Rehearsal Chopper','Slice a long rehearsal recording into individual songs.',
            '<p>The <strong>Rehearsal Chopper</strong> takes a single long recording and lets you mark timestamps where each song starts and ends.</p>' +
            helpStep(1,'Load a recording','<p>Open the Chopper from a Practice Plan. Upload or paste a link to the full rehearsal recording.</p>') +
            helpStep(2,'Mark timestamps','<p>Play the recording and click to mark song boundaries. Double-click any timestamp to edit precisely. Each chop point gets labeled with the song name from the practice plan.</p>') +
            helpStep(3,'Review segments','<p>Each segment can be played individually. Use clips for Best Shot ratings, practice reference, or sharing specific moments.</p>') +
            helpCallout('tip','Quick timestamps','Double-click any timestamp in the chopper timeline to type an exact time like 14:32.')
        )}

        ${helpSection('gigs','\uD83C\uDFA4','Gigs, Calendar & Venues','Tracking where you\'ve been and where you\'re going.',
            '<h4 style="color:var(--accent-light);margin:0 0 10px">Gigs</h4><p>The <strong>Gigs</strong> page tracks every show \u2014 past and upcoming:</p>' +
            helpGrid([
                {icon:'\uD83D\uDCCD', label:'Venue', desc:'Linked to the Venues database'},
                {icon:'\uD83D\uDCB0', label:'Pay', desc:'Per-show or per-member breakdown'},
                {icon:'\uD83C\uDF9B\uFE0F', label:'Sound person', desc:'Name and contact'},
                {icon:'\uD83D\uDCCB', label:'Setlist', desc:'Linked to the Setlists page'},
                {icon:'\u23F0', label:'Load-in / Start', desc:'Schedule for the night'},
                {icon:'\uD83D\uDCDD', label:'Notes', desc:'Parking, gear needs, special requests'},
            ]) +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Calendar</h4><p>Monthly view showing gigs and rehearsals. Tap a rehearsal to jump to its Practice Plan. Tap a gig to see full details.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">Venues</h4><p>Database of every venue: address, capacity, stage dimensions, PA system, load-in details, parking, and booking contacts. Use the <strong>Google Search</strong> button to auto-fill venue details.</p>'
        )}

        ${helpSection('collaboration','\u2601\uFE0F','Syncing & Collaboration','How data stays in sync across all five band members.',
            '<h4 style="color:var(--accent-light);margin:16px 0 8px">What syncs instantly</h4>' +
            helpGrid([
                {icon:'\uD83C\uDFAF', label:'Song statuses', desc:'Set by anyone, seen by everyone'},
                {icon:'\u2B50', label:'Reference versions & votes', desc:'Voting updates live'},
                {icon:'\uD83C\uDFA4', label:'Harmony parts', desc:'Shared across all members'},
                {icon:'\uD83D\uDCCB', label:'Rehearsal notes', desc:'Anyone can add, all can see'},
                {icon:'\uD83D\uDCCB', label:'Setlists', desc:'Real-time collaboration'},
                {icon:'\uD83D\uDCB0', label:'Finances', desc:'Pay tracking for everyone'},
                {icon:'\uD83D\uDD14', label:'Notifications', desc:'Push to the whole band'},
                {icon:'\uD83D\uDCC4', label:'Crib notes', desc:'Reference links per member, editable by anyone signed in'},
                {icon:'\uD83C\uDF9B\uFE0F', label:'Equipment', desc:'Shared gear inventory'},
            ]) +
            helpCallout('info','How it works','Song data (harmony parts, notes, tabs, covers) lives in Google Drive \u2014 one JSON file per song. Global band data (setlists, gigs, finances, statuses) lives in Firebase. Both sync automatically when signed in.') +
            helpCallout('tip','Offline use','The app works offline once loaded. Changes sync the next time you\'re connected and signed in.')
        )}

        ${helpSection('all-pages','\uD83D\uDCD1','All Pages A\u2013Z','Every page in the app and what it does.',
            '<p>Access all pages from the slide-out menu (tap \u2630 in the top-left corner).</p><div style="display:flex;flex-direction:column;gap:8px;margin:16px 0">' +
            helpPageEntry('\uD83C\uDFC6','Best Shot','Rate your band\'s own recordings section by section. Crown the best take.') +
            helpPageEntry('\uD83D\uDCC6','Calendar','Monthly view showing all gigs and rehearsals. Tap events to jump to details.') +
            helpPageEntry('\uD83D\uDC65','Contacts','Contact info for band members, venues, booking agents, and sound engineers.') +
            helpPageEntry('\uD83C\uDF9B\uFE0F','Equipment','Shared gear inventory with photos, categories, and setup notes.') +
            helpPageEntry('\uD83D\uDCB0','Finances','Track gig pay, per-member splits, and expenses.') +
            helpPageEntry('\uD83D\uDD0D','Find a Version','Search Archive.org, YouTube, Relisten, Spotify, and Phish.in from one screen. Listen inline and route to North Star, Cover Me, Fadr, or Practice.') +
            helpPageEntry('\uD83C\uDFA4','Gigs','Database of past and upcoming shows with venue, pay, setlist, and schedule.') +
            helpPageEntry('\u2753','Help & Guide','You are here! Comprehensive documentation for every feature.') +
            helpPageEntry('\uD83E\uDD41','Metronome','Full metronome with tap tempo, time signatures, and accent patterns.') +
            helpPageEntry('\uD83D\uDD14','Notifications','Band-wide alerts for rehearsal plans, setlist changes, and gig logistics.') +
            helpPageEntry('\uD83C\uDFA7','Playlists','Curated song collections for pre-gig listening. Link to setlists.') +
            helpPageEntry('\uD83D\uDCC5','Practice Plan','Build rehearsal agendas with goals, songs, and focus notes. Launch Rehearsal Mode.') +
            helpPageEntry('\u2699\uFE0F','Settings & Admin','App preferences, data management, member admin, and feedback.') +
            helpPageEntry('\uD83D\uDCCB','Setlists','Build gig-night song orders with sets, encores, transitions, and PDF export.') +
            helpPageEntry('\uD83D\uDCE3','Social Media','Draft social posts for gigs. Templates for Facebook, Instagram, email.') +
            helpPageEntry('\uD83C\uDFB5','Song Library','The home base \u2014 search, filter, and open any song in the catalog.') +
            helpPageEntry('\uD83C\uDFB8','Guitar Tuner','Chromatic tuner using your device microphone.') +
            helpPageEntry('\uD83C\uDFDB\uFE0F','Venues & Contacts','Venue database with address, stage details, PA info, and booking contacts.') +
            '</div>'
        )}

        ${helpSection('tools','\uD83D\uDEE0\uFE0F','Built-in Tools','Tuner, metronome, feedback, and more.',
            '<h4 style="color:var(--accent-light);margin:0 0 10px">\uD83C\uDFB8 Guitar Tuner</h4><p>Uses your device microphone to detect pitch in real time. Supports standard tuning (EADGBe) and common alternates.</p>' +
            helpCallout('tip','iPhone tip','Make sure you\'ve given the browser microphone permission. In Safari: Settings \u2192 Safari \u2192 Microphone \u2192 Allow.') +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83E\uDD41 Metronome</h4><p>Full-featured metronome with tap tempo, BPM display, time signatures (4/4, 3/4, 6/8), and accent patterns. BPM saved per-song when accessed from a song\'s detail page.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83D\uDCB0 Finances</h4><p>Track gig pay, splits, and expenses. Each gig auto-calculates per-member share. Useful for end-of-year tax records.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83D\uDCE3 Social Media</h4><p>Draft social posts for upcoming gigs. Save band social profiles and create posts with templates.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83D\uDD14 Notifications</h4><p>Band-wide notification system. Send alerts about rehearsal plans, setlist changes, or gig logistics. Supports push notifications on supported devices.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\uD83D\uDCAC Feedback</h4><p>Found a bug or have a feature idea? Use the Feedback form in Settings to send it directly.</p>' +
            '<h4 style="color:var(--accent-light);margin:20px 0 10px">\u2139\uFE0F About</h4><p>The About tab in Settings shows the current build number and sign-in status. Useful when reporting bugs.</p>'
        )}

        ${helpSection('troubleshooting','\uD83D\uDD27','Troubleshooting','When something\'s not working.',
            helpFAQ([
                {q:'I can\'t sign in / the Connect button doesn\'t work', a:'Use Chrome or Safari \u2014 Edge and Firefox sometimes block Google auth. Make sure pop-ups aren\'t blocked. On iPhone, use Safari rather than an in-app browser.'},
                {q:'I signed in but changes aren\'t syncing', a:'Check the Connect button shows your name. If it still shows "Connect", tap it again. Check internet connection. Try refreshing.'},
                {q:'Song statuses aren\'t showing up', a:'Statuses cache on first load. Wait a few seconds after signing in. If still wrong, go to Settings \u2192 Data \u2192 Clear Status Cache and refresh.'},
                {q:'Audio won\'t play on iPhone', a:'iOS requires a physical tap before playing audio (security restriction). Tap a play button directly \u2014 JavaScript auto-play is blocked.'},
                {q:'My bandmate can\'t see my harmony part', a:'Make sure they\'re signed in with Google. Harmony data syncs through Drive. Try sign out and back in.'},
                {q:'Cover Me / Reference Versions is empty', a:'This data is in Google Drive. Make sure Drive is connected (tap Connect \u2192 authorize). Try refreshing.'},
                {q:'Practice Mode won\'t open', a:'Requires a song to be selected first. Click a song in the library, then tap the \uD83E\uDDE0 Practice Mode card in the Chart section.'},
                {q:'Crib note pills don\'t open the add form', a:'You must be signed in. Once signed in, click any member pill \u2014 even for other members \u2014 and the add-ref form appears.'},
                {q:'The app is slow or feels stuck', a:'First load after install can be slow. After that it should be fast. Try: close and reopen, check internet, reinstall as PWA.'},
                {q:'I see "unverified app" when signing in', a:'Click <strong>Advanced</strong>, then <strong>Go to GrooveLinx (unsafe)</strong>. It\'s safe \u2014 the app only reads your email and Drive files.'},
                {q:'I accidentally deleted something', a:'Most data is in Firebase and Drive without built-in undo. Check Settings \u2192 Data \u2192 Export for backups. Contact Drew.'},
                {q:'How do I know what build I\'m running?', a:'Go to Settings (\u2699\uFE0F) \u2192 About tab. When a new build is deployed, an update banner appears \u2014 tap "Reload" to get the latest.'},
                {q:'I\'m on Android and the app looks different', a:'Minor visual differences are normal between iOS and Android. If something looks broken, screenshot it and send to Drew.'},
            ]) +
            '<div style="margin-top:20px;padding:16px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:10px"><div style="font-weight:700;margin-bottom:6px;color:var(--accent-light)">Still stuck?</div><div style="font-size:0.88em;color:var(--text-muted);line-height:1.6">Text Drew directly or use the Feedback form in Settings. When reporting a bug, include: your device, browser, what you were doing, and what happened.</div></div>'
        )}

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
        .help-page-entry { display:flex;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;align-items:flex-start; }
        .help-page-entry:hover { background:rgba(255,255,255,0.04); }
    </style>`;
}

// ── Helper builder functions ─────────────────────────────────────────────────
function helpSection(id, icon, title, subtitle, content) {
    return '<details class="app-card help-section" id="help-' + id + '"><summary style="cursor:pointer;padding:4px 0;user-select:none"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.4em">' + icon + '</span><div><div style="font-weight:700;font-size:1em;color:var(--text)">' + title + '</div><div style="font-size:0.8em;color:var(--text-dim);margin-top:1px">' + subtitle + '</div></div><span class="help-chevron" style="margin-left:auto;color:var(--text-dim);font-size:0.9em;transition:transform 0.2s">▶</span></div></summary><div style="padding:16px 0 4px;font-size:0.88em;color:var(--text-muted);line-height:1.7">' + content + '</div></details>';
}
function helpStep(num, title, content) {
    return '<div class="help-step"><div class="help-step-num">' + num + '</div><div style="flex:1"><div style="font-weight:700;color:var(--text);margin-bottom:6px">' + title + '</div>' + content + '</div></div>';
}
function helpVisual(html, caption) {
    return '<div class="help-visual">' + html + (caption ? '<div class="help-visual-caption">' + caption + '</div>' : '') + '</div>';
}
function helpCallout(type, label, text) {
    var icons = {tip:'💡', info:'ℹ️', warn:'⚠️'};
    return '<div class="help-callout-' + type + '"><strong>' + (icons[type]||'💡') + ' ' + label + ':</strong> ' + text + '</div>';
}
function helpGrid(items) {
    return '<div class="help-grid">' + items.map(function(item) { return '<div class="help-grid-item"><div style="font-size:1.2em;margin-bottom:4px">' + item.icon + '</div><div style="font-weight:700;font-size:0.85em;color:var(--text);margin-bottom:2px">' + item.label + '</div><div style="font-size:0.78em;color:var(--text-dim);line-height:1.4">' + item.desc + '</div></div>'; }).join('') + '</div>';
}
function helpTwoCol(left, right) {
    return '<div class="help-two-col"><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;font-size:0.85em;line-height:1.8">' + left + '</div><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:12px;font-size:0.85em;line-height:1.8">' + right + '</div></div>';
}
function helpFlowDiagram(steps) {
    return '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:0;margin:16px 0;justify-content:center">' + steps.map(function(s,i) { return '<div style="display:flex;align-items:center;gap:0"><div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:70px;text-align:center"><div style="width:36px;height:36px;background:rgba(99,102,241,0.25);border:2px solid rgba(99,102,241,0.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1em">' + s.icon + '</div><div style="font-size:0.65em;font-weight:700;color:var(--accent-light)">' + s.num + '</div><div style="font-size:0.7em;font-weight:600;color:var(--text);line-height:1.2">' + s.label + '</div><div style="font-size:0.65em;color:var(--text-dim)">' + s.desc + '</div></div>' + (i < steps.length-1 ? '<div style="color:var(--text-dim);font-size:0.9em;margin:0 2px;margin-bottom:24px">\u2192</div>' : '') + '</div>'; }).join('') + '</div>';
}
function helpNumberedSteps(steps) {
    return '<div style="margin:12px 0">' + steps.map(function(s,i) { return '<div style="display:flex;gap:12px;margin-bottom:14px"><div style="display:flex;flex-direction:column;align-items:center;gap:0;flex-shrink:0"><div style="width:32px;height:32px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1em">' + s.icon + '</div>' + (i<steps.length-1 ? '<div style="width:2px;flex:1;background:rgba(99,102,241,0.15);margin:2px 0"></div>' : '') + '</div><div style="flex:1;padding-top:4px"><div style="font-weight:700;color:var(--text);margin-bottom:3px;font-size:0.9em">Step ' + (i+1) + ': ' + s.title + '</div><div style="color:var(--text-dim);font-size:0.83em;line-height:1.5">' + s.body + '</div></div></div>'; }).join('') + '</div>';
}
function helpStatusPills() {
    return '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0"><span style="background:#7c3aed;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">👀 PROSPECT</span><span style="background:#d97706;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">🔧 IN PROGRESS</span><span style="background:#059669;color:white;padding:5px 12px;border-radius:20px;font-size:0.8em;font-weight:700">✅ GIG READY</span></div>';
}
function helpStatusCard(icon, label, color, desc) {
    return '<div style="display:flex;gap:12px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;align-items:flex-start"><div style="background:' + color + ';color:white;padding:5px 10px;border-radius:8px;font-size:0.78em;font-weight:800;white-space:nowrap;flex-shrink:0;margin-top:1px">' + icon + ' ' + label + '</div><div style="font-size:0.85em;color:var(--text-muted);line-height:1.5">' + desc + '</div></div>';
}
function helpPageEntry(icon, label, desc) {
    return '<div class="help-page-entry"><div style="font-size:1.3em;flex-shrink:0;width:28px;text-align:center">' + icon + '</div><div><div style="font-weight:700;color:var(--text);font-size:0.9em">' + label + '</div><div style="font-size:0.8em;color:var(--text-dim);line-height:1.4;margin-top:2px">' + desc + '</div></div></div>';
}
function helpFAQ(items) {
    return '<div style="margin:12px 0">' + items.map(function(item) { return '<div class="help-faq-item"><div style="font-weight:700;color:var(--text);font-size:0.88em;margin-bottom:5px">Q: ' + item.q + '</div><div style="color:var(--text-muted);font-size:0.83em;line-height:1.6">A: ' + item.a + '</div></div>'; }).join('') + '</div>';
}

// ── Navigation helpers ────────────────────────────────────────────────────────
function helpJump(id) {
    var el = document.getElementById('help-' + id);
    if (!el) return;
    el.open = true;
    setTimeout(function() { el.scrollIntoView({behavior:'smooth', block:'start'}); }, 50);
}
document.addEventListener('toggle', function(e) {
    if (!e.target.classList.contains('help-section')) return;
    var chevron = e.target.querySelector('.help-chevron');
    if (chevron) chevron.style.transform = e.target.open ? 'rotate(90deg)' : '';
}, true);
function filterHelpTopics(query) {
    var q = (query||'').toLowerCase().trim();
    document.querySelectorAll('.help-section').forEach(function(d) {
        if (!q) { d.style.display = ''; return; }
        var text = d.textContent.toLowerCase();
        var match = text.includes(q);
        d.style.display = match ? '' : 'none';
        if (match && q.length > 2) d.open = true;
    });
}
window.renderHelpPage = renderHelpPage;
window.filterHelpTopics = filterHelpTopics;
window.helpJump = helpJump;
(function() {
    var helpEl = document.getElementById('page-help');
    if (helpEl && !helpEl.classList.contains('hidden')) renderHelpPage(helpEl);
})();
console.log('❓ Help system loaded');

// ============================================================================
// HELP CONTENT REGISTRY
// Single source of truth for all in-product help content.
// Surfaces: first-time overlays, topbar ❓ button, local page triggers.
// Each entry: { icon, title, subtitle, bullets, helpSectionId, videoUrl? }
// ============================================================================

var GL_HELP_REGISTRY = {

    songs: {
        icon: '🎵',
        title: 'Songs',
        subtitle: 'Your band\'s full repertoire — everything starts here.',
        bullets: [
            '🔍 Search or filter to find any song in the catalog',
            '📋 Import starter charts with key, BPM, and chord charts pre-filled',
            '🧬 Open a song to set status, key, singer, and song structure',
            '⭐ Add reference versions, cover recordings, and crib notes',
            '📊 Rate each song\'s readiness — your scores feed the dashboard',
            '🧠 Launch Practice Mode for a full-screen learning experience',
        ],
        helpSectionId: 'song-workflow',
        videoUrl: null,
    },

    practice: {
        icon: '🧠',
        title: 'Practice Mode',
        subtitle: 'Full-screen music lab — five tabs for learning any song.',
        bullets: [
            '📋 Chart tab: chord charts with transpose, metronome, and brain trainer',
            '📖 Know tab: song history and meaning pulled from Genius',
            '🧠 Memory tab: AI-powered visual memory palace for lyrics',
            '🎵 Harmony tab: find stems on Archive.org and send to Fadr',
            '🎙️ Record tab: multi-track recorder — layer parts and export',
            '← → arrows (or swipe) to move between songs in a queue',
        ],
        helpSectionId: 'practice-mode',
        videoUrl: null,
    },

    rehearsal: {
        icon: '📅',
        title: 'Rehearsals',
        subtitle: 'Build a plan, run the session, stay focused.',
        bullets: [
            '➕ Create a rehearsal plan with goals, songs, and focus notes',
            '🎸 Launch Rehearsal Mode — full-screen charts for the whole queue',
            '✂️ Use the Chopper to slice a recording into individual songs',
            '📣 Share the plan to the band with one tap',
            '📆 Rehearsals appear on the Calendar automatically',
        ],
        helpSectionId: 'practice-plan',
        videoUrl: null,
    },

    setlists: {
        icon: '📋',
        title: 'Setlists',
        subtitle: 'Build gig-night song order — from blank page to PDF.',
        bullets: [
            '➕ Create a setlist and add songs to sets, encores, and soundcheck',
            '↕️ Drag and drop to reorder songs within each set',
            '→ Mark segues between songs that flow directly together',
            '🖨️ Print to a large-format PDF designed for music stands',
            '📱 Export a Crib Sheet with charts for every song, by set',
            '🔗 Link a setlist to a Playlist for pre-gig listening',
        ],
        helpSectionId: 'setlists',
        videoUrl: null,
    },

    gigs: {
        icon: '🎤',
        title: 'Gigs',
        subtitle: 'Track every show — past, upcoming, and the details in between.',
        bullets: [
            '➕ Add a gig with date, venue, load-in time, and setlist link',
            '📍 Venues are saved with address, PA info, and directions',
            '💰 Track per-gig pay and per-member splits',
            '🗓️ Gigs appear on the Calendar — tap to view details',
            '🗺️ Gig Map shows all your shows on a dark Google Map',
            '🔴 Go Live to launch gig mode when the show starts',
        ],
        helpSectionId: 'gigs',
        videoUrl: null,
    },

    stageplot: {
        icon: '🎭',
        title: 'Stage Plot',
        subtitle: 'Visual stage layout, channel list, and monitor mixes — ready to send to any venue.',
        bullets: [
            '🎛️ Drag elements from the palette onto the grid to build your stage layout',
            '🔄 Click any placed element to move, rotate, set input number, or remove it',
            '📋 Channel List auto-populates from placed elements — edit names and input numbers',
            '🔊 Monitor Mixes — define what each musician hears in their wedge or IEM',
            '📝 Tech Rider Notes — PA requirements, power needs, backline requests',
            '👤 Contact Info — sound person name, email, and phone for the venue',
            '🏟️ Venue Presets — save and switch between layouts for different stages',
            '🏷️ Toggle Labels to show/hide element names on the grid',
            '🧭 Toggle Directions to show stage left/right/front/back orientation',
            '🖨️ Export — generates a clean printable view to PDF or send to venue',
        ],
        helpSectionId: 'stage-plot',
        videoUrl: null,
    },

    ideas: {
        icon: '💡',
        title: 'Ideas Board',
        subtitle: 'Song ideas, jam concepts, and band polls — the creative inbox.',
        bullets: [
            '💡 Post song ideas, cover suggestions, or jam concepts',
            '🔗 Links to YouTube, Spotify, and Archive.org are auto-detected',
            '📊 Create polls to let the band vote on ideas',
            '💬 Comment and react to ideas with emoji',
            '📌 Pin important items to keep them visible',
        ],
        helpSectionId: 'ideas-board',
        videoUrl: null,
    },

};

// ============================================================================
// ONBOARDING OVERLAY ENGINE
// ============================================================================

var _GL_ONBOARD_PREFIX = 'gl_onboarded_';

/**
 * Called by showPage() after every navigation.
 * Shows overlay only if page is in registry and not yet dismissed on this device.
 */
function glCheckOnboarding(pageId) {
    if (!GL_HELP_REGISTRY[pageId]) return;
    var key = _GL_ONBOARD_PREFIX + pageId;
    if (localStorage.getItem(key)) return; // already seen
    // Small delay so the page render completes first
    setTimeout(function() { glShowOnboarding(pageId, false); }, 350);
}

/**
 * Show the onboarding overlay for a page.
 * force=true: show even if already dismissed (used by ❓ button and local triggers).
 */
function glShowOnboarding(pageId, force) {
    var entry = GL_HELP_REGISTRY[pageId];
    if (!entry) return;

    // Remove any existing overlay
    var existing = document.getElementById('gl-onboard-overlay');
    if (existing) existing.remove();

    var bulletsHTML = entry.bullets.map(function(b) {
        return '<li style="display:flex;gap:10px;align-items:flex-start;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
            + '<span style="flex-shrink:0;font-size:1em;line-height:1.5">' + b.split(' ')[0] + '</span>'
            + '<span style="color:var(--text-muted,#94a3b8);font-size:0.875em;line-height:1.5">' + b.split(' ').slice(1).join(' ') + '</span>'
            + '</li>';
    }).join('');

    var videoHTML = entry.videoUrl
        ? '<a href="' + entry.videoUrl + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;color:var(--accent-light,#818cf8);font-size:0.82em;font-weight:600;margin-top:12px;text-decoration:none;padding:6px 12px;border:1px solid rgba(129,140,248,0.3);border-radius:20px;background:rgba(99,102,241,0.08)">'
            + '▶️ Watch 60-second walkthrough</a>'
        : '';

    var moreHTML = '<button onclick="glDismissOnboarding(\'' + pageId + '\');showPage(\'help\');setTimeout(function(){helpJump(\'' + entry.helpSectionId + '\')},200)" '
        + 'style="background:none;border:none;color:var(--accent-light,#818cf8);font-size:0.78em;cursor:pointer;padding:0;text-decoration:underline;margin-top:4px">'
        + 'Full guide →</button>';

    var overlay = document.createElement('div');
    overlay.id = 'gl-onboard-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Welcome to ' + entry.title);
    overlay.innerHTML = [
        '<div id="gl-onboard-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9998;backdrop-filter:blur(2px)" onclick="glDismissOnboarding(\'' + pageId + '\')"></div>',
        '<div id="gl-onboard-card" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.95);opacity:0;transition:transform 0.22s cubic-bezier(.34,1.56,.64,1),opacity 0.18s ease;z-index:9999;width:min(440px,92vw);max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg-card,#1e293b);border:1px solid rgba(99,102,241,0.4);border-radius:18px;padding:24px 22px 20px;box-shadow:0 20px 60px rgba(0,0,0,0.6)">',
        '  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">',
        '    <span style="font-size:1.8em;line-height:1">' + entry.icon + '</span>',
        '    <div style="flex:1">',
        '      <div style="font-weight:800;font-size:1.05em;color:var(--text,#f1f5f9)">' + entry.title + '</div>',
        '      <div style="font-size:0.78em;color:var(--text-dim,#64748b);margin-top:2px">' + entry.subtitle + '</div>',
        '    </div>',
        '    <button onclick="glDismissOnboarding(\'' + pageId + '\')" aria-label="Dismiss" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--text-dim,#64748b);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:1em;line-height:1;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>',
        '  </div>',
        '  <ul style="list-style:none;padding:0;margin:0 0 12px">' + bulletsHTML + '</ul>',
        '  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:4px">',
        '    <div style="display:flex;flex-direction:column;gap:4px">',
        '      ' + moreHTML,
        '      ' + videoHTML,
        '    </div>',
        '    <button onclick="glDismissOnboarding(\'' + pageId + '\')" style="background:var(--accent,#6366f1);color:white;border:none;padding:8px 20px;border-radius:20px;font-weight:700;font-size:0.85em;cursor:pointer;font-family:inherit">Got it</button>',
        '  </div>',
        '</div>',
    ].join('');

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            var card = document.getElementById('gl-onboard-card');
            if (card) { card.style.transform = 'translate(-50%,-50%) scale(1)'; card.style.opacity = '1'; }
        });
    });

    // Escape key to dismiss
    overlay._escHandler = function(e) {
        if (e.key === 'Escape') glDismissOnboarding(pageId);
    };
    document.addEventListener('keydown', overlay._escHandler);
}

/**
 * Dismiss the overlay and mark page as seen.
 */
function glDismissOnboarding(pageId) {
    localStorage.setItem(_GL_ONBOARD_PREFIX + pageId, '1');
    var overlay = document.getElementById('gl-onboard-overlay');
    if (!overlay) return;
    var card = document.getElementById('gl-onboard-card');
    if (card) { card.style.transform = 'translate(-50%,-50%) scale(0.95)'; card.style.opacity = '0'; }
    document.removeEventListener('keydown', overlay._escHandler);
    setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 200);
}

/**
 * Show onboarding for the currently active page (used by topbar ❓ button).
 * Always shows regardless of dismissed state.
 */
function glHelpCurrentPage() {
    var page = (typeof currentPage !== 'undefined') ? currentPage : '';
    if (GL_HELP_REGISTRY[page]) {
        glShowOnboarding(page, true);
    } else {
        showPage('help');
    }
}

/**
 * Render a small inline help trigger for dynamic pages.
 * Call from the page renderer after setting the page title HTML.
 * containerId: the element to inject into (page container ID or element).
 * pageId: key in GL_HELP_REGISTRY.
 *
 * Usage in a page renderer:
 *   glInjectPageHelpTrigger('page-gigs', 'gigs');
 */
function glInjectPageHelpTrigger(containerId, pageId) {
    if (!GL_HELP_REGISTRY[pageId]) return;
    // Use a small delay to allow the page renderer to finish writing innerHTML
    setTimeout(function() {
        // Look for an h2 inside the container and append trigger after it
        var container = typeof containerId === 'string'
            ? document.getElementById(containerId)
            : containerId;
        if (!container) return;
        // Don't add twice
        if (container.querySelector('.gl-page-help-trigger')) return;
        var h2 = container.querySelector('h2, h1, .page-title');
        if (!h2) return;
        var btn = document.createElement('button');
        btn.className = 'gl-page-help-trigger';
        btn.title = 'What can I do here?';
        btn.setAttribute('aria-label', 'Help for this page');
        btn.textContent = '❓';
        btn.style.cssText = 'background:none;border:1px solid rgba(255,255,255,0.12);color:var(--text-dim,#64748b);font-size:0.75em;padding:3px 7px;border-radius:12px;cursor:pointer;margin-left:8px;vertical-align:middle;font-family:inherit;line-height:1.4;flex-shrink:0';
        btn.onclick = function() { glShowOnboarding(pageId, true); };
        // Insert inline after h2 — if h2 is inside a flex container, append sibling
        var parent = h2.parentNode;
        if (parent && parent.style && parent.style.display === 'flex') {
            parent.appendChild(btn);
        } else {
            h2.insertAdjacentElement('afterend', btn);
        }
    }, 80);
}

// Expose all public functions
window.glCheckOnboarding      = glCheckOnboarding;
window.glShowOnboarding       = glShowOnboarding;
window.glDismissOnboarding    = glDismissOnboarding;
window.glHelpCurrentPage      = glHelpCurrentPage;
window.glInjectPageHelpTrigger = glInjectPageHelpTrigger;
window.GL_HELP_REGISTRY       = GL_HELP_REGISTRY;

console.log('🧭 Onboarding system loaded — ' + Object.keys(GL_HELP_REGISTRY).length + ' pages registered');
