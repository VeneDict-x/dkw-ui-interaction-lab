import { test, expect, type Page } from '@playwright/test';
async function open(page: Page, id: string) {
  await page.locator(`.index [data-open="${id}"]`).click();
}
async function config(page: Page, key: string, value: number) {
  await page.locator('#debug-details').evaluate((e: HTMLDetailsElement) => (e.open = true));
  await page.locator(`[data-config="${key}"]`).fill(String(value));
  await page.locator(`[data-config="${key}"]`).dispatchEvent('change');
}
async function pt(page: Page, selector: string) {
  const el = page.locator(selector);
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  if (!b) throw Error('missing bounds');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b };
}
test.beforeEach(async ({ page }) => {
  await page.goto('/');
});
test('BF03 Strict Tap permits large movement wholly inside', async ({ page }) => {
  await open(page, 'buttons');
  const p = await pt(page, '[data-action="basic"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.b.x + 10, p.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await expect(page.locator('#basic-count')).toHaveText('1 actions');
});
test('BF03 repeat availability isolated from hold availability', async ({ page }) => {
  await open(page, 'buttons');
  await config(page, 'holdDelay', 80);
  await config(page, 'repeatMs', 100);
  const p = await pt(page, '#repeat-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await expect(page.locator('#repeat-state')).toHaveText('HOLDING · READY');
  await page.locator('#availability').evaluate((e: HTMLInputElement) => {
    e.checked = false;
    e.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.locator('#repeat-state')).toHaveText('HOLDING · READY');
  const n = parseInt((await page.locator('#repeat-count').textContent())!);
  await page.waitForTimeout(220);
  expect(parseInt((await page.locator('#repeat-count').textContent())!)).toBeGreaterThan(n);
  await page.mouse.up();
});
test('BF03 Hidden keeps Next in independent right slot', async ({ page }) => {
  await open(page, 'navigation');
  const b = await page.locator('#page-next').boundingBox();
  await page.locator('#nav-boundary').selectOption('hidden');
  await expect(page.locator('#page-back')).toBeHidden();
  const a = await page.locator('#page-next').boundingBox();
  expect(a!.x).toBeCloseTo(b!.x, 1);
});

test('BF03 ordinary exit below Slop permanently cancels reentry; fresh press works', async ({
  page,
}) => {
  await open(page, 'buttons');
  const p = await pt(page, '[data-action="basic"]');
  await page.mouse.move(p.b.x + 2, p.y);
  await page.mouse.down();
  await page.mouse.move(p.b.x - 2, p.y);
  await page.mouse.move(p.b.x + 2, p.y);
  await expect(page.locator('[data-action="basic"]')).toHaveAttribute('data-pressed', 'false');
  await page.mouse.up();
  await expect(page.locator('#basic-count')).toHaveText('0 actions');
  await page.locator('[data-action="basic"]').click();
  await expect(page.locator('#basic-count')).toHaveText('1 actions');
});
for (const phase of ['initial', 'active'] as const)
  for (const end of [
    'up',
    'cancel',
    'lostcapture',
    'blur',
    'hidden',
    'contextmenu',
    'pagehide',
  ] as const) {
    test(`BF03 lifecycle ${phase} / ${end} terminates without orphan actions`, async ({ page }) => {
      await open(page, 'buttons');
      await config(page, 'holdDelay', 100);
      await config(page, 'repeatMs', 100);
      await config(page, 'acceleration', 0);
      await page.clock.install();
      await page.clock.pauseAt(new Date(Date.now() + 1000));
      const p = await pt(page, '#repeat-button');
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.clock.runFor(phase === 'initial' ? 30 : 450);
      if (end === 'up') {
        await page.mouse.move(p.x + p.b.width + 40, p.y);
        await page.mouse.up();
      } else if (end === 'blur' || end === 'pagehide')
        await page.evaluate((name) => window.dispatchEvent(new Event(name)), end);
      else if (end === 'hidden')
        await page.evaluate(() => {
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
      else
        await page
          .locator('#repeat-button')
          .dispatchEvent(
            end === 'cancel'
              ? 'pointercancel'
              : end === 'lostcapture'
                ? 'lostpointercapture'
                : 'contextmenu',
            { pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true },
          );
      await page.clock.runFor(17); // Flush queued UI frame after synthetic terminal event.
      await expect(page.locator('#repeat-state')).toHaveText('IDLE · READY');
      const count = await page.locator('#repeat-count').textContent();
      if (phase === 'initial') expect(count).toBe('0 actions');
      await page.clock.runFor(2500);
      await expect(page.locator('#repeat-count')).toHaveText(count!);
      if (end === 'hidden')
        await page.evaluate(() => {
          Reflect.deleteProperty(document, 'hidden');
          document.dispatchEvent(new Event('visibilitychange'));
        });
      await page.mouse.up();
      await page.locator('[data-action="basic"]').click();
      await page.clock.runFor(17); // Recovery action also renders on rAF.
      await expect(page.locator('#basic-count')).toHaveText('1 actions');
    });
  }
test('BF03 sixteen initial-delay values preserve recognition and later cadence, steps unchanged', async ({
  page,
}) => {
  await open(page, 'buttons');
  await config(page, 'holdDelay', 100);
  await config(page, 'repeatMs', 200);
  await config(page, 'acceleration', 0);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const slider = page.locator('#repeat-delay');
  for (let v = 10; v <= 25; v++) {
    await slider.evaluate((el: HTMLInputElement, n) => (el.value = String(n)), v);
    await slider.dispatchEvent('input');
    await expect(page.locator('#repeat-delay-value')).toHaveText((v / 10).toFixed(1) + '×');
  }
  const p = await pt(page, '#repeat-button');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.clock.runFor(120); // Include the first frame after 100 ms recognition.
  await expect(page.locator('#repeat-state')).toHaveText('HOLDING · READY');
  await expect(page.locator('#repeat-count')).toHaveText('1 actions');
  await page.clock.runFor(450);
  await expect(page.locator('#repeat-count')).toHaveText('1 actions');
  await page.clock.runFor(50);
  await expect(page.locator('#repeat-count')).toHaveText('2 actions');
  await page.clock.runFor(200);
  await expect(page.locator('#repeat-count')).toHaveText('3 actions');
  await page.mouse.up();
  const q = await pt(page, '#plus');
  await page.mouse.move(q.x, q.y);
  await page.mouse.down();
  await page.clock.runFor(310);
  await expect(page.locator('#step-value')).toHaveValue('7');
  await page.mouse.up();
});
test('BF03 timed availability pause 2 s resume 4 s from trigger', async ({ page }) => {
  await open(page, 'buttons');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.locator('[data-action="pause-after"]').click();
  await page.clock.runFor(1900);
  await expect(page.locator('#availability')).toBeChecked();
  await page.clock.runFor(150);
  await expect(page.locator('#availability')).not.toBeChecked();
  await page.clock.runFor(1800);
  await expect(page.locator('#availability')).not.toBeChecked();
  await page.clock.runFor(200);
  await expect(page.locator('#availability')).toBeChecked();
});
test('BF03 scoped selection protection keeps editor fields and diagnostic text selectable', async ({
  page,
}) => {
  await open(page, 'buttons');
  await expect(page.locator('#repeat-button')).toHaveCSS('user-select', 'none');
  await expect(page.locator('#hold-button')).toHaveCSS('user-select', 'none');
  await open(page, 'resize');
  await expect(page.locator('#resize-draft')).not.toHaveCSS('user-select', 'none');
  await expect(page.locator('#actual-viewport')).not.toHaveCSS('user-select', 'none');
});
test('BF03 Navigation slots first last middle, hidden targets absent, close retains page', async ({
  page,
}) => {
  await open(page, 'navigation');
  await page.locator('#nav-boundary').selectOption('hidden');
  const next = (await page.locator('#page-next').boundingBox())!;
  await page.locator('[data-action="page-3"]').click();
  expect((await page.locator('#page-next').boundingBox())!.x).toBeCloseTo(next.x, 1);
  const back = (await page.locator('#page-back').boundingBox())!;
  await page.locator('[data-action="page-5"]').click();
  await expect(page.locator('#page-next')).toBeHidden();
  expect((await page.locator('#page-back').boundingBox())!.x).toBeCloseTo(back.x, 1);
  expect(await page.locator('#page-next').evaluate((e) => e.getClientRects().length)).toBe(0);
  await page.locator('[data-action="mini-close"]').click();
  await page.locator('#reopen').click();
  await expect(page.locator('#page-title')).toHaveText('Page 5 / 5');
});
test('BF03 canonical 1/2/3/4 real cards, 3.5 peek and exact right inset; 5/20 identical width', async ({
  page,
}) => {
  await open(page, 'carousel');
  await page.locator('#carousel-0').evaluate((el) => ((el as HTMLElement).style.width = '411px'));
  let width = 0;
  for (const n of [1, 2, 3, 4, 5, 20]) {
    await page.locator('#card-count').fill(String(n));
    await page.locator('#card-count').dispatchEvent('change');
    await page.locator('#carousel-0').evaluate((el) => ((el as HTMLElement).style.width = '411px'));
    await page.waitForTimeout(70);
    const g = await page.locator('#carousel-0').evaluate((el) => {
      const v = el.getBoundingClientRect(),
        cards = el.querySelectorAll('[data-card]');
      return {
        card: cards[0].getBoundingClientRect().width,
        max: el.scrollWidth - el.clientWidth,
        inset: cards[0].getBoundingClientRect().left - v.left,
      };
    });
    if (!width) width = g.card;
    expect(g.card).toBeCloseTo(width, 1);
    expect(g.inset).toBeCloseTo(4, 1);
    if (n <= 3) {
      expect(g.max).toBe(0);
      await expect(page.locator('[data-action="right-0"]')).toBeHidden();
    } else {
      expect(g.max).toBeGreaterThan(0);
      await expect(page.locator('[data-action="right-0"]')).toBeVisible();
      await page.locator('#carousel-0').evaluate((el) => (el.scrollLeft = el.scrollWidth));
      await expect(page.locator('[data-action="right-0"]')).toBeHidden();
      const end = await page
        .locator('#carousel-0')
        .evaluate(
          (el) =>
            el.getBoundingClientRect().right -
            el.querySelector('[data-card]:last-child')!.getBoundingClientRect().right,
        );
      expect(end).toBeCloseTo(4, 1);
    }
  }
});
test('BF03 unbounded diminishing overscroll, final cancellation springs to zero', async ({
  page,
}) => {
  await open(page, 'carousel');
  await config(page, 'inertia', 0);
  const p = await pt(page, '#carousel-0 [data-card="None"]');
  await page.locator('#carousel-0 [data-card="None"]').dispatchEvent('pointerdown', {
    pointerId: 41,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    clientX: p.x,
    clientY: p.y,
    bubbles: true,
  });
  const values = [];
  for (const dx of [100, 200, 300, 2000]) {
    await page.evaluate(
      ({ dx, p }) =>
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerId: 41,
            pointerType: 'touch',
            clientX: p.x + dx,
            clientY: p.y,
            bubbles: true,
          }),
        ),
      { dx, p },
    );
    values.push(
      await page
        .locator('#carousel-0 .carousel-track')
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
    );
  }
  expect(values[1]).toBeGreaterThan(values[0]);
  expect(values[3]).toBeGreaterThan(100);
  expect(values[2] - values[1]).toBeLessThan(values[1] - values[0]);
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: 41, pointerType: 'touch' }),
    ),
  );
  await expect(page.locator('#carousel-0 .carousel-track')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  );
  await expect(page.locator('#carousel-0 [data-card="None"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
test('BF03 synthetic multitouch owner handoff survives first lift, final lift settles without tap', async ({
  page,
}) => {
  await open(page, 'carousel');
  await config(page, 'inertia', 0);
  const p = await pt(page, '#carousel-0 [data-card="None"]');
  const dispatch = async (type: string, id: number, x: number, primary = false) =>
    page.locator('#carousel-0').dispatchEvent(type, {
      pointerId: id,
      pointerType: 'touch',
      button: 0,
      isPrimary: primary,
      clientX: x,
      clientY: p.y,
      bubbles: true,
    });
  await dispatch('pointerdown', 61, p.x, true);
  await dispatch('pointermove', 61, p.x + 100);
  await dispatch('pointerdown', 62, p.x + 20);
  const before = await page
    .locator('#carousel-0 .carousel-track')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  await dispatch('pointerup', 61, p.x + 100);
  await expect(page.locator('#gesture-metrics')).toContainText('SLOP_CROSSED');
  await dispatch('pointermove', 62, p.x + 220);
  expect(
    await page
      .locator('#carousel-0 .carousel-track')
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
  ).toBeGreaterThan(before);
  await dispatch('pointermove', 61, p.x + 1000);
  await expect(page.locator('#gesture-metrics')).toContainText('CAROUSEL');
  await dispatch('pointerup', 62, p.x + 220);
  await expect(page.locator('#carousel-0 .carousel-track')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  );
  await expect(page.locator('#selected-0')).toHaveText('None');
});
test('BF03 05 Reset cancels pending resize and preserves other module state', async ({ page }) => {
  await open(page, 'buttons');
  await page.locator('[data-action="basic"]').click();
  await open(page, 'navigation');
  await page.locator('[data-action="page-4"]').click();
  await open(page, 'resize');
  await page.locator('#resize-draft').fill('temporary');
  await page.locator('#mock-selection').check();
  await page.locator('#mock-width').fill('240');
  await page.locator('#mock-height').fill('220');
  await page.locator('#reset-test').click();
  await expect(page.locator('#mock-width')).toHaveValue('520');
  await expect(page.locator('#mock-height')).toHaveValue('350');
  await expect(page.locator('#resize-draft')).toHaveValue('State survives resize');
  await expect(page.locator('#mock-selection')).not.toBeChecked();
  await page.waitForTimeout(300);
  await expect(page.locator('#resize-state')).toHaveText('SETTLED');
  await open(page, 'buttons');
  await expect(page.locator('#basic-count')).toHaveText('1 actions');
  await open(page, 'navigation');
  await expect(page.locator('#page-title')).toHaveText('Page 4 / 5');
});
for (const viewport of [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1366, height: 900 },
])
  test(`BF03 240x220 reachable Modules / viewport ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page, 'resize');
    await page.locator('#mock-width').fill('240');
    await page.locator('#mock-height').fill('220');
    await expect(page.locator('#resize-state')).toHaveText('SETTLED');
    await page.locator('#mock-selection').check();
    const r = await page.locator('#mock-selection').boundingBox();
    expect(r!.width).toBeGreaterThanOrEqual(44);
    expect(r!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('#mock-feedback')).toContainText('Requested 240 × 220');
    await expect(page.locator('#resize-validation')).toHaveText('PASS');
    await page.locator('[data-preset="1920,1080"]').click();
    await expect(page.locator('#preset-info')).toContainText('Simulated geometry only');
    await expect(page.locator('#actual-viewport')).toHaveText(
      `${viewport.width} × ${viewport.height}`,
    );
    await page.locator('#mock-width').fill('1000');
    await expect(page.locator('#mock-feedback')).toContainText('CLAMPED');
    await expect(page.locator('#mock-selection')).toBeChecked();
  });

async function draftOpen(page: Page) {
  await open(page, 'draft-recovery');
  await expect(page.locator('#draft-editor-view')).toBeVisible();
  await page.locator('#draft-latency').selectOption('1500');
}
async function choose(page: Page, key: string, value: string) {
  await page.locator(`#draft-carousel-${key} [data-card="${value}"]`).click();
  await expect(page.locator('#draft-current-label')).toContainText(value);
}
async function values(page: Page) {
  return JSON.parse((await page.locator('#draft-values').textContent())!);
}
async function stored(page: Page) {
  return page.evaluate(
    async () =>
      new Promise<any>((resolve, reject) => {
        const r = indexedDB.open('dkw-drafts-v1', 1);
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction('lab', 'readonly'),
            q = tx.objectStore('lab').get('state');
          q.onsuccess = () => resolve(q.result);
          tx.oncomplete = () => db.close();
          q.onerror = () => reject(q.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );
}
test('BF03 Draft all real options render geometric layers; None hides each layer', async ({
  page,
}) => {
  await draftOpen(page);
  for (const shape of ['Square', 'Triangle', 'Diamond', 'Hexagon', 'Octagon']) {
    await choose(page, 'large', shape);
    expect(await page.locator('#draft-composition polygon,#draft-composition rect').count()).toBe(
      1,
    );
  }
  await choose(page, 'small', 'Circle');
  await expect(page.locator('#draft-composition circle')).toHaveCount(1);
  for (const shape of ['Square', 'Diamond']) {
    await choose(page, 'small', shape);
    expect(await page.locator('#draft-composition polygon,#draft-composition rect').count()).toBe(
      2,
    );
  }
  for (const n of ['1', '2', '3', '4']) {
    await choose(page, 'number', n);
    await expect(page.locator('#draft-composition text')).toHaveText(n);
  }
  await choose(page, 'large', 'None');
  await choose(page, 'small', 'None');
  await choose(page, 'number', 'None');
  await expect(page.locator('#draft-composition > *')).toHaveCount(0);
  await expect(page.locator('#draft-apply')).toBeDisabled();
});
test('BF03 incomplete Current autosaves but cannot Apply; labels wait for durable success', async ({
  page,
}) => {
  await draftOpen(page);
  await choose(page, 'number', '3');
  await expect(page.locator('#draft-current-label')).toHaveText('Current: None → None → 3');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'SAVING');
  await expect(page.locator('#draft-persisted-label')).toHaveText('Persisted draft: none');
  await expect(page.locator('#draft-apply')).toBeDisabled();
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  const db = await stored(page);
  expect(db.draft.selection.number).toBe('3');
  expect(db.applied.large).toBe('None');
  await expect(page.locator('#draft-persisted-label')).toContainText('None → None → 3');
});
test('BF03 autosave latency varies within 1500–2500 and remains configurable', async ({ page }) => {
  await draftOpen(page);
  await page.locator('#draft-latency').selectOption('variable');
  const delays = [];
  for (let n = 0; n < 6; n++) {
    await choose(page, 'number', String((n % 4) + 1));
    delays.push((await values(page)).latencyMs);
  }
  for (const ms of delays) {
    expect(ms).toBeGreaterThanOrEqual(1500);
    expect(ms).toBeLessThanOrEqual(2500);
  }
  expect(new Set(delays).size).toBeGreaterThan(1);
  await page.locator('#draft-latency').selectOption('2500');
  await choose(page, 'large', 'Square');
  expect((await values(page)).latencyMs).toBe(2500);
});
test('BF03 out-of-order A after B cannot overwrite newer durable draft', async ({ page }) => {
  await draftOpen(page);
  await page.locator('#draft-latency').selectOption('race');
  await choose(page, 'large', 'Square');
  await choose(page, 'small', 'Circle');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  await page.waitForTimeout(1100);
  const v = await values(page),
    db = await stored(page);
  expect(v.draft.version).toBe(2);
  expect(db.draft.version).toBe(2);
  expect(db.draft.selection.small).toBe('Circle');
  expect(v.applied.large).toBe('None');
});
test('BF03 deterministic save failure / retry never claims success early', async ({ page }) => {
  await draftOpen(page);
  await choose(page, 'large', 'Square');
  await page.locator('[data-action="draft-failure"]').click();
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'SAVE_FAILED');
  expect((await values(page)).editing).toBe(true);
  await page.locator('#draft-retry').click();
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'SAVING');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  expect((await stored(page)).draft.selection.large).toBe('Square');
});
test('BF03 actual storage operation failure reported, successful retry durable', async ({
  page,
}) => {
  await draftOpen(page);
  await page.evaluate(() => {
    const w = window as any;
    w.bf03Transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function () {
      throw Error('Injected platform storage operation failure');
    };
  });
  await choose(page, 'large', 'Triangle');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'SAVE_FAILED');
  await expect(page.locator('#draft-persisted-label')).toHaveText('Persisted draft: none');
  await page.evaluate(() => {
    IDBDatabase.prototype.transaction = (window as any).bf03Transaction;
  });
  await page.locator('#draft-retry').click();
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  expect((await stored(page)).draft.selection.large).toBe('Triangle');
});
test('BF03 Apply during delayed save commits latest Current and cannot resurrect Draft', async ({
  page,
}) => {
  await draftOpen(page);
  await page.locator('#draft-latency').selectOption('2500');
  await choose(page, 'large', 'Square');
  await choose(page, 'small', 'Circle');
  await choose(page, 'number', '3');
  await page.locator('#draft-apply').click();
  await expect(page.locator('#draft-non-editing')).toBeVisible();
  expect((await stored(page)).applied).toEqual({ large: 'Square', small: 'Circle', number: '3' });
  await page.waitForTimeout(2700);
  expect((await stored(page)).draft).toBeNull();
  await page.locator('[data-action="draft-open"]').click();
  await expect(page.locator('#draft-editor-view')).toBeVisible();
  expect((await values(page)).current).toEqual({ large: 'Square', small: 'Circle', number: '3' });
});
test('BF03 Cancel is three-way modal; Continue preserves current and in-flight save', async ({
  page,
}) => {
  await draftOpen(page);
  await choose(page, 'large', 'Triangle');
  await page.locator('[data-action="draft-cancel"]').click();
  await expect(page.locator('#draft-dialog')).toBeVisible();
  expect((await values(page)).editing).toBe(true);
  await expect(page.locator('[data-action="draft-continue"]')).toBeFocused();
  await page.locator('[data-action="draft-continue"]').click();
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  expect((await values(page)).current.large).toBe('Triangle');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  expect((await values(page)).outcome).toBe('CONTINUED_EDITING');
});
test('BF03 modal Escape continues without discard and background retains live editor', async ({
  page,
}) => {
  await draftOpen(page);
  await choose(page, 'large', 'Diamond');
  await page.locator('[data-action="draft-cancel"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  expect((await values(page)).current.large).toBe('Diamond');
  await page.locator('[data-action="draft-background"]').click();
  await expect(page.locator('#draft-editor-view')).toBeVisible();
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect((await values(page)).current.large).toBe('Diamond');
});
test('BF03 confirmed Discard during save restores Applied, no draft resurrection', async ({
  page,
}) => {
  await draftOpen(page);
  await page.locator('#draft-latency').selectOption('2500');
  await choose(page, 'large', 'Hexagon');
  await page.locator('[data-action="draft-cancel"]').click();
  await page.locator('[data-action="draft-discard-confirm"]').click();
  await expect(page.locator('#draft-non-editing')).toBeVisible();
  await page.waitForTimeout(2700);
  const db = await stored(page);
  expect(db.draft).toBeNull();
  expect(db.applied.large).toBe('None');
  expect((await values(page)).outcome).toBe('CANCELLED');
});
test('BF03 Save for later waits for latest Current; failure stays editing with retry', async ({
  page,
}) => {
  await draftOpen(page);
  await choose(page, 'large', 'Octagon');
  await choose(page, 'number', '4');
  await page.locator('[data-action="draft-cancel"]').click();
  await page.locator('[data-action="draft-later-confirm"]').click();
  await expect(page.locator('#draft-editor-view')).toBeVisible();
  await expect(page.locator('#draft-modal-status')).toContainText('waiting for durable');
  await expect(page.locator('#draft-non-editing')).toBeVisible();
  await expect(page.locator('[data-action="draft-open"]')).toBeFocused();
  const db = await stored(page);
  expect(db.draft.selection).toEqual({ large: 'Octagon', small: 'None', number: '4' });
  expect(db.applied.large).toBe('None');
  expect((await values(page)).outcome).toBe('SAVED_FOR_LATER');
});
test('BF03 Save for later injected failure cannot leave editor or claim success', async ({
  page,
}) => {
  await draftOpen(page);
  await choose(page, 'large', 'Square');
  await page.evaluate(async () => {
    const url = '/src/main.ts';
    /* failure control consumes next save; inject storage failure for modal path */ const w =
      window as any;
    w.bf03Transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function () {
      throw Error('Storage failure on save for later');
    };
  });
  await page.locator('[data-action="draft-cancel"]').click();
  await page.locator('[data-action="draft-later-confirm"]').click();
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'SAVE_FAILED');
  await expect(page.locator('#draft-dialog')).toBeVisible();
  await expect(page.locator('#draft-editor-view')).toBeVisible();
  expect((await values(page)).outcome).not.toBe('SAVED_FOR_LATER');
  await page.evaluate(() => (IDBDatabase.prototype.transaction = (window as any).bf03Transaction));
  await expect(page.locator('[data-action="draft-modal-retry"]')).toBeVisible();
  await page.locator('[data-action="draft-modal-retry"]').click();
  await expect(page.locator('#draft-non-editing')).toBeVisible();
});
test('BF03 true reload recovers only durable draft, without changing Applied', async ({ page }) => {
  await draftOpen(page);
  await choose(page, 'large', 'Triangle');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  await choose(page, 'number', '4');
  await page.reload();
  await open(page, 'draft-recovery');
  await expect(page.locator('#draft-dialog-title')).toHaveText('Draft found');
  await page.locator('[data-action="draft-recovery-continue"]').click();
  await expect(page.locator('#draft-editor-view')).toBeVisible();
  expect((await values(page)).current).toEqual({
    large: 'Triangle',
    small: 'None',
    number: 'None',
  });
  expect((await values(page)).applied.large).toBe('None');
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
});
test('BF03 simulated crash before save genuinely drops volatile Current', async ({ page }) => {
  await draftOpen(page);
  await choose(page, 'large', 'Square');
  await page.locator('[data-action="draft-crash-before"]').click();
  await expect(page.locator('#draft-editor-view')).toBeHidden();
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  expect((await values(page)).current.large).toBe('None');
  await page.waitForTimeout(2700);
  expect((await stored(page)).draft).toBeNull();
});
test('BF03 crash after confirmed save, Not now retains draft, Delete needs second confirmation', async ({
  page,
}) => {
  await draftOpen(page);
  await choose(page, 'large', 'Hexagon');
  await expect(page.locator('#draft-save-state')).toHaveAttribute('data-state', 'DRAFT_SAVED');
  await page.locator('[data-action="draft-crash"]').click();
  await expect(page.locator('#draft-dialog-title')).toHaveText('Draft found');
  await page.locator('[data-action="draft-not-now"]').click();
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  expect((await stored(page)).draft.selection.large).toBe('Hexagon');
  await page.locator('[data-action="draft-recover"]').click();
  await page.locator('[data-action="draft-delete"]').click();
  await expect(page.locator('#draft-dialog-title')).toHaveText('Delete retained draft?');
  expect((await stored(page)).draft).not.toBeNull();
  await page.locator('[data-action="draft-dismiss"]').click();
  await expect(page.locator('#draft-dialog-title')).toHaveText('Draft found');
  await page.locator('[data-action="draft-delete"]').click();
  await page.locator('[data-action="draft-delete-confirm"]').click();
  await expect(page.locator('#draft-dialog')).not.toBeVisible();
  expect((await stored(page)).draft).toBeNull();
});
test('BF03 multiple editing sessions cannot leak old writes; cleanup explicit and isolated', async ({
  page,
}) => {
  await open(page, 'buttons');
  await page.locator('[data-action="basic"]').click();
  await draftOpen(page);
  await choose(page, 'large', 'Square');
  await page.locator('#draft-apply').click();
  await page.locator('[data-action="draft-open"]').click();
  await choose(page, 'large', 'Diamond');
  await page.locator('[data-action="draft-cancel"]').click();
  await page.locator('[data-action="draft-discard-confirm"]').click();
  await page.locator('[data-action="draft-open"]').click();
  expect((await values(page)).current.large).toBe('Square');
  await page.waitForTimeout(2700);
  expect((await stored(page)).draft).toBeNull();
  await page.locator('[data-action="draft-cleanup"]').click();
  expect((await stored(page)).applied.large).toBe('Square');
  await page.locator('[data-action="draft-dismiss"]').click();
  await page.locator('[data-action="draft-cleanup"]').click();
  await page.locator('[data-action="draft-clean-confirm"]').click();
  expect((await stored(page)).applied.large).toBe('None');
  await open(page, 'buttons');
  await expect(page.locator('#basic-count')).toHaveText('1 actions');
});

