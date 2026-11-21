<script lang="ts" setup>
  import { Globe, X } from 'lucide-vue-next';
  import { computed, ref } from 'vue';

  import { Tooltip } from '~/components/ui/tooltip';
  import { useI18n } from '~/composables/useI18n';
  import type { TabItem } from '~/types/TabGroup';
  import { getFaviconUrl } from '~/utils/tabManager';

  const props = withDefaults(
    defineProps<{
      tabs: TabItem[];
      isExpanded: boolean;
      maxVisibleTabs?: number;
      collapseThreshold?: number;
    }>(),
    {
      maxVisibleTabs: 8,
      collapseThreshold: 9,
    }
  );

  const emit = defineEmits<{
    'drag-start': [event: DragEvent, tab: TabItem];
    'drag-end': [];
    'open-tab': [event: MouseEvent, tab: TabItem];
    'middle-click-tab': [event: MouseEvent, tab: TabItem];
    'delete-tab': [tabId: string];
    'toggle-expand': [];
  }>();

  const { t } = useI18n();

  const faviconErrors = ref<Record<string, boolean>>({});
  const overflowingTabIds = ref<Record<string, boolean>>({});

  const visibleTabs = computed(() => {
    if (props.isExpanded || props.tabs.length <= props.collapseThreshold) {
      return props.tabs;
    }
    return props.tabs.slice(0, props.maxVisibleTabs);
  });

  const hasHiddenTabs = computed(() => props.tabs.length > props.collapseThreshold);

  const expandToggleLabel = computed(() => {
    if (props.isExpanded) {
      return t('showLess');
    }
    const remaining = props.tabs.length - props.maxVisibleTabs;
    return remaining === 1 ? t('remainingTabSingle') : t('remainingTabsCount', { count: remaining });
  });

  function handleFaviconError(tabId: string) {
    faviconErrors.value[tabId] = true;
  }

  function checkTitleOverflow(tabId: string, event: Event) {
    const btn = event.currentTarget as HTMLElement | null;
    const titleEl = btn?.querySelector('[data-tab-title]') as HTMLElement | null;
    overflowingTabIds.value[tabId] = Boolean(titleEl && titleEl.scrollWidth > titleEl.clientWidth);
  }
</script>

<template>
  <div class="space-y-0.5">
    <div
      v-for="tab in visibleTabs"
      :key="tab.id"
      role="listitem"
      draggable="true"
      class="group/tab flex items-center gap-1 rounded hover:bg-zinc-100/80 dark:hover:bg-zinc-700/45 transition-colors cursor-pointer"
      @dragstart="emit('drag-start', $event, tab)"
      @dragend="emit('drag-end')">
      <Tooltip
        :disabled="!overflowingTabIds[tab.id]"
        :content="[tab.title || t('untitled'), tab.url]"
        side="top"
      >
        <button
          type="button"
          data-tab-open
          class="min-w-0 flex-1 text-left flex items-center py-1 px-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
          @mouseenter="checkTitleOverflow(tab.id, $event)"
          @focus="checkTitleOverflow(tab.id, $event)"
          @click="emit('open-tab', $event, tab)"
          @auxclick="emit('middle-click-tab', $event, tab)">
          <span class="flex items-center gap-2 min-w-0 flex-1">
            <span class="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
              <img
                v-if="!faviconErrors[tab.id] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                class="h-3.5 w-3.5 rounded-2xs object-contain"
                alt=""
                loading="lazy"
                @error="handleFaviconError(tab.id)">
              <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
            </span>
            <span
              data-tab-title
              class="text-xs text-zinc-700 dark:text-zinc-300 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors">
              {{ tab.title || t('untitled') }}
            </span>
          </span>
        </button>
      </Tooltip>

      <Tooltip :content="t('removeTabFromGroup')">
        <button
          type="button"
          data-delete-tab
          class="h-7 w-7 mr-1 shrink-0 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 opacity-0 group-hover/tab:opacity-100 group-has-[:focus-visible]/tab:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-opacity cursor-pointer"
          :aria-label="t('removeTabAria')"
          @click="emit('delete-tab', tab.id)">
          <X class="h-3 w-3" />
        </button>
      </Tooltip>
    </div>

    <!-- Expand / Collapse More Tabs Button -->
    <button
      v-if="hasHiddenTabs"
      type="button"
      data-expand-toggle
      class="w-full text-center py-1 mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors cursor-pointer"
      @click="emit('toggle-expand')">
      <span>{{ expandToggleLabel }}</span>
    </button>
  </div>
</template>
