use signal_hook::{
    consts::{SIGHUP, SIGINT, SIGTERM},
    iterator::Signals,
    low_level,
};

use crate::utils::resolve;

pub fn register() {
    tauri::async_runtime::spawn(async {
        let signals = [SIGTERM, SIGINT, SIGHUP];
        let Ok(mut sigs) = Signals::new(signals) else {
            tracing::error!("failed to register signal handlers");
            return;
        };
        for signal in &mut sigs {
            let signal_to_str = |signal: i32| match signal {
                SIGTERM => "SIGTERM",
                SIGINT => "SIGINT",
                SIGHUP => "SIGHUP",
                _ => "UNKNOWN",
            };
            tracing::info!("received signal {}", signal_to_str(signal));
            resolve::resolve_reset().await;
            // After printing it, do whatever the signal was supposed to do in the first place
            if let Err(err) = low_level::emulate_default_handler(signal) {
                tracing::error!("failed to emulate the default handler for signal {signal}: {err}");
            }
        }
    });
}
