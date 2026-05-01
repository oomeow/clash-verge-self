use std::time::Duration;

use anyhow::Result;

use crate::core::handle;

pub mod backup;
pub mod clash;
pub mod common;
pub mod profile;
pub mod service;
pub mod verge;

pub fn into_command_result<T>(result: Result<T>) -> std::result::Result<T, String> {
    result.map_err(|err| err.to_string())
}

pub async fn check_service_and_clash() -> Result<()> {
    for i in 0..5 {
        if service::check_service().await.is_err() {
            if i == 4 {
                anyhow::bail!("service check failed");
            } else {
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        };
    }
    let mihomo = handle::Handle::mihomo().await;
    for i in 0..5 {
        if mihomo.get_version().await.is_err() {
            if i == 4 {
                anyhow::bail!("clash check failed");
            } else {
                tokio::time::sleep(Duration::from_secs(1)).await;
            }
        }
    }
    Ok(())
}
