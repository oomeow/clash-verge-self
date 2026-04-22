import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  progress,
  select,
  spinner,
  taskLog,
} from "@clack/prompts";
import AdmZip from "adm-zip";
import { execSync } from "child_process";
import fs from "fs-extra";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import path from "path";
import pc from "picocolors";
import * as tar from "tar";
import zlib from "zlib";

type Version = "stable" | "alpha";
type TaskLogger = {
  message: (message: string, options?: any) => void;
  success: (message: string, options?: { showLog?: boolean }) => void;
  error: (message: string, options?: { showLog?: boolean }) => void;
};
type FetchOptions = Record<string, unknown> & { timeout?: number };
type BinInfo = {
  name: string;
  targetFile: string;
  exeFile: string;
  zipFile: string;
  downloadURL: string;
};
type ResourceInfo = {
  file: string;
  downloadURL?: string;
  localPath?: string;
};
type Task = {
  name: string;
  func: (logger: TaskLogger) => Promise<void>;
  retry: number;
  targetPath?: string;
  winOnly?: boolean;
  linuxOnly?: boolean;
  unixOnly?: boolean;
  macOnly?: boolean;
};
type ResourceTaskConfig = ResourceInfo & {
  name: string;
  label: string;
  winOnly?: boolean;
  macOnly?: boolean;
};

const VERGE_SERVICE_VERSION = "v2.0.0";
const cwd = process.cwd();
const TEMP_DIR = path.join(cwd, "node_modules/.verge");
const SIDECAR_DIR = path.join(cwd, "src-tauri", "sidecar");
const RESOURCE_DIR = path.join(cwd, "src-tauri", "resources");
const rawArgvs = process.argv;
const useAlphaService = rawArgvs.includes("--alpha");
const NO_CONFIRM = rawArgvs.includes("--no-confirm");
let FORCE = rawArgvs.includes("--force");
const process_argvs = rawArgvs.filter(
  (item) => !["--alpha", "--force", "--no-confirm"].includes(item),
);

const PLATFORM_MAP: Record<string, NodeJS.Platform> = {
  "x86_64-pc-windows-msvc": "win32",
  "i686-pc-windows-msvc": "win32",
  "aarch64-pc-windows-msvc": "win32",
  "x86_64-apple-darwin": "darwin",
  "aarch64-apple-darwin": "darwin",
  "x86_64-unknown-linux-gnu": "linux",
  "i686-unknown-linux-gnu": "linux",
  "aarch64-unknown-linux-gnu": "linux",
  "armv7-unknown-linux-gnueabihf": "linux",
  "riscv64gc-unknown-linux-gnu": "linux",
  "loongarch64-unknown-linux-gnu": "linux",
};
const ARCH_MAP: Record<string, string> = {
  "x86_64-pc-windows-msvc": "x64",
  "i686-pc-windows-msvc": "ia32",
  "aarch64-pc-windows-msvc": "arm64",
  "x86_64-apple-darwin": "x64",
  "aarch64-apple-darwin": "arm64",
  "x86_64-unknown-linux-gnu": "x64",
  "i686-unknown-linux-gnu": "ia32",
  "aarch64-unknown-linux-gnu": "arm64",
  "armv7-unknown-linux-gnueabihf": "arm",
  "riscv64gc-unknown-linux-gnu": "riscv64",
  "loongarch64-unknown-linux-gnu": "loong64",
};

const target = process_argvs[2];
const platform = target ? PLATFORM_MAP[target] : process.platform;
const arch = target ? ARCH_MAP[target] : process.arch;

function getRustHost() {
  const host = execSync("rustc -vV")
    .toString()
    .match(/(?<=host: ).+(?=\s*)/g)?.[0];
  if (!host) {
    throw new Error("could not resolve rust host");
  }
  return host;
}

const SIDECAR_HOST = target ? target : getRustHost();
const EXE_SUFFIX = platform === "win32" ? ".exe" : "";
const PLATFORM_ARCH = `${platform}-${arch}`;

function handleCancel<T>(value: T) {
  if (isCancel(value)) {
    cancel("Operation cancelled");
    process.exit(0);
  }
  return value;
}

function formatResourcePath(resourcePath: string) {
  return path.relative(cwd, resourcePath) || resourcePath;
}

