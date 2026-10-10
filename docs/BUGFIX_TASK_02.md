# Bugfix Task 02 — ReleaseButton, carousel states and touch Slop

Date: 2026-10-10. Owner-approved change to the release policy. The six original
handoff documents remain preserved; this exception supersedes their irreversible
Slop cancellation only for declared ReleaseButtons (`release`, `lab-release`).

## Approved contracts

ReleaseButton tracks pointer coordinates against its functional bounds during
capture. Inside means PRESSED; outside means RELEASED. Any number of exits and
returns remains reversible, including movement beyond Slop. Down alone performs
no action. Up inside performs exactly one action; Up outside or Cancel performs
none. Press-depth animation must not move the functional hit region. The button
never follows pointer coordinates.

Other buttons and pre-recognition Hold candidates keep their previous Slop
policy. Carousel drag still permanently cancels a card tap, uses the exact
`abs(dx) >= abs(dy)` rule, and locks ownership until Up/Cancel. No new Button,
Hold or Repeat components are part of this task.

Card SELECTED (`aria-pressed`) is persistent model state. PRESSED, DRAGGING and
mouse HOVER are independent temporary attributes, cleared at the relevant
gesture end/cancel/interrupt. Keyboard FOCUS remains accessible. A native sticky
`:hover` on iOS must not impersonate selection or a retained press.

## Experimental Slop

Keep the UI-relative formula and existing clamps:

```text
Slop = clamp(referenceUnit × uiScale × slopRatio × pointerCoefficient, Min, Max)
pointerCoefficient = touchSlopMultiplier for touch; 1 for every other pointer type
```

The new runtime-editable EXPERIMENTAL coefficient defaults to **1.25**. Existing
saved settings are retained; an older config receives only this missing field.
With referenceUnit 48, uiScale 1, Ratio 0.16, Min 4 and Max 18:

| Input | Before | After |
|---|---:|---:|
| Touch | 7.68 px | 9.60 px (+25%) |
| Mouse / pen / other | 7.68 px | 7.68 px |

Custom settings may already reach Min/Max. Those constraints remain authoritative,
so a clamped profile does not necessarily grow by exactly 25%. This is a tuning
experiment, not a native/platform standard. Debug must show the actual observed
pointer type and both baseline and touch thresholds.

## Verification and physical Safari

Chromium mouse/touch tests, synthetic PointerCancel/sub-Slop input and forced
sticky-hover regression are distinct from actual iOS Safari observations.
Repeat testing on physical iPhone remains **AWAITING CONFIRMATION**. See the Task 02
section in IPHONE_CHECKLIST.md.

## Causes and fixes

- ReleaseButton inherited the shared irreversible Slop cancellation. Explicit
  releasePolicy=geometry now bypasses arbitration only for the two existing Release
  actions. Press state updates synchronously on movement. Hit tests remove the
  button's press translation and use client coordinates under Pointer Capture.
- Cards inherited unconditional button:hover, which can remain latched in Safari.
  Forced-hover automation reproduced the incorrect border on unselected Option 3.
  Cards now use independent data-pressed/data-dragging/data-hovered attributes; native
  :hover does not style them. Up, Cancel and interruption cleanup preserve aria-pressed.
- Touch tuning is a new coefficient in the existing formula. All 41 pre-existing
  defaults and all six handoff files are unchanged. Config migration preserves
  existing saved values. Gesture ownership, diagonal tie rule, clamps and Hold/Repeat
  behavior retain their contracts.

## Performed checks

| Check | PASS | FAIL | Result |
|---|---:|---:|---|
| TypeScript | — | — | npm run check successful |
| Model tests | 20 | 0 | npm test; includes coefficient, clamps and config migration |
| Chromium | 58 | 0 | npm run test:e2e; 37 existing + 21 Task 02 regressions |
| Production build | — | — | npm run build successful |
| Static /lab/ smoke | 9 | 0 | npm run test:static successful |

Final full run: **87 PASS / 0 FAIL / 0 SKIPPED**, no retries. Counts refer to the
final suites, not the sum of repeated attempts. Machine evidence is in
`docs/testing/browser-results.json` and `docs/testing/static-results.json`.

Three selected new regressions were run before implementation and all three failed:
large exit/return, forced sticky hover, and the old touch threshold. After fixes,
all 21 new browser regressions passed, followed by the complete 58-scenario suite.
The capture-loss fixture establishes capture and supplies the next pointer input
needed to deliver native lostpointercapture. Numerical model comparison at UI scale
1.5 uses a 1e-12 tolerance around the expected 14.4 px for IEEE-754 multiplication;
the expected value and 25% increase are unchanged.

Two old irreversible-cancellation scenarios are retained for Basic and carousel
cards, where that contract still applies. They are not used to contradict the
owner's new ReleaseButton policy. The new ReleaseButton suite covers all ten
requested cases, fixed functional bounds, capture loss, the nested Release action,
and browser-delivered Chromium touch Up/Cancel. Existing horizontal/vertical,
45-degree and reversal/ownership-lock tests remain in the full suite.

Synthetic sub-Slop/cancel events and a CDP-forced :hover state are explicitly labeled.
Browser-delivered Chromium touch is not a physical iPhone test. WebKit/iOS Safari
repeat validation remains **AWAITING CONFIRMATION**.

## Changed files

- `src/interaction.ts`: scoped geometry release, source-card state cleanup and mouse hover.
- `src/config.ts`: editable touch coefficient; preserved formula and clamps.
- `src/main.ts`: declare Release actions, update instructions/Debug/exported thresholds.
- `src/style.css`: independent card visuals, native tap-highlight suppression, Release touch-action.
- `src/diagnostics.ts`: assertion descriptions reflect the approved policy exception.
- `tests/browser/bugfix-02.spec.ts`: 21 new browser regressions.
- `tests/browser/lab.spec.ts`: retain old cancellation checks on components with that policy.
- `tests/core.test.ts`: three additional coefficient/clamp/migration checks.
- `AGENTS.md`, `README.md`, `docs/IMPLEMENTATION.md`, `docs/IPHONE_CHECKLIST.md`,
  `REPORT.md`, this report and the two machine JSON reports: current contracts and evidence.

The existing GitHub Pages workflow and window geometry implementation are unchanged.
No new Buttons/Hold/Repeat components, runtime dependencies or external services.

## Delivery

The owner-authorized commit/push updates the existing main/Pages workflow. Deployment
must be verified against the resulting commit SHA in GitHub Actions and Pages status;
local build success alone is not an updated-site claim. That post-push outcome is
reported separately in the delivery response to avoid committing a prediction.
Physical Safari checks are listed above and in IPHONE_CHECKLIST.md.
