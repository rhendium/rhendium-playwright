# @rhendium/browser

Verified downloader and cache manager for Rhendium browser builds and the
shared deterministic font pack.

```sh
npm install --save-dev @rhendium/browser
npx rhendium install
npx rhendium doctor
```

Browser binaries and fonts are separate immutable GitHub Release assets. This
package verifies each asset's byte size and SHA-256 digest before installing it.

Set `RHENDIUM_BROWSERS_PATH` to choose a cache directory. For local development,
set both `RHENDIUM_EXECUTABLE_PATH` and `RHENDIUM_FONT_CONFIG`.

See the [Rhendium Playwright repository](https://github.com/rhendium/rhendium-playwright)
for the API and release policy.
