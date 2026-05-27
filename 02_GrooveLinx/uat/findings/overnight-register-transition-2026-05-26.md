# Overnight Register Transition Harvest — 2026-05-26

**Build under simulation:** `20260526-214652` (commit `c511ba29`)
**Focus axis:** when (if ever) does the system transition between operational and collaborative registers? What governs the move?
**Methodology:** codebase inspection. The transition rules are encoded in source, not exposed in UI.
**Scope:** observation only.

> _This harvest's single most consequential finding completely reframes the prior 10 harvests' framing of "registers." It's covered in §1._

---

## 1. The Reframe: The Multi-Register System Was Explicitly Deprecated

The prior 10 harvests progressively built a framing of "the system has two voice registers (default-imperative + Stoner-collaborative) and should learn when to transition between them."

**That framing is wrong, and the team has already made a decision against it.**

From `js/core/gl-product-mode.js:1–11`:

```
// Product Mode (DEPRECATED)
// 'sharpen' = solo practice focus
// 'lockin'  = band rehearsal focus
// 'play'    = gig / performance focus
//
// LEGACY MODE SYSTEM — NO LONGER USED FOR UI GATING. Practice/Rehearse/Play
// are conceptual perspectives used in recommendations and copy only. All
// features are always visible in a single coherent page structure. These
// functions are retained for backward compatibility with code that reads
// getProductMode() for informational purposes.
```

**The team explicitly tried mode-based UI register switching, decided against it, and standardized on "all features always visible in a single coherent page structure."** The deprecated three-mode system (sharpen/lockin/play) was kept only as an informational flag, not as a register driver.

This is a profound piece of evidence. The architecture has actively rejected the proposition that the main app should switch registers based on mode. The Stoner Mode "collaborative voice" I documented in the Consent harvest does not represent "the system's collaborative register that should sometimes engage." It represents **Stoner Mode as a separate full-screen alternative product**, with its own copy register, that the user can opt INTO for on-stage use.

---

## 2. The Refined Structural Picture

Combining this harvest with prior findings, the actual register architecture is:

| Register | Surface | Voice | Trigger |
|---|---|---|---|
| **Default operational** | All main pages (Home / Songs / Rehearsal / Practice / Setlists / Player) | Imperative / clinical | Always active for main app |
| **Stoner Mode** | Separate full-screen overlay (`#stonerOverlay` z-index 2500) | Collaborative / "we" / "let's" | User opts in via header chip |
| **Live Gig Mode** | Separate full-screen mode (per CLAUDE.md) | Probably specialized | User opts in from gig context |
| **Rehearsal Mode** | Separate full-screen mode (per CLAUDE.md) | Probably specialized | User opts in from plan context |
| **GrooveMate avatar** | Right-side slide-out panel | Collaborative + invitation | User opens panel; tips fire on cooldowns |
| **`_sdCelebrate`** | Brief overlay | Earned celebration | First crossing to 5/5 rating |
| **Toasts** | Bottom-center ephemeral | Action-confirmation | Save / validation / file events |

**The main app surfaces are NOT register-switchable.** The team has decided they always speak in operational voice. The "warmer" registers live ONLY in separate full-screen products or in specifically-gated affordances (avatar panel, celebration overlay).

This makes the question "when should the system transition between registers" **the wrong question, by team design**. The team has answered it: it doesn't. Different surfaces use different fixed voices.

---

## 3. The Two Tracked Mode Flags (different layers)

There are actually TWO independent mode-tracking layers:

### Layer 1: `gl_product_mode` (DEPRECATED, informational only)
- localStorage key
- Values: `'sharpen'` / `'lockin'` / `'play'`
- **Was UI-gating; is now informational only**
- Auto-transition exists in `js/core/gl-avatar-guide.js:756-757` — Avatar Guide auto-sets to `'play'` on first reaching ≥3 songs
- But UI is NOT gated by this anymore — the value is read but doesn't change anything user-facing

