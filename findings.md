# Findings

## i18n 入口

- `src/services/i18n.ts` 直接加载 `en/fa/ru/zh` 四个 locale 文件，挂在 `translation` 根命名空间下。

## 初步观察

- 当前 locale 是单层扁平结构，包含大量带空格、大小写混合和少量带点号的键。
- 前端广泛使用 `t("...")` 直接取值，覆盖页面、组件、通知、Monaco 配置等多个区域。
- 存在动态键形式，例如 `t(item.label)`、`t(state)`、`t(\`theme.${mode}\`)`、`t(\`silent.${mode}\`)`、`t(\`Find Process Mode ${modeName}\`)`。
- 已发现部分代码引用的键不在当前 `zh.json` 中，例如 `No Connections`、`Required`、`Web UI`、`Clash Port`、`Add`、`Can't read monaco content`。

## 影响范围

- 页面：`src/pages/*`
- 基础组件：`src/components/base/*`
- 页面组件：`src/components/{profile,proxy,connection,rule,test,setting}/*`
- 服务层：`src/services/monaco.ts`

## 本次落地

- `src/locales/*.json` 已重组为嵌套结构，核心按 `common`、`navigation`、`pages`、`settings`、`messages` 分组，无法合理归类的旧键暂放入 `legacy`。
- 新增 `src/services/i18n-keymap.ts`，保存旧扁平键到新嵌套路径的映射。
- `src/services/i18n.ts` 增加动态键解析能力，用于兼容后端通知消息和少量运行时字符串。
- 已补齐若干原本缺失但前端实际使用的文案键，如 `No Connections`、`No Logs`、`No Rules`、`No Proxies`、`Direct Mode`、`Add`、`Required`、`Clash Port`、`Web UI`、`Can't read monaco content`。
- 第二轮整理后，`legacy` 分组已移除，剩余过渡键已归入 `pages.profiles.editor`、`pages.profiles.runtime`、`settings.system.proxy.bypass`、`settings.clash.webUi`、`messages.editor`、`messages.backup` 等具体模块。
