// gl-sms.js — SMS notification fanout for opted-in band members.
// EXPOSES: window.GLSms
//
// Pairs with GLPush (FCM) — same band-fanout pattern, different channel.
// Reads sms_subscriptions/{memberKey} (status: 'active' + phone). Fans out
// one POST per recipient to the existing Worker /sms/send route. At ~4
// members per band, browser-side fan-out is fine. Move to a worker-side
// /sms/notify-band route if recipient counts grow.

(function() {
  'use strict';

  var WORKER_BASE = (typeof window !== 'undefined' && window.WORKER_BASE)
    ? window.WORKER_BASE
    : 'https://deadcetera-proxy.drewmerrill.workers.dev';

  async function notifyBand(opts) {
    opts = opts || {};
    if (!opts.body) return { ok: false, reason: 'no_body' };

    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    var excludeKey = (opts.excludeMemberKey !== undefined) ? opts.excludeMemberKey : memberKey;
    var db = (typeof firebaseDB !== 'undefined' && firebaseDB) ? firebaseDB : null;
    if (!db || typeof bandPath !== 'function') return { ok: false, reason: 'no_firebase' };

    try {
      var snap = await db.ref(bandPath('sms_subscriptions')).once('value');
      var byMember = snap.val() || {};
      var recipients = [];
      Object.keys(byMember).forEach(function(mKey) {
        if (excludeKey && excludeKey !== '__none__' && mKey === excludeKey) return;
        var sub = byMember[mKey];
        if (sub && sub.status === 'active' && sub.phone) {
          recipients.push({ memberKey: mKey, phone: sub.phone });
        }
      });

      if (!recipients.length) {
        console.log('[GLSms] notifyBand: 0 opted-in recipients');
        return { ok: true, sent: 0, total: 0, failed: 0, errors: [], details: [] };
      }

      var promises = recipients.map(function(r) {
        return fetch(WORKER_BASE + '/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: r.phone, body: opts.body })
        })
          .then(function(res) {
            return res.json().then(function(json) { return { r: r, json: json, status: res.status }; });
          })
          .catch(function(err) { return { r: r, error: err && err.message }; });
      });

      var results = await Promise.all(promises);
      var sent = 0, failed = 0, errors = [], details = [];
      results.forEach(function(result) {
        if (result.error) {
          failed++;
          errors.push({ memberKey: result.r.memberKey, error: result.error });
        } else if (result.json && result.json.success) {
          sent++;
          details.push({ memberKey: result.r.memberKey, sid: result.json.sid, status: result.json.status });
        } else {
          failed++;
          var err = (result.json && result.json.error) || ('HTTP ' + result.status);
          errors.push({ memberKey: result.r.memberKey, error: err });
        }
      });

      console.log('[GLSms] notifyBand:', sent, 'of', recipients.length, 'sent', failed ? '| ' + failed + ' failed' : '');
      if (failed) console.warn('[GLSms] errors:', errors);
      return { ok: true, sent: sent, total: recipients.length, failed: failed, errors: errors, details: details };
    } catch (e) {
      console.warn('[GLSms] notifyBand failed:', e && e.message);
      return { ok: false, reason: e && e.message };
    }
  }

  // Self-test: bypass excludeMemberKey, send to current user's own number.
  // Useful for verifying the pipeline from the console: GLSms.testSelf()
  async function testSelf() {
    var memberKey = (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null;
    if (!memberKey) return { ok: false, reason: 'not_signed_in' };
    return notifyBand({
      body: 'GrooveLinx: GLSms self-test. Reply STOP to opt out, HELP for help. Message and data rates may apply.',
      excludeMemberKey: '__none__'
    });
  }

  if (typeof window !== 'undefined') {
    window.GLSms = {
      notifyBand: notifyBand,
      testSelf: testSelf
    };
  }
})();
