<script lang="ts" setup>
import {
  Clock,
  ExternalLink,
  Folder,
  Globe,
  GripVertical,
  Layers,
  Moon,
  RotateCcw,
  Save,
  Search,
  Sun,
  SunMoon,
  X,
} from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import CollectionDetail from '~/components/CollectionDetail.vue';
import TabGroupList from '~/components/TabGroupList.vue';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import Modal from '~/components/ui/dialog/Modal.vue';
import { Input } from '~/components/ui/input';
import ToastContainer from '~/components/ui/toast/ToastContainer.vue';
import { Tooltip } from '~/components/ui/tooltip';
import { useTheme } from '~/composables/useTheme';
import { useToast } from '~/composables/useToast';
import { setStoreErrorHandler, useTabStore } from '~/stores/useTabStore';
import { settingsStorage } from '~/types/Storage';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { normalizeTabs, StorageQuotaExceededError } from '~/utils/storage';
import {
  captureCurrentWindow,
  closeCurrentTabs,
  deduplicateTabsByUrl,
  generateDefaultGroupName,
  getFaviconUrl,
  InvalidUrlError,
  openSingleTab,
  TabPermissionDeniedError,
} from '~/utils/tabManager';

const tabStore = useTabStore();
const toast = useToast();
const { theme, isDark, initTheme, setTheme, cycleTheme, themeTooltip } = useTheme();

const searchQuery = ref('');

// Current window tabs staging state
const currentTabs = ref<TabItem[]>([]);
const currentTabsLoading = ref(false);
const newGroupName = ref('');
const closeWindowAfterSave = ref(true);
const isSavingCurrent = ref(false);
const showAboutModal = ref(false);
const currentShortcut = ref('Alt + Shift + P');

async function loadShortcut() {
  try {
    if (typeof browser !== 'undefined' && browser.commands?.getAll) {
      const commands = await browser.commands.getAll();
      const actionCmd = commands.find((c) => c.name === '_execute_action');
      if (actionCmd && actionCmd.shortcut) {
        currentShortcut.value = actionCmd.shortcut.split('+').join(' + ');
      } else if (actionCmd && actionCmd.shortcut === '') {
        currentShortcut.value = 'Not set (Default: Alt + Shift + P)';
      }
    }
  } catch (err) {
    console.error('Failed to query extension commands:', err);
  }
}

function openAboutModal() {
  void loadShortcut();
  showAboutModal.value = true;
}

function openShortcutSettings() {
  try {
    browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  } catch (err) {
    console.error('Failed to open shortcuts settings:', err);
  }
}

function getDomain(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Register store error handler to show user-friendly notifications
setStoreErrorHandler((error: Error) => {
  let message = error.message;

  if (error instanceof StorageQuotaExceededError) {
    message = 'Storage quota reached. Please delete some groups to free space.';
  } else if (error instanceof TabPermissionDeniedError) {
    message = 'Permission denied to access restricted system tabs.';
  } else if (error instanceof InvalidUrlError) {
    message = 'Invalid URL encountered.';
  }

  toast.add({
    severity: 'error',
    summary: 'Error',
    detail: message,
    life: 5000,
  });
});

async function refreshCurrentTabs() {
  currentTabsLoading.value = true;
  try {
    const raw = await captureCurrentWindow();
    currentTabs.value = deduplicateTabsByUrl(raw);
  } catch (error) {
    console.error('Failed to capture current window tabs:', error);
  } finally {
    currentTabsLoading.value = false;
  }
}

function removeCurrentTab(tabId: string) {
  currentTabs.value = currentTabs.value.filter((t) => t.id !== tabId);
}

async function handleTabItemRowClick(event: MouseEvent, tab: TabItem) {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    try {
      await openSingleTab(tab, true);
      toast.add({
        severity: 'info',
        detail: `Opened "${tab.title || 'tab'}" in background`,
        life: 2000,
      });
    } catch (err) {
      toast.add({
        severity: 'error',
        detail: 'Failed to open tab in background',
        life: 3000,
      });
    }
  }
}

// Drag & drop tab categorization state & handlers
const dragOverGroupId = ref<string | null>(null);

