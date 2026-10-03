# Chrome Web Store & Firefox AMO Listing — PackTabs

> Last Updated: 2026-10-03
> Release Version: 1.0.0

---

## 1. Store Listing Information (商店列表基本信息)

### Extension Name (扩展名称) [REQUIRED]
`PackTabs - Task Tab & Session Manager`
*(中文: PackTabs - 任务标签页与会话管理器)*

### Short Description (简短描述 - 最大 132 字符) [REQUIRED]
- **English (103 chars)**:
  `Save open tabs for unfinished tasks in one click and restore your workspace anytime without bookmark clutter.`
- **Simplified Chinese (56 字符)**:
  `一键保存未完成任务的标签页，告别杂乱书签栏，随时瞬间恢复专注工作区。`

---

### Detailed Description (长描述 - 用于 CWS / AMO 详情页) [REQUIRED]

#### English Version:
```text
PackTabs is a task-oriented tab and session manager that helps you switch contexts and organize unfinished projects with zero bookmark clutter.

Tired of leaving 50+ open tabs running or cluttering your permanent bookmarks with temporary research links? PackTabs allows you to capture all open tabs from your current window into clean, dedicated workspace groups with a single click.

KEY FEATURES
- One-Click Tab Packing: Capture every open tab in your active window instantly with a clear timestamp or custom project name.
- Instant Workspace Restoration: Restore an entire tab group or launch individual tabs in one click. Open tabs in the background using Ctrl/Cmd/Shift + Click.
- Automatic History Snapshots: Never lose tabs when closing browser windows. Closed windows are automatically captured as recoverable session snapshots.
- Startup Restorer: Easily pick up right where you left off when restarting your browser.
- Clean Drag-and-Drop Organization: Drag tabs between groups or into current tasks effortlessly.
- Lightning Fast & Accessible: Full keyboard navigation (Alt+Shift+K to toggle), theme adaptive (Dark/Light mode), and zero performance overhead.

PRIVACY & SECURITY FIRST
- 100% Offline & Private: All your saved tab groups are persisted exclusively on your local machine using Chrome local storage.
- No External Requests: Zero analytics, zero telemetry, zero tracking scripts, and no external servers.
- No Bookmark Clutter: Keeps your permanent browser bookmarks clean and pristine for real long-term links.

HOW TO USE
1. Click the PackTabs extension icon or press Alt+Shift+K (Command+Shift+K on macOS).
2. Review open tabs in the current window and click "Save as Tab Group".
3. Whenever you are ready to resume work, open PackTabs and click "Open All" to bring back your workspace.

Support & Feedback: https://github.com/topos-lab/packtabs-extension/issues
```

#### 简体中文版 (Simplified Chinese):
```text
PackTabs 是一款面向任务与专注力设计的标签页与工作区会话管理器，助你轻松进行任务上下文切换，告别杂乱的临时书签。

你是否经常因为手头任务没做完而在浏览器中堆积几十个标签页？或者将大量临时工作资料存进书签栏，导致书签混乱不堪？PackTabs 让你一键打包当前窗口的所有标签页，随时一键完整恢复工作区。

核心功能特性：
- 一键打包标签页：瞬间将当前窗口的所有打开标签保存为独立的分组，自动记录时间或自定义项目名称。
- 极速工作区恢复：一键恢复完整标签页分组，或单独打开指定页面。支持按住 Ctrl/Cmd/Shift 点击在后台静默打开。
- 自动历史快照（History Snapshots）：关闭浏览器窗口时自动捕获会话快照，防止意外丢失重要资料。
- 开机/启动恢复器（Startup Restorer）：重新打开浏览器时，快速选择并继续上一场未完成的探索。
- 拖拽归类与整理：支持在分组间自由拖拽移动标签页，直观分类整理。
- 极简高响应与全键盘支持：快捷键（Alt+Shift+K / Mac 上 Command+Shift+K）即开即用，原生支持深色/浅色自适应模式，无任何多余体积包袱。

隐私与安全承诺：
- 100% 纯本地离线运行：所有保存的标签页数据仅保存在您的本地浏览器（Chrome 本地存储）中。
- 零外部请求：无任何数据采集、无第三方统计分析、无跟踪代码，不架设任何外部服务器。
- 不污染书签栏：临时工作流与永久书签彻底分离，还你清爽的书签栏。

使用方法：
1. 点击浏览器右上角 PackTabs 图标，或按下快捷键 Alt+Shift+K（Mac 用户请按 Command+Shift+K）。
2. 在当前窗口标签列表中确认内容，点击“保存为标签组”。
3. 当需要恢复工作任务时，打开管理器点击“全部打开”即可瞬间还原整个工作区。

问题反馈与开源支持：https://github.com/topos-lab/packtabs-extension/issues
```

---

### Category (分类) [REQUIRED]
- **Chrome Web Store**: `Productivity` (生产工具)
- **Firefox AMO**: `Tabs` (标签页管理) / `Productivity` (效率)

### Single Purpose Statement (单一用途声明) [REQUIRED]
- **English**:
  `PackTabs captures, organizes, and restores browser tab sessions into task-based workspace groups with a single click.`
- **Chinese**:
  `PackTabs 提供一键捕获、本地组织并瞬间恢复浏览器任务标签页会话的单一核心功能。`

### Primary Language (主要语言) [REQUIRED]
`English (en)` (同时内置简体中文 `zh_CN` 与繁体中文 `zh_TW` 完整翻译)

---

## 2. Permissions Justification (权限申请与合规陈述)

