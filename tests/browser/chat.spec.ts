import { test, expect, type Page } from '@playwright/test';
const input = (page: Page) => page.locator('#chat-input');
const send = (page: Page) => page.locator('#chat-send');
async function ready(page: Page) {
  await expect(page.locator('#event-save-status')).toHaveText('SAVED');
  await expect(page.locator('#chat-save-status')).toHaveText('SAVED');
}
async function saved(page: Page) {
  await expect(page.locator('#chat-save-status')).toHaveText('SAVED');
}
async function history(page: Page) {
  return page.locator('#chat-history').textContent();
}
async function paste(page: Page, text: string, html = false) {
  await input(page).evaluate(
    (e, p) => {
      const data = new DataTransfer();
      data.setData(p.html ? 'text/html' : 'text/plain', p.text);
      e.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    },
    { text, html },
  );
}
async function enter(page: Page) {
  await page.locator('#event-enter').click();
  await expect(page.locator('#mini-window')).toBeVisible();
}
async function closeGuide(page: Page) {
  await page.locator('[data-action="mini-close"]').click();
  await expect(page.locator('#mini-window')).toBeHidden();
}
async function resetModule(page: Page) {
  await page.locator('#module04-reset').click();
  await page.locator('[data-action="event-reset-confirm"]').click();
  await ready(page);
}
async function touchDrag(page: Page, selector: string, dx: number, dy: number) {
  const e = page.locator(selector);
  await e.scrollIntoViewIfNeeded();
  const b = (await e.boundingBox())!;
  const x = b.x + b.width / 2,
    y = b.y + b.height / 2,
    cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 8; i++)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }],
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await ready(page);
});
test('Chat startup is Module 04 world and empty; focus alone does not schedule seeds', async ({
  page,
}) => {
  await expect(page.locator('#navigation')).toBeVisible();
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#chat-messages .chat-line')).toHaveCount(0);
  await input(page).focus();
  await page.waitForTimeout(2200);
  await expect(page.locator('#chat-messages .chat-line')).toHaveCount(0);
  await expect(page.locator('#chat-diagnostics')).toContainText('"triggered": false');
});
test('Chat first pasted world text seeds after 2 seconds with chronological user interleaving', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 1000).toISOString()));
  await paste(page, 'Привет 😅');
  await saved(page);
  await page.clock.runFor(1900);
  await expect(page.locator('#chat-messages .chat-line')).toHaveCount(0);
  await send(page).click();
  await saved(page);
  await page.clock.runFor(150);
  await expect(page.locator('#chat-messages .chat-line')).toHaveCount(2);
  await expect(page.locator('#chat-messages .chat-line').first()).toHaveAttribute(
    'data-author-id',
    'user',
  );
  await expect(page.locator('#chat-messages .chat-line').last()).toHaveAttribute(
    'data-author-id',
    'system',
  );
  for (let n = 0; n < 2; n++) {
    await page.clock.runFor(2050);
    await saved(page);
  }
  await expect(page.locator('#chat-messages .chat-line')).toHaveCount(4);
  await expect(page.locator('#chat-history')).toContainText('Привет всем!');
});
test('Chat event trigger seeds once, real reload midway resumes remaining stable IDs without duplicates', async ({
  page,
}) => {
  await enter(page);
  await page.waitForTimeout(2150);
  await saved(page);
  await expect(page.locator('#chat-history')).toContainText('Событие началось!');
  const first = await page.locator('.chat-line').first().getAttribute('data-message-id');
  await page.reload();
  await ready(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(page.locator('#mini-window')).toBeHidden();
  await expect(page.locator('.chat-line').first()).toHaveAttribute('data-message-id', first!);
  await expect(page.locator('#chat-diagnostics')).toContainText('"next": 3', { timeout: 6500 });
  const ids = await page
    .locator('.chat-line')
    .evaluateAll((es) => es.map((e) => (e as HTMLElement).dataset.messageId));
  expect(new Set(ids).size).toBe(3);
  expect(ids.length).toBe(3);
  await page.locator('#event-enter').click();
  await expect(page.locator('#mini-window')).toBeHidden();
  await expect(page.locator('#chat-diagnostics')).toContainText('"next": 3');
});
test('Chat manual fake has one insert per press, all producers retain six and display four full originals', async ({
  page,
}) => {
  for (let i = 0; i < 8; i++) {
    await page.locator('#chat-random').click();
    await saved(page);
  }
  await expect(page.locator('.chat-line')).toHaveCount(4);
  await expect(page.locator('#chat-diagnostics')).toContainText('"retained": 6');
  await expect(page.locator('#chat-history')).toContainText('старой башне');
  await expect(page.locator('#chat-history')).toContainText('👨‍👩‍👧‍👦');
  const rows = await page.locator('.chat-body').evaluateAll((es) =>
    es.map((e) => ({
      h: e.getBoundingClientRect().height,
      style: getComputedStyle(e).textOverflow,
      overflow: getComputedStyle(e).overflowX,
    })),
  );
  expect(rows.every((r) => r.h <= 22 && r.style === 'ellipsis' && r.overflow === 'hidden')).toBe(
    true,
  );
  await expect(page.locator('.chat-body').last()).toHaveCSS('color', 'rgb(237, 244, 250)');
});
test('Chat live sends only at 4–7 second deadlines, manual insertion works while Live and Stop terminates it', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 1000).toISOString()));
  await page.locator('#chat-live').click();
  await page.clock.runFor(3999);
  await expect(page.locator('.chat-line')).toHaveCount(0);
  await page.clock.runFor(3001);
  await saved(page);
  await expect(page.locator('.chat-line')).toHaveCount(1);
  await page.locator('#chat-random').click();
  await saved(page);
  await expect(page.locator('.chat-line')).toHaveCount(2);
  await page.locator('#chat-stop').click();
  await page.clock.runFor(15000);
  await expect(page.locator('.chat-line')).toHaveCount(2);
  await expect(page.locator('#chat-diagnostics')).toContainText('"live": false');
});
test('Chat reload restores history/draft/settings but never resumes Live; restart always world', async ({
  page,
}) => {
  await page.locator('#nav-scenario').selectOption('back');
  await page.locator('#nav-boundary').selectOption('hidden');
  await page.locator('#nav-faction').selectOption('Premium');
  await input(page).fill('Сохранённый 😅 черновик');
  await page.locator('#chat-random').click();
  await saved(page);
  await enter(page);
  await closeGuide(page);
  await page.locator('#chat-live').click();
  await page.reload();
  await ready(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(input(page)).toHaveValue('Сохранённый 😅 черновик');
  await expect(page.locator('#nav-faction')).toHaveValue('Premium');
  await expect(page.locator('#nav-scenario')).toHaveValue('back');
  await expect(page.locator('#nav-boundary')).toHaveValue('hidden');
  await expect(page.locator('#chat-diagnostics')).toContainText('"live": false');
  await page.locator('#event-enter').click();
  await page.locator('#event-restart').click();
  await ready(page);
  await expect(page.locator('#event-world')).toBeVisible();
  await expect(input(page)).toHaveValue('Сохранённый 😅 черновик');
});
test('Chat event-only reset preserves settings, history, draft and initial seed schedule', async ({
  page,
}) => {
  await input(page).fill('draft 😅');
  await page.locator('#nav-faction').selectOption('Dark');
  await page.locator('#chat-random').click();
  await saved(page);
  const before = await history(page);
  const seed = await page.locator('#chat-diagnostics').textContent();
  await page.locator('#event-reset').click();
  await page.locator('[data-action="event-reset-confirm"]').click();
  await ready(page);
  await expect(input(page)).toHaveValue('draft 😅');
  await expect(page.locator('#nav-faction')).toHaveValue('Dark');
  expect(await history(page)).toBe(before);
  expect(seed).toContain('"triggered": true');
  await expect(page.locator('#chat-diagnostics')).toContainText('"triggered": true');
});
test('Chat full reset confirms, clears only Module 04 including draft/settings/progression and local diagnostics', async ({
  page,
}) => {
  await page.locator('.index [data-open="actions"]').click();
  await page.locator('#release-button').click();
  await page.locator('.index [data-open="navigation"]').click();
  await input(page).fill('delete me');
  await page.locator('#nav-faction').selectOption('Premium');
  await page.locator('#chat-random').click();
  await saved(page);
  await page.locator('#module04-reset').click();
  await expect(page.locator('#event-reset-dialog')).toBeVisible();
  await page.locator('[data-action="event-reset-cancel"]').click();
  await expect(input(page)).toHaveValue('delete me');
  await resetModule(page);
  await expect(input(page)).toHaveValue('');
  await expect(page.locator('#nav-faction')).toHaveValue('Light');
  await expect(page.locator('.chat-line')).toHaveCount(0);
  await expect(page.locator('#chat-diagnostics')).toContainText('"triggered": false');
  await page.locator('.index [data-open="actions"]').click();
  await expect(page.locator('#action-count')).toHaveText('1');
  const reportPromise = page.waitForEvent('download');
  await page.locator('#export-report').click();
  const stream = await (await reportPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const report = JSON.parse(Buffer.concat(chunks).toString());
  expect(report.results.find((r: { id: string }) => r.id === 'BTN-UP').status).toBe('PASS');
  await page.reload();
  await ready(page);
  await expect(page.locator('.chat-line')).toHaveCount(0);
});
test('Chat emoji toggle and identical picker item are separate; emoji-only interaction never focuses text', async ({
  page,
}) => {
  await page.locator('#emojiPickerToggle').click();
  await expect(page.locator('#emoji-picker')).toBeVisible();
  await expect(input(page)).toHaveValue('');
  await expect(page.locator('.emojiPickerItem')).toHaveCount(16);
  await page.getByRole('button', { name: 'Вставить 😅', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить ❤️', exact: true }).click();
  await expect(input(page)).toHaveValue('😅❤️');
  await expect(page.locator('#emoji-picker')).toBeVisible();
  await expect(input(page)).not.toBeFocused();
  await page.locator('#emojiPickerToggle').click();
  await expect(page.locator('#emoji-picker')).toBeHidden();
  await expect(input(page)).not.toBeFocused();
  await send(page).click();
  await saved(page);
  await expect(page.locator('#chat-history')).toContainText('😅❤️');
  await expect(input(page)).not.toBeFocused();
});
test('Chat picker preserves focus/selection while typing, repeated insertions keep picker and caret', async ({
  page,
}) => {
  await input(page).fill('ABCD');
  await input(page).focus();
  await input(page).evaluate((e: HTMLTextAreaElement) => {
    e.setSelectionRange(1, 3);
    e.dispatchEvent(new Event('select'));
  });
  await page.locator('#emojiPickerToggle').click();
  await expect(input(page)).toBeFocused();
  await page.getByRole('button', { name: 'Вставить 😅', exact: true }).click();
  await page.getByRole('button', { name: 'Вставить 🔥', exact: true }).click();
  await expect(input(page)).toHaveValue('A😅🔥D');
  await expect(input(page)).toBeFocused();
  expect(await input(page).evaluate((e: HTMLTextAreaElement) => e.selectionStart)).toBe(5);
  await expect(page.locator('#emoji-picker')).toBeVisible();
  await page.locator('.world-castle').click();
  await expect(page.locator('#emoji-picker')).toBeHidden();
  await expect(input(page)).not.toBeFocused();
});
test('Chat empty/whitespace/tag-only sends are silent; actual placeholder text can be sent', async ({
  page,
}) => {
  for (const text of ['', '   ', '<b></b>']) {
    await input(page).fill(text);
    await send(page).click();
  }
  await expect(page.locator('.chat-user')).toHaveCount(0);
  await expect(page.locator('#chat-popup')).toBeEmpty();
  await input(page).fill('Введите сообщение...');
  await send(page).click();
  await saved(page);
  await expect(page.locator('.chat-user .chat-body')).toHaveText('Введите сообщение...');
});
test('Chat ReleaseButton send rearms on return, stays put, cancels outside and PointerCancel', async ({
  page,
}) => {
  await input(page).fill('release 😅');
  await send(page).scrollIntoViewIfNeeded();
  const b = (await send(page).boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await expect(send(page)).toHaveAttribute('data-pressed', 'true');
  await page.mouse.move(x - 130, y);
  await expect(send(page)).toHaveAttribute('data-pressed', 'false');
  await page.mouse.move(x, y);
  await expect(send(page)).toHaveAttribute('data-pressed', 'true');
  await page.mouse.move(x - 130, y);
  await page.mouse.up();
  await expect(page.locator('.chat-user')).toHaveCount(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await send(page).dispatchEvent('pointercancel', { pointerId: 1, bubbles: true });
  await page.mouse.up();
  await expect(page.locator('.chat-user')).toHaveCount(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 180, y);
  await page.mouse.move(x, y);
  await page.mouse.up();
  await saved(page);
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await expect(input(page)).toHaveValue('');
});
test('Chat double diagnostic uses real synchronous claim and one stable accepted transaction', async ({
  page,
}) => {
  await input(page).fill('ровно одно 😅');
  await page.locator('#chat-double').click();
  await saved(page);
  await expect(page.locator('#chat-double-result')).toContainText('PASS');
  for (const key of ['accepted', 'duplicateBlocked', 'draftClears', 'cooldownStarts'])
    await expect(page.locator('#chat-double-result')).toContainText(`"${key}":1`);
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await page.locator('#chat-double').click();
  await expect(page.locator('#chat-double-result')).toContainText('EMPTY');
  await expect(page.locator('.chat-user')).toHaveCount(1);
});
test('Chat cooldown leaves editing available, warns only for a new nonempty attempt and expires at 2500ms', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 1000).toISOString()));
  await input(page).fill('one');
  await send(page).click();
  await saved(page);
  await send(page).click();
  await expect(page.locator('#chat-popup')).toBeEmpty();
  await input(page).fill('two');
  await send(page).click();
  await expect(page.locator('#chat-popup')).toContainText('Чуть-чуть подождём!');
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await expect(input(page)).toHaveValue('two');
  await page.clock.runFor(2499);
  await send(page).click();
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await page.clock.runFor(1);
  await send(page).click();
  await saved(page);
  await expect(page.locator('.chat-user')).toHaveCount(2);
});
for (const path of ['paste', 'native-input', 'composition', 'picker'])
  test(`Chat 500 grapheme cap handles ${path} without destroying original suffix`, async ({
    page,
  }) => {
    const family = '👨‍👩‍👧‍👦';
    const base = 'a'.repeat(499) + 'Z';
    await input(page).fill(base);
    await input(page).focus();
    await input(page).evaluate((e: HTMLTextAreaElement) => {
      e.setSelectionRange(499, 499);
      e.dispatchEvent(new Event('select'));
    });
    if (path === 'paste') await paste(page, family.repeat(3));
    if (path === 'native-input')
      await input(page).evaluate((e: HTMLTextAreaElement, emoji) => {
        e.value = e.value.slice(0, 499) + emoji + e.value.slice(499);
        e.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'insertText', data: emoji }),
        );
      }, family);
    if (path === 'composition')
      await input(page).evaluate((e: HTMLTextAreaElement, emoji) => {
        e.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        e.value = e.value.slice(0, 499) + emoji + e.value.slice(499);
        e.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
        e.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: emoji }));
      }, family);
    if (path === 'picker') {
      await page.locator('#emojiPickerToggle').click();
      await page.getByRole('button', { name: 'Вставить 😅', exact: true }).click();
    }
    await expect(input(page)).toHaveValue(base);
    await input(page).evaluate((e: HTMLTextAreaElement) => {
      e.setSelectionRange(498, 499);
      e.dispatchEvent(new Event('select'));
    });
    await paste(page, family);
    await expect(input(page)).toHaveValue('a'.repeat(498) + family + 'Z');
    await saved(page);
    await page.reload();
    await ready(page);
    await expect(input(page)).toHaveValue('a'.repeat(498) + family + 'Z');
  });
