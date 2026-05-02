use crate::{
    cmds::{CommandResult, into_command_result},
    config::{Config, IVerge},
    core::hotkey,
    feat,
};

#[tauri::command]
pub fn get_verge_config() -> CommandResult<IVerge> {
    Ok(Config::verge().data().clone())
}

#[tauri::command]
pub async fn patch_verge_config(payload: IVerge) -> CommandResult<()> {
    into_command_result(feat::patch_verge(payload).await)
}

#[tauri::command]
pub fn dispatch_hotkey_action(app_handle: tauri::AppHandle, func: String) -> CommandResult<()> {
    into_command_result(hotkey::dispatch_action(&app_handle, &func))
}

#[tauri::command]
pub async fn test_delay(url: String) -> CommandResult<u32> {
    Ok(feat::test_delay(url).await.unwrap_or(5000u32))
}
