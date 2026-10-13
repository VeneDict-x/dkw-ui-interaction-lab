# DKW UI Interaction Lab — Bugfix Task 03

**Repository:** `VeneDict-x/dkw-ui-interaction-lab`  
**Target:** current `main`  
**Reference:** https://venedict-x.github.io/dkw-ui-interaction-lab/  
**Scope:** P0 stability, behavioral regression protection, carousel UX, responsive geometry, and a new sixth Draft & Recovery laboratory module.

## 0. Operating instructions

Inspect the actual repository and existing tests before coding. The behaviors below are the product contract; do not infer that existing implementation is correct. Reproduce reported defects where feasible and distinguish confirmed issues from hypotheses. Work in reviewable increments, document choices, and run existing and new tests. Do not claim physical iPhone Safari PASS from desktop emulation. Do not overwrite or remove an earlier working version without the repository's normal review/deployment safeguards.

Priority: (1) P0 lifecycle defects, (2) frozen-contract regression tests, (3) remaining corrections, (4) new Draft & Recovery module. Keep experimental constants configurable. Avoid unnecessary architectural rewrites.

## 1. P0 — Repeat runaway and cross-component interference

### BF03-01 — Generic Repeat session can survive Safari interruption

In `03 Buttons → Generic Repeat`, long touch may invoke native text selection/context menu. The counter then continues increasing after release, and status may remain `HOLDING · READY` without an active pointer.

Investigate pointer ownership, timers, native interruption, and cleanup. Correctly handle `pointerup`, `pointercancel`, `lostpointercapture`, `blur`, `visibilitychange`, unmount, and any actual terminal interaction. Clear pending initial-delay timers, repeat timers, and listeners; stale callbacks must not resurrect ended sessions. No action may fire after genuine termination. **Do not terminate a recognized Hold merely because its finger moves outside the button**; this is distinct from genuine touch release or cancellation.

### BF03-02 — Isolation and recovery

While Repeat is stuck, toggling `Action availability` in section 05 can pause/resume the unrelated section 03 counter; after several toggles buttons may stop responding while scrolling still works. Investigate root cause (state ownership, stale closures, pointer capture, listeners, timers, overlays, and shared dependencies). Instances must be isolated; all controls must recover without reload. Add regression tests for repeated toggles and interruptions.

### BF03-03 — Scope native text-selection prevention

Prevent native text selection and unwanted callouts on interactive game buttons (appropriate `user-select`, `-webkit-user-select`, `-webkit-touch-callout`, event handling). Do **not** globally disable selection, copy, editable fields, diagnostic text, export, accessibility, keyboard input, or page scroll. This is not a substitute for BF03-01 lifecycle fixes.

## 2. BF03-04 — Navigation Hidden boundary

In `04 Navigation`, `Boundary = Hidden` on page 1/5 currently shifts `Next →` into the left Back slot. Reserve independent left/right layout slots. Hidden Back/Next have no visible or invisible hit target; the other button remains in its original position. Preserve all other boundary modes, pagination indicators, close/reopen state, themes, and Strict Tap.

## 3. BF03-05 — Discrete initial Repeat delay control

Add a slider with multipliers **1.0 through 2.5 inclusive, step 0.1** (16 values), displayed to one decimal. Prefer integer tenths internally. Use one consistent selected experimental multiplier for Generic Repeat and `03 Buttons → Tap/Hold/Repeat`. Multiply the **initial delay before repeating**, not subsequent tick intervals or approved Tap/Hold recognition semantics. Inspect actual timing architecture to avoid accidentally shifting the Hold classification. The original baseline remains identifiable. **Do not change Bounded Steps acceleration**. Final multiplier is subject to manual physical Safari selection.

## 4. BF03-06 — Availability timing

Change the laboratory's timed pause scenario to **pause at 2.0 s and resume at 4.0 s, both relative to test trigger**. This is test-only; it must not create gameplay latency. Interaction and action Availability are separate. An unavailable action does not execute; a recognized Hold can continue; no backlog accumulates; actions may resume on the normal schedule when available. Genuine release/cancel ends the session.

## 5. BF03-07 — Carousel arrow affordances

