import { test, expect, type Page } from '@playwright/test';
async function open(page: Page) {
  await page.locator('.index [data-open="navigation"]').click();
  await expect(page.locator('#navigation')).toBeVisible();
}
async function touchSwipe(page: Page, selector: string, dx: number, dy = 0) {
  const el = page.locator(selector);
  await el.scrollIntoViewIfNeeded();
  const b = (await el.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 6, y: y + (dy * i) / 6 }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
test('BF04 top strip native touch scroll starts on button without activating module', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 360, height: 780 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#back-index').click();
  await touchSwipe(page, '.index [data-open="actions"]', -120);
  await expect
    .poll(() => page.locator('.index nav').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(60);
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#test-shell')).toBeHidden();
  await context.close();
});
async function enter(page: Page) {
  await open(page);
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await page.locator('#event-enter').click();
  await expect(page.locator('#mini-window')).toBeVisible();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
}
async function ack(page: Page, n: number) {
  await page.locator(`.guide-page[data-page="${n}"] [data-guide-ack]`).click();
  await expect(page.locator(`[data-action="page-${n}"]`)).toHaveAttribute(
    'data-acknowledged',
    'true',
  );
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
}
async function readState(page: Page) {
  return JSON.parse((await page.locator('#event-diagnostics').textContent())!);
}
async function complete(page: Page) {
  await enter(page);
  for (let n = 1; n <= 5; n++) await ack(page, n);
}
async function mouseDrag(page: Page, dx: number, dy = 0, release = true) {
  const b = (await page.locator('#guide-pages').boundingBox())!;
  const p = { x: b.x + b.width / 2, y: b.y + 80 };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + dx, p.y + dy, { steps: 5 });
  if (release) await page.mouse.up();
  return p;
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('#back-index').click();
});
test('BF04 first entry shows winter behind smaller opaque guide and acknowledgment at article bottom', async ({
  page,
}) => {
  await enter(page);
  await expect(page.locator('#winter-event')).toBeVisible();
  await expect(page.locator('#reopen')).toBeVisible();
  const g = (await page.locator('#event-game').boundingBox())!,
    w = (await page.locator('#mini-window').boundingBox())!;
  expect(w.width).toBeLessThan(g.width);
  expect(w.height).toBeLessThan(g.height);
  await expect(page.locator('#mini-window')).toHaveCSS('background-color', 'rgb(28, 44, 54)');
  const article = page.locator('.guide-page[data-page="1"]');
  expect(await article.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  expect(
    await article
      .locator('[data-guide-ack]')
      .evaluate(
        (e) =>
          e.getBoundingClientRect().top > e.closest('.guide-page')!.getBoundingClientRect().bottom,
      ),
  ).toBe(true);
  await expect(page.locator('[data-action="page-2"]')).toHaveAttribute('data-locked', 'true');
});
test('BF04 second event entry never auto-opens, Help reopens saved page at top', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await ack(page, 2);
  await page.locator('.guide-page[data-page="3"]').evaluate((e) => (e.scrollTop = 200));
  await page.locator('[data-action="mini-close"]').click();
  await expect(page.locator('#winter-event')).toBeVisible();
  await page.locator('#event-back').click();
  await expect(page.locator('#event-world')).toBeVisible();
  await page.locator('#event-enter').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await expect(page.locator('#mini-window')).toBeHidden();
  await page.locator('#reopen').click();
  await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
  expect(await page.locator('.guide-page[data-page="3"]').evaluate((e) => e.scrollTop)).toBe(0);
  expect((await readState(page)).acknowledgedPages).toEqual([1, 2]);
});
test('BF04 acknowledging unlocks one page and navigates; revisited ack disappears', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await expect(page.locator('[data-action="page-2"]')).toHaveAttribute('data-locked', 'false');
  await expect(page.locator('[data-action="page-3"]')).toHaveAttribute('data-locked', 'true');
  await page.locator('[data-action="page-1"]').click();
  await expect(page.locator('.guide-page[data-page="1"] [data-guide-ack]')).toBeHidden();
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
});
test('BF04 locked dots and Next reject consistently; popup refreshes without stacking', async ({
  page,
}) => {
  await enter(page);
  for (const selector of ['[data-action="page-5"]', '#page-next', '[data-action="page-3"]']) {
    await page.locator(selector).click();
    await expect(page.locator('#guide-popup')).toHaveText(
      'Следующая часть откроется после прочтения текущей',
    );
    await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  }
  await expect(page.locator('.guide-popup')).toHaveCount(1);
  await expect(page.locator('#guide-popup')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('#guide-popup')).toBeEmpty({ timeout: 3500 });
  expect((await readState(page)).acknowledgedPages).toEqual([]);
});
test('BF04 completion stays open with green checks; reopening uses reference mode', async ({
  page,
}) => {
  await complete(page);
  await expect(page.locator('#mini-window')).toBeVisible();
  await expect(page.locator('#dots [data-acknowledged="true"]')).toHaveCount(5);
  await expect(page.locator('.guide-page [data-guide-ack]:visible')).toHaveCount(0);
  await page.locator('[data-action="mini-close"]').click();
  await page.locator('#reopen').click();
  await expect(page.locator('#dots [data-acknowledged="true"]')).toHaveCount(0);
  await expect(page.locator('#dots [data-locked="true"]')).toHaveCount(0);
  expect((await readState(page)).guideMode).toBe('reference');
  await page.locator('[data-action="page-2"]').click();
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
});
test('BF04 live drag reveals neighbor; short drag and PointerCancel spring back', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await page.locator('[data-action="page-1"]').click();
  await mouseDrag(page, -45, 0, false);
  expect(
    Math.abs(Number(await page.locator('#guide-pages').getAttribute('data-offset'))),
  ).toBeGreaterThan(20);
  const v = (await page.locator('#guide-pages').boundingBox())!,
    n = (await page.locator('.guide-page[data-page="2"]').boundingBox())!;
  expect(n.x).toBeLessThan(v.x + v.width);
  await page.mouse.up();
  await page.waitForTimeout(280);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await mouseDrag(page, -110, 0, false);
  await page
    .locator('#guide-pages')
    .dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.locator('#guide-pages').getAttribute('data-offset')))
    .toBe(0);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
});
test('BF04 one long horizontal gesture changes at most one page; direction works', async ({
  page,
}) => {
  await complete(page);
  await page.locator('[data-action="page-1"]').click();
  await mouseDrag(page, -900);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await mouseDrag(page, 900);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
});
test('BF04 locked and first-page swipes resist, return and preserve selection', async ({
  page,
}) => {
  await enter(page);
  await mouseDrag(page, -180, 0, false);
  const offset = Math.abs(Number(await page.locator('#guide-pages').getAttribute('data-offset')));
  expect(offset).toBeGreaterThan(0);
  expect(offset).toBeLessThan(100);
  await page.mouse.up();
  await expect(page.locator('#guide-popup')).toContainText('Следующая часть');
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await mouseDrag(page, 180);
  await page.waitForTimeout(280);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
});
test('BF04 vertical mouse intent locks and scrolls without changing page', async ({ page }) => {
  await enter(page);
  await mouseDrag(page, 5, -100, false);
  await expect(page.locator('#guide-pages')).toHaveAttribute('data-gesture-owner', 'VERTICAL');
  await page.mouse.move(900, 80);
  await page.mouse.up();
  expect(
    await page.locator('.guide-page[data-page="1"]').evaluate((e) => e.scrollTop),
  ).toBeGreaterThan(20);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  expect((await readState(page)).acknowledgedPages).toEqual([]);
});
test('BF04 approved chat contract: reload opens world; Help restores guide progress at top', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await ack(page, 2);
  await page.locator('.guide-page[data-page="3"]').evaluate((e) => (e.scrollTop = 250));
  await page.reload();
  await open(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#mini-window')).toBeHidden();
  await page.locator('#event-enter').click();
  await page.locator('#reopen').click();
  await expect(page.locator('#mini-window')).toBeVisible();
  await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
  expect((await readState(page)).acknowledgedPages).toEqual([1, 2]);
  expect(await page.locator('.guide-page[data-page="3"]').evaluate((e) => e.scrollTop)).toBe(0);
});
test('BF04 simulated restart reads durable state; reset only clears Event', async ({ page }) => {
  await page.locator('.index [data-open="buttons"]').click();
  await page.locator('[data-action="basic"]').click();
  await enter(page);
  await ack(page, 1);
  const version = (await readState(page)).persistedVersion;
  await page.locator('#event-restart').click();
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#mini-window')).toBeHidden();
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  expect((await readState(page)).persistedVersion).toBe(version + 1);
  await page.locator('#event-reset').click();
  await page.locator('[data-action="event-reset-confirm"]').click();
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#mini-window')).toBeHidden();
  const s = await readState(page);
  expect(s.acknowledgedPages).toEqual([]);
  expect(s.eventEntered).toBe(false);
  await page.locator('.index [data-open="buttons"]').click();
  await expect(page.locator('#basic-count')).toHaveText('1 actions');
  await page.locator('.index [data-open="navigation"]').click();
  await page.locator('#event-enter').click();
  await expect(page.locator('#mini-window')).toBeVisible();
});
for (const [theme, rgb] of [
  ['Light', 'rgb(104, 169, 240)'],
  ['Dark', 'rgb(239, 119, 127)'],
  ['Premium', 'rgb(232, 191, 94)'],
])
  test(`BF04 ${theme} dots retain colored base, lock and green check`, async ({ page }) => {
    await enter(page);
    await page.locator('#nav-faction').selectOption(theme);
    await expect(page.locator('[data-action="page-1"] > span')).toHaveCSS('background-color', rgb);
    await expect(page.locator('[data-action="page-2"] .guide-dot-overlay svg')).toHaveCount(1);
    await ack(page, 1);
    await expect(page.locator('[data-action="page-1"] .guide-dot-overlay path')).toHaveCSS(
      'stroke',
      'rgb(104, 214, 159)',
    );
    await expect(page.locator('[data-action="page-2"] > span')).toHaveCSS('background-color', rgb);
  });

