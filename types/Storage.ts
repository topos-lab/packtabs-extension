import { storage } from 'wxt/utils/storage';

import type { TabGroup, TabItem } from './TabGroup';

/**
 * Serialized representation of a TabGroup for persistence.
 * Uses ISO 8601 string for createdAt.
 */
export type StoredTabGroup = Omit<TabGroup, 'createdAt'> & {
  createdAt: string;
};

export type ThemeMode = 'system' | 'light' | 'dark';

/**
 * Settings configuration schema.
 */
export interface SettingsSchema {
  autoCloseAfterSave: boolean;
  maxHistoryGroups: number;
  theme?: ThemeMode;
}

/**
 * Storage schema for the extension.
 */
export interface StorageSchema {
  tabGroups: Record<string, StoredTabGroup>;
  settings: SettingsSchema;
}

/**
 * WXT storage item for tab groups.
 * Stored in Chrome Local Storage ('local:') to eliminate Chrome Sync's single-item 8KB limit (QUOTA_BYTES_PER_ITEM)
 * while providing up to 10MB of local storage capacity.
 */
export const tabGroupsStorage = storage.defineItem<StorageSchema['tabGroups']>('local:tabGroups', {
  defaultValue: {},
});

/**
 * WXT storage item for settings.
 * Stored in Chrome Sync Storage ('sync:') so user preferences synchronize across browser instances.
 */
export const settingsStorage = storage.defineItem<StorageSchema['settings']>('sync:settings', {
  defaultValue: {
    autoCloseAfterSave: true,
    maxHistoryGroups: 10,
    theme: 'system',
  },
});

/**
 * WXT storage item to persist active tabs per window.
 * Ensures history snapshots survive browser shutdowns, abrupt terminations,
 * and MV3 service worker dormancy.
 * Map of windowId -> TabItem[]
 */
export const activeSessionTabsStorage = storage.defineItem<Record<string, TabItem[]>>('local:activeSessionTabs', {
  defaultValue: {},
});
