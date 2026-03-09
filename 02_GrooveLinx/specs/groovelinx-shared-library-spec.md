# GrooveLinx — Shared Library & Hybrid Data Model Spec
**Product + Data Architecture for Private Band Workspaces + Optional Public Asset Library**

---

## 1. Core Design Principle

GrooveLinx uses a **two-layer model**:

- **Band workspace** (`/bands/{slug}/`) — always private, always isolated. Operational data lives here. Only band members can read or write.
- **Global library** (`/library/`) — opt-in public space. Any band can publish assets here. Any band can fork them. Publishing is an explicit, voluntary act — nothing leaks automatically.

A band's song record is always private. The *musical content* of that song (chart, DNA, resources) can optionally be published to the library as a separate document that points back to its origin.

---

## 2. What Always Stays Private

These data types must never be publishable, shareable, or readable by anyone outside the band. No visibility setting can make them public.

| Data Type | Reason |
|---|---|
| Gig records (dates, venues, setlists) | Operational + security risk |
| Gig financials (payouts, expenses) | Private business data |
| Rehearsal session records | Internal operational history |
| Member profiles, roles, UID mapping | PII + access control |
| Invite tokens | Security |
| Readiness scores / heatmap data | Internal band health |
| Care packages | Private comms |
| RSVP / availability | Internal scheduling |
| Band meta (name, creation date, slug) | Discoverable only if band opts in |
| Crib notes | Personal performance notes — implicitly private |
| Practice plan / Woodshed progress | Internal workflow |

---

## 3. Data Types That Can Be Optionally Shared

These are *musical content assets* — they have value to other musicians and no operational sensitivity.

| Asset Type | What It Contains | Share Granularity |
|---|---|---|
| **Chord chart** | Chord shapes, key, capo, sections | Per song |
| **Song DNA** | Arrangement notes, feel description, key influences | Per song |
| **North Star version** | Best reference version with notes | Per song |
| **Arrangement template** | Section structure (intro/verse/chorus/jam/outro) | Per song |
| **Woodshed checklist template** | Role-specific practice steps | Per instrument role |
| **Stage crib notes** (curated) | Key performance reminders, stripped of personal notes | Per song, per role |
| **BPM / key metadata** | Tempo, key, time signature, feel | Per song |
| **Song resources** | Tabs, links, YouTube refs, Archive IDs | Per song |

A band publishes a **snapshot** of these fields at a point in time. The band's live copy stays in `/bands/{slug}/` — the library copy is always a separate document.

---

## 4. Global Library Schema

### `/library/songs/{libraryId}/`

```
{
  // ── Identity ──────────────────────────────────────────────────────────
  libraryId:         string,     // Firebase push key
  title:             string,     // Song title (normalized, searchable)
  artist:            string,     // Original artist / band

  // ── Provenance ────────────────────────────────────────────────────────
  sourceSlug:        string,     // Publishing band slug ("deadcetera")
  sourceSongKey:     string,     // Key in /bands/{slug}/songs/{key} at publish time
  publishedBy:       string,     // UID of member who published
  publishedAt:       number,     // Unix timestamp
  updatedAt:         number,     // Timestamp of last library update
  version:           number,     // Integer, increments on each republish (starts at 1)
  changelog:         string,     // Optional: what changed in this version

  // ── Visibility ────────────────────────────────────────────────────────
  visibility:        'public' | 'unlisted',
  // public   = searchable, shows up in browse
  // unlisted = only accessible via direct link / libraryId

  // ── Musical Content (the shareable fields) ────────────────────────────
  key:               string,     // e.g. "E minor"
  bpm:               number,
  timeSig:           string,     // e.g. "4/4"
  feel:              string,     // e.g. "Slow blues shuffle"
  capo:              number | null,

  chart: {
    text:            string,     // Full chord chart text
    format:          'plain' | 'chordpro' | 'abc',
  },

  dna: {
    overview:        string,
    arrangement:     string,     // Section map
    vibe:            string,
    keyInfluences:   string[],
  },

  northStar: {
    artist:          string,
    date:            string,
    venue:           string,
    archiveId:       string | null,
    notes:           string,
    url:             string | null,
  },

  woodshedTemplates: {
    // keyed by instrument role
    [role: string]: [
      { text: string, phase: 'solo' | 'rehearsal' | 'gig' }
    ]
  },

  resources: [
    {
      type:    'tab' | 'youtube' | 'archive' | 'relisten' | 'link',
      label:   string,
      url:     string,
    }
  ],

  // ── Fork Lineage ──────────────────────────────────────────────────────
  forkedFrom:        string | null,   // libraryId this was forked from, if any
  forkDepth:         number,          // 0 = original, 1 = fork, 2 = fork of fork

  // ── Social signals (MVP: skip; later: add) ────────────────────────────
  // forkCount:      number,
  // endorsements:   number,
}
```

