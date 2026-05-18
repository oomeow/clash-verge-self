## v2.3.0

> [!IMPORTANT]
>
> **安装此版本前需要完全卸载旧版本**
>
> 可先进行数据备份（`设置 -> 备份设置`），如果是使用本地备份，需要保存好备份文件，然后在新版本中通过备份恢复应用数据

### 🚨 Breaking Changes

- 重命名应用名，调整应用 APP ID，致使应用目录结构发生变化
- 重构服务，修复 macOS 上无法安装运行服务的问题

### ✨ Features

- 对 Mihomo API 的请求添加超时机制
- 优化代理组延迟测试方法，添加一个参数用于是否清除已固定的节点
- 优化 macOS 桌面图标
- 优化系统关机/重启时恢复代理设置的逻辑
- macOS 使用 tun 时，名称必须符合 `utun + 数字` 的组合
- 优化连接信息中目标地址显示
- 应用备份成功后刷新前端界面的代理信息
- 支持拨号连接/VPN连接的代理设置（实验性）
- 改进 Monaco 编辑器的初始化与配置，优化编辑器加载与渲染体验
- 调整`在程序坞中显示`配置的行为，用于关闭应用窗口时应用是否保留在程序坞中
- 前端状态管理迁移到 Zustand，改善状态稳定性与维护性
- 优化页面切换与路由预加载，提升页面切换流畅度与首屏体验
- 优化核心运行和重启逻辑
- 添加应用内快捷键设置，macOS默认 `⌘ + Q` 退出应用，其他平台默认 `Esc` 关闭窗口
- 优化脚本日志显示界面
- 本地备份支持自定义备份路径
- 本地备份支持显示备份文件列表
- 优化规则页面渲染速度
- 支持启用/禁用规则
- 支持侧边栏应用图标点击切换主题
- 完全接管规则合集的路径配置 (默认保存在应用目录下的 rules 文件夹中)
- 重构代理组页面，实现代理组粘性滚动
- 规则页面支持内容模糊搜索/域名搜索/CIDR块搜索
- 连接界面添加`回到顶部`按钮功能
- 优化代理组图标缓存逻辑
- 代理节点的标签支持显示代理合集提供者
- 连接界面支持字段过滤
- 优化 Fixed 节点的样式(使用 warn 主题色便于醒目注意)
- 支持设置背景颜色
- 重新设置默认主题色
- 优化主题颜色选择器
- 订阅界面支持多选操作
- 基于 Material You 设计语言重新调整优化界面主题和样式

### 🐛 Bug Fixes

- 在 Windows 上禁用主题动画以防止切换主题时出现闪烁
- 在 Windows 上简化系统托盘提示信息，以防止系统托盘提示信息显示不完整
- 代理界面节点列数展示计算错误
- macOS 从程序坞无法恢复窗口
- macOS 系统托盘图标颜色错误
- 应用启动时，macOS 程序坞出现两个应用图标
- 修复窗口大小 Hook 初始化值为 0 的问题，避免异常窗口尺寸
- macOS 托盘图标切换时闪烁问题
- 日志界面暂停时无法清空内容的问题
- macOS 不断切换配置导致内存占用持续升高的问题

### 🔧 Refactor

- 重构解析 Mihomo IPC 数据的逻辑
- 重构 Mihomo IPC 处理，改善通信稳定性与可读性
- 重构 i18n 语言文件
- 重构服务模式
- 重构连接列表使用 tanstack table 实现
- 移除自定义错误实现
- 集成 Clash Verge Service 服务

---

## v2.2.0

> [!IMPORTANT]
>
> 重构了 Clash Verge Service 构建，不再提供 `install-service` 和 `uninstall-service` 二进制文件，仅使用 `clash-verge-service` 二进制文件来完成
>
> 优化了 Clash Verge Service 服务重启核心的逻辑，需要手动重新安装服务模式 (`设置` -> `服务模式` -> `卸载` -> `安装`)
>
> **手上没有 Mac 电脑，无法测试 macOS 版本的服务模式是否正常**
>
> 编辑订阅/增强脚本时，若出现无法通过 `Ctrl+v` 进行复制粘贴时，可尝试使用 `Ctrl+Shift+v` 快捷键。（**Linux wayland 下出现该情况**）

### ✨ Features

- 版本更新日志窗口高度自适应
- 初始化创建必要的目录
- 默认关闭外部控制器
- 订阅列表为空时，默认自动使用首个导入的订阅
- 优化订阅添加/删除逻辑
- 自定义 App 错误类型
- 添加订阅自动更新的失败重试机制 (重试间隔时间 30 秒)
- 前端订阅列表进行实时同步更新(后端订阅自动更新机制)，确保状态一致
- 优化从 rust 端发送消息至前端提示通知的方法逻辑
- 完善 tauri 的 mihomo 插件缺失的字段属性
- 优化端口设置修改逻辑
- 优化 Marquee 组件的渲染性能
- 检查窗口是否最大化方法防抖处理
- 调整内核界面样式, 对 Linux 便捷版本提供授权操作按钮
- 支持 Linux 的便携版本
- 支持 Linux 便捷版在不启用服务模式下使用 Tun 模式
- Linux wayland 下强制使用 x11 渲染程序, 提升兼容性和使用体验 (**注：在只使用 nvidia 显卡的 Linux 系统中，不再强制使用 x11 渲染，避免应用卡死**)
- 增强日志界面数据渲染的性能
- 优化服务模式下的内核重启逻辑
- 优化 Clash Verge Service 服务的安装逻辑，可直接覆盖旧的服务
- 细化静默启动设置项, 分为仅开机/全局/关闭选项
- 调整部分样式
- 取消随机端口时，若默认端口 7890 被占用，则会自动选用其他未被占用的端口
- 减少界面初始化时不必要的资源加载，提升启动速度

