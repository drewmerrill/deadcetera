# 🎸 MUSICIAN FEATURES - DATA ENTRY GUIDE

## ✅ WHAT'S IMPLEMENTED

Your app now displays these musician-focused features for each version:

### **1. 🎵 Musical Info**
- **Key** - What key the song is in (e.g., "E minor", "G major")
- **BPM** - Tempo in beats per minute (e.g., 128)
- **Length** - Duration of the version (e.g., "9:47")

### **2. ⭐ Difficulty Rating**
- **1 Star** (Beginner) - Straightforward, great for learning
- **2 Stars** (Intermediate) - Some complexity, extended jams
- **3 Stars** (Advanced) - Complex jams, odd time signatures

### **3. 💡 Practice Notes**
- 1-2 sentences explaining what makes this version good for musicians
- Technical tips, tone notes, what to focus on

### **4. ✨ Features Tags**
- Short descriptive tags (e.g., "Extended jam", "Peak tone", "Type II exploration")

### **5. 🔗 Resource Links**
- **🎧 Stream** - Relisten.net link to listen before downloading
- **📊 Ratings** - HeadyVersion (GD), Phish.net (Phish), or PanicStream (WSP)
- **🎵 Chords** - Rukind.com or Ultimate Guitar chords
- **🎸 Tabs** - Ultimate Guitar tablature

---

## 📋 WHAT'S DONE (2 songs as examples)

I've fully populated **Althea (rank 1 & 2)** to show you how it looks. These have ALL the new fields filled in.

---

## 📝 TO-DO: Add Data for Remaining 58 Versions

You need to add these fields to all other versions. Here's the template:

```javascript
{
    rank: 1,
    venue: "Venue Name, City ST",
    date: "Month Day, Year",
    archiveId: "gd1981-03-14",
    notes: "Existing notes...",
    trackNumber: "08",
    quality: "SBD",
    
    // ADD THESE FIELDS:
    bpm: 128,                    // Required: Tempo (use metronome/BPM detector)
    key: "E minor",              // Required: Musical key
    length: "9:47",              // Required: Get from Archive.org
    difficulty: 2,               // Required: 1, 2, or 3
    practiceNotes: "Why this version is great for learning...",  // Required
    features: ["Tag 1", "Tag 2", "Tag 3"],  // Required: 2-4 tags
    relistenLink: "https://relisten.net/...",  // Required
    headyversionLink: "https://...",  // Optional (GD only)
    phishnetLink: "https://...",      // Optional (Phish only)
    panicstreamLink: "https://...",   // Optional (WSP only)
    chordsLink: "https://...",        // Required
    tabsLink: "https://..."           // Required
}
```

---

## 🎯 STEP-BY-STEP GUIDE

### **STEP 1: Find BPM**
1. Go to Archive.org and play the version
2. Use online BPM detector: https://www.all8.com/tools/bpm.htm
3. Or tap along with a metronome app
4. Round to nearest whole number

### **STEP 2: Determine Key**
1. If you know music theory, listen and determine
2. Or search "[Song Name] key" on Google
3. Most Dead/JGB songs have consistent keys
4. Format: "E minor", "G major", "D major"

### **STEP 3: Get Length**
1. Go to Archive.org page for the show
2. Look at individual track listings
3. Copy the length (e.g., "9:47")

### **STEP 4: Set Difficulty**
- **1 (Beginner):** Standard structure, no odd time, good learning song
- **2 (Intermediate):** Some jams, but manageable complexity
- **3 (Advanced):** Extended Type II jams, odd meters, very complex

**Examples:**
- Althea = 2 (intermediate jams)
- You Enjoy Myself = 3 (complex, odd times, 7/4 sections)
- Shakedown Street = 1 (straightforward funk groove)

### **STEP 5: Write Practice Notes**
Write 1-2 sentences about WHY this version is good for musicians:
- Tone characteristics
- Technical elements to focus on
- What makes it a good learning version

