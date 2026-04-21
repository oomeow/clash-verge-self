use std::path::PathBuf;

use crate::{
    cmds,
    config::Config,
    core::backup::{self, BackupFile, BackupType, WebDav},
    error::AppResult,
};

#[tauri::command]
pub async fn create_backup(backup_type: BackupType, only_backup_profiles: bool) -> AppResult<(String, PathBuf)> {
    backup::create_backup_by_type(backup_type, only_backup_profiles).await
}

#[tauri::command]
pub async fn apply_backup_and_reload(
    app_handle: tauri::AppHandle,
    backup_type: BackupType,
    file_name: String,
) -> AppResult<()> {
    backup::apply_backup_file_by_type(backup_type, file_name).await?;
    Config::reload().await?;
    cmds::common::restart_app(app_handle).await;
    Ok(())
}

#[tauri::command]
pub async fn list_backup(backup_type: BackupType) -> AppResult<Vec<BackupFile>> {
    backup::list_backup_files(backup_type).await
}

#[tauri::command]
pub async fn delete_backup(backup_type: BackupType, file_name: String) -> AppResult<()> {
    backup::delete_backup_file(backup_type, file_name).await
}

// web dav
#[tauri::command]
pub async fn update_webdav_info(url: String, username: String, password: String) -> AppResult<()> {
    WebDav::global().update_webdav_info(url, username, password).await
}
