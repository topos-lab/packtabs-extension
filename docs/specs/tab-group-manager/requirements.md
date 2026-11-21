# Requirements Document: Tab Group Manager

## Introduction

PackTabs is a high-performance Chrome & Firefox Manifest V3 browser extension designed for productivity-focused users who need to save, organize, and restore task-oriented workspaces without bookmark bar clutter. The system enables users to launch or save window sessions from a lightweight action popup, preserve closed sessions automatically as History Snapshots, organize collections with distraction-free inline tools, and recover accidentally deleted items with 5-second Undo toasts.

## Glossary

- **Tab_Group**: A collection of saved browser tabs with metadata (ID, optional name, creation date, tab array, isHistory flag).
- **History_Tab_Group**: An automatically captured snapshot created when windows close or when the browser closes.
- **Named_Tab_Group**: A user-saved or renamed tab group stored permanently.
- **Current_Tabs_View**: The staging and review workspace for open tabs in the active window.
- **Quick_Popup**: The compact `280px` toolbar popup (`entrypoints/popup/`) providing instant access to save the current window or launch saved groups in 1 click.
- **TabGroupCard**: An interactive card component displaying the contents and actions for a tab group.
- **Storage_Local**: Local extension storage (`local:tabGroups`, up to 10MB capacity) used for storing large tab collections without 8KB sync quota limits.
- **Storage_Sync**: Sync extension storage (`sync:settings`) used for synchronizing user preferences across signed-in browsers.

## Requirements

### Requirement 1: Save Current Window Tabs

**User Story:** As a user, I want to save all tabs from my current browser window into a tab group, so that I can preserve my current work session for later restoration.

#### Acceptance Criteria

