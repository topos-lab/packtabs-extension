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
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Tooltip } from '~/components/ui/tooltip';
import { useGroupActions } from '~/composables/useGroupActions';
import { formatTabsCount, t } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';
import { getLocalizedErrorMessage, useTabStore } from '~/stores/useTabStore';
import type { TabGroup } from '~/types/TabGroup';
import { formatFullDateTime } from '~/utils/date';
import { isImeComposing } from '~/utils/keyboard';
import { prepareTabsForDisplay } from '~/utils/tabManager';

const props = defineProps<{
  group: TabGroup;
}>();

const emit = defineEmits<{
  deleted: [];
}>();

const tabStore = useTabStore();
const toast = useToast();
const {
  openGroupInNewWindow,
  openGroupTabs,
  deleteGroupWithUndo,
  deleteTabWithUndo,
} = useGroupActions();

// Editable title
const isEditingTitle = ref(false);
const editedTitle = ref(props.group.name ?? '');
const titleInputRef = ref<{ focus: () => void; select: () => void } | null>(null);

watch(
  () => props.group.id,
  () => {
    isEditingTitle.value = false;
    editedTitle.value = props.group.name ?? '';
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

// Deduplicated and URL-sorted tabs list
const tabList = computed(() => prepareTabsForDisplay(props.group.tabs));

const totalTabsCount = computed(() => tabList.value.length);

// Open all tabs in new window
async function handleOpenInNewWindow() {
  await openGroupInNewWindow(tabList.value, { toastLife: 2500 });
}

// Open all tabs in current window (or new window with Shift)
async function handleOpenAll(event?: MouseEvent) {
  await openGroupTabs(tabList.value, {
    event,
    successDetailKey: 'restoredTabsSuccess',
    toastLife: 2500,
  });
}

// Delete single tab with 5s Undo toast
async function handleDeleteTab(tabId: string) {
  await deleteTabWithUndo(props.group, tabList.value, tabId, {
    detailKey: 'tabRemovedFromGroupSuccess',
    errorLife: 2500,
  });
}

// Delete group immediately with 5s Undo toast
async function handleDeleteGroup() {
  await deleteGroupWithUndo(props.group, {
    onDeleted: () => emit('deleted'),
    onRestored: (snapshot) => {
      tabStore.selectedGroupId = snapshot.id;
    },
    errorLife: 2500,
  });
}
</script>

<template>
  <div class="space-y-4">
    <!-- Unified Tab Group Card -->
    <Card class="overflow-hidden border border-zinc-200/90 dark:border-zinc-700/60 shadow-xs bg-white dark:bg-[#222226]">
      <!-- CardHeader: Integrated Title, Meta & Actions -->
      <CardHeader class="group/header px-4 pt-3.5 pb-2.5">
        <div class="flex items-center justify-between gap-4">
          <!-- Left: Folder Icon + Inline Editable Title + Date -->
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <Folder class="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />

            <div class="min-w-0 flex-1">
              <!-- Inline Editable Title -->
              <div v-if="!isEditingTitle" class="inline-flex items-center gap-1.5 max-w-full min-w-0">
                <h2 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight truncate min-w-0">
                  {{ group.name || t('untitledTabGroup') }}
                </h2>
                <Tooltip :content="t('renameTabGroup')">
                  <button
                    type="button"
                    class="min-h-6 min-w-6 shrink-0 flex items-center justify-center opacity-0 group-hover/header:opacity-100 group-has-[:focus-visible]/header:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity p-0.5 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 rounded cursor-pointer"
                    :aria-label="t('renameTabGroup')"
                    @click="startEditingTitle"
                  >
                    <Pencil class="h-3 w-3" />
                  </button>
                </Tooltip>
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
          <div class="flex items-center gap-1.5 shrink-0">
            <Tooltip :content="`${t('openAll')} (${formatTabsCount(totalTabsCount)})`">
              <Button
                size="sm"
                variant="ghost"
                class="h-7 px-2.5 text-xs font-medium bg-zinc-100/90 text-zinc-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-700/50 dark:text-zinc-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300 shadow-none transition-colors"
                :disabled="totalTabsCount === 0"
                @click="handleOpenAll($event)"
              >
                <span>{{ t('openAll') }}</span>
              </Button>
            </Tooltip>

            <Tooltip :content="t('openInNewWindow')">
              <Button
                size="sm"
                variant="ghost"
                data-open-new-window
                class="h-7 w-7 p-0 text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 shadow-none transition-colors cursor-pointer"
                :aria-label="t('openInNewWindow')"
                :disabled="totalTabsCount === 0"
                @click="handleOpenInNewWindow"
              >
                <ExternalLink class="h-3.5 w-3.5" />
              </Button>
            </Tooltip>

            <Tooltip :content="t('deleteTabGroup')">
              <Button
                size="sm"
                variant="ghost"
                class="h-7 w-7 p-0 text-xs text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                :aria-label="t('deleteTabGroup')"
                @click="handleDeleteGroup"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <!-- Tabs List Content -->
      <CardContent class="p-3 pt-0">
        <!-- Empty State -->
        <div v-if="tabList.length === 0" class="py-12 text-center text-zinc-400 dark:text-zinc-500 text-xs space-y-1.5">
          <p>{{ t('noTabsInGroup') }}</p>
          <p class="text-[11px] text-zinc-400/80 dark:text-zinc-500/80">
            {{ t('tabRowHint') }}
          </p>
        </div>

        <!-- Tab Rows List -->
        <template v-else>
          <div role="list" class="flex flex-col space-y-0.5">
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
          <p class="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/45 text-[11px] text-zinc-400 dark:text-zinc-500 px-2">
            {{ t('tabRowHint') }}
          </p>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
