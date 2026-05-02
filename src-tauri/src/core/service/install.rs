use std::process::Command as StdCommand;

use anyhow::Result;

use super::SERVER_ID;
use crate::utils::dirs;

/// Install the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
///
#[cfg(target_os = "windows")]
pub async fn install_service() -> Result<()> {
    use std::os::windows::process::CommandExt;

    use deelevate::{PrivilegeLevel, Token};
    use runas::Command as RunasCommand;

    let install_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", install_path.display());
    if !install_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let token = Token::with_current_process()?;
    let level = token.privilege_level()?;

    let status = match level {
        PrivilegeLevel::NotPrivileged => RunasCommand::new(install_path)
            .arg("install")
            .arg("--log-dir")
            .arg(log_dir)
            .arg("--server-id")
            .arg(SERVER_ID)
            .show(false)
            .status()?,
        _ => StdCommand::new(install_path)
            .arg("install")
            .arg("--log-dir")
            .arg(log_dir)
            .creation_flags(0x08000000)
            .status()?,
    };

    if !status.success() {
        anyhow::bail!("failed to install service with status {:?}", status.code());
    }

    Ok(())
}

#[cfg(target_os = "linux")]
pub async fn install_service() -> Result<()> {
    use users::get_effective_uid;

    let installer_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", installer_path.display());
    if !installer_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    tracing::debug!("log dir: {}", log_dir.display());

    let elevator = crate::utils::unix_helper::linux_elevator();
    let status = match get_effective_uid() {
        0 => StdCommand::new(installer_path)
            .arg("install")
            .arg("--log-dir")
            .arg(&log_dir)
            .arg("--server-id")
            .arg(SERVER_ID)
            .status()?,
        _ => {
            let execute_cmd = format!(
                "{} install --log-dir {} --server-id {}",
                installer_path.display(),
                log_dir.display(),
                SERVER_ID
            );
            StdCommand::new(elevator)
                .arg("sh")
                .arg("-c")
                .arg(execute_cmd)
                .status()?
        }
    };

    if !status.success() {
        anyhow::bail!("failed to install service with status {:?}", status.code());
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub async fn install_service() -> Result<()> {
    let installer_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", installer_path.display());
    if !installer_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let shell = installer_path.to_string_lossy().replace(" ", "\\\\ ");
    let log_dir = log_dir.to_string_lossy().replace(" ", "\\\\ ");
    let command = format!(
        r#"do shell script "{} install --log-dir {} --server-id {}" with administrator privileges"#,
        shell, log_dir, SERVER_ID
    );

    let status = StdCommand::new("osascript").args(vec!["-e", &command]).status()?;

    if !status.success() {
        anyhow::bail!("failed to install service with status {:?}", status.code());
    }

    Ok(())
}

/// Uninstall the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
#[cfg(target_os = "windows")]
pub async fn uninstall_service() -> Result<()> {
    use std::os::windows::process::CommandExt;

    use deelevate::{PrivilegeLevel, Token};
    use runas::Command as RunasCommand;

    let uninstall_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstall_path.display());
    if !uninstall_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let token = Token::with_current_process()?;
    let level = token.privilege_level()?;

    let status = match level {
        PrivilegeLevel::NotPrivileged => RunasCommand::new(uninstall_path)
            .arg("uninstall")
            .arg("--log-dir")
            .arg(log_dir)
            .show(false)
            .status()?,
        _ => StdCommand::new(uninstall_path)
            .arg("uninstall")
            .arg("--log-dir")
            .arg(log_dir)
            .creation_flags(0x08000000)
            .status()?,
    };

    if !status.success() {
        anyhow::bail!("failed to uninstall service with status {:?}", status.code());
    }

    Ok(())
}

#[cfg(target_os = "linux")]
pub async fn uninstall_service() -> Result<()> {
    use users::get_effective_uid;

    let uninstaller_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstaller_path.display());
    if !uninstaller_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let elevator = crate::utils::unix_helper::linux_elevator();
    let status = match get_effective_uid() {
        0 => StdCommand::new(uninstaller_path)
            .arg("uninstall")
            .arg("--log-dir")
            .arg(log_dir)
            .status()?,
        _ => {
            let execute_cmd = format!(
                "{} uninstall --log-dir {}",
                uninstaller_path.display(),
                log_dir.display()
            );
            StdCommand::new(elevator)
                .arg("sh")
                .arg("-c")
                .arg(execute_cmd)
                .status()?
        }
    };

    if !status.success() {
        anyhow::bail!("failed to uninstall service with status {:?}", status.code());
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub async fn uninstall_service() -> Result<()> {
    let uninstaller_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstaller_path.display());
    if !uninstaller_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let shell = uninstaller_path.to_string_lossy().replace(" ", "\\\\ ");
    let log_dir = log_dir.to_string_lossy().replace(" ", "\\\\ ");
    let command = format!(
        r#"do shell script "{} uninstall --log-dir {}" with administrator privileges"#,
        shell, log_dir
    );

    let status = StdCommand::new("osascript").args(vec!["-e", &command]).status()?;

    if !status.success() {
        anyhow::bail!("failed to uninstall service with status {:?}", status.code());
    }

    Ok(())
}
