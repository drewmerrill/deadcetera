# Band Claude Project — Setup Guide

A claude.ai **Project** is a shared chat workspace with persistent instructions + uploaded documents. Once set up, your bandmates can ask "what is GrooveLinx?" / "how do I add a song?" / "what's the difference between Active and Library scope?" and get a context-aware Claude answering from the spec docs — without touching the repo or bothering you.

This doc walks Drew through one-time creation. After it's done, share the URL with the band.

---

## Prerequisites

- **Claude Pro or Claude Team subscription.** Projects is gated to paid tiers. If you don't have it, $20/mo (Pro) or $25/user/mo (Team) — Pro is fine for this use case unless you want to invite the band as collaborators (Team).
- You're signed in at https://claude.ai with the account that owns the subscription.

---

## Step-by-step setup (~15 min)

### 1. Create the Project

1. Go to https://claude.ai
2. In the left sidebar, click **Projects** → **Create Project**
3. Name: **`GrooveLinx Knowledge Base`**
4. Description: `Ask any question about GrooveLinx — what it does, how to use it, what's coming, what's resolved. Maintained by Drew.`
5. Click **Create**

### 2. Paste the Project Instructions

In the Project, find the **"Set custom instructions"** or **"Project knowledge"** panel on the right side. Paste this verbatim:

```
You are the GrooveLinx product oracle, answering questions from band members of Deadcetera (Drew Merrill, Brian Hillman, Chris Jalbert, Pierce Hale, Jay Nault) and any other band invited to try the platform.

GrooveLinx is a browser-based band rehearsal and performance intelligence system. It is built as a lightweight vanilla-JavaScript single-page app — no React, no build step. Firebase Realtime Database is the canonical data store. Hosted at app.groovelinx.com via Vercel.

Your role:
- Answer band questions about how GrooveLinx works, what features exist, how to use them
- Point users to specific pages/screens of the app for their question
- When a user describes a bug or missing feature, suggest they tell Drew directly — DO NOT promise fixes or claim things will be added
- When you're not sure, say so honestly and tell the user to ask Drew

You have access to these documents in this Project's knowledge:
- AGENTS.md (a.k.a. CLAUDE.md) — the architectural rules and system locks
- 02_GrooveLinx/PROJECT_INDEX.md — top-level map of the project
- 02_GrooveLinx/CURRENT_PHASE.md — what's live in the latest build
- 02_GrooveLinx/specs/gl_view_map.md — every page/route in the app
- 02_GrooveLinx/specs/groovelinx-architecture.md — code organization
- 02_GrooveLinx/specs/groovelinx-ui-principles.md — UX rules
- 02_GrooveLinx/uat/bug_queue.md — currently-known bugs (so you can tell users "Drew is aware")
- 02_GrooveLinx/notes/uat_bug_log.md — resolved-bug history

Tone: friendly, direct, concise. The band are working musicians, not engineers. Avoid jargon when a plain answer works. When jargon is necessary (e.g. "Firebase write", "Demucs stems"), define it briefly.

What NOT to do:
- Do not write or modify code for the user (they can't deploy it). If a band member asks a coding question, suggest they ask Drew or Claude Code.
- Do not promise features, dates, or fixes. The bug queue + current phase docs reflect Drew's current plans; defer to those.
- Do not invent functionality. If something isn't documented, say "I don't see that documented — ask Drew."

When asked about something that IS documented, cite the doc: "Per CURRENT_PHASE.md, …" so band members learn the doc structure.
```

### 3. Upload knowledge documents

Drag-and-drop these 8 files into the Project knowledge panel (look for "+ Add content" or similar):

| File | Path |
|---|---|
| Project guidance | `AGENTS.md` (or `CLAUDE.md` — same file) |
| Top-level map | `02_GrooveLinx/PROJECT_INDEX.md` |
| Current build state | `02_GrooveLinx/CURRENT_PHASE.md` |
| Page/route map | `02_GrooveLinx/specs/gl_view_map.md` |
| Architecture | `02_GrooveLinx/specs/groovelinx-architecture.md` |
| UI principles | `02_GrooveLinx/specs/groovelinx-ui-principles.md` |
| Known bugs | `02_GrooveLinx/uat/bug_queue.md` |
| Resolved bugs | `02_GrooveLinx/notes/uat_bug_log.md` |

