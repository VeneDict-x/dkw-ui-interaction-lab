> Исторический отчёт Task 04. Сначала правила восстановления дополнены
> [MODULE04_CHAT_SPEC.md](MODULE04_CHAT_SPEC.md), раздел A. Актуальный
> [Final QA 01–06](FINAL_QA_01_06_SPEC.md) заменяет startup и first-entry-only:
> Lab открывает индекс, Module 04 — World; вход в Event автоматически продолжает
> незавершённое чтение с первой неподтверждённой страницы. Прогресс сохраняется.

# Bugfix 04 + Feature 04 — Event Guide & Swipe Navigation

Дата: 2026-10-18. База: `main`, `0e1f3a0a653fe28f02c773755b2f966cb84d2fca`.
Ветка: `bugfix/04-event-guide`. Изменения предназначены для PR в main; автоматическое
слияние и deployment не разрешены. Физическая Safari / Chrome iOS приёмка — **PENDING**.
Это задание владельца дополняет Task 02/03, сохраняя их контракты остальных модулей.

## Утверждённый объём

**Bugfix 04 / BF03-SAFARI-01 (P2).** На узком iPhone вертикальной ориентации верхняя
полоса модулей должна горизонтально прокручиваться с любой поверхности, включая
кнопки. Tap выбирает модуль, scroll не выбирает, выход отменяет Strict Tap навсегда.
Поворот телефона не должен делать модули 05/06 недоступными.

**Feature 04.** Модуль Navigation моделирует мир с замком, аватаром, ресурсами и
кнопкой события; зимний экран с Back и постоянной ❓; меньшую непрозрачную памятку
поверх видимого события. Закрытие памятки оставляет игрока в событии. Пять длинных
русских статей: Замок, Ферма, Казармы, Академия, Кланы. В каждой большая иллюстрация
в начале; в Академии есть вторая после текста; таблицы/списки и разная длина.
«Понятно» находится в самом конце прокручиваемой статьи, не в footer.

Памятка следует указателю при горизонтальном drag, показывает соседнюю страницу,
завершает переход либо возвращается. Один жест меняет максимум одну страницу.
Первый/последний и закрытый края сопротивляются. Вертикальное намерение сохраняет
нативный touch scroll, владельца нельзя менять до завершения. Up/cancel/interrupt
очищают временное состояние; drag не нажимает «Понятно». Новый open и переход
начинают выбранную статью сверху. Текущее вертикальное чтение не сбрасывается.

Back/Next, пять индикаторов и swipe используют единый доступ. Hidden/Disabled
влияют на крайние кнопки, Back-only — на Next; допустимые dots/swipes работают.
Положение оставшихся кнопок не прыгает. Light: синие dots, Dark: красные,
Premium: золотые. Маленький замок и тонкая зелёная галочка оставляют dot видимым.

Первоначально доступна только страница 1. «Понятно» после durable save отмечает
ровно текущую страницу, открывает следующую и переходит на неё. Посещение/scroll
не считаются чтением. Последняя отметка завершает памятку, не закрывая её;
галочки остаются в этой открытой сессии. После закрытия завершённой памятки ❓
открывает reference mode: все страницы, без замков/галочек/«Понятно».

Первый вход в конкретное событие автоматически открывает страницу 1 ровно один
раз. Раннее закрытие сохраняет page/acknowledgments; ❓ открывает сохранённую
страницу сверху. Back в мир и повторный Event не открывают памятку автоматически,
даже если чтение не завершено. Идентификатор occurrence позволяет будущий новый цикл.

Закрытая страница не открывается размытой: небольшой elastic preview и возврат.
Dots/Next/swipe показывают одну ненавязчивую подсказку, обновляя её при повторе:

> Следующая часть откроется после прочтения текущей

Появление 150 ms, удержание 1250 ms, исчезновение 300 ms; без звука, тревожного
оформления и блокировки ввода; reduced motion убирает анимацию.

Лабораторные инструменты находятся **вне** игрового интерфейса: Reset Event State
(с отдельным подтверждением), Simulate App Restart (уничтожить volatile state и
читать durable), Reload Page (настоящая reload), Retry при ошибке. Диагностика:
eventEntered, currentScreen, guideOpen, lastPage, acknowledgedPages,
guideCompleted, guideMode, saveStatus, persistedVersion, ошибка.

## Причина дефекта и исправление полосы

До изменения новый Chromium/CDP сценарий начинал touch swipe на кнопке Actions:
`scrollLeft` оставался 0, ожидалось >60 px. Это воспроизведение автоматизацией,
а не новая проверка физического iPhone. Краткое свидетельство: `testing/bf04-before-summary.json`.

