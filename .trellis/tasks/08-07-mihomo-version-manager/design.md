# Mihomo 版本管理器 — 技术设计

## 架构与边界

三层改动，均在现有路径内扩展，不引入新依赖：

- **后端下载/安装**：新增 Tauri 命令，复用 `mihomo-version` crate 已提供的下载机制。
- **目录**：新增 `dirs::mihomo_download_dir()`，保存已下载的 core 二进制。
- **前端**：新增版本管理器弹窗，替代 `clash-core-viewer.tsx` 中的单一「升级」按钮。

```
┌─ 前端版本管理器 (React) ─┐
│  useMihomoVersionsSWR    │
│  useMihomoCoresInfo      │  ← 各槽位已安装版本（当前/已装）
│  useMihomoDownloads      │  ← 下载目录里已缓存哪些 tag
└───────────┬──────────────┘
            │ invoke
┌───────────▼──────────────┐
│ src-tauri 命令            │
│  install_mihomo_version  │
│  list_mihomo_downloads   │
│  (download_mihomo_version)│
└───────────┬──────────────┘
            │ 进度事件 emit "mihomo-download-progress"
┌───────────▼──────────────┐
│ mihomo-version crate      │
│  fetch_index_cached       │
│  assets_for_platform      │  → 当前平台唯一 asset(url/sha256/format)
│  download_async           │  → 断点续传+SHA256+解压
└───────────┬──────────────┘
            │
┌───────────▼──────────────┐
│ CoreManager              │
│  stop_core() → 替换 →     │
│  change_core(slot)        │  (停旧起新, 写 clash_core)
└──────────────────────────┘
```

## 槽位映射（已确认）

- 版本 `channel == "alpha" | "nightly"` → 槽位 `self-mihomo-alpha`
- 版本 `channel == "stable"` → 槽位 `self-mihomo`
- 安装成功 → `change_core(slot)` 自动切换激活核心（已确认）

## 下载目录

`dirs::mihomo_download_dir() -> Ok(app_home_dir()?.join("mihomo"))`

- 每个版本解压后的二进制：`<download_dir>/<asset-base-name>`（`asset.name` 去掉 `.gz/.zip/.tar.gz/.zst`）。同一版本不同编译变体各占一个文件，互不冲突。
- 下载用 `mihomo-version::download_async(client, asset, dest=download_dir/<base>, options, progress)`：`dest` 是最终二进制路径，函数内部完成 gz/zip/tar.gz/zst 解压与 SHA256 校验，并生成 `.part` 断点续传文件。
- `list_mihomo_downloads()` 扫描该目录下已下载的变体基名（跳过 `.part` 相关文件），供 UI 标记「已下载」。

## 后端命令

### `install_mihomo_version(tag: String, asset: String, app: AppHandle) -> CommandResult<()>`

时序（复用 `get_mihomo_versions` 的 index 获取方式）：

1. `fetch_index_cached` 取索引，`assets_for_platform(index, Platform::current(), None)` 得当前平台版本列表。
2. 按 `tag` 匹配版本；`version.channel` 决定槽位（见上映射）。
3. 按 `asset`（资产名或基名）在版本内解析出具体编译变体 `MihomoAsset`。
4. 若 `<download_dir>/<base>` 不存在 → `download_async` 下载，进度通过 `app.emit("mihomo-download-progress", {tag: asset.name, downloaded, total})` 上报；已存在则跳过（缓存复用）。
5. 安装：
   - `CoreManager::global().stop_core().await`
   - 目标 `current_exe()?.with_file_name(slot)`；若已存在旧二进制，`rename` 为 `slot.bak`（先删旧 bak）。
   - 将 `<download_dir>/<base>` `copy` 到目标路径（保留下载缓存）。
   - `#[cfg(unix)]` 设置可执行位（`chmod +x`），补齐 macOS/Linux 权限语义。
   - `CoreManager::global().change_core(Some(slot)).await`（内部 run_core：停旧起新、写 clash_core、失败回滚）。
6. 任一步失败返回 Err；安装前已 stop 的 core 由 `change_core` 内的 run_core 重启。

### `list_mihomo_downloads() -> CommandResult<Vec<String>>`

扫描 `mihomo_download_dir()`，返回已下载的编译变体基名（跳过 `.part` 相关文件）。

### `download_mihomo_version(tag, app) -> CommandResult<()>`（可选，单独预下载）

与 install 的 1-4 步一致，仅下载不安装。若本期不做单独预下载，可省略；UI 走「下载并安装」单命令。

## 数据流 / 契约

- 前端传入 `tag`，后端重新解析索引与 asset（不信任前端 url），槽位由后端据 `channel` 决定。
- 进度事件：`app.emit("mihomo-download-progress", { tag, downloaded, total })`，前端监听更新进度条。
- 版本与「当前已安装」的匹配：前端用 `mihomoCoresInfo`（每槽位的已装版本字符串）与列表 tag 做宽松匹配（tag 或 semver 前缀），best-effort。

## 兼容性与迁移

- 旧 `upgrade_core`（插件 API）保留不动，仅本特性的下载路径改用后端实现；不修改 `tauri-plugin-mihomo`。
- 现有 `dirs.rs` 路径函数不变，仅新增 `mihomo_download_dir`。
- 注册新命令到 `src-tauri/src/lib.rs` 的 invoke_handler，并在 `src-tauri/capabilities/` 允许所需权限（app:default 即可，命令为自定义 command）。

## 权衡

- 后端重新解析索引（而非信任前端 asset）：多一次缓存命中开销（≤1h 缓存），换来槽位/asset 的权威性与安全校验。
- 用 `mihomo-version::download_async` 而非插件 API：满足用户"不走插件 API"约束，且直接获得断点续传/SHA256/多格式解压。
- 备份为 `.bak` 而非删除：支持失败回滚与手动恢复。

## 回滚

- 安装前旧二进制保留为 `<slot>.bak`，安装失败时可手动恢复。
- `change_core` 自带失败回滚（discard 配置、不切槽位）。
