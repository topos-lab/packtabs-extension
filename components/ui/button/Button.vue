<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'vue';
import { cn } from '~/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-indigo-600 text-white shadow hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500',
        outline: 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100',
        secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm hover:bg-slate-200 dark:hover:bg-slate-700',
        ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100',
        link: 'text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface Props {
  variant?: NonNullable<Parameters<typeof buttonVariants>[0]>['variant'];
  size?: NonNullable<Parameters<typeof buttonVariants>[0]>['size'];
  class?: HTMLAttributes['class'];
}

defineProps<Props>();
</script>

<template>
  <button :class="cn(buttonVariants({ variant, size }), $props.class)">
    <slot />
  </button>
</template>