Кнопки имели общий `touch-action: none`; общий InteractionController вызывал
preventDefault на Down и захватывал указатель. Поэтому браузер не получал
нативный pan с кнопки; промежутки кнопок сохраняли другой путь ввода.

`module-strip.ts` перехватывает события только своей полосы до общего controller.
Для touch разрешён `touch-action: auto`, Down не подавляет default. Native pan
получает PointerCancel, отменяющий tap. При распознанном scroll tap также отменён,
включая движение внутри широкой кнопки. Мышь дополнительно умеет тянуть полосу.
На не переполненной desktop-полосе обычное движение внутри остаётся Strict Tap.
Функциональный hit-test исключает press translation; первый exit необратим.
Keyboard/assistive detail=0 — отдельный доступный путь, pointer click не повторяет Up.
Новых глобальных pointermove/up listeners нет; старый controller не изменён.

## Архитектура памятки

| Файл | Ответственность |
|---|---|
| src/module-strip.ts | Локальный ввод верхней полосы, native touch scrolling, Strict Tap |
| src/event-state.ts | Чистая модель событий, очередь команд, IndexedDB, guard и recovery |
| src/event-guide.ts | Мир/событие/overlay, единые переходы, QA, диагностика и popup |
| src/event-articles.ts | Пять вымышленных русских учебных статей и emoji-иллюстрации |
| src/guide-gesture.ts | Локальная Pointer-сессия, axis lock, live track и springback |
| src/event-guide.css | Изолированные стили сцены, article viewport, тем и полосы |
| src/config.ts | Только новые EXPERIMENTAL guide-параметры; старые значения сохранены |
| src/main.ts | Подключение модуля 04, suspend при уходе, сохранение общего стенда |
| tests/browser/bugfix-04.spec.ts | Новые браузерные regression и реальные IDB-сценарии |
| tests/browser/guide-reference.ts | Реальное прохождение памятки для прежних free-navigation тестов |
| tests/core.test.ts | Десять новых чистых/model-store проверок |

В `lab.spec.ts` и `bugfix-03.spec.ts` изменена только подготовка Navigation:
теперь сначала выполняются настоящие пять acknowledgment и открывается reference
mode. Старые проверки свободной навигации сохранены. Их expected не ослаблены;
доступ исходного режима изменён самим утверждённым заданием. Release/Hold/carousel,
geometry и Draft 06 источники не изменены, все шесть handoff файлов сохранены.

Guide viewport использует `touch-action: pan-y`, Pointer capture и локальные
handlers. После общего Slop горизонталь распознаётся при
`abs(dx) >= abs(dy) * guideAxisRatio`, иначе вертикаль. Эта настройка относится
**только к памятке**, не меняет точную 45° → Carousel политику модуля 01.
Native vertical touch может завершить Pointer-сессию через cancel: scroll остаётся
браузеру. Desktop mouse вертикаль моделируется scrollTop. Горизонталь двигает
общий flex track без глобального перехвата. Cancel/lost capture/blur/pagehide/
hidden/resize/navigation отменяют drag и старый animation callback.
Подтверждение перехода определяется долей ширины, без velocity shortcuts.

## Durable persistence и границы гарантий

Отдельная IndexedDB `dkw-event-guide-v1`, store `events`, ключ occurrence
`winter-lab-2026-01`; записи Module 06 не затрагиваются. Сохраняются screen,
entered, open, lastPage, acknowledgement-prefix, completed, mode, occurrence,
epoch/lease/version. Форма читаемых данных проверяется; повреждение даёт
SAVE_FAILED и явный подтверждаемый Reset, не молчаливое «успешное» восстановление.

UI показывает новую отметку/следующую страницу только после `transaction.oncomplete`.
Состояние до окончания записи остаётся последним durable. Команды сериализованы;
репозиторий читает текущее значение и применяет переход внутри readwrite-транзакции,
проверяя epoch/lease в той же транзакции. Reset создаёт новый epoch/lease; Restart
уничтожает volatile state, получает новый lease и восстанавливает реальную запись.
Token дополнительно отбрасывает старые UI callbacks. Отложенный старый ack не может
воскресить прогресс после reset/restart. Retry повторяет ошибочную команду или
ошибочный reset, а не подменяет reset загрузкой старого прогресса.

Несколько вкладок: последний acquire владеет записью события. Прежняя вкладка
получит явную ошибку записи; Simulate App Restart перечитывает durable и получает
новый lease. Автоматического merge нескольких активных вкладок нет. Остальные
модули сохраняют свой прежний жизненный цикл. После reload стенд открывает индекс,
а сохранённый мир/событие/overlay восстанавливается при открытии Module 04.

