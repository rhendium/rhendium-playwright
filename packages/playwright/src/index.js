import { chromium } from '@playwright/test';
import { fontConfigArgument, resolveInstallationSync } from '@rhendium/browser';

export function rhendiumLaunchOptions(options = {}) {
  const { rhendium: installOptions, ...playwrightOptions } = options;
  const installation = resolveInstallationSync(installOptions);
  const args = [...(playwrightOptions.args || [])];
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
  const { name = 'rhendium', use = {}, ...project } = options;
  return {
    ...project,
    name,
    use: {
      ...use,
      browserName: 'chromium',
      launchOptions: rhendiumLaunchOptions(use.launchOptions || {}),
    },
  };
}
