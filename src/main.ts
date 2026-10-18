import './style.css';
import './event-guide.css';
import { EventGuide } from './event-guide';
import { bindModuleStrip } from './module-strip';
import { bindCarousel } from './carousel';
import { DraftLab } from './draft-ui';
import { fields, loadConfig, sanitize, defaults, slop, clamp, type Key } from './config';
import { geometry, orientationMode, type Geometry } from './geometry';
import { Diagnostics, download, cases } from './diagnostics';
import { InteractionController } from './interaction';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let config = loadConfig();
const model = {
  actionCount: 0,
  basicCount: 0,
  repeatCount: 0,
  holdCount: 0,
  step: 5,
  min: 0,
  max: 10,
  arrow: 0,
  ready: true,
  page: 1,
  faction: 'Light',
  closed: false,
  count: 8,
  cards: 7,
  selections: {} as Record<number, string>,
  draft: 'Reference draft',
  mockW: 520,
  mockH: 350,
  mockMode: null as 'H' | 'V' | null,
};
const root = $('app');
const panels = [
  [
    'carousel',
    'Nested gestures',
    '01',
    'Modules × Carousels',
    'Проверяйте tap, диагонали, смену направления и вложенную прокрутку.',
  ],
  [
    'actions',
    'Actions',
    '02',
    'Press mechanics',
    'ReleaseButton: Inside → PRESSED, Outside → RELEASED. Возврат работает независимо от Slop. Up внутри активирует один раз.',
  ],
  [
    'buttons',
    'Buttons',
    '03',
    'Button Gallery',
    'Короткий tap: одно действие. Hold: повторение без дополнительного клика на Up.',
  ],
  [
    'navigation',
    'Navigation',
    '04',
    'Event Guide & Swipe Navigation',
    'Мир → зимнее событие → памятка. Читайте, подтверждайте и проверяйте жесты и восстановление.',
  ],
  [
    'resize',
    'Window & Resize',
    '05',
    'Adaptive geometry',
    'Изменяйте mock-геометрию численно или ручкой. Размеры окна первичны.',
  ],
  [
    'draft-recovery',
    'Draft & Recovery',
    '06',
    'Draft & Recovery',
    'Local durable drafts · Current / Draft / Applied · variable local save latency, no server.',
  ],
] as const;
root.innerHTML = `
<header class="masthead"><div class="brand"><span class="brand-mark">DKW</span><div><span class="eyebrow">DARK KINGDOM WAR</span><h1>UI Interaction Lab</h1></div></div><span class="build-badge">v1 · engineering bench</span></header>
<div class="intro"><p>Измерять. Наблюдать. Настраивать.</p><span>Pointer Events · neutral debug skin · no game assets</span></div>
<div class="app-grid"><aside class="index"><div class="section-label">COMPONENT TEST CHAMBER</div><nav aria-label="Тестовые окна">${panels.map(([id, name, n]) => `<button class="nav-item" data-open="${id}"><span>${n}</span>${name}<span class="nav-arrow">↗</span></button>`).join('')}</nav><div class="future"><span>EXPERIMENTS / TBC</span><p>Место для будущих модулей.<br>Без спекулятивной реализации.</p></div><div class="index-note">Все настройки калибровки —<br><b>EXPERIMENTAL</b></div></aside>
<main id="main"><section id="home" class="panel home"><span class="eyebrow">INTERACTION WORKBENCH</span><h2>Выберите эксперимент</h2><p>Откройте тестовое окно, выполните сценарий и смотрите события и наблюдаемые результаты. <code>NOT RUN</code> означает, что проверка ещё не выполнялась.</p><div class="home-grid">${panels.map(([id, name, n, , desc]) => `<button class="experiment-card" data-open="${id}"><span class="experiment-number">${n}</span><strong>${name}</strong><small>${desc}</small><span>Открыть →</span></button>`).join('')}</div></section>
<section id="test-shell" class="panel" hidden><div class="shell-bar"><button id="back-index" class="quiet">← Индекс</button><span id="test-code" class="eyebrow"></span><button id="close-test" class="quiet">Закрыть тест ×</button></div><div class="test-heading"><div><h2 id="test-title"></h2><p id="instructions"></p></div><span class="live-badge"><i></i> LIVE OBSERVATION</span></div>
<div id="carousel" class="test-panel" hidden><div class="control-strip"><label>Modules <input id="module-count" type="number" min="1" max="30" value="8"></label><label>Cards / row <input id="card-count" type="number" min="1" max="30" value="7"></label><label>Draft <input id="draft" value="Reference draft"></label></div><div id="workspace-host"><article id="workspace" class="workspace"><header class="workspace-head"><strong>Adaptive Window</strong><output id="geometry-label"></output></header><div id="workspace-body"><div class="preview-frame"><svg id="preview-content" viewBox="0 0 280 180" role="img" aria-label="Нейтральный образец с фиксированным aspect ratio"><rect x="1" y="1" width="278" height="178" rx="12" fill="#212e38" stroke="#49616b"/><path d="M20 90H260M140 20V160" stroke="#49616b" stroke-dasharray="4 6"/><rect x="94" y="40" width="92" height="100" rx="6" fill="#3c5860"/><circle cx="140" cy="80" r="18" fill="#8cbbb6"/><text x="140" y="165" text-anchor="middle" fill="#b4c8cc" font-size="11">REFERENCE · 280 × 180</text></svg><span id="selection-summary"></span></div><div id="modules" class="gesture-modules" aria-label="Вертикальные Modules" tabindex="0"></div></div><footer class="workspace-actions"><button data-action="clear-selection">Clear selections</button><button data-action="lab-release" data-release-policy="geometry">Release action <span id="lab-count">0</span></button></footer></article></div><p class="hint">В Cards Area: |dx| ≥ |dy| → Carousel, включая 45°. Вне карточек → Modules. Владение блокируется до Up / Cancel. Wheel / trackpad также доступны.</p></div>
<div id="actions" class="test-panel" hidden><div class="demo-surface action-stage"><span class="surface-label">PRESS / RELEASE TARGET</span><button id="release-button" data-action="release" data-release-policy="geometry" class="primary large-target">Release Button</button><p class="hint">Внутри — PRESSED, снаружи — RELEASED. Возвращайтесь сколько угодно раз; Slop не отменяет ReleaseButton. Up внутри — одно действие.</p></div><div class="state-grid"><div><span>ACTIVATIONS</span><output id="action-count">0</output></div><div><span>INTERACTION</span><output id="release-state">IDLE</output></div><div><span>PRESS VISUALS</span><output class="experimental">EXPERIMENTAL</output></div></div></div>
<div id="buttons" class="test-panel" hidden><div class="gallery"><section class="demo-card"><span class="section-label">01 / BASIC ACTION</span><button data-action="basic">Basic action</button><output id="basic-count">0 actions</output></section><section class="demo-card"><span class="section-label">02 / BOUNDED STEPS</span><div class="control-strip"><label>Min<input id="step-min" type="number" value="0"></label><label>Max<input id="step-max" type="number" value="10"></label><label>Current<input id="step-value" type="number" value="5"></label></div><div class="button-row"><button id="minus" data-action="minus" aria-label="Уменьшить">−</button><output id="step-display">5</output><button id="plus" data-action="plus" aria-label="Увеличить">+</button></div></section><section class="demo-card"><span class="section-label">03 / GENERIC REPEAT</span><button id="repeat-button" data-action="repeat">Tap + repeat</button><output id="repeat-count">0 actions</output><output id="repeat-state">IDLE · READY</output></section><section class="demo-card"><span class="section-label">04 / STANDALONE ARROWS</span><div class="button-row"><button data-action="arrow-left" aria-label="Standalone left arrow">←</button><output id="arrow-count">0</output><button data-action="arrow-right" aria-label="Standalone right arrow">→</button></div><p class="hint">Работают без карусели.</p></section><section class="demo-card hold-card"><span class="section-label">05 / TAP + HOLD SESSION + REPEAT</span><button id="hold-button" data-action="hold" class="primary large-target">Tap / Hold / Repeat</button><label>Initial Repeat delay <input id="repeat-delay" type="range" min="10" max="25" step="1" value="10"><output id="repeat-delay-value">1.0×</output><small>EXPERIMENTAL · baseline repeatMs; Hold recognition unchanged</small></label><label class="toggle"><input id="availability" type="checkbox" checked> Action availability · READY</label><div class="control-strip"><button data-action="pause-after">Pause at 2.0 s → resume at 4.0 s</button></div><p class="hint">Эта кнопка планирует локальный тест availability перед Hold. После распознавания уход указателя не заканчивает сессию.</p><div class="state-grid"><div><span>ACTIONS / TICKS</span><output id="hold-count">0</output></div><div><span>INTERACTION / AVAILABILITY</span><output id="hold-state">IDLE · READY</output></div><div><span>HOLD / EFFECTIVE RATE</span><output id="hold-time">0 ms · 0 Hz</output></div></div></section></div></div>
<div id="navigation" class="test-panel" hidden></div>
<div id="resize" class="test-panel" hidden><div class="control-strip"><label>Mock width · px<input id="mock-width" type="number" min="240" max="1000" value="520"></label><label>Mock height · px<input id="mock-height" type="number" min="220" max="700" value="350"></label><label>Draft<input id="resize-draft" value="State survives resize"></label></div><div id="resize-surface" class="resize-surface"><div class="mock-world" aria-hidden="true"><span>REFERENCE GRID</span><div></div></div><div id="backdrop" class="backdrop"></div><article id="mock-window" class="mock-window"><header>Functional Bounds <span id="mock-mode"></span></header><div class="mock-body"><div class="mock-preview">Preview<br><span>aspect ratio preserved</span></div><div class="mock-modules">Modules<br><span>Geometry ≠ editor state</span><input id="mock-selection" type="checkbox"><label for="mock-selection">Persist selection</label></div></div><footer><span id="mock-dimensions"></span><button id="resize-handle" aria-label="Изменить размер окна" title="Drag to resize; use numeric inputs on touch">↘</button></footer></article></div><div class="state-grid"><div><span>VIEWPORT</span><output id="actual-viewport"></output></div><div><span>RESIZE LIFECYCLE</span><output id="resize-state">SETTLED</output></div><div><span>FINAL VALIDATION</span><output id="resize-validation">NOT RUN</output></div></div><p class="hint">На узком экране mock-размер ограничен доступной поверхностью. Resize-end: pointerup для ручки; для остальных событий — экспериментальный debounce, браузер не гарантирует resize-end API.</p><output id="mock-feedback" class="hint"></output><div class="preset-row">${[
  [360, 780],
  [375, 812],
  [390, 844],
  [430, 932],
  [1366, 768],
  [1920, 1080],
]
  .map(([w, h]) => `<button data-preset="${w},${h}">${w}×${h}</button>`)
  .join(
    '',
  )}</div><output id="preset-info" class="hint">Presets: только расчёт модели, не эмуляция устройства. Actual viewport всегда первичен.</output></div>
<div id="draft-recovery" class="test-panel" hidden></div>
<footer class="test-footer"><button id="reset-test">Reset test</button><button id="export-report">Export diagnostics JSON ↓</button><span>Никаких сетевых действий</span></footer></section>
<section class="panel telemetry"><div class="telemetry-top"><span class="section-label">GESTURE VISUALIZER</span><label class="toggle"><input id="visualizer-toggle" type="checkbox"> Overlay</label></div><div id="gesture-metrics" class="metrics"></div></section>
<details class="panel results" open><summary>Assertions <span id="result-summary"></span></summary><p class="hint">Наблюдения текущей сессии. PASS появляется только после выполнения; FAIL сохраняется до Reset. Автоматизированные Chromium-проверки записаны отдельно в отчёте проекта.</p><details><summary>Непроверяемый / неопределённый сценарий</summary><div class="control-strip"><label>Case<select id="inconclusive-case">${Object.keys(
  cases,
)
  .map((id) => `<option>${id}</option>`)
  .join(
    '',
  )}</select></label><label>Причина<input id="inconclusive-reason" placeholder="Ограничение устройства / наблюдения"></label><button id="record-inconclusive">Record INCONCLUSIVE</button></div><output id="inconclusive-status" class="hint"></output></details><div id="results-list"></div></details>
<details class="panel event-panel"><summary>Event log <span id="log-count">0 / 150</span></summary><div id="event-log" role="log" aria-label="События взаимодействий"></div></details></main>
<aside class="debug"><details class="panel" id="debug-details" open><summary>Debug Panel <span class="experimental">EXPERIMENTAL</span></summary><p class="hint">Все значения — рабочие гипотезы. Сохраняются в localStorage; Reset возвращает стартовый профиль, не production defaults.</p><div id="environment" class="environment"></div><div class="slop-value"><span>Effective Gesture Slop</span><strong id="effective-slop"></strong><small id="slop-policy"></small></div><label class="toggle"><input id="snapshot-toggle" type="checkbox"> Low-cost live resize presentation</label><div id="config-fields">${Object.entries(
  fields,
)
  .map(
    ([k, [, , max, step, label]]) =>
      `<label>${label}<input data-config="${k}" type="number" min="${fields[k as Key][1]}" max="${max}" step="${step}"></label>`,
  )
  .join(
    '',
  )}</div><div class="debug-buttons"><button id="config-reset">Reset config</button><button id="config-export">Export config</button><button id="config-copy">Copy config</button></div><output id="copy-status"></output></details></aside></div><footer class="site-footer"><span>DKW / UI SYSTEM RESEARCH</span><span>Physical device validation: NOT RUN</span></footer><svg id="gesture-overlay" aria-hidden="true"></svg><div id="safe-probe" aria-hidden="true"></div>`;