// Local CDP touch input is Chromium automation, never physical iPhone evidence.
test('BF04 module tabs retain Strict Tap cancellation, capture cancel and keyboard paths', async ({
  page,
}) => {
  const tab = page.locator('.index [data-open="actions"]');
  const b = (await tab.boundingBox())!;
  const x = b.x + 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(b.x - 2, y);
  await page.mouse.move(x, y);
  await page.mouse.up();
  await expect(page.locator('#home')).toBeVisible();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await tab.dispatchEvent('pointercancel', { pointerId: 1, bubbles: true });
  await page.mouse.up();
  await expect(page.locator('#home')).toBeVisible();
  await page.mouse.move(b.x + 5, y);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 5, y);
  await page.mouse.up();
  await expect(page.locator('#actions')).toBeVisible();
  await page.locator('.index [data-open="buttons"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#buttons')).toBeVisible();
});
test('BF04 narrow touch tabs allow taps, repeated surface swipes and orientation changes', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 320, height: 740 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#back-index').click();
  await page.locator('.index [data-open="actions"]').tap();
  await expect(page.locator('#actions')).toBeVisible();
  await touchSwipe(page, '.index [data-open="actions"]', -130);
  await touchSwipe(page, '.index [data-open="navigation"]', -160);
  await page.locator('.index [data-open="draft-recovery"]').tap();
  await expect(page.locator('#draft-recovery')).toBeVisible();
  await page.setViewportSize({ width: 740, height: 320 });
  await page.locator('.index [data-open="buttons"]').tap();
  await expect(page.locator('#buttons')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 740 });
  await page.locator('.index [data-open="navigation"]').tap();
  await expect(page.locator('#navigation')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
test('BF04 native vertical touch article scrolling and live touch page navigation coexist', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('#back-index').click();
  await enter(page);
  await touchSwipe(page, '#guide-pages', 2, -130);
  await expect
    .poll(() => page.locator('.guide-page[data-page="1"]').evaluate((e) => e.scrollTop))
    .toBeGreaterThan(40);
  expect((await readState(page)).acknowledgedPages).toEqual([]);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await ack(page, 1);
  await page.locator('[data-action="page-1"]').tap();
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await touchSwipe(page, '#guide-pages', -125, 3);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  expect(await page.locator('.guide-page[data-page="2"]').evaluate((e) => e.scrollTop)).toBe(0);
  await context.close();
});
test('BF04 dragging from acknowledgment cannot acknowledge or ghost-click; keyboard can', async ({
  page,
}) => {
  await enter(page);
  const button = page.locator('.guide-page[data-page="1"] [data-guide-ack]');
  await button.scrollIntoViewIfNeeded();
  const b = (await button.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x - 100, b.y + b.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#guide-popup')).toContainText('Следующая часть');
  expect((await readState(page)).acknowledgedPages).toEqual([]);
  await page.waitForTimeout(280);
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
});
test('BF04 Hidden and Back-only affect buttons, never accessibility through dots or swipes', async ({
  page,
}) => {
  await enter(page);
  await page.locator('#nav-boundary').selectOption('hidden');
  await page.locator('#nav-scenario').selectOption('back');
  await expect(page.locator('#page-back')).toBeHidden();
  await expect(page.locator('#page-next')).toBeHidden();
  await page.locator('[data-action="page-2"]').click();
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await ack(page, 1);
  await page.locator('[data-action="page-1"]').click();
  await mouseDrag(page, -200);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await expect(page.locator('#page-next')).toBeHidden();
  await mouseDrag(page, -200);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await expect(page.locator('#guide-popup')).toContainText('Следующая часть');
});
test('BF04 horizontal owner stays locked after vertical reversal; blur/resize end only temporary state', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await page.locator('[data-action="page-1"]').click();
  const p = await mouseDrag(page, -60, 0, false);
  await page.mouse.move(p.x - 65, p.y - 180);
  await expect(page.locator('#guide-pages')).toHaveAttribute('data-gesture-owner', 'HORIZONTAL');
  expect(await page.locator('.guide-page[data-page="1"]').evaluate((e) => e.scrollTop)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.mouse.up();
  await expect(page.locator('#guide-pages')).toHaveAttribute('data-gesture-owner', 'NONE');
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await mouseDrag(page, -100, 0, false);
  await page.setViewportSize({ width: 900, height: 700 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await page.locator('#guide-pages').getAttribute('data-offset')))
    .toBe(0);
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
});
for (const width of [320, 390])
  test(`BF04 all five long articles and essential controls fit mobile ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 780 });
    await enter(page);
    const heights: number[] = [];
    for (let n = 1; n <= 5; n++) {
      const article = page.locator(`.guide-page[data-page="${n}"]`);
      const size = await article.evaluate((e) => ({ total: e.scrollHeight, view: e.clientHeight }));
      expect(size.total).toBeGreaterThan(size.view * 2);
      heights.push(size.total);
      await expect(article.locator('.guide-illustration').first()).toBeVisible();
      const g = (await page.locator('#mini-window').boundingBox())!;
      for (const selector of ['#dots', '#page-next', '[data-action="mini-close"]']) {
        const b = (await page.locator(selector).boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(g.x);
        expect(b.x + b.width).toBeLessThanOrEqual(g.x + g.width + 1);
      }
      await ack(page, n);
    }
    expect(heights[3]).toBeGreaterThan(heights[0] * 1.4);
    await page.locator('[data-action="page-4"]').click();
    await expect(page.locator('.guide-page[data-page="4"] .guide-illustration')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('BF04 rapid acknowledgment taps unlock just one page; reduced motion remains functional', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enter(page);
  await page.locator('.guide-page[data-page="1"] [data-guide-ack]').dblclick();
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
  await page.locator('[data-action="page-1"]').click();
  await mouseDrag(page, -200);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await page.locator('[data-action="page-3"]').click();
  await expect(page.locator('#guide-popup')).toHaveCSS('transition-duration', '0s');
});
async function holdAcknowledgment(page: Page) {
  await page.evaluate(async () => {
    const path = '/src/event-state.ts';
    const { EventRepository } = await import(path);
    const old = EventRepository.prototype.write;
    EventRepository.prototype.write = async function (
      ...args: Parameters<import('../../src/event-state').EventRepository['write']>
    ) {
      if (args[2].type === 'ack') {
        EventRepository.prototype.write = old;
        await new Promise<void>((resolve) => {
          (window as typeof window & { releaseEventWrite: () => void }).releaseEventWrite = resolve;
        });
      }
      const result = await old.apply(this, args);
      if (args[2].type === 'ack')
        (window as typeof window & { eventWriteSettled: boolean }).eventWriteSettled = true;
      return result;
    };
  });
  await page.locator('.guide-page[data-page="1"] [data-guide-ack]').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVING');
  expect((await readState(page)).acknowledgedPages).toEqual([]);
}
async function releaseAcknowledgment(page: Page) {
  await page.evaluate(() =>
    (window as typeof window & { releaseEventWrite: () => void }).releaseEventWrite(),
  );
  await page.waitForFunction(
    () => (window as typeof window & { eventWriteSettled: boolean }).eventWriteSettled === true,
  );
}
test('BF04 pending acknowledgment is not read until real IndexedDB transaction completes', async ({
  page,
}) => {
  await enter(page);
  await holdAcknowledgment(page);
  await expect(page.locator('[data-action="page-2"]')).toHaveAttribute('data-locked', 'true');
  await releaseAcknowledgment(page);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await page.reload();
  await open(page);
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
});
for (const operation of ['reset', 'restart'])
  test(`BF04 real storage ${operation} rejects a delayed old-session acknowledgment`, async ({
    page,
  }) => {
    await enter(page);
    await holdAcknowledgment(page);
    await page.locator(`#event-${operation}`).click();
    if (operation === 'reset') await page.locator('[data-action="event-reset-confirm"]').click();
    await expect(page.locator('#event-save-status')).toHaveText('SAVED');
    await releaseAcknowledgment(page);
    await page.reload();
    await open(page);
    await expect(page.locator('#event-save-status')).toHaveText('SAVED');
    expect((await readState(page)).acknowledgedPages).toEqual([]);
    expect((await readState(page)).eventEntered).toBe(operation !== 'reset');
  });
