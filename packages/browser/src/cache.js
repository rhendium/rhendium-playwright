import { existsSync, renameSync } from 'node:fs';
import { homedir, platform as hostPlatform } from 'node:os';
import { join } from 'node:path';

function platformCacheRoot(name, env, platform, home) {
  if (platform === 'win32')
    return join(env.LOCALAPPDATA || join(home, 'AppData', 'Local'), name);
  if (platform === 'darwin') return join(home, 'Library', 'Caches', name);
  return join(env.XDG_CACHE_HOME || join(home, '.cache'), name);
}

export function cacheRoot(env = process.env) {
  if (env.RHENDIUM_BROWSERS_PATH) return env.RHENDIUM_BROWSERS_PATH;
  return platformCacheRoot('rhendium', env, hostPlatform(), homedir());
}

export function resolvedCacheRoot({
  cachePath,
  env = process.env,
  platform = hostPlatform(),
  home = homedir(),
  onStatus,
} = {}) {
  if (cachePath) return cachePath;
  if (env.RHENDIUM_BROWSERS_PATH) return env.RHENDIUM_BROWSERS_PATH;

  const current = platformCacheRoot('rhendium', env, platform, home);
  const legacy = platformCacheRoot('rhendium-playwright', env, platform, home);
  if (existsSync(current) || !existsSync(legacy)) return current;

  try {
    renameSync(legacy, current);
  } catch (error) {
    // Another process may have completed the same migration after our checks.
    if (existsSync(current) && !existsSync(legacy)) return current;
    throw new Error(`Could not migrate the Rhendium cache from ${legacy} to ${current}`, {
      cause: error,
    });
  }
  onStatus?.(`Migrated Rhendium cache to ${current}`);
  return current;
}
