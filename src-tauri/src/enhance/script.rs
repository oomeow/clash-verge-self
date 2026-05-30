use std::{
    cell::{RefCell, RefMut},
    rc::Rc,
};

use anyhow::{Result, bail};
use rquickjs::{Ctx, Function, Object};
use serde_yaml::Mapping;

use super::use_lowercase;
use crate::enhance::LogMessage;

thread_local! {
     static JS_RUNTIME: rquickjs::Runtime = rquickjs::Runtime::new().expect("Failed to create JS runtime");
}

fn inject_console(ctx: Ctx<'_>, outputs: Rc<RefCell<Vec<LogMessage>>>) -> rquickjs::Result<()> {
    let console = Object::new(ctx.clone())?;
    let push_log = Function::new(ctx.clone(), move |method: String, data: Vec<String>| {
        outputs.borrow_mut().push(LogMessage {
            method,
            data,
            exception: None,
        });
    })?;
    ctx.globals().set("__verge_push_log", push_log)?;

    for method in ["log", "info", "warn", "error", "debug"] {
        let callback: Function = ctx.eval(format!(
            r#"(function(pushLog) {{
                return (...data) => pushLog("{method}", data.map((item) => JSON.stringify(item) ?? "undefined"));
            }})(__verge_push_log)"#
        ))?;
        console.set(method, callback)?;
    }
    // remove __verge_push_log from globalThis
    ctx.eval::<(), _>("delete globalThis.__verge_push_log;")?;

    ctx.globals().set("console", console)?;

    // freeze console object
    ctx.eval::<(), _>("Object.freeze(console);")?;

    // prevent console from being replaced
    ctx.eval::<(), _>(
        "Object.defineProperty(globalThis, 'console', {
          value: console,
          writable: false,
          configurable: false,
          enumerable: true,
        });",
    )?;

    Ok(())
}

pub fn use_script(script: String, config: Mapping) -> Result<(Mapping, Vec<LogMessage>)> {
    if !script.contains("function main(") {
        bail!("Script does not contain main function");
    }

    let config = use_lowercase(config);
    let outputs = Rc::new(RefCell::new(Vec::new()));

    // Pre-serialize config so it can be injected into JS as a literal
    let config_str = serde_json::to_string(&config)?;

    let ctx = JS_RUNTIME.with(rquickjs::Context::full)?;

    // Run script and call `main` inside the JS context. Capture the call result as a JSON string and parse it.
    let call_str: String = ctx
        .with(|ctx| {
            inject_console(ctx.clone(), Rc::clone(&outputs))?;

            // Evaluate the user script, then call main(...) wrapped in try/catch to normalize runtime exceptions into a JSON result
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

            let res_str: String = ctx.eval::<String, _>(call.as_str())?;
            Ok(res_str)
        })
        .map_err(|e: rquickjs::Error| anyhow::anyhow!(e.to_string()))?;

    let call_result: serde_json::Value = serde_json::from_str(&call_str).map_err(|e| anyhow::anyhow!(e.to_string()))?;

    // If `main` threw an exception, return it as an error
    if call_result.get("ok").and_then(|v| v.as_bool()).is_some_and(|ok| !ok) {
        let err_str = call_result
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error")
            .to_string();
        anyhow::bail!(err_str);
    }

    let value = call_result.get("value").cloned().unwrap_or(serde_json::Value::Null);
    parse_script_result(value, config, outputs.borrow_mut())
}

fn parse_script_result(
    result: serde_json::Value,
    fallback_config: Mapping,
    mut outputs: RefMut<Vec<LogMessage>>,
) -> Result<(Mapping, Vec<LogMessage>)> {
    if result.is_null() {
        anyhow::bail!("main function should return object");
    }

    match serde_json::from_value::<Mapping>(result) {
        Ok(config) => Ok((use_lowercase(config), outputs.to_owned())),
        Err(err) => {
            outputs.push(LogMessage {
                method: "error".into(),
                data: vec![],
                exception: Some(err.to_string()),
            });
            Ok((fallback_config, outputs.to_owned()))
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

    assert_eq!(
        config.get("proxies").and_then(|value| value.as_sequence()).cloned(),
        Some(vec![serde_yaml::Value::from("111")])
    );
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].method, "log");
    assert_eq!(results[0].data.len(), 1);
    assert!(results[0].data[0].contains("\"rules\""));
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

    assert!(!err.to_string().is_empty());
}

#[test]
fn test_script_console_methods() {
    let script = r#"
    function main(config) {
      console.info({ foo: "bar" });
      console.error(["boom"]);
      console.debug(undefined);
      return config;
    }
  "#;

    let config = serde_yaml::from_str("proxies: []").unwrap();
    let (_, results) = use_script(script.into(), config).unwrap();

    assert_eq!(results.len(), 3);
    assert_eq!(results[0].method, "info");
    assert_eq!(results[0].data, vec![r#"{"foo":"bar"}"#.to_string()]);
    assert_eq!(results[1].method, "error");
    assert_eq!(results[1].data, vec![r#"["boom"]"#.to_string()]);
    assert_eq!(results[2].method, "debug");
    assert_eq!(results[2].data, vec!["undefined".to_string()]);
}