**Good examples:**
- "Perfect for learning Jerry's melodic soloing style. Extended outro jam showcases his signature '81 tone."
- "Faster tempo than usual - great for working on speed and tightness."
- "Mid-tempo groove. Great for learning the Panic pocket and JoJo's organ style."

### **STEP 6: Add Features Tags**
2-4 short descriptive tags. Examples:
- "Extended outro jam"
- "Peak Jerry tone"
- "Type II exploration"
- "Guest appearance: Bruce Hornsby"
- "Epic 20+ minute version"
- "Vocal jam section"

### **STEP 7: Generate Relisten Link**
Format: `https://relisten.net/[band]/[date]/[song-slug]`

**Examples:**
- GD: `https://relisten.net/grateful-dead/1981/03/14/althea`
- Phish: `https://relisten.net/phish/1993/08/13/you-enjoy-myself`
- WSP: `https://relisten.net/widespread-panic/2011/07/31/porch-song`
- JGB: `https://relisten.net/jerry-garcia-band/1990/02/10/simple-twist-of-fate`

**Song slug:** Lowercase, hyphens instead of spaces
- "Althea" → "althea"
- "You Enjoy Myself" → "you-enjoy-myself"
- "Porch Song" → "porch-song"

### **STEP 8: Add Rating Site Links**

**Grateful Dead - HeadyVersion:**
- Go to https://www.headyversion.com/
- Search for the song
- Copy the URL (e.g., `https://www.headyversion.com/song/6/grateful-dead/althea/`)

**Phish - Phish.net:**
- Format: `https://phish.net/song/[song-slug]/history`
- Example: `https://phish.net/song/you-enjoy-myself/history`

**Widespread Panic - PanicStream:**
- Use: `https://www.panicstream.com/vault/widespread-panic/`
- (This is their main vault page - no song-specific pages)

### **STEP 9: Find Chords**

**For Grateful Dead/JGB:**
- Try Rukind first: `https://www.rukind.com/gdead/lyrics/[song].html`
- Example: `https://www.rukind.com/gdead/lyrics/althea.html`

**For all bands:**
- Search Ultimate Guitar: https://www.ultimate-guitar.com/
- Search "[Band Name] [Song] chords"
- Copy the URL

### **STEP 10: Find Tabs**
- Search Ultimate Guitar: https://www.ultimate-guitar.com/
- Search "[Band Name] [Song] tabs"
- Look for highest-rated version
- Copy the URL

---

## ⚡ QUICK TIPS

### **Batch Processing:**
1. Do all BPMs first (requires listening)
2. Do all keys next (often consistent per song)
3. Do all Relisten links (formulaic)
4. Do all chords/tabs links (search-based)
5. Write practice notes last (requires thought)

### **Common Keys:**
- **Althea:** E minor
- **Scarlet Begonias:** G major
- **Shakedown Street:** A major
- **You Enjoy Myself:** D major (multiple sections)
- **Porch Song:** G major

### **Difficulty Guidelines:**
- Most straightforward songs = 1
- Songs with extended jams but standard structure = 2
- YEM, complex Phish, Type II Dead = 3

---

## 🎯 PRIORITY ORDER

If you don't want to do all 60 versions right away, prioritize:

1. **Top 3 of each song** (30 versions) - Most commonly chosen
2. **Resource links** (quick, very valuable)
3. **BPM/Key/Length** (medium effort, high value)
4. **Practice notes** (time-consuming but awesome)

---

## 📊 CURRENT STATUS

**Completed:** 2 / 60 versions (Althea #1 & #2)
**Remaining:** 58 versions need data

**Estimated time per version:** 10-15 minutes
**Total estimated time:** 10-15 hours (can be done in batches!)

---

## 🚀 WHEN YOU'RE DONE

After adding data:
1. Upload data.js to GitHub
2. Test on your site
3. Version cards will show all the new musician features!
4. Your bandmates will LOVE the detailed info!

---

## 💡 NEED HELP?

If you want help researching specific versions, let me know! I can look up:
- BPM (from recordings)
- Keys (music theory)
- Resource links (searching databases)

Just tell me which songs/versions you want me to research!
