# GrooveLinx — Claude Prompt Templates

Reusable templates for Claude-driven development sessions.
Copy, fill in the blanks, paste as the opening message.

---

## A. Feature Implementation

```
We are implementing a GrooveLinx feature.

Current baseline: Build [BUILD_NUMBER]
Branch: Create [feat/branch-name]

Goal:
[1-2 sentence description of what we're building]

Scope:
- [Specific deliverable 1]
- [Specific deliverable 2]
- [Specific deliverable 3]

Guardrails:
- Use js/core/groovelinx_store.js for all shared state
- Do not modify [list any files that must not be touched]
- Do not introduce frameworks or build systems
- Do not bundle unrelated changes
- Keep backward compatible with existing data

Required output format:
- Branch name
- Files changed
- Commit hash
- What changed (concise summary)
- What to test on preview
- Preview status

After pushing the branch, STOP and wait for preview testing
feedback before merging or continuing.
```

---

## B. Post-Implementation Audit

```
Do a strict post-implementation audit of Build [BUILD_NUMBER].

Do NOT add new features. Do NOT expand scope. Audit only.

Verify in this order:

1. [Feature/area name]
- [Specific check 1]
- [Specific check 2]
- [Specific check 3]

2. Backward compatibility
- Verify existing data/state is not broken
- Verify persistence load/save paths are safe
- Verify shared functions whose behavior changed indirectly

3. Regression review
- List all touched functions and shared dependencies
- Identify highest-risk regressions
- Identify anything that should be a separate follow-up patch

Output format:
- PASS / WARNING / FAIL by area
- Exact files and functions inspected
- Specific code-level risks
- Minimal corrective patch plan only where needed
```

---

## C. Bugfix / Hotfix

```
We need to fix a bug in GrooveLinx.

Current baseline: Build [BUILD_NUMBER]

Problem:
[What is broken — exact behavior observed]

Reproduction:
[Steps to reproduce, or console errors, or screenshot reference]

Fix scope:
- Fix ONLY the described issue
- Do not refactor adjacent code
- Do not add features
- Do not expand scope

Regression caution:
- [List any areas that could be affected by the fix]
- Verify the fix does not break [specific related feature]

Branch rule:
- [Use branch fix/description] OR [Hotfix: push directly to main]
- [If hotfix: explain why urgency justifies skipping preview]

Required report-back:
- Branch name (or "main" if hotfix)
- Files changed
- Commit hash
- Root cause (1-2 sentences)
- What the fix does
- What to test
- Preview status
```

---

## Usage Notes

- Always fill in the build number so Claude has the correct baseline
- Always specify guardrails — what NOT to touch is as important as what to build
- The stop-after-push rule prevents premature merges to production
- Audit template should be used after any multi-file feature implementation
- Hotfix template includes an explicit branch-vs-main decision point
