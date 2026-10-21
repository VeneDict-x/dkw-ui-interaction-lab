import { test, expect, type Page } from '@playwright/test';

async function index(page: Page) {
  await page.goto('/');
  // Also allows this scroll regression to run against the pre-fix startup.
  if (await page.locator('#back-index').isVisible()) await page.locator('#back-index').click();
}
async function swipe(page: Page, selector: string, dx: number, dy: number) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const b = (await target.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  const before = await page.evaluate(() => scrollY);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let n = 1; n <= 10; n++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + (dx * n) / 10, y: y + (dy * n) / 10 }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
  return before;
}

test('Final QA cold entry is index; all six cards open only on release and Close/Back return to index', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#test-shell')).toBeHidden();
  await expect(page.locator('.home-grid .experiment-card')).toHaveCount(6);
  const ids = ['carousel', 'actions', 'buttons', 'navigation', 'resize', 'draft-recovery'];
  for (let n = 0; n < ids.length; n++) {
    const card = page.locator(`.home-grid [data-open="${ids[n]}"]`);
    await card.scrollIntoViewIfNeeded();
    const b = (await card.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(page.locator('#test-shell')).toBeHidden();
    await page.mouse.up();
    await expect(page.locator(`#${ids[n]}`)).toBeVisible();
    if (ids[n] === 'navigation') await expect(page.locator('#event-world')).toBeVisible();
    await page.locator(n % 2 ? '#back-index' : '#close-test').click();
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#test-shell')).toBeHidden();
  }
  await page.reload();
  await expect(page.locator('#home')).toBeVisible();
  await expect(page.locator('#test-shell')).toBeHidden();
});

for (const width of [360, 430])
  test(`Final QA native vertical scroll begins inside large index card at ${width}px without opening it`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width, height: 812 },
    });
    try {
      const page = await context.newPage();
      await index(page);
      const selector = '.home-grid [data-open="carousel"]';
      const before = await swipe(page, selector, 0, -60);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 20);
      await expect(page.locator('#home')).toBeVisible();
      await expect(page.locator('#test-shell')).toBeHidden();
      await expect(page.locator(selector)).not.toHaveAttribute('data-pressed', 'true');
      await page.locator(selector).tap();
      await expect(page.locator('#carousel')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    } finally {
      await context.close();
    }
  });

for (const strip of ['.index nav', '.home-module-strip'])
  test(`Final QA preserves native horizontal scrolling from ${strip} buttons and remains usable after rotation`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 360, height: 812 },
    });
    try {
      const page = await context.newPage();
      await index(page);
      await swipe(page, `${strip} [data-open="actions"]`, -130, 0);
      await expect
        .poll(() => page.locator(strip).evaluate((e) => e.scrollLeft))
        .toBeGreaterThan(50);
      await expect(page.locator('#test-shell')).toBeHidden();
      await page.setViewportSize({ width: 812, height: 360 });
      await page.setViewportSize({ width: 360, height: 812 });
      await page.locator(`${strip} [data-open="draft-recovery"]`).tap();
      await expect(page.locator('#draft-recovery')).toBeVisible();
      await page.locator('#close-test').tap();
      await expect(page.locator('#home')).toBeVisible();
    } finally {
      await context.close();
    }
  });

test('Final QA index card keeps Strict Tap cancellation, PointerCancel and keyboard activation', async ({
  page,
}) => {
  await index(page);
  const card = page.locator('.home-grid [data-open="actions"]');
  await card.scrollIntoViewIfNeeded();
  const b = (await card.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(b.x - 5, y);
  await page.mouse.move(x, y);
  await page.mouse.up();
  await expect(page.locator('#test-shell')).toBeHidden();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await card.dispatchEvent('pointercancel', { pointerId: 1, pointerType: 'mouse', bubbles: true });
  await page.mouse.up();
  await expect(page.locator('#test-shell')).toBeHidden();
  await expect(card).not.toHaveAttribute('data-pressed', 'true');
  await card.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#actions')).toBeVisible();
});
