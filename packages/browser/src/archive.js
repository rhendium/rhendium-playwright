import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
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

async function extractEntry(archive, entry, root, signal) {
  const destination = destinationFor(root, entry.fileName);
  const mode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const fileType = mode & 0o170000;
  const isSymlink = fileType === 0o120000;
  let isDirectory = fileType === 0o040000 || entry.fileName.endsWith('/');
  const madeBy = entry.versionMadeBy >>> 8;
  if (!isDirectory && madeBy === 0 && entry.externalFileAttributes === 16)
    isDirectory = true;
  if (isSymlink)
    throw new Error(`Rhendium archives may not contain symbolic links: ${entry.fileName}`);
  if (isDirectory) {
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
