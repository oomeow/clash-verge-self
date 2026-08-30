//! 回归测试：不可信 / 畸形 MRS 输入必须返回错误而非 panic/OOM，并覆盖 extra
//! 数据、Unicode 域名与文本解析的修复。

use std::{
    error::Error,
    io::Cursor,
    sync::atomic::{AtomicU64, Ordering},
};

use byteorder::{BigEndian, WriteBytesExt};
use mihomo_rule_parser::{RuleBehavior, RuleFormat, RuleParseError, export, parse};

static COUNTER: AtomicU64 = AtomicU64::new(0);

fn temp_file(suffix: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join("mihomo-rule-parser-malformed-tests");
    std::fs::create_dir_all(&dir).unwrap();
    dir.join(format!(
        "{}-{}-{}",
        std::process::id(),
        COUNTER.fetch_add(1, Ordering::Relaxed),
        suffix
    ))
}

fn parse_bytes(buf: &[u8], behavior: RuleBehavior, format: RuleFormat) -> Result<(), RuleParseError> {
    let path = temp_file("mrs");
    std::fs::write(&path, buf).unwrap();
    let result = parse(&path, behavior, format).map(|_| ());
    let _ = std::fs::remove_file(&path);
    result
}

fn mrs_header(behavior: u8, count: i64, extra: &[u8]) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&[b'M', b'R', b'S', 1]);
    out.push(behavior);
    out.write_i64::<BigEndian>(count).unwrap();
    out.write_i64::<BigEndian>(extra.len() as i64).unwrap();
    out.extend_from_slice(extra);
    out
}

fn domain_mrs(
    version: u8,
    leaves_len: i64,
    leaves: &[u64],
    lbm_len: i64,
    lbm: &[u64],
    labels_len: i64,
    labels: &[u8],
) -> Vec<u8> {
    let mut out = mrs_header(0, 1, &[]);
    out.push(version);
    out.write_i64::<BigEndian>(leaves_len).unwrap();
    for w in leaves {
        out.write_u64::<BigEndian>(*w).unwrap();
    }
    out.write_i64::<BigEndian>(lbm_len).unwrap();
    for w in lbm {
        out.write_u64::<BigEndian>(*w).unwrap();
    }
    out.write_i64::<BigEndian>(labels_len).unwrap();
    out.extend_from_slice(labels);
    out
}

fn compress(buf: &[u8]) -> Vec<u8> {
    zstd::stream::encode_all(Cursor::new(buf), 3).unwrap()
}

// 单个域名 "a" 的合法 body（version + 三段长度前缀数据），可复用于不同 header 的用例：
// leaves=bit1，label_bit_map=bits[0:0, 1:1, 2:1]，labels=[a]
fn valid_domain_body() -> Vec<u8> {
    let mut out = Vec::new();
    out.push(1); // version
    out.write_i64::<BigEndian>(1).unwrap();
    out.write_u64::<BigEndian>(2).unwrap(); // leaves
    out.write_i64::<BigEndian>(1).unwrap();
    out.write_u64::<BigEndian>(6).unwrap(); // label_bit_map
    out.write_i64::<BigEndian>(1).unwrap();
    out.push(b'a'); // labels
    out
}

fn domain_mrs_with_header(count: i64, extra: &[u8], body: &[u8]) -> Vec<u8> {
    let mut out = mrs_header(0, count, extra);
    out.extend_from_slice(body);
    out
}

fn valid_domain_raw() -> Vec<u8> {
    domain_mrs_with_header(1, &[], &valid_domain_body())
}

#[test]
fn test_valid_domain_parses() -> Result<(), Box<dyn Error>> {
    let raw = valid_domain_raw();
    let path = temp_file("mrs");
    std::fs::write(&path, compress(&raw))?;
    let payload = parse(&path, RuleBehavior::Domain, RuleFormat::Mrs)?;
    let _ = std::fs::remove_file(&path);
    assert_eq!(payload.rules, vec!["a"]);
    Ok(())
}

#[test]
fn test_domain_zero_leaves_length_rejected() {
    // leaves 长度为 0（29 字节级 PoC）：必须返回错误而非越界 panic
    let raw = domain_mrs(1, 0, &[], 1, &[2], 1, b"a");
    assert!(parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs).is_err());
}

#[test]
fn test_domain_all_zero_bitmap_rejected() {
    // label_bit_map 全 0、无任何 1 位：select 索引会为空，必须报错而非越界 panic
    let raw = domain_mrs(1, 1, &[2], 1, &[0], 1, b"a");
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidDomainSet)));
}

#[test]
fn test_domain_huge_leaves_length_rejected() {
    // 声明 2^61 长度的 leaves 但没有对应数据：必须返回错误而非 capacity overflow / OOM
    let raw = domain_mrs(1, 1 << 61, &[], 1, &[2], 1, b"a");
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSLength(_))));
}

