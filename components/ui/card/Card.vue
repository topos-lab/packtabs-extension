<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '~/lib/utils';

defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div :class="cn('rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-950 dark:text-slate-100 shadow-sm transition-all hover:shadow', $props.class)">
    <slot />
  </div>
</template>
