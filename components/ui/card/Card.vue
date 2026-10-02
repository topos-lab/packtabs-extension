<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '~/lib/utils';

defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <div :class="cn('rounded-xl border border-slate-200/80 bg-white text-slate-950 shadow-sm transition-all hover:shadow', $props.class)">
    <slot />
  </div>
</template>
