# 🎥 YOUTUBE INTEGRATION - COMPLETE DEPLOYMENT GUIDE
## 100% FREE using Render + Cloudflare

---

## 📦 WHAT YOU'RE DEPLOYING:

1. **Python yt-dlp Server** (Render - FREE tier)
   - Downloads audio from YouTube
   - Converts to MP3
   - Serves files to your website

2. **Cloudflare Worker** (FREE - 100k requests/day)
   - API gateway between your site and Python server
   - Handles YouTube search
   - Manages CORS

3. **YouTube Data API** (FREE - 10k requests/day)
   - Powers YouTube search feature
   - No credit card required

---

## ⏱️ TOTAL TIME: ~30 MINUTES

**Step A:** Get YouTube API Key (5 mins)
**Step B:** Deploy Python Server to Render (10 mins)
**Step C:** Deploy Cloudflare Worker (10 mins)
**Step D:** Connect to Website (5 mins)

---

## 🚀 STEP A: GET YOUTUBE API KEY (5 mins)

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create Project
- Click "Select a project" (top left)
- Click "New Project"
- Name: `Deadcetera YouTube`
- Click "Create"
- Wait 30 seconds for project to be created

### 3. Enable YouTube Data API
- Click "Enable APIs and Services" (big blue button)
- Search: `YouTube Data API v3`
- Click on it
- Click "Enable"

### 4. Create API Key
- Click "Credentials" (left sidebar)
- Click "+ CREATE CREDENTIALS" (top)
- Select "API Key"
- **Copy the key** (looks like: `AIzaSyC...`)
- Click "Close"

### 5. (Optional) Restrict Key
- Click on the API key you just created
- Under "API restrictions":
  - Select "Restrict key"
  - Check "YouTube Data API v3"
- Click "Save"

**✅ DONE! Save your API key somewhere safe!**

---

## 🐍 STEP B: DEPLOY PYTHON SERVER TO RENDER (10 mins)

### 1. Go to Render
Visit: https://render.com/
- Click "Get Started for Free"
- Sign up with GitHub (recommended)

### 2. Create New Web Service
- Click "New +" (top right)
- Select "Web Service"

### 3. Connect Repository (Option A - Easiest)
**If you have GitHub Desktop:**
- Create new folder: `deadcetera-youtube-server`
- Put these 3 files in it:
  - `youtube-dl-server.py`
  - `requirements.txt`
  - `Procfile`
- Commit to GitHub
- In Render, select your repo

### 3. OR Manual Deploy (Option B)
**If you don't want to use GitHub:**
- Select "Deploy from Git" tab
- Click "Public Git Repository"
- Paste: `[Your GitHub URL]`

### 4. Configure Service
Fill in these settings:

**Name:** `deadcetera-youtube`
**Region:** `Oregon (US West)` (or closest to you)
**Branch:** `main`
**Root Directory:** (leave blank)
**Runtime:** `Python 3`
**Build Command:** `pip install -r requirements.txt`
**Start Command:** `python youtube-dl-server.py`

### 5. Select Free Plan
- Click "Free" plan
- Scroll down
- Click "Create Web Service"

### 6. Wait for Deployment
- Takes 2-3 minutes
- Watch the logs
- Look for: "Running on http://0.0.0.0:8080"

### 7. Copy Your URL
At the top, you'll see: `https://deadcetera-youtube.onrender.com`
**Copy this URL!** You'll need it next.

### 8. Test It
Visit: `https://YOUR-APP.onrender.com/health`
Should see: `{"status": "ok"}`

**⚠️ IMPORTANT:** First request takes 30-60 seconds (cold start)

**✅ DONE! Python server deployed!**

---

## ☁️ STEP C: DEPLOY CLOUDFLARE WORKER (10 mins)

### 1. Go to Cloudflare
Visit: https://dash.cloudflare.com/
- Sign up (FREE)
- Verify email

### 2. Go to Workers
- Click "Workers & Pages" (left sidebar)
- Click "Create Application"
- Click "Create Worker"

### 3. Name Your Worker
- Name: `deadcetera-youtube`
- Click "Deploy"

### 4. Edit Worker Code
- Click "Edit Code" (blue button)
- **Delete all default code**
- **Paste** the contents of `cloudflare-worker.js`

### 5. Update Python Server URL
**CRITICAL:** Find line 63 in the worker code:
```javascript
const ytDlpServer = env.YTDLP_SERVER_URL || 'http://localhost:8080';
```

Replace with:
```javascript
const ytDlpServer = env.YTDLP_SERVER_URL || 'https://YOUR-RENDER-APP.onrender.com';
```

