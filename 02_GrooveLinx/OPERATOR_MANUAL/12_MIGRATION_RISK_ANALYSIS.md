# GrooveLinx — Migration Risk Analysis

_Build `20260514-142926`. The decision question isn't "what features does GrooveLinx have?" — it's "what stops a real band from switching to GrooveLinx as their primary operating layer?" Per-workflow LOW/MEDIUM/HIGH risk classification with adoption-psychology context._

## How to read this doc

Each workflow gets four assessments:

| Assessment | What it answers |
|---|---|
| **Migration friction** | How hard is the mechanical switch (data, muscle memory, time)? |
| **Likely user fear** | What is the tester thinking before they try? |
| **Likely "missing feature" concern** | What will they ask for that we don't have? |
| **Real blocker vs perceived blocker** | Will this actually stop them, or just slow them? |
| **Operational workaround** | Can the gap be closed without code? |

Then a final classification: **LOW / MEDIUM / HIGH** migration risk.

**Reference layer:** competitor inventory and capability comparisons live at [`02_GrooveLinx/notes/competitive_matrix.md`](../notes/competitive_matrix.md). This doc focuses on the adoption psychology, not the feature math.

---

## §1 — Onboarding

### What's at stake
First impression. Mode-B Phase 1 invite-by-mailto means Drew is a manual bottleneck. The tester is waiting for him to add them.

### Migration friction
**MEDIUM.** No data to migrate at this step; just identity provisioning. But the mailto-Drew handshake adds 1-24 hours of latency before the tester is "in." That's a real friction window where they may lose interest.

### Likely user fear
- "Am I going to be locked into something complicated?"
- "Will Drew know what to do with this?"
- "Is this an actual product or someone's side project?"

### Likely "missing feature" concern
- "Why can't I just sign up?"
- "Why do I have to email someone?"
- "What if I want to invite my own bandmates?"

### Real blocker vs perceived
**Perceived.** A 24-hour wait is uncomfortable but not migration-blocking. Most testers won't quit during the wait if they got an invite from a trusted person (Drew). The real risk is at the **second step** — once they're in, can they make sense of it?

### Operational workaround
- Drew responds same-day to invite requests (operator discipline).
- Pre-loaded sample songs in the tester's band so they don't land on an empty Home page.
- Personal walkthrough video (NICE-TO-HAVE per `06_BETA_LAUNCH_CHECKLIST.md` §11).

### Classification: **MEDIUM**
Real but manageable. Operator discipline closes most of the gap. Mode-B Phase 2 (`10_FUTURE_ROADMAP.md` §1) eventually reduces to LOW.

---

## §2 — Rehearsal

### What's at stake
The verb at the center of the product. Bands rehearse weekly; if GrooveLinx isn't trustworthy here, none of the other workflows matter.

### Migration friction
**LOW-MEDIUM.** Most bands rehearse without dedicated software today — they just show up. The migration cost is **adding** a tool, not switching from one.

### Likely user fear
- "What if everyone has to install something?"
- "What if I have to do extra setup right before rehearsal?"
- "Will this slow us down instead of speeding us up?"

### Likely "missing feature" concern
- "Can I record on my phone or do I need a board input?"
- "Does it work if the wifi at the practice space is bad?"

### Real blocker vs perceived
**Perceived.** The actual rehearsal pipeline (plan → execute → record → analyze) is mature. Bug #8 (silent Load button) is the known hole — must be acknowledged in onboarding so testers don't think the app is broken.

