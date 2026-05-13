use std::{collections::VecDeque, env::current_exe, path::PathBuf};

use anyhow::{Context, Result};
use clash_verge_self_service::model::{ClashRunInfo, JsonResponse, SocketCommand, StartBody};
use serde::de::DeserializeOwned;

use super::SERVER_ID;
use crate::{MIHOMO_SOCKET_PATH, config::Config, utils::dirs};

async fn send_command<T: DeserializeOwned>(cmd: SocketCommand) -> Result<JsonResponse<T>> {
    let psk =
        option_env!("CLASH_VERGE_SELF_SERVICE_PSK").map_or(clash_verge_self_service::DEFAULT_PSK, |v| v.as_bytes());
    let mut client = clash_verge_self_service::Client::connect(SERVER_ID, Some(psk))
        .await
        .context("failed to connect to service server")?;
    let response = client
        .send::<T>(cmd)
        .await
        .context("failed to send request to service server")?;
    Ok(response)
}

/// check the windows service status
pub async fn check_service() -> Result<JsonResponse<ClashRunInfo>> {
    match send_command::<ClashRunInfo>(SocketCommand::GetClash).await {
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
pub(in crate::core) async fn run_core_by_service(config_file: &PathBuf, log_path: &PathBuf) -> Result<()> {
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
    let bin_path = dirs::path_to_str(&bin_path)?;

    let config_dir = dirs::app_home_dir()?;
    let config_dir = dirs::path_to_str(&config_dir)?;
    let config_file = dirs::path_to_str(config_file)?;
    let log_path = dirs::path_to_str(log_path)?;
    let mihomo_pid_file = dirs::mihomo_pid_file()?;
    let pid_file = dirs::path_to_str(&mihomo_pid_file)?;

    let body = StartBody {
        core_type: Some(clash_core),
        socket_path: Some(MIHOMO_SOCKET_PATH.to_string()),
        bin_path: bin_path.to_string(),
        config_dir: config_dir.to_string(),
        pid_file: pid_file.to_string(),
        config_file: config_file.to_string(),
        log_file: log_path.to_string(),
    };
    tracing::debug!("send start clash socket command, body: {:?}", body);
    let res = send_command::<()>(SocketCommand::StartClash(body)).await?;
    if res.code != 0 {
        anyhow::bail!("socket command [StartClash] return error: {}", res.msg);
    }

    Ok(())
}

/// stop the clash by service
pub(in crate::core) async fn stop_core_by_service() -> Result<()> {
    let res = send_command::<()>(SocketCommand::StopClash).await?;
    if res.code != 0 {
        anyhow::bail!("socket command [StopClash] return error: {}", res.msg);
    }
    Ok(())
}

pub async fn get_logs() -> Result<JsonResponse<VecDeque<String>>> {
    let res = send_command::<VecDeque<String>>(SocketCommand::GetLogs).await?;
    if res.code != 0 {
        anyhow::bail!("socket command [GetLogs] return error: {}", res.msg);
    }
    Ok(res)
}

/// stop the service
pub async fn stop_service() -> Result<()> {
    let res = send_command::<()>(SocketCommand::StopService).await?;
    if res.code != 0 {
        anyhow::bail!("socket command [StopService] return error: {}", res.msg);
    }
    Ok(())
}
