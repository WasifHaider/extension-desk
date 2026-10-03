<script setup lang="ts">
import { computed } from 'vue';
import { DateTime } from 'luxon';
import type { ExtensionRequestDetail } from '../types';
import { formatDateTime, formatDayLabel } from '../format';

const BUFFER_MINUTES = 120;
const DAY_WIDTH = 120;

const { detail, timezone, nowIso } = defineProps<{
  detail: ExtensionRequestDetail;
  timezone: string;
  nowIso: string;
}>();

function windowStart(): DateTime {
  return DateTime.fromISO(detail.originalEndAt, { zone: 'utc' }).setZone(timezone).startOf('day');
}

function hoursSince(iso: string): number {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).diff(windowStart(), 'hours').hours;
}

const laterEndIso = computed(() => detail.chosenEndAt ?? detail.interpretedEndAt ?? detail.originalEndAt);

// Window covers every date the chart draws — never clip, scroll instead.
const furthestIso = computed(() => {
  const candidates = [detail.originalEndAt, laterEndIso.value];
  if (detail.nextBooking) candidates.push(detail.nextBooking.endAt);
  if (detail.freeUntil) candidates.push(detail.freeUntil);
  if (detail.latestFreeEnd) candidates.push(detail.latestFreeEnd);
  return candidates.reduce((a, b) => (DateTime.fromISO(a) > DateTime.fromISO(b) ? a : b));
});

const windowDays = computed(() => Math.max(4, Math.ceil(hoursSince(furthestIso.value) / 24) + 1));
const windowHours = computed(() => windowDays.value * 24);
const trackWidth = computed(() => windowDays.value * DAY_WIDTH);

function px(hours: number): number {
  return (hours / 24) * DAY_WIDTH;
}

const dayLabels = computed(() => {
  const start = windowStart();
  return Array.from({ length: windowDays.value }, (_, i) => start.plus({ days: i }).toFormat('ccc d'));
});

const tripBlock = computed(() => ({
  left: px(0),
  width: px(hoursSince(detail.originalEndAt)) - px(0),
}));

const isApproved = computed(() => detail.status === 'APPROVED');

const requestedBlock = computed(() => {
  if (isApproved.value && detail.chosenEndAt) {
    return {
      left: px(hoursSince(detail.originalEndAt)),
      width: px(hoursSince(detail.chosenEndAt)) - px(hoursSince(detail.originalEndAt)),
      label: `Extension · to ${formatDateTime(detail.chosenEndAt, timezone)}`,
      kind: 'done' as const,
    };
  }
  if (!detail.interpretedEndAt) return null;
  return {
    left: px(hoursSince(detail.originalEndAt)),
    width: px(hoursSince(detail.interpretedEndAt)) - px(hoursSince(detail.originalEndAt)),
    label: 'Requested extension',
    kind: 'ext' as const,
  };
});

const laneLabel = computed(() => (isApproved.value ? 'Extension' : 'Requested'));

const bufferHours = BUFFER_MINUTES / 60;

const nextBlock = computed(() => {
  const next = detail.nextBooking;
  if (!next) return null;
  const startH = hoursSince(next.startAt);
  const endH = hoursSince(next.endAt);
  const start = DateTime.fromISO(next.startAt, { zone: 'utc' }).setZone(timezone);
  const end = DateTime.fromISO(next.endAt, { zone: 'utc' }).setZone(timezone);
  const widthPx = px(endH) - px(startH);
  const fullLabel =
    next.source === 'TURO'
      ? `Turo guest · ${start.toFormat('ccc h a')} → ${end.toFormat('ccc h a')}`
      : `Direct · ${next.renterName ?? ''} · ${start.toFormat('ccc h a')} → ${end.toFormat('ccc h a')}`;
  const shortLabel = next.source === 'TURO' ? `Turo guest · ${start.toFormat('ccc h a')}` : `Direct · ${next.renterName ?? ''}`;
  return {
    left: px(startH),
    width: widthPx,
    label: widthPx < 150 ? shortLabel : fullLabel,
    isTuro: next.source === 'TURO',
  };
});

