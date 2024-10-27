use crate::{
    cmds,
    config::Config,
    feat,
    utils::{dirs, resolve},
};
use anyhow::Result;
use parking_lot::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder},
    tray::{TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

const TRAY_ID: &str = "verge_tray";

struct TrayState<R: Runtime> {
    menu: Mutex<Menu<R>>,
}

pub struct Tray {}

impl Tray {
    fn get_tray_icon() -> Image<'static> {
        let verge = Config::verge().latest().clone();
        let clash = Config::clash().latest().clone();
        let icon_dir_path = dirs::app_home_dir().unwrap().join("icons");
        let sysproxy_enabled = verge.enable_system_proxy.unwrap_or(false);
        let tun_enabled = clash.get_enable_tun();
        #[cfg(target_os = "macos")]
        let tray_icon = verge.tray_icon.unwrap_or("monochrome".to_string());
        // get icon
        let common_tray_icon = verge.common_tray_icon.unwrap_or(false);
        let sysproxy_tray_icon = verge.sysproxy_tray_icon.unwrap_or(false);
        let tun_tray_icon = verge.tun_tray_icon.unwrap_or(false);
        let icon = match (sysproxy_enabled, tun_enabled) {
            (_, true) => {
                if tun_tray_icon {
                    let mut icon_path = icon_dir_path.join("tun.ico");
                    if !icon_path.exists() {
                        icon_path = icon_dir_path.join("tun.png");
                    }
                    // Icon::File(icon_path)
                    Image::from_path(icon_path).unwrap()
                } else {
                    #[cfg(target_os = "macos")]
                    let icon = match tray_icon.as_str() {
                        "monochrome" => {
                            include_bytes!("../../icons/tray-icon-tun-mono.ico").to_vec()
                        }
                        "colorful" => include_bytes!("../../icons/tray-icon-tun.ico").to_vec(),
                        _ => include_bytes!("../../icons/tray-icon-tun-mono.ico").to_vec(),
                    };
                    #[cfg(not(target_os = "macos"))]
                    let icon = include_bytes!("../../icons/tray-icon-tun.png").to_vec();
                    // Icon::Raw(icon)
                    Image::from_bytes(&icon).unwrap()
                }
            }
            (true, _) => {
                if sysproxy_tray_icon {
                    let mut icon_path = icon_dir_path.join("sysproxy.ico");
                    if !icon_path.exists() {
                        icon_path = icon_dir_path.join("sysproxy.png");
                    }
                    // Icon::File(icon_path)
                    Image::from_path(icon_path).unwrap()
                } else {
                    #[cfg(target_os = "macos")]
                    let icon = match tray_icon.as_str() {
                        "monochrome" => {
                            include_bytes!("../../icons/tray-icon-sys-mono.ico").to_vec()
                        }
                        "colorful" => include_bytes!("../../icons/tray-icon-sys.ico").to_vec(),
                        _ => include_bytes!("../../icons/tray-icon-sys-mono.ico").to_vec(),
                    };
                    #[cfg(not(target_os = "macos"))]
                    let icon = include_bytes!("../../icons/tray-icon-sys.png").to_vec();
                    // Icon::Raw(icon)
                    Image::from_bytes(&icon).unwrap()
                }
            }
            _ => {
                if common_tray_icon {
                    let mut icon_path = icon_dir_path.join("common.ico");
                    if !icon_path.exists() {
                        icon_path = icon_dir_path.join("common.png");
                    }
                    // Icon::File(icon_path)
                    Image::from_path(icon_path).unwrap()
                } else {
                    #[cfg(target_os = "macos")]
                    let icon = match tray_icon.as_str() {
                        "monochrome" => include_bytes!("../../icons/tray-icon-mono.ico").to_vec(),
                        "colorful" => include_bytes!("../../icons/tray-icon.ico").to_vec(),
                        _ => include_bytes!("../../icons/tray-icon-mono.ico").to_vec(),
                    };
                    #[cfg(not(target_os = "macos"))]
                    let icon = include_bytes!("../../icons/tray-icon.png").to_vec();
                    // Icon::Raw(icon)
                    Image::from_bytes(&icon).unwrap()
                }
            }
        };
        icon
    }

    pub fn tray_menu<R: Runtime>(app_handle: &AppHandle<R>) -> Result<Menu<R>> {
        let verge = Config::verge().latest().clone();
        let zh = verge.language == Some("zh".into());
        let version = app_handle.package_info().version.to_string();
        macro_rules! t {
            ($en: expr, $zh: expr) => {
                if zh {
                    $zh
                } else {
                    $en
                }
            };
        }
        let menu = MenuBuilder::new(app_handle)
            .text("open_window", t!("Dashboard", "打开面板"))
            .check("rule_mode", t!("Rule Mode", "规则模式"))
            .check("direct_mode", t!("Direct Mode", "直连模式"))
            .check("global_mode", t!("Global Mode", "全局模式"))
            .separator()
            .check("system_proxy", t!("System Proxy", "系统代理"))
            .check("tun_mode", t!("TUN Mode", "Tun 模式"))
            .separator()
            .check("service_mode", t!("Service Mode", "服务模式"))
            .separator()
            .text("copy_env", t!("Copy Env", "复制环境变量"))
            .item(
                &SubmenuBuilder::new(app_handle, t!("Open Dir", "打开目录"))
                    .text("open_app_dir", t!("App Dir", "应用目录"))
                    .text("open_core_dir", t!("Core Dir", "核心目录"))
                    .text("open_logs_dir", t!("Log Dir", "日志目录"))
                    .build()?,
            )
            .item(
                &SubmenuBuilder::new(app_handle, t!("More", "更多"))
                    .text("open_devtools", t!("Open DevTools", "打开开发者工具"))
                    .text("restart_clash", t!("Restart Clash", "重启 Clash"))
                    .text("restart_app", t!("Restart", "重启应用"))
                    .item(
                        &MenuItemBuilder::new(format!("Version: {}", version))
                            .enabled(false)
                            .build(app_handle)?,
                    )
                    // .text("app_version", format!("Version: {}", version))
                    .build()?,
            )
            .separator()
            .text("quit", t!("Quit", "退出"));

        Ok(menu.build()?)
    }

    pub fn init(app_handle: &AppHandle) -> Result<()> {
        let menu = Self::tray_menu(app_handle)?;
        let tray = TrayIconBuilder::with_id(TRAY_ID)
            .icon(Self::get_tray_icon())
            .menu(&menu)
            .on_tray_icon_event(Self::on_click)
            .on_menu_event(Self::on_system_tray_event)
            .build(app_handle)?;
        let enable_tray = Config::verge().latest().enable_tray.unwrap_or(true);
        if !enable_tray {
            tray.set_visible(false)?;
        }
        app_handle.manage(TrayState {
            menu: Mutex::new(menu),
        });
        Self::update_systray(app_handle)?;
        Ok(())
    }

    /// There is some bug in Linux: Tray cannot be created when opening then hiding then reopening it by clicking the switch button
    pub fn set_tray_visible(app_handle: &AppHandle, visible: bool) -> Result<()> {
        if let Some(tray) = app_handle.tray_by_id(TRAY_ID) {
            tray.set_visible(visible)?;
        } else {
            TrayIconBuilder::with_id(TRAY_ID)
                .icon(Self::get_tray_icon())
                .menu(&Self::tray_menu(app_handle)?)
                .on_tray_icon_event(Self::on_click)
                .on_menu_event(Self::on_system_tray_event)
                .build(app_handle)?;
        }
        Ok(())
    }

    pub fn update_systray(app_handle: &AppHandle) -> Result<()> {
        let enable_tray = Config::verge().latest().enable_tray.unwrap_or(true);
        if !enable_tray {
            return Ok(());
        }
        Self::update_part(app_handle)?;
        Ok(())
    }

    // 参考 https://github.com/oomeow/clash-nyanpasu/blob/main/backend/tauri/src/core/tray/mod.rs#L299
    pub fn update_part<R: Runtime>(app_handle: &AppHandle<R>) -> Result<()> {
        let verge = Config::verge().latest().clone();
        let enable_tray = verge.enable_tray.unwrap_or(true);
        if !enable_tray {
            return Ok(());
        }
        let clash = Config::clash().latest().clone();
        // let zh = verge.language == Some("zh".into());
        // macro_rules! t {
        //     ($en: expr, $zh: expr) => {
        //         if zh {
        //             $zh
        //         } else {
        //             $en
        //         }
        //     };
        // }
        let mode = clash.get_mode();
        let sysproxy_enabled = verge.enable_system_proxy.unwrap_or(false);
        let tun_enabled = clash.get_enable_tun();
        let service_enabled = verge.enable_service_mode.unwrap_or(false);

        let tray = app_handle.tray_by_id(TRAY_ID).expect("tray not found");
        let tray_state = app_handle.state::<TrayState<R>>();
        let menu = tray_state.menu.lock();

        let _ = menu
            .get("rule_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(mode == "rule").ok());
        let _ = menu
            .get("global_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(mode == "global").ok());
        let _ = menu
            .get("direct_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(mode == "direct").ok());

        let _ = menu
            .get("system_proxy")
            .and_then(|item| item.as_check_menuitem()?.set_checked(sysproxy_enabled).ok());

        let _ = menu
            .get("tun_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(tun_enabled).ok());

        let _ = menu
            .get("service_mode")
            .and_then(|item| item.as_check_menuitem()?.set_checked(service_enabled).ok());

        #[cfg(target_os = "macos")]
        {
            let tray_icon = verge.tray_icon.unwrap_or("monochrome".to_string());
            match tray_icon.as_str() {
                "monochrome" => {
                    let _ = tray.set_icon_as_template(true);
                }
                "colorful" => {
                    let _ = tray.set_icon_as_template(false);
                }
                _ => {}
            }
        }

        // set tray icon
        tray.set_icon(Some(Self::get_tray_icon()))?;

        #[cfg(not(target_os = "linux"))]
        {
            let version = app_handle.package_info().version.to_string();
            let mut current_profile_name = "None".to_string();
            let profiles = Config::profiles().latest().clone();
            if let Some(current_profile_uid) = profiles.get_current() {
                let current_profile = profiles.get_item(&current_profile_uid);
                current_profile_name = match &current_profile.unwrap().name {
                    Some(profile_name) => profile_name.to_string(),
                    None => current_profile_name,
                };
            };
            let switch_map = |status| {
                if status {
                    "ON"
                } else {
                    "OFF"
                }
            };
            tray.set_tooltip(Some(&format!(
                "Clash Verge {version}\n{}: {}\n{}: {}\n{}: {}",
                t!("System Proxy", "系统代理"),
                switch_map(sysproxy_enabled),
                t!("TUN Mode", "Tun 模式"),
                switch_map(tun_enabled),
                t!("Curent Profile", "当前订阅"),
                current_profile_name
            )))?;
        }
        Ok(())
    }

    pub fn on_click(tray: &TrayIcon, event: TrayIconEvent) {
        let app_handle = tray.app_handle();
        match event {
            TrayIconEvent::Click { .. } => {
                let tray_event = Config::verge().latest().tray_event.clone();
                let tray_event = tray_event.unwrap_or("main_window".into());
                match tray_event.as_str() {
                    "system_proxy" => feat::toggle_system_proxy(),
                    "service_mode" => feat::toggle_service_mode(),
                    "tun_mode" => feat::toggle_tun_mode(),
                    "main_window" => resolve::create_window(app_handle),
                    _ => {}
                }
            }
            _ => {}
        }
    }

    pub fn on_system_tray_event(app_handle: &AppHandle, event: MenuEvent) {
        match event.id.as_ref() {
            mode @ ("rule_mode" | "global_mode" | "direct_mode") => {
                let mode = &mode[0..mode.len() - 5];
                feat::change_clash_mode(mode.into());
            }
            "open_window" => resolve::create_window(app_handle),
            "system_proxy" => feat::toggle_system_proxy(),
            "service_mode" => feat::toggle_service_mode(),
            "tun_mode" => feat::toggle_tun_mode(),
            "copy_env" => feat::copy_clash_env(app_handle),
            "open_app_dir" => crate::log_err!(cmds::open_app_dir()),
            "open_core_dir" => crate::log_err!(cmds::open_core_dir()),
            "open_logs_dir" => crate::log_err!(cmds::open_logs_dir()),
            "open_devtools" => cmds::open_devtools(app_handle.clone()),
            "restart_clash" => feat::restart_clash_core(),
            "restart_app" => cmds::restart_app(app_handle.clone()),
            "quit" => cmds::exit_app(app_handle.clone()),
            _ => {}
        }
    }
}
