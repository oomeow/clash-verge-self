use std::{
    collections::{HashMap, VecDeque},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU32, AtomicU64, Ordering},
    },
    time::Duration,
};

use chrono::{DateTime, Local};
use once_cell::sync::Lazy;
use serde::Serialize;
use serde_json::Value;
use tauri::ipc::Channel;
use tauri_plugin_mihomo::models::{LogLevel, WebSocketConnectionId, WebSocketMessage};
use tokio::{
    sync::{RwLock, mpsc, oneshot, watch},
    task::JoinHandle,
};

use crate::{
    cmds::{CommandResult, into_command_result},
    config::Config,
    core::{handle, logger, service},
};

#[derive(Debug, Clone, Serialize)]
struct CmdLogItem {
    time: String,
    #[serde(rename = "type")]
    log_type: String,
    payload: String,
}

#[derive(Debug, Clone)]
enum MihomoWsEndpoint {
    Traffic,
    Memory,
    Connections,
    Logs(LogLevel),
}

enum MihomoWsEvent {
    Reconnect,
    Shutdown,
}

struct MihomoWsConnection {
    active_id: Arc<RwLock<Option<WebSocketConnectionId>>>,
    shutdown_tx: watch::Sender<bool>,
    task: JoinHandle<()>,
}

struct BufferedLogMessages {
    buffering: bool,
    messages: Vec<Value>,
}

struct OpenedMihomoWsConnection {
    backend_id: WebSocketConnectionId,
    log_buffer: Option<Arc<Mutex<BufferedLogMessages>>>,
}

static NEXT_WS_CONNECTION_ID: AtomicU32 = AtomicU32::new(1);
static MIHOMO_WS_GENERATION: AtomicU64 = AtomicU64::new(0);
static MIHOMO_WS_CONNECTIONS: Lazy<RwLock<HashMap<WebSocketConnectionId, MihomoWsConnection>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

const WS_RECONNECT_DELAY: Duration = Duration::from_millis(500);
const WS_MAX_RECONNECT_DELAY: Duration = Duration::from_secs(5);
const WS_CONNECTION_CHECK_INTERVAL: Duration = Duration::from_secs(1);

fn next_ws_connection_id() -> WebSocketConnectionId {
    loop {
        let id = NEXT_WS_CONNECTION_ID.fetch_add(1, Ordering::Relaxed);
        if id != 0 {
            return id;
        }
    }
}

fn websocket_error_message(error: impl std::fmt::Display) -> Value {
    serde_json::to_value(WebSocketMessage::Text(format!("Websocket error: {error}"))).unwrap_or(Value::Null)
}

fn normalize_websocket_text(text: String) -> (Value, bool) {
    // related to [crates/tauri-plugin-mihomo/src/error.rs::WebSocket]
    if text.starts_with("Websocket error") || text.starts_with("websocket error") {
        return (
            serde_json::to_value(WebSocketMessage::Text(text)).unwrap_or(Value::Null),
            true,
        );
    }

    if serde_json::from_str::<Value>(&text).is_err() {
        return (websocket_error_message(text), true);
    }

    (
        serde_json::to_value(WebSocketMessage::Text(text)).unwrap_or(Value::Null),
        false,
    )
}

fn normalize_websocket_message(data: Value) -> (Value, bool) {
    match serde_json::from_value::<WebSocketMessage>(data.clone()) {
        Ok(WebSocketMessage::Text(text)) => normalize_websocket_text(text),
        Ok(WebSocketMessage::Close(close)) => (
            serde_json::to_value(WebSocketMessage::Close(close)).unwrap_or(Value::Null),
            true,
        ),
        Ok(message) => (serde_json::to_value(message).unwrap_or(Value::Null), false),
        Err(_) => (data, false),
    }
}

fn forward_mihomo_ws_message(
    data: Value,
    on_message: &Channel<Value>,
    event_tx: &mpsc::UnboundedSender<MihomoWsEvent>,
) {
    let (data, should_reconnect) = normalize_websocket_message(data);
    if on_message.send(data).is_err() {
        let _ = event_tx.send(MihomoWsEvent::Shutdown);
        return;
    }
    if should_reconnect {
        let _ = event_tx.send(MihomoWsEvent::Reconnect);
    }
}

