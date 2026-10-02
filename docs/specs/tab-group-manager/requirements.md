# Requirements Document: Tab Group Manager

## Introduction

PackTabs is a high-performance Chrome browser extension designed for efficiency-focused users who need to manage multiple browser sessions effectively. The system enables users to save all tabs from the current window into organized collections, automatically preserve closed sessions as History Snapshots, and restore browser sessions with a single click. The extension follows a "simple and efficient" design philosophy using modern web technologies and Chrome Manifest V3 architecture.

## Glossary

- **Tab_Group**: A collection of saved browser tabs with metadata (ID, optional name, creation date, tab array, isHistory flag).
- **History_Tab_Group**: An automatically captured snapshot created when windows close or when the browser closes.
- **Named_Tab_Group**: A user-saved or renamed tab group stored permanently.
- **Current_Tabs_View**: The staging and review workspace for open tabs in the active window.
- **TabGroupCard**: An interactive card component displaying the contents and actions for a tab group.
- **Storage_Local**: Chrome's local storage (`local:tabGroups`, up to 10MB capacity) used for storing large tab collections without 8KB sync quota limits.
- **Storage_Sync**: Chrome's sync storage (`sync:settings`) used for synchronizing user preferences across signed-in browsers.

## Requirements

### Requirement 1: Save Current Window Tabs

**User Story:** As a user, I want to save all tabs from my current browser window into a tab group, so that I can preserve my current work session for later restoration.

#### Acceptance Criteria

1. WHEN a user navigates to the Current Tabs view, THE Tab_Group_Manager SHALL list all open web tabs from the active window with their title, URL, and favicon.
2. WHEN reviewing current tabs, THE user SHALL be able to exclude individual tabs from being saved.
3. WHEN saving tabs, THE user MAY provide a custom group name; IF no name is provided, THE Tab_Group_Manager SHALL automatically assign an intelligent timestamp name (e.g. `2026-10-02 20:30`).
4. THE Tab_Group_Manager SHALL provide a "Close window after save" option, checked by default, and SHALL persist the user's choice across sessions in `sync:settings`.
5. WHEN a tab group is saved with "Close window after save" enabled, THE Tab_Group_Manager SHALL close the window tabs while keeping the manager dashboard open.
6. WHEN saving completes, THE Tab_Group_Manager SHALL persist the group under `local:tabGroups` through a mutex serialization lock.

### Requirement 2: Automatic History Snapshots

**User Story:** As a user, I want my open tabs to be automatically preserved when I close a window or browser, so that I never lose my work session.

#### Acceptance Criteria

1. WHEN a browser window closes, THE Tab_Group_Manager service worker SHALL automatically preserve the window's tabs as a History_Tab_Group.
2. WHEN creating a History_Tab_Group, THE Tab_Group_Manager SHALL store it with `isHistory: true` and an accurate creation timestamp.
3. WHEN displaying History_Tab_Groups, THE Tab_Group_Manager SHALL categorize them by relative time sections (Today, Yesterday, Previous 7 Days, This Month, Older).
4. WHEN a user clicks the inline edit button on a History_Tab_Group and inputs a name, THE Tab_Group_Manager SHALL immediately convert the group to a Named_Tab_Group and save it permanently.

### Requirement 3: Tab Group Organization & Drag-and-Drop Categorization

**User Story:** As a user, I want to organize tabs between groups via drag-and-drop, so that I can classify tabs flexibly.

#### Acceptance Criteria

1. THE Tab_Group_Manager SHALL allow any tab item (from Current Tabs or saved groups) to be dragged.
2. WHEN dragging a tab over a group in the sidebar, THE group item SHALL show a visual drop-target highlight.
3. WHEN a tab is dropped onto a target group, THE Tab_Group_Manager SHALL move or add the tab to that group atomically.
4. THE Tab_Group_Manager SHALL prevent Chrome from triggering native side-by-side or split-view tab navigation during dragging.
5. THE entire tab item row SHALL display the cross-platform `cursor-move` (✥) cursor to clearly signify draggability.

### Requirement 4: Tab Group Restoration & Background Tab Opening

**User Story:** As a user, I want to restore entire groups or individual tabs efficiently.

#### Acceptance Criteria

1. WHEN a user clicks "Open All" on a tab group, THE Tab_Group_Manager SHALL open all tabs in the current window and display a success notification.
2. WHEN a user clicks a tab item while holding `Ctrl`, `Cmd`, or `Shift`, THE Tab_Group_Manager SHALL open that single tab in the background without activating it or navigating away from the manager.
3. WHEN a user clicks the delete button on an individual tab, THE Tab_Group_Manager SHALL remove that tab from the group atomically.

### Requirement 5: Management Dashboard & Appearance

**User Story:** As a user, I want a clean, accessible, modern interface with theme customization.

#### Acceptance Criteria

1. THE Management_Page SHALL feature a permanent two-pane layout with a fixed sidebar and main content view.
2. THE Tab_Group_Manager SHALL provide a tri-state theme switcher: Auto (System), Light, and Dark.
3. WHEN in Auto (System) mode, THE Tab_Group_Manager SHALL use the Lucide `SunMoon` icon and dynamically adapt to the operating system's color scheme.
4. THE UI SHALL use Tailwind CSS Zinc palette styling with high contrast and zero third-party bulky component libraries.
5. THE Tab_Group_Manager SHALL provide theme-aware Tooltips for all tab items, supporting multi-line instructions without triggering native browser black title bubbles.

### Requirement 6: About Modal & Keyboard Shortcuts

**User Story:** As a user, I want to view extension information and configure keyboard shortcuts easily.

#### Acceptance Criteria

1. WHEN a user clicks the PackTabs brand logo in the sidebar header, THE Management_Page SHALL display the About PackTabs modal.
2. THE About modal SHALL display the app version, author, GitHub link (`packtabs-extension`), appearance switcher, and active shortcut.
3. THE default suggested shortcut SHALL be `Alt+Shift+K` on Windows/Linux and `Command+Shift+K` on macOS.
4. THE About modal SHALL query `browser.commands.getAll()` in real-time, displaying `Not set (Default: Alt + Shift + K)` if unassigned.
5. WHEN a user clicks "Change", THE Tab_Group_Manager SHALL open `chrome://extensions/shortcuts`, and automatically refresh the displayed shortcut upon window focus.

### Requirement 7: Data Persistence & Storage Architecture

**User Story:** As a user, I want my data saved reliably without storage limit crashes.

#### Acceptance Criteria

1. Tab groups SHALL be persisted in `local:tabGroups`, with support for hundreds of tabs per group without hitting sync quotas.
2. User preferences (`theme`, `autoCloseAfterSave`) SHALL be persisted in `sync:settings` for cross-device synchronization.
3. All write operations to storage SHALL pass through a mutex queue (`withLock`) to guarantee atomic serialization.
4. All update operations SHALL clone data using `structuredClone` before modification to maintain cache immutability.