### 🐛 Bug Fixes

- 删除最后一个订阅时，App 内保存的当前订阅数据不正确
- 删除排序在首位的订阅，未能自动选择后续的订阅
- 删除订阅下的局部增强脚本，App 内保存的当前订阅数据不正确
- 2.0.0 版本以来，存在未清理的无效的订阅/增强文件
- 无全局增强脚本时，对订阅中的局部增强进行运行检测将导致应用崩溃
- 改进代理组延迟测试处理机制，解决节点超时动画异常
- 内核切换时动画闪烁问题
- 缺失 ipv6 设置项的默认配置
- 为避免一次性解析全部规则提供者负载导致前端内存占用升高且持续时间较长，现改为由前端按需请求并解析负载内容，从而有效控制内存使用（内存增长是不可避免的，因为解析后的数据也有可能比较大）
- 在使用 nvidia 显卡的 Linux 系统中，应用无法正常显示界面
- 前端未正确取消监听内核的 websocket 信息，导致 websocket 连接未完全断开
- 服务未安装但配置为已启用状态下，禁用服务后未刷新界面数据

---

## v2.1.4

### 🐛 Bug Fixes

- 无法通过 url 导入订阅
- 便捷版本导入的订阅在重启后消失
- 部分应用设置项为空，未显示默认值
- 应用备份文件后，App 有概率重启失败的问题

---

## v2.1.3

### ✨ Features

- 重置代理/软件请求退出时，清理 mihomo 已连接的 websocket 连接
- 进程匹配模式的 “默认” 选项替换为 “自动” 选项
- 窗口移动或大小调整时，不在保存窗口位置和大小，避免频繁的修改操作，提升性能
- 修改订阅文件的基本信息不再重启内核加载配置文件
- 重构 Draft 宏，使用读写锁，支持并发读取数据
- trace 日志级别不再记录 websocket 的信息
- 更新 github 的代理地址
- 订阅导入栏固定在顶部
- 订阅编辑页面中，订阅名固定在顶部
- 创建/编辑订阅界面中，填充默认值
- 重点突出显示网络接口名字
- App日志级别设置移动到 verge 设置的顶部
- 显示局部增强脚本排序后导致运行错误的状态
- 调整设置界面中的设置选项样式
- 调整热键设置界面样式
- 调整代理合集/规则合集界面里的样式
- 优化清理大量代码，减少不必要的克隆

### 🐛 Bug Fixes

- 软件内更新应用时，下载进度条被更新内容顶至滚动内容的最下方
- 代理组节点超过 30 个并进行延迟测试时，已固定的代理节点会被解除固定
- 多屏显示下，应用打开的窗口位置未恢复到上次关闭的位置
- 删除未在运行的订阅会导致错误的激活状态
- 切换订阅成功后的英文通知内容错误
- 切换订阅后未刷新规则数据

---

## v2.1.2

### 🚨 Breaking Changes

- 优化更新了 Clash Verge Service 服务，需要在设置界面中重新卸载安装服务

### ✨ Features

