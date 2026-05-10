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

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **clash-verge-self** (5898 symbols, 10436 relationships, 291 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
