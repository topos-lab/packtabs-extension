import { computed, ref } from 'vue';

import { en, type MessageKey, zh_CN, zh_TW } from '~/locales';
import type { LocaleMode } from '~/types/Storage';
import { settingsStorage } from '~/types/Storage';

export type SupportedLocale = 'en' | 'zh_CN' | 'zh_TW';
export { type MessageKey };

const localeMode = ref<LocaleMode>('system');
const detectedLocale = ref<SupportedLocale>('en');
let isInitialized = false;

/**
 * Detects the system/browser UI language and maps to a supported locale.
 * Priority: browser.i18n.getUILanguage() -> navigator.language -> fallback 'en'
 */
export function getSystemLocale(langInput?: string): SupportedLocale {
  try {
    let lang = langInput ?? '';
    if (!lang) {
      if (typeof browser !== 'undefined' && browser.i18n?.getUILanguage) {
        lang = browser.i18n.getUILanguage();
      } else if (typeof navigator !== 'undefined') {
        lang =
          navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage || '';
      }
    }

    const normalized = lang.toLowerCase();
    if (
      normalized.startsWith('zh-tw') ||
      normalized.startsWith('zh-hk') ||
      normalized.startsWith('zh-mo') ||
      normalized.includes('hant')
    ) {
      return 'zh_TW';
    }
    if (normalized.startsWith('zh')) {
      return 'zh_CN';
    }
  } catch {
    // Fallback on any error
  }
  return 'en';
}

/**
 * Active effective locale used for translation lookup.
 */
export const activeLocale = computed<SupportedLocale>(() => {
  if (localeMode.value === 'system') {
    return detectedLocale.value;
  }
  return localeMode.value;
});

const dictionaries: Record<SupportedLocale, Record<string, string>> = {
  en,
  zh_CN,
  zh_TW,
};

/**
 * Translates a given key into the currently active locale with parameter interpolation.
 * Falls back to English if key is missing in active locale.
 *
 * Example: t('tabsCount', { count: 5 }) -> "5 个标签页" / "5 tabs"
 */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const currentDict = dictionaries[activeLocale.value] || dictionaries.en;
  let text = currentDict[key] ?? dictionaries.en[key] ?? String(key);

  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{${paramKey}}`, String(value));
    }
  }

  return text;
}

export function useI18n() {
  /**
   * Initializes locale from storage settings and browser detection.
   */
  async function initLocale() {
    detectedLocale.value = getSystemLocale();

    if (isInitialized) {
      return;
    }
    isInitialized = true;

    try {
      const settings = await settingsStorage.getValue();
      if (settings?.locale) {
        localeMode.value = settings.locale;
      }
    } catch (err) {
      console.error('Failed to load locale preference:', err);
    }
  }

  /**
   * Updates locale mode and persists choice to browser sync storage.
   */
  async function setLocale(newMode: LocaleMode) {
    localeMode.value = newMode;

    try {
      const current = await settingsStorage.getValue();
      await settingsStorage.setValue({
        ...current,
        locale: newMode,
      });
    } catch (err) {
      console.error('Failed to persist locale preference:', err);
    }
  }

  return {
    locale: localeMode,
    localeMode,
    activeLocale,
    initLocale,
    setLocale,
    t,
  };
}
