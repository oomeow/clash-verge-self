use std::{collections::VecDeque, path::PathBuf};

use anyhow::{Context, Result};
use clash_verge_self_service::model::{ClashRunInfo, JsonResponse, SocketCommand, StartBody};
use serde::de::DeserializeOwned;

use super::SERVER_ID;
use crate::{MIHOMO_SOCKET_PATH, config::Config, utils::dirs};

async fn send_command<T: DeserializeOwned>(cmd: SocketCommand) -> Result<JsonResponse<T>> {
    let psk_path = dirs::service_psk_path()?;
    let psk = clash_verge_self_service::read_psk(&psk_path).with_context(|| {
        format!(
            "service key not found at {}, please reinstall the service",
            psk_path.display()
        )
    })?;
    let mut client = clash_verge_self_service::Client::connect(SERVER_ID, &psk)
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

    let config_dir = dirs::app_home_dir()?;
    let config_dir = dirs::path_to_str(&config_dir)?;
    let config_file = dirs::path_to_str(config_file)?;
    let log_path = dirs::path_to_str(log_path)?;
    let mihomo_pid_file = dirs::mihomo_pid_file()?;
    let pid_file = dirs::path_to_str(&mihomo_pid_file)?;

    let body = StartBody {
        core_type: Some(clash_core),
        socket_path: Some(MIHOMO_SOCKET_PATH.to_string()),
        config_dir: config_dir.to_string(),
        pid_file: pid_file.to_string(),
        config_file: config_file.to_string(),
        log_file: log_path.to_string(),
        log_roll_size_mb: Some(Config::verge().latest().get_log_roll_size_mb()),
        log_max_keep_files: Some(Config::verge().latest().get_log_max_keep_files()),
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
