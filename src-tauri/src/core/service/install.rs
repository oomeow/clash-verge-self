use std::{
    ffi::OsString,
    path::{Path, PathBuf},
    process::{Command as StdCommand, ExitStatus, Output},
};

use anyhow::Result;

use super::SERVER_ID;
use crate::utils::dirs;

/// Directory holding the app executable and its bundled core sidecars
/// (Tauri `externalBin` are placed next to the main binary on every platform).
///
/// Pinned into the installed service so it only ever launches cores from here.
/// Note this is the *binary* directory, not [`dirs::app_home_dir`] (the data dir).
fn core_bin_dir() -> Result<PathBuf> {
    std::env::current_exe()?
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| anyhow::anyhow!("failed to resolve the app executable directory"))
}

fn install_args(log_dir: &Path, core_dir: &Path) -> Vec<OsString> {
    vec![
        OsString::from("install"),
        OsString::from("--log-dir"),
        log_dir.as_os_str().to_owned(),
        OsString::from("--server-id"),
        OsString::from(SERVER_ID),
        OsString::from("--core-dir"),
        core_dir.as_os_str().to_owned(),
    ]
}

fn uninstall_args(log_dir: &Path) -> Vec<OsString> {
    vec![
        OsString::from("uninstall"),
        OsString::from("--log-dir"),
        log_dir.as_os_str().to_owned(),
    ]
}

/// Render `program` plus its arguments as one shell command line, quoting
/// every component with `quote`.
#[cfg(any(target_os = "linux", target_os = "macos"))]
fn shell_command(program: &Path, args: &[OsString], quote: fn(&str) -> String) -> String {
    std::iter::once(program.to_string_lossy())
        .chain(args.iter().map(|arg| arg.to_string_lossy()))
        .map(|part| quote(&part))
        .collect::<Vec<_>>()
        .join(" ")
}

fn truncate_error_detail(detail: &str) -> String {
    const MAX_DETAIL_CHARS: usize = 2_000;

    match detail.char_indices().nth(MAX_DETAIL_CHARS) {
        Some((cut, _)) => format!("{}…", &detail[..cut]),
        None => detail.to_owned(),
    }
}

fn format_exit_status(status: ExitStatus) -> String {
    match status.code() {
        Some(code) => format!("exit {code}"),
        None => "terminated by a signal".to_owned(),
    }
}

fn build_command_failure(action: &str, status: ExitStatus, detail: &str) -> anyhow::Error {
    let status = format_exit_status(status);
    let detail = detail.trim();

    if detail.is_empty() {
        let message = format!("failed to {action}: {status}");
        tracing::warn!("{message}");
        return anyhow::anyhow!(message);
    }

    let message = format!("failed to {action} ({status}): {}", truncate_error_detail(detail));
    tracing::warn!("{message}");
    anyhow::anyhow!(message)
}

fn build_command_spawn_error(action: &str, err: std::io::Error) -> anyhow::Error {
    anyhow::anyhow!("failed to {action}: {err}")
}

fn validate_command_output(action: &str, output: std::io::Result<Output>) -> Result<()> {
    let output = output.map_err(|err| build_command_spawn_error(action, err))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = match stderr.trim() {
        "" => stdout.trim(),
        message => message,
    };

    Err(build_command_failure(action, output.status, detail))
}

#[cfg(target_os = "windows")]
const SERVICE_LOG_FILE: &str = "clash-verge-self-service.log";

/// Byte offset of the service log before an elevated child starts, so a failure
/// only surfaces lines written by that attempt instead of a previous run's tail.
#[cfg(target_os = "windows")]
fn service_log_offset(log_dir: &Path) -> u64 {
    std::fs::metadata(log_dir.join(SERVICE_LOG_FILE))
        .map(|meta| meta.len())
        .unwrap_or(0)
}

/// Read the last few lines of the service log written since `offset`.
///
/// Falls back to reading from the start when the file shrank, which happens when
/// the service's logger rotates it to `clash-verge-self-service.old.log`.
#[cfg(target_os = "windows")]
fn read_service_log_since(log_dir: &Path, offset: u64) -> String {
    use std::io::{Read, Seek, SeekFrom};

    const TAIL_LINES: usize = 10;

    let Ok(mut file) = std::fs::File::open(log_dir.join(SERVICE_LOG_FILE)) else {
        return String::new();
    };
    let len = file.metadata().map(|meta| meta.len()).unwrap_or(0);
    let offset = if len < offset { 0 } else { offset };
    if file.seek(SeekFrom::Start(offset)).is_err() {
        return String::new();
    }

    let mut buf = Vec::new();
    if file.read_to_end(&mut buf).is_err() {
        return String::new();
    }

    let content = String::from_utf8_lossy(&buf);
    let lines: Vec<&str> = content.lines().collect();
    lines[lines.len().saturating_sub(TAIL_LINES)..].join("\n")
}

/// `runas` reports a failed `ShellExecuteExW` — including a cancelled UAC prompt —
/// as `!0`, i.e. exit code -1, without ever starting the child process.
#[cfg(target_os = "windows")]
fn runas_launch_failed(status: ExitStatus) -> bool {
    status.code() == Some(-1)
}

