# 📻 How to Find Archive.org Download Links

## When Adding a New Song to Deadcetera

When you add a new song, you'll want to include direct download links so bandmates can grab MP3s easily. Here's how to find them:

---

## Step 1: Search for Your Song

1. Go to: **https://archive.org**
2. Search: `Grateful Dead "Song Name Here"`
   - Example: `Grateful Dead "Scarlet Begonias"`
3. Click on a show that looks good (look for "soundboard" or "sbd" in the title for best quality)

---

## Step 2: Find the Song in the Show

1. You'll see a list of tracks from that show
2. Look for your song title in the track listing
3. Note which track number it is (like Track 3, Track 7, etc.)

---

## Step 3: Get the Download URL

### Method 1: Click "VBR MP3" (Easiest)
1. On the right side, look for file formats
2. Click **"VBR MP3"** or **"MP3"**
3. Find your track in the list
4. **Right-click** on the track filename
5. Choose **"Copy Link Address"** (or "Copy Link")
6. That's your `downloadUrl`!

### Method 2: Build it Manually
The URL pattern is:
```
https://archive.org/download/[SHOW-ID]/[FILENAME].mp3
```

Example:
- Show page: `https://archive.org/details/gd77-05-08.sbd.hicks.4982.sbeok.shnf`
- Show ID: `gd77-05-08.sbd.hicks.4982.sbeok.shnf`
- Filename: `gd77-05-08d1t03.mp3` (track 3 from disc 1)
- Full URL: `https://archive.org/download/gd77-05-08.sbd.hicks.4982.sbeok.shnf/gd77-05-08d1t03.mp3`

---

## Step 4: Get the Archive Search URL

To create a search that finds ALL versions of a song:

**Template:**
```
https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22SONG+NAME%22&sort=-downloads
```

**Example for "Scarlet Begonias":**
```
https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22Scarlet+Begonias%22&sort=-downloads
```

**Rules:**
- Replace spaces in song name with `+`
- Keep quotes around "Grateful Dead" and the song name
- The `%22` is code for quotation marks
- The `%3A` is code for colon
- `&sort=-downloads` shows most popular first

---

## Step 5: Add to Your Song

In `songs-data.js`, add these fields:

```javascript
archiveReferences: [
    {
        venue: "Barton Hall, Cornell",
        date: "May 8, 1977",
        url: "https://archive.org/details/gd77-05-08.sbd.hicks.4982.sbeok.shnf",
        notes: "Legendary show, excellent sound quality",
        downloadUrl: "https://archive.org/download/gd77-05-08.sbd.hicks.4982.sbeok.shnf/gd77-05-08d1t03.mp3"
    }
],

archiveSearchUrl: "https://archive.org/search.php?query=creator%3A%22Grateful+Dead%22+AND+%22Friend+of+the+Devil%22&sort=-downloads"
```

---

## Quick Tips:

✅ **Look for "sbd" (soundboard)** - Best quality  
✅ **Popular shows** - Cornell '77, Europe '72, Veneta '72  
✅ **Check track lengths** - Make sure you're getting the right song  
✅ **Test the link** - Click it before adding to make sure it works  

---

## What Your Bandmates See:

When you add these fields, bandmates will see:
- **"Download MP3"** button - One click downloads the file
- **"Find More Recordings"** button - Searches Archive.org for that specific song

Then they just:
1. Click "Download MP3"
2. File saves to their computer
3. Upload that file to Moises.ai
4. Separate the stems!

---

**Need Help?** Just ask - I can help you find download URLs for any Dead song!
