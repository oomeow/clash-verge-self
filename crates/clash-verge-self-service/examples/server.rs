use clash_verge_self_service::Result;
use log4rs::{
    append::console::ConsoleAppender,
    config::{Appender, Logger, Root},
    encode::pattern::PatternEncoder,
};

fn init_log() -> log4rs::Handle {
    log4rs::init_config(
        log4rs::config::Config::builder()
            .appender(
                Appender::builder().build(
                    "stdout",
                    Box::new(
                        ConsoleAppender::builder()
                            .encoder(Box::new(PatternEncoder::new("{d(%Y-%m-%d %H:%M:%S)} {l} - {m}{n}")))
                            .build(),
                    ),
                ),
            )
            .logger(
                Logger::builder()
                    .appender("stdout")
                    .additive(false)
                    .build("app", log::LevelFilter::Trace),
            )
            .build(Root::builder().appender("stdout").build(log::LevelFilter::Trace))
            .unwrap(),
    )
    .unwrap()
}

#[tokio::main]
async fn main() -> Result<()> {
    let _handle = init_log();

    let server_id = "hello-secured-ipc-dev";
    clash_verge_self_service::Server::run(server_id, Some(clash_verge_self_service::DEFAULT_PSK)).await?;
    Ok(())
}
