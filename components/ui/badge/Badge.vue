<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'vue';
import { cn } from '~/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
        secondary: 'border-transparent bg-slate-100 text-slate-900 hover:bg-slate-200',
        destructive: 'border-transparent bg-rose-50 text-rose-700 hover:bg-rose-100',
        outline: 'text-slate-950 border-slate-200',
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
