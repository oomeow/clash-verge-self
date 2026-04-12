# Task Plan

## Goal

按页面和模块重组国际化语言文件为嵌套结构，以 `src/locales/zh.json` 为基准同步其他语言文件，并更新前端所有国际化调用。

## Phases

| Phase                                 | Status   | Notes                                  |
| ------------------------------------- | -------- | -------------------------------------- |
| 1. 梳理 i18n 入口与翻译键使用         | complete | 已覆盖页面、组件、动态键和缺失键       |
| 2. 设计嵌套语言结构并重组 locale 文件 | complete | `zh` 为源，`en/ru/fa` 同步转为嵌套结构 |
| 3. 更新前端 `t()` 调用                | complete | 已处理静态键和动态键                   |
| 4. 校验构建与遗漏                     | complete | `pnpm exec tsc --noEmit` 通过          |

## Decisions

- 以页面/模块维度组织顶层分组，公共动作和状态独立为共享分组。
- 保留现有文案值，不在本次重构中改动翻译内容语义。
- 允许对少量调用点做辅助封装，但不引入新的 i18n 基础设施复杂度。

## Errors Encountered

| Error | Attempt | Resolution |
| ----- | ------- | ---------- |
