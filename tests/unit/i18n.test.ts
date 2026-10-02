import * as fs from 'fs';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSystemLocale,useI18n } from '~/composables/useI18n';
import { en } from '~/locales/en';
import { zh_CN } from '~/locales/zh_CN';
import { zh_TW } from '~/locales/zh_TW';
import { settingsStorage } from '~/types/Storage';

describe('i18n Locales Symmetry & Quality', () => {
  const enKeys = Object.keys(en).sort();
  const zhCNKeys = Object.keys(zh_CN).sort();
  const zhTWKeys = Object.keys(zh_TW).sort();

  it('should have identical keys across en, zh_CN, and zh_TW', () => {
    expect(zhCNKeys).toEqual(enKeys);
    expect(zhTWKeys).toEqual(enKeys);
  });

  it('should not contain empty strings in any locale dictionary', () => {
    for (const key of enKeys) {
      expect(en[key as keyof typeof en].trim().length).toBeGreaterThan(0);
      expect(zh_CN[key as keyof typeof zh_CN].trim().length).toBeGreaterThan(0);
      expect(zh_TW[key as keyof typeof zh_TW].trim().length).toBeGreaterThan(0);
    }
  });

  it('should have consistent interpolation placeholders across languages', () => {
    const placeholderRegex = /\{([a-zA-Z0-9_]+)\}/g;

    for (const key of enKeys) {
      const enVal = en[key as keyof typeof en];
      const zhCNVal = zh_CN[key as keyof typeof zh_CN];
      const zhTWVal = zh_TW[key as keyof typeof zh_TW];

      const enPlaceholders = Array.from(enVal.matchAll(placeholderRegex), (m) => m[1]).sort();
      const zhCNPlaceholders = Array.from(zhCNVal.matchAll(placeholderRegex), (m) => m[1]).sort();
      const zhTWPlaceholders = Array.from(zhTWVal.matchAll(placeholderRegex), (m) => m[1]).sort();

      expect(zhCNPlaceholders, `Placeholder mismatch in zh_CN for key: ${key}`).toEqual(enPlaceholders);
      expect(zhTWPlaceholders, `Placeholder mismatch in zh_TW for key: ${key}`).toEqual(enPlaceholders);
    }
  });
});

describe('useI18n Composable', () => {
  beforeEach(async () => {
    await settingsStorage.setValue({
      autoCloseAfterSave: true,
      maxHistoryGroups: 10,
      theme: 'system',
      locale: 'system',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSystemLocale detection', () => {
    it('should detect zh_CN for Simplified Chinese navigator languages', () => {
      expect(getSystemLocale('zh-CN')).toBe('zh_CN');
      expect(getSystemLocale('zh-Hans')).toBe('zh_CN');
      expect(getSystemLocale('zh-SG')).toBe('zh_CN');
      expect(getSystemLocale('zh')).toBe('zh_CN');
    });

    it('should detect zh_TW for Traditional Chinese navigator languages', () => {
      expect(getSystemLocale('zh-TW')).toBe('zh_TW');
      expect(getSystemLocale('zh-HK')).toBe('zh_TW');
      expect(getSystemLocale('zh-MO')).toBe('zh_TW');
      expect(getSystemLocale('zh-Hant')).toBe('zh_TW');
    });

    it('should detect en for English or unsupported navigator languages', () => {
      expect(getSystemLocale('en-US')).toBe('en');
      expect(getSystemLocale('en-GB')).toBe('en');
      expect(getSystemLocale('fr-FR')).toBe('en');
      expect(getSystemLocale('ja-JP')).toBe('en');
      expect(getSystemLocale('')).toBe('en');
    });
  });

  describe('t() translation and interpolation', () => {
    it('should translate correctly in English', async () => {
      const { setLocale, t } = useI18n();
      await setLocale('en');

      expect(t('openAll')).toBe('Open All');
      expect(t('delete')).toBe('Delete');
      expect(t('tabsCount', { count: 3 })).toBe('3 tabs');
    });

    it('should translate correctly in Simplified Chinese', async () => {
      const { setLocale, t } = useI18n();
      await setLocale('zh_CN');

      expect(t('openAll')).toBe('全部打开');
      expect(t('delete')).toBe('删除');
      expect(t('tabsCount', { count: 3 })).toBe('3 个标签页');
      expect(t('savedSuccessDetail', { count: 5, name: '工作项目' })).toBe('已将 5 个标签页保存至 "工作项目"。');
    });

    it('should translate correctly in Traditional Chinese', async () => {
      const { setLocale, t } = useI18n();
      await setLocale('zh_TW');

      expect(t('openAll')).toBe('全部開啟');
      expect(t('delete')).toBe('刪除');
      expect(t('tabsCount', { count: 3 })).toBe('3 個分頁');
      expect(t('savedSuccessDetail', { count: 5, name: '工作項目' })).toBe('已將 5 個分頁儲存至 "工作項目"。');
    });

    it('should fallback to English or key when key is unknown', async () => {
      const { setLocale, t } = useI18n();
      await setLocale('zh_CN');

      // @ts-expect-error testing fallback for non-existent key
      expect(t('non_existent_key')).toBe('non_existent_key');
    });
  });

  describe('Locale persistence and switching', () => {
    it('should switch and persist locale in settingsStorage', async () => {
      const { locale, setLocale, activeLocale } = useI18n();

      await setLocale('zh_CN');
      expect(locale.value).toBe('zh_CN');
      expect(activeLocale.value).toBe('zh_CN');

      const saved = await settingsStorage.getValue();
      expect(saved.locale).toBe('zh_CN');

      await setLocale('zh_TW');
      expect(locale.value).toBe('zh_TW');
      expect(activeLocale.value).toBe('zh_TW');

      const savedTW = await settingsStorage.getValue();
      expect(savedTW.locale).toBe('zh_TW');
    });
  });
});

describe('Chrome Manifest _locales Files', () => {
  const rootDir = process.cwd();
  const localesDir = path.join(rootDir, 'public', '_locales');

  it('should contain messages.json for en, zh_CN, and zh_TW', () => {
    const requiredLocales = ['en', 'zh_CN', 'zh_TW'];

    for (const loc of requiredLocales) {
      const filePath = path.join(localesDir, loc, 'messages.json');
      expect(fs.existsSync(filePath), `Missing messages.json for ${loc}`).toBe(true);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content).toBeTypeOf('object');
      expect(content.extName).toBeDefined();
      expect(content.extName.message).toBeDefined();
      expect(content.extDescription).toBeDefined();
      expect(content.actionTitle).toBeDefined();
      expect(content.commandOpenDashboard).toBeDefined();
    }
  });
});
