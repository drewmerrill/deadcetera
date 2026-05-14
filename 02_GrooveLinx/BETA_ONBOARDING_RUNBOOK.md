# GrooveLinx — First Founding-Member Onboarding Runbook

_Created: 2026-05-14 (build `20260514-142926`) — operational runbook for Beta Ops Task #01._

Step-by-step procedure for onboarding **one** real founding-member tester into GrooveLinx Mode-B Phase 1. Designed to be run once, observed, and then iterated on before scaling to more testers.

**This is a runbook, not code.** Every step assumes the codebase as of build `20260514-142926` (Beta Operations Enablement). Do not deviate from the steps without updating this doc.

---

## Section 1 — Pre-Provision Checklist

Before you write anything to Firebase, confirm every line below. Skip none.

### 1.1 Tester selection criteria

Pick a tester who matches all of:
- [ ] Is in **another band** (not Deadcetera) — the whole point of Mode-B is testing onboarding for non-test bands
- [ ] Will actually use the app for a real rehearsal or gig within ~2 weeks (otherwise the feedback is hypothetical)
- [ ] Has a Google account they're willing to sign in with
- [ ] Can text/email you within 24 hours if something breaks
- [ ] Isn't already on any GrooveLinx band roster

**Suggested first picks:** Pierce's bandmate, Chris, or a known musician Drew has met IRL. Avoid strangers from the internet for run #1.

### 1.2 Confirm tester contact details

Capture these in a private note before provisioning:

| Field | Example | Notes |
|---|---|---|
| Name | "Chris Smith" | First + Last; used for `members.{memberKey}.name` |
| Email | `chris@example.com` | The Google account they'll sign in with. **Case insensitive but always store lowercase.** |
| Role | "bass" / "vocal-gtr" / "drums" / "keys" | Free-text but use Deadcetera roster convention from `user_band_members.md` memory |
| Band name (human-readable) | "Smith Brothers Trio" | Used for `meta.name` |
| Band slug | `smithbros` | Lowercase, alphanumeric, hyphen-only, ≤40 chars, **must be unique** across Firebase |
| Primary device | "iPhone 15 / Safari PWA" | Drives the test script in Section 4 |
| Time zone | "US/Eastern" | Affects calendar + gig date displays |

### 1.3 Duplicate-band membership check (CRITICAL)

Per `project_duplicate_band_onboarding_bug` memory, the auth gate's `Object.keys(all).forEach` is non-deterministic when a user belongs to two bands. **Always run this check first.**

Console snippet (pbcopy-friendly, single line):

```
firebaseDB.ref('bands').once('value').then(s=>{const all=s.val()||{};const email='REPLACE@EMAIL.com'.toLowerCase();const hits=Object.keys(all).filter(k=>Object.values((all[k].meta&&all[k].meta.members)||{}).some(m=>m&&m.email&&m.email.toLowerCase()===email));console.log('Bands matching',email,':',hits);});
```

**Expected output:** `Bands matching chris@example.com : []` (empty array). If anything else, **STOP** — the tester is already on a roster. Either route them to that band or remove the existing entry first.

### 1.4 Slug-uniqueness check

```
firebaseDB.ref('bands/REPLACE-SLUG/meta').once('value').then(s=>console.log('Slug exists?',!!s.val(),s.val()));
```

**Expected output:** `Slug exists? false null`. If it returns true, the slug is taken — pick a different one (e.g., add a hyphen-suffix like `smithbros-2`).

### 1.5 Device + browser confirmation

Ask the tester:
- "Are you on iPhone, Android, or desktop?"
- "What browser? Safari, Chrome, Firefox?"
- "Will you install it as a PWA (Add to Home Screen) or use it in-browser?"

Note these — they drive which paths to focus the test script on (see §4) and where to expect known iOS-specific behaviors (Spotify Connect mandatory on iOS, AudioContext suspension on tab freeze, etc.).

---

## Section 2 — Firebase Provisioning Steps