const bufferBlock = computed(() => {
  if (!detail.nextBooking) return null;
  const startH = hoursSince(detail.nextBooking.startAt) - bufferHours;
  const endH = hoursSince(detail.nextBooking.startAt);
  return { left: px(startH), width: px(endH) - px(startH) };
});

const conflictBand = computed(() => {
  if (!detail.nextBooking || detail.conflicts.length === 0 || !detail.interpretedEndAt) return null;
  const startH = hoursSince(detail.nextBooking.startAt);
  const endH = hoursSince(detail.interpretedEndAt);
  if (endH <= startH) return null;
  const overlapHours = endH - startH;
  const days = Math.floor(overlapHours / 24);
  const remHours = Math.round(overlapHours % 24);
  const label = days > 0 ? `Overlap ${days} day${days > 1 ? 's' : ''} ${remHours} h` : `Overlap ${remHours} h`;
  return { left: px(startH), width: px(endH) - px(startH), label };
});

const latestReturnMarker = computed(() => {
  const hasPartial = detail.options.some((o) => o.type === 'PARTIAL');
  if (!hasPartial || !detail.latestFreeEnd) return null;
  return { left: px(hoursSince(detail.latestFreeEnd)), text: formatDateTime(detail.latestFreeEnd, timezone) };
});

const todayMarker = computed(() => {
  const h = hoursSince(nowIso);
  if (h < 0 || h > windowHours.value) return null;
  return { left: px(h) };
});

const freeBlock = computed(() => {
  if (detail.nextBooking) return null;
  const anchorIso = detail.chosenEndAt ?? detail.interpretedEndAt ?? detail.originalEndAt;
  const startH = hoursSince(anchorIso) + bufferHours;
  if (detail.freeUntil) {
    const endH = hoursSince(detail.freeUntil);
    return { left: px(startH), width: px(endH) - px(startH), label: `Free until ${formatDayLabel(detail.freeUntil, timezone)}` };
  }
  return { left: px(startH), width: trackWidth.value - px(startH), label: 'No later bookings' };
});

const legend = [
  { swatch: 'bg-tl-trip', label: 'Current trip' },
  { swatch: 'ext-swatch', label: 'Requested / extension' },
  { swatch: 'bg-blue', label: 'Direct booking' },
  { swatch: 'bg-tl-next', label: 'Turo booking' },
  { swatch: 'buffer-swatch', label: 'Cleaning buffer' },
  { swatch: 'bg-grey-bg border border-line-strong', label: 'Free' },
  { swatch: 'bg-danger/10 border border-dashed border-danger', label: 'Conflict' },
];
</script>

