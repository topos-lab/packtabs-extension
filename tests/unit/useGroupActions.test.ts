import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useGroupActions } from '../../composables/useGroupActions';
import { useTabStore } from '../../stores/useTabStore';
import type { TabGroup, TabItem } from '../../types/TabGroup';
import {
  PACKTABS_TAB_MIME,
  prepareTabsForDisplay,
  readTabDragData,
  writeTabDragData,
} from '../../utils/tabManager';

function createFakeDataTransfer() {
  const store: Record<string, string> = {};
  const types: string[] = [];
  return {
    effectAllowed: 'all',
    dropEffect: 'none',
    types,
    setData(type: string, val: string) {
      store[type] = val;
      if (!types.includes(type)) {
        types.push(type);
      }
    },
    getData(type: string) {
      return store[type] ?? '';
    },
  } as unknown as DataTransfer;
}

describe('tabManager drag & display helpers + useGroupActions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('prepareTabsForDisplay deduplicates, normalizes, and sorts by URL', () => {
    const tabs: TabItem[] = [
      { id: '2', url: 'https://zeta.example.com', title: 'Zeta' },
      { id: '1', url: 'https://www.alpha.example.com', title: 'Alpha' },
      { id: '1b', url: 'https://www.alpha.example.com', title: 'Alpha Dup' },
    ];
    const result = prepareTabsForDisplay(tabs);
    expect(result.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('writeTabDragData and readTabDragData round-trip history and saved payloads with matching effectAllowed', () => {
    const dtHistory = createFakeDataTransfer();
    const tab: TabItem = { id: 't1', url: 'https://example.com', title: 'Example' };
    writeTabDragData(dtHistory, { sourceGroupId: 'hist-1', sourceIsHistory: true, tab });

    expect(dtHistory.effectAllowed).toBe('copy');
    expect(dtHistory.getData('text/plain')).toBe('PackTabs: Example');
    expect(dtHistory.getData(PACKTABS_TAB_MIME)).toBeTruthy();

    const parsedHistory = readTabDragData(dtHistory);
    expect(parsedHistory).toEqual({
      sourceGroupId: 'hist-1',
      sourceIsHistory: true,
      tab,
    });
  });

  it('dropTabIntoSavedGroup copies history tabs via addTab without calling moveTab, and moves saved tabs via moveTab', async () => {
    const store = useTabStore();
    const savedTarget: TabGroup = {
      id: 'saved-target',
      name: 'Target',
      createdAt: new Date('2026-11-21T10:00:00Z'),
      tabs: [],
      isHistory: false,
    };
    store.tabGroups = [savedTarget];

    const addTabSpy = vi.spyOn(store, 'addTab').mockResolvedValue(true);
    const moveTabSpy = vi.spyOn(store, 'moveTab').mockResolvedValue(undefined);
    const { dropTabIntoSavedGroup } = useGroupActions();

    const tab: TabItem = { id: 'tab-h', url: 'https://docs.example.com', title: 'Docs' };
    await dropTabIntoSavedGroup({ sourceGroupId: 'hist-1', sourceIsHistory: true, tab }, 'saved-target');
    expect(addTabSpy).toHaveBeenCalledWith('saved-target', tab);
    expect(moveTabSpy).not.toHaveBeenCalled();

    addTabSpy.mockClear();
    await dropTabIntoSavedGroup({ sourceGroupId: 'saved-source', sourceIsHistory: false, tab }, 'saved-target');
    expect(moveTabSpy).toHaveBeenCalledWith('saved-source', 'saved-target', 'tab-h');
    expect(addTabSpy).not.toHaveBeenCalled();
  });
});
