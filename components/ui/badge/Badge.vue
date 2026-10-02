<script setup lang="ts">
import { cva } from 'class-variance-authority';
import type { HTMLAttributes } from 'vue';

import { cn } from '~/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-indigo-50 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-zinc-700',
        secondary: 'border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700',
        destructive: 'border-transparent bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60',
        outline: 'text-zinc-950 dark:text-zinc-100 border-zinc-200 dark:border-zinc-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface Props {
  variant?: NonNullable<Parameters<typeof badgeVariants>[0]>['variant'];
  class?: HTMLAttributes['class'];
}

defineProps<Props>();
</script>

<template>
  <div :class="cn(badgeVariants({ variant }), $props.class)">
    <slot />
  </div>
</template>
