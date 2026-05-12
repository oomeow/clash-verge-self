use std::{
    fmt::{Debug, Display},
    io::{Cursor, Read},
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
};

use byteorder::{BigEndian, ReadBytesExt};

use crate::{
    Parser, RuleBehavior, RuleFormat, RulePayload,
    error::{Result, RuleParseError},
    utils,
};

/// ipcidr parse strategy
pub(crate) struct IpCidrParseStrategy;

impl Parser for IpCidrParseStrategy {
    fn parse(buf: &[u8], format: RuleFormat) -> Result<RulePayload> {
        match format {
            RuleFormat::Mrs => parse_from_mrs(buf),
            RuleFormat::Yaml => utils::parse_from_yaml(buf),
            RuleFormat::Text => utils::parse_from_text(buf),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct IpRange {
    from: IpAddr,
    to: IpAddr,
}

impl IpRange {
    pub fn prefixes(&self) -> Vec<Prefix> {
        match (self.from, self.to) {
            (IpAddr::V4(from), IpAddr::V4(to)) => ipv4_prefixes(from, to),
            (IpAddr::V6(from), IpAddr::V6(to)) => ipv6_prefixes(from, to),
            _ => panic!("IP version mismatch between from and to addresses"),
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub struct Prefix {
    addr: IpAddr,
    prefix_len: u8,
}

impl Prefix {
    fn new(addr: IpAddr, prefix_len: u8) -> Self {
        Self { addr, prefix_len }
    }
}

impl Display for Prefix {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}/{}", self.addr, self.prefix_len)
    }
}

fn range_prefix_len_v4(start: u32, end: u32) -> u8 {
    let aligned_prefix = 32 - start.trailing_zeros() as u8;
    let remaining = end - start;
    let bounded_prefix = if remaining == u32::MAX {
        0
    } else {
        32 - (remaining + 1).ilog2() as u8
    };

    aligned_prefix.max(bounded_prefix)
}

fn range_prefix_len_v6(start: u128, end: u128) -> u8 {
    let aligned_prefix = 128 - start.trailing_zeros() as u8;
    let remaining = end - start;
    let bounded_prefix = if remaining == u128::MAX {
        0
    } else {
        128 - (remaining + 1).ilog2() as u8
    };

    aligned_prefix.max(bounded_prefix)
}

/// 将 IPv4 地址转换为 32 位无符号整数
fn ip_to_u32(ip: Ipv4Addr) -> u32 {
    u32::from_be_bytes(ip.octets())
}

/// 将 32 无符号整数转换为 IPv4 地址
fn u32_to_ip(num: u32) -> IpAddr {
    IpAddr::V4(Ipv4Addr::from(num.to_be_bytes()))
}

/// 将 IPv6 地址转换为 128 位无符号整数
fn ip_to_u128(ip: Ipv6Addr) -> u128 {
    u128::from_be_bytes(ip.octets())
}

/// 将 128 位无符号整数转换为 IPv6 地址
fn u128_to_ip(num: u128) -> IpAddr {
    IpAddr::V6(Ipv6Addr::from(num.to_be_bytes()))
}

/// IPv4 处理
fn ipv4_prefixes(from: Ipv4Addr, to: Ipv4Addr) -> Vec<Prefix> {
    let (mut start, end) = {
        let from = ip_to_u32(from);
        let to = ip_to_u32(to);
        if from <= to { (from, to) } else { (to, from) }
    };

    let mut prefixes = Vec::new();

    while start <= end {
        let prefix_len = range_prefix_len_v4(start, end);
        prefixes.push(Prefix::new(u32_to_ip(start), prefix_len));

        if prefix_len == 0 {
            break;
        }

        let block_size = 1u32 << (32 - prefix_len);
        start = match start.checked_add(block_size) {
            Some(next) => next,
            None => break,
        };
    }

    prefixes
}

/// IPv6 处理（128位实现）
fn ipv6_prefixes(from: Ipv6Addr, to: Ipv6Addr) -> Vec<Prefix> {
    let (mut start, end) = {
        let from = ip_to_u128(from);
        let to = ip_to_u128(to);
        if from <= to { (from, to) } else { (to, from) }
    };

    let mut prefixes = Vec::new();

    while start <= end {
        let prefix_len = range_prefix_len_v6(start, end);
        prefixes.push(Prefix::new(u128_to_ip(start), prefix_len));

        if prefix_len == 0 {
            break;
        }

        let block_size = 1u128 << (128 - prefix_len);
        start = match start.checked_add(block_size) {
            Some(next) => next,
            None => break,
        };
    }

    prefixes
}

trait IpCidrTransform {
    fn addr_from_16(a16: [u8; 16]) -> IpAddr;
    fn unmap(&self) -> IpAddr;
    fn ip_range(from: IpAddr, to: IpAddr) -> IpRange;
}

impl IpCidrTransform for IpAddr {
    /// 将 16 字节数组转换为 IPv6 地址
    fn addr_from_16(a16: [u8; 16]) -> IpAddr {
        IpAddr::V6(Ipv6Addr::from(a16))
    }

    /// 解映射 IPv4 映射的 IPv6 地址
    fn unmap(&self) -> IpAddr {
        if let IpAddr::V6(v6) = self {
            v6.to_ipv4_mapped().map(IpAddr::V4).unwrap_or(IpAddr::V6(*v6))
        } else {
            *self
        }
    }

    /// 创建一个 IP 地址范围
    fn ip_range(from: IpAddr, to: IpAddr) -> IpRange {
        IpRange { from, to }
    }
}

fn parse_from_mrs(buf: &[u8]) -> Result<RulePayload> {
    // create ZSTD decoder
    let mut reader = zstd::Decoder::new(Cursor::new(buf))?;

    // validate mrs file
    let count = utils::validate_mrs(&mut reader, RuleBehavior::IpCidr)?;

    // version
    let mut version = [0u8; 1];
    reader.read_exact(&mut version)?;
    if version[0] != 1 {
        return Err(RuleParseError::InvalidVersion);
    }

    // length
    let length = reader.read_i64::<BigEndian>()?;
    if length < 1 {
        return Err(RuleParseError::InvalidLength(length));
    }

    let mut rules: Vec<String> = Vec::new();
    for _ in 0..length {
        let mut from = [0u8; 16];
        reader.read_exact(&mut from)?;
        let from_addr = IpAddr::addr_from_16(from).unmap();

        let mut to = [0u8; 16];
        reader.read_exact(&mut to)?;
        let to_addr = IpAddr::addr_from_16(to).unmap();

        // generate Ip range
        let range = IpAddr::ip_range(from_addr, to_addr);
        rules.extend(range.prefixes().into_iter().map(|prefix| prefix.to_string()));
    }
    drop(reader);

    Ok(RulePayload { count, rules })
}

#[cfg(test)]
#[allow(deprecated)]
mod tests {

    use std::{path::PathBuf, process::Command};

    use super::*;
    use crate::error::Result;

    fn init_meta_rules() -> Result<PathBuf> {
        let tmp_dir = std::env::temp_dir();
        let rules_dir = tmp_dir.join("meta-rules-dat");
        let exists = std::fs::exists(&rules_dir)?;
        if exists {
            let commands: Vec<Vec<&str>> = vec![vec!["restore", "."], vec!["clean", "-fd"], vec!["pull"]];
            commands.iter().for_each(|args| {
                Command::new("git")
                    .args(args)
                    .current_dir(&rules_dir)
                    .spawn()
                    .expect("failed to spawn command")
                    .wait()
                    .expect("command not running");
            });
        } else {
            Command::new("git")
                .args(["clone", "-b", "meta", "https://github.com/MetaCubeX/meta-rules-dat.git"])
                .current_dir(&tmp_dir)
                .spawn()
                .expect("failed to clone rules")
                .wait()
                .expect("command not running");
        }
        Ok(rules_dir)
    }

    #[test]
    fn test_ip_range_prefix() -> Result<()> {
        let from_addr = IpAddr::V4(Ipv4Addr::new(192, 168, 3, 0));
        let to_addr = IpAddr::V4(Ipv4Addr::new(192, 168, 3, 96));
        let range = IpAddr::ip_range(from_addr, to_addr);
        let prefixes = range.prefixes();
        for prefix in prefixes {
            println!("{:?}", prefix);
        }
        Ok(())
    }

    #[test]
    fn test_ipcidr_parse_from_mrs() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/ad.mrs"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = IpCidrParseStrategy::parse(&buf, RuleFormat::Mrs)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_ipcidr_parse_from_yaml() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/ad.yaml"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = IpCidrParseStrategy::parse(&buf, RuleFormat::Yaml)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_ipcidr_parse_from_text() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/ad.list"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = IpCidrParseStrategy::parse(&buf, RuleFormat::Text)?;
        println!("payload: {:?}", payload);
        Ok(())
    }
}
