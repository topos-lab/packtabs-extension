<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'radix-vue';
import { X } from 'lucide-vue-next';

defineProps<{
  open: boolean;
  title?: string;
  description?: string;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-xs transition-opacity" />
      <DialogContent
        class="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl border border-slate-200 outline-none"
      >
        <div class="flex items-center justify-between pb-1">
          <DialogTitle v-if="title" class="text-lg font-semibold text-slate-900">
            {{ title }}
          </DialogTitle>
          <DialogClose
            class="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X class="h-4 w-4" />
            <span class="sr-only">Close</span>
          </DialogClose>
        </div>
        <DialogDescription v-if="description" class="text-sm text-slate-500 mt-1 mb-4">
          {{ description }}
        </DialogDescription>

        <div class="py-2">
          <slot />
        </div>

        <div v-if="$slots.footer" class="mt-5 flex justify-end gap-2">
          <slot name="footer" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
