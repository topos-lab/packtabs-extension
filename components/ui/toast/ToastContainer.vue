<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-vue-next';

import { useI18n } from '~/composables/useI18n';
import { useToast } from '~/composables/useToast';

const { toasts, pause, resume, triggerAction, remove } = useToast();
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
        class="pointer-events-auto flex items-center gap-2.5 rounded-lg border border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-[#27272c] px-3.5 py-2.5 text-zinc-800 dark:text-zinc-100 shadow-lg dark:shadow-xl"
        @mouseenter="pause(toast.id)"
        @mouseleave="resume(toast.id)"
      >
        <CheckCircle2 v-if="toast.type === 'success'" class="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
        <AlertCircle v-else-if="toast.type === 'error'" class="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
        <Info v-else class="h-4 w-4 text-indigo-500 dark:text-indigo-400 shrink-0" />

        <div class="flex-1 min-w-0">
          <div v-if="toast.title" class="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-0.5">
            {{ toast.title }}
          </div>
          <div class="text-xs text-zinc-600 dark:text-zinc-300 leading-snug break-words">
            {{ toast.message }}
          </div>
        </div>

        <button
          v-if="toast.action"
          type="button"
          data-toast-action
          class="shrink-0 px-2 py-1 rounded-md text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
          @click="triggerAction(toast.id)"
        >
          {{ toast.action.label }}
        </button>

        <button
          type="button"
          :aria-label="t('closeNotificationAria')"
          class="shrink-0 h-6 w-6 flex items-center justify-center rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
          @click="remove(toast.id)"
        >
          <X class="h-3.5 w-3.5" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
