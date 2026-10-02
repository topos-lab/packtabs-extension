<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '~/lib/utils';

const props = defineProps<{
  defaultValue?: string | number;
  modelValue?: string | number;
  class?: HTMLAttributes['class'];
}>();

const emits = defineEmits<{
  (e: 'update:modelValue', payload: string | number): void;
}>();
</script>

<template>
  <input
    :value="modelValue"
    :class="
      cn(
        'flex h-9 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1 text-sm text-slate-900 dark:text-slate-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
        $props.class
      )
    "
    @input="emits('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
