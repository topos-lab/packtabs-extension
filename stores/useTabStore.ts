import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import { t } from '~/composables/useI18n';
import { tabGroupsStorage } from '~/types/Storage';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { sortGroupsByDateDesc } from '~/utils/date';
import {
  addTabToGroup as addTabToGroupInStorage,
  clearDeletedHistorySignature,
  deleteTabFromGroup as deleteTabFromGroupInStorage,
  deleteTabGroup as deleteTabGroupFromStorage,
  deserializeTabGroup,
  getTabGroups,
  getTabsSignature,
  moveTabBetweenGroups as moveTabBetweenGroupsInStorage,
  normalizeTabs,
  removeMatchingSessionTabs,
  saveTabGroup as saveTabGroupToStorage,
  StorageQuotaExceededError,
  updateTabGroup as updateTabGroupInStorage,
} from '~/utils/storage';
import {
  captureCurrentWindow,
  deduplicateTabsByUrl,
  InvalidUrlError,
  TabPermissionDeniedError,
} from '~/utils/tabManager';

/**
 * Optional error handler that can be registered from the UI
 */
let errorHandler: ((error: Error) => void) | null = null;

export function setStoreErrorHandler(handler: (error: Error) => void) {
  errorHandler = handler;
}

/**
 * Maps domain/storage errors to localized user-facing error messages.
 */
export function getLocalizedErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof StorageQuotaExceededError) {
    return t('storageQuotaError');
  }
  if (error instanceof TabPermissionDeniedError) {
    return t('permissionDeniedError');
  }
  if (error instanceof InvalidUrlError) {
    return t('invalidUrlError');
  }
  return error instanceof Error && error.message ? error.message : fallback;
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
 * Pinia store for managing tab groups with reactive state synced to storage
 */
