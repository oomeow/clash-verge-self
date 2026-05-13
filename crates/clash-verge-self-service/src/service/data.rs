use std::str::FromStr;

use serde::{Deserialize, Serialize, de::DeserializeOwned};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum SocketCommand {
    GetVersion,
    GetClash,
    GetLogs,
    StartClash(StartBody),
    StopClash,
    StopService,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ServiceVersionInfo {
    pub version: String,
    pub service: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct StartBody {
    pub core_type: Option<String>,
    pub socket_path: Option<String>,
    pub bin_path: String,
    pub config_dir: String,
    pub pid_file: String,
    pub config_file: String,
    pub log_file: String,
}

// #[derive(Debug, Deserialize, Serialize, Clone)]
// pub struct LogLevelBody {
//     pub level: String,
//     // Is there a need to create a log level for mihomo?
//     // pub mihomo_level: String,
// }

#[derive(Serialize, Deserialize, Debug)]
pub struct JsonResponse<T> {
    pub code: u64,
    pub msg: String,
    pub data: Option<T>,
}

impl<T> FromStr for JsonResponse<T>
where
    T: DeserializeOwned,
{
    type Err = serde_json::error::Error;
    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        serde_json::from_str(s)
    }
}
