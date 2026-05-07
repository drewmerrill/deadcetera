// GrooveLinx Cloud Functions
//
// mirrorMemberToIndex
//   RTDB onWrite trigger at /bands/{bandSlug}/meta/members/{memberKey}.
//   Maintains /members_index/{sanitized_email} -> bandSlug so the auth gate
//   in app.js can do an O(1) read at sign-in time instead of scanning the
//   entire bands tree (which also leaked every band's roster to every login).
//
//   Region must match the RTDB instance region. The default firebaseio.com
//   instance for project deadcetera-35424 lives in us-central1, so this
//   function pins to us-central1.
//
//   Deploy: firebase deploy --only functions

const {onValueWritten} = require('firebase-functions/v2/database');
const {logger} = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();

// Mirror the rule from js/core/utils.js sanitizeFirebasePath. Keep in sync.
function sanitize(str) {
    return String(str).replace(/[.#$\[\]\/]/g, '_');
}

exports.mirrorMemberToIndex = onValueWritten(
    {
        ref: '/bands/{bandSlug}/meta/members/{memberKey}',
        region: 'us-central1'
    },
    async (event) => {
        const {bandSlug, memberKey} = event.params;
        const before = event.data.before.val();
        const after = event.data.after.val();

        const beforeEmail = before && before.email
            ? String(before.email).toLowerCase()
            : null;
        const afterEmail = after && after.email
            ? String(after.email).toLowerCase()
            : null;

        if (beforeEmail === afterEmail) {
            return;
        }

        const db = admin.database();
        const updates = {};

        if (beforeEmail) {
            const oldKey = sanitize(beforeEmail);
            const oldSnap = await db.ref('members_index/' + oldKey).once('value');
            if (oldSnap.val() === bandSlug) {
                updates['members_index/' + oldKey] = null;
            }
        }

        if (afterEmail) {
            const newKey = sanitize(afterEmail);
            const existingSnap = await db.ref('members_index/' + newKey).once('value');
            const existing = existingSnap.val();
            if (existing && existing !== bandSlug) {
                logger.warn('[members_index] collision (last-write-wins)', {
                    email: afterEmail,
                    previousBand: existing,
                    newBand: bandSlug
                });
            }
            updates['members_index/' + newKey] = bandSlug;
        }

        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            logger.info('[members_index] mirrored', {
                bandSlug,
                memberKey,
                beforeEmail,
                afterEmail,
                updates
            });
        }
    }
);
