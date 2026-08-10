# Mihomo 版本管理器：选择版本下载安装

## Goal

让用户从 `get_mihomo_versions` 返回的版本列表中选择一个 mihomo 版本下载并安装到本地，替换对应槽位的 core 二进制，安装成功后自动切换激活并生效。替代当前 Clash 核心弹窗里单一的「升级到最新」按钮。

## Background / 已确认事实

- `get_mihomo_versions`（`src-tauri/src/cmds/mod.rs:46`）返回按当前平台过滤后的 `MihomoVersion[]`，每项含 `assets: MihomoAsset[]`（`url`/`sha256`/`size`/`format`），数据源为 `mihomo-version` crate 的 `fetch_index_cached` + `assets_for_platform`。
- `mihomo-version` crate（src-tauri 已依赖）已提供现成的 `download`/`download_async`：断点续传、SHA256 校验、gz/zip/tar.gz/zst 解压、进度回调。
- core 二进制位于 `current_exe().with_file_name(clash_bin)`，`clash_bin = "self-mihomo" | "self-mihomo-alpha"`（`src-tauri/src/core/service/message.rs:48-50`）。
- 有两个 core 槽位：`self-mihomo`（稳定版）、`self-mihomo-alpha`（alpha/nightly）（`src-tauri/src/core/core.rs:30`）。
- `CoreManager::global().stop_core()` / `.run_core()` 负责启停 core（覆盖 sidecar 与服务两种模式）；`change_core()`（`src-tauri/src/core/core.rs:161`）会设 clash_core、run_core（停旧起新）、失败回滚。
- 频道：`stable` / `alpha` / `nightly`。alpha 频道只有一个版本且永远最新，无升降级概念。
- 同一平台下每个版本可能包含多个**编译变体**资产（由 `asset.name` 区分）：不同 Go 版本（`go120`–`go125`）、x86_64 微架构（`v1/v2/v3`）、`compatible`、`softfloat` 等。`get_mihomo_versions` 的 `assets_for_platform(Platform::current())` 已返回当前平台**全部**变体。

## Requirements

- R1 版本管理器界面：列出可用 mihomo 版本，按频道分组/Tab，标记当前已安装版本，允许选择版本并下载安装。
- R1a 每个版本展示其**编译变体**（assets）供选择；安装需指定具体变体。
- R2 下载与安装走 Rust 后端新实现，**不得**使用 `tauri-plugin-mihomo` 的 `upgrade_core` API。
- R3 已下载二进制保存到自定义下载目录（新增 `dirs::mihomo_download_dir()`），按**变体基名**命名以区分同版本不同变体，缓存可复用，UI 可标记「已下载」。
- R4 安装流程：停止 core → 重命名/替换旧二进制 → 重启 core 生效。
- R5 槽位映射（已确认）：`alpha`/`nightly` 版本 → `self-mihomo-alpha`；`stable` 版本 → `self-mihomo`。
- R6 安装成功后自动切换到被安装的槽位（`change_core`），下载完即用（已确认）。
- R7 alpha 频道只有一个版本且永远最新，无升降级规则；安装 alpha 即安装该唯一版本。

## Acceptance Criteria

- [ ] AC1 版本管理器弹窗展示版本列表（按频道 Tab 分组），当前已安装版本高亮并标注。
- [ ] AC2 选择版本后展示其编译变体列表，可切换选择具体变体。
- [ ] AC3 选择版本+变体触发下载，显示进度；产物按变体基名落在自定义下载目录，不依赖插件 API。
- [ ] AC4 安装时 core 停止、旧二进制以 `.bak` 重命名替换、安装完成后 core 重启并自动切换到该槽位。
- [ ] AC5 alpha/nightly 版本安装到 `self-mihomo-alpha`，stable 版本安装到 `self-mihomo`。
- [ ] AC6 alpha 版本遵循「唯一版本、永远最新」语义，不提供升降级选项。
- [ ] AC7 已下载变体（缓存）在 UI 标记为「已下载」，重复安装复用缓存。

## Out of Scope

- 不修改 `tauri-plugin-mihomo` 的 `upgrade_core` 实现（保留但不再作为本特性下载路径）。
- 不实现 mihomo UI / geo 数据的版本选择（仅 core 二进制）。
- 不改动 `clash-verge-self-service` crate。

## Open Questions

无。