**Why these 8 specifically:** they're the highest signal-to-noise for band-level questions. CLAUDE_HANDOFF.md is also useful but it's 600KB+ and may exceed per-file limits — leave it off for now. If a question comes up that none of these can answer, you can add more docs to the Project later.

**File size note:** claude.ai Projects accepts text/markdown/PDF up to ~30MB per file and 100MB total. All 8 files above are well under that.

### 4. Test the Project yourself

Before sharing with the band, ask Claude a few sample questions:

- "What does GrooveLinx do?" → should give a 2-3 sentence summary
- "How do I add a song?" → should point to the Songs page
- "What's the current build?" → should reference CURRENT_PHASE.md's most recent entry
- "Is there a bug with [random thing]?" → should check bug_queue.md and answer honestly
- "Can you fix the gig map?" → should say "no, I can't modify code — tell Drew or ask Claude Code"

If any answer feels off, refine the Project Instructions text in step 2.

### 5. Share with the band

Click the **Share** button in the Project (top-right). Two sharing modes:

- **Pro tier:** generates a public link anyone with the URL can chat with. No login required for them — they use YOUR claude.ai credits. Cap: ~50 conversations/day before rate-limiting on the free tier they see. Fine for low-frequency band use.
- **Team tier:** invite specific email addresses as collaborators. They sign in with their own claude.ai account. More secure, costs $25/user/mo.

For DeadCetera (5 members, low question volume), **Pro tier + public link** is the right starting move. Reassess if usage spikes or onboarding more bands.

### 6. Send the band a 2-sentence intro

Paste this into your band's group chat / SMS / email:

```
Heads up — I made a Claude assistant that knows everything about GrooveLinx. Ask it anything ("what's this Active vs Library thing?" "how do I add a setlist?") and you'll get a real answer without bothering me: [paste the share URL here]. If it gives a wrong answer or doesn't know something, just tell me — that's how it improves.
```

---

## Maintenance (~5 min per release)

The 8 documents in the Project will go stale as GrooveLinx evolves. Re-uploading the latest versions:

- After each ship that updates `CURRENT_PHASE.md`, `bug_queue.md`, or `uat_bug_log.md` — drag the new file in to the Project (it replaces the old one automatically when names match)
- After a meaningful spec change — same flow
- After a major refactor that changes Project Instructions context — edit the instructions in step 2

**Suggested cadence:** sync the 3 fast-changing docs (CURRENT_PHASE, bug_queue, uat_bug_log) weekly. Sync the specs/architecture docs monthly or when materially changed. Set yourself a recurring calendar reminder if you want it automated.

---

## Future enhancements (when ready)

- **Band-specific Projects.** Once another band (Stuntrooster?) is onboarded, create a SECOND Project for them — same instructions, but uploaded docs filtered to their data. Keeps multi-band conversations separate.
- **Voice mode.** claude.ai Pro supports voice. A band member can literally tap mic on their phone and ask "what songs do we need to learn for the May 30 gig?" — useful during commutes.
- **Connect this Project to the GrooveLinx app.** Down the line, the in-app GrooveMate can call this Project's Claude via API. Then the band gets the same oracle inside GrooveLinx itself, not just at claude.ai. Multi-session work but high impact.

---

## Notes for Drew

- The Project is YOUR claude.ai account's. If you ever change your subscription or want to hand it off, transferring requires admin action.
- All band chats are visible to YOU (Project owner). Good for "what are people asking?" feedback. Bad if a band member wants privacy.
- Each band conversation is independent — no memory between users.
- claude.ai Projects don't run code or access the live Firebase. They're read-only over the uploaded snapshot of docs. For "actually do something" tasks, that's what Claude Code (and the upcoming Firebase MCP server) is for.
