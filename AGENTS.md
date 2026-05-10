<<<<<<< HEAD

# AGENTS.md

## Project Overview

**Clash Verge Self** is a Tauri v2 desktop GUI for [Mihomo](https://github.com/MetaCubeX/mihomo) (a proxy tool). It is a continuation of Clash Verge with custom features. This repo is a fork of Clash Verge Rev v1.6.0.

- **Frontend**: React 19 + TypeScript + Vite 8 + MUI 9 + TailwindCSS 4 + TanStack Router
- **Backend**: Rust (Tauri v2) with workspace crates
- **Package manager**: pnpm 11 (workspace-based)

### Project Structure

Frontend code lives in `src/`: routes in `src/routes`, page shells in `src/pages`, reusable UI in `src/components`, services in `src/services`, assets in `src/assets`, and translations in `src/locales`. Tauri code lives in `src-tauri`. Shared Rust crates are under `crates/`:

| Crate                    | Purpose                             |
| ------------------------ | ----------------------------------- |
| `tauri-plugin-mihomo`    | Tauri plugin for Mihomo integration |
| `mihomo-config`          | Mihomo configuration management     |
| `mihomo-rule-parser`     | Rule parsing utilities              |
| `process_supervisor`     | Process lifecycle management        |
| `clash-verge-self-utils` | Shared utility functions            |

Packaging files are in `scripts/` and `archbuild/`.

## Setup Commands

- Install all dependencies and prepare hooks: `pnpm i`
- Download/verify required Mihomo/Clash binaries: `pnpm check`
- Force update to latest binary: `pnpm check -- --force`
- Build mihomo-api workspace package: `pnpm build:mihomo-api`

### Prerequisites

- Rust toolchain (install via `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- Node.js (version 24 used in CI)
- pnpm 11: `npm i -g pnpm@11`
- Linux: GTK3, WebKit2GTK, and other system libraries (see CI workflow for details)

## Development Workflow

### Frontend

- Web-only dev server (no Tauri): `pnpm web:dev`
- Build frontend only: `pnpm web:build`
- Preview web build: `pnpm web:preview`
- Generate TanStack Router routes: `pnpm generate-routes`
- Watch routes: `pnpm watch-routes`

### Tauri Desktop

- Start Tauri dev server: `pnpm dev`
- Start second dev instance: `pnpm dev:diff`
- Production build: `pnpm build`

### Rust

- Check compilation: `cargo check`
- Run Clippy (strict): `cargo clippy --all-targets --all-features --tests --benches -- -D warnings`
- Auto-fix Clippy: `cargo clippy --fix --allow-dirty`
- Format (nightly): `cargo +nightly fmt`
- Build a specific crate: `cargo build -p <crate-name>`

### Utility

- `just clippy` / `just fmt`: strict Rust linting and formatting via justfile
- `pnpm lint` / `pnpm lint:fix`: ESLint check/fix (zero warnings required)
- Run scripts via tsx: `pnpm <script>`

## Testing Instructions

Rust integration tests live in crate-local `tests/` directories (e.g., `crates/tauri-plugin-mihomo/tests/*_test.rs`). There are no frontend test suites configured.

- Run all Rust tests: `cargo test --workspace`
- Test a specific crate: `cargo test -p <crate-name>`
- Run a specific test by name: `cargo test <test_name>`
- Broad backend changes: run `cargo test --workspace`
- Targeted crate changes: run `cargo test -p <crate>`

For frontend changes, at minimum verify with `pnpm web:build` and `pnpm lint`.

## Code Style

### TypeScript / React

- React function components with hooks
- Prettier: 2 spaces, semicolons, double quotes, LF endings, Tailwind class sorting
- ESLint: enforces React hooks rules, sorted imports/exports, unused-variable checks
- Path alias: `@/*` maps to `./src/*`
- Prefix intentionally unused bindings with `_`
- Follow existing local patterns before adding abstractions
- State management: Zustand
- Routing: TanStack Router

### Rust

- Edition 2024
- `rustfmt` (nightly): 4 spaces, 120-column width
- Naming: `snake_case` for modules/functions, `CamelCase` for types
- Error handling: `anyhow` for application code, `thiserror` for library crates
- Linting: Clippy with `-D warnings` in CI

## Build and Deployment

- Production desktop build: `pnpm build`
- Cross-compilation: `cd archbuild/local_build && ./build.sh`
- Container builds: CI workflow at `.github/workflows/build-and-push-container.yaml`
- Alpha builds: CI at `.github/workflows/alpha.yml`
- Release builds: CI at `.github/workflows/release.yml`
- Updater builds: CI at `.github/workflows/updater.yml`
- Rust cache is used in CI; `CARGO_INCREMENTAL=0` is set

### CI

| Workflow                        | Trigger         | Action                                       |
| ------------------------------- | --------------- | -------------------------------------------- |
| `pr-check.yml`                  | Pull requests   | Lint + build                                 |
| `test.yml`                      | Manual dispatch | Cross-platform build (Windows, macOS, Linux) |
| `release.yml`                   | Release         | Production build + release                   |
| `updater.yml`                   | Updater         | Build for auto-update                        |
| `alpha.yml`                     | Alpha           | Pre-release builds                           |
| `build-and-push-container.yaml` | Container       | Docker image build                           |

## Pull Request Guidelines

- Recent history follows Conventional Commits: `refactor(sticky-virtual-list): ...`, `chore(deps): ...`, `fix(logs): ...`
- Keep commit subjects scoped and imperative
- PR checks must pass (lint + build from `pr-check.yml`)
- Run `pnpm lint` and `cargo clippy` before submitting
- Frontend changes: verify with `pnpm web:build`
- Rust changes: verify with `cargo check`
- PRs should include a concise summary, changed areas, validation commands, linked issues when applicable, and screenshots/recordings for visible UI changes

# Repository Guidelines

## Project Structure & Module Organization

This repository is a Tauri desktop app with a React/Vite frontend and a Rust workspace backend. Frontend code lives in `src/`: routes in `src/routes`, page shells in `src/pages`, reusable UI in `src/components`, services in `src/services`, assets in `src/assets`, and translations in `src/locales`. Tauri code lives in `src-tauri`. Shared Rust crates are under `crates/`, including `tauri-plugin-mihomo`, `mihomo-config`, and `mihomo-rule-parser`. Packaging files are in `scripts/` and `archbuild/`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies and prepare hooks.
- `pnpm check`: download or verify required Mihomo/Clash binaries.
- `pnpm dev`: run the full Tauri app with `src-tauri/tauri.conf-dev.json`.
- `pnpm dev:diff`: run a second development instance.
- `pnpm web:dev`: run only the Vite frontend.
- `pnpm build`: build the full desktop application.
- `pnpm web:build`: type-check and build the frontend.
- `pnpm lint` / `pnpm lint:fix`: check or automatically fix ESLint issues.
- `cargo check`: verify Rust workspace compilation.
- `cargo test --workspace`: run all Rust tests.
- `just clippy` and `just fmt`: run strict Rust linting and formatting tasks.

## Coding Style & Naming Conventions

Use TypeScript, React function components, and existing local patterns before adding abstractions. Prettier uses 2 spaces, semicolons, double quotes, LF endings, and Tailwind class sorting. ESLint enforces React hooks rules, sorted imports/exports, and unused-variable checks; prefix intentionally unused bindings with `_`. Rust uses edition 2024 and `rustfmt` with 4 spaces and a 120-column width. Use `snake_case` for Rust modules/functions and `PascalCase` for React components.

## Testing Guidelines

Rust integration tests live in crate-local `tests/` directories, for example `crates/tauri-plugin-mihomo/tests/*_test.rs`. Add focused tests near the crate being changed. Run `cargo test --workspace` before broad backend changes, or `cargo test -p <crate>` for targeted loops. Frontend changes should pass at least `pnpm web:build` and `pnpm lint`.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, such as `refactor(sticky-virtual-list): ...` and `chore(deps): ...`. Keep commit subjects scoped and imperative. Pull requests should include a concise summary, changed areas, validation commands, linked issues when applicable, and screenshots or recordings for visible UI changes.

## Agent-Specific Instructions

This project is indexed by GitNexus as `clash-verge-self`. Before editing any function, class, or method, run upstream impact analysis for that symbol and report direct callers, affected flows, and risk. Warn before editing HIGH or CRITICAL risk symbols. Before committing, run GitNexus change detection to confirm the affected scope.

> > > > > > > origin/dev

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

<<<<<<< HEAD
This project is indexed by GitNexus as **clash-verge-self** (5955 symbols, 10603 relationships, 297 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.
=======
This project is indexed by GitNexus as **clash-verge-self** (5898 symbols, 10436 relationships, 291 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> > > > > > > origin/dev

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