function handleDragStartCurrentTab(event: DragEvent, tab: TabItem) {
  if (!event.dataTransfer) return;
  tabStore.isDraggingTab = true;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/packtabs-tab',
    JSON.stringify({
      sourceGroupId: 'current',
      tab,
    })
  );
  // Avoid setting raw URL on text/plain, which triggers Chrome's native Split View / Side-by-side mode
  event.dataTransfer.setData('text/plain', `PackTabs: ${tab.title || tab.url}`);
}

function handleDragEndTab() {
  tabStore.isDraggingTab = false;
  dragOverGroupId.value = null;
}

function handleDragOver(event: DragEvent, groupId: string) {
  if (event.dataTransfer?.types.includes('application/packtabs-tab')) {
    event.dataTransfer.dropEffect = 'move';
    dragOverGroupId.value = groupId;
  }
}

function handleDragEnter(groupId: string) {
  dragOverGroupId.value = groupId;
}

function handleDragLeave(event: DragEvent, groupId: string) {
  const currentTarget = event.currentTarget as HTMLElement | null;
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  if (!currentTarget?.contains(relatedTarget)) {
    if (dragOverGroupId.value === groupId) {
      dragOverGroupId.value = null;
    }
  }
}

async function handleDrop(event: DragEvent, targetGroupId: string) {
  dragOverGroupId.value = null;
  const raw = event.dataTransfer?.getData('application/packtabs-tab');
  if (!raw) {
    tabStore.isDraggingTab = false;
    return;
  }

  try {
    const payload = JSON.parse(raw) as {
      sourceGroupId: string;
      tab: TabItem;
    };
    const { sourceGroupId, tab } = payload;

    if (!tab || !tab.id) return;

    if (sourceGroupId === targetGroupId) {
      toast.add({
        severity: 'info',
        detail: 'Tab is already in this group',
        life: 2000,
      });
      return;
    }

    const targetGroup = tabStore.tabGroups.find((g) => g.id === targetGroupId);
    const targetName = targetGroup?.name || 'Saved Group';

    if (sourceGroupId === 'current') {
      currentTabs.value = currentTabs.value.filter((t) => t.id !== tab.id);
      await tabStore.addTab(targetGroupId, tab);
      toast.add({
        severity: 'success',
        detail: `Added "${tab.title || 'Tab'}" to "${targetName}"`,
        life: 2500,
      });
    } else {
      await tabStore.moveTab(sourceGroupId, targetGroupId, tab.id);
      toast.add({
        severity: 'success',
        detail: `Moved "${tab.title || 'Tab'}" to "${targetName}"`,
        life: 2500,
      });
    }
  } catch (error) {
    console.error('Failed to move tab:', error);
    toast.add({
      severity: 'error',
      detail: 'Failed to move tab',
      life: 3000,
    });
  } finally {
    tabStore.isDraggingTab = false;
    dragOverGroupId.value = null;
  }
}

async function saveCurrentTabs() {
  if (isSavingCurrent.value || currentTabs.value.length === 0) return;
  isSavingCurrent.value = true;

  try {
    const name = newGroupName.value.trim() || generateDefaultGroupName();
    const cleanTabs = deduplicateTabsByUrl(currentTabs.value);
    const group = await tabStore.saveGroup(name, false, cleanTabs);

    const tabsCount = getGroupTabCount(group);

    toast.add({
      severity: 'success',
      summary: 'Saved successfully',
      detail: `Preserved ${tabsCount} tabs into "${group.name || 'Saved Group'}".`,
      life: 3500,
    });

    if (closeWindowAfterSave.value) {
      try {
        const currentWindow = await browser.windows.getCurrent();
        if (currentWindow.id !== undefined) {
          await browser.windows.remove(currentWindow.id);
          return;
        }
      } catch (err) {
        console.error('Failed to close window after save:', err);
      }
    }

    newGroupName.value = '';
    // Switch to the newly saved group in Saved Groups
    tabStore.selectedGroupId = group.id;
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: error instanceof Error ? error.message : 'Could not save tabs',
      life: 4000,
    });
  } finally {
    isSavingCurrent.value = false;
  }
}

function getGroupTabCount(group: TabGroup): number {
  return deduplicateTabsByUrl(normalizeTabs(group.tabs)).length;
}

