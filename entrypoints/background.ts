import { settingsStorage } from '~/types/Storage';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { saveTabGroup } from '~/utils/storage';
import { captureCurrentWindow, closeCurrentTabs, openSingleTab, openTabs } from '~/utils/tabManager';

export default defineBackground(() => {
  console.log('PackTabs background service worker initialized', { id: browser.runtime.id });

  // In-memory snapshot of open tabs to safely preserve history snapshots upon browser window close
  let activeTabsSnapshot: TabItem[] = [];

  async function updateActiveTabsSnapshot() {
    try {
      const tabs = await browser.tabs.query({});
      activeTabsSnapshot = tabs
        .filter((t) => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('about:'))
        .map((t) => ({
          id: crypto.randomUUID(),
          url: t.url ?? '',
          title: t.title ?? 'Untitled',
          faviconUrl: t.favIconUrl,
        }));
    } catch {
      // Ignore during browser teardown
    }
  }

  // Continuously maintain the tab snapshot
  browser.tabs.onCreated.addListener(() => void updateActiveTabsSnapshot());
  browser.tabs.onRemoved.addListener(() => void updateActiveTabsSnapshot());
  browser.tabs.onUpdated.addListener((_id, changeInfo) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
      void updateActiveTabsSnapshot();
    }
  });

  // Handle extension action icon click -> open dashboard
  browser.action.onClicked.addListener(() => {
    const dashboardUrl = browser.runtime.getURL('/dashboard.html');

    void browser.tabs.create({
      url: dashboardUrl,
      active: true,
    });
  });

  // Listen for browser window closing to create History Tab Group
  browser.windows.onRemoved.addListener(() => {
    void (async () => {
      try {
        const windows = await browser.windows.getAll();

        // Only create history group if this was the last window
        if (windows.length === 0) {
          // Attempt query first; fall back to the live snapshot if browser has already destroyed tabs
          const allTabs = await browser.tabs.query({});
          let tabItems: TabItem[] = [];

          if (allTabs.length > 0) {
            tabItems = allTabs
              .filter((tab) => tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:'))
              .map((tab) => ({
                id: crypto.randomUUID(),
                url: tab.url ?? '',
                title: tab.title ?? 'Untitled',
                faviconUrl: tab.favIconUrl,
              }));
          } else if (activeTabsSnapshot.length > 0) {
            tabItems = activeTabsSnapshot;
          }

          if (tabItems.length > 0) {
            const historyGroup: TabGroup = {
              id: crypto.randomUUID(),
              name: null,
              createdAt: new Date(),
              tabs: tabItems,
              isHistory: true,
            };

            await saveTabGroup(historyGroup);
            console.log('History Tab Group created on browser close', historyGroup);
          }
        }
      } catch (error) {
        console.error('Error creating History Tab Group on window close:', error);
      }
    })();
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

              const newGroup: TabGroup = {
                id: crypto.randomUUID(),
                name: message.name ?? null,
                createdAt: new Date(),
                tabs,
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