Use `❮` and `❯` at the corresponding edges of each carousel viewport. When navigation in that direction is unavailable, remove the arrow and its hit area completely. Do not cover cards with invisible targets. Keep `←`/`→` for Navigation pagination. Preserve gesture-owner locking and card-tap cancellation on drag.

## 6. BF03-07A — Adaptive Carousel Peek and exact boundaries

Use **N + Peek**, not necessarily N + 1/2. A partially visible neighboring real card may be approximately **20–80%** visible, chosen responsively for usability. No fake slides. For identical card canvases and viewport conditions, card width and gap must **not** depend on how many items the carousel contains. Each carousel calculates its own extent.

**Canonical example:** usable viewport fits 3.5 cards (including gaps in the simplified measurement):

- 1 item: one full card, 2.5-card equivalent empty space to right, no scroll.
- 2 items: two full cards, 1.5 equivalent empty space to right, no scroll.
- 3 items: three full cards, 0.5 equivalent empty space to right, no scroll.
- 4 items: at left bound, cards 1–3 full and card 4 half; at right bound, right half of card 1 and cards 2–4 full. **No trailing empty area beyond card 4.**

For scrollable carousels, initial left inset before first card equals final right inset after last card. The last card must be fully visible at the right resting bound. Natural empty space is allowed only when total content is shorter than viewport. Overscroll may temporarily expose space but must spring back. Do not stretch cards with `space-between` or item-count-dependent width.

Simplified geometry (account for actual DOM measurements, margins and gap):

`contentWidth = 2 * edgeInset + N * cardWidth + (N - 1) * gap`  
`maxScroll = max(0, contentWidth - viewportWidth)`

Recalculate after resize/orientation; avoid stale bounds and sudden layout jumps.

## 7. BF03-08 — Continuously diminishing, unbounded rubber-band resistance

Current overscroll travels roughly 20–25% of screen width then hits a **hard stop**. Replace with a continuous monotonic response with diminishing incremental displacement, **without a finite hard clamp**. The user should be able to keep dragging or continuing an active multi-touch gesture and obtain progressively smaller movement; the carousel should not abruptly freeze at a fixed offset.

A candidate is `d(x) = k * ln(1 + x/k)` for overshoot drag distance `x >= 0`; this is illustrative, not mandatory. Document chosen resistance and parameters. Be careful about floating-point precision and practical responsiveness at extreme distances. Do not substitute a bounded asymptotic curve that effectively stops in normal testing.

Define touch ownership/handoff explicitly. Lifting one finger must not end a legitimate continuing gesture owned by another active finger; lifting the **last** active finger ends it. No ghost movement from inactive pointers. On final release or cancellation, smoothly return to the exact valid bound, remove transient offset, and prevent accidental card taps. Preserve vertical page scrolling and existing nested-gesture ownership.

## 8. BF03-09 — Window & Resize Reset

`Reset test` resets **only module 05** to its documented defaults: mock width, mock height, Draft text, Persist selection, and other module-owned transient state. It must not reset other modules. Invalidate pending resize work so it cannot overwrite the reset. Reset and export diagnostics remain distinct functions. Test by modifying all fields, resetting, and verifying defaults and cross-module isolation.

## 9. BF03-10 — Small heights, mobile landscape

At mock `240 × 220`, `Modules` can become unreadable or almost invisible. Design an adaptive solution with usable hit targets and reachable content in constrained heights and phone landscape, taking account of preview, headers, footers, safe areas, internal scrolling and window bounds. **120 px is NOT an approved hard minimum**. Derive behavior from content and viewport, test `240 × 220`, mobile portrait/landscape, desktop and repeated resize. Do not prohibit landscape. When a requested size is clamped, explain it through diagnostics rather than silently pretending the size was applied.

## 10. BF03-11 — Accurate preset and geometry feedback

Preset buttons simulate **model calculations**; they do not physically resize an iPhone browser viewport. Clearly distinguish selected preset, simulated dimensions, actual viewport, requested mock dimensions, actual applied dimensions and clamping. Preserve aspect ratio, Draft/Persist selection through resize, latest-resize-wins, lifecycle `SETTLED` and Final Validation.

## 11. BF03-12 — NEW MODULE 06: Draft & Recovery

Build a sixth tab named **`06 Draft & Recovery`**. This is a real interactive testbed for draft persistence, crash/reload recovery, asynchronous save races, modal confirmation, and the carousel behavior above. Keep it a **laboratory**; do not imply a production server or remote sync exists.

