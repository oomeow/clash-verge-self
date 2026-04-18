use serde::Serialize;
use specta::{DataType, Generics, Type, TypeCollection};
use thiserror::Error;

pub type AppResult<T> = std::result::Result<T, AppError>;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Zip(#[from] zip::result::ZipError),
    #[error("web dav error: {0}")]
    WebDav(#[from] reqwest_dav::Error),
    // #[error("web dav error: {0}")]
    // WebDav(#[from] reqwest_dav::re_exports::reqwest::Error),
    #[error(transparent)]
    SerdeYaml(#[from] serde_yaml::Error),
    #[error(transparent)]
    SerdeJson(#[from] serde_json::Error),
    #[error(transparent)]
    ParseInt(#[from] std::num::ParseIntError),
    #[error(transparent)]
    FromUtf8Error(#[from] std::string::FromUtf8Error),
    #[error("parse mihomo rule error: {0}")]
    RuleParse(#[from] mihomo_rule_parser::RuleParseError),
    #[error("system proxy error: {0}")]
    SysProxy(#[from] sysproxy::Error),
    #[error("auto launch error: {0}")]
    AutoLaunch(#[from] auto_launch::Error),
    #[error(transparent)]
    Reqwest(#[from] reqwest::Error),
    #[error(transparent)]
    NetWorkInterface(#[from] network_interface::Error),
    #[error("delay timer error: {0}")]
    DelayTimer(String),
    #[error(transparent)]
    TracingSubscriber(#[from] tracing_subscriber::reload::Error),
    #[error("task join error: {0}")]
    TaskJoin(#[from] tokio::task::JoinError),
    #[error("process manager error: {0}")]
    ProcessSupervisor(#[from] process_supervisor::Error),

    // tauri
    #[error("tauri shell error: {0}")]
    ShellPlugin(#[from] tauri_plugin_shell::Error),
    #[error("tauri opener error: {0}")]
    OpenerPlugin(#[from] tauri_plugin_opener::Error),
    #[error("tauri global shortcut error: {0}")]
    ShortcutPlugin(#[from] tauri_plugin_global_shortcut::Error),
    #[error("tauri mihomo api error: {0}")]
    MihomoPlugin(#[from] tauri_plugin_mihomo::Error),
    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    // custom
    #[error("{0}")]
    Any(String),
    #[error("invalid value: {0}")]
    InvalidValue(String),
    #[error("Clash Verge Service error: {0}")]
    Service(String),
    #[error("load keys error: {0}")]
    LoadKeys(String),
    #[error("invalid clash config: {0}")]
    InvalidClashConfig(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

impl Type for AppError {
    fn inline(type_map: &mut TypeCollection, generics: Generics) -> DataType {
        String::inline(type_map, generics)
    }
}

impl From<anyhow::Error> for AppError {
    fn from(value: anyhow::Error) -> Self {
        AppError::Any(value.to_string())
    }
}

impl From<delay_timer::error::TaskError> for AppError {
    fn from(value: delay_timer::error::TaskError) -> Self {
        AppError::DelayTimer(value.to_string())
    }
}

#[macro_export]
macro_rules! any_err {
    ($($arg: tt)*) => {
        AppError::Any(format!($($arg)*))
    };
}
