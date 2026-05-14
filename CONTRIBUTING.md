# Contributing to Clash Verge Self

Thank you for your interest in contributing!

## Prerequisites

- [Rust](https://rustup.rs/) (latest)
- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/installation) >= 9
- [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/)

## Setup

```shell
git clone https://github.com/oomeow/clash-verge-self.git
cd clash-verge-self

pnpm i                          # Install dependencies (also installs prek git hooks)
pnpm check                      # Download resources; locally also builds service binary
                                #   --force      Force re-download
                                #   --alpha      Download alpha channel service
                                #   --target     Specify target triple (e.g. x86_64-unknown-linux-gnu)
                                #   --no-confirm Skip confirmation prompt
pnpm build:service              # Rebuild service binary after modifying service code
pnpm dev                        # Start development server
```

If an app instance is already running, use `pnpm dev:diff` to run alongside it.

### Lint & Format

```shell
pnpm lint                       # ESLint
cargo clippy --all-targets --all-features --tests --benches -- -D warnings
cargo +nightly fmt              # Rust formatting (nightly required)
```

### Build

```shell
pnpm build                      # Production build
pnpm portable                   # Portable package
```

## Project Architecture

The project is a Cargo workspace with these crates:

| Crate                             | Description                                                 |
| --------------------------------- | ----------------------------------------------------------- |
| `src-tauri`                       | Main Tauri application (binary + library)                   |
| `crates/clash-verge-self-service` | Standalone sidecar service managing the Mihomo core process |
| `crates/clash-verge-self-utils`   | Shared utility functions                                    |
| `crates/mihomo-config`            | Mihomo configuration management                             |
| `crates/mihomo-rule-parser`       | Rule parsing (domain, IP CIDR, bitmap)                      |
| `crates/process_supervisor`       | Mihomo core process lifecycle management                    |
| `crates/tauri-plugin-mihomo`      | Tauri plugin for Mihomo API integration                     |

Frontend: React 19 + TypeScript + Vite + MUI 9 + TailwindCSS 4 + Zustand + SWR + TanStack Router.

## Contributing

1. Fork the repo and create a feature branch from `dev`.
2. Make your changes, following existing code style.
3. Run lint checks (`pnpm lint`, `cargo clippy`).
4. Open a pull request against the `dev` branch with a clear description of changes.

For UI changes, include screenshots in the PR description.
