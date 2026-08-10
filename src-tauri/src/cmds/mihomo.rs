use std::{collections::HashMap, path::Path, sync::LazyLock, time::Duration};

use anyhow::{Context, Result};
use mihomo_versions::{
    CancellationToken, DownloadOptions, HttpClient, IndexCache, MihomoAsset, MihomoIndex, MihomoVersion, Platform,
};
use parking_lot::Mutex;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::{
    cmds::{CommandResult, into_command_result},
    core::CoreManager,
    utils::dirs,
};

const MIHOMO_RELEASE_URL: &str =
    "https://github.com/oomeow/mihomo-versions/releases/download/index/mihomo-releases.json.gz";

/// 下载空闲超过该时长（无数据到达）即视为超时中止（内部会重试）。
const DOWNLOAD_IDLE_TIMEOUT: Duration = Duration::from_secs(30);

/// 版本索引的本地缓存（路径 + 新鲜度），所有命令共享同一份。
///
/// 新鲜度统一取 30 分钟：安装路径希望拿到尽量新的索引，列表展示多 30
/// 分钟的差异无感知，故取两者（原 30min / 1h）中更保守的值。
static INDEX_CACHE: LazyLock<IndexCache> = LazyLock::new(|| IndexCache {
    path: dirs::mihomo_versions_file().expect("mihomo release cache path"),
    max_age: Duration::from_mins(30),
});

/// 进行中的下载任务（按变体基名索引），用于前端取消。
static INFLIGHT_DOWNLOADS: LazyLock<Mutex<HashMap<String, CancellationToken>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

/// 根据版本频道决定安装到哪个 core 槽位。
///
/// alpha / nightly 只有一个永远最新的版本，归入 `self-mihomo-alpha`；
/// 其余（stable）归入 `self-mihomo`。
fn slot_for_channel(channel: &str) -> &'static str {
    match channel {
        "alpha" | "nightly" => "self-mihomo-alpha",
        _ => "self-mihomo",
    }
}

fn resolve_version(index: &MihomoIndex, tag: &str) -> Result<MihomoVersion> {
    mihomo_versions::assets_for_platform(index, Platform::current()?, None)
        .into_iter()
        .find(|v| v.tag == tag || v.semver.as_deref() == Some(tag))
        .context("mihomo version not found")
}

/// 在版本中按资产名（或基名）解析出具体编译变体。
fn resolve_asset<'a>(version: &'a MihomoVersion, asset: &str) -> Result<&'a MihomoAsset> {
    version
        .assets
        .iter()
        .find(|a| a.name == asset || base_name(&a.name) == asset)
        .context("mihomo asset not found")
}

/// 名字去掉压缩扩展名（.tar.gz / .gz / .zip / .zst）。
fn base_name(name: &str) -> &str {
    for ext in [".tar.gz", ".gz", ".zip", ".zst"] {
        if let Some(base) = name.strip_suffix(ext) {
            return base;
        }
    }
    name
}

/// 列出目录中已下载（缓存）的变体基名，跳过 `.part` 相关文件。
fn list_cached_downloads(dir: &Path) -> Vec<String> {
    let mut names = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.ends_with(".part") || name.ends_with(".part.meta") {
                continue;
            }
            names.push(name);
        }
    }
    names
}

/// 删除目录中缓存的编译变体（按资产名或基名，含可能的 `.part` 断点文件）。
fn remove_cached_download(dir: &Path, asset_name: &str) -> Result<()> {
    let base = base_name(asset_name);
    for p in [
        dir.join(base),
        dir.join(format!("{base}.part")),
        dir.join(format!("{base}.part.meta")),
    ] {
        if p.exists() {
            std::fs::remove_file(&p)?;
        }
    }
    Ok(())
}

/// 下载某个编译变体到自定义下载目录（已存在则复用缓存），返回二进制路径。
///
/// 下载可被 `cancel_mihomo_download` 取消；网络空闲超时（30s）会自动中止并重试。
/// 缓存复用逻辑内联于此：先检查 `dir/<base>` 是否存在，不存在再调
/// `mihomo_versions::download`（缓存文件命名由本模块维护，`.part` 断点文件与
/// SHA256 校验约定由该库统一维护）。
async fn ensure_downloaded(app: &AppHandle, client: &HttpClient, asset: &MihomoAsset) -> Result<std::path::PathBuf> {
    let dir = dirs::mihomo_download_dir()?;
    let dest = dir.join(base_name(&asset.name));
    if dest.exists() {
        return Ok(dest); // 缓存复用
    }

    let base = base_name(&asset.name).to_string();
    let token = CancellationToken::new();
    let progress_tag = asset.name.clone();
    INFLIGHT_DOWNLOADS.lock().insert(base.clone(), token.clone());

    let result = mihomo_versions::download(
        client,
        asset,
        &dest,
        DownloadOptions {
            cancel: Some(token.clone()),
            idle_timeout: Some(DOWNLOAD_IDLE_TIMEOUT),
            ..Default::default()
        },
        move |downloaded, total| {
            let _ = app.emit(
                "mihomo-download-progress",
                DownloadProgressEvent {
                    tag: progress_tag.clone(),
                    downloaded,
                    total,
                },
            );
        },
    )
    .await;

    INFLIGHT_DOWNLOADS.lock().remove(&base);
    result.map_err(|err| anyhow::anyhow!("download failed: {err}"))?;

    Ok(dest)
}

