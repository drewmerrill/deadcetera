// ============================================================================
// js/features/home-dashboard.js
// GrooveLinx Home Dashboard — Moment-Based Entry Screen
//
// Phase 1: skeleton · homeDataLoad · loadUpcomingGigs · context banner · Play Show card
// Phase 2 (next): Rehearse card · Practice card
// Phase 3 complete: Build Setlist card · dynamic ordering
//
// DEPENDENCIES (all window globals from existing files):
//   loadBandDataFromDrive()            — firebase-service.js
//   toArray()                          — utils.js
//   currentUserEmail                   — firebase-service.js
//   readinessCache, readinessCacheLoaded  — app.js
//   BAND_MEMBERS_ORDERED               — app.js
//   getCurrentMemberReadinessKey()     — app.js
//   readinessColor()                   — app.js
//   showPage()                         — js/ui/navigation.js
//   pageRenderers                      — js/ui/navigation.js
//   sanitizeFirebasePath()             — js/core/utils.js
//   showToast()                        — js/core/utils.js
//
// EXPOSES to window:
//   renderHomeDashboard()
//   refreshHomeDashboard()
//   invalidateHomeCache()
//   homeGoLive(gigId)
//   homeCarePackage(gigId)
//   homeDismissBanner()
//   homeViewSetlist(setlistId)
// ============================================================================

'use strict';

// ── Module-level state ───────────────────────────────────────────────────────

var _homeBundle       = null;   // cached data bundle
var _homeCacheTime    = 0;      // ms timestamp of last load
var _HOME_CACHE_TTL   = 300000; // 5 minutes

var _BANNER_DISMISS_KEY = 'gl_home_banner_dismissed';

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point. Called by navigation.js onShow for the 'home' page.
 * Renders skeleton immediately, then loads data and populates cards.
 */
window.renderHomeDashboard = async function renderHomeDashboard() {
    var container = document.getElementById('page-home');
    if (!container) return;

    // Render skeleton immediately — user sees structure before data loads
    container.innerHTML = _renderSkeletonHTML();

    try {
        var bundle = await _homeDataLoad();
        var context = _computeHomeContext(bundle);
        container.innerHTML = _renderDashboard(bundle, context);
        _triggerDashboardEntrance();
        _scheduleWeakSongsFill(bundle);
    } catch (err) {
        console.warn('[Home] Load error:', err);
        container.innerHTML = _renderErrorState();
    }
};

/**
 * Re-render from cache if still fresh. Called on visibilitychange return.
 * Falls through to full render if cache is stale.
 */
window.refreshHomeDashboard = function refreshHomeDashboard() {
    var container = document.getElementById('page-home');
    if (!container) return;
    if (_homeBundle && (Date.now() - _homeCacheTime < _HOME_CACHE_TTL)) {
        var context = _computeHomeContext(_homeBundle);
        container.innerHTML = _renderDashboard(_homeBundle, context);
        _triggerDashboardEntrance();
        _scheduleWeakSongsFill(_homeBundle);
    } else {
        window.renderHomeDashboard();
    }
};

/**
 * Invalidate the data cache. Called as a side effect of saveMyReadiness()
 * in app.js so the home screen reflects readiness changes promptly.
 */
window.invalidateHomeCache = function invalidateHomeCache() {
    _homeBundle   = null;
    _homeCacheTime = 0;
    var hp = document.getElementById('page-home');
    if (hp && hp.style.display !== 'none' && typeof window.renderHomeDashboard === 'function') {
        window.renderHomeDashboard();
    }
};

// ── CTA event handlers (must be on window for inline onclick) ────────────────

window.homeGoLive = function homeGoLive(linkedSetlist) {
    if (!linkedSetlist) {
        if (typeof window.showPage === 'function') window.showPage('gigs');
        return;
    }
    if (typeof window.gigLaunchLinkedSetlist === 'function') {
        window.gigLaunchLinkedSetlist(linkedSetlist);
    } else if (typeof window.showPage === 'function') {
        window.showPage('gigs');
        if (typeof window.showToast === 'function') window.showToast('📍 Opening Gigs — tap Go Live');
    }
};

window.homeCarePackage = function homeCarePackage() {
    if (typeof window.carePackageSend === 'function') {
        window.carePackageSend('gig');
    } else if (typeof window.showPage === 'function') {
        window.showPage('gigs');
    }
};

window.homeDismissBanner = function homeDismissBanner() {
    try { sessionStorage.setItem(_BANNER_DISMISS_KEY, '1'); } catch(e) {}
    window.refreshHomeDashboard();
};

window.homeViewSetlist = function homeViewSetlist(linkedSetlist) {
    if (linkedSetlist && typeof window.gigLaunchLinkedSetlist === 'function') {
        window.gigLaunchLinkedSetlist(linkedSetlist);
    } else if (typeof window.showPage === 'function') {
        window.showPage('setlists');
    }
};

// ── Data loading ─────────────────────────────────────────────────────────────

async function _homeDataLoad() {
    if (_homeBundle && (Date.now() - _homeCacheTime < _HOME_CACHE_TTL)) {
        return _homeBundle;
    }

    var results = await Promise.allSettled([
        _loadUpcomingGigs(3),
        _loadUpcomingPlans(2),
        _loadSetlistSummaries(),
        _loadRecentGigHistory()
    ]);

    var bundle = {
        gigs:          results[0].status === 'fulfilled' ? results[0].value : [],
        plans:         results[1].status === 'fulfilled' ? results[1].value : [],
        setlists:      results[2].status === 'fulfilled' ? results[2].value : [],
        recentSongs:   results[3].status === 'fulfilled' ? results[3].value : [],
        readinessCache: (typeof readinessCache !== 'undefined') ? readinessCache : {},
        memberKey:     _getMemberKey()
    };

    _homeBundle   = bundle;
    _homeCacheTime = Date.now();
    return bundle;
}

async function _loadUpcomingGigs(n) {
    if (typeof window.loadBandDataFromDrive !== 'function') return [];
    var today = _todayStr();
    try {
        var all = window.toArray ? window.toArray(await window.loadBandDataFromDrive('_band', 'gigs') || [])
                                 : (await window.loadBandDataFromDrive('_band', 'gigs') || []);
        return all
            .filter(function(g) { return (g.date || '') >= today; })
            .sort(function(a, b) { return (a.date || '').localeCompare(b.date || ''); })
            .slice(0, n);
    } catch (err) {
        console.warn('[Home] loadUpcomingGigs failed:', err);
        return [];
    }
}

async function _loadUpcomingPlans(n) {
    if (typeof firebaseDB === 'undefined' || !firebaseDB) return [];
    var today = _todayStr();
    try {
        var snap = await firebaseDB.ref(window.bandPath('rehearsals')).once('value');
        var val = snap.val();
        if (!val) return [];
        return Object.values(val)
            .filter(function(e) { return e && e.date && e.date >= today; })
            .sort(function(a, b) { return (a.date||'').localeCompare(b.date||''); })
            .slice(0, n || 2);
    } catch(e) {
        console.warn('[Home] _loadUpcomingPlans failed:', e);
        return [];
    }
}

async function _loadSetlistSummaries() {
    if (typeof window.loadBandDataFromDrive !== 'function') return [];
    try {
        var raw = window.toArray ? window.toArray(await window.loadBandDataFromDrive('_band', 'setlists') || [])
                                 : (await window.loadBandDataFromDrive('_band', 'setlists') || []);
        return raw.map(function(sl, i) {
            var songCount = (sl.sets || []).reduce(function(acc, s) { return acc + (s.songs || []).length; }, 0);
            return { name: sl.name || 'Untitled', date: sl.date || '', venue: sl.venue || '', sets: sl.sets || [], songCount: songCount, _origIdx: i };
        });
    } catch(e) {
        console.warn('[Home] _loadSetlistSummaries failed:', e);
        return [];
    }
}

async function _loadRecentGigHistory() {
    if (typeof window.loadBandDataFromDrive !== 'function') return [];
    try {
        var today = _todayStr();
        var cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 90);
        var cutoffStr = cutoff.toISOString().slice(0, 10);
        var all = window.toArray ? window.toArray(await window.loadBandDataFromDrive('_band', 'gigs') || [])
                                 : (await window.loadBandDataFromDrive('_band', 'gigs') || []);
        return all.filter(function(g) { return (g.date || '') >= cutoffStr && (g.date || '') < today; })
                  .sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })
                  .slice(0, 5);
    } catch(e) { return []; }
}

// ── Context computation ──────────────────────────────────────────────────────

function _computeHomeContext(bundle) {
    var bannerType = _resolveBannerType(bundle);
    var bannerData = _resolveBannerData(bannerType, bundle);

    var scores = {
        playShow: _scorePlayShowCard(bundle),
        rehearse: _scoreRehearseCard(bundle),
        practice: _scorePracticeCard(bundle),
        setlist:  _scoreSetlistCard(bundle)
    };

    var cardOrder = _computeCardOrder(scores, bannerType);

    return { bannerType: bannerType, bannerData: bannerData, cardOrder: cardOrder };
}

function _resolveBannerType(bundle) {
    try { if (sessionStorage.getItem(_BANNER_DISMISS_KEY) === '1') return null; } catch(e) {}

    var today = _todayStr();
    var nextGig = bundle.gigs && bundle.gigs[0];

    if (!nextGig) return null;

    if (nextGig && nextGig.date === today) return 'gig_today';

    var nextPlan = bundle.plans && bundle.plans[0];
    if (nextPlan && nextPlan.date === today) return 'rehearsal_today';

    if (nextGig) {
        var diff = _dayDiff(today, nextGig.date);
        if (diff >= 0 && diff <= 2) return 'gig_soon';
    }

    return null;
}

function _resolveBannerData(bannerType, bundle) {
    if (!bannerType) return null;
    return {
        gig:  bundle.gigs  && bundle.gigs[0]  || null,
        plan: bundle.plans && bundle.plans[0] || null
    };
}

function _computeCardOrder(scores, bannerType) {
    if (bannerType === 'gig_today') {
        return ['playShow', 'rehearse', 'practice', 'setlist'];
    }
    if (bannerType === 'rehearsal_today') {
        return ['rehearse', 'practice', 'playShow', 'setlist'];
    }
    return Object.entries(scores)
        .sort(function(a, b) { return b[1] - a[1]; })
        .map(function(pair) { return pair[0]; });
}

function _scorePlayShowCard(bundle) {
    var gig = bundle.gigs && bundle.gigs[0];
    if (!gig) return 0;
    var diff = _dayDiff(_todayStr(), gig.date);
    if (diff === 0) return 3;
    if (diff <= 1) return 2;
    if (diff <= 7) return 1;
    return 0;
}

// ── Top-level render ─────────────────────────────────────────────────────────

function _renderDashboard(bundle, context) {
    var isStoner = _resolveIsStoner();
    var activityHTML = _renderActivityFeed(bundle);
    return [
        '<div class="home-dashboard hd-mission-board">',
        renderHdHeroNextUp(bundle, isStoner),
        '<div class="hd-buckets home-anim-cards">',
        renderHdYourPrep(bundle),
        renderHdBandStatus(bundle),
        renderHdNextRehearsalGoal(bundle),
        renderHdSongsNeedingWork(bundle),
        renderPracticeRadar(),
        renderRehearsalAgenda(),
        renderLastRehearsal(),
        '</div>',
        activityHTML ? activityHTML.replace('id="home-activity-feed"', 'id="home-activity-feed" class="hd-activity-demoted"') : '',
        '</div>'
    ].join('');
}

// ── Mission Board Helpers ────────────────────────────────────────────────────

function deriveHdReadinessLabel(pct) {
    if (pct === null || pct === undefined) return null;
    if (pct >= 85) return { short: 'GIG READY',            long: 'Gig Ready',           color: 'var(--green)', tone: 'ready'   };
    if (pct >= 68) return { short: 'MINOR TUNE-UP NEEDED', long: 'Minor tune-up needed', color: '#fbbf24',      tone: 'caution' };
    if (pct >= 50) return { short: 'NEEDS REHEARSAL',      long: 'Needs rehearsal',      color: '#f97316',      tone: 'warning' };
    return             { short: 'CRITICAL PREP',           long: 'Critical prep needed', color: '#ef4444',      tone: 'critical'};
}

function deriveHdConfidenceTone(bundle) {
    return deriveHdReadinessLabel(_computeBandReadinessPct(bundle));
}

