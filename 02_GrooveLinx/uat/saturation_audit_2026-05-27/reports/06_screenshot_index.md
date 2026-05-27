# Screenshot Index — Saturation Audit 2026-05-27

Build: `20260527-005638`

All screenshots are full-page PNG unless noted (viewport-only).

## Desktop (1440 × 900) — `desktop/`

| # | File | Surface | Notes |
|---|---|---|---|
| 01 | `01-home-full.png` | Home dashboard | Baseline, first load — focus = Frankenstein, 35/42 locked, attendance ✅ |
| 02 | `02-songs-full.png` | Songs (Band) | 63 active, table view, "Work on this next: One Way Out" |
| 03 | `03-practice-full.png` | Practice (Solo) | "Today's Focus" top-5 starting with In Memory of Elizabeth Reed |
| 04 | `04-rehearsal-full.png` | Rehearsal (Band) | "TONIGHT'S REHEARSAL · Transitions for Southern Roots Tavern" |
| 05 | `05-schedule-full.png` | `#schedule` (broken) | Renders Home content — F-006 |
| 06 | `06-setlists-full.png` | Setlists | Upcoming + Recent + lock states |
| 07 | `07-calendar-full.png` | Calendar | Month grid + sync block + maintenance |
| 08 | `08-stageplot-full.png` | `#stagePlot` (broken) | Renders Home — F-011 |
| 09 | `09-stale-state-lamination.png` | `#stage-plot` after `#calendar` | URL/breadcrumb/heading/body all from different surfaces — F-013 |
| 10 | `10-rehearsal-fresh.png` | Rehearsal after hard reload | Baseline for DOM heading count (18 hidden) |
| 11 | `11-tuner.png` | Tuner | Chromatic, mic input |
| 12 | `12-metronome.png` | Metronome | BPM controls |
| 13 | `13-playlists.png` | Playlists | Disambiguates from Setlists in copy |
| 14 | `14-gigs.png` | Gigs | Per-gig lineup completeness, member status, role coverage — G-004 |
| 15 | `15-stageplot.png` | Stage Plot (lowercase route works) | Surface exists at `#stageplot` |
| 16 | `16-venues.png` | Venues | Includes "PERMANENTLY CLOSED" decoration on archived venues |
| 17 | `17-contacts.png` | Contacts (Admin) | |
| 18 | `18-feed.png` | Feed | "Could not load feed. Retry" — F-016 |
| 19 | `19-equipment.png` | Equipment (Admin) | Per-member gear inventory |
| 20 | `20-help.png` | Help | 9-category index |
| 21 | `21-mode-menu.png` | Mode menu (viewport) | Initial state |
| 22 | `22-stoner-mode.png` | Stoner Mode active | Three-button intent menu — G-005 |
| 23 | `23-admin-settings.png` | Admin / Settings | Profile tab, GrooveMate dial — G-007 |
| 24 | `24-song-detail-one-way-out.png` | Song detail drawer | Full chart + 4-step plan + per-member readiness — G-006 |
| 30 | `30-continuity-jackstraw-before-reload.png` | Songs with Jack Straw drawer open | Pre-reload state (viewport-only) |
| 31 | `31-continuity-jackstraw-after-reload.png` | Songs after reload | Drawer not restored — F-020 |
| — | `route-probe.json` | Programmatic route map | 36 routes, breadcrumb + heading + first words each |

## iPad landscape (1024 × 768) — `ipad-landscape/`

| # | File | Surface | Notes |
|---|---|---|---|
| 01 | `01-home.png` | Home | Left rail 200px, right panel 219px both visible — chrome heavy |

## iPad portrait (768 × 1024) — `ipad-portrait/`

| # | File | Surface | Notes |
|---|---|---|---|
| 01 | `01-home.png` | Home | Left rail collapsed; right panel still 219px — F-017 |
| 02 | `02-songs.png` | Songs | Right panel still consumes width |
| 03 | `03-rehearsal.png` | Rehearsal | Plan + top 5 visible |
| 04 | `04-calendar.png` | Calendar | Month grid + sync block |

## iPhone (390 × 844, iPhone 14) — `iphone/`

| # | File | Surface | Notes |
|---|---|---|---|
| 01 | `01-home.png` | Home (first nav) | Slide menu visible — likely residual from resize |
| 02 | `02-home-fresh-reload.png` | Home after hard reload | Mobile baseline; slide menu hidden at `x=-300` |
| 03 | `03-songs.png` | Songs | Table-to-list-ish reflow |
| 04 | `04-rehearsal.png` | Rehearsal | |
| 05 | `05-calendar.png` | Calendar | |
| 06 | `06-gigs.png` | Gigs | |
| 07 | `07-song-detail.png` | Song detail (One Way Out) | Drawer drives main content |
| 08 | `08-slide-menu-open.png` | Slide menu attempt | Logo click failed (intercepted by now-playing chip); menu did NOT open — F-018 confirmation |

## Console — `console/`

- `all-errors.log` — Returns 0 errors at session end (the Feed error was during navigation; cleared after move-on)
- `all-warnings.log` — 2 UX hesitation telemetry entries

## Live findings log — `FINDINGS_LIVE.md`

Append-only running log captured during the traversal. Source of truth for the reports.

---

## Coverage statement

Desktop coverage is deep. iPhone coverage is sufficient for the navigation findings that emerged. iPad-landscape is light — a future pass would deepen it, but findings at iPad-portrait (F-017) suggest no surprise versus desktop+portrait behavior beyond the persistent right panel.

No Rehearsal Mode / Live Gig Mode / Review Mode were entered — these are state-dependent and would have required active multitrack / live gig context that the audit did not synthesize.
