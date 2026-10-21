# Dark Kingdom War — Interaction Lab 01–06: final QA and fixes

## Thank you
Thank you for building and refining the Interaction Lab. The six modules, especially the Module 04 event guide and clan chat, have become a useful and thoughtful real-device testing environment. We appreciate the care you put into details such as the chat field's ~3.5-line scroll affordance, safe message rendering, and gesture handling. This is a focused polish pass, not a redesign. Please keep the working behavior intact.

## Scope and method
- Investigate and fix the **five reproduced physical-iPhone issues** below. Treat observations as evidence, and root causes as hypotheses until verified in code.
- Inspect current repository and test setup before editing. Use small, maintainable changes and automated regression coverage. Do not silently change agreed interaction rules.
- Run relevant unit/browser/production tests and report exact outcomes, including failures or environment limits.
- Prepare a PR with change summary, regression evidence, and a concise manual iPhone QA checklist. Do not merge without explicit approval.

## Confirmed issues

### BF04-01 — Incorrect initial lab entry
**Actual:** Opening the Lab site automatically opens Module 04.
**Expected:** Opening the Lab site shows the main experiment index with all six modules; a test opens only when the user selects it. Closing a test returns to the index. **Important distinction:** inside Module 04, the initial view should still be the World map.

### BF04-HOME-01 — Vertical scroll over index cards
**Actual:** Vertical swipes starting on the large module cards do not scroll the index document.
**Expected:** Vertical swipes on cards scroll the page; taps still open the card's module; scrolling must not trigger accidental navigation. **Preserve the now-working horizontal swipe of the module strips.**

### BF04-02 — Emoji insertion uses stale caret/selection
**Actual:** After reload with a restored chat draft, the user places the visible caret at the end, but emoji picker insertions can appear at position 0. Repeated emoji insertions sometimes diverge from the visible caret; positioning the caret in the middle may work, and typing a regular character can temporarily restore correct behavior.
**Expected:** Emoji inserts at the actual selection/caret location (beginning, middle, end) and replaces selected text when appropriate, consistently after draft restoration, pointer/touch selection changes, repeated picker inserts, and Unicode/grapheme sequences. Preserve normal iOS keyboard behavior, focus, selection, draft persistence, and 500-grapheme limit.

### BF04-GUIDE-01 — Unfinished first-read guide fails to reopen automatically
**Actual:** If the user has not completed the first-read guide, then reloads and enters Event from World, the guide appears only after tapping `?`.
**Expected:** If first-read is incomplete, entering Event automatically opens the unfinished guide, without `?`. Reload/restart returns Module 04 to World first; the auto-open occurs upon Event entry. Once the first-read is fully completed, no automatic opening; `?` still opens the guide on demand.

### BF04-GUIDE-02 — Resume tracks last viewed instead of first unacknowledged page
**Actual:** After acknowledging pages 1 and 2, opening page 3 without pressing `Понятно`, navigating backward to page 1 or 2, and reloading, the guide resumes at the last *viewed* page.
**Expected:** Resume at the first **unacknowledged** page (page 3 in this example), regardless of the page last viewed before reload. Viewing/backtracking must not roll back acknowledged progress. Apply consistently to browser reload, `Reload Page`, and `Simulate App Restart` (subject to the intended persistence model). Maintain first-read gating and non-cyclic navigation. When a new guide page is shown, its content starts scrolled to the top.

## Preserve existing accepted behavior
- Module 04 World/Event transitions, guide pages and first-read gating, interactive page dots, non-cyclic page navigation.
- Chat: ~3.5 visible lines in the expanded field as a deliberate visual hint of internal scrolling; do not collapse to exactly 3 lines. Preserve input growth, internal scroll, caret visibility, emoji picker, cooldown, duplicate-send guard, seeded/live messages, persistent draft and history, and inert/safe rendering of tag-like content.
- Existing horizontal swipe behavior on home/index module strips.
- Reset Event vs Reset Module 04 semantics; don't inadvertently reset unrelated persisted state.
- Modules 01–03, 05–06: preserve behavior and run regression coverage, not speculative feature changes.

## Acceptance scenario for guide resume
1. Start fresh Module 04 first-read state; enter Event; guide opens automatically.
2. Acknowledge page 1, acknowledge page 2, reach page 3; **do not** acknowledge page 3.
3. Navigate backward to page 1, then reload/restart.
4. Module 04 starts in World. Enter Event: guide opens **automatically at page 3**.
5. Repeat with last viewed page 2, and with each supported reload/restart control.
6. Finish the entire guide, reload, enter Event: **no auto-open**; `?` opens guide normally.
7. Verify newly navigated pages start at top and navigation never wraps last→first.

## Manual iPhone QA checklist
- Cold-open site → index, not Module 04; open/close modules.
- Vertical swipe starting over large index cards scrolls page; horizontal strip swipe still works; swipe doesn't activate card.
- Restore chat draft; place caret at beginning/middle/end; insert multiple emojis; select and replace text; type ordinary text; verify after reload.
- Check chat field ~3.5-line hint and internal scrolling at long draft lengths.
- Check guide resume scenario above on physical iPhone, including `Reload Page` and `Simulate App Restart`.
- Spot-check all six modules for navigation, overflow, scroll, touch targets and persistence.

## What comes next — context only, do not implement in this PR
After 01–06 reach a clean physical-device PASS, we plan Module 07 (responsive UI behavior and resource HUD experiments: desktop 4 standard resources + gold; mobile one selectable/contextual standard resource + separate gold), followed by a UI Assembly Lab for testing real layered frame art, dragon corner overlays, close/arrows, typography, sizing, anchors, safe areas, and Light/Dark skins. These are future design discussions, not requirements for this bugfix PR. We may use the existing site and aaPanel infrastructure later, but do not migrate deployment now.

Thank you again — the goal is to protect the good work already done and make the lab reliable enough to serve as the foundation for the game's UI redesign.
