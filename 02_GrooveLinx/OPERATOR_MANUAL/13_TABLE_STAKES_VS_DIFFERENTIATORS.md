# GrooveLinx — Table Stakes vs Differentiators

_Build `20260514-142926`. The strategic classification layer. Every feature surface sorted into **stabilize / amplify / integrate / avoid / reduce**. This is what GrooveLinx must protect, double down on, get out of the way of, or refuse to build._

## Why this doc exists

GrooveLinx has reached the point where the question isn't "can we do interesting things?" — it's "are we doing the **right** interesting things, and protecting the **right** boring things?"

The competitive matrix at [`02_GrooveLinx/notes/competitive_matrix.md`](../notes/competitive_matrix.md) inventories capability. This doc decides what matters strategically — what is load-bearing for adoption, what is the real moat, what is universal-tool integration, what is dangerous scope, and what is psychological friction.

## The 5-category framework

| Category | Strategy | Why it matters |
|---|---|---|
| **A. Critical Table Stakes** | **STABILIZE** | Failure here causes adoption rejection. Bands assume these work. |
| **B. Strategic Differentiators** | **AMPLIFY** | These justify GrooveLinx existing. Where word-of-mouth comes from. |
| **C. Commodity Workflows** | **INTEGRATE** | Universal tools bands already use. Orchestrate; never replace. |
| **D. Scope Creep Traps** | **AVOID** | Categories that look adjacent but would dilute the product story. |
| **E. Emotional Adoption Blockers** | **REDUCE** | Not features — operational/communication frictions. Lower with discipline, not code. |

Important: **not everything is critical.** This is the central discipline. The temptation in any product doc is to classify every surface as load-bearing. Done that way, the classification stops being useful.

---

## Category A — Critical Table Stakes (STABILIZE)

These are not differentiators. They are the **floor**. If they fail, bands reject the product before differentiators get a chance to win them.

### A.1 — Chart rendering reliability
- **Why:** Most-used surface. If charts don't render correctly on phone, GrooveLinx loses the gig argument categorically.
- **Status:** Solid — Stab #05 made ChartRenderer canonical. Per competitive_matrix.md §3c, GrooveLinx at parity with Bandhelper/OnSong on Perform pillar.
- **Stabilize means:** Don't add new chart-render pipelines. Don't experiment. Protect.

### A.2 — Offline operation (Service Worker + Prep for Gig)
- **Why:** Gig-day reliability. The single emotional product story (`11_PRODUCT_NARRATIVE.md` §I) depends on this.
- **Status:** Solid — Stab #12 made Prep for Gig truthful; Service Worker offline cache works.
- **Stabilize means:** No regression tolerance. Test on every release per `06_BETA_LAUNCH_CHECKLIST.md` §3.

### A.3 — Playback arbitration (`pauseAll()`)
- **Why:** Audio chaos breaks every other workflow. Multiple sources playing simultaneously is not a bug — it's a product collapse.
- **Status:** Solid — Stab #07 single-owner enforcement; Stab #08 Spotify chokepoint.
- **Stabilize means:** Per CLAUDE.md SYSTEM LOCK, don't modify without review.

### A.4 — Mobile rendering (iOS Safari + Android Chrome)
- **Why:** Phone is the primary device. Web-only-on-laptop is not the product.
- **Status:** Continuously hardened — Stab #11 Q.8 (bfcache audio resume); historical iPhone perf builds.
- **Stabilize means:** Treat mobile regression as launch-blocking (per `06_BETA_LAUNCH_CHECKLIST.md` §3).

### A.5 — Auth + band isolation
- **Why:** Cross-band data leakage kills trust permanently.
- **Status:** Solid — Stab #02 closed SWR-clobber vector; band scoping is canonical.
- **Stabilize means:** Per CLAUDE.md SYSTEM LOCK, no Firebase rule weakening; no roster cross-writes.

### A.6 — Build / deploy atomicity
- **Why:** Mixed-bundle bugs cost trust at exactly the wrong time.
- **Status:** Per `feedback_build_bump_atomic`: 4-source atomic build.
- **Stabilize means:** Per `feedback_deploy_protocol`: 12-step deploy. No shortcuts.

