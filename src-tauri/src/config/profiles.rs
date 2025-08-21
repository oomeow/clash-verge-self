use super::{EnableFilter, PrfItem};
use crate::{
    any_err,
    config::ProfileType,
    enhance::chain::{ChainItem, ScopeType},
    error::{AppError, AppResult},
    log_err,
    utils::{dirs, help},
};
use serde::{Deserialize, Serialize};
use serde_yaml::Mapping;
use std::{collections::HashMap, fs, io::Write, path::PathBuf};

/// Define the `profiles.yaml` schema
#[derive(Default, Debug, Clone, Deserialize, Serialize)]
pub struct IProfiles {
    /// same as PrfConfig.current
    pub current: Option<String>,

    /// same as PrfConfig.chain
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
                let enabled_global_chain = profiles.chain.as_deref().unwrap_or_default();
                // compatible with the old old old version
                if let Some(items) = profiles.items.as_mut() {
                    for item in items.iter_mut() {
                        if item.uid.is_none() {
                            item.uid = Some(help::get_uid("d"));
                        }
                        match item.itype {
                            Some(ProfileType::Merge) | Some(ProfileType::Script) => {
                                if item.scope.is_none() {
                                    let uid = item.uid.as_ref().unwrap();
                                    item.scope = Some(ScopeType::Global);
                                    item.enable = Some(enabled_global_chain.contains(uid));
                                }
                            }
                            _ => {}
                        }
                    }
                }
                profiles
            }
            Err(err) => {
                tracing::error!("{err}");
                Self::template()
            }
        }
    }

    pub fn template() -> Self {
        Self {
            items: Some(vec![]),
            ..Self::default()
        }
    }

    pub fn save_file(&self) -> AppResult<()> {
        help::save_yaml(&dirs::profiles_path()?, self, Some("# Profiles Config for Clash Verge"))
    }

    /// 只修改 current、global chain
    pub fn patch_config(&mut self, patch: IProfiles) -> AppResult<()> {
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
            let old_chain = self.chain.clone();
            // disable old chain
            if let Some(old_chain) = old_chain {
                for old_uid in old_chain {
                    let item = self
                        .get_item_mut(&old_uid)
                        .ok_or(any_err!("failed to find the profile item \"uid:{old_uid}\""))?;

                    item.enable = Some(false);
                }
            }
            // enable new chain
            for new_uid in new_chain.iter() {
                let item = self
                    .get_item_mut(new_uid)
                    .ok_or(any_err!("failed to find the profile item \"uid:{new_uid}\""))?;
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
    pub fn append_item(&mut self, mut item: PrfItem) -> AppResult<bool> {
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
                    .ok_or(any_err!("failed to find the profile item \"uid:{parent}\""))?;
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
            return Err(AppError::InvalidValue("the uid should not be null".to_string()));
        }

        Ok(restart_core)
    }

    /// reorder items
    pub fn reorder(&mut self, active_id: String, over_id: String) -> AppResult<()> {
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
    pub fn patch_item(&mut self, uid: &str, item: PrfItem) -> AppResult<()> {
        let mut items = self.items.take().unwrap_or_default();

        for each in items.iter_mut() {
            if each.uid == Some(uid.to_string()) {
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
                return self.save_file();
            }
        }

        self.items = Some(items);
        Err(AppError::PatchConfig(format!(
            "failed to find the profile item \"uid:{uid}\""
        )))
    }

    /// be used to update the remote item
    /// only patch `updated` `extra` `file_data`
    pub fn update_item(&mut self, uid: &str, mut item: PrfItem) -> AppResult<()> {
        if self.items.is_none() {
            self.items = Some(vec![]);
        }

        // find the item
        self.get_item(uid)
            .ok_or(any_err!("failed to find the profile item \"uid:{uid}\""))?;

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
    pub fn delete_item(&mut self, uid: String) -> AppResult<bool> {
        let current = self.current.as_ref().unwrap_or(&uid);
        let mut restart_core;

        let profile = self.get_item(&uid);
        if let Some(profile) = profile {
            // delete profile and profile chains
            let mut remove_uids = vec![uid.clone()];
            if let Some(profile_chain) = profile.chain.as_ref() {
                // 删除的 profile 有 chain 时, 需要一同删除
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

            // check if need to restart core
            let delete_current = uid == *current;
            restart_core = delete_current;

            let mut parent_profile = None;
            if let Some(parent) = profile.parent.as_ref() {
                // 修改父级订阅下的 chain，移除当前删除的 chain uid
                parent_profile = self.get_item(parent).cloned();
                if let Some(parent_profile) = parent_profile.as_mut()
                    && let Some(p_chains) = parent_profile.chain.as_mut()
                {
                    p_chains.retain(|i| i != &uid);
                }
                // 判断是否需要重启内核
                if *parent == *current
                    && let Some(enable) = profile.enable.as_ref()
                    && *enable
                {
                    restart_core = true;
                }
            }

            let items = self.items.as_mut();
            if let Some(items) = items {
                // 如果删除的是某个订阅下的 chain，需要修改该订阅下的 chain 数据，移除删除的 chain 的 uid
                // 该实现比较丑陋，需要重新优化
                if let Some(parent_profile) = parent_profile
                    && let Some(index) = items.iter().position(|i| i.uid == parent_profile.uid)
                {
                    items.retain(|i| i.uid != parent_profile.uid);
                    items.insert(index, parent_profile);
                }
                // 移除当前删除的 profile 相关联的其他 profile
                items.retain(|i| {
                    if let Some(uid_) = i.uid.as_ref()
                        && !remove_uids.contains(uid_)
                    {
                        true
                    } else {
                        false
                    }
                });
                if delete_current {
                    if let [first, ..] = items.as_slice()
                        && let Some(uid) = first.uid.as_ref()
                    {
                        self.current = Some(uid.clone());
                    } else {
                        self.current = None
                    }
                }
            }
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

    pub fn get_current_profile_rule_providers(&self) -> Option<&HashMap<String, PathBuf>> {
        if let Some(current) = self.get_current()
            && let Some(item) = self.get_item(current)
        {
            item.rule_providers_path.as_ref()
        } else {
            None
        }
    }
}
