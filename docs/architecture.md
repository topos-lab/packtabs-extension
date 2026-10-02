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
- **Testing**: Vitest 5.x, @vue/test-utils, fast-check 4.x (190+ unit and property tests)

## 3. Storage & Concurrency Architecture

### 3.1 Overcoming Chrome Sync Quota Limits
In Chrome MV3, `chrome.storage.sync` enforces a strict 8,192-byte limit per storage item (`QUOTA_BYTES_PER_ITEM`). Tab groups containing 10+ tabs easily exceed this threshold. PackTabs circumvents this by storing tab groups in `local:tabGroups` (with up to 10MB capacity), while reserving `sync:settings` for cross-browser synchronization of user preferences.

### 3.2 Concurrency & Mutex Queue
All write operations (`saveTabGroup`, `updateTabGroup`, `deleteTabGroup`, `deleteTabFromGroup`) in `utils/storage.ts` are serialized through an in-memory mutex (`withLock`). This guarantees that concurrent modifications (e.g. rapid saving or asynchronous events) execute deterministically without race conditions or overwriting data.

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

### 4.4 Theme-Aware Multi-Line Tooltips (`Tooltip.vue`)
- Replaces native un-styleable browser `title` attributes that render as solid black bubbles on Windows 11 Chrome.
- Built with Radix Vue (`TooltipRoot`, `TooltipTrigger`, `TooltipPortal`, `TooltipContent`).
- Supports multi-line rendering via newline characters `\n`, string arrays `string[]`, and custom `#content` template slots.
- Adapts instantly to Light mode (pure white card with subtle gray border) and Dark mode (dark card with dark border).

### 4.5 Keyboard Shortcuts & MV3 Commands
- Manifest V3 command: `_execute_action` mapped to `Alt+Shift+K` (macOS: `Command+Shift+K`), avoiding conflicts with Chrome internal shortcuts.
- About modal queries real-time status with `browser.commands.getAll()`.
- Automatically refreshes shortcut binding state on window focus (`window.addEventListener('focus', loadShortcut)`).

### 4.6 Date Formatting & Performance Singleton (`utils/date.ts`)
- Replaces repeated instantiations of `Intl.DateTimeFormat` across list and card components with cached singleton formatters (`formatFullDateTime` and `formatDefaultGroupName`).
- Automatically tracks `navigator.language` updates and falls back to ISO-like YYYY-MM-DD HH:mm on legacy or error conditions.

## 5. Service Worker & Messaging Architecture
- **Stateless Service Worker**: Follows Chrome MV3 lifecycle guidelines without persistent global variables across worker sleep cycles.
- **Session Tabs Disk Sync**: Synchronizes active tab snapshots to disk on tab modifications with a 400ms debounce to prevent high-frequency write churn.
- **Polyfill-Compliant Messaging**: Background message listeners use async functions directly returning Promise resolutions, strictly adhering to WXT and `webextension-polyfill` patterns.
- **Optimistic State Rollback**: Pinia store actions take proxy-safe immutable snapshots (`cloneTabGroups`) before mutating state, automatically restoring memory state if persistent writes reject.
