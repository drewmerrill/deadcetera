# 🎸 Track Number Fix Guide

## ✅ VERIFIED & WORKING

These songs have been tested and have correct Archive IDs + track numbers:

### Althea
- **#1 Hartford 3/14/81**: `gd1981-03-14.nak700.glassberg.motb.84826.sbeok.flac16`, track 08 ✅

---

## ⚠️ NEEDS VERIFICATION

All other songs (59 versions) need to be tested to confirm:
1. The Archive ID has the full show (both sets)
2. The track number is correct for that specific Archive version

---

## 🔧 HOW TO FIX A SONG

### Step 1: Test Smart Download
1. Select the song/version
2. Click "Smart Download"
3. Listen to what downloads

### Step 2: If Wrong Song Downloads

**Option A: Find Correct Track Number (Quick)**
1. Note which song downloaded
2. Check Setlist.fm for the show
3. Count the position difference
4. Adjust track number in data.js

**Option B: Use Different Archive Version (Better)**
1. Go to Archive.org and search for the date
2. Find a version with the full show (not `.s1.` or `.s2.`)
3. Look at the file listing
4. Find which track number has your song
5. Update both `archiveId` and `trackNumber` in data.js

### Step 3: Upload & Test Again

---

## 📋 SONGS TO PRIORITIZE

Fix these popular songs first:
1. ✅ Althea (DONE)
2. Shakedown Street (5 versions)
3. Franklin's Tower (5 versions)
4. Scarlet Begonias (5 versions)
5. Fire on the Mountain (5 versions)
6. Estimated Prophet (5 versions)
7. The Other One (5 versions)
8. Dark Star (5 versions)
9. Morning Dew (5 versions)
10. Playing in the Band (5 versions)
11. Help > Slipknot > Franklin's (5 versions)
12. China > Rider (5 versions)

---

## 💡 TIPS

- **Archive IDs with `.s1.` or `.s2.`** = Only one set, will cause problems
- **Generic IDs like `gd1981-03-14`** = Auto-selects version, unpredictable
- **Best approach**: Use specific Archive IDs (long ones with taper names)
- **Test in order**: Fix #1 versions first (most used), then #2, etc.

---

## 🎯 QUICK FIX TEMPLATE

```javascript
{
    rank: 1,
    venue: "Venue Name",
    date: "Month DD, YYYY",
    archiveId: "gd1981-03-14.SPECIFIC.VERSION.HERE",  // ← Use specific version
    notes: "Notes about this version",
    trackNumber: "XX",  // ← Test and verify this number
    quality: "SBD"
}
```

---

## ⏰ TIME ESTIMATE

- **Per song (5 versions)**: ~15-30 minutes
- **All 12 songs (60 versions)**: ~3-6 hours total

**Recommended**: Fix songs as you use them, not all at once!
