# Interaction Lab 01–06 — final QA and fixes

Owner specification: [FINAL_QA_01_06_SPEC.md](FINAL_QA_01_06_SPEC.md), received and
read in full. Base `main`: `61d7a5b1f0f8085a4b63168d5762bac216b2bfa6` (PR #3
merged by the owner). Branch: `bugfix/01-06-final-qa`. No automatic merge or deployment.

## Five issues and causes

| Issue         | Verified cause                                                                                                              | Change                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BF04-01       | main.ts explicitly called openPanel('navigation') at startup                                                                | Remove the call; index is already the initial markup/state. Selected Module 04 still starts at World.                                                                                       |
| BF04-HOME-01  | Large index cards acquired data-action and inherited touch-action:none; their input bubbled into the custom game controller | Reuse the local native module-navigation binding on the card grid and scope touch-action:auto to these cards. Native pan cancels the candidate; mouse/keyboard keep valid-release behavior. |
| BF04-02       | Emoji insertion trusted cached selection; native caret updates can precede queued select/selectionchange notifications      | Read the live textarea range immediately before insertion, observe selectionchange and measure the current DOM caret. No focus forcing.                                                     |
| BF04-GUIDE-01 | Event entry used !eventEntered to decide automatic opening                                                                  | For a real World → Event transition use !guideCompleted. Repeated queued enter while already in Event remains idempotent.                                                                   |
| BF04-GUIDE-02 | Resume retained lastPage, which tracks browsing rather than reading                                                         | On incomplete Event entry derive lastPage from the durable acknowledged prefix + 1. Viewing older pages cannot change progress.                                                             |

Same-visit Close → Help preserves the last viewed page and starts it at top.
World → Event entry resumes the first unread page while incomplete, including
after real reload, Reload Page and Simulate App Restart. Completion remains open
with checks; a subsequent opening is manual reference mode, without wrapping.

The checked-out baseline capped the expanded composer at exactly three lines
(96px), despite the latest accepted ~3.5-line requirement. Both its measurement
and CSS cap now retain the half-line affordance: 108px at the current 24px line
height and padding/border. Three complete lines remain 96px. Internal scrolling,
smooth height transition and bottom-aligned 48px controls are preserved.

## Architecture and preservation

No new storage schema, migration or persisted cursor is needed. lastPage keeps
its existing browsing meaning; acknowledgedPages is the durable reading source.
The repository transaction, ordering, lease/epoch fences and confirmed reset
scopes are unchanged. Acknowledgment still unlocks only after transaction completion.

No shared InteractionController, carousel, Hold/Repeat, geometry, configuration,
Module 06 persistence or guide swipe-controller changes. No global gesture
listeners added. Native index gestures are local; the global selectionchange
observer only reads the focused textarea selection. Safe text/grapheme filtering,
send/cooldown/deduplication, seeds/Live and storage isolation remain intact.
No dependency, backend, external asset, secret or deployment configuration changes.

Production source files: src/main.ts, src/module-strip.ts, src/chat-ui.ts,
src/chat.css, src/event-state.ts. Three new focused browser files and two new
model checks extend existing coverage. Existing tests are retained; old startup,
first-entry-only and exactly-three-line expectations change only where this new
owner specification explicitly supersedes them. Helpers assert in-place restart
and reset remain in Module 04; only actual reload reopens it from the index.

## Performed regression evidence

Before fixes, focused checks reproduced:

- Index startup and native card pan: **0 PASS / 2 FAIL**. Startup opened Module 04;
  document scroll stayed 0 instead of advancing more than 20px.
- Emoji selection: **2 PASS / 4 FAIL**. Middle/end insertions occurred at 0,
  selected family emoji was retained instead of replaced, including at the cap.
- Guide resume: **0 PASS / 1 FAIL**. Reload → World → Event left the guide hidden.
  A pure transition also retained viewed page 1 with acknowledgments [1,2].

After fixes, isolated runs passed index **6/6**, emoji **7/7**, guide **10/10**.
One intermediate guide run was interrupted by Vite HMR while main.ts was being
edited: 9 passed, one timed out during an unintended navigation. Its trace showed
the reload before the test's planned restart. A fresh, stable run passed all 10.
This interrupted development run is separate from the full final regression run.

