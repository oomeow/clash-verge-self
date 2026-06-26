<!--
### 🚨 Breaking Changes

-->

### ✨ Features

- 优化全局模式（Global Mode）的渲染逻辑，并改进侧边栏可见性表现，提升界面交互体验
- 重构 Proxy 渲染相关逻辑，引入 RenderType 枚举替代魔法数字，使代码结构更清晰
- 优化 Proxy 模块内部实现，移除不必要的 ref 回调包装，简化逻辑

### 🐛 Bug Fixes

- 修复节点激活流程中的重试机制（activate_selected_nodes），提升稳定性