onMounted(async () => {
  window.addEventListener('dragend', handleDragEndTab);
  window.addEventListener('drop', handleDragEndTab);

  void initTheme();

  // Load user preference for closeWindowAfterSave
  try {
    const settings = await settingsStorage.getValue();
    closeWindowAfterSave.value = settings.autoCloseAfterSave ?? true;
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Watch and persist changes to sync:settings
  watch(closeWindowAfterSave, async (newVal) => {
    try {
      const current = await settingsStorage.getValue();
      await settingsStorage.setValue({
        ...current,
        autoCloseAfterSave: newVal,
      });
    } catch (err) {
      console.error('Failed to persist settings:', err);
    }
  });

  await tabStore.loadGroups();
  await refreshCurrentTabs();
  void loadShortcut();
  window.addEventListener('focus', loadShortcut);
  tabStore.selectedGroupId = 'current';
});

onUnmounted(() => {
  window.removeEventListener('focus', loadShortcut);
  window.removeEventListener('dragend', handleDragEndTab);
  window.removeEventListener('drop', handleDragEndTab);
});

// Filtered current tabs when searching in "Current Tabs" view
const displayedCurrentTabs = computed(() => {
  if (!searchQuery.value.trim()) {
    return currentTabs.value;
  }
  const q = searchQuery.value.toLowerCase().trim();
  return currentTabs.value.filter(
    (tab) => tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)
  );
});

// Filtered groups based on sidebar selection and search query
const displayedGroups = computed(() => {
  let list = tabStore.tabGroups;

  if (tabStore.selectedGroupId === 'history') {
    list = tabStore.historyGroups;
  } else if (tabStore.selectedGroupId && tabStore.selectedGroupId !== 'current') {
    const specific = tabStore.tabGroups.find((g) => g.id === tabStore.selectedGroupId);
    list = specific ? [specific] : [];
  } else if (tabStore.selectedGroupId === 'current') {
    list = [];
  }

  if (!searchQuery.value.trim()) {
    return list;
  }

  const q = searchQuery.value.toLowerCase().trim();
  return list.filter((group) => {
    const matchName = (group.name ?? 'History Tab Group').toLowerCase().includes(q);
    const tabsList = normalizeTabs(group.tabs);
    const matchTabs = tabsList.some(
      (tab) => tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)
    );
    return matchName || matchTabs;
  });
});

function handleSave(groupId: string) {
  console.log('Saved group:', groupId);
}
</script>

