> Актуальное расширение: [Module 04 Chat](docs/MODULE04_CHAT_REPORT.md).

> Актуальная реализация Bugfix 04 + Feature 04: [docs/BUGFIX_TASK_04.md](docs/BUGFIX_TASK_04.md).
> Task 03 сохранён в [docs/BUGFIX_TASK_03.md](docs/BUGFIX_TASK_03.md).
> Приведённые ниже результаты относятся к предыдущим этапам.

# Dark Kingdom War — UI Interaction Lab: отчёт

Исторический отчёт первичной реализации от 2026-10-08. Актуальные утверждённые
правила и проверки исправлений — в [Bugfix Task 02](docs/BUGFIX_TASK_02.md).

Дата проверки: 2026-10-08 UTC. Проект реализован в /workspace. Все шесть Markdown-файлов исходного ZIP использованы и сохранены без изменения содержимого в docs/handoff. START_HERE_CODEX.md прочитан первым; правила сохранены в корневом AGENTS.md.

**Статическая сборка готова. Итог: 63 проверки PASS, 0 FAIL, 0 SKIPPED. Публичная HTTPS-публикация и физические устройства — NOT RUN.**

## Итоговые проверки

| Команда / группа | PASS | FAIL | Результат |
|---|---:|---:|---|
| npm run check | — | — | TypeScript без ошибок |
| npm test | 17 | 0 | Модель Slop/repeat/geometry/hysteresis и диагностика |
| npm run test:e2e | 37 | 0 | Playwright в установленном Chromium; без retries |
| npm run test:static | 9 | 0 | Готовый dist на локальном HTTP под /lab/ |
| npm run build | — | — | TypeScript + Vite production build успешны |

Ни один тест не пропущен и не помечен flaky. Итоговые числа относятся к последнему полному прогону, а не сумме повторных попыток. Node.js 24.19.0, npm 11.9.0, TypeScript 5.9.3, Vite 7.3.7, Playwright 1.64.0, Chromium 151.0.7922.173. Машинные результаты и проверенные скриншоты находятся в docs/testing; временные логи исключены из Git.

Браузерные тесты выполняют настоящие mouse / keyboard / wheel действия через Chromium. Touch-путь использует Chromium CDP Input.dispatchTouchEvent и выдаёт браузерные Pointer Events с pointerType=touch. PointerCancel, secondary pointer и некоторые внешние изменения availability специально симулируются и описаны так в тестах. Это не испытания физического iPhone / стилуса / трекпада. Ручных аппаратных PASS не заявляется.

## Реализованные компоненты и сверка с Acceptance Criteria

| Требование | Реализация / доказательство |
|---|---|
| Adaptive Window Geometry | Safe area → доступная поверхность → Window → Functional Bounds; staged Preview/Modules, CR1/CR2, WindowMax, центрирование; model + browser tests |
| Live Resize | ResizeObserver / viewport / orientation / posture events; RAF coalescing; дешёвое presentation во время resize, завершение по handle Up либо editable debounce |
| Gesture Slop / arbitration | UI-relative fallback; abs(dx) >= abs(dy), точный 45° → Carousel; owner lock; permanent tap cancellation |
| Modules × Carousels | Вертикальная и горизонтальная прокрутка; touch/mouse drag и wheel; None; arrows с границами; no-overflow и bounded elastic spring/inertia |
| Gesture Visualizer | Pointer type/id, start/current, dx/dy, abs, distance, phase, owner, validity; overlay path + Slop circle |
| Debug Panel | Все экспериментальные параметры редактируются; localStorage, Reset, JSON export, clipboard с явным fallback |
| Release mechanics | Down без activation; leave/return до Slop; Up вне, drag return, Cancel; pressed depth/darkening/transition/shadow настраиваются |
| Hold + Repeat | Delay; hold вне кнопки; Up anywhere / Cancel / lost capture / blur / hidden; no extra release; cadence + bounded acceleration |
| Interaction vs availability | HOLDING + WAITING; pause/resume без backlog; bounds plus/minus не разрушают сессию |
| Component Test Chamber | Все пять окон доступны; shared title/instructions/state/log/reset/export; TBC зарезервирован |
| Button Gallery | Basic, editable bounded +/- , generic repeat, standalone arrows, Tap/Hold/Repeat |
| Navigation | Пять placeholder страниц; Back-only и Back+Next; disabled/hidden boundaries; Close/Reopen; clickable keyboard-accessible Light-blue / Dark-red active dots |
| Window & Resize | Desktop handle и numeric touch inputs; actual/requested dimensions; H/V band; blur/dim; live/settled; сохранение editor state |
| Диагностика | 26 assertion IDs с NOT RUN по умолчанию; performed PASS/FAIL; sticky FAIL evidence; INCONCLUSIVE с причиной; отдельный EXPERIMENTAL профиль; bounded events + environment/parameters/results JSON |
| Статическая публикация | dist проверен в Chromium, в том числе под вложенным /lab/ URL; HTTPS-ready archive |
| Public HTTPS on real devices | NOT RUN: публикация запрещена текущим разрешением; этот критерий формальной приёмки ещё не выполнен |

