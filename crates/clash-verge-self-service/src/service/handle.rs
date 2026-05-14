use std::{collections::VecDeque, ffi::OsString, sync::Arc, time::Duration};

use anyhow::{Result, bail};
use clash_verge_self_utils::format_raw_mihomo_log_line;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use process_supervisor::{ProcessEvent, ProcessLogConfig, ProcessSpec, ProcessSupervisor, RestartPolicy};
use serde::{Deserialize, Serialize};

use super::data::*;
use crate::service::logger::Logger;

const MAX_RESTART_CORE_COUNT: usize = 10;
const CORE_RESTART_INTERVAL: Duration = Duration::from_secs(1);

#[derive(Debug, Clone)]
pub struct ClashStatus {
    pub sidecar: ProcessSupervisor,
    pub info: Arc<Mutex<Option<StartBody>>>,
}

impl ClashStatus {
    pub fn global() -> &'static ClashStatus {
        static CLASHSTATUS: OnceCell<ClashStatus> = OnceCell::new();
        CLASHSTATUS.get_or_init(|| ClashStatus {
            sidecar: ProcessSupervisor::new(Some(Arc::new(Self::handle_sidecar_event))),
            info: Arc::new(Mutex::new(None)),
        })
    }

    fn handle_sidecar_event(event: ProcessEvent) {
        match event {
            ProcessEvent::Stdout { line, .. } | ProcessEvent::Stderr { line, .. } => {
                Logger::global().append_log(line);
            }
            ProcessEvent::RestartLimitReached { .. } => {
                log::error!("recover clash core count exceeded, skip");
            }
            _ => {}
        }
    }
}

/// 获取服务进程的版本
pub fn get_version() -> Result<ServiceVersionInfo> {
    let version = env!("CARGO_PKG_VERSION");
    Ok(ServiceVersionInfo {
        version: version.into(),
        service: "Clash Verge Self Service".into(),
    })
}

async fn run_core(body: StartBody) -> Result<()> {
    let StartBody {
        core_type: _,
        socket_path,
        bin_path,
        config_dir,
        pid_file,
        config_file,
        log_file,
    } = body;
    let mut spec = ProcessSpec::new("mihomo", bin_path).with_pid_file(pid_file);
    spec.args = vec![
        OsString::from("-d"),
        OsString::from(config_dir),
        OsString::from("-f"),
        OsString::from(config_file),
    ];
    if let Some(socket_path) = socket_path {
        spec.args.push(OsString::from(if cfg!(unix) {
            "-ext-ctl-unix"
        } else {
            "-ext-ctl-pipe"
        }));
        spec.args.push(OsString::from(socket_path));
    }

    spec.restart_policy = RestartPolicy {
        max_restarts: MAX_RESTART_CORE_COUNT,
        restart_delay: CORE_RESTART_INTERVAL,
    };
    spec.log_config = ProcessLogConfig {
        log_file: Some(log_file.into()),
        truncate_on_start: false,
        line_formatter: Some(Arc::new(format_raw_mihomo_log_line)),
    };
    ClashStatus::global().sidecar.start(spec).await?;

    Ok(())
}

/// 启动 clash 进程
pub async fn start_clash(body: StartBody) -> Result<()> {
    log::debug!("start clash {body:?}");
    stop_clash().await?;
    {
        let clash_status = ClashStatus::global();
        *clash_status.info.lock() = Some(body.clone());
    }
    log::debug!("run clash core");
    run_core(body).await?;

    Ok(())
}

/// 停止 clash 进程
pub async fn stop_clash() -> Result<()> {
    log::debug!("stop clash");
    let clash_status = ClashStatus::global();
    clash_status.sidecar.stop().await?;
    Logger::global().clear_log();
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClashRunInfo {
    info: Option<StartBody>,
    is_running: bool,
    pid: Option<u32>,
    restart_count: usize,
}

/// 获取 clash 当前执行信息
pub fn get_clash() -> Result<ClashRunInfo> {
    let clash_status = ClashStatus::global();
    let info = clash_status.info.lock().clone();
    let pid = clash_status.sidecar.pid();
    let restart_count = clash_status.sidecar.restart_count();
    let is_running = clash_status.sidecar.is_running();
    if info.is_none() || !is_running {
        bail!("clash not executed");
    }
    Ok(ClashRunInfo {
        info,
        pid,
        is_running,
        restart_count,
    })
}

/// 获取 logs
pub fn get_logs() -> Result<VecDeque<String>> {
    Ok(Logger::global().get_log())
}
