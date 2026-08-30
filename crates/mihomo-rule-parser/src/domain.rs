use std::{
    collections::VecDeque,
    io::{Cursor, Read, Write},
    path::Path,
};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};

use crate::{
    Codec, MRS_VERSION, RuleBehavior, RuleFormat, RulePayload, bitmap,
    error::{Result, RuleParseError},
    utils,
};

/// 真实域名的标签数受 DNS 限制（最多 127），该上限用于防御恶意构造的超深 trie 导致栈溢出。
const MAX_TRIE_DEPTH: usize = 1024;

/// domain parse strategy
pub(crate) struct DomainCodecStrategy;

impl Codec for DomainCodecStrategy {
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

#[derive(Debug, Default)]
struct DomainSet {
    leaves: Vec<u64>,
    label_bit_map: Vec<u64>,
    labels: Vec<u8>,
    ranks: Vec<i32>,
    selects: Vec<i32>,
}

impl DomainSet {
    fn new() -> Self {
        DomainSet::default()
    }

    fn init(&mut self) {
        let (selects, ranks) = bitmap::Bitmap::index_select_32_r64(&self.label_bit_map);
        self.selects = selects;
        self.ranks = ranks;
    }

    fn keys<F>(&self, mut f: F)
    where
        F: FnMut(&Vec<u8>) -> bool,
    {
        let mut current_key: Vec<u8> = vec![];
        self.traverse(&mut current_key, 0, 0, 0, &mut f);
    }

    fn traverse<F>(&self, current_key: &mut Vec<u8>, node_id: isize, bm_idx: isize, depth: usize, f: &mut F) -> bool
    where
        F: FnMut(&Vec<u8>) -> bool,
    {
        // 防御：真实域名的标签数远小于该上限，超限即停止递归以避免栈溢出
        if depth > MAX_TRIE_DEPTH {
            return false;
        }

        if get_bit(&self.leaves, node_id) != 0 && !f(current_key) {
            return false;
        }

        let mut bm_idx = bm_idx;
        let bitmap_bits = (self.label_bit_map.len() * 64) as isize;

        loop {
            if bm_idx < 0 || bm_idx >= bitmap_bits {
                return true;
            }
            if get_bit(&self.label_bit_map, bm_idx) != 0 {
                return true;
            }

            // 防御：结构不一致的输入可能使 label 下标越界，越界即安全终止
            let index = (bm_idx - node_id) as usize;
            if index >= self.labels.len() {
                return false;
            }
            let next_label = self.labels[index];
            current_key.push(next_label);
            let next_node_id = count_zeros(&self.label_bit_map, &self.ranks, bm_idx + 1);
            let next_bm_idx = select_ith_one(&self.label_bit_map, &self.ranks, &self.selects, next_node_id - 1) + 1;

            if !self.traverse(current_key, next_node_id, next_bm_idx, depth + 1, f) {
                return false;
            }
            current_key.pop();
            bm_idx += 1;
        }
    }

