use crate::{
    core::mihomo::MihomoClientManager,
    utils::{dirs, help},
};
use anyhow::Result;
use nanoid::nanoid;
use serde::{Deserialize, Serialize};
use serde_yaml::{Mapping, Value};
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    str::FromStr,
};

#[derive(Default, Debug, Clone)]
pub struct IClashConfig(pub Mapping);

impl IClashConfig {
    pub fn new() -> Self {
        let template = Self::default();
        match dirs::clash_path().and_then(|path| help::read_merge_mapping(&path)) {
            Ok(mut map) => {
                template.0.keys().for_each(|key| {
                    if !map.contains_key(key) {
                        map.insert(key.clone(), template.0.get(key).unwrap().clone());
                    }
                });
                Self(Self::guard(map))
            }
            Err(err) => {
                log::error!(target: "app", "{err}");
                template
            }
        }
    }

    pub fn default() -> Self {
        let mut map = Mapping::new();
        let mut tun = Mapping::new();
        tun.insert("enable".into(), false.into());
        tun.insert("stack".into(), "gvisor".into());
        #[cfg(not(target_os = "macos"))]
        tun.insert("device".into(), "Mihomo".into());
        #[cfg(target_os = "macos")]
        tun.insert("device".into(), "utun_Mihomo".into());
        tun.insert("auto-route".into(), true.into());
        tun.insert("strict-route".into(), false.into());
        tun.insert("auto-detect-interface".into(), true.into());
        tun.insert("dns-hijack".into(), vec!["any:53"].into());
        tun.insert("mtu".into(), 9000.into());
        #[cfg(not(target_os = "windows"))]
        map.insert("redir-port".into(), 0.into());
        #[cfg(target_os = "linux")]
        map.insert("tproxy-port".into(), 0.into());
        map.insert("mixed-port".into(), 7890.into());
        map.insert("socks-port".into(), 0.into());
        map.insert("port".into(), 0.into());
        map.insert("log-level".into(), "info".into());
        map.insert("allow-lan".into(), false.into());
        map.insert("mode".into(), "rule".into());
        map.insert("external-controller".into(), "127.0.0.1:9090".into());
        map.insert("secret".into(), nanoid!().into());
        map.insert("tun".into(), tun.into());
        map.insert("unified-delay".into(), true.into());

        Self(map)
    }

    fn guard(mut config: Mapping) -> Mapping {
        #[cfg(not(target_os = "windows"))]
        let redir_port = Self::guard_redir_port(&config);
        #[cfg(target_os = "linux")]
        let tproxy_port = Self::guard_tproxy_port(&config);
        let mixed_port = Self::guard_mixed_port(&config);
        let socks_port = Self::guard_socks_port(&config);
        let port = Self::guard_port(&config);
        let ctrl = Self::guard_server_ctrl(&config);
        #[cfg(not(target_os = "windows"))]
        config.insert("redir-port".into(), redir_port.into());
        #[cfg(target_os = "linux")]
        config.insert("tproxy-port".into(), tproxy_port.into());
        config.insert("mixed-port".into(), mixed_port.into());
        config.insert("socks-port".into(), socks_port.into());
        config.insert("port".into(), port.into());
        config.insert("external-controller".into(), ctrl.into());
        config
    }

    pub fn patch_config(&mut self, patch: Mapping) {
        for (key, value) in patch.into_iter() {
            self.0.insert(key, value);
        }
    }

    /// merge from src into dest
    fn merge_into(src: &Value, dest: &mut Value) {
        match (src, dest) {
            // handle mapping value
            (Value::Mapping(src), Value::Mapping(dest)) => {
                for (key, src_val) in src {
                    match dest.get_mut(key) {
                        Some(dest_val) => Self::merge_into(src_val, dest_val),
                        None => _ = dest.insert(key.clone(), src_val.clone()),
                    };
                }
            }
            (src, dest) => *dest = src.clone(),
        }
    }

    pub fn patch_and_merge_config(&mut self, patch: Mapping) {
        if patch.get("external-controller").is_some() {
            let external_controller = patch.get("external-controller").unwrap().as_str().unwrap();
            let (host, port) = external_controller.split_once(':').unwrap();
            MihomoClientManager::global().set_external_host(host);
            MihomoClientManager::global().set_external_port(port.parse().unwrap());
        }
        if patch.get("secret").is_some() {
            let secret = patch.get("secret").unwrap().as_str().unwrap();
            MihomoClientManager::global().set_secret(secret);
        }
        let mut dest = Value::from(self.0.clone());
        Self::merge_into(&Value::from(patch), &mut dest);
        self.0 = dest.as_mapping().unwrap().clone();
    }

