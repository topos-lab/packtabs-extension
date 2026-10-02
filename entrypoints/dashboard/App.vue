<script lang="ts" setup>
import {
  Bookmark,
  Clock,
  Folder,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Search,
} from 'lucide-vue-next';
import { computed, onMounted, ref } from 'vue';

import TabGroupList from '~/components/TabGroupList.vue';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import ToastContainer from '~/components/ui/toast/ToastContainer.vue';
import { useToast } from '~/composables/useToast';
import { setStoreErrorHandler, useTabStore } from '~/stores/useTabStore';
import { StorageQuotaExceededError } from '~/utils/storage';
import { InvalidUrlError, TabPermissionDeniedError } from '~/utils/tabManager';

const tabStore = useTabStore();
const toast = useToast();

const searchQuery = ref('');
const isSidebarOpen = ref(true);
const isSaving = ref(false);

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

onMounted(async () => {
  await tabStore.loadGroups();
});

// Filtered groups based on sidebar selection and search query
const displayedGroups = computed(() => {
  let list = tabStore.tabGroups;

  if (tabStore.selectedGroupId === 'history') {
    list = tabStore.historyGroups;
  } else if (tabStore.selectedGroupId === 'named') {
    list = tabStore.namedGroups;
  } else if (tabStore.selectedGroupId) {
    const specific = tabStore.tabGroups.find((g) => g.id === tabStore.selectedGroupId);
    list = specific ? [specific] : [];
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

async function saveCurrentTabs() {
  if (isSaving.value) return;
  isSaving.value = true;

  try {
    const group = await tabStore.saveGroup(null, true);
    toast.add({
      severity: 'success',
      summary: 'Saved successfully',
      detail: `Captured ${group.tabs.length} tabs from current window.`,
      life: 3500,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: error instanceof Error ? error.message : 'Could not save tabs',
      life: 4000,
    });
  } finally {
    isSaving.value = false;
  }
}

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
      <div class="h-16 flex items-center justify-between px-4 border-b border-slate-100">
        <div v-if="isSidebarOpen" class="flex items-center gap-2.5 overflow-hidden">
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
          class="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mx-auto"
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
          <div v-if="isSidebarOpen" class="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Views
          </div>

          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
            :class="tabStore.selectedGroupId === null ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            @click="tabStore.selectedGroupId = null"
          >
            <Layers class="h-4 w-4 shrink-0" />
            <span v-if="isSidebarOpen" class="flex-1 text-left truncate">All Groups</span>
            <span v-if="isSidebarOpen" class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-normal">
              {{ tabStore.tabGroups.length }}
            </span>
          </button>

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

          <button
            type="button"
            class="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors"
            :class="tabStore.selectedGroupId === 'named' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            @click="tabStore.selectedGroupId = 'named'"
          >
            <Bookmark class="h-4 w-4 shrink-0" />
            <span v-if="isSidebarOpen" class="flex-1 text-left truncate">Named Collections</span>
            <span v-if="isSidebarOpen" class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500 font-normal">
              {{ tabStore.namedGroups.length }}
            </span>
          </button>
        </div>

        <!-- Named Groups list in sidebar -->
        <div v-if="isSidebarOpen && tabStore.namedGroups.length > 0" class="space-y-1">
          <div class="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Saved Groups
          </div>
          <div class="space-y-0.5 max-h-60 overflow-y-auto pr-1">
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
            <span v-if="tabStore.selectedGroupId === 'history'">History Snapshots</span>
            <span v-else-if="tabStore.selectedGroupId === 'named'">Named Collections</span>
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

        <!-- Action Button -->
        <div class="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="default"
            class="h-9 gap-1.5 shadow-xs font-medium"
            :disabled="isSaving"
            @click="saveCurrentTabs"
          >
            <Save class="h-4 w-4" />
            <span>{{ isSaving ? 'Saving...' : 'Save Current Tabs' }}</span>
          </Button>
        </div>
      </header>

      <!-- Content Area -->
      <section class="flex-1 overflow-y-auto p-6">
        <div class="max-w-7xl mx-auto">
          <TabGroupList :groups="displayedGroups" @save="handleSave" />
        </div>
      </section>
    </main>

    <!-- Floating Toast Notifications -->
    <ToastContainer />
  </div>
</template>