function environment() {
  const vv = window.visualViewport;
  const safe = getComputedStyle($('safe-probe'));
  const segments = (window as Window & { getWindowSegments?: () => unknown }).getWindowSegments?.();
  return {
    viewport: {
      width: innerWidth,
      height: innerHeight,
      visual: vv
        ? { width: vv.width, height: vv.height, scale: vv.scale, offsetTop: vv.offsetTop }
        : null,
    },
    devicePixelRatio,
    uiScale: config.uiScale,
    safeInsets: {
      top: safe.paddingTop,
      right: safe.paddingRight,
      bottom: safe.paddingBottom,
      left: safe.paddingLeft,
    },
    orientation: screen.orientation?.type || 'unavailable',
    posture:
      (navigator as Navigator & { devicePosture?: { type: string } }).devicePosture?.type ||
      'unavailable',
    segments: segments || 'unavailable',
    userAgent: navigator.userAgent,
    pointerType: controller?.current?.pointerType || 'not observed',
    nativeSlop: 'not exposed by web platform',
    gestureSlop: {
      baseline: slop(config),
      touch: slop(config, 'touch'),
      touchMultiplier: config.touchSlopMultiplier,
      status: 'EXPERIMENTAL',
    },
    resizeEnd: 'pointerup for handle; debounce fallback for viewport / numeric input',
  };
}
const diag = new Diagnostics(environment, () => ({ ...config }));
const controller = new InteractionController(root, () => config, diag);
const eventGuide = new EventGuide(
  $('navigation'),
  controller,
  () => config,
  diag,
  (page) => {
    model.page = page;
  },
);
const draftLab = new DraftLab($('draft-recovery'), controller, () => config, diag);
let carouselCleanup: (() => void)[] = [];
let activePanel = '';
let geometryState: Geometry | undefined;
let uiFrame = 0,
  geometryFrame = 0,
  settleTimer = 0,
  mockFrame = 0,
  mockSettle = 0,
  holdDisplayFrame = 0;
