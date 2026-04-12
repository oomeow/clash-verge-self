# Progress

## 2026-04-12

- 初始化规划文件，记录目标、阶段与当前发现。
- 已确认 `src/services/i18n.ts` 为国际化入口。
- 已扫描前端 `t()`/`i18n.t()` 调用，下一步将按页面和模块整理键映射关系。
- 新增 `scripts/reshape-i18n.mjs`，基于映射把四份 locale 从扁平结构重组为嵌套结构，并批量替换静态 `t()` 调用。
- 新增 `src/services/i18n-keymap.ts` 与动态翻译辅助，处理后端通知和运行时字符串映射。
- 已手工修正动态翻译点：路由标签、页面模式切换、设置页选项、菜单项标签、热键描述、服务状态等。
- 已补充缺失空态与编辑器相关文案，并将 `No Logs`、`No Rules`、`No Proxies`、`Direct Mode` 等硬编码切到 i18n。
- 执行 `pnpm exec tsc --noEmit`，结果通过。
