# 🎸 LEARNING RESOURCES FEATURE - IMPLEMENTATION GUIDE

## ✅ WHAT'S NEW (v2.4)

Your Deadcetera app now has a complete Learning Resources system! Here's what changed:

### **New Workflow:**
1. **Step 1:** Choose Your Song (unchanged)
2. **Step 2:** Learning Resources (NEW! ⭐)
   - Save your preferred Ultimate Guitar tab/chord chart
   - Add 1-2 instructional lesson videos
   - Add 1-2 reference performance recordings
3. **Step 3:** Choose Version (was Step 2)
4. **Step 4:** Download & Upload to Moises (was Step 3)
5. **Step 5:** Isolate Your Part (was Step 4)

### **Key Features:**

✅ **Instrument Selector** - Always visible at top (Bass, Rhythm Guitar, Lead Guitar, Keyboards, Vocals)
✅ **Ultimate Guitar Integration** - Click "Find on Ultimate Guitar" → Opens UG search → Save your preferred tab
✅ **Lesson Videos** - Add up to 2 YouTube lesson links
✅ **Reference Recordings** - Add up to 2 YouTube performance links
✅ **localStorage** - Remembers YOUR resources for each song+instrument combo
✅ **Smart Tab Labels** - "Bass Tab" for bass, "Chords" for rhythm/keys/vocals, "Lead Tab" for lead guitar

---

## 📦 FILES TO UPLOAD

Upload these 3 updated files to your GitHub repo:

1. **index.html** - New UI structure with instrument selector and Step 2
2. **styles.css** - New styles for resources sections
3. **app.js** - Complete Learning Resources functionality

**Keep these unchanged:**
- data.js (your song database)
- audio-splitter.js (your audio extraction engine)
- logo.png (your logo)

---

## 🚀 DEPLOYMENT STEPS

### Option A: GitHub Desktop (Recommended)

1. Open GitHub Desktop
2. Navigate to your `deadcetera` repo
3. Replace these 3 files:
   - `index.html`
   - `styles.css`
   - `app.js`
4. Commit message: "Add Learning Resources feature v2.4"
5. Push to origin
6. Wait 2 minutes for GitHub Pages to rebuild
7. Hard refresh your site: Cmd+Shift+R

### Option B: GitHub Web Interface

1. Go to https://github.com/YOUR-USERNAME/deadcetera
2. For each file (index.html, styles.css, app.js):
   - Click the file
   - Click pencil icon (Edit)
   - Delete all content
   - Paste new content
   - Commit changes
3. Wait 2 minutes
4. Hard refresh: Cmd+Shift+R

---

## 🧪 TESTING CHECKLIST

### Test 1: Instrument Selector
- [ ] See "I play:" dropdown at top
- [ ] Change to "Rhythm Guitar"
- [ ] Select a song
- [ ] Step 2 shows "Chords" label
- [ ] Change to "Bass"
- [ ] Step 2 updates to "Bass Tab" label

### Test 2: Tab/Chart Saving
- [ ] Select song (e.g., "Althea")
- [ ] Click "🔍 Find on Ultimate Guitar →"
- [ ] Ultimate Guitar opens in new tab
- [ ] Find your preferred tab
- [ ] Copy the URL
- [ ] Modal appears in Deadcetera
- [ ] Paste URL
- [ ] Click "Save"
- [ ] Tab appears as clickable link
- [ ] Click link → Opens correct UG page

### Test 3: Lesson Videos
- [ ] Click "+ Add Lesson Video"
- [ ] Modal appears
- [ ] Paste YouTube URL
- [ ] Click "Save"
- [ ] Lesson appears with YouTube icon
- [ ] Add second lesson
- [ ] Both lessons show
- [ ] "Add" button disappears (max 2)
- [ ] Click X to remove lesson
- [ ] Lesson deleted

### Test 4: Reference Recordings
- [ ] Click "+ Add Reference Recording"
- [ ] Paste YouTube performance URL
- [ ] Save
- [ ] Recording appears
- [ ] Add second reference
- [ ] Remove one with X button

### Test 5: Persistence (Most Important!)
- [ ] Save tab + lessons + references for "Althea" as "Bass"
- [ ] Change instrument to "Rhythm Guitar"
- [ ] Resources clear (different instrument = different storage)
- [ ] Save different resources for "Althea" as "Rhythm Guitar"
- [ ] Change back to "Bass"
- [ ] Original bass resources reappear! ✅
- [ ] Refresh page (hard reload)
- [ ] Select "Althea" again
- [ ] Resources still there! ✅

### Test 6: Continue to Version Selection
- [ ] Save some resources
- [ ] Click "Continue to Version Selection →"
- [ ] Step 3 appears (Top 5 Versions)
- [ ] Select a version
- [ ] Step 4 appears (Download)
- [ ] All buttons work

### Test 7: Different Instruments
- [ ] Set instrument to "Lead Guitar"
- [ ] Select "Scarlet Begonias"
- [ ] Label says "Lead Tab"
- [ ] Save lead guitar resources
- [ ] Change to "Keyboards"
- [ ] Select "Scarlet Begonias"
- [ ] Label says "Chords"
- [ ] Different resources (not the lead ones)

---

## 💡 HOW IT WORKS

### Storage Structure

Each song+instrument combination gets its own localStorage key:

