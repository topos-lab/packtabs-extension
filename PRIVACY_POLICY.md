# Privacy Policy for PackTabs

**Last Updated:** October 3, 2026  
**Effective Date:** October 3, 2026

---

## English Version

### 1. Overview
PackTabs ("we", "our", or "the extension") is a lightweight, task-oriented browser tab and session manager built for Google Chrome, Mozilla Firefox, and compatible Chromium browsers. We are deeply committed to respecting and protecting your privacy.

**Our core philosophy is simple: Your tabs and workspace data belong exclusively to you. PackTabs operates 100% locally on your machine and never transmits your data to external servers.**

---

### 2. What Information We Handle
PackTabs only accesses and stores the minimum necessary information required to deliver its core functionality:
- **Tab Titles and URLs**: When you explicitly choose to save your open tabs as a group, or when closed windows are captured as automatic history snapshots, PackTabs saves the URLs and page titles of those tabs.
- **Website Favicons**: Cached website favicon URLs (or Chrome's secure `_favicon` internal resolver) to display recognizable site icons inside your dashboard.
- **Timestamps**: Creation and update timestamps for organizing tab groups chronologically.
- **User Preferences**: UI configuration choices, such as your active theme (light/dark/system mode), language preference, and startup restore behavior.

**We do NOT collect:**
- Personally identifiable information (name, email, IP address, device IDs)
- Passwords, credentials, or session cookies
- Form data, financial details, or web page DOM content
- Full browsing history outside the explicitly saved or snapshot tabs

---

### 3. How Your Data Is Stored
- **Local Storage (`chrome.storage.local`)**: All saved tab groups, custom names, and history snapshots are stored directly on your computer's local hard drive within your browser profile's storage sandbox (up to 10MB capacity).
- **Settings Sync (`chrome.storage.sync`)**: Non-sensitive UI preferences (such as dark mode toggle and startup restore settings) may be synchronized across your own browser instances signed into the same browser profile via your browser vendor's secure synchronization infrastructure (e.g., Google Account Sync). No tab URLs or group titles are transmitted via sync.
- **No Developer Servers**: We do not operate, host, or maintain any external backend databases or servers. Your data never touches our infrastructure because we do not have one.

---

### 4. Permissions Usage
PackTabs requests only the minimum set of permissions strictly necessary for its features:
- `tabs`: Required to detect open tabs in your current window to save them, and to open tabs when you click "Open All" or "Restore". PackTabs never injects background scripts into web pages or monitors keystrokes.
- `storage`: Required to save your tab groups and preferences across browser sessions.
- `favicon` *(Chrome only)*: Required to render tab icons safely via Chrome's official `_favicon` internal endpoint.

---

### 5. Third-Party Services & Analytics
- **Zero Telemetry**: PackTabs contains **no** third-party analytics (such as Google Analytics, Mixpanel, or Amplitude).
- **Zero Advertising**: There are no advertisements, trackers, marketing beacons, or monetization SDKs embedded within the extension.
- **No Remote Code**: In strict compliance with Manifest V3 policies, all code executed by PackTabs is bundled directly inside the extension package. No code is ever fetched from remote CDNs.

---

### 6. Data Sharing and Sale
We will **never** sell, rent, monetize, trade, or share your data with data brokers, advertisers, or third parties under any circumstances.

---

### 7. User Control & Data Deletion
You retain complete control over your data at all times:
- **Delete Specific Items**: You can delete individual tabs or entire tab groups directly inside the PackTabs manager interface at any time.
- **Complete Erasure**: Uninstalling the PackTabs extension from your browser immediately and permanently removes all stored tab groups, history snapshots, and configuration settings from your local drive.

---

### 8. Changes to This Policy
If we make changes to this privacy policy, we will update the "Last Updated" date at the top of this document. Any material changes will be documented in our release notes on the Chrome Web Store, Firefox Add-ons, and GitHub repository.

---

### 9. Contact Us
If you have any questions, feedback, or concerns regarding this Privacy Policy, please open an issue on our public repository:
- **GitHub Repository**: [https://github.com/wesley-chen/packtabs-extension](https://github.com/wesley-chen/packtabs-extension)
- **Issue Tracker**: [https://github.com/wesley-chen/packtabs-extension/issues](https://github.com/wesley-chen/packtabs-extension/issues)

---

## 简体中文版 (Simplified Chinese Version)

### 1. 概述
PackTabs（“我们”或“本扩展”）是一款专为 Google Chrome、Mozilla Firefox 及 Chromium 系列浏览器设计的轻量级任务标签页与会话管理器。我们高度重视并严格保护您的隐私权益。

**我们的核心隐私原则：您的标签页与工作区数据完全归您个人所有。PackTabs 100% 纯本地离线运行，绝不向任何外部服务器上传您的任何浏览数据。**

---

### 2. 我们处理的数据类型
PackTabs 仅访问并存储实现核心功能所必需的最低限度数据：
- **标签页标题与网址 (URL)**：当您主动点击将当前窗口保存为分组，或关闭窗口被记录为自动历史快照时，扩展会暂存相关标签页的 URL 及页面标题。
- **网站图标 (Favicon)**：用于在管理仪表盘中展示已保存站点的辨识图标。
- **时间戳**：用于按时间先后顺序整理和归档标签分组。
- **偏好设置**：您的界面配置项（如深色/浅色模式、语言选择、浏览器启动时的恢复行为）。

**我们绝不收集：**
- 个人身份敏感信息（姓名、邮箱、IP 地址、设备标识符）
- 密码、登录凭据或 Session Cookies
- 任何网页表单输入、金融支付信息或页面内部正文 DOM
- 未主动保存或未在快照中的常规网络浏览记录

---

### 3. 数据存储与安全机制
- **本地存储 (`chrome.storage.local`)**：所有保存的标签页组、自定义命名和历史快照均存储在您计算机本地的浏览器用户配置目录中（享有 10MB 独立沙箱配额）。
- **设置同步 (`chrome.storage.sync`)**：仅非敏感的界面偏好设置（如暗黑模式、启动时开关）会通过您浏览器自带的官方账号系统（如 Google 账号）在您登录的个人设备间进行安全同步。标签页的具体 URL 绝不同步至外部。
- **无开发者自建服务器**：我们没有架设、租用或维护任何外部后台服务器。由于根本不存在自建服务器，您的数据在物理上无法被上传至任何第三方。

---

### 4. 浏览器权限用途声明
PackTabs 仅申请实现必要功能所必需的权限：
- `tabs`（标签页）：用于获取当前窗口中已打开标签页的标题与地址以进行打包，并在用户点击“全部打开”时重新打开网页。本扩展绝不在网页中注入追踪脚本，亦不监听键盘操作。
- `storage`（存储）：用于跨会话保存您的标签页分组与偏好设置。
- `favicon`（网站图标，仅 Chrome）：用于通过 Chrome 官方安全的 `_favicon` 接口渲染标签页图标。

---

### 5. 第三方服务与分析工具
- **零遥测与零分析**：PackTabs **不包含**任何第三方数据分析工具（如 Google Analytics、Mixpanel 等）。
- **零商业广告**：扩展内无任何广告植入、无跟踪器代码、无任何形式的商业变现 SDK。
- **无远程代码**：严格遵守 Manifest V3 安全规范，所有执行代码均直接打包在扩展安装包内部，绝不在运行时动态加载任何远程代码或外部脚本。

---

### 6. 数据共享与出售
我们承诺：**在任何情况下，绝不出售、出租、转让或与任何第三方、广告商、数据中间商共享您的任何数据。**

---

### 7. 用户权利与数据删除
您对自身数据享有完全的支配权：
- **随时删除**：您可以在管理面板中随时删除任意标签页、单个标签组或清空历史快照。
- **彻底清除**：在浏览器中卸载 PackTabs 扩展，将立即并永久地从您的本地磁盘中删除所有保存的标签页数据和配置信息，不留任何残留。

---

### 8. 隐私政策的更新
若我们对本隐私政策做出任何修订，将会在文档顶部更新“最后更新日期”。重大变更将通过扩展更新日志和 GitHub 开源仓库向用户公示。

---

### 9. 联系方式与问题反馈
如果您对本隐私政策有任何疑问或改进建议，欢迎通过我们的开源社区进行反馈：
- **开源代码仓库**：[https://github.com/wesley-chen/packtabs-extension](https://github.com/wesley-chen/packtabs-extension)
- **Issue 讨论区**：[https://github.com/wesley-chen/packtabs-extension/issues](https://github.com/wesley-chen/packtabs-extension/issues)
