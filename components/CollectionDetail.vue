<script lang="ts" setup>
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  Folder,
  Globe,
  Pencil,
  Trash2,
  X,
} from 'lucide-vue-next';
import { computed, ref } from 'vue';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
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

// Copy all links as Markdown
async function copyAllLinks() {
  try {
    const text = props.group.tabs.map((t) => `- [${t.title || 'Link'}](${t.url})`).join('\n');
    await navigator.clipboard.writeText(text);
    toast.add({
      severity: 'success',
      summary: 'Copied',
      detail: `Copied ${props.group.tabs.length} links to clipboard as Markdown`,
      life: 2500,
    });
  } catch {
    toast.add({
      severity: 'error',
      detail: 'Failed to copy links',
      life: 2500,
    });
  }
}

// Copy single link
async function copySingleLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      severity: 'success',
      detail: 'URL copied to clipboard',
      life: 2000,
    });
  } catch {
    // fallback
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
  <div class="space-y-6 w-full animate-in fade-in duration-200">
    <!-- Hero Banner / Collection Header -->
    <div class="bg-white rounded-xl border border-slate-200/90 p-5 sm:p-6 shadow-xs">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <!-- Collection Icon + Title + Meta -->
        <div class="flex items-start gap-4 min-w-0">
          <div class="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 shrink-0">
            <Folder class="h-6 w-6" />
          </div>

          <div class="space-y-1.5 min-w-0 flex-1">
            <!-- Inline Editable Title -->
            <div v-if="!isEditingTitle" class="flex items-center gap-2 group/title">
              <h2 class="text-xl font-bold text-slate-900 tracking-tight truncate">
                {{ group.name || 'Untitled Collection' }}
              </h2>
              <button
                type="button"
                class="opacity-0 group-hover/title:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                title="Rename collection"
                @click="startEditingTitle"
              >
                <Pencil class="h-4 w-4" />
              </button>
            </div>
            <div v-else class="flex items-center gap-2 max-w-md">
              <Input
                v-model="editedTitle"
                class="h-8 text-base font-semibold"
                autofocus
                @keydown="handleTitleKeydown"
                @blur="saveTitle"
              />
              <Button size="sm" class="h-8 px-2.5" @click="saveTitle">
                <Check class="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" class="h-8 px-2.5" @click="cancelEdit">
                <X class="h-4 w-4" />
              </Button>
            </div>

            <!-- Meta info: Date & Tab Count -->
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <div class="flex items-center gap-1.5">
                <Calendar class="h-3.5 w-3.5 text-slate-400" />
                <span>Created {{ formattedDate }}</span>
              </div>
              <span>•</span>
              <Badge variant="secondary" class="font-medium text-xs">
                {{ group.tabs.length }} tabs saved
              </Badge>
            </div>
          </div>
        </div>

        <!-- Action Toolbar -->
        <div class="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
          <Button
            size="sm"
            variant="default"
            class="h-9 gap-1.5 text-xs font-medium shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            @click="handleOpenAll"
          >
            <ExternalLink class="h-4 w-4" />
            <span>Open All Tabs</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            class="h-9 gap-1.5 text-xs text-slate-700 font-medium hover:bg-slate-50"
            title="Copy all links as Markdown"
            @click="copyAllLinks"
          >
            <Copy class="h-3.5 w-3.5 text-slate-500" />
            <span class="hidden md:inline">Copy All Links</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            class="h-9 px-2.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            title="Delete collection"
            @click="showDeleteConfirm = true"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Tabs List Card -->
    <div class="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 class="text-xs font-semibold text-slate-700 uppercase tracking-wider">
          Saved Tabs in Collection
        </h3>
        <span class="text-xs text-slate-400 font-medium">
          Showing {{ filteredTabs.length }} of {{ group.tabs.length }} tabs
        </span>
      </div>

      <!-- Empty State -->
      <div v-if="filteredTabs.length === 0" class="py-16 text-center text-slate-400 text-xs">
        <p v-if="group.tabs.length === 0">No tabs in this collection.</p>
        <p v-else>No tabs match your search query.</p>
      </div>

      <!-- Tab Items -->
      <div v-else class="divide-y divide-slate-100">
        <div
          v-for="tab in filteredTabs"
          :key="tab.id"
          class="group/tab flex items-center justify-between px-5 py-3 hover:bg-slate-50/80 transition-colors"
        >
          <!-- Favicon + Title + Domain -->
          <div
            class="flex items-center gap-3 min-w-0 flex-1 cursor-pointer mr-4"
            :title="tab.url"
            @click="handleOpenTab(tab)"
          >
            <!-- Favicon -->
            <div class="h-5 w-5 shrink-0 flex items-center justify-center">
              <img
                v-if="!faviconErrors[tab.id] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                class="h-4 w-4 rounded-xs object-contain"
                alt=""
                loading="lazy"
                @error="handleFaviconError(tab.id)"
              />
              <Globe v-else class="h-4 w-4 text-slate-400" />
            </div>

            <!-- Title -->
            <span class="text-xs font-medium text-slate-800 group-hover/tab:text-indigo-600 truncate transition-colors">
              {{ tab.title || 'Untitled' }}
            </span>

            <!-- Domain Badge -->
            <span
              v-if="getDomain(tab.url)"
              class="text-[11px] text-slate-400 font-normal shrink-0 ml-auto pr-3 hidden sm:inline"
            >
              {{ getDomain(tab.url) }}
            </span>
          </div>

          <!-- Quick Actions -->
          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              class="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
              title="Copy URL"
              @click.stop="copySingleLink(tab.url)"
            >
              <Copy class="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
              title="Open in new tab"
              @click.stop="handleOpenTab(tab)"
            >
              <ExternalLink class="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              class="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
              title="Remove tab from collection"
              @click.stop="handleDeleteTab(tab.id)"
            >
              <X class="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

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