fn buffer_or_forward_mihomo_log_ws_message(
    data: Value,
    on_message: &Channel<Value>,
    event_tx: &mpsc::UnboundedSender<MihomoWsEvent>,
    log_buffer: &Arc<Mutex<BufferedLogMessages>>,
) {
    let mut data = Some(data);
    if let Ok(mut log_buffer) = log_buffer.lock()
        && log_buffer.buffering
        && let Some(data) = data.take()
    {
        tracing::debug!("log snapshot not send done, buffering log data");
        log_buffer.messages.push(data);
    }

    if let Some(data) = data {
        forward_mihomo_ws_message(data, on_message, event_tx);
    }
}

fn flush_mihomo_log_ws_buffer(
    log_buffer: Arc<Mutex<BufferedLogMessages>>,
    on_message: &Channel<Value>,
    event_tx: &mpsc::UnboundedSender<MihomoWsEvent>,
) -> bool {
    let Ok(mut log_buffer) = log_buffer.lock() else {
        return false;
    };

    log_buffer.buffering = false;
    for data in log_buffer.messages.drain(..) {
        forward_mihomo_ws_message(data, on_message, event_tx);
    }

    true
}

fn quoted_log_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let pattern = format!("{key}=\"");
    let start = line.find(&pattern)? + pattern.len();
    let end = line[start..].find('"')?;
    Some(&line[start..start + end])
}

fn unquoted_log_value<'a>(line: &'a str, key: &str) -> Option<&'a str> {
    let pattern = format!("{key}=");
    let start = line.find(&pattern)? + pattern.len();
    let end = line[start..].find(char::is_whitespace).unwrap_or(line.len() - start);
    Some(&line[start..start + end])
}

fn split_once_whitespace(value: &str) -> Option<(&str, &str)> {
    let index = value.find(char::is_whitespace)?;
    Some((&value[..index], value[index..].trim_start()))
}

fn normalize_log_type(log_type: &str) -> String {
    match log_type.to_ascii_lowercase().as_str() {
        "warn" => "warning".to_string(),
        "err" => "error".to_string(),
        "inf" => "info".to_string(),
        value => value.to_string(),
    }
}