    fn foreach<F: FnMut(String) -> bool>(&mut self, mut f: F) {
        self.keys(|key| {
            // key 是标签逆序的字节序列，反转还原原始域名
            let original = key.iter().rev().copied().collect::<Vec<u8>>();
            let original = String::from_utf8_lossy(&original).into_owned();
            f(original)
        });
    }
}

fn get_bit(bm: &[u64], i: isize) -> u64 {
    if i < 0 {
        return 0;
    }
    let idx = (i >> 6) as usize;
    if idx >= bm.len() {
        return 0;
    }
    bm[idx] & (1 << (i & 63))
}

fn count_zeros(bm: &[u64], ranks: &[i32], i: isize) -> isize {
    // 钳制到合法位域，防御性地避免 rank_64 越界
    let max_i = (bm.len() * 64) as isize;
    let i = i.clamp(0, max_i.saturating_sub(1));
    let (a, _) = bitmap::Bitmap::rank_64(bm, ranks, i as i32);
    i - a as isize
}

fn select_ith_one(bm: &[u64], ranks: &[i32], selects: &[i32], i: isize) -> isize {
    // 钳制到最后一个 1 位，防御性地避免 select 索引越界
    if i < 0 || selects.is_empty() {
        return -1;
    }
    let total_ones = ranks[bm.len()] as isize;
    let i = i.min(total_ones - 1);
    let (a, _) = bitmap::Bitmap::select_32_r64(bm, selects, ranks, i as i32);
    a as isize
}

fn set_bit_u(bitmap: &mut Vec<u64>, index: usize, value: u64) {
    while (index >> 6) >= bitmap.len() {
        bitmap.push(0);
    }

    bitmap[index >> 6] |= value << (index & 63);
}

// ------------------------------ Parse ------------------------------------

fn parse_from_mrs(buf: &[u8]) -> Result<RulePayload> {
    // 有界解压，之后再从解压后的切片解析，所有长度字段均可精确校验
    let decompressed = utils::read_mrs_payload(buf)?;
    let mut reader = Cursor::new(decompressed.as_slice());

    // validate mrs file
    let (behavior, count) = utils::read_mrs_header(&mut reader)?;
    if behavior != RuleBehavior::Domain {
        return Err(RuleParseError::BehaviorMismatch {
            expected: RuleBehavior::Domain,
            actual: behavior,
        });
    }

    let mut domain_set = DomainSet::new();

    // version
    let mut version = [0u8; 1];
    reader.read_exact(&mut version)?;
    if version[0] != MRS_VERSION {
        return Err(RuleParseError::InvalidMRSVersion);
    }

    // 先读齐三个数组，再统一校验，避免越界索引和超量预分配
    domain_set.leaves = read_u64_words(&mut reader)?;
    domain_set.label_bit_map = read_u64_words(&mut reader)?;
    domain_set.labels = read_label_bytes(&mut reader)?;
    validate_domain_set(&domain_set)?;
    domain_set.init();

    // get rules
    let mut rules: Vec<String> = vec![];
    let mut keys = Vec::new();
    domain_set.foreach(|key| {
        keys.push(key);
        true
    });
    keys.sort();
    keys.dedup();

    for key in &keys {
        let search_str = format!("+.{key}");
        if keys.binary_search(&search_str).is_ok() {
            continue;
        }
        rules.push(key.clone());
    }

    Ok(RulePayload { count, rules })
}

/// 读取一段 u64 数组；长度必须为正，且不得超过剩余解压数据能容纳的量。
fn read_u64_words(reader: &mut Cursor<&[u8]>) -> Result<Vec<u64>> {
    let length = reader.read_i64::<BigEndian>()?;
    if length < 1 {
        return Err(RuleParseError::InvalidMRSLength(length));
    }
    let count = length as usize;
    if count > remaining(reader) / 8 {
        return Err(RuleParseError::InvalidMRSLength(length));
    }
    let mut words = vec![0u64; count];
    for word in &mut words {
        *word = reader.read_u64::<BigEndian>()?;
    }
    Ok(words)
}

/// 读取 label 字节数组；长度必须为正，且不得超过剩余解压数据。
fn read_label_bytes(reader: &mut Cursor<&[u8]>) -> Result<Vec<u8>> {
    let length = reader.read_i64::<BigEndian>()?;
    if length < 1 {
        return Err(RuleParseError::InvalidMRSLength(length));
    }
    let count = length as usize;
    if count > remaining(reader) {
        return Err(RuleParseError::InvalidMRSLength(length));
    }
    let mut bytes = vec![0u8; count];
    reader.read_exact(&mut bytes)?;
    Ok(bytes)
}

fn remaining(reader: &Cursor<&[u8]>) -> usize {
    reader.get_ref().len().saturating_sub(reader.position() as usize)
}

/// 校验 DomainSet 内部一致性，保证后续 `get_bit`/`labels[index]`/select/rank 索引不会越界：
/// - `label_bit_map` 至少含一个 1 位（否则 select 索引为空）；
/// - `leaves` 的位数足以覆盖每个节点（mihomo 将位图按 64 位对齐补齐）；
/// - 每个 label 对应 trie 的一条边，因此 `labels.len() + 1 == node_count`。
fn validate_domain_set(set: &DomainSet) -> Result<()> {
    let node_count: usize = set.label_bit_map.iter().map(|word| word.count_ones() as usize).sum();
    if node_count == 0 {
        return Err(RuleParseError::InvalidDomainSet);
    }
    if node_count > set.leaves.len().saturating_mul(64) {
        return Err(RuleParseError::InvalidDomainSet);
    }
    if set.labels.len().saturating_add(1) != node_count {
        return Err(RuleParseError::InvalidDomainSet);
    }
    Ok(())
}

// ------------------------------ Export ------------------------------------

#[derive(Clone, Copy)]
struct QueueItem {
    start: usize,
    end: usize,
    col: usize,
}

fn export_as_mrs<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    let (count, domain_set) = prepare_domain_set(rules)?;
    let file = std::fs::File::create(file_path)?;
    let buffered = std::io::BufWriter::new(file);
    let mut writer = zstd::Encoder::new(buffered, 0)?;
    utils::write_mrs_header(&mut writer, RuleBehavior::Domain, count)?;
    write_domain_set(&mut writer, &domain_set)?;
    writer.finish()?;
    Ok(())
}

