#![allow(dead_code)]
use std::{collections::HashMap, sync::Arc, time::Duration};

use http::{
    HeaderMap, HeaderValue, Request,
    header::{AUTHORIZATION, CONNECTION, CONTENT_TYPE, HOST, SEC_WEBSOCKET_KEY, SEC_WEBSOCKET_VERSION, UPGRADE},
};
use reqwest::{Method, RequestBuilder};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::json;
use tokio_tungstenite::{
    client_async, connect_async,
    tungstenite::{
        Message, client::IntoClientRequest, handshake::client::generate_key, protocol::CloseFrame as ProtocolCloseFrame,
    },
};

use crate::{
    DOWNLOAD_FILE_TIMEOUT, Error, Result, failed_resp,
    models::{
        BaseConfig, CloseFrame, ConnectionManager, Connections, CoreUpdaterChannel, ErrorResponse, Groups, LogLevel,
        ManagedWsConnection, MihomoVersion, Protocol, Proxies, Proxy, ProxyDelay, ProxyProvider, ProxyProviders,
        RuleProviders, Rules, WebSocketConnectionId, WebSocketMessage,
    },
    ret_failed_resp,
    stream::{WsReadKind, WsStream, WsWriteKind},
};

fn schedule_abort_handle(abort_handle: tokio::task::AbortHandle, timeout: Option<u64>) {
    match timeout {
        Some(timeout) => {
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(timeout)).await;
                abort_handle.abort();
            });
        }
        None => abort_handle.abort(),
    }
}

pub struct Mihomo {
    pub protocol: Protocol,
    pub external_host: Option<String>,
    pub external_port: Option<u32>,
    pub secret: Option<String>,
    pub socket_path: Option<String>,
    pub request_timeout: Duration,
    pub connection_manager: Arc<ConnectionManager>,
    pub client: reqwest::Client,
}

impl Mihomo {
    fn websocket_close_message() -> Message {
        Message::Close(Some(ProtocolCloseFrame {
            code: 1000.into(),
            reason: "Disconnected by client".into(),
        }))
    }

    fn handle_websocket_message(message: Result<Message>) -> Result<serde_json::Value> {
        let msg = match message {
            Ok(Message::Text(text)) => serde_json::to_value(WebSocketMessage::Text(text.to_string()))?,
            Ok(Message::Binary(data)) => serde_json::to_value(WebSocketMessage::Binary(data.to_vec()))?,
            Ok(Message::Ping(data)) => serde_json::to_value(WebSocketMessage::Ping(data.to_vec()))?,
            Ok(Message::Pong(data)) => serde_json::to_value(WebSocketMessage::Pong(data.to_vec()))?,
            Ok(Message::Close(frame)) => {
                serde_json::to_value(WebSocketMessage::Close(frame.map(|frame| CloseFrame {
                    code: frame.code.into(),
                    reason: frame.reason.to_string(),
                })))?
            }
            Ok(Message::Frame(_)) => serde_json::Value::Null,
            Err(error) => {
                tracing::error!("websocket error: {error}");
                serde_json::to_value(WebSocketMessage::Text(error.to_string()))?
            }
        };
        Ok(msg)
    }

