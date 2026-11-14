import { activeSessionTabsStorage, settingsStorage } from '~/types/Storage';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { openOrFocusDashboard } from '~/utils/dashboardLauncher';
import {
  isDeletedHistorySignature,
  saveHistoryTabGroup,
  saveTabGroup,
} from '~/utils/storage';
import {
  captureCurrentWindow,
  closeCurrentTabs,
  deduplicateTabsByUrl,
  openSingleTab,
  openTabs,
  validateUrl,
} from '~/utils/tabManager';

export default defineBackground(() => {
  console.log('PackTabs background service worker initialized', { id: browser.runtime.id });

  let syncTimeout: ReturnType<typeof setTimeout> | null = null;
  let isStartupComplete = false;

  /**
   * Debounced sync of open tabs across all browser windows to storage.
   * Persists active tabs to disk so history snapshots are preserved even if
   * the browser exits abruptly or the service worker goes to sleep.
   */
  function debouncedSyncSessionTabs() {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    syncTimeout = setTimeout(() => {
      void syncCurrentSessionTabs();
    }, 150);
  }

  async function syncCurrentSessionTabs() {
    // If startup recovery has not finished yet, do not overwrite activeSessionTabsStorage
    if (isRecovering || !isStartupComplete) {
      return;
    }
    try {
      const windows = await browser.windows.getAll({ populate: true });
      const currentSessionMap: Record<string, TabItem[]> = {};

      for (const win of windows) {
        if (win.id == null || win.type !== 'normal') {continue;}

        const validTabs = (win.tabs ?? [])
          .filter((t) => t.url && validateUrl(t.url))
          .map((t) => ({
            id: crypto.randomUUID(),
            url: t.url ?? '',
            title: t.title && t.title.trim().length > 0 ? t.title : (t.url ?? 'Untitled'),
            faviconUrl: t.favIconUrl,
          }));

        const cleanTabs = deduplicateTabsByUrl(validTabs);
        if (cleanTabs.length > 0) {
          currentSessionMap[String(win.id)] = cleanTabs;
        }
      }

      await activeSessionTabsStorage.setValue(currentSessionMap);
    } catch {
      // Ignore during browser teardown or window transitions
    }
  }

  let isRecovering = false;

  /**
   * Saves a closed window's tab list as a History Tab Group, replacing any previous
   * history snapshot with the same tab list signature while respecting deletion tombstones.
   */
  async function persistClosedWindowHistory(tabs: TabItem[]): Promise<void> {
    const cleanTabs = deduplicateTabsByUrl(tabs);
    if (cleanTabs.length === 0) {
      return;
    }

    // Never resurrect user-deleted history snapshots
    const isDeleted = await isDeletedHistorySignature(cleanTabs);
    if (isDeleted) {
      return;
    }

    const historyGroup: TabGroup = {
      id: crypto.randomUUID(),
      name: null,
      createdAt: new Date(),
      tabs: cleanTabs,
      isHistory: true,
    };

    await saveHistoryTabGroup(historyGroup);
  }

  /**
   * Recovers any tabs from previous sessions that were not converted to history snapshots.
   * This is critical when the user closes the entire browser (where Chrome/Firefox exits before
   * window close handlers can finish writing) or after a restart.
   *
   * @param isBrowserStartup If true, the entire browser just launched; all saved sessions in activeSessionTabsStorage
   * belong to the previous browser run and should be recovered into history snapshots.
   */
  async function recoverPendingHistoryGroups(isBrowserStartup = false) {
    if (isRecovering) {return;}
    isRecovering = true;
    try {
      const sessionMap = await activeSessionTabsStorage.getValue();
      const windowIds = Object.keys(sessionMap);

      if (windowIds.length === 0) {
        await syncCurrentSessionTabs();
        return;
      }

      const currentWindows = await browser.windows.getAll();
      const currentWindowIds = new Set(currentWindows.map((w) => String(w.id)));

      const remainingMap = { ...sessionMap };

      for (const winId of windowIds) {
        // If the entire browser restarted, or the window is not currently open, it belonged to a closed/previous session
        if (isBrowserStartup || !currentWindowIds.has(winId)) {
          const tabs = sessionMap[winId];
          if (tabs && tabs.length > 0) {
            await persistClosedWindowHistory(tabs);
          }
          delete remainingMap[winId];
        }
      }

      await activeSessionTabsStorage.setValue(remainingMap);

      // Re-sync with current open windows
      await syncCurrentSessionTabs();
    } catch (error) {
      console.error('Failed to recover pending history groups:', error);
    } finally {
      isRecovering = false;
    }
  }

  // Track tab and window changes across all windows
  browser.tabs.onCreated.addListener(() => { debouncedSyncSessionTabs(); });
  browser.windows.onCreated.addListener(() => { debouncedSyncSessionTabs(); });

  browser.tabs.onUpdated.addListener((_id, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
      debouncedSyncSessionTabs();
    }
  });

  browser.tabs.onMoved.addListener(() => { debouncedSyncSessionTabs(); });
  browser.tabs.onAttached.addListener(() => { debouncedSyncSessionTabs(); });
  browser.tabs.onDetached.addListener(() => { debouncedSyncSessionTabs(); });

  browser.tabs.onRemoved.addListener((_tabId, removeInfo) => {
    // If the entire window is closing, do NOT wipe the session map for that window
    // so window close / startup recovery can safely capture its tabs!
    if (!removeInfo.isWindowClosing) {
      debouncedSyncSessionTabs();
    }
  });

  // Handle individual window close
  browser.windows.onRemoved.addListener((windowId) => {
    void (async () => {
      try {
        const sessionMap = await activeSessionTabsStorage.getValue();
        const closedTabs = sessionMap[String(windowId)];

        if (closedTabs && closedTabs.length > 0) {
          await persistClosedWindowHistory(closedTabs);

          const latestSessionMap = await activeSessionTabsStorage.getValue();
          if (String(windowId) in latestSessionMap) {
            const updatedMap = { ...latestSessionMap };
            delete updatedMap[String(windowId)];
            await activeSessionTabsStorage.setValue(updatedMap);
          }
        }
      } catch (error) {
        console.error('Error creating History Tab Group on window close:', error);
      }
    })();
  });

  let hasInitializedProcess = false;

  /**
   * Determines whether this background execution is a fresh browser startup (cold start)
   * vs a service worker wake-up from dormancy within an already running browser.
   * Uses browser.storage.session (cleared automatically by browser engine on browser process exit).
   */
  async function isColdBrowserStart(): Promise<boolean> {
    try {
      const sessionApi = (browser.storage as { session?: { get: (k: string) => Promise<Record<string, unknown>>; set: (v: Record<string, unknown>) => Promise<void> } })?.session;
      if (sessionApi && typeof sessionApi.get === 'function') {
        const result = await sessionApi.get('packtabs_initialized');
        if (result?.packtabs_initialized) {
          return false;
        }
        await sessionApi.set({ packtabs_initialized: true });
        return true;
      }
    } catch {
      // Session storage not available or restricted
    }

    if (!hasInitializedProcess) {
      hasInitializedProcess = true;
      return true;
    }
    return false;
  }

  let startupPromise: Promise<void> | null = null;

  /**
   * Unified startup handler executed on browser startup or background script cold start.
   * Idempotent: ensures history snapshot recovery and Startup Restorer launch occur once per browser startup.
   */
  async function handleStartup(source: 'onStartup' | 'coldInit') {
    if (startupPromise) {
      return startupPromise;
    }

    startupPromise = (async () => {
      try {
        const isCold = await isColdBrowserStart();
        const isStartup = isCold || source === 'onStartup';

        if (!isStartup) {
          // Service worker woke up from dormancy during normal browsing;
          // only recover windows that closed while background worker was dormant
          await recoverPendingHistoryGroups(false);
          return;
        }

        // Cold startup: recover all pending sessions from previous browser run into history snapshots
        await recoverPendingHistoryGroups(true);

        try {
          const settings = await settingsStorage.getValue();
          if (settings.openOnStartup) {
            await openOrFocusDashboard({ mode: 'startup' });
          }
        } catch (err) {
          console.error('Failed to open startup restorer on browser startup:', err);
        }
      } finally {
        isStartupComplete = true;
        // Run initial session tabs sync for current browser window
        await syncCurrentSessionTabs();
      }
    })();

    return startupPromise;
  }

  // Recover on browser startup and optionally open Startup Restorer
  browser.runtime.onStartup.addListener(() => {
    void handleStartup('onStartup');
  });

  // Also initialize and recover when service worker / background script wakes up
  void handleStartup('coldInit');

  // Handle extension action icon click -> open or focus dashboard in the clicked window
  // Cross-browser compatibility: browser.action (Chrome / MV3) vs browser.browserAction (Firefox / MV2)
  const actionApi =
    (browser.action as typeof browser.action | undefined) ??
    (browser.browserAction as unknown as typeof browser.action | undefined);
  if (actionApi?.onClicked) {
    actionApi.onClicked.addListener((tab) => {
      void openOrFocusDashboard({ preferredWindowId: tab?.windowId });
    });
  }

  // Handle keyboard shortcut command -> open or focus dashboard in the active window
  browser.commands.onCommand.addListener((command, tab) => {
    if (
      command === 'open_dashboard' ||
      command === '_execute_action' ||
      command === '_execute_browser_action'
    ) {
      void openOrFocusDashboard({ preferredWindowId: tab?.windowId });
    }
  });

  // Message handler for tab capture and restoration operations
  browser.runtime.onMessage.addListener(
    async (
      message: {
        type: string;
        name?: string;
        isHistory?: boolean;
        tabs?: TabItem[];
        tab?: TabItem;
      },
      sender
    ) => {
      try {
        const senderWindowId = sender?.tab?.windowId;
        switch (message.type) {
          case 'CAPTURE_TABS': {
            const tabs = await captureCurrentWindow(senderWindowId);
            const cleanTabs = deduplicateTabsByUrl(tabs);

            const newGroup: TabGroup = {
              id: crypto.randomUUID(),
              name: message.name ?? null,
              createdAt: new Date(),
              tabs: cleanTabs,
              isHistory: message.isHistory ?? false,
            };

            await saveTabGroup(newGroup);

            const settings = await settingsStorage.getValue();
            if (settings.autoCloseAfterSave) {
              await closeCurrentTabs(senderWindowId);
            }

            return { success: true, group: newGroup };
          }

          case 'OPEN_TABS': {
            if (message.tabs) {
              await openTabs(message.tabs, senderWindowId);
            }
            return { success: true };
          }

          case 'OPEN_SINGLE_TAB': {
            if (message.tab) {
              await openSingleTab(message.tab, false, senderWindowId);
            }
            return { success: true };
          }

          case 'CLOSE_CURRENT_TABS': {
            await closeCurrentTabs(senderWindowId);
            return { success: true };
          }

          default:
            return { success: false, error: 'Unknown message type' };
        }
      } catch (error) {
        console.error('Error handling message:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
});
