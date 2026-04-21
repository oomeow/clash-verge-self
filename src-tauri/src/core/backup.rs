use std::{
    env::{consts::OS, temp_dir},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Arc,
};

use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use reqwest_dav::{
    Depth,
    list_cmd::{ListEntity, ListFile},
};
use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;

use crate::{
    any_err,
    config::Config,
    error::{AppError, AppResult},
    trace_err,
    utils::dirs,
};

// new backup dir
#[cfg(not(feature = "verge-dev"))]
const BACKUP_DIR: &str = "clash-verge-self";
#[cfg(feature = "verge-dev")]
const BACKUP_DIR: &str = "clash-verge-self-dev";

const TIME_FORMAT_PATTERN: &str = "%Y-%m-%d_%H-%M-%S";

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BackupType {
    Local,
    Webdav,
}

#[derive(Debug, Serialize)]
pub struct BackupFile {
    pub filename: String,
    pub href: String,
    pub last_modified: String,
    pub content_length: u64,
    pub content_type: String,
    pub tag: String,
}

pub fn local_backup_dir() -> AppResult<PathBuf> {
    if let Some(custom_dir) = Config::verge()
        .latest()
        .local_backup_dir
        .as_ref()
        .map(|dir| dir.trim())
        .filter(|dir| !dir.is_empty())
        .map(PathBuf::from)
        .filter(|dir| dir.is_dir())
    {
        return Ok(custom_dir);
    }

    let backup_dir = dirs::backup_dir()?;
    Ok(backup_dir)
}

fn create_backup(local_save: bool, only_backup_profiles: bool) -> AppResult<(String, PathBuf)> {
    let now = chrono::Local::now().format(TIME_FORMAT_PATTERN).to_string();

    let zip_file_name = format!(
        "{}-{}backup-{}.zip",
        OS,
        if only_backup_profiles { "profiles-" } else { "" },
        now
    );

    let zip_path = if local_save {
        local_backup_dir()?.join(&zip_file_name)
    } else {
        temp_dir().join(&zip_file_name)
    };

    let file = fs::File::create(&zip_path)?;
    let mut zip = zip::ZipWriter::new(file);

    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);

    fn add_file_to_zip(
        zip: &mut zip::ZipWriter<fs::File>,
        path: &PathBuf,
        zip_path: &str,
        options: SimpleFileOptions,
    ) -> AppResult<()> {
        zip.start_file(zip_path, options)?;
        zip.write_all(&fs::read(path)?)?;
        Ok(())
    }

    // Add profile files
    zip.add_directory("profiles/", SimpleFileOptions::default())?;
    let profile_dir = dirs::app_profiles_dir()?;
    for entry in fs::read_dir(&profile_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_file() {
            let backup_path = format!("profiles/{}", entry.file_name().to_string_lossy());
            add_file_to_zip(&mut zip, &path, &backup_path, options)?;
        }
    }

    // Add additional files if not only backing up profiles
    if !only_backup_profiles {
        add_file_to_zip(&mut zip, &dirs::clash_path()?, dirs::CLASH_CONFIG, options)?;
        add_file_to_zip(&mut zip, &dirs::verge_path()?, dirs::VERGE_CONFIG, options)?;
    }

    add_file_to_zip(&mut zip, &dirs::profiles_path()?, dirs::PROFILE_YAML, options)?;
    zip.finish()?;

    Ok((zip_file_name, zip_path))
}

pub async fn create_backup_by_type(
    backup_type: BackupType,
    only_backup_profiles: bool,
) -> AppResult<(String, PathBuf)> {
    let local_save = matches!(backup_type, BackupType::Local);
    let (file_name, file_path) = create_backup(local_save, only_backup_profiles)?;

    if matches!(backup_type, BackupType::Webdav) {
        WebDav::upload_file(&file_path, &file_name).await?;
    }

    Ok((file_name, file_path))
}

pub fn apply_backup_file(file_path: PathBuf) -> AppResult<()> {
    let file = fs::File::open(file_path)?;
    let mut zip: zip::ZipArchive<fs::File> = zip::ZipArchive::new(file)?;
    zip.extract(dirs::app_home_dir()?)?;
    Ok(())
}

fn local_backup_file_path(file_name: String) -> AppResult<PathBuf> {
    if file_name.is_empty() || file_name.contains(['/', '\\', '\0']) {
        return Err(any_err!("invalid backup file name"));
    }
    let file_name = Path::new(&file_name)
        .file_name()
        .ok_or_else(|| any_err!("invalid backup file name"))?;
    Ok(local_backup_dir()?.join(file_name))
}

fn local_backup_file(entry: fs::DirEntry) -> Option<BackupFile> {
    let path = entry.path();
    if !path.is_file() || path.extension().and_then(|ext| ext.to_str()) != Some("zip") {
        return None;
    }

    let Ok(metadata) = entry.metadata() else {
        return None;
    };
    let last_modified = metadata
        .modified()
        .ok()
        .map(|time| chrono::DateTime::<chrono::Local>::from(time).to_rfc3339())
        .unwrap_or_default();
    let filename = entry.file_name().to_string_lossy().to_string();

    Some(BackupFile {
        filename,
        href: path.to_string_lossy().to_string(),
        last_modified,
        content_length: metadata.len(),
        content_type: "application/zip".into(),
        tag: String::new(),
    })
}

