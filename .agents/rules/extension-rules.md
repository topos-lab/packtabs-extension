---
description: Chrome Extension MV3 and WXT Development Rules
trigger: always_on
---

# Chrome Extension MV3 & WXT Rules

1. **Manifest V3 Architecture**:
   - Never use MV2 APIs (e.g. `chrome.browserAction` -> `browser.action`, `background.scripts` -> `background.service_worker`).
   - Keep service workers stateless. Persist all state in `browser.storage`.

2. **WXT Conventions & Extension Identity**:
   - All runtime code in JS/TS entry points must reside inside the main callback (e.g., `defineBackground(() => { ... })`).
   - Use unified `browser` APIs provided by WXT across all browser targets.
   - **Firefox gecko.id & AMO Namespace**: Firefox `browser_specific_settings.gecko.id` only requires a valid email string format (e.g. `packtabs@topos-lab.github.io`) or UUID format. Mozilla NEVER verifies DNS records, domain ownership, or MX mailboxes; it is purely an internal unique namespace. Do not purchase domains solely for `gecko.id`.

3. **Favicon Handling**:
   - Access favicons exclusively through `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`.
   - Never use `chrome://favicon/`.

4. **Storage & Capacity**:
   - Store large or variable tab lists in `local:`, not `sync:`, to prevent exceeding Chrome's 8KB single-item sync quota.
   - Use atomic serialization queues (mutex) to avoid concurrent write loss.

5. **Commands & Keyboard Shortcuts**:
   - Chrome caches command bindings per extension ID in user Profile `Preferences`. If a command was previously set or cleared, updating `suggested_key` for the same command will NOT overwrite existing user profiles. Introduce a new command name (e.g. `open_dashboard`) if an automatic reset is required.
   - Always register `browser.commands.onCommand.addListener` in background Service Worker for non-action commands.
   - When opening dashboard pages from shortcuts/actions, always query existing tabs (`browser.tabs.query`) and focus the active window/tab instead of creating duplicate tabs.

6. **Firefox Development Runner & Profile Persistence (`webExt`)**:
   - In WXT dev mode with Firefox (`wxt -b firefox --mv3`), `web-ext` by default creates ephemeral temporary profiles in OS temp dirs, discarding all storage across restarts.
   - Always configure `firefoxProfile: './.wxt/firefox-data'` and `keepProfileChanges: true` in `wxt.config.ts`.
   - Ensure the profile directory exists on disk prior to launch (`fs.mkdirSync(..., { recursive: true })`), otherwise `web-ext` misidentifies the path as a named profile in `profiles.ini` and throws an error.

7. **Cross-Browser Session Lifecycle & Cold Start Recovery**:
   - **`runtime.onStartup` Limitation**: In Firefox (and whenever extensions are loaded as temporary add-ons via `web-ext`), Mozilla explicitly NEVER fires `browser.runtime.onStartup`.
   - **Reliable Cold Start Detection**: Do NOT rely solely on `browser.runtime.onStartup`. Use `browser.storage.session` (which browser engines wipe automatically on browser process exit, but preserve across service worker sleep cycles) to detect cold browser launches (`isColdBrowserStart`).
   - **Startup Race Condition & Window ID Collisions**:
     - Window IDs reset upon browser restarts (e.g. new window gets ID `1`, colliding with closed window ID `1`). Never rely on window ID existence to skip cold recovery.
     - Guard active tab synchronization with `isStartupComplete`: prevent blank startup windows (`about:blank`, `about:newtab`, `about:home`) from syncing and wiping cached session tabs before previous session recovery has persisted to `local:tabGroups`.
     - Support `about:home` alongside `about:blank` and `about:newtab` when detecting empty tabs for in-place dashboard replacement.

8. **Date Sorting & Property Testing Safety**:
   - When reading collections from dictionary storages (`Record<string, T>`), key order is arbitrary. Always sort explicitly.
   - When sorting by timestamps, always use safe helpers (e.g. `getTimeSafe`) returning 0 for missing/invalid dates to prevent `NaN` from breaking V8 Timsort.
   - In fast-check property tests, never assert element correspondence using array indices; always match elements by unique ID (`retrieved.find(x => x.id === item.id)`).

9. **Product Positioning & User-Centric Copy**:
   - Avoid empty technical buzzwords ("Minimalist", "High-performance") as primary value propositions.
   - Focus copy on core user productivity (e.g., saving task-focused tabs in one click vs. tedious bookmarking clutter, instant context restoration).
   - Ensure Dialog descriptions and inner card subtitles do not duplicate identical wording.

10. **Automated Quality & Lint Enforcement**:
   - Always run `bun run check` (or `bun run lint:fix`) before completing any modification.
   - Ensure 0 errors on TypeScript compile (`vue-tsc --noEmit`), ESLint (`eslint .`), and Vitest test suite (`vitest --run`).

