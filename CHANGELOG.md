# Changelog

All notable changes to the **PackTabs** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) alongside the
**Even/Odd Release Strategy** (Even minors for stable store releases, odd minors for active development).

---

## [1.5.0] - In Development

### Added
- **Quick Action Popup (`entrypoints/popup/`)**: Added a compact `280px` toolbar popup featuring a single-click "Save current window tabs" launcher (opening/focusing Dashboard Current Tabs in the active window) and a clean name-only Saved Groups list (click to open in current window, `Shift+Click` or hover `↗` icon to open in a new window).
- **Dual-Mode Window Opening (`openTabsInNewWindow`)**: Paired text-only "Open All" / "Restore Session" buttons (`Shift+Click` for new window) with an adjacent `ExternalLink` (`↗`) icon button across `CollectionDetail.vue`, `TabGroupCard.vue`, `StartupRestorer.vue`, and `entrypoints/popup/App.vue` to launch an entire group in a newly created focused window.
- **5-Second Undo Toast Protection & Inline History Conversion**:
  - Extended `composables/useToast.ts` and `components/ui/toast/ToastContainer.vue` with interactive action buttons and hover pause/resume timers, plus `restoreGroup` (`stores/useTabStore.ts`) and `clearDeletedHistorySignature` (`utils/storage.ts`).
  - Replaced blocking delete and history-naming modals across `CollectionDetail.vue`, `TabGroupCard.vue`, `StartupRestorer.vue`, and Current Tabs exclusions with immediate actions + 5-second Undo toasts and inline card-header naming.
- **Unobtrusive Hover-Only Organization in Startup Restorer (`components/StartupRestorer.vue`)**: Added `CardHeader`-hover/focus-only group delete (`Trash2`) and inline history save (`BookmarkPlus`) grouped beside card titles so "Open All" and `[↗]` stay flush right without reserved blank space, sibling row `×` delete (auto-removing emptied history snapshots), direct drag-and-drop without persistent drag icons (copying from history to saved groups while preserving history, and moving between saved groups), and a concise footer hint covering drag-to-group organization.
- **Theme-Aware Instant Tooltips & Neutral Toast Cards (`components/ui/tooltip/Tooltip.vue`, `components/ui/toast/ToastContainer.vue`)**: Replaced native OS browser `title` tooltips on action buttons across Dashboard, Startup Restorer, Quick Popup, Settings, and Tab Rows with `300ms`-delayed (`skipDelayDuration: 300`), animation-free, light/dark theme-compatible Radix Vue `<Tooltip>` instances; redesigned Toast notifications as unified neutral floating cards (`bg-white dark:bg-[#27272c]`) with semantic status icons and Indigo Undo buttons.

### Changed
- **Current Tabs Action Bar & About Modal Refinement (`entrypoints/dashboard/App.vue`, `components/SettingsModal.vue`)**: Restored an inline "Close window after save" switch directly next to the primary Save button in Current Tabs (removing it from `SettingsModal.vue`) so users can toggle closing behavior per save; simplified the About PackTabs modal by removing the redundant brand card/logo in favor of the header title + tagline and displaying dev build timestamps (`1.5.0 (dev · YYYY-MM-DD HH:mm)`) on odd-minor builds.
- **Toolbar Icon, Delete Alignment & Card Action Refinement**: Styled `[data-open-new-window]` buttons cleanly without background fill or border to match row/group delete icons, normalized spacing across group action toolbars, pixel-aligned card delete buttons (`Trash2`) with row delete buttons (`×`) across `TabItemRow.vue`, `TabGroupCard.vue`, and `StartupRestorer.vue`, refined Chinese phrasing for saving history groups (`保存为分组`), and removed the redundant History Snapshot explicit "Save" text button in `components/TabGroupCard.vue` in favor of title-hover inline conversion.
- **Tab Row Delete Visibility (`components/TabItemRow.vue`)**: Kept single-tab `×` delete buttons always visible on Dashboard views while restricting hover-only `×` reveal to the Startup Restorer.
- **Dashboard & Modal Simplification, Scroll-Free Settings & URL Sorting**:
  - Redesigned `components/SettingsModal.vue` with a wider (`max-w-lg`) single-row compact layout, concise prerequisite guidance banner, `divide-y` spacing, and removed redundant subtitles and footer close buttons to eliminate vertical scrollbars across laptop viewports.
  - Streamlined `entrypoints/dashboard/App.vue`, `components/CollectionDetail.vue`, `components/TabGroupCard.vue`, `components/TabGroupList.vue`, and `components/TabItemRow.vue`: removed sidebar counters, visible tab-count text/badges across Current Tabs, Saved Group Detail, and History Snapshots, time-section counts/lines, redundant subtitles, and About modal's extra Close button; softened "Save as Tab Group" and "Open All" actions; removed `divide-y` borders while keeping drag handles visible.
  - Added `getTabUrlSortKey` and `sortTabsByUrl` in `utils/tabManager.ts` so tabs across Current Tabs, Saved Group Detail, History Snapshots, and Startup Restorer are displayed sorted alphabetically by normalized URL.
  - Updated the Current Tabs primary CTA label to dynamically display "Save & Exit" ("保存并退出" / "儲存並退出") when `autoCloseAfterSave` (enabled by default) is active.
