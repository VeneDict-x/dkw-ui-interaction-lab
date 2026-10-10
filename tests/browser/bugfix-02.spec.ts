import { test, expect, type Page } from '@playwright/test';

async function open(page: Page, id: string) {
  await page.locator(`.index [data-open="${id}"]`).click();
  await expect(page.locator(`#${id}`)).toBeVisible();
}
async function bounds(page: Page, selector: string) {
  const target = page.locator(selector);
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error(`No bounds for ${selector}`);
  return { ...box, cx: box.x + box.width / 2, cy: box.y + box.height / 2 };
}
async function setConfig(page: Page, key: string, value: number) {
  await page.locator('#debug-details').evaluate((el: HTMLDetailsElement) => (el.open = true));
  await page.locator(`[data-config="${key}"]`).fill(String(value));
  await page.locator(`[data-config="${key}"]`).dispatchEvent('change');
}
async function pressRelease(page: Page) {
  await open(page, 'actions');
  const box = await bounds(page, '#release-button');
  await page.mouse.move(box.cx, box.cy);
  await page.mouse.down();
  await expect(page.locator('#action-count')).toHaveText('0');
  await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Task 02 ReleaseButton', () => {
  test('01 Down then Up inside activates exactly once', async ({ page }) => {
    await pressRelease(page);
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('02 Down without Up never activates', async ({ page }) => {
    await pressRelease(page);
    await page.waitForTimeout(600);
    await expect(page.locator('#action-count')).toHaveText('0');
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
  });
  test('03 movement inside beyond Slop stays pressed and activates once', async ({ page }) => {
    const box = await pressRelease(page);
    await page.mouse.move(box.cx + 30, box.cy);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
    await expect(page.locator('#release-state')).toHaveText('PRESSED');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('04 Outside then Up outside never activates', async ({ page }) => {
    const box = await pressRelease(page);
    await page.mouse.move(box.x + box.width + 40, box.cy);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('0');
  });
  test('05 Outside then Inside then Up inside activates once', async ({ page }) => {
    const box = await pressRelease(page);
    await page.mouse.move(box.x - 20, box.cy);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
    await page.mouse.move(box.cx, box.cy);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('06 repeated exits and returns remain reversible', async ({ page }) => {
    const box = await pressRelease(page);
    for (const x of [box.x - 20, box.x + box.width + 20, box.x - 80]) {
      await page.mouse.move(x, box.cy);
      await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
      await page.mouse.move(box.cx, box.cy);
      await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
      await expect(page.locator('#action-count')).toHaveText('0');
    }
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('07 large excursion beyond Slop then return activates once', async ({ page }) => {
    const box = await pressRelease(page);
    await page.mouse.move(box.cx + 250, box.cy + 120);
    await page.mouse.move(box.cx, box.cy);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('08 synthetic PointerCancel clears state and never activates on later Up', async ({
    page,
  }) => {
    const box = await pressRelease(page);
    await page.mouse.move(box.x - 40, box.cy);
    await page.evaluate(() =>
      window.dispatchEvent(
        new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' }),
      ),
    );
    await page.mouse.move(box.cx, box.cy);
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('0');
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
    await expect(page.locator('#release-state')).toHaveText('IDLE');
  });
  test('09 capture preserves immediate PRESSED RELEASED PRESSED visuals and fixed position', async ({
    page,
  }) => {
    const box = await pressRelease(page);
    await expect(page.locator('#release-button')).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 2)',
    );
    expect(await page.locator('#release-button').evaluate((el) => el.hasPointerCapture(1))).toBe(
      true,
    );
    const pressedBox = await page.locator('#release-button').boundingBox();
    await page.mouse.move(box.cx + 240, box.cy + 100);
    await expect(page.locator('#release-state')).toHaveText('RELEASED');
    await page.mouse.move(box.cx, box.cy);
    await expect(page.locator('#release-state')).toHaveText('PRESSED');
    await expect(page.locator('#release-button')).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 2)',
    );
    const returnedBox = await page.locator('#release-button').boundingBox();
    expect(returnedBox!.x).toBeCloseTo(pressedBox!.x, 2);
    expect(returnedBox!.y).toBeCloseTo(pressedBox!.y, 2);
    await expect(page.locator('#action-count')).toHaveText('0');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('10 compatibility click and repeated Up cannot double activate', async ({ page }) => {
    await pressRelease(page);
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
    await page.locator('#release-button').dispatchEvent('click', { detail: 1 });
    await page.evaluate(() =>
      window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse' })),
    );
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('functional top edge stays inside during press translation', async ({ page }) => {
    await open(page, 'actions');
    const box = await bounds(page, '#release-button');
    await page.mouse.move(box.cx, box.y + 1);
    await page.mouse.down();
    await expect(page.locator('#release-button')).toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 2)',
    );
    await page.mouse.move(box.cx + 20, box.y + 1);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('1');
  });
  test('lost capture ends release candidate without activation', async ({ page }) => {
    const box = await pressRelease(page);
    // Process pending capture before releasing it; the next input delivers native lostpointercapture.
    await page.mouse.move(box.cx + 1, box.cy);
    expect(await page.locator('#release-button').evaluate((el) => el.hasPointerCapture(1))).toBe(
      true,
    );
    await page.locator('#release-button').evaluate((el) => el.releasePointerCapture(1));
    await page.mouse.move(box.cx + 2, box.cy);
    await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
    await page.mouse.up();
    await expect(page.locator('#action-count')).toHaveText('0');
  });
  test('nested lab Release action uses the same geometry policy', async ({ page }) => {
    await open(page, 'carousel');
    const box = await bounds(page, '[data-action="lab-release"]');
    await page.mouse.move(box.cx, box.cy);
    await page.mouse.down();
    await page.mouse.move(box.cx + 240, box.cy + 80);
    await page.mouse.move(box.cx, box.cy);
    await page.mouse.up();
    await expect(page.locator('#lab-count')).toHaveText('1');
    expect(await page.locator('#modules').evaluate((el) => el.scrollTop)).toBe(0);
  });
  for (const end of ['touchEnd', 'touchCancel'] as const) {
    test(`Chromium touch exits and returns under capture; ${end} performs ${end === 'touchEnd' ? 1 : 0} action`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 390, height: 844 },
      });
      const page = await context.newPage();
      await page.goto('/');
      await open(page, 'actions');
      const box = await bounds(page, '#release-button');
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.cx, y: box.cy }],
      });
      await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'true');
      await expect(page.locator('#effective-slop')).toHaveText('9.60 px');
      for (const x of [box.x - 20, box.x + box.width + 20]) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: box.cy }],
        });
        await expect(page.locator('#release-state')).toHaveText('RELEASED');
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: box.cx, y: box.cy }],
        });
        await expect(page.locator('#release-state')).toHaveText('PRESSED');
        await expect(page.locator('#action-count')).toHaveText('0');
      }
      await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
      await expect(page.locator('#release-button')).toHaveAttribute('data-pressed', 'false');
      await expect(page.locator('#action-count')).toHaveText(end === 'touchEnd' ? '1' : '0');
      await page.waitForTimeout(200);
      await expect(page.locator('#action-count')).toHaveText(end === 'touchEnd' ? '1' : '0');
      await context.close();
    });
  }
});

