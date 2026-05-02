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

  // Picker doesn't show a Size column (drive.file scope can't list metadata
  // pre-pick). We surface it post-pick via doc.sizeBytes from the callback.
  function _formatSize(bytes) {
    var n = Number(bytes) || 0;
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + ' MB';
    return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  function _apiKey() {
    return (typeof GOOGLE_DRIVE_CONFIG !== 'undefined') ? GOOGLE_DRIVE_CONFIG.apiKey : '';
  }

  function _accessToken() {
    return (typeof accessToken !== 'undefined') ? accessToken : null;
  }

  // When Firebase auth was restored from localStorage but the Google access
  // token wasn't (in-memory only), request a token silently before opening the
  // Picker. Wraps the global tokenClient.callback for the duration of one
  // request so we can resolve the promise without blocking the normal callback
  // (which sets the global `accessToken` and updates UI).
  function _ensureAccessToken() {
    return new Promise(function(resolve, reject) {
      var existing = _accessToken();
      if (existing) { resolve(existing); return; }
      if (typeof tokenClient === 'undefined' || !tokenClient) {
        reject(new Error('Google sign-in not initialized'));
        return;
      }
      var origCb = tokenClient.callback;
      var settled = false;
      tokenClient.callback = function(response) {
        tokenClient.callback = origCb;
        try { if (typeof origCb === 'function') origCb(response); } catch(e) {}
        if (settled) return;
        settled = true;
        if (response && response.access_token) {
          resolve(response.access_token);
        } else {
          reject(new Error((response && response.error) || 'Token request failed'));
        }
      };
      try {
        tokenClient.requestAccessToken({ prompt: '' });
      } catch(e) {
        tokenClient.callback = origCb;
        if (!settled) { settled = true; reject(e); }
      }
      // Safety timeout — if Google never responds, don't hang the Picker forever
      setTimeout(function() {
        if (settled) return;
        settled = true;
        tokenClient.callback = origCb;
        reject(new Error('Token request timed out'));
      }, 15000);
    });
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

    Promise.all([
      _ensureAccessToken(),
      _loadPicker()
    ]).then(function(results) {
      var token = results[0];
      try {
        var picker = window.google.picker;

        // Audio + video MIME view — covers MP3/M4A/WAV plus any video
        // containers a band member might have for bestshot. DocsView (not the
        // generic View) is needed so we can force LIST mode — the default
        // grid view shows transparency-checker placeholders for audio files
        // since they have no thumbnails.
        // Note on folder navigation: setMimeTypes() filters at the Drive query
        // level, so anything not in this list is hidden — including folders,
        // whose mime type is `application/vnd.google-apps.folder`. We add it
        // explicitly so folders appear and can be clicked into.
        // setSelectFolderEnabled(false) still prevents the user from "Select"-ing
        // a folder as the result — they can only navigate into folders, then
        // pick a real audio/video file inside.
        var view = new picker.DocsView(picker.ViewId.DOCS)
          .setMode(picker.DocsViewMode.LIST)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes('application/vnd.google-apps.folder,audio/mpeg,audio/mp4,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/flac,audio/webm,audio/*,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/*');
        // Optional starting folder — user can configure their default
        // recordings folder once and have the Picker open straight to it.
        try {
          var startFolderId = localStorage.getItem('gl_drive_default_folder_id') || '';
          if (startFolderId) view.setParent(startFolderId);
        } catch(e) {}

        // Size to ~92% of viewport so all columns (Name, Owner, Last
        // modified, Size, action icons) have room. Picker default is narrow
        // and clips Size off-screen.
        var pw = Math.max(720, Math.min(1400, Math.floor((window.innerWidth || 1024) * 0.92)));
        var ph = Math.max(480, Math.min(900, Math.floor((window.innerHeight || 768) * 0.85)));

        var p = new picker.PickerBuilder()
          .enableFeature(picker.Feature.SUPPORT_DRIVES)
          .enableFeature(picker.Feature.MULTISELECT_ENABLED).disableFeature(picker.Feature.MULTISELECT_ENABLED)
          .setAppId(_appId())
          .setOAuthToken(token)
          .setDeveloperKey(_apiKey())
          .setSize(pw, ph)
          .addView(view)
          .setCallback(function(data) {
            if (!data || !data.action) return;
            if (data.action === picker.Action.PICKED) {
              var doc = (data.docs || [])[0];
              if (!doc) return;
              // Remember the folder the user picked from so future Pickers
              // open there directly. Picker exposes parentId on the doc.
              try {
                if (doc.parentId) localStorage.setItem('gl_drive_default_folder_id', doc.parentId);
              } catch(e) {}
              onPick({
                fileId: doc.id,
                name: doc.name || '',
                mimeType: doc.mimeType || '',
                sizeBytes: doc.sizeBytes || 0,
                sizeLabel: _formatSize(doc.sizeBytes),
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
