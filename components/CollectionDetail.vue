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
import { Tooltip } from '~/components/ui/tooltip';
import { t } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';
import { useTabStore } from '~/stores/useTabStore';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { formatFullDateTime } from '~/utils/date';
import { normalizeTabs } from '~/utils/storage';
import { deduplicateTabsByUrl, getFaviconUrl, openSingleTab, openTabs } from '~/utils/tabManager';

function getDomain(url?: string): string {
  if (!url) {return '';}
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
        summary: t('updatedTitle'),
        detail: t('tabGroupNameUpdated'),
        life: 2500,
      });
    } catch {
      toast.add({
        severity: 'error',
        summary: t('errorTitle'),
        detail: t('updateNameFailed'),
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

// Date formatted with user locale
const formattedDate = computed(() => formatFullDateTime(props.group.createdAt));

// Total tabs count
const totalTabsCount = computed(() => {
  return deduplicateTabsByUrl(normalizeTabs(props.group.tabs)).length;
});

// Filtered tabs by search query
const filteredTabs = computed(() => {
  const tabsList = deduplicateTabsByUrl(normalizeTabs(props.group.tabs));

  if (!props.searchQuery?.trim()) {
    return tabsList;
  }
  const q = props.searchQuery.toLowerCase().trim();
  return tabsList.filter(
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
  if (!event.dataTransfer) {return;}
  tabStore.isDraggingTab = true;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/packtabs-tab',
    JSON.stringify({
      sourceGroupId: props.group.id,
      tab,
    })
  );
  // Avoid setting raw URL on text/plain, which triggers Chrome's native Split View / Side-by-side mode
  event.dataTransfer.setData('text/plain', `PackTabs: ${tab.title || tab.url}`);
}

function handleDragEnd() {
  tabStore.isDraggingTab = false;
}

// Open all tabs
async function handleOpenAll() {
  try {
    const tabsList = normalizeTabs(props.group.tabs);
    await openTabs(tabsList);
    toast.add({
      severity: 'success',
      detail: t('restoredTabsSuccess', { count: tabsList.length }),
      life: 2500,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: t('restoreTabsFailed'),
      life: 3000,
    });
  }
}

// Open single tab in background on Ctrl/Shift/Cmd + click
async function handleTabItemRowClick(event: MouseEvent, tab: TabItem) {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    try {
      await openSingleTab(tab, true);
      toast.add({
        severity: 'info',
        detail: t('openedBackgroundSuccess', { title: tab.title || t('untitled') }),
        life: 2000,
      });
    } catch {
      toast.add({
        severity: 'error',
        detail: t('openedBackgroundFailed'),
        life: 2500,
      });
    }
  }
}

// Delete tab
async function handleDeleteTab(tabId: string) {
  try {
    await tabStore.deleteTab(props.group.id, tabId);
    toast.add({
      severity: 'success',
      detail: t('tabRemovedFromGroupSuccess'),
      life: 2000,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: t('removeTabFailed'),
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
      detail: t('tabGroupDeleted'),
      life: 2500,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: t('deleteGroupFailed'),
      life: 2500,
    });
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Unified Tab Group Card -->
    <Card class="overflow-hidden border border-zinc-200/90 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900">
      <!-- CardHeader: Integrated Title, Meta & Actions -->
      <CardHeader class="p-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60">
        <div class="flex items-center justify-between gap-4">
          <!-- Left: Folder Icon + Inline Editable Title + Date -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <div class="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Folder class="h-4 w-4" />
            </div>

            <div class="min-w-0 flex-1">
              <!-- Inline Editable Title -->
              <div v-if="!isEditingTitle" class="flex items-center gap-2 group/title">
                <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                  {{ group.name || t('untitledTabGroup') }}
                </h2>
                <button
                  type="button"
                  class="opacity-0 group-hover/title:opacity-100 transition-opacity p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded cursor-pointer"
                  :title="t('renameTabGroup')"
                  :aria-label="t('renameTabGroup')"
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
              <p class="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-tight flex items-center gap-1.5 mt-0.5">
                <Calendar class="h-3 w-3 opacity-70" />
                <span>{{ t('createdDate', { date: formattedDate }) }}</span>
              </p>
            </div>
          </div>

          <!-- Right: Actions Toolbar -->
          <div class="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" class="font-medium text-xs">
              {{ t('tabsCount', { count: totalTabsCount }) }}
            </Badge>

            <Button
              size="sm"
              variant="default"
              class="h-7 gap-1 px-2.5 text-xs font-medium shadow-xs bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
              @click="handleOpenAll"
            >
              <ExternalLink class="h-3.5 w-3.5" />
              <span>{{ t('openAll') }}</span>
            </Button>

            <Button
              size="sm"
              variant="ghost"
              class="h-7 px-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
              :title="t('deleteTabGroup')"
              :aria-label="t('deleteTabGroup')"
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
        <div v-if="filteredTabs.length === 0" class="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs">
          <p v-if="totalTabsCount === 0">
            {{ t('noTabsInGroup') }}
          </p>
          <p v-else>
            {{ t('noMatchingTabs') }}
          </p>
        </div>

        <!-- Tab Rows List -->
        <div v-else class="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-[550px] overflow-y-auto pr-1">
          <Tooltip
            v-for="tab in filteredTabs"
            :key="tab.id"
            :content="[t('tooltipDragTab'), t('tooltipOpenBackground')]"
            side="top"
            :delay-duration="400"
          >
            <div
              draggable="true"
              class="group/tab flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors select-none cursor-move"
              @dragstart="handleDragStart($event, tab)"
              @dragend="handleDragEnd"
              @click="handleTabItemRowClick($event, tab)"
            >
              <!-- Favicon + Title + Domain (pointer-events-none for seamless drag) -->
              <div class="flex items-center gap-2 min-w-0 flex-1 mr-3 pointer-events-none">
                <!-- Drag Handle with hover hint -->
                <div
                  class="p-1 -ml-1 rounded text-zinc-400 dark:text-zinc-500 group-hover/tab:text-zinc-600 dark:group-hover/tab:text-zinc-300 transition-colors shrink-0 cursor-move active:cursor-move pointer-events-auto"
                >
                  <GripVertical class="h-3.5 w-3.5" />
                </div>

                <!-- Favicon -->
                <div class="h-4 w-4 shrink-0 flex items-center justify-center">
                  <img
                    v-if="!faviconErrors[tab.id] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                    :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                    class="h-4 w-4 rounded-xs object-contain"
                    alt=""
                    loading="lazy"
                    @error="handleFaviconError(tab.id)"
                  >
                  <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                </div>

                <!-- Title -->
                <span class="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors">
                  {{ tab.title || t('untitled') }}
                </span>

                <!-- Domain -->
                <span
                  v-if="getDomain(tab.url)"
                  class="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal shrink-0 ml-auto pr-2 hidden sm:inline"
                >
                  {{ getDomain(tab.url) }}
                </span>
              </div>

              <!-- Tab Row Actions: Remove tab only -->
              <div class="flex items-center shrink-0 pointer-events-auto">
                <button
                  type="button"
                  class="p-1 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors shrink-0 cursor-pointer"
                  :title="t('removeTabFromGroup')"
                  :aria-label="t('removeTabAria')"
                  @click.stop="handleDeleteTab(tab.id)"
                >
                  <X class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </Tooltip>
        </div>
      </CardContent>
    </Card>

    <!-- Delete Confirmation Modal -->
    <Modal
      v-model:open="showDeleteConfirm"
      :title="t('deleteConfirmTitle')"
      :description="t('deleteConfirmDesc')"
    >
      <div class="text-sm text-zinc-600 dark:text-zinc-400">
        {{ t('deleteGroupItemDesc', { name: group.name || t('untitledTabGroup'), count: totalTabsCount }) }}
      </div>
      <template #footer>
        <Button variant="outline" size="sm" @click="showDeleteConfirm = false">
          {{ t('cancel') }}
        </Button>
        <Button variant="destructive" size="sm" @click="confirmDeleteGroup">
          {{ t('delete') }}
        </Button>
      </template>
    </Modal>
  </div>
</template>
