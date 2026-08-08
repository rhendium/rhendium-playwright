import assert from 'node:assert/strict';
import test from 'node:test';
import { fontConfigArgument, loadManifest, platformKey } from '../src/index.js';

test('normalizes supported platform keys', () => {
  assert.equal(platformKey('linux', 'x64'), 'linux-x64');
  assert.equal(platformKey('win32', 'x64'), 'win-x64');
  assert.equal(platformKey('darwin', 'arm64'), 'mac-arm64');
});

test('build manifest pins the browser and shared font pack', async () => {
  const manifest = await loadManifest();
  const browser = manifest.browsers.find(item => item.version === manifest.defaultBrowserVersion);
  assert.ok(browser);
  assert.ok(manifest.fontPacks.some(item => item.id === browser.fontPack));
  for (const asset of [...Object.values(browser.assets), ...manifest.fontPacks]) {
    assert.match(asset.url, /^https:\/\/github\.com\/rhendium\/rhendium\/releases\/download\//);
    assert.match(asset.sha256, /^[0-9a-f]{64}$/);
    assert.ok(asset.size > 0);
    assert.doesNotMatch(JSON.stringify(asset), /PENDING_/);
  }
});

test('creates the external font configuration switch', () => {
  assert.equal(fontConfigArgument('/tmp/fonts/active-profile.json'), '--rhendium-font-config=/tmp/fonts/active-profile.json');
});
