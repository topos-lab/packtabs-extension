import { activeSessionTabsStorage, settingsStorage } from '~/types/Storage';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { saveTabGroup } from '~/utils/storage';
import { captureCurrentWindow, closeCurrentTabs, deduplicateTabsByUrl, openSingleTab, openTabs, validateUrl } from '~/utils/tabManager';

export default defineBackground(() => {
  console.log('PackTabs background service worker initialized', { id: browser.runtime.id });

  let syncTimeout: ReturnType<typeof setTimeout> | null = null;

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
    }, 400);
  }

  async function syncCurrentSessionTabs() {
    try {
      const windows = await browser.windows.getAll({ populate: true });
      const currentSessionMap: Record<string, TabItem[]> = {};

      for (const win of windows) {
        if (win.id == null || win.type !== 'normal') continue;

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

  /**
   * Recovers any tabs from previous sessions that were not converted to history snapshots.
   * This is critical when the user closes the entire browser (where Chrome exits before
   * window close handlers can finish writing) or after a restart.
   */
  async function recoverPendingHistoryGroups() {
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
      let hasRecovered = false;

      for (const winId of windowIds) {
        // If the window is not currently open, it belonged to a closed/previous session
        if (!currentWindowIds.has(winId)) {
          const tabs = sessionMap[winId];
          if (tabs && tabs.length > 0) {
            const cleanTabs = deduplicateTabsByUrl(tabs);
            const historyGroup: TabGroup = {
              id: crypto.randomUUID(),
              name: null,
              createdAt: new Date(),
              tabs: cleanTabs,
              isHistory: true,
            };

            await saveTabGroup(historyGroup);
            hasRecovered = true;
          }
          delete remainingMap[winId];
        }
      }

      if (hasRecovered) {
        await activeSessionTabsStorage.setValue(remainingMap);
      }

      // Re-sync with current open windows
      await syncCurrentSessionTabs();
    } catch (error) {
      console.error('Failed to recover pending history groups:', error);
    }
  }

  // --- Browser Event Listeners ---

  // Track tab changes across all windows
  browser.tabs.onCreated.addListener(() => debouncedSyncSessionTabs());

  browser.tabs.onUpdated.addListener((_id, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url || changeInfo.title) {
      debouncedSyncSessionTabs();
    }
  });

  browser.tabs.onMoved.addListener(() => debouncedSyncSessionTabs());
  browser.tabs.onAttached.addListener(() => debouncedSyncSessionTabs());
  browser.tabs.onDetached.addListener(() => debouncedSyncSessionTabs());

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
          const cleanTabs = deduplicateTabsByUrl(closedTabs);
          const historyGroup: TabGroup = {
            id: crypto.randomUUID(),
            name: null,
            createdAt: new Date(),
            tabs: cleanTabs,
            isHistory: true,
          };

          await saveTabGroup(historyGroup);

          const updatedMap = { ...sessionMap };
          delete updatedMap[String(windowId)];
          await activeSessionTabsStorage.setValue(updatedMap);
        }
      } catch (error) {
        console.error('Error creating History Tab Group on window close:', error);
      }
    })();
  });

  // Recover on browser startup
  browser.runtime.onStartup.addListener(() => {
    void recoverPendingHistoryGroups();
  });

  // Also initialize and recover when service worker wakes up
  void recoverPendingHistoryGroups();

  // Handle extension action icon click -> open dashboard
  browser.action.onClicked.addListener(() => {
    const dashboardUrl = browser.runtime.getURL('/dashboard.html');

    void browser.tabs.create({
      url: dashboardUrl,
      active: true,
    });
  });

  // Message handler for tab capture and restoration operations
  browser.runtime.onMessage.addListener(
    (
      message: {
        type: string;
        name?: string;
        isHistory?: boolean;
        tabs?: TabItem[];
        tab?: TabItem;
      },
      _sender,
      sendResponse
    ) => {
      void (async () => {
        try {
          switch (message.type) {
            case 'CAPTURE_TABS': {
              const tabs = await captureCurrentWindow();
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
                await closeCurrentTabs();
              }

              sendResponse({ success: true, group: newGroup });
              break;
            }

            case 'OPEN_TABS': {
              if (message.tabs) {
                await openTabs(message.tabs);
              }
              sendResponse({ success: true });
              break;
            }

            case 'OPEN_SINGLE_TAB': {
              if (message.tab) {
                await openSingleTab(message.tab);
              }
              sendResponse({ success: true });
              break;
            }

            case 'CLOSE_CURRENT_TABS': {
              await closeCurrentTabs();
              sendResponse({ success: true });
              break;
            }

            default:
              sendResponse({ success: false, error: 'Unknown message type' });
          }
        } catch (error) {
          console.error('Error handling message:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })();

      return true;
    }
  );
});
