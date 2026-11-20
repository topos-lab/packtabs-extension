<script lang="ts" setup>
import { Globe, GripVertical, X } from 'lucide-vue-next';
import { ref, watch } from 'vue';

import { Tooltip } from '~/components/ui/tooltip';
import { useI18n } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';
import { useTabStore } from '~/stores/useTabStore';
import type { TabItem } from '~/types/TabGroup';
import { getDomain, getFaviconUrl, openSingleTab } from '~/utils/tabManager';

const props = withDefaults(
  defineProps<{
    tab: TabItem;
    sourceGroupId: string;
    removeTitle: string;
    removeAriaLabel: string;
    draggable?: boolean;
  }>(),
  {
    draggable: true,
  }
);

const emit = defineEmits<{
  remove: [tabId: string];
}>();

const tabStore = useTabStore();
const toast = useToast();
const { t } = useI18n();

const faviconFailed = ref(false);
const titleRef = ref<HTMLElement | null>(null);
const isTitleOverflowing = ref(false);

watch(
  () => [props.tab.url, props.tab.faviconUrl, props.tab.title],
  () => {
    faviconFailed.value = false;
    isTitleOverflowing.value = false;
  }
);

function updateOverflowState() {
  const el = titleRef.value;
  isTitleOverflowing.value = Boolean(el && el.scrollWidth > el.clientWidth);
}

async function openTab(inBackground: boolean) {
  try {
    await openSingleTab(props.tab, inBackground);
    if (inBackground) {
      toast.add({
        severity: 'info',
        detail: t('openedBackgroundSuccess', { title: props.tab.title || t('untitled') }),
        life: 2000,
      });
    }
  } catch {
    toast.add({
      severity: 'error',
      detail: t('openedBackgroundFailed'),
      life: 3000,
    });
  }
}

async function handleRowClick(event: MouseEvent) {
  const inBackground = event.ctrlKey || event.metaKey || event.shiftKey;
  await openTab(inBackground);
}

async function handleMiddleClick(event: MouseEvent) {
  if (event.button === 1) {
    event.preventDefault();
    await openTab(true);
  }
}

function handleDragStart(event: DragEvent) {
  if (!props.draggable || !event.dataTransfer) {
    return;
  }
  tabStore.isDraggingTab = true;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData(
    'application/packtabs-tab',
    JSON.stringify({
      sourceGroupId: props.sourceGroupId,
      tab: props.tab,
    })
  );
  // Avoid setting raw URL on text/plain, which triggers Chrome's native Split View / Side-by-side mode
  event.dataTransfer.setData('text/plain', `PackTabs: ${props.tab.title || props.tab.url}`);
}

function handleDragEnd() {
  tabStore.isDraggingTab = false;
}
</script>

<template>
  <div
    :draggable="draggable"
    role="listitem"
    class="group/tab flex items-center justify-between gap-1 py-1.5 px-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors cursor-move"
    @dragstart="handleDragStart"
    @dragend="handleDragEnd"
  >
    <Tooltip
      :disabled="!isTitleOverflowing"
      :content="[tab.title || t('untitled'), tab.url]"
      side="top"
      :delay-duration="350"
    >
      <button
        type="button"
        class="flex items-center gap-2 min-w-0 flex-1 py-0.5 px-0.5 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
        @mouseenter="updateOverflowState"
        @focus="updateOverflowState"
        @click="handleRowClick"
        @auxclick="handleMiddleClick"
      >
        <!-- Drag Handle -->
        <span
          aria-hidden="true"
          class="p-0.5 -ml-0.5 rounded text-zinc-400 dark:text-zinc-500 group-hover/tab:text-zinc-600 dark:group-hover/tab:text-zinc-300 transition-colors shrink-0 select-none cursor-move"
        >
          <GripVertical class="h-3.5 w-3.5" />
        </span>

        <!-- Favicon -->
        <span class="h-4 w-4 shrink-0 flex items-center justify-center">
          <img
            v-if="!faviconFailed && (tab.faviconUrl || getFaviconUrl(tab.url))"
            :src="tab.faviconUrl || getFaviconUrl(tab.url)"
            class="h-4 w-4 rounded-xs object-contain"
            alt=""
            loading="lazy"
            @error="faviconFailed = true"
          >
          <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
        </span>

        <!-- Title -->
        <span
          ref="titleRef"
          class="text-xs font-medium text-zinc-800 dark:text-zinc-200 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors"
        >
          {{ tab.title || t('untitled') }}
        </span>

        <!-- Domain -->
        <span
          v-if="getDomain(tab.url)"
          class="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal shrink-0 ml-auto pr-1 hidden sm:inline"
        >
          {{ getDomain(tab.url) }}
        </span>
      </button>
    </Tooltip>

    <!-- Tab Row Actions: Remove / Exclude tab -->
    <button
      type="button"
      class="min-h-6 min-w-6 flex items-center justify-center p-1 text-zinc-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded transition-colors shrink-0 select-none cursor-pointer"
      :title="removeTitle"
      :aria-label="removeAriaLabel"
      @click="emit('remove', tab.id)"
    >
      <X class="h-3.5 w-3.5" />
    </button>
  </div>
</template>
