# C2 — `GLStore.RehearsalSession` Migration Map

**Tracking issue:** [#30 GrooveLinx Reality Audit](https://github.com/drewmerrill/deadcetera/issues/30) — Convergence Candidate C2
**Source audit:** [Audit #03 §Ownership Conflicts](./GROOVELINX_REALITY_AUDIT_03_PAGE_COVERAGE.md)
**Phase 1 build:** `20260513-…`
**Pattern reference:** `js/core/gl-practice-session.js` (`GLStore.PracticeSession`)

---

## Goal

Introduce `GLStore.RehearsalSession` as the **single chokepoint** for all Firebase access to `bands/{slug}/rehearsal_sessions/**`. Phase 1 is a **wrap-and-centralize** pass, not a redesign. No schema migration, no behavior change.

---

## Inventory — every current access point

Sorted by file. **Classification** uses these tags:
- **W** = writer (`.set()`, `.update()`, `.remove()`)
- **R** = reader (`.once('value')`)
- **S** = realtime subscriber (`.on('value', …)`)
- **safe-now** = wrap in Phase 1
- **deferred** = skip Phase 1 (complex pipeline / out-of-scope module / build-time script)
- **risky** = wrap only with explicit follow-up review

### File: `js/features/rehearsal.js` — Phase 1 target

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 236 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId)).set(session)` | safe-now | new-session creation flow |
| 252 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId)).update(updates)` | safe-now | append notes/songsWorked/recording_url |
| 311 | W | `db2.ref(bandPath('rehearsal_sessions/' + sessionId + '/audio_segments')).set(result.segments)` | safe-now | nested field write — needs `setField(sessionId, 'audio_segments', value)` helper |
| 1762 | R | `db.ref(bandPath('rehearsal_sessions')).once('value')` | safe-now | `_rhLoadSessions()` — entire-list load + sort |
| 1774 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId)).remove()` | safe-now | session delete |
| 3613 | R | `firebaseDB.ref(bandPath('rehearsal_sessions/' + sessionId)).once('value')` | safe-now | single-session load for timeline view |
| 3714 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId)).update({ mixdown_tag: next or null })` | safe-now | single-field update — tag toggle |

### File: `rehearsal-mode.js` — Phase 1 target

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 1155 | W | `db.ref(bandPath('rehearsal_sessions/' + summary.sessionId)).set(summary)` | safe-now | end-of-rehearsal session save |
| 1488 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId)).update(updates)` | safe-now | post-rating updates (notes / mixdown_id / rating / summary) |

### File: `js/features/multitrack-rehearsal.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 787 | W | `db.ref(bandPath('rehearsal_sessions/' + u.sessionId)).set(session)` | deferred | multitrack upload commit |
| 852 | R | `db.ref(bandPath('rehearsal_sessions/' + sessionId)).once('value')` | deferred | session metadata load |
| 1198 | R | `db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments')).once('value')` | deferred | comments thread load |
| 1214 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments/' + commentId)).set(comment)` | deferred | comment add |
| 1226 | W | `db.ref(bandPath('rehearsal_sessions/' + sessionId + '/comments/' + commentId)).remove()` | deferred | comment delete |
| 1467 | R | `firebaseDB.ref(bandPath('rehearsal_sessions/' + p.sessionId)).once('value')` | deferred | preview load |

**Why deferred:** task scope says "do NOT touch multitrack-rehearsal complex logic unless needed for compatibility." These read/write nested paths (`comments`, multitrack-specific fields) that the Phase 1 helpers don't yet model. Phase 2 will add `loadCommentsFor(sessionId)`, `addComment(sessionId, comment)`, etc.

