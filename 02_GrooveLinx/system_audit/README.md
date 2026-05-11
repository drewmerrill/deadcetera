GrooveLinx Architecture Audit Artifacts

This folder contains the analysis documents produced during the
GrooveLinx navigation and UI architecture review.

Files include:

- origin/return behavior audit
- context state audit
- navigation inconsistency audit
- navigation repair plan
- band command center UI blueprint
- screen behavior specification

These documents guide the GrooveLinx shell pivot implementation.

---

## Related audits & references (added 2026-05-11)

- `../notes/store_architecture_audit.md` — state management around `groovelinx_store.js`. Updated 2026-05-11 with the new `window._glSafeCache` shared SWR helper + the two new band-scoped caches (`gl_song_library_<slug>`, `gl_sdget_<slug>_*`) layered on top.
- `../audits/calendar_integration_audit_2026-05-04.md` — Google Calendar sync engine + schema + OAuth surface.
- `../notes/spotify_diagnostic_toolkit.md` — diagnostic console snippets + 10-minute pre-rehearsal smoke test plan (added 2026-05-11 ahead of live UAT rehearsal).
- `../notes/uat_bug_log.md` — running ledger of UAT fixes. Top entries (5/10–5/11) cover SWR setlist clobber, Spotify Connect Phases 1–5, defensive moats (token refresh, Premium detection, device picker, race guard, network retry, wake recovery, etc.), iPhone perf SWR caches.

## Architecture diagrams (hidden / `noindex`)

- `/architecture-deep-dive.html` — click-to-trace module + flow diagram. Refreshed 2026-05-11 to reflect new Spotify moats + cache layer.
- `/stack-map.html` — architecture map. Refreshed 2026-05-11.