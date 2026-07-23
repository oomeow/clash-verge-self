use std::{collections::HashMap, sync::Arc, time::Duration};

use arc_swap::ArcSwap;
use http::{
    HeaderMap, HeaderValue,
    header::{AUTHORIZATION, CONTENT_TYPE, HOST},
};
use reqwest::{Method, RequestBuilder};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::json;

use crate::{
    DOWNLOAD_FILE_TIMEOUT, Error, Result,
    connection_manager::ConnectionManager,
    failed_resp,
    models::{
        BaseConfig, Connections, CoreUpdaterChannel, ErrorResponse, Groups, LogLevel, MihomoVersion, Protocol, Proxies,
        Proxy, ProxyDelay, ProxyProvider, ProxyProviders, RuleProviders, Rules, WebSocketConnectionId,
    },
    ret_failed_resp,
};

/// Runtime configuration snapshot.
///
/// All fields are consistent within a single snapshot. Read methods load one
/// snapshot at entry and use it for the entire request — they never see a
/// half-updated state.
#[derive(Clone)]
pub struct MihomoContext {
    pub protocol: Protocol,
    pub external_host: Option<String>,
    pub external_port: Option<u32>,
    pub secret: Option<String>,
    pub socket_path: Option<String>,
    pub request_timeout: Duration,
    pub client: reqwest::Client,
}

impl MihomoContext {
    pub fn build_client(protocol: &Protocol, socket_path: Option<&str>) -> Result<reqwest::Client> {
        let mut builder = reqwest::ClientBuilder::new();
        match protocol {
            Protocol::Http => Ok(builder.build()?),
            Protocol::LocalSocket => {
                let Some(socket_path) = socket_path else {
                    tracing::error!("missing socket path parameter");
                    return Err(Error::MissingPathParameter("socket_path".into()));
                };
                #[cfg(windows)]
                {
                    builder = builder.windows_named_pipe(socket_path);
                }
                #[cfg(unix)]
                {
                    builder = builder.unix_socket(socket_path);
                }
                Ok(builder.build()?)
            }
        }
    }

    fn generate_req_url(&self, suffix_url: &str) -> Result<String> {
        let suffix_url = suffix_url.trim_start_matches("/");
        match self.protocol {
            Protocol::Http => {
                if let Some(host) = self.external_host.as_ref() {
                    let port = self.external_port.unwrap_or(9090);
                    Ok(format!("http://{host}:{port}/{suffix_url}"))
                } else {
                    tracing::error!("missing external host parameter");
                    Err(Error::MissingPathParameter("external_host".into()))
                }
            }
            Protocol::LocalSocket => Ok(format!("http://localhost/{suffix_url}")),
        }
    }

    fn generate_req_headers(&self) -> Result<HeaderMap<HeaderValue>> {
        let mut headers = HeaderMap::new();
        headers.insert(HOST, HeaderValue::from_str("localhost")?);
        headers.insert(CONTENT_TYPE, HeaderValue::from_str("application/json")?);
        if matches!(self.protocol, Protocol::Http)
            && let Some(secret) = &self.secret
        {
            let auth_value = HeaderValue::from_str(&format!("Bearer {secret}"))?;
            headers.insert(AUTHORIZATION, auth_value);
        }
        Ok(headers)
    }

    fn build_request(&self, method: Method, suffix_url: &str) -> Result<RequestBuilder> {
        let url = self.generate_req_url(suffix_url)?;
        let headers = self.generate_req_headers()?;
        let request = match method {
            Method::POST => self.client.post(url),
            Method::GET => self.client.get(url),
            Method::PUT => self.client.put(url),
            Method::PATCH => self.client.patch(url),
            Method::DELETE => self.client.delete(url),
            _ => {
                let method_str = method.as_str().to_string();
                tracing::error!("method not supported: {method_str}");
                return Err(Error::MethodNotSupported(method_str));
            }
        };
        Ok(request.headers(headers).timeout(self.request_timeout))
    }

