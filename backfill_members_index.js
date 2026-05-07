// One-time backfill for /members_index — populates the email→bandSlug map
// from existing bands rosters. Auto-runs on script load.
//
// Usage (DevTools console at app.groovelinx.com):
//   import('/backfill_members_index.js?t=' + Date.now())
//
// Safe to run multiple times — overwrites with same values. Delete this
// file from the repo after the gate cutover lands.

(async () => {
    try {
        if (typeof firebaseDB === 'undefined' || !firebaseDB) {
            console.error('[backfill] firebaseDB not available — sign in first');
            return;
        }
        const sanitize = e => String(e).toLowerCase().replace(/\./g, '_');
        console.log('[backfill] reading bands…');
        const snap = await firebaseDB.ref('bands').once('value');
        const bands = snap.val() || {};
        const updates = {};
        Object.keys(bands).forEach(slug => {
            const members = ((bands[slug] || {}).meta || {}).members || {};
            Object.values(members).forEach(m => {
                if (m && m.email) {
                    updates['members_index/' + sanitize(m.email)] = slug;
                }
            });
        });
        console.table(updates);
        if (!Object.keys(updates).length) {
            console.warn('[backfill] no member emails found — nothing written');
            return;
        }
        await firebaseDB.ref().update(updates);
        console.log('[backfill] ✅ wrote ' + Object.keys(updates).length + ' entries to /members_index');
    } catch (e) {
        console.error('[backfill] failed:', e);
    }
})();