/// 校验 core 槽位，避免路径被篡改。
fn validate_slot(slot: &str) -> Result<()> {
    if matches!(slot, "self-mihomo" | "self-mihomo-alpha") {
        Ok(())
    } else {
        anyhow::bail!("invalid core slot \"{slot}\"")
    }
}

/// 安装：停止 core → 备份旧二进制 → 复制新二进制到位 → 切换槽位并重启。
async fn install_binary(slot: &str, downloaded: &Path) -> Result<()> {
    validate_slot(slot)?;
    let exe_ext = std::env::consts::EXE_SUFFIX;
    let target = tauri::utils::platform::current_exe()?.with_file_name(format!("{slot}{exe_ext}"));
    let bak = target.with_extension("bak");

    CoreManager::global().stop_core().await?;

    // 复制（而非移动）以保留下载目录缓存；旧二进制留 .bak 以便回滚。
    let swap = || -> Result<()> {
        if bak.exists() {
            std::fs::remove_file(&bak)?;
        }
        if target.exists() {
            std::fs::rename(&target, &bak)?;
        }
        std::fs::copy(downloaded, &target)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&target, std::fs::Permissions::from_mode(0o755))?;
        }
        // macOS 上对安装的二进制做 ad-hoc 签名（--sign -），否则可能无法运行。
        #[cfg(target_os = "macos")]
        {
            let status = std::process::Command::new("codesign")
                .arg("--sign")
                .arg("-")
                .arg(&target)
                .status()?;
            if !status.success() {
                anyhow::bail!("codesign failed for {}", target.display());
            }
        }
        Ok(())
    };

    if let Err(err) = swap() {
        // 替换失败：恢复旧二进制并尝试拉起 core。
        if target.exists() {
            let _ = std::fs::remove_file(&target);
        }
        if bak.exists() {
            let _ = std::fs::rename(&bak, &target);
        }
        let _ = CoreManager::global().run_core().await;
        return Err(err);
    }

    match CoreManager::global().change_core(Some(slot.to_string())).await {
        Ok(()) => Ok(()),
        Err(err) => {
            // 配置切换失败：core 已停，尝试以新二进制拉起。
            let _ = CoreManager::global().run_core().await;
            Err(err)
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct DownloadProgressEvent {
    tag: String,
    downloaded: u64,
    total: u64,
}

/// 下载并安装指定版本、指定编译变体的 mihomo，安装成功后自动切换到对应槽位。
#[tauri::command]
pub async fn install_mihomo_version(tag: String, asset: String, app: AppHandle) -> CommandResult<()> {
    into_command_result(
        async {
            let index =
                mihomo_versions::fetch_index_cached(&HttpClient::new()?, &[MIHOMO_RELEASE_URL], &INDEX_CACHE).await?;
            let version = resolve_version(&index, &tag)?;
            let asset = resolve_asset(&version, &asset)?;
            let downloaded = ensure_downloaded(&app, &HttpClient::new()?, asset).await?;
            install_binary(slot_for_channel(&version.channel), &downloaded).await?;
            Ok(())
        }
        .await,
    )
}

#[tauri::command]
pub async fn get_mihomo_versions() -> CommandResult<Vec<mihomo_versions::MihomoVersion>> {
    into_command_result(
        async {
            let index =
                mihomo_versions::fetch_index_cached(&HttpClient::new()?, &[MIHOMO_RELEASE_URL], &INDEX_CACHE).await?;
            let mihomo_versionss = mihomo_versions::assets_for_platform(&index, Platform::current()?, None);
            Ok(mihomo_versionss)
        }
        .await,
    )
}

/// 直接安装已下载（缓存）的编译变体，跳过索引获取与下载。
///
/// `slot` 由前端据所选版本的频道决定（self-mihomo / self-mihomo-alpha）。
#[tauri::command]
pub async fn install_mihomo_download(asset: String, slot: String) -> CommandResult<()> {
    into_command_result(
        async {
            validate_slot(&slot)?;
            let dest = dirs::mihomo_download_dir()?.join(base_name(&asset));
            if !dest.exists() {
                anyhow::bail!("download not found: {asset}");
            }
            install_binary(&slot, &dest).await?;
            Ok(())
        }
        .await,
    )
}

/// 取消某个正在进行的下载（按资产名或基名）。
#[tauri::command]
pub async fn cancel_mihomo_download(asset: String) -> CommandResult<()> {
    let base = base_name(&asset);
    if let Some(token) = INFLIGHT_DOWNLOADS.lock().get(base) {
        token.cancel();
    }
    Ok(())
}

/// 删除下载目录中已缓存的某个编译变体（含可能的 .part 断点文件）。
#[tauri::command]
pub async fn delete_mihomo_download(asset: String) -> CommandResult<()> {
    into_command_result((|| {
        let dir = dirs::mihomo_download_dir()?;
        remove_cached_download(&dir, &asset)?;
        Ok(())
    })())
}

/// 列出下载目录中已下载（缓存）的编译变体基名。
#[tauri::command]
pub async fn list_mihomo_downloads() -> CommandResult<Vec<String>> {
    into_command_result((|| {
        let dir = dirs::mihomo_download_dir()?;
        Ok(list_cached_downloads(&dir))
    })())
}

/// 删除版本索引的本地缓存（含 meta sidecar），下次获取将重新下载。
#[tauri::command]
pub async fn delete_mihomo_index_cache() -> CommandResult<()> {
    into_command_result(INDEX_CACHE.clear().await.map_err(|err| anyhow::anyhow!("{err}")))
}
