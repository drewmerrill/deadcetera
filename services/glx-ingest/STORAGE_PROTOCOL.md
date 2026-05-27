# Post-rehearsal storage protocol

Recommended discipline for two-card X-Live rotation + weekly rehearsals + the new ingest-first pipeline (per `TONIGHT_OVERNIGHT_INGEST.md`).

## Storage layers + size per rehearsal

| Layer | Size | Lifespan |
|---|---|---|
| SD card source chunks | ~67 GB (a 3-hour rehearsal · 17 × 4 GB FAT32 chunks) | One week (until next week's record + verify) |
| Local Mac `~/Rehearsals/<date>/source/` | ~67 GB | 30 days (re-upload safety net) |
| Local Mac `~/Rehearsals/<date>/FULL_REHEARSAL.wav` | ~64 GB | Delete after Review Mode verification |
| Local Mac `~/Rehearsals/<date>/ingest_metadata.json` + `ingest.log` | ~3 KB total | Forever (permanent provenance) |
| R2 — per-channel FLACs at `multitrack/deadcetera/{sid}/*.flac` | ~25-30 GB (17 channels × ~1.5 GB) | Indefinite (subject to quarterly review) |
| R2 — rendered mixdown at `multitrack/deadcetera/{sid}/renders/mix_default/*.mp3` | ~150 MB | Indefinite |
| Firebase `rehearsal_sessions/{sid}` | ~10 KB | Forever |

## Same-day / next-morning (after every rehearsal)

### 1. Verify the ingest landed

The only honest test:

- Open the new session in Review Mode
- Hit play; confirm at least 30 seconds of audio plays
- Toggle Isolate Mode; confirm at least two per-instrument tracks play independently

If anything's off, don't proceed to wipe steps. Investigate first.

### 2. Free local Mac storage

After verification:

```bash
rm ~/Rehearsals/<date>/FULL_REHEARSAL.wav   # frees ~64 GB
```

**Keep:**
- `~/Rehearsals/<date>/source/` (the chunks) — re-upload safety net for the next ~30 days
- `~/Rehearsals/<date>/ingest_metadata.json` + `~/Rehearsals/<date>/ingest.log` — permanent provenance, ~3 KB

### 3. Wipe the SD card that was just used

Reformat in the X32 (so it's ready for next rehearsal at the right format / partition).

**Hard rule: never wipe both cards back-to-back.** The just-used card always holds your most-recent unverified rehearsal as physical backup until next week's verification.

## Weekly rotation (the two-card system)

```
Week N  : Card A in X32 → record → ingest → verify → wipe Card A → store in bag
Week N+1: Card B in X32 → record → ingest → verify → wipe Card B → store in bag
Week N+2: Card A in X32 → record → ingest → verify → wipe Card A → store in bag
…
```

At any moment, the card NOT in the X32 holds the last unwiped rehearsal as a physical fallback. The card IN the X32 has either a fresh wipe (start of rehearsal) or this week's recording (end of rehearsal, pre-wipe).

## Monthly (~30 days after each rehearsal)

```bash
# Find local sources > 30 days old
find ~/Rehearsals -maxdepth 2 -type d -name "source" -mtime +30
# Delete them
find ~/Rehearsals -maxdepth 2 -type d -name "source" -mtime +30 -exec rm -rf {} \;
```

This frees ~67 GB per rehearsal cleared. The chunks have served their re-upload-safety-net purpose by now.

`ingest_metadata.json` and `ingest.log` stay forever (3 KB per rehearsal = ~150 KB over 52 weeks = negligible).

## Quarterly (every ~3 months — review R2 cost)

R2 storage runs ~$0.015/GB/month. Cost trajectory at ~30 GB per weekly rehearsal:

| Time | Cumulative R2 | Monthly cost |
|---|---|---|
| 3 months | ~360 GB | ~$5.50 |
| 6 months | ~720 GB | ~$11 |
| 12 months | ~1.5 TB | ~$23 |
| 24 months | ~3 TB | ~$45 |

At ~12-18 months you'll likely want to choose a policy. Options:

- **(a) Keep everything forever** — accept the linear cost growth (~$25-50/month at maturity)
- **(b) Tier old rehearsals** — keep the rendered mixdown MP3 (~150 MB each) forever; delete per-channel FLACs older than 6 months. Loses Isolate Mode for tiered sessions, keeps single-stream playback. Storage drops to ~$1/year of back catalog.
- **(c) Annual pruning** — keep current-year rehearsals in full; for prior years, keep only mixdowns + selected "keepers" (the ⭐ Keeper flag is already in the app for this)

No decision needed now. Just track + revisit at quarterly check-ins.

## Failure recovery — what's the fallback at each layer

| Failure mode | Recovery source | Window |
|---|---|---|
| R2 session corrupts mid-week | Re-upload from local `~/Rehearsals/<date>/source/` | 30 days |
| Local source deleted + R2 corrupted | The other (just-used) SD card still holds last week's rehearsal | ~1 week (until its wipe) |
| Both cards wiped AND R2 corrupted AND local source deleted | Rehearsal is gone | — |

The protocol above is designed so this last row is **operationally impossible** under normal use: at no point are both cards wiped while R2 + local both contain the rehearsal. There's always at least one physical backup.

## Quick reference — what to delete when

```
After verification:           rm FULL_REHEARSAL.wav        (~64 GB)
After verification:           reformat the used SD card    (~67 GB on card)
30 days after ingest:         rm -rf source/               (~67 GB)
NEVER delete:                 ingest_metadata.json, ingest.log
NEVER wipe both cards:        always keep at least one as physical backup
```

## Future enhancement candidates (NOT for tonight)

- "✓ Verified, free local storage" button on the cockpit `Ready` state that runs the local cleanup
- Cockpit reminder: "Card N has been ingested + verified — safe to wipe"
- Storage dashboard showing R2 footprint per rehearsal + total
- Tier-based archival automation
- Backup-to-second-cloud (e.g., B2) for the truly-paranoid moat

These are explicitly future. Pass 1 is just: have a clear human protocol, document it, follow it.
