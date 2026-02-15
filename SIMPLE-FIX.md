# 🎯 SIMPLE FIX - Three Steps

## ✅ What's Fixed in app.js:
1. "Needs Work" badge removed
2. Thumbnails smaller (200px)
3. Green ✅ button for sheet music
4. Future recordings will work

---

## 🚀 DO THESE THREE THINGS:

### 1. Upload app.js ✅

### 2. Run This Once in Console:

**Open Console (F12 → Console), paste this, press Enter:**

```javascript
// Migrate recording
const old1 = localStorage.getItem('deadcetera_harmony_audio_undefined_section0');
if (old1) {
    localStorage.setItem('deadcetera_harmony_audio_Tweezer Reprise_section0', old1);
    localStorage.removeItem('deadcetera_harmony_audio_undefined_section0');
    console.log('✅ Audio migrated');
}

// Migrate sheet music
const old2 = localStorage.getItem('deadcetera_abc_undefined_section0');
if (old2) {
    localStorage.setItem('deadcetera_abc_Tweezer Reprise_section0', old2);
    localStorage.removeItem('deadcetera_abc_undefined_section0');
    console.log('✅ Sheet music migrated');
}

// Refresh
alert('✅ Migration complete! Refreshing...');
location.reload();
```

### 3. Click Tweezer Reprise

Your recordings and sheet music will appear! ✅

---

## ⚠️ Known Limitations:

### Voice Selection Not Working Yet
**Workaround:** Edit ABC notation to comment out voices:
```abc
% V:1 clef=treble name="Pierce"  ← Add % to mute
V:2 clef=treble name="Drew"       ← Keep this one
```

### Practice Notes Not Editable
**Workaround:** Use "Rehearsal Notes" section instead - those ARE editable!

### Practice Track URLs
Should work after upload. If not, check console for errors.

---

## That's It!

Upload → Run migration → Click song → Done! 🎸