### File: `js/core/recording-analyzer.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 732 | R | `firebaseDB.ref(bandPath('rehearsal_sessions')).orderByChild('date').limitToLast(5)` | deferred | recent-session lookup for context |
| 1534 | W | `firebaseDB.ref(bandPath('rehearsal_sessions/' + _currentSessionId + '/label_overrides/' + overrideKey)).set(value)` | deferred | label override write |
| 1547 | R | `firebaseDB.ref(bandPath('rehearsal_sessions/' + sessionId + '/label_overrides')).once('value')` | deferred | label override load |
| 2101 | — | `var sessPath = bandPath('rehearsal_sessions/' + _currentSessionId)` | deferred | path string used in later writes |
| 2216 | R | `firebaseDB.ref(bandPath('rehearsal_sessions')).orderByChild('date').limitToLast(10)` | deferred | recent-session lookup |
| 2293 | R | `firebaseDB.ref(bandPath('rehearsal_sessions/' + sourceId + '/songsWorked')).once('value')` | deferred | songsWorked extract |

**Why deferred:** task scope says "do NOT touch recording-analyzer pipelines." `label_overrides` and `songsWorked` are nested writes/reads the wrapper doesn't yet expose. Phase 2 will add `loadField(sessionId, fieldPath)` + `setField(...)`.

### File: `js/core/rehearsal-analysis-pipeline.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 343 | — | `firebase.database().ref('bands/' + slug + '/rehearsal_sessions/' + sessionId)` | deferred | direct slug ref bypasses `bandPath()` — wrapper assumes current band |
| 453 | W | `…/rehearsal_sessions/{sessionId}/analysis.set(analysis)` | deferred | analysis result write |
| 494 | R | `…/rehearsal_sessions/{sessionId}/analysis.once('value')` | deferred | analysis result load |
| 634 | R | `…/rehearsal_sessions … .once('value')` | deferred | bulk session scan |

**Why deferred:** uses direct `firebase.database().ref('bands/' + slug + …)` with explicit slug — the wrapper is keyed on the current band (`bandPath()`). Phase 2 needs an explicit-slug variant (`loadForBand(slug, sessionId)`).

### File: `js/core/gl-insights.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 575 | R | `firebase.database().ref('bands/' + slug + '/rehearsal_sessions').once('value')` | deferred | explicit-slug — same reason as analysis-pipeline |

### File: `js/core/gl-rehearsal-scheduling.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 363 | R | `db2.ref(bandPath('rehearsal_sessions')).once('value')` | deferred | scheduler reads session history. Trivial to migrate but not in Phase 1's "safest-highest-value" set; defer to Phase 2 to keep Phase 1 small. |

### File: `js/core/gl-rehearsal-agenda.js` — **read-only references**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 249, 299 | — | `rehearsalSessionSignals` (synthesized from in-memory data, not a Firebase ref) | n/a | not a Firebase access — purely a derived signal name |

### File: `js/core/groovemate_tools.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 530 | R | `db.ref(_bp('rehearsal_sessions')).limitToLast(10).once('value')` | deferred | AI-tool read. Defer to Phase 2 — small change, low risk, just not Phase 1's priority. |

### File: `js/features/band-feed.js` — **deferred**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 1695 | R | `db.ref(bandPath('rehearsal_sessions')).orderByChild('startedAt').limitToLast(1)` | deferred | "what's the latest session?" feed signal. Defer to Phase 2. |

### File: `js/features/calendar.js` — **NOT Firebase**

| Line | Op | Pattern | Tag | Notes |
|---|---|---|---|---|
| 508, 3140 | — | `loadBandDataFromDrive('_band', 'rehearsal_sessions')` | n/a | Drive-backed snapshot, not the Firebase realtime path. Wrapper covers Firebase only. |

### Files: `scripts/apply-golden-timeline*.js` — **build-time only**

| File | Tag | Notes |
|---|---|---|
| `scripts/apply-golden-timeline.js` | deferred-permanent | Node.js console scripts run by Drew at the terminal — different runtime (no GLStore), different concerns. Leave alone. |
| `scripts/apply-golden-timeline-0323.js` | deferred-permanent | Same. |

---

## Phase 1 deliverables

