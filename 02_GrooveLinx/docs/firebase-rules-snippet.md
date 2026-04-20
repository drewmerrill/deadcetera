# Firebase Realtime Database — Rules

The app's Firebase security rules are **not checked into this repo** — they live in the Firebase Console for the project (deadcetera-35424). This doc is the canonical reference for band-specific rule requirements so future maintainers don't re-discover them by trial and error.

## Required `.indexOn` declarations

Firebase prints a console warning whenever it has to download a whole node and filter on the client because no index is declared:

```
FIREBASE WARNING: Using an unspecified index. Your data will be downloaded and
filtered on the client. Consider adding ".indexOn": "ts" at
/bands/deadcetera/activity_log to your security rules for better performance.
```

The fix is to declare the index on the server. Merge this snippet into your rules in the Firebase Console:

```json
{
  "rules": {
    "bands": {
      "$bandSlug": {
        "activity_log": {
          ".indexOn": "ts"
        }
      }
    }
  }
}
```

## How to apply

1. Open <https://console.firebase.google.com/> → select project.
2. Left nav → **Realtime Database** → **Rules** tab.
3. Find the existing `bands` → `$bandSlug` block and add `"activity_log": { ".indexOn": "ts" }` as a child. Preserve every other rule you already have.
4. Tap **Publish**.

Warning stops immediately. `/bands/*/activity_log` queries ordered by `ts` are now server-indexed.

## If you add new band-level collections

Any collection under `/bands/{bandSlug}/` that the app queries with `.orderByChild("fieldName")` needs a matching `.indexOn` declaration. Add it here when you add it to the rules.

Known collections currently queried this way:
- `activity_log` ordered by `ts`

## Why not check rules into the repo?

It's been considered. Rules can be deployed from a local file via the Firebase CLI (`firebase deploy --only database`). If the team wants version control on rules, the path is:
1. Add `firebase.json` and `database.rules.json` to the repo root.
2. Run `firebase init database` to pull current rules down.
3. Add `firebase deploy --only database` to the release checklist.

Until then: rules are managed in the Console. Keep this doc current.
