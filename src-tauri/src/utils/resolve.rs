use crate::config::PrfOption;
use crate::{
    config::{Config, PrfItem},
    core::*,
    utils::init,
    utils::server,
};
use crate::{log_err, trace_err};
use anyhow::Result;
use rust_i18n::t;
use std::net::TcpListener;
use tauri::{AppHandle, CloseRequestApi, Manager};

pub fn find_unused_port() -> Result<u16> {
    match TcpListener::bind("127.0.0.1:0") {
        Ok(listener) => {
            let port = listener.local_addr()?.port();
            Ok(port)
        }
        Err(_) => {
            let port = Config::clash().latest().get_mixed_port();
            log::warn!(target: "app", "use default port: {}", port);
            Ok(port)
        }
    }
}

/// handle something when start app
pub async fn resolve_setup() {
    log::trace!("init resources");
    log_err!(init::init_resources());
    log::trace!("init scheme");
    log_err!(init::init_scheme());
    log::trace!("init startup script");
    log_err!(init::startup_script().await);
    // 启动核心
    log::trace!("init config");
    log_err!(Config::init_config());
    log::trace!("launch core");
    log_err!(CoreManager::global().init());
    // setup a simple http server for singleton
    log::trace!("launch embed server");
    server::embed_server();
    log::trace!("init autolaunch");
    log_err!(sysopt::Sysopt::global().init_launch());
    log::trace!("init system proxy");
    log_err!(sysopt::Sysopt::global().init_sysproxy());
    log::trace!("update system tray");
    log_err!(handle::Handle::update_systray_part());
    log::trace!("init hotkey");
    log_err!(hotkey::Hotkey::global().init());
    log::trace!("init webdav config");
    log_err!(backup::WebDav::global().init().await);
    log::trace!("init timer");
    log_err!(timer::Timer::global().init());

    let argvs = std::env::args().collect::<Vec<String>>();
    if argvs.len() > 1 {
        let param = argvs[1].as_str();
        if param.starts_with("clash:") {
            resolve_scheme(argvs[1].to_owned()).await;
        }
    }
}

/// reset system proxy
pub async fn resolve_reset() {
    log_err!(sysopt::Sysopt::global().reset_sysproxy());
    log_err!(CoreManager::global().stop_core().await);
}

/// create main window
pub fn create_window() {
    let app_handle = handle::Handle::get_app_handle();
    if let Some(window) = app_handle.get_webview_window("main") {
        trace_err!(window.unminimize(), "set win unminimize");
        trace_err!(window.show(), "set win visible");
        trace_err!(window.set_focus(), "set win focus");
        return;
    }

    let verge = Config::verge().latest().clone();
    let start_page = verge.start_page.unwrap_or("/".into());

    let mut builder = tauri::WebviewWindowBuilder::new(
        app_handle,
        "main".to_string(),
        tauri::WebviewUrl::App(start_page.into()),
    )
    .title("Clash Verge")
    .fullscreen(false)
    .maximized(verge.window_is_maximized.unwrap_or(false))
    .min_inner_size(600.0, 520.0);

    let _decoration = verge.enable_system_title_bar.unwrap_or(false);
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.decorations(_decoration);
    }

    match verge.window_size_position {
        Some(size_pos) if size_pos.len() == 4 => {
            let size = (size_pos[0], size_pos[1]);
            let pos = (size_pos[2], size_pos[3]);
            let w = size.0.clamp(600.0, f64::INFINITY);
            let h = size.1.clamp(520.0, f64::INFINITY);
            builder = builder.inner_size(w, h).position(pos.0, pos.1);
            // adjust window size on wayland when it is enable decoration
            #[cfg(target_os = "linux")]
            {
                use crate::cmds;
                let is_wayland = cmds::is_wayland().unwrap_or(false);
                if _decoration && is_wayland {
                    builder = builder
                        .inner_size(w - 90.0, h - 90.0)
                        .position(pos.0, pos.1);
                }
            }
        }
        _ => {
            builder = builder.inner_size(800.0, 642.0).center();
        }
    };
    #[cfg(target_os = "windows")]
    let window = builder
        .additional_browser_args("--enable-features=msWebView2EnableDraggableRegions --disable-features=OverscrollHistoryNavigation,msExperimentalScrolling")
        .transparent(true)
        .visible(false)
        .shadow(true)
        .build();
    #[cfg(target_os = "macos")]
    let window = builder
        .decorations(true)
        .visible(false)
        .hidden_title(true)
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .shadow(true)
        .build();
    #[cfg(target_os = "linux")]
    let window = {
        use crate::cmds;
        let visiable = _decoration && cmds::is_wayland().unwrap_or(false);
        builder
            .visible(visiable)
            .shadow(true)
            .transparent(true)
            .build()
    };

    match window {
        Ok(win) => {
            log::trace!("try to calculate the monitor size");
            let center = (|| -> Result<bool> {
                let mut center = false;
                let monitor = win.current_monitor()?.ok_or(anyhow::anyhow!(""))?;
                let size = monitor.size();
                let pos = win.outer_position()?;

                if pos.x < -400
                    || pos.x > (size.width - 200) as i32
                    || pos.y < -200
                    || pos.y > (size.height - 200) as i32
                {
                    center = true;
                }
                Ok(center)
            })();
            if center.unwrap_or(true) {
                trace_err!(win.center(), "set win center");
            }
            #[cfg(debug_assertions)]
            win.open_devtools();
        }
        Err(_) => {
            log::error!("failed to create window");
        }
    }
}

/// save window size and position
pub fn save_window_size_position(app_handle: &AppHandle, save_to_file: bool) -> Result<()> {
    let verge = Config::verge();
    let mut verge = verge.latest();

    if let Some(win) = app_handle.get_webview_window("main") {
        let scale = win.scale_factor()?;
        let size = win.inner_size()?;
        let size = size.to_logical::<f64>(scale);
        let pos = win.outer_position()?;
        let pos = pos.to_logical::<f64>(scale);
        let is_maximized = win.is_maximized()?;
        verge.window_is_maximized = Some(is_maximized);
        if !is_maximized && size.width >= 600.0 && size.height >= 520.0 {
            verge.window_size_position = Some(vec![size.width, size.height, pos.x, pos.y]);
        }
    }

    if save_to_file {
        verge.save_file()?;
    }

    Ok(())
}

pub async fn resolve_scheme(param: String) {
    let url = param
        .trim_start_matches("clash://install-config/?url=")
        .trim_start_matches("clash://install-config?url=");
    let option = PrfOption {
        user_agent: None,
        with_proxy: Some(true),
        self_proxy: None,
        danger_accept_invalid_certs: None,
        update_interval: None,
    };
    if let Ok(item) = PrfItem::from_url(url, None, None, Some(option)).await {
        if Config::profiles().data().append_item(item).is_ok() {
            let _ = handle::Handle::notification("Clash Verge", t!("import.success"));
        };
    } else {
        let _ = handle::Handle::notification("Clash Verge", t!("import.failed"));
        log::error!("failed to parse url: {}", url);
    }
}

pub fn handle_window_close(api: CloseRequestApi, app_handle: &AppHandle) {
    let verge = Config::verge();
    let verge = verge.latest();

    let keep_ui_active = verge.enable_keep_ui_active.unwrap_or(false);
    if keep_ui_active {
        app_handle
            .get_webview_window("main")
            .unwrap()
            .hide()
            .unwrap();
        api.prevent_close();
    }
}
