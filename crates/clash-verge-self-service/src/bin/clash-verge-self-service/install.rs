use std::path::{Path, PathBuf};

use clash_verge_self_service::{DEFAULT_SERVER_ID, Result, ServiceError, generate_psk, psk_path_from_data_dir};

/// Derive the app data dir from the logs dir passed by the client.
fn data_dir_from_log_dir(log_dir: Option<PathBuf>) -> Result<PathBuf> {
    log_dir
        .and_then(|dir| dir.parent().map(Path::to_path_buf))
        .ok_or_else(|| ServiceError::General("missing --log-dir, cannot locate the app data dir".into()))
}

/// Canonicalize the directory holding the core sidecars (the trust anchor for
/// core binaries) and verify the bundled cores are actually there.
fn resolve_core_dir(core_dir: Option<PathBuf>) -> Result<PathBuf> {
    let core_dir = core_dir.ok_or_else(|| ServiceError::General("missing --core-dir".into()))?;
    let canonical = core_dir
        .canonicalize()
        .map_err(|e| ServiceError::General(format!("invalid core dir {}: {e}", core_dir.display())))?;
    if !canonical.is_dir() {
        return Err(ServiceError::General(format!(
            "core dir {} is not a directory",
            canonical.display()
        )));
    }

    // Fail loudly if the directory does not look like the app dir the service will
    // later resolve cores from, instead of failing at runtime.
    let found: Vec<&str> = clash_verge_self_service::ALLOWED_CORES
        .iter()
        .copied()
        .filter(|core| {
            canonical
                .join(format!("{core}{}", std::env::consts::EXE_SUFFIX))
                .is_file()
        })
        .collect();
    if found.is_empty() {
        return Err(ServiceError::General(format!(
            "no core binaries ({:?}) found in {}",
            clash_verge_self_service::ALLOWED_CORES,
            canonical.display()
        )));
    }
    for core in clash_verge_self_service::ALLOWED_CORES {
        if !found.contains(&core) {
            log::warn!(
                "core binary {core} not found in {}, it will not be launchable",
                canonical.display()
            );
        }
    }

    Ok(canonical)
}

/// Generate and persist a fresh per-install pre-shared key, returning its path.
fn provision_psk(data_dir: &Path) -> Result<PathBuf> {
    std::fs::create_dir_all(data_dir)
        .map_err(|e| ServiceError::General(format!("failed to create app data dir {}: {e}", data_dir.display())))?;
    let psk_path = psk_path_from_data_dir(data_dir);
    let psk = generate_psk();
    write_psk_file(&psk_path, &psk)?;
    log::debug!("service key provisioned at {}", psk_path.display());
    Ok(psk_path)
}

#[cfg(unix)]
fn write_psk_file(path: &Path, psk: &[u8]) -> Result<()> {
    use std::{
        io::Write,
        os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt},
    };

    // Remove any pre-existing file/symlink so we never write through a link.
    match std::fs::remove_file(path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => {
            return Err(ServiceError::General(format!(
                "failed to remove stale service key: {e}"
            )));
        }
    }

    // Create with mode 0600 immediately so the freshly-written key is never
    // world-readable (no window before the later set_permissions).
    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .mode(0o600)
        .open(path)
        .map_err(|e| ServiceError::General(format!("failed to create service key {}: {e}", path.display())))?;
    file.write_all(psk)
        .map_err(|e| ServiceError::General(format!("failed to write service key: {e}")))?;
    file.sync_all()
        .map_err(|e| ServiceError::General(format!("failed to flush service key: {e}")))?;
    drop(file);

    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
        .map_err(|e| ServiceError::General(format!("failed to set service key permissions: {e}")))?;

    // The service runs as root, so hand ownership to the user owning the app data dir:
    // the unprivileged app must be able to read the key, other users must not.
    if let Some(parent) = path.parent()
        && let Ok(meta) = std::fs::metadata(parent)
    {
        let owner = format!("{}:{}", meta.uid(), meta.gid());
        let status = std::process::Command::new("chown")
            .arg(&owner)
            .arg(path)
            .status()
            .map_err(|e| ServiceError::General(format!("failed to chown service key: {e}")))?;
        if !status.success() {
            return Err(ServiceError::General("failed to chown service key".into()));
        }
    }

    Ok(())
}