### `/library/songs/{libraryId}/` — Index fields (denormalized for query performance)

```
/library/_index/byTitle/{normalizedTitle}/{libraryId}  → true
/library/_index/byArtist/{normalizedArtist}/{libraryId} → true
/library/_index/bySlug/{sourceSlug}/{libraryId}        → true
```

These allow cheap queries like "all library entries published by deadcetera" or "all charts for 'Scarlet Begonias'" without a full scan.

---

## 5. Band-Level Override / Fork Model

When a band imports or forks a library asset, it creates a **private copy** in their band workspace. The original library record is never modified.

### `/bands/{slug}/songs/{songKey}/libraryImport/`

```
{
  libraryId:         string,     // Source library record
  importedAt:        number,
  importedVersion:   number,     // Version number at time of import
  importedBy:        string,     // UID
  overrides: {
    // Any field listed here is the band's customized version.
    // Fields NOT listed here inherit from the library snapshot at import time.
    // This is NOT a live link — importing is always a snapshot copy.
    chart:           { ... } | null,
    dna:             { ... } | null,
    bpm:             number | null,
    key:             string | null,
    woodshedTemplates: { ... } | null,
    // etc.
  },
  diverged:          boolean,    // true once any override has been saved
  updateAvailable:   boolean,    // true if library.version > importedVersion
  // (app checks this on song open and can prompt "A newer version is available — update or keep yours")
}
```

### Fork rules

- **Import** = copy the library snapshot into `libraryImport` with no overrides. Band sees unmodified library content.
- **Customize** = band edits any field → that field goes into `overrides`, `diverged` flips to `true`. Other fields still show the original import snapshot.
- **Publish fork** = band can push their customized version back to the library as a new record with `forkedFrom = originalLibraryId`. Their overrides become the new library record's content.
- **Update** = when `updateAvailable` is true, band can pull in the new library version. Any fields they've overridden are protected — only non-overridden fields update. App shows a diff and asks for confirmation.

---

## 6. Visibility Settings

### Per-asset visibility (on the library record)

| Setting | Searchable | Accessible by link | Accessible by fork |
|---|---|---|---|
| `public` | ✅ | ✅ | ✅ |
| `unlisted` | ❌ | ✅ | ✅ |
| (removed / unpublished) | ❌ | ❌ | ❌ (existing forks keep their copy) |

### Band-level publishing permission

```
/bands/{slug}/meta/libraryPublishingEnabled   → boolean (default: false)
```

Admins must explicitly enable publishing before any member can push to the library. This prevents accidental publishing from a default-on setting.

### Member-level publishing permission

```
/bands/{slug}/members/{uid}/canPublish   → boolean (default: false)
```

Even with band-level publishing enabled, individual members need the `canPublish` flag. Only admins can grant it.

---

## 7. Provenance & Versioning Fields

Every library record carries a full audit trail. Key fields:

| Field | Type | Purpose |
|---|---|---|
| `sourceSlug` | string | Which band originally created this |
| `sourceSongKey` | string | Traceability back to band's private record |
| `publishedBy` | UID | Who hit publish |
| `publishedAt` | timestamp | First publish time (never changes) |
| `updatedAt` | timestamp | Last republish |
| `version` | integer | Increments on every republish; forks inherit and continue independently |
| `changelog` | string | Human-readable note on what changed (optional but encouraged) |
| `forkedFrom` | libraryId | Direct parent in fork chain; null for originals |
| `forkDepth` | integer | How many hops from the original (cap display at ~3 for UI clarity) |

Bands' private `libraryImport.importedVersion` is compared against `library.version` to detect available updates.

**Versions are immutable snapshots.** Once published, a version is never edited — republishing increments the version number and writes a new record. Old versions are not stored (MVP); version history is a later-phase feature.

---

## 8. Firebase Path Recommendations

```
/                                         ← root
│
├── bands/                                ← PRIVATE: all band data
│   └── {slug}/
│       ├── meta/                         ← band identity, admin settings
│       │   └── libraryPublishingEnabled
│       ├── members/{uid}/
│       │   └── canPublish
│       ├── songs/{songKey}/
│       │   ├── [all existing fields]     ← always private
│       │   └── libraryImport/            ← added when song is imported
│       │       ├── libraryId
│       │       ├── importedVersion
│       │       ├── overrides/
│       │       ├── diverged
│       │       └── updateAvailable
│       ├── setlists/                     ← always private
│       ├── gigs/                         ← always private
│       ├── rehearsals/                   ← always private
│       ├── venues/                       ← always private
│       ├── readiness/                    ← always private
│       └── crib_notes/                   ← always private
│
├── library/                              ← PUBLIC (read); restricted write
│   ├── songs/{libraryId}/                ← full asset record
│   └── _index/
│       ├── byTitle/{normalized}/{id}     → true
│       ├── byArtist/{normalized}/{id}    → true
│       └── bySlug/{slug}/{id}            → true
│
└── care_packages_public/{id}/            ← PUBLIC read, server-write only
```

