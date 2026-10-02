import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { tabGroupsStorage } from '~/types/Storage';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import {
  deleteTabFromGroup as deleteTabFromGroupInStorage,
  deleteTabGroup as deleteTabGroupFromStorage,
  deserializeTabGroup,
  getTabGroups,
  saveTabGroup as saveTabGroupToStorage,
  StorageQuotaExceededError,
  updateTabGroup as updateTabGroupInStorage,
} from '~/utils/storage';
import { captureCurrentWindow, TabPermissionDeniedError } from '~/utils/tabManager';

/**
 * Optional error handler that can be registered from the UI
 */
let errorHandler: ((error: Error) => void) | null = null;

export function setStoreErrorHandler(handler: (error: Error) => void) {
  errorHandler = handler;
}

function handleError(error: unknown, defaultMessage: string): never {
  const err = error instanceof Error ? error : new Error(String(error));

  if (errorHandler) {
    errorHandler(err);
  } else {
    console.error(defaultMessage, err);
  }

  throw err;
}

/**
 * Pinia store for managing tab groups with reactive state and optimistic local updates
 */
export const useTabStore = defineStore('tabs', () => {
  // State
  const tabGroups = ref<TabGroup[]>([]);
  const selectedGroupId = ref<string | null>(null);

  // Computed properties
  const historyGroups = computed(() => tabGroups.value.filter((g) => g.isHistory));
  const namedGroups = computed(() => tabGroups.value.filter((g) => !g.isHistory));
  const selectedGroup = computed(() => tabGroups.value.find((g) => g.id === selectedGroupId.value) ?? null);

  /**
   * Loads all tab groups from storage
   */
  async function loadGroups(): Promise<void> {
    try {
      tabGroups.value = await getTabGroups();
    } catch (error) {
      handleError(error, 'Failed to load tab groups');
    }
  }

  // Reactively sync store when storage changes in background or other tabs
  try {
    if (typeof tabGroupsStorage?.watch === 'function') {
      tabGroupsStorage.watch((newVal) => {
        if (newVal) {
          tabGroups.value = Object.values(newVal).map((stored) => deserializeTabGroup(stored));
        }
      });
    }
  } catch {
    // Ignore in environments where watch is not supported
  }

  /**
   * Saves a new tab group. If tabs are provided, saves them directly; otherwise captures from current window.
   * @param name Optional name for the group (null for history groups)
   * @param isHistory Whether this is an automatic history group
   * @param customTabs Optional tab list (if omitted, captures from current window)
   */
  async function saveGroup(
    name: string | null = null,
    isHistory = false,
    customTabs?: TabItem[]
  ): Promise<TabGroup> {
    try {
      const tabs = customTabs ?? (await captureCurrentWindow());

      if (!tabs || tabs.length === 0) {
        throw new Error('No tabs to save');
      }

      const newGroup: TabGroup = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date(),
        tabs,
        isHistory,
      };

      await saveTabGroupToStorage(newGroup);

      // Optimistic local state update (prepend to list)
      const existingIdx = tabGroups.value.findIndex((g) => g.id === newGroup.id);
      if (existingIdx >= 0) {
        tabGroups.value[existingIdx] = newGroup;
      } else {
        tabGroups.value = [newGroup, ...tabGroups.value];
      }

      return newGroup;
    } catch (error) {
      if (error instanceof StorageQuotaExceededError) {
        handleError(error, 'Storage quota exceeded. Please delete some tab groups to free up space.');
      } else if (error instanceof TabPermissionDeniedError) {
        handleError(error, 'Permission denied to access some tabs. Restricted tabs were skipped.');
      } else {
        handleError(error, 'Failed to save tab group');
      }
      throw error;
    }
  }

  /**
   * Updates an existing tab group with optimistic local update
   */
  async function updateGroup(id: string, updates: Partial<TabGroup>): Promise<void> {
    try {
      await updateTabGroupInStorage(id, updates);

      // Optimistic update
      const idx = tabGroups.value.findIndex((g) => g.id === id);
      if (idx >= 0) {
        tabGroups.value[idx] = {
          ...tabGroups.value[idx],
          ...updates,
          id, // ID must remain immutable
        };
        tabGroups.value = [...tabGroups.value];
      } else {
        await loadGroups();
      }
    } catch (error) {
      if (error instanceof StorageQuotaExceededError) {
        handleError(error, 'Storage quota exceeded. Cannot update tab group.');
      } else {
        handleError(error, 'Failed to update tab group');
      }
    }
  }

  /**
   * Deletes a tab group with optimistic local update
   */
  async function deleteGroup(id: string): Promise<void> {
    try {
      await deleteTabGroupFromStorage(id);

      // Optimistic update
      tabGroups.value = tabGroups.value.filter((g) => g.id !== id);

      if (selectedGroupId.value === id) {
        selectedGroupId.value = null;
      }
    } catch (error) {
      handleError(error, 'Failed to delete tab group');
    }
  }

  /**
   * Deletes a single tab from a group with optimistic local update
   */
  async function deleteTab(groupId: string, tabId: string): Promise<void> {
    try {
      await deleteTabFromGroupInStorage(groupId, tabId);

      // Optimistic update
      const group = tabGroups.value.find((g) => g.id === groupId);
      if (group) {
        group.tabs = group.tabs.filter((t) => t.id !== tabId);
        tabGroups.value = [...tabGroups.value];
      }
    } catch (error) {
      handleError(error, 'Failed to delete tab');
    }
  }

  /**
   * Converts a history group to a named group
   */
  async function convertToNamed(groupId: string, name: string): Promise<void> {
    try {
      if (!name || name.trim().length === 0) {
        throw new Error('Group name cannot be empty');
      }

      await updateGroup(groupId, {
        name: name.trim(),
        isHistory: false,
      });
    } catch (error) {
      handleError(error, 'Failed to convert tab group');
    }
  }

  return {
    // State
    tabGroups,
    selectedGroupId,
    // Computed
    historyGroups,
    namedGroups,
    selectedGroup,
    // Actions
    loadGroups,
    saveGroup,
    updateGroup,
    deleteGroup,
    deleteTab,
    convertToNamed,
  };
});
