import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { fontConfigArgument, loadManifest, platformKey } from '../src/index.js';
import { cacheRoot, resolvedCacheRoot } from '../src/cache.js';
import { writeLaunchers } from '../src/launcher.js';

test('normalizes supported platform keys', () => {
  assert.equal(platformKey('linux', 'x64'), 'linux-x64');
  assert.equal(platformKey('win32', 'x64'), 'win-x64');
  assert.equal(platformKey('darwin', 'arm64'), 'mac-arm64');
});

test('uses rhendium as the default cache directory name', () => {
  assert.equal(basename(cacheRoot({})), 'rhendium');
  assert.equal(cacheRoot({ RHENDIUM_BROWSERS_PATH: '/custom/cache' }), '/custom/cache');
});

test('migrates the legacy default cache without downloading again', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'rhendium-cache-'));
  const legacy = join(parent, 'rhendium-playwright');
  const current = join(parent, 'rhendium');
  try {
    await mkdir(join(legacy, 'browsers'), { recursive: true });
    await writeFile(join(legacy, 'browsers', 'existing-build'), 'installed');
    const statuses = [];
    const result = resolvedCacheRoot({
      env: { XDG_CACHE_HOME: parent },
      platform: 'linux',
      home: parent,
      onStatus: status => statuses.push(status),
    });
    assert.equal(result, current);
    assert.equal(existsSync(legacy), false);
    assert.equal(await readFile(join(current, 'browsers', 'existing-build'), 'utf8'), 'installed');
    assert.deepEqual(statuses, [`Migrated Rhendium cache to ${current}`]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('writes portable launchers for Windows, Linux, and macOS', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-launcher-'));
  const descriptor = {
    root,
    version: '153.0.7995.0-r1',
    key: 'linux-x64',
    asset: { executable: 'chrome' },
    fontPack: { id: 'noto-canonical', profile: 'active-profile.json' },
  };
  try {
    const windowsPaths = await writeLaunchers({
      ...descriptor,
      key: 'win-x64',
      asset: { executable: 'chrome.exe' },
      platform: 'win32',
    });
    const windows = await readFile(windowsPaths.launcherPath, 'utf8');
    const windowsGpu = await readFile(windowsPaths.gpuLauncherPath, 'utf8');
    assert.equal(basename(windowsPaths.launcherPath), 'Rhendium.cmd');
    assert.equal(basename(windowsPaths.gpuLauncherPath), 'Rhendium-GPU.cmd');
    assert.match(windows, /%~dp0browsers\\153\.0\.7995\.0-r1\\win-x64\\chrome\.exe/);
    assert.match(windows, /--rhendium-font-config=%~dp0fonts\\noto-canonical\\active-profile\.json/);
    assert.doesNotMatch(windows, new RegExp(root.replaceAll('\\', '\\\\')));
    assert.doesNotMatch(windows, /--enable-gpu/);
    assert.match(windowsGpu, /--enable-gpu/);

    const linuxPaths = await writeLaunchers({ ...descriptor, platform: 'linux' });
    const linux = await readFile(linuxPaths.launcherPath, 'utf8');
    const linuxGpu = await readFile(linuxPaths.gpuLauncherPath, 'utf8');
    assert.equal(basename(linuxPaths.launcherPath), 'Rhendium.sh');
    assert.equal(basename(linuxPaths.gpuLauncherPath), 'Rhendium-GPU.sh');
    assert.match(linux, /rhendium_root\/browsers\/153\.0\.7995\.0-r1\/linux-x64\/chrome/);
    assert.match(linux, /"\$@"/);
    assert.doesNotMatch(linux, /--enable-gpu/);
    assert.match(linuxGpu, /--enable-gpu/);

    const macPaths = await writeLaunchers({
      ...descriptor,
      key: 'mac-arm64',
      asset: { executable: 'Rhendium.app/Contents/MacOS/Rhendium' },
      platform: 'darwin',
    });
    const mac = await readFile(macPaths.launcherPath, 'utf8');
    const macGpu = await readFile(macPaths.gpuLauncherPath, 'utf8');
    assert.equal(basename(macPaths.launcherPath), 'Rhendium.command');
    assert.equal(basename(macPaths.gpuLauncherPath), 'Rhendium-GPU.command');
    assert.match(mac, /Rhendium\.app\/Contents\/MacOS\/Rhendium/);
    assert.doesNotMatch(mac, /--enable-gpu/);
    assert.match(macGpu, /--enable-gpu/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