#[cfg(windows)]
fn write_psk_file(path: &Path, psk: &[u8]) -> Result<()> {
    use std::io::Write;

    // Remove any pre-existing file so we never write through a reparse point.
    match std::fs::remove_file(path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
        Err(e) => {
            return Err(ServiceError::General(format!(
                "failed to remove stale service key: {e}"
            )));
        }
    }

    let mut file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| ServiceError::General(format!("failed to create service key {}: {e}", path.display())))?;
    // The key inherits the ACL of the user's profile dir (user + SYSTEM + admins).
    file.write_all(psk)
        .map_err(|e| ServiceError::General(format!("failed to write service key: {e}")))?;
    Ok(())
}

#[cfg(not(any(unix, windows)))]
fn write_psk_file(_path: &Path, _psk: &[u8]) -> Result<()> {
    Err(ServiceError::General(
        "This program is not intended to run on this platform.".into(),
    ))
}

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub fn process(_server_id: Option<String>, _log_dir: Option<PathBuf>, _core_dir: Option<PathBuf>) -> Result<()> {
    log::error!("Unsupported platform");
    Err(ServiceError::General(
        "This program is not intended to run on this platform.".into(),
    ))
}

#[cfg(target_os = "macos")]
pub fn process(server_id: Option<String>, log_dir: Option<PathBuf>, core_dir: Option<PathBuf>) -> Result<()> {
    use std::{fs::File, io::Write, path::Path};

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());
    let data_dir = data_dir_from_log_dir(log_dir.clone())?;
    let core_dir = resolve_core_dir(core_dir)?;

    log::debug!("Start install Clash Verge Self Service.");

    // uninstall old service
    crate::uninstall::process(log_dir)?;

    // generate a fresh key only after the old service has been torn down
    let psk_path = provision_psk(&data_dir)?;

    let service_binary_path = std::env::current_exe()?.with_file_name("clash-verge-self-service");
    let target_binary_path = "/Library/PrivilegedHelperTools/io.github.clashvergeself.helper";
    log::debug!("Generate service file at {}", target_binary_path);
    let target_binary_dir = Path::new("/Library/PrivilegedHelperTools");
    if !service_binary_path.exists() {
        log::error!("The clash-verge-self-service binary not found.");
        std::process::exit(2);
    }
    if !target_binary_dir.exists() {
        log::debug!("Create directory for service file [{}].", target_binary_dir.display());
        std::fs::create_dir(target_binary_dir)
            .map_err(|e| ServiceError::General(format!("Unable to create directory for service file: {e}")))?;
    }

    log::debug!(
        "Copy service file from {} to {}",
        service_binary_path.display(),
        target_binary_path
    );
    std::fs::copy(service_binary_path, target_binary_path)
        .map_err(|e| ServiceError::General(format!("Unable to copy service file: {e}")))?;

    let plist_file = "/Library/LaunchDaemons/io.github.clashvergeself.helper.plist";
    log::debug!("Create plist file at {}", plist_file);
    let plist_file = Path::new(plist_file);
    let plist_file_content = format!(
        include_str!("../../../tmpl/io.github.clashvergeself.helper.plist"),
        server_id,
        psk_path.display(),
        core_dir.display()
    );
    let mut file = File::create(plist_file)
        .map_err(|e| ServiceError::General(format!("Failed to create file for writing: {e}")))?;
    log::debug!("Create plist file done.");

    log::debug!("Write plist file content.");
    file.write_all(plist_file_content.as_bytes())
        .map_err(|e| ServiceError::General(format!("Unable to write plist file: {e}")))?;
    log::debug!("Write plist file content done.");

    log::debug!("Chmod and chown plist file.");
    std::process::Command::new("chmod")
        .arg("644")
        .arg(plist_file)
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to chmod: {e}")))?;
    std::process::Command::new("chown")
        .arg("root:wheel")
        .arg(plist_file)
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to chown: {e}")))?;
    log::debug!("Chmod and chown plist file done.");

    log::debug!("Chmod and chown service file.");
    std::process::Command::new("chmod")
        .arg("544")
        .arg(target_binary_path)
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to chmod: {e}")))?;
    std::process::Command::new("chown")
        .arg("root:wheel")
        .arg(target_binary_path)
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to chown: {e}")))?;
    log::debug!("Chmod and chown service file done.");

    // Unload before load the service.
    log::debug!("Unload service before load the service.");
    std::process::Command::new("launchctl")
        .arg("unload")
        .arg(plist_file)
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to unload service: {e}")))?;
    // Load the service.
    log::debug!("Load service.");
    std::process::Command::new("launchctl")
        .arg("load")
        .arg(plist_file)
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to load service: {e}")))?;
    // Start the service.
    log::debug!("Start service.");
    std::process::Command::new("launchctl")
        .arg("start")
        .arg("io.github.clashvergeself.helper")
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to start service: {e}")))?;

    log::debug!("Service installed successfully.");
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn process(server_id: Option<String>, log_dir: Option<PathBuf>, core_dir: Option<PathBuf>) -> Result<()> {
    use std::{fs::File, io::Write, path::Path};

    use clash_verge_self_service::SERVICE_NAME;

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());
    let data_dir = data_dir_from_log_dir(log_dir.clone())?;
    let core_dir = resolve_core_dir(core_dir)?;

    log::debug!("Start install Clash Verge Self Service.");

    let service_binary_path = std::env::current_exe()
        .unwrap()
        .with_file_name("clash-verge-self-service");
    if !service_binary_path.exists() {
        log::error!("The clash-verge-self-service binary not found.");
        std::process::exit(2);
    }

    // Peek the status of the service.
    log::debug!("Checking the status of the service.");
    let status_code = std::process::Command::new("systemctl")
        .arg("status")
        .arg(format!("{SERVICE_NAME}.service"))
        .arg("--no-pager")
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to execute 'systemctl status' command: {e}")))?
        .status
        .code();

    /*
     * https://www.freedesktop.org/software/systemd/man/latest/systemctl.html#Exit%20status
     */
    match status_code {
        Some(code) => match code {
            0..=3 => {
                log::debug!("The service is already installed, uninstall it first");
                crate::uninstall::process(log_dir)?;
            }
            4 => {
                log::debug!("The service status is unknown, continue to install. (status code: 4)")
            }
            _ => {
                log::error!("Unexpected status code from systemctl status");
                return Err(ServiceError::General(
                    "Unexpected status code from systemctl status".into(),
                ));
            }
        },
        None => {
            log::error!("systemctl was improperly terminated.");
            return Err(ServiceError::General("systemctl was improperly terminated.".into()));
        }
    }

    let unit_file = format!("/etc/systemd/system/{SERVICE_NAME}.service");

    // generate a fresh key only after any old service has been torn down
    let psk_path = provision_psk(&data_dir)?;

    log::debug!("Generating service file [{unit_file}].");
    let unit_file = Path::new(&unit_file);
    let unit_file_content = format!(
        include_str!("../../../tmpl/systemd_service_unit.tmpl"),
        service_binary_path.to_str().unwrap(),
        server_id,
        psk_path.display(),
        core_dir.display()
    );
    let mut file = File::create(unit_file)
        .map_err(|e| ServiceError::General(format!("Failed to create file for writing: {e}")))?;
    file.write_all(unit_file_content.as_bytes())
        .map_err(|e| ServiceError::General(format!("Failed to write to file: {e}")))?;
    log::debug!("Generated service file done.");

    // Reload unit files and start service.
    log::debug!("Reloading unit files and start service.");
    std::process::Command::new("systemctl")
        .arg("daemon-reload")
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to reload unit files: {e}")))?;
    std::process::Command::new("systemctl")
        .arg("enable")
        .arg(SERVICE_NAME)
        .arg("--now")
        .output()
        .map_err(|e| ServiceError::General(format!("Failed to start service: {e}")))?;

    log::debug!("Service installed successfully.");
    Ok(())
}

