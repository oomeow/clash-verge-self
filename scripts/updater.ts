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
const GITHUB_PROXY_PREFIX = "https://gh-proxy.org/";

// preview release version info file
const PREVIEW_TAG_NAME = "preview";
const PREVIEW_UPDATE_JSON_FILE = "preview-update.json";
const PREVIEW_UPDATE_JSON_PROXY = "preview-update-proxy.json";

// log file
const CHANGE_LOG = "CHANGELOG.md";
const UPDATE_LOG = "UPDATELOG.md";
const update_log_file = path.join(cwd, UPDATE_LOG);
const change_log_file = path.join(cwd, CHANGE_LOG);

type RepoInfo = {
  owner: string;
  repo: string;
};

type PlatformUpdate = {
  signature: string;
  url: string;
};

const UPDATER_PLATFORMS = [
  // macOS
  "darwin-x86_64",
  "darwin-x86_64-app",
  "darwin-aarch64",
  "darwin-aarch64-app",
  // Linux
  "linux-x86",
  "linux-x86-deb",
  "linux-x86-rpm",
  "linux-x86_64",
  "linux-x86_64-deb",
  "linux-x86_64-rpm",
  "linux-i686",
  "linux-i686-deb",
  "linux-i686-rpm",
  "linux-aarch64",
  "linux-aarch64-deb",
  "linux-aarch64-rpm",
  "linux-armv7",
  "linux-armv7-deb",
  "linux-armv7-rpm",
  // Windows
  "windows-x86",
  "windows-x86-nsis",
  "windows-x86_64",
  "windows-x86_64-nsis",
  "windows-aarch64",
  "windows-aarch64-nsis",
  "windows-i686",
  "windows-i686-nsis",
] as const;

type UpdaterPlatforms = (typeof UPDATER_PLATFORMS)[number];

type UpdateData = {
  name: string;
  notes: string;
  pub_date: string;
  platforms: Partial<Record<UpdaterPlatforms, PlatformUpdate>>;
};

type AssetPlatformRule = {
  suffix: string;
  platforms: readonly UpdaterPlatforms[];
};

const ASSET_PLATFORM_RULES: readonly AssetPlatformRule[] = [
  {
    suffix: "x64-setup.exe",
    platforms: ["windows-x86_64", "windows-x86_64-nsis"],
  },
  {
    suffix: "x64-setup.exe.sig",
    platforms: ["windows-x86_64", "windows-x86_64-nsis"],
  },
  {
    suffix: "x86-setup.exe",
    platforms: [
      "windows-x86",
      "windows-x86-nsis",
      "windows-i686",
      "windows-i686-nsis",
    ],
  },
  {
    suffix: "x86-setup.exe.sig",
    platforms: [
      "windows-x86",
      "windows-x86-nsis",
      "windows-i686",
      "windows-i686-nsis",
    ],
  },
  {
    suffix: "arm64-setup.exe",
    platforms: ["windows-aarch64", "windows-aarch64-nsis"],
  },
  {
    suffix: "arm64-setup.exe.sig",
    platforms: ["windows-aarch64", "windows-aarch64-nsis"],
  },
  {
    suffix: "x64.app.tar.gz",
    platforms: ["darwin-x86_64", "darwin-x86_64-app"],
  },
  {
    suffix: "x64.app.tar.gz.sig",
    platforms: ["darwin-x86_64", "darwin-x86_64-app"],
  },
  {
    suffix: "aarch64.app.tar.gz",
    platforms: ["darwin-aarch64", "darwin-aarch64-app"],
  },
  {
    suffix: "aarch64.app.tar.gz.sig",
    platforms: ["darwin-aarch64", "darwin-aarch64-app"],
  },
  {
    suffix: "i386.deb",
    platforms: ["linux-x86", "linux-x86-deb", "linux-i686", "linux-i686-deb"],
  },
  {
    suffix: "i386.deb.sig",
    platforms: ["linux-x86", "linux-x86-deb", "linux-i686", "linux-i686-deb"],
  },
  {
    suffix: "i386.rpm",
    platforms: ["linux-x86-rpm", "linux-i686-rpm"],
  },
  {
    suffix: "i386.rpm.sig",
    platforms: ["linux-x86-rpm", "linux-i686-rpm"],
  },
  {
    suffix: "amd64.deb",
    platforms: ["linux-x86_64", "linux-x86_64-deb"],
  },
  {
    suffix: "amd64.deb.sig",
    platforms: ["linux-x86_64", "linux-x86_64-deb"],
  },
  {
    suffix: "x86_64.rpm",
    platforms: ["linux-x86_64-rpm"],
  },
  {
    suffix: "x86_64.rpm.sig",
    platforms: ["linux-x86_64-rpm"],
  },
  {
    suffix: "arm64.deb",
    platforms: ["linux-aarch64", "linux-aarch64-deb"],
  },
  {
    suffix: "arm64.deb.sig",
    platforms: ["linux-aarch64", "linux-aarch64-deb"],
  },
  {
    suffix: "aarch64.rpm",
    platforms: ["linux-aarch64-rpm"],
  },
  {
    suffix: "aarch64.rpm.sig",
    platforms: ["linux-aarch64-rpm"],
  },
  {
    suffix: "armhf.deb",
    platforms: ["linux-armv7", "linux-armv7-deb"],
  },
  {
    suffix: "armhf.deb.sig",
    platforms: ["linux-armv7", "linux-armv7-deb"],
  },
  {
    suffix: "armhfp.rpm",
    platforms: ["linux-armv7-rpm"],
  },
  {
    suffix: "armhfp.rpm.sig",
    platforms: ["linux-armv7-rpm"],
  },
];

