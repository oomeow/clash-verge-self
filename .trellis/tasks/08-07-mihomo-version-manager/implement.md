# Mihomo 版本管理器 — 实施计划

## 顺序清单

### 后端（Rust）

1. `src-tauri/src/utils/dirs.rs`：新增 `pub fn mihomo_download_dir() -> Result<PathBuf>` = `app_home_dir()?.join("mihomo")`。
2. 新增 `src-tauri/src/cmds/mihomo.rs`：
   - 复用 `get_mihomo_versions`（`cmds/mod.rs`）的 index 获取：`fetch_index_cached` + `assets_for_platform(Platform::current(), None)` + `mihomo_versions_file()` 缓存路径。
   - `fn slot_for_channel(channel: &str) -> &str`：`alpha|nightly → "self-mihomo-alpha"`，否则 `"self-mihomo"`。
   - `async fn download_version(client, asset, dest, app) -> Result<()>`：用 `mihomo-version::download_async`，进度 `app.emit("mihomo-download-progress", {tag, downloaded, total})`。
   - `#[tauri::command] pub async fn install_mihomo_version(tag: String, app: AppHandle) -> CommandResult<()>`：解析 tag→asset→下载（缓存复用）→ 停止 core → 备份 `.bak` → 移动替换 → `chmod +x`（unix）→ `change_core(slot)`。
   - `#[tauri::command] pub async fn list_mihomo_downloads() -> CommandResult<Vec<String>>`：扫描 `mihomo_download_dir()` 返回 `mihomo-<tag>` 前缀解析出的 tag 列表。
   - （可选）`#[tauri::command] download_mihomo_version`：仅下载不安装。
3. `src-tauri/src/cmds/mod.rs`：`pub mod mihomo;`。
4. `src-tauri/src/lib.rs` invoke_handler：注册 `cmds::mihomo::install_mihomo_version`、`cmds::mihomo::list_mihomo_downloads`、（可选）`download_mihomo_version`。
5. `src-tauri/Cargo.toml`：确认 `mihomo-version` 已在依赖（已有，无需改）。自定义命令无需新增 capability 权限。

### 前端（React/TS）

6. `src/services/cmds.ts`：新增 `installMihomoVersion(tag)`、`listMihomoDownloads()` 的 `invoke` 封装。
7. `src/services/swr.ts`：新增 `listMihomoDownloads` key 与 `useMihomoDownloadsSWR()`。
8. 新增 `src/components/setting/mods/mihomo-version-manager.tsx`：
   - 复用 `BaseDialog`；用 `useMihomoVersionsSWR`、`useMihomoCoresInfo`、`useMihomoDownloadsSWR`。
   - 频道 Tab（全部/稳定/Alpha/Nightly）分组列表；每行：tag、semver、发布时间（相对）、大小、prerelease 徽章、状态徽章（当前版本/已下载/未下载）。
   - 选中行 → 底部「下载并安装」按钮；下载进度条（监听 `mihomo-download-progress` 事件）。
   - 安装成功/失败用 `useNotice` 提示；安装完成后刷新 core 信息与 downloads。
9. `src/components/setting/mods/clash-core-viewer.tsx`：将「升级」按钮替换为「版本管理」按钮，打开新弹窗；移除第 61 行 `console.log`。
10. `src/locales/*/common.json`（或对应文件）：新增升级/下载/安装/版本管理相关文案。

## 验证命令

- `cargo clippy --all-targets --all-features --tests --benches -- -D warnings`（Rust lint）
- `cargo +nightly fmt`
- `pnpm lint`（前端 lint，max-warnings 0）
- `pnpm web:build`（前端类型检查 + 构建）
- `cargo build -p clash-verge-self-service`（若改动 service 则 `pnpm build:service`）——本期不改 service crate，无需。
- 手动 `pnpm dev` 验证：打开核心弹窗→版本管理→选择一个版本→下载→安装→core 切换并生效。

## 高风险文件 / 回滚点

- `src-tauri/src/cmds/mihomo.rs`（新）：安装时序（停 core→替换→重启）易出错；回滚点：安装前保留 `<slot>.bak`，`change_core` 自带失败回滚。
- `src-tauri/src/core/core.rs`：只读复用 `stop_core`/`change_core`，不改。
- `clash-core-viewer.tsx`：替换升级按钮，涉及现有交互；回滚点：git revert 该文件。

## start 前检查

- `prd.md` 已通过收敛（无阻塞 OQ、无重复事实）。
- `design.md` + `implement.md` 已就绪。
- 本期为 inline 工作流（opencode），`implement.jsonl`/`check.jsonl` 由 `trellis-before-dev` 加载 spec 上下文，无需手工补 jsonl。
