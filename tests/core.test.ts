import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaults, sanitize, slop, repeatInterval } from '../src/config.ts';
import { geometry, orientationMode, layoutClass } from '../src/geometry.ts';
import { Diagnostics } from '../src/diagnostics.ts';
test('UI-relative slop follows scale, ratio and clamps', () => {
  const c = defaults();
  assert.equal(slop(c), 7.68);
  c.uiScale = 1.5;
  assert.equal(slop(c), 11.52);
  c.slopRatio = 1;
  assert.equal(slop(c), 18);
  c.slopRatio = 0.001;
  assert.equal(slop(c), 4);
});
test('invalid persisted parameters cannot corrupt constraints', () => {
  const c = sanitize({
    slopMin: 20,
    slopMax: 4,
    previewMin: 190,
    previewPreferred: 90,
    previewMax: 100,
    cr1: 4,
    cr2: 1,
    holdDelay: NaN,
  });
  assert.equal(c.slopMax, 20);
  assert.equal(c.previewPreferred, 190);
  assert.equal(c.previewMax, 190);
  assert.equal(c.cr2, 4);
  assert.equal(c.holdDelay, 450);
});
test('experimental touch coefficient adds 25 percent; other pointer thresholds stay unchanged', () => {
  const c = defaults();
  assert.equal(c.touchSlopMultiplier, 1.25);
  assert.equal(slop(c, 'touch'), 9.6);
  for (const type of ['mouse', 'pen', '', 'unknown']) assert.equal(slop(c, type), 7.68);
  c.uiScale = 1.5;
  assert.ok(Math.abs(slop(c, 'touch') - 14.4) < 1e-12);
  assert.equal(slop(c, 'mouse'), 11.52);
});
test('touch Slop keeps the original clamps and remains adjustable', () => {
  const c = defaults();
  c.slopRatio = 1;
  assert.equal(slop(c, 'touch'), 18);
  c.slopRatio = 0.001;
  assert.equal(slop(c, 'touch'), 4);
  c.slopRatio = 0.16;
  c.touchSlopMultiplier = 1;
  assert.equal(slop(c, 'touch'), slop(c, 'mouse'));
  c.touchSlopMultiplier = 1.5;
  assert.equal(slop(c, 'touch'), 11.52);
});
test('older persisted settings gain only the touch coefficient and retain custom tuning', () => {
  const legacy = {
    slopRatio: 0.2,
    slopMin: 3,
    slopMax: 20,
    holdDelay: 720,
    inertia: 0.7,
    pressDepth: 3,
    visualizer: false,
    snapshot: false,
  };
  const c = sanitize(legacy);
  assert.equal(c.touchSlopMultiplier, 1.25);
  for (const [key, value] of Object.entries(legacy)) assert.equal(c[key as keyof typeof c], value);
  assert.equal(sanitize({ ...legacy, touchSlopMultiplier: 100 }).touchSlopMultiplier, 3);
  assert.equal(sanitize({ ...legacy, touchSlopMultiplier: -1 }).touchSlopMultiplier, 0.5);
});
test('repeat accelerates gradually and never exceeds the max rate', () => {
  const c = defaults();
  assert.equal(repeatInterval(0, c), 240);
  assert.ok(repeatInterval(1000, c) < repeatInterval(0, c));
  for (const ms of [0, 500, 1000, 10000, 1e9]) assert.ok(1000 / repeatInterval(ms, c) <= c.maxRate);
});
test('zero acceleration remains constant; maximum rate also caps initial cadence', () => {
  const c = defaults();
  c.acceleration = 0;
  assert.equal(repeatInterval(5000, c), 240);
  c.maxRate = 2;
  assert.equal(repeatInterval(0, c), 500);
});
test('geometry respects ceilings and intrinsic content ratio at all presets', () => {
  const c = defaults();
  for (const [w, h] of [
    [360, 780],
    [375, 812],
    [390, 844],
    [430, 932],
    [1366, 768],
    [1920, 1080],
    [360, 2000],
    [375, 400],
  ]) {
    const g = geometry(w, h, 30, c);
    assert.ok(g.width <= w);
    assert.ok(g.height <= h);
    assert.ok(g.height <= c.windowMaxHeight);
    assert.ok(g.width <= c.windowMaxWidth);
    assert.ok(g.contentScale <= c.previewScaleMax);
    assert.ok(g.modules >= 0 && g.preview >= 0);
  }
});
test('narrow tall geometry stays mobile, stops growing and leaves external room', () => {
  const c = defaults(),
    g = geometry(360, 2000, 30, c);
  assert.equal(g.layout, 'Mobile');
  assert.equal(g.side, false);
  assert.ok(g.height <= 780);
  assert.ok(g.height < 2000);
});
test('one carousel does not stretch modules to fill the viewport', () => {
  const c = defaults(),
    g = geometry(390, 1200, 1, c);
  assert.ok(g.modules <= 170);
  assert.ok(g.height < 600);
});
test('30 carousels have bounded viewport and overflow', () => {
  const c = defaults(),
    g = geometry(390, 844, 30, c);
  assert.ok(g.modules < 30 * 154);
  assert.ok(g.modules / g.preview <= c.cr2 + 1e-6);
});
test('width limits useful preview growth', () => {
  const c = defaults(),
    a = geometry(360, 1500, 8, c),
    b = geometry(430, 1500, 8, c);
  assert.ok(a.preview <= b.preview);
  assert.ok(a.contentScale <= b.contentScale);
});
test('structural hysteresis uses different enter and exit boundaries', () => {
  const c = defaults();
  assert.equal(layoutClass(770, 700, c, 'Medium'), 'Medium');
  assert.equal(layoutClass(790, 700, c, 'Medium'), 'Expanded');
  assert.equal(layoutClass(750, 700, c, 'Expanded'), 'Expanded');
  assert.equal(layoutClass(730, 700, c, 'Expanded'), 'Medium');
});
test('height participates in side composition', () => {
  const c = defaults();
  assert.equal(geometry(1200, 280, 8, c).side, false);
  assert.equal(geometry(1200, 700, 8, c).side, true);
});
test('H/V orientation preserves previous mode in band', () => {
  const c = defaults();
  assert.equal(orientationMode(100, 100, 'H', c, 'V'), 'H');
  assert.equal(orientationMode(100, 100, 'V', c, 'H'), 'V');
  assert.equal(orientationMode(80, 100, 'H', c), 'V');
  assert.equal(orientationMode(120, 100, 'V', c), 'H');
});
test('first ambiguous orientation uses reliable orientation then deterministic fallback', () => {
  const c = defaults();
  assert.equal(orientationMode(100, 100, null, c, 'H'), 'H');
  assert.equal(orientationMode(100, 100, null, c), 'V');
});
test('under pressure, interactive Modules take precedence over Preview', () => {
  const c = defaults();
  c.windowMaxHeight = 320;
  c.headerHeight = 100;
  c.actionsHeight = 100;
  c.previewMin = 200;
  c.modulesMin = 300;
  c.uiScale = 1.5;
  const g = geometry(360, 400, 30, c);
  assert.ok(g.pressure);
  assert.ok(g.modules >= 66);
  assert.ok(g.preview < c.previewMin);
  assert.ok(g.height <= 320);
});
test('diagnostic failure keeps its failing evidence until explicit Reset', () => {
  const d = new Diagnostics(
    () => ({ runtime: 'unit' }),
    () => ({ experimental: true }),
  );
  assert.ok(Object.values(d.results).every((r) => r.status === 'NOT RUN'));
  d.check('BTN-UP', false, 1, 2);
  d.check('BTN-UP', true, 1, 1);
  assert.equal(d.results['BTN-UP'].status, 'FAIL');
  assert.equal(d.results['BTN-UP'].observed, 2);
  d.reset();
  assert.equal(d.results['BTN-UP'].status, 'NOT RUN');
});
test('diagnostic event retention is bounded and export includes environment and parameters', () => {
  const d = new Diagnostics(
    () => ({ runtime: 'unit' }),
    () => ({ slopRatio: 0.16 }),
  );
  for (let i = 0; i < 200; i++) d.log('performed', { i });
  assert.equal(d.events.length, 150);
  assert.equal(d.events[0].i, 50);
  assert.deepEqual(d.report().environment, { runtime: 'unit' });
  assert.deepEqual(d.report().parameters, { slopRatio: 0.16 });
});
test('inconclusive never substitutes an observed result', () => {
  const d = new Diagnostics(
    () => ({}),
    () => ({}),
  );
  assert.equal(d.inconclusive('HOLD-OUT', 'no device'), true);
  assert.equal(d.results['HOLD-OUT'].status, 'INCONCLUSIVE');
  d.check('BTN-UP', true, 1, 1);
  assert.equal(d.inconclusive('BTN-UP', 'cannot overwrite'), false);
  assert.equal(d.results['BTN-UP'].status, 'PASS');
});

