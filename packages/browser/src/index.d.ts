export interface DownloadProgress {
  label: string;
  receivedBytes: number;
  totalBytes?: number;
  complete?: boolean;
}
export interface InstallOptions {
  version?: string;
  platformKey?: string;
  cachePath?: string;
  onProgress?: (progress: DownloadProgress) => void;
}
export interface Installation {
  version: string;
  chromiumVersion?: string;
  platformKey: string;
  browserDirectory?: string;
  fontDirectory?: string;
  executablePath: string;
  fontConfigPath: string;
}
export function loadManifest(): Promise<unknown>;
export function loadManifestSync(): unknown;
export function platformKey(platform?: string, arch?: string): string;
export function cacheRoot(env?: NodeJS.ProcessEnv): string;
export function install(options?: InstallOptions): Promise<Installation>;
export function resolveInstallation(options?: InstallOptions): Promise<Installation>;
export function resolveInstallationSync(options?: InstallOptions): Installation;
export function verify(options?: InstallOptions): Promise<Installation>;
export function fontConfigArgument(fontConfigPath: string): string;
