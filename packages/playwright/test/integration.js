import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rhendium } from '../src/index.js';

const output = await mkdtemp(join(tmpdir(), 'rhendium-playwright-'));
let browser;
try {
  browser = await rhendium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<!doctype html><style>body{font-family:sans-serif}</style><h1>Rhendium</h1>');
  assert.equal(await page.locator('h1').textContent(), 'Rhendium');
  const screenshot = join(output, 'smoke.png');
  await page.screenshot({ path: screenshot });
  assert.ok((await readFile(screenshot)).length > 1000);
  console.log('Rhendium Playwright integration passed');
} finally {
  if (browser) await browser.close();
  await rm(output, { recursive: true, force: true });
}
