# Publishing

The packages are intentionally not published automatically.

Before publishing, confirm your npm account has publish access to the
`@rhendium` npm scope. A GitHub organization with the same name does not create
or reserve an npm scope.

1. Run `npm whoami` and confirm the account has `@rhendium` publish access.
2. Confirm `packages/browser/builds.json` contains immutable GitHub Release
   URLs, exact byte sizes, and lowercase SHA-256 values without placeholders.
3. Run `npm ci` and `npm test`.
4. Install the release with `npx rhendium install` on each supported platform.
5. Run `npm run test:integration` and confirm browser shutdown leaves no child
   processes.
6. Inspect both packages with `npm pack --dry-run --workspace <name>`.
7. Publish `@rhendium/browser` first, then `@rhendium/playwright`, using the
   desired npm provenance and two-factor-authentication policy.

The browser and font archives remain GitHub Release assets; npm receives only
the small downloader, manifest, type declarations, and Playwright adapter.
