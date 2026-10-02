import type { TabItem } from '~/types/TabGroup';
import { formatDefaultGroupName } from '~/utils/date';

/**
 * Interface for tab management operations
 */
export interface TabManager {
  captureCurrentWindow(): Promise<TabItem[]>;
  openTabs(tabs: TabItem[]): Promise<void>;
  openSingleTab(tab: TabItem): Promise<void>;
  closeCurrentTabs(): Promise<void>;
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
 * Captures all tabs from the current browser window
 * @returns Array of TabItem objects representing the captured tabs
 */
export async function captureCurrentWindow(): Promise<TabItem[]> {
  try {
    // Get the current window
    const currentWindow = await browser.windows.getCurrent();

    // Query all tabs in the current window
    const tabs = await browser.tabs.query({ windowId: currentWindow.id });

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
 * Opens all tabs from a tab group in the current window
 * @param tabs Array of TabItem objects to open
 */
export async function openTabs(tabs: TabItem[]): Promise<void> {
  try {
    const currentWindow = await browser.windows.getCurrent();

    for (const tab of tabs) {
      if (!validateUrl(tab.url)) {
        console.warn(`Skipping invalid or restricted URL: ${tab.url}`);
        continue;
      }

      try {
        await browser.tabs.create({
          windowId: currentWindow.id,
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
 * Opens a single tab in the current window
 * @param tab TabItem object to open
 * @param inBackground Whether to open in background without switching focus
 */
export async function openSingleTab(tab: TabItem, inBackground = false): Promise<void> {
  if (!validateUrl(tab.url)) {
    throw new InvalidUrlError(tab.url);
  }

  try {
    const currentWindow = await browser.windows.getCurrent();

    await browser.tabs.create({
      windowId: currentWindow.id,
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
 * Closes all tabs in the current window safely, creating a new empty tab first
 * to prevent the entire browser window from closing inadvertently.
 */
export async function closeCurrentTabs(): Promise<void> {
  try {
    const currentWindow = await browser.windows.getCurrent();
    const tabs = await browser.tabs.query({ windowId: currentWindow.id });

    const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => id !== undefined);

    if (tabIds.length > 0) {
      // Create a new blank tab first so the window does not close
      try {
        await browser.tabs.create({ url: 'chrome://newtab/', windowId: currentWindow.id, active: true });
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