### A.7 — Stage View on phone
- **Why:** The wow moment per `11_PRODUCT_NARRATIVE.md` §III.6. If this surface degrades, the product loses its anchor.
- **Status:** Mature.
- **Stabilize means:** Treat as one-job-per-screen (`feedback_one_job_per_screen`); refuse feature-creep into Stage View.

### A.8 — Push notifications (FCM + SMS path)
- **Why:** Coordination depends on "did the band see this." Per `project_notification_system`: 3-layer system.
- **Status:** Mature; A2P 10DLC in carrier review per `project_a2p_10dlc_submission`.
- **Stabilize means:** Don't change the FCM quirks pattern per `feedback_fcm_push_quirks`.

**Tally:** 8 table-stakes surfaces. All currently solid. **STABILIZE** = preserve the operational quality already achieved.

---

## Category B — Strategic Differentiators (AMPLIFY)

These are the **moat**. Per competitive_matrix.md §4 "true differentiators": no competitor combines these. Investment here generates word-of-mouth.

### B.1 — Per-member readiness
- **Why:** No competitor has it. Every other band tool tracks song-level state.
- **Status:** Mature — `gl-readiness.js` computes; surfaced in Songs page + Home dashboard.
- **Amplify means:** Make readiness changes visible after every rehearsal. Tie to Practice Task auto-generation (`10_FUTURE_ROADMAP.md` §5).

### B.2 — Cross-session rehearsal insights
- **Why:** "This song has been on the list 4 weeks and never landed" — categorically unbuilt elsewhere.
- **Status:** Pipeline mature; review surface (Rehearsal Intel) EMERGING.
- **Amplify means:** Promote Rehearsal Intel to post-rehearsal default landing per `10_FUTURE_ROADMAP.md` §4.

### B.3 — Walkthrough Mode + structured rehearsal artifacts
- **Why:** Competitors treat rehearsal as "wherever you happen to be when you open the app." GrooveLinx treats it as plan → execute → review.
- **Status:** Mature.
- **Amplify means:** Keep the verb sequence intact. Don't let walkthrough get refactored into a generic feature.

### B.4 — Band-as-first-class-citizen data model
- **Why:** Every other tool is user-centric. GrooveLinx is band-centric — roster + role + readiness baked in.
- **Status:** Canonical at architecture layer (`currentBandSlug`, band-scoped Firebase paths).
- **Amplify means:** Surface band-ness everywhere — band name at top of every page, member-attribution on every action.

### B.5 — Self-hosted stems pipeline (Demucs via Modal)
- **Why:** Cost-controlled, privacy-friendly for unreleased material. Per `project_stem_separation` memory.
- **Status:** Mature — Stab #14 made jobs persistent + cancellable.
- **Amplify means:** Don't go back to a SaaS dependency. The self-host is part of the moat.

### B.6 — Spotify Connect on iOS
- **Why:** The iOS SDK is unusable per Stab #08. GrooveLinx solved this with REST-driven Connect. Other apps cannot reach this.
- **Status:** Solid — Stab #08 chokepoint.
- **Amplify means:** This is one of the rare cases where competitor parity is structurally impossible. Lean into it in messaging.

### B.7 — Multitrack ingest (operator-only)
- **Why:** X32 SD card → per-instrument stems → rehearsal analytics. Per `project_multitrack_rehearsal`: "intelligence not file storage."
- **Status:** Mature — Stab #13 made upload abort honest.
- **Amplify means:** Don't surface to all members. Keep operator-only per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §7.

### B.8 — The Rehearse → Review → Practice loop closure (future)
- **Why:** Per `11_PRODUCT_NARRATIVE.md` §III.7: "The only thing that turns GrooveLinx from 'tool' into 'coach.'"
- **Status:** Pipeline pieces exist; closure pending (`10_FUTURE_ROADMAP.md` §9).
- **Amplify means:** This is the flagship roadmap item. Every other promotion should support this loop or wait.

