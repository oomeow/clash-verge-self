use std::{fs, path::PathBuf, sync::Arc};

use anyhow::{Result, bail};
use log::LevelFilter;
use log4rs::{
    Config, Handle,
    append::{console::ConsoleAppender, file::FileAppender},
    config::{Appender, Logger, Root},
    encode::pattern::PatternEncoder,
};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;

#[derive(Debug, Clone)]
pub struct LogConfig {
    log_file_name: String,
    log_dir: Option<PathBuf>,
    limited_file_size: Option<u64>,
    log_level: Option<LevelFilter>,
    log_handle: Option<Handle>,
}

impl Default for LogConfig {
    fn default() -> Self {
        Self {
            log_file_name: "clash-verge-self-service.log".to_string(),
            log_dir: None,
            limited_file_size: Some(2 * 1024 * 1024),
            log_level: Some(LevelFilter::Debug),
            log_handle: None,
        }
    }
}

impl LogConfig {
    pub fn global() -> &'static Arc<Mutex<LogConfig>> {
        static LOGCONFIG: OnceCell<Arc<Mutex<LogConfig>>> = OnceCell::new();
        LOGCONFIG.get_or_init(|| Arc::new(Mutex::new(LogConfig::default())))
    }

    pub fn init(&mut self, log_dir: Option<PathBuf>) -> Result<()> {
        let LogConfig {
            log_file_name,
            limited_file_size,
            log_level,
            ..
        } = LogConfig::default();

        let log_file_name = log_file_name.clone();
        let log_level = log_level.unwrap();

        let config = Self::create_log_config(&log_file_name, log_dir.clone(), limited_file_size, log_level);

        if let Some(config) = config {
            let handle = log4rs::init_config(config).unwrap();

            self.log_dir = log_dir;
            self.log_handle = Some(handle);
        }
        Ok(())
    }

    #[allow(unused)]
    pub fn update_config(
        &mut self,
        log_file_name: &str,
        log_dir: PathBuf,
        limited_file_size: Option<u64>,
    ) -> Result<()> {
        let LogConfig {
            log_file_name: mut c_log_file_name,
            log_dir: mut c_log_dir,
            limited_file_size: mut c_limited_file_size,
            log_handle: mut c_log_handle,
            log_level: mut c_log_level,
        } = self.clone();
        if c_log_handle.is_none() {
            log::error!("update log config failed, log handle is none, please init first");
            bail!("update log config failed, log handle is none, please init first");
        }

        // check if need to update log config
        let mut need_update = false;
        if log_file_name != c_log_file_name {
            need_update = true;
        }
        if !need_update && (c_log_dir.is_none() || log_dir != c_log_dir.unwrap()) {
            need_update = true;
        }
        if !need_update && limited_file_size != c_limited_file_size {
            need_update = true;
        }
        if !need_update {
            log::debug!("log config is not changed, no need to update");
            return Ok(());
        }

        // let log_level = c_log_level.clone().unwrap();
        let config = Self::create_log_config(
            log_file_name,
            Some(log_dir.clone()),
            limited_file_size,
            c_log_level.unwrap_or(LevelFilter::Info),
        );
        if let Some(config) = config {
            c_log_handle.unwrap().set_config(config);

            c_log_file_name = log_file_name.to_string();
            c_log_dir = Some(log_dir);
            c_limited_file_size = limited_file_size;
        }
        Ok(())
    }

    fn create_log_config(
        log_file_name: &str,
        log_dir: Option<PathBuf>,
        limited_size: Option<u64>,
        log_level: LevelFilter,
    ) -> Option<Config> {
        let log_pattern = "{d(%Y-%m-%d %H:%M:%S)} {l} - {m}{n}";
        let encoder = Box::new(PatternEncoder::new(log_pattern));

        let mut appenders = Vec::new();
        let log_to_file = log_dir.is_some();

        if log_to_file {
            // create log to file appender
            let log_file = log_dir.unwrap().join(log_file_name);
            if let Some(limited_size) = limited_size
                && log_file.exists()
            {
                let metadata = fs::metadata(log_file.clone()).ok()?;
                if metadata.len() >= limited_size {
                    let _ = fs::rename(log_file.clone(), log_file.with_extension("old.log"));
                }
            }
            let tofile = FileAppender::builder().encoder(encoder.clone()).build(log_file).ok()?;
            let file_appender = Appender::builder().build("file", Box::new(tofile));
            appenders.push(file_appender);
        }

        // create log to stdout appender
        let stdout = ConsoleAppender::builder().encoder(encoder).build();
        let stdout_appender = Appender::builder().build("stdout", Box::new(stdout));
        appenders.push(stdout_appender);

        let appenders_str = if log_to_file {
            if cfg!(debug_assertions) {
                vec!["file", "stdout"]
            } else {
                vec!["file"]
            }
        } else {
            vec!["stdout"]
        };

        let app_logger = Logger::builder()
            .appenders(appenders_str.clone())
            .additive(false)
            .build("app", log_level);
        let mihomo_logger = Logger::builder()
            .appenders(appenders_str.clone())
            .additive(false)
            .build("mihomo", log_level);
        let root = Root::builder().appenders(appenders_str).build(log_level);

        log4rs::config::Config::builder()
            .appenders(appenders)
            .logger(app_logger)
            .logger(mihomo_logger)
            .build(root)
            .ok()
    }
}