let pauseTimers: number[] = [];
let resizeSnapshot = '';
let oldScroll = 0;
const snapshot = () =>
  JSON.stringify({
    selections: model.selections,
    draft: model.draft,
    step: model.step,
    page: model.page,
    resizeDraft: ($('resize-draft') as HTMLInputElement).value,
    selection: ($('mock-selection') as HTMLInputElement).checked,
  });
const htmlEscape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
function queueUI() {
  if (!uiFrame)
    uiFrame = requestAnimationFrame(() => {
      uiFrame = 0;
      renderUI();
    });
}
diag.onChange = queueUI;
controller.onChange = queueUI;
function register(
  id: string,
  run: () => void,
  hold = false,
  available?: () => boolean,
  releasePolicy?: 'geometry',
) {
  controller.register(id, {
    run: () => {
      run();
      queueUI();
    },
    hold,
    available,
    releasePolicy,
    repeatDelay: id === 'repeat' || id === 'hold',
  });
}
register('release', () => model.actionCount++, false, undefined, 'geometry');
register('lab-release', () => model.actionCount++, false, undefined, 'geometry');
register('basic', () => model.basicCount++);
register('repeat', () => model.repeatCount++, true);
register(
  'hold',
  () => model.holdCount++,
  true,
  () => model.ready,
);
register(
  'minus',
  () => {
    model.step = Math.max(model.min, model.step - 1);
    syncSteps();
  },
  true,
  () => model.step > model.min,
);
register(
  'plus',
  () => {
    model.step = Math.min(model.max, model.step + 1);
    syncSteps();
  },
  true,
  () => model.step < model.max,
);
register('arrow-left', () => model.arrow--);
register('arrow-right', () => model.arrow++);
register('clear-selection', () => {
  model.selections = {};
  renderSelections();
});
register('pause-after', () => {
  pauseTimers.forEach(clearTimeout);
  pauseTimers = [
    window.setTimeout(() => setAvailability(false), 2000),
    window.setTimeout(() => setAvailability(true), 4000),
  ];
  diag.log('availability-test-scheduled', { pauseAfterMs: 2000, resumeAfterMs: 4000 });
});
function setAvailability(yes: boolean) {
  model.ready = yes;
  ($('availability') as HTMLInputElement).checked = yes;
  diag.log('availability-change', {
    availability: yes ? 'READY' : 'WAITING',
    interaction: controller.status('hold').interaction,
  });
  queueUI();
}
$('repeat-delay').addEventListener('input', (e) => {
  config = sanitize({ ...config, repeatDelayTenths: +(e.target as HTMLInputElement).value });
  applyConfig();
});
$('availability').addEventListener('change', (e) =>
  setAvailability((e.target as HTMLInputElement).checked),
);
function syncSteps() {
  ($('step-value') as HTMLInputElement).value = String(model.step);
  $('step-display').textContent = String(model.step);
  $('minus').setAttribute(
    'aria-disabled',
    String(model.step <= model.min && controller.active?.button !== $('minus')),
  );
  $('plus').setAttribute(
    'aria-disabled',
    String(model.step >= model.max && controller.active?.button !== $('plus')),
  );
}
for (const [id, key] of [
  ['step-min', 'min'],
  ['step-max', 'max'],
  ['step-value', 'step'],
] as const)
  $(id).addEventListener('change', (e) => {
    const v = +(e.target as HTMLInputElement).value;
    if (!Number.isFinite(v)) return;
    model[key] = v;
    model.max = Math.max(model.min, model.max);
    model.step = clamp(model.step, model.min, model.max);
    ($('step-max') as HTMLInputElement).value = String(model.max);
    syncSteps();
    queueUI();
  });
