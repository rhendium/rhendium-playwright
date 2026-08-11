# @rhendium/browser

Verified downloader and cache manager for Rhendium browser builds and the
shared deterministic font pack.

```sh
npm install --save-dev @rhendium/browser
npx rhendium install
npx rhendium doctor
```

Installation creates `Rhendium.*` and `Rhendium-GPU.*` launchers at the cache
root for default software rendering and hardware GPU rendering.

Browser binaries and fonts are separate immutable GitHub Release assets. This
package verifies each asset's byte size and SHA-256 digest before installing it.
Re-running the command reuses only assets whose completion marker matches the
current digest. Interrupted installs recover stale locks automatically, while
an active concurrent installer is reported with its PID and lock path.

The default cache directory is `%LOCALAPPDATA%\rhendium` on Windows,
`~/.cache/rhendium` on Linux, and `~/Library/Caches/rhendium` on macOS. Version
0.1.4 automatically migrates the former `rhendium-playwright` directory without
re-downloading it. Set `RHENDIUM_BROWSERS_PATH` to choose a different cache
directory. For local development, set both `RHENDIUM_EXECUTABLE_PATH` and
`RHENDIUM_FONT_CONFIG`.

See the [Rhendium Playwright repository](https://github.com/rhendium/rhendium-playwright)
for the API and release policy.
