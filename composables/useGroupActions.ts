import { t } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';
import { getLocalizedErrorMessage, useTabStore } from '~/stores/useTabStore';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import {
  generateDefaultGroupName,
  openTabs,
  openTabsInNewWindow,
  snapshotTabGroup,
  type TabDragPayload,
} from '~/utils/tabManager';

export interface OpenGroupInNewWindowOptions {
  toastLife?: number;
}

export interface OpenGroupTabsOptions {
  event?: MouseEvent;
  onAfterOpen?: () => Promise<void> | void;
  successDetailKey?: 'restoredTabsSuccess' | 'restoredTabsSuccessShort';
  silentSuccess?: boolean;
  toastLife?: number;
}

export interface DeleteGroupOptions {
  onDeleted?: () => void;
  onRestored?: (snapshot: TabGroup) => void;
  errorLife?: number;
}

export interface DeleteTabOptions {
  detailKey?: 'tabRemovedSuccess' | 'tabRemovedFromGroupSuccess';
  errorLife?: number;
}

export interface ConvertHistoryOptions {
  allowDefaultFallback?: boolean;
  onConverted?: (groupId: string) => void;
}

export interface DropTabOptions {
  notifyAlreadyInSameGroup?: boolean;
  onCurrentTabMoved?: (tabId: string) => void;
}

/**
 * Shared composable consolidating group/tab restoration, 5-second Undo deletions,
 * inline history conversion, and drag-and-drop categorization across views.
 */
