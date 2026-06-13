---
name: mihomo-model-sync
description: Synchronize Rust Mihomo API model structs and enums with the MetaCubeX/mihomo Alpha branch, including field drift checks and upstream code-location annotations. Manual trigger only: use this skill only when the user explicitly asks to "同步mihomo结构体", "同步 mihomo 结构体", "同步 mihomo 模型", or explicitly names `mihomo-model-sync`. Do not auto-trigger for generic Rust model edits, comment refreshes, or routine `models.rs` maintenance.
---

# Mihomo Model Sync

Use this skill only on explicit user request when `crates/tauri-plugin-mihomo/src/models.rs` needs to match `https://github.com/MetaCubeX/mihomo/tree/Alpha`.

## Workflow

1. Read the local `models.rs` to understand current state.
2. Fetch upstream Go sources via WebFetch from raw GitHub URLs (base: `https://raw.githubusercontent.com/MetaCubeX/mihomo/Alpha/`).
3. Run GitNexus `impact` (upstream direction, summaryOnly) for each symbol being modified.
4. Compare field by field and apply changes.
5. Run `cargo check -p tauri-plugin-mihomo` and `cargo test -p tauri-plugin-mihomo --lib` to verify.
6. Run `pnpm build:mihomo-api` to regenerate TypeScript bindings.
7. Run GitNexus `detect_changes` before finishing.

## Upstream source locations

Use WebFetch with these raw GitHub paths to get the authoritative Go source:

| Model category | Upstream file(s) |
|---|---|
| General / BaseConfig | `config/config.go` (General + Inbound structs) |
| TUN config | `listener/config/tun.go` |
| TuicServer config | `listener/config/tuic.go` |
| MuxOption / BrutalOption | `listener/sing/sing.go` |
| ClashMode | `tunnel/mode.go` |
| TunStack | `constant/tun.go` |
| LogLevel | `log/level.go` |
| FindProcessMode | `component/process/find_process_mode.go` |
| ProxyType (AdapterType) | `constant/adapters.go` |
| Proxy MarshalJSON | `adapter/adapter.go` |
| Proxy group fields | `adapter/outboundgroup/selector.go`, `urltest.go`, `fallback.go`, `loadbalance.go` |
| ProxyProvider | `adapter/provider/provider.go` (providerForApi struct) |
| SubscriptionInfo | `adapter/provider/subscription_info.go` |
| RuleType | `constant/rule.go` |
| RuleProvider | `rules/provider/provider.go` (providerForApi struct) |
| RuleBehavior / RuleFormat | `constant/provider/interface.go` |
| ProviderType / VehicleType | `constant/provider/interface.go` |
| Connection / Tracker | `tunnel/statistic/tracker.go`, `tunnel/statistic/manager.go` (Snapshot struct) |
| Metadata / Network / Type | `constant/metadata.go` |
| DNSMode | `constant/dns.go` |
| Traffic / Memory / Log | `hub/route/server.go` |
| Version | `hub/route/server.go` (version handler) |
| CoreUpdaterChannel | `component/updater/update_core.go` |
| Groups route | `hub/route/groups.go` |
| Rules route | `hub/route/rules.go` |

## Key sync patterns

### Type mapping (Go → Rust)

| Go type | Rust type | Notes |
|---|---|---|
| `int` | `i32` | Go int is at least 32-bit |
| `int64` | `i64` or `u64` | Use unsigned for always-positive values (traffic, memory) |
| `uint64` | `u64` | |
| `uint32` | `u32` | |
| `uint16` | `u16` | |
| `bool` | `bool` | |
| `string` | `String` | |
| `[]string` | `Vec<String>` | |
| `map[string]T` | `HashMap<String, T>` | |
| `time.Time` | `String` | JSON serializes as RFC3339 string |
| `netip.Prefix` / `netip.Addr` | `String` | JSON serializes as string |
| `atomic.Int64` | `u64` or `i64` | Serializes as plain number |
| Field with `omitempty` | `Option<T>` with `#[serde(skip_serializing_if = "Option::is_none", default)]` | |
| Field without `omitempty` but can be absent | Add `#[serde(default)]` | When field might not be in response |

### JSON key mapping

- Upstream `MarshalJSON` with custom map: use `#[serde(rename = "...")]`
- Upstream kebab-case json tags: use `#[serde(rename_all(deserialize = "kebab-case"))]`
- Upstream camelCase json tags: use `#[serde(rename_all = "camelCase")]`
- PascalCase (no json tags, Go exported fields): use `#[serde(rename_all = "PascalCase")]`

### Enum serialization

- String-based enums from Go `String()` methods: variants serialize as the String() output
- Always include `#[serde(other)] Unknown` fallback for forward compatibility
- Use `#[serde(rename = "...")]` when variant name differs from serialized form

## Field sync checklist

- [ ] Added upstream fields present locally?
- [ ] Removed upstream fields deleted locally?
- [ ] Optional vs required aligned with `omitempty`?
- [ ] Scalar type width sufficient? (especially `int` → `i32` not `i8`)
- [ ] Collection shape aligned?
- [ ] Renames handled with `serde(rename = ...)`?
- [ ] Response wrapper fields included when route MarshalJSON differs from core struct?
- [ ] Unknown enum fallback preserved with `#[serde(other)]`?
- [ ] New enum variants from upstream added?
- [ ] Source annotations (`// https://github.com/...#L-L`) still point to correct lines?

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

## Annotation verification (MANDATORY)

Every sync run MUST verify that all `#L-L` line annotations still point to the correct code location in upstream. Line numbers drift as upstream evolves.

**How to verify:**
1. For each struct/enum in `models.rs` that has a `// https://github.com/...#Lx-Ly` comment, fetch the upstream file via WebFetch.
2. Locate the actual struct/enum/const block in the fetched source.
3. If the line range in the annotation no longer matches the actual position, update the `#Lx-Ly` suffix to reflect the current lines.
4. If the file path itself has changed (renamed/moved), update the full URL.

**When to skip:** Only skip verification for annotations you just created in this sync run (they are already correct by definition).

## Validation steps

1. `cargo check -p tauri-plugin-mihomo` — must compile
2. `cargo clippy -p tauri-plugin-mihomo -- -D warnings` — no warnings
3. `pnpm build:mihomo-api` — regenerate TS bindings (runs `cargo test export_bindings && rollup -c`)
4. `gitnexus detect_changes` — verify only expected symbols affected

## Do not do

- Do not guess upstream fields from docs when code is available via WebFetch.
- Do not attach Mihomo links to plugin-only websocket or connection-manager helper types.
- Do not silently change public model shapes without verifying tests still pass.
- Do not use `i8` for Go `int` fields — use `i32` minimum.
- Do not make fields required when upstream uses `omitempty`.
- Do not skip `pnpm build:mihomo-api` after model changes.