fn webdav_backup_file(file: ListFile) -> BackupFile {
    let filename = file.href.split('/').next_back().unwrap_or_default().to_string();

    BackupFile {
        filename,
        href: file.href,
        last_modified: file.last_modified.to_rfc3339(),
        content_length: file.content_length.max(0) as u64,
        content_type: file.content_type,
        tag: file.tag.unwrap_or_default(),
    }
}

pub async fn apply_backup_file_by_type(backup_type: BackupType, file_name: String) -> AppResult<()> {
    match backup_type {
        BackupType::Local => {
            let file_path = local_backup_file_path(file_name)?;
            apply_backup_file(file_path)?;
        }
        BackupType::Webdav => {
            let backup_archive = dirs::backup_archive_file()?;
            WebDav::download_file(&file_name, &backup_archive).await?;
            apply_backup_file(backup_archive)?;
        }
    }

    Ok(())
}

pub async fn list_backup_files(backup_type: BackupType) -> AppResult<Vec<BackupFile>> {
    let files = match backup_type {
        BackupType::Local => {
            let backup_dir = local_backup_dir()?;
            let mut files = Vec::new();

            for entry in fs::read_dir(backup_dir)? {
                if let Some(file) = local_backup_file(entry?) {
                    files.push(file);
                }
            }

            files
        }
        BackupType::Webdav => WebDav::list_file().await?.into_iter().map(webdav_backup_file).collect(),
    };

    Ok(files)
}

pub async fn delete_backup_file(backup_type: BackupType, file_name: String) -> AppResult<()> {
    match backup_type {
        BackupType::Local => {
            let file_path = local_backup_file_path(file_name)?;
            if file_path.is_file() {
                fs::remove_file(file_path)?;
            }
        }
        BackupType::Webdav => {
            WebDav::delete_file(file_name).await?;
        }
    }

    Ok(())
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

    pub async fn init(&self) -> AppResult<()> {
        let (url, username, password) = {
            let verge = Config::verge();
            let verge = verge.latest();
            (
                verge.webdav_url.clone(),
                verge.webdav_username.clone(),
                verge.webdav_password.clone(),
            )
        };
        if let (Some(url), Some(username), Some(password)) = (url, username, password) {
            trace_err!(
                self.update_webdav_info(url, username, password).await,
                "failed to update webdav info"
            );
        } else {
            tracing::trace!("webdav info config is empty, skip init webdav");
        }
        Ok(())
    }

    pub async fn update_webdav_info<S: Into<String>>(&self, url: S, username: S, password: S) -> AppResult<()> {
        *self.client.lock() = None;
        let client = reqwest_dav::ClientBuilder::new()
            .set_host(url.into())
            .set_auth(reqwest_dav::Auth::Basic(username.into(), password.into()))
            .build()?;
        match client.list("/", Depth::Number(1)).await {
            Ok(_) => {
                if client.list(BACKUP_DIR, Depth::Number(1)).await.is_err() {
                    client.mkcol(BACKUP_DIR).await?;
                }
                *self.client.lock() = Some(client);
                Ok(())
            }
            Err(e) => {
                tracing::error!("invalid webdav config: {e:?}");
                Err(AppError::WebDav(e))
            }
        }
    }

    fn get_client(&self) -> AppResult<reqwest_dav::Client> {
        match self.client.lock().clone() {
            Some(client) => Ok(client),
            None => {
                let msg = "Unable to create web dav client, please make sure the webdav config is correct";
                tracing::error!("{msg}");
                Err(any_err!("{msg}"))
            }
        }
    }

    pub async fn list_file_by_path(path: &str) -> AppResult<Vec<ListFile>> {
        let client = Self::global().get_client()?;
        let files = client
            .list(path, reqwest_dav::Depth::Number(1))
            .await?
            .into_iter()
            .filter_map(|entity| match entity {
                ListEntity::File(file) => Some(file),
                _ => None,
            })
            .collect();
        Ok(files)
    }

    pub async fn list_file() -> AppResult<Vec<ListFile>> {
        let path = format!("{BACKUP_DIR}/");
        let files = Self::list_file_by_path(&path).await?;
        Ok(files)
    }

    pub async fn download_file(webdav_file_name: &str, storage_path: &PathBuf) -> AppResult<()> {
        let client = Self::global().get_client()?;
        let path = format!("{BACKUP_DIR}/{webdav_file_name}");
        let response = client.get(&path).await?;
        let content = response.bytes().await.map_err(|e| AppError::WebDav(e.into()))?;
        fs::write(storage_path, &content)?;
        Ok(())
    }

    pub async fn upload_file(file_path: &PathBuf, webdav_file_name: &str) -> AppResult<()> {
        let client = Self::global().get_client()?;
        let web_dav_path = format!("{BACKUP_DIR}/{webdav_file_name}");
        client.put(&web_dav_path, fs::read(file_path)?).await?;
        Ok(())
    }

    pub async fn delete_file(file_name: String) -> AppResult<()> {
        let client = Self::global().get_client()?;
        let path = format!("{BACKUP_DIR}/{file_name}");
        client.delete(&path).await?;
        Ok(())
    }
}

/// cargo test -- --show-output test_webdav
#[tokio::test]
async fn test_webdav() -> AppResult<()> {
    WebDav::global()
        .update_webdav_info("https://dav.jianguoyun.com/dav/", "test", "test")
        .await?;
    let files = WebDav::list_file().await?;
    for file in files {
        println!("file: {file:?}");
    }
    Ok(())
}
