import type { Browser, BrowserContext, BrowserType, LaunchOptions, LaunchPersistentContextOptions, PlaywrightTestConfig } from '@playwright/test';
import type { InstallOptions } from '@rhendium/browser';

export type RhendiumLaunchOptions = LaunchOptions & { rhendium?: InstallOptions };
export type RhendiumProjectOptions = NonNullable<PlaywrightTestConfig['projects']>[number];
export function rhendiumLaunchOptions(options?: RhendiumLaunchOptions): LaunchOptions;
export const rhendiumScreenshotPathTemplate: string;
export const rhendium: {
  launch(options?: RhendiumLaunchOptions): Promise<Browser>;
  launchPersistentContext(userDataDir: string, options?: LaunchPersistentContextOptions & { rhendium?: InstallOptions }): Promise<BrowserContext>;
  connect: BrowserType['connect'];
  connectOverCDP: BrowserType['connectOverCDP'];
};
export function rhendiumProject(options?: RhendiumProjectOptions): RhendiumProjectOptions;
