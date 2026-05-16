use anyhow::Result;
use serde_yaml::Mapping;

use super::use_lowercase;
use crate::enhance::LogMessage;

const CONSOLE_SCRIPT: &str = r#"var console = Object.freeze({
  log(data){__verge_log__("log",JSON.stringify(data))},
  info(data){__verge_log__("info",JSON.stringify(data))},
  error(data){__verge_log__("error",JSON.stringify(data))},
  debug(data){__verge_log__("debug",JSON.stringify(data))},
});"#;

const MAIN_RETURN_ERROR: &str = "main function should return object";

pub fn use_script(script: String, config: Mapping) -> Result<(Mapping, Vec<LogMessage>)> {
    use std::sync::{Arc, Mutex};

    let config = use_lowercase(config);
    let outputs = Arc::new(Mutex::new(vec![]));
    let mut context = create_context(outputs.clone())?;

    eval_script(&mut context, &script)?;

    let config_str = serde_json::to_string(&config)?;
    let result = eval_script(&mut context, &format!("main({config_str})"))?;
    parse_script_result(result, &mut context, config, outputs)
}

fn create_context(outputs: std::sync::Arc<std::sync::Mutex<Vec<LogMessage>>>) -> Result<boa_engine::Context> {
    use boa_engine::{Context, JsValue, native_function::NativeFunction};

    let mut context = Context::default();
    let copy_outputs = outputs.clone();

    unsafe {
        let _ = context.register_global_builtin_callable(
            "__verge_log__".into(),
            2,
            NativeFunction::from_closure(move |_: &JsValue, args: &[JsValue], context: &mut Context| {
                let level = args.first().unwrap().to_string(context)?;
                let level = level.to_std_string().unwrap();
                let data = args.get(1).unwrap().to_string(context)?;
                let data = data.to_std_string().unwrap();
                let mut out = copy_outputs.lock().unwrap();
                out.push(LogMessage {
                    method: level,
                    data: vec![data],
                    exception: None,
                });
                Ok(JsValue::undefined())
            }),
        );
    }

    eval_script(&mut context, CONSOLE_SCRIPT)?;
    Ok(context)
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

fn parse_script_result(
    result: boa_engine::JsValue,
    context: &mut boa_engine::Context,
    fallback_config: Mapping,
    outputs: std::sync::Arc<std::sync::Mutex<Vec<LogMessage>>>,
) -> Result<(Mapping, Vec<LogMessage>)> {
    if result.is_null() || result.is_undefined() {
        anyhow::bail!(MAIN_RETURN_ERROR);
    }

    let json = result
        .to_json(context)
        .map_err(|err| anyhow::anyhow!(js_error_message(err, context)))?
        .ok_or_else(|| anyhow::anyhow!(MAIN_RETURN_ERROR))?;

    let mut out = outputs.lock().unwrap();
    match serde_json::from_value::<Mapping>(json) {
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