## Найденные и исправленные проблемы

- TS2783: helper point() повторно объявлял x/y через spread boundingBox и заменял центр левым верхним углом. Теперь возвращаются явно центр x/y и размеры width/height. Helper прокручивает цель в видимую область до вычисления координат.
- Карточки ошибочно исключались из Pointer Events как обычные native кнопки; теперь card-area проходит общий controller.
- Автоматический min-content трек Grid растягивал мобильную панель. Внутренний трек ограничен minmax(0,1fr), панели допускают сжатие.
- Незакрытый контейнер reference world помещал общий footer/export внутрь скрытого Resize-окна. Структура исправлена; JSON download проверен.
- Vertical wheel внутри горизонтальной карусели не передавался Modules; теперь wheel явно маршрутизируется по dominant axis.
- Live Resize мог завершиться после debounce при неподвижной удерживаемой ручке. Handle session теперь остаётся live до Up/Cancel.
- Blur diagnostic считывал переход до восстановления. Повторная проверка перед Git-публикацией выявила, что таймер 150 ms также может захватить промежуточный кадр. Теперь итоговый computed blur и alpha читаются после фактического завершения CSS-переходов через Animation.finished; устаревшие проверки отбрасываются.
- Повторение сохраняет точный initial interval и округляет timeout вверх для соблюдения max rate.
- UI scale защищает пространство нижней панели и module controls; при дефиците места Preview уступает Modules. Проверено при scale 1.5 и ширине 360.
- Sticky FAIL сохраняет именно свидетельство провала; последующий успех не переписывает expected/observed до Reset.

Ожидания контрактов не ослаблялись. Разработка прошла несколько циклов с обнаружением FAIL и исправлением реализации; итоговый полный прогон выполнен после финальных изменений.

## Экспериментальные решения и ограничения

Все calibration/visual numbers остаются EXPERIMENTAL, не production defaults: UI scale/reference unit и Slop Ratio/Min/Max; HoldDelay, cadence, acceleration, max rate; inertia, overscroll, spring; press depth/darkening/transition/shadow; header/actions, Preview min/preferred/max/breathing/scale, Modules minimum, CR1/CR2, WindowMax; breakpoints, hysteresis, H/V thresholds, settle debounce; decoration budget, blur/dim, low-cost mode.

Обратимые трактовки: standalone движение через Slop отменяет tap как DRAG; возврат до Hold перезапускает delay; recognized hold выдаёт один начальный tick и далее одиночные таймеры; неопределённый первый H/V без доступной orientation выбирает V. Native Slop и универсальный browser resize-end не выдумываются.

Параметры сохраняются в localStorage, но drafts/selections и журнал — в пределах открытой страницы. Между облачными сессиями используйте полный ZIP и экспорт JSON, а не сохранность /workspace. Low-cost mode демонстрируется на статической reference grid, без заявления об engine snapshot или измеренной экономии GPU. Optional page swipe не включён; haptics/audio не реализованы, политика остаётся открытой. Реальные fold/hinge, pen, trackpad, WebKit и hardware interruptions требуют отдельных испытаний.

**Физический iPhone:** выполнить IOS-01…IOS-17 из docs/IPHONE_CHECKLIST.md: Safari safe area/address bar/keyboard, orientation, реальный finger Slop и вложенные жесты, Hold вне кнопки, interruptions, multi-touch, blur performance, navigation, export/clipboard/storage, VoiceOver. Все эти аппаратные сценарии — NOT RUN.

## Архивы и следующий шаг

- DKW_UI_INTERACTION_LAB_source.zip: исходники, все 6 файлов ТЗ, AGENTS.md, package-lock, тесты, документация, итоговая диагностика и dist. Без node_modules, секретов, Git/config metadata и временных файлов.
- DKW_UI_INTERACTION_LAB_static.zip: index.html и assets/ в корне; готово для загрузки на статический HTTPS-хостинг.

Полный ZIP предыдущего этапа дополнительно распакован в отдельную временную папку: npm ci --offline по lockfile, все 17 модельных тестов и production build успешны; восстановленные файлы dist побайтово совпадают с исходной сборкой. В этой песочнице проверка postinstall esbuild требовала разрешённого выполнения команды с дополнительной сетевой возможностью; установка выполнялась из локального cache без публикации или загрузки проекта.