function sidecarPath(file: string) {
  return path.join(SIDECAR_DIR, file);
}

function resourcePath(file: string) {
  return path.join(RESOURCE_DIR, file);
}

function getFetchOptions(): FetchOptions {
  const httpProxy =
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy;
  return httpProxy ? { agent: new HttpsProxyAgent(httpProxy) } : {};
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${units[unitIndex]}`;
}

/* ======= mihomo stable ======= */
const MIHOMO_VERSION_URL =
  "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt";
const MIHOMO_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download`;

const MIHOMO_MAP: Record<string, string> = {
  "win32-x64": "mihomo-windows-amd64-v3",
  "win32-ia32": "mihomo-windows-386",
  "win32-arm64": "mihomo-windows-arm64",
  "darwin-x64": "mihomo-darwin-amd64-v3",
  "darwin-arm64": "mihomo-darwin-arm64",
  "linux-x64": "mihomo-linux-amd64-v3",
  "linux-ia32": "mihomo-linux-386",
  "linux-arm64": "mihomo-linux-arm64",
  "linux-arm": "mihomo-linux-armv7",
  "linux-riscv64": "mihomo-linux-riscv64",
  "linux-loong64": "mihomo-linux-loong64",
};

/* ======= mihomo alpha======= */
const MIHOMO_ALPHA_VERSION_URL =
  "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt";
const MIHOMO_ALPHA_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha`;

const MIHOMO_ALPHA_MAP: Record<string, string> = {
  "win32-x64": "mihomo-windows-amd64-v3",
  "win32-ia32": "mihomo-windows-386",
  "win32-arm64": "mihomo-windows-arm64",
  "darwin-x64": "mihomo-darwin-amd64-v3",
  "darwin-arm64": "mihomo-darwin-arm64",
  "linux-x64": "mihomo-linux-amd64-v3",
  "linux-ia32": "mihomo-linux-386",
  "linux-arm64": "mihomo-linux-arm64",
  "linux-arm": "mihomo-linux-armv7",
  "linux-riscv64": "mihomo-linux-riscv64",
  "linux-loong64": "mihomo-linux-loong64",
};

// check available
if (!MIHOMO_MAP[PLATFORM_ARCH]) {
  throw new Error(`mihomo unsupported platform "${PLATFORM_ARCH}"`);
}
if (!MIHOMO_ALPHA_MAP[PLATFORM_ARCH]) {
  throw new Error(`mihomo alpha unsupported platform "${PLATFORM_ARCH}"`);
}

/**
 * fetch with timeout (default timeout: 8000ms)
 */
async function fetchWithTimeout(resource: string, options: FetchOptions = {}) {
  const { timeout = 8000 } = options; // 默认超时时间为 8 秒
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`fetch error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`fetch timeout: ${timeout}ms`);
    } else {
      throw error;
    }
  } finally {
    clearTimeout(id);
  }
}

