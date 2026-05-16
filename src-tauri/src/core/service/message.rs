use std::{collections::VecDeque, env::current_exe, path::PathBuf, process::Command as StdCommand};

use anyhow::{Context, Result, anyhow};
use clash_verge_self_service::model::{ClashRunInfo, JsonResponse, SocketCommand, StartBody};
use serde::de::DeserializeOwned;

use super::SERVER_ID;
use crate::{MIHOMO_SOCKET_PATH, config::Config, utils::dirs};

async fn send_command<T: DeserializeOwned + Send + 'static>(cmd: SocketCommand) -> Result<JsonResponse<T>> {
    tokio::task::spawn_blocking(move || run_helper_command(cmd))
        .await
        .context("failed to join helper command task")?
}

fn run_helper_command<T: DeserializeOwned>(cmd: SocketCommand) -> Result<JsonResponse<T>> {
    let helper_path = dirs::service_bin_path()?;
    if !helper_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let mut command = StdCommand::new(helper_path);
    command.arg("--server-id").arg(SERVER_ID);
    command.args(build_rpc_args(cmd)?);

    let output = command.output().context("failed to execute service helper")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let status = output.status.code();
        if stderr.is_empty() {
            anyhow::bail!("service helper exited with status {:?}", status);
        }
        anyhow::bail!("service helper exited with status {:?}: {}", status, stderr);
    }

    parse_helper_response(&output.stdout)
}

fn parse_helper_response<T: DeserializeOwned>(stdout: &[u8]) -> Result<JsonResponse<T>> {
    let stdout = std::str::from_utf8(stdout).context("service helper stdout is not valid utf-8")?;
    let stdout = stdout.trim();
    if stdout.is_empty() {
        anyhow::bail!("service helper returned empty stdout");
    }
    serde_json::from_str(stdout).map_err(|err| anyhow!("failed to parse service helper response: {err}"))
}

fn build_rpc_args(cmd: SocketCommand) -> Result<Vec<String>> {
    let mut args = vec!["rpc".to_string()];
    match cmd {
        SocketCommand::GetVersion => args.push("get-version".to_string()),
        SocketCommand::GetClash => args.push("get-clash".to_string()),
        SocketCommand::GetLogs => args.push("get-logs".to_string()),
        SocketCommand::StopClash => args.push("stop-clash".to_string()),
        SocketCommand::StopService => args.push("stop-service".to_string()),
        SocketCommand::StartClash(body) => {
            args.push("start-clash".to_string());
            args.push("--payload".to_string());
            args.push(serde_json::to_string(&body).context("failed to serialize start clash payload")?);
        }
    }

    Ok(args)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_helper_response_returns_json_payload() {
        let stdout = br#"{"code":0,"msg":"ok","data":{"info":{"core_type":"self-mihomo","socket_path":"mihomo.sock","bin_path":"mihomo","config_dir":"config","pid_file":"mihomo.pid","config_file":"config.yaml","log_file":"clash.log"},"is_running":true,"pid":42,"restart_count":0}}"#;

        let response = parse_helper_response::<ClashRunInfo>(stdout).expect("response should parse");

        assert_eq!(response.code, 0);
        assert_eq!(response.msg, "ok");
        assert!(response.data.is_some());
    }

    #[test]
    fn build_start_clash_args_serializes_body() {
        let body = StartBody {
            core_type: Some("self-mihomo".into()),
            socket_path: Some("mihomo.sock".into()),
            bin_path: "/tmp/mihomo".into(),
            config_dir: "/tmp/config".into(),
            pid_file: "/tmp/mihomo.pid".into(),
            config_file: "/tmp/config.yaml".into(),
            log_file: "/tmp/clash.log".into(),
        };

        let args = build_rpc_args(SocketCommand::StartClash(body)).expect("args should build");

        assert_eq!(args[0], "rpc");
        assert_eq!(args[1], "start-clash");
        assert_eq!(args[2], "--payload");
        let payload = serde_json::from_str::<StartBody>(&args[3]).expect("payload should deserialize");
        assert_eq!(payload.core_type.as_deref(), Some("self-mihomo"));
        assert_eq!(payload.bin_path, "/tmp/mihomo");
    }
}
