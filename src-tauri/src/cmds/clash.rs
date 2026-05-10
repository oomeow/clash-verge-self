use std::collections::HashMap;

use anyhow::Context;
use mihomo_rule_parser::{RuleBehavior, RuleFormat, RulePayload};
use rust_i18n::t;
use serde::{Deserialize, Serialize};
use serde_yaml::Mapping;

use crate::{
    cmds::{CommandResult, into_command_result},
    config::{ClashInfo, Config},
    core::CoreManager,
    enhance::{self, LogMessage, MergeResult},
    feat,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CmdMergeResult {
    config: String,
    logs: HashMap<String, Vec<LogMessage>>,
}

#[tauri::command]
pub fn get_clash_info() -> CommandResult<ClashInfo> {
    Ok(Config::clash().latest().get_client_info())
}

#[tauri::command]
pub fn get_runtime_config() -> CommandResult<Option<Mapping>> {
    Ok(Config::runtime().latest().config.clone())
}

#[tauri::command]
pub fn get_runtime_yaml() -> CommandResult<String> {
    into_command_result((|| -> anyhow::Result<String> {
        let runtime = Config::runtime();
        let runtime = runtime.latest();
        let config = runtime.config.as_ref();
        let config = config.with_context(|| t!("error.config.parseFailed"))?;
        Ok(serde_yaml::to_string(config)?)
    })())
}

#[tauri::command]
pub fn get_runtime_logs() -> CommandResult<HashMap<String, Vec<LogMessage>>> {
    Ok(Config::runtime().latest().chain_logs.clone())
}

#[tauri::command]
pub fn get_pre_merge_result(parent_uid: Option<String>, modified_uid: String) -> CommandResult<CmdMergeResult> {
    into_command_result((|| {
        let MergeResult { config, logs } = enhance::get_pre_merge_result(parent_uid, modified_uid)?;
        let config = serde_yaml::to_string(&config)?;
        Ok(CmdMergeResult { config, logs })
    })())
}

#[tauri::command]
pub async fn test_merge_chain(
    profile_uid: Option<String>,
    modified_uid: String,
    content: String,
) -> CommandResult<CmdMergeResult> {
    into_command_result(
        async {
            let MergeResult { config, logs } = enhance::test_merge_chain(profile_uid, modified_uid, content).await?;
            let config = serde_yaml::to_string(&config)?;
            Ok(CmdMergeResult { config, logs })
        }
        .await,
    )
}

#[tauri::command]
pub async fn patch_clash_config(payload: Mapping) -> CommandResult<()> {
    into_command_result(feat::patch_clash(payload).await)
}

#[tauri::command]
pub async fn change_clash_core(clash_core: Option<String>) -> CommandResult<()> {
    into_command_result(CoreManager::global().change_core(clash_core).await)
}

#[tauri::command]
pub async fn get_rule_provider_payload(
    provider_name: String,
    behavior: RuleBehavior,
    format: RuleFormat,
) -> CommandResult<RulePayload> {
    into_command_result((|| {
        let file_path = Config::profiles()
            .latest()
            .get_current_rule_providers_path()
            .and_then(|m| m.get(&provider_name))
            .context("Provider not found")?
            .clone();
        let payload = mihomo_rule_parser::parse(file_path, behavior, format)?;
        Ok(payload)
    })())
}
