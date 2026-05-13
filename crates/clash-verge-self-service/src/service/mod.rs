pub mod data;
mod handle;
mod logger;

use std::{
    collections::HashSet,
    path::PathBuf,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use anyhow::{Result, anyhow};
use bytes::{BufMut, BytesMut};
use chacha20poly1305::{
    XChaCha20Poly1305,
    aead::{
        Aead, KeyInit, OsRng,
        rand_core::{self, RngCore},
    },
};
use data::{JsonResponse, SocketCommand};
use futures::StreamExt;
pub use handle::ClashRunInfo;
use handle::{get_clash, get_logs, get_version, start_clash, stop_clash};
use hkdf::Hkdf;
use parking_lot::Mutex;
use tipsy::{Connection, Endpoint, IntoIpcPath, OnConflict, SecurityAttributes, ServerId};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    sync::watch::{Sender, channel},
};
#[cfg(windows)]
use windows_service::{
    service::{ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus},
    service_control_handler::{self, ServiceControlHandlerResult},
};
use x25519_dalek::{PublicKey, StaticSecret};

use crate::{DEFAULT_SERVER_ID, KEY_INFO};

macro_rules! wrap_response {
    ($expr: expr) => {
        match $expr {
            Ok(data) => serde_json::to_string(&JsonResponse {
                code: 0,
                msg: "ok".into(),
                data: Some(data),
            }),
            Err(err) => serde_json::to_string(&JsonResponse {
                code: 400,
                msg: format!("{err}"),
                data: Option::<()>::None,
            }),
        }
    };
}

pub struct SecureChannel {
    stream: Connection,
    aead: Arc<XChaCha20Poly1305>,
    // 该 IPC 服务不存在大量并发，所以使用 Arc<Mutex<HashSet<u64>>> 已经够用了
    seen_ids: Arc<Mutex<HashSet<u64>>>,
    /// each request timestamp (millions)
    timestamp_window: u128,
}

impl SecureChannel {
    pub async fn send(&mut self, plaintext: &[u8]) -> Result<()> {
        // timestamp (u64)
        let ts = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis();
        let ts_bytes = ts.to_be_bytes();

        // message ID (u64 random)
        let mut msg_id_bytes = [0u8; 8];
        OsRng.fill_bytes(&mut msg_id_bytes);
        // let msg_id = u64::from_be_bytes(msg_id_bytes);
        // println!("send msg id: {}", msg_id);

        // build plaintext buffer
        // total length = 16(ts) + 8(msg_id) + payload(n)
        let mut full_plaintext = Vec::with_capacity(16 + 8 + plaintext.len());
        full_plaintext.extend_from_slice(&ts_bytes);
        full_plaintext.extend_from_slice(&msg_id_bytes);
        full_plaintext.extend_from_slice(plaintext);

        let mut nonce = [0u8; 24];
        OsRng.fill_bytes(&mut nonce);
        let cipher = self
            .aead
            .encrypt(&nonce.into(), full_plaintext.as_slice())
            .map_err(|e| anyhow!("encrypt failed: {e}"))?;

        // frame = length(4) + nonce(24) + cipher(n)
        let total_len = (24 + cipher.len()) as u32;
        let mut data = BytesMut::with_capacity(4 + total_len as usize);
        data.put_u32(total_len);
        data.put_slice(&nonce);
        data.put_slice(&cipher);

        // write
        self.stream.write_all(&data).await?;
        self.stream.flush().await?;

        Ok(())
    }

    pub async fn recv(&mut self) -> Result<Vec<u8>> {
        // read 4-byte length
        let mut len_buf = [0u8; 4];
        self.stream
            .read_exact(&mut len_buf)
            .await
            .map_err(|_| anyhow!("invalid connection"))?;
        let frame_len = u32::from_be_bytes(len_buf) as usize;

        // read whole frame
        let mut buf = vec![0u8; frame_len];
        self.stream
            .read_exact(&mut buf)
            .await
            .map_err(|_| anyhow!("invalid connection"))?;

        let (nonce_bytes, cipher) = buf.split_at(24);
        let plaintext = self
            .aead
            .decrypt(nonce_bytes.into(), cipher)
            .map_err(|e| anyhow!("decrypt failed: {e}"))?;

        // the `ts` and `msg_id` strings together are at least 24 bytes long.
        if plaintext.len() < 24 {
            return Err(anyhow!("payload too short"));
        }

        let ts = u128::from_be_bytes(plaintext[0..16].try_into()?);
        let msg_id = u64::from_be_bytes(plaintext[16..24].try_into()?);

        // Check timestamp is recent (allow 5s drift) and ID not seen
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis();
        let request_timestamp = now - ts;
        if request_timestamp > self.timestamp_window {
            return Err(anyhow!(
                "replay attack: old timestamp, request: {}, now: {}, timestamp: {}",
                ts,
                now,
                self.timestamp_window
            ));
        }

        let mut ids = self.seen_ids.lock();
        if !ids.insert(msg_id) {
            return Err(anyhow!("replay attack: duplicate message ID"));
        }

        Ok(plaintext[24..].to_vec())
    }
}