function openPanel(id: string) {
  controller.end(true, 'test-window navigation');
  eventGuide.suspend();
  activePanel = id;
  if (id === 'navigation') void eventGuide.open();
  if (id === 'draft-recovery') void draftLab.open();
  const p = panels.find((p) => p[0] === id)!;
  $('home').hidden = true;
  $('test-shell').hidden = false;
  for (const [pid] of panels) $(pid).hidden = pid !== id;
  $('test-title').textContent = p[3];
  $('instructions').textContent = p[4];
  $('test-code').textContent = `TEST WINDOW / ${p[2]}`;
  document
    .querySelectorAll<HTMLElement>('[data-open]')
    .forEach((b) => b.setAttribute('aria-current', b.dataset.open === id ? 'page' : 'false'));
  diag.log('test-window-open', { id });
  queueGeometry();
  queueMock();
  queueUI();
  $('test-title').tabIndex = -1;
  $('test-title').focus({ preventScroll: true });
}
document.querySelectorAll<HTMLElement>('[data-open]').forEach((b) => {
  const id = 'open-' + b.dataset.open;
  b.dataset.action = id;
  controller.register(id, { run: () => openPanel(b.dataset.open!), instrument: false });
});
function closePanel() {
  eventGuide.suspend();
  controller.end(true, 'test-window closed');
  $('test-shell').hidden = true;
  $('home').hidden = false;
  for (const [id] of panels) $(id).hidden = true;
  activePanel = '';
  document.querySelectorAll('[data-open]').forEach((b) => b.setAttribute('aria-current', 'false'));
  $('home').tabIndex = -1;
  $('home').focus({ preventScroll: true });
}
bindModuleStrip(root.querySelector<HTMLElement>('.index nav')!, () => config, openPanel);
$('back-index').onclick = closePanel;
$('close-test').onclick = closePanel;
function renderModules() {
  controller.end(true, 'module content changed');
  carouselCleanup.forEach((fn) => fn());
  carouselCleanup = [];
  $('modules').innerHTML = Array.from(
    { length: model.count },
    (_, i) =>
      `<section class="module-row"><div class="module-title"><strong>Module ${String(i + 1).padStart(2, '0')}</strong><span id="selected-${i}">None</span></div><div class="carousel-shell"><button class="carousel-arrow left" data-action="left-${i}" aria-label="Module ${i + 1} left">❮</button><button class="carousel-arrow right" data-action="right-${i}" aria-label="Module ${i + 1} right">❯</button><div class="carousel" id="carousel-${i}" data-row="${i}" aria-label="Carousel ${i + 1}"><div class="carousel-track">${Array.from({ length: model.cards }, (_, j) => `<button class="selection-card" data-pressed="false" data-dragging="false" data-hovered="false" data-card="${j === 0 ? 'None' : `Option ${j}`}" aria-label="Module ${i + 1}: ${j === 0 ? 'None' : `Option ${j}`}" aria-pressed="false"><span class="card-thumbnail ${j === 0 ? 'none-mark' : ''}">${j === 0 ? '×' : String(j).padStart(2, '0')}</span><span>${j === 0 ? 'None' : `Option ${j}`}</span></button>`).join('')}</div></div></div></section>`,
  ).join('');
  for (let i = 0; i < model.count; i++) {
    const el = $(`carousel-${i}`);
    carouselCleanup.push(
      bindCarousel(
        el,
        document.querySelector<HTMLButtonElement>('[data-action="left-' + i + '"]')!,
        document.querySelector<HTMLButtonElement>('[data-action="right-' + i + '"]')!,
        controller,
        () => config,
      ),
    );
    el.addEventListener('card-select', (e) => {
      const value = (e as CustomEvent).detail.value;
      select(i, value, 'pointer');
    });
    el.addEventListener('click', (e) => {
      const card = (e.target as Element).closest<HTMLElement>('[data-card]');
      if (card && e.detail === 0) select(i, card.dataset.card!, 'keyboard / assistive');
    });
  }
  renderSelections();
  queueGeometry();
}
function select(i: number, value: string, source: string) {
  model.selections[i] = value;
  renderSelections();
  diag.log('card-selected', {
    module: i + 1,
    value,
    source,
    pointerType: controller.current?.pointerType,
  });
}
function renderSelections() {
  for (let i = 0; i < model.count; i++) {
    $(`selected-${i}`).textContent = model.selections[i] || 'None';
    $(`carousel-${i}`)
      .querySelectorAll<HTMLElement>('[data-card]')
      .forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.card === (model.selections[i] || 'None'))),
      );
  }
  $('selection-summary').textContent =
    `${Object.values(model.selections).filter((v) => v !== 'None').length} selected · ${model.draft}`;
}
for (const [id, key, lo, hi] of [
  ['module-count', 'count', 1, 30],
  ['card-count', 'cards', 1, 30],
] as const)
  $(id).addEventListener('change', (e) => {
    model[key] = Math.round(clamp(+(e.target as HTMLInputElement).value || lo, lo, hi));
    (e.target as HTMLInputElement).value = String(model[key]);
    renderModules();
  });
