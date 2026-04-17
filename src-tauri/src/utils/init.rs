use std::path::PathBuf;

use tauri_plugin_shell::ShellExt;

use crate::{
    any_err,
    config::{Config, IClashConfig, IProfiles, IVerge},
    core::handle,
    error::{AppError, AppResult},
    trace_err,
    utils::{dirs, help},
};

/// Initialize all the config files before tauri setup
pub fn init_dirs_and_config() -> AppResult<()> {
    // init dirs
    let init_dirs = [
        dirs::app_home_dir(),
        dirs::app_profiles_dir(),
        dirs::app_logs_dir(),
        dirs::clash_logs_dir(),
        dirs::backup_dir(),
    ];
    for dir in init_dirs {
        let dir = dir?;
        if !dir.exists() {
            std::fs::create_dir_all(&dir)?;
        }
    }

    // init yaml config
    let clash_path = dirs::clash_path()?;
    let prefix = Some("# Clash Verge");
    if !clash_path.exists() {
        help::save_yaml(&clash_path, &IClashConfig::default().0, prefix)?;
    }
    let verge_path = dirs::verge_path()?;
    if !verge_path.exists() {
        help::save_yaml(&verge_path, &IVerge::template(), prefix)?;
    }
    let profiles_path = dirs::profiles_path()?;
    if !profiles_path.exists() {
        help::save_yaml(&profiles_path, &IProfiles::template(), prefix)?;
    }

    Ok(())
}

/// initialize app resources after tauri setup
pub fn init_resources() -> AppResult<()> {
    let app_dir = dirs::app_home_dir().and_then(|app_dir| {
        if !app_dir.exists() {
            std::fs::create_dir_all(&app_dir)?;
        }
        Ok(app_dir)
    })?;
    let res_dir = dirs::app_resources_dir().and_then(|res_dir| {
        if !res_dir.exists() {
            std::fs::create_dir_all(&res_dir)?;
        }
        Ok(res_dir)
    })?;

    // copy the resource file
    // if the source file is newer than the destination file, copy it over
    let file_list = ["Country.mmdb", "geoip.dat", "geosite.dat", "ASN.mmdb"];
    let handle_copy = |src_path: &PathBuf, dest_path: &PathBuf, file: &str| {
        match std::fs::copy(src_path, dest_path) {
            Ok(_) => tracing::debug!("resources copied '{file}'"),
            Err(err) => {
                tracing::error!("failed to copy resources '{file}', {err}")
            }
        };
    };
    for file in file_list {
        let src_path = res_dir.join(file);
        let dest_path = app_dir.join(file);

        if src_path.exists() && !dest_path.exists() {
            handle_copy(&src_path, &dest_path, file);
            continue;
        }

        let src_modified = std::fs::metadata(&src_path).and_then(|m| m.modified());
        let dest_modified = std::fs::metadata(&dest_path).and_then(|m| m.modified());
        match (src_modified, dest_modified) {
            (Ok(src_modified), Ok(dest_modified)) => {
                if src_modified > dest_modified {
                    handle_copy(&src_path, &dest_path, file);
                } else {
                    tracing::debug!("skipping resource copy '{file}'");
                }
            }
            _ => {
                tracing::debug!("failed to get modified '{file}'");
                handle_copy(&src_path, &dest_path, file);
            }
        };
    }

    Ok(())
}

pub async fn startup_script() -> AppResult<()> {
    let path = {
        let verge = Config::verge();
        let verge = verge.latest();
        verge.startup_script.clone().unwrap_or_default()
    };

    if !path.is_empty() {
        let mut shell = "";
        if path.ends_with(".sh") {
            shell = "bash";
        }
        if path.ends_with(".ps1") {
            shell = "powershell";
        }
        if path.ends_with(".bat") {
            shell = "powershell";
        }
        if shell.is_empty() {
            return Err(any_err!("unsupported script: {path}"));
        }
        let script_path = PathBuf::from(&path);
        if !script_path.exists() {
            return Err(any_err!("script not found: {path}"));
        }
        let current_dir = script_path.parent();
        let app_handle = handle::Handle::app_handle();
        let mut cmd = app_handle.shell().command(shell);
        if let Some(dir) = current_dir {
            cmd = cmd.current_dir(dir);
        }
        trace_err!(cmd.args([path]).output().await, "run startup script failed");
    }
    Ok(())
}