function getGithubToken(): string {
  const token = process.env.GITHUB_TOKEN;
  if (token === undefined) {
    throw new Error("GITHUB_TOKEN is required");
  }
  return token;
}

function createEmptyPlatforms(): Record<UpdaterPlatforms, PlatformUpdate> {
  return Object.fromEntries(
    UPDATER_PLATFORMS.map((platform) => [
      platform,
      {
        signature: "",
        url: "",
      },
    ]),
  ) as Record<UpdaterPlatforms, PlatformUpdate>;
}

function findAssetPlatformRule(
  assetName: string,
): AssetPlatformRule | undefined {
  return ASSET_PLATFORM_RULES.find((rule) => assetName.endsWith(rule.suffix));
}

async function applyAssetToPlatforms(
  platforms: Partial<Record<UpdaterPlatforms, PlatformUpdate>>,
  assetName: string,
  assetUrl: string,
) {
  const rule = findAssetPlatformRule(assetName);
  if (!rule) {
    return;
  }

  const isSignature = assetName.endsWith(".sig");
  const signature = isSignature ? await getSignature(assetUrl) : undefined;

  for (const platform of rule.platforms) {
    const update = platforms[platform];
    if (!update) {
      continue;
    }

    if (isSignature) {
      update.signature = signature ?? "";
    } else {
      update.url = assetUrl;
    }
  }
}

function removeMissingPlatforms(updateData: UpdateData) {
  for (const platform of UPDATER_PLATFORMS) {
    if (!updateData.platforms[platform]?.url) {
      console.log(`[Error]: failed to parse release for "${platform}"`);
      delete updateData.platforms[platform];
    }
  }
}

function createProxyUpdateData(updateData: UpdateData): UpdateData {
  const platforms = Object.fromEntries(
    Object.entries(updateData.platforms).map(([platform, update]) => [
      platform,
      {
        ...update,
        url: `${GITHUB_PROXY_PREFIX}${update.url}`,
      },
    ]),
  ) as Partial<Record<UpdaterPlatforms, PlatformUpdate>>;

  return {
    ...updateData,
    platforms,
  };
}

