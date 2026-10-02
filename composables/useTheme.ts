import { computed, ref } from 'vue';

import { t } from '~/composables/useI18n';
import { settingsStorage } from '~/types/Storage';
import type { ThemeMode } from '~/types/Storage';

const theme = ref<ThemeMode>('system');
const isDark = ref(false);
let isInitialized = false;

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return;

  const shouldBeDark = mode === 'dark' || (mode === 'system' && getSystemPrefersDark());
  isDark.value = shouldBeDark;

  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function useTheme() {
  async function initTheme() {
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
      } else if (typeof (mediaQuery as any).addListener === 'function') {
        (mediaQuery as any).addListener(listener);
      }
    }
  }

  async function setTheme(newMode: ThemeMode) {
    theme.value = newMode;
    applyTheme(newMode);

    try {
      const current = await settingsStorage.getValue();
      await settingsStorage.setValue({
        ...current,
        theme: newMode,
      });
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
