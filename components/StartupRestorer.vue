<script lang="ts" setup>
  import {
    BookmarkPlus,
    Check,
    Clock,
    ExternalLink,
    Folder,
    Moon,
    Search,
    Settings,
    Sparkles,
    Sun,
    SunMoon,
    Trash2,
    X,
  } from 'lucide-vue-next';
  import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

  import SettingsModal from '~/components/SettingsModal.vue';
  import StartupTabList from '~/components/StartupTabList.vue';
  import { Button } from '~/components/ui/button';
  import { Card, CardContent, CardHeader } from '~/components/ui/card';
  import { Input } from '~/components/ui/input';
  import { Tooltip } from '~/components/ui/tooltip';
  import { useGroupActions } from '~/composables/useGroupActions';
  import { formatTabsCount, useI18n } from '~/composables/useI18n';
  import { useTheme } from '~/composables/useTheme';
  import { useToast } from '~/composables/useToast';
  import { useTabStore } from '~/stores/useTabStore';
  import type { TabGroup, TabItem } from '~/types/TabGroup';
  import { formatFullDateTime } from '~/utils/date';
  import { isImeComposing } from '~/utils/keyboard';
  import {
    hasTabDragData,
    openSingleTab,
    prepareTabsForDisplay,
    readTabDragData,
    writeTabDragData,
  } from '~/utils/tabManager';

  interface PreparedRestorerEntry {
    group: TabGroup;
    tabs: TabItem[];
  }

  const tabStore = useTabStore();
  const toast = useToast();
  const { t } = useI18n();
  const { theme, cycleTheme, themeTooltip } = useTheme();
  const {
    openGroupInNewWindow,
    openGroupTabs,
    deleteGroupWithUndo,
    deleteTabWithUndo,
    convertHistoryToNamedWithUndo,
    dropTabIntoSavedGroup,
  } = useGroupActions();

  const searchQuery = ref('');
  const isSearchOpen = ref(false);
  const searchInputRef = ref<{ focus: () => void } | null>(null);
  const expandedGroupIds = ref<Set<string>>(new Set());
  const showSettingsModal = ref(false);

  // Inline history conversion state
  const editingHistoryGroupId = ref<string | null>(null);
  const editingHistoryName = ref('');
  const historyInputRef = ref<{ focus: () => void } | null>(null);

  // Drag-and-drop categorization state
  const draggingSourceGroupId = ref<string | null>(null);
  const draggingSourceIsHistory = ref(false);
  const dragOverGroupId = ref<string | null>(null);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);

  function setHistoryInputRef(groupId: string, el: unknown) {
    if (editingHistoryGroupId.value === groupId) {
      const candidate = el as { focus?: () => void } | null;
      historyInputRef.value =
        candidate && typeof candidate.focus === 'function' ? (candidate as { focus: () => void }) : null;
    }
  }

  const logoUrl =
    typeof browser !== 'undefined' && browser.runtime?.getURL ? browser.runtime.getURL('/icon/48.png') : '/icon/48.png';

  function toggleExpand(groupId: string) {
    if (expandedGroupIds.value.has(groupId)) {
      expandedGroupIds.value.delete(groupId);
    } else {
      expandedGroupIds.value.add(groupId);
    }
  }

  async function openSearch() {
    isSearchOpen.value = true;
    await nextTick();
    searchInputRef.value?.focus();
  }

  function closeSearch(clear = true) {
    if (clear) {
      searchQuery.value = '';
    }
    isSearchOpen.value = false;
  }

  function handleSearchBlur() {
    if (!searchQuery.value.trim()) {
      isSearchOpen.value = false;
    }
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (isImeComposing(event)) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch(true);
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (isImeComposing(event) || showSettingsModal.value || editingHistoryGroupId.value != null) {
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      void openSearch();
    }
  }

  function clearDragState() {
    draggingSourceGroupId.value = null;
    draggingSourceIsHistory.value = false;
    dragOverGroupId.value = null;
    if (
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement.hasAttribute('data-tab-open')
    ) {
      document.activeElement.blur();
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleGlobalKeydown);
    window.addEventListener('dragend', clearDragState);
    window.addEventListener('drop', clearDragState);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleGlobalKeydown);
    window.removeEventListener('dragend', clearDragState);
    window.removeEventListener('drop', clearDragState);
  });

  function prepareEntries(groups: TabGroup[], isHistory: boolean): PreparedRestorerEntry[] {
    const q = searchQuery.value.toLowerCase().trim();
    const result: PreparedRestorerEntry[] = [];

    for (const group of groups) {
      const tabs = prepareTabsForDisplay(group.tabs);
      if (!q) {
        result.push({ group, tabs });
        continue;
      }
      const title = isHistory ? formatFullDateTime(group.createdAt) : group.name || '';
      const matchName = title.toLowerCase().includes(q);
      const matchTabs = tabs.some(
        (tab) => tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)
      );
      if (matchName || matchTabs) {
        result.push({ group, tabs });
      }
    }

    return result;
  }

  const filteredSavedEntries = computed(() => prepareEntries(tabStore.namedGroups, false));
  const filteredHistoryEntries = computed(() => prepareEntries(tabStore.historyGroups, true));

  // Check if a history group is the most recent one
  const latestHistoryGroupId = computed(() => {
    return tabStore.historyGroups.length > 0 ? tabStore.historyGroups[0].id : null;
  });

  async function closeCurrentPage() {
    try {
      if (typeof browser !== 'undefined' && browser.tabs?.getCurrent) {
        const currentTab = await browser.tabs.getCurrent();
        if (currentTab?.id !== undefined && browser.tabs?.remove) {
          await browser.tabs.remove(currentTab.id);
          return;
        }
      }
    } catch (err) {
      if (err && (err as Error).name !== 'MockNotImplementedError') {
        console.warn('Failed to close current tab via browser.tabs.remove:', err);
      }
    }

    try {
      if (typeof window !== 'undefined' && window.close) {
        window.close();
      }
    } catch (err) {
      console.warn('Failed to close current window via window.close:', err);
    }
  }

  async function handleRestoreInNewWindow(tabs: TabItem[]) {
    await openGroupInNewWindow(tabs, { toastLife: 2500 });
  }

  async function handleRestoreGroup(tabs: TabItem[], event?: MouseEvent) {
    await openGroupTabs(tabs, {
      event,
      silentSuccess: true,
      onAfterOpen: closeCurrentPage,
    });
  }

  async function openTabFromRestorer(tab: TabItem, inBackground: boolean) {
    try {
      await openSingleTab(tab, inBackground);
      if (inBackground) {
        toast.add({
          severity: 'info',
          detail: t('openedBackgroundSuccess', { title: tab.title || t('untitled') }),
          life: 2000,
        });
      }
    } catch {
      toast.add({
        severity: 'error',
        detail: t('openedBackgroundFailed'),
        life: 3000,
      });
    }
  }

  async function handleTabClick(event: MouseEvent, tab: TabItem) {
    const inBackground = event.ctrlKey || event.metaKey || event.shiftKey;
    await openTabFromRestorer(tab, inBackground);
  }

  async function handleTabMiddleClick(event: MouseEvent, tab: TabItem) {
    if (event.button === 1) {
      event.preventDefault();
      await openTabFromRestorer(tab, true);
    }
  }

  // Inline history conversion handlers
  async function startHistoryConversion(group: TabGroup) {
    editingHistoryGroupId.value = group.id;
    editingHistoryName.value = '';
    await nextTick();
    historyInputRef.value?.focus();
  }

  function cancelHistoryConversion() {
    editingHistoryGroupId.value = null;
    editingHistoryName.value = '';
  }

  async function saveHistoryConversion(group: TabGroup, allowDefaultFallback = false) {
    if (editingHistoryGroupId.value !== group.id) {
      return;
    }

    const nameDraft = editingHistoryName.value;
    if (!nameDraft.trim() && !allowDefaultFallback) {
      cancelHistoryConversion();
      return;
    }

    editingHistoryGroupId.value = null;
    editingHistoryName.value = '';

    await convertHistoryToNamedWithUndo(group, nameDraft, { allowDefaultFallback });
  }

  function handleHistoryNameKeydown(event: KeyboardEvent, group: TabGroup) {
    if (isImeComposing(event)) {
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveHistoryConversion(group, true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelHistoryConversion();
    }
  }

  // Delete group / tab with 5s Undo toast
  async function handleDeleteGroup(group: TabGroup) {
    if (editingHistoryGroupId.value === group.id) {
      cancelHistoryConversion();
    }
    await deleteGroupWithUndo(group);
  }

  async function handleDeleteTab(group: TabGroup, allTabs: TabItem[], tabId: string) {
    await deleteTabWithUndo(group, allTabs, tabId);
  }

  // Drag-and-drop categorization (History -> Saved copies; Saved -> Saved moves)
  function handleTabDragStart(event: DragEvent, group: TabGroup, tab: TabItem) {
    if (!event.dataTransfer) {
      return;
    }
    if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    draggingSourceGroupId.value = group.id;
    draggingSourceIsHistory.value = Boolean(group.isHistory);
    writeTabDragData(event.dataTransfer, {
      sourceGroupId: group.id,
      sourceIsHistory: Boolean(group.isHistory),
      tab,
    });
  }

  function handleCardDragOver(event: DragEvent, targetGroupId: string) {
    if (!event.dataTransfer || !hasTabDragData(event.dataTransfer)) {
      return;
    }
    if (draggingSourceGroupId.value === targetGroupId) {
      return;
    }
    event.dataTransfer.dropEffect = draggingSourceIsHistory.value ? 'copy' : 'move';
    dragOverGroupId.value = targetGroupId;
  }

  function handleCardDragEnter(targetGroupId: string) {
    if (draggingSourceGroupId.value && draggingSourceGroupId.value !== targetGroupId) {
      dragOverGroupId.value = targetGroupId;
    }
  }

  function handleCardDragLeave(event: DragEvent, targetGroupId: string) {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!currentTarget?.contains(relatedTarget) && dragOverGroupId.value === targetGroupId) {
      dragOverGroupId.value = null;
    }
  }

  async function handleCardDrop(event: DragEvent, targetGroupId: string) {
    const payload = readTabDragData(event.dataTransfer);
    clearDragState();

    if (!payload) {
      return;
    }

    await dropTabIntoSavedGroup(payload, targetGroupId);
  }
