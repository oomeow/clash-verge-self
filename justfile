set windows-shell := ["nu", "-c"]

# default:
#     @just --choose

# check
check:
  cargo check

# clippy
clippy:
  cargo clippy --all-targets --all-features --tests --benches -- -D warnings

# fmt
fmt:
    cargo +nightly fmt