> **审核提示**：Chrome Web Store 与 Firefox AMO 审查团队会逐字核验此处声明与代码调用的对应关系。

| Permission (权限名称) | Type (类型) | Platform (生效平台) | Justification (详细用途合规陈述) |
| :--- | :--- | :--- | :--- |
| `tabs` | permissions | Chrome & Firefox | **必须权限**。用于查询当前窗口中打开标签页的 URL 和标题，以便将其打包保存为标签组；并在用户点击“全部打开”或“打开单个”时，创建新标签页恢复页面。扩展绝不读取页面 DOM 内容，绝不监听用户日常网页交互。 |
| `storage` | permissions | Chrome & Firefox | **必须权限**。用于将用户保存的标签页分组和历史快照持久化保存在客户端浏览器的本地存储（`chrome.storage.local`，上限 10MB），以及在多设备间同步用户界面偏好设置（如暗黑模式、启动时行为）。所有业务数据均在设备本地，绝不上传到任何开发者私有服务器。 |
| `favicon` | permissions | Chrome 专属 | **UI 体验权限**。用于通过 Chrome 官方提供的安全 `_favicon` 内部接口（`chrome-extension://${id}/_favicon/?pageUrl=...`）获取并展示已保存标签页的网站图标，使用户能直观识别已保存的网页。 |

---

## 3. Privacy & Data Use Disclosure (数据与隐私披露)

### Data Collection Assessment (数据收集评估)
- **Does the extension collect user data? (是否收集用户个人数据？)**: **NO (否)**
- **Does the extension transmit data off-device? (是否向设备外部传输数据？)**: **NO (否)**（除 Chrome 浏览器自带的 `chrome.storage.sync` 偏好同步服务由 Google 官方处理外，无任何外部网络请求）

| Data Type (数据类型) | Collected? (是否收集) | Transmitted? (是否外传) | Purpose (用途) | Shared with Third Parties? (共享第三方) |
| :--- | :---: | :---: | :--- | :---: |
| Personally Identifiable Info | **No** | **No** | N/A | **No** |
| Financial & Payment Info | **No** | **No** | N/A | **No** |
| Authentication / Passwords | **No** | **No** | N/A | **No** |
| Personal Communications | **No** | **No** | N/A | **No** |
| Location Information | **No** | **No** | N/A | **No** |
| Web Browsing History | **No** | **No** | N/A (仅在用户显式操作时保存当前窗口选定标签页) | **No** |
| User Activity / Analytics | **No** | **No** | N/A | **No** |
| Website Content | **No** | **No** | N/A | **No** |

### Data Use Certifications (数据合规声明勾选)
- [x] Data is NOT sold to third parties (数据绝不出售给任何第三方).
- [x] Data is NOT used for purposes unrelated to the extension's core functionality (数据绝不用于与核心功能无关的用途).
- [x] Data is NOT used for creditworthiness, lending, or advertising (数据绝不用于信贷评估或广告定向).

---

## 4. Graphics & Asset Requirements (图形资产规范)

| Asset (资产类别) | Dimensions (分辨率) | Status (状态) | Path / Notes (文件路径与要求) |
| :--- | :--- | :--- | :--- |
| **Store Icon** [REQUIRED] | 128×128 PNG | ✅ **Ready** | `public/icon/128.png` (矢量导出高精图标) |
| **Screenshot 1** [REQUIRED] | 1280×800 PNG | ✅ **Ready** | `docs/screenshots/current-tabs-light-en.png` (当前窗口检视与一键打包) |
| **Screenshot 2** [RECOMMENDED] | 1280×800 PNG | ✅ **Ready** | `docs/screenshots/saved-group-light-en.png` (工作区一键复原与静默打开) |
| **Screenshot 3** [RECOMMENDED] | 1280×800 PNG | ✅ **Ready** | `docs/screenshots/history-group-light-en.png` (自动历史快照防丢失) |
| **Screenshot 4** [RECOMMENDED] | 1280×800 PNG | ✅ **Ready** | `docs/screenshots/startup-page-light-en.png` (开机/启动恢复器) |
| **Screenshot 5** [RECOMMENDED] | 1280×800 PNG | ✅ **Ready** | `docs/screenshots/theme-comparison-en.png` (深浅色对角切分对比与隐私) |
| **Small Promo Tile** | 440×280 PNG/JPEG | ⬜ 可选推荐 | 用于 Chrome Web Store 搜索列表与推荐位展示 |
| **Marquee Promo Tile** | 1400×560 PNG/JPEG | ⬜ 可选推荐 | 商店大图轮播展示 |

---

## 5. Firefox AMO Specific Settings (Firefox 专属配置)

- **Gecko ID**: `packtabs@topos-lab.github.io` (已在 `wxt.config.ts` 中配置)
- **Minimum Firefox Version**: `109.0`
- **Data Collection Compliance**: `data_collection_permissions: { required: ['none'] }` (符合 2025 年 11 月新规)
- **Sources Package**: `.output/packtabs-extension-1.0.0-sources.zip`（WXT 构建自动生成，包含未混淆源码及构建说明，提交流程中上传至 "Source code" 项即可）

---

## 6. Distribution & Developer Contact (分发与开发者信息)

- **Visibility**: Public (公开)
- **Pricing**: Free (免费开源)
- **Privacy Policy URL**: `https://topos-lab.github.io/packtabs-extension/`
- **Support / Issue Tracker**: `https://github.com/topos-lab/packtabs-extension/issues`
- **Source Code Repository**: `https://github.com/topos-lab/packtabs-extension`
