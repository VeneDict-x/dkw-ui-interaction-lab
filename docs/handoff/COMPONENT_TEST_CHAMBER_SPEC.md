# Component Test Chamber — Lab Extension v0.2

Status: proposed engineering specification. Experimental values are NOT production defaults.

## Purpose and layout
Add a discoverable `Component Test Chamber` to the existing UI Interaction Lab. It is a modular Android-engineering-menu-style index of independently launchable test windows. Preserve the original Carousel/Modules and Gesture Visualizer experiments. Use a neutral debug skin; do not invent production game textures. Allow future modules (`TBC`) without changing core navigation.

## Shared test-window shell
Every test window has a title, instructions, test controls, live interaction state, event log, Reset, and optionally a copy/export JSON report. Test-window Back/Close must not close the entire Lab. All test cases should be repeatable with mouse, touch, and pen where available. Log pointer type, event sequence, viewport, current parameters, observed results, and timestamps. Avoid storing sensitive data.

## 1. Actions / Press mechanics
Provide standalone pressable buttons and configurable visual feedback: pressed translation/depth, color darkening, transition duration, and optional shadow response. Controls adjust parameters live; expose defaults as experimental. Scenarios:
- PointerDown inside -> visually pressed; no ordinary action yet.
- Move outside before drag classification -> visually released; return inside -> visually pressed again.
- PointerUp inside while valid -> one action.
- PointerUp outside -> no action.
- Gesture classified as drag/scroll -> tap cancelled permanently until next gesture.
- PointerCancel -> no activation and visual reset.
Show observed state, activation count and expected vs observed assertions. PASS/FAIL only for mechanically verifiable assertions; use NOT RUN/INCONCLUSIVE for untested or unsupported conditions. Visual taste parameters are EXPERIMENTAL, not PASS.

## 2. Button Gallery
Independent demos for:
- Basic action button;
- Plus and minus step buttons with editable min/max/current value;
- Generic repeat-action button (do not mention specific game features/economies);
- Carousel left/right arrow buttons, **without requiring a carousel**;
- Tap + Hold Session + Repeat button.
Hold contract: short tap -> one action on valid release; recognized hold -> repeat ticks, without an extra release click. After hold recognition, moving outside does not end the session; PointerUp anywhere or PointerCancel ends it. Interaction state is separate from availability. Availability becoming false pauses ticks without queuing a backlog; when available again, repeat may resume. Show repeat count and effective rate. Expose experimental HoldDelay, initial cadence, gradual bounded acceleration, max rate, and availability toggles. Never execute irreversible network operations from the demo.

## 3. Navigation / multi-screen mini-window
Create a miniature content window with five numbered placeholder pages, such as five parts of fictional event rules. Do not use game lore or claim content is official.
- Back-only example.
- Back + Forward example; boundary buttons disabled or hidden according to explicit test setting.
- Close button dismisses only mini-window; provide Reopen.
- Five clickable pagination dots below the mini-window, one per page. Active dot is faction-colored (Light: blue, Dark: red); inactive dots neutral. Clicking a dot navigates directly to its page. Keyboard access, focus and clear active-page semantics are required.
- Page count, selected page and event log visible.
- Optional touch swipe between pages must be explicitly enabled; when enabled, ensure it does not conflict with the outer Lab scroll.

## 4. Window Resize / backdrop effects
Build a resizable mock window (drag handles on desktop, numeric width/height inputs for touch), within a safe demo surface. Expose backdrop dim, blur strength, and optional low-cost snapshot mode. Show actual viewport vs mock-window dimensions, current H/V layout and resize lifecycle states. Use event-driven geometry; no polling. During live resize geometry updates continuously; expensive effects can be reduced. On settle, restore full effects and run final layout validation. Settle detection must use available native/platform completion events if exposed; otherwise an experimental debounce fallback. Do not claim that browser APIs always expose resize-end.

For orientation tests, treat window geometry as primary. Preserve current H/V mode inside the hysteresis band; when no previous mode exists, use reliable orientation as tie-breaker, then deterministic fallback. Thresholds (e.g. 9:10 and 10:9) are experimental. Do not force the OS/browser window to avoid square aspect ratios. Display migration and fold/unfold may update geometry without implying a separate UI mode.

## 5. Future modules
Reserve an `Experiments / TBC` section. Do not implement speculative modules merely to fill it.

## Diagnostics and QA
Provide a test case ID and a reproducible PASS/FAIL/NOT RUN/INCONCLUSIVE result for each assertion; PASS must be earned by a performed check, never default. Separate automated tests from manual observation; do not claim a manual device test happened unless it actually did. JSON export should include configuration, environment and results. Keep panel usable at 360 logical px width, with touch-sized targets and no hover-only features. Use the actual `pointerType` rather than a user-selected label as evidence; simulation mode may exist but must be labeled simulated.

## Codex implementation priority
1. Preserve existing lab behavior and tests.
2. Add Chamber index + shared test shell.
3. Implement Actions and Button Gallery.
4. Implement Navigation mini-window and dots.
5. Implement Resize/backdrop test.
6. Add regression tests, documentation and deployment build verification.

Ask the user only if blocked by an essential choice. Keep all experimental parameters editable and avoid treating visual mockups as frozen production art.
