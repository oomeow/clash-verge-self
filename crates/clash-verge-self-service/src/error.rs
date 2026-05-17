use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServiceError {
    #[error("{0}")]
    Io(#[from] std::io::Error),

    #[error("{0}")]
    Serde(#[from] serde_json::Error),

    #[error("{0}")]
    SystemTime(#[from] std::time::SystemTimeError),

    #[error("{0}")]
    Utf8(#[from] std::string::FromUtf8Error),

    #[error("{0}")]
    TryFromSlice(#[from] std::array::TryFromSliceError),

    #[error("Process supervisor error: {0}")]
    ProcessSupervisor(#[from] process_supervisor::Error),

    #[error("Windows service error: {0}")]
    WindowsService(#[from] windows_service::Error),

    #[error("{0}")]
    General(String),
}

pub type Result<T> = std::result::Result<T, ServiceError>;
