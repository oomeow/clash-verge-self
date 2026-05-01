use crate::{
    cmds::into_command_result,
    config::{Config, IVerge},
    core::hotkey,
    feat,
};

#[tauri::command]
pub fn get_verge_config() -> Result<IVerge, String> {
    Ok(Config::verge().data().clone())
}

#[tauri::command]
pub async fn patch_verge_config(payload: IVerge) -> Result<(), String> {
    into_command_result(feat::patch_verge(payload).await)
}

#[tauri::command]
pub fn dispatch_hotkey_action(app_handle: tauri::AppHandle, func: String) -> Result<(), String> {
    into_command_result(hotkey::dispatch_action(&app_handle, &func))
}

#[tauri::command]
pub async fn test_delay(url: String) -> Result<u32, String> {
    Ok(feat::test_delay(url).await.unwrap_or(5000u32))
}
