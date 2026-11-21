<script lang="ts" setup>
  import { ArrowRight, ExternalLink, Folder, Layers } from 'lucide-vue-next';
  import { TooltipProvider } from 'radix-vue';
  import { onMounted, provide } from 'vue';

  import { Tooltip } from '~/components/ui/tooltip';
  import { TOOLTIP_PROVIDER_KEY } from '~/components/ui/tooltip/context';
  import { useI18n } from '~/composables/useI18n';
  import { useTheme } from '~/composables/useTheme';
  import { useTabStore } from '~/stores/useTabStore';
  import type { TabGroup } from '~/types/TabGroup';
  import { openOrFocusDashboard } from '~/utils/dashboardLauncher';
  import {
    getCurrentWindowId,
    openTabs,
    openTabsInNewWindow,
    prepareTabsForDisplay,
  } from '~/utils/tabManager';

  const tabStore = useTabStore();
  const { t, initLocale } = useI18n();
  const { initTheme } = useTheme();

  provide(TOOLTIP_PROVIDER_KEY, true);

  function closePopup() {
    if (typeof window !== 'undefined' && typeof window.close === 'function') {
      window.close();
    }
  }

  async function handleOpenCurrentTabs() {
    try {
      const windowId = await getCurrentWindowId();
      await openOrFocusDashboard({ preferredWindowId: windowId, view: 'current' });
      closePopup();
    } catch (error) {
      console.error('Failed to open current tabs view:', error);
    }
  }

  async function handleOpenGroup(event: MouseEvent, group: TabGroup) {
    const tabs = prepareTabsForDisplay(group.tabs);
    if (tabs.length === 0) {
      return;
    }
    try {
      if (event.shiftKey) {
        await openTabsInNewWindow(tabs);
      } else {
        const windowId = await getCurrentWindowId();
        await openTabs(tabs, windowId);
      }
      closePopup();
    } catch (error) {
      console.error('Failed to open tab group from popup:', error);
    }
  }

  async function handleOpenGroupInNewWindow(group: TabGroup) {
    const tabs = prepareTabsForDisplay(group.tabs);
    if (tabs.length === 0) {
      return;
    }
    try {
      await openTabsInNewWindow(tabs);
      closePopup();
    } catch (error) {
      console.error('Failed to open tab group in new window from popup:', error);
    }
  }

  onMounted(() => {
    void initTheme();
    void initLocale();
    void tabStore.loadGroups();
  });
</script>

<template>
  <TooltipProvider :delay-duration="300" :skip-delay-duration="300" disable-hoverable-content>
    <div class="w-full min-w-[280px] bg-white dark:bg-[#222226] text-zinc-900 dark:text-zinc-100 p-2 select-none">
      <!-- Quick Entry: Save Current Window Tabs -->
      <button
        type="button"
        data-popup-current-tabs
        class="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100/80 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
        @click="handleOpenCurrentTabs">
        <span class="flex items-center gap-2 min-w-0">
          <Layers class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ t('popupSaveCurrentTabs') }}</span>
        </span>
        <ArrowRight class="h-3.5 w-3.5 shrink-0 opacity-75" />
      </button>

      <div class="my-2 border-t border-zinc-100 dark:border-zinc-700/50" />

      <!-- Saved Groups Quick Launcher -->
      <div class="space-y-1">
        <div class="px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {{ t('savedGroups') }}
        </div>

        <div
          v-if="tabStore.namedGroups.length === 0"
          class="px-2.5 py-3 text-[11px] text-zinc-400 dark:text-zinc-500 italic">
          {{ t('noSavedGroupsYet') }}
        </div>

        <div v-else class="max-h-[340px] overflow-y-auto space-y-0.5 pr-0.5">
          <div
            v-for="group in tabStore.namedGroups"
            :key="group.id"
            class="group/row flex items-center gap-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700/45 transition-colors">
            <button
              type="button"
              data-popup-open-group
              class="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 text-left text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
              :disabled="group.tabs.length === 0"
              @click="handleOpenGroup($event, group)">
              <Folder class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <span class="truncate">{{ group.name || t('savedGroupFallback') }}</span>
            </button>

            <Tooltip :content="t('openInNewWindow')" side="left">
              <button
                type="button"
                data-open-new-window
                class="h-6 w-6 mr-1 shrink-0 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 opacity-0 group-hover/row:opacity-100 group-has-[:focus-visible]/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity cursor-pointer"
                :aria-label="t('openInNewWindow')"
                :disabled="group.tabs.length === 0"
                @click="handleOpenGroupInNewWindow(group)">
                <ExternalLink class="h-3 w-3" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
