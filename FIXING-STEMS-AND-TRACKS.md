# 🔧 FIXING STEMS & ADDING PRACTICE TRACKS

## 🎯 ISSUE #1: Stem Names Show "Stem1, Stem2, etc."

### ❌ Current Problem:
Your stems are showing as "Stem1, Stem2, Stem3, Stem4, Stem5" instead of "Bass, Drums, Guitar, Keys, Vocals"

### ✅ How to Fix:

**Step 1: Check Google Drive**
1. Go to: https://drive.google.com/drive/folders/1TsGjHAqAbvc_6MbARAQ-cGMhdGip9LnX
2. Look at the filenames or listen to each file
3. Identify which file is which instrument

**Step 2: Update data.js**

Find this section in data.js (around line 1152):
```javascript
stems: {
    // TO FIX: Check your Drive folder and assign each URL to the correct part
    bass: null,  // Replace with correct URL
    drums: null,  // Replace with correct URL
    guitar: null,  // Replace with correct URL  
    keys: null,  // Replace with correct URL
    vocals: null  // Replace with correct URL
}
```

**Step 3: Assign URLs to Correct Parts**

Example - if you find:
- File 1 = Bass
- File 2 = Drums
- File 3 = Guitar
- File 4 = Keys
- File 5 = Vocals

Then update to:
```javascript
stems: {
    bass: "https://drive.google.com/file/d/1U15OOxCLwKC98F5K-Hc2jGt8eZMZ98or/view?usp=sharing",
    drums: "https://drive.google.com/file/d/1oBkp9LOhdEGNeZ9J2XPh1jp-NBBV_ZRu/view?usp=sharing",
    guitar: "https://drive.google.com/file/d/1KaQDTcYB9ZPigvwVLukwZN23-tQfFbLd/view?usp=sharing",
    keys: "https://drive.google.com/file/d/1bE86lzxNJROqOeurU9a6qfejWnNf11oa/view?usp=sharing",
    vocals: "https://drive.google.com/file/d/1N0XO1NNO-kwEYt0trfxujplh85EII7VB/view?usp=sharing"
}
```

**Step 4: Upload & Test**
1. Upload updated data.js to GitHub
2. Wait 2 minutes
3. Hard refresh (Cmd+Shift+R)
4. Stems should now show proper names! ✅

---

## 🎵 ISSUE #2: Adding Practice Tracks with Thumbnails

### ✅ New Features:
- YouTube thumbnails automatically displayed
- Full video titles shown
- Instrument icons (🎸 🥁 🎹)
- Organized by part

### 📝 How to Add a Practice Track:

**Example: Adding a bass lesson**

```javascript
practiceTracks: {
    bass: [
        {
            title: "Tweezer Reprise Bass Lesson - Phish",  // Full video title
            youtubeUrl: "https://www.youtube.com/watch?v=ABC123",
            uploadedBy: "chris",
            dateAdded: "2024-02-15",
            notes: "Great breakdown of Mike's bass line"
        }
    ],
    leadGuitar: [
        {
            title: "Trey Anastasio Tweezer Reprise Solo Lesson",
            youtubeUrl: "https://www.youtube.com/watch?v=XYZ789",
            uploadedBy: "brian",
            dateAdded: "2024-02-15",
            notes: "Focuses on the solo section"
        }
    ],
    // ... other instruments
}
```

### 🎸 Instrument Categories:

Use these keys in `practiceTracks`:
- `bass` - Bass lessons
- `leadGuitar` or `lead_guitar` - Lead guitar
- `rhythmGuitar` or `rhythm_guitar` - Rhythm guitar
- `keys` or `keyboards` - Keyboard/piano
- `drums` - Drums
- `vocals` - Vocals

### 🖼️ What Shows Automatically:

For each track, the UI will automatically show:
- ✅ YouTube thumbnail (with play button overlay)
- ✅ Instrument icon (🎸 for guitar, 🥁 for drums, etc.)
- ✅ Instrument name (Bass, Lead Guitar, etc.)
- ✅ Full video title
- ✅ Your notes
- ✅ Who added it
- ✅ Play button that opens YouTube