async function getLatestMihomoVersion(
  version: Version,
  logger: TaskLogger,
): Promise<string> {
  const isAlpha = version === "alpha";
  const label = isAlpha ? "alpha" : "stable";
  const versionUrl = isAlpha ? MIHOMO_ALPHA_VERSION_URL : MIHOMO_VERSION_URL;

  logger.message(`get latest mihomo ${label} version`);
  try {
    const response = await fetchWithTimeout(versionUrl, {
      ...getFetchOptions(),
      method: "GET",
    });
    const v = await response.text();
    const latestVersion = v.trim();
    logger.message(`Latest ${label} version: ${latestVersion}`);
    return latestVersion;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching latest ${label} version: ${message}`);
    throw error;
  }
}

/**
 * mihomo version info
 */
function mihomo(version: Version, mihomoVersion: string): BinInfo {
  const isAlpha = version === "alpha";
  const name = (isAlpha ? MIHOMO_ALPHA_MAP : MIHOMO_MAP)[PLATFORM_ARCH];
  const isWin = platform === "win32";
  const urlExt = isWin ? "zip" : "gz";
  const binName = isAlpha ? "self-mihomo-alpha" : "self-mihomo";
  const urlPrefix = isAlpha
    ? MIHOMO_ALPHA_URL_PREFIX
    : `${MIHOMO_URL_PREFIX}/${mihomoVersion}`;
  const downloadURL = `${urlPrefix}/${name}-${mihomoVersion}.${urlExt}`;
  const exeFile = `${name}${EXE_SUFFIX}`;
  const zipFile = `${name}-${mihomoVersion}.${urlExt}`;
  return {
    name: binName,
    targetFile: `${binName}-${SIDECAR_HOST}${EXE_SUFFIX}`,
    exeFile,
    zipFile,
    downloadURL,
  };
}

/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo: BinInfo, logger: TaskLogger) {
  const { name, targetFile, zipFile, exeFile, downloadURL } = binInfo;
  logger.message(`resolve sidecar ${name}`);

  const targetPath = sidecarPath(targetFile);

  logger.message(`download url: ${downloadURL}`);
  logger.message(`target path: ${targetPath}`);

  await fs.mkdirp(SIDECAR_DIR);
  if (!FORCE && (await fs.pathExists(targetPath))) {
    logger.message(`result: skipped existing sidecar ${targetFile}`);
    return;
  }

  const tempDir = path.join(TEMP_DIR, name);
  const tempZip = path.join(tempDir, zipFile);
  const tempExe = path.join(tempDir, exeFile);

  await fs.mkdirp(tempDir);
  try {
    if (!(await fs.pathExists(tempZip))) {
      await downloadFile(downloadURL, tempZip, logger);
    } else {
      logger.message(
        `result: using cached archive ${formatResourcePath(tempZip)}`,
      );
    }

    if (zipFile.endsWith(".zip")) {
      const zip = new AdmZip(tempZip);
      zip.getEntries().forEach((entry) => {
        logger.message(`"${name}" entry name ${entry.entryName}`);
      });
      logger.message("extract zip file to temp dir");
      zip.extractAllTo(tempDir, true);
      await fs.rename(tempExe, targetPath);
      logger.message(
        `result: extracted "${name}" to ${formatResourcePath(targetPath)}`,
      );
    } else if (zipFile.endsWith(".tgz")) {
      // tgz
      await fs.mkdirp(tempDir);
      await tar.extract({
        cwd: tempDir,
        file: tempZip,
        //strip: 1, // 可能需要根据实际的 .tgz 文件结构调整
      });
      const files = await fs.readdir(tempDir);
      logger.message(`"${name}" files in tempDir: ${files}`);
      const extractedFile = files.find((file) => file.startsWith("虚空终端-"));
      if (extractedFile) {
        const extractedFilePath = path.join(tempDir, extractedFile);
        logger.message(`"${name}" file renam to "${targetPath}"`);
        await fs.rename(extractedFilePath, targetPath);
        logger.message(`"chmod 755 to "${targetPath}"`);
        execSync(`chmod 755 ${targetPath}`);
        logger.message(
          `result: extracted and chmod "${name}" at ${formatResourcePath(targetPath)}`,
        );
      } else {
        throw new Error(`Expected file not found in ${tempDir}`);
      }
    } else {
      // gz
      const readStream = fs.createReadStream(tempZip);
      const writeStream = fs.createWriteStream(targetPath);
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          logger.message(`gz failed ["${name}"]: ${error.message}`);
          reject(error);
        };
        readStream
          .pipe(zlib.createGunzip().on("error", onError))
          .pipe(writeStream)
          .on("finish", () => {
            logger.message(`gunzip finished: "${name}"`);
            execSync(`chmod 755 ${targetPath}`);
            logger.message(
              `result: gunzip and chmod "${name}" at ${formatResourcePath(targetPath)}`,
            );
            resolve();
          })
          .on("error", onError);
      });
    }
  } catch (err) {
    logger.message(`${err}`);
    // 需要删除文件
    await fs.remove(targetPath);
    throw err;
  } finally {
    // delete temp dir
    await fs.remove(tempDir);
  }
}

/**
 * download the file to the resources dir
 */