    pub fn save_config(&self) -> Result<()> {
        help::save_yaml(
            &dirs::clash_path()?,
            &self.0,
            Some("# Generated by Clash Verge"),
        )
    }

    pub fn get_mode(&self) -> String {
        self.0
            .get("mode")
            .and_then(|value| match value {
                Value::String(val_str) => Some(val_str.clone()),
                _ => None,
            })
            .unwrap_or("rule".to_string())
    }

    pub fn get_enable_tun(&self) -> bool {
        let config = &self.0;
        let tun_val = config
            .get("tun")
            .and_then(|vale| match vale {
                Value::Mapping(val_map) => Some(val_map.clone()),
                _ => None,
            })
            .unwrap_or(Mapping::new());
        *tun_val
            .get("enable")
            .and_then(|value| match value {
                Value::Bool(val_bool) => Some(val_bool),
                _ => None,
            })
            .unwrap_or(&false)
    }

    pub fn get_mixed_port(&self) -> u16 {
        Self::guard_mixed_port(&self.0)
    }

    #[allow(unused)]
    pub fn get_socks_port(&self) -> u16 {
        Self::guard_socks_port(&self.0)
    }

    #[allow(unused)]
    pub fn get_port(&self) -> u16 {
        Self::guard_port(&self.0)
    }

    pub fn get_client_info(&self) -> ClashInfo {
        let config = &self.0;

        ClashInfo {
            mixed_port: Self::guard_mixed_port(config),
            socks_port: Self::guard_socks_port(config),
            #[cfg(not(target_os = "windows"))]
            redir_port: Self::guard_redir_port(config),
            #[cfg(target_os = "linux")]
            tproxy_port: Self::guard_tproxy_port(config),
            port: Self::guard_port(config),
            server: Self::guard_client_ctrl(config),
            secret: config.get("secret").and_then(|value| match value {
                Value::String(val_str) => Some(val_str.clone()),
                Value::Bool(val_bool) => Some(val_bool.to_string()),
                Value::Number(val_num) => Some(val_num.to_string()),
                _ => None,
            }),
        }
    }
    #[cfg(not(target_os = "windows"))]
    pub fn guard_redir_port(config: &Mapping) -> u16 {
        let port = config
            .get("redir-port")
            .and_then(|value| match value {
                Value::String(val_str) => val_str.parse().ok(),
                Value::Number(val_num) => val_num.as_u64().map(|u| u as u16),
                _ => None,
            })
            .unwrap_or(0);
        port
    }

    #[cfg(target_os = "linux")]
    pub fn guard_tproxy_port(config: &Mapping) -> u16 {
        let port = config
            .get("tproxy-port")
            .and_then(|value| match value {
                Value::String(val_str) => val_str.parse().ok(),
                Value::Number(val_num) => val_num.as_u64().map(|u| u as u16),
                _ => None,
            })
            .unwrap_or(0);
        port
    }

    pub fn guard_mixed_port(config: &Mapping) -> u16 {
        let port = config
            .get("mixed-port")
            .and_then(|value| match value {
                Value::String(val_str) => val_str.parse().ok(),
                Value::Number(val_num) => val_num.as_u64().map(|u| u as u16),
                _ => None,
            })
            .unwrap_or(7890);
        port
    }

    pub fn guard_socks_port(config: &Mapping) -> u16 {
        let port = config
            .get("socks-port")
            .and_then(|value| match value {
                Value::String(val_str) => val_str.parse().ok(),
                Value::Number(val_num) => val_num.as_u64().map(|u| u as u16),
                _ => None,
            })
            .unwrap_or(0);
        port
    }

    pub fn guard_port(config: &Mapping) -> u16 {
        let port = config
            .get("port")
            .and_then(|value| match value {
                Value::String(val_str) => val_str.parse().ok(),
                Value::Number(val_num) => val_num.as_u64().map(|u| u as u16),
                _ => None,
            })
            .unwrap_or(0);
        port
    }

    pub fn guard_server_ctrl(config: &Mapping) -> String {
        config
            .get("external-controller")
            .and_then(|value| match value.as_str() {
                Some(val_str) => {
                    let val_str = val_str.trim();

                    let val = match val_str.starts_with(':') {
                        true => format!("127.0.0.1{val_str}"),
                        false => val_str.to_owned(),
                    };

                    SocketAddr::from_str(val.as_str())
                        .ok()
                        .map(|s| s.to_string())
                }
                None => None,
            })
            .unwrap_or("127.0.0.1:9090".into())
    }

