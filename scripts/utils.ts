import { execSync } from "child_process";
import fs from "fs-extra";
import path from "path";

const cwd = process.cwd();
export const TEMP_DIR = path.join(cwd, "node_modules/.verge");
export const SIDECAR_DIR = path.join(cwd, "src-tauri", "sidecar");
export const RESOURCE_DIR = path.join(cwd, "src-tauri", "resources");

export function sidecarPath(file: string) {
  return path.join(SIDECAR_DIR, file);
}

export function resourcePath(file: string) {
  return path.join(RESOURCE_DIR, file);
}

export const PLATFORM_MAP: Record<string, NodeJS.Platform> = {
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

export const ARCH_MAP: Record<string, string> = {
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

/* ======= mihomo stable ======= */
export const MIHOMO_VERSION_URL =
  "https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt";
export const MIHOMO_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download`;

export const MIHOMO_MAP: Record<string, string> = {
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
export const MIHOMO_ALPHA_VERSION_URL =
  "https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt";
export const MIHOMO_ALPHA_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha`;

export const MIHOMO_ALPHA_MAP: Record<string, string> = {
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

export function getRustHost() {
  const host = execSync("rustc -vV")
    .toString()
    .match(/(?<=host: ).+(?=\s*)/g)?.[0];
  if (!host) {
    throw new Error("could not resolve rust host");
  }
  return host;
}

export function getArgValue(argv: string[], arg: string) {
  const index = argv.findIndex((item) => item === arg);
  if (index === -1) {
    return undefined;
  }
  return argv[index + 1];
}

export function getTarget(argv: string[]) {
  return getArgValue(argv, "--target");
}

export function getPlatform(argv: string[]) {
  const target = getTarget(argv) ?? getRustHost();
  return target ? PLATFORM_MAP[target] : process.platform;
}

export function getArch(argv: string[]) {
  const target = getTarget(argv) ?? getRustHost();
  return target ? ARCH_MAP[target] : process.arch;
}

export function getPlatformArch(argv: string[]) {
  const platform = getPlatform(argv);
  const arch = getArch(argv);
  return `${platform}-${arch}`;
}

export function getExeSuffix(argv: string[]) {
  return getPlatform(argv) === "win32" ? ".exe" : "";
}

export function getClashVergeSelfServiceVersion() {
  const cargoFilePath = path.join(
    process.cwd(),
    "crates/clash-verge-self-service/Cargo.toml",
  );

  return fs
    .readFileSync(cargoFilePath, "utf-8")
    .match(/(?<=version\s*=\s*")[^"]+/)?.[0];
}