**Tally:** 8 differentiator surfaces. **AMPLIFY** = invest disproportionately; protect from dilution.

---

## Category C — Commodity Workflows (INTEGRATE)

These are universal tools bands already use. GrooveLinx's job is to orchestrate around them, not replace them. Per memory `feedback_competitive_strategy_lens`: "Integrated beats replaced."

### C.1 — Spotify / Apple Music / YouTube
- **Strategy:** INTEGRATE.
- **Status:** Done. North Star references; Spotify Connect playback; YT embedded player.
- **Discipline:** Never try to be a music service. Reference + Connect only.

### C.2 — Google Calendar / Apple Calendar
- **Strategy:** INTEGRATE.
- **Status:** Done — true two-way Google Calendar sync per `project_calendar_filtering`. Apple Calendar via Google.
- **Discipline:** Don't try to be a calendar. The user's calendar stays canonical.

### C.3 — Google Drive / Dropbox / iCloud
- **Strategy:** INTEGRATE.
- **Status:** Done via Modal proxy URL ingest.
- **Discipline:** Never try to be storage. The band's archive stays in their existing folder structure.

### C.4 — Slack / Discord / GroupMe / Group Text
- **Strategy:** INTEGRATE via notification OUT.
- **Status:** 3-layer notification system (in-app + FCM + SMS).
- **Discipline:** Never try to be the band's general chat. Per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §8: notifications go out; chat stays elsewhere.

### C.5 — Email
- **Strategy:** INTEGRATE via mailto invite path.
- **Status:** Mode-B Phase 1 onboarding uses mailto-Drew handoff.
- **Discipline:** Email is an integration point, not a feature surface.

### C.6 — Soundslice / Anytune / Capo / iRealPro (deep practice tools)
- **Strategy:** INTEGRATE via link-out for deep practice.
- **Status:** Implicit — users open these external tools when they want deep notation work.
- **Discipline:** Don't pursue notation depth. Soundslice owns that pillar. Per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §10.

**Tally:** 6 integration points. **INTEGRATE** = orchestrate around; never absorb. These are GrooveLinx's force multipliers — by NOT trying to be them, we focus on what only GrooveLinx can be.

---

## Category D — Scope Creep Traps (AVOID)

The most-dangerous category. These look adjacent. They aren't. Pursuing them dilutes "where bands lock in" into "where bands try to do everything."

### D.1 — DAW / multitrack production
- **Why dangerous:** BandLab/Soundtrap/Splice/Ableton already exist. Building a DAW is a 5+ year category investment.
- **Discipline:** Per `00_PRODUCT_STORY.md`: "It's not a recording studio." Hold the line.

### D.2 — Public tab library / song database
- **Why dangerous:** Ultimate Guitar / Songsterr own this. Legal-rights heavy. Data-acquisition heavy. Not band-specific.
- **Discipline:** Per `14_COMPETITIVE_WORKFLOW_MAPPING.md` §2: GrooveLinx is band-specific. Never universal-library.

### D.3 — Sheet music PDF reader at forScore polish
- **Why dangerous:** forScore / MobileSheets own a specific user (classical / jazz). Their polish is years of work.
- **Discipline:** Chart upload is "good enough" for working bands. Don't pursue PDF-reader category.

### D.4 — MIDI / lighting / backing-track triggering at gigs
- **Why dangerous:** Bandhelper's moat. ~10% of bands need it. Pursuing pulls focus from the 90%.
- **Discipline:** Per competitive_matrix.md recommendation #3: watch, don't chase.

### D.5 — VST host / live keyboard rig
- **Why dangerous:** MainStage/Cantabile/Gig Performer are different layer entirely (audio routing software).
- **Discipline:** GrooveLinx coexists with these. Doesn't enter.

### D.6 — Band websites / merch / e-commerce
- **Why dangerous:** Bandzoogle / Bandcamp own this. Different product entirely.
- **Discipline:** Public-facing band identity is not band internal operations.

### D.7 — Booking / contracts / invoicing platform
- **Why dangerous:** Gigwell / Bandhelper-basic-tier touch this. Pursuing it makes GrooveLinx "band management" not "where bands lock in."
- **Discipline:** Gigs page captures gig **metadata**. It does not need to be a booking platform.