#[cfg(target_os = "windows")]
fn build_runas_launch_error(action: &str) -> anyhow::Error {
    tracing::warn!("failed to {action}: elevation was cancelled or the process could not be started");
    anyhow::anyhow!("failed to {action}: elevation was cancelled or the service process could not be started")
}

/// Run the service binary, elevating through `runas` when required.
///
/// When an elevated child exits unsuccessfully, its own log tail (written after
/// `log_offset`) is the only useful diagnostic, since stdout/stderr are not
/// captured across the `ShellExecuteExW` boundary.
#[cfg(target_os = "windows")]
fn run_service_command(action: &str, program: PathBuf, args: &[OsString], log_dir: &Path) -> Result<()> {
    use std::os::windows::process::CommandExt;

    use deelevate::{PrivilegeLevel, Token};
    use runas::Command as RunasCommand;

    match Token::with_current_process()?.privilege_level()? {
        PrivilegeLevel::NotPrivileged => {
            let log_offset = service_log_offset(log_dir);
            let status = RunasCommand::new(program)
                .args(args)
                .show(false)
                .status()
                .map_err(|err| build_command_spawn_error(action, err))?;
            if status.success() {
                return Ok(());
            }
            if runas_launch_failed(status) {
                return Err(build_runas_launch_error(action));
            }
            Err(build_command_failure(
                action,
                status,
                &read_service_log_since(log_dir, log_offset),
            ))
        }
        _ => {
            let output = StdCommand::new(program).args(args).creation_flags(0x08000000).output();
            validate_command_output(action, output)
        }
    }
}

/// Single-quote a value for safe interpolation into a `sh -c` command.
#[cfg(target_os = "linux")]
fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// Shell-quote a value with single quotes, then escape it for the enclosing
/// AppleScript double-quoted string literal used by `do shell script`.
#[cfg(target_os = "macos")]
fn apple_shell_quote(value: &str) -> String {
    let shell = format!("'{}'", value.replace('\'', "'\\''"));
    shell.replace('\\', "\\\\").replace('"', "\\\"")
}

/// Install the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
///
#[cfg(target_os = "windows")]
pub async fn install_service() -> Result<()> {
    let install_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", install_path.display());
    if !install_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let core_dir = core_bin_dir()?;
    let args = install_args(&log_dir, &core_dir);

    run_service_command("install service", install_path, &args, &log_dir)
}

#[cfg(target_os = "linux")]
pub async fn install_service() -> Result<()> {
    use users::get_effective_uid;

    let installer_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", installer_path.display());
    if !installer_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    tracing::debug!("log dir: {}", log_dir.display());
    let core_dir = core_bin_dir()?;
    let args = install_args(&log_dir, &core_dir);

    let elevator = crate::utils::unix_helper::linux_elevator();
    let output = match get_effective_uid() {
        0 => StdCommand::new(&installer_path).args(&args).output(),
        _ => {
            let execute_cmd = shell_command(&installer_path, &args, sh_quote);
            StdCommand::new(elevator).arg("sh").arg("-c").arg(execute_cmd).output()
        }
    };

    validate_command_output("install service", output)
}

#[cfg(target_os = "macos")]
pub async fn install_service() -> Result<()> {
    let installer_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", installer_path.display());
    if !installer_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let core_dir = core_bin_dir()?;
    let args = install_args(&log_dir, &core_dir);
    let command = format!(
        r#"do shell script "{}" with administrator privileges"#,
        shell_command(&installer_path, &args, apple_shell_quote),
    );

    let output = StdCommand::new("osascript").args(["-e", command.as_str()]).output();

    validate_command_output("install service", output)
}

/// Uninstall the Clash Verge Service
/// 该函数应该在协程或者线程中执行，避免UAC弹窗阻塞主线程
#[cfg(target_os = "windows")]
pub async fn uninstall_service() -> Result<()> {
    let uninstall_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstall_path.display());
    if !uninstall_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let args = uninstall_args(&log_dir);

    run_service_command("uninstall service", uninstall_path, &args, &log_dir)
}

#[cfg(target_os = "linux")]
pub async fn uninstall_service() -> Result<()> {
    use users::get_effective_uid;

    let uninstaller_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstaller_path.display());
    if !uninstaller_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let args = uninstall_args(&log_dir);
    let elevator = crate::utils::unix_helper::linux_elevator();
    let output = match get_effective_uid() {
        0 => StdCommand::new(&uninstaller_path).args(&args).output(),
        _ => {
            let execute_cmd = shell_command(&uninstaller_path, &args, sh_quote);
            StdCommand::new(elevator).arg("sh").arg("-c").arg(execute_cmd).output()
        }
    };

    validate_command_output("uninstall service", output)
}

#[cfg(target_os = "macos")]
pub async fn uninstall_service() -> Result<()> {
    let uninstaller_path = dirs::service_bin_path()?;
    tracing::debug!("clash-verge-self-service file path: {}", uninstaller_path.display());
    if !uninstaller_path.exists() {
        anyhow::bail!("clash-verge-self-service file not found");
    }

    let log_dir = dirs::app_logs_dir()?;
    let args = uninstall_args(&log_dir);
    let command = format!(
        r#"do shell script "{}" with administrator privileges"#,
        shell_command(&uninstaller_path, &args, apple_shell_quote),
    );

    let output = StdCommand::new("osascript").args(["-e", command.as_str()]).output();

    validate_command_output("uninstall service", output)
}
