use std::{
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    sync::OnceLock,
};

pub fn test_export_path(name: &str, ext: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let dir = std::env::temp_dir().join("mihomo-rule-parser-export-tests");
    println!("test export dir: {}", dir.display());
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join(format!("{name}.{ext}")))
}

/// 保持本地 meta-rules-dat 仓库最新的命令序列。
const UPDATE_COMMANDS: [&[&str]; 3] = [&["restore", "."], &["clean", "-fd"], &["pull"]];

/// 拉取 meta-rules-dat 测试数据集（branch `meta`），供 `init_meta_rules` 复用。
/// 用 `OnceLock` 保证整个测试进程只初始化一次，避免并行测试对同一仓库的 git 命令竞争。
fn setup_meta_rules() -> Result<PathBuf, String> {
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

pub fn init_meta_rules() -> Result<PathBuf, Box<dyn std::error::Error>> {
    static INIT: OnceLock<Result<PathBuf, String>> = OnceLock::new();
    INIT.get_or_init(setup_meta_rules).clone().map_err(|e| e.into())
}

/// Check if the contents of the src file are different from the contents of the target file
pub fn check_diff<P: AsRef<Path>>(src_file: P, target_file: P) -> Result<(), String> {
    let mut src_str = String::new();
    std::fs::File::open(src_file.as_ref())
        .map_err(|_| "src file not found".to_string())?
        .read_to_string(&mut src_str)
        .map_err(|_| "read src file error".to_string())?;
    let src_lines = src_str.trim().lines().map(|s| s.to_owned()).collect::<Vec<String>>();

    let mut target_str = String::new();
    std::fs::File::open(target_file.as_ref())
        .map_err(|_| "target file not found".to_string())?
        .read_to_string(&mut target_str)
        .map_err(|_| "read target file error".to_string())?;
    let target_lines = target_str.trim().lines().map(|s| s.to_owned()).collect::<Vec<String>>();

    if src_lines.len() != target_lines.len() {
        return Err(format!(
            "content length not equals\n  src: {}\n  target: {}",
            src_lines.len(),
            target_lines.len()
        ));
    }

    let total = src_lines.len();
    for i in 0..total {
        let src_val = &src_lines[i];
        let target_val = &target_lines[i];
        if src_val != target_val {
            return Err(format!(
                "value not the same\n  index {}\n  src: {}\n  target: {}",
                i, src_val, target_val
            ));
        }
    }
    Ok(())
}
