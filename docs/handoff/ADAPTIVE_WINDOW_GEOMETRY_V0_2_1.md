# Adaptive Window Geometry v0.2.1

**Project:** Dark Kingdom War  
**Status:** Working architecture — extended with Carousel & Pointer Interaction contracts  
**Date:** 2026-10-07

## Status legend
- 🔒 Accepted rule
- 🟡 Working parameter / hypothesis
- 🔵 Open question
- 🔮 Future

## 1. Scope
Shared adaptive-window geometry for the whole UI system. Banner Composer is the first testbed, not the owner of these rules.

Core model: `Screen → Safe Area → Window → Functional Bounds`.

🔒 Decoration never determines functional geometry. Functional geometry drives layout; decoration adapts.

## 2. Mobile viewport references
- 🟡 Compact Native: `360 × 780` logical units
- 🟡 Normal Mobile: `390 × 844`
- 🟡 Large Mobile: `430 × 932`
- Validation point: `375 × 812` (iPhone mini class)
- iPhone SE 2/3 (`375 × 667`) is planned as limited / no native app at launch.

🔒 Fold/Duo devices are classified by available viewport, not model name: narrow/folded → Mobile; sufficiently wide/unfolded → Medium/Expanded.

🔒 Full native game targets supported phone/tablet/desktop surfaces, not car/watch/cover/exotic displays.

## 3. Workspace composition
Mobile:
`SafeTop → Header → Preview → Modules → Actions → SafeBottom`

Wide:
`Header → (Preview | Modules) → Actions`

🔒 Responsive means recomposition of the same functional components, not scaling one fixed layout.
🔒 Layout depends on available width + height + safe insets + posture/hinge, not device name.

## 4. Adaptive vertical growth
### Stage 1 — Minimum
Preview=Pmin; Modules=Mmin; Header/Actions keep safe interactive geometry.

### Stage 2 — Primary growth
Modules receives most extra height. Preview advances through preferred layout thresholds.

### Stage 3 — Critical Ratio 1
Modules grows only while Preview:Modules remains visually reasonable.
🔒 Content volume must not force absurd ratios such as 10/90; overflow becomes scroll.
🟡 CR1 exact value TBD.

### Stage 4 — Preview breathing
After CR1, extra height goes to Preview until useful height, width-constrained limit, or Pmax is reached.

### Stage 5 — Critical Ratio 2
Preview stops growing; Modules may gain more height until CR2. This supports unusual narrow/tall Split View states.
🟡 CR2 exact value TBD.

### Stage 6 — Window Max
🔒 Workspace stops growing even when more viewport height exists.
Modules remains scrollable even with 20–30 carousels.
Extra viewport becomes external breathing room; the whole window moves toward vertical centering.

Concept: `windowY ≈ (availableHeight - windowHeight) / 2`, corrected for safe area / optical centering.

🔒 **Available space is a ceiling, not a target.**

## 5. Modules and content height
Carousel count affects `ModulesContentHeight`, not fundamental window geometry.

- 1 carousel: no pointless stretching.
- Content fits: no scroll.
- Large content set: Modules viewport stops at its permitted size; content scrolls.

🟡 Keep deliberate breathing room; avoid nervous pixel-perfect `fit-content` height changes.

## 6. Preview Frame vs Preview Content
Preview Frame = layout area.
Preview Content = banner/building/character/etc. rendered inside it.

🔒 Preview Content always preserves intrinsic aspect ratio; never independently stretch X/Y.

Concept:
```text
scaleByHeight = availablePreviewHeight / naturalContentHeight
scaleByWidth  = availablePreviewWidth  / naturalContentWidth
contentScale = min(scaleByHeight, scaleByWidth, MAX_PREVIEW_SCALE)
```

🔒 Content stays inside Window Functional Bounds and cannot protrude beyond the game/window/display.

When width blocks further content growth, extra Preview height becomes intentional top/bottom breathing room. That breathing room is bounded; after it stops being useful, extra space goes elsewhere.

Concept: `PreviewUsefulHeight = min(heightTarget, widthConstrainedUsefulHeight, Pmax)`.

## 7. Layout thresholds
Pure fixed sizing and pure percentage sizing are rejected as sole models.

🟡 Preferred direction: hybrid adaptive sizing — min/max safeguards + proportional intent + staged layout thresholds + CR1/CR2.

Thresholds may be discrete states, but visible resize need not jump; interpolation can be used where appropriate.

🔒 Threshold logic considers both width and height. A `360×2000` viewport is still narrow/mobile; a wider shorter viewport may qualify as Expanded.

## 8. Runtime Resize Controller
🔒 Window sizing is event-driven, never timer-polled.

Observe viewport width/height, safe insets, orientation, posture/hinge and relevant window state.
Frequent resize events are coalesced to the render loop: latest geometry wins.

