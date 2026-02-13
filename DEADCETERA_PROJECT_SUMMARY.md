# DEADCETERA - Song Practice Workflow App
## Project Summary & Status Report

**Last Updated:** February 13, 2026  
**Current Version:** v2.3  
**Status:** Core functionality working, ongoing refinements

---

## 🎯 PROJECT OVERVIEW

Deadcetera is a web application that helps musicians practice Grateful Dead, Jerry Garcia Band, Phish, and Widespread Panic songs by:

1. **Finding the best versions** of any song (curated + Archive.org search)
2. **Smart Download** - Automatically extracting just the song from full show recordings
3. **Uploading to Moises.ai** - For stem separation (bass, drums, vocals, guitar)
4. **Practice workflow** - Complete end-to-end from song selection to practice

---

## 📦 FILES IN PROJECT

### Core Files:
- `index.html` - Main page structure, UI layout
- `app.js` - Main application logic, UI interactions (v2.3)
- `audio-splitter.js` - Audio extraction engine, Archive.org API integration
- `data.js` - Curated "Top 5" versions database for popular songs
- `styles.css` - Styling and animations

### Additional Files:
- `DEADCETERA_PROJECT_SUMMARY.md` - This file (project documentation)

---

## ✅ FEATURES IMPLEMENTED

### 1. **Song Selection & Search**
- ✅ Search/filter 150+ songs across 4 bands (GD, JGB, Phish, WSP)
- ✅ Band filter buttons
- ✅ Real-time search
- ✅ Handles apostrophes in song titles (v2.3 fix)

### 2. **Version Discovery**
- ✅ Curated "Top 5" versions from data.js
- ✅ Live Archive.org search for any song
- ✅ Sorted by popularity (downloads + ratings)
- ✅ Version cards with venue, date, quality indicators

### 3. **Smart Download (Track Extraction)**
Four-strategy intelligent system:
- ✅ **Strategy 1:** Song name in filename (e.g., "alabama-getaway.mp3")
- ✅ **Strategy 2:** Track number match (e.g., "d1t08.mp3" for track 8)
- ✅ **Strategy 3:** Fuzzy song name matching
- ✅ **Strategy 4:** Sequential counting (for Archive search results)

### 4. **Archive.org Integration**
- ✅ Best version scoring algorithm (SBD > AUD, FLAC > MP3, known tapers)
- ✅ Automatic version mismatch detection
- ✅ File size filtering (skips crowd/tuning tracks < 3MB)
- ✅ Multi-format support (MP3, FLAC, WAV)

### 5. **Setlist.fm Integration**
- ✅ Auto-detect track position via Relisten API
- ✅ Band detection from Archive ID (GD, Phish, JGB, WSP)
- ✅ Manual fallback with Setlist.fm link
- ✅ User override option

### 6. **Preview & Iteration**
- ✅ Audio preview player before download
- ✅ File size indicator (warns if < 1MB)
- ✅ Next/Previous track buttons
- ✅ Three action buttons: Cancel, Download, Moises

### 7. **Error Handling & UX**
- ✅ Comprehensive error messages
- ✅ Loading spinners
- ✅ Console debugging logs
- ✅ Graceful fallbacks for API failures

---

## 🐛 BUGS FIXED (Latest Session)

### v2.3 (Feb 13, 2026):
- ✅ **Apostrophe escaping** - Songs like "Ain't No Bread" now clickable
- ✅ **Band detection** - Phish/WSP/JGB shows now open correct Setlist.fm
- ✅ **Button handlers** - Download/Moises buttons with DOM ready check
- ✅ **Archive version mismatch** - Detects when Archive returns wrong version

### v2.2 (Feb 12, 2026):
- ✅ Band detection enhanced (checks anywhere in Archive ID, not just start)
- ✅ Added "pt" prefix detection for Phish shows

### v2.1 (Feb 12, 2026):
- ✅ Setlist.fm auto-lookup with Relisten API
- ✅ Manual fallback dialog with clickable link
- ✅ Small file detection (< 1MB warning)

### Previous Fixes:
- ✅ Archive.org search result downloads
- ✅ Sequential track counting for shows without song names
- ✅ Step number circles (1, 2, 3 instead of "Step 1")
- ✅ Timestamp extraction accuracy
- ✅ FLAC detection issues
- ✅ Browser caching problems

---

## 🔧 TECHNICAL ARCHITECTURE

### Audio Extraction Pipeline:
```
1. User selects song & version
2. Fetch Archive.org metadata
3. Try Strategy 1-4 to find track file
4. If found: Direct download
5. If not: Download full show + extract via Web Audio API
6. Generate blob → Preview player
7. User confirms → Download/Upload to Moises
```

### Archive.org Version Scoring:
```
Points System:
+100: Soundboard (SBD) quality
+40:  FLAC format
+30:  Known quality tapers (Miller, Bertha, etc.)
+20:  MP3 available
-50:  Audience recording
-30:  Problem versions (.motb.0029, .shnf)
+0-100: Download popularity
```

