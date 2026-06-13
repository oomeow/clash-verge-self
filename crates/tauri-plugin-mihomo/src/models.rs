use std::{collections::HashMap, fmt::Display};

use serde::{Deserialize, Serialize};
use tokio::{sync::RwLock, task::AbortHandle};
use ts_rs::TS;

use crate::stream::WsWriteKind;

#[derive(Debug, Default, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
// Local plugin transport selector. No direct Mihomo model.
pub enum Protocol {
    #[default]
    Http,
    LocalSocket,
}

impl Display for Protocol {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Protocol::Http => write!(f, "http"),
            Protocol::LocalSocket => {
                if cfg!(windows) {
                    write!(f, "named pipe")
                } else {
                    write!(f, "unix socket")
                }
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, rename_all = "camelCase")]
#[serde(rename_all(serialize = "camelCase", deserialize = "kebab-case"))]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/config/config.go#L47-L70
// https://github.com/MetaCubeX/mihomo/blob/Alpha/config/config.go#L73-L91
pub struct BaseConfig {
    pub port: u32,
    pub socks_port: u32,
    pub redir_port: u32,
    pub tproxy_port: u32,
    pub mixed_port: u32,
    pub tun: TunConfig,
    pub tuic_server: TuicServer,
    pub ss_config: String,
    pub vmess_config: String,
    pub authentication: Option<Vec<String>>,
    pub skip_auth_prefixes: Option<Vec<String>>,
    pub lan_allowed_ips: Option<Vec<String>>,
    pub lan_disallowed_ips: Option<Vec<String>>,
    pub allow_lan: bool,
    pub bind_address: String,
    pub inbound_tfo: bool,
    pub inbound_mptcp: bool,
    pub mode: ClashMode,
    pub unified_delay: bool,
    pub log_level: LogLevel,
    pub ipv6: bool,
    pub interface_name: String,
    pub routing_mark: isize,
    pub geox_url: GeoXUrl,
    pub geo_auto_update: bool,
    pub geo_update_interval: isize,
    pub geodata_mode: bool,
    pub geodata_loader: String,
    pub geosite_matcher: String,
    pub tcp_concurrent: bool,
    pub find_process_mode: FindProcessMode,
    pub sniffing: bool,
    pub global_ua: String,
    pub etag_support: bool,
    pub keep_alive_interval: isize,
    pub keep_alive_idle: isize,
    pub disable_keep_alive: bool,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, rename_all = "camelCase")]
#[serde(rename_all(serialize = "camelCase", deserialize = "kebab-case"))]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/listener/config/tun.go#L12-L65
pub struct TunConfig {
    pub enable: bool,
    pub device: String,
    pub stack: TunStack,
    pub dns_hijack: Vec<String>,
    pub auto_route: bool,
    pub auto_detect_interface: bool,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub mtu: Option<u32>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub gso: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub gso_max_size: Option<u32>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub inet4_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub inet6_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub iproute2_table_index: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub iproute2_rule_index: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub auto_redirect: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub auto_redirect_input_mark: Option<u32>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub auto_redirect_output_mark: Option<u32>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub auto_redirect_iproute2_fallback_rule_index: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub loopback_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub strict_route: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub route_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub route_address_set: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub route_exclude_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub route_exclude_address_set: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub include_interface: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_interface: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub include_uid: Option<Vec<u32>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub include_uid_range: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_uid: Option<Vec<u32>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_uid_range: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_src_port: Option<Vec<u16>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_src_port_range: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_dst_port: Option<Vec<u16>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_dst_port_range: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub include_android_user: Option<Vec<isize>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub include_package: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_package: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub include_mac_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub exclude_mac_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub endpoint_independent_nat: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub udp_timeout: Option<i64>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub disable_icmp_forwarding: Option<bool>,

    pub file_descriptor: isize,

    // The following `inet*` fields will be deprecated
    // refer: https://wiki.metacubex.one/config/inbound/tun/#_1
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub inet4_route_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub inet6_route_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub inet4_route_exclude_address: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub inet6_route_exclude_address: Option<Vec<String>>,

