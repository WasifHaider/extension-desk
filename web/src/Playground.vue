<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from './api';
import type { BookingFormInput } from './api';
import type { Meta, InboxRow, ExtensionRequestDetail, RenterPickerEntry, Message, Vehicle, PlaygroundBooking } from './types';
import AppHeader from './components/AppHeader.vue';
import InboxList from './components/InboxList.vue';
import RequestDetail from './components/RequestDetail.vue';
import DemoPhone from './components/DemoPhone.vue';
import BookingBuilder from './components/BookingBuilder.vue';

const SCOPE = 'PLAYGROUND';

const meta = ref<Meta | null>(null);
const inboxRows = ref<InboxRow[]>([]);
const selectedId = ref<string | null>(null);
const detail = ref<ExtensionRequestDetail | null>(null);
const renters = ref<RenterPickerEntry[]>([]);
const selectedRenterId = ref<string | null>(null);
const phoneMessages = ref<Message[]>([]);
const vehicles = ref<Vehicle[]>([]);
const bookings = ref<PlaygroundBooking[]>([]);

async function loadDetail(id: string) {
  detail.value = await api.detail(id);
}

async function selectRenter(id: string) {
  selectedRenterId.value = id;
  phoneMessages.value = await api.messages(id);
}

async function selectRow(id: string) {
  selectedId.value = id;
  await loadDetail(id);
  if (detail.value?.renter) {
    await selectRenter(detail.value.renter.id);
  }
}

async function loadBookings() {
  bookings.value = await api.playgroundBookings();
}

async function refresh() {
  inboxRows.value = await api.inbox(SCOPE);
  if (selectedId.value) {
    await loadDetail(selectedId.value);
  }
  if (selectedRenterId.value) {
    phoneMessages.value = await api.messages(selectedRenterId.value);
  }
  await loadBookings();
}

async function withErrorAlert(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    alert((e as Error).message);
  }
}

async function loadAll() {
  const [metaRes, inboxRes, rentersRes, vehiclesRes] = await Promise.all([
    api.meta(),
    api.inbox(SCOPE),
    api.renters(SCOPE),
    api.vehicles(SCOPE),
  ]);
  meta.value = metaRes;
  inboxRows.value = inboxRes;
  renters.value = rentersRes;
  vehicles.value = vehiclesRes;
  await loadBookings();
}

async function onReset() {
  await withErrorAlert(async () => {
    await api.playgroundReset();
    selectedId.value = null;
    detail.value = null;
    selectedRenterId.value = null;
    phoneMessages.value = [];
    await loadAll();
    if (renters.value[0]) {
      await selectRenter(renters.value[0].id);
    }
  });
}

async function onAct(type: string) {
  await withErrorAlert(async () => {
    if (!detail.value) return;
    const id = detail.value.id;
    if (detail.value.status === 'OFFERED' && type === 'PARTIAL') {
      await api.approve(id, 'PARTIAL');
    } else if (type === 'PARTIAL' && detail.value.status === 'READY') {
      await api.offer(id);
    } else {
      await api.approve(id, type);
    }
    await refresh();
  });
}

async function onDecline(reason: string) {
  await withErrorAlert(async () => {
    if (!detail.value) return;
    await api.decline(detail.value.id, reason);
    await refresh();
  });
}

async function onSendQuestion(text: string) {
  await withErrorAlert(async () => {
    if (!detail.value) return;
    await api.clarify(detail.value.id, text);
    await refresh();
  });
}

async function onSetDate(iso: string) {
  await withErrorAlert(async () => {
    if (!detail.value) return;
    await api.setInterpretation(detail.value.id, iso);
    await refresh();
  });
}

async function onSendInbound(body: string) {
  await withErrorAlert(async () => {
    if (!selectedRenterId.value) return;
    await api.sendInbound(selectedRenterId.value, body);
    await refresh();
  });
}

async function onCreateBooking(input: BookingFormInput) {
  await withErrorAlert(async () => {
    await api.playgroundCreateBooking(input);
    await refresh();
  });
}

async function onUpdateBooking(id: string, input: BookingFormInput) {
  await withErrorAlert(async () => {
    await api.playgroundUpdateBooking(id, input);
    await refresh();
  });
}

async function onCancelBooking(id: string) {
  await withErrorAlert(async () => {
    await api.playgroundCancelBooking(id);
    await refresh();
  });
}

onMounted(async () => {
  const existingVehicles = await api.vehicles(SCOPE);
  if (existingVehicles.length === 0) {
    await api.playgroundReset();
  }
  await loadAll();
  if (inboxRows.value[0]) {
    await selectRow(inboxRows.value[0].id);
  }
  if (!selectedRenterId.value && renters.value[0]) {
    await selectRenter(renters.value[0].id);
  }
});
</script>

<template>
  <div class="h-screen flex flex-col">
    <AppHeader
      :meta="meta"
      title="Extension Desk · Playground"
      reset-label="Reset playground"
      nav-label="Back to demo"
      nav-href="/"
      @reset="onReset"
    />
    <div class="grid grid-cols-[340px_minmax(0,1fr)_360px] flex-1 min-h-0">
      <div class="flex flex-col min-h-0 border-r border-line">
        <div class="p-3 overflow-y-auto shrink-0 max-h-[55%] border-b border-line">
          <BookingBuilder
            :vehicles="vehicles"
            :bookings="bookings"
            :timezone="meta?.timezone ?? 'America/New_York'"
            @create="onCreateBooking"
            @update="onUpdateBooking"
            @cancel="onCancelBooking"
          />
        </div>
        <InboxList
          class="flex-1 min-h-0"
          :rows="inboxRows"
          :selected-id="selectedId"
          :timezone="meta?.timezone ?? 'America/New_York'"
          :now-iso="meta?.now ?? new Date().toISOString()"
          @select="selectRow"
        />
      </div>
      <RequestDetail
        v-if="detail"
        :detail="detail"
        :timezone="meta?.timezone ?? 'America/New_York'"
        @act="onAct"
        @decline="onDecline"
        @send-question="onSendQuestion"
        @set-date="onSetDate"
      />
      <div v-else></div>
      <DemoPhone
        :renters="renters"
        :selected-renter-id="selectedRenterId"
        :messages="phoneMessages"
        @select-renter="selectRenter"
        @send="onSendInbound"
      />
    </div>
  </div>
</template>
