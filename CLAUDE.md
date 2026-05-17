# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Clash Verge Self** — A [Tauri v2](https://v2.tauri.app/) desktop GUI for [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta) proxy client. Forked from Clash Verge Rev v1.6.0.

- **Frontend**: React 19 + TypeScript + Vite 8 + MUI 9 + TailwindCSS 4 + TanStack Router + Zustand + SWR
- **Backend**: Rust (Tauri v2, Edition 2024) with Cargo workspace
- **Package manager**: pnpm 11 (workspace, stores in `.pnpm-store/`)

## Architecture

### Frontend (`src/`)

| Directory         | Purpose                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/`     | TanStack Router route definitions (file-based via `tsr generate`)                                                              |
| `src/pages/`      | Page-level components (each route has a page shell)                                                                            |
| `src/components/` | Reusable UI: `base/` (shared primitives), `profile/`, `proxy/`, `setting/`, `connection/`, `log/`, `rule/`, `test/`, `layout/` |
| `src/services/`   | API layer (`api.ts`), SWR config (`swr.ts`), WebSocket (`managedMihomoWs.ts`), Tauri commands (`cmds.ts`)                      |
| `src/stores/`     | Zustand stores (verge, profiles, connections, theme, proxyHeadState, etc.)                                                     |
| `src/hooks/`      | Custom React hooks (clash data, traffic, hotkeys, window size, etc.)                                                           |
| `src/locales/`    | i18n translations (en, zh_CN, ru, fa)                                                                                          |

Routes: `connections`, `proxies`, `profiles`, `settings`, `logs`, `rules`, `test` — each with a corresponding file in `routes/` and `pages/`.

### Rust Backend (`src-tauri/` + `crates/`)

**Tauri app** (`src-tauri/`):

- `core/` — App services: handle, manager, timer, tray, backup, sysopt, hotkey, logger
- `cmds/` — Tauri IPC commands: profile, verge, clash, service, backup, common, mihomo_ws
- `config/` — Configuration management
- `shutdown/` — Graceful shutdown logic
- `enhance/` — Enhancement scripts (JS/YAML profile enrichment)

**Workspace crates** (`crates/`):

| Crate                      | Role                                                                            |
| -------------------------- | ------------------------------------------------------------------------------- |
| `tauri-plugin-mihomo`      | Tauri plugin wrapping the Mihomo REST API (commands, models, SSE stream)        |
| `mihomo-config`            | Mihomo configuration generation and management (`crates/mihomo-config/config/`) |
| `mihomo-rule-parser`       | Rule parsing (domain, IP CIDR, bitmap)                                          |
| `process_supervisor`       | Mihomo core process lifecycle (spawn, monitor, restart)                         |
| `clash-verge-self-service` | Standalone sidecar binary that manages the Mihomo core process                  |
| `clash-verge-self-utils`   | Shared utility functions                                                        |

### Data Flow

```
User UI (React) → Tauri IPC commands (cmds/) → Core services (core/) → Mihomo REST API (tauri-plugin-mihomo)
                                                      ↘ Sidecar service (clash-verge-self-service) → Mihomo core
```

Realtime data (connections, logs, traffic) flows through WebSocket via `managedMihomoWs.ts` → `core/handle.rs`.

## Development Commands

```shell
pnpm i             # Install deps + precommit hooks
pnpm check         # Download Mihomo/core binaries (--force, --alpha, --target)
pnpm dev           # Start Tauri dev server (uses tauri.conf-dev.json)
pnpm dev:diff      # Run second dev instance alongside existing app
pnpm web:dev       # Vite-only dev server (no Tauri)
pnpm web:build     # Type-check + Vite build
pnpm build         # Production Tauri build
pnpm lint          # ESLint (zero warnings required)
```

```shell
cargo check                         # Check Rust compilation
cargo clippy --all-targets --all-features --tests --benches -- -D warnings
cargo +nightly fmt                  # Rust formatting (nightly)
cargo test --workspace              # All Rust tests
cargo test -p <crate> <test_name>   # Specific crate/test
just clippy / just fmt              # Via justfile
```

## Code Conventions

- **Commits**: Conventional Commits (`feat(profile): ...`, `fix(logs): ...`, `refactor(proxy): ...`)
- **TypeScript**: React FC + hooks, double quotes, semicolons, LF, Tailwind class sorting (prettier-plugin-tailwindcss)
- **Rust**: Edition 2024, 4-space indent, 120-column width, `anyhow` for app code, `thiserror` for libraries
- **State**: Zustand stores for global state, SWR for server data, React hook form for forms
- **Aliases**: `@/*` → `./src/*`
- **PRs**: Target `dev` branch, include screenshots for UI changes, PR checks must pass

## Key Notes

- `CI` runs `cargo clippy` with `-D warnings`, so fix all Clippy issues
- `pnpm lint` enforces zero ESLint warnings — run `pnpm lint:fix` to auto-fix
- Cross-compilation via `archbuild/local_build/build.sh`
- Multiple Tauri configs: `tauri.conf.json`, `tauri.conf-dev.json`, `tauri.conf-local.json`, `tauri.conf-pr.json`
- TanStack Router routes are generated; after adding routes run `pnpm generate-routes`

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **clash-verge-self** (6349 symbols, 11352 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

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