function deriveHdMissionSummary(bundle) {
    var pct=_computeBandReadinessPct(bundle),rc=bundle.readinessCache||{},nextGig=bundle.gigs&&bundle.gigs[0],nextPlan=bundle.plans&&bundle.plans[0],rl=deriveHdReadinessLabel(pct);
    var we=Object.entries(rc).filter(function(e){return e[1]&&_bandAvgForSong(e[1])<3;}),wc=we.length,tw=we.sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);})[0];
    var line1='',line2='';
    if(nextGig){var diff=nextGig.date?_dayDiff(_todayStr(),nextGig.date):null,when=diff===0?'Tonight':diff===1?'Tomorrow':(nextGig.date?_formatDateShort(nextGig.date):'');line1=_escHtml(nextGig.venue||'Your next show')+' is next.';if(rl&&wc===0)line1+=' Your band is '+rl.long.toLowerCase()+'.';else if(rl)line1+=' Your band is '+rl.long.toLowerCase()+', but '+wc+' song'+(wc!==1?'s':'')+' need'+(wc===1?'s':'')+' work.';var d2=[];if(when)d2.push(when);if(nextGig.startTime)d2.push('Set '+_escHtml(nextGig.startTime));if(tw)d2.push('Focus: '+_escHtml(tw[0]));if(nextGig.linkedSetlist)d2.push('Setlist: '+_escHtml(nextGig.linkedSetlist));line2=d2.join(' \xb7 ');
    }else if(nextPlan){var diff2=nextPlan.date?_dayDiff(_todayStr(),nextPlan.date):null,when2=diff2===0?'Tonight':diff2===1?'Tomorrow':(nextPlan.date?_formatDateShort(nextPlan.date):'');line1='Rehearsal '+(when2?when2.toLowerCase():'coming up')+'.';if(rl&&wc>0)line1+=' '+wc+' song'+(wc!==1?'s':'')+' need'+(wc===1?'s':'')+' work before then.';else if(rl)line1+=' Band is '+rl.long.toLowerCase()+'.';if(tw)line2='Focus: '+_escHtml(tw[0]);
    }else{line1=rl?'Band is '+rl.long.toLowerCase()+'.':'No upcoming events scheduled.';if(wc>0)line1+=' '+wc+' song'+(wc!==1?'s':'')+' need'+(wc===1?'s':'')+' work.';}
    return {line1:line1,line2:line2,rl:rl,weakCount:wc,topWeak:tw};
}

function deriveHdPrepFocus(bundle) {
    var rc=bundle.readinessCache||{},myKey=bundle.memberKey,nextGig=bundle.gigs&&bundle.gigs[0];
    if(!myKey)return null;
    var weak=[];
    Object.entries(rc).forEach(function(e){var t=e[0],r=e[1]||{},m=r[myKey];if(typeof m==='number'&&m>0&&m<3){var rs=m<=1?['Low readiness']:['Needs work'];if(_bandAvgForSong(r)<3)rs.push('Band also needs work');weak.push({title:t,score:m,reasons:rs});}});
    weak.sort(function(a,b){return a.score-b.score;});
    if(!weak.length)return{empty:true};
    return{top:weak[0],rest:weak.slice(1),total:weak.length,eventTie:nextGig?('Needed for '+_escHtml(nextGig.venue||'your next show')):null};
}

function deriveHdBandIntel(bundle) {
    var pct=_computeBandReadinessPct(bundle),rc=bundle.readinessCache||{},rl=deriveHdReadinessLabel(pct),nextPlan=bundle.plans&&bundle.plans[0],nextGig=bundle.gigs&&bundle.gigs[0],lines=[];
    if(pct!==null&&rl)lines.push({label:'Readiness',icon:'\ud83d\udcca',value:pct+'% \u2014 '+rl.long,color:rl.color});
    if(nextPlan){var diff=nextPlan.date?_dayDiff(_todayStr(),nextPlan.date):null,dl=diff===0?'Tonight':diff===1?'Tomorrow':_formatDateShort(nextPlan.date),ps=(nextPlan.plan&&Array.isArray(nextPlan.plan.songs))?nextPlan.plan.songs.length:0;lines.push({label:'Next rehearsal',icon:'\ud83d\udcc5',value:dl+(ps?' \xb7 '+ps+' songs planned':'')}); }
    if(nextGig&&nextGig.linkedSetlist){var slR=_computeSetlistReadiness(nextGig,rc);lines.push({label:'Setlist',icon:'\ud83c\udfb6',value:_escHtml(nextGig.linkedSetlist)+(slR?' \xb7 '+slR:'')});}
    var we=Object.entries(rc).filter(function(e){return e[1]&&_bandAvgForSong(e[1])<3;});
    if(we.length){var top=we.sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);})[0];lines.push({label:'Biggest risk',value:_escHtml(top[0]),color:'#f97316'});}
    return lines.slice(0,4);
}

function renderHdHeroNextUp(bundle, isStoner) {
    var nextGig  = bundle.gigs  && bundle.gigs[0];
    var nextPlan = bundle.plans && bundle.plans[0];
    if (nextGig)  return _renderHdHeroGig(nextGig, bundle, isStoner);
    if (nextPlan) return _renderHdHeroRehearsal(nextPlan, bundle);
    return [
        '<div class="hd-hero hd-hero--empty home-anim-header">',
        '<div class="hd-hero__eyebrow">NEXT UP</div>',
        '<div class="hd-hero__title">Nothing Scheduled Yet</div>',
        '<div class="hd-hero__sub">Add a gig or rehearsal to get started.</div>',
        '<div class="hd-hero__actions">',
        '<button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'gigs\')">Add Gig</button>',
        '<button class="hd-hero__cta hd-hero__cta--secondary" onclick="showPage(\'rehearsal\')">Plan Rehearsal</button>',
        '</div></div>'
    ].join('');
}

function _renderHdHeroGig(gig, bundle, isStoner) {
    var ls      = gig.linkedSetlist || null;
    var lsEsc   = ls ? _escHtml(ls) : '';
    var venue   = _escHtml(gig.venue || 'Upcoming Show');
    var diff    = gig.date ? _dayDiff(_todayStr(), gig.date) : null;
    var isToday = diff === 0;
    var isSoon  = diff !== null && diff <= 2;
    var dateLbl = isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(gig.date);
    var timeLbl = '';
    if (gig.doorsTime) timeLbl = 'Doors ' + _escHtml(gig.doorsTime);
    if (gig.startTime) timeLbl = (timeLbl ? timeLbl + ' \xb7 ' : '') + 'Set ' + _escHtml(gig.startTime);
    var urgency = isToday ? 'hd-hero--gig hd-hero--urgent' : isSoon ? 'hd-hero--gig hd-hero--soon' : 'hd-hero--gig';
    var badge   = isToday ? '<span class="hd-hero__badge hd-hero__badge--live">TONIGHT</span>'
                : diff === 1 ? '<span class="hd-hero__badge hd-hero__badge--soon">TOMORROW</span>'
                : isSoon ? '<span class="hd-hero__badge hd-hero__badge--soon">IN ' + diff + ' DAYS</span>' : '';
    var readHTML = isStoner ? '' : _renderSetlistReadinessBars(gig, bundle.readinessCache);
    var warnHTML = isStoner ? '' : _renderReadinessWarnings(gig, bundle.readinessCache);
    var slLine   = ls ? '<div class="hd-hero__setlist">Setlist: ' + lsEsc + '</div>' : '';
    var pct=_computeBandReadinessPct(bundle),rl=deriveHdReadinessLabel(pct);
    var rb=rl?'<span class="hd-hero__ready-badge" style="background:'+rl.color+'22;color:'+rl.color+';border-color:'+rl.color+'55">'+rl.short+'</span>':'' ;
    var ms4=deriveHdMissionSummary(bundle),coach='';
    if(rl&&rl.tone==='ready')coach=ms4.topWeak?'Locked in. Tighten '+_escHtml(ms4.topWeak[0])+' and you\'re golden.':'Band is locked in. Go get \'em.';
    else if(rl&&rl.tone==='caution')coach=ms4.topWeak?'Almost there. Lock in '+_escHtml(ms4.topWeak[0])+' and the set is solid.':'One more run-through and you\'re ready.';
    else if(rl)coach='Get a rehearsal in before this one.';
    var cd='';
    var cdInline=diff!==null&&diff>1?' · <span class="hd-hero__days-away">'+diff+'d away</span>':diff===1?' · <span class="hd-hero__days-away">Tomorrow</span>':'';
    // Readiness progress bar
    var pctColor = pct >= 85 ? 'var(--green)' : pct >= 68 ? '#fbbf24' : pct >= 50 ? '#f97316' : '#ef4444';
    var rlLabel = rl ? rl.long : '';
    var pctBar = pct !== null ? '<div class="hd-hero__pct-row">' +'<div class="hd-hero__pct-val hd-score-pulse" style="color:'+pctColor+';font-size:32px;font-weight:900;line-height:1;letter-spacing:-0.02em;text-shadow:0 0 20px '+pctColor+'66;margin-bottom:6px">'+pct+'%</div>' +'<div class="hd-hero__pct-track"><div class="hd-hero__pct-fill" style="width:'+pct+'%;background:'+pctColor+';box-shadow:0 0 8px '+pctColor+'88"></div></div>' +'<div class="hd-hero__pct-state" style="color:'+pctColor+';font-size:11px;font-weight:700;margin-top:4px">'+rlLabel+'</div>' +'</div>' : '';
    // Biggest risk song
    var rc2 = bundle.readinessCache || {};
    var riskEntry = Object.entries(rc2).filter(function(e){return e[1]&&_bandAvgForSong(e[1])<3;}).sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);})[0];
    var riskAvg = riskEntry ? _bandAvgForSong(riskEntry[1]) : null;
    var riskLine = riskEntry ? '<div class="hd-hero__risk-pill">⚠️ <span class="hd-hero__risk-song">'+_escHtml(riskEntry[0])+'</span><span class="hd-hero__risk-label">BIGGEST RISK</span>'+(riskAvg!==null?'<span class="hd-hero__risk-avg" style="color:#ef4444">'+riskAvg.toFixed(1)+'</span>':'')+'</div>' : '';
    var primaryCTA=isToday?'<button class="hd-hero__cta hd-hero__cta--primary hd-hero__cta--golive" onclick="homeGoLive(\''+lsEsc+'\')">Go Live \u2192</button>':'<button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'gigs\')">Open Gig \u2192</button>';
    var secondaryCTA=ls?'<button class="hd-hero__cta hd-hero__cta--secondary" onclick="homeViewSetlist(\''+lsEsc+'\')">View Setlist</button>':'';
    var tertiaryCTA=!isToday?'<button class="hd-hero__cta hd-hero__cta--tertiary" onclick="showPage(\'rehearsal\')">Start Rehearsal Prep</button>':'';
    return ['<div class="hd-hero '+urgency+' home-anim-header">','<div class="hd-hero__eyebrow">BAND MISSION '+badge+'</div>','<div class="hd-hero__title-row"><span class="hd-hero__title">'+venue+'</span>'+rb+'</div>','<div class="hd-hero__sub">'+dateLbl+(timeLbl?' \xb7 '+timeLbl:'')+cdInline+'</div>',slLine,cd,pctBar,riskLine,coach?'<div class="hd-hero__coach">'+coach+'</div>':'',readHTML?'<div class="hd-hero__readiness">'+readHTML+'</div>':'',warnHTML?'<div class="hd-hero__warnings">'+warnHTML+'</div>':'','<div class="hd-hero__actions">'+primaryCTA+secondaryCTA+'</div>',tertiaryCTA,'</div>'].join('');
}

function _renderHdHeroRehearsal(plan, bundle) {
    var today   = _todayStr();
    var isToday = plan.date === today;
    var diff    = plan.date ? _dayDiff(today, plan.date) : null;
    var dateLbl = isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(plan.date);
    var time    = plan.time ? ' at ' + _escHtml(plan.time) : '';
    var loc     = plan.location ? _escHtml(plan.location) : 'Location TBD';
    var songs   = (plan.plan && Array.isArray(plan.plan.songs)) ? plan.plan.songs : [];
    var badge   = isToday ? '<span class="hd-hero__badge hd-hero__badge--rehearse">TONIGHT</span>' : '';
    return [
        '<div class="hd-hero hd-hero--rehearse' + (isToday ? ' hd-hero--urgent' : '') + ' home-anim-header">',
        '<div class="hd-hero__eyebrow">NEXT UP ' + badge + '</div>',
        '<div class="hd-hero__title">Rehearsal \u2014 ' + dateLbl + time + '</div>',
        '<div class="hd-hero__sub">' + loc + ' \xb7 ' + (songs.length ? songs.length + ' songs planned' : 'No songs planned yet') + '</div>',
        '<div class="hd-hero__actions"><button class="hd-hero__cta hd-hero__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button></div>',
        '</div>'
    ].join('');
}

function renderHdYourPrep(bundle) {
    var pf=deriveHdPrepFocus(bundle);
    if(!pf)return '<div class="hd-bucket hd-bucket--prep"><div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFB8</span><span class="hd-bucket__title">YOUR PREP</span></div><div class="hd-bucket__empty">Sign in to see your queue</div><button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'practice\')">Song Library</button></div>';
    if(pf.empty)return '<div class="hd-bucket hd-bucket--prep hd-bucket--ok"><div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFB8</span><span class="hd-bucket__title">YOUR PREP</span></div><div class="hd-bucket__ok">All caught up \u2014 no songs below threshold</div><button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'practice\')">Song Library</button></div>';
    var top=pf.top,rs=top.reasons.slice(0,2).join(' \xb7 ');
    var scoreColor=top.score<=1?'#ef4444':top.score<=2?'#f97316':'#fbbf24';
    var scoreChip='<span style="font-size:10px;font-weight:700;color:'+scoreColor+';background:'+scoreColor+'22;border-radius:4px;padding:1px 6px;margin-left:6px">'+top.score+'/5</span>';
    var mh=pf.total>1?'<div class="hd-bucket__more">+'+(pf.total-1)+' more need your attention</div>':'' ;
    var tl=pf.eventTie?'<div class="hd-bucket__event-tie" style="font-size:11px;color:var(--text-dim)">'+pf.eventTie+'</div>':'' ;
    return ['<div class="hd-bucket hd-bucket--prep">','<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFB8</span><span class="hd-bucket__title">YOUR PREP</span><span class="hd-bucket__count">'+pf.total+' song'+(pf.total!==1?'s':'')+'</span></div>','<div class="hd-bucket__focus-song" style="font-size:13px;font-weight:700;color:var(--text)">'+_escHtml(top.title)+scoreChip+'</div>','<div class="hd-bucket__reason-line" style="font-size:11px;color:var(--text-dim);margin-top:2px">'+rs+'</div>',tl,mh,'<button class="hd-bucket__cta hd-bucket__cta--primary" onclick="showPage(\'practice\')">Practice Now →</button>','</div>'].join('');
}

