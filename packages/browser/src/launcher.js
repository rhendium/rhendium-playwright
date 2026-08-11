import { chmod, writeFile } from 'node:fs/promises';
import { platform as hostPlatform } from 'node:os';
import { join, posix, win32 } from 'node:path';

function launcherDetails(platform, version, key, asset, fontPack) {
  if (platform === 'win32') {
    const executable = win32.join('browsers', version, key, ...asset.executable.split('/'));
    const fontConfig = win32.join('fonts', fontPack.id, ...fontPack.profile.split('/'));
    return {
      name: 'Rhendium.cmd',
      contents: [
        '@echo off',
        'setlocal DisableDelayedExpansion',
        `start "" "%~dp0${executable}" "--rhendium-font-config=%~dp0${fontConfig}" %*`,
        '',
      ].join('\r\n'),
    };
  }

  const executable = posix.join('browsers', version, key, asset.executable);
  const fontConfig = posix.join('fonts', fontPack.id, fontPack.profile);
  return {
    name: platform === 'darwin' ? 'Rhendium.command' : 'Rhendium.sh',
    contents: [
      '#!/bin/sh',
      'set -eu',
      'rhendium_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
      `exec "$rhendium_root/${executable}" "--rhendium-font-config=$rhendium_root/${fontConfig}" "$@"`,
      '',
    ].join('\n'),
  };
}

export async function writeLauncher({ root, version, key, asset, fontPack, platform = hostPlatform() }) {
  const details = launcherDetails(platform, version, key, asset, fontPack);
  const path = join(root, details.name);
  await writeFile(path, details.contents, 'utf8');
  if (platform !== 'win32') await chmod(path, 0o755);
  return path;
}
