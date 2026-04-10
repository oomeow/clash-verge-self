use std::{
    pin::Pin,
    task::{Context, Poll},
};

use futures_util::{
    SinkExt, StreamExt,
    stream::{SplitSink, SplitStream},
};
use pin_project::pin_project;
#[cfg(unix)]
use tokio::net::UnixStream;
#[cfg(windows)]
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tokio::{
    io::{AsyncRead, AsyncWrite},
    net::TcpStream,
};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, tungstenite::Message};
#[cfg(windows)]
use windows_sys::Win32::Foundation::ERROR_PIPE_BUSY;

use crate::{Error, Result};

pub enum WsStream {
    Tcp(WebSocketStream<MaybeTlsStream<TcpStream>>),
    Socket(WebSocketStream<SocketStreamKind>),
}

impl From<WebSocketStream<MaybeTlsStream<TcpStream>>> for WsStream {
    fn from(value: WebSocketStream<MaybeTlsStream<TcpStream>>) -> Self {
        WsStream::Tcp(value)
    }
}

impl From<WebSocketStream<SocketStreamKind>> for WsStream {
    fn from(value: WebSocketStream<SocketStreamKind>) -> Self {
        WsStream::Socket(value)
    }
}

impl WsStream {
    pub fn split(self) -> (WsWriteKind, WsReadeKind) {
        match self {
            Self::Tcp(stream) => {
                let (write, read) = stream.split();
                (WsWriteKind::Tcp(write), WsReadeKind::Tcp(read))
            }
            Self::Socket(stream) => {
                let (write, read) = stream.split();
                (WsWriteKind::Socket(write), WsReadeKind::Socket(read))
            }
        }
    }
}

pub enum WsReadeKind {
    Tcp(SplitStream<WebSocketStream<MaybeTlsStream<TcpStream>>>),
    Socket(SplitStream<WebSocketStream<SocketStreamKind>>),
}

impl WsReadeKind {
    pub async fn next(&mut self) -> Option<crate::Result<Message>> {
        match self {
            Self::Tcp(read) => read.next().await.map(|v| v.map_err(Into::into)),
            Self::Socket(read) => read.next().await.map(|v| v.map_err(Into::into)),
        }
    }
}

pub enum WsWriteKind {
    Tcp(SplitSink<WebSocketStream<MaybeTlsStream<TcpStream>>, Message>),
    Socket(SplitSink<WebSocketStream<SocketStreamKind>, Message>),
}

impl WsWriteKind {
    pub async fn send(&mut self, message: Message) -> crate::Result<()> {
        match self {
            Self::Tcp(write) => write.send(message).await?,
            Self::Socket(write) => write.send(message).await?,
        }
        Ok(())
    }
}

#[pin_project(project = WrapStreamProj)]
pub enum SocketStreamKind {
    #[cfg(unix)]
    Unix(#[pin] UnixStream),
    #[cfg(windows)]
    NamedPipe(#[pin] NamedPipeClient),
}

impl AsyncRead for SocketStreamKind {
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

impl AsyncWrite for SocketStreamKind {
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

pub async fn connect_to_socket(socket_path: &str) -> Result<SocketStreamKind> {
    #[cfg(unix)]
    {
        if !std::path::Path::new(socket_path).exists() {
            log::error!("socket path is not exists: {socket_path}");
            return Err(Error::Io(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("socket path: {socket_path} not found"),
            )));
        }
        Ok(SocketStreamKind::Unix(UnixStream::connect(socket_path).await?))
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
        Ok(SocketStreamKind::NamedPipe(client))
    }
}
