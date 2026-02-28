use std::{
    pin::Pin,
    task::{Context, Poll},
};

use pin_project::pin_project;
use tokio::io::{AsyncRead, AsyncWrite};
#[cfg(unix)]
use tokio::net::UnixStream;
#[cfg(windows)]
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
#[cfg(windows)]
use windows_sys::Win32::Foundation::ERROR_PIPE_BUSY;

use crate::{Error, Result};

#[pin_project(project = WrapStreamProj)]
pub enum WrapStream {
    #[cfg(unix)]
    Unix(#[pin] UnixStream),
    #[cfg(windows)]
    NamedPipe(#[pin] NamedPipeClient),
}

impl WrapStream {
    pub fn is_available(&self) -> Result<bool> {
        match self {
            #[cfg(unix)]
            WrapStream::Unix(s) => {
                use std::io::ErrorKind;

                let mut buf = [0u8; 1];
                match s.try_read(&mut buf) {
                    Ok(n) => Ok(n != 0),
                    Err(e) if e.kind() == ErrorKind::WouldBlock => Ok(true),
                    Err(e) => Err(Error::Io(e)),
                }
            }
            #[cfg(windows)]
            WrapStream::NamedPipe(s) => {
                use std::io::ErrorKind;

                let mut buf = [0u8; 1];
                match s.try_read(&mut buf) {
                    Ok(n) => Ok(n != 0),
                    Err(e) if e.kind() == ErrorKind::WouldBlock => Ok(true),
                    Err(e) => Err(Error::Io(e)),
                }
            }
        }
    }

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

pub async fn connect_to_socket(socket_path: &str) -> Result<WrapStream> {
    #[cfg(unix)]
    {
        if !std::path::Path::new(socket_path).exists() {
            log::error!("socket path is not exists: {socket_path}");
            return Err(Error::Io(std::io::Error::new(
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
                    return Err(Error::FailedResponse(format!(
                        "Failed to connect to named pipe: {socket_path}, {e}"
                    )));
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        };
        Ok(WrapStream::NamedPipe(client))
    }
}