All snippets below are run from the **Drew-as-admin DevTools console** on `app.groovelinx.com` while signed in as `drewmerrill@comcast.net`. The Cloud Function `mirrorMemberToIndex` (`functions/index.js`) auto-maintains `members_index/{sanitized-email}` from `bands/{slug}/meta/members` writes, so you only need to write the `members` map — the index updates within ~3 seconds.

### 2.1 Choose paths

You'll write to exactly **one** band node:

```
bands/{slug}/meta = {
  name:        "Smith Brothers Trio",
  createdAt:   <ISO timestamp>,
  createdBy:   "drewmerrill@comcast.net",
  members: {
    {memberKey}: { name, email, role }
  }
}
```

Where:
- `{slug}` — from §1.2 row "Band slug"
- `{memberKey}` — sanitized email (lowercase + replace `.#$[]/` with `_`)

### 2.2 Compute memberKey

Console snippet (pbcopy-friendly):

```
console.log('memberKey:',(typeof sanitizeFirebasePath==='function'?sanitizeFirebasePath('REPLACE@EMAIL.com'.toLowerCase()):'REPLACE@EMAIL.com'.toLowerCase().replace(/[.#$[\]\/]/g,'_')));
```

**Example output:** `memberKey: chris@example_com` (note the `.com` → `_com`).

### 2.3 Write band meta + member

Use this exact shape. Single-shot write means atomicity:

```
firebaseDB.ref('bands/REPLACE-SLUG/meta').set({name:'REPLACE-BAND-NAME',createdAt:new Date().toISOString(),createdBy:'drewmerrill@comcast.net',members:{'REPLACE-MEMBERKEY':{name:'REPLACE-NAME',email:'REPLACE@EMAIL.com',role:'REPLACE-ROLE'}}}).then(()=>console.log('✓ band created')).catch(e=>console.error('✗',e));
```

**Expected output:** `✓ band created`. If you see `PERMISSION_DENIED`, you're either not signed in as Drew or Firebase rules are misconfigured.

### 2.4 Verify members_index propagated

Wait ~5 seconds, then:

```
firebaseDB.ref('members_index/REPLACE-MEMBERKEY').once('value').then(s=>console.log('members_index →',s.val()));
```

**Expected output:** `members_index → REPLACE-SLUG`. If null after 10 seconds, the Cloud Function isn't running — check `functions/index.js` deployment with `firebase functions:log --only mirrorMemberToIndex`.

### 2.5 Sanity-check the full pre-tester state

Before pinging the tester, run this combined check:

```
(async()=>{const slug='REPLACE-SLUG';const email='REPLACE@EMAIL.com';const meta=(await firebaseDB.ref('bands/'+slug+'/meta').once('value')).val();const key=Object.keys((meta&&meta.members)||{}).find(k=>(meta.members[k].email||'').toLowerCase()===email.toLowerCase());const idx=key?(await firebaseDB.ref('members_index/'+key).once('value')).val():null;console.log({slug,meta:!!meta,memberKey:key,index:idx,indexMatches:idx===slug});})();
```

**Expected output:**
```
{slug: 'smithbros', meta: true, memberKey: 'chris@example_com', index: 'smithbros', indexMatches: true}
```

If `indexMatches: false`, **STOP** and investigate before letting the tester in.

---

## Section 3 — Tester Instructions

Send these to the tester via text or email. Keep it short.

### 3.1 The exact message to send

```
Hey [name] — GrooveLinx is ready for you to try.

1. Open in Safari/Chrome:  https://app.groovelinx.com

2. Sign in with Google using:  [their email]
   (must be that exact account — the app gates by email)

3. After you're in, open the browser developer console (Safari: Cmd+Opt+C
   on Mac / iPhone needs Web Inspector; Chrome: F12 or Cmd+Opt+J) and paste:

   localStorage.setItem('gl_beta_feedback','1'); location.reload();

   That enables the floating feedback button (chat-bubble icon, bottom-right).

4. Use the app for ~15 minutes. Try:
   - Open Songs and pick one
   - Open its chord chart
   - Hit Play if there's a Spotify/YouTube link
   - Click the chat-bubble icon to send me feedback

5. Text me anything weird — screenshots welcome.

If you see "Welcome to GrooveLinx — you're not on a band roster", that
means I messed up the email; reply with the address you signed in with
and I'll fix it.
```

