use std::{
    backtrace::{Backtrace, BacktraceStatus},
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};

use anyhow::Result;
use rust_i18n::t;
use tauri::{AppHandle, CloseRequestApi, Emitter, Listener, Manager};
use tokio::sync::oneshot;

use crate::{
    APP_HANDLE, AppState,
    cmds::mihomo_ws::CANCEL_MIHOMO_WS_RECONNECT,
    config::{Config, PrfItem, PrfOption, SilentStartMode},
    core::{verge_log::VergeLog, *},
    log_err, shutdown, trace_err,
    utils::{
        dirs::{self, APP_ID},
        init, server,
    },
};

const FRONTEND_READY_EVENT: &str = "verge://frontend-ready";
const FRONTEND_READY_TIMEOUT: Duration = Duration::from_secs(8);
const FRONTEND_READY_SCRIPT: &str = r#"
(() => {
  const readyEvent = "verge://frontend-ready";
  window.__VERGE_FRONTEND_READY__ = false;
  window.addEventListener(readyEvent, () => {
    window.__VERGE_FRONTEND_READY__ = true;
    window.__TAURI_INTERNALS__
      ?.invoke("plugin:event|emit", { event: readyEvent, payload: null })
      ?.catch(console.error);
  }, { once: true });
})();
"#;

static FRONTEND_READY: AtomicBool = AtomicBool::new(false);

fn listen_frontend_ready(app_handle: &AppHandle) -> (tauri::EventId, oneshot::Receiver<()>) {
    let (sender, receiver) = oneshot::channel();
    let event_id = app_handle.once(FRONTEND_READY_EVENT, move |_| {
        FRONTEND_READY.store(true, Ordering::SeqCst);
        let _ = sender.send(());
    });
    (event_id, receiver)
}

async fn wait_frontend_ready(app_handle: AppHandle, frontend_ready: (tauri::EventId, oneshot::Receiver<()>)) {
    let (event_id, receiver) = frontend_ready;
    if FRONTEND_READY.load(Ordering::SeqCst) {
        app_handle.unlisten(event_id);
        return;
    }

    match tokio::time::timeout(FRONTEND_READY_TIMEOUT, receiver).await {
        Ok(Ok(())) => {
            tracing::info!("frontend ready event received");
        }
        Ok(Err(_)) => {
            app_handle.unlisten(event_id);
            tracing::warn!("frontend ready listener was canceled");
        }
        Err(_) => {
            app_handle.unlisten(event_id);
            tracing::warn!("timed out waiting for frontend ready event");
        }
    }
}

fn navigate_after_frontend_ready(app_handle: AppHandle, route: String) {
    if FRONTEND_READY.load(Ordering::SeqCst) {
        navigate_window_to_route(&route);
        return;
    }

    let frontend_ready = listen_frontend_ready(&app_handle);
    tauri::async_runtime::spawn(async move {
        wait_frontend_ready(app_handle, frontend_ready).await;
        navigate_window_to_route(&route);
    });
}

#[allow(unused)]
async fn wait_current_frontend_ready(app_handle: AppHandle) {
    if FRONTEND_READY.load(Ordering::SeqCst) {
        return;
    }

    let frontend_ready = listen_frontend_ready(&app_handle);
    wait_frontend_ready(app_handle, frontend_ready).await;
}

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

    #[cfg(target_os = "linux")]
    {
        tracing::trace!("watch linux theme changed");
        tauri::async_runtime::spawn(watch_linux_theme_changed());
    }

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

#[cfg(target_os = "linux")]
async fn watch_linux_theme_changed() {
    match dark_light::subscribe() {
        Ok(watcher) => {
            for mode in watcher.iter() {
                let theme = match mode {
                    dark_light::Mode::Dark => tauri::Theme::Dark,
                    dark_light::Mode::Light => tauri::Theme::Light,
                    dark_light::Mode::Unspecified => tauri::Theme::Light, // fallback to light
                };
                let _ = handle::Handle::app_handle().emit("tauri://theme-changed", theme);
            }
        }
        Err(err) => {
            tracing::error!("watch linux theme changed: {}", err);
        }
    }
}

