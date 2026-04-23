use std::collections::HashMap;

use tauri_plugin_mihomo::{Error, Result, failed_resp};

mod common;

#[tokio::test]
async fn mihomo_rule_list() -> Result<()> {
    let mihomo = common::mihomo();
    let rules = mihomo.get_rules().await?;
    println!("{:?}", rules.rules);
    Ok(())
}

#[tokio::test]
async fn mihomo_rule_update_disable() -> Result<()> {
    let mihomo = common::mihomo();
    let rules = mihomo.get_rules().await?;
    let rule_index = rules
        .rules
        .first_chunk::<2>()
        .and_then(|i| {
            let mut index_list = vec![];
            for r in i {
                index_list.push(r.index);
            }
            Some(index_list)
        })
        .ok_or(Error::FailedResponse("".to_string()))?;
    let res = rules
        .rules
        .iter()
        .filter(|p| rule_index.contains(&p.index))
        .collect::<Vec<_>>();
    println!("{:?}\n", res);

    // disable
    let mut disable_map = HashMap::new();
    for index in rule_index.clone() {
        disable_map.insert(index, true);
    }
    mihomo.update_rules_disable(disable_map).await?;
    let rules = mihomo.get_rules().await?;
    let res = rules
        .rules
        .iter()
        .filter(|p| rule_index.contains(&p.index))
        .collect::<Vec<_>>();
    println!("{:?}\n", res);

    // enable
    let mut enable_map = HashMap::new();
    for index in rule_index.clone() {
        enable_map.insert(index, false);
    }
    mihomo.update_rules_disable(enable_map).await?;
    let rules = mihomo.get_rules().await?;
    let res = rules
        .rules
        .iter()
        .filter(|p| rule_index.contains(&p.index))
        .collect::<Vec<_>>();
    println!("{:?}\n", res);
    Ok(())
}

#[tokio::test]
async fn mihomo_rule_providers() -> Result<()> {
    let mihomo = common::mihomo();
    let providers = mihomo.get_rule_providers().await?;
    println!("{:?}", providers.providers);
    Ok(())
}

#[tokio::test]
async fn mihomo_rule_update_provider() -> Result<()> {
    let mihomo = common::mihomo();
    let providers = mihomo.get_rule_providers().await?;
    let provider_name = providers
        .providers
        .keys()
        .next()
        .ok_or(failed_resp!("no rule provider"))?;
    println!("update rule provider: {}", provider_name);
    mihomo.update_rule_provider(provider_name).await?;
    Ok(())
}
