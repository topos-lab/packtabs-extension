<script lang="ts" setup>
  import {
    Clock,
    ExternalLink,
    Folder,
    Layers,
    Moon,
    RotateCcw,
    Save,
    Search,
    Settings,
    Sun,
    SunMoon,
  } from 'lucide-vue-next';
  import { TooltipProvider } from 'radix-vue';
  import { computed, onMounted, onUnmounted, provide, ref, watch, watchEffect } from 'vue';

  import CollectionDetail from '~/components/CollectionDetail.vue';
  import SettingsModal from '~/components/SettingsModal.vue';
  import StartupRestorer from '~/components/StartupRestorer.vue';
  import TabGroupList from '~/components/TabGroupList.vue';
  import TabItemRow from '~/components/TabItemRow.vue';
  import { Badge } from '~/components/ui/badge';
  import { Button } from '~/components/ui/button';
  import { Card, CardContent, CardHeader } from '~/components/ui/card';
  import Modal from '~/components/ui/dialog/Modal.vue';
  import { Input } from '~/components/ui/input';
  import ToastContainer from '~/components/ui/toast/ToastContainer.vue';
  import { TOOLTIP_PROVIDER_KEY } from '~/components/ui/tooltip/context';
  import { formatTabsCount, useI18n } from '~/composables/useI18n';
  import { useSettings } from '~/composables/useSettings';
  import { useTheme } from '~/composables/useTheme';
  import { useToast } from '~/composables/useToast';
  import { getLocalizedErrorMessage, useTabStore } from '~/stores/useTabStore';
  import type { TabItem } from '~/types/TabGroup';
  import { formatFullDateTime } from '~/utils/date';
  import { isImeComposing } from '~/utils/keyboard';
  import { clearWindowSessionTabs, normalizeTabUrl } from '~/utils/storage';
  import {
    captureCurrentWindow,
    deduplicateTabsByUrl,
    generateDefaultGroupName,
    getCurrentWindowId,
  } from '~/utils/tabManager';

  provide(TOOLTIP_PROVIDER_KEY, true);

  function detectStartupMode(): boolean {
    try {
      return new URLSearchParams(window.location.search).get('mode') === 'startup';
    } catch {
      return false;
    }
  }

  const tabStore = useTabStore();
  const toast = useToast();
  const { theme, initTheme, cycleTheme, themeTooltip } = useTheme();
  const { t, initLocale } = useI18n();
  const {
    closeWindowAfterSave: closeWindowAfterSaveRef,
    initSettings,
    setCloseWindowAfterSave,
  } = useSettings();

  const closeWindowAfterSave = computed({
    get: () => closeWindowAfterSaveRef.value,
    set: (val: boolean) => {
      void setCloseWindowAfterSave(val);
    },
  });

  const searchQuery = ref('');

  // Current window tabs staging state
  const currentTabs = ref<TabItem[]>([]);
  const excludedTabUrls = ref<Set<string>>(new Set());
  const currentTabsLoading = ref(false);
  const newGroupName = ref('');
  const isSavingCurrent = ref(false);
  const showAboutModal = ref(false);
  const showSettingsModal = ref(false);
  const isStartupMode = ref(detectStartupMode());
  const appVersion = browser.runtime.getManifest()?.version || '1.3.0';

  watchEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = `PackTabs — ${isStartupMode.value ? t('startupRestorer') : t('tabManager')}`;
    }
  });

  // Clear history search filter when switching views so stale filters do not linger
  watch(
    () => tabStore.selectedGroupId,
    () => {
      searchQuery.value = '';
    }
  );

  async function refreshCurrentTabs(preserveExcluded = false) {
    currentTabsLoading.value = true;
    if (!preserveExcluded) {
      excludedTabUrls.value.clear();
    }
    try {
      const raw = await captureCurrentWindow();
      const deduped = deduplicateTabsByUrl(raw);
      currentTabs.value = preserveExcluded
        ? deduped.filter((tab) => !excludedTabUrls.value.has(normalizeTabUrl(tab.url)))
        : deduped;
    } catch (error) {
      console.error('Failed to capture current window tabs:', error);
    } finally {
      currentTabsLoading.value = false;
    }
  }

  function handleWindowActivated() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (tabStore.selectedGroupId === 'current' && !isSavingCurrent.value) {
      void refreshCurrentTabs(true);
    }
  }

  function removeCurrentTab(tabId: string) {
    const target = currentTabs.value.find((tab) => tab.id === tabId);
    if (target?.url) {
      excludedTabUrls.value.add(normalizeTabUrl(target.url));
    }
    currentTabs.value = currentTabs.value.filter((tab) => tab.id !== tabId);
  }

  // Drag & drop tab categorization state & handlers
  const dragOverGroupId = ref<string | null>(null);

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

      if (!tab?.id) {return;}

      if (sourceGroupId === targetGroupId) {
        toast.add({
          severity: 'info',
          detail: t('tabAlreadyInGroup'),
          life: 2000,
        });
        return;
      }

      const targetGroup = tabStore.tabGroups.find((g) => g.id === targetGroupId);
      const targetName = targetGroup?.name || t('savedGroupFallback');

      if (sourceGroupId === 'current') {
        const added = await tabStore.addTab(targetGroupId, tab);
        if (!added) {
          toast.add({
            severity: 'info',
            detail: t('tabAlreadyInGroup'),
            life: 2000,
          });
          return;
        }
        removeCurrentTab(tab.id);
        toast.add({
          severity: 'success',
          detail: t('addedTabToGroupSuccess', { tab: tab.title || t('untitled'), group: targetName }),
          life: 2500,
        });
      } else {
        await tabStore.moveTab(sourceGroupId, targetGroupId, tab.id);
        toast.add({
          severity: 'success',
          detail: t('movedTabToGroupSuccess', { tab: tab.title || t('untitled'), group: targetName }),
          life: 2500,
        });
      }
    } catch (error) {
      console.error('Failed to move tab:', error);
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('moveTabFailed')),
        life: 3000,
      });
    } finally {
      tabStore.isDraggingTab = false;
      dragOverGroupId.value = null;
    }
  }

  async function saveCurrentTabs() {
    if (isSavingCurrent.value || currentTabs.value.length === 0) {return;}
    isSavingCurrent.value = true;

    try {
      const name = newGroupName.value.trim() || generateDefaultGroupName(new Date(), t('defaultGroupNamePrefix'));
      const cleanTabs = deduplicateTabsByUrl(currentTabs.value);
      const group = await tabStore.saveGroup(name, false, cleanTabs);

      toast.add({
        severity: 'success',
        summary: t('savedSuccessSummary'),
        detail: t('savedSuccessDetail', { count: group.tabs.length, name: group.name || t('savedGroupFallback') }),
        life: 3500,
      });

      if (closeWindowAfterSave.value) {
        try {
          const currentWindowId = await getCurrentWindowId();
          if (currentWindowId !== undefined) {
            // Clear pending session cache first so windows.onRemoved does not create a duplicate history snapshot
            await clearWindowSessionTabs(currentWindowId);
            await browser.windows.remove(currentWindowId);
            return;
          }
        } catch (err) {
          console.error('Failed to close window after save:', err);
        }
      }

      newGroupName.value = '';
      excludedTabUrls.value.clear();
      // Switch to the newly saved group in Saved Groups
      tabStore.selectedGroupId = group.id;
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('saveFailedSummary'),
        detail: getLocalizedErrorMessage(error, t('couldNotSaveTabs')),
        life: 4000,
      });
    } finally {
      isSavingCurrent.value = false;
    }
  }

  function handleGroupNameKeydown(event: KeyboardEvent) {
    if (isImeComposing(event) || event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    void saveCurrentTabs();
  }

  onMounted(async () => {
    void initTheme();
    void initLocale();
    void initSettings();

    try {
      await tabStore.loadGroups();
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('errorTitle'),
        detail: getLocalizedErrorMessage(error, t('loadGroupsFailed')),
        life: 5000,
      });
    }

    if (isStartupMode.value) {
      return;
    }

    window.addEventListener('dragend', handleDragEndTab);
    window.addEventListener('drop', handleDragEndTab);
    window.addEventListener('focus', handleWindowActivated);
    document.addEventListener('visibilitychange', handleWindowActivated);

    await refreshCurrentTabs();
    tabStore.selectedGroupId = 'current';
  });

  onUnmounted(() => {
    window.removeEventListener('focus', handleWindowActivated);
    document.removeEventListener('visibilitychange', handleWindowActivated);
    window.removeEventListener('dragend', handleDragEndTab);
    window.removeEventListener('drop', handleDragEndTab);
  });

  // Filtered history groups based on search query
  const displayedGroups = computed(() => {
    const historyList = tabStore.historyGroups;
    const q = searchQuery.value.toLowerCase().trim();
    if (!q) {
      return historyList;
    }

    return historyList.filter((group) => {
      const title = (group.name || formatFullDateTime(group.createdAt)).toLowerCase();
      const matchName = title.includes(q);
      const matchTabs = group.tabs.some(
        (tab) => tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)
      );
      return matchName || matchTabs;
    });
  });