### Band Detection Logic:
```javascript
if (archiveId includes 'phish' OR starts with 'pt') → Phish
else if (includes 'jgb' OR 'garcia') → Jerry Garcia Band
else if (includes 'wsp' OR 'widespread' OR 'panic') → Widespread Panic
else if (starts with 'gd' OR includes 'grateful' OR 'dead') → Grateful Dead
else → Default to Grateful Dead
```

---

## 📊 CURRENT STATUS

### ✅ Working Features:
- Song search and filtering
- Version selection (curated + Archive.org)
- Smart Download for most shows
- Preview player with next/prev buttons
- Setlist.fm integration (with Relisten API)
- Band detection (all 4 bands)
- Apostrophe handling

### ⚠️ Known Limitations:
- Setlist.fm doesn't have all shows (fallback to manual)
- Some Archive.org shows only have crowd/tuning tracks
- Web Audio API limitations for very long shows (>2 hours)
- Download button occasionally needs DOM ready timeout

### 🔄 In Progress:
- Testing with more Phish/WSP/JGB shows
- Refinining error messages
- Additional debugging for edge cases

---

## 🎯 NEXT STEPS / TODO

### High Priority:
1. Test with various Phish shows (check Archive ID formats)
2. Verify Relisten API works for all 4 bands
3. Test "46 Days" issue user reported
4. Add more curated versions to data.js

### Medium Priority:
5. Add JGB/Phish/WSP curated versions to data.js
6. Improve loading states and progress indicators
7. Add keyboard shortcuts (Enter to search, etc.)
8. Better mobile responsive design

### Future Enhancements:
9. Audio boundary detection (trim silence)
10. Batch download multiple songs
11. Save favorite versions
12. Practice session tracker
13. Integration with other stem separation tools

---

## 🚀 DEPLOYMENT

**Current Location:** GitHub Pages  
**URL:** drewmerrill.github.io/deadcetera/  

**To Update:**
1. Replace files on GitHub repo
2. Wait ~1 minute for GitHub Pages to rebuild
3. Hard reload browser (Cmd+Shift+R) to clear cache

**Cache Busting:**
- Version number in app.js header
- Users should hard reload after updates

---

## 🔍 DEBUGGING TIPS

### Console Logging:
- All major functions log to console
- Look for: ✅ (success), ❌ (error), ⚠️ (warning), 🔍 (debug)
- Strategy execution shows which methods were tried

### Common Issues:
1. **Buttons don't work** → Check console for "Buttons not found in DOM"
2. **Wrong band in Setlist.fm** → Check console for "Detected band: ..."
3. **File too small** → Archive version has only crowd/tuning tracks
4. **Song won't click** → Apostrophe escaping issue (fixed in v2.3)

### Testing Checklist:
- [ ] Grateful Dead song (Alabama Getaway)
- [ ] Phish song (46 Days)
- [ ] JGB song (Ain't No Bread)
- [ ] WSP song (Ain't Life Grand)
- [ ] Song with apostrophe
- [ ] Archive search result vs curated version

---

## 📝 USER WORKFLOW

### Typical Usage:
1. **Search** for song (e.g., "Alabama Getaway")
2. **Select** from dropdown
3. **Choose version** (curated Top 5 or Archive search)
4. **Click Smart Download**
5. **Auto-detect** track position (or enter manually)
6. **Preview** the track
7. **Download** or **Open in Moises**
8. **Practice!**

### For Archive Search Results:
1. Search Archive.org for song
2. Click result
3. Smart Download tries auto-position detection
4. If fails: Opens Setlist.fm + manual entry
5. Preview shows file size (warns if wrong)
6. Use Next/Prev buttons to find correct track

---

## 💡 LESSONS LEARNED

1. **Archive.org Quirks:**
   - Returns files from different versions than requested
   - File naming conventions vary wildly
   - Need multiple fallback strategies

2. **Setlist.fm Limitations:**
   - Not all shows in database
   - API requires authentication
   - Relisten is better for auto-detection

3. **JavaScript Escaping:**
   - Apostrophes in song titles break onclick
   - Must escape with backslash in template literals

4. **Browser Caching:**
   - Users need hard reload to see updates
   - Version numbers help track changes

5. **User Testing:**
   - Edge cases reveal issues (Phish, apostrophes)
   - Real-world testing > simulated scenarios

---

## 🎸 BAND-SPECIFIC NOTES

### Grateful Dead:
- Most complete database
- Best Archive.org coverage
- Relisten API works great

### Phish:
- Archive IDs may start with "pt" not "phish"
- Setlist.fm sometimes incomplete
- Need more testing

### Jerry Garcia Band:
- Fewer Archive.org shows
- Some in "Garcia" collections
- Need more curated versions

### Widespread Panic:
- Archive IDs: "wsp" prefix
- Good Archive.org coverage
- Need more curated versions

---

## 📧 CONTACT / SUPPORT

For issues or questions, check:
1. Console logs (Cmd+Option+J)
2. This documentation
3. Code comments in app.js

---

## 🙏 CREDITS

- Archive.org for hosting live music
- Relisten.net for setlist API
- Setlist.fm for setlist data
- Moises.ai for stem separation
- HeadyVersion.com for version ratings

---

**END OF SUMMARY**