fn prepare_domain_set(rules: &[String]) -> Result<(i64, DomainSet)> {
    let mut keys = Vec::new();

    for rule in rules {
        let expanded = expand_rule(rule)?;
        keys.extend(expanded.into_iter().map(|domain| reverse_string(&domain)));
    }

    keys.sort();
    keys.dedup();

    if keys.is_empty() {
        return Err(RuleParseError::EmptyRule);
    }

    let mut search_key = Vec::new();
    let count = keys
        .iter()
        .filter(|key| {
            if key.ends_with(&b".+"[..]) {
                return true;
            }

            search_key.clear();
            search_key.extend_from_slice(key);
            search_key.extend_from_slice(b".+");

            keys.binary_search(&search_key).is_err()
        })
        .count() as i64;

    let domain_set = build_domain_set(&keys);
    Ok((count, domain_set))
}

fn expand_rule(rule: &str) -> Result<Vec<String>> {
    if rule.ends_with('.') || rule.trim() != rule || rule.is_empty() || rule.contains('/') {
        return Err(RuleParseError::InvalidRule(rule.to_string()));
    }

    let normalized = rule.to_lowercase();
    let parts: Vec<&str> = normalized.split('.').collect();

    if parts.iter().any(|part| part.is_empty()) {
        return Err(RuleParseError::InvalidRule(rule.to_string()));
    }

    if parts[0] == "+" {
        if parts.len() < 2 {
            return Err(RuleParseError::InvalidRule(rule.to_string()));
        }

        let plain = parts[1..].join(".");
        let wildcard = format!("+.{}", plain);
        return Ok(vec![plain, wildcard]);
    }

    Ok(vec![normalized])
}

fn reverse_string(value: &str) -> Vec<u8> {
    value.bytes().rev().collect()
}

fn build_domain_set(keys: &[Vec<u8>]) -> DomainSet {
    let mut domain_set = DomainSet::new();
    let mut label_index = 0usize;
    let mut queue = VecDeque::from([QueueItem {
        start: 0,
        end: keys.len(),
        col: 0,
    }]);
    let mut node_index = 0usize;

    while let Some(mut item) = queue.pop_front() {
        if item.col == keys[item.start].len() {
            item.start += 1;
            set_bit_u(&mut domain_set.leaves, node_index, 1);
        }

        let mut cursor = item.start;
        while cursor < item.end {
            let from = cursor;
            let label = keys[from][item.col];
            while cursor < item.end && keys[cursor][item.col] == label {
                cursor += 1;
            }

            queue.push_back(QueueItem {
                start: from,
                end: cursor,
                col: item.col + 1,
            });
            domain_set.labels.push(label);
            set_bit_u(&mut domain_set.label_bit_map, label_index, 0);
            label_index += 1;
        }

        set_bit_u(&mut domain_set.label_bit_map, label_index, 1);
        label_index += 1;
        node_index += 1;
    }

    domain_set.init();
    domain_set
}

fn write_domain_set<W: Write>(writer: &mut W, domain_set: &DomainSet) -> Result<()> {
    writer.write_all(&[MRS_VERSION])?;
    writer.write_i64::<BigEndian>(domain_set.leaves.len() as i64)?;
    for value in &domain_set.leaves {
        writer.write_u64::<BigEndian>(*value)?;
    }

    writer.write_i64::<BigEndian>(domain_set.label_bit_map.len() as i64)?;
    for value in &domain_set.label_bit_map {
        writer.write_u64::<BigEndian>(*value)?;
    }

    writer.write_i64::<BigEndian>(domain_set.labels.len() as i64)?;
    writer.write_all(&domain_set.labels)?;
    Ok(())
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
    fn test_domain_parse_from_mrs() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geosite/aliyun.mrs"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = DomainCodecStrategy::parse(&buf, RuleFormat::Mrs)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_domain_parse_from_yaml() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geosite/aliyun.yaml"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = DomainCodecStrategy::parse(&buf, RuleFormat::Yaml)?;
        println!("payload: {:?}", payload);
        Ok(())
    }

    #[test]
    fn test_domain_parse_from_text() -> Result<()> {
        let rules_dir = init_meta_rules()?;
        let mut file = std::fs::File::open(rules_dir.join("geo/geosite/aliyun.list"))?;
        let mut buf = Vec::new();
        file.read_to_end(&mut buf)?;
        let payload = DomainCodecStrategy::parse(&buf, RuleFormat::Text)?;
        println!("payload: {:?}", payload);
        Ok(())
    }
}