    fn get_websocket_url(&self, suffix_url: &str) -> Result<String> {
        let suffix_url = suffix_url.trim_start_matches("/");
        match self.protocol {
            Protocol::Http => {
                if let Some(host) = self.external_host.as_ref() {
                    let port = self.external_port.unwrap_or(9090);
                    let secret = self.secret.as_deref().unwrap_or_default();
                    Ok(format!("ws://{host}:{port}/{suffix_url}?token={secret}"))
                } else {
                    tracing::error!("missing external host parameter");
                    Err(Error::MissingPathParameter("external_host".into()))
                }
            }
            Protocol::LocalSocket => Ok(format!("ws://localhost/{suffix_url}")),
        }
    }
}

pub struct Mihomo {
    ctx: ArcSwap<MihomoContext>,
    pub connection_manager: ConnectionManager,
}

impl Mihomo {
    pub fn new(ctx: MihomoContext) -> Self {
        Self {
            ctx: ArcSwap::new(Arc::new(ctx)),
            connection_manager: ConnectionManager::default(),
        }
    }

    /// Load a consistent context snapshot (lock-free).
    fn load_ctx(&self) -> Arc<MihomoContext> {
        self.ctx.load().clone()
    }

    /// Atomically replace the context snapshot.
    fn update_ctx(&self, f: impl FnOnce(&mut MihomoContext)) {
        let current = self.ctx.load();
        let mut new_ctx = (**current).clone();
        f(&mut new_ctx);
        self.ctx.store(Arc::new(new_ctx));
    }

    /// Atomically replace the context snapshot (fallible variant).
    fn try_update_ctx(&self, f: impl FnOnce(&mut MihomoContext) -> Result<()>) -> Result<()> {
        let current = self.ctx.load();
        let mut new_ctx = (**current).clone();
        f(&mut new_ctx)?;
        self.ctx.store(Arc::new(new_ctx));
        Ok(())
    }
}

// ============================================================================
// Configuration & Protocol
// ============================================================================
impl Mihomo {
    pub fn update_protocol(&self, protocol: Protocol) -> Result<()> {
        self.try_update_ctx(|ctx| {
            ctx.protocol = protocol;
            ctx.client = MihomoContext::build_client(&ctx.protocol, ctx.socket_path.as_deref())?;
            Ok(())
        })
    }

    pub fn update_external_host(&self, host: Option<&str>) {
        self.update_ctx(|ctx| ctx.external_host = host.map(Into::into));
    }

    pub fn update_external_port(&self, port: Option<u32>) {
        self.update_ctx(|ctx| ctx.external_port = port);
    }

    pub fn update_secret(&self, secret: Option<&str>) {
        self.update_ctx(|ctx| ctx.secret = secret.map(Into::into));
    }

    pub fn update_socket_path<S: Into<String>>(&self, socket_path: S) -> Result<()> {
        let path = socket_path.into();
        self.try_update_ctx(|ctx| {
            ctx.socket_path = Some(path);
            ctx.client = MihomoContext::build_client(&ctx.protocol, ctx.socket_path.as_deref())?;
            Ok(())
        })
    }

    pub fn start_ws_connections_watcher(&self) {
        let manager = self.connection_manager.clone();
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(1000));
            loop {
                interval.tick().await;
                let ids = manager.active_ids().await;
                tracing::trace!("manager websocket connection ids: {ids:?}");
            }
        });
    }
}

// ============================================================================
// WebSocket Connection Lifecycle
// ============================================================================
impl Mihomo {
    pub async fn disconnect(&self, id: WebSocketConnectionId, force_timeout: Option<u64>) -> Result<()> {
        self.connection_manager.close(id, force_timeout).await
    }

    pub async fn clear_all_ws_connections(&self) -> Result<()> {
        self.connection_manager.close_all().await;
        Ok(())
    }

    pub async fn ws_traffic<F>(&self, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ctx = self.load_ctx();
        let ws_url = ctx.get_websocket_url("/traffic")?;
        self.connection_manager
            .open(&ctx.protocol, ctx.socket_path.as_deref(), ws_url, on_message)
            .await
    }

