use super::{Draft, IClashConfig, IProfiles, IRuntime, IVerge};
use crate::{
    core::{mihomo::MihomoClientManager, service},
    enhance, feat,
    utils::{dirs, help},
};
use anyhow::{anyhow, Result};
use once_cell::sync::OnceCell;
use rust_i18n::t;
use std::{env::temp_dir, path::PathBuf, time::Duration};

pub const RUNTIME_CONFIG: &str = "clash-verge.yaml";
pub const CHECK_CONFIG: &str = "clash-verge-check.yaml";

pub struct Config {
    clash_config: Draft<IClashConfig>,
    verge_config: Draft<IVerge>,
    profiles_config: Draft<IProfiles>,
    runtime_config: Draft<IRuntime>,
}

impl Config {
    pub fn global() -> &'static Config {
        static CONFIG: OnceCell<Config> = OnceCell::new();

        CONFIG.get_or_init(|| Config {
            clash_config: Draft::from(IClashConfig::new()),
            verge_config: Draft::from(IVerge::new()),
            profiles_config: Draft::from(IProfiles::new()),
            runtime_config: Draft::from(IRuntime::new()),
        })
    }

    pub fn clash() -> Draft<IClashConfig> {
        Self::global().clash_config.clone()
    }

    pub fn verge() -> Draft<IVerge> {
        Self::global().verge_config.clone()
    }

    pub fn profiles() -> Draft<IProfiles> {
        Self::global().profiles_config.clone()
    }

    pub fn runtime() -> Draft<IRuntime> {
        Self::global().runtime_config.clone()
    }

    /// 初始化订阅
    pub fn init_config() -> Result<()> {
        crate::log_err!(Self::generate());
        if let Err(err) = Self::generate_file(ConfigType::Run) {
            log::error!(target: "app", "{err}");

            let runtime_path = dirs::app_home_dir()?.join(RUNTIME_CONFIG);
            // 如果不存在就将默认的clash文件拿过来
            if !runtime_path.exists() {
                help::save_yaml(
                    &runtime_path,
                    &Config::clash().latest().0,
                    Some("# Clash Verge Runtime"),
                )?;
            }
        }
        Ok(())
    }

    /// 将订阅丢到对应的文件中
    pub fn generate_file(typ: ConfigType) -> Result<PathBuf> {
        let path = match typ {
            ConfigType::Run => dirs::app_home_dir()?.join(RUNTIME_CONFIG),
            ConfigType::Check => temp_dir().join(CHECK_CONFIG),
        };

        let runtime = Config::runtime();
        let runtime = runtime.latest();
        let config = runtime
            .config
            .as_ref()
            .ok_or(anyhow!(t!("runtime.config.get.failed")))?;

        help::save_yaml(&path, &config, Some("# Generated by Clash Verge"))?;
        Ok(path)
    }

    /// 生成订阅存好
    pub fn generate() -> Result<()> {
        let (config, logs) = enhance::enhance();

        *Config::runtime().draft() = IRuntime {
            config: Some(config),
            chain_logs: logs,
        };

        Ok(())
    }

    /// reload config from file
    ///
    /// if config need restart app, return true
    pub async fn reload() -> Result<()> {
        let clash_config = Self::clash();
        let verge_config = Self::verge();
        let profiles_config = Self::profiles();
        let runtime_config = Self::runtime();

        // need to resolve auto launch file
        let old_enable_auto_launch = verge_config.latest().enable_auto_launch.unwrap_or(false);

        // discard all config draft
        clash_config.discard();
        verge_config.discard();
        profiles_config.discard();
        runtime_config.discard();
        // reload config data from yaml file
        clash_config.data().0 = Draft::from(IClashConfig::new()).data().0.clone();
        *verge_config.data() = Draft::from(IVerge::new()).data().clone();
        *profiles_config.data() = Draft::from(IProfiles::new()).data().clone();
        *runtime_config.data() = Draft::from(IRuntime::new()).data().clone();

        // generate runtime config
        Self::init_config()?;

        let enable_auto_launch = verge_config.latest().enable_auto_launch.unwrap_or(false);

        // resolve auto launch file
        if old_enable_auto_launch != enable_auto_launch {
            feat::patch_verge(IVerge {
                enable_auto_launch: Some(enable_auto_launch),
                ..IVerge::default()
            })
            .await?;
        }

        // Check if Clash Verge Service is installed and patch configuration values ​​if not
        let enable_service_mode = verge_config.latest().enable_service_mode.unwrap_or(false);
        if enable_service_mode && service::check_service().await.is_err() {
            feat::patch_verge(IVerge {
                enable_service_mode: Some(false),
                ..IVerge::default()
            })
            .await?;
        }

        // resolve config settings
        // let verge_config_ = verge_config.latest().clone();
        // feat::resolve_config_settings(verge_config_).await?;

        // restart clash code
        feat::restart_clash_core();
        std::thread::sleep(Duration::from_secs(2));
        // check clash core run status
        for i in 1..=5 {
            if i == 5 {
                log::debug!(target: "app", "check clash core run status when reload config: failed.");
                return Err(anyhow!(t!("clash.restart.failed")));
            }
            if MihomoClientManager::global()
                .mihomo()
                .get_base_config()
                .await
                .is_ok()
            {
                log::debug!(target: "app","check clash core run status when reload config: successful.");
                break;
            }
            log::debug!(target: "app","check clash core run status when reload config: failed, retry {} times, sleep 1s", i);
            std::thread::sleep(Duration::from_secs(1));
        }

        Ok(())
    }
}

#[derive(Debug)]
pub enum ConfigType {
    Run,
    Check,
}
