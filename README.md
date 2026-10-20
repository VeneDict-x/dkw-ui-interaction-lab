# Dark Kingdom War — UI Interaction Lab

Статическая лаборатория Pointer Events и адаптивной геометрии. Это инженерный
стенд, а не игра. Все параметры калибровки помечены EXPERIMENTAL.

Актуальное расширение Module 04: общий чат, emoji picker, безопасный Unicode-ввод
и новые правила восстановления/сброса — [ТЗ](docs/MODULE04_CHAT_SPEC.md),
[отчёт](docs/MODULE04_CHAT_REPORT.md). Приложение/reload/restart открывает модуль 04
на карте мира; прочтение памятки, настройки, чат и черновик сохраняются.

Bugfix 04 + Feature 04 превращает Navigation в мир → зимнее событие → памятку
с live swipe, последовательным чтением и durable progress. Исправлена нативная
прокрутка верхних вкладок с поверхности кнопок. Подробности и результаты:
[BUGFIX_TASK_04.md](docs/BUGFIX_TASK_04.md). PR не обновляет сайт до слияния в main.

Bugfix Task 03 добавляет исправления lifecycle, Strict Tap, N + Peek карусели и
реальное локальное сохранение в шестом модуле. Полное задание и актуальные
заметки реализации: [BUGFIX_TASK_03.md](docs/BUGFIX_TASK_03.md).

Актуальное исключение ReleaseButton и результаты Bugfix Task 02 описаны в
[отчёте](docs/BUGFIX_TASK_02.md). Шесть исходных файлов ТЗ сохранены; утверждённое
новое правило заменяет старую Slop-отмену только для ReleaseButton.

## Восстановление разработки