    // darwin special config
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub recvmsgx: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub sendmsgx: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, rename_all = "camelCase")]
#[serde(rename_all(serialize = "camelCase", deserialize = "kebab-case"))]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/listener/config/tuic.go#L9-L28
pub struct TuicServer {
    pub enable: bool,
    pub listen: String,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub token: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub users: Option<HashMap<String, String>>,

    pub certificate: String,
    pub private_key: String,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub client_auth_type: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub client_auth_cert: Option<String>,

    pub ech_key: String,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub congestion_controller: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub max_idle_time: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub authentication_timeout: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub alpn: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub max_udp_relay_packet_size: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub max_datagram_frame_size: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub cwnd: Option<isize>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub bbr_profile: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub mux_option: Option<MuxOption>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/listener/sing/sing.go#L42-L45
pub struct MuxOption {
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub padding: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub brutal: Option<BrutalOption>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/listener/sing/sing.go#L47-L51
pub struct BrutalOption {
    pub enabled: bool,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub up: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub down: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS, Clone, Copy)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/log/level.go#L17-L23
// https://github.com/MetaCubeX/mihomo/blob/Alpha/log/level.go#L42-L57
pub enum LogLevel {
    DEBUG,
    INFO,
    WARNING,
    ERROR,
    SILENT,
}

impl Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::DEBUG => write!(f, "debug"),
            LogLevel::INFO => write!(f, "info"),
            LogLevel::WARNING => write!(f, "warning"),
            LogLevel::ERROR => write!(f, "error"),
            LogLevel::SILENT => write!(f, "silent"),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export, rename_all = "camelCase")]
#[serde(rename_all(serialize = "camelCase", deserialize = "kebab-case"))]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/config/config.go#L93-L99
pub struct GeoXUrl {
    pub geo_ip: String,
    pub mmdb: String,
    pub asn: String,
    pub geo_site: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/component/process/find_process_mode.go#L8-L12
// https://github.com/MetaCubeX/mihomo/blob/Alpha/component/process/find_process_mode.go#L43-L52
pub enum FindProcessMode {
    Strict,
    Always,
    Off,
}

/// mihomo version
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/server.go#L573
pub struct MihomoVersion {
    pub meta: bool,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/component/updater/update_core.go#L39-L42
// https://github.com/MetaCubeX/mihomo/blob/Alpha/component/updater/update_core.go#L91-L102
pub enum CoreUpdaterChannel {
    #[serde(rename = "release")]
    ReleaseChannel,
    #[serde(rename = "alpha")]
    AlphaChannel,
    #[serde(rename = "auto")]
    Auto,
}

impl Display for CoreUpdaterChannel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CoreUpdaterChannel::ReleaseChannel => write!(f, "release"),
            CoreUpdaterChannel::AlphaChannel => write!(f, "alpha"),
            CoreUpdaterChannel::Auto => write!(f, "auto"),
        }
    }
}

/// clash mode enum
#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export)]
#[serde(rename_all = "lowercase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/tunnel/mode.go#L17-L21
// https://github.com/MetaCubeX/mihomo/blob/Alpha/tunnel/mode.go#L38-L49
pub enum ClashMode {
    Rule,
    Global,
    Direct,

    #[serde(other)]
    Unknown,
}

impl Display for ClashMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ClashMode::Rule => write!(f, "rule"),
            ClashMode::Global => write!(f, "global"),
            ClashMode::Direct => write!(f, "direct"),
            ClashMode::Unknown => write!(f, "unknown"),
        }
    }
}

/// tun stack enum
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/tun.go#L14-L18
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/tun.go#L37-L48
pub enum TunStack {
    Mixed,
    #[serde(rename = "gVisor")]
    Gvisor,
    System,

    #[serde(other)]
    Unknown,
}

impl Display for TunStack {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TunStack::Mixed => write!(f, "Mixed"),
            TunStack::Gvisor => write!(f, "gVisor"),
            TunStack::System => write!(f, "System"),
            TunStack::Unknown => write!(f, "Unknown"),
        }
    }
}