test('BF03 independent controller instances isolate availability, unmount, listeners and timers', async ({
  page,
}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.evaluate(async () => {
    const url = '/src/interaction.ts',
      cfg = '/src/config.ts';
    const { InteractionController } = await import(url),
      { defaults } = await import(cfg);
    const config = { ...defaults(), holdDelay: 100, repeatMs: 100, acceleration: 0 };
    let a = 0,
      b = 0;
    const h: any = { readyA: true, readyB: true };
    for (const id of ['a', 'b']) {
      const root = document.createElement('div');
      root.id = 'harness-' + id;
      root.innerHTML = `<button data-action="fixture-${id}">${id}</button>`;
      document.body.append(root);
      const c = new InteractionController(root, () => config, { log() {}, check() {} });
      c.register('fixture-' + id, {
        hold: true,
        available: () => (id === 'a' ? h.readyA : h.readyB),
        run: () => (id === 'a' ? a++ : b++),
      });
      h[id] = c;
      h['root' + id] = root;
    }
    h.counts = () => ({ a, b });
    (window as any).bf03 = h;
  });
  for (const [id, ptr] of [
    ['a', 101],
    ['b', 102],
  ] as const) {
    const p = await pt(page, `#harness-${id} button`);
    await page.locator(`#harness-${id} button`).dispatchEvent('pointerdown', {
      pointerId: ptr,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: p.x,
      clientY: p.y,
      bubbles: true,
    });
  }
  await page.clock.runFor(350);
  const first = await page.evaluate(() => (window as any).bf03.counts());
  expect(first.a).toBeGreaterThan(1);
  expect(first.b).toBeGreaterThan(1);
  await page.evaluate(() => ((window as any).bf03.readyA = false));
  await page.clock.runFor(300);
  const paused = await page.evaluate(() => (window as any).bf03.counts());
  expect(paused.a).toBe(first.a);
  expect(paused.b).toBeGreaterThan(first.b);
  await page.evaluate(() => {
    const h = (window as any).bf03;
    h.readyA = true;
    h.rootb.remove();
  });
  await page.clock.runFor(300);
  const after = await page.evaluate(() => {
    const h = (window as any).bf03;
    return { ...h.counts(), lifecycle: h.b.lifecycle() };
  });
  expect(after.a).toBeGreaterThan(paused.a);
  expect(after.b).toBe(paused.b);
  expect(after.lifecycle).toEqual({ active: false, pendingTimers: 0, disposed: true });
  await page.evaluate(() => (window as any).bf03.a.destroy());
  await page.clock.runFor(3000);
  const ended = await page.evaluate(() => {
    const h = (window as any).bf03;
    return { counts: h.counts(), lifecycle: h.a.lifecycle() };
  });
  expect(ended.counts).toEqual({ a: after.a, b: after.b });
  expect(ended.lifecycle.pendingTimers).toBe(0);
});
test('BF03 Chromium native multitouch handoff keeps CAROUSEL until last finger release', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await open(page, 'carousel');
  await config(page, 'inertia', 0);
  const p = await pt(page, '#carousel-0 [data-card="None"]');
  const cdp = await context.newCDPSession(page);
  const send = async (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number; id: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await send('touchStart', [{ x: p.x, y: p.y, id: 1 }]);
  await send('touchMove', [{ x: p.x + 45, y: p.y, id: 1 }]);
  await send('touchStart', [
    { x: p.x + 45, y: p.y, id: 1 },
    { x: p.x + 12, y: p.y + 10, id: 2 },
  ]);
  await send('touchEnd', [{ x: p.x + 12, y: p.y + 10, id: 2 }]);
  await expect(page.locator('#gesture-metrics')).toContainText('SLOP_CROSSED');
  await send('touchMove', [{ x: p.x + 90, y: p.y + 10, id: 2 }]);
  await expect(page.locator('#gesture-metrics')).toContainText('CAROUSEL');
  await send('touchEnd', []);
  await expect(page.locator('#carousel-0 .carousel-track')).toHaveCSS(
    'transform',
    'matrix(1, 0, 0, 1, 0, 0)',
  );
  await expect(page.locator('#selected-0')).toHaveText('None');
  await context.close();
});

