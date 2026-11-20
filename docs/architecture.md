# PackTabs Architecture & Engineering Guide

## 1. Product Overview

PackTabs is a high-performance, minimalist Chrome browser extension built with the WXT Framework, Vue 3 Composition API, and Tailwind CSS v4. It enables users to capture, organize into permanent collections or automatic history snapshots, and restore browser tab sessions with a single click.

## 2. Technical Stack

- **Framework**: WXT Framework (v0.21.x) with Vite 8 bundler
- **Frontend Stack**: Vue 3 (Composition API with `<script setup>`), Pinia 4.x
- **Styling**: Tailwind CSS v4 with custom `zinc` palette (Shadcn UI standard)
- **UI Primitives**: Radix Vue (Headless accessible dialogs, portals, and tooltips)
- **Icons**: Lucide Vue Next (Tree-shakeable SVG icons)
- **Persistence Layer**:
  - `local:tabGroups`: Sharded tab groups stored in Chrome Local Storage (10MB capacity, eliminating Chrome Sync's 8KB per-item quota)
  - `sync:settings`: User preferences (e.g. `theme`, `autoCloseAfterSave`) synced across browser profiles via Chrome Sync Storage
- **Testing**: Vitest 5.x, @vue/test-utils, fast-check 4.x (300+ unit and property tests)

## 3. Storage & Concurrency Architecture

### 3.1 Overcoming Chrome Sync Quota Limits

In Chrome MV3, `chrome.storage.sync` enforces a strict 8,192-byte limit per storage item (`QUOTA_BYTES_PER_ITEM`). Tab groups containing 10+ tabs easily exceed this threshold. PackTabs circumvents this by storing tab groups in `local:tabGroups` (with up to 10MB capacity), while reserving `sync:settings` for cross-browser synchronization of user preferences.

### 3.2 Concurrency & Mutex Queue

All write operations in `utils/storage.ts` (`saveTabGroup`, `saveHistoryTabGroup`, `updateTabGroup`, `deleteTabGroup`, `deleteTabFromGroup`, `moveTabBetweenGroups`, `addTabToGroup`), session tab updates (`withSessionLock`), and settings writes (`withSettingsLock`) are serialized through named mutexes backed by `navigator.locks` (with in-memory promise queue fallback in test environments), preventing race conditions across the service worker and multiple extension tabs.

### 3.3 Immutability & Deep Cloning

`updateTabGroup` uses `structuredClone` to create deep copies before applying updates, guaranteeing that failed persistence attempts never mutate the in-memory cache.

### 3.4 Conflict Resolution & Recovery

When concurrent operations or quota errors occur, `resolveSyncConflict` provides deterministic last-write-wins merging by timestamp while preserving unique tab items.

## 4. UI Architecture & Components

### 4.1 Layout & Navigation

- **Permanent Sidebar**: Clean two-section navigation with:
  - Header: Clickable brand logo (opens About modal) and tri-state theme switcher button.
  - Quick Views: Current Tabs (with live staging & search) and History Snapshots (with search).
  - Saved Groups: Dynamically listed folders with active highlight and tab counter badges.
- **Current Tabs Staging**:
  - Displays all open web tabs in the current window.
  - Allows individual tab exclusion, custom naming, and optional "Close window after save".
  - Auto-names groups with intelligent timestamps (e.g. `2026-10-02 20:30`) if left blank.

### 4.2 Tri-State Theme System (`useTheme.ts`)

- Supports **Light**, **Dark**, and **Auto (System)** modes.
- Uses Lucide `SunMoon` icon for Auto, `Sun` for Light, and `Moon` for Dark.
- Automatically listens to OS `(prefers-color-scheme: dark)` changes when in Auto mode.
- Pure Tailwind Zinc styling: `#ffffff` / `#fafafa` in light mode, `#18181b` / `#09090b` in dark mode.

### 4.3 Drag-and-Drop Categorization

- Built with standard HTML5 drag-and-drop APIs.
- Uses custom MIME type `application/packtabs-tab` to transport tab payloads cleanly.
- Overrides `text/plain` with non-URL text to prevent Chrome from opening Split View or side-by-side tabs.
- Cross-platform cursor: uses standard `cursor-move` (✥) across tab item rows on both Windows and macOS.

### 4.4 Theme-Aware Overflow Tooltips (`Tooltip.vue`)

- Replaces native un-styleable browser `title` attributes where needed with Radix Vue (`TooltipRoot`, `TooltipTrigger`, `TooltipPortal`, `TooltipContent`).
- On tab rows (`TabItemRow.vue` and `StartupRestorer.vue`), tooltips appear only when the title overflows, showing the full title and URL without obscuring neighboring rows; operational hints live concisely at the card footer/empty state.
- Adapts instantly to Light mode (pure white card with subtle gray border) and Dark mode (dark card with dark border).

### 4.5 Keyboard Shortcuts & MV3 Commands

- Manifest V3 command: `open_dashboard` mapped to `Alt+Shift+K` (macOS: `Command+Shift+K`), avoiding conflicts with Chrome internal shortcuts.
- Settings modal queries real-time status with `browser.commands.getAll()` and refreshes when opened.

### 4.6 Date Formatting & Performance Singleton (`utils/date.ts`)

- Replaces repeated instantiations of `Intl.DateTimeFormat` across list and card components with cached singleton formatters (`formatFullDateTime` and `formatDefaultGroupName`).
- Automatically tracks active locale changes and falls back to ISO-like YYYY-MM-DD HH:mm on legacy or error conditions.

### 4.7 Startup Session Restorer (`components/StartupRestorer.vue`)

- **Dedicated 2-Column Restorer View**:
  - Automatically opened on browser cold start (`browser.runtime.onStartup` / `browser.storage.session`) when enabled via `openOnStartup` in `sync:settings`.
  - **Left Column**: Saved Groups (Workspaces) with tab count, instant "Open All" action, and individual tab click launchers.
  - **Right Column**: History Snapshots with prominent highlight on the **Last Closed Session** ("上次关闭的会话" / "Last Closed Session") for 1-click resumption.
- **Pure "Click & Go" Mental Model**:
  - Intentionally strips away CRUD/editing/reorganizing controls and dashboard navigation links to minimize cognitive friction during browser startup.
  - Includes unified search filtering across both saved groups and history snapshots simultaneously.

## 5. Service Worker & Messaging Architecture

- **Stateless Service Worker**: Follows Chrome MV3 lifecycle guidelines without relying on persistent global variables across worker sleep cycles.
- **Session Tabs Disk Sync**: Synchronizes active tab snapshots to disk on tab modifications with a 150ms debounce to prevent high-frequency write churn, cancelling pending syncs when a window closes.
- **Cold Start Restoration (`browser.runtime.onStartup` & `browser.storage.session`)**:
  - Automatically recovers uncommitted session tabs on browser startup.
  - Inspects `sync:settings.openOnStartup` to conditionally launch the Startup Restorer tab (`/dashboard.html?mode=startup`).
- **Atomic State Persistence**: Pinia store actions persist through storage mutexes before updating reactive state, keeping background and multi-window extension pages synchronized via storage watchers.