$('draft').addEventListener('input', (e) => {
  model.draft = (e.target as HTMLInputElement).value;
  renderSelections();
});
function queueGeometry() {
  if (activePanel !== 'carousel') return;
  if (!resizeSnapshot) {
    resizeSnapshot = snapshot();
    oldScroll = $('modules').scrollTop;
  }
  $('workspace').dataset.resize = 'live';
  if (!geometryFrame)
    geometryFrame = requestAnimationFrame(() => {
      geometryFrame = 0;
      applyGeometry();
    });
  clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    applyGeometry();
    $('workspace').dataset.resize = 'settled';
    const scroll = $('modules').scrollTop,
      canPreserve = oldScroll <= $('modules').scrollHeight - $('modules').clientHeight;
    diag.check(
      'RESIZE-STATE',
      snapshot() === resizeSnapshot && (!canPreserve || Math.abs(scroll - oldScroll) <= 1),
      'editor state unchanged; scroll preserved where possible',
      {
        stateUnchanged: snapshot() === resizeSnapshot,
        scrollBefore: oldScroll,
        scrollAfter: scroll,
        scrollClamped: !canPreserve,
      },
    );
    resizeSnapshot = '';
    queueUI();
  }, config.settleMs);
}
function applyGeometry() {
  if (activePanel !== 'carousel') return;
  const r = $('workspace-host').getBoundingClientRect();
  geometryState = geometry(r.width, r.height, model.count, config, geometryState?.layout);
  const g = geometryState,
    win = $('workspace');
  win.style.width = `${g.width}px`;
  win.style.height = `${g.height}px`;
  win.dataset.layout = g.side ? 'side' : 'stack';
  win.style.setProperty('--preview-height', `${g.preview}px`);
  win.style.setProperty('--modules-height', `${g.modules}px`);
  win.style.setProperty('--header-height', `${config.headerHeight}px`);
  win.style.setProperty(
    '--actions-height',
    `${Math.max(config.actionsHeight, 44 * config.uiScale + 8)}px`,
  );
  $('preview-content').style.width = `${280 * g.contentScale}px`;
  $('preview-content').style.height = `${180 * g.contentScale}px`;
  $('geometry-label').textContent = `${g.layout} · ${Math.round(g.width)}×${Math.round(g.height)}`;
  win.setAttribute(
    'aria-label',
    `${g.stage}${g.pressure ? ' · pressure: preview reduced, outer page scroll available' : ''}`,
  );
  queueUI();
}
function queueMock() {
  if (activePanel !== 'resize') return;
  $('resize-state').textContent = 'LIVE RESIZE';
  $('resize-surface').dataset.resize = 'live';
  if (!mockFrame)
    mockFrame = requestAnimationFrame(() => {
      mockFrame = 0;
      applyMock(true);
    });
  clearTimeout(mockSettle);
  if (!resizeDrag) mockSettle = window.setTimeout(settleMock, config.settleMs);
}
let mockSnapshot = '';
function applyMock(live: boolean) {
  const surface = $('resize-surface').getBoundingClientRect();
  if (surface.width === 0) return;
  const w = clamp(model.mockW, Math.min(240, surface.width - 24), surface.width - 24),
    h = clamp(model.mockH, 220, surface.height - 24);
  const old = model.mockMode;
  const orientation = screen.orientation?.type?.startsWith('landscape')
    ? 'H'
    : screen.orientation?.type?.startsWith('portrait')
      ? 'V'
      : undefined;
  model.mockMode = orientationMode(w, h, old, config, orientation);
  if (old && w / h > config.ratioEnterV && w / h < config.ratioEnterH)
    diag.check('RESIZE-HYST', model.mockMode === old, 'mode preserved inside band', {
      before: old,
      after: model.mockMode,
      ratio: w / h,
    });
  const win = $('mock-window');
  win.style.width = `${w}px`;
  win.style.height = `${h}px`;
  win.dataset.mode = model.mockMode;
  $('mock-mode').textContent = model.mockMode === 'H' ? 'H · Horizontal' : 'V · Vertical';
  $('mock-dimensions').textContent = 'Applied ' + Math.round(w) + ' × ' + Math.round(h);
  $('mock-feedback').textContent =
    'Requested ' +
    model.mockW +
    ' × ' +
    model.mockH +
    ' · Applied ' +
    Math.round(w) +
    ' × ' +
    Math.round(h) +
    ' · ' +
    (w !== model.mockW || h !== model.mockH ? 'CLAMPED by available surface' : 'unclamped') +
    ' · actual viewport ' +
    innerWidth +
    ' × ' +
    innerHeight;
  // Measure the regular composition consistently before choosing compact presentation.
  win.dataset.compact = 'false';
  // Content-driven pressure, not a hard-coded Modules minimum.
  const modules = win.querySelector<HTMLElement>('.mock-modules')!;
  const ms = getComputedStyle(modules),
    bs = getComputedStyle(win.querySelector('.mock-body')!);
  const needed =
    [...modules.children].reduce((sum, child) => sum + child.getBoundingClientRect().height, 0) +
    Math.max(0, modules.children.length - 1) * parseFloat(ms.rowGap) +
    parseFloat(ms.paddingTop) +
    parseFloat(ms.paddingBottom);
  const bodySpace =
    h -
    win.querySelector('header')!.getBoundingClientRect().height -
    win.querySelector('footer')!.getBoundingClientRect().height -
    parseFloat(bs.paddingTop) -
    parseFloat(bs.paddingBottom);
  win.dataset.compact = String(bodySpace < needed);

  const lowCost = live && config.snapshot;
  $('backdrop').style.backdropFilter = `blur(${lowCost ? 0 : config.blur}px)`;
  $('backdrop').style.backgroundColor = `rgba(8,12,16,${config.dim})`;
  $('resize-surface').dataset.snapshot = String(lowCost);
  $('actual-viewport').textContent = `${innerWidth} × ${innerHeight}`;
  if (live)
    diag.check(
      'RESIZE-LIVE',
      Math.abs(win.getBoundingClientRect().width - w) < 1,
      'geometry applied during live resize',
      { width: win.getBoundingClientRect().width, expected: w, lowCost },
    );
}
function settleMock() {
  if (activePanel !== 'resize') return;
  applyMock(false);
  $('resize-state').textContent = 'SETTLED';
  $('resize-surface').dataset.resize = 'settled';
  const r = $('mock-window').getBoundingClientRect(),
    s = $('resize-surface').getBoundingClientRect();
  const valid =
    r.left >= s.left && r.top >= s.top && r.right <= s.right + 1 && r.bottom <= s.bottom + 1;
  $('resize-validation').textContent = valid ? 'PASS' : 'FAIL';
  diag.check('RESIZE-SETTLE', valid, 'functional window inside demo surface', {
    width: r.width,
    height: r.height,
    inside: valid,
  });
  // Read final effects when restoration actually finishes, not after an assumed delay.
  checkBackdrop();
  if (mockSnapshot) {
    diag.check(
      'RESIZE-STATE',
      snapshot() === mockSnapshot,
      'editor state preserved',
      snapshot() === mockSnapshot,
    );
    mockSnapshot = '';
  }
  queueUI();
}
let backdropCheck = 0;
function checkBackdrop() {
  const check = ++backdropCheck;
  requestAnimationFrame(async () => {
    if (check !== backdropCheck) return;
    if (activePanel !== 'resize' || $('resize-surface').dataset.resize !== 'settled') return;
    if (!CSS.supports('backdrop-filter', 'blur(1px)')) {
      diag.inconclusive('BACKDROP', 'backdrop-filter unsupported', 'runtime platform support');
      return;
    }
    const backdrop = $('backdrop');
    // Flush styles so CSS transitions exist before collecting their completion promises.
    void getComputedStyle(backdrop).backdropFilter;
    await Promise.allSettled(backdrop.getAnimations().map((animation) => animation.finished));
    if (check !== backdropCheck) return;
    if (activePanel !== 'resize' || $('resize-surface').dataset.resize !== 'settled') return;
    const style = getComputedStyle(backdrop),
      alpha = style.backgroundColor.startsWith('rgba')
        ? Number(style.backgroundColor.split(',').at(-1)?.replace(')', ''))
        : 1;
    diag.check(
      'BACKDROP',
      style.backdropFilter === `blur(${config.blur}px)` && Math.abs(alpha - config.dim) < 0.001,
      'configured blur and dim applied',
      { blur: style.backdropFilter, dim: alpha },
    );
  });
}
for (const [id, key] of [
  ['mock-width', 'mockW'],
  ['mock-height', 'mockH'],
] as const)
  $(id).addEventListener('input', (e) => {
    if (!mockSnapshot) mockSnapshot = snapshot();
    const v = +(e.target as HTMLInputElement).value;
    if (Number.isFinite(v) && v > 0) {
      model[key] = v;
      queueMock();
    }
  });