```text
resize event
→ store latest viewport
→ next render frame
→ calculate layout/geometry
→ apply
```

🔒 Resize changes presentation/layout, never editor state. Preserve selections, draft values and relevant scroll position where possible.

### Hysteresis
Structural breakpoints use different enter/exit boundaries to prevent flapping around a threshold.
🟡 Exact breakpoints and hysteresis margins TBD.

### Resize settled
After events stop for a short debounce interval, perform a final settled pass.
🟡 Prototype candidate: roughly 100–200 ms; not frozen.

## 9. Live Resize Mode
🔒 Interactive resizing uses a dedicated Live Resize Mode.

During Live Resize:
- UI geometry stays realtime and responsive.
- Expensive game world behind Workspace may use a frozen/low-cost snapshot.
- Heavy optional world effects may be reduced/paused where safe.
- Expensive Preview/decor effects may temporarily use cheaper presentation.
- Editor state remains intact.

Dynamic Gaussian blur is not assumed cheap. Preferred concept: frozen/reduced-resolution world snapshot plus inexpensive dim/softening treatment if useful.

After resize settles:
1. validate final geometry/layout;
2. resume full scene rendering;
3. softly transition from reduced/frozen presentation to live world.

🔒 **Live Resize is a cheap presentation mode, not a reduced responsive-layout mode.**

## 10. Protection rules
🔒 Never shrink interactive targets below safe minimums to preserve Preview/decor.
🔒 Under pressure, reduce ornament and Preview allocation / change composition before sacrificing usability.
🔒 Decoration may extend visually where allowed; critical/interactable content may not leave Functional Bounds.
🔒 Editor/draft state is independent from presentation changes.
🔒 Modules may scroll; Workspace need not grow until every module is visible.

## 11. Parameters still experimental
🟡 Header height by layout class  
🟡 Actions height by layout class  
🟡 Preview min/preferred/max useful sizes  
🟡 Preview thresholds/interpolation  
🟡 CR1 and CR2  
🟡 WindowMax  
🟡 Mobile/Medium/Expanded/Wide breakpoints  
🟡 Hysteresis margins  
🟡 Resize-settle debounce  
🟡 Decoration Budget  
🟡 Per-Workspace ratio profiles

## 12. Future / non-production
🔮 Possible diegetic resize easter egg: «Границы королевства меняются подозрительно часто…»

This is not production UX and must not be implemented accidentally. 😅

## 13. Summary
```text
VIEWPORT
  ↓
SAFE AREA
  ↓
LAYOUT CONTROLLER
  ├─ width + height
  ├─ posture / hinge
  ├─ thresholds + hysteresis
  └─ live resize state
  ↓
WORKSPACE
  ├─ Header   protected
  ├─ Preview  adaptive + width constrained
  ├─ Modules  adaptive viewport + scroll
  └─ Actions  protected
  ↓
WindowMax reached
  ↓
stop internal growth
  ↓
center Workspace; excess viewport becomes external breathing room
```

> **Use additional space while it improves the task. Stop consuming it when it no longer improves the task.**

---

# v0.2.1 — Carousel & Pointer Interaction Extension

This extension adds shared interaction contracts discovered while designing Banner Composer carousels. The rules are UI-system level and are not tied to any particular game economy or feature.

## 14. Carousel component

A Carousel is a horizontal selection component hosted inside the vertically scrollable `Modules` region.

🔒 Desktop: mouse drag/click. Mobile: swipe/tap.

🔒 Classic scrollbar is not the primary carousel navigation mechanism.

🔒 When horizontal overflow exists, a partial neighboring card may remain visible as an affordance that more content exists.

🔒 When there is no overflow, the carousel must not allow meaningless horizontal dragging.

🔒 End-of-list behavior may use controlled elastic overscroll: a small resistant pull followed by spring-back.

🔒 Each selection carousel may begin with a real selectable `None` card where the module semantics allow clearing the selection. `None` uses the same card framework; its X/diagonal mark and label are UI-rendered rather than baked into an asset.

🔒 Selection Thumbnail, Selection Preview and Composer Preview are separate presentation roles. A thumbnail may be cropped/optimized for recognition without redefining the underlying asset.

🔒 Hover may enhance desktop interaction, but no required action may depend exclusively on hover.

🟡 Arrow controls may supplement drag/swipe on layouts where useful. Edge arrows disappear/disable appropriately when no movement in that direction is possible.

## 15. Nested scrolling and gesture arbitration

`Modules` scrolls vertically; each Carousel scrolls horizontally. Touch arbitration is determined from the touch origin and initial movement intent.

### Gesture slop

After `PointerDown`, small movement is ignored while the interaction remains a tap candidate.

🟡 Exact `GESTURE_SLOP` is platform/engine dependent and must be tuned experimentally.

### Touch starts inside Carousel Cards Area

After movement exceeds Gesture Slop:

