use std::{collections::HashMap, fs, io::Write, path::PathBuf, sync::LazyLock, time::Duration};

use anyhow::{Context, Result, bail};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use serde_yaml::Mapping;
use tokio::task::JoinHandle;

use super::{EnableFilter, PrfItem};
use crate::{
    config::{Config, ProfileType},
    core::handle,
    enhance::chain::{ChainItem, ScopeType},
    log_err,
    utils::{dirs, help},
};

// Current working thread task handle, used to activate the node selected in the current profile.
static WORKER_HANDLE: LazyLock<Mutex<Option<JoinHandle<()>>>> = LazyLock::new(|| Mutex::new(None));

/// Define the `profiles.yaml` schema
#[derive(Default, Debug, Clone, Deserialize, Serialize)]
pub struct IProfiles {
    /// same as PrfConfig.current
    pub current: Option<String>,

    /// same as PrfConfig.chain
    ///
    /// The field will be removed in the future and the chain will be implemented using the PrfItem `enable` field.
    pub chain: Option<Vec<String>>,

    /// profile list
    pub items: Option<Vec<PrfItem>>,
}

macro_rules! patch {
    ($lv: expr, $rv: expr, $key: tt) => {
        if ($rv.$key).is_some() {
            $lv.$key = $rv.$key;
        }
    };
}

impl IProfiles {
    pub fn new() -> Self {
        match dirs::profiles_path().and_then(|path| help::read_yaml::<Self>(&path)) {
            Ok(mut profiles) => {
                if profiles.items.is_none() {
                    profiles.items = Some(vec![]);
                }
                profiles.migrate();
                profiles
            }
            Err(err) => {
                tracing::error!("{err}");
                // delete all files in profiles dir
                if let Ok(dir) = dirs::app_profiles_dir()
                    && let Ok(dir) = std::fs::read_dir(dir)
                {
                    tracing::debug!("clear all files in profiles dir");
                    for entry in dir.flatten() {
                        let _ = std::fs::remove_file(entry.path());
                    }
                }
                Self::template()
            }
        }
    }

    fn migrate(&mut self) {
        // This is old bug since 2.0.0 ~ 2.1.4 version
        // clear profile data and delete invalid profile files
        let mut save_file = false;
        let mut available_files = Vec::new();

        let enabled_global_chain = self.chain.as_deref().unwrap_or_default();
        // compatible with the old old old version
        if let Some(items) = self.items.as_mut() {
            let items_ = items.clone();
            let all_uids: Vec<String> = items_.iter().filter_map(|i| i.uid.clone()).collect();
            available_files = items_.iter().filter_map(|i| i.file.clone()).collect();
            for item in items.iter_mut() {
                if item.uid.is_none() {
                    item.uid = Some(help::get_uid("d"));
                }
                if let Some(chain) = item.chain.as_mut() {
                    // This is old bug since 2.0.0 ~ 2.1.4 version
                    // remove invalid chains
                    chain.retain(|i| all_uids.contains(i));
                    save_file = true;
                }
                match item.itype {
                    Some(ProfileType::Merge) | Some(ProfileType::Script) if item.scope.is_none() => {
                        let uid = item.uid.as_ref().unwrap();
                        item.scope = Some(ScopeType::Global);
                        item.enable = Some(enabled_global_chain.contains(uid));
                    }
                    _ => {}
                }
            }
        }
        if save_file {
            log_err!(self.save_file());
        }
        // This is old bug since 2.0.0 ~ 2.1.4 version
        // delete invalid files in profiles dir
        if let Ok(dir) = dirs::app_profiles_dir()
            && let Ok(dir) = std::fs::read_dir(dir)
        {
            for entry in dir.flatten() {
                if let Ok(file_name) = entry.file_name().into_string()
                    && !available_files.contains(&file_name)
                {
                    match std::fs::remove_file(entry.path()) {
                        Ok(_) => {
                            tracing::debug!(
                                "delete invalid profile {}, {}",
                                entry.file_name().display(),
                                entry.path().display()
                            );
                        }
                        Err(err) => {
                            tracing::warn!(
                                "failed to delete invalid profile {}, {}, error: {}",
                                entry.file_name().display(),
                                entry.path().display(),
                                err
                            );
                        }
                    }
                }
            }
        }
    }

    pub fn template() -> Self {
        Self {
            items: Some(vec![]),
            ..Self::default()
        }
    }

    pub fn save_file(&self) -> Result<()> {
        help::save_yaml(&dirs::profiles_path()?, self, Some("# Profiles Config for Clash Verge"))
    }

