# GrooveLinx — Current Priorities

Last Updated: 2026-05-29 (post Pierce-bandmate-feedback synthesis)

## 📍 2026-05-29 — Pierce Synthesis Re-Frames the Priorities

Pierce was the first real user besides Drew to use Rehearsal Review as intended — listening between calls, pausing to comment, jumping back, returning later. That validation is the highest-signal product input we've had to date. His synthesis (saved in memory as `project_pierce_synthesis_2026-05-29`) reorders the active priority list:

**Core frame everything is downstream of:** *"GrooveLinx wins when it helps the band improve without making music feel like homework."*

**Killer line that should sit near every roadmap decision:** *"The app has many chandeliers but still needs a better front door."*

**Six immediate priorities (Pierce ordering):**

1. **Comments anchoring safety** — largely shipped today via Phases 1-4 (2026-05-28). Trust-layer durability of musical-moment annotation.
2. **Member tagging as ATTENTION** — gentler than the v3 notification scoping had been. Tagging means "look at this" by default, NOT "you are assigned work." Task ownership is the explicit "Practice this" promotion path; mentions are ambient attention.
3. **Song DNA → Our Takes** — new surface. Songs are the core rollup object. Versions taxonomy: Our Takes · Best Shot · North Star · Lessons/Inspiration.
4. **Partial / full take labels** — new metadata field on segments so partials can be preserved but excluded from stats when needed.
5. **Direct share links** — URL-driven entry to a specific rehearsal review or song take. For low-adoption members (Chris-style), don't push the whole app — point them at the exact moment.
6. **Preserve full rehearsal AND song-take access** — BOTH, not either-or. Don't erase messy truth.

**Architecture question to evaluate, NOT solve same-day:** master-long-MP3-plus-markers vs generated per-song MP3 clips. Hybrid likely correct. Details in `02_GrooveLinx/DEFERRED_FINDINGS_QUEUE.md`.

**Explicit don't-do list (load-bearing):**

- harmony AI rabbit holes
- Melodyne integration
- DAW replacement
- perfect mix/master workflow
- broad AI companion behavior
- complex Chris onboarding
- excessive feature expansion

---

## Phase: Workflow Refinement + Operational Intelligence (UNCHANGED — still the active phase)

## Phase: Workflow Refinement + Operational Intelligence

_Active 2026-05-26 onward per Drew's post-Pass-2.5 strategic direction. This is NOT a major-feature-expansion phase. The moat is increasingly persistent operational musical continuity, NOT feature density, NOT media management, NOT generic AI tooling. Prioritize real-world behavioral observation over architecture expansion. See [[project_musical_operational_memory]] memory for the strategic frame + [[feedback_observe_before_expand]] for the discipline._

**Roadmap sequence** (Drew 2026-05-26 — work top-to-bottom; do not jump ahead):

### Phase 1 — Trust Hardening (NOW)

Continuity guarantees that make the system feel like persistent musical memory:

- continuity (state survives across surfaces)
- persistence (drafts, comments, focus, renders all survive teardown)
- reopen correctness (re-entering a workflow lands where the user left)
- playback continuity (audio doesn't drift, doesn't lose place)
- render continuity (in-flight renders survive close, complete reliably, surface state honestly)
- annotation persistence (every captured note must survive any teardown — TRUST-LAYER per `project_musical_operational_memory`)
- stale-state elimination (no displayed value that's older than the underlying truth)
- uncertainty-state elimination ("is this loading? is this current? is this stale?" must always have a visible answer)

Pass 2.5 (Bugs #20+#21+#22 shipped `fd347556`) was the first major Trust Hardening pass. More to follow as real-world behavioral observation surfaces continuity gaps.

### Phase 2 — Musical Moment System

Evolve `comments` → `operational musical memory`. Focus on timestamped rehearsal intelligence, NOT a generic note system. Differentiator: every note is anchored to a musical moment with surrounding context (segment / song / band-member / playback state) so the system can later surface patterns ("3 takes of Sugaree all flagged 'rushed' at the intro").

### Phase 3 — Recording Ingestion Reliability

**REAPER-first stabilization BEFORE X-Live expansion.** The Recording Ingestion Architecture v1 spec (`02_GrooveLinx/specs/recording_ingestion_architecture_v1.md`) Phase 1 (Recording Import Assistant + REAPER bundle adapter) lands before Phase 2 (direct X-Live). Validation discipline must catch broken imports loudly, not silently.

### Phase 4 — Homepage Convergence

Transform the homepage into a **calm operational orientation layer**, NOT a dashboard. The current home is information-dense; the goal is "what should I do right now / where are we in the band's life" answerable in one glance. Reduces simultaneous importance per Progressive Capability Depth.

### Phase 5 — Real AI Layer

Operational musical guidance, NOT chatbot theater. The AI's job is to surface patterns the band hasn't noticed:

- Repeated transition issues across rehearsals
- Unresolved rehearsal moments (notes flagged "revisit" weeks ago, still not addressed)
- Readiness improvement trends (song getting tighter or backsliding)
- Member-specific recurring issues (Pierce's harmony entries, Brian's solo timing)
- Rehearsal effectiveness signals (which rehearsals moved the band forward vs. which were just sessions)

NOT: a chatbot that explains the app's own features.

---

## Standing Discipline (carries across phases)

- Use the GrooveLinx Bug/Ops Workflow as the operational cockpit
- Continue Session Continuity Protocol discipline (see `AI_WORKFLOW.md` §Session Continuity Protocol — now a critical operational system)
- Prefer real-world behavioral observation over speculative architecture expansion
- Trust-layer bug categorization is canonical (see `project_musical_operational_memory` memory)

---

## Pre-Pass-2.5 Legacy Priorities (preserved for reference)

The priorities below were canonical before 2026-05-26. Some absorbed into the new phase sequence; others remain valid alongside the new phases.

## P0 — Existential

### Spotify Reliability Sprint
Focus:
- auth persistence
- token refresh
- reconnect handling
- playback recovery
- device switching
- mobile playback stability
- SDK reliability

Reason:
Playback trust is existential to GrooveLinx adoption.

---

## P1 — Rehearsal Workflow Simplification

Goals:
- fewer modes
- clearer progression
- timeline-first workflow
- stronger action guidance

---

## P1 — Mobile Experience

Focus:
- iPhone responsiveness
- SWR caching
- reduced loading friction
- trust signaling

Important:
Avoid endless micro-optimization.

---

## P2 — AI Intelligence Layer

Areas:
- harmony assistance
- rehearsal scoring
- automated recommendations
- rehearsal agenda generation
- song issue detection

---

## P3 — Notification + Engagement Layer

Areas:
- reminders
- rehearsal notifications
- gig countdowns
- push notifications
- activity feeds
