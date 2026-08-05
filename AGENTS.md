# AGENTS.md

## Project Overview

**Clash Verge Self** is a cross-platform desktop GUI for [Mihomo](https://github.com/MetaCubeX/mihomo) (Clash Meta), built with [Tauri 2](https://v2.tauri.app/). It is a personal fork of Clash Verge Rev (based on the 1.6.0 release), customized for personal feature needs. The app manages profiles, sets the system proxy, and drives the Mihomo core via a standalone sidecar service.

The codebase is a **Cargo workspace + pnpm workspace** monorepo:

| Layer           | Tech                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Desktop shell   | Tauri 2 (Rust) — `src-tauri/`                                                                     |
| Frontend        | React 19 + TypeScript + Vite 8 + MUI 9 + TailwindCSS 4 + Zustand + SWR + TanStack Router — `src/` |
| Sidecar service | Rust, standalone binary that manages the Mihomo core process — `crates/clash-verge-self-service/` |

License: GPL-3.0-only.

## Architecture

Cargo workspace members (see `Cargo.toml`):

| Crate                             | Description                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src-tauri`                       | Main Tauri application (binary + library)                                                                    |
| `crates/clash-verge-self-service` | Standalone sidecar binary managing the Mihomo core process                                                   |
| `crates/clash-verge-self-utils`   | Shared utility functions                                                                                     |
| `crates/mihomo-config`            | Mihomo configuration management                                                                              |
| `crates/mihomo-rule-parser`       | Rule parsing (domain, IP CIDR, bitmap)                                                                       |
| `crates/process_supervisor`       | Mihomo core process lifecycle management                                                                     |
| `crates/tauri-plugin-mihomo`      | Tauri plugin wrapping the Mihomo HTTP/WS API; ships TypeScript bindings in `guest-js/` → built to `dist-js/` |

Key frontend directories under `src/`: `components/`, `hooks/`, `pages/`, `routes/`, `services/`, `stores/`, `utils/`, `locales/`, `assets/`. Vite roots at `src/`, serves on **port 3000** (strict), builds to `src-tauri/frontend/dist`.

Tauri config: `src-tauri/tauri.conf.json` (prod), `tauri.conf-dev.json` (`pnpm dev`), `tauri.conf-pr.json` (CI PR build), `tauri.conf-local.json`. The dev server runs via `beforeDevCommand: pnpm web:dev` and `devUrl: http://localhost:3000/`.

`src/routeTree.gen.ts` and `src-tauri/gen/` are **generated files** — do not hand-edit.

## Prerequisites

- Rust — pinned in `rust-toolchain.toml` (channel `1.97.1`; components `rustfmt`, `clippy`)
- Node.js >= 20 (CI uses 24)
- pnpm >= 9 (repo pins `pnpm@11.19.0` via `packageManager`)
- [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS (Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`)
- LLVM (Windows only)

## Setup Commands

```shell
pnpm i                 # Install JS deps (also installs git hooks via prek)
pnpm check             # Download Mihomo resources + sidecar service binaries; builds service locally
pnpm check --alpha --no-confirm   # Non-interactive, alpha channel (used in CI)
pnpm build:service     # Rebuild the Rust sidecar service binary after editing service code
```

`pnpm check` flags (see `scripts/check.ts`): `--force` re-download, `--alpha` alpha channel, `--target <triple>` target (e.g. `x86_64-unknown-linux-gnu`), `--no-confirm` skip prompts.

## Development Workflow

```shell
pnpm dev               # Start full Tauri dev app (runs `pnpm web:dev` + `tauri dev`)
pnpm dev:diff          # Run alongside an already-running instance (feature flag `verge-dev`)
pnpm web:dev           # Frontend-only Vite dev server on http://localhost:3000
pnpm web:build         # Type-check + build frontend to src-tauri/frontend/dist
```

- Vite requires port 3000; if occupied, `pnpm dev` fails (strictPort).
- Vite watches `src/` and ignores `src-tauri/**`.
- **After modifying the Rust service crate**, rebuild with `pnpm build:service` before `pnpm dev` so the sidecar is current.

## Testing

Rust unit/integration tests live alongside code (`#[cfg(test)]`) and in crate `tests/` dirs. Run them from the workspace root:

```shell
cargo test                          # all workspace tests
cargo test -p mihomo-rule-parser    # tests for one crate
cargo test -p tauri-plugin-mihomo   # includes the export_bindings test that regenerates guest-js types
```

Frontend does not have a JS test suite configured. The Rust tests are the primary automated check.

## Code Style & Lint

```shell
pnpm lint               # ESLint (scripts/, src/, vite.config.ts) — max-warnings 0
pnpm lint:fix           # auto-fix lint issues
cargo clippy --all-targets --all-features --tests --benches -- -D warnings   # Rust lint
cargo +nightly fmt      # Rust formatting (nightly toolchain required)
```

- ESLint enforces `simple-import-sort` (imports/exports must be sorted), react-hooks rules; `no-unused-vars` errors with `_` prefix to ignore.
- `@/*` aliases `src/` (TS + Vite). Path alias `@/` is the convention for imports.
- Prettier is used via `pretty-quick --staged` on commit (see `.pre-commit-config.yaml`).
- Pre-commit hooks (installed by `pnpm i`): trailing whitespace, mixed-line-ending, check-yaml/toml, end-of-file-fixer, `typos`, `pnpm lint`, pretty staged, `cargo +nightly fmt`, `cargo clippy -- -D warnings`. The pre-commit config **excludes** `.agents/*` and `.claude/*`.
- Rust workspace clippy lint: `redundant_clone = warn`. Rust edition is 2024.
- `rustfmt.toml` and `.editorconfig` define formatting; run `cargo +nightly fmt` (nightly, not the pinned stable) for Rust.
- `.typos.toml` configures the `typos` hook.

## Build & Deployment

```shell
pnpm build              # Production Tauri build (`tauri build`)
pnpm build --target <triple>   # Cross-compile for a target
pnpm build -c ./src-tauri/tauri.conf-pr.json  # CI-style build
pnpm portable           # Build a portable package (scripts/portable.ts)
pnpm arch-build         # Arch Linux package build (archbuild/local_build/build.sh)
pnpm build:mihomo-api   # Rebuild tauri-plugin-mihomo guest-js (cargo test export_bindings && rollup)
```

- Release profile (workspace `Cargo.toml`): `panic=abort`, `lto=true`, `codegen-units=1`, `opt-level=s`, `strip=true`.
- Bundles produced under `target/<triple>/release/bundle/` (`.dmg`, `.exe`, `.deb`).
- Cross-platform builds use `Cross.toml` + `cross_dockerfile/`.

CI/CD lives in `.github/workflows/`:

- `pr-check.yml` — runs on every PR: lint, frontend build, Rust clippy (backend-only), and Tauri build (bundle-only). Uses `--alpha --no-confirm`.
- `test.yml` — manual (workflow_dispatch) cross-platform build + Arch PKGBUILD check.
- `release.yml` — production release builds. `alpha.yml`, `service-alpha.yml`, `service-release.yml`, `build-dist-js.yml`, `updater.yml` — service/release/dist automation.

## Git & PR Guidelines

- Remotes: `origin` → `oomeow/clash-verge-self`, `upstream` → `clash-verge-rev/clash-verge-rev`. Base work on `dev`.
- Branch workflow: fork, create feature branch from `dev`, open PR against `dev`.
- Commit messages follow Conventional Commits style (see `git log`: `feat(scope):`, `fix:`, `chore(deps):`, `ci(action):`).
- **Before opening a PR**: `pnpm lint` and `cargo clippy` must pass. For UI changes, include screenshots in the PR description.

## Debugging & Troubleshooting

- **`pnpm dev` fails with port conflict**: port 3000 is strict. Stop the other process or use `pnpm dev:diff`.
- **Sidecar binary is stale**: rebuild it with `pnpm build:service` after any `crates/clash-verge-self-service` change.
- **`src/routeTree.gen.ts` or `src-tauri/gen/` changed unexpectedly**: these are generated. Use `pnpm generate-routes` (TanStack Router `tsr generate`) to regenerate the route tree; do not edit by hand.
- **Guest-js API types out of sync**: run `pnpm build:mihomo-api` (regenerates `dist-js/` from the Rust models).
- **Generated-file drift on commit**: CI `build-dist-js.yml` auto-commits `dist-js/`/`guest-js` changes back to `dev`.
- **Tauri signing in CI**: set `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`; service uses `CLASH_VERGE_SELF_SERVICE_PSK`. Never commit these secrets.
- Version bump: `pnpm bump` (runs `scripts/bump-version.ts`).

## Security Considerations

- Secrets are passed via CI env vars / GitHub secrets only — never hardcode keys, tokens, or the service PSK in source.
- Keep service authentication (`CLASH_VERGE_SELF_SERVICE_PSK`) out of logs and commits.
- Follow the existing permission model in `src-tauri/capabilities/` when adding Tauri commands; grant only the minimal permissions needed.

<!-- TRELLIS:START -->

# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:

- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **clash-verge-self** (5064 symbols, 10586 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
