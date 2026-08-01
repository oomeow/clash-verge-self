use tauri::Manager;
use tauri_plugin_mihomo::models::Protocol;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn cmd_format_json(text: &str) -> Result<String, String> {
    Ok(formatjson::format_json(text).map_err(|_| "failed to format json".to_string())?)
    // Ok(format_json(text, "  "))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::builder()
        .write_style(env_logger::WriteStyle::Always)
        .filter_level(log::LevelFilter::Trace)
        .filter_module("tokio_tungstenite", log::LevelFilter::Info)
        .filter_module("tungstenite", log::LevelFilter::Info)
        .init();

    tauri::Builder::default()
        .plugin(
            tauri_plugin_mihomo::Builder::new()
                .protocol(Protocol::LocalSocket)
                .socket_path("/tmp/self-mihomo.sock")
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet, cmd_format_json])
        .setup(|app| {
            app.handle().get_webview_window("main").unwrap().open_devtools();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
