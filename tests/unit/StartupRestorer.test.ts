import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import StartupRestorer from '../../components/StartupRestorer.vue';
import { useToast } from '../../composables/useToast';
import { useTabStore } from '../../stores/useTabStore';
import type { TabGroup, TabItem } from '../../types/TabGroup';
import * as tabManager from '../../utils/tabManager';

function createMockDataTransfer() {
  const store: Record<string, string> = {};
  return {
    effectAllowed: 'all',
    dropEffect: 'none',
    types: ['application/packtabs-tab'],
    setData: (type: string, val: string) => {
      store[type] = val;
    },
    getData: (type: string) => store[type] ?? '',
  };
}

/**
 * Unit tests for StartupRestorer component
 * Tests 2-column minimalist layout, collapsible search, 8+1 tab collapse threshold, and restore actions.
 *
 * @vitest-environment jsdom
 */

function makeTabs(count: number, prefix = 'tab'): TabItem[] {
  return Array.from({ length: count }, (_, idx) => {
    const padded = String(idx + 1).padStart(2, '0');
    return {
      id: `${prefix}-${idx + 1}`,
      url: `https://example-${prefix}-${padded}.com/page`,
      title: `Page ${prefix} ${idx + 1}`,
    };
  });
}

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
    const { toasts, remove } = useToast();
    [...toasts.value].forEach((t) => remove(t.id));
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
    wrapper.unmount();
  });

  it('sorts tabs alphabetically by normalized URL inside restorer cards', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const savedTabTitles = wrapper
      .findAll('section')[0]
      .findAll('[data-tab-title]')
      .map((el) => el.text());
    expect(savedTabTitles).toEqual(['Figma UI', 'GitHub Repo']);
    wrapper.unmount();
  });

  it('hides card tab count badges, row domains, and the redundant visible hero subtitle', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const text = wrapper.text();
    expect(text).not.toContain('个标签页');
    expect(text).not.toContain('2 tabs');
    expect(text).not.toContain('1 tab');
    expect(text).not.toContain('github.com');
    expect(text).not.toContain('figma.com');
    expect(text).not.toContain('选择一个工作区或恢复上次会话，开启今日浏览');
    expect(text).not.toContain('Select a workspace or restore previous session to begin browsing');
    wrapper.unmount();
  });

  it('highlights the most recent history session as the last closed session', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const hasHighlightBadge =
      wrapper.text().includes('上次关闭的会话') || wrapper.text().includes('Last Closed Session');
    expect(hasHighlightBadge).toBe(true);
    wrapper.unmount();
  });

  it('calls openTabs and automatically closes the extension page when restore action button is clicked', async () => {
    const openTabsSpy = vi.spyOn(tabManager, 'openTabs').mockResolvedValue(undefined);
    browser.tabs.getCurrent = vi.fn().mockResolvedValue({ id: 888 } as any);
    browser.tabs.remove = vi.fn().mockResolvedValue(undefined as any);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const openAllBtn = wrapper.find('[data-restore-action="open-all"]');
    expect(openAllBtn.exists()).toBe(true);

    await openAllBtn.trigger('click');
    expect(openTabsSpy).toHaveBeenCalled();
    expect(browser.tabs.getCurrent).toHaveBeenCalled();
    expect(browser.tabs.remove).toHaveBeenCalledWith(888);
    wrapper.unmount();
  });

  it('calls openTabsInNewWindow without closing the restorer tab when clicking new-window button', async () => {
    const openNewWinSpy = vi.spyOn(tabManager, 'openTabsInNewWindow').mockResolvedValue(undefined);
    const removeTabSpy = vi.spyOn(browser.tabs, 'remove').mockResolvedValue(undefined as any);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const newWindowButtons = wrapper.findAll('[data-open-new-window]');
    expect(newWindowButtons.length).toBeGreaterThan(0);
    for (const btn of newWindowButtons) {
      expect(btn.classes()).not.toContain('bg-zinc-100/90');
      expect(btn.classes()).not.toContain('bg-indigo-50');
      expect(btn.classes()).not.toContain('border');
    }

    await newWindowButtons[0].trigger('click');
    expect(openNewWinSpy).toHaveBeenCalledTimes(1);
    expect(removeTabSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('calls openSingleTab when an individual tab item is clicked', async () => {
    const openSingleTabSpy = vi.spyOn(tabManager, 'openSingleTab').mockResolvedValue(undefined);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const tabOpenBtn = wrapper.find('[data-tab-open]');
    expect(tabOpenBtn.exists()).toBe(true);

    await tabOpenBtn.trigger('click');
    expect(openSingleTabSpy).toHaveBeenCalled();
    wrapper.unmount();
  });

  it('deletes groups and individual tabs with hover-only controls and 5s Undo toast recovery', async () => {
    const deleteGroupSpy = vi.spyOn(tabStore, 'deleteGroup').mockResolvedValue(undefined);
    const restoreGroupSpy = vi.spyOn(tabStore, 'restoreGroup').mockResolvedValue(undefined);
    const deleteTabSpy = vi.spyOn(tabStore, 'deleteTab').mockResolvedValue(undefined);
    const addTabSpy = vi.spyOn(tabStore, 'addTab').mockResolvedValue(true);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    // Hover-only group delete button resides beside title inside .group/header so open actions sit flush right
    const firstHeaderTitle = wrapper.find('[data-header-title]');
    const deleteGroupBtn = firstHeaderTitle.find('[data-delete-group]');
    expect(deleteGroupBtn.exists()).toBe(true);
    expect(deleteGroupBtn.classes()).toContain('opacity-0');
    expect(deleteGroupBtn.classes()).toContain('group-hover/header:opacity-100');
    expect(deleteGroupBtn.classes()).toContain('group-has-[:focus-visible]/header:opacity-100');
    expect(deleteGroupBtn.classes()).not.toContain('group-focus-within/card:opacity-100');
    const firstHeaderActions = wrapper.find('[data-header-actions]');
    expect(firstHeaderActions.find('[data-delete-group]').exists()).toBe(false);
    const actionButtons = firstHeaderActions.findAll('button');
    expect(actionButtons[actionButtons.length - 1].attributes('data-open-new-window')).toBeDefined();
    await deleteGroupBtn.trigger('click');

    expect(deleteGroupSpy).toHaveBeenCalledWith('saved-1');
    const { toasts, triggerAction } = useToast();
    const groupUndo = toasts.value.find((t) => t.action);
    expect(groupUndo).toBeDefined();
    await triggerAction(groupUndo!.id);
    expect(restoreGroupSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'saved-1' }));

    // Single tab deletion on saved group triggers deleteTab + addTab Undo
    const deleteTabButtons = wrapper.findAll('[data-delete-tab]');
    expect(deleteTabButtons[0].classes()).toContain('opacity-0');
    expect(deleteTabButtons[0].classes()).toContain('group-has-[:focus-visible]/tab:opacity-100');
    expect(deleteTabButtons[0].classes()).not.toContain('group-focus-within/tab:opacity-100');
    await deleteTabButtons[0].trigger('click');

    expect(deleteTabSpy).toHaveBeenCalledWith('saved-1', 'tab-2');
    const tabUndo = toasts.value.find((t) => t.action);
    expect(tabUndo).toBeDefined();
    await triggerAction(tabUndo!.id);
    expect(addTabSpy).toHaveBeenCalledWith('saved-1', expect.objectContaining({ id: 'tab-2' }));

    // Deleting the last tab of a 1-tab history group removes the empty history group cleanly
    deleteGroupSpy.mockClear();
    restoreGroupSpy.mockClear();
    const lastTabDeleteBtn = deleteTabButtons[deleteTabButtons.length - 1];
    await lastTabDeleteBtn.trigger('click');
    expect(deleteGroupSpy).toHaveBeenCalledWith('hist-2');
    const emptyHistUndo = toasts.value.find((t) => t.action);
    await triggerAction(emptyHistUndo!.id);
    expect(restoreGroupSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'hist-2' }));

    wrapper.unmount();
  });

  it('converts a history snapshot to a named group inline and supports Undo back to history', async () => {
    const convertSpy = vi.spyOn(tabStore, 'convertToNamed').mockResolvedValue(undefined);
    const updateSpy = vi.spyOn(tabStore, 'updateGroup').mockResolvedValue(undefined);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const historyHeader = wrapper.findAll('.group\\/header').find((h) => h.find('[data-convert-history]').exists());
    expect(historyHeader).toBeDefined();
    const convertBtn = historyHeader!.find('[data-convert-history]');
    expect(convertBtn.exists()).toBe(true);
    expect(convertBtn.classes()).toContain('opacity-0');
    expect(convertBtn.classes()).toContain('group-hover/header:opacity-100');
    expect(convertBtn.classes()).toContain('group-has-[:focus-visible]/header:opacity-100');

    await convertBtn.trigger('click');
    await nextTick();

    const nameInput = wrapper.find('[data-history-name-input]');
    expect(nameInput.exists()).toBe(true);

    await nameInput.setValue('Recovered Research');
    await nameInput.trigger('keydown', { key: 'Enter' });

    expect(convertSpy).toHaveBeenCalledWith('hist-1', 'Recovered Research');

    const { toasts, triggerAction } = useToast();
    const convertUndo = toasts.value.find((t) => t.action);
    expect(convertUndo).toBeDefined();
    await triggerAction(convertUndo!.id);
    expect(updateSpy).toHaveBeenCalledWith('hist-1', { name: null, isHistory: true });
    wrapper.unmount();
  });

  it('copies tabs when dragging from history to saved group and moves when dragging between saved groups', async () => {
    const savedGroup2: TabGroup = {
      id: 'saved-2',
      name: 'Personal',
      createdAt: new Date('2026-10-01T09:00:00Z'),
      tabs: [{ id: 'tab-9', url: 'https://example.org', title: 'Example Org' }],
      isHistory: false,
    };
    tabStore.tabGroups = [savedGroup1, savedGroup2, historyGroup1];

    const addTabSpy = vi.spyOn(tabStore, 'addTab').mockResolvedValue(true);
    const moveTabSpy = vi.spyOn(tabStore, 'moveTab').mockResolvedValue(undefined);

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    // 1. Drag from history card (right column) onto savedGroup1 (left column) -> copy via addTab
    const historyRows = wrapper.findAll('section')[1].findAll('[role="listitem"]');
    const dtCopy = createMockDataTransfer();
    const dragStartCopy = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragStartCopy, 'dataTransfer', { value: dtCopy });
    historyRows[0].element.dispatchEvent(dragStartCopy);

    const targetCard1 = wrapper.find('[data-saved-drop-card="saved-1"]');
    const dragOverCopy = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverCopy, 'dataTransfer', { value: dtCopy });
    targetCard1.element.dispatchEvent(dragOverCopy);
    expect(dtCopy.dropEffect).toBe('copy');

    const dropCopy = new Event('drop', { bubbles: true });
    Object.defineProperty(dropCopy, 'dataTransfer', { value: dtCopy });
    targetCard1.element.dispatchEvent(dropCopy);
    await nextTick();

    expect(addTabSpy).toHaveBeenCalledWith('saved-1', expect.objectContaining({ id: 'tab-4' }));
    expect(moveTabSpy).not.toHaveBeenCalled();

    // 2. Drag from savedGroup1 onto savedGroup2 -> move via moveTab (must use matching move dropEffect)
    const savedRows = wrapper.findAll('section')[0].findAll('[role="listitem"]');
    const dtMove = createMockDataTransfer();
    const dragStartMove = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragStartMove, 'dataTransfer', { value: dtMove });
    savedRows[0].element.dispatchEvent(dragStartMove);

    const targetCard2 = wrapper.find('[data-saved-drop-card="saved-2"]');
    const dragOverMove = new Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(dragOverMove, 'dataTransfer', { value: dtMove });
    targetCard2.element.dispatchEvent(dragOverMove);
    expect(dtMove.effectAllowed).toBe('move');
    expect(dtMove.dropEffect).toBe('move');

    const dropMove = new Event('drop', { bubbles: true });
    Object.defineProperty(dropMove, 'dataTransfer', { value: dtMove });
    targetCard2.element.dispatchEvent(dropMove);
    await nextTick();

    expect(moveTabSpy).toHaveBeenCalledWith('saved-1', 'saved-2', 'tab-2');
    wrapper.unmount();
  });

  it('does not display the full dashboard management button to keep startup mental model clean', () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    const fullDashboardBtn = wrapper
      .findAll('button')
      .find((b) => b.text().includes('完整管理看板') || b.text().includes('Full Dashboard'));
    expect(fullDashboardBtn).toBeUndefined();
    wrapper.unmount();
  });

  it('collapses search behind toggle icon, filters reactively, and closes on close button or Escape', async () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    // Collapsed by default
    expect(wrapper.find('input').exists()).toBe(false);
    const searchToggle = wrapper.find('[data-search-toggle]');
    expect(searchToggle.exists()).toBe(true);

    // Click toggle to expand search input
    await searchToggle.trigger('click');
    const searchInput = wrapper.find('input');
    expect(searchInput.exists()).toBe(true);

    // Filter saved & history entries
    await searchInput.setValue('Figma');
    expect(wrapper.text()).toContain('Work Project Alpha');
    expect(wrapper.text()).not.toContain('Hacker News');

    // Click close button clears query and collapses search input
    await wrapper.find('[data-search-close]').trigger('click');
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.text()).toContain('Hacker News');

    // Re-open via toggle, filter, then press Escape to clear and collapse
    await wrapper.find('[data-search-toggle]').trigger('click');
    const reopenedInput = wrapper.find('input');
    await reopenedInput.setValue('Figma');
    expect(wrapper.text()).not.toContain('Hacker News');

    await reopenedInput.trigger('keydown', { key: 'Escape' });
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.text()).toContain('Hacker News');
    wrapper.unmount();
  });

  it('opens search input when pressing "/" shortcut outside inputs', async () => {
    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.find('input').exists()).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));
    await nextTick();

    expect(wrapper.find('input').exists()).toBe(true);
    wrapper.unmount();
  });

  it('displays 8 or 9 tabs without collapsing and collapses at 10+ tabs showing +2 remaining', async () => {
    tabStore.tabGroups = [
      {
        id: 'group-8',
        name: 'Eight Tabs',
        createdAt: new Date('2026-10-03T10:00:00Z'),
        tabs: makeTabs(8, 'eight'),
        isHistory: false,
      },
      {
        id: 'group-9',
        name: 'Nine Tabs',
        createdAt: new Date('2026-10-02T10:00:00Z'),
        tabs: makeTabs(9, 'nine'),
        isHistory: false,
      },
      {
        id: 'group-10',
        name: 'Ten Tabs',
        createdAt: new Date('2026-10-01T10:00:00Z'),
        tabs: makeTabs(10, 'ten'),
        isHistory: false,
      },
    ];

    const wrapper = mount(StartupRestorer, {
      global: { plugins: [pinia] },
    });

    // Only the 10-tab group should render an expand button (+2 remaining, never "+1")
    const expandButtons = wrapper.findAll('[data-expand-toggle]');
    expect(expandButtons).toHaveLength(1);
    expect(expandButtons[0].text()).toContain('2');

    // All 8 and 9 tab rows are visible; 10-tab group initially shows 8
    expect(wrapper.text()).toContain('Page eight 8');
    expect(wrapper.text()).toContain('Page nine 9');
    expect(wrapper.text()).toContain('Page ten 8');
    expect(wrapper.text()).not.toContain('Page ten 9');
    expect(wrapper.text()).not.toContain('Page ten 10');

    // Expand 10-tab group
    await expandButtons[0].trigger('click');
    expect(wrapper.text()).toContain('Page ten 9');
    expect(wrapper.text()).toContain('Page ten 10');
    expect(
      expandButtons[0].text().includes('收起') || expandButtons[0].text().includes('Show less')
    ).toBe(true);

    // Collapse back to 8
    await expandButtons[0].trigger('click');
    expect(wrapper.text()).not.toContain('Page ten 9');
    expect(wrapper.text()).not.toContain('Page ten 10');
    wrapper.unmount();
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
    wrapper.unmount();
  });
});
