use std::{io, path::PathBuf, process::Command, sync::OnceLock};

use crate::error::{Result, RuleParseError};

/// 保持本地 meta-rules-dat 仓库最新的命令序列。
const UPDATE_COMMANDS: [&[&str]; 3] = [&["restore", "."], &["clean", "-fd"], &["pull"]];

/// 拉取 meta-rules-dat 测试数据集（branch `meta`），供 `init_meta_rules` 复用。
/// 用 `OnceLock` 保证整个测试进程只初始化一次，避免并行测试对同一仓库的 git 命令竞争。
fn setup_meta_rules() -> std::result::Result<PathBuf, String> {
    let tmp_dir = std::env::temp_dir();
    let rules_dir = tmp_dir.join("meta-rules-dat");
    if std::fs::exists(&rules_dir).map_err(|e| e.to_string())? {
        for args in UPDATE_COMMANDS {
            let status = Command::new("git")
                .args(args)
                .current_dir(&rules_dir)
                .status()
                .map_err(|e| e.to_string())?;
            if !status.success() {
                // 网络/仓库临时故障时保留本地副本继续测试，仅当数据真正缺失时才报错
                eprintln!("warning: git {args:?} failed ({status}); using existing local copy");
                break;
            }
        }
    } else {
        let status = Command::new("git")
            .args(["clone", "-b", "meta", "https://github.com/MetaCubeX/meta-rules-dat.git"])
            .current_dir(&tmp_dir)
            .status()
            .map_err(|e| e.to_string())?;
        if !status.success() {
            return Err(format!("git clone failed ({status})"));
        }
    }
    if !rules_dir.join("geo").exists() {
        return Err(format!("meta-rules-dat missing geo/ data at {}", rules_dir.display()));
    }
    Ok(rules_dir)
}

/// 获取 meta-rules-dat 测试数据集路径。
/// 所有 git 命令都校验退出码，网络或仓库损坏导致数据缺失时返回错误而非静默使用旧数据。
pub(crate) fn init_meta_rules() -> Result<PathBuf> {
    static INIT: OnceLock<std::result::Result<PathBuf, String>> = OnceLock::new();
    INIT.get_or_init(setup_meta_rules)
        .clone()
        .map_err(|e| RuleParseError::Io(io::Error::other(e)))
}
