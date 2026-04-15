use std::path::Path;

use anyhow::{Result, anyhow};

pub fn format_mihomo_log_line(line: &str) -> String {
    let line = logfmt::parse(line);
    let mut time = String::new();
    let mut level = String::new();
    let mut msg = String::new();
    for logfmt::Pair { key: k, val: v } in line {
        match k.as_str() {
            "time" => time = v.unwrap_or_default(),
            "level" => {
                let val = v.unwrap_or_default().to_uppercase();
                if val == "WARNING" {
                    level = "WARN".to_string();
                } else {
                    level = val
                }
            }
            "msg" => msg = v.unwrap_or_default(),
            _ => {}
        }
    }
    format!("{} {:>5} {}", time, level, msg)
}

pub fn path_to_str<P: AsRef<Path>>(path: &P) -> Result<&str> {
    let ref_path = path.as_ref();
    let path_str = ref_path
        .as_os_str()
        .to_str()
        .ok_or_else(|| anyhow!("failed to get path from {}", ref_path.display()))?;
    Ok(path_str)
}
