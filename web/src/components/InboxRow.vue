<script setup lang="ts">
import type { InboxRow } from '../types';
import { formatInboxTime } from '../format';
import Badge from './Badge.vue';

const { row, selected, timezone, nowIso } = defineProps<{
  row: InboxRow;
  selected: boolean;
  timezone: string;
  nowIso: string;
}>();
const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <div
    class="px-5 py-3 border-t border-line-row cursor-pointer transition-ui"
    :class="[selected ? 'bg-accent-tint shadow-[inset_3px_0_0_var(--color-accent)]' : 'hover:bg-canvas', row.badge === 'NOT_EXTENSION' ? 'opacity-55' : '']"
    @click="emit('click')"
  >
    <div class="flex justify-between gap-2">
      <b class="font-semibold text-ink">{{ row.renterName }}</b>
      <span class="text-faint text-[12px] tabular-nums">{{ formatInboxTime(row.createdAt, timezone, nowIso) }}</span>
    </div>
    <div class="text-muted text-[13px] mt-px">{{ row.vehicleName }}</div>
    <div class="text-ink-2 text-[13px] mt-1 whitespace-nowrap overflow-hidden text-ellipsis">{{ row.preview }}</div>
    <div class="mt-2">
      <Badge :variant="row.badge" />
    </div>
  </div>
</template>