### D.8 — Real-time collaboration on charts (multi-cursor Notion-style)
- **Why dangerous:** Notion/Google Docs do this. Bands rarely co-author live (per matrix).
- **Discipline:** Charts are author-and-share artifacts, not real-time collab artifacts.

### D.9 — "AI" features pursued for marketing
- **Why dangerous:** Per `11_PRODUCT_NARRATIVE.md` §I anti-narrative: "Don't use the word AI." Sets wrong expectations.
- **Discipline:** Demucs and chord detection are DSP. GrooveMate is a domain-specific assistant. Resist generic-"AI" feature lists.

### D.10 — Public artist discovery / streaming
- **Why dangerous:** Spotify owns this. ReverbNation tried. Failed.
- **Discipline:** GrooveLinx is band-internal. Public-facing is a different product.

**Tally:** 10 scope-creep traps. **AVOID** is the most-important discipline. Every "we should also be X" suggestion should be checked against this list. If it matches, the answer is no.

---

## Category E — Emotional Adoption Blockers (REDUCE)

These are not features. They're operational and communication frictions. They are reduced with **discipline**, not code.

### E.1 — Lens density in Song Detail
- **Why a blocker:** 8 lenses; new testers don't know which to choose.
- **Reduce by:** Smart default landing per song state; hide rarely-used lenses behind "more." Per `11_PRODUCT_NARRATIVE.md` §III.4: most-dangerous cognitive-overload area.

### E.2 — Three-rehearsal-entrypoints
- **Why a blocker:** Home widget vs Rehearsal page vs Live Gig launcher. Implicit-different-functionality confusion.
- **Reduce by:** Demo only one entry path (Rehearsal page). Pick one as canonical visual primary; soft-deprecate the others.

### E.3 — Mailto onboarding latency
- **Why a blocker:** 1-24h wait between tester invite request and Drew adding them.
- **Reduce by:** Operator discipline (Drew responds same-day). Mode-B Phase 2 redemption later (`10_FUTURE_ROADMAP.md` §1).

### E.4 — Empty Home page first impression
- **Why a blocker:** New tester lands on Home with no data.
- **Reduce by:** Pre-loaded sample songs in the tester's band (NICE-TO-HAVE per `06_BETA_LAUNCH_CHECKLIST.md` §11).

### E.5 — Buried Harmony Lab
- **Why a blocker:** Even Pierce had to learn the navigation. Strangers won't find it.
- **Reduce by:** Promote header button per `08_PROMOTION_BACKLOG.md` §5 Option B. Cheap fix.

### E.6 — Bug #8 (silent Load button)
- **Why a blocker:** Tester hits "is this broken?" moment at the first rehearsal-review.
- **Reduce by:** Fix Bug #8 (highest-leverage bug fix in queue) OR disclaim explicitly in welcome message.

### E.7 — D-tier surface visibility (Pocketmeter / Bestshot / Finances / Stageplot / Workbench)
- **Why a blocker:** Each is a "what's this for?" moment in the tester's first session.
- **Reduce by:** Cutlist Tier 2 HIDE pass per `07_CUTLIST.md`. ~50-200 LOC, single cleanup commit.

