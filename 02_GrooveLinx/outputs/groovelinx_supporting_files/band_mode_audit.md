# Band Mode Audit — Architecture Reference

This file documents the existing system architecture for ChatGPT handoff.

## Screenshots Needed

The following screenshots should be captured from GrooveLinx (app.groovelinx.com)
and placed in this folder (`02_GrooveLinx/outputs/groovelinx_supporting_files/`):

### Required Screenshots:

1. **play_dashboard.png** — Play mode home dashboard (switch to Play mode via mode selector)
2. **setlist_player_overlay.png** — Setlist player after tapping headphones on any setlist
3. **live_gig_mode.png** — Go Live mode (tap "Go Live" from a gig card)
4. **rehearsal_mode.png** — Rehearsal mode overlay (start a rehearsal from planner)
5. **stoner_mode.png** — Stoner Mode (toggle from menu or gig)
6. **band_scorecard.png** — Band Scorecard card on Sharpen or Lock In dashboard
7. **next_action_card.png** — Next Action card on home dashboard
8. **completion_screen.png** — Completion screen after finishing a listening queue

### How to capture:
- Use Safari or Chrome on iPad/iPhone
- Take screenshots at natural breakpoints
- Save to this folder with the filenames above

### Why needed:
ChatGPT uses these to understand the current visual state of each component
when planning Band Mode integration. Without screenshots, it may propose
UI changes that conflict with what's already built.
