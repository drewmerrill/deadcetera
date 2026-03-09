Here's the full audit:

---

## 1. Durable — Keep As-Is

These are timeless rules and infrastructure facts that will stay true for the foreseeable future:

- **#1** — Terminal style rules (zsh, heredocs, `!` in strings) ✅
- **#2** — GL command reference ✅
- **#3** — New file deploy checklist ✅
- **#4** — Session start protocol ✅
- **#5** — Session coding lessons ✅
- **#7** — Worker deploy command + secrets + URL ✅
- **#9** — Session close rules ✅
- **#13** — Rebrand complete + infra stays deadcetera ✅
- **#16** — Roadmap ✅
- **#18** — iTerm output rule ✅
- **#21** — Google Maps DirectionsService lesson ✅
- **#22** — sync.py safety / app.js sha lag ✅
- **#23** — File safety rule (grep before patch) ✅
- **#25** — app.js disk safety ✅
- **#30** — Local dev URLs (gl / gldev / localhost:8000) ✅

---

## 2. Probably Outdated or Session-Specific

These are point-in-time snapshots. The line counts and shas are stale by now and take up space:

- **#10** — help.js rebuild from 20260303-S2 (line count stale)
- **#11** — Lessons from 20260303-S2 (already covered by #5)
- **#12** — Fixes from 20260303-S1 (ancient history, all deployed)
- **#15** — Session 20260303-S3 notes (covered by #13)
- **#17** — Session 20260304-S1 summary (line counts stale)
- **#19** — Session 20260305-S2 summary (line counts stale)
- **#20** — Session 20260306-S1 summary (line counts stale)
- **#26** — Session 20260308-S4 summary (superseded by current state)
- **#27** — Session 20260308 summary (sha/line counts stale)
- **#28** — Session 20260308-S3 summary (Harmony Lab shipped)
- **#29** — pocket-meter.js detail (very specific, unlikely to need verbatim)

---

## 3. Duplicates / Should Be Merged

- **#6 and #24** — Both say "never suggest cache." Merge into one.
- **#8 and #14** — Both describe Version Hub + multi-band deploy. Could be one "Current deployed feature state" entry.
- **#6** also contains the `cp ~/Downloads` rule which could fold into **#2** (workflow).

---

## Recommendation

Trim #10–12, #15, #17, #19–20, #26–29 (9 session history entries) — they're changelog, not operating rules. Merge #6+#24 and #8+#14. That would free up ~11 slots and leave only clean, actionable, always-true rules.

Want me to do that cleanup now?