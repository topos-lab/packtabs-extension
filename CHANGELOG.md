# Changelog

All notable changes to the **PackTabs** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) alongside the
**Even/Odd Release Strategy** (Even minors for stable store releases, odd minors for active development).

---

## [1.5.0] - In Development

### Added
- 

### Fixed
- 

---

## [1.4.0] - 2026-11-20

### Added
- **History Snapshot Deduplication (Latest-Wins)**: Automatically removes older history snapshots (`isHistory: true`) that have the exact same tab list as a newly saved closed-window snapshot, keeping only the latest entry without touching permanently saved named groups or polluting deletion tombstones.
  - Added atomic `saveHistoryTabGroup` and `normalizeTabUrl` in `utils/storage.ts` and unified URL normalization in `utils/tabManager.ts`.
  - Updated `entrypoints/background.ts` (`windows.onRemoved` and `recoverPendingHistoryGroups`) to deduplicate history snapshots via `saveHistoryTabGroup`.
- **Configurable History Retention Limit**: Exposed `maxHistoryGroups` (`10` / `25` / `50` / `100`) in `components/SettingsModal.vue`, backed by cross-context settings synchronization (`composables/useSettings.ts`).
- **Overflow-Only Tab Tooltips & Direct Click Open**: Tab rows (`components/TabItemRow.vue`, `components/StartupRestorer.vue`) now open tabs directly on click (`Ctrl/Cmd/Shift + Click` or middle-click in background), move interaction hints cleanly to card footers/empty states, and show full title + URL tooltips only when titles overflow.

### Fixed
- **Multi-Window Dashboard Launch & Current Tabs Scope**: Fixed an issue where clicking the extension icon or triggering the shortcut in a second browser window opened/switched to the dashboard in the first browser window and displayed the first window's tabs.
  - Updated `action.onClicked` and `commands.onCommand` handlers in `entrypoints/background.ts` to forward the active tab's `windowId` and resolve the focused normal window as fallback (`resolveTargetWindowId`).
  - Scoped existing dashboard tab lookup inside `openOrFocusDashboard` to the target window so each browser window maintains its own dashboard tab without stealing focus across windows.
  - Added `getCurrentWindowId` in `utils/tabManager.ts` (preferring `browser.tabs.getCurrent()?.windowId` with `browser.windows.getCurrent()` fallback) so current-tab capture, restoration, and close-window-after-save always operate on the dashboard's actual window.
- **Duplicate History Snapshot on Close-After-Save & Window Close Races**: Cleared active window session cache (`clearWindowSessionTabs`) before closing the window after saving a group, cancelled pending debounced sync timers on window closing (`tabs.onRemoved` / `windows.onRemoved`), removed unsafe in-memory cold-start fallback in `entrypoints/background.ts`, added a 5-minute TTL to deleted history tombstones, and enabled cross-context `navigator.locks` mutex coordination in `utils/storage.ts`.
- **UI, Reactivity, Accessibility & Localization Polish**:
  - Rendered `<ToastContainer />` in Startup Restorer mode as well so startup/settings feedback is visible.
  - Auto-refreshed `Current Tabs` on window focus/visibility while preserving manually excluded tabs, cleared stale `searchQuery` across view switches, and fixed history date search in `App.vue`.
  - Fixed `utils/date.ts` locale cache invalidation across both full/short formatters, fixed invisible dark-mode moon icon in `SettingsModal.vue`, prevented duplicate error toasts, added `nextTick` input focus for inline renaming, unified CTA styling, and cleaned up dead code and redundant `_locales` entries.

### 📦 Chrome Web Store & Firefox AMO Release Notes (For Store Submission)

#### English (en-US):
```text
What's new in PackTabs v1.4.0:
- Multi-Window Support: Opening PackTabs from any browser window now stays scoped to that window and captures its own tabs.
- Smarter History Snapshots: Automatically deduplicates identical closed-window snapshots, avoids duplicate snapshots when closing a window after saving, and lets you configure history retention limits (10 / 25 / 50 / 100) in Settings.
- Smoother Tab Browsing: Click any saved tab to open it directly (Ctrl/Cmd/Shift + Click or middle-click for background), with cleaner overflow-only title/URL tooltips and automatic Current Tabs refresh.
- UI & Accessibility Polish: Fixed Startup Restorer notifications, light-mode theme icons, inline rename auto-focus, search isolation, and multi-language formatting.
```

#### 简体中文 (zh-CN):
```text
PackTabs v1.4.0 本次更新：
- 多窗口独立隔离：在任意浏览器窗口打开 PackTabs 时，仅聚焦该窗口的管理页并捕获当前窗口标签页。
- 更智能的历史快照：自动去重相同标签集合的关闭窗口快照，保存后关闭窗口不再产生重复历史记录，并可在设置中自定义历史快照保留上限（10 / 25 / 50 / 100）。
- 更流畅的标签交互：单击即可直接打开已保存标签页（Ctrl/Cmd/Shift + 单击或中键后台打开），悬浮提示仅在标题溢出时展示完整标题与网址，切回面板自动刷新当前窗口标签。
- 界面与细节打磨：修复启动恢复页通知显示、浅色模式图标对比度、行内重命名自动聚焦、历史搜索隔离及多语言日期格式问题。
```

---

## [1.2.0] - 2026-11-01

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
