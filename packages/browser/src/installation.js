import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function exists(path) {
  try { await access(path); return true; }
  catch { return false; }
}

export async function installationComplete(destination, expectedFiles, descriptor) {
  const markerPath = join(destination, '.installation-complete');
  if (!await exists(markerPath)) return false;
  try {
    const marker = JSON.parse(await readFile(markerPath, 'utf8'));
    if (marker.sha256 !== descriptor.sha256) return false;
  } catch {
    return false;
  }
  for (const relative of expectedFiles) {
    if (!await exists(join(destination, relative))) return false;
  }
  return true;
}