### 11.1 Layout

Provide a mock editor/window with:

1. **Preview**: a drawn geometric composition reflecting current selections; a line **above** identifying the current combination; a line **below** identifying the latest **successfully persisted draft** (not merely a queued write). Include compact real-time save-state icons/labels near Preview.
2. **Modules**: three independently scrolling, selectable horizontal carousels, using BF03-07/07A/08 behavior and visual selection state.
3. **Actions**: `Apply`, `Cancel`.
4. **Test & Diagnostics**: Applied/Cancelled outcomes, current/draft/applied values, save version, save state, latency, failure reason, recovery state and crash-test controls. Do not confuse the two Preview labels with Applied/Cancelled diagnostic outcomes.

### 11.2 Carousel options and composition

**Carousel 1 — Large shape:** `None`, square, triangle, diamond (square rotated 45° relative to an axis-aligned square), hexagon, octagon.

**Carousel 2 — Small shape:** `None`, circle, square, diamond.

**Carousel 3 — Number:** `None`, `1`, `2`, `3`, `4`.

Preview layers: large shape behind small shape behind centered number, e.g. **Square → Circle → 3**. Use actual rendered shapes, not text alone. `None` hides its own corresponding layer. When large shape is `None`, `Apply` is disabled and must not commit. **Draft autosave is still allowed** for incomplete combinations, including `Large=None`.

A selection updates Current and Preview immediately, independently of persistence latency. The lower Preview line only updates when a corresponding draft write is confirmed successful.

### 11.3 Separate state and lifecycle

Model these concepts separately:

- `Current`: live in-editor selection.
- `Draft`: last successfully persisted selection for the current editing session.
- `Applied`: last successfully committed/published selection, unaffected by draft autosave.
- Edit status: `CLEAN`, `DIRTY`, `DRAFT_SAVED`, with save-specific `SAVING`, `SAVE_FAILED` and clear lifecycle events.
- Action/test outcome in Diagnostics: `APPLIED`, `CANCELLED`, `SAVED_FOR_LATER`, `CONTINUED_EDITING`, as applicable. Do not overload data persistence status with action outcome.

On opening a new edit session, initialize from Applied unless a retained draft is explicitly recovered. A successful Apply commits the latest **Current immediately**, independent of any pending autosave delay, closes the edit session, and invalidates/deletes its obsolete draft. A new edit session starts from the updated Applied.

### 11.4 Persistence and simulated real-time latency

Use actual local persistence suitable for browser reload survival (e.g. IndexedDB), with robust error handling. No simulated success. If the platform cannot persist, report failure. Future remote sync can be architecturally separable but is not implemented or claimed.

Simulate variable asynchronous save latency **1.5–2.5 seconds per save operation**, with changing values to emulate network variability. The delay must be controllable/testable (deterministic injection for automated tests) while visibly varying in normal lab mode. Preserve responsive Current updates. Display `Saving…`, `Draft saved` with time, and `Save failed` with Retry, accurately.

Guard against stale-write races: if save A starts first but completes after newer save B, A must not overwrite B. Version/sequence and editing-session identity must protect persistence and UI. Handle bursts of edits, retries, reloads, pending writes, and storage failures. Avoid showing `saved` before the durable write succeeds.

**Critical:** A pending save from an abandoned or successfully Applied session must never resurrect its deleted draft. Invalidate/cancel obsolete work and ensure storage operations themselves are correctly ordered/guarded, not merely ignored in React state.

### 11.5 Cancel opens a three-way confirmation

Pressing `Cancel` must **not** immediately discard the work. Open a modal (preferred) or, if a true modal is technically impractical, a clearly bounded side confirmation panel with equivalent safe interaction semantics.

Three choices, with distinct outcomes:

- **Yes / Discard changes:** discard Current changes, delete the current session draft, restore Applied, return to the game/lab's non-editing view. Invalidate pending writes so they cannot recreate the draft. This is destructive and must require explicit confirmation.
- **No / Save for later:** persist the **latest Current** as Draft, do **not** change Applied, and only after confirmed successful persistence leave the editor and return to the game/non-editing view. If saving fails, remain in the editor and show Retry/error; do not falsely claim success. A later editor visit can recover this draft.
- **Cancel / Continue editing:** close the confirmation only; keep editor, Current, Draft, Applied and in-flight save lifecycle intact.

