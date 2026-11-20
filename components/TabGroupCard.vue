<script lang="ts" setup>
import {
  Calendar,
  Check,
  ExternalLink,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-vue-next';
import { computed, nextTick, ref } from 'vue';

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
  save: [groupId: string];
}>();

const tabStore = useTabStore();
const toast = useToast();

// Editable title state
const isEditingTitle = ref(false);
const editedTitle = ref(props.group.name ?? '');
const titleInputRef = ref<{ focus: () => void; select: () => void } | null>(null);

// Name input dialog state
const showNameDialog = ref(false);
const newGroupName = ref('');
const nameDialogInputRef = ref<{ focus: () => void } | null>(null);

// Confirm delete dialog state
const showDeleteConfirm = ref(false);

// Format creation date
const formattedDate = computed(() => formatFullDateTime(props.group.createdAt));

const displayTitle = computed(() => {
  if (props.group.name?.trim()) {
    return props.group.name.trim();
  }
  return formatFullDateTime(props.group.createdAt);
});

const tabList = computed(() => deduplicateTabsByUrl(normalizeTabs(props.group.tabs)));

const tabCount = computed(() => tabList.value.length);

async function startEditingTitle() {
  isEditingTitle.value = true;
  editedTitle.value = props.group.name ?? '';
  await nextTick();
  titleInputRef.value?.focus();
  titleInputRef.value?.select();
}

