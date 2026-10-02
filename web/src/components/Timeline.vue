<script setup lang="ts">
import { computed } from 'vue';
import { DateTime } from 'luxon';
import type { ExtensionRequestDetail } from '../types';
import { formatDateTime, formatDayLabel } from '../format';

const BUFFER_MINUTES = 120;

const { detail, timezone } = defineProps<{ detail: ExtensionRequestDetail; timezone: string }>();

function windowStart(): DateTime {
  return DateTime.fromISO(detail.originalEndAt, { zone: 'utc' }).setZone(timezone).startOf('day');
}

function hoursSince(iso: string): number {
  return DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone).diff(windowStart(), 'hours').hours;
}

const laterEndIso = computed(() => detail.chosenEndAt ?? detail.interpretedEndAt ?? detail.originalEndAt);

const windowHours = computed(() => {
  const rawHours = hoursSince(laterEndIso.value);
  const days = Math.min(8, Math.max(4, Math.ceil(rawHours / 24) + 1));
  return days * 24;
});

const windowDays = computed(() => windowHours.value / 24);

function pct(hours: number): number {
  return Math.max(0, Math.min(100, (hours / windowHours.value) * 100));
}

const dayLabels = computed(() => {
  const start = windowStart();
  return Array.from({ length: windowDays.value }, (_, i) => start.plus({ days: i }).toFormat('ccc d'));
});

const tripBlock = computed(() => ({
  left: pct(0),
  width: pct(hoursSince(detail.originalEndAt)) - pct(0),
}));

const isApproved = computed(() => detail.status === 'APPROVED');

