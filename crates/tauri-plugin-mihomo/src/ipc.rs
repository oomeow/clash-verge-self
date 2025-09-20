use std::{
    pin::Pin,
    task::{Context, Poll},
};

use pin_project::pin_project;
use reqwest::RequestBuilder;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
#[cfg(unix)]
use tokio::net::UnixStream;
#[cfg(windows)]
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
#[cfg(windows)]
use windows_sys::Win32::Foundation::ERROR_PIPE_BUSY;

use crate::utils;

#[pin_project(project = WrapStreamProj)]
pub enum WrapStream {
    #[cfg(unix)]
    Unix(#[pin] UnixStream),
    #[cfg(windows)]
    NamedPipe(#[pin] NamedPipeClient),
}

impl WrapStream {
    pub async fn readable(&self) -> std::io::Result<()> {
        match self {
            #[cfg(unix)]
            WrapStream::Unix(s) => s.readable().await,
            #[cfg(windows)]
            WrapStream::NamedPipe(s) => s.readable().await,
        }
    }
    pub async fn writable(&self) -> std::io::Result<()> {
        match self {
            #[cfg(unix)]
            WrapStream::Unix(s) => s.writable().await,
            #[cfg(windows)]
            WrapStream::NamedPipe(s) => s.writable().await,
        }
    }
}

impl AsyncRead for WrapStream {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        match self.project() {
            #[cfg(unix)]
            WrapStreamProj::Unix(s) => s.poll_read(cx, buf),
            #[cfg(windows)]
            WrapStreamProj::NamedPipe(s) => s.poll_read(cx, buf),
        }
    }
}

impl AsyncWrite for WrapStream {
    fn poll_write(self: Pin<&mut Self>, cx: &mut Context<'_>, buf: &[u8]) -> Poll<std::io::Result<usize>> {
        match self.project() {
            #[cfg(unix)]
            WrapStreamProj::Unix(s) => s.poll_write(cx, buf),
            #[cfg(windows)]
            WrapStreamProj::NamedPipe(s) => s.poll_write(cx, buf),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        match self.project() {
            #[cfg(unix)]
            WrapStreamProj::Unix(s) => s.poll_flush(cx),
            #[cfg(windows)]
            WrapStreamProj::NamedPipe(s) => s.poll_flush(cx),
        }
    }

    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<std::io::Result<()>> {
        match self.project() {
            #[cfg(unix)]
            WrapStreamProj::Unix(s) => s.poll_shutdown(cx),
            #[cfg(windows)]
            WrapStreamProj::NamedPipe(s) => s.poll_shutdown(cx),
        }
    }
}

pub async fn connect_to_socket(socket_path: &str) -> crate::Result<WrapStream> {
    #[cfg(unix)]
    {
        if !std::path::Path::new(socket_path).exists() {
            log::error!("socket path is not exists: {socket_path}");
            return Err(crate::Error::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("socket path: {socket_path} not found"),
            )));
        }
        Ok(WrapStream::Unix(UnixStream::connect(socket_path).await?))
    }

    #[cfg(windows)]
    {
        let client = loop {
            match ClientOptions::new().open(socket_path) {
                Ok(client) => break client,
                Err(e) if e.raw_os_error() == Some(ERROR_PIPE_BUSY as i32) => (),
                Err(e) => {
                    log::error!("failed to connect to named pipe: {socket_path}, {e}");
                    return Err(crate::Error::FailedResponse(format!(
                        "Failed to connect to named pipe: {socket_path}, {e}"
                    )));
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        };
        Ok(WrapStream::NamedPipe(client))
    }
}

pub trait LocalSocket {
    async fn send_by_local_socket(self, socket_path: &str) -> crate::Result<reqwest::Response>;
}

impl LocalSocket for RequestBuilder {
    async fn send_by_local_socket(self, socket_path: &str) -> crate::Result<reqwest::Response> {
        let request = self.build()?;
        let timeout = request.timeout().cloned();

        let process = async move {
            let mut stream = connect_to_socket(socket_path).await?;
            log::debug!("building socket request");
            let req_str = utils::build_socket_request(request)?;
            log::debug!("request string: {req_str:?}");
            stream.writable().await?;
            log::debug!("send request");
            stream.write_all(req_str.as_bytes()).await?;
            log::debug!("wait for response");
            stream.readable().await?;

            let mut reader = BufReader::new(stream);

            // 解析 header
            let mut header = String::new();
            loop {
                let mut line = String::new();
                if let Ok(size) = reader.read_line(&mut line).await
                    && size == 0
                {
                    return Err(crate::Error::HttpParseError("no response".to_string()));
                }
                header.push_str(&line);
                if line == "\r\n" {
                    break;
                }
            }
            // println!("---> header:\n {header:?}");

            // 解析 Content-Length, chunked
            let mut content_length: Option<usize> = None;
            let mut is_chunked = false;
            for line in header.lines() {
                if let Some(v) = line.to_lowercase().strip_prefix("content-length: ") {
                    content_length = Some(v.trim().parse()?);
                }
                if line.to_lowercase().contains("transfer-encoding: chunked") {
                    is_chunked = true;
                }
            }

            // 读取 body
            let body = if is_chunked {
                let mut body = Vec::new();
                loop {
                    // 读 chunk size
                    let mut size_line = String::new();
                    reader.read_line(&mut size_line).await?;
                    let size_line = size_line.trim();
                    if size_line.is_empty() {
                        continue;
                    }
                    let chunk_size = usize::from_str_radix(size_line, 16)
                        .map_err(|e| crate::Error::HttpParseError(format!("Failed to parse chunk size: {e}")))?;

                    if chunk_size == 0 {
                        // 读掉最后的 CRLF
                        let mut end = String::new();
                        reader.read_line(&mut end).await?;
                        break;
                    }

                    // 读 chunk data
                    let mut chunk_data = vec![0u8; chunk_size];
                    reader.read_exact(&mut chunk_data).await?;
                    body.extend_from_slice(&chunk_data);

                    // 读掉结尾 CRLF
                    let mut crlf = String::new();
                    reader.read_line(&mut crlf).await?;
                }
                String::from_utf8(body)?
            } else if let Some(content_length) = content_length {
                println!("content length: {content_length}");
                let mut body_buf = vec![0u8; content_length];
                reader.read_exact(&mut body_buf).await?;
                String::from_utf8_lossy(&body_buf).to_string()
            } else {
                unimplemented!()
            };
            log::debug!("receive response success, shut down stream");
            reader.shutdown().await?;
            utils::parse_socket_response(&header, &body)
        };

        match timeout {
            Some(duration) => {
                log::debug!("Timeout duration: {:?}", duration);
                tokio::time::timeout(duration, process).await?
            }
            None => {
                log::debug!("No timeout specified");
                process.await
            }
        }
    }
}
