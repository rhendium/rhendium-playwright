import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rhendiumLaunchOptions,
  rhendiumProject,
  rhendiumScreenshotPathTemplate,
} from '../src/index.js';

test('preserves Playwright arguments and appends the Rhendium font profile', async () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    const options = rhendiumLaunchOptions({ args: ['--disable-dev-shm-usage'] });
    assert.equal(options.executablePath, '/tmp/rhendium/chrome');
    assert.deepEqual(options.args, [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--rhendium-font-config=/tmp/rhendium-fonts/active-profile.json',
    ]);
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});

test('uses --enable-gpu as the explicit opt-out from software compositing', () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    const options = rhendiumLaunchOptions({ args: ['--enable-gpu'] });
    assert.deepEqual(options.args, [
      '--enable-gpu',
      '--rhendium-font-config=/tmp/rhendium-fonts/active-profile.json',
    ]);
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});

test('does not duplicate an explicit --disable-gpu argument', () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    const options = rhendiumLaunchOptions({ args: ['--disable-gpu'] });
    assert.equal(options.args.filter(arg => arg === '--disable-gpu').length, 1);
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});

test('rejects conflicting GPU arguments', () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    assert.throws(
      () => rhendiumLaunchOptions({ args: ['--disable-gpu', '--enable-gpu'] }),
      /cannot contain both --enable-gpu and --disable-gpu/,
    );
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});

test('uses one strict OS-independent shared reference screenshot by default', () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    const project = rhendiumProject();
    assert.equal(project.name, 'rhendium');
    assert.deepEqual(project.use.viewport, { width: 1280, height: 720 });
    assert.equal(project.use.deviceScaleFactor, 1);
    assert.equal(project.use.colorScheme, 'light');
    assert.equal(project.use.locale, 'en-US');
    assert.equal(project.use.timezoneId, 'UTC');
    assert.equal(project.expect.toHaveScreenshot.pathTemplate, rhendiumScreenshotPathTemplate);
    assert.doesNotMatch(rhendiumScreenshotPathTemplate, /platform|snapshotSuffix/);
    assert.equal(project.expect.toHaveScreenshot.threshold, 0);
    assert.equal(project.expect.toHaveScreenshot.maxDiffPixels, 0);
    assert.equal(project.expect.toHaveScreenshot.animations, 'disabled');
    assert.equal(project.expect.toHaveScreenshot.caret, 'hide');
    assert.equal(project.expect.toHaveScreenshot.scale, 'css');
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});

test('allows explicit project and screenshot overrides', () => {
  const oldExecutable = process.env.RHENDIUM_EXECUTABLE_PATH;
  const oldFonts = process.env.RHENDIUM_FONT_CONFIG;
  process.env.RHENDIUM_EXECUTABLE_PATH = '/tmp/rhendium/chrome';
  process.env.RHENDIUM_FONT_CONFIG = '/tmp/rhendium-fonts/active-profile.json';
  try {
    const project = rhendiumProject({
      name: 'rhendium-custom',
      expect: {
        timeout: 10_000,
        toHaveScreenshot: {
          pathTemplate: '{testDir}/custom/{arg}{ext}',
          threshold: 0.1,
        },
      },
      use: {
        viewport: { width: 800, height: 600 },
        locale: 'fr-FR',
        launchOptions: { args: ['--disable-dev-shm-usage'] },
      },
    });
    assert.equal(project.name, 'rhendium-custom');
    assert.equal(project.expect.timeout, 10_000);
    assert.equal(project.expect.toHaveScreenshot.pathTemplate, '{testDir}/custom/{arg}{ext}');
    assert.equal(project.expect.toHaveScreenshot.threshold, 0.1);
    assert.equal(project.expect.toHaveScreenshot.maxDiffPixels, 0);
    assert.deepEqual(project.use.viewport, { width: 800, height: 600 });
    assert.equal(project.use.locale, 'fr-FR');
    assert.equal(project.use.timezoneId, 'UTC');
    assert.deepEqual(project.use.launchOptions.args, [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--rhendium-font-config=/tmp/rhendium-fonts/active-profile.json',
    ]);
  } finally {
    oldExecutable === undefined ? delete process.env.RHENDIUM_EXECUTABLE_PATH : process.env.RHENDIUM_EXECUTABLE_PATH = oldExecutable;
    oldFonts === undefined ? delete process.env.RHENDIUM_FONT_CONFIG : process.env.RHENDIUM_FONT_CONFIG = oldFonts;
  }
});