const requestedBlock = computed(() => {
  if (isApproved.value && detail.chosenEndAt) {
    return {
      left: pct(hoursSince(detail.originalEndAt)),
      width: pct(hoursSince(detail.chosenEndAt)) - pct(hoursSince(detail.originalEndAt)),
      label: `Extension · to ${formatDateTime(detail.chosenEndAt, timezone)}`,
      kind: 'done' as const,
    };
  }
  if (!detail.interpretedEndAt) return null;
  return {
    left: pct(hoursSince(detail.originalEndAt)),
    width: pct(hoursSince(detail.interpretedEndAt)) - pct(hoursSince(detail.originalEndAt)),
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
  const widthPct = pct(endH) - pct(startH);
  const fullLabel =
    next.source === 'TURO'
      ? `Turo guest · ${start.toFormat('ccc h a')} → ${end.toFormat('ccc h a')}`
      : `Direct · ${next.renterName ?? ''} · ${start.toFormat('ccc h a')} → ${end.toFormat('ccc h a')}`;
  const shortLabel = next.source === 'TURO' ? `Turo guest · ${start.toFormat('ccc h a')}` : `Direct · ${next.renterName ?? ''}`;
  return {
    left: pct(startH),
    width: widthPct,
    label: widthPct < 22 ? shortLabel : fullLabel,
    isTuro: next.source === 'TURO',
  };
});

const bufferBlock = computed(() => {
  if (!detail.nextBooking) return null;
  const startH = hoursSince(detail.nextBooking.startAt) - bufferHours;
  const endH = hoursSince(detail.nextBooking.startAt);
  return { left: pct(startH), width: pct(endH) - pct(startH), labelRight: 100 - pct(endH) };
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
  return { left: pct(startH), width: pct(endH) - pct(startH), label };
});

const latestReturnMarker = computed(() => {
  const hasPartial = detail.options.some((o) => o.type === 'PARTIAL');
  if (!hasPartial || !detail.latestFreeEnd) return null;
  return { left: pct(hoursSince(detail.latestFreeEnd)), text: formatDateTime(detail.latestFreeEnd, timezone) };
});

const freeBlock = computed(() => {
  if (detail.nextBooking) return null;
  const anchorIso = detail.chosenEndAt ?? detail.interpretedEndAt ?? detail.originalEndAt;
  const startH = hoursSince(anchorIso) + bufferHours;
  if (detail.freeUntil) {
    const endH = hoursSince(detail.freeUntil);
    return { left: pct(startH), width: pct(endH) - pct(startH), label: `Free until ${formatDayLabel(detail.freeUntil, timezone)}` };
  }
  return { left: pct(startH), width: 100 - pct(startH), label: 'No later bookings' };
});
</script>

<template>
  <div class="bg-surface border border-line rounded-card px-[18px] pt-4 pb-3">
    <div class="flex justify-between mb-2.5">
      <b class="font-semibold text-ink">Vehicle timeline</b>
      <span class="text-[12px] text-muted">{{ detail.vehicle.name }}</span>
    </div>
    <div class="grid grid-cols-[76px_1fr]">
      <div></div>
      <div
        class="grid text-[12px] text-muted border-b border-line"
        :style="{ gridTemplateColumns: `repeat(${windowDays}, 1fr)` }"
      >
        <div
          v-for="(label, i) in dayLabels"
          :key="i"
          class="pb-1.5"
          :class="i > 0 ? 'border-l border-line pl-1.5' : ''"
        >
          {{ label }}
        </div>
      </div>

      <div class="flex flex-col gap-1.5 pt-3 text-[12px] text-muted">
        <div class="h-6 leading-6">Current trip</div>
        <div class="h-6 leading-6">{{ laneLabel }}</div>
        <div class="h-6 leading-6">Next booking</div>
      </div>
      <div
        class="relative h-24 mt-1.5"
        :style="{
          backgroundImage: 'linear-gradient(90deg, #E4E4E1 1px, transparent 1px)',
          backgroundSize: `calc(100% / ${windowDays}) 100%`,
        }"
      >
        <div
          v-if="conflictBand"
          class="absolute top-0 h-24 bg-danger/10 border-l border-r border-dashed border-danger z-0"
          :style="{ left: conflictBand.left + '%', width: conflictBand.width + '%' }"
        >
          <span class="absolute bottom-[3px] left-0 right-0 text-center text-[11px] font-semibold text-danger">{{ conflictBand.label }}</span>
        </div>

        <div
          class="absolute top-1.5 h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden bg-tl-trip text-white"
          :style="{ left: tripBlock.left + '%', width: tripBlock.width + '%' }"
        ></div>

        <div
          v-if="requestedBlock"
          class="absolute top-9 h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden"
          :class="requestedBlock.kind === 'done'
            ? 'border border-tl-done text-tl-done'
            : 'border border-tl-ext-border text-[#3B2A94]'"
          :style="{
            left: requestedBlock.left + '%',
            width: requestedBlock.width + '%',
            backgroundImage: requestedBlock.kind === 'done'
              ? 'repeating-linear-gradient(135deg, #BFE3CB 0 6px, #E3F4E8 6px 12px)'
              : 'repeating-linear-gradient(135deg, #DDD6F7 0 6px, #F1EEFC 6px 12px)',
          }"
        >
          {{ requestedBlock.label }}
        </div>

        <div
          v-if="bufferBlock"
          class="absolute top-[66px] h-6 rounded border border-tl-buffer-border"
          :style="{
            left: bufferBlock.left + '%',
            width: bufferBlock.width + '%',
            backgroundImage: 'repeating-linear-gradient(135deg, #C9C9C5 0 3px, #EDEDEB 3px 6px)',
          }"
        ></div>
        <div
          v-if="bufferBlock"
          class="absolute top-[66px] h-6 leading-6 text-[12px] text-ink-2 whitespace-nowrap pr-1.5 text-right"
          :style="{ right: bufferBlock.labelRight + '%' }"
        >
          2h cleaning
        </div>

        <div
          v-if="nextBlock"
          class="absolute top-[66px] h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden text-white"
          :class="nextBlock.isTuro ? 'bg-tl-next' : 'bg-blue'"
          :style="{ left: nextBlock.left + '%', width: nextBlock.width + '%' }"
        >
          {{ nextBlock.label }}
        </div>

        <div
          v-if="freeBlock"
          class="absolute top-[66px] h-6 rounded text-[12px] leading-6 px-2 whitespace-nowrap overflow-hidden bg-grey-bg text-ink-2"
          :style="{ left: freeBlock.left + '%', width: freeBlock.width + '%' }"
        >
          {{ freeBlock.label }}
        </div>

        <div
          v-if="latestReturnMarker"
          class="absolute top-0 h-24 w-[2px] bg-ink z-[2]"
          :style="{ left: latestReturnMarker.left + '%' }"
        ></div>
      </div>

      <div></div>
      <div class="relative h-6">
        <div
          v-if="latestReturnMarker"
          class="absolute top-[3px] text-[12px] font-semibold whitespace-nowrap pr-2 text-ink"
          :style="{ right: (100 - latestReturnMarker.left) + '%' }"
        >
          Latest return · {{ latestReturnMarker.text }}
        </div>
      </div>
    </div>
  </div>
</template>
