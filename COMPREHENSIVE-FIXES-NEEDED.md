# 🔧 COMPREHENSIVE FIXES - All 5 Issues

## Issue #1: Google Drive Disconnects Every Time ⏳

**Problem:** Have to reconnect Google Drive on every visit

**Why:** Browser doesn't persist OAuth token across sessions

**Quick Fix (Temporary):**
- This is how OAuth works for security
- Token expires after session
- Need to click "Connect" each time

**Better Fix (Requires More Work):**
- Store refresh token (more complex)
- Or: Keep recordings in localStorage (no Drive needed for now)
- For now: Just click "Connect" when you want to upload

**Status:** Working as designed for security. Can improve later.

---

## Issue #2: "Needs Work" Badge ⚠️

**Problem:** Red "Needs Work" badge is confusing

**Where it comes from:**
```javascript
// In data.js:
workedOut: false,  // ← This causes "Needs Work"
soundsGood: false  // If true, shows "Sounds Great"
```

**Fix Options:**

**A. Remove the badge** (simplest):
- Just don't show any status badge
- Keep it clean

**B. Make it editable:**
- Add buttons to mark "Worked Out" or "Sounds Good"
- Save to localStorage

**C. Change the colors:**
- Use less alarming colors
- Make "Needs Work" informational, not scary

**Recommendation:** Remove it or make it less prominent

---

## Issue #3: Harmony Notes Not Editable 📝

**Problem:** Practice notes in the middle section can't be edited

**Current State:**
```javascript
// Hard-coded in data.js:
practiceNotes: [
    "Focus on the 'freeze' - it's abrupt",
    "Pierce comes in HIGH on 'step'"
]
```

**Solution:** Add "+ Edit Notes" button that:
1. Opens editor
2. Saves to localStorage
3. Merges with data.js notes
4. Shows both sources

**Status:** Needs implementation

---

## Issue #4: Sheet Music Not Visible 🎼

**Problem:** Button says "Create" even when sheet music exists

**Current:** Button changes text but not obvious enough

**Better Solution:**
1. Add visual indicator (✅ badge)
2. Show preview thumbnail
3. Different button color when exists

**Quick Fix:**
```
❌ Current: "🎼 Create Sheet Music"
✅ Better:  "🎼 Create Sheet Music" (gray button)
            "🎼 ✅ View Sheet Music" (green button)
```

**Status:** Partially working, needs visual improvement

---

## Issue #5: Recordings Disappeared 🎤

**Problem:** Audio snippets not showing

**Possible Causes:**
1. localStorage cleared
2. Song title mismatch
3. Section index mismatch
4. Code is calling wrong function

**Debug Steps:**

**Check localStorage:**
```javascript
// In browser console:
Object.keys(localStorage)
  .filter(k => k.startsWith('deadcetera_harmony_audio'))
  .forEach(k => console.log(k, localStorage.getItem(k)))
```

**Check if recordings exist:**
```javascript
// Look for keys like:
deadcetera_harmony_audio_Tweezer Reprise_section0
```

**If they exist:** Code problem
**If they don't:** They were deleted/cleared

---

## 🎯 PRIORITY FIXES:

### Do First (Critical):
1. **Fix #5 - Find the recordings**
   - Check localStorage
   - Debug why not displaying
   - Most important!

2. **Fix #4 - Make sheet music obvious**
   - Add ✅ badge
   - Change button color
   - Quick visual fix

### Do Later (Nice to Have):
3. **Fix #2 - Remove/improve "Needs Work"**
   - Less urgent
   - Cosmetic issue

4. **Fix #3 - Editable practice notes**
   - Feature enhancement
   - Not blocking

5. **Fix #1 - Google Drive persistence**
   - Security vs convenience tradeoff
   - Can live with reconnecting

---

## 🔍 IMMEDIATE DEBUG FOR ISSUE #5:

**Run this in browser console:**
```javascript
// 1. Check what's in localStorage
console.log('=== localStorage keys ===');
Object.keys(localStorage)
  .filter(k => k.includes('deadcetera'))
  .forEach(k => console.log(k));

// 2. Check for harmony audio specifically
console.log('
=== Harmony audio ===');
Object.keys(localStorage)
  .filter(k => k.startsWith('deadcetera_harmony_audio'))
  .forEach(k => {
    console.log(k);
    const data = JSON.parse(localStorage.getItem(k));
    console.log('  Count:', data.length);
    data.forEach((s, i) => console.log(`  ${i}: ${s.name}`));
  });

// 3. Check current song
console.log('
=== Current song ===');
console.log('selectedSong:', selectedSong);

// 4. Check if loadHarmonyAudioSnippets exists
console.log('
=== Function check ===');
console.log('loadHarmonyAudioSnippets exists?', typeof loadHarmonyAudioSnippets);
```

**Send me the output and I'll tell you exactly what's wrong!**

---

## 📸 What I Need:

1. **Screenshot of browser console** with the debug output above
2. **Tell me:** Did you refresh the page hard? (Cmd+Shift+R)
3. **Tell me:** Which song are you looking at? ("Tweezer Reprise"?)
4. **Tell me:** Which harmony section? (First one? Second?)

With that info I can pinpoint the exact issue! 🎯