export const useTabStore = defineStore('tabs', () => {
  // State
  const tabGroups = ref<TabGroup[]>([]);
  const selectedGroupId = ref<string | null>(null);
  const isDraggingTab = ref(false);
  const draggingSourceIsHistory = ref(false);

  // Computed properties (sorted newest first)
  const historyGroups = computed(() =>
    sortGroupsByDateDesc(tabGroups.value.filter((g) => g.isHistory))
  );
  const namedGroups = computed(() =>
    sortGroupsByDateDesc(tabGroups.value.filter((g) => !g.isHistory))
  );
  const selectedGroup = computed(() => tabGroups.value.find((g) => g.id === selectedGroupId.value) ?? null);

  /**
   * Loads all tab groups from storage
   */
  async function loadGroups(): Promise<void> {
    try {
      const groups = await getTabGroups();
      tabGroups.value = sortGroupsByDateDesc(groups);
    } catch (error) {
      handleError(error, 'Failed to load tab groups');
    }
  }

  // Reactively sync store when storage changes in background or other tabs
  try {
    if (typeof tabGroupsStorage?.watch === 'function') {
      tabGroupsStorage.watch((newVal) => {
        if (newVal) {
          tabGroups.value = sortGroupsByDateDesc(
            Object.values(newVal ?? {}).map((stored) => deserializeTabGroup(stored))
          );
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
      const rawTabs = customTabs ?? (await captureCurrentWindow());

      if (!rawTabs || rawTabs.length === 0) {
        throw new Error('No tabs to save');
      }

      // Detach any Vue reactive proxy and deduplicate tabs by URL
      const sanitizedTabs = deduplicateTabsByUrl(normalizeTabs(rawTabs));

      const newGroup: TabGroup = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date(),
        tabs: sanitizedTabs,
        isHistory,
      };

      await saveTabGroupToStorage(newGroup);

      // Update local state immediately
      const existingIdx = tabGroups.value.findIndex((g) => g.id === newGroup.id);
      if (existingIdx >= 0) {
        tabGroups.value[existingIdx] = newGroup;
      } else {
        tabGroups.value = [newGroup, ...tabGroups.value];
      }
      tabGroups.value = sortGroupsByDateDesc(tabGroups.value);

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
   * Updates an existing tab group in storage and reflects changes locally on success
   */
  async function updateGroup(id: string, updates: Partial<TabGroup>): Promise<void> {
    try {
      await updateTabGroupInStorage(id, updates);

      const idx = tabGroups.value.findIndex((g) => g.id === id);
      if (idx >= 0) {
        tabGroups.value[idx] = {
          ...tabGroups.value[idx],
          ...updates,
          id, // ID must remain immutable
        };
        tabGroups.value = sortGroupsByDateDesc([...tabGroups.value]);
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
   * Deletes a tab group from storage and cleans up matching pending session tabs
   */
  async function deleteGroup(id: string): Promise<void> {
    try {
      const targetGroup = tabGroups.value.find((g) => g.id === id);
      await deleteTabGroupFromStorage(id);

      tabGroups.value = tabGroups.value.filter((g) => g.id !== id);

      if (selectedGroupId.value === id) {
        selectedGroupId.value = null;
      }

      // Clean up any pending active session tabs matching the deleted history group
      if (targetGroup?.isHistory && targetGroup.tabs) {
        await removeMatchingSessionTabs(getTabsSignature(targetGroup.tabs));
      }
    } catch (error) {
      handleError(error, 'Failed to delete tab group');
    }
  }

  /**
   * Deletes a single tab from a group in storage and updates local state on success
   */
  async function deleteTab(groupId: string, tabId: string): Promise<void> {
    try {
      await deleteTabFromGroupInStorage(groupId, tabId);

      const group = tabGroups.value.find((g) => g.id === groupId);
      if (group) {
        const rawTabs = normalizeTabs(group.tabs);
        group.tabs = rawTabs.filter((t) => t.id !== tabId);
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

  /**
   * Moves a tab from one group to another atomically
   */
  async function moveTab(sourceGroupId: string, targetGroupId: string, tabId: string): Promise<void> {
    if (sourceGroupId === targetGroupId) {return;}

    try {
      await moveTabBetweenGroupsInStorage(sourceGroupId, targetGroupId, tabId);

      const sourceGroup = tabGroups.value.find((g) => g.id === sourceGroupId);
      const targetGroup = tabGroups.value.find((g) => g.id === targetGroupId);

      if (sourceGroup && targetGroup) {
        const tabIndex = sourceGroup.tabs.findIndex((t) => t.id === tabId);
        if (tabIndex >= 0) {
          const [movedTab] = sourceGroup.tabs.splice(tabIndex, 1);
          targetGroup.tabs = deduplicateTabsByUrl([...targetGroup.tabs, movedTab]);
          tabGroups.value = [...tabGroups.value];
        }
      }
    } catch (error) {
      handleError(error, 'Failed to move tab between groups');
    }
  }

  /**
   * Appends a tab to an existing group if its URL is not already present.
   * @returns `true` if added, `false` if skipped as duplicate.
   */
  async function addTab(groupId: string, tab: TabItem): Promise<boolean> {
    try {
      const added = await addTabToGroupInStorage(groupId, tab);
      if (!added) {
        return false;
      }

      const targetGroup = tabGroups.value.find((g) => g.id === groupId);
      if (targetGroup) {
        targetGroup.tabs = deduplicateTabsByUrl([...targetGroup.tabs, tab]);
        tabGroups.value = [...tabGroups.value];
      }
      return true;
    } catch (error) {
      handleError(error, 'Failed to add tab to group');
    }
  }

  /**
   * Restores a previously deleted tab group snapshot with its original metadata and clears
   * any matching history deletion tombstone.
   */
  async function restoreGroup(group: TabGroup): Promise<void> {
    try {
      const snapshot: TabGroup = {
        id: group.id,
        name: group.name,
        createdAt: new Date(group.createdAt),
        tabs: normalizeTabs(group.tabs),
        isHistory: Boolean(group.isHistory),
      };

      if (snapshot.isHistory) {
        await clearDeletedHistorySignature(snapshot.tabs);
      }

      await saveTabGroupToStorage(snapshot);

      const existingIdx = tabGroups.value.findIndex((g) => g.id === snapshot.id);
      if (existingIdx >= 0) {
        tabGroups.value[existingIdx] = snapshot;
      } else {
        tabGroups.value = [snapshot, ...tabGroups.value];
      }
      tabGroups.value = sortGroupsByDateDesc(tabGroups.value);
    } catch (error) {
      if (error instanceof StorageQuotaExceededError) {
        handleError(error, 'Storage quota exceeded. Please delete some tab groups to free up space.');
      } else {
        handleError(error, 'Failed to restore tab group');
      }
      throw error;
    }
  }

  return {
    // State
    tabGroups,
    selectedGroupId,
    isDraggingTab,
    draggingSourceIsHistory,
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
    moveTab,
    addTab,
    restoreGroup,
  };
});
