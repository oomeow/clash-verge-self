import { context, getOctokit } from "@actions/github";
import AdmZip from "adm-zip";
import fs from "fs-extra";
import { createRequire } from "module";
import path from "path";
import * as tar from "tar";

import { getTarget } from "./utils";

const argv = process.argv;
const target = getTarget(argv);
const alpha = process.argv.includes("--alpha");

const ARCH_MAP: Record<string, string> = {
  // Windows
  "x86_64-pc-windows-msvc": "x64",
  "i686-pc-windows-msvc": "x86",
  "aarch64-pc-windows-msvc": "arm64",
  // Linux
  "x86_64-unknown-linux-gnu": "amd64",
  "i686-unknown-linux-gnu": "i386",
  "aarch64-unknown-linux-gnu": "arm64",
  "armv7-unknown-linux-gnueabihf": "armhf",
};

const PROCESS_MAP: Record<string, string> = {
  x64: "x64",
  ia32: "x86",
  arm64: "arm64",
};
const arch = target ? ARCH_MAP[target] : PROCESS_MAP[process.arch];
/// Script for ci
/// 打包绿色版/便携版 (only Windows and Linux)
async function resolvePortable() {
  const isWindows = process.platform === "win32";
  const isLinux = process.platform === "linux";

  if (!isWindows && !isLinux) {
    throw new Error("unspport platform to bundle portable version");
  }

  const releaseDir = target ? `./target/${target}/release` : `./target/release`;
  const require = createRequire(import.meta.url);
  const packageJson = require("../package.json");
  const { version } = packageJson;
  const zipFile = isLinux
    ? `clash-verge-self_${version}_${arch}_portable.tar.gz`
    : `Clash.Verge.Self_${version}_${arch}_portable.zip`;

  if (isWindows) {
    await bundlePortableForWindows(releaseDir, zipFile);
  } else if (isLinux) {
    await bundlePortableForLinux(releaseDir, zipFile);
  }

  console.log("[INFO]: create portable zip successfully");

  // push release assets
  if (process.env.GITHUB_TOKEN === undefined) {
    throw new Error("GITHUB_TOKEN is required");
  }

  const options = { owner: context.repo.owner, repo: context.repo.repo };
  const github = getOctokit(process.env.GITHUB_TOKEN);
  const tag = alpha ? "alpha" : process.env.TAG_NAME || `v${version}`;
  console.log(`⬆️ Uploading ${zipFile}...`);

  const { data: release } = await github.rest.repos.getReleaseByTag({
    ...options,
    tag,
  });

  const assets = release.assets.filter((x) => {
    return x.name === zipFile;
  });
  if (assets.length > 0) {
    console.log(`🗑️ Deleting old ${zipFile}...`);
    const id = assets[0].id;
    await github.rest.repos.deleteReleaseAsset({
      ...options,
      asset_id: id,
    });
    console.log(`🗑️ Deleted old ${zipFile}`);
  }

  const zipBuffer = await fs.readFile(zipFile);
  await github.rest.repos.uploadReleaseAsset({
    ...options,
    release_id: release.id,
    name: zipFile,
    data: zipBuffer as unknown as string,
  });

  console.log(`✅ Uploaded ${zipFile}`);
}

async function bundlePortableForWindows(releaseDir: string, zipFile: string) {
  const configDir = path.join(releaseDir, ".config");
  if (!(await fs.pathExists(releaseDir))) {
    throw new Error(`could not found the release dir [${releaseDir}]`);
  }

  await fs.rm(configDir, { recursive: true, force: true });
  await fs.mkdir(configDir);
  await fs.createFile(path.join(configDir, "PORTABLE"));

  const zip = new AdmZip();
  zip.addLocalFile(path.join(releaseDir, "Clash Verge Self.exe"));
  zip.addLocalFile(path.join(releaseDir, "self-mihomo.exe"));
  zip.addLocalFile(path.join(releaseDir, "self-mihomo-alpha.exe"));
  zip.addLocalFolder(path.join(releaseDir, "resources"), "resources");
  zip.addLocalFolder(configDir, ".config");
  zip.writeZip(zipFile);
}

async function bundlePortableForLinux(releaseDir: string, zipFile: string) {
  const configDir = path.join(releaseDir, ".config");
  if (!(await fs.pathExists(releaseDir))) {
    throw new Error(`could not found the release dir [${releaseDir}]`);
  }

  await fs.rm(configDir, { recursive: true, force: true });
  await fs.mkdir(configDir);
  await fs.createFile(path.join(configDir, "PORTABLE"));

  tar.c({ gzip: true, sync: true, cwd: releaseDir, file: zipFile }, [
    "clash-verge-self",
    "self-mihomo",
    "self-mihomo-alpha",
    "resources",
    ".config",
  ]);
}

resolvePortable().catch(console.error);
