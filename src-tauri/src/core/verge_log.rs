use std::{
    fs::{self, DirEntry},
    path::PathBuf,
    str::FromStr,
    sync::Arc,
};

use anyhow::{Context, Result};
use chrono::{Local, NaiveDateTime, TimeZone};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use time::macros::format_description;
use tracing::{Level, level_filters::LevelFilter};
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{
    EnvFilter, Layer, Registry, filter,
    layer::SubscriberExt,
    reload::{self, Handle},
    util::SubscriberInitExt,
};

use crate::{
    config::Config,
    utils::dirs::{self},
};

#[derive(Debug, Default)]
pub struct VergeLog {
    app_log_handle: Arc<Mutex<Option<Handle<LevelFilter, Registry>>>>,
    app_log_file: Arc<Mutex<PathBuf>>,
    clash_log_file: Arc<Mutex<PathBuf>>,
}

impl VergeLog {
    pub fn global() -> &'static Self {
        static VERGE_LOG: OnceCell<VergeLog> = OnceCell::new();
        VERGE_LOG.get_or_init(VergeLog::default)
    }

    pub fn get_app_log_file(&self) -> PathBuf {
        self.app_log_file.lock().clone()
    }

    pub fn get_clash_log_file(&self) -> PathBuf {
        self.clash_log_file.lock().clone()
    }

    pub fn generate_clash_log_file(&self) -> Result<PathBuf> {
        let clash_log_file = dirs::clash_logs_dir()?.join(dirs::generate_log_filename());
        *self.clash_log_file.lock() = clash_log_file.clone();
        Ok(clash_log_file)
    }

    /// 必须返回 WorkerGuard，并且仅在它的生命周期中，才能写入到日志文件
    ///
    /// 因此，必须确保返回的 WorkerGuard 的生命周期足够长
    pub fn init(&self) -> Result<WorkerGuard> {
        // generate log file
        let log_filename = dirs::generate_log_filename();
        let app_log_file = dirs::app_logs_dir()?.join(&log_filename);
        *self.app_log_file.lock() = app_log_file.clone();
        let clash_log_file = dirs::clash_logs_dir()?.join(&log_filename);
        *self.clash_log_file.lock() = clash_log_file.clone();

        let log_level = Config::verge().latest().get_log_level();
        let timer = tracing_subscriber::fmt::time::LocalTime::new(format_description!(
            "[year]-[month]-[day] [hour]:[minute]:[second].[subsecond digits:3]"
        ));
        let exclude_filter = filter::filter_fn(|metadata| {
            !(metadata.target().contains("tungstenite") && *metadata.level() == Level::TRACE)
        });

        // RUST_LOG 未设置时 EnvFilter 的默认指令只允许 error（from_default_env 的默认行为），
        // 会盖过应用内的日志级别设置，因此仅在显式设置了 RUST_LOG 时才接入 EnvFilter。
        let env_logging = std::env::var_os("RUST_LOG").is_some();

        // 应用内日志级别作为默认门控。当设置了 RUST_LOG 时由 EnvFilter 全权控制，
        // 故将可 reload 的门控层初始化为 TRACE，避免其（默认 INFO）叠加限制调试输出。
        let (level_filter, reload_handle) =
            reload::Layer::new(if env_logging { LevelFilter::TRACE } else { log_level });
        let console_layer = tracing_subscriber::fmt::layer()
            .compact()
            .with_ansi(true)
            .with_timer(timer.clone())
            // .with_thread_ids(true)
            // .with_thread_names(true)
            .with_target(true)
            .with_line_number(true)
            .with_writer(std::io::stdout)
            .with_filter(exclude_filter.clone());

        // 输出到日志文件
        let log_dir = dirs::app_logs_dir()?;
        let roll_size_mb = Config::verge().latest().get_log_roll_size_mb();
        let max_keep_files = Config::verge().latest().get_log_max_keep_files();
        let file_appender = logroller::LogRollerBuilder::new(log_dir, PathBuf::from(log_filename))
            .rotation(logroller::Rotation::SizeBased(logroller::RotationSize::MB(
                roll_size_mb,
            )))
            .max_keep_files(max_keep_files)
            .time_zone(logroller::TimeZone::Local)
            .compression(logroller::Compression::Gzip) // Compress old logs
            .build()?;
        let (non_blocking_appender, guard) = tracing_appender::non_blocking(file_appender);
        let file_layer = tracing_subscriber::fmt::layer()
            .compact()
            .with_ansi(false)
            .with_timer(timer)
            .with_target(false)
            .with_line_number(false)
            .with_writer(non_blocking_appender)
            .with_filter(exclude_filter);

        let subscriber = tracing_subscriber::registry()
            .with(level_filter)
            .with(file_layer)
            .with(console_layer);

        if env_logging {
            subscriber.with(EnvFilter::from_default_env()).init();
        } else {
            subscriber.init();
        }

        *self.app_log_handle.lock() = Some(reload_handle);

        Ok(guard)
    }

    pub fn update_app_log_level(log_level: LevelFilter) -> Result<()> {
        let log_handle = Self::global().app_log_handle.lock();
        if let Some(handle) = log_handle.as_ref() {
            handle.modify(|filter| *filter = log_level)?;
        } else {
            anyhow::bail!("log handle is none, need to init log");
        }
        Ok(())
    }

    pub fn delete_logs() -> Result<()> {
        let log_dir = dirs::app_logs_dir()?;
        if !log_dir.exists() {
            return Ok(());
        }

        let auto_log_clean = {
            let verge = Config::verge();
            let verge = verge.data();
            verge.auto_log_clean.unwrap_or(1)
        };

        let retention_days = match auto_log_clean {
            1 => 7,
            2 => 30,
            3 => 90,
            _ => return Ok(()),
        };

        tracing::debug!("try to delete log files, retention_days: {retention_days}");
        let now = Local::now();
        fs::read_dir(&log_dir)?
            .flatten()
            .for_each(|file| delete_old_logs(file, now, retention_days));
        Ok(())
    }
}

