# Changelog

All notable changes to the **PackTabs** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) alongside the
**Even/Odd Release Strategy** (Even minors for stable store releases, odd minors for active development).

---

## [1.1.0] - In Development

### Added
- **Official Extension Store Links & Badges**: Added Chrome Web Store and Mozilla Firefox Add-ons install links and status badges to `README.md` and user guides.
- **Dynamic Version Resolution in Dashboard**: Refactored the dashboard "About" dialog to dynamically query extension version from `browser.runtime.getManifest().version`, guaranteeing a single source of truth across all views.
- **Local File Startup Intelligence**: Added unit tests in `tests/unit/localFileStartup.test.ts` covering race condition handling (`pendingUrl`), standalone local documents (`file://`), and multi-file launches.

### Fixed
- **Local File Viewing Interruption**: Fixed an issue where double-clicking a local PDF (`.pdf`) or HTML (`.html`) file in the operating system file manager caused the PackTabs Startup Restorer (`/dashboard.html?mode=startup`) to automatically open and steal foreground focus.
  - Introduced `isLocalFileStartup` guard in `utils/tabManager.ts` to inspect initial window tabs.
  - Automatically skips launching the Startup Restorer tab when the browser is launched specifically to view local files.
  - Preserves silent background history snapshots (`recoverPendingHistoryGroups`) so previous unclosed sessions remain 100% safe.

---

### 📦 Chrome Web Store & Firefox AMO Release Notes (For Store Submission)

> When releasing a version to the Chrome Web Store and Firefox Add-ons (AMO), copy the text below into the "What's new in this version" / "Release Notes" field:

#### English (en-US):
```text
What's new in PackTabs:
- Fixed an issue where opening a local PDF or HTML file from your desktop/file manager inadvertently triggered the Startup Restorer, streamlining cold start detection for a distraction-free reading experience.
```

#### 简体中文 (zh-CN):
```text
PackTabs 本次更新：
- 修复了在系统文件管理器中打开本地 PDF 或 HTML 文件时意外弹出启动恢复页的问题；优化冷启动意图检测，带来更纯净无干扰的本地文档阅读体验。
```

---

## [1.0.0] - 2026-10-06

### Added
- **One-Click Session Capture**: Instantly capture all open tabs across the current browser window into an organized group.
- **Automatic History Snapshots**: Silently preserves open tabs upon window or browser closing, ensuring zero data loss across restarts or crashes.
- **Startup Restorer**: Dedicated `/dashboard.html?mode=startup` view to quickly resume previous sessions or select saved workspaces.
- **Drag-and-Drop Categorization**: Seamlessly reorder and categorize tabs between current tabs and saved groups.
- **Silent Background Tab Opening**: Open individual links in the background without switching tabs via `Ctrl/Cmd/Shift + Click`.
- **Tri-State Theme System**: Light, Dark, and System (Auto) theme modes styled with Tailwind CSS v4 and Zinc palette.
- **Accessible Headless UI**: Built with Radix Vue and Lucide Vue Next without bulky UI frameworks.
- **Configurable Global Shortcut**: Quick launcher configurable via browser shortcut settings (default: `Alt+Shift+K` on Windows/Linux, `Command+Shift+K` on macOS).
- **Internationalization (i18n)**: Full localization support for English, Simplified Chinese (zh-CN), and Traditional Chinese (zh-TW).
- **High-Capacity Storage Architecture**: Atomic sharded persistence under `local:tabGroups` bypassing Sync's 8KB quota, paired with `sync:settings` for preferences.
