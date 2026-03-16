# GrooveLinx Song Record Schema

_Last updated: 2026-03-16_

## Canonical Storage Path

```
bands/{bandSlug}/songs_v2/{songId}/{fieldName}
```

Legacy path (read fallback only, dual-written during migration):
```
bands/{bandSlug}/songs/{sanitizedTitle}/{fieldName}
```

## Identity Fields (in data.js / allSongs[])

| Field | Type | Example | Notes |
|-------|------|---------|-------|
| `songId` | string | `"gd_althea"` | Canonical identity. Seed: `{artist}_{slug}`. Custom: `c_{shortId}`. |
| `title` | string | `"Althea"` | Display name. NOT identity. May contain suffixes like "(WSP)" during transition. |
| `artist` | string | `"GD"` | Source artist/band. First-class field as of Phase 2A. |
| `band` | string | `"GD"` | Legacy alias for artist. Kept for backward compat. |
| `isCustom` | boolean | `true` | True for user-added songs (not in seed data.js). |
| `originType` | string | `"seed"` / `"custom"` / `"pack"` | Future: tracks lineage for jam pack imports. |

## Song DNA (Core Metadata)

| Field | Firebase dataType | Payload shape | v2 enabled | Notes |
|-------|------------------|---------------|------------|-------|
| BPM | `song_bpm` | `{ bpm: number, updatedAt: string }` | Yes | Valid range: 40-240 |
| Key | `key` | `{ key: string, updatedAt: string }` | Yes | e.g. "G", "Am", "Bb" |
| Lead Singer | `lead_singer` | `{ singer: string }` | Yes | Member key: "drew", "chris", etc. |
| Status | `song_status` | `{ status: string, updatedAt: string }` | Yes | Lifecycle values: "", "prospect", "active", "parked", "retired". Legacy "wip"/"gig_ready" accepted on read. |
| Song Roles | `song_roles` | `{ [memberKey]: instrument }` | Planned (Phase B) | e.g. `{ drew: "guitar", jay: "drums" }` |
| Song Votes | `song_votes` | `{ [memberKey]: 'yes'\|'maybe'\|'no', _updatedAt: string }` | Yes | Prospect voting: "Should we learn this?" |

## Song Content

| Field | Firebase dataType | Payload shape | v2 enabled | Notes |
|-------|------------------|---------------|------------|-------|
| Chart | `chart` | `{ text: string, importedAt?: string }` | Yes | Chord chart / lyrics text |
| Personal Tabs | `personal_tabs` | `[ { url, label, memberKey, addedBy } ]` | Yes | Per-member crib notes and links |
| Rehearsal Notes | `rehearsal_notes` | `[ { text, author, date, priority } ]` | Yes | Rehearsal observations |

## Reference Versions

| Field | Firebase dataType | Payload shape | v2 enabled | Notes |
|-------|------------------|---------------|------------|-------|
| Spotify/Ref Versions | `spotify_versions` | `[ { url, title, platform, votes, notes, addedBy, dateAdded } ]` | Yes | Reference recordings |
| Practice Tracks | `practice_tracks` | `[ { url, label, addedBy } ]` | Yes | Practice backing tracks |
| Cover Me | `cover_me` | `[ { artist, url, description, addedBy, addedAt } ]` | Yes | Cover version references. Legacy entries may have `name`/`notes` instead of `artist`/`description`. |

## Not Yet Migrated (Firebase-direct paths)

| Field | Firebase path | Shape | Migration status |
|-------|-------------|-------|-----------------|
| Best Shot Takes | `best_shot_takes` (Drive) | `[ { ... } ]` | Deferred — 5 write paths in bestshot.js |
| Readiness | `songs/{title}/readiness` (Firebase direct) | `{ [memberKey]: number }` | Deferred — dual-source (per-song + master file) |
| Section Ratings | `songs/{title}/section_ratings` (Firebase direct) | `{ [section]: { [memberKey]: number } }` | Deferred — Firebase-direct pattern |
| Metadata | `songs/{title}/metadata` (Firebase direct) | `{ structure, key, ... }` | Deferred — general-purpose bucket |

## Recording Asset Model (Target Architecture)

All recording/media assets will converge on a unified schema organized by PURPOSE, not platform.

### Canonical Recording Asset

```
{
  recordingId,    // auto-generated short ID
  type,           // 'north_star' | 'best_shot' | 'cover' | 'instruction' | 'practice_track' | 'session_capture'
  sourceType,     // 'spotify' | 'youtube' | 'archive_org' | 'apple_music' | 'soundcloud' | 'upload_audio' | 'upload_video' | 'moises' | 'fadr' | 'midi' | 'url'
  title,          // display label
  artist,         // artist/band
  url,            // playback URL
  description,    // optional notes
  scope,          // 'song' | 'section' | 'part' | 'session'
  part,           // 'rhythm_guitar' | 'bass' | 'harmony' | null
  section,        // 'intro' | 'verse' | null
  addedBy,
  addedAt,
  isPrimary,      // true = crowned north star / best shot
  votes,          // { [memberKey]: boolean }
  metadata        // { bpm, key, duration, quality, archiveId, etc. }
}
```

### Target Storage Path (future)

```
songs_v2/{songId}/recordings → [ recording, recording, ... ]
```

### Current → Target Mapping

| Current field | Recording type | Status |
|---|---|---|
| `spotify_versions` | `north_star` (voted primary) + references | Active — rename later |
| `best_shot_takes` | `best_shot` | Active — migrate to v2 then unify |
| `cover_me` | `cover` | Active — normalized |
| `practice_tracks` | `practice_track` | Active |
| (new) | `instruction` | Planned |
| (new) | `session_capture` | Planned |

### UI Buckets (what musicians see)

1. North Star — "The version we're chasing"
2. Best Shot — "Our best take so far"
3. Cover Me — "Other artists' takes for inspiration"
4. Learn It — "Lessons and walkthroughs"
5. Practice With It — "Backing tracks and stems"
6. Sessions — "Raw rehearsal and gig recordings"

### Migration Plan

1. Document model (done)
2. New recording types use unified schema from day one
3. Existing fields gradually normalize on edit/re-save
4. Old arrays become read-only fallback
5. Playlists built as views over unified recordings

## Playlist Strategy

Playlists are views over recording assets, not separate link collections.

### Auto-Generated Playlists (from intelligence data)

| Playlist | Source |
|----------|--------|
| Next Rehearsal North Stars | Agenda songs → north_star recordings |
| Best Shots to Review | best_shot recordings, newest first |
| Cover Inspirations | cover recordings across library |
| {Instrument} Learn Queue | instruction recordings filtered by part |
| Harmony Practice Queue | practice_track recordings where part = harmony |
| Gig Prep Listening Pack | Setlist songs → north_star recordings |
| Songs Needing Work | Priority queue songs → north_star recordings |

### Custom Playlists

User-curated from any recording assets. Store `[ { songId, recordingId } ]` references.

## Separate Paths (Intentionally NOT in songs_v2)

| Field | Firebase path | Notes |
|-------|-------------|-------|
| Pocket Meter session BPM | `songs/{songKey}/bpm` | Live session consensus, not canonical song BPM |
| Pocket Meter live broadcast | `songs/{songKey}/liveBPM` | Ephemeral real-time value |

## Rules

1. Every song-linked field must appear in this schema document.
2. Any new field added to songs_v2 must update this schema.
3. All write paths for a field must use the same canonical payload shape.
4. Migration work must maintain compatibility with this structure.
5. Reads try v2 path first, fall back to legacy. Writes dual-write to both.