```javascript
// Example keys:
"deadcetera_resources_Althea_bass"
"deadcetera_resources_Althea_rhythm_guitar"
"deadcetera_resources_Scarlet Begonias_lead_guitar"

// Example data stored:
{
  "tab": "https://tabs.ultimate-guitar.com/tab/grateful-dead/althea-bass-123456",
  "lessons": [
    "https://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/watch?v=def456"
  ],
  "references": [
    "https://www.youtube.com/watch?v=ghi789"
  ]
}
```

### Instrument Preference

Your last selected instrument is saved:
```javascript
localStorage.setItem('deadcetera_instrument', 'bass');
```

Next time you visit, it remembers you play bass!

---

## 🎯 USER WORKFLOW EXAMPLE

**Scenario:** Band learning "Alabama Getaway"

### Bass Player:
1. Opens Deadcetera
2. Selects "Bass" from dropdown
3. Searches "Alabama"
4. Clicks "Alabama Getaway"
5. **Step 2 appears:**
   - Clicks "Find on Ultimate Guitar"
   - Finds best bass tab
   - Saves tab URL
   - Adds lesson: "How to Play Alabama Getaway Bass Line"
   - Adds reference: "Phil Lesh 1981 Hartford Bass Cam"
6. Clicks "Continue to Version Selection"
7. Picks Hartford '81 version
8. Downloads with Smart Download
9. Uploads to Moises
10. Isolates bass stem
11. Practices along with lesson + reference!

### Rhythm Guitarist (same song, same time):
1. Opens Deadcetera
2. Selects "Rhythm Guitar"
3. Searches "Alabama"
4. Clicks "Alabama Getaway"
5. **Step 2 appears:**
   - Clicks "Find on Ultimate Guitar"
   - Finds chord chart (different from bass tab!)
   - Saves chord chart URL
   - Adds lesson: "Bob Weir Rhythm Guitar Technique"
   - Adds reference: "Weir 1981 Hartford Rhythm Cam"
6. Continues with same workflow...

**Both players get personalized resources for their part!**

---

## 📊 STORAGE LIMITS

- **localStorage limit:** ~5-10MB per domain (plenty!)
- **Per song+instrument:** Max ~500 bytes
- **Total songs you can save:** 10,000+ (you'll never hit the limit)

---

## 🎨 UI DESIGN NOTES

### Colors:
- **Primary purple:** #667eea (main brand color)
- **Success green:** #48bb78 (find buttons)
- **Red:** #c53030 (remove buttons)
- **Gray:** #e2e8f0 (borders)

### Layout:
- **Resources container:** Vertical stack (mobile-friendly)
- **Resource items:** Flex row (link + actions)
- **Responsive:** Stacks on mobile (<768px)

---

## 🔧 TROUBLESHOOTING

### "Resources don't save"
- Check browser console (Cmd+Option+J)
- Look for localStorage errors
- Try incognito mode (some browsers block localStorage)
- Make sure you're on HTTPS (GitHub Pages is)

### "Wrong instrument resources showing"
- Check instrument selector value
- Console.log currentInstrument variable
- Clear localStorage: `localStorage.clear()` in console

### "Can't click resource links"
- Links open in new tab (target="_blank")
- Check browser pop-up blocker
- Right-click → "Open Link in New Tab"

### "Modal won't close"
- Click X button or Cancel
- Click outside modal (not implemented, use buttons)
- Refresh page as last resort

---

## 🎉 WHAT YOUR BAND WILL LOVE

### Before (v2.3):
- Pick song → Pick version → Download → Find tabs manually
- No way to remember which tabs you liked
- Each band member finds tabs separately
- No lesson organization

### After (v2.4):
- Pick song → **Get tabs/lessons instantly** → Pick version → Download
- Every tab/lesson saved forever
- Each instrument has its own resources
- Organized lesson library per song

**It's like a personal practice database for each band member!**

---

## 📈 FUTURE ENHANCEMENTS (Ideas)

You could add later:
- [ ] **Export/Import** - Share resources with bandmates
- [ ] **Notes field** - Add personal practice notes
- [ ] **Practice log** - Track when you practiced each song
- [ ] **Setlist mode** - Show resources for tonight's setlist
- [ ] **Video thumbnails** - Show YouTube thumbnails
- [ ] **Auto-detect** - Parse YouTube video titles automatically
- [ ] **Spotify integration** - Add reference recordings from Spotify

---

## 💬 FEEDBACK & SUPPORT

If you encounter issues or want new features:
1. Check browser console for errors
2. Try the troubleshooting steps above
3. Test in different browser (Chrome, Firefox, Safari)
4. Contact me with specific error messages

---

## ✅ DEPLOYMENT CHECKLIST

Before you upload:
- [ ] Downloaded all 3 files (index.html, styles.css, app.js)
- [ ] Verified file sizes look reasonable (index ~15KB, styles ~20KB, app ~25KB)
- [ ] Read this entire guide
- [ ] Ready to test after upload

After you upload:
- [ ] Wait 2 minutes for GitHub Pages rebuild
- [ ] Hard refresh (Cmd+Shift+R)
- [ ] Test all 7 test scenarios above
- [ ] Try with your band members!

---

## 🎸 ROCK ON!

You now have a complete practice workflow tool:
✅ Song library (150+ songs)
✅ **Personal learning resources** (NEW!)
✅ Smart download extraction
✅ Moises.ai integration
✅ Setlist.fm links
✅ YouTube search

**Everything a band needs to learn songs efficiently!**

Upload those files and start saving your resources! 🚀

---

**Version:** v2.4
**Date:** February 13, 2026
**Feature:** Learning Resources System
**Files Changed:** index.html, styles.css, app.js
**Backward Compatible:** Yes (existing data.js unchanged)

**END OF GUIDE**
