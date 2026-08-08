# @rhendium/playwright

Launch Rhendium with Playwright while automatically supplying the verified
external font profile required for deterministic Chromium rendering.

```sh
npm install --save-dev @playwright/test @rhendium/playwright
npx rhendium install
```

```js
import { rhendium } from '@rhendium/playwright';

const browser = await rhendium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://example.com');
await browser.close();
```

For Playwright Test configuration, import `rhendiumProject()` and add its result
to the `projects` array. See the full documentation at
[rhendium/rhendium-playwright](https://github.com/rhendium/rhendium-playwright).