test('BF03 Standalone arrow held indefinitely stays tap-only until valid release', async ({
  page,
}) => {
  await open(page, 'buttons');
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const p = await pt(page, '[data-action="arrow-right"]');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.clock.runFor(5000);
  await expect(page.locator('#arrow-count')).toHaveText('0');
  await page.mouse.up();
  await page.clock.runFor(17);
  await expect(page.locator('#arrow-count')).toHaveText('1');
  await page.clock.runFor(2000);
  await expect(page.locator('#arrow-count')).toHaveText('1');
});
test('BF03 Peek settings resize actual cards; preview ratio survives compact-to-normal resize', async ({
  page,
}) => {
  await open(page, 'carousel');
  await page.locator('#carousel-0').evaluate((el) => ((el as HTMLElement).style.width = '411px'));
  await config(page, 'carouselPeek', 0.2);
  await expect
    .poll(() =>
      page
        .locator('#carousel-0 [data-card="None"]')
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo((403 - 2.2 * 10) / 3.2, 1);
  await config(page, 'carouselPeek', 0.8);
  await expect
    .poll(() =>
      page
        .locator('#carousel-0 [data-card="None"]')
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeCloseTo((403 - 1.8 * 10) / 2.8, 1);
  await open(page, 'resize');
  for (const [w, h] of [
    [240, 220],
    [300, 450],
    [600, 400],
    [240, 220],
  ]) {
    await page.locator('#mock-width').fill(String(w));
    await page.locator('#mock-height').fill(String(h));
    await expect(page.locator('#resize-state')).toHaveText('SETTLED');
    const r = (await page.locator('.mock-preview').boundingBox())!;
    expect(r.width / r.height).toBeCloseTo(1.5, 2);
  }
});
