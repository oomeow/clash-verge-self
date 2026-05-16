use std::thread;

use anyhow::Result;
use boa_engine::{Context, JsValue};
use serde_yaml::Mapping;

use super::use_lowercase;
use crate::enhance::LogMessage;

const CONSOLE_SCRIPT: &str = r#"var __verge_log_messages = [];
function __verge_serialize_log_args(args) {
  return args.map((item) => JSON.stringify(item));
}
var console = Object.freeze({
  log(...data){ __verge_log_messages.push({ method: "log", data: __verge_serialize_log_args(data), exception: null }); },
  info(...data){ __verge_log_messages.push({ method: "info", data: __verge_serialize_log_args(data), exception: null }); },
  error(...data){ __verge_log_messages.push({ method: "error", data: __verge_serialize_log_args(data), exception: null }); },
  debug(...data){ __verge_log_messages.push({ method: "debug", data: __verge_serialize_log_args(data), exception: null }); },
});"#;

pub fn use_script(script: String, config: Mapping) -> Result<(Mapping, Vec<LogMessage>)> {
    // 所有操作都放到子线程中, 线程结束，则销毁 boa 相关的对象，避免内存快速升高且居高不下的问题
    let handle = thread::spawn(move || -> Result<(Mapping, Vec<LogMessage>)> {
        let config = use_lowercase(config);
        let config_str = serde_json::to_string(&config)?;
        let mut outputs = Vec::new();

        // 创建上下文
        let mut context = Context::default();

        // 注入 console 脚本
        eval_script(&mut context, CONSOLE_SCRIPT)?;

        let call = format!(
            r#"(function() {{
                try {{
                    {}
                    return JSON.stringify({{ ok: true, value: main({}) }});
                }} catch (e) {{
                    let name = e && e.name ? e.name : null;
                    let msg = e && e.message ? e.message : null;
                    let errstr = name && msg ? (name + ': ' + msg) : (e && e.stack ? e.stack : String(e));
                    return JSON.stringify({{ ok: false, error: errstr }});
                }}
            }})()"#,
            script.as_str(),
            config_str
        );

        let result = eval_script(&mut context, &call)?;

        parse_script_logs(&mut context, &mut outputs)?;

        // 解析脚本结果
        parse_script_result(result, &mut context, config, outputs)
    });

    // join 等待子线程完成，获取结果
    handle
        .join()
        .map_err(|e| anyhow::anyhow!("Script thread panicked: {:?}", e))?
}

fn eval_script(context: &mut boa_engine::Context, source: &str) -> Result<boa_engine::JsValue> {
    use boa_engine::Source;

    context
        .eval(Source::from_bytes(source))
        .map_err(|err| anyhow::anyhow!(js_error_message(err, context)))
}

fn js_error_message(err: boa_engine::JsError, context: &mut boa_engine::Context) -> String {
    err.to_opaque(context)
        .to_string(context)
        .ok()
        .and_then(|message| message.to_std_string().ok())
        .unwrap_or_else(|| err.to_string())
}

fn parse_script_logs(context: &mut boa_engine::Context, outputs: &mut Vec<LogMessage>) -> Result<()> {
    // Collect console logs from JS global array into outputs
    let logs_str: JsValue = eval_script(
        context,
        "typeof __verge_log_messages !== 'undefined' ? JSON.stringify(__verge_log_messages) : JSON.stringify([])",
    )?;

    let logs_json = logs_str
        .to_string(context)
        .map_err(|err| anyhow::anyhow!(js_error_message(err, context)))?
        .to_std_string_lossy();

    match serde_json::from_str::<Vec<LogMessage>>(&logs_json) {
        Ok(mut msgs) => {
            outputs.append(&mut msgs);
        }
        Err(err) => {
            outputs.push(LogMessage {
                method: "error".into(),
                data: vec![],
                exception: Some(err.to_string()),
            });
        }
    }
    Ok(())
}

fn parse_script_result(
    result: boa_engine::JsValue,
    context: &mut boa_engine::Context,
    fallback_config: Mapping,
    mut outputs: Vec<LogMessage>,
) -> Result<(Mapping, Vec<LogMessage>)> {
    let call_result_str = result
        .to_string(context)
        .map_err(|err| anyhow::anyhow!(js_error_message(err, context)))?
        .to_std_string_lossy();

    let call_result: serde_json::Value = serde_json::from_str(&call_result_str)?;

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

    // let mut out = outputs.lock();
    match serde_json::from_value::<Mapping>(value) {
        Ok(config) => Ok((use_lowercase(config), outputs)),
        Err(err) => {
            outputs.push(LogMessage {
                method: "error".into(),
                data: vec![],
                exception: Some(err.to_string()),
            });
            Ok((fallback_config, outputs))
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
