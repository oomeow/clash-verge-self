import { spawn } from "child_process";
import fs from "fs-extra";

import { getExeSuffix, getTarget, RESOURCE_DIR, resourcePath } from "./utils";

export async function buildService(logger?: (message: string) => void) {
  const argv = process.argv;
  const packageName = "clash-verge-self-service";
  const target = getTarget(argv);

  const buildTask = new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      ["build", "--release", "--package", packageName, "--target", target],
      { cwd: process.cwd(), shell: false },
    );
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

  const exeSuffix = getExeSuffix(argv);
  if (!fs.pathExistsSync(RESOURCE_DIR)) {
    await fs.mkdirp(RESOURCE_DIR);
  }
  const bundleFilePath = `target/${target}/release/${packageName}${exeSuffix}`;
  const serviceResPath = resourcePath(`${packageName}${exeSuffix}`);
  let buildResult: boolean = false;
  await new Promise((resolve, reject) => {
    fs.copyFile(bundleFilePath, serviceResPath, (err) => {
      if (err) {
        console.error(`Failed to copy ${packageName} to ${serviceResPath}`);
        reject(err);
      } else {
        console.log(`${packageName} was copied Done!`);
        buildResult = true;
        resolve(null);
      }
    });
  });

  return buildResult;
}

// buildService().then((result) => {
//   console.log(`Build Clash Verge Service Result: ${result}`);
// });
