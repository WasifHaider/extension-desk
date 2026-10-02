<script setup lang="ts">
import type { EventRow } from '../types';
import { formatClockTime } from '../format';

defineProps<{ events: EventRow[]; timezone: string }>();
</script>

<template>
  <div class="border-t border-line pt-3.5">
    <div class="text-[12px] text-muted uppercase tracking-[.04em] mb-2">Event log</div>
    <div class="flex flex-col gap-[3px] text-[12px] text-faint tabular-nums">
      <div v-for="e in events" :key="e.id" class="flex gap-3.5">
        <span class="w-16 shrink-0">{{ formatClockTime(e.createdAt, timezone) }}</span>
        <span>{{ e.detail }}</span>
      </div>
    </div>
  </div>
</template>
