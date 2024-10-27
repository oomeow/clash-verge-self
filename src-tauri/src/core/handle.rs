use super::tray::Tray;
use crate::log_err;
use anyhow::{bail, Ok, Result};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Default, Clone)]
pub struct Handle {
    pub app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl Handle {
    pub fn global() -> &'static Handle {
        static HANDLE: OnceCell<Handle> = OnceCell::new();

        HANDLE.get_or_init(|| Handle {
            app_handle: Arc::new(Mutex::new(None)),
        })
    }

    pub fn init(&self, app_handle: AppHandle) {
        *self.app_handle.lock() = Some(app_handle);
    }

    pub fn get_app_handle(&self) -> Result<AppHandle> {
        if self.app_handle.lock().is_none() {
            bail!("app_handle is none")
        }
        let app_handle = self.app_handle.lock().clone().unwrap();
        Ok(app_handle)
    }

    pub fn get_window(&self) -> Option<WebviewWindow> {
        let app_handle = self.get_app_handle().expect("failed to get app handle");
        app_handle.get_webview_window("main")
    }

    pub fn refresh_clash() {
        if let Some(window) = Self::global().get_window() {
            log_err!(window.emit("verge://refresh-clash-config", "yes"));
        }
    }

    pub fn refresh_verge() {
        if let Some(window) = Self::global().get_window() {
            log_err!(window.emit("verge://refresh-verge-config", "yes"));
        }
    }

    #[allow(unused)]
    pub fn refresh_profiles() {
        if let Some(window) = Self::global().get_window() {
            log_err!(window.emit("verge://refresh-profiles-config", "yes"));
        }
    }

    pub fn notice_message<S: Into<String>, M: Into<String>>(status: S, msg: M) {
        if let Some(window) = Self::global().get_window() {
            log_err!(window.emit("verge://notice-message", (status.into(), msg.into())));
        }
    }

    pub fn update_systray() -> Result<()> {
        let app_handle = Self::global().get_app_handle()?;
        Tray::update_systray(&app_handle)?;
        Ok(())
    }

    /// update the system tray state
    pub fn update_systray_part() -> Result<()> {
        let app_handle = Self::global().get_app_handle()?;
        Tray::update_part(&app_handle)?;
        Ok(())
    }

    pub fn set_tray_visible(visible: bool) -> Result<()> {
        let app_handle = Self::global().get_app_handle()?;
        Tray::set_tray_visible(&app_handle, visible)?;
        Ok(())
    }

    pub fn notification<T: Into<String>, B: Into<String>>(title: T, body: B) -> Result<()> {
        let app_handle = Self::global().get_app_handle()?;
        let _ = app_handle
            .notification()
            .builder()
            .title(title)
            .body(body)
            .show();
        Ok(())
    }

    pub fn show_block_dialog<T: Into<String>, M: Into<String>>(
        title: T,
        message: M,
        kind: MessageDialogKind,
        buttons: MessageDialogButtons,
    ) -> Result<bool> {
        let app_handle = Self::global().get_app_handle()?;
        let status = app_handle
            .dialog()
            .message(message)
            .title(title)
            .buttons(buttons)
            .kind(kind)
            .blocking_show();
        Ok(status)
    }
}
