import { intro, outro, spinner } from "@clack/prompts";
import fs from "fs-extra";
import path from "path";
import pc from "picocolors";

import { buildService } from "./build-service";
import {
  SERVICE_CACHE_FILE,
  cratesPath,
  snapshotFilesHashOnDir,
} from "./utils";

async function main() {
  intro(pc.bgCyan(pc.white("Check Build Service")));

  // ensure cache file exists and is valid JSON; fall back to empty object on error
  try {
    fs.ensureFileSync(SERVICE_CACHE_FILE);
  } catch (err) {
    outro(pc.bgRed(pc.white(`failed to ensure cache file: ${String(err)}`)));
    process.exit(1);
  }

  let previous: Record<string, string> = {};
  try {
    // readJsonSync throws on invalid JSON — catch and recover to {}
    previous =
      (fs.readJsonSync(SERVICE_CACHE_FILE) as Record<string, string>) || {};
  } catch {
    previous = {};
  }

  const serviceDir = cratesPath("clash-verge-self-service");
  const snapshot = snapshotFilesHashOnDir(serviceDir);

  const changed = Object.keys(snapshot).some(
    (rel) => previous[rel] !== snapshot[rel],
  );

  if (!changed) {
    outro(pc.bgGreen(pc.white("service not modified, skipping build.")));
    return;
  }

  const spin = spinner();
  spin.start("service modified, building...");

  try {
    await buildService((message) => spin.message(message.trim()));

    spin.message("caching changed files hash");
    try {
      fs.writeJsonSync(SERVICE_CACHE_FILE, snapshot, { spaces: 2 });
    } catch (err) {
      // cache write failure should not hide successful build, but notify user
      spin.stop("service build succeeded (failed to write cache).");
      outro(pc.bgRed(pc.white(`cache write failed: ${String(err)}`)));
      process.exit(1);
    }

    spin.stop("service build succeeded.");
    outro(pc.bgGreen(pc.white("check build service completed.")));
  } catch (err) {
    spin.stop("service build failed.");
    outro(pc.bgRed(pc.white(`check build service failed: ${String(err)}`)));
    process.exit(1);
  }
}

main().catch((err) => {
  outro(pc.bgRed(pc.white(String(err))));
  process.exit(1);
});
