<script setup lang="ts">
/**
 * Accessible, theme-adaptive Tooltip component powered by Radix Vue.
 * Supports single-line and multi-line content (via \n breaks, string arrays, or #content slot).
 * Adapts to Tailwind Zinc light/dark palettes without triggering native OS/browser black title bubbles.
 */
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'radix-vue';
import type { HTMLAttributes } from 'vue';

import { cn } from '~/lib/utils';

interface Props {
  content?: string | string[];
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  sideOffset?: number;
  delayDuration?: number;
  disabled?: boolean;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  side: 'top',
  align: 'center',
  sideOffset: 6,
  delayDuration: 400,
  disabled: false,
});
</script>

<template>
  <TooltipProvider :delay-duration="delayDuration">
    <TooltipRoot :disabled="disabled">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :align="align"
          :side-offset="sideOffset"
          :class="
            cn(
              'z-50 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 shadow-md select-none pointer-events-none transition-all whitespace-pre-line max-w-xs leading-relaxed',
              $props.class
            )
          "
        >
          <slot name="content">
            <template v-if="Array.isArray(content)">
              <div v-for="(line, idx) in content" :key="idx" class="leading-relaxed">
                {{ line }}
              </div>
            </template>
            <template v-else>
              {{ content }}
            </template>
          </slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