| Item | Status |
|---|---|
| `GLStore.RehearsalSession` module in `js/core/gl-rehearsal-session.js` | ✅ |
| Script tag wired into `index.html` + `index-dev.html` | ✅ |
| `rehearsal.js` 7 sites migrated | ✅ |
| `rehearsal-mode.js` 2 sites migrated | ✅ |
| `GLRouteLifecycle` disposer registered for `rehearsal` route | ✅ |
| Defensive console logging on write/read/remove | ✅ |
| `CANONICAL_SYSTEMS.md` updated | ✅ |
| `DATA_OWNERSHIP_RULES.md` updated | ✅ |
| `STABILIZATION_DASHBOARD.md` updated | ✅ |

---

## Phase 2 scope (NOT in this build)

| Group | Sites | New helpers needed |
|---|---|---|
| Nested field reads/writes (multitrack `comments`, recording-analyzer `label_overrides`, `songsWorked`) | 9 | `loadField(sessionId, path)`, `setField(sessionId, path, value)`, `removeField(sessionId, path)` |
| Explicit-slug access (analysis-pipeline, insights) | 5 | `loadForBand(slug, sessionId)`, `setForBand(slug, sessionId, payload)` |
| Limit-to-last queries (analyzer recent-5/10, feed latest-1) | 4 | `loadRecent(limit)` |
| Realtime subscriptions (none today — but the wrapper exposes `subscribe()` for future use) | 0 (potential) | `subscribe(handler)` returning unsubscribe fn, auto-registered with `GLRouteLifecycle` |
| `gl-rehearsal-scheduling.js` + `groovemate_tools.js` + `band-feed.js` | 3 | use `loadAll()` already exposed |
| `calendar.js` Drive-backed | 2 | separate concern; not Firebase |
| `scripts/apply-golden-timeline*.js` | 2 | permanent deferral; build-time only |

---

## Phase 1 fragmented-ownership status (post-merge)

- **Routed through `GLStore.RehearsalSession`:** 9 sites (rehearsal.js 7 + rehearsal-mode.js 2)
- **Still direct Firebase (deferred):** 19 sites
- **Not Firebase (out of scope):** 4 sites (calendar Drive-backed × 2, scripts × 2)
- **Total:** 32 access points across 12 files

Phase 1 covers the **user-facing primary writers** (the rehearsal page lifecycle + rehearsal-mode session save). Phase 2 covers the analysis pipeline, multitrack flow, and AI tools — all of which are either explicitly scoped out by the Phase 1 task brief or require helpers not yet built.

---

## Phase 2 status — **COMPLETE** (build `20260513-211446`, 2026-05-13)

### Helpers added to `gl-rehearsal-session.js`

| Helper | Signature | Notes |
|---|---|---|
| `loadField` | `(sessionId, fieldPath, opts?)` | Nested-field read via Firebase `/` nesting. opts.slug for explicit band. |
| `setField` | `(sessionId, fieldPath, value, opts?)` | Existing helper extended with opts.slug. Parent updatedAt/updatedBy stamped best-effort. |
| `removeField` | `(sessionId, fieldPath, opts?)` | Nested-field delete. Parent stamped. |
| `loadRecent` | `(limit, opts?)` | `orderByChild(opts.orderBy).limitToLast(limit)`. Default orderBy='date'. opts.slug supported. |
| `loadForBand` | `(slug, sessionId?)` | Thin wrapper. With sessionId → loadById(slug). Without → loadAll(slug). |
| `setForBand` | `(slug, sessionId, patchOrValue, opts?)` | Thin wrapper. opts.fieldPath → setField semantics. Otherwise update semantics. |

All existing helpers (`loadAll`, `loadById`, `create`, `update`, `setField`, `remove`) now accept `opts.slug` to target an explicit band rather than the current band.

### Site-by-site migration status

