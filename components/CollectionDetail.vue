<script lang="ts" setup>
import {
  Calendar,
  Check,
  ExternalLink,
  Folder,
  Globe,
  GripVertical,
  Pencil,
  Trash2,
  X,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import Modal from '~/components/ui/dialog/Modal.vue';
import { Input } from '~/components/ui/input';
import { useToast } from '~/composables/useToast';
import { useTabStore } from '~/stores/useTabStore';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { getFaviconUrl, openSingleTab, openTabs } from '~/utils/tabManager';

function getDomain(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

const props = defineProps<{
  group: TabGroup;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

const tabStore = useTabStore();
const toast = useToast();

// Editable title
const isEditingTitle = ref(false);
const editedTitle = ref(props.group.name ?? '');

function startEditingTitle() {
  isEditingTitle.value = true;
  editedTitle.value = props.group.name ?? '';
}

async function saveTitle() {
  if (editedTitle.value.trim() && editedTitle.value.trim() !== props.group.name) {
    try {
      await tabStore.updateGroup(props.group.id, { name: editedTitle.value.trim() });
      toast.add({
        severity: 'success',
        summary: 'Updated',
        detail: 'Collection name updated',
        life: 2500,
      });
    } catch {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to update name',
        life: 3000,
      });
    }
  }
  isEditingTitle.value = false;
}

function cancelEdit() {
  isEditingTitle.value = false;
  editedTitle.value = props.group.name ?? '';
}

function handleTitleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    void saveTitle();
  } else if (event.key === 'Escape') {
    cancelEdit();
  }
}

// Date formatted
const formattedDate = computed(() => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(props.group.createdAt);
  } catch {
    return String(props.group.createdAt);
  }
});

// Filtered tabs by search query
const filteredTabs = computed(() => {
  if (!props.searchQuery?.trim()) {
    return props.group.tabs;
  }
  const q = props.searchQuery.toLowerCase().trim();
  return props.group.tabs.filter(
    (t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
  );
});

// Favicon errors
const faviconErrors = ref<Record<string, boolean>>({});
function handleFaviconError(id: string) {
  faviconErrors.value[id] = true;
}

// Drag & drop tab categorization
function handleDragStart(event: DragEvent, tab: TabItem) {
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/packtabs-tab',
    JSON.stringify({
      sourceGroupId: props.group.id,
      tab,
    })
  );
  event.dataTransfer.setData('text/plain', tab.url);
}

// Open all tabs
async function handleOpenAll() {
  try {
    await openTabs(props.group.tabs);
    toast.add({
      severity: 'success',
      detail: `Restored ${props.group.tabs.length} tabs in browser`,
      life: 2500,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: 'Failed to open tabs',
      life: 3000,
    });
  }
}

// Open single tab
async function handleOpenTab(tab: TabItem) {
  try {
    await openSingleTab(tab);
  } catch {
    toast.add({
      severity: 'error',
      detail: 'Failed to open tab',
      life: 2500,
    });
  }
}

// Delete tab
async function handleDeleteTab(tabId: string) {
  try {
    await tabStore.deleteTab(props.group.id, tabId);
    toast.add({
      severity: 'success',
      detail: 'Tab removed from collection',
      life: 2000,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: 'Failed to remove tab',
      life: 2500,
    });
  }
}

