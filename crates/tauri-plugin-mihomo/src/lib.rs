use std::time::Duration;

pub use mihomo::Mihomo;
use tauri::{
    Manager, Runtime,
    async_runtime::RwLock,
    plugin::{Builder as PluginBuilder, TauriPlugin},
};

mod commands;
mod error;
mod mihomo;
pub mod models;
mod stream;

pub use error::{Error, Result};

use crate::models::Protocol;

/// Extensions to [`tauri::App`], [`tauri::AppHandle`] and [`tauri::Window`] to access the mihomo APIs.
pub trait MihomoExt<R: Runtime> {
    fn mihomo(&self) -> &RwLock<Mihomo>;
}

impl<R: Runtime, T: Manager<R>> crate::MihomoExt<R> for T {
    fn mihomo(&self) -> &RwLock<Mihomo> {
        self.state::<RwLock<Mihomo>>().inner()
    }
}

const DEFAULT_REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const DOWNLOAD_FILE_TIMEOUT: Duration = Duration::from_secs(60);

#[derive(Debug)]
pub struct Builder {
    protocol: Protocol,
    external_host: Option<String>,
    external_port: Option<u32>,
    secret: Option<String>,
    socket_path: Option<String>,
    request_timeout: Option<Duration>,
}

impl Default for Builder {
    fn default() -> Self {
        Self {
            protocol: Protocol::Http,
            external_host: Some(String::from("127.0.0.1")),
            external_port: Some(9090),
            secret: None,
            socket_path: None,
            request_timeout: Some(DEFAULT_REQUEST_TIMEOUT),
        }
    }
}

impl Builder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn protocol(mut self, protocol: Protocol) -> Self {
        self.protocol = protocol;
        self
    }

    pub fn external_host<S: Into<String>>(mut self, external_host: S) -> Self {
        self.external_host = Some(external_host.into());
        self
    }

    pub fn external_port(mut self, external_port: u32) -> Self {
        self.external_port = Some(external_port);
        self
    }

    pub fn secret<S: Into<String>>(mut self, secret: S) -> Self {
        self.secret = Some(secret.into());
        self
    }

    pub fn socket_path<S: Into<String>>(mut self, socket_path: S) -> Self {
        self.socket_path = Some(socket_path.into());
        self
    }

    /// 设置请求超时时间
    ///
    /// 部分需要下载文件的更新/升级 API 方法固定超时时间为 60 秒。 例如更新 geo、更新 ui、升级内核方法
    pub fn request_timeout(mut self, request_timeout: Duration) -> Self {
        self.request_timeout = Some(request_timeout);
        self
    }

    pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
        let protocol = self.protocol;
        let external_host = self.external_host;
        let external_port = self.external_port;
        let secret = self.secret;
        let socket_path = self.socket_path;
        let request_timeout = self.request_timeout.unwrap_or(DEFAULT_REQUEST_TIMEOUT);

        PluginBuilder::new("mihomo")
            .invoke_handler(tauri::generate_handler![
                commands::update_controller,
                commands::update_secret,
                commands::get_version,
                commands::flush_fakeip,
                commands::flush_dns,
                // connections
                commands::get_connections,
                commands::close_all_connections,
                commands::close_connection,
                // groups
                commands::get_groups,
                commands::get_group_by_name,
                commands::delay_group,
                // providers
                commands::get_proxy_providers,
                commands::get_proxy_provider_by_name,
                commands::update_proxy_provider,
                commands::healthcheck_proxy_provider,
                commands::healthcheck_node_in_provider,
                // proxies
                commands::get_proxies,
                commands::get_proxy_by_name,
                commands::select_node_for_group,
                commands::unfixed_proxy,
                commands::delay_proxy_by_name,
                // rules
                commands::get_rules,
                commands::update_rules_disable,
                commands::get_rule_providers,
                commands::update_rule_provider,
                // runtime config
                commands::get_base_config,
                commands::reload_config,
                commands::patch_base_config,
                commands::update_geo,
                commands::restart,
                // upgrade
                commands::upgrade_core,
                commands::upgrade_ui,
                commands::upgrade_geo,
                // ws
                commands::ws_traffic,
                commands::ws_memory,
                commands::ws_connections,
                commands::ws_logs,
                commands::ws_disconnect,
                commands::clear_all_ws_connections,
                // commands::ws_send,
            ])
            .setup(move |app, _api| {
                let client = Mihomo::build_client(&protocol, socket_path.as_deref())?;
                let mihomo = Mihomo {
                    protocol,
                    external_host,
                    external_port,
                    secret,
                    socket_path,
                    request_timeout,
                    connection_manager: Default::default(),
                    client,
                };
                mihomo.start_ws_connections_watcher();
                app.manage(RwLock::new(mihomo));

                Ok(())
            })
            .build()
    }
}