```text
if abs(dx) >= abs(dy):
    owner = CAROUSEL
else:
    owner = MODULES
```

Thus the exact 45° case (`|ΔX| == |ΔY|`) belongs to Carousel.

Once Carousel owns the gesture:
- only X displacement affects movement;
- Y displacement is ignored;
- reversal of X direction immediately reverses carousel movement.

Once Modules owns the gesture:
- only Y displacement affects movement;
- X displacement is ignored.

🔒 Gesture ownership is decided once after intent recognition and does not transfer to another scroll container until the current pointer gesture ends.

A loop, arc, diagonal correction or later direction change therefore does not cause ownership to jump between Carousel and Modules.

### Touch starts in Modules outside Carousel Cards Area

🔒 The gesture belongs to Modules. Vertical displacement controls Modules; horizontal displacement is ignored.

Interactive controls such as arrows/buttons are separate hit targets and follow the button contracts below rather than being treated as inert Modules background.

## 16. Release-to-activate button contract

🔒 Ordinary buttons do not perform their action on `PointerDown`.

`PointerDown` creates a Press/Tap candidate and changes the visual state to Pressed.

Activation occurs only when the corresponding `PointerUp` completes a still-valid interaction.

Normal behavior:

```text
Down inside
→ Pressed
→ Up inside
→ Activate
```

Cancellation:

```text
Down inside
→ move outside
→ visual unpress
→ Up outside
→ no action
```

🔒 Before the interaction becomes a drag/scroll, the user may move outside the button and then return inside without lifting the pointer. The button becomes Pressed again; `PointerUp` inside may activate it.

🔒 Once Gesture Controller classifies the interaction as a drag/scroll, the tap candidate is permanently cancelled until the next `PointerDown`, even if the pointer later returns to the original element.

This prevents an accidental card/button activation after scrolling.

## 17. Hold-Session Button

Some future actions may use a deliberate press-and-hold interaction. This is a reusable input contract and is not tied to a specific gameplay feature.

### Before Hold recognition

The interaction behaves like a cancellable press candidate:
- Down inside → Pressed candidate.
- Move outside before Hold recognition → visual unpress / candidate may be cancelled.
- Return inside before Hold recognition → Pressed candidate may become valid again.

🟡 Exact Hold recognition delay is TBD.

### After Hold recognition

🔒 Recognized Hold creates a `HOLD_SESSION`.

🔒 After Hold Session begins, pointer coordinates no longer determine session validity. The user may move the pointer anywhere on the screen while continuing to hold.

🔒 The source button remains visually Pressed for the duration of the Hold Session, regardless of pointer position.

🔒 `PointerUp` ends the Hold Session regardless of where the pointer is released.

🔒 `PointerCancel` is an emergency/system termination path (backgrounding, OS interruption, lost pointer capture, etc.).

### Repeated actions

A Hold Session may generate repeated action ticks while its associated game/application state permits them.

🔒 Temporary unavailability does not inherently terminate Hold Session.

If availability returns while the pointer remains held, the session may resume producing action ticks automatically where the feature contract permits.

Already executed action ticks are never retroactively cancelled merely because pointer position changed.

## 18. Interaction State vs Availability State

🔒 Pointer interaction state and gameplay/application availability are independent state dimensions.

Conceptually:

```text
INTERACTION
IDLE
PRESSED
HOLDING

AVAILABILITY
READY
WAITING
EMPTY
FULL
LOCKED
...
```

Valid combinations may therefore include:

```text
HOLDING + READY
HOLDING + WAITING
HOLDING + EMPTY
HOLDING + FULL
```

A control may remain geometrically/visually Pressed while its action styling becomes unavailable/grey because the Hold Session still exists but no action can currently execute.

This separation prevents `Disabled` from incorrectly destroying an active pointer session.

## 19. Pointer Interaction Controller

The shared interaction pipeline is conceptually:

```text
PointerDown
    ↓
Hit Test
    ↓
Interaction Candidate
    ├─ Release Button
    ├─ Hold Session
    ├─ Card Tap
    ├─ Carousel Drag
    └─ Modules Scroll
    ↓
Gesture Arbitration
    ↓
Activate / Hold / Drag / Scroll / Cancel
```

🔒 No irreversible ordinary action is performed on `PointerDown`. `PointerDown` expresses intent; activation requires the relevant interaction contract.

Explicit interaction types such as Hold Session are declared behavior, not ad-hoc exceptions attached to individual buttons.

## 20. Open interaction parameters

🟡 Gesture Slop distance / platform mapping  
🟡 Hold recognition delay  
🟡 Hold repeat cadence and optional acceleration profiles  
🟡 Carousel inertia / velocity curve  
🟡 Carousel elastic overscroll distance and spring curve  
🟡 Arrow behavior during drag beginning directly on an arrow control  
🟡 Haptic/audio feedback policy for Pressed, Hold recognition and repeat ticks

