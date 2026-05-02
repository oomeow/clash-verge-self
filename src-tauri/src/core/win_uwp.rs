use std::process::Command as StdCommand;

use anyhow::Result;
use deelevate::{PrivilegeLevel, Token};
use runas::Command as RunasCommand;

use crate::utils::dirs;

pub async fn invoke_uwptools() -> Result<()> {
    let resource_dir = dirs::app_resources_dir()?;
    let tool_path = resource_dir.join("enableLoopback.exe");

    if !tool_path.exists() {
        anyhow::bail!("enableLoopback exe not found");
    }

    let token = Token::with_current_process()?;
    let level = token.privilege_level()?;

    match level {
        PrivilegeLevel::NotPrivileged => RunasCommand::new(tool_path).status()?,
        _ => StdCommand::new(tool_path).status()?,
    };

    Ok(())
}
