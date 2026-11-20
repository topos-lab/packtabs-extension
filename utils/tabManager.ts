import { getBrowserType } from '~/lib/utils';
import type { TabItem } from '~/types/TabGroup';
import { formatDefaultGroupName } from '~/utils/date';
import { normalizeTabUrl } from '~/utils/storage';

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

/**
 * Validates and sanitizes a URL, allowing only http and https protocols.
 */
export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Extracts a display hostname/domain from a URL string safely.
 */
export function getDomain(url?: string): string {
  if (!url) {
    return '';
  }
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
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
    const key = normalizeTabUrl(tab.url);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Generates a Manifest V3 compliant favicon URL using Chrome's _favicon endpoint.
 * Returns an empty string on Firefox where the Chromium _favicon API is unavailable.
 */
export function getFaviconUrl(pageUrl: string): string {
  try {
    if (!pageUrl || getBrowserType() === 'firefox') {
      return '';
    }
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
 * Resolves the target window ID for tab operations.
 * Uses the explicit windowId if provided, otherwise resolves the current execution window.
 */
async function resolveOperationWindowId(windowId?: number): Promise<number | undefined> {
  return windowId ?? (await getCurrentWindowId());
}

/**
 * Captures all tabs from the current (or specified) browser window
 * @param windowId Optional explicit target window ID
 * @returns Array of TabItem objects representing the captured tabs
 */
export async function captureCurrentWindow(windowId?: number): Promise<TabItem[]> {
  try {
    const targetWindowId = await resolveOperationWindowId(windowId);

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
    const targetWindowId = await resolveOperationWindowId(windowId);

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
    const targetWindowId = await resolveOperationWindowId(windowId);

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
    const targetWindowId = await resolveOperationWindowId(windowId);
    const tabs = await browser.tabs.query({ windowId: targetWindowId });

    const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

    if (tabIds.length > 0) {
      // Create a new browser-default blank tab first so the window does not close
      try {
        await browser.tabs.create({ windowId: targetWindowId, active: true });
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