    fn spawn_read_task<F>(
        id: WebSocketConnectionId,
        mut reader: WsReadKind,
        on_message: F,
        manager: Arc<ConnectionManager>,
    ) -> tokio::task::JoinHandle<()>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        tokio::spawn(async move {
            while let Some(message) = reader.next().await {
                if !manager.contains(id).await {
                    tracing::debug!("connection [{id}] is removed from manager");
                    break;
                }

                let is_close = matches!(&message, Ok(Message::Close(_)));
                if let Ok(response) = Self::handle_websocket_message(message) {
                    on_message(response);
                }
                if is_close {
                    tracing::debug!("connection [{id}] is closed");
                    break;
                }
            }

            // TODO: it is necessary to remove it?
            let _ = manager.remove(id).await;
        })
    }

    async fn open_websocket_stream(&self, url: String) -> Result<(WsWriteKind, WsReadKind)> {
        match self.protocol {
            Protocol::Http => {
                tracing::debug!("starting connect to websocket by using http");
                let request = url.into_client_request()?;
                let (ws_stream, _) = connect_async(request).await?;
                Ok(WsStream::from(ws_stream).split())
            }
            Protocol::LocalSocket => {
                let Some(socket_path) = self.socket_path.as_ref() else {
                    tracing::error!("missing socket path parameter");
                    return Err(Error::MissingPathParameter("socket_path".into()));
                };

                tracing::debug!("starting connect to websocket by using local socket: {socket_path}");
                let stream = crate::stream::connect_to_socket(socket_path).await?;
                let request = Request::builder()
                    .uri(url)
                    .header(HOST, "clash-verge-self")
                    .header(SEC_WEBSOCKET_KEY, generate_key())
                    .header(CONNECTION, "Upgrade")
                    .header(UPGRADE, "websocket")
                    .header(SEC_WEBSOCKET_VERSION, "13")
                    .body(())?;
                let (ws_stream, _) = client_async(request, stream).await?;
                Ok(WsStream::from(ws_stream).split())
            }
        }
    }

    async fn close_managed_connection(connection: ManagedWsConnection, force_timeout: Option<u64>) {
        let mut connection = connection;
        let _ = connection.writer.send(Self::websocket_close_message()).await;
        schedule_abort_handle(connection.read_task, force_timeout);
    }

    pub fn update_protocol(&mut self, protocol: Protocol) -> Result<()> {
        self.protocol = protocol;
        self.client = Self::build_client(&self.protocol, self.socket_path.as_deref())?;
        Ok(())
    }

    pub fn update_external_host(&mut self, host: Option<String>) {
        self.external_host = host;
    }

    pub fn update_external_port(&mut self, port: Option<u32>) {
        self.external_port = port;
    }

    pub fn update_secret(&mut self, secret: Option<String>) {
        self.secret = secret;
    }

    pub fn update_socket_path<S: Into<String>>(&mut self, socket_path: S) -> Result<()> {
        self.socket_path = Some(socket_path.into());
        self.client = Self::build_client(&self.protocol, self.socket_path.as_deref())?;
        Ok(())
    }

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

    pub fn start_ws_connections_watcher(&self) {
        let manager = self.connection_manager.clone();
        tauri::async_runtime::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_millis(1000));
            loop {
                interval.tick().await;
                let ids = manager.ids().await;
                tracing::trace!("manager websocket connection ids: {ids:?}");
            }
        });
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

    /// 连接 WebSocket
    async fn connect<F>(&self, url: String, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let id = rand::random();
        tracing::info!("connecting to websocket: {url}, id: {id}");
        let manager = self.connection_manager.clone();

        let (writer, reader) = self.open_websocket_stream(url).await?;
        let read_task = Self::spawn_read_task(id, reader, on_message, manager.clone());
        manager
            .insert(
                id,
                ManagedWsConnection {
                    writer,
                    read_task: read_task.abort_handle(),
                },
            )
            .await;
        Ok(id)
    }

    /// 向指定 WebSocket 连接发送消息 (暂无使用该方法的地方)
    async fn send(&self, id: WebSocketConnectionId, message: WebSocketMessage) -> Result<()> {
        let manager = self.connection_manager.clone();
        let mut manager = manager.0.write().await;
        if let Some(writer) = manager.get_mut(&id) {
            let data = match message {
                WebSocketMessage::Text(t) => Message::Text(t.into()),
                WebSocketMessage::Binary(t) => Message::Binary(t.into()),
                WebSocketMessage::Ping(t) => Message::Ping(t.into()),
                WebSocketMessage::Pong(t) => Message::Pong(t.into()),
                WebSocketMessage::Close(t) => Message::Close(t.map(|v| ProtocolCloseFrame {
                    code: v.code.into(),
                    reason: v.reason.into(),
                })),
            };
            writer.writer.send(data).await?;
            Ok(())
        } else {
            tracing::error!("connection not found: {id}");
            Err(Error::WebSocketConnectionNotFound(id))
        }
    }

    /// 取消 WebSocket 连接
    pub async fn disconnect(&self, id: WebSocketConnectionId, force_timeout: Option<u64>) -> Result<()> {
        tracing::debug!("disconnecting connection: {id}");
        let connection = self.connection_manager.remove(id).await;
        if let Some(connection) = connection {
            Self::close_managed_connection(connection, force_timeout).await;
            Ok(())
        } else {
            tracing::error!("connection not found: {id}");
            Err(Error::WebSocketConnectionNotFound(id))
        }
    }

    pub async fn clear_all_ws_connections(&self) -> Result<()> {
        tracing::debug!("start to clear all websocket connections");
        let ids = self.connection_manager.ids().await;
        tracing::debug!("manage_ids: {ids:?}");
        let connections = self.connection_manager.take_all().await;
        for connection in connections {
            Self::close_managed_connection(connection, Some(0)).await;
        }
        tracing::debug!("clear all done");
        Ok(())
    }

    // ------------------------------------------------------
    // |                     Mihomo API                     |
    // ------------------------------------------------------
    /// WebSocket: Mihomo 流量数据
    pub async fn ws_traffic<F>(&self, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ws_url = self.get_websocket_url("/traffic")?;
        let websocket_id = self.connect(ws_url, on_message).await?;
        Ok(websocket_id)
    }

    /// WebSocket: Mihomo 内存使用数据
    pub async fn ws_memory<F>(&self, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ws_url = self.get_websocket_url("/memory")?;
        let websocket_id = self.connect(ws_url, on_message).await?;
        Ok(websocket_id)
    }

    /// WebSocket: Mihomo 连接信息数据
    pub async fn ws_connections<F>(&self, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ws_url = self.get_websocket_url("/connections")?;
        let websocket_id = self.connect(ws_url, on_message).await?;
        Ok(websocket_id)
    }

    /// WebSocket: Mihomo 日志数据
    pub async fn ws_logs<F>(&self, level: LogLevel, on_message: F) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let ws_url = self.get_websocket_url("/logs")?;
        let ws_url = match self.protocol {
            // url 后面添加 format=structured 参数的日志格式如下：
            // {"time":"11:49:58","level":"debug","message":"[DNS] hijack udp:192.168.2.1:53 from 198.18.0.1:42761","fields":[]}
            Protocol::Http => format!("{ws_url}&level={level}"),
            Protocol::LocalSocket => format!("{ws_url}?level={level}"),
        };
        let websocket_id = self.connect(ws_url, on_message).await?;
        Ok(websocket_id)
    }

    // clash api
    /// 获取 Mihomo 版本信息
    pub async fn get_version(&self) -> Result<MihomoVersion> {
        let response = self.build_request(Method::GET, "/version")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get mihomo version error, {}", response.text().await?);
        }
        Ok(response.json::<MihomoVersion>().await?)
    }

    /// 清理 FakeIP 缓存
    pub async fn flush_fakeip(&self) -> Result<()> {
        let response = self.build_request(Method::POST, "/cache/fakeip/flush")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("flush fakeip cache error, {}", response.text().await?);
        }
        Ok(())
    }

    /// 清理 DNS 缓存
    pub async fn flush_dns(&self) -> Result<()> {
        let response = self.build_request(Method::POST, "/cache/dns/flush")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("flush dns cache error, {}", response.text().await?);
        }
        Ok(())
    }

    /// 获取全部连接信息
    pub async fn get_connections(&self) -> Result<Connections> {
        let response = self.build_request(Method::GET, "/connections")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get connections failed, {}", response.text().await?);
        }
        Ok(response.json::<Connections>().await?)
    }

    /// 关闭全部连接
    pub async fn close_all_connections(&self) -> Result<()> {
        let response = self.build_request(Method::DELETE, "/connections")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("close all connections failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 关闭指定 ID 的连接
    pub async fn close_connection(&self, connection_id: &str) -> Result<()> {
        let response = self
            .build_request(Method::DELETE, &format!("/connections/{connection_id}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("close connection failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 获取所有的代理组
    pub async fn get_groups(&self) -> Result<Groups> {
        let response = self.build_request(Method::GET, "/group")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get group error, {}", response.text().await?);
        }
        Ok(response.json::<Groups>().await?)
    }

    /// 获取指定名称的代理组
    pub async fn get_group_by_name(&self, group_name: &str) -> Result<Proxy> {
        let group_name = urlencoding::encode(group_name);
        let response = self
            .build_request(Method::GET, &format!("/group/{group_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get group error, {}", response.text().await?);
        }
        Ok(response.json::<Proxy>().await?)
    }

    /// 对指定代理组进行延迟测试, 同时清理代理组已固定的节点
    pub async fn delay_group(&self, group_name: &str, test_url: &str, timeout: u32) -> Result<HashMap<String, u32>> {
        let group_name = urlencoding::encode(group_name);
        let test_url = urlencoding::encode(test_url);
        let request_timeout = self.request_timeout + Duration::from_millis(timeout as u64);
        let response = self
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

    /// 获取代理提供者信息
    pub async fn get_proxy_providers(&self) -> Result<ProxyProviders> {
        let response = self.build_request(Method::GET, "/providers/proxies")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get providers proxy failed, {}", response.text().await?);
        }
        Ok(response.json::<ProxyProviders>().await?)
    }

    /// 获取指定代理提供者信息
    pub async fn get_proxy_provider_by_name(&self, provider_name: &str) -> Result<ProxyProvider> {
        let provider_name = urlencoding::encode(provider_name);
        let response = self
            .build_request(Method::GET, &format!("/providers/proxies/{provider_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get providers proxy failed, {}", response.text().await?);
        }
        Ok(response.json::<ProxyProvider>().await?)
    }

    /// 更新指定代理提供者信息
    pub async fn update_proxy_provider(&self, provider_name: &str) -> Result<()> {
        let provider_name = urlencoding::encode(provider_name);
        let response = self
            .build_request(Method::PUT, &format!("/providers/proxies/{provider_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update providers proxy failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 对指定代理提供者进行健康检查
    pub async fn healthcheck_proxy_provider(&self, provider_name: &str) -> Result<()> {
        let provider_name = urlencoding::encode(provider_name);
        let response = self
            .build_request(Method::GET, &format!("/providers/proxies/{provider_name}/healthcheck"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("healthcheck providers failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 对指定代理提供者下的指定节点（非代理组）进行健康检查, 并返回新的延迟信息
    pub async fn healthcheck_node_in_provider(
        &self,
        provider_name: &str,
        proxy_name: &str,
        test_url: &str,
        timeout: u32,
    ) -> Result<ProxyDelay> {
        let provider_name = urlencoding::encode(provider_name);
        let proxy_name = urlencoding::encode(proxy_name);
        let request_timeout = self.request_timeout + Duration::from_millis(timeout as u64);
        let response = self
            .build_request(
                Method::GET,
                &format!("/providers/proxies/{provider_name}/{proxy_name}/healthcheck"),
            )?
            .query(&[("url", test_url), ("timeout", &timeout.to_string())])
            .timeout(request_timeout)
            .send()
            .await?;
        if !response.status().is_success() {
            // maybe proxy delay is timeout response, try parse it.
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

    /// 获取所有代理信息
    pub async fn get_proxies(&self) -> Result<Proxies> {
        let response = self.build_request(Method::GET, "/proxies")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get proxies failed, {}", response.text().await?);
        }
        Ok(response.json::<Proxies>().await?)
    }

    /// 获取指定代理信息
    pub async fn get_proxy_by_name(&self, proxy_name: &str) -> Result<Proxy> {
        let proxy_name = urlencoding::encode(proxy_name);
        let response = self
            .build_request(Method::GET, &format!("/proxies/{proxy_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get proxy by name failed, {}", response.text().await?);
        }
        Ok(response.json::<Proxy>().await?)
    }

    /// 为指定代理选择节点
    ///
    /// 一般为指定代理组下使用指定的代理节点 【代理组/节点】
    pub async fn select_node_for_group(&self, group_name: &str, node: &str) -> Result<()> {
        let group_name = urlencoding::encode(group_name);
        let response = self
            .build_request(Method::PUT, &format!("/proxies/{group_name}"))?
            .json(&json!({ "name": node }))
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("select node for proxy failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 指定代理组下不再使用固定的代理节点
    ///
    /// 一般用于自动选择的代理组（例如：URLTest 类型的代理组）下的节点
    pub async fn unfixed_proxy(&self, group_name: &str) -> Result<()> {
        let group_name = urlencoding::encode(group_name);
        let response = self
            .build_request(Method::DELETE, &format!("/proxies/{group_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("unfixed proxy failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 对指定代理进行延迟测试
    ///
    /// 一般用于代理节点的延迟测试，也可传代理组名称（只会测试代理组下选中的代理节点）
    pub async fn delay_proxy_by_name(&self, proxy_name: &str, test_url: &str, timeout: u32) -> Result<ProxyDelay> {
        let proxy_name = urlencoding::encode(proxy_name);
        let request_timeout = self.request_timeout + Duration::from_millis(timeout as u64);
        let response = self
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

    /// 获取所有规则信息
    pub async fn get_rules(&self) -> Result<Rules> {
        let response = self.build_request(Method::GET, "/rules")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get rules failed, {}", response.text().await?);
        }
        Ok(response.json::<Rules>().await?)
    }

    pub async fn update_rules_disable(&self, rules: HashMap<isize, bool>) -> Result<()> {
        let response = self
            .build_request(Method::PATCH, "/rules/disable")?
            .json(&rules)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update rules disabled failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 获取所有规则提供者信息
    pub async fn get_rule_providers(&self) -> Result<RuleProviders> {
        let response = self.build_request(Method::GET, "/providers/rules")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get rules providers failed, {}", response.text().await?);
        }
        Ok(response.json::<RuleProviders>().await?)
    }

    /// 更新规则提供者信息
    pub async fn update_rule_provider(&self, provider_name: &str) -> Result<()> {
        let provider_name = urlencoding::encode(provider_name);
        let response = self
            .build_request(Method::PUT, &format!("/providers/rules/{provider_name}"))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update rule provider failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 获取基础配置
    pub async fn get_base_config(&self) -> Result<BaseConfig> {
        let response = self.build_request(Method::GET, "/configs")?.send().await?;
        if !response.status().is_success() {
            ret_failed_resp!("get base config error, {}", response.text().await?);
        }
        Ok(response.json::<BaseConfig>().await?)
    }

    /// 重新加载配置
    ///
    /// 如果配置文件中包含了很多 provider，则会花费很多时间在下载 provider 上，建议只对当前配置进行重载时使用，避免使用此方来进行包含多个 provider 的配置文件的切换
    pub async fn reload_config(&self, force: bool, config_path: &str) -> Result<()> {
        let response = self
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

    /// 更新基础配置
    pub async fn patch_base_config<D: serde::Serialize + ?Sized>(&self, data: &D) -> Result<()> {
        let response = self
            .build_request(Method::PATCH, "/configs")?
            .json(&data)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("patch base config error, {}", response.text().await?);
        }
        Ok(())
    }

    /// 更新 Geo, 同 [`upgrade_geo`](crate::mihomo::Mihomo::upgrade_geo)
    pub async fn update_geo(&self) -> Result<()> {
        let response = self
            .build_request(Method::POST, "/configs/geo")?
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            failed_resp!("update geo database error, {}", response.text().await?);
        }
        Ok(())
    }

    /// 重启核心
    pub async fn restart(&self) -> Result<()> {
        let response = self.build_request(Method::POST, "/restart")?.send().await?;
        if !response.status().is_success() {
            failed_resp!("restart core failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 升级核心
    pub async fn upgrade_core(&self, channel: CoreUpdaterChannel, force: bool) -> Result<()> {
        let response = self
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

    /// 更新 UI
    pub async fn upgrade_ui(&self) -> Result<()> {
        let response = self
            .build_request(Method::POST, "/upgrade/ui")?
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("upgrade ui failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 更新 Geo
    pub async fn upgrade_geo(&self) -> Result<()> {
        let response = self
            .build_request(Method::POST, "/upgrade/geo")?
            .timeout(DOWNLOAD_FILE_TIMEOUT)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("upgrade geo failed, {}", response.text().await?);
        }
        Ok(())
    }

    /// 获取该 key 在 Storage 下存储的值
    pub async fn get_storage_value<T>(&self, key: &str) -> Result<Option<T>>
    where
        T: DeserializeOwned,
    {
        let response = self
            .build_request(Method::GET, &format!("/storage/{}", urlencoding::encode(key)))?
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("get storage value error, {}", response.text().await?);
        }
        Ok(response.json::<Option<T>>().await?)
    }

    /// 更新该 key 在 Storage 下存储的值, 没有则创建
    pub async fn set_storage_value<T>(&self, key: &str, value: T) -> Result<()>
    where
        T: Serialize,
    {
        let response = self
            .build_request(Method::PUT, &format!("/storage/{}", urlencoding::encode(key)))?
            .json(&value)
            .send()
            .await?;
        if !response.status().is_success() {
            ret_failed_resp!("update storage value error, {}", response.text().await?);
        }
        Ok(())
    }

    /// 删除该 key 在 Storage 下存储的键值
    pub async fn delete_storage_value(&self, key: &str) -> Result<()> {
        let response = self
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

    use super::schedule_abort_handle;

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
