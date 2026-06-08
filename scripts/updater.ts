import { context, getOctokit } from "@actions/github";
import fs from "fs-extra";
import fetch from "node-fetch";
import path from "path";

const cwd = process.cwd();
const arg = process.argv.slice(2)[0];

// release version info file
const UPDATE_TAG_NAME = "updater";
const UPDATE_JSON_FILE = "update.json";
const UPDATE_JSON_PROXY = "update-proxy.json";

// log file
const CHANGE_LOG = "CHANGELOG.md";
const UPDATE_LOG = "UPDATELOG.md";
const update_log_file = path.join(cwd, UPDATE_LOG);
const change_log_file = path.join(cwd, CHANGE_LOG);

type PlatformUpdate = {
  signature: string;
  url: string;
};

type UpdaterPlatforms =
  // macOS
  | "darwin-x86_64"
  | "darwin-x86_64-app"
  | "darwin-aarch64"
  | "darwin-aarch64-app"
  // Linux
  | "linux-x86"
  | "linux-x86-deb"
  | "linux-x86-rpm"
  | "linux-x86_64"
  | "linux-x86_64-deb"
  | "linux-x86_64-rpm"
  | "linux-i686"
  | "linux-i686-deb"
  | "linux-i686-rpm"
  | "linux-aarch64"
  | "linux-aarch64-deb"
  | "linux-aarch64-rpm"
  | "linux-armv7"
  | "linux-armv7-deb"
  | "linux-armv7-rpm"
  // Windows
  | "windows-x86"
  | "windows-x86-nsis"
  | "windows-x86_64"
  | "windows-x86_64-nsis"
  | "windows-aarch64"
  | "windows-aarch64-nsis"
  | "windows-i686"
  | "windows-i686-nsis";

type UpdateData = {
  name: string;
  notes: string;
  pub_date: string;
  platforms: Record<UpdaterPlatforms, PlatformUpdate>;
};

function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (token === undefined) {
    throw new Error("GITHUB_TOKEN is required");
  }
  return token;
}

export async function getLatestTag(): Promise<{ name: string }> {
  const token = getGithubToken();
  const options = { owner: context.repo.owner, repo: context.repo.repo };
  const github = getOctokit(token);

  const { data: tags } = await github.rest.repos.listTags({
    ...options,
    per_page: 10,
    page: 1,
  });

  // get the latest publish tag
  const tag = tags.find((t) => t.name.startsWith("v"));
  if (!tag) {
    throw new Error("could not find latest version tag");
  }

  console.log(tag);
  console.log();

  return tag;
}

