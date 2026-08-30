use std::{
    io::{BufRead, BufReader, BufWriter, Cursor, Read, Write},
    path::Path,
};

use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};

use crate::{
    MRS_MAGIC, RuleBehavior, RulePayload, YamlPayload,
    error::{Result, RuleParseError},
};

/// 先写同目录临时文件，成功后原子重命名，失败则清理，避免留下半成品导出文件。
pub(crate) fn atomic_write<P, F>(path: P, f: F) -> Result<()>
where
    P: AsRef<Path>,
    F: FnOnce(&mut BufWriter<std::fs::File>) -> Result<()>,
{
    let path = path.as_ref();
    let dir = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let file_name = path
        .file_name()
        .ok_or_else(|| RuleParseError::InvalidRule(path.display().to_string()))?;
    let tmp_path = dir.join(format!(".{}.tmp", file_name.to_string_lossy()));

    let file = std::fs::File::create(&tmp_path)?;
    let mut writer = BufWriter::new(file);
    let result = f(&mut writer).and_then(|()| writer.flush().map_err(RuleParseError::from));
    match result {
        Ok(()) => {
            std::fs::rename(&tmp_path, path)?;
            Ok(())
        }
        Err(err) => {
            let _ = std::fs::remove_file(&tmp_path);
            Err(err)
        }
    }
}

/// Decompression budget for MRS payloads: at most `MAX_DECOMPRESSION_RATIO` times
/// the compressed input size, with an absolute ceiling, so a tiny malicious file
/// cannot expand into a decompression bomb.
const MAX_DECOMPRESSION_RATIO: usize = 256;
const MIN_DECOMPRESSION_BUDGET: usize = 1 << 20; // 1 MiB
const MAX_DECOMPRESSION_BUDGET: usize = 1 << 29; // 512 MiB

/// Decompress an MRS payload into memory, capping the output size to guard
/// against decompression bombs. All length fields are then validated against
/// the real decompressed size before any allocation happens.
pub(crate) fn read_mrs_payload(buf: &[u8]) -> Result<Vec<u8>> {
    let reader = zstd::Decoder::new(Cursor::new(buf))?;
    let budget = buf
        .len()
        .saturating_mul(MAX_DECOMPRESSION_RATIO)
        .clamp(MIN_DECOMPRESSION_BUDGET, MAX_DECOMPRESSION_BUDGET);
    let mut decompressed = Vec::new();
    reader.take((budget + 1) as u64).read_to_end(&mut decompressed)?;
    if decompressed.len() > budget {
        return Err(RuleParseError::MrsPayloadTooLarge);
    }
    Ok(decompressed)
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
    let behavior = match behavior[0] {
        0 => RuleBehavior::Domain,
        1 => RuleBehavior::IpCidr,
        b => {
            return Err(RuleParseError::InvalidBehavior(format!("unknown behavior: [{b}]")));
        }
    };

    // 读取 Count
    let count = reader.read_i64::<BigEndian>()?;
    if count < 0 {
        return Err(RuleParseError::InvalidMRSLength(count));
    }

    // 读取 Extra 数据（for future use），按块跳过以避免基于不可信长度预分配
    let extra_length = reader.read_i64::<BigEndian>()?;
    if extra_length < 0 {
        return Err(RuleParseError::InvalidMRSLength(extra_length));
    }
    skip_bytes(reader, extra_length as usize)?;

    Ok((behavior, count))
}

fn skip_bytes<R: Read>(reader: &mut R, n: usize) -> Result<()> {
    let mut limited = reader.by_ref().take(n as u64);
    let skipped = std::io::copy(&mut limited, &mut std::io::sink())?;
    if skipped != n as u64 {
        return Err(RuleParseError::Io(std::io::Error::from(
            std::io::ErrorKind::UnexpectedEof,
        )));
    }
    Ok(())
}

/// 读取一个必须为正数的 i64 长度字段。
pub(crate) fn read_length<R: Read>(reader: &mut R) -> Result<i64> {
    let length = reader.read_i64::<BigEndian>()?;
    if length < 1 {
        return Err(RuleParseError::InvalidMRSLength(length));
    }
    Ok(length)
}

/// 返回 Cursor 中剩余可读字节数。
pub(crate) fn cursor_remaining(reader: &Cursor<&[u8]>) -> usize {
    reader.get_ref().len().saturating_sub(reader.position() as usize)
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
        let rule = rule?;
        let rule = rule.trim();
        // 与 mihomo 对齐：跳过空行、`#` 注释和 `//` 注释
        if rule.is_empty() || rule.starts_with('#') || rule.starts_with("//") {
            continue;
        }
        count += 1;
        rules.push(rule.to_string());
    }
    Ok(RulePayload { count, rules })
}

pub(crate) fn export_as_yaml<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    let payload = YamlPayload {
        payload: rules.to_vec(),
    };
    atomic_write(file_path, |writer| {
        serde_yaml::to_writer(&mut *writer, &payload)?;
        Ok(())
    })
}

pub(crate) fn export_as_text<P: AsRef<Path>>(rules: &[String], file_path: P) -> Result<()> {
    atomic_write(file_path, |writer| {
        for (i, rule) in rules.iter().enumerate() {
            if i > 0 {
                writer.write_all(b"\n")?;
            }
            writer.write_all(rule.as_bytes())?;
        }
        if !rules.is_empty() {
            writer.write_all(b"\n")?;
        }
        Ok(())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skip_bytes_exact() {
        let mut c = Cursor::new(vec![1u8, 2, 3]);
        skip_bytes(&mut c, 3).unwrap();
        assert_eq!(c.position(), 3);
    }

    #[test]
    fn test_skip_bytes_short_stream() {
        let mut c = Cursor::new(vec![1u8, 2, 3]);
        let err = skip_bytes(&mut c, 5).unwrap_err();
        assert!(matches!(
            err,
            RuleParseError::Io(e) if e.kind() == std::io::ErrorKind::UnexpectedEof
        ));
    }

    #[test]
    fn test_skip_bytes_long_stream() {
        let mut c = Cursor::new(vec![1u8, 2, 3, 4, 5]);
        skip_bytes(&mut c, 3).unwrap();
        assert_eq!(c.position(), 3);
        let mut rest = Vec::new();
        c.read_to_end(&mut rest).unwrap();
        assert_eq!(rest, vec![4, 5]);
    }

    #[test]
    fn test_skip_bytes_zero() {
        let mut c = Cursor::new(vec![1u8, 2]);
        skip_bytes(&mut c, 0).unwrap();
        assert_eq!(c.position(), 0);
    }

    #[test]
    fn test_read_length_valid() {
        let mut c = Cursor::new(3i64.to_be_bytes());
        assert_eq!(read_length(&mut c).unwrap(), 3);
    }

    #[test]
    fn test_read_length_zero_rejected() {
        let mut c = Cursor::new(0i64.to_be_bytes());
        assert!(matches!(read_length(&mut c), Err(RuleParseError::InvalidMRSLength(0))));
    }

    #[test]
    fn test_read_length_negative_rejected() {
        let mut c = Cursor::new((-5i64).to_be_bytes());
        assert!(matches!(read_length(&mut c), Err(RuleParseError::InvalidMRSLength(-5))));
    }

    #[test]
    fn test_read_length_truncated() {
        let mut c = Cursor::new(vec![0u8; 4]);
        assert!(matches!(read_length(&mut c), Err(RuleParseError::Io(_))));
    }
}