<template>
  <div class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden text-zinc-900 dark:text-zinc-100">
    <!-- Sidebar -->
    <aside
      class="h-full w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0"
    >
      <!-- Sidebar Header / Logo & Theme Toggle -->
      <div class="h-16 flex items-center justify-between px-3 border-b border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          class="flex items-center gap-2.5 pl-1.5 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left overflow-hidden group/brand focus:outline-none cursor-pointer"
          title="About PackTabs"
          @click="openAboutModal"
        >
          <div class="h-8 w-8 rounded-lg bg-indigo-600 group-hover/brand:bg-indigo-700 flex items-center justify-center text-white shadow-xs shrink-0 transition-colors">
            <Layers class="h-4 w-4" />
          </div>
          <div class="flex flex-col">
            <span class="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 group-hover/brand:text-indigo-600 dark:group-hover/brand:text-indigo-400 leading-tight transition-colors">PackTabs</span>
            <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-tight">Tab Manager</span>
          </div>
        </button>

        <!-- Theme Toggle Button (Tri-state: Auto (System) -> Light -> Dark -> Auto) -->
        <button
          type="button"
          class="h-7 w-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 mr-1 cursor-pointer"
          :title="themeTooltip"
          @click="cycleTheme"
        >
          <Sun v-if="theme === 'light'" class="h-4 w-4 text-amber-500" />
          <Moon v-else-if="theme === 'dark'" class="h-4 w-4 text-zinc-100" />
          <SunMoon v-else class="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      <!-- Navigation Links -->
      <div class="flex-1 overflow-y-auto p-3 space-y-6">
        <!-- Quick Views -->
        <div class="space-y-1">
          <!-- 1. Current Tabs -->
          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            :class="tabStore.selectedGroupId === 'current' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-200'"
            @click="tabStore.selectedGroupId = 'current'"
          >
            <Layers class="h-4 w-4 shrink-0" />
            <span class="flex-1 text-left truncate">Current Tabs</span>
            <span class="text-[10px] bg-zinc-200/60 dark:bg-zinc-700/60 px-1.5 py-0.5 rounded-full text-zinc-600 dark:text-zinc-300 font-normal">
              {{ currentTabs.length }}
            </span>
          </button>

          <!-- 2. History Snapshots -->
          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            :class="tabStore.selectedGroupId === 'history' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-200'"
            @click="tabStore.selectedGroupId = 'history'"
          >
            <Clock class="h-4 w-4 shrink-0" />
            <span class="flex-1 text-left truncate">History Snapshots</span>
            <span class="text-[10px] bg-zinc-200/60 dark:bg-zinc-700/60 px-1.5 py-0.5 rounded-full text-zinc-600 dark:text-zinc-300 font-normal">
              {{ tabStore.historyGroups.length }}
            </span>
          </button>
        </div>

        <!-- Saved Groups List -->
        <div class="space-y-1">
          <div
            class="px-2.5 text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between transition-colors"
            :class="tabStore.isDraggingTab ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-400 dark:text-zinc-500'"
          >
            <div class="flex items-center gap-1.5">
              <span>Saved Groups</span>
              <span
                v-if="tabStore.isDraggingTab"
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-zinc-700"
              >
                Drop Targets
              </span>
            </div>
            <span class="text-[10px]" :class="tabStore.isDraggingTab ? 'text-indigo-600 dark:text-indigo-400 font-semibold' : 'text-zinc-400 dark:text-zinc-500 font-normal'">
              {{ tabStore.namedGroups.length }}
            </span>
          </div>

          <div v-if="tabStore.namedGroups.length > 0" class="space-y-1 max-h-60 overflow-y-auto">
            <button
              v-for="group in tabStore.namedGroups"
              :key="group.id"
              type="button"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all relative select-none border cursor-pointer"
              :class="[
                dragOverGroupId === group.id
                  ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/90 dark:bg-zinc-800 text-indigo-950 dark:text-zinc-100 font-semibold ring-2 ring-indigo-500/20 shadow-2xs'
                  : tabStore.isDraggingTab
                    ? 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-zinc-600 hover:bg-indigo-50/40'
                    : tabStore.selectedGroupId === group.id
                      ? 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-200'
              ]"
              @click="tabStore.selectedGroupId = group.id"
              @dragover.prevent="handleDragOver($event, group.id)"
              @dragenter.prevent="handleDragEnter(group.id)"
              @dragleave="handleDragLeave($event, group.id)"
              @drop.prevent="handleDrop($event, group.id)"
            >
              <div class="flex items-center gap-2 truncate min-w-0 flex-1 mr-2">
                <Folder
                  class="h-3.5 w-3.5 shrink-0 transition-transform"
                  :class="[
                    dragOverGroupId === group.id
                      ? 'text-indigo-600 dark:text-indigo-400 scale-105'
                      : tabStore.isDraggingTab
                        ? 'text-indigo-500 dark:text-indigo-400'
                        : 'text-zinc-400 dark:text-zinc-500'
                  ]"
                />
                <span class="truncate">{{ group.name || 'Saved Group' }}</span>
              </div>
              <span
                class="text-[10px] ml-1 shrink-0 transition-colors font-medium"
                :class="[
                  dragOverGroupId === group.id
                    ? 'text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100/90 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full'
                    : tabStore.isDraggingTab
                      ? 'text-zinc-500 dark:text-zinc-400 font-medium'
                      : 'text-zinc-400 dark:text-zinc-500'
                ]"
              >
                {{ getGroupTabCount(group) }}
              </span>
            </button>
          </div>
          <div v-else-if="tabStore.isDraggingTab" class="px-2.5 py-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 text-center">
            <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">No saved groups yet</p>
            <p class="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Save current tabs as a group first</p>
          </div>
          <div v-else class="px-2.5 py-2 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
            No saved groups yet
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-zinc-50/60 dark:bg-zinc-950">
      <!-- Content Area -->
      <section class="flex-1 overflow-y-auto p-6">
        <div class="w-full max-w-6xl mx-auto">
          <!-- Current Tabs View -->
          <div v-if="tabStore.selectedGroupId === 'current'" class="space-y-4">
            <Card class="overflow-hidden border border-zinc-200/90 dark:border-zinc-800/90 shadow-xs bg-white dark:bg-zinc-900">
              <CardHeader class="p-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2.5">
                    <div class="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Layers class="h-4 w-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                        Current Window Tabs
                      </h2>
                      <p class="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-tight">
                        Review, exclude, or name before saving
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 px-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                      :disabled="currentTabsLoading"
                      @click="refreshCurrentTabs"
                    >
                      <RotateCcw class="h-3.5 w-3.5 mr-1" :class="{ 'animate-spin': currentTabsLoading }" />
                      Refresh
                    </Button>
                    <Badge variant="secondary" class="font-medium text-xs">
                      {{ displayedCurrentTabs.length }} tabs
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <!-- Actions Toolbar / Group Name Input -->
              <div class="p-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="flex-1 max-w-sm">
                  <Input
                    v-model="newGroupName"
                    placeholder="Group name (optional, or auto-named with time)..."
                    class="h-8 text-xs bg-zinc-50/60 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500"
                    @keydown.enter="saveCurrentTabs"
                  />
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <label class="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      v-model="closeWindowAfterSave"
                      class="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span>Close window after save</span>
                  </label>

                  <Button
                    size="sm"
                    variant="default"
                    class="h-8 gap-1.5 text-xs font-medium shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    :disabled="isSavingCurrent || currentTabs.length === 0"
                    @click="saveCurrentTabs"
                  >
                    <Save class="h-3.5 w-3.5" />
                    <span>{{ isSavingCurrent ? 'Saving...' : 'Save as Tab Group' }}</span>
                  </Button>
                </div>
              </div>

              <!-- Tabs List -->
              <CardContent class="p-3">
                <div v-if="displayedCurrentTabs.length === 0" class="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                  <p v-if="currentTabs.length === 0">No open web tabs in the current window.</p>
                  <p v-else>No tabs match your search query.</p>
                </div>

                <div v-else class="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[500px] overflow-y-auto pr-1">
                  <Tooltip
                    v-for="tab in displayedCurrentTabs"
                    :key="tab.id"
                    :content="['Drag tab to categorize into group', 'Ctrl / Cmd / Shift + Click to open in background']"
                    side="top"
                    :delay-duration="400"
                  >
                    <div
                      draggable="true"
                      class="group/tab flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors select-none cursor-pointer"
                      @dragstart="handleDragStartCurrentTab($event, tab)"
                      @dragend="handleDragEndTab"
                      @click="handleTabItemRowClick($event, tab)"
                    >
                      <!-- Favicon + Title + Domain (pointer-events-none for seamless drag) -->
                      <div class="flex items-center gap-2 min-w-0 flex-1 mr-3 pointer-events-none">
                        <!-- Drag Handle with hover hint -->
                        <div
                          class="p-1 -ml-1 rounded text-zinc-300 dark:text-zinc-600 group-hover/tab:text-zinc-500 dark:group-hover/tab:text-zinc-400 transition-colors shrink-0 cursor-move active:cursor-move pointer-events-auto"
                        >
                          <GripVertical class="h-3.5 w-3.5" />
                        </div>

                        <div class="h-4 w-4 shrink-0 flex items-center justify-center">
                          <img
                            v-if="tab.faviconUrl || getFaviconUrl(tab.url)"
                            :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                            class="h-4 w-4 rounded-xs object-contain"
                            alt=""
                            loading="lazy"
                          />
                          <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        </div>

                        <span class="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors">
                          {{ tab.title || 'Untitled' }}
                        </span>

                        <span
                          v-if="getDomain(tab.url)"
                          class="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal shrink-0 ml-auto pr-2 hidden sm:inline"
                        >
                          {{ getDomain(tab.url) }}
                        </span>
                      </div>

                      <!-- Right Actions: Only Exclude button -->
                      <div class="flex items-center shrink-0 pointer-events-auto">
                        <button
                          type="button"
                          class="p-1 text-zinc-300 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded transition-colors shrink-0 cursor-pointer"
                          title="Exclude from group"
                          aria-label="Exclude tab"
                          @click.stop="removeCurrentTab(tab.id)"
                        >
                          <X class="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </Tooltip>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Collection Detail View (when selecting a saved group) -->
          <div v-else-if="tabStore.selectedGroup && !tabStore.selectedGroup.isHistory">
            <CollectionDetail
              :group="tabStore.selectedGroup"
              :search-query="searchQuery"
              @deleted="tabStore.selectedGroupId = 'current'"
            />
          </div>

          <!-- History Snapshots Feed / Fallback Groups List -->
          <div v-else class="space-y-4">
            <div class="flex items-center justify-between gap-4 pb-2 border-b border-zinc-200/60 dark:border-zinc-800">
              <div>
                <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">History Snapshots</h2>
                <p class="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal">Automatic session snapshots captured from closed windows</p>
              </div>
              <div class="relative w-64">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                <Input
                  v-model="searchQuery"
                  placeholder="Search history tabs..."
                  class="h-8 pl-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900"
                />
              </div>
            </div>
            <TabGroupList :groups="displayedGroups" @save="handleSave" />
          </div>
        </div>
      </section>
    </main>

    <!-- Floating Toast Notifications -->
    <ToastContainer />

    <!-- About PackTabs Modal -->
    <Modal
      v-model:open="showAboutModal"
      title="About PackTabs"
      description="Minimalist tab session manager for modern browsers."
    >
      <div class="space-y-4 py-1">
        <div class="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <div class="h-10 w-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Layers class="h-5 w-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">PackTabs</h4>
            <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">High-performance Chrome Tab Group & Session Manager</p>
          </div>
        </div>

        <div class="text-xs text-zinc-600 dark:text-zinc-300 space-y-2">
          <!-- Theme Segmented Control -->
          <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <span class="text-zinc-400 dark:text-zinc-500">Theme</span>
              <p class="text-[10px] text-zinc-400 dark:text-zinc-500">Appearance preference</p>
            </div>
            <div class="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
              <button
                type="button"
                class="flex items-center gap-1 px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
                :class="theme === 'light' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
                @click="setTheme('light')"
              >
                <Sun class="h-3 w-3 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1 px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
                :class="theme === 'dark' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
                @click="setTheme('dark')"
              >
                <Moon class="h-3 w-3 text-zinc-100" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                class="flex items-center gap-1 px-2 py-1 rounded-md transition-all font-medium cursor-pointer"
                :class="theme === 'system' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-2xs' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'"
                @click="setTheme('system')"
              >
                <SunMoon class="h-3 w-3 text-zinc-500 dark:text-zinc-400" />
                <span>Auto (System)</span>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
            <span class="text-zinc-400 dark:text-zinc-500">Version</span>
            <span class="font-medium text-zinc-700 dark:text-zinc-200">1.0.0</span>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
            <span class="text-zinc-400 dark:text-zinc-500">Author</span>
            <span class="font-medium text-zinc-700 dark:text-zinc-200">Wesley Chen</span>
          </div>
          <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
            <span class="text-zinc-400 dark:text-zinc-500">GitHub</span>
            <a
              href="https://github.com/wesley-chen/packtabs-extension"
              target="_blank"
              rel="noopener noreferrer"
              class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 font-medium"
            >
              <span>packtabs-extension</span>
              <ExternalLink class="h-3 w-3" />
            </a>
          </div>
          <div class="flex items-center justify-between py-1.5">
            <div>
              <span class="text-zinc-400 dark:text-zinc-500">Shortcut</span>
              <p class="text-[10px] text-zinc-400 dark:text-zinc-500">Configurable in Chrome</p>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-200/60 dark:border-zinc-700/60">
                {{ currentShortcut }}
              </span>
              <button
                type="button"
                class="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline font-medium cursor-pointer"
                title="Open Chrome Shortcut Settings"
                @click="openShortcutSettings"
              >
                Change
              </button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button size="sm" variant="outline" @click="showAboutModal = false">Close</Button>
      </template>
    </Modal>
  </div>
</template>
