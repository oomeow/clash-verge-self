use anyhow::Result;
use clash_verge_self_service::DEFAULT_SERVER_ID;

#[cfg(not(any(windows, target_os = "linux", target_os = "macos")))]
pub fn process(_server_id: Option<String>) -> Result<()> {
    log::error!("Unsupported platform");
    anyhow::bail!("This program is not intended to run on this platform.");
}

#[cfg(target_os = "macos")]
pub fn process(server_id: Option<String>) -> Result<()> {
    use std::{fs::File, io::Write, path::Path};

    use anyhow::Context;

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());

    log::debug!("Start install Clash Verge Self Service.");

    // uninstall old service
    crate::uninstall::process()?;

    let service_binary_path = std::env::current_exe()
        .unwrap()
        .with_file_name("clash-verge-self-service");
    let target_binary_path = "/Library/PrivilegedHelperTools/io.github.clashvergeself.helper";
    log::debug!("Generate service file at {}", target_binary_path);
    let target_binary_dir = Path::new("/Library/PrivilegedHelperTools");
    if !service_binary_path.exists() {
        log::error!("The clash-verge-self-service binary not found.");
        std::process::exit(2);
    }
    if !target_binary_dir.exists() {
        log::debug!("Create directory for service file [{}].", target_binary_dir.display());
        std::fs::create_dir(target_binary_dir).context("Unable to create directory for service file")?;
    }

    log::debug!(
        "Copy service file from {} to {}",
        service_binary_path.display(),
        target_binary_path
    );
    std::fs::copy(service_binary_path, target_binary_path).context("Unable to copy service file")?;

    let plist_file = "/Library/LaunchDaemons/io.github.clashvergeself.helper.plist";
    log::debug!("Create plist file at {}", plist_file);
    let plist_file = Path::new(plist_file);
    let plist_file_content = format!(
        include_str!("../../../tmpl/io.github.clashvergeself.helper.plist"),
        server_id
    );
    let mut file = File::create(plist_file).context("Failed to create file for writing.")?;
    log::debug!("Create plist file done.");

    log::debug!("Write plist file content.");
    file.write_all(plist_file_content.as_bytes())
        .context("Unable to write plist file")?;
    log::debug!("Write plist file content done.");

    log::debug!("Chmod and chown plist file.");
    std::process::Command::new("chmod")
        .arg("644")
        .arg(plist_file)
        .output()
        .context("Failed to chmod")?;
    std::process::Command::new("chown")
        .arg("root:wheel")
        .arg(plist_file)
        .output()
        .context("Failed to chown")?;
    log::debug!("Chmod and chown plist file done.");

    log::debug!("Chmod and chown service file.");
    std::process::Command::new("chmod")
        .arg("544")
        .arg(target_binary_path)
        .output()
        .context("Failed to chmod")?;
    std::process::Command::new("chown")
        .arg("root:wheel")
        .arg(target_binary_path)
        .output()
        .context("Failed to chown")?;
    log::debug!("Chmod and chown service file done.");

    // Unload before load the service.
    log::debug!("Unload service before load the service.");
    std::process::Command::new("launchctl")
        .arg("unload")
        .arg(plist_file)
        .output()
        .context("Failed to unload service.")?;
    // Load the service.
    log::debug!("Load service.");
    std::process::Command::new("launchctl")
        .arg("load")
        .arg(plist_file)
        .output()
        .context("Failed to load service.")?;
    // Start the service.
    log::debug!("Start service.");
    std::process::Command::new("launchctl")
        .arg("start")
        .arg("io.github.clashvergeself.helper")
        .output()
        .context("Failed to load service.")?;

    log::debug!("Service installed successfully.");
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn process(server_id: Option<String>) -> Result<()> {
    use std::{fs::File, io::Write, path::Path};

    use anyhow::Context;
    use clash_verge_self_service::SERVICE_NAME;

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());

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
        .context("Failed to execute 'systemctl status' command")?
        .status
        .code();

    /*
     * https://www.freedesktop.org/software/systemd/man/latest/systemctl.html#Exit%20status
     */
    match status_code {
        Some(code) => match code {
            0..=3 => {
                log::debug!("The service is already installed, uninstall it first");
                crate::uninstall::process()?;
            }
            4 => {
                log::debug!("The service status is unknown, continue to install. (status code: 4)")
            }
            _ => {
                log::error!("Unexpected status code from systemctl status");
                anyhow::bail!("Unexpected status code from systemctl status")
            }
        },
        None => {
            log::error!("systemctl was improperly terminated.");
            anyhow::bail!("systemctl was improperly terminated.");
        }
    }

    let unit_file = format!("/etc/systemd/system/{SERVICE_NAME}.service");

    log::debug!("Generating service file [{unit_file}].");
    let unit_file = Path::new(&unit_file);
    let unit_file_content = format!(
        include_str!("../../../tmpl/systemd_service_unit.tmpl"),
        service_binary_path.to_str().unwrap(),
        server_id
    );
    let mut file = File::create(unit_file).context("Failed to create file for writing")?;
    file.write_all(unit_file_content.as_bytes())
        .context("Failed to write to file")?;
    log::debug!("Generated service file done.");

    // Reload unit files and start service.
    log::debug!("Reloading unit files and start service.");
    std::process::Command::new("systemctl")
        .arg("daemon-reload")
        .output()
        .context("Failed to reload unit files")?;
    std::process::Command::new("systemctl")
        .arg("enable")
        .arg(SERVICE_NAME)
        .arg("--now")
        .output()
        .context("Failed to start service")?;

    log::debug!("Service installed successfully.");
    Ok(())
}

/// install and start the service
#[cfg(windows)]
pub fn process(server_id: Option<String>) -> Result<()> {
    use std::ffi::{OsStr, OsString};

    use windows_service::{
        service::{ServiceAccess, ServiceErrorControl, ServiceInfo, ServiceStartType, ServiceState, ServiceType},
        service_manager::{ServiceManager, ServiceManagerAccess},
    };

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());

    log::debug!("Start installing Clash Verge Self Service.");

    log::debug!("Connecting to the service manager.");
    let manager_access = ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE;
    let service_manager = ServiceManager::local_computer(None::<&str>, manager_access)?;

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
            service.delete()?;
        }
    }

    let service_binary_path = std::env::current_exe()
        .unwrap()
        .with_file_name("clash-verge-self-service.exe");

    if !service_binary_path.exists() {
        log::error!("clash-verge-self-service.exe not found");
        std::process::exit(2);
    }

    let service_info = ServiceInfo {
        name: OsString::from("clash_verge_self_service"),
        display_name: OsString::from("Clash Verge Self Service"),
        service_type: ServiceType::OWN_PROCESS,
        start_type: ServiceStartType::AutoStart,
        error_control: ServiceErrorControl::Normal,
        executable_path: service_binary_path,
        launch_arguments: vec![OsString::from("--server-id"), OsString::from(server_id)],
        dependencies: vec![],
        account_name: None, // run as System
        account_password: None,
    };

    log::debug!("Creating service: {service_info:?}");
    let start_access = ServiceAccess::CHANGE_CONFIG | ServiceAccess::START;
    let service = service_manager.create_service(&service_info, start_access)?;

    log::debug!("Setting service description.");
    service.set_description("Clash Verge Self Service helps to launch clash core")?;
    log::debug!("Starting service.");
    service.start(&Vec::<&OsStr>::new())?;

    log::debug!("Service installed successfully.");
    Ok(())
}
