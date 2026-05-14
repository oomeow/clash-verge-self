import { execSync, spawn } from "child_process";

async function installRustBinary(
  binaryName: string,
  command: string,
  args: string[],
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    console.log(`Installing ${binaryName}`);

    const child = spawn(command, args);
    child.stdout.on("data", (data) => {
      console.log(data.toString());
    });
    child.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`Installed ${binaryName}`);
        resolve();
      } else {
        console.error(`Failed to install ${binaryName}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    child.on("error", reject);
  });
}

async function cargoInstall(
  binaryName: string,
  installArgs: string[],
  installedBins: string,
) {
  const exists = new RegExp(`^${binaryName} `, "m").test(installedBins);
  if (!exists) {
    await installRustBinary(binaryName, "cargo", ["install", ...installArgs]);
  } else {
    console.log(`${binaryName} has installed`);
  }
}

const isGithubAction = process.env.GITHUB_TOKEN !== undefined;
if (!isGithubAction) {
  const installedBins = execSync("cargo install --list").toString();
  await cargoInstall("prek", ["--locked", "prek"], installedBins);
  await cargoInstall("just", ["just"], installedBins);
  // install prek hook
  execSync("prek install");
  console.log("`prek` and `just` have been installed");
}