test('Chat filters typing/paste/rich text directives and renders stored content through text-only APIs', async ({
  page,
}) => {
  await input(page).pressSequentially('До <color=red>текст</color> <script>code</script>');
  await paste(
    page,
    ' <img src=x onerror="window.pwned=1">😅 <url=https://example.com>ссылка</url>',
    true,
  );
  await expect(input(page)).toHaveValue('До текст code 😅 ссылка');
  await send(page).click();
  await saved(page);
  await expect(page.locator('#chat-history')).toContainText('До текст code 😅 ссылка');
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false);
  await expect(
    page.locator('#chat-messages img,#chat-messages script,#chat-messages a'),
  ).toHaveCount(0);
  await input(page).fill('&lt;script&gt;alert(1)&lt;/script&gt; https://example.org');
  await saved(page);
  await page.reload();
  await ready(page);
  await expect(input(page)).toHaveValue(
    '&lt;script&gt;alert(1)&lt;/script&gt; https://example.org',
  );
});
for (const width of [320, 390, 844])
  test(`Chat responsive ${width}: one-line bodies, opaque surfaces and bottom aligned 48px buttons`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
    for (let i = 0; i < 3; i++) {
      await page.locator('#chat-random').click();
      await saved(page);
    }
    const dimensions = [];
    for (const lines of ['one', 'one\ntwo', 'one\ntwo\nthree', 'one\ntwo\nthree\nfour\nfive']) {
      await input(page).fill(lines);
      await page.waitForTimeout(160);
      const a = (await input(page).boundingBox())!,
        l = (await page.locator('#emojiPickerToggle').boundingBox())!,
        r = (await send(page).boundingBox())!;
      dimensions.push(a.height);
      expect(l.width).toBe(48);
      expect(l.height).toBe(48);
      expect(r.width).toBe(48);
      expect(r.height).toBe(48);
      expect(Math.abs(l.y + l.height - (a.y + a.height))).toBeLessThan(1);
      expect(Math.abs(r.y + r.height - (a.y + a.height))).toBeLessThan(1);
    }
    expect(dimensions[1]).toBeGreaterThan(dimensions[0]);
    expect(dimensions[2]).toBeGreaterThan(dimensions[1]);
    expect(dimensions[3]).toBe(dimensions[2]);
    expect(await input(page).evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
    await expect(page.locator('#clan-chat')).toHaveCSS('background-color', 'rgb(23, 40, 57)');
    await expect(page.locator('#chat-message-area')).toHaveCSS(
      'background-color',
      'rgb(16, 30, 45)',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('Chat compact area popup excludes input; outside guide interaction dismisses picker without changing guide rules', async ({
  page,
}) => {
  await page.locator('#chat-message-area').click();
  await expect(page.locator('#chat-popup')).toHaveText('Чат в разработке');
  await enter(page);
  await page.locator('#emojiPickerToggle').click();
  await expect(page.locator('#emoji-picker')).toBeVisible();
  await page.locator('#page-title').click();
  await expect(page.locator('#emoji-picker')).toBeHidden();
  await expect(page.locator('#mini-window')).toBeVisible();
  await expect(page.locator('#event-back')).toBeVisible();
  expect(await page.locator('#event-back').evaluate((e) => !!e.closest('[inert]'))).toBe(true);
});
test('Chat system text is yellow semibold, user distinct, clan IDs have stable individual badges', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(() => new Date(Date.now() + 1000).toISOString()));
  await input(page).fill('user');
  await send(page).click();
  await saved(page);
  await page.clock.runFor(2050);
  await saved(page);
  await expect(page.locator('.chat-system .chat-body')).toHaveCSS('color', 'rgb(255, 225, 132)');
  await expect(page.locator('.chat-system .chat-body')).toHaveCSS('font-weight', '600');
  await expect(page.locator('.chat-system .chat-badge')).toHaveCSS('border-top-width', '0px');
  await expect(page.locator('.chat-user .chat-body')).toHaveCSS('color', 'rgb(199, 231, 255)');
  await page.clock.runFor(4000);
  await saved(page);
  await expect(page.locator('[data-author-id="kraken"] .chat-badge')).toHaveCSS(
    'color',
    'rgb(255, 194, 141)',
  );
});
test('Chat home/index strip touch scroll starts on button surface, cancels tap and reaches 06', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 360, height: 780 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await ready(page);
  await page.locator('#back-index').tap();
  await touchDrag(page, '.home-module-strip [data-open="actions"]', -140, 0);
  await expect
    .poll(() => page.locator('.home-module-strip').evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(50);
  await expect(page.locator('#home')).toBeVisible();
  await page.locator('.home-module-strip [data-open="draft-recovery"]').tap();
  await expect(page.locator('#draft-recovery')).toBeVisible();
  await context.close();
});
test('Chat reduced-motion snow is nonblocking and unintended scene/preview overscroll is locally contained', async ({
  page,
}) => {
  await enter(page);
  await expect(page.locator('.snowflakes')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('.snowflakes span').first()).not.toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.snowflakes span').first()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#event-game')).toHaveCSS('overscroll-behavior-y', 'none');
  await page.locator('.index [data-open="carousel"]').click();
  await expect(page.locator('#workspace .preview-frame')).toHaveCSS(
    'overscroll-behavior-y',
    'none',
  );
  await expect(page.locator('#modules')).toHaveCSS('overscroll-behavior-y', 'none');
  expect(await page.locator('html').evaluate((e) => getComputedStyle(e).touchAction)).toBe('auto');
});