import { cardGeometry, rubberBand } from '../src/carousel.ts';
import {
  DraftEditor,
  emptySelection,
  type Repository,
  type Stored,
  type Draft,
  type Selection,
} from '../src/draft.ts';
test('BF03 canonical 3.5 geometry is count independent and has exact symmetric ends', () => {
  const g = cardGeometry(411); // 2*4 + 3.5*108 + 2.5*10
  assert.equal(g.capacity, 3.5);
  assert.equal(g.width, 108);
  for (const n of [1, 2, 3]) assert.ok(2 * g.inset + n * g.width + (n - 1) * g.gap < 411);
  const content = 2 * g.inset + 4 * g.width + 3 * g.gap,
    max = content - 411;
  assert.equal(content - max, 411);
  assert.equal(content - (g.inset + 4 * g.width + 3 * g.gap), g.inset);
});
test('BF03 logarithmic overscroll remains unbounded with decreasing increments', () => {
  const k = 32;
  let previous = 0;
  for (const x of [100, 1000, 10000, 1e6, 1e12]) {
    const d = rubberBand(x, k);
    assert.ok(Number.isFinite(d) && d > previous);
    assert.equal(rubberBand(-x, k), -d);
    previous = d;
  }
  assert.ok(rubberBand(200, k) - rubberBand(100, k) > rubberBand(300, k) - rubberBand(200, k));
  assert.equal(rubberBand(100, 0), 0);
  assert.equal(rubberBand(0, k), 0);
});
test('BF03 delay slider has sixteen sanitized tenths, existing cadence frozen', () => {
  const base = defaults();
  for (let v = 10; v <= 25; v++) {
    const c = sanitize({ ...base, repeatDelayTenths: v });
    assert.equal(c.repeatDelayTenths, v);
    for (const elapsed of [0, 1000, 6000])
      assert.equal(repeatInterval(elapsed, c), repeatInterval(elapsed, base));
  }
  assert.equal(sanitize({ ...base, repeatDelayTenths: 12.6 }).repeatDelayTenths, 13);
});
class MemoryRepository implements Repository {
  value: Stored = { applied: emptySelection(), draft: null, activeSession: null };
  async read() {
    return structuredClone(this.value);
  }
  async begin(session: string) {
    this.value.activeSession = session;
    return this.read();
  }
  async save(session: string, version: number, selection: Selection): Promise<Draft | null> {
    if (
      this.value.activeSession !== session ||
      (this.value.draft?.session === session && this.value.draft.version >= version)
    )
      return null;
    const draft = {
      session,
      version,
      selection: structuredClone(selection),
      time: new Date().toISOString(),
    };
    this.value.draft = draft;
    return structuredClone(draft);
  }
  async finish(session: string, applied?: Selection) {
    if (this.value.activeSession !== session) throw Error('superseded');
    if (applied) this.value.applied = { ...applied };
    this.value.activeSession = null;
    this.value.draft = null;
    return this.read();
  }
  async invalidate() {
    this.value.activeSession = null;
    return this.read();
  }
  async deleteDraft() {
    this.value.activeSession = null;
    this.value.draft = null;
    return this.read();
  }
  async clear() {
    this.value = { applied: emptySelection(), draft: null, activeSession: null };
    return this.read();
  }
}
test('BF03 repository guard rejects stale sessions and older versions', async () => {
  const r = new MemoryRepository();
  await r.begin('a');
  await r.save('a', 2, { large: 'Square', small: 'Circle', number: '3' });
  assert.equal(await r.save('a', 1, emptySelection()), null);
  await r.finish('a', { large: 'Square', small: 'None', number: 'None' });
  assert.equal(await r.save('a', 3, emptySelection()), null);
  assert.equal(r.value.draft, null);
  await r.begin('b');
  assert.equal(await r.save('a', 99, emptySelection()), null);
});
test('BF03 draft editor separates live and committed state, immediate apply invalidates delay', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const repo = new MemoryRepository(),
    e = new DraftEditor(repo);
  await e.initialize();
  await e.start();
  e.latencyFor = () => 1500;
  e.select('large', 'Square');
  assert.equal(e.current.large, 'Square');
  assert.equal(e.draft, null);
  assert.equal(e.applied.large, 'None');
  await e.apply();
  t.mock.timers.tick(5000);
  await Promise.resolve();
  assert.equal(e.applied.large, 'Square');
  assert.equal(repo.value.draft, null);
  assert.equal(e.editing, false);
  assert.equal(e.outcome, 'APPLIED');
  t.mock.timers.reset();
});
test('BF03 discard pending save cannot resurrect deleted draft', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const r = new MemoryRepository(),
    e = new DraftEditor(r);
  await e.initialize();
  await e.start();
  e.select('large', 'Triangle');
  await e.discard();
  t.mock.timers.tick(5000);
  await Promise.resolve();
  assert.equal(r.value.draft, null);
  assert.equal(e.current.large, 'None');
  assert.equal(e.outcome, 'CANCELLED');
  t.mock.timers.reset();
});
test('BF03 configured Peek fraction changes capacity instead of freezing one half', () => {
  assert.ok(Math.abs(cardGeometry(411, 108, 10, 4, 0.2).capacity - 3.2) < 1e-12);
  assert.ok(Math.abs(cardGeometry(411, 108, 10, 4, 0.8).capacity - 2.8) < 1e-12);
});