Use your actual Render URL from Step B!

### 6. Save & Deploy
- Click "Save and Deploy"
- Wait 10 seconds

### 7. Add Environment Variables
- Click "Settings" tab
- Click "Variables"
- Click "Add variable"

**Variable 1:**
- Name: `YOUTUBE_API_KEY`
- Value: [Your API key from Step A]
- Click "Add"

**Variable 2:**
- Name: `YTDLP_SERVER_URL`
- Value: `https://YOUR-RENDER-APP.onrender.com`
- Click "Add"

### 8. Redeploy
- Go back to worker
- Click "Quick edit"
- Click "Save and deploy" (even without changes - this loads the env vars)

### 9. Copy Worker URL
You'll see: `https://deadcetera-youtube.YOUR-SUBDOMAIN.workers.dev`
**Copy this URL!**

### 10. Test It
Visit: `https://YOUR-WORKER.workers.dev/api/youtube/search?q=grateful+dead+althea`

Should see JSON with YouTube results!

**✅ DONE! Cloudflare Worker deployed!**

---

## 🔗 STEP D: CONNECT TO WEBSITE (5 mins)

### 1. Update app.js
Open `/mnt/user-data/outputs/app.js` in editor

### 2. Find Worker URL References
Search for: `YOUR_CLOUDFLARE_WORKER_URL`

You'll find it in TWO places (around lines 600 and 650)

### 3. Replace Both
Change:
```javascript
const workerUrl = 'YOUR_CLOUDFLARE_WORKER_URL';
```

To:
```javascript
const workerUrl = 'https://YOUR-WORKER.workers.dev';
```

Use your actual Cloudflare Worker URL!

### 4. Uncomment YouTube Button
Open `/mnt/user-data/outputs/index.html`

Find (around line 73):
```html
<!-- YouTube button - uncomment after deploying...
<button class="primary-btn youtube-btn" id="youtubeSearchBtn" style="background: #ef4444;">
    🎥 Search YouTube for This Song
</button>
-->
```

Change to:
```html
<button class="primary-btn youtube-btn" id="youtubeSearchBtn" style="background: #ef4444;">
    🎥 Search YouTube for This Song
</button>
```

### 5. Upload to GitHub
Upload these 2 files:
- `app.js` (with Worker URL)
- `index.html` (YouTube button uncommented)

### 6. Wait 2 Minutes
GitHub Pages takes ~2 minutes to rebuild

### 7. Test!
- Go to your site
- Search "Althea"
- Click version
- **Click red "🎥 Search YouTube" button**
- See YouTube results!
- Click video → Download MP3!

**✅ DONE! YouTube integration complete!**

---

## 🧪 TESTING CHECKLIST:

### **Test 1: YouTube Search**
- [ ] Red YouTube button appears
- [ ] Click it
- [ ] Modal opens
- [ ] YouTube results appear
- [ ] Shows thumbnails and titles

### **Test 2: YouTube Download**
- [ ] Click a video in results
- [ ] Confirmation popup appears
- [ ] Click OK
- [ ] Download starts (wait 30-60s for cold start)
- [ ] MP3 file downloads
- [ ] File plays correctly

### **Test 3: Upload to Moises**
- [ ] Drag MP3 to Moises
- [ ] File uploads successfully
- [ ] Separate stems
- [ ] Practice!

---

## 💰 COST BREAKDOWN:

| Service | Free Tier Limit | Cost |
|---------|----------------|------|
| Render | 750 hrs/month | $0 |
| Cloudflare Workers | 100k requests/day | $0 |
| YouTube Data API | 10k quota units/day | $0 |
| **TOTAL** | | **$0/month** |

---

## 🐛 TROUBLESHOOTING:

### **"YouTube Search Failed"**
- Check Cloudflare Worker URL in app.js
- Check YouTube API key is set in Worker
- Hard refresh: Cmd+Shift+R

### **"Download Failed"**
- First download takes 30-60 seconds (Render cold start)
- Wait and try again
- Check Render server is running: Visit `/health` endpoint

### **"Unexpected token"**
- Worker URL is wrong in app.js
- Make sure you replaced BOTH occurrences

### **Render Server Sleeping**
- Free tier spins down after 15 mins inactive
- Takes 30-60s to wake up
- This is normal on free tier!

---

## 🎉 YOU'RE DONE!

Your tool now has:
- ✅ Auto-search for best Archive.org versions
- ✅ Smart song extraction (10-15 min clips)
- ✅ YouTube search integration
- ✅ YouTube audio download
- ✅ All 100% FREE!

**Now go practice!** 🎸⚡🌹