// Delete group modal
const showDeleteConfirm = ref(false);
async function confirmDeleteGroup() {
  try {
    await tabStore.deleteGroup(props.group.id);
    showDeleteConfirm.value = false;
    emit('deleted');
    toast.add({
      severity: 'success',
      detail: 'Collection deleted',
      life: 2500,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: 'Failed to delete collection',
      life: 2500,
    });
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Unified Collection Card -->
    <Card class="overflow-hidden border border-slate-200/90 shadow-xs">
      <!-- CardHeader: Integrated Title, Meta & Actions -->
      <CardHeader class="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
        <div class="flex items-center justify-between gap-4">
          <!-- Left: Folder Icon + Inline Editable Title + Date -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Folder class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <!-- Inline Editable Title -->
              <div v-if="!isEditingTitle" class="flex items-center gap-2 group/title">
                <h2 class="text-sm font-semibold text-slate-900 leading-tight truncate">
                  {{ group.name || 'Untitled Collection' }}
                </h2>
                <button
                  type="button"
                  class="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded"
                  title="Rename collection"
                  aria-label="Rename collection"
                  @click="startEditingTitle"
                >
                  <Pencil class="h-3 w-3" />
                </button>
              </div>
              <div v-else class="flex items-center gap-1.5 max-w-sm">
                <Input
                  v-model="editedTitle"
                  class="h-7 text-xs font-medium"
                  autofocus
                  @keydown="handleTitleKeydown"
                  @blur="saveTitle"
                />
                <Button size="sm" class="h-7 px-2" @click="saveTitle">
                  <Check class="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" class="h-7 px-2" @click="cancelEdit">
                  <X class="h-3 w-3" />
                </Button>
              </div>

              <!-- Creation Date Subtitle -->
              <p class="text-[11px] text-slate-400 font-normal leading-tight flex items-center gap-1.5 mt-0.5">
                <Calendar class="h-3 w-3 opacity-70" />
                <span>Created {{ formattedDate }}</span>
              </p>
            </div>
          </div>

          <!-- Right: Actions Toolbar -->
          <div class="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" class="font-medium text-xs">
              {{ group.tabs.length }} tabs
            </Badge>

            <Button
              size="sm"
              variant="default"
              class="h-7 gap-1 px-2.5 text-xs font-medium shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              @click="handleOpenAll"
            >
              <ExternalLink class="h-3.5 w-3.5" />
              <span>Open All</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              class="h-7 px-2 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              title="Delete collection"
              aria-label="Delete collection"
              @click="showDeleteConfirm = true"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <!-- Tabs List Content -->
      <CardContent class="p-3">
        <!-- Empty State -->
        <div v-if="filteredTabs.length === 0" class="py-12 text-center text-slate-400 text-xs">
          <p v-if="group.tabs.length === 0">No tabs in this collection.</p>
          <p v-else>No tabs match your search query.</p>
        </div>

        <!-- Tab Rows List -->
        <div v-else class="flex flex-col divide-y divide-slate-100 max-h-[550px] overflow-y-auto pr-1">
          <div
            v-for="tab in filteredTabs"
            :key="tab.id"
            draggable="true"
            class="group/tab flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-slate-50 transition-colors select-none cursor-grab active:cursor-grabbing"
            @dragstart="handleDragStart($event, tab)"
          >
            <!-- Favicon + Title + Domain (Click to open tab) -->
            <div
              class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer mr-3"
              :title="tab.url"
              @click="handleOpenTab(tab)"
            >
              <!-- Drag Handle -->
              <GripVertical class="h-3.5 w-3.5 text-slate-300 group-hover/tab:text-slate-400 shrink-0 cursor-grab" />

              <!-- Favicon -->
              <div class="h-4 w-4 shrink-0 flex items-center justify-center">
                <img
                  v-if="!faviconErrors[tab.id] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                  :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                  class="h-4 w-4 rounded-xs object-contain"
                  alt=""
                  loading="lazy"
                  @error="handleFaviconError(tab.id)"
                />
                <Globe v-else class="h-3.5 w-3.5 text-slate-400" />
              </div>

              <!-- Title -->
              <span class="text-xs font-medium text-slate-800 group-hover/tab:text-indigo-600 truncate transition-colors">
                {{ tab.title || 'Untitled' }}
              </span>

              <!-- Domain -->
              <span
                v-if="getDomain(tab.url)"
                class="text-[11px] text-slate-400 font-normal shrink-0 ml-auto pr-2 hidden sm:inline"
              >
                {{ getDomain(tab.url) }}
              </span>
            </div>

            <!-- Single Tab Delete Button -->
            <button
              type="button"
              class="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
              title="Remove tab from collection"
              aria-label="Remove tab"
              @click.stop="handleDeleteTab(tab.id)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- Delete Confirmation Modal -->
    <Modal
      v-model:open="showDeleteConfirm"
      title="Delete Collection"
      description="Are you sure you want to delete this collection? This action cannot be undone."
    >
      <div class="text-sm text-slate-600">
        Collection: <span class="font-medium text-slate-900">{{ group.name || 'Untitled' }}</span> ({{ group.tabs.length }} tabs)
      </div>
      <template #footer>
        <Button variant="outline" size="sm" @click="showDeleteConfirm = false">Cancel</Button>
        <Button variant="destructive" size="sm" @click="confirmDeleteGroup">Delete Collection</Button>
      </template>
    </Modal>
  </div>
</template>
