# GrooveLinx Firebase MCP Server

Local Model Context Protocol server that gives Claude Code (or any MCP-compatible agent) direct read/write access to the GrooveLinx Firebase Realtime Database during a session.

**Why this exists.** Without it, when Drew says "fix Brian's RSVP on the 5/30 gig," Claude has to generate a `window._gl_*` console snippet that Drew then pastes into DevTools. With this server live, Claude calls the right tool and the change lands instantly. ~50% faster iteration for any data-touching session.

---

## Setup (one-time, ~10 min)

### 1. Install Node deps

```bash
cd services/mcp-firebase
npm install
```

This pulls `@modelcontextprotocol/sdk` and `firebase-admin`.

### 2. Download a Firebase service account key

1. Open https://console.firebase.google.com → project **groovelinx-app**
2. Gear icon → **Project settings**
3. **Service accounts** tab → **Generate new private key**
4. Save the downloaded JSON to a path **outside the repo** (e.g. `~/.config/groovelinx/firebase-service-account.json`)
5. `chmod 600 ~/.config/groovelinx/firebase-service-account.json` so it's not world-readable

**Critical:** never commit this file. The `.gitignore` in this directory blocks `service-account*.json`, but storing it OUTSIDE the repo is safer.

### 3. Find your Database URL

In Firebase Console → Realtime Database → look at the top — the URL looks like one of:

- `https://<project-id>-default-rtdb.firebaseio.com`
- `https://<project-id>-default-rtdb.<region>.firebasedatabase.app`

Copy that. You'll need it in step 4.

### 4. Add to Claude Code's MCP config

Two options — pick one:

#### Option A: Project-scoped (`.mcp.json` at repo root)

Already created at the repo root. Edit the placeholders:

```json
{
  "mcpServers": {
    "groovelinx-firebase": {
      "command": "node",
      "args": ["services/mcp-firebase/server.js"],
      "env": {
        "FIREBASE_SERVICE_ACCOUNT_PATH": "/Users/drewmerrill/.config/groovelinx/firebase-service-account.json",
        "FIREBASE_DATABASE_URL": "https://groovelinx-app-default-rtdb.firebaseio.com",
        "ALLOWED_BAND_SLUGS": "deadcetera"
      }
    }
  }
}
```

Replace the paths/URL with your actual values. With `ALLOWED_BAND_SLUGS=deadcetera`, the server will refuse writes to any other band. To unlock all bands, set `*`.

#### Option B: User-scoped (`~/.claude/settings.json`)

If you want this server available across ALL projects (not just GrooveLinx), put it in your user settings instead. Same JSON shape, just in the user file.

### 5. Restart Claude Code

The next time you open a session, you should see `groovelinx-firebase` listed in the MCP servers (run `/mcp` in Claude Code to verify).

### 6. Test it from Claude Code

In a Claude Code session, try:

> "Use the firebase MCP to read bands/deadcetera/meta/members and list the member keys."

Expected response: Claude calls `firebase_list_children` and replies with `['drew', 'brian', 'chris', 'pierce', 'jay']` (or whatever your roster is).

If you get an error, check:
- `FIREBASE_SERVICE_ACCOUNT_PATH` points to the actual file
- The JSON file is valid (run `jq . < ~/.config/.../firebase-service-account.json` — should pretty-print without error)
- `FIREBASE_DATABASE_URL` matches what's in Firebase Console
- Restart Claude Code after editing `.mcp.json`

---

## Tools exposed

| Tool | Purpose |
|---|---|
| `firebase_read(path)` | Read the entire subtree at a path, return as JSON. Use for inspection. |
| `firebase_list_children(path)` | List immediate child keys (faster than read when you just need names). |
| `firebase_write(path, data)` | Overwrite the subtree at a path. **Destructive.** Subject to ALLOWED_BAND_SLUGS scope. |
| `firebase_update(path, updates)` | Shallow multi-key update — only listed keys change. Safer than write. Subject to scope. |
| `firebase_delete(path)` | Remove a path. Refuses dangerous deletions (root, `bands/`, `meta/members/`, entire band roots). Subject to scope. |
| `firebase_push(path, data)` | Append a new auto-keyed child under a path. Returns the generated key. |

## Safety rails baked in

- **Write scope:** `ALLOWED_BAND_SLUGS` env var enforces which bands can be modified. Default `*` is unrestricted; set to `deadcetera` for production safety.
- **Delete blocklist:** refuses paths matching root, `bands/`, `users/`, `bands/<slug>/` (entire band roots), `bands/<slug>/meta/members/` (entire rosters). Catches obvious foot-guns.
- **Reads are unrestricted** — knowing what's there is never dangerous.

## What this server does NOT do

- ❌ Does not replace your existing `_gl_*` console helpers — those still work and are sometimes more convenient (e.g. when you're already in DevTools).
- ❌ Does not validate data shape — Claude can write arbitrary JSON. If you tell it to write garbage, it writes garbage. Trust the agent + the safety rails, not field-level schema validation.
- ❌ Does not run inside the deployed app — this is local-only, for dev/admin work. The GrooveLinx browser app uses its own Firebase JS SDK with user auth.
- ❌ Does not log writes anywhere durably — if you need an audit trail of agent-made changes, check `git log` for spec doc updates that mention what was done.

## Rotating credentials

If the service account key is ever exposed (committed by accident, sent in a screenshot, etc.):

1. Firebase Console → Project settings → Service accounts
2. Click the key in the list → delete it
3. Generate a new one (step 2 above)
4. Update `FIREBASE_SERVICE_ACCOUNT_PATH` in `.mcp.json` to the new file
5. Restart Claude Code

Old credentials are revoked immediately — anyone holding the old key loses access.
