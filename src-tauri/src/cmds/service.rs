use clash_verge_self_service::model::JsonResponse;
use serde::{Deserialize, Serialize};
use specta::Type;

use crate::{
    core::service,
    error::{AppError, AppResult},
};

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ServiceJsonResponse<T> {
    pub code: u64,
    pub msg: String,
    pub data: Option<T>,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ServiceStartBody {
    pub core_type: Option<String>,
    pub socket_path: Option<String>,
    pub bin_path: String,
    pub config_dir: String,
    pub config_file: String,
    pub log_file: String,
}

#[derive(Debug, Serialize, Deserialize, Type)]
pub struct ServiceClashRunInfo {
    pub info: Option<ServiceStartBody>,
    pub is_running: bool,
    pub pid: Option<u32>,
    pub restart_count: usize,
}

fn into_service_response<T, U>(response: JsonResponse<T>) -> AppResult<ServiceJsonResponse<U>>
where
    JsonResponse<T>: Serialize,
    U: for<'de> Deserialize<'de>,
{
    serde_json::from_value(serde_json::to_value(response)?).map_err(AppError::SerdeJson)
}

#[tauri::command]
#[specta::specta]
pub async fn check_service() -> AppResult<ServiceJsonResponse<ServiceClashRunInfo>> {
    into_service_response(service::check_service().await?)
}

#[tauri::command]
#[specta::specta]
pub async fn install_service() -> AppResult<()> {
    service::install_service().await
}

#[tauri::command]
#[specta::specta]
pub async fn uninstall_service() -> AppResult<()> {
    service::stop_service().await?;
    service::uninstall_service().await
}
