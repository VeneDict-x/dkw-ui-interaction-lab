import { test, expect, type Page } from '@playwright/test';

async function module04(page: Page) {
  if (await page.locator('#home').isVisible())
    await page.locator('.home-grid [data-open="navigation"]').click();
  await expect(page.locator('#navigation')).toBeVisible();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
}

async function enter(page: Page, currentPage = 1) {
  await page.locator('#event-enter').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await expect(page.locator('#mini-window')).toBeVisible();
  await expect(page.locator('#page-title')).toHaveText(`Page ${currentPage} / 5`);
}

async function acknowledge(page: Page, n: number) {
  await page.locator(`.guide-page[data-page="${n}"] [data-guide-ack]`).click();
  await expect(page.locator(`[data-action="page-${n}"]`)).toHaveAttribute(
    'data-acknowledged',
    'true',
  );
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
}

async function state(page: Page) {
  return JSON.parse((await page.locator('#event-diagnostics').textContent())!);
}

const restarts = ['browser reload', 'Reload Page', 'Simulate App Restart'] as const;
async function restart(page: Page, kind: (typeof restarts)[number]) {
  if (kind === 'browser reload') await page.reload();
  else if (kind === 'Reload Page')
    await Promise.all([page.waitForEvent('load'), page.locator('#event-reload').click()]);
  else await page.locator('#event-restart').click();
  if (kind === 'Simulate App Restart') {
    await expect(page.locator('#home')).toBeHidden();
    await expect(page.locator('#navigation')).toBeVisible();
  } else {
    await expect(page.locator('#home')).toBeVisible();
  }
  await module04(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#mini-window')).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await module04(page);
});

for (const kind of restarts)
  for (const viewed of [1, 2])
    test(`Final QA guide ${kind}: viewed ${viewed} resumes first unacknowledged page 3 automatically`, async ({
      page,
    }) => {
      await enter(page);
      await acknowledge(page, 1);
      await acknowledge(page, 2);
      await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
      await page.locator('.guide-page[data-page="3"]').evaluate((e) => (e.scrollTop = 220));
      await page.locator(`[data-action="page-${viewed}"]`).click();
      await expect(page.locator('#page-title')).toHaveText(`Page ${viewed} / 5`);
      await expect(page.locator('#event-save-status')).toHaveText('SAVED');
      expect((await state(page)).acknowledgedPages).toEqual([1, 2]);

      await restart(page, kind);
      expect((await state(page)).acknowledgedPages).toEqual([1, 2]);
      await enter(page, 3);
      const restored = await state(page);
      expect(restored.acknowledgedPages).toEqual([1, 2]);
      expect(restored.guideCompleted).toBe(false);
      expect(restored.guideMode).toBe('reading');
      expect(await page.locator('.guide-page[data-page="3"]').evaluate((e) => e.scrollTop)).toBe(0);
      await expect(page.locator('.guide-page[data-page="3"] [data-guide-ack]')).toBeVisible();
      await expect(page.locator('.guide-page[data-page="1"] [data-guide-ack]')).toBeHidden();
      await expect(page.locator('.guide-page[data-page="2"] [data-guide-ack]')).toBeHidden();
      await expect(page.locator('[data-action="page-4"]')).toHaveAttribute('data-locked', 'true');
      await page.locator('[data-action="page-4"]').click();
      await expect(page.locator('#page-title')).toHaveText('Page 3 / 5');
      await expect(page.locator('#guide-popup')).toHaveText(
        'Следующая часть откроется после прочтения текущей',
      );
      await acknowledge(page, 3);
      await expect(page.locator('#page-title')).toHaveText('Page 4 / 5');
      expect((await state(page)).acknowledgedPages).toEqual([1, 2, 3]);
    });

test('Final QA guide incomplete reentry resumes first unread while same-session Help retains viewed page at top', async ({
  page,
}) => {
  await enter(page);
  await acknowledge(page, 1);
  await acknowledge(page, 2);
  await page.locator('[data-action="page-1"]').click();
  await page.locator('.guide-page[data-page="1"]').evaluate((e) => (e.scrollTop = 180));
  await page.locator('[data-action="mini-close"]').click();
  await expect(page.locator('#mini-window')).toBeHidden();
  await page.locator('#reopen').click();
  await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  expect(await page.locator('.guide-page[data-page="1"]').evaluate((e) => e.scrollTop)).toBe(0);
  await page.locator('[data-action="mini-close"]').click();
  await page.locator('#event-back').click();
  await expect(page.locator('#event-world')).toBeVisible();
  await enter(page, 3);
  expect((await state(page)).acknowledgedPages).toEqual([1, 2]);
});

for (const kind of restarts)
  test(`Final QA guide completed ${kind}: no auto-open, Help reference and no cyclic navigation`, async ({
    page,
  }) => {
    await enter(page);
    for (let n = 1; n <= 5; n++) await acknowledge(page, n);
    await expect(page.locator('#mini-window')).toBeVisible();
    await expect(page.locator('#page-title')).toHaveText('Page 5 / 5');
    await expect(page.locator('#dots [data-acknowledged="true"]')).toHaveCount(5);
    await restart(page, kind);
    await page.locator('#event-enter').click();
    await expect(page.locator('#event-save-status')).toHaveText('SAVED');
    await expect(page.locator('#winter-event')).toBeVisible();
    await expect(page.locator('#mini-window')).toBeHidden();
    await page.locator('#reopen').click();
    await expect(page.locator('#mini-window')).toBeVisible();
    await expect(page.locator('#page-title')).toHaveText('Page 5 / 5');
    await expect(page.locator('#dots [data-acknowledged="true"]')).toHaveCount(0);
    await expect(page.locator('#dots [data-locked="true"]')).toHaveCount(0);
    await expect(page.locator('.guide-page [data-guide-ack]:visible')).toHaveCount(0);
    await expect(page.locator('#page-next')).toBeDisabled();
    const bounds = (await page.locator('#guide-pages').boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.8, bounds.y + 100);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.2, bounds.y + 100, { steps: 6 });
    await expect(page.locator('#guide-pages')).toHaveAttribute('data-gesture-owner', 'HORIZONTAL');
    await page.mouse.up();
    await expect(page.locator('#guide-pages')).toHaveAttribute('data-offset', '0');
    await expect(page.locator('#page-title')).toHaveText('Page 5 / 5');
    expect((await state(page)).guideMode).toBe('reference');
    expect((await state(page)).acknowledgedPages).toEqual([1, 2, 3, 4, 5]);
  });
