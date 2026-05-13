pub mod log_config;
mod service;

use std::{path::PathBuf, str::FromStr};

use anyhow::Result;
use serde::de::DeserializeOwned;
use tipsy::ServerId;

pub mod model {
    pub use super::service::{ClashRunInfo, data::*};
}

#[cfg(windows)]
use windows_service::service::ServiceType;

use crate::service::SecureChannel;

#[cfg(windows)]
pub const SERVICE_TYPE: ServiceType = ServiceType::OWN_PROCESS;
pub const SERVICE_NAME: &str = "clash_verge_self_service";

// default server id
pub const DEFAULT_SERVER_ID: &str = "verge-self-service-server";

// encode relate
const KEY_INFO: &[u8] = b"rust-secure-ipc-demo";
pub const PSK: &[u8] = b"verge-self-service-psk";

pub struct Client(SecureChannel);

impl Client {
    /// connect to server
    ///
    /// unix system: `/tmp/{server_id}.sock`
    ///
    /// Windows system: `\\.\pipe\{server_id}`
    pub async fn connect<S: Into<String>>(server_id: S, psk: Option<&[u8]>) -> Result<Self> {
        let temp_dir = if cfg!(windows) {
            std::env::temp_dir()
        } else {
            PathBuf::from("/tmp")
        };
        let path = ServerId::new(server_id.into()).parent_folder(temp_dir);
        let client = tipsy::Endpoint::connect(path).await?;
        let secured = SecureChannel::handshake_client(client, psk).await?;
        Ok(Self(secured))
    }

    /// send socket command request
    pub async fn send<T: DeserializeOwned>(&mut self, command: model::SocketCommand) -> Result<model::JsonResponse<T>> {
        let cmd_json = serde_json::to_string(&command)?;
        self.0.send(cmd_json.as_bytes()).await?;
        let res = self.0.recv().await?;
        let msg = String::from_utf8(res)?;
        log::info!("connect to service success");
        let res = model::JsonResponse::from_str(&msg)?;
        Ok(res)
    }
}

pub struct Server;

impl Server {
    /// run server
    pub async fn run<S: Into<String>>(server_id: S, psk: Option<&[u8]>) -> Result<()> {
        service::run_service(Some(server_id.into()), psk).await?;
        Ok(())
    }
}
