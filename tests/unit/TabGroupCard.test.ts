import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TabGroupCard from '../../components/TabGroupCard.vue';
import { Tooltip } from '../../components/ui/tooltip';
import { useToast } from '../../composables/useToast';
import { useTabStore } from '../../stores/useTabStore';
import type { TabGroup } from '../../types/TabGroup';
import * as tabManager from '../../utils/tabManager';

/**
 * Unit tests for TabGroupCard component
 * Tests button click handlers, inline editing, and conditional rendering
 * Requirements: 3.2, 4.1, 4.3, 6.5
 *
 * @vitest-environment jsdom
 */

describe('TabGroupCard Component', () => {
  let pinia: ReturnType<typeof createPinia>;
  let mockGroup: TabGroup;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    const { toasts, remove } = useToast();
    [...toasts.value].forEach((t) => remove(t.id));
    vi.restoreAllMocks();

    mockGroup = {
      id: 'test-group-1',
      name: 'Test Group',
      createdAt: new Date('2024-01-15T10:30:00Z'),
      tabs: [
        {
          id: 'tab-1',
          url: 'https://example.com',
          title: 'Example Site',
          faviconUrl: 'https://example.com/favicon.ico',
        },
        {
          id: 'tab-2',
          url: 'https://test.com',
          title: 'Test Site',
        },
      ],
      isHistory: false,
    };
  });

  it('renders tab group with correct title', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Test Group');
  });

  it('displays formatted date for groups without name and no redundant subtitle', () => {
    const historyGroup = { ...mockGroup, name: null, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find('h3').text().length).toBeGreaterThan(0);
    expect(wrapper.text()).not.toContain('Automatic session snapshot');
    expect(wrapper.text()).not.toContain('History Tab Group');
  });

  it('converts history group to named group when renamed via inline edit', async () => {
    const store = useTabStore();
    const convertSpy = vi.spyOn(store, 'convertToNamed').mockResolvedValue(undefined);

    const historyGroup = { ...mockGroup, name: null, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    const editButton = wrapper.find('[aria-label="Save as named group"]');
    expect(editButton.exists()).toBe(true);
    await editButton.trigger('click');
    await wrapper.vm.$nextTick();

    const input = wrapper.find('input');
    await input.setValue('My Saved Group');
    await (wrapper.vm as any).saveTitle();

    expect(convertSpy).toHaveBeenCalledWith(historyGroup.id, 'My Saved Group');
  });

  it('hides visible tab count badge and surfaces count in Open All tooltip', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).not.toContain('2 tabs');
    expect(wrapper.text()).not.toContain('个标签页');
    const openAllBtn = wrapper.findAll('button').find((btn) => btn.text().includes('Open All'));
    expect(openAllBtn?.attributes('title')).toBeUndefined();
    const tooltips = wrapper.findAllComponents(Tooltip);
    expect(tooltips.some((tip) => String(tip.props('content')).includes('2 tabs'))).toBe(true);
  });

  it('sorts tabs alphabetically by normalized URL', () => {
    const unsortedGroup: TabGroup = {
      ...mockGroup,
      tabs: [
        { id: 't-z', url: 'https://zeta.com/home', title: 'Zeta' },
        { id: 't-wb', url: 'https://www.alpha.com/b', title: 'Alpha B' },
        { id: 't-a', url: 'http://alpha.com/a', title: 'Alpha A' },
      ],
    };
    const wrapper = mount(TabGroupCard, {
      props: { group: unsortedGroup },
      global: {
        plugins: [pinia],
      },
    });

    const rowTitles = wrapper.findAll('[role="listitem"]').map((row) => row.text());
    expect(rowTitles[0]).toContain('Alpha A');
    expect(rowTitles[1]).toContain('Alpha B');
    expect(rowTitles[2]).toContain('Zeta');
  });

  it('displays formatted creation date', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const text = wrapper.text();
    expect(text).toMatch(/2024/);
    expect(text).toMatch(/Jan/);
  });

  it('omits the explicit Save text button on history groups and uses a borderless new-window icon button', () => {
    const historyGroup = { ...mockGroup, name: null, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    const saveTextBtn = wrapper.findAll('button').find((btn) => btn.text().trim() === 'Save');
    expect(saveTextBtn).toBeUndefined();

    const headerConvertBtn = wrapper.find('.group\\/header [aria-label="Save as named group"]');
    expect(headerConvertBtn.exists()).toBe(true);
    expect(headerConvertBtn.classes()).toContain('group-hover/header:opacity-100');

    const newWindowBtn = wrapper.find('[data-open-new-window]');
    expect(newWindowBtn.classes()).not.toContain('bg-zinc-100/90');
    expect(newWindowBtn.classes()).not.toContain('border');
  });

  it('does not show Save button for named groups', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).not.toContain('Save');
    expect(wrapper.text()).toContain('Open All');
  });

  it('expands inline naming input when title-hover convert icon clicked on history group and converts with 5s Undo toast', async () => {
    const store = useTabStore();
    const convertSpy = vi.spyOn(store, 'convertToNamed').mockResolvedValue(undefined);
    const updateSpy = vi.spyOn(store, 'updateGroup').mockResolvedValue(undefined);

    const historyGroup = { ...mockGroup, name: null, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    const convertButton = wrapper.find('[aria-label="Save as named group"]');
    expect(convertButton.exists()).toBe(true);

    await convertButton.trigger('click');
    await wrapper.vm.$nextTick();

    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    expect(wrapper.emitted('save')).toBeUndefined();

    // Pressing Enter without typing uses generated default name
    await input.trigger('keydown', { key: 'Enter' });
    await wrapper.vm.$nextTick();

    expect(convertSpy).toHaveBeenCalledWith(historyGroup.id, expect.any(String));
    expect(wrapper.emitted('save')?.[0]).toEqual([historyGroup.id]);

    // Undo toast reverts group back to history
    const { toasts, triggerAction } = useToast();
    const undoToast = toasts.value.find((t) => t.action?.label);
    expect(undoToast).toBeDefined();
    await triggerAction(undoToast!.id);
    expect(updateSpy).toHaveBeenCalledWith(historyGroup.id, { name: null, isHistory: true });
  });

  it('enables inline editing when edit button clicked', async () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const editButton = wrapper.find('[aria-label="Edit group name"]');
    expect(editButton.exists()).toBe(true);

    await editButton.trigger('click');
    await wrapper.vm.$nextTick();

    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
  });

  it('renders all tabs in the group', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Example Site');
    expect(wrapper.text()).toContain('Test Site');
  });

  it('displays Open All button', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Open All');
  });

  it('displays Delete button', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Delete');
  });

  it('renders tab rows with draggable attribute and cursor-move class', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const tabRows = wrapper.findAll('[draggable="true"]');
    expect(tabRows.length).toBe(2);
    expect(tabRows[0].classes()).toContain('cursor-move');
    expect(tabRows[1].classes()).toContain('cursor-move');
  });

  it('ignores Enter key during IME composition when editing group name', async () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const editButton = wrapper.find('[aria-label="Edit group name"]');
    await editButton.trigger('click');
    await wrapper.vm.$nextTick();

    const input = wrapper.find('input');
    await input.setValue('New IME Name');

    // Simulate IME composition Enter (isComposing: true) - should stay in edit mode
    const imeEvent = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true });
    input.element.dispatchEvent(imeEvent);
    await wrapper.vm.$nextTick();

    expect(wrapper.find('input').exists()).toBe(true);
  });

  it('opens all tabs in a new window when clicking the adjacent new-window button', async () => {
    const openNewWinSpy = vi.spyOn(tabManager, 'openTabsInNewWindow').mockResolvedValue(undefined);
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const newWindowBtn = wrapper.find('[data-open-new-window]');
    expect(newWindowBtn.exists()).toBe(true);
    await newWindowBtn.trigger('click');

    expect(openNewWinSpy).toHaveBeenCalledTimes(1);
  });

  it('deletes group immediately without confirmation dialog and supports 5s Undo toast', async () => {
    const store = useTabStore();
    const deleteSpy = vi.spyOn(store, 'deleteGroup').mockResolvedValue(undefined);
    const restoreSpy = vi.spyOn(store, 'restoreGroup').mockResolvedValue(undefined);

    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const deleteBtn = wrapper.find('[aria-label="Delete tab group"]');
    expect(deleteBtn.exists()).toBe(true);
    await deleteBtn.trigger('click');

    expect(deleteSpy).toHaveBeenCalledWith(mockGroup.id);

    const { toasts, triggerAction } = useToast();
    const undoToast = toasts.value.find((t) => t.action?.label === 'Undo');
    expect(undoToast).toBeDefined();

    await triggerAction(undoToast!.id);
    expect(restoreSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockGroup.id,
        name: mockGroup.name,
      })
    );
  });

  it('disables Open All and displays empty state when group has 0 tabs', () => {
    const emptyGroup: TabGroup = {
      ...mockGroup,
      tabs: [],
    };
    const wrapper = mount(TabGroupCard, {
      props: { group: emptyGroup },
      global: {
        plugins: [pinia],
      },
    });

    const openAllBtn = wrapper.findAll('button').find((b) => b.text().includes('Open All'));
    expect(openAllBtn?.attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('No tabs in this tab group.');
  });

  it('provides accessible aria-labels on inline edit Save and Cancel buttons', async () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    const editButton = wrapper.find('[aria-label="Edit group name"]');
    await editButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[aria-label="Save"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Cancel"]').exists()).toBe(true);
  });

  it('writes copy drag payload for history groups and move drag payload for named groups', () => {
    const createDt = () => {
      const data: Record<string, string> = {};
      return {
        effectAllowed: 'all',
        setData: (type: string, val: string) => {
          data[type] = val;
        },
        getData: (type: string) => data[type] ?? '',
      };
    };

    const historyWrapper = mount(TabGroupCard, {
      props: { group: { ...mockGroup, name: null, isHistory: true } },
      global: { plugins: [pinia] },
    });
    const dtHistory = createDt();
    const dragHist = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragHist, 'dataTransfer', { value: dtHistory });
    historyWrapper.find('[role="listitem"]').element.dispatchEvent(dragHist);

    expect(dtHistory.effectAllowed).toBe('copy');
    const histPayload = JSON.parse(dtHistory.getData('application/packtabs-tab'));
    expect(histPayload.sourceIsHistory).toBe(true);

    const namedWrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: { plugins: [pinia] },
    });
    const dtNamed = createDt();
    const dragNamed = new Event('dragstart', { bubbles: true });
    Object.defineProperty(dragNamed, 'dataTransfer', { value: dtNamed });
    namedWrapper.find('[role="listitem"]').element.dispatchEvent(dragNamed);

    expect(dtNamed.effectAllowed).toBe('move');
    const namedPayload = JSON.parse(dtNamed.getData('application/packtabs-tab'));
    expect(namedPayload.sourceIsHistory).toBe(false);
  });
});
