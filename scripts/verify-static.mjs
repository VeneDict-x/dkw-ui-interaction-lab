import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Local-only verification of dist and relative asset paths under /lab/.
// This is not publication and creates no external resource.
const root = resolve('dist'),
  results = [],
  errors = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = resolve(
    root,
    decodeURIComponent(url.pathname.replace(/^\/lab\//, '')) || 'index.html',
  );
  if (!path.startsWith(root + '/')) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const data = await readFile(path);
    res.setHeader(
      'Content-Type',
      { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' }[extname(path)] ||
        'application/octet-stream',
    );
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
await new Promise((r) => server.listen(4180, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto('http://127.0.0.1:4180/lab/');
  for (const id of ['carousel', 'actions', 'buttons', 'navigation', 'resize']) {
    await page.locator(`.index [data-open="${id}"]`).click();
    assert.ok(await page.locator(`#${id}`).isVisible());
    results.push({ id: `STATIC-${id.toUpperCase()}`, status: 'PASS' });
  }
  await page.locator('.index [data-open="actions"]').click();
  await page.locator('#release-button').click();
  await expect(page.locator('#action-count')).toHaveText('1');
  results.push({ id: 'STATIC-RELEASE', status: 'PASS' });
  await page.locator('[data-config="slopRatio"]').fill('0.3');
  await page.locator('[data-config="slopRatio"]').dispatchEvent('change');
  await page.reload();
  await expect(page.locator('#effective-slop')).toHaveText('14.40 px');
  results.push({ id: 'STATIC-CONFIG-PERSISTENCE', status: 'PASS' });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('.index [data-open="carousel"]').click();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= 360));
  results.push({ id: 'STATIC-MOBILE-WIDTH', status: 'PASS' });
  assert.deepEqual(errors, []);
  results.push({ id: 'STATIC-ASSETS-RUNTIME', status: 'PASS' });
} catch (error) {
  results.push({ id: 'STATIC-VERIFICATION', status: 'FAIL', error: String(error) });
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
  await mkdir('artifacts/testing', { recursive: true });
  const report = {
    environment:
      'local HTTP server of production dist under /lab/; Chromium; not a real-device or HTTPS test',
    time: new Date().toISOString(),
    results,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: results.filter((r) => r.status === 'FAIL').length,
  };
  await writeFile('artifacts/testing/static-results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