function renderHdBandStatus(bundle) {
    var intel=deriveHdBandIntel(bundle),rows=intel.map(function(l){var vs=l.color?' style="color:'+l.color+'"':'';var ic=l.icon?'<span style="margin-right:4px">'+l.icon+'</span>':'';return '<div class="hd-intel__row"><span class="hd-intel__label">'+ic+l.label+'</span><span class="hd-intel__value"'+vs+'>'+l.value+'</span></div>';}).join('');
    return ['<div class="hd-bucket hd-bucket--status">','<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83D\uDEA8</span><span class="hd-bucket__title">BAND STRATEGY</span></div>',rows?'<div class="hd-intel__rows">'+rows+'</div>':'<div class="hd-bucket__empty">No intel yet \u2014 add readiness scores to get started</div>','<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'rehearsal\')">View Band Status \u2192</button>','</div>'].join('');
}

function renderHdNextRehearsalGoal(bundle) {
    var plan = bundle.plans && bundle.plans[0];
    if (!plan) return '<div class="hd-bucket"><div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFAF</span><span class="hd-bucket__title">NEXT REHEARSAL GOAL</span></div><div class="hd-bucket__empty">No rehearsal scheduled \u2014 plan one to stay sharp</div><button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'rehearsal\')">Plan Rehearsal \u2192</button></div>';
    var today = _todayStr();
    var diff = plan.date ? _dayDiff(today, plan.date) : null;
    var when = diff === 0 ? 'Tonight' : diff === 1 ? 'Tomorrow' : (plan.date ? _formatDateShort(plan.date) : 'Upcoming');
    var songs = (plan.plan && Array.isArray(plan.plan.songs)) ? plan.plan.songs : [];
    var rc = bundle.readinessCache || {};
    var targets = songs.filter(function(t){ var r=rc[t]; return r && _bandAvgForSong(r)<3; }).slice(0,3);
    if (!targets.length) targets = songs.slice(0,3);
    var songRows = targets.map(function(t){
        var avg = rc[t] ? _bandAvgForSong(rc[t]) : null;
        var chip = avg !== null ? '<span style="font-size:10px;color:'+(avg<2?'#ef4444':avg<3?'#f97316':'#fbbf24')+';font-weight:700;margin-left:4px">'+avg.toFixed(1)+'</span>' : '';
        var avgVal = rc[t] ? _bandAvgForSong(rc[t]) : null;
        var barPct = avgVal !== null ? Math.round((avgVal/5)*100) : 0;
        var barColor = avgVal < 2 ? '#ef4444' : avgVal < 3 ? '#f97316' : '#fbbf24';
        var miniBar = avgVal !== null ? '<div class="hd-bucket__mini-bar"><div class="hd-bucket__mini-fill" style="width:'+barPct+'%;background:'+barColor+'"></div></div>' : '';
        return '<div class="hd-bucket__song-row" style="flex-direction:column;align-items:stretch;gap:3px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="hd-bucket__song-title">'+_escHtml(t)+'</span>'+chip+'</div>'+miniBar+'</div>';
    }).join('');
    var more = songs.length > 3 ? '<div class="hd-bucket__more">+' + (songs.length-3) + ' more in plan</div>' : '';
    return ['<div class="hd-bucket">',
        '<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFAF</span><span class="hd-bucket__title">NEXT REHEARSAL GOAL</span></div>',
        '<div style="font-size:12px;color:var(--text);font-weight:700;margin-bottom:4px">'+when+(plan.location?' \xb7 '+_escHtml(plan.location):'')+'</div>',
        songs.length ? '<div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Focus songs:</div>' : '',
        songRows, more,
        '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button>',
        '</div>'].join('');
}

