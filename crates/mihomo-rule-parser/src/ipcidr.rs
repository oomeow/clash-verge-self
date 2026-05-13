use std::{
    fmt::{Debug, Display},
    io::{Cursor, Read, Write},
    net::{IpAddr, Ipv4Addr, Ipv6Addr},
    path::Path,
};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};

use crate::{
    Codec, MRS_VERSION, RuleBehavior, RuleFormat, RulePayload,
    error::{Result, RuleParseError},
    utils,
};

/// ipcidr parse strategy
pub(crate) struct IpCidrCodecStrategy;

impl Codec for IpCidrCodecStrategy {
    fn parse(buf: &[u8], format: RuleFormat) -> Result<RulePayload> {
        match format {
            RuleFormat::Mrs => parse_from_mrs(buf),
            RuleFormat::Yaml => utils::parse_from_yaml(buf),
            RuleFormat::Text => utils::parse_from_text(buf),
        }
    }

    fn export<P: AsRef<std::path::Path>>(rules: &[String], file_path: P, format: RuleFormat) -> Result<()> {
        match format {
            RuleFormat::Mrs => export_as_mrs(rules, file_path),
            RuleFormat::Yaml => utils::export_as_yaml(rules, file_path),
            RuleFormat::Text => utils::export_as_text(rules, file_path),
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

/// 抽象 IPv4/IPv6 数值类型之间的共同 CIDR 拆分能力。
trait IpNumber: Copy + Ord {
    /// 当前地址类型的总位数：IPv4 为 32，IPv6 为 128。
    const ADDRESS_BITS: u32;

    /// 返回从 `start` 开始、且不超过 `end` 的最大 CIDR 前缀长度。
    fn prefix_len(start: Self, end: Self) -> u8;
    /// 计算指定前缀长度对应的 CIDR 块大小，即该网段覆盖多少个地址。
    fn cidr_block_size(prefix_len: u8) -> Self;
    fn checked_add(self, rhs: Self) -> Option<Self>;
}

impl IpNumber for u32 {
    const ADDRESS_BITS: u32 = 32;

    fn prefix_len(start: Self, end: Self) -> u8 {
        // 对齐约束：当前块必须从 CIDR 边界开始。
        let aligned_prefix = (Self::ADDRESS_BITS - start.trailing_zeros()) as u8;
        let remaining = end - start;
        // 范围约束：当前块不能覆盖到 end 之后。
        let bounded_prefix = if remaining == u32::MAX {
            0
        } else {
            (Self::ADDRESS_BITS - (remaining + 1).ilog2()) as u8
        };

        aligned_prefix.max(bounded_prefix)
    }

    fn cidr_block_size(prefix_len: u8) -> Self {
        1u32 << (Self::ADDRESS_BITS - u32::from(prefix_len))
    }

    fn checked_add(self, rhs: Self) -> Option<Self> {
        self.checked_add(rhs)
    }
}

impl IpNumber for u128 {
    const ADDRESS_BITS: u32 = 128;

    fn prefix_len(start: Self, end: Self) -> u8 {
        // 对齐约束：当前块必须从 CIDR 边界开始。
        let aligned_prefix = (Self::ADDRESS_BITS - start.trailing_zeros()) as u8;
        let remaining = end - start;
        // 范围约束：当前块不能覆盖到 end 之后。
        let bounded_prefix = if remaining == u128::MAX {
            0
        } else {
            (Self::ADDRESS_BITS - (remaining + 1).ilog2()) as u8
        };

        aligned_prefix.max(bounded_prefix)
    }

    fn cidr_block_size(prefix_len: u8) -> Self {
        1u128 << (Self::ADDRESS_BITS - u32::from(prefix_len))
    }

    fn checked_add(self, rhs: Self) -> Option<Self> {
        self.checked_add(rhs)
    }
}

fn range_prefixes<T>(from: T, to: T, to_ip: fn(T) -> IpAddr) -> Vec<Prefix>
where
    T: IpNumber,
{
    let (mut start, end) = if from <= to { (from, to) } else { (to, from) };
    let mut prefixes = Vec::new();

    while start <= end {
        // 每轮取“当前起点能容纳的最大 CIDR 块”，然后跳到下一个未覆盖地址。
        let prefix_len = T::prefix_len(start, end);
        prefixes.push(Prefix::new(to_ip(start), prefix_len));

        // "/0" 表示已经覆盖了整个地址空间，不需要再继续前进。
        if prefix_len == 0 {
            break;
        }

        start = match start.checked_add(T::cidr_block_size(prefix_len)) {
            Some(next) => next,
            None => break,
        };
    }

    prefixes
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
    range_prefixes(ip_to_u32(from), ip_to_u32(to), u32_to_ip)
}

/// IPv6 处理
fn ipv6_prefixes(from: Ipv6Addr, to: Ipv6Addr) -> Vec<Prefix> {
    range_prefixes(ip_to_u128(from), ip_to_u128(to), u128_to_ip)
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

// ------------------------------ Parse ------------------------------------

fn parse_from_mrs(buf: &[u8]) -> Result<RulePayload> {
    // create ZSTD decoder
    let mut reader = zstd::Decoder::new(Cursor::new(buf))?;

    // validate mrs file
    let (behavior, count) = utils::read_mrs_header(&mut reader)?;
    if behavior != RuleBehavior::IpCidr {
        return Err(RuleParseError::BehaviorMismatch {
            expected: RuleBehavior::IpCidr,
            actual: behavior,
        });
    }

    // version
    let mut version = [0u8; 1];
    reader.read_exact(&mut version)?;
    if version[0] != MRS_VERSION {
        return Err(RuleParseError::InvalidMRSVersion);
    }

    // length
    let length = reader.read_i64::<BigEndian>()?;
    if length < 1 {
        return Err(RuleParseError::InvalidMRSLength(length));
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

// ------------------------------ Export ------------------------------------

fn export_as_mrs<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    let (count, ranges) = prepare_ranges(rules)?;
    let file = std::fs::File::create(file_path)?;
    let buffered = std::io::BufWriter::new(file);
    let mut writer = zstd::Encoder::new(buffered, 0)?;
    utils::write_mrs_header(&mut writer, RuleBehavior::IpCidr, count)?;
    write_ranges(&mut writer, &ranges)?;
    writer.finish()?;
    Ok(())
}

fn prepare_ranges(rules: &[String]) -> Result<(i64, Vec<IpRange>)> {
    let mut count = 0i64;
    let mut ranges = Vec::new();

    for rule in rules {
        ranges.push(parse_cidr_rule(rule)?);
        count += 1;
    }

    if ranges.is_empty() {
        return Err(RuleParseError::EmptyRule);
    }

    Ok((count, ranges))
}

fn write_ranges<W: Write>(writer: &mut W, ranges: &[IpRange]) -> Result<()> {
    writer.write_all(&[MRS_VERSION])?;
    writer.write_i64::<BigEndian>(ranges.len() as i64)?;
    for range in ranges {
        writer.write_all(&ip_addr_to_mrs_bytes(range.from))?;
        writer.write_all(&ip_addr_to_mrs_bytes(range.to))?;
    }
    Ok(())
}

fn parse_cidr_rule(rule: &str) -> Result<IpRange> {
    let (addr, prefix_len) = rule
        .trim()
        .split_once('/')
        .ok_or_else(|| RuleParseError::InvalidRule(rule.to_string()))?;
    let prefix_len = prefix_len
        .parse::<u8>()
        .map_err(|_| RuleParseError::InvalidRule(rule.to_string()))?;
    let addr = addr
        .parse::<IpAddr>()
        .map_err(|_| RuleParseError::InvalidRule(rule.to_string()))?;

    match addr {
        IpAddr::V4(ip) => {
            if prefix_len > 32 {
                return Err(RuleParseError::InvalidRule(rule.to_string()));
            }
            let value = u32::from_be_bytes(ip.octets());
            let mask = if prefix_len == 0 {
                0
            } else {
                u32::MAX << (32 - u32::from(prefix_len))
            };
            let from = value & mask;
            let to = from | !mask;
            Ok(IpRange {
                from: IpAddr::V4(Ipv4Addr::from(from)),
                to: IpAddr::V4(Ipv4Addr::from(to)),
            })
        }
        IpAddr::V6(ip) => {
            if prefix_len > 128 {
                return Err(RuleParseError::InvalidRule(rule.to_string()));
            }
            let value = u128::from_be_bytes(ip.octets());
            let mask = if prefix_len == 0 {
                0
            } else {
                u128::MAX << (128 - u32::from(prefix_len))
            };
            let from = value & mask;
            let to = from | !mask;
            Ok(IpRange {
                from: IpAddr::V6(Ipv6Addr::from(from.to_be_bytes())),
                to: IpAddr::V6(Ipv6Addr::from(to.to_be_bytes())),
            })
        }
    }
}

fn ip_addr_to_mrs_bytes(addr: IpAddr) -> [u8; 16] {
    match addr {
        IpAddr::V4(ip) => ip.to_ipv6_mapped().octets(),
        IpAddr::V6(ip) => ip.octets(),
    }
}

// ------------------------------ Test ------------------------------------

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
        let payload = IpCidrCodecStrategy::parse(&buf, RuleFormat::Mrs)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_ipcidr_parse_from_yaml() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/ad.yaml"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = IpCidrCodecStrategy::parse(&buf, RuleFormat::Yaml)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_ipcidr_parse_from_text() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geoip/ad.list"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = IpCidrCodecStrategy::parse(&buf, RuleFormat::Text)?;
        println!("payload: {:?}", payload);
        Ok(())
    }
}