test('Chat actual IndexedDB send abort preserves draft, reports failure and Retry commits once', async ({
  page,
}) => {
  await input(page).fill('durable 😅');
  await saved(page);
  await page.evaluate(() => {
    const old = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const q = old.call(this, value, key!);
      if (
        key === 'module04-chat-v1' &&
        value.data?.messages?.some((m: { type: string }) => m.type === 'user')
      ) {
        IDBObjectStore.prototype.put = old;
        this.transaction.abort();
      }
      return q;
    };
  });
  await send(page).click();
  await expect(page.locator('#chat-save-status')).toContainText('SAVE_FAILED');
  await expect(input(page)).toHaveValue('durable 😅');
  await expect(page.locator('#chat-diagnostics')).toContainText('"cooldownUntil": 0');
  await page.locator('#chat-retry').click();
  await saved(page);
  await expect(page.locator('.chat-user')).toHaveCount(1);
  await expect(input(page)).toHaveValue('');
  await page.reload();
  await ready(page);
  await expect(page.locator('#chat-history')).toContainText('durable 😅');
});
test('Chat pending real send keeps synchronous claim; a newer composed draft survives commit', async ({
  page,
}) => {
  await input(page).fill('first');
  await saved(page);
  await page.evaluate(async () => {
    const path = '/src/chat-state.ts';
    const { ChatRepository } = await import(path);
    const old = ChatRepository.prototype.write;
    ChatRepository.prototype.write = async function (
      ...args: Parameters<import('../../src/chat-state').ChatRepository['write']>
    ) {
      if (args[2].type === 'send') {
        ChatRepository.prototype.write = old;
        await new Promise<void>(
          (resolve) =>
            ((window as typeof window & { releaseChat: () => void }).releaseChat = resolve),
        );
      }
      return old.apply(this, args);
    };
  });
  await send(page).click();
  await expect(page.locator('#chat-save-status')).toHaveText('SAVING');
  await input(page).fill('next draft');
  await send(page).click();
  await expect(page.locator('#chat-diagnostics')).toContainText('"duplicateBlocked": 1');
  await expect(page.locator('#chat-popup')).toBeEmpty();
  await page.evaluate(() => (window as typeof window & { releaseChat: () => void }).releaseChat());
  await saved(page);
  await expect(input(page)).toHaveValue('next draft');
  await expect(page.locator('.chat-user .chat-body')).toHaveText('first');
  await page.reload();
  await ready(page);
  await expect(input(page)).toHaveValue('next draft');
});
test('Chat full reset fences delayed producer write and pending seeds in actual storage', async ({
  page,
}) => {
  await input(page).fill('old draft');
  await saved(page);
  await page.evaluate(async () => {
    const path = '/src/chat-state.ts';
    const { ChatRepository } = await import(path);
    const old = ChatRepository.prototype.write;
    ChatRepository.prototype.write = async function (
      ...args: Parameters<import('../../src/chat-state').ChatRepository['write']>
    ) {
      ChatRepository.prototype.write = old;
      await new Promise<void>(
        (resolve) =>
          ((window as typeof window & { releaseChat: () => void }).releaseChat = resolve),
      );
      const r = await old.apply(this, args);
      (window as typeof window & { chatSettled: boolean }).chatSettled = true;
      return r;
    };
  });
  await page.locator('#chat-random').click();
  await expect(page.locator('#chat-save-status')).toHaveText('SAVING');
  await resetModule(page);
  await page.evaluate(() => (window as typeof window & { releaseChat: () => void }).releaseChat());
  await page.waitForFunction(
    () => (window as typeof window & { chatSettled: boolean }).chatSettled,
  );
  await page.reload();
  await ready(page);
  await expect(input(page)).toHaveValue('');
  await expect(page.locator('.chat-line')).toHaveCount(0);
  await expect(page.locator('#chat-diagnostics')).toContainText('"triggered": false');
});
test('Chat full reset is atomic with event progress on transaction abort, then Retry clears both', async ({
  page,
}) => {
  await input(page).fill('must survive abort');
  await saved(page);
  await enter(page);
  await page.locator('.guide-page[data-page="1"] [data-guide-ack]').click();
  await expect(page.locator('#page-title')).toHaveText('Page 2 / 5');
  await page.evaluate(() => {
    const old = IDBObjectStore.prototype.clear;
    IDBObjectStore.prototype.clear = function () {
      const q = old.call(this);
      IDBObjectStore.prototype.clear = old;
      this.transaction.abort();
      return q;
    };
  });
  await page.locator('#module04-reset').click();
  await page.locator('[data-action="event-reset-confirm"]').click();
  await expect(page.locator('#event-save-status')).toContainText('SAVE_FAILED');
  const before = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const q = indexedDB.open('dkw-event-guide-v1', 1);
      q.onsuccess = () => resolve(q.result);
      q.onerror = () => reject(q.error);
    });
    return new Promise<{ draft: string; ack: number[] }>((resolve, reject) => {
      const tx = db.transaction('events'),
        s = tx.objectStore('events'),
        a = s.get('module04-chat-v1'),
        b = s.get('winter-lab-2026-01');
      tx.oncomplete = () => {
        resolve({ draft: a.result.data.draft, ack: b.result.state.acknowledgedPages });
        db.close();
      };
      tx.onerror = () => reject(tx.error);
    });
  });
  expect(before.draft).toBe('must survive abort');
  expect(before.ack).toEqual([1]);
  await page.locator('#event-retry').click();
  await ready(page);
  await expect(input(page)).toHaveValue('');
  await expect(page.locator('#event-diagnostics')).toContainText('"eventEntered": false');
});
test('Chat recovered drafts, fake and system text are all sanitized and rendered inertly', async ({
  page,
}) => {
  await page.evaluate(async () => {
    const path = '/src/chat-state.ts';
    const { ChatRepository } = await import(path);
    const r = await new ChatRepository().acquire();
    r.data.draft = '<b>восстановленный😅</b>';
    r.data.messages = [
      {
        id: 'unsafe-system',
        authorId: 'system',
        timestamp: Date.now(),
        sequence: 1,
        type: 'system',
        text: '<color=red>жёлтый</color> <img src=x onerror="window.pwned=1">😅',
      },
      {
        id: 'unsafe-clan',
        authorId: 'kraken',
        timestamp: Date.now(),
        sequence: 2,
        type: 'clan',
        text: '<url=https://example.org>клан</url> &lt;script&gt;',
      },
    ];
    r.data.sequence = 2;
    const db = await new Promise<IDBDatabase>((resolve) => {
      const q = indexedDB.open('dkw-event-guide-v1', 1);
      q.onsuccess = () => resolve(q.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('events', 'readwrite');
      tx.objectStore('events').put(r, 'module04-chat-v1');
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => reject(tx.error);
    });
  });
  await page.reload();
  await ready(page);
  await expect(input(page)).toHaveValue('восстановленный😅');
  await expect(page.locator('#chat-history')).toContainText('жёлтый 😅');
  await expect(page.locator('.chat-clan .chat-body')).toHaveText('клан &lt;script&gt;');
  await expect(page.locator('#clan-chat img,#clan-chat a,#clan-chat script')).toHaveCount(0);
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false);
});
test('Chat narrow native touch scrolls the constrained picker itself from emoji surfaces', async ({
  browser,
}) => {
  const c = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 360, height: 640 },
  });
  const p = await c.newPage();
  await p.goto('/');
  await ready(p);
  await p.locator('#emojiPickerToggle').tap();
  await p.locator('#emoji-picker').evaluate((e: HTMLElement) => (e.style.maxHeight = '100px'));
  await touchDrag(p, '.emojiPickerItem:first-child', 0, -70);
  await expect
    .poll(() => p.locator('#emoji-picker').evaluate((e) => e.scrollTop))
    .toBeGreaterThan(20);
  await expect(input(p)).toHaveValue('');
  await expect(p.locator('#emoji-picker')).toBeVisible();
  await c.close();
});
test('Chat typing at the grapheme limit keeps suffix and cannot split existing cluster selections', async ({
  page,
}) => {
  const family = '👨‍👩‍👧‍👦';
  await input(page).fill('a'.repeat(499) + family);
  await input(page).press('End');
  await input(page).pressSequentially('overflow');
  await expect(input(page)).toHaveValue('a'.repeat(499) + family);
  await input(page).evaluate((e: HTMLTextAreaElement) => {
    e.setSelectionRange(500, 500);
    e.dispatchEvent(new Event('select'));
  });
  await page.locator('#emojiPickerToggle').click();
  await page.getByRole('button', { name: 'Вставить 😅', exact: true }).click();
  await expect(input(page)).toHaveValue('a'.repeat(499) + family);
});

