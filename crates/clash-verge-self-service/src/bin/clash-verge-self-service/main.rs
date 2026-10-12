mod install;
mod log_config;
mod uninstall;

use std::path::PathBuf;

use clap::{Parser, Subcommand};
use log_config::LogConfig;
#[cfg(windows)]
use once_cell::sync::OnceCell;
#[cfg(windows)]
use windows_service::{define_windows_service, service_dispatcher};

#[derive(Parser)]
#[command(version, about = "install, uninstall or run Clash Verge Self Service", long_about = None)]
struct Cli {
    #[arg(short, long, help = "Run the IPC server with server-id as the socket path")]
    server_id: Option<String>,

    #[arg(long, help = "Path to the per-install pre-shared key file")]
    psk_path: Option<PathBuf>,

    #[arg(long, help = "Directory holding the app executable and its core sidecars")]
    core_dir: Option<PathBuf>,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    #[command(about = "Install Clash Verge Self Service")]
    Install {
        #[arg(short, long, help = "Log directory")]
        log_dir: Option<PathBuf>,

        #[arg(short, long, help = "The socket path of the IPC server")]
        server_id: Option<String>,

        #[arg(long, help = "Directory holding the app executable and its core sidecars")]
        core_dir: Option<PathBuf>,
    },
    #[command(about = "Uninstall Clash Verge Service")]
    Uninstall {
        #[arg(short, long, help = "Log directory")]
        log_dir: Option<PathBuf>,
    },
}

/// used to store the server_id resolved by the clap
#[cfg(windows)]
static SERVER_ID: OnceCell<Option<String>> = OnceCell::new();

/// used to store the psk path resolved by the clap
#[cfg(windows)]
static PSK_PATH: OnceCell<Option<PathBuf>> = OnceCell::new();

/// used to store the core dir resolved by the clap
#[cfg(windows)]
static CORE_DIR: OnceCell<Option<PathBuf>> = OnceCell::new();

/// Load the per-install pre-shared key, refusing to run without one.
fn load_psk(psk_path: Option<PathBuf>) -> clash_verge_self_service::Result<[u8; clash_verge_self_service::PSK_LEN]> {
    let psk_path = psk_path.ok_or_else(|| {
        clash_verge_self_service::ServiceError::General(
            "missing --psk-path, the service cannot authenticate clients".into(),
        )
    })?;
    clash_verge_self_service::read_psk(&psk_path)
}

/// Require the pinned core directory, refusing to run without one.
fn require_core_dir(core_dir: Option<PathBuf>) -> clash_verge_self_service::Result<PathBuf> {
    core_dir.ok_or_else(|| {
        clash_verge_self_service::ServiceError::General(
            "missing --core-dir, the service cannot resolve the core binary".into(),
        )
    })
}

#[cfg(windows)]
define_windows_service!(ffi_service_main, my_service_main);

#[cfg(windows)]
pub fn my_service_main(_arguments: Vec<std::ffi::OsString>) {
    // this arguments is not same as launch arguments
    if let Ok(rt) = tokio::runtime::Runtime::new() {
        let server_id = SERVER_ID.get().and_then(|id| id.clone()).unwrap_or_else(|| {
            log::error!("failed to get server id");
            clash_verge_self_service::DEFAULT_SERVER_ID.to_string()
        });
        let psk_path = PSK_PATH.get().and_then(|p| p.clone());
        let core_dir = CORE_DIR.get().and_then(|p| p.clone());
        let (Ok(psk), Ok(core_dir)) = (load_psk(psk_path), require_core_dir(core_dir)) else {
            log::error!("failed to load service key or core dir, service will not start");
            return;
        };
        rt.block_on(async move {
            let _ = clash_verge_self_service::Server::run(server_id, &psk, &core_dir).await;
        });
    }
}

fn main() -> clash_verge_self_service::Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Some(Commands::Install {
            log_dir,
            server_id,
            core_dir,
        }) => {
            LogConfig::global().lock().init(log_dir.clone())?;
            install::process(server_id, log_dir, core_dir)?;
        }
        Some(Commands::Uninstall { log_dir }) => {
            LogConfig::global().lock().init(log_dir.clone())?;
            uninstall::process(log_dir)?;
        }
        None => {
            LogConfig::global().lock().init(None)?;
            let server_id = cli.server_id;
            log::info!("Server ID: {:?}", server_id);
            #[cfg(unix)]
            {
                let rt = tokio::runtime::Runtime::new()?;
                let server_id = server_id.unwrap_or(clash_verge_self_service::DEFAULT_SERVER_ID.to_string());
                let psk = load_psk(cli.psk_path)?;
                let core_dir = require_core_dir(cli.core_dir)?;
                rt.block_on(async move {
                    let _ = clash_verge_self_service::Server::run(server_id, &psk, &core_dir).await;
                });
            }
            #[cfg(windows)]
            {
                SERVER_ID
                    .set(server_id)
                    .map_err(|_| clash_verge_self_service::ServiceError::General("failed to set server id".into()))?;
                PSK_PATH
                    .set(cli.psk_path)
                    .map_err(|_| clash_verge_self_service::ServiceError::General("failed to set psk path".into()))?;
                CORE_DIR
                    .set(cli.core_dir)
                    .map_err(|_| clash_verge_self_service::ServiceError::General("failed to set core dir".into()))?;
                service_dispatcher::start(clash_verge_self_service::SERVICE_NAME, ffi_service_main)?;
            }
        }
    }

    Ok(())
}
