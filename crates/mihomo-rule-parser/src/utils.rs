use std::{
    io::{BufRead, BufReader, Read, Write},
    path::Path,
};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};

use crate::{
    MRS_MAGIC, RuleBehavior, RulePayload, YamlPayload,
    error::{Result, RuleParseError},
};

/// Get the rule behavior based on the given behavior byte.
fn get_rule_behavior(behavior: u8) -> Result<RuleBehavior> {
    match behavior {
        0 => Ok(RuleBehavior::Domain),
        1 => Ok(RuleBehavior::IpCidr),
        _ => Err(RuleParseError::InvalidBehavior("unknown behavior".to_string())),
    }
}

/// Validate MRS format and return the count of rules.
pub(crate) fn read_mrs_header<R: Read>(reader: &mut R) -> Result<(RuleBehavior, i64)> {
    // 读取并校验 Magic Number
    let mut magic = [0u8; 4];
    reader.read_exact(&mut magic)?;
    if magic != MRS_MAGIC {
        return Err(RuleParseError::InvalidMRSMagic);
    }

    // 读取 Behavior
    let mut behavior = [0u8; 1];
    reader.read_exact(&mut behavior)?;
    let behavior = get_rule_behavior(behavior[0])?;

    // 读取 Count
    let count = reader.read_i64::<BigEndian>()?;

    // 读取 Extra 数据
    let extra_length = reader.read_i64::<BigEndian>()?;
    if extra_length < 0 {
        return Err(RuleParseError::InvalidMRSLength(extra_length));
    }

    // for future use
    let _extra_data = if extra_length > 0 {
        let mut data = [0u8, extra_length as u8];
        reader.read_exact(&mut data)?;
        Some(data)
    } else {
        None
    };

    Ok((behavior, count))
}

pub(crate) fn write_mrs_header<W: Write>(writer: &mut W, behavior: RuleBehavior, count: i64) -> Result<()> {
    writer.write_all(&MRS_MAGIC)?;
    let behavior_byte = match behavior {
        RuleBehavior::Domain => 0,
        RuleBehavior::IpCidr => 1,
        RuleBehavior::Classical => return Err(RuleParseError::InvalidBehavior("classical".to_string())),
    };
    writer.write_all(&[behavior_byte])?;
    writer.write_i64::<BigEndian>(count)?;
    writer.write_i64::<BigEndian>(0)?;
    Ok(())
}

/// Parse YAML format
pub(crate) fn parse_from_yaml(buf: &[u8]) -> Result<RulePayload> {
    let payload: YamlPayload = serde_yaml::from_reader(buf)?;
    Ok(RulePayload::from(payload))
}

/// Parse text format
pub(crate) fn parse_from_text(buf: &[u8]) -> Result<RulePayload> {
    let reader = BufReader::new(buf);
    let mut count = 0;
    let mut rules: Vec<String> = vec![];
    for rule in reader.lines() {
        count += 1;
        rules.push(rule?.trim().to_string());
    }
    Ok(RulePayload { count, rules })
}

pub(crate) fn export_as_yaml<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    let file = std::fs::File::create(file_path)?;
    let writer = std::io::BufWriter::new(file);
    let payload = YamlPayload {
        payload: rules.to_vec(),
    };
    serde_yaml::to_writer(writer, &payload)?;
    Ok(())
}

pub(crate) fn export_as_text<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    let file = std::fs::File::create(file_path)?;
    let mut writer = std::io::BufWriter::new(file);
    for (i, rule) in rules.iter().enumerate() {
        if i > 0 {
            writer.write_all(b"\n")?;
        }
        writer.write_all(rule.as_bytes())?;
    }
    if !rules.is_empty() {
        writer.write_all(b"\n")?;
    }
    writer.flush()?;
    Ok(())
}