<template>
  <div class="bg-surface border border-line rounded-card px-[18px] pt-4 pb-3">
    <div class="flex justify-between mb-2.5">
      <b class="font-semibold text-ink">Vehicle timeline</b>
      <span class="text-[12px] text-muted">{{ detail.vehicle.name }}</span>
    </div>

    <div class="flex">
      <div class="w-[76px] shrink-0 flex flex-col">
        <div class="h-[26px]"></div>
        <div class="flex flex-col gap-1.5 pt-3 text-[12px] text-muted">
          <div class="h-6 leading-6">Current trip</div>
          <div class="h-6 leading-6">{{ laneLabel }}</div>
          <div class="h-6 leading-6">Next booking</div>
        </div>
      </div>

      <div class="flex-1 min-w-0 overflow-x-auto">
        <div :style="{ width: trackWidth + 'px' }">
          <div class="flex text-[12px] text-muted border-b border-line">
            <div
              v-for="(label, i) in dayLabels"
              :key="i"
              class="pb-1.5 shrink-0"
              :class="i > 0 ? 'border-l border-line pl-1.5' : ''"
              :style="{ width: DAY_WIDTH + 'px' }"
            >
              {{ label }}
            </div>
          </div>

          <div
            class="relative h-24 mt-1.5"
            :style="{
              width: trackWidth + 'px',
              backgroundImage: 'linear-gradient(90deg, #E4E4E1 1px, transparent 1px)',
              backgroundSize: `${DAY_WIDTH}px 100%`,
            }"
          >
            <div
              v-if="conflictBand"
              class="absolute top-0 h-24 bg-danger/10 border-l border-r border-dashed border-danger z-0"
              :style="{ left: conflictBand.left + 'px', width: conflictBand.width + 'px' }"
            >
              <span class="absolute bottom-[3px] left-0 right-0 text-center text-[11px] font-semibold text-danger">{{ conflictBand.label }}</span>
            </div>

            <div
              class="absolute top-1.5 h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden bg-tl-trip text-white"
              :style="{ left: tripBlock.left + 'px', width: tripBlock.width + 'px' }"
            ></div>

            <div
              v-if="requestedBlock"
              class="absolute top-9 h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden"
              :class="requestedBlock.kind === 'done'
                ? 'border border-tl-done text-tl-done'
                : 'border border-tl-ext-border text-[#3B2A94]'"
              :style="{
                left: requestedBlock.left + 'px',
                width: Math.max(requestedBlock.width, 16) + 'px',
                backgroundImage: requestedBlock.kind === 'done'
                  ? 'repeating-linear-gradient(135deg, #BFE3CB 0 6px, #E3F4E8 6px 12px)'
                  : 'repeating-linear-gradient(135deg, #DDD6F7 0 6px, #F1EEFC 6px 12px)',
              }"
            >
              <span v-if="requestedBlock.width >= 90">{{ requestedBlock.label }}</span>
            </div>

            <div
              v-if="bufferBlock"
              class="absolute top-[66px] h-6 rounded border border-tl-buffer-border flex items-center justify-center"
              :style="{
                left: bufferBlock.left + 'px',
                width: bufferBlock.width + 'px',
                backgroundImage: 'repeating-linear-gradient(135deg, #C9C9C5 0 3px, #EDEDEB 3px 6px)',
              }"
            >
              <span
                v-if="bufferBlock.width >= 70"
                class="text-[11px] text-ink-2 whitespace-nowrap"
              >2h cleaning</span>
            </div>

            <div
              v-if="nextBlock"
              class="absolute top-[66px] h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden text-white"
              :class="nextBlock.isTuro ? 'bg-tl-next' : 'bg-blue'"
              :style="{ left: nextBlock.left + 'px', width: Math.max(nextBlock.width, 16) + 'px' }"
            >
              <span v-if="nextBlock.width >= 50">{{ nextBlock.label }}</span>
            </div>

            <div
              v-if="freeBlock"
              class="absolute top-[66px] h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden bg-grey-bg text-ink-2"
              :style="{ left: freeBlock.left + 'px', width: freeBlock.width + 'px' }"
            >
              {{ freeBlock.label }}
            </div>

            <div
              v-if="latestReturnMarker"
              class="absolute top-0 h-24 w-[2px] bg-ink z-[2]"
              :style="{ left: latestReturnMarker.left + 'px' }"
            ></div>

            <div
              v-if="todayMarker"
              class="absolute top-0 h-24 w-0 border-l-2 border-dashed border-faint z-[1]"
              :style="{ left: todayMarker.left + 'px' }"
            >
              <span class="absolute -top-[1px] left-1 text-[10px] font-semibold uppercase tracking-[.04em] text-faint whitespace-nowrap">Today</span>
            </div>
          </div>

          <div class="relative h-6">
            <div
              v-if="latestReturnMarker"
              class="absolute top-[3px] text-[12px] font-semibold whitespace-nowrap pr-2 text-ink"
              :style="{ left: latestReturnMarker.left + 'px' }"
            >
              Latest return · {{ latestReturnMarker.text }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2 pt-2.5 border-t border-line">
      <div v-for="item in legend" :key="item.label" class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-[2px] shrink-0" :class="item.swatch"></span>
        <span class="text-[11px] text-muted">{{ item.label }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ext-swatch {
  background-image: repeating-linear-gradient(135deg, #ddd6f7 0 3px, #f1eefc 3px 6px);
  border: 1px solid var(--color-tl-ext-border);
}
.buffer-swatch {
  background-image: repeating-linear-gradient(135deg, #c9c9c5 0 3px, #ededeb 3px 6px);
  border: 1px solid var(--color-tl-buffer-border);
}
</style>
