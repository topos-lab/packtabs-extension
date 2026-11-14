import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  captureCurrentWindow,
  getCurrentWindowId,
  openOrFocusDashboard,
  openSingleTab,
  openTabs,
  resolveTargetWindowId,
} from '../../utils/tabManager';

const DASHBOARD_URL = 'chrome-extension://test-ext-id/dashboard.html';

describe('Multi-window dashboard opening and current window resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(browser.runtime, 'getURL').mockImplementation((path = '') => {
      const normalized = path.startsWith('/') ? path.slice(1) : path;
      return `chrome-extension://test-ext-id/${normalized}`;
    });
  });

  describe('resolveTargetWindowId', () => {
    it('selects preferredWindowId (Window 2) over Window 1 when both are normal windows', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      const targetId = await resolveTargetWindowId(2);
      expect(targetId).toBe(2);
    });

    it('falls back to focused normal window if preferredWindowId is a popup window', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
        { id: 3, type: 'popup', focused: false },
      ] as any);

      const targetId = await resolveTargetWindowId(3);
      expect(targetId).toBe(2);
    });

    it('selects the focused normal window when preferredWindowId is omitted', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      const targetId = await resolveTargetWindowId();
      expect(targetId).toBe(2);
    });

    it('uses getLastFocused when no normal window reports focused: true', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: false },
      ] as any);
      vi.spyOn(browser.windows, 'getLastFocused').mockResolvedValue({
        id: 2,
        type: 'normal',
      } as any);

      const targetId = await resolveTargetWindowId();
      expect(targetId).toBe(2);
    });
  });

  describe('openOrFocusDashboard', () => {
    it('opens dashboard in Window 2 even when Window 1 already has an open dashboard tab', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      const querySpy = vi.spyOn(browser.tabs, 'query').mockImplementation(async (queryInfo: any) => {
        if (queryInfo.windowId === 1) {
          return [{ id: 101, windowId: 1, url: DASHBOARD_URL }] as any;
        }
        if (queryInfo.windowId === 2) {
          return [
            { id: 201, windowId: 2, url: 'https://example.com' },
            { id: 202, windowId: 2, url: 'https://vitest.dev' },
          ] as any;
        }
        return [];
      });

      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 203, windowId: 2 } as any);
      const windowsUpdateSpy = vi.spyOn(browser.windows, 'update').mockResolvedValue({} as any);

      await openOrFocusDashboard({ preferredWindowId: 2 });

      // Should query only Window 2, never focus Window 1's dashboard tab
      expect(querySpy).toHaveBeenCalledWith({ windowId: 2 });
      expect(createSpy).toHaveBeenCalledWith({
        windowId: 2,
        url: DASHBOARD_URL,
        active: true,
      });
      expect(windowsUpdateSpy).not.toHaveBeenCalledWith(1, expect.anything());
    });

    it('opens dashboard in Window 2 when no dashboard exists anywhere and user clicks icon in Window 2', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 201, windowId: 2, url: 'https://github.com' },
      ] as any);

      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 202, windowId: 2 } as any);

      await openOrFocusDashboard({ preferredWindowId: 2 });

      expect(createSpy).toHaveBeenCalledWith({
        windowId: 2,
        url: DASHBOARD_URL,
        active: true,
      });
    });

    it('focuses the existing dashboard tab inside Window 2 without creating a duplicate', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 201, windowId: 2, url: 'https://github.com' },
        { id: 202, windowId: 2, url: DASHBOARD_URL },
      ] as any);

      const updateTabSpy = vi.spyOn(browser.tabs, 'update').mockResolvedValue({} as any);
      const updateWindowSpy = vi.spyOn(browser.windows, 'update').mockResolvedValue({} as any);
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as any);

      await openOrFocusDashboard({ preferredWindowId: 2 });

      expect(updateTabSpy).toHaveBeenCalledWith(202, { active: true });
      expect(updateWindowSpy).toHaveBeenCalledWith(2, { focused: true });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('replaces a single blank tab in-place inside Window 2', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 201, windowId: 2, url: 'chrome://newtab/' },
      ] as any);

      const updateTabSpy = vi.spyOn(browser.tabs, 'update').mockResolvedValue({} as any);
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as any);

      await openOrFocusDashboard({ preferredWindowId: 2 });

      expect(updateTabSpy).toHaveBeenCalledWith(201, {
        url: DASHBOARD_URL,
        active: true,
      });
      expect(createSpy).not.toHaveBeenCalled();
    });

    it('opens in the focused window (Window 2) when invoked without preferredWindowId', async () => {
      vi.spyOn(browser.windows, 'getAll').mockResolvedValue([
        { id: 1, type: 'normal', focused: false },
        { id: 2, type: 'normal', focused: true },
      ] as any);

      vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 201, windowId: 2, url: 'https://vuejs.org' },
      ] as any);

      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 202, windowId: 2 } as any);

      await openOrFocusDashboard();

      expect(createSpy).toHaveBeenCalledWith({
        windowId: 2,
        url: DASHBOARD_URL,
        active: true,
      });
    });
  });

  describe('getCurrentWindowId and captureCurrentWindow', () => {
    it('prefers browser.tabs.getCurrent().windowId over browser.windows.getCurrent()', async () => {
      browser.tabs.getCurrent = vi.fn().mockResolvedValue({ id: 205, windowId: 2 } as any);
      vi.spyOn(browser.windows, 'getCurrent').mockResolvedValue({ id: 1 } as any);
      const querySpy = vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 201, windowId: 2, url: 'https://window2.example.com', title: 'Window 2 Tab' },
      ] as any);

      const winId = await getCurrentWindowId();
      expect(winId).toBe(2);

      const captured = await captureCurrentWindow(winId);
      expect(querySpy).toHaveBeenCalledWith({ windowId: 2 });
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe('https://window2.example.com');
    });

    it('falls back to browser.windows.getCurrent() when tabs.getCurrent() returns undefined', async () => {
      browser.tabs.getCurrent = vi.fn().mockResolvedValue(undefined as any);
      vi.spyOn(browser.windows, 'getCurrent').mockResolvedValue({ id: 1 } as any);

      const winId = await getCurrentWindowId();
      expect(winId).toBe(1);
    });

    it('defaults captureCurrentWindow, openTabs, and openSingleTab to tabs.getCurrent().windowId when windowId is omitted', async () => {
      browser.tabs.getCurrent = vi.fn().mockResolvedValue({ id: 205, windowId: 2 } as any);
      vi.spyOn(browser.windows, 'getCurrent').mockResolvedValue({ id: 1 } as any);
      const querySpy = vi.spyOn(browser.tabs, 'query').mockResolvedValue([
        { id: 201, windowId: 2, url: 'https://window2.example.com', title: 'Window 2 Tab' },
      ] as any);
      const createSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({ id: 206, windowId: 2 } as any);

      const captured = await captureCurrentWindow();
      expect(querySpy).toHaveBeenCalledWith({ windowId: 2 });
      expect(captured).toHaveLength(1);

      await openTabs(captured);
      expect(createSpy).toHaveBeenCalledWith({
        windowId: 2,
        url: 'https://window2.example.com',
        active: false,
      });

      await openSingleTab(captured[0], true);
      expect(createSpy).toHaveBeenLastCalledWith({
        windowId: 2,
        url: 'https://window2.example.com',
        active: false,
      });
    });
  });
});
