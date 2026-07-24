use std::{collections::HashMap, sync::Arc, time::Duration};

use http::{
    Request,
    header::{CONNECTION, HOST, SEC_WEBSOCKET_KEY, SEC_WEBSOCKET_VERSION, UPGRADE},
};
use tokio::sync::RwLock;
use tokio_tungstenite::{
    client_async, connect_async,
    tungstenite::{
        Message, client::IntoClientRequest, handshake::client::generate_key, protocol::CloseFrame as ProtocolCloseFrame,
    },
};

use crate::{
    Error, Result,
    models::{CloseFrame, Protocol, WebSocketConnectionId, WebSocketMessage},
    stream::{WsReadKind, WsStream, WsWriteKind},
};

/// 一个已建立的 WebSocket 连接，包含发送端和后台读取任务的中止句柄。
pub struct ManagedWsConnection {
    pub writer: WsWriteKind,
    pub read_task: tokio::task::AbortHandle,
}

/// 调度 abort handle：立即中止或延迟指定毫秒后中止。
pub fn schedule_abort_handle(abort_handle: tokio::task::AbortHandle, timeout: Option<u64>) {
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
        Ok(Message::Close(frame)) => serde_json::to_value(WebSocketMessage::Close(frame.map(|frame| CloseFrame {
            code: frame.code.into(),
            reason: frame.reason.to_string(),
        })))?,
        Ok(Message::Frame(_)) => serde_json::Value::Null,
        Err(error) => {
            tracing::error!("websocket error: {error}");
            serde_json::to_value(WebSocketMessage::Text(error.to_string()))?
        }
    };
    Ok(msg)
}

async fn close_managed_connection(connection: ManagedWsConnection, force_timeout: Option<u64>) {
    let mut connection = connection;
    let _ = connection.writer.send(websocket_close_message()).await;
    schedule_abort_handle(connection.read_task, force_timeout);
}

async fn open_websocket_stream(
    protocol: &Protocol,
    socket_path: Option<&str>,
    url: String,
) -> Result<(WsWriteKind, WsReadKind)> {
    match protocol {
        Protocol::Http => {
            tracing::debug!("starting connect to websocket by using http");
            let request = url.into_client_request()?;
            let (ws_stream, _) = connect_async(request).await?;
            Ok(WsStream::from(ws_stream).split())
        }
        Protocol::LocalSocket => {
            let Some(socket_path) = socket_path else {
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

/// 生成后台读取任务。
///
/// 该任务持续从 WebSocket 读取消息并通过 `on_message` 回调转发。
/// 当连接从 manager 中移除或收到 Close 帧时自动退出并清理。
fn spawn_read_task<F>(
    id: WebSocketConnectionId,
    mut reader: WsReadKind,
    on_message: F,
    manager: Arc<RwLock<HashMap<WebSocketConnectionId, ManagedWsConnection>>>,
    start_signal: tokio::sync::oneshot::Receiver<()>,
) -> tokio::task::JoinHandle<()>
where
    F: Fn(serde_json::Value) + Send + 'static,
{
    tokio::spawn(async move {
        // Wait for the connection to be registered in the manager
        // before entering the read loop.
        let _ = start_signal.await;

        while let Some(message) = reader.next().await {
            if !manager.read().await.contains_key(&id) {
                tracing::debug!("connection [{id}] is removed from manager");
                break;
            }

            let is_close = matches!(&message, Ok(Message::Close(_)));
            if let Ok(response) = handle_websocket_message(message) {
                on_message(response);
            }
            if is_close {
                tracing::debug!("connection [{id}] is closed");
                break;
            }
        }

        // Clean up: remove the connection from the manager on exit.
        // This is safe even if close() already removed it (no-op).
        manager.write().await.remove(&id);
    })
}

/// 管理 WebSocket 连接的生命周期。
///
/// 每个连接由一个后台读取任务（处理入站消息）和一个写入端（用于发送 Close 帧）组成。
/// 使用 `open()` 创建连接，使用 `close()` / `close_all()` 清理。
#[derive(Default, Clone)]
pub struct ConnectionManager {
    connections: Arc<RwLock<HashMap<WebSocketConnectionId, ManagedWsConnection>>>,
}

impl ConnectionManager {
    pub fn new() -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// 打开一个新的 WebSocket 连接。
    ///
    /// `protocol` 和 `socket_path` 决定使用的传输层（HTTP 或 LocalSocket）。
    /// 返回的 `WebSocketConnectionId` 可用于后续关闭连接。
    pub async fn open<F>(
        &self,
        protocol: &Protocol,
        socket_path: Option<&str>,
        url: String,
        on_message: F,
    ) -> Result<WebSocketConnectionId>
    where
        F: Fn(serde_json::Value) + Send + 'static,
    {
        let id: WebSocketConnectionId = rand::random();
        tracing::info!("connecting to websocket: {url}, id: {id}");

        let (writer, reader) = open_websocket_stream(protocol, socket_path, url).await?;

        // Register the connection in the manager BEFORE starting the read task,
        // so the task will always find the connection when it checks contains_key().
        let (start_tx, start_rx) = tokio::sync::oneshot::channel();
        let read_task = spawn_read_task(id, reader, on_message, self.connections.clone(), start_rx);
        self.connections.write().await.insert(
            id,
            ManagedWsConnection {
                writer,
                read_task: read_task.abort_handle(),
            },
        );
        // Signal the read task that the connection is registered.
        let _ = start_tx.send(());
        Ok(id)
    }

    /// 关闭指定 WebSocket 连接。
    pub async fn close(&self, id: WebSocketConnectionId, force_timeout: Option<u64>) -> Result<()> {
        tracing::debug!("disconnecting connection: {id}");
        let connection = self.connections.write().await.remove(&id);
        if let Some(connection) = connection {
            close_managed_connection(connection, force_timeout).await;
            Ok(())
        } else {
            tracing::error!("connection not found: {id}");
            Err(Error::WebSocketConnectionNotFound(id))
        }
    }

    /// 关闭所有 WebSocket 连接。
    pub async fn close_all(&self) {
        tracing::debug!("start to clear all websocket connections");
        let connections: Vec<ManagedWsConnection> = self.connections.write().await.drain().map(|(_, c)| c).collect();
        tracing::debug!("manage_ids cleared, count: {}", connections.len());
        for connection in connections {
            close_managed_connection(connection, Some(0)).await;
        }
        tracing::debug!("clear all done");
    }

    /// 检查指定 ID 的连接是否仍在活跃。
    pub async fn is_active(&self, id: WebSocketConnectionId) -> bool {
        self.connections.read().await.contains_key(&id)
    }

    /// 获取所有活跃连接的 ID（主要用于调试）。
    pub async fn active_ids(&self) -> Vec<WebSocketConnectionId> {
        self.connections.read().await.keys().copied().collect()
    }
}
