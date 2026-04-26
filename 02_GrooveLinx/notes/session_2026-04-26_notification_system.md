# Session 2026-04-26 — 3-Layer Notification System (Push Layer 2 Complete)

**Branch:** `main`
**Final build:** `20260426-234233`
**Final commit:** `b9428875` fix(push): unique tag per testSelf call

---

## Outcome

Notification system **Layer 2 (browser/OS push) is now fully working** on both Mac Chrome and iPhone Safari (PWA). Layer 1 (in-app banner) was already shipped at the start of session. Layer 3 (Twilio SMS) is gated on 10DLC carrier approval (~3 days from registration on 2026-04-26).

Plus: Firebase service account key was rotated and the leaked one deleted.

---

## The 3-Layer Notification Architecture

### Layer 1 — In-App Banner
- Renders on the home dashboard top strip when a feed event lands
- Already working at start of session
- File: `js/features/home-dashboard.js` (banner) + `js/features/band-feed.js` (trigger)

### Layer 2 — Browser / OS Push (Firebase Cloud Messaging)
- Wakes the user via OS-level notification banner even when GrooveLinx isn't open
- **Sender side (Cloudflare Worker):** `worker.js` `/push/send` endpoint
  - Auth flow: service account JWT (RS256) → OAuth2 token → FCM v1 `/messages:send`
  - Required worker secrets: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`
  - Pacing: 200ms between sends to stay well under FCM rate limits
  - Auto-cleanup: 404/UNREGISTERED/INVALID_ARGUMENT responses surface as `invalidTokens[]`; `gl-push.js` removes those from Firebase
  - **Payload shape (data-only, no `notification` field — see "FCM Payload Quirk" below):**
    ```js
    message: {
      token,
      data: { title, body, click_action, tag, ...customData },
      webpush: { headers: { TTL: '3600', Urgency: 'high' } }
    }
    ```
- **Client side:**
  - `js/core/gl-push.js` — `window.GLPush = { init, subscribe, unsubscribe, isSubscribed, getPermissionState, notifyBand, testSelf }`
  - VAPID public key: `BMv8-U7CVUO_soFYGaCmCuPoFAZuKrOg0ceI_6uCVpbN926SBygxbR7o2GJJmTPt9Bhflp4cPHq1HSJNppeFK0s`
  - Storage path: `bands/{slug}/push_subscriptions/{memberKey}/{tokenHash}` with shape `{ token, memberKey, ua, createdAt, lastSeenAt }`
  - `firebase-messaging-sw.js` (root path, required by FCM) — uses **raw `self.addEventListener('push', ...)`** instead of Firebase SDK's `onBackgroundMessage` (more reliable, see "SDK Quirk" below)
  - Foreground listener inside the page handles `onMessage` for in-app toast when tab is focused
- **Trigger points:** `js/features/band-feed.js` calls `GLPush.notifyBand({...})` after each feed item creation (poll, idea, note, link, photo)

### Layer 3 — Twilio SMS (Pending 10DLC Approval)
- Twilio account: A2P 10DLC registered as Sole Proprietor brand "Andrew Merrill"
- Phone number: **+14085398813** (registered, awaiting carrier vetting)
- Privacy + T&C pages live at `https://groovelinx.com/privacy.html` + `/terms.html` (Twilio-compliant: HELP/STOP, message rates, frequency)
- Worker integration not yet wired — will mirror the FCM flow with Twilio Messages API

---

## The Five FCM/Push Quirks Discovered (Hard-Won)

### 1. Top-level `notification` field skips your custom handler

When the FCM v1 message body has BOTH a top-level `notification: { title, body }` AND a custom service worker, Chrome's push pipeline auto-handles display itself, **silently bypassing your `onBackgroundMessage` or `push` listener**. The notification then either renders with system defaults or fails silently if any field (icon, etc.) is bad.

**Fix:** Use a **data-only** FCM payload. Move title/body into `data.title` / `data.body`. Read them from `data` in your SW handler. Do NOT include top-level `notification` or `webpush.notification` fields if you want your handler to be the display path.

**Symptom we saw:** `chrome://gcm-internals` "Receive Message Log" showed the 897-byte data message reaching Chrome, but no banner ever rendered.

### 2. Firebase SDK's `onBackgroundMessage` was unreliable on Mac Chrome

Even with a clean data-only payload, `messaging.onBackgroundMessage(handler)` failed to fire reliably from `firebase-messaging-compat.js` 10.12.0. The SDK looks for a specific FCM payload shape and may silently no-op if it doesn't recognize the structure.

**Fix:** Replace with raw `self.addEventListener('push', event => { ... })`. Parse `event.data.json()` ourselves — FCM v1 wraps the user payload at `payload.data`. Call `self.registration.showNotification()` directly. Keep `firebase.messaging()` initialization in the SW so `getToken()` in the page still works, but don't rely on `onBackgroundMessage` for display.