export function useGroupActions() {
  const tabStore = useTabStore();
  const toast = useToast();

  function notifyUndoSuccess() {
    toast.add({
      severity: 'info',
      detail: t('restoredUndoSuccess'),
      life: 2000,
    });
  }

  /**
   * Opens all tabs in a newly created focused window and reports status via toast.
   */
  async function openGroupInNewWindow(tabs: TabItem[], options: OpenGroupInNewWindowOptions = {}): Promise<boolean> {
    if (tabs.length === 0) {
      return false;
    }
    const life = options.toastLife ?? 3000;
    try {
      await openTabsInNewWindow(tabs);
      toast.add({
        severity: 'success',
        detail: t('openedInNewWindowSuccess', { count: tabs.length }),
        life,
      });
      return true;
    } catch (error) {
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('restoreTabsFailed')),
        life: 3000,
      });
      return false;
    }
  }

  /**
   * Opens all tabs in the current window (or a new window when Shift-clicked),
   * optionally running a post-open callback such as closing the startup restorer tab.
   */
  async function openGroupTabs(tabs: TabItem[], options: OpenGroupTabsOptions = {}): Promise<boolean> {
    if (options.event?.shiftKey) {
      return openGroupInNewWindow(tabs, { toastLife: options.toastLife });
    }
    if (tabs.length === 0) {
      return false;
    }
    const life = options.toastLife ?? 3000;
    try {
      await openTabs(tabs);
      if (options.onAfterOpen) {
        await options.onAfterOpen();
      }
      if (!options.silentSuccess) {
        toast.add({
          severity: 'success',
          detail: t(options.successDetailKey ?? 'restoredTabsSuccessShort', { count: tabs.length }),
          life,
        });
      }
      return true;
    } catch (error) {
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('restoreTabsFailed')),
        life: 3000,
      });
      return false;
    }
  }

  /**
   * Deletes a tab group immediately without a confirmation dialog and offers a 5s Undo toast.
   */
  async function deleteGroupWithUndo(group: TabGroup, options: DeleteGroupOptions = {}): Promise<boolean> {
    const snapshot = snapshotTabGroup(group);
    try {
      await tabStore.deleteGroup(snapshot.id);
      options.onDeleted?.();
      toast.add({
        severity: 'success',
        detail: t('tabGroupDeleted'),
        life: 5000,
        action: {
          label: t('undo'),
          onClick: async () => {
            await tabStore.restoreGroup(snapshot);
            options.onRestored?.(snapshot);
            notifyUndoSuccess();
          },
        },
      });
      return true;
    } catch (error) {
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('deleteGroupFailed')),
        life: options.errorLife ?? 3000,
      });
      return false;
    }
  }

  /**
   * Deletes an individual tab immediately with a 5s Undo toast.
   * When deleting the final tab of a History snapshot, removes the empty group as a whole.
   */
  async function deleteTabWithUndo(
    group: TabGroup,
    allTabs: TabItem[],
    tabId: string,
    options: DeleteTabOptions = {}
  ): Promise<boolean> {
    const groupSnapshot = snapshotTabGroup(group);
    const target = groupSnapshot.tabs.find((item) => item.id === tabId);
    const deletedTab = target ? { ...target } : null;
    const removesEmptyHistory = Boolean(group.isHistory) && allTabs.length <= 1;
    const detailText = t(options.detailKey ?? 'tabRemovedSuccess');

    try {
      if (removesEmptyHistory) {
        await tabStore.deleteGroup(groupSnapshot.id);
        toast.add({
          severity: 'success',
          detail: detailText,
          life: 5000,
          action: {
            label: t('undo'),
            onClick: async () => {
              await tabStore.restoreGroup(groupSnapshot);
              notifyUndoSuccess();
            },
          },
        });
        return true;
      }

      await tabStore.deleteTab(groupSnapshot.id, tabId);
      toast.add({
        severity: 'success',
        detail: detailText,
        life: 5000,
        action: deletedTab
          ? {
              label: t('undo'),
              onClick: async () => {
                await tabStore.addTab(groupSnapshot.id, deletedTab);
                notifyUndoSuccess();
              },
            }
          : undefined,
      });
      return true;
    } catch (error) {
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('removeTabFailed')),
        life: options.errorLife ?? 3000,
      });
      return false;
    }
  }

  /**
   * Converts a History snapshot into a permanent named group inline and offers a 5s Undo toast.
   */
  async function convertHistoryToNamedWithUndo(
    group: TabGroup,
    rawName: string,
    options: ConvertHistoryOptions = {}
  ): Promise<boolean> {
    const trimmed = rawName.trim();
    if (!trimmed && !options.allowDefaultFallback) {
      return false;
    }

    const finalName = trimmed || generateDefaultGroupName(new Date(), t('defaultGroupNamePrefix'));
    const originalName = group.name;
    const groupId = group.id;

    try {
      await tabStore.convertToNamed(groupId, finalName);
      options.onConverted?.(groupId);
      toast.add({
        severity: 'success',
        summary: t('savedTitle'),
        detail: t('savedAsNamedGroupDetail', { name: finalName }),
        life: 5000,
        action: {
          label: t('undo'),
          onClick: async () => {
            await tabStore.updateGroup(groupId, { name: originalName, isHistory: true });
            notifyUndoSuccess();
          },
        },
      });
      return true;
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('errorTitle'),
        detail: getLocalizedErrorMessage(error, t('saveGroupFailed')),
        life: 3000,
      });
      return false;
    }
  }

  /**
   * Handles dropping a dragged tab onto a saved group:
   * - Current Tabs or History sources copy/archive via addTab (keeping History intact)
   * - Saved group sources move via moveTab
   */
  async function dropTabIntoSavedGroup(
    payload: TabDragPayload,
    targetGroupId: string,
    options: DropTabOptions = {}
  ): Promise<boolean> {
    if (payload.sourceGroupId === targetGroupId) {
      if (options.notifyAlreadyInSameGroup) {
        toast.add({
          severity: 'info',
          detail: t('tabAlreadyInGroup'),
          life: 2000,
        });
      }
      return false;
    }

    const targetGroup = tabStore.tabGroups.find((g) => g.id === targetGroupId);
    const targetName = targetGroup?.name || t('savedGroupFallback');

    try {
      if (payload.sourceGroupId === 'current' || payload.sourceIsHistory) {
        const added = await tabStore.addTab(targetGroupId, payload.tab);
        if (!added) {
          toast.add({
            severity: 'info',
            detail: t('tabAlreadyInGroup'),
            life: 2000,
          });
          return false;
        }
        if (payload.sourceGroupId === 'current') {
          options.onCurrentTabMoved?.(payload.tab.id);
        }
        toast.add({
          severity: 'success',
          detail: t('addedTabToGroupSuccess', { tab: payload.tab.title || t('untitled'), group: targetName }),
          life: 2500,
        });
        return true;
      }

      await tabStore.moveTab(payload.sourceGroupId, targetGroupId, payload.tab.id);
      toast.add({
        severity: 'success',
        detail: t('movedTabToGroupSuccess', { tab: payload.tab.title || t('untitled'), group: targetName }),
        life: 2500,
      });
      return true;
    } catch (error) {
      console.error('Failed to organize dragged tab:', error);
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('moveTabFailed')),
        life: 3000,
      });
      return false;
    }
  }

  return {
    openGroupInNewWindow,
    openGroupTabs,
    deleteGroupWithUndo,
    deleteTabWithUndo,
    convertHistoryToNamedWithUndo,
    dropTabIntoSavedGroup,
  };
}
