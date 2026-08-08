import assert from 'node:assert/strict';
import test from 'node:test';
import { rhendiumLaunchOptions } from '../src/index.js';

test('preserves Playwright arguments and appends the Rhendium font profile', async () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    const options = rhendiumLaunchOptions({ args: ['--disable-dev-shm-usage'] });
    assert.equal(options.executablePath, '/tmp/rhendium/chrome');
    assert.deepEqual(options.args, ['--disable-dev-shm-usage', '--rhendium-font-config=/tmp/rhendium-fonts/active-profile.json']);
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});
