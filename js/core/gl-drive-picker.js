// ============================================================================
// js/core/gl-drive-picker.js — Google Drive Picker integration
//
// Wraps Google's Picker API so callers can request a single audio/video file
// without dealing with gapi loading. Used to replace "paste a Drive URL"
// inputs across the app, which previously required the broad `drive.readonly`
// scope. Picker grants access to ONLY the file the user picks (under the
// non-sensitive `drive.file` scope), which is the only Drive scope we want
// to keep on the consent screen.
//
// Public API:
//   GLDrivePicker.pickAudio({onPick, onCancel, onError})
//     Resolves with { fileId, name, mimeType, sizeBytes, url } on selection.
//
// Loading: lazy. The Google API JS only loads on the first call. Subsequent
// calls reuse the cached gapi.picker module.
// ============================================================================

'use strict';

window.GLDrivePicker = (function() {

  var _gapiLoading = null; // Promise<void>
  var _pickerLoading = null; // Promise<void>

  // App ID = numeric prefix of the OAuth client ID. Picker uses it to scope
  // the per-file grant. It's not a secret — it shows up in the picker's
  // generated URLs anyway.
  function _appId() {
    try {
      var cid = (typeof GOOGLE_DRIVE_CONFIG !== 'undefined') ? GOOGLE_DRIVE_CONFIG.clientId : '';
      var m = cid.match(/^(\d+)-/);
      return m ? m[1] : '';
    } catch(e) { return ''; }
  }

  function _apiKey() {
    return (typeof GOOGLE_DRIVE_CONFIG !== 'undefined') ? GOOGLE_DRIVE_CONFIG.apiKey : '';
  }

  function _accessToken() {
    return (typeof accessToken !== 'undefined') ? accessToken : null;
  }

  // Inject https://apis.google.com/js/api.js once. The PWA service worker is
  // configured to bypass cross-origin requests it doesn't pre-cache, so this
  // works offline-first the same way Firebase scripts do.
  function _loadGapiScript() {
    if (window.gapi) return Promise.resolve();
    if (_gapiLoading) return _gapiLoading;
    _gapiLoading = new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.async = true;
      s.defer = true;
      s.onload = resolve;
      s.onerror = function() { reject(new Error('Failed to load Google API script')); };
      document.head.appendChild(s);
    });
    return _gapiLoading;
  }

  function _loadPicker() {
    if (window.google && window.google.picker) return Promise.resolve();
    if (_pickerLoading) return _pickerLoading;
    _pickerLoading = _loadGapiScript().then(function() {
      return new Promise(function(resolve, reject) {
        if (!window.gapi || !window.gapi.load) { reject(new Error('gapi not available')); return; }
        window.gapi.load('picker', { callback: resolve, onerror: reject });
      });
    });
    return _pickerLoading;
  }

  // Open a Picker scoped to audio/video files in the user's Drive.
  // Audio is the primary use; video is included so bestshot rehearsal videos
  // also show up if a band member uses video files.
  function pickAudio(opts) {
    opts = opts || {};
    var onPick = typeof opts.onPick === 'function' ? opts.onPick : function() {};
    var onCancel = typeof opts.onCancel === 'function' ? opts.onCancel : function() {};
    var onError = typeof opts.onError === 'function' ? opts.onError : function(e) { console.warn('[Picker]', e); };

    var token = _accessToken();
    if (!token) {
      onError(new Error('Not signed in to Google'));
      return;
    }

    _loadPicker().then(function() {
      try {
        var picker = window.google.picker;

        // Audio + video MIME view — covers MP3/M4A/WAV plus any video
        // containers a band member might have for bestshot.
        var view = new picker.View(picker.ViewId.DOCS)
          .setMimeTypes('audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/webm,audio/*,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/*');

        var p = new picker.PickerBuilder()
          .enableFeature(picker.Feature.SUPPORT_DRIVES)
          .enableFeature(picker.Feature.MULTISELECT_ENABLED).disableFeature(picker.Feature.MULTISELECT_ENABLED)
          .setAppId(_appId())
          .setOAuthToken(token)
          .setDeveloperKey(_apiKey())
          .addView(view)
          .setCallback(function(data) {
            if (!data || !data.action) return;
            if (data.action === picker.Action.PICKED) {
              var doc = (data.docs || [])[0];
              if (!doc) return;
              onPick({
                fileId: doc.id,
                name: doc.name || '',
                mimeType: doc.mimeType || '',
                sizeBytes: doc.sizeBytes || 0,
                url: 'https://drive.google.com/file/d/' + doc.id + '/view'
              });
            } else if (data.action === picker.Action.CANCEL) {
              onCancel();
            }
          })
          .build();

        p.setVisible(true);
      } catch(e) {
        onError(e);
      }
    }).catch(onError);
  }

  return {
    pickAudio: pickAudio
  };

})();
