<script lang="ts" setup>
import {
  Calendar,
  Check,
  ExternalLink,
  Globe,
  GripVertical,
  Pencil,
  Plus,
  Save,
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
import { useToast } from '~/composables/useToast';
import { useTabStore } from '~/stores/useTabStore';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { normalizeTabs } from '~/utils/storage';
import { deduplicateTabsByUrl, getFaviconUrl, openSingleTab, openTabs } from '~/utils/tabManager';

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
}>();

const emit = defineEmits<{
  save: [groupId: string];
}>();

const tabStore = useTabStore();
const toast = useToast();

// Editable title state
const isEditingTitle = ref(false);
const editedTitle = ref(props.group.name ?? '');

// Name input dialog state
const showNameDialog = ref(false);
const newGroupName = ref('');

// Confirm delete dialog state
const showDeleteConfirm = ref(false);

// Favicon error tracking
const faviconErrorStates = ref<Record<string, boolean>>({});

function handleFaviconError(tabId: string) {
  faviconErrorStates.value[tabId] = true;
}

// Localized formatting for display title when unnamed
function formatLocalizedDateTime(dateInput: Date | string | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const userLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    return new Intl.DateTimeFormat(userLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    const d = new Date(dateInput);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

// Format creation date
const formattedDate = computed(() => {
  const date = props.group.createdAt;
  try {
    const userLocale = typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
    return new Intl.DateTimeFormat(userLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(date));
  } catch {
    return String(date);
  }
});

const displayTitle = computed(() => {
  if (props.group.name?.trim()) {
    return props.group.name.trim();
  }
  return formatLocalizedDateTime(props.group.createdAt);
});

const tabList = computed(() => deduplicateTabsByUrl(normalizeTabs(props.group.tabs)));

const tabCount = computed(() => tabList.value.length);

function startEditingTitle() {
  isEditingTitle.value = true;
  editedTitle.value = props.group.name ?? '';
}

async function saveTitle() {
  const trimmed = editedTitle.value.trim();
  if (trimmed && trimmed !== props.group.name) {
    try {
      if (props.group.isHistory) {
        await tabStore.convertToNamed(props.group.id, trimmed);
        toast.add({
          severity: 'success',
          summary: 'Saved',
          detail: `Saved as "${trimmed}" in Saved Groups`,
          life: 3000,
        });
      } else {
        await tabStore.updateGroup(props.group.id, { name: trimmed });
        toast.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Group name updated successfully',
          life: 3000,
        });
      }
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: props.group.isHistory ? 'Failed to save group' : 'Failed to update group name',
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

async function handleTabItemRowClick(event: MouseEvent, tab: TabItem) {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    try {
      await openSingleTab(tab, true);
      toast.add({
        severity: 'info',
        detail: `Opened "${tab.title || 'tab'}" in background`,
        life: 2000,
      });
    } catch {
      toast.add({
        severity: 'error',
        detail: 'Failed to open tab in background',
        life: 3000,
      });
    }
  }
}

async function handleDeleteTab(tabId: string) {
  try {
    await tabStore.deleteTab(props.group.id, tabId);
    toast.add({
      severity: 'success',
      detail: 'Tab removed',
      life: 2000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: 'Failed to remove tab',
      life: 3000,
    });
  }
}

// Drag & drop tab categorization
function handleDragStart(event: DragEvent, tab: TabItem) {
  if (!event.dataTransfer) return;
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

async function handleOpenAll() {
  try {
    await openTabs(tabList.value);
    toast.add({
      severity: 'success',
      detail: `Restored ${tabList.value.length} tabs`,
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: 'Failed to restore tabs',
      life: 3000,
    });
  }
}

function handleSave() {
  newGroupName.value = '';
  showNameDialog.value = true;
  emit('save', props.group.id);
}

async function saveWithName() {
  if (newGroupName.value.trim()) {
    try {
      await tabStore.convertToNamed(props.group.id, newGroupName.value.trim());
      showNameDialog.value = false;
      newGroupName.value = '';
      toast.add({
        severity: 'success',
        summary: 'Saved',
        detail: 'Group converted to permanent named group',
        life: 3000,
      });
    } catch (error) {
      toast.add({
        severity: 'error',
        detail: 'Failed to save group',
        life: 3000,
      });
    }
  }
}

function handleDeleteGroup() {
  showDeleteConfirm.value = true;
}

async function confirmDeleteGroup() {
  try {
    await tabStore.deleteGroup(props.group.id);
    showDeleteConfirm.value = false;
    toast.add({
      severity: 'success',
      detail: 'Tab group deleted',
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: 'Failed to delete group',
      life: 3000,
    });
  }
}
</script>

<template>
  <Card class="overflow-hidden border border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-200 shadow-xs hover:shadow-md bg-white dark:bg-zinc-900">
    <!-- Header -->
    <CardHeader class="p-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/60">
      <div class="flex items-center justify-between gap-4">
        <!-- Left: Title & Inline Edit + Subtitle -->
        <div class="flex-1 min-w-0">
          <div v-if="!isEditingTitle" class="flex items-center gap-2 group/title">
            <h3 class="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {{ displayTitle }}
            </h3>
            <button
              type="button"
              class="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded cursor-pointer"
              :title="group.isHistory ? 'Save as named group' : 'Edit group name'"
              :aria-label="group.isHistory ? 'Save as named group' : 'Edit group name'"
              @click="startEditingTitle"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <Input
              v-model="editedTitle"
              class="h-8 py-1 text-sm font-medium w-full max-w-sm"
              autofocus
              :placeholder="group.isHistory ? 'Enter name to save group...' : 'Group name...'"
              @keydown="handleTitleKeydown"
              @blur="saveTitle"
            />
            <Button size="sm" class="h-8 px-2" @click="saveTitle">
              <Check class="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" class="h-8 px-2" @click="cancelEdit">
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>

          <!-- Date Subtitle (only shown when group has custom name) -->
          <div v-if="group.name" class="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
            <Calendar class="h-3.5 w-3.5 opacity-70" />
            <span>Created {{ formattedDate }}</span>
          </div>
        </div>

        <!-- Right: Actions Toolbar & Tab Count Badge -->
        <div class="flex items-center gap-2 shrink-0">
          <Badge :variant="group.isHistory ? 'secondary' : 'default'" class="shrink-0 font-medium text-xs">
            {{ tabCount }} tabs
          </Badge>

          <Button
            size="sm"
            variant="success"
            class="h-7 text-xs font-medium gap-1.5 px-2.5"
            @click="handleOpenAll"
          >
            <ExternalLink class="h-3.5 w-3.5" />
            <span>Open All</span>
          </Button>

          <Button
            v-if="group.isHistory"
            size="sm"
            variant="outline"
            class="h-7 gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium px-2.5"
            @click="handleSave"
          >
            <Save class="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>Save</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            class="h-7 px-2 text-xs text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium"
            title="Delete tab group"
            aria-label="Delete tab group"
            @click="handleDeleteGroup"
          >
            <Trash2 class="h-3.5 w-3.5" />
            <span class="sr-only sm:not-sr-only sm:ml-1">Delete</span>
          </Button>
        </div>
      </div>
    </CardHeader>

    <!-- Body: Tab List -->
    <CardContent class="p-3">
      <div class="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-96 overflow-y-auto pr-1">
        <Tooltip
          v-for="tab in tabList"
          :key="tab.id"
          :content="['Drag tab to categorize into group', 'Ctrl / Cmd / Shift + Click to open in background']"
          side="top"
          :delay-duration="400"
        >
          <div
            draggable="true"
            class="group/tab flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors select-none cursor-pointer"
            @dragstart="handleDragStart($event, tab)"
            @dragend="handleDragEnd"
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

              <!-- Favicon -->
              <div class="h-4 w-4 shrink-0 flex items-center justify-center">
                <img
                  v-if="!faviconErrorStates[tab.id] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                  :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                  class="h-4 w-4 rounded-xs object-contain"
                  alt=""
                  loading="lazy"
                  @error="handleFaviconError(tab.id)"
                />
                <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              </div>

              <!-- Title -->
              <span class="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors">
                {{ tab.title || 'Untitled' }}
              </span>

              <!-- Domain name -->
              <span
                v-if="getDomain(tab.url)"
                class="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal shrink-0 ml-auto pr-2 hidden sm:inline"
              >
                {{ getDomain(tab.url) }}
              </span>
            </div>

            <!-- Tab Actions: Remove tab only -->
            <div class="flex items-center shrink-0 pointer-events-auto">
              <button
                type="button"
                class="p-1 text-zinc-300 dark:text-zinc-600 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors shrink-0 cursor-pointer"
                title="Remove tab from group"
                aria-label="Delete tab"
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

  <!-- Name Input Dialog for History Group Conversion -->
  <Modal
    v-model:open="showNameDialog"
    title="Name Tab Group"
    description="Give this tab group a name to save it to your saved tab groups."
  >
    <div class="space-y-4">
      <div>
        <label for="groupName" class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Group Name
        </label>
        <Input
          id="groupName"
          v-model="newGroupName"
          autofocus
          placeholder="e.g. Research, Project Alpha, Work"
          @keydown.enter="saveWithName"
        />
      </div>
    </div>
    <template #footer>
      <Button variant="outline" size="sm" @click="showNameDialog = false">Cancel</Button>
      <Button size="sm" :disabled="!newGroupName.trim()" @click="saveWithName">
        Save Group
      </Button>
    </template>
  </Modal>

  <!-- Delete Confirmation Dialog -->
  <Modal
    v-model:open="showDeleteConfirm"
    title="Delete Tab Group"
    description="Are you sure you want to delete this tab group? This action cannot be undone."
  >
    <div class="text-sm text-zinc-600 dark:text-zinc-400">
      Group: <span class="font-medium text-zinc-900 dark:text-zinc-200">{{ displayTitle }}</span> ({{ tabCount }} tabs)
    </div>
    <template #footer>
      <Button variant="outline" size="sm" @click="showDeleteConfirm = false">Cancel</Button>
      <Button variant="destructive" size="sm" @click="confirmDeleteGroup">Delete</Button>
    </template>
  </Modal>
</template>
