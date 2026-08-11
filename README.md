# Rhendium for Playwright

<p align="center">
  <a href="https://github.com/rhendium/rhendium">
    <img src="https://raw.githubusercontent.com/rhendium/rhendium/main/chrome/app/theme/chromium/rhendium_logo_master.png" alt="Rhendium logo" width="128">
  </a>
</p>

[Rhendium](https://github.com/rhendium/rhendium) is a Chromium-based browser for **deterministic Chromium rendering**:
ordinary webpage content is intended to produce the same pixels on Windows,
Linux, and macOS. A pinned KDE Chromium build is its visual reference, while
Rhendium's own versioned, cross-platform rendering protocol defines the final
output. Browser chrome, menus, and window frames remain Chromium's normal
platform UI and are outside the screenshot consistency guarantee.

This integration downloads and launches Rhendium from Playwright. Browser
binaries and the verified cross-platform Noto font pack come from immutable
GitHub Release assets and are verified and cached separately. Separating the
font pack avoids downloading the same fonts again for every operating system.
Rhendium uses software compositing and bundled SwiftShader WebGL by default;
pass `--enable-gpu` only when hardware acceleration is required and
pixel-identical output is not expected.

This repository publishes two packages:

- `@rhendium/browser` downloads, verifies, caches, and locates Rhendium.
- `@rhendium/playwright` launches the cached browser through Playwright's
  Chromium driver and supplies the external deterministic font profile.

## Install

```sh
npm install --save-dev @playwright/test @rhendium/playwright
npx rhendium install
```

```js
import { defineConfig } from '@playwright/test';
import { rhendiumProject } from '@rhendium/playwright';

export default defineConfig({
  projects: [rhendiumProject()],
});
```

Then run `npx playwright test --project=rhendium`.

## Shared reference screenshots

Playwright normally allows screenshot paths to include the operating system.
`rhendiumProject()` instead configures every operating system to compare
against one shared reference screenshot. For example, this assertion:

```js
await expect(page).toHaveScreenshot('homepage.png');
```

uses a path shaped like:

```text
tests/__screenshots__/rhendium-canonical-v1/home.spec.js/homepage.png
```

There is no `win32`, `linux`, `darwin`, or Playwright snapshot suffix in that
path. If Rhendium produces different pixels on another operating system, the
test fails instead of accepting a separate OS-specific reference image.
Playwright may still put diagnostic `actual` and `diff` images in its test
results; those are failure artifacts, not reference screenshots.

To reduce manual configuration, `rhendiumProject()` also supplies canonical
screenshot inputs and strict comparison defaults:

- viewport: `1280 x 720`
- device scale factor: `1`
- color scheme: `light`
- locale: `en-US`
- time zone: `UTC`
- CSS-pixel screenshot scale, hidden caret, and disabled animations
- zero differing pixels accepted

Commit the shared reference screenshots to Git. In CI, choose one designated
job to update them intentionally; all Windows, Linux, and macOS jobs should
normally only compare against them.

The defaults can be overridden when a test suite deliberately needs another
rendering profile:

```js
export default defineConfig({
  projects: [
    rhendiumProject({
      use: { viewport: { width: 1440, height: 900 } },
      expect: {
        toHaveScreenshot: {
          pathTemplate: '{testDir}/custom-screenshots/{testFilePath}/{arg}{ext}',
        },
      },
    }),
  ],
});
```

Changing these values creates a different rendering profile. Keep the same
profile on every operating system if the screenshots are meant to be shared.

For direct automation:

```js
import { rhendium } from '@rhendium/playwright';

const browser = await rhendium.launch();
const page = await browser.newPage();
await page.goto('https://example.com');
await browser.close();
```

Downloads are explicit rather than npm `postinstall` side effects. Set
`RHENDIUM_BROWSERS_PATH` to change the cache, or use
`RHENDIUM_EXECUTABLE_PATH` together with `RHENDIUM_FONT_CONFIG` to test a local
build. Interrupted installs recover stale locks automatically, and concurrent
installers report what they are waiting for. The default cache directory is
`%LOCALAPPDATA%\rhendium` on Windows, `~/.cache/rhendium` on Linux, and
`~/Library/Caches/rhendium` on macOS. Version 0.1.4 automatically renames the
old `rhendium-playwright` cache instead of downloading its contents again.

The initial release supports Linux x86-64 (glibc 2.25 or newer) and Windows
x86-64. macOS assets can be added to the embedded build manifest without
changing the public API.
