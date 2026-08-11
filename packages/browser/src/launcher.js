import { chmod, writeFile } from 'node:fs/promises';
import { platform as hostPlatform } from 'node:os';
import { join, posix, win32 } from 'node:path';

function launcherDetails(platform, version, key, asset, fontPack, enableGpu) {
  const gpuArgument = enableGpu ? ' "--enable-gpu"' : '';
  if (platform === 'win32') {
    const executable = win32.join('browsers', version, key, ...asset.executable.split('/'));
    const fontConfig = win32.join('fonts', fontPack.id, ...fontPack.profile.split('/'));
    return {
      name: enableGpu ? 'Rhendium-GPU.cmd' : 'Rhendium.cmd',
      contents: [
        '@echo off',
        'setlocal DisableDelayedExpansion',
        `start "" "%~dp0${executable}"${gpuArgument} ` +
          `"--rhendium-font-config=%~dp0${fontConfig}" %*`,
        '',
      ].join('\r\n'),
    };
  }

  const executable = posix.join('browsers', version, key, asset.executable);
  const fontConfig = posix.join('fonts', fontPack.id, fontPack.profile);
  const extension = platform === 'darwin' ? '.command' : '.sh';
  return {
    name: `Rhendium${enableGpu ? '-GPU' : ''}${extension}`,
    contents: [
      '#!/bin/sh',
      'set -eu',
      'rhendium_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
      `exec "$rhendium_root/${executable}"${gpuArgument} ` +
        `"--rhendium-font-config=$rhendium_root/${fontConfig}" "$@"`,
      '',
    ].join('\n'),
  };
}

async function writeLauncher({ root, version, key, asset, fontPack, platform, enableGpu }) {
  const details = launcherDetails(platform, version, key, asset, fontPack, enableGpu);
  const path = join(root, details.name);
  await writeFile(path, details.contents, 'utf8');
  if (platform !== 'win32') await chmod(path, 0o755);
  return path;
}

export async function writeLaunchers({ root, version, key, asset, fontPack, platform = hostPlatform() }) {
  const launcherPath = await writeLauncher({
    root, version, key, asset, fontPack, platform, enableGpu: false,
  });
  const gpuLauncherPath = await writeLauncher({
    root, version, key, asset, fontPack, platform, enableGpu: true,
  });
  return { launcherPath, gpuLauncherPath };
}