#[test]
fn test_domain_huge_labels_length_rejected() {
    let raw = domain_mrs(1, 1, &[2], 1, &[6], 1 << 50, &[]);
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSLength(_))));
}

#[test]
fn test_domain_labels_not_tree_rejected() {
    // labels 数量不满足 edges = nodes - 1：结构不一致，必须报错
    let raw = domain_mrs(1, 1, &[2], 1, &[6], 2, b"ab");
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidDomainSet)));
}

#[test]
fn test_domain_truncated_data_rejected() {
    // labels 声明了 5 字节但只有 2 字节数据：读取失败返回错误，不得 panic
    let raw = domain_mrs(1, 1, &[2], 1, &[6], 5, b"ab");
    assert!(parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs).is_err());
}

#[test]
fn test_domain_bad_magic_rejected() {
    let mut raw = valid_domain_raw();
    raw[0] = b'X';
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSMagic)));
}

#[test]
fn test_domain_bad_version_rejected() {
    let raw = domain_mrs(99, 1, &[2], 1, &[6], 1, b"a");
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSVersion)));
}

#[test]
fn test_domain_behavior_mismatch_rejected() {
    let raw = domain_mrs(1, 1, &[2], 1, &[6], 1, b"a");
    let result = parse_bytes(&compress(&raw), RuleBehavior::IpCidr, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::BehaviorMismatch { .. })));
}

#[test]
fn test_domain_extra_data_parsed_correctly() {
    // extra_length > 0 时不得造成流错位，应正确跳过并解析出规则
    let extra = [0xAA, 0xBB, 0xCC, 0xDD];
    let raw = domain_mrs_with_header(1, &extra, &valid_domain_body());
    let path = temp_file("mrs");
    std::fs::write(&path, compress(&raw)).unwrap();
    let payload = parse(&path, RuleBehavior::Domain, RuleFormat::Mrs).unwrap();
    let _ = std::fs::remove_file(&path);
    assert_eq!(payload.rules, vec!["a"]);
}

#[test]
fn test_domain_negative_count_rejected() {
    let raw = domain_mrs_with_header(-1, &[], &valid_domain_body());
    let result = parse_bytes(&compress(&raw), RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSLength(-1))));
}

#[test]
fn test_ipcidr_zero_length_rejected() {
    let mut out = mrs_header(1, 1, &[]);
    out.push(1); // version
    out.write_i64::<BigEndian>(0).unwrap();
    let result = parse_bytes(&compress(&out), RuleBehavior::IpCidr, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSLength(0))));
}

#[test]
fn test_ipcidr_truncated_ranges_rejected() {
    let mut out = mrs_header(1, 1, &[]);
    out.push(1); // version
    out.write_i64::<BigEndian>(5).unwrap(); // 声明 5 个 range
    // 只提供 2 个 range 的数据
    for _ in 0..2 {
        out.extend_from_slice(&[0u8; 16]); // from
        out.extend_from_slice(&[0u8; 16]); // to
    }
    let result = parse_bytes(&compress(&out), RuleBehavior::IpCidr, RuleFormat::Mrs);
    assert!(matches!(result, Err(RuleParseError::InvalidMRSLength(5))));
}

#[test]
fn test_decompression_bomb_rejected() {
    // 4 MiB 的零字节：压缩后很小，但解压预算（~1 MiB 下限）应触发拒绝
    let zeros = vec![0u8; 4 << 20];
    let compressed = compress(&zeros);
    assert!(
        compressed.len() < (4 << 20) / 256,
        "compressed size {} unexpectedly large",
        compressed.len()
    );
    let result = parse_bytes(&compressed, RuleBehavior::Domain, RuleFormat::Mrs);
    assert!(result.is_err(), "decompression bomb must be rejected");
}

#[test]
fn test_unicode_domain_roundtrip() -> Result<(), Box<dyn Error>> {
    let mut rules = vec![
        "example.com".to_string(),
        "éxample.com".to_string(),
        "普通域名.example.com".to_string(),
    ];
    rules.sort();
    let path = temp_file("mrs");
    export(&rules, &path, RuleBehavior::Domain, RuleFormat::Mrs)?;
    let payload = parse(&path, RuleBehavior::Domain, RuleFormat::Mrs)?;
    let _ = std::fs::remove_file(&path);
    assert_eq!(payload.rules, rules);
    Ok(())
}

#[test]
fn test_text_parse_skips_comments_and_blank() -> Result<(), Box<dyn Error>> {
    let content = b"example.com\n\n  \r\n# comment\n// another\n+.test.com\n";
    let path = temp_file("list");
    std::fs::write(&path, content)?;
    let payload = parse(&path, RuleBehavior::Domain, RuleFormat::Text)?;
    let _ = std::fs::remove_file(&path);
    assert_eq!(payload.rules, vec!["example.com", "+.test.com"]);
    assert_eq!(payload.count, 2);
    Ok(())
}
