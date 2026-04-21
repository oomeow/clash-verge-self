set windows-shell := ["nu", "-c"]

# default:
#     @just --choose

# check
check:
    cargo check

# clippy
clippy:
    cargo clippy --all-targets --all-features --tests --benches -- -D warnings

# clippy fix
fix:
    cargo clippy --fix --allow-dirty

# fmt
fmt:
    cargo +nightly fmt
    pnpm lint:fix
