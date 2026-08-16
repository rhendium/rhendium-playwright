import { createWriteStream } from 'node:fs';
import { lstat, mkdir, symlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { buffer } from 'node:stream/consumers';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';

function openArchive(path) {
  return new Promise((resolveOpen, reject) => {
    yauzl.open(path, { autoClose: false, lazyEntries: true }, (error, archive) => {
      if (error) reject(error);
      else resolveOpen(archive);
    });
  });
}

function nextEntry(archive, signal) {
  return new Promise((resolveEntry, reject) => {
    const cleanup = () => {
      archive.off('entry', onEntry);
      archive.off('end', onEnd);
      archive.off('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const onEntry = entry => { cleanup(); resolveEntry(entry); };
    const onEnd = () => { cleanup(); resolveEntry(undefined); };
    const onError = error => { cleanup(); reject(error); };
    const onAbort = () => {
      cleanup();
      archive.close();
      reject(signal.reason || new Error('ZIP extraction aborted'));
    };
    archive.once('entry', onEntry);
    archive.once('end', onEnd);
    archive.once('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    else archive.readEntry();
  });
}

function openEntryStream(archive, entry) {
  return new Promise((resolveStream, reject) => {
    archive.openReadStream(entry, (error, stream) => {
      if (error) reject(error);
      else resolveStream(stream);
    });
  });
}

function destinationFor(root, entryName) {
  if (!entryName || entryName.includes('\\') || entryName.includes('\0') || entryName.startsWith('/'))
    throw new Error(`Unsafe ZIP entry path: ${JSON.stringify(entryName)}`);
  const segments = entryName.split('/').filter(Boolean);
  if (segments.some(segment => segment === '.' || segment === '..'))
    throw new Error(`Unsafe ZIP entry path: ${JSON.stringify(entryName)}`);
  const destination = resolve(root, ...segments);
  const fromRoot = relative(root, destination);
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    if (!fromRoot && entryName.endsWith('/')) return destination;
    throw new Error(`ZIP entry escapes its destination: ${JSON.stringify(entryName)}`);
  }
  return destination;
}

async function rejectSymlinkPath(path, description) {
  try {
    if ((await lstat(path)).isSymbolicLink())
      throw new Error(`ZIP ${description} may not be a symbolic link: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function ensureSafeParents(root, destination) {
  let parent = resolve(destination, '..');
  while (parent !== root) {
    const fromRoot = relative(root, parent);
    if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot))
      throw new Error(`ZIP entry parent escapes its destination: ${destination}`);
    await rejectSymlinkPath(parent, 'entry parent');
    parent = resolve(parent, '..');
  }
}

function safeSymlinkTarget(root, destination, target, entryName) {
  if (!target || target.includes('\\') || target.includes('\0') || isAbsolute(target))
    throw new Error(`Unsafe ZIP symbolic link target for ${entryName}: ${JSON.stringify(target)}`);
  const resolvedTarget = resolve(destination, '..', target);
  const fromRoot = relative(root, resolvedTarget);
  if (!fromRoot || fromRoot.startsWith('..') || isAbsolute(fromRoot))
    throw new Error(`ZIP symbolic link escapes its destination: ${entryName} -> ${target}`);
  return target;
}

async function extractEntry(archive, entry, root, signal) {
  const destination = destinationFor(root, entry.fileName);
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const fileType = mode & 0o170000;
  const isSymlink = fileType === 0o120000;
  let isDirectory = fileType === 0o040000 || entry.fileName.endsWith('/');
  const madeBy = entry.versionMadeBy >>> 8;
  if (!isDirectory && madeBy === 0 && entry.externalFileAttributes === 16)
    isDirectory = true;
  await ensureSafeParents(root, destination);
  if (isSymlink) {
    if (entry.uncompressedSize > 4096)
      throw new Error(`ZIP symbolic link target is too long: ${entry.fileName}`);
    await mkdir(resolve(destination, '..'), { recursive: true });
    const input = await openEntryStream(archive, entry);
    const target = new TextDecoder('utf-8', { fatal: true }).decode(await buffer(input));
    await symlink(safeSymlinkTarget(root, destination, target, entry.fileName), destination);
    return;
  }
  if (isDirectory) {
    await rejectSymlinkPath(destination, 'directory entry');
    await mkdir(destination, { recursive: true, mode: (mode & 0o777) || 0o755 });
    return;
  }
  await mkdir(resolve(destination, '..'), { recursive: true });
  const input = await openEntryStream(archive, entry);
  await pipeline(input, createWriteStream(destination, {
    flags: 'wx',
    mode: (mode & 0o777) || 0o644,
  }), { signal });
}

export async function extractArchive(path, { dir, signal } = {}) {
  if (!isAbsolute(dir)) throw new Error('ZIP destination must be an absolute path');
  await mkdir(dir, { recursive: true });
  const root = resolve(dir);
  await rejectSymlinkPath(root, 'destination root');
  const archive = await openArchive(path);
  try {
    while (true) {
      const entry = await nextEntry(archive, signal);
      if (!entry) break;
      if (!entry.fileName.startsWith('__MACOSX/'))
        await extractEntry(archive, entry, root, signal);
    }
  } finally {
    archive.close();
  }
}
