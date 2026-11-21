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

4. **Storage, Cross-Context Concurrency & Settings**:
   - Store large or variable tab lists in `local:`, not `sync:`, to prevent exceeding Chrome's 8KB single-item sync quota.
   - MV3 Service Worker and Dashboard run in separate JS contexts: serialize writes across contexts with named Web Locks (`navigator.locks` via `createMutex` in `utils/storage.ts`: `withLock`, `withSessionLock`, `withSettingsLock`), falling back to an in-memory queue only in test environments lacking `navigator.locks`.
   - Route all `sync:settings` writes (`theme`, `locale`, `autoCloseAfterSave`, `maxHistoryGroups`, `openOnStartup`) through `updateSettings` in `composables/useSettings.ts` and subscribe with `settingsStorage.watch` for multi-window synchronization.
   - Always validate persisted array fields defensively on read (e.g. `Array.isArray(tabs) ? tabs : []`) rather than casting raw storage objects directly.

5. **Commands & Keyboard Shortcuts**:
   - Chrome caches command bindings per extension ID in user Profile `Preferences`. If a command was previously set or cleared, updating `suggested_key` for the same command will NOT overwrite existing user profiles. Introduce a new command name (e.g. `open_dashboard`) if an automatic reset is required.
   - Always register `browser.commands.onCommand.addListener` in background Service Worker for non-action commands.
   - When opening dashboard pages from shortcuts/actions, always query existing tabs (`browser.tabs.query`) and focus the active window/tab instead of creating duplicate tabs.
   - When focusing an already-open Dashboard tab for a specific view target (e.g. Popup launching `'current'`), send `SELECT_DASHBOARD_VIEW_MESSAGE` via `browser.tabs.sendMessage` to switch views in-place without reloading the page.

6. **Firefox Development Runner & Profile Persistence (`webExt`)**:
   - In WXT dev mode with Firefox (`wxt -b firefox --mv3`), `web-ext` by default creates ephemeral temporary profiles in OS temp dirs, discarding all storage across restarts.
   - Always configure `firefoxProfile: './.wxt/firefox-data'` and `keepProfileChanges: true` in `wxt.config.ts`.
   - Ensure the profile directory exists on disk prior to launch (`fs.mkdirSync(..., { recursive: true })`), otherwise `web-ext` misidentifies the path as a named profile in `profiles.ini` and throws an error.

7. **Cross-Browser Session Lifecycle, Snapshot Hygiene & Cold Start**:
   - **`runtime.onStartup` Limitation**: In Firefox (and temporary add-ons via `web-ext`), `browser.runtime.onStartup` never fires. Detect cold browser launches via `browser.storage.session` (`isColdBrowserStart`), and **fail closed** (`return false`) if `storage.session` is unavailable — never fall back to an in-memory boolean (service workers sleep and lose in-memory state).
   - **Startup Race Condition & Window ID Collisions**:
     - Window IDs reset after browser restarts; never rely on window ID existence to skip cold recovery.
     - Guard active tab sync with `isStartupComplete` so blank startup tabs (`about:blank`, `about:newtab`, `about:home`) cannot wipe cached previous-session tabs before recovery persists to `local:tabGroups`.
     - Treat `about:home` alongside `about:blank` and `about:newtab` as replaceable empty tabs.
   - **Close-After-Save & Snapshot Deduplication Hygiene**:
     - Before intentionally closing a window after saving a named group (`browser.windows.remove`), explicitly call `clearWindowSessionTabs(windowId)` so `windows.onRemoved` does not create a duplicate history snapshot.
     - Cancel pending debounced session sync (`cancelPendingSessionSync`) in `tabs.onRemoved` when `removeInfo.isWindowClosing` is true and in `windows.onRemoved`.
     - Keep history deletion tombstones (`deletedHistorySignaturesStorage`) TTL-bounded (5 minutes) instead of permanent; discard legacy bare-string entries on read rather than re-stamping them.

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
   - `bun run check` does NOT refresh `.output/chrome-mv3` or `.output/firefox-mv3`: whenever code or UI edits will be verified in a locally loaded unpacked extension, always run `bun run build` (and `bun run build:firefox` when testing Firefox) after the final edit; odd-minor dev builds expose `__APP_BUILD_TIME__` in the About dialog to confirm freshness.