test('BF04 real IndexedDB abort shows failure without marking read; Retry can durably acknowledge', async ({
  page,
}) => {
  await enter(page);
  await page.evaluate(() => {
    const old = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = old.call(this, value, key!);
      if (this.name === 'events' && value.state?.acknowledgedPages?.length === 1) {
        IDBObjectStore.prototype.put = old;
        this.transaction.abort();
      }
      return request;
    };
  });
  await page.locator('.guide-page[data-page="1"] [data-guide-ack]').click();
  await expect(page.locator('#event-save-status')).toContainText('SAVE_FAILED');
  expect((await readState(page)).acknowledgedPages).toEqual([]);
  await expect(page.locator('[data-action="page-2"]')).toHaveAttribute('data-locked', 'true');
  await page.locator('#event-retry').click();
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await page.reload();
  await open(page);
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
});
test('BF04 repository fences old leases, reset epochs and separate occurrence records', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const path = '/src/event-state.ts';
    const { EventRepository } = await import(path);
    const a = new EventRepository('test-occurrence-a'),
      b = new EventRepository('test-occurrence-a');
    const first = await a.acquire();
    await a.write(first.epoch, first.lease, { type: 'enter' });
    const latest = await b.acquire();
    const staleLease = await a.write(first.epoch, first.lease, { type: 'ack', page: 1 });
    await b.write(latest.epoch, latest.lease, { type: 'ack', page: 1 });
    await b.reset();
    const staleEpoch = await b.write(latest.epoch, latest.lease, { type: 'ack', page: 2 });
    const reset = await b.acquire();
    const separate = await new EventRepository('test-occurrence-b').acquire();
    return { staleLease, staleEpoch, reset: reset.state, separate: separate.state };
  });
  expect(result.staleLease).toBeNull();
  expect(result.staleEpoch).toBeNull();
  expect(result.reset.acknowledgedPages).toEqual([]);
  expect(result.reset.currentScreen).toBe('world');
  expect(result.separate.eventInstanceId).toBe('test-occurrence-b');
  expect(result.separate.eventEntered).toBe(false);
});
test('BF04 Reset requires confirmation; cancel preserves progress and a failed reset is retryable', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await page.locator('#event-reset').click();
  await expect(page.locator('#event-reset-dialog')).toBeVisible();
  await page.locator('[data-action="event-reset-cancel"]').click();
  expect((await readState(page)).acknowledgedPages).toEqual([1]);
  await page.evaluate(async () => {
    const path = '/src/event-state.ts';
    const { EventRepository } = await import(path);
    const old = EventRepository.prototype.reset;
    EventRepository.prototype.reset = function () {
      EventRepository.prototype.reset = old;
      return Promise.reject(Error('Test-only failed reset'));
    };
  });
  await page.locator('#event-reset').click();
  await page.locator('[data-action="event-reset-confirm"]').click();
  await expect(page.locator('#event-save-status')).toContainText('SAVE_FAILED');
  await page.locator('#event-retry').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await expect(page.locator('#event-world')).toBeVisible();
  await page.reload();
  await open(page);
  expect((await readState(page)).eventEntered).toBe(false);
});