Исходники: [VeneDict-x/dkw-ui-interaction-lab](https://github.com/VeneDict-x/dkw-ui-interaction-lab).
Для восстановления из GitHub:

```sh
git clone https://github.com/VeneDict-x/dkw-ui-interaction-lab.git
cd dkw-ui-interaction-lab
npm ci
```

Для восстановления из полного ZIP:

1. Распакуйте `DKW_UI_INTERACTION_LAB_source.zip` и откройте папку
   `DKW_UI_INTERACTION_LAB`.
2. Используйте Node.js **22.13+**, предпочтительно Node.js 24 LTS, и npm.
3. Выполните `npm ci` — зависимости восстанавливаются по package-lock.json.
4. Запустите `npm run dev`; откройте адрес, показанный Vite.

```sh
npm run check       # TypeScript
npm test            # тесты модели: Slop, repeat, geometry, hysteresis
npm run test:e2e    # реальные браузерные сценарии в Chromium
npm run build       # статический dist/
npm run preview     # локальная проверка dist/
npm run test:static # проверка dist под /lab/, на локальном порту 4180
npm run package     # два ZIP в artifacts/
```

В проверенной облачной среде Chromium расположен в `/usr/bin/chromium`.
Для другой машины задайте `CHROMIUM_PATH` — абсолютный путь к установленному
Chrome/Chromium, например `CHROMIUM_PATH=/path/to/chromium npm run test:e2e`.
Команда `npm test` использует Node test runner без subprocess isolation, чтобы не
зависеть от запрещённого в песочнице IPC-сервера CLI tsx. Изоляция браузерных
сценариев обеспечивается отдельными Playwright browser contexts.

## Работа со стендом

- Индекс открывает **Nested gestures, Actions, Buttons, Navigation, Window & Resize, Draft & Recovery**.
- Back / Close общего тестового окна возвращает в индекс. Close мини-окна
  Navigation закрывает только памятку, оставляя зимнее событие; ❓ сохраняет страницу,
  но начинает статью сверху. Event впервые открывает памятку автоматически, затем — вручную.
- Pointer Events — основной путь действий. Клавиатура и assistive activation
  поддерживаются дополнительным путём; pointer click не дублирует PointerUp.
- Debug Panel содержит Slop и отдельный EXPERIMENTAL touch multiplier (стартовый
  коэффициент 1.25), HoldDelay, bounded repeat, inertia / elasticity,
  press feedback, staged geometry, hysteresis, settle debounce, blur и dim. Новые
  Guide-параметры регулируют intent ratio, долю swipe, spring, сопротивление и popup.
- Параметры сохраняются в localStorage. Config reset возвращает **стартовый
  экспериментальный профиль**, не окончательные production defaults.
- В модуле 05 Reset test сбрасывает только mock width/height, Draft, Persist
  selection и локальные временные состояния. В модуле 06 Reset открывает
  подтверждение удаления локальных данных. В модуле 04 Reset открывает подтверждение
  сброса только Event State; другие модули не затрагиваются. В остальных окнах сохранён
  прежний Reset диагностики и счётчиков. Сами параметры
  сбрасываются отдельно. Состояние тестов сохраняется при переходах между окнами
  и при resize. Модули 04 и 06 дополнительно восстанавливают подтверждённые
  локальные данные после перезагрузки; остальные тестовые состояния — session-only.
- Настройки можно Copy / Export JSON. Диагностика экспортирует environment,
  parameters, результаты с expected / observed, источник и события.
- PASS появляется по выполненному наблюдению, FAIL сохраняется до Reset,
  NOT RUN — сценарий не выполнен. INCONCLUSIVE записывается с причиной для
  неподтверждённого сценария и не заменяет имеющийся PASS / FAIL.
- Журнал хранит последние 150 событий; в панели видны последние 40. JSON
  содержит все сохранённые 150. Никакой автоматической отправки данных нет.

ReleaseButton в Actions и Release action в Nested gestures следят за функциональными
границами: Inside → PRESSED, Outside → RELEASED; возвращаться можно сколько угодно
раз, независимо от Slop. Up внутри даёт ровно одно действие, Up снаружи / Cancel — ноль.
Press-depth feedback не сдвигает область hit-test и не заставляет кнопку следовать указателю.

Обычные кнопки (включая Navigation и utility controls) используют Strict Tap:
первый выход необратимо отменяет нажатие, движение внутри не ограничено Slop.
У карточек и кандидатов Hold после Slop tap отменён до следующего Down. До
распознавания Hold уход и возврат ниже Slop могут unpress / repress кнопку.
Распознанный Hold сохраняется
вне кнопки и прекращается по Up где угодно / Cancel / lost capture / blur /
скрытию документа. Недоступность останавливает ticks, сохраняя саму сессию.

В Resize вводите размеры mock-окна или тяните ручку. Touch может использовать
числовые поля. Mock-размер ограничен безопасной поверхностью; запрошенные и
фактические размеры различаются на маленьком экране. Presets рассчитывают модель,
но не эмулируют устройство и не заменяют actual viewport.

## Event Guide — модуль 04

Мир → ☃️ Событие. При первом входе откроется памятка: пять длинных русских статей,
вертикальный native touch scroll и горизонтальный live swipe. «Понятно» находится
в конце статьи и после завершения записи IndexedDB открывает следующую страницу.
Замки, галочки и popup показывают доступ; Back/Next, dots и swipes используют общие
правила. Theme: Light / Dark / Premium. Скрытые крайние кнопки не запрещают dots/swipe.

Закройте памятку и откройте ❓: восстановится последняя страница сверху. Повторный
вход из мира не открывает памятку автоматически. Последняя отметка оставляет окно
открытым с галочками; после закрытия и повторного открытия включается свободный
reference mode без отметок/замков/кнопок «Понятно».

QA controls под игровой сценой: подтверждаемый Reset Event State, Simulate App
Restart из настоящего durable storage, Reload Page и Retry при ошибке. SAVED означает
завершённую IDB-транзакцию, не гарантию выживания при очистке/эвикции/сбое ОС.
Данные модуля 04 изолированы от Draft 06. После reload карта Module 04 открывается автоматически.
Scenario/Boundary/Theme сохраняются. Reset Event State сохраняет чат и настройки;
Reset 04 Module после подтверждения очищает все данные только этого модуля.
Chat Message History показывает шесть полных сообщений; в сцене видны последние четыре.
Live/Random/Double Send — локальные лабораторные инструменты, не сетевой чат.

## Draft & Recovery — шестой модуль

Current обновляется немедленно; Draft меняется только после завершения записи
IndexedDB; Applied меняется только по Apply. Large=None блокирует Apply,
но допускает autosave. EXPERIMENTAL latency mode: variable 1.5–2.5 s или
детерминированная задержка/гонка для теста. Cancel открывает три безопасных
варианта: Discard changes, Save for later, Continue editing.

После reload сохранённый Draft восстанавливается только по выбору Continue editing
в дружелюбном Draft found prompt. Not now оставляет Draft, Delete требует
отдельного подтверждения. Simulated crash уничтожает временное состояние и
читает IndexedDB заново; это не принудительное завершение Safari.

IndexedDB принадлежит браузеру и origin. Очистка данных сайта/эвикция удаляет
локальный Draft; удалённой синхронизации нет. Ошибки записи видны и доступны Retry.

## Сохранение между сессиями

Скачайте оба ZIP. Полный архив включает исходники, package-lock, тесты, все шесть
файлов ТЗ, AGENTS.md, отчёт и готовый dist; node_modules, секреты и временные
файлы исключены. Для следующей облачной сессии загрузите полный архив и выполните
`npm ci`. Также сохраните JSON настроек и результатов отдельных испытаний.

GitHub хранит исходники, тесты и документацию; зависимости и сборка восстанавливаются
локально. Владелец настроил существующий GitHub Pages workflow: push в main запускает
проверку и статический deployment. Его результат проверяется в GitHub Actions.

## Статическая сборка и публикация

Архив `DKW_UI_INTERACTION_LAB_static.zip` содержит `index.html` и `assets/` в корне.
Распакуйте его и загрузите содержимое на статический HTTPS-хостинг. Backend,
OpenAI API key, домен, база данных и авторизация не нужны.

Варианты: ручная загрузка сборки на Netlify / Cloudflare Pages либо GitHub Pages
через ваш репозиторий. Для автоматической сборки: install `npm ci`, build
`npm run build`, output `dist`. Настройка `base: './'` поддерживает вложенный URL
проекта; `/lab/` проверен локально. Проект не использует серверный роутинг и не
требует SPA rewrite rules.

Откройте выданный HTTPS-адрес в Safari на настоящем iPhone. `localhost` облачной
среды не доступен с телефона. Открытие index.html через file:// не заменяет HTTP(S)
и может блокировать загрузку ES modules. Успешный deployment и тесты Chromium не
подтверждают работу Safari на устройстве: повторная проверка исправлений требует
отдельных наблюдений из iPhone-чек-листа.

См. [REPORT.md](REPORT.md), [implementation](docs/IMPLEMENTATION.md),
[physical iPhone checklist](docs/IPHONE_CHECKLIST.md) и исходное ТЗ в docs/handoff.
