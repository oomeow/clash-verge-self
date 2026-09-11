# Mihomo Rule Parser

解析 Mihomo 的规则文件内容，支持 yaml/text/mrs 格式，并提供 mrs 导出能力（与 Mihomo 二进制格式兼容，经 meta-rules-dat 全量差分验证）。

## 解析

- `parse(path, behavior, format)` 读取规则文件，返回 `RulePayload { count, rules }`
- 支持 `Domain` / `IpCidr` / `Classical` 三种 behavior
- 文本格式会跳过空行与 `#`/`//` 注释

## 导出

- `export(rules, path, behavior, format)` 导出 yaml/text/mrs
- domain 规则校验与 Mihomo 对齐：`.x` 视同 `+.x` 通配符，`*` 仅允许作为整标签（字面量），拒绝其余含 `+`/`*` 与空标签的规则
- 导出采用原子写（临时文件 + 重命名）

## 安全

- MRS 解析对不可信输入做了防御：有界解压防解压炸弹、长度字段精确校验防 OOM、trie 结构一致性校验与索引越界保护，任何畸形输入返回错误而非 panic