function renderHdSongsNeedingWork(bundle) {
    var rc = bundle.readinessCache || {};
    var weak = Object.entries(rc).filter(function(e){
        var keys = Object.keys(e[1]||{}).filter(function(k){return typeof e[1][k]==='number'&&e[1][k]>0;});
        return keys.length && _bandAvgForSong(e[1]) < 3;
    }).sort(function(a,b){return _bandAvgForSong(a[1])-_bandAvgForSong(b[1]);}).slice(0,4);
    if (!weak.length) return '<div class="hd-bucket hd-bucket--ok" style="grid-column:1/-1"><div class="hd-bucket__header"><span class="hd-bucket__icon">\u2705</span><span class="hd-bucket__title">SONGS NEEDING WORK</span></div><div class="hd-bucket__ok">All songs above readiness threshold \u2014 you\'re in good shape</div></div>';
    var rows = weak.map(function(e){
        var avg = _bandAvgForSong(e[1]);
        var color = avg < 2 ? '#ef4444' : avg < 2.5 ? '#f97316' : '#fbbf24';
        var urgLabel = avg < 2 ? '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--critical">CRITICAL</span>' : avg < 2.5 ? '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--warn">NEEDS WORK</span>' : '';
        return '<div class="hd-bucket__song-row" onclick="homeGoWeakSongs([\''+ e[0].replace(/'/g,"\\'") +'\'])" style="cursor:pointer">'+
            '<span class="hd-bucket__song-title">'+_escHtml(e[0])+' '+urgLabel+'</span>'+
            '<span style="font-size:11px;font-weight:700;color:'+color+'">'+avg.toFixed(1)+'/5</span>'+
            '</div>';
    }).join('');
    var total = Object.entries(rc).filter(function(e){ var k=Object.keys(e[1]||{}).filter(function(k){return typeof e[1][k]==='number'&&e[1][k]>0;}); return k.length&&_bandAvgForSong(e[1])<3; }).length;
    var more = total > 4 ? '<div class="hd-bucket__more">+'+(total-4)+' more below threshold</div>' : '';
    return ['<div class="hd-bucket hd-bucket--weak" style="grid-column:1/-1">',
        '<div class="hd-bucket__header"><span class="hd-bucket__icon">\u26a0\ufe0f</span><span class="hd-bucket__title">SONGS NEEDING WORK</span><span class="hd-bucket__count">'+total+'</span></div>',
        '<div class="hd-bucket__list">'+rows+'</div>',
        more,
        '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="showPage(\'songs\')">View All Songs \u2192</button>',
        '</div>'].join('');
}

// ── Practice Radar (Milestone 5 Phase 3) ─────────────────────────────────────

var _prExpanded = false;

function renderPracticeRadar() {
    if (typeof GLStore === 'undefined' || !GLStore.getPracticeAttention) return '';
    var limit = _prExpanded ? 10 : 5;
    var items = GLStore.getPracticeAttention({ limit: limit });
    if (!items || !items.length) {
        return '<div class="hd-bucket" style="grid-column:1/-1">'
            + '<div class="hd-bucket__header"><span class="hd-bucket__icon">\uD83C\uDFAF</span>'
            + '<span class="hd-bucket__title">PRACTICE RADAR</span></div>'
            + '<div class="hd-bucket__ok">No practice data yet \u2014 add readiness scores to get started</div>'
            + '</div>';
    }

    var rows = items.map(function(item, i) {
        var urgency = _prUrgencyTier(item);
        var safeTitle = item.songId.replace(/'/g, "\\'");
        var confLabel = item.confidence !== 'rated'
            ? '<span style="font-size:0.65em;color:var(--text-dim,#475569);margin-left:6px;font-weight:600">'
              + (item.confidence === 'partial' ? 'partial' : 'needs rating') + '</span>'
            : '';
        return '<div class="hd-bucket__song-row" onclick="showPage(\'songs\');setTimeout(function(){GLStore.selectSong(\'' + safeTitle + '\');if(typeof highlightSelectedSongRow===\'function\')highlightSelectedSongRow(\'' + safeTitle + '\');},200)" style="cursor:pointer;padding:6px 0;display:flex;align-items:center;gap:8px">'
            + '<span style="font-size:0.72em;font-weight:800;color:var(--text-dim,#475569);width:18px;text-align:center;flex-shrink:0">' + (i + 1) + '</span>'
            + '<div style="min-width:0;flex:1">'
            + '<div class="hd-bucket__song-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(item.songId) + '</div>'
            + '<div style="font-size:0.7em;color:var(--text-dim,#475569);margin-top:1px">' + _escHtml(item.topReason) + '</div>'
            + '</div>'
            + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
            + urgency.badge
            + confLabel
            + '<span style="font-size:0.78em;font-weight:700;color:' + urgency.color + ';min-width:32px;text-align:right">' + item.score + '</span>'
            + '</div>'
            + '</div>';
    }).join('');

    var expandBtn = '';
    if (!_prExpanded) {
        expandBtn = '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="_prExpanded=true;if(typeof renderHomeDashboard===\'function\')renderHomeDashboard()">View More \u2192</button>';
    } else {
        expandBtn = '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="_prExpanded=false;if(typeof renderHomeDashboard===\'function\')renderHomeDashboard()">Show Less</button>';
    }

    return '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">\uD83C\uDFAF</span>'
        + '<span class="hd-bucket__title">PRACTICE RADAR</span>'
        + '<span class="hd-bucket__count">' + items.length + '</span>'
        + '</div>'
        + '<div class="hd-bucket__list">' + rows + '</div>'
        + expandBtn
        + '</div>';
}

/**
 * Map a Practice Attention item to an urgency tier.
 * @returns {{ label, badge, color }}
 */
function _prUrgencyTier(item) {
    if (item.score >= 20) return {
        label: 'Needs Work',
        badge: '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--critical">NEEDS WORK</span>',
        color: '#ef4444'
    };
    if (item.score >= 12) return {
        label: 'Attention',
        badge: '<span class="hd-bucket__urgency-badge hd-bucket__urgency-badge--warn">ATTENTION</span>',
        color: '#f59e0b'
    };
    return {
        label: 'Keep Warm',
        badge: '',
        color: '#22c55e'
    };
}

// ── Rehearsal Agenda (Milestone 6 Phase 1) ───────────────────────────────────

function renderRehearsalAgenda() {
    if (typeof GLStore === 'undefined' || !GLStore.generateRehearsalAgenda) return '';
    var agenda = GLStore.generateRehearsalAgenda();
    if (!agenda) return '';

    if (agenda.empty) {
        return '<div class="hd-bucket" style="grid-column:1/-1">'
            + '<div class="hd-bucket__header"><span class="hd-bucket__icon">📋</span>'
            + '<span class="hd-bucket__title">SUGGESTED REHEARSAL AGENDA</span></div>'
            + '<div class="hd-bucket__ok">' + _escHtml(agenda.emptyReason) + '</div>'
            + '</div>';
    }

    var typeColors = {
        warmup:  '#22c55e',
        repair:  '#f59e0b',
        learn:   '#818cf8',
        closer:  '#60a5fa',
    };
    var typeIcons = {
        warmup:  '🔥',
        repair:  '🔧',
        learn:   '📖',
        closer:  '🎯',
    };

    // Check for active session to show resume
    var activeSession = (typeof GLStore !== 'undefined' && GLStore.getActiveRehearsalAgendaSession)
        ? GLStore.getActiveRehearsalAgendaSession() : null;
    var hasActiveSession = activeSession && activeSession.status === 'active';

    var rows = agenda.items.map(function(item, idx) {
        var color = typeColors[item.type] || '#94a3b8';
        var icon = typeIcons[item.type] || '🎵';
        var safeTitle = item.songId.replace(/'/g, "\\'");
        var meta = item.metadata;
        var readinessChip = meta.avgReadiness > 0
            ? '<span style="font-size:0.68em;font-weight:700;color:' + color + '">' + meta.avgReadiness + '/5</span>'
            : '<span style="font-size:0.68em;color:var(--text-dim,#475569)">unrated</span>';

        return '<div onclick="if(typeof GLStore!==\'undefined\')GLStore.startRehearsalAgendaAtIndex(' + idx + ')" style="cursor:pointer;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.05)">'
            + '<div style="display:flex;align-items:center;gap:8px">'
            + '<div style="width:36px;height:36px;border-radius:8px;background:' + color + '15;border:1px solid ' + color + '33;display:flex;align-items:center;justify-content:center;font-size:1em;flex-shrink:0">' + icon + '</div>'
            + '<div style="flex:1;min-width:0">'
            + '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">'
            + '<span style="font-weight:700;font-size:0.88em;color:var(--text,#f1f5f9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(item.title) + '</span>'
            + '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">'
            + readinessChip
            + '<span style="font-size:0.65em;font-weight:700;color:' + color + ';background:' + color + '18;padding:1px 6px;border-radius:4px;text-transform:uppercase">' + item.minutes + 'min</span>'
            + '</div></div>'
            + '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin-top:1px">' + _escHtml(item.reason) + '</div>'
            + '<div style="font-size:0.68em;color:var(--text-muted,#64748b);margin-top:1px">Focus: ' + _escHtml(item.focus) + '</div>'
            + '</div></div></div>';
    }).join('');

    return '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">📋</span>'
        + '<span class="hd-bucket__title">SUGGESTED REHEARSAL AGENDA</span>'
        + '<span style="font-size:0.72em;font-weight:700;color:var(--text-dim,#475569)">' + agenda.totalMinutes + ' min</span>'
        + '</div>'
        + (agenda.summary ? '<div style="font-size:0.78em;color:var(--text-muted,#94a3b8);margin-bottom:8px;padding:0 2px">' + _escHtml(agenda.summary) + '</div>' : '')
        + '<div>' + rows + '</div>'
        + (agenda.isSameAsPrevious ? '<div style="font-size:0.72em;color:var(--text-dim,#475569);margin:8px 0 2px;text-align:center">Best agenda for current data — no stronger alternates available.</div>' : '')
        + (hasActiveSession
            ? '<div style="background:rgba(102,126,234,0.08);border:1px solid rgba(102,126,234,0.25);border-radius:10px;padding:8px 12px;margin:8px 0;display:flex;align-items:center;justify-content:space-between">'
              + '<span style="font-size:0.78em;color:#818cf8;font-weight:700">Session in progress — slot ' + (activeSession.currentIndex + 1) + ' of ' + activeSession.items.length + '</span>'
              + '<button onclick="if(typeof GLStore!==\'undefined\')GLStore.startRehearsalAgendaAtIndex(' + activeSession.currentIndex + ')" style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;border-radius:8px;padding:5px 12px;font-size:0.75em;font-weight:700;cursor:pointer">Resume</button>'
              + '</div>'
            : '')
        + '<div style="display:flex;gap:8px;margin-top:10px">'
        + '<button onclick="if(typeof GLStore!==\'undefined\')GLStore.startRehearsalAgendaSession()" style="flex:1;padding:10px 16px;border-radius:10px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;border:none;font-weight:800;font-size:0.88em;cursor:pointer;box-shadow:0 2px 12px rgba(102,126,234,0.3)">🎸 Start Rehearsal</button>'
        + '<button class="hd-bucket__cta hd-bucket__cta--ghost" onclick="if(typeof GLStore!==\'undefined\'){GLStore.regenerateRehearsalAgenda();if(typeof renderHomeDashboard===\'function\')renderHomeDashboard();}">🔄</button>'
        + '</div>'
        + '</div>';
}

// ── Last Rehearsal Card (Milestone 6 Phase 4B) ───────────────────────────────

function renderLastRehearsal() {
    if (typeof GLStore === 'undefined' || !GLStore.getRehearsalScorecardData) return '';
    var data = GLStore.getRehearsalScorecardData();
    if (!data) return '';
    var s = data.latest;
    var t = data.trend;

    // Friendly recency
    var recency = '';
    if (s.completedAt) {
        var ms = Date.now() - new Date(s.completedAt).getTime();
        var mins = Math.round(ms / 60000);
        if (mins < 2) recency = 'Just now';
        else if (mins < 60) recency = mins + ' min ago';
        else if (mins < 1440) recency = Math.round(mins / 60) + 'h ago';
        else recency = Math.round(mins / 1440) + 'd ago';
    }

    var scoreColor = s.score >= 80 ? '#22c55e' : s.score >= 50 ? '#f59e0b' : '#ef4444';

    var h = '<div class="hd-bucket" style="grid-column:1/-1">'
        + '<div class="hd-bucket__header">'
        + '<span class="hd-bucket__icon">🏁</span>'
        + '<span class="hd-bucket__title">REHEARSAL SCORECARD</span>'
        + (recency ? '<span style="font-size:0.68em;font-weight:600;color:var(--text-dim,#475569)">' + recency + '</span>' : '')
        + '</div>';

    // Score + latest stats
    h += '<div style="display:flex;align-items:center;gap:16px;padding:4px 0">'
        + '<div style="text-align:center;min-width:50px">'
        + '<div style="font-size:1.8em;font-weight:900;color:' + scoreColor + '">' + s.score + '</div>'
        + '<div style="font-size:0.58em;font-weight:700;color:var(--text-dim,#475569);text-transform:uppercase;letter-spacing:0.08em">Score</div>'
        + '</div>'
        + '<div style="flex:1;display:flex;gap:6px;flex-wrap:wrap">'
        + '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(34,197,94,0.12);color:#86efac">'
        + s.completedCount + ' done · ' + s.completedMinutes + 'min</span>'
        + (s.skippedCount > 0 ? '<span style="font-size:0.7em;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(251,191,36,0.12);color:#fbbf24">'
        + s.skippedCount + ' skipped</span>' : '')
        + '<span style="font-size:0.7em;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.04);color:var(--text-dim,#475569)">'
        + s.completionRate + '%</span>'
        + (s.durationElapsedMinutes > 0 ? '<span style="font-size:0.7em;font-weight:600;padding:3px 8px;border-radius:6px;background:rgba(255,255,255,0.04);color:var(--text-dim,#475569)">'
        + s.durationElapsedMinutes + 'min</span>' : '')
        + '</div></div>';

    // Song lists (compact)
    if (s.completedSongs && s.completedSongs.length) {
        h += '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">';
        h += '<div style="display:flex;flex-wrap:wrap;gap:4px">';
        for (var c = 0; c < s.completedSongs.length; c++) {
            h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(34,197,94,0.1);color:#86efac">✓ ' + _escHtml(s.completedSongs[c].title) + '</span>';
        }
        for (var sk = 0; sk < (s.skippedSongs || []).length; sk++) {
            h += '<span style="font-size:0.68em;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(251,191,36,0.08);color:#fbbf24">– ' + _escHtml(s.skippedSongs[sk].title) + '</span>';
        }
        h += '</div></div>';
    }

    // Trend row (if 2+ sessions in history)
    if (t && t.sessionCount >= 2) {
        var trendColor = t.avgScore >= 80 ? '#22c55e' : t.avgScore >= 50 ? '#f59e0b' : '#ef4444';
        h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;flex-wrap:wrap;align-items:center">';
        h += '<span style="font-size:0.62em;font-weight:800;letter-spacing:0.1em;color:rgba(255,255,255,0.3);text-transform:uppercase">Last ' + t.sessionCount + '</span>';
        h += '<span style="font-size:0.7em;font-weight:700;padding:2px 8px;border-radius:6px;background:' + trendColor + '15;color:' + trendColor + '">Avg ' + t.avgScore + '</span>';
        h += '<span style="font-size:0.7em;font-weight:600;color:var(--text-dim,#475569)">' + t.avgCompletionRate + '% avg completion</span>';
        h += '<span style="font-size:0.7em;font-weight:600;color:var(--text-dim,#475569)">' + t.totalCompletedMinutes + 'min total</span>';
        h += '<span style="font-size:0.7em;font-weight:600;color:var(--text-dim,#475569)">' + t.totalSongsCompleted + ' songs</span>';
        h += '</div>';
    }

    h += '</div>';
    return h;
}

// ── Context Banner ────────────────────────────────────────────────────────────

function _renderContextBanner(bannerType, bannerData, isStoner) {
    var gig  = bannerData && bannerData.gig;
    var plan = bannerData && bannerData.plan;

    var venueName    = gig ? _escHtml(gig.venue || 'Tonight\'s Show') : '';
    var linkedSetlist = gig ? (gig.linkedSetlist || null) : null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    if (bannerType === 'rehearsal_today') {
        var loc = plan && plan.location ? ' \xb7 \uD83D\uDCCD ' + _escHtml(plan.location) : '';
        var time = plan && plan.time ? ' at ' + _escHtml(plan.time) : '';
        var planSongs = plan && plan.plan && Array.isArray(plan.plan.songs) ? plan.plan.songs.length : 0;
        var songsLine = planSongs ? planSongs + ' song' + (planSongs > 1 ? 's' : '') + ' planned' : 'No songs planned yet';
        return [
            '<div class="home-banner home-banner--rehearse">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">\uD83C\uDFB8</span>',
            '    <div class="home-banner__text">',
            '      <strong>Rehearsal Tonight' + time + '</strong>' + loc,
            '      <div class="home-banner__sub">' + songsLine + '</div>',
            '    </div>',
            '    <button class="home-banner__cta home-banner__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    if (!gig) return '';

    venueName    = _escHtml(gig.venue || 'Tonight\'s Show');
    linkedSetlist = gig.linkedSetlist || null;
    linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    if (bannerType === 'gig_today') {
        var doorsLine = gig.doorsTime ? ' \xb7 Doors ' + _escHtml(gig.doorsTime) : '';
        if (isStoner) {
            return [
                '<div class="home-banner home-banner--gig">',
                '  <div class="home-banner__body">',
                '    <span class="home-banner__icon">\uD83C\uDFA4</span>',
                '    <div class="home-banner__text">',
                '      <strong>' + venueName + '</strong>' + doorsLine,
                '    </div>',
                '    <button class="home-banner__cta home-banner__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Go Live \u2192</button>',
                '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
                '  </div>',
                '</div>'
            ].join('');
        }
        var readinessSummary = _computeSetlistReadiness(gig, bundle_readinessRef());
        var readinessLine = readinessSummary
            ? '  <div class="home-banner__sub">' + readinessSummary + '</div>'
            : '';
        return [
            '<div class="home-banner home-banner--gig">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">\uD83C\uDFA4</span>',
            '    <div class="home-banner__text">',
            '      <strong>Tonight: ' + venueName + '</strong>' + doorsLine,
            readinessLine,
            '    </div>',
            '    <div class="home-banner__actions">',
            '      <button class="home-banner__cta home-banner__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Go Live \u2192</button>',
            linkedSetlist ? '      <button class="home-banner__cta home-banner__cta--secondary" onclick="homeViewSetlist(\'' + linkedSetlistEsc + '\')">Setlist</button>' : '',
            '    </div>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    if (bannerType === 'gig_soon') {
        var diff = _dayDiff(_todayStr(), gig.date || '');
        var daysText = diff === 1 ? 'Tomorrow' : 'In ' + diff + ' days';
        var friendlyDate = gig.date ? _formatDateShort(gig.date) : '';
        return [
            '<div class="home-banner home-banner--soon">',
            '  <div class="home-banner__body">',
            '    <span class="home-banner__icon">\uD83D\uDCC5</span>',
            '    <div class="home-banner__text">',
            '      <strong>' + daysText + ': ' + venueName + '</strong>',
            '      <div class="home-banner__sub">' + friendlyDate + ' \xb7 Get ready</div>',
            '    </div>',
            '    <button class="home-banner__cta home-banner__cta--secondary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">Prep \u2192</button>',
            '    <button class="home-banner__dismiss" onclick="homeDismissBanner()" title="Dismiss">\u2715</button>',
            '  </div>',
            '</div>'
        ].join('');
    }

    return '';
}

// ── Card grid ─────────────────────────────────────────────────────────────────

function _renderCardGrid(cardOrder, bundle, isStoner) {
    var renderers = {
        playShow: _renderPlayShowCard,
        rehearse: _renderRehearseCard,
        practice: _renderPracticeCard,
        setlist:  _renderSetlistCard
    };
    return cardOrder.map(function(key) {
        var fn = renderers[key];
        return fn ? fn(bundle, isStoner) : '';
    }).join('');
}

// ── Play Show Card ────────────────────────────────────────────────────────────

function _renderPlayShowCard(bundle, isStoner) {
    var nextGig = bundle.gigs && bundle.gigs[0];

    if (!nextGig) {
        return _renderCardEmptyState('playShow');
    }

    var venueName      = nextGig.venue || 'Upcoming Show';
    var gigDate        = nextGig.date  || '';
    var linkedSetlist  = nextGig.linkedSetlist || null;
    var linkedSetlistEsc = linkedSetlist ? _escHtml(linkedSetlist) : '';

    var daysUntil  = gigDate ? _dayDiff(_todayStr(), gigDate) : null;
    var isToday    = daysUntil === 0;
    var dateLabel  = _formatDateShort(gigDate);
    var timeLabel  = nextGig.doorsTime ? 'Doors ' + nextGig.doorsTime : '';
    if (nextGig.startTime) timeLabel = (timeLabel ? timeLabel + ' \xb7 ' : '') + 'Set ' + nextGig.startTime;

    if (isStoner) {
        return [
            '<div class="home-card home-card--playshow">',
            '  <div class="home-card__icon">\uD83C\uDFA4</div>',
            '  <div class="home-card__label">Go Live</div>',
            '  <div class="home-card__title">' + _escHtml(venueName) + '</div>',
            '  <div class="home-card__sub">' + (isToday ? 'Tonight' : dateLabel) + (timeLabel ? ' \xb7 ' + _escHtml(timeLabel) : '') + '</div>',
            '  <button class="home-card__cta home-card__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">' + (isToday ? "I\'m Ready \u2192" : "View Show \u2192") + '</button>',
            '</div>'
        ].join('');
    }

    var readinessHTML    = _renderSetlistReadinessBars(nextGig, bundle.readinessCache);
    var warningsHTML     = _renderReadinessWarnings(nextGig, bundle.readinessCache);
    var urgencyClass = isToday ? 'home-card--playshow home-card--urgent' : 'home-card--playshow';

    var ctaGoLive = '<button class="home-card__cta home-card__cta--primary" onclick="homeGoLive(\'' + linkedSetlistEsc + '\')">'
        + (isToday ? '\uD83C\uDFA4 Go Live \u2192' : '\uD83C\uDFA4 Activate Show') + '</button>';

    var ctaSetlist = linkedSetlist
        ? '<button class="home-card__cta home-card__cta--secondary" onclick="homeViewSetlist(\'' + linkedSetlistEsc + '\')">View Setlist</button>'
        : '<button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'gigs\')">Open Gig</button>';

    var ctaCare = '<button class="home-card__cta home-card__cta--ghost" onclick="homeCarePackage()">\uD83D\uDCE6 Care Package</button>';

    return [
        '<div class="home-card ' + urgencyClass + '">',
        '  <div class="home-card__header">',
        '    <span class="home-card__icon">\uD83C\uDFA4</span>',
        '    <span class="home-card__label">Go Live</span>',
        '    ' + (isToday ? '<span class="home-card__badge home-card__badge--live">TONIGHT</span>' : (daysUntil !== null && daysUntil <= 2 ? '<span class="home-card__badge home-card__badge--soon">' + (daysUntil === 1 ? 'TOMORROW' : 'IN ' + daysUntil + ' DAYS') + '</span>' : '')),
        '  </div>',
        '  <div class="home-card__title">' + _escHtml(venueName) + '</div>',
        '  <div class="home-card__sub">' + dateLabel + (timeLabel ? ' \xb7 ' + _escHtml(timeLabel) : '') + '</div>',
        readinessHTML ? ('  <div class="home-card__readiness">' + readinessHTML + '</div>') : '',
        warningsHTML  ? ('  <div class="home-card__warnings">' + warningsHTML + '</div>') : '',
        '  <div class="home-card__actions">',
        '    ' + ctaGoLive,
        '    ' + ctaSetlist,
        '    ' + ctaCare,
        '  </div>',
        '</div>'
    ].join('');
}

// ── Rehearse Card ─────────────────────────────────────────────────────────────

function _scoreRehearseCard(bundle) {
    var plans = bundle.plans || [];
    if (!plans.length) return 0;
    var today = _todayStr();
    var next = plans[0];
    if (next.date === today) return 3;
    var diff = _dayDiff(today, next.date);
    if (diff <= 2) return 2;
    return 1;
}

function _renderRehearseCard(bundle, isStoner) {
    var plans = bundle.plans || [];
    var myKey = bundle.memberKey;

    if (!plans.length) {
        return [
            '<div class="home-card home-card--rehearse home-card--empty">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFBC</span><span class="home-card__label">Rehearse</span></div>',
            '  <div class="home-card__title">No Rehearsals Scheduled</div>',
            '  <div class="home-card__empty-msg">Add a rehearsal to build a practice plan.</div>',
            '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'rehearsal\')">Open Rehearsals</button>',
            '</div>'
        ].join('');
    }

    var next = plans[0];
    var today = _todayStr();
    var isToday = next.date === today;
    var diff = _dayDiff(today, next.date);
    var dateLabel = isToday ? 'Tonight' : diff === 1 ? 'Tomorrow' : _formatDateShort(next.date);

    var planSongs = (next.plan && Array.isArray(next.plan.songs)) ? next.plan.songs : [];
    var time = next.time ? ' at ' + _escHtml(next.time) : '';

    var myRsvp = myKey && next.rsvps && next.rsvps[myKey] ? (next.rsvps[myKey].status || '') : '';
    var rsvpBadge = myRsvp === 'yes'
        ? '<span style="color:var(--green);font-size:0.72em;font-weight:700">\u2705 You\'re in</span>'
        : myRsvp === 'maybe'
        ? '<span style="color:var(--yellow);font-size:0.72em;font-weight:700">\u2753 Maybe</span>'
        : myRsvp === 'no'
        ? '<span style="color:var(--red);font-size:0.72em;font-weight:700">\u274C Out</span>'
        : '<span style="color:var(--text-dim);font-size:0.72em">RSVP needed</span>';

    var songsHtml;
    if (planSongs.length) {
        var preview = planSongs.slice(0, 3);
        songsHtml = '<div class="home-card__list">'
            + preview.map(function(t) {
                return '<div class="home-card__list-item">\uD83C\uDFB5 ' + _escHtml(t) + '</div>';
            }).join('')
            + (planSongs.length > 3 ? '<div class="home-card__list-item" style="color:var(--text-dim)">+' + (planSongs.length - 3) + ' more\u2026</div>' : '')
            + '</div>';
    } else {
        songsHtml = '<div class="home-card__sub" style="color:var(--text-dim)">No songs planned yet</div>';
    }

    return [
        '<div class="home-card home-card--rehearse' + (isToday ? ' home-card--urgent' : '') + '">',
        '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFBC</span><span class="home-card__label">Rehearse</span>' + rsvpBadge + '</div>',
        '  <div class="home-card__title">' + dateLabel + time + '</div>',
        '  <div class="home-card__sub">' + (next.location ? _escHtml(next.location) : 'Location TBD') + '</div>',
        songsHtml,
        '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'rehearsal\')">Open Plan \u2192</button>',
        '</div>'
    ].join('');
}

// ── Practice Card ─────────────────────────────────────────────────────────────

function _scorePracticeCard(bundle) {
    var rc = bundle.readinessCache || {};
    var myKey = bundle.memberKey;
    if (!myKey) return 0;
    var weak = 0;
    Object.values(rc).forEach(function(ratings) {
        var mine = ratings && ratings[myKey];
        if (typeof mine === 'number' && mine > 0 && mine < 3) weak++;
    });
    if (weak >= 5) return 3;
    if (weak >= 2) return 2;
    if (weak >= 1) return 1;
    return 0;
}

function _renderPracticeCard(bundle, isStoner) {
    var rc = bundle.readinessCache || {};
    var myKey = bundle.memberKey;

    if (!myKey) {
        return [
            '<div class="home-card home-card--practice home-card--stub">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFA7</span><span class="home-card__label">Practice</span></div>',
            '  <div class="home-card__title">My Practice Queue</div>',
            '  <div class="home-card__stub-msg">Sign in to see your personal song queue</div>',
            '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'practice\')">Song Library</button>',
            '</div>'
        ].join('');
    }

    var weak = [];
    Object.entries(rc).forEach(function(entry) {
        var title = entry[0];
        var ratings = entry[1] || {};
        var mine = ratings[myKey];
        if (typeof mine === 'number' && mine > 0 && mine < 3) {
            weak.push({ title: title, score: mine });
        }
    });
    weak.sort(function(a, b) { return a.score - b.score; });

    if (!weak.length) {
        return [
            '<div class="home-card home-card--practice">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFA7</span><span class="home-card__label">Practice</span></div>',
            '  <div class="home-card__title">All Caught Up! \uD83D\uDCAA</div>',
            '  <div class="home-card__sub">No songs below your readiness threshold.</div>',
            '  <button class="home-card__cta home-card__cta--secondary" onclick="showPage(\'practice\')">Song Library</button>',
            '</div>'
        ].join('');
    }

    var preview = weak.slice(0, 4);
    var songsHtml = '<div class="home-card__list">'
        + preview.map(function(s) {
            var dot = s.score <= 1 ? '\uD83D\uDD34' : '\uD83D\uDFE1';
            return '<div class="home-card__list-item">' + dot + ' ' + _escHtml(s.title) + '</div>';
        }).join('')
        + (weak.length > 4 ? '<div class="home-card__list-item" style="color:var(--text-dim)">+' + (weak.length - 4) + ' more\u2026</div>' : '')
        + '</div>';

    return [
        '<div class="home-card home-card--practice">',
        '  <div class="home-card__header"><span class="home-card__icon">\uD83C\uDFA7</span><span class="home-card__label">Practice</span></div>',
        '  <div class="home-card__title">' + weak.length + ' Song' + (weak.length > 1 ? 's' : '') + ' Need Work</div>',
        songsHtml,
        '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'practice\')">Go Practice \u2192</button>',
        '</div>'
    ].join('');
}

// ── Setlist Card ──────────────────────────────────────────────────────────────

function _scoreSetlistCard(bundle) {
    var setlists = bundle.setlists || [];
    var gigs = bundle.gigs || [];
    if (!setlists.length) return 0;
    var nextGig = gigs[0];
    if (nextGig && !nextGig.linkedSetlist) return 2;
    if (nextGig && nextGig.linkedSetlist) return 1;
    return 0;
}

function _renderSetlistCard(bundle, isStoner) {
    var setlists = bundle.setlists || [];
    var gigs = bundle.gigs || [];
    var rc = bundle.readinessCache || {};
    var nextGig = gigs[0];

    if (!setlists.length) {
        return [
            '<div class="home-card home-card--setlist home-card--empty">',
            '  <div class="home-card__header"><span class="home-card__icon">\uD83D\uDCCB</span><span class="home-card__label">Setlists</span></div>',
            '  <div class="home-card__title">No Setlists Yet</div>',
            '  <div class="home-card__empty-msg">Build your first setlist for an upcoming show.</div>',
            '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'setlists\')">Create Setlist \u2192</button>',
            '</div>'
        ].join('');
    }

    var featured = null;
    if (nextGig && nextGig.linkedSetlist) {
        featured = setlists.find(function(sl) { return sl.name === nextGig.linkedSetlist; }) || null;
    }
    if (!featured) {
        featured = setlists.slice().sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); })[0];
    }

    var isLinked = nextGig && nextGig.linkedSetlist && featured && featured.name === nextGig.linkedSetlist;
    var totalSongs = featured.songCount || 0;
    var setCount = (featured.sets || []).length;

    var allTitles = [];
    (featured.sets || []).forEach(function(s) {
        (s.songs || []).forEach(function(sg) {
            allTitles.push(typeof sg === 'string' ? sg : (sg.title || ''));
        });
    });
    var readyCount = allTitles.filter(function(t) {
        return _bandAvgForSong(rc[t] || {}) >= 3;
    }).length;
    var readyPct = allTitles.length ? Math.round((readyCount / allTitles.length) * 100) : 0;
    var readyColor = readyPct >= 80 ? 'var(--green)' : readyPct >= 50 ? 'var(--yellow)' : 'var(--red)';

    var subtitle = isLinked
        ? '\uD83C\uDFAF Linked to ' + _escHtml(nextGig.venue || nextGig.date || 'next gig')
        : (featured.date ? '\uD83D\uDCC5 ' + _escHtml(featured.date) + (featured.venue ? ' \xb7 ' + _escHtml(featured.venue) : '') : '');

    var readinessHtml = allTitles.length ? [
        '<div class="home-readiness-row" style="margin:8px 0 10px">',
        '  <span class="home-readiness-row__label">Ready</span>',
        '  <div class="home-readiness-row__bar"><div class="home-readiness-row__fill" style="width:' + readyPct + '%;background:' + readyColor + '"></div></div>',
        '  <span class="home-readiness-row__count" style="color:' + readyColor + '">' + readyCount + '/' + allTitles.length + '</span>',
        '</div>'
    ].join('') : '';

    var statLine = setCount + ' set' + (setCount !== 1 ? 's' : '') + ' \xb7 ' + totalSongs + ' songs';

    return [
        '<div class="home-card home-card--setlist' + (isLinked ? ' home-card--urgent' : '') + '">',
        '  <div class="home-card__header"><span class="home-card__icon">\uD83D\uDCCB</span><span class="home-card__label">Setlists</span></div>',
        '  <div class="home-card__title">' + _escHtml(featured.name) + '</div>',
        '  <div class="home-card__sub">' + subtitle + '</div>',
        '  <div class="home-card__sub" style="color:var(--text-dim);font-size:0.72em">' + statLine + '</div>',
        readinessHtml,
        '  <button class="home-card__cta home-card__cta--primary" onclick="showPage(\'setlists\')">Open Setlists \u2192</button>',
        '</div>'
    ].join('');
}

// ── Readiness computation ─────────────────────────────────────────────────────

function _computeSetlistReadiness(gig, rc) {
    if (!gig || !gig._setlistSongs) return null;
    rc = rc || {};
    var sets = gig._setlistSongs;
    if (!sets || typeof sets !== 'object') return null;
    var parts = [];
    ['set1', 'set2', 'encore'].forEach(function(setKey) {
        var songs = sets[setKey];
        if (!Array.isArray(songs) || !songs.length) return;
        var ready = songs.filter(function(title) {
            return _bandAvgForSong(rc[title] || {}) >= 3;
        }).length;
        var label = setKey === 'encore' ? 'Encore' : 'Set ' + setKey.replace('set', '');
        parts.push(label + ': ' + ready + '/' + songs.length + ' ready');
    });
    return parts.length ? parts.join(' \xb7 ') : null;
}

function _renderSetlistReadinessBars(gig, rc) {
    if (!gig || !gig._setlistSongs) return '';
    rc = rc || {};
    var sets = gig._setlistSongs;
    if (!sets || typeof sets !== 'object') return '';
    var html = '';
    ['set1', 'set2', 'encore'].forEach(function(setKey) {
        var songs = sets[setKey];
        if (!Array.isArray(songs) || !songs.length) return;
        var ready  = songs.filter(function(t) { return _bandAvgForSong(rc[t] || {}) >= 3; }).length;
        var total  = songs.length;
        var pct    = total ? Math.round((ready / total) * 100) : 0;
        var color  = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)';
        var label  = setKey === 'encore' ? 'Encore' : 'Set ' + setKey.replace('set', '');
        html += '<div class="home-readiness-row">'
            + '<span class="home-readiness-row__label">' + label + '</span>'
            + '<div class="home-readiness-row__bar"><div class="home-readiness-row__fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
            + '<span class="home-readiness-row__count" style="color:' + color + '">' + ready + '/' + total + '</span>'
            + '</div>';
    });
    return html;
}

function _renderReadinessWarnings(gig, rc) {
    if (!gig || !gig._setlistSongs) return '';
    rc = rc || {};
    var allSongs = [];
    var sets = gig._setlistSongs;
    if (!sets) return '';
    Object.values(sets).forEach(function(arr) {
        if (Array.isArray(arr)) allSongs = allSongs.concat(arr);
    });
    var warnings = allSongs.filter(function(title) {
        var scores = rc[title] || {};
        var lowCount = Object.values(scores).filter(function(s) { return s > 0 && s < 3; }).length;
        return lowCount >= 2;
    });
    if (!warnings.length) return '';
    return '<div class="home-card__warning-list">\u26a0 Needs work: '
        + warnings.map(function(t) { return _escHtml(t); }).join(', ')
        + '</div>';
}

// ── Empty / error states ──────────────────────────────────────────────────────

function _renderCardEmptyState(cardKey) {
    var configs = {
        playShow: { icon: '\uD83C\uDFA4', label: 'Go Live',   msg: 'No upcoming shows',   cta: 'Add a Gig', action: "showPage('gigs')" },
        rehearse: { icon: '\uD83C\uDFBC', label: 'Rehearse',  msg: 'No rehearsal scheduled', cta: 'Open Rehearsals', action: "showPage('rehearsal')" },
        practice: { icon: '\uD83C\uDFA7', label: 'Practice',  msg: 'Sign in to see your practice queue', cta: 'Open Practice', action: "showPage('practice')" },
        setlist:  { icon: '\uD83D\uDCCB', label: 'Setlists',  msg: 'No setlists yet', cta: 'Create Setlist', action: "showPage('setlists')" }
    };
    var cfg = configs[cardKey] || configs.playShow;
    return [
        '<div class="home-card home-card--' + cardKey + ' home-card--empty">',
        '  <div class="home-card__icon">' + cfg.icon + '</div>',
        '  <div class="home-card__label">' + cfg.label + '</div>',
        '  <div class="home-card__empty-msg">' + cfg.msg + '</div>',
        '  <button class="home-card__cta home-card__cta--secondary" onclick="' + cfg.action + '">' + cfg.cta + '</button>',
        '</div>'
    ].join('');
}

function _renderErrorState() {
    return '<div class="home-dashboard home-dashboard--error">'
        + '<div style="text-align:center;padding:40px;color:var(--text-dim)">'
        + '<div style="font-size:2em;margin-bottom:12px">\u26a0\ufe0f</div>'
        + '<div>Could not load dashboard. Check connection.</div>'
        + '<button class="btn btn-ghost" style="margin-top:16px" onclick="renderHomeDashboard()">Retry</button>'
        + '</div></div>';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function _renderSkeletonHTML() {
    var pulse = 'background:rgba(255,255,255,0.06);border-radius:6px;animation:homeSkeletonPulse 1.4s ease-in-out infinite;';
    var cardSkeleton = [
        '<div class="home-card home-card--skeleton">',
        '  <div style="' + pulse + 'height:20px;width:40%;margin-bottom:12px"></div>',
        '  <div style="' + pulse + 'height:14px;width:65%;margin-bottom:8px"></div>',
        '  <div style="' + pulse + 'height:14px;width:50%;margin-bottom:20px"></div>',
        '  <div style="' + pulse + 'height:36px;width:100%;border-radius:8px"></div>',
        '</div>'
    ].join('');
    return [
        '<style>@keyframes homeSkeletonPulse{0%,100%{opacity:0.4}50%{opacity:0.8}}</style>',
        '<div class="home-dashboard">',
        '<div class="home-card-grid">',
        cardSkeleton, cardSkeleton, cardSkeleton, cardSkeleton,
        '</div>',
        '</div>'
    ].join('');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _todayStr() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}

function _dayDiff(dateStrA, dateStrB) {
    if (!dateStrA || !dateStrB) return null;
    try {
        var a = new Date(dateStrA + 'T12:00:00');
        var b = new Date(dateStrB + 'T12:00:00');
        return Math.round((b - a) / 86400000);
    } catch(e) { return null; }
}

function _formatDateShort(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    } catch(e) { return dateStr; }
}

function _bandAvgForSong(scoreObj) {
    if (!scoreObj || typeof scoreObj !== 'object') return 0;
    var vals = Object.values(scoreObj).filter(function(v) { return typeof v === 'number' && v > 0; });
    if (!vals.length) return 0;
    return vals.reduce(function(sum, v) { return sum + v; }, 0) / vals.length;
}

function _escHtml(str) {
    if (typeof window.escHtml === 'function') return window.escHtml(str);
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function _resolveIsStoner() {
    var key = _getMemberKey();
    if (!key) return true;
    return false;
}

function _getMemberKey() {
    if (typeof window.getCurrentMemberKey === 'function') return window.getCurrentMemberKey();
    if (typeof window.getCurrentMemberReadinessKey === 'function') return window.getCurrentMemberReadinessKey();
    return null;
}

function bundle_readinessRef() {
    return (typeof readinessCache !== 'undefined') ? readinessCache : {};
}

// ── Band Readiness Score ──────────────────────────────────────────────────────

function _computeBandReadinessPct(bundle) {
    var rc = bundle.readinessCache || {};
    var entries = Object.values(rc).filter(function(ratings) {
        return ratings && typeof ratings === 'object' && Object.keys(ratings).length > 0;
    });
    if (!entries.length) return null;
    var ready = entries.filter(function(ratings) {
        return _bandAvgForSong(ratings) >= 3;
    }).length;
    return Math.round((ready / entries.length) * 100);
}

function _renderBandReadinessScore(bundle) {
    var pct = _computeBandReadinessPct(bundle);
    if (pct === null) return '';
    var color = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--yellow)' : 'var(--red)';
    var label = pct >= 80 ? 'Gig ready' : pct >= 55 ? 'Getting there' : 'Needs work';
    var rc = bundle.readinessCache || {};
    var weakTitles = Object.entries(rc)
        .filter(function(e) { return e[1] && _bandAvgForSong(e[1]) < 3; })
        .map(function(e) { return e[0]; });
    var onclickVal = weakTitles.length
        ? 'homeGoWeakSongs(' + JSON.stringify(weakTitles) + ')'
        : "showPage('songs')";
    return [
        '<div class="home-readiness-widget" onclick="' + onclickVal + '" style="cursor:pointer">',
        '  <div class="home-readiness-widget__header">',
        '    <span class="home-readiness-widget__title">Band Readiness</span>',
        '    <span class="home-readiness-widget__pct" style="color:' + color + '">' + pct + '%</span>',
        '  </div>',
        '  <div class="home-readiness-widget__bar">',
        '    <div class="home-readiness-widget__fill" style="width:' + pct + '%;background:' + color + '"></div>',
        '  </div>',
        '  <div class="home-readiness-widget__label" style="color:' + color + '">' + label + '</div>',
        '</div>'
    ].join('');
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

var _activityFeedCache = null;
var _activityFeedTime  = 0;
var _ACTIVITY_TTL      = 120000;

async function _loadActivityFeed() {
    if (_activityFeedCache && (Date.now() - _activityFeedTime < _ACTIVITY_TTL)) {
        return _activityFeedCache;
    }
    try {
        var log = await window.loadMasterFile('_master_activity_log.json') || [];
        var SKIP_ACTIONS = ['join', 'login', 'signin', 'sign_in', 'joined', 'session_start', 'connected'];
        var entries = (Array.isArray(log) ? log : Object.values(log))
            .filter(function(e) {
                if (!e || !e.action || !e.time) return false;
                var a = (e.action || '').toLowerCase();
                return !SKIP_ACTIONS.some(function(s) { return a.indexOf(s) !== -1; });
            })
            .slice(-20)
            .reverse()
            .slice(0, 3);
        _activityFeedCache = entries;
        _activityFeedTime  = Date.now();
        return entries;
    } catch(e) { return []; }
}

var _MEMBER_DISPLAY = {
    'drewmerrill1029@gmail.com': 'Drew',
    'drew': 'Drew', 'chris': 'Chris', 'brian': 'Brian', 'pierce': 'Pierce', 'jay': 'Jay'
};

function _displayName(userOrKey) {
    if (!userOrKey) return 'Someone';
    var direct = _MEMBER_DISPLAY[userOrKey];
    if (direct) return direct;
    var prefix = userOrKey.split('@')[0].toLowerCase();
    for (var k in _MEMBER_DISPLAY) {
        if (prefix.indexOf(k) === 0 || k.indexOf(prefix) === 0) return _MEMBER_DISPLAY[k];
    }
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

var _ACTION_LABELS = {
    readiness_set:    function(e) { return _displayName(e.member || e.user) + ' updated readiness for ' + (e.song || 'a song'); },
    status_change:    function(e) { return _displayName(e.user) + ' marked ' + (e.song||'a song') + ' as ' + (e.details || 'updated'); },
    practice_track:   function(e) { return _displayName(e.user) + ' practiced ' + (e.song || 'a song'); },
    rehearsal_note:   function(e) { return _displayName(e.user) + ' added crib notes to ' + (e.song || 'a song'); },
    harmony_add:      function(e) { return _displayName(e.user) + ' added harmony to ' + (e.song || 'a song'); },
    harmony_edit:     function(e) { return _displayName(e.user) + ' edited harmony on ' + (e.song || 'a song'); },
    part_notes:       function(e) { return _displayName(e.user) + ' added part notes to ' + (e.song || 'a song'); },
    sign_in:          function(e) { return _displayName(e.user) + ' joined the session'; }
};

function _activityLabel(e) {
    var fn = _ACTION_LABELS[e.action];
    if (fn) return fn(e);
    return _displayName(e.user) + ' ' + e.action.replace(/_/g, ' ') + (e.song ? ' \xb7 ' + e.song : '');
}

function _activityTimeAgo(isoStr) {
    if (!isoStr) return '';
    try {
        var diff = Math.floor((Date.now() - new Date(isoStr)) / 60000);
        if (diff < 2)  return 'just now';
        if (diff < 60) return diff + 'm ago';
        var h = Math.floor(diff / 60);
        if (h < 24)    return h + 'h ago';
        return Math.floor(h / 24) + 'd ago';
    } catch(e) { return ''; }
}

function _renderActivityFeed(bundle) {
    setTimeout(function() {
        var el = document.getElementById('home-activity-feed');
        if (!el) return;
        _loadActivityFeed().then(function(entries) {
            if (!entries || !entries.length) {
                el.style.display = 'none';
                return;
            }
            el.innerHTML = [
                '<div class="home-activity__title">Recent Activity</div>',
                entries.map(function(e) {
                    return '<div class="home-activity__item">'
                        + '<span class="home-activity__text">' + _escHtml(_activityLabel(e)) + '</span>'
                        + '<span class="home-activity__time">' + _activityTimeAgo(e.time) + '</span>'
                        + '</div>';
                }).join('')
            ].join('');
        });
    }, 300);

    return '<div id="home-activity-feed" class="home-activity"></div>';
}

// ── Register with navigation system ──────────────────────────────────────────

if (typeof pageRenderers !== 'undefined') {
    pageRenderers.home = function(el) {
        window.renderHomeDashboard();
    };
}

document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        var container = document.getElementById('page-home');
        if (container && typeof currentPage !== 'undefined' && currentPage === 'home') {
            window.refreshHomeDashboard();
        }
    }
});

console.log('\uD83C\uDFE0 home-dashboard.js loaded');
try { if (typeof invalidateHomeCache === 'function') invalidateHomeCache(); } catch(e) {}

// ── Entrance Animation ────────────────────────────────────────────────────────

function _triggerDashboardEntrance() {
    requestAnimationFrame(function() {
        var fill = document.querySelector('.home-readiness-widget__fill');
        if (fill) {
            var target = fill.style.width;
            fill.style.transition = 'none';
            fill.style.width = '0';
            requestAnimationFrame(function() {
                fill.style.transition = 'width 600ms ease-out';
                fill.style.width = target;
            });
        }
        var feed = document.getElementById('home-activity-feed');
        if (feed) {
            setTimeout(function() {
                feed.style.transition = 'opacity 180ms ease-out';
                feed.style.opacity = '1';
            }, 180);
        }
    });
}

// ── CSS ───────────────────────────────────────────────────────────────────────

(function _injectHomeDashboardCSS() {
    var _hdCssId2 = 'home-dashboard-css-' + (typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : 'v3');
    document.querySelectorAll('style[id^="home-dashboard-css"]').forEach(function(el){el.remove();});
    if (document.getElementById(_hdCssId2)) return;
    var style = document.createElement('style');
    style.id = _hdCssId2;
    style.textContent = [
        '@keyframes glFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }',
        '@keyframes glFadeIn { from { opacity: 0; } to { opacity: 1; } }',
        '@keyframes glBarFill { from { width: 0 !important; } to { } }',
        '.home-anim-header { animation: glFadeIn 180ms ease-out both; }',
        '.home-anim-cards  { animation: glFadeUp 180ms ease-out both; }',
        '.home-anim-feed   { animation: glFadeIn 180ms ease-out both; animation-delay: 180ms; }',
        '.home-anim-bar    { animation: glBarFill 600ms ease-out both; }',
        '.home-dashboard { padding: 12px; max-width: 680px; margin: 0 auto; }',
        '.home-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }',
        '@media (max-width: 420px) { .home-card-grid { grid-template-columns: 1fr; } }',
        '.home-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--radius); padding: 14px; display: flex; flex-direction: column; gap: 6px; transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s; }',
        '.home-card:hover { border-color: rgba(255,255,255,0.18); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }',
        '.home-card__header { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }',
        '.home-card__icon { font-size: 1.4em; flex-shrink: 0; }',
        '.home-card__label { font-size: 0.68em; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); flex: 1; }',
        '.home-card__title { font-size: 0.98em; font-weight: 800; color: var(--text); line-height: 1.2; }',
        '.home-card__sub   { font-size: 0.76em; color: var(--text-muted); }',
        '.home-card__badge { font-size: 0.6em; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; }',
        '.home-card__badge--live { background: rgba(239,68,68,0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.35); }',
        '.home-card__badge--soon { background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.35); }',
        '.home-card--urgent { border-color: rgba(102,126,234,0.4); background: linear-gradient(160deg, var(--bg-card) 60%, rgba(102,126,234,0.06)); }',
        '.home-readiness-row { display: flex; align-items: center; gap: 8px; margin: 2px 0; }',
        '.home-readiness-row__label { font-size: 0.7em; color: var(--text-dim); min-width: 36px; }',
        '.home-readiness-row__bar { flex: 1; height: 5px; background: rgba(255,255,255,0.07); border-radius: 3px; overflow: hidden; }',
        '.home-readiness-row__fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }',
        '.home-readiness-row__count { font-size: 0.7em; font-weight: 700; min-width: 28px; text-align: right; }',
        '.home-card__warning-list { font-size: 0.72em; color: var(--yellow); border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px; margin-top: 2px; }',
        '.home-card__actions { display: flex; flex-direction: column; gap: 5px; margin-top: 6px; }',
        '.home-card__cta { width: 100%; padding: 9px 12px; border-radius: 8px; font-size: 0.82em; font-weight: 700; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; text-align: center; }',
        '.home-card__cta--primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; box-shadow: 0 2px 12px rgba(102,126,234,0.35); }',
        '.home-card__cta--primary:hover { opacity: 0.9; }',
        '.home-card__cta--secondary { background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border); }',
        '.home-card__cta--secondary:hover { background: rgba(255,255,255,0.1); color: var(--text); }',
        '.home-card__cta--ghost { background: transparent; color: var(--text-dim); border: 1px solid rgba(255,255,255,0.05); font-size: 0.75em; }',
        '.home-card__cta--ghost:hover { background: rgba(255,255,255,0.04); color: var(--text-muted); }',
        '.home-readiness-widget { margin-bottom: 24px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; }',
        '.home-readiness-widget__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }',
        '.home-readiness-widget__title { font-size: 0.78em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }',
        '.home-readiness-widget__pct { font-size: 1.1em; font-weight: 800; }',
        '.home-readiness-widget__bar { height: 10px; background: rgba(255,255,255,0.07); border-radius: 5px; overflow: hidden; margin-bottom: 4px; }',
        '.home-readiness-widget__fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }',
        '.home-readiness-widget__label { font-size: 0.72em; color: var(--text-dim); }',
        '.home-activity { margin-top: 12px; padding: 10px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; min-height: 0; }',
        '.home-activity:empty { display: none; }',
        '.home-activity__title { font-size: 0.72em; font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }',
        '.home-activity__item { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }',
        '.home-activity__item:last-child { border-bottom: none; }',
        '.home-activity__text { font-size: 0.8em; color: var(--text-muted); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.home-activity__time { font-size: 0.7em; color: var(--text-dim); flex-shrink: 0; }',
        '.home-card--stub { opacity: 0.75; }',
        '.home-card--stub .home-card__icon { font-size: 1.1em; }',
        '.home-card__stub-msg { font-size: 0.72em; color: var(--text-dim); padding: 4px 0 8px 0; }',
        '.home-card--empty { border-style: dashed; }',
        '.home-card__empty-msg { font-size: 0.78em; color: var(--text-dim); padding: 8px 0; }',
        '.home-banner { border-radius: var(--radius); padding: 12px 14px; margin-bottom: 12px; position: relative; }',
        '.home-banner--gig  { background: linear-gradient(135deg, rgba(102,126,234,0.18), rgba(118,75,162,0.12)); border: 1px solid rgba(102,126,234,0.3); }',
        '.home-banner--soon { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25); }',
        '.home-banner--rehearse { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.25); }',
        '.home-card__list { margin: 6px 0 10px 0; display: flex; flex-direction: column; gap: 3px; }',
        '.home-card__list-item { font-size: 0.78em; color: var(--text-muted); padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
        '.home-banner__body { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
        '.home-banner__icon { font-size: 1.3em; flex-shrink: 0; }',
        '.home-banner__text { flex: 1; min-width: 0; font-size: 0.88em; color: var(--text); }',
        '.home-banner__text strong { display: block; font-weight: 800; margin-bottom: 2px; }',
        '.home-banner__sub { font-size: 0.78em; color: var(--text-muted); }',
        '.home-banner__actions { display: flex; gap: 6px; flex-shrink: 0; }',
        '.home-banner__cta { padding: 8px 14px; border-radius: 8px; font-size: 0.8em; font-weight: 700; cursor: pointer; border: none; font-family: inherit; white-space: nowrap; }',
        '.home-banner__cta--primary { background: linear-gradient(135deg, #667eea, #764ba2); color: white; }',
        '.home-banner__cta--secondary { background: rgba(255,255,255,0.08); color: var(--text-muted); border: 1px solid var(--border); }',
        '.home-banner__dismiss { position: absolute; top: 8px; right: 8px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 0.75em; padding: 4px; line-height: 1; }',
        '.home-banner__dismiss:hover { color: var(--text-muted); }',
        '.home-weak { margin: 0 0 16px; padding: 12px 14px; background: var(--bg-card); border: 1px solid rgba(239,68,68,0.2); border-radius: 12px; }',
        '.home-weak__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }',
        '.home-weak__title-label { font-size: 0.78em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }',
        '.home-weak__count { font-size: 0.72em; color: var(--text-dim); }',
        '.home-weak__list { display: flex; flex-direction: column; gap: 1px; margin-bottom: 10px; }',
        '.home-weak__row { display: flex; align-items: center; gap: 8px; padding: 7px 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }',
        '.home-weak__row:hover { background: rgba(255,255,255,0.05); }',
        '.home-weak__dot { font-size: 0.75em; flex-shrink: 0; }',
        '.home-weak__title { flex: 1; font-size: 0.85em; font-weight: 600; color: var(--text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.home-weak__meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }',
        '.home-weak__age { font-size: 0.7em; color: var(--text-dim); }',
        '.home-weak__more { display: block; font-size: 0.72em; color: var(--text-dim); text-align: center; margin: -4px 0 8px; }',
        '.home-weak__cta { width: 100%; padding: 8px 12px; border-radius: 8px; font-size: 0.82em; font-weight: 700; cursor: pointer; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #fca5a5; font-family: inherit; transition: all 0.15s; text-align: center; }',
        '.home-weak__cta:hover { background: rgba(239,68,68,0.15); color: #fecaca; }',
        '.home-weak__gig-badge { display: inline-block; font-size: 0.6em; font-weight: 700; color: #a78bfa; background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.3); border-radius: 4px; padding: 0 5px; margin-left: 5px; vertical-align: middle; line-height: 1.6; }',
    ].join('\n');
    document.head.appendChild(style);
}());

// ── Weak Songs ────────────────────────────────────────────────────────────────

var _weakSongsCache    = null;
var _weakSongsTime     = 0;
var _WEAK_SONGS_TTL    = 120000;
var _RECENCY_DAYS      = 21;
var _READINESS_THRESH  = 3;
var _WEAK_DISPLAY      = 3;

function _weakScore(bandAvg, daysSinceActivity, inGig) {
    var readinessGap = Math.max(0, _READINESS_THRESH - bandAvg) * 2;
    var recencyPenalty = 0;
    if (daysSinceActivity === null) {
        recencyPenalty = 3;
    } else if (daysSinceActivity > _RECENCY_DAYS) {
        recencyPenalty = Math.min(3, Math.floor(daysSinceActivity / 7));
    }
    var gigBoost = inGig ? 2 : 0;
    return readinessGap + recencyPenalty + gigBoost;
}

function _buildRecencyMap(activityLog) {
    var PRACTICE_ACTIONS = {
        practice_track: true, readiness_set: true,
        rehearsal_note: true, harmony_add: true,
        harmony_edit: true,   harmony_recording: true,
        song_structure: true, part_notes: true
    };
    var lastSeen = {};
    var now = Date.now();
    (Array.isArray(activityLog) ? activityLog : []).forEach(function(e) {
        if (!e || !e.song || !e.time || !PRACTICE_ACTIONS[e.action]) return;
        var t = new Date(e.time).getTime();
        if (!isNaN(t) && (!lastSeen[e.song] || t > lastSeen[e.song])) {
            lastSeen[e.song] = t;
        }
    });
    var result = {};
    Object.keys(lastSeen).forEach(function(title) {
        result[title] = Math.floor((now - lastSeen[title]) / 86400000);
    });
    return result;
}

function _computeWeakSongs(readinessCache, recencyMap, limit, gigTitles) {
    var rc = readinessCache || {};
    var gigSet = gigTitles || new Set();
    var candidates = [];

    Object.entries(rc).forEach(function(entry) {
        var title   = entry[0];
        var ratings = entry[1] || {};
        var keys    = Object.keys(ratings).filter(function(k) { return typeof ratings[k] === 'number' && ratings[k] > 0; });
        if (!keys.length) return;

        var bandAvg = keys.reduce(function(sum, k) { return sum + ratings[k]; }, 0) / keys.length;
        if (bandAvg >= _READINESS_THRESH) return;

        var daysSince = (recencyMap && recencyMap[title] !== undefined) ? recencyMap[title] : null;
        var inGig     = gigSet.has(title);
        var score     = _weakScore(bandAvg, daysSince, inGig);
        candidates.push({ title: title, bandAvg: bandAvg, daysSince: daysSince, score: score, inGig: inGig, raterCount: keys.length });
    });

    candidates.sort(function(a, b) { return b.score - a.score; });
    return candidates.slice(0, limit || _WEAK_DISPLAY);
}

window.homeGoWeakSongs = function homeGoWeakSongs(titles) {
    if (!titles || !titles.length) { showPage('songs'); return; }
    showPage('songs');
    setTimeout(function() {
        var searchEl = document.getElementById('songSearch');
        if (!searchEl) return;
        if (titles.length === 1) {
            searchEl.value = titles[0];
            if (typeof renderSongs === 'function') renderSongs(
                (typeof currentFilter !== 'undefined' ? currentFilter : 'all'), titles[0]
            );
            setTimeout(function() {
                if (typeof selectSong === 'function') selectSong(titles[0]);
            }, 150);
        } else {
            searchEl.value = '';
            if (typeof renderSongs === 'function') renderSongs('all', '');
            searchEl.focus();
            showToast('\uD83D\uDCCB ' + titles.length + ' weak songs \u2014 check readiness chains on each');
        }
    }, 200);
};

async function _fillWeakSongs(bundle) {
    var el = document.getElementById('home-weak-songs');
    if (!el) return;

    var activityLog = [];
    try {
        if (_weakSongsCache && (Date.now() - _weakSongsTime < _WEAK_SONGS_TTL)) {
            activityLog = _weakSongsCache;
        } else {
            activityLog = await window.loadMasterFile('_master_activity_log.json') || [];
            _weakSongsCache = activityLog;
            _weakSongsTime  = Date.now();
        }
    } catch(e) { activityLog = []; }

    var recencyMap = _buildRecencyMap(activityLog);

    var gigTitles = new Set();
    try {
        var upcomingGigs = bundle.gigs || [];
        if (upcomingGigs.length) {
            var nextGig = upcomingGigs[0];
            var setlistName = nextGig.linkedSetlist || nextGig.setlist || '';
            if (setlistName && typeof window.loadBandDataFromDrive === 'function') {
                if (!window._homeSetlistCache) {
                    window._homeSetlistCache = await window.loadBandDataFromDrive('_band', 'setlists').catch(function(){ return []; });
                }
                var allSetlists = window._homeSetlistCache || [];
                var sl = (Array.isArray(allSetlists) ? allSetlists : Object.values(allSetlists))
                    .find(function(s) { return s && (s.name === setlistName || s.title === setlistName); });
                if (sl) {
                    var sets = sl.sets || sl.songs || [];
                    (Array.isArray(sets) ? sets : Object.values(sets)).forEach(function(set) {
                        var songs = Array.isArray(set) ? set : (set.songs || []);
                        songs.forEach(function(song) {
                            var t = typeof song === 'string' ? song : (song.title || song.song || '');
                            if (t) gigTitles.add(t);
                        });
                    });
                }
            }
        }
    } catch(e) {}

    var weak = _computeWeakSongs(bundle.readinessCache, recencyMap, _WEAK_DISPLAY, gigTitles);

    if (!weak.length) return;

    var titles    = weak.map(function(s) { return s.title; });
    var titlesEsc = JSON.stringify(titles).replace(/'/g, "\\'");
    var hasGigSongs = weak.some(function(s) { return s.inGig; });

    var rows = weak.map(function(s) {
        var avg    = s.bandAvg.toFixed(1);
        var color  = s.bandAvg < 2.0 ? 'var(--red,#ef4444)' : 'var(--yellow,#f59e0b)';
        var dot    = s.bandAvg < 2.0 ? '\uD83D\uDD34' : '\uD83D\uDFE1';
        var age    = s.daysSince === null ? 'Never practiced'
                   : s.daysSince === 0   ? 'Today'
                   : s.daysSince === 1   ? 'Yesterday'
                   : s.daysSince + 'd ago';
        return '<div class="home-weak__row" onclick="homeGoWeakSongs([\'' + s.title.replace(/'/g, "\\'") + '\'])" title="Practice this song">'
            + '<span class="home-weak__dot">' + dot + '</span>'
            + '<span class="home-weak__title">' + _escHtml(s.title) + (s.inGig ? '<span class="home-weak__gig-badge">\uD83C\uDFA4 Next Gig</span>' : '') + '</span>'
            + '<span class="home-weak__meta">'
            +   '<span style="color:' + color + ';font-weight:700">' + avg + '/5</span>'
            +   '<span class="home-weak__age">' + age + '</span>'
            + '</span>'
            + '</div>';
    }).join('');

    var totalWeak = Object.entries(bundle.readinessCache || {}).filter(function(entry) {
        var ratings = entry[1] || {};
        var keys    = Object.keys(ratings).filter(function(k) { return typeof ratings[k] === 'number' && ratings[k] > 0; });
        if (!keys.length) return false;
        var avg     = keys.reduce(function(sum, k) { return sum + ratings[k]; }, 0) / keys.length;
        return avg < _READINESS_THRESH;
    }).length;

    var moreLabel = totalWeak > _WEAK_DISPLAY
        ? '<span class="home-weak__more">+' + (totalWeak - _WEAK_DISPLAY) + ' more below threshold</span>'
        : '';

    el.innerHTML = [
        '<div class="home-weak home-anim-feed">',
        '  <div class="home-weak__header">',
        '    <span class="home-weak__title-label">' + (hasGigSongs ? '\uD83C\uDFA4 Needs Work Before Next Gig' : '\u26a0\ufe0f Needs Work') + '</span>',
        '    <span class="home-weak__count">' + totalWeak + ' below readiness threshold</span>',
        '  </div>',
        '  <div class="home-weak__list">' + rows + '</div>',
        moreLabel,
        '  <button class="home-weak__cta" onclick="homeGoWeakSongs(' + titlesEsc + ')">Practice \u2192</button>',
        '</div>'
    ].join('');
}

function _scheduleWeakSongsFill(bundle) {
    setTimeout(function() { _fillWeakSongs(bundle); }, 220);
}

// ── Mission Board CSS ─────────────────────────────────────────────────────────
(function() {
  var _hdCssId = 'hd-mission-css-' + (typeof BUILD_VERSION !== 'undefined' ? BUILD_VERSION : 'v4');
  document.querySelectorAll('style[id^="hd-mission-css"]').forEach(function(el){el.remove();});
  if (document.getElementById(_hdCssId)) return;
  var s = document.createElement('style');
  s.id = _hdCssId;
  s.textContent = [
    '.hd-mission-board{display:flex;flex-direction:column;gap:20px;padding:12px 0 32px}',
    '.hd-strip{display:flex;flex-wrap:wrap;gap:6px;padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);margin-bottom:2px}',
    '.hd-strip__chip{font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap}',
    '.hd-strip__chip--gig{background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.25)}',
    '.hd-strip__chip--rehearse{background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.25)}',
    '.hd-strip__chip--ready{background:rgba(74,222,128,0.1);color:var(--green);border:1px solid rgba(74,222,128,0.2)}',
    '.hd-strip__chip--weak{background:rgba(251,191,36,0.1);color:var(--yellow);border:1px solid rgba(251,191,36,0.2)}',
    '.hd-strip__chip--ok{background:rgba(74,222,128,0.08);color:var(--green);border:1px solid rgba(74,222,128,0.15)}',
    '.hd-hero{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%);border-radius:16px;padding:20px 18px 16px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 4px 24px rgba(0,0,0,0.4);position:relative;overflow:hidden;margin-bottom:4px}',
    '.hd-hero--gig{background:linear-gradient(135deg,#1b2a4a 0%,#141e35 60%,#0e1628 100%);border-color:rgba(102,126,234,0.25)}',
    '.hd-hero--rehearse{background:linear-gradient(135deg,#0f1a2e 0%,#1a2744 60%,#0a1628 100%);border-color:rgba(99,102,241,0.2)}',
    '.hd-hero--urgent{border-color:rgba(239,68,68,0.4)!important;box-shadow:0 4px 32px rgba(239,68,68,0.15)}',
    '.hd-hero--soon{border-color:rgba(251,191,36,0.3)!important}',
    '.hd-hero--empty{background:rgba(255,255,255,0.02);border-style:dashed}',
    '.hd-hero__eyebrow{font-size:10px;font-weight:800;letter-spacing:0.14em;color:var(--text-dim);text-transform:uppercase;margin-bottom:6px;display:flex;align-items:center;gap:8px}',
    '.hd-hero__badge{font-size:9px;font-weight:800;letter-spacing:0.1em;padding:2px 7px;border-radius:4px;text-transform:uppercase}',
    '.hd-hero__badge--live{background:#ef4444;color:#fff}',
    '.hd-hero__badge--soon{background:rgba(251,191,36,0.2);color:var(--yellow);border:1px solid rgba(251,191,36,0.4)}',
    '.hd-hero__badge--rehearse{background:rgba(99,102,241,0.2);color:#a5b4fc;border:1px solid rgba(99,102,241,0.4)}',
    '.hd-hero__title{font-size:1.35em;font-weight:800;color:var(--text);line-height:1.2;margin-bottom:4px}',
    '.hd-hero__title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}',
    '.hd-hero__ready-badge{font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;border:1px solid}',
    '.hd-hero__sub{font-size:0.78em;color:var(--text-dim);margin-bottom:6px}',
    '.hd-hero__setlist{font-size:0.75em;color:var(--text-dim);margin-bottom:8px}',
    '.hd-hero__countdown{font-size:0.75em;color:var(--text-dim);margin-bottom:6px}',
    '.hd-hero__coach{font-size:12px;color:var(--text-dim);font-style:italic;margin:4px 0 2px;border-left:2px solid rgba(255,255,255,0.1);padding-left:8px}',
    '.hd-hero__pct-row{display:flex;align-items:center;gap:8px;margin:10px 0 4px}',
    '.hd-hero__pct-label{font-size:10px;color:var(--text-dim);white-space:nowrap}',
    '.hd-hero__pct-track{width:100%;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden}',
    '.hd-hero__pct-fill{height:100%;border-radius:3px;transition:width 0.6s ease}',
    '.hd-hero__pct-val{font-size:11px;font-weight:700;white-space:nowrap}',
    '.hd-hero__risk{font-size:12px;color:var(--text-dim);margin-bottom:4px}',
    '.hd-hero__risk strong{color:var(--yellow)}',
    '.hd-hero__days-away{font-size:0.85em;font-weight:700;color:var(--yellow);background:rgba(251,191,36,0.12);border-radius:4px;padding:1px 6px;margin-left:2px}',
    '.hd-hero__risk-avg{font-size:10px;font-weight:800;margin-left:6px;background:rgba(239,68,68,0.15);padding:1px 5px;border-radius:3px}',
    '.hd-hero__readiness{margin:8px 0 4px}',
    '.hd-hero__warnings{margin-bottom:8px}',
    '.hd-hero__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}',
    '.hd-hero__cta{padding:9px 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;transition:all 0.15s;touch-action:manipulation}',
    '.hd-hero__cta--primary{background:linear-gradient(135deg,#6d28d9,#4f46e5);color:#fff;box-shadow:0 2px 12px rgba(99,102,241,0.35)}',
    '.hd-hero__cta--primary:hover{filter:brightness(1.1)}',
    '.hd-hero__cta--golive{background:linear-gradient(135deg,#dc2626,#b91c1c)!important;box-shadow:0 2px 12px rgba(239,68,68,0.4)!important}',
    '.hd-hero__cta--secondary{background:rgba(255,255,255,0.06);color:var(--text-dim);border:1px solid rgba(255,255,255,0.12)}',
    '.hd-hero__cta--secondary:hover{background:rgba(255,255,255,0.1);color:var(--text)}',
    '.hd-hero__cta--tertiary{background:rgba(255,255,255,0.04);color:var(--text-dim);border:1px solid rgba(255,255,255,0.08);font-size:12px}',
    '.hd-buckets{display:grid;grid-template-columns:1fr 1fr;gap:20px}',
    '@media(max-width:480px){.hd-buckets{grid-template-columns:1fr}}',
    '.hd-bucket{background:rgba(255,255,255,0.03);border-radius:14px;padding:14px 14px 12px;border:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column;gap:8px}',
    '.hd-bucket--weak{border-color:rgba(239,68,68,0.3)!important;box-shadow:0 4px 20px rgba(239,68,68,0.08),inset 0 0 14px rgba(255,80,80,0.08)!important}',
    '.hd-bucket--ok{border-color:rgba(74,222,128,0.2)!important}',
    '.hd-bucket__header{display:flex;align-items:center;gap:6px;margin-bottom:2px}',
    '.hd-bucket__icon{font-size:14px}',
    '@keyframes hdGlowPulse{0%{text-shadow:0 0 10px currentColor,0 0 20px rgba(34,197,94,0.2)}50%{text-shadow:0 0 18px currentColor,0 0 35px rgba(34,197,94,0.5)}100%{text-shadow:0 0 10px currentColor,0 0 20px rgba(34,197,94,0.2)}}',
    '.hd-score-pulse{animation:hdGlowPulse 3s ease-in-out infinite}',
    '.hd-bucket__title{font-size:10px;font-weight:800;letter-spacing:0.13em;color:var(--text-dim);text-transform:uppercase;flex:1}',
    '.hd-bucket__count{font-size:10px;font-weight:700;color:var(--yellow);background:rgba(251,191,36,0.12);padding:2px 7px;border-radius:20px}',
    '.hd-bucket__empty{font-size:12px;color:var(--text-dim);font-style:italic}',
    '.hd-bucket__ok{font-size:12px;color:var(--green)}',
    '.hd-bucket__more{font-size:11px;color:var(--text-dim);margin-top:3px}',
    '.hd-bucket__song-row{display:flex;align-items:baseline;gap:6px;font-size:12px;color:var(--text);padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)}',
    '.hd-bucket__song-row:last-child{border-bottom:none}',
    '.hd-bucket__song-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.hd-bucket__list{display:flex;flex-direction:column;gap:2px;margin:4px 0 8px}',
    '.hd-bucket__cta{padding:8px 12px;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;border:none;transition:all 0.15s;touch-action:manipulation;margin-top:auto}',
    '.hd-bucket__cta--primary{background:linear-gradient(135deg,#15803d,#166534);color:#4ade80;border:1px solid rgba(74,222,128,0.35);box-shadow:0 2px 16px rgba(74,222,128,0.35),0 0 0 1px rgba(74,222,128,0.1)}',
    '.hd-bucket__cta--primary:hover{filter:brightness(1.15)}',
    '.hd-bucket__cta--ghost{background:transparent;color:var(--text-dim);border:1px solid rgba(255,255,255,0.1)}',
    '.hd-bucket__cta--ghost:hover{background:rgba(255,255,255,0.05);color:var(--text)}',
    '.hd-intel__row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.04)}',
    '.hd-intel__row:last-child{border-bottom:none}',
    '.hd-intel__label{color:var(--text-dim);flex-shrink:0}',
    '.hd-intel__value{color:var(--text);text-align:right;font-weight:600;min-width:0;font-size:11px}',
    '.hd-activity-demoted{opacity:0.75}',
    /* Pct bar enhancements — stacked: number, bar, label */
    '.hd-hero__pct-row{display:flex;flex-direction:column;gap:0;margin:12px 0 8px;width:100%}',
    '.hd-hero__pct-track{width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;margin-bottom:5px}',
    '.hd-hero__pct-fill{height:100%;border-radius:4px;transition:width 0.6s ease}',
    '.hd-hero__pct-val{font-size:32px;font-weight:900;line-height:1;margin-bottom:6px;letter-spacing:-0.02em}',
    '.hd-hero__pct-state{font-size:11px;font-weight:700}',
    /* Risk pill */
    '.hd-hero__risk-pill{display:inline-flex;align-items:center;gap:6px;background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.3);border-radius:20px;padding:4px 10px;margin:4px 0 8px}',
    '.hd-hero__risk-song{font-size:12px;font-weight:700;color:#f97316}',
    '.hd-hero__risk-label{font-size:9px;font-weight:800;letter-spacing:0.1em;color:rgba(249,115,22,0.7);text-transform:uppercase}',
    /* Urgency badges */
    '.hd-bucket__urgency-badge{font-size:9px;font-weight:800;letter-spacing:0.06em;padding:1px 5px;border-radius:3px;vertical-align:middle;margin-left:4px}',
    '.hd-bucket__urgency-badge--critical{background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.3)}',
    '.hd-bucket__urgency-badge--warn{background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.25)}',
    /* Mini readiness bar in rehearsal goal */
    '.hd-bucket__mini-bar{height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden}',
    '.hd-bucket__mini-fill{height:100%;border-radius:2px}',
    /* Reduced border opacity + deeper shadow on buckets */
    '.hd-bucket{background:rgba(255,255,255,0.025);border-radius:14px;padding:14px 14px 12px;border:1px solid rgba(255,255,255,0.05);display:flex;flex-direction:column;gap:8px;box-shadow:0 4px 16px rgba(0,0,0,0.2)}',
    /* Hero padding increase */
    '.hd-hero{background:linear-gradient(145deg,#0d0d1a 0%,#12172e 40%,#0c1f3f 100%);border-radius:16px;padding:24px 20px 18px;border:1px solid rgba(255,255,255,0.09);box-shadow:0 8px 40px rgba(0,0,0,0.65);position:relative;overflow:hidden;margin-bottom:4px}',
    '.hd-hero__title{font-size:1.55em;font-weight:800;color:var(--text);line-height:1.15;margin-bottom:4px}',
    /* Intel row spacing */
    '.hd-intel__row{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;gap:6px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06)}',
    '.hd-intel__rows{display:flex;flex-direction:column}',
    '.hd-mission-board .home-readiness-widget{display:none!important}',
    '.hd-mission-board .home-banner{display:none!important}'
  ].join('');
  document.head.appendChild(s);
})();
