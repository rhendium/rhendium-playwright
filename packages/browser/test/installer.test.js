import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { extractArchive } from '../src/archive.js';
import { installationComplete } from '../src/installation.js';
import { withLock } from '../src/lock.js';

const validZip = 'UEsDBBQAAAAIABFOCl3FSqKyFwAAABUAAAARAAAAZml4dHVyZS9oZWxsby50eHQLykjNS8kszVVILErOyCxLVShJLS4BAFBLAQIUABQAAAAIABFOCl3FSqKyFwAAABUAAAARAAAAAAAAAAAAAAAAAAAAAABmaXh0dXJlL2hlbGxvLnR4dFBLBQYAAAAAAQABAD8AAABGAAAAAAA=';
const unsafeZip = 'UEsDBBQAAAAIABROCl1uA8/yCAAAAAYAAAAOAAAALi4vb3V0c2lkZS50eHQrzStOTEsFAFBLAQIUABQAAAAIABROCl1uA8/yCAAAAAYAAAAOAAAAAAAAAAAAAAAAAAAAAAAuLi9vdXRzaWRlLnR4dFBLBQYAAAAAAQABADwAAAA0AAAAAAA=';
const safeSymlinkZip = 'UEsDBAoAAAAAAC5gEF0AAAAAAAAAAAAAAAAIABwAZml4dHVyZS9VVAkAAwcJgmoHCYJqdXgLAAEE9QEAAAQAAAAAUEsDBAoAAAAAAC5gEF0AAAAAAAAAAAAAAAARABwAZml4dHVyZS9WZXJzaW9ucy9VVAkAAwcJgmoHCYJqdXgLAAEE9QEAAAQAAAAAUEsDBAoAAAAAACtgEF0AAAAAAAAAAAAAAAATABwAZml4dHVyZS9WZXJzaW9ucy8xL1VUCQADAQmCagcJgmp1eAsAAQT1AQAABAAAAABQSwMECgAAAAAAK2AQXS3PdaYVAAAAFQAAABsAHABmaXh0dXJlL1ZlcnNpb25zLzEvZGF0YS50eHRVVAkAAwEJgmoBCYJqdXgLAAEE9QEAAAQAAAAAc2FmZSBzeW1saW5rIGZpeHR1cmUKUEsDBAoAAAAAAC5gEF2379yDAQAAAAEAAAAYABwAZml4dHVyZS9WZXJzaW9ucy9DdXJyZW50VVQJAAMHCYJqBwmCanV4CwABBPUBAAAEAAAAADFQSwMECgAAAAAALmAQXY1hUcsZAAAAGQAAABAAHABmaXh0dXJlL2RhdGEudHh0VVQJAAMHCYJqBwmCanV4CwABBPUBAAAEAAAAAFZlcnNpb25zL0N1cnJlbnQvZGF0YS50eHRQSwECHgMKAAAAAAAuYBBdAAAAAAAAAAAAAAAACAAYAAAAAAAAABAA7UEAAAAAZml4dHVyZS9VVAUAAwcJgmp1eAsAAQT1AQAABAAAAABQSwECHgMKAAAAAAAuYBBdAAAAAAAAAAAAAAAAEQAYAAAAAAAAABAA7UFCAAAAZml4dHVyZS9WZXJzaW9ucy9VVAUAAwcJgmp1eAsAAQT1AQAABAAAAABQSwECHgMKAAAAAAArYBBdAAAAAAAAAAAAAAAAEwAYAAAAAAAAABAA7UGNAAAAZml4dHVyZS9WZXJzaW9ucy8xL1VUBQADAQmCanV4CwABBPUBAAAEAAAAAFBLAQIeAwoAAAAAACtgEF0tz3WmFQAAABUAAAAbABgAAAAAAAEAAACkgdoAAABmaXh0dXJlL1ZlcnNpb25zLzEvZGF0YS50eHRVVAUAAwEJgmp1eAsAAQT1AQAABAAAAABQSwECHgMKAAAAAAAuYBBdt+/cgwEAAAABAAAAGAAYAAAAAAAAAAAA7aFEAQAAZml4dHVyZS9WZXJzaW9ucy9DdXJyZW50VVQFAAMHCYJqdXgLAAEE9QEAAAQAAAAAUEsBAh4DCgAAAAAALmAQXY1hUcsZAAAAGQAAABAAGAAAAAAAAAAAAO2hlwEAAGZpeHR1cmUvZGF0YS50eHRVVAUAAwcJgmp1eAsAAQT1AQAABAAAAABQSwUGAAAAAAYABgATAgAA+gEAAAAA';
const unsafeSymlinkZip = 'UEsDBAoAAAAAAC5gEF0AAAAAAAAAAAAAAAAIABwAZml4dHVyZS9VVAkAAwcJgmoLCYJqdXgLAAEE9QEAAAQAAAAAUEsDBAoAAAAAAC5gEF0Fr4RLEQAAABEAAAAOABwAZml4dHVyZS9lc2NhcGVVVAkAAwcJgmoHCYJqdXgLAAEE9QEAAAQAAAAALi4vLi4vb3V0c2lkZS50eHRQSwMECgAAAAAAK2AQXcU7wIEXAAAAFwAAABcAHABmaXh0dXJlL3BsYWNlaG9sZGVyLnR4dFVUCQADAQmCagEJgmp1eAsAAQT1AQAABAAAAAB1bnNhZmUgc3ltbGluayBmaXh0dXJlClBLAQIeAwoAAAAAAC5gEF0AAAAAAAAAAAAAAAAIABgAAAAAAAAAEADtQQAAAABmaXh0dXJlL1VUBQADBwmCanV4CwABBPUBAAAEAAAAAFBLAQIeAwoAAAAAAC5gEF0Fr4RLEQAAABEAAAAOABgAAAAAAAAAAADtoUIAAABmaXh0dXJlL2VzY2FwZVVUBQADBwmCanV4CwABBPUBAAAEAAAAAFBLAQIeAwoAAAAAACtgEF3FO8CBFwAAABcAAAAXABgAAAAAAAEAAACkgZsAAABmaXh0dXJlL3BsYWNlaG9sZGVyLnR4dFVUBQADAQmCanV4CwABBPUBAAAEAAAAAFBLBQYAAAAAAwADAP8AAAADAQAAAAA=';