/// parse log filename format %Y-%m-%d-%H%M to NaiveDateTime, but only use the date part
fn parse_time_str(s: &str) -> Result<NaiveDateTime> {
    let sa = s.split('-').collect::<Vec<&str>>();
    if sa.len() != 4 {
        anyhow::bail!("invalid time str: {s}.log");
    }

    let year = i32::from_str(sa[0])?;
    let month = u32::from_str(sa[1])?;
    let day = u32::from_str(sa[2])?;
    let time = chrono::NaiveDate::from_ymd_opt(year, month, day)
        .context("invalid time str")?
        .and_hms_opt(0, 0, 0)
        .context("invalid time str")?;
    Ok(time)
}

fn delete_old_logs(file: DirEntry, now: chrono::DateTime<Local>, retention_days: i64) {
    let Ok(file_type) = file.file_type() else {
        return;
    };
    let file_path = file.path();
    let file_name = file.file_name();
    let file_name = file_name.to_str().unwrap_or_default();

    if file_type.is_dir() {
        if let Ok(files) = fs::read_dir(&file_path) {
            tracing::debug!("process dir: {}", file_name);
            files
                .flatten()
                .for_each(|file| delete_old_logs(file, now, retention_days));
        }
    } else if file_type.is_file() {
        if !file_name.contains(".log") {
            tracing::debug!("skip non-log file: {}", file_name);
            return;
        }
        let split: Vec<&str> = file_name.split(".log").collect();
        let Some(prefix_name) = split.first() else {
            return;
        };
        if let Ok(created_time) = parse_time_str(prefix_name) {
            if let Some(file_time) = Local.from_local_datetime(&created_time).earliest() {
                if now.signed_duration_since(file_time).num_days() > retention_days {
                    match fs::remove_file(&file_path) {
                        Ok(_) => tracing::info!("delete log file: {file_name}"),
                        Err(e) => tracing::warn!("Failed to delete log file {}: {}", file_path.display(), e),
                    }
                }
            } else {
                tracing::warn!("get local datetime failed, skip delete log file [{prefix_name}]");
            }
        } else {
            tracing::warn!("parse log file time failed, skip delete log file [{prefix_name}]");
        }
    }
}
