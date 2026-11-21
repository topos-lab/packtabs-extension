<script lang="ts" setup>
import {
  BookmarkPlus,
  Calendar,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
  X,
} from 'lucide-vue-next';
import { computed, nextTick, ref } from 'vue';

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
  save: [groupId: string];
}>();

const tabStore = useTabStore();
const toast = useToast();
const {
  openGroupInNewWindow,
  openGroupTabs,
  deleteGroupWithUndo,
  deleteTabWithUndo,
  convertHistoryToNamedWithUndo,
} = useGroupActions();

// Editable title state (also used for inline history conversion)
const isEditingTitle = ref(false);
const editedTitle = ref(props.group.name ?? '');
const titleInputRef = ref<{ focus: () => void; select: () => void } | null>(null);

// Format creation date
const formattedDate = computed(() => formatFullDateTime(props.group.createdAt));

const displayTitle = computed(() => {
  if (props.group.name?.trim()) {
    return props.group.name.trim();
  }
  return formatFullDateTime(props.group.createdAt);
});

const tabList = computed(() => prepareTabsForDisplay(props.group.tabs));

const tabCount = computed(() => tabList.value.length);

async function startEditingTitle() {
  isEditingTitle.value = true;
  editedTitle.value = props.group.name ?? '';
  await nextTick();
  titleInputRef.value?.focus();
  titleInputRef.value?.select();
}

async function saveTitle(allowDefaultFallback = false) {
  const trimmed = editedTitle.value.trim();

  if (props.group.isHistory) {
    if (!trimmed && !allowDefaultFallback) {
      cancelEdit();
      return;
    }
    await convertHistoryToNamedWithUndo(props.group, editedTitle.value, {
      allowDefaultFallback,
      onConverted: (groupId) => emit('save', groupId),
    });
    isEditingTitle.value = false;
    return;
  }

  if (trimmed && trimmed !== props.group.name) {
    try {
      await tabStore.updateGroup(props.group.id, { name: trimmed });
      toast.add({
        severity: 'success',
        summary: t('successTitle'),
        detail: t('tabGroupNameUpdated'),
        life: 3000,
      });
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('errorTitle'),
        detail: getLocalizedErrorMessage(error, t('updateGroupNameFailed')),
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
    void saveTitle(true);
  } else if (event.key === 'Escape') {
    cancelEdit();
  }
}

async function handleDeleteTab(tabId: string) {
  await deleteTabWithUndo(props.group, tabList.value, tabId);
}

async function handleOpenInNewWindow() {
  await openGroupInNewWindow(tabList.value);
}

async function handleOpenAll(event?: MouseEvent) {
  await openGroupTabs(tabList.value, { event });
}

async function handleDeleteGroup() {
  await deleteGroupWithUndo(props.group);
}

defineExpose({
  saveTitle,
});
</script>

<template>
  <Card class="overflow-hidden border border-zinc-200/90 dark:border-zinc-700/60 hover:border-zinc-300 dark:hover:border-zinc-600/80 transition-all duration-200 shadow-xs hover:shadow-md bg-white dark:bg-[#222226]">
    <!-- Header -->
    <CardHeader class="group/header px-4 pt-3.5 pb-2.5">
      <div class="flex items-center justify-between gap-4">
        <!-- Left: Title & Inline Edit + Subtitle -->
        <div class="flex-1 min-w-0">
          <div v-if="!isEditingTitle" class="inline-flex items-center gap-1.5 max-w-full min-w-0">
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate min-w-0">
              {{ displayTitle }}
            </h3>
            <Tooltip :content="group.isHistory ? t('saveAsNamedGroup') : t('editGroupName')">
              <button
                type="button"
                class="min-h-6 min-w-6 shrink-0 flex items-center justify-center opacity-0 group-hover/header:opacity-100 group-has-[:focus-visible]/header:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity p-1 rounded cursor-pointer"
                :class="
                  group.isHistory
                    ? 'text-zinc-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20'
                    : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                "
                :aria-label="group.isHistory ? t('saveAsNamedGroup') : t('editGroupName')"
                @click="startEditingTitle"
              >
                <BookmarkPlus v-if="group.isHistory" class="h-3.5 w-3.5" />
                <Pencil v-else class="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          </div>
          <div v-else class="flex items-center gap-2">
            <Input
              ref="titleInputRef"
              v-model="editedTitle"
              class="h-8 py-1 text-xs font-medium w-full max-w-sm"
              :aria-label="group.isHistory ? t('saveAsNamedGroup') : t('editGroupName')"
              :placeholder="group.isHistory ? t('groupNamePlaceholder') : t('groupNameSimplePlaceholder')"
              @keydown="handleTitleKeydown"
              @blur="saveTitle(false)"
            />
            <Button size="sm" class="h-8 px-2" :aria-label="t('save')" @mousedown.prevent @click="saveTitle(true)">
              <Check class="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" class="h-8 px-2" :aria-label="t('cancel')" @mousedown.prevent @click="cancelEdit">
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>

          <!-- Date Subtitle (only shown when group has custom name) -->
          <div v-if="group.name" class="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-normal">
            <Calendar class="h-3.5 w-3.5 opacity-70" />
            <span>{{ t('createdDate', { date: formattedDate }) }}</span>
          </div>
        </div>

        <!-- Right: Actions Toolbar -->
        <div class="flex items-center gap-1.5 shrink-0">
          <Tooltip :content="`${t('openAll')} (${formatTabsCount(tabCount)})`">
            <Button
              size="sm"
              variant="ghost"
              class="h-7 px-2.5 text-xs font-medium bg-zinc-100/90 text-zinc-700 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-700/50 dark:text-zinc-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-300 shadow-none transition-colors"
              :disabled="tabCount === 0"
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
              :disabled="tabCount === 0"
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
              <span class="sr-only">{{ t('delete') }}</span>
            </Button>
          </Tooltip>
        </div>
      </div>
    </CardHeader>

    <!-- Body: Tab List -->
    <CardContent class="p-3 pt-0">
      <div v-if="tabList.length === 0" class="py-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
        {{ t('noTabsInGroup') }}
      </div>
      <div v-else role="list" class="flex flex-col space-y-0.5 max-h-96 overflow-y-auto">
        <TabItemRow
          v-for="tab in tabList"
          :key="tab.id"
          :tab="tab"
          :source-group-id="group.id"
          :source-is-history="Boolean(group.isHistory)"
          :remove-title="t('removeTabFromGroup')"
          :remove-aria-label="t('deleteTabAria')"
          @remove="handleDeleteTab"
        />
      </div>
    </CardContent>
  </Card>
</template>
