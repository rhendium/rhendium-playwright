# Rhendium for Playwright

Download and launch Rhendium for deterministic Chromium rendering in
Playwright. Browser binaries and the verified cross-platform font pack are
downloaded from immutable GitHub Release assets and cached separately.

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
build.

The initial release supports Linux x86-64. Windows and macOS assets can be
added to the embedded build manifest without changing the public API.