</script>

<template>
  <TooltipProvider :delay-duration="400" disable-hoverable-content>
    <StartupRestorer v-if="isStartupMode" />
    <div v-else class="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden text-zinc-900 dark:text-zinc-100">
      <h1 class="sr-only">
        PackTabs {{ t('tabManager') }}
      </h1>
      <!-- Sidebar -->
      <aside
        class="h-full w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0">
        <!-- Sidebar Header / Logo & Theme Toggle -->
        <div class="h-16 flex items-center justify-between px-3 border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            class="flex items-center gap-2.5 pl-1.5 py-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-left overflow-hidden group/brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
            :title="t('aboutPackTabs')"
            @click="showAboutModal = true">
            <img src="/icon/48.png" alt="PackTabs Logo" class="h-8 w-8 rounded-lg shrink-0 shadow-xs object-contain">
            <div class="flex flex-col">
              <span
                class="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 group-hover/brand:text-indigo-600 dark:group-hover/brand:text-indigo-400 leading-tight transition-colors"
              >PackTabs</span
              >
              <span class="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-tight">{{
                t('tabManager')
              }}</span>
            </div>
          </button>

          <div class="flex items-center gap-1 shrink-0 mr-1">
            <!-- Settings Button -->
            <button
              type="button"
              class="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :title="t('settings')"
              :aria-label="t('settings')"
              @click="showSettingsModal = true">
              <Settings class="h-4 w-4" />
            </button>

            <!-- Theme Toggle Button (Tri-state: Auto (System) -> Light -> Dark -> Auto) -->
            <button
              type="button"
              class="h-7 w-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :title="themeTooltip"
              :aria-label="themeTooltip"
              @click="cycleTheme">
              <Sun v-if="theme === 'light'" class="h-4 w-4 text-amber-500" />
              <Moon v-else-if="theme === 'dark'" class="h-4 w-4 text-zinc-100" />
              <SunMoon v-else class="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </button>
          </div>
        </div>

        <!-- Navigation Links -->
        <nav :aria-label="t('tabManager')" class="flex-1 overflow-y-auto p-3 space-y-6">
          <!-- Quick Views -->
          <div class="space-y-1">
            <!-- 1. Current Tabs -->
            <button
              type="button"
              :aria-current="tabStore.selectedGroupId === 'current' ? 'page' : undefined"
              class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :class="
                tabStore.selectedGroupId === 'current'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'
              "
              @click="tabStore.selectedGroupId = 'current'">
              <Layers class="h-4 w-4 shrink-0" />
              <span class="flex-1 text-left truncate">{{ t('currentTabs') }}</span>
              <span
                class="text-[10px] bg-zinc-200/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300 font-medium">
                {{ currentTabs.length }}
              </span>
            </button>

            <!-- 2. History Snapshots -->
            <button
              type="button"
              :aria-current="tabStore.selectedGroupId === 'history' ? 'page' : undefined"
              class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :class="
                tabStore.selectedGroupId === 'history'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                  : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100'
              "
              @click="tabStore.selectedGroupId = 'history'">
              <Clock class="h-4 w-4 shrink-0" />
              <span class="flex-1 text-left truncate">{{ t('historySnapshots') }}</span>
              <span
                class="text-[10px] bg-zinc-200/80 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full text-zinc-700 dark:text-zinc-300 font-medium">
                {{ tabStore.historyGroups.length }}
              </span>
            </button>
          </div>

          <!-- Saved Groups List -->
          <div class="space-y-1">
            <div
              class="px-2.5 text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center justify-between transition-colors"
              :class="
                tabStore.isDraggingTab ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 dark:text-zinc-400'
              ">
              <div class="flex items-center gap-1.5">
                <span>{{ t('savedGroups') }}</span>
                <span
                  v-if="tabStore.isDraggingTab"
                  class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-zinc-700">
                  {{ t('dropTargets') }}
                </span>
              </div>
              <span
                class="text-[10px]"
                :class="
                  tabStore.isDraggingTab
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 font-medium'
                ">
                {{ tabStore.namedGroups.length }}
              </span>
            </div>

            <div v-if="tabStore.namedGroups.length > 0" class="space-y-1">
              <button
                v-for="group in tabStore.namedGroups"
                :key="group.id"
                type="button"
                :aria-current="tabStore.selectedGroupId === group.id ? 'page' : undefined"
                class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-all relative select-none border cursor-pointer"
                :class="[
                  dragOverGroupId === group.id
                    ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/90 dark:bg-zinc-800 text-indigo-950 dark:text-zinc-100 font-semibold ring-2 ring-indigo-500/20 shadow-2xs'
                    : tabStore.isDraggingTab
                      ? 'border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-indigo-300 dark:hover:border-zinc-600 hover:bg-indigo-50/40'
                      : tabStore.selectedGroupId === group.id
                        ? 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                        : 'border-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/70 hover:text-zinc-900 dark:hover:text-zinc-100',
                ]"
                @click="tabStore.selectedGroupId = group.id"
                @dragover.prevent="handleDragOver($event, group.id)"
                @dragenter.prevent="handleDragEnter(group.id)"
                @dragleave="handleDragLeave($event, group.id)"
                @drop.prevent="handleDrop($event, group.id)">
                <div class="flex items-center gap-2 truncate min-w-0 flex-1 mr-2">
                  <Folder
                    class="h-3.5 w-3.5 shrink-0 transition-transform"
                    :class="[
                      dragOverGroupId === group.id
                        ? 'text-indigo-600 dark:text-indigo-400 scale-105'
                        : tabStore.isDraggingTab
                          ? 'text-indigo-500 dark:text-indigo-400'
                          : 'text-zinc-400 dark:text-zinc-500',
                    ]" />
                  <span class="truncate">{{ group.name || t('savedGroupFallback') }}</span>
                </div>
                <span
                  class="text-[10px] ml-1 shrink-0 transition-colors font-medium"
                  :class="[
                    dragOverGroupId === group.id
                      ? 'text-indigo-700 dark:text-indigo-300 font-bold bg-indigo-100/90 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full'
                      : tabStore.isDraggingTab
                        ? 'text-zinc-500 dark:text-zinc-400 font-medium'
                        : 'text-zinc-400 dark:text-zinc-500',
                  ]">
                  {{ group.tabs.length }}
                </span>
              </button>
            </div>
            <div
              v-else-if="tabStore.isDraggingTab"
              class="px-2.5 py-2.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-800/40 text-center">
              <p class="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                {{ t('noSavedGroupsYet') }}
              </p>
              <p class="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                {{ t('saveCurrentTabsFirst') }}
              </p>
            </div>
            <div v-else class="px-2.5 py-2 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
              {{ t('noSavedGroupsYet') }}
            </div>
          </div>
        </nav>
      </aside>

      <!-- Main Workspace -->
      <main class="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-zinc-50/60 dark:bg-zinc-950">
        <!-- Content Area -->
        <section class="flex-1 overflow-y-auto p-6">
          <div class="w-full max-w-6xl mx-auto">
            <!-- Current Tabs View -->
            <div v-if="tabStore.selectedGroupId === 'current'" class="space-y-4">
              <Card
                class="overflow-hidden border border-zinc-200/90 dark:border-zinc-800/90 shadow-xs bg-white dark:bg-zinc-900">
                <CardHeader
                  class="p-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-2.5">
                      <div
                        class="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        <Layers class="h-4 w-4" />
                      </div>
                      <div>
                        <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                          {{ t('currentWindowTabs') }}
                        </h2>
                        <p class="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal leading-tight">
                          {{ t('currentTabsSubtitle') }}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        class="h-7 px-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                        :disabled="currentTabsLoading"
                        @click="refreshCurrentTabs(false)">
                        <RotateCcw class="h-3.5 w-3.5 mr-1" :class="{ 'motion-safe:animate-spin': currentTabsLoading }" />
                        {{ t('refresh') }}
                      </Button>
                      <Badge variant="secondary" class="font-medium text-xs">
                        {{ formatTabsCount(currentTabs.length) }}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <!-- Actions Toolbar / Group Name Input -->
                <div
                  class="p-3.5 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div class="flex-1 min-w-[220px] max-w-md">
                    <Input
                      v-model="newGroupName"
                      :aria-label="t('groupNameLabel')"
                      :placeholder="t('groupNamePlaceholder')"
                      class="h-8 text-xs bg-zinc-50/60 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500"
                      @keydown="handleGroupNameKeydown" />
                  </div>

                  <div class="flex items-center gap-4 shrink-0">
                    <label
                      class="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer select-none">
                      <input
                        v-model="closeWindowAfterSave"
                        type="checkbox"
                        class="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 accent-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5">
                      <span>{{ t('closeWindowAfterSave') }}</span>
                    </label>

                    <Button
                      size="sm"
                      variant="default"
                      class="h-8 gap-1.5 text-xs font-medium shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                      :disabled="isSavingCurrent || currentTabs.length === 0"
                      @click="saveCurrentTabs">
                      <Save class="h-3.5 w-3.5" />
                      <span>{{ isSavingCurrent ? t('saving') : t('saveAsTabGroup') }}</span>
                    </Button>
                  </div>
                </div>

                <!-- Tabs List -->
                <CardContent class="p-3">
                  <div
                    v-if="currentTabs.length === 0"
                    class="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs space-y-1.5">
                    <p>{{ t('noCurrentTabs') }}</p>
                    <p class="text-[11px] text-zinc-400/80 dark:text-zinc-500/80">
                      {{ t('tabRowHint') }}
                    </p>
                  </div>

                  <template v-else>
                    <div
                      role="list"
                      class="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
                      <TabItemRow
                        v-for="tab in currentTabs"
                        :key="tab.id"
                        :tab="tab"
                        source-group-id="current"
                        :remove-title="t('excludeTab')"
                        :remove-aria-label="t('excludeTabAria')"
                        @remove="removeCurrentTab"
                      />
                    </div>
                    <p class="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 px-2">
                      {{ t('tabRowHint') }}
                    </p>
                  </template>
                </CardContent>
              </Card>
            </div>

            <!-- Collection Detail View (when selecting a saved group) -->
            <div v-else-if="tabStore.selectedGroup && !tabStore.selectedGroup.isHistory">
              <CollectionDetail
                :key="tabStore.selectedGroup.id"
                :group="tabStore.selectedGroup"
                @deleted="tabStore.selectedGroupId = 'current'" />
            </div>

            <!-- History Snapshots Feed / Fallback Groups List -->
            <div v-else class="space-y-4">
              <div class="flex items-center justify-between gap-4 pb-2 border-b border-zinc-200/60 dark:border-zinc-800">
                <div>
                  <h2 class="text-base font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
                    {{ t('historySnapshots') }}
                  </h2>
                  <p class="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal">
                    {{ t('historySnapshotsSubtitle') }}
                  </p>
                </div>
                <div class="relative w-64">
                  <Search
                    class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                  <Input
                    v-model="searchQuery"
                    :aria-label="t('searchHistoryPlaceholder')"
                    :placeholder="t('searchHistoryPlaceholder')"
                    class="h-8 pl-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900" />
                </div>
              </div>
              <TabGroupList :groups="displayedGroups" />
            </div>
          </div>
        </section>
      </main>

      <!-- About PackTabs Modal -->
      <Modal v-model:open="showAboutModal" :title="t('aboutPackTabs')" :description="t('aboutDesc')">
        <div class="space-y-4 py-1">
          <div
            class="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-100 dark:border-zinc-800">
            <img src="/icon/48.png" alt="PackTabs Logo" class="h-10 w-10 rounded-xl shrink-0 shadow-xs object-contain">
            <div class="min-w-0 flex-1">
              <h4 class="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                PackTabs
              </h4>
              <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {{ t('aboutTagline') }}
              </p>
            </div>
          </div>

          <div class="text-xs text-zinc-600 dark:text-zinc-300 space-y-2.5">
            <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span class="text-zinc-500 dark:text-zinc-400">{{ t('versionLabel') }}</span>
              <span class="font-medium text-zinc-700 dark:text-zinc-200">{{ appVersion }}</span>
            </div>
            <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span class="text-zinc-500 dark:text-zinc-400">{{ t('authorLabel') }}</span>
              <span class="font-medium text-zinc-700 dark:text-zinc-200">Wesley Chen</span>
            </div>
            <div class="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800">
              <span class="text-zinc-500 dark:text-zinc-400">GitHub</span>
              <a
                href="https://github.com/topos-lab/packtabs-extension"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline flex items-center gap-1 font-medium">
                <span>topos-lab/packtabs-extension</span>
                <ExternalLink class="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
        <template #footer>
          <div class="w-full flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              class="h-8 gap-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
              @click="
                showAboutModal = false;
                showSettingsModal = true;
              ">
              <Settings class="h-3.5 w-3.5" />
              <span>{{ t('settings') }}</span>
            </Button>
            <Button size="sm" variant="outline" @click="showAboutModal = false">
              {{ t('close') }}
            </Button>
          </div>
        </template>
      </Modal>

      <!-- Dedicated Settings Modal -->
      <SettingsModal v-model:open="showSettingsModal" />
    </div>

    <!-- Floating Toast Notifications (rendered in both Dashboard and StartupRestorer modes) -->
    <ToastContainer />
  </TooltipProvider>
</template>
