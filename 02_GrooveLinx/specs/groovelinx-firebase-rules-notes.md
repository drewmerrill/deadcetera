# GrooveLinx — Firebase Security Rules: Design Notes
**Companion to `groovelinx-firebase-rules.json`**

---

## Core Design Decisions

### 1. Membership check pattern

Every band-scoped rule uses this expression as its access predicate:

```
root.child('bands/' + $slug + '/members/' + auth.uid).exists()
```

This means: **a user is a member of a band if and only if their Firebase Auth UID exists as a key under `/bands/{slug}/members/`**. No separate lookup table, no token claims — membership is a single node existence check.

**Implication for your code:** When a user joins or is invited to a band, the server-side flow (Worker or Firebase Function) must write a record to `/bands/{slug}/members/{uid}` that includes at minimum `{ displayName: "...", role: "member" }`. The rules validate `displayName` is present.

---

### 2. Role field for admin actions

Some paths (meta updates, invite creation, member writes for other UIDs) require:

```
root.child('bands/' + $slug + '/members/' + auth.uid + '/role').val() === 'admin'
```

Assign `role: "admin"` to Drew's UID in each band's members record. For the `deadcetera` band, set this manually in the Firebase console or via a one-time migration script.

---

### 3. Care packages are public read, write-locked from client

`/care_packages_public/{id}` is `.read: true` but `.write: false`. Care packages must be written by the Worker (which uses a service account or your Firebase Admin SDK token), not by the browser client directly. This prevents anyone from injecting arbitrary public data.

If your current Care Package flow writes directly from the browser, you need to route it through the Worker (`POST /pack/create` or similar) before deploying these rules.

---

### 4. Per-member write isolation

Two paths enforce that members can only write their own data:

- `/bands/{slug}/readiness/{uid}` — each member writes only their own readiness scores
- `/bands/{slug}/crib_notes/{songId}/{uid}` — each member writes only their own crib note entries

Both paths allow all band members to read all data (required for heatmap and Stage Crib Notes rendering).

---

### 5. Invite tokens are auth-required read

Invites are readable by any authenticated user (not just band members) so a new user can look up an invite token before they've been added to the band. Writes are admin-only.

---

### 6. Catch-all for future paths

```json
"$other": {
  ".read": "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()",
  ".write": "auth != null && root.child('bands/' + $slug + '/members/' + auth.uid).exists()"
}
```

Any new path created under a band during Wave-3 work automatically inherits members-only access. This prevents accidental open paths during extraction sprints.

---

## Deployment

1. Go to [Firebase Console](https://console.firebase.google.com/) → Project `deadcetera-35424` → Realtime Database → Rules tab
2. Replace the existing rules JSON with the contents of `groovelinx-firebase-rules.json`
3. Click **Publish**
4. Use the **Rules Playground** to test before publishing in production

### Rules Playground test cases to run

| Scenario | Path | Auth | Expected |
|---|---|---|---|
| Member reads songs | `/bands/deadcetera/songs` | UID in members | ✅ Allow |
| Non-member reads songs | `/bands/deadcetera/songs` | UID not in members | ❌ Deny |
| Member reads other band | `/bands/otherbandslug/songs` | UID not in that band | ❌ Deny |
| Anyone reads care package | `/care_packages_public/abc123` | Unauthenticated | ✅ Allow |
| Client writes care package | `/care_packages_public/abc123` | Any | ❌ Deny |
| Member writes own readiness | `/bands/deadcetera/readiness/{their_uid}` | Matching UID | ✅ Allow |
| Member writes other's readiness | `/bands/deadcetera/readiness/{other_uid}` | Non-matching UID | ❌ Deny |
| Admin writes member record | `/bands/deadcetera/members/{any_uid}` | Admin UID | ✅ Allow |
| Member writes member record | `/bands/deadcetera/members/{other_uid}` | Non-admin UID | ❌ Deny |

---

## What You Need to Verify Before Deploying

- [ ] Care Package creation currently writes from **browser client** → must move to Worker before deploying rules (or the write will be denied)
- [ ] Drew's UID has `role: "admin"` in `/bands/deadcetera/members/{drew_uid}`
- [ ] All other members have valid records in `/bands/deadcetera/members/{uid}` with `displayName` present
- [ ] Invite join flow writes to `/bands/{slug}/members/{uid}` via Worker (not client-side Firebase write)
- [ ] `sync.py` / `push.py` do not write to Firebase directly (they don't — this is a note for completeness)
