<script setup lang="ts">
import type { Meta } from '../types';
import { formatHeaderClock } from '../format';

const {
  meta,
  title = 'Extension Desk',
  resetLabel = 'Reset demo',
  currentPage = 'demo',
} = defineProps<{
  meta: Meta | null;
  title?: string;
  resetLabel?: string;
  currentPage?: 'demo' | 'playground';
}>();
const emit = defineEmits<{ reset: [] }>();
</script>

<template>
  <header class="h-14 bg-surface border-b border-line flex items-center px-6 gap-5 shrink-0">
    <div class="font-semibold text-[16px] text-ink">{{ title }}</div>
    <div class="text-muted">{{ meta?.operatorName }}</div>
    <nav class="flex items-center gap-1 bg-canvas border border-line rounded-pill p-0.5">
      <a
        href="/"
        class="btn text-[13px] font-medium rounded-pill px-3 py-1"
        :class="currentPage === 'demo' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface'"
      >
        Demo
      </a>
      <a
        href="/playground"
        class="btn text-[13px] font-medium rounded-pill px-3 py-1"
        :class="currentPage === 'playground' ? 'bg-accent text-white' : 'text-ink-2 hover:bg-surface'"
      >
        Playground
      </a>
    </nav>
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
