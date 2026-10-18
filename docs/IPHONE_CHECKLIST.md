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
| IOS-04 | Card drag then return; ordinary buttons exit/reentry | No resurrected card/ordinary tap; ReleaseButton follows the approved geometry exception |
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


## Bugfix Task 03 — physical Safari acceptance PENDING

All items below require an actual iPhone; Chromium/CDP is not physical Safari.

1. Generic Repeat: long touch without native text selection/callout; move outside
   after recognition; release anywhere stops. Repeat before/after recognition,
   OS interruption, background, call/return; no orphan count or stuck HOLDING.
2. Toggle section 05 availability repeatedly; section 03 is unaffected and all
   controls recover without reload. Check pause at 2.0 s, resume at 4.0 s.
   Select experimental initial-delay multiplier 1.0–2.5; Bounded Steps unchanged.
3. Navigation Hidden first/last pages: stable slots, absent hit targets, Strict Tap
   exit/reentry cancels. ReleaseButton exit/reentry remains reversible.
4. Carousels: real partial Peek, exact final full card/insets, no trailing gap,
   arrows disappear entirely, drag never selects, diminishing unlimited pull,
   two-finger continuation/handoff and springback on last lift. Outer page scroll.
5. Window 240×220, portrait/landscape rotation, repeated numeric/handle resize:
   reachable Modules and checkbox, preview aspect, retained text/selection,
   requested/applied/clamping diagnostics, model presets do not resize browser.
   Reset 05 preserves all other modules and invalidates pending resize.
6. Draft: all geometric options and layers, Large=None unavailable Apply with
   working autosave; responsive Current, durable lower label, changing latency.
   Apply/Discard during save never resurrect Draft. Save for later waits for
   confirmed success; injected failure and Retry; out-of-order burst saves.
7. True reload, Safari restart after confirmed save, simulated crashes before/
   after save: only durable values recover; live return has no recovery prompt.
   Draft found → Continue / Not now / Delete with second confirmation; Applied
   remains distinct. Real iOS browser/process eviction cannot be forced by lab.
8. Modal focus, Escape/external keyboard, VoiceOver, overlay hit testing and mobile
   scrolling: no accidental discard. Diagnostic text/input remain selectable;
   exports work. IndexedDB persistence/error paths and explicit cleanup isolated.

Record device/iOS version, URL/commit and observation for each PASS/FAIL. Clearing
site data intentionally removes local Draft/Applied; private-mode/eviction policies
and browser quota require device confirmation.

## Bugfix 04 + Feature 04 — Safari / Chrome iOS: PENDING

Выполнить на физическом iPhone после разрешённого слияния PR и успешного HTTPS
deployment. Chromium/CDP, симулированный restart и программная visibility не
доказывают поведение Safari. Записать URL/commit, модель, iOS, браузер, настройки,
ожидаемое/наблюдаемое. Проверить Safari и Chrome iOS отдельно.

1. В portrait провести по верхней полосе **прямо с кнопки**, несколько раз в обе
   стороны. Достичь модулей 05/06. Scroll не выбирает модуль, обычный tap выбирает;
   выход/возврат без scroll не воскрешает отменённый tap. Повторить после поворота.
2. Reset Event State: Cancel оставляет прогресс, Confirm сбрасывает только 04.
   Первый Event открывает памятку поверх зимней сцены. Закрытие оставляет событие,
   ❓ открывает снова. Back в мир → Event не открывает памятку автоматически.
3. Прокрутить все пять длинных статей вверх/вниз, включая длинную Академию и вторую
   иллюстрацию. «Понятно» только в конце статьи, скроллится вместе с текстом. Нет
   выделения/долгого callout/залипшей подсветки/перехода страницы от вертикального жеста.
4. Плавно потянуть статью горизонтально: страница следует пальцу, сосед виден.
   Короткий жест возвращается, длинный меняет ровно одну страницу. Первый край
   сопротивляется и возвращается. Повторить с разворотом и вертикальным продолжением.
5. Попробовать закрытую страницу через swipe, dot и Next: выбор остаётся, небольшой
   упругий возврат; одна мягкая подсказка с утверждённым текстом, не блокирующая ввод.
   Быстрые повторы обновляют подсказку; нет стопки, звука, случайного «Понятно».
6. Отметить страницы 1/2: зелёные галочки, доступна 3, 4 закрыта. Закрыть на 3,
   открыть ❓: та же страница сверху, уже отмеченные страницы без «Понятно».
   Проверить dots/Back/Next/swipe при Hidden/Disabled и Back-only.
7. Завершить страницу 5: окно остаётся открытым, пять галочек. Закрыть → ❓:
   reference mode, все страницы свободны, нет галочек/замков/«Понятно». Проверить
   Light/Dark/Premium: синяя/красная/золотая dot, зелёная галочка сохраняет значение.
8. Проверить быстрые tap/double tap/swipe/close/reopen и resize/orientation во время
   drag. Нет двойного acknowledgment, скачка через две страницы и зависшего жеста.
9. После SAVED: Simulate App Restart, Reload Page (настоящая reload), закрытие
   браузера и повторное открытие. Module 04 восстанавливает экран, открытость,
   страницу и прочитанный prefix сверху; автооткрытие не повторяется.
10. Background/foreground, блокировка экрана, реальное прерывание во время drag
    и сохранения. После SAVED прогресс восстанавливается; для незавершённой записи
    фиксировать реальный результат, не ожидать невозможной crash-гарантии.
11. Reset во время записи → Confirm → restart/reload: старый прогресс не воскресает.
    Проверить, что выбор/Current/Draft других модулей не сброшены. Для второй вкладки
    проверить понятную ошибку потери ownership и перечитывание через Restart.
12. В узком portrait/landscape и с раскрытой адресной строкой все важные controls
    достижимы; событие видно вокруг overlay. VoiceOver/клавиатура: названия dots,
    активная страница, Close, Help и безопасный confirmation читаются и работают.

Оставшиеся риски: native pan arbitration и OS PointerCancel; адресная строка/safe
area; emoji/font differences; IDB private mode/quota/eviction и реальное завершение
процесса. Все пункты этого раздела ожидают наблюдений, аппаратных PASS пока нет.
