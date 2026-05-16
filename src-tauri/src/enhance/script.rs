use std::sync::{Arc, Mutex};

use anyhow::Result;
use serde_yaml::Mapping;

use super::use_lowercase;
use crate::enhance::LogMessage;

const CONSOLE_SCRIPT: &str = r#"var __verge_log_messages = [];
var console = Object.freeze({
  log(data){ __verge_log_messages.push({ method: "log", data: [JSON.stringify(data)], exception: null }); },
  info(data){ __verge_log_messages.push({ method: "info", data: [JSON.stringify(data)], exception: null }); },
  error(data){ __verge_log_messages.push({ method: "error", data: [JSON.stringify(data)], exception: null }); },
  debug(data){ __verge_log_messages.push({ method: "debug", data: [JSON.stringify(data)], exception: null }); },
});"#;

const MAIN_RETURN_ERROR: &str = "main function should return object";

pub fn use_script(script: String, config: Mapping) -> Result<(Mapping, Vec<LogMessage>)> {
    use rquickjs::{Context, Runtime};

    let config = use_lowercase(config);
    let outputs = Arc::new(Mutex::new(vec![]));

    // Pre-serialize config so it can be injected into JS as a literal
    let config_str = serde_json::to_string(&config)?;

    let rt = Runtime::new()?;
    let ctx = Context::full(&rt)?;

    // Run script and call `main` inside the JS context. Capture the call result as a JSON string and parse it.
    let call_str: String = ctx
        .with(|ctx| {
            // Provide a simple console implementation that stores logs in a JS array
            ctx.eval::<(), _>(CONSOLE_SCRIPT)?;

            // Evaluate the user script (syntax/runtime errors here will surface)
            ctx.eval::<(), _>(script.as_str())?;

            // Call main(...) wrapped in try/catch to normalize runtime exceptions into a JSON result
            let call = format!(
                r#"(function() {{
                    try {{
                        return JSON.stringify({{ ok: true, value: main({}) }});
                    }} catch (e) {{
                        let name = e && e.name ? e.name : null;
                        let msg = e && e.message ? e.message : null;
                        let errstr = name && msg ? (name + ': ' + msg) : (e && e.stack ? e.stack : String(e));
                        return JSON.stringify({{ ok: false, error: errstr }});
                    }}
                }})()"#,
                config_str
            );

            let res_str: String = ctx.eval::<String, _>(call.as_str())?;
            Ok(res_str)
        })
        .map_err(|e: rquickjs::Error| anyhow::anyhow!(e.to_string()))?;

    let call_result: serde_json::Value = serde_json::from_str(&call_str).map_err(|e| anyhow::anyhow!(e.to_string()))?;

    // Collect console logs from JS global array into outputs
    let logs_str: String = ctx
        .with(|ctx| ctx.eval::<String, _>("typeof __verge_log_messages !== 'undefined' ? JSON.stringify(__verge_log_messages) : JSON.stringify([])"))
        .map_err(|e: rquickjs::Error| anyhow::anyhow!(e.to_string()))?;

    match serde_json::from_str::<Vec<LogMessage>>(&logs_str) {
        Ok(mut msgs) => {
            let mut out = outputs.lock().unwrap();
            out.append(&mut msgs);
        }
        Err(err) => {
            let mut out = outputs.lock().unwrap();
            out.push(LogMessage {
                method: "error".into(),
                data: vec![],
                exception: Some(err.to_string()),
            });
        }
    }

    // If `main` threw an exception, return it as an error
    if let Some(ok) = call_result.get("ok").and_then(|v| v.as_bool())
        && !ok
    {
        let err_str = call_result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error")
            .to_string();
        anyhow::bail!(err_str);
    }

    let value = call_result.get("value").cloned().unwrap_or(serde_json::Value::Null);
    parse_script_result(value, config, outputs)
}

fn parse_script_result(
    result: serde_json::Value,
    fallback_config: Mapping,
    outputs: std::sync::Arc<std::sync::Mutex<Vec<LogMessage>>>,
) -> Result<(Mapping, Vec<LogMessage>)> {
    if result.is_null() {
        anyhow::bail!(MAIN_RETURN_ERROR);
    }

    let mut out = outputs.lock().unwrap();
    match serde_json::from_value::<Mapping>(result) {
        Ok(config) => Ok((use_lowercase(config), out.to_vec())),
        Err(err) => {
            out.push(LogMessage {
                method: "error".into(),
                data: vec![],
                exception: Some(err.to_string()),
            });
            Ok((fallback_config, out.to_vec()))
        }
    }
}

#[test]
fn test_script() {
    let script = r#"
    function main(config) {
      if (Array.isArray(config.rules)) {
        config.rules = [...config.rules, "add"];
      }
      console.log(config);
      config.proxies = ["111"];
      return config;
    }
  "#;

    let config = r#"
    rules:
      - 111
      - 222
    tun:
      enable: false
    dns:
      enable: false
  "#;

    let config = serde_yaml::from_str(config).unwrap();
    let (config, results) = use_script(script.into(), config).unwrap();

    let config_str = serde_yaml::to_string(&config).unwrap();

    println!("{config_str}");

    dbg!(results);
}

#[test]
fn test_script_runtime_error() {
    let script = r#"
    function main() {
      throw new Error("boom");
    }
  "#;

    let config = serde_yaml::from_str("proxies: []").unwrap();
    let err = use_script(script.into(), config).unwrap_err();

    assert_eq!(err.to_string(), "Error: boom");
}

#[test]
fn test_script_syntax_error() {
    let script = r#"
    function main(config) {
      return config;
  "#;

    let config = serde_yaml::from_str("proxies: []").unwrap();
    let err = use_script(script.into(), config).unwrap_err();

    assert!(err.to_string().contains("SyntaxError"));
}
