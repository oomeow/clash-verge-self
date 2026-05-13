use std::{
    collections::VecDeque,
    io::{Cursor, Read, Write},
    path::Path,
};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};

use crate::{
    Codec, RuleBehavior, RuleFormat, RulePayload, bitmap,
    error::{Result, RuleParseError},
    utils,
};

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
        F: FnMut(&String) -> bool,
    {
        let mut current_key: Vec<char> = vec![];
        self.traverse(&mut current_key, 0, 0, &mut f);
    }

    fn traverse<F>(&self, current_key: &mut Vec<char>, node_id: isize, bm_idx: isize, f: &mut F) -> bool
    where
        F: FnMut(&String) -> bool,
    {
        if get_bit(&self.leaves, node_id) != 0 && !f(&current_key.iter().collect::<String>()) {
            return false;
        }

        let mut bm_idx = bm_idx;

        loop {
            if get_bit(&self.label_bit_map, bm_idx) != 0 {
                return true;
            }

            let index = (bm_idx - node_id) as usize;
            let next_label = self.labels[index];
            current_key.push(next_label as char);
            let next_node_id = count_zeros(&self.label_bit_map, &self.ranks, bm_idx + 1);
            let next_bm_idx = select_ith_one(&self.label_bit_map, &self.ranks, &self.selects, next_node_id - 1) + 1;

            if !self.traverse(current_key, next_node_id, next_bm_idx, f) {
                return false;
            }
            current_key.pop();
            bm_idx += 1;
        }
    }

    fn foreach<F: FnMut(String) -> bool>(&mut self, mut f: F) {
        self.keys(|key| {
            let reverse_key = key.chars().rev().collect::<String>();
            f(reverse_key)
        });
    }
}

fn get_bit(bm: &[u64], i: isize) -> u64 {
    bm[(i >> 6) as usize] & (1 << (i & 63))
}

fn count_zeros(bm: &[u64], ranks: &[i32], i: isize) -> isize {
    let (a, _) = bitmap::Bitmap::rank_64(bm, ranks, i as i32);
    i - a as isize
}

fn select_ith_one(bm: &[u64], ranks: &[i32], selects: &[i32], i: isize) -> isize {
    let (a, _) = bitmap::Bitmap::select_32_r64(bm, selects, ranks, i as i32);
    a as isize
}

#[derive(Clone, Copy)]
struct QueueItem {
    start: usize,
    end: usize,
    col: usize,
}

fn export_as_mrs<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    let mut body = Vec::new();
    let count = export_mrs_body(rules, &mut body)?;

    let mut encoded = Vec::new();
    {
        let mut writer = zstd::Encoder::new(&mut encoded, 0)?;
        utils::write_mrs_header(&mut writer, RuleBehavior::Domain, count)?;
        writer.write_all(&body)?;
        writer.finish()?;
    }

    std::fs::write(file_path, encoded)?;
    Ok(())
}

pub(crate) fn export_mrs_body<W: Write>(rules: &[String], writer: &mut W) -> Result<i64> {
    let mut count = 0i64;
    let mut keys = Vec::new();

    for rule in rules {
        let expanded = expand_rule(rule)?;
        count += 1;
        keys.extend(expanded.into_iter().map(|domain| reverse_string(&domain)));
    }

    keys.sort();
    keys.dedup();

    if keys.is_empty() {
        return Err(RuleParseError::EmptyRule);
    }

    let domain_set = build_domain_set(&keys);
    write_domain_set(writer, &domain_set)?;
    Ok(count)
}

fn expand_rule(rule: &str) -> Result<Vec<String>> {
    if rule.ends_with('.') || rule.trim() != rule || rule.is_empty() || rule.contains('/') {
        return Err(RuleParseError::InvalidRule(rule.to_string()));
    }

    let normalized = rule.to_lowercase();
    let parts: Vec<&str> = normalized.split('.').collect();

    if parts.len() == 1 {
        if parts[0].is_empty() {
            return Err(RuleParseError::InvalidRule(rule.to_string()));
        }
    } else if parts.iter().skip(1).any(|part| part.is_empty()) {
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

fn reverse_string(value: &str) -> String {
    value.chars().rev().collect()
}

fn build_domain_set(keys: &[String]) -> DomainSet {
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
            let label = keys[from].as_bytes()[item.col];
            while cursor < item.end && keys[cursor].as_bytes()[item.col] == label {
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

fn set_bit_u(bitmap: &mut Vec<u64>, index: usize, value: u64) {
    while (index >> 6) >= bitmap.len() {
        bitmap.push(0);
    }

    bitmap[index >> 6] |= value << (index & 63);
}

fn write_domain_set<W: Write>(writer: &mut W, domain_set: &DomainSet) -> Result<()> {
    writer.write_all(&[1])?;
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

fn parse_from_mrs(buf: &[u8]) -> Result<RulePayload> {
    // create ZSTD decoder
    let mut reader = zstd::Decoder::new(Cursor::new(buf))?;

    // validate mrs file
    let count = utils::validate_mrs(&mut reader, RuleBehavior::Domain)?;

    let mut domain_set = DomainSet::new();

    // version
    let mut version = [0u8; 1];
    reader.read_exact(&mut version)?;
    if version[0] != 1 {
        return Err(RuleParseError::InvalidVersion);
    }

    // leaves
    let length = reader.read_i64::<BigEndian>()?;
    if length < 0 {
        return Err(RuleParseError::InvalidLength(length));
    }
    let mut leaves = vec![0u64; length as usize];
    for i in 0..length {
        leaves[i as usize] = reader.read_u64::<BigEndian>()?;
    }
    domain_set.leaves = leaves;

    // label bitmap
    let length = reader.read_i64::<BigEndian>()?;
    if length < 0 {
        return Err(RuleParseError::InvalidLength(length));
    }
    let mut label_bit_map = vec![0u64; length as usize];
    for i in 0..length {
        label_bit_map[i as usize] = reader.read_u64::<BigEndian>()?;
    }
    domain_set.label_bit_map = label_bit_map;

    // labels
    let length = reader.read_i64::<BigEndian>()?;
    if length < 0 {
        return Err(RuleParseError::InvalidLength(length));
    }
    let mut labels = vec![0u8; length as usize];
    reader.read_exact(&mut labels)?;
    drop(reader);

    domain_set.labels = labels;
    domain_set.init();

    // get rules
    let mut rules: Vec<String> = vec![];
    let mut keys = Vec::new();
    domain_set.foreach(|key| {
        keys.push(key);
        true
    });
    keys.sort();

    for key in &keys {
        let search_str = format!("+.{key}");
        if keys.binary_search(&search_str).is_ok() {
            continue;
        }
        rules.push(key.clone());
    }

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
