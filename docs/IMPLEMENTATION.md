# Implementation notes and provisional choices

## Structure

| File | Responsibility |
|---|---|
| src/config.ts | Editable, sanitized experimental parameter schema and localStorage |
| src/geometry.ts | Pure staged allocation, class and H/V hysteresis |
| src/interaction.ts | Pointer capture, arbitration, release, hold, repeat, inertia |
| src/diagnostics.ts | Performed assertions, bounded event history, JSON download |
| src/main.ts | Five persistent test panels, navigation, resize observers, rendering |
| src/style.css | Neutral skin, safe-area padding, protected touch targets |
| tests/core.test.ts | Geometry, Slop and repeat invariants |
| tests/browser/lab.spec.ts | Playwright input / cancellation / layout scenarios |
| scripts/verify-static.mjs | Local-only production artifact verification |

No external fonts, images, runtime SDKs, analytics or network actions. No backend.
The SVG reference specimen is a neutral UI drawing with intrinsic 280×180 bounds.
Card thumbnail, selection state and preview are distinct roles; the laboratory
does not invent Banner Composer production art.

## Input controller

One primary pointer is accepted per session. Touch zones declare `touch-action:
none` so custom arbitration can keep ownership after recognition; the surrounding
page remains scrollable. Wheel deltas are routed by dominant axis to Carousel or
Modules; line/page delta modes are converted to local distances.

Slop = clamp(referenceUnit × uiScale × Ratio, Min, Max). The web exposes no reliable
native Slop threshold; the displayed source explicitly says UI-relative fallback.
Euclidean distance must **exceed** Slop; equality remains a tap candidate.
Exact axis tie after crossing selects Carousel. Axis ownership never transfers.
No-overflow carousel has neither scroll nor elastic displacement. Overflow permits
bounded elastic pull and spring return. Inertia retention is normalized to frame
time; browser rendering/timer cadence is not a hardware performance guarantee.

Buttons use PointerDown as a candidate, PointerUp as activation. Before hold,
leaving disarms recognition; returning inside below Slop restarts the HoldDelay.
Standalone drag cancellation uses the same Slop rule as other controls. This is a
reversible provisional interpretation. Buttons/arrows within Modules arbitrate to
Modules after Slop; arrows are distinct hit targets and never become card areas.

Hold recognizes after HoldDelay and performs one initial tick, then schedules
single ticks with interval max(initialMs / (1 + acceleration × seconds), 1000 /
maxRate). Timers round **up**, so rounding cannot exceed the rate ceiling. There
is no catch-up queue. Availability can change independently of interaction; even
plus/minus reaching a bound does not destroy an existing Hold Session. Ordinary
release never adds an action to a recognized hold. Keyboard activation is one
action, not a fabricated hardware hold.

## Geometry and resize

CSS safe-area insets wrap the page. Actual host width/height (not a device label)
drive the window. Staged model: minimum -> Modules primary growth with Preview
advance -> CR1 -> bounded Preview breathing -> CR2 -> WindowMax. Width-constrained
content scaling preserves aspect ratio. Extra space stays outside the window and
centers it. A single carousel has bounded content allocation; 30 carousels overflow
inside Modules. UI scale protects target space, including actions chrome and row
controls. Under pressure, Preview reduces before interactive Modules.

Mobile/Medium stack; Expanded/Wide recompose the same nodes side by side when
height permits. Width classes have enter/exit hysteresis. Mock H/V uses geometry
ratio, preserves previous mode in the band, then uses exposed screen orientation
as initial tie-breaker, then V deterministically. No device-name detection.

ResizeObserver, window resize, visualViewport resize/scroll, orientation and
available posture change events schedule one requestAnimationFrame update: latest
geometry wins. No geometry polling. The mock drag uses pointerup / cancel completion;
viewport / numeric edits use an explicitly experimental debounce. While the drag
handle remains held, the lifecycle stays LIVE even if motion pauses.

The backdrop world is a static neutral grid. Low-cost live presentation disables
blur, removes the grid pattern and drops costly shadows; it is not claimed to be
a real engine snapshot or a measured optimization of a live game scene. Geometry
remains responsive. Settling restores effects; the diagnostic reads computed blur
and dim after the backdrop's actual CSS transitions finish, using Animation.finished
instead of an assumed wall-clock delay. Stale checks are discarded when a newer
settled pass starts. The expensive-behind-window engine is future scope.

Selection, draft, step, page and relevant scroll remain separate from layout.
Scroll can clamp if the new content range is shorter; this is reported. Parameters
persist; editor state and session diagnostics are intentionally session-scoped.

## Diagnostics

Each assertion has ID, expected / observed, time, status and evidence source.
Runtime observations are useful witnesses, not a replacement for regression tests
or manual device QA. Automated Playwright runs have their own report. Browser
delivered pointer events and synthetic events are identified in the Down log;
synthetic PointerCancel is labeled. An actual Chromium touch Pointer Event is not
proof of an iPhone test. INCONCLUSIVE needs an explicit limitation reason and cannot
overwrite an already observed PASS/FAIL. Experimental calibration is separate.

## Open calibration and limits

Every number in config.ts is a provisional profile. Slop mapping, HoldDelay,
cadence/acceleration/max rate, inertia/overscroll/spring, press visuals, header / action
allocation, Preview sizes/breathing/content scale, Modules minimum, CR1/CR2,
WindowMax, breakpoints, hysteresis, settle debounce, decoration and blur/dim all
need measured tuning. Sanitization normalizes invalid values and dependent bounds.

- Only Chromium was available. Safari/WebKit, physical touch/pen/trackpad and
  real-device interruption/performance are not certified by these tests.
- Posture/segments are reported when an API exists. No real hinge or foldable was
  available; multi-segment layout behavior needs device validation.
- Browser safe-area / address-bar / keyboard behavior must be checked on iPhone.
- Haptics/audio policy is open; this bench deliberately emits neither.
- Optional page swipe is not enabled or implemented; required buttons and dots work.
- Trackpad testing uses Chromium wheel input, not a physical trackpad.
- No HTTP(S) deployment exists. Formal v1 acceptance remains pending public HTTPS
  and real-device tests, despite the ready-to-deploy static build.
