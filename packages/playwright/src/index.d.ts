import type { Browser, BrowserContext, BrowserType, LaunchOptions, LaunchPersistentContextOptions, PlaywrightTestConfig } from '@playwright/test';
import type { InstallOptions } from '@rhendium/browser';

export type RhendiumLaunchOptions = LaunchOptions & { rhendium?: InstallOptions };
export function rhendiumLaunchOptions(options?: RhendiumLaunchOptions): LaunchOptions;
export const rhendium: {
  launch(options?: RhendiumLaunchOptions): Promise<Browser>;
  launchPersistentContext(userDataDir: string, options?: LaunchPersistentContextOptions & { rhendium?: InstallOptions }): Promise<BrowserContext>;
  connect: BrowserType['connect'];
  connectOverCDP: BrowserType['connectOverCDP'];
};
export function rhendiumProject(options?: Record<string, unknown>): NonNullable<PlaywrightTestConfig['projects']>[number];