/// The Service
pub async fn run_service(server_id: Option<String>, psk: Option<&[u8]>) -> Result<()> {
    // NOTE: comment follow windows code for debug
    // 开启服务 设置服务状态
    #[cfg(windows)]
    let status_handle =
        service_control_handler::register(crate::SERVICE_NAME, move |event| -> ServiceControlHandlerResult {
            match event {
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                ServiceControl::Stop => std::process::exit(0),
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        })?;
    #[cfg(windows)]
    status_handle.set_service_status(ServiceStatus {
        service_type: crate::SERVICE_TYPE,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: std::time::Duration::default(),
        process_id: None,
    })?;

    let server_id = server_id.unwrap_or(DEFAULT_SERVER_ID.to_string());
    let temp_dir = if cfg!(windows) {
        std::env::temp_dir()
    } else {
        PathBuf::from("/tmp")
    };
    log::info!("temp_dir: {}", temp_dir.display());
    let path = ServerId::new(server_id).parent_folder(temp_dir);
    log::info!("socket path: {}", path.clone().into_ipc_path()?.display());
    let security_attributes = SecurityAttributes::allow_everyone_connect()?;
    let incoming = Endpoint::new(path, OnConflict::Overwrite)?
        .security_attributes(security_attributes)
        .incoming()?;
    futures::pin_mut!(incoming);

    let (shutdown_tx, mut shutdown_rx) = channel(());

    tokio::select! {
         _ = async {
            while let Some(result) = incoming.next().await {
                match result {
                    Ok(stream) => {
                        log::info!("handshake server");
                        let secured = SecureChannel::handshake_server(stream, psk).await?;
                        log::info!("receive client request");
                        spawn_read_task(secured, shutdown_tx.clone()).await;
                    }
                    _ => unreachable!("ideally")
                }
            }
            Result::<()>::Ok(())
        } => { }
        _ = shutdown_rx.changed() => {
            let _ = stop_service();
            log::info!("Shutdown Service");
        }
        _ = tokio::signal::ctrl_c() => {
            let _ = stop_service();
            log::info!("Shutdown Service by Ctrl+C");
        }
    }

    Ok(())
}

impl SecureChannel {
    pub async fn handshake_server(mut stream: Connection, psk: Option<&[u8]>) -> Result<SecureChannel> {
        let server_secret = StaticSecret::random_from_rng(rand_core::OsRng);
        let server_pub = PublicKey::from(&server_secret);

        let mut client_pub_bytes = [0u8; 32];
        stream.read_exact(&mut client_pub_bytes).await?;
        let client_pub = PublicKey::from(client_pub_bytes);

        stream.write_all(server_pub.as_bytes()).await?;

        let shared = server_secret.diffie_hellman(&client_pub);
        // derive symmetric key via HKDF-SHA256, mix in PSK as salt if provided
        let hk = match psk {
            Some(salt) => Hkdf::<sha2::Sha256>::new(Some(salt), shared.as_bytes()),
            None => Hkdf::<sha2::Sha256>::new(None, shared.as_bytes()),
        };
        let mut key = [0u8; 32];
        hk.expand(KEY_INFO, &mut key)
            .map_err(|_| anyhow!("hkdf expand failed"))?;

        let aead = XChaCha20Poly1305::new(&key.into());
        Ok(SecureChannel {
            stream,
            aead: Arc::new(aead),
            seen_ids: Arc::new(Mutex::new(HashSet::new())),
            timestamp_window: 500,
        })
    }

    pub async fn handshake_client(mut stream: Connection, psk: Option<&[u8]>) -> Result<SecureChannel> {
        let client_secret = StaticSecret::random_from_rng(rand_core::OsRng);
        let client_pub = PublicKey::from(&client_secret);

        stream.write_all(client_pub.as_bytes()).await?;

        let mut server_pub_bytes = [0u8; 32];
        stream.read_exact(&mut server_pub_bytes).await?;
        let server_pub = PublicKey::from(server_pub_bytes);

        let shared = client_secret.diffie_hellman(&server_pub);
        // derive symmetric key via HKDF-SHA256, mix in PSK as salt if provided
        let hk = match psk {
            Some(salt) => Hkdf::<sha2::Sha256>::new(Some(salt), shared.as_bytes()),
            None => Hkdf::<sha2::Sha256>::new(None, shared.as_bytes()),
        };
        let mut key = [0u8; 32];
        hk.expand(KEY_INFO, &mut key)
            .map_err(|_| anyhow!("hkdf expand failed"))?;

        let aead = XChaCha20Poly1305::new(&key.into());
        Ok(SecureChannel {
            stream,
            aead: Arc::new(aead),
            seen_ids: Arc::new(Mutex::new(HashSet::new())),
            timestamp_window: 500,
        })
    }
}

async fn spawn_read_task(mut secured: SecureChannel, shutdown_tx: Sender<()>) {
    tokio::spawn(async move {
        while let Ok(msg) = secured.recv().await {
            let send_error_resp = async |secured: &mut SecureChannel, e: anyhow::Result<()>| {
                log::info!("send error response to back");
                let response = wrap_response!(e)?;
                secured.send(response.as_bytes()).await?;
                Result::<()>::Ok(())
            };

            let req_data = String::from_utf8_lossy(&msg);
            let cmd = match serde_json::from_str::<SocketCommand>(&req_data) {
                Ok(cmd) => cmd,
                Err(err) => {
                    log::error!("Error parsing socket command: {err}");
                    send_error_resp(&mut secured, Err(anyhow!("Error parsing socket command: {err}"))).await?;
                    continue;
                }
            };

            if let Err(err) = handle_socket_command(&mut secured, cmd.clone()).await {
                log::error!("Error handling socket command: {err}");
                send_error_resp(&mut secured, Err(anyhow!("Error handling socket command: {err}"))).await?;
            };

            if let SocketCommand::StopService = cmd {
                secured.stream.shutdown().await?;
                log::info!("stop service");
                let _ = shutdown_tx.send(());
                break;
            }
        }
        log::info!("Connection closed");
        Result::<()>::Ok(())
    });
}

/// handle socket command and write response message
async fn handle_socket_command(secured: &mut SecureChannel, cmd: SocketCommand) -> Result<()> {
    log::info!("Handling socket command: {cmd:?}");
    let response = match cmd {
        SocketCommand::GetVersion => wrap_response!(get_version())?,
        SocketCommand::GetClash => wrap_response!(get_clash())?,
        SocketCommand::GetLogs => wrap_response!(get_logs())?,
        SocketCommand::StartClash(body) => wrap_response!(start_clash(body).await)?,
        SocketCommand::StopClash => {
            #[cfg(unix)]
            let socket_path = {
                let clash_status = handle::ClashStatus::global();
                clash_status.info.lock().clone().and_then(|i| i.socket_path)
            };
            let res = wrap_response!(stop_clash().await)?;
            #[cfg(unix)]
            {
                if let Some(socket_path) = socket_path {
                    log::info!("delete socket path");
                    let path = std::path::Path::new(&socket_path);
                    if path.exists() {
                        std::fs::remove_file(path)?;
                    }
                }
            }
            res
        }
        SocketCommand::StopService => wrap_response!(Result::<()>::Ok(()))?,
    };
    secured.send(response.as_bytes()).await?;
    Ok(())
}

/// 停止服务
#[cfg(windows)]
fn stop_service() -> Result<()> {
    let status_handle =
        service_control_handler::register(crate::SERVICE_NAME, |_| ServiceControlHandlerResult::NoError)?;
    use crate::SERVICE_TYPE;

    status_handle.set_service_status(ServiceStatus {
        service_type: SERVICE_TYPE,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: std::time::Duration::default(),
        process_id: None,
    })?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn stop_service() -> Result<()> {
    // systemctl stop clash_verge_service
    std::process::Command::new("systemctl")
        .arg("stop")
        .arg(crate::SERVICE_NAME)
        .output()?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn stop_service() -> Result<()> {
    std::process::Command::new("launchctl")
        .arg("stop")
        .arg("io.github.clashvergeself.helper")
        .output()?;
    Ok(())
}