---

## 📊 COMPLETE EXAMPLE

Here's a full example with multiple tracks:

```javascript
"Tweezer Reprise": {
    // ... other sections ...
    
    practiceTracks: {
        bass: [
            {
                title: "Tweezer Reprise - Bass Cover Tutorial",
                youtubeUrl: "https://www.youtube.com/watch?v=ABC123",
                uploadedBy: "chris",
                dateAdded: "2024-02-15",
                notes: "Slow breakdown of Mike's bass line"
            },
            {
                title: "Phish Bass Techniques - Tweezer Reprise",
                youtubeUrl: "https://www.youtube.com/watch?v=DEF456",
                uploadedBy: "chris",
                dateAdded: "2024-02-15",
                notes: "Advanced techniques and fills"
            }
        ],
        leadGuitar: [
            {
                title: "Trey's Tweezer Reprise Solo Breakdown",
                youtubeUrl: "https://www.youtube.com/watch?v=GHI789",
                uploadedBy: "brian",
                dateAdded: "2024-02-15",
                notes: "Solo section with tabs"
            }
        ],
        rhythmGuitar: [
            {
                title: "Tweezer Reprise Rhythm Guitar - Chord Shapes",
                youtubeUrl: "https://www.youtube.com/watch?v=JKL012",
                uploadedBy: "drew",
                dateAdded: "2024-02-15",
                notes: "Focus on the main riff"
            }
        ],
        drums: [
            {
                title: "Phish Drum Lesson - Tweezer Reprise",
                youtubeUrl: "https://www.youtube.com/watch?v=MNO345",
                uploadedBy: "jay",
                dateAdded: "2024-02-15",
                notes: "Fishman's groove breakdown"
            }
        ]
    }
}
```

---

## 🎯 WORKFLOW

### Finding & Adding Practice Tracks:

1. **Search YouTube:**
   - "Tweezer Reprise bass lesson"
   - "Tweezer Reprise guitar tutorial"
   - "Tweezer Reprise drum playthrough"

2. **Copy URL:**
   - Find good video
   - Copy full URL: `https://www.youtube.com/watch?v=...`

3. **Add to data.js:**
   - Choose correct instrument category
   - Paste full video title
   - Paste YouTube URL
   - Add your name
   - Add helpful notes

4. **Upload to GitHub:**
   - Commit: "Add practice tracks for Tweezer Reprise"
   - Wait 2 minutes
   - Hard refresh

5. **See It Live:**
   - Thumbnails show automatically ✅
   - Organized by instrument ✅
   - Full titles displayed ✅

---

## 🖥️ WHAT IT LOOKS LIKE

After adding tracks, each one displays as:

```
┌────────────────────────────────────┐
│  [YouTube Thumbnail with ▶ button] │
│                                     │
│  🎸 Lead Guitar                     │
│  Trey's Tweezer Reprise Solo       │
│  Breakdown                          │
│                                     │
│  Solo section with tabs            │
│                                     │
│  [▶ Watch Lesson]                  │
│                                     │
│  Added by brian                     │
└────────────────────────────────────┘
```

---

## ✅ CHECKLIST

### For Stems:
- [ ] Check Drive folder to identify each file
- [ ] Update data.js with correct assignments
- [ ] Upload to GitHub
- [ ] Verify stems show as "Bass, Drums, Guitar, Keys, Vocals"

### For Practice Tracks:
- [ ] Find YouTube lessons for each instrument
- [ ] Copy full video titles
- [ ] Copy YouTube URLs
- [ ] Add to correct instrument category in data.js
- [ ] Upload to GitHub
- [ ] Verify thumbnails and titles display correctly

---

## 🚀 READY!

Once you:
1. Identify which stem is which
2. Update data.js with correct names
3. Add a few practice tracks

Your Band Resources page will be **COMPLETE** with:
- ✅ Named stems (Bass, Drums, etc.)
- ✅ Practice tracks with thumbnails
- ✅ Full video titles
- ✅ Organized by instrument
- ✅ Professional look

Upload the updated data.js and you're done! 🎸