---

## 9. Security Rule Implications

### Library reads — fully public

```json
"library": {
  "songs": {
    "$libraryId": {
      ".read": true,
      ".write": false
    }
  },
  "_index": {
    ".read": true,
    ".write": false
  }
}
```

All library writes must go through the Worker (server-side), never from the browser client directly. The Worker validates band membership, `canPublish` flag, and schema before writing.

### Library writes — Worker only

The Worker uses a Firebase service account (Admin SDK) to write to `/library/`. No client-side write rules for library paths. If someone tries to write directly from the browser, the rule returns `false`.

```json
"library": {
  ".write": false,   // client writes always denied
  ...
}
```

### Band-level publishing flag check (in Worker)

Before the Worker writes a library record it must verify:

1. Requestor's `auth.uid` is in `/bands/{slug}/members/{uid}`
2. `/bands/{slug}/meta/libraryPublishingEnabled` is `true`
3. `/bands/{slug}/members/{uid}/canPublish` is `true`
4. The `sourceSongKey` belongs to that band's songs

### Index write — Worker maintains

The Worker writes index entries atomically with the library record using Firebase `update()` multi-path writes so index and record are always in sync.

### Fork / import — client writes to band workspace only

When a band imports a library asset, the browser writes to `/bands/{slug}/songs/{songKey}/libraryImport/` — a path already governed by the existing band membership rules. No new rules needed.

---

## 10. MVP vs Later Phases

### MVP (ship this)

The smallest version that delivers real value and doesn't require new UI complexity.

**Data model:**
- Library schema as defined above (full fields, no shortcuts — schema debt is expensive)
- `libraryImport` block on band songs
- Index paths (`byTitle`, `byArtist`, `bySlug`)

**Features:**
- Admin can enable publishing for band
- Admin can grant `canPublish` to members
- Member with `canPublish` can publish a song's chart + DNA + BPM/key to library (visibility: `public` or `unlisted`)
- Any authenticated user can search/browse library by title or artist
- Any band member can import a library song → creates `libraryImport` snapshot in their private song record
- App shows "imported from [band] · version X" badge on song detail
- Basic update detection: if `updateAvailable` is true, show "New version available" notice on song detail

**Worker endpoints needed:**
- `POST /library/publish` — validates, writes library record + index
- `POST /library/unpublish` — removes library record, clears index (existing forks unaffected)
- `GET /library/search?q=&artist=` — queries index, returns records
- `POST /library/import` — writes `libraryImport` to band song (could also be client-side)

**Skip for MVP:**
- Fork-back-to-library (import → customize → republish as fork)
- Version history / changelog UI
- Update merge UI (just show the notice; user manually re-imports if they want latest)
- Woodshed template sharing
- Social signals (fork count, endorsements)
- Band discovery (finding bands by slug)
- Per-field override diff UI

---

### Phase 2

- Fork-back publishing (band customizes import → publishes as fork with `forkedFrom` lineage)
- Update merge UI: show field-by-field diff, allow selective pull of new library fields while protecting overrides
- Woodshed template sharing (publish/import per instrument role)
- Changelog entry on publish
- "Published by" display name (band name, not slug) on library records

### Phase 3

- Version history stored (append-only archive of past versions)
- Social signals: fork count, endorsement/star
- Band profiles: opt-in public band page listing their library contributions
- GrooveLinx curated picks: admin-flagged high-quality entries
- Bulk import: "import all Grateful Dead charts published by [slug]"
- Export library record as PDF chart / print view

---

## 11. Key Design Decisions & Rationale

**Why not a live link between band song and library record?**
Live links create fragile cross-band dependencies. If a band unpublishes or edits their library record, other bands' songs would break or silently change. Snapshot-on-import is safer, more predictable, and respects band autonomy.

**Why require explicit `canPublish` per member?**
Publishing puts content into a shared space under the band's name. It should be a deliberate, permissioned act — not something a new member can accidentally do.

**Why keep provenance fields on the library record instead of a separate audit log?**
Keeps reads cheap (one fetch gets everything) and makes provenance visible in search results without a second query. A separate audit log is a Phase 3 feature.

**Why index paths instead of Firebase queries?**
Firebase Realtime Database doesn't support ad-hoc queries. Index paths (`/library/_index/byTitle/...`) are the standard pattern for enabling title/artist search without scanning the entire library. At scale, migrate to Firestore or Algolia for full-text search.

**Why Worker-only writes to `/library/`?**
Prevents any client-side injection of malformed or malicious library records. The Worker is the single point of validation — schema enforcement, permission checks, and index maintenance all happen in one place.
