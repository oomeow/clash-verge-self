use std::backtrace::{Backtrace, BacktraceStatus};

use anyhow::Result;
use rust_i18n::t;
use tauri::{AppHandle, CloseRequestApi, Manager};

use crate::{
    APP_HANDLE, AppState,
    config::{Config, PrfItem, PrfOption, SilentStartMode},
    core::{verge_log::VergeLog, *},
    log_err, shutdown, trace_err,
    utils::{
        dirs::{self, APP_ID},
        init, server,
    },
};

pub fn priority_initialization() {
    tracing::trace!("init system tray");
    log_err!(tray::Tray::init());
    tracing::trace!("init resources");
    log_err!(init::init_resources());
    tracing::trace!("init config");
    log_err!(Config::init_config());
    tracing::trace!("launch core");
    log_err!(CoreManager::global().init());
    tracing::trace!("register os shutdown handler");
    shutdown::register();

    let exists_archive_file = dirs::backup_archive_file().is_ok_and(|file| file.exists());
    if exists_archive_file {
        // 应用备份后重启直接显示窗口
        create_window();
    } else {
        if !is_silent_start() {
            create_window();
        }
    }
}

pub fn async_initialization() {
    tauri::async_runtime::spawn(async {
        tracing::trace!("init startup script");
        log_err!(init::startup_script().await);
        tracing::trace!("delete old log files");
        log_err!(VergeLog::delete_log());
        tracing::trace!("launch embed server");
        server::embed_server().await;
        tracing::trace!("init autolaunch");
        log_err!(sysopt::Sysopt::global().init_launch());
        tracing::trace!("init system proxy");
        log_err!(sysopt::Sysopt::global().init_sysproxy());
        tracing::trace!("update system tray");
        log_err!(handle::Handle::update_systray_part());
        tracing::trace!("init hotkey");
        log_err!(hotkey::Hotkey::global().init());
        tracing::trace!("init timer");
        log_err!(timer::Timer::global().init());
        tracing::trace!("init webdav config");
        log_err!(backup::WebDav::global().init().await);
    });
}

pub fn setup_panic_hook() {
    std::panic::set_hook(Box::new(move |panic_info| {
        let payload = panic_info.payload();
        let payload = if let Some(s) = payload.downcast_ref::<&str>() {
            &**s
        } else if let Some(s) = payload.downcast_ref::<String>() {
            s
        } else {
            &format!("{payload:?}")
        };

        let location = panic_info
            .location()
            .map(|l| l.to_string())
            .unwrap_or("unknown location".to_string());

        let backtrace = Backtrace::capture();
        let backtrace = if backtrace.status() == BacktraceStatus::Captured {
            t!("dialog.panic.backtrace", backtrace = backtrace)
        } else {
            t!("dialog.panic.displayBacktraceNote")
        };

        tracing::error!("panicked at {}:\n{}\n{}", location, payload, backtrace);
        let limit_backtrace = backtrace.lines().take(10).collect::<Vec<_>>().join("\n");
        let log_file = VergeLog::global().get_log_file().unwrap_or_default();
        let log_file = log_file.split(APP_ID).last().unwrap_or_default();
        let content = t!(
            "dialog.panic.content",
            location = location,
            payload = payload,
            limit_backtrace = limit_backtrace,
            log_file = log_file,
        );
        rfd::MessageDialog::new()
            .set_title(t!("dialog.panic.title"))
            .set_description(content)
            .set_buttons(rfd::MessageButtons::Ok)
            .set_level(rfd::MessageLevel::Error)
            .show();

        // avoid window freezing, spawn a new thread to resolve reset
        let task = std::thread::spawn(|| async {
            resolve_reset().await;
        });
        let _ = task.join();
        if let Some(app_handle) = APP_HANDLE.get() {
            let app_state = app_handle.state::<AppState>();
            app_state.is_exiting.store(true, std::sync::atomic::Ordering::SeqCst);
            app_handle.exit(1);
        } else {
            std::process::exit(1);
        }
    }));
}

/// reset system proxy
pub async fn resolve_reset() {
    log_err!(sysopt::Sysopt::global().reset_sysproxy());
    log_err!(CoreManager::global().stop_core().await);
}

