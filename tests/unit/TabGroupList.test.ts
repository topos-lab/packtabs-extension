import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import TabGroupCard from '../../components/TabGroupCard.vue';
import TabGroupList from '../../components/TabGroupList.vue';
import type { TabGroup } from '../../types/TabGroup';

/**
 * Unit tests for TabGroupList component
 * Tests rendering multiple cards and empty state display
 * Requirements: 5.3
 *
 * @vitest-environment jsdom
 */

describe('TabGroupList Component', () => {
  let pinia: ReturnType<typeof createPinia>;
  let mockGroups: TabGroup[];

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);

    mockGroups = [
      {
        id: 'group-1',
        name: 'Work Tabs',
        createdAt: new Date('2024-01-01T12:00:00Z'),
        tabs: [
          {
            id: 'tab-1',
            url: 'https://example.com',
            title: 'Example Site',
            faviconUrl: 'https://example.com/favicon.ico',
          },
        ],
        isHistory: false,
      },
      {
        id: 'group-2',
        name: null,
        createdAt: new Date('2024-01-02T12:00:00Z'),
        tabs: [
          {
            id: 'tab-2',
            url: 'https://test.com',
            title: 'Test Site',
            faviconUrl: undefined,
          },
        ],
        isHistory: true,
      },
      {
        id: 'group-3',
        name: 'Personal Tabs',
        createdAt: new Date('2024-01-03T12:00:00Z'),
        tabs: [
          {
            id: 'tab-3',
            url: 'https://personal.com',
            title: 'Personal Site',
            faviconUrl: 'https://personal.com/favicon.ico',
          },
        ],
        isHistory: false,
      },
    ];
  });

  it('renders multiple TabGroupCard components', () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: mockGroups },
      global: {
        plugins: [pinia],
        stubs: {
          TabGroupCard: false,
        },
      },
    });

    const cards = wrapper.findAllComponents(TabGroupCard);
    expect(cards).toHaveLength(3);
  });

  it('passes correct group prop to each TabGroupCard', () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: mockGroups },
      global: {
        plugins: [pinia],
        stubs: {
          TabGroupCard: false,
        },
      },
    });

    const cards = wrapper.findAllComponents(TabGroupCard);

    expect(cards[0]?.props('group')).toEqual(mockGroups[0]);
    expect(cards[1]?.props('group')).toEqual(mockGroups[1]);
    expect(cards[2]?.props('group')).toEqual(mockGroups[2]);
  });

  it('renders group names in the list', () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: mockGroups },
      global: {
        plugins: [pinia],
        stubs: {
          TabGroupCard: false,
        },
      },
    });

    const text = wrapper.text();
    expect(text).toContain('Work Tabs');
    expect(text).toContain('Personal Tabs');
    expect(wrapper.findAllComponents(TabGroupCard).length).toBe(3);
  });

  it('displays empty state when no groups provided', () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: [] },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain('No tab groups yet');
    expect(wrapper.text()).toContain('Save your current tabs to create your first tab group');
  });

  it('does not render TabGroupCard when groups array is empty', () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: [] },
      global: {
        plugins: [pinia],
      },
    });

    const cards = wrapper.findAllComponents(TabGroupCard);
    expect(cards).toHaveLength(0);
  });

  it('shows empty state icon when no groups', () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: [] },
      global: {
        plugins: [pinia],
      },
    });

    // Check for empty state svg icon
    const icon = wrapper.find('svg');
    expect(icon.exists()).toBe(true);
  });

  it('emits save event when TabGroupCard emits save', async () => {
    const wrapper = mount(TabGroupList, {
      props: { groups: mockGroups },
      global: {
        plugins: [pinia],
        stubs: {
          TabGroupCard: false,
        },
      },
    });

    const cards = wrapper.findAllComponents(TabGroupCard);
    const historyCard = cards[1];

    if (historyCard) {
      await historyCard.vm.$emit('save', 'group-2');
      expect(wrapper.emitted('save')).toBeTruthy();
      expect(wrapper.emitted('save')?.[0]).toEqual(['group-2']);
    }
  });

  it('renders single group correctly', () => {
    const singleGroup: TabGroup[] = [mockGroups[0]];
    const wrapper = mount(TabGroupList, {
      props: { groups: singleGroup },
      global: {
        plugins: [pinia],
        stubs: {
          TabGroupCard: false,
        },
      },
    });

    const cards = wrapper.findAllComponents(TabGroupCard);
    expect(cards).toHaveLength(1);
    expect(wrapper.text()).toContain('Work Tabs');
  });
});
