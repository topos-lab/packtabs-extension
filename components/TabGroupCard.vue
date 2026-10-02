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
import { Card, CardContent, CardFooter, CardHeader } from '~/components/ui/card';
import Modal from '~/components/ui/dialog/Modal.vue';
import { Input } from '~/components/ui/input';
import { useToast } from '~/composables/useToast';
import { useTabStore } from '~/stores/useTabStore';
import type { TabGroup, TabItem } from '~/types/TabGroup';
import { normalizeTabs } from '~/utils/storage';
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

// Format creation date
const formattedDate = computed(() => {
  const date = props.group.createdAt;
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return String(date);
  }
});

const tabList = computed(() => normalizeTabs(props.group.tabs));

const tabCount = computed(() => tabList.value.length);

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
        summary: 'Success',
        detail: 'Group name updated successfully',
        life: 3000,
      });
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to update group name',
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

async function handleTabClick(tab: TabItem) {
  try {
    await openSingleTab(tab);
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to open tab',
      life: 3000,
    });
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
  <Card class="overflow-hidden border border-slate-200/90 hover:border-slate-300 transition-all duration-200 shadow-xs hover:shadow-md">
    <!-- Header -->
    <CardHeader class="p-4 pb-3 border-b border-slate-100 bg-slate-50/50">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <!-- Title & Inline Edit -->
          <div v-if="!isEditingTitle" class="flex items-center gap-2 group/title">
            <h3 class="text-base font-semibold text-slate-900 truncate">
              {{ group.name || 'History Tab Group' }}
            </h3>
            <button
              type="button"
              class="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded"
              title="Edit name"
              aria-label="Edit group name"
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

          <!-- Date Subtitle -->
          <div class="flex items-center gap-1.5 text-xs text-slate-500 mt-1 font-normal">
            <Calendar class="h-3.5 w-3.5 opacity-70" />
            <span>{{ formattedDate }}</span>
          </div>
        </div>

        <!-- Tab Count Badge -->
        <Badge :variant="group.isHistory ? 'secondary' : 'default'" class="shrink-0 font-medium">
          {{ tabCount }} tabs
        </Badge>
      </div>
    </CardHeader>

    <!-- Body: Tab List -->
    <CardContent class="p-3">
      <div class="flex flex-col divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
        <div
          v-for="tab in tabList"
          :key="tab.id"
          draggable="true"
          class="group/tab flex items-center justify-between py-2 px-2.5 rounded-md hover:bg-slate-50 transition-colors select-none cursor-grab active:cursor-grabbing"
          @dragstart="handleDragStart($event, tab)"
          @dragend="handleDragEnd"
        >
          <!-- Favicon + Title Link -->
          <div
            class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer mr-3"
            :title="tab.url"
            @click="handleTabClick(tab)"
          >
            <!-- Drag Handle with hover hint -->
            <div
              class="p-0.5 rounded text-slate-300 group-hover/tab:text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 transition-colors shrink-0 cursor-grab active:cursor-grabbing"
              title="Drag to left sidebar saved groups to categorize / 拖拽至左侧已保存的分组以分类"
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
              <Globe v-else class="h-3.5 w-3.5 text-slate-400" />
            </div>

            <!-- Title -->
            <span class="text-xs font-medium text-slate-800 group-hover/tab:text-indigo-600 truncate transition-colors">
              {{ tab.title || 'Untitled' }}
            </span>

            <!-- Domain name -->
            <span
              v-if="getDomain(tab.url)"
              class="text-[11px] text-slate-400 font-normal shrink-0 ml-auto pr-2 hidden sm:inline"
            >
              {{ getDomain(tab.url) }}
            </span>
          </div>

          <!-- Directly visible delete single tab button -->
          <button
            type="button"
            class="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
            title="Remove tab from group"
            aria-label="Delete tab"
            @click.stop="handleDeleteTab(tab.id)"
          >
            <X class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </CardContent>

    <!-- Footer: Actions -->
    <CardFooter class="p-3 pt-2 bg-slate-50/40 border-t border-slate-100 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <Button size="sm" variant="success" class="h-8 gap-1.5 text-xs font-medium" @click="handleOpenAll">
          <ExternalLink class="h-3.5 w-3.5" />
          Open All
        </Button>

        <Button
          v-if="group.isHistory"
          size="sm"
          variant="outline"
          class="h-8 gap-1.5 text-xs text-slate-700 font-medium"
          @click="handleSave"
        >
          <Save class="h-3.5 w-3.5 text-slate-500" />
          Save
        </Button>
      </div>

      <Button
        size="sm"
        variant="ghost"
        class="h-8 px-2.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-medium"
        @click="handleDeleteGroup"
      >
        <Trash2 class="h-3.5 w-3.5" />
        <span class="sr-only sm:not-sr-only sm:ml-1.5">Delete</span>
      </Button>
    </CardFooter>
  </Card>

  <!-- Name Input Dialog for History Group Conversion -->
  <Modal
    v-model:open="showNameDialog"
    title="Name Tab Group"
    description="Give this tab group a name to save it as a permanent collection."
  >
    <div class="space-y-4">
      <div>
        <label for="groupName" class="block text-xs font-medium text-slate-700 mb-1.5">
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
    <div class="text-sm text-slate-600">
      Group: <span class="font-medium text-slate-900">{{ group.name || 'History Tab Group' }}</span> ({{ tabCount }} tabs)
    </div>
    <template #footer>
      <Button variant="outline" size="sm" @click="showDeleteConfirm = false">Cancel</Button>
      <Button variant="destructive" size="sm" @click="confirmDeleteGroup">Delete</Button>
    </template>
  </Modal>
</template>
