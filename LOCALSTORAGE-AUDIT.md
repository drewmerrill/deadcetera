# 🚨 LOCALSTORAGE AUDIT - WHAT NEEDS FIXING

## CRITICAL ISSUES (Band data NOT shared):

### 1. ❌ Harmony Audio Snippets - localStorage ONLY
**Location:** Lines 2895-2960
**Problem:** Audio recordings save to localStorage, not Google Drive
**Impact:** HIGH - Brian records harmony part, no one else sees it
**Fix needed:** Save audio to Google Drive (already have the code for this!)

### 2. ❌ OLD "Resources" System - localStorage ONLY  
**Location:** Lines 40-62
**Problem:** Old tab/lessons/references system uses localStorage
**Impact:** LOW - This might not even be used anymore (check if called)
**Fix needed:** Either remove or migrate to Drive

---

## ACCEPTABLE localStorage uses (User preferences, not band data):

### ✅ Instrument Preference - localStorage OK
**Location:** Lines 85, 110
**What:** Remembers which instrument YOU selected (bass, guitar, etc.)
**Shared:** NO - this is YOUR preference
**Status:** CORRECT - should stay localStorage

### ✅ ABC Notation Fallback - localStorage AS BACKUP
**Location:** Lines 3882, 3903  
**What:** Saves ABC to Drive FIRST, localStorage as fallback
**Shared:** YES (via Drive)
**Status:** CORRECT - Drive is primary, localStorage is backup

---

## NEEDS INVESTIGATION:

### ❓ Lines 3134, 3137, 3161, 3167, 3182, 3184
**What:** More harmony audio snippet references
**Status:** Need to check if these are duplicates or additional issues

### ❓ Lines 4450, 4463, 4526, 4579
**What:** Unknown localStorage usage
**Status:** Need to check what these are

---

## BAND DATA THAT SHOULD BE ON DRIVE (Need to verify):

✅ **Practice tracks** - CHECK if on Drive
✅ **Personal tabs** - CHECK if on Drive  
✅ **Spotify versions** - CHECK if on Drive
✅ **Lead singer** - CHECK if on Drive
✅ **Has harmonies** - CHECK if on Drive
✅ **Rehearsal notes** - CHECK if on Drive
✅ **Gig notes** - CHECK if on Drive
✅ **Song structure** - CHECK if on Drive
✅ **Moises stems** - CHECK if on Drive
❌ **Harmony audio snippets** - CONFIRMED localStorage only
❌ **ABC notation** - FIXED (now on Drive with localStorage fallback)

---

## ACTION ITEMS:

1. **URGENT:** Fix harmony audio snippets to save to Drive
2. **Check:** Verify all other band data uses Drive
3. **Remove:** Delete old "resources" system if unused
4. **Test:** Upload audio snippet, check if other users see it

---

## THE RISK:

If Brian or any band member:
- Records harmony audio snippets
- Uses any localStorage-only feature
- Expects others to see it

**They will be frustrated when it's not shared!**

This is the #1 way to lose adoption.
