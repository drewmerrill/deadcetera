/**
 * gl-help-v2.js — Workflow-based help page rewrite
 * Overrides renderHelpPage from help.js with updated content.
 * Preserves all helper functions and onboarding system from help.js.
 * Loads AFTER help.js.
 */

(function() {
  'use strict';

  var _old = window.renderHelpPage;

  window.renderHelpPage = function(el) {
    var hs = typeof helpSection === 'function' ? helpSection : function(id,i,t,s,c){return '<details class="app-card help-section" id="help-'+id+'"><summary style="cursor:pointer;padding:4px 0"><div style="display:flex;align-items:center;gap:10px"><span style="font-size:1.4em">'+i+'</span><div><div style="font-weight:700;font-size:1em;color:var(--text)">'+t+'</div><div style="font-size:0.8em;color:var(--text-dim)">'+s+'</div></div><span style="margin-left:auto;color:var(--text-dim)">▶</span></div></summary><div style="padding:16px 0 4px;font-size:0.88em;color:var(--text-muted);line-height:1.7">'+c+'</div></details>';};
    var hc = typeof helpCallout === 'function' ? helpCallout : function(t,l,x){return '<div style="background:rgba(16,185,129,0.08);border-left:3px solid #10b981;border-radius:0 8px 8px 0;padding:10px 14px;margin:12px 0;font-size:0.85em"><strong>\uD83D\uDCA1 '+l+':</strong> '+x+'</div>';};
    var hf = typeof helpFAQ === 'function' ? helpFAQ : function(items){return items.map(function(i){return '<div style="border-bottom:1px solid rgba(255,255,255,0.06);padding:12px 0"><div style="font-weight:700;font-size:0.88em;color:var(--text)">'+i.q+'</div><div style="font-size:0.85em;color:var(--text-muted);margin-top:4px">'+i.a+'</div></div>';}).join('');};

    var html = '<div style="max-width:860px;margin:0 auto;padding:0 0 60px 0">';

    // Hero
    html += '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.25),rgba(168,85,247,0.15));border:1px solid rgba(99,102,241,0.35);border-radius:18px;padding:32px 28px;margin-bottom:28px;text-align:center">';
    html += '<img src="logo-large.png" alt="GrooveLinx" style="width:80px;height:80px;margin-bottom:10px;border-radius:12px">';
    html += '<h1 style="margin:0 0 8px;font-size:1.8em;background:linear-gradient(135deg,#667eea,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent">GrooveLinx Help</h1>';
    html += '<p style="color:var(--text-muted);font-size:1.05em;max-width:560px;margin:0 auto 20px;line-height:1.6">Your band\'s operating system. Know what to practice, see if you\'re improving, know if you\'re ready for the gig.</p>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">';
    var btns = [['getting-started','\uD83D\uDE80','Getting Started'],['practice','\uD83C\uDFB8','Practice'],['rehearsal','\uD83C\uDFBC','Rehearsal'],['gig','\uD83C\uDFA4','Gig Day'],['after-rehearsal','\uD83D\uDCCA','After Rehearsal'],['dashboard','\uD83C\uDFE0','Dashboard'],['communication','\uD83D\uDCAC','Comms'],['troubleshooting','\uD83D\uDD27','Help']];
    btns.forEach(function(b,i){
      var bg = i===0 ? 'background:var(--accent);color:white;border:none' : 'background:rgba(255,255,255,0.08);color:var(--text);border:1px solid rgba(255,255,255,0.15)';
      html += '<button onclick="helpJump(\''+b[0]+'\')" style="'+bg+';padding:8px 18px;border-radius:20px;cursor:pointer;font-weight:600;font-size:0.85em">'+b[1]+' '+b[2]+'</button>';
    });
    html += '</div></div>';

    // Search
    html += '<div style="margin-bottom:20px;position:relative"><span style="position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-dim)">\uD83D\uDD0D</span><input class="app-input" id="helpSearch" placeholder="Search help..." oninput="filterHelpTopics(this.value)" style="padding-left:38px;font-size:0.95em"></div>';

    // Sections
    html += hs('getting-started','\uD83D\uDE80','Getting Started','New to GrooveLinx? Do these 4 things.',
      '<div style="display:flex;flex-direction:column;gap:12px">' +
      '<div style="display:flex;gap:10px"><div style="width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0">1</div><div><strong>Sign in</strong> \u2014 Tap Connect top-right. Syncs your data with the band.</div></div>' +
      '<div style="display:flex;gap:10px"><div style="width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0">2</div><div><strong>Rate songs</strong> \u2014 Go to Songs, slide the readiness bar on 5+ songs. Unlocks Practice Radar and Band Health.</div></div>' +
      '<div style="display:flex;gap:10px"><div style="width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0">3</div><div><strong>Add a gig</strong> \u2014 Go to Gigs, add your next show. Activates gig risk and setlist readiness.</div></div>' +
      '<div style="display:flex;gap:10px"><div style="width:28px;height:28px;background:var(--accent);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85em;flex-shrink:0">4</div><div><strong>Check Home</strong> \u2014 The Command Center tells you what to work on, if you\'re improving, and if you\'re ready.</div></div>' +
      '</div>'
    );

    html += hs('practice','\uD83C\uDFB8','Practice a Song','Find what to work on and open charts fast.',
      '<p><strong>Song Intelligence</strong> \u2014 open any song to see readiness, top gap, and practice priority.</p>' +
      '<p><strong>Practice Radar</strong> \u2014 ranks songs by urgency. Based on readiness, recency, gig exposure, member gaps.</p>' +
      '<p><strong>Coaching Signals</strong> \u2014 one-line hints on charts: "Not practiced recently" or "On the setlist."</p>' +
      '<p><strong>Stoner Mode \u2192 Practice</strong> \u2014 fastest chart access. Search, tap, chart opens.</p>' +
      hc('tip','Quick chart','Desktop: Space on selected song. Touch: Stoner Mode \u2192 Practice.')
    );

    html += hs('rehearsal','\uD83C\uDFBC','Run a Rehearsal','Plan, execute, track.',
      '<p><strong>Rehearsal Agenda</strong> \u2014 auto-generated 47-min plan from readiness + weak spots.</p>' +
      '<p><strong>Stoner Mode \u2192 Rehearsal</strong> \u2014 one song at a time. GOOD / NEEDS WORK / TRAINWRECK.</p>' +
      '<p><strong>Pocket Meter</strong> \u2014 LIVE TEMPO tracks BPM stability. IN THE POCKET measures groove. Shows Groove Score.</p>' +
      hc('tip','Before rehearsal','Check the Rehearsal Brief on the Ideas Board.')
    );

    html += hs('gig','\uD83C\uDFA4','Play a Gig','Get ready for the show.',
      '<p><strong>Gig Confidence</strong> \u2014 Strong / Solid / Trending Up / Cautious / At Risk.</p>' +
      '<p><strong>Stage Plot</strong> \u2014 build layouts, channels, monitors. Export as PDF for venues.</p>' +
      '<p><strong>Stoner Mode \u2192 Gig</strong> \u2014 setlist chart access during performance.</p>'
    );

    html += hs('after-rehearsal','\uD83D\uDCCA','After Rehearsal','See what improved.',
      '<p><strong>Scorecard</strong> \u2014 session grade (0\u2013100). Readiness delta, groove trend.</p>' +
      '<p><strong>Upload Recording</strong> \u2014 drop MP3 in the Chopper. AI segments songs and restarts.</p>' +
      '<p><strong>Impact Feedback</strong> \u2014 Command Center shows improvements after rehearsal.</p>'
    );

    html += hs('dashboard','\uD83C\uDFE0','The Command Center','Your band\'s brain.',
      '<p>Answers three questions:</p>' +
      '<p><strong>1. What to work on?</strong> \u2192 Priority Queue</p>' +
      '<p><strong>2. Improving?</strong> \u2192 Band Momentum (\u2191 / \u2192 / \u2193)</p>' +
      '<p><strong>3. Ready?</strong> \u2192 Gig Confidence</p>' +
      '<p><strong>Band Health</strong> tiles: All Songs %, Pocket Time, Last Score, Weak Songs.</p>'
    );

    html += hs('communication','\uD83D\uDCAC','Communication','Talk about music.',
      '<p><strong>Song Discussions</strong> \u2014 per-song threads. Pin important messages.</p>' +
      '<p><strong>Ideas Board</strong> \u2014 post song ideas with YouTube/Spotify links.</p>' +
      '<p><strong>Polls</strong> \u2014 band votes. <strong>Rehearsal Brief</strong> \u2014 auto pre-rehearsal summary.</p>'
    );

    html += hs('settings','\u2699\uFE0F','Settings','Profile, band, data.',
      '<p><strong>Profile</strong> \u2014 name, role, home address.</p>' +
      '<p><strong>Band</strong> \u2014 display name, logo, members.</p>' +
      '<p><strong>Multi-Band</strong> \u2014 data scoped to active band. Switch or create here.</p>'
    );

    html += hs('troubleshooting','\uD83D\uDD27','Troubleshooting','When things break.',
      hf([
        {q:'Can\'t sign in', a:'Use Chrome or Safari. Allow pop-ups.'},
        {q:'Data not syncing', a:'Check Connect shows your name. Refresh.'},
        {q:'Wrong statuses', a:'Settings \u2192 Data \u2192 Clear Cache, refresh.'},
        {q:'Audio won\'t play on iPhone', a:'iOS needs a physical tap first.'},
        {q:'App is slow', a:'Hard refresh (Cmd+Shift+R). Clear cache in Settings.'},
        {q:'Pocket Meter inaccurate', a:'Try BPM range presets. Place device near drums.'},
        {q:'Stage Plot export blank', a:'Allow pop-ups for export window.'},
        {q:'Unverified app warning', a:'Click Advanced \u2192 Go to GrooveLinx. Safe.'},
      ]) +
      '<div style="margin-top:20px;padding:16px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.25);border-radius:10px"><div style="font-weight:700;margin-bottom:6px;color:var(--accent-light)">Still stuck?</div><div style="font-size:0.88em;color:var(--text-muted)">Feedback form in Settings, or text Drew.</div></div>'
    );

    html += '</div>';
    el.innerHTML = html;
  };

  console.log('\u2705 gl-help-v2.js loaded \u2014 help page rewritten for workflows');
})();