11. **Even/Odd Versioning & Extension Store Release Strategy**:
   - **Odd Minors for Active Development**: Odd minor versions (`1.1.0`, `1.3.0`) represent active work-in-progress development cycles. Never submit odd-minor packages to public extension stores.
   - **Even Minors for Stable Store Releases**: Even minor versions (`1.0.0`, `1.2.0`, `1.4.0`) designate milestone production releases verified for Chrome Web Store and Firefox AMO submission. Hotfix patches use `MAJOR.EVEN_MINOR.PATCH` (e.g. `1.2.1`).
   - **Store Numerical Format Rule**: Manifest V3 and AMO reject non-numeric version suffixes (e.g. `-dev`, `-beta`). Versions across `package.json`, `wxt.config.ts`, and manifest must strictly use dot-separated integers (`X.Y.Z`).

12. **Continuous Changelog, Automated CI Submission & Docs Boundary**:
   - Maintain `CHANGELOG.md` adhering to Keep a Changelog (`Added`, `Fixed`, `Changed`), recording changes immediately under the active odd-minor dev header.
   - **Pre-Release Gate**: `.github/workflows/release.yml` automatically builds and runs `bun run submit` (Chrome Web Store + Firefox AMO) on every `v*` tag push when GitHub Secrets are configured. Always write the curated bilingual `### 📦 Chrome Web Store & Firefox AMO Release Notes` block in `CHANGELOG.md` **before** running `bun run release`, and never run local `bun run submit` concurrently with a tag push.
   - Release/submission parsers must extract metadata strictly within the target version section (`## [X.Y.Z]`), never scanning across older versions.
   - Keep `README.md` focused on end-user value and quick start; maintain release mechanics, store credentials, and CI/CD workflows in `docs/RELEASING.md`.

13. **UI/UX, Drag-and-Drop & Anti-Over-Design Invariants**:
   - **Theme-Aware Tooltips (Zero Native Button `title`)**: Never use native HTML `title` attributes on interactive buttons. Wrap controls in `<Tooltip>` (`delayDuration: 300`, `skipDelayDuration: 300`, `disable-hoverable-content` on `TooltipProvider` and `TooltipRoot`, `max-w-md` + `line-clamp-*`, no `transition-all` animation). Put `v-if` on `<Tooltip>` itself (never on the child inside `<TooltipTrigger as-child>`), place subtle interaction hints in card footers/empty states rather than repetitive row tooltips, and show tab-row hover tooltips **only when content overflows** (`scrollWidth > clientWidth`).
   - **HTML5 Drag-and-Drop & Non-Sticky Hover Controls**: In real browsers, a mismatch between `dragstart` `effectAllowed` and `dragover` `dropEffect` silently rejects drops (even when jsdom tests pass). Route tab drag payloads through `writeTabDragData` / `readTabDragData` in `utils/tabManager.ts`, matching `dropEffect` dynamically (`'copy'` for History -> Saved, `'move'` for Saved -> Saved) and avoiding raw URLs in `text/plain` (which trigger Chrome Split View). Reveal hover-only card/row buttons with `group-has-[:focus-visible]` + `focus-visible:opacity-100` (never `group-focus-within`, which sticks visible after mouse clicks/drags) and call `.blur()` on `document.activeElement` on drag start/end.
   - **Neutral Floating Toasts & Global Visibility**: Style `ToastContainer.vue` as a neutral theme-matched floating card (`bg-white` / `dark:bg-[#27272c]`) with semantic status icons and brand Indigo Undo actions; always mount `<ToastContainer />` outside mode-conditional `v-if`/`v-else` branches (e.g. `isStartupMode`).
   - **Accessible Row Controls & Shared Seams**: Never nest `<button>` elements inside clickable rows; render primary open and secondary remove/delete controls as sibling `<button>` elements. Consolidate shared group/tab restoration, 5s Undo deletions, and drag-drop persistence in `composables/useGroupActions.ts` and `utils/tabManager.ts` rather than duplicating handlers across views; keep `public/_locales/*/messages.json` strictly limited to the 4 Manifest `__MSG_*__` keys (`extName`, `extDescription`, `actionTitle`, `commandOpenDashboard`).

