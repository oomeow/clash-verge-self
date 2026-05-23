# Rust 后端内存泄露风险分析

## 结论

对 `src-tauri` 和 `crates/` 下全部 Rust 后端代码做了一轮以内存泄露为目标的静态扫描，重点检查了以下模式：

- 显式泄露：`Box::leak`、`mem::forget`、`ManuallyDrop`、`static mut`
- 长生命周期状态：`OnceCell`、`LazyLock`、`Arc<Mutex<_>>`、`Arc<RwLock<_>>`
- 异步生命周期：`tokio::spawn`、`JoinHandle`、`watch/mpsc/oneshot`
- 增长型容器：`HashMap`、`Vec`、`VecDeque`

本次没有发现典型的“Rust 语义层面显式泄露”代码，但发现了 2 个高价值风险点：

1. `tauri-plugin-mihomo` 的 WebSocket 读任务没有可控取消路径，连接从 manager 删除后，读任务仍可能永久阻塞在 `reader.next().await`，从而残留任务、socket 和 reader 状态。
2. `clash-verge-self-service` 对每个 IPC 客户端连接都 `tokio::spawn` 一个独立任务，但没有连接数上限、空闲超时或任务登记，恶意或异常客户端可让空闲连接长期堆积，造成内存和任务数持续增长。

另外还有 1 个次级风险：

- 日志 WebSocket 的启动缓冲 `Vec<Value>` 无上限，若日志突发很大且快照发送阶段阻塞，内存会短时间线性增长。

## 发现 1: Mihomo WebSocket 读任务无法被真正取消

### 位置

- [crates/tauri-plugin-mihomo/src/mihomo.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/tauri-plugin-mihomo/src/mihomo.rs:193)
- [crates/tauri-plugin-mihomo/src/mihomo.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/tauri-plugin-mihomo/src/mihomo.rs:272)
- [crates/tauri-plugin-mihomo/src/mihomo.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/tauri-plugin-mihomo/src/mihomo.rs:297)

### 证据

`connect()` 在建立 WebSocket 后会：

- 把 `writer` 放进 `connection_manager`
- 直接 `tokio::spawn` 一个读任务
- 不保存 `JoinHandle`

核心逻辑：

- 读任务先执行 `reader.next().await`
- 只有收到下一条消息后，才会检查 `manager` 中是否还存在这个 `id`
- `disconnect()` 和 `clear_all_ws_connections()` 只是从 `manager` 删除 writer，并不主动取消读任务

这意味着如果出现下面任一情况：

- 前端主动断开，但对端不再发送任何帧
- 网络异常导致连接半开
- `clear_all_ws_connections()` 被调用时 reader 正阻塞在等待下一帧

那么该读任务会一直挂在 `reader.next().await` 上，直到远端真正关闭连接或底层 IO 报错。它会继续持有：

- reader 本身
- socket/pipe 相关资源
- 闭包捕获的 `on_message`
- `Arc<ConnectionManager>`

这不是传统的“永不释放堆对象”，但在运行时层面属于非常典型的任务/连接泄露。

### 风险等级

高

原因：

- 这是长时间运行的桌面应用
- WebSocket 被频繁创建和销毁
- 该路径发生后不会自动收敛
- 泄露对象同时包含任务、连接和 IO 资源

### 可行解决方案

1. 为每个读任务保存 `JoinHandle` 或 `AbortHandle`，在 `disconnect()` / `clear_all_ws_connections()` 时显式 `abort`。
2. 更稳妥的做法是给每个连接增加 `CancellationToken` 或 `watch::Receiver<bool>`，把读循环改成：

```rust
tokio::select! {
    _ = cancel.cancelled() => break,
    message = reader.next() => { ... }
}
```

3. 不要只从 `manager` 删除 writer；应同时关闭底层连接，确保 reader 能立刻从阻塞态退出。
4. 如果保留当前结构，至少应把 spawned 读任务的句柄也纳入 `ConnectionManager`，让连接的“写半边”和“读任务”拥有一致的生命周期。

## 发现 2: 本地服务 IPC 连接可无限堆积任务

### 位置

- [crates/clash-verge-self-service/src/service/mod.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/clash-verge-self-service/src/service/mod.rs:223)
- [crates/clash-verge-self-service/src/service/mod.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/clash-verge-self-service/src/service/mod.rs:311)

### 证据

`run_service()` 对每个进入的 IPC 连接都会：

- 完成握手
- 调用 `spawn_read_task(secured, shutdown_tx.clone()).await`
- 在 `spawn_read_task()` 内再 `tokio::spawn` 一个后台任务

问题在于这一层没有：

- 最大并发连接数
- 空闲超时
- 连接任务登记与统一回收
- 背压或拒绝策略

因此只要客户端建立连接后不发请求或缓慢发请求，对应任务就会一直持有：

- `SecureChannel`
- 加密状态 `Arc<XChaCha20Poly1305>`
- 去重队列 `Arc<Mutex<VecDeque<u64>>>`
- `tipsy::Connection`

