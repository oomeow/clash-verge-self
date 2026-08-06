<!--
### 🚨 Breaking Changes

-->

### ✨ Features

- 优化全局模式（Global Mode）的渲染逻辑，并改进侧边栏可见性表现，提升界面交互体验
- 重构 Proxy 渲染相关逻辑，引入 RenderType 枚举替代魔法数字，使代码结构更清晰
- 优化 Proxy 模块内部实现，移除不必要的 ref 回调包装，简化逻辑
- 支持 inline 代理/规则提供者数据渲染
- 优化重构 Mihomo IPC 请求
- 支持配置滚动日志的大小（MB）与最大保留份数，可在设置页调整，核心日志于下次启动核心时生效、应用日志于下次重启应用时生效

### 🐛 Bug Fixes

- 修复节点激活流程中的重试机制（activate_selected_nodes），提升稳定性
- 修复 provider 节点延迟检测
- 修复代理节点名称中的 emoji 无法正确渲染的问题
- 修复订阅界面元素溢出时无法滚动的问题
- 修复了 scheme 导入链接中 URL 参数值被编码后导致导入失败的问题
