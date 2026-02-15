# 🔧 FIX FOR MISSING RECORDINGS

## THE PROBLEM:
Your recordings were saved with `songTitle = undefined` because `selectedSong.title` wasn't set properly.

They're in localStorage as:
- `deadcetera_harmony_audio_undefined_section0` ❌

But the app is looking for:
- `deadcetera_harmony_audio_Tweezer Reprise_section0` ✅

## THE FIX:

**Run this in browser console to move them:**

```javascript
// Migration script - moves recordings from "undefined" to correct song
function migrateRecordings() {
    const songName = prompt("What song are these recordings for?", "Tweezer Reprise");
    if (!songName) return;
    
    // Find all "undefined" recordings
    Object.keys(localStorage)
        .filter(k => k.startsWith('deadcetera_harmony_audio_undefined'))
        .forEach(oldKey => {
            // Get the data
            const data = localStorage.getItem(oldKey);
            
            // Extract section number
            const sectionMatch = oldKey.match(/_section(\d+)$/);
            const sectionNum = sectionMatch ? sectionMatch[1] : '0';
            
            // Create new key with correct song name
            const newKey = `deadcetera_harmony_audio_${songName}_section${sectionNum}`;
            
            console.log(`Moving: ${oldKey} → ${newKey}`);
            
            // Copy to new location
            localStorage.setItem(newKey, data);
            
            // Remove old key
            localStorage.removeItem(oldKey);
        });
    
    alert(`✅ Migrated recordings to "${songName}"! Refresh the page.`);
}

// Run it
migrateRecordings();
```

## OR DO IT MANUALLY:

1. **In Console, run:**
```javascript
// Get the recording
const oldData = localStorage.getItem('deadcetera_harmony_audio_undefined_section0');

// Save to correct location
localStorage.setItem('deadcetera_harmony_audio_Tweezer Reprise_section0', oldData);

// Delete old one
localStorage.removeItem('deadcetera_harmony_audio_undefined_section0');

// Refresh page
location.reload();
```

2. **Your "Quick explanation" recording will appear!** ✅

---

## FOR FUTURE RECORDINGS:

The bug is now FIXED in app.js. Future recordings will save correctly because:
- `selectedSong` is now an object with `.title` property
- All code now uses `selectedSong.title` properly
- No more `undefined` keys!

---

## WHAT'S FIXED:

1. ✅ **selectedSong bug** - Now properly stores as `{title: "Song Name"}`
2. ✅ **Practice track thumbnails** - Max 200px width
3. ⏳ **Sheet music** - Should work now, but needs migration too

---

Upload the new app.js, then run the migration script! 🎸