test.describe('Task 02 Nested Gestures', () => {
  test('Option 3 touch drag clears temporary states and preserves None', async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      isMobile: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto('/');
    await setConfig(page, 'inertia', 0);
    await open(page, 'carousel');
    const card = page.locator('#carousel-0 [data-card="Option 3"]');
    const box = await bounds(page, '#carousel-0 [data-card="Option 3"]');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.cx, y: box.cy }],
    });
    await expect(card).toHaveAttribute('data-pressed', 'true');
    const before = await page.locator('#carousel-0').evaluate((el) => el.scrollLeft);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: box.cx - 65, y: box.cy - 10 }],
    });
    await expect(page.locator('#gesture-metrics')).toContainText('CAROUSEL');
    await expect(card).toHaveAttribute('data-pressed', 'false');
    await expect(card).toHaveAttribute('data-dragging', 'true');
    expect(await page.locator('#carousel-0').evaluate((el) => el.scrollLeft)).toBeGreaterThan(
      before,
    );
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(card).toHaveAttribute('data-dragging', 'false');
    await expect(card).toHaveAttribute('data-pressed', 'false');
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#carousel-0 [data-card="None"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('#selected-0')).toHaveText('None');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveCSS('background-color', 'rgb(33, 48, 58)');
    await expect(card).toHaveCSS('border-color', 'rgb(59, 75, 85)');
    await context.close();
  });
  test('Safari-compatible sticky hover regression (forced pseudo-state in Chromium)', async ({
    page,
  }) => {
    await open(page, 'carousel');
    await setConfig(page, 'inertia', 0);
    const box = await bounds(page, '#carousel-0 [data-card="Option 3"]');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const document = await cdp.send('DOM.getDocument');
    const node = await cdp.send('DOM.querySelector', {
      nodeId: document.root.nodeId,
      selector: '#carousel-0 [data-card="Option 3"]',
    });
    await cdp.send('CSS.forcePseudoState', { nodeId: node.nodeId, forcedPseudoClasses: ['hover'] });
    await page.mouse.move(box.cx, box.cy);
    await page.mouse.down();
    await page.mouse.move(box.cx - 80, box.cy);
    await page.mouse.up();
    const card = page.locator('#carousel-0 [data-card="Option 3"]');
    await expect(page.locator('#selected-0')).toHaveText('None');
    await expect(card).toHaveCSS('border-color', 'rgb(59, 75, 85)');
    await expect(card).toHaveCSS('background-color', 'rgb(33, 48, 58)');
    await expect(card).toHaveAttribute('data-pressed', 'false');
    await expect(card).toHaveAttribute('data-dragging', 'false');
    await cdp.send('CSS.forcePseudoState', { nodeId: node.nodeId, forcedPseudoClasses: [] });
  });
  test('drag and cancel preserve an actual Option selection and clear the source card', async ({
    page,
  }) => {
    await open(page, 'carousel');
    await setConfig(page, 'inertia', 0);
    const card = page.locator('#carousel-0 [data-card="Option 3"]');
    await card.click();
    await expect(page.locator('#selected-0')).toHaveText('Option 3');
    for (const cancel of [false, true]) {
      const box = await bounds(page, '#carousel-0 [data-card="Option 3"]');
      await page.mouse.move(box.cx, box.cy);
      await page.mouse.down();
      await page.mouse.move(box.cx - 45, box.cy - 5);
      if (cancel)
        await page.evaluate(() =>
          window.dispatchEvent(
            new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' }),
          ),
        );
      await page.mouse.up();
      await expect(card).toHaveAttribute('data-pressed', 'false');
      await expect(card).toHaveAttribute('data-dragging', 'false');
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#selected-0')).toHaveText('Option 3');
    }
  });
  test('mouse hover and keyboard focus are separate from selected and pressed', async ({
    page,
  }) => {
    await open(page, 'carousel');
    const card = page.locator('#carousel-0 [data-card="Option 3"]');
    const box = await bounds(page, '#carousel-0 [data-card="Option 3"]');
    await page.mouse.move(box.cx, box.cy);
    await expect(card).toHaveAttribute('data-hovered', 'true');
    await expect(card).toHaveAttribute('aria-pressed', 'false');
    await page.mouse.move(5, 5);
    await expect(card).toHaveAttribute('data-hovered', 'false');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-pressed', 'true');
    await expect(card).toBeFocused();
    await expect(card).toHaveCSS('outline-style', 'solid');
  });
});

