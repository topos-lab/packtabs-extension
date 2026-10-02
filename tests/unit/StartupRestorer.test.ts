import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import StartupRestorer from '../../components/StartupRestorer.vue';
import { useTabStore } from '../../stores/useTabStore';
import type { TabGroup } from '../../types/TabGroup';
import * as tabManager from '../../utils/tabManager';

/**
 * Unit tests for StartupRestorer component
 * Tests 2-column layout, saved groups vs history snapshots, latest session highlight, and restore actions.
 *
 * @vitest-environment jsdom
 */

describe('StartupRestorer Component', () => {
  let pinia: ReturnType<typeof createPinia>;
  let tabStore: ReturnType<typeof useTabStore>;

  const savedGroup1: TabGroup = {
    id: 'saved-1',
    name: 'Work Project Alpha',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    tabs: [
      { id: 'tab-1', url: 'https://github.com/project', title: 'GitHub Repo' },
      { id: 'tab-2', url: 'https://figma.com/file', title: 'Figma UI' },
    ],
    isHistory: false,
  };

  const historyGroup1: TabGroup = {
    id: 'hist-1',
    name: null,
    createdAt: new Date('2026-10-02T18:30:00Z'),
    tabs: [
      { id: 'tab-3', url: 'https://news.ycombinator.com', title: 'Hacker News' },
      { id: 'tab-4', url: 'https://developer.chrome.com', title: 'Chrome Docs' },
    ],
    isHistory: true,
  };

  const historyGroup2: TabGroup = {
    id: 'hist-2',
    name: null,
    createdAt: new Date('2026-10-01T15:00:00Z'),
    tabs: [{ id: 'tab-5', url: 'https://vuejs.org', title: 'Vue Documentation' }],
    isHistory: true,
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    tabStore = useTabStore();
    tabStore.tabGroups = [savedGroup1, historyGroup1, historyGroup2];
    browser.commands = {
      getAll: vi.fn().mockResolvedValue([]),
    } as any;
    vi.restoreAllMocks();
  });

  it('renders the 2-column layout headers for Saved Groups and History Snapshots', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const text = wrapper.text();
    expect(text).toContain('PackTabs');
    expect(text).toContain('Work Project Alpha');
    expect(text).toContain('GitHub Repo');
  });

  it('highlights the most recent history session as the last closed session', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    // historyGroup1 is from 10-02 18:30 (newer than historyGroup2 10-01 15:00)
    // The component should render the "lastClosedSession" / "上次关闭的会话" indicator for it
    const hasHighlightBadge =
      wrapper.text().includes('上次关闭的会话') || wrapper.text().includes('Last Closed Session');
    expect(hasHighlightBadge).toBe(true);
  });

  it('calls openTabs and automatically closes the extension page when "Open All" / "Restore" button is clicked', async () => {
    const openTabsSpy = vi.spyOn(tabManager, 'openTabs').mockResolvedValue(undefined);
    browser.tabs.getCurrent = vi.fn().mockResolvedValue({ id: 888 } as any);
    browser.tabs.remove = vi.fn().mockResolvedValue(undefined as any);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    // Find first action button (restore/open all)
    const openAllBtn = wrapper.find('button.bg-indigo-600');
    expect(openAllBtn.exists()).toBe(true);

    await openAllBtn.trigger('click');
    expect(openTabsSpy).toHaveBeenCalled();
    expect(browser.tabs.getCurrent).toHaveBeenCalled();
    expect(browser.tabs.remove).toHaveBeenCalledWith(888);
  });

  it('calls openSingleTab when an individual tab item is clicked', async () => {
    const openSingleTabSpy = vi.spyOn(tabManager, 'openSingleTab').mockResolvedValue(undefined);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const tabRow = wrapper.find('.group\\/tab');
    expect(tabRow.exists()).toBe(true);

    await tabRow.trigger('click');
    expect(openSingleTabSpy).toHaveBeenCalled();
  });

  it('does not display the full dashboard management button to keep startup mental model clean', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const fullDashboardBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('完整管理看板') || b.text().includes('Full Dashboard'));
    expect(fullDashboardBtn).toBeUndefined();
  });

  it('filters both saved and history groups reactively via search query', async () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const searchInput = wrapper.find('input');
    expect(searchInput.exists()).toBe(true);

    // Search for "Figma" (only in savedGroup1)
    await searchInput.setValue('Figma');

    expect(wrapper.text()).toContain('Work Project Alpha');
    // History groups should show empty state
    expect(wrapper.text()).not.toContain('Hacker News');
  });

  it('renders empty states when no saved groups or history groups exist', () => {
    tabStore.tabGroups = [];

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const text = wrapper.text();
    const hasEmptySaved = text.includes('暂无保存的工作区') || text.includes('No saved workspaces yet');
    const hasEmptyHistory = text.includes('暂无历史会话快照') || text.includes('No history sessions yet');
    expect(hasEmptySaved).toBe(true);
    expect(hasEmptyHistory).toBe(true);
  });
});