</script>

<template>
  <div class="min-h-screen w-full bg-zinc-50/80 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col">
    <!-- Clean Minimalist Header -->
    <header
      class="border-b border-zinc-200/70 dark:border-zinc-800/80 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md sticky top-0 z-20">
      <div class="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
        <!-- Brand & Subtitle -->
        <div class="flex items-center gap-2.5 min-w-0">
          <img :src="logoUrl" alt="PackTabs Logo" class="h-7 w-7 rounded-lg shadow-2xs object-contain shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">PackTabs</span>
            <span aria-hidden="true" class="text-zinc-300 dark:text-zinc-600 select-none">·</span>
            <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
              {{ t('startupRestorer') }}
            </span>
          </div>
        </div>

        <!-- Right Actions: Collapsible Search + Settings + Theme toggle -->
        <div class="flex items-center gap-1.5 shrink-0">
          <Tooltip v-if="!isSearchOpen" :content="t('searchWorkspacesOrHistory')" side="bottom">
            <button
              type="button"
              data-search-toggle
              aria-expanded="false"
              class="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :aria-label="t('searchWorkspacesOrHistory')"
              @click="openSearch">
              <Search class="h-4 w-4" />
            </button>
          </Tooltip>

          <div v-else class="relative w-44 sm:w-64">
            <Search
              class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            <Input
              ref="searchInputRef"
              v-model="searchQuery"
              :aria-label="t('searchWorkspacesOrHistory')"
              :placeholder="t('searchWorkspacesOrHistory')"
              class="h-8 pl-8 pr-7 text-xs bg-zinc-50 dark:bg-[#222226] border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-[#222226] focus:border-indigo-500"
              @blur="handleSearchBlur"
              @keydown="handleSearchKeydown" />
            <Tooltip :content="t('close')" side="bottom">
              <button
                type="button"
                data-search-close
                class="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
                :aria-label="t('close')"
                @mousedown.prevent
                @click="closeSearch(true)">
                <X class="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>

          <Tooltip :content="t('settings')" side="bottom">
            <button
              type="button"
              class="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :aria-label="t('settings')"
              @click="showSettingsModal = true">
              <Settings class="h-4 w-4" />
            </button>
          </Tooltip>

          <Tooltip :content="themeTooltip" side="bottom">
            <button
              type="button"
              class="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :aria-label="themeTooltip"
              @click="cycleTheme">
              <Sun v-if="theme === 'light'" class="h-4 w-4 text-amber-500" />
              <Moon v-else-if="theme === 'dark'" class="h-4 w-4 text-zinc-100" />
              <SunMoon v-else class="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            </button>
          </Tooltip>
        </div>
      </div>
    </header>

    <!-- Main Content: Pure 2-Column Restorer View -->
    <main class="flex-1 max-w-6xl w-full mx-auto px-6 pt-7 pb-6">
      <h1 class="sr-only">
        {{ t('startupTitle') }}
      </h1>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <!-- ================= LEFT COLUMN: Saved Groups ================= -->
        <section class="space-y-3.5">
          <!-- Column Header -->
          <div class="flex items-center gap-2 px-1 pb-0.5">
            <Folder class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <h2 class="text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
              {{ t('savedGroups') }}
            </h2>
            <span class="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
              {{ filteredSavedEntries.length }}
            </span>
          </div>

          <!-- Empty State -->
          <div
            v-if="filteredSavedEntries.length === 0"
            class="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700/60 bg-white/50 dark:bg-[#222226]/50 text-xs text-zinc-400 dark:text-zinc-500">
            <Folder class="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600 opacity-60" />
            <p>{{ t('noSavedGroupsInStartup') }}</p>
          </div>

          <!-- Saved Groups Cards List (also drag-drop targets) -->
          <div v-else class="space-y-3">
            <Card
              v-for="{ group, tabs } in filteredSavedEntries"
              :key="group.id"
              :data-saved-drop-card="group.id"
              class="border shadow-2xs hover:shadow-xs transition-all overflow-hidden"
              :class="[
                dragOverGroupId === group.id && draggingSourceGroupId !== group.id
                  ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/10 ring-1 ring-indigo-500/20'
                  : draggingSourceGroupId && draggingSourceGroupId !== group.id
                    ? 'border-dashed border-zinc-300 dark:border-zinc-600 bg-white dark:bg-[#222226]'
                    : 'border-zinc-200/80 dark:border-zinc-700/60 bg-white dark:bg-[#222226]',
              ]"
              @dragover.prevent="handleCardDragOver($event, group.id)"
              @dragenter.prevent="handleCardDragEnter(group.id)"
              @dragleave="handleCardDragLeave($event, group.id)"
              @drop.prevent="handleCardDrop($event, group.id)">
              <CardHeader class="group/header px-4 pt-3.5 pb-2.5 flex flex-row items-center justify-between gap-2 space-y-0">
                <div class="min-w-0 flex-1 flex items-center">
                  <div data-header-title class="inline-flex items-center gap-1.5 max-w-full min-w-0">
                    <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">
                      {{ group.name || t('savedGroupFallback') }}
                    </h3>
                    <Tooltip :content="t('deleteTabGroup')">
                      <button
                        type="button"
                        data-delete-group
                        class="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 opacity-0 group-hover/header:opacity-100 group-has-[:focus-visible]/header:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-opacity cursor-pointer"
                        :aria-label="t('deleteTabGroup')"
                        @click="handleDeleteGroup(group)">
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <!-- Actions: Open All + Open in New Window (flush right) -->
                <div data-header-actions class="flex items-center gap-1.5 shrink-0">
                  <Tooltip :content="`${t('openAll')} (${formatTabsCount(tabs.length)})`">
                    <Button
                      size="sm"
                      variant="ghost"
                      data-restore-action="open-all"
                      class="h-7 px-2.5 text-xs font-medium cursor-pointer bg-zinc-100/90 text-zinc-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-700/50 dark:text-zinc-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300 shadow-none transition-colors"
                      :disabled="tabs.length === 0"
                      @click="handleRestoreGroup(tabs, $event)">
                      <span>{{ t('openAll') }}</span>
                    </Button>
                  </Tooltip>

                  <Tooltip :content="t('openInNewWindow')">
                    <Button
                      size="sm"
                      variant="ghost"
                      data-open-new-window
                      class="h-7 w-7 p-0 cursor-pointer text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 shadow-none transition-colors"
                      :aria-label="t('openInNewWindow')"
                      :disabled="tabs.length === 0"
                      @click="handleRestoreInNewWindow(tabs)">
                      <ExternalLink class="h-3.5 w-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              </CardHeader>

              <!-- Tabs Preview -->
              <CardContent class="p-3 pt-0">
                <StartupTabList
                  :tabs="tabs"
                  :is-expanded="expandedGroupIds.has(group.id)"
                  @drag-start="(ev, tab) => handleTabDragStart(ev, group, tab)"
                  @drag-end="clearDragState"
                  @open-tab="handleTabClick"
                  @middle-click-tab="handleTabMiddleClick"
                  @delete-tab="handleDeleteTab(group, tabs, $event)"
                  @toggle-expand="toggleExpand(group.id)" />
              </CardContent>
            </Card>
          </div>
        </section>

        <!-- ================= RIGHT COLUMN: History Snapshots ================= -->
        <section class="space-y-3.5">
          <!-- Column Header -->
          <div class="flex items-center gap-2 px-1 pb-0.5">
            <Clock class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
            <h2 class="text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400">
              {{ t('historySnapshots') }}
            </h2>
            <span class="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
              {{ filteredHistoryEntries.length }}
            </span>
          </div>

          <!-- Empty State -->
          <div
            v-if="filteredHistoryEntries.length === 0"
            class="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700/60 bg-white/50 dark:bg-[#222226]/50 text-xs text-zinc-400 dark:text-zinc-500">
            <Clock class="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600 opacity-60" />
            <p>{{ t('noHistoryGroupsInStartup') }}</p>
          </div>

          <!-- History Snapshots Cards List -->
          <div v-else class="space-y-3">
            <Card
              v-for="{ group, tabs } in filteredHistoryEntries"
              :key="group.id"
              class="border shadow-2xs hover:shadow-xs transition-all bg-white dark:bg-[#222226] overflow-hidden"
              :class="[
                group.id === latestHistoryGroupId
                  ? 'border-indigo-200/90 dark:border-indigo-500/35'
                  : 'border-zinc-200/80 dark:border-zinc-700/60',
              ]">
              <CardHeader class="group/header px-4 pt-3.5 pb-2.5 flex flex-row items-center justify-between gap-2 space-y-0">
                <!-- Inline Conversion Input Mode -->
                <div v-if="editingHistoryGroupId === group.id" class="flex-1 flex items-center gap-1.5 min-w-0">
                  <Input
                    :ref="(el) => setHistoryInputRef(group.id, el)"
                    v-model="editingHistoryName"
                    data-history-name-input
                    class="h-7 text-xs flex-1 min-w-0 bg-zinc-50 dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-700"
                    :aria-label="t('saveAsNamedGroup')"
                    :placeholder="t('groupNamePlaceholder')"
                    @keydown="handleHistoryNameKeydown($event, group)"
                    @blur="saveHistoryConversion(group, false)" />
                  <Button
                    size="sm"
                    class="h-7 px-2 shrink-0"
                    data-history-save-confirm
                    :aria-label="t('save')"
                    @mousedown.prevent
                    @click="saveHistoryConversion(group, true)">
                    <Check class="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="h-7 px-2 shrink-0"
                    data-history-save-cancel
                    :aria-label="t('cancel')"
                    @mousedown.prevent
                    @click="cancelHistoryConversion">
                    <X class="h-3.5 w-3.5" />
                  </Button>
                </div>

                <!-- Standard Card Header Mode -->
                <template v-else>
                  <div class="min-w-0 flex-1 flex items-center">
                    <div data-header-title class="inline-flex items-center gap-1.5 max-w-full min-w-0 flex-wrap">
                      <!-- Soft highlight badge for the latest session -->
                      <span
                        v-if="group.id === latestHistoryGroupId"
                        class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-200/70 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-400/25 shrink-0">
                        <Sparkles class="h-2.5 w-2.5" />
                        <span>{{ t('lastClosedSession') }}</span>
                      </span>

                      <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">
                        {{ formatFullDateTime(group.createdAt) }}
                      </h3>

                      <div class="inline-flex items-center gap-0.5 shrink-0">
                        <Tooltip :content="t('saveAsNamedGroup')">
                          <button
                            type="button"
                            data-convert-history
                            class="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 opacity-0 group-hover/header:opacity-100 group-has-[:focus-visible]/header:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity cursor-pointer"
                            :aria-label="t('saveAsNamedGroup')"
                            @click="startHistoryConversion(group)">
                            <BookmarkPlus class="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>

                        <Tooltip :content="t('deleteTabGroup')">
                          <button
                            type="button"
                            data-delete-group
                            class="h-6 w-6 shrink-0 flex items-center justify-center rounded-md text-zinc-400 dark:text-zinc-500 opacity-0 group-hover/header:opacity-100 group-has-[:focus-visible]/header:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-opacity cursor-pointer"
                            :aria-label="t('deleteTabGroup')"
                            @click="handleDeleteGroup(group)">
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  </div>

                  <!-- Actions: Restore / Open All + Open in New Window (flush right) -->
                  <div data-header-actions class="flex items-center gap-1.5 shrink-0">
                    <Tooltip
                      :content="`${group.id === latestHistoryGroupId ? t('restoreThisSession') : t('openAll')} (${formatTabsCount(tabs.length)})`"
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        :data-restore-action="group.id === latestHistoryGroupId ? 'restore-latest' : 'open-all'"
                        class="h-7 px-2.5 text-xs font-medium cursor-pointer shadow-none transition-colors"
                        :class="[
                          group.id === latestHistoryGroupId
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400/30 dark:hover:bg-indigo-500/30 dark:hover:text-indigo-200'
                            : 'bg-zinc-100/90 text-zinc-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-700/50 dark:text-zinc-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300',
                        ]"
                        :disabled="tabs.length === 0"
                        @click="handleRestoreGroup(tabs, $event)">
                        <span>{{ group.id === latestHistoryGroupId ? t('restoreThisSession') : t('openAll') }}</span>
                      </Button>
                    </Tooltip>

                    <Tooltip :content="t('openInNewWindow')">
                      <Button
                        size="sm"
                        variant="ghost"
                        data-open-new-window
                        class="h-7 w-7 p-0 cursor-pointer text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 shadow-none transition-colors"
                        :aria-label="t('openInNewWindow')"
                        :disabled="tabs.length === 0"
                        @click="handleRestoreInNewWindow(tabs)">
                        <ExternalLink class="h-3.5 w-3.5" />
                      </Button>
                    </Tooltip>
                  </div>
                </template>
              </CardHeader>

              <!-- Tabs Preview -->
              <CardContent class="p-3 pt-0">
                <StartupTabList
                  :tabs="tabs"
                  :is-expanded="expandedGroupIds.has(group.id)"
                  @drag-start="(ev, tab) => handleTabDragStart(ev, group, tab)"
                  @drag-end="clearDragState"
                  @open-tab="handleTabClick"
                  @middle-click-tab="handleTabMiddleClick"
                  @delete-tab="handleDeleteTab(group, tabs, $event)"
                  @toggle-expand="toggleExpand(group.id)" />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>

    <!-- Subtle Borderless Footer Tip -->
    <footer class="mt-auto py-5 px-6 text-center">
      <p class="text-[11px] text-zinc-400 dark:text-zinc-500">
        {{ isMac ? t('startupTipMac') : t('startupTip') }}
      </p>
    </footer>

    <!-- Settings Modal -->
    <SettingsModal v-model:open="showSettingsModal" />
  </div>
</template>
