import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, readFileSync } from 'node:fs';
import { access, chmod, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir, platform as hostPlatform, arch as hostArch } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import extract from 'extract-zip';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const manifestPath = join(packageRoot, 'builds.json');

export async function loadManifest() {
  return JSON.parse(await readFile(manifestPath, 'utf8'));
}

export function loadManifestSync() {
  return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function platformKey(platform = hostPlatform(), arch = hostArch()) {
  const os = platform === 'win32' ? 'win' : platform === 'darwin' ? 'mac' : platform;
  const cpu = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : arch;
  return `${os}-${cpu}`;
}

export function cacheRoot(env = process.env) {
  if (env.RHENDIUM_BROWSERS_PATH) return env.RHENDIUM_BROWSERS_PATH;
  if (hostPlatform() === 'win32') return join(env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'rhendium-playwright');
  if (hostPlatform() === 'darwin') return join(homedir(), 'Library', 'Caches', 'rhendium-playwright');
  return join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'rhendium-playwright');
}

function findBuild(manifest, version, key) {
  const browser = manifest.browsers.find(item => item.version === version);
  if (!browser) throw new Error(`Unknown Rhendium version: ${version}`);
  const asset = browser.assets[key];
  if (!asset) throw new Error(`Rhendium ${version} is not available for ${key}`);
  const fontPack = manifest.fontPacks.find(item => item.id === browser.fontPack);
  if (!fontPack) throw new Error(`Font pack ${browser.fontPack} is missing from the build manifest`);
  return { browser, asset, fontPack };
}

function pathsFor(root, version, key, asset, fontPack) {
  const browserDirectory = join(root, 'browsers', version, key);
  const fontDirectory = join(root, 'fonts', fontPack.id);
  return {
    browserDirectory,
    fontDirectory,
    executablePath: join(browserDirectory, asset.executable),
    fontConfigPath: join(fontDirectory, fontPack.profile),
  };
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function installationComplete(destination, expectedFiles) {
  if (!await exists(join(destination, '.installation-complete'))) return false;
  for (const relative of expectedFiles) {
    if (!await exists(join(destination, relative))) return false;
  }
  return true;
}

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function download(url, destination, onProgress) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) throw new Error(`Download failed (${response.status}) for ${url}`);
  const totalBytes = Number(response.headers.get('content-length')) || undefined;
  let receivedBytes = 0;
  let lastReport = 0;
  onProgress?.({ receivedBytes, totalBytes });
  const meter = new Transform({
    transform(chunk, encoding, callback) {
      receivedBytes += chunk.length;
      const now = Date.now();
      if (now - lastReport >= 1000 || receivedBytes === totalBytes) {
        lastReport = now;
        onProgress?.({ receivedBytes, totalBytes });
      }
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), meter, createWriteStream(destination, { flags: 'wx' }));
  onProgress?.({ receivedBytes, totalBytes, complete: true });
}

async function withLock(lockPath, operation) {
  const deadline = Date.now() + 5 * 60_000;
  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
  try { return await operation(); } finally { await rm(lockPath, { recursive: true, force: true }); }
}

async function installAsset({ descriptor, destination, expectedFiles, cache, label, onProgress }) {
  if (await installationComplete(destination, expectedFiles)) return;
  await mkdir(dirname(destination), { recursive: true });
  await withLock(`${destination}.lock`, async () => {
    if (await installationComplete(destination, expectedFiles)) return;
    const nonce = `${process.pid}-${randomBytes(5).toString('hex')}`;
    const temporary = join(cache, '.downloads', nonce);
    const archive = join(temporary, 'asset.zip');
    const extracted = join(temporary, 'extracted');
    await mkdir(extracted, { recursive: true });
    try {
      await download(descriptor.url, archive, progress => onProgress?.({ label, ...progress }));
      const info = await stat(archive);
      if (info.size !== descriptor.size) throw new Error(`${label} size mismatch: expected ${descriptor.size}, got ${info.size}`);
      const actualHash = await sha256(archive);
      if (actualHash !== descriptor.sha256) throw new Error(`${label} SHA-256 mismatch`);
      await extract(archive, { dir: extracted });
      const root = join(extracted, descriptor.archiveRoot);
      for (const relative of expectedFiles) {
        if (!await exists(join(root, relative))) throw new Error(`${label} archive is missing ${relative}`);
      }
      if (await exists(destination)) await rm(destination, { recursive: true, force: true });
      await rename(root, destination);
      await writeFile(join(destination, '.installation-complete'), JSON.stringify({ sha256: descriptor.sha256, installedAt: new Date().toISOString() }) + '\n');
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  });
}

export async function install(options = {}) {
  const manifest = await loadManifest();
  const version = options.version || process.env.RHENDIUM_VERSION || manifest.defaultBrowserVersion;
  const key = options.platformKey || platformKey();
  const root = options.cachePath || cacheRoot();
  const { browser, asset, fontPack } = findBuild(manifest, version, key);
  const paths = pathsFor(root, version, key, asset, fontPack);
  await mkdir(join(root, '.downloads'), { recursive: true });
  await installAsset({ descriptor: fontPack, destination: paths.fontDirectory, expectedFiles: [fontPack.profile], cache: root, label: 'Rhendium font pack', onProgress: options.onProgress });
  await installAsset({ descriptor: asset, destination: paths.browserDirectory, expectedFiles: [asset.executable], cache: root, label: 'Rhendium browser', onProgress: options.onProgress });
  if (hostPlatform() !== 'win32') await chmod(paths.executablePath, 0o755);
  return { version: browser.version, chromiumVersion: browser.chromiumVersion, platformKey: key, ...paths };
}

export function resolveInstallationSync(options = {}) {
  if (process.env.RHENDIUM_EXECUTABLE_PATH) {
    if (!process.env.RHENDIUM_FONT_CONFIG) throw new Error('RHENDIUM_FONT_CONFIG is required with RHENDIUM_EXECUTABLE_PATH');
    return { executablePath: process.env.RHENDIUM_EXECUTABLE_PATH, fontConfigPath: process.env.RHENDIUM_FONT_CONFIG, version: 'local', platformKey: platformKey() };
  }
  const manifest = loadManifestSync();
  const version = options.version || process.env.RHENDIUM_VERSION || manifest.defaultBrowserVersion;
  const key = options.platformKey || platformKey();
  const { browser, asset, fontPack } = findBuild(manifest, version, key);
  const paths = pathsFor(options.cachePath || cacheRoot(), version, key, asset, fontPack);
  if (!existsSync(paths.executablePath) || !existsSync(paths.fontConfigPath)) {
    throw new Error(`Rhendium ${version} is not installed for ${key}. Run: npx rhendium install`);
  }
  return { version: browser.version, chromiumVersion: browser.chromiumVersion, platformKey: key, ...paths };
}

export async function resolveInstallation(options = {}) {
  return resolveInstallationSync(options);
}

export async function verify(options = {}) {
  const installation = await resolveInstallation(options);
  await Promise.all([access(installation.executablePath), access(installation.fontConfigPath)]);
  return installation;
}

export function fontConfigArgument(fontConfigPath) {
  return `--rhendium-font-config=${fontConfigPath}`;
}
