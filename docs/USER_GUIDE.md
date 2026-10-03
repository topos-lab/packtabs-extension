# PackTabs User Guide & Screenshot Blueprint

🌐 **Language / 语言**: English | [简体中文](USER_GUIDE_ZH.md)

> **Version**: v1.0.0  
> **Supported Browsers**: Google Chrome / Mozilla Firefox / Microsoft Edge and Chromium-based browsers

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
- **Click the Icon**: Click the **PackTabs** icon in your browser's extension toolbar.
- **Global Keyboard Shortcut**:
  - Windows / Linux: `Alt + Shift + K`
  - macOS: `Command + Shift + K`

> [!TIP]
> You can customize your keyboard shortcut at any time by visiting `chrome://extensions/shortcuts` in Chromium browsers.

---

## 3. Core Feature Walkthrough (Core Features)

---

### Feature 1: Current Window Staging & One-Click Tab Packing

#### 📖 How It Works
When you open PackTabs, you're greeted with the **Current Window Tabs** view:
- **Live Preview**: Inspect every open tab in your active window with crisp Favicons, page titles, and clean domain names.
- **Selective Exclusion**: Hover over any irrelevant tab (e.g., a search engine homepage) and click `✕` to exclude it before saving.
- **Custom Naming**: Type a task or project name (e.g., `LLM learning`, `RTX spark research`). If left blank, PackTabs will automatically assign a timestamp (e.g., `2026-10-03 14:30`).
- **Save & Auto-Close**: Keep "Close window after save" checked and click **Save as Tab Group** to instantly store all tabs and close the window, freeing memory.

![Current Window Tabs Staging & One-Click Packing](screenshots/current-tabs-light-en.png)
*Figure 1: Capture all task tabs in one click · Free memory instantly*

---

### Feature 2: Instant Workspace Restoration & Silent Background Tabs

#### 📖 How It Works
Switch to the **Saved Groups** view in the sidebar:
- **One-Click Workspace Restore**: Click **Open All** on any card to restore the entire collection into a fresh browser window.
- **Open Individual Tabs**: Click any tab row to launch that specific page directly.
- **Silent Background Opening (Power User Tip)**: Hold `Ctrl` (or `Cmd` / `Shift` on Mac) while clicking a tab item to load it quietly in the background without stealing your current window focus.
- **Inline Editing & Deletion**: Double-click or click the edit icon to rename groups; click the trash icon to clean up finished projects.

![Saved Groups Workspace Restore](screenshots/saved-group-light-en.png)
*Figure 2: Restore entire workspaces in seconds · Open tabs in background with live preview*

---

### Feature 3: Automatic History Snapshots (Zero Data Loss)

#### 📖 How It Works
Ever accidentally clicked the browser's top-right `✕` and lost crucial reference tabs?
- **Automatic Failsafe**: PackTabs runs an active listener service. Whenever an entire browser window closes, it **automatically captures all open tabs into a History Snapshot**.
- **Chronological Archive**: Access the **History Snapshots** view in the sidebar, neatly organized by Today, Yesterday, and Previous 7 Days.
- **Promote to Permanent Group**: Click "Save" on any snapshot card to name it and convert it into a permanent Saved Group.

![Automatic History Snapshots Failsafe](screenshots/history-group-light-en.png)
*Figure 3: Accidentally closed a window? Recover sessions with automatic snapshots*

---

### Feature 4: Browser Startup Restorer

#### 📖 How It Works
Pick up right where you left off every morning:
- Enable "Open Startup Restorer on browser launch" in Settings.
- When opening a fresh browser instance, PackTabs displays a clean, focused startup screen highlighting your last closed session and frequent collections.
- Click **Restore Session** or **Open All** to jump straight back into your work without searching through browser history.

![Browser Startup Restorer](screenshots/startup-page-light-en.png)
*Figure 4: Start every day in context · Seamless multi-day project resumption*

---

### Feature 5: Drag-and-Drop Organization

#### 📖 How It Works
- **Categorize on the Fly**: Hover over the drag handle (`⋮⋮`) on the left of any tab row, click and drag the tab directly onto an existing group target on the sidebar.
- **Visual Feedback**: The target group dynamically displays an active highlight border with actionable tooltip prompts.
- **Reorder Priorities**: Drag tabs up and down within any group card to adjust priority or reading sequence.

---

### Feature 6: Adaptive Dark Theme & 100% Offline Privacy

#### 📖 How It Works
- **Eye-Friendly Palettes**: Seamlessly switch between Light, Dark, and System modes with the header toggle. Styled with modern zinc neutral colors for zero eye strain.
- **100% Local & Private**: All URLs and titles are persisted exclusively in your browser's private local storage sandbox. No tracking, zero third-party telemetry, and no remote servers.

![Adaptive Dark and Light Theme Comparison](screenshots/theme-comparison-en.png)
*Figure 5: Seamless Light and Eye-Care Dark modes · Smooth transition and distraction-free design*

---

## 4. How to Capture Pixel-Perfect 1280×800 Screenshots

The Chrome Web Store and Firefox AMO strictly reject screenshots that deviate from **1280×800** or **640×400** pixels.

### Quick Step-by-Step Guide (Using Chrome DevTools for Maximum Clarity):
1. Open the PackTabs dashboard in Chrome (`Alt + Shift + K` or Mac `Cmd + Shift + K`).
2. Press `F12` (Mac `Cmd + Option + I`) to open Chrome DevTools, then press `Ctrl + Shift + M` (`Cmd + Shift + M` on Mac) to toggle the **Device Toolbar**.
3. In the top dimension inputs, set: **Width: `1280`**, **Height: `800`**.
4. **Set Device Pixel Ratio (DPR)**: Click the three dots menu `⋮` in the device toolbar -> Check **Add device pixel ratio**. Set DPR to **`1`** (for exact 1:1 pixel capture) or **`2`** (and downscale to 1280×800 for supersampled retina sharpness).
5. Press `Ctrl + Shift + P` (Mac `Cmd + Shift + P`), type **Capture screenshot**, and hit Enter.
6. Chrome will immediately download an exact **1280×800** PNG file ready for direct store upload and documentation!

---

## 5. Keyboard & Interaction Cheatsheet

| Action | Shortcut / Method | Description |
| :--- | :--- | :--- |
| **Open / Focus Dashboard** | `Alt + Shift + K` (Mac: `Cmd + Shift + K`) | Opens the manager tab or focuses an existing one |
| **Refresh Current Tabs** | Press `Alt + Shift + K` while dashboard is open | Re-scans active tabs in the current window |
| **Open in Background** | `Ctrl` / `Cmd` / `Shift` + Click | Silently opens a link in the background |
| **Rename Group** | Double-click title or click Edit | Renames the task group |
| **Exclude Tab** | Hover tab and click `✕` | Drops tab from current staging group |
