use std::{fs, path::PathBuf};

use reqwest_dav::list_cmd::ListFile;
use serde::Serialize;
use specta::Type;

use crate::{
    cmds,
    config::Config,
    core::backup::{self, WebDav},
    error::AppResult,
    utils::dirs,
};

#[derive(Debug, Clone, Serialize, Type)]
pub struct BackupListFile {
    pub href: String,
    pub last_modified: String,
    pub content_length: i64,
    pub content_type: String,
    pub tag: Option<String>,
}

impl From<ListFile> for BackupListFile {
    fn from(file: ListFile) -> Self {
        Self {
            href: file.href,
            last_modified: file.last_modified.to_rfc3339(),
            content_length: file.content_length,
            content_type: file.content_type,
            tag: file.tag,
        }
    }
}

#[tauri::command]
#[specta::specta]
pub async fn create_local_backup(only_backup_profiles: bool) -> AppResult<(String, PathBuf)> {
    let (file_name, file_path) = backup::create_backup(true, only_backup_profiles)?;
    Ok((file_name, file_path))
}

#[tauri::command]
#[specta::specta]
pub async fn apply_local_backup(app_handle: tauri::AppHandle, file_path: String) -> AppResult<()> {
    let file = fs::File::open(file_path)?;
    let mut zip: zip::ZipArchive<fs::File> = zip::ZipArchive::new(file)?;
    zip.extract(dirs::app_home_dir()?)?;
    Config::reload().await?;
    cmds::common::restart_app(app_handle).await;
    Ok(())
}

// web dav
#[tauri::command]
#[specta::specta]
pub async fn update_webdav_info(url: String, username: String, password: String) -> AppResult<()> {
    WebDav::global().update_webdav_info(url, username, password).await
}

#[tauri::command]
#[specta::specta]
pub async fn create_and_upload_backup(only_backup_profiles: bool) -> AppResult<()> {
    let (file_name, file_path) = backup::create_backup(false, only_backup_profiles)?;
    WebDav::upload_file(&file_path, &file_name).await
}

#[tauri::command]
#[specta::specta]
pub async fn list_backup() -> AppResult<Vec<BackupListFile>> {
    Ok(WebDav::list_file()
        .await?
        .into_iter()
        .map(BackupListFile::from)
        .collect())
}

#[tauri::command]
#[specta::specta]
pub async fn download_backup_and_reload(app_handle: tauri::AppHandle, file_name: String) -> AppResult<()> {
    let backup_archive = dirs::backup_archive_file()?;
    WebDav::download_file(&file_name, &backup_archive).await?;
    let file = fs::File::open(backup_archive)?;
    // extract zip file
    let mut zip = zip::ZipArchive::new(file)?;
    zip.extract(dirs::app_home_dir()?)?;
    Config::reload().await?;
    cmds::common::restart_app(app_handle).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn delete_backup(file_name: String) -> AppResult<()> {
    WebDav::delete_file(file_name).await
}
