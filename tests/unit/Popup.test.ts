import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PopupApp from '../../entrypoints/popup/App.vue';
import { useTabStore } from '../../stores/useTabStore';
import type { TabGroup } from '../../types/TabGroup';
import * as dashboardLauncher from '../../utils/dashboardLauncher';
import * as tabManager from '../../utils/tabManager';

/**
 * Unit tests for Quick Action Popup (`entrypoints/popup/App.vue`)
 *
 * @vitest-environment jsdom
 */

describe('Quick Action Popup', () => {
  let pinia: ReturnType<typeof createPinia>;
  let tabStore: ReturnType<typeof useTabStore>;
  let closeSpy: ReturnType<typeof vi.spyOn>;

  const savedGroup: TabGroup = {
    id: 'saved-1',
    name: 'Project Alpha',
    createdAt: new Date('2026-10-01T10:00:00Z'),
    tabs: [
      { id: 't-z', url: 'https://zeta.com', title: 'Zeta Page' },
      { id: 't-a', url: 'https://alpha.com', title: 'Alpha Page' },
    ],
    isHistory: false,
  };

  const historyGroup: TabGroup = {
    id: 'hist-1',
    name: null,
    createdAt: new Date('2026-10-02T10:00:00Z'),
    tabs: [{ id: 't-h', url: 'https://history.com', title: 'History Page' }],
    isHistory: true,
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    tabStore = useTabStore();
    vi.spyOn(tabStore, 'loadGroups').mockResolvedValue(undefined);
    tabStore.tabGroups = [savedGroup, historyGroup];
    closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
  });

  it('renders current-tabs shortcut without input boxes or full-dashboard footer link, and shows saved group names only', () => {
    const wrapper = mount(PopupApp, {
      global: { plugins: [pinia] },
    });

    expect(wrapper.find('[data-popup-current-tabs]').exists()).toBe(true);
    expect(wrapper.find('input').exists()).toBe(false);
    expect(wrapper.text()).toContain('Project Alpha');
    // Should not expose individual tab details, history groups, or extra full-dashboard link
    expect(wrapper.text()).not.toContain('Zeta Page');
    expect(wrapper.text()).not.toContain('Alpha Page');
    expect(wrapper.text()).not.toContain('History Page');
    expect(wrapper.text()).not.toContain('Full Dashboard');
    expect(wrapper.text()).not.toContain('完整管理看板');
  });

  it('opens/focuses Dashboard Current Tabs in the active window when clicking the top save entry', async () => {
    vi.spyOn(tabManager, 'getCurrentWindowId').mockResolvedValue(42);
    const launchSpy = vi.spyOn(dashboardLauncher, 'openOrFocusDashboard').mockResolvedValue(undefined);

    const wrapper = mount(PopupApp, {
      global: { plugins: [pinia] },
    });

    await wrapper.find('[data-popup-current-tabs]').trigger('click');

    expect(launchSpy).toHaveBeenCalledWith({ preferredWindowId: 42, view: 'current' });
    expect(closeSpy).toHaveBeenCalled();
  });

  it('opens saved group tabs sorted by URL in current window on click, or new window via Shift+Click / new-window icon', async () => {
    vi.spyOn(tabManager, 'getCurrentWindowId').mockResolvedValue(7);
    const openTabsSpy = vi.spyOn(tabManager, 'openTabs').mockResolvedValue(undefined);
    const openNewWinSpy = vi.spyOn(tabManager, 'openTabsInNewWindow').mockResolvedValue(undefined);

    const wrapper = mount(PopupApp, {
      global: { plugins: [pinia] },
    });

    // Click group name -> current window sorted by URL
    await wrapper.find('[data-popup-open-group]').trigger('click');
    expect(openTabsSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: 't-a', url: 'https://alpha.com' }),
        expect.objectContaining({ id: 't-z', url: 'https://zeta.com' }),
      ],
      7
    );
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // Click adjacent new-window button -> new focused window
    await wrapper.find('[data-open-new-window]').trigger('click');
    expect(openNewWinSpy).toHaveBeenCalledWith([
      expect.objectContaining({ id: 't-a', url: 'https://alpha.com' }),
      expect.objectContaining({ id: 't-z', url: 'https://zeta.com' }),
    ]);
    expect(closeSpy).toHaveBeenCalledTimes(2);
  });
});
