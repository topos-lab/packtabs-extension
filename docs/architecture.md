# PackTabs Architecture & Engineering Guide

## 1. Product Overview
PackTabs is an efficiency-oriented Chrome extension that enables one-click saving of browser tabs into organized collections and automatic recovery of closed sessions via History Snapshots.

## 2. Technical Stack
- **Framework**: WXT Framework (v0.21.x) with Vite 8 bundler
- **UI Framework**: Vue 3 (Composition API) with Tailwind CSS v4
- **Primitives**: Radix Vue (Headless accessible dialogs and overlays)
- **Icons**: Lucide Vue Next (tree-shakeable SVG icons)
- **State Management**: Pinia 4.x
- **Storage**: Chrome Local Storage (`local:tabGroups`) + Chrome Sync Storage (`sync:settings`)
- **Testing**: Vitest 5.x, @vue/test-utils, fast-check 4.x

## 3. Storage & Concurrency Architecture
### 3.1 Overcoming Chrome Sync Quota Limits
In Chrome MV3, `chrome.storage.sync` enforces a strict 8,192-byte limit per storage item (`QUOTA_BYTES_PER_ITEM`). Tab groups containing 10+ tabs easily exceed this threshold. PackTabs circumvents this by storing tab groups in `local:tabGroups` (with up to 10MB capacity), while reserving `sync:settings` for cross-browser synchronization of user preferences.

### 3.2 Concurrency & Mutex Queue
All write operations (`saveTabGroup`, `updateTabGroup`, `deleteTabGroup`, `deleteTabFromGroup`) in `utils/storage.ts` are serialized through an in-memory mutex (`withLock`). This guarantees that concurrent modifications (e.g. rapid saving or asynchronous events) execute deterministically without race conditions or overwriting data.

### 3.3 Immutability & Deep Cloning
`updateTabGroup` uses `structuredClone` to create deep copies before applying updates, guaranteeing that failed persistence attempts never mutate the in-memory cache.

## 4. UI Architecture
- **Sidebar**: Fixed two-pane layout (`w-64` / `w-16` collapsible), avoiding modal drawer overlays that block page interaction.
- **Top Navigation Bar**: Live search filter, active category header, and prominent one-click save trigger.
- **Tab Cards**: Tailwind card containers with inline editing (Enter to save, Escape to cancel), MV3-compliant favicon loader with fallback, and individual tab deletion.
- **Accessible Modals**: Built with Radix Vue (`DialogRoot`, `DialogPortal`, `DialogOverlay`, `DialogContent`), ensuring full keyboard navigation and focus management.
- **Lightweight Notifications**: Zero-dependency `useToast` composable with floating notifications.
