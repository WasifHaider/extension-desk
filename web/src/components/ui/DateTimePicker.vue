<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { DateTime } from 'luxon';
import Dropdown from './Dropdown.vue';

// modelValue uses the same local 'yyyy-LL-dd'T'HH:mm' shape as a native
// datetime-local input, so parents that already parse that string (via
// `new Date(...)` or `DateTime.fromISO(..., { zone })`) need no changes.
const { modelValue, placeholder = 'Pick date & time' } = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);
const panel = ref<HTMLElement | null>(null);

function parse(): DateTime | null {
  if (!modelValue) return null;
  const dt = DateTime.fromFormat(modelValue, "yyyy-LL-dd'T'HH:mm");
  return dt.isValid ? dt : null;
}

const viewMonth = ref<DateTime>(DateTime.now().startOf('month'));
const selectedDate = ref<DateTime | null>(null);
const hour12 = ref(12);
const minute = ref(0);
const ampm = ref<'AM' | 'PM'>('PM');

function resetFromModel() {
  const dt = parse() ?? DateTime.now();
  viewMonth.value = dt.startOf('month');
  selectedDate.value = parse() ? dt.startOf('day') : null;
  const h = dt.hour % 12 === 0 ? 12 : dt.hour % 12;
  hour12.value = h;
  minute.value = dt.minute;
  ampm.value = dt.hour >= 12 ? 'PM' : 'AM';
}

function toggle() {
  if (!open.value) resetFromModel();
  open.value = !open.value;
  if (open.value) {
    nextTick(() => panel.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
}

const hourOptions = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
const minuteOptions = Array.from({ length: 12 }, (_, i) => {
  const m = i * 5;
  return { value: String(m), label: m.toString().padStart(2, '0') };
});
const ampmOptions = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

const hourStr = computed({
  get: () => String(hour12.value),
  set: (v) => (hour12.value = Number(v)),
});
const minuteStr = computed({
  get: () => String(minute.value),
  set: (v) => (minute.value = Number(v)),
});
const ampmStr = computed({
  get: () => ampm.value,
  set: (v) => (ampm.value = v === 'AM' ? 'AM' : 'PM'),
});

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const gridCells = computed(() => {
  const start = viewMonth.value;
  const leading = start.weekday % 7; // Luxon: Mon=1..Sun=7 -> Sun=0 offset
  const daysInMonth = start.daysInMonth ?? 30;
  const cells: Array<{ day: number; date: DateTime } | null> = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: start.set({ day: d }) });
  return cells;
});

function prevMonth() {
  viewMonth.value = viewMonth.value.minus({ months: 1 });
}
function nextMonth() {
  viewMonth.value = viewMonth.value.plus({ months: 1 });
}
function pickDay(date: DateTime) {
  selectedDate.value = date.startOf('day');
}

const today = DateTime.now().startOf('day');

function apply() {
  if (!selectedDate.value) return;
  let h24 = hour12.value % 12;
  if (ampm.value === 'PM') h24 += 12;
  const result = selectedDate.value.set({ hour: h24, minute: minute.value });
  emit('update:modelValue', result.toFormat("yyyy-LL-dd'T'HH:mm"));
  open.value = false;
}
function cancel() {
  open.value = false;
}

const displayValue = computed(() => {
  const dt = parse();
  return dt ? dt.toFormat('ccc d LLL, h:mm a') : '';
});

function onDocClick(e: MouseEvent) {
  if (root.value && !root.value.contains(e.target as Node)) open.value = false;
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false;
}
onMounted(() => {
  document.addEventListener('mousedown', onDocClick);
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="relative inline-block">
    <button
      type="button"
      class="btn w-full flex items-center gap-2 bg-surface border border-line-strong rounded-btn px-2.5 py-1.5 text-left"
      :class="open ? 'border-accent shadow-[0_0_0_3px_var(--color-accent-tint)]' : 'hover:border-faint'"
      @click="toggle"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" class="shrink-0 text-accent">
        <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3" />
        <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
      </svg>
      <span class="truncate tabular-nums" :class="displayValue ? 'text-ink' : 'text-faint'">{{ displayValue || placeholder }}</span>
    </button>

    <Transition name="fade">
      <div
        v-if="open"
        ref="panel"
        class="absolute z-50 mt-1 w-[260px] bg-surface border border-line rounded-card shadow-[0_8px_24px_rgba(0,0,0,0.12)] p-3"
      >
        <div class="flex items-center justify-between mb-2">
          <button type="button" class="btn w-6 h-6 flex items-center justify-center rounded-btn hover:bg-canvas cursor-pointer" @click="prevMonth">
            ‹
          </button>
          <div class="text-[13px] font-semibold text-ink">{{ viewMonth.toFormat('LLLL yyyy') }}</div>
          <button type="button" class="btn w-6 h-6 flex items-center justify-center rounded-btn hover:bg-canvas cursor-pointer" @click="nextMonth">
            ›
          </button>
        </div>

        <div class="grid grid-cols-7 gap-y-1 text-center">
          <div v-for="w in weekdayLabels" :key="w" class="text-[10px] font-semibold text-faint uppercase">{{ w }}</div>
          <template v-for="(cell, i) in gridCells" :key="i">
            <div v-if="!cell"></div>
            <button
              v-else
              type="button"
              class="btn w-7 h-7 mx-auto flex items-center justify-center rounded-full text-[12px] cursor-pointer transition-ui"
              :class="[
                selectedDate && cell.date.hasSame(selectedDate, 'day')
                  ? 'bg-accent text-white font-semibold'
                  : 'text-ink hover:bg-canvas',
                !selectedDate && cell.date.hasSame(today, 'day') ? 'ring-1 ring-inset ring-accent' : '',
              ]"
              @click="pickDay(cell.date)"
            >
              {{ cell.day }}
            </button>
          </template>
        </div>

        <div class="flex items-center gap-1.5 mt-3 pt-3 border-t border-line">
          <div class="w-[58px]">
            <Dropdown v-model="hourStr" :options="hourOptions" />
          </div>
          <span class="text-muted">:</span>
          <div class="w-[58px]">
            <Dropdown v-model="minuteStr" :options="minuteOptions" />
          </div>
          <div class="w-[64px]">
            <Dropdown v-model="ampmStr" :options="ampmOptions" />
          </div>
        </div>

        <div class="flex gap-2 mt-3">
          <button
            type="button"
            class="btn flex-1 bg-accent text-white rounded-btn px-3 py-1.5 text-[13px] font-medium cursor-pointer hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!selectedDate"
            @click="apply"
          >
            Apply
          </button>
          <button type="button" class="btn text-muted text-[13px] cursor-pointer px-2" @click="cancel">Cancel</button>
        </div>
      </div>
    </Transition>
  </div>
</template>
