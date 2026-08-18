#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

mod cmds;
mod config;
mod core;
mod enhance;
mod feat;
mod shutdown;
mod utils;

use core::verge_log::VergeLog;
#[cfg(target_os = "linux")]
use std::sync::LazyLock;
use std::sync::atomic::{AtomicBool, Ordering};

use anyhow::Result;
use once_cell::sync::OnceCell;
#[cfg(target_os = "linux")]
use parking_lot::RwLock;
use tauri::{AppHandle, Manager};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_mihomo::models::Protocol;

use crate::{
    cmds::mihomo_ws::CANCEL_MIHOMO_WS_RECONNECT,
    config::Config,
    core::handle,
    utils::{init, resolve},
};

rust_i18n::i18n!("locales", fallback = "en");

#[derive(Debug, Default)]
pub struct AppState {
    pub app_version: String,
    pub is_exiting: AtomicBool,
}

#[cfg(target_os = "linux")]
pub static X11_RENDER: LazyLock<RwLock<bool>> = LazyLock::new(|| RwLock::new(false));

pub static APP_HANDLE: OnceCell<AppHandle> = OnceCell::new();

#[cfg(all(unix, not(feature = "verge-dev")))]
pub const MIHOMO_SOCKET_PATH: &str = "/tmp/self-mihomo.sock";
#[cfg(all(unix, feature = "verge-dev"))]
pub const MIHOMO_SOCKET_PATH: &str = "/tmp/self-mihomo-dev.sock";

