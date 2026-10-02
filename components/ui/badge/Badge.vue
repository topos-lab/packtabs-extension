<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'vue';
import { cn } from '~/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900',
        secondary: 'border-transparent bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700',
        destructive: 'border-transparent bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900',
        outline: 'text-slate-950 dark:text-slate-100 border-slate-200 dark:border-slate-800',
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
