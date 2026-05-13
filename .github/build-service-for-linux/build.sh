#!/bin/bash
cargo build --package clash-verge-self-service --release --target $INPUT_TARGET --features $INPUT_FEATURES
