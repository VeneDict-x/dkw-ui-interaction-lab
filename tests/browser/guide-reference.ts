import { expect, type Page } from '@playwright/test';
// Original free-navigation regressions now run in the owner-approved completed reference mode.
// Progress is earned through actual acknowledgments; no storage seeding/unlocking test shortcut.
export async function prepareGuideReference(page: Page) {
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  if (await page.locator('#event-world').isVisible()) await page.locator('#event-enter').click();
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  if (!(await page.locator('#mini-window').isVisible())) await page.locator('#reopen').click();
  const value = JSON.parse((await page.locator('#event-diagnostics').textContent())!);
  if (!value.guideCompleted) {
    for (let n = value.acknowledgedPages.length + 1; n <= 5; n++) {
      await page.locator(`.guide-page[data-page="${n}"] [data-guide-ack]`).click();
      await expect(page.locator('#event-save-status')).toHaveText('SAVED');
      await expect(page.locator(`[data-action="page-${n}"]`)).toHaveAttribute(
        'data-acknowledged',
        'true',
      );
    }
    await page.locator('[data-action="mini-close"]').click();
    await page.locator('#reopen').click();
    await page.locator('[data-action="page-1"]').click();
    await expect(page.locator('#page-title')).toHaveText('Page 1 / 5');
  }
}