    /// 只修改 current、global chain
    pub fn patch_config(&mut self, patch: IProfiles) -> Result<()> {
        if self.items.is_none() {
            self.items = Some(vec![]);
        }

        if let Some(current) = patch.current {
            let items = self.items.as_deref().unwrap_or_default();
            let some_uid = Some(current);
            if items.iter().any(|e| e.uid == some_uid) {
                self.current = some_uid;
            }
        }

        if let Some(new_chain) = patch.chain {
            // disable old global chain
            if let Some(old_chain) = self.chain.clone() {
                for old_uid in old_chain {
                    let item = self
                        .get_item_mut(&old_uid)
                        .with_context(|| format!("failed to find the profile item \"uid:{old_uid}\""))?;

                    item.enable = Some(false);
                }
            }
            // enable new global chain
            for new_uid in &new_chain {
                let item = self
                    .get_item_mut(new_uid)
                    .with_context(|| format!("failed to find the profile item \"uid:{new_uid}\""))?;
                item.enable = Some(true);
            }

            self.chain = Some(new_chain);
        }

        Ok(())
    }

    pub fn get_current(&self) -> Option<&String> {
        self.current.as_ref()
    }

    /// find the item by the uid
    pub fn get_item(&self, uid: &str) -> Option<&PrfItem> {
        self.items
            .as_ref()
            .and_then(|items| items.iter().find(|item| item.uid == Some(uid.to_string())))
    }

    pub fn get_item_mut(&mut self, uid: &str) -> Option<&mut PrfItem> {
        self.items
            .as_mut()
            .and_then(|items| items.iter_mut().find(|item| item.uid == Some(uid.to_string())))
    }

    pub fn get_profiles(&self) -> Vec<&PrfItem> {
        let items = self.items.as_deref().unwrap_or_default();
        items
            .iter()
            .filter(|&o| matches!(o.itype, Some(ProfileType::Remote) | Some(ProfileType::Local)))
            .collect::<Vec<&PrfItem>>()
    }

    // include all enable or disable chains
    pub fn get_profile_chains(&self, profile_uid: Option<String>, enable_filter: EnableFilter) -> Vec<ChainItem> {
        let items = self.items.clone().unwrap_or_default();
        items
            .into_iter()
            .filter(|o| matches!(o.itype, Some(ProfileType::Merge) | Some(ProfileType::Script)))
            .filter(|i| match enable_filter {
                EnableFilter::All => true,
                EnableFilter::Enable => i.enable.unwrap_or_default(),
                EnableFilter::Disable => !i.enable.unwrap_or_default(),
            })
            .filter(|o| o.parent == profile_uid)
            .filter_map(<Option<ChainItem>>::from)
            .collect::<Vec<ChainItem>>()
    }

    /// append new item
    /// if the file_data is some
    /// then should save the data to file
    pub fn append_item(&mut self, mut item: PrfItem) -> Result<bool> {
        let mut restart_core = false;
        if let Some(uid) = item.uid.clone() {
            // save the file data
            // move the field value after save
            if let Some(file_data) = item.file_data.take()
                && let Some(file) = item.file.as_ref()
            {
                let path = dirs::app_profiles_dir()?.join(file);
                fs::File::create(path)?.write_all(file_data.as_bytes())?;
            }

            if let Some(parent) = item.parent.as_ref() {
                let profile = self
                    .get_item_mut(parent)
                    .with_context(|| format!("failed to find the profile item \"uid:{parent}\""))?;
                match profile.chain.as_mut() {
                    Some(chain) => chain.push(uid.clone()),
                    None => profile.chain = Some(vec![uid.clone()]),
                }
            }

            if self.current.is_none()
                && let Some(profile_type) = item.itype.as_ref()
                && matches!(profile_type, ProfileType::Local | ProfileType::Remote)
            {
                restart_core = true;
                self.current = Some(uid);
            }

            if let Some(items) = self.items.as_mut() {
                items.push(item)
            } else {
                self.items = Some(vec![]);
            }
            self.save_file()?;
        } else {
            anyhow::bail!("the uid should not be null");
        }

        Ok(restart_core)
    }

    /// reorder items
    pub fn reorder(&mut self, active_id: String, over_id: String) -> Result<()> {
        let mut items = self.items.take().unwrap_or_default();
        let mut old_index = None;
        let mut new_index = None;

        for (i, _) in items.iter().enumerate() {
            if items[i].uid == Some(active_id.clone()) {
                old_index = Some(i);
            }
            if items[i].uid == Some(over_id.clone()) {
                new_index = Some(i);
            }
        }

        if let Some(old_index) = old_index
            && let Some(new_index) = new_index
        {
            let item = items.remove(old_index);
            items.insert(new_index, item);
            self.items = Some(items);
            self.save_file()?;
        }
        Ok(())
    }

