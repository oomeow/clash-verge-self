use crate::{
    config::{Config, IVerge},
    core::hotkey,
    error::AppResult,
    feat,
};

#[tauri::command]
pub fn get_verge_config() -> AppResult<IVerge> {
    Ok(Config::verge().data().clone())
}

#[tauri::command]
pub async fn patch_verge_config(payload: IVerge) -> AppResult<()> {
    feat::patch_verge(payload).await
}

#[tauri::command]
pub fn dispatch_hotkey_action(app_handle: tauri::AppHandle, func: String) -> AppResult<()> {
    hotkey::dispatch_action(&app_handle, &func)
}

#[tauri::command]
pub async fn test_delay(url: String) -> AppResult<u32> {
    Ok(feat::test_delay(url).await.unwrap_or(5000u32))
}