Use clear user-facing labels such as `Discard changes`, `Save for later`, `Continue editing` rather than ambiguous standalone Y/N/Cancel if appropriate. Ensure keyboard/focus accessibility, Escape/back behavior, overlay hit-testing and mobile scrolling do not cause accidental discard. The fallback side panel must be inactive/nonblocking when closed.

### 11.6 Recovery after interruption

Distinguish:

- **Background and return with live session:** continue directly in the editor without an unnecessary recovery modal.
- **Reload/restart with persisted unfinished draft:** show a friendly `Draft found` recovery prompt, not a red error alert.

Recovery choices:

- `Continue editing`: restore saved Draft and open editor immediately, no second confirmation.
- `Not now`: dismiss prompt, retain Draft for later.
- `Delete draft`: require a separate destructive confirmation before removal.

Do not restore unsaved in-memory changes after a true restart unless they were actually persisted. Never overwrite Applied merely by recovering a Draft.

### 11.7 Crash-test and diagnostics controls

Place usable test controls near Preview/diagnostics for:

- Background → foreground with live session.
- Real page reload.
- Simulated crash/loss of volatile editor state followed by reinitialization from durable storage.
- Crash **before** pending save completion.
- Crash **after** confirmed save.
- Save failure and retry (deterministically injectable failure).
- Rapid successive edits and out-of-order save completions.
- Apply during an in-flight save.
- Discard during an in-flight save.
- Save for later during an in-flight save.

A simulated crash must actually destroy/reset volatile state and rehydrate from durable storage, **not merely display a recovery modal over still-live state**. Distinguish simulated crash from true browser process crash; never claim to force-kill Safari.

Provide a reset/cleanup path for repeatable test runs without unintentionally destroying the user's persisted draft; destructive clearing must be explicit.

### 11.8 Autosave and publication are distinct

Autosave does **not** commit to Applied. Applied changes only on valid Apply. If Large=None, Apply remains unavailable but Current can still be persisted as Draft. Successful Apply removes obsolete Draft and creates a fresh baseline. Returning from a call without losing the live session must not show a recovery modal.

## 12. Frozen contracts — MUST NOT REGRESS

### Strict Tap (ordinary buttons)

Pointerdown inside starts a candidate. Pointer may move inside for arbitrarily long without triggering action. Exactly **one** action on pointerup inside **only if pointer never left**. The first exit irrevocably cancels that press even after reentry. Release outside, cancellation, and holding without release trigger no action. A fresh pointerdown is required. Applies to ordinary controls including Navigation Back/Next/Close/Reopen.

### ReleaseButton (special exception)

Inside = `PRESSED`, outside = `RELEASED`; moving out/in may rearm repeatedly. Release inside after valid reentry triggers one action; outside release or cancellation triggers none. **Do not convert this to Strict Tap.**

### Hold / Repeat

After recognition, moving finger outside button does **not** end Hold. True release/cancel/lost ownership ends it; Availability suppresses actions without canceling the session, no backlog, no orphan timers.

### Bounded Steps

Approved acceleration curve is frozen. Min/max disabled states and stepping behavior remain. No Generic Repeat multiplier applied here.

### Standalone Arrows

Tap-only; holding does not repeat.

### Navigation

Five indicators, theme variants, pagination, Close/Reopen state retention, boundary modes, Strict Tap; only correct Hidden-slot defect.

### Window & Resize

Preview aspect, Draft text and Persist selection across resize/orientation, latest resize wins, `SETTLED`, Final Validation, preset model computations.

### Nested Gestures

Correct owner locking, card Tap canceled by drag, page scroll, ReleaseButton behavior. Prior experimental slop references: touch ~9.60 px, mouse/pen ~7.68 px; inspect actual source before any change.

## 13. Required regression tests

**Lifecycle/P0:** tap, hold, repeat, initial-delay interruption, active-repeat interruption, pointerup/cancel/lostcapture, blur/hidden/unmount, orphan timer detection, recovery after state changes, two independent repeat instances, availability toggling without interference.