async function saveTitle() {
  const trimmed = editedTitle.value.trim();
  if (trimmed && trimmed !== props.group.name) {
    try {
      if (props.group.isHistory) {
        await tabStore.convertToNamed(props.group.id, trimmed);
        toast.add({
          severity: 'success',
          summary: t('savedTitle'),
          detail: t('savedAsNamedGroupDetail', { name: trimmed }),
          life: 3000,
        });
      } else {
        await tabStore.updateGroup(props.group.id, { name: trimmed });
        toast.add({
          severity: 'success',
          summary: t('successTitle'),
          detail: t('tabGroupNameUpdated'),
          life: 3000,
        });
      }
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('errorTitle'),
        detail: getLocalizedErrorMessage(
          error,
          props.group.isHistory ? t('saveGroupFailed') : t('updateGroupNameFailed')
        ),
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

async function handleDeleteTab(tabId: string) {
  try {
    await tabStore.deleteTab(props.group.id, tabId);
    toast.add({
      severity: 'success',
      detail: t('tabRemovedSuccess'),
      life: 2000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: getLocalizedErrorMessage(error, t('removeTabFailed')),
      life: 3000,
    });
  }
}

async function handleOpenAll() {
  if (tabList.value.length === 0) {
    return;
  }
  try {
    await openTabs(tabList.value);
    toast.add({
      severity: 'success',
      detail: t('restoredTabsSuccessShort', { count: tabList.value.length }),
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: getLocalizedErrorMessage(error, t('restoreTabsFailed')),
      life: 3000,
    });
  }
}

async function handleSave() {
  newGroupName.value = '';
  showNameDialog.value = true;
  await nextTick();
  nameDialogInputRef.value?.focus();
}

async function saveWithName() {
  if (newGroupName.value.trim()) {
    try {
      await tabStore.convertToNamed(props.group.id, newGroupName.value.trim());
      emit('save', props.group.id);
      showNameDialog.value = false;
      newGroupName.value = '';
      toast.add({
        severity: 'success',
        summary: t('savedTitle'),
        detail: t('groupConvertedSuccess'),
        life: 3000,
      });
    } catch (error) {
      toast.add({
        severity: 'error',
        detail: getLocalizedErrorMessage(error, t('saveGroupFailed')),
        life: 3000,
      });
    }
  }
}

function handleNameDialogKeydown(event: KeyboardEvent) {
  if (isImeComposing(event) || event.key !== 'Enter') {
    return;
  }
  event.preventDefault();
  void saveWithName();
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
      detail: t('tabGroupDeleted'),
      life: 3000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      detail: getLocalizedErrorMessage(error, t('deleteGroupFailed')),
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
            <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {{ displayTitle }}
            </h3>
            <button
              type="button"
              class="min-h-6 min-w-6 flex items-center justify-center opacity-0 group-hover/title:opacity-100 group-focus-within/title:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 rounded cursor-pointer"
              :title="group.isHistory ? t('saveAsNamedGroup') : t('editGroupName')"
              :aria-label="group.isHistory ? t('saveAsNamedGroup') : t('editGroupName')"
              @click="startEditingTitle"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
          </div>
          <div v-else class="flex items-center gap-2">
            <Input
              ref="titleInputRef"
              v-model="editedTitle"
              class="h-8 py-1 text-sm font-medium w-full max-w-sm"
              :aria-label="group.isHistory ? t('saveAsNamedGroup') : t('editGroupName')"
              :placeholder="group.isHistory ? t('enterNameToSavePlaceholder') : t('groupNameSimplePlaceholder')"
              @keydown="handleTitleKeydown"
              @blur="saveTitle"
            />
            <Button size="sm" class="h-8 px-2" :aria-label="t('save')" @mousedown.prevent @click="saveTitle">
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

        <!-- Right: Actions Toolbar & Tab Count Badge -->
        <div class="flex items-center gap-2 shrink-0">
          <Badge :variant="group.isHistory ? 'secondary' : 'default'" class="shrink-0 font-medium text-xs">
            {{ formatTabsCount(tabCount) }}
          </Badge>

          <Button
            size="sm"
            variant="default"
            class="h-7 text-xs font-medium gap-1.5 px-2.5"
            :disabled="tabCount === 0"
            @click="handleOpenAll"
          >
            <ExternalLink class="h-3.5 w-3.5" />
            <span>{{ t('openAll') }}</span>
          </Button>

          <Button
            v-if="group.isHistory"
            size="sm"
            variant="outline"
            class="h-7 gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium px-2.5"
            @click="handleSave"
          >
            <Save class="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>{{ t('save') }}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            class="h-7 px-2 text-xs text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-medium cursor-pointer"
            :title="t('deleteTabGroup')"
            :aria-label="t('deleteTabGroup')"
            @click="handleDeleteGroup"
          >
            <Trash2 class="h-3.5 w-3.5" />
            <span class="sr-only sm:not-sr-only sm:ml-1">{{ t('delete') }}</span>
          </Button>
        </div>
      </div>
    </CardHeader>

    <!-- Body: Tab List -->
    <CardContent class="p-3">
      <div v-if="tabList.length === 0" class="py-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
        {{ t('noTabsInGroup') }}
      </div>
      <div v-else role="list" class="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800/80 max-h-96 overflow-y-auto pr-1">
        <TabItemRow
          v-for="tab in tabList"
          :key="tab.id"
          :tab="tab"
          :source-group-id="group.id"
          :remove-title="t('removeTabFromGroup')"
          :remove-aria-label="t('deleteTabAria')"
          @remove="handleDeleteTab"
        />
      </div>
    </CardContent>
  </Card>

  <!-- Name Input Dialog for History Group Conversion -->
  <Modal
    v-model:open="showNameDialog"
    :title="t('nameGroupDialogTitle')"
    :description="t('nameGroupDialogDesc')"
  >
    <div class="space-y-4">
      <div>
        <label for="groupName" class="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          {{ t('groupNameLabel') }}
        </label>
        <Input
          id="groupName"
          ref="nameDialogInputRef"
          v-model="newGroupName"
          :placeholder="t('groupNameInputPlaceholder')"
          @keydown="handleNameDialogKeydown"
        />
      </div>
    </div>
    <template #footer>
      <Button variant="outline" size="sm" @click="showNameDialog = false">
        {{ t('cancel') }}
      </Button>
      <Button size="sm" :disabled="!newGroupName.trim()" @click="saveWithName">
        {{ t('saveGroup') }}
      </Button>
    </template>
  </Modal>

  <!-- Delete Confirmation Dialog -->
  <Modal
    v-model:open="showDeleteConfirm"
    :title="t('deleteConfirmTitle')"
    :description="t('deleteConfirmDesc')"
  >
    <div class="text-sm text-zinc-600 dark:text-zinc-400">
      {{ t('deleteGroupItemDescShort', { name: displayTitle, count: tabCount }) }}
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
</template>
