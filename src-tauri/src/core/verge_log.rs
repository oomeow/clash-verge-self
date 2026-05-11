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
use tracing_appender::{non_blocking, non_blocking::WorkerGuard, rolling};
use tracing_subscriber::{
    Layer, Registry, filter,
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

    pub fn create_clash_log_file(&self) -> Result<PathBuf> {
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
        let app_log_file = dirs::app_home_dir()?.join(&log_filename);
        *self.app_log_file.lock() = app_log_file.clone();
        let clash_log_file = dirs::clash_logs_dir()?.join(log_filename);
        *self.clash_log_file.lock() = clash_log_file.clone();

        let log_level = Config::verge().latest().get_log_level();
        let timer = tracing_subscriber::fmt::time::LocalTime::new(format_description!(
            "[year]-[month]-[day] [hour]:[minute]:[second].[subsecond digits:3]"
        ));
        let exclude_filter = filter::filter_fn(|metadata| {
            !(metadata.target().contains("tungstenite") && *metadata.level() == Level::TRACE)
        });

        // 输出到终端
        let (level_filter, reload_handle) = reload::Layer::new(log_level);
        let console_layer = tracing_subscriber::fmt::layer()
            .compact()
            .with_ansi(true)
            .with_timer(timer.clone())
            .with_line_number(true)
            .with_writer(std::io::stdout)
            .with_filter(exclude_filter.clone());

        // 输出到日志文件
        let log_dir = dirs::app_logs_dir()?;
        let file_appender = rolling::never(log_dir, app_log_file);
        let (non_blocking_appender, guard) = non_blocking(file_appender);
        let file_layer = tracing_subscriber::fmt::layer()
            .compact()
            .with_ansi(false)
            .with_timer(timer)
            .with_line_number(true)
            .with_writer(non_blocking_appender)
            .with_filter(exclude_filter);

        tracing_subscriber::registry()
            .with(level_filter)
            .with(file_layer)
            .with(console_layer)
            .init();

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
        if !file_name.ends_with(".log") {
            tracing::debug!("skip non-log file: {}", file_name);
            return;
        }
        if let Ok(created_time) = parse_time_str(file_name.trim_end_matches(".log")) {
            if let Some(file_time) = Local.from_local_datetime(&created_time).earliest() {
                if now.signed_duration_since(file_time).num_days() > retention_days {
                    match fs::remove_file(&file_path) {
                        Ok(_) => tracing::info!("delete log file: {file_name}"),
                        Err(e) => tracing::warn!("Failed to delete log file {}: {}", file_path.display(), e),
                    }
                }
            } else {
                tracing::warn!("get local datetime failed, skip delete log file [{file_name}]");
            }
        } else {
            tracing::warn!("parse log file time failed, skip delete log file [{file_name}]");
        }
    }
}
