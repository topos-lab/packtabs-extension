<script lang="ts" setup>
import {
  Calendar,
  Check,
  ExternalLink,
  Folder,
  Pencil,
  Trash2,
  X,
} from 'lucide-vue-next';
import { computed, nextTick, ref, watch } from 'vue';

import TabItemRow from '~/components/TabItemRow.vue';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import Modal from '~/components/ui/dialog/Modal.vue';
import { Input } from '~/components/ui/input';
import { formatTabsCount, t } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';
import { getLocalizedErrorMessage, useTabStore } from '~/stores/useTabStore';
import type { TabGroup } from '~/types/TabGroup';
import { formatFullDateTime } from '~/utils/date';
import { isImeComposing } from '~/utils/keyboard';
import { normalizeTabs } from '~/utils/storage';
import { deduplicateTabsByUrl, openTabs } from '~/utils/tabManager';

const props = defineProps<{
  group: TabGroup;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

const tabStore = useTabStore();
const toast = useToast();

// Editable title
const isEditingTitle = ref(false);
const editedTitle = ref(props.group.name ?? '');
const titleInputRef = ref<{ focus: () => void; select: () => void } | null>(null);
const showDeleteConfirm = ref(false);

watch(
  () => props.group.id,
  () => {
    isEditingTitle.value = false;
    editedTitle.value = props.group.name ?? '';
    showDeleteConfirm.value = false;
  }
);

async function startEditingTitle() {
  isEditingTitle.value = true;
  editedTitle.value = props.group.name ?? '';
  await nextTick();
  titleInputRef.value?.focus();
  titleInputRef.value?.select();
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
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('errorTitle'),
        detail: getLocalizedErrorMessage(error, t('updateNameFailed')),
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
  if (isImeComposing(event)) {
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    void saveTitle();
  } else if (event.key === 'Escape') {
    cancelEdit();
  }
}

// Date formatted with user locale
const formattedDate = computed(() => formatFullDateTime(props.group.createdAt));

// Deduplicated tabs list
const tabList = computed(() => deduplicateTabsByUrl(normalizeTabs(props.group.tabs)));

const totalTabsCount = computed(() => tabList.value.length);

// Open all tabs
async function handleOpenAll() {
  if (tabList.value.length === 0) {
    return;
  }
  try {
    await openTabs(tabList.value);
    toast.add({
      severity: 'success',
      detail: t('restoredTabsSuccess', { count: tabList.value.length }),
      life: 2500,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: getLocalizedErrorMessage(error, t('restoreTabsFailed')),
      life: 3000,
    });
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
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: getLocalizedErrorMessage(error, t('removeTabFailed')),
      life: 2500,
    });
  }
}

// Delete group modal
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
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: getLocalizedErrorMessage(error, t('deleteGroupFailed')),
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
                  class="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover/title:opacity-100 group-focus-within/title:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded cursor-pointer"
                  :title="t('renameTabGroup')"
                  :aria-label="t('renameTabGroup')"
                  @click="startEditingTitle"
                >
                  <Pencil class="h-3 w-3" />
                </button>
              </div>
              <div v-else class="flex items-center gap-1.5 max-w-sm">
                <Input
                  ref="titleInputRef"
                  v-model="editedTitle"
                  class="h-7 text-xs font-medium"
                  :aria-label="t('renameTabGroup')"
                  @keydown="handleTitleKeydown"
                  @blur="saveTitle"
                />
                <Button size="sm" class="h-7 px-2" :aria-label="t('save')" @mousedown.prevent @click="saveTitle">
                  <Check class="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" class="h-7 px-2" :aria-label="t('cancel')" @mousedown.prevent @click="cancelEdit">
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
              {{ formatTabsCount(totalTabsCount) }}
            </Badge>

            <Button
              size="sm"
              variant="default"
              class="h-7 gap-1 px-2.5 text-xs font-medium shadow-xs bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white"
              :disabled="totalTabsCount === 0"
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
        <div v-if="tabList.length === 0" class="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs space-y-1.5">
          <p>{{ t('noTabsInGroup') }}</p>
          <p class="text-[11px] text-zinc-400/80 dark:text-zinc-500/80">
            {{ t('tabRowHint') }}
          </p>
        </div>

        <!-- Tab Rows List -->
        <template v-else>
          <div role="list" class="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/80">
            <TabItemRow
              v-for="tab in tabList"
              :key="tab.id"
              :tab="tab"
              :source-group-id="group.id"
              :remove-title="t('removeTabFromGroup')"
              :remove-aria-label="t('removeTabAria')"
              @remove="handleDeleteTab"
            />
          </div>
          <p class="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 px-2">
            {{ t('tabRowHint') }}
          </p>
        </template>
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
