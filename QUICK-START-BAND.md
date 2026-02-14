# 🎸 QUICK START - Band Knowledge System

## ✅ WHAT'S READY

I've integrated the collaborative band system into your Deadcetera app!

**Your Google Drive folder is connected:**
https://drive.google.com/drive/folders/1ooMNihe08o08RKy11q617iqYoFJKaa32

**First song set up:** Tweezer Reprise (as example)

---

## 🚀 IMMEDIATE NEXT STEPS

### Step 1: Upload the New data.js
1. Download `data.js` from outputs
2. Upload to GitHub (replace old one)
3. Wait 2 minutes for rebuild
4. Hard refresh your site (Cmd+Shift+R)

### Step 2: Fill in Tweezer Reprise Details

Open the `data.js` file and find the "Tweezer Reprise" section. Fill in:

**A) Spotify Version:**
```javascript
spotifyUrl: "PASTE_YOUR_SPOTIFY_URL_HERE",
```

**B) Vote for it:**
```javascript
votes: {
    brian: false,
    chris: false,
    drew: true,  // ← Change to true for yourself!
    pierce: false,
    jay: false
},
```

**C) Create Google Doc for Chord Chart:**
1. Go to https://docs.google.com
2. Create new document
3. Title it: "Tweezer Reprise - Chord Chart"
4. Import chords from Ultimate Guitar or type them
5. Share with band members (Editor access)
6. Copy the document ID from URL:
   - URL: `https://docs.google.com/document/d/ABC123XYZ/edit`
   - ID: `ABC123XYZ`
7. Add to data.js:
```javascript
googleDocId: "ABC123XYZ",
editUrl: "https://docs.google.com/document/d/ABC123XYZ/edit",
viewUrl: "https://docs.google.com/document/d/ABC123XYZ/view",
```

**D) Upload Moises Stems:**
1. Go to https://moises.ai
2. Upload Tweezer Reprise (from Spotify/YouTube)
3. Separate tracks
4. Download: bass.mp3, drums.mp3, guitar.mp3, keys.mp3, vocals.mp3
5. Upload to your Google Drive folder:
   - Create folder: `Moises Stems/Tweezer Reprise/`
   - Upload all 5 stems
6. Get links for each file (right-click → Get link → Anyone with link)
7. Add to data.js:
```javascript
stems: {
    bass: "https://drive.google.com/file/d/...",
    drums: "https://drive.google.com/file/d/...",
    guitar: "https://drive.google.com/file/d/...",
    keys: "https://drive.google.com/file/d/...",
    vocals: "https://drive.google.com/file/d/..."
}
```

---

## 📁 GOOGLE DRIVE FOLDER STRUCTURE

Set up your folders like this:

```
Deadcetera Band Resources/
├── Moises Stems/
│   └── Tweezer Reprise/
│       ├── bass.mp3
│       ├── drums.mp3
│       ├── guitar.mp3
│       ├── keys.mp3
│       └── vocals.mp3
├── Band Recordings/
│   └── 2024-02-14 Practice/
├── Harmony References/
│   └── (upload short clips here)
└── Chord Charts/
    └── (PDFs as backup)
```

---

## 🎯 HOW BAND MEMBERS USE IT

### Adding a Spotify Version:
1. Find version on Spotify
2. Share → Copy Song Link
3. Text you the link
4. You add to data.js:
```javascript
{
    id: "version_2",
    title: "12/29/18 MSG",
    spotifyUrl: "PASTE_URL",
    votes: { brian: false, chris: false, drew: false, pierce: false, jay: false },
    totalVotes: 0,
    isDefault: false,
    addedBy: "pierce",
    notes: "Slower, more groove-oriented"
}
```
5. Push to GitHub
6. Everyone can now vote!

### Voting on Versions:
1. Each person tells you their vote
2. You update data.js:
```javascript
votes: {
    brian: true,   // ← Brian voted yes
    chris: true,   // ← Chris voted yes
    drew: true,    // ← Drew voted yes
    pierce: false, // ← Pierce voted no
    jay: true      // ← Jay voted yes
},
totalVotes: 4,     // ← Count the trues
```
3. If 3+ votes (majority), mark as default:
```javascript
isDefault: true,  // ← This becomes THE version!
```

### Adding Practice Tracks:
1. Member creates backing track (no bass, no guitar, etc.)
2. Uploads to YouTube
3. Texts you the link
4. You add to data.js:
```javascript
practiceTracks: {
    bass: [
        {
            title: "No Bass Backing Track",
            youtubeUrl: "https://youtube.com/watch?v=...",
            uploadedBy: "drew",
            dateAdded: "2024-02-14",
            notes: "Created from A Live One version"
        }
    ]
}
```

### Adding Harmony Notes:
After practice, anyone can text you:
- "Verse harmony: Pierce comes in too early on 'freezer'"
- You add to practiceNotes array in that harmony section
- Push to GitHub
- Everyone sees it next time!

### Adding Rehearsal Notes:
After practice:
```javascript
rehearsalNotes: [
    {
        date: "2024-02-14",
        author: "drew",
        note: "Outro harmony timing rough, needs 5x run-through",
        priority: "high"
    }
]
```

---

## 🎨 NEXT: BUILD THE UI

Right now, the data is in `data.js` but there's no UI to display it yet.

**Next session, I'll build:**
1. Band Resources page (replaces personal saves)
2. Spotify voting interface
3. Harmony tracker display
4. Practice tracks library
5. Moises stems download buttons
6. Rehearsal notes timeline
7. iPad Gig View mode

**For now:**
- Focus on filling in Tweezer Reprise data
- Get band members to vote on Spotify version
- Upload stems to Google Drive
- Create Google Doc for chord chart

---

## 📝 TEMPLATE FOR ADDING MORE SONGS

Copy this template when adding new songs:

```javascript
"Song Name Here": {
    artist: "Phish",  // or "Grateful Dead", etc.
    
    chordChart: {
        googleDocId: null,
        editUrl: null,
        viewUrl: null,
        ultimateGuitarUrl: "",
        lastUpdated: null,
        updatedBy: null,
        bandNotes: []
    },
    
    spotifyVersions: [],
    
    practiceTracks: {
        bass: [],
        leadGuitar: [],
        rhythmGuitar: [],
        keys: [],
        drums: []
    },
    
    moisesParts: {
        sourceVersion: "",
        googleDriveFolder: "https://drive.google.com/drive/folders/1ooMNihe08o08RKy11q617iqYoFJKaa32",
        stems: {
            bass: null,
            drums: null,
            guitar: null,
            keys: null,
            vocals: null
        }
    },
    
    harmonies: {
        sections: [],
        generalNotes: []
    },
    
    structure: {
        tempo: 0,
        key: "",
        timeSignature: "4/4",
        form: ""
    },
    
    rehearsalNotes: [],
    gigNotes: []
}
```

---

## ✅ SUCCESS METRICS

You'll know it's working when:
- ✅ data.js uploads without errors
- ✅ Band members can access Google Drive folder
- ✅ Stems upload to Drive successfully
- ✅ Google Doc chord chart is editable by all
- ✅ Everyone agrees on ONE Spotify version
- ✅ Harmony confusion eliminated

---

## 🎸 READY TO TEST!

1. Upload the new `data.js`
2. Add your Spotify URL for Tweezer Reprise
3. Create the Google Doc chord chart
4. Upload one stem to test Drive permissions
5. Share with band!

Next session: I'll build the beautiful UI to display all this! 🚀
