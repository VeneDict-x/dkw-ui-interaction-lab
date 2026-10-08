# Dark Kingdom War — UI Interaction Lab

Статическая лаборатория Pointer Events и адаптивной геометрии. Это инженерный
стенд, а не игра. Все параметры калибровки помечены EXPERIMENTAL.

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

- Индекс открывает **Nested gestures, Actions, Buttons, Navigation, Window & Resize**.
- Back / Close общего тестового окна возвращает в индекс. Close мини-окна
  Navigation закрывает только мини-окно; Reopen сохраняет выбранную страницу.
- Pointer Events — основной путь действий. Клавиатура и assistive activation
  поддерживаются дополнительным путём; pointer click не дублирует PointerUp.
- Debug Panel содержит Slop, HoldDelay, bounded repeat, inertia / elasticity,
  press feedback, staged geometry, hysteresis, settle debounce, blur и dim.
- Параметры сохраняются в localStorage. Config reset возвращает **стартовый
  экспериментальный профиль**, не окончательные production defaults.
- Reset test обнуляет общую диагностику и счётчики лаборатории. Сами параметры
  сбрасываются отдельно. Состояние тестов сохраняется при переходах между окнами
  и при resize, но не предназначено для восстановления после перезагрузки страницы.
- Настройки можно Copy / Export JSON. Диагностика экспортирует environment,
  parameters, результаты с expected / observed, источник и события.
- PASS появляется по выполненному наблюдению, FAIL сохраняется до Reset,
  NOT RUN — сценарий не выполнен. INCONCLUSIVE записывается с причиной для
  неподтверждённого сценария и не заменяет имеющийся PASS / FAIL.
- Журнал хранит последние 150 событий; в панели видны последние 40. JSON
  содержит все сохранённые 150. Никакой автоматической отправки данных нет.

До распознавания Hold или drag уход и возврат могут unpress / repress кнопку.
Для проверки этого сценария начните у края: движение должно оставаться меньше
Slop. После Slop tap отменён до следующего Down. Распознанный Hold сохраняется
вне кнопки и прекращается по Up где угодно / Cancel / lost capture / blur /
скрытию документа. Недоступность останавливает ticks, сохраняя саму сессию.

В Resize вводите размеры mock-окна или тяните ручку. Touch может использовать
числовые поля. Mock-размер ограничен безопасной поверхностью; запрошенные и
фактические размеры различаются на маленьком экране. Presets рассчитывают модель,
но не эмулируют устройство и не заменяют actual viewport.

## Сохранение между сессиями

Скачайте оба ZIP. Полный архив включает исходники, package-lock, тесты, все шесть
файлов ТЗ, AGENTS.md, отчёт и готовый dist; node_modules, секреты и временные
файлы исключены. Для следующей облачной сессии загрузите полный архив и выполните
`npm ci`. Также сохраните JSON настроек и результатов отдельных испытаний.

GitHub хранит исходники, тесты и документацию; зависимости и сборка восстанавливаются
локально. Публикация сайта требует отдельного разрешения. GitHub Pages не включены.

## Публикация после отдельного разрешения

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
и может блокировать загрузку ES modules. До публикации условие Acceptance Criteria
«public HTTPS URL on real devices» остаётся **NOT RUN**.

См. [REPORT.md](REPORT.md), [implementation](docs/IMPLEMENTATION.md),
[physical iPhone checklist](docs/IPHONE_CHECKLIST.md) и исходное ТЗ в docs/handoff.
