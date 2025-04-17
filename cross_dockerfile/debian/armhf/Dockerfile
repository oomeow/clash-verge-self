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
  gcc-arm-linux-gnueabihf binutils-arm-linux-gnueabihf gcc-14-arm-linux-gnueabihf \
  ca-certificates curl wget gnupg build-essential pkg-config file && \
  rm -rf /var/lib/apt/lists/*

RUN dpkg --add-architecture armhf && \
  apt-get update && \
  apt-get install -y --no-install-recommends \
  libgtk-3-dev:armhf \
  libwebkit2gtk-4.1-dev:armhf \
  libayatana-appindicator3-dev:armhf \
  librsvg2-dev:armhf \
  patchelf:armhf

# Install Rust
RUN curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable --profile minimal
ENV PATH="/root/.cargo/bin:${PATH}"
RUN rustup target add armv7-unknown-linux-gnueabihf
ENV CARGO_TARGET_ARMV7_UNKNOWN_LINUX_GNUEABIHF_LINKER=arm-linux-gnueabihf-gcc \
  CC_armv7_unknown_linux_gnueabihf=arm-linux-gnueabihf-gcc \
  CXX_armv7_unknown_linux_gnueabihf=arm-linux-gnueabihf-g++ \
  PKG_CONFIG_PATH=/usr/lib/arm-linux-gnueabihf/pkgconfig:$PKG_CONFIG_PATH \
  PKG_CONFIG_ALLOW_CROSS=1

WORKDIR /app