| File | Line | Op | Helper used | Fallback retained | Status |
|---|---|---|---|---|---|
| `groovemate_tools.js` | 530 | R `limitToLast(10)` | `loadRecent(10)` | yes | ✅ migrated |
| `band-feed.js` | 1695 | R `orderBy(startedAt).limitToLast(1)` | `loadRecent(1, {orderBy:'startedAt'})` | yes | ✅ migrated |
| `gl-rehearsal-scheduling.js` | 363 | R bulk load | `loadAll()` | yes | ✅ migrated |
| `recording-analyzer.js` | 732 | R `orderBy(date).limitToLast(5)` | `loadRecent(5, {orderBy:'date'})` | yes | ✅ migrated |
| `recording-analyzer.js` | 1534 | W nested `label_overrides/<key>` | `setField(sid, 'label_overrides/'+key, value)` | yes | ✅ migrated |
| `recording-analyzer.js` | 1547 | R nested `label_overrides` | `loadField(sid, 'label_overrides')` | yes | ✅ migrated |
| `recording-analyzer.js` | 2101-05 | W multi-field (notes/audio_segments/recording_context/plan_vs_actual) | `update(sid, patch)` | yes | ✅ migrated (4 ref calls collapsed into 1 update) |
| `recording-analyzer.js` | 2216 | R `orderBy(date).limitToLast(10)` | `loadRecent(10, {orderBy:'date'})` | yes | ✅ migrated |
| `recording-analyzer.js` | 2293 | R nested `songsWorked` | `loadField(sid, 'songsWorked')` | yes | ✅ migrated |
| `multitrack-rehearsal.js` | 787 | W new session | `create(sid, session)` | yes | ✅ migrated |
| `multitrack-rehearsal.js` | 852 | R single session | `loadById(sid)` | yes | ✅ migrated |
| `multitrack-rehearsal.js` | 1198 | R nested `comments` | `loadField(sid, 'comments')` | yes | ✅ migrated |
| `multitrack-rehearsal.js` | 1214 | W nested `comments/<id>` | `setField(sid, 'comments/'+cid, comment)` | yes | ✅ migrated |
| `multitrack-rehearsal.js` | 1226 | W nested `comments/<id>` remove | `removeField(sid, 'comments/'+cid)` | yes | ✅ migrated |
| `multitrack-rehearsal.js` | 1467 | R single session | `loadById(sid)` | yes | ✅ migrated |
| `rehearsal-analysis-pipeline.js` | 343 | R explicit-slug single | `loadForBand(slug, sid)` | yes | ✅ migrated |
| `rehearsal-analysis-pipeline.js` | 453 | W explicit-slug nested `analysis` | `setForBand(slug, sid, analysis, {fieldPath:'analysis'})` | yes | ✅ migrated |
| `rehearsal-analysis-pipeline.js` | 494 | R explicit-slug nested `analysis` | `loadField(sid, 'analysis', {slug})` | yes | ✅ migrated |
| `rehearsal-analysis-pipeline.js` | 634 | R explicit-slug `orderBy(date).limitToLast(1)` | `loadRecent(1, {slug, orderBy:'date'})` | yes | ✅ migrated |
| `gl-insights.js` | 575 | R explicit-slug bulk | `loadForBand(slug)` | yes | ✅ migrated |

**19 of 19 deferred sites migrated.** All preserve canonical+fallback shape: when `GLStore.RehearsalSession.X` is unavailable (stale SW shell), the direct-Firebase path runs verbatim.

### Permanent exceptions (intentionally NOT migrated)

| File | Why |
|---|---|
| `js/features/calendar.js:508, 3140` (`loadBandDataFromDrive('_band', 'rehearsal_sessions')`) | Drive-backed snapshot, NOT the Firebase realtime path. Wrapper covers Firebase only. |
| `scripts/apply-golden-timeline.js`, `scripts/apply-golden-timeline-0323.js` | Build-time Node scripts. No GLStore available at that runtime. |

### Final fragmented-ownership status (post Phase 2)

- **Routed through `GLStore.RehearsalSession` (canonical path):** 28 sites (Phase 1: 9 + Phase 2: 19)
- **Permanent exceptions:** 4 sites (calendar Drive-backed × 2, scripts × 2)
- **Cached-shell legacy fallback branches:** 28 (one per migrated site — preserved verbatim for stale SW safety)
- **Unprotected direct Firebase refs:** **0**

`GLStore.RehearsalSession` is the canonical owner of `bands/{slug}/rehearsal_sessions/**`. The convergence initiative C2 is **fully resolved**.