Исходники подготовлены для первого коммита в main репозитория https://github.com/VeneDict-x/dkw-ui-interaction-lab по отдельному разрешению пользователя. Сайт не опубликован, GitHub Pages не включены. Архивы предыдущего этапа не обновлялись после исправления timing; текущая версия восстанавливается из Git-репозитория. Следующий этап после отдельного разрешения: разместить актуальный dist на HTTPS и пройти iPhone checklist с экспортом наблюдений; затем откалибровать экспериментальные параметры.

## Проверка перед первым коммитом

Первый прогон Chromium: 35 PASS / 1 FAIL в диагностике BACKDROP. Новый регрессионный
сценарий с замедленным CSS-переходом воспроизвёл ошибку до исправления. После
ожидания Animation.finished полный прогон: 37 PASS / 0 FAIL, без retries.
Production smoke сначала дал 5 PASS / 1 FAIL: счётчик считывался до запланированного
requestAnimationFrame. Проверка теперь ожидает отображение прежнего результата
«1 действие», а не меняет его. После исправления: 9 PASS / 0 FAIL.

Экспериментальный профиль src/config.ts, Pointer Events controller и шесть файлов
ТЗ сохранены побайтово. .gitignore исключает зависимости, сборку, кеши, временные
файлы, логи и локальные credentials; подготовленные файлы проверены на секреты.
README содержит восстановление через git clone и npm ci.

В этой облачной среде /workspace/.git — каталог только для чтения. Служебные данные
Git хранятся отдельно в /workspace/scratch/dkw-git и исключены из коммита. Локальные
команды используют git --git-dir=/workspace/scratch/dkw-git --work-tree=/workspace.
После обычного клонирования с GitHub это ограничение не относится к новому checkout.

## Выполненные Playwright-сценарии

1. PASS — entry, chambers, NOT RUN assertions and no default PASS
2. PASS — release happens on Up, not Down, and pointer click cannot duplicate it
3. PASS — leave and return below slop visually unpress/repress and activate once
4. PASS — Up outside cancels even below slop
5. PASS — drag then return cannot resurrect a button tap
6. PASS — simulated PointerCancel resets without activation and lost capture interrupts hold
7. PASS — short tap hold control performs one action
8. PASS — hold survives outside, repeats, terminates on outside Up without extra click
9. PASS — availability pauses active hold and resumes without a backlog
10. PASS — movement before hold recognition cancels repeat and release
11. PASS — secondary pointer is ignored while first holds; blur terminates
12. PASS — plus/minus bounds, generic repeat, standalone arrows work independently
13. PASS — hold reaching step bound preserves session, availability resumes if bound changes
14. PASS — carousel card tap selects, None clears, horizontal drag does not select
15. PASS — 45 degrees selects carousel, locks through later vertical intent; reversal is immediate
16. PASS — vertical intent inside carousel scrolls modules and keeps horizontal position
17. PASS — outside cards starts Modules and ignores horizontal movement
18. PASS — no overflow means no scroll or elastic movement, edge arrows unavailable
19. PASS — overflow has bounded elastic pull and spring return
20. PASS — five-page dots, faction colors, back/next and close/reopen preserve page
21. PASS — navigation boundaries and back-only/hidden setting
22. PASS — keyboard activates buttons, cards and dots with visible focus semantics
23. PASS — resize preserves carousel selection, draft, page, step and relevant scroll
24. PASS — mock live resize, blur/dim restore, pointer drag and state preserved
25. PASS — square mock preserves previous H/V mode through hysteresis
26. PASS — config persistence, reset, exports contain environment and performed checks
27. PASS — layout fits 360 px, targets retain safe size, 30 modules remain scrollable
28. PASS — trackpad/wheel path scrolls horizontal carousel and vertical modules
29. PASS — real Chromium touch input reports touch Pointer Events and nested ownership
30. PASS — visual smoke has no runtime errors or unexpected external requests
31. PASS — live resize remains live while handle is held without movement; final backdrop assertion passes
32. PASS — backdrop validation waits for completed effects during slower restoration
33. PASS — experimental press and repeat settings affect behavior; all geometry fields are editable
34. PASS — INCONCLUSIVE requires a reason and cannot overwrite an observed PASS
35. PASS — recognized hold PointerCancel stops ticks and cannot trigger a release action
36. PASS — large experimental UI scale protects action bounds and does not overlap carousel controls
37. PASS — visualizer shows start, slop boundary, path and permanently cancelled tap