/// generate update.json
/// upload to update tag's release asset
async function resolveUpdater() {
  const tag = await getLatestTag();
  const token = getGithubToken();
  const options = { owner: context.repo.owner, repo: context.repo.repo };
  const github = getOctokit(token);
  const { data: latestRelease } = await github.rest.repos.getReleaseByTag({
    ...options,
    tag: tag.name,
  });

  const updateData: UpdateData = {
    name: tag.name,
    notes: await resolveUpdateLog(tag.name), // use updatelog.md
    pub_date: new Date().toISOString(),
    platforms: {
      "darwin-x86_64": { signature: "", url: "" },
      "darwin-x86_64-app": { signature: "", url: "" },
      "darwin-aarch64": { signature: "", url: "" },
      "darwin-aarch64-app": { signature: "", url: "" },

      "linux-x86": { signature: "", url: "" },
      "linux-x86-deb": { signature: "", url: "" },
      "linux-x86-rpm": { signature: "", url: "" },
      "linux-x86_64": { signature: "", url: "" },
      "linux-x86_64-deb": { signature: "", url: "" },
      "linux-x86_64-rpm": { signature: "", url: "" },
      "linux-i686": { signature: "", url: "" },
      "linux-i686-deb": { signature: "", url: "" },
      "linux-i686-rpm": { signature: "", url: "" },
      "linux-aarch64": { signature: "", url: "" },
      "linux-aarch64-deb": { signature: "", url: "" },
      "linux-aarch64-rpm": { signature: "", url: "" },
      "linux-armv7": { signature: "", url: "" },
      "linux-armv7-deb": { signature: "", url: "" },
      "linux-armv7-rpm": { signature: "", url: "" },

      "windows-x86": { signature: "", url: "" },
      "windows-x86-nsis": { signature: "", url: "" },
      "windows-x86_64": { signature: "", url: "" },
      "windows-x86_64-nsis": { signature: "", url: "" },
      "windows-aarch64": { signature: "", url: "" },
      "windows-aarch64-nsis": { signature: "", url: "" },
      "windows-i686": { signature: "", url: "" },
      "windows-i686-nsis": { signature: "", url: "" },
    },
  };

  const promises = latestRelease.assets.map(async (asset) => {
    const { name, browser_download_url } = asset;

    // win64 url
    if (name.endsWith("x64-setup.exe")) {
      updateData.platforms["windows-x86_64"].url = browser_download_url;
      updateData.platforms["windows-x86_64-nsis"].url = browser_download_url;
    }
    // win64 signature
    if (name.endsWith("x64-setup.exe.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["windows-x86_64"].signature = sig;
      updateData.platforms["windows-x86_64-nsis"].signature = sig;
    }
    // win32 url
    if (name.endsWith("x86-setup.exe")) {
      updateData.platforms["windows-x86"].url = browser_download_url;
      updateData.platforms["windows-x86-nsis"].url = browser_download_url;
      updateData.platforms["windows-i686-nsis"].url = browser_download_url;
    }
    // win32 signature
    if (name.endsWith("x86-setup.exe.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["windows-x86"].signature = sig;
      updateData.platforms["windows-x86-nsis"].signature = sig;
      updateData.platforms["windows-i686-nsis"].signature = sig;
    }
    // win arm url
    if (name.endsWith("arm64-setup.exe")) {
      updateData.platforms["windows-aarch64"].url = browser_download_url;
      updateData.platforms["windows-aarch64-nsis"].url = browser_download_url;
    }
    // win arm signature
    if (name.endsWith("arm64-setup.exe.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["windows-aarch64"].signature = sig;
      updateData.platforms["windows-aarch64-nsis"].signature = sig;
    }

    // darwin url (intel)
    if (name.endsWith(".app.tar.gz") && !name.includes("aarch")) {
      updateData.platforms["darwin-x86_64"].url = browser_download_url;
      updateData.platforms["darwin-x86_64-app"].url = browser_download_url;
    }
    // darwin signature (intel)
    if (name.endsWith(".app.tar.gz.sig") && !name.includes("aarch")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["darwin-x86_64"].signature = sig;
      updateData.platforms["darwin-x86_64-app"].signature = sig;
    }
    // darwin url (aarch)
    if (name.endsWith("aarch64.app.tar.gz")) {
      updateData.platforms["darwin-aarch64"].url = browser_download_url;
      updateData.platforms["darwin-aarch64-app"].url = browser_download_url;
    }
    // darwin signature (aarch)
    if (name.endsWith("aarch64.app.tar.gz.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["darwin-aarch64"].signature = sig;
      updateData.platforms["darwin-aarch64-app"].signature = sig;
    }

    // Linux x86
    if (name.endsWith("i386.deb")) {
      updateData.platforms["linux-x86"].url = browser_download_url;
      updateData.platforms["linux-x86-deb"].url = browser_download_url;
      updateData.platforms["linux-i686"].url = browser_download_url;
      updateData.platforms["linux-i686-deb"].url = browser_download_url;
    }
    if (name.endsWith("i386.deb.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-x86"].signature = sig;
      updateData.platforms["linux-x86-deb"].signature = sig;
      updateData.platforms["linux-i686"].signature = sig;
      updateData.platforms["linux-i686-deb"].signature = browser_download_url;
    }
    if (name.endsWith("i386.rpm")) {
      updateData.platforms["linux-x86-rpm"].url = browser_download_url;
      updateData.platforms["linux-i686-rpm"].url = browser_download_url;
    }
    if (name.endsWith("i386.rpm.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-x86-rpm"].signature = sig;
      updateData.platforms["linux-i686-rpm"].signature = sig;
    }

    // Linux x86_64
    if (name.endsWith("amd64.deb")) {
      updateData.platforms["linux-x86_64"].url = browser_download_url;
      updateData.platforms["linux-x86_64-deb"].url = browser_download_url;
    }
    if (name.endsWith("amd64.deb.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-x86_64"].signature = sig;
      updateData.platforms["linux-x86_64-deb"].signature = sig;
    }
    if (name.endsWith("x86_64.rpm")) {
      updateData.platforms["linux-x86_64-rpm"].url = browser_download_url;
    }
    if (name.endsWith("x86_64.rpm.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-x86_64-rpm"].signature = sig;
    }

    // Linux aarch64
    if (name.endsWith("arm64.deb")) {
      updateData.platforms["linux-aarch64"].url = browser_download_url;
      updateData.platforms["linux-aarch64-deb"].url = browser_download_url;
    }
    if (name.endsWith("arm64.deb.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-aarch64"].signature = sig;
      updateData.platforms["linux-aarch64-deb"].signature = sig;
    }
    if (name.endsWith("aarch64.rpm")) {
      updateData.platforms["linux-aarch64-rpm"].url = browser_download_url;
    }
    if (name.endsWith("aarch64.rpm.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-aarch64-rpm"].signature = sig;
    }

    // Linux armv7
    if (name.endsWith("armhf.deb")) {
      updateData.platforms["linux-armv7"].url = browser_download_url;
      updateData.platforms["linux-armv7-deb"].url = browser_download_url;
    }
    if (name.endsWith("armhf.deb.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-armv7"].signature = sig;
      updateData.platforms["linux-armv7-deb"].signature = sig;
    }
    if (name.endsWith("armhfp.rpm")) {
      updateData.platforms["linux-armv7-rpm"].url = browser_download_url;
    }
    if (name.endsWith("armhfp.rpm.sig")) {
      const sig = await getSignature(browser_download_url);
      updateData.platforms["linux-armv7-rpm"].signature = sig;
    }
  });

  await Promise.allSettled(promises);
  console.log(updateData);

  // maybe should test the signature as well
  // delete the null field
  (
    Object.entries(updateData.platforms) as [UpdaterPlatforms, PlatformUpdate][]
  ).forEach(([key, value]) => {
    if (!value.url) {
      console.log(`[Error]: failed to parse release for "${key}"`);
      delete updateData.platforms[key];
    }
  });

  // 生成一个代理github的更新文件
  // 使用 https://hub.fastgit.xyz/ 做github资源的加速
  const updateDataNew = JSON.parse(JSON.stringify(updateData)) as UpdateData;

  (
    Object.entries(updateDataNew.platforms) as [
      UpdaterPlatforms,
      PlatformUpdate,
    ][]
  ).forEach(([key, value]) => {
    if (value.url) {
      updateDataNew.platforms[key].url =
        "https://ghproxy.fangkuai.fun/" + value.url;
    } else {
      console.log(`[Error]: updateDataNew.platforms.${key} is null`);
    }
  });

  // update the update.json
  const { data: updateRelease } = await github.rest.repos.getReleaseByTag({
    ...options,
    tag: UPDATE_TAG_NAME,
  });

  // delete the old assets
  for (const asset of updateRelease.assets) {
    if (asset.name === UPDATE_JSON_FILE) {
      await github.rest.repos.deleteReleaseAsset({
        ...options,
        asset_id: asset.id,
      });
    }

    if (asset.name === UPDATE_JSON_PROXY) {
      await github.rest.repos
        .deleteReleaseAsset({ ...options, asset_id: asset.id })
        .catch(console.error); // do not break the pipeline
    }
  }

  // upload new assets
  await github.rest.repos.uploadReleaseAsset({
    ...options,
    release_id: updateRelease.id,
    name: UPDATE_JSON_FILE,
    data: JSON.stringify(updateData, null, 2),
  });

  await github.rest.repos.uploadReleaseAsset({
    ...options,
    release_id: updateRelease.id,
    name: UPDATE_JSON_PROXY,
    data: JSON.stringify(updateDataNew, null, 2),
  });
}

// get the signature file content
async function getSignature(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/octet-stream" },
  });

  return response.text();
}

// parse the UPDATELOG.md
export async function resolveUpdateLog(tag: string): Promise<string> {
  const reTitle = /^## v[\d.]+/;
  const reEnd = /^---/;

  if (!(await fs.pathExists(update_log_file))) {
    throw new Error("could not found UPDATELOG.md");
  }

  const data = await fs
    .readFile(update_log_file)
    .then((d) => d.toString("utf8"));

  const map: Record<string, string[]> = {};
  let p = "";

  data.split("\n").forEach((line) => {
    if (reTitle.test(line)) {
      p = line.slice(3).trim();
      if (!map[p]) {
        map[p] = [];
      } else {
        throw new Error(`Tag ${p} dup`);
      }
    } else if (reEnd.test(line)) {
      p = "";
    } else if (p) {
      map[p].push(line);
    }
  });

  if (!map[tag]) {
    throw new Error(`could not found "${tag}" in UPDATELOG.md`);
  }

  return map[tag].join("\n").trim();
}

export async function updateUpdateLog() {
  const tag = await getLatestTag();
  const tagTitle = `## ${tag.name}`;
  // write all change log content to update log file
  const changeLogContent = await fs
    .readFile(change_log_file)
    .then((d) => d.toString("utf8"));
  const updateLogContent = await fs
    .readFile(update_log_file)
    .then((d) => d.toString("utf8"));
  const regexp = new RegExp("## (v.*)", "g");
  const allVersions = [...updateLogContent.matchAll(regexp)].map((match) =>
    match[1].trim(),
  );
  console.log(allVersions);
  if (!allVersions.includes(tag.name)) {
    const prependContent = `${tagTitle}\n\n${changeLogContent}\n---\n\n`;
    const finaleUpdateLogContent = prependContent.concat(updateLogContent);
    await fs.writeFile(update_log_file, finaleUpdateLogContent);
    // generate default change log file
    const defaultChangeLog = `<!--
### 🚨 Breaking Changes

### ✨ Features

### 🐛 Bug Fixes

-->`;
    await fs.writeFile(change_log_file, defaultChangeLog);
  } else {
    throw new Error(`${tag.name} already exists in UPDATELOG.md`);
  }
}

if (arg === "--changelog") {
  updateUpdateLog().catch(console.error);
} else {
  resolveUpdater().catch(console.error);
}
