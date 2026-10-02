<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import { cn } from '~/lib/utils';

defineProps<{
  class?: HTMLAttributes['class'];
}>();
</script>

<template>
  <h3 :class="cn('font-semibold leading-none tracking-tight text-zinc-900 dark:text-zinc-100', $props.class)">
    <slot />
  </h3>
</template>