/// group proxies
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/groups.go#L31-L41
pub struct Groups {
    pub proxies: Vec<Proxy>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/adapter/adapter.go#L136-L162
pub struct Proxy {
    // group type need
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub all: Option<Vec<String>>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub expected_status: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub fixed: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub hidden: Option<bool>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub icon: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub now: Option<String>,

    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub test_url: Option<String>,

    // single proxy type need
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub id: Option<String>,

    // basic fields
    pub alive: bool,
    pub history: Vec<DelayHistory>,
    pub extra: HashMap<String, Extra>,
    pub name: String,
    pub udp: bool,
    pub uot: bool,
    #[serde(rename = "type")]
    pub proxy_type: ProxyType,
    pub xudp: bool,
    pub tfo: bool,
    pub mptcp: bool,
    pub smux: bool,
    pub interface: String,

    #[serde(rename(serialize = "dialerProxy", deserialize = "dialer-proxy"))]
    pub dialer_proxy: String,

    #[serde(rename(serialize = "routingMark", deserialize = "routing-mark"))]
    pub routing_mark: i32,

    #[serde(rename(serialize = "providerName", deserialize = "provider-name"))]
    pub provider_name: String,

    // group type need: fallback proxy name when the group has no available proxies
    // https://github.com/MetaCubeX/mihomo/blob/Alpha/adapter/outboundgroup/selector.go
    // https://github.com/MetaCubeX/mihomo/blob/Alpha/adapter/outboundgroup/urltest.go
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub empty_fallback: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/adapters.go#L18-L55
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/adapters.go#L176-L249
pub enum ProxyType {
    Direct,
    Reject,
    RejectDrop,
    Compatible,
    Pass,
    PassRule,
    Rematch,
    Dns,

    Relay,
    Selector,
    Fallback,
    URLTest,
    LoadBalance,

