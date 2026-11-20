import { ref } from 'vue';

import type { SettingsSchema } from '~/types/Storage';
import { settingsStorage } from '~/types/Storage';
import { withSettingsLock } from '~/utils/storage';

const openOnStartup = ref(false);
const closeWindowAfterSave = ref(true);
const maxHistoryGroups = ref(10);
let isInitialized = false;
let isWatching = false;

function syncSettingRefs(settings?: Partial<SettingsSchema> | null) {
  if (!settings) {
    return;
  }
  openOnStartup.value = settings.openOnStartup ?? false;
  closeWindowAfterSave.value = settings.autoCloseAfterSave ?? true;
  if (typeof settings.maxHistoryGroups === 'number' && Number.isFinite(settings.maxHistoryGroups)) {
    maxHistoryGroups.value = settings.maxHistoryGroups;
  }
}

/**
 * Atomically merges a partial settings patch into `sync:settings` under `withSettingsLock`,
 * preventing concurrent read-modify-write races across composables and browser windows.
 */
export async function updateSettings(patch: Partial<SettingsSchema>): Promise<void> {
  await withSettingsLock(async () => {
    const current = await settingsStorage.getValue();
    await settingsStorage.setValue({
      ...current,
      ...patch,
    });
  });
}

export function useSettings() {
  async function loadSettings() {
    try {
      const settings = await settingsStorage.getValue();
      syncSettingRefs(settings);
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function initSettings() {
    if (!isWatching) {
      isWatching = true;
      try {
        if (typeof settingsStorage?.watch === 'function') {
          settingsStorage.watch((updated) => {
            syncSettingRefs(updated);
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
    await loadSettings();
  }

  async function setOpenOnStartup(value: boolean) {
    openOnStartup.value = value;
    try {
      await updateSettings({ openOnStartup: value });
    } catch (err) {
      console.error('Failed to persist openOnStartup:', err);
    }
  }

  async function setCloseWindowAfterSave(value: boolean) {
    closeWindowAfterSave.value = value;
    try {
      await updateSettings({ autoCloseAfterSave: value });
    } catch (err) {
      console.error('Failed to persist autoCloseAfterSave:', err);
    }
  }

  async function setMaxHistoryGroups(limit: number) {
    maxHistoryGroups.value = limit;
    try {
      await updateSettings({ maxHistoryGroups: limit });
    } catch (err) {
      console.error('Failed to persist maxHistoryGroups:', err);
    }
  }

  return {
    openOnStartup,
    closeWindowAfterSave,
    maxHistoryGroups,
    initSettings,
    loadSettings,
    setOpenOnStartup,
    setCloseWindowAfterSave,
    setMaxHistoryGroups,
  };
}
