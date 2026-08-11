#!/usr/bin/env node
import { install, resolveInstallation, verify } from './index.js';

const [command = 'help', version] = process.argv.slice(2);

function formatMiB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function reportDownload({ label, receivedBytes, totalBytes, complete }) {
  const amount = totalBytes
    ? `${formatMiB(receivedBytes)} / ${formatMiB(totalBytes)} (${Math.floor(receivedBytes / totalBytes * 100)}%)`
    : formatMiB(receivedBytes);
  if (process.stderr.isTTY) {
    process.stderr.write(`\r${label}: ${amount}${complete ? '\n' : ''}`);
  } else if (receivedBytes === 0 || complete) {
    console.error(`${label}: ${complete ? 'downloaded' : 'downloading'} ${amount}`);
  }
}

function reportStatus(message) {
  console.error(message);
}

try {
  if (command === 'install') {
    const result = await install({ version, onProgress: reportDownload, onStatus: reportStatus });
    console.log(`Installed Rhendium ${result.version}`);
    console.log(`Browser: ${result.executablePath}`);
    console.log(`Launcher: ${result.launcherPath}`);
    console.log(`GPU launcher: ${result.gpuLauncherPath}`);
  } else if (command === 'path') {
    console.log((await resolveInstallation({ version })).executablePath);
  } else if (command === 'verify' || command === 'doctor') {
    const result = await verify({ version });
    console.log(`Rhendium ${result.version} is ready`);
    console.log(`Browser: ${result.executablePath}`);
    console.log(`Fonts: ${result.fontConfigPath}`);
  } else {
    console.log('Usage: rhendium <install|path|verify|doctor> [version]');
    process.exitCode = command === 'help' ? 0 : 2;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
