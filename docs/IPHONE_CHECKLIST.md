# Physical iPhone validation — NOT RUN

Perform only after deploying the static build to an HTTPS URL with permission.
Record iPhone model, iOS/Safari version, portrait/landscape, actual viewport and
configuration JSON. Export diagnostics after each repeatable sequence. Do not mark
PASS from the desktop Chromium report.

| ID | Scenario | Expected |
|---|---|---|
| IOS-01 | Portrait at real width, Safari bars expanded/collapsed | No horizontal page overflow; targets remain reachable; actual viewport wins |
| IOS-02 | Landscape, notch / home indicator, rotating repeatedly | Safe-area padding, no clipped actions; draft, selection, page survive |
| IOS-03 | Tiny motion, tap, leave/return at edge below Slop | Down only press; valid Up one action; unpress/repress observable |
| IOS-04 | Drag then return; Up outside | No resurrected tap / accidental selection |
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