### 3. `navigator.serviceWorker.ready` resolves on the WRONG registration

When two service workers are registered at different scopes (`/` for the main app SW, `/firebase-cloud-messaging-push-scope` for FCM), `navigator.serviceWorker.ready` resolves immediately with whichever SW controls the current page (the main app one). Your freshly-registered FCM SW may still be in `installing` state when `messaging.getToken({serviceWorkerRegistration})` calls `pushManager.subscribe()` on it — and that throws `AbortError: Subscription failed - no active Service Worker`.

**Fix:** Wait specifically for YOUR registration to reach `'activated'` state via `statechange` listener, not the global `serviceWorker.ready`:
```js
const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {scope: '/firebase-cloud-messaging-push-scope'});
if (!swReg.active) {
  const sw = swReg.installing || swReg.waiting;
  if (sw) {
    await new Promise(resolve => {
      if (sw.state === 'activated') return resolve();
      sw.addEventListener('statechange', () => { if (sw.state === 'activated') resolve(); });
    });
  }
}
```

### 4. macOS Chrome silences same-tag re-pushes even with `renotify: true`

When a notification is dismissed (or auto-fades after the OS banner timeout), it stays in macOS Notification Center. A subsequent push with the same `tag` will **silently update** that Notification Center entry rather than firing a new banner — **even with `renotify: true`**. Chrome on Linux/Windows respects `renotify` correctly; macOS does not.

**Fix:** Use a unique tag per call when fresh banners are required. For our `testSelf()` we suffix with `Date.now()`. For real feed events, the trade-off is design choice: if you want consolidation, keep stable tags per event-type; if you want every event to alert, generate a fresh tag.

### 5. DevTools synthetic Push button doesn't trigger FCM SDK's `onBackgroundMessage`

The "Push" button in DevTools → Application → Service Workers fires a generic test payload, not an FCM-shaped one. The Firebase SDK's `onBackgroundMessage` only fires on payloads matching FCM's data envelope — so the synthetic button silently no-ops for `firebase-messaging-sw.js`.