async function resolveResource(binInfo: ResourceInfo, logger: TaskLogger) {
  const { file, downloadURL, localPath } = binInfo;

  try {
    const targetPath = resourcePath(file);
    logger.message(`target path: ${formatResourcePath(targetPath)}`);

    if (!FORCE && (await fs.pathExists(targetPath))) {
      logger.message(`result: skipped existing resource ${file}`);
      return;
    }

    await fs.mkdirp(RESOURCE_DIR);
    if (downloadURL) {
      await downloadFile(downloadURL, targetPath, logger);
    }
    if (localPath) {
      const spin = spinner();
      spin.start("copying...");
      spin.message(`local path: ${formatResourcePath(localPath)}`);
      spin.message(`copy ${file} to ${formatResourcePath(targetPath)}`);
      await fs.copyFile(localPath, targetPath);
      spin.stop(
        `result: copied ${formatResourcePath(localPath)} to ${formatResourcePath(targetPath)}`,
      );
    }
    logger.message(
      `result: resolved ${file} at ${formatResourcePath(targetPath)}`,
    );
  } catch (err) {
    logger.error(`resolve failed: ${file}`);
    throw err;
  }
}

/**
 * download file and save to `path`
 */
async function downloadFile(url: string, path: string, logger: TaskLogger) {
  const response = await fetchWithTimeout(url, {
    ...getFetchOptions(),
    method: "GET",
    headers: { "Content-Type": "application/octet-stream" },
    timeout: 1000 * 60 * 2, // 下载文件默认超时 2 分钟
  });
  if (response.status === 404) {
    logger.message(`download failed, file not found: "${url}"`);
    throw new Error(`file not found: ${url}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const hasContentLength = Number.isFinite(contentLength) && contentLength > 0;
  const downloadProgress = progress({
    max: hasContentLength ? contentLength : 100,
  });
  const chunks: Uint8Array[] = [];
  let downloaded = 0;
  let unknownSizeProgress = 0;

  downloadProgress.start(
    hasContentLength
      ? `Downloading ${formatBytes(contentLength)}`
      : "Downloading",
  );

  try {
    if (response.body) {
      for await (const chunk of response.body) {
        const chunkBuffer = Buffer.from(chunk);
        chunks.push(chunkBuffer);
        downloaded += chunkBuffer.length;

        if (hasContentLength) {
          downloadProgress.advance(
            chunkBuffer.length,
            `Downloading ${formatBytes(downloaded)} / ${formatBytes(contentLength)}`,
          );
        } else {
          const step = unknownSizeProgress < 99 ? 1 : 0;
          unknownSizeProgress += step;
          downloadProgress.advance(
            step,
            `Downloading ${formatBytes(downloaded)}`,
          );
        }
      }
    } else {
      const buffer = await response.arrayBuffer();
      chunks.push(new Uint8Array(buffer));
      downloaded = buffer.byteLength;
      downloadProgress.advance(
        hasContentLength ? downloaded : 100,
        `Downloading ${formatBytes(downloaded)}`,
      );
    }

    // 下载进度完成后更好的视觉体验
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    await fs.writeFile(path, Buffer.concat(chunks));
    downloadProgress.stop(`Downloaded ${formatBytes(downloaded)}`);
  } catch (err) {
    downloadProgress.error(`Download failed after ${formatBytes(downloaded)}`);
    throw err;
  }

  logger.message(`downloaded ${url} to ${formatResourcePath(path)}`);
}

/**
 * NSIS plugin: `SimpleSC.dll`
 *
 * only for Windows
 */
async function resolvePlugin(logger: TaskLogger) {
  logger.message("Resolve NSIS plugin (SimpleSC)");

  const url =
    "https://nsis.sourceforge.io/mediawiki/images/e/ef/NSIS_Simple_Service_Plugin_Unicode_1.30.zip";
  const tempDir = path.join(TEMP_DIR, "SimpleSC");
  const tempZip = path.join(
    tempDir,
    "NSIS_Simple_Service_Plugin_Unicode_1.30.zip",
  );
  const tempDll = path.join(tempDir, "SimpleSC.dll");
  const appData = process.env.APPDATA;
  if (!appData) {
    throw new Error("APPDATA is required to resolve NSIS plugin");
  }
  const pluginDir = path.join(appData, "Local/NSIS");
  const pluginPath = path.join(pluginDir, "SimpleSC.dll");
  await fs.mkdirp(pluginDir);
  await fs.mkdirp(tempDir);
  logger.message(`download url: ${url}`);
  logger.message(`target path: ${pluginPath}`);
  if (!FORCE && (await fs.pathExists(pluginPath))) {
    logger.message("result: skipped existing NSIS plugin (SimpleSC)");
    return;
  }
  try {
    if (!(await fs.pathExists(tempZip))) {
      await downloadFile(url, tempZip, logger);
    } else {
      logger.message(
        `result: using cached archive ${formatResourcePath(tempZip)}`,
      );
    }
    const zip = new AdmZip(tempZip);
    zip.extractAllTo(tempDir, true);
    logger.message(`result: extracted "SimpleSC" to ${tempDir}`);
    await fs.copyFile(tempDll, pluginPath);
    logger.message(`result: copied "SimpleSC" to ${pluginPath}`);
  } finally {
    await fs.remove(tempDir);
  }
}

/**
 * chmod 755 for Clash Verge Self Service
 */
async function resolveServicePermission(_logger: TaskLogger) {
  const serviceExecutable = `clash-verge-self-service${EXE_SUFFIX}`;
  const targetPath = resourcePath(serviceExecutable);
  const spin = spinner();
  spin.start("chmod...");
  if (await fs.pathExists(targetPath)) {
    execSync(`chmod 755 ${targetPath}`);
    spin.stop(
      `result: chmod 755 finished for ${formatResourcePath(targetPath)}`,
    );
  } else {
    spin.error(`result: service executable not found, chmod skipped`);
  }
}

function getClashVergeSelfService(version: Version): ResourceInfo {
  const fileName = `clash-verge-self-service-${SIDECAR_HOST}${EXE_SUFFIX}`;
  const releaseTag = version === "alpha" ? "alpha" : VERGE_SERVICE_VERSION;
  const downloadURL = `https://github.com/oomeow/clash-verge-self-service/releases/download/${releaseTag}/${fileName}`;

  return {
    file: fileName,
    downloadURL,
  };
}

async function resolveClashVergeSelfService(
  version: Version,
  logger: TaskLogger,
) {
  const label = version === "alpha" ? "Alpha" : "Stable";
  const downloadItem = getClashVergeSelfService(version);

  logger.message(`Download Clash Verge Self Service (${label})`);
  await resolveResource(
    {
      file: `clash-verge-self-service${EXE_SUFFIX}`,
      downloadURL: downloadItem.downloadURL,
    },
    logger,
  );
}

const RESOURCE_TASKS: ResourceTaskConfig[] = [
  {
    name: "Copy set_dns.sh",
    label: "Resolve Macos set dns script",
    file: "set_dns.sh",
    localPath: path.join(cwd, "scripts/set_dns.sh"),
    macOnly: true,
  },
  {
    name: "Copy unset_dns.sh",
    label: "Resolve Macos unset dns script",
    file: "unset_dns.sh",
    localPath: path.join(cwd, "scripts/unset_dns.sh"),
    macOnly: true,
  },
  {
    name: "Download Country mmdb",
    label: "Resolve Country mmdb",
    file: "Country.mmdb",
    downloadURL:
      "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country.mmdb",
  },
  {
    name: "Download geosite",
    label: "Resolve geosite",
    file: "geosite.dat",
    downloadURL:
      "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat",
  },
  {
    name: "Download geoip",
    label: "Resolve geoip",
    file: "geoip.dat",
    downloadURL:
      "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat",
  },
  {
    name: "Download ASN mmdb",
    label: "Resolve ASN mmdb",
    file: "ASN.mmdb",
    downloadURL:
      "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb",
  },
  {
    name: "Download enableLoopback.exe",
    label: "Resolve enableLoopback.exe",
    file: "enableLoopback.exe",
    downloadURL:
      "https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe",
    winOnly: true,
  },
];

function createResourceTask({
  name,
  label,
  file,
  downloadURL,
  localPath,
  ...filters
}: ResourceTaskConfig): Task {
  return {
    name,
    ...filters,
    retry: 5,
    targetPath: resourcePath(file),
    func: async (logger: TaskLogger) => {
      logger.message(label);
      await resolveResource({ file, downloadURL, localPath }, logger);
    },
  };
}

function createMihomoTask(): Task[] {
  return (["stable", "alpha"] as const).map((version) => {
    const isAlpha = version === "alpha";
    const name = isAlpha ? "self-mihomo-alpha" : "self-mihomo";
    const taskName = isAlpha
      ? "Download self-mihomo-alpha"
      : "Download self-mihomo";
    const label = isAlpha ? "Alpha" : "Stable";

    return {
      name: taskName,
      func: async (logger: TaskLogger) => {
        logger.message(`Download and unzip Latest Mihomo ${label} Version`);
        const latestVersion = await getLatestMihomoVersion(version, logger);
        await resolveSidecar(mihomo(version, latestVersion), logger);
      },
      retry: 5,
      targetPath: sidecarPath(`${name}-${SIDECAR_HOST}${EXE_SUFFIX}`),
    };
  });
}

function createTasks(version: Version): Task[] {
  return [
    ...createMihomoTask(),
    {
      name: "Download clash-verge-self-service",
      func: (logger: TaskLogger) =>
        resolveClashVergeSelfService(version, logger),
      retry: 5,
      targetPath: resourcePath(`clash-verge-self-service${EXE_SUFFIX}`),
    },
    ...RESOURCE_TASKS.map(createResourceTask),
    {
      name: "Download SimpleSC plugin",
      func: resolvePlugin,
      retry: 5,
      winOnly: true,
      targetPath: process.env.APPDATA
        ? path.join(process.env.APPDATA, "Local/NSIS", "SimpleSC.dll")
        : undefined,
    },
    {
      name: "Chmod clash-verge-self-service",
      func: resolveServicePermission,
      retry: 1,
      unixOnly: true,
      targetPath: resourcePath(`clash-verge-self-service${EXE_SUFFIX}`),
    },
  ];
}

function shouldRunTask(task: Task) {
  if (task.winOnly && platform !== "win32") return false;
  if (task.linuxOnly && platform !== "linux") return false;
  if (task.unixOnly && platform === "win32") return false;
  if (task.macOnly && platform !== "darwin") return false;
  return true;
}

async function chooseVersion(): Promise<Version> {
  if (useAlphaService) {
    log.info("Use alpha resource version from --alpha");
    return "alpha";
  }

  if (NO_CONFIRM) {
    log.info("Use default stable resource version from --no-confirm");
    return "stable";
  }

  const version = await select({
    message: "Select resource version",
    options: [
      { value: "stable", label: "Stable" },
      { value: "alpha", label: "Alpha" },
    ],
    initialValue: "stable",
  });

  return handleCancel(version) as Version;
}

async function confirmOverwriteIfNeeded(tasks: Task[]) {
  if (FORCE) return;

  const existingResources = new Set<string>();
  for (const task of tasks) {
    if (!task.targetPath) continue;
    if (await fs.pathExists(task.targetPath)) {
      existingResources.add(formatResourcePath(task.targetPath));
    }
  }

  if (existingResources.size === 0) return;

  log.warn(
    [
      "Existing resources found:",
      ...[...existingResources].map((resource) => `  - ${resource}`),
    ].join("\n"),
  );

  if (NO_CONFIRM) {
    FORCE = true;
    log.info("Use default overwrite confirmation from --no-confirm");
    return;
  }

  const overwrite = await confirm({
    message: "Force overwrite existing resources?",
    initialValue: true,
  });

  FORCE = handleCancel(overwrite) as boolean;
}

async function runTaskWithRetry(task: Task) {
  const taskName = pc.bgBlue(pc.white(` ${task.name} `));
  const logger = taskLog({
    title: taskName,
    retainLog: true,
  });

  for (let i = 0; i < task.retry; i++) {
    try {
      await task.func(logger);
      logger.success(`task::${task.name} Done!`, { showLog: false });
      return;
    } catch (err) {
      const attempt = i + 1;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const message = `task::${task.name} attempt ${attempt}/${task.retry}, error message: ${errorMessage}`;
      logger.message(message);
      if (attempt === task.retry) {
        logger.error(`task::${task.name} failed`, { showLog: true });
        throw err;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    }
  }
}

/**
 * main function for run tasks
 */
async function runTask() {
  intro(pc.bgCyan(pc.white(" Check and download files ")));
  const version = await chooseVersion();
  const tasks = createTasks(version).filter(shouldRunTask);
  await confirmOverwriteIfNeeded(tasks);

  for (const task of tasks) {
    await runTaskWithRetry(task);
  }

  outro(pc.bgGreen(pc.white(" all tasks has run finished ")));
}

// run
runTask();
