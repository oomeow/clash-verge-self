use clash_verge_self_service::model::{ClashRunInfo, JsonResponse};

use crate::{cmds::into_command_result, core::service};

#[tauri::command]
pub async fn check_service() -> Result<JsonResponse<ClashRunInfo>, String> {
    into_command_result(service::check_service().await)
}

#[tauri::command]
pub async fn install_service() -> Result<(), String> {
    into_command_result(service::install_service().await)
}

#[tauri::command]
pub async fn uninstall_service() -> Result<(), String> {
    into_command_result(
        async {
            service::stop_service().await?;
            service::uninstall_service().await
        }
        .await,
    )
}
