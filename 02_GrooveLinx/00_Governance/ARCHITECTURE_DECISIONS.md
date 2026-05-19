# GrooveLinx — Architecture Decisions

Last Updated: 2026-05-12

## Frontend
- Vanilla JS SPA
- Firebase Realtime Database
- GitHub + Vercel deployment flow

---

## State Management

Direction:
- GLStore becomes the primary shared state layer
- reduce duplicated local state logic
- unify data access patterns

---

## Mobile Performance Direction

Accepted approach:
- stale-while-revalidate caching
- localStorage hydration
- Firebase reconciliation after render

Avoid:
- excessive render complexity
- over-engineered state systems

---

## Spotify Direction

Strategic decision:
Spotify reliability takes precedence over cosmetic UI optimization.

Reliability > polish.

---

## AI Workflow Direction

ChatGPT:
- strategy
- governance
- review
- orchestration

Claude:
- implementation
- execution
- patch generation

Repo docs:
- institutional memory
- continuity layer

---

## Organizational Rule

Tactical debugging should NOT happen inside strategic planning threads.
