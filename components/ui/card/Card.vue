<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '~/lib/utils';

defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div :class="cn('rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-100 shadow-sm transition-all hover:shadow', $props.class)">
    <slot />
  </div>
</template>