### 3.2 Optional power-user instructions (only if tester is technical)

Add these if the tester is comfortable with DevTools:

- **Runtime Health Overlay** — press `Cmd+Shift+H` (or `Ctrl+Shift+H` on Windows) at any time to see app state. Click the 📋 button to copy the full snapshot to clipboard.
- **Dev mode** — append `?dev=true` to the URL to force-enable the overlay and other dev tooling.

### 3.3 iOS Safari PWA add-to-home-screen note

If the tester wants the iPhone home-screen icon experience:
> "After step 2 above, tap the Share button in Safari → Add to Home Screen → Add. Then open from the home screen icon, not Safari."

iOS PWA tabs freeze aggressively when backgrounded — that's expected. Stab #09 (visibilitychange + pageshow resume hooks) handles version-update detection on resume. Audio resumes via Stab #11 Q.8's pageshow.persisted handler.

---

## Section 4 — First-Session Test Script

Keep the first session short and obvious. The goal is "did the user get from sign-in to a working core flow without confusion or failure?" — not a comprehensive QA pass.

### 4.1 Sign-in path
- [ ] Loads `app.groovelinx.com` — no white screen, no infinite spinner
- [ ] Google sign-in button appears
- [ ] Tap → Google account picker → pick the right account
- [ ] Returns to app, lands on **Home** (not the "Welcome to GrooveLinx — not on a roster" overlay)

### 4.2 Home page sanity
- [ ] Top of Home shows tester's band name (not "deadcetera")
- [ ] No JavaScript errors in console
- [ ] Either song-readiness widgets render, or empty-state messaging is calm (NOT a broken-render artifact)

### 4.3 Songs flow
- [ ] Tap **Songs** in nav → list loads within ~1s on good wifi
- [ ] If band has no songs yet, empty state should say something musician-friendly (not "Loading..." forever)
- [ ] If songs exist (Drew can pre-seed 2-3 demo songs via the admin tools), tap one → Song Detail opens

