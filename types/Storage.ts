import { storage } from 'wxt/utils/storage';

import type { TabGroup } from './TabGroup';

/**
 * Serialized representation of a TabGroup for persistence.
 * Uses ISO 8601 string for createdAt.
 */
export type StoredTabGroup = Omit<TabGroup, 'createdAt'> & {
  createdAt: string;
};

/**
 * Settings configuration schema.
 */
export interface SettingsSchema {
  autoCloseAfterSave: boolean;
  maxHistoryGroups: number;
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
  },
});
