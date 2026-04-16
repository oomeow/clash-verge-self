use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use tokio::sync::oneshot;
use warp::Filter;

use crate::config::{Config, DEFAULT_PAC, IVerge};

// 关闭 embedded server 的信号发送端
static SHUTDOWN_SENDER: OnceCell<Mutex<Option<oneshot::Sender<()>>>> = OnceCell::new();

/// The embed server is used to serve PAC content.
pub async fn embed_server() {
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    SHUTDOWN_SENDER
        .set(Mutex::new(Some(shutdown_tx)))
        .expect("failed to set shutdown signal for embedded server");
    let port = IVerge::get_singleton_port();

    let pac = warp::path!("commands" / "pac").map(move || {
        let verge = Config::verge();
        let verge = verge.latest();
        let content = verge.pac_file_content.as_deref().unwrap_or(DEFAULT_PAC);
        let port = Config::clash().latest().get_mixed_port();
        let content = content.replace("%mixed-port%", &format!("{port}"));
        warp::http::Response::builder()
            .header("Content-Type", "application/x-ns-proxy-autoconfig")
            .body(content)
            .unwrap_or_default()
    });

    tauri::async_runtime::spawn(async move {
        warp::serve(pac)
            .bind(([127, 0, 0, 1], port))
            .await
            .graceful(async {
                shutdown_rx.await.ok();
            })
            .run()
            .await;
    });
}

pub fn shutdown_embedded_server() {
    tracing::info!("shutting down embedded server");
    if let Some(sender) = SHUTDOWN_SENDER.get()
        && let Some(sender) = sender.lock().take()
    {
        sender.send(()).ok();
    }
}
