use std::{collections::VecDeque, env::current_exe, path::PathBuf, process::Command as StdCommand};

use clash_verge_self_service::model::{ClashStatus, JsonResponse, SocketCommand, StartBody};
use serde::de::DeserializeOwned;

use crate::{
    MIHOMO_SOCKET_PATH, any_err,
    config::Config,
    error::{AppError, AppResult},
};

/// Install the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
///
#[cfg(target_os = "windows")]
pub async fn install_service() -> AppResult<()> {
    use std::os::windows::process::CommandExt;

    use deelevate::{PrivilegeLevel, Token};
    use runas::Command as RunasCommand;

    let install_path = cvs_dirs::service_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", install_path.display());
    if !install_path.exists() {
        return Err(AppError::Service("clash-verge-self-service file not found".to_string()));
    }

    let log_dir = cvs_dirs::app_logs_dir()?.join("service");
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
        return Err(AppError::Service(format!(
            "failed to install service with status {:?}",
            status.code()
        )));
    }

    Ok(())
}

#[cfg(target_os = "linux")]
pub async fn install_service() -> AppResult<()> {
    use users::get_effective_uid;

    let installer_path = cvs_dirs::service_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", installer_path.display());
    if !installer_path.exists() {
        return Err(AppError::Service("clash-verge-self-service file not found".to_string()));
    }

    let log_dir = cvs_dirs::app_logs_dir()?.join("service");
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
        return Err(AppError::Service(format!(
            "failed to install service with status {:?}",
            status.code()
        )));
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub async fn install_service() -> AppResult<()> {
    let installer_path = cvs_dirs::service_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", installer_path.display());
    if !installer_path.exists() {
        return Err(AppError::Service("clash-verge-self-service file not found".to_string()));
    }

    let log_dir = cvs_dirs::app_logs_dir()?.join("service");
    let shell = installer_path.to_string_lossy().replace(" ", "\\\\ ");
    let log_dir = log_dir.to_string_lossy().replace(" ", "\\\\ ");
    let command = format!(
        r#"do shell script "{} install --log-dir {} --server-id {}" with administrator privileges"#,
        shell, log_dir, SERVER_ID
    );

    let status = StdCommand::new("osascript").args(vec!["-e", &command]).status()?;

    if !status.success() {
        return Err(AppError::Service(format!(
            "failed to install service with status {:?}",
            status.code()
        )));
    }

    Ok(())
}
/// Uninstall the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
#[cfg(target_os = "windows")]
pub async fn uninstall_service() -> AppResult<()> {
    use std::os::windows::process::CommandExt;

    use deelevate::{PrivilegeLevel, Token};
    use runas::Command as RunasCommand;

    let uninstall_path = cvs_dirs::service_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstall_path.display());
    if !uninstall_path.exists() {
        return Err(AppError::Service("clash-verge-self-service file not found".to_string()));
    }

    let log_dir = cvs_dirs::app_logs_dir()?.join("service");
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
        return Err(AppError::Service(format!(
            "failed to uninstall service with status {:?}",
            status.code()
        )));
    }

    Ok(())
}

#[cfg(target_os = "linux")]
pub async fn uninstall_service() -> AppResult<()> {
    use users::get_effective_uid;

    let uninstaller_path = cvs_dirs::service_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstaller_path.display());
    if !uninstaller_path.exists() {
        return Err(AppError::Service("clash-verge-self-service file not found".to_string()));
    }

    let log_dir = cvs_dirs::app_logs_dir()?.join("service");
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
        return Err(AppError::Service(format!(
            "failed to uninstall service with status {:?}",
            status.code()
        )));
    }

    Ok(())
}

#[cfg(target_os = "macos")]
pub async fn uninstall_service() -> AppResult<()> {
    let uninstaller_path = cvs_dirs::service_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstaller_path.display());
    if !uninstaller_path.exists() {
        return Err(AppError::Service("clash-verge-self-service file not found".to_string()));
    }

    let log_dir = cvs_dirs::app_logs_dir()?.join("service");
    let shell = uninstaller_path.to_string_lossy().replace(" ", "\\\\ ");
    let log_dir = log_dir.to_string_lossy().replace(" ", "\\\\ ");
    let command = format!(
        r#"do shell script "{} uninstall --log-dir {}" with administrator privileges"#,
        shell, log_dir
    );

    let status = StdCommand::new("osascript").args(vec!["-e", &command]).status()?;

    if !status.success() {
        return Err(AppError::Service(format!(
            "failed to uninstall service with status {:?}",
            status.code()
        )));
    }

    Ok(())
}

