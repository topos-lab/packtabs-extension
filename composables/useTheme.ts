import { computed, ref } from 'vue';

import { t } from '~/composables/useI18n';
import { updateSettings } from '~/composables/useSettings';
import type { ThemeMode } from '~/types/Storage';
import { settingsStorage } from '~/types/Storage';

const THEME_CACHE_KEY = 'packtabs:theme-mode';

const theme = ref<ThemeMode>('system');
const isDark = ref(false);
let isInitialized = false;
let isWatching = false;

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {return false;}
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function cacheTheme(mode: ThemeMode) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_CACHE_KEY, mode);
    }
  } catch {
    // Ignore storage failures in restricted contexts
  }
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') {return;}

  const shouldBeDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
  isDark.value = shouldBeDark;

  document.documentElement.style.colorScheme = shouldBeDark ? 'dark' : 'light';
  document.documentElement.classList.toggle('dark', shouldBeDark);
  document.documentElement.classList.toggle('light', !shouldBeDark);
  cacheTheme(mode);
}

/**
 * Synchronously apply cached theme preference before first paint to prevent light-mode flash
 * when extension pages (especially the toolbar popup) open in dark mode.
 */
export function applyCachedTheme() {
  let cached: ThemeMode = 'system';
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(THEME_CACHE_KEY);
      if (raw === 'light' || raw === 'dark' || raw === 'system') {
        cached = raw;
      }
    }
  } catch {
    // Ignore storage access errors
  }

  theme.value = cached;
  applyTheme(cached);
}

export function useTheme() {
  async function initTheme() {
    if (!isWatching) {
      isWatching = true;
      try {
        if (typeof settingsStorage?.watch === 'function') {
          settingsStorage.watch((updated) => {
            if (updated?.theme && updated.theme !== theme.value) {
              theme.value = updated.theme;
              applyTheme(updated.theme);
            }
          });
        }
      } catch {
        // Ignore in environments where storage watch is unsupported
      }
    }

    if (isInitialized) {
      applyTheme(theme.value);
      return;
    }
    isInitialized = true;

    try {
      const settings = await settingsStorage.getValue();
      theme.value = settings.theme ?? 'system';
    } catch (err) {
      console.error('Failed to load theme preference:', err);
    }

    applyTheme(theme.value);

    // Listen to OS prefers-color-scheme changes
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        if (theme.value === 'system') {
          applyTheme('system');
        }
      };
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', listener);
      }
    }
  }

  async function setTheme(newMode: ThemeMode) {
    theme.value = newMode;
    applyTheme(newMode);

    try {
      await updateSettings({ theme: newMode });
    } catch (err) {
      console.error('Failed to persist theme preference:', err);
    }
  }

  async function cycleTheme() {
    const cycleMap: Record<ThemeMode, ThemeMode> = {
      system: 'light',
      light: 'dark',
      dark: 'system',
    };
    await setTheme(cycleMap[theme.value]);
  }

  const themeTooltip = computed(() => {
    switch (theme.value) {
      case 'system':
        return t('themeTooltipSystem', { current: isDark.value ? t('themeDark') : t('themeLight') });
      case 'light':
        return t('themeTooltipLight');
      case 'dark':
        return t('themeTooltipDark');
    }
  });

  return {
    theme,
    isDark,
    initTheme,
    setTheme,
    cycleTheme,
    themeTooltip,
  };
}