### Operational workaround
- Walkthrough demos the rehearsal flow end-to-end before tester tries it solo.
- Bug #8 explicitly disclaimed in welcome message.
- Multitrack ingest stays as operator-only (Drew's workflow); testers don't need to see it.

### Classification: **LOW**
GrooveLinx's strongest competitive territory. Per competitive_matrix.md §3b, no competitor combines per-member readiness + walkthrough + post-session analytics. Adoption psychology is favorable: testers expect to **add** rehearsal tools, not switch from existing ones.

---

## §3 — Setlists

### What's at stake
The artifact that travels from the laptop (build) to the phone (perform). Trust here gates whether the band uses GrooveLinx at gigs.

### Migration friction
**MEDIUM.** Many bands currently use a standalone setlist app (Setlist Maker, Setlist Helper) or paper. Setlists are easy to recreate but the "I already have my system" friction is real.

### Likely user fear
- "Am I going to spend an hour rebuilding setlists I've already built?"
- "Can my drummer see this on his phone or just mine?"
- "What if the app crashes at the gig?"

### Likely "missing feature" concern
- "Can I print it?"
- "Can I share it as text to the band's group chat?" (Yes — but discoverability matters.)

### Real blocker vs perceived
**Perceived for "I already have my system."** Setlists rebuild in 5-10 minutes per gig. The crash-at-gig fear is reality-tested: Stab #12 made Prep for Gig truthful, Service Worker caches everything offline, ChartRenderer is canonical (Stab #05). The crash-fear is well-mitigated.

### Operational workaround
- Pre-load 1-2 sample setlists in the tester's band so they see what the surface looks like.
- Demo the Stage View on the tester's actual phone (per `11_PRODUCT_NARRATIVE.md` §III.6 — most likely wow moment).

### Classification: **LOW-MEDIUM**
Easy migration target per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §6. Risk reduced by Stab #12. Wow moment carries the surface.

---

## §4 — Charts

### What's at stake
The single most-used artifact in the app. If charts don't render reliably on phone, GrooveLinx loses the gig-day argument.

### Migration friction
**MEDIUM-HIGH.** Bands have chart libraries scattered across Google Drive folders, OnSong databases, paper binders, group chats. The "where are my charts" inventory question is real.

### Likely user fear
- "Do I have to retype every chart I have?"
- "Can I upload PDFs?"
- "What if my chart format doesn't render right?"

### Likely "missing feature" concern
- "Auto chord detection from a Spotify URL?" (Chordify does this; GrooveLinx doesn't.)
- "Synced playback with the chart highlighting the current bar?" (Soundslice; GrooveLinx doesn't.)
- "Sheet music PDF rendering at forScore quality?" (forScore; GrooveLinx doesn't.)

### Real blocker vs perceived
**Mostly perceived** for the working-band sweet spot. The auto-chord-detect concern is real if the tester comes from Chordify; the chart-import wizard mitigates by accepting pasted text. The Soundslice-quality and forScore-quality concerns are categorically different products per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §10 and §14.

### Operational workaround
- Demo with a chart already in the band's library.
- For chart-anxious testers, walk through chart import with one of their songs in the walkthrough session.
- Stress: charts cache offline. The gig-day reliability beats any feature-rich web tool.

### Classification: **MEDIUM**
Highest-volume use of the app; failure here is highly visible. Working-band testers will be satisfied; Soundslice-adjacent testers may bounce. Filter testers accordingly.

---

## §5 — Playback

### What's at stake
The reference-listening loop. "Play the canonical version" must work reliably or the rehearsal context collapses.

### Migration friction
**LOW.** Per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §5, GrooveLinx INTEGRATES with Spotify/YouTube/Apple — doesn't replace them. The user's existing library stays canonical.

### Likely user fear
- "Will my Spotify subscription work with this?"
- "Will it play on my Bluetooth speaker?"
- "Will it work on iPhone?" (Real concern — many band tools have iOS issues.)

### Likely "missing feature" concern
- "Apple Music support?" (Link-out only today.)
- "Offline Spotify?" (Spotify Connect requires connectivity; no workaround.)

### Real blocker vs perceived
**Real** for Apple Music users (no in-app SDK playback). **Perceived** otherwise — Stab #07 + Stab #08 made the Spotify Connect path iron-clad per `00_PRODUCT_STORY.md` strongest workflow #5.

### Operational workaround
- Confirm tester is a Spotify Premium user during pre-provisioning (per BETA_ONBOARDING_RUNBOOK.md §1).
- Apple-Music-only testers: demo with YouTube-sourced songs instead.

### Classification: **LOW** (for Spotify Premium users) / **MEDIUM** (for Apple-Music-only)
Filter at pre-provisioning. Don't onboard Apple-Music-only testers until iOS SDK changes or Apple Music API path is built (not on roadmap).

---

## §6 — Scheduling

### What's at stake
"When's the next rehearsal?" — the answer must integrate with everyone's calendar, not replace it.

### Migration friction
**LOW.** Per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §7, GrooveLinx has true two-way Google Calendar sync — better than Bandhelper's export-only. Migration is **adding** sync, not switching calendars.

### Likely user fear
- "Will this mess up my personal calendar?"
- "Will my band see my personal events?"

### Likely "missing feature" concern
- "Apple Calendar sync?" (Indirect via Google Calendar; direct path not built.)
- "Member availability voting?" (Schedule page does some of this; immature.)

### Real blocker vs perceived
**Perceived.** The sync is well-scoped (Google only; user controls which calendars sync) per `project_calendar_filtering` memory. Apple-only users can manually copy events from Google Calendar, which is annoying but not blocking.

### Operational workaround
- During pre-provisioning, confirm Google Calendar use.
- Apple-only users: defer setup or accept manual entry.

### Classification: **LOW**
One of GrooveLinx's strongest INTEGRATE wins. Risk is contained to Apple-only users (small minority for working bands).

---

## §7 — Rehearsal Review

### What's at stake
The post-rehearsal-recording → analyzer → timeline loop. This is the **flagship moat** per competitive_matrix.md §4 differentiator #3 (cross-session insights — "no competitor stops at rehearsed: yes/no").

### Migration friction
**LOW.** No competitor is doing this. Bands don't have an existing workflow to migrate FROM — they have a void.

### Likely user fear
- "Will my rehearsal recording be private?"
- "What if the analysis is wrong?"
- "How long does it take?"

### Likely "missing feature" concern
- "Real-time analysis during rehearsal?" (No — server analysis is post-hoc.)
- "Per-section practice loops?" (Chopper does this; discoverability is the gap.)

### Real blocker vs perceived
**Real risk: Bug #8** (silent Load button). The first-time tester hits this and concludes "the feature is broken." Acknowledge in onboarding.

**Perceived:** Privacy fear is manageable — recordings stay in the band's Firebase scope; band isolation closed via Stab #02.

### Operational workaround
- Bug #8 disclaimer in welcome message.
- Demo Drew's own rehearsal analysis as a "here's what this produces" reference.
- Chopper persistence (Audit #04 follow-up) verified before onboarding.

### Classification: **LOW** for green-field testers / **MEDIUM** if Bug #8 hits
Fix Bug #8 to drop to uniform LOW. Highest payoff-per-fix in the launch checklist.

---

## §8 — Harmony

### What's at stake
A unique standalone capability (split mixer + LALAL.AI lead/backing isolation). Buried inside Song Detail → Harmony lens per `04_USER_JOURNEYS.md` §4.

### Migration friction
**LOW.** Bands either use Moises (per-song basis, $4-10/mo per member) or do without. GrooveLinx replaces Moises for the band-scoped subset.

### Likely user fear
- "Will my vocalist find this?"
- "Is the isolation good enough?" (Yes — LALAL.AI is industry-leading per matrix §3d.)

### Likely "missing feature" concern
- **Discoverability.** "Where is the harmony tool?" — buried 2 levels deep.
- "Can I save isolated takes?" — Yes; UX is decent but not crisp.

### Real blocker vs perceived
**Real:** Discoverability. Even Pierce (Deadcetera's harmonist) had to learn the navigation. Strangers won't find it.

### Operational workaround
- Walkthrough explicitly navigates to Harmony Lab during the demo.
- Welcome message includes "Singers: tap any song → lens picker → Harmony" hint.
- Promotion (per `08_PROMOTION_BACKLOG.md` §5) Option B: always-visible Harmony Lab launcher on Song Detail header. Highest payoff-per-effort promotion in backlog.

### Classification: **LOW** (operationally workaroundable) → **VERY LOW** (post-promotion)
The promotion is cheap (~50-100 LOC). Ship before tester #2.

---

## §9 — Recordings (archive / library)

### What's at stake
"Where are all our rehearsal recordings?" — bands have years of files in Drive/Dropbox folders. The archive question is emotional, not technical.

### Migration friction
**HIGH** if interpreted as "move all our recordings into GrooveLinx." **LOW** if interpreted as "GrooveLinx ingests from Drive/Dropbox URLs."

### Likely user fear
- **"I'll lose access to my old recordings."**
- "Will my Dropbox folder still work?"
- "Do I have to upload years of files?"

### Likely "missing feature" concern
- "Can I bulk-import from Drive?"
- "Can I link my whole Dropbox folder?" (No — that's storage replacement; out of scope per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §4.)

### Real blocker vs perceived
**Highly perceived.** Most testers don't actually need to migrate the archive — they need NEW rehearsal recordings to flow into GrooveLinx. The archive stays where it is. Onboarding must be explicit: **"Your Dropbox folder doesn't move."**

### Operational workaround
- In the walkthrough, EXPLICITLY state: "Your old Drive/Dropbox folder stays exactly where it is. GrooveLinx only processes new recordings going forward."
- For the truly archive-anxious: demo the "paste a Drive URL of an old recording → run analyzer" path. Shows that old recordings remain accessible without migration.

### Classification: **MEDIUM** (perceived) → **LOW** (with explicit communication)
Communication-bound. The technical risk is zero; the psychological risk is real and managed with one sentence.

---

## Aggregate migration-risk matrix

| Workflow | Friction | User fear | Missing-feature ask | Real blocker? | Workaround | Risk |
|---|---|---|---|---|---|---|
| Onboarding | M | Yes | Self-signup | Perceived | Drew same-day | **MED** |
| Rehearsal | L-M | Some | Mic input | Perceived (Bug #8 acknowledged) | Walkthrough demo | **LOW** |
| Setlists | M | Some | Print, share-text | Perceived | Pre-loaded samples | **LOW-MED** |
| Charts | M-H | Yes | Auto-detect, PDF polish | Perceived for sweet spot | Filter testers | **MED** |
| Playback | L | iOS-anxiety | Apple Music | Real for AM-only | Filter at provisioning | **LOW** (Spotify) / **MED** (AM-only) |
| Scheduling | L | Privacy | Apple Cal direct | Perceived | Pre-confirm Google Cal | **LOW** |
| Rehearsal Review | L | Privacy, accuracy | Real-time | Real if Bug #8 | Fix Bug #8 | **LOW** post-fix |
| Harmony | L | Discoverability | n/a | Real (nav) | Promotion §5 | **LOW** post-promotion |
| Recordings (archive) | H if literal, L if framed | "I'll lose my archive" | Bulk-Drive-import | Perceived | Explicit communication | **LOW** with framing |

**Aggregate score:** 7 LOW · 2 MEDIUM · 0 HIGH (post-mitigations applied).

## Highest-leverage mitigations (in priority order)

1. **Fix Bug #8 (silent Load button)** — drops Rehearsal Review from MED to LOW; reduces tester's "is this broken" moment.
2. **Promote Harmony Lab to Song Detail header** — `08_PROMOTION_BACKLOG.md` §5 Option B; eliminates the only HIGH-discoverability gap.
3. **Pre-provisioning filter (Spotify Premium + Google Calendar)** — converts MEDIUM into LOW by selecting compatible testers.
4. **"Your archive stays where it is" explicit framing** — single sentence in welcome message; eliminates psychological migration anxiety.
5. **Pre-loaded sample songs / setlists** — eliminates empty-state confusion that compounds onboarding latency.

Total: ~2 days of operator + product work to drop every MEDIUM to LOW.

---

## Adoption psychology — the meta-insight

The competitive matrix focuses on **capability**: "what can each tool do?"

The migration-risk frame asks a different question: **"what's the band's pre-existing emotional attachment, and which tools are we trying to displace vs orchestrate around?"**

When you sort migration risks by what's underneath them, three patterns emerge:

### Pattern 1: Real risks are about archive + discoverability, not features
- Recordings archive (file storage emotional pull).
- Harmony Lab (buried in nav).
- Bug #8 (the "is this broken?" moment).

None of these are "we need feature X." They're operational/UX gaps.

### Pattern 2: Perceived risks evaporate with framing
- "I have to migrate everything" → "No, your archive stays in Dropbox."
- "Self-signup missing" → "Drew responds same-day to invites."
- "Will it crash at the gig?" → Demo Stage View offline before they commit.

These are won by communication, not code.

### Pattern 3: Truly blocking gaps are categorical, not parity-shaped
- Apple Music users: GrooveLinx genuinely can't replace Apple's playback for them. Filter at provisioning.
- forScore-quality sheet music: different product category. Filter target user.

These are **out-of-scope decisions**, not "we should build this." Per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §14, sheet readers are IGNORE.

## What this doc is NOT

- **Not a competitor scoring matrix.** That's `notes/competitive_matrix.md`.
- **Not a feature wishlist.** Every "missing feature" listed is contextualized — most are perceived, not blocking.
- **Not a parity-chasing roadmap.** Per `feedback_competitive_strategy_lens` memory: integrated beats replaced.
- **Not static.** Re-read after every 2-3 testers; real BETA_FEEDBACK_QUEUE.md signals override theoretical risk classifications.

## When to revisit

After each tester completes BETA_ONBOARDING_RUNBOOK.md §5 (first-session test script). If 2+ testers independently raise the same friction, reclassify the relevant workflow up one tier. If 2+ testers said "I expected to find X" — promote the missing surface or improve framing.

The real question for every tester is: **"What did they think they were getting that they didn't?"** That's where migration risk lives, not in the feature matrix.
