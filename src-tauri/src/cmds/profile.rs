use anyhow::Context;

use crate::{
    cmds::{CommandResult, into_command_result},
    config::{Config, DEFAULT_PAC, EnableFilter, IProfiles, PrfItem, PrfOption},
    core::{CoreManager, handle, timer},
    enhance::chain::{ChainItem, ScopeType},
    feat, log_err,
    utils::{dirs, help, tmpl},
};

#[tauri::command]
pub fn get_profiles() -> CommandResult<IProfiles> {
    Ok(Config::profiles().data().clone())
}

#[tauri::command]
pub fn get_profile(uid: String) -> CommandResult<PrfItem> {
    into_command_result((|| {
        Ok(Config::profiles()
            .data()
            .get_item(&uid)
            .with_context(|| format!("failed to get profile [{uid}]"))?
            .clone())
    })())
}

#[tauri::command]
pub fn get_chains(profile_uid: Option<String>) -> CommandResult<Vec<ChainItem>> {
    Ok(Config::profiles()
        .data()
        .get_profile_chains(profile_uid, EnableFilter::All))
}

#[tauri::command]
pub fn get_template(scope: String, language: String) -> CommandResult<String> {
    match (scope.as_str(), language.as_str()) {
        ("merge", "yaml") => Ok(tmpl::ITEM_MERGE.into()),
        ("script", "javascript") => Ok(tmpl::ITEM_SCRIPT.into()),
        ("pac", "javascript") => Ok(DEFAULT_PAC.into()),
        _ => Ok("".into()),
    }
}

#[tauri::command]
pub async fn enhance_profiles() -> CommandResult<()> {
    into_command_result(
        async {
            CoreManager::global().update_config().await?;
            handle::Handle::refresh_clash();
            Ok(())
        }
        .await,
    )
}

#[tauri::command]
pub async fn import_profile(url: String, option: Option<PrfOption>) -> CommandResult<()> {
    into_command_result(
        async {
            let item = PrfItem::from_url(&url, None, None, option).await?;
            let restart_core = Config::profiles().data_mut().append_item(item)?;
            if restart_core {
                CoreManager::global().update_config().await?;
                handle::Handle::refresh_clash();
            }
            handle::Handle::update_systray_part()
        }
        .await,
    )
}

#[tauri::command]
pub async fn reorder_profile(active_id: String, over_id: String) -> CommandResult<()> {
    into_command_result(
        async {
            Config::profiles().data_mut().reorder(active_id, over_id)?;
            handle::Handle::update_systray_part()
        }
        .await,
    )
}

#[tauri::command]
pub async fn create_profile(item: PrfItem, file_data: Option<String>) -> CommandResult<()> {
    into_command_result(
        async {
            let item = PrfItem::from(item, file_data).await?;
            let restart_core = Config::profiles().data_mut().append_item(item)?;
            if restart_core {
                CoreManager::global().update_config().await?;
                handle::Handle::refresh_clash();
            }
            handle::Handle::update_systray_part()
        }
        .await,
    )
}

// 同步更新订阅
#[tauri::command]
pub async fn update_profile(uid: String, option: Option<PrfOption>) -> CommandResult<()> {
    into_command_result(
        async {
            feat::update_profile(&uid, option).await?;
            handle::Handle::update_systray_part()
        }
        .await,
    )
}

#[tauri::command]
pub async fn delete_profile(uid: String) -> CommandResult<()> {
    into_command_result(
        async {
            let restart_core = Config::profiles().data_mut().delete_item(uid)?;
            // the running profile is deleted, update the core config
            if restart_core {
                CoreManager::global().update_config().await?;
                handle::Handle::refresh_clash();
            }
            handle::Handle::update_systray_part()
        }
        .await,
    )
}

#[tauri::command]
pub async fn batch_delete_profiles(uids: Vec<String>) -> CommandResult<()> {
    into_command_result(
        async {
            let mut restart_core = false;
            for uid in uids {
                restart_core |= Config::profiles().data_mut().delete_item(uid)?;
            }
            // the running profile is deleted, update the core config
            if restart_core {
                CoreManager::global().update_config().await?;
                handle::Handle::refresh_clash();
            }
            handle::Handle::update_systray_part()
        }
        .await,
    )
}