test.describe('Task 02 Gesture Slop', () => {
  test('touch slop increases by 25% without changing mouse threshold (synthetic Pointer Events)', async ({
    page,
  }) => {
    await open(page, 'carousel');
    const box = await bounds(page, '#carousel-0 [data-card="Option 1"]');
    for (const pointerType of ['touch', 'mouse']) {
      await page.locator('#carousel-0 [data-card="Option 1"]').dispatchEvent('pointerdown', {
        pointerId: 93,
        pointerType,
        isPrimary: true,
        button: 0,
        clientX: box.cx,
        clientY: box.cy,
      });
      await page.evaluate(
        ({ x, y, pointerType }) =>
          window.dispatchEvent(
            new PointerEvent('pointermove', {
              pointerId: 93,
              pointerType,
              clientX: x + 8.5,
              clientY: y,
            }),
          ),
        { x: box.cx, y: box.cy, pointerType },
      );
      await expect(page.locator('#gesture-metrics')).toContainText(
        pointerType === 'touch' ? 'TAP_CANDIDATE' : 'SLOP_CROSSED',
      );
      await expect(page.locator('#effective-slop')).toHaveText(
        pointerType === 'touch' ? '9.60 px' : '7.68 px',
      );
      await expect(page.locator('#gesture-overlay circle').first()).toHaveAttribute(
        'r',
        pointerType === 'touch' ? '9.6' : '7.68',
      );
      await page.evaluate(
        ({ pointerType }) =>
          window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 93, pointerType })),
        { pointerType },
      );
    }
    await expect(page.locator('#selected-0')).toHaveText('None');
  });
  test('touch coefficient is experimental, editable and persists with existing settings', async ({
    page,
  }) => {
    await page.evaluate(() =>
      localStorage.setItem(
        'dkw-lab-v1',
        JSON.stringify({ slopRatio: 0.2, holdDelay: 720, inertia: 0.7, pressDepth: 3 }),
      ),
    );
    await page.reload();
    await expect(page.locator('[data-config="touchSlopMultiplier"]')).toHaveValue('1.25');
    for (const [key, value] of [
      ['slopRatio', '0.2'],
      ['holdDelay', '720'],
      ['inertia', '0.7'],
      ['pressDepth', '3'],
    ]) {
      await expect(page.locator(`[data-config="${key}"]`)).toHaveValue(value);
    }
    await setConfig(page, 'touchSlopMultiplier', 1.5);
    await page.reload();
    await expect(page.locator('[data-config="touchSlopMultiplier"]')).toHaveValue('1.5');
    await expect(page.locator('#slop-policy')).toContainText('Touch 14.40 px');
    await expect(page.locator('#slop-policy')).toContainText('EXPERIMENTAL');
    await expect(page.locator('[data-config="holdDelay"]')).toHaveValue('720');
  });
});