### 4.4 Song Detail / Chart
- [ ] Song Detail renders without errors
- [ ] Chord chart visible (if chart exists for the song)
- [ ] Lens switcher works (Band / Play Mode / Stems / Harmony / North Star)
- [ ] Open **North Star** lens — should not show literal `'Loading...'` (Stab #08 fixed this class)

### 4.5 Playback (only if a song has a Spotify/YouTube link)
- [ ] Tap ▶ Play
- [ ] On iOS: Spotify Connect picker should appear if Spotify
- [ ] Audio plays
- [ ] Tap Pause → stops immediately
- [ ] Skip to next song → first tap yields sound (Stab #11 Q.8 iOS bfcache fix)

### 4.6 Submit beta feedback
- [ ] Floating chat-bubble icon visible bottom-right
- [ ] Tap → modal opens
- [ ] Pick a category (start with "Suggestion" — low stakes)
- [ ] Type 1-2 sentences of free-text
- [ ] Leave "Attach runtime snapshot" checked
- [ ] Tap **Send**
- [ ] Toast: "Thanks — feedback sent to Drew"

### 4.7 Mobile-only checks (if iPhone)
- [ ] PWA add-to-home-screen works (Share → Add to Home Screen)
- [ ] After backgrounding for 60+ seconds and returning, no white screen
- [ ] Update banner doesn't flash during rehearsal-mode (Stab #09)

---

## Section 5 — Drew Observer Checklist

While the tester is in their session, observe from your own browser/console.

### 5.1 Real-time observation snippets

**Open the admin feedback inbox** (or use this snippet to pull the latest 5 reports for the tester's band):

```
firebaseDB.ref('bands/REPLACE-SLUG/feedback_reports').orderByChild('createdAt').limitToLast(5).once('value').then(s=>console.table(Object.values(s.val()||{}).map(r=>({when:r.createdAt,type:r.type,title:r.title,summary:(r.summary||'').slice(0,60)}))));
```

**Check the tester's onboarding counters** (their device, only readable from their console, but you can ask them to run this):

```
console.table(window._glGetOnboardingStats());
```

### 5.2 Runtime Health snapshot to collect

Have the tester run this in their console and paste the result back to you:

```
const s=window.GLRuntimeHealth&&window.GLRuntimeHealth.snapshot&&window.GLRuntimeHealth.snapshot();console.log(JSON.stringify(s||{available:false},null,2));
```

Look for in the response:
- `core.build` matches `20260514-142926`
- `routeLifecycle.cleanupFailures === 0`
- `playback.failed === 0`
- `spotify.hasToken === true` (if they tried playback)
- `onboarding.gateAllowed > 0` and `gateBlocked === 0`
- `warnings[]` is empty or has only known-acceptable entries

### 5.3 Verify beta feedback record landed

After tester submits feedback, you should see:
1. New entry in `bands/REPLACE-SLUG/feedback_reports/{reportId}`
2. Title starts with `[suggestion]` or other category tag
3. If they checked "Attach runtime snapshot", there's a `betaSnapshot` sub-node
4. Tester's `feedbackSubmitted` counter incremented

### 5.4 Console errors to note

Tester's console may show:
- **`background-redux-new.js OperationError`** — MetaMask extension noise. Ignore (extension ID `hdokiejnpimakedhajhdlcegeplioahd`).
- **`firebaseio.com/.lp` warnings** — Suppressed by the long-poll filter (SYSTEM LOCK §7c). Ignore.
- **`[Update] client=... server=... → current`** — Normal version-check log. Ignore.

If you see anything ELSE in red, copy it into BETA_FEEDBACK_QUEUE.md under "Inbound" with the tester's device + timestamp.

### 5.5 What to put into Ops Review

After the session ends, write a 4-line summary in your notes (NOT the runbook):
1. **What worked** — list of flows that completed successfully
2. **What confused** — list of moments where the tester paused/asked
3. **What broke** — list of any console errors, blank states, or "this doesn't work" moments
4. **Next-action** — what's the highest-leverage fix from this run, OR is the system ready for tester #2?

Drop the summary into BETA_FEEDBACK_QUEUE.md under "First Tester Run".

---

## Section 6 — Success Criteria

The onboarding is **successful** if all of these hold:

| Criterion | How to verify |
|---|---|
| User signs in and lands on the correct band | Home shows tester's band name, not Deadcetera |
| No wrong-band routing | `_glGetOnboardingStats().gateAllowed === 1`, `gateBlocked === 0` |
| Beta feedback submission persists | Firebase record exists in `bands/{slug}/feedback_reports` |
| Toast "Thanks — feedback sent to Drew" appeared | Confirmed via screenshot or tester verbal confirmation |
| No obvious loading failures | No "Loading…" UI stuck >30s anywhere |
| Basic song/chart flow works | Tester opened a Song Detail and saw a chord chart (if one existed) |
| No JavaScript errors in red beyond known-noise | Console review per §5.4 |
| Runtime Health overlay shows zero warnings | `snapshot.warnings.length === 0` |

The onboarding is **partially successful** if 1-2 criteria fail but the tester wasn't blocked. Log the failures in BETA_FEEDBACK_QUEUE.md, decide §8 path C.

The onboarding **failed** if 3+ criteria fail OR the tester couldn't sign in OR they hit a hard-block error. Run rollback (§7), regroup, fix root cause before retrying.

---

## Section 7 — Rollback / Rescue Plan

### 7.1 Remove tester from members_index (Cloud Function will mirror)

```
firebaseDB.ref('bands/REPLACE-SLUG/meta/members/REPLACE-MEMBERKEY').remove().then(()=>console.log('✓ removed from members')).catch(e=>console.error('✗',e));
```

`members_index/{memberKey}` will auto-clear via Cloud Function within ~3 seconds.

### 7.2 Remove the entire band

If you want to wipe the slug entirely (e.g., wrong name, wrong tester, fresh start):

```
firebaseDB.ref('bands/REPLACE-SLUG').remove().then(()=>console.log('✓ band removed')).catch(e=>console.error('✗',e));
```

**WARNING:** This is destructive. Any songs, setlists, rehearsals the tester created during the session are gone. Only do this if (a) they made no real data yet, OR (b) you have explicit consent.

### 7.3 Clear tester localStorage (have THEM run this)

If the tester ends up routed to the wrong band (e.g., they had a stale localStorage entry from a previous attempt):

```
localStorage.clear();location.reload();
```

Or surgically, preserving non-band state:

```
['deadcetera_current_band','gl_beta_feedback','gl_onboarding_stats'].forEach(k=>localStorage.removeItem(k));location.reload();
```

### 7.4 Recover if routed to wrong band

Most common cause: the tester was already on Deadcetera's roster from a prior test, so the gate routed them there. Diagnostic:

```
firebaseDB.ref('bands').once('value').then(s=>{const all=s.val()||{};const email='REPLACE@EMAIL.com'.toLowerCase();const hits=Object.keys(all).filter(k=>Object.values((all[k].meta&&all[k].meta.members)||{}).some(m=>m&&m.email&&m.email.toLowerCase()===email));console.log('Tester is on bands:',hits);});
```

If `hits.length > 1`, you have a duplicate-band situation. Remove from the wrong one(s) via §7.1, then have the tester clear localStorage and reload (§7.3).

### 7.5 If everything's broken

Worst case: nothing the tester sees works. Have them:
1. Sign out (top-right profile menu)
2. Run `localStorage.clear(); sessionStorage.clear(); location.reload();`
3. Sign back in

Then check your end:
1. `firebaseDB.ref('bands').once('value').then(s=>console.log(Object.keys(s.val()||{})))` — is their slug present?
2. `firebaseDB.ref('members_index/REPLACE-MEMBERKEY').once('value').then(s=>console.log(s.val()))` — is the index correct?

If the slug exists + index points to it correctly and they STILL can't get in, the issue is in code, not config. Roll back the tester to "not provisioned" via §7.1, file a P0 in BETA_FEEDBACK_QUEUE.md, retry with a different tester after fix.

---

## Section 8 — Next Decision Gate

After the first session ends, decide one of three paths:

### Path A — Manually onboard 2-3 more testers
**Choose if:** session went smoothly, ≥80% of success criteria hit, tester is willing to keep using, feedback was substantive.
**Action:** repeat §1–§7 for the next tester. Keep manual provisioning — don't build Phase 2 yet.

### Path B — Build Mode-B Phase 2 invite redemption
**Choose if:** session went well AND you can see Drew's manual-mailto bottleneck blocking the next 5+ onboardings (e.g., testers want to self-serve at 3am their time).
**Action:** spec a Cloudflare Worker `POST /beta-invite-redeem` endpoint with Firebase admin SDK credentials. ~150 LOC client + ~80 LOC worker. Defer to a new prompt.

### Path C — Fix first-session friction before more users
**Choose if:** session had any HIGH-impact friction — confusion that blocked the flow, missing-data that looked broken, mobile-specific failure, etc.
**Action:** triage in BETA_FEEDBACK_QUEUE.md, ship a targeted Stab fix, then re-run §1–§7 with the SAME tester (if willing) before bringing in tester #2.

**Default recommendation:** A unless something failed. Reactive learning beats proactive overbuild.

---

## Doc cross-references

- **Auth gate evolution:** `project_auth_gate_mode.md` memory
- **Duplicate-band bug:** `project_duplicate_band_onboarding_bug.md` memory
- **Roster format convention:** `user_band_members.md` memory
- **Console snippet protocol:** `feedback_console_snippets.md` memory (every snippet via pbcopy)
- **Stable flows reference:** `02_GrooveLinx/KNOWN_STABLE_FLOWS.md`
- **Feedback queue:** `02_GrooveLinx/BETA_FEEDBACK_QUEUE.md`
- **Resolved bugs:** `02_GrooveLinx/notes/uat_bug_log.md`
- **Open bugs:** `02_GrooveLinx/uat/bug_queue.md`

---

## Runbook version log

- **2026-05-14 (build `20260514-142926`)** — initial draft. Mode-B Phase 1 active. Manual provisioning only.
