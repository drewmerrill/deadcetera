/**
 * gl-user-identity.js — User Identity Resolution
 *
 * Determines current user identity from multiple sources:
 * 1. Band member profile (matched by email)
 * 2. Auth display name
 * 3. Fallback to empty
 *
 * EXPOSES: window.GLUserIdentity
 */

(function() {
  'use strict';

  function getContext() {
    var email = (typeof currentUserEmail !== 'undefined' && currentUserEmail) ? currentUserEmail : '';
    var fullName = '';
    var firstName = '';

    // Priority 1: Band member profile name (most accurate)
    if (email && typeof bandMembers !== 'undefined' && bandMembers) {
      var keys = Object.keys(bandMembers);
      for (var i = 0; i < keys.length; i++) {
        var m = bandMembers[keys[i]];
        if (m && m.email && m.email.toLowerCase() === email.toLowerCase()) {
          fullName = m.name || '';
          break;
        }
      }
    }

    // Priority 2: Auth display name
    if (!fullName) {
      fullName = (typeof currentUserName !== 'undefined' && currentUserName) ? currentUserName : '';
    }

    // Extract first name
    if (fullName) {
      firstName = fullName.split(' ')[0] || fullName;
    }

    return {
      email: email,
      fullName: fullName,
      firstName: firstName,
      memberKey: (typeof getCurrentMemberKey === 'function') ? getCurrentMemberKey() : null,
      bandSlug: (typeof currentBandSlug !== 'undefined') ? currentBandSlug : '',
      bandName: localStorage.getItem('deadcetera_band_name') || ''
    };
  }

  /**
   * Replace {firstName} tokens in a string.
   * If no name available, removes the token cleanly.
   */
  function personalize(text) {
    if (!text) return text;
    var ctx = getContext();
    if (ctx.firstName) {
      return text.replace(/\{firstName\}/g, ctx.firstName);
    }
    // Remove tokens + cleanup (e.g., "Hey {firstName}, " → "Hey, ")
    return text.replace(/,?\s*\{firstName\},?\s*/g, ' ').replace(/\{firstName\}/g, '').trim();
  }

  window.GLUserIdentity = {
    getContext: getContext,
    personalize: personalize,
    getFirstName: function() { return getContext().firstName; }
  };

  console.log('\uD83D\uDC64 GLUserIdentity loaded');
})();
