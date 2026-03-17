import { execSync, spawn } from "child_process";
import { consola } from "consola";
import ora from "ora";

async function installRustBinary(binaryName, command, args) {
  return new Promise((resolve, reject) => {
    consola.start(`Installing ${binaryName}...`);
    const spinner = ora({
      text: `Installing ${binaryName}`,
      color: "yellow",
      spinner: "circle",
    });
    spinner.start();

    const child = spawn(command, args);
    child.stdout.on("data", (data) => {
      spinner.text = data.toString().trim();
    });
    child.stderr.on("data", (data) => {
      spinner.text = data.toString().trim();
    });
    child.on("close", (code) => {
      if (code === 0) {
        spinner.succeed();
        resolve();
      } else {
        spinner.fail();
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function cargoInstall(binaryName, installArgs, installedBins) {
  const exists = installedBins.includes(binaryName);
  if (!exists) {
    await installRustBinary(binaryName, "cargo", ["install", ...installArgs]);
  } else {
    consola.success(`${binaryName} has installed`);
  }
}

const isGithubAction = process.env.GITHUB_TOKEN !== undefined;
if (!isGithubAction) {
  const installedBins = execSync(`cargo install --list`).toString();
  await cargoInstall("prek", ["--locked", "prek"], installedBins);
  await cargoInstall("just", ["just"], installedBins);
}
