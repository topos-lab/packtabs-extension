<script lang="ts" setup>
import {
  Bookmark,
  Clock,
  Folder,
  Globe,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';

import TabGroupList from '~/components/TabGroupList.vue';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import ToastContainer from '~/components/ui/toast/ToastContainer.vue';
import { useToast } from '~/composables/useToast';
import { setStoreErrorHandler, useTabStore } from '~/stores/useTabStore';
import type { TabItem } from '~/types/TabGroup';
import { StorageQuotaExceededError } from '~/utils/storage';
import {
  captureCurrentWindow,
  closeCurrentTabs,
  getFaviconUrl,
  InvalidUrlError,
  openSingleTab,
  TabPermissionDeniedError,
} from '~/utils/tabManager';

const tabStore = useTabStore();
const toast = useToast();

const searchQuery = ref('');
const isSidebarOpen = ref(true);

// Current window tabs staging state
const currentTabs = ref<TabItem[]>([]);
const currentTabsLoading = ref(false);
const newGroupName = ref('');
const autoCloseTabs = ref(false);
const isSavingCurrent = ref(false);

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
    currentTabs.value = await captureCurrentWindow();
  } catch (error) {
    console.error('Failed to capture current window tabs:', error);
  } finally {
    currentTabsLoading.value = false;
  }
}

function removeCurrentTab(tabId: string) {
  currentTabs.value = currentTabs.value.filter((t) => t.id !== tabId);
}

async function handleOpenTab(tab: TabItem) {
  try {
    await openSingleTab(tab);
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: 'Failed to open tab',
      life: 3000,
    });
  }
}

