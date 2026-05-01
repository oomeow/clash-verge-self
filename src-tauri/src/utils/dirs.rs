use std::path::PathBuf;

use anyhow::{Context, Result};
use dirs::data_dir;
use once_cell::sync::OnceCell;

use crate::core::handle;

#[cfg(not(feature = "verge-dev"))]
pub static APP_ID: &str = "io.github.oomeow.clash-verge-self";
#[cfg(feature = "verge-dev")]
pub static APP_ID: &str = "io.github.oomeow.clash-verge-self.dev";

pub static PORTABLE_FLAG: OnceCell<bool> = OnceCell::new();

pub static CLASH_CONFIG: &str = "config.yaml";
pub static VERGE_CONFIG: &str = "verge.yaml";
pub static PROFILE_YAML: &str = "profiles.yaml";

pub fn is_portable_version() -> bool {
    *PORTABLE_FLAG.get().unwrap_or(&false)
}

/// get the verge app home dir
pub fn app_home_dir() -> Result<PathBuf> {
    use tauri::utils::platform::current_exe;

    let flag = PORTABLE_FLAG.get_or_try_init(|| -> Result<bool> {
        let app_exe = current_exe()?;
        let mut flag = false;
        if let Some(dir) = app_exe.parent() {
            let dir = PathBuf::from(dir).join(".config/PORTABLE");
            if dir.exists() {
                flag = true;
            }
        }
        Ok(flag)
    });
    if let Ok(flag) = flag
        && *flag
    {
        let app_exe = current_exe()?;
        let app_exe = dunce::canonicalize(app_exe)?;
        let app_dir = app_exe.parent().context("failed to get the portable app dir")?;
        return Ok(PathBuf::from(app_dir).join(".config").join(APP_ID));
    }

    Ok(data_dir().context("failed to get app home dir")?.join(APP_ID))
}

/// get the resources dir
pub fn app_resources_dir() -> Result<PathBuf> {
    use tauri::{
        Env,
        utils::platform::{current_exe, resource_dir},
    };

    let app_handle = handle::Handle::app_handle();
    let portable = PORTABLE_FLAG.get().unwrap_or(&false);
    let res_dir = if *portable {
        current_exe()?
            .parent()
            .context("failed to get the portable app dir")?
            .join("resources")
    } else {
        resource_dir(app_handle.package_info(), &Env::default())
            .map_err(anyhow::Error::from)
            .context("failed to get the resource dir")?
            .join("resources")
    };
    Ok(res_dir)
}

/// profiles dir
pub fn app_profiles_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("profiles"))
}

/// logs dir
pub fn app_logs_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("logs"))
}

pub fn clash_logs_dir() -> Result<PathBuf> {
    Ok(app_logs_dir()?.join("clash"))
}

pub fn clash_path() -> Result<PathBuf> {
    Ok(app_home_dir()?.join(CLASH_CONFIG))
}

pub fn verge_path() -> Result<PathBuf> {
    Ok(app_home_dir()?.join(VERGE_CONFIG))
}

pub fn profiles_path() -> Result<PathBuf> {
    Ok(app_home_dir()?.join(PROFILE_YAML))
}

pub fn service_bin_path() -> Result<PathBuf> {
    let exe_ext = std::env::consts::EXE_SUFFIX;
    let service_bin = format!("clash-verge-self-service{}", exe_ext);
    Ok(app_resources_dir()?.join(service_bin))
}

pub fn backup_dir() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("backup"))
}

pub fn backup_archive_file() -> Result<PathBuf> {
    Ok(app_home_dir()?.join("archive.zip"))
}

pub fn generate_log_file() -> String {
    let local_time = chrono::Local::now().format("%Y-%m-%d-%H%M").to_string();
    let log_file = format!("{local_time}.log");
    log_file
}

pub fn path_to_str(path: &PathBuf) -> Result<&str> {
    clash_verge_self_utils::path_to_str(path)
}
