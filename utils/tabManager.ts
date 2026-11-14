import type { TabItem } from '~/types/TabGroup';
import { formatDefaultGroupName } from '~/utils/date';

/**
 * Interface for tab management operations
 */
export interface TabManager {
  captureCurrentWindow(windowId?: number): Promise<TabItem[]>;
  openTabs(tabs: TabItem[], windowId?: number): Promise<void>;
  openSingleTab(tab: TabItem, inBackground?: boolean, windowId?: number): Promise<void>;
  closeCurrentTabs(windowId?: number): Promise<void>;
}

/**
 * Custom error types for tab operations
 */
export class TabPermissionDeniedError extends Error {
  constructor(url: string) {
    super(`Permission denied to access tab: ${url}`);
    this.name = 'TabPermissionDeniedError';
  }
}

export class TabNotFoundError extends Error {
  constructor(tabId: string | number) {
    super(`Tab not found: ${String(tabId)}`);
    this.name = 'TabNotFoundError';
  }
}

export class InvalidUrlError extends Error {
  constructor(url: string) {
    super(`Invalid URL: ${url}`);
    this.name = 'InvalidUrlError';
  }
}

const RESTRICTED_PROTOCOLS = [
  'chrome:',
  'chrome-extension:',
  'moz-extension:',
  'about:',
  'data:',
  'javascript:',
  'file:',
  'edge:',
  'brave:',
  'opera:',
];

/**
 * Validates and sanitizes a URL
 */
export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return !RESTRICTED_PROTOCOLS.some((protocol) => urlObj.protocol.startsWith(protocol));
  } catch {
    return false;
  }
}

/**
 * Normalizes and deduplicates an array of TabItem objects by URL,
 * preserving the first occurrence of each unique URL.
 */
