# Changelog

All notable changes to the **PackTabs** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) alongside the
**Even/Odd Release Strategy** (Even minors for stable store releases, odd minors for active development).

---

## [1.1.0] - In Development

### Added
- **Automated Extension Store Submission**: Added `scripts/submit.ts`, `.env.submit.example`, and comprehensive documentation in `docs/STORE_API_KEY_GUIDE.md` for zero-friction publishing to Chrome Web Store (API v2 Service Accounts) and Firefox AMO.
- **Official Extension Store Links & Badges**: Added Chrome Web Store and Mozilla Firefox Add-ons install links and status badges to `README.md` and user guides.
- **Dynamic Version Resolution in Dashboard**: Refactored the dashboard "About" dialog to dynamically query extension version from `browser.runtime.getManifest().version`, guaranteeing a single source of truth across all views.
- **Local File Startup Intelligence**: Added unit tests in `tests/unit/localFileStartup.test.ts` covering race condition handling (`pendingUrl`), standalone local documents (`file://`), and multi-file launches.

### Fixed
- **External App & Local File Launch Interruption**: Fixed an issue where launching the browser from external desktop applications (e.g. Blizzard Battle.net, chat/email apps) or opening local files (PDF/HTML) inadvertently triggered the Startup Restorer (`/dashboard.html?mode=startup`) and stole foreground focus.
  - Introduced `isBlankStartupTab` in `utils/tabManager.ts` with navigation race condition protection (`pendingUrl`).
  - Restricts the Startup Restorer to only replace genuinely empty initial tabs in-place, silently skipping targeted navigation launches.
  - Preserves silent background history snapshots (`recoverPendingHistoryGroups`) so unclosed sessions remain 100% safe.

---

### 📦 Chrome Web Store & Firefox AMO Release Notes (For Store Submission)

> When releasing a version to the Chrome Web Store and Firefox Add-ons (AMO), copy the text below into the "What's new in this version" / "Release Notes" field:

#### English (en-US):
```text
What's new in PackTabs:
- Fixed an issue where launching the browser from external desktop apps (e.g. Blizzard Battle.net) or opening local files (PDF/HTML) inadvertently triggered the Startup Restorer, streamlining cold start detection for distraction-free browsing.
```

#### 简体中文 (zh-CN):
```text
PackTabs 本次更新：
- 修复了从外部桌面应用（如暴雪战网等）点击链接唤起浏览器或打开本地文件时意外弹出启动恢复页的问题；优化冷启动检测，带来纯净无干扰的浏览体验。
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
