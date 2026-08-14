import fs from "fs-extra";
import path from "path";
import * as prettier from "prettier";

const cwd = process.cwd();
const process_argvs = process.argv;
if (process_argvs.length !== 3) {
  throw new Error("invalid arguments, please provide a version");
}

// all version file
const changeJsonFile = [
  "package.json",
  "./src-tauri/tauri.conf.json",
  "./src-tauri/tauri.conf-dev.json",
  "./src-tauri/tauri.conf-local.json",
  "./src-tauri/tauri.conf-pr.json",
];
const changeFile = [
  "./src-tauri/Cargo.toml",
  "./archbuild/alpha/PKGBUILD",
  "./archbuild/local_build/PKGBUILD",
  "./archbuild/preview/PKGBUILD",
  "./archbuild/release/PKGBUILD",
  "./archbuild/test/PKGBUILD",
];

const version = process_argvs[2];
const versionExp = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$/;
if (!versionExp.test(version)) {
  throw new Error("invalid version format");
}

for (const file of changeJsonFile) {
  const filePath = path.join(cwd, file);
  const data = fs.readFileSync(filePath, "utf8");
  const jsonData = JSON.parse(data);
  const newData = JSON.stringify(
    jsonData,
    (key, value) => (key === "version" ? version : value),
    2,
  );
  const formattedData = await prettier.format(newData, { parser: "json" });
  fs.writeFileSync(file, formattedData);
}

for (const file of changeFile) {
  const filePath = path.join(cwd, file);
  let data = fs.readFileSync(filePath, "utf8");
  if (data.includes("version = ")) {
    data = data.replace(/version = ".*"/, `version = "${version}"`);
  }
  if (data.includes("pkgver=")) {
    // 正向后行断言 (?<=)
    const aurVersion = version.replace(/-|(?<=-.*?)\./g, "_");
    data = data.replace(/pkgver=.*/, `pkgver=${aurVersion}`);
    data = data.replace(/_pkgver=.*/, `_pkgver=${version}`);
  }
  fs.writeFileSync(file, data);
}