test('extracts a ZIP using the Node-compatible extractor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-archive-'));
  try {
    const archive = join(root, 'fixture.zip');
    const extracted = join(root, 'extracted');
    await writeFile(archive, Buffer.from(validZip, 'base64'));
    await extractArchive(archive, { dir: extracted });
    assert.equal(await readFile(join(extracted, 'fixture', 'hello.txt'), 'utf8'), 'Rhendium archive test');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects ZIP entries that escape the extraction directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-archive-'));
  try {
    const archive = join(root, 'unsafe.zip');
    await writeFile(archive, Buffer.from(unsafeZip, 'base64'));
    await assert.rejects(
      extractArchive(archive, { dir: join(root, 'extracted') }),
      /Unsafe ZIP entry path|invalid relative path/,
    );
    assert.equal(existsSync(join(root, 'outside.txt')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('extracts safe relative symbolic links used by macOS frameworks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-archive-'));
  try {
    const archive = join(root, 'symlinks.zip');
    const extracted = join(root, 'extracted');
    await writeFile(archive, Buffer.from(safeSymlinkZip, 'base64'));
    await extractArchive(archive, { dir: extracted });
    assert.equal(await readlink(join(extracted, 'fixture', 'Versions', 'Current')), '1');
    assert.equal(
      (await readlink(join(extracted, 'fixture', 'data.txt'))).replaceAll('\\', '/'),
      'Versions/Current/data.txt',
    );
    assert.equal(await readFile(join(extracted, 'fixture', 'data.txt'), 'utf8'), 'safe symlink fixture\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects symbolic links that escape the extraction directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-archive-'));
  try {
    const archive = join(root, 'unsafe-symlink.zip');
    await writeFile(archive, Buffer.from(unsafeSymlinkZip, 'base64'));
    await assert.rejects(
      extractArchive(archive, { dir: join(root, 'extracted') }),
      /ZIP symbolic link escapes its destination/,
    );
    assert.equal(existsSync(join(root, 'outside.txt')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('automatically recovers a lock whose local owner has exited', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-lock-'));
  const lock = join(root, 'asset.lock');
  try {
    await mkdir(lock);
    await writeFile(join(lock, 'owner.json'), JSON.stringify({
      hostname: hostname(),
      pid: 2147483647,
      token: 'abandoned',
    }));
    let ran = false;
    let recoveryReason;
    await withLock(lock, async () => { ran = true; }, {
      onRecovered: reason => { recoveryReason = reason; },
    });
    assert.equal(ran, true);
    assert.equal(recoveryReason, 'dead-owner');
    assert.equal(existsSync(lock), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('recovers legacy locks after a short grace period and reports it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-lock-'));
  const lock = join(root, 'asset.lock');
  try {
    await mkdir(lock);
    let recoveryReason;
    await withLock(lock, async () => {}, {
      legacyStaleAfterMs: 0,
      onRecovered: reason => { recoveryReason = reason; },
    });
    assert.equal(recoveryReason, 'legacy-lock');
    assert.equal(existsSync(lock), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('reports an active lock before timing out', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-lock-'));
  const lock = join(root, 'asset.lock');
  try {
    await mkdir(lock);
    await writeFile(join(lock, 'owner.json'), JSON.stringify({
      hostname: hostname(),
      pid: process.pid,
      token: 'active',
    }));
    let reportedOwner;
    await assert.rejects(withLock(lock, async () => {}, {
      waitTimeoutMs: 20,
      onWait: (path, owner) => { reportedOwner = { path, owner }; },
    }), /Timed out waiting for another Rhendium installer/);
    assert.equal(reportedOwner.path, lock);
    assert.equal(reportedOwner.owner.pid, process.pid);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('requires the completion marker to match the current asset hash', async () => {
  const root = await mkdtemp(join(tmpdir(), 'rhendium-marker-'));
  try {
    await writeFile(join(root, 'chrome'), 'fixture');
    await writeFile(join(root, '.installation-complete'), JSON.stringify({ sha256: 'old' }));
    assert.equal(await installationComplete(root, ['chrome'], { sha256: 'new' }), false);
    await writeFile(join(root, '.installation-complete'), JSON.stringify({ sha256: 'new' }));
    assert.equal(await installationComplete(root, ['chrome'], { sha256: 'new' }), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
