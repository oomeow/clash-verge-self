use crate::{config::Config, utils::dirs};
use anyhow::{bail, Result};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use reqwest_dav::list_cmd::{ListEntity, ListFile};
use std::{
    env::{consts::OS, temp_dir},
    fs,
    io::Write,
    path::PathBuf,
    sync::Arc,
};
use zip::write::SimpleFileOptions;

// new backup dir
#[cfg(not(feature = "verge-dev"))]
const BACKUP_DIR: &str = "clash-verge-self";
#[cfg(feature = "verge-dev")]
const BACKUP_DIR: &str = "clash-verge-self-dev";

const TIME_FORMAT_PATTERN: &str = "%Y-%m-%d_%H-%M-%S";

// in timer crate, used to activating proxies group selected after restart app
pub const ENV_APPLY_BACKUP: &str = "ApplyBackup";

/// create backup zip file
///
/// # Args
/// - `local_save`: save to local or not
/// - `only_backup_profiles`: only backup profiles
///
/// # Return
/// - `Result<(String, PathBuf), Box<dyn std::error::Error>>`: backup file name and path
///     - `String`: backup file name
///     - `PathBuf`: backup file path
pub fn create_backup(local_save: bool, only_backup_profiles: bool) -> Result<(String, PathBuf)> {
    let now = chrono::Local::now().format(TIME_FORMAT_PATTERN).to_string();

    let mut zip_file_name = format!("{}-backup-{}.zip", OS, now);
    if only_backup_profiles {
        zip_file_name = format!("{}-profiles-backup-{}.zip", OS, now);
    }
    let mut zip_path = temp_dir().join(&zip_file_name);
    if local_save {
        zip_path = dirs::backup_dir()?.join(&zip_file_name);
    }

    let file = fs::File::create(&zip_path)?;
    let mut zip = zip::ZipWriter::new(file);
    zip.add_directory("profiles/", SimpleFileOptions::default())?;
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    if let Ok(entries) = fs::read_dir(dirs::app_profiles_dir()?) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let backup_path = format!("profiles/{}", entry.file_name().to_str().unwrap());
                zip.start_file(backup_path, options)?;
                zip.write_all(fs::read(path).unwrap().as_slice())?;
            }
        }
    }
    if !only_backup_profiles {
        zip.start_file(dirs::CLASH_CONFIG, options)?;
        zip.write_all(fs::read(dirs::clash_path()?)?.as_slice())?;
        zip.start_file(dirs::VERGE_CONFIG, options)?;
        zip.write_all(fs::read(dirs::verge_path()?)?.as_slice())?;
    }
    zip.start_file(dirs::PROFILE_YAML, options)?;
    zip.write_all(fs::read(dirs::profiles_path()?)?.as_slice())?;
    zip.finish()?;
    Ok((zip_file_name, zip_path))
}

pub struct WebDav {
    client: Arc<Mutex<Option<reqwest_dav::Client>>>,
}

impl WebDav {
    pub fn global() -> &'static WebDav {
        static WEBDAV: OnceCell<WebDav> = OnceCell::new();

        WEBDAV.get_or_init(|| WebDav {
            client: Arc::new(Mutex::new(None)),
        })
    }

    pub async fn init(&self) -> Result<()> {
        let verge = Config::verge().latest().clone();
        if verge.webdav_url.is_none()
            || verge.webdav_username.is_none()
            || verge.webdav_password.is_none()
        {
            log::trace!(target: "app", "webdav info config is empty, skip init webdav");
            return Ok(());
        }
        let url = verge.webdav_url.unwrap_or_default();
        let username = verge.webdav_username.unwrap_or_default();
        let password = verge.webdav_password.unwrap_or_default();
        self.update_webdav_info(url, username, password).await?;
        Ok(())
    }

    pub async fn update_webdav_info<S: Into<String>>(
        &self,
        url: S,
        username: S,
        password: S,
    ) -> Result<()> {
        *self.client.lock() = None;
        let client = reqwest_dav::ClientBuilder::new()
            .set_host(url.into())
            .set_auth(reqwest_dav::Auth::Basic(username.into(), password.into()))
            .build()?;
        *self.client.lock() = Some(client.clone());
        client.mkcol(BACKUP_DIR).await?;
        Ok(())
    }

    fn get_client(&self) -> Result<reqwest_dav::Client> {
        match self.client.lock().clone() {
            Some(client) => Ok(client),
            None => {
                let msg = "Unable to create web dav client, please make sure the webdav config is correct";
                log::error!(target: "app","{}",msg);
                bail!(msg)
            }
        }
    }

    pub async fn list_file_by_path(path: &str) -> Result<Vec<ListFile>> {
        let client = Self::global().get_client()?;
        let files = client.list(path, reqwest_dav::Depth::Number(1)).await?;
        let mut final_files = Vec::new();
        for file in files {
            if let ListEntity::File(file) = file {
                final_files.push(file);
            }
        }
        Ok(final_files)
    }

    pub async fn list_file() -> Result<Vec<ListFile>> {
        let path = format!("{}/", BACKUP_DIR);
        let files = Self::list_file_by_path(&path).await?;
        Ok(files)
    }

    pub async fn download_file(webdav_file_name: String, storage_path: PathBuf) -> Result<()> {
        let client = Self::global().get_client()?;
        let path = format!("{}/{}", BACKUP_DIR, webdav_file_name);
        let response = client.get(path.as_str()).await?;
        let content = response.bytes().await?;
        fs::write(&storage_path, &content)?;
        Ok(())
    }

    pub async fn upload_file(file_path: PathBuf, webdav_file_name: String) -> Result<()> {
        let client = Self::global().get_client()?;
        let web_dav_path = format!("{}/{}", BACKUP_DIR, webdav_file_name);
        client.put(&web_dav_path, fs::read(file_path)?).await?;
        Ok(())
    }

    pub async fn delete_file(file_name: String) -> Result<()> {
        let client = Self::global().get_client()?;
        let path = format!("{}/{}", BACKUP_DIR, file_name);
        client.delete(&path).await?;
        Ok(())
    }
}

#[tokio::test]
/// cargo test -- --show-output test_webdav
async fn test_webdav() {
    let _ = WebDav::global()
        .update_webdav_info("https://dav.jianguoyun.com/dav/", "test", "test")
        .await;
    let files = WebDav::list_file().await.unwrap();
    for file in files {
        println!("file: {:?}", file);
    }
}
