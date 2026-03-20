set windows-shell := ["nu", "-c"]

default:
    @just --choose

# check
check: check-src-tauri

# check crates
check-crates: check-mihomo-config check-mihomo-rule-parser check-tauri-plugin-mihomo

# check all
check-all: check-src-tauri check-crates

[private]
check-src-tauri:
    cargo check --manifest-path ./src-tauri/Cargo.toml

[private]
check-mihomo-config:
    cargo check --manifest-path ./crates/mihomo-config/Cargo.toml

[private]
check-mihomo-rule-parser:
    cargo check --manifest-path ./crates/mihomo-rule-parser/Cargo.toml

[private]
check-tauri-plugin-mihomo:
    cargo check --manifest-path ./crates/tauri-plugin-mihomo/Cargo.toml

# clippy
clippy: clippy-src-tauri

# clippy crates
clippy-crates: clippy-mihomo-config clippy-mihomo-rule-parser clippy-tauri-plugin-mihomo

# clippy all
clippy-all: clippy-src-tauri clippy-crates

[private]
clippy-src-tauri:
    cargo +nightly clippy --manifest-path ./src-tauri/Cargo.toml

[private]
clippy-mihomo-config:
    cargo +nightly clippy --manifest-path ./crates/mihomo-config/Cargo.toml

[private]
clippy-mihomo-rule-parser:
    cargo +nightly clippy --manifest-path ./crates/mihomo-rule-parser/Cargo.toml

[private]
clippy-tauri-plugin-mihomo:
    cargo +nightly clippy --manifest-path ./crates/tauri-plugin-mihomo/Cargo.toml

# fmt
fmt: fmt-src-tauri

# fmt crates
fmt-crates: fmt-mihomo-config fmt-mihomo-rule-parser fmt-tauri-plugin-mihomo

# fmt all
fmt-all: fmt-src-tauri fmt-crates

[private]
fmt-src-tauri:
    cargo +nightly fmt --manifest-path ./src-tauri/Cargo.toml

[private]
fmt-mihomo-config:
    cargo +nightly fmt --manifest-path ./crates/mihomo-config/Cargo.toml

[private]
fmt-mihomo-rule-parser:
    cargo +nightly fmt --manifest-path ./crates/mihomo-rule-parser/Cargo.toml

[private]
fmt-tauri-plugin-mihomo:
    cargo +nightly fmt --manifest-path ./crates/tauri-plugin-mihomo/Cargo.toml

# clean
clean: clean-src-tauri

# clean crates
clean-crates: clean-mihomo-config clean-mihomo-rule-parser clean-tauri-plugin-mihomo

# clean all
clean-all: clean-src-tauri clean-crates

[private]
clean-src-tauri:
    cargo clean --manifest-path ./src-tauri/Cargo.toml

[private]
clean-mihomo-config:
    cargo clean --manifest-path ./crates/mihomo-config/Cargo.toml

[private]
clean-mihomo-rule-parser:
    cargo clean --manifest-path ./crates/mihomo-rule-parser/Cargo.toml

[private]
clean-tauri-plugin-mihomo:
    cargo clean --manifest-path ./crates/tauri-plugin-mihomo/Cargo.toml