    Shadowsocks,
    ShadowsocksR,
    Snell,
    Socks5,
    Http,
    Vmess,
    Vless,
    Trojan,
    Hysteria,
    Hysteria2,
    WireGuard,
    Tuic,
    Ssh,
    Mieru,
    AnyTLS,
    Sudoku,
    Masque,
    TrustTunnel,
    OpenVPN,
    Tailscale,
    GostRelay,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/adapters.go#L156-L159
pub struct Extra {
    pub alive: bool,
    pub history: Vec<DelayHistory>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/adapters.go#L151-L154
pub struct DelayHistory {
    pub time: String,
    pub delay: u16,
}

/// proxies
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/proxies.go#L62-L67
pub struct Proxies {
    pub proxies: HashMap<String, Proxy>,
}

/// proxy delay result
///
/// displays a message if it times out, otherwise it only displays the delay
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ProxyDelay {
    pub delay: u32,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/provider.go#L40-L43
pub struct ProxyProviders {
    pub providers: HashMap<String, ProxyProvider>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L47-L50
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L55-L64
pub enum ProviderType {
    Proxy,
    Rule,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L12-L17
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L22-L35
pub enum VehicleType {
    File,
    HTTP,
    Compatible,
    Inline,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/adapter/provider/provider.go#L35-L44
pub struct ProxyProvider {
    pub name: String,
    #[serde(rename = "type")]
    pub provider_type: ProviderType,
    pub vehicle_type: VehicleType,
    pub proxies: Vec<Proxy>,
    pub test_url: String,
    pub expected_status: String,
    pub updated_at: Option<String>,
    pub subscription_info: Option<SubscriptionInfo>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "PascalCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/adapter/provider/subscription_info.go#L11-L16
pub struct SubscriptionInfo {
    pub upload: i64,
    pub download: i64,
    pub total: i64,
    pub expire: i64,
}

/// rules
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/rules.go#L42-L73
pub struct Rules {
    pub rules: Vec<Rule>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/rules.go#L23-L40
pub struct Rule {
    pub index: isize,
    #[serde(rename = "type")]
    pub rule_type: RuleType,
    pub payload: String,
    pub proxy: String,
    pub size: isize,
    pub extra: Option<RuleExtra>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/rules.go#L34-L40
pub struct RuleExtra {
    pub disabled: bool,
    pub hit_count: u64,
    pub hit_at: String,
    pub miss_count: u64,
    pub miss_at: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/rule.go#L6-L43
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/rule.go#L47-L124
pub enum RuleType {
    Domain,
    DomainSuffix,
    DomainKeyword,
    DomainRegex,
    DomainWildcard,
    GeoSite,
    GeoIP,
    SrcGeoIP,
    IPASN,
    SrcIPASN,
    IPCIDR,
    SrcIPCIDR,
    IPSuffix,
    SrcIPSuffix,
    SrcPort,
    DstPort,
    InPort,
    DSCP,
    InUser,
    InName,
    InType,
    ProcessName,
    ProcessPath,
    ProcessNameRegex,
    ProcessPathRegex,
    ProcessNameWildcard,
    ProcessPathWildcard,
    RematchName,
    RuleSet,
    Network,
    Uid,
    SubRules,
    Match,
    AND,
    OR,
    NOT,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/provider.go#L123-L128
pub struct RuleProviders {
    pub providers: HashMap<String, RuleProvider>,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L99-L103
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L108-L119
pub enum RuleBehavior {
    Domain,
    #[serde(rename = "IPCIDR")]
    IpCidr,
    Classical,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L148-L152
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/provider/interface.go#L156-L167
pub enum RuleFormat {
    #[serde(rename = "YamlRule")]
    Yaml,
    #[serde(rename = "TextRule")]
    Text,
    #[serde(rename = "MrsRule")]
    Mrs,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/rules/provider/provider.go#L35-L44
// rule provider json: https://github.com/MetaCubeX/mihomo/blob/Alpha/rules/provider/provider.go#L107-L118
pub struct RuleProvider {
    pub behavior: RuleBehavior,
    pub format: RuleFormat,
    pub name: String,
    pub rule_count: u32,
    #[serde(rename = "type")]
    pub provider_type: ProviderType,
    pub updated_at: Option<String>,
    pub vehicle_type: VehicleType,
}

/// connections
#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/connections.go#L26
// https://github.com/MetaCubeX/mihomo/blob/Alpha/tunnel/statistic/manager.go#L90-L95
pub struct Connections {
    pub download_total: u64,
    pub upload_total: u64,
    pub connections: Option<Vec<Connection>>,
    pub memory: u64,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/tunnel/statistic/manager.go#L85
// https://github.com/MetaCubeX/mihomo/blob/Alpha/tunnel/statistic/tracker.go#L24-L34
pub struct Connection {
    pub id: String,
    pub metadata: ConnectionMetaData,
    pub upload: u64,
    pub download: u64,
    pub start: String,
    pub chains: Vec<String>,
    pub provider_chains: Vec<String>,
    pub rule: String,
    pub rule_payload: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/metadata.go#L18-L23
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/metadata.go#L65-L76
pub enum Network {
    #[serde(rename = "tcp")]
    TCP,
    #[serde(rename = "udp")]
    UDP,
    #[serde(rename = "all")]
    ALLNet,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/metadata.go#L25-L46
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/metadata.go#L84-L129
pub enum ConnectionType {
    HTTP,
    HTTPS,
    #[serde(rename = "Socks4")]
    SOCKS4,
    #[serde(rename = "Socks5")]
    SOCKS5,
    #[serde(rename = "ShadowSocks")]
    SHADOWSOCKS,
    #[serde(rename = "Snell")]
    SNELL,
    #[serde(rename = "Vmess")]
    VMESS,
    #[serde(rename = "Vless")]
    VLESS,
    #[serde(rename = "Redir")]
    REDIR,
    #[serde(rename = "TProxy")]
    TPROXY,
    #[serde(rename = "Trojan")]
    TROJAN,
    #[serde(rename = "Tunnel")]
    TUNNEL,
    #[serde(rename = "Tun")]
    TUN,
    #[serde(rename = "Tuic")]
    TUIC,
    #[serde(rename = "Hysteria2")]
    HYSTERIA2,
    #[serde(rename = "AnyTLS")]
    ANYTLS,
    #[serde(rename = "Mieru")]
    MIERU,
    #[serde(rename = "Sudoku")]
    SUDOKU,
    #[serde(rename = "TrustTunnel")]
    TRUSTTUNNEL,
    #[serde(rename = "Inner")]
    INNER,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/dns.go#L15-L20
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/dns.go#L39-L52
pub enum DNSMode {
    #[serde(rename = "normal")]
    Normal,
    #[serde(rename = "fake-ip")]
    FakeIP,
    #[serde(rename = "redir-host")]
    Mapping,
    #[serde(rename = "hosts")]
    Hosts,

    #[serde(other)]
    Unknown,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "camelCase")]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/constant/metadata.go#L185-L215
pub struct ConnectionMetaData {
    pub network: Network,

    #[serde(rename = "type")]
    pub connection_type: ConnectionType,

    #[serde(rename = "sourceIP")]
    pub source_ip: String,

    #[serde(rename = "destinationIP")]
    pub destination_ip: String,

    #[serde(rename = "sourceGeoIP")]
    pub source_geo_ip: Option<Vec<String>>,

    #[serde(rename = "destinationGeoIP")]
    pub destination_geo_ip: Option<Vec<String>>,

    #[serde(rename = "sourceIPASN")]
    pub source_ip_asn: String,

    #[serde(rename = "destinationIPASN")]
    pub destination_ip_asn: String,

    pub source_port: String,
    pub destination_port: String,

    #[serde(rename = "inboundIP")]
    pub inbound_ip: String,

    pub inbound_port: String,
    pub inbound_name: String,
    pub inbound_user: String,
    pub rematch_name: String,
    pub host: String,
    pub dns_mode: DNSMode,
    pub uid: u32,
    pub process: String,
    pub process_path: String,
    pub special_proxy: String,
    pub special_rules: String,
    pub remote_destination: String,
    pub dscp: u8,
    pub sniff_host: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/server.go#L48-L53
pub struct Traffic {
    pub up: u64,
    pub down: u64,
    pub up_total: u64,
    pub down_total: u64,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/server.go#L55-L58
pub struct Memory {
    pub inuse: u64,
    pub oslimit: u64,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
// https://github.com/MetaCubeX/mihomo/blob/Alpha/hub/route/server.go#L467-L470
pub struct Log {
    #[serde(rename = "type")]
    pub log_type: String,
    pub payload: String,
}

// ------------- use in rust, no need export to typescript -----------------

#[derive(Deserialize, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Deserialize, Serialize)]
pub struct CloseFrame {
    pub code: u16,
    pub reason: String,
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "type", content = "data")]
pub enum WebSocketMessage {
    Text(String),
    Binary(Vec<u8>),
    Ping(Vec<u8>),
    Pong(Vec<u8>),
    Close(Option<CloseFrame>),
}

pub type WebSocketConnectionId = u32;

pub struct ManagedWsConnection {
    pub writer: WsWriteKind,
    pub read_task: AbortHandle,
}

#[derive(Default)]
pub struct ConnectionManager(pub RwLock<HashMap<WebSocketConnectionId, ManagedWsConnection>>);

impl ConnectionManager {
    pub async fn contains(&self, id: WebSocketConnectionId) -> bool {
        self.0.read().await.contains_key(&id)
    }

    pub async fn ids(&self) -> Vec<WebSocketConnectionId> {
        self.0.read().await.keys().copied().collect()
    }

    pub async fn insert(&self, id: WebSocketConnectionId, connection: ManagedWsConnection) {
        self.0.write().await.insert(id, connection);
    }

    pub async fn remove(&self, id: WebSocketConnectionId) -> Option<ManagedWsConnection> {
        self.0.write().await.remove(&id)
    }

    pub async fn take_all(&self) -> Vec<ManagedWsConnection> {
        self.0.write().await.drain().map(|(_, connection)| connection).collect()
    }
}
