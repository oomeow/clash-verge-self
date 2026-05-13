# Clash Verge Service

Supports multiple platforms Service.

### 命令示例

```shell
# 安装服务, `--server-id` 是指定 IPC 服务的 ID
clash-verge--self-service install [--log-dir 记录日志的目录] --server-id server-test

# 卸载服务
clash-verge-self-service uninstall [--log-dir 记录日志的目录]

# 直接运行 IPC 服务
clash-verge-self-service --server-id server-test
```

### 测试 IPC 服务 API 接口

有关的测试用例都在 `main.rs` 里的测试模块中了, 可自行测试