let resizeDrag: { id: number; x: number; y: number; w: number; h: number } | null = null;
$('resize-handle').addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || resizeDrag) return;
  e.preventDefault();
  const r = $('mock-window').getBoundingClientRect();
  resizeDrag = { id: e.pointerId, x: e.clientX, y: e.clientY, w: r.width, h: r.height };
  mockSnapshot = snapshot();
  $('resize-handle').setPointerCapture(e.pointerId);
  queueMock();
  diag.log('mock-resize-start', { pointerType: e.pointerType });
});
window.addEventListener('pointermove', (e) => {
  if (!resizeDrag || e.pointerId !== resizeDrag.id) return;
  model.mockW = clamp(resizeDrag.w + e.clientX - resizeDrag.x, 240, 1000);
  model.mockH = clamp(resizeDrag.h + e.clientY - resizeDrag.y, 220, 700);
  ($('mock-width') as HTMLInputElement).value = String(Math.round(model.mockW));
  ($('mock-height') as HTMLInputElement).value = String(Math.round(model.mockH));
  queueMock();
});
function endResize(e: PointerEvent) {
  if (resizeDrag?.id !== e.pointerId) return;
  resizeDrag = null;
  clearTimeout(mockSettle);
  if (mockFrame) {
    cancelAnimationFrame(mockFrame);
    mockFrame = 0;
  }
  settleMock();
  diag.log('mock-resize-end', { event: e.type, pointerType: e.pointerType });
}
window.addEventListener('pointerup', endResize);
window.addEventListener('pointercancel', endResize);
$('resize-handle').addEventListener('lostpointercapture', endResize);
document.querySelectorAll<HTMLElement>('[data-preset]').forEach(
  (b) =>
    (b.onclick = () => {
      const [w, h] = b.dataset.preset!.split(',').map(Number),
        g = geometry(w, h, model.count, config);
      $('preset-info').textContent =
        `Model preset ${w}×${h}: ${g.layout}, window ${Math.round(g.width)}×${Math.round(g.height)}, ${g.stage}. Simulated geometry only; actual viewport ${innerWidth}×${innerHeight}.`;
      diag.log('geometry-preset', { simulated: true, viewport: [w, h], geometry: g });
    }),
);
function applyConfig() {
  ($('repeat-delay') as HTMLInputElement).value = String(config.repeatDelayTenths);
  $('repeat-delay-value').textContent = (config.repeatDelayTenths / 10).toFixed(1) + '×';
  window.dispatchEvent(new Event('dkw-config-change'));
  for (const [key] of Object.entries(fields)) {
    const input = document.querySelector<HTMLInputElement>(`[data-config="${key}"]`)!;
    input.value = String(config[key as Key]);
  }
  ($('visualizer-toggle') as HTMLInputElement).checked = config.visualizer;
  ($('snapshot-toggle') as HTMLInputElement).checked = config.snapshot;
  root.style.setProperty('--press-depth', `${config.pressDepth}px`);
  root.style.setProperty('--press-brightness', String(1 - config.darkening));
  root.style.setProperty('--press-duration', `${config.pressDuration}ms`);
  root.style.setProperty('--press-shadow', config.shadow ? 'none' : '0 3px 0 #070b0e');
  root.style.setProperty('--decoration-budget', `${config.decorationBudget}px`);
  root.style.setProperty('--ui-scale', String(config.uiScale));
  root.style.setProperty('--module-title-height', `${Math.max(46, 44 * config.uiScale + 2)}px`);
  root.style.setProperty('--module-row-height', `${Math.max(46, 44 * config.uiScale + 2) + 108}px`);
  try {
    localStorage.setItem('dkw-lab-v1', JSON.stringify(config));
  } catch {
    $('copy-status').textContent = 'localStorage unavailable: session-only settings';
  }
  queueGeometry();
  queueMock();
  queueUI();
}
document.querySelectorAll<HTMLInputElement>('[data-config]').forEach((input) =>
  input.addEventListener('change', () => {
    config = sanitize({ ...config, [input.dataset.config!]: Number(input.value) });
    applyConfig();
    diag.log('parameter-change', {
      key: input.dataset.config,
      value: input.value,
      status: 'EXPERIMENTAL',
    });
  }),
);
$('visualizer-toggle').onchange = () => {
  config.visualizer = ($('visualizer-toggle') as HTMLInputElement).checked;
  applyConfig();
};
$('snapshot-toggle').onchange = () => {
  config.snapshot = ($('snapshot-toggle') as HTMLInputElement).checked;
  applyConfig();
};
$('config-reset').onclick = () => {
  controller.end(true, 'config reset');
  config = defaults();
  applyConfig();
};
$('config-export').onclick = () =>
  download('dkw-lab-config.json', {
    schema: 'dkw-lab-config/1',
    status: 'EXPERIMENTAL',
    parameters: config,
  });
