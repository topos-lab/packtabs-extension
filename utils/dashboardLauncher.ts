import { isBlankStartupTab } from '~/utils/tabManager';

export type DashboardOpenMode = 'default' | 'startup';

export interface OpenDashboardOptions {
  mode?: DashboardOpenMode;
  preferredWindowId?: number;
}

/**
 * Resolves the target normal browser window ID for launching or focusing the dashboard.
 * Priority: explicit preferredWindowId (if normal) -> focused normal window -> last focused normal window -> first normal window.
 */
export async function resolveTargetWindowId(preferredWindowId?: number): Promise<number | undefined> {
  const windows = await browser.windows.getAll();
  const normalWindows = windows.filter((w) => !w.type || w.type === 'normal');
  if (normalWindows.length === 0) {
    return undefined;
  }

  if (preferredWindowId !== undefined) {
    const preferredWin = normalWindows.find((w) => w.id === preferredWindowId);
    if (preferredWin?.id !== undefined) {
      return preferredWin.id;
    }
  }

  const focusedWin = normalWindows.find((w) => w.focused);
  if (focusedWin?.id !== undefined) {
    return focusedWin.id;
  }

  if (typeof browser.windows?.getLastFocused === 'function') {
    try {
      const lastFocused = await browser.windows.getLastFocused();
      if (lastFocused?.id !== undefined && normalWindows.some((w) => w.id === lastFocused.id)) {
        return lastFocused.id;
      }
    } catch {
      // Ignore if getLastFocused is unavailable or fails
    }
  }

  return normalWindows[0]?.id;
}

/**
 * Opens or switches to the PackTabs Dashboard tab in the target window.
 * Existing dashboard lookup is strictly scoped to the resolved target window so clicking
 * the extension icon in one window never switches focus to another window's dashboard.
 */
export async function openOrFocusDashboard({
  mode = 'default',
  preferredWindowId,
}: OpenDashboardOptions = {}): Promise<void> {
  const dashboardBaseUrl = browser.runtime.getURL('/dashboard.html');
  const isStartupMode = mode === 'startup';
  const targetUrl = isStartupMode ? `${dashboardBaseUrl}?mode=startup` : dashboardBaseUrl;

  // 1. Wait up to 2 seconds for a normal browser window to be ready (critical during startup or session restore)
  let targetWindowId: number | undefined;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      targetWindowId = await resolveTargetWindowId(preferredWindowId);
      if (targetWindowId !== undefined) {
        break;
      }
    } catch {
      // Windows API may not be ready during early startup phase
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // 2. If no normal browser window exists, create one directly rather than falling back to a global tab query
  if (targetWindowId === undefined) {
    try {
      await browser.windows.create({
        url: targetUrl,
        type: 'normal',
      });
    } catch (err) {
      console.error('Failed to create dashboard window:', err);
    }
    return;
  }

  // 3. Scope existing dashboard lookup strictly to targetWindowId
  try {
    const tabs = await browser.tabs.query({ windowId: targetWindowId });
    const existingTab = tabs.find((t) => t.url?.startsWith(dashboardBaseUrl));
    if (existingTab?.id !== undefined) {
      if (existingTab.url !== targetUrl) {
        await browser.tabs.update(existingTab.id, { url: targetUrl, active: true });
      } else {
        await browser.tabs.update(existingTab.id, { active: true });
      }
      if (existingTab.windowId !== undefined) {
        await browser.windows.update(existingTab.windowId, { focused: true });
      }
      return;
    }
  } catch (err) {
    console.error('Error finding existing dashboard tab:', err);
  }

  // 4. Replace initial blank tab in-place or create a new tab in targetWindowId
  try {
    let windowTabs = await browser.tabs.query({ windowId: targetWindowId });

    // Guard against startup navigation race conditions: if tab is still in early loading
    // without URL populated, briefly wait for pendingUrl to settle
    if (
      isStartupMode &&
      windowTabs.length === 1 &&
      windowTabs[0].status === 'loading' &&
      (!windowTabs[0].url || windowTabs[0].url === 'about:blank') &&
      !(windowTabs[0] as { pendingUrl?: string }).pendingUrl
    ) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      windowTabs = await browser.tabs.query({ windowId: targetWindowId });
    }

    const blankTab =
      windowTabs.length === 1 &&
      windowTabs[0].id !== undefined &&
      isBlankStartupTab(windowTabs[0])
        ? windowTabs[0]
        : null;

    if (blankTab?.id !== undefined) {
      await browser.tabs.update(blankTab.id, {
        url: targetUrl,
        active: true,
      });
    } else if (isStartupMode) {
      console.log('PackTabs: Skipping startup restorer because browser was launched for a targeted webpage or document.');
    } else {
      await browser.tabs.create({
        windowId: targetWindowId,
        url: targetUrl,
        active: true,
      });
    }
  } catch (err) {
    console.error('Failed to create or update dashboard tab:', err);
  }
}