    /// update the item value
    pub fn patch_item(&mut self, uid: &str, item: PrfItem) -> Result<()> {
        let enable_changed = item.enable.is_some();
        let mut items = self.items.take().unwrap_or_default();

        for each in items.iter_mut() {
            if each.uid == Some(uid.to_string()) {
                let refresh_chains =
                    enable_changed && each.scope.as_ref().is_some_and(|s| matches!(s, ScopeType::Global));
                patch!(each, item, itype);
                patch!(each, item, name);
                patch!(each, item, desc);
                patch!(each, item, file);
                patch!(each, item, url);
                patch!(each, item, selected);
                patch!(each, item, extra);
                patch!(each, item, updated);
                patch!(each, item, option);
                // chain filed
                patch!(each, item, parent);
                patch!(each, item, enable);

                self.items = Some(items);

                if refresh_chains {
                    let chains: Vec<String> = self
                        .get_profile_chains(None, EnableFilter::Enable)
                        .iter()
                        .map(|i| i.uid.clone())
                        .collect();
                    self.chain = Some(chains);
                }
                return self.save_file();
            }
        }

        self.items = Some(items);
        Err(anyhow::anyhow!("failed to find the profile item \"uid:{uid}\""))
    }

    /// be used to update the remote item
    /// only patch `updated` `extra` `file_data`
    pub fn update_item(&mut self, uid: &str, mut item: PrfItem) -> Result<()> {
        if self.items.is_none() {
            self.items = Some(vec![]);
        }

        // find the item
        self.get_item(uid)
            .with_context(|| format!("failed to find the profile item \"uid:{uid}\""))?;

        if let Some(items) = self.items.as_mut() {
            let some_uid = Some(uid);

            for each in items.iter_mut() {
                if each.uid.as_deref() == some_uid {
                    each.extra = item.extra;
                    each.updated = item.updated;
                    each.home = item.home;
                    // save the file data
                    // move the field value after save
                    if let Some(file_data) = item.file_data.take() {
                        let file = each.file.take();
                        let file = file.unwrap_or(item.file.take().unwrap_or(format!("{uid}.yaml")));
                        // the file must exists
                        each.file = Some(file.clone());
                        let path = dirs::app_profiles_dir()?.join(&file);
                        fs::File::create(path)?.write_all(file_data.as_bytes())?;
                    }

                    break;
                }
            }
        }

        self.save_file()
    }

    /// delete item
    /// if delete the current then return true
    pub fn delete_item(&mut self, uid: String) -> Result<bool> {
        let current = self.current.as_ref().unwrap_or(&uid);
        let delete_current = *current == uid;
        let mut restart_core = delete_current;

        let mut items = self.items.clone().unwrap_or_default();
        if let Some(profile) = self.get_item(&uid) {
            match profile.itype {
                Some(ProfileType::Local | ProfileType::Remote) => {
                    tracing::debug!("delete profile {:?}", profile.name);
                    let mut remove_uids = vec![uid.clone()];
                    if let Some(profile_chain) = profile.chain.as_ref() {
                        remove_uids.extend(profile_chain.clone());
                        profile_chain
                            .iter()
                            .filter_map(|chain_uid| self.get_item(chain_uid))
                            .for_each(|o| {
                                tracing::debug!("delete profile chains");
                                log_err!(o.delete_file())
                            });
                    }

                    profile.delete_file()?;
                    items.retain(|i| {
                        if let Some(uid_) = i.uid.as_ref()
                            && !remove_uids.contains(uid_)
                        {
                            true
                        } else {
                            false
                        }
                    });
                    // delete current profile, use next profile
                    if delete_current {
                        if let Some(first) = items.first()
                            && first
                                .itype
                                .as_ref()
                                .is_some_and(|t| matches!(t, ProfileType::Local | ProfileType::Remote))
                            && let Some(uid) = first.uid.as_ref()
                        {
                            self.current = Some(uid.clone());
                        } else {
                            self.current = None
                        }
                    }
                }
                Some(ProfileType::Merge | ProfileType::Script) => {
                    tracing::debug!("delete enhance script {:?}", profile.name);
                    // delete running profile chain, need to restart core
                    if let Some(parent) = profile.parent.as_ref()
                        && let Some(parent_profile) = items.iter_mut().find(|i| i.uid.as_ref() == Some(parent))
                        && let Some(chains) = parent_profile.chain.as_mut()
                    {
                        // update profile chains
                        chains.retain(|i| i != &uid);
                        if let Some(enable) = profile.enable
                            && enable
                            && parent == current
                        {
                            restart_core = true;
                        }
                    }
                    // delete running global chain, need to restart core
                    if let Some(scope) = profile.scope.as_ref()
                        && matches!(scope, ScopeType::Global)
                        && let Some(enable) = profile.enable
                        && enable
                    {
                        restart_core = true;
                    }

                    profile.delete_file()?;
                    items.retain(|i| i.uid != Some(uid.clone()));
                }
                None => {
                    anyhow::bail!("profile type is null");
                }
            }
            if let Some(chain) = self.chain.as_mut() {
                chain.retain(|i| i != &uid);
            }
            self.items = Some(items);
        } else {
            tracing::debug!("reset profiles config");
            *self = Self::template();
            restart_core = true;
        }
        self.save_file()?;

        Ok(restart_core)
    }

