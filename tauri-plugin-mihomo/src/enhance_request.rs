use reqwest::RequestBuilder;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::utils::{build_socket_request, parse_socket_response};

pub trait LocalSocket {
    async fn send_to_local_socket(self, socket_path: &str) -> crate::Result<reqwest::Response>;
}

impl LocalSocket for RequestBuilder {
    async fn send_to_local_socket(self, socket_path: &str) -> crate::Result<reqwest::Response> {
        #[cfg(unix)]
        {
            use tokio::net::UnixStream;
            let mut stream = UnixStream::connect(socket_path).await?;
            let req_str = build_socket_request(self)?;
            println!("generate request string: {:?} \n", req_str);
            stream.writable().await?;
            stream.write_all(req_str.as_bytes()).await?;
            stream.readable().await?;
            let mut buf: Vec<u8> = Vec::new();
            let mut b = [0; 4096];
            loop {
                let n = stream.read(&mut b).await?;
                buf.extend_from_slice(&b[..n]);
                // if response is chunked, wait to \r\n\r\n
                if buf.ends_with(b"\r\n\r\n") || (n < 4096 && buf.ends_with(b"\n")) {
                    break;
                }
            }
            let response = String::from_utf8_lossy(&buf);
            parse_socket_response(&response)
        }
        #[cfg(windows)]
        {
            unimplemented!()
        }
    }
}
