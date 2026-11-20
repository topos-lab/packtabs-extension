import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTabStore } from '../../stores/useTabStore';
import {
  activeSessionTabsStorage,
  deletedHistorySignaturesStorage,
  settingsStorage,
  tabGroupsStorage,
} from '../../types/Storage';
import type { TabGroup, TabItem } from '../../types/TabGroup';
import {
  clearWindowSessionTabs,
  DELETED_SIGNATURE_TTL_MS,
  getTabGroups,
  getTabsSignature,
  isDeletedHistorySignature,
  normalizeTabUrl,
  recordDeletedHistorySignature,
  saveHistoryTabGroup,
  saveTabGroup,
} from '../../utils/storage';

const makeTab = (url: string, title = 'Tab', id: string = crypto.randomUUID()): TabItem => ({
  id,
  url,
  title,
});

describe('History Tab Group Deduplication', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await tabGroupsStorage.setValue({});
    await deletedHistorySignaturesStorage.setValue([]);
    await activeSessionTabsStorage.setValue({});
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await tabGroupsStorage.setValue({});
    await deletedHistorySignaturesStorage.setValue([]);
    await activeSessionTabsStorage.setValue({});
  });

  describe('normalizeTabUrl & getTabsSignature', () => {
    it('normalizes trailing slashes, casing, and whitespace consistently', () => {
      expect(normalizeTabUrl('  HTTPS://Example.COM/  ')).toBe('https://example.com');
      expect(normalizeTabUrl('https://example.com/path/')).toBe('https://example.com/path');
      expect(normalizeTabUrl('https://example.com/path?a=1#sec')).toBe('https://example.com/path?a=1#sec');
    });

    it('produces identical signatures regardless of tab order or trailing slashes', () => {
      const sig1 = getTabsSignature([
        makeTab('https://github.com/'),
        makeTab('https://example.com/docs'),
      ]);
      const sig2 = getTabsSignature([
        makeTab('https://EXAMPLE.com/docs/'),
        makeTab('https://github.com'),
      ]);

      expect(sig1).toBe('https://example.com/docs|https://github.com');
      expect(sig1).toBe(sig2);
    });
  });

  describe('saveHistoryTabGroup', () => {
    it('deletes an older history group with the same tab list and keeps the latest one', async () => {
      const oldGroup: TabGroup = {
        id: 'history-old',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [
          makeTab('https://example.com', 'Old Title 1', 't-1'),
          makeTab('https://github.com', 'Old Title 2', 't-2'),
        ],
        isHistory: true,
      };
      await saveTabGroup(oldGroup);

      const newGroup: TabGroup = {
        id: 'history-new',
        name: null,
        createdAt: new Date('2026-10-02T12:00:00Z'),
        tabs: [
          makeTab('https://github.com/', 'New Title 2', 't-3'),
          makeTab('https://example.com/', 'New Title 1', 't-4'),
        ],
        isHistory: true,
      };
      await saveHistoryTabGroup(newGroup);

      const groups = await getTabGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('history-new');
      expect(groups[0].createdAt.toISOString()).toBe('2026-10-02T12:00:00.000Z');
      expect(groups[0].tabs[0].title).toBe('New Title 2');
    });

    it('preserves a newer existing history group when an older snapshot with the same tabs arrives', async () => {
      const newerGroup: TabGroup = {
        id: 'history-newer',
        name: null,
        createdAt: new Date('2026-10-03T12:00:00Z'),
        tabs: [makeTab('https://example.com', 'Latest Title', 't-new')],
        isHistory: true,
      };
      await saveTabGroup(newerGroup);

      const staleGroup: TabGroup = {
        id: 'history-stale',
        name: null,
        createdAt: new Date('2026-10-01T12:00:00Z'),
        tabs: [makeTab('https://example.com/', 'Stale Title', 't-old')],
        isHistory: true,
      };
      await saveHistoryTabGroup(staleGroup);

      const groups = await getTabGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('history-newer');
      expect(groups[0].tabs[0].title).toBe('Latest Title');
    });

    it('deletes multiple older duplicate history groups at once', async () => {
      const dup1: TabGroup = {
        id: 'dup-1',
        name: null,
        createdAt: new Date('2026-10-01T08:00:00Z'),
        tabs: [makeTab('https://a.com'), makeTab('https://b.com')],
        isHistory: true,
      };
      const dup2: TabGroup = {
        id: 'dup-2',
        name: null,
        createdAt: new Date('2026-10-01T09:00:00Z'),
        tabs: [makeTab('https://b.com/'), makeTab('https://a.com/')],
        isHistory: true,
      };
      await saveTabGroup(dup1);
      await saveTabGroup(dup2);

      const latest: TabGroup = {
        id: 'latest-3',
        name: null,
        createdAt: new Date('2026-10-02T09:00:00Z'),
        tabs: [makeTab('https://a.com'), makeTab('https://b.com')],
        isHistory: true,
      };
      await saveHistoryTabGroup(latest);

      const groups = await getTabGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('latest-3');
    });

    it('preserves other history groups with different tab lists (including subsets)', async () => {
      const subsetGroup: TabGroup = {
        id: 'history-subset',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [makeTab('https://example.com')],
        isHistory: true,
      };
      await saveTabGroup(subsetGroup);

      const supersetGroup: TabGroup = {
        id: 'history-superset',
        name: null,
        createdAt: new Date('2026-10-02T10:00:00Z'),
        tabs: [makeTab('https://example.com'), makeTab('https://github.com')],
        isHistory: true,
      };
      await saveHistoryTabGroup(supersetGroup);

      const groups = await getTabGroups();
      expect(groups).toHaveLength(2);
    });

    it('never deletes named groups (isHistory: false) even when tabs are identical', async () => {
      const namedGroup: TabGroup = {
        id: 'named-1',
        name: 'Daily Workspace',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        tabs: [makeTab('https://example.com'), makeTab('https://github.com')],
        isHistory: false,
      };
      await saveTabGroup(namedGroup);

      const oldHistory: TabGroup = {
        id: 'history-old',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [makeTab('https://example.com'), makeTab('https://github.com')],
        isHistory: true,
      };
      await saveTabGroup(oldHistory);

      const newHistory: TabGroup = {
        id: 'history-new',
        name: null,
        createdAt: new Date('2026-10-02T10:00:00Z'),
        tabs: [makeTab('https://github.com'), makeTab('https://example.com')],
        isHistory: true,
      };
      await saveHistoryTabGroup(newHistory);

      const groups = await getTabGroups();
      expect(groups).toHaveLength(2);
      expect(groups.find((g) => g.id === 'named-1')).toBeDefined();
      expect(groups.find((g) => g.id === 'history-new')).toBeDefined();
      expect(groups.find((g) => g.id === 'history-old')).toBeUndefined();
    });

    it('does not record replaced history groups into deletedHistorySignaturesStorage', async () => {
      const tabs = [makeTab('https://example.com'), makeTab('https://vitest.dev')];

      await saveHistoryTabGroup({
        id: 'h-1',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs,
        isHistory: true,
      });

      await saveHistoryTabGroup({
        id: 'h-2',
        name: null,
        createdAt: new Date('2026-10-02T10:00:00Z'),
        tabs,
        isHistory: true,
      });

      expect(await isDeletedHistorySignature(tabs)).toBe(false);
      expect(await deletedHistorySignaturesStorage.getValue()).toEqual([]);
    });

    it('handles concurrent saves atomically without leaving duplicate history groups', async () => {
      const tabs = [makeTab('https://example.com'), makeTab('https://vuejs.org')];

      await Promise.all([
        saveHistoryTabGroup({
          id: 'concurrent-1',
          name: null,
          createdAt: new Date('2026-10-02T10:00:00Z'),
          tabs,
          isHistory: true,
        }),
        saveHistoryTabGroup({
          id: 'concurrent-2',
          name: null,
          createdAt: new Date('2026-10-02T10:00:05Z'),
          tabs,
          isHistory: true,
        }),
      ]);

      const groups = await getTabGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('concurrent-2');
    });
  });

  describe('useTabStore integration', () => {
    it('reactively updates store.historyGroups when saveHistoryTabGroup replaces an older history snapshot', async () => {
      const store = useTabStore();
      const oldHistory: TabGroup = {
        id: 'store-old-history',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [makeTab('https://example.com'), makeTab('https://github.com')],
        isHistory: true,
      };
      const namedGroup: TabGroup = {
        id: 'store-named',
        name: 'Saved Copy',
        createdAt: new Date('2026-09-01T10:00:00Z'),
        tabs: [makeTab('https://example.com'), makeTab('https://github.com')],
        isHistory: false,
      };

      await saveTabGroup(oldHistory);
      await saveTabGroup(namedGroup);
      await store.loadGroups();

      expect(store.historyGroups).toHaveLength(1);
      expect(store.namedGroups).toHaveLength(1);

      const newHistory: TabGroup = {
        id: 'store-new-history',
        name: null,
        createdAt: new Date('2026-10-02T10:00:00Z'),
        tabs: [makeTab('https://github.com/'), makeTab('https://example.com/')],
        isHistory: true,
      };
      await saveHistoryTabGroup(newHistory);

      await vi.waitFor(() => {
        expect(store.historyGroups).toHaveLength(1);
        expect(store.historyGroups[0].id).toBe('store-new-history');
      });
      expect(store.namedGroups).toHaveLength(1);
      expect(store.namedGroups[0].id).toBe('store-named');
    });
  });

  describe('background window close & recovery integration', () => {
    function setupBackgroundListenerMocks() {
      const windowRemovedListeners: ((windowId: number) => void)[] = [];

      const ensureEventMock = (eventObj: { addListener?: unknown } | undefined) => {
        if (eventObj) {
          vi.spyOn(eventObj as { addListener: (cb: unknown) => void }, 'addListener').mockImplementation(() => undefined);
        }
      };

      ensureEventMock(browser.tabs.onCreated);
      ensureEventMock(browser.windows.onCreated);
      ensureEventMock(browser.tabs.onUpdated);
      ensureEventMock(browser.tabs.onMoved);
      ensureEventMock(browser.tabs.onAttached);
      ensureEventMock(browser.tabs.onDetached);
      ensureEventMock(browser.tabs.onRemoved);
      ensureEventMock(browser.runtime.onStartup);
      ensureEventMock(browser.action?.onClicked);
      ensureEventMock(browser.commands?.onCommand);
      ensureEventMock(browser.runtime.onMessage);

      vi.spyOn(browser.windows.onRemoved, 'addListener').mockImplementation((cb) => {
        windowRemovedListeners.push(cb as (windowId: number) => void);
      });

      return { windowRemovedListeners };
    }

    it('replaces older history snapshot when a window closes with the same tab list', async () => {
      const oldHistory: TabGroup = {
        id: 'bg-old-history',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [
          makeTab('https://example.com', 'Example Old', 't-old-1'),
          makeTab('https://vuejs.org', 'Vue Old', 't-old-2'),
        ],
        isHistory: true,
      };
      await saveTabGroup(oldHistory);

      const { windowRemovedListeners } = setupBackgroundListenerMocks();
      vi.spyOn(browser.windows, 'getAll').mockImplementation((async () => [
        {
          id: 42,
          type: 'normal',
          tabs: [
            { url: 'https://vuejs.org/', title: 'Vue Latest' },
            { url: 'https://example.com/', title: 'Example Latest' },
          ],
        },
      ]) as unknown as typeof browser.windows.getAll);

      vi.resetModules();
      const bgModule = await import('../../entrypoints/background');
      bgModule.default.main();

      expect(windowRemovedListeners.length).toBeGreaterThan(0);

      // Wait for initial startup sync to settle
      await vi.waitFor(async () => {
        const sessionMap = await activeSessionTabsStorage.getValue();
        expect(sessionMap['42']).toHaveLength(2);
      });

      // Trigger window 42 close
      windowRemovedListeners[0](42);

      // Wait for async onRemoved handler to finish replacing old history group
      await vi.waitFor(async () => {
        const groups = await getTabGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].id).not.toBe('bg-old-history');
      });

      const finalGroups = await getTabGroups();
      expect(finalGroups).toHaveLength(1);
      expect(finalGroups[0].isHistory).toBe(true);
      expect(finalGroups[0].tabs.map((t) => t.title)).toEqual(['Vue Latest', 'Example Latest']);

      const sessionAfter = await activeSessionTabsStorage.getValue();
      expect(sessionAfter['42']).toBeUndefined();
    });

    it('replaces older history snapshot during startup session recovery', async () => {
      const oldHistory: TabGroup = {
        id: 'recovery-old-history',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [
          makeTab('https://example.com', 'Old Recovery', 'r-old-1'),
        ],
        isHistory: true,
      };
      await saveTabGroup(oldHistory);

      await activeSessionTabsStorage.setValue({
        '99': [makeTab('https://example.com/', 'Latest Recovery', 'r-new-1')],
      });

      setupBackgroundListenerMocks();
      vi.spyOn(browser.windows, 'getAll').mockImplementation((async () => []) as unknown as typeof browser.windows.getAll);

      vi.resetModules();
      const bgModule = await import('../../entrypoints/background');
      bgModule.default.main();

      await vi.waitFor(async () => {
        const groups = await getTabGroups();
        expect(groups).toHaveLength(1);
        expect(groups[0].id).not.toBe('recovery-old-history');
      });

      const finalGroups = await getTabGroups();
      expect(finalGroups).toHaveLength(1);
      expect(finalGroups[0].isHistory).toBe(true);
      expect(finalGroups[0].tabs[0].title).toBe('Latest Recovery');
    });

    it('enforces settings.maxHistoryGroups retention limit while preserving named groups', async () => {
      await settingsStorage.setValue({
        autoCloseAfterSave: true,
        maxHistoryGroups: 2,
      });

      await saveTabGroup({
        id: 'named-keep',
        name: 'Pinned Workspace',
        createdAt: new Date('2026-01-01T10:00:00Z'),
        tabs: [makeTab('https://pinned.example.com', 'Pinned', 'p-1')],
        isHistory: false,
      });

      await saveHistoryTabGroup({
        id: 'hist-1',
        name: null,
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: [makeTab('https://one.example.com', 'One', 'h-1')],
        isHistory: true,
      });
      await saveHistoryTabGroup({
        id: 'hist-2',
        name: null,
        createdAt: new Date('2026-10-02T10:00:00Z'),
        tabs: [makeTab('https://two.example.com', 'Two', 'h-2')],
        isHistory: true,
      });
      await saveHistoryTabGroup({
        id: 'hist-3',
        name: null,
        createdAt: new Date('2026-10-03T10:00:00Z'),
        tabs: [makeTab('https://three.example.com', 'Three', 'h-3')],
        isHistory: true,
      });

      const finalGroups = await getTabGroups();
      const historyIds = finalGroups.filter((g) => g.isHistory).map((g) => g.id);
      const namedIds = finalGroups.filter((g) => !g.isHistory).map((g) => g.id);

      expect(namedIds).toEqual(['named-keep']);
      expect(historyIds).toEqual(['hist-3', 'hist-2']);
    });

    it('does not create duplicate history snapshot on window close after clearWindowSessionTabs', async () => {
      const { windowRemovedListeners } = setupBackgroundListenerMocks();
      vi.spyOn(browser.windows, 'getAll').mockImplementation((async () => [
        {
          id: 77,
          type: 'normal',
          tabs: [{ url: 'https://example.com', title: 'Example' }],
        },
      ]) as unknown as typeof browser.windows.getAll);

      vi.resetModules();
      const bgModule = await import('../../entrypoints/background');
      bgModule.default.main();

      await vi.waitFor(async () => {
        const sessionMap = await activeSessionTabsStorage.getValue();
        expect(sessionMap['77']).toHaveLength(1);
      });

      // Clear session before intentionally closing window after saving a named group
      await clearWindowSessionTabs(77);
      windowRemovedListeners[0](77);

      await new Promise((r) => setTimeout(r, 50));
      const finalGroups = await getTabGroups();
      expect(finalGroups).toHaveLength(0);
    });

    it('cancels pending debounced sync when tabs.onRemoved fires with isWindowClosing', async () => {
      const windowRemovedListeners: ((windowId: number) => void)[] = [];
      const tabUpdatedListeners: ((id: number, info: Record<string, unknown>) => void)[] = [];
      const tabRemovedListeners: ((id: number, info: { isWindowClosing: boolean }) => void)[] = [];

      const ensureEventMock = (eventObj: { addListener?: unknown } | undefined) => {
        if (eventObj) {
          vi.spyOn(eventObj as { addListener: (cb: unknown) => void }, 'addListener').mockImplementation(() => undefined);
        }
      };

      ensureEventMock(browser.tabs.onCreated);
      ensureEventMock(browser.windows.onCreated);
      ensureEventMock(browser.tabs.onMoved);
      ensureEventMock(browser.tabs.onAttached);
      ensureEventMock(browser.tabs.onDetached);
      ensureEventMock(browser.runtime.onStartup);
      ensureEventMock(browser.action?.onClicked);
      ensureEventMock(browser.commands?.onCommand);

      vi.spyOn(browser.tabs.onUpdated, 'addListener').mockImplementation((cb) => {
        tabUpdatedListeners.push(cb as unknown as (id: number, info: Record<string, unknown>) => void);
      });
      vi.spyOn(browser.tabs.onRemoved, 'addListener').mockImplementation((cb) => {
        tabRemovedListeners.push(cb as (id: number, info: { isWindowClosing: boolean }) => void);
      });
      vi.spyOn(browser.windows.onRemoved, 'addListener').mockImplementation((cb) => {
        windowRemovedListeners.push(cb as (windowId: number) => void);
      });

      let openTabsList = [{ url: 'https://example.com/important', title: 'Important' }];
      vi.spyOn(browser.windows, 'getAll').mockImplementation((async () =>
        openTabsList.length > 0
          ? [{ id: 88, type: 'normal', tabs: openTabsList }]
          : []
      ) as unknown as typeof browser.windows.getAll);

      vi.resetModules();
      const bgModule = await import('../../entrypoints/background');
      bgModule.default.main();

      await vi.waitFor(async () => {
        const sessionMap = await activeSessionTabsStorage.getValue();
        expect(sessionMap['88']).toHaveLength(1);
      });

      // Trigger a debounced update right before window closes with 0 remaining tabs
      openTabsList = [];
      tabUpdatedListeners[0](1, { status: 'complete' });
      tabRemovedListeners[0](1, { isWindowClosing: true });

      // Wait past 150ms debounce window; cancelled sync must NOT wipe window 88
      await new Promise((r) => setTimeout(r, 200));
      const sessionBeforeWindowRemove = await activeSessionTabsStorage.getValue();
      expect(sessionBeforeWindowRemove['88']).toHaveLength(1);

      windowRemovedListeners[0](88);
      await vi.waitFor(async () => {
        const groups = await getTabGroups();
        expect(groups).toHaveLength(1);
      });
    });

    it('expires deleted history signature tombstones after TTL', async () => {
      const tabs = [makeTab('https://example.com/daily')];
      await recordDeletedHistorySignature(tabs);
      expect(await isDeletedHistorySignature(tabs)).toBe(true);

      // Backdate timestamp past TTL
      await deletedHistorySignaturesStorage.setValue([
        {
          sig: getTabsSignature(tabs),
          deletedAt: Date.now() - DELETED_SIGNATURE_TTL_MS - 1000,
        },
      ]);

      expect(await isDeletedHistorySignature(tabs)).toBe(false);
    });
  });
});
