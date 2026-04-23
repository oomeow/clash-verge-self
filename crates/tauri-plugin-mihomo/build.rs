const COMMANDS: &[&str] = &[
    "update_controller",
    "update_secret",
    "get_version",
    "flush_fakeip",
    "flush_dns",
    // connections
    "get_connections",
    "close_all_connections",
    "close_connection",
    // groups
    "get_groups",
    "get_group_by_name",
    "delay_group",
    // providers
    "get_proxy_providers",
    "get_proxy_provider_by_name",
    "update_proxy_provider",
    "healthcheck_proxy_provider",
    "healthcheck_node_in_provider",
    // proxies
    "get_proxies",
    "get_proxy_by_name",
    "select_node_for_group",
    "unfixed_proxy",
    "delay_proxy_by_name",
    // rules
    "get_rules",
    "update_rules_disable",
    "get_rule_providers",
    "update_rule_provider",
    // runtime config
    "get_base_config",
    "reload_config",
    "patch_base_config",
    "update_geo",
    "restart",
    // upgrade
    "upgrade_core",
    "upgrade_ui",
    "upgrade_geo",
    // ws
    "ws_traffic",
    "ws_memory",
    "ws_connections",
    "ws_logs",
    "ws_disconnect",
    "clear_all_ws_connections",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .ios_path("ios")
        .build();
}