export async function getLatestTag(
  repoInfo: RepoInfo,
): Promise<{ name: string }> {
  const token = getGithubToken();
  const github = getOctokit(token);

  const { data: tags } = await github.rest.repos.listTags({
    ...repoInfo,
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

type ReleaseAsset = {
  name: string;
  browser_download_url: string;
};

/// 生成 update JSON 并上传到 updater release
async function publishUpdateJson(
  repoInfo: RepoInfo,
  release: { assets: ReleaseAsset[] },
  updateData: UpdateData,
  jsonFile: string,
  jsonProxyFile: string,
) {
  await applyAssetsToPlatforms(updateData.platforms, release.assets);

  console.log(updateData);

  // maybe should test the signature as well
  // delete the null field
  removeMissingPlatforms(updateData);

  // 生成一个代理github的更新文件
  const updateDataNew = createProxyUpdateData(updateData);

  await uploadUpdaterFiles(
    repoInfo,
    updateData,
    updateDataNew,
    jsonFile,
    jsonProxyFile,
  );
}

/// 生成 update.json 并上传（stable 渠道）
async function publishStableUpdate(repoInfo: RepoInfo) {
  const tag = await getLatestTag(repoInfo);
  const github = getOctokit(getGithubToken());
  const { data: release } = await github.rest.repos.getReleaseByTag({
    ...repoInfo,
    tag: tag.name,
  });

  const updateData: UpdateData = {
    name: tag.name,
    notes: await readUpdateLog(tag.name), // use updatelog.md
    pub_date: new Date().toISOString(),
    platforms: createEmptyPlatforms(),
  };

  await publishUpdateJson(
    repoInfo,
    release,
    updateData,
    UPDATE_JSON_FILE,
    UPDATE_JSON_PROXY,
  );
}

/// 生成 preview-update.json 并上传（preview 渠道）
async function publishPreviewUpdate(repoInfo: RepoInfo) {
  const github = getOctokit(getGithubToken());
  const { data: release } = await github.rest.repos.getReleaseByTag({
    ...repoInfo,
    tag: PREVIEW_TAG_NAME,
  });

  const updateData: UpdateData = {
    name: getPreviewVersion(release.assets),
    notes: await readChangelog(), // use changelog.md
    pub_date: new Date().toISOString(),
    platforms: createEmptyPlatforms(),
  };

  await publishUpdateJson(
    repoInfo,
    release,
    updateData,
    PREVIEW_UPDATE_JSON_FILE,
    PREVIEW_UPDATE_JSON_PROXY,
  );
}

async function applyAssetsToPlatforms(
  platforms: Partial<Record<UpdaterPlatforms, PlatformUpdate>>,
  assets: ReleaseAsset[],
) {
  const results = await Promise.allSettled(
    assets.map((asset) =>
      applyAssetToPlatforms(platforms, asset.name, asset.browser_download_url),
    ),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(result.reason);
    }
  }
}

async function uploadUpdaterFiles(
  repoInfo: RepoInfo,
  updateData: UpdateData,
  updateDataNew: UpdateData,
  jsonFile: string,
  jsonProxyFile: string,
) {
  const github = getOctokit(getGithubToken());

  // update the update.json
  const { data: updateRelease } = await github.rest.repos.getReleaseByTag({
    ...repoInfo,
    tag: UPDATE_TAG_NAME,
  });

  // delete the old assets
  for (const asset of updateRelease.assets) {
    if (asset.name === jsonFile) {
      await github.rest.repos.deleteReleaseAsset({
        ...repoInfo,
        asset_id: asset.id,
      });
    }

    if (asset.name === jsonProxyFile) {
      await github.rest.repos
        .deleteReleaseAsset({ ...repoInfo, asset_id: asset.id })
        .catch(console.error); // do not break the pipeline
    }
  }

  // upload new assets
  await github.rest.repos.uploadReleaseAsset({
    ...repoInfo,
    release_id: updateRelease.id,
    name: jsonFile,
    data: JSON.stringify(updateData, null, 2),
  });

  await github.rest.repos.uploadReleaseAsset({
    ...repoInfo,
    release_id: updateRelease.id,
    name: jsonProxyFile,
    data: JSON.stringify(updateDataNew, null, 2),
  });
}

/// extract the preview version (e.g. 2.3.2-preview.2608161200, 2 位年份 + 构建时间作为 preview 序号) from the release asset names
function getPreviewVersion(assets: ReleaseAsset[]): string {
  const re = /(\d+\.\d+\.\d+-preview\.\d+)/;
  for (const asset of assets) {
    const match = asset.name.match(re);
    if (match) {
      return match[1];
    }
  }
  throw new Error("could not find preview version in release assets");
}

// get the signature file content
async function getSignature(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/octet-stream" },
  });

  return response.text();
}

/// read the CHANGELOG.md content (strip the leading comment block)
export async function readChangelog(): Promise<string> {
  if (!(await fs.pathExists(change_log_file))) {
    throw new Error("could not found CHANGELOG.md");
  }

  const data = await fs
    .readFile(change_log_file)
    .then((d) => d.toString("utf8"));

  // 去掉开头的 html 注释块（模板占位）
  const stripped = data.replace(/^<!--[\s\S]*?-->\s*/, "");

  return stripped.trim();
}

// parse the UPDATELOG.md
export async function readUpdateLog(tag: string): Promise<string> {
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

export async function updateUpdateLog(repoInfo: RepoInfo) {
  const tag = await getLatestTag(repoInfo);
  const tagTitle = `## ${tag.name}`;
  // write all change log content to update log file
  const changeLogContent = await readChangelog();
  const updateLogContent = await fs
    .readFile(update_log_file)
    .then((d) => d.toString("utf8"));
  const regexp = /## (v.*)/g;
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

const repoInfo: RepoInfo = {
  owner: context.repo.owner,
  repo: context.repo.repo,
};
if (arg === "--changelog") {
  updateUpdateLog(repoInfo).catch(console.error);
} else if (arg === "--preview") {
  publishPreviewUpdate(repoInfo).catch(console.error);
} else {
  publishStableUpdate(repoInfo).catch(console.error);
}