1. WHEN a user opens the Current Tabs view (via Quick Popup or shortcut), THE Tab_Group_Manager SHALL open/focus the dashboard within that active window (never jumping to another window's dashboard) and list all open web tabs sorted alphabetically by normalized URL with their title, URL, and favicon.
2. WHEN reviewing current tabs, THE user SHALL be able to exclude individual tabs via an always-visible `×` button, with a 5-second Undo toast allowing immediate restoration back into the sorted list.
3. WHEN saving tabs, THE user MAY provide a custom group name; IF no name is provided, THE Tab_Group_Manager SHALL automatically assign an intelligent timestamp name (e.g. `标签分组 · 11月21日 15:11`).
4. THE Tab_Group_Manager SHALL provide an inline "Close window after save" (`autoCloseAfterSave`) switch directly beside the Save action inside the Current Tabs toolbar (enabled `true` by default on fresh install, not duplicated in SettingsModal) and SHALL persist the user's choice across sessions in `sync:settings`.
5. WHEN "Close window after save" is enabled, THE Current Tabs primary save button SHALL display "Save & Exit" (`保存并退出` / `儲存並退出`) and close the browser window after clearing pending session tabs so no duplicate history snapshot is created.
6. WHEN saving completes, THE Tab_Group_Manager SHALL persist the group under `local:tabGroups` through a mutex serialization lock.

### Requirement 2: Automatic History Snapshots

**User Story:** As a user, I want my open tabs to be automatically preserved when I close a window or browser, so that I never lose my work session.

#### Acceptance Criteria

1. WHEN a browser window closes, THE Tab_Group_Manager service worker SHALL automatically preserve the window's tabs as a History_Tab_Group.
2. WHEN creating a History_Tab_Group, THE Tab_Group_Manager SHALL store it with `isHistory: true` and an accurate creation timestamp, and SHALL deduplicate identical normalized tab sets using a latest-wins policy (removing older duplicate history snapshots while preserving named groups and TTL-bounded deletion tombstones).
3. WHEN displaying History_Tab_Groups, THE Tab_Group_Manager SHALL categorize them by clean relative time headings (Today, Yesterday, Previous 7 Days, This Month, Older) without numeric count badges or heavy divider clutter.
4. WHEN a user hovers or keyboard-focuses the `CardHeader` of a History_Tab_Group and clicks the title-adjacent `BookmarkPlus` inline save icon (in either Dashboard or Startup Restorer), THE UI SHALL expand an inline name input directly inside the card header (accepting a custom name or defaulting to a timestamp name on Enter/Confirm) and convert the group into a permanent Named_Tab_Group with a 5-second Undo toast, without rendering a redundant explicit "Save" text button.

### Requirement 3: Tab Group Organization & Drag-and-Drop Categorization

**User Story:** As a user, I want to organize tabs between groups via drag-and-drop, so that I can classify tabs flexibly in both the Manager and Startup Restorer.

#### Acceptance Criteria

1. THE Tab_Group_Manager SHALL allow tab items (from Current Tabs, Dashboard groups, and Startup Restorer cards) to be dragged onto Saved Groups.
2. WHEN dragging a tab over a saved group (in the sidebar or Startup Restorer left column), THE target group SHALL show a visual drop-target highlight.
3. WHEN a tab is dropped from a History_Tab_Group onto a Named_Tab_Group, THE Tab_Group_Manager SHALL copy/archive the tab into the target group while preserving the History_Tab_Group intact; WHEN dropped from Current Tabs or between Named_Tab_Groups, THE Tab_Group_Manager SHALL move/add the tab atomically.
4. THE Tab_Group_Manager SHALL prevent Chrome from triggering native side-by-side or split-view tab navigation during dragging.
5. Dashboard tab rows (`TabItemRow.vue`) SHALL display persistent `GripVertical` drag handles and always-visible `×` remove buttons, while Startup Restorer tab rows SHALL remain visually minimal without persistent drag handles and reveal `×` only on hover/focus.

### Requirement 4: Dual-Mode Restoration, Background Opening & Undo Protection

**User Story:** As a user, I want to restore groups in either the current window or a brand-new window, and undo accidental deletions seamlessly without modal confirmations.

#### Acceptance Criteria

1. EVERY group card / detail header SHALL display a clean text-only primary action ("Open All" / "Restore Session") to restore tabs in the current window (`Shift+Click` opens in a new window), paired immediately with a borderless, backgroundless `ExternalLink` (`↗`) icon button to open all tabs together in a newly created focused window (`browser.windows.create`), and Dashboard card/row delete icons SHALL align vertically along the right edge.
2. WHEN a user clicks a tab item while holding `Ctrl`, `Cmd`, or `Shift` (or middle-clicks), THE Tab_Group_Manager SHALL open that single tab in the background without activating it.
3. WHEN a user deletes a group or an individual tab (in either Dashboard or Startup Restorer), THE deletion SHALL execute immediately without a blocking confirmation modal and display a 5-second Toast with an "Undo" action (pausing its timer on hover) that restores the deleted group/tab and clears any matching history deletion tombstone.
4. WHEN deleting the last remaining tab of a History_Tab_Group, THE empty History_Tab_Group SHALL be removed automatically and remain restorable as a whole via the 5-second Undo toast.

### Requirement 5: Management Dashboard, Settings & Appearance

**User Story:** As a user, I want a clean, scroll-free, accessible interface with soft dark theme elevation and URL-sorted tab lists.

#### Acceptance Criteria

1. THE Management_Page SHALL feature a clean two-pane layout (`h-14` sidebar header + main workspace) free of sidebar numeric counters and redundant per-card tab count badges.
2. THE Tab_Group_Manager SHALL provide a tri-state theme switcher: Auto (System), Light, and Dark (`useTheme.ts`), using soft neutral dark surfaces (`#18181b` canvas and `#222226` cards/modals).
3. ALL tab lists across Current Tabs, Saved Group Detail, History Snapshots, and Startup Restorer SHALL be displayed sorted alphabetically by normalized URL (`sortTabsByUrl`).
4. THE Settings modal (`SettingsModal.vue`) SHALL render its 5 core preferences (Theme, single-row Language selector, Restore on Startup + compact prerequisite strip, History Limit, and Shortcut) inside a widened (`max-w-lg`) layout without vertical scrollbars or redundant footer Close buttons.
5. THE Tab_Group_Manager SHALL provide theme-aware, `300ms`-delayed (`skipDelayDuration: 300`), animation-free `<Tooltip>` overlays across interactive action buttons (eliminating native browser `title` bubbles) and overflow-only tooltips on tab titles; toast feedback (`ToastContainer.vue`) SHALL render as neutral theme-matched floating cards (`bg-white` / `dark:bg-[#27272c]`) with semantic status icons and Indigo Undo buttons.

### Requirement 6: About Modal & Keyboard Shortcuts

**User Story:** As a user, I want to view extension information and configure keyboard shortcuts easily.

#### Acceptance Criteria

1. WHEN a user clicks the PackTabs brand logo in the sidebar header, THE Management_Page SHALL display a minimal About PackTabs modal containing only the modal title, tagline (`aboutDesc`), and metadata rows, without an inner duplicate brand card/logo or redundant footer Settings/Close buttons.
2. THE About modal SHALL display the app version (from manifest, appending `(dev · YYYY-MM-DD HH:mm)` on odd-minor development builds), author, and GitHub link (`packtabs-extension`).
3. THE default shortcut command (`open_dashboard`) SHALL be `Alt+Shift+K` on Windows/Linux and `Command+Shift+K` on macOS, opening or focusing the full Management Dashboard in the active window.
4. THE Settings modal SHALL query `browser.commands.getAll()` in real-time and open browser shortcut settings (`chrome://extensions/shortcuts`, `edge://extensions/shortcuts`, or copy `about:addons` on Firefox) when clicking "Change".

### Requirement 7: Data Persistence & Storage Architecture

**User Story:** As a user, I want my data saved reliably with atomic concurrency and undo recovery.

#### Acceptance Criteria

1. Tab groups SHALL be persisted in `local:tabGroups`, supporting large tab collections without hitting 8KB sync quotas.
2. User preferences (`theme`, `locale`, `autoCloseAfterSave` defaulting to `true`, `openOnStartup`, `maxHistoryGroups`) SHALL be persisted in `sync:settings`.
3. All write operations across background worker, popup, and dashboard contexts SHALL serialize through named Web Locks (`navigator.locks` mutexes in `utils/storage.ts`).
4. Undoing a deleted History_Tab_Group (`restoreGroup`) SHALL clear its matching TTL signature from `deletedHistorySignaturesStorage` (`clearDeletedHistorySignature`) and restore the group with its original ID and timestamp.

### Requirement 8: Startup Session Restorer

**User Story:** As a user, I want a calm, distraction-free startup page to restore workspaces or yesterday's session in one click, with unobtrusive hover-only tools for quick cleanup or conversion.

#### Acceptance Criteria

1. THE Startup Restorer (`/dashboard.html?mode=startup`) SHALL open automatically on cold browser launch when `openOnStartup` is enabled in `sync:settings`.
2. THE Startup Restorer SHALL present a minimalist 2-column layout (Left: Saved Groups; Right: History Snapshots with soft Indigo highlight on the Last Closed Session) without card tab-count badges or row domain columns, showing up to 9 tabs inline before collapsing at 10+ tabs (`MAX_VISIBLE_TABS = 8`), plus a subtle footer tip mentioning drag-to-group categorization and launch shortcuts.
3. EVERY card SHALL expose the Scheme A dual-open pair flush right (text-only "Open All" / "Restore Session" closing the restorer tab on current-window restore, plus adjacent `↗` icon button opening in a new window while keeping the restorer tab open).
4. Quick organization tools SHALL remain hidden until hover or keyboard focus-visible (`group-has-[:focus-visible]`) without sticking visible after mouse drag/click:
   - Hovering/focusing a card's `CardHeader` reveals management icons grouped right after the title (`Trash2` delete on Saved cards; `BookmarkPlus` + `Trash2` on History cards) so open actions remain flush right with zero blank gap.
   - Hovering/focusing a tab row reveals a sibling `×` delete button aligned vertically with card headers.
   - Dragging any tab row onto a Saved Group dynamically aligns `dataTransfer.dropEffect` (`copy` from history, `move` between saved groups) so browser drops succeed reliably while copying from history or moving between saved groups.
   - All deletions and inline conversions trigger a 5-second Undo toast.
5. Search SHALL remain collapsed behind a header icon button (expandable on click or `/` key, dismissible via `Esc`, close button, or empty blur).

### Requirement 9: Quick Action Popup (`entrypoints/popup/`)

**User Story:** As a user, I want clicking the extension toolbar icon to give me instant access to both saving my current tabs and opening any saved workspace in 1 click without opening an extra management page first.

#### Acceptance Criteria

1. Clicking the extension action icon SHALL open a compact `280px` edge-to-edge popup (`entrypoints/popup/index.html`) that applies cached dark/light theme synchronously before mount (`applyCachedTheme`) and paints `html` + `body` surfaces seamlessly without outer white borders in dark mode.
2. THE top row of the popup SHALL provide a single-click "Save current window tabs" (`保存当前窗口标签页`) action (with no inline input box or save button inside the popup) that opens or focuses the Dashboard Current Tabs view in the active window and closes the popup.
3. BELOW the top action, THE popup SHALL list Saved Groups by name only (no tab details, counts, or "Open Full Dashboard" footer link).
4. Clicking a saved group name SHALL open all its URL-sorted tabs in the current window (`Shift+Click` opens in a new window) and close the popup; clicking the hover/focus `↗` (`ExternalLink`) icon button on a row SHALL open all tabs in a new focused window and close the popup.
