# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clash Verge Self** is a [Tauri v2](https://v2.tauri.app/) desktop GUI for the [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta) proxy core. It is a fork of Clash Verge Rev v1.6.0 with custom features, and supports the Mihomo core only.

- **Frontend**: React 19 + TypeScript + Vite 8 + MUI 9 + TailwindCSS 4 + TanStack Router + Zustand + SWR
- **Backend**: Rust (Tauri v2, Edition 2024), a Cargo workspace with `src-tauri` as the app and several supporting crates
- **Package manager**: pnpm 11 (workspace; store in `.pnpm-store/`)

## Common Commands

```shell
pnpm i                # Install JS deps + install prek git hooks
pnpm check            # Download Mihomo core binaries; locally also builds the service sidecar
                      #   flags: --force  --alpha  --target <triple>  --no-confirm
pnpm dev              # Run the Tauri app in dev (uses src-tauri/tauri.conf-dev.json)
pnpm dev:diff         # Run a SECOND dev instance (verge-dev feature) alongside a running app
pnpm build            # Production desktop build
pnpm build:service    # Rebuild only the sidecar service binary after editing service code
pnpm web:dev          # Vite-only frontend dev server (no Tauri), port 3000
pnpm web:build        # Type-check (tsc) + Vite build
pnpm generate-routes  # Regenerate TanStack Router route tree (routeTree.gen.ts)
```

Lint / format:

```shell
pnpm lint             # ESLint, zero warnings enforced (--max-warnings=0)
pnpm lint:fix         # ESLint auto-fix
cargo clippy --all-targets --all-features --tests --benches -- -D warnings
cargo +nightly fmt    # Rust formatting REQUIRES the nightly toolchain
just clippy           # = the clippy line above
just fix              # cargo clippy --fix --allow-dirty
just fmt              # cargo +nightly fmt && pnpm lint:fix
```

Tests (Rust only — there is no frontend test suite):

```shell
cargo test --workspace            # All Rust tests
cargo test -p <crate>             # One crate
cargo test -p <crate> <test_name> # One test by name
```

Integration tests live in crate-local `tests/` dirs (e.g. `crates/tauri-plugin-mihomo/tests/`). For frontend changes, verify with `pnpm web:build` + `pnpm lint`. CI (`pr-check.yml`) runs lint + build with `-D warnings`, so resolve every Clippy/ESLint issue before pushing.

## Architecture

### The core idea

The app does not talk to the Mihomo core over its default HTTP RESTful API. Instead a **sidecar service** (`clash-verge-self-service`) supervises the Mihomo process, and the app communicates with Mihomo through a **local socket / named pipe** via the `tauri-plugin-mihomo` plugin. The socket path is defined in `src-tauri/src/lib.rs` (`MIHOMO_SOCKET_PATH`) and differs for the `verge-dev` feature so two instances can coexist.

```
React UI ──invoke──▶ Tauri IPC cmds (src-tauri/src/cmds) ──▶ core services (src-tauri/src/core)
                                                                    │
                          tauri-plugin-mihomo (LocalSocket) ───────┤
                                                                    ▼
                          process_supervisor / sidecar service ──▶ Mihomo core process

Realtime data (traffic, memory, connections, logs) is streamed over WebSocket:
  managedMihomoWs.ts ──▶ cmds/mihomo_ws.rs ──▶ core/handle.rs (Mihomo SSE/WS stream)
```

### Rust app (`src-tauri/src/`)

- `cmds/` — Tauri IPC command handlers, grouped by domain: `common`, `clash`, `verge`, `profile`, `service`, `backup`, `mihomo_ws`. All handlers are registered in the `invoke_handler!` list in `lib.rs`; **adding a command means adding it there too.**
- `core/` — long-lived app services: `handle` (Mihomo client + event emit), `manager`, `core` (core lifecycle), `timer`, `tray`, `sysopt` (system proxy), `hotkey`, `backup`, `logger`/`verge_log`, and `service/` (sidecar install/messaging).
- `config/` — config models and management: `clash`, `verge`, `profiles`, `prfitem`, `runtime`, plus `draft.rs` (a draft/commit wrapper used for editable config).
- `enhance/` — profile enrichment pipeline: `chain`, `merge`, `script` (JS), `field`, `tun`, and `builtin/`.
- `utils/` — `dirs`, `init`, `resolve` (window/deep-link/startup), `server`, `crypto`, `tmpl`, `help`, `unix_helper`.
- `feat.rs` — high-level feature actions invoked from tray/hotkeys/commands.
- `shutdown/` — graceful shutdown (Unix-specific bits in `unix.rs`).

### Workspace crates (`crates/`)

