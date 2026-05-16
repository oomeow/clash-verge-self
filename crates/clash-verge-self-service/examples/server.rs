use anyhow::Result;

#[tokio::main]
async fn main() -> Result<()> {
    let server_id = "hello-secured-ipc-dev";
    clash_verge_self_service::Server::run(server_id).await?;
    Ok(())
}
