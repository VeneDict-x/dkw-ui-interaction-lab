# UI Interaction Lab — v1

## Nested Modules + Carousel
Modules scrolls vertically; carousels horizontally. Inside Carousel Cards Area, remain TAP_CANDIDATE until Gesture Slop is crossed. Then:
`abs(dx) >= abs(dy)` → CAROUSEL; otherwise → MODULES. Exact 45° belongs to Carousel. Owner locks until PointerUp/PointerCancel. Carousel uses X intent; Modules uses Y intent. Drag/scroll permanently cancels the current tap candidate. A touch starting in Modules outside Cards Area belongs to Modules.

## Gesture Visualizer
Live-display pointer type, pointer id, start/current point, dx/dy, abs values, distance, TAP_CANDIDATE/SLOP_CROSSED, owner and tap validity. Toggleable overlay should show start point, slop boundary, current point and path.

## Gesture Slop / Input Policy
Use an appropriate public native/platform threshold when the runtime reliably exposes one. Otherwise use experimental UI-relative fallback:
`fallbackSlop = clamp(InteractionReferenceUnit * Ratio, Min, Max)`.
Do not pretend the web exposes a native threshold when it does not. Ratio/Min/Max stay experimental runtime controls.

## Debug Panel™
Collapsible/mobile-usable. Show viewport, devicePixelRatio, pointer type, UI scale, reference unit, Ratio/Min/Max, effective slop + source, dx/dy, owner, visualizer toggle, experimental inertia/overscroll, HoldDelay/repeat cadence, bounded event log, reset, and copy/export config JSON. Persist experimental settings locally and provide reset.

## Release Button demo
PointerDown inside → Pressed candidate, no irreversible action. PointerUp inside while valid → activate. Moving outside before drag visually unpresses; returning inside may re-press. Release outside cancels. Once classified as drag/scroll, tap stays cancelled. Show state and activation count.

## Hold-Session Button demo
Before recognition: cancellable press. After HoldDelay: HOLD_SESSION. After recognition pointer coordinates no longer affect validity; button remains Pressed. PointerUp anywhere or PointerCancel ends session. Interaction State and Availability State are independent. Temporary unavailability may pause repeat ticks without ending hold; availability returning may resume ticks. Show hold duration, tick count and both state axes.

## Responsive helpers
Presets only, never device detection: 360×780, 375×812, 390×844, 430×932, 1366×768, 1920×1080. Actual viewport always wins.

Prefer Pointer Events. Avoid browser text-selection/drag artifacts in test controls while preserving reasonable keyboard/focus accessibility. No analytics/auth/backend/game assets in v1.
