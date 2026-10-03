<script setup lang="ts">
import type { Meta } from '../types';
import { formatHeaderClock } from '../format';

const {
  meta,
  title = 'Extension Desk',
  resetLabel = 'Reset demo',
  navLabel,
  navHref,
} = defineProps<{
  meta: Meta | null;
  title?: string;
  resetLabel?: string;
  navLabel?: string;
  navHref?: string;
}>();
const emit = defineEmits<{ reset: [] }>();
</script>

<template>
  <header class="h-14 bg-surface border-b border-line flex items-center px-6 gap-5 shrink-0">
    <div class="font-semibold text-[16px] text-ink">{{ title }}</div>
    <div class="text-muted">{{ meta?.operatorName }}</div>
    <a v-if="navLabel && navHref" :href="navHref" class="text-accent text-[14px] hover:underline">{{ navLabel }}</a>
    <div class="flex-1"></div>
    <div v-if="meta" class="text-muted tabular-nums">{{ formatHeaderClock(meta.now, meta.timezone) }}</div>
    <div class="flex items-center gap-1.5 border border-line rounded-pill px-3 py-1 text-[13px] text-ink">
      <span
        class="w-[7px] h-[7px] rounded-full"
        :class="meta?.parserActive ? 'bg-green' : 'bg-faint'"
      ></span>
      {{ meta?.parserLabel ?? 'Manual mode' }}
    </div>
    <button
      class="border border-line-strong bg-surface rounded-btn px-3.5 py-[7px] text-[14px] cursor-pointer hover:bg-canvas"
      @click="emit('reset')"
    >
      {{ resetLabel }}
    </button>
  </header>
</template>
