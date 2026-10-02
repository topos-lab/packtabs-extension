import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import TabGroupCard from '../../components/TabGroupCard.vue';
import type { TabGroup } from '../../types/TabGroup';

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

  it('displays formatted date and snapshot subtitle for groups without name', () => {
    const historyGroup = { ...mockGroup, name: null, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Automatic session snapshot');
    expect(wrapper.find('h3').text().length).toBeGreaterThan(0);
  });

  it('displays correct tab count', () => {
    const wrapper = mount(TabGroupCard, {
      props: { group: mockGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('2 tabs');
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

  it('shows Save button for history groups', () => {
    const historyGroup = { ...mockGroup, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('Save');
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

  it('shows name input dialog when Save button clicked on history group', async () => {
    const historyGroup = { ...mockGroup, isHistory: true };
    const wrapper = mount(TabGroupCard, {
      props: { group: historyGroup },
      global: {
        plugins: [pinia],
      },
    });

    const saveButton = wrapper.findAll('button').find((btn) => btn.text().includes('Save'));
    expect(saveButton).toBeDefined();

    if (saveButton) {
      await saveButton.trigger('click');
      await wrapper.vm.$nextTick();

      // Check modal open state in vm
      expect((wrapper.vm as any).showNameDialog).toBe(true);
    }
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
});
