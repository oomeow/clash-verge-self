import { execSync, spawn } from "child_process";
import fs from "fs-extra";

import {
  cratesPath,
  getExeSuffix,
  getTarget,
  RESOURCE_DIR,
  resourcePath,
  SERVICE_CACHE_FILE,
  snapshotFilesHashOnDir,
} from "./utils";

export async function buildService(logger?: (message: string) => void) {
  const argv = process.argv;
  const packageName = "clash-verge-self-service";

  const target = getTarget(argv);
  // const useCrossBuild = [
  //   "i686-unknown-linux-gnu",
  //   "aarch64-unknown-linux-gnu",
  //   "armv7-unknown-linux-gnueabihf",
  // ].includes(target);
  // const command = useCrossBuild ? "cross" : "cargo";

  const command = "cargo";
  const args = [
    "build",
    "--release",
    "--package",
    packageName,
    "--color",
    "always",
  ];
  if (target) {
    args.push("--target", target);
  }
  if (logger) {
    logger(`command: ${command} ${args}`);
  } else {
    console.log(`command:`, command, args);
  }
  // note(`use [${command}] to build service`);

  const buildTask = new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), shell: false });
    child.stdout.on("data", (data: Buffer) => {
      if (logger) {
        logger(data.toString().trimEnd());
      } else {
        console.log(data.toString().trimEnd());
      }
    });

    child.stderr.on("data", (data: Buffer) => {
      if (logger) {
        logger(data.toString().trimEnd());
      } else {
        console.error(data.toString().trimEnd());
      }
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(null);
      } else {
        reject(new Error(`子进程退出，退出码 ${code}`));
      }
    });
  });

  await buildTask;

  if (!fs.pathExistsSync(RESOURCE_DIR)) {
    await fs.mkdirp(RESOURCE_DIR);
  }
  const exeSuffix = getExeSuffix(argv);
  let bundleFilePath = `target/release/${packageName}${exeSuffix}`;
  if (target) {
    bundleFilePath = `target/${target}/release/${packageName}${exeSuffix}`;
  }
  const serviceResPath = resourcePath(`${packageName}${exeSuffix}`);
  await fs.copyFile(bundleFilePath, serviceResPath);
  if (exeSuffix !== ".exe") {
    execSync(`chmod 755 ${serviceResPath}`);
  }
}

if (import.meta.main) {
  buildService().then(() => {
    const serviceDir = cratesPath("clash-verge-self-service");
    const snapshot = snapshotFilesHashOnDir(serviceDir);
    try {
      fs.writeJsonSync(SERVICE_CACHE_FILE, snapshot, { spaces: 2 });
    } catch (_err) {
      // cache write failure should not hide successful build, but notify user
      process.exit(1);
    }
  });
}
