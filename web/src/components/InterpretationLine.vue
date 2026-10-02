<script setup lang="ts">
import type { ExtensionRequestDetail } from '../types';
import { formatDateTime, formatDayLabel } from '../format';

const { detail, timezone } = defineProps<{ detail: ExtensionRequestDetail; timezone: string }>();
const emit = defineEmits<{ edit: [] }>();

function note(): string {
  const raw = detail.interpretationNote ?? '';
  const stripped = raw.replace(/^Read as [^(]+/, '').trim();
  if (detail.conflicts.length === 0) {
    const suffix = detail.freeUntil ? `free until ${formatDayLabel(detail.freeUntil, timezone)}` : 'no later bookings';
    return stripped ? `${stripped} · ${suffix}` : `· ${suffix}`;
  }
  return stripped;
}

const canEdit = () => detail.status === 'READY' || detail.status === 'NEEDS_DATE';
</script>

<template>
  <div class="flex gap-2 items-baseline flex-wrap">
    <span class="text-[12px] text-muted uppercase tracking-[.04em]">Read as</span>
    <span class="font-semibold tabular-nums text-ink">{{ detail.interpretedEndAt ? formatDateTime(detail.interpretedEndAt, timezone) : '' }}</span>
    <span class="text-muted">{{ note() }}</span>
    <a v-if="canEdit()" href="#" class="text-[13px]" @click.prevent="emit('edit')">Edit</a>
  </div>
</template>
