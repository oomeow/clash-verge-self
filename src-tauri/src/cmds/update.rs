use std::sync::OnceLock;

use serde::Serialize;
use tauri::{Manager, ResourceId, Runtime, Webview, ipc::Channel};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::watch;
use url::Url;

use crate::{
    cmds::{CommandResult, into_command_result},
    config::{Config, IVerge},
};

const CHANNEL_STABLE: &str = "stable";
const CHANNEL_PREVIEW: &str = "preview";

/// 根据构建时内置的 updater endpoints 推导默认更新渠道
fn default_channel(endpoints: &[String]) -> &str {
    if endpoints.iter().any(|endpoint| endpoint.contains("preview-update")) {
        CHANNEL_PREVIEW
    } else {
        CHANNEL_STABLE
    }
}

/// 当前生效的更新渠道（用户设置优先，未设置时使用构建默认渠道）
fn effective_channel<'a>(verge: &'a IVerge, endpoints: &'a [String]) -> &'a str {
    verge
        .update_channel
        .as_deref()
        .filter(|channel| *channel == CHANNEL_STABLE || *channel == CHANNEL_PREVIEW)
        .unwrap_or_else(|| default_channel(endpoints))
}

/// 根据渠道替换 updater endpoints 的文件名
/// 先归一化为基础文件名再替换，保证对任意构建渠道都幂等
fn channel_endpoints(endpoints: &[String], channel: &str) -> Vec<Url> {
    endpoints
        .iter()
        .map(|endpoint| {
            let base = endpoint
                .replace("preview-update-proxy.json", "update-proxy.json")
                .replace("preview-update.json", "update.json");
            if channel == CHANNEL_PREVIEW {
                base.replace("update-proxy.json", "preview-update-proxy.json")
                    .replace("update.json", "preview-update.json")
            } else {
                base
            }
        })
        .filter_map(|endpoint| Url::parse(&endpoint).ok())
        .collect()
}

/// 读取 tauri.conf.json 中配置的 updater endpoints
fn endpoints_from_config(config: &tauri::Config) -> Vec<String> {
    config
        .plugins
        .0
        .get("updater")
        .and_then(|config| config.get("endpoints"))
        .and_then(|endpoints| endpoints.as_array())
        .map(|endpoints| {
            endpoints
                .iter()
                .filter_map(|endpoint| endpoint.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default()
}

fn baked_endpoints(webview: &Webview<impl Runtime>) -> Vec<String> {
    endpoints_from_config(webview.config())
}

fn format_date(date: Option<time::OffsetDateTime>) -> Option<String> {
    date.and_then(|date| {
        chrono::DateTime::from_timestamp(date.unix_timestamp(), date.nanosecond()).map(|date| date.to_rfc3339())
    })
}

/// 与前端 `Update` 对象结构一致的元数据（camelCase）
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateMetadata {
    rid: tauri::ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

/// 获取默认更新渠道（构建渠道，stable 或 preview）
#[tauri::command]
pub fn get_default_update_channel(app_handle: tauri::AppHandle) -> CommandResult<String> {
    let endpoints = endpoints_from_config(app_handle.config());
    Ok(default_channel(&endpoints).to_string())
}

/// 更新下载进度事件（payload 与前端消费的 `{ event, data }` 结构对齐）
#[derive(Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub(crate) enum UpdateDownloadEvent {
    #[serde(rename_all = "camelCase")]
    Started {
        content_length: Option<u64>,
    },
    #[serde(rename_all = "camelCase")]
    Progress {
        chunk_length: usize,
    },
    Finished,
}

/// 全局取消信号：同一时刻只会有一次更新下载，用全局 watch channel 即可。
/// 下载开始前会先复位为 false，避免上一次取消的残留值导致本次立即取消。
fn cancel_sender() -> &'static watch::Sender<bool> {
    static CANCEL: OnceLock<watch::Sender<bool>> = OnceLock::new();
    CANCEL.get_or_init(|| {
        let (tx, _rx) = watch::channel(false);
        tx
    })
}

/// 更新下载结果：下载并安装由插件完成，完成后由用户手动重启应用来生效
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
pub(crate) enum UpdateDownloadResult {
    Done,
    Cancelled,
    Failed { message: String },
}

/// 下载并安装更新；下载中可被 [`cancel_update_download`] 取消。
/// 取消时 select! 会 drop 掉 download 的 future，进而中止底层 reqwest 请求。
/// 安装完成后返回 Done，由用户手动重启（`relaunch`）来应用更新。
#[tauri::command]
pub(crate) async fn download_update<R: Runtime>(
    webview: Webview<R>,
    rid: ResourceId,
    on_event: Channel<UpdateDownloadEvent>,
) -> CommandResult<UpdateDownloadResult> {
    let update = webview
        .resources_table()
        .get::<Update>(rid)
        .map_err(|err| err.to_string())?;

    // 复位取消信号后再订阅，保证 changed() 只在本次下载真正被取消时触发
    let _ = cancel_sender().send(false);
    let mut cancel_rx = cancel_sender().subscribe();

    let mut first_chunk = true;
    let result = tokio::select! {
        res = update.download_and_install(
            |chunk_length, content_length| {
                if first_chunk {
                    first_chunk = false;
                    let _ = on_event.send(UpdateDownloadEvent::Started { content_length });
                }
                let _ = on_event.send(UpdateDownloadEvent::Progress { chunk_length });
            },
            || {
                let _ = on_event.send(UpdateDownloadEvent::Finished);
            },
        ) => match res {
            Ok(()) => UpdateDownloadResult::Done,
            Err(err) => UpdateDownloadResult::Failed {
                message: err.to_string(),
            },
        },
        _ = cancel_rx.changed() => UpdateDownloadResult::Cancelled,
    };

    Ok(result)
}

/// 取消进行中的更新下载
#[tauri::command]
pub(crate) fn cancel_update_download() -> CommandResult<()> {
    let _ = cancel_sender().send(true);
    Ok(())
}

/// 按当前更新渠道检查更新，返回与官方插件 `Update` 兼容的元数据（rid 指向已注册的资源）
#[tauri::command]
pub async fn check_update<R: Runtime>(webview: Webview<R>) -> CommandResult<Option<UpdateMetadata>> {
    into_command_result(
        async {
            let endpoints = baked_endpoints(&webview);
            if endpoints.is_empty() {
                anyhow::bail!("updater endpoints not configured");
            }

            let verge = Config::verge().data().clone();
            let channel = effective_channel(&verge, &endpoints);
            let endpoints = channel_endpoints(&endpoints, channel);
            if endpoints.is_empty() {
                anyhow::bail!("updater endpoints not configured");
            }

            let updater = webview.updater_builder().endpoints(endpoints)?.build()?;
            let update = updater.check().await?;

            Ok(update.map(|update| {
                let rid = webview.resources_table().add(update.clone());
                UpdateMetadata {
                    rid,
                    current_version: update.current_version,
                    version: update.version,
                    date: format_date(update.date),
                    body: update.body,
                    raw_json: update.raw_json,
                }
            }))
        }
        .await,
    )
}
