---
description: Chrome Extension MV3 and WXT Development Rules
trigger: always_on
---

# Chrome Extension MV3 & WXT Rules

1. **Manifest V3 Architecture**:
   - Never use MV2 APIs (e.g. `chrome.browserAction` -> `browser.action`, `background.scripts` -> `background.service_worker`).
   - Keep service workers stateless. Persist all state in `browser.storage`.

2. **WXT Conventions**:
   - All runtime code in JS/TS entry points must reside inside the main callback (e.g., `defineBackground(() => { ... })`).
   - Use unified `browser` APIs provided by WXT across all browser targets.

3. **Favicon Handling**:
   - Access favicons exclusively through `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`.
   - Never use `chrome://favicon/`.

4. **Storage & Capacity**:
   - Store large or variable tab lists in `local:`, not `sync:`, to prevent exceeding Chrome's 8KB single-item sync quota.
   - Use atomic serialization queues (mutex) to avoid concurrent write loss.
