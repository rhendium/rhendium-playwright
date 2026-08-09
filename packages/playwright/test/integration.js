import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { rhendium } from '../src/index.js';

const execFileAsync = promisify(execFile);
const output = await mkdtemp(join(tmpdir(), 'rhendium-playwright-'));
const projectFixture = await mkdtemp(join(fileURLToPath(new URL('.', import.meta.url)), '.screenshot-path-'));
let browser;
try {
  browser = await rhendium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent('<!doctype html><style>body{font-family:sans-serif}</style><h1>Rhendium</h1>');
  assert.equal(await page.locator('h1').textContent(), 'Rhendium');
  const screenshot = join(output, 'smoke.png');
  await page.screenshot({ path: screenshot });
  assert.ok((await readFile(screenshot)).length > 1000);

  const fixtureTests = join(projectFixture, 'tests');
  await writeFile(join(projectFixture, 'playwright.config.js'), `
import { defineConfig } from '@playwright/test';
import { rhendiumProject } from '../../src/index.js';

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  projects: [rhendiumProject()],
});
`);
  await mkdir(fixtureTests);
  await writeFile(join(fixtureTests, 'shared.spec.js'), `
import { expect, test } from '@playwright/test';

test('shared reference screenshot', async ({ page }) => {
  await page.setContent('<!doctype html><style>body{margin:0;background:white}</style><div>Rhendium</div>');
  await expect(page).toHaveScreenshot('page.png');
});
`);
  const playwrightCli = fileURLToPath(new URL('../../../node_modules/@playwright/test/cli.js', import.meta.url));
  await execFileAsync(process.execPath, [
    playwrightCli,
    'test',
    '--config',
    join(projectFixture, 'playwright.config.js'),
    '--update-snapshots',
  ], { cwd: fileURLToPath(new URL('../../..', import.meta.url)), env: process.env });

  async function findPngs(directory) {
    const result = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) result.push(...await findPngs(path));
      else if (entry.name.endsWith('.png')) result.push(path);
    }
    return result;
  }
  const referenceScreenshots = await findPngs(join(fixtureTests, '__screenshots__'));
  assert.equal(referenceScreenshots.length, 1);
  assert.equal(referenceScreenshots[0], join(
    fixtureTests,
    '__screenshots__',
    'rhendium-canonical-v1',
    'shared.spec.js',
    'page.png',
  ));
  assert.match(referenceScreenshots[0], /rhendium-canonical-v1/);
  assert.doesNotMatch(referenceScreenshots[0], /win32|linux|darwin/);
  console.log('Rhendium Playwright integration passed');
} finally {
  if (browser) await browser.close();
  await rm(output, { recursive: true, force: true });
  await rm(projectFixture, { recursive: true, force: true });
}
