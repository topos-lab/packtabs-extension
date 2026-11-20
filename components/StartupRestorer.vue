<script lang="ts" setup>
  import {
    Clock,
    ExternalLink,
    Folder,
    Globe,
    Moon,
    Search,
    Settings,
    Sparkles,
    Sun,
    SunMoon,
  } from 'lucide-vue-next';
  import { computed, ref } from 'vue';

  import SettingsModal from '~/components/SettingsModal.vue';
  import { Badge } from '~/components/ui/badge';
  import { Button } from '~/components/ui/button';
  import { Card, CardContent, CardHeader } from '~/components/ui/card';
  import { Input } from '~/components/ui/input';
  import { Tooltip } from '~/components/ui/tooltip';
  import { formatTabsCount, useI18n } from '~/composables/useI18n';
  import { useTheme } from '~/composables/useTheme';
  import { useToast } from '~/composables/useToast';
  import { useTabStore } from '~/stores/useTabStore';
  import type { TabGroup, TabItem } from '~/types/TabGroup';
  import { formatFullDateTime } from '~/utils/date';
  import { normalizeTabs } from '~/utils/storage';
  import { deduplicateTabsByUrl, getDomain, getFaviconUrl, openSingleTab, openTabs } from '~/utils/tabManager';

  interface PreparedRestorerEntry {
    group: TabGroup;
    tabs: TabItem[];
  }

  const tabStore = useTabStore();
  const toast = useToast();
  const { t } = useI18n();
  const { theme, cycleTheme, themeTooltip } = useTheme();

  const searchQuery = ref('');
  const expandedGroupIds = ref<Set<string>>(new Set());
  const showSettingsModal = ref(false);
  const faviconErrors = ref<Record<string, boolean>>({});
  const overflowingTabIds = ref<Record<string, boolean>>({});

  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/i.test(navigator.userAgent);

  function handleFaviconError(tabKey: string) {
    faviconErrors.value[tabKey] = true;
  }

  function checkTitleOverflow(tabKey: string, event: Event) {
    const btn = event.currentTarget as HTMLElement | null;
    const titleEl = btn?.querySelector('[data-tab-title]') as HTMLElement | null;
    overflowingTabIds.value[tabKey] = Boolean(titleEl && titleEl.scrollWidth > titleEl.clientWidth);
  }

  const logoUrl =
    typeof browser !== 'undefined' && browser.runtime?.getURL ? browser.runtime.getURL('/icon/48.png') : '/icon/48.png';

  function toggleExpand(groupId: string) {
    if (expandedGroupIds.value.has(groupId)) {
      expandedGroupIds.value.delete(groupId);
    } else {
      expandedGroupIds.value.add(groupId);
    }
  }

  function prepareEntries(groups: TabGroup[], isHistory: boolean): PreparedRestorerEntry[] {
    const q = searchQuery.value.toLowerCase().trim();
    const result: PreparedRestorerEntry[] = [];

    for (const group of groups) {
      const tabs = deduplicateTabsByUrl(normalizeTabs(group.tabs));
      if (!q) {
        result.push({ group, tabs });
        continue;
      }
      const title = isHistory ? formatFullDateTime(group.createdAt) : group.name || '';
      const matchName = title.toLowerCase().includes(q);
      const matchTabs = tabs.some(
        (tab) => tab.title.toLowerCase().includes(q) || tab.url.toLowerCase().includes(q)
      );
      if (matchName || matchTabs) {
        result.push({ group, tabs });
      }
    }

    return result;
  }

  const filteredSavedEntries = computed(() => prepareEntries(tabStore.namedGroups, false));
  const filteredHistoryEntries = computed(() => prepareEntries(tabStore.historyGroups, true));

  // Check if a history group is the most recent one
  const latestHistoryGroupId = computed(() => {
    return tabStore.historyGroups.length > 0 ? tabStore.historyGroups[0].id : null;
  });

  function formatRemainingLabel(remaining: number): string {
    return remaining === 1 ? t('remainingTabSingle') : t('remainingTabsCount', { count: remaining });
  }

  async function closeCurrentPage() {
    try {
      if (typeof browser !== 'undefined' && browser.tabs?.getCurrent) {
        const currentTab = await browser.tabs.getCurrent();
        if (currentTab?.id !== undefined && browser.tabs?.remove) {
          await browser.tabs.remove(currentTab.id);
          return;
        }
      }
    } catch (err) {
      if (err && (err as Error).name !== 'MockNotImplementedError') {
        console.warn('Failed to close current tab via browser.tabs.remove:', err);
      }
    }

    try {
      if (typeof window !== 'undefined' && window.close) {
        window.close();
      }
    } catch (err) {
      console.warn('Failed to close current window via window.close:', err);
    }
  }

  async function handleRestoreGroup(tabs: TabItem[]) {
    if (tabs.length === 0) {return;}
    try {
      await openTabs(tabs);
      await closeCurrentPage();
    } catch {
      toast.add({
        severity: 'error',
        detail: t('restoreTabsFailed'),
        life: 3000,
      });
    }
  }

  async function openTabFromRestorer(tab: TabItem, inBackground: boolean) {
    try {
      await openSingleTab(tab, inBackground);
      if (inBackground) {
        toast.add({
          severity: 'info',
          detail: t('openedBackgroundSuccess', { title: tab.title || t('untitled') }),
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

  async function handleTabClick(event: MouseEvent, tab: TabItem) {
    const inBackground = event.ctrlKey || event.metaKey || event.shiftKey;
    await openTabFromRestorer(tab, inBackground);
  }

  async function handleTabMiddleClick(event: MouseEvent, tab: TabItem) {
    if (event.button === 1) {
      event.preventDefault();
      await openTabFromRestorer(tab, true);
    }
  }
</script>

<template>
  <div class="min-h-screen w-full bg-zinc-50/80 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col">
    <!-- Clean Minimalist Header -->
    <header
      class="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md sticky top-0 z-20">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <!-- Brand & Title -->
        <div class="flex items-center gap-3">
          <img :src="logoUrl" alt="PackTabs Logo" class="h-8 w-8 rounded-lg shadow-2xs object-contain">
          <div class="flex items-center gap-2">
            <span class="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">PackTabs</span>
            <Badge
              variant="secondary"
              class="text-[11px] px-2 py-0.5 font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200/60 dark:border-zinc-700/60">
              {{ t('startupRestorer') }}
            </Badge>
          </div>
        </div>

        <!-- Center Search Bar -->
        <div class="flex-1 max-w-md relative hidden sm:block">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <Input
            v-model="searchQuery"
            :aria-label="t('searchWorkspacesOrHistory')"
            :placeholder="t('searchWorkspacesOrHistory')"
            class="h-8 pl-8 text-xs bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500" />
        </div>

        <!-- Right Actions: Settings + Theme toggle -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
            :title="t('settings')"
            :aria-label="t('settings')"
            @click="showSettingsModal = true">
            <Settings class="h-4 w-4" />
          </button>

          <button
            type="button"
            class="h-8 w-8 flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
            :title="themeTooltip"
            :aria-label="themeTooltip"
            @click="cycleTheme">
            <Sun v-if="theme === 'light'" class="h-4 w-4 text-amber-500" />
            <Moon v-else-if="theme === 'dark'" class="h-4 w-4 text-zinc-100" />
            <SunMoon v-else class="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>
      </div>
    </header>

    <!-- Page Introduction Hero -->
    <div class="max-w-6xl w-full mx-auto px-6 pt-7 pb-4">
      <h1 class="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {{ t('startupTitle') }}
      </h1>
      <p class="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
        {{ t('startupSubtitle') }}
      </p>

      <!-- Mobile Search Bar (visible on small screens) -->
      <div class="mt-4 sm:hidden relative">
        <Search
          class="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
        <Input
          v-model="searchQuery"
          :aria-label="t('searchWorkspacesOrHistory')"
          :placeholder="t('searchWorkspacesOrHistory')"
          class="h-8 pl-8 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700" />
      </div>
    </div>

    <!-- Main Content: Pure 2-Column Restorer View -->
    <main class="flex-1 max-w-6xl w-full mx-auto px-6 py-3">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pb-12">
        <!-- ================= LEFT COLUMN: Saved Groups ================= -->
        <section class="space-y-3.5">
          <!-- Column Header -->
          <div class="flex items-center justify-between pb-1.5 border-b border-zinc-200/80 dark:border-zinc-800">
            <div class="flex items-center gap-2">
              <div class="p-1 rounded bg-indigo-50 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400">
                <Folder class="h-4 w-4" />
              </div>
              <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                {{ t('savedGroups') }}
              </h2>
            </div>
            <Badge variant="secondary" class="text-[11px] font-normal px-2 py-0.5">
              {{ filteredSavedEntries.length }}
            </Badge>
          </div>

          <!-- Empty State -->
          <div
            v-if="filteredSavedEntries.length === 0"
            class="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-xs text-zinc-400 dark:text-zinc-500">
            <Folder class="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600 opacity-60" />
            <p>{{ t('noSavedGroupsInStartup') }}</p>
          </div>

          <!-- Saved Groups Cards List -->
          <div v-else class="space-y-3">
            <Card
              v-for="{ group, tabs } in filteredSavedEntries"
              :key="group.id"
              class="border border-zinc-200/90 dark:border-zinc-800/90 shadow-2xs hover:shadow-xs transition-shadow bg-white dark:bg-zinc-900 overflow-hidden">
              <CardHeader class="p-4 pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {{ group.name || t('savedGroupFallback') }}
                    </h3>
                    <Badge variant="secondary" class="text-[10px] px-1.5 py-0.5 shrink-0">
                      {{ formatTabsCount(tabs.length) }}
                    </Badge>
                  </div>
                </div>

                <!-- Primary Action: Open All -->
                <Button
                  size="sm"
                  class="h-7 px-3 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 cursor-pointer shadow-2xs"
                  :disabled="tabs.length === 0"
                  @click="handleRestoreGroup(tabs)">
                  <ExternalLink class="h-3 w-3 mr-1.5" />
                  <span>{{ t('openAll') }}</span>
                </Button>
              </CardHeader>

              <!-- Tabs Preview -->
              <CardContent class="p-3 pt-0">
                <div class="space-y-1">
                  <Tooltip
                    v-for="tab in expandedGroupIds.has(group.id) ? tabs : tabs.slice(0, 4)"
                    :key="tab.id"
                    :disabled="!overflowingTabIds[`saved:${tab.id}`]"
                    :content="[tab.title || t('untitled'), tab.url]"
                    side="top"
                    :delay-duration="350"
                  >
                    <button
                      type="button"
                      class="group/tab w-full text-left flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
                      @mouseenter="checkTitleOverflow(`saved:${tab.id}`, $event)"
                      @focus="checkTitleOverflow(`saved:${tab.id}`, $event)"
                      @click="handleTabClick($event, tab)"
                      @auxclick="handleTabMiddleClick($event, tab)">
                      <span class="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <span class="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                          <img
                            v-if="!faviconErrors[`saved:${tab.id}`] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                            :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                            class="h-3.5 w-3.5 rounded-2xs object-contain"
                            alt=""
                            loading="lazy"
                            @error="handleFaviconError(`saved:${tab.id}`)">
                          <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        </span>
                        <span
                          data-tab-title
                          class="text-xs text-zinc-700 dark:text-zinc-300 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors">
                          {{ tab.title || t('untitled') }}
                        </span>
                      </span>
                      <span class="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 hidden sm:inline">
                        {{ getDomain(tab.url) }}
                      </span>
                    </button>
                  </Tooltip>

                  <!-- Expand / Collapse More Tabs Button -->
                  <button
                    v-if="tabs.length > 4"
                    type="button"
                    class="w-full text-center py-1 mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors cursor-pointer"
                    @click="toggleExpand(group.id)">
                    <span v-if="!expandedGroupIds.has(group.id)">
                      {{ formatRemainingLabel(tabs.length - 4) }}
                    </span>
                    <span v-else>
                      {{ t('showLess') }}
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <!-- ================= RIGHT COLUMN: History Snapshots ================= -->
        <section class="space-y-3.5">
          <!-- Column Header -->
          <div class="flex items-center justify-between pb-1.5 border-b border-zinc-200/80 dark:border-zinc-800">
            <div class="flex items-center gap-2">
              <div class="p-1 rounded bg-amber-50 dark:bg-zinc-800 text-amber-600 dark:text-amber-400">
                <Clock class="h-4 w-4" />
              </div>
              <h2 class="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                {{ t('historySnapshots') }}
              </h2>
            </div>
            <Badge variant="secondary" class="text-[11px] font-normal px-2 py-0.5">
              {{ filteredHistoryEntries.length }}
            </Badge>
          </div>

          <!-- Empty State -->
          <div
            v-if="filteredHistoryEntries.length === 0"
            class="p-8 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 text-xs text-zinc-400 dark:text-zinc-500">
            <Clock class="h-8 w-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600 opacity-60" />
            <p>{{ t('noHistoryGroupsInStartup') }}</p>
          </div>

          <!-- History Snapshots Cards List -->
          <div v-else class="space-y-3">
            <Card
              v-for="{ group, tabs } in filteredHistoryEntries"
              :key="group.id"
              class="border shadow-2xs hover:shadow-xs transition-all overflow-hidden"
              :class="[
                group.id === latestHistoryGroupId
                  ? 'border-indigo-400/90 dark:border-indigo-500/80 bg-indigo-50/20 dark:bg-zinc-900/90 ring-1 ring-indigo-500/20'
                  : 'border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900',
              ]">
              <CardHeader class="p-4 pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <!-- Highlight badge for the latest session -->
                    <span
                      v-if="group.id === latestHistoryGroupId"
                      class="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-600 text-white shrink-0 shadow-2xs">
                      <Sparkles class="h-3 w-3" />
                      <span>{{ t('lastClosedSession') }}</span>
                    </span>

                    <h3 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {{ formatFullDateTime(group.createdAt) }}
                    </h3>

                    <Badge variant="secondary" class="text-[10px] px-1.5 py-0.5 shrink-0">
                      {{ formatTabsCount(tabs.length) }}
                    </Badge>
                  </div>
                </div>

                <!-- Primary Action Button: Restore Session or Open All -->
                <Button
                  size="sm"
                  :variant="group.id === latestHistoryGroupId ? 'default' : 'outline'"
                  class="h-7 px-3 text-xs font-medium shrink-0 cursor-pointer shadow-2xs"
                  :class="[
                    group.id === latestHistoryGroupId
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-500/20'
                      : '',
                  ]"
                  :disabled="tabs.length === 0"
                  @click="handleRestoreGroup(tabs)">
                  <ExternalLink class="h-3 w-3 mr-1.5" />
                  <span>{{ group.id === latestHistoryGroupId ? t('restoreThisSession') : t('openAll') }}</span>
                </Button>
              </CardHeader>

              <!-- Tabs Preview -->
              <CardContent class="p-3 pt-0">
                <div class="space-y-1">
                  <Tooltip
                    v-for="tab in expandedGroupIds.has(group.id) ? tabs : tabs.slice(0, 4)"
                    :key="tab.id"
                    :disabled="!overflowingTabIds[`history:${tab.id}`]"
                    :content="[tab.title || t('untitled'), tab.url]"
                    side="top"
                    :delay-duration="350"
                  >
                    <button
                      type="button"
                      class="group/tab w-full text-left flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
                      @mouseenter="checkTitleOverflow(`history:${tab.id}`, $event)"
                      @focus="checkTitleOverflow(`history:${tab.id}`, $event)"
                      @click="handleTabClick($event, tab)"
                      @auxclick="handleTabMiddleClick($event, tab)">
                      <span class="flex items-center gap-2 min-w-0 flex-1 mr-2">
                        <span class="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                          <img
                            v-if="!faviconErrors[`history:${tab.id}`] && (tab.faviconUrl || getFaviconUrl(tab.url))"
                            :src="tab.faviconUrl || getFaviconUrl(tab.url)"
                            class="h-3.5 w-3.5 rounded-2xs object-contain"
                            alt=""
                            loading="lazy"
                            @error="handleFaviconError(`history:${tab.id}`)">
                          <Globe v-else class="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                        </span>
                        <span
                          data-tab-title
                          class="text-xs text-zinc-700 dark:text-zinc-300 group-hover/tab:text-indigo-600 dark:group-hover/tab:text-indigo-400 truncate transition-colors">
                          {{ tab.title || t('untitled') }}
                        </span>
                      </span>
                      <span class="text-[10px] text-zinc-500 dark:text-zinc-400 shrink-0 hidden sm:inline">
                        {{ getDomain(tab.url) }}
                      </span>
                    </button>
                  </Tooltip>

                  <!-- Expand / Collapse More Tabs Button -->
                  <button
                    v-if="tabs.length > 4"
                    type="button"
                    class="w-full text-center py-1 mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors cursor-pointer"
                    @click="toggleExpand(group.id)">
                    <span v-if="!expandedGroupIds.has(group.id)">
                      {{ formatRemainingLabel(tabs.length - 4) }}
                    </span>
                    <span v-else>
                      {{ t('showLess') }}
                    </span>
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>

    <!-- Subtle Footer Tip -->
    <footer
      class="mt-auto border-t border-zinc-200/60 dark:border-zinc-800/60 py-3 bg-white/50 dark:bg-zinc-900/50 text-center">
      <p class="text-[11px] text-zinc-400 dark:text-zinc-500">
        {{ isMac ? t('startupTipMac') : t('startupTip') }}
      </p>
    </footer>

    <!-- Settings Modal -->
    <SettingsModal v-model:open="showSettingsModal" />
  </div>
</template>
