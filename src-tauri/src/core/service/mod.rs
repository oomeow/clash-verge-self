mod install;
mod message;

pub use install::{install_service, uninstall_service};
pub use message::{check_service, get_logs, stop_service};
pub(super) use message::{run_core_by_service, stop_core_by_service};

// #[cfg(not(feature = "verge-dev"))]
const SERVER_ID: &str = "verge-service-server";
// #[cfg(feature = "verge-dev")]
// const SERVER_ID: &str = "verge-service-server-dev";