**Contracts:** Strict Tap exit/reentry, ReleaseButton exit/reentry, Hold moving outside, Standalone Arrows tap-only, frozen Bounded Steps acceleration.

**Navigation:** Hidden first/last/middle positions, no invisible hit targets, other modes, Close/Reopen persistence.

**Carousel:** 1/2/3/4 items in 3.5 capacity, 5 vs 20 items same card width, 20–80% Peek when appropriate, symmetric edge insets, no trailing gap at final bound, natural unused space for short content, arrows, resizing, unbounded diminishing overscroll, springback, cancellation, multitouch ownership/handoff, no accidental Tap.

**Window:** Reset only current module, `240×220`, portrait/landscape, requested vs applied, preset vs actual viewport, rapid resize, persistence of Draft text/checkbox.

**Draft:** all shape options and rendering, all three selectable carousels, Large=None disables Apply but not autosave, Current/Draft/Applied separation, changing latency 1.5–2.5 s, save success/failure/retry, out-of-order saves, reload recovery, simulated crash before/after save, background return without modal, recovery Not now and destructive Delete confirmation, Apply while save in flight, Discard while save in flight, Save for later waits for confirmed latest save, Continue editing no mutation, no draft resurrection, no cross-session leakage, repeated edit sessions, diagnostics accuracy.

Prefer deterministic time/failure injection in automated tests. Run TypeScript checks, build, existing tests, and new tests; report exact PASS/FAIL counts and browser coverage. Supply a concise physical iPhone Safari manual QA checklist, especially native text selection, gesture ownership, landscape, storage persistence, and recovery. Clearly mark **physical Safari acceptance PENDING** until user verifies.

## 14. Deliverables and definition of done

- Implement BF03-01 through BF03-12, including BF03-07A and sixth tab.
- Update `docs/BUGFIX_TASK_03.md` with the contract, actual implementation notes, selected parameters, caveats and tests.
- Summarize changed files, root causes, architecture decisions, and unresolved limitations.
- Preserve previous accepted behavior; no broad rewrite or silent contract changes.
- Use normal repo commit/PR workflow; report commit/PR and deployment status only if actually verified.
- Do not claim completed physical Safari QA. The user will conduct device acceptance.

**If a specified behavior conflicts with browser constraints or existing architecture, explain the conflict and smallest viable alternative instead of silently weakening the contract.**

---

## Implementation notes — 2026-10-13

The owner document above is preserved. Task 03 supersedes the earlier shared Slop
policy for ordinary non-Hold buttons: Strict Tap allows arbitrary movement inside
and permanently cancels on first exit. Task 02 ReleaseButtons remain the special
reversible geometry policy; card and pre-recognition Hold Slop rules remain.

### Confirmed findings and lifecycle protection

Before changes, three new Chromium regressions failed: ordinary movement wholly
inside incorrectly cancelled tap; section 05 Availability paused section 03 Repeat;
Hidden Back moved Next into the left slot. The failure evidence was retained in
`docs/testing/bf03-before-summary.json` (not a physical Safari observation).

The shared `model.ready` coupling was confirmed in source. Generic Repeat now has
its own always-ready laboratory action, independent of section 05 availability.
Controller instances own their timers/listeners/session. AbortController and
MutationObserver dispose unmounted controllers and terminate removed targets.
Timer callbacks check current session identity and connectivity, and re-check
identity after action execution before re-arming (an action can synchronously end
its controller). Pointer Up/Cancel/capture loss, blur, hidden, pagehide and native
callout interruption terminate. Scoped contextmenu prevention treats a browser
callout request as an interrupted gesture; it never ends Hold for movement outside.
A terminal native touch fallback cancels a missed Pointer Event session without
fabricating an activation. Interactive buttons/cards suppress native selection
and callouts; text, inputs, copy/export and normal page scrolling stay available.

The exact physical Safari runaway was reported by the owner, not reproduced on an
actual device here. Missed terminal delivery during native callout was a hypothesis;
the additional terminal paths, disposal and reentrant timer protections are covered
by automation. Actual iPhone acceptance is PENDING.

### Parameters and carousel behavior

All pre-existing numeric defaults are preserved, including touch Slop 9.60 px,
mouse/pen 7.68 px, HoldDelay 450 ms, repeatMs 240 ms, acceleration 0.35 and maxRate 12.
New EXPERIMENTAL defaults remain editable/persisted in Debug Panel:

