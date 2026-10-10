# Physical iPhone validation — awaiting confirmation

Perform only after deploying the static build to an HTTPS URL with permission.
Record iPhone model, iOS/Safari version, portrait/landscape, actual viewport and
configuration JSON. Export diagnostics after each repeatable sequence. Do not mark
PASS from the desktop Chromium report.

| ID | Scenario | Expected |
|---|---|---|
| IOS-01 | Portrait at real width, Safari bars expanded/collapsed | No horizontal page overflow; targets remain reachable; actual viewport wins |
| IOS-02 | Landscape, notch / home indicator, rotating repeatedly | Safe-area padding, no clipped actions; draft, selection, page survive |
| IOS-03 | ReleaseButton: motion inside, repeated exit/return even beyond Slop | Pressed inside, released outside; Down zero actions, Up inside one, Up outside zero |
| IOS-04 | Card drag then return; other buttons beyond Slop | No resurrected card/ordinary tap; ReleaseButton follows the approved geometry exception |
| IOS-05 | Horizontal/vertical/45° gesture from card | Correct owner; exact tie Carousel; lock through loop/reversal |
| IOS-06 | Background Modules gesture; no-overflow carousel | Horizontal ignored outside cards; no meaningless carousel movement |
| IOS-07 | Fast carousel swipe and end pull | Experimental inertia/elasticity controllable, stable spring-back |
| IOS-08 | Hold beyond recognition, move outside, Up outside | Pressed Hold continues; Up ends; no extra release action |
| IOS-09 | Scheduled availability pause/resume while held | HOLDING + WAITING, ticks pause, resume without queued burst |
| IOS-10 | App switch, screen lock, interruption, lost pointer | Cancel/visibility termination; no stuck hold or action afterwards |
| IOS-11 | Two-finger interruption / pinch attempts in and around test zone | Secondary pointer never steals session; surrounding page remains usable |
| IOS-12 | Back/Next boundaries, all five dots, Light/Dark, Close/Reopen | Correct page, blue/red active dot, only mini-window closes |
| IOS-13 | Numeric mock resize, square geometry and band transitions | Current H/V retained in band; real bounds respected |
| IOS-14 | Blur/dim live/settled, low-cost mode on/off | Geometry remains live; final effects restored; inspect actual frame performance |
| IOS-15 | Input keyboard and focus; Safari viewport changes | Controls reachable; state preserved; actual visible viewport observable |
| IOS-16 | localStorage, Reset, clipboard, export JSON download | Settings retained or explicit limitation; valid JSON; iOS Files/Share workflow usable |
| IOS-17 | VoiceOver / external keyboard where available | Focus visible, button names and active-page semantics understandable |

Use the 375×812 validation point where a device / available viewport matches it;
360×780, 390×844 and 430×932 are reference presets, not detected device models.
The specification treats SE 375×667 as limited native launch scope, but the web
bench still needs usability observation there. Pen and foldable scenarios require
appropriate hardware beyond iPhone.

## Bugfix Task 02 — repeat on physical Safari

All items below are **AWAITING CONFIRMATION** for the new version. The owner's
earlier defect observations do not count as verification of these fixes.

1. ReleaseButton: hold without lifting, move inside farther than Slop. It remains
   PRESSED, stays in place and performs no action until Up; Up inside performs one.
2. Move Outside → Inside → Outside → Inside, including a large excursion. Visually
   observe RELEASED/PRESSED on every transition. Up inside performs one; repeat
   with Up outside and expect zero. Check near the top/bottom edges during press feedback.
3. Interrupt an active candidate (app switch, OS interruption, lock) and observe
   the actual Cancel/visibility/capture termination path. No stuck press or later action.
4. With None selected, drag horizontally from Option 3 and scroll back to it. None
   stays selected; Option 3 has no lingering press/drag/touch-hover highlight. Repeat
   with other cards and with a real Option selected: scrolling must preserve that selection.
5. Check vertical scrolling, diagonal arbitration and direction reversals/loops.
   The first recognized owner stays locked; drag never accidentally selects a card.
   Use reported dx/dy as evidence; the exact 45-degree tie is also covered automatically.
6. Debug: verify actual touch pointerType, EXPERIMENTAL touch multiplier 1.25 and
   the 7.68 → 9.60 px default example. Existing custom settings must remain intact;
   Min/Max still clamp them. Edit/export/reload the multiplier and record the config.

Record model, iOS/Safari version, URL/build, config and observations. Do not mark
these checks PASS from Chromium's touch or forced-hover automation.
