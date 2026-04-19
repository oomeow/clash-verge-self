use crate::{
    cmds,
    config::{Config, IVerge},
    error::{AppError, AppResult},
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
    match func.trim() {
        "open_or_close_dashboard" => feat::open_or_close_dashboard(),
        "clash_mode_rule" => feat::change_clash_mode("rule".into()),
        "clash_mode_global" => feat::change_clash_mode("global".into()),
        "clash_mode_direct" => feat::change_clash_mode("direct".into()),
        "toggle_system_proxy" => feat::toggle_system_proxy(),
        "toggle_tun_mode" => feat::toggle_tun_mode(),
        "exit_app" => cmds::common::exit_app(app_handle),
        _ => {
            return Err(AppError::InvalidValue(format!("invalid function \"{func}\"")));
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn test_delay(url: String) -> AppResult<u32> {
    Ok(feat::test_delay(url).await.unwrap_or(5000u32))
}