fn format_log_time(time: &str) -> String {
    DateTime::parse_from_rfc3339(time)
        .map(|time| time.with_timezone(&Local).format("%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|_| time.to_string())
}

fn parse_clash_log_line(line: &str) -> Option<CmdLogItem> {
    if let (Some(time), Some(log_type), Some(payload)) = (
        quoted_log_value(line, "time"),
        unquoted_log_value(line, "level"),
        quoted_log_value(line, "msg"),
    ) {
        return Some(CmdLogItem {
            time: format_log_time(time),
            log_type: normalize_log_type(log_type),
            payload: payload.to_string(),
        });
    }

    let line = line.trim_start();
    let (time, rest) = split_once_whitespace(line)?;
    let (log_type, payload) = split_once_whitespace(rest)?;

    Some(CmdLogItem {
        time: time.to_string(),
        log_type: normalize_log_type(log_type),
        payload: payload.to_string(),
    })
}

async fn collect_clash_log_lines() -> anyhow::Result<VecDeque<String>> {
    let enable_service_mode = Config::verge().latest().enable_service_mode.unwrap_or_default();
    let logs = if enable_service_mode {
        let res = service::get_logs().await?;
        res.data.unwrap_or_default()
    } else {
        logger::Logger::global().get_logs().clone()
    };
    Ok(logs)
}

async fn send_log_snapshot(on_message: &Channel<Value>) -> bool {
    let logs = match collect_clash_log_lines().await {
        Ok(logs) => logs,
        Err(err) => {
            tracing::warn!("failed to collect mihomo log snapshot: {err}");
            return true;
        }
    };
    let logs = logs
        .iter()
        .filter_map(|line| parse_clash_log_line(line))
        .collect::<Vec<_>>();

    let text = match serde_json::to_string(&logs) {
        Ok(text) => text,
        Err(err) => {
            tracing::warn!("failed to serialize mihomo log snapshot: {err}");
            return true;
        }
    };
    let message = serde_json::to_value(WebSocketMessage::Text(text)).unwrap_or(Value::Null);
    on_message.send(message).is_ok()
}

async fn open_mihomo_ws_connection(
    endpoint: &MihomoWsEndpoint,
    on_message: Arc<Channel<Value>>,
    event_tx: mpsc::UnboundedSender<MihomoWsEvent>,
) -> anyhow::Result<OpenedMihomoWsConnection> {
    match endpoint {
        MihomoWsEndpoint::Traffic => {
            let on_message = on_message.clone();
            let event_tx = event_tx.clone();
            let backend_id = handle::Handle::mihomo()
                .await
                .ws_traffic(move |data| forward_mihomo_ws_message(data, &on_message, &event_tx))
                .await?;
            Ok(OpenedMihomoWsConnection {
                backend_id,
                log_buffer: None,
            })
        }
        MihomoWsEndpoint::Memory => {
            let on_message = on_message.clone();
            let event_tx = event_tx.clone();
            let backend_id = handle::Handle::mihomo()
                .await
                .ws_memory(move |data| forward_mihomo_ws_message(data, &on_message, &event_tx))
                .await?;
            Ok(OpenedMihomoWsConnection {
                backend_id,
                log_buffer: None,
            })
        }
        MihomoWsEndpoint::Connections => {
            let on_message = on_message.clone();
            let event_tx = event_tx.clone();
            let backend_id = handle::Handle::mihomo()
                .await
                .ws_connections(move |data| forward_mihomo_ws_message(data, &on_message, &event_tx))
                .await?;
            Ok(OpenedMihomoWsConnection {
                backend_id,
                log_buffer: None,
            })
        }
        MihomoWsEndpoint::Logs(level) => {
            let on_message = on_message.clone();
            let event_tx = event_tx.clone();
            let log_buffer = Arc::new(Mutex::new(BufferedLogMessages {
                buffering: true,
                messages: Vec::new(),
            }));
            let callback_log_buffer = log_buffer.clone();
            let backend_id = handle::Handle::mihomo()
                .await
                .ws_logs(*level, move |data| {
                    buffer_or_forward_mihomo_log_ws_message(data, &on_message, &event_tx, &callback_log_buffer)
                })
                .await?;
            Ok(OpenedMihomoWsConnection {
                backend_id,
                log_buffer: Some(log_buffer),
            })
        }
    }
}

async fn disconnect_active_mihomo_ws(
    active_id: &Arc<RwLock<Option<WebSocketConnectionId>>>,
    force_timeout: Option<u64>,
) {
    if let Some(active_id) = active_id.write().await.take() {
        let _ = handle::Handle::mihomo()
            .await
            .disconnect(active_id, force_timeout)
            .await;
    }
}

async fn wait_mihomo_ws_disconnect(
    backend_id: WebSocketConnectionId,
    mut shutdown_rx: watch::Receiver<bool>,
    mut event_rx: mpsc::UnboundedReceiver<MihomoWsEvent>,
) -> bool {
    let connection_manager = handle::Handle::mihomo().await.connection_manager.clone();
    let mut check_interval = tokio::time::interval(WS_CONNECTION_CHECK_INTERVAL);

    loop {
        tokio::select! {
            result = shutdown_rx.changed() => {
                return result.is_err() || *shutdown_rx.borrow();
            }
            event = event_rx.recv() => {
                return matches!(event, Some(MihomoWsEvent::Shutdown));
            }
            _ = check_interval.tick() => {
                if !connection_manager.0.read().await.contains_key(&backend_id) {
                    return false;
                }
            }
        }
    }
}

async fn sleep_before_reconnect(shutdown_rx: &mut watch::Receiver<bool>, delay: Duration) -> bool {
    tokio::select! {
        result = shutdown_rx.changed() => result.is_err() || *shutdown_rx.borrow(),
        _ = tokio::time::sleep(delay) => false,
    }
}

async fn run_mihomo_ws_connection(
    connection_id: WebSocketConnectionId,
    endpoint: MihomoWsEndpoint,
    on_message: Arc<Channel<Value>>,
    active_id: Arc<RwLock<Option<WebSocketConnectionId>>>,
    mut shutdown_rx: watch::Receiver<bool>,
) {
    let mut reconnect_delay = WS_RECONNECT_DELAY;

    loop {
        if *shutdown_rx.borrow() {
            break;
        }

        let (event_tx, event_rx) = mpsc::unbounded_channel();
        match open_mihomo_ws_connection(&endpoint, on_message.clone(), event_tx.clone()).await {
            Ok(connection) => {
                let backend_id = connection.backend_id;
                *active_id.write().await = Some(backend_id);
                reconnect_delay = WS_RECONNECT_DELAY;

                if matches!(&endpoint, MihomoWsEndpoint::Logs(_)) && !send_log_snapshot(&on_message).await {
                    break;
                }
                if let Some(log_buffer) = connection.log_buffer
                    && !flush_mihomo_log_ws_buffer(log_buffer, &on_message, &event_tx)
                {
                    break;
                }

                let should_shutdown = wait_mihomo_ws_disconnect(backend_id, shutdown_rx.clone(), event_rx).await;
                disconnect_active_mihomo_ws(&active_id, Some(0)).await;

                if should_shutdown || sleep_before_reconnect(&mut shutdown_rx, WS_RECONNECT_DELAY).await {
                    break;
                }
            }
            Err(err) => {
                tracing::warn!("failed to connect mihomo websocket {endpoint:?}: {err}");
                if on_message.send(websocket_error_message(err)).is_err() {
                    break;
                }
                if sleep_before_reconnect(&mut shutdown_rx, reconnect_delay).await {
                    break;
                }
                reconnect_delay = reconnect_delay.saturating_mul(2).min(WS_MAX_RECONNECT_DELAY);
            }
        }
    }

    disconnect_active_mihomo_ws(&active_id, Some(0)).await;
    MIHOMO_WS_CONNECTIONS.write().await.remove(&connection_id);
}

async fn connect_mihomo_ws(
    endpoint: MihomoWsEndpoint,
    on_message: Channel<Value>,
) -> anyhow::Result<WebSocketConnectionId> {
    let connection_id = next_ws_connection_id();
    let generation = MIHOMO_WS_GENERATION.load(Ordering::Acquire);
    let active_id = Arc::new(RwLock::new(None));
    let (shutdown_tx, shutdown_rx) = watch::channel(false);
    let (start_tx, start_rx) = oneshot::channel();
    let on_message = Arc::new(on_message);
    let task_active_id = active_id.clone();

    let task = tokio::spawn(async move {
        let _ = start_rx.await;
        run_mihomo_ws_connection(connection_id, endpoint, on_message, task_active_id, shutdown_rx).await;
    });

    let mut connections = MIHOMO_WS_CONNECTIONS.write().await;
    if generation != MIHOMO_WS_GENERATION.load(Ordering::Acquire) {
        let _ = shutdown_tx.send(true);
        task.abort();
        anyhow::bail!("mihomo websocket connection was cleared before start");
    }

    connections.insert(
        connection_id,
        MihomoWsConnection {
            active_id,
            shutdown_tx,
            task,
        },
    );
    let _ = start_tx.send(());

    Ok(connection_id)
}

async fn disconnect_mihomo_ws(id: WebSocketConnectionId, force_timeout: Option<u64>) -> anyhow::Result<()> {
    if let Some(connection) = MIHOMO_WS_CONNECTIONS.write().await.remove(&id) {
        let _ = connection.shutdown_tx.send(true);
        disconnect_active_mihomo_ws(&connection.active_id, force_timeout).await;
        connection.task.abort();
    }
    Ok(())
}

async fn clear_mihomo_ws_connections() -> anyhow::Result<()> {
    MIHOMO_WS_GENERATION.fetch_add(1, Ordering::AcqRel);
    let connections = {
        let mut connections = MIHOMO_WS_CONNECTIONS.write().await;
        connections
            .drain()
            .map(|(_, connection)| connection)
            .collect::<Vec<_>>()
    };

    for connection in connections {
        let _ = connection.shutdown_tx.send(true);
        disconnect_active_mihomo_ws(&connection.active_id, Some(0)).await;
        connection.task.abort();
    }

    let _ = handle::Handle::mihomo().await.clear_all_ws_connections().await;
    Ok(())
}

#[tauri::command]
pub async fn ws_traffic(on_message: Channel<Value>) -> CommandResult<WebSocketConnectionId> {
    into_command_result(connect_mihomo_ws(MihomoWsEndpoint::Traffic, on_message).await)
}

#[tauri::command]
pub async fn ws_memory(on_message: Channel<Value>) -> CommandResult<WebSocketConnectionId> {
    into_command_result(connect_mihomo_ws(MihomoWsEndpoint::Memory, on_message).await)
}

#[tauri::command]
pub async fn ws_connections(on_message: Channel<Value>) -> CommandResult<WebSocketConnectionId> {
    into_command_result(connect_mihomo_ws(MihomoWsEndpoint::Connections, on_message).await)
}

#[tauri::command]
pub async fn ws_logs(level: LogLevel, on_message: Channel<Value>) -> CommandResult<WebSocketConnectionId> {
    into_command_result(connect_mihomo_ws(MihomoWsEndpoint::Logs(level), on_message).await)
}

#[tauri::command]
pub async fn ws_disconnect(id: WebSocketConnectionId, force_timeout: Option<u64>) -> CommandResult<()> {
    into_command_result(disconnect_mihomo_ws(id, force_timeout).await)
}

#[tauri::command]
pub async fn clear_all_ws_connections() -> CommandResult<()> {
    into_command_result(clear_mihomo_ws_connections().await)
}