- **Minimalist Startup Restorer Redesign (`components/StartupRestorer.vue`)**:
  - Removed the redundant visible hero title/subtitle block (retaining accessible `sr-only` `<h1>`), streamlined the header brand bar (`PackTabs · Session Restorer`), de-noised column headers (`icon + title + muted count`), and removed the border/background frame from the footer tip.
  - Hid per-card tab count badges and per-row domains in the Startup Restorer to give tab titles full breathing room (retaining full title + URL overflow tooltips).
  - Collapsed header search into an on-demand icon button (expandable on click or `/` shortcut, dismissible via `Esc` or close button).
  - Softened action button hierarchy: neutral surface with gentle indigo hover for routine "Open All" buttons, and soft tinted accent for the latest closed session ("Restore This Session").
  - Raised the per-card tab collapse threshold to 8 visible tabs with a 9-tab grace cutoff (`<= 9` shown inline, `>= 10` collapsed to 8 + expand toggle) to avoid awkward "+1 more tab" toggles.
- **Global Dark Mode Surface Elevation**: Lifted dark mode canvas from `#09090b` (`zinc-950`) to `#18181b` (`zinc-900`) and card/sidebar/modal surfaces to `#222226` across `style.css`, UI primitives, Dashboard, and Startup Restorer while keeping primary/secondary text contrast unchanged.

### Fixed
- **Popup Current-Tabs View Switching & Dashboard History Drag Semantics (`entrypoints/popup/App.vue`, `utils/dashboardLauncher.ts`, `entrypoints/dashboard/App.vue`, `components/TabItemRow.vue`)**: Launching "Save current window tabs" from the Quick Popup now signals an already-open active-window Dashboard tab (`SELECT_DASHBOARD_VIEW_MESSAGE`) to switch back to `Current Tabs` instead of staying on a previously opened History or Saved Group view; dragging a tab from a Dashboard History Snapshot card onto a Saved Group now sets `effectAllowed = 'copy'` / `dropEffect = 'copy'` and copies via `addTab` without mutating the source History Snapshot.
- **Shared Actions & Startup List De-duplication (`composables/useGroupActions.ts`, `components/StartupTabList.vue`, `utils/tabManager.ts`)**: Consolidated duplicated open/delete/undo/convert/drop handlers, typed drag payload helpers (`writeTabDragData`, `readTabDragData`, `prepareTabsForDisplay`, `snapshotTabGroup`), and Startup Restorer tab preview rendering into shared modules.
- **Quick Popup Dark-Mode Outer Border & Frame-0 Sync (`entrypoints/popup/`, `composables/useTheme.ts`)**: Applied cached theme synchronously before mount (`applyCachedTheme`), extended dark surfaces (`#222226`) across `html` and `body` with `@media (prefers-color-scheme: dark)` fallback, and switched the root container to `w-full min-w-[280px]` to eliminate outer white borders and HiDPI subpixel gaps on Windows/Chromium.
- **Startup Restorer Saved-to-Saved Drag-and-Drop & Sticky Hover Controls (`components/StartupRestorer.vue`)**: Aligned `dataTransfer.dropEffect` dynamically (`'move'` vs `'copy'`) with `effectAllowed` so dragging tabs between Saved Groups works reliably in real browsers instead of being rejected by a hardcoded `'copy'` dropEffect; replaced `group-focus-within` with `group-has-[:focus-visible]` and blurred dragged row triggers so mouse clicks and drag operations never leave hover-only buttons stuck visible.

### 📦 Chrome Web Store & Firefox AMO Release Notes (For Store Submission)

#### English (en-US):
```text
What's new in PackTabs v1.6.0:
- Quick Action Popup: Click the toolbar icon to save your current window in one click or launch any saved workspace directly (click for current window, Shift+Click or ↗ icon for a new window).
- Dual-Mode Opening & 5-Second Undo Protection: Open any group in the current window or a brand-new window via the adjacent ↗ icon; delete groups, tabs, or convert history snapshots instantaneously without blocking confirmation dialogs, with 5-second Undo toasts.
- Smarter Startup Restorer & Drag-and-Drop: Enjoy a calmer 2-column restorer with on-demand `/` search, title-adjacent header-hover tools, and direct drag-and-drop (copying from history snapshots while preserving history, and moving between saved groups).
- Polished UI, Dark Mode & Inline Controls: Upgraded dark mode surfaces across Dashboard and Popup, fast theme-aware tooltips and neutral floating toasts, URL-sorted tab lists, scroll-free Settings, and an inline "Close window after save" toggle right next to Save & Exit.
```

#### 简体中文 (zh-CN):
```text
PackTabs v1.6.0 本次更新：
- 工具栏快速面板：点击扩展图标即可一键打包当前窗口，或直达打开任意已保存分组（单击当前窗口打开，Shift+单击或 ↗ 图标在新窗口打开）。
- 双模式打开与 5 秒撤销保护：所有分组均支持当前窗口与独立新窗口双模式恢复；删除分组、移除标签及历史行内转存均取消阻塞弹窗，统一提供 5 秒可悬停暂停的「撤销」通知。
- 启动恢复页与拖拽体验升级：更清爽的双栏布局、按需展开的 `/` 快捷搜索、卡片头部悬停管理工具，以及支持跨分组拖拽归类（历史快照拖出自动复制归档，已保存分组互拖自动移动）。
- 界面与深色模式精细打磨：提亮深色层级并优化 Popup 边缘适配，统一 300ms 主题适配 Tooltip 与中性浮层通知，标签按 URL 排序，精简无滚动条设置面板，并在当前标签页提供「保存后关闭窗口」快捷开关。
```

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
