# <img src="../public/icon/48.png" alt="PackTabs Logo" width="28" height="28" align="center" /> PackTabs User Guide (User Guide)

🌐 **Language / 语言**: English | [简体中文](USER_GUIDE_ZH.md)

> **Version**: v1.1.0 (dev)  
> **Supported Browsers**: Google Chrome / Mozilla Firefox / Microsoft Edge and Chromium-based browsers  
> **Extension Stores**: [Chrome Web Store](https://chromewebstore.google.com/detail/packtabs/mpjjbfgjjbphemiklfoojlogcmjdkjjp) | [Firefox Add-ons](https://addons.mozilla.org/zh-CN/firefox/addon/packtabs-task-tab-manager/)

---

## 1. Why PackTabs?

Modern web multitasking often leads to two major productivity pitfalls:

1. **The Fear of Closing the Browser**: Unfinished research, debugging tabs, or shopping comparisons linger in 30–80+ open tabs, eating up gigabytes of system memory and overwhelming your focus.
2. **The Bookmark Bar Graveyard**: Saving temporary working tabs to your permanent bookmark bar clutters your bookmarks with disposable links that you rarely organize and hesitate to delete.

**The PackTabs Solution**:
A **task-oriented** tab and workspace manager. When you finish a work session or switch projects, package every open tab in your current window into a dedicated group with one click. Clear your browser to regain mental clarity, and restore your full workspace context instantly whenever you're ready.

---

## 2. Quick Start

### 1. Launching PackTabs

- **Click the Icon**: Click the **PackTabs** icon (<img src="../public/icon/16.png" alt="PackTabs icon" width="16" height="16" align="center" />) in your browser's extension toolbar (make sure to pin 📌 it from the extension puzzle menu 🧩 if hidden).
- **Global Keyboard Shortcut**:
  - Windows / Linux: `Alt + Shift + K`
  - macOS: `Command + Shift + K`

> [!TIP]
> You can customize your keyboard shortcut at any time by visiting `chrome://extensions/shortcuts` in Chromium browsers, or by clicking the shortcut configuration link directly inside the extension's Settings modal.

---

## 3. Core Feature Walkthrough (Core Features)

---

### Feature 1: Current Window Staging & One-Click Tab Packing

#### 📖 How It Works

When you open PackTabs, you're greeted with the **Current Window Tabs** view:

- **Live Preview**: Inspect every open tab in your active window with crisp Favicons, page titles, and clean domain names.
- **Selective Exclusion**: Hover over any irrelevant tab (e.g., a search engine homepage) and click `✕` to exclude it before saving.
- **Custom Naming**: Type a task or project name (e.g., `LLM learning`, `RTX spark research`). If left blank, PackTabs will automatically assign a timestamp (e.g., `2026-10-03 14:30`).
- **Save & Auto-Close**: Keep "Close window after save" checked and click **Save as Tab Group** to instantly store all tabs and close the window.

![Current Window Tabs Staging & One-Click Packing](screenshots/current-tabs-light-en.png)
_Figure 1: Capture all task tabs in one click · Free memory instantly_

---

### Feature 2: Instant Workspace Restoration & Silent Background Tabs

#### 📖 How It Works

Switch to the **Saved Groups** view in the sidebar:

- **One-Click Workspace Restore**: Click **Open All** on any card to restore the entire collection into a fresh browser window.
- **Open Individual Tabs in Background**: Hold `Ctrl` (or `Cmd` / `Shift` on Mac) while clicking a tab item to load it quietly in the background without stealing your current window focus.
- **Edit & Delete Tab Groups**: Click the edit icon to rename groups; click the trash icon to permanently remove completed task groups.

![Saved Groups Workspace Restore](screenshots/saved-group-light-en.png)
_Figure 2: Restore entire workspaces in seconds · Open individual tabs silently in background_

---

### Feature 3: Automatic History Snapshots (Zero Data Loss)

#### 📖 How It Works

Ever accidentally clicked the browser's top-right `✕` and lost crucial reference tabs?

- **Automatic Failsafe**: PackTabs runs an active listener service. Whenever an entire browser window closes, it **automatically captures all open tabs into a History Snapshot**.
- **Chronological Archive**: Access the **History Snapshots** view in the sidebar, neatly organized by Today, Yesterday, and Previous 7 Days.
- **One-Click Permanent Save**: Click "Save" on any snapshot card to name it and convert it into a permanent Saved Group.

![Automatic History Snapshots Failsafe](screenshots/history-group-light-en.png)
_Figure 3: Window closed unexpectedly? Automatic snapshots record all tabs, ready to recover or save as permanent groups_

---

### Feature 4: Browser Startup Restorer

#### 📖 How It Works

Pick up right where you left off every morning:

- Enable "Open Startup Restorer on browser launch" in Settings.
- When opening a fresh browser instance, PackTabs displays a clean, focused startup screen highlighting your last closed session and frequent collections.
- Click **Restore Session** or **Open All** to seamlessly jump straight back into your work without searching through browser history.

![Browser Startup Restorer](screenshots/startup-page-light-en.png)
_Figure 4: Start every day in context · Seamless multi-day project resumption_

---

### Feature 5: Drag-and-Drop Organization

#### 📖 How It Works

- **Categorize on the Fly**: Hover over the drag handle (`⋮⋮`) on the left of any tab row, click and drag the tab directly onto an existing group target on the sidebar.
- **Visual Feedback**: The target group dynamically displays an active highlight border with actionable tooltip prompts.

---

### Feature 6: Adaptive Dark Theme & 100% Offline Privacy

#### 📖 How It Works

- **Eye-Friendly Palettes**: Seamlessly switch between Light, Dark, and System modes with the header toggle. Styled with modern zinc neutral colors for zero eye strain.
- **100% Local & Private**: All URLs and titles are persisted exclusively in your browser's private local storage sandbox. No tracking, zero third-party telemetry, and no remote servers.

![Adaptive Dark and Light Theme Comparison](screenshots/theme-comparison-en.png)
_Figure 5: Seamless Light and Eye-Care Dark modes · Smooth transition and distraction-free design_

---

## 4. Keyboard & Interaction Cheatsheet

| Action | Shortcut / Method | Description |
| :--- | :--- | :--- |
| **Open / Focus Dashboard** | `Alt + Shift + K` (Mac: `Cmd + Shift + K`) | Opens the manager tab or focuses an existing one |
| **Refresh Current Tabs** | Press `Alt + Shift + K` while dashboard is open | Re-scans active tabs in the current window |
| **Open in Background** | `Ctrl` / `Cmd` / `Shift` + Click | Silently opens a link in the background |
| **Rename Group** | Click Edit button | Renames the task group |
| **Exclude Tab** | Hover tab and click `✕` | Drops tab from current staging group |
