import { computed, ref, watch } from 'vue';

import { updateSettings } from '~/composables/useSettings';
import { en, type MessageKey, zh_CN, zh_TW } from '~/locales';
import type { LocaleMode } from '~/types/Storage';
import { settingsStorage } from '~/types/Storage';

export type SupportedLocale = 'en' | 'zh_CN' | 'zh_TW';
export { type MessageKey };

const localeMode = ref<LocaleMode>('system');
const detectedLocale = ref<SupportedLocale>('en');
let isInitialized = false;
let isWatching = false;

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

const LOCALE_TO_BCP47: Record<SupportedLocale, string> = {
  en: 'en',
  zh_CN: 'zh-CN',
  zh_TW: 'zh-TW',
};

function syncDocumentLang(locale: SupportedLocale) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = LOCALE_TO_BCP47[locale] ?? 'en';
  }
}

watch(
  activeLocale,
  (locale) => {
    syncDocumentLang(locale);
  },
  { immediate: true }
);

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

/**
 * Formats a tab count using singular/plural keys (e.g. "1 tab" vs "3 tabs").
 */
export function formatTabsCount(count: number): string {
  return count === 1 ? t('tabCountSingle') : t('tabsCount', { count });
}

export function useI18n() {
  /**
   * Initializes locale from storage settings and browser detection.
   */
  async function initLocale() {
    detectedLocale.value = getSystemLocale();
    syncDocumentLang(activeLocale.value);

    if (!isWatching) {
      isWatching = true;
      try {
        if (typeof settingsStorage?.watch === 'function') {
          settingsStorage.watch((updated) => {
            if (updated?.locale && updated.locale !== localeMode.value) {
              localeMode.value = updated.locale;
            }
          });
        }
      } catch {
        // Ignore in environments where storage watch is unsupported
      }
    }

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
      await updateSettings({ locale: newMode });
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
    formatTabsCount,
  };
}
