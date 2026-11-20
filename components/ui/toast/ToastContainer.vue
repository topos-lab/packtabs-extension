<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next';

import { useI18n } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';

const { toasts, remove } = useToast();
const { t } = useI18n();
</script>

<template>
  <div
    role="region"
    aria-live="polite"
    :aria-label="t('notificationsAria')"
    class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
  >
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out motion-reduce:transition-none"
      enter-from-class="transform translate-y-2 opacity-0 motion-reduce:translate-y-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-200 ease-in motion-reduce:transition-none"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0 motion-reduce:translate-y-0"
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
          <div v-if="toast.title" class="font-semibold mb-0.5">
            {{ toast.title }}
          </div>
          <div class="text-xs opacity-90 leading-relaxed">
            {{ toast.message }}
          </div>
        </div>

        <button
          type="button"
          :aria-label="t('closeNotificationAria')"
          class="shrink-0 min-h-6 min-w-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-opacity"
          @click="remove(toast.id)"
        >
          <X class="h-4 w-4" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
