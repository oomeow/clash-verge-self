use std::{
    ffi::OsString,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use anyhow::{Context, Result};
use clash_verge_self_utils::format_mihomo_log_line;
use once_cell::sync::OnceCell;
use process_supervisor::{ProcessEvent, ProcessLogConfig, ProcessSpec, ProcessSupervisor, RestartPolicy};
use serde_yaml::Mapping;
use tauri::utils::platform::current_exe;
use tauri_plugin_shell::ShellExt;

use super::verge_log::VergeLog;
use crate::{
    MIHOMO_SOCKET_PATH,
    config::*,
    core::{handle, logger::Logger, service},
    log_err, utils,
    utils::{dirs, help::find_unused_port},
};

const MAX_RESTART_CORE_COUNT: usize = 5;
const CORE_RESTART_INTERVAL: Duration = Duration::from_secs(1);
const CLASH_CORES: [&str; 2] = ["self-mihomo", "self-mihomo-alpha"];

#[derive(Debug)]
pub struct CoreManager {
    /// managed clash sidecar process
    sidecar: ProcessSupervisor,

    /// true if clash core is running in service mode
    use_service_mode: AtomicBool,
}

impl CoreManager {
    pub fn global() -> &'static CoreManager {
        static CORE_MANAGER: OnceCell<CoreManager> = OnceCell::new();

        CORE_MANAGER.get_or_init(|| CoreManager {
            sidecar: ProcessSupervisor::new(Some(Arc::new(Self::handle_sidecar_event))),
            use_service_mode: AtomicBool::new(false),
        })
    }

    pub fn init(&self) -> Result<()> {
        let enable_random_port = Config::verge().latest().enable_random_port.unwrap_or_default();
        if enable_random_port {
            let port = find_unused_port().unwrap_or(Config::clash().latest().get_mixed_port());
            let port_mapping = Mapping::from_iter([
                ("mixed-port".into(), port.into()),
                ("port".into(), 0.into()),
                ("socks-port".into(), 0.into()),
                ("redir-port".into(), 0.into()),
                ("tproxy-port".into(), 0.into()),
            ]);
            Config::clash().latest_mut().patch_config(port_mapping.clone());
            log_err!(Config::clash().latest().save_config());
            Config::runtime().latest_mut().patch_config(port_mapping);
        }

        tauri::async_runtime::spawn(async move {
            log_err!(Self::global().run_core().await);
        });

        Ok(())
    }

    /// 检查订阅是否正确
    pub async fn check_config(&self, generate_config_type: ConfigType) -> Result<()> {
        let config_path = Config::generate_file(generate_config_type)?;
        let config_path = dirs::path_to_str(&config_path)?;

        let app_dir = dirs::app_home_dir()?;
        let app_dir = dirs::path_to_str(&app_dir)?;
        let app_handle = handle::Handle::app_handle();
        let output = app_handle
            .shell()
            .sidecar(Self::clash_core_name())?
            .args(["-t", "-d", app_dir, "-f", config_path])
            .output()
            .await?;

        if !output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let error = utils::help::parse_check_output(&stdout);
            let error = if !error.is_empty() { error } else { &stdout };
            anyhow::bail!("{error}");
        }

        Ok(())
    }

    pub fn reset_state(&self) {
        self.sidecar.reset_restart_count();
    }

    /// 启动核心
    pub async fn run_core(&self) -> Result<()> {
        tracing::info!("run core");
        Logger::global().clear_logs();

        let config_path = Config::generate_file(ConfigType::Run)?;

        if self.sidecar.is_running() {
            tracing::info!("temporarily disable tun mode");
            self.disable_tun().await;
            tracing::info!("stop existing mihomo sidecar before restart");
            self.sidecar.stop().await?;
        }

        if self.use_service_mode.load(Ordering::SeqCst) {
            tracing::debug!("stop the core by service");
            log_err!(service::stop_core_by_service().await);
        }

        let enable_service_mode = Config::verge().latest().enable_service_mode.unwrap_or_default();
        self.use_service_mode.store(enable_service_mode, Ordering::SeqCst);

        if !self.try_run_core_by_service(&config_path).await? {
            self.prepare_sidecar_mode()?;
            self.sidecar.start(self.build_sidecar_spec(&config_path)?).await?;
        }

        Ok(())
    }

    /// 停止核心运行
    pub async fn stop_core(&self) -> Result<()> {
        tracing::info!("stop core");
        self.disable_tun().await;

        if self.use_service_mode.load(Ordering::SeqCst) {
            tracing::info!("stop the core by service");
            log_err!(service::stop_core_by_service().await);
            return Ok(());
        }

        self.sidecar.stop().await?;

        #[cfg(unix)]
        {
            tracing::debug!("remove mihomo socket file [{MIHOMO_SOCKET_PATH}]");
            if std::path::Path::new(MIHOMO_SOCKET_PATH).exists() {
                std::fs::remove_file(MIHOMO_SOCKET_PATH)?;
            }
        }
        Ok(())
    }

    /// 切换核心
    pub async fn change_core(&self, clash_core: Option<String>) -> Result<()> {
        let clash_core = clash_core.context("clash core is null")?;
        if !CLASH_CORES.contains(&clash_core.as_str()) {
            anyhow::bail!("invalid clash core name \"{clash_core}\"");
        }

        tracing::info!("change core to `{clash_core}`");
        Config::verge().draft().clash_core = Some(clash_core);

        match self.run_core().await {
            Ok(_) => {
                Config::verge().apply();
                Config::runtime().apply();
                self.reset_state();
                log_err!(Config::verge().latest().save_file());
                Ok(())
            }
            Err(err) => {
                Config::verge().discard();
                Config::runtime().discard();
                self.reset_state();
                Err(err)
            }
        }
    }

    /// 更新proxies那些
    /// 如果涉及端口和外部控制则需要重启
    pub async fn update_config(&self) -> Result<()> {
        tracing::info!("try to update clash config");

        tracing::info!("generate enhanced config");
        Config::generate()?;

        tracing::info!("check config");
        self.check_config(ConfigType::RuntimeCheck).await?;

        tracing::info!("finished update config, need to restart core");
        self.run_core().await
    }

    fn build_sidecar_spec(&self, config_path: &PathBuf) -> Result<ProcessSpec> {
        let app_dir = dirs::app_home_dir()?;
        let clash_core = Self::clash_core_name();
        let exe_name = format!("{clash_core}{}", std::env::consts::EXE_SUFFIX);
        let program = current_exe()?.with_file_name(exe_name);
        let config_path = dirs::path_to_str(config_path)?;
        let app_dir = dirs::path_to_str(&app_dir)?;
        // TODO:
        // let log_file = VergeLog::global().get_log_file().map(PathBuf::from);
        let log_file = dirs::clash_logs_dir()?.join(dirs::generate_log_file());

        let mut spec = ProcessSpec::new("mihomo", program);
        spec.args = vec![
            OsString::from("-d"),
            OsString::from(app_dir),
            OsString::from("-f"),
            OsString::from(config_path),
            OsString::from(if cfg!(unix) { "-ext-ctl-unix" } else { "-ext-ctl-pipe" }),
            OsString::from(MIHOMO_SOCKET_PATH),
        ];
        spec.restart_policy = RestartPolicy {
            max_restarts: MAX_RESTART_CORE_COUNT,
            restart_delay: CORE_RESTART_INTERVAL,
        };
        spec.log_config = ProcessLogConfig {
            log_file: Some(log_file),
            truncate_on_start: false,
            line_formatter: Some(Arc::new(format_mihomo_log_line)),
        };
        Ok(spec)
    }

    fn handle_sidecar_event(event: ProcessEvent) {
        match event {
            ProcessEvent::Stdout { line, .. } | ProcessEvent::Stderr { line, .. } => {
                Logger::global().append_log(line);
            }
            ProcessEvent::RestartLimitReached { .. } => {
                tracing::error!("recover clash core count exceeded, skip");
                handle::Handle::notice_message(handle::NoticeStatus::Error, "messages.clash.core.runFailed");
            }
            _ => {}
        }
    }

    fn clash_core_name() -> String {
        if let Some(core) = Config::verge().latest().clash_core.as_deref()
            && CLASH_CORES.contains(&core)
        {
            return core.to_string();
        }
        CLASH_CORES[0].to_string()
    }

    fn disable_tun_mapping() -> Mapping {
        Mapping::from_iter([(
            "tun".into(),
            Mapping::from_iter([("enable".into(), false.into())]).into(),
        )])
    }

    async fn disable_tun(&self) {
        tracing::info!("disable tun mode");
        let disable_tun = Self::disable_tun_mapping();
        let _ = handle::Handle::mihomo().await.patch_base_config(&disable_tun).await;
    }

    async fn try_run_core_by_service(&self, config_path: &PathBuf) -> Result<bool> {
        if !self.use_service_mode.load(Ordering::SeqCst) {
            return Ok(false);
        }

        tracing::debug!("try to run core in service mode");
        let verge_log = VergeLog::global();
        let log_path = match verge_log.get_service_log_file() {
            Some(log_path) => log_path,
            None => {
                tracing::info!("creating service log file");
                verge_log.create_service_log_file()?
            }
        };
        tracing::info!("service log file: {log_path}");

        match service::run_core_by_service(config_path, &PathBuf::from(log_path)).await {
            Ok(_) => {
                tracing::info!("run core by service successfully");
                Ok(true)
            }
            Err(err) => {
                self.use_service_mode.store(false, Ordering::SeqCst);
                tracing::error!("failed to run core by service, {err}");
                Ok(false)
            }
        }
    }

    fn prepare_sidecar_mode(&self) -> Result<()> {
        VergeLog::global().reset_service_log_file();

        if cfg!(target_os = "linux") && dirs::is_portable_version() {
            return Ok(());
        }

        tracing::info!("run with sidecar mode, patch config to disable tun mode");
        let disable_tun = Self::disable_tun_mapping();
        Config::clash().latest_mut().patch_and_merge_config(disable_tun.clone());
        Config::clash().latest().save_config()?;
        Config::runtime().latest_mut().patch_config(disable_tun);
        Config::generate_file(ConfigType::Run)?;
        handle::Handle::refresh_clash();
        handle::Handle::update_systray_part()?;
        Ok(())
    }
}
