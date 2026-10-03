import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';

import SettingsModal from '../../components/SettingsModal.vue';
import { settingsStorage } from '../../types/Storage';

/**
 * Unit tests for SettingsModal component
 * Tests settings persistence, startup hints, and external links.
 *
 * @vitest-environment jsdom
 */

describe('SettingsModal Component', () => {
  beforeEach(async () => {
    document.body.innerHTML = '';
    await settingsStorage.setValue({
      openOnStartup: false,
      autoCloseAfterSave: true,
      maxHistoryGroups: 10,
    });
    browser.commands = {
      getAll: vi.fn().mockResolvedValue([{ name: 'open_dashboard', shortcut: 'Alt+Shift+K' }]),
    } as any;
    vi.restoreAllMocks();
  });

  it('renders settings options when open is true', async () => {
    mount(SettingsModal, {
      props: {
        open: true,
      },
      attachTo: document.body,
    });

    await nextTick();
    expect(document.body.textContent).toContain('Appearance');
    expect(document.body.textContent).toContain('Language');
    expect(document.body.textContent).toContain('Restore on Startup');
    expect(document.body.textContent).toContain('Shortcut');
  });

  it('toggles openOnStartup and persists to settingsStorage', async () => {
    mount(SettingsModal, {
      props: {
        open: true,
      },
      attachTo: document.body,
    });

    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    // Locate the openOnStartup toggle checkbox
    const startupCheckbox = document.body.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(startupCheckbox).not.toBeNull();
    expect(startupCheckbox?.checked).toBe(false);

    // Toggle to true
    startupCheckbox!.checked = true;
    startupCheckbox!.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    await new Promise((r) => setTimeout(r, 30));

    const stored = await settingsStorage.getValue();
    expect(stored.openOnStartup).toBe(true);

    // Tip alert should now be visible
    expect(document.body.textContent).toContain('Chrome Startup Setting');
  });

  it('opens chrome://settings/onStartup when clicking startup settings button', async () => {
    await settingsStorage.setValue({
      openOnStartup: true,
      autoCloseAfterSave: true,
      maxHistoryGroups: 10,
    });

    const createTabSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as any);

    mount(SettingsModal, {
      props: {
        open: true,
      },
      attachTo: document.body,
    });

    await nextTick();
    // Allow loadSettings to resolve
    await new Promise((r) => setTimeout(r, 20));

    // Find the button inside the tip alert
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const tipButton = buttons.find((b) => b.textContent?.includes('Open Chrome Startup Settings'));
    expect(tipButton).toBeDefined();

    tipButton?.click();
    expect(createTabSpy).toHaveBeenCalledWith({
      url: 'chrome://settings/onStartup',
    });
  });

  it('opens chrome://extensions/shortcuts when clicking change shortcut button', async () => {
    const createTabSpy = vi.spyOn(browser.tabs, 'create').mockResolvedValue({} as any);

    mount(SettingsModal, {
      props: {
        open: true,
      },
      attachTo: document.body,
    });

    await nextTick();
    const buttons = Array.from(document.body.querySelectorAll('button'));
    const shortcutButton = buttons.find((b) => b.textContent?.includes('Change'));
    expect(shortcutButton).toBeDefined();

    shortcutButton?.click();
    expect(createTabSpy).toHaveBeenCalledWith({
      url: 'chrome://extensions/shortcuts',
    });
  });

  it('copies about:preferences#general to clipboard when on Firefox', async () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      configurable: true,
    });

    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    await settingsStorage.setValue({
      openOnStartup: true,
      autoCloseAfterSave: true,
      maxHistoryGroups: 10,
    });

    mount(SettingsModal, {
      props: {
        open: true,
      },
      attachTo: document.body,
    });

    await nextTick();
    await new Promise((r) => setTimeout(r, 20));

    const buttons = Array.from(document.body.querySelectorAll('button'));
    const tipButton = buttons.find((b) => b.textContent?.includes('Firefox'));
    expect(tipButton).toBeDefined();

    tipButton?.click();
    await nextTick();
    expect(writeTextSpy).toHaveBeenCalledWith('about:preferences#general');

    // Restore userAgent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });
});
