use std::collections::HashMap;

use tauri::async_runtime::RwLock;
use tauri::{command, State};

use crate::mihomo::Mihomo;
use crate::{models::*, Result};

#[command]
pub(crate) async fn update_controller(
    state: State<'_, RwLock<Mihomo>>,
    host: String,
    port: u32,
) -> Result<()> {
    let mut mihomo = state.write().await;
    mihomo.update_external_host(host);
    mihomo.update_external_port(port);
    Ok(())
}

#[command]
pub(crate) async fn update_secret(state: State<'_, RwLock<Mihomo>>, secret: String) -> Result<()> {
    state.write().await.update_secret(secret);
    Ok(())
}

#[command]
pub(crate) async fn get_version(state: State<'_, RwLock<Mihomo>>) -> Result<MihomoVersion> {
    state.read().await.get_version().await
}

#[command]
pub(crate) async fn clean_fakeip(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.clean_fakeip().await
}

// connections
#[command]
pub(crate) async fn get_connections(state: State<'_, RwLock<Mihomo>>) -> Result<Connections> {
    state.read().await.get_connections().await
}

#[command]
pub(crate) async fn close_all_connections(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.close_all_connections().await
}

#[command]
pub(crate) async fn close_connections(
    state: State<'_, RwLock<Mihomo>>,
    connection_id: String,
) -> Result<()> {
    state.read().await.close_connection(&connection_id).await
}

// groups
#[command]
pub(crate) async fn get_groups(state: State<'_, RwLock<Mihomo>>) -> Result<GroupProxies> {
    state.read().await.get_groups().await
}

#[command]
pub(crate) async fn get_group_by_name(
    state: State<'_, RwLock<Mihomo>>,
    group_name: String,
) -> Result<Proxy> {
    state.read().await.get_group_by_name(&group_name).await
}

#[command]
pub(crate) async fn delay_group(
    state: State<'_, RwLock<Mihomo>>,
    group_name: String,
    test_url: String,
    timeout: u32,
) -> Result<HashMap<String, u32>> {
    state
        .read()
        .await
        .delay_group(&group_name, &test_url, timeout)
        .await
}

// providers
#[command]
pub(crate) async fn get_proxies_providers(state: State<'_, RwLock<Mihomo>>) -> Result<Providers> {
    state.read().await.get_proxies_providers().await
}

#[command]
pub(crate) async fn get_providers_proxy_by_name(
    state: State<'_, RwLock<Mihomo>>,
    provider_name: String,
) -> Result<ProxyProviders> {
    state
        .read()
        .await
        .get_providers_proxy_by_name(&provider_name)
        .await
}

#[command]
pub(crate) async fn update_proxies_providers(
    state: State<'_, RwLock<Mihomo>>,
    provider_name: String,
) -> Result<()> {
    state
        .read()
        .await
        .update_proxies_providers(&provider_name)
        .await
}

#[command]
pub(crate) async fn healthcheck_providers(
    state: State<'_, RwLock<Mihomo>>,
    providers_name: String,
) -> Result<()> {
    state
        .read()
        .await
        .healthcheck_providers(&providers_name)
        .await
}

#[command]
pub(crate) async fn healthcheck_providers_proxies(
    state: State<'_, RwLock<Mihomo>>,
    providers_name: String,
    proxies_name: String,
    test_url: String,
    timeout: u32,
) -> Result<()> {
    state
        .read()
        .await
        .healthcheck_providers_proxies(&providers_name, &proxies_name, &test_url, timeout)
        .await
}

// proxies
#[command]
pub(crate) async fn get_proxies(state: State<'_, RwLock<Mihomo>>) -> Result<Proxies> {
    state.read().await.get_proxies().await
}

#[command]
pub(crate) async fn get_proxy_by_name(
    state: State<'_, RwLock<Mihomo>>,
    proxies_name: String,
) -> Result<Proxy> {
    state.read().await.get_proxy_by_name(&proxies_name).await
}

#[command]
pub(crate) async fn select_node_for_proxy(
    state: State<'_, RwLock<Mihomo>>,
    proxy_name: String,
    node: String,
) -> Result<()> {
    state
        .read()
        .await
        .select_node_for_proxy(&proxy_name, &node)
        .await
}

#[command]
pub(crate) async fn unfixed_proxy(
    state: State<'_, RwLock<Mihomo>>,
    proxy_name: String,
) -> Result<()> {
    state.read().await.unfixed_proxy(&proxy_name).await
}

#[command]
pub(crate) async fn delay_proxy_by_name(
    state: State<'_, RwLock<Mihomo>>,
    proxy_name: String,
    test_url: String,
    timeout: u32,
) -> Result<ProxyDelay> {
    state
        .read()
        .await
        .delay_proxy_by_name(&proxy_name, &test_url, timeout)
        .await
}

// rules
#[command]
pub(crate) async fn get_rules(state: State<'_, RwLock<Mihomo>>) -> Result<Rules> {
    state.read().await.get_rules().await
}

#[command]
pub(crate) async fn get_rules_providers(state: State<'_, RwLock<Mihomo>>) -> Result<RuleProviders> {
    state.read().await.get_rules_providers().await
}

#[command]
pub(crate) async fn update_rules_providers(
    state: State<'_, RwLock<Mihomo>>,
    providers_name: String,
) -> Result<()> {
    state
        .read()
        .await
        .update_rules_providers(&providers_name)
        .await
}

// runtime config
#[command]
pub(crate) async fn get_base_config(state: State<'_, RwLock<Mihomo>>) -> Result<BaseConfig> {
    state.read().await.get_base_config().await
}

#[command]
pub(crate) async fn reload_config(
    state: State<'_, RwLock<Mihomo>>,
    force: bool,
    path: String,
) -> Result<()> {
    state.read().await.reload_config(force, &path).await
}

#[command]
pub(crate) async fn patch_base_config(
    state: State<'_, RwLock<Mihomo>>,
    data: serde_json::Value,
) -> Result<()> {
    state.read().await.patch_base_config(&data).await
}

#[command]
pub(crate) async fn update_geo(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.update_geo().await
}

#[command]
pub(crate) async fn restart(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.restart().await
}

// upgrade
#[command]
pub(crate) async fn upgrade_core(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.upgrade_core().await
}

#[command]
pub(crate) async fn upgrade_ui(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.upgrade_ui().await
}

#[command]
pub(crate) async fn upgrade_geo(state: State<'_, RwLock<Mihomo>>) -> Result<()> {
    state.read().await.upgrade_geo().await
}