async function saveCurrentTabs() {
  if (isSavingCurrent.value || currentTabs.value.length === 0) return;
  isSavingCurrent.value = true;

  try {
    const name = newGroupName.value.trim() || null;
    const group = await tabStore.saveGroup(name, false, currentTabs.value);

    toast.add({
      severity: 'success',
      summary: 'Saved successfully',
      detail: `Preserved ${group.tabs.length} tabs into "${group.name || 'Saved Group'}".`,
      life: 3500,
    });

    if (autoCloseTabs.value) {
      await closeCurrentTabs();
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

onMounted(async () => {
  await tabStore.loadGroups();
  await refreshCurrentTabs();
  tabStore.selectedGroupId = 'current';
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
  } else if (tabStore.selectedGroupId === 'saved' || tabStore.selectedGroupId === 'named') {
    list = tabStore.namedGroups;
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
    const matchTabs = group.tabs.some(
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
  <div class="flex h-screen w-full bg-slate-50 overflow-hidden text-slate-900">
    <!-- Sidebar -->
    <aside
      class="h-full border-r border-slate-200 bg-white flex flex-col transition-all duration-300 ease-in-out shrink-0"
      :class="isSidebarOpen ? 'w-64' : 'w-16'"
    >
      <!-- Sidebar Header / Logo -->
      <div class="h-16 flex items-center justify-between px-3 border-b border-slate-100">
        <div v-if="isSidebarOpen" class="flex items-center gap-2.5 pl-2.5 overflow-hidden">
          <div class="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Layers class="h-4 w-4" />
          </div>
          <div class="flex flex-col">
            <span class="font-bold text-sm tracking-tight text-slate-900 leading-tight">PackTabs</span>
            <span class="text-[10px] text-slate-400 font-medium leading-tight">Tab Manager</span>
          </div>
        </div>

        <button
          type="button"
          class="h-7 w-7 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
          :class="isSidebarOpen ? 'mr-2.5' : 'mx-auto'"
          :title="isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'"
          @click="isSidebarOpen = !isSidebarOpen"
        >
          <PanelLeftClose v-if="isSidebarOpen" class="h-4 w-4" />
          <PanelLeftOpen v-else class="h-4 w-4" />
        </button>
      </div>

      <!-- Navigation Links -->
      <div class="flex-1 overflow-y-auto p-3 space-y-6">
        <!-- Quick Views -->
        <div class="space-y-1">
          <div v-if="isSidebarOpen" class="px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Views
          </div>

          <!-- 1. Current Tabs -->
          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
            :class="tabStore.selectedGroupId === 'current' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            @click="tabStore.selectedGroupId = 'current'"
          >
            <Layers class="h-4 w-4 shrink-0" />
            <span v-if="isSidebarOpen" class="flex-1 text-left truncate">Current Tabs</span>
            <span v-if="isSidebarOpen" class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-normal">
              {{ currentTabs.length }}
            </span>
          </button>

          <!-- 2. History Snapshots -->
          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
            :class="tabStore.selectedGroupId === 'history' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            @click="tabStore.selectedGroupId = 'history'"
          >
            <Clock class="h-4 w-4 shrink-0" />
            <span v-if="isSidebarOpen" class="flex-1 text-left truncate">History Snapshots</span>
            <span v-if="isSidebarOpen" class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-normal">
              {{ tabStore.historyGroups.length }}
            </span>
          </button>

          <!-- 3. Saved Groups -->
          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
            :class="tabStore.selectedGroupId === 'saved' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            @click="tabStore.selectedGroupId = 'saved'"
          >
            <Bookmark class="h-4 w-4 shrink-0" />
            <span v-if="isSidebarOpen" class="flex-1 text-left truncate">Saved Groups</span>
            <span v-if="isSidebarOpen" class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-normal">
              {{ tabStore.namedGroups.length }}
            </span>
          </button>
        </div>

        <!-- Collections (Named Groups List) -->
        <div v-if="isSidebarOpen && tabStore.namedGroups.length > 0" class="space-y-1">
          <div class="px-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Collections
          </div>
          <div class="space-y-0.5 max-h-60 overflow-y-auto">
            <button
              v-for="group in tabStore.namedGroups"
              :key="group.id"
              type="button"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors"
              :class="tabStore.selectedGroupId === group.id ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'"
              @click="tabStore.selectedGroupId = group.id"
            >
              <div class="flex items-center gap-2 truncate">
                <Folder class="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span class="truncate">{{ group.name }}</span>
              </div>
              <span class="text-[10px] text-slate-400 ml-1">{{ group.tabs.length }}</span>
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="flex-1 flex flex-col h-full min-w-0 overflow-hidden bg-slate-50/60">
      <!-- Top Bar -->
      <header class="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between gap-4 shrink-0 z-10">
        <!-- Title & Search -->
        <div class="flex items-center gap-4 flex-1 max-w-xl">
          <h1 class="text-base font-semibold text-slate-800 tracking-tight shrink-0">
            <span v-if="tabStore.selectedGroupId === 'current'">Current Tabs</span>
            <span v-else-if="tabStore.selectedGroupId === 'history'">History Snapshots</span>
            <span v-else-if="tabStore.selectedGroupId === 'saved'">Saved Groups</span>
            <span v-else-if="tabStore.selectedGroup">{{ tabStore.selectedGroup.name }}</span>
            <span v-else>All Tab Groups</span>
          </h1>

          <!-- Search Input -->
          <div class="relative w-full max-w-xs">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              v-model="searchQuery"
              placeholder="Search groups or tabs..."
              class="h-8 pl-8 text-xs bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <section class="flex-1 overflow-y-auto p-6">
        <div class="max-w-4xl mx-auto">
          <!-- Current Tabs View -->
          <div v-if="tabStore.selectedGroupId === 'current'" class="space-y-4">
            <Card class="overflow-hidden border border-slate-200/90 shadow-xs">
              <CardHeader class="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
                <div class="flex items-center justify-between gap-4">
                  <div class="flex items-center gap-2.5">
                    <div class="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Layers class="h-4 w-4" />
                    </div>
                    <div>
                      <h2 class="text-sm font-semibold text-slate-900 leading-tight">
                        Current Window Tabs
                      </h2>
                      <p class="text-[11px] text-slate-400 font-normal leading-tight">
                        Review, exclude, or name before saving
                      </p>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      class="h-7 px-2 text-xs text-slate-500 hover:text-slate-800"
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
              <div class="p-3.5 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div class="flex-1 max-w-sm">
                  <Input
                    v-model="newGroupName"
                    placeholder="Enter group name (e.g., Work Project)..."
                    class="h-8 text-xs bg-slate-50/60 border-slate-200 focus:bg-white focus:border-indigo-500"
                    @keydown.enter="saveCurrentTabs"
                  />
                </div>

                <div class="flex items-center gap-4 shrink-0">
                  <label class="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      v-model="autoCloseTabs"
                      class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span>Close tabs after save</span>
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
                <div v-if="displayedCurrentTabs.length === 0" class="py-12 text-center text-slate-400 text-xs">
                  <p v-if="currentTabs.length === 0">No open web tabs in the current window.</p>
                  <p v-else>No tabs match your search query.</p>
                </div>

                <div v-else class="flex flex-col divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
                  <div
                    v-for="tab in displayedCurrentTabs"
                    :key="tab.id"
                    class="group/tab flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-slate-50 transition-colors"
                  >
                    <!-- Favicon + Title Link -->
                    <div
                      class="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer mr-3"
                      :title="tab.url"
                      @click="handleOpenTab(tab)"
                    >
                      <div class="h-4 w-4 shrink-0 flex items-center justify-center">
                        <img
                          v-if="tab.faviconUrl || getFaviconUrl(tab.url)"
                          :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                          class="h-4 w-4 rounded-xs object-contain"
                          alt=""
                          loading="lazy"
                        />
                        <Globe v-else class="h-3.5 w-3.5 text-slate-400" />
                      </div>

                      <span class="text-xs font-medium text-slate-800 group-hover/tab:text-indigo-600 truncate transition-colors">
                        {{ tab.title || 'Untitled' }}
                      </span>

                      <span
                        v-if="getDomain(tab.url)"
                        class="text-[11px] text-slate-400 font-normal shrink-0 ml-auto pr-2 hidden sm:inline"
                      >
                        {{ getDomain(tab.url) }}
                      </span>
                    </div>

                    <!-- Remove from staging list button -->
                    <button
                      type="button"
                      class="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
                      title="Exclude from group"
                      aria-label="Exclude tab"
                      @click.stop="removeCurrentTab(tab.id)"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <!-- Other Views (Saved Groups, History Snapshots, Specific Group) -->
          <div v-else>
            <TabGroupList :groups="displayedGroups" @save="handleSave" />
          </div>
        </div>
      </section>
    </main>

    <!-- Floating Toast Notifications -->
    <ToastContainer />
  </div>
</template>