import {
  initialEvent,
  eventTransition,
  pageAccessible,
  EventModel,
  type EventStore,
  type EventRecord,
  type EventCommand,
} from '../src/event-state.ts';
test('BF04 first event entry auto-opens exactly once; Help opens later', () => {
  let s = initialEvent();
  assert.equal(s.currentScreen, 'world');
  s = eventTransition(s, { type: 'enter' });
  assert.equal(s.guideOpen, true);
  s = eventTransition(s, { type: 'close' });
  s = eventTransition(s, { type: 'leave' });
  s = eventTransition(s, { type: 'enter' });
  assert.equal(s.guideOpen, false);
  s = eventTransition(s, { type: 'open' });
  assert.equal(s.guideOpen, true);
});
test('BF04 visits cannot acknowledge and locked navigation cannot change page', () => {
  let s = eventTransition(initialEvent(), { type: 'enter' });
  for (const page of [2, 3, 5]) {
    assert.equal(pageAccessible(s, page), false);
    s = eventTransition(s, { type: 'navigate', page });
    assert.equal(s.lastPage, 1);
  }
  assert.deepEqual(s.acknowledgedPages, []);
});
test('BF04 acknowledgment unlocks exactly one next page, repeated old ack does nothing', () => {
  let s = eventTransition(initialEvent(), { type: 'enter' });
  s = eventTransition(s, { type: 'ack', page: 1 });
  assert.equal(s.lastPage, 2);
  assert.deepEqual(s.acknowledgedPages, [1]);
  assert.equal(pageAccessible(s, 2), true);
  assert.equal(pageAccessible(s, 3), false);
  s = eventTransition(s, { type: 'ack', page: 1 });
  assert.equal(s.lastPage, 2);
  assert.deepEqual(s.acknowledgedPages, [1]);
});
test('BF04 completed open guide retains checks; close transitions to reference mode', () => {
  let s = eventTransition(initialEvent(), { type: 'enter' });
  for (let page = 1; page <= 5; page++) s = eventTransition(s, { type: 'ack', page });
  assert.equal(s.guideCompleted, true);
  assert.equal(s.guideOpen, true);
  assert.equal(s.guideMode, 'completed');
  s = eventTransition(s, { type: 'close' });
  assert.equal(s.guideMode, 'reference');
  s = eventTransition(s, { type: 'open' });
  assert.equal(s.guideOpen, true);
  for (let p = 1; p <= 5; p++) assert.ok(pageAccessible(s, p));
});
test('BF04 early close and reopen preserve last page and durable prefix', () => {
  let s = eventTransition(initialEvent(), { type: 'enter' });
  for (const page of [1, 2]) s = eventTransition(s, { type: 'ack', page });
  s = eventTransition(s, { type: 'close' });
  s = eventTransition(s, { type: 'open' });
  assert.equal(s.lastPage, 3);
  assert.deepEqual(s.acknowledgedPages, [1, 2]);
  assert.equal(s.guideCompleted, false);
  assert.equal(pageAccessible(s, 0), false);
  assert.equal(pageAccessible(s, 6), false);
});
class EventMemoryStore implements EventStore {
  record: EventRecord = { epoch: 'one', lease: 'lease', version: 0, state: initialEvent() };
  async acquire() {
    this.record.lease = crypto.randomUUID();
    return structuredClone(this.record);
  }
  async write(epoch: string, lease: string, cmd: EventCommand) {
    if (this.record.epoch !== epoch || this.record.lease !== lease) return null;
    this.record.state = eventTransition(this.record.state, cmd);
    this.record.version++;
    return structuredClone(this.record);
  }
  async reset() {
    this.record = {
      epoch: crypto.randomUUID(),
      lease: crypto.randomUUID(),
      version: this.record.version + 1,
      state: initialEvent(),
    };
    return structuredClone(this.record);
  }
}
test('BF04 model exposes acknowledgments only after confirmed write', async () => {
  const r = new EventMemoryStore(),
    m = new EventModel(r);
  await m.restart();
  await m.command({ type: 'enter' });
  let release!: () => void;
  const old = r.write.bind(r);
  r.write = async (...args) => {
    await new Promise<void>((resolve) => (release = resolve));
    return old(...args);
  };
  const write = m.command({ type: 'ack', page: 1 });
  await Promise.resolve();
  assert.equal(m.saveStatus, 'SAVING');
  assert.deepEqual(m.state.acknowledgedPages, []);
  release();
  await write;
  assert.deepEqual(m.state.acknowledgedPages, [1]);
  assert.equal(m.saveStatus, 'SAVED');
});
test('BF04 reset fences delayed writes in storage and UI', async () => {
  const r = new EventMemoryStore(),
    m = new EventModel(r);
  await m.restart();
  await m.command({ type: 'enter' });
  let release!: () => void;
  const old = r.write.bind(r);
  r.write = async (...args) => {
    await new Promise<void>((resolve) => (release = resolve));
    return old(...args);
  };
  const write = m.command({ type: 'ack', page: 1 });
  await Promise.resolve();
  await m.reset();
  release();
  await write;
  assert.equal(m.state.currentScreen, 'world');
  assert.deepEqual(m.state.acknowledgedPages, []);
  assert.deepEqual(r.record.state.acknowledgedPages, []);
});
test('BF04 restart destroys volatile state and reads durable state with a new lease', async () => {
  const r = new EventMemoryStore(),
    m = new EventModel(r);
  await m.restart();
  await m.command({ type: 'enter' });
  await m.command({ type: 'ack', page: 1 });
  m.state.lastPage = 5;
  m.state.acknowledgedPages = [1, 2, 3, 4];
  const lease = r.record.lease;
  await m.restart();
  assert.equal(m.state.lastPage, 2);
  assert.deepEqual(m.state.acknowledgedPages, [1]);
  assert.notEqual(r.record.lease, lease);
});
test('BF04 occurrence identities isolate future event cycles', () => {
  const a = initialEvent('winter-one'),
    b = initialEvent('winter-two');
  assert.notEqual(a.eventInstanceId, b.eventInstanceId);
  assert.deepEqual(b.acknowledgedPages, []);
});