pub fn async_initialization() {
    tauri::async_runtime::spawn(async {
        tracing::trace!("init startup script");
        log_err!(init::startup_script().await);

        tracing::trace!("delete old log files");
        log_err!(VergeLog::delete_logs());

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

        let get_relative_path = |path: std::path::PathBuf| {
            let path_str = path.to_string_lossy();
            if let Some((_, suffix)) = path_str.split_once(APP_ID) {
                suffix.trim_start_matches(['/', '\\']).to_string()
            } else {
                path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(path_str.as_ref())
                    .to_string()
            }
        };
        let app_log_file = get_relative_path(VergeLog::global().get_app_log_file());
        let clash_log_file = get_relative_path(VergeLog::global().get_clash_log_file());

        let content = t!(
            "dialog.panic.content",
            location = location,
            payload = payload,
            limit_backtrace = limit_backtrace,
            app_log_file = app_log_file,
            clash_log_file = clash_log_file,
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

/// Navigate the existing main window to a React Router route.
/// If the window doesn't exist, this is a no-op.
#[allow(unused)]
pub fn navigate_window_to_route(route: &str) {
    if let Some(window) = handle::Handle::app_handle().get_webview_window("main") {
        trace_err!(window.emit("navigate_to_route", route), "emit navigate_to_route event");
    }
}

/// create main window (with optional route navigation)
pub fn create_window() {
    create_window_with_route(None);
}

/// create main window and optionally navigate to a route if window already exists
pub fn create_window_with_route(route: Option<&str>) {
    CANCEL_MIHOMO_WS_RECONNECT.store(false, Ordering::SeqCst);
    let app_handle = handle::Handle::app_handle();
    if let Some(window) = app_handle.get_webview_window("main") {
        trace_err!(window.unminimize(), "set win unminimize");
        trace_err!(window.show(), "set win visible");
        trace_err!(window.set_focus(), "set win focus");
        if let Some(route) = route {
            navigate_after_frontend_ready(app_handle.clone(), route.to_string());
        }
        #[cfg(target_os = "macos")]
        {
            apply_tray_policy(app_handle, true);
        }
        return;
    }
    FRONTEND_READY.store(false, Ordering::SeqCst);
    let should_wait_frontend_ready = route.is_some();
    let frontend_ready = should_wait_frontend_ready.then(|| listen_frontend_ready(app_handle));

    let verge = Config::verge().latest().clone();
    let start_page = if let Some(route) = route {
        route
    } else {
        verge.start_page.as_deref().unwrap_or("/")
    };

    let mut builder = tauri::WebviewWindowBuilder::new(app_handle, "main", tauri::WebviewUrl::App(start_page.into()))
        .title("Clash Verge Self")
        .fullscreen(false)
        .maximized(verge.window_is_maximized.unwrap_or(false))
        .min_inner_size(600.0, 550.0)
        .initialization_script(FRONTEND_READY_SCRIPT)
        .general_autofill_enabled(false);

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
            tracing::debug!("try to calculate the monitor size");
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
                tracing::debug!("apply tray policy");
                apply_tray_policy(app_handle, true);
            }

            if let Some(frontend_ready) = frontend_ready {
                let app_handle = app_handle.clone();
                tauri::async_runtime::spawn(async move {
                    wait_frontend_ready(app_handle, frontend_ready).await;
                });
            }
        }
        Err(e) => {
            if let Some((event_id, _)) = frontend_ready {
                app_handle.unlisten(event_id);
            }
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

pub fn resolve_deep_links(urls: impl IntoIterator<Item = String>) {
    let urls: Vec<String> = urls.into_iter().collect();
    tauri::async_runtime::spawn(async move {
        create_window_with_route(Some("/profiles"));
        for url in urls {
            if !url.starts_with("clash:") {
                tracing::debug!("ignored unsupported deep link: {url}");
                continue;
            }
            let url = url
                .trim_start_matches("clash://install-config/?url=")
                .trim_start_matches("clash://install-config?url=");
            let option = PrfOption {
                user_agent: None,
                with_proxy: Some(true),
                self_proxy: None,
                danger_accept_invalid_certs: None,
                update_interval: None,
            };

            let url = percent_encoding::percent_decode_str(url).decode_utf8()?;
            let restart_core = {
                if let Ok(item) = PrfItem::from_url(&url, None, None, Some(option)).await {
                    if let Ok(restart_core_) = Config::profiles().latest_mut().append_item(item) {
                        if handle::Handle::get_window().is_some() {
                            handle::Handle::notice_message(handle::NoticeStatus::Success, t!("notice.import.success"));
                        } else {
                            handle::Handle::notify("Clash Verge", t!("notice.import.success"));
                        }
                        handle::Handle::refresh_profiles();
                        restart_core_
                    } else {
                        false
                    }
                } else {
                    if handle::Handle::get_window().is_some() {
                        tokio::time::sleep(Duration::from_secs(1)).await;
                        handle::Handle::notice_message(handle::NoticeStatus::Error, t!("notice.import.failed"));
                    } else {
                        handle::Handle::notify("Clash Verge", t!("notice.import.failed"));
                    }
                    tracing::error!("failed to parse url: {}", url);
                    false
                }
            };

            if restart_core {
                CoreManager::global().update_config().await?;
                handle::Handle::refresh_clash();
            }
            handle::Handle::update_systray_part()?;
        }

        anyhow::Ok(())
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
