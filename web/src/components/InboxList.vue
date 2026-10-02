<script setup lang="ts">
import type { InboxRow as InboxRowType } from '../types';
import InboxRow from './InboxRow.vue';

const { rows, selectedId, timezone, nowIso } = defineProps<{
  rows: InboxRowType[];
  selectedId: string | null;
  timezone: string;
  nowIso: string;
}>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <div class="bg-surface border-r border-line h-full overflow-y-auto">
    <div class="px-5 pt-[18px] pb-3 flex justify-between items-baseline">
      <b class="font-semibold text-ink">Extension requests</b>
      <span class="text-muted text-[13px]">{{ rows.length }}</span>
    </div>
    <InboxRow
      v-for="row in rows"
      :key="row.id"
      :row="row"
      :selected="row.id === selectedId"
      :timezone="timezone"
      :now-iso="nowIso"
      @click="emit('select', row.id)"
    />
  </div>
</template>