#[cfg(all(windows, not(feature = "verge-dev")))]
pub const MIHOMO_SOCKET_PATH: &str = r"\\.\pipe\self-mihomo";
#[cfg(all(windows, feature = "verge-dev"))]
pub const MIHOMO_SOCKET_PATH: &str = r"\\.\pipe\self-mihomo-dev";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<()> {
    #[cfg(target_os = "linux")]
    {
        if utils::unix_helper::is_rendered_by_nvidia_only() {
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        } else if utils::unix_helper::is_wayland() {
            unsafe {
                std::env::set_var("GDK_BACKEND", "x11");
            }
            *X11_RENDER.write() = true;
        }
    }

    init::init_dirs_and_config()?;
    let language = Config::verge().latest().language.clone().unwrap_or("zh_CN".to_string());
    rust_i18n::set_locale(&language);

    // 初始化日志
    let _g = VergeLog::global().init()?;

    // panic hook
    resolve::setup_panic_hook();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
            // 当通过深链（clash: 协议）启动第二个实例时，避免创建重复窗口。(Only supported on Windows/Linux)
            // 深链处理系统会通过 on_open_url 事件监听器创建带有正确路由的窗口。
            let mut args = argv.into_iter();
            args.next(); // bin name
            let arg = args.next(); // first argument
            if arg.is_some_and(|arg| arg.starts_with("clash:")) {
                return;
            }
            resolve::create_window();
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(
            tauri_plugin_mihomo::Builder::new()
                .protocol(Protocol::LocalSocket)
                .socket_path(MIHOMO_SOCKET_PATH)
                .build(),
        )
        .setup(|app| {
            let app_handle = app.handle();
            APP_HANDLE
                .set(app_handle.clone())
                .expect("failed to set global app handle");

            #[cfg(any(target_os = "windows", target_os = "linux"))]
            {
                if let Err(e) = app.deep_link().register_all() {
                    tracing::error!("failed to register deep link: {e}");
                }
            }

            #[cfg(target_os = "macos")]
            {
                if resolve::is_silent_start() {
                    let dock_visible: bool = Config::verge().latest().keep_in_dock.unwrap_or(true);
                    resolve::apply_tray_policy(app_handle, dock_visible);
                }
            }

            let version = app_handle.package_info().version.to_string();
            app_handle.manage(AppState {
                app_version: version,
                is_exiting: AtomicBool::new(false),
            });

            resolve::priority_initialization();
            resolve::async_initialization();

            if let Some(urls) = app.deep_link().get_current()? {
                tracing::debug!("handle current deep link: {:?}", urls);
                resolve::resolve_deep_links(urls.into_iter().map(|url| url.to_string()));
            }
            app.deep_link().on_open_url(|event| {
                let urls = event.urls();
                tracing::debug!("handle deep link on open url: {:?}", urls);
                resolve::resolve_deep_links(urls.iter().map(|url| url.to_string()));
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // common
            cmds::common::get_sys_proxy,
            cmds::common::get_default_bypass,
            cmds::common::get_auto_proxy,
            cmds::common::get_app_dir,
            cmds::common::get_default_backup_dir,
            cmds::common::open_app_dir,
            cmds::common::open_logs_dir,
            cmds::common::open_web_url,
            cmds::common::open_core_dir,
            cmds::common::is_portable_version,
            cmds::common::is_wayland,
            cmds::common::restart_sidecar,
            cmds::common::grant_permissions,
            cmds::common::check_permissions_granted,
            cmds::common::refresh_permissions_granted,
            cmds::common::invoke_uwp_tool,
            cmds::common::check_port_available,
            cmds::common::copy_icon_file,
            cmds::common::copy_clash_env,
            cmds::common::download_icon_cache,
            cmds::common::open_devtools,
            cmds::common::set_tray_visible,
            cmds::common::get_net_info,
            cmds::common::restart_app,
            cmds::common::exit_app,
            // clash
            cmds::clash::get_clash_info,
            cmds::clash::patch_clash_config,
            cmds::clash::change_clash_core,
            cmds::clash::get_runtime_config,
            cmds::clash::get_runtime_yaml,
            cmds::clash::get_runtime_logs,
            cmds::clash::get_pre_merge_result,
            cmds::clash::test_merge_chain,
            cmds::clash::get_rule_provider_payload,
            cmds::mihomo_ws::ws_traffic,
            cmds::mihomo_ws::ws_memory,
            cmds::mihomo_ws::ws_connections,
            cmds::mihomo_ws::ws_logs,
            cmds::mihomo_ws::ws_disconnect,
            cmds::mihomo_ws::clear_all_ws_connections,
            // verge
            cmds::verge::get_verge_config,
            cmds::verge::patch_verge_config,
            cmds::verge::dispatch_hotkey_action,
            cmds::verge::test_delay,
            // update
            cmds::update::check_update,
            cmds::update::get_default_update_channel,
            // profile
            cmds::profile::get_profiles,
            cmds::profile::get_profile,
            cmds::profile::get_chains,
            cmds::profile::get_template,
            cmds::profile::enhance_profiles,
            cmds::profile::patch_profiles_config,
            cmds::profile::view_profile,
            cmds::profile::patch_profile,
            cmds::profile::create_profile,
            cmds::profile::import_profile,
            cmds::profile::reorder_profile,
            cmds::profile::update_profile,
            cmds::profile::delete_profile,
            cmds::profile::batch_delete_profiles,
            cmds::profile::batch_toggle_chains_enable,
            cmds::profile::read_profile_file,
            cmds::profile::save_profile_file,
            // service mode
            cmds::service::check_service,
            cmds::service::install_service,
            cmds::service::uninstall_service,
            // backup
            cmds::backup::create_backup,
            cmds::backup::apply_backup_and_reload,
            cmds::backup::update_webdav_info,
            cmds::backup::list_backup,
            cmds::backup::delete_backup,
            // mihomo version manager
            cmds::mihomo::get_mihomo_versions,
            cmds::mihomo::install_mihomo_version,
            cmds::mihomo::install_mihomo_download,
            cmds::mihomo::cancel_mihomo_download,
            cmds::mihomo::list_mihomo_downloads,
            cmds::mihomo::delete_mihomo_download,
            cmds::mihomo::delete_mihomo_index_cache,
        ]);

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, e| match e {
        tauri::RunEvent::WindowEvent { label, event, .. } if label == "main" => match event {
            tauri::WindowEvent::Destroyed => {
                log_err!(
                    resolve::save_window_size_position(app_handle),
                    "save window size position failed"
                );
            }
            tauri::WindowEvent::CloseRequested { api, .. } => {
                log_err!(
                    resolve::save_window_size_position(app_handle),
                    "save window size position failed"
                );
                resolve::handle_window_close(api, app_handle);
                #[cfg(target_os = "macos")]
                {
                    let dock_visible: bool = Config::verge().latest().keep_in_dock.unwrap_or(true);
                    resolve::apply_tray_policy(app_handle, dock_visible);
                }
            }
            _ => {}
        },
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen { .. } => resolve::create_window(),
        tauri::RunEvent::ExitRequested { code, api, .. } => {
            tauri::async_runtime::block_on(async move {
                tracing::info!("exit requested, clear all ws connections");
                CANCEL_MIHOMO_WS_RECONNECT.store(true, Ordering::SeqCst);
                let _ = handle::Handle::mihomo().clear_all_ws_connections().await;
            });
            if code.is_none() {
                api.prevent_exit();
            }
        }
        // macOS and Windows can listen system shutdown/restart event
        tauri::RunEvent::Exit => {
            let app_state = app_handle.state::<AppState>();
            if !app_state.is_exiting.load(std::sync::atomic::Ordering::SeqCst) {
                tauri::async_runtime::block_on(async move {
                    tracing::info!("app is exiting, resolve reset");
                    let app_state = app_handle.state::<AppState>();
                    app_state.is_exiting.store(true, std::sync::atomic::Ordering::SeqCst);
                    resolve::resolve_reset().await;
                    tracing::info!("resolve reset finished");
                });
            }
        }
        _ => {}
    });

    Ok(())
}