$('config-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    $('copy-status').textContent = 'Config copied';
  } catch {
    $('copy-status').textContent = 'Clipboard unavailable. Используйте Export config.';
  }
};
$('export-report').onclick = () => download('dkw-lab-diagnostics.json', diag.report());
$('record-inconclusive').onclick = () => {
  const id = ($('inconclusive-case') as HTMLSelectElement).value,
    reason = ($('inconclusive-reason') as HTMLInputElement).value.trim();
  $('inconclusive-status').textContent = !reason
    ? 'Укажите причину неопределённости.'
    : diag.inconclusive(id, reason)
      ? 'INCONCLUSIVE записан.'
      : 'Наблюдаемый PASS / FAIL нельзя заменить этим способом. Используйте Reset для новой сессии.';
};
$('reset-test').onclick = () => {
  if (activePanel === 'navigation') {
    void eventGuide.reset();
    return;
  }
  if (activePanel === 'resize') {
    controller.end(true, 'module 05 reset');
    cancelAnimationFrame(mockFrame);
    mockFrame = 0;
    clearTimeout(mockSettle);
    ++backdropCheck;
    mockSnapshot = '';
    if (resizeDrag && $('resize-handle').hasPointerCapture(resizeDrag.id))
      $('resize-handle').releasePointerCapture(resizeDrag.id);
    resizeDrag = null;
    model.mockW = 520;
    model.mockH = 350;
    model.mockMode = null;
    ($('mock-width') as HTMLInputElement).value = '520';
    ($('mock-height') as HTMLInputElement).value = '350';
    ($('resize-draft') as HTMLInputElement).value = 'State survives resize';
    ($('mock-selection') as HTMLInputElement).checked = false;
    $('preset-info').textContent =
      'Presets: simulated model only; actual viewport remains unchanged.';
    settleMock();
    diag.log('module-05-reset', { otherModulesUnchanged: true });
    return;
  }
  if (activePanel === 'draft-recovery') {
    draftLab.requestCleanup();
    return;
  }
  controller.end(true, 'test reset');
  pauseTimers.forEach(clearTimeout);
  model.actionCount = model.basicCount = model.repeatCount = model.holdCount = model.arrow = 0;
  model.step = clamp(5, model.min, model.max);
  model.selections = {};
  setAvailability(true);
  controller.counts.clear();
  diag.reset();
  syncSteps();
  renderSelections();
  queueUI();
};
function renderUI() {
  $('action-count').textContent = String(model.actionCount);
  $('lab-count').textContent = String(model.actionCount);
  $('basic-count').textContent = `${model.basicCount} actions`;
  $('repeat-count').textContent = `${model.repeatCount} actions`;
  $('arrow-count').textContent = String(model.arrow);
  $('hold-count').textContent = String(model.holdCount);
  $('release-state').textContent = controller.status('release').interaction;
  for (const id of ['hold', 'repeat']) {
    const st = controller.status(id);
    $(`${id}-state`).textContent = `${st.interaction} · ${st.availability}`;
    $(`${id}-button`).setAttribute('data-available', String(st.availability === 'READY'));
    if (id === 'hold')
      $('hold-time').textContent =
        `${Math.round(st.duration)} ms · ${st.duration > 0 ? ((Math.max(0, st.ticks - 1) * 1000) / Math.max(1, st.duration)).toFixed(1) : '0'} Hz (observed)`;
  }
  syncSteps();
  for (let i = 0; i < model.count; i++) {
    const el = $(`carousel-${i}`);
    document
      .querySelector(`[data-action="left-${i}"]`)
      ?.setAttribute('aria-disabled', String(el.scrollLeft <= 1));
    document
      .querySelector(`[data-action="right-${i}"]`)
      ?.setAttribute('aria-disabled', String(el.scrollLeft >= el.scrollWidth - el.clientWidth - 1));
  }
  const v = controller.current;
  const metrics = v
    ? {
        pointer: `${v.pointerType} #${v.id}`,
        start: `${v.startX.toFixed(1)}, ${v.startY.toFixed(1)}`,
        current: `${v.x.toFixed(1)}, ${v.y.toFixed(1)}`,
        delta: `dx ${v.dx.toFixed(1)} · dy ${v.dy.toFixed(1)}`,
        abs: `|X| ${Math.abs(v.dx).toFixed(1)} · |Y| ${Math.abs(v.dy).toFixed(1)}`,
        distance: `${v.distance.toFixed(2)} px`,
        phase: v.phase,
        owner: v.owner,
        tap: v.valid ? 'VALID' : 'CANCELLED',
      }
    : { pointer: 'not observed', phase: 'IDLE', owner: 'NONE', tap: 'NOT RUN' };
  $('gesture-metrics').innerHTML = Object.entries(metrics)
    .map(([k, val]) => `<div><span>${k}</span><output>${htmlEscape(val)}</output></div>`)
    .join('');
  $('effective-slop').textContent = `${slop(config, v?.pointerType).toFixed(2)} px`;
  $('slop-policy').textContent =
    `Mouse / pen / other ${slop(config).toFixed(2)} px · Touch ${slop(config, 'touch').toFixed(2)} px ×${config.touchSlopMultiplier} · EXPERIMENTAL · UI-relative fallback, native threshold недоступен`;
  $('environment').textContent =
    `Viewport ${innerWidth} × ${innerHeight} · DPR ${devicePixelRatio}\nUI scale ${config.uiScale} · unit ${config.referenceUnit}px\n${geometryState ? `${geometryState.layout} · ${geometryState.stage}` : 'Geometry awaits lab window'}`;
  const rows = Object.values(diag.results);
  $('results-list').innerHTML = rows
    .map(
      (r) =>
        `<div class="assertion"><code>${r.id}</code><span>${r.description}</span><b class="status ${r.status.toLowerCase().replace(' ', '-')}">${r.status}</b></div>`,
    )
    .join('');
  $('result-summary').textContent =
    `${rows.filter((r) => r.status === 'PASS').length} PASS · ${rows.filter((r) => r.status === 'FAIL').length} FAIL · ${rows.filter((r) => r.status === 'NOT RUN').length} NOT RUN`;
  $('log-count').textContent = `${diag.events.length} / 150`;
  $('event-log').innerHTML = diag.events
    .slice(-40)
    .reverse()
    .map(
      (e) =>
        `<div><time>${String(e.time).slice(11, 23)}</time><strong>${htmlEscape(e.type)}</strong><code>${htmlEscape(JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['time', 'parameters', 'type'].includes(k)))))}</code></div>`,
    )
    .join('');
  const overlay = $('gesture-overlay') as unknown as SVGSVGElement;
  overlay.style.display = config.visualizer && v ? 'block' : 'none';
  if (v) {
    overlay.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
    overlay.innerHTML = `<polyline points="${v.path.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#8fc6b9" stroke-width="2"/><circle cx="${v.startX}" cy="${v.startY}" r="${v.slop}" fill="#84b9b522" stroke="#8fc6b9" stroke-dasharray="3 3"/><circle cx="${v.startX}" cy="${v.startY}" r="3" fill="#fff"/><circle cx="${v.x}" cy="${v.y}" r="5" fill="${v.valid ? '#84d6b6' : '#e8ac68'}"/>`;
  }
  if (controller.active?.holding && !holdDisplayFrame)
    holdDisplayFrame = requestAnimationFrame(() => {
      holdDisplayFrame = 0;
      queueUI();
    });
}
new ResizeObserver(() => {
  queueGeometry();
  queueMock();
}).observe($('workspace-host'));
new ResizeObserver(queueMock).observe($('resize-surface'));
function viewportChanged() {
  queueGeometry();
  queueMock();
  queueUI();
}
window.addEventListener('resize', viewportChanged);
window.visualViewport?.addEventListener('resize', viewportChanged);
window.visualViewport?.addEventListener('scroll', viewportChanged);
screen.orientation?.addEventListener('change', viewportChanged);
(navigator as Navigator & { devicePosture?: EventTarget }).devicePosture?.addEventListener(
  'change',
  viewportChanged,
);
if (innerWidth < 800) ($('debug-details') as HTMLDetailsElement).open = false;
// Existing utility actions also use Strict Tap; keep keyboard activation via controller.
root
  .querySelectorAll<HTMLButtonElement>(
    'button:not([data-action]):not(.selection-card):not(#resize-handle)',
  )
  .forEach((b) => {
    const handler = b.onclick;
    if (!handler) return;
    const id = b.id || 'preset-' + b.dataset.preset;
    b.dataset.action = id;
    b.onclick = null;
    controller.register(id, {
      run: () => handler.call(b, new PointerEvent('click', { detail: 0 })),
      instrument: false,
    });
  });
renderModules();
syncSteps();
applyConfig();
renderUI();
