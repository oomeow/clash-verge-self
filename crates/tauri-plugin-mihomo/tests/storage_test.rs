use serde::{Deserialize, Serialize};
use tauri_plugin_mihomo::Result;

mod common;

#[derive(Debug, Serialize, Deserialize)]
struct User {
    name: String,
    age: u32,
}

#[tokio::test]
async fn mihomo_get_storage_value() -> Result<()> {
    let mihomo = common::mihomo();
    let value = mihomo.get_storage_value::<User>("test").await?;
    println!("{:?}", value);
    Ok(())
}

#[tokio::test]
async fn mihomo_set_storage_value() -> Result<()> {
    let mihomo = common::mihomo();
    let value = User {
        name: "Github".to_string(),
        age: 30,
    };
    mihomo.set_storage_value("test", value).await?;
    let retrieved_value = mihomo.get_storage_value::<User>("test").await?;
    assert!(retrieved_value.is_some());
    assert_eq!(retrieved_value.unwrap().name, "Github");
    Ok(())
}

#[tokio::test]
async fn mihomo_delete_storage_value() -> Result<()> {
    let mihomo = common::mihomo();
    mihomo.delete_storage_value("test").await?;
    let value = mihomo.get_storage_value::<User>("test").await?;
    assert!(value.is_none());
    Ok(())
}