### Layer 2: `deadcetera_stoner_mode` (active, full-screen overlay toggle)
- localStorage key (band-specific prefix)
- Values: `'0'` or `'1'`
- Controls whether the Stoner Mode full-screen overlay is shown
- Persists across reload (the storage write is durable)
- **Device-local**, not cross-device (it's in localStorage, not Firebase)
- Manually toggled by user via the 🌿 Mode header button

**Interesting:** the storage key uses the band slug (`deadcetera_`). So if Drew switches bands, the Stoner Mode preference doesn't follow him to the new band. It's both device-local AND band-scoped. Subtle privacy/scope property worth noting.

---

## 4. Auto-Transitions in the Current System

After codebase grep for mode-switching triggers, I found exactly ONE auto-transition:

**`gl-avatar-guide.js:756-757` — `checkAutoLaunch`:**
```js
if (typeof GLStore !== 'undefined' && GLStore.getProductMode && GLStore.getProductMode() !== 'play') {
    if (typeof GLStore.setProductMode === 'function') GLStore.setProductMode('play');
}
```

Fires when:
- User reaches ≥3 songs for the first time
- Sets `gl_avatar_autolaunch_done` flag so it only fires once

**BUT** — since the product mode system is deprecated, this auto-transition is effectively a no-op for UI purposes. The mode flag flips but nothing changes visually.

So in practice: **there are zero user-facing auto-transitions.** Every mode change visible to the user is user-initiated.

---

## 5. Music-Time vs Stoner Mode Interaction (probed conceptually)

I didn't run a live browser probe (would have produced more localStorage mutations + cleanup overhead). Conceptually, given the architecture:

- Stoner Mode is a **separate full-screen overlay**. The main multitrack player surfaces are NOT shown while Stoner Mode is active. They're separate full-screen experiences.
- So "does music-time silence override Stoner warmth?" is a category error — they don't overlap. The multitrack player exists in the main-app surface space. Stoner Mode lives over the top of everything with `z-index: 2500`, hiding the main app underneath.

**The full-screen modes (Stoner / Live Gig / Rehearsal) and the multitrack player are mutually exclusive surfaces.** Each governs its own region of the screen. The team has structurally separated them.

---

## 6. Error Messages Are Register-Blind

Sampled error toasts from `app.js`:

```
'⚠️ Audio Splitter not loaded'
'⚠ Sign in first'
'⚠ Firebase not ready — refresh the page'
'⚠ Failed to save: ' + e.message
'⚠ Subscribed but confirmation SMS failed: ...'
```

All use the clinical "⚠ + reason" pattern. **Error messages are mode-blind** — the same toast text fires regardless of whether the user is in Stoner Mode, default mode, or any other state.

This is consistent with the team's "single coherent page structure" decision: errors come from a shared utility (`showToast`), they don't know what register the surrounding surface uses.

---

## 7. Mode Discoverability

How does a user find Stoner Mode?

- **Primary path:** the `🌿 Mode` chip in the top-right header. Always visible on every page (in default mode). One click → menu appears → "Stoner Mode" option.
- **Secondary path:** none visible. Not in onboarding overlay (now no-op'd per Bug #23 fix). Not in the avatar panel. Not in any hint copy.

**The Stoner Mode chip is the SOLE discoverability path.** A user who doesn't notice or click that chip never encounters the collaborative-voice product. This is the consent-by-opt-in design — but it's also the discoverability gap.

The "🌿" leaf emoji is the only label hint. The button literally reads "🌿 Mode" — it doesn't say "Stoner Mode" until you click it. A user could go years without realizing what's behind that chip.

---

## 8. Cluster Updates (sparing — most are confirmation of priors)

### Cluster SSS — **The team explicitly rejected mode-based UI gating**
Source comment: "LEGACY MODE SYSTEM — NO LONGER USED FOR UI GATING. All features are always visible in a single coherent page structure." Documented design decision against multi-register main-app surfaces.

### Cluster TTT — **The two mode flags are independent layers**
`gl_product_mode` (deprecated informational) and `deadcetera_stoner_mode` (active full-screen toggle) are decoupled. No interaction between them.

### Cluster UUU — **Stoner Mode is band-scoped + device-scoped (privacy property)**
Storage key `deadcetera_stoner_mode` uses band slug. Switching bands resets the preference. Switching devices resets the preference. Mode is intentionally local.

### Cluster VVV — **Exactly one auto-transition exists, and it's a no-op**
Avatar Guide's auto-`setProductMode('play')` flips an informational flag with no UI consequence. Effectively zero user-facing auto-transitions.

### Cluster WWW — **Full-screen modes and main app are mutually exclusive**
Stoner / Live Gig / Rehearsal overlay over the main app. The multitrack player belongs to the main-app surface. They don't co-exist or interact at the register level.

### Cluster XXX — **Error messages are register-blind**
Shared `showToast` utility produces identical clinical text regardless of mode. Errors are "system-level," not surface-level.

### Cluster YYY — **Stoner Mode discoverability has one path, no second**
The 🌿 Mode header chip is the only entry point. No onboarding, no avatar hint, no contextual surface. The chip's label doesn't even say "Stoner."

---

## 9. The Question Re-Answered

**Q (from the brief):** What conditions justify movement between operational register and collaborative register?

**A (refined by this harvest's evidence):**

The team has answered this question by design. The conditions for register transition are:
1. **User explicit opt-in via the 🌿 Mode chip** (Stoner Mode)
2. **User explicit opt-in via context-specific entry points** (Live Gig from gig context, Rehearsal from plan context, Practice Mode from song detail)
3. **The avatar panel is invitation-based** — appears warmer when opened, stays out of sight when closed

There are no time-based transitions. No urgency-based transitions. No emotional-state transitions. No effort-based transitions. The team chose **user-initiated mode-switching only**.

The remaining question — which is what Drew's brief was probably actually trying to address — isn't "when should the system transition between two voice registers in the main app." That's been decided: never (main app is single-register by design).

The remaining question is whether the **default main-app register** should soften (more "you/your/we" / fewer imperatives / occasional acknowledgment) in ways that wouldn't constitute a separate mode but would feel more relational. That's a different question, more answerable by copy review than by transition governance.

Per the brief: this is named, not solved.

---

## 10. Methodological Honesty (updated)

Last harvest I noted diminishing returns at harvest 9–10. This harvest's findings counter that observation in one specific way:

**The "deprecated" comment is genuinely new evidence not surfaced by any prior harvest.** It changes the framing of "register" as a concept. So returns are still positive when probing specifically at the architectural-decision layer (source comments, deprecation notes, infrastructure choices).

But the *scenarios* I ran for this harvest (RT2-A through RT2-G) mostly produced confirmation rather than discovery. The single architecturally-significant finding came from one grep into one file. That suggests the productive form of investigation now is:

- **Targeted source-archaeology** (search the codebase for explicit design comments + deprecation notes + intentional architectural choices)
- Rather than **scenario-based probing** (which mostly redescribes already-known structural features)

If Drew wants further harvests, they would be more valuable framed as **specific source-archaeology questions** ("what's deprecated and why?", "what features were explicitly disabled or hidden?", "what comments mark intentional restraint?") than as new conceptual axes.

The 70-cluster framework is now hitting its useful limit as an indexing system. The actual distinct findings are concentrated in a handful: the deprecation finding (this harvest), the Stoner-Mode-as-separate-product finding (Consent + this), the conservative-discernment-encoded finding (DB), the data-shape-gaps finding (RT + several prior).

---

## 11. Cumulative Cluster Inventory (11 harvests, 77 clusters)

| Harvest | Letters |
|---|---|
| Calmness | A–G |
| Longitudinal | H–K |
| 30-day Pass-1 | L–U |
| 30-day Pass-2 | V–AA |
| Emotional authority evolution | BB–II |
| Intent vs exploration | JJ–PP |
| Reciprocal trust | QQ–XX |
| Reciprocity-collaborative | YY–DDD |
| Consent | EEE–KKK |
| Discernment boundary | LLL–RRR |
| **Register transition (this)** | **SSS–YYY (7)** |
| **TOTAL** | **77 clusters across 11 harvests** |

Per Drew's instruction: no abstraction proposed. No mode-merging, adaptive AI, emotional routing engine, or automatic tone switching is proposed. The structural shape is documented.

---

## 12. Production Data Side-Effects (transparency)

| Operation | Status |
|---|---|
| Browser sessions opened | 0 (codebase-inspection harvest) |
| Firebase writes | **None** |
| localStorage writes | None new |
| 5/10 corrupt `durationSec: 30` | **Unchanged** |

---

**End of Register Transition harvest.**

**Eleven accumulated harvest docs in repo:**
1. `overnight-calmness-harvest-2026-05-26.md`
2. `overnight-longitudinal-continuity-2026-05-26.md`
3. `overnight-30day-bandlife-simulation-2026-05-26.md` (Pass-1)
4. `overnight-30day-bandlife-pass2-saturation-2026-05-26.md` (Pass-2)
5. `overnight-emotional-authority-evolution-2026-05-26.md`
6. `overnight-intent-vs-exploration-2026-05-26.md`
7. `overnight-reciprocal-trust-2026-05-26.md`
8. `overnight-reciprocity-collaborative-emotional-2026-05-26.md`
9. `overnight-consent-2026-05-26.md`
10. `overnight-discernment-boundary-2026-05-26.md`
11. `overnight-register-transition-2026-05-26.md` (this)

**The single most consequential finding across all 11 harvests is in this doc's §1: the team explicitly deprecated the multi-register system. The question "when should the system transition between registers" has already been answered by design: not in the main app; only via user-initiated full-screen alternative products.** That decision is older than this investigation. The prior 10 harvests' framing of "the system has registers it could switch between" was implicitly assuming an architectural posture that the team had already rejected.