export function deduplicateTabsByUrl(tabs: TabItem[]): TabItem[] {
  const seen = new Set<string>();
  return tabs.filter((tab) => {
    if (!tab.url) {return false;}
    let key = tab.url.trim();
    try {
      const u = new URL(key);
      key = (u.origin + u.pathname.replace(/\/+$/, '') + u.search + u.hash).toLowerCase();
    } catch {
      key = key.toLowerCase().replace(/\/+$/, '');
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Generates a Manifest V3 compliant favicon URL using Chrome's _favicon endpoint.
 */
export function getFaviconUrl(pageUrl: string): string {
  try {
    if (!pageUrl) {return '';}
    const extId = browser.runtime?.id;
    if (extId) {
      return `chrome-extension://${extId}/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=32`;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Resolves the window ID for the current execution context.
 * Prefers the containing tab's windowId (when invoked from an extension tab such as the dashboard)
 * to ensure multi-window isolation regardless of window focus changes, falling back to windows.getCurrent().
 */
export async function getCurrentWindowId(): Promise<number | undefined> {
  if (typeof browser.tabs?.getCurrent === 'function') {
    try {
      const currentTab = await browser.tabs.getCurrent();
      if (currentTab?.windowId !== undefined) {
        return currentTab.windowId;
      }
    } catch {
      // Ignore when called outside a tab context (e.g., background service worker or unit tests)
    }
  }

  const currentWindow = await browser.windows.getCurrent();
  return currentWindow.id;
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
 * Existing dashboard lookup is scoped to the target window so clicking the extension icon
 * in a second browser window never jumps back to an earlier window's dashboard.
 */
export async function openOrFocusDashboard(queryString = '', preferredWindowId?: number): Promise<void> {
  const dashboardBaseUrl = browser.runtime.getURL('/dashboard.html');
  const targetUrl = queryString ? `${dashboardBaseUrl}${queryString}` : dashboardBaseUrl;

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

  try {
    const tabs = await browser.tabs.query(
      targetWindowId !== undefined ? { windowId: targetWindowId } : {}
    );
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

  try {
    if (targetWindowId !== undefined) {
      let windowTabs = await browser.tabs.query({ windowId: targetWindowId });
      const isStartupMode = queryString.includes('mode=startup');

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

      // Check if the window only has an initial blank/new tab on startup
      const blankTab =
        windowTabs.length === 1 &&
        windowTabs[0].id !== undefined &&
        isBlankStartupTab(windowTabs[0])
          ? windowTabs[0]
          : null;

      if (blankTab?.id !== undefined) {
        // Normal browser startup: smoothly replace the empty initial tab in-place
        await browser.tabs.update(blankTab.id, {
          url: targetUrl,
          active: true,
        });
      } else if (isStartupMode) {
        // The browser was launched for a targeted destination (e.g. Blizzard Battle.net link, chat app link, local PDF/HTML).
        // Do NOT create a disruptive tab that steals foreground focus from the user's intended target!
        console.log('PackTabs: Skipping startup restorer because browser was launched for a targeted webpage or document.');
        return;
      } else {
        // User explicitly clicked the extension action icon or pressed shortcut: create new tab in target window
        await browser.tabs.create({
          windowId: targetWindowId,
          url: targetUrl,
          active: true,
        });
      }
    } else {
      await browser.windows.create({
        url: targetUrl,
        type: 'normal',
      });
    }
  } catch (err) {
    console.error('Failed to create or update dashboard tab or window:', err);
  }
}

/**
 * Captures all tabs from the current (or specified) browser window
 * @param windowId Optional explicit target window ID
 * @returns Array of TabItem objects representing the captured tabs
 */
export async function captureCurrentWindow(windowId?: number): Promise<TabItem[]> {
  try {
    const targetWindowId = windowId ?? (await browser.windows.getCurrent()).id;

    // Query all tabs in the target window
    const tabs = await browser.tabs.query({ windowId: targetWindowId });

    // Map browser tabs to TabItem format, filtering out restricted URLs
    const tabItems: TabItem[] = tabs
      .filter((tab) => {
        if (!tab.url) {return false;}
        return validateUrl(tab.url);
      })
      .map((tab) => ({
        id: crypto.randomUUID(),
        url: tab.url ?? '',
        title: tab.title ?? 'Untitled',
        faviconUrl: tab.favIconUrl,
      }));

    return tabItems;
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      throw new TabPermissionDeniedError('current window');
    }
    throw error;
  }
}

/**
 * Opens all tabs from a tab group in the current (or specified) window
 * @param tabs Array of TabItem objects to open
 * @param windowId Optional explicit target window ID
 */
export async function openTabs(tabs: TabItem[], windowId?: number): Promise<void> {
  try {
    const targetWindowId = windowId ?? (await browser.windows.getCurrent()).id;

    for (const tab of tabs) {
      if (!validateUrl(tab.url)) {
        console.warn(`Skipping invalid or restricted URL: ${tab.url}`);
        continue;
      }

      try {
        await browser.tabs.create({
          windowId: targetWindowId,
          url: tab.url,
          active: false,
        });
      } catch (error) {
        console.error(`Failed to open tab ${tab.url}:`, error);

        if (error instanceof Error && error.message.includes('permission')) {
          throw new TabPermissionDeniedError(tab.url);
        }
      }
    }
  } catch (error) {
    if (error instanceof TabPermissionDeniedError) {
      throw error;
    }
    throw new Error(
      `Failed to open tabs: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

/**
 * Opens a single tab in the current (or specified) window
 * @param tab TabItem object to open
 * @param inBackground Whether to open in background without switching focus
 * @param windowId Optional explicit target window ID
 */
export async function openSingleTab(
  tab: TabItem,
  inBackground = false,
  windowId?: number
): Promise<void> {
  if (!validateUrl(tab.url)) {
    throw new InvalidUrlError(tab.url);
  }

  try {
    const targetWindowId = windowId ?? (await browser.windows.getCurrent()).id;

    await browser.tabs.create({
      windowId: targetWindowId,
      url: tab.url,
      active: !inBackground,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      throw new TabPermissionDeniedError(tab.url);
    }
    throw error;
  }
}

/**
 * Closes all tabs in the current (or specified) window safely, creating a new empty tab first
 * to prevent the entire browser window from closing inadvertently.
 * @param windowId Optional explicit target window ID
 */
export async function closeCurrentTabs(windowId?: number): Promise<void> {
  try {
    const targetWindowId = windowId ?? (await browser.windows.getCurrent()).id;
    const tabs = await browser.tabs.query({ windowId: targetWindowId });

    const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

    if (tabIds.length > 0) {
      // Create a new blank tab first so the window does not close
      try {
        await browser.tabs.create({ url: 'chrome://newtab/', windowId: targetWindowId, active: true });
      } catch {
        // Ignore if tabs.create fails in headless test environment
      }

      await browser.tabs.remove(tabIds);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('No tab with id')) {
      throw new TabNotFoundError('unknown');
    }
    throw error;
  }
}

/**
 * Generates an intelligent localized default group name based on timestamp.
 * Example (en-US): "Tab Group · Oct 2, 18:40"
 * Example (zh-CN): "标签分组 · 10月2日 18:40"
 */
export function generateDefaultGroupName(date: Date = new Date(), prefix?: string): string {
  return formatDefaultGroupName(date, prefix);
}

/**
 * Detects whether the initial tabs in a browser window indicate that the browser
 * was launched specifically to view a local document (e.g. double-clicking a PDF or HTML file in OS).
 *
 * Rules:
 * 1. Checks both `url` and `pendingUrl` to guard against startup navigation race conditions.
 * 2. Returns true if there is at least one local file tab (`file://`) and NO regular remote web pages (`http://` or `https://`).
 * 3. Returns false if the window only has blank/new tab pages or normal web browsing sessions.
 */
export function isLocalFileStartup(
  tabs: { url?: string; pendingUrl?: string }[]
): boolean {
  if (!tabs || tabs.length === 0) {
    return false;
  }

  const hasLocalFile = tabs.some((tab) => {
    const u = tab.url || tab.pendingUrl || '';
    return u.startsWith('file://');
  });

  const hasRemoteWebPage = tabs.some((tab) => {
    const u = tab.url || tab.pendingUrl || '';
    return u.startsWith('http://') || u.startsWith('https://');
  });

  return hasLocalFile && !hasRemoteWebPage;
}

/**
 * Evaluates whether a given URL represents an internal empty/blank startup page.
 */
export function isBlankUrl(url?: string): boolean {
  if (!url || url === '' || url === 'about:blank' || url === 'about:newtab' || url === 'about:home') {
    return true;
  }
  if (url === 'chrome://newtab/' || url.startsWith('chrome://new-tab-page') || url.startsWith('edge://newtab')) {
    return true;
  }
  return false;
}

/**
 * Checks whether an initial startup tab is truly a blank/new-tab page ready for in-place replacement.
 *
 * Guards against startup navigation race conditions:
 * If the tab's `url` is temporarily 'about:blank' but its `pendingUrl` is already pointing
 * to an external destination (e.g. Blizzard Battle.net, chat app link, local file), it is NOT considered blank.
 */
export function isBlankStartupTab(tab?: { url?: string; pendingUrl?: string }): boolean {
  if (!tab) {
    return false;
  }

  // If pendingUrl exists and points to an external destination, it is actively navigating
  if (tab.pendingUrl && !isBlankUrl(tab.pendingUrl)) {
    return false;
  }

  return isBlankUrl(tab.url);
}