/// install and start the service
#[cfg(windows)]
pub fn process(server_id: Option<String>, log_dir: Option<PathBuf>, core_dir: Option<PathBuf>) -> Result<()> {
    use std::ffi::{OsStr, OsString};

    use windows_service::{
        service::{ServiceAccess, ServiceErrorControl, ServiceInfo, ServiceStartType, ServiceState, ServiceType},
        service_manager::{ServiceManager, ServiceManagerAccess},
    };

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());
    let data_dir = data_dir_from_log_dir(log_dir)?;
    let core_dir = resolve_core_dir(core_dir)?;

    log::debug!("Start installing Clash Verge Self Service.");

    log::debug!("Connecting to the service manager.");
    let manager_access = ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE;
    let service_manager = ServiceManager::local_computer(None::<&str>, manager_access)
        .map_err(|e| ServiceError::General(e.to_string()))?;

    log::debug!("Checking if the service is installed and active，delete it if exists");
    let service_access = ServiceAccess::QUERY_STATUS | ServiceAccess::STOP | ServiceAccess::DELETE;
    if let Ok(service) = service_manager.open_service("clash_verge_self_service", service_access) {
        log::debug!("The service is installed, stop and delete it first");
        if let Ok(status) = service.query_status() {
            if status.current_state != ServiceState::Stopped {
                log::debug!("Service status is not stopped, stopping it first.");
                if let Err(err) = service.stop() {
                    log::error!("Failed to stop service: {err}");
                }
                // Wait for service to stop
                std::thread::sleep(std::time::Duration::from_secs(1));
            }

            log::debug!("Deleting service");
            service.delete().map_err(|e| ServiceError::General(e.to_string()))?;
        }
    }

    let service_binary_path = std::env::current_exe()
        .unwrap()
        .with_file_name("clash-verge-self-service.exe");

    if !service_binary_path.exists() {
        log::error!("clash-verge-self-service.exe not found");
        std::process::exit(2);
    }

    // generate a fresh key only after any old service has been torn down
    let psk_path = provision_psk(&data_dir)?;

    let service_info = ServiceInfo {
        name: OsString::from("clash_verge_self_service"),
        display_name: OsString::from("Clash Verge Self Service"),
        service_type: ServiceType::OWN_PROCESS,
        start_type: ServiceStartType::AutoStart,
        error_control: ServiceErrorControl::Normal,
        executable_path: service_binary_path,
        launch_arguments: vec![
            OsString::from("--server-id"),
            OsString::from(server_id),
            OsString::from("--psk-path"),
            psk_path.into_os_string(),
            OsString::from("--core-dir"),
            core_dir.into_os_string(),
        ],
        dependencies: vec![],
        account_name: None, // run as System
        account_password: None,
    };

    log::debug!("Creating service: {service_info:?}");
    let start_access = ServiceAccess::CHANGE_CONFIG | ServiceAccess::START;
    let service = service_manager
        .create_service(&service_info, start_access)
        .map_err(|e| ServiceError::General(e.to_string()))?;

    log::debug!("Setting service description.");
    service
        .set_description("Clash Verge Self Service helps to launch clash core")
        .map_err(|e| ServiceError::General(e.to_string()))?;
    log::debug!("Starting service.");
    service
        .start(&Vec::<&OsStr>::new())
        .map_err(|e| ServiceError::General(e.to_string()))?;

    log::debug!("Service installed successfully.");
    Ok(())
}
