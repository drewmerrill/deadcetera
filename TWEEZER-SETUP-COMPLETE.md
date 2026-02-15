# 🎸 Tweezer Reprise - SETUP COMPLETE!

## ✅ WHAT'S DONE

You've successfully set up the first collaborative song in your band system!

### Google Drive Structure ✅
**Main Band Folder:**
https://drive.google.com/drive/folders/1ooMNihe08o08RKy11q617iqYoFJKaa32

**Tweezer Reprise Stems Folder:**
https://drive.google.com/drive/folders/1TsGjHAqAbvc_6MbARAQ-cGMhdGip9LnX

**All 5 Moises Stems Uploaded:**
1. Stem 1: https://drive.google.com/file/d/1U15OOxCLwKC98F5K-Hc2jGt8eZMZ98or/view
2. Stem 2: https://drive.google.com/file/d/1oBkp9LOhdEGNeZ9J2XPh1jp-NBBV_ZRu/view
3. Stem 3: https://drive.google.com/file/d/1KaQDTcYB9ZPigvwVLukwZN23-tQfFbLd/view
4. Stem 4: https://drive.google.com/file/d/1bE86lzxNJROqOeurU9a6qfejWnNf11oa/view
5. Stem 5: https://drive.google.com/file/d/1N0XO1NNO-kwEYt0trfxujplh85EII7VB/view

---

## 📝 STEM LABELING

**Pro Tip:** Rename your files in Google Drive so everyone knows which is which!

**Current:** The files are named generically
**Recommended:**
1. Go to the Tweezer Reprise folder
2. Rename each file:
   - `bass.mp3`
   - `drums.mp3`
   - `guitar.mp3` (or `lead-guitar.mp3`)
   - `keys.mp3`
   - `vocals.mp3`

This way when band members download, they know what they're getting!

---

## 🎯 NEXT STEPS TO COMPLETE THE SONG

### 1. Add Spotify Reference Version
**What you need:**
- Go to Spotify
- Find your favorite Tweezer Reprise version
- Share → Copy Song Link
- Add to data.js in the `spotifyUrl` field

**Where to add it:**
```javascript
spotifyVersions: [
    {
        id: "version_1",
        title: "A Live One - 12/31/94 Boston",  // Update this to match your version
        spotifyUrl: "PASTE_YOUR_SPOTIFY_LINK_HERE",  // ← Add here!
        votes: {
            brian: false,
            chris: false,
            drew: true,  // ← You can vote for yourself!
            pierce: false,
            jay: false
        }
    }
]
```

### 2. Create Google Doc Chord Chart
**Steps:**
1. Go to https://docs.google.com
2. New Document
3. Title: "Tweezer Reprise - Chord Chart"
4. Copy chords from Ultimate Guitar: 
   https://tabs.ultimate-guitar.com/tab/phish/tweezer-reprise-chords-1234567
5. Add band notes (Drew: watch the transition, Brian: solo is 16 bars, etc.)
6. Share with band (brian@, chris@, pierce@, jay@ emails)
7. Copy document ID from URL
8. Add to data.js

### 3. Get Band to Vote
**Share with band:**
1. Send them the Spotify link
2. Each person votes yes/no
3. You update data.js with votes
4. When 3+ vote yes → mark as `isDefault: true`

### 4. Add Harmony Details
**After your next practice:**
1. Note who sang what
2. Add timing notes
3. Mark which sections sound good
4. Mark which need work
5. Update data.js

---

## 📊 YOUR DATA.JS IS READY

The updated data.js has:
- ✅ All 5 Moises stems linked
- ✅ Google Drive folders connected
- ✅ Band member structure (Brian, Chris, Drew, Pierce, Jay)
- ✅ Harmony tracking template
- ✅ Practice tracks placeholders
- ✅ Rehearsal notes structure
- ✅ Gig tips section

**File status:** ✅ No syntax errors, ready to upload!

---

## 🚀 DEPLOYMENT

**Upload to GitHub:**
1. Download `data.js` from outputs
2. Go to https://github.com/drewmerrill/deadcetera
3. Click `data.js`
4. Edit file
5. Replace all content
6. Commit: "Add band knowledge system + Tweezer Reprise stems"
7. Wait 2 minutes
8. Hard refresh your site

**Test:**
1. Go to your Deadcetera site
2. Select "Tweezer Reprise"
3. (UI not built yet, but data is ready!)

---

## 🎨 NEXT: BUILD THE UI

When you're ready, I'll build:

**Band Resources Page:**
- Spotify version voting UI
- Moises stems download buttons
- Practice tracks library
- Harmony tracker display
- Rehearsal notes timeline
- Chord chart embed
- iPad Gig View mode

**Features:**
- Click stems to download
- Vote on Spotify versions
- Add harmony notes
- Add practice tracks
- View chord chart on iPad during gigs

---

## 👥 SHARE WITH BAND

**Send this to your bandmates:**

> Hey band! 🎸
> 
> I've set up a new system for our song resources. Check out the Tweezer Reprise folder:
> https://drive.google.com/drive/folders/1TsGjHAqAbvc_6MbARAQ-cGMhdGip9LnX
> 
> All the Moises stems are separated and ready to download - just grab your part!
> 
> Next: We'll vote on which Spotify version to use as our reference.
> 
> - Drew

---

## 🎯 SUCCESS!

You've completed the hardest part - setting up the infrastructure!

**What's working:**
- ✅ Google Drive organized
- ✅ Stems uploaded and accessible
- ✅ Data structure in place
- ✅ Band members configured
- ✅ Ready for collaboration

**Next session:**
Build the beautiful UI to make this all interactive! 🚀

---

## 💡 TIPS FOR OTHER SONGS

When you're ready to add more songs:

1. Create folder in Drive: `Moises Stems/[Song Name]/`
2. Separate in Moises
3. Upload 5 stems
4. Copy the template in data.js
5. Add the stem links
6. Push to GitHub

You've got the workflow down! 🎸