| Crate                      | Role                                                                                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tauri-plugin-mihomo`      | Tauri plugin wrapping Mihomo access (`commands`, `mihomo`, `models`, `stream`). Has a JS API package `tauri-plugin-mihomo-api` (`guest-js/` → `dist-js/`), built via `pnpm build:mihomo-api`. |
| `mihomo-config`            | Mihomo configuration generation/management (templates under `config/`)                                                                                                                        |
| `mihomo-rule-parser`       | Rule parsing (domain, IP CIDR, bitmap)                                                                                                                                                        |
| `process_supervisor`       | Mihomo core process lifecycle (spawn, monitor, restart)                                                                                                                                       |
| `clash-verge-self-service` | Standalone sidecar binary supervising the Mihomo core (`bin/`, `service/`)                                                                                                                    |
| `clash-verge-self-utils`   | Shared utilities                                                                                                                                                                              |

The workspace `default-members` is `src-tauri`, so a bare `cargo check`/`cargo build` targets the app. Use `-p <crate>` to scope to one crate. `tauri-plugin-mihomo-api` is consumed by the frontend as `workspace:*`.

### Frontend (`src/`)

- `routes/` — file-based TanStack Router definitions (`autoCodeSplitting` on); generated output is `routeTree.gen.ts` (do not hand-edit). Routes: `connections`, `proxies`, `profiles`, `settings`, `logs`, `rules`, `test`.
- `pages/` — page shells rendered by routes; `_layout.tsx` and `_theme.tsx` wrap the app.
- `components/` — UI by domain: `base/` (shared primitives), `profile/`, `proxy/`, `setting/`, `connection/`, `log/`, `rule/`, `test/`, `layout/`.
- `services/` — `cmds.ts` (typed Tauri command wrappers), `api.ts`, `swr.ts` (SWR config), `managedMihomoWs.ts` (WebSocket manager), `monaco.ts`, `i18n.ts`, `types.d.ts`.
- `stores/` — Zustand stores (`vergeStore`, `profilesStore`, `connectionsStore`, `themeStore`, `clashLogStore`, `proxyHeadStateStore`, `rulesStateStore`, `windowSizeStore`, etc.).
- `hooks/` — data/runtime hooks (`use-clash`, `use-traffic-data`, `use-connection-data`, `use-log-data`, `use-memory-data`, `use-app-hotkeys`, `use-service`, `use-window-size`, …).
- `locales/` — i18n JSON (`en`, `zh_CN`, `ru`, `fa`). Rust side also has its own `locales/` via `rust_i18n`.

Vite serves from `root: "src"` on port 3000 and builds into `src-tauri/frontend/dist`. Path alias `@/*` → `./src/*`. Monaco editor (with YAML worker) and legacy/polyfill plugins are configured in `vite.config.ts`.

## Conventions

- **Commits**: Conventional Commits with scope, e.g. `feat(profile): ...`, `fix(logs): ...`, `refactor(proxy): ...`, `chore(deps): ...`.
- **PRs target the `dev` branch.** Include screenshots/recordings for visible UI changes.
- **TypeScript**: React function components + hooks. Prettier — 2-space indent, double quotes, semicolons, LF, `bracketSameLine`, Tailwind class sorting. ESLint enforces `simple-import-sort` (imports & exports) and `no-unused-vars` (prefix intentionally-unused bindings with `_`); `no-explicit-any` is off.
- **Rust**: Edition 2024, rustfmt 4-space / 120-col (nightly), `snake_case` modules/functions, `PascalCase` types. `anyhow` for app code, `thiserror` for library crates. Workspace lint `clippy::redundant_clone = warn`.
- **Release profile** (`Cargo.toml`): `panic = "abort"`, `lto = true`, `opt-level = "s"`, `strip = true` — keep this in mind when adding panic-dependent code.

## Notes & Gotchas

- Multiple Tauri configs exist: `tauri.conf.json` (base), `tauri.conf-dev.json` (dev), `tauri.conf-local.json`, `tauri.conf-pr.json`. `pnpm dev` selects the dev config explicitly.
- `pnpm dev` / `pnpm dev:diff` run `scripts/check_build_service.ts` first to ensure the sidecar binary exists before launching.
- The app handles the `clash://` deep-link protocol (single-instance aware) — see the `single_instance` and `deep_link` setup in `lib.rs`.
- Sidecar binaries are bundled as `sidecar/self-mihomo` and `sidecar/self-mihomo-alpha` (see `bundle.externalBin` in `tauri.conf.json`).
- Cross-compilation: `pnpm arch-build` → `archbuild/local_build/build.sh` (also see `Cross.toml`).

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **clash-verge-self** (5053 symbols, 10613 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "dev"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource                                          | Use for                                  |
| ------------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/clash-verge-self/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/clash-verge-self/clusters`       | All functional areas                     |
| `gitnexus://repo/clash-verge-self/processes`      | All execution flows                      |
| `gitnexus://repo/clash-verge-self/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->
