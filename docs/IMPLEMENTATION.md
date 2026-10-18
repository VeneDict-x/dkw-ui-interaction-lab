# Implementation notes and provisional choices

## Structure

| File | Responsibility |
|---|---|
| src/config.ts | Editable, sanitized experimental parameter schema and localStorage |
| src/geometry.ts | Pure staged allocation, class and H/V hysteresis |
| src/interaction.ts | Pointer capture, arbitration, release, hold, repeat, inertia |
| src/diagnostics.ts | Performed assertions, bounded event history, JSON download |
| src/main.ts | Six persistent test panels, navigation, resize observers, rendering |
| src/style.css | Neutral skin, safe-area padding, protected touch targets |
| tests/core.test.ts | Geometry, Slop and repeat invariants |
| tests/browser/lab.spec.ts | Playwright input / cancellation / layout scenarios |
| scripts/verify-static.mjs | Local-only production artifact verification |

No external fonts, images, runtime SDKs, analytics or network actions. No backend.
The SVG reference specimen is a neutral UI drawing with intrinsic 280×180 bounds.
Card thumbnail, selection state and preview are distinct roles; the laboratory
does not invent Banner Composer production art.

## Input controller

One source is active per controller. Carousel touch sessions additionally track
active touches on that carousel; ownership transfers to a remaining touch without
reclassification or displacement jump. Last release/cancellation ends the gesture. Touch zones declare `touch-action:
none` so custom arbitration can keep ownership after recognition; the surrounding
page remains scrollable. Wheel deltas are routed by dominant axis to Carousel or
Modules; line/page delta modes are converted to local distances.

Slop = clamp(referenceUnit × uiScale × Ratio × pointerCoefficient, Min, Max).
pointerCoefficient is the editable EXPERIMENTAL touchSlopMultiplier (initial 1.25)
for actual pointerType=touch, and 1 for mouse/pen/other. Older saved configs receive
only the missing coefficient, preserving all existing tuning. Baseline 7.68 px becomes
9.60 px for touch; mouse/pen stay 7.68 px. Min/Max still cap custom profiles.
The web exposes no reliable
native Slop threshold; the displayed source explicitly says UI-relative fallback.
Euclidean distance must **exceed** Slop; equality remains a tap candidate.
Exact axis tie after crossing selects Carousel. Axis ownership never transfers.
No-overflow carousel has neither scroll nor elastic displacement. Overflow permits
logarithmic elastic pull without a finite clamp and spring return. Inertia retention is normalized to frame
time; browser rendering/timer cadence is not a hardware performance guarantee.

Declared ReleaseButtons (`release`, `lab-release`) use releasePolicy=geometry.
Pointer capture changes the event target, not hit testing: each movement/Up reads
client coordinates and functional bounds, subtracting the press translation from
the rendered rectangle. Inside/outside press visuals remain reversible regardless
of Slop. Up inside activates once; Up outside/cancel never activates. Capture loss,
blur, hiding or test-window navigation ends the candidate. The target never follows
pointer position. See the owner's approved override in BUGFIX_TASK_02.md.

Ordinary non-Hold controls use Strict Tap: arbitrary movement inside is valid;
first exit irrevocably cancels, including sub-Slop exit/reentry. ReleaseButtons
keep their Task 02 exception. Hold candidates retain Slop recognition semantics.
All utility buttons now share Pointer Events and keyboard activation.
Other buttons use PointerDown as a candidate, PointerUp as activation. Before hold,
leaving disarms recognition; returning inside below Slop restarts the HoldDelay.
Ordinary standalone arrows are Strict Tap and never repeat. Ordinary buttons/arrows within Modules retain Strict Tap and never become card
areas; Hold candidates can cancel after Slop. Modules background retains Y ownership.

Card SELECTED remains aria-pressed/model selection. Source-card data-pressed and
data-dragging are separate, synchronous temporary states cleared on Up/Cancel/lost
capture/blur/navigation. The source card is recorded at Down, not re-inferred from
the old screen coordinate after content moves. Native :hover does not style cards:
fine-pointer mouse movement owns data-hovered, cleared on gesture start/end/out.
Keyboard focus-visible remains independent; iOS native tap highlight is suppressed
only on cards. Forced sticky :hover is tested in Chromium, not claimed as iOS QA.

Hold recognizes after HoldDelay and performs one initial tick, then schedules
single ticks with interval max(initialMs / (1 + acceleration × seconds), 1000 /
maxRate). Timers round **up**, so rounding cannot exceed the rate ceiling. There
is no catch-up queue. Generic Repeat and Tap/Hold/Repeat share integer-tenths
initial-delay multiplier 10–25. Recognition and its initial action remain at
HoldDelay; first subsequent repeat waits repeatMs × multiplier. Further intervals
and Bounded Steps retain the original repeatInterval formula. Availability can change independently of interaction; even
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
persist; the original editor state and session diagnostics are session-scoped. Module 06
additionally stores Applied and unfinished Draft in IndexedDB; its Current is
volatile and only persisted values survive restart.

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
- Module 04 now supports live page swipe; see Task 04 for its local axis arbitration.
- Trackpad testing uses Chromium wheel input, not a physical trackpad.
- The repository's owner configured an existing GitHub Pages workflow. Deployment
  status must be checked per commit; it does not certify physical Safari behavior.

## Task 03 additions

See BUGFIX_TASK_03.md for lifecycle terminal paths, content-driven compact
geometry, card sizing, logarithmic resistance, IndexedDB transactions,
session/version guards, crash controls, and exact performed checks.
New source boundaries: carousel.ts (shared geometry/binding), draft.ts
(repository + editor lifecycle), draft-ui.ts (sixth panel, native modal, SVG).
Physical Safari acceptance remains PENDING.

## Task 04 additions

See [BUGFIX_TASK_04.md](BUGFIX_TASK_04.md) for the approved Event Guide contracts,
persistence design, strip root cause, performed tests and experimental values.
`module-strip.ts` preserves native touch scrolling from module button surfaces;
local Pointer Events handle tap and mouse drag without altering the shared controller.
`event-state.ts` owns an independent, occurrence-keyed IndexedDB and ordered commands.
Only transaction completion publishes progress. Epoch + lease guards run within the
readwrite transaction; Reset and logical Restart fence delayed writes at storage and UI.
The last acquired tab owns the event record; stale tabs get explicit write errors.

`event-guide.ts`, `event-articles.ts`, `guide-gesture.ts` and `event-guide.css` build
the nested world/event/guide simulation. Guide horizontal motion uses a local locked
axis, pan-y keeps native vertical touch scrolling, and each gesture moves at most
one page. No Module 01/02/03/05/06 input or geometry controller changes. Old free-nav
regressions earn completion via actual acknowledgments before reference-mode checks.
Guide completion/checkmarks and reference mode are separate durable states.
Real iPhone Safari/Chrome iOS verification remains PENDING.
