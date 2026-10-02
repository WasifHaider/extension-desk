<script setup lang="ts">
import { ref } from 'vue';
import { DateTime } from 'luxon';
import type { ExtensionRequestDetail } from '../types';
import { formatDateTime, formatDayLabel } from '../format';

const { detail, timezone } = defineProps<{ detail: ExtensionRequestDetail; timezone: string }>();
const emit = defineEmits<{ setDate: [iso: string] }>();

const editing = ref(false);
const dateValue = ref('');

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

function startEdit() {
  dateValue.value = detail.interpretedEndAt
    ? DateTime.fromISO(detail.interpretedEndAt, { zone: 'utc' }).setZone(timezone).toFormat("yyyy-LL-dd'T'HH:mm")
    : '';
  editing.value = true;
}

function save() {
  if (!dateValue.value) return;
  const iso = DateTime.fromISO(dateValue.value, { zone: timezone }).toUTC().toISO();
  if (iso) emit('setDate', iso);
  editing.value = false;
}
</script>

<template>
  <div v-if="!editing" class="flex gap-2 items-baseline flex-wrap">
    <span class="text-[12px] text-muted uppercase tracking-[.04em]">Read as</span>
    <span class="font-semibold tabular-nums text-ink">{{ detail.interpretedEndAt ? formatDateTime(detail.interpretedEndAt, timezone) : '' }}</span>
    <span class="text-muted">{{ note() }}</span>
    <a v-if="canEdit()" href="#" class="text-[13px]" @click.prevent="startEdit">Edit</a>
  </div>
  <div v-else class="flex gap-2.5 items-center">
    <input v-model="dateValue" type="datetime-local" class="border border-line-strong rounded-btn px-3 py-2 tabular-nums" />
    <button class="bg-accent text-white rounded-btn px-4 py-2 font-medium cursor-pointer hover:bg-accent-hover" @click="save">
      Save
    </button>
    <button class="text-muted underline cursor-pointer" @click="editing = false">Cancel</button>
  </div>
</template>