    pub fn set_rule_providers_path(&mut self, path: HashMap<String, PathBuf>) {
        let current = self.current.as_ref();
        if let Some(current) = current {
            let mut items = self.items.take().unwrap_or_default();
            for item in items.iter_mut() {
                if let Some(uid) = item.uid.as_ref()
                    && uid == current
                {
                    item.rule_providers_path = Some(path);
                    break;
                }
            }
            self.items = Some(items);
        }
    }

    /// 获取 current 指向的订阅内容
    pub fn current_mapping(&self) -> Option<Mapping> {
        if let Some(current) = self.current.as_ref() {
            self.get_profile_mapping(current)
        } else {
            None
        }
    }

    pub fn get_profile_mapping(&self, profile_uid: &str) -> Option<Mapping> {
        if let Some(items) = self.items.as_ref()
            && let Some(item) = items.iter().find(|&i| i.uid == Some(profile_uid.to_string()))
            && let Some(file) = item.file.as_ref()
        {
            let file_path = dirs::app_profiles_dir().ok()?.join(file);
            let mapping = help::read_merge_mapping(&file_path).ok()?;
            Some(mapping)
        } else {
            None
        }
    }

    pub fn get_current_rule_providers_path(&self) -> Option<&HashMap<String, PathBuf>> {
        if let Some(current) = self.get_current()
            && let Some(item) = self.get_item(current)
        {
            item.rule_providers_path.as_ref()
        } else {
            None
        }
    }
}

pub async fn activate_selected_nodes() -> Result<()> {
    tracing::info!("starting activating selected nodes");
    if let Some(handle) = WORKER_HANDLE.lock().take() {
        tracing::info!("aborting previous worker");
        handle.abort();
    }
    let profiles = Config::profiles();
    let profiles = profiles.latest().clone();
    let Some(current) = profiles.get_current() else {
        bail!("no current profile running");
    };
    let profile = profiles
        .get_item(current)
        .context("failed to get current profile")?
        .clone();

    let handle = tokio::spawn(async move {
        let mihomo = handle::Handle::mihomo();
        // check mihomo is running
        let mut is_mihomo_ready = false;
        for _ in 0..10 {
            if mihomo.get_version().await.is_ok() {
                tracing::debug!("check mihomo api success");
                is_mihomo_ready = true;
                break;
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }

        if !is_mihomo_ready {
            tracing::error!(
                "check that the mihomo api reaches the maximum number of retries, maybe mihomo core is not running"
            );
            return;
        }

        if let Some(selected) = profile.selected.as_ref() {
            tracing::debug!("selected nodes: {selected:?}");
            for selected_item in selected {
                let mut retry = 10;
                if let Some(group_name) = selected_item.name.as_ref()
                    && let Some(node) = selected_item.now.as_ref()
                {
                    while retry >= 0 {
                        tracing::debug!("check node[{node}] exists");
                        if mihomo.get_proxy_by_name(node).await.is_ok() {
                            tracing::debug!("node[{node}] exists");
                            break;
                        }
                        retry -= 1;
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                    if retry < 0 {
                        tracing::error!(
                            "Failed to select node for proxy: {group_name}, node: {node}, because the node [{node}] does not exist"
                        );
                        continue;
                    }
                    if mihomo.select_node_for_group(group_name, node).await.is_err() {
                        tracing::error!("Failed to select node for proxy: {group_name}, node: {node}");
                    } else {
                        tracing::info!("Selected node for proxy: {group_name}, node: {node}");
                    }
                }
            }
            // refresh clash
            handle::Handle::refresh_clash();
        }
        tracing::info!("activating selected nodes done!");
        *WORKER_HANDLE.lock() = None;
    });
    *WORKER_HANDLE.lock() = Some(handle);
    Ok(())
}
