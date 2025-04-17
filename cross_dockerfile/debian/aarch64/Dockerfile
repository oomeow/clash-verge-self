FROM debian:trixie

RUN rm -f /etc/apt/sources.list.d/debian.sources && \
  rm -f /etc/apt/sources.list && \
  echo "deb http://deb.debian.org/debian/ trixie main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list && \
  echo "deb http://deb.debian.org/debian/ trixie-updates main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list && \
  echo "deb http://deb.debian.org/debian/ trixie-backports main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list && \
  echo "deb http://deb.debian.org/debian-security/ trixie-security main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list

RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  gcc-multilib g++-multilib \
  gcc-arm-linux-gnueabihf binutils-arm-linux-gnueabihf \
  ca-certificates curl wget gnupg build-essential pkg-config file && \
  rm -rf /var/lib/apt/lists/*

RUN dpkg --add-architecture arm64 && \
  apt-get update && \
  apt-get install -y --no-install-recommends \
  libgtk-3-dev:arm64 \
  libwebkit2gtk-4.1-dev:arm64 \
  libayatana-appindicator3-dev:arm64 \
  librsvg2-dev:arm64 \
  patchelf:arm64

# Install Rust
RUN curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add aarch64-unknown-linux-gnu
ENV CARGO_TARGET_AARCH64_UNKNOWN_LINUX_GNU_LINKER=aarch64-linux-gnu-gcc \
  CC_aarch64_unknown_linux_gnu=aarch64-linux-gnu-gcc \
  CXX_aarch64_unknown_linux_gnu=aarch64-linux-gnu-g++ \
  PKG_CONFIG_PATH=/usr/lib/aarch64-linux-gnu/pkgconfig:$PKG_CONFIG_PATH \
  PKG_CONFIG_ALLOW_CROSS=1

WORKDIR /app
