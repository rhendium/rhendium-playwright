import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';

const DEFAULT_WAIT_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_STALE_AFTER_MS = 60 * 60_000;
const DEFAULT_LEGACY_STALE_AFTER_MS = 5_000;

async function readOwner(lockPath) {
  try { return JSON.parse(await readFile(join(lockPath, 'owner.json'), 'utf8')); }
  catch { return undefined; }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code === 'EPERM'; }
}

async function removeIfStale(lockPath, staleAfterMs, legacyStaleAfterMs) {
  let info;
  try { info = await stat(lockPath); }
  catch (error) {
    if (error.code === 'ENOENT') return { removed: true };
    throw error;
  }
  const owner = await readOwner(lockPath);
  const localDeadOwner = owner?.hostname === hostname() && !processIsAlive(owner.pid);
  const ownerMissing = !owner?.hostname || !Number.isInteger(owner?.pid);
  const age = Date.now() - info.mtimeMs;
  const expiredLegacyLock = ownerMissing && age >= legacyStaleAfterMs;
  const expiredRemoteOwner = !ownerMissing && owner.hostname !== hostname() && age >= staleAfterMs;
  if (!localDeadOwner && !expiredLegacyLock && !expiredRemoteOwner)
    return { removed: false, owner };
  const abandoned = `${lockPath}.abandoned-${process.pid}-${randomBytes(4).toString('hex')}`;
  try { await rename(lockPath, abandoned); }
  catch (error) {
    if (error.code === 'ENOENT') return { removed: true };
    throw error;
  }
  await rm(abandoned, { recursive: true, force: true });
  return {
    removed: true,
    recovered: true,
    reason: localDeadOwner ? 'dead-owner' : expiredLegacyLock ? 'legacy-lock' : 'expired-owner',
  };
}

export async function withLock(lockPath, operation, options = {}) {
  const waitTimeoutMs = options.waitTimeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;
  const legacyStaleAfterMs = options.legacyStaleAfterMs ?? DEFAULT_LEGACY_STALE_AFTER_MS;
  const deadline = Date.now() + waitTimeoutMs;
  const owner = {
    token: randomBytes(12).toString('hex'),
    pid: process.pid,
    hostname: hostname(),
    startedAt: new Date().toISOString(),
  };
  let reportedWait = false;
  while (true) {
    try {
      await mkdir(lockPath);
      try { await writeFile(join(lockPath, 'owner.json'), JSON.stringify(owner) + '\n', { flag: 'wx' }); }
      catch (error) {
        await rm(lockPath, { recursive: true, force: true });
        throw error;
      }
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const lockState = await removeIfStale(lockPath, staleAfterMs, legacyStaleAfterMs);
      if (lockState.removed) {
        if (lockState.recovered) options.onRecovered?.(lockState.reason, lockPath);
        continue;
      }
      if (Date.now() >= deadline)
        throw new Error(`Timed out waiting for another Rhendium installer: ${lockPath}`);
      if (!reportedWait) {
        reportedWait = true;
        options.onWait?.(lockPath, lockState.owner);
      }
      await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
    }
  }
  try {
    return await operation();
  } finally {
    const currentOwner = await readOwner(lockPath);
    if (currentOwner?.token === owner.token)
      await rm(lockPath, { recursive: true, force: true });
  }
}
