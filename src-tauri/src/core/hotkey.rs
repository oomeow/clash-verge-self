use std::{collections::HashMap, sync::Arc};

use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{
    cmds,
    config::Config,
    core::handle,
    error::{AppError, AppResult},
    feat, log_err,
};

pub struct Hotkey {
    current: Arc<Mutex<Vec<String>>>, // 保存当前的热键设置
}

#[derive(Clone, Copy)]
pub enum HotkeyAction {
    OpenOrCloseDashboard,
    ClashModeRule,
    ClashModeGlobal,
    ClashModeDirect,
    ToggleSystemProxy,
    ToggleTunMode,
    ExitApp,
}

impl HotkeyAction {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::OpenOrCloseDashboard => "open_or_close_dashboard",
            Self::ClashModeRule => "clash_mode_rule",
            Self::ClashModeGlobal => "clash_mode_global",
            Self::ClashModeDirect => "clash_mode_direct",
            Self::ToggleSystemProxy => "toggle_system_proxy",
            Self::ToggleTunMode => "toggle_tun_mode",
            Self::ExitApp => "exit_app",
        }
    }

    pub fn to_config_entry(self, hotkey: &str) -> String {
        format!("{},{hotkey}", self.as_str())
    }
}

impl TryFrom<&str> for HotkeyAction {
    type Error = AppError;

    fn try_from(func: &str) -> Result<Self, Self::Error> {
        match func.trim() {
            "open_or_close_dashboard" => Ok(Self::OpenOrCloseDashboard),
            "clash_mode_rule" => Ok(Self::ClashModeRule),
            "clash_mode_global" => Ok(Self::ClashModeGlobal),
            "clash_mode_direct" => Ok(Self::ClashModeDirect),
            "toggle_system_proxy" => Ok(Self::ToggleSystemProxy),
            "toggle_tun_mode" => Ok(Self::ToggleTunMode),
            "exit_app" => Ok(Self::ExitApp),
            _ => Err(AppError::InvalidValue(format!("invalid function \"{func}\""))),
        }
    }
}

pub fn dispatch_action(app_handle: &tauri::AppHandle, func: &str) -> AppResult<()> {
    match HotkeyAction::try_from(func)? {
        HotkeyAction::OpenOrCloseDashboard => feat::open_or_close_dashboard(),
        HotkeyAction::ClashModeRule => feat::change_clash_mode("rule".into()),
        HotkeyAction::ClashModeGlobal => feat::change_clash_mode("global".into()),
        HotkeyAction::ClashModeDirect => feat::change_clash_mode("direct".into()),
        HotkeyAction::ToggleSystemProxy => feat::toggle_system_proxy(),
        HotkeyAction::ToggleTunMode => feat::toggle_tun_mode(),
        HotkeyAction::ExitApp => cmds::common::exit_app(app_handle.clone()),
    }

    Ok(())
}

impl Hotkey {
    pub fn global() -> &'static Hotkey {
        static HOTKEY: OnceCell<Hotkey> = OnceCell::new();

        HOTKEY.get_or_init(|| Hotkey {
            current: Arc::new(Mutex::new(Vec::new())),
        })
    }

    pub fn init(&self) -> AppResult<()> {
        let verge = Config::verge();
        let verge = verge.latest();

        if let Some(hotkeys) = verge.hotkeys.as_ref() {
            for hotkey in hotkeys {
                match Self::parse_hotkey_entry(hotkey) {
                    Some((func, key)) => {
                        log_err!(self.register(key, func));
                    }
                    None => tracing::error!("invalid hotkey `{hotkey}`"),
                }
            }
            self.current.lock().clone_from(hotkeys);
        }

        Ok(())
    }

    fn register(&self, hotkey: &str, func: &str) -> AppResult<()> {
        let app_handle = handle::Handle::app_handle();
        let manager = app_handle.global_shortcut();

        if manager.is_registered(hotkey) {
            manager.unregister(hotkey)?;
        }

        HotkeyAction::try_from(func)?;
        let func = func.trim().to_string();
        tracing::info!("register hotkey {hotkey} {func}");

        manager.on_shortcut(hotkey, move |app, hotkey, event| {
            if let ShortcutState::Pressed = event.state {
                tracing::info!("hotkey [{}] pressed", hotkey);
                log_err!(dispatch_action(app, &func));
            }
        })?;
        Ok(())
    }

    fn unregister(&self, hotkey: &str) -> AppResult<()> {
        let app_handle = handle::Handle::app_handle();
        app_handle.global_shortcut().unregister(hotkey)?;
        tracing::info!("unregister hotkey {hotkey}");
        Ok(())
    }

    pub fn update(&self, new_hotkeys: Vec<String>) -> AppResult<()> {
        let mut current = self.current.lock();
        let old_map = Self::get_map_from_vec(&current);
        let new_map = Self::get_map_from_vec(&new_hotkeys);

        let (del, add) = Self::get_diff(old_map, new_map);

        del.iter().for_each(|key| {
            log_err!(self.unregister(key));
        });

        for (key, func) in add {
            self.register(key, func)?;
        }

        *current = new_hotkeys;
        Ok(())
    }

    fn get_map_from_vec(hotkeys: &[String]) -> HashMap<&str, &str> {
        let mut map = HashMap::new();

        hotkeys.iter().for_each(|hotkey| {
            if let Some((func, key)) = Self::parse_hotkey_entry(hotkey) {
                map.insert(key, func);
            }
        });
        map
    }

    fn parse_hotkey_entry(hotkey: &str) -> Option<(&str, &str)> {
        let (func, key) = hotkey.split_once(',')?;
        let func = func.trim();
        let key = key.trim();

        if func.is_empty() || key.is_empty() {
            return None;
        }

        Some((func, key))
    }

    fn get_diff<'a>(
        old_map: HashMap<&'a str, &'a str>,
        new_map: HashMap<&'a str, &'a str>,
    ) -> (Vec<&'a str>, Vec<(&'a str, &'a str)>) {
        let mut del_list = vec![];
        let mut add_list = vec![];

        old_map.iter().for_each(|(&key, func)| {
            match new_map.get(key) {
                Some(new_func) => {
                    if new_func != func {
                        del_list.push(key);
                        add_list.push((key, *new_func));
                    }
                }
                None => del_list.push(key),
            };
        });

        new_map.iter().for_each(|(&key, &func)| {
            if !old_map.contains_key(key) {
                add_list.push((key, func));
            }
        });

        (del_list, add_list)
    }
}

impl Drop for Hotkey {
    fn drop(&mut self) {
        let app_handle = handle::Handle::app_handle();
        let shortcut = app_handle.global_shortcut();
        if let Err(e) = shortcut.unregister_all() {
            tracing::error!("unregister all hotkey error: {e}");
        }
    }
}