/// 修改整个 profiles
#[tauri::command]
pub async fn patch_profiles_config(profiles: IProfiles) -> CommandResult<()> {
    into_command_result(
        async {
            let switch_current = profiles.current.is_some();
            Config::profiles().draft().patch_config(profiles)?;

            match CoreManager::global().update_config().await {
                Ok(_) => {
                    Config::profiles().apply();
                    Config::profiles().data().save_file()?;
                    if switch_current {
                        tauri::async_runtime::spawn(async {
                            tracing::debug!("change current profile, run activate selected node");
                            log_err!(crate::config::activate_selected_nodes().await);
                        });
                    }
                    handle::Handle::refresh_clash();
                    handle::Handle::refresh_profiles();
                    handle::Handle::update_systray_part()?;
                    Ok(())
                }
                Err(err) => {
                    Config::profiles().discard();
                    tracing::error!("{err}");
                    Err(err)
                }
            }
        }
        .await,
    )
}

/// 修改某个 profile item
#[tauri::command]
pub async fn patch_profile(uid: String, profile: PrfItem) -> CommandResult<()> {
    into_command_result(
        async {
            let old = Config::profiles()
                .latest()
                .get_item(&uid)
                .with_context(|| format!("failed to get profile [{uid}]"))?
                .clone();
            let name_changed = profile.name != old.name;
            let enable_changed = profile.enable != old.enable;
            Config::profiles().data_mut().patch_item(&uid, profile)?;
            timer::Timer::global().refresh_profiles()?;
            if enable_changed {
                // this is a chain to toggle enable
                let profiles = Config::profiles().latest().clone();
                let result_item = profiles
                    .get_item(&uid)
                    .with_context(|| format!("failed to get profile [{uid}]"))?;
                match result_item.scope {
                    Some(ScopeType::Global) => {
                        CoreManager::global().update_config().await?;
                        handle::Handle::refresh_clash();
                    }
                    Some(ScopeType::Specific) if result_item.parent.as_ref() == profiles.get_current() => {
                        CoreManager::global().update_config().await?;
                        handle::Handle::refresh_clash();
                    }
                    _ => {}
                }
            }
            if name_changed {
                handle::Handle::update_systray_part()?;
            }
            Ok(())
        }
        .await,
    )
}

#[tauri::command]
pub async fn batch_toggle_chains_enable(uids: Vec<String>, enable: bool) -> CommandResult<()> {
    into_command_result(
        async {
            let mut update_config = false;
            for uid in uids {
                Config::profiles().data_mut().patch_item(
                    &uid,
                    PrfItem {
                        enable: Some(enable),
                        ..Default::default()
                    },
                )?;
                let profiles = Config::profiles().latest().clone();
                let result_item = profiles
                    .get_item(&uid)
                    .with_context(|| format!("failed to get profile [{uid}]"))?;
                match result_item.scope {
                    Some(ScopeType::Global) => {
                        update_config = true;
                    }
                    Some(ScopeType::Specific) if result_item.parent.as_ref() == profiles.get_current() => {
                        update_config = true;
                    }
                    _ => {}
                }
            }
            if update_config {
                CoreManager::global().update_config().await?;
                handle::Handle::refresh_clash();
            }
            Ok(())
        }
        .await,
    )
}

#[tauri::command]
pub fn view_profile(app_handle: tauri::AppHandle, index: String) -> CommandResult<()> {
    into_command_result((|| {
        let profiles = Config::profiles();
        let profiles = profiles.latest();
        let file = profiles
            .get_item(&index)
            .with_context(|| format!("failed to get profile [{index}]"))?
            .file
            .as_ref()
            .context("the file field is null")?;
        let path = dirs::app_profiles_dir()?.join(file);
        if !path.exists() {
            anyhow::bail!("profile [{}] not found", path.display());
        }
        help::open_file(app_handle, path)
    })())
}

#[tauri::command]
pub fn read_profile_file(index: String) -> CommandResult<String> {
    into_command_result((|| {
        let profiles = Config::profiles();
        let profiles = profiles.latest();
        let item = profiles
            .get_item(&index)
            .with_context(|| format!("failed to get profile [{index}]"))?;
        let data = item.read_file()?;
        Ok(data)
    })())
}

#[tauri::command]
pub fn save_profile_file(uid: String, file_data: Option<String>) -> CommandResult<()> {
    into_command_result((|| {
        if let Some(file_data) = file_data {
            let profiles = Config::profiles();
            let profiles = profiles.latest();
            let item = profiles
                .get_item(&uid)
                .with_context(|| format!("failed to get profile [{uid}]"))?;
            item.save_file(file_data)?;
        }
        Ok(())
    })())
}