for (const restart of [false, true])
  test(`Chat failed full reset cannot contaminate later event-only reset; restart=${restart}`, async ({
    page,
  }) => {
    await input(page).fill('keep this draft 😅');
    await page.locator('#nav-faction').selectOption('Premium');
    await page.locator('#chat-random').click();
    await saved(page);
    await page.evaluate(() => {
      const old = IDBObjectStore.prototype.clear;
      IDBObjectStore.prototype.clear = function () {
        const q = old.call(this);
        IDBObjectStore.prototype.clear = old;
        this.transaction.abort();
        return q;
      };
    });
    await page.locator('#module04-reset').click();
    await page.locator('[data-action="event-reset-confirm"]').click();
    await expect(page.locator('#event-save-status')).toContainText('SAVE_FAILED');
    if (restart) {
      await page.locator('#event-restart').click();
      await ready(page);
    }
    await page.locator('#event-reset').click();
    await page.locator('[data-action="event-reset-confirm"]').click();
    await ready(page);
    await expect(input(page)).toHaveValue('keep this draft 😅');
    await expect(page.locator('#nav-faction')).toHaveValue('Premium');
    await expect(page.locator('#chat-history')).not.toHaveText('История пуста');
    await expect(page.locator('#event-world')).toBeVisible();
  });

test('Chat composer growth uses a real monotonic height transition, without an intermediate auto-height jump', async ({
  page,
}) => {
  await input(page).fill('one');
  await page.waitForTimeout(160);
  const samples = await input(page).evaluate(async (e: HTMLTextAreaElement) => {
    e.value = 'one\ntwo\nthree';
    e.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'one\ntwo\nthree' }),
    );
    await new Promise(requestAnimationFrame);
    const animations = e
      .getAnimations()
      .filter((a) => a instanceof CSSTransition && a.transitionProperty === 'height').length;
    const start = e.getBoundingClientRect().height;
    await new Promise((r) => setTimeout(r, 40));
    const middle = e.getBoundingClientRect().height;
    await new Promise((r) => setTimeout(r, 180));
    const end = e.getBoundingClientRect().height;
    return { animations, start, middle, end };
  });
  expect(samples.animations).toBeGreaterThan(0);
  expect(samples.middle).toBeGreaterThan(samples.start);
  expect(samples.middle).toBeLessThan(samples.end);
  expect(samples.end).toBe(96);
});