test('BF04 Navigation diagnostics still earn boundary, page and close checks from actual actions', async ({
  page,
}) => {
  await enter(page);
  await page.locator('#page-back').scrollIntoViewIfNeeded();
  const b = (await page.locator('#page-back').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await ack(page, 1);
  await page.locator('[data-action="page-1"]').click();
  await page.locator('[data-action="mini-close"]').click();
  await page.locator('#reopen').click();
  const pending = page.waitForEvent('download');
  await page.locator('#export-report').click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const report = JSON.parse(Buffer.concat(chunks).toString());
  for (const id of ['NAV-BOUND', 'NAV-PAGE', 'NAV-CLOSE'])
    expect(report.results.find((r: { id: string }) => r.id === id).status, id).toBe('PASS');
});
test('BF04 experimental guide settings edit runtime thresholds and persist without changing Slop', async ({
  page,
}) => {
  await complete(page);
  await page.locator('[data-action="page-1"]').click();
  await page.locator('#debug-details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  const field = page.locator('[data-config="guideSwipeFraction"]');
  await field.fill('0.6');
  await field.dispatchEvent('change');
  await mouseDrag(page, -200);
  await expect
    .poll(async () => Number(await page.locator('#guide-pages').getAttribute('data-offset')))
    .toBe(0);
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  await field.fill('0.1');
  await field.dispatchEvent('change');
  await mouseDrag(page, -200);
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await page.reload();
  await page.locator('#debug-details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await expect(field).toHaveValue('0.1');
  for (const key of [
    'guideAxisRatio',
    'guideSpringMs',
    'guideResistance',
    'guidePopupIn',
    'guidePopupVisible',
    'guidePopupOut',
  ])
    await expect(page.locator(`[data-config="${key}"]`)).toBeEditable();
  await expect(page.locator('[data-config="touchSlopMultiplier"]')).toHaveValue('1.25');
  await expect(page.locator('#effective-slop')).toHaveText('7.68 px');
});
test('BF04 reload preserves early closed and completed reference modes without repeated auto-open', async ({
  page,
}) => {
  await enter(page);
  await ack(page, 1);
  await page.locator('[data-action="mini-close"]').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await page.reload();
  await open(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await page.locator('#event-enter').click();
  await expect(page.locator('#mini-window')).toBeHidden();
  if (await page.locator('#event-world').isVisible()) await page.locator('#event-enter').click();
  await page.locator('#reopen').click();
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  for (let n = 2; n <= 5; n++) await ack(page, n);
  await page.locator('[data-action="mini-close"]').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await page.reload();
  await open(page);
  await expect(page.locator('#mini-window')).toBeHidden();
  if (await page.locator('#event-world').isVisible()) await page.locator('#event-enter').click();
  await page.locator('#reopen').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  expect((await readState(page)).guideMode).toBe('reference');
  await expect(
    page.locator('#dots [data-locked="true"], #dots [data-acknowledged="true"]'),
  ).toHaveCount(0);
  await expect(page.locator('.guide-page [data-guide-ack]:visible')).toHaveCount(0);
});

test('BF04 rapid Event activations during a delayed save cannot suppress first-entry guide', async ({
  page,
}) => {
  await open(page);
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await page.evaluate(async () => {
    const path = '/src/event-state.ts';
    const { EventRepository } = await import(path);
    const old = EventRepository.prototype.write;
    EventRepository.prototype.write = async function (
      ...args: Parameters<import('../../src/event-state').EventRepository['write']>
    ) {
      EventRepository.prototype.write = old;
      await new Promise<void>((resolve) => {
        (window as typeof window & { releaseEventEnter: () => void }).releaseEventEnter = resolve;
      });
      return old.apply(this, args);
    };
  });
  await page.locator('#event-enter').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVING');
  await page.locator('#event-enter').click();
  await page.evaluate(() =>
    (window as typeof window & { releaseEventEnter: () => void }).releaseEventEnter(),
  );
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await expect(page.locator('#mini-window')).toBeVisible();
  expect((await readState(page)).eventEntered).toBe(true);
  await page.reload();
  await open(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#mini-window')).toBeHidden();
});
