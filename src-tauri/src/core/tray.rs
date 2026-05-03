use anyhow::{Context, Result};
use rust_i18n::t;
use tauri::{
    AppHandle, Manager, Runtime,
    image::Image,
    menu::{CheckMenuItem, Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
};

use super::handle;
use crate::{
    AppState, cmds,
    config::{Config, IProfiles},
    feat, log_err,
    utils::{dirs, resolve},
};

pub const TRAY_ID: &str = "verge_self_tray";

pub struct Tray;

impl Tray {
    fn get_tray_icon() -> Result<Image<'static>> {
        let verge = Config::verge();
        let verge = verge.latest();
        let clash = Config::clash();
        let clash = clash.latest();
        let icon_dir_path = dirs::app_home_dir()?.join("icons");
        let sysproxy_enabled = verge.enable_system_proxy.unwrap_or(false);
        let tun_enabled = clash.get_enable_tun();
        #[cfg(target_os = "macos")]
        let is_monochrome = verge.tray_icon.as_deref().is_none_or(|v| v == "monochrome");
        // get icon
        let common_tray_icon = verge.common_tray_icon.unwrap_or(false);
        let sysproxy_tray_icon = verge.sysproxy_tray_icon.unwrap_or(false);
        let tun_tray_icon = verge.tun_tray_icon.unwrap_or(false);

        match (sysproxy_enabled, tun_enabled) {
            (_, true) => {
                if tun_tray_icon {
                    let mut icon_path = icon_dir_path.join("tun.ico");
                    if !icon_path.exists() {
                        icon_path = icon_dir_path.join("tun.png");
                    }
                    Ok(Image::from_path(icon_path)?)
                } else {
                    #[cfg(target_os = "macos")]
                    let icon = if is_monochrome {
                        include_bytes!("../../icons/tray-icon-tun-mono.ico").to_vec()
                    } else {
                        include_bytes!("../../icons/tray-icon-tun.ico").to_vec()
                    };
                    #[cfg(not(target_os = "macos"))]
                    let icon = include_bytes!("../../icons/tray-icon-tun.png").to_vec();
                    Ok(Image::from_bytes(&icon)?)
                }
            }
            (true, _) => {
                if sysproxy_tray_icon {
                    let mut icon_path = icon_dir_path.join("sysproxy.ico");
                    if !icon_path.exists() {
                        icon_path = icon_dir_path.join("sysproxy.png");
                    }
                    Ok(Image::from_path(icon_path)?)
                } else {
                    #[cfg(target_os = "macos")]
                    let icon = if is_monochrome {
                        include_bytes!("../../icons/tray-icon-sys-mono.ico").to_vec()
                    } else {
                        include_bytes!("../../icons/tray-icon-sys.ico").to_vec()
                    };
                    #[cfg(not(target_os = "macos"))]
                    let icon = include_bytes!("../../icons/tray-icon-sys.png").to_vec();
                    Ok(Image::from_bytes(&icon)?)
                }
            }
            _ => {
                if common_tray_icon {
                    let mut icon_path = icon_dir_path.join("common.ico");
                    if !icon_path.exists() {
                        icon_path = icon_dir_path.join("common.png");
                    }
                    Ok(Image::from_path(icon_path)?)
                } else {
                    #[cfg(target_os = "macos")]
                    let icon = if is_monochrome {
                        include_bytes!("../../icons/tray-icon-mono.ico").to_vec()
                    } else {
                        include_bytes!("../../icons/tray-icon.ico").to_vec()
                    };
                    #[cfg(not(target_os = "macos"))]
                    let icon = include_bytes!("../../icons/tray-icon.png").to_vec();
                    Ok(Image::from_bytes(&icon)?)
                }
            }
        }
    }

    pub fn tray_menu<R: Runtime>(app_handle: &AppHandle<R>) -> Result<Menu<R>> {
        let app_state = app_handle.state::<AppState>();
        let version = app_state.app_version.clone();
        let profiles = Config::profiles();
        let profiles = profiles.latest();
        let current = profiles.get_current();
        let profiles = profiles.get_profiles();
        let mut switch_menu = SubmenuBuilder::new(app_handle, t!("tray.profiles.switch.title"));
        for profile in profiles {
            if let Some(uid) = &profile.uid
                && let Some(name) = &profile.name
            {
                if let Some(current) = current
                    && current == uid
                {
                    let checkmenu = CheckMenuItem::with_id(app_handle, uid, name, true, true, None::<&str>)?;
                    switch_menu = switch_menu.item(&checkmenu);
                } else {
                    let checkmenu = CheckMenuItem::with_id(app_handle, uid, name, true, false, None::<&str>)?;
                    switch_menu = switch_menu.item(&checkmenu);
                }
            }
        }

        let menu = MenuBuilder::new(app_handle)
            .text("open_window", t!("tray.dashboard"))
            .separator()
            .check("rule_mode", t!("tray.mode.rule"))
            .check("global_mode", t!("tray.mode.global"))
            .check("direct_mode", t!("tray.mode.direct"))
            .separator()
            .check("system_proxy", t!("tray.proxy.system"))
            .check("tun_mode", t!("tray.proxy.tun"))
            .separator()
            .item(&switch_menu.build()?)
            .separator()
            .check("service_mode", t!("tray.service"))
            .separator()
            .text("copy_env", t!("tray.copy.env"))
            .item(
                &SubmenuBuilder::new(app_handle, t!("tray.open.dir"))
                    .text("open_app_dir", t!("tray.open.app.dir"))
                    .text("open_core_dir", t!("tray.open.core.dir"))
                    .text("open_logs_dir", t!("tray.open.log.dir"))
                    .build()?,
            )
            .item(
                &SubmenuBuilder::new(app_handle, t!("tray.more"))
                    .text("open_devtools", t!("tray.open.devtools"))
                    .text("restart_clash", t!("tray.restart.clash"))
                    .text("restart_app", t!("tray.restart.app"))
                    .item(
                        &MenuItemBuilder::new(format!("Version: {version}"))
                            .enabled(false)
                            .build(app_handle)?,
                    )
                    // .text("app_version", format!("Version: {}", version))
                    .build()?,
            )
            .separator()
            .text("quit", t!("tray.quit"));

        Ok(menu.build()?)
    }

    pub fn init() -> Result<()> {
        let app_handle = handle::Handle::app_handle();
        tracing::trace!("generate tray menu");
        let menu = Self::tray_menu(app_handle)?;
        tracing::trace!("build tray");
        let tray = TrayIconBuilder::with_id(TRAY_ID)
            .icon(Self::get_tray_icon()?)
            .icon_as_template(true)
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_tray_icon_event(Self::on_click)
            .on_menu_event(Self::on_system_tray_event)
            .build(app_handle)?;

        tracing::trace!("check if enable tray");
        let enable_tray = Config::verge().latest().enable_tray.unwrap_or(true);
        if !enable_tray {
            tray.set_visible(false)?;
        }
        tracing::trace!("update tray");
        Self::update_systray(app_handle)?;
        Ok(())
    }

    /// There is some bug in Linux: Tray cannot be created when opening then hiding then reopening it by clicking the switch button
    pub fn set_tray_visible(app_handle: &AppHandle, visible: bool) -> Result<()> {
        match app_handle.tray_by_id(TRAY_ID) {
            Some(tray) => {
                tray.set_visible(visible)?;
                Ok(())
            }
            None => Err(anyhow::anyhow!("set tray visible failed, because tray not found")),
        }
    }

    pub fn update_systray(app_handle: &AppHandle) -> Result<()> {
        tracing::debug!("starting update tray");
        let enable_tray = Config::verge().latest().enable_tray.unwrap_or(true);
        if enable_tray {
            Self::update_part(app_handle)?;
        }
        tracing::debug!("update tray finished");
        Ok(())
    }

    pub fn update_part<R: Runtime>(app_handle: &AppHandle<R>) -> Result<()> {
        let verge = Config::verge();
        let verge = verge.latest();
        let enable_tray = verge.enable_tray.unwrap_or(true);
        if !enable_tray {
            return Ok(());
        }
        let clash = Config::clash();
        let clash = clash.latest();
        let mode = clash.get_mode();
        let sysproxy_enabled = verge.enable_system_proxy.unwrap_or(false);
        let tun_enabled = clash.get_enable_tun();
        let service_enabled = verge.enable_service_mode.unwrap_or(false);

        let tray = app_handle.tray_by_id(TRAY_ID).expect("tray not found");
        let menu = Self::tray_menu(app_handle)?;

        menu.get("rule_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(mode == "rule").ok())
            .context("failed to update rule mode menu")?;
        menu.get("global_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(mode == "global").ok())
            .context("failed to update global mode menu")?;
        menu.get("direct_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(mode == "direct").ok())
            .context("failed to update direct mode menu")?;

        menu.get("system_proxy")
            .and_then(|item| item.as_check_menuitem()?.set_checked(sysproxy_enabled).ok())
            .context("failed to update system proxy menu")?;

        menu.get("tun_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(tun_enabled).ok())
            .context("failed to update tun mode menu")?;

        menu.get("service_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(service_enabled).ok())
            .context("failed to update service mode menu")?;

        tray.set_menu(Some(menu))?;

        // set tray icon
        let icon = Self::get_tray_icon()?;
        let is_template = if cfg!(target_os = "macos") {
            verge.tray_icon.as_ref().is_some_and(|i| i == "monochrome")
        } else {
            false
        };
        tray.set_icon_with_as_template(Some(icon), is_template)?;

        #[cfg(not(target_os = "linux"))]
        {
            let version = &app_handle.state::<AppState>().app_version;
            let mut current_name = "None".to_string();
            let profiles = Config::profiles();
            let profiles = profiles.latest();
            if let Some(current_uid) = profiles.get_current()
                && let Some(current) = profiles.get_item(current_uid)
                && let Some(profile_name) = &current.name
            {
                current_name = profile_name.to_string();
            };
            tray.set_tooltip(Some(&format!(
                "Clash Verge Self v{}\n{}: {}",
                version,
                t!("tray.current.profile"),
                current_name
            )))?;
        }
        Ok(())
    }

    pub fn on_click(_tray: &TrayIcon, event: TrayIconEvent) {
        if let TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event
        {
            let verge = Config::verge();
            let verge = verge.latest();
            let tray_event = verge.tray_event.as_deref();
            let tray_event = tray_event.unwrap_or("main_window");
            match tray_event {
                "system_proxy" => feat::toggle_system_proxy(),
                "service_mode" => feat::toggle_service_mode(),
                "tun_mode" => feat::toggle_tun_mode(),
                "main_window" => resolve::create_window(),
                _ => {}
            }
        }
    }

    pub fn on_system_tray_event(app_handle: &AppHandle, event: MenuEvent) {
        let app_handle_ = app_handle.clone();
        let config_profiles = Config::profiles();
        let config_profiles = config_profiles.latest();
        let profiles = config_profiles.get_profiles();
        let profile_uids = profiles
            .iter()
            .map(|item| item.uid.clone().unwrap_or_default())
            .collect::<Vec<String>>();
        match event.id.as_ref() {
            mode @ ("rule_mode" | "global_mode" | "direct_mode") => {
                let mode = &mode[0..mode.len() - 5];
                feat::change_clash_mode(mode.into());
            }
            "open_window" => resolve::create_window(),
            "system_proxy" => feat::toggle_system_proxy(),
            "tun_mode" => feat::toggle_tun_mode(),
            profile if profile_uids.contains(&profile.to_string()) => {
                let current = config_profiles.get_current();
                // TODO: println!("current == profile :: {}", current.unwrap() == profile);
                if let Some(current) = current
                    && current != profile
                {
                    let clicked_profile = profile.to_string();
                    tauri::async_runtime::spawn(async move {
                        match cmds::profile::patch_profiles_config(IProfiles {
                            current: Some(clicked_profile),
                            chain: None,
                            items: None,
                        })
                        .await
                        {
                            Ok(_) => {
                                handle::Handle::notify(
                                    t!("tray.profiles.switch.title"),
                                    t!("tray.profiles.switch.success"),
                                );
                                tracing::info!("switch profile successfully");
                            }
                            Err(e) => {
                                handle::Handle::notify(
                                    t!("tray.profiles.switch.title"),
                                    t!("tray.profiles.switch.failed"),
                                );
                                tracing::error!("failed to switch profile, error: {:?}", e);
                            }
                        };
                    });
                } else {
                    log_err!(Self::update_systray(app_handle));
                }
            }
            "service_mode" => feat::toggle_service_mode(),
            "copy_env" => feat::copy_clash_env(app_handle),
            "open_app_dir" => log_err!(cmds::common::open_app_dir(app_handle_)),
            "open_core_dir" => log_err!(cmds::common::open_core_dir(app_handle_)),
            "open_logs_dir" => log_err!(cmds::common::open_logs_dir(app_handle_)),
            "open_devtools" => log_err!(cmds::common::open_devtools(app_handle_)),
            "restart_clash" => feat::restart_clash_core(),
            "restart_app" => {
                tauri::async_runtime::block_on(async move { cmds::common::restart_app(app_handle_).await })
            }
            "quit" => cmds::common::exit_app(app_handle_),
            _ => {}
        }
    }
}
