use anyhow::Result;
use mihomo_api::{model::Protocol, MihomoBuilder};
use std::{
    fs::{self},
    io::Write,
    path::Path,
    time::Duration,
};

mod utils;

#[tokio::test]
async fn websockets_test() -> Result<()> {
    let mihomo = utils::default_mihomo()?;

    let ws_client = mihomo.ws_memory().await?;
    let ws_client_ = ws_client.clone();

    let file_path = "ws.log";
    if Path::new(file_path).exists() {
        fs::remove_file(file_path).unwrap();
    }
    let mut file = fs::OpenOptions::new()
        .write(true)
        .append(false)
        .create(true)
        .open(file_path)
        .expect("create file failed");

    let handler = tokio::spawn(async move {
        ws_client_
            .listent(move |message| {
                let message_str = message.into_text().unwrap();
                file.write_all(message_str.as_bytes()).unwrap();
            })
            .await;
    });

    tokio::time::sleep(Duration::from_secs(50)).await;
    // ws_client.disconnect().await?;
    // let _ = handler.await;

    Ok(())
}
