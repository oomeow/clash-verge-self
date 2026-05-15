use std::{collections::HashMap, fs};

use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_yaml::Mapping;

use super::{LogMessage, use_merge, use_script};
use crate::{
    config::{PrfItem, ProfileType},
    utils::{dirs, help},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct ChainItem {
    pub uid: String,
    pub name: String,
    pub desc: String,
    pub file: String,
    #[serde(rename = "type")]
    pub itype: ChainType,
    pub parent: Option<String>,
    pub enable: bool,
    pub scope: ScopeType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainType {
    Merge,
    Script,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ScopeType {
    #[default]
    Global,
    Specific,
}

impl From<PrfItem> for Option<ChainItem> {
    fn from(item: PrfItem) -> Self {
        let name = item.name.clone()?;
        let desc = item.desc.clone()?;
        let itype = item.itype.as_ref()?;
        let file = item.file.clone()?;
        let uid = item.uid.clone().unwrap_or_default();
        let path = dirs::app_profiles_dir().ok()?.join(&file);
        let enable = item.enable.unwrap_or_default();
        let parent = item.parent.clone();
        let scope = item.scope.unwrap_or_default();

        if !path.exists() {
            return None;
        }

        match itype {
            ProfileType::Script => Some(ChainItem {
                uid,
                name,
                desc,
                itype: ChainType::Script,
                file,
                parent,
                enable,
                scope,
            }),
            ProfileType::Merge => Some(ChainItem {
                uid,
                name,
                desc,
                itype: ChainType::Merge,
                file,
                parent,
                enable,
                scope,
            }),
            _ => None,
        }
    }
}

impl ChainItem {
    pub fn execute(&self, config: &mut Mapping) -> Result<Option<HashMap<String, Vec<LogMessage>>>> {
        let path = dirs::app_profiles_dir()?.join(&self.file);
        if !path.exists() {
            anyhow::bail!("couldn't find enhance file, {}", self.name);
        }

        let logs = match self.itype {
            ChainType::Merge => {
                let content = help::read_merge_mapping(&path)?;
                let current_config = std::mem::take(config);
                *config = use_merge(content, current_config);
                None
            }
            ChainType::Script => {
                let content = fs::read_to_string(&path)?;
                let current_config = std::mem::take(config);
                let fallback_config = current_config.clone();
                let (res_config, script_logs) = match use_script(content, current_config) {
                    Ok(result) => result,
                    Err(err) => {
                        *config = fallback_config;
                        return Err(err);
                    }
                };
                *config = res_config;

                let mut res_logs = HashMap::new();
                res_logs.insert(self.uid.clone(), script_logs);
                Some(res_logs)
            }
        };
        tracing::info!("chain [{}] execute finished", self.name);
        Ok(logs)
    }
}

#[test]
fn test_serde() -> Result<()> {
    let parent = Some("rhasdfwsd".to_string());
    let uid = "123".to_string();
    let name = "test".to_string();
    let desc = "这是一个测试用例".to_string();
    let file = "m6AlCCwRNplH.yaml".to_string();
    // let path = dirs::app_profiles_dir()?.join(&file);
    let chain = ChainItem {
        uid,
        name,
        desc,
        file,
        itype: ChainType::Merge,
        parent,
        enable: false,
        scope: ScopeType::Global,
    };
    let json = serde_yaml::to_string(&chain)?;
    println!("yaml: {json:?}");
    Ok(())
}
