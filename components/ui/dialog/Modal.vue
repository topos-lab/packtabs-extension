<script setup lang="ts">
import { X } from 'lucide-vue-next';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'radix-vue';
import type { HTMLAttributes } from 'vue';

import { t } from '~/composables/useI18n';
import { cn } from '~/lib/utils';

defineProps<{
  open: boolean;
  title?: string;
  description?: string;
  contentClass?: HTMLAttributes['class'];
}>();

const emit = defineEmits<(e: 'update:open', value: boolean) => void>();
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/40 dark:bg-black/60 backdrop-blur-xs transition-opacity" />
      <DialogContent
        v-bind="description ? undefined : { 'aria-describedby': undefined }"
        :class="
          cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md max-h-[85vh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-[#222226] p-6 shadow-xl border border-zinc-200 dark:border-zinc-700/70 text-zinc-900 dark:text-zinc-100 outline-none',
            contentClass
          )
        "
      >
        <div class="flex items-center justify-between pb-1">
          <DialogTitle v-if="title" class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {{ title }}
          </DialogTitle>
          <DialogClose
            class="rounded-md p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors cursor-pointer"
          >
            <X class="h-4 w-4" />
            <span class="sr-only">{{ t('close') }}</span>
          </DialogClose>
        </div>
        <DialogDescription v-if="description" class="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-3">
          {{ description }}
        </DialogDescription>

        <div :class="description ? 'py-1' : 'pt-2.5 pb-1'">
          <slot />
        </div>

        <div v-if="$slots.footer" class="mt-5 flex justify-end gap-2">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
