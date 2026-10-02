<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next';
import { useToast } from '~/composables/useToast';

const { toasts, remove } = useToast();
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-start gap-3 rounded-lg border bg-white dark:bg-zinc-900 p-3.5 shadow-lg"
        :class="{
          'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-100': toast.type === 'success',
          'border-rose-200 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/80 text-rose-900 dark:text-rose-100': toast.type === 'error',
          'border-sky-200 dark:border-sky-800/80 bg-sky-50/90 dark:bg-sky-950/80 text-sky-900 dark:text-sky-100': toast.type === 'info',
        }"
      >
        <CheckCircle2 v-if="toast.type === 'success'" class="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <AlertCircle v-else-if="toast.type === 'error'" class="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <Info v-else class="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />

        <div class="flex-1 text-sm">
          <div v-if="toast.title" class="font-semibold mb-0.5">{{ toast.title }}</div>
          <div class="text-xs opacity-90 leading-relaxed">{{ toast.message }}</div>
        </div>

        <button
          type="button"
          class="shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
          @click="remove(toast.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