- 优化部分样式
- 添加进程匹配模式设置
- 添加清空 DNS 缓存设置
- 调整 amd64 平台使用的内核版本
- 复制环境变量新增对 NuShell 的支持
- 连接界面支持查看已关闭的连接信息
- 新版本更新内容窗口支持显示更多的内容格式，例如 Github 的 [警报信息](https://docs.github.com/zh/contributing/style-guide-and-content-model/style-guide#alerts)
- 优化代理组延迟检测，超过 30 个节点的代理组，不在对代理节点逐一检测，而是使用内核方法进行一次性检测
- 优化规则合集更新逻辑，减少重复读取规则合集文件内容的次数，避免内存占用过高
- 优化代理合集更新逻辑
- 重启内核方法防抖

### 🐛 Bug Fixes

- 取消固定代理时没有清除配置中选中节点信息的数据
- 未同步更新流量图显
- 应用未及时关闭 websocket 连接导致应用后台运行时，内存占用持续升高的问题
- 未正确编码 URL 导致请求不正确的问题
- 未及时清理旧的 websocket 连接
- websocket hooks 未正确处理重连的问题

---

## v2.1.1

### ✨ Features

- 调整连接详情弹窗样式
- 重构路由，使用 tanstack router 代替 react router
- 设置页面添加复制环境变量按钮
- 移除启动页
- 调整外部控制器设置样式和保存逻辑
- 设置默认窗口大小为 1100 x 750
- Linux 桌面文件添加 StartupWMClass 属性
- 优化启动逻辑
- 移除不需要的依赖项
- 点击侧边栏代理组后，高亮显示滚动到的代理组
- 局域网连接设置项新增网络接口信息显示按钮
- 优化应用备份后重启应用的逻辑

### 🐛 Bug Fixes

- 修改订阅文件名后，未同步到系统托盘菜单

---

## v2.1.0

### ✨ Features

- 与 Clash Verge Service 的通信改用 IPC 通信，**需要卸载旧版本服务**（Macos 未验证）
- 使用 mihomo 的 IPC 控制器控制 mihomo 内核，默认禁用 RESTfull API 的外部控制器
- 对使用 RESTfull API 外部控制器添加 Cors 配置，默认允许 Web UI 默认设置中的地址
- 优化内核切换速度
- 重构代理绕过处理以支持平台特定的配置

### 🐛 Bug Fixes

- 在 Linux 上，服务日志文件的所有者为 root 权限，导致日志文件清理失败
- 软件卸载后未移除自启动的注册表值
- 在 Windows 上，通过备份文件恢复软件设置时，由于系统代理绕过内容格式错误，无法更新系统代理，从而导致应用无法退出

---

## v2.0.0

### 🚨 Breaking Changes

- `2.0.0` 版本中，Tauri 框架升级到 v2 版本, 大量 API 重大变更

### ✨ Features

- Macos 支持设置程序坞中显示/隐藏应用 (`设置 - 界面设置 - 在程序坞中显示`)
- 支持查看 mrs 规则文件的规则内容
- 切换 Tun 模式时，根据设置选择是否清空所有连接
- 添加内核切换的状态动画
- 优化 windows 的打包文件
- 重构内核模式的切换逻辑
- 重构日志模块，使用 tracing 代替 log 记录日志
- 在托盘菜单中的 `打开面板` 和 内核模式之间添加分隔符
- 订阅更新操作添加超时机制 （限制在 10 秒内）

### 🐛 Bug Fixes

- 内嵌服务未正常关闭导致应用重启失败
- 编辑订阅文件时，没有加载 schema 的提示信息

---

## v2.0.0-beta.3

### 🚨 Breaking Changes

- `2.0.0` 版本中，Tauri 框架升级到 v2 版本, 大量 API 重大变更

### ✨ Features

- 优化应用下载更新的进度条动画效果
- 优化代理组取消固定节点的逻辑
- React 升级到 19 版本
- 规则合集更新失败时，不再提示错误信息，只显示更新失败的状态图标
- 可滚动文字组件`ScrollableText`替换为跑马灯组件`Marquee`
- 重构订阅编辑界面和优化逻辑 (`Ctrl+s`: 保存内容，`F5`: 对增强脚本进行运行检查)
- 重构消息通知
- 延迟检测忽略 Direct 节点

### 🐛 Bug Fixes

- 删除订阅文件下的增强脚本时（无论脚本是否启用），总是重启内核以及总是改变使用第一个订阅配置
- 当前修改的增强文件进行运行检测时，未正确剔除后面的增强脚本，导致检测结果不准确
- 系统托盘切换模式时，未根据配置决定是否自动断开连接
- 使用 tauri 的 exit 方法退出应用
- 移除不需要的代码

---

## v2.0.0-beta.2

### 🚨 Breaking Changes

- `2.0.0` 版本中，Tauri 框架升级到 v2 版本, 大量 API 重大变更

### ✨ Features

- 尝试支持不同系统平台的备份进行恢复
- 添加 aur 构建时所需的依赖
- 取消对话框为全页面时的动画
- 支持本地备份和恢复
- 优化主题设置界面
- 重构 mihomo 的 api 调用模块抽取为 tauri 插件
- 优化应用启动页
- Tailwind CSS 升级到 v4 版本
- clash 配置设置默认缓存策略组的选择和 fakeip 映射表
- 优化部分样式界面

### 🐛 Bug Fixes

- 正在运行的配置文件删除时没有动画
- Windows 下载更新 App 时，下载地址为空

---

## v2.0.0-beta.1

### 🚨 Breaking Changes

- Tauri 框架升级到 v2 版本, 大量 API 重大变更

### ✨ Features

- 连接界面关闭全部的按钮与过滤器相关联
- 应用备份文件后检查内核重新运行状态
- 更新 i18n 本地化语言
- 订阅配置文件切换时需要重启内核，以避免上一个配置残留等等问题
- 优化部分样式和动画
- 系统托盘支持隐藏
- 系统托盘 i18n 本地化语言支持
- 工作流构建调整优化
- 系统关机时，还原代理设置
- 优化代理、规则合集按钮
- 系统托盘支持切换订阅
- 修改 clash 端口时支持检测端口是否可用
- 配置增强功能支持对某一特定订阅处理（即分全局增强和局部增强）

### 🐛 Bug Fixes

- 代理组侧边栏表情图标显示错误
- 存在隐藏的代理组导致代理页面无法正常显示
- 升级内核请求超时

### 目前存在的问题

- Linux wayland 下窗口无法置顶, 并且窗口打开时无法及时渲染界面

---

## v1.7.1

> [!Important]
>
> `1.7.x` 版本重构了 Clash Verge Service 一部分功能以及更改了应用的 appid、identify 以及 aur 构建包名，升级到 `1.7.x` 版本前，请先卸载旧版本的服务模式并自行备份订阅配置文件

### 🐛 Bug Fixes

- 代理组侧边栏表情图标缺失
- 导入订阅创建文件失败

### 🚀 Performance Improvements

- 空的 webdav 配置信息跳过初始化

---

## v1.7.0

> [!Important]
> 安装此版本前，请先卸载旧版本的服务模式，另外此版本所有的数据存放路径都将改变，请自行备份订阅配置文件

### 🚨 Breaking Changes

- 重构 Clash Verge Service 一部分功能
- 更改应用的 appid、identify 以及 aur 构建包名

### ✨ Features

- 支持 webdav 备份
- 服务模式支持日志输出
- 支持应用运行时动态修改 APP 日志级别
- `pnpm check` 的任务失败重试间隔为 1 秒
- `pnpm check` 支持 `--alpha` 参数来下载 alpha 版本的 Clash Verge Service
- `pnpm check` 添加对 ASN.mmdb 文件下载
- 新的增强脚本 (Script) 的控制台界面
- 支持增强脚本 (Script) 保存前的运行检查
- 订阅配置文件右键菜单中的第一项始终为“使用”
- 菜单侧边栏支持小窗口收缩
- 支持 windows 系统托盘图标隐藏
- 捕获显示崩溃错误信息
- 可滚动显示的文本组件
- 记录存储 clash 日志的相关信息
- 日志界面内容显示同步内核的日志级别显示
- 连接页面`关闭全部`按钮显示总连接数
- 重构基本对话框组件

### 🚀 Performance Improvements

- 优化内核停止逻辑
- 仅当主题颜色设置初始化或改变时才存储到 LocalStorage
- 切换界面主题时，同时更改应用的主题配置
- 切换系统标题栏无需重启应用
- 集成 framer motion 库, 优化大部分动画效果
- 集成 tailwindcss 库, 优化大部分样式布局
- ci 工作流优化

### 🐛 Bug Fixes

- 延迟测试返回数据解析失败
- 节点延迟排序错误
- 连接界面本地语言错误
- 内核未运行时，主窗口无法渲染显示
- 配置文件 schema 的 `format` 属性缺失 `mrs` 值
- 修改 Clash Verge Service 的 API 调用为 RESTful API 的风格
- 尝试拖动增强脚本 (Script) 的控制台界面操作会导致代理链拖动排序
- mrs 文件类型的规则合集内容无需进行解析展示
- 超量使用的订阅流量进度条显示错误
- 移除未使用的 LocalStorage 对象
- Linux 上切换主题动画卡顿失效
- 修改外部控制器后，websocket 连接失败，导致流量图显/内容使用/连接信息/日志信息数据获取失败
- useWindowsSize 的 hook 的初始值为 0, 导致代理页面节点渲染列数错误
- github 代理地址
- web页面构建oom错误
- react devtools 无法连接调试

---

## v1.6.8

### ✨ Features

- clash 外部控制的 API 密钥支持点击生成随机密钥
- 设置界面的 `Switch` 切换按钮支持显示正在切换中的繁忙状态
- 在系统托盘中开启 Tun 模式或服务模式时，如果服务未安装，弹窗提示安装并运行服务, Tun 模式会在服务安装完成后启用
- 在系统托盘中开启 Tun 模式时，如果服务模式未启用，先启用服务模式，再启用 Tun 模式
- `GuardState` 组件里支持失败重试 5 次
- 主题色切换动画（仅支持左侧边栏 logo 上的主题切换按钮）
- 订阅文件右键菜单列表添加图标
- windows 下主题切换全部添加动画
- 服务模式支持 clash 自动重启 (10 次之内进行失败重启)

### 🚀 Performance Improvements

- 只调用一次更改接口对多个 clash 端口更改
- 优化内核切换和恢复重启的逻辑

### 🐛 Bug Fixes

- 开启服务模式时，内核还会在常规模式下重启
- 延迟测试中如果节点延迟测试超时，会显示 Error，而不是显示 Timeout
- 测试超时时间修改为空时，字段值为 NaN
- windows 下，使用 vscode 打开订阅文件失败
- 应用启动时无需发送关闭 Tun 模式的请求
- 应用启动初始化检测 tun 模式状态可能检测到错误状态 (移除此逻辑)

### 📝 Other Changes

- mixed 端口默认使用 7890 端口，外部控制端口默认使用 9090 端口，其他端口默认禁用
- 默认启用统一延迟
- Tun 设置中的最大传输单元 (mtu) 默认为 9000
- 延迟测试默认超时时间为 5000 毫秒
- 调整运行时配置文件的字段显示顺序
- 调整应用布局
- 升级依赖

---

## v1.6.7

### ✨ Features

- 连接页面添加字段显示、字段内容条件过滤功能按钮
- 支持 Windows 和 Linux 下是否启用系统标题栏设置
- 窗口最大化后取消圆角
- 左侧菜单栏选中时图标高亮
- 左侧菜单栏的涟漪效果颜色使用主题色
- 支持UI界面是否保持活跃状态设置
- 代理组界面添加左侧边栏展开显示代理组列表，实现点击跳转
- 配置文件新建/编辑的文件类型使用更醒目的按钮组
- 给重新激活配置文件，启用/关闭/删除增强文件(merge/script)操作添加动画
- 支持同种状态下（启用/未启用两种状态）的增强文件/增强脚本进行拖拽排序
- 代理组节点过滤防抖
- 连接界面表格数据添加关闭连接操作
- 调整应用图标
- 添加启动页
- 支持内存使用图标点击后重启内核
- 支持规则合集内容显示和搜索
- 在左侧边栏应用 logo 的右上方添加主题切换按钮
- 支持增强文件内容重新生成
- 基础搜索文本框组件添加清除内容操作按钮
- 支持规则合集内容的全部展开和折叠
- 规则集更新失败进行5次重试
- 设置界面中，将 Tun 设置、服务模式移动到 clash 设置模块中
- 重构修改 clash 基本配置逻辑方法，例如：Tun、ipv6、局域网、端口、日志设置等基本设置修改后，无需重启，立即生效
- 应用启动时循环检测 Tun 模式开启状态以同步系统托盘图标显示
- 仅在服务模式安装并开启后才能启用 Tun 模式
- 优化 clash 端口设置，去除开关按钮，端口设置为 0 时将禁用此设置的端口
- 默认配置只启用 mixed port 端口，其他端口禁用
- Macos 和 Linux 下，未开启服务模式时，内核列表显示授权按钮，用于更新内核版本
- 系统托盘切换 Tun 模式失败时，使用系统通知提示错误信息
- 系统托盘支持服务模式切换，支持使用系统通知提示错误信息
- 将内置编辑器提取为基本组件
- 支持深色/浅色主题颜色分别配置
- 添加统一延迟开关设置
- 添加清空 Fake-IP 设置

### 🐛 Bug Fixes

- 代理组过滤节点按钮关闭后未重置过滤信息
- Linux 开发环境下代理组图标加载失败
- alpha 内核更新升级，已经使用最新版本的提示信息类型为错误类型
- 窗口尺寸变化导致 monaco 编辑器无法填满内容、小地图功能不生效
- 窗口尺寸频繁改变导致代理页面布局变化卡顿
- 窗口销毁重新创建后第一时间渲染的主题不是用户配置的主题
- 配置文件/增强文件/增强脚本启用失败时无报错信息提示
- 打开文件操作未使用 vscode 打开
- 测试页面修改某个项目信息后导致内核重启
- 从其他页面返回订阅页面时缺少正在激活中的动画
- Macos 限制 Tun 网卡名称以 `utun` 开头
- 深色/浅色主题切换时，代理页面的部分组件的背景颜色切换存在延迟，与其他页面变换动画不一致
- 控制台报错的问题
- pac 脚本内容重新生成模板的内容错误
- 订阅界面初次渲染次数过多

### 📝 Other Changes

- 调整日志界面样式
- 调整连接界面样式
- 解决构建应用时 Vite5 的警告信息
- 相关依赖版本升级
- 添加 ArchLinux 软件包
- CI 工作流更新

---

## v1.6.6

### Features

- MacOS 应用签名
- 删除 AppImage
- 应用更新对话框添加下载按钮
- 设置系统代理绕过时保留默认值
- 系统代理绕过设置输入格式检查

### Bugs Fixes

- MacOS 代理组图标无法显示
- RPM 包依赖缺失

---

## v1.6.5

### Features

- 添加 RPM 包支持
- 优化细节

### Bugs Fixes

- MacOS 10.15 编辑器空白的问题
- MacOS 低版本启动白屏的问题

---

## v1.6.4

### Features

- 系统代理支持 PAC 模式
- 允许关闭不使用的端口
- 使用新的应用图标
- MacOS 支持切换托盘图标单色/彩色模式
- CSS 注入支持通过编辑器编辑
- 优化代理组列表性能
- 优化流量图显性能
- 支持波斯语

### Bugs Fixes

- Kill 内核后 Tun 开启缓慢的问题
- 代理绕过为空时使用默认值
- 无法读取剪切板内容
- Windows 下覆盖安装无法内核占用问题

---

## v1.6.2

### Features

- 支持本地文件拖拽导入
- 重新支持 32 位 CPU
- 新增内置 Webview2 版本
- 优化 Merge 逻辑，支持深度合并
- 删除 Merge 配置中的 append/prepend-provider 字段
- 支持更新稳定版内核

### Bugs Fixes

- MacOS DNS 还原失败
- CMD 环境变量格式错误
- Linux 下与 N 卡的兼容性问题
- 修改 Tun 设置不立即生效

---

## v1.6.1

### Features

- 鼠标悬浮显示当前订阅的名称 [#938](https://github.com/clash-verge-rev/clash-verge-rev/pull/938)
- 日志过滤支持正则表达式 [#959](https://github.com/clash-verge-rev/clash-verge-rev/pull/959)
- 更新 Clash 内核到 1.18.4

### Bugs Fixes

- 修复 Linux KDE 环境下系统代理无法开启的问题
- 窗口最大化图标调整 [#924](https://github.com/clash-verge-rev/clash-verge-rev/pull/924)
- 修改 MacOS 托盘点击行为(左键菜单，右键点击事件)
- 修复 MacOS 服务模式安装失败的问题

---

## v1.6.0

### Features

- Meta(mihomo)内核回退 1.18.1（当前新版内核 hy2 协议有 bug，等修复后更新）
- 多处界面细节调整 [#724](https://github.com/clash-verge-rev/clash-verge-rev/pull/724) [#799](https://github.com/clash-verge-rev/clash-verge-rev/pull/799) [#900](https://github.com/clash-verge-rev/clash-verge-rev/pull/900) [#901](https://github.com/clash-verge-rev/clash-verge-rev/pull/901)
- Linux 下新增服务模式
- 新增订阅卡片右键可以打开机场首页
- url-test 支持手动选择、节点组 fixed 节点使用角标展示 [#840](https://github.com/clash-verge-rev/clash-verge-rev/pull/840)
- Clash 配置、Merge 配置提供 JSON Schema 语法支持、连接界面调整 [#887](https://github.com/clash-verge-rev/clash-verge-rev/pull/887)
- 修改 Merge 配置文件默认内容 [#889](https://github.com/clash-verge-rev/clash-verge-rev/pull/889)
- 修改 tun 模式默认 mtu 为 1500，老版本升级，需在 tun 模式设置下“重置为默认值”。
- 使用 npm 安装 meta-json-schema [#895](https://github.com/clash-verge-rev/clash-verge-rev/pull/895)
- 更新部分翻译 [#904](https://github.com/clash-verge-rev/clash-verge-rev/pull/904)
- 支持 ico 格式的任务栏图标

### Bugs Fixes

- 修复 Linux KDE 环境下系统代理无法开启的问题
- 修复延迟检测动画问题
- 窗口最大化图标调整 [#816](https://github.com/clash-verge-rev/clash-verge-rev/pull/816)
- 修复 Windows 某些情况下无法安装服务模式 [#822](https://github.com/clash-verge-rev/clash-verge-rev/pull/822)
- UI 细节修复 [#821](https://github.com/clash-verge-rev/clash-verge-rev/pull/821)
- 修复使用默认编辑器打开配置文件
- 修复内核文件在特定目录也可以更新的问题 [#857](https://github.com/clash-verge-rev/clash-verge-rev/pull/857)
- 修复服务模式的安装目录问题
- 修复删除配置文件的“更新间隔”出现的问题 [#907](https://github.com/clash-verge-rev/clash-verge-rev/issues/907)

### 已知问题（历史遗留问题，暂未找到有效解决方案）

- MacOS M 芯片下服务模式无法安装；临时解决方案：在内核 ⚙️ 下，手动授权，再打开 tun 模式。
- MacOS 下如果删除过网络配置，会导致无法正常打开系统代理；临时解决方案：使用浏览器代理插件或手动配置系统代理。
- Window 拨号连接下无法正确识别并打开系统代理；临时解决方案：使用浏览器代理插件或使用 tun 模式。

---

## v1.5.11

### Features

- Meta(mihomo)内核更新 1.18.2

### Bugs Fixes

- 升级图标无法点击的问题
- 卸载时检查安装目录是否为空
- 代理界面图标重合的问题

---

## v1.5.10

### Features

- 优化 Linux 托盘菜单显示
- 添加透明代理端口设置
- 删除订阅前确认

### Bugs Fixes

- 删除 MacOS 程序坞图标
- Windows 下 service 日志没有清理
- MacOS 无法开启系统代理

---

## v1.5.9

### Features

- 缓存代理组图标
- 使用`boa_engine` 代替 `rquickjs`
- 支持 Linux armv7

### Bugs Fixes

- Windows 首次安装无法点击
- Windows 触摸屏无法拖动
- 规则列表 `REJECT-DROP` 颜色
- MacOS Dock 栏不显示图标
- MacOS 自定义字体无效
- 避免使用空 UA 拉取订阅

---

## v1.5.8

### Features

- 优化 UI 细节
- Linux 绘制窗口圆角
- 开放 DevTools

### Bugs Fixes

- 修复 MacOS 下开启 Tun 内核崩溃的问题

---

## v1.5.7

### Features

- 优化 UI 各种细节
- 提供菜单栏图标样式切换选项(单色/彩色/禁用)
- 添加自动检查更新开关
- MacOS 开启 Tun 模式自动修改 DNS
- 调整可拖动区域(尝试修复触摸屏无法拖动的问题)

---

## v1.5.6

### Features

- 全新专属 Verge rev UI 界面 (by @Amnesiash) 及细节调整
- 提供允许无效证书的开关
- 删除不必要的快捷键
- Provider 更新添加动画
- Merge 支持 Provider
- 更换订阅框的粘贴按钮，删除默认的"Remote File" Profile 名称
- 链接菜单添加节点显示

### Bugs Fixes

- Linux 下图片显示错误

---

## v1.5.4

### Features

- 支持自定义托盘图标
- 支持禁用代理组图标
- 代理组显示当前代理
- 修改 `打开面板` 快捷键为`打开/关闭面板`

---

## v1.5.3

### Features

- Tun 设置添加重置按钮

### Bugs Fixes

- Tun 设置项显示错误的问题
- 修改一些默认值
- 启动时不更改启动项设置

---

## v1.5.2

### Features

- 支持自定义延迟测试超时时间
- 优化 Tun 相关设置

### Bugs Fixes

- Merge 操作出错
- 安装后重启服务
- 修复管理员权限启动时开机启动失效的问题

---

## v1.5.1

### Features

- 保存窗口最大化状态
- Proxy Provider 显示数量
- 不再提供 32 位安装包（因为 32 位经常出现各种奇怪问题，比如 tun 模式无法开启；现在系统也几乎没有 32 位了）

### Bugs Fixes

- 优化设置项名称
- 自定义 GLOBAL 代理组时代理组显示错误的问题

---

## v1.5.0

### Features

- 删除 Clash 字段过滤功能
- 添加 socks 端口和 http 端口设置
- 升级内核到 1.18.1

### Bugs Fixes

- 修复 32 位版本无法显示流量信息的问题

---

## v1.4.11

### Break Changes

- 此版本更改了 Windows 安装包安装模式，需要卸载后手动安装，否则无法安装到正确位置

### Features

- 优化了系统代理开启的代码，解决了稀有场景下代理开启卡顿的问题
- 添加 MacOS 下的 debug 日志，以便日后调试稀有场景下 MacOS 下无法开启系统代理的问题
- MacOS 关闭 GUI 时同步杀除后台 GUI [#306](https://github.com/clash-verge-rev/clash-verge-rev/issues/306)

### Bugs Fixes

- 解决自动更新时文件占用问题
- 解决稀有场景下系统代理开启失败的问题
- 删除冗余内核代码

---

## v1.4.10

### Features

- 设置中添加退出按钮
- 支持自定义软件启动页
- 在 Proxy Provider 页面展示订阅信息
- 优化 Provider 支持

### Bugs Fixes

- 更改端口时立即重设系统代理
- 网站测试超时错误

---

## v1.4.9

### Features

- 支持启动时运行脚本
- 支持代理组显示图标
- 新增测试页面

### Bugs Fixes

- 连接页面时间排序错误
- 连接页面表格宽度优化

---

## v1.4.8

### Features

- 连接页面总流量显示

### Bugs Fixes

- 连接页面数据排序错误
- 新建订阅时设置更新间隔无效
- Windows 拨号网络无法设置系统代理
- Windows 开启/关闭系统代理延迟(使用注册表即可)
- 删除无效的背景模糊选项

---

## v1.4.7

### Features

- Windows 便携版禁用应用内更新
- 支持代理组 Hidden 选项
- 支持 URL Scheme(MacOS & Linux)

---

## v1.4.6

### Features

- 更新 Clash Meta(mihomo) 内核到 v1.18.0
- 支持 URL Scheme(暂时仅支持 Windows)
- 添加窗口置顶按钮
- UI 优化调整

### Bugs Fixes

- 修复一些编译错误
- 获取订阅名称错误
- 订阅信息解析错误

---

## v1.4.5

### Features

- 更新 MacOS 托盘图标样式(@gxx2778 贡献)

### Bugs Fixes

- Windows 下更新时无法覆盖`clash-verge-service.exe`的问题(需要卸载重装一次服务，下次更新生效)
- 窗口最大化按钮变化问题
- 窗口尺寸保存错误问题
- 复制环境变量类型无法切换问题
- 某些情况下闪退的问题
- 某些订阅无法导入的问题

---

## v1.4.4

### Features

- 支持 Windows aarch64(arm64) 版本
- 支持一键更新 GeoData
- 支持一键更新 Alpha 内核
- MacOS 支持在系统代理时显示不同的托盘图标
- Linux 支持在系统代理时显示不同的托盘图标
- 优化复制环境变量逻辑

### Bugs Fixes

- 修改 PID 文件的路径

### Performance

- 优化创建窗口的速度

---

## v1.4.3

### Break Changes

- 更改配置文件路径到标准目录(可以保证卸载时没有残留)
- 更改 appid 为 `io.github.clash-verge-rev.clash-verge-rev`
- 建议卸载旧版本后再安装新版本，该版本安装后不会使用旧版配置文件，你可以手动将旧版配置文件迁移到新版配置文件目录下

### Features

- 移除页面切换动画
- 更改 Tun 模式托盘图标颜色
- Portable 版本默认使用当前目录作为配置文件目录
- 禁用 Clash 字段过滤时隐藏 Clash 字段选项
- 优化拖拽时光标样式

### Bugs Fixes

- 修复 windows 下更新时没有关闭内核导致的更新失败的问题
- 修复打开文件报错的问题
- 修复 url 导入时无法获取中文配置名称的问题
- 修复 alpha 内核无法显示内存信息的问题

---

## v1.4.2

### Features

- update clash meta core to mihomo 1.17.0
- support both clash meta stable release and prerelease-alpha release
- fixed the problem of not being able to set the system proxy when there is a dial-up link on windows system [#833](https://github.com/zzzgydi/clash-verge/issues/833)
- support new clash field
- support random mixed port
- add windows x86 and linux armv7 support
- support disable tray click event
- add download progress for updater
- support drag to reorder the profile
- embed emoji fonts
- update depends
- improve UI style

---

## v1.4.1

### Features

- update clash meta core to newest 虚空终端(2023.11.23)
- delete clash core UI
- improve UI
- change Logo to original

---

## v1.4.0

### Features

- update clash meta core to newest 虚空终端
- delete clash core, no longer maintain
- merge Clash nyanpasu changes
- remove delay display different color
- use Meta Country.mmdb
- update dependencies
- small changes here and there

---

## v1.3.8

### Features

- update clash meta core
- add default valid keys
- adjust the delay display interval and color

### Bug Fixes

- fix connections page undefined exception

---

## v1.3.7

### Features

- update clash and clash meta core
- profiles page add paste button
- subscriptions url textfield use multi lines
- set min window size
- add check for updates buttons
- add open dashboard to the hotkey list

### Bug Fixes

- fix profiles page undefined exception

---

## v1.3.6

### Features

- add russian translation
- support to show connection detail
- support clash meta memory usage display
- support proxy provider update ui
- update geo data file from meta repo
- adjust setting page

### Bug Fixes

- center the window when it is out of screen
- use `sudo` when `pkexec` not found (Linux)
- reconnect websocket when window focus

### Notes

- The current version of the Linux installation package is built by Ubuntu 20.04 (Github Action).

---

## v1.3.5

### Features

- update clash core

### Bug Fixes

- fix blurry system tray icon (Windows)
- fix v1.3.4 wintun.dll not found (Windows)
- fix v1.3.4 clash core not found (macOS, Linux)

---

## v1.3.4

### Features

- update clash and clash meta core
- optimize traffic graph high CPU usage when window hidden
- use polkit to elevate permission (Linux)
- support app log level setting
- support copy environment variable
- overwrite resource file according to file modified
- save window size and position

### Bug Fixes

- remove fallback group select status
- enable context menu on editable element (Windows)

---

## v1.3.3

### Features

- update clash and clash meta core
- show tray icon variants in different system proxy status (Windows)
- close all connections when mode changed

### Bug Fixes

- encode controller secret into uri
- error boundary for each page

---

## v1.3.2

### Features

- update clash and clash meta core

### Bug Fixes

- fix import url issue
- fix profile undefined issue

---

## v1.3.1

### Features

- update clash and clash meta core

### Bug Fixes

- fix open url issue
- fix appimage path panic
- fix grant root permission in macOS
- fix linux system proxy default bypass

---

## v1.3.0

### Features

- update clash and clash meta
- support opening dir on tray
- support updating all profiles with one click
- support granting root permission to clash core(Linux, macOS)
- support enable/disable clash fields filter, feel free to experience the latest features of Clash Meta

### Bug Fixes

- deb add openssl depend(Linux)
- fix the AppImage auto launch path(Linux)
- fix get the default network service(macOS)
- remove the esc key listener in macOS, cmd+w instead(macOS)
- fix infinite retry when websocket error

---

## v1.2.3

### Features

- update clash
- adjust macOS window style
- profile supports UTF8 with BOM

### Bug Fixes

- fix selected proxy
- fix error log

---

## v1.2.2

### Features

- update clash meta
- recover clash core after panic
- use system window decorations(Linux)

### Bug Fixes

- flush system proxy settings(Windows)
- fix parse log panic
- fix ui bug

---

## v1.2.1

### Features

- update clash version
- proxy groups support multi columns
- optimize ui

### Bug Fixes

- fix ui websocket connection
- adjust delay check concurrency
- avoid setting login item repeatedly(macOS)

---

## v1.2.0

### Features

- update clash meta version
- support to change external-controller
- support to change default latency test URL
- close all connections when proxy changed or profile changed
- check the config by using the core
- increase the robustness of the program
- optimize windows service mode (need to reinstall)
- optimize ui

### Bug Fixes

- invalid hotkey cause panic
- invalid theme setting cause panic
- fix some other glitches

---

## v1.1.2

### Features

- the system tray follows i18n
- change the proxy group ui of global mode
- support to update profile with the system proxy/clash proxy
- check the remote profile more strictly

### Bug Fixes

- use app version as default user agent
- the clash not exit in service mode
- reset the system proxy when quit the app
- fix some other glitches

---

## v1.1.1

### Features

- optimize clash config feedback
- hide macOS dock icon
- use clash meta compatible version (Linux)

### Bug Fixes

- fix some other glitches

---

## v1.1.0

### Features

- add rule page
- supports proxy providers delay check
- add proxy delay check loading status
- supports hotkey/shortcut management
- supports displaying connections data in table layout(refer to yacd)

### Bug Fixes

- supports yaml merge key in clash config
- detect the network interface and set the system proxy(macOS)
- fix some other glitches

---

## v1.0.6

### Features

- update clash and clash.meta

### Bug Fixes

- only script profile display console
- automatic configuration update on demand at launch

---

## v1.0.5

### Features

- reimplement profile enhanced mode with quick-js
- optimize the runtime config generation process
- support web ui management
- support clash field management
- support viewing the runtime config
- adjust some pages style

### Bug Fixes

- fix silent start
- fix incorrectly reset system proxy on exit

---

## v1.0.4

### Features

- update clash core and clash meta version
- support switch clash mode on system tray
- theme mode support follows system

### Bug Fixes

- config load error on first use

---

## v1.0.3

### Features

- save some states such as URL test, filter, etc
- update clash core and clash-meta core
- new icon for macOS

---

## v1.0.2

### Features

- supports for switching clash core
- supports release UI processes
- supports script mode setting

### Bug Fixes

- fix service mode bug (Windows)

---

## v1.0.1

### Features

- adjust default theme settings
- reduce gpu usage of traffic graph when hidden
- supports more remote profile response header setting
- check remote profile data format when imported

### Bug Fixes

- service mode install and start issue (Windows)
- fix launch panic (Some Windows)

---

## v1.0.0

### Features

- update clash core
- optimize traffic graph animation
- supports interval update profiles
- supports service mode (Windows)

### Bug Fixes

- reset system proxy when exit from dock (macOS)
- adjust clash dns config process strategy

---

## v0.0.29

### Features

- sort proxy node
- custom proxy test url
- logs page filter
- connections page filter
- default user agent for subscription
- system tray add tun mode toggle
- enable to change the config dir (Windows only)

---

## v0.0.28

### Features

- enable to use clash config fields (UI)

### Bug Fixes

- remove the character
- fix some icon color

---

## v0.0.27

### Features

- supports custom theme color
- tun mode setting control the final config

### Bug Fixes

- fix transition flickers (macOS)
- reduce proxy page render

---

## v0.0.26

### Features

- silent start
- profile editor
- profile enhance mode supports more fields
- optimize profile enhance mode strategy

### Bug Fixes

- fix csp restriction on macOS
- window controllers on Linux

---

## v0.0.25

### Features

- update clash core version

### Bug Fixes

- app updater error
- display window controllers on Linux

### Notes

If you can't update the app properly, please consider downloading the latest version from github release.

---

## v0.0.24

### Features

- Connections page
- add wintun.dll (Windows)
- supports create local profile with selected file (Windows)
- system tray enable set system proxy

### Bug Fixes

- open dir error
- auto launch path (Windows)
- fix some clash config error
- reduce the impact of the enhanced mode

---

## v0.0.23

### Features

- i18n supports
- Remote profile User Agent supports

### Bug Fixes

- clash config file case ignore
- clash `external-controller` only port
