use clash_verge_self_service::model::{ClashStatus, JsonResponse};

use crate::{core::service, error::AppResult};

#[tauri::command]
pub async fn check_service() -> AppResult<JsonResponse<ClashStatus>> {
    service::check_service().await
}

#[tauri::command]
pub async fn install_service() -> AppResult<()> {
    service::install_service().await
}

#[tauri::command]
pub async fn uninstall_service() -> AppResult<()> {
    service::stop_service().await?;
    service::uninstall_service().await
}
