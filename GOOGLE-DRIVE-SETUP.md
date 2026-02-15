# 🚀 GOOGLE DRIVE INTEGRATION - SETUP GUIDE

## What This Does:

✅ **Shared Audio Recordings** - All band members see each other's recordings
✅ **Shared Rehearsal Notes** - Notes visible to everyone  
✅ **Shared Practice Track Links** - Everyone sees the same links
✅ **Real-time Sync** - Changes appear immediately
✅ **No localStorage Limitations** - Works across all devices

---

## 📋 SETUP STEPS (15 minutes)

### Step 1: Create Google Cloud Project

1. Go to: https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Name it: "Deadcetera Band App"
4. Click "Create"
5. Wait for it to be created (30 seconds)

### Step 2: Enable Google Drive API

1. In the Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it
4. Click "Enable"
5. Wait for it to enable

### Step 3: Create API Credentials

**Part A: Create API Key**
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API Key (looks like: `AIzaSyC...`)
4. Click "Restrict Key" (recommended)
5. Under "API restrictions" → Select "Google Drive API"
6. Save

**Part B: Create OAuth 2.0 Client ID**
1. Still in "Credentials", click "Create Credentials" → "OAuth client ID"
2. If prompted, configure consent screen first:
   - User Type: External
   - App name: Deadcetera Band App
   - User support email: your email
   - Developer email: your email
   - Save and continue through all steps
3. Back to creating OAuth client ID:
   - Application type: "Web application"
   - Name: "Deadcetera Web Client"
   - Authorized JavaScript origins:
     - Add: `https://YOUR-USERNAME.github.io`
     - Add: `http://localhost:8000` (for testing)
   - Authorized redirect URIs:
     - Add: `https://YOUR-USERNAME.github.io/deadcetera`
   - Click "Create"
4. Copy the Client ID (looks like: `123456789-abc...apps.googleusercontent.com`)

### Step 4: Add Credentials to Your App

Open `app.js` and find this section near the top:

```javascript
const GOOGLE_DRIVE_CONFIG = {
    apiKey: 'YOUR_API_KEY_HERE',
    clientId: 'YOUR_CLIENT_ID_HERE',
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scope: 'https://www.googleapis.com/auth/drive.file'
};
```

Replace with your actual credentials:

```javascript
const GOOGLE_DRIVE_CONFIG = {
    apiKey: 'AIzaSyC...', // Your API Key from Step 3A
    clientId: '123456789-abc...apps.googleusercontent.com', // Your Client ID from Step 3B
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scope: 'https://www.googleapis.com/auth/drive.file'
};
```

### Step 5: Test It!

1. Upload the updated app.js to GitHub
2. Wait 2-3 minutes
3. Open your site
4. Look for "🔗 Connect Google Drive" button (in settings or header)
5. Click it
6. Sign in with Google
7. Grant permissions
8. Should show "✅ Connected to Google Drive"

---

## 🎯 HOW IT WORKS

### Folder Structure in Google Drive:

```
Google Drive
└── Deadcetera Band Resources/
    ├── Audio Recordings/
    │   ├── tweezer-reprise-section0-drew-20240215.webm
    │   ├── tweezer-reprise-section0-brian-20240215.webm
    │   └── ...
    └── Metadata/
        ├── Tweezer Reprise_rehearsal_notes.json
        ├── Tweezer Reprise_practice_tracks.json
        └── ...
```

### What Gets Saved Where:

**Google Drive (Shared):**
- ✅ Audio recordings (everyone can play them)
- ✅ Rehearsal notes (everyone sees them)
- ✅ Practice track links (shared list)
- ✅ Audio snippet metadata (names, notes, uploader)

**GitHub (Your Site Code):**
- Song data
- Harmony parts
- Chord charts
- Band member info

---

## 🔐 PRIVACY & PERMISSIONS

### Who Can Access:

**Option A - Private (Recommended):**
- Only band members you invite
- Files stay private
- Controlled access

**Option B - Anyone with Link:**
- Anyone can view recordings
- Good for sharing with fans
- Less secure

**Current Setup:**
- Uses "Anyone with link can view"
- Band members can upload/delete
- Good balance of sharing & security

---

## 👥 ADDING BAND MEMBERS

1. Share the Google Drive folder with band members:
   - Open Google Drive
   - Find "Deadcetera Band Resources" folder
   - Right-click → Share
   - Add band member emails
   - Give them "Editor" access

2. Or use "Anyone with link":
   - They just need to sign in with ANY Google account
   - All recordings auto-appear

---

## 🎤 USER EXPERIENCE

### Before (localStorage):
```
Drew records harmony
→ Saves to HIS browser
→ Brian can't see it ❌
→ Chris can't see it ❌
→ Only Drew sees it 😞
```

### After (Google Drive):
```
Drew records harmony
→ Uploads to Google Drive
→ Brian sees it instantly ✅
→ Chris sees it instantly ✅
→ Everyone can play it ✅
→ All devices sync 🔥
```

---

## 🐛 TROUBLESHOOTING

### "Failed to load Google Drive"
- Check API Key is correct
- Check Client ID is correct
- Check APIs are enabled in Cloud Console

### "Sign-in failed"
- Check Authorized JavaScript origins match your URL exactly
- Make sure OAuth consent screen is configured
- Try signing out and back in

### "Upload failed"
- Check you're signed in to Google Drive
- Check internet connection
- Check file size (Drive has limits)

### Recordings not showing for other band members
- Check they're signed in to Google Drive
- Check folder is shared with them
- Check they have "Editor" or "Viewer" permissions

---

## 💰 COSTS

**Google Drive API:**
- FREE up to 1 billion requests/day (you'll use ~100/day)
- FREE 15GB storage per Google account
- Band can share one account or each use their own

**Total Cost: $0** 🎉

---

## 🚀 NEXT STEPS AFTER SETUP

Once you complete the setup:

1. ✅ Fix Issues 1, 2, 4, 5 (quick fixes)
2. ✅ Integrate Google Drive code
3. ✅ Add "Connect Google Drive" button to UI
4. ✅ Update recording flow to use Drive
5. ✅ Update rehearsal notes to use Drive
6. ✅ Test with band members!

---

## 📸 SCREENSHOTS TO EXPECT

### In Your App:
- "🔗 Connect Google Drive" button
- After clicking: Google sign-in popup
- After signing in: "✅ Connected to Google Drive"
- Recordings show "☁️ Saved to Drive" badge

### In Google Drive:
- New folder: "Deadcetera Band Resources"
- Subfolders: "Audio Recordings", "Metadata"
- Audio files with dates and names
- JSON files with notes/links

---

Ready to set this up? Follow the steps above, then I'll integrate the code! 🎸
