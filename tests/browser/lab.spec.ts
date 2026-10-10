import { test, expect, type Page } from '@playwright/test';
async function open(page: Page, id: string) {
  await page.locator(`.index [data-open="${id}"]`).click();
  await expect(page.locator(`#${id}`)).toBeVisible();
}
async function point(page: Page, selector: string) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const b = await target.boundingBox();
  if (!b) throw Error('No bounds');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, width: b.width, height: b.height };
}
async function setConfig(page: Page, key: string, value: number) {
  await page.locator('#debug-details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.locator(`[data-config="${key}"]`).fill(String(value));
  await page.locator(`[data-config="${key}"]`).dispatchEvent('change');
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('entry, chambers, NOT RUN assertions and no default PASS', async ({ page }) => {
  await expect(page).toHaveTitle(/DKW/);
  await expect(page.locator('.index [data-open]')).toHaveCount(5);
  await expect(page.locator('.status.pass')).toHaveCount(0);
  await expect(page.locator('.status.not-run')).toHaveCount(26);
  for (const id of ['carousel', 'actions', 'buttons', 'navigation', 'resize']) {
    await open(page, id);
    await page.locator('#close-test').click();
    await expect(page.locator('#home')).toBeVisible();
  }
});
test('release happens on Up, not Down, and pointer click cannot duplicate it', async ({ page }) => {
  await open(page, 'actions');
  const p = await point(page, '#release-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#action-count')).toHaveText('0');
  await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
  await page.mouse.up();
  await expect(page.locator('#action-count')).toHaveText('1');
  await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
  await page.waitForTimeout(100);
  await expect(page.locator('#action-count')).toHaveText('1');
});
test('leave and return below slop visually unpress/repress and activate once', async ({ page }) => {
  await open(page, 'actions');
  const b = await page.locator('#release-button').boundingBox();
  if (!b) throw Error();
  const x = b.x + 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(b.x - 2, y);
  await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
  await page.mouse.move(x, y);
  await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
  await page.mouse.up();
  await expect(page.locator('#action-count')).toHaveText('1');
});
test('Up outside cancels even below slop', async ({ page }) => {
  await open(page, 'actions');
  const b = await page.locator('#release-button').boundingBox();
  if (!b) throw Error();
  await page.mouse.move(b.x + 2, b.y + 20);
  await page.mouse.down();
  await page.mouse.move(b.x - 2, b.y + 20);
  await page.mouse.up();
  await expect(page.locator('#action-count')).toHaveText('0');
});
test('ordinary Basic button retains irreversible Slop cancellation', async ({ page }) => {
  // Task 02 changed only declared ReleaseButtons; this old contract still applies to Basic.
  await open(page, 'buttons');
  const p = await point(page, '[data-action="basic"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 30, p.y);
  await page.mouse.move(p.x, p.y);
  await expect(page.locator('[data-action="basic"]')).toHaveAttribute('data-pressed', 'false');
  await page.mouse.up();
  await expect(page.locator('#basic-count')).toHaveText('0 actions');
});
test('simulated PointerCancel resets without activation and lost capture interrupts hold', async ({
  page,
}) => {
  await open(page, 'actions');
  const p = await point(page, '#release-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })),
  );
  await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
  await page.mouse.up();
  await expect(page.locator('#action-count')).toHaveText('0');
  await open(page, 'buttons');
  const h = await point(page, '#hold-button');
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · READY');
  await page.locator('#hold-button').evaluate((el) => (el as HTMLElement).releasePointerCapture(1));
  await expect(page.locator('#hold-state')).toHaveText('IDLE · READY');
  await page.mouse.up();
});
test('short tap hold control performs one action', async ({ page }) => {
  await open(page, 'buttons');
  await page.locator('#hold-button').click();
  await expect(page.locator('#hold-count')).toHaveText('1');
});
test('hold survives outside, repeats, terminates on outside Up without extra click', async ({
  page,
}) => {
  await open(page, 'buttons');
  await setConfig(page, 'holdDelay', 100);
  await setConfig(page, 'repeatMs', 100);
  const p = await point(page, '#hold-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · READY');
  await page.mouse.move(p.x + p.width + 40, p.y);
  await expect(page.locator('#hold-button')).toHaveAttribute('data-pressed', 'true');
  await page.waitForTimeout(250);
  await page.mouse.up();
  const n = Number(await page.locator('#hold-count').textContent());
  expect(n).toBeGreaterThanOrEqual(2);
  await expect(page.locator('#hold-state')).toHaveText('IDLE · READY');
  await page.waitForTimeout(200);
  await expect(page.locator('#hold-count')).toHaveText(String(n));
});
test('availability pauses active hold and resumes without a backlog', async ({ page }) => {
  await open(page, 'buttons');
  await setConfig(page, 'holdDelay', 100);
  await setConfig(page, 'repeatMs', 150);
  await setConfig(page, 'acceleration', 0);
  const p = await point(page, '#hold-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · READY');
  await page.locator('#availability').evaluate((e: HTMLInputElement) => {
    e.checked = false;
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · WAITING');
  const n = await page.locator('#hold-count').textContent();
  await page.waitForTimeout(400);
  await expect(page.locator('#hold-count')).toHaveText(n!);
  await page.locator('#availability').evaluate((e: HTMLInputElement) => {
    e.checked = true;
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(175);
  expect(Number(await page.locator('#hold-count').textContent()) - Number(n)).toBeLessThanOrEqual(
    2,
  );
  expect(Number(await page.locator('#hold-count').textContent())).toBeGreaterThan(Number(n));
  await page.mouse.up();
});
test('movement before hold recognition cancels repeat and release', async ({ page }) => {
  await open(page, 'buttons');
  const p = await point(page, '#hold-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 30, p.y);
  await page.waitForTimeout(600);
  await page.mouse.up();
  await expect(page.locator('#hold-count')).toHaveText('0');
});
test('secondary pointer is ignored while first holds; blur terminates', async ({ page }) => {
  await open(page, 'buttons');
  const p = await point(page, '#hold-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · READY');
  await page.locator('#hold-button').dispatchEvent('pointerdown', {
    pointerId: 2,
    pointerType: 'touch',
    isPrimary: false,
    button: 0,
  });
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · READY');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.locator('#hold-state')).toHaveText('IDLE · READY');
  await page.mouse.up();
});
test('plus/minus bounds, generic repeat, standalone arrows work independently', async ({
  page,
}) => {
  await open(page, 'buttons');
  await page.locator('#step-value').fill('10');
  await page.locator('#step-value').dispatchEvent('change');
  await expect(page.locator('#plus')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('#minus').click();
  await expect(page.locator('#step-value')).toHaveValue('9');
  await page.locator('[data-action="arrow-right"]').click();
  await expect(page.locator('#arrow-count')).toHaveText('1');
  await page.locator('[data-action="arrow-left"]').click();
  await expect(page.locator('#arrow-count')).toHaveText('0');
  await page.locator('#repeat-button').click();
  await expect(page.locator('#repeat-count')).toHaveText('1 actions');
});
test('hold reaching step bound preserves session, availability resumes if bound changes', async ({
  page,
}) => {
  await open(page, 'buttons');
  await setConfig(page, 'holdDelay', 100);
  await page.locator('#step-value').fill('9');
  await page.locator('#step-value').dispatchEvent('change');
  const p = await point(page, '#plus');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#step-value')).toHaveValue('10');
  await expect(page.locator('#plus')).toHaveAttribute('data-pressed', 'true');
  await page.locator('#step-max').evaluate((el: HTMLInputElement) => {
    el.value = '12';
    el.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('#step-value')).toHaveValue('12');
  await page.mouse.up();
});
test('carousel card tap selects, None clears, horizontal drag does not select', async ({
  page,
}) => {
  await open(page, 'carousel');
  await page.locator('#carousel-0 [data-card="Option 1"]').click();
  await expect(page.locator('#selected-0')).toHaveText('Option 1');
  await page.locator('#carousel-0 [data-card="None"]').click();
  await expect(page.locator('#selected-0')).toHaveText('None');
  const p = await point(page, '#carousel-0 [data-card="Option 1"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 90, p.y);
  await page.mouse.up();
  await expect(page.locator('#selected-0')).toHaveText('None');
  expect(await page.locator('#carousel-0').evaluate((el) => el.scrollLeft)).toBeGreaterThan(20);
});
test('45 degrees selects carousel, locks through later vertical intent; reversal is immediate', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'carousel');
  const p = await point(page, '#carousel-0 [data-card="Option 1"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 20, p.y - 20);
  await expect(page.locator('#gesture-metrics')).toContainText('CAROUSEL');
  const x = await page.locator('#carousel-0').evaluate((el) => el.scrollLeft);
  await page.mouse.move(p.x - 40, p.y - 95);
  await expect(page.locator('#gesture-metrics')).toContainText('CAROUSEL');
  const x2 = await page.locator('#carousel-0').evaluate((el) => el.scrollLeft);
  expect(x2).toBeGreaterThan(x);
  await page.mouse.move(p.x - 30, p.y - 120);
  expect(await page.locator('#carousel-0').evaluate((el) => el.scrollLeft)).toBeLessThan(x2);
  expect(await page.locator('#modules').evaluate((el) => el.scrollTop)).toBe(0);
  await page.mouse.up();
});
test('vertical intent inside carousel scrolls modules and keeps horizontal position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'carousel');
  const p = await point(page, '#carousel-0 [data-card="Option 1"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 10, p.y - 50);
  await expect(page.locator('#gesture-metrics')).toContainText('MODULES');
  const top = await page.locator('#modules').evaluate((el) => el.scrollTop);
  expect(top).toBeGreaterThan(20);
  expect(await page.locator('#carousel-0').evaluate((el) => el.scrollLeft)).toBe(0);
  await page.mouse.move(p.x - 100, p.y - 60);
  await expect(page.locator('#gesture-metrics')).toContainText('MODULES');
  await page.mouse.up();
  await expect(page.locator('#selected-0')).toHaveText('None');
});
test('outside cards starts Modules and ignores horizontal movement', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'carousel');
  const b = await page.locator('.module-title').first().boundingBox();
  if (!b) throw Error();
  await page.mouse.move(b.x + 10, b.y + 15);
  await page.mouse.down();
  await page.mouse.move(b.x - 30, b.y + 15);
  await expect(page.locator('#gesture-metrics')).toContainText('MODULES');
  expect(await page.locator('#modules').evaluate((el) => el.scrollTop)).toBe(0);
  await page.mouse.up();
});
test('no overflow means no scroll or elastic movement, edge arrows unavailable', async ({
  page,
}) => {
  await open(page, 'carousel');
  await page.locator('#card-count').fill('1');
  await page.locator('#card-count').dispatchEvent('change');
  const p = await point(page, '#carousel-0 [data-card="None"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 50, p.y);
  await page.mouse.up();
  expect(await page.locator('#carousel-0').evaluate((el) => el.scrollLeft)).toBe(0);
  await expect(page.locator('[data-action="right-0"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#carousel-0 .carousel-track')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  );
});
test('overflow has bounded elastic pull and spring return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'carousel');
  await setConfig(page, 'inertia', 0);
  const p = await point(page, '#carousel-0 [data-card="None"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 100, p.y);
  const tx = await page
    .locator('#carousel-0 .carousel-track')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  expect(tx).toBeGreaterThan(0);
  expect(tx).toBeLessThanOrEqual(32);
  await page.mouse.up();
  await expect(page.locator('#carousel-0 .carousel-track')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  );
});
test('five-page dots, faction colors, back/next and close/reopen preserve page', async ({
  page,
}) => {
  await open(page, 'navigation');
  await expect(page.locator('#dots button')).toHaveCount(5);
  await page.locator('[data-action="page-3"]').click();
  await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
  await expect(page.locator('[data-action="page-3"]')).toHaveAttribute('aria-current', 'page');
  await page.locator('#nav-faction').selectOption('Dark');
  await expect(page.locator('[data-action="page-3"] span')).toHaveCSS(
    'background-color',
    'rgb(239, 119, 127)',
  );
  await page.locator('#page-next').click();
  await page.locator('#page-back').click();
  await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
  await page.locator('[data-action="mini-close"]').click();
  await expect(page.locator('#mini-window')).toBeHidden();
  await expect(page.locator('#test-shell')).toBeVisible();
  await page.locator('#reopen').click();
  await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
});
test('navigation boundaries and back-only/hidden setting', async ({ page }) => {
  await open(page, 'navigation');
  await expect(page.locator('#page-back')).toBeDisabled();
  await page.locator('[data-action="page-5"]').click();
  await expect(page.locator('#page-next')).toBeDisabled();
  await page.locator('#nav-boundary').selectOption('hidden');
  await expect(page.locator('#page-next')).toBeHidden();
  await page.locator('#nav-scenario').selectOption('back');
  await page.locator('[data-action="page-2"]').click();
  await expect(page.locator('#page-next')).toBeHidden();
  await expect(page.locator('#page-back')).toBeEnabled();
});
test('keyboard activates buttons, cards and dots with visible focus semantics', async ({
  page,
}) => {
  await open(page, 'navigation');
  await page.locator('[data-action="page-4"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#page-title')).toHaveText('Page 4 / 5');
  await open(page, 'actions');
  await page.locator('#release-button').focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#action-count')).toHaveText('1');
  await open(page, 'carousel');
  await page.locator('#carousel-0 [data-card="Option 1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#selected-0')).toHaveText('Option 1');
});
test('resize preserves carousel selection, draft, page, step and relevant scroll', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'carousel');
  await page.locator('#carousel-0 [data-card="Option 1"]').click();
  await page.locator('#draft').fill('Retained draft');
  await page.locator('#modules').evaluate((el) => (el.scrollTop = 200));
  await page.setViewportSize({ width: 430, height: 932 });
  await page.waitForTimeout(250);
  await expect(page.locator('#selected-0')).toHaveText('Option 1');
  await expect(page.locator('#draft')).toHaveValue('Retained draft');
  expect(await page.locator('#modules').evaluate((el) => el.scrollTop)).toBeCloseTo(200, 0);
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.waitForTimeout(250);
  await expect(page.locator('#selected-0')).toHaveText('Option 1');
  await expect(page.locator('#workspace')).toHaveAttribute('data-layout', 'side');
});
test('mock live resize, blur/dim restore, pointer drag and state preserved', async ({ page }) => {
  await open(page, 'resize');
  await page.locator('#resize-draft').fill('Persist this');
  await page.locator('#mock-selection').check();
  await page.locator('#mock-width').fill('480');
  await expect(page.locator('#resize-state')).toHaveText('LIVE RESIZE');
  await expect(page.locator('#resize-state')).toHaveText('SETTLED');
  await expect(page.locator('#backdrop')).toHaveCSS('backdrop-filter', 'blur(8px)');
  await expect(page.locator('#backdrop')).toHaveCSS('background-color', 'rgba(8, 12, 16, 0.35)');
  const before = await page.locator('#mock-window').boundingBox();
  const p = await point(page, '#resize-handle');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 45, p.y + 35);
  await expect(page.locator('#resize-state')).toHaveText('LIVE RESIZE');
  await page.mouse.up();
  await expect(page.locator('#resize-state')).toHaveText('SETTLED');
  const after = await page.locator('#mock-window').boundingBox();
  expect(after!.width).toBeLessThan(before!.width);
  await expect(page.locator('#resize-draft')).toHaveValue('Persist this');
  await expect(page.locator('#mock-selection')).toBeChecked();
  await expect(page.locator('#resize-validation')).toHaveText('PASS');
});
test('square mock preserves previous H/V mode through hysteresis', async ({ page }) => {
  await open(page, 'resize');
  await page.locator('#mock-height').fill('350');
  await page.locator('#mock-width').fill('500');
  await expect(page.locator('#mock-window')).toHaveAttribute('data-mode', 'H');
  await page.locator('#mock-width').fill('350');
  await expect(page.locator('#mock-window')).toHaveAttribute('data-mode', 'H');
  await page.locator('#mock-width').fill('260');
  await expect(page.locator('#mock-window')).toHaveAttribute('data-mode', 'V');
  await page.locator('#mock-width').fill('350');
  await expect(page.locator('#mock-window')).toHaveAttribute('data-mode', 'V');
});
test('config persistence, reset, exports contain environment and performed checks', async ({
  page,
}) => {
  await setConfig(page, 'slopRatio', 0.3);
  await expect(page.locator('#effective-slop')).toHaveText('14.40 px');
  await page.reload();
  await expect(page.locator('#effective-slop')).toHaveText('14.40 px');
  await open(page, 'actions');
  await page.locator('#release-button').click();
  const dl = page.waitForEvent('download');
  await page.locator('#export-report').click();
  const download = await dl;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report.parameters.slopRatio).toBe(0.3);
  expect(report.environment.viewport.width).toBeGreaterThan(0);
  expect(report.results.find((r: { id: string }) => r.id === 'BTN-UP').status).toBe('PASS');
  expect(report.results.find((r: { id: string }) => r.id === 'HOLD-OUT').status).toBe('NOT RUN');
  expect(
    report.events.some((e: { pointerType: string }) => e.pointerType === 'mouse'),
  ).toBeTruthy();
  await page.locator('#config-reset').click();
  await expect(page.locator('#effective-slop')).toHaveText('7.68 px');
  await page.locator('#reset-test').click();
  await expect(page.locator('.status.pass')).toHaveCount(0);
});
test('layout fits 360 px, targets retain safe size, 30 modules remain scrollable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  for (const id of ['actions', 'buttons', 'navigation', 'resize', 'carousel']) {
    await open(page, id);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360,
    );
    for (const b of await page.locator(`#${id} button:visible`).all()) {
      const box = await b.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.locator('#module-count').fill('30');
  await page.locator('#module-count').dispatchEvent('change');
  await expect(page.locator('.module-row')).toHaveCount(30);
  expect(
    await page.locator('#modules').evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBeTruthy();
  const size = await page.locator('#preview-content').boundingBox();
  expect(size!.width / size!.height).toBeCloseTo(280 / 180, 2);
  await page.screenshot({ path: 'artifacts/testing/mobile-carousel.png', fullPage: true });
});
test('trackpad/wheel path scrolls horizontal carousel and vertical modules', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'carousel');
  const p = await point(page, '#carousel-0 [data-card="Option 1"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.wheel(80, 0);
  await expect
    .poll(() => page.locator('#carousel-0').evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(0);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(() => page.locator('#modules').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
});
test('real Chromium touch input reports touch Pointer Events and nested ownership', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await open(page, 'carousel');
  const p = await point(page, '#carousel-0 [data-card="Option 1"]'),
    cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: p.x, y: p.y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: p.x - 45, y: p.y - 10 }],
  });
  await expect(page.locator('#gesture-metrics')).toContainText('touch');
  await expect(page.locator('#gesture-metrics')).toContainText('CAROUSEL');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#selected-0')).toHaveText('None');
  await context.close();
});
test('visual smoke has no runtime errors or unexpected external requests', async ({ page }) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173')) external.push(r.url());
  });
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/testing/desktop-index.png', fullPage: true });
  await open(page, 'buttons');
  await page.screenshot({ path: 'artifacts/testing/desktop-buttons.png', fullPage: true });
  await open(page, 'resize');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'artifacts/testing/desktop-resize.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
