import { chromium } from '@playwright/test';
import { fontConfigArgument, resolveInstallationSync } from '@rhendium/browser';

export const rhendiumScreenshotPathTemplate =
  '{testDir}/__screenshots__/rhendium-canonical-v1/{testFilePath}/{arg}{ext}';

const canonicalContextDefaults = {
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
  colorScheme: 'light',
  locale: 'en-US',
  timezoneId: 'UTC',
};

const canonicalScreenshotDefaults = {
  pathTemplate: rhendiumScreenshotPathTemplate,
  threshold: 0,
  maxDiffPixels: 0,
  animations: 'disabled',
  caret: 'hide',
  scale: 'css',
};

export function rhendiumLaunchOptions(options = {}) {
  const { rhendium: installOptions, ...playwrightOptions } = options;
  const installation = resolveInstallationSync(installOptions);
  const args = [...(playwrightOptions.args || [])];
  const hasEnableGpu = args.some(arg => arg === '--enable-gpu' || arg.startsWith('--enable-gpu='));
  const hasDisableGpu = args.some(arg => arg === '--disable-gpu' || arg.startsWith('--disable-gpu='));
  if (hasEnableGpu && hasDisableGpu)
    throw new Error('Rhendium launch arguments cannot contain both --enable-gpu and --disable-gpu');
  if (!hasEnableGpu && !hasDisableGpu)
    args.push('--disable-gpu');
  if (!args.some(arg => arg.startsWith('--rhendium-font-config=')))
    args.push(fontConfigArgument(installation.fontConfigPath));
  return { ...playwrightOptions, args, executablePath: installation.executablePath };
}

export const rhendium = {
  async launch(options = {}) {
    return chromium.launch(await rhendiumLaunchOptions(options));
  },
  async launchPersistentContext(userDataDir, options = {}) {
    return chromium.launchPersistentContext(userDataDir, await rhendiumLaunchOptions(options));
  },
  connect: chromium.connect.bind(chromium),
  connectOverCDP: chromium.connectOverCDP.bind(chromium),
};

export function rhendiumProject(options = {}) {
  const { name = 'rhendium', use = {}, expect = {}, ...project } = options;
  return {
    ...project,
    name,
    expect: {
      ...expect,
      toHaveScreenshot: {
        ...canonicalScreenshotDefaults,
        ...expect.toHaveScreenshot,
      },
    },
    use: {
      ...canonicalContextDefaults,
      ...use,
      browserName: 'chromium',
      launchOptions: rhendiumLaunchOptions(use.launchOptions || {}),
    },
  };
}
