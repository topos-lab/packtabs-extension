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
import type { Component, HTMLAttributes } from 'vue';
import { inject } from 'vue';

import { cn } from '~/lib/utils';

import { TOOLTIP_PROVIDER_KEY } from './context';

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
  content: undefined,
  side: 'top',
  align: 'center',
  sideOffset: 6,
  delayDuration: 400,
  disabled: false,
  class: undefined,
});

const hasRootProvider = inject(TOOLTIP_PROVIDER_KEY, false);

const Passthrough: Component = (_, { slots }) => slots.default?.();
</script>

<template>
  <component
    :is="hasRootProvider ? Passthrough : TooltipProvider"
    v-bind="hasRootProvider ? undefined : { delayDuration: props.delayDuration, disableHoverableContent: true }"
  >
    <TooltipRoot :delay-duration="props.delayDuration" :disabled="props.disabled" :disable-hoverable-content="true">
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="props.side"
          :align="props.align"
          :side-offset="props.sideOffset"
          :class="
            cn(
              'z-50 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 shadow-md select-none pointer-events-none transition-all whitespace-pre-line max-w-md break-words leading-relaxed',
              props.class
            )
          "
        >
          <slot name="content">
            <template v-if="Array.isArray(props.content)">
              <div
                v-for="(line, idx) in props.content"
                :key="idx"
                :class="
                  idx === 0
                    ? 'leading-relaxed line-clamp-3'
                    : 'text-[11px] text-zinc-500 dark:text-zinc-400 break-all line-clamp-2 mt-0.5'
                "
              >
                {{ line }}
              </div>
            </template>
            <template v-else>
              {{ props.content }}
            </template>
          </slot>
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </component>
</template>
