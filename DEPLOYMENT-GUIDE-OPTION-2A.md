# 🚀 OPTION 2A DEPLOYMENT GUIDE
## Archive.org + YouTube (100% FREE!)

---

## ✅ WHAT'S READY:

I've built the complete integration! Here's what you have:

### **Files Ready to Upload:**
1. **index.html** - Updated with Smart Download + YouTube buttons
2. **app.js** - Full integration with audio splitter + YouTube
3. **styles.css** - New styles for modals, progress, YouTube
4. **audio-splitter.js** - Archive.org extraction engine
5. **data.js** - Your songs database (unchanged)

### **Backend Files (Deploy Later):**
6. **cloudflare-worker.js** - YouTube API gateway
7. **youtube-dl-server.py** - YouTube download server
8. **requirements.txt** - Python dependencies

---

## 🎯 PHASE 1: ARCHIVE.ORG SMART DOWNLOAD (Works NOW!)

### **Step 1: Upload Files to GitHub**

Upload these 5 files using GitHub Desktop:
1. `index.html`
2. `app.js`
3. `styles.css`
4. `audio-splitter.js`
5. `data.js` (if you haven't uploaded the latest one)

### **Step 2: Test Archive.org Extraction**

1. Go to your site (wait 2 mins for rebuild)
2. Search "Althea"
3. Click version
4. **Click green "⚡ Smart Download" button**
5. Wait 1-2 minutes
6. Downloads WAV file (~10-15 MB)
7. Upload to Moises!

**THAT'S IT! Archive.org extraction works NOW without any backend!**

---

## 🎥 PHASE 2: YOUTUBE INTEGRATION (Deploy Backend - FREE)

### **Prerequisites:**
- Free Cloudflare account
- Free Render account
- Free YouTube Data API key

---

### **STEP A: Get YouTube API Key (5 mins)**

1. Go to: https://console.cloud.google.com/
2. Create new project: "Deadcetera YouTube"
3. Enable "YouTube Data API v3"
4. Create credentials → API Key
5. Copy the API key (looks like: `AIzaSy...`)

---

### **STEP B: Deploy Python Server to Render (10 mins)**

1. **Create Render Account:**
   - Go to: https://render.com/
   - Sign up (FREE)

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect GitHub repo OR upload files
   - Name: `deadcetera-youtube`
   - Environment: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python youtube-dl-server.py`
   - Plan: **FREE** ✅

3. **Note the URL:**
   - Render gives you: `https://deadcetera-youtube.onrender.com`
   - Save this URL!

4. **Test It:**
   - Visit: `https://YOUR-APP.onrender.com/health`
   - Should see: `{"status": "ok"}`

---

### **STEP C: Deploy Cloudflare Worker (10 mins)**

1. **Create Cloudflare Account:**
   - Go to: https://dash.cloudflare.com/
   - Sign up (FREE)

2. **Create Worker:**
   - Go to: Workers & Pages
   - Click "Create Application" → "Create Worker"
   - Name: `deadcetera-youtube`
   - Click "Deploy"

3. **Edit Worker Code:**
   - Click "Edit Code"
   - Delete default code
   - Paste contents of `cloudflare-worker.js`
   - **IMPORTANT:** Update line 63:
     ```javascript
     const ytDlpServer = 'https://YOUR-RENDER-APP.onrender.com';
     ```
     Replace with YOUR Render URL!

4. **Add Environment Variable:**
   - Go to Settings → Variables
   - Add variable:
     - Name: `YOUTUBE_API_KEY`
     - Value: [Your YouTube API key from Step A]
   - Save

5. **Note Worker URL:**
   - You get: `https://deadcetera-youtube.YOUR-SUBDOMAIN.workers.dev`
   - Save this URL!

---

### **STEP D: Connect to Your Website (2 mins)**

1. **Open `app.js` in editor**

2. **Find line ~600** (search for "YOUR_CLOUDFLARE_WORKER_URL")

3. **Replace BOTH occurrences:**
   ```javascript
   // Line ~600
   const workerUrl = 'https://deadcetera-youtube.YOUR-SUBDOMAIN.workers.dev';
   
   // Line ~650  
   const workerUrl = 'https://deadcetera-youtube.YOUR-SUBDOMAIN.workers.dev';
   ```

4. **Upload updated `app.js` to GitHub**

5. **Wait 2 mins for rebuild**

---

### **STEP E: Test YouTube Integration**

1. Go to your site
2. Search "Althea"
3. Click version
4. **Click red "🎥 Search YouTube" button**
5. See YouTube results in modal
6. Click video → Downloads MP3!

**SUCCESS!** 🎉

---

## 💰 COSTS:

### **What You're Using:**
- GitHub Pages: **FREE** ✅
- Cloudflare Workers: **FREE** (100k requests/day) ✅
- Render Free Tier: **FREE** (with 30s wake-up delay) ✅
- YouTube Data API: **FREE** (10k requests/day) ✅

### **Total Monthly Cost: $0** 🎉

### **Limitations:**
- Render free tier spins down after 15 mins inactivity
- First YouTube request takes 30-60 seconds (wake-up)
- Subsequent requests are fast
- If you need instant responses, upgrade Render to $7/month

---

## 🧪 TESTING CHECKLIST:

### **✅ Archive.org Smart Download:**
- [ ] Select song
- [ ] Click "⚡ Smart Download"
- [ ] Wait for extraction
- [ ] Download WAV file
- [ ] File is 10-15 MB
- [ ] Upload to Moises works

### **✅ YouTube Integration:**
- [ ] Click "🎥 Search YouTube"
- [ ] See modal with results
- [ ] Click video
- [ ] Download starts
- [ ] MP3 file downloads
- [ ] Upload to Moises works

---

## 🔧 TROUBLESHOOTING:

### **"Audio Splitter not loaded"**
- Make sure `audio-splitter.js` is uploaded to GitHub
- Hard refresh: Cmd+Shift+R
- Check browser console for errors

### **"YouTube search failed"**
- Check Cloudflare Worker URL in app.js
- Check Worker is deployed
- Check YouTube API key is set

### **"Download failed"**
- Check Render server is running
- Visit health check: `https://YOUR-APP.onrender.com/health`
- First request might timeout (30s wake-up)
- Try again after 30 seconds

### **Render server slow:**
- Free tier spins down after inactivity
- Takes 30-60s to wake up
- Upgrade to $7/month for instant responses
- Or accept the delay (it's FREE!)

---

## 📊 USAGE LIMITS (FREE TIER):

### **Cloudflare Workers:**
- 100,000 requests/day
- That's ~3,000 songs/day
- More than enough!

### **YouTube Data API:**
- 10,000 quota units/day
- 1 search = 100 units
- = 100 searches/day
- Plenty for your band!

### **Render Free Tier:**
- 750 hours/month (unlimited for one service)
- No request limits
- Only downside: spin-down delay

---

## 🎉 YOU'RE DONE!

**Phase 1 (Archive.org):** Works immediately after upload
**Phase 2 (YouTube):** Works after 25-min setup

**Total time: ~30 mins**
**Total cost: $0/month**

Now your tool has:
- ✅ 375 songs
- ✅ 60 curated versions
- ✅ Smart audio extraction
- ✅ YouTube integration
- ✅ Setlist.fm links
- ✅ Under-20-min clips ready for Moises

**GO PRACTICE!** 🎸⚡🌹
