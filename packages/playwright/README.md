# @rhendium/playwright

Rhendium is a Chromium-based browser for **deterministic Chromium rendering**.
It pins the engine and rendering rules and uses a verified external Noto font
pack so ordinary webpage content can produce the same pixels on Windows,
Linux, and macOS. A pinned KDE Chromium build is the visual reference;
Rhendium's versioned cross-platform output is the final standard. Native
browser chrome remains the normal Chromium UI for each platform.

This package connects Rhendium to Playwright and automatically supplies the
matching external font profile. It uses software compositing by default;
passing `--enable-gpu` opts out of the pixel-consistency guarantee.

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

`rhendiumProject()` makes screenshot assertions use one shared reference
screenshot on every operating system. It omits Playwright's OS/snapshot suffix
and supplies a canonical `1280 x 720`, 1x, light, `en-US`, UTC context with
strict zero-different-pixel comparison. A difference on any operating system
therefore fails the test rather than selecting a separate OS-specific image.

```js
import { expect, test } from '@playwright/test';

test('homepage', async ({ page }) => {
  await page.goto('https://example.com');
  await expect(page).toHaveScreenshot('homepage.png');
});
```

For direct automation outside Playwright Test:

```js
import { rhendium } from '@rhendium/playwright';

const browser = await rhendium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://example.com');
await browser.close();
```

The project and screenshot defaults remain explicitly overridable for suites
that need a different, consistently applied rendering profile. See setup,
cache, environment-variable, and CI guidance in the full documentation at
[rhendium/rhendium-playwright](https://github.com/rhendium/rhendium-playwright).
