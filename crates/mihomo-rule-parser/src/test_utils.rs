use std::{io, path::PathBuf, process::Command};

use crate::error::Result;

/// 拉取 meta-rules-dat 测试数据集（branch `meta`）。
/// 所有 git 命令都校验退出码，网络或仓库损坏时返回错误而非静默拿到旧数据。
pub(crate) fn init_meta_rules() -> Result<PathBuf> {
    let tmp_dir = std::env::temp_dir();
    let rules_dir = tmp_dir.join("meta-rules-dat");
    if std::fs::exists(&rules_dir)? {
        for args in [&["restore", "."][..], &["clean", "-fd"][..], &["pull"][..]] {
            let status = Command::new("git").args(args).current_dir(&rules_dir).status()?;
            if !status.success() {
                return Err(io::Error::other(format!("git {args:?} failed")).into());
            }
        }
    } else {
        let status = Command::new("git")
            .args(["clone", "-b", "meta", "https://github.com/MetaCubeX/meta-rules-dat.git"])
            .current_dir(&tmp_dir)
            .status()?;
        if !status.success() {
            return Err(io::Error::other("git clone failed").into());
        }
    }
    Ok(rules_dir)
}