The first complete run then found a real picker regression: **199 PASS / 1 FAIL**.
Snapshotting the caret at picker PointerDown also scheduled size(), replacing a
constrained max-height of 100px with 236px before native pan. Measured client height
grew from 98px to 204px, removing overflow and leaving scrollTop at 0. Selection
snapshot and layout scheduling are now separate: pointer controls only read the
range; actual changed selection notifications may schedule measurement. Accepted
edits already schedule size(). The existing constrained native-scroll expectation
is preserved. This failure was fixed before the final full run.

## Final full results

**268 PASS / 0 FAIL / 0 SKIPPED** in the final complete run. No flaky tests or retries.

| Command             | PASS | FAIL | Result                                                   |
| ------------------- | ---: | ---: | -------------------------------------------------------- |
| npm run check       |    — |    — | TypeScript clean                                         |
| npm test            |   51 |    0 | Model/pipeline suite                                     |
| npm run test:e2e    |  200 |    0 | Complete Chromium suite, retries=0, flaky=0, 7.3 minutes |
| npm run build       |    — |    — | Production dist built successfully, 22 modules           |
| npm run test:static |   17 |    0 | Production dist under local /lab/                        |

Baseline before this task: 49 model + 177 browser + 16 production = 242.
Added 2 model, 23 browser and 1 production checks; no old tests were deleted.
[Machine summary and tested-file hashes](testing/final-qa-summary.json),
[production results](testing/final-qa-static-results.json),
[before-fix evidence](testing/final-qa-before.json),
[picker regression evidence](testing/final-qa-picker-regression.json).
Final source formatting and git diff --check pass; credential-pattern scan found
no secrets in task text files. Six original handoff files and shared interaction,
configuration, carousel, geometry, draft and guide-gesture controllers are unchanged.

Reviewed Chromium viewport captures: [index](testing/final-qa-index-mobile.png)
and [expanded composer](testing/final-qa-composer-mobile.png). Measured composer:
108px, 3.5 content lines, overflow:auto; no page errors during capture. These are
Chromium layout observations, not physical iOS keyboard/selection verification.

## Manual iPhone verification — PENDING

The five original failures were observed by the owner on a physical iPhone 15 Pro
Max. The fixes have not yet been rechecked on that device. Chromium native CDP
touch, synthetic event ordering, keyboard and resize checks are distinct evidence.

Repeat in Safari and Chrome iOS, recording URL/commit, iOS version and observed result:

1. Cold open/reload → six-module index; open each module, Close/Back → index;
   Module 04 starts at World. Swipe vertically directly over large cards; both
   horizontal strips still reach 05/06 without accidental activation. Rotate.
2. Restore a draft, place the visible caret at beginning/middle/end with touch
   and selection handles, insert several emoji, select/replace text, type normally,
   reload and repeat with family/skin-tone/flag/combining sequences near 500 graphemes.
   Check keyboard focus and the ~3.5-line internal-scroll affordance/caret visibility.
3. Fresh Event → acknowledge 1/2 → view 3 without acknowledgment → backtrack to 1
   or 2. Repeat browser reload, Reload Page and Simulate App Restart: World first,
   then Event automatically shows page 3 at top, retaining [1,2] and locking page 4.
4. Complete page 5; window stays open. Reload/restart → Event has no auto-guide;
   Help opens reference mode. Back/Next/dots/swipe agree and never wrap.
5. Close/reopen, rapid taps/swipes, background/foreground and orientation changes;
   no stuck presses, unintended sends/acknowledgments or lost durable progress.
6. Spot-check modules 01–03/05–06 and both confirmed reset scopes; event-only reset
   preserves chat/settings, full 04 reset preserves other modules.

## Limits

Physical iOS selection handles, virtual keyboard/IME, native scrolling/bounce,
safe areas and OS interruptions still require the checklist above. Browser storage
can be evicted or unavailable; SAVED means completed IndexedDB transaction, not
crash/power-loss immunity. Existing single-owner tab leases remain unchanged.
No Module 07, Assembly Lab or deployment migration is implemented in this PR.
