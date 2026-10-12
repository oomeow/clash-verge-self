use std::{collections::VecDeque, ffi::OsString, path::Path, sync::Arc, time::Duration};

use clash_verge_self_utils::format_raw_mihomo_log_line;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use process_supervisor::{ProcessEvent, ProcessLogConfig, ProcessSpec, ProcessSupervisor, RestartPolicy};
use serde::{Deserialize, Serialize};

use super::data::*;
use crate::{ALLOWED_CORES, Result, ServiceError, service::logger::Logger};

const MAX_RESTART_CORE_COUNT: usize = 10;
const CORE_RESTART_INTERVAL: Duration = Duration::from_secs(1);

/// Directory holding the app executable and its core sidecars, pinned at install time.
static CORE_DIR: OnceCell<std::path::PathBuf> = OnceCell::new();

/// Record the directory the service is allowed to launch cores from.
pub fn set_core_dir(core_dir: &Path) {
    if CORE_DIR.set(core_dir.to_path_buf()).is_err() {
        log::warn!("core dir already set, ignoring {}", core_dir.display());
    }
}

fn core_dir() -> Result<&'static Path> {
    CORE_DIR
        .get()
        .map(std::path::PathBuf::as_path)
        .ok_or_else(|| ServiceError::General("core dir is not configured, reinstall the service".into()))
}

/// Resolve a core slot name to a concrete binary inside `core_dir`.
///
/// Only [`ALLOWED_CORES`] are accepted, and the resolved file must stay inside
/// `core_dir` after canonicalization (which defeats symlink escapes) and be a
/// regular file. This is what keeps a malicious client from turning `StartClash`
/// into arbitrary code execution as root.
fn resolve_core_bin_from(core_dir: &Path, core_type: &str) -> Result<std::path::PathBuf> {
    if !ALLOWED_CORES.contains(&core_type) {
        return Err(ServiceError::General(format!("core type not allowed: {core_type}")));
    }

    let core_dir = core_dir
        .canonicalize()
        .map_err(|e| ServiceError::General(format!("invalid core dir {}: {e}", core_dir.display())))?;
    let candidate = core_dir.join(format!("{core_type}{}", std::env::consts::EXE_SUFFIX));
    let bin = candidate
        .canonicalize()
        .map_err(|e| ServiceError::General(format!("core binary not found at {}: {e}", candidate.display())))?;

    if bin.parent() != Some(core_dir.as_path()) {
        return Err(ServiceError::General(format!(
            "core binary {} is outside the core dir {}",
            bin.display(),
            core_dir.display()
        )));
    }

    let meta =
        std::fs::metadata(&bin).map_err(|e| ServiceError::General(format!("failed to stat core binary: {e}")))?;
    if !meta.is_file() {
        return Err(ServiceError::General(format!(
            "core binary {} is not a regular file",
            bin.display()
        )));
    }

    Ok(bin)
}

fn resolve_core_bin(core_type: &str) -> Result<std::path::PathBuf> {
    resolve_core_bin_from(core_dir()?, core_type)
}

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
        core_type,
        socket_path,
        config_dir,
        pid_file,
        config_file,
        log_file,
        log_roll_size_mb,
        log_max_keep_files,
    } = body;
    let core_type = core_type.ok_or_else(|| ServiceError::General("missing core type".into()))?;
    // Never trust a caller-supplied path: resolve the core from the pinned app dir.
    let bin_path = resolve_core_bin(&core_type)?;
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
        log_roll_size: log_roll_size_mb,
        log_max_keep_files,
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
        return Err(ServiceError::General("clash not executed".into()));
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

#[cfg(test)]
mod tests {
    use std::fs;

    use super::resolve_core_bin_from;

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("cvs-core-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn core_name(slot: &str) -> String {
        format!("{slot}{}", std::env::consts::EXE_SUFFIX)
    }

    #[test]
    fn resolves_allowed_core_inside_core_dir() {
        let dir = temp_dir("ok");
        let bin = dir.join(core_name("self-mihomo"));
        fs::write(&bin, b"x").unwrap();

        let resolved = resolve_core_bin_from(&dir, "self-mihomo").unwrap();
        assert_eq!(resolved, dir.canonicalize().unwrap().join(core_name("self-mihomo")));

        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_unknown_core_type() {
        let dir = temp_dir("badtype");
        let err = resolve_core_bin_from(&dir, "sh").unwrap_err();
        assert!(format!("{err}").contains("not allowed"));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_missing_core() {
        let dir = temp_dir("missing");
        assert!(resolve_core_bin_from(&dir, "self-mihomo").is_err());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_core_escaping_core_dir_via_symlink() {
        use std::os::unix::fs::symlink;

        let dir = temp_dir("escape");
        let outside = temp_dir("escape-target");
        let target = outside.join("evil");
        fs::write(&target, b"evil").unwrap();
        symlink(&target, dir.join(core_name("self-mihomo"))).unwrap();

        assert!(resolve_core_bin_from(&dir, "self-mihomo").is_err());

        fs::remove_dir_all(&dir).unwrap();
        fs::remove_dir_all(&outside).unwrap();
    }
}
