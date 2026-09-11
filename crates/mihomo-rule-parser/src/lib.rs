use std::{fmt::Display, path::Path};

use classical::ClassicalCodecStrategy;
use domain::DomainCodecStrategy;
pub use error::RuleParseError;
use ipcidr::IpCidrCodecStrategy;
use serde::{Deserialize, Serialize};

use crate::error::Result;

mod bitmap;
mod classical;
mod domain;
mod error;
mod ipcidr;
#[cfg(test)]
mod test_utils;
mod utils;

/// MRSv1
pub(crate) const MRS_MAGIC: [u8; 4] = [b'M', b'R', b'S', 1];
/// MRS version
pub(crate) const MRS_VERSION: u8 = 1;

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq, Clone, Copy)]
pub enum RuleBehavior {
    Domain,
    #[serde(rename = "IPCIDR")]
    IpCidr,
    Classical,
}

impl Display for RuleBehavior {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RuleBehavior::Domain => write!(f, "Domain"),
            RuleBehavior::IpCidr => write!(f, "IPCIDR"),
            RuleBehavior::Classical => write!(f, "Classical"),
        }
    }
}

impl TryFrom<String> for RuleBehavior {
    type Error = RuleParseError;

    fn try_from(behavior: String) -> Result<Self> {
        match behavior.as_str() {
            "domain" | "Domain" => Ok(RuleBehavior::Domain),
            "ipcidr" | "IPCIDR" => Ok(RuleBehavior::IpCidr),
            "classical" | "Classical" => Ok(RuleBehavior::Classical),
            _ => Err(RuleParseError::InvalidBehavior(behavior)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RuleFormat {
    #[serde(rename = "YamlRule")]
    Yaml,
    #[serde(rename = "TextRule")]
    Text,
    #[serde(rename = "MrsRule")]
    Mrs,
}

impl Display for RuleFormat {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RuleFormat::Yaml => write!(f, "YamlRule"),
            RuleFormat::Text => write!(f, "TextRule"),
            RuleFormat::Mrs => write!(f, "MrsRule"),
        }
    }
}

impl TryFrom<String> for RuleFormat {
    type Error = RuleParseError;

    fn try_from(format: String) -> Result<Self> {
        match format.as_str() {
            "yaml" | "yml" => Ok(RuleFormat::Yaml),
            "text" | "txt" => Ok(RuleFormat::Text),
            "mrs" => Ok(RuleFormat::Mrs),
            _ => Err(RuleParseError::InvalidFormat(format)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RulePayload {
    /// 规则计数，语义随来源不同而不同：
    /// - 解析侧：MRS 头部声明的 count（原始插入次数，与 `rules.len()` 可能不同）；
    /// - 文本/YAML：有效行数（跳过空行与注释）；
    /// - 导出侧：domain 为去重后未被通配符覆盖的规则数，ipcidr 为源规则条数。
    pub count: i64,
    pub rules: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct YamlPayload {
    payload: Vec<String>,
}

impl From<YamlPayload> for RulePayload {
    fn from(payload: YamlPayload) -> Self {
        RulePayload {
            count: payload.payload.len() as i64,
            rules: payload.payload,
        }
    }
}

/// A trait for encoding and decoding rule payloads.
trait Codec {
    fn parse(buf: &[u8], format: RuleFormat) -> Result<RulePayload>;

    fn export<P: AsRef<Path>>(rules: &[String], file_path: P, format: RuleFormat) -> Result<()>;
}

pub fn parse<P: AsRef<Path>>(file_path: P, behavior: RuleBehavior, format: RuleFormat) -> Result<RulePayload> {
    let buf = std::fs::read(file_path)?;
    match behavior {
        RuleBehavior::Domain => DomainCodecStrategy::parse(&buf, format),
        RuleBehavior::IpCidr => IpCidrCodecStrategy::parse(&buf, format),
        RuleBehavior::Classical => ClassicalCodecStrategy::parse(&buf, format),
    }
}

pub fn export<P: AsRef<Path>>(
    rules: &[String],
    file_path: P,
    behavior: RuleBehavior,
    format: RuleFormat,
) -> Result<()> {
    if rules.is_empty() {
        return Err(RuleParseError::EmptyRule);
    }
    match behavior {
        RuleBehavior::Domain => DomainCodecStrategy::export(rules, file_path, format),
        RuleBehavior::IpCidr => IpCidrCodecStrategy::export(rules, file_path, format),
        RuleBehavior::Classical => ClassicalCodecStrategy::export(rules, file_path, format),
    }
}
