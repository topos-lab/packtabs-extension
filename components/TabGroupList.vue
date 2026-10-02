<script lang="ts" setup>
import { Layers } from 'lucide-vue-next';
import { computed } from 'vue';

import TabGroupCard from '~/components/TabGroupCard.vue';
import { t } from '~/composables/useI18n';
import type { TabGroup } from '~/types/TabGroup';

type TimeCategory = 'Today' | 'Yesterday' | 'Previous 7 Days' | 'This Month' | 'Older';

function getCategoryLabel(label: TimeCategory): string {
  switch (label) {
    case 'Today':
      return t('timeToday');
    case 'Yesterday':
      return t('timeYesterday');
    case 'Previous 7 Days':
      return t('timePrevious7Days');
    case 'This Month':
      return t('timeThisMonth');
    case 'Older':
      return t('timeOlder');
  }
}

interface TimeSection {
  label: TimeCategory;
  groups: TabGroup[];
}

function getTimeCategory(dateInput: Date | string | number, now = new Date()): TimeCategory {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'Older';

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const diffDays = Math.round((startOfToday.getTime() - startOfTarget.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return 'Previous 7 Days';
  if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) return 'This Month';
  return 'Older';
}

const CATEGORY_ORDER: TimeCategory[] = [
  'Today',
  'Yesterday',
  'Previous 7 Days',
  'This Month',
  'Older',
];

const props = defineProps<{
  groups: TabGroup[];
}>();

const emit = defineEmits<{
  save: [groupId: string];
}>();

const timeSections = computed<TimeSection[]>(() => {
  const map: Record<TimeCategory, TabGroup[]> = {
    'Today': [],
    'Yesterday': [],
    'Previous 7 Days': [],
    'This Month': [],
    'Older': [],
  };

  for (const group of props.groups) {
    const cat = getTimeCategory(group.createdAt);
    map[cat].push(group);
  }

  return CATEGORY_ORDER
    .filter((cat) => map[cat].length > 0)
    .map((cat) => ({
      label: cat,
      groups: map[cat],
    }));
});

function handleSave(groupId: string) {
  emit('save', groupId);
}
</script>

<template>
  <div class="w-full">
    <!-- Empty state -->
    <div
      v-if="groups.length === 0"
      class="flex flex-col items-center justify-center min-h-[360px] p-8 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50"
    >
      <div class="h-12 w-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 mb-3.5">
        <Layers class="h-6 w-6" />
      </div>
      <h3 class="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{{ t('noGroupsYet') }}</h3>
      <p class="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">
        {{ t('noGroupsYetSubtitle') }}
      </p>
    </div>

    <!-- Time-grouped tab group cards list -->
    <div
      v-else
      class="space-y-6 w-full"
    >
      <div
        v-for="section in timeSections"
        :key="section.label"
        class="space-y-3"
      >
        <!-- Section Header Divider -->
        <div class="flex items-center gap-2.5 pt-1">
          <span class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {{ getCategoryLabel(section.label) }}
          </span>
          <span class="text-[11px] font-medium text-zinc-400 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            {{ section.groups.length }}
          </span>
          <div class="h-px bg-zinc-200/80 dark:bg-zinc-800 flex-1" />
        </div>

        <!-- Group Cards in this Section -->
        <div class="flex flex-col gap-4 w-full">
          <TabGroupCard
            v-for="group in section.groups"
            :key="group.id"
            :group="group"
            @save="handleSave"
          />
        </div>
      </div>
    </div>
  </div>
</template>
