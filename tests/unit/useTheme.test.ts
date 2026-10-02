import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '~/composables/useTheme';
import { settingsStorage } from '~/types/Storage';

describe('useTheme Composable', () => {
  beforeEach(async () => {
    // Reset document classes
    document.documentElement.classList.remove('dark');
    // Mock settings storage
    await settingsStorage.setValue({
      autoCloseAfterSave: true,
      maxHistoryGroups: 10,
      theme: 'system',
    });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
    vi.restoreAllMocks();
  });

  it('should initialize with system theme by default', async () => {
    const { theme, initTheme } = useTheme();
    await initTheme();

    expect(theme.value).toBe('system');
  });

  it('should cycle theme through system -> light -> dark -> system', async () => {
    const { theme, cycleTheme, setTheme } = useTheme();
    await setTheme('system');
    expect(theme.value).toBe('system');

    await cycleTheme();
    expect(theme.value).toBe('light');

    await cycleTheme();
    expect(theme.value).toBe('dark');

    await cycleTheme();
    expect(theme.value).toBe('system');
  });

  it('should apply .dark class when theme is explicitly set to dark', async () => {
    const { isDark, setTheme } = useTheme();

    await setTheme('dark');
    expect(isDark.value).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should remove .dark class when theme is explicitly set to light', async () => {
    const { isDark, setTheme } = useTheme();

    await setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await setTheme('light');
    expect(isDark.value).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should update themeTooltip according to current theme', async () => {
    const { themeTooltip, setTheme } = useTheme();

    await setTheme('system');
    expect(themeTooltip.value).toContain('Auto (System)');

    await setTheme('light');
    expect(themeTooltip.value).toContain('Light');

    await setTheme('dark');
    expect(themeTooltip.value).toContain('Dark');
  });

  it('should persist theme to settingsStorage', async () => {
    const { setTheme } = useTheme();

    await setTheme('dark');
    const stored = await settingsStorage.getValue();
    expect(stored.theme).toBe('dark');
  });
});
