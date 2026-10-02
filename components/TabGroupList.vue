<script lang="ts" setup>
import { Layers } from 'lucide-vue-next';
import TabGroupCard from '~/components/TabGroupCard.vue';
import type { TabGroup } from '~/types/TabGroup';

defineProps<{
  groups: TabGroup[];
}>();

const emit = defineEmits<{
  save: [groupId: string];
}>();

function handleSave(groupId: string) {
  emit('save', groupId);
}
</script>

<template>
  <div class="w-full">
    <!-- Empty state -->
    <div
      v-if="groups.length === 0"
      class="flex flex-col items-center justify-center min-h-[360px] p-8 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/50"
    >
      <div class="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3.5">
        <Layers class="h-6 w-6" />
      </div>
      <h3 class="text-base font-semibold text-slate-800 mb-1">No tab groups yet</h3>
      <p class="text-xs text-slate-500 max-w-xs leading-relaxed">
        Save your current tabs to create your first tab group
      </p>
    </div>

    <!-- Tab group cards list (one card per row) -->
    <div
      v-else
      class="flex flex-col gap-4 w-full"
    >
      <TabGroupCard
        v-for="group in groups"
        :key="group.id"
        :group="group"
        @save="handleSave"
      />
    </div>
  </div>
</template>