虽然单个连接占用不大，但连接数没有上界，属于“资源耗尽型泄露风险”。在桌面环境里这通常比单次大对象泄露更现实。

### 风险等级

中高

原因：

- 这是本地 IPC 服务，生命周期长
- `allow_everyone_connect()` 扩大了可接入面
- 每个连接至少对应一个常驻任务
- 缺乏超时/限流使堆积没有自然上界

### 可行解决方案

1. 为连接处理加并发上限，例如用 `Semaphore` 限制同时活跃连接数。
2. 为 `recv()` 或整条连接增加空闲超时，例如：

```rust
match tokio::time::timeout(IDLE_TIMEOUT, secured.recv()).await {
    Ok(Ok(msg)) => { ... }
    Ok(Err(_)) | Err(_) => break,
}
```

3. 维护一个全局连接表或任务表，在服务关闭时统一取消。
4. 如果协议允许，增加轻量心跳；连续多个周期无活动则断开。
5. 将 `allow_everyone_connect()` 的使用范围收紧，避免非预期进程反复建立空闲连接。

## 发现 3: 日志 WebSocket 启动缓冲无上限

### 位置

- [src-tauri/src/cmds/mihomo_ws.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/src-tauri/src/cmds/mihomo_ws.rs:162)
- [src-tauri/src/cmds/mihomo_ws.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/src-tauri/src/cmds/mihomo_ws.rs:279)
- [src-tauri/src/cmds/mihomo_ws.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/src-tauri/src/cmds/mihomo_ws.rs:367)

### 证据

日志连接建立时会先创建：

- `BufferedLogMessages { buffering: true, messages: Vec::new() }`

在 `buffering == true` 期间，所有新日志都会被 `push` 到 `messages` 里；这个 `Vec` 没有长度上限。理论上如果以下条件同时成立：

- Mihomo 日志流量很大
- `send_log_snapshot()` 较慢
- UI 通道或快照发送阶段出现阻塞

则 `messages` 会持续增长，直到缓冲被 flush。

这更像尖峰期内存膨胀，不如前两个问题严重，但它确实是无上界缓存。

### 风险等级

中

### 可行解决方案

1. 把 `Vec<Value>` 改成有上限的 `VecDeque<Value>`，超限时丢弃最旧数据。
2. 为日志缓冲设置明确上限，例如 500 条或按总字节数限制。
3. 调整启动顺序，优先发送快照，再建立实时日志流，减少“快照期间继续堆积”的窗口。
4. 如果允许丢日志，可在缓冲溢出时发送一条“日志已截断”的系统消息，而不是继续增长。

## 已检查但不认为是当前泄露点的模块

### 有边界的日志缓存

- [src-tauri/src/core/logger.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/src-tauri/src/core/logger.rs:6)
- [crates/clash-verge-self-service/src/service/logger.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/clash-verge-self-service/src/service/logger.rs:6)

两个 logger 都把 `VecDeque` 长度限制在 `100`，属于受控内存，不是泄露点。

### `ProcessSupervisor` 的日志写入通道

- [crates/process_supervisor/src/lib.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/crates/process_supervisor/src/lib.rs:655)

这里使用的是容量为 `256` 的有界 `mpsc::channel`，并且 supervisor stop 时会等待任务结束，设计上是收敛的。

### `profiles` 的激活工作线程

- [src-tauri/src/config/profiles.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/src-tauri/src/config/profiles.rs:517)

新任务启动前会 `abort` 旧 `WORKER_HANDLE`，不会无限累积。

### 系统代理守护线程

- [src-tauri/src/core/sysopt.rs](/Users/oomeow/workplace/rust-projects/clash-verge-self/src-tauri/src/core/sysopt.rs:364)

虽然是常驻循环，但用 `guard_state` 防止重复启动，更像单例后台任务，而不是泄露。

## 建议修复优先级

1. 先修 `tauri-plugin-mihomo` 的 WebSocket 读任务取消机制。
2. 再给本地 IPC 服务增加连接上限和空闲超时。
3. 最后给日志缓冲加上界，避免异常高日志量时的瞬时内存膨胀。

## 建议验证方式

修复后建议补 3 类验证：

1. WebSocket 回归：
   连续反复打开/关闭 `traffic`、`memory`、`connections`、`logs` 订阅，观察任务数和打开的 socket/pipe 是否回落。

2. 服务连接回归：
   构造多个空闲 IPC 客户端连接，确认超时后任务数和内存能自动回收。

3. 日志压力回归：
   模拟高频日志输出，确认日志缓冲不会无限增长，且 UI 能收到截断或降级信号。

## 补充说明

Rust 本身只能避免“悬垂指针”和大部分所有权错误，不能自动避免以下问题：

- 永不退出的后台任务
- 无上界缓存
- 句柄/连接生命周期与业务状态脱钩

这次发现的问题主要都属于这一类运行时资源管理问题。
