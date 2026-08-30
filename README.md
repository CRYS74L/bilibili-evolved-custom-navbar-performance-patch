# Bilibili Evolved 自定义顶栏性能补丁

这是一个面向 **Bilibili Evolved 2.11.3 自定义顶栏**的 Violentmonkey 用户脚本，用于缓解在消息、动态、追番、待看、收藏和历史等悬停卡片之间快速切换、滚动时出现的严重渲染卡顿。

## 安装

1. 确保浏览器已安装 [Violentmonkey](https://violentmonkey.github.io/) 和 Bilibili Evolved，并启用了 Bilibili Evolved 的自定义顶栏。
2. 打开[脚本原始文件](https://raw.githubusercontent.com/CRYS74L/bilibili-evolved-custom-navbar-performance-patch/main/Bilibili-Evolved-%E8%87%AA%E5%AE%9A%E4%B9%89%E9%A1%B6%E6%A0%8F%E6%80%A7%E8%83%BD%E8%A1%A5%E4%B8%81.user.js)。
3. 在 Violentmonkey 的安装页面确认安装，然后刷新 Bilibili 页面。

## 问题原因

Bilibili Evolved 的自定义顶栏会给弹出卡片的全部后代元素设置 `transition: all`，同时通过关键帧改变可继承的 `pointer-events`。快速切换悬停卡片时，Chromium 会反复重算大型弹出卡片子树。

其中“待看”组件会一次创建最多 999 张卡片、超过 11,000 个后代节点，是持续卡顿的主要放大器。

## 补丁做了什么

- 保留颜色、透明度、位移、尺寸等视觉过渡，但不再让 `pointer-events` 参与整棵子树的离散过渡。
- 直接设置悬停弹窗的最终指针状态，移除只用于切换 `pointer-events` 的关键帧动画。
- 完整保留 999 张“待看”卡片、滚动范围、排序、链接和事件，只渲染当前视口及前后缓冲区内约 15–23 张卡片。
- 不缓存或拦截 Bilibili 接口，不改变“待看”数据的实时刷新行为。

## 验证结果

以下数据来自 Microsoft Edge 中相同页面、相同账号数据和相同快速悬停序列，仅用于说明该环境下的改进幅度：

| 项目 | 修复前 / 中间版本 | v1.3.0 |
| --- | ---: | ---: |
| 10 次快速顶栏切换的主线程任务耗时 | 约 1,813 ms | 626–686 ms |
| 单次最大布局更新 | 约 1.34 s | 20.9 ms |
| “待看”同时参与渲染的卡片 | 999 | 15–23 |

真实滚轮测试中，列表仍保留 999 张卡片和 98,356 px 的滚动高度；滚动前后视口图片、链接和指针交互均正常。

进入“待看”时仍可能出现一次约 117–121 ms 的短暂停顿，追踪显示它来自 Bilibili Evolved 重新读取 `/x/v2/history/toview/web` 的响应。本补丁没有通过缓存请求消除它，以免影响数据实时性。

## 兼容范围

- 已验证：Microsoft Edge、Violentmonkey、Bilibili Evolved 2.11.3。
- 匹配页面：`t.bilibili.com`、`www.bilibili.com`、`space.bilibili.com`、`search.bilibili.com`。
- Bilibili Evolved 后续若调整自定义顶栏 DOM 或样式，补丁可能需要同步更新。

## 回退

在 Violentmonkey 中禁用或删除本脚本并刷新页面，即可恢复 Bilibili Evolved 原始行为。本脚本不修改账号数据、Bilibili Evolved 配置或 Violentmonkey 数据库。

## 许可证

本仓库当前未附加开源许可证。除法律明确允许的情形外，保留所有权利。

