# Implementation Plan: Tab Group Manager

## Overview

This implementation plan tracks the development, refactoring, and feature enhancements of the PackTabs extension. The project follows a modular, test-driven approach with continuous validation using Vitest and fast-check.

## Completed Tasks

### Phase 1: Core Foundation & Infrastructure
- [x] 1.1 Initialize WXT project with Vue 3 module and strict TypeScript
- [x] 1.2 Define domain types (`TabGroup`, `TabItem`) in `types/TabGroup.ts`
- [x] 1.3 Define storage schemas in `types/Storage.ts` (`local:tabGroups` and `sync:settings`)
- [x] 1.4 Configure Vitest with jsdom environment and fast-check

### Phase 2: Storage Service Layer
- [x] 2.1 Implement `utils/storage.ts` with `withLock` mutex concurrency queue
- [x] 2.2 Implement `structuredClone` deep cloning for write immutability
- [x] 2.3 Implement `resolveSyncConflict` last-write-wins merging strategy
- [x] 2.4 Add property tests for storage persistence and isolation

### Phase 3: Tab Management Service Layer
- [x] 3.1 Implement `captureCurrentWindow`, `openTabs`, and `openSingleTab`
- [x] 3.2 Implement MV3-compliant favicon loader with fallback to Globe icon
- [x] 3.3 Implement `closeCurrentTabs` with protective URL preservation
- [x] 3.4 Add property tests for tab capture and restoration

### Phase 4: State Management (`useTabStore`)
- [x] 4.1 Implement Pinia store with optimistic UI updates and rollback
- [x] 4.2 Support `selectedGroupId` navigation (Current Tabs, History, Saved Groups)
- [x] 4.3 Support inline renaming converting History groups to Saved groups
- [x] 4.4 Centralize store error handler with toast notifications

### Phase 5: Service Worker (`background.ts`)
- [x] 5.1 Capture active tabs snapshots on tab activation/update
- [x] 5.2 Auto-save History Snapshots when windows close (`windows.onRemoved`)
- [x] 5.3 Enforce strict MV3 lifecycle constraints inside `defineBackground`

### Phase 6: UI Refactoring (Tailwind CSS v4 + Radix Vue)
- [x] 6.1 Eliminate bulky PrimeVue dependencies in favor of Tailwind CSS v4
- [x] 6.2 Build headless accessible primitives:
  - `components/ui/button/Button.vue` (cva variants)
  - `components/ui/badge/Badge.vue` (cva variants)
  - `components/ui/card/*.vue` (Card, CardHeader, CardContent, CardTitle)
  - `components/ui/dialog/Modal.vue` (Radix Vue Dialog)
  - `components/ui/input/Input.vue` (Styled Input)
  - `components/ui/toast/ToastContainer.vue` (Floating notifications)
- [x] 6.3 Standardize on Tailwind Zinc palette (Shadcn UI standard)

### Phase 7: Theme & Appearance Enhancements
- [x] 7.1 Implement `composables/useTheme.ts` with tri-state mode (Auto / Light / Dark)
- [x] 7.2 Use Lucide `SunMoon` icon for Auto mode, dynamically adapting to OS scheme
- [x] 7.3 Persist theme preference in `sync:settings`
- [x] 7.4 Add unit tests for `useTheme`

### Phase 8: Current Tabs Staging & Smart Saving
- [x] 8.1 Implement Current Tabs view with live search, individual exclusion, and refresh
- [x] 8.2 Add "Close window after save" checkbox, enabled by default and persisted in `sync:settings`
- [x] 8.3 Implement smart timestamp auto-naming when group name is left blank
- [x] 8.4 Format creation dates using user locale

### Phase 9: Drag-and-Drop Categorization & Background Tab Opening
- [x] 9.1 Support HTML5 drag-and-drop of any tab to sidebar groups
- [x] 9.2 Use custom MIME `application/packtabs-tab` to prevent Chrome split-view navigation
- [x] 9.3 Support `Ctrl`, `Cmd`, or `Shift` + click to silently open tabs in the background
- [x] 9.4 Unify tab row cursor to standard `cursor-move` (✥) across Windows and macOS

### Phase 10: Theme-Aware Multi-Line Tooltips & Shortcuts
- [x] 10.1 Build `components/ui/tooltip/Tooltip.vue` with Radix Vue
- [x] 10.2 Support multi-line rendering via newlines `\n`, string arrays `string[]`, and `#content` slot
- [x] 10.3 Eliminate Windows 11 Chrome native black title tooltip bubbles
- [x] 10.4 Update extension shortcut to unconflicted `Alt+Shift+K` (macOS: `Command+Shift+K`)
- [x] 10.5 Implement dynamic shortcut querying with real-time focus refresh in About modal
- [x] 10.6 Maintain 194 automated unit and property tests with 100% pass rate

### Phase 11: Code Quality, Performance & Resilience Enhancements
- [x] 11.1 Migrate Service Worker `onMessage` listener to async Promise-return pattern compliant with WXT polyfill
- [x] 11.2 Implement singleton `Intl.DateTimeFormat` cache in `utils/date.ts` to eliminate repeated format instantiations
- [x] 11.3 Implement proxy-safe `cloneTabGroups` and rollback in Pinia store mutating actions upon persistence failures
- [x] 11.4 Clean up active Toast timers on manual removal in `useToast.ts`
- [x] 11.5 Standardize fallback tab creation to `chrome://newtab/` in `closeCurrentTabs`
- [x] 11.6 Expand test suite with `tests/unit/date.test.ts`, `tests/unit/useToast.test.ts`, and optimistic rollback tests (33 test suites, 206 tests, 100% pass)