Нельзя гарантировать сохранение команды до завершения IDB-транзакции при внезапном
crash или физическую запись на носитель после OS power loss. Очистка/эвикция данных
сайта удаляет локальный прогресс; private mode/quota/OS shutdown требуют настоящего
устройства. При недоступной IDB видна ошибка, а не ложный SAVED. Никакой удалённой
синхронизации, backend, аккаунтов, сети или внешних игровых ассетов не добавлено.
QA Restart — логическое уничтожение модели, не принудительное убийство Safari.

## Экспериментальные параметры

Все параметры редактируются в существующей Debug Panel и сохраняются обычным
профилем; старые custom значения и старые defaults не изменены.

| Параметр | Стартовое значение |
|---|---:|
| guideAxisRatio | 1.15 |
| guideSwipeFraction | 0.25 ширины |
| guideSpringMs | 220 ms |
| guideResistance | 24 px, logarithmic |
| guidePopupIn | 150 ms |
| guidePopupVisible | 1250 ms |
| guidePopupOut | 300 ms |

Slop остаётся прежним: базовый mouse/pen 7.68 px, touch 9.60 px при multiplier 1.25,
формула и Min/Max сохранены. В Task 04 дополнительного увеличения нет.

## Проверка и доставка

**Итог: 191 PASS / 0 FAIL / 0 SKIPPED.**

| Команда | PASS | FAIL | Результат |
|---|---:|---:|---|
| npm run check | — | — | TypeScript без ошибок |
| npm test | 37 | 0 | Модель и lifecycle/storage guards |
| npm run test:e2e | 141 | 0 | Полная Chromium suite, один worker, retries=0, flaky=0 |
| npm run build | — | — | Production dist успешно собран |
| npm run test:static | 13 | 0 | dist под /lab/, включая Event и реальную reload |

Node 24.19.0, Chromium 151.0.7922.173. Итоговая браузерная suite выполнена за 5.1 min.
Машинный отчёт: [bugfix-04-summary.json](testing/bugfix-04-summary.json),
[production smoke](testing/bf04-static-results.json).
Историческая база — 144 PASS: 27 model, 107 browser, 10 production smoke.
Добавлено 47 проверок: 10 model, 34 browser, 3 production smoke.
Все прежние тесты сохранены. Форматирование и git diff --check также проходят.
Секреты, временные файлы и зависимости в коммит не включены.
[Сравнение ветки с main](https://github.com/VeneDict-x/dkw-ui-interaction-lab/compare/main...bugfix/04-event-guide).
Каждый итоговый результат относится к одному последнему прогону, без суммирования
повторных попыток. Автоматизация не заменяет физический Safari.

Просмотрены снимки [mobile](testing/bf04-mobile-guide.png) и
[desktop](testing/bf04-desktop-guide.png): overlay меньше сцены, непрозрачен;
controls и themed dots доступны. Это визуальная проверка Chromium.

Новая проверка охватывает top-strip native swipe на кнопке/tap/cancel/narrow/rotation;
first/subsequent entry, early close/Help, sequential unlock/overlays/locked popup,
completion/reference, live drag/return/cancel/axis lock/native vertical touch,
buttons/dots/swipe accessibility, real reload/restart/reset, pending ack/durable
commit/abort/Retry/stale lease/reset epochs/separate occurrences, mobile articles,
three themes/reduced motion/fast double taps. Все старые модули проходят общую suite.
Подробный физический чек-лист: [IPHONE_CHECKLIST.md](IPHONE_CHECKLIST.md).

PR не сливается автоматически. Существующий Pages workflow запускается только на
main; ветка и PR не обновляют сайт. Проверка PR в Actions — проверка исходников,
не deployment и не подтверждение поведения iPhone.

Итерации: исходный top-strip тест воспроизвёл регрессию до исправления. Первый
полный проход после реализации: 137/137. При расширении проверки диагностики
получен один NOT RUN: новый тест отправлял координатный click в Back, находившийся
ниже viewport. Исправлена подготовка ввода (`scrollIntoViewIfNeeded`), ожидаемый
PASS не менялся. Отдельная повторная проверка подтвердила реальные NAV-BOUND,
NAV-PAGE и NAV-CLOSE; итоговый полный прогон включает этот сценарий.

Дополнительный review быстрых действий выявил воспроизводимую гонку: две Event
активации при задержанной первой записи трактовались как два входа; вторая закрывала
автоматически открытую памятку. Отдельный Chromium тест до исправления получил FAIL
(ожидалось видимое окно, фактически hidden); свидетельство:
[bf04-double-entry-before.json](testing/bf04-double-entry-before.json).
Команда enter теперь идемпотентна, пока screen уже event: новым входом считается
только переход из world. Это сохраняет правило последующих реальных входов без
автооткрытия. Добавлены чистый model и браузерный delayed-write regression.
