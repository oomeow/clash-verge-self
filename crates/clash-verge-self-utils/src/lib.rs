use std::path::Path;

use anyhow::{Result, anyhow};

pub struct RawMihomoLog {
    pub time: String,
    pub level: String,
    pub msg: String,
}

pub fn parse_raw_mihomo_log(line: &str) -> Option<RawMihomoLog> {
    let line = logfmt::parse(line);
    let mut time = String::new();
    let mut level = String::new();
    let mut msg = String::new();
    for logfmt::Pair { key: k, val: v } in line {
        match k.as_str() {
            "time" => time = v.unwrap_or_default(),
            "level" => level = v.unwrap_or_default(),
            "msg" => msg = v.unwrap_or_default(),
            _ => {}
        }
    }
    if time.is_empty() || level.is_empty() || msg.is_empty() {
        return None;
    }
    Some(RawMihomoLog { time, level, msg })
}

pub fn format_raw_mihomo_log_line(line: &str) -> String {
    match parse_raw_mihomo_log(line) {
        Some(log) => {
            let mut level = log.level.to_uppercase();
            if level == "WARNING" {
                level = "WARN".to_string();
            }
            format!("{} {:>5} {}", log.time, level, log.msg)
        }
        None => line.to_string(),
    }
}

pub fn path_to_str<P: AsRef<Path>>(path: &P) -> Result<&str> {
    let ref_path = path.as_ref();
    let path_str = ref_path
        .as_os_str()
        .to_str()
        .ok_or_else(|| anyhow!("failed to get path from {}", ref_path.display()))?;
    Ok(path_str)
}
