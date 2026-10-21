import { test, expect, type Page } from '@playwright/test';

async function openChat(page: Page) {
  if (await page.locator('#home').isVisible())
    await page.locator('.experiment-card[data-open="navigation"]').click();
  await expect(page.locator('#chat-save-status')).toHaveText('SAVED');
  await expect(page.locator('#event-world')).toBeVisible();
}
async function restoredDraft(page: Page, text: string) {
  await page.goto('/');
  await openChat(page);
  await page.locator('#chat-input').fill(text);
  await expect(page.locator('#chat-save-status')).toHaveText('SAVED');
  await page.reload();
  await openChat(page);
  await expect(page.locator('#chat-input')).toHaveValue(text);
}
// A native caret update may precede its queued select/selectionchange notification.
// Deliver synthetic touch Pointer Events in that same task to exercise this order.
async function insertBeforeSelectionNotification(page: Page, start: number, end = start) {
  await page.evaluate(
    ({ start, end }) => {
      const input = document.querySelector<HTMLTextAreaElement>('#chat-input')!;
      input.setSelectionRange(start, end);
      const item = document.querySelector<HTMLElement>('[data-action="chat-emoji-2"]')!;
      const r = item.getBoundingClientRect();
      const args: PointerEventInit = {
        bubbles: true,
        cancelable: true,
        pointerId: 71,
        pointerType: 'touch',
        isPrimary: true,
        button: 0,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      };
      item.dispatchEvent(new PointerEvent('pointerdown', { ...args, buttons: 1 }));
      item.dispatchEvent(new PointerEvent('pointerup', { ...args, buttons: 0 }));
    },
    { start, end },
  );
}

for (const [name, offset] of [
  ['beginning', 0],
  ['middle', 4],
  ['end', 9],
] as const)
  test(`BF04-02 restored draft uses live ${name} caret before queued selection notification`, async ({
    page,
  }) => {
    const text = 'drafttext';
    await restoredDraft(page, text);
    await page.locator('#emojiPickerToggle').click();
    await insertBeforeSelectionNotification(page, offset);
    await expect(page.locator('#chat-input')).toHaveValue(
      text.slice(0, offset) + '😅' + text.slice(offset),
    );
    expect(
      await page.locator('#chat-input').evaluate((e: HTMLTextAreaElement) => ({
        start: e.selectionStart,
        end: e.selectionEnd,
        focused: document.activeElement === e,
      })),
    ).toEqual({ start: offset + 2, end: offset + 2, focused: false });
    await expect(page.locator('#emoji-picker')).toBeVisible();
  });

test('BF04-02 native selectionchange after restored draft supports replacement and repeated picker inserts', async ({
  page,
}) => {
  await restoredDraft(page, 'left 👨‍👩‍👧‍👦 right');
  const input = page.locator('#chat-input');
  await input.focus();
  await page.locator('#emojiPickerToggle').click();
  await insertBeforeSelectionNotification(page, 5, 16);
  await expect(input).toHaveValue('left 😅 right');
  await page.getByRole('button', { name: 'Вставить ❤️', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить ❄️', exact: true }).click();
  await expect(input).toHaveValue('left 😅❤️❄️ right');
  expect(await input.evaluate((e) => document.activeElement === e)).toBe(true);
  expect(await input.evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(11);
  await expect(page.locator('#emoji-picker')).toBeVisible();
  await expect(page.locator('#chat-save-status')).toHaveText('SAVED');
  await page.reload();
  await openChat(page);
  await expect(input).toHaveValue('left 😅❤️❄️ right');
});

test('BF04-02 pointer caret placement, typing and repeated emoji keep one visible DOM selection', async ({
  page,
}) => {
  await restoredDraft(page, 'abcdef');
  const input = page.locator('#chat-input');
  await input.click();
  await input.press('End');
  await page.locator('#emojiPickerToggle').click();
  await page.getByRole('button', { name: 'Вставить 😅', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить 😀', exact: true }).click();
  await expect(input).toHaveValue('abcdef😅😀');
  await input.press('Home');
  await input.pressSequentially('Z');
  await page.getByRole('button', { name: 'Вставить ❤️', exact: true }).click();
  await expect(input).toHaveValue('Z❤️abcdef😅😀');
  expect(await input.evaluate((e) => document.activeElement === e)).toBe(true);
});

test('BF04-02 restored grapheme limit rejects overflow but allows selected emoji replacement at live range', async ({
  page,
}) => {
  const text = 'a'.repeat(499) + '👨‍👩‍👧‍👦';
  await restoredDraft(page, text);
  await page.locator('#emojiPickerToggle').click();
  await insertBeforeSelectionNotification(page, text.length);
  await expect(page.locator('#chat-input')).toHaveValue(text);
  await insertBeforeSelectionNotification(page, 499, text.length);
  await expect(page.locator('#chat-input')).toHaveValue('a'.repeat(499) + '😅');
  await insertBeforeSelectionNotification(page, 499, 501);
  await expect(page.locator('#chat-input')).toHaveValue('a'.repeat(499) + '😅');
});

test('BF04-02 touch caret at restored draft end and repeated native picker taps preserve focus', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 430, height: 932 },
  });
  const page = await context.newPage();
  await restoredDraft(page, 'abc😅');
  const input = page.locator('#chat-input');
  const box = (await input.boundingBox())!;
  await input.tap({ position: { x: box.width - 12, y: 24 } });
  expect(await input.evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(5);
  await page.locator('#emojiPickerToggle').tap();
  await page.getByRole('button', { name: 'Вставить 😅', exact: true }).tap();
  await page.getByRole('button', { name: 'Вставить 😀', exact: true }).tap();
  await expect(input).toHaveValue('abc😅😅😀');
  expect(await input.evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(9);
  expect(await input.evaluate((e) => document.activeElement === e)).toBe(true);
  await expect(page.locator('#emoji-picker')).toBeVisible();
  await context.close();
});
