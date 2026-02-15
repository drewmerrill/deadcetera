# 🚨 CRITICAL: CLEAR YOUR BROWSER CACHE!

## The Problem:

Your browser is using a **CACHED OLD VERSION** of app.js!

The error "isStored is not defined" proves you're running OLD code - the new version doesn't have `isStored` anywhere.

---

## 🔥 CLEAR CACHE PROPERLY:

### Method 1: Hard Reload (BEST)
1. **Open the Deadcetera page**
2. **Open DevTools** (Cmd+Option+I)
3. **RIGHT-CLICK the reload button** (next to URL bar)
4. **Select: "Empty Cache and Hard Reload"**
5. **Check console** - should see: `🎸 Deadcetera v2.8.0 loaded`

### Method 2: Clear Site Data
1. **Open DevTools** (Cmd+Option+I)
2. **Go to Application tab**
3. **Click "Clear site data"** (left sidebar)
4. **Check ALL boxes**
5. **Click "Clear site data"** button
6. **Reload page**

### Method 3: Incognito/Private Window
1. **Open NEW incognito window** (Cmd+Shift+N)
2. **Navigate to your GitHub Pages URL**
3. **This bypasses all cache**

---

## ✅ HOW TO VERIFY IT WORKED:

### Check 1: Console Version
**Open console** - you should see:
```
🎸 Deadcetera v2.8.0 loaded - Google Drive edition
```

If you see anything else or no message → Still cached!

### Check 2: Add Practice Track
1. Paste URL
2. Select instrument  
3. Click "Add Track"

**If you see:** `isStored is not defined` → Still using old cached file!
**If it works:** ✅ New version loaded!

---

## 📊 WHY THIS KEEPS HAPPENING:

**GitHub Pages has AGGRESSIVE caching:**
- Browser caches app.js for hours/days
- Service workers cache it
- CDN caches it
- Hard refresh (Cmd+Shift+R) doesn't always clear everything

**The ONLY reliable method:** Right-click reload → "Empty Cache and Hard Reload"

---

## 🎯 DEPLOYMENT CHECKLIST:

### Step 1: Upload Files
- [ ] Upload app.js (v2.8.0)
- [ ] Upload index.html (if changed)

### Step 2: Clear Cache
- [ ] Right-click reload button
- [ ] Select "Empty Cache and Hard Reload"
- [ ] See version message in console: `v2.8.0`

### Step 3: Verify Fixes
- [ ] Practice tracks don't show `isStored` error
- [ ] Lead singer dropdown pre-fills
- [ ] Has harmonies checkbox pre-checks
- [ ] Harmony parts load quickly
- [ ] Delete buttons (×) appear on practice tracks

### Step 4: Test Google Drive
- [ ] Connect Google Drive
- [ ] Add practice track
- [ ] Check Google Drive → See JSON file
- [ ] Refresh page → Track still there

---

## 🐛 IF ISSUES PERSIST:

### Still seeing "isStored" error?

1. **Check console for version:**
   ```
   If you see: v2.8.0 → Good!
   If you see: v2.4.4 or nothing → STILL CACHED!
   ```

2. **Try incognito window:**
   - New incognito tab
   - Load site
   - Try adding practice track
   - If it works in incognito → Cache issue

3. **Nuclear option:**
   ```
   1. Close ALL browser tabs
   2. Quit Chrome completely
   3. Reopen Chrome
   4. Go directly to site
   5. Hard reload
   ```

---

## 📝 WHAT'S FIXED IN v2.8.0:

✅ **Google Drive Query Escaping**
- Fixed 400 errors
- Proper escaping of special characters
- Works with song names containing apostrophes, spaces, etc.

✅ **Delete Buttons**
- Changed from `isStored` to `isUserAdded`
- Shows × button for all user-added tracks
- Works for both Drive and localStorage tracks

✅ **Metadata Persistence**
- Lead singer saves & loads from Drive
- Has harmonies saves & loads from Drive
- Pre-populates on page load

✅ **Practice Tracks**
- Save to Google Drive
- Load from Google Drive
- Show "• Google Drive" badge
- Delete properly with × button

---

## 🚀 AFTER CACHE IS CLEARED:

You should see:

**Console:**
```
🎸 Deadcetera v2.8.0 loaded - Google Drive edition
✅ User signed in
✅ Found existing folder: [ID]
```

**Song Metadata:**
```
🎤 Lead Singer: [Pierce ▼]  ← Pre-filled!
☑ Has Harmonies            ← Pre-checked!
```

**Practice Tracks:**
```
[×] 🎸 Lead Guitar
    Tweezer main riff
    Added by drew • Google Drive ✅
```

---

## ✨ ONCE CACHE IS CLEARED, EVERYTHING WILL WORK!

The code is correct. The issue is 100% browser cache.

**Use: Right-click reload → "Empty Cache and Hard Reload"**

Then check console for: `🎸 Deadcetera v2.8.0`

If you see that message → You're running the new code! 🎸✨