// #[cfg(not(feature = "verge-dev"))]
const SERVER_ID: &str = "verge-service-server";
// #[cfg(feature = "verge-dev")]
// const SERVER_ID: &str = "verge-service-server-dev";

async fn send_command<T: DeserializeOwned>(cmd: SocketCommand) -> AppResult<JsonResponse<T>> {
    let psk = option_env!("CLASH_VERGE_SELF_SERVICE_PSK").map_or(clash_verge_self_service::PSK, |v| v.as_bytes());
    let mut client = clash_verge_self_service::Client::connect(SERVER_ID, Some(psk))
        .await
        .map_err(|e| any_err!("failed to connect to service serve: {e}"))?;
    let response = client
        .send::<T>(cmd)
        .await
        .map_err(|e| any_err!("failed to send request to service serve: {e}"))?;
    Ok(response)
}

/// check the windows service status
pub async fn check_service() -> AppResult<JsonResponse<ClashStatus>> {
    match send_command::<ClashStatus>(SocketCommand::GetClash).await {
        Ok(res) => {
            tracing::info!("connect to service success");
            Ok(res)
        }
        Err(e) => {
            tracing::error!("connect to service failed, error: {e}");
            Err(e)
        }
    }
}

/// start the clash by service
pub(super) async fn run_core_by_service(config_file: &PathBuf, log_path: &PathBuf) -> AppResult<()> {
    check_service().await?;
    stop_core_by_service().await?;

    let clash_core = Config::verge()
        .latest()
        .clash_core
        .clone()
        .unwrap_or("self-mihomo".to_string());

    let exe_ext = std::env::consts::EXE_SUFFIX;
    let clash_bin = format!("{clash_core}{exe_ext}");
    let bin_path = current_exe()?.with_file_name(clash_bin);
    let bin_path = cvs_dirs::path_to_str(&bin_path)?;

    let config_dir = cvs_dirs::app_home_dir()?;
    let config_dir = cvs_dirs::path_to_str(&config_dir)?;
    let config_file = cvs_dirs::path_to_str(config_file)?;
    let log_path = cvs_dirs::path_to_str(log_path)?;

    let body = StartBody {
        core_type: Some(clash_core),
        socket_path: Some(MIHOMO_SOCKET_PATH.to_string()),
        bin_path: bin_path.to_string(),
        config_dir: config_dir.to_string(),
        config_file: config_file.to_string(),
        log_file: log_path.to_string(),
    };
    tracing::debug!("send start clash socket command, body: {:?}", body);
    let res = send_command::<()>(SocketCommand::StartClash(body)).await?;
    if res.code != 0 {
        return Err(AppError::Service(format!(
            "socket command [StartClash] return error: {}",
            res.msg
        )));
    }

    Ok(())
}

/// stop the clash by service
pub(super) async fn stop_core_by_service() -> AppResult<()> {
    let res = send_command::<()>(SocketCommand::StopClash).await?;
    if res.code != 0 {
        return Err(AppError::Service(format!(
            "socket command [StopClash] return error: {}",
            res.msg
        )));
    }
    Ok(())
}

pub async fn get_logs() -> AppResult<JsonResponse<VecDeque<String>>> {
    let res = send_command::<VecDeque<String>>(SocketCommand::GetLogs).await?;
    if res.code != 0 {
        return Err(AppError::Service(format!(
            "socket command [GetLogs] return error: {}",
            res.msg
        )));
    }
    Ok(res)
}

/// stop the service
pub async fn stop_service() -> AppResult<()> {
    let res = send_command::<()>(SocketCommand::StopService).await?;
    if res.code != 0 {
        return Err(AppError::Service(format!(
            "socket command [StopService] return error: {}",
            res.msg
        )));
    }
    Ok(())
}
