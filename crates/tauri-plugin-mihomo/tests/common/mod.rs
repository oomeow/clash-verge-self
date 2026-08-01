use std::time::Duration;

use tauri_plugin_mihomo::{Mihomo, MihomoContext, models::Protocol};

#[allow(dead_code)]
pub const TEST_URL: &str = "http://www.gstatic.com/generate_204";
#[allow(dead_code)]
pub const TIMEOUT: u32 = 3000;

pub fn mihomo() -> Mihomo {
    dotenvy::dotenv().unwrap();
    let use_local_socket = std::env::var("MIHOMO_SOCKET").unwrap_or(String::from("0")) == "1";
    let request_timeout = Duration::from_secs(5);
    let socket_path = if use_local_socket {
        if cfg!(unix) {
            Some("/tmp/self-mihomo.sock".to_string())
            // Some("/tmp/clash-rs.sock".to_string())
        } else {
            Some(r"\\.\pipe\self-mihomo".to_string())
            // Some(r"\\.\pipe\clash-rs".to_string())
        }
    } else {
        None
    };
    let protocol = if use_local_socket {
        Protocol::LocalSocket
    } else {
        Protocol::Http
    };
    let client = MihomoContext::build_client(&protocol, socket_path.as_deref()).unwrap();
    if use_local_socket {
        println!("connect to mihomo by local socket");
        let ctx = MihomoContext {
            protocol: Protocol::LocalSocket,
            external_host: None,
            external_port: None,
            secret: None,
            socket_path,
            request_timeout,
            client,
        };
        Mihomo::new(ctx)
    } else {
        println!("connect to mihomo by http");
        let ctx = MihomoContext {
            protocol: Protocol::Http,
            external_host: Some("127.0.0.1".into()),
            external_port: Some(9090),
            secret: Some("0Zhf7izbK7IeXgpQeKzNQ".into()),
            socket_path,
            request_timeout,
            client,
        };
        Mihomo::new(ctx)
    }
}
