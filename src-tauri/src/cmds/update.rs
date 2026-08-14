use serde::Serialize;
use tauri::{Manager, Runtime, Webview};
use tauri_plugin_updater::UpdaterExt;
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
