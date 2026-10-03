<script setup lang="ts">
import { reactive, ref } from 'vue';
import type { Vehicle, PlaygroundBooking } from '../types';
import type { BookingFormInput } from '../api';
import { formatDateTime, formatMoney } from '../format';

const { vehicles, bookings, timezone } = defineProps<{
  vehicles: Vehicle[];
  bookings: PlaygroundBooking[];
  timezone: string;
}>();
const emit = defineEmits<{
  create: [input: BookingFormInput];
  update: [id: string, input: BookingFormInput];
  cancel: [id: string];
}>();

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const editingId = ref<string | null>(null);
const form = reactive<BookingFormInput>({
  vehicleId: vehicles[0]?.id ?? '',
  renterName: '',
  source: 'DIRECT',
  startAt: '',
  endAt: '',
  hasCover: false,
});

function resetForm() {
  editingId.value = null;
  form.vehicleId = vehicles[0]?.id ?? '';
  form.renterName = '';
  form.source = 'DIRECT';
  form.startAt = '';
  form.endAt = '';
  form.hasCover = false;
}

function edit(b: PlaygroundBooking) {
  editingId.value = b.id;
  form.vehicleId = b.vehicleId;
  form.renterName = b.renter?.name ?? '';
  form.source = b.source;
  form.startAt = toLocalInput(b.startAt);
  form.endAt = toLocalInput(b.endAt);
  form.hasCover = b.coverageDailyCents > 0;
}

function submit() {
  if (!form.vehicleId || !form.startAt || !form.endAt) return;
  const input: BookingFormInput = {
    vehicleId: form.vehicleId,
    renterName: form.source === 'TURO' ? null : form.renterName?.trim() || null,
    source: form.source,
    startAt: new Date(form.startAt).toISOString(),
    endAt: new Date(form.endAt).toISOString(),
    hasCover: form.hasCover,
  };
  if (editingId.value) {
    emit('update', editingId.value, input);
  } else {
    emit('create', input);
  }
  resetForm();
}
</script>

<template>
  <div class="border border-line rounded-btn p-4 flex flex-col gap-4">
    <div class="font-semibold text-ink">Booking builder</div>

    <form class="grid grid-cols-2 gap-3 text-[13px]" @submit.prevent="submit">
      <label class="flex flex-col gap-1">
        Vehicle
        <select v-model="form.vehicleId" class="border border-line-strong rounded-btn px-2 py-1.5">
          <option v-for="v in vehicles" :key="v.id" :value="v.id">{{ v.name }} · {{ v.category }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        Source
        <select v-model="form.source" class="border border-line-strong rounded-btn px-2 py-1.5">
          <option value="DIRECT">Direct</option>
          <option value="TURO">Turo</option>
        </select>
      </label>
      <label class="flex flex-col gap-1">
        Renter name
        <input
          v-model="form.renterName"
          :disabled="form.source === 'TURO'"
          placeholder="Turo guest"
          class="border border-line-strong rounded-btn px-2 py-1.5 disabled:bg-canvas disabled:text-faint"
        />
      </label>
      <label class="flex items-center gap-2 self-end pb-1.5">
        <input type="checkbox" v-model="form.hasCover" />
        Damage cover
      </label>
      <label class="flex flex-col gap-1">
        Start
        <input v-model="form.startAt" type="datetime-local" class="border border-line-strong rounded-btn px-2 py-1.5" />
      </label>
      <label class="flex flex-col gap-1">
        End
        <input v-model="form.endAt" type="datetime-local" class="border border-line-strong rounded-btn px-2 py-1.5" />
      </label>
      <div class="col-span-2 flex gap-2">
        <button type="submit" class="bg-accent text-white rounded-btn px-3.5 py-1.5 text-[13px] font-medium cursor-pointer">
          {{ editingId ? 'Save booking' : 'Create booking' }}
        </button>
        <button
          v-if="editingId"
          type="button"
          class="border border-line-strong rounded-btn px-3.5 py-1.5 text-[13px] cursor-pointer"
          @click="resetForm"
        >
          Cancel edit
        </button>
      </div>
    </form>

    <div class="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
      <div
        v-for="b in bookings"
        :key="b.id"
        class="flex items-center justify-between gap-2 text-[13px] border-b border-line py-1.5"
        :class="b.status === 'CANCELLED' ? 'opacity-50' : ''"
      >
        <div class="flex-1 min-w-0">
          <div class="font-medium text-ink truncate">
            {{ b.vehicle.name }} · {{ b.source === 'TURO' ? 'Turo guest' : b.renter?.name ?? 'Direct' }}
          </div>
          <div class="text-muted">
            {{ formatDateTime(b.startAt, timezone) }} → {{ formatDateTime(b.endAt, timezone) }}
            <span v-if="b.coverageDailyCents > 0"> · Cover {{ formatMoney(b.coverageDailyCents) }}/day</span>
            <span> · {{ b.status }}</span>
          </div>
        </div>
        <div class="flex gap-2 shrink-0">
          <button
            v-if="b.status !== 'CANCELLED'"
            class="text-accent cursor-pointer"
            @click="edit(b)"
          >
            Edit
          </button>
          <button
            v-if="b.status !== 'CANCELLED'"
            class="text-[#B3261E] cursor-pointer"
            @click="emit('cancel', b.id)"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
