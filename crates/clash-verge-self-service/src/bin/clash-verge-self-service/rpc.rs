use std::collections::VecDeque;

use anyhow::Result;
use clap::Subcommand;
use clash_verge_self_service::model::{ClashRunInfo, JsonResponse, ServiceVersionInfo, SocketCommand, StartBody};
use serde::Serialize;

#[derive(Subcommand)]
pub enum RpcCommand {
    GetVersion,
    GetClash,
    GetLogs,
    StartClash {
        #[arg(long, help = "Serialized StartBody payload")]
        payload: String,
    },
    StopClash,
    StopService,
}

pub async fn process(server_id: Option<String>, command: RpcCommand) -> Result<()> {
    let server_id = server_id.unwrap_or(clash_verge_self_service::DEFAULT_SERVER_ID.to_string());
    let mut client = clash_verge_self_service::Client::connect(server_id).await?;

    match command {
        RpcCommand::GetVersion => print_response(client.send::<ServiceVersionInfo>(SocketCommand::GetVersion).await?),
        RpcCommand::GetClash => print_response(client.send::<ClashRunInfo>(SocketCommand::GetClash).await?),
        RpcCommand::GetLogs => print_response(client.send::<VecDeque<String>>(SocketCommand::GetLogs).await?),
        RpcCommand::StartClash { payload } => {
            let body: StartBody = serde_json::from_str(&payload)?;
            print_response(client.send::<()>(SocketCommand::StartClash(body)).await?)
        }
        RpcCommand::StopClash => print_response(client.send::<()>(SocketCommand::StopClash).await?),
        RpcCommand::StopService => print_response(client.send::<()>(SocketCommand::StopService).await?),
    }

    Ok(())
}

fn print_response<T: Serialize>(response: JsonResponse<T>) {
    println!(
        "{}",
        serde_json::to_string(&response).expect("response serialization should succeed")
    );
}
