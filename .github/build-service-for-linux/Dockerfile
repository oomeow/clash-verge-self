FROM rust:bookworm
COPY entrypoint.sh /entrypoint.sh
RUN chmod a+x /entrypoint.sh

# 确保使用最新的 stable 版本
RUN rustup default stable && rustup update

ENTRYPOINT ["/entrypoint.sh"]
