#![allow(unused)]
use std::{
    thread,
    time::{Duration, Instant},
};

use anyhow::Result;
use clash_verge_self_service::model::{ClashRunInfo, ServiceVersionInfo, SocketCommand, StartBody};

#[tokio::main]
async fn main() -> Result<()> {
    let server_id = "hello-secured-ipc-dev";
    let mut client = clash_verge_self_service::Client::connect(server_id, Some(clash_verge_self_service::PSK)).await?;
    // check version
    let now = Instant::now();
    for _ in 0..=2000 {
        get_version(&mut client).await?;
    }
    println!("took: {}ms", now.elapsed().as_millis());

    // start core
    start_core(&mut client).await?;
    tokio::time::sleep(Duration::from_secs(5)).await;
    get_clash(&mut client).await?;
    get_logs(&mut client).await?;

    tokio::time::sleep(Duration::from_secs(5)).await;
    // stop core
    stop_core(&mut client).await?;
    get_clash(&mut client).await?;
    get_logs(&mut client).await?;

    Ok(())
}

async fn start_core(client: &mut clash_verge_self_service::Client) -> Result<()> {
    let curr_dir = std::env::current_dir()?;
    let start_core = StartBody {
        core_type: Some("mihomo".into()),
        socket_path: Some("/tmp/mihomo-dev.sock".into()),
        bin_path: "/Applications/Clash Verge Self.app/Contents/MacOS/self-mihomo".into(),
        config_dir: curr_dir.join("examples/mihomo").to_str().unwrap().to_string(),
        pid_file: curr_dir
            .join("examples/mihomo/mihomo.pid")
            .to_str()
            .unwrap()
            .to_string(),
        config_file: curr_dir.join("examples/mihomo/test.yaml").to_str().unwrap().to_string(),
        log_file: curr_dir.join("examples/mihomo/test.log").to_str().unwrap().to_string(),
    };
    let msg = client.send::<()>(SocketCommand::StartClash(start_core)).await?;
    println!("start clash: {:?}", msg);
    Ok(())
}

async fn stop_core(client: &mut clash_verge_self_service::Client) -> Result<()> {
    let msg = client.send::<()>(SocketCommand::StopClash).await?;
    println!("stop clash: {:?}", msg);
    Ok(())
}

async fn get_clash(client: &mut clash_verge_self_service::Client) -> Result<()> {
    let msg = client.send::<ClashRunInfo>(SocketCommand::GetClash).await?;
    println!("get clash: {:#?}", msg);
    Ok(())
}

async fn get_logs(client: &mut clash_verge_self_service::Client) -> Result<()> {
    let msg = client.send::<Vec<String>>(SocketCommand::GetLogs).await?;
    println!("get logs: {:?}", msg);
    Ok(())
}

async fn get_version(client: &mut clash_verge_self_service::Client) -> Result<()> {
    let msg = client.send::<ServiceVersionInfo>(SocketCommand::GetVersion).await?;
    println!("get version: {:?}", msg);
    Ok(())
}