| Parameter | Default | Runtime range / role |
|---|---:|---|
| repeatDelayTenths | 10 = 1.0× | 10–25 integer tenths, 16 values; gallery slider displays one decimal |
| cardPreferred | 108 px | 88–200 px target before UI scale |
| carouselPeek | 0.50 | 0.20–0.80 real partial-neighbor fraction |
| carouselGap | 10 px | 4–24 px |
| carouselInset | 4 px | 0–16 px, symmetric |

Hold classification and its initial tick stay at HoldDelay. Generic Repeat and
Tap/Hold/Repeat multiply only the wait to the first subsequent repeat by
repeatMs × repeatDelayTenths/10; later tick intervals keep repeatInterval.
Bounded Steps ignore this multiplier and keep the approved acceleration. The
initial wait is selected at recognition; editing parameters does not retroactively
rewrite an already scheduled first interval. Availability test timing is exactly
2.0 s pause / 4.0 s resume from trigger, and is not gameplay latency.

`carousel.ts` derives N + Peek from measured viewport and global card profile,
never item count. Real track padding/gap determine scrollWidth; every carousel
has independent bounds. Short content keeps natural empty space. Visible ❮/❯
controls occupy independent edge slots; hidden controls have display:none and no
hit target. Reserved slots remain empty and do not overlay cards.

The old overscroll config key is preserved, now labelled logarithmic resistance
scale k (default 32 px, 0 disables elasticity), not a hard limit:
`sign(x) × k × ln(1 + abs(x)/k)`. The response is monotonic and unbounded, with
smaller increments. Extreme floating-point ratio overflow uses log(abs(x))-log(k)
rather than Infinity. Spring duration remains 180 ms by default; release during
elastic pull returns to the exact bound without starting competing inertia.

Touch continuation is limited to active fingers starting on the same Carousel.
The first recognized owner locks. On owner lift/capture loss, a remaining tracked
finger inherits it; accumulated displacement is rebased without a jump. Inactive
finger moves are ignored; last lift/cancel settles and never selects a card.
Other control sessions ignore secondary pointers; separate controller instances
are independent. Native touchcancel/blur/hidden terminate the interrupted session.

### Window & Resize

Reset 05 restores 520×350 requested size, `State survives resize` text, unchecked
Persist selection, initial H/V and preset/transient state. Pending rAF/settle,
handle capture and stale backdrop checks are invalidated. Other module state,
Debug parameters and shared assertion history are preserved; fresh geometry and
Final Validation are actually performed after reset. Reset 06 instead opens an
explicit local-data cleanup confirmation.

Compact presentation is chosen from measured content/targets and available body
height, not a 120 px minimum. It reduces Preview, stacks the same nodes and scrolls
the whole body so Modules/44 px checkbox remain reachable at 240×220. SVG/reference
aspect and mock preview aspect 1.5 are preserved. Requested mock, applied size,
clamping, actual viewport and simulated preset model are separately labelled.
The staged `geometry.ts` architecture and six original handoff files are unchanged.

### Durable Draft & Recovery

`draft.ts` contains separate repository/editor lifecycles; `draft-ui.ts` adds tab
06, native dialog, shape SVG layers, three shared carousels and diagnostics.
Only local IndexedDB `dkw-drafts-v1` / `lab` stores Draft and Applied; no server,
remote sync, runtime SDK, new dependency or game asset is introduced.

Read/write transactions serialize a singleton record with active editing-session
identity. Durable Draft has session + version + selection + timestamp. A delayed
save performs its session/version comparison inside the same transaction as the
write. A finishes after B cannot overwrite B. Apply/confirmed Discard atomically
clear the active session and Draft (Apply also commits latest Current), so obsolete
callbacks cannot resurrect it. UI epoch cancellation also clears pending delays.
Transaction completion, not request success or delay expiration, earns saved state.
Storage open/transaction errors report SAVE_FAILED and Retry; injected failure is
labelled separately. Current, persisted lower Preview label, Applied, edit status,
save state and action outcome are separate. Version counters are session-scoped;
diagnostics include durable version and current-session confirmed version.

