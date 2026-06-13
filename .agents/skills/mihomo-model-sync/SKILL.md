---
name: mihomo-model-sync
description: Synchronize Rust Mihomo API model structs and enums with the MetaCubeX/mihomo Alpha branch, including field drift checks and upstream code-location annotations. Manual trigger only: use this skill only when the user explicitly asks to "同步mihomo结构体", "同步 mihomo 结构体", "同步 mihomo 模型", or explicitly names `mihomo-model-sync`. Do not auto-trigger for generic Rust model edits, comment refreshes, or routine `models.rs` maintenance.
---

# Mihomo Model Sync

Use this skill only on explicit user request when `crates/tauri-plugin-mihomo/src/models.rs` needs to match `https://github.com/MetaCubeX/mihomo/tree/Alpha`.

## Quick start

1. Identify the local Rust model being changed.
2. Run GitNexus upstream impact for each edited symbol in `models.rs`.
3. Find the Mihomo Alpha source of truth:
   - config models: `config/config.go`, `listener/config/*.go`
   - enum definitions: `constant/*.go`, `constant/provider/interface.go`, `component/process/find_process_mode.go`, `log/level.go`, `tunnel/mode.go`
   - route response wrappers: `hub/route/*.go`
   - runtime response structs: `adapter/*.go`, `adapter/provider/*.go`, `rules/provider/*.go`, `tunnel/statistic/*.go`
4. Compare fields and enum variants one by one.
5. Update Rust types and add/refresh code-location comments above each synced struct/enum.
6. Run focused tests and GitNexus change detection.

## Source mapping rules

- Prefer the exact Go struct or enum definition when one exists.
- If the JSON shape is assembled by a route wrapper, annotate the wrapper location instead of a lower-level interface.
- If a Rust type is local-only and has no Mihomo counterpart, say so in a short comment instead of attaching a false upstream link.
- When a Rust type merges multiple Mihomo sources, add multiple links, one per source block.

## Annotation format

Use plain line comments immediately above the target item:

```rust
// https://github.com/MetaCubeX/mihomo/blob/Alpha/path/to/file.go#L10-L25
pub struct Example { ... }
```

For multi-source models:

```rust
// https://github.com/MetaCubeX/mihomo/blob/Alpha/config/config.go#L47-L70
// https://github.com/MetaCubeX/mihomo/blob/Alpha/listener/config/tun.go#L11-L65
pub struct Example { ... }
```

For local-only helpers:

```rust
// Local plugin transport selector. No direct Mihomo model.
pub enum Protocol { ... }
```

## Field sync checklist

- Added upstream fields present locally?
- Removed upstream fields deleted locally?
- Optional vs required aligned?
- Scalar type width aligned enough for JSON payloads?
- Collection shape aligned?
- Renames handled with `serde(rename = ...)`?
- Response wrapper fields included when route output differs from core struct?
- Unknown enum fallback still preserved with `#[serde(other)]` where needed?

## Validation

- Run focused tests for model deserialization.
- If tests do not cover the changed model, add targeted JSON decode tests using Alpha-shaped payloads.
- Run GitNexus `detect_changes` before finishing.

## Do not do

- Do not guess upstream fields from docs when code is available.
- Do not attach Mihomo links to plugin-only websocket or connection-manager helper types.
- Do not silently change public model shapes without updating nearby tests.
