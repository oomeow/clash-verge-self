# FROM rust:latest@sha256:33a0ea4769482be860174e1139c457bdcb2a236a988580a28c3a48824cbc17d6
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod a+x /entrypoint.sh
# ENTRYPOINT ["/entrypoint.sh"] 

FROM debian:trixie@sha256:ad1a494fd8dac6ff85bbc76e03edf98b3064a096bf79f641f91316e28d478f2d
ENV DEBIAN_FRONTEND=noninteractive

# change the sources list and install dependencies
RUN rm -f /etc/apt/sources.list.d/debian.sources && \
    rm -f /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian/ trixie main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian/ trixie-updates main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian/ trixie-backports main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list && \
    echo "deb http://deb.debian.org/debian-security/ trixie-security main contrib non-free non-free-firmware" | tee -a /etc/apt/sources.list
RUN apt-get update && \ 
    apt-get install -y --no-install-recommends ca-certificates curl wget gnupg build-essential pkg-config tar xz-utils && \ 
    rm -rf /var/lib/apt/lists/*

# script
COPY entrypoint.sh /entrypoint.sh
RUN chmod a+x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"] 