/// create main window
pub fn create_window() {
    let app_handle = handle::Handle::app_handle();
    if let Some(window) = app_handle.get_webview_window("main") {
        trace_err!(window.unminimize(), "set win unminimize");
        trace_err!(window.show(), "set win visible");
        trace_err!(window.set_focus(), "set win focus");
        #[cfg(target_os = "macos")]
        {
            apply_tray_policy(app_handle, true);
        }
        return;
    }

    let verge = Config::verge();
    let verge = verge.latest();
    let start_page = verge.start_page.as_deref().unwrap_or("/");

    let mut builder = tauri::WebviewWindowBuilder::new(app_handle, "main", tauri::WebviewUrl::App(start_page.into()))
        .title("Clash Verge Self")
        .fullscreen(false)
        .maximized(verge.window_is_maximized.unwrap_or(false))
        .min_inner_size(600.0, 550.0);

    let _decoration = verge.enable_system_title_bar.unwrap_or(false);
    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.decorations(_decoration);
    }

    match &verge.window_size_position {
        Some(size_pos) if size_pos.len() == 4 => {
            let size = (size_pos[0], size_pos[1]);
            let pos = (size_pos[2], size_pos[3]);
            let w = size.0.clamp(600.0, f64::INFINITY);
            let h = size.1.clamp(550.0, f64::INFINITY);
            builder = builder.inner_size(w, h).position(pos.0, pos.1);
        }
        _ => {
            builder = builder.inner_size(1100.0, 750.0).center();
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
        use crate::X11_RENDER;

        builder
            .visible(!*X11_RENDER.read())
            .shadow(true)
            .transparent(true)
            .build()
    };

    match window {
        Ok(win) => {
            tracing::trace!("try to calculate the monitor size");
            let center = (|| -> Result<bool> {
                let mut center = false;
                let monitors = win.available_monitors()?;
                let max_width: u32 = monitors.iter().map(|m| m.size().width).sum();
                let max_height: u32 = monitors.iter().map(|m| m.size().height).sum();
                let pos = win.outer_position()?;
                if pos.x < -400 || pos.x > (max_width - 200) as i32 || pos.y < -200 || pos.y > (max_height - 200) as i32
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

            #[cfg(target_os = "macos")]
            {
                apply_tray_policy(app_handle, true);
            }
        }
        Err(e) => {
            tracing::error!("failed to create window: {e}");
        }
    }
}

/// save window size and position
pub fn save_window_size_position(app_handle: &AppHandle) -> Result<()> {
    let verge = Config::verge();
    let mut verge = verge.latest_mut();
    if let Some(win) = app_handle.get_webview_window("main") {
        let scale = win.scale_factor()?;
        let size = win.inner_size()?;
        let size = size.to_logical::<f64>(scale);
        let pos = win.outer_position()?;
        let pos = pos.to_logical::<f64>(scale);
        let is_maximized = win.is_maximized()?;
        verge.window_is_maximized = Some(is_maximized);
        if !is_maximized && size.width >= 600.0 && size.height >= 550.0 {
            #[cfg(target_os = "linux")]
            {
                use crate::X11_RENDER;

                let enable_system_title_bar = verge.enable_system_title_bar.unwrap_or_default();
                let (width, height) = if crate::utils::unix_helper::is_rendered_by_nvidia_only() {
                    if enable_system_title_bar {
                        (size.width - 90., size.height - 90.)
                    } else {
                        (size.width + 90., size.height + 90.)
                    }
                } else if !*X11_RENDER.read() && crate::utils::unix_helper::is_wayland() && enable_system_title_bar {
                    // wayland 渲染模式下，获取到的 inner size 是不正确的
                    // 因为 wayland 下的系统标题栏是 Tauri 自己绘制的，其 inner size 没有排除系统标题栏相关的大小, 所以需要自己计算
                    (size.width - 90., size.height - 138.)
                } else {
                    (size.width, size.height)
                };
                verge.window_size_position = Some(vec![width, height, pos.x, pos.y]);
            }
            #[cfg(not(target_os = "linux"))]
            {
                verge.window_size_position = Some(vec![size.width, size.height, pos.x, pos.y]);
            }
        }
    }
    verge.save_file()?;
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
        if Config::profiles().data_mut().append_item(item).is_ok() {
            handle::Handle::notify("Clash Verge", t!("notice.import.success"));
        };
    } else {
        handle::Handle::notify("Clash Verge", t!("notice.import.failed"));
        tracing::error!("failed to parse url: {}", url);
    }
}

pub fn resolve_deep_links(urls: impl IntoIterator<Item = String>) {
    let urls: Vec<String> = urls.into_iter().collect();
    tauri::async_runtime::spawn(async move {
        for url in urls {
            if !url.starts_with("clash:") {
                tracing::debug!("ignored unsupported deep link: {url}");
                continue;
            }
            resolve_scheme(url).await;
        }
    });
}

pub fn handle_window_close(api: CloseRequestApi, app_handle: &AppHandle) {
    if Config::verge().latest().enable_keep_ui_active.unwrap_or_default() {
        if let Some(window) = app_handle.get_webview_window("main") {
            let _ = window.hide();
        }
        api.prevent_close();
    }
}

pub fn is_silent_start() -> bool {
    let env = handle::Handle::app_handle().env();
    let is_bootup_silent = env.args_os.iter().any(|i| i == "--hidden");
    let silent_start = Config::verge().latest().silent_start_mode.clone().unwrap_or_default();
    matches!(silent_start, SilentStartMode::Bootup) && is_bootup_silent
        || matches!(silent_start, SilentStartMode::Global)
}

#[cfg(target_os = "macos")]
pub fn apply_tray_policy(app: &tauri::AppHandle, dock_visible: bool) {
    if let Err(err) = app.set_dock_visibility(dock_visible) {
        tracing::warn!("set dock visibility failed: {err}");
    }
    let policy = if dock_visible {
        tauri::ActivationPolicy::Regular
    } else {
        tauri::ActivationPolicy::Accessory
    };
    if let Err(err) = app.set_activation_policy(policy) {
        tracing::warn!("set activation policy failed: {err}");
    }
}