    pub async fn ws_memory<F>(&self, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ctx = self.load_ctx();
        let ws_url = ctx.get_websocket_url("/memory")?;
        self.connection_manager
            .open(&ctx.protocol, ctx.socket_path.as_deref(), ws_url, on_message)
            .await
    }

    pub async fn ws_connections<F>(&self, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ctx = self.load_ctx();
        let ws_url = ctx.get_websocket_url("/connections")?;
        self.connection_manager
            .open(&ctx.protocol, ctx.socket_path.as_deref(), ws_url, on_message)
            .await
    }

    pub async fn ws_logs<F>(&self, level: LogLevel, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ctx = self.load_ctx();
        let ws_url = ctx.get_websocket_url("/logs")?;
        let ws_url = match ctx.protocol {
            Protocol::Http => format!("{ws_url}&level={level}"),
            Protocol::LocalSocket => format!("{ws_url}?level={level}"),
        };
        self.connection_manager
            .open(&ctx.protocol, ctx.socket_path.as_deref(), ws_url, on_message)
            .await
    }
}

// ============================================================================
// Mihomo REST API
// ============================================================================
impl Mihomo {
    pub async fn get_version(&self) -> Result<MihomoVersion> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/version")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get mihomo version error, {}", response.text().await?);
        }
        Ok(response.json::<MihomoVersion>().await?)
    }

    pub async fn flush_fakeip(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::POST, "/cache/fakeip/flush")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("flush fakeip cache error, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn flush_dns(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::POST, "/cache/dns/flush")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("flush dns cache error, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn get_connections(&self) -> Result<Connections> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/connections")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get connections failed, {}", response.text().await?);
        }
        Ok(response.json::<Connections>().await?)
    }

    pub async fn close_all_connections(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::DELETE, "/connections")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("close all connections failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn close_connection(&self, connection_id: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::DELETE, &format!("/connections/{connection_id}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("close connection failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn get_groups(&self) -> Result<Groups> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/group")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get group error, {}", response.text().await?);
        }
        Ok(response.json::<Groups>().await?)
    }

    pub async fn get_group_by_name(&self, group_name: &str) -> Result<Proxy> {
        let ctx = self.load_ctx();
        let group_name = urlencoding::encode(group_name);
        let response = ctx
            .build_request(Method::GET, &format!("/group/{group_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get group error, {}", response.text().await?);
        }
        Ok(response.json::<Proxy>().await?)
    }

    pub async fn delay_group(&self, group_name: &str, test_url: &str, timeout: u32) -> Result<HashMap<String, u32>> {
        let ctx = self.load_ctx();
        let group_name = urlencoding::encode(group_name);
        let test_url = urlencoding::encode(test_url);
        let request_timeout = ctx.request_timeout + Duration::from_millis(timeout as u64);
        let response = ctx
            .build_request(
                Method::GET,
                &format!("/group/{group_name}/delay?url={test_url}&timeout={timeout}"),
            )?
            .timeout(request_timeout)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get group error, {}", response.text().await?);
        }
        Ok(response.json::<HashMap<String, u32>>().await?)
    }

    pub async fn get_proxy_providers(&self) -> Result<ProxyProviders> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/providers/proxies")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get providers proxy failed, {}", response.text().await?);
        }
        Ok(response.json::<ProxyProviders>().await?)
    }

    pub async fn get_proxy_provider_by_name(&self, provider_name: &str) -> Result<ProxyProvider> {
        let ctx = self.load_ctx();
        let provider_name = urlencoding::encode(provider_name);
        let response = ctx
            .build_request(Method::GET, &format!("/providers/proxies/{provider_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get providers proxy failed, {}", response.text().await?);
        }
        Ok(response.json::<ProxyProvider>().await?)
    }

    pub async fn update_proxy_provider(&self, provider_name: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let provider_name = urlencoding::encode(provider_name);
        let response = ctx
            .build_request(Method::PUT, &format!("/providers/proxies/{provider_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update providers proxy failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn healthcheck_proxy_provider(&self, provider_name: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let provider_name = urlencoding::encode(provider_name);
        let response = ctx
            .build_request(Method::GET, &format!("/providers/proxies/{provider_name}/healthcheck"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("healthcheck providers failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn healthcheck_node_in_provider(
        &self,
        provider_name: &str,
        proxy_name: &str,
        test_url: &str,
        timeout: u32,
    ) -> Result<ProxyDelay> {
        let ctx = self.load_ctx();
        let provider_name = urlencoding::encode(provider_name);
        let proxy_name = urlencoding::encode(proxy_name);
        let request_timeout = ctx.request_timeout + Duration::from_millis(timeout as u64);
        let response = ctx
            .build_request(
                Method::GET,
                &format!("/providers/proxies/{provider_name}/{proxy_name}/healthcheck"),
            )?
            .query(&[("url", test_url), ("timeout", &timeout.to_string())])
            .timeout(request_timeout)
            .send()
            .await?;
        if !response.status().is_success() {
            match response.json::<ErrorResponse>().await {
                Ok(err_response) => {
                    tracing::debug!("delay error: {}", err_response.message);
                    return Ok(ProxyDelay { delay: 0 });
                }
                Err(e) => {
                    ret_failed_resp!("healthcheck providers failed, {}", e);
                }
            }
        }
        Ok(response.json::<ProxyDelay>().await?)
    }

    pub async fn get_proxies(&self) -> Result<Proxies> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/proxies")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get proxies failed, {}", response.text().await?);
        }
        Ok(response.json::<Proxies>().await?)
    }

    pub async fn get_proxy_by_name(&self, proxy_name: &str) -> Result<Proxy> {
        let ctx = self.load_ctx();
        let proxy_name = urlencoding::encode(proxy_name);
        let response = ctx
            .build_request(Method::GET, &format!("/proxies/{proxy_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get proxy by name failed, {}", response.text().await?);
        }
        Ok(response.json::<Proxy>().await?)
    }

    pub async fn select_node_for_group(&self, group_name: &str, node: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let group_name = urlencoding::encode(group_name);
        let response = ctx
            .build_request(Method::PUT, &format!("/proxies/{group_name}"))?
            .json(&json!({ "name": node }))
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("select node for proxy failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn unfixed_proxy(&self, group_name: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let group_name = urlencoding::encode(group_name);
        let response = ctx
            .build_request(Method::DELETE, &format!("/proxies/{group_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("unfixed proxy failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn delay_proxy_by_name(&self, proxy_name: &str, test_url: &str, timeout: u32) -> Result<ProxyDelay> {
        let ctx = self.load_ctx();
        let proxy_name = urlencoding::encode(proxy_name);
        let request_timeout = ctx.request_timeout + Duration::from_millis(timeout as u64);
        let response = ctx
            .build_request(Method::GET, &format!("/proxies/{proxy_name}/delay"))?
            .query(&[("timeout", &timeout.to_string()), ("url", &test_url.to_string())])
            .timeout(request_timeout)
            .send()
            .await?;
        if !response.status().is_success() {
            match response.json::<ErrorResponse>().await {
                Ok(err_response) => {
                    tracing::debug!("delay error: {}", err_response.message);
                    return Ok(ProxyDelay { delay: 0 });
                }
                Err(e) => {
                    ret_failed_resp!("get proxy by name failed, {}", e);
                }
            }
        }
        Ok(response.json::<ProxyDelay>().await?)
    }

    pub async fn get_rules(&self) -> Result<Rules> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/rules")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get rules failed, {}", response.text().await?);
        }
        Ok(response.json::<Rules>().await?)
    }

    pub async fn update_rules_disable(&self, rules: HashMap<isize, bool>) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::PATCH, "/rules/disable")?
            .json(&rules)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update rules disabled failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn get_rule_providers(&self) -> Result<RuleProviders> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/providers/rules")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get rules providers failed, {}", response.text().await?);
        }
        Ok(response.json::<RuleProviders>().await?)
    }

    pub async fn update_rule_provider(&self, provider_name: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let provider_name = urlencoding::encode(provider_name);
        let response = ctx
            .build_request(Method::PUT, &format!("/providers/rules/{provider_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update rule provider failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn get_base_config(&self) -> Result<BaseConfig> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::GET, "/configs")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get base config error, {}", response.text().await?);
        }
        Ok(response.json::<BaseConfig>().await?)
    }

    pub async fn reload_config(&self, force: bool, config_path: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::PUT, "/configs")?
            .query(&[("force", force)])
            .json(&json!({ "path": config_path }))
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("reload base config error, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn patch_base_config<D: serde::Serialize + ?Sized>(&self, data: &D) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::PATCH, "/configs")?.json(&data).send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("patch base config error, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn update_geo(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::POST, "/configs/geo")?
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            failed_resp!("update geo database error, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn restart(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx.build_request(Method::POST, "/restart")?.send().await?;
        if !response.status().is_success() {
            failed_resp!("restart core failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn upgrade_core(&self, channel: CoreUpdaterChannel, force: bool) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::POST, "/upgrade")?
            .query(&[("channel", &channel.to_string()), ("force", &force.to_string())])
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            match response.json::<HashMap<String, String>>().await {
                Ok(res) => match res.get("message") {
                    Some(msg) => {
                        if msg.to_lowercase().contains("already using latest version") {
                            ret_failed_resp!("already using latest version");
                        } else {
                            ret_failed_resp!("{}", msg.clone());
                        }
                    }
                    None => {
                        ret_failed_resp!("upgrade core failed");
                    }
                },
                Err(e) => {
                    ret_failed_resp!("upgrade core failed, {}", e);
                }
            }
        }
        Ok(())
    }

    pub async fn upgrade_ui(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::POST, "/upgrade/ui")?
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("upgrade ui failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn upgrade_geo(&self) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::POST, "/upgrade/geo")?
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("upgrade geo failed, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn get_storage_value<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: DeserializeOwned,
    {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::GET, &format!("/storage/{}", urlencoding::encode(key)))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get storage value error, {}", response.text().await?);
        }
        Ok(response.json::<Option<T>>().await?)
    }

    pub async fn set_storage_value<T>(&self, key: &str, value: T) -> Result<()>
    where
        T: Serialize,
    {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::PUT, &format!("/storage/{}", urlencoding::encode(key)))?
            .json(&value)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update storage value error, {}", response.text().await?);
        }
        Ok(())
    }

    pub async fn delete_storage_value(&self, key: &str) -> Result<()> {
        let ctx = self.load_ctx();
        let response = ctx
            .build_request(Method::DELETE, &format!("/storage/{}", urlencoding::encode(key)))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("delete storage key and value error, {}", response.text().await?);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use crate::connection_manager::schedule_abort_handle;

    #[tokio::test]
    async fn abort_handle_without_timeout_aborts_immediately() {
        let task = tokio::spawn(std::future::pending::<()>());
        let abort_handle = task.abort_handle();

        schedule_abort_handle(abort_handle, None);

        let result = task.await.expect_err("task should be cancelled");
        assert!(result.is_cancelled(), "task should be aborted immediately");
    }

    #[tokio::test]
    async fn abort_handle_with_timeout_waits_before_aborting() {
        let task = tokio::spawn(std::future::pending::<()>());
        let abort_handle = task.abort_handle();

        schedule_abort_handle(abort_handle, Some(25));
        tokio::time::sleep(Duration::from_millis(5)).await;
        assert!(!task.is_finished(), "task should remain alive before timeout");

        let result = tokio::time::timeout(Duration::from_millis(80), task)
            .await
            .expect("task should be aborted after timeout")
            .expect_err("task should be cancelled");
        assert!(result.is_cancelled(), "task should be aborted after timeout");
    }
}