test('live resize remains live while handle is held without movement; final backdrop assertion passes', async ({
  page,
}) => {
  await open(page, 'resize');
  const p = await point(page, '#resize-handle');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x - 20, p.y);
  await page.waitForTimeout(400);
  await expect(page.locator('#resize-state')).toHaveText('LIVE RESIZE');
  await page.mouse.up();
  await expect(page.locator('#resize-state')).toHaveText('SETTLED');
  await expect(
    page.locator('.assertion').filter({ has: page.locator('code', { hasText: 'BACKDROP' }) }),
  ).toContainText('PASS');
});
test('backdrop validation waits for completed effects during slower restoration', async ({
  page,
}) => {
  await setConfig(page, 'blur', 12);
  await setConfig(page, 'dim', 0.5);
  await page.locator('#backdrop').evaluate((el: HTMLElement) => {
    el.style.transitionDuration = '500ms';
  });
  await open(page, 'resize');
  await expect(page.locator('#resize-state')).toHaveText('SETTLED');
  await expect(page.locator('#backdrop')).toHaveCSS('backdrop-filter', 'blur(12px)');
  await expect(page.locator('#backdrop')).toHaveCSS('background-color', 'rgba(8, 12, 16, 0.5)');
  await expect(
    page.locator('.assertion').filter({ has: page.locator('code', { hasText: 'BACKDROP' }) }),
  ).toContainText('PASS');
});
test('experimental press and repeat settings affect behavior; all geometry fields are editable', async ({
  page,
}) => {
  await open(page, 'actions');
  await setConfig(page, 'pressDepth', 5);
  await setConfig(page, 'darkening', 0.4);
  await setConfig(page, 'pressDuration', 0);
  const p = await point(page, '#release-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#release-button')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 5)');
  await expect(page.locator('#release-button')).toHaveCSS('filter', 'brightness(0.6)');
  await page.mouse.up();
  for (const key of [
    'previewMin',
    'previewPreferred',
    'previewMax',
    'previewBreathing',
    'previewScaleMax',
    'cr1',
    'cr2',
    'windowMaxHeight',
    'windowMaxWidth',
    'mediumWidth',
    'expandedWidth',
    'wideWidth',
    'hysteresis',
    'ratioEnterV',
    'ratioEnterH',
    'settleMs',
    'decorationBudget',
    'inertia',
    'overscroll',
    'spring',
    'holdDelay',
    'repeatMs',
    'acceleration',
    'maxRate',
  ]) {
    await expect(page.locator(`[data-config="${key}"]`)).toBeEditable();
  }
  await setConfig(page, 'blur', 12);
  await setConfig(page, 'dim', 0.5);
  await open(page, 'resize');
  await expect(page.locator('#backdrop')).toHaveCSS('backdrop-filter', 'blur(12px)');
  await expect(page.locator('#backdrop')).toHaveCSS('background-color', 'rgba(8, 12, 16, 0.5)');
});
test('INCONCLUSIVE requires a reason and cannot overwrite an observed PASS', async ({ page }) => {
  await page.locator('.results details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.locator('#inconclusive-case').selectOption('HOLD-OUT');
  await page
    .locator('#inconclusive-reason')
    .fill('No physical pen available in this automated browser session');
  await page.locator('#record-inconclusive').click();
  await expect(
    page.locator('.assertion').filter({ has: page.locator('code', { hasText: 'HOLD-OUT' }) }),
  ).toContainText('INCONCLUSIVE');
  await open(page, 'actions');
  await page.locator('#release-button').click();
  await page.locator('#inconclusive-case').selectOption('BTN-UP');
  await page.locator('#record-inconclusive').click();
  await expect(
    page.locator('.assertion').filter({ has: page.locator('code', { hasText: 'BTN-UP' }) }),
  ).toContainText('PASS');
});
test('recognized hold PointerCancel stops ticks and cannot trigger a release action', async ({
  page,
}) => {
  await open(page, 'buttons');
  const p = await point(page, '#hold-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#hold-state')).toHaveText('HOLDING · READY');
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })),
  );
  await expect(page.locator('#hold-state')).toHaveText('IDLE · READY');
  const n = await page.locator('#hold-count').textContent();
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator('#hold-count')).toHaveText(n!);
});
test('large experimental UI scale protects action bounds and does not overlap carousel controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await setConfig(page, 'uiScale', 1.5);
  await open(page, 'carousel');
  await page.waitForTimeout(250);
  const footer = await page.locator('.workspace-actions').boundingBox();
  for (const b of await page.locator('.workspace-actions button').all()) {
    const r = await b.boundingBox();
    expect(r!.height).toBeGreaterThanOrEqual(66);
    expect(r!.y).toBeGreaterThanOrEqual(footer!.y);
    expect(r!.y + r!.height).toBeLessThanOrEqual(footer!.y + footer!.height + 1);
  }
  const title = await page.locator('.module-title').first().boundingBox(),
    carousel = await page.locator('#carousel-0').boundingBox();
  expect(title!.y + title!.height).toBeLessThanOrEqual(carousel!.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});
test('visualizer shows start, slop boundary, path and permanently cancelled tap', async ({
  page,
}) => {
  await open(page, 'carousel');
  const p = await point(page, '#carousel-0 [data-card="Option 1"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#gesture-overlay')).toBeVisible();
  await expect(page.locator('#gesture-overlay circle').first()).toHaveAttribute('r', '7.68');
  await page.mouse.move(p.x + 20, p.y + 5);
  await expect(page.locator('#gesture-metrics')).toContainText('SLOP_CROSSED');
  await expect(page.locator('#gesture-metrics')).toContainText('CANCELLED');
  expect(
    (await page.locator('#gesture-overlay polyline').getAttribute('points'))!.split(' ').length,
  ).toBeGreaterThan(1);
  await page.mouse.up();
});