### E.8 — Communication-shaped friction
- **Why a blocker:** "I have to migrate everything" (no, you don't); "Will this crash at the gig" (here's why it won't); "Do I have to retype all my charts" (no, paste-in).
- **Reduce by:** Walkthrough script in `BETA_ONBOARDING_RUNBOOK.md` §4. One sentence each. No code change.

### E.9 — Ideas vs Feed conceptual overlap
- **Why a blocker:** "Where does this kind of thing go?" — fundamental confusion of which surface for which intent.
- **Reduce by:** Collapse per `08_PROMOTION_BACKLOG.md` §2 Option A — Ideas becomes a post type within Feed. Cognitive-load drop.

**Tally:** 9 adoption frictions. **REDUCE** = operator/communication/UX work; mostly does not require new features.

---

## The strategic stack — visual summary

```
+----------------------------------------------------------------+
|     A. CRITICAL TABLE STAKES — STABILIZE  (8 surfaces)         |
|     Charts · Offline · pauseAll · Mobile · Band isolation ·    |
|     Build atomicity · Stage View · Notifications               |
+----------------------------------------------------------------+
|     B. STRATEGIC DIFFERENTIATORS — AMPLIFY (8 surfaces)        |
|     Per-member readiness · Cross-session insights · Walkthrough|
|     Band-as-citizen · Self-host stems · Spotify Connect iOS ·  |
|     Multitrack · The Rehearse→Review→Practice loop             |
+----------------------------------------------------------------+
|     C. COMMODITY WORKFLOWS — INTEGRATE (6 dependencies)        |
|     Spotify · Calendar · Drive/Dropbox · Slack/Discord ·       |
|     Email · Soundslice/Anytune (deep practice link-out)        |
+----------------------------------------------------------------+
|     D. SCOPE CREEP TRAPS — AVOID (10 categories)               |
|     DAW · Tab library · forScore polish · MIDI/lighting ·      |
|     VST host · Band websites · Booking · RT collab ·           |
|     "AI" marketing · Public artist streaming                   |
+----------------------------------------------------------------+
|     E. EMOTIONAL ADOPTION BLOCKERS — REDUCE (9 frictions)      |
|     Lens density · 3-rehearsal-entries · Mailto latency ·      |
|     Empty Home · Buried Harmony · Bug #8 · D-tier visibility · |
|     Communication friction · Ideas/Feed overlap                |
+----------------------------------------------------------------+
```

## What this classification implies

**The product surface is right-sized.** 8 differentiators + 6 integrations = ~14 things GrooveLinx **is**. 10 scope traps + 9 reducible frictions = where the work isn't.

**The next 3-6 months of work should be 80% in category E (REDUCE) and 20% in B (AMPLIFY).** Almost zero net new features. Almost zero new categories. The discipline is in protecting what exists from dilution.

**Each Stab / Promotion / Cutlist action should map to exactly one category.** If a proposed change spans multiple, decompose it. If it doesn't fit any, it's probably scope creep.

## The strategic question to ask before any feature work

> **Which of A/B/C/D/E does this belong in?**

- A — only stabilize; no expansion
- B — amplify only if it strengthens the loop, not the feature count
- C — integrate; do not absorb
- D — refuse
- E — reduce via operator/communication/UX, not new features

If a proposal doesn't fit any of these — it's not on-thesis. The answer is no.

## How this connects to the rest of the Operator Manual

| Doc | Role | Layer |
|---|---|---|
| `notes/competitive_matrix.md` | Inventory | What exists in the market |
| `00_PRODUCT_STORY.md` | Philosophy | Why GrooveLinx exists |
| `09_MVP_VS_EXPERIMENTAL.md` | Tactical surface map | What's load-bearing vs cuttable |
| `07_CUTLIST.md` | Cut decisions | What to delete/hide |
| `08_PROMOTION_BACKLOG.md` | Promotion decisions | What deserves elevation |
| `12_MIGRATION_RISK_ANALYSIS.md` | Adoption-psychology layer | What blocks switching |
| **`13_TABLE_STAKES_VS_DIFFERENTIATORS.md`** | **Strategic classification (this doc)** | **What to amplify / refuse / integrate / reduce** |
| `14_COMPETITIVE_WORKFLOW_MAPPING.md` | Per-category strategic response | Replace / integrate / subsume / ignore |
| `15_POSITIONING_AND_ADOPTION.md` | Synthesis | What to do with all of this |

This doc is the **central rubric**. The others are inputs or applications.

## When to revisit

- After any major Stab or Convergence Initiative completes — re-check whether the relevant surface moved categories.
- Quarterly — re-evaluate Category D for "did anything jump from D to C?" (rarely — but possible if external landscape shifts).
- After each cohort of testers — check whether Category E frictions need re-ranking based on real BETA_FEEDBACK_QUEUE.md signal.

Never add a category. Five is enough.