**It does fire the raw `self.addEventListener('push', ...)` listener** though — which is one of several reasons the raw-listener approach (Quirk #2) is more diagnostically friendly.

**Implication for testing:** the synthetic Push button is only a useful diagnostic if your handler is the raw `push` listener, not the FCM SDK wrapper.

---

## Diagnostic Surfaces (Reference for Future Push Debugging)

| What it tells you | URL / location |
|---|---|
| Does Chrome's push service receive the message? | `chrome://gcm-internals` → Receive Message Log |
| Is the SW registered + active? Click Inspect to open SW console | `chrome://serviceworker-internals/?devtools-on` |
| OS notification API works (no SW involved)? | Run `new Notification('test')` from page console |
| SW registration registered the right scope? | `(async () => (await navigator.serviceWorker.getRegistrations()).map(r=>r.scope))()` |
| Force a push event without going through FCM | DevTools → Application → Service Workers → Push button (only works for raw `push` listener handlers) |
| Direct showNotification call (bypasses push entirely) | `navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope').then(r=>r.showNotification('test'))` |
| Nuke all caches / SWs / storage for this origin | DevTools → Application → Storage → Clear site data |
| Force SW update without page reload | DevTools → Application → Service Workers → Update link |

### When in doubt, check the layers in order

1. `new Notification('test')` from page console — does the OS show the banner? (If no, OS/Mac Focus mode is blocking)
2. Direct `showNotification` via SW registration — does the SW + OS pipe work? (If no, OS issue or notif options bad)
3. Synthetic Push button on a raw-listener SW — does the SW push handler fire? (If no, SW state issue)
4. `chrome://gcm-internals` Receive Message Log — does the message reach Chrome? (If no, FCM/network issue)
5. Worker logs (Cloudflare Logs tab) — did FCM accept the token? (If no, token dead or auth failed)

---

## Service Account Key Rotation Procedure (Documented for Future)

The Firebase service account JSON file was leaked into chat early in the session (mid-troubleshooting, before guardrails were re-asserted). Rotation procedure:

1. **Generate new key:** Firebase Console → Settings → Service Accounts → "Generate new private key" (downloads JSON)
2. **Update Cloudflare worker secrets:** Workers & Pages → `deadcetera-proxy` → Settings → Variables and Secrets — replace `FCM_CLIENT_EMAIL` and `FCM_PRIVATE_KEY` with values from new JSON. Save and Deploy.
3. **Verify push still works:** `GLPush.testSelf()` from a fresh device — if response shows `sent: N of N`, new key is signing JWTs correctly
4. **Delete old key:** Google Cloud Console → IAM & Admin → Service Accounts → click the `firebase-adminsdk-...@deadcetera-35424.iam.gserviceaccount.com` row → Keys tab → match `private_key_id` from new JSON to identify which row to keep, trash the other
5. **Re-verify** push still works — confirms the kept key is the active one

The order matters — never delete the old key before confirming the new one signs successfully.

---

## Twilio 10DLC Setup Notes (For When Approval Lands)

- Brand: Sole Proprietor "Andrew Merrill"
- A2P Campaign: app-to-person band coordination
- Required compliance pages (already live):
  - `https://groovelinx.com/privacy.html`
  - `https://groovelinx.com/terms.html` — must include **HELP**/**STOP** keywords in bold, message rates statement, and frequency disclosure
- Phone number: +14085398813
- ETA: ~3 days from registration date (2026-04-26)

When approval lands, Layer 3 build will mirror the FCM worker pattern: new `/sms/send` endpoint in `worker.js`, Twilio Messages API call, store opt-in/opt-out at `bands/{slug}/sms_subscriptions/{memberKey}` with E.164 phone + opt-in timestamp + STOP/UNSTOP tracking.

---

## Outstanding Security Cleanup

- **Browser API key restrictions** (Google Cloud Console → APIs & Services → Credentials): the API key `AIzaSyC3sMU2S8XT9AhA4w5vTwtPP1Nx5kOHOJo` (the one hardcoded in `firebase-service.js` and `firebase-messaging-sw.js`) currently has **Application restrictions = None** because we had to remove HTTP referrer restrictions to unblock FCM Installations API during troubleshooting. Should be re-tightened to:
  - HTTP referrers limited to: `https://groovelinx.vercel.app/*`, `https://app.groovelinx.com/*`, `https://drewmerrill.github.io/*`, `http://localhost/*`
  - API restrictions: must include Firebase Installations API + FCM Registration API in addition to existing 6
- Two browser API keys exist for the project — `AIzaSyC3s...` (the active one used by app code) and `AIzaSyB__AzCV...` (newer auto-generated, not currently referenced anywhere). The unused one can probably be deleted, but leave it for now until that's confirmed by grep.

---

## Files Touched This Session

### New
- `firebase-messaging-sw.js` — root-level FCM service worker (required path)
- `js/core/gl-push.js` — `window.GLPush` client API
- `02_GrooveLinx/notes/session_2026-04-26_notification_system.md` (this file)

### Modified
- `worker.js` — `/push/send` endpoint, FCM auth (JWT/OAuth/FCM v1), data-only payload
- `js/core/firebase-service.js` — added `firebase-messaging-compat.js` SDK loadScript
- `index.html` — `<script src="js/core/gl-push.js?v=...">`
- `js/features/notifications.js` — gold "Browser Push Notifications" card on the Notifications page
- `js/features/band-feed.js` — wired `GLPush.notifyBand()` after each feed item creation
- `app.js` + `app-dev.js` — `_toggleNotifMaster` redirected from legacy `enablePush()` to `GLPush.subscribe/unsubscribe`; `_renderNotifSettings` made async

### Cloudflare Worker (paste-deploy)
- New worker secrets: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`
- Worker code redeployed via dashboard (does not auto-deploy from GitHub)

### groovelinx-site (separate repo)
- `privacy.html` — created (Twilio-compliant)
- `terms.html` — created (Twilio-compliant with HELP/STOP)

---

## Builds Shipped This Session

| Build | What |
|---|---|
| `20260426-220801` | Initial FCM scaffolding + correct API key in firebase-messaging-sw.js |
| `20260426-222507` | Settings master toggle redirected to GLPush; legacy push migration |
| `20260426-230843` | Data-only FCM payload + correct SW icon paths |
| `20260426-231855` | Raw push handler instead of FCM SDK onBackgroundMessage |
| `20260426-233717` | Wait for FCM SW to activate before getToken() |
| `20260426-234233` | Unique tag per testSelf call (final) |

---

## Next Recommended Step

Re-tighten the Browser API key restrictions in Google Cloud Console (5-min walkthrough — see "Outstanding Security Cleanup" above). Restrictions to apply:
- Application restrictions: HTTP referrers, with allowlist `https://groovelinx.vercel.app/*`, `https://app.groovelinx.com/*`, `https://drewmerrill.github.io/*`, `http://localhost/*`
- API restrictions: Restrict key to the 6 existing APIs plus **Firebase Installations API** and **FCM Registration API**

After that, the security cleanup loop is closed. Then we wait on Twilio 10DLC approval to wire Layer 3.

---

## Restart Prompt

> Notification system Layer 2 (FCM browser push) shipped 2026-04-26 (build 20260426-234233). Drew + iPhone confirmed end-to-end. Service account key rotated, old leaked key deleted. Outstanding: re-tighten browser API key HTTP referrer restrictions (currently set to "None"); Layer 3 Twilio SMS pending 10DLC approval (~3 days). Full session detail in `02_GrooveLinx/notes/session_2026-04-26_notification_system.md`. What's next?