    pub fn guard_client_ctrl(config: &Mapping) -> String {
        let value = Self::guard_server_ctrl(config);
        match SocketAddr::from_str(value.as_str()) {
            Ok(mut socket) => {
                if socket.ip().is_unspecified() {
                    socket.set_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
                }
                socket.to_string()
            }
            Err(_) => "127.0.0.1:9090".into(),
        }
    }
}

#[derive(Default, Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub struct ClashInfo {
    /// clash core port
    pub mixed_port: u16,
    pub port: u16,
    pub socks_port: u16,
    #[cfg(not(target_os = "windows"))]
    pub redir_port: u16,
    #[cfg(target_os = "linux")]
    pub tproxy_port: u16,
    /// same as `external-controller`
    pub server: String,
    /// clash secret
    pub secret: Option<String>,
}

#[test]
fn test_clash_info() {
    fn get_case<T: Into<Value>, D: Into<Value>>(mp: T, ec: D) -> ClashInfo {
        let mut map = Mapping::new();
        map.insert("mixed-port".into(), mp.into());
        map.insert("external-controller".into(), ec.into());

        IClashConfig(IClashConfig::guard(map)).get_client_info()
    }

    fn get_result<S: Into<String>>(port: u16, server: S) -> ClashInfo {
        ClashInfo {
            mixed_port: port,
            socks_port: 0,
            #[cfg(not(target_os = "windows"))]
            redir_port: 0,
            #[cfg(target_os = "linux")]
            tproxy_port: 0,
            port: 0,
            server: server.into(),
            secret: None,
        }
    }

    assert_eq!(
        IClashConfig(IClashConfig::guard(Mapping::new())).get_client_info(),
        get_result(7890, "127.0.0.1:9090")
    );

    assert_eq!(get_case("", ""), get_result(7890, "127.0.0.1:9090"));

    assert_eq!(get_case(65537, ""), get_result(1, "127.0.0.1:9090"));

    assert_eq!(
        get_case(8888, "127.0.0.1:8888"),
        get_result(8888, "127.0.0.1:8888")
    );

    assert_eq!(
        get_case(8888, "   :98888 "),
        get_result(8888, "127.0.0.1:9090")
    );

    assert_eq!(
        get_case(8888, "0.0.0.0:8080  "),
        get_result(8888, "127.0.0.1:8080")
    );

    assert_eq!(
        get_case(8888, "0.0.0.0:8080"),
        get_result(8888, "127.0.0.1:8080")
    );

    assert_eq!(
        get_case(8888, "[::]:8080"),
        get_result(8888, "127.0.0.1:8080")
    );

    assert_eq!(
        get_case(8888, "192.168.1.1:8080"),
        get_result(8888, "192.168.1.1:8080")
    );

    assert_eq!(
        get_case(8888, "192.168.1.1:80800"),
        get_result(8888, "127.0.0.1:9090")
    );
}

#[derive(Default, Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub struct IClash {
    pub mixed_port: Option<u16>,
    pub allow_lan: Option<bool>,
    pub log_level: Option<String>,
    pub ipv6: Option<bool>,
    pub mode: Option<String>,
    pub external_controller: Option<String>,
    pub secret: Option<String>,
    pub dns: Option<IClashDNS>,
    pub tun: Option<IClashTUN>,
    pub interface_name: Option<String>,
}

#[derive(Default, Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub struct IClashTUN {
    pub enable: Option<bool>,
    pub stack: Option<String>,
    pub auto_route: Option<bool>,
    pub auto_detect_interface: Option<bool>,
    pub dns_hijack: Option<Vec<String>>,
}

#[derive(Default, Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub struct IClashDNS {
    pub enable: Option<bool>,
    pub listen: Option<String>,
    pub default_nameserver: Option<Vec<String>>,
    pub enhanced_mode: Option<String>,
    pub fake_ip_range: Option<String>,
    pub use_hosts: Option<bool>,
    pub fake_ip_filter: Option<Vec<String>>,
    pub nameserver: Option<Vec<String>>,
    pub fallback: Option<Vec<String>>,
    pub fallback_filter: Option<IClashFallbackFilter>,
    pub nameserver_policy: Option<Vec<String>>,
}

#[derive(Default, Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub struct IClashFallbackFilter {
    pub geoip: Option<bool>,
    pub geoip_code: Option<String>,
    pub ipcidr: Option<Vec<String>>,
    pub domain: Option<Vec<String>>,
}