Normal local save latency changes on every consecutive operation within 1500–2500
ms. Deterministic 1500/2500 and alternating out-of-order latencies are selectable.
Draft autosaves incomplete Current, while Large=None prevents Apply. Cancel uses
Discard / Save for later / Continue with native focus trapping, safe initial focus,
Escape continuation and visible focus restoration after leaving the editor.
Save for later waits for the latest confirmed durable write; failure stays editing
with a modal Retry. Recovery is explicit and never changes Applied. Not now retains
Draft; Delete and cleanup require a second destructive confirmation. Live background
return retains Current without a recovery prompt.

Simulated crash cancels jobs, clears volatile Current/Applied/Draft/events/session,
invalidates old write ownership and rehydrates actual storage. Real reload is a
separate control. The lab cannot force-kill Safari. Origin storage can be cleared,
evicted or quota-limited by the browser; it is not a guaranteed remote backup.

### Checks and delivery

Final performed checks on unchanged source/tests:

| Check | PASS | FAIL | SKIPPED |
|---|---:|---:|---:|
| TypeScript | successful | — | — |
| Model tests | 27 | 0 | 0 |
| Playwright Chromium | 107 | 0 | 0 |
| Production build | successful | — | — |
| Production /lab/ static smoke | 10 | 0 | 0 |

**144 PASS / 0 FAIL / 0 SKIPPED**, no retries/flaky outcomes. The complete final
Chromium run contains 37 original + 21 Task 02 + 49 Task 03 regressions. Earlier
failed/targeted attempts are not added to final counts. Test-clock fixtures flush
rAF after terminal events and recognition; the expected counts and boundaries are
unchanged. The final run found and fixed focus restoration after Save for later.
A module-row count assertion is scoped to its original Modules container, keeping
30 expected despite the additional three rows in module 06. Prior five-window and
hard-clamp checks were explicitly updated for the owner-approved six-window and
unbounded-resistance contracts, not weakened to hide a defect.

Machine evidence: `docs/testing/browser-results.json`, `static-results.json`,
`bugfix-03-summary.json`. Source/test hashes confirmed no edits during the final
run. Additional Chromium viewport observations of module 06 at 390×844 and
844×390 preserved Square → Circle → 3, had no horizontal overflow/runtime errors,
and included a landscape modal visual inspection; these observations are recorded
separately in `bf03-responsive-observation.json`, not added to the 144 test count.

The original Pages deployment workflow is preserved. A separate read-only PR
verification workflow runs TypeScript, models, Chromium, build and static checks
without deploying. Delivery uses the review branch `bugfix/task-03` and a PR;
main/site remain the previous accepted version until reviewed merge. Commit/PR
and actual CI/deployment status are reported separately in the delivery response.

Physical Safari acceptance remains **PENDING**. Use the Task 03 section of
`docs/IPHONE_CHECKLIST.md` for native callouts/interruption, touch handoff,
landscape, storage, reload/restart, modal focus and draft recovery acceptance.


### Changed-file map

- `src/interaction.ts`: scoped Strict Tap, isolated session lifecycle, timer/listener
  disposal, native interruption fallback, tracked touch ownership/handoff.
- `src/config.ts`, `src/carousel.ts`: preserved defaults, new experimental fields,
  shared viewport-based card sizing/arrows, unbounded logarithmic resistance.
- `src/main.ts`, `src/style.css`, `src/diagnostics.ts`: sixth panel, utility Pointer
  Events, stable navigation slots, isolated Reset, compact geometry/feedback,
  scoped native prevention and updated assertion descriptions.
- `src/draft.ts`, `src/draft-ui.ts`: transactional persistence, independent state,
  versions/sessions, recovery/crash controls, geometric composition, accessible modal.
- `tests/core.test.ts`, `tests/browser/bugfix-03.spec.ts`,
  `tests/browser/lab.spec.ts`, `scripts/verify-static.mjs`: performed regressions
  and six-window production smoke.
- `.github/workflows/verify.yml`: read-only PR checks; deploy.yml is unchanged.
- `AGENTS.md`, `README.md`, `REPORT.md`, `docs/IMPLEMENTATION.md`,
  `docs/IPHONE_CHECKLIST.md`, this owner document/report and five JSON evidence
  files in `docs/testing`: approved contracts, restoration notes and actual checks.